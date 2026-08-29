import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_DRIVE_DISC_STORE_LOCK_TIMEOUT_MS,
  DRIVE_DISC_STORE_BUSY,
  withDriveDiscImportOwnerLock,
} from "@runtime/drive-disc-import-lock"

type PendingLock = {
  callback: () => unknown
  reject: (reason?: unknown) => void
  resolve: (value: unknown) => void
  signal?: AbortSignal
  started: boolean
  removeAbort?: () => void
}

function installExclusiveLocks() {
  const calls: string[] = []
  const queues = new Map<string, PendingLock[]>()
  const active = new Set<string>()
  const original = Object.getOwnPropertyDescriptor(navigator, "locks")

  const pump = (name: string) => {
    if (active.has(name)) return
    const queue = queues.get(name) ?? []
    const pending = queue.shift()
    if (!pending) return
    if (pending.signal?.aborted) {
      pending.reject(new DOMException("aborted", "AbortError"))
      pump(name)
      return
    }
    active.add(name)
    pending.started = true
    pending.removeAbort?.()
    Promise.resolve()
      .then(pending.callback)
      .then(pending.resolve, pending.reject)
      .finally(() => {
        active.delete(name)
        pump(name)
      })
  }

  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request(name: string, optionsOrCallback: any, maybeCallback?: () => unknown) {
        calls.push(name)
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback
        const signal = typeof optionsOrCallback === "function" ? undefined : optionsOrCallback?.signal
        return new Promise((resolve, reject) => {
          const pending: PendingLock = { callback, reject, resolve, signal, started: false }
          if (signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"))
            return
          }
          if (signal) {
            const onAbort = () => {
              if (pending.started) return
              const queue = queues.get(name)
              const index = queue?.indexOf(pending) ?? -1
              if (index >= 0) queue?.splice(index, 1)
              reject(new DOMException("aborted", "AbortError"))
            }
            signal.addEventListener("abort", onAbort, { once: true })
            pending.removeAbort = () => signal.removeEventListener("abort", onAbort)
          }
          const queue = queues.get(name) ?? []
          queue.push(pending)
          queues.set(name, queue)
          pump(name)
        })
      },
    },
  })

  return {
    calls,
    restore() {
      if (original) Object.defineProperty(navigator, "locks", original)
      else Reflect.deleteProperty(navigator, "locks")
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("drive-disc store lock", () => {
  it("uses one global lock for both the store sentinel and ordinary owners", async () => {
    const locks = installExclusiveLocks()
    try {
      await expect(withDriveDiscImportOwnerLock("store", async () => "store-saved")).resolves.toBe("store-saved")
      await expect(withDriveDiscImportOwnerLock("owner-a", async () => "owner-saved")).resolves.toBe("owner-saved")
      expect(locks.calls).toEqual([
        "zzz-drive-disc-import:store",
        "zzz-drive-disc-import:store",
      ])
    } finally {
      locks.restore()
    }
  })

  it("serializes concurrent mutations in FIFO order", async () => {
    const locks = installExclusiveLocks()
    let releaseFirst!: () => void
    let firstStarted!: () => void
    const started = new Promise<void>(resolve => { firstStarted = resolve })
    const gate = new Promise<void>(resolve => { releaseFirst = resolve })
    const events: string[] = []
    try {
      const first = withDriveDiscImportOwnerLock("owner-a", async () => {
        events.push("first:start")
        firstStarted()
        await gate
        events.push("first:end")
      })
      await started
      const second = withDriveDiscImportOwnerLock("owner-b", async () => {
        events.push("second:start")
        events.push("second:end")
      })
      await Promise.resolve()
      expect(events).toEqual(["first:start"])
      releaseFirst()
      await Promise.all([first, second])
      expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"])
    } finally {
      locks.restore()
    }
  })

  it("returns a stable busy error and never runs a timed-out queued task", async () => {
    const locks = installExclusiveLocks()
    let releaseFirst!: () => void
    let firstStarted!: () => void
    const started = new Promise<void>(resolve => { firstStarted = resolve })
    const gate = new Promise<void>(resolve => { releaseFirst = resolve })
    let lateTaskStarted = false
    try {
      const first = withDriveDiscImportOwnerLock("owner-a", async () => {
        firstStarted()
        await gate
      })
      await started
      await expect(withDriveDiscImportOwnerLock("store", async () => {
        lateTaskStarted = true
      }, { waitTimeoutMs: 10, purpose: "保存套装" })).rejects.toMatchObject({
        code: DRIVE_DISC_STORE_BUSY,
        purpose: "保存套装",
      })
      releaseFirst()
      await first
      await Promise.resolve()
      expect(lateTaskStarted).toBe(false)
    } finally {
      releaseFirst?.()
      locks.restore()
    }
  })

  it("does not cancel a task after it acquires the lock", async () => {
    const locks = installExclusiveLocks()
    try {
      await expect(withDriveDiscImportOwnerLock("default", async () => {
        await new Promise(resolve => setTimeout(resolve, 25))
        return "saved"
      }, { waitTimeoutMs: 10 })).resolves.toBe("saved")
    } finally {
      locks.restore()
    }
  })

  it("honors an external AbortSignal only while the request is queued", async () => {
    const locks = installExclusiveLocks()
    let releaseFirst!: () => void
    let firstStarted!: () => void
    const started = new Promise<void>(resolve => { firstStarted = resolve })
    const gate = new Promise<void>(resolve => { releaseFirst = resolve })
    const controller = new AbortController()
    let cancelledTaskStarted = false
    try {
      const first = withDriveDiscImportOwnerLock("owner-a", async () => {
        firstStarted()
        await gate
      })
      await started
      const queued = withDriveDiscImportOwnerLock("owner-b", async () => {
        cancelledTaskStarted = true
      }, { signal: controller.signal })
      controller.abort(new Error("cancelled by caller"))
      await expect(queued).rejects.toThrow("cancelled by caller")
      releaseFirst()
      await first
      await Promise.resolve()
      expect(cancelledTaskStarted).toBe(false)

      const acquiredController = new AbortController()
      await expect(withDriveDiscImportOwnerLock("owner-c", async () => {
        acquiredController.abort(new Error("too late"))
        return "completed"
      }, { signal: acquiredController.signal })).resolves.toBe("completed")
    } finally {
      releaseFirst?.()
      locks.restore()
    }
  })

  it("releases the lock when a task throws", async () => {
    const locks = installExclusiveLocks()
    try {
      await expect(withDriveDiscImportOwnerLock("default", async () => {
        throw new Error("write failed")
      })).rejects.toThrow("write failed")
      await expect(withDriveDiscImportOwnerLock("default", async () => "retry saved"))
        .resolves.toBe("retry saved")
    } finally {
      locks.restore()
    }
  })

  it("publishes the five-second default acquisition timeout", () => {
    expect(DEFAULT_DRIVE_DISC_STORE_LOCK_TIMEOUT_MS).toBe(5_000)
  })
})
