import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import * as persistence from "@runtime/local-store.js"
import { useInventoryStore } from "./inventory"

const key = "zzz-calculator.userStore.v1"
const initial = () => ({ version: 1, currentOwnerId: "default",
  owners: [{ id: "default", label: "A" }, { id: "alt", label: "B" }],
  imports: [], driveDiscLoadouts: [], driveDiscs: [
    { id: "a", ownerId: "default", setName: "测试盘", partition: 1, level: 15, statUnitVersion: 2,
      mainStat: { stat: "hpFlat", mode: "flat", value: 2200 }, subStats: [],
      reservedForAgentId: "agent-a", excludedForAgentIds: ["agent-b"] },
    { id: "b", ownerId: "alt", setName: "测试盘", partition: 2, level: 15, statUnitVersion: 2,
      mainStat: { stat: "atkFlat", mode: "flat", value: 316 }, subStats: [] },
  ] })

beforeEach(async () => {
  vi.stubGlobal("indexedDB", undefined)
  localStorage.clear()
  setActivePinia(createPinia())
  await persistence.saveUserDriveDiscStoreUnlocked(initial())
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("inventory navigation cache", () => {
  it("reuses an unchanged view, while explicit refresh always reads storage", async () => {
    const read = vi.spyOn(persistence, "loadCurrentUserDriveDiscStoreFresh")
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    const view = store.store
    await store.ensureLoaded("default")
    expect(store.store).toBe(view)
    expect(read).toHaveBeenCalledTimes(1)
    await store.load()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it("invalidates after in-tab writes and preserves restrictions", async () => {
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    const changed = initial()
    changed.driveDiscs[0].level = 12
    await persistence.saveUserDriveDiscStoreUnlocked(changed)
    await store.ensureLoaded("default")
    expect(store.driveDiscs[0]).toMatchObject({ level: 12, reservedForAgentId: "agent-a", excludedForAgentIds: ["agent-b"] })
  })

  it("requires explicit refresh for another tab's writes", async () => {
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    const changed = initial()
    changed.driveDiscs[0].level = 9
    localStorage.setItem(key, JSON.stringify(changed))
    await store.ensureLoaded("default")
    expect(store.driveDiscs[0].level).toBe(15)
    await store.load()
    expect(store.driveDiscs[0].level).toBe(9)
  })

  it("clears the old owner's view immediately and reloads the selected owner", async () => {
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    await persistence.switchAccount("alt")
    const pending = store.ensureLoaded("alt")
    expect(store.driveDiscs).toEqual([])
    await pending
    expect(store.driveDiscs.map((disc: any) => disc.id)).toEqual(["b"])
    await persistence.switchAccount("default")
    await store.ensureLoaded("default")
    expect(store.driveDiscs.map((disc: any) => disc.id)).toEqual(["a"])
  })

  it("does not trust a view after a failed write", async () => {
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    const read = vi.spyOn(persistence, "loadCurrentUserDriveDiscStoreFresh")
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disk full") })
    await expect(persistence.saveUserDriveDiscStoreUnlocked(initial())).rejects.toThrow("disk full")
    write.mockRestore()
    await store.ensureLoaded("default")
    expect(read).toHaveBeenCalledTimes(1)
  })

  it("ignores an older load completing after the latest load", async () => {
    let finishOld!: (value: any) => void
    vi.spyOn(persistence, "loadCurrentUserDriveDiscStoreFresh")
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce({ ...initial(), currentOwnerId: "alt", driveDiscs: [initial().driveDiscs[1]] })
    const store = useInventoryStore()
    const old = store.load()
    await store.load()
    finishOld(initial())
    await old
    expect(store.store.currentOwnerId).toBe("alt")
    expect(store.loading).toBe(false)
  })

  it("does not cache a read that overlaps a write", async () => {
    let finish!: (value: any) => void
    const read = vi.spyOn(persistence, "loadCurrentUserDriveDiscStoreFresh")
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const store = useInventoryStore()
    const pending = store.load()
    await persistence.saveUserDriveDiscStoreUnlocked(initial())
    finish(initial())
    await pending
    await store.ensureLoaded("default")
    expect(read).toHaveBeenCalledTimes(2)
  })

  it("retries errors and reloads a directly replaced view", async () => {
    const read = vi.spyOn(persistence, "loadCurrentUserDriveDiscStoreFresh")
      .mockRejectedValueOnce(new Error("read failed"))
    const store = useInventoryStore()
    await store.ensureLoaded("default")
    expect(store.error).toBe("read failed")
    await store.ensureLoaded("default")
    expect(store.error).toBe("")
    store.store = initial()
    await store.ensureLoaded("default")
    expect(read).toHaveBeenCalledTimes(3)
  })
})
