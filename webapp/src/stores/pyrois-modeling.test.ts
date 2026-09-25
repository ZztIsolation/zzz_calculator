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
const coreId = "agent:pyrois.corePassive"
const additionalId = "agent:pyrois.additionalAbility"
const legacyStates = ["mirage", "sunflare", "contamination"].map(id => `agent:pyrois.skill.${id}`)

describe("Pyrois configuration", () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it("uses the maintained default calculation with the core passive and additional ability active", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    expect(store.coreSkillLevel).toBe("F")
    expect(store.cinemaLevel).toBe(0)
    expect(store.wEngineId).toBe(engine.id)
    expect(store.damageConfig.events).toMatchObject(agent.defaultCalculationConfig.events)
    const ids = defaultBuffIdsFor(agent, 0, engine)
    expect(ids).toContain(coreId)
    expect(ids).toContain(additionalId)
    legacyStates.forEach(id => expect(ids).not.toContain(id))
  })

  it("persists all four branches and migrates legacy independent Buff IDs into the core passive", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    const events = agent.skillGroups.filter((g: any) => g.id.startsWith("ultimate_")).map((g: any, i: number) => ({
      id: `ultimate_${i}`, kind: "skillGroup", skillGroupId: g.id, count: i + 1, stunned: i % 2 === 0,
    }))
    store.setDamageConfig({ ...store.damageConfig, mode: "custom", events, selectedEventId: events.at(-1)?.id }, agent)
    store.applyBuffState({
      selectedBuffIds: [...store.activeBuffIds(meta), ...legacyStates],
      runtimeInputs: { [legacyStates[0]]: { coverage: 0.25 } },
    }, meta)
    expect(store.activeBuffIds(meta)).toContain(coreId)
    expect(store.activeBuffIds(meta)).toContain(additionalId)
    legacyStates.forEach(id => expect(store.activeBuffIds(meta)).not.toContain(id))
    legacyStates.forEach(id => expect(store.runtimeInputs[id]).toBeUndefined())
    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.damageConfig.events).toEqual(events)
    expect(restored.damageConfig.selectedEventId).toBe(events.at(-1)?.id)
    expect(restored.activeBuffIds(meta)).toContain(coreId)
    expect(restored.activeBuffIds(meta)).toContain(additionalId)
    legacyStates.forEach(id => expect(restored.activeBuffIds(meta)).not.toContain(id))
  })

  it("materializes skill-sourced core growth in the Buff picker", () => {
    for (const [level, damage, extra] of [["none", 20, 450], ["C", 30.2, 675], ["F", 40, 900]] as const) {
      const buffs = currentAgentBuffCandidates(meta, agent.id, 0, level)
      const core = buffs.find(b => b.id === coreId)
      expect(core?.effects.find((effect: any) => effect.id === "sunflare-damage")?.value).toBe(damage)
      expect(core?.effects.find((effect: any) => effect.id === "contamination-multiplier")?.value).toBe(extra)
    }
    const buffs = currentAgentBuffCandidates(meta, agent.id, 0, "F")
    expect(buffs.find(b => b.id === coreId)?.description.zhCN).toContain("万军诛绝")
    expect(buffs.find(b => b.id === coreId)?.description.zhCN).toContain("永陷幽囚")
    expect(buffs.find(b => b.id === additionalId)?.description.zhCN).toBe("队伍中存在击破或支援角色时，佩洛伊斯的暴击伤害提升40%。")
    const whitelistRule = engine.effect.selfBuff.effects[1]
    expect(storedEffectRuleText(whitelistRule, {}, engine.effect.selfBuff, meta)).toContain("仅限 佩洛伊斯")
  })

  it("adopts authored final levels on M3/M5 without accumulating bonuses on M6", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    expect(store.damageConfig.mode).toBe("adminDefault")
    const initialChainLevel = store.skillLevels.chain
    store.setCinemaLevel(3, meta)
    const cinema3ChainLevel = store.skillLevels.chain
    store.setCinemaLevel(5, meta)
    const cinema5ChainLevel = store.skillLevels.chain
    store.setCinemaLevel(6, meta)
    const cinema6ChainLevel = store.skillLevels.chain
    if (agent.defaultCalculationConfig.skillLevelsByCategory?.chain !== undefined) {
      expect(initialChainLevel).toBe(12)
      expect(cinema3ChainLevel).toBe(14)
      expect(cinema5ChainLevel).toBe(16)
      expect(cinema6ChainLevel).toBe(16)
    } else {
      expect(cinema3ChainLevel).toBe(initialChainLevel)
      expect(cinema5ChainLevel).toBe(initialChainLevel)
      expect(cinema6ChainLevel).toBe(initialChainLevel)
    }
    expect(agent.cinemaDescriptions[5]).toMatchObject({ modeled: false })
  })
})
