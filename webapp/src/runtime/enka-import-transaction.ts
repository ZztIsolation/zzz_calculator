import {
  applyEnkaImportSnapshot,
  committedEnkaImportJournal,
  enkaImportBaseMatches,
  enkaImportSnapshotMatches,
  markEnkaImportCommitted,
  pendingEnkaImportJournal,
} from "@core/enka-import/import-plan.js"
import {
  loadUserDriveDiscStore,
  saveUserDriveDiscStore,
} from "@runtime/local-store.js"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
  writeEnkaSelectionDocuments,
} from "@runtime/build-storage"

let activeTransaction = false

function plainSnapshot(value: any): any {
  return JSON.parse(JSON.stringify(value))
}

async function currentState() {
  return {
    store: await loadUserDriveDiscStore(),
    buildSelection: readBuildSelectionDocument(),
    legacySelection: readLegacySelectionDocument(),
  }
}

async function persistSnapshot(snapshot: any) {
  const previousBuildSelection = readBuildSelectionDocument()
  const previousLegacySelection = readLegacySelectionDocument()
  try {
    writeEnkaSelectionDocuments(snapshot.buildSelection, snapshot.legacySelection)
    return await saveUserDriveDiscStore(snapshot.store)
  } catch (error) {
    try {
      writeEnkaSelectionDocuments(previousBuildSelection, previousLegacySelection)
    } catch (restoreError) {
      throw new Error(`保存快照失败，且配置恢复未完成：${error instanceof Error ? error.message : String(error)}；恢复错误：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`)
    }
    throw error
  }
}

async function withOwnerLock<T>(ownerId: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null
  if (locks?.request) return locks.request(`zzz-enka-import:${ownerId}`, task)
  if (activeTransaction) throw new Error("已有 Enka 导入正在执行，请稍候。")
  activeTransaction = true
  try {
    return await task()
  } finally {
    activeTransaction = false
  }
}

export async function commitEnkaImportPlan(plan: any): Promise<any> {
  const importPlan = plainSnapshot(plan)
  return withOwnerLock(importPlan.ownerId, async () => {
    const before = await currentState()
    if (!enkaImportBaseMatches({ ...before, journal: importPlan.journal })
      || !enkaImportSnapshotMatches({ ...before, journal: importPlan.journal }, "before")) {
      throw new Error("预览后相关配置或库存已变化，请重新生成预览。")
    }

    let preparedSaved = false
    try {
      await saveUserDriveDiscStore(importPlan.nextStore)
      preparedSaved = true
      writeEnkaSelectionDocuments(importPlan.nextBuildSelection, importPlan.nextLegacySelection)
      const preparedStore = await loadUserDriveDiscStore()
      const committedStore = markEnkaImportCommitted(preparedStore, importPlan.ownerId, importPlan.transactionId)
      await saveUserDriveDiscStore(committedStore)
      return { transactionId: importPlan.transactionId, ownerId: importPlan.ownerId }
    } catch (error) {
      if (preparedSaved) {
        try {
          const current = await currentState()
          const rolledBack = applyEnkaImportSnapshot({ ...current, journal: importPlan.journal }, "before")
          await persistSnapshot(rolledBack)
        } catch (rollbackError) {
          throw new Error(`导入失败且自动回滚未完成；刷新页面将再次恢复。原错误：${error instanceof Error ? error.message : String(error)}；回滚错误：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
        }
      }
      throw error
    }
  })
}

export async function recoverPendingEnkaImport(ownerId: string): Promise<"none" | "committed" | "rolled-back"> {
  return withOwnerLock(ownerId, async () => {
    const current = await currentState()
    const journal = pendingEnkaImportJournal(current.store, ownerId)
    if (!journal) return "none"
    if (enkaImportSnapshotMatches({ ...current, journal }, "after")) {
      await saveUserDriveDiscStore(markEnkaImportCommitted(current.store, ownerId, journal.id))
      return "committed"
    }
    await persistSnapshot(applyEnkaImportSnapshot({ ...current, journal }, "before"))
    return "rolled-back"
  })
}

export async function undoLastEnkaImport(ownerId: string): Promise<void> {
  await withOwnerLock(ownerId, async () => {
    const current = await currentState()
    const journal = committedEnkaImportJournal(current.store, ownerId)
    if (!journal) throw new Error("当前账号没有可撤销的 Enka 导入。")
    if (!enkaImportSnapshotMatches({ ...current, journal }, "after")) {
      throw new Error("导入后的相关配置或库存已被修改，无法自动撤销以免覆盖新数据。")
    }
    await persistSnapshot(applyEnkaImportSnapshot({ ...current, journal }, "before"))
  })
}

export async function hasCommittedEnkaUndo(ownerId: string): Promise<boolean> {
  return Boolean(committedEnkaImportJournal(await loadUserDriveDiscStore(), ownerId))
}
