import { describe, expect, it } from "vitest"
import {
  createAccount,
  loadCurrentUserDriveDiscStore,
  loadUserDriveDiscStore,
  switchAccount,
  upsertUserDriveDisc,
} from "@runtime/local-store.js"

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
})
