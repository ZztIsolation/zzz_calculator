import path from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { useBuildStore, defaultBuffIdsFor } from "./build"
import { currentAgentBuffCandidates } from "@/utils/combatBuffs"
import { prepareDraft } from "@/components/maintenance/maintenance-model"
import { materializeCorePassiveScalingEffect } from "@core/corePassiveScaling.js"
import { repairDynamicValueSourceFallbacks } from "@core/maintenanceValidation.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const read = (name: string) => JSON.parse(readFileSync(path.join(root, "data", `${name}.json`), "utf8"))
const agent = read("agents").agents.find((x: any) => x.id === "jane_doe")
const engine = read("w_engines").wEngines.find((x: any) => x.id === "zzz_wiki_760")
const skills = read("agent_skills").agentSkills.find((x: any) => x.id === agent.id)
const meta = { agents: [agent], wEngines: [engine], agentSkills: [skills], combatBuffs: [] }
const coreId = "agent:jane_doe.corePassive"
const frenzyId = "agent:jane_doe.skill.frenzy"
const effectId = "jane-frenzy-atk-from-proficiency"

describe("Jane main-character configuration", () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it("starts at P6/Core F with the signature engine and one physical anomaly", () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    expect(store.potentialLevel).toBe(6)
    expect(store.coreSkillLevel).toBe("F")
    expect(store.wEngineId).toBe(engine.id)
    expect(store.damageConfig.mode).toBe("adminDefault")
    expect(store.damageConfig.events).toEqual(agent.defaultCalculationConfig.events.map((event: any) => ({ critMode: "expected", ...event })))
    expect(defaultBuffIdsFor(agent, 0, engine)).toContain("agent:jane_doe.corePassive")
    expect(store.activeBuffIds(meta)).toContain(frenzyId)
    expect(store.janeFrenzySplitVersion).toBe(1)
    expect(defaultBuffIdsFor(agent, 0, engine)).not.toContain("jane_doe.core_insight")
  })

  it("restores explicit P0 and custom events without reapplying P6", async () => {
    const store = useBuildStore()
    store.initialize({}, meta)
    store.setPotentialLevel(0, meta)
    const config = { ...store.damageConfig, mode: "custom", events: [{ id: "potential-choice", kind: "skillGroup",
      skillGroupId: "jane-sahoff-jump-potential", count: 3, stunned: false }], selectedEventId: "potential-choice" }
    store.setDamageConfig(config, agent)
    await store.persist()
    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.potentialLevel).toBe(0)
    expect(restored.damageConfig.events).toEqual(config.events)
    restored.setCinemaLevel(3, meta)
    const level = restored.skillLevels.basic
    restored.setCinemaLevel(5, meta)
    restored.setCinemaLevel(6, meta)
    expect(restored.skillLevels.basic).toBe(level)
    expect(agent.cinemaDescriptions.at(-1).modeled).toBe(false)
  })

  it("materializes Core and Potential independently in the picker", () => {
    for (const [core, rate] of [["none", .1], ["F", .16]] as const) {
      for (const [p, critDmg] of [[0, 0], [1, 0], [2, 10], [6, 30]]) {
        const candidates = currentAgentBuffCandidates(meta, agent.id, 0, core, p)
        const passive = candidates.find(x => x.id === "agent:jane_doe.corePassive")
        expect(candidates.find(x => x.id === frenzyId).source.zhCN).toBe("普通攻击｜狂热")
        expect(passive.effects.find((r: any) => r.formula?.parameterSources).formula.parameters.rate).toBe(rate)
        expect(candidates.find(x => x.id === "agent:jane_doe.additionalAbility").effects[0].value).toBe(critDmg)
      }
    }
  })

  it("preserves panel formula outputs, targets and parameter sources across draft preparation", () => {
    const draft = prepareDraft("agents", agent)
    const before = JSON.stringify(agent)
    const rules = draft.combatBuffs.corePassive.effects
    const crit = rules.find((r: any) => r.formula?.parameterSources)
    expect(crit.stat).toBe("anomalyCritRate")
    expect(crit.target).toMatchObject({ kind: "anomaly", settlementType: "attribute", anomalyEffects: ["assault"] })
    const frenzy = draft.combatBuffs.skillBuffs.find((b: any) => b.id === "frenzy")
    expect(frenzy.effects.find((r: any) => r.stat === "atkFlat").formula.expression).toContain("120")
    expect(frenzy.sourceSkillRef).toEqual({ agentSkillId: "jane_doe", categoryId: "basic" })
    draft.coreSkill.corePassiveScaling.levels[0].assaultCritRatePerAnomalyProficiencyPct = .09
    expect(repairDynamicValueSourceFallbacks(draft)).toHaveLength(1)
    expect(crit.formula.parameters.rate).toBe(.09)
    const saved = prepareDraft("agents", JSON.parse(JSON.stringify(draft)))
    expect(saved.combatBuffs.corePassive.effects).toEqual(rules)
    expect(saved.combatBuffs.skillBuffs).toEqual(draft.combatBuffs.skillBuffs)
    expect(materializeCorePassiveScalingEffect(saved.combatBuffs.corePassive, saved, "F").effects.find((r: any) => r.formula?.parameterSources).formula.parameters.rate).toBe(.16)
    expect(JSON.stringify(agent)).toBe(before)
  })

  it.each([true, false])("migrates legacy Core enabled=%s once, preserving coverage and other rules", async enabled => {
    const store = useBuildStore()
    const config = { potentialLevel: 0, combat: {
      manuallyUncheckedDefaultBuffIds: enabled ? [] : [coreId],
      runtimeInputs: { [coreId]: { coverage: .8, effects: {
        [effectId]: { coverage: 0 }, "jane-assault-crit-rate-base": { coverage: .7 },
      } } },
    } }
    const original = JSON.stringify(config)
    store.applyAgentConfig(agent.id, meta, config)
    expect(store.activeBuffIds(meta).includes(frenzyId)).toBe(enabled)
    expect(store.runtimeInputs[frenzyId].effects[effectId].coverage).toBe(0)
    expect(store.runtimeInputs[coreId]).toEqual({ coverage: .8, effects: { "jane-assault-crit-rate-base": { coverage: .7 } } })
    expect(JSON.stringify(config)).toBe(original)
    await store.persist()
    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1")!)
    expect(persisted.byOwner.default.byAgent.jane_doe.combat.janeFrenzySplitVersion).toBe(1)
    // User chooses the opposite Frenzy state, leaving Core at its original state.
    store.applyBuffState({ selectedBuffIds: enabled ? store.activeBuffIds(meta).filter(id => id !== frenzyId)
      : [...store.activeBuffIds(meta), frenzyId], runtimeInputs: store.runtimeInputs }, meta)
    await store.persist()
    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.activeBuffIds(meta).includes(frenzyId)).toBe(!enabled)
    expect(restored.activeBuffIds(meta).includes(coreId)).toBe(enabled)
    expect(restored.potentialLevel).toBe(0)
    expect(restored.runtimeInputs[frenzyId].effects[effectId].coverage).toBe(0)
  })

  it.each([
    { coverage: .4 },
    { coverage: .8, [effectId]: { coverage: .3 } },
    { coverage: .8, effects: { [effectId]: { coverage: .2 } } },
  ])("migrates legacy flat, per-rule and Buff coverage: %j", legacy => {
    const store = useBuildStore()
    store.applyAgentConfig(agent.id, meta, { combat: { runtimeInputs: { [coreId]: legacy } } })
    expect(store.runtimeInputs[frenzyId].effects[effectId].coverage).toBe(
      (legacy as any).effects?.[effectId]?.coverage ?? (legacy as any)[effectId]?.coverage ?? legacy.coverage)
  })

  it("preserves an existing new selection and runtime, and explicit Core selection overrides legacy unchecked", () => {
    const store = useBuildStore()
    store.applyAgentConfig(agent.id, meta, { combat: {
      manuallyUncheckedDefaultBuffIds: [coreId], activeBuffIds: [frenzyId],
      runtimeInputs: { [coreId]: { effects: { [effectId]: { coverage: .2 } } }, [frenzyId]: { effects: { [effectId]: { coverage: .6 } } } },
    } })
    expect(store.activeBuffIds(meta)).toContain(frenzyId)
    expect(store.runtimeInputs[frenzyId].effects[effectId].coverage).toBe(.6)
    expect(store.runtimeInputs[coreId]).toBeUndefined()
    store.applyAgentConfig(agent.id, meta, { combat: { activeBuffIds: [coreId], manuallyUncheckedDefaultBuffIds: [coreId] } })
    expect(store.activeBuffIds(meta)).toContain(frenzyId)
    store.applyAgentConfig(agent.id, meta, { combat: { manuallyUncheckedDefaultBuffIds: [frenzyId] } })
    expect(store.activeBuffIds(meta)).not.toContain(frenzyId)
  })
})
