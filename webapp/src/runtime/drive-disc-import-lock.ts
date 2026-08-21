const GLOBAL_DRIVE_DISC_STORE_LOCK = "zzz-drive-disc-import:store"

let fallbackActive = false

export async function withDriveDiscImportOwnerLock<T>(ownerId: string, task: () => Promise<T>): Promise<T> {
  const normalizedOwnerId = String(ownerId || "default")
  const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null
  if (locks?.request) {
    return locks.request(GLOBAL_DRIVE_DISC_STORE_LOCK, () => (
      locks.request(`zzz-drive-disc-import:${normalizedOwnerId}`, task)
    ))
  }
  if (fallbackActive) throw new Error("驱动盘库存已有写入正在执行，请稍候。")
  fallbackActive = true
  try {
    return await task()
  } finally {
    fallbackActive = false
  }
}
