import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { createPersonalBackup, previewPersonalRestore, restorePersonalBackup, recoverPersonalRestore, validatePersonalBackup } from "./personal-backup"
import { loadUserDriveDiscStoreFresh, saveUserDriveDiscStore } from "./local-store.js"

const KEY = "zzz-calculator.webapp.build.v1"
const FALLBACK = "zzz-calculator.userStore.v1"
beforeEach(async () => {
  localStorage.clear()
  await saveUserDriveDiscStore({ version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "A" }, { id: "alt", label: "B" }],
    driveDiscs: [{ id: "d1", ownerId: "default", setId: "woodpecker_electro", partition: 1, level: 15, mainStat: { stat: "hpFlat", value: 2200 }, subStats: [], equippedBy: "miyabi", reservedForAgentId: "miyabi" }],
    driveDiscLoadouts: [{ id: "l1", ownerId: "default", driveDiscIdsBySlot: { 1: "d1" } }], imports: [],
    enkaImportState: { version: 1, byOwner: { alt: { binding: { uid: "123456789" } } } }, futureField: { retain: true } })
  localStorage.setItem(KEY, JSON.stringify({ version: 2, byOwner: { default: { byAgent: { miyabi: { agentLevel: 60, combat: { activeBuffIds: ["test"] } } } } } }))
  localStorage.setItem("unrelated-site", "keep")
})
afterEach(() => vi.restoreAllMocks())

describe("complete personal backup", () => {
  it("round trips all accounts, references, binding and config without touching other site keys", async () => {
    const backup = await createPersonalBackup()
    const store = await loadUserDriveDiscStoreFresh()
    store.driveDiscs[0].level = 12
    await saveUserDriveDiscStore(store)
    localStorage.setItem(KEY, '{"version":2,"byOwner":{}}')
    await restorePersonalBackup(await previewPersonalRestore(backup))
    const restored = await createPersonalBackup()
    expect(restored.data.inventory.driveDiscs).toEqual(backup.data.inventory.driveDiscs)
    expect(restored.data.inventory.driveDiscLoadouts).toEqual(backup.data.inventory.driveDiscLoadouts)
    expect(restored.data.inventory.enkaImportState).toEqual(backup.data.inventory.enkaImportState)
    expect(restored.data.inventory.futureField).toEqual({ retain: true })
    expect(restored.data.localStorage).toEqual(backup.data.localStorage)
    expect(localStorage.getItem("unrelated-site")).toBe("keep")
  })

  it("rejects unknown formats, duplicate ids and broken configuration before writing", async () => {
    const backup = await createPersonalBackup()
    expect(() => validatePersonalBackup({ ...backup, version: 99 })).toThrow("v1")
    backup.data.inventory.driveDiscs.push(backup.data.inventory.driveDiscs[0])
    expect(() => validatePersonalBackup(backup)).toThrow("重复 ID")
    backup.data.inventory.driveDiscs.pop()
    backup.data.localStorage[0].value = "broken"
    expect(() => validatePersonalBackup(backup)).toThrow("无法解析")
  })

  it("rejects a stale preview and preserves subsequent edits", async () => {
    const plan = await previewPersonalRestore(await createPersonalBackup())
    localStorage.setItem(KEY, '{"changed":true}')
    await expect(restorePersonalBackup(plan)).rejects.toThrow("预览后数据已变化")
    expect(localStorage.getItem(KEY)).toBe('{"changed":true}')
  })

  it("rolls back a settings write failure and retains the original inventory", async () => {
    const backup = await createPersonalBackup()
    backup.data.localStorage[0].value = '{"changed":true}'
    const plan = await previewPersonalRestore(backup)
    const original = Storage.prototype.setItem
    let fail = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === KEY && fail) { fail = false; throw new Error("quota") }
      return original.call(this, key, value)
    })
    await expect(restorePersonalBackup(plan)).rejects.toThrow("quota")
    expect(localStorage.getItem(KEY)).toBe(plan.before.localStorage[0].value)
    expect((await loadUserDriveDiscStoreFresh()).personalDataRestore).toBeUndefined()
  })

  it("recovers an interrupted restore before normal application reads", async () => {
    const before = (await createPersonalBackup()).data
    await saveUserDriveDiscStore({ ...before.inventory, personalDataRestore: { version: 1, id: "interrupted", before } })
    localStorage.setItem(KEY, '{"partiallyApplied":true}')
    await recoverPersonalRestore()
    expect(localStorage.getItem(KEY)).toBe(before.localStorage[0].value)
    expect((await loadUserDriveDiscStoreFresh()).personalDataRestore).toBeUndefined()
  })

  it("allows an explicit backup restore of a corrupt fallback and preserves the raw recovery copy", async () => {
    const backup = await createPersonalBackup()
    localStorage.setItem(FALLBACK, "{broken-inventory")
    const plan = await previewPersonalRestore(backup)
    expect(plan.before.unreadableFallback).toBe("{broken-inventory")
    await restorePersonalBackup(plan)
    expect((await loadUserDriveDiscStoreFresh()).driveDiscs).toHaveLength(1)
    expect(plan.before.unreadableFallback).toBe("{broken-inventory")
  })
})
