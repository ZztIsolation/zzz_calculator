import { describe, expect, it } from "vitest"
import { loadCurrentUserDriveDiscStore } from "@core/local-store.js"

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
        ownerId: "default",
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
})
