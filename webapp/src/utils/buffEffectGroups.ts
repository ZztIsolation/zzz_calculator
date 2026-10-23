/*
 * Buff 弹窗的“效果”筛选：按 Buff 实际改动的属性归类，用于列表上方的筛选标签。
 * 只看属性 id 的命名，不涉及数值计算；归不进任何一类的放到“其他”。
 */
export type BuffEffectGroup = "atk" | "crit" | "dmg" | "pen" | "res" | "anomaly" | "stun" | "survival" | "energy" | "other"

export const BUFF_EFFECT_GROUPS: ReadonlyArray<{ id: BuffEffectGroup, label: string }> = [
  { id: "atk", label: "攻击" },
  { id: "crit", label: "暴击" },
  { id: "dmg", label: "增伤" },
  { id: "pen", label: "穿透·减防" },
  { id: "res", label: "抗性" },
  { id: "anomaly", label: "异常" },
  { id: "stun", label: "失衡·冲击" },
  { id: "survival", label: "生命·防御" },
  { id: "energy", label: "能量" },
  { id: "other", label: "其他" },
]

// 顺序有意义：先认更具体的前缀，避免 enemyDefIgnore 被当成防御、anomalyCritDmg 被当成暴击
const RULES: ReadonlyArray<[RegExp, BuffEffectGroup]> = [
  [/(ResIgnore|ResReduction)$/, "res"],
  [/(DefIgnore$|^enemyDef|^pen)/, "pen"],
  [/^(stun|impact)/, "stun"],
  [/^(anomaly|disorder|turbulence|laceration|alienation|release)/, "anomaly"],
  [/crit/i, "crit"],
  [/^(atk|sheerForce)/, "atk"],
  [/^(hp|def)/, "survival"],
  [/^energy/, "energy"],
  [/(Dmg|DamageBonus|^dmgBonus|^skillMultiplier|^imbuement)/, "dmg"],
]

export function effectGroupForStat(stat: unknown): BuffEffectGroup {
  const id = String(stat ?? "")
  if (!id) return "other"
  return RULES.find(([pattern]) => pattern.test(id))?.[1] ?? "other"
}

/** 一条 Buff 涉及的全部效果分类（去重）；没有可识别属性时为“其他” */
export function effectGroupsForRules(rules: ReadonlyArray<{ stat?: unknown }>): Set<BuffEffectGroup> {
  const groups = new Set<BuffEffectGroup>()
  for (const rule of rules) groups.add(effectGroupForStat(rule?.stat))
  if (!groups.size) groups.add("other")
  return groups
}
