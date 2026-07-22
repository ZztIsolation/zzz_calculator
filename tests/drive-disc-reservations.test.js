import assert from "node:assert/strict"
import {
    buildScannerImportPlan,
    createDriveDiscExport,
    driveDiscContentFingerprint,
    driveDiscIdentityFingerprint,
    driveDiscReservationStateForLoadout,
    normalizeDriveDiscImport,
    normalizeInventoryStore,
    setDriveDiscReservations,
    upsertDriveDisc,
    upsertDriveDiscLoadout,
} from "../core/inventory-model.js"

function disc(id, ownerId, partition, reservedForAgentId) {
    const value = {
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
    }
    if (reservedForAgentId !== undefined) value.reservedForAgentId = reservedForAgentId
    return value
}

const legacyDisc = disc("legacy", "default", 1)
const normalizedLegacy = normalizeInventoryStore({
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    driveDiscs: [legacyDisc],
    driveDiscLoadouts: [],
    imports: [],
})
assert.equal(normalizedLegacy.driveDiscs[0].reservedForAgentId, null)
assert.equal(driveDiscContentFingerprint(legacyDisc), driveDiscContentFingerprint({ ...legacyDisc, reservedForAgentId: "agent-a" }))
assert.equal(driveDiscIdentityFingerprint(legacyDisc), driveDiscIdentityFingerprint({ ...legacyDisc, reservedForAgentId: "agent-a" }))

const baseStore = normalizeInventoryStore({
    version: 1,
    currentOwnerId: "default",
    owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "二号账号" },
    ],
    driveDiscs: [
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`d${slot}`, "default", slot)),
        disc("d1", "alt", 1),
    ],
    driveDiscLoadouts: [],
    imports: [],
})

const assigned = setDriveDiscReservations(baseStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
})
assert.equal(assigned.applied, true)
assert.deepEqual(assigned.changedIds, ["d1"])
assert.equal(assigned.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default").reservedForAgentId, "agent-a")
assert.equal(assigned.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "alt").reservedForAgentId, null)

const idempotent = setDriveDiscReservations(assigned.nextStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
})
assert.equal(idempotent.applied, true)
assert.deepEqual(idempotent.changedIds, [])

const blocked = setDriveDiscReservations(assigned.nextStore, {
    discIds: ["d1", "d2"],
    reservedForAgentId: "agent-b",
})
assert.equal(blocked.applied, false)
assert.deepEqual(blocked.nextStore, assigned.nextStore)
assert.deepEqual(blocked.conflicts, [{
    discId: "d1",
    currentAgentId: "agent-a",
    requestedAgentId: "agent-b",
}])
assert.equal(blocked.nextStore.driveDiscs.find(item => item.id === "d2" && item.ownerId === "default").reservedForAgentId, null)

const transferred = setDriveDiscReservations(assigned.nextStore, {
    discIds: ["d1", "d2"],
    reservedForAgentId: "agent-b",
    allowTransfer: true,
})
assert.equal(transferred.applied, true)
assert.deepEqual(new Set(transferred.changedIds), new Set(["d1", "d2"]))

const savedWithoutReservationField = upsertDriveDisc(transferred.nextStore, {
    ...transferred.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default"),
    reservedForAgentId: undefined,
})
assert.equal(savedWithoutReservationField.driveDisc.reservedForAgentId, null)
const omittedReservation = { ...transferred.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default") }
delete omittedReservation.reservedForAgentId
assert.equal(upsertDriveDisc(transferred.nextStore, omittedReservation).driveDisc.reservedForAgentId, "agent-b")

const loadout = {
    id: "loadout-a",
    agentId: "agent-a",
    name: "角色 A 套装",
    driveDiscIdsBySlot: Object.fromEntries([1, 2, 3, 4, 5, 6].map(slot => [String(slot), `d${slot}`])),
}
const savedAndReserved = upsertDriveDiscLoadout(baseStore, loadout, { reserveDiscs: true })
assert.equal(savedAndReserved.applied, true)
assert.ok(savedAndReserved.nextStore.driveDiscs
    .filter(item => item.ownerId === "default")
    .every(item => item.reservedForAgentId === "agent-a"))
assert.deepEqual(driveDiscReservationStateForLoadout(savedAndReserved.nextStore, savedAndReserved.loadout), {
    ownerId: "default",
    complete: true,
    presentCount: 6,
    reservedCount: 6,
    conflictingCount: 0,
    missingSlots: [],
    fullyReserved: true,
})

const exported = createDriveDiscExport(savedAndReserved.nextStore, {
    ownerId: "default",
    exportedAt: "2026-07-20T00:00:00.000Z",
})
assert.equal(exported.version, 1)
assert.ok(exported.driveDiscs.every(item => item.reservedForAgentId === "agent-a"))
assert.ok(exported.driveDiscs.every(item => !Object.hasOwn(item, "ownerId")))
const imported = normalizeDriveDiscImport(exported, {
    ownerId: "alt",
    importedAt: "2026-07-20T00:01:00.000Z",
})
assert.ok(imported.driveDiscs.every(item => item.ownerId === "alt" && item.reservedForAgentId === "agent-a"))

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
    importedAt: "2026-07-20T00:02:00.000Z",
})
const scannedId = firstScan.nextStore.driveDiscs[0].id
const reservedScanStore = setDriveDiscReservations(firstScan.nextStore, {
    discIds: [scannedId],
    reservedForAgentId: "agent-a",
}).nextStore
for (const removeMissing of [false, true]) {
    const refreshed = buildScannerImportPlan(reservedScanStore, scannerPayload, {
        ownerId: "default",
        importedAt: `2026-07-20T00:0${removeMissing ? 4 : 3}:00.000Z`,
        removeMissing,
    })
    assert.equal(refreshed.nextStore.driveDiscs[0].reservedForAgentId, "agent-a")
}

console.log("Drive Disc reservation tests passed.")
