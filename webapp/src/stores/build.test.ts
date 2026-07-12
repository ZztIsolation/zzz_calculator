import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import { defaultDamageConfig, normalizeDamageModeForAgent, useBuildStore } from "@/stores/build"

describe("build store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
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
    expect(input.damage.target.stunned).toBe(true)
    expect(input.combatBuffs.activeBuffIds).toContain("agent:agent_a.corePassive")
    expect(input.combatBuffs.activeBuffIds).toContain("agent:agent_a.cinema.1")
    expect(input.combatBuffs.activeBuffIds).toContain("wEngine:engine_a.self")
    expect(input.combatBuffs.activeBuffIds).toContain("teammate_buff")
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

  it("passes teammate drive-disc team buffs through the core input shape", () => {
    const store = useBuildStore()
    const meta = {
      agents: [{ id: "agent_a", name: { zhCN: "角色 A" } }],
      wEngines: [{ id: "engine_a", name: { zhCN: "音擎 A" } }],
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
            coverage: { default: 1 },
            effects: [{ id: "self", type: "fixed", stat: "dmgBonus", value: 10 }],
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
        "driveDisc4pc:set_a.self": { coverage: 0.25, effects: { self: { enabled: true } } },
      },
    })

    expect(input.combatBuffs.activeBuffIds).toContain("driveDisc4pc:set_a.self")
    expect(input.combatBuffs.runtimeInputs["driveDisc4pc:set_a.self"].coverage).toBe(0.25)
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
    expect(input.combatBuffs.runtimeInputs["wEngine:engine_team.team"].coverage).toBe(0.5)
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
    expect(input.damage.target.stunned).toBe(false)
    expect(store.targetConfig.defense).toBe(1000)
    expect(store.damageConfig.target).toBeUndefined()
    expect(input.combatBuffs.activeBuffIds).not.toContain("agent:agent_a.corePassive")
    expect(input.combatBuffs.runtimeInputs.teammate_buff.effects.stacked.stacks).toBe(2)

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    expect(saved.byOwner.default.byAgent.agent_a.combat.manuallyUncheckedDefaultBuffIds).toContain("agent:agent_a.corePassive")
    expect(saved.byOwner.default.byAgent.agent_a.targetConfig.defense).toBe(1000)
    expect(saved.byOwner.default.byAgent.agent_a.damage.target).toBeUndefined()
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
    expect(store.targetConfig.stunned).toBe(false)
    expect(store.damageConfig.target).toBeUndefined()

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
          maxCount: 30,
          step: 1,
          events: [{ id: "hit", kind: "direct", skillMultiplier: 100, count: 2 }],
        },
        {
          id: "ultimate",
          name: { zhCN: "一大" },
          defaultCount: 2,
          minCount: 0,
          maxCount: 10,
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
        { id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 3 },
        { id: "ult-ref", kind: "skillGroup", skillGroupId: "ultimate", count: 2 },
      ],
    }, agent)

    expect(store.damageConfig.events.map((event: any) => event.kind)).toEqual(["direct", "skillGroup", "skillGroup"])

    const input = store.buildInput({}, meta, [])
    expect(input.damage.selectedEventId).toBe("loop-ref__hit")
    expect(input.damage.events.map((event: any) => event.id)).toEqual(["intro", "loop-ref__hit", "ult-ref__burst"])
    expect(input.damage.events.map((event: any) => event.kind)).toEqual(["direct", "direct", "direct"])
    expect(input.damage.events.map((event: any) => event.count)).toEqual([1, 6, 2])

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
        maxCount: 30,
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
})
