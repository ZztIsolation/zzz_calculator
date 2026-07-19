import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { useCatalogStore } from "@/stores/catalog"

describe("catalog store display collections", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("keeps raw collections separate from workbench display collections", () => {
    const store = useCatalogStore()
    store.$patch({
      catalog: {
        driveDiscSets: [{ id: "visible_set" }, { id: "hidden_set" }],
        displayDriveDiscSets: [{ id: "visible_set" }],
      },
      meta: {
        agents: [{ id: "visible_agent" }, { id: "hidden_agent" }],
        displayAgents: [{ id: "visible_agent" }],
        agentSkills: [{ id: "visible_skill" }, { id: "hidden_skill" }],
        displayAgentSkills: [{ id: "visible_skill" }],
        wEngines: [{ id: "visible_engine" }, { id: "hidden_engine" }],
        displayWEngines: [{ id: "visible_engine" }],
      },
    })

    expect(store.agents.map((item: any) => item.id)).toEqual(["visible_agent", "hidden_agent"])
    expect(store.displayAgents.map((item: any) => item.id)).toEqual(["visible_agent"])
    expect(store.displayAgentSkills.map((item: any) => item.id)).toEqual(["visible_skill"])
    expect(store.wEngines.map((item: any) => item.id)).toEqual(["visible_engine", "hidden_engine"])
    expect(store.displayWEngines.map((item: any) => item.id)).toEqual(["visible_engine"])
    expect(store.driveDiscSets.map((item: any) => item.id)).toEqual(["visible_set", "hidden_set"])
    expect(store.displayDriveDiscSets.map((item: any) => item.id)).toEqual(["visible_set"])
  })
})
