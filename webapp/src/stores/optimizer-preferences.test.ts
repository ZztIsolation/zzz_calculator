import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { useOptimizerStore } from "@/stores/optimizer"
import agentData from "../../../data/agents.json"
import setData from "../../../data/drive_disc_sets.json"

const key = "zzz-calculator.webapp.optimizer.v1"
const catalog = { driveDiscSets: setData.sets }
const agents = agentData.agents.filter(agent => agent.preferredDriveDiscs)
function save(agentId: string, settings: any) {
  localStorage.setItem(key, JSON.stringify({ version: 4, currentAgentId: agentId, byAgent: { [agentId]: settings } }))
}
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })

describe("player optimizer preferences", () => {
  it.each([
    { mainStatLimits: { "4": "critRate" } },
    { mainStats: { "4": "critRate" } },
    { "4": "critRate" },
  ])("initializes scalar main-stat recommendations and preserves an explicit clear: %j", preferredDriveDiscs => {
    const agent = { id: "scalar-recommendation", preferredDriveDiscs }
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    expect(store.mainStatLimits["4"]).toEqual(["critRate"])
    store.setMainStatLimits({ "4": [] })
    store.loadAgentSettings(agent, catalog)
    expect(store.mainStatLimits["4"]).toEqual([])
  })

  it.each(agents)("preserves manual choices for $id across switching and reload", agent => {
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    store.setFourPieceSets(["woodpecker_electro"])
    store.setTwoPieceSetIds([])
    store.setMainStatLimits({ "4": [], "5": ["defPct"], "6": [] })
    store.applyAgentPreferredDriveDiscSet(agent, catalog)
    expect(store.fourPieceSetIds).toEqual(["woodpecker_electro"])
    const otherAgent = agents.find(item => item.id !== agent.id)!
    store.loadAgentSettings(otherAgent, catalog)
    store.loadAgentSettings(agent, catalog)
    setActivePinia(createPinia())
    const reloaded = useOptimizerStore()
    reloaded.initialize(catalog, agent)
    expect(reloaded.fourPieceSetIds).toEqual(["woodpecker_electro"])
    expect(reloaded.twoPieceSetIds).toEqual([])
    expect(reloaded.inputWithSettings({ agentId: agent.id }).settings.mainStatLimits)
      .toEqual({ "4": [], "5": ["defPct"], "6": [] })
  })

  it("initializes Ellen with all recommendations without restricting alternatives", () => {
    const agent = agentData.agents.find(agent => agent.id === "ellen_joe")!
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    expect(store.fourPieceSetIds).toEqual(["shadow_harmony", "polar_metal", "hormone_punk"])
    store.setFourPieceSets(["woodpecker_electro"])
    store.loadAgentSettings(agent, catalog)
    expect(store.fourPieceSetIds).toEqual(["woodpecker_electro"])
  })

  it("preserves Velina's legacy singular two-piece and main-stat choices", () => {
    const agent = agentData.agents.find(agent => agent.id === "velina")!
    save(agent.id, { fourPieceSetIds: ["woodpecker_electro"], twoPieceSetId: "hormone_punk", mainStatLimits: { "4": [], "5": ["defPct"], "6": ["energyRegen"] } })
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    expect(store.fourPieceSetIds).toEqual(["woodpecker_electro"])
    expect(store.twoPieceSetIds).toEqual(["hormone_punk"])
    expect(store.mainStatLimits).toEqual({ "4": [], "5": ["defPct"], "6": ["energyRegen"] })
  })

  it("retains an explicit empty four-piece choice instead of silently selecting a recommendation", () => {
    const agent = agentData.agents.find(agent => agent.id === "velina")!
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    store.setFourPieceSets([])
    store.loadAgentSettings(agent, catalog)
    expect(store.fourPieceSetIds).toEqual([])
    expect(store.fourPieceSetSource).toBe("manual")
  })

  it("shows initial main-stat recommendations but keeps clearing them after reload", () => {
    const agent = agentData.agents.find(agent => agent.id === "hoshimi_miyabi")!
    const store = useOptimizerStore()
    store.initialize(catalog, agent)
    expect(store.mainStatLimits).toEqual(agent.preferredDriveDiscs!.mainStatLimits)
    store.setMainStatLimits({ "4": [], "5": [], "6": [] })
    store.loadAgentSettings(agent, catalog)
    expect(store.mainStatLimits).toEqual({ "4": [], "5": [], "6": [] })
  })
})
