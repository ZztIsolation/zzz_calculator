import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { activeDriveDisc4pcRuntimeInputs, defaultDamageConfig, normalizeDamageModeForAgent, useBuildStore } from "@/stores/build"

function teammateWEngineMeta() {
  const teamWEngine = (id: string) => ({
    id,
    name: { zhCN: id },
    modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
    effect: {
      teamBuff: {
        scope: "inCombat",
        effects: [{ id: `${id}-atk`, type: "fixed", stat: "atkFlat", value: 10 }],
      },
    },
  })
  return {
    agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
    wEngines: [
      { id: "engine_a", name: { zhCN: "当前音擎" } },
      teamWEngine("engine_team"),
      teamWEngine("engine_team_default"),
      teamWEngine("engine_team_invalid"),
    ],
    combatBuffs: [],
  }
}

describe("build store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it("defaults potential characters to their authored level and keeps ordinary characters at P0", () => {
    const potentialAgent = {
      id: "potential_agent",
      name: { zhCN: "潜能角色" },
      potentialVision: { defaultLevel: 6, maxLevel: 6 },
    }
    const ordinaryAgent = { id: "ordinary_agent", name: { zhCN: "普通角色" } }
    const meta = {
      agents: [potentialAgent, ordinaryAgent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    const store = useBuildStore()

    store.initialize({}, meta)
    expect(store.agentId).toBe("potential_agent")
    expect(store.potentialLevel).toBe(6)
    expect(store.buildInput({}, meta, []).potentialLevel).toBe(6)

    store.selectAgent("ordinary_agent", meta)
    expect(store.potentialLevel).toBe(0)
    store.setPotentialLevel(6, meta)
    expect(store.potentialLevel).toBe(0)
  })

  it("persists potential level per owner and agent while old saves use the authored default", () => {
    localStorage.setItem("zzz-calculator.currentAccount.v1", "alice")
    const potentialAgent = {
      id: "potential_agent",
      name: { zhCN: "潜能角色" },
      potentialVision: { defaultLevel: 6, maxLevel: 6 },
    }
    const meta = {
      agents: [potentialAgent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "alice",
      byOwner: {
        alice: {
          currentAgentId: "potential_agent",
          byAgent: { potential_agent: { wEngineId: "engine_a" } },
        },
      },
    }))
    const store = useBuildStore()

    store.initialize({}, meta)
    expect(store.potentialLevel).toBe(6)
    store.setPotentialLevel(0, meta)
    expect(store.potentialLevel).toBe(0)

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.alice.byAgent.potential_agent.potentialLevel).toBe(0)
    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.potentialLevel).toBe(0)
  })

  it("does not inherit another owner's potential level when the current owner has no build", async () => {
    localStorage.setItem("zzz-calculator.currentAccount.v1", "bob")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "alice",
      byOwner: {
        alice: {
          currentAgentId: "potential_agent",
          byAgent: {
            potential_agent: { wEngineId: "engine_a", potentialLevel: 0 },
          },
        },
      },
    }))
    const potentialAgent = {
      id: "potential_agent",
      name: { zhCN: "潜能角色" },
      potentialVision: { defaultLevel: 6, maxLevel: 6 },
    }
    const meta = {
      agents: [potentialAgent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    const store = useBuildStore()

    store.initialize({}, meta)
    expect(store.potentialLevel).toBe(6)
    await store.persist()

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.alice.byAgent.potential_agent.potentialLevel).toBe(0)
    expect(saved.byOwner.bob.byAgent.potential_agent.potentialLevel).toBe(6)
  })

  it("switches an active admin default when potential level changes", () => {
    const agent = {
      id: "potential_agent",
      potentialVision: { defaultLevel: 6, maxLevel: 6 },
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "p0-hit",
        events: [{ id: "p0-hit", kind: "direct", skillMultiplier: 100, count: 1 }],
        potentialVariants: [{
          minPotentialLevel: 1,
          maxPotentialLevel: 6,
          mode: "custom",
          selectedEventId: "p1-hit",
          events: [{ id: "p1-hit", kind: "direct", skillMultiplier: 200, count: 1 }],
        }],
      },
    }
    const meta = { agents: [agent], wEngines: [], combatBuffs: [] }
    const store = useBuildStore()

    store.applyAgentConfig(agent.id, meta)
    store.setDamageConfig({ mode: "adminDefault" }, agent)
    expect(store.damageConfig.selectedEventId).toBe("p1-hit")
    store.setPotentialLevel(0, meta)
    expect(store.damageConfig.selectedEventId).toBe("p0-hit")
  })

  it("builds a damage input with visual-era defaults preserved", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{
        id: "agent_a",
        name: { zhCN: "角色 A" },
        coreSkill: { levels: [{ level: "F", label: { zhCN: "F" } }] },
        combatBuffs: {
          corePassive: { scope: "inCombat", effects: [] },
          additionalAbility: { scope: "inCombat", effects: [] },
          skillBuffs: [
            { id: "skill-on", scope: "inCombat", defaultChecked: true, effects: [] },
            { id: "skill-off", scope: "inCombat", defaultChecked: false, effects: [] },
          ],
          cinemaBuffs: [{ scope: "inCombat", cinemaLevel: 1, effects: [] }],
        },
        defaultCalculationConfig: {
          selectedEventId: "default-hit",
          events: [{ id: "default-hit", kind: "direct", skillMultiplier: 100 }],
        },
      }],
      wEngines: [{
        id: "engine_a",
        name: { zhCN: "音擎 A" },
        effect: { selfBuff: { scope: "inCombat", effects: [] } },
        modification: { minLevel: 1, maxLevel: 5 },
      }],
      combatBuffs: [{ id: "teammate_buff", effects: [] }],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.coreSkillLevel = "F"
    store.cinemaLevel = 1
    store.selectedBuffIds = ["teammate_buff"]

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("default-hit")
    expect(input.damage.target.stunned).toBeUndefined()
    expect(input.damage.events[0].stunned).toBe(true)
    expect(input.combatBuffs.activeBuffIds).toContain("agent:agent_a.corePassive")
    expect(input.combatBuffs.activeBuffIds).toContain("agent:agent_a.skill.skill-on")
    expect(input.combatBuffs.activeBuffIds).not.toContain("agent:agent_a.skill.skill-off")
    expect(input.combatBuffs.activeBuffIds).toContain("agent:agent_a.cinema.1")
    expect(input.combatBuffs.activeBuffIds).toContain("wEngine:engine_a.self")
    expect(input.combatBuffs.activeBuffIds).toContain("teammate_buff")
  })

  it("migrates Sigrid Tempering runtime independently while honoring the new default", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{
        id: "sigrid",
        name: { zhCN: "希格莉德·德拉叙尔" },
        combatBuffs: {
          corePassive: { scope: "inCombat", effects: [] },
          skillBuffs: [{
            id: "tempering",
            scope: "inCombat",
            defaultChecked: true,
            effects: [{ id: "tempering-sheathed-spear-damage", type: "fixed", stat: "dmgBonus", value: 20 }],
          }],
        },
      }],
      wEngines: [],
      combatBuffs: [],
    }
    store.applyAgentConfig("sigrid", meta, {
      combat: {
        manuallyUncheckedDefaultBuffIds: ["agent:sigrid.corePassive"],
        runtimeInputs: {
          "agent:sigrid.corePassive": {
            coverage: 0.6,
            effects: {
              "sky-patrol-stunned-target-bonus": { coverage: 0.8 },
              "tempering-sheathed-spear-damage": { coverage: 0.35, enabled: false },
            },
          },
        },
      },
    })

    expect(store.runtimeInputs["agent:sigrid.skill.tempering"]).toEqual({
      effects: {
        "tempering-sheathed-spear-damage": { coverage: 0.35, enabled: false },
      },
    })
    expect(store.runtimeInputs["agent:sigrid.corePassive"]).toEqual({
      coverage: 0.6,
      effects: {
        "sky-patrol-stunned-target-bonus": { coverage: 0.8 },
      },
    })
    expect(store.activeBuffIds(meta)).toContain("agent:sigrid.skill.tempering")
    expect(store.activeBuffIds(meta)).not.toContain("agent:sigrid.corePassive")

    store.applyAgentConfig("sigrid", meta, {
      combat: {
        runtimeInputs: {
          "agent:sigrid.corePassive": {
            coverage: 0.45,
            effects: {
              "tempering-sheathed-spear-damage": { coverage: 0.2 },
            },
          },
          "agent:sigrid.skill.tempering": {
            effects: {
              "tempering-sheathed-spear-damage": { coverage: 0.9 },
            },
          },
        },
      },
    })
    expect(store.runtimeInputs["agent:sigrid.skill.tempering"].effects["tempering-sheathed-spear-damage"].coverage).toBe(0.9)
    expect(store.runtimeInputs["agent:sigrid.corePassive"]).toEqual({ coverage: 0.45 })

    store.applyAgentConfig("sigrid", meta, {
      combat: {
        runtimeInputs: {
          "agent:sigrid.corePassive": { coverage: 0.55 },
        },
      },
    })
    expect(store.runtimeInputs["agent:sigrid.skill.tempering"].effects["tempering-sheathed-spear-damage"].coverage).toBe(0.55)
    expect(store.runtimeInputs["agent:sigrid.corePassive"]).toEqual({ coverage: 0.55 })
  })

  it("keeps current skill levels authoritative over stale damage snapshots", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.applyAgentConfig("agent_a", meta, {
      wEngineId: "engine_a",
      skillLevels: { basic: 4, special: 8 },
      damage: {
        mode: "custom",
        skillLevelsByCategory: { basic: 12, special: 12 },
        selectedEventId: "legacy-hit",
        events: [{ id: "legacy-hit", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    expect(store.skillLevels).toMatchObject({ basic: 4, special: 8 })
    expect(store.buildInput({}, meta, []).damage.skillLevelsByCategory).toMatchObject({ basic: 4, special: 8 })

    store.updateSkillLevel("basic", 7)
    store.persist()

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.agent_a.skillLevels).toMatchObject({ basic: 7, special: 8 })
    expect(saved.byOwner.default.byAgent.agent_a.damage.skillLevelsByCategory).toMatchObject({ basic: 7, special: 8 })
  })

  it("migrates and persists legacy Luminescence events with the minimal score structure", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "remielle_dan", name: { zhCN: "蕾米埃尔·丹" } }],
      wEngines: [],
      combatBuffs: [],
    }
    store.applyAgentConfig("remielle_dan", meta, {
      damage: {
        mode: "custom",
        selectedEventId: "legacy-luminescence",
        events: [{
          id: "legacy-luminescence",
          kind: "anomaly",
          settlementType: "luminescence",
          count: 3,
          stunned: true,
          triggerActorRef: { agentId: "remielle_dan" },
          records: [{ kind: "normal", T: 3150, k: 1.25, B: 7.13, sourceElement: "physical" }],
          resistanceMode: "sourceElement",
        }],
      },
    })

    const expected = {
      id: "legacy-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 3150,
      luminescenceDamageSharePct: 50,
    }
    expect(store.damageConfig.events[0]).toEqual(expected)

    store.persist()
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.remielle_dan.damage.events[0]).toEqual(expected)
  })

  it("preserves the editable teammate attack inside Dan's fixed admin score model", () => {
    const event = {
      id: "dan-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
    }
    const agent = {
      id: "remielle_dan",
      name: { zhCN: "蕾米埃尔·丹" },
      defaultCalculationConfig: {
        mode: "anomaly",
        selectedEventId: event.id,
        events: [event],
      },
    }
    const meta = { agents: [agent], wEngines: [], combatBuffs: [] }
    const store = useBuildStore()
    store.agentId = agent.id

    store.setDamageConfig({
      mode: "adminDefault",
      selectedEventId: event.id,
      events: [{ ...event, teammateAttack: 3200, luminescenceDamageSharePct: 62.5 }],
    }, agent)

    expect(store.damageConfig.events).toEqual([{ ...event, teammateAttack: 3200, luminescenceDamageSharePct: 62.5 }])
    expect(store.buildInput({}, meta, []).damage.events).toEqual([{ ...event, teammateAttack: 3200, luminescenceDamageSharePct: 62.5 }])
    store.setCinemaLevel(2, meta)
    expect(store.damageConfig.events).toEqual([{ ...event, teammateAttack: 3200, luminescenceDamageSharePct: 62.5 }])
    expect(store.buildInput({}, meta, []).cinemaLevel).toBe(2)

    store.persist()
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.remielle_dan.damage.events).toEqual([{ ...event, teammateAttack: 3200, luminescenceDamageSharePct: 62.5 }])
  })

  it("drops legacy measured-reference fields from Dan's build inputs and persistence", () => {
    const event = {
      id: "dan-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
      referenceAnomalyProficiency: 642,
      referenceLuminescenceDamageMultiplier: 1.51,
    }
    const agent = {
      id: "remielle_dan",
      defaultCalculationConfig: { mode: "anomaly", selectedEventId: event.id, events: [event] },
    }
    const meta = { agents: [agent], wEngines: [], combatBuffs: [] }
    const store = useBuildStore()
    store.agentId = agent.id
    store.setDamageConfig({ mode: "adminDefault", selectedEventId: event.id, events: [event] }, agent)

    const expected = {
      id: "dan-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
    }
    expect(store.damageConfig.events[0]).toEqual(expected)
    expect(store.buildInput({}, meta, []).damage.events[0]).toEqual(expected)
    store.setCinemaLevel(2, meta)
    expect(store.damageConfig.events[0]).toEqual(expected)
    store.persist()
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.remielle_dan.damage.events[0]).toEqual(expected)
  })

  it("does not silently replace an invalid Luminescence teammate attack", () => {
    const event = {
      id: "dan-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
    }
    const agent = {
      id: "remielle_dan",
      defaultCalculationConfig: { mode: "anomaly", selectedEventId: event.id, events: [event] },
    }
    const store = useBuildStore()

    store.setDamageConfig({
      mode: "adminDefault",
      selectedEventId: event.id,
      events: [{ ...event, teammateAttack: null }],
    }, agent)

    expect(store.damageConfig.events[0].teammateAttack).toBeNull()
  })

  it("does not silently replace an invalid Luminescence damage share", () => {
    const event = {
      id: "dan-luminescence",
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: "remielle_dan" },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
    }
    const agent = {
      id: "remielle_dan",
      defaultCalculationConfig: { mode: "anomaly", selectedEventId: event.id, events: [event] },
    }
    const store = useBuildStore()

    store.setDamageConfig({
      mode: "adminDefault",
      selectedEventId: event.id,
      events: [{ ...event, luminescenceDamageSharePct: null }],
    }, agent)

    expect(store.damageConfig.events[0].luminescenceDamageSharePct).toBeNull()
  })

  it("migrates legacy target stun state only into non-admin events", () => {
    const store = useBuildStore()
    const agent = {
      id: "agent_a",
      name: { zhCN: "角色 A" },
      defaultCalculationConfig: {
        selectedEventId: "admin-hit",
        events: [{ id: "admin-hit", kind: "direct", skillMultiplier: 200, count: 1 }],
      },
    }
    const meta = {
      agents: [agent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }

    store.applyAgentConfig("agent_a", meta, {
      wEngineId: "engine_a",
      targetConfig: { stunned: false, stunMultiplierPercent: 175 },
      damage: {
        mode: "custom",
        selectedEventId: "legacy-hit",
        events: [
          { id: "legacy-hit", kind: "direct", skillMultiplier: 100, count: 1 },
          { id: "explicit-hit", kind: "direct", skillMultiplier: 100, count: 1, stunned: true },
        ],
      },
    })

    expect(store.damageConfig.events.map((event: any) => event.stunned)).toEqual([false, true])
    expect(store.targetConfig.stunned).toBeUndefined()

    store.applyAgentConfig("agent_a", meta, {
      wEngineId: "engine_a",
      targetConfig: { stunned: false, stunMultiplierPercent: 175 },
      damage: { mode: "adminDefault", events: [] },
    })

    expect(store.damageConfig.mode).toBe("adminDefault")
    expect(store.damageConfig.events[0]).toMatchObject({ id: "admin-hit", stunned: true })
  })

  it("upgrades legacy release variants to actor-backed release settlements", () => {
    const store = useBuildStore()
    const agent = {
      id: "release_agent",
      name: { zhCN: "异放角色" },
      anomalyReleaseProfiles: [{
        id: "default-release",
        default: true,
        supportedElements: ["ether"],
        resultMode: "originalAnomalyRatio",
        expression: { kind: "constant", value: 1, unit: "decimal" },
      }],
      defaultCalculationConfig: {
        selectedEventId: "default-release-event",
        events: [{ id: "default-release-event", kind: "anomaly", settlementType: "release", anomalyEffect: "corruption" }],
      },
    }
    const meta = { agents: [agent], wEngines: [], combatBuffs: [] }

    store.applyAgentConfig(agent.id, meta, {
      damage: {
        mode: "custom",
        selectedEventId: "legacy-release",
        events: [{
          id: "legacy-release",
          kind: "anomaly",
          settlementType: "attribute",
          anomalyEffect: "corruption",
          anomalyVariant: "release",
          procCount: 20,
        }],
      },
    })

    expect(store.damageConfig.events[0]).toMatchObject({
      id: "legacy-release",
      settlementType: "release",
      triggerActorRef: { agentId: agent.id, profileId: "default-release" },
      anomalySource: { actorRef: { agentId: agent.id } },
    })
    expect(store.damageConfig.events[0].anomalyVariant).toBeUndefined()
    expect(store.damageConfig.events[0].procCount).toBeUndefined()
  })

  it("normalizes saved Aria Release events to Corruption and a live self source", () => {
    const store = useBuildStore()
    const aria = {
      id: "aria",
      name: { zhCN: "爱芮" },
      anomalyReleaseProfiles: [{
        id: "core_passive",
        default: true,
        supportedElements: ["ether"],
        resultMode: "originalAnomalyRatio",
        expression: { kind: "constant", value: 1, unit: "decimal" },
      }],
      defaultCalculationConfig: {
        selectedEventId: "aria-default-release",
        events: [{ id: "aria-default-release", kind: "anomaly", settlementType: "release", anomalyEffect: "corruption" }],
      },
    }
    const meta = { agents: [aria], wEngines: [], combatBuffs: [] }

    store.applyAgentConfig(aria.id, meta, {
      damage: {
        mode: "custom",
        selectedEventId: "saved-release",
        events: [{
          id: "saved-release",
          kind: "anomaly",
          settlementType: "release",
          anomalyEffect: "burn",
          anomalyVariant: "release",
          procCount: 20,
          disorderType: "normal",
          elapsedSeconds: 2,
          triggerActorRef: { agentId: "other_agent", profileId: "missing" },
          anomalySource: {
            actorRef: { agentId: "other_agent" },
            snapshot: {
              agentId: "other_agent",
              panel: { anomalyMastery: 200 },
              outOfCombatPanel: { anomalyMastery: 200 },
            },
          },
        }],
      },
    })

    expect(store.damageConfig.events[0]).toMatchObject({
      id: "saved-release",
      kind: "anomaly",
      settlementType: "release",
      anomalyEffect: "corruption",
      triggerActorRef: { agentId: "aria", profileId: "core_passive" },
      anomalySource: { actorRef: { agentId: "aria" } },
    })
    expect(store.damageConfig.events[0].anomalySource).not.toHaveProperty("snapshot")
    expect(store.damageConfig.events[0]).not.toHaveProperty("anomalyVariant")
    expect(store.damageConfig.events[0]).not.toHaveProperty("procCount")
    expect(store.damageConfig.events[0]).not.toHaveProperty("disorderType")
    expect(store.damageConfig.events[0]).not.toHaveProperty("elapsedSeconds")
  })

  it("keeps field buffs independent while allowing exactly one selected Boss Buff", () => {
    const store = useBuildStore()
    const meta = {
      agents: [],
      wEngines: [],
      combatBuffs: [
        { id: "field.v3.p1", sourceType: "field", effects: [] },
        { id: "boss.encounter.a", sourceType: "boss", effects: [] },
        { id: "boss.encounter.b", sourceType: "boss", effects: [] },
      ],
    }
    store.applyBuffState({
      selectedBuffIds: ["field.v3.p1", "boss.encounter.a", "boss.encounter.b"],
      runtimeInputs: {
        "boss.encounter.a": { effects: { a: { stacks: 1 } } },
        "boss.encounter.b": { effects: { b: { stacks: 2 } } },
      },
    }, meta)

    expect(store.activeBuffIds(meta)).toEqual(["field.v3.p1", "boss.encounter.a"])
    expect(store.runtimeInputs).toHaveProperty("boss.encounter.a")
    expect(store.runtimeInputs).not.toHaveProperty("boss.encounter.b")
  })

  it("preserves disabled Field Buff effects in the final calculation input", () => {
    const store = useBuildStore()
    const fieldBuff = {
      id: "field.v3.p1",
      sourceType: "field",
      scope: "inCombat",
      effects: [{
        id: "field-atk",
        type: "fixed",
        stat: "atkFlat",
        value: 100,
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
      }],
    }
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [fieldBuff],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.selectedBuffIds = [fieldBuff.id]
    store.runtimeInputs = {
      [fieldBuff.id]: { effects: { "field-atk": { enabled: false, coverage: 0.4 } } },
    }

    const input = store.buildInput({}, meta, [])
    expect(input.combatBuffs.runtimeInputs[fieldBuff.id].effects["field-atk"]).toMatchObject({
      enabled: false,
      coverage: 0.4,
    })
  })

  it("preserves disabled Boss Buff effects in the final calculation input", () => {
    const store = useBuildStore()
    const bossBuff = {
      id: "boss.encounter.a",
      sourceType: "boss",
      scope: "inCombat",
      effects: [{
        id: "boss-dmg",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
      }],
    }
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [bossBuff],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.selectedBuffIds = [bossBuff.id]
    store.runtimeInputs = {
      [bossBuff.id]: { effects: { "boss-dmg": { enabled: false, coverage: 0.6 } } },
    }

    const input = store.buildInput({}, meta, [])
    expect(input.combatBuffs.runtimeInputs[bossBuff.id].effects["boss-dmg"]).toMatchObject({
      enabled: false,
      coverage: 0.6,
    })
  })

  it("migrates a legacy concrete Boss target into Buff selection and resets target values", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [
        { id: "field.v3.p1", sourceType: "field", effects: [] },
        { id: "boss.encounter.a", sourceType: "boss", effects: [] },
        { id: "boss.encounter.b", sourceType: "boss", effects: [] },
      ],
    }

    store.applyAgentConfig("agent_a", meta, {
      wEngineId: "engine_a",
      combat: {
        activeBuffIds: ["field.v3.p1", "boss.encounter.a"],
        runtimeInputs: {
          "boss.encounter.a": { effects: { a: { stacks: 1 } } },
          "boss.encounter.b": { effects: { b: { stacks: 2 } } },
        },
      },
      targetConfig: {
        targetMode: "specific",
        bossId: "boss.b",
        bossEncounterId: "boss.encounter.b",
        defense: 952,
        levelCoefficient: 794,
        stunned: false,
        stunMultiplierPercent: 175,
        resistanceByElement: { physical: 20, fire: -20 },
      },
    })

    expect(store.selectedBuffIds).toEqual(["field.v3.p1", "boss.encounter.b"])
    expect(store.activeBuffIds(meta)).toEqual(["field.v3.p1", "boss.encounter.b"])
    expect(store.runtimeInputs).not.toHaveProperty("boss.encounter.a")
    expect(store.runtimeInputs).toHaveProperty("boss.encounter.b")
    expect(store.targetConfig).toEqual({
      presetId: "normal-boss",
      defense: 953,
      levelCoefficient: 794,
      stunMultiplierPercent: 175,
      resistanceByElement: Object.fromEntries(["physical", "fire", "ice", "electric", "ether", "wind"].map(element => [element, 0])),
    })
  })

  it("only enables default agent and w-engine buffs that are in-combat", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{
        id: "agent_a",
        name: { zhCN: "角色 A" },
        combatBuffs: {
          corePassive: { scope: "outOfCombat", effects: [] },
          additionalAbility: { scope: "inCombat", effects: [] },
          cinemaBuffs: [
            { scope: "outOfCombat", cinemaLevel: 1, effects: [] },
            { scope: "inCombat", cinemaLevel: 2, effects: [] },
          ],
        },
      }],
      wEngines: [{
        id: "engine_a",
        name: { zhCN: "音擎 A" },
        effect: {
          selfBuff: { scope: "outOfCombat", effects: [] },
          teamBuff: { scope: "inCombat", effects: [] },
        },
      }],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.cinemaLevel = 2

    const ids = store.buildInput({}, meta, []).combatBuffs.activeBuffIds

    expect(ids).not.toContain("agent:agent_a.corePassive")
    expect(ids).toContain("agent:agent_a.additionalAbility")
    expect(ids).not.toContain("agent:agent_a.cinema.1")
    expect(ids).toContain("agent:agent_a.cinema.2")
    expect(ids).not.toContain("wEngine:engine_a.self")
    expect(ids).toContain("wEngine:engine_a.team")
  })

  it("loads owner-scoped main-branch calculation config for the current account", () => {
    localStorage.setItem("zzz-calculator.currentAccount.v1", "alice")
    localStorage.setItem("zzz-calculator.homeSelection.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "alice",
      byOwner: {
        default: {
          currentAgentId: "agent_a",
          byAgent: {
            agent_a: { wEngineId: "engine_a", agentLevel: 60 },
          },
        },
        alice: {
          currentAgentId: "agent_b",
          byAgent: {
            agent_b: {
              agentLevel: 55,
              coreSkillLevel: "E",
              cinemaLevel: 2,
              skillLevels: { basic: 9 },
              wEngineId: "engine_b",
              wEngineLevel: 50,
              wEngineModificationLevel: 3,
              combat: {
                activeBuffIds: ["manual_buff"],
                runtimeInputs: { manual_buff: { effects: {} } },
              },
              damage: {
                mode: "custom",
                selectedEventId: "direct-2",
                events: [{ id: "direct-2", kind: "direct", skillMultiplier: 220, count: 1 }],
                target: {
                  presetId: "custom",
                  defense: 888,
                  stunned: false,
                  stunMultiplierPercent: 150,
                  resistanceByElement: { physical: 20 },
                },
              },
            },
          },
        },
      },
    }))
    const store = useBuildStore()
    const meta = {
      agents: [
        { id: "agent_a", name: { zhCN: "角色 A" }, coreSkill: { levels: [{ level: "F" }] } },
        { id: "agent_b", name: { zhCN: "角色 B" }, coreSkill: { levels: [{ level: "E" }] } },
      ],
      wEngines: [
        { id: "engine_a", name: { zhCN: "音擎 A" }, agentId: "agent_a" },
        { id: "engine_b", name: { zhCN: "音擎 B" }, agentId: "agent_b", modification: { minLevel: 1, maxLevel: 5 } },
      ],
      combatBuffs: [{ id: "manual_buff", effects: [] }],
    }

    store.initialize({}, meta)

    expect(store.agentId).toBe("agent_b")
    expect(store.agentLevel).toBe(55)
    expect(store.wEngineId).toBe("engine_b")
    expect(store.wEngineModificationLevel).toBe(3)
    expect(store.damageConfig.selectedEventId).toBe("direct-2")
    expect(store.targetConfig.defense).toBe(888)

    const input = store.buildInput({}, meta, [])
    expect(input.damage.agentLevel).toBe(55)
    expect(input.damage.selectedEventId).toBe("direct-2")
    expect(input.damage.target.defense).toBe(888)
    expect(input.combatBuffs.activeBuffIds).toContain("manual_buff")
  })

  it("falls back from saved hidden agents and w-engines without deleting their configs", () => {
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "default",
      byOwner: {
        default: {
          currentAgentId: "hidden_agent",
          byAgent: {
            hidden_agent: { agentLevel: 42, wEngineId: "hidden_engine" },
            visible_agent: { agentLevel: 55, wEngineId: "hidden_engine" },
          },
        },
      },
    }))
    const hiddenAgent = { id: "hidden_agent", name: { zhCN: "隐藏角色" } }
    const visibleAgent = { id: "visible_agent", name: { zhCN: "可见角色" } }
    const hiddenEngine = { id: "hidden_engine", name: { zhCN: "隐藏音擎" } }
    const visibleEngine = { id: "visible_engine", name: { zhCN: "可见音擎" } }
    const meta = {
      agents: [hiddenAgent, visibleAgent],
      displayAgents: [visibleAgent],
      wEngines: [hiddenEngine, visibleEngine],
      displayWEngines: [visibleEngine],
      combatBuffs: [],
    }
    const store = useBuildStore()

    store.initialize({}, meta)

    expect(store.agentId).toBe("visible_agent")
    expect(store.agentLevel).toBe(55)
    expect(store.wEngineId).toBe("visible_engine")

    store.persist()
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.currentAgentId).toBe("visible_agent")
    expect(saved.byOwner.default.byAgent.hidden_agent).toEqual({ agentLevel: 42, wEngineId: "hidden_engine" })
  })

  it("clears active selections when the workbench has no visible agents", () => {
    const store = useBuildStore()
    store.agentId = "previous_agent"
    store.wEngineId = "previous_engine"
    store.result = { damage: 1 }
    store.outOfCombat = { panel: {} }

    store.initialize({}, {
      agents: [{ id: "hidden_agent" }],
      displayAgents: [],
      wEngines: [{ id: "hidden_engine" }],
      displayWEngines: [],
    })

    expect(store.agentId).toBe("")
    expect(store.wEngineId).toBe("")
    expect(store.result).toBe(null)
    expect(store.outOfCombat).toBe(null)
  })

  it("passes teammate drive-disc team buffs through the core input shape", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [
        { id: "engine_a", name: { zhCN: "音擎 A" } },
        {
          id: "engine_team",
          name: { zhCN: "队友音擎" },
          modification: { minLevel: 1, maxLevel: 5 },
          effect: { teamBuff: { scope: "inCombat", effects: [] } },
        },
      ],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.selectedBuffIds = ["teammateDriveDisc4pc:set_a"]

    const input = store.buildInput({}, meta, [])
    expect(input.combatBuffs.activeBuffIds).toContain("teammateDriveDisc4pc:set_a")
    expect(input.combatBuffs.teammateDriveDiscSetIds).toEqual(["set_a"])
  })

  it("activates the current character's equipped 4-piece drive-disc buffs", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    const catalog = {
      driveDiscSets: [{
        id: "set_a",
        name: { zhCN: "套装 A" },
        fourPiece: {
          selfBuff: {
            scope: "inCombat",
            effects: [{ id: "self", type: "fixed", stat: "dmgBonus", value: 10 }],
          },
          teamBuff: {
            scope: "inCombat",
            effects: [{ id: "team", type: "fixed", stat: "atkFlat", value: 30 }],
          },
        },
      }],
    }
    const driveDiscs = [1, 2, 3, 4, 5, 6].map(slot => ({
      id: `disc-${slot}`,
      partition: slot,
      setId: slot <= 4 ? "set_a" : "set_b",
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
    }))
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"

    const input = store.buildInput(catalog, meta, driveDiscs)
    expect(input.combatBuffs.activeBuffIds).toContain("driveDisc4pc:set_a.self")
    expect(input.combatBuffs.activeBuffIds).toContain("driveDisc4pc:set_a.team")
    expect(input.combatBuffs.activeBuffIds).not.toContain("driveDisc4pc:set_b.self")
  })

  it("applies saved manual runtime only to matching active 4-piece sets", () => {
    const catalog = {
      driveDiscSets: [{
        id: "set_a",
        fourPiece: {
          selfBuff: {
            effects: [{ id: "self", type: "fixed", stat: "dmgBonus", value: 10 }],
          },
        },
      }],
    }
    const matchingDiscs = [1, 2, 3, 4, 5, 6].map(slot => ({
      id: `disc-${slot}`,
      partition: slot,
      setId: slot <= 4 ? "set_a" : "set_b",
    }))
    const runtime = {
      effects: { self: { enabled: false, coverage: 0.5 } },
    }
    const manualSettings = {
      fourPieceBuffMode: "manual",
      fourPieceBuffRuntimeInputs: {
        "driveDisc4pc:set_a.self": runtime,
        "driveDisc4pc:set_b.self": { effects: { other: { enabled: true } } },
      },
    }

    expect(activeDriveDisc4pcRuntimeInputs(catalog, matchingDiscs, manualSettings)).toEqual({
      "driveDisc4pc:set_a.self": runtime,
    })
    expect(activeDriveDisc4pcRuntimeInputs(catalog, matchingDiscs.slice(0, 3), manualSettings)).toEqual({})
    expect(activeDriveDisc4pcRuntimeInputs(catalog, matchingDiscs, {
      ...manualSettings,
      fourPieceBuffMode: "auto",
    })).toEqual({})
  })

  it("merges selected optimized 4-piece runtime overrides into the calculation input", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    const catalog = {
      driveDiscSets: [{
        id: "set_a",
        name: { zhCN: "套装 A" },
        fourPiece: {
          selfBuff: {
            scope: "inCombat",
            effects: [{ id: "self", type: "fixed", stat: "dmgBonus", value: 10, coverage: { default: 1, min: 0, max: 1, step: 0.1 } }],
          },
        },
      }],
    }
    const driveDiscs = [1, 2, 3, 4, 5, 6].map(slot => ({
      id: `disc-${slot}`,
      partition: slot,
      setId: slot <= 4 ? "set_a" : "set_b",
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
    }))
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"

    const input = store.buildInput(catalog, meta, driveDiscs, {
      runtimeInputs: {
        "driveDisc4pc:set_a.self": { effects: { self: { enabled: true, coverage: 0.25 } } },
      },
    })

    expect(input.combatBuffs.activeBuffIds).toContain("driveDisc4pc:set_a.self")
    expect(input.combatBuffs.runtimeInputs["driveDisc4pc:set_a.self"].effects.self.coverage).toBe(0.25)
  })

  it("matches main branch custom buff payload semantics", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.selectedBuffIds = ["wEngine:engine_team.team"]
    store.addedBuffs = [
      {
        id: "custom-a",
        sourceCategory: "custom",
        sourceKind: "custom",
        name: { zhCN: "自定义 A" },
        stats: [{ stat: "atkPct", value: 12, mode: "percent" }],
        effects: [{ type: "fixed", stat: "dmgBonus", value: 8, mode: "percent" }],
      },
      {
        id: "wEngine:engine_team.team",
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        wEngineModificationLevel: 5,
        effects: [{ type: "fixed", stat: "atkFlat", value: 999 }],
        runtime: { coverage: 0.5, effects: {} },
      },
    ]

    const input = store.buildInput({}, meta, [])

    expect(input.combatBuffs.manualStats).toEqual([
      expect.objectContaining({ stat: "atkPct", value: 12, mode: "pct" }),
    ])
    expect(input.combatBuffs.manualEffects).toHaveLength(1)
    expect(input.combatBuffs.manualEffects[0].effects[0]).toEqual(expect.objectContaining({
      stat: "dmgBonus",
      value: 8,
      mode: "pct",
    }))
    expect(input.combatBuffs.manualEffects.map((item: any) => item.id)).not.toContain("wEngine:engine_team.team")
    expect(input.combatBuffs.wEngineTeamModificationLevels).toEqual({
      "wEngine:engine_team.team": 5,
    })
    expect(input.combatBuffs.runtimeInputs["wEngine:engine_team.team"].coverage).toBeUndefined()
  })

  it("activates legacy added-only teammate w-engines and clamps persisted ranks by metadata", () => {
    const id = "wEngine:engine_team.team"
    localStorage.setItem("zzz-calculator.currentAccount.v1", "alice")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "alice",
      byOwner: {
        alice: {
          currentAgentId: "agent_a",
          byAgent: {
            agent_a: {
              wEngineId: "engine_a",
              combat: {
                activeBuffIds: [],
                addedBuffs: [{
                  id,
                  sourceCategory: "wEngine",
                  sourceKind: "wEngineTeam",
                  wEngineModificationLevel: 99,
                }],
              },
            },
          },
        },
      },
    }))
    const meta = teammateWEngineMeta()
    const store = useBuildStore()

    store.initialize({}, meta)

    expect(store.selectedBuffIds).toEqual([])
    expect(store.addedBuffs[0].wEngineModificationLevel).toBe(5)
    expect(store.activeBuffIds(meta)).toContain(id)
    const input = store.buildInput({}, meta, [])
    expect(input.combatBuffs.activeBuffIds).toContain(id)
    expect(input.combatBuffs.wEngineTeamModificationLevels).toEqual({ [id]: 5 })

    store.persist()
    for (const key of ["zzz-calculator.webapp.build.v1", "zzz-calculator.homeSelection.v1"]) {
      const saved = JSON.parse(localStorage.getItem(key) || "{}")
      const combat = saved.byOwner.alice.byAgent.agent_a.combat
      expect(combat.activeBuffIds).toEqual([])
      expect(combat.addedBuffs[0].wEngineModificationLevel).toBe(5)
    }

    setActivePinia(createPinia())
    const restored = useBuildStore()
    restored.initialize({}, meta)
    expect(restored.activeBuffIds(meta)).toContain(id)
    expect(restored.buildInput({}, meta, []).combatBuffs.wEngineTeamModificationLevels[id]).toBe(5)
  })

  it("normalizes legacy current and teammate w-engine ids to the canonical catalog id", () => {
    const legacyId = "neon_fantasies"
    const canonicalId = "zzz_wiki_1908"
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{
        id: canonicalId,
        legacyIds: [legacyId],
        name: { zhCN: "霓虹妄想" },
        modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
        effect: {
          selfBuff: { scope: "inCombat", effects: [] },
          teamBuff: { scope: "inCombat", effects: [] },
        },
      }],
      combatBuffs: [],
    }
    const store = useBuildStore()

    store.applyAgentConfig("agent_a", meta, {
      wEngineId: legacyId,
      combat: {
        activeBuffIds: [`wEngine:${legacyId}.self`, `wEngine:${legacyId}.team`],
        addedBuffs: [{
          id: `wEngine:${legacyId}.team`,
          sourceCategory: "wEngine",
          sourceKind: "wEngineTeam",
          wEngineModificationLevel: 3,
        }],
      },
    })

    expect(store.wEngineId).toBe(canonicalId)
    expect(store.selectedBuffIds).toEqual([`wEngine:${canonicalId}.self`, `wEngine:${canonicalId}.team`])
    expect(store.addedBuffs[0].id).toBe(`wEngine:${canonicalId}.team`)
    expect(store.activeBuffIds(meta)).toContain(`wEngine:${canonicalId}.self`)
    expect(store.activeBuffIds(meta)).toContain(`wEngine:${canonicalId}.team`)
  })

  it("normalizes missing and non-numeric teammate w-engine ranks to refinement 1", () => {
    const meta = teammateWEngineMeta()
    const store = useBuildStore()
    store.applyAgentConfig("agent_a", meta, { wEngineId: "engine_a" })
    const defaultId = "wEngine:engine_team_default.team"
    const invalidId = "wEngine:engine_team_invalid.team"

    store.applyBuffState({
      selectedBuffIds: [defaultId, invalidId],
      addedBuffs: [
        {
          id: defaultId,
          sourceCategory: "wEngine",
          sourceKind: "wEngineTeam",
        },
        {
          id: invalidId,
          sourceCategory: "wEngine",
          sourceKind: "wEngineTeam",
          wEngineModificationLevel: "not-a-rank",
        },
      ],
      runtimeInputs: {},
    }, meta)

    expect(store.addedBuffs.map(item => item.wEngineModificationLevel)).toEqual([1, 1])
    expect(store.buildInput({}, meta, []).combatBuffs.wEngineTeamModificationLevels).toEqual({
      [defaultId]: 1,
      [invalidId]: 1,
    })
  })

  it("migrates known legacy skill prefixes when loading and applying added buffs", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" }, combatBuffs: {} }],
      wEngines: [],
      combatBuffs: [],
    }
    const legacyBuff = {
      id: "legacy-ultimate",
      sourceCategory: "custom",
      sourceKind: "custom",
      name: { zhCN: "旧终结技 Buff" },
      effects: [{
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["ultimate_"] }] },
      }],
    }

    store.applyAgentConfig("agent_a", meta, { combat: { addedBuffs: [legacyBuff] } })
    expect(store.addedBuffs[0].effects[0].target.skillTargets).toEqual([
      { kind: "skillType", skillType: "ultimate" },
    ])

    store.applyBuffState({ selectedBuffIds: [], addedBuffs: [{
      ...legacyBuff,
      id: "legacy-chain",
      effects: [{
        ...legacyBuff.effects[0],
        target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["chain_"] }] },
      }],
    }] }, meta)
    expect(store.addedBuffs[0].effects[0].target.skillTargets).toEqual([
      { kind: "skillType", skillType: "chain" },
    ])
  })

  it("persists advanced damage, buff runtime, and default-buff exclusions", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{
        id: "agent_a",
        name: { zhCN: "角色 A" },
        coreSkill: { levels: [{ level: "F", label: { zhCN: "F" } }] },
        combatBuffs: { corePassive: { scope: "inCombat", effects: [] } },
      }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" }, effect: { selfBuff: { scope: "inCombat", effects: [] } } }],
      combatBuffs: [{
        id: "teammate_buff",
        effects: [{ id: "stacked", type: "stacked", stat: "atkFlat", value: 10, maxStacks: 3 }],
      }],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.setDamageConfig({
      mode: "custom",
      selectedEventId: "anomaly-1",
      events: [{ id: "anomaly-1", kind: "anomaly", anomalyEffect: "assault", procCount: 1 }],
      target: {
        presetId: "custom",
        defense: 1000,
        stunned: false,
        stunMultiplierPercent: 200,
        resistanceByElement: { physical: 20 },
      },
    })
    store.applyBuffState({
      selectedBuffIds: ["wEngine:engine_a.self", "teammate_buff"],
      runtimeInputs: { teammate_buff: { effects: { stacked: { stacks: 2 } } } },
    }, meta)

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("anomaly-1")
    expect(input.damage.target.defense).toBe(1000)
    expect(input.damage.target.stunned).toBeUndefined()
    expect(input.damage.events[0].stunned).toBe(false)
    expect(store.targetConfig.defense).toBe(1000)
    expect(store.damageConfig.target).toBeUndefined()
    expect(input.combatBuffs.activeBuffIds).not.toContain("agent:agent_a.corePassive")
    expect(input.combatBuffs.runtimeInputs.teammate_buff.effects.stacked.stacks).toBe(2)

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.agent_a.combat.manuallyUncheckedDefaultBuffIds).toContain("agent:agent_a.corePassive")
    expect(saved.byOwner.default.byAgent.agent_a.targetConfig.defense).toBe(1000)
    expect(saved.byOwner.default.byAgent.agent_a.targetConfig.stunned).toBeUndefined()
    expect(saved.byOwner.default.byAgent.agent_a.damage.target).toBeUndefined()
  })

  it("preserves future snapshots and Release event fields through a compatibility save", () => {
    const releaseEvent = {
      id: "release-1",
      kind: "anomaly",
      settlementType: "release",
      anomalyEffect: "corruption",
      triggerActorRef: { agentId: "agent_a", profileId: "aria-release" },
      anomalySource: {
        actorRef: { agentId: "source_agent" },
        snapshot: { agentId: "source_agent", sourceConfigHash: "future-hash" },
      },
      count: 1,
    }
    const sourceSnapshot = {
      agentId: "source_agent",
      sourceConfigHash: "future-hash",
      capturedAt: "2026-07-27T00:00:00.000Z",
    }
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
      version: 2,
      currentOwnerId: "default",
      byOwner: {
        default: {
          currentAgentId: "agent_a",
          byAgent: {
            agent_a: {
              wEngineId: "engine_a",
              lastAnomalySourceSnapshot: sourceSnapshot,
              futureBuildField: { keep: true },
              damage: {
                mode: "custom",
                selectedEventId: "release-1",
                events: [releaseEvent],
              },
            },
          },
        },
      },
    }))
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    const store = useBuildStore()

    store.initialize({}, meta)
    store.persist()

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    const config = saved.byOwner.default.byAgent.agent_a
    expect(config.lastAnomalySourceSnapshot).toEqual(sourceSnapshot)
    expect(config.futureBuildField).toEqual({ keep: true })
    expect(config.damage.events[0]).toMatchObject(releaseEvent)
  })

  it("persists calculation config in an owner-scoped and main-compatible shape", () => {
    localStorage.setItem("zzz-calculator.currentAccount.v1", "alice")
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.setTargetConfig({
      presetId: "custom",
      defense: 1234,
      stunned: false,
      stunMultiplierPercent: 175,
      resistanceByElement: { fire: 20 },
    })
    store.setDamageConfig({
      mode: "custom",
      selectedEventId: "direct-2",
      events: [{ id: "direct-2", kind: "direct", skillMultiplier: 250, count: 1 }],
    })
    store.calculate({}, meta, [])

    const webappSaved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(webappSaved.byOwner.alice.currentAgentId).toBe("agent_a")
    expect(webappSaved.byOwner.alice.byAgent.agent_a.targetConfig.defense).toBe(1234)
    expect(webappSaved.byOwner.alice.byAgent.agent_a.targetConfig.stunned).toBeUndefined()
    expect(webappSaved.byOwner.alice.byAgent.agent_a.damage.events[0].stunned).toBe(true)
    expect(webappSaved.byOwner.alice.byAgent.agent_a.damage.target).toBeUndefined()

    const legacySaved = JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "{}")
    expect(legacySaved.byOwner.alice.currentAgentId).toBe("agent_a")
    expect(legacySaved.byOwner.alice.byAgent.agent_a.damage.target.defense).toBe(1234)
    expect(legacySaved.byOwner.alice.byAgent.agent_a.damage.target.resistanceByElement.fire).toBe(20)
  })

  it("keeps enemy target config when calculation config is saved separately", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.setTargetConfig({
      presetId: "custom",
      defense: 1234,
      stunned: false,
      stunMultiplierPercent: 180,
      resistanceByElement: { physical: 20 },
    })

    store.setDamageConfig({
      mode: "custom",
      selectedEventId: "direct-2",
      events: [{ id: "direct-2", kind: "direct", skillMultiplier: 250, count: 1 }],
    })

    expect(store.targetConfig.defense).toBe(1234)
    expect(store.targetConfig.stunned).toBeUndefined()
    expect(store.damageConfig.target).toBeUndefined()
    expect(store.damageConfig.events[0].stunned).toBe(true)

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("direct-2")
    expect(input.damage.target.defense).toBe(1234)
    expect(input.damage.target.resistanceByElement.physical).toBe(20)
  })

  it("expands skill group references for calculation input without rewriting the saved config", () => {
    const store = useBuildStore()
    const agent = {
      id: "agent_a",
      name: { zhCN: "角色 A" },
      skillGroups: [
        {
          id: "loop",
          name: { zhCN: "一变" },
          defaultCount: 10,
          minCount: 0,
          step: 1,
          events: [{ id: "hit", kind: "direct", skillMultiplier: 100, count: 2 }],
        },
        {
          id: "ultimate",
          name: { zhCN: "一大" },
          defaultCount: 2,
          minCount: 0,
          step: 1,
          events: [{ id: "burst", kind: "direct", skillMultiplier: 500, count: 1 }],
        },
      ],
    }
    const meta = {
      agents: [agent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.setDamageConfig({
      mode: "custom",
      selectedEventId: "loop-ref",
      events: [
        { id: "intro", kind: "direct", skillMultiplier: 50, count: 1 },
        { id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 3, stunned: false },
        { id: "ult-ref", kind: "skillGroup", skillGroupId: "ultimate", count: 2, stunned: true },
      ],
    }, agent)

    expect(store.damageConfig.events.map((event: any) => event.kind)).toEqual(["direct", "skillGroup", "skillGroup"])

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("loop-ref__hit")
    expect(input.damage.events.map((event: any) => event.id)).toEqual(["intro", "loop-ref__hit", "ult-ref__burst"])
    expect(input.damage.events.map((event: any) => event.kind)).toEqual(["direct", "direct", "direct"])
    expect(input.damage.events.map((event: any) => event.count)).toEqual([1, 6, 2])
    expect(input.damage.events.map((event: any) => event.stunned)).toEqual([true, false, true])

    const metaWithoutSkillGroups = {
      ...meta,
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
    }
    const catalogWithSkillGroups = {
      agents: [agent],
      agentsMap: new Map([[agent.id, agent]]),
    }
    const inputFromCatalogFallback = store.buildInput(catalogWithSkillGroups, metaWithoutSkillGroups, [])
    expect(inputFromCatalogFallback.damage.selectedEventId).toBe("loop-ref__hit")
    expect(inputFromCatalogFallback.damage.events.map((event: any) => event.kind)).toEqual(["direct", "direct", "direct"])
    expect(inputFromCatalogFallback.damage.events.map((event: any) => event.count)).toEqual([1, 6, 2])
    expect(inputFromCatalogFallback.damage.events.map((event: any) => event.stunned)).toEqual([true, false, true])
  })

  it("ignores stale saved events when admin default mode uses role skill groups", () => {
    const store = useBuildStore()
    const agent = {
      id: "agent_a",
      name: { zhCN: "角色 A" },
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "loop-ref",
        events: [{ id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 10 }],
      },
      skillGroups: [{
        id: "loop",
        name: { zhCN: "一变" },
        defaultCount: 10,
        minCount: 0,
        step: 1,
        events: [{ id: "real-hit", kind: "direct", skillMultiplier: 500, count: 2 }],
      }],
    }
    const meta = {
      agents: [agent],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
      combatBuffs: [],
    }
    store.agentId = "agent_a"
    store.wEngineId = "engine_a"
    store.setDamageConfig({
      mode: "adminDefault",
      selectedEventId: "stale-direct",
      events: [{ id: "stale-direct", kind: "direct", skillMultiplier: 100, count: 10 }],
    }, agent)

    expect(store.damageConfig.selectedEventId).toBe("loop-ref")
    expect(store.damageConfig.events.map((event: any) => event.kind)).toEqual(["skillGroup"])

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("loop-ref__real-hit")
    expect(input.damage.events).toEqual([
      expect.objectContaining({
        id: "loop-ref__real-hit",
        kind: "direct",
        skillMultiplier: 500,
        count: 20,
      }),
    ])
  })

  it("selects the highest configured admin default loop at or below the current cinema", () => {
    const agent = {
      id: "agent_a",
      name: { zhCN: "角色 A" },
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "loop-0",
        events: [{ id: "loop-0", kind: "direct", skillMultiplier: 100, count: 1 }],
        variants: [
          {
            cinemaLevel: 2,
            mode: "custom",
            selectedEventId: "loop-2",
            events: [{ id: "loop-2", kind: "direct", skillMultiplier: 200, count: 2 }],
          },
          {
            cinemaLevel: 6,
            mode: "custom",
            selectedEventId: "loop-6",
            events: [{ id: "loop-6", kind: "direct", skillMultiplier: 600, count: 6 }],
          },
        ],
      },
    }

    expect(defaultDamageConfig(agent, 0).selectedEventId).toBe("loop-0")
    expect(defaultDamageConfig(agent, 0).mode).toBe("adminDefault")
    expect(defaultDamageConfig(agent, 1).selectedEventId).toBe("loop-0")
    expect(defaultDamageConfig(agent, 2).selectedEventId).toBe("loop-2")
    expect(defaultDamageConfig(agent, 5).selectedEventId).toBe("loop-2")
    expect(defaultDamageConfig(agent, 6).selectedEventId).toBe("loop-6")
  })

  it("refreshes saved admin default events when the current cinema changes", () => {
    const store = useBuildStore()
    const agent = {
      id: "agent_a",
      name: { zhCN: "角色 A" },
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "loop-0",
        events: [{ id: "loop-0", kind: "direct", skillMultiplier: 100, count: 1 }],
        variants: [
          {
            cinemaLevel: 2,
            mode: "custom",
            selectedEventId: "loop-2",
            events: [{ id: "loop-2", kind: "direct", skillMultiplier: 200, count: 2 }],
          },
        ],
      },
    }
    const meta = { agents: [agent], wEngines: [], combatBuffs: [] }

    store.agentId = "agent_a"
    store.setDamageConfig({
      mode: "adminDefault",
      selectedEventId: "stale",
      events: [{ id: "stale", kind: "direct", skillMultiplier: 50, count: 1 }],
    }, agent)
    expect(store.damageConfig.selectedEventId).toBe("loop-0")

    store.setCinemaLevel(5, meta)
    expect(store.damageConfig.selectedEventId).toBe("loop-2")
    expect(store.damageConfig.events[0]).toMatchObject({ id: "loop-2", skillMultiplier: 200 })
  })

  it("normalizes the sheer objective away from non-rupture agents", () => {
    const store = useBuildStore()
    const agent = { id: "agent_a", specialty: "attack" }

    store.setDamageConfig({
      mode: "sheer",
      selectedEventId: "sheer-1",
      events: [{ id: "sheer-1", kind: "sheer", skillMultiplier: 100, count: 1 }],
    }, agent)

    expect(store.damageConfig.mode).toBe("single")
    expect(store.damageConfig.selectedEventId).toBe("direct-1")
    expect(store.damageConfig.events).toHaveLength(1)
    expect(store.damageConfig.events[0].kind).toBe("direct")
  })

  it("normalizes admin default away when the agent has no default calculation", () => {
    expect(normalizeDamageModeForAgent("adminDefault", { id: "agent_a", specialty: "attack" })).toBe("single")
  })

  it("allows admin default mode when the agent only has skill groups", () => {
    expect(normalizeDamageModeForAgent("adminDefault", {
      id: "agent_a",
      specialty: "attack",
      skillGroups: [{
        id: "loop",
        events: [{ id: "hit", kind: "direct", skillMultiplier: 100, count: 1 }],
      }],
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: null,
        events: [],
      },
    })).toBe("adminDefault")
  })

  it("keeps the sheer objective for rupture agents", () => {
    const store = useBuildStore()
    const agent = { id: "agent_a", specialty: "rupture" }

    store.setDamageConfig({
      mode: "sheer",
      selectedEventId: "sheer-1",
      events: [{ id: "sheer-1", kind: "sheer", skillMultiplier: 100, count: 1 }],
    }, agent)

    expect(store.damageConfig.mode).toBe("sheer")
    expect(store.damageConfig.selectedEventId).toBe("sheer-1")
    expect(store.damageConfig.events[0].kind).toBe("sheer")
  })

  it("serializes ordinary build persistence with the drive disc import lock", async () => {
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks")
    const requestedLocks: string[] = []
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, optionsOrCallback: any, maybeCallback?: () => unknown) => {
          requestedLocks.push(name)
          const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback!
          return callback()
        },
      },
    })
    try {
      const store = useBuildStore()
      store.agentId = "agent_a"
      store.agentLevel = 60

      await store.persist()

      expect(requestedLocks).toEqual([
        "zzz-drive-disc-import:store",
      ])
      const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
      expect(saved.byOwner.default.byAgent.agent_a.agentLevel).toBe(60)
    } finally {
      if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks)
      else Reflect.deleteProperty(navigator, "locks")
    }
  })

  it("rejects a queued build save when an import changes the selection documents first", async () => {
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks")
    let releaseGlobalLock!: () => void
    const globalLockGate = new Promise<void>(resolve => {
      releaseGlobalLock = resolve
    })
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, optionsOrCallback: any, maybeCallback?: () => unknown) => {
          const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback!
          if (name === "zzz-drive-disc-import:store") await globalLockGate
          return callback()
        },
      },
    })
    try {
      const store = useBuildStore()
      store.agentId = "agent_a"
      store.agentLevel = 50
      const save = store.persist()
      await Promise.resolve()
      localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({
        version: 2,
        currentOwnerId: "default",
        byOwner: { default: { currentAgentId: "agent_a", byAgent: { agent_a: { agentLevel: 60 } } } },
      }))
      releaseGlobalLock()

      await expect(save).rejects.toThrow("配置在保存期间被导入或其他页面更新")
      const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
      expect(saved.byOwner.default.byAgent.agent_a.agentLevel).toBe(60)
      expect(store.error).toContain("配置在保存期间被导入或其他页面更新")
    } finally {
      if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks)
      else Reflect.deleteProperty(navigator, "locks")
    }
  })
})
