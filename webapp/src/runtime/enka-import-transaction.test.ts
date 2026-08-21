import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyInventoryStore } from "@core/inventory-model.js"
import { buildEnkaImportPlan, buildEnkaRebindPlan } from "@core/enka-import/import-plan.js"

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
  applyEnkaRebindPlan,
  commitEnkaImportPlan,
  ensureEnkaImportHistoryBackfill,
  hasCommittedEnkaUndo,
  recoverPendingEnkaImport,
  undoLastEnkaImport,
} from "@runtime/enka-import-transaction"

const ownerId = "default"
const uid = "1302309616"
const showcaseDiscId = `enka-zzz:${uid}:equipment-showcase-1`
const showcaseLoadoutId = `enka-zzz:${uid}:hoshimi_miyabi`
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
      sourceUid: uid,
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

function showcaseDisc() {
  return {
    id: showcaseDiscId,
    ownerId,
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    statUnitVersion: 2,
    locked: true,
    equippedBy: "hoshimi_miyabi",
    mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
    subStats: [],
    source: {
      type: "enka-zzz-showcase",
      uid,
      agentId: "hoshimi_miyabi",
      equipmentUid: "equipment-showcase-1",
      equipmentId: "31000",
    },
  }
}

function scannerCanonicalDisc() {
  const firstSeenAt = "2026-08-17T00:00:00.000Z"
  return {
    ...showcaseDisc(),
    id: "scanner-existing-canonical",
    locked: false,
    equippedBy: null,
    createdAt: firstSeenAt,
    updatedAt: firstSeenAt,
    source: {
      type: "zzz-scanner",
      importedAt: firstSeenAt,
      importId: "scanner-before-preview",
      sourcePath: "before-preview.json",
      sequence: 1,
      rawIndex: 0,
    },
    provenance: {
      version: 1,
      scanner: {
        firstSeenAt,
        lastSeenAt: firstSeenAt,
        lastImportId: "scanner-before-preview",
        lastSourcePath: "before-preview.json",
        lastSequence: 1,
        lastRawIndex: 0,
      },
    },
  }
}

function createShowcasePlan(transactionId = "tx-showcase-discs") {
  return buildEnkaImportPlan({
    uid,
    ownerId,
    store: clone(memory.store),
    buildSelection: clone(memory.buildSelection),
    legacySelection: clone(memory.legacySelection),
    mappedAgents: [{
      agentId: "hoshimi_miyabi",
      agentName: "星见雅",
      sourceUid: uid,
      agentLevel: 60,
      cinemaLevel: 6,
      coreSkillLevel: "F",
      skillLevels: { basic: 16 },
      wEngine: null,
      driveDiscSourceCount: 1,
      driveDiscPreset: { driveDiscs: [showcaseDisc()] },
    }],
    transactionId,
    now: new Date("2026-08-18T00:00:00.000Z"),
  })
}

const replacementUid = "1300027938"

function createRebindPlan(transactionId = "tx-rebind") {
  return buildEnkaRebindPlan({
    previousUid: uid,
    uid: replacementUid,
    ownerId,
    store: clone(memory.store),
    buildSelection: clone(memory.buildSelection),
    legacySelection: clone(memory.legacySelection),
    mappedAgents: [{
      agentId: "aria",
      agentName: "爱芮",
      sourceUid: replacementUid,
      agentLevel: 60,
      cinemaLevel: 1,
      coreSkillLevel: "F",
      skillLevels: { basic: 12 },
      wEngine: null,
      driveDiscSourceCount: 0,
      driveDiscPreset: null,
    }],
    transactionId,
    now: new Date("2026-08-19T00:00:00.000Z"),
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
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.hoshimi_miyabi).toMatchObject({
      agentName: "星见雅",
      completeness: "full",
      firstImportedAt: "2026-08-18T00:00:00.000Z",
      lastImportedAt: "2026-08-18T00:00:00.000Z",
    })
    expect(await hasCommittedEnkaUndo(ownerId)).toBe(true)

    await undoLastEnkaImport(ownerId)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState.byOwner[ownerId].binding).toBeUndefined()
    expect(memory.store.enkaImportState.byOwner[ownerId].history).toBeUndefined()
    expect(await hasCommittedEnkaUndo(ownerId)).toBe(false)
  })

  it("atomically replaces the bound UID and undoes the whole rebind", async () => {
    await commitEnkaImportPlan(createShowcasePlan("tx-rebind-old-import"))
    const oldBinding = clone(memory.store.enkaImportState.byOwner[ownerId].binding)
    const oldSession = clone(memory.store.enkaImportState.byOwner[ownerId].bindingSession)
    const oldHistory = clone(memory.store.enkaImportState.byOwner[ownerId].history)
    const oldBuildSelection = clone(memory.buildSelection)
    const oldLegacySelection = clone(memory.legacySelection)

    const plan = createRebindPlan("tx-runtime-rebind")
    expect(plan.kind).toBe("enka-rebind")
    expect(plan.hasBlockingErrors).toBe(false)
    await expect(applyEnkaRebindPlan(plan)).resolves.toMatchObject({
      transactionId: "tx-runtime-rebind",
      ownerId,
      kind: "enka-rebind",
    })

    expect(memory.store.enkaImportState.byOwner[ownerId].binding.uid).toBe(replacementUid)
    expect(memory.store.enkaImportState.byOwner[ownerId].bindingSession.uid).toBe(replacementUid)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toMatchObject({
      kind: "enka-rebind",
      previousUid: uid,
      uid: replacementUid,
      status: "committed",
    })
    expect(memory.store.driveDiscs.some((disc: any) => disc.id === showcaseDiscId)).toBe(false)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(false)
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.aria.agentName).toBe("爱芮")
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.hoshimi_miyabi).toBeUndefined()

    await undoLastEnkaImport(ownerId)
    expect(memory.store.enkaImportState.byOwner[ownerId].binding).toEqual(oldBinding)
    expect(memory.store.enkaImportState.byOwner[ownerId].bindingSession).toEqual(oldSession)
    expect(memory.store.enkaImportState.byOwner[ownerId].history).toEqual(oldHistory)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toBeNull()
    expect(memory.store.driveDiscs.some((disc: any) => disc.id === showcaseDiscId)).toBe(true)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(true)
    expect(memory.buildSelection).toEqual(oldBuildSelection)
    expect(memory.legacySelection).toEqual(oldLegacySelection)
  })

  it("rolls back the old binding when a rebind config write fails", async () => {
    await commitEnkaImportPlan(createShowcasePlan("tx-rebind-before-config-failure"))
    const beforeStore = clone(memory.store)
    const beforeBuildSelection = clone(memory.buildSelection)
    const beforeLegacySelection = clone(memory.legacySelection)
    const plan = createRebindPlan("tx-rebind-config-failure")

    memory.failSelectionWriteOnce = true
    await expect(applyEnkaRebindPlan(plan)).rejects.toThrow("legacy write failed")
    expect(memory.store).toEqual(beforeStore)
    expect(memory.buildSelection).toEqual(beforeBuildSelection)
    expect(memory.legacySelection).toEqual(beforeLegacySelection)
  })

  it("rolls back the old binding when the rebind commit marker write fails", async () => {
    await commitEnkaImportPlan(createShowcasePlan("tx-rebind-before-final-write-failure"))
    const beforeStore = clone(memory.store)
    const beforeBuildSelection = clone(memory.buildSelection)
    const beforeLegacySelection = clone(memory.legacySelection)
    const plan = createRebindPlan("tx-rebind-final-write-failure")

    memory.failStoreSaveAt.add(memory.storeSaveCall + 2)
    await expect(applyEnkaRebindPlan(plan)).rejects.toThrow("inventory write failed")
    expect(memory.store).toEqual(beforeStore)
    expect(memory.buildSelection).toEqual(beforeBuildSelection)
    expect(memory.legacySelection).toEqual(beforeLegacySelection)
  })

  it("recovers a prepared rebind by committing complete after-images or rolling back partial ones", async () => {
    await commitEnkaImportPlan(createShowcasePlan("tx-rebind-before-recovery"))
    const beforeStore = clone(memory.store)
    const beforeBuildSelection = clone(memory.buildSelection)
    const beforeLegacySelection = clone(memory.legacySelection)
    const completePlan = createRebindPlan("tx-rebind-recover-complete")

    memory.store = clone(completePlan.nextStore)
    memory.buildSelection = clone(completePlan.nextBuildSelection)
    memory.legacySelection = clone(completePlan.nextLegacySelection)
    await expect(recoverPendingEnkaImport(ownerId)).resolves.toBe("committed")
    expect(memory.store.enkaImportState.byOwner[ownerId].binding.uid).toBe(replacementUid)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")

    memory.store = beforeStore
    memory.buildSelection = beforeBuildSelection
    memory.legacySelection = beforeLegacySelection
    const partialPlan = createRebindPlan("tx-rebind-recover-partial")
    memory.store = clone(partialPlan.nextStore)
    memory.buildSelection = clone(partialPlan.nextBuildSelection)
    await expect(recoverPendingEnkaImport(ownerId)).resolves.toBe("rolled-back")
    expect(memory.store.enkaImportState.byOwner[ownerId].binding.uid).toBe(uid)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toBeNull()
    expect(memory.buildSelection).toEqual(beforeBuildSelection)
    expect(memory.legacySelection).toEqual(beforeLegacySelection)
  })

  it("writes the showcase loadout into both manual selections and restores them on undo", async () => {
    const previousConfig = {
      ...initialConfig,
      discMode: "manual",
      selectedLoadoutId: "manual-loadout-before-import",
      manualDriveDiscIdsBySlot: { 2: "manual-disc-before-import" },
    }
    memory.buildSelection = selection(previousConfig)
    memory.legacySelection = selection(previousConfig)
    memory.store.driveDiscs.push({
      id: "manual-disc-before-import",
      ownerId,
      setId: "swing_jazz",
      setName: "摇摆爵士",
      partition: 2,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "atkFlat", value: 316 },
      subStats: [],
      source: { type: "manual" },
    })

    const plan = createShowcasePlan()
    const plannedLoadout = plan.nextStore.driveDiscLoadouts.find((loadout: any) => loadout.id === showcaseLoadoutId)
    expect(plannedLoadout).toMatchObject({
      name: "展柜佩戴套装 - 星见雅",
      driveDiscIdsBySlot: { 1: showcaseDiscId },
    })
    for (const document of [plan.nextBuildSelection, plan.nextLegacySelection]) {
      expect(document.byOwner[ownerId].byAgent.hoshimi_miyabi).toMatchObject({
        discMode: "loadout",
        selectedLoadoutId: showcaseLoadoutId,
        manualDriveDiscIdsBySlot: { 1: showcaseDiscId },
      })
    }

    await commitEnkaImportPlan(plan)
    for (const document of [memory.buildSelection, memory.legacySelection]) {
      expect(document.byOwner[ownerId].byAgent.hoshimi_miyabi.manualDriveDiscIdsBySlot)
        .toEqual({ 1: showcaseDiscId })
    }
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")

    await undoLastEnkaImport(ownerId)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(previousConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(previousConfig)
    expect(memory.store.driveDiscs.map((disc: any) => disc.id)).toEqual(["manual-disc-before-import"])
    expect(memory.store.driveDiscLoadouts).toHaveLength(0)
  })

  it("moves a showcase disc between agents, cleans the old system references, and restores them on undo", async () => {
    const oldAgentConfig = {
      ...initialConfig,
      discMode: "loadout",
      selectedLoadoutId: showcaseLoadoutId,
      loadoutId: showcaseLoadoutId,
      manualDriveDiscIdsBySlot: { 1: showcaseDiscId },
      manualDriveDiscsBySlot: { 1: showcaseDiscId },
      driveDiscIdsBySlot: { 1: showcaseDiscId },
    }
    memory.buildSelection = selection(oldAgentConfig)
    memory.legacySelection = selection(oldAgentConfig)
    memory.buildSelection.byOwner[ownerId].byAgent.aria = { agentLevel: 40 }
    memory.legacySelection.byOwner[ownerId].byAgent.aria = { agentLevel: 40 }
    memory.store.driveDiscs = [showcaseDisc()]
    memory.store.driveDiscLoadouts = [{
      id: showcaseLoadoutId,
      ownerId,
      agentId: "hoshimi_miyabi",
      name: "展柜佩戴套装 - 星见雅",
      driveDiscIdsBySlot: { 1: showcaseDiscId },
      source: { type: "enka-zzz-showcase", uid, agentId: "hoshimi_miyabi" },
    }, {
      id: "custom-loadout-kept",
      ownerId,
      agentId: "hoshimi_miyabi",
      name: "用户自定义套装",
      driveDiscIdsBySlot: { 1: showcaseDiscId },
      source: { type: "manual" },
    }]
    const movedDisc = {
      ...showcaseDisc(),
      equippedBy: "aria",
      source: { ...showcaseDisc().source, agentId: "aria" },
    }
    const plan = buildEnkaImportPlan({
      uid,
      ownerId,
      store: clone(memory.store),
      buildSelection: clone(memory.buildSelection),
      legacySelection: clone(memory.legacySelection),
      mappedAgents: [{
        agentId: "aria",
        agentName: "爱芮",
        sourceUid: uid,
        driveDiscSourceCount: 1,
        driveDiscPreset: { driveDiscs: [movedDisc] },
      }],
      transactionId: "tx-move-showcase-disc",
      now: new Date("2026-08-18T00:10:00.000Z"),
    })

    expect(plan.drivePlan.deletedLoadoutIds).toEqual([showcaseLoadoutId])
    await commitEnkaImportPlan(plan)
    const movedOldConfig = memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi
    expect(movedOldConfig.manualDriveDiscIdsBySlot).toEqual({})
    expect(movedOldConfig.manualDriveDiscsBySlot).toEqual({})
    expect(movedOldConfig.driveDiscIdsBySlot).toEqual({})
    expect(movedOldConfig.selectedLoadoutId).toBe("")
    expect(movedOldConfig.loadoutId).toBe("")
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(false)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === "custom-loadout-kept")).toBe(true)
    expect(memory.store.driveDiscs.find((disc: any) => disc.id === showcaseDiscId).equippedBy).toBe("aria")

    await undoLastEnkaImport(ownerId)
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(oldAgentConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(oldAgentConfig)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(true)
    expect(memory.store.driveDiscLoadouts.some((loadout: any) => loadout.id === "custom-loadout-kept")).toBe(true)
    expect(memory.store.driveDiscs.find((disc: any) => disc.id === showcaseDiscId).equippedBy).toBe("hoshimi_miyabi")
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
      manualDriveDiscsBySlot: { 1: "enka-equipment-1" },
      driveDiscIdsBySlot: { 1: "enka-equipment-1" },
      selectedLoadoutId: "enka-showcase-hoshimi_miyabi",
      loadoutId: "enka-showcase-hoshimi_miyabi",
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
    expect(migratedConfig.manualDriveDiscsBySlot[1]).toBe(`enka-zzz:${uid}:equipment-1`)
    expect(migratedConfig.driveDiscIdsBySlot[1]).toBe(`enka-zzz:${uid}:equipment-1`)
    expect(migratedConfig.selectedLoadoutId).toBe(`enka-zzz:${uid}:hoshimi_miyabi`)
    expect(migratedConfig.loadoutId).toBe(`enka-zzz:${uid}:hoshimi_miyabi`)
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
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.history).toBeUndefined()
  })

  it("rolls back configs when the committed journal write fails", async () => {
    const plan = createPlan()
    memory.failStoreSaveAt.add(2)
    await expect(commitEnkaImportPlan(plan)).rejects.toThrow("inventory write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.undoJournal).toBeUndefined()
    expect(memory.store.enkaImportState?.byOwner?.[ownerId]?.history).toBeUndefined()
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
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.hoshimi_miyabi.agentName).toBe("星见雅")
  })

  it("rolls back a prepared journal when only part of the config was written", async () => {
    const plan = createPlan("tx-recover-rollback")
    memory.store = clone(plan.nextStore)
    memory.buildSelection = clone(plan.nextBuildSelection)
    await expect(recoverPendingEnkaImport(ownerId)).resolves.toBe("rolled-back")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi).toEqual(initialConfig)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toBeNull()
    expect(memory.store.enkaImportState.byOwner[ownerId].history).toBeUndefined()
  })

  it("blocks undo after an affected config changes", async () => {
    await commitEnkaImportPlan(createPlan())
    memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel = 59
    await expect(undoLastEnkaImport(ownerId)).rejects.toThrow("无法自动撤销")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(59)
  })

  it("preserves newer observation metadata across commit and undo", async () => {
    const canonicalId = "scanner-existing-canonical"
    memory.store.driveDiscs = [scannerCanonicalDisc()]
    const plan = createShowcasePlan("tx-observation-only")
    const afterPreviewAt = "2026-08-18T01:00:00.000Z"
    const afterPreviewDisc = memory.store.driveDiscs[0]
    afterPreviewDisc.updatedAt = afterPreviewAt
    afterPreviewDisc.source.importedAt = afterPreviewAt
    afterPreviewDisc.source.importId = "scanner-after-preview"
    afterPreviewDisc.source.sourcePath = "after-preview.json"
    afterPreviewDisc.source.sequence = 2
    afterPreviewDisc.source.rawIndex = 1
    afterPreviewDisc.source.batchId = "scanner-batch-after-preview"
    afterPreviewDisc.provenance.scanner.lastSeenAt = afterPreviewAt
    afterPreviewDisc.provenance.scanner.lastImportId = "scanner-after-preview"
    afterPreviewDisc.provenance.scanner.lastSourcePath = "after-preview.json"
    afterPreviewDisc.provenance.scanner.lastSequence = 2
    afterPreviewDisc.provenance.scanner.lastRawIndex = 1
    afterPreviewDisc.provenance.scanner.sourceAccountLabel = "profile-after-preview"

    await expect(commitEnkaImportPlan(plan)).resolves.toMatchObject({
      transactionId: "tx-observation-only",
    })
    const committedDisc = memory.store.driveDiscs.find((item: any) => item.id === canonicalId)
    expect(committedDisc.updatedAt).toBe(afterPreviewAt)
    expect(committedDisc.provenance.enkaZzz).toBeTruthy()
    expect(committedDisc.provenance.scanner).toMatchObject({
      lastSeenAt: afterPreviewAt,
      lastImportId: "scanner-after-preview",
      lastSourcePath: "after-preview.json",
      lastSequence: 2,
      lastRawIndex: 1,
      sourceAccountLabel: "profile-after-preview",
      lastBatchId: "scanner-batch-after-preview",
    })

    const afterCommitAt = "2026-08-18T02:00:00.000Z"
    committedDisc.updatedAt = afterCommitAt
    committedDisc.provenance.scanner.lastSeenAt = afterCommitAt
    committedDisc.provenance.scanner.lastImportId = "scanner-after-commit"
    committedDisc.provenance.scanner.lastSourcePath = "after-commit.json"
    committedDisc.provenance.scanner.lastSequence = 3
    committedDisc.provenance.scanner.lastRawIndex = 2
    committedDisc.provenance.scanner.sourceAccountLabel = "profile-after-commit"
    committedDisc.provenance.scanner.lastBatchId = "scanner-batch-after-commit"

    await expect(undoLastEnkaImport(ownerId)).resolves.toBeUndefined()
    const restoredDisc = memory.store.driveDiscs.find((item: any) => item.id === canonicalId)
    expect(restoredDisc.updatedAt).toBe(afterCommitAt)
    expect(restoredDisc.provenance.enkaZzz).toBeUndefined()
    expect(restoredDisc.provenance.scanner).toMatchObject({
      lastSeenAt: afterCommitAt,
      lastImportId: "scanner-after-commit",
      lastSourcePath: "after-commit.json",
      lastSequence: 3,
      lastRawIndex: 2,
      sourceAccountLabel: "profile-after-commit",
      lastBatchId: "scanner-batch-after-commit",
    })
    expect(restoredDisc.source).toMatchObject({
      type: "zzz-scanner",
      importId: "scanner-after-commit",
      sourcePath: "after-commit.json",
      sequence: 3,
      rawIndex: 2,
      batchId: "scanner-batch-after-commit",
    })
  })

  it("restores imported configs when the undo inventory write fails", async () => {
    await commitEnkaImportPlan(createPlan())
    memory.failStoreSaveAt.add(memory.storeSaveCall + 1)
    await expect(undoLastEnkaImport(ownerId)).rejects.toThrow("inventory write failed")
    expect(memory.buildSelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(60)
    expect(memory.legacySelection.byOwner[ownerId].byAgent.hoshimi_miyabi.agentLevel).toBe(60)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal.status).toBe("committed")
  })

  it("returns a no-op without writing or replacing the latest committed undo", async () => {
    await commitEnkaImportPlan(createPlan("tx-material-import"))
    const previousUndo = clone(memory.store.enkaImportState.byOwner[ownerId].undoJournal)
    const previousBinding = clone(memory.store.enkaImportState.byOwner[ownerId].binding)
    const previousSaveCalls = memory.storeSaveCall
    const plan = createPlan("tx-noop-import")

    expect(plan.isNoop).toBe(true)
    expect(plan.journal).toBeNull()
    await expect(commitEnkaImportPlan(plan)).resolves.toEqual({
      transactionId: null,
      ownerId,
      kind: "enka",
      isNoop: true,
    })
    expect(memory.storeSaveCall).toBe(previousSaveCalls)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toEqual(previousUndo)
    expect(memory.store.enkaImportState.byOwner[ownerId].binding).toEqual(previousBinding)
  })

  it("backfills only a canonical showcase loadout without changing binding or undo", async () => {
    const binding = {
      uid,
      boundAt: "2026-08-01T00:00:00.000Z",
      lastImportedAt: "2026-08-02T00:00:00.000Z",
    }
    const undoJournal = { id: "existing-undo", status: "committed" }
    memory.store.enkaImportState = {
      version: 1,
      byOwner: { [ownerId]: { binding, undoJournal } },
    }
    memory.store.driveDiscLoadouts = [{
      id: showcaseLoadoutId,
      ownerId,
      agentId: "hoshimi_miyabi",
      name: "展柜佩戴套装 - 星见雅",
      driveDiscIdsBySlot: { 1: showcaseDiscId },
      source: { type: "enka-zzz-showcase", uid, agentId: "hoshimi_miyabi" },
    }, {
      id: `enka-zzz:${uid}:aria`,
      ownerId,
      agentId: "aria",
      name: "手动套装",
      driveDiscIdsBySlot: { 1: "manual-disc" },
      source: { type: "manual" },
    }]

    const result = await ensureEnkaImportHistoryBackfill(ownerId, [
      { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
      { id: "aria", name: { zhCN: "爱芮" } },
    ])

    expect(result.backfilled).toBe(true)
    expect(result.history.byAgent.hoshimi_miyabi).toMatchObject({
      agentName: "星见雅",
      completeness: "partial",
      lastImportedAt: null,
      snapshot: { driveDiscCount: 1, driveDiscSourceCount: null },
    })
    expect(result.history.byAgent.aria).toBeUndefined()
    expect(memory.store.enkaImportState.byOwner[ownerId].binding).toEqual(binding)
    expect(memory.store.enkaImportState.byOwner[ownerId].undoJournal).toEqual(undoJournal)
    expect((await ensureEnkaImportHistoryBackfill(ownerId, [
      { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
    ])).backfilled).toBe(false)
  })

  it("keeps a backfilled partial record when undoing a later full character import", async () => {
    memory.store.enkaImportState = {
      version: 1,
      byOwner: {
        [ownerId]: {
          binding: {
            uid,
            boundAt: "2026-08-01T00:00:00.000Z",
            lastImportedAt: "2026-08-02T00:00:00.000Z",
          },
        },
      },
    }
    memory.store.driveDiscLoadouts = [{
      id: `enka-zzz:${uid}:aria`,
      ownerId,
      agentId: "aria",
      name: "展柜佩戴套装 - 爱芮",
      driveDiscIdsBySlot: { 1: "aria-disc" },
      source: { type: "enka-zzz-showcase", uid, agentId: "aria" },
    }]

    await commitEnkaImportPlan(createPlan("tx-full-with-legacy-history"))
    await ensureEnkaImportHistoryBackfill(ownerId, [
      { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
      { id: "aria", name: { zhCN: "爱芮" } },
    ])
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.aria.completeness).toBe("partial")

    await expect(undoLastEnkaImport(ownerId)).resolves.toBeUndefined()
    expect(memory.store.enkaImportState.byOwner[ownerId].binding.uid).toBe(uid)
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.aria.completeness).toBe("partial")
    expect(memory.store.enkaImportState.byOwner[ownerId].history.byAgent.hoshimi_miyabi).toBeUndefined()
  })

  it("rejects a structured blocking plan without writing", async () => {
    const plan = buildEnkaImportPlan({
      uid: "invalid",
      ownerId,
      store: clone(memory.store),
      buildSelection: clone(memory.buildSelection),
      legacySelection: clone(memory.legacySelection),
      mappedAgents: [],
      transactionId: "tx-blocked",
    })

    expect(plan.hasBlockingErrors).toBe(true)
    await expect(commitEnkaImportPlan(plan)).rejects.toMatchObject({ code: "INVALID_GAME_UID" })
    expect(memory.storeSaveCall).toBe(0)
    expect(memory.store.enkaImportState).toBeUndefined()
  })
})
