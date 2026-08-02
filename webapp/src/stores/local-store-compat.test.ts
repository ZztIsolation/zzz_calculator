import { describe, expect, it, vi } from "vitest"
import {
  createAccount,
  driveDiscContentFingerprint,
  driveDiscIdentityFingerprint,
  importScannerExportToStore,
  loadCurrentUserDriveDiscStore,
  loadUserDriveDiscStore,
  previewScannerExportImport,
  setDriveDiscExclusions,
  setDriveDiscReservations,
  switchAccount,
  upsertUserDriveDisc,
} from "@runtime/local-store.js"

function persistedDisc(input: Record<string, any>) {
  const disc = {
    reservedForAgentId: null,
    excludedForAgentIds: [],
    ...input,
  }
  return {
    ...disc,
    contentFingerprint: driveDiscContentFingerprint(disc),
    identityFingerprint: driveDiscIdentityFingerprint(disc),
  }
}

describe("local-store compatibility", () => {
  it("loads the existing localStorage fallback schema without migration", async () => {
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [{ ownerId: "default", sourcePath: "fixture.json" }],
      driveDiscs: [{
        id: "disc-a",
        setId: "woodpecker_electro",
        partition: 1,
        mainStat: { stat: "hpFlat", value: 2200 },
        subStats: [],
      }],
      driveDiscLoadouts: [{ id: "loadout-a", ownerId: "default", name: "套装 A" }],
    }))

    const store = await loadCurrentUserDriveDiscStore()
    expect(store.driveDiscs).toHaveLength(1)
    expect(store.driveDiscs[0].reservedForAgentId).toBeNull()
    expect(store.driveDiscs[0].excludedForAgentIds).toEqual([])
    expect(store.driveDiscLoadouts).toHaveLength(1)
    expect(store.imports).toHaveLength(1)
  })

  it("keeps the storage key and isolates duplicate ids by account", async () => {
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }))

    await upsertUserDriveDisc({
      id: "shared-id",
      setName: "默认账号盘",
      partition: 1,
      rarity: "S",
      level: 15,
      mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
      subStats: [],
    })
    await createAccount({ id: "alt", label: "二号账号" })
    await switchAccount("alt")
    await upsertUserDriveDisc({
      id: "shared-id",
      setName: "二号账号盘",
      partition: 1,
      rarity: "S",
      level: 15,
      mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
      subStats: [],
    })

    expect((await loadCurrentUserDriveDiscStore()).driveDiscs[0].setName).toBe("二号账号盘")
    await switchAccount("default")
    expect((await loadCurrentUserDriveDiscStore()).driveDiscs[0].setName).toBe("默认账号盘")

    const fullStore = await loadUserDriveDiscStore()
    expect(fullStore.driveDiscs).toHaveLength(2)
    expect(localStorage.getItem("zzz-calculator.userStore.v1")).not.toBeNull()
  })

  it("round-trips reservations through the existing fallback key", async () => {
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [{
        id: "fallback-reserved",
        ownerId: "default",
        setName: "旧数据盘",
        partition: 1,
        rarity: "S",
        level: 15,
        mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
        subStats: [],
      }],
      driveDiscLoadouts: [],
    }))

    await setDriveDiscReservations({ discIds: ["fallback-reserved"], reservedForAgentId: "agent-a" })
    const raw = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(raw.driveDiscs[0].reservedForAgentId).toBe("agent-a")
    expect((await loadCurrentUserDriveDiscStore()).driveDiscs[0].reservedForAgentId).toBe("agent-a")
  })

  it("round-trips exclusions through the existing fallback key", async () => {
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [{
        id: "fallback-excluded",
        ownerId: "default",
        setName: "旧数据盘",
        partition: 1,
        rarity: "S",
        level: 15,
        mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
        subStats: [],
      }],
      driveDiscLoadouts: [],
    }))

    await setDriveDiscExclusions({
      discIds: ["fallback-excluded"],
      excludedForAgentId: "retired-agent",
      excluded: true,
    })
    const raw = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(raw.version).toBe(1)
    expect(raw.driveDiscs[0].excludedForAgentIds).toEqual(["retired-agent"])
    expect((await loadCurrentUserDriveDiscStore()).driveDiscs[0].excludedForAgentIds).toEqual(["retired-agent"])
  })

  it("previews native imports without rewriting localStorage or unrelated sentinels", async () => {
    localStorage.clear()
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
    const rawBeforePreview = JSON.stringify(persisted)
    const currentAccountBeforePreview = "default"
    const homeSelectionBeforePreview = JSON.stringify({ byOwner: { default: { currentAgentId: "agent-a" } } })
    const buildBeforePreview = JSON.stringify({ version: 1, sentinel: "build" })
    const optimizerBeforePreview = JSON.stringify({ version: 3, algorithm: "exact-super-bound" })
    localStorage.setItem("zzz-calculator.userStore.v1", rawBeforePreview)
    localStorage.setItem("zzz-calculator.currentAccount.v1", currentAccountBeforePreview)
    localStorage.setItem("zzz-calculator.homeSelection.v1", homeSelectionBeforePreview)
    localStorage.setItem("zzz-calculator.webapp.build.v1", buildBeforePreview)
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", optimizerBeforePreview)
    localStorage.setItem("zzz-calculator.preview-sentinel", "preserve-me")

    const storagePrototype = Object.getPrototypeOf(localStorage)
    const setItem = vi.spyOn(storagePrototype, "setItem")
    const removeItem = vi.spyOn(storagePrototype, "removeItem")
    const clear = vi.spyOn(storagePrototype, "clear")
    try {
      const preview = await previewScannerExportImport({
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
      expect(setItem).not.toHaveBeenCalled()
      expect(removeItem).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()
      expect(localStorage.getItem("zzz-calculator.userStore.v1")).toBe(rawBeforePreview)
      expect(localStorage.getItem("zzz-calculator.currentAccount.v1")).toBe(currentAccountBeforePreview)
      expect(localStorage.getItem("zzz-calculator.homeSelection.v1")).toBe(homeSelectionBeforePreview)
      expect(localStorage.getItem("zzz-calculator.webapp.build.v1")).toBe(buildBeforePreview)
      expect(localStorage.getItem("zzz-calculator.webapp.optimizer.v1")).toBe(optimizerBeforePreview)
      expect(localStorage.getItem("zzz-calculator.preview-sentinel")).toBe("preserve-me")
    } finally {
      setItem.mockRestore()
      removeItem.mockRestore()
      clear.mockRestore()
    }
  })

  it("confirms a native import once without Object.hasOwn while preserving other browser data", async () => {
    localStorage.clear()
    const defaultExisting = persistedDisc({
      id: "default-existing",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "Existing default disc",
      partition: 1,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
      subStats: [],
    })
    const altExisting = persistedDisc({
      id: "alt-existing",
      ownerId: "alt",
      setId: "swing_jazz",
      setName: "Existing alt disc",
      partition: 2,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "atkFlat", mode: "flat", value: 316 },
      subStats: [],
    })
    const owners = [
      { id: "default", label: "Default" },
      { id: "alt", label: "Alt" },
    ]
    const existingImport = { id: "existing-import", ownerId: "alt", itemCount: 1 }
    const altLoadout = { id: "alt-loadout", ownerId: "alt", driveDiscIdsBySlot: { 2: "alt-existing" } }
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners,
      imports: [existingImport],
      driveDiscs: [defaultExisting, altExisting],
      driveDiscLoadouts: [altLoadout],
      settingsSentinel: { preserve: true },
    }))
    const currentAccount = "default"
    const homeSelection = JSON.stringify({ byOwner: { alt: { currentAgentId: "agent-b" } } })
    const buildSettings = JSON.stringify({ version: 1, sentinel: "build" })
    const optimizerSettings = JSON.stringify({ version: 3, algorithm: "exact-super-bound" })
    localStorage.setItem("zzz-calculator.currentAccount.v1", currentAccount)
    localStorage.setItem("zzz-calculator.homeSelection.v1", homeSelection)
    localStorage.setItem("zzz-calculator.webapp.build.v1", buildSettings)
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", optimizerSettings)

    const originalHasOwnDescriptor = Object.getOwnPropertyDescriptor(Object, "hasOwn")
    const storagePrototype = Object.getPrototypeOf(localStorage)
    const setItem = vi.spyOn(storagePrototype, "setItem")
    const removeItem = vi.spyOn(storagePrototype, "removeItem")
    const clear = vi.spyOn(storagePrototype, "clear")
    try {
      expect(delete Object.hasOwn).toBe(true)
      expect(Object.hasOwn).toBeUndefined()

      const result = await importScannerExportToStore({
        format: "zzz-calculator-drive-disc-export",
        version: 1,
        exportedAt: "2026-08-03T00:00:00.000Z",
        sourceAccount: { label: "Imported" },
        driveDiscs: [{
          id: "native-new",
          setId: "hormone_punk",
          setName: "New native disc",
          partition: 3,
          rarity: "S",
          level: 15,
          maxLevel: 15,
          mainStat: { stat: "defFlat", mode: "flat", value: 184 },
          subStats: [],
        }],
      }, {
        ownerId: "default",
        sourcePath: "compatibility.json",
        importedAt: "2026-08-03T00:01:00.000Z",
        removeMissing: false,
      })

      expect(result.lastImportSummary).toMatchObject({ added: 1, removed: 0 })
      expect(setItem).toHaveBeenCalledTimes(1)
      expect(setItem).toHaveBeenCalledWith("zzz-calculator.userStore.v1", expect.any(String))
      expect(removeItem).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()

      const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
      expect(persisted.version).toBe(1)
      expect(persisted.currentOwnerId).toBe("default")
      expect(persisted.owners).toEqual(owners)
      expect(persisted.imports).toHaveLength(2)
      expect(persisted.imports[0]).toEqual(existingImport)
      expect(persisted.imports[1]).toMatchObject({ ownerId: "default", type: "zzz-calculator-drive-disc-export" })
      expect(persisted.driveDiscs).toHaveLength(3)
      expect(persisted.driveDiscs.find((disc: any) => disc.id === "default-existing")).toEqual(defaultExisting)
      expect(persisted.driveDiscs.find((disc: any) => disc.id === "alt-existing")).toEqual(altExisting)
      expect(persisted.driveDiscs).toContainEqual(expect.objectContaining({ id: "native-new", ownerId: "default" }))
      expect(persisted.driveDiscLoadouts).toEqual([altLoadout])
      expect(persisted.settingsSentinel).toEqual({ preserve: true })
      expect(localStorage.getItem("zzz-calculator.currentAccount.v1")).toBe(currentAccount)
      expect(localStorage.getItem("zzz-calculator.homeSelection.v1")).toBe(homeSelection)
      expect(localStorage.getItem("zzz-calculator.webapp.build.v1")).toBe(buildSettings)
      expect(localStorage.getItem("zzz-calculator.webapp.optimizer.v1")).toBe(optimizerSettings)
    } finally {
      if (originalHasOwnDescriptor) {
        Object.defineProperty(Object, "hasOwn", originalHasOwnDescriptor)
      } else {
        delete Object.hasOwn
      }
      setItem.mockRestore()
      removeItem.mockRestore()
      clear.mockRestore()
    }

    expect(Object.getOwnPropertyDescriptor(Object, "hasOwn")).toEqual(originalHasOwnDescriptor)
  })
})
