import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
    importScannerExportToStore,
    loadUserDriveDiscStore,
    saveUserDriveDiscStore,
} from "../backend/driveDiscInventory.js"
import {
    createDriveDiscExport,
    DRIVE_DISC_EXPORT_FORMAT,
    DRIVE_DISC_EXPORT_VERSION,
    migrateDriveDiscSetAliases,
    normalizeDriveDiscImport,
    normalizeScannerExport,
} from "../core/inventory-model.js"

function scannerDisc(sequence, overrides = {}) {
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
            { "攻击力": 38 },
        ],
    }
}

const currentSetAliases = normalizeScannerExport([
    scannerDisc(1, { setName: "谶羽之誓" }),
    scannerDisc(2, { setName: "棘刺玫瑰", partition: 2 }),
], {
    ownerId: "default",
    sourcePath: "current-set-aliases.json",
    importedAt: "2026-08-04T00:00:00.000Z",
})
assert.deepEqual(
    currentSetAliases.driveDiscs.map(item => [item.setName, item.setId, item.canonicalSetName]),
    [
        ["谶羽之誓", "zzz_wiki_2116", { zhCN: "谶羽之誓" }],
        ["棘刺玫瑰", "zzz_wiki_2121", { zhCN: "棘刺玫瑰" }],
    ],
)

const driveDiscCatalog = JSON.parse(await readFile(new URL("../data/drive_disc_sets.json", import.meta.url), "utf8"))
const catalogAliases = normalizeScannerExport(
    driveDiscCatalog.sets.map((set, index) => scannerDisc(index + 1, {
        setName: set.name.zhCN,
        partition: (index % 6) + 1,
    })),
    {
        ownerId: "default",
        sourcePath: "catalog-set-aliases.json",
        importedAt: "2026-08-04T00:00:00.000Z",
    },
)
assert.deepEqual(
    catalogAliases.driveDiscs.map(item => [item.setName, item.setId, item.canonicalSetName]),
    driveDiscCatalog.sets.map(set => [set.name.zhCN, set.id, set.name]),
    "every catalog name must resolve to the same official id and canonical name during Scanner import",
)

const aliasMigrationInput = {
    version: 1,
    currentOwnerId: "default",
    owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "二号账号" },
    ],
    imports: [{ id: "alias-import", ownerId: "default" }],
    driveDiscs: [
        { id: "blank-id", ownerId: "default", setId: "", setName: "谶羽之誓", sentinel: { keep: true } },
        { id: "scanner-id", ownerId: "alt", setId: "scanner-set-old", setName: "棘刺玫瑰", locked: true },
        { id: "official-without-name", ownerId: "default", setId: "zzz_wiki_2116", setName: "谶羽之誓" },
        { id: "unknown", ownerId: "default", setId: "scanner-set-future", setName: "未来未知套装" },
        { id: "custom", ownerId: "alt", setId: "custom-user-set", setName: "谶羽之誓", canonicalSetName: null },
    ],
    driveDiscLoadouts: [{ id: "alias-loadout", ownerId: "alt", driveDiscIdsBySlot: { 2: "scanner-id" } }],
    futureStoreField: { preserve: true },
}
const migratedAliases = migrateDriveDiscSetAliases(aliasMigrationInput)
assert.notEqual(migratedAliases, aliasMigrationInput)
assert.deepEqual(migratedAliases.owners, aliasMigrationInput.owners)
assert.deepEqual(migratedAliases.imports, aliasMigrationInput.imports)
assert.deepEqual(migratedAliases.driveDiscLoadouts, aliasMigrationInput.driveDiscLoadouts)
assert.deepEqual(migratedAliases.futureStoreField, aliasMigrationInput.futureStoreField)
assert.deepEqual(
    migratedAliases.driveDiscs.map(({ setId, canonicalSetName }) => [setId, canonicalSetName]),
    [
        ["zzz_wiki_2116", { zhCN: "谶羽之誓" }],
        ["zzz_wiki_2121", { zhCN: "棘刺玫瑰" }],
        ["zzz_wiki_2116", { zhCN: "谶羽之誓" }],
        ["scanner-set-future", undefined],
        ["custom-user-set", null],
    ],
)
for (let index = 0; index < aliasMigrationInput.driveDiscs.length; index += 1) {
    const { setId: _beforeSetId, canonicalSetName: _beforeCanonicalName, ...before } = aliasMigrationInput.driveDiscs[index]
    const { setId: _afterSetId, canonicalSetName: _afterCanonicalName, ...after } = migratedAliases.driveDiscs[index]
    assert.deepEqual(after, before, `alias migration must preserve non-identity fields for disc ${index}`)
}
assert.equal(migratedAliases.driveDiscs[3], aliasMigrationInput.driveDiscs[3])
assert.equal(migratedAliases.driveDiscs[4], aliasMigrationInput.driveDiscs[4])
assert.equal(migrateDriveDiscSetAliases(migratedAliases), migratedAliases, "alias migration must be idempotent")

const nativeAliasImport = normalizeDriveDiscImport({
    format: DRIVE_DISC_EXPORT_FORMAT,
    version: DRIVE_DISC_EXPORT_VERSION,
    exportedAt: "2026-08-04T00:00:00.000Z",
    sourceAccount: { label: "原生备份" },
    driveDiscs: [
        {
            id: "native-blank-set-id",
            setId: "",
            setName: "谶羽之誓",
            partition: 1,
            rarity: "S",
            level: 15,
            maxLevel: 15,
            mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
            subStats: [],
        },
        {
            id: "native-official-missing-canonical",
            setId: "zzz_wiki_2121",
            setName: "棘刺玫瑰",
            partition: 2,
            rarity: "S",
            level: 15,
            maxLevel: 15,
            mainStat: { stat: "atkFlat", mode: "flat", value: 316 },
            subStats: [],
        },
    ],
}, {
    ownerId: "alt",
    importedAt: "2026-08-04T00:01:00.000Z",
})
assert.deepEqual(
    nativeAliasImport.driveDiscs.map(item => [item.ownerId, item.setId, item.canonicalSetName]),
    [
        ["alt", "zzz_wiki_2116", { zhCN: "谶羽之誓" }],
        ["alt", "zzz_wiki_2121", { zhCN: "棘刺玫瑰" }],
    ],
)

const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-disc-import-"))

try {
    const first = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
    ], { ownerId: "default", sourcePath: "first.json" })
    assert.equal(first.driveDiscs.length, 2)
    assert.deepEqual(first.lastImportSummary, {
        added: 2,
        skipped: 0,
        updated: 0,
        removed: 0,
        duplicateInImport: 0,
        deduplicated: 0,
        sourceMerged: 0,
        sourceDetached: 0,
        conflicts: 0,
        historicalDuplicates: 0,
        warnings: [],
    })

    const second = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
    ], { ownerId: "default", sourcePath: "second.json" })
    assert.equal(second.driveDiscs.length, 2)
    assert.equal(second.lastImportSummary.added, 0)
    assert.equal(second.lastImportSummary.skipped, 2)

    const upgraded = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
        scannerDisc(3, {
            partition: 3,
            level: 12,
            mainStat: { "防御力": 184 },
            subStats: [
                { "攻击力": "3%" },
                { "暴击率": "2.4%" },
                { "暴击伤害": "4.8%" },
            ],
        }),
    ], { ownerId: "default", sourcePath: "third.json" })
    const level12 = upgraded.driveDiscs.find(item => Number(item.partition) === 3)
    assert.ok(level12)
    const level12Id = level12.id

    const fourthPayload = [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
        scannerDisc(3, {
            partition: 3,
            level: 15,
            mainStat: { "防御力": 184 },
            subStats: [
                { "攻击力": "6%" },
                { "暴击率": "4.8%" },
                { "暴击伤害": "9.6%" },
            ],
        }),
    ]
    const fourth = await importScannerExportToStore(tempDir, fourthPayload, {
        ownerId: "default",
        sourcePath: "fourth.json",
    })
    const level15 = fourth.driveDiscs.find(item => Number(item.partition) === 3 && Number(item.level) === 15)
    assert.ok(level15)
    assert.notEqual(level15.id, level12Id)
    assert.equal(level15.level, 15)
    assert.equal(fourth.lastImportSummary.added, 1)
    assert.equal(fourth.lastImportSummary.updated, 0)
    assert.equal(fourth.lastImportSummary.conflicts, 0)

    const withDuplicate = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(1),
    ], { ownerId: "default", sourcePath: "duplicate.json" })
    assert.equal(withDuplicate.lastImportSummary.duplicateInImport, 1)
    assert.ok(withDuplicate.driveDiscs.length >= 3, "merge import should keep old discs when removeMissing is false")

    await saveUserDriveDiscStore(tempDir, {
        version: 1,
        updatedAt: null,
        owners: [
            { id: "default", label: "默认用户" },
            { id: "alt", label: "Alt" },
        ],
        imports: [],
        driveDiscs: [
            ...withDuplicate.driveDiscs,
            {
                id: "manual-delete-me",
                ownerId: "default",
                setId: "manual",
                setName: "手动",
                partition: 6,
                rarity: "S",
                level: 15,
                mainStat: { stat: "critRate", value: 24, mode: "pct" },
                subStats: [],
                source: { type: "manual" },
            },
            {
                id: "alt-keep-me",
                ownerId: "alt",
                setId: "manual",
                setName: "其他账号",
                partition: 1,
                rarity: "S",
                level: 15,
                mainStat: { stat: "hpFlat", value: 2200, mode: "flat" },
                subStats: [],
                source: { type: "manual" },
            },
            {
                id: "cross-owner-shared",
                ownerId: "default",
                setId: "manual-default-shared",
                setName: "默认账号同 ID",
                partition: 5,
                rarity: "S",
                level: 15,
                mainStat: { stat: "electricDmg", value: 30, mode: "pct" },
                subStats: [],
                source: { type: "manual" },
            },
            {
                id: "cross-owner-shared",
                ownerId: "alt",
                setId: "manual-alt-shared",
                setName: "其他账号同 ID",
                partition: 5,
                rarity: "S",
                level: 15,
                mainStat: { stat: "fireDmg", value: 30, mode: "pct" },
                subStats: [],
                source: { type: "manual" },
            },
        ],
        driveDiscLoadouts: [
            {
                id: "loadout-1",
                agentId: "ye_shunguang",
                ownerId: "default",
                name: "引用删除盘",
                driveDiscIdsBySlot: {
                    1: withDuplicate.driveDiscs[0].id,
                    6: "manual-delete-me",
                },
                source: { type: "manual" },
            },
            {
                id: "cross-owner-loadout",
                agentId: "ye_shunguang",
                ownerId: "default",
                name: "默认账号同 ID 引用",
                driveDiscIdsBySlot: { 5: "cross-owner-shared" },
                source: { type: "manual" },
            },
            {
                id: "cross-owner-loadout",
                agentId: "ye_shunguang",
                ownerId: "alt",
                name: "其他账号同 ID 引用",
                driveDiscIdsBySlot: { 5: "cross-owner-shared" },
                source: { type: "manual" },
            },
        ],
    })

    const removed = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
    ], { ownerId: "default", sourcePath: "remove.json", removeMissing: true })
    assert.equal(removed.driveDiscs.some(item => item.id === "manual-delete-me"), true)
    assert.equal(removed.driveDiscs.some(item => item.id === "alt-keep-me"), true)
    assert.equal(removed.driveDiscs.some(item => item.id === "cross-owner-shared" && item.ownerId === "default"), true)
    assert.equal(removed.driveDiscs.some(item => item.id === "cross-owner-shared" && item.ownerId === "alt"), true)
    assert.ok(removed.lastImportSummary.removed >= 1)
    const loadout = removed.driveDiscLoadouts.find(item => item.id === "loadout-1")
    assert.ok(loadout)
    assert.equal(loadout.driveDiscIdsBySlot["6"], "manual-delete-me")
    const defaultSharedLoadout = removed.driveDiscLoadouts.find(item => item.id === "cross-owner-loadout" && item.ownerId === "default")
    const altSharedLoadout = removed.driveDiscLoadouts.find(item => item.id === "cross-owner-loadout" && item.ownerId === "alt")
    assert.equal(defaultSharedLoadout.driveDiscIdsBySlot["5"], "cross-owner-shared")
    assert.equal(altSharedLoadout.driveDiscIdsBySlot["5"], "cross-owner-shared")

    await writeFile(path.join(tempDir, "user_drive_discs.json"), JSON.stringify({
        version: 1,
        driveDiscs: [
            {
                id: "legacy",
                ownerId: "default",
                setId: "astral_voice",
                setName: "流光咏叹",
                partition: 1,
                rarity: "S",
                level: 15,
                mainStat: { stat: "hpFlat", value: 2200, mode: "flat" },
                subStats: [],
            },
        ],
    }), "utf8")
    const legacy = await loadUserDriveDiscStore(tempDir)
    assert.ok(legacy.driveDiscs[0].contentFingerprint)
    assert.ok(legacy.driveDiscs[0].identityFingerprint)

    const legacyAliasDisc = {
        id: "legacy-alias-disc",
        ownerId: "default",
        setId: "scanner-set-old",
        setName: "流光咏叹",
        partition: 1,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: true,
        equippedBy: "agent-a",
        mainStat: { stat: "hpFlat", value: 2200, mode: "flat" },
        subStats: [
            { stat: "atkPct", value: 6, mode: "pct" },
            { stat: "critRate", value: 4.8, mode: "pct" },
            { stat: "critDmg", value: 14.4, mode: "pct" },
            { stat: "atkFlat", value: 38, mode: "flat" },
        ],
        source: { type: "zzz-scanner", sequence: 1 },
    }
    await saveUserDriveDiscStore(tempDir, {
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        currentOwnerId: "default",
        imports: [],
        driveDiscs: [
            legacyAliasDisc,
            {
                ...legacyAliasDisc,
                id: "legacy-alias-duplicate",
            },
        ],
        driveDiscLoadouts: [
            {
                id: "alias-loadout",
                ownerId: "default",
                agentId: "ye_shunguang",
                name: "旧重复引用",
                driveDiscIdsBySlot: {
                    1: "legacy-alias-duplicate",
                },
                source: { type: "manual" },
            },
        ],
    })
    const cleanedAliases = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
    ], { ownerId: "default", sourcePath: "alias-upgrade.json" })
    assert.equal(cleanedAliases.driveDiscs.length, 2)
    const retainedAliasDisc = cleanedAliases.driveDiscs.find(item => item.id === "legacy-alias-disc")
    assert.ok(retainedAliasDisc)
    assert.equal(retainedAliasDisc.setId, "astral_voice")
    assert.equal(retainedAliasDisc.locked, true)
    assert.equal(retainedAliasDisc.equippedBy, "agent-a")
    assert.equal(cleanedAliases.lastImportSummary.added, 0)
    assert.equal(cleanedAliases.lastImportSummary.deduplicated, 0)
    assert.equal(cleanedAliases.lastImportSummary.historicalDuplicates, 1)
    const aliasLoadout = cleanedAliases.driveDiscLoadouts.find(item => item.id === "alias-loadout")
    assert.ok(aliasLoadout)
    assert.equal(aliasLoadout.driveDiscIdsBySlot["1"], "legacy-alias-duplicate")

    const exportedAt = "2026-07-18T12:00:00.000Z"
    const exportSource = {
        version: 1,
        currentOwnerId: "default",
        owners: [
            { id: "default", label: "主账号" },
            { id: "alt", label: "其他账号" },
        ],
        imports: [],
        driveDiscs: [
            {
                ...legacyAliasDisc,
                id: "native-disc-a",
                ownerId: "default",
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-02T00:00:00.000Z",
                contentFingerprint: "stale-content",
                identityFingerprint: "stale-identity",
            },
            {
                ...legacyAliasDisc,
                id: "native-disc-b",
                ownerId: "default",
                partition: 2,
            },
            {
                ...legacyAliasDisc,
                id: "other-owner-disc",
                ownerId: "alt",
            },
        ],
        driveDiscLoadouts: [{ id: "not-exported", ownerId: "default" }],
    }
    const nativeExport = createDriveDiscExport(exportSource, { exportedAt })
    assert.equal(nativeExport.format, DRIVE_DISC_EXPORT_FORMAT)
    assert.equal(nativeExport.version, DRIVE_DISC_EXPORT_VERSION)
    assert.equal(nativeExport.exportedAt, exportedAt)
    assert.deepEqual(nativeExport.sourceAccount, { id: "default", label: "主账号" })
    assert.deepEqual(nativeExport.driveDiscs.map(item => item.id), ["native-disc-a", "native-disc-b"])
    assert.equal(Object.hasOwn(nativeExport, "driveDiscLoadouts"), false)
    assert.equal(Object.hasOwn(nativeExport.driveDiscs[0], "ownerId"), false)
    assert.equal(Object.hasOwn(nativeExport.driveDiscs[0], "contentFingerprint"), false)
    assert.equal(Object.hasOwn(nativeExport.driveDiscs[0], "identityFingerprint"), false)

    await saveUserDriveDiscStore(tempDir, {
        version: 1,
        currentOwnerId: "alt",
        owners: [
            { id: "default", label: "主账号" },
            { id: "alt", label: "导入目标" },
        ],
        imports: [],
        driveDiscs: [{
            ...legacyAliasDisc,
            id: "keep-other-account",
            ownerId: "default",
        }],
        driveDiscLoadouts: [],
    })
    const roundTrip = await importScannerExportToStore(tempDir, nativeExport, { sourcePath: "native-export.json" })
    assert.equal(roundTrip.lastImportSummary.added, 2)
    assert.equal(roundTrip.lastImportSummary.duplicateInImport, 0)
    assert.equal(roundTrip.driveDiscs.filter(item => item.ownerId === "alt").length, 2)
    assert.equal(roundTrip.driveDiscs.find(item => item.id === "native-disc-a").ownerId, "alt")
    assert.equal(roundTrip.driveDiscs.find(item => item.id === "native-disc-a").locked, true)
    assert.equal(roundTrip.driveDiscs.find(item => item.id === "native-disc-a").equippedBy, "agent-a")
    assert.ok(roundTrip.driveDiscs.some(item => item.id === "keep-other-account" && item.ownerId === "default"))

    const repeatedRoundTrip = await importScannerExportToStore(tempDir, nativeExport, { sourcePath: "native-export.json" })
    assert.equal(repeatedRoundTrip.lastImportSummary.added, 0)
    assert.equal(repeatedRoundTrip.lastImportSummary.skipped, 2)
    assert.equal(repeatedRoundTrip.driveDiscs.filter(item => item.ownerId === "alt").length, 2)

    const changedNativeExport = JSON.parse(JSON.stringify(nativeExport))
    changedNativeExport.driveDiscs[0].level = 14
    changedNativeExport.driveDiscs[0].locked = false
    const updatedRoundTrip = await importScannerExportToStore(tempDir, changedNativeExport, { sourcePath: "native-export.json" })
    assert.equal(updatedRoundTrip.lastImportSummary.updated, 1)
    assert.equal(updatedRoundTrip.lastImportSummary.added, 0)
    assert.equal(updatedRoundTrip.driveDiscs.find(item => item.id === "native-disc-a").level, 14)
    assert.equal(updatedRoundTrip.driveDiscs.find(item => item.id === "native-disc-a").locked, false)

    const beforeNativeRemove = await loadUserDriveDiscStore(tempDir)
    await saveUserDriveDiscStore(tempDir, {
        ...beforeNativeRemove,
        driveDiscLoadouts: [{
            id: "native-loadout",
            ownerId: "alt",
            agentId: "agent-a",
            name: "待同步清理",
            driveDiscIdsBySlot: { 1: "native-disc-b" },
        }],
    })
    const prunedNativeExport = {
        ...changedNativeExport,
        driveDiscs: [changedNativeExport.driveDiscs[0]],
    }
    const nativeRemoved = await importScannerExportToStore(tempDir, prunedNativeExport, {
        sourcePath: "native-export.json",
        removeMissing: true,
    })
    assert.equal(nativeRemoved.lastImportSummary.removed, 1)
    assert.equal(nativeRemoved.driveDiscs.some(item => item.id === "native-disc-b" && item.ownerId === "alt"), false)
    assert.ok(nativeRemoved.driveDiscs.some(item => item.id === "keep-other-account" && item.ownerId === "default"))
    const nativeLoadout = nativeRemoved.driveDiscLoadouts.find(item => item.id === "native-loadout")
    assert.equal(nativeLoadout.driveDiscIdsBySlot["1"], undefined)
    assert.equal(nativeLoadout.status, "incomplete")

    await assert.rejects(
        () => importScannerExportToStore(tempDir, { ...nativeExport, version: 2 }),
        /Unsupported Drive Disc export version/,
    )
    await assert.rejects(
        () => importScannerExportToStore(tempDir, { ...nativeExport, format: "unknown-drive-disc-export" }),
        /Unsupported Drive Disc import format/,
    )
    await assert.rejects(
        () => importScannerExportToStore(tempDir, {
            ...nativeExport,
            driveDiscs: [nativeExport.driveDiscs[0], nativeExport.driveDiscs[0]],
        }),
        /contains duplicate id/,
    )
    await assert.rejects(
        () => importScannerExportToStore(tempDir, { ...nativeExport, driveDiscs: [{ id: "broken" }] }),
        /must include setId or setName/,
    )
} finally {
    await rm(tempDir, { recursive: true, force: true })
}
