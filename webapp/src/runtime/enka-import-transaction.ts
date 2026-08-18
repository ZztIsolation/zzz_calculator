import {
  applyEnkaImportSnapshot,
  committedEnkaImportJournal,
  enkaImportBaseMatches,
  enkaImportSnapshotMatches,
  markEnkaImportCommitted,
  normalizeEnkaImportState,
  pendingEnkaImportJournal,
} from "@core/enka-import/import-plan.js"
import {
  applyPositionedOwnerItemsSnapshot,
  buildDriveDiscImportTransactionPlan,
  positionedOwnerItemsSnapshot,
  reconcileSelectionDriveDiscReferences,
  reconcileStoreDriveDiscReferences,
  selectionConfigsSnapshot,
} from "@core/drive-disc-import/transaction-plan.js"
import {
  loadUserDriveDiscStore,
  loadUserDriveDiscStoreFresh,
  saveUserDriveDiscStoreUnlocked,
} from "@runtime/local-store.js"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
  writeSelectionDocuments,
} from "@runtime/build-storage"
import {
  commitDriveDiscImportPlan,
  recoverPendingDriveDiscImport,
  withDriveDiscImportOwnerLock,
} from "@runtime/drive-disc-import-transaction"

function plainSnapshot(value: any): any {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

async function currentState() {
  return {
    store: await loadUserDriveDiscStoreFresh(),
    buildSelection: readBuildSelectionDocument(),
    legacySelection: readLegacySelectionDocument(),
  }
}

async function persistSnapshot(snapshot: any) {
  const previousBuildSelection = readBuildSelectionDocument()
  const previousLegacySelection = readLegacySelectionDocument()
  try {
    writeSelectionDocuments(snapshot.buildSelection, snapshot.legacySelection)
    return await saveUserDriveDiscStoreUnlocked(snapshot.store)
  } catch (error) {
    try {
      writeSelectionDocuments(previousBuildSelection, previousLegacySelection)
    } catch (restoreError) {
      throw new Error(`保存快照失败，且配置恢复未完成：${error instanceof Error ? error.message : String(error)}；恢复错误：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`)
    }
    throw error
  }
}

function randomTransactionId(prefix: string): string {
  return String(globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`)
}

function migrationMap(items: any[] = []): Record<string, string> {
  return Object.fromEntries(items
    .map(item => [String(item?.beforeId ?? ""), String(item?.afterId ?? "")])
    .filter(([beforeId, afterId]) => beforeId && afterId && beforeId !== afterId))
}

function ownerItemsSnapshot(items: any[], ownerId: string, ids: string[]): any[] {
  const idSet = new Set(ids.map(String))
  return plainSnapshot((items ?? []).filter(item => (
    String(item?.ownerId ?? "default") === ownerId && idSet.has(String(item?.id ?? ""))
  )))
}

function withEnkaJournal(store: any, ownerId: string, journal: any): any {
  const state = normalizeEnkaImportState(store)
  return {
    ...plainSnapshot(store),
    enkaImportState: {
      ...state,
      byOwner: {
        ...state.byOwner,
        [ownerId]: {
          ...(state.byOwner[ownerId] ?? {}),
          undoJournal: plainSnapshot(journal),
        },
      },
    },
  }
}

function adaptedEnkaPlan(importPlan: any, before: any): any {
  const driveDiscIdRemap = migrationMap(importPlan.drivePlan?.migrations?.driveDiscs)
  const loadoutIdRemap = migrationMap(importPlan.drivePlan?.migrations?.loadouts)
  const referenceOptions = {
    ownerId: importPlan.ownerId,
    driveDiscIdRemap,
    loadoutIdRemap,
  }
  const buildResult = reconcileSelectionDriveDiscReferences(importPlan.nextBuildSelection, referenceOptions)
  const legacyResult = reconcileSelectionDriveDiscReferences(importPlan.nextLegacySelection, referenceOptions)
  const storeResult = reconcileStoreDriveDiscReferences(importPlan.nextStore, {
    ownerId: importPlan.ownerId,
    driveDiscIdRemap,
  })
  const affectedAgentIds = [...new Set([
    ...(importPlan.journal?.affectedAgentIds ?? []),
    ...buildResult.affectedAgentIds,
    ...legacyResult.affectedAgentIds,
  ].map(String))]
  const affectedLoadoutIds = [...new Set([
    ...(importPlan.journal?.affectedLoadoutIds ?? []),
    ...storeResult.affectedLoadoutIds,
  ].map(String))]
  const journal = {
    ...plainSnapshot(importPlan.journal),
    affectedAgentIds,
    affectedLoadoutIds,
    before: {
      ...plainSnapshot(importPlan.journal.before),
      inventory: {
        ...plainSnapshot(importPlan.journal.before.inventory),
        driveDiscLoadouts: ownerItemsSnapshot(
          before.store.driveDiscLoadouts,
          importPlan.ownerId,
          affectedLoadoutIds,
        ),
      },
      buildConfigs: selectionConfigsSnapshot(before.buildSelection, importPlan.ownerId, affectedAgentIds),
      legacyConfigs: selectionConfigsSnapshot(before.legacySelection, importPlan.ownerId, affectedAgentIds),
      positionedInventory: {
        driveDiscs: positionedOwnerItemsSnapshot(
          before.store.driveDiscs,
          importPlan.ownerId,
          importPlan.journal.affectedDriveDiscIds,
        ),
        driveDiscLoadouts: positionedOwnerItemsSnapshot(
          before.store.driveDiscLoadouts,
          importPlan.ownerId,
          affectedLoadoutIds,
        ),
      },
    },
    after: {
      ...plainSnapshot(importPlan.journal.after),
      inventory: {
        ...plainSnapshot(importPlan.journal.after.inventory),
        driveDiscLoadouts: ownerItemsSnapshot(
          storeResult.store.driveDiscLoadouts,
          importPlan.ownerId,
          affectedLoadoutIds,
        ),
      },
      buildConfigs: selectionConfigsSnapshot(buildResult.document, importPlan.ownerId, affectedAgentIds),
      legacyConfigs: selectionConfigsSnapshot(legacyResult.document, importPlan.ownerId, affectedAgentIds),
      positionedInventory: {
        driveDiscs: positionedOwnerItemsSnapshot(
          importPlan.nextStore.driveDiscs,
          importPlan.ownerId,
          importPlan.journal.affectedDriveDiscIds,
        ),
        driveDiscLoadouts: positionedOwnerItemsSnapshot(
          storeResult.store.driveDiscLoadouts,
          importPlan.ownerId,
          affectedLoadoutIds,
        ),
      },
    },
  }
  const committedStore = markEnkaImportCommitted(
    withEnkaJournal(storeResult.store, importPlan.ownerId, journal),
    importPlan.ownerId,
    importPlan.transactionId,
  )
  return buildDriveDiscImportTransactionPlan({
    kind: "enka",
    ownerId: importPlan.ownerId,
    transactionId: importPlan.transactionId,
    store: before.store,
    nextStore: committedStore,
    buildSelection: before.buildSelection,
    legacySelection: before.legacySelection,
    nextBuildSelection: buildResult.document,
    nextLegacySelection: legacyResult.document,
    driveDiscIdRemap,
    loadoutIdRemap,
    affectedAgentIds,
    metadata: { uid: importPlan.uid },
    hasUnresolvedConflicts: importPlan.hasUnresolvedConflicts,
  })
}

function enkaUndoTarget(current: any, journal: any): any {
  const target = applyEnkaImportSnapshot({ ...current, journal }, "before")
  const positioned = journal.before?.positionedInventory
  if (!positioned) return target
  return {
    ...target,
    store: {
      ...target.store,
      driveDiscs: applyPositionedOwnerItemsSnapshot(
        current.store.driveDiscs,
        journal.ownerId,
        positioned.driveDiscs,
      ),
      driveDiscLoadouts: applyPositionedOwnerItemsSnapshot(
        current.store.driveDiscLoadouts,
        journal.ownerId,
        positioned.driveDiscLoadouts,
      ),
    },
  }
}

export async function commitEnkaImportPlan(plan: any): Promise<any> {
  const importPlan = plainSnapshot(plan)
  if (importPlan.hasUnresolvedConflicts || importPlan.conflicts?.length) {
    throw new Error("仍有疑似同盘需要确认，请处理后重新生成预览。")
  }
  const before = await currentState()
  if (!enkaImportBaseMatches({ ...before, journal: importPlan.journal })
    || !enkaImportSnapshotMatches({ ...before, journal: importPlan.journal }, "before")) {
    throw new Error("预览后相关配置或库存已变化，请重新生成预览。")
  }
  return commitDriveDiscImportPlan(adaptedEnkaPlan(importPlan, before))
}

export async function recoverPendingEnkaImport(ownerId: string): Promise<"none" | "committed" | "rolled-back"> {
  const genericRecovery = await recoverPendingDriveDiscImport(ownerId)
  if (genericRecovery !== "none") return genericRecovery
  return withDriveDiscImportOwnerLock(ownerId, async () => {
    const current = await currentState()
    const journal = pendingEnkaImportJournal(current.store, ownerId)
    if (!journal) return "none"
    if (enkaImportSnapshotMatches({ ...current, journal }, "after")) {
      await saveUserDriveDiscStoreUnlocked(markEnkaImportCommitted(current.store, ownerId, journal.id))
      return "committed"
    }
    await persistSnapshot(applyEnkaImportSnapshot({ ...current, journal }, "before"))
    return "rolled-back"
  })
}

export async function undoLastEnkaImport(ownerId: string): Promise<void> {
  const current = await currentState()
  const journal = committedEnkaImportJournal(current.store, ownerId)
  if (!journal) throw new Error("当前账号没有可撤销的 Enka 导入。")
  if (!enkaImportSnapshotMatches({ ...current, journal }, "after")) {
    throw new Error("导入后的相关配置或库存已被修改，无法自动撤销以免覆盖新数据。")
  }
  const target = enkaUndoTarget(current, journal)
  await commitDriveDiscImportPlan(buildDriveDiscImportTransactionPlan({
    kind: "enka-undo",
    ownerId,
    transactionId: randomTransactionId("enka-undo"),
    store: current.store,
    nextStore: target.store,
    buildSelection: current.buildSelection,
    legacySelection: current.legacySelection,
    nextBuildSelection: target.buildSelection,
    nextLegacySelection: target.legacySelection,
    affectedAgentIds: journal.affectedAgentIds,
    metadata: { revertedEnkaTransactionId: journal.id, uid: journal.uid },
  }))
}

export async function hasCommittedEnkaUndo(ownerId: string): Promise<boolean> {
  return Boolean(committedEnkaImportJournal(await loadUserDriveDiscStore(), ownerId))
}
