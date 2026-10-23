import {
  applyDriveDiscImportSnapshot,
  buildDriveDiscImportTransactionPlan,
  clearPendingDriveDiscImportJournal,
  driveDiscImportBaseMatches,
  driveDiscImportSnapshotMatches,
  pendingDriveDiscImportJournal,
  pendingDriveDiscImportOwners,
} from "@core/drive-disc-import/transaction-plan.js"
import {
  loadUserDriveDiscStore,
  loadUserDriveDiscStoreFresh,
  saveUserDriveDiscStoreUnlocked,
} from "@runtime/local-store.js"
import {
  withDriveDiscImportOwnerLock,
  type DriveDiscImportLockOptions,
} from "@runtime/drive-disc-import-lock"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
  writeSelectionDocuments,
} from "@runtime/build-storage"

function plainSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function asEntries(value: any): Array<[string, string]> {
  if (value instanceof Map) {
    return [...value.entries()].map(([from, to]) => [String(from), String(to)])
  }
  return Object.entries(value ?? {}).map(([from, to]) => [String(from), String(to)])
}

function ownerItemIds(items: any[], ownerId: string): Set<string> {
  return new Set((items ?? [])
    .filter(item => String(item?.ownerId ?? "default") === ownerId)
    .map(item => String(item?.id ?? ""))
    .filter(Boolean))
}

function actualDriveDiscReferenceChanges(inventoryPlan: any, ownerId: string, options: any) {
  const currentIds = ownerItemIds(inventoryPlan.currentStore?.driveDiscs, ownerId)
  const nextIds = ownerItemIds(inventoryPlan.nextStore?.driveDiscs, ownerId)
  const resolvedEntries = asEntries(inventoryPlan.reconciliation?.resolvedIds)
  const inferredRemap = Object.fromEntries(resolvedEntries.filter(([from, to]) => (
    from !== to && currentIds.has(from) && !nextIds.has(from) && nextIds.has(to)
  )))
  const explicitRemap = options.driveDiscIdRemap
    ?? inventoryPlan.driveDiscIdRemap
    ?? inventoryPlan.remappedIds
  const driveDiscIdRemap = {
    ...inferredRemap,
    ...Object.fromEntries(asEntries(explicitRemap)),
  }
  const remappedFromIds = new Set(Object.keys(driveDiscIdRemap))
  const inferredDeletedIds = [...currentIds]
    .filter(id => !nextIds.has(id) && !remappedFromIds.has(id))
  const deletedDriveDiscIds = options.deletedDriveDiscIds
    ?? inventoryPlan.deletedDriveDiscIds
    ?? inventoryPlan.deletedIds
    ?? inferredDeletedIds
  return {
    driveDiscIdRemap,
    deletedDriveDiscIds: [...deletedDriveDiscIds].map(String),
  }
}

function actualLoadoutReferenceChanges(inventoryPlan: any, ownerId: string, options: any) {
  const currentIds = ownerItemIds(inventoryPlan.currentStore?.driveDiscLoadouts, ownerId)
  const nextIds = ownerItemIds(inventoryPlan.nextStore?.driveDiscLoadouts, ownerId)
  const explicitRemap = options.loadoutIdRemap ?? inventoryPlan.loadoutIdRemap ?? {}
  const loadoutIdRemap = Object.fromEntries(asEntries(explicitRemap))
  const remappedFromIds = new Set(Object.keys(loadoutIdRemap))
  const inferredDeletedIds = [...currentIds]
    .filter(id => !nextIds.has(id) && !remappedFromIds.has(id))
  const deletedLoadoutIds = options.deletedLoadoutIds
    ?? inventoryPlan.deletedLoadoutIds
    ?? inferredDeletedIds
  return {
    loadoutIdRemap,
    deletedLoadoutIds: [...deletedLoadoutIds].map(String),
  }
}

async function currentState() {
  return {
    store: await loadUserDriveDiscStoreFresh(),
    buildSelection: readBuildSelectionDocument(),
    legacySelection: readLegacySelectionDocument(),
  }
}

async function persistState(snapshot: any) {
  const previousBuildSelection = readBuildSelectionDocument()
  const previousLegacySelection = readLegacySelectionDocument()
  try {
    writeSelectionDocuments(snapshot.buildSelection, snapshot.legacySelection)
    return await saveUserDriveDiscStoreUnlocked(snapshot.store)
  } catch (error) {
    try {
      writeSelectionDocuments(previousBuildSelection, previousLegacySelection)
    } catch (restoreError) {
      throw new Error(`保存驱动盘导入快照失败，且配置恢复未完成：${error instanceof Error ? error.message : String(error)}；恢复错误：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`)
    }
    throw error
  }
}

function undoContext(snapshot: any, ownerId: string) {
  const ownerSelection = (document: any) => document?.byOwner
    ? document.byOwner[ownerId] ?? null : ownerId === "default" ? document : null
  return {
    build: ownerSelection(snapshot.buildSelection),
    legacy: ownerSelection(snapshot.legacySelection),
    loadouts: (snapshot.store.driveDiscLoadouts ?? []).filter((row: any) => (row.ownerId ?? "default") === ownerId),
  }
}

function finishImportJournal(store: any, journal: any) {
  const next = clearPendingDriveDiscImportJournal(store, journal.ownerId, journal.id)
  const ownerState = next.driveDiscImportState.byOwner[journal.ownerId] ?? {}
  if (["scanner", "calculator-json"].includes(journal.kind) && journal.metadata?.allowUndo !== false) {
    ownerState.undoJournal = { ...plainSnapshot(journal), status: "committed" }
    next.driveDiscImportState.byOwner[journal.ownerId] = ownerState
  } else if (journal.kind === "drive-disc-undo") {
    delete ownerState.undoJournal
    next.driveDiscImportState.byOwner[journal.ownerId] = ownerState
  }
  return next
}

export async function previewLastDriveDiscImportUndo(ownerId: string): Promise<any> {
  const current = await currentState()
  if (current.store.currentOwnerId !== ownerId) throw new Error("目标账号已切换，请重新打开撤销预览。")
  const journal = current.store.driveDiscImportState?.byOwner?.[ownerId]?.undoJournal
  if (journal?.status !== "committed") throw new Error("当前账号没有可撤销的 JSON 或扫描导入。")
  if (!driveDiscImportSnapshotMatches({ ...current, journal }, "after")
    || JSON.stringify(undoContext(current, ownerId)) !== JSON.stringify(journal.metadata?.undoContext)) {
    throw new Error("导入后的相关驱动盘、配置或套装引用已变化，已阻止撤销以免覆盖新数据。")
  }
  const target = applyDriveDiscImportSnapshot({ ...current, journal }, "before")
  return {
    ...buildDriveDiscImportTransactionPlan({
      kind: "drive-disc-undo", ownerId, transactionId: globalThis.crypto.randomUUID(),
      store: current.store, nextStore: target.store,
      buildSelection: current.buildSelection, legacySelection: current.legacySelection,
      nextBuildSelection: target.buildSelection, nextLegacySelection: target.legacySelection,
      metadata: { revertedImport: journal.id },
    }),
    requireCurrentOwner: true,
    importedAt: journal.createdAt,
  }
}

export { withDriveDiscImportOwnerLock } from "@runtime/drive-disc-import-lock"

async function recoverPendingUnlocked(ownerId: string): Promise<"none" | "committed" | "rolled-back"> {
  const current = await currentState()
  const journal = pendingDriveDiscImportJournal(current.store, ownerId)
  if (!journal) return "none"
  if (driveDiscImportSnapshotMatches({ ...current, journal }, "after")) {
    await saveUserDriveDiscStoreUnlocked(finishImportJournal(current.store, journal))
    return "committed"
  }
  await persistState(applyDriveDiscImportSnapshot({ ...current, journal }, "before"))
  return "rolled-back"
}

export async function commitDriveDiscImportPlan(plan: any): Promise<any> {
  const frozenPlan = plainSnapshot(plan)
  if (frozenPlan.hasUnresolvedConflicts || frozenPlan.conflicts?.length) {
    throw new Error("仍有疑似同盘需要确认，请处理后重新生成预览。")
  }
  return withDriveDiscImportOwnerLock(frozenPlan.ownerId, async () => {
    if (pendingDriveDiscImportJournal(await loadUserDriveDiscStoreFresh(), frozenPlan.ownerId)) {
      await recoverPendingUnlocked(frozenPlan.ownerId)
    }
    const before = await currentState()
    if (!driveDiscImportBaseMatches({ ...before, journal: frozenPlan.journal })
      || !driveDiscImportSnapshotMatches({ ...before, journal: frozenPlan.journal }, "before")) {
      throw new Error("预览后相关配置或库存已变化，请重新生成预览。")
    }

    let preparedSaved = false
    try {
      await saveUserDriveDiscStoreUnlocked(frozenPlan.preparedStore)
      preparedSaved = true
      writeSelectionDocuments(frozenPlan.nextBuildSelection, frozenPlan.nextLegacySelection)
      const preparedStore = await loadUserDriveDiscStoreFresh()
      const pending = pendingDriveDiscImportJournal(preparedStore, frozenPlan.ownerId)
      if (!pending || pending.id !== frozenPlan.transactionId) throw new Error("驱动盘导入事务已失效。")
      const committedStore = finishImportJournal(preparedStore, pending)
      await saveUserDriveDiscStoreUnlocked(committedStore)
      return {
        transactionId: frozenPlan.transactionId,
        ownerId: frozenPlan.ownerId,
        kind: frozenPlan.kind,
      }
    } catch (error) {
      if (preparedSaved) {
        try {
          const current = await currentState()
          const journal = pendingDriveDiscImportJournal(current.store, frozenPlan.ownerId) ?? frozenPlan.journal
          await persistState(applyDriveDiscImportSnapshot({ ...current, journal }, "before"))
        } catch (rollbackError) {
          throw new Error(`导入失败且自动回滚未完成；刷新页面将再次恢复。原错误：${error instanceof Error ? error.message : String(error)}；回滚错误：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
        }
      }
      throw error
    }
  })
}

export async function recoverPendingDriveDiscImport(
  ownerId: string,
  lockOptions: DriveDiscImportLockOptions = {},
): Promise<"none" | "committed" | "rolled-back"> {
  const store = await loadUserDriveDiscStoreFresh()
  if (!pendingDriveDiscImportJournal(store, ownerId)) return "none"
  return withDriveDiscImportOwnerLock(ownerId, () => recoverPendingUnlocked(ownerId), lockOptions)
}

export async function recoverAllPendingDriveDiscImports(
  lockOptions: DriveDiscImportLockOptions = {},
): Promise<Record<string, "committed" | "rolled-back">> {
  const result: Record<string, "committed" | "rolled-back"> = {}
  const ownerIds = pendingDriveDiscImportOwners(await loadUserDriveDiscStoreFresh())
  for (const ownerId of ownerIds) {
    const recovered = await recoverPendingDriveDiscImport(ownerId, lockOptions)
    if (recovered !== "none") result[ownerId] = recovered
  }
  return result
}

export async function freezeDriveDiscInventoryImportPlan(inventoryPlan: any, options: any = {}): Promise<any> {
  if (!inventoryPlan?.currentStore || !inventoryPlan?.nextStore) {
    throw new Error("驱动盘库存导入计划不完整。")
  }
  const buildSelection = readBuildSelectionDocument()
  const legacySelection = readLegacySelectionDocument()
  const ownerId = String(inventoryPlan.ownerId ?? inventoryPlan.currentStore.currentOwnerId ?? "default")
  const transactionId = String(options.transactionId
    ?? globalThis.crypto?.randomUUID?.()
    ?? `drive-disc-import-${Date.now()}`)
  const kind = String(options.kind
    ?? (inventoryPlan.normalized?.importRecord?.type === "zzz-calculator-drive-disc-export"
      ? "calculator-json"
      : "scanner"))
  const driveDiscReferences = actualDriveDiscReferenceChanges(inventoryPlan, ownerId, options)
  const loadoutReferences = actualLoadoutReferenceChanges(inventoryPlan, ownerId, options)
  const transactionPlan = buildDriveDiscImportTransactionPlan({
    kind,
    ownerId,
    transactionId,
    store: inventoryPlan.currentStore,
    nextStore: inventoryPlan.nextStore,
    buildSelection,
    legacySelection,
    driveDiscIdRemap: driveDiscReferences.driveDiscIdRemap,
    deletedDriveDiscIds: driveDiscReferences.deletedDriveDiscIds,
    loadoutIdRemap: loadoutReferences.loadoutIdRemap,
    deletedLoadoutIds: loadoutReferences.deletedLoadoutIds,
    metadata: {
      importRecordId: inventoryPlan.normalized?.importRecord?.id ?? null,
      summary: inventoryPlan.summary ?? null,
      allowUndo: options.recordUndo !== false,
      ...plainSnapshot(options.metadata ?? {}),
    },
    now: options.now ?? new Date(),
    hasUnresolvedConflicts: Boolean(inventoryPlan.hasUnresolvedConflicts),
  })
  transactionPlan.journal.metadata.undoContext = plainSnapshot(undoContext({
    store: transactionPlan.nextStore,
    buildSelection: transactionPlan.nextBuildSelection,
    legacySelection: transactionPlan.nextLegacySelection,
  }, ownerId))
  // The prepared journal must carry the same undo context across a browser crash.
  transactionPlan.preparedStore.driveDiscImportState.byOwner[ownerId].pendingJournal = plainSnapshot(transactionPlan.journal)
  const preview = plainSnapshot(inventoryPlan.preview ?? null)
  const invalidationWarning = transactionPlan.enkaUndoInvalidation
    ? "本次导入会修改上次展柜数据导入涉及的库存或配置，原撤销记录将失效。"
    : ""
  if (preview && invalidationWarning) {
    preview.warnings = [...new Set([...(preview.warnings ?? []), invalidationWarning])]
  }
  return {
    ...transactionPlan,
    preview,
    summary: plainSnapshot(inventoryPlan.summary ?? null),
    conflicts: plainSnapshot(inventoryPlan.reconciliation?.conflicts ?? inventoryPlan.preview?.conflicts ?? []),
  }
}

export async function hasPendingDriveDiscImport(ownerId: string): Promise<boolean> {
  return Boolean(pendingDriveDiscImportJournal(await loadUserDriveDiscStore(), ownerId))
}
