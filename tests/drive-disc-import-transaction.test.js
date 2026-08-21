import assert from "node:assert/strict"

import {
  applyDriveDiscImportSnapshot,
  applyPositionedOwnerItemsSnapshot,
  buildDriveDiscImportTransactionPlan,
  driveDiscImportBaseMatches,
  driveDiscImportSnapshotMatches,
  pendingDriveDiscImportJournal,
  positionedOwnerItemsSnapshot,
  reconcileSelectionDriveDiscReferences,
  reconcileStoreDriveDiscReferences,
} from "../core/drive-disc-import/transaction-plan.js"

const ownerId = "default"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function selection(agentConfig, otherOwnerConfig = null) {
  return {
    version: 2,
    currentOwnerId: ownerId,
    byOwner: {
      [ownerId]: { currentAgentId: "agent-a", byAgent: { "agent-a": clone(agentConfig) } },
      other: { currentAgentId: "agent-z", byAgent: { "agent-z": clone(otherOwnerConfig ?? agentConfig) } },
    },
  }
}

const referencedConfig = {
  manualDriveDiscIdsBySlot: { 1: "disc-old", 2: "disc-keep" },
  manualDriveDiscsBySlot: { 1: "disc-old", 3: "disc-delete", 4: "disc-keep" },
  driveDiscIdsBySlot: { 3: "disc-delete", 4: "disc-keep" },
  selectedLoadoutId: "loadout-old",
  loadoutId: "loadout-delete",
  combat: { activeBuffIds: ["keep"] },
}

{
  const document = selection(referencedConfig)
  const result = reconcileSelectionDriveDiscReferences(document, {
    ownerId,
    driveDiscIdRemap: { "disc-old": "disc-canonical" },
    deletedDriveDiscIds: ["disc-old", "disc-delete"],
    loadoutIdRemap: { "loadout-old": "loadout-canonical" },
    deletedLoadoutIds: ["loadout-delete"],
    removedLoadoutDiscReferences: [{
      loadoutId: "loadout-delete",
      agentId: "agent-a",
      driveDiscId: "disc-keep",
      slots: ["2"],
    }],
  })
  const config = result.document.byOwner[ownerId].byAgent["agent-a"]
  assert.deepEqual(config.manualDriveDiscIdsBySlot, { 1: "disc-canonical" })
  assert.deepEqual(config.manualDriveDiscsBySlot, { 1: "disc-canonical", 4: "disc-keep" })
  assert.deepEqual(config.driveDiscIdsBySlot, { 4: "disc-keep" })
  assert.equal(config.selectedLoadoutId, "loadout-canonical")
  assert.equal(config.loadoutId, "")
  assert.deepEqual(config.combat, referencedConfig.combat)
  assert.deepEqual(result.document.byOwner.other, document.byOwner.other)
  assert.deepEqual(result.affectedAgentIds, ["agent-a"])
}

{
  const store = {
    version: 1,
    currentOwnerId: ownerId,
    owners: [{ id: ownerId, label: "Default" }],
    imports: [],
    driveDiscs: [{ id: "disc-old", ownerId }],
    driveDiscLoadouts: [{ id: "loadout-old", ownerId, driveDiscIdsBySlot: { 1: "disc-old" } }],
    enkaImportState: {
      version: 1,
      byOwner: {
        [ownerId]: {
          undoJournal: {
            id: "enka-overlap",
            status: "committed",
            affectedDriveDiscIds: [],
            affectedLoadoutIds: ["loadout-old"],
            affectedAgentIds: ["agent-a"],
          },
        },
      },
    },
  }
  const beforeSelection = selection({ manualDriveDiscIdsBySlot: { 1: "disc-old" } })
  const nextStore = clone(store)
  nextStore.driveDiscs = [{ id: "disc-canonical", ownerId }]
  const plan = buildDriveDiscImportTransactionPlan({
    kind: "scanner",
    ownerId,
    transactionId: "tx-auto-invalidate",
    store,
    nextStore,
    buildSelection: beforeSelection,
    legacySelection: beforeSelection,
    driveDiscIdRemap: { "disc-old": "disc-canonical" },
    deletedDriveDiscIds: ["disc-old"],
    now: new Date("2026-08-18T00:00:00.000Z"),
  })
  assert.equal(plan.nextStore.enkaImportState.byOwner[ownerId].undoJournal.status, "invalidated")
  assert.deepEqual(plan.enkaUndoInvalidation.overlap.loadoutIds, ["loadout-old"])
  assert.deepEqual(plan.enkaUndoInvalidation.overlap.agentIds, ["agent-a"])
}

{
  const store = {
    version: 1,
    currentOwnerId: ownerId,
    owners: [{ id: ownerId, label: "Default" }],
    imports: [],
    driveDiscs: [],
    driveDiscLoadouts: [],
  }
  const beforeBuild = selection({ agentLevel: 40 })
  const beforeLegacy = selection({ agentLevel: 40 })
  beforeBuild.byOwner[ownerId].currentAgentId = null
  beforeLegacy.byOwner[ownerId].currentAgentId = null
  const afterBuild = clone(beforeBuild)
  const afterLegacy = clone(beforeLegacy)
  afterBuild.byOwner[ownerId].currentAgentId = "agent-a"
  afterLegacy.byOwner[ownerId].currentAgentId = "agent-a"
  const plan = buildDriveDiscImportTransactionPlan({
    kind: "enka",
    ownerId,
    transactionId: "tx-current-agent",
    store,
    nextStore: store,
    buildSelection: beforeBuild,
    legacySelection: beforeLegacy,
    nextBuildSelection: afterBuild,
    nextLegacySelection: afterLegacy,
    affectedAgentIds: ["agent-a"],
    now: new Date("2026-08-18T00:00:00.000Z"),
  })
  assert.equal(plan.journal.before.buildConfigs.currentAgentId, null)
  assert.equal(plan.journal.after.buildConfigs.currentAgentId, "agent-a")
  const restored = applyDriveDiscImportSnapshot({
    store: plan.preparedStore,
    buildSelection: plan.nextBuildSelection,
    legacySelection: plan.nextLegacySelection,
    journal: plan.journal,
  }, "before")
  assert.equal(restored.buildSelection.byOwner[ownerId].currentAgentId, null)
  assert.equal(restored.legacySelection.byOwner[ownerId].currentAgentId, null)
}

{
  const deletedOwnerId = "other"
  const store = {
    version: 1,
    currentOwnerId: ownerId,
    owners: [{ id: ownerId, label: "Default" }, { id: deletedOwnerId, label: "Other" }],
    imports: [{ id: "import-other", ownerId: deletedOwnerId }],
    driveDiscs: [{ id: "disc-other", ownerId: deletedOwnerId }],
    driveDiscLoadouts: [{ id: "loadout-other", ownerId: deletedOwnerId }],
    enkaImportState: { version: 1, byOwner: { [deletedOwnerId]: { binding: { uid: "10000001" } } } },
  }
  const buildSelection = selection({ agentLevel: 40 }, { agentLevel: 50 })
  const legacySelection = clone(buildSelection)
  const nextStore = {
    ...clone(store),
    owners: store.owners.filter(owner => owner.id !== deletedOwnerId),
    imports: [],
    driveDiscs: [],
    driveDiscLoadouts: [],
    enkaImportState: { version: 1, byOwner: {} },
  }
  const nextBuildSelection = clone(buildSelection)
  const nextLegacySelection = clone(legacySelection)
  delete nextBuildSelection.byOwner[deletedOwnerId]
  delete nextLegacySelection.byOwner[deletedOwnerId]
  const plan = buildDriveDiscImportTransactionPlan({
    kind: "account-delete",
    ownerId: deletedOwnerId,
    transactionId: "tx-account-delete",
    store,
    nextStore,
    buildSelection,
    legacySelection,
    nextBuildSelection,
    nextLegacySelection,
    now: new Date("2026-08-18T00:00:00.000Z"),
  })

  assert.equal(plan.journal.before.buildConfigs.ownerPresent, true)
  assert.equal(plan.journal.after.buildConfigs.ownerPresent, false)
  assert.equal(plan.nextBuildSelection.byOwner[deletedOwnerId], undefined)
  assert.equal(plan.nextStore.owners.some(owner => owner.id === deletedOwnerId), false)
  assert.equal(plan.nextStore.enkaImportState.byOwner[deletedOwnerId], undefined)

  const restored = applyDriveDiscImportSnapshot({
    store: plan.preparedStore,
    buildSelection: plan.nextBuildSelection,
    legacySelection: plan.nextLegacySelection,
    journal: plan.journal,
  }, "before")
  assert.deepEqual(restored.store.owners, store.owners)
  assert.deepEqual(restored.store.driveDiscs, store.driveDiscs)
  assert.deepEqual(restored.buildSelection.byOwner[deletedOwnerId], buildSelection.byOwner[deletedOwnerId])
  assert.deepEqual(restored.legacySelection.byOwner[deletedOwnerId], legacySelection.byOwner[deletedOwnerId])
}

{
  const store = {
    driveDiscLoadouts: [{
      id: "loadout-a",
      ownerId,
      driveDiscIdsBySlot: { 1: "disc-old", 2: "disc-delete", 3: "disc-keep" },
      idsBySlot: { 1: "disc-old", 2: "disc-delete", 3: "disc-keep" },
      missingDriveDiscIds: ["already-missing"],
      userNote: "keep",
    }],
  }
  const result = reconcileStoreDriveDiscReferences(store, {
    ownerId,
    driveDiscIdRemap: { "disc-old": "disc-canonical" },
    deletedDriveDiscIds: ["disc-delete"],
    now: "2026-08-18T00:00:00.000Z",
  })
  const loadout = result.store.driveDiscLoadouts[0]
  assert.deepEqual(loadout.driveDiscIdsBySlot, { 1: "disc-canonical", 3: "disc-keep" })
  assert.deepEqual(loadout.idsBySlot, { 1: "disc-canonical", 3: "disc-keep" })
  assert.deepEqual(loadout.missingSlots, [2, 4, 5, 6])
  assert.equal(loadout.status, "incomplete")
  assert.equal(loadout.userNote, "keep")
  assert.ok(loadout.missingDriveDiscIds.includes("disc-delete"))
}

{
  const items = [
    { id: "disc-a", ownerId },
    { id: "foreign", ownerId: "other" },
    { id: "disc-b", ownerId },
    { id: "disc-c", ownerId },
  ]
  const snapshot = positionedOwnerItemsSnapshot(items, ownerId, ["disc-a", "disc-c"])
  const restored = applyPositionedOwnerItemsSnapshot(
    [{ id: "foreign", ownerId: "other" }, { id: "disc-b", ownerId }],
    ownerId,
    snapshot,
  )
  assert.deepEqual(restored, items)
}

{
  const beforeStore = {
    version: 1,
    currentOwnerId: ownerId,
    owners: [{ id: ownerId, label: "Default" }],
    imports: [],
    driveDiscs: [
      { id: "disc-old", ownerId, level: 12 },
      { id: "foreign", ownerId: "other", level: 15 },
      { id: "disc-keep", ownerId, level: 15 },
    ],
    driveDiscLoadouts: [{
      id: "loadout-old",
      ownerId,
      driveDiscIdsBySlot: { 1: "disc-old", 2: "disc-keep" },
    }],
    enkaImportState: {
      version: 1,
      byOwner: {
        [ownerId]: {
          binding: { uid: "10000001" },
          undoJournal: { id: "enka-before", status: "committed" },
        },
      },
    },
  }
  const afterStore = {
    ...clone(beforeStore),
    driveDiscs: [
      { id: "disc-canonical", ownerId, level: 15 },
      { id: "foreign", ownerId: "other", level: 15 },
      { id: "disc-keep", ownerId, level: 15 },
    ],
    driveDiscLoadouts: [{
      id: "loadout-canonical",
      ownerId,
      driveDiscIdsBySlot: { 1: "disc-canonical", 2: "disc-keep" },
    }],
    enkaImportState: {
      version: 1,
      byOwner: {
        [ownerId]: {
          binding: { uid: "10000001" },
          undoJournal: { id: "enka-before", status: "invalidated", invalidatedBy: "scanner" },
        },
      },
    },
  }
  const beforeBuild = selection(referencedConfig)
  const beforeLegacy = selection(referencedConfig)
  const plan = buildDriveDiscImportTransactionPlan({
    kind: "scanner",
    ownerId,
    transactionId: "tx-transaction-plan",
    store: beforeStore,
    nextStore: afterStore,
    buildSelection: beforeBuild,
    legacySelection: beforeLegacy,
    driveDiscIdRemap: { "disc-old": "disc-canonical" },
    loadoutIdRemap: { "loadout-old": "loadout-canonical" },
    now: new Date("2026-08-18T00:00:00.000Z"),
  })

  assert.equal(pendingDriveDiscImportJournal(plan.preparedStore, ownerId)?.id, plan.transactionId)
  assert.equal(plan.nextBuildSelection.byOwner[ownerId].byAgent["agent-a"].manualDriveDiscIdsBySlot[1], "disc-canonical")
  assert.equal(plan.nextBuildSelection.byOwner[ownerId].byAgent["agent-a"].selectedLoadoutId, "loadout-canonical")
  assert.equal(plan.journal.before.inventory.enkaOwnerState.value.undoJournal.status, "committed")
  assert.equal(plan.journal.after.inventory.enkaOwnerState.value.undoJournal.status, "invalidated")
  assert.equal(driveDiscImportSnapshotMatches({
    store: plan.preparedStore,
    buildSelection: plan.nextBuildSelection,
    legacySelection: plan.nextLegacySelection,
    journal: plan.journal,
  }, "after"), true)

  const restored = applyDriveDiscImportSnapshot({
    store: plan.preparedStore,
    buildSelection: plan.nextBuildSelection,
    legacySelection: plan.nextLegacySelection,
    journal: plan.journal,
  }, "before")
  assert.deepEqual(restored.store.driveDiscs, beforeStore.driveDiscs)
  assert.deepEqual(restored.store.driveDiscLoadouts, beforeStore.driveDiscLoadouts)
  assert.deepEqual(restored.store.enkaImportState, beforeStore.enkaImportState)
  assert.deepEqual(restored.buildSelection, beforeBuild)
  assert.deepEqual(restored.legacySelection, beforeLegacy)

  assert.equal(driveDiscImportBaseMatches({
    store: beforeStore,
    buildSelection: beforeBuild,
    legacySelection: beforeLegacy,
    journal: plan.journal,
  }), true)
  const staleBuild = clone(beforeBuild)
  staleBuild.byOwner[ownerId].byAgent["agent-a"].combat.activeBuffIds.push("changed")
  assert.equal(driveDiscImportBaseMatches({
    store: beforeStore,
    buildSelection: staleBuild,
    legacySelection: beforeLegacy,
    journal: plan.journal,
  }), false)
}

console.log("drive disc import transaction tests passed")
