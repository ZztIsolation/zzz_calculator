import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { useBuildStore } from "./build"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const read = (name: string) => JSON.parse(readFileSync(path.join(root, "data", `${name}.json`), "utf8"))
const ids = ["nekomata", "asaba_harumasa", "evelyn_chevalier"]
const agents = read("agents").agents.filter((a: any) => ids.includes(a.id))
const allEngines = read("w_engines").wEngines
const allSkills = read("agent_skills").agentSkills

describe("PR81 character defaults and saved overrides", () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
  for (const id of ids) {
    const agent = agents.find((a: any) => a.id === id)
    const engine = allEngines.find((e: any) => e.relatedAgentId === id)
    const meta = { agents: [agent], wEngines: [engine], agentSkills: allSkills.filter((a: any) => a.id === id), combatBuffs: [] }
    it(`${id} initializes defaults, preserves a manual event and disabled buffs after reload`, () => {
      const store = useBuildStore()
      store.initialize({}, meta)
      expect(store.agentId).toBe(id)
      expect(store.wEngineId).toBe(engine.id)
      expect(store.coreSkillLevel).toBe("F")
      expect(store.cinemaLevel).toBe(0)
      expect(store.potentialLevel).toBe(id === "evelyn_chevalier" ? 0 : 6)
      expect(store.damageConfig.mode).toBe("adminDefault")
      const core = `agent:${id}.corePassive`, extra = `agent:${id}.additionalAbility`
      expect(store.activeBuffIds(meta)).toContain(core)
      expect(store.activeBuffIds(meta).includes(extra)).toBe(id === "evelyn_chevalier")
      const events = [{ ...store.damageConfig.events[0], count: 3, stunned: false }]
      store.setDamageConfig({ ...store.damageConfig, mode: "custom", events, selectedEventId: events[0].id }, agent)
      store.applyBuffState({ selectedBuffIds: [], runtimeInputs: {} }, meta)
      setActivePinia(createPinia())
      const restored = useBuildStore()
      restored.initialize({}, meta)
      expect(restored.damageConfig.events).toEqual(events)
      expect(restored.activeBuffIds(meta)).toEqual([])
    })
    if (id !== "evelyn_chevalier") it(`${id} switches original/potential defaults without losing the authored groups`, () => {
      const store = useBuildStore()
      store.initialize({}, meta)
      const potentialEvents = JSON.parse(JSON.stringify(store.damageConfig.events))
      store.setPotentialLevel(0, meta)
      expect(store.damageConfig.events.some((e: any) => e.skillRef?.moveId === "claw_mark" || e.skillGroupId === "ultimate_full")).toBe(false)
      store.setPotentialLevel(6, meta)
      expect(store.damageConfig.events).toEqual(potentialEvents)
    })
  }
})
