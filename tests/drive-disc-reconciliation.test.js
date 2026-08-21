import assert from "node:assert/strict"

import {
    DRIVE_DISC_EXPORT_FORMAT,
    DRIVE_DISC_EXPORT_VERSION,
    buildScannerImportPlan,
    createEmptyInventoryStore,
    normalizeDriveDiscImport,
    planDriveDiscReconciliation,
} from "../core/inventory-model.js"
import { enkaDriveDiscId } from "../core/enka-import/drive-disc-plan.js"

const OWNER_ID = "default"
const AGENT_ID = "hoshimi_miyabi"
const UID_A = "1302309616"
const UID_B = "1300027938"
const NOW = "2026-08-18T08:00:00.000Z"

function scannerItem(sequence = 1, overrides = {}) {
    return {
        "序号": sequence,
        "名称": overrides.setName ?? "流光咏叹",
        "槽位": overrides.partition ?? 1,
        "品质": overrides.rarity ?? "S",
        "等级": overrides.level ?? 15,
        "最大等级": overrides.maxLevel ?? 15,
        "主属性": overrides.mainStat ?? { "生命值": 2200 },
        "副属性": overrides.subStats ?? [
            { "攻击力": "6%" },
            { "暴击率": "4.8%" },
            { "暴击伤害": "14.4%" },
        ],
    }
}

function normalizedScannerDiscs(items, suffix = "scan") {
    return normalizeDriveDiscImport(items, {
        ownerId: OWNER_ID,
        sourcePath: `${suffix}.json`,
        importId: `scanner-import-${suffix}`,
        importedAt: NOW,
    }).driveDiscs
}

function normalizedDisc(id, overrides = {}) {
    return {
        id,
        ownerId: OWNER_ID,
        setId: "astral_voice",
        setName: "流光咏叹",
        canonicalSetName: { zhCN: "流光咏叹" },
        partition: 1,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        statUnitVersion: 2,
        locked: false,
        equippedBy: null,
        reservedForAgentId: null,
        excludedForAgentIds: [],
        mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
        subStats: [
            { stat: "atkPct", value: 6, mode: "pct", label: "攻击力" },
            { stat: "critRate", value: 4.8, mode: "pct", label: "暴击率" },
            { stat: "critDmg", value: 14.4, mode: "pct", label: "暴击伤害" },
        ],
        ...overrides,
    }
}

function enkaDisc(uid, equipmentUid, overrides = {}) {
    return normalizedDisc(enkaDriveDiscId(uid, equipmentUid), {
        locked: true,
        equippedBy: AGENT_ID,
        source: {
            type: "enka-zzz-showcase",
            uid,
            equipmentUid,
            equipmentId: "31000",
            agentId: AGENT_ID,
        },
        ...overrides,
    })
}

function nativeExport(driveDiscs, suffix = "native", sourceAccount = { id: "calculator-owner-a", label: "原生备份" }) {
    return {
        format: DRIVE_DISC_EXPORT_FORMAT,
        version: DRIVE_DISC_EXPORT_VERSION,
        exportedAt: NOW,
        sourceAccount: { ...sourceAccount, label: `${sourceAccount.label}-${suffix}` },
        driveDiscs,
    }
}

function storeWith(driveDiscs = []) {
    return {
        ...createEmptyInventoryStore(),
        currentOwnerId: OWNER_ID,
        driveDiscs,
    }
}

function assertSources(disc, expected) {
    for (const source of expected) {
        assert.ok(disc.provenance?.[source], `expected provenance.${source} on ${disc.id}`)
    }
}

// Scanner -> Enka: keep the existing canonical id, attach Enka identity, and let
// Enka authoritatively supply lock/equipped state without clearing user restrictions.
{
    const scannerPlan = buildScannerImportPlan(storeWith(), [scannerItem()], {
        ownerId: OWNER_ID,
        sourcePath: "scanner-first.json",
        importId: "scanner-first",
        importedAt: NOW,
        now: NOW,
    })
    const scannerId = scannerPlan.nextStore.driveDiscs[0].id
    scannerPlan.nextStore.driveDiscs[0].reservedForAgentId = "aria"
    scannerPlan.nextStore.driveDiscs[0].excludedForAgentIds = ["yixuan"]

    const reconciled = planDriveDiscReconciliation({
        existingDiscs: scannerPlan.nextStore.driveDiscs,
        importedDiscs: [enkaDisc(UID_A, "100")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })

    assert.equal(reconciled.driveDiscs.length, 1)
    assert.equal(reconciled.driveDiscs[0].id, scannerId)
    assert.equal(reconciled.resolvedIds[enkaDriveDiscId(UID_A, "100")], scannerId)
    assert.equal(reconciled.sourceMerged.length, 1)
    assert.equal(reconciled.driveDiscs[0].locked, true)
    assert.equal(reconciled.driveDiscs[0].equippedBy, AGENT_ID)
    assert.equal(reconciled.driveDiscs[0].reservedForAgentId, "aria")
    assert.deepEqual(reconciled.driveDiscs[0].excludedForAgentIds, ["yixuan"])
    assertSources(reconciled.driveDiscs[0], ["scanner", "enkaZzz"])
}

// Enka -> Scanner: Scanner has no lock/equipped observation and must not erase it.
{
    const enkaFirst = planDriveDiscReconciliation({
        importedDiscs: [enkaDisc(UID_A, "101", {
            reservedForAgentId: "aria",
            excludedForAgentIds: ["yixuan"],
        })],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    const scannerSecond = buildScannerImportPlan(storeWith(enkaFirst.driveDiscs), [scannerItem()], {
        ownerId: OWNER_ID,
        sourcePath: "scanner-second.json",
        importId: "scanner-second",
        importedAt: NOW,
        now: NOW,
    })

    assert.equal(scannerSecond.nextStore.driveDiscs.length, 1)
    const disc = scannerSecond.nextStore.driveDiscs[0]
    assert.equal(disc.id, enkaDriveDiscId(UID_A, "101"))
    assert.equal(disc.locked, true)
    assert.equal(disc.equippedBy, AGENT_ID)
    assert.equal(disc.reservedForAgentId, "aria")
    assert.deepEqual(disc.excludedForAgentIds, ["yixuan"])
    assertSources(disc, ["enkaZzz", "scanner"])
}

// Enka -> Calculator native JSON and the reverse direction both converge to one record.
{
    const existingEnka = planDriveDiscReconciliation({
        importedDiscs: [enkaDisc(UID_A, "102")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    }).driveDiscs
    const nativeAfterEnka = buildScannerImportPlan(storeWith(existingEnka), nativeExport([
        normalizedDisc("native-copy-102", { source: { type: "manual" } }),
    ], "after-enka"), {
        ownerId: OWNER_ID,
        sourcePath: "after-enka.json",
        importId: "native-after-enka",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(nativeAfterEnka.nextStore.driveDiscs.length, 1)
    assert.equal(nativeAfterEnka.nextStore.driveDiscs[0].id, enkaDriveDiscId(UID_A, "102"))
    assertSources(nativeAfterEnka.nextStore.driveDiscs[0], ["enkaZzz", "calculatorJson"])

    const nativeIdentityUpdate = buildScannerImportPlan(nativeAfterEnka.nextStore, nativeExport([
        normalizedDisc("native-copy-102", {
            level: 12,
            subStats: [
                { stat: "atkPct", value: 3, mode: "pct", label: "攻击力" },
                { stat: "critRate", value: 2.4, mode: "pct", label: "暴击率" },
                { stat: "critDmg", value: 9.6, mode: "pct", label: "暴击伤害" },
            ],
            source: { type: "manual" },
        }),
    ], "native-identity-update"), {
        ownerId: OWNER_ID,
        sourcePath: "native-identity-update.json",
        importId: "native-identity-update",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(nativeIdentityUpdate.hasUnresolvedConflicts, false)
    assert.equal(nativeIdentityUpdate.nextStore.driveDiscs.length, 1)
    assert.equal(nativeIdentityUpdate.nextStore.driveDiscs[0].id, enkaDriveDiscId(UID_A, "102"))
    assert.equal(nativeIdentityUpdate.nextStore.driveDiscs[0].level, 12)

    const nativeFirst = buildScannerImportPlan(storeWith(), nativeExport([
        normalizedDisc("native-first-103", { source: { type: "manual" } }),
    ], "before-enka"), {
        ownerId: OWNER_ID,
        sourcePath: "before-enka.json",
        importId: "native-before-enka",
        importedAt: NOW,
        now: NOW,
    })
    const enkaAfterNative = planDriveDiscReconciliation({
        existingDiscs: nativeFirst.nextStore.driveDiscs,
        importedDiscs: [enkaDisc(UID_A, "103")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(enkaAfterNative.driveDiscs.length, 1)
    assert.equal(enkaAfterNative.driveDiscs[0].id, "native-first-103")
    assert.equal(enkaAfterNative.driveDiscs[0].locked, true)
    assert.equal(enkaAfterNative.driveDiscs[0].equippedBy, AGENT_ID)
    assertSources(enkaAfterNative.driveDiscs[0], ["calculatorJson", "enkaZzz"])
}

// Calculator native record IDs are strong identities. Two distinct records may
// legitimately have the same visible content and must both survive.
{
    const nativeDistinct = buildScannerImportPlan(storeWith(), nativeExport([
        normalizedDisc("native-identical-a", { source: { type: "manual" } }),
        normalizedDisc("native-identical-b", { source: { type: "manual" } }),
    ], "native-distinct"), {
        ownerId: OWNER_ID,
        sourcePath: "native-distinct.json",
        importId: "native-distinct",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(nativeDistinct.nextStore.driveDiscs.length, 2)
    assert.deepEqual(
        new Set(nativeDistinct.nextStore.driveDiscs.map(disc => disc.provenance.calculatorJson.sourceRecordId)),
        new Set(["native-identical-a", "native-identical-b"]),
    )
}

// A native backup must not restore a reservation that the user explicitly
// cleared after the backup was created.
{
    const existing = normalizedDisc("native-cleared-reservation", {
        reservedForAgentId: null,
        excludedForAgentIds: ["yixuan"],
    })
    const plan = buildScannerImportPlan(storeWith([existing]), nativeExport([
        normalizedDisc("native-cleared-reservation", {
            reservedForAgentId: "aria",
            excludedForAgentIds: [],
        }),
    ], "cleared-reservation"), {
        ownerId: OWNER_ID,
        sourcePath: "cleared-reservation.json",
        importId: "native-cleared-reservation",
        importedAt: NOW,
        now: NOW,
    })

    assert.equal(plan.nextStore.driveDiscs[0].reservedForAgentId, null)
    assert.deepEqual(plan.nextStore.driveDiscs[0].excludedForAgentIds, ["yixuan"])
}

// Repeated observations are idempotent at the canonical inventory level.
{
    const imported = enkaDisc(UID_A, "104")
    const first = planDriveDiscReconciliation({
        importedDiscs: [imported],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    const second = planDriveDiscReconciliation({
        existingDiscs: first.driveDiscs,
        importedDiscs: [imported],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(second.driveDiscs.length, 1)
    assert.equal(second.added.length, 0)
    assert.equal(second.sourceMerged.length, 0)
    assert.equal(second.conflicts.length, 0)
    assert.equal(second.unchanged.length, 1)
    assert.deepEqual(second.driveDiscs, first.driveDiscs)

    const scanner = normalizedScannerDiscs([scannerItem()], "idempotent")
    const scannerFirst = planDriveDiscReconciliation({
        importedDiscs: scanner,
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    const scannerAgain = planDriveDiscReconciliation({
        existingDiscs: scannerFirst.driveDiscs,
        importedDiscs: normalizedScannerDiscs([scannerItem(99)], "idempotent-later"),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: "2026-08-18T09:00:00.000Z",
    })
    assert.equal(scannerAgain.driveDiscs.length, 1)
    assert.equal(scannerAgain.added.length, 0)
    assert.equal(scannerAgain.sourceMerged.length, 0)
    assert.equal(scannerAgain.conflicts.length, 0)
    assert.equal(scannerAgain.unchanged.length, 1)
    assert.deepEqual(scannerAgain.driveDiscs, scannerFirst.driveDiscs)

    const enkaWithScanner = planDriveDiscReconciliation({
        existingDiscs: [enkaDisc(UID_A, "undo-stable")],
        importedDiscs: normalizedScannerDiscs([scannerItem()], "undo-first"),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    const undoStore = storeWith(enkaWithScanner.driveDiscs)
    undoStore.enkaImportState = {
        version: 1,
        byOwner: {
            [OWNER_ID]: {
                undoJournal: {
                    id: "enka-undo-stable",
                    status: "committed",
                    affectedDriveDiscIds: [enkaWithScanner.driveDiscs[0].id],
                },
            },
        },
    }
    const repeatedScannerPlan = buildScannerImportPlan(undoStore, [scannerItem(99)], {
        ownerId: OWNER_ID,
        sourcePath: "undo-repeat.json",
        importId: "undo-repeat",
        importedAt: "2026-08-18T09:00:00.000Z",
        now: "2026-08-18T09:00:00.000Z",
    })
    assert.deepEqual(repeatedScannerPlan.nextStore.driveDiscs, enkaWithScanner.driveDiscs)
    assert.equal(repeatedScannerPlan.nextStore.enkaImportState.byOwner[OWNER_ID].undoJournal.status, "committed")
}

// Native record identity is namespaced by its exported Calculator account. A
// colliding local record ID from another account cannot overwrite the first.
{
    const first = buildScannerImportPlan(storeWith(), nativeExport([
        normalizedDisc("shared-native-id", { level: 12, source: { type: "manual" } }),
    ], "account-a", { id: "calculator-owner-a", label: "账号 A" }), {
        ownerId: OWNER_ID,
        sourcePath: "account-a.json",
        importId: "account-a",
        importedAt: NOW,
        now: NOW,
    })
    const second = buildScannerImportPlan(first.nextStore, nativeExport([
        normalizedDisc("shared-native-id", { level: 15, source: { type: "manual" } }),
    ], "account-b", { id: "calculator-owner-b", label: "账号 B" }), {
        ownerId: OWNER_ID,
        sourcePath: "account-b.json",
        importId: "account-b",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(second.hasUnresolvedConflicts, false)
    assert.equal(second.nextStore.driveDiscs.length, 2)
    assert.deepEqual(new Set(second.nextStore.driveDiscs.map(disc => disc.level)), new Set([12, 15]))
    assert.deepEqual(
        new Set(second.nextStore.driveDiscs.map(disc => disc.provenance.calculatorJson.sourceAccountId)),
        new Set(["calculator-owner-a", "calculator-owner-b"]),
    )
}

// A full native sync that retires an old ID in favor of an existing canonical
// record must migrate loadout references instead of treating the old ID as a
// plain deletion.
{
    const canonical = normalizedDisc("canonical-b", { source: { type: "manual" } })
    const legacy = normalizedDisc("legacy-a", {
        level: 12,
        source: {
            type: "enka-zzz-showcase",
            uid: UID_A,
            equipmentUid: "legacy-a",
            agentId: AGENT_ID,
        },
    })
    const store = storeWith([canonical, legacy])
    store.driveDiscLoadouts = [{
        id: "legacy-reference",
        ownerId: OWNER_ID,
        agentId: AGENT_ID,
        driveDiscIdsBySlot: { 1: "legacy-a" },
    }]
    const incoming = normalizedDisc("legacy-a", {
        source: {
            type: "enka-zzz-showcase",
            uid: UID_B,
            equipmentUid: "replacement-b",
            agentId: AGENT_ID,
        },
    })
    const plan = buildScannerImportPlan(store, nativeExport([
        incoming,
    ], "canonical-remap", { id: "canonical-remap-source", label: "迁移备份" }), {
        ownerId: OWNER_ID,
        sourcePath: "canonical-remap.json",
        importId: "canonical-remap",
        importedAt: NOW,
        now: NOW,
        removeMissing: true,
    })
    assert.equal(plan.reconciliation.resolvedIds["legacy-a"], "canonical-b")
    assert.deepEqual(plan.driveDiscIdRemap, { "legacy-a": "canonical-b" })
    assert.deepEqual(plan.deletedDriveDiscIds, ["legacy-a"])
    assert.deepEqual(plan.nextStore.driveDiscLoadouts[0].driveDiscIdsBySlot, { 1: "canonical-b" })
}

// Even a matching native account/id cannot replace a different Enka equipment
// identity carried by the backup record.
{
    const sourceAccount = { id: "calculator-owner-enka", label: "Enka 备份" }
    const nativeEnkaDisc = (uid, equipmentUid) => normalizedDisc("native-enka-id", {
        source: {
            type: "enka-zzz-showcase",
            uid,
            equipmentUid,
            equipmentId: "31000",
            agentId: AGENT_ID,
        },
    })
    const first = buildScannerImportPlan(storeWith(), nativeExport([
        nativeEnkaDisc(UID_A, "native-a"),
    ], "first", sourceAccount), {
        ownerId: OWNER_ID,
        sourcePath: "native-enka-first.json",
        importId: "native-enka-first",
        importedAt: NOW,
        now: NOW,
    })
    const second = buildScannerImportPlan(first.nextStore, nativeExport([
        nativeEnkaDisc(UID_B, "native-b"),
    ], "second", sourceAccount), {
        ownerId: OWNER_ID,
        sourcePath: "native-enka-second.json",
        importId: "native-enka-second",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(second.nextStore.driveDiscs.length, 2)
    assert.deepEqual(
        new Set(second.nextStore.driveDiscs.map(disc => `${disc.provenance.enkaZzz.uid}:${disc.provenance.enkaZzz.equipmentUid}`)),
        new Set([`${UID_A}:native-a`, `${UID_B}:native-b`]),
    )
}

// Equipment UID is scoped by game UID; neither cross-UID nor same-UID distinct
// Enka identities may collapse merely because their visible content is equal.
{
    const crossUid = planDriveDiscReconciliation({
        importedDiscs: [enkaDisc(UID_A, "shared"), enkaDisc(UID_B, "shared")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(crossUid.driveDiscs.length, 2)
    assert.deepEqual(new Set(crossUid.driveDiscs.map(disc => disc.provenance.enkaZzz.uid)), new Set([UID_A, UID_B]))

    const sameUidDistinctEquipment = planDriveDiscReconciliation({
        importedDiscs: [enkaDisc(UID_A, "201"), enkaDisc(UID_A, "202")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(sameUidDistinctEquipment.driveDiscs.length, 2)
    assert.deepEqual(
        new Set(sameUidDistinctEquipment.driveDiscs.map(disc => disc.provenance.enkaZzz.equipmentUid)),
        new Set(["201", "202"]),
    )
}

// Weak sources collapse exact duplicate observations, including reordered substats.
{
    const weakDuplicates = planDriveDiscReconciliation({
        importedDiscs: normalizedScannerDiscs([scannerItem(1), scannerItem(2)], "weak-duplicates"),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    assert.equal(weakDuplicates.driveDiscs.length, 1)
    assert.equal(weakDuplicates.duplicateInImport, 1)

    const scannerExisting = normalizedScannerDiscs([scannerItem()], "ordered")[0]
    const reorderedEnka = enkaDisc(UID_A, "203", {
        subStats: [
            { stat: "critDmg", value: 14.4, mode: "pct", label: "暴击伤害" },
            { stat: "atkPct", value: 6, mode: "pct", label: "攻击力" },
            { stat: "critRate", value: 4.8, mode: "pct", label: "暴击率" },
        ],
    })
    const reordered = planDriveDiscReconciliation({
        existingDiscs: [scannerExisting],
        importedDiscs: [reorderedEnka],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(reordered.driveDiscs.length, 1)
    assert.equal(reordered.sourceMerged.length, 1)
}

// Historical duplicates are diagnosed and retained, but a repeated weak observation
// cannot add a third copy or silently clean up existing records.
{
    const base = normalizedScannerDiscs([scannerItem()], "historical")[0]
    const historical = [
        { ...structuredClone(base), id: "historical-a", createdAt: "2026-08-01T00:00:00.000Z" },
        { ...structuredClone(base), id: "historical-b", createdAt: "2026-08-02T00:00:00.000Z" },
    ]
    const reconciled = planDriveDiscReconciliation({
        existingDiscs: historical,
        importedDiscs: normalizedScannerDiscs([scannerItem()], "historical-again"),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    assert.equal(reconciled.driveDiscs.length, 2)
    assert.equal(reconciled.added.length, 0)
    assert.equal(reconciled.historicalDuplicates, 1)
    assert.match(reconciled.warnings[0], /历史重复/)
    assert.deepEqual(new Set(reconciled.driveDiscs.map(disc => disc.id)), new Set(["historical-a", "historical-b"]))

    const syncPlan = buildScannerImportPlan(storeWith(historical), [scannerItem()], {
        ownerId: OWNER_ID,
        sourcePath: "historical-sync.json",
        importId: "historical-sync",
        importedAt: NOW,
        now: NOW,
        removeMissing: true,
    })
    assert.equal(syncPlan.nextStore.driveDiscs.length, 2)
    assert.equal(syncPlan.summary.removed, 0)
}

// Same-shape/different-content observations are distinct inventory records.
// They must not open an update/add conflict: only an exact v2 content match is
// strong enough for cross-source deduplication.
{
    const existing = normalizedScannerDiscs([scannerItem()], "shape-existing")[0]
    const differingObservations = [
        { label: "level", overrides: { level: 12 } },
        { label: "main stat", overrides: { mainStat: { stat: "hpFlat", value: 2201, mode: "flat", label: "生命值" } } },
        {
            label: "sub stat",
            overrides: {
                subStats: [
                    { stat: "atkPct", value: 3, mode: "pct", label: "攻击力" },
                    { stat: "critRate", value: 4.8, mode: "pct", label: "暴击率" },
                    { stat: "critDmg", value: 14.4, mode: "pct", label: "暴击伤害" },
                ],
            },
        },
    ]
    for (const [index, { label, overrides }] of differingObservations.entries()) {
        const incoming = enkaDisc(UID_A, `204-${index}`, overrides)
        const reconciled = planDriveDiscReconciliation({
            existingDiscs: [existing],
            importedDiscs: [incoming],
            ownerId: OWNER_ID,
            sourceKind: "enka",
            now: NOW,
        })
        assert.equal(reconciled.driveDiscs.length, 2, label)
        assert.equal(reconciled.conflicts.length, 0, label)
        assert.equal(reconciled.added.length, 1, label)
        assert.equal(reconciled.updated.length, 0, label)
        assert.equal(reconciled.added[0].id, incoming.id, label)
    }
}

// Fingerprints are only an index. A forced hash collision must still deep-compare
// normalized content and allocate deterministic, distinct canonical IDs.
{
    const colliding = [1, 2, 3].map(partition => normalizedDisc("forced-collision", {
        partition,
        mainStat: { stat: partition === 1 ? "hpFlat" : "atkFlat", value: 2000 + partition, mode: "flat" },
        source: { type: "manual" },
    }))
    const result = planDriveDiscReconciliation({
        importedDiscs: colliding,
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
        options: { hashText: () => "same-hash" },
    })
    assert.equal(result.driveDiscs.length, 3)
    assert.equal(new Set(result.driveDiscs.map(disc => disc.id)).size, 3)
    assert.deepEqual(result.driveDiscs.map(disc => disc.partition).sort(), [1, 2, 3])
}

// Hash collisions never make shape-only observations ambiguous: differing
// content receives deterministic suffix IDs. The reconciliation API still
// rejects records from a different owner.
{
    const collisionOptions = { hashText: () => "same-hash" }
    const imported = normalizeDriveDiscImport([
        scannerItem(1, { partition: 1 }),
        scannerItem(2, { partition: 2, mainStat: { "攻击力": 316 } }),
    ], {
        ownerId: OWNER_ID,
        sourcePath: "collision-conflicts.json",
        importId: "collision-conflicts",
        importedAt: NOW,
        ...collisionOptions,
    }).driveDiscs
    const existing = imported.map((disc, index) => ({
        ...structuredClone(disc),
        id: `collision-existing-${index + 1}`,
        level: 12,
    }))
    const unresolved = planDriveDiscReconciliation({
        existingDiscs: existing,
        importedDiscs: imported,
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
        options: collisionOptions,
    })
    assert.equal(unresolved.conflicts.length, 0)
    assert.equal(unresolved.added.length, 2)
    assert.equal(unresolved.driveDiscs.length, 4)
    assert.equal(new Set(unresolved.driveDiscs.map(disc => disc.id)).size, 4)

    assert.throws(() => planDriveDiscReconciliation({
        existingDiscs: [{ ...existing[0], ownerId: "other-owner" }],
        importedDiscs: imported.slice(0, 1),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    }), /cannot cross owner boundary/)
}

// Unknown stats preserve their raw identity but are never eligible for weak
// content deduplication. Each Scanner observation therefore remains distinct.
{
    const unknownScanner = normalizedScannerDiscs([
        scannerItem(1, { mainStat: { "未来属性": "88%" } }),
        scannerItem(2, { mainStat: { "未来属性": "88%" } }),
    ], "unknown-weak")
    assert.equal(unknownScanner[0].mainStat.stat, "unknown")
    assert.equal(unknownScanner[0].mainStat.label, "未来属性")
    assert.equal(unknownScanner[0].mainStat.rawValue, "88%")

    const first = planDriveDiscReconciliation({
        importedDiscs: unknownScanner,
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    assert.equal(first.driveDiscs.length, 2)
    assert.equal(first.duplicateInImport, 0)

    const repeated = planDriveDiscReconciliation({
        existingDiscs: first.driveDiscs.slice(0, 1),
        importedDiscs: unknownScanner.slice(0, 1),
        ownerId: OWNER_ID,
        sourceKind: "scanner",
        now: NOW,
    })
    assert.equal(repeated.driveDiscs.length, 2)
    assert.equal(repeated.sourceMerged.length, 0)
}

// Scanner label variants that still describe known Calculator stats must not
// enter the unknown-stat path or lose user restrictions on a full rescan.
{
    const aliases = normalizedScannerDiscs([
        scannerItem(1, { mainStat: { "攻击力%": "30%" } }),
        scannerItem(2, { mainStat: { "物理属性伤害加成": "30%" } }),
    ], "known-aliases")
    assert.deepEqual(aliases.map(disc => disc.mainStat.stat), ["atkPct", "physicalDmg"])
}

// Enka Equipment UID remains authoritative even when a future stat is unknown.
// The same physical disc updates in place and keeps the canonical ID/restrictions.
{
    const unknownStat = {
        stat: "unknown",
        mode: "unknown",
        value: 99,
        label: "PropertyId 99999",
        rawValue: 99,
        raw: { propertyId: "99999", propertyLevel: 1, propertyValue: 99 },
    }
    const existing = enkaDisc(UID_A, "unknown-strong", {
        level: 12,
        mainStat: unknownStat,
        reservedForAgentId: "aria",
        excludedForAgentIds: ["yixuan"],
    })
    const incoming = enkaDisc(UID_A, "unknown-strong", {
        level: 15,
        mainStat: { ...unknownStat, value: 120 },
    })
    const reconciled = planDriveDiscReconciliation({
        existingDiscs: [existing],
        importedDiscs: [incoming],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(reconciled.driveDiscs.length, 1)
    assert.equal(reconciled.driveDiscs[0].id, existing.id)
    assert.equal(reconciled.driveDiscs[0].level, 15)
    assert.equal(reconciled.driveDiscs[0].mainStat.value, 120)
    assert.equal(reconciled.driveDiscs[0].reservedForAgentId, "aria")
    assert.deepEqual(reconciled.driveDiscs[0].excludedForAgentIds, ["yixuan"])
}

// Exact duplicate observations of one Enka entity collapse, while contradictory
// slot/agent/template observations are structural blocking errors, not conflicts.
{
    const exact = enkaDisc(UID_A, "batch-identity")
    const folded = planDriveDiscReconciliation({
        importedDiscs: [exact, structuredClone(exact)],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(folded.driveDiscs.length, 1)
    assert.equal(folded.duplicateInImport, 1)
    assert.equal(folded.hasBlockingErrors, false)

    const contradictory = enkaDisc(UID_A, "batch-identity", {
        partition: 2,
        equippedBy: "aria",
        source: {
            type: "enka-zzz-showcase",
            uid: UID_A,
            equipmentUid: "batch-identity",
            equipmentId: "different-template",
            agentId: "aria",
        },
    })
    const blocked = planDriveDiscReconciliation({
        existingDiscs: [enkaDisc(UID_A, "preserved")],
        importedDiscs: [exact, contradictory],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(blocked.changed, false)
    assert.equal(blocked.hasBlockingErrors, true)
    assert.equal(blocked.blockingErrors[0].code, "ENKA_EQUIPMENT_IDENTITY_CONFLICT")
    assert.equal(blocked.driveDiscs.length, 1)
    assert.equal(blocked.driveDiscs[0].id, enkaDriveDiscId(UID_A, "preserved"))
    assert.equal(blocked.conflicts.length, 0)
}

// Across imports, an Equipment UID may move between agents and change mutable
// observations, but it may never become a different slot/set/template entity.
{
    const existing = enkaDisc(UID_A, "immutable-across-imports", {
        reservedForAgentId: "aria",
        excludedForAgentIds: ["yixuan"],
    })
    const incoming = enkaDisc(UID_A, "immutable-across-imports", {
        partition: 2,
        setId: "swing_jazz",
        setName: "摇摆爵士",
        source: {
            type: "enka-zzz-showcase",
            uid: UID_A,
            equipmentUid: "immutable-across-imports",
            equipmentId: "different-template",
            agentId: "aria",
        },
        equippedBy: "aria",
    })
    const blocked = planDriveDiscReconciliation({
        existingDiscs: [existing],
        importedDiscs: [incoming],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(blocked.hasBlockingErrors, true)
    assert.equal(blocked.blockingErrors[0].code, "ENKA_EQUIPMENT_IMMUTABLE_IDENTITY_CONFLICT")
    assert.deepEqual(
        new Set(blocked.blockingErrors[0].details.differences.map(item => item.field)),
        new Set(["partition", "set", "equipmentId"]),
    )
    assert.equal(blocked.driveDiscs[0].partition, 1)
    assert.equal(blocked.driveDiscs[0].setId, "astral_voice")
    assert.equal(blocked.driveDiscs[0].reservedForAgentId, "aria")
    assert.deepEqual(blocked.driveDiscs[0].excludedForAgentIds, ["yixuan"])
}

// An Enka canonical ID is an identity assertion, so an unrelated record already
// using that ID must block instead of falling through to the generic suffix path.
// Scanner/JSON imports retain their existing collision suffix behavior above.
{
    const canonicalId = enkaDriveDiscId(UID_A, "canonical-collision")
    const occupied = normalizedDisc(canonicalId, {
        level: 12,
        source: { type: "manual" },
    })
    const blocked = planDriveDiscReconciliation({
        existingDiscs: [occupied],
        importedDiscs: [enkaDisc(UID_A, "canonical-collision")],
        ownerId: OWNER_ID,
        sourceKind: "enka",
        now: NOW,
    })
    assert.equal(blocked.hasBlockingErrors, true)
    assert.equal(blocked.blockingErrors[0].code, "ENKA_CANONICAL_ID_COLLISION")
    assert.equal(blocked.changed, false)
    assert.deepEqual(blocked.driveDiscs, [occupied])
    assert.equal(blocked.added.length, 0)
}

// Version-1 Calculator exports may omit stat.mode. Known stat keys still form a
// usable native identity, so importing the same record twice remains idempotent.
{
    const withoutModes = normalizedDisc("native-without-stat-mode", {
        source: { type: "manual" },
        mainStat: { stat: "hpFlat", value: 2200, label: "生命值" },
        subStats: [
            { stat: "atkPct", value: 6, label: "攻击力" },
            { stat: "critRate", value: 4.8, label: "暴击率" },
        ],
    })
    const first = buildScannerImportPlan(storeWith(), nativeExport([
        withoutModes,
    ], "without-mode-first"), {
        ownerId: OWNER_ID,
        sourcePath: "without-mode-first.json",
        importId: "without-mode-first",
        importedAt: NOW,
        now: NOW,
    })
    const repeated = buildScannerImportPlan(first.nextStore, nativeExport([
        withoutModes,
    ], "without-mode-repeated"), {
        ownerId: OWNER_ID,
        sourcePath: "without-mode-repeated.json",
        importId: "without-mode-repeated",
        importedAt: NOW,
        now: NOW,
    })
    assert.equal(repeated.nextStore.driveDiscs.length, 1)
    assert.equal(repeated.nextStore.driveDiscs[0].id, withoutModes.id)
    assert.equal(repeated.reconciliation.changed, false)
    assert.equal(repeated.reconciliation.unchanged.length, 1)
    assert.equal(repeated.summary.added, 0)
    assert.equal(repeated.summary.updated, 0)
}

console.log("drive-disc-reconciliation.test.js: all assertions passed")
