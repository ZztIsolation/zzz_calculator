import {
  applySystemManagedMaintenanceFields,
  SYSTEM_MANAGED_SKILL_GROUP_COUNTS,
} from "@core/maintenanceValidation.js"
import { legacySkillTypeForMove, normalizeSkillTargetsInValue } from "@core/skillTargets.js"
import { normalizeLegacyEffectAppliesToInValue } from "@core/effectRuleTargets.js"

export type ResourceValue =
  | "agents"
  | "agent-skills"
  | "w-engines"
  | "drive-disc-sets"
  | "anomaly-effects"
  | "teammate-buffs"
  | "field-buffs"
  | "boss-buffs"

export interface SelectOption {
  label: string
  value: string | number
  [key: string]: unknown
}

export interface CreateOptions {
  name?: string
  agentId?: string
  anomalyType?: "anomaly" | "disorder"
  teammateMode?: "new" | "existing"
  teammateId?: string
  modeId?: string
  gameVersion?: string
  phaseNo?: number
  bossMode?: "new" | "existing"
  bossId?: string
}

const FIELD_LABELS: Record<string, string> = {
  name: "名称",
  label: "标签",
  zhCN: "中文",
  en: "英文",
  rarity: "稀有度",
  attribute: "显示属性",
  damageElement: "伤害属性",
  specialty: "特性",
  faction: "阵营",
  attackTypes: "攻击类型",
  images: "图片",
  portrait: "角色立绘",
  icon: "图标",
  source: "来源",
  sources: "资料来源",
  hidden: "前台隐藏",
  level60: "60 级属性",
  hpBase: "基础生命值",
  atkBase: "基础攻击力",
  defBase: "基础防御力",
  critRate: "暴击率",
  critDmg: "暴击伤害",
  impact: "冲击力",
  anomalyProficiency: "异常精通",
  anomalyMastery: "异常掌控",
  energyRegen: "能量自动回复",
  penRatio: "穿透率",
  combatBuffs: "角色 Buff",
  corePassive: "核心被动",
  additionalAbility: "额外能力",
  cinemaBuffs: "影画 Buff",
  cinemaLevel: "影画等级",
  cinemaName: "影画名称",
  defaultChecked: "默认启用",
  description: "说明",
  condition: "触发条件",
  conditionLabel: "条件标签",
  scope: "生效范围",
  coverage: "覆盖率",
  default: "默认值",
  min: "最小值",
  max: "最大值",
  step: "步长",
  durationSeconds: "持续时间（秒）",
  cooldownSeconds: "冷却时间（秒）",
  effects: "效果规则",
  buffModifiers: "Buff 修饰器",
  type: "规则类型",
  stat: "增益属性",
  mode: "计算方式",
  basis: "计算基准",
  value: "数值",
  valuePerStack: "每层数值",
  maxStacks: "最大层数",
  defaultStacks: "默认层数",
  stackGroup: "共享层数组",
  sourceLabel: "来源名称",
  defaultSourceValue: "默认来源数值",
  ratio: "转换比例",
  ratioPct: "转换比例",
  cap: "数值上限",
  formula: "公式",
  expression: "公式表达式",
  valueUnit: "数值单位",
  target: "增幅目标",
  kind: "类型",
  appliesTo: "旧筛选",
  damageKinds: "旧事件种类筛选",
  anomalyEffects: "异常效果",
  anomalyDurationBonusSeconds: "异常持续时间延长（秒）",
  elements: "元素",
  skillTargets: "技能目标",
  agentSkillId: "角色",
  categoryId: "技能目录",
  skillType: "技能大类",
  moveId: "招式",
  rowId: "倍率行",
  factor: "倍率",
  operation: "处理方式",
  targetBuffIds: "目标 Buff",
  targetEffectIds: "目标效果",
  preferredDriveDiscs: "推荐驱动盘",
  defaultSetId: "默认套装",
  mainStatLimits: "主词条限制",
  skillGroups: "技能组",
  defaultCount: "默认次数",
  minCount: "最少次数",
  maxCount: "最多次数",
  events: "计算事件",
  defaultCalculationConfig: "默认计算配置",
  variants: "影画配置变体",
  selectedEventId: "目标事件",
  count: "次数",
  damageRatioPct: "伤害比例%",
  critMode: "暴击模式",
  skillMultiplier: "技能倍率",
  elapsedSeconds: "已生效时间（秒）",
  procCount: "结算次数",
  anomalyEffect: "异常效果",
  anomalyVariant: "异常形态",
  skillRef: "技能引用",
  skillGroupId: "技能组",
  categories: "技能大类",
  levelScale: "等级类型",
  levelRange: "等级范围",
  moves: "招式",
  rows: "倍率行",
  values: "各等级数值",
  damageBasis: "伤害基准",
  advancedStat: "高级属性",
  relatedAgentId: "关联角色",
  modification: "改装等级",
  minLevel: "最低改装等级",
  maxLevel: "最高改装等级",
  defaultLevel: "默认改装等级",
  requirement: "生效要求",
  appliesToOutOfCombatPanel: "应用于局外面板",
  selfBuff: "佩戴者效果",
  teamBuff: "团队效果",
  buff: "Buff 效果",
  effect: "音擎效果",
  twoPiece: "2 件套",
  fourPiece: "4 件套",
  effectText: "效果文案",
  settlementType: "结算类型",
  element: "元素",
  baseMultiplier: "基础倍率",
  defaultProcCount: "默认结算次数",
  fixedMultiplier: "固定倍率",
  tickMultiplier: "每跳倍率",
  tickIntervalSeconds: "跳伤间隔（秒）",
  defaultDurationSeconds: "默认持续时间（秒）",
  period: "版本与期数",
  modeId: "玩法模式",
  gameVersion: "游戏版本",
  phaseNo: "期数",
  phaseName: "期数名称",
  sourcePeriod: "来源期数",
  bossName: "Boss 名称",
  bossSource: "Boss 来源",
  verification: "校验记录",
}

function options(...entries: Array<[string | number, string]>): SelectOption[] {
  return entries.map(([value, label]) => ({ value, label }))
}

const ENUM_OPTIONS: Record<string, SelectOption[]> = {
  rarity: options(["S", "S"], ["A", "A"], ["B", "B"]),
  attribute: options(
    ["physical", "物理"], ["fire", "火"], ["ice", "冰"], ["electric", "电"], ["ether", "以太"],
    ["wind", "风"], ["honed_edge", "凛刃"], ["frost", "烈霜"], ["xuanmo", "玄墨"],
  ),
  damageElement: options(["physical", "物理"], ["fire", "火"], ["ice", "冰"], ["electric", "电"], ["ether", "以太"], ["wind", "风"]),
  element: options(["physical", "物理"], ["fire", "火"], ["ice", "冰"], ["electric", "电"], ["ether", "以太"], ["wind", "风"]),
  specialty: options(["attack", "强攻"], ["stun", "击破"], ["anomaly", "异常"], ["support", "支援"], ["defense", "防护"], ["rupture", "命破"]),
  scope: options(["outOfCombat", "局外面板"], ["inCombat", "局内战斗"]),
  mode: options(["flat", "固定值"], ["pct", "百分比"]),
  basis: options(["baseHp", "基础生命"], ["outOfCombatHp", "局外生命"], ["baseAtk", "基础攻击"], ["outOfCombatAtk", "局外攻击"], ["baseDef", "基础防御"], ["outOfCombatDef", "局外防御"]),
  critMode: options(["expected", "期望伤害"], ["crit", "必定暴击"], ["nonCrit", "不暴击"]),
  levelScale: options(["skill", "技能等级"], ["coreSkill", "核心技等级"]),
  damageBasis: options(["atk", "攻击力"], ["sheerForce", "贯穿力"], ["anomalyProficiency", "异常精通"]),
  anomalyVariant: options(["normal", "普通异常"], ["polarizedAssault", "极性强击"]),
  modeId: options(["defense_v5", "式舆防卫战"], ["critical_assault", "危局强袭战"]),
  gameVersion: options(["3.0", "3.0 版本"], ["3.1", "3.1 版本"], ["3.2", "3.2 版本"], ["3.3", "3.3 版本"]),
  phaseNo: options([1, "第 1 期"], [2, "第 2 期"], [3, "第 3 期"], [4, "第 4 期"]),
  operation: options(["multiplyResolvedValue", "乘算已解析效果"]),
  valueUnit: options(["storedValue", "普通数值"], ["storedPercent", "百分比数值"]),
  attackTypes: options(["slash", "斩击"], ["pierce", "穿刺"], ["strike", "打击"]),
}

export function deepClone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function textOf(value: any): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  return String(value.zhCN ?? value.en ?? "")
}

export function internalId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 10)
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 10)
  return `${prefix}_${random}`
}

function ensureId(item: any, prefix: string) {
  if (item && typeof item === "object" && !Array.isArray(item) && !item.id) item.id = internalId(prefix)
  return item
}

function normalizeEffectRule(rule: any) {
  ensureId(rule, "effect")
  if (rule.type === "damageModifier") {
    const skillTargets = rule.appliesTo?.skillTargets ?? []
    const rawValue = Number(rule.value ?? 0)
    rule.type = "fixed"
    rule.stat = rule.kind === "directDamageBonus" ? "dmgBonus" : rule.kind
    rule.value = rule.valueUnit === "decimal" || Math.abs(rawValue) <= 1 ? rawValue * 100 : rawValue
    rule.mode = "flat"
    rule.target = skillTargets.length ? { kind: "skill", skillTargets } : { kind: "default" }
  }
  rule.type ??= "fixed"
  rule.target ??= { kind: "default" }
  rule.stat ??= "atkFlat"
  rule.mode ??= "flat"
  if (rule.type === "derived") {
    rule.sourceLabel ??= { zhCN: "来源数值" }
    rule.defaultSourceValue ??= 0
    rule.ratio ??= 0
  }
  if (rule.type === "formula") {
    rule.source ??= { variable: "x", label: { zhCN: "来源数值" }, defaultValue: 0 }
    rule.source.label ??= { zhCN: "来源数值" }
    rule.formula ??= { expression: "", valueUnit: "storedValue" }
  }
  if (rule.type === "stacked") {
    rule.valuePerStack ??= Number(rule.value ?? 0)
    rule.maxStacks ??= 1
    rule.defaultStacks ??= rule.maxStacks
  }
  return rule
}

function ensureEffectIds(effect: any) {
  if (!effect || typeof effect !== "object") return
  if (Array.isArray(effect.effects)) effect.effects.forEach(normalizeEffectRule)
  if (Array.isArray(effect.buffModifiers)) effect.buffModifiers.forEach((item: any) => ensureId(item, "modifier"))
}

function ensureCalculationConfigIds(config: any) {
  if (!config || typeof config !== "object") return
  if (Array.isArray(config.events)) config.events.forEach((event: any) => {
    ensureId(event, "event")
    event.stunned ??= true
  })
  if (Array.isArray(config.variants)) config.variants.forEach(ensureCalculationConfigIds)
}

export function prepareDraft(resource: ResourceValue, input: any): any {
  const item = normalizeLegacyEffectAppliesToInValue(normalizeSkillTargetsInValue(deepClone(input ?? {})))
  if (resource === "agents") {
    item.name ??= { zhCN: "" }
    item.damageElement ??= ""
    item.attackTypes ??= []
    item.images ??= { portrait: "", source: "" }
    item.level60 ??= {}
    item.sources ??= []
    item.preferredDriveDiscs ??= {}
    item.preferredDriveDiscs.defaultSetId ??= ""
    item.preferredDriveDiscs.mainStatLimits ??= {}
    for (const slot of [4, 5, 6]) item.preferredDriveDiscs.mainStatLimits[String(slot)] ??= []
    item.combatBuffs ??= { corePassive: null, additionalAbility: null, cinemaBuffs: [] }
    item.combatBuffs.cinemaBuffs ??= []
    ensureEffectIds(item.combatBuffs.corePassive)
    ensureEffectIds(item.combatBuffs.additionalAbility)
    item.combatBuffs.cinemaBuffs.forEach(ensureEffectIds)
    item.skillGroups ??= []
    item.skillGroups.forEach((group: any) => {
      ensureId(group, "skill_group")
      group.name ??= { zhCN: "" }
      group.description ??= { zhCN: "" }
      Object.assign(group, SYSTEM_MANAGED_SKILL_GROUP_COUNTS)
      group.events ??= []
      group.events.forEach((event: any) => {
        ensureId(event, "event")
        event.stunned ??= true
      })
    })
    ensureCalculationConfigIds(item.defaultCalculationConfig)
    if (item.defaultCalculationConfig) {
      item.defaultCalculationConfig.cinemaLevel ??= 0
      item.defaultCalculationConfig.name ??= { zhCN: "默认方案" }
      item.defaultCalculationConfig.mode ??= "custom"
      item.defaultCalculationConfig.events ??= []
      item.defaultCalculationConfig.variants ??= []
      item.defaultCalculationConfig.variants.forEach((variant: any, index: number) => {
        variant.cinemaLevel ??= index + 1
        variant.name ??= { zhCN: `${variant.cinemaLevel}影默认方案` }
        variant.mode ??= "custom"
        variant.events ??= []
      })
    }
    if (item.coreSkill) {
      item.coreSkill.name ??= { zhCN: "核心技" }
      item.coreSkill.defaultLevel ??= "F"
      item.coreSkill.maxLevel ??= "F"
      item.coreSkill.levels ??= []
      item.coreSkill.sources ??= []
    }
  } else if (resource === "agent-skills") {
    item.name ??= { zhCN: "" }
    item.sources ??= []
    item.categories ??= []
    item.categories.forEach((category: any) => {
      ensureId(category, "skill_category")
      category.name ??= { zhCN: "" }
      category.levelScale ??= Array.isArray(category.levelRange?.levels) ? "coreSkill" : "skill"
      category.levelRange ??= category.levelScale === "coreSkill" ? { levels: ["A", "B", "C", "D", "E", "F"], default: "F" } : { min: 1, max: 12, default: 12 }
      category.moves ??= []
      category.moves.forEach((move: any) => {
        ensureId(move, "skill_move")
        move.name ??= { zhCN: "" }
        move.skillType ||= legacySkillTypeForMove(category, move) || "basic"
        move.skillTags ??= []
        move.damageElement ??= "physical"
        move.rows ??= []
        move.rows.forEach((row: any) => {
          ensureId(row, "skill_row")
          row.label ??= { zhCN: "" }
          row.kind ??= "damageMultiplier"
          row.values ??= []
        })
      })
    })
  } else if (resource === "w-engines") {
    item.name ??= { zhCN: "" }
    item.images ??= { icon: "", source: "" }
    item.sources ??= []
    item.level60 ??= { atkBase: 0, advancedStat: { stat: "critDmg", value: 0, mode: "flat" } }
    item.level60.advancedStat ??= { stat: "critDmg", value: 0, mode: "flat" }
    item.modification ??= { minLevel: 1, maxLevel: 5, defaultLevel: 1 }
    item.effect ??= { name: { zhCN: "" }, description: { zhCN: "" }, selfBuff: null, teamBuff: null }
    item.effect.name ??= { zhCN: "" }
    item.effect.description ??= { zhCN: "", en: "" }
    item.effect.requirement ??= { specialty: item.specialty ?? "" }
    if (!item.effect.selfBuff && item.effect.buff) item.effect.selfBuff = item.effect.buff
    ensureEffectIds(item.effect.selfBuff ?? item.effect.buff)
    ensureEffectIds(item.effect.teamBuff)
  } else if (resource === "drive-disc-sets") {
    item.name ??= { zhCN: "" }
    item.images ??= { icon: "", source: "" }
    item.sources ??= []
    item.twoPiece ??= null
    item.fourPiece ??= null
    if (item.fourPiece) {
      item.fourPiece.effectText ??= { zhCN: "", en: "" }
      item.fourPiece.selfBuff ??= null
      item.fourPiece.teamBuff ??= null
    }
    ensureEffectIds(item.twoPiece)
    ensureEffectIds(item.fourPiece?.selfBuff)
    ensureEffectIds(item.fourPiece?.teamBuff)
  } else if (resource === "teammate-buffs" && Array.isArray(item.buffs)) {
    item.name ??= { zhCN: "" }
    item.attribute ??= ""
    item.specialty ??= ""
    item.images ??= { icon: "", source: "" }
    item.buffs = item.buffs.map((buff: any) => prepareDraft(resource, buff))
  } else if (resource === "boss-buffs" && Array.isArray(item.encounters)) {
    item.name ??= { zhCN: "" }
    item.aliases ??= []
    item.images ??= { icon: "", source: "" }
    item.target ??= { defense: 952, weaknessElements: [], resistanceElements: [], resistanceOverrides: {} }
    item.target.weaknessElements ??= []
    item.target.resistanceElements ??= []
    item.target.resistanceOverrides ??= {}
    item.encounters = item.encounters.map((encounter: any) => prepareDraft(resource, encounter))
  } else if (["teammate-buffs", "field-buffs", "boss-buffs"].includes(resource)) {
    item.scope ??= "inCombat"
    item.description ??= { zhCN: "" }
    item.effects ??= []
    item.buffModifiers ??= []
    if (resource === "teammate-buffs") item.source ??= { zhCN: "" }
    if (resource === "field-buffs") {
      item.name ??= { zhCN: "" }
      item.period ??= { modeId: "defense_v5", gameVersion: "3.0", phaseNo: 1 }
    }
    if (resource === "boss-buffs") {
      const isEncounter = Array.isArray(item.appearances)
        || item.enemyIntel !== undefined
        || item.playerBuffs !== undefined
        || item.playerDebuffs !== undefined
      if (isEncounter) {
        delete item.scope
        delete item.description
        delete item.effects
        delete item.buffModifiers
        delete item.mechanics
        delete item.scoreRules
        item.appearances ??= [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 1, startDate: "", endDate: "" }]
        item.enemyIntel ??= { zhCN: "" }
        item.recommendedSpecialties ??= []
        item.playerBuffs ??= []
        item.playerDebuffs ??= []
        item.sources ??= []
        for (const group of [item.playerBuffs, item.playerDebuffs]) {
          group.forEach((entry: any) => {
            ensureId(entry, "boss_effect")
            entry.name ??= { zhCN: "" }
            entry.description ??= { zhCN: "" }
            entry.calculationStatus ??= "descriptiveOnly"
            entry.effects ??= []
            entry.buffModifiers ??= []
            ensureEffectIds(entry)
          })
        }
      }
    }
    ensureEffectIds(item)
  }
  return applySystemManagedMaintenanceFields(item)
}

function localizedName(name: string) {
  return { zhCN: name || "未命名" }
}

function blankEffectSet(scope = "inCombat") {
  return {
    scope,
    effects: [defaultArrayItem("effects")],
    buffModifiers: [],
  }
}

function blankSkillCategory() {
  return {
    id: internalId("skill_category"),
    name: localizedName("新技能大类"),
    levelScale: "skill",
    levelRange: { min: 1, max: 12, default: 12 },
    moves: [defaultArrayItem("moves")],
  }
}

export function blankRecord(resource: ResourceValue, catalog: any, options: CreateOptions = {}): any {
  const name = options.name?.trim() || "未命名"
  if (resource === "agents") {
    return prepareDraft(resource, {
      name: localizedName(name), rarity: "S", attribute: "physical", damageElement: "physical", specialty: "attack",
      attackTypes: [], faction: "", images: { portrait: "", source: "" },
      level60: { hpBase: 1, atkBase: 1, defBase: 1, critRate: 5, critDmg: 50, impact: 0, anomalyProficiency: 0, anomalyMastery: 0, energyRegen: 120, penRatio: 0 },
      combatBuffs: { corePassive: null, additionalAbility: null, cinemaBuffs: [] },
      preferredDriveDiscs: { mainStatLimits: { 4: [], 5: [], 6: [] } }, skillGroups: [], defaultCalculationConfig: null,
      sources: [], verification: {}, hidden: false,
    })
  }
  if (resource === "agent-skills") {
    return prepareDraft(resource, { agentId: options.agentId ?? catalog?.agents?.agents?.[0]?.id ?? "", name: localizedName(name), categories: [blankSkillCategory()], sources: [], verification: {} })
  }
  if (resource === "w-engines") {
    return prepareDraft(resource, {
      name: localizedName(name), rarity: "S", specialty: "attack", attribute: "physical", images: { icon: "", source: "" },
      level60: { atkBase: 1, advancedStat: { stat: "critDmg", value: 1, mode: "flat" } },
      modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
      effect: { name: localizedName("新音擎效果"), requirement: { specialty: "attack" }, description: localizedName("待填写"), selfBuff: null, teamBuff: null },
      sources: [], verification: {}, hidden: false,
    })
  }
  if (resource === "drive-disc-sets") {
    return prepareDraft(resource, { name: localizedName(name), images: { icon: "", source: "" }, sources: [], twoPiece: null, fourPiece: null, hidden: false })
  }
  if (resource === "anomaly-effects") {
    return options.anomalyType === "disorder"
      ? { maintenanceType: "disorder", settlementType: "disorder", label: localizedName(name), element: "physical", fixedMultiplier: 4.5, tickMultiplier: 0, tickIntervalSeconds: 1, defaultDurationSeconds: 10 }
      : { maintenanceType: "anomaly", settlementType: "attribute", label: localizedName(name), element: "physical", baseMultiplier: 1, defaultProcCount: 1 }
  }
  if (resource === "teammate-buffs") {
    const teammate = options.teammateMode === "existing"
      ? deepClone((catalog?.combatBuffs?.teammates ?? []).find((item: any) => item.id === options.teammateId) ?? {})
      : { name: localizedName(name), attribute: "", specialty: "", images: { icon: "", source: "" }, buffs: [] }
    teammate.id ||= internalId("teammate")
    teammate.buffs ??= []
    teammate.buffs.push(prepareDraft(resource, {
      id: internalId("buff"), source: localizedName("新 Buff"), description: localizedName("待填写"), scope: "inCombat",
      effects: [defaultArrayItem("effects")], buffModifiers: [], hidden: false,
    }))
    return teammate
  }
  if (resource === "field-buffs") {
    return prepareDraft(resource, {
      sourceType: "field", scope: "inCombat",
      period: { modeId: options.modeId ?? "defense_v5", gameVersion: options.gameVersion ?? "3.0", phaseNo: options.phaseNo ?? 1, phaseName: localizedName(`第 ${options.phaseNo ?? 1} 期`) },
      name: localizedName(name), source: localizedName("场地效果"), sourcePeriod: localizedName(""), description: localizedName("待填写"),
      effects: [defaultArrayItem("effects")], buffModifiers: [], hidden: false,
    })
  }
  const existingBoss = options.bossMode === "existing"
    ? deepClone((catalog?.bosses?.bosses ?? []).find((item: any) => item.id === options.bossId) ?? {})
    : {
        id: internalId("boss"),
        name: localizedName(name),
        aliases: [],
        images: { icon: "", source: "" },
        target: { defense: 952, weaknessElements: [], resistanceElements: [], resistanceOverrides: {} },
        encounters: [],
        hidden: false,
      }
  existingBoss.encounters ??= []
  existingBoss.encounters.push({
    id: internalId("boss_encounter"),
    appearances: [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 1, startDate: "", endDate: "" }],
    enemyIntel: localizedName("待填写"),
    recommendedSpecialties: [],
    playerBuffs: [],
    playerDebuffs: [],
    sources: [],
    hidden: false,
  })
  return prepareDraft(resource, existingBoss)
}

export function defaultValueForPath(path: string): any {
  const key = path.split(".").at(-1) ?? ""
  if (["corePassive", "additionalAbility", "selfBuff", "teamBuff", "buff"].includes(key)) return blankEffectSet("inCombat")
  if (key === "twoPiece") return { effects: [defaultArrayItem("effects")] }
  if (key === "fourPiece") return { effectText: localizedName("待填写"), selfBuff: blankEffectSet("inCombat"), teamBuff: null }
  if (key === "defaultCalculationConfig") return { mode: "custom", name: localizedName("默认方案"), events: [defaultArrayItem("events")] }
  return {}
}

export function defaultArrayItem(path: string, parent?: any): any {
  const key = path.split(".").at(-1) ?? path
  if (key === "effects") return { id: internalId("effect"), type: "fixed", target: { kind: "default" }, stat: "atkFlat", mode: "flat", value: 1 }
  if (key === "buffModifiers") return { id: internalId("modifier"), operation: "multiplyResolvedValue", factor: 1, targetBuffIds: [], targetEffectIds: [], label: localizedName("") }
  if (key === "cinemaBuffs") return { cinemaLevel: Math.min(6, (parent?.length ?? 0) + 1), cinemaName: localizedName("新影画"), description: localizedName("待填写"), scope: "inCombat", defaultChecked: false, effects: [defaultArrayItem("effects")], buffModifiers: [] }
  if (key === "categories") return blankSkillCategory()
  if (key === "moves") return { id: internalId("skill_move"), name: localizedName("新招式"), skillType: "basic", skillTags: [], damageElement: "physical", rows: [defaultArrayItem("rows")] }
  if (key === "rows") return { id: internalId("skill_row"), label: localizedName("新倍率行"), kind: "damageMultiplier", values: [0] }
  if (key === "skillGroups") return { id: internalId("skill_group"), name: localizedName("新技能组"), description: localizedName(""), ...SYSTEM_MANAGED_SKILL_GROUP_COUNTS, events: [defaultArrayItem("events")] }
  if (key === "events") return { id: internalId("event"), kind: "direct", count: 1, critMode: "expected", skillMultiplier: 100, damageElement: "physical" }
  if (key === "variants") return { cinemaLevel: 1, name: localizedName("影画方案"), mode: "custom", events: [defaultArrayItem("events")] }
  if (key === "skillTargets") return {}
  if (key === "values") return 0
  return ""
}

export function cloneForCreate(resource: ResourceValue, input: any): any {
  const item = deepClone(input)
  const replacements = new Map<string, string>()
  const ownedKeys = new Set(["id"])
  const internalReferenceKeys = new Set(["selectedEventId", "skillGroupId"])
  const internalReferenceListKeys = new Set(["targetBuffIds", "targetEffectIds"])
  function remap(value: any, path = "") {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => remap(entry, `${path}[${index}]`))
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (ownedKeys.has(key) && typeof child === "string" && child) {
        const prefix = child.split(/[_.-]/)[0] || "item"
        const next = replacements.get(child) ?? internalId(prefix)
        replacements.set(child, next)
        value[key] = next
      } else if (key === "stackGroup" && typeof child === "string" && child) {
        const next = replacements.get(child) ?? internalId("stack")
        replacements.set(child, next)
        value[key] = next
      } else {
        remap(child, path ? `${path}.${key}` : key)
      }
    }
  }
  remap(item)
  function rewrite(value: any, parentKey = "") {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (internalReferenceListKeys.has(parentKey) && typeof value[index] === "string" && replacements.has(value[index])) value[index] = replacements.get(value[index])
        else rewrite(value[index], parentKey)
      }
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (internalReferenceKeys.has(key) && typeof child === "string" && replacements.has(child)) value[key] = replacements.get(child)
        else rewrite(child, key)
      }
    }
  }
  rewrite(item)
  if (resource !== "teammate-buffs" && resource !== "field-buffs" && (resource !== "boss-buffs" || !Array.isArray(item.appearances))) delete item.id
  return prepareDraft(resource, item)
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function displayLabelForRecord(resource: ResourceValue, item: any): string {
  if (!item) return "未选择资料"
  if (resource === "teammate-buffs") return textOf(item.name) || "未命名队友"
  if (resource === "anomaly-effects") return textOf(item.label) || "未命名异常"
  if (resource === "boss-buffs") return textOf(item.name ?? item.bossName) || "未命名 Boss"
  return textOf(item.name) || textOf(item.source) || "未命名条目"
}

export function displayMetaForRecord(resource: ResourceValue, item: any): string {
  if (!item) return ""
  if (resource === "agents") return [ENUM_OPTIONS.attribute.find(entry => entry.value === item.attribute)?.label, ENUM_OPTIONS.specialty.find(entry => entry.value === item.specialty)?.label, item.rarity].filter(Boolean).join(" · ")
  if (resource === "agent-skills") return `${item.categories?.length ?? 0} 个技能大类`
  if (resource === "w-engines") return [item.rarity, ENUM_OPTIONS.specialty.find(entry => entry.value === item.specialty)?.label].filter(Boolean).join(" · ")
  if (resource === "drive-disc-sets") return [item.twoPiece ? "2 件套" : "", item.fourPiece ? "4 件套" : ""].filter(Boolean).join(" · ")
  if (resource === "anomaly-effects") return `${item.settlementType === "disorder" ? "紊乱" : "属性异常"} · ${ENUM_OPTIONS.element.find(entry => entry.value === item.element)?.label ?? item.element}`
  if (resource === "teammate-buffs") return [
    ENUM_OPTIONS.attribute.find(entry => entry.value === item.attribute)?.label,
    ENUM_OPTIONS.specialty.find(entry => entry.value === item.specialty)?.label,
    `${item.buffs?.length ?? 0} 个 Buff`,
  ].filter(Boolean).join(" · ")
  if (resource === "field-buffs") return [textOf(item.source), item.period?.gameVersion ? `${item.period.gameVersion} 版本` : "", item.period?.phaseNo ? `第 ${item.period.phaseNo} 期` : ""].filter(Boolean).join(" · ")
  if (resource === "boss-buffs") return `${item.encounters?.length ?? 0} 个敌情版本`
  return [textOf(item.bossSource), textOf(item.sourcePeriod)].filter(Boolean).join(" · ")
}

export function searchableText(resource: ResourceValue, item: any): string {
  const visible = [displayLabelForRecord(resource, item), displayMetaForRecord(resource, item), textOf(item.description)]
  if (resource === "teammate-buffs") visible.push(...(item.buffs ?? []).flatMap((buff: any) => [textOf(buff.source), textOf(buff.description)]))
  if (resource === "boss-buffs") visible.push(...(item.aliases ?? []), ...(item.encounters ?? []).map((encounter: any) => textOf(encounter.enemyIntel)))
  return visible.filter(Boolean).join(" ").toLowerCase()
}

export function maskedPreview(value: any): any {
  if (Array.isArray(value)) return value.map(maskedPreview)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith("_")
      && key !== "id"
      && !key.endsWith("Id")
      && !key.endsWith("Ids")
      && key !== "moveIdPrefixes"
      && key !== "stackGroup"
      && key !== "defaultCount"
      && key !== "minCount"
      && key !== "maxCount"
      && key !== "step"
      && key !== "maintenanceType")
    .map(([key, child]) => key === "coverage" && child && typeof child === "object"
      ? [key, { default: `${Number((Number((child as any).default ?? 1) * 100).toFixed(2))}%` }]
      : [key, maskedPreview(child)]))
}
