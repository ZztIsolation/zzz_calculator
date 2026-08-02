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
    expect(loaded.driveDiscs[0].reservedForAgentId).toBeNull()
    expect(loaded.driveDiscs[0].excludedForAgentIds).toEqual([])
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

    await localStore.setDriveDiscReservations({
      discIds: ["legacy-indexeddb-disc"],
      reservedForAgentId: "agent-a",
    })
    expect(records.get("userDriveDiscStore").driveDiscs
      .find((disc: any) => disc.id === "legacy-indexeddb-disc").reservedForAgentId).toBe("agent-a")

    await localStore.setDriveDiscExclusions({
      discIds: ["new-indexeddb-disc"],
      excludedForAgentId: "retired-agent",
      excluded: true,
    })
    expect(records.get("userDriveDiscStore").version).toBe(1)
    expect(records.get("userDriveDiscStore").driveDiscs
      .find((disc: any) => disc.id === "new-indexeddb-disc").excludedForAgentIds).toEqual(["retired-agent"])
  })

  it("previews native imports through a readonly IndexedDB transaction without writing", async () => {
    const persisted = {
      version: 1,
      currentOwnerId: "default",
      owners: [
        { id: "default", label: "Default" },
        { id: "alt", label: "Alt" },
      ],
      imports: [{ id: "existing-import", ownerId: "alt" }],
      driveDiscs: [
        {
          id: "default-existing",
          ownerId: "default",
          setName: "Existing default disc",
          partition: 1,
          rarity: "S",
          level: 15,
          mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
          subStats: [],
        },
        {
          id: "alt-existing",
          ownerId: "alt",
          setName: "Existing alt disc",
          partition: 2,
          rarity: "S",
          level: 15,
          mainStat: { stat: "atkFlat", mode: "flat", value: 316 },
          subStats: [],
        },
      ],
      driveDiscLoadouts: [{ id: "alt-loadout", ownerId: "alt", driveDiscIdsBySlot: { 2: "alt-existing" } }],
      settingsSentinel: { preserve: true },
    }
    const records = new Map<string, any>([["userDriveDiscStore", persisted]])
    const persistedSnapshot = structuredClone(persisted)
    const openCalls: Array<[string, number]> = []
    const transactionCalls: Array<[string, string]> = []
    const put = vi.fn((value: any, key: string) => {
      records.set(key, value)
      return asyncRequest(key)
    })
    const deleteDatabase = vi.fn(() => asyncRequest())
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
              put,
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
      deleteDatabase,
    })

    const localStore = await import("@runtime/local-store.js?indexeddb-preview")
    const preview = await localStore.previewScannerExportImport({
      format: "zzz-calculator-drive-disc-export",
      version: 1,
      exportedAt: "2026-08-03T00:00:00.000Z",
      sourceAccount: { label: "Imported" },
      driveDiscs: [{
        id: "native-new",
        setName: "New native disc",
        partition: 3,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat: { stat: "defFlat", mode: "flat", value: 184 },
        subStats: [],
      }],
    }, { ownerId: "default", removeMissing: true })

    expect(preview.summary.added).toBe(1)
    expect(preview.summary.removed).toBe(1)
    expect(openCalls).toEqual([["zzz-calculator-user-store", 1]])
    expect(transactionCalls).toEqual([["state", "readonly"]])
    expect(put).not.toHaveBeenCalled()
    expect(deleteDatabase).not.toHaveBeenCalled()
    expect(database.createObjectStore).not.toHaveBeenCalled()
    expect(records.get("userDriveDiscStore")).toEqual(persistedSnapshot)
    expect(records.get("userDriveDiscStore").version).toBe(1)
  })

  it("closes and deletes IndexedDB while clearing calculator storage keys", async () => {
    const close = vi.fn()
    const database: any = {
      close,
      objectStoreNames: { contains: () => true },
      transaction() {
        return { objectStore: () => ({ get: () => asyncRequest(null) }) }
      },
    }
    const deleteCalls: string[] = []
    vi.stubGlobal("indexedDB", {
      open: () => asyncRequest(database),
      deleteDatabase(name: string) {
        deleteCalls.push(name)
        return asyncRequest()
      },
    })
    localStorage.setItem("zzz-calculator.webapp.build.v1", "{}")
    localStorage.setItem("zzz_maintenance_vue_draft_v3", "{}")
    localStorage.setItem("unrelated-key", "keep")

    const localStore = await import("@runtime/local-store.js?indexeddb-clear")
    await localStore.loadUserDriveDiscStore()
    await localStore.clearAllBrowserData()

    expect(close).toHaveBeenCalled()
    expect(deleteCalls).toEqual(["zzz-calculator-user-store"])
    expect(localStorage.getItem("zzz-calculator.webapp.build.v1")).toBeNull()
    expect(localStorage.getItem("zzz_maintenance_vue_draft_v3")).toBeNull()
    expect(localStorage.getItem("unrelated-key")).toBe("keep")
  })
})
