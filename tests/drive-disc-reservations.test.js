import assert from "node:assert/strict"
import {
    buildScannerImportPlan,
    createDriveDiscExport,
    driveDiscReservationStateForLoadout,
    normalizeDriveDiscImport,
    normalizeInventoryStore,
    setDriveDiscReservations,
    upsertDriveDiscLoadout,
} from "../core/inventory-model.js"

function disc(id, ownerId, partition, reservedForAgentId = null) {
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
        reservedForAgentId,
        mainStat: { stat: partition === 1 ? "hpFlat" : "atkPct", value: partition === 1 ? 2200 : 30 },
        subStats: [],
    }
}

const oldStore = normalizeInventoryStore({
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    driveDiscs: [disc("old", "default", 1)],
    driveDiscLoadouts: [],
    imports: [],
})
assert.equal(oldStore.driveDiscs[0].reservedForAgentId, null)

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

const first = setDriveDiscReservations(baseStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
})
assert.equal(first.applied, true)
assert.deepEqual(first.changedIds, ["d1"])
assert.equal(first.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default").reservedForAgentId, "agent-a")
assert.equal(first.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "alt").reservedForAgentId, null)

const idempotent = setDriveDiscReservations(first.nextStore, {
    discIds: ["d1"],
    reservedForAgentId: "agent-a",
})
assert.equal(idempotent.applied, true)
assert.deepEqual(idempotent.changedIds, [])

const blockedTransfer = setDriveDiscReservations(first.nextStore, {
    discIds: ["d1", "d2"],
    reservedForAgentId: "agent-b",
})
assert.equal(blockedTransfer.applied, false)
assert.deepEqual(blockedTransfer.nextStore, first.nextStore)
assert.deepEqual(blockedTransfer.conflicts, [{
    discId: "d1",
    currentAgentId: "agent-a",
    requestedAgentId: "agent-b",
}])
assert.equal(blockedTransfer.nextStore.driveDiscs.find(item => item.id === "d2" && item.ownerId === "default").reservedForAgentId, null)

const transferred = setDriveDiscReservations(first.nextStore, {
    discIds: ["d1", "d2"],
    reservedForAgentId: "agent-b",
    allowTransfer: true,
})
assert.equal(transferred.applied, true)
assert.deepEqual(new Set(transferred.changedIds), new Set(["d1", "d2"]))

const released = setDriveDiscReservations(transferred.nextStore, {
    discIds: ["d1", "d2"],
    reservedForAgentId: null,
})
assert.equal(released.applied, true)
assert.ok(released.nextStore.driveDiscs
    .filter(item => item.ownerId === "default" && ["d1", "d2"].includes(item.id))
    .every(item => item.reservedForAgentId === null))

const loadout = {
    id: "loadout-a",
    agentId: "agent-a",
    name: "角色 A 整套",
    driveDiscIdsBySlot: Object.fromEntries([1, 2, 3, 4, 5, 6].map(slot => [String(slot), `d${slot}`])),
}
const savedAndReserved = upsertDriveDiscLoadout(baseStore, loadout, { reserveDiscs: true })
assert.equal(savedAndReserved.applied, true)
assert.equal(savedAndReserved.nextStore.driveDiscLoadouts.length, 1)
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

const conflictingStore = setDriveDiscReservations(baseStore, {
    discIds: ["d3"],
    reservedForAgentId: "agent-b",
}).nextStore
const blockedLoadout = upsertDriveDiscLoadout(conflictingStore, loadout, { reserveDiscs: true })
assert.equal(blockedLoadout.applied, false)
assert.equal(blockedLoadout.nextStore.driveDiscLoadouts.length, 0)
assert.equal(blockedLoadout.nextStore.driveDiscs.find(item => item.id === "d1" && item.ownerId === "default").reservedForAgentId, null)

const transferredLoadout = upsertDriveDiscLoadout(conflictingStore, loadout, {
    reserveDiscs: true,
    allowTransfer: true,
})
assert.equal(transferredLoadout.applied, true)
assert.ok(transferredLoadout.nextStore.driveDiscs
    .filter(item => item.ownerId === "default")
    .every(item => item.reservedForAgentId === "agent-a"))

assert.throws(() => upsertDriveDiscLoadout(baseStore, {
    ...loadout,
    id: "incomplete",
    driveDiscIdsBySlot: { 1: "d1" },
}, { reserveDiscs: true }), /incomplete/i)

const exported = createDriveDiscExport(savedAndReserved.nextStore, {
    ownerId: "default",
    exportedAt: "2026-07-20T00:00:00.000Z",
})
assert.equal(exported.driveDiscs.length, 6)
assert.ok(exported.driveDiscs.every(item => item.reservedForAgentId === "agent-a"))
assert.ok(exported.driveDiscs.every(item => !Object.hasOwn(item, "ownerId")))
const imported = normalizeDriveDiscImport(exported, {
    ownerId: "alt",
    importedAt: "2026-07-20T00:01:00.000Z",
})
assert.equal(imported.driveDiscs.length, 6)
assert.ok(imported.driveDiscs.every(item => item.ownerId === "alt"))
assert.ok(imported.driveDiscs.every(item => item.reservedForAgentId === "agent-a"))

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
const refreshedScan = buildScannerImportPlan(reservedScanStore, scannerPayload, {
    ownerId: "default",
    importedAt: "2026-07-20T00:03:00.000Z",
})
assert.equal(refreshedScan.nextStore.driveDiscs[0].reservedForAgentId, "agent-a")

console.log("Drive Disc reservation tests passed.")
