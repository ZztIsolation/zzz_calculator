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
  loadUserDriveDiscStoreFresh: vi.fn(async () => clone(memory.store)),
  saveUserDriveDiscStoreUnlocked: vi.fn(async (store: any) => {
    memory.storeSaveCall += 1
    if (memory.failStoreSaveAt.has(memory.storeSaveCall)) throw new Error("inventory write failed")
    memory.store = clone(store)
    return clone(memory.store)
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

  it("remaps legacy Enka disc and loadout references for every owner config and undoes them", async () => {
    memory.store.driveDiscs.push({
      id: "enka-equipment-1",
      ownerId,
      partition: 1,
      setName: "旧套装",
      source: { type: "enka-showcase", agentId: "hoshimi_miyabi" },
    })
    memory.store.driveDiscLoadouts.push({
      id: "enka-showcase-hoshimi_miyabi",
      ownerId,
      agentId: "hoshimi_miyabi",
      driveDiscIdsBySlot: { 1: "enka-equipment-1" },
      source: { type: "enka-showcase", agentId: "hoshimi_miyabi" },
    })
    memory.store.driveDiscLoadouts.push({
      id: "manual-loadout-referencing-enka",
      ownerId,
      agentId: "agent-other",
      driveDiscIdsBySlot: { 1: "enka-equipment-1" },
      source: { type: "manual" },
    })
    const referencingConfig = {
      manualDriveDiscIdsBySlot: { 1: "enka-equipment-1" },
      selectedLoadoutId: "enka-showcase-hoshimi_miyabi",
      combat: { activeBuffIds: ["other-keep"] },
    }
    memory.buildSelection.byOwner[ownerId].byAgent["agent-other"] = clone(referencingConfig)
    memory.legacySelection.byOwner[ownerId].byAgent["agent-other"] = clone(referencingConfig)

    const plan = createPlan("tx-legacy-reference-migration")
    expect(plan.drivePlan.migrations.driveDiscs).toHaveLength(1)
    expect(plan.drivePlan.migrations.loadouts).toHaveLength(1)
    await commitEnkaImportPlan(plan)

    const migratedConfig = memory.buildSelection.byOwner[ownerId].byAgent["agent-other"]
    expect(migratedConfig.manualDriveDiscIdsBySlot[1]).toBe(`enka-zzz:${uid}:equipment-1`)
    expect(migratedConfig.selectedLoadoutId).toBe(`enka-zzz:${uid}:hoshimi_miyabi`)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.affectedAgentIds).toContain("agent-other")
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.affectedLoadoutIds).toContain("manual-loadout-referencing-enka")
    expect(memory.store.driveDiscLoadouts.find((loadout: any) => loadout.id === "manual-loadout-referencing-enka").driveDiscIdsBySlot[1]).toBe(`enka-zzz:${uid}:equipment-1`)

    await undoLastEnkaImport(ownerId)
    expect(memory.buildSelection.byOwner[ownerId].byAgent["agent-other"]).toEqual(referencingConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent["agent-other"]).toEqual(referencingConfig)
    expect(memory.store.driveDiscs.some((disc: any) => disc.id === "enka-equipment-1")).toBe(true)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === "enka-showcase-hoshimi_miyabi")).toBe(true)
    expect(memory.store.driveDiscLoadouts.find((loadout: any) => loadout.id === "manual-loadout-referencing-enka").driveDiscIdsBySlot[1]).toBe("enka-equipment-1")
  })

  it("rolls back both selection documents after a partial localStorage failure", async () => {
    const plan = createPlan()
    memory.failSelectionWriteOnce = true
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("legacy write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.undoJournal).toBeUndefined()
  })

  it("rolls back configs when the committed journal write fails", async () => {
    const plan = createPlan()
    memory.failStoreSaveAt.add(2)
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("inventory write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.undoJournal).toBeUndefined()
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
