import assert from "node:assert/strict"
import {
    buildScannerImportPlan,
    DRIVE_DISC_EXPORT_FORMAT,
    DRIVE_DISC_EXPORT_VERSION,
    normalizeDriveDiscImport,
    upsertDriveDisc,
} from "../core/inventory-model.js"
import { evaluateFormulaExpression } from "../core/formulaEvaluator.js"
import { assertBrowserCompatibilitySources } from "../scripts/browser-compatibility-guard.js"

function nativeDisc(id, overrides = {}) {
    return {
        id,
        setId: overrides.setId ?? "woodpecker_electro",
        setName: overrides.setName ?? "Woodpecker Electro",
        partition: overrides.partition ?? 1,
        rarity: "S",
        level: overrides.level ?? 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: overrides.mainStat ?? { stat: "hpFlat", mode: "flat", value: 2200 },
        subStats: overrides.subStats ?? [],
        ...(overrides.reservedForAgentId !== undefined
            ? { reservedForAgentId: overrides.reservedForAgentId }
            : {}),
        ...(overrides.excludedForAgentIds !== undefined
            ? { excludedForAgentIds: overrides.excludedForAgentIds }
            : {}),
    }
}

function nativeExport(driveDiscs) {
    return {
        format: DRIVE_DISC_EXPORT_FORMAT,
        version: DRIVE_DISC_EXPORT_VERSION,
        exportedAt: "2026-08-03T00:00:00.000Z",
        sourceAccount: { label: "Compatibility fixture" },
        driveDiscs,
    }
}

function scannerDisc() {
    return {
        "\u5e8f\u53f7": 1,
        "\u540d\u79f0": "\u5544\u6728\u9e1f\u7535\u97f3",
        "\u69fd\u4f4d": 1,
        "\u54c1\u8d28": "S",
        "\u7b49\u7ea7": 15,
        "\u6700\u5927\u7b49\u7ea7": 15,
        "\u4e3b\u5c5e\u6027": { "\u751f\u547d\u503c": 2200 },
        "\u526f\u5c5e\u6027": [],
    }
}

assert.ok(assertBrowserCompatibilitySources() > 0, "source compatibility guard must inspect browser runtime files")

const originalHasOwnDescriptor = Object.getOwnPropertyDescriptor(Object, "hasOwn")

try {
    assert.equal(delete Object.hasOwn, true, "test setup must be able to remove Object.hasOwn")
    assert.equal(Object.hasOwn, undefined, "old-browser simulation must not expose Object.hasOwn")

    const payload = nativeExport([nativeDisc("native-new")])
    const normalized = normalizeDriveDiscImport(payload, { ownerId: "default" })
    assert.equal(normalized.importRecord.type, DRIVE_DISC_EXPORT_FORMAT)
    assert.equal(normalized.driveDiscs[0].id, "native-new")

    const inheritedFormatInput = Object.assign(Object.create({ format: DRIVE_DISC_EXPORT_FORMAT }), {
        items: [scannerDisc()],
    })
    const inheritedFormatImport = normalizeDriveDiscImport(inheritedFormatInput, { ownerId: "default" })
    assert.equal(inheritedFormatImport.importRecord.type, "zzz-scanner", "inherited format must not select the native importer")

    const nullPrototypePayload = Object.assign(Object.create(null), payload)
    const nullPrototypeImport = normalizeDriveDiscImport(nullPrototypePayload, { ownerId: "default" })
    assert.equal(nullPrototypeImport.importRecord.type, DRIVE_DISC_EXPORT_FORMAT)
    assert.equal(nullPrototypeImport.driveDiscs[0].id, "native-new")

    assert.throws(
        () => normalizeDriveDiscImport({ ...payload, format: "unknown-drive-disc-export" }),
        /Unsupported Drive Disc import format/,
    )
    assert.throws(
        () => normalizeDriveDiscImport({ ...payload, version: DRIVE_DISC_EXPORT_VERSION + 1 }),
        /Unsupported Drive Disc export version/,
    )

    const nullPrototypeVariables = Object.assign(Object.create(null), { base: 40 })
    assert.equal(evaluateFormulaExpression("base + 2", nullPrototypeVariables), 42)
    assert.throws(
        () => evaluateFormulaExpression("inherited + 1", Object.create({ inherited: 41 })),
        /Unknown variable: inherited/,
    )

    const restrictedDisc = nativeDisc("restricted", {
        reservedForAgentId: "agent-a",
        excludedForAgentIds: ["agent-b"],
    })
    const restrictionStore = {
        version: 1,
        currentOwnerId: "default",
        owners: [{ id: "default", label: "Default" }],
        imports: [],
        driveDiscs: [{ ...restrictedDisc, ownerId: "default" }],
        driveDiscLoadouts: [],
    }
    const omittedRestrictions = { ...restrictedDisc, level: 14 }
    delete omittedRestrictions.reservedForAgentId
    delete omittedRestrictions.excludedForAgentIds
    const preservedRestrictions = upsertDriveDisc(restrictionStore, omittedRestrictions)
    assert.equal(preservedRestrictions.driveDisc.reservedForAgentId, "agent-a")
    assert.deepEqual(preservedRestrictions.driveDisc.excludedForAgentIds, ["agent-b"])

    const clearedRestrictions = upsertDriveDisc(preservedRestrictions.nextStore, {
        ...preservedRestrictions.driveDisc,
        reservedForAgentId: null,
        excludedForAgentIds: [],
    })
    assert.equal(clearedRestrictions.driveDisc.reservedForAgentId, null)
    assert.deepEqual(clearedRestrictions.driveDisc.excludedForAgentIds, [])

    const defaultExisting = {
        ...nativeDisc("default-existing", { partition: 2, reservedForAgentId: "agent-a" }),
        ownerId: "default",
    }
    const altExisting = {
        ...nativeDisc("alt-existing", { partition: 3, excludedForAgentIds: ["agent-b"] }),
        ownerId: "alt",
    }
    const currentStore = {
        version: 1,
        currentOwnerId: "default",
        owners: [
            { id: "default", label: "Default" },
            { id: "alt", label: "Alt" },
        ],
        imports: [{ id: "existing-import", ownerId: "alt", itemCount: 1 }],
        driveDiscs: [defaultExisting, altExisting],
        driveDiscLoadouts: [{
            id: "alt-loadout",
            ownerId: "alt",
            agentId: "agent-b",
            driveDiscIdsBySlot: { 3: "alt-existing" },
        }],
        settingsSentinel: { preserve: true },
    }
    const currentSnapshot = structuredClone(currentStore)
    const importPlan = buildScannerImportPlan(currentStore, payload, {
        ownerId: "default",
        sourcePath: "compatibility.json",
        importedAt: "2026-08-03T00:01:00.000Z",
        removeMissing: false,
    })

    assert.equal(importPlan.summary.added, 1)
    assert.equal(importPlan.summary.removed, 0)
    assert.deepEqual(currentStore, currentSnapshot, "planning an import must not mutate the loaded store")
    assert.equal(importPlan.nextStore.version, currentStore.version)
    assert.equal(importPlan.nextStore.currentOwnerId, currentStore.currentOwnerId)
    assert.deepEqual(importPlan.nextStore.owners, currentStore.owners)
    assert.equal(importPlan.nextStore.imports.length, currentStore.imports.length + 1)
    assert.deepEqual(importPlan.nextStore.imports.slice(0, currentStore.imports.length), currentStore.imports)
    assert.equal(importPlan.nextStore.imports.at(-1).ownerId, "default")
    assert.equal(importPlan.nextStore.imports.at(-1).type, DRIVE_DISC_EXPORT_FORMAT)
    assert.deepEqual(importPlan.nextStore.driveDiscs.find(item => item.id === "default-existing"), defaultExisting)
    assert.deepEqual(importPlan.nextStore.driveDiscs.find(item => item.id === "alt-existing"), altExisting)
    assert.ok(importPlan.nextStore.driveDiscs.some(item => item.id === "native-new" && item.ownerId === "default"))
    assert.deepEqual(importPlan.nextStore.driveDiscLoadouts, currentStore.driveDiscLoadouts)
    assert.deepEqual(importPlan.nextStore.settingsSentinel, { preserve: true })
} finally {
    if (originalHasOwnDescriptor) {
        Object.defineProperty(Object, "hasOwn", originalHasOwnDescriptor)
    } else {
        delete Object.hasOwn
    }
}

assert.deepEqual(
    Object.getOwnPropertyDescriptor(Object, "hasOwn"),
    originalHasOwnDescriptor,
    "old-browser simulation must restore the complete Object.hasOwn descriptor",
)
console.log("browser compatibility tests passed")
