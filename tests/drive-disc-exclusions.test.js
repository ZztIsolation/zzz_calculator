import assert from "node:assert/strict"
import {
    buildScannerImportPlan,
    createDriveDiscExport,
    driveDiscContentFingerprint,
    driveDiscIdentityFingerprint,
    driveDiscOptimizationInventoryFingerprint,
    driveDiscUsageStateForAgent,
    normalizeDriveDiscImport,
    normalizeExcludedForAgentIds,
    normalizeInventoryStore,
    setDriveDiscExclusions,
    setDriveDiscReservations,
    upsertDriveDisc,
} from "../core/inventory-model.js"

function disc(id, ownerId = "default", partition = 1, overrides = {}) {
    return {
        id,
        ownerId,
        setId: "woodpecker_electro",
        setName: "啄木鸟电音",
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: { stat: partition === 1 ? "hpFlat" : "atkPct", value: partition === 1 ? 2200 : 30 },
        subStats: [],
        ...overrides,
    }
}

assert.deepEqual(normalizeExcludedForAgentIds(null), [])
assert.deepEqual(normalizeExcludedForAgentIds("agent-a"), [])
assert.deepEqual(
    normalizeExcludedForAgentIds([" agent-a ", "", null, "agent-a", "retired-agent"], "agent-a"),
    ["retired-agent"],
)

const legacy = disc("legacy")
const normalizedLegacy = normalizeInventoryStore({
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscs: [legacy],
    driveDiscLoadouts: [],
})
assert.deepEqual(normalizedLegacy.driveDiscs[0].excludedForAgentIds, [])
assert.equal(driveDiscContentFingerprint(legacy), driveDiscContentFingerprint({ ...legacy, excludedForAgentIds: ["agent-a"] }))
assert.equal(driveDiscIdentityFingerprint(legacy), driveDiscIdentityFingerprint({ ...legacy, excludedForAgentIds: ["agent-a"] }))

const baseStore = normalizeInventoryStore({
    version: 1,
    currentOwnerId: "default",
    owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "二号账号" },
    ],
    imports: [],
    driveDiscs: [disc("d1"), disc("d2", "default", 2), disc("d1", "alt")],
    driveDiscLoadouts: [],
})

const excluded = setDriveDiscExclusions(baseStore, {
    discIds: ["d1"],
    excludedForAgentId: "agent-a",
    excluded: true,
})
assert.equal(excluded.applied, true)
assert.deepEqual(excluded.changedIds, ["d1"])
assert.deepEqual(excluded.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default").excludedForAgentIds, ["agent-a"])
assert.deepEqual(excluded.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "alt").excludedForAgentIds, [])
assert.equal(driveDiscUsageStateForAgent(excluded.nextStore.driveDiscs[0], "agent-a").state, "excluded-explicit")
assert.equal(driveDiscUsageStateForAgent(excluded.nextStore.driveDiscs[0], "agent-b").state, "available")

const idempotent = setDriveDiscExclusions(excluded.nextStore, {
    discIds: ["d1"],
    excludedForAgentId: "agent-a",
    excluded: true,
})
assert.equal(idempotent.applied, true)
assert.deepEqual(idempotent.changedIds, [])

const unknownAgent = setDriveDiscExclusions(excluded.nextStore, {
    discIds: ["d2"],
    excludedForAgentId: "retired-agent",
    excluded: true,
})
assert.deepEqual(unknownAgent.nextStore.driveDiscs.find(item => item.id === "d2").excludedForAgentIds, ["retired-agent"])

const blockedLock = setDriveDiscReservations(excluded.nextStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
})
assert.equal(blockedLock.applied, false)
assert.equal(blockedLock.conflicts[0].kind, "excluded-current")
assert.deepEqual(blockedLock.nextStore, excluded.nextStore)

const convertedToLock = setDriveDiscReservations(excluded.nextStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
    allowExclusionOverride: true,
})
const lockedDisc = convertedToLock.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default")
assert.equal(convertedToLock.applied, true)
assert.equal(lockedDisc.reservedForAgentId, "agent-a")
assert.deepEqual(lockedDisc.excludedForAgentIds, [])
assert.equal(driveDiscUsageStateForAgent(lockedDisc, "agent-a").state, "reserved-current")
assert.equal(driveDiscUsageStateForAgent(lockedDisc, "agent-b").state, "excluded-by-reservation")

const blockedConversion = setDriveDiscExclusions(convertedToLock.nextStore, {
    discIds: ["d1", "d2"],
    excludedForAgentId: "agent-a",
    excluded: true,
})
assert.equal(blockedConversion.applied, false)
assert.deepEqual(blockedConversion.nextStore, convertedToLock.nextStore)
assert.deepEqual(blockedConversion.nextStore.driveDiscs.find(item => item.id === "d2").excludedForAgentIds, [])

const convertedToExclusion = setDriveDiscExclusions(convertedToLock.nextStore, {
    discIds: ["d1"],
    excludedForAgentId: "agent-a",
    excluded: true,
    allowReservationRelease: true,
})
const convertedDisc = convertedToExclusion.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default")
assert.equal(convertedDisc.reservedForAgentId, null)
assert.deepEqual(convertedDisc.excludedForAgentIds, ["agent-a"])

const dormantExclusionStore = setDriveDiscReservations(
    setDriveDiscExclusions(baseStore, {
        discIds: ["d1"],
        excludedForAgentId: "agent-b",
        excluded: true,
    }).nextStore,
    { discIds: ["d1"], reservedForAgentId: "agent-a" },
).nextStore
const dormantDisc = dormantExclusionStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default")
assert.deepEqual(dormantDisc.excludedForAgentIds, ["agent-b"])
assert.equal(driveDiscUsageStateForAgent(dormantDisc, "agent-b").state, "excluded-by-reservation")
const restoredDisc = setDriveDiscReservations(dormantExclusionStore, {
    discIds: ["d1"],
    reservedForAgentId: null,
}).nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default")
assert.equal(driveDiscUsageStateForAgent(restoredDisc, "agent-b").state, "excluded-explicit")

assert.throws(() => setDriveDiscExclusions(baseStore, {
    ownerId: "alt",
    discIds: ["d2"],
    excludedForAgentId: "agent-a",
    excluded: true,
}), /missing ids/)

const omittedExclusions = { ...convertedDisc }
delete omittedExclusions.excludedForAgentIds
assert.deepEqual(upsertDriveDisc(convertedToExclusion.nextStore, omittedExclusions).driveDisc.excludedForAgentIds, ["agent-a"])

const exported = createDriveDiscExport(convertedToExclusion.nextStore, {
    ownerId: "default",
    exportedAt: "2026-07-26T00:00:00.000Z",
})
assert.equal(exported.version, 1)
assert.deepEqual(exported.driveDiscs.find(item => item.id === "d1").excludedForAgentIds, ["agent-a"])
const imported = normalizeDriveDiscImport(exported, { ownerId: "alt" })
assert.deepEqual(imported.driveDiscs.find(item => item.id === "d1").excludedForAgentIds, ["agent-a"])

const fingerprintBefore = driveDiscOptimizationInventoryFingerprint(baseStore, { ownerId: "default", agentId: "agent-a" })
const fingerprintAfter = driveDiscOptimizationInventoryFingerprint(excluded.nextStore, { ownerId: "default", agentId: "agent-a" })
assert.notEqual(fingerprintBefore, fingerprintAfter)

const scannerPayload = [{
    "序号": 1,
    "名称": "啄木鸟电音",
    "槽位": 1,
    "品质": "S",
    "等级": 15,
    "最大等级": 15,
    "主属性": { "生命值": 2200 },
    "副属性": [{ "暴击率": "4.8%" }],
}]
const firstScan = buildScannerImportPlan(normalizeInventoryStore(null), scannerPayload, {
    ownerId: "default",
    importedAt: "2026-07-26T00:01:00.000Z",
})
const scannedId = firstScan.nextStore.driveDiscs[0].id
const excludedScan = setDriveDiscExclusions(firstScan.nextStore, {
    discIds: [scannedId],
    excludedForAgentId: "agent-a",
    excluded: true,
}).nextStore
for (const removeMissing of [false, true]) {
    const refreshed = buildScannerImportPlan(excludedScan, scannerPayload, {
        ownerId: "default",
        importedAt: `2026-07-26T00:0${removeMissing ? 3 : 2}:00.000Z`,
        removeMissing,
    })
    assert.deepEqual(refreshed.nextStore.driveDiscs[0].excludedForAgentIds, ["agent-a"])
}

console.log("Drive Disc exclusion tests passed.")
