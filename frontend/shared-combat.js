import { evaluateFormulaExpression } from "./formulaEvaluator.js"

export const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
export const CURRENT_ACCOUNT_STORAGE_KEY = "zzz-calculator.currentAccount.v1"
export const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
export const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
export const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
export const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
    wind: "风",
}
export const DAMAGE_KIND_LABELS = {
    direct: "直伤",
    anomaly: "异常",
    disorder: "紊乱",
    sheer: "贯穿",
}
export const DAMAGE_MODIFIER_KIND_LABELS = {
    anomalyDamageBonus: "属性异常增伤",
    disorderDamageBonus: "紊乱增伤",
    baseMultiplierBonus: "伤害倍率修正",
    disorderBaseMultiplierBonus: "紊乱倍率加算",
    anomalyCritRate: "异常暴击率",
    anomalyCritDmg: "异常暴击伤害",
    stunDmgMultiplierBonus: "失衡易伤倍率加算",
    stunDmgMultiplierBonusAlways: "失衡易伤倍率加算（未失衡生效）",
    sheerDmgBonus: "贯穿增伤",
    physicalSheerDmg: "物理贯穿增伤",
    fireSheerDmg: "火贯穿增伤",
    iceSheerDmg: "冰贯穿增伤",
    electricSheerDmg: "电贯穿增伤",
    etherSheerDmg: "以太贯穿增伤",
    windSheerDmg: "风贯穿增伤",
    skillMultiplierBonus: "技能倍率加算",
}
export const ANOMALY_EFFECT_LABELS = {
    assault: "强击",
    shatter: "碎冰",
    burn: "灼烧",
    shock: "感电",
    corruption: "侵蚀",
    frozen: "霜寒",
    frost_frozen: "烈霜霜寒紊乱（星见雅）",
    flinch: "畏缩",
}
export const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
    wind: "windResIgnore",
}
export const RESISTANCE_PRESET_VALUES = new Set(["-20", "0", "20"])
export const TEAMMATE_DRIVE_DISC_LIMIT = 2
export const CUSTOM_BUFF_STAT_OPTIONS = [
    ["atkFlat", "固定攻击力", "flat", null],
    ["atkPct", "基础攻击力%", "pct", "baseAtk"],
    ["atkPct", "局外攻击力%", "pct", "outOfCombatAtk"],
    ["hpPct", "基础生命值%", "pct", "baseHp"],
    ["hpPct", "局外生命值%", "pct", "outOfCombatHp"],
    ["defPct", "基础防御力%", "pct", "baseDef"],
    ["defPct", "局外防御力%", "pct", "outOfCombatDef"],
    ["critRate", "暴击率%", "flat", null],
    ["critDmg", "暴击伤害%", "flat", null],
    ["penRatio", "穿透率%", "flat", null],
    ["sheerForceFlat", "固定贯穿力", "flat", null],
    ["dmgBonus", "通用伤害%", "flat", null],
    ["anomalyDamageBonus", "属性异常增伤%", "eventModifier", null],
    ["disorderDamageBonus", "紊乱增伤%", "eventModifier", null],
    ["sheerDmgBonus", "贯穿增伤%", "eventModifier", null],
    ["physicalSheerDmg", "物理贯穿增伤%", "eventModifier", null],
    ["fireSheerDmg", "火贯穿增伤%", "eventModifier", null],
    ["iceSheerDmg", "冰贯穿增伤%", "eventModifier", null],
    ["electricSheerDmg", "电贯穿增伤%", "eventModifier", null],
    ["etherSheerDmg", "以太贯穿增伤%", "eventModifier", null],
    ["windSheerDmg", "风贯穿增伤%", "eventModifier", null],
    ["baseMultiplierBonus", "异常倍率加算%", "eventModifier", null],
    ["disorderBaseMultiplierBonus", "紊乱倍率加算%", "eventModifier", null],
    ["anomalyCritRate", "异常暴击率%", "eventModifier", null],
    ["anomalyCritDmg", "异常暴击伤害%", "eventModifier", null],
    ["stunDmgMultiplierBonus", "失衡易伤倍率加算%", "eventModifier", null],
    ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%", "eventModifier", null],
    ["physicalDmg", "物理伤害%", "flat", null],
    ["fireDmg", "火属性伤害%", "flat", null],
    ["iceDmg", "冰属性伤害%", "flat", null],
    ["electricDmg", "电属性伤害%", "flat", null],
    ["etherDmg", "以太伤害%", "flat", null],
    ["windDmg", "风属性伤害%", "flat", null],
    ["enemyDefReduction", "敌方减防率%", "flat", null],
    ["enemyDefIgnore", "无视防御率%", "flat", null],
    ["enemyDefFlatReduction", "敌方固定减防", "flat", null],
    ["enemyResReduction", "当前属性减抗%", "flat", null],
    ["currentResIgnore", "当前属性抗性无视%", "flat", null],
    ["enemyPhysicalResReduction", "物理减抗%", "flat", null],
    ["enemyFireResReduction", "火减抗%", "flat", null],
    ["enemyIceResReduction", "冰减抗%", "flat", null],
    ["enemyElectricResReduction", "电减抗%", "flat", null],
    ["enemyEtherResReduction", "以太减抗%", "flat", null],
    ["enemyWindResReduction", "风减抗%", "flat", null],
    ["physicalResIgnore", "物理抗性无视%", "flat", null],
    ["fireResIgnore", "火抗性无视%", "flat", null],
    ["iceResIgnore", "冰抗性无视%", "flat", null],
    ["electricResIgnore", "电抗性无视%", "flat", null],
    ["etherResIgnore", "以太抗性无视%", "flat", null],
    ["windResIgnore", "风抗性无视%", "flat", null],
]
export const CUSTOM_BUFF_SKILL_STAT_OPTIONS = [
    ["dmgBonus", "通用伤害加成%", "skill", null],
    ["physicalDmg", "物理伤害加成%", "skill", null],
    ["fireDmg", "火属性伤害加成%", "skill", null],
    ["iceDmg", "冰属性伤害加成%", "skill", null],
    ["electricDmg", "电属性伤害加成%", "skill", null],
    ["etherDmg", "以太伤害加成%", "skill", null],
    ["windDmg", "风属性伤害加成%", "skill", null],
    ["anomalyDamageBonus", "属性异常增伤%", "skill", null],
    ["disorderDamageBonus", "紊乱增伤%", "skill", null],
    ["stunDmgMultiplierBonus", "失衡易伤倍率加算%", "skill", null],
    ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%", "skill", null],
    ["sheerDmgBonus", "贯穿增伤%", "skill", null],
    ["physicalSheerDmg", "物理贯穿增伤%", "skill", null],
    ["fireSheerDmg", "火贯穿增伤%", "skill", null],
    ["iceSheerDmg", "冰贯穿增伤%", "skill", null],
    ["electricSheerDmg", "电贯穿增伤%", "skill", null],
    ["etherSheerDmg", "以太贯穿增伤%", "skill", null],
    ["windSheerDmg", "风贯穿增伤%", "skill", null],
    ["skillMultiplierBonus", "技能倍率加算%", "skill", null],
    ["enemyDefReduction", "敌方减防率%", "skill", null],
    ["enemyDefIgnore", "无视防御率%", "skill", null],
    ["enemyResReduction", "当前属性减抗%", "skill", null],
    ["enemyPhysicalResReduction", "物理减抗%", "skill", null],
    ["enemyFireResReduction", "火减抗%", "skill", null],
    ["enemyIceResReduction", "冰减抗%", "skill", null],
    ["enemyElectricResReduction", "电减抗%", "skill", null],
    ["enemyEtherResReduction", "以太减抗%", "skill", null],
    ["enemyWindResReduction", "风减抗%", "skill", null],
    ["physicalResIgnore", "物理抗性无视%", "skill", null],
    ["fireResIgnore", "火抗性无视%", "skill", null],
    ["iceResIgnore", "冰抗性无视%", "skill", null],
    ["electricResIgnore", "电抗性无视%", "skill", null],
    ["etherResIgnore", "以太抗性无视%", "skill", null],
    ["windResIgnore", "风抗性无视%", "skill", null],
]

export const FALLBACK_LABELS = {
    hp: "生命值",
    atk: "攻击力",
    def: "防御力",
    hpBase: "基础生命值",
    atkBase: "基础攻击力",
    defBase: "基础防御力",
    hpFlat: "生命值",
    atkFlat: "攻击力",
    defFlat: "防御力",
    hpPct: "生命值",
    atkPct: "攻击力",
    defPct: "防御力",
    hpPctBase: "生命值%（基础）",
    hpPctOutOfCombat: "生命值%（局外）",
    atkPctBase: "攻击力%（基础）",
    atkPctOutOfCombat: "攻击力%（局外）",
    defPctBase: "防御力%（基础）",
    defPctOutOfCombat: "防御力%（局外）",
    critRate: "暴击率",
    critDmg: "暴击伤害",
    impact: "冲击力",
    impactPct: "冲击力",
    impactFlat: "冲击力",
    anomalyProficiency: "异常精通",
    anomalyProficiencyFlat: "异常精通",
    anomalyMastery: "异常掌控",
    anomalyMasteryFlat: "异常掌控",
    penFlat: "穿透值",
    penRatio: "穿透率",
    sheerForce: "贯穿力",
    sheerForceFlat: "固定贯穿力",
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    windResIgnore: "风抗性无视",
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    windDmg: "风属性伤害加成",
    dmgBonus: "通用伤害加成",
    enemyDefReduction: "敌方减防率",
    enemyDefIgnore: "无视防御率",
    enemyDefFlatReduction: "敌方固定减防",
    enemyResReduction: "敌方当前属性减抗",
    enemyPhysicalResReduction: "敌方物理减抗",
    enemyFireResReduction: "敌方火减抗",
    enemyIceResReduction: "敌方冰减抗",
    enemyElectricResReduction: "敌方电减抗",
    enemyEtherResReduction: "敌方以太减抗",
    enemyWindResReduction: "敌方风减抗",
    anomalyDamageBonus: "属性异常增伤",
    disorderDamageBonus: "紊乱增伤",
    sheerDmgBonus: "贯穿增伤",
    physicalSheerDmg: "物理贯穿增伤",
    fireSheerDmg: "火贯穿增伤",
    iceSheerDmg: "冰贯穿增伤",
    electricSheerDmg: "电贯穿增伤",
    etherSheerDmg: "以太贯穿增伤",
    windSheerDmg: "风贯穿增伤",
    baseMultiplierBonus: "异常倍率加算",
    disorderBaseMultiplierBonus: "紊乱倍率加算",
    anomalyCritRate: "异常暴击率",
    anomalyCritDmg: "异常暴击伤害",
    stunDmgMultiplierBonus: "失衡易伤倍率加算",
    stunDmgMultiplierBonusAlways: "失衡易伤倍率加算（未失衡生效）",
    skillMultiplierBonus: "技能倍率加算",
}

export const ENUM_LABELS = {
    attribute: {
        physical: "物理属性",
        honed_edge: "凛刃",
        frost: "烈霜",
        xuanmo: "玄墨",
        fire: "火属性",
        ice: "冰属性",
        electric: "电属性",
        ether: "以太属性",
        wind: "风属性",
    },
    specialty: {
        attack: "强攻",
        stun: "击破",
        anomaly: "异常",
        support: "支援",
        defense: "防护",
        rupture: "命破",
    },
    faction: {
        cunning_hares: "狡兔屋",
        yunkui_summit: "云岿山",
        belobog: "白祇重工",
        victoria: "维多利亚家政",
        obol: "奥波勒斯小队",
        sons_of_calydon: "卡吕冬之子",
        section_6: "对空洞特别行动部第六课",
        stars_of_lyra: "天琴座",
        mock: "测试",
    },
}

export const PERCENT_KEYS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "hpPctBase",
    "hpPctOutOfCombat",
    "atkPctBase",
    "atkPctOutOfCombat",
    "defPctBase",
    "defPctOutOfCombat",
    "critRate",
    "critDmg",
    "impactPct",
    "energyRegen",
    "energyRegenPct",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "skillMultiplierBonus",
])
export const PERCENT_MODE_KEY = {
    hp: "hpPct",
    atk: "atkPct",
    def: "defPct",
    impact: "impactPct",
    energyRegen: "energyRegenPct",
}
export const STORED_PERCENT_STATS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
    "impact",
    "impactPct",
    "anomalyMastery",
    "energyRegen",
    "energyRegenPct",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "skillMultiplierBonus",
])
export const STORED_STAT_LABELS = {
    hpPct: "百分比生命值%",
    atkPct: "百分比攻击力%",
    defPct: "百分比防御力%",
    critRate: "暴击率%",
    critDmg: "暴击伤害%",
    impact: "冲击力%",
    impactPct: "百分比冲击力%",
    anomalyMastery: "异常掌控%",
    energyRegen: "能量自动回复%",
    energyRegenPct: "百分比能量自动回复%",
    penRatio: "穿透率%",
    physicalResIgnore: "物理抗性无视%",
    fireResIgnore: "火抗性无视%",
    iceResIgnore: "冰抗性无视%",
    electricResIgnore: "电抗性无视%",
    etherResIgnore: "以太抗性无视%",
    windResIgnore: "风抗性无视%",
    physicalDmg: "物理伤害加成%",
    fireDmg: "火属性伤害加成%",
    iceDmg: "冰属性伤害加成%",
    electricDmg: "电属性伤害加成%",
    etherDmg: "以太伤害加成%",
    windDmg: "风属性伤害加成%",
    dmgBonus: "通用伤害加成%",
    enemyDefReduction: "敌方减防率%",
    enemyDefIgnore: "无视防御率%",
    enemyResReduction: "敌方当前属性减抗%",
    enemyPhysicalResReduction: "敌方物理减抗%",
    enemyFireResReduction: "敌方火减抗%",
    enemyIceResReduction: "敌方冰减抗%",
    enemyElectricResReduction: "敌方电减抗%",
    enemyEtherResReduction: "敌方以太减抗%",
    enemyWindResReduction: "敌方风减抗%",
    anomalyDamageBonus: "属性异常增伤%",
    disorderDamageBonus: "紊乱增伤%",
    sheerDmgBonus: "贯穿增伤%",
    physicalSheerDmg: "物理贯穿增伤%",
    fireSheerDmg: "火贯穿增伤%",
    iceSheerDmg: "冰贯穿增伤%",
    electricSheerDmg: "电贯穿增伤%",
    etherSheerDmg: "以太贯穿增伤%",
    windSheerDmg: "风贯穿增伤%",
    baseMultiplierBonus: "异常倍率加算%",
    disorderBaseMultiplierBonus: "紊乱倍率加算%",
    anomalyCritRate: "异常暴击率%",
    anomalyCritDmg: "异常暴击伤害%",
    stunDmgMultiplierBonus: "失衡易伤倍率加算%",
    stunDmgMultiplierBonusAlways: "失衡易伤倍率加算（未失衡生效）%",
    skillMultiplierBonus: "技能倍率加算%",
}

export function nameOf(item) {
    if (typeof item?.name === "string") {
        return item.name
    }
    return item?.name?.zhCN ?? item?.name?.en
        ?? item?.bossName?.zhCN ?? item?.bossName?.en
        ?? item?.setName ?? item?.id ?? "-"
}

export function localizedText(value) {
    if (!value) {
        return ""
    }
    if (typeof value === "string") {
        return value
    }
    return value.zhCN ?? value.en ?? ""
}

export function combatBuffDisplayName(buff) {
    if (buff?.sourceKind === "teammate" || buff?.sourceCategory === "agent") {
        const owner = localizedText(buff?.ownerName)
            || localizedText(buff?.teammateName)
            || localizedText(buff?.agentName)
        const source = localizedText(buff?.source)
            || localizedText(buff?.sourceLabel)
            || localizedText(buff?.name)
            || buff?.id
            || "-"
        return owner ? `${owner} | ${source}` : source
    }

    return localizedText(buff?.name)
        || localizedText(buff?.source)
        || localizedText(buff?.sourceLabel)
        || localizedText(buff?.bossName)
        || localizedText(buff?.bossSource)
        || buff?.setName
        || buff?.id
        || "-"
}

export function enumLabel(type, value) {
    return ENUM_LABELS[type]?.[value] ?? value ?? "-"
}

export function rarityLabel(value) {
    return value ? `${value}级` : "-"
}

export function statLabel(key, meta) {
    return FALLBACK_LABELS[key] ?? meta?.statRules?.statDisplay?.[key]?.label ?? key
}

export function storedStatLabel(key, mode = "", meta) {
    if (mode === "pct" || STORED_PERCENT_STATS.has(key)) {
        return STORED_STAT_LABELS[key] ?? statLabel(key, meta)
    }
    return statLabel(key, meta)
}

export function formatValue(value, key = "") {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "-"
    }
    if (PERCENT_KEYS.has(key)) {
        return `${Number((value * 100).toFixed(1))}%`
    }
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

export function formatStoredStatValue(stat, value, context = {}) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "-"
    }
    if (context.percentMode || context.mode === "pct" || STORED_PERCENT_STATS.has(stat)) {
        return `${Number(value.toFixed(3))}%`
    }
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

export function formatContextStatValue(stat, value, context = {}) {
    const displayKey = context.percentMode ? (PERCENT_MODE_KEY[stat] ?? stat) : stat
    return formatValue(value, displayKey)
}

export function coreSkillDefaultLevel(agent) {
    const levels = agent?.coreSkill?.levels ?? []
    return agent?.coreSkill?.defaultLevel ?? levels.at(-1)?.level ?? "none"
}

export function coreSkillLevelLabel(agent, level) {
    if (!agent?.coreSkill || level === "none") {
        return "未强化"
    }
    const item = agent.coreSkill.levels?.find(coreLevel => coreLevel.level === level)
    return item ? item.label ?? `强化${item.level}` : "未强化"
}

export function coreSkillSummary(agent, selectedLevel, meta) {
    if (!agent?.coreSkill?.levels?.length) {
        return "未建模"
    }
    const activeIndex = agent.coreSkill.levels.findIndex(level => level.level === selectedLevel)
    if (activeIndex < 0) {
        return "未强化"
    }
    const totals = new Map()
    for (const level of agent.coreSkill.levels.slice(0, activeIndex + 1)) {
        for (const stat of level.stats ?? []) {
            const current = totals.get(stat.stat) ?? {
                value: 0,
                mode: stat.mode ?? "flat",
            }
            totals.set(stat.stat, {
                value: current.value + Number(stat.value ?? 0),
                mode: current.mode,
            })
        }
    }
    const text = [...totals.entries()]
        .map(([stat, item]) => `${statLabel(stat, meta)} +${formatStoredStatValue(stat, item.value, { percentMode: item.mode === "pct" })}`)
        .join(" / ")
    return `${coreSkillLevelLabel(agent, selectedLevel)}${text ? ` · ${text}` : ""}`
}

export function clampWEngineModificationLevel(value, wEngine = {}) {
    const modification = wEngine?.modification ?? {}
    const min = Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1
    const max = Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5
    const defaultLevel = Number.isInteger(Number(modification.defaultLevel)) ? Number(modification.defaultLevel) : min
    const numeric = Number(value ?? defaultLevel)
    const level = Number.isFinite(numeric) ? Math.trunc(numeric) : defaultLevel
    return Math.max(min, Math.min(max, level))
}

const W_ENGINE_RARITY_PRIORITY = {
    S: 3,
    A: 2,
    B: 1,
}

export function relatedWEngineForAgent(wEngines = [], agentId = "") {
    const normalizedAgentId = String(agentId ?? "").trim()
    if (!normalizedAgentId || !Array.isArray(wEngines)) {
        return null
    }

    return wEngines
        .map((wEngine, index) => ({ wEngine, index }))
        .filter(({ wEngine }) => wEngine?.relatedAgentId === normalizedAgentId)
        .sort((left, right) => {
            const leftPriority = W_ENGINE_RARITY_PRIORITY[left.wEngine?.rarity] ?? 0
            const rightPriority = W_ENGINE_RARITY_PRIORITY[right.wEngine?.rarity] ?? 0
            return rightPriority - leftPriority || left.index - right.index
        })[0]?.wEngine ?? null
}

export function defaultWEngineIdForAgent(wEngines = [], agentId = "", savedWEngineId = "") {
    if (!Array.isArray(wEngines) || wEngines.length === 0) {
        return ""
    }
    const saved = wEngines.find(wEngine => wEngine?.id === savedWEngineId)
    if (saved) {
        return saved.id
    }
    return relatedWEngineForAgent(wEngines, agentId)?.id ?? wEngines[0]?.id ?? ""
}

export function sortWEnginesForAgent(wEngines = [], agent = null) {
    if (!Array.isArray(wEngines) || wEngines.length === 0) {
        return []
    }
    const specialty = String(agent?.specialty ?? "").trim()
    if (!specialty) {
        return [...wEngines]
    }

    return wEngines
        .map((wEngine, index) => ({
            wEngine,
            index,
            matchingSpecialty: wEngine?.specialty === specialty,
        }))
        .sort((left, right) => {
            if (left.matchingSpecialty !== right.matchingSpecialty) {
                return left.matchingSpecialty ? -1 : 1
            }
            return left.index - right.index
        })
        .map(item => item.wEngine)
}

function modificationValueForLevel(rule, key, level) {
    const values = rule?.modificationValues?.[key]
    if (!Array.isArray(values)) {
        return null
    }

    const value = Number(values[level - 1])
    if (!Number.isFinite(value)) {
        return null
    }

    return {
        value,
        displayValue: value,
    }
}

function materializeEffectRuleForModificationLevel(rule, level) {
    if (!rule?.modificationValues) {
        return rule
    }

    const next = { ...rule }
    const fixedValue = modificationValueForLevel(rule, "value", level)
    if (fixedValue) {
        next.value = fixedValue.value
        if (fixedValue.displayValue !== undefined) {
            next.displayValue = fixedValue.displayValue
        }
    }

    const valuePerStack = modificationValueForLevel(rule, "valuePerStack", level)
    if (valuePerStack) {
        next.valuePerStack = valuePerStack.value
        if (valuePerStack.displayValue !== undefined) {
            next.displayValuePerStack = valuePerStack.displayValue
        }
    }

    return next
}

function materializeEffectSetForModificationLevel(effect, level) {
    if (!effect || !Array.isArray(effect.effects)) {
        return effect
    }

    return {
        ...effect,
        effects: effect.effects.map(rule => materializeEffectRuleForModificationLevel(rule, level)),
    }
}

export function materializeWEngineForModificationLevel(wEngine, value) {
    if (!wEngine) {
        return wEngine
    }

    const level = clampWEngineModificationLevel(value, wEngine)
    const effect = wEngine.effect
        ? {
            ...wEngine.effect,
            selfBuff: materializeEffectSetForModificationLevel(wEngine.effect.selfBuff, level),
            teamBuff: materializeEffectSetForModificationLevel(wEngine.effect.teamBuff, level),
            buff: materializeEffectSetForModificationLevel(wEngine.effect.buff, level),
        }
        : wEngine.effect

    return {
        ...wEngine,
        selectedModificationLevel: level,
        ...(effect ? { effect } : {}),
        ...(wEngine.selfBuff ? { selfBuff: materializeEffectSetForModificationLevel(wEngine.selfBuff, level) } : {}),
        ...(wEngine.teamBuff ? { teamBuff: materializeEffectSetForModificationLevel(wEngine.teamBuff, level) } : {}),
        ...(wEngine.passive ? { passive: materializeEffectSetForModificationLevel(wEngine.passive, level) } : {}),
    }
}

export function agentAttributeText(agent) {
    const attribute = enumLabel("attribute", agent?.attribute)
    if (agent?.damageElement && agent.damageElement !== agent.attribute) {
        return `${attribute}（${enumLabel("attribute", agent.damageElement)}结算）`
    }
    return attribute
}

export function damageElementForAgent(agent = {}) {
    const damageElement = agent.damageElement ?? agent.attribute
    return DAMAGE_ELEMENTS.includes(damageElement) ? damageElement : "physical"
}

export function damageElementShortLabel(element) {
    return DAMAGE_ELEMENT_SHORT_LABELS[element] ?? element ?? "-"
}

export function readJsonStorage(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
    } catch {
        return fallback
    }
}

export function currentAccountId() {
    return localStorage.getItem(CURRENT_ACCOUNT_STORAGE_KEY) || "default"
}

export function setCurrentAccountId(ownerId) {
    localStorage.setItem(CURRENT_ACCOUNT_STORAGE_KEY, ownerId || "default")
}

export function loadHomeSelection() {
    const value = readJsonStorage(HOME_SELECTION_STORAGE_KEY, null)
    if (!value || typeof value !== "object") {
        return { version: 2, currentOwnerId: currentAccountId(), byOwner: { [currentAccountId()]: { currentAgentId: null, byAgent: {} } } }
    }
    if (value.byOwner && typeof value.byOwner === "object") {
        return {
            version: 2,
            currentOwnerId: value.currentOwnerId ?? currentAccountId(),
            byOwner: value.byOwner,
        }
    }
    return {
        version: 2,
        currentOwnerId: "default",
        byOwner: {
            default: {
                currentAgentId: value.currentAgentId ?? null,
                byAgent: value.byAgent && typeof value.byAgent === "object" ? value.byAgent : {},
            },
        },
    }
}

export function saveHomeSelection(selection) {
    const ownerId = selection.currentOwnerId ?? currentAccountId()
    localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify({
        version: 2,
        currentOwnerId: ownerId,
        byOwner: selection.byOwner ?? {
            [ownerId]: {
                currentAgentId: selection.currentAgentId ?? null,
                byAgent: selection.byAgent ?? {},
            },
        },
    }))
}

export function loadCurrentOwnerSelection(ownerId = currentAccountId()) {
    const selection = loadHomeSelection()
    return selection.byOwner?.[ownerId] ?? { currentAgentId: null, byAgent: {} }
}

export function saveCurrentOwnerSelection(ownerSelection, ownerId = currentAccountId()) {
    const selection = loadHomeSelection()
    saveHomeSelection({
        version: 2,
        currentOwnerId: ownerId,
        byOwner: {
            ...(selection.byOwner ?? {}),
            [ownerId]: {
                currentAgentId: ownerSelection.currentAgentId ?? null,
                byAgent: ownerSelection.byAgent ?? {},
            },
        },
    })
}

export function deleteOwnerSelection(ownerId) {
    const selection = loadHomeSelection()
    const byOwner = { ...(selection.byOwner ?? {}) }
    delete byOwner[ownerId]
    saveHomeSelection({
        version: 2,
        currentOwnerId: selection.currentOwnerId === ownerId ? currentAccountId() : selection.currentOwnerId,
        byOwner,
    })
}

export function configForAgent(agentId) {
    return loadCurrentOwnerSelection().byAgent?.[agentId] ?? {}
}

export function effectStats(effect) {
    return Array.isArray(effect?.stats)
        ? effect.stats
        : effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
}

export function effectRules(effect) {
    if (Array.isArray(effect?.effects) && effect.effects.length > 0) {
        return effect.effects
    }
    return effectStats(effect).map((stat, index) => ({
        id: stat.id ?? `legacy-${index + 1}`,
        type: "fixed",
        stat: stat.stat,
        value: stat.value,
        mode: stat.mode ?? "flat",
        basis: stat.basis ?? null,
        label: stat.label ?? null,
    }))
}

export function effectRuleId(rule = {}) {
    return rule.id ?? rule.stat ?? "effect"
}

export function buffModifiers(effect) {
    return Array.isArray(effect?.buffModifiers) ? effect.buffModifiers : []
}

function finiteSourceNumber(value, fallback = null) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

export function runtimeSourceConfigForRule(rule = {}) {
    if (rule.type !== "derived" && rule.type !== "formula") {
        return null
    }
    const source = rule.source ?? {}
    return {
        label: localizedText(source.label ?? rule.sourceLabel) || "来源数值",
        defaultValue: finiteSourceNumber(source.defaultValue ?? rule.defaultSourceValue, 0),
        min: finiteSourceNumber(source.min),
        max: finiteSourceNumber(source.max),
    }
}

export function runtimeSourceGroupKey(rule = {}) {
    const config = runtimeSourceConfigForRule(rule)
    return config
        ? JSON.stringify([config.label, config.defaultValue, config.min, config.max])
        : ""
}

export function runtimeSourceGroups(effect) {
    const groups = []
    const byKey = new Map()
    for (const rule of effectRules(effect)) {
        const key = runtimeSourceGroupKey(rule)
        if (!key) {
            continue
        }
        let group = byKey.get(key)
        if (!group) {
            const config = runtimeSourceConfigForRule(rule)
            group = {
                key,
                ...config,
                ruleIds: [],
                rules: [],
            }
            byKey.set(key, group)
            groups.push(group)
        }
        const id = effectRuleId(rule)
        group.rules.push(rule)
        if (!group.ruleIds.includes(id)) {
            group.ruleIds.push(id)
        }
    }
    return groups
}

export function runtimeSourceGroupForRule(effect, ruleOrId) {
    const id = typeof ruleOrId === "string" ? ruleOrId : effectRuleId(ruleOrId)
    const rule = typeof ruleOrId === "string"
        ? effectRules(effect).find(item => effectRuleId(item) === id)
        : ruleOrId
    const key = runtimeSourceGroupKey(rule)
    return key ? runtimeSourceGroupForKey(effect, key) : null
}

export function runtimeSourceGroupForKey(effect, key) {
    return runtimeSourceGroups(effect).find(group => group.key === key) ?? null
}

export function runtimeSourceRuleIdsForGroup(effect, key, fallbackRuleId = "") {
    const group = runtimeSourceGroupForKey(effect, key)
    return group?.ruleIds?.length
        ? [...group.ruleIds]
        : fallbackRuleId ? [fallbackRuleId] : []
}

export function defaultRuntimeForBuff(buff = {}) {
    buff = buff ?? {}
    const runtime = {
        coverage: Number(buff.coverage?.default ?? 1),
        effects: {},
    }
    for (const rule of effectRules(buff)) {
        const id = effectRuleId(rule)
        if (rule.type === "derived" || rule.type === "formula") {
            runtime.effects[id] = {
                enabled: true,
                sourceValue: Number(rule.source?.defaultValue ?? rule.defaultSourceValue ?? 0),
            }
        } else if (rule.type === "stacked") {
            runtime.effects[id] = {
                enabled: true,
                stacks: Number(rule.defaultStacks ?? rule.maxStacks ?? 1),
            }
        } else {
            runtime.effects[id] = {
                enabled: true,
            }
        }
    }
    return runtime
}

export function normalizeRuntimeForBuff(buff = {}, runtime = {}) {
    const defaults = defaultRuntimeForBuff(buff)
    const input = runtime && typeof runtime === "object" ? runtime : {}
    const next = {
        ...defaults,
        ...input,
        effects: {
            ...defaults.effects,
            ...(input.effects ?? {}),
        },
    }
    for (const rule of effectRules(buff)) {
        const id = effectRuleId(rule)
        next.effects[id] = {
            ...(defaults.effects[id] ?? { enabled: true }),
            ...(next.effects[id] ?? {}),
            enabled: true,
        }
    }
    for (const group of runtimeSourceGroups(buff)) {
        const primaryId = group.ruleIds[0]
        const sourceValue = next.effects?.[primaryId]?.sourceValue ?? group.defaultValue ?? 0
        for (const id of group.ruleIds) {
            next.effects[id] = {
                ...(next.effects[id] ?? {}),
                sourceValue,
            }
        }
    }
    return next
}

export function runtimeForBuff(item, buff) {
    return normalizeRuntimeForBuff(buff, item?.runtime)
}

function ruleTargetText(rule = {}, meta) {
    const target = rule.target ?? {}
    if (target.kind !== "skill") {
        return ""
    }
    const targets = Array.isArray(target.skillTargets) ? target.skillTargets : []
    return targets.length ? `（技能：${targets.map(item => skillTargetLabel(item, meta)).join("；")}）` : "（技能：未选择）"
}

export function storedEffectRuleText(rule, runtime, effect, meta) {
    const id = effectRuleId(rule)
    const coverage = Number(runtime?.coverage ?? effect?.coverage?.default ?? 1)
    const ruleRuntime = runtime?.effects?.[id] ?? {}
    const coverageText = coverage !== 1 ? `（覆盖率 ${coverage}）` : ""
    if (rule.type === "damageModifier") {
        const rawValue = Number(rule.value ?? 0)
        const value = (rule.valueUnit === "decimal" ? rawValue * 100 : Math.abs(rawValue) > 1 ? rawValue : rawValue * 100) * coverage
        const appliesTo = rule.appliesTo ?? {}
        const scopes = [
            ...(appliesTo.damageKinds ?? []).map(kind => DAMAGE_KIND_LABELS[kind] ?? kind),
            ...(appliesTo.anomalyEffects ?? []).map(item => ANOMALY_EFFECT_LABELS[item] ?? item),
            ...(appliesTo.elements ?? []).map(item => DAMAGE_ELEMENT_SHORT_LABELS[item] ?? item),
            ...(appliesTo.skillTargets ?? []).map(item => skillTargetLabel(item, meta)),
        ]
        return `${DAMAGE_MODIFIER_KIND_LABELS[rule.kind] ?? rule.kind} +${formatStoredStatValue("dmgBonus", value)}${scopes.length ? `（${scopes.join(" / ")}）` : ""}${coverageText}`
    }
    if (rule.type === "derived") {
        const sourceValue = Number(ruleRuntime.sourceValue ?? rule.defaultSourceValue ?? 0)
        const ratio = Number(rule.ratio ?? rule.ratioPct ?? 0)
        const uncapped = sourceValue * ratio / 100
        const capped = Number.isFinite(Number(rule.cap)) ? Math.min(uncapped, Number(rule.cap)) : uncapped
        const finalValue = capped * coverage
        return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}${ruleTargetText(rule, meta)}${coverageText}`
    }
    if (rule.type === "formula") {
        const source = rule.source ?? {}
        const rawSourceValue = Number(ruleRuntime.sourceValue ?? source.defaultValue ?? 0)
        const sourceValue = Math.max(
            Number.isFinite(Number(source.min)) ? Number(source.min) : rawSourceValue,
            Math.min(Number.isFinite(Number(source.max)) ? Number(source.max) : rawSourceValue, rawSourceValue),
        )
        const expression = rule.formula?.expression ?? ""
        try {
            const finalValue = evaluateFormulaExpression(expression, { [source.variable ?? "x"]: sourceValue }) * coverage
            return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}${ruleTargetText(rule, meta)}${coverageText}`
        } catch {
            return `${storedStatLabel(rule.stat, rule.mode, meta)}：公式无效`
        }
    }
    if (rule.type === "stacked") {
        const stacks = Number(ruleRuntime.stacks ?? rule.defaultStacks ?? rule.maxStacks ?? 1)
        const displayValuePerStack = Number(rule.displayValuePerStack ?? rule.valuePerStack ?? rule.value ?? 0)
        const valuePerStack = Number.isFinite(displayValuePerStack)
            ? displayValuePerStack
            : Number(rule.valuePerStack ?? rule.value ?? 0)
        const value = valuePerStack * stacks * coverage
        return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}${ruleTargetText(rule, meta)}（${stacks}/${rule.maxStacks ?? stacks} 层，覆盖率 ${coverage}）`
    }
    const displayValue = Number(rule.displayValue ?? rule.value ?? 0)
    const value = (Number.isFinite(displayValue) ? displayValue : Number(rule.value ?? 0)) * coverage
    return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}${ruleTargetText(rule, meta)}${coverageText}`
}

export function storedBuffModifierText(modifier = {}) {
    const operation = modifier.operation ?? "multiplyResolvedValue"
    const factor = Number(modifier.factor ?? 1)
    if (operation !== "multiplyResolvedValue" || !Number.isFinite(factor)) {
        return ""
    }

    const label = localizedText(modifier.label)
    if (label) {
        return label
    }

    const targetBuffs = Array.isArray(modifier.targetBuffIds) ? modifier.targetBuffIds.filter(Boolean) : []
    const targetEffects = Array.isArray(modifier.targetEffectIds) ? modifier.targetEffectIds.filter(Boolean) : []
    const targetText = [
        targetBuffs.length ? `目标 Buff ${targetBuffs.join(" / ")}` : "",
        targetEffects.length ? `效果 ${targetEffects.join(" / ")}` : "",
    ].filter(Boolean).join("；")
    const factorText = `${Number((factor * 100).toFixed(3))}%`
    return `${label || "Buff 修饰"}：${targetText || "未选择目标"} × ${factorText}`
}

export function storedBuffModifierTexts(effect) {
    return buffModifiers(effect)
        .map(storedBuffModifierText)
        .filter(Boolean)
}

export function storedEffectRulesText(effect, runtime = defaultRuntimeForBuff(effect), meta) {
    return effectRules(effect)
        .map(rule => storedEffectRuleText(rule, runtime, effect ?? {}, meta))
        .filter(Boolean)
        .join("，")
}

export function normalizeCustomBuffStat(stat, meta) {
    if (!stat?.stat) {
        return null
    }
    const value = Number(stat.value ?? 0)
    if (!Number.isFinite(value) || value === 0) {
        return null
    }
    return {
        id: stat.id ?? `${stat.stat}-${Date.now()}`,
        label: stat.label ?? statLabel(stat.stat, meta),
        stat: stat.stat,
        value,
        mode: stat.mode ?? "flat",
        basis: stat.basis ?? null,
    }
}

export function normalizeCustomBuffEffect(effect) {
    if (!["damageModifier", "fixed"].includes(effect?.type ?? "")) {
        return null
    }
    const value = Number(effect.value ?? 0)
    if (!Number.isFinite(value) || value === 0) {
        return null
    }
    if ((effect?.type ?? "") === "fixed") {
        const target = effect.target?.kind === "skill"
            ? { kind: "skill", skillTargets: Array.isArray(effect.target.skillTargets) ? effect.target.skillTargets : [] }
            : { kind: "default" }
        if (target.kind === "skill" && !target.skillTargets.length) {
            return null
        }
        return {
            id: effect.id ?? `${effect.stat ?? "effect"}-${Date.now()}`,
            type: "fixed",
            stat: effect.stat,
            value,
            mode: effect.mode ?? "flat",
            target,
            label: effect.label ?? null,
        }
    }
    return {
        id: effect.id ?? `${effect.kind ?? "damage-modifier"}-${Date.now()}`,
        type: "damageModifier",
        kind: effect.kind,
        value,
        valueUnit: effect.valueUnit ?? null,
        appliesTo: effect.appliesTo ?? null,
        label: effect.label ?? null,
    }
}

function wEngineIdFromTeamBuffKey(key) {
    const match = String(key ?? "").match(/^wEngine:(.+)\.team$/)
    return match?.[1] ?? ""
}

function wEngineForTeamBuffKey(key, meta) {
    const wEngineId = wEngineIdFromTeamBuffKey(key)
    return (meta?.wEngines ?? []).find(item => item.id === wEngineId) ?? null
}

export function skillTargetLabel(target = {}, meta = {}) {
    const skillSet = (meta?.agentSkills ?? []).find(item => item.id === target.agentSkillId)
    const agent = (meta?.agents ?? []).find(item => item.id === skillSet?.agentId || item.id === target.agentSkillId)
    const category = (skillSet?.categories ?? []).find(item => item.id === target.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === target.moveId)
    const row = (move?.rows ?? []).find(item => item.id === target.rowId)
    const agentLabel = String(localizedText(agent?.name) || localizedText(skillSet?.name) || target.agentSkillId || "")
        .replace(/技能倍率$/, "")
        .trim()
    return [
        agentLabel,
        localizedText(move?.name) || target.moveId,
        target.rowId ? localizedText(row?.label) || target.rowId : "",
    ].filter(Boolean).join("/")
}

export function sanitizeAddedCombatBuffs(addedBuffs = [], meta) {
    return (Array.isArray(addedBuffs) ? addedBuffs : [])
        .map(item => {
            if (!item?.id || !item?.sourceCategory || !item?.sourceKind) {
                return null
            }
            if (item.sourceKind === "custom") {
                const stats = (item.stats ?? []).map(stat => normalizeCustomBuffStat(stat, meta)).filter(Boolean)
                const effects = (item.effects ?? []).map(effect => normalizeCustomBuffEffect(effect)).filter(Boolean)
                if (!stats.length && !effects.length) {
                    return null
                }
                return {
                    id: item.id,
                    sourceCategory: "custom",
                    sourceKind: "custom",
                    name: item.name || "自定义 Buff",
                    stats: stats.slice(0, 1),
                    effects: effects.slice(0, 1),
                    runtime: item.runtime ?? null,
                }
            }
            if (item.sourceKind === "teammateDriveDisc4pc" && !item.setId) {
                return null
            }
            const wEngine = item.sourceKind === "wEngineTeam"
                ? wEngineForTeamBuffKey(item.id, meta)
                : null
            return {
                id: item.id,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                setId: item.setId ?? null,
                ...(item.sourceKind === "wEngineTeam" ? {
                    wEngineModificationLevel: clampWEngineModificationLevel(item.wEngineModificationLevel, wEngine ?? {}),
                } : {}),
                runtime: item.runtime ?? null,
            }
        })
        .filter(Boolean)
}

export function combatConfigForAgent(agentId, meta) {
    const config = configForAgent(agentId)
    return {
        addedBuffs: sanitizeAddedCombatBuffs(config.combat?.addedBuffs, meta),
    }
}

export function createCombatUiController(options = {}) {
    const getMeta = options.getMeta ?? (() => null)
    return {
        nameOf,
        localizedText,
        statLabel: key => statLabel(key, getMeta()),
        storedStatLabel: (key, mode = "") => storedStatLabel(key, mode, getMeta()),
        formatValue,
        formatStoredStatValue,
        coreSkillSummary: (agent, level) => coreSkillSummary(agent, level, getMeta()),
        agentAttributeText,
        effectStats,
        effectRules,
        effectRuleId,
        clampWEngineModificationLevel,
        materializeWEngineForModificationLevel,
        buffModifiers,
        defaultRuntimeForBuff,
        normalizeRuntimeForBuff,
        runtimeForBuff,
        runtimeSourceConfigForRule,
        runtimeSourceGroupKey,
        runtimeSourceGroups,
        runtimeSourceGroupForRule,
        runtimeSourceGroupForKey,
        runtimeSourceRuleIdsForGroup,
        storedBuffModifierText,
        storedBuffModifierTexts,
        storedEffectRulesText: (effect, runtime = defaultRuntimeForBuff(effect)) => storedEffectRulesText(effect, runtime, getMeta()),
        loadHomeSelection,
        saveHomeSelection,
        configForAgent,
        sanitizeAddedCombatBuffs: buffs => sanitizeAddedCombatBuffs(buffs, getMeta()),
        combatConfigForAgent: agentId => combatConfigForAgent(agentId, getMeta()),
        includeDriveDiscBuffs: options.includeDriveDiscBuffs !== false,
        preserveHiddenDriveDiscBuffs: Boolean(options.preserveHiddenDriveDiscBuffs),
    }
}
