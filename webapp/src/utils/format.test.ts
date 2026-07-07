import { describe, expect, it } from "vitest"
import {
  attributeLabel,
  buffDisplayName,
  buffEffectLines,
  buffSubtitle,
  damageEventNeedsSkillMultiplier,
  damageEventSummaryTitle,
  damageEventTitle,
  entityMetaText,
  entitySearchText,
  entitySelectLabel,
  rarityLabelText,
  skillCategoryLabel,
  specialtyLabel,
} from "@/utils/format"
import agentsData from "../../../data/agents.json"
import agentSkillsData from "../../../data/agent_skills.json"

describe("format helpers", () => {
  it("localizes enum labels used by agents and w-engines", () => {
    expect(specialtyLabel("anomaly")).toBe("异常")
    expect(attributeLabel("physical")).toBe("物理属性")
    expect(attributeLabel("honed_edge")).toBe("凛刃")
    expect(rarityLabelText("S")).toBe("S级")
  })

  it("keeps unknown enum values visible as their raw ids", () => {
    expect(specialtyLabel("unknown-specialty")).toBe("unknown-specialty")
    expect(attributeLabel("unknown-attribute")).toBe("unknown-attribute")
    expect(rarityLabelText("X")).toBe("X")
  })

  it("builds localized entity labels while keeping raw ids searchable", () => {
    const item = {
      id: "alice",
      name: { zhCN: "爱丽丝", en: "Alice" },
      specialty: "anomaly",
      attribute: "physical",
      rarity: "S",
    }

    expect(entityMetaText(item)).toBe("异常 / S级")
    expect(entitySelectLabel(item)).toBe("爱丽丝 / 异常 / S级")
    expect(entitySearchText(item)).toContain("anomaly")
    expect(entitySearchText(item)).toContain("异常")
    expect(entitySearchText(item)).toContain("physical")
    expect(entitySearchText(item)).toContain("物理属性")
    expect(entitySearchText(item)).toContain("Alice")
  })

  it("uses the shared Chinese combat buff display name", () => {
    expect(buffDisplayName({
      id: "teammate_buff",
      sourceCategory: "agent",
      sourceKind: "teammate",
      ownerName: { zhCN: "妮可" },
      source: { zhCN: "核心被动" },
    })).toBe("妮可 | 核心被动")
  })

  it("formats concrete combat buff effects for cards", () => {
    const lines = buffEffectLines({
      effects: [{ id: "crit", type: "fixed", stat: "critRate", value: 10 }],
    })

    expect(lines.join(" ")).toContain("暴击率")
    expect(lines.join(" ")).toContain("10%")
  })

  it("hides raw buff condition ids behind readable subtitles", () => {
    expect(buffSubtitle({
      conditionLabel: "threeStacks",
      description: { zhCN: "叠满后全队暴击伤害提升。" },
    })).toBe("叠满后全队暴击伤害提升。")
    expect(buffSubtitle({
      conditionLabel: { zhCN: "对于【防护】角色，能够触发以下效果" },
      description: { zhCN: "装备者开启特殊状态时，使全队暴击伤害提升。" },
    })).toBe("装备者开启特殊状态时，使全队暴击伤害提升。")
    expect(buffSubtitle({ conditionLabel: { zhCN: "对于【支援】角色，能够触发以下效果" } }))
      .toBe("对于【支援】角色，能够触发以下效果")
  })

  it("localizes skill category ids", () => {
    expect(skillCategoryLabel("basic")).toBe("普通攻击")
    expect(skillCategoryLabel("dodge")).toBe("闪避")
    expect(skillCategoryLabel("special", { id: "special" })).toBe("特殊技")
  })

  it("formats default calculation skill refs with player-facing skill names", () => {
    const miyabi = (agentsData as any).agents.find((agent: any) => agent.id === "hoshimi_miyabi")
    const skillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "hoshimi_miyabi")
    const event = miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_frost_moon_charge_3")
    const meta = { agentSkills: [skillCatalog] }

    const title = damageEventTitle(event, meta, skillCatalog)

    expect(title).toContain("普通攻击")
    expect(title).toContain("强化普攻：霜月")
    expect(title).toContain("三段蓄力斩击伤害倍率")
    expect(title).not.toContain("miyabi_frost_moon_charge_3")
    expect(title).not.toMatch(/\bcharge_3\b/)
  })

  it("prefers a resolved skill ref over manual multiplier text", () => {
    const miyabi = (agentsData as any).agents.find((agent: any) => agent.id === "hoshimi_miyabi")
    const skillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "hoshimi_miyabi")
    const event = {
      ...miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_frost_moon_charge_3"),
      skillMultiplier: 100,
    }
    const meta = { agentSkills: [skillCatalog] }

    const title = damageEventTitle(event, meta, skillCatalog)

    expect(title).toContain("强化普攻：霜月")
    expect(title).not.toContain("手填倍率")
  })

  it("compacts direct skill events for the workbench event summary", () => {
    const miyabi = (agentsData as any).agents.find((agent: any) => agent.id === "hoshimi_miyabi")
    const skillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "hoshimi_miyabi")
    const meta = { agentSkills: [skillCatalog] }

    expect(damageEventSummaryTitle(
      miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_ex_flying_snow_slash"),
      meta,
      skillCatalog,
    )).toBe("强化特殊技：飞雪 / 斩击 ×2")
    expect(damageEventSummaryTitle(
      miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_chain_spring_arrival"),
      meta,
      skillCatalog,
    )).toBe("连携技：春临 ×1")
    expect(damageEventSummaryTitle(
      miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_frozen_disorder"),
      meta,
      skillCatalog,
    )).toContain("紊乱 · 烈霜霜寒紊乱（星见雅） ×2")
    expect(damageEventSummaryTitle(
      miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_shatter"),
      meta,
      skillCatalog,
    )).toContain("属性异常 · 碎冰 ×2")
  })

  it("does not require a manual multiplier when a skill ref resolves", () => {
    const miyabi = (agentsData as any).agents.find((agent: any) => agent.id === "hoshimi_miyabi")
    const skillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "hoshimi_miyabi")
    const event = {
      ...miyabi.defaultCalculationConfig.events.find((item: any) => item.id === "miyabi_frost_moon_charge_3"),
      skillMultiplier: undefined,
    }
    const meta = { agentSkills: [skillCatalog] }

    expect(damageEventNeedsSkillMultiplier(event, meta, skillCatalog)).toBe(false)
    expect(damageEventNeedsSkillMultiplier({ id: "manual", kind: "direct", skillMultiplier: undefined }, meta, skillCatalog)).toBe(true)
  })

  it("falls back to Chinese anomaly labels instead of raw effect ids", () => {
    expect(damageEventTitle({ kind: "anomaly", anomalyEffect: "shatter", count: 2 }))
      .toContain("碎冰")
    const disorderTitle = damageEventTitle({ kind: "anomaly", settlementType: "disorder", anomalyEffect: "frost_frozen", count: 1 })
    expect(disorderTitle).toContain("紊乱 · 烈霜霜寒紊乱（星见雅）")
    expect(disorderTitle).not.toContain("异常紊乱")
  })
})
