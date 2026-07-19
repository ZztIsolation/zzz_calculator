import { describe, expect, it } from "vitest"
import { cloneForCreate, maskedPreview, prepareDraft } from "./maintenance-model"
import { agentOptions, EVENT_STATS, PANEL_STATS } from "./maintenance-options"

describe("maintenance structured model", () => {
  it("uses the unified Disorder multiplier stat instead of physical-only variants", () => {
    const removedStats = ["physicalDisorderMultiplierBonusPerRemainingSecond", "physicalDisorderMultiplierBonusCap"]
    expect(PANEL_STATS.some(([stat]) => removedStats.includes(stat))).toBe(false)
    expect(EVENT_STATS.some(([stat]) => stat === "disorderBaseMultiplierBonus")).toBe(true)
  })

  it("materializes nested ids without inventing a top-level id", () => {
    const draft = prepareDraft("agent-skills", {
      name: { zhCN: "技能" },
      categories: [{ name: { zhCN: "大类" }, moves: [{ name: { zhCN: "招式" }, rows: [{ label: { zhCN: "倍率" }, values: [1] }] }] }],
    })
    expect(draft.id).toBeUndefined()
    expect(draft.categories[0].id).toMatch(/^skill_category_/)
    expect(draft.categories[0].moves[0].id).toMatch(/^skill_move_/)
    expect(draft.categories[0].moves[0].rows[0].id).toMatch(/^skill_row_/)
    expect(draft.categories[0].moves[0].skillType).toBe("basic")
  })

  it("migrates known legacy skill prefixes while preserving unknown targets for correction", () => {
    const draft = prepareDraft("agents", {
      combatBuffs: {
        corePassive: {
          effects: [{
            target: {
              kind: "skill",
              skillTargets: [
                { categoryId: "chain", moveIdPrefixes: ["chain_"] },
                { categoryId: "chain", moveIdPrefixes: ["ultimate_"] },
                { categoryId: "chain", moveIdPrefixes: ["future_"] },
              ],
            },
          }],
        },
      },
    })
    expect(draft.combatBuffs.corePassive.effects[0].target.skillTargets).toEqual([
      { kind: "skillType", skillType: "chain" },
      { kind: "skillType", skillType: "ultimate" },
      { categoryId: "chain", moveIdPrefixes: ["future_"] },
    ])
  })

  it("migrates known legacy element filters into explicit stats and shared stacks", () => {
    const draft = prepareDraft("w-engines", {
      effect: {
        selfBuff: {
          effects: [{
            id: "legacy-crit",
            type: "stacked",
            stat: "critDmg",
            mode: "flat",
            valuePerStack: 2,
            maxStacks: 3,
            defaultStacks: 3,
            appliesTo: { elements: ["ice", "fire"] },
          }],
          buffModifiers: [{ id: "modifier", targetEffectIds: ["legacy-crit"], targetBuffIds: [], factor: 2 }],
        },
      },
    })
    const rules = draft.effect.selfBuff.effects
    expect(rules.map((rule: any) => rule.stat)).toEqual(["iceCritDmg", "fireCritDmg"])
    expect(rules[0].stackGroup).toBe(rules[1].stackGroup)
    expect(rules.every((rule: any) => rule.appliesTo === undefined)).toBe(true)
    expect(draft.effect.selfBuff.buffModifiers[0].targetEffectIds).toEqual(rules.map((rule: any) => rule.id))
  })

  it("preserves unsupported old filters so validation can block saving", () => {
    const draft = prepareDraft("agents", {
      combatBuffs: {
        corePassive: {
          effects: [{
            id: "legacy-anomaly",
            type: "fixed",
            stat: "anomalyDamageBonus",
            mode: "flat",
            value: 20,
            appliesTo: { anomalyEffects: ["burn"] },
          }],
        },
      },
    })
    expect(draft.combatBuffs.corePassive.effects[0].appliesTo).toEqual({ anomalyEffects: ["burn"] })
  })

  it("regenerates owned ids and rewrites internal references when cloning", () => {
    const source = {
      id: "buff_a",
      source: { zhCN: "Buff" },
      effects: [{ id: "effect_a", type: "fixed", stat: "atkPct", value: 1 }],
      buffModifiers: [{ id: "modifier_a", targetBuffIds: ["buff_a"], targetEffectIds: ["effect_a"], factor: 2 }],
    }
    const copy = cloneForCreate("boss-buffs", source)
    expect(copy.id).toBeUndefined()
    expect(copy.effects[0].id).not.toBe("effect_a")
    expect(copy.buffModifiers[0].id).not.toBe("modifier_a")
    expect(copy.buffModifiers[0].targetEffectIds).toEqual([copy.effects[0].id])
  })

  it("regenerates shared stack groups while preserving links inside a copy", () => {
    const source = {
      id: "engine_a",
      name: { zhCN: "音擎" },
      effect: {
        selfBuff: {
          effects: [
            { id: "effect_a", type: "stacked", stat: "etherDmg", stackGroup: "shared_stack", stackLabel: { zhCN: "共享层数" }, valuePerStack: 1 },
            { id: "effect_b", type: "stacked", stat: "etherSheerDmg", stackGroup: "shared_stack", stackLabel: { zhCN: "共享层数" }, valuePerStack: 1 },
          ],
        },
      },
    }
    const copy = cloneForCreate("w-engines", source)
    expect(copy.effect.selfBuff.effects[0].stackGroup).not.toBe("shared_stack")
    expect(copy.effect.selfBuff.effects[1].stackGroup).toBe(copy.effect.selfBuff.effects[0].stackGroup)
  })

  it("remaps owned calculation references without changing equal-valued external ids", () => {
    const source = {
      id: "agent_a",
      name: { zhCN: "角色" },
      skillGroups: [{ id: "group_a", name: { zhCN: "循环" }, events: [] }],
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "event_a",
        events: [{ id: "event_a", kind: "skillGroup", skillGroupId: "group_a", skillRef: { agentSkillId: "agent_a" } }],
      },
    }
    const copy = cloneForCreate("agents", source)
    expect(copy.skillGroups[0].id).not.toBe("group_a")
    expect(copy.defaultCalculationConfig.events[0].id).not.toBe("event_a")
    expect(copy.defaultCalculationConfig.selectedEventId).toBe(copy.defaultCalculationConfig.events[0].id)
    expect(copy.defaultCalculationConfig.events[0].skillGroupId).toBe(copy.skillGroups[0].id)
    expect(copy.defaultCalculationConfig.events[0].skillRef.agentSkillId).toBe("agent_a")
  })

  it("masks every internal identity from the read-only preview", () => {
    expect(maskedPreview({
      id: "a",
      agentId: "b",
      targetBuffIds: ["c"],
      moveIdPrefixes: ["ultimate_"],
      stackGroup: "shared_stack",
      name: { zhCN: "可见" },
    })).toEqual({ name: { zhCN: "可见" } })
  })

  it("migrates parent coverage to effect rules while preserving the admin default", () => {
    const draft = prepareDraft("agents", {
      name: { zhCN: "角色" },
      skillGroups: [{
        id: "group_a",
        name: { zhCN: "循环" },
        defaultCount: 9,
        minCount: 2,
        maxCount: 3,
        step: 0.5,
        events: [],
      }],
      combatBuffs: {
        corePassive: {
          coverage: { default: 0.4, min: 0.2, max: 0.8, step: 0.2 },
          effects: [{ id: "covered-effect", type: "fixed", stat: "dmgBonus", value: 10, mode: "flat" }],
          buffModifiers: [],
        },
        additionalAbility: null,
        cinemaBuffs: [],
      },
    })
    expect(draft.skillGroups[0]).toMatchObject({ defaultCount: 1, minCount: 0, maxCount: 100, step: 1 })
    expect(draft.combatBuffs.corePassive.coverage).toBeUndefined()
    expect(draft.combatBuffs.corePassive.effects[0].coverage).toEqual({ default: 0.4, min: 0, max: 1, step: 0.1 })
    const preview = maskedPreview(draft)
    expect(preview.skillGroups[0]).not.toHaveProperty("defaultCount")
    expect(preview.skillGroups[0]).not.toHaveProperty("minCount")
    expect(preview.skillGroups[0]).not.toHaveProperty("maxCount")
    expect(preview.skillGroups[0]).not.toHaveProperty("step")
    expect(preview.combatBuffs.corePassive.effects[0].coverage).toEqual({ default: "40%" })
  })

  it("builds human-readable relation choices", () => {
    const catalog = { agents: { agents: [{ id: "agent_a", name: { zhCN: "角色甲" }, attribute: "fire", specialty: "attack" }] } }
    const choices = agentOptions(catalog)
    expect(choices).toEqual([{ label: "角色甲 · 火 · 强攻", value: "agent_a" }])
  })

  it("preserves unknown fields without adding effect arrays to a four-piece wrapper", () => {
    const draft = prepareDraft("drive-disc-sets", {
      id: "set_a",
      name: { zhCN: "套装" },
      images: { icon: "", source: "" },
      unknownLegalField: { retained: true },
      twoPiece: { effects: [] },
      fourPiece: { effectText: { zhCN: "说明" }, selfBuff: null, teamBuff: null },
    })
    expect(draft.unknownLegalField).toEqual({ retained: true })
    expect(draft.fourPiece.effects).toBeUndefined()
    expect(draft.fourPiece.buffModifiers).toBeUndefined()
  })

  it("preserves explicit move tags and Drive Disc skill-tag targets", () => {
    const skills = prepareDraft("agent-skills", {
      categories: [{
        name: { zhCN: "闪避" },
        moves: [{
          name: { zhCN: "冲刺攻击" },
          skillType: "dodge",
          skillTags: ["dashAttack"],
          rows: [{ label: { zhCN: "伤害倍率" }, values: [100] }],
        }],
      }],
    })
    expect(skills.categories[0].moves[0].skillTags).toEqual(["dashAttack"])

    const set = prepareDraft("drive-disc-sets", {
      name: { zhCN: "标签套装" },
      twoPiece: {
        effects: [{
          type: "fixed",
          stat: "dmgBonus",
          value: 15,
          target: {
            kind: "skill",
            skillTargets: [{ kind: "skillTag", skillTag: "dashAttack" }],
          },
          condition: { zhCN: "冲刺攻击命中" },
          durationSeconds: 8,
          cooldownSeconds: 1,
          requirement: { specialty: "attack" },
        }],
      },
    })
    expect(set.twoPiece.effects[0]).toMatchObject({
      target: {
        kind: "skill",
        skillTargets: [{ kind: "skillTag", skillTag: "dashAttack" }],
      },
      durationSeconds: 8,
      cooldownSeconds: 1,
      requirement: { specialty: "attack" },
    })
  })
})
