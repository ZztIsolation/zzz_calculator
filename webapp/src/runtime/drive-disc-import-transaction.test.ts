import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildDriveDiscImportTransactionPlan,
  pendingDriveDiscImportJournal,
} from "@core/drive-disc-import/transaction-plan.js"

const memory = vi.hoisted(() => ({
  store: null as any,
  buildSelection: null as any,
  legacySelection: null as any,
  failSelectionWriteOnce: false,
  storeSaveCall: 0,
  failStoreSaveAt: new Set<number>(),
  savedStores: [] as any[],
}))

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

vi.mock("@runtime/local-store.js", () => ({
  loadUserDriveDiscStore: vi.fn(async () => clone(memory.store)),
  loadUserDriveDiscStoreFresh: vi.fn(async () => clone(memory.store)),
  saveUserDriveDiscStoreUnlocked: vi.fn(async (store: any) => {
    memory.storeSaveCall += 1
    if (memory.failStoreSaveAt.has(memory.storeSaveCall)) throw new Error("inventory write failed")
    memory.store = clone(store)
    memory.savedStores.push(clone(store))
    return clone(store)
  }),
}))

vi.mock("@runtime/build-storage", () => ({
  readBuildSelectionDocument: vi.fn(() => clone(memory.buildSelection)),
  readLegacySelectionDocument: vi.fn(() => clone(memory.legacySelection)),
  writeSelectionDocuments: vi.fn((buildSelection: any, legacySelection: any) => {
    memory.buildSelection = clone(buildSelection)
    if (memory.failSelectionWriteOnce) {
      memory.failSelectionWriteOnce = false
      throw new Error("legacy write failed")
    }
    memory.legacySelection = clone(legacySelection)
  }),
}))

import {
  commitDriveDiscImportPlan,
  freezeDriveDiscInventoryImportPlan,
  recoverPendingDriveDiscImport,
} from "@runtime/drive-disc-import-transaction"

const ownerId = "default"

function baseStore() {
  return {
    version: 1,
    currentOwnerId: ownerId,
    owners: [{ id: ownerId, label: "Default" }],
    imports: [],
    driveDiscs: [{ id: "disc-old", ownerId, level: 12 }],
    driveDiscLoadouts: [{
      id: "loadout-old",
      ownerId,
      driveDiscIdsBySlot: { 1: "disc-old" },
    }],
    enkaImportState: {
      version: 1,
      byOwner: {
        [ownerId]: { undoJournal: { id: "enka-old", status: "committed" } },
      },
    },
  }
}

function selection() {
  return {
    version: 2,
    currentOwnerId: ownerId,
    byOwner: {
      [ownerId]: {
        currentAgentId: "agent-a",
        byAgent: {
          "agent-a": {
            manualDriveDiscIdsBySlot: { 1: "disc-old" },
            selectedLoadoutId: "loadout-old",
            combat: { activeBuffIds: ["keep"] },
          },
        },
      },
    },
  }
}

function createPlan(transactionId = "tx-runtime") {
  const nextStore = baseStore()
  nextStore.driveDiscs = [{ id: "disc-canonical", ownerId, level: 15 }]
  nextStore.driveDiscLoadouts = [{
    id: "loadout-canonical",
    ownerId,
    driveDiscIdsBySlot: { 1: "disc-canonical" },
  }]
  nextStore.enkaImportState.byOwner[ownerId].undoJournal = {
    id: "enka-old",
    status: "invalidated",
    invalidatedBy: "scanner",
  }
  return buildDriveDiscImportTransactionPlan({
    kind: "scanner",
    ownerId,
    transactionId,
    store: clone(memory.store),
    nextStore,
    buildSelection: clone(memory.buildSelection),
    legacySelection: clone(memory.legacySelection),
    driveDiscIdRemap: { "disc-old": "disc-canonical" },
    loadoutIdRemap: { "loadout-old": "loadout-canonical" },
    now: new Date("2026-08-18T00:00:00.000Z"),
  })
}

beforeEach(() => {
  memory.store = baseStore()
  memory.buildSelection = selection()
  memory.legacySelection = selection()
  memory.failSelectionWriteOnce = false
  memory.storeSaveCall = 0
  memory.failStoreSaveAt.clear()
  memory.savedStores = []
})

describe("drive disc import runtime transaction", () => {
  it("writes a prepared journal before configs and clears it only after both configs", async () => {
    const plan = createPlan()
    await commitDriveDiscImportPlan(plan)

    expect(memory.savedStores).toHaveLength(2)
    expect(pendingDriveDiscImportJournal(memory.savedStores[0], ownerId)?.id).toBe(plan.transactionId)
    expect(pendingDriveDiscImportJournal(memory.savedStores[1], ownerId)).toBeNull()
    expect(memory.buildSelection.byOwner[ownerId].byAgent["agent-a"].manualDriveDiscIdsBySlot[1]).toBe("disc-canonical")
    expect(memory.legacySelection.byOwner[ownerId].byAgent["agent-a"].selectedLoadoutId).toBe("loadout-canonical")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("invalidated")
  })

  it("rolls back inventory, both configs, and the invalidated Enka undo state", async () => {
    const plan = createPlan()
    memory.failSelectionWriteOnce = true
    await expect(commitDriveDiscImportPlan(plan)).rejects.toThrow("legacy write failed")

    expect(memory.store.driveDiscs[0].id).toBe("disc-old")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
    expect(pendingDriveDiscImportJournal(memory.store, ownerId)).toBeNull()
    expect(memory.buildSelection).toEqual(selection())
    expect(memory.legacySelection).toEqual(selection())
  })

  it("rolls back after the final inventory commit fails", async () => {
    const plan = createPlan()
    memory.failStoreSaveAt.add(2)
    await expect(commitDriveDiscImportPlan(plan)).rejects.toThrow("inventory write failed")

    expect(memory.store.driveDiscs[0].id).toBe("disc-old")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
    expect(memory.buildSelection).toEqual(selection())
    expect(memory.legacySelection).toEqual(selection())
  })

  it("finishes recovery when inventory and both configs already match the after-image", async () => {
    const plan = createPlan("tx-recover-commit")
    memory.store = clone(plan.preparedStore)
    memory.buildSelection = clone(plan.nextBuildSelection)
    memory.legacySelection = clone(plan.nextLegacySelection)

    await expect(recoverPendingDriveDiscImport(ownerId)).resolves.toBe("committed")
    expect(memory.store.driveDiscs[0].id).toBe("disc-canonical")
    expect(pendingDriveDiscImportJournal(memory.store, ownerId)).toBeNull()
  })

  it("rolls recovery back when only one config reached the after-image", async () => {
    const plan = createPlan("tx-recover-rollback")
    memory.store = clone(plan.preparedStore)
    memory.buildSelection = clone(plan.nextBuildSelection)

    await expect(recoverPendingDriveDiscImport(ownerId)).resolves.toBe("rolled-back")
    expect(memory.store.driveDiscs[0].id).toBe("disc-old")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
    expect(memory.buildSelection).toEqual(selection())
    expect(memory.legacySelection).toEqual(selection())
  })

  it("rejects a frozen plan after any of the three stores changes", async () => {
    const plan = createPlan()
    memory.legacySelection.byOwner[ownerId].byAgent["agent-a"].combat.activeBuffIds.push("changed")
    await expect(commitDriveDiscImportPlan(plan)).rejects.toThrow("请重新生成预览")
    expect(memory.savedStores).toHaveLength(0)
  })

  it("does not treat a scanner incoming ID alias as a stored ID migration", async () => {
    memory.store.driveDiscs = [{ id: "disc-canonical", ownerId, level: 15 }]
    memory.store.driveDiscLoadouts = []
    memory.buildSelection.byOwner[ownerId].byAgent["agent-a"].manualDriveDiscIdsBySlot = { 1: "scanner-incoming" }
    memory.legacySelection = clone(memory.buildSelection)
    const nextStore = clone(memory.store)
    nextStore.driveDiscs[0].provenance = { version: 1, scanner: { batchId: "batch" } }
    const frozen = await freezeDriveDiscInventoryImportPlan({
      currentStore: clone(memory.store),
      nextStore,
      ownerId,
      normalized: { importRecord: { id: "import-1", type: "scanner", sourcePath: "scan" } },
      reconciliation: {
        resolvedIds: { "scanner-incoming": "disc-canonical" },
        conflicts: [],
      },
      summary: {},
      preview: {},
      hasUnresolvedConflicts: false,
    }, { transactionId: "tx-no-false-remap" })

    expect(frozen.nextBuildSelection.byOwner[ownerId].byAgent["agent-a"].manualDriveDiscIdsBySlot[1]).toBe("scanner-incoming")
  })

  it("uses resolved IDs only when an existing canonical record is truly replaced", async () => {
    const nextStore = clone(memory.store)
    nextStore.driveDiscs = [{ id: "disc-canonical", ownerId, level: 15 }]
    nextStore.driveDiscLoadouts = []
    const frozen = await freezeDriveDiscInventoryImportPlan({
      currentStore: clone(memory.store),
      nextStore,
      ownerId,
      normalized: { importRecord: { id: "import-2", type: "scanner", sourcePath: "scan" } },
      reconciliation: {
        resolvedIds: { "disc-old": "disc-canonical" },
        conflicts: [],
      },
      driveDiscIdRemap: {},
      deletedDriveDiscIds: ["disc-old"],
      summary: {},
      preview: {},
      hasUnresolvedConflicts: false,
    }, { transactionId: "tx-actual-remap" })

    const config = frozen.nextBuildSelection.byOwner[ownerId].byAgent["agent-a"]
    expect(config.manualDriveDiscIdsBySlot[1]).toBe("disc-canonical")
    expect(config.selectedLoadoutId).toBe("")
  })
})
