import { describe, expect, it } from "vitest"
import {
  buffLabelForId,
  buildCombatBuffGroups,
  teamWEngineBuffCandidates,
  teammateDriveDiscSetIdsFromBuffIds,
} from "@/utils/combatBuffs"

describe("combat buff display helpers", () => {
  const meta = {
    agents: [{
        id: "agent_a",
        name: { zhCN: "角色甲" },
        images: { portrait: "/assets/agents/agent-a.png" },
        combatBuffs: {
        corePassive: {
          scope: "inCombat",
          effects: [{ id: "atk", type: "fixed", stat: "atkFlat", value: 10 }],
        },
        cinemaBuffs: [{
          cinemaLevel: 1,
          scope: "inCombat",
          cinemaName: { zhCN: "影画一" },
          effects: [{ id: "dmg", type: "fixed", stat: "dmgBonus", value: 0.1 }],
        }],
      },
    }],
    wEngines: [
      {
        id: "engine_self",
        name: { zhCN: "当前音擎" },
        images: { icon: "/assets/w-engines/engine-self.png" },
        modification: { minLevel: 1, maxLevel: 5 },
        effect: {
          name: { zhCN: "当前音擎被动" },
          selfBuff: {
            scope: "inCombat",
            effects: [{ id: "self", type: "fixed", stat: "atkFlat", value: 10 }],
          },
          teamBuff: {
            scope: "inCombat",
            effects: [{ id: "team", type: "fixed", stat: "atkFlat", value: 5 }],
          },
        },
      },
      {
        id: "engine_team",
        name: { zhCN: "队友音擎" },
        images: { icon: "/assets/w-engines/engine-team.png" },
        modification: { minLevel: 1, maxLevel: 5 },
        effect: {
          teamBuff: {
            scope: "inCombat",
            effects: [{
              id: "team",
              type: "fixed",
              stat: "atkFlat",
              value: 5,
              modificationValues: { value: [5, 10, 15, 20, 25] },
            }],
          },
        },
      },
    ],
    teammateCombatBuffGroups: [{
      id: "teammate_a",
      name: { zhCN: "队友甲" },
      buffs: [{
        id: "teammate_buff",
        source: { zhCN: "强化特殊技" },
        effects: [{ id: "atk", type: "fixed", stat: "atkFlat", value: 10 }],
      }],
    }],
    combatBuffs: [{
      id: "field.defense_v5.v3_0.p2.jijing_chefeng",
      sourceType: "field",
      sourceCategory: "field",
      sourceKind: "field",
      source: { zhCN: "防卫战 v5" },
      sourcePeriod: { zhCN: "3.0版本第二期" },
      period: {
        modeId: "defense_v5",
        gameVersion: "3.0",
        phaseNo: 2,
        phaseName: { zhCN: "第二期" },
      },
      name: { zhCN: "极境彻风" },
      description: { zhCN: "场地 Buff" },
      effects: [{ id: "field-dmg", type: "fixed", stat: "dmgBonus", value: 10 }],
    }, {
      id: "boss.encounter.a",
      bossId: "boss.a",
      sourceType: "boss",
      bossName: { zhCN: "测试 Boss" },
      appearances: [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 3 }],
      effects: [{ id: "boss-dmg", type: "fixed", stat: "dmgBonus", value: 10 }],
    }],
  }
  const driveDiscSets = [{
    id: "set_a",
    name: { zhCN: "队友套装" },
    images: { icon: "/assets/drive-discs/set-a.png" },
    fourPiece: {
      teamBuff: {
        condition: { zhCN: "队友触发" },
        effects: [{ id: "set", type: "fixed", stat: "atkFlat", value: 10 }],
      },
    },
  }]

  it("builds the workbench buff categories from current metadata", () => {
    const groups = buildCombatBuffGroups({
      meta,
      driveDiscSets,
      agentId: "agent_a",
      cinemaLevel: 1,
      wEngineId: "engine_self",
      wEngineModificationLevel: 1,
    })

    expect(groups.self.map(item => item.id)).toEqual([
      "agent:agent_a.corePassive",
      "agent:agent_a.cinema.1",
    ])
    expect(groups.selfWEngine.map(item => item.id)).toEqual([
      "wEngine:engine_self.self",
      "wEngine:engine_self.team",
    ])
    expect(groups.teammate.map(item => item.id)).toEqual(["teammate_buff"])
    expect(groups.teammateWEngine.map(item => item.id)).toEqual(["wEngine:engine_team.team"])
    expect(groups.teammateDriveDisc.map(item => item.id)).toEqual(["teammateDriveDisc4pc:set_a"])
    expect(groups.field.map(item => item.id)).toEqual(["field.defense_v5.v3_0.p2.jijing_chefeng"])
    expect(groups.boss.map(item => item.id)).toEqual(["boss.encounter.a"])
    expect(groups.field[0].period.gameVersion).toBe("3.0")
    expect(groups.field[0].period.phaseNo).toBe(2)
    expect(groups.self[0].agentImages?.portrait).toBe("/assets/agents/agent-a.png")
    expect(groups.selfWEngine[0].ownerImages?.icon).toBe("/assets/w-engines/engine-self.png")
    expect(groups.teammateWEngine[0].ownerImages?.icon).toBe("/assets/w-engines/engine-team.png")
    expect(groups.teammateDriveDisc[0].images?.icon).toBe("/assets/drive-discs/set-a.png")
  })

  it("returns Chinese labels and teammate drive-disc set ids", () => {
    const context = {
      meta,
      driveDiscSets,
      agentId: "agent_a",
      cinemaLevel: 1,
      wEngineId: "engine_self",
      wEngineModificationLevel: 1,
    }

    expect(buffLabelForId("agent:agent_a.corePassive", context)).toBe("角色甲 | 核心被动")
    expect(buffLabelForId("teammate_buff", context)).toBe("队友甲 | 强化特殊技")
    expect(buffLabelForId("field.defense_v5.v3_0.p2.jijing_chefeng", context)).toBe("极境彻风")
    expect(buffLabelForId("driveDisc4pc:set_a.self", context)).toBe("队友套装 4 件套（自身）")
    expect(buffLabelForId("driveDisc4pc:set_a.team", context)).toBe("队友套装 4 件套（团队）")
    expect(teammateDriveDiscSetIdsFromBuffIds(["teammateDriveDisc4pc:set_a"])).toEqual(["set_a"])
  })

  it("preserves teammate group order and each group's authored Buff order", () => {
    const orderedMeta = {
      teammateCombatBuffGroups: [
        {
          id: "teammate_first",
          name: { zhCN: "第一位队友" },
          buffs: [
            { id: "first.additional", source: { zhCN: "额外能力" }, effects: [] },
            { id: "first.core", source: { zhCN: "核心被动" }, effects: [] },
          ],
        },
        {
          id: "teammate_second",
          name: { zhCN: "第二位队友" },
          buffs: [{ id: "second.cinema", source: { zhCN: "影画一" }, effects: [] }],
        },
      ],
      combatBuffs: [],
    }

    expect(buildCombatBuffGroups({ meta: orderedMeta }).teammate.map(item => item.id)).toEqual([
      "first.additional",
      "first.core",
      "second.cinema",
    ])
  })

  it("materializes teammate w-engine candidates at their independent refinement level", () => {
    const candidateAt = (level?: number) => teamWEngineBuffCandidates(
      meta,
      "engine_self",
      level === undefined
        ? []
        : [{
            id: "wEngine:engine_team.team",
            sourceCategory: "wEngine",
            sourceKind: "wEngineTeam",
            wEngineModificationLevel: level,
          }],
    )[0]

    const rank1 = candidateAt()
    const rank3 = candidateAt(3)
    const rank5 = candidateAt(5)

    expect(rank1).toEqual(expect.objectContaining({
      id: "wEngine:engine_team.team",
      isTeammateWEngine: true,
      wEngineModificationLevel: 1,
      wEngineModificationMin: 1,
      wEngineModificationMax: 5,
    }))
    expect(rank1.effects[0].value).toBe(5)
    expect(rank3.effects[0].value).toBe(15)
    expect(rank5.effects[0].value).toBe(25)

    const rangedMeta = {
      ...meta,
      wEngines: meta.wEngines.map(wEngine => wEngine.id === "engine_team"
        ? { ...wEngine, modification: { minLevel: 2, maxLevel: 4, defaultLevel: 2 } }
        : wEngine),
    }
    expect(teamWEngineBuffCandidates(rangedMeta, "engine_self")[0]).toEqual(expect.objectContaining({
      wEngineModificationLevel: 2,
      wEngineModificationMin: 2,
      wEngineModificationMax: 4,
    }))
  })

  it("keeps teammate w-engine references out of custom rows and includes refinement in labels", () => {
    const addedBuffs = [
      {
        id: "wEngine:engine_team.team",
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        wEngineModificationLevel: 5,
      },
      {
        id: "custom-a",
        sourceCategory: "custom",
        sourceKind: "custom",
        name: { zhCN: "自定义 A" },
        stats: [{ stat: "atkFlat", value: 10 }],
      },
    ]
    const context = {
      meta,
      driveDiscSets,
      agentId: "agent_a",
      cinemaLevel: 1,
      wEngineId: "engine_self",
      wEngineModificationLevel: 1,
      addedBuffs,
    }

    const groups = buildCombatBuffGroups(context)

    expect(groups.custom.map(item => item.id)).toEqual(["custom-a"])
    expect(groups.teammateWEngine[0].wEngineModificationLevel).toBe(5)
    expect(buffLabelForId("wEngine:engine_team.team", context)).toBe("队友音擎（队友携带） · 精 5")
  })

  it("merges rich Boss archive metadata into generic combat Buff candidates", () => {
    const richMeta = {
      ...meta,
      bossCombatBuffs: [{
        id: "boss.encounter.a",
        sourceType: "boss",
        bossId: "boss.a",
        bossName: { zhCN: "测试 Boss" },
        target: { defense: 952, weaknessElements: ["ice"], resistanceElements: ["fire"] },
        playerBuffs: [{ id: "boss-player-buff", calculationStatus: "modeled" }],
        playerDebuffs: [],
        appearances: [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 3 }],
      }],
    }

    const groups = buildCombatBuffGroups({ meta: richMeta })

    expect(groups.boss[0]).toEqual(expect.objectContaining({
      id: "boss.encounter.a",
      target: expect.objectContaining({ defense: 952 }),
      playerBuffs: [expect.objectContaining({ id: "boss-player-buff" })],
    }))
    expect(groups.boss[0].effects).toHaveLength(1)
  })
})
