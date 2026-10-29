import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const STORE_KEY = "userDriveDiscStore"
const CONFIG_KEY = "zzz-calculator.webapp.build.v1"

type FakeIndexedDbState = {
  records: Map<string, any>
  putCalls: number
  failPutAt: number | null
}

function asyncRequest<T>(result: T = undefined as T) {
  const request: any = { result, error: null }
  queueMicrotask(() => request.onsuccess?.())
  return request
}

function createFakeIndexedDb(state: FakeIndexedDbState) {
  const database: any = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const transaction: any = { error: null }
      let completionScheduled = false
      const scheduleComplete = () => {
        if (completionScheduled) return
        completionScheduled = true
        setTimeout(() => transaction.oncomplete?.(), 0)
      }
      transaction.abort = () => {
        if (completionScheduled) return
        transaction.onabort?.()
      }
      transaction.objectStore = () => ({
        get(key: string) {
          scheduleComplete()
          return asyncRequest(state.records.get(key))
        },
        put(value: any, key: string) {
          state.putCalls += 1
          if (state.failPutAt === state.putCalls) {
            const error = new Error("fake-indexeddb-put-failed")
            queueMicrotask(() => {
              transaction.error = error
              transaction.onerror?.()
            })
            return { result: undefined, error } as any
          }
          state.records.set(key, value)
          scheduleComplete()
          return asyncRequest(key)
        },
      })
      return transaction
    },
  }
  return {
    open() {
      return asyncRequest(database)
    },
    deleteDatabase() {
      state.records.clear()
      return asyncRequest()
    },
  }
}

async function loadModules() {
  const localStore = await import("@runtime/local-store.js")
  const personalBackup = await import("./personal-backup")
  return { localStore, personalBackup }
}

function seedStore() {
  return {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "A" }, { id: "alt", label: "B" }],
    driveDiscs: [{
      id: "d1",
      ownerId: "default",
      setId: "woodpecker_electro",
      partition: 1,
      level: 15,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
      equippedBy: "miyabi",
      reservedForAgentId: "miyabi",
    }],
    driveDiscLoadouts: [{ id: "l1", ownerId: "default", driveDiscIdsBySlot: { 1: "d1" } }],
    imports: [],
    enkaImportState: { version: 1, byOwner: { alt: { binding: { uid: "123456789" } } } },
  }
}

let state: FakeIndexedDbState

beforeEach(() => {
  localStorage.clear()
  state = { records: new Map([[STORE_KEY, seedStore()]]), putCalls: 0, failPutAt: null }
  localStorage.setItem(CONFIG_KEY, '{"version":2,"byOwner":{}}')
  localStorage.setItem("unrelated-site", "keep")
  vi.resetModules()
  vi.stubGlobal("indexedDB", createFakeIndexedDb(state))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("personal backup through IndexedDB", () => {
  it("writes the restore journal to IndexedDB, replaces data and clears the journal", async () => {
    const { localStore, personalBackup } = await loadModules()
    const backup = await personalBackup.createPersonalBackup()
    const changed = await localStore.loadUserDriveDiscStoreFresh()
    changed.driveDiscs[0].level = 12
    await localStore.saveUserDriveDiscStore(changed)
    localStorage.setItem(CONFIG_KEY, '{"changed":true}')

    await personalBackup.restorePersonalBackup(await personalBackup.previewPersonalRestore(backup))

    const persisted = state.records.get(STORE_KEY)
    expect(persisted.personalDataRestore).toBeUndefined()
    expect(persisted.driveDiscs[0].level).toBe(15)
    expect(localStorage.getItem(CONFIG_KEY)).toBe(backup.data.localStorage[0].value)
    expect(localStorage.getItem("unrelated-site")).toBe("keep")
  })

  it("recovers an interrupted IndexedDB restore before normal reads", async () => {
    const { localStore, personalBackup } = await loadModules()
    const before = (await personalBackup.createPersonalBackup()).data
    await localStore.saveUserDriveDiscStoreUnlocked(
      { ...before.inventory, personalDataRestore: { version: 1, id: "interrupted", before } },
      { personalDataRestoreTransactionId: "interrupted" },
    )
    localStorage.setItem(CONFIG_KEY, '{"partiallyApplied":true}')

    await personalBackup.recoverPersonalRestore()

    const persisted = state.records.get(STORE_KEY)
    expect(persisted.personalDataRestore).toBeUndefined()
    expect(persisted.driveDiscs[0].level).toBe(15)
    expect(localStorage.getItem(CONFIG_KEY)).toBe(before.localStorage[0].value)
  })

  it("refuses to clear browser data while an IndexedDB restore journal is pending", async () => {
    const { localStore, personalBackup } = await loadModules()
    const before = (await personalBackup.createPersonalBackup()).data
    await localStore.saveUserDriveDiscStoreUnlocked(
      { ...before.inventory, personalDataRestore: { version: 1, id: "clear-guard", before } },
      { personalDataRestoreTransactionId: "clear-guard" },
    )

    await expect(localStore.clearAllBrowserData()).rejects.toThrow("未完成的个人数据恢复事务")
    expect(state.records.get(STORE_KEY).personalDataRestore?.id).toBe("clear-guard")
    expect(localStorage.getItem("unrelated-site")).toBe("keep")
  })

  it("rolls back a failed final IndexedDB write without leaving a journal", async () => {
    const { localStore, personalBackup } = await loadModules()
    const backup = await personalBackup.createPersonalBackup()
    const plan = await personalBackup.previewPersonalRestore(backup)
    // First put writes the prepared journal; the second (final inventory) fails.
    state.failPutAt = 2

    await expect(personalBackup.restorePersonalBackup(plan)).rejects.toThrow("fake-indexeddb-put-failed")

    const persisted = state.records.get(STORE_KEY)
    expect(persisted.personalDataRestore).toBeUndefined()
    expect(persisted.driveDiscs[0].level).toBe(15)
  })
})
