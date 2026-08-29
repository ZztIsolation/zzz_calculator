import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

function successRequest(result: unknown) {
  const request: any = { result, error: null, onsuccess: null, onerror: null }
  queueMicrotask(() => request.onsuccess?.())
  return request
}

function databaseFor() {
  const database: any = {
    objectStoreNames: { contains: () => true },
    close: vi.fn(),
    transaction() {
      const transaction: any = {
        error: null,
        abort: vi.fn(),
        objectStore() {
          return {
            get() {
              queueMicrotask(() => transaction.oncomplete?.())
              return successRequest(undefined)
            },
          }
        },
      }
      return transaction
    },
  }
  return database
}

function installIndexedDb(database: any) {
  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => successRequest(database)),
  })
}

describe("local-store IndexedDB timeouts", () => {
  it("publishes the fifteen-second default storage timeout", async () => {
    const localStore = await import("@runtime/local-store.js?storage-default-timeout")
    expect(localStore.DEFAULT_STORAGE_TIMEOUT_MS).toBe(15_000)
  })

  it("clears a timed-out open promise so a later operation can retry", async () => {
    let firstOpen = true
    const working = databaseFor()
    const open = vi.fn(() => {
      if (firstOpen) {
        firstOpen = false
        return { result: undefined, error: null }
      }
      return successRequest(working)
    })
    vi.stubGlobal("indexedDB", { open })
    const localStore = await import("@runtime/local-store.js?storage-open-timeout")

    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 100 }))
      .resolves.toMatchObject({ version: 1 })
    expect(open).toHaveBeenCalledTimes(2)
  })

  it("does not let one short open timeout cancel another active waiter", async () => {
    vi.useFakeTimers()
    const working = databaseFor()
    const request: any = { result: undefined, error: null, onsuccess: null, onerror: null }
    const open = vi.fn(() => request)
    vi.stubGlobal("indexedDB", { open })
    const localStore = await import("@runtime/local-store.js?storage-open-concurrent-timeouts")

    const short = localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 })
    const long = localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 100 })
    const shortResult = expect(short).rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    await vi.advanceTimersByTimeAsync(10)
    await shortResult

    request.result = working
    request.onsuccess?.()
    await expect(long).resolves.toMatchObject({ version: 1 })
    expect(open).toHaveBeenCalledTimes(1)
  })

  it("closes a late connection after its only waiter times out", async () => {
    vi.useFakeTimers()
    const lateDatabase = databaseFor()
    const request: any = { result: undefined, error: null, onsuccess: null, onerror: null }
    vi.stubGlobal("indexedDB", { open: vi.fn(() => request) })
    const localStore = await import("@runtime/local-store.js?storage-open-late-success")

    const opening = localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 })
    const rejected = expect(opening).rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    await vi.advanceTimersByTimeAsync(10)
    await rejected

    request.result = lateDatabase
    request.onsuccess?.()
    await Promise.resolve()
    expect(lateDatabase.close).toHaveBeenCalledTimes(1)
  })

  it("reopens the database after a version change", async () => {
    const first = databaseFor()
    const second = databaseFor()
    const databases = [first, second]
    const open = vi.fn(() => successRequest(databases.shift()))
    vi.stubGlobal("indexedDB", { open })
    const localStore = await import("@runtime/local-store.js?storage-version-change")

    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 100 }))
      .resolves.toMatchObject({ version: 1 })
    first.onversionchange?.()
    expect(first.close).toHaveBeenCalledTimes(1)
    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 100 }))
      .resolves.toMatchObject({ version: 1 })
    expect(open).toHaveBeenCalledTimes(2)
  })

  it("aborts a stalled write transaction and succeeds on retry", async () => {
    let hangWrite = true
    const writes: any[] = []
    const aborts: any[] = []
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort: vi.fn(() => aborts.push(transaction)),
          objectStore() {
            return {
              put(value: any) {
                writes.push(value)
                if (!hangWrite) queueMicrotask(() => transaction.oncomplete?.())
                return successRequest(undefined)
              },
            }
          },
        }
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-write-timeout")
    const store = {
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }

    await expect(localStore.saveUserDriveDiscStoreUnlocked(store, { storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    expect(aborts).toHaveLength(1)
    expect(writes).toHaveLength(1)

    hangWrite = false
    await expect(localStore.saveUserDriveDiscStoreUnlocked(store, { storageTimeoutMs: 100 }))
      .resolves.toMatchObject({ version: 1 })
    expect(writes).toHaveLength(2)
  })

  it("waits for the real commit result when a timed-out abort is rejected", async () => {
    let committed = false
    const abort = vi.fn()
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort,
          objectStore() {
            return {
              put() {
                return successRequest(undefined)
              },
            }
          },
        }
        abort.mockImplementationOnce(() => {
          queueMicrotask(() => {
            committed = true
            transaction.oncomplete?.()
          })
          throw new DOMException("transaction is already committing", "InvalidStateError")
        })
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-write-commit-race")
    const store = {
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }

    await expect(localStore.saveUserDriveDiscStoreUnlocked(store, { storageTimeoutMs: 10 }))
      .resolves.toMatchObject({ version: 1 })
    expect(abort).toHaveBeenCalledTimes(1)
    expect(committed).toBe(true)
  })

  it("reports a stable timeout only after abort succeeds and prevents the pending commit", async () => {
    let committed = false
    let pendingCommit: (() => void) | null = null
    const abort = vi.fn()
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort,
          objectStore() {
            return {
              put() {
                pendingCommit = () => {
                  committed = true
                  transaction.oncomplete?.()
                }
                return successRequest(undefined)
              },
            }
          },
        }
        abort.mockImplementationOnce(() => {
          pendingCommit = null
          queueMicrotask(() => transaction.onabort?.())
        })
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-write-abort-success")
    const store = {
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }

    await expect(localStore.saveUserDriveDiscStoreUnlocked(store, { storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    pendingCommit?.()
    expect(abort).toHaveBeenCalledTimes(1)
    expect(committed).toBe(false)
  })

  it("aborts a stalled read transaction and reports the stable timeout", async () => {
    const abort = vi.fn()
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort,
          objectStore() {
            return { get: () => ({ result: undefined, error: null }) }
          },
        }
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-read-timeout")

    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it("keeps the stable timeout when abort also fails the read request", async () => {
    let request: any
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort: vi.fn(() => {
            request.error = new DOMException("aborted", "AbortError")
            request.onerror?.()
            transaction.onabort?.()
          }),
          objectStore() {
            return {
              get() {
                request = { result: undefined, error: null, onsuccess: null, onerror: null }
                return request
              },
            }
          },
        }
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-read-abort-race")

    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
  })

  it("keeps the stable timeout when abort synchronously emits transaction error", async () => {
    const database: any = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      transaction() {
        const transaction: any = {
          error: null,
          abort: vi.fn(() => {
            transaction.error = new DOMException("aborted", "AbortError")
            transaction.onerror?.()
            transaction.onabort?.()
          }),
          objectStore() {
            return { get: () => ({ result: undefined, error: null }) }
          },
        }
        return transaction
      },
    }
    installIndexedDb(database)
    const localStore = await import("@runtime/local-store.js?storage-transaction-error-race")

    await expect(localStore.loadUserDriveDiscStoreFresh({ storageTimeoutMs: 10 }))
      .rejects.toMatchObject({ code: localStore.DRIVE_DISC_STORAGE_TIMEOUT })
  })
})
