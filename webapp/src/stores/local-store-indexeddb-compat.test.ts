import { afterEach, describe, expect, it, vi } from "vitest"

function asyncRequest(result: unknown = undefined) {
  const request: any = { result, error: null }
  queueMicrotask(() => request.onsuccess?.())
  return request
}

describe("local-store IndexedDB compatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("keeps the existing database, object store, and record key", async () => {
    const records = new Map<string, any>([["userDriveDiscStore", {
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [{
        id: "legacy-indexeddb-disc",
        setName: "旧 IndexedDB 盘",
        partition: 1,
        rarity: "S",
        level: 15,
        mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
        subStats: [],
      }],
      driveDiscLoadouts: [],
    }]])
    const openCalls: Array<[string, number]> = []
    const transactionCalls: Array<[string, string]> = []
    const database = {
      objectStoreNames: { contains: (name: string) => name === "state" },
      createObjectStore: vi.fn(),
      transaction(name: string, mode: string) {
        transactionCalls.push([name, mode])
        return {
          objectStore(storeName: string) {
            expect(storeName).toBe("state")
            return {
              get(key: string) {
                return asyncRequest(records.get(key))
              },
              put(value: any, key: string) {
                records.set(key, value)
                return asyncRequest(key)
              },
            }
          },
        }
      },
    }
    vi.stubGlobal("indexedDB", {
      open(name: string, version: number) {
        openCalls.push([name, version])
        return asyncRequest(database)
      },
    })

    const localStore = await import("@runtime/local-store.js?indexeddb-compat")
    const loaded = await localStore.loadCurrentUserDriveDiscStore()
    expect(loaded.driveDiscs[0].id).toBe("legacy-indexeddb-disc")
    expect(loaded.driveDiscs[0].contentFingerprint).toBeTruthy()

    await localStore.upsertUserDriveDisc({
      id: "new-indexeddb-disc",
      setName: "新盘",
      partition: 2,
      rarity: "S",
      level: 15,
      mainStat: { stat: "atkFlat", mode: "flat", value: 316 },
      subStats: [],
    })

    expect(openCalls).toEqual([["zzz-calculator-user-store", 1]])
    expect(transactionCalls).toContainEqual(["state", "readonly"])
    expect(transactionCalls).toContainEqual(["state", "readwrite"])
    expect(records.get("userDriveDiscStore").driveDiscs).toHaveLength(2)
  })
})
