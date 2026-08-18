import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { useAccountStore } from "@/stores/account"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
  WEBAPP_BUILD_STORAGE_KEY,
} from "@runtime/build-storage"
import { loadUserDriveDiscStoreFresh } from "@runtime/local-store.js"
import { HOME_SELECTION_STORAGE_KEY } from "@runtime/selection-storage.js"

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
