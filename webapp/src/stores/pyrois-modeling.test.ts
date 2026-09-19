import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { defaultBuffIdsFor, useBuildStore } from "./build"
import { currentAgentBuffCandidates } from "@/utils/combatBuffs"
import { storedEffectRuleText } from "@core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const read = (name: string) => JSON.parse(readFileSync(path.join(rootDir, "data", `${name}.json`), "utf8"))
const agent = read("agents").agents.find((a: any) => a.id === "pyrois")
const engine = read("w_engines").wEngines.find((e: any) => e.id === "zzz_wiki_2031")
const skills = read("agent_skills").agentSkills.find((a: any) => a.id === "pyrois")
const meta = { agents: [agent], wEngines: [engine], agentSkills: [skills], combatBuffs: [] }
const states = ["mirage", "sunflare", "contamination"].map(id => `agent:pyrois.skill.${id}`)

describe("Pyrois configuration", () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it("defaults to one light 3+4 example, and keeps all optional conditions off", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    expect(store.coreSkillLevel).toBe("F")
    expect(store.cinemaLevel).toBe(0)
    expect(store.wEngineId).toBe(engine.id)
    expect(store.damageConfig.events).toMatchObject([{ skillGroupId: "celestial_light_34", count: 1, stunned: false }])
    const ids = defaultBuffIdsFor(agent, 0, engine)
    expect(ids).toContain("agent:pyrois.corePassive")
    expect(ids).not.toContain("agent:pyrois.additionalAbility")
    states.forEach(id => expect(ids).not.toContain(id))
  })

  it("persists all four branches, counts, mixed stun flags and independent buff switches", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    const events = agent.skillGroups.filter((g: any) => g.id.startsWith("ultimate_")).map((g: any, i: number) => ({
      id: `ultimate_${i}`, kind: "skillGroup", skillGroupId: g.id, count: i + 1, stunned: i % 2 === 0,
    }))
    store.setDamageConfig({ ...store.damageConfig, mode: "custom", events, selectedEventId: events[3].id }, agent)
    store.applyBuffState({ selectedBuffIds: [...store.activeBuffIds(meta), ...states, "agent:pyrois.additionalAbility"] }, meta)
    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.damageConfig.events).toEqual(events)
    expect(restored.damageConfig.selectedEventId).toBe(events[3].id)
    states.forEach(id => expect(restored.activeBuffIds(meta)).toContain(id))
    restored.applyBuffState({ selectedBuffIds: restored.activeBuffIds(meta).filter(id => id !== states[0]) }, meta)
    expect(restored.activeBuffIds(meta)).not.toContain(states[0])
    expect(restored.activeBuffIds(meta)).toContain(states[1])
  })

  it("materializes skill-sourced core growth in the Buff picker", () => {
    for (const [level, damage, extra] of [["none", 20, 450], ["C", 30.2, 675], ["F", 40, 900]] as const) {
      const buffs = currentAgentBuffCandidates(meta, agent.id, 0, level)
      expect(buffs.find(b => b.id === states[1]).effects[0].value).toBe(damage)
      expect(buffs.find(b => b.id === states[2]).effects[0].value).toBe(extra)
    }
    const whitelistRule = engine.effect.selfBuff.effects[1]
    expect(storedEffectRuleText(whitelistRule, {}, engine.effect.selfBuff, meta)).toContain("仅限 佩洛伊斯")
  })

  it("adopts authored final levels on M3/M5 without accumulating bonuses on M6", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    expect(store.damageConfig.mode).toBe("adminDefault")
    store.setCinemaLevel(3, meta)
    expect(store.skillLevels.chain).toBe(14)
    store.setCinemaLevel(5, meta)
    expect(store.skillLevels.chain).toBe(16)
    store.setCinemaLevel(6, meta)
    expect(store.skillLevels.chain).toBe(16)
    expect(agent.cinemaDescriptions[5]).toMatchObject({ modeled: false })
  })
})
