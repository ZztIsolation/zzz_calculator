import { describe, expect, it } from "vitest"
import {
  buffLabelForId,
  buildCombatBuffGroups,
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
            effects: [{ id: "team", type: "fixed", stat: "atkFlat", value: 5 }],
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
    combatBuffs: [],
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

  it("builds the six workbench buff categories from current metadata", () => {
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
    expect(buffLabelForId("driveDisc4pc:set_a.self", context)).toBe("队友套装 4 件套（自身）")
    expect(buffLabelForId("driveDisc4pc:set_a.team", context)).toBe("队友套装 4 件套（团队）")
    expect(teammateDriveDiscSetIdsFromBuffIds(["teammateDriveDisc4pc:set_a"])).toEqual(["set_a"])
  })
})
