import { loadUserDriveDiscStoreFresh, saveUserDriveDiscStoreUnlocked, restoreUnreadableInventoryFallback } from "@runtime/local-store.js"
import { withDriveDiscImportOwnerLock } from "@runtime/drive-disc-import-lock"
import { driveDiscImportFingerprint, pendingDriveDiscImportOwners } from "@core/drive-disc-import/transaction-plan.js"

const FORMAT = "zzz-calculator-personal-backup"
const FALLBACK = "zzz-calculator.userStore.v1"
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const appKey = (key: string) => key !== FALLBACK
  && (key.startsWith("zzz-calculator.") || key.startsWith("zzz_maintenance_vue_draft_"))

type Snapshot = { inventory: any, localStorage: Array<{ key: string, value: string }>, unreadableFallback?: string }

function readLocalDocuments() {
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
    .filter(appKey).sort().map(key => ({ key, value: localStorage.getItem(key)! }))
}

async function snapshot(): Promise<Snapshot> {
  let inventory: any
  try { inventory = await loadUserDriveDiscStoreFresh() }
  catch (error) {
    if ((error as any)?.code !== "LOCAL_DATA_PARSE_ERROR" || (error as any)?.storageKey !== FALLBACK) throw error
    return { inventory: null, unreadableFallback: localStorage.getItem(FALLBACK)!, localStorage: readLocalDocuments() }
  }
  return { inventory, localStorage: readLocalDocuments() }
}

function assertSettled(inventory: any) {
  if (inventory?.personalDataRestore || pendingDriveDiscImportOwners(inventory ?? {}).length
    || Object.values(inventory?.enkaImportState?.byOwner ?? {}).some((owner: any) => owner?.pendingJournal?.status === "prepared")) {
    throw new Error("仍有未完成的数据事务，请先刷新完成恢复，再备份或导入。")
  }
}

export function validatePersonalBackup(value: any): Snapshot {
  if (value?.format !== FORMAT || value.version !== 1) throw new Error("不是支持的完整备份 v1 文件。驱动盘 JSON 请到驱动盘页面导入。")
  const source = value.data
  const inventory = source?.inventory
  if (!inventory || inventory.version !== 1 || !Array.isArray(inventory.owners) || !inventory.owners.length
    || !Array.isArray(inventory.driveDiscs) || !Array.isArray(inventory.driveDiscLoadouts) || !Array.isArray(inventory.imports)
    || !Array.isArray(source.localStorage) || source.unreadableFallback !== undefined) throw new Error("备份的数据结构不完整。")
  const owners = new Set<string>()
  for (const owner of inventory.owners) {
    if (typeof owner?.id !== "string" || !owner.id || owners.has(owner.id)) throw new Error("备份中存在无效或重复账号。")
    owners.add(owner.id)
  }
  if (!owners.has(inventory.currentOwnerId)) throw new Error("备份的当前账号不存在。")
  for (const field of ["driveDiscs", "driveDiscLoadouts", "imports"]) {
    const ids = new Set<string>()
    for (const item of inventory[field]) {
      const ownerId = item?.ownerId ?? "default"
      if (!item || typeof item !== "object" || !owners.has(ownerId)) throw new Error(`备份的 ${field} 存在无效账号引用。`)
      if (field !== "imports" && (typeof item.id !== "string" || !item.id)) throw new Error(`备份的 ${field} 缺少有效 ID。`)
      if (item.id) {
        const id = JSON.stringify([ownerId, item.id])
        if (ids.has(id)) throw new Error(`备份的 ${field} 存在重复 ID。`)
        ids.add(id)
      }
    }
  }
  const keys = new Set<string>()
  for (const record of source.localStorage) {
    if (typeof record?.key !== "string" || !appKey(record.key) || typeof record.value !== "string" || keys.has(record.key)) throw new Error("备份包含无效或重复的设置记录。")
    keys.add(record.key)
    if (["zzz-calculator.webapp.build.v1", "zzz-calculator.homeSelection.v1", "zzz-calculator.webapp.optimizer.v1"].includes(record.key)) {
      let parsed: any
      try { parsed = JSON.parse(record.value) } catch { throw new Error(`备份中的计算配置无法解析：${record.key}`) }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`备份中的计算配置格式无效：${record.key}`)
    }
    if (record.key === "zzz-calculator.currentAccount.v1" && record.value !== inventory.currentOwnerId) throw new Error("备份的账号选择与库存不一致。")
  }
  assertSettled(inventory)
  return clone(source)
}

export async function createPersonalBackup() {
  return withDriveDiscImportOwnerLock("all", async () => {
    const data = await snapshot()
    assertSettled(data.inventory)
    const backup = { format: FORMAT, version: 1, createdAt: new Date().toISOString(), data }
    validatePersonalBackup(backup)
    return backup
  })
}

export function downloadData(value: any, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function previewPersonalRestore(value: any) {
  const target = validatePersonalBackup(value)
  const before = await snapshot()
  assertSettled(before.inventory)
  const count = (data: Snapshot) => ({ accounts: data.inventory?.owners?.length ?? 0,
    discs: data.inventory?.driveDiscs?.length ?? 0, loadouts: data.inventory?.driveDiscLoadouts?.length ?? 0,
    documents: data.localStorage.length, labels: (data.inventory?.owners ?? []).map((owner: any) => owner.label ?? owner.id),
    unreadable: data.unreadableFallback !== undefined })
  return { id: globalThis.crypto.randomUUID(), target, before, base: driveDiscImportFingerprint(before),
    current: count(before), incoming: count(target) }
}

function writeLocalDocuments(records: Snapshot["localStorage"]) {
  const target = new Map(records.map(record => [record.key, record.value]))
  for (const { key } of readLocalDocuments()) if (!target.has(key)) localStorage.removeItem(key)
  for (const [key, value] of target) if (localStorage.getItem(key) !== value) localStorage.setItem(key, value)
}

async function rollback(journal: any) {
  writeLocalDocuments(journal.before.localStorage)
  if (journal.before.unreadableFallback !== undefined) {
    restoreUnreadableInventoryFallback(journal.before.unreadableFallback, journal.id)
  } else {
    await saveUserDriveDiscStoreUnlocked(journal.before.inventory)
  }
}

export async function restorePersonalBackup(plan: any) {
  const frozen = clone(plan)
  validatePersonalBackup({ format: FORMAT, version: 1, data: frozen.target })
  return withDriveDiscImportOwnerLock("all", async () => {
    const before = await snapshot()
    assertSettled(before.inventory)
    if (driveDiscImportFingerprint(before) !== frozen.base) throw new Error("预览后数据已变化，请重新选择备份并核对影响范围。")
    const journal = { version: 1, id: frozen.id, before }
    // The existing inventory record holds the journal, including raw settings.
    // No database schema or storage location changes are required.
    const prepared = { ...(before.inventory ?? frozen.target.inventory), personalDataRestore: journal }
    await saveUserDriveDiscStoreUnlocked(prepared, { unreadableFallback: before.unreadableFallback })
    try {
      writeLocalDocuments(frozen.target.localStorage)
      await saveUserDriveDiscStoreUnlocked(frozen.target.inventory)
    } catch (error) {
      try { await rollback(journal) }
      catch { throw new Error("恢复失败且回滚未完成，原数据副本仍在恢复记录中；请刷新重试，勿清空浏览器数据。") }
      throw error
    }
  })
}

export async function recoverPersonalRestore() {
  // A malformed fallback without a journal is handled by the normal read guard.
  const current = await snapshot()
  if (!current.inventory?.personalDataRestore) return
  await withDriveDiscImportOwnerLock("all", async () => {
    const fresh = await snapshot()
    if (fresh.inventory?.personalDataRestore) await rollback(fresh.inventory.personalDataRestore)
  })
}
