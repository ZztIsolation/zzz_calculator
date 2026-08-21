import {
  applyEnkaImportSnapshot,
  backfillEnkaImportHistory,
  committedEnkaImportJournal,
  enkaImportBaseMatches,
  enkaImportHistoryForOwner,
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

function stringIds(items: any[] = []): string[] {
  return [...new Set(items.map(item => String(item ?? "").trim()).filter(Boolean))]
}

const SOURCE_OBSERVATION_FIELDS = [
  "matchedAt",
  "importedAt",
  "importId",
  "sourcePath",
  "sequence",
  "rawIndex",
  "batchId",
]

const PROVENANCE_OBSERVATION_FIELDS = [
  "lastSeenAt",
  "lastImportId",
  "lastSourcePath",
  "lastSequence",
  "lastRawIndex",
  "sourceAccountLabel",
  "lastBatchId",
]

function timestamp(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Date.parse(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : null
}

function isCurrentObservationNotOlder(currentValue: any, targetValue: any): boolean {
  const currentTime = timestamp(currentValue)
  const targetTime = timestamp(targetValue)
  if (currentTime != null && targetTime != null) return currentTime >= targetTime
  if (currentTime != null) return true
  if (targetTime != null) return false
  return true
}

function sourceKind(source: any): string {
  const type = String(source?.type ?? "").trim()
  if (type.startsWith("enka")) return "enkaZzz"
  if (type === "zzz-scanner" || type === "scanner") return "scanner"
  if (type === "calculator-json" || type === "calculatorJson") return "calculatorJson"
  return type
}

function copyObservationFields(target: any, current: any, fields: string[]): any {
  const result = plainSnapshot(target ?? {}) ?? {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(current ?? {}, field)) {
      result[field] = plainSnapshot(current[field])
    }
  }
  return result
}

function mergeCurrentItemObservations(targetItem: any, currentItem: any): any {
  const target = plainSnapshot(targetItem)
  if (!target || !currentItem) return target

  const currentUpdatedAt = currentItem.updatedAt
  const targetUpdatedAt = target.updatedAt
  if (Object.prototype.hasOwnProperty.call(currentItem, "updatedAt")
    && isCurrentObservationNotOlder(currentUpdatedAt, targetUpdatedAt)) {
    target.updatedAt = plainSnapshot(currentUpdatedAt)
  }

  const targetSourceKind = sourceKind(target.source)
  const currentSourceKind = sourceKind(currentItem.source)
  if (targetSourceKind && targetSourceKind === currentSourceKind) {
    const currentSourceTime = currentItem.source?.matchedAt
      ?? currentItem.source?.importedAt
      ?? currentUpdatedAt
    const targetSourceTime = target.source?.matchedAt
      ?? target.source?.importedAt
      ?? targetUpdatedAt
    if (isCurrentObservationNotOlder(currentSourceTime, targetSourceTime)) {
      target.source = copyObservationFields(
        target.source,
        currentItem.source,
        SOURCE_OBSERVATION_FIELDS,
      )
    }
  }

  if (target.provenance && typeof target.provenance === "object") {
    for (const provenanceKind of Object.keys(target.provenance)) {
      if (provenanceKind === "version") continue
      const targetSource = target.provenance[provenanceKind]
      const currentSource = currentItem.provenance?.[provenanceKind]
      if (!targetSource || typeof targetSource !== "object"
        || !currentSource || typeof currentSource !== "object") continue
      const currentSourceTime = currentSource.lastSeenAt ?? currentUpdatedAt
      const targetSourceTime = targetSource.lastSeenAt ?? targetUpdatedAt
      if (!isCurrentObservationNotOlder(currentSourceTime, targetSourceTime)) continue
      target.provenance[provenanceKind] = copyObservationFields(
        targetSource,
        currentSource,
        PROVENANCE_OBSERVATION_FIELDS,
      )
    }
  }

  const projectedCurrentSource = target.provenance?.[currentSourceKind]
  if (projectedCurrentSource && typeof projectedCurrentSource === "object") {
    const currentSourceTime = currentItem.source?.matchedAt
      ?? currentItem.source?.importedAt
      ?? currentUpdatedAt
    const targetSourceTime = projectedCurrentSource.lastSeenAt ?? targetUpdatedAt
    if (isCurrentObservationNotOlder(currentSourceTime, targetSourceTime)) {
      const sourceProjectionFields: Record<string, string> = {
        importId: "lastImportId",
        sourcePath: "lastSourcePath",
        sequence: "lastSequence",
        rawIndex: "lastRawIndex",
        batchId: "lastBatchId",
      }
      if (currentSourceTime != null) projectedCurrentSource.lastSeenAt = plainSnapshot(currentSourceTime)
      for (const [sourceField, provenanceField] of Object.entries(sourceProjectionFields)) {
        if (Object.prototype.hasOwnProperty.call(currentItem.source ?? {}, sourceField)) {
          projectedCurrentSource[provenanceField] = plainSnapshot(currentItem.source[sourceField])
        }
      }
    }
  }

  const projectedProvenance = target.provenance?.[targetSourceKind]
  if (projectedProvenance && typeof projectedProvenance === "object") {
    const projectionFields: Record<string, string> = {
      lastImportId: "importId",
      lastSourcePath: "sourcePath",
      lastSequence: "sequence",
      lastRawIndex: "rawIndex",
      lastBatchId: "batchId",
    }
    target.source = plainSnapshot(target.source ?? {}) ?? {}
    for (const [provenanceField, sourceField] of Object.entries(projectionFields)) {
      if (Object.prototype.hasOwnProperty.call(projectedProvenance, provenanceField)) {
        target.source[sourceField] = plainSnapshot(projectedProvenance[provenanceField])
      }
    }
  }
  return target
}

function inventoryItemKey(item: any): string | null {
  const id = String(item?.id ?? "").trim()
  if (!id) return null
  return JSON.stringify([String(item?.ownerId ?? "default"), id])
}

function mergeCurrentInventoryObservations(targetItems: any[] = [], currentItems: any[] = []): any[] {
  const currentByKey = new Map(currentItems.map(item => [inventoryItemKey(item), item]))
  currentByKey.delete(null)
  return targetItems.map(item => mergeCurrentItemObservations(
    item,
    currentByKey.get(inventoryItemKey(item)),
  ))
}

function preserveCurrentStoreObservations(targetStore: any, currentStore: any): any {
  const target = plainSnapshot(targetStore) ?? {}
  if (Object.prototype.hasOwnProperty.call(currentStore ?? {}, "updatedAt")
    && isCurrentObservationNotOlder(currentStore.updatedAt, target.updatedAt)) {
    target.updatedAt = plainSnapshot(currentStore.updatedAt)
  }
  target.driveDiscs = mergeCurrentInventoryObservations(
    target.driveDiscs,
    currentStore?.driveDiscs,
  )
  target.driveDiscLoadouts = mergeCurrentInventoryObservations(
    target.driveDiscLoadouts,
    currentStore?.driveDiscLoadouts,
  )
  return target
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
  const removedLoadoutDiscReferences = importPlan.drivePlan?.removedLoadoutDiscReferences ?? []
  const deletedDriveDiscIds = stringIds(importPlan.drivePlan?.deletedDriveDiscIds)
  const deletedLoadoutIds = stringIds(importPlan.drivePlan?.deletedLoadoutIds)
  const referenceOptions = {
    ownerId: importPlan.ownerId,
    driveDiscIdRemap,
    deletedDriveDiscIds,
    loadoutIdRemap,
    deletedLoadoutIds,
    removedLoadoutDiscReferences,
  }
  const buildResult = reconcileSelectionDriveDiscReferences(importPlan.nextBuildSelection, referenceOptions)
  const legacyResult = reconcileSelectionDriveDiscReferences(importPlan.nextLegacySelection, referenceOptions)
  const observationSafeStore = preserveCurrentStoreObservations(importPlan.nextStore, before.store)
  const storeResult = reconcileStoreDriveDiscReferences(observationSafeStore, {
    ownerId: importPlan.ownerId,
    driveDiscIdRemap,
    deletedDriveDiscIds,
  })
  const affectedAgentIds = [...new Set([
    ...(importPlan.journal?.affectedAgentIds ?? []),
    ...removedLoadoutDiscReferences.map((reference: any) => reference?.agentId),
    ...buildResult.affectedAgentIds,
    ...legacyResult.affectedAgentIds,
  ].filter(Boolean).map(String))]
  const affectedLoadoutIds = [...new Set([
    ...(importPlan.journal?.affectedLoadoutIds ?? []),
    ...(importPlan.drivePlan?.affectedLoadoutIds ?? []),
    ...deletedLoadoutIds,
    ...removedLoadoutDiscReferences.map((reference: any) => reference?.loadoutId),
    ...storeResult.affectedLoadoutIds,
  ].filter(Boolean).map(String))]
  const affectedDriveDiscIds = [...new Set([
    ...(importPlan.journal?.affectedDriveDiscIds ?? []),
    ...Object.keys(driveDiscIdRemap),
    ...Object.values(driveDiscIdRemap),
    ...deletedDriveDiscIds,
    ...removedLoadoutDiscReferences.map((reference: any) => reference?.driveDiscId),
  ].filter(Boolean).map(String))]
  const journal = {
    ...plainSnapshot(importPlan.journal),
    affectedAgentIds,
    affectedDriveDiscIds,
    affectedLoadoutIds,
    before: {
      ...plainSnapshot(importPlan.journal.before),
      inventory: {
        ...plainSnapshot(importPlan.journal.before.inventory),
        driveDiscs: ownerItemsSnapshot(
          before.store.driveDiscs,
          importPlan.ownerId,
          affectedDriveDiscIds,
        ),
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
          affectedDriveDiscIds,
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
        driveDiscs: ownerItemsSnapshot(
          storeResult.store.driveDiscs,
          importPlan.ownerId,
          affectedDriveDiscIds,
        ),
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
          storeResult.store.driveDiscs,
          importPlan.ownerId,
          affectedDriveDiscIds,
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
    kind: importPlan.kind ?? "enka",
    ownerId: importPlan.ownerId,
    transactionId: importPlan.transactionId,
    store: before.store,
    nextStore: committedStore,
    buildSelection: before.buildSelection,
    legacySelection: before.legacySelection,
    nextBuildSelection: buildResult.document,
    nextLegacySelection: legacyResult.document,
    driveDiscIdRemap,
    deletedDriveDiscIds,
    loadoutIdRemap,
    deletedLoadoutIds,
    affectedAgentIds,
    metadata: {
      uid: importPlan.uid,
      previousUid: importPlan.previousUid ?? null,
      rebind: plainSnapshot(importPlan.rebind ?? null),
    },
    hasUnresolvedConflicts: importPlan.hasUnresolvedConflicts,
  })
}

function enkaUndoTarget(current: any, journal: any): any {
  const target = applyEnkaImportSnapshot({ ...current, journal }, "before")
  const positioned = journal.before?.positionedInventory
  const positionedTarget = !positioned ? target : {
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
  return {
    ...positionedTarget,
    store: preserveCurrentStoreObservations(positionedTarget.store, current.store),
  }
}

export async function commitEnkaImportPlan(plan: any): Promise<any> {
  const importPlan = plainSnapshot(plan)
  if (importPlan.blockingErrors?.length || importPlan.hasBlockingErrors) {
    const first = importPlan.blockingErrors?.[0]
    const error: any = new Error(first?.message || "展柜数据身份异常，已阻止导入。")
    error.code = first?.code ?? "ENKA_IMPORT_BLOCKED"
    error.blockingErrors = plainSnapshot(importPlan.blockingErrors ?? [])
    throw error
  }
  if (importPlan.hasUnresolvedConflicts || importPlan.conflicts?.length) {
    throw new Error("仍有疑似同盘需要确认，请处理后重新生成预览。")
  }
  if (importPlan.isNoop) {
    const before = await currentState()
    if (!enkaImportBaseMatches({ ...before, journal: { baseFingerprint: importPlan.baseFingerprint } })) {
      throw new Error("预览后相关配置或库存已变化，请重新生成预览。")
    }
    return {
      transactionId: null,
      ownerId: importPlan.ownerId,
      kind: importPlan.kind ?? "enka",
      isNoop: true,
    }
  }
  if (!importPlan.journal) throw new Error("展柜导入计划不完整，请重新生成预览。")
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
    const target = applyEnkaImportSnapshot({ ...current, journal }, "before")
    await persistSnapshot({
      ...target,
      store: preserveCurrentStoreObservations(target.store, current.store),
    })
    return "rolled-back"
  })
}

export async function applyEnkaRebindPlan(plan: any): Promise<any> {
  if (plan?.kind !== "enka-rebind") throw new Error("展柜 UID 换绑计划无效。")
  return commitEnkaImportPlan(plan)
}

export async function undoLastEnkaImport(ownerId: string): Promise<void> {
  const current = await currentState()
  const journal = committedEnkaImportJournal(current.store, ownerId)
  if (!journal) throw new Error("当前账号没有可撤销的展柜数据导入。")
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

export async function ensureEnkaImportHistoryBackfill(ownerId: string, knownAgents: any[]): Promise<any> {
  return withDriveDiscImportOwnerLock(ownerId, async () => {
    const store = await loadUserDriveDiscStoreFresh()
    const result = backfillEnkaImportHistory({
      store,
      ownerId,
      knownAgents,
      now: new Date(),
    })
    const savedStore = result.changed
      ? await saveUserDriveDiscStoreUnlocked(result.store)
      : store
    return {
      ownerId,
      binding: normalizeEnkaImportState(savedStore).byOwner?.[ownerId]?.binding ?? null,
      history: enkaImportHistoryForOwner(savedStore, ownerId),
      backfilled: result.changed,
    }
  })
}
