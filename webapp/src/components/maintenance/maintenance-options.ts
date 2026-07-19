import { statLabel } from "@core/shared-combat.js"
import { SKILL_TAGS, SKILL_TAG_LABELS, SKILL_TYPES, SKILL_TYPE_LABELS, skillTypeForMove } from "@core/skillTargets.js"
import { internalId, textOf, type SelectOption } from "./maintenance-model"

export const option = (value: string | number, label: string): SelectOption => ({ value, label })

export const RARITY_OPTIONS = [option("S", "S"), option("A", "A"), option("B", "B")]
export const ATTRIBUTE_OPTIONS = [
  option("physical", "物理"), option("fire", "火"), option("ice", "冰"), option("electric", "电"),
  option("ether", "以太"), option("wind", "风"), option("honed_edge", "凛刃"), option("frost", "烈霜"), option("xuanmo", "玄墨"),
]
export const DAMAGE_ELEMENT_OPTIONS = ATTRIBUTE_OPTIONS.filter(item => !["honed_edge", "frost", "xuanmo"].includes(String(item.value)))
export const SPECIALTY_OPTIONS = [
  option("attack", "强攻"), option("stun", "击破"), option("anomaly", "异常"),
  option("support", "支援"), option("defense", "防护"), option("rupture", "命破"),
]
export const SCOPE_OPTIONS = [option("outOfCombat", "局外"), option("inCombat", "局内")]
export const ATTACK_TYPE_OPTIONS = [option("slash", "斩击"), option("pierce", "穿刺"), option("strike", "打击")]
export const TARGET_KIND_OPTIONS = [
  option("default", "常规属性 / 全局效果"),
  option("anomaly", "异常目标"),
  option("specific", "指定角色招式"),
  option("skillType", "通用技能大类"),
  option("skillTag", "通用招式标签"),
]
export const SKILL_TYPE_OPTIONS = SKILL_TYPES.map((value: string) => option(value, SKILL_TYPE_LABELS[value] ?? value))
export const SKILL_TAG_OPTIONS = SKILL_TAGS.map((value: string) => option(value, SKILL_TAG_LABELS[value] ?? value))
export const EFFECT_TYPE_OPTIONS = [
  option("fixed", "固定数值"), option("derived", "按来源数值换算"),
  option("formula", "受限函数换算"), option("stacked", "层数"),
]
export const EFFECT_MODE_OPTIONS = [option("flat", "直接加到面板"), option("pct", "按基准换算")]
export const BASIS_OPTIONS = [
  option("", "默认基准"), option("baseHp", "基础生命值"), option("outOfCombatHp", "局外生命值"),
  option("baseAtk", "基础攻击力"), option("outOfCombatAtk", "局外攻击力"),
  option("baseDef", "基础防御力"), option("outOfCombatDef", "局外防御力"),
]
export const CRIT_MODE_OPTIONS = [option("expected", "期望"), option("crit", "暴击"), option("nonCrit", "非暴击")]
export const EVENT_KIND_OPTIONS = [
  option("direct", "直伤"), option("sheer", "贯穿"), option("anomaly", "属性异常"),
  option("disorder", "紊乱"), option("skillGroup", "技能组"),
]
export const EVENT_SOURCE_OPTIONS = [option("skill", "技能倍率"), option("manual", "手填倍率")]
export const DISORDER_TYPE_OPTIONS = [option("normal", "（普通）紊乱"), option("polarized", "极性紊乱")]
export const ANOMALY_SETTLEMENT_OPTIONS = [option("attribute", "属性异常"), option("disorder", "紊乱")]
export const LEVEL_SCALE_OPTIONS = [option("skill", "技能等级"), option("coreSkill", "核心技等级")]
export const SKILL_ROW_KIND_OPTIONS = [option("damageMultiplier", "伤害倍率"), option("dazeMultiplier", "失衡倍率")]
export const DAMAGE_BASIS_OPTIONS = [option("", "攻击力（默认）"), option("sheerForce", "贯穿力")]
export const CORE_SKILL_LEVELS = ["A", "B", "C", "D", "E", "F"]
export const FORMULA_VALUE_UNIT_OPTIONS = [option("storedValue", "普通数值"), option("storedPercent", "百分比数值")]

const CONDITION_LABELS: Record<string, string> = {
  anySquadAppliesAnomaly: "队伍任意角色施加属性异常",
  anomalyMasteryAtLeast115Or150: "异常掌控达到 115 或 150",
  attributeCounter: "触发属性克制",
  chainOrUltimate: "发动连携技或终结技",
  counterOrPerfectDodge: "发动反击或极限闪避",
  criticalHitWithBasicAttackOrDodgeCounterOrExSpecialAttack: "普通攻击、闪避反击或强化特殊技暴击",
  enemyHasAnomaly: "敌人处于属性异常状态",
  enhancedSpecialPhysicalDamage: "强化特殊技造成物理伤害",
  enterCombatOrSwitchIn: "进入战斗或切入前场",
  etherVeilStartOrExtend: "开启或延长以太帷幕",
  exSpecial: "发动强化特殊技",
  exSpecialHit: "强化特殊技命中",
  exSpecialOrChain: "发动强化特殊技或连携技",
  exSpecialTargetBelowHalfHp: "强化特殊技命中半血以下目标",
  fireChainOrUltimateDamage: "连携技或终结技造成火属性伤害",
  fireExSpecialDamage: "强化特殊技造成火属性伤害",
  friendlyUnitHitEnemy: "友方单位命中敌人",
  hpReduced: "生命值降低",
  languishStacks: "满足迟滞层数条件",
  launchChainAttackOrUltimate: "发动连携技或终结技",
  offField: "位于后台",
  physicalExSpecialDamage: "强化特殊技造成物理伤害",
  specialOrExSpecial: "发动特殊技或强化特殊技",
  specialSkill: "发动特殊技",
  teaStacksAtLeast15: "茶劲达到 15 层",
  threeStacks: "达到 3 层",
  twoStacksAfterWindExSpecialDamage: "风属性强化特殊技后达到 2 层",
  wearerHitEnemy: "佩戴者命中敌人",
}

export function conditionOptions(current = "") {
  const rows = Object.entries(CONDITION_LABELS).map(([value, label]) => option(value, label))
  if (current && !CONDITION_LABELS[current]) rows.push(option(current, conditionLabel(current)))
  return rows
}

export function conditionLabel(value: string) {
  return CONDITION_LABELS[value] ?? (/^[\u3400-\u9fff]/.test(value) ? value : "现有触发条件（保留原值）")
}

export const PANEL_STATS: Array<[string, string, "flat" | "pct"]> = [
  ["atkFlat", "固定攻击力", "flat"], ["atkPct", "百分比攻击力%", "pct"],
  ["hpFlat", "固定生命值", "flat"], ["hpPct", "百分比生命值%", "pct"],
  ["sheerForceFlat", "固定贯穿力", "flat"], ["defFlat", "固定防御力", "flat"], ["defPct", "百分比防御力%", "pct"],
  ["critRate", "暴击率%", "flat"], ["critDmg", "暴击伤害%", "flat"],
  ["impact", "冲击力%", "pct"], ["impactFlat", "固定冲击力", "flat"],
  ["anomalyProficiency", "异常精通", "flat"], ["anomalyMastery", "异常掌控%", "pct"],
  ["anomalyMasteryFlat", "固定异常掌控", "flat"], ["energyRegen", "能量自动回复%", "pct"],
  ["anomalyProficiencyPerMasteryAbove140", "异常掌控超过 140 时每点转异常精通", "flat"],
  ["penFlat", "穿透值", "flat"], ["penRatio", "穿透率%", "flat"],
  ["allResIgnore", "全属性抗性无视%", "flat"],
  ["physicalResIgnore", "物理抗性无视%", "flat"], ["fireResIgnore", "火属性抗性无视%", "flat"],
  ["iceResIgnore", "冰属性抗性无视%", "flat"], ["electricResIgnore", "电属性抗性无视%", "flat"],
  ["etherResIgnore", "以太抗性无视%", "flat"], ["windResIgnore", "风属性抗性无视%", "flat"],
  ["dmgBonus", "伤害加成%", "flat"], ["physicalDmg", "物理伤害加成%", "flat"],
  ["fireDmg", "火属性伤害加成%", "flat"], ["iceDmg", "冰属性伤害加成%", "flat"],
  ["electricDmg", "电属性伤害加成%", "flat"], ["etherDmg", "以太伤害加成%", "flat"], ["windDmg", "风属性伤害加成%", "flat"],
  ["enemyDefReduction", "敌方防御力降低%", "flat"], ["enemyDefIgnore", "无视防御率%", "flat"],
  ["enemyDefFlatReduction", "敌方固定防御力降低", "flat"], ["enemyResReduction", "敌方全属性抗性降低%", "flat"],
  ["enemyPhysicalResReduction", "敌方物理抗性降低%", "flat"], ["enemyFireResReduction", "敌方火抗性降低%", "flat"],
  ["enemyIceResReduction", "敌方冰抗性降低%", "flat"], ["enemyElectricResReduction", "敌方电抗性降低%", "flat"],
  ["enemyEtherResReduction", "敌方以太抗性降低%", "flat"], ["enemyWindResReduction", "敌方风抗性降低%", "flat"],
]

export const EVENT_STATS: Array<[string, string, "flat"]> = [
  ["anomalyDamageBonus", "属性异常增伤%", "flat"], ["disorderDamageBonus", "紊乱增伤%", "flat"],
  ["baseMultiplierBonus", "异常倍率修正%", "flat"], ["disorderBaseMultiplierBonus", "紊乱倍率加算%", "flat"],
  ["anomalyCritRate", "异常暴击率%", "flat"], ["anomalyCritDmg", "异常暴击伤害%", "flat"],
  ["stunDmgMultiplierBonus", "失衡易伤倍率加算%", "flat"],
  ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%", "flat"],
  ["stunDmgMultiplierBonusCapAlways", "捕获的失衡易伤加成上限%", "flat"],
  ["sheerDmgBonus", "贯穿增伤%", "flat"], ["physicalSheerDmg", "物理贯穿增伤%", "flat"],
  ["fireSheerDmg", "火属性贯穿增伤%", "flat"], ["iceSheerDmg", "冰属性贯穿增伤%", "flat"],
  ["electricSheerDmg", "电属性贯穿增伤%", "flat"], ["etherSheerDmg", "以太贯穿增伤%", "flat"],
  ["windSheerDmg", "风属性贯穿增伤%", "flat"],
  ["physicalCritDmg", "物理伤害暴击伤害%", "flat"], ["fireCritDmg", "火属性伤害暴击伤害%", "flat"],
  ["iceCritDmg", "冰属性伤害暴击伤害%", "flat"], ["electricCritDmg", "电属性伤害暴击伤害%", "flat"],
  ["etherCritDmg", "以太伤害暴击伤害%", "flat"], ["windCritDmg", "风属性伤害暴击伤害%", "flat"],
  ["physicalDefIgnore", "物理伤害无视防御率%", "flat"], ["fireDefIgnore", "火属性伤害无视防御率%", "flat"],
  ["iceDefIgnore", "冰属性伤害无视防御率%", "flat"], ["electricDefIgnore", "电属性伤害无视防御率%", "flat"],
  ["etherDefIgnore", "以太伤害无视防御率%", "flat"], ["windDefIgnore", "风属性伤害无视防御率%", "flat"],
]

export const SKILL_TARGET_STATS: Array<[string, string, "flat"]> = [
  ["dmgBonus", "技能目标伤害加成%", "flat"], ["physicalDmg", "物理伤害加成%", "flat"],
  ["fireDmg", "火属性伤害加成%", "flat"], ["iceDmg", "冰属性伤害加成%", "flat"],
  ["electricDmg", "电属性伤害加成%", "flat"], ["etherDmg", "以太伤害加成%", "flat"], ["windDmg", "风属性伤害加成%", "flat"],
  ...EVENT_STATS, ["skillMultiplierBonus", "技能倍率加算%", "flat"],
  ["enemyDefReduction", "敌方防御力降低%", "flat"], ["enemyDefIgnore", "无视防御率%", "flat"],
  ["enemyResReduction", "敌方全属性抗性降低%", "flat"],
  ["allResIgnore", "全属性抗性无视%", "flat"],
  ["physicalResIgnore", "物理抗性无视%", "flat"], ["fireResIgnore", "火属性抗性无视%", "flat"],
  ["iceResIgnore", "冰属性抗性无视%", "flat"], ["electricResIgnore", "电属性抗性无视%", "flat"],
  ["etherResIgnore", "以太抗性无视%", "flat"], ["windResIgnore", "风属性抗性无视%", "flat"],
]

export const ANOMALY_TARGET_STATS: Array<[string, string, "flat"]> = [
  ["anomalyDamageBonus", "属性异常增伤%", "flat"], ["disorderDamageBonus", "紊乱增伤%", "flat"],
  ["baseMultiplierBonus", "异常倍率修正%", "flat"], ["disorderBaseMultiplierBonus", "紊乱倍率加算%", "flat"],
  ["anomalyCritRate", "异常暴击率%", "flat"], ["anomalyCritDmg", "异常暴击伤害%", "flat"],
  ["anomalyDurationBonusSeconds", "异常持续时间延长（秒）", "flat"],
  ["enemyDefReduction", "敌方防御力降低%", "flat"], ["enemyDefIgnore", "无视防御率%", "flat"],
  ["enemyResReduction", "敌方全属性抗性降低%", "flat"], ["allResIgnore", "全属性抗性无视%", "flat"],
  ["physicalResIgnore", "物理抗性无视%", "flat"], ["fireResIgnore", "火属性抗性无视%", "flat"],
  ["iceResIgnore", "冰属性抗性无视%", "flat"], ["electricResIgnore", "电属性抗性无视%", "flat"],
  ["etherResIgnore", "以太抗性无视%", "flat"], ["windResIgnore", "风属性抗性无视%", "flat"],
]

export const EVENT_STAT_KEYS = new Set([...EVENT_STATS, ...ANOMALY_TARGET_STATS].map(([value]) => value))

export function statOptions(catalog: any, targetKind = "default"): SelectOption[] {
  const base = targetKind === "skill"
    ? SKILL_TARGET_STATS
    : targetKind === "anomaly"
      ? ANOMALY_TARGET_STATS
      : [...PANEL_STATS, ...EVENT_STATS]
  const labels = new Map(base.map(([value, label]) => [value, label]))
  for (const value of Object.keys(catalog?.meta?.statRules?.statDisplay ?? {})) {
    const allowed = targetKind === "skill"
      ? SKILL_TARGET_STATS.some(([key]) => key === value)
      : targetKind === "anomaly"
        ? ANOMALY_TARGET_STATS.some(([key]) => key === value)
        : true
    if (allowed) labels.set(value, labels.get(value) || statLabel(value, catalog?.meta))
  }
  return [...labels].map(([value, label]) => option(value, label))
}

export function defaultModeForStat(stat: string) {
  return PANEL_STATS.find(([value]) => value === stat)?.[2] === "pct" ? "pct" : "flat"
}

export function agentOptions(catalog: any) {
  return (catalog?.agents?.agents ?? []).map((agent: any) => option(agent.id, [textOf(agent.name), labelFor(ATTRIBUTE_OPTIONS, agent.attribute), labelFor(SPECIALTY_OPTIONS, agent.specialty)].filter(Boolean).join(" · ")))
}

export function agentSkillOptions(catalog: any) {
  return (catalog?.agentSkills?.agentSkills ?? []).map((skill: any) => {
    const agent = (catalog?.agents?.agents ?? []).find((item: any) => item.id === skill.agentId)
    return option(skill.id, [textOf(agent?.name), textOf(skill.name)].filter(Boolean).join(" · ") || "未命名技能表")
  })
}

export function skillById(catalog: any, id: string) {
  return (catalog?.agentSkills?.agentSkills ?? []).find((item: any) => item.id === id)
}

export function categoryOptions(catalog: any, skillId: string) {
  return (skillById(catalog, skillId)?.categories ?? []).map((item: any) => option(item.id, textOf(item.name) || "未命名大类"))
}

export function moveOptions(catalog: any, skillId: string, categoryId: string, includeAll = false) {
  const category = (skillById(catalog, skillId)?.categories ?? []).find((item: any) => item.id === categoryId)
  const rows = (category?.moves ?? []).map((item: any) => option(item.id, textOf(item.name) || "未命名招式"))
  return includeAll ? [option("", "不限招式"), ...rows] : rows
}

export function rowOptions(catalog: any, skillId: string, categoryId: string, moveId: string, includeAll = false) {
  const category = (skillById(catalog, skillId)?.categories ?? []).find((item: any) => item.id === categoryId)
  const move = (category?.moves ?? []).find((item: any) => item.id === moveId)
  const rows = (move?.rows ?? []).map((item: any) => option(item.id, textOf(item.label) || "未命名倍率行"))
  return includeAll ? [option("", "整招式"), ...rows] : rows
}

export function skillTypeOptionsForSkill(catalog: any, skillId: string) {
  const values = new Set<string>()
  for (const category of skillById(catalog, skillId)?.categories ?? []) {
    for (const move of category.moves ?? []) {
      const skillType = skillTypeForMove(category, move)
      if (skillType) values.add(skillType)
    }
  }
  return SKILL_TYPE_OPTIONS.filter(item => values.has(String(item.value)))
}

export function categoryForSkillType(catalog: any, skillId: string, skillType: string) {
  return (skillById(catalog, skillId)?.categories ?? []).find((category: any) =>
    (category.moves ?? []).some((move: any) => skillTypeForMove(category, move) === skillType))
}

export function specificMoveOptions(catalog: any, skillId: string, skillType: string) {
  const category = categoryForSkillType(catalog, skillId, skillType)
  const moves = (category?.moves ?? [])
    .filter((move: any) => skillTypeForMove(category, move) === skillType)
    .map((move: any) => option(move.id, textOf(move.name) || "未命名招式"))
  return [option("", "该角色此大类的全部招式"), ...moves]
}

export function labelFor(options: SelectOption[], value: any) {
  return options.find(item => item.value === value)?.label ?? ""
}

export function defaultSkillTarget(catalog: any, preferredSkillId = "") {
  const skill = skillById(catalog, preferredSkillId) ?? (catalog?.agentSkills?.agentSkills ?? [])[0]
  const skillType = String(skillTypeOptionsForSkill(catalog, skill?.id ?? "")[0]?.value ?? "basic")
  const category = categoryForSkillType(catalog, skill?.id ?? "", skillType)
  return { kind: "specific", agentSkillId: skill?.id ?? "", categoryId: category?.id ?? "", skillType }
}

export function defaultGeneralSkillTargets() {
  return [{ kind: "skillType", skillType: "basic" }]
}

export function defaultEffectRule() {
  return { id: internalId("effect"), type: "fixed", target: { kind: "default" }, stat: "atkFlat", mode: "flat", value: 0 }
}

export function defaultCalculationEvent(kind = "direct") {
  const base: any = { id: internalId("event"), kind, count: 1, stunned: true }
  if (kind === "anomaly") return { ...base, settlementType: "attribute", anomalyEffect: "assault", procCount: 1 }
  if (kind === "disorder") return { ...base, kind: "anomaly", settlementType: "disorder", disorderType: "normal", anomalyEffect: "burn", elapsedSeconds: 0 }
  if (kind === "skillGroup") return { ...base, kind: "skillGroup", skillGroupId: "" }
  return { ...base, critMode: "expected", skillMultiplier: 100, damageElement: "physical", __source: "manual" }
}

export const ANOMALY_VARIANT_OPTIONS = [option("normal", "普通异常"), option("polarizedAssault", "极性强击")]
export const CALCULATION_DAMAGE_BASIS_OPTIONS = [option("atk", "攻击力"), option("anomalyProficiency", "异常精通")]

export function anomalyOptions(catalog: any, disorder = false) {
  return (catalog?.anomalyEffects?.effects ?? [])
    .filter((item: any) => disorder ? item.settlementType === "disorder" : item.settlementType !== "disorder")
    .map((item: any) => option(item.id, textOf(item.label) || "未命名结算"))
}

export function buffCandidates(catalog: any) {
  const rows: Array<{ value: string, label: string, effects: any[] }> = []
  for (const teammate of catalog?.combatBuffs?.teammates ?? []) {
    for (const buff of teammate.buffs ?? []) rows.push({ value: buff.id, label: `${textOf(teammate.name)}｜${textOf(buff.source) || "未命名 Buff"}`, effects: buff.effects ?? [] })
  }
  for (const buff of catalog?.combatBuffs?.fieldBuffs ?? []) rows.push({ value: buff.id, label: `场地｜${textOf(buff.name) || textOf(buff.source)}｜${textOf(buff.sourcePeriod)}`, effects: buff.effects ?? [] })
  for (const buff of catalog?.combatBuffs?.bossBuffs ?? []) rows.push({ value: buff.id, label: `Boss｜${textOf(buff.bossName)}｜${textOf(buff.bossSource)}`, effects: buff.effects ?? [] })
  return rows
}

export function effectSummary(effect: any, catalog: any) {
  const stat = effect.stat ? statOptions(catalog, effect.target?.kind).find(item => item.value === effect.stat)?.label : ""
  return [stat || effect.kind || "效果", Number.isFinite(Number(effect.value ?? effect.valuePerStack)) ? String(effect.value ?? effect.valuePerStack) : ""].filter(Boolean).join(" +")
}
