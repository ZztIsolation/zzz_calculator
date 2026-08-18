import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAccountStore } from "@/stores/account"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
  WEBAPP_BUILD_STORAGE_KEY,
} from "@runtime/build-storage"
import { loadUserDriveDiscStoreFresh } from "@runtime/local-store.js"
import { CURRENT_ACCOUNT_STORAGE_KEY, HOME_SELECTION_STORAGE_KEY } from "@runtime/selection-storage.js"

const runtimeMocks = vi.hoisted(() => ({
  accountSummary: vi.fn(),
  actualAccountSummary: null as null | (() => Promise<any>),
  setCurrentAccountId: vi.fn(),
  actualSetCurrentAccountId: null as null | ((ownerId: string) => void),
}))

vi.mock("@runtime/local-store.js", async importOriginal => {
  const actual = await importOriginal<any>()
  runtimeMocks.actualAccountSummary = actual.accountSummary
  return { ...actual, accountSummary: runtimeMocks.accountSummary }
})

vi.mock("@runtime/selection-storage.js", async importOriginal => {
  const actual = await importOriginal<any>()
  runtimeMocks.actualSetCurrentAccountId = actual.setCurrentAccountId
  return { ...actual, setCurrentAccountId: runtimeMocks.setCurrentAccountId }
})

function selectionDocument() {
  return {
    version: 2,
    currentOwnerId: "default",
    byOwner: {
      default: { currentAgentId: "agent-a", byAgent: { "agent-a": { agentLevel: 60 } } },
      alt: { currentAgentId: "agent-b", byAgent: { "agent-b": { agentLevel: 50 } } },
    },
  }
}

describe("account store transactions", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    runtimeMocks.accountSummary.mockReset()
    runtimeMocks.accountSummary.mockImplementation(() => runtimeMocks.actualAccountSummary!())
    runtimeMocks.setCurrentAccountId.mockReset()
    runtimeMocks.setCurrentAccountId.mockImplementation(ownerId => runtimeMocks.actualSetCurrentAccountId!(ownerId))
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认账号" }, { id: "alt", label: "待删除账号" }],
      imports: [{ id: "import-alt", ownerId: "alt" }],
      driveDiscs: [{ id: "disc-alt", ownerId: "alt" }],
      driveDiscLoadouts: [{ id: "loadout-alt", ownerId: "alt" }],
      enkaImportState: {
        version: 1,
        byOwner: { alt: { binding: { uid: "1300000000" } } },
      },
    }))
    localStorage.setItem(WEBAPP_BUILD_STORAGE_KEY, JSON.stringify(selectionDocument()))
    localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify(selectionDocument()))
  })

  it("coalesces concurrent loading and exposes labels only after the account summary is ready", async () => {
    let resolveSummary: (value: any) => void = () => {}
    runtimeMocks.accountSummary.mockImplementationOnce(() => new Promise(resolve => { resolveSummary = resolve }))
    const accountStore = useAccountStore()

    expect(accountStore.loadState).toBe("idle")
    expect(accountStore.currentOwnerId).toBeNull()
    expect(accountStore.currentOwnerLabel).toBeNull()

    const first = accountStore.ensureLoaded()
    const second = accountStore.ensureLoaded()
    expect(runtimeMocks.accountSummary).toHaveBeenCalledOnce()
    expect(accountStore.loadState).toBe("loading")

    resolveSummary({
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认账号" }],
    })
    await Promise.all([first, second])

    expect(accountStore.loadState).toBe("ready")
    expect(accountStore.currentOwnerId).toBe("default")
    expect(accountStore.currentOwnerLabel).toBe("默认账号")
    expect(accountStore.ownerLabelById("default")).toBe("默认账号")
    expect(accountStore.ownerLabelById("missing")).toBeNull()
  })

  it("keeps the raw owner id hidden after a failed load and supports retry", async () => {
    runtimeMocks.accountSummary.mockRejectedValueOnce(new Error("IndexedDB unavailable"))
    const accountStore = useAccountStore()

    await expect(accountStore.ensureLoaded()).rejects.toThrow("IndexedDB unavailable")
    expect(accountStore.loadState).toBe("error")
    expect(accountStore.error).toBe("IndexedDB unavailable")
    expect(accountStore.currentOwnerId).toBeNull()
    expect(accountStore.currentOwnerLabel).toBeNull()

    runtimeMocks.accountSummary.mockResolvedValueOnce({
      currentOwnerId: "internal-owner-id",
      owners: [{ id: "internal-owner-id", label: "游戏账号" }],
    })
    await accountStore.ensureLoaded()
    expect(accountStore.loadState).toBe("ready")
    expect(accountStore.currentOwnerLabel).toBe("游戏账号")
  })

  it("fails closed when synchronizing the current account selection is unavailable", async () => {
    runtimeMocks.accountSummary.mockResolvedValueOnce({
      currentOwnerId: "internal-owner-id",
      owners: [{ id: "internal-owner-id", label: "myself" }],
    })
    runtimeMocks.setCurrentAccountId.mockImplementationOnce(() => {
      throw new DOMException("Storage access denied", "SecurityError")
    })
    const accountStore = useAccountStore()

    await expect(accountStore.ensureLoaded()).rejects.toThrow("Storage access denied")
    expect(accountStore.loadState).toBe("error")
    expect(accountStore.error).toBe("Storage access denied")
    expect(accountStore.currentOwnerId).toBeNull()
    expect(accountStore.currentOwnerLabel).toBeNull()
    expect(localStorage.getItem(CURRENT_ACCOUNT_STORAGE_KEY)).toBeNull()
  })

  it("updates the displayed label when switching accounts", async () => {
    const accountStore = useAccountStore()
    await accountStore.ensureLoaded()

    await accountStore.switchTo("alt")

    expect(accountStore.loadState).toBe("ready")
    expect(accountStore.currentOwnerId).toBe("alt")
    expect(accountStore.currentOwnerLabel).toBe("待删除账号")
    expect(localStorage.getItem(CURRENT_ACCOUNT_STORAGE_KEY)).toBe("alt")
  })

  it("stays locked after a mutation cannot synchronize selection and recovers on retry", async () => {
    const accountStore = useAccountStore()
    await accountStore.ensureLoaded()
    runtimeMocks.setCurrentAccountId.mockImplementationOnce(() => {
      throw new DOMException("Storage access denied", "SecurityError")
    })

    await expect(accountStore.rename("default", "myself")).rejects.toThrow("Storage access denied")
    expect(accountStore.loadState).toBe("error")
    expect(accountStore.currentOwnerLabel).toBe("默认账号")

    await accountStore.ensureLoaded({ force: true })
    expect(accountStore.loadState).toBe("ready")
    expect(accountStore.currentOwnerLabel).toBe("myself")
  })

  it("does not let a stale load overwrite a newer account mutation", async () => {
    let resolveSummary: (value: any) => void = () => {}
    runtimeMocks.accountSummary.mockImplementationOnce(() => new Promise(resolve => { resolveSummary = resolve }))
    const accountStore = useAccountStore()
    const staleLoad = accountStore.ensureLoaded()

    await accountStore.rename("default", "myself")
    expect(accountStore.currentOwnerLabel).toBe("myself")

    resolveSummary({
      currentOwnerId: "default",
      owners: [{ id: "default", label: "过期名称" }, { id: "alt", label: "待删除账号" }],
    })
    await staleLoad

    expect(accountStore.loadState).toBe("ready")
    expect(accountStore.currentOwnerLabel).toBe("myself")
  })

  it("deletes inventory, Enka binding, and both configuration documents atomically", async () => {
    const accountStore = useAccountStore()
    await accountStore.load()
    await accountStore.remove("alt")

    const persisted = await loadUserDriveDiscStoreFresh()
    expect(persisted.owners.map((owner: any) => owner.id)).toEqual(["default"])
    expect(persisted.driveDiscs).toEqual([])
    expect(persisted.driveDiscLoadouts).toEqual([])
    expect(persisted.imports).toEqual([])
    expect(persisted.enkaImportState?.byOwner?.alt).toBeUndefined()
    expect(readBuildSelectionDocument().byOwner.alt).toBeUndefined()
    expect(readLegacySelectionDocument().byOwner.alt).toBeUndefined()
    expect(accountStore.currentOwnerId).toBe("default")
  })
})
