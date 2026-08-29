const GLOBAL_DRIVE_DISC_STORE_LOCK = "zzz-drive-disc-import:store"

export const DRIVE_DISC_STORE_BUSY = "DRIVE_DISC_STORE_BUSY" as const
export const DEFAULT_DRIVE_DISC_STORE_LOCK_TIMEOUT_MS = 5_000

export interface DriveDiscImportLockOptions {
  waitTimeoutMs?: number
  lockTimeoutMs?: number
  purpose?: string
  signal?: AbortSignal
}

export interface DriveDiscStoreBusyError extends Error {
  code: typeof DRIVE_DISC_STORE_BUSY
  purpose?: string
  cause?: unknown
}

let fallbackActive = false

function normalizedTimeout(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_DRIVE_DISC_STORE_LOCK_TIMEOUT_MS
  }
  const timeout = Number(value)
  return Number.isFinite(timeout) && timeout >= 0
    ? timeout
    : DEFAULT_DRIVE_DISC_STORE_LOCK_TIMEOUT_MS
}

function busyError(options: DriveDiscImportLockOptions, cause?: unknown): DriveDiscStoreBusyError {
  const purpose = String(options.purpose ?? "").trim()
  const error = new Error(
    purpose
      ? `${purpose}等待驱动盘库存写入锁超时，请稍后重试。`
      : "等待驱动盘库存写入锁超时，请稍后重试。",
  ) as DriveDiscStoreBusyError
  error.code = DRIVE_DISC_STORE_BUSY
  if (purpose) error.purpose = purpose
  if (cause !== undefined) error.cause = cause
  return error
}

function fallbackBusyError(options: DriveDiscImportLockOptions): DriveDiscStoreBusyError {
  const error = busyError(options)
  error.message = "驱动盘库存已有写入正在执行，请稍候。"
  return error
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError")
}

/**
 * Serializes every browser-local inventory mutation through one global lock.
 * `ownerId` remains in the public signature for compatibility and diagnostics.
 * The timeout only cancels a queued request; an acquired task always finishes.
 */
export async function withDriveDiscImportOwnerLock<T>(
  ownerId: string,
  task: () => T | PromiseLike<T>,
  options: DriveDiscImportLockOptions = {},
): Promise<T> {
  void ownerId
  const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null
  if (!locks?.request) {
    if (options.signal?.aborted) throw abortError(options.signal)
    if (fallbackActive) throw fallbackBusyError(options)
    fallbackActive = true
    try {
      return await task()
    } finally {
      fallbackActive = false
    }
  }

  if (options.signal?.aborted) throw abortError(options.signal)

  const waitTimeoutMs = normalizedTimeout(options.waitTimeoutMs ?? options.lockTimeoutMs)
  const controller = new AbortController()
  let acquired = false
  let timedOut = false
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let removeExternalAbort: (() => void) | null = null

  const abortQueuedRequest = (reason?: unknown) => {
    if (acquired || controller.signal.aborted) return
    try {
      controller.abort(reason)
    } catch {
      controller.abort()
    }
  }

  let rejectCancellation!: (reason?: unknown) => void
  const cancellation = new Promise<never>((_, reject) => {
    rejectCancellation = reject
  })

  if (options.signal) {
    const onAbort = () => {
      if (acquired || settled) return
      const reason = abortError(options.signal!)
      abortQueuedRequest(reason)
      rejectCancellation(reason)
    }
    options.signal.addEventListener("abort", onAbort, { once: true })
    removeExternalAbort = () => options.signal?.removeEventListener("abort", onAbort)
  }

  timer = setTimeout(() => {
    if (acquired || settled) return
    timedOut = true
    const error = busyError(options)
    abortQueuedRequest(error)
    rejectCancellation(error)
  }, waitTimeoutMs)

  const lockPromise = Promise.resolve().then(() => locks.request(
    GLOBAL_DRIVE_DISC_STORE_LOCK,
    { signal: controller.signal },
    async () => {
      if (timedOut || options.signal?.aborted) return undefined as T
      acquired = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      removeExternalAbort?.()
      removeExternalAbort = null
      return await task()
    },
  )) as Promise<T>

  try {
    return await Promise.race([lockPromise, cancellation])
  } catch (error) {
    if (timedOut) throw busyError(options, error)
    throw error
  } finally {
    settled = true
    if (timer !== null) clearTimeout(timer)
    removeExternalAbort?.()
  }
}
