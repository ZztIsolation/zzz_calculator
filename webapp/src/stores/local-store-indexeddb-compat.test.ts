import { afterEach, describe, expect, it, vi } from "vitest"

function asyncRequest(result: unknown = undefined) {
  const request: any = { result, error: null }
  queueMicrotask(() => request.onsuccess?.())
  return request
}

function asyncTransaction(createStore: (scheduleComplete: () => void) => any) {
  const transaction: any = {}
  let completionScheduled = false
  const scheduleComplete = () => {
    if (completionScheduled) return
    completionScheduled = true
    setTimeout(() => transaction.oncomplete?.(), 0)
  }
  transaction.objectStore = () => createStore(scheduleComplete)
  return transaction
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
        return asyncTransaction(scheduleComplete => ({
          get(key: string) {
            scheduleComplete()
            return asyncRequest(records.get(key))
          },
          put(value: any, key: string) {
            records.set(key, value)
            scheduleComplete()
            return asyncRequest(key)
          },
        }))
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

  it("migrates legacy scanner set ids in place once while preserving the IndexedDB contract", async () => {
    const vowDisc = {
      id: "indexeddb-vow-disc",
      ownerId: "default",
      setId: "scanner-set-62cbf3b10eb2",
      setName: "谶羽之誓",
      partition: 1,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      locked: true,
      equippedBy: "agent-a",
      reservedForAgentId: "agent-b",
      excludedForAgentIds: ["agent-c"],
      mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
      subStats: [{ stat: "anomalyProficiency", mode: "flat", value: 27 }],
      contentFingerprint: "content-fingerprint-sentinel",
      identityFingerprint: "identity-fingerprint-sentinel",
      source: { type: "zzz-scanner", importId: "indexeddb-import" },
      raw: { "名称": "谶羽之誓" },
      futureDiscField: { preserve: true },
    }
    const thornDisc = {
      ...vowDisc,
      id: "indexeddb-thorn-disc",
      ownerId: "alt",
      setId: "scanner-set-7645cfcb962e",
      setName: "棘刺玫瑰",
      partition: 2,
      locked: false,
      equippedBy: null,
      reservedForAgentId: null,
      excludedForAgentIds: [],
      raw: { "名称": "棘刺玫瑰" },
    }
    const unknownDisc = {
      ...vowDisc,
      id: "indexeddb-unknown-disc",
      setId: "scanner-set-future",
      setName: "未来未知套装",
      partition: 3,
    }
    const persisted = {
      version: 1,
      updatedAt: "2026-08-03T00:00:00.000Z",
      currentOwnerId: "default",
      owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "二号账号" },
      ],
      imports: [{ id: "indexeddb-import", ownerId: "default" }],
      driveDiscs: [vowDisc, thornDisc, unknownDisc],
      driveDiscLoadouts: [{
        id: "indexeddb-loadout",
        ownerId: "default",
        driveDiscIdsBySlot: { 1: "indexeddb-vow-disc", 2: "indexeddb-thorn-disc" },
      }],
      futureStoreField: { preserve: true },
    }
    const records = new Map<string, any>([["userDriveDiscStore", persisted]])
    const openCalls: Array<[string, number]> = []
    const transactionCalls: Array<[string, string]> = []
    const put = vi.fn((value: any, key: string) => {
      records.set(key, value)
      return asyncRequest(key)
    })
    const database = {
      objectStoreNames: { contains: (name: string) => name === "state" },
      createObjectStore: vi.fn(),
      transaction(name: string, mode: string) {
        transactionCalls.push([name, mode])
        return asyncTransaction(scheduleComplete => ({
          get(key: string) {
            scheduleComplete()
            return asyncRequest(records.get(key))
          },
          put(value: any, key: string) {
            scheduleComplete()
            return put(value, key)
          },
        }))
      },
    }
    vi.stubGlobal("indexedDB", {
      open(name: string, version: number) {
        openCalls.push([name, version])
        return asyncRequest(database)
      },
    })

    const localStore = await import("@runtime/local-store.js?indexeddb-set-alias-migration")
    const [first, concurrent] = await Promise.all([
      localStore.loadUserDriveDiscStore(),
      localStore.loadUserDriveDiscStore(),
    ])
    expect(concurrent.driveDiscs).toEqual(first.driveDiscs)
    expect(first.driveDiscs.find((disc: any) => disc.id === "indexeddb-vow-disc")?.setId).toBe("zzz_wiki_2116")
    expect(first.driveDiscs.find((disc: any) => disc.id === "indexeddb-thorn-disc")?.setId).toBe("zzz_wiki_2121")
    expect(first.driveDiscs.find((disc: any) => disc.id === "indexeddb-unknown-disc")?.setId).toBe("scanner-set-future")
    expect(openCalls).toEqual([["zzz-calculator-user-store", 1]])
    expect(transactionCalls).toEqual([
      ["state", "readwrite"],
    ])
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith(expect.any(Object), "userDriveDiscStore")
    expect(database.createObjectStore).not.toHaveBeenCalled()

    const migrated = records.get("userDriveDiscStore")
    const migratedVow = migrated.driveDiscs.find((disc: any) => disc.id === "indexeddb-vow-disc")
    const { setId: _oldVowId, ...vowWithoutSetId } = vowDisc
    const { setId: _newVowId, canonicalSetName: _vowCanonicalName, ...migratedVowWithoutIdentity } = migratedVow
    expect(migratedVowWithoutIdentity).toEqual(vowWithoutSetId)
    expect(migratedVow.setId).toBe("zzz_wiki_2116")
    expect(migratedVow.canonicalSetName).toEqual({ zhCN: "谶羽之誓" })
    expect(migrated.driveDiscs.find((disc: any) => disc.id === "indexeddb-thorn-disc")?.canonicalSetName)
      .toEqual({ zhCN: "棘刺玫瑰" })
    expect(migrated.version).toBe(1)
    expect(migrated.updatedAt).toBe(persisted.updatedAt)
    expect(migrated.owners).toEqual(persisted.owners)
    expect(migrated.imports).toEqual(persisted.imports)
    expect(migrated.driveDiscLoadouts).toEqual(persisted.driveDiscLoadouts)
    expect(migrated.futureStoreField).toEqual({ preserve: true })

    await localStore.loadUserDriveDiscStore()
    expect(transactionCalls).toEqual([
      ["state", "readwrite"],
      ["state", "readwrite"],
    ])
    expect(put).toHaveBeenCalledTimes(1)
  })

  it("repairs corrupted version-2 Enka percent stats once without changing Scanner data", async () => {
    const corruptedEnkaDisc = {
      id: "indexeddb-corrupted-enka-disc",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 4,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      statUnitVersion: 2,
      mainStat: { stat: "critRate", mode: "pct", value: 2400 },
      subStats: [
        { stat: "critDmg", mode: "pct", value: 480 },
        { stat: "atkPct", mode: "pct", value: 3 },
        { stat: "atkFlat", mode: "flat", value: 57 },
      ],
      source: {
        type: "enka-zzz-showcase",
        uid: "123456789",
        equipmentUid: "enka-equipment-1",
      },
      provenance: {
        version: 1,
        enkaZzz: {
          uid: "123456789",
          equipmentUid: "enka-equipment-1",
        },
      },
      futureDiscField: { preserve: "enka" },
    }
    const scannerDisc = {
      id: "indexeddb-normal-scanner-disc",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 5,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      statUnitVersion: 2,
      mainStat: { stat: "electricDmg", mode: "pct", value: 30 },
      subStats: [
        { stat: "critRate", mode: "pct", value: 4.8 },
        { stat: "atkFlat", mode: "flat", value: 57 },
      ],
      source: { type: "zzz-scanner", importId: "scanner-import" },
      provenance: {
        version: 1,
        scanner: { lastImportId: "scanner-import" },
      },
      raw: { "来源": "Scanner" },
      futureDiscField: { preserve: "scanner" },
    }
    const persisted = {
      version: 1,
      updatedAt: "2026-08-24T00:00:00.000Z",
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [{ id: "scanner-import", ownerId: "default" }],
      driveDiscs: [corruptedEnkaDisc, scannerDisc],
      driveDiscLoadouts: [],
      futureStoreField: { preserve: true },
    }
    const records = new Map<string, any>([["userDriveDiscStore", persisted]])
    const transactionCalls: Array<[string, string]> = []
    const put = vi.fn((value: any, key: string) => {
      records.set(key, value)
      return asyncRequest(key)
    })
    const database = {
      objectStoreNames: { contains: (name: string) => name === "state" },
      createObjectStore: vi.fn(),
      transaction(name: string, mode: string) {
        transactionCalls.push([name, mode])
        return asyncTransaction(scheduleComplete => ({
          get(key: string) {
            scheduleComplete()
            return asyncRequest(records.get(key))
          },
          put(value: any, key: string) {
            scheduleComplete()
            return put(value, key)
          },
        }))
      },
    }
    vi.stubGlobal("indexedDB", {
      open() {
        return asyncRequest(database)
      },
    })

    const localStore = await import("@runtime/local-store.js?indexeddb-enka-stat-unit-migration")
    const [first, concurrent] = await Promise.all([
      localStore.loadUserDriveDiscStore(),
      localStore.loadUserDriveDiscStore(),
    ])

    const firstEnka = first.driveDiscs.find((disc: any) => disc.id === corruptedEnkaDisc.id)
    expect(firstEnka.statUnitVersion).toBe(2)
    expect(firstEnka.mainStat.value).toBe(24)
    expect(firstEnka.subStats).toEqual([
      expect.objectContaining({ stat: "critDmg", mode: "pct", value: 4.8 }),
      expect.objectContaining({ stat: "atkPct", mode: "pct", value: 3 }),
      expect.objectContaining({ stat: "atkFlat", mode: "flat", value: 57 }),
    ])
    expect(concurrent.driveDiscs).toEqual(first.driveDiscs)
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith(expect.any(Object), "userDriveDiscStore")

    const written = records.get("userDriveDiscStore")
    const writtenEnka = written.driveDiscs.find((disc: any) => disc.id === corruptedEnkaDisc.id)
    const writtenScanner = written.driveDiscs.find((disc: any) => disc.id === scannerDisc.id)
    expect(writtenEnka.mainStat.value).toBe(24)
    expect(writtenEnka.subStats[0].value).toBe(4.8)
    expect(writtenEnka.subStats[1].value).toBe(3)
    expect(writtenEnka.subStats[2].value).toBe(57)
    expect(writtenEnka.futureDiscField).toEqual({ preserve: "enka" })
    expect(writtenScanner.statUnitVersion).toBe(scannerDisc.statUnitVersion)
    expect(writtenScanner.mainStat).toEqual(scannerDisc.mainStat)
    expect(writtenScanner.subStats).toEqual(scannerDisc.subStats)
    expect(writtenScanner.source).toEqual(scannerDisc.source)
    expect(writtenScanner.provenance).toEqual(scannerDisc.provenance)
    expect(writtenScanner.futureDiscField).toEqual(scannerDisc.futureDiscField)
    expect(written.updatedAt).toBe(persisted.updatedAt)
    expect(written.imports).toEqual(persisted.imports)
    expect(written.futureStoreField).toEqual({ preserve: true })

    await localStore.loadUserDriveDiscStore()
    expect(transactionCalls).toEqual([
      ["state", "readwrite"],
      ["state", "readwrite"],
    ])
    expect(put).toHaveBeenCalledTimes(1)
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
        return asyncTransaction(scheduleComplete => ({
          get(key: string) {
            scheduleComplete()
            return asyncRequest(records.get(key))
          },
          put(value: any, key: string) {
            scheduleComplete()
            return put(value, key)
          },
        }))
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
    expect(transactionCalls).toEqual([["state", "readwrite"]])
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
        return asyncTransaction(scheduleComplete => ({
          get: () => {
            scheduleComplete()
            return asyncRequest(null)
          },
        }))
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
