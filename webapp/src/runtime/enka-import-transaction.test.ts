import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyInventoryStore } from "@core/inventory-model.js"
import { buildEnkaImportPlan } from "@core/enka-import/import-plan.js"

const memory = vi.hoisted(() => ({
  store: null as any,
  buildSelection: null as any,
  legacySelection: null as any,
  failSelectionWriteOnce: false,
  storeSaveCall: 0,
  failStoreSaveAt: new Set<number>(),
}))

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

vi.mock("@runtime/local-store.js", () => ({
  loadUserDriveDiscStore: vi.fn(async () => clone(memory.store)),
  saveUserDriveDiscStore: vi.fn(async (store: any) => {
    memory.storeSaveCall += 1
    if (memory.failStoreSaveAt.has(memory.storeSaveCall)) throw new Error("inventory write failed")
    memory.store = clone(store)
    return clone(memory.store)
  }),
}))

vi.mock("@runtime/build-storage", () => ({
  readBuildSelectionDocument: vi.fn(() => clone(memory.buildSelection)),
  readLegacySelectionDocument: vi.fn(() => clone(memory.legacySelection)),
  writeEnkaSelectionDocuments: vi.fn((buildSelection: any, legacySelection: any) => {
    memory.buildSelection = clone(buildSelection)
    if (memory.failSelectionWriteOnce) {
      memory.failSelectionWriteOnce = false
      throw new Error("legacy write failed")
    }
    memory.legacySelection = clone(legacySelection)
  }),
}))

import {
  commitEnkaImportPlan,
  hasCommittedEnkaUndo,
  recoverPendingEnkaImport,
  undoLastEnkaImport,
} from "@runtime/enka-import-transaction"

const ownerId = "default"
const uid = "1302309616"
const initialConfig = {
  agentLevel: 40,
  combat: { activeBuffIds: ["keep"] },
  damage: { events: [{ id: "keep-event" }] },
}

function selection(config = initialConfig) {
  return {
    version: 2,
    currentOwnerId: ownerId,
    byOwner: { [ownerId]: { currentAgentId: "hoshimi_miyabi", byAgent: { hoshimi_miyabi: clone(config) } } },
  }
}

function createPlan(transactionId = "tx-test") {
  return buildEnkaImportPlan({
    uid,
    ownerId,
    store: clone(memory.store),
    buildSelection: clone(memory.buildSelection),
    legacySelection: clone(memory.legacySelection),
    mappedAgents: [{
      agentId: "hoshimi_miyabi",
      agentName: "星见雅",
      agentLevel: 60,
      cinemaLevel: 6,
      coreSkillLevel: "F",
      skillLevels: { basic: 16 },
      wEngine: null,
      driveDiscSourceCount: null,
      driveDiscPreset: null,
    }],
    transactionId,
    now: new Date("2026-08-18T00:00:00.000Z"),
  })
}

beforeEach(() => {
  memory.store = createEmptyInventoryStore()
  memory.buildSelection = selection()
  memory.legacySelection = selection()
  memory.failSelectionWriteOnce = false
  memory.storeSaveCall = 0
  memory.failStoreSaveAt.clear()
})

describe("Enka import transaction", () => {
  it("commits all documents and can undo the latest import", async () => {
    const plan = createPlan()
    await commitEnkaImportPlan(plan)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(60)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.combat.activeBuffIds).toEqual(["keep"])
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
    expect(await hasCommittedEnkaUndo(ownerId)).toBe(true)

    await undoLastEnkaImport(ownerId)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState.byOwner[ownerId].binding).toBeUndefined()
    expect(await hasCommittedEnkaUndo(ownerId)).toBe(false)
  })

  it("rolls back both selection documents after a partial localStorage failure", async () => {
    const plan = createPlan()
    memory.failSelectionWriteOnce = true
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("legacy write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.undoJournal).toBeNull()
  })

  it("rolls back configs when the committed journal write fails", async () => {
    const plan = createPlan()
    memory.failStoreSaveAt.add(2)
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("inventory write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.undoJournal).toBeNull()
  })

  it("rejects a stale preview before writing", async () => {
    const plan = createPlan()
    memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel = 41
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("请重新生成预览")
    expect(memory.store.enkaImportState).toBeUndefined()
  })

  it("rejects a preview after unrelated owner storage changes", async () => {
    const plan = createPlan()
    memory.store.owners[0].label = "changed after preview"
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("请重新生成预览")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState).toBeUndefined()
  })

  it("finalizes a prepared journal when all after-images were written", async () => {
    const plan = createPlan("tx-recover-commit")
    memory.store = clone(plan.nextStore)
    memory.buildSelection = clone(plan.nextBuildSelection)
    memory.legacySelection = clone(plan.nextLegacySelection)
    await expect(recoverPendingEnkaImport(ownerId)).resolves.toBe("committed")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
  })

  it("rolls back a prepared journal when only part of the config was written", async () => {
    const plan = createPlan("tx-recover-rollback")
    memory.store = clone(plan.nextStore)
    memory.buildSelection = clone(plan.nextBuildSelection)
    await expect(recoverPendingEnkaImport(ownerId)).resolves.toBe("rolled-back")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toBeNull()
  })

  it("blocks undo after an affected config changes", async () => {
    await commitEnkaImportPlan(createPlan())
    memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel = 59
    await expect(undoLastEnkaImport(ownerId)).rejects.toThrow("无法自动撤销")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(59)
  })

  it("restores imported configs when the undo inventory write fails", async () => {
    await commitEnkaImportPlan(createPlan())
    memory.failStoreSaveAt.add(memory.storeSaveCall + 1)
    await expect(undoLastEnkaImport(ownerId)).rejects.toThrow("inventory write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(60)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(60)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
  })
})
