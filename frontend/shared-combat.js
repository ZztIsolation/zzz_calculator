import { evaluateFormulaExpression } from "./formulaEvaluator.js"

export const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
export const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
export const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
export const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether"]
export const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
}
export const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
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
    ["dmgBonus", "通用伤害%", "flat", null],
    ["physicalDmg", "物理伤害%", "flat", null],
    ["fireDmg", "火属性伤害%", "flat", null],
    ["iceDmg", "冰属性伤害%", "flat", null],
    ["electricDmg", "电属性伤害%", "flat", null],
    ["etherDmg", "以太伤害%", "flat", null],
    ["enemyDefReduction", "敌方减防率%", "flat", null],
    ["enemyDefFlatReduction", "敌方固定减防", "flat", null],
    ["enemyResReduction", "当前属性减抗%", "flat", null],
    ["currentResIgnore", "当前属性抗性无视%", "flat", null],
    ["enemyPhysicalResReduction", "物理减抗%", "flat", null],
    ["enemyFireResReduction", "火减抗%", "flat", null],
    ["enemyIceResReduction", "冰减抗%", "flat", null],
    ["enemyElectricResReduction", "电减抗%", "flat", null],
    ["enemyEtherResReduction", "以太减抗%", "flat", null],
    ["physicalResIgnore", "物理抗性无视%", "flat", null],
    ["fireResIgnore", "火抗性无视%", "flat", null],
    ["iceResIgnore", "冰抗性无视%", "flat", null],
    ["electricResIgnore", "电抗性无视%", "flat", null],
    ["etherResIgnore", "以太抗性无视%", "flat", null],
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
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    dmgBonus: "通用伤害加成",
    enemyDefReduction: "敌方减防率",
    enemyDefFlatReduction: "敌方固定减防",
    enemyResReduction: "敌方当前属性减抗",
    enemyPhysicalResReduction: "敌方物理减抗",
    enemyFireResReduction: "敌方火减抗",
    enemyIceResReduction: "敌方冰减抗",
    enemyElectricResReduction: "敌方电减抗",
    enemyEtherResReduction: "敌方以太减抗",
}

export const ENUM_LABELS = {
    attribute: {
        physical: "物理属性",
        honed_edge: "凛刃",
        fire: "火属性",
        ice: "冰属性",
        electric: "电属性",
        ether: "以太属性",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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
    physicalDmg: "物理伤害加成%",
    fireDmg: "火属性伤害加成%",
    iceDmg: "冰属性伤害加成%",
    electricDmg: "电属性伤害加成%",
    etherDmg: "以太伤害加成%",
    dmgBonus: "通用伤害加成%",
    enemyDefReduction: "敌方减防率%",
    enemyResReduction: "敌方当前属性减抗%",
    enemyPhysicalResReduction: "敌方物理减抗%",
    enemyFireResReduction: "敌方火减抗%",
    enemyIceResReduction: "敌方冰减抗%",
    enemyElectricResReduction: "敌方电减抗%",
    enemyEtherResReduction: "敌方以太减抗%",
}

export function nameOf(item) {
    if (typeof item?.name === "string") {
        return item.name
    }
    return item?.name?.zhCN ?? item?.name?.en ?? item?.setName ?? item?.id ?? "-"
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

export function loadHomeSelection() {
    const value = readJsonStorage(HOME_SELECTION_STORAGE_KEY, null)
    if (!value || typeof value !== "object") {
        return { version: 1, currentAgentId: null, byAgent: {} }
    }
    return {
        version: 1,
        currentAgentId: value.currentAgentId ?? null,
        byAgent: value.byAgent && typeof value.byAgent === "object" ? value.byAgent : {},
    }
}

export function saveHomeSelection(selection) {
    localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify({
        version: 1,
        currentAgentId: selection.currentAgentId ?? null,
        byAgent: selection.byAgent ?? {},
    }))
}

export function configForAgent(agentId) {
    return loadHomeSelection().byAgent?.[agentId] ?? {}
}

export function effectStats(effect) {
    return Array.isArray(effect?.stats)
        ? effect.stats
        : effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
}

export function effectRules(effect) {
    if (Array.isArray(effect?.effects)) {
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

export function defaultRuntimeForBuff(buff = {}) {
    buff = buff ?? {}
    const runtime = {
        coverage: Number(buff.coverage?.default ?? 1),
        effects: {},
    }
    for (const rule of effectRules(buff)) {
        const id = rule.id ?? rule.stat ?? "effect"
        if (rule.type === "derived" || rule.type === "formula") {
            runtime.effects[id] = {
                sourceValue: Number(rule.source?.defaultValue ?? rule.defaultSourceValue ?? 0),
            }
        } else if (rule.type === "stacked") {
            runtime.effects[id] = {
                stacks: Number(rule.defaultStacks ?? rule.maxStacks ?? 1),
            }
        }
    }
    return runtime
}

export function runtimeForBuff(item, buff) {
    const defaults = defaultRuntimeForBuff(buff)
    return {
        ...defaults,
        ...(item?.runtime ?? {}),
        effects: {
            ...defaults.effects,
            ...(item?.runtime?.effects ?? {}),
        },
    }
}

export function storedEffectRuleText(rule, runtime, effect, meta) {
    const id = rule.id ?? rule.stat ?? "effect"
    const coverage = Number(runtime?.coverage ?? effect?.coverage?.default ?? 1)
    const ruleRuntime = runtime?.effects?.[id] ?? {}
    if (rule.type === "derived") {
        const sourceValue = Number(ruleRuntime.sourceValue ?? rule.defaultSourceValue ?? 0)
        const ratio = Number(rule.ratio ?? rule.ratioPct ?? 0)
        const uncapped = sourceValue * ratio / 100
        const capped = Number.isFinite(Number(rule.cap)) ? Math.min(uncapped, Number(rule.cap)) : uncapped
        const finalValue = capped * coverage
        const source = localizedText(rule.sourceLabel) || "来源数值"
        const capText = Number.isFinite(Number(rule.cap)) ? `，上限 ${rule.cap}` : ""
        return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}（${source} ${sourceValue} × ${ratio}%${capText}，覆盖率 ${coverage}）`
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
            const sourceLabel = localizedText(source.label ?? rule.sourceLabel) || "来源数值"
            const coverageText = coverage !== 1 ? `，覆盖率 ${coverage}` : ""
            return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}（${sourceLabel} x=${sourceValue}；公式 ${expression}${coverageText}）`
        } catch {
            return `${storedStatLabel(rule.stat, rule.mode, meta)}：公式无效`
        }
    }
    if (rule.type === "stacked") {
        const stacks = Number(ruleRuntime.stacks ?? rule.defaultStacks ?? rule.maxStacks ?? 1)
        const value = Number(rule.valuePerStack ?? rule.value ?? 0) * stacks * coverage
        return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}（${stacks}/${rule.maxStacks ?? stacks} 层，覆盖率 ${coverage}）`
    }
    const value = Number(rule.value ?? 0) * coverage
    return `${storedStatLabel(rule.stat, rule.mode, meta)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}${coverage !== 1 ? `（覆盖率 ${coverage}）` : ""}`
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

export function sanitizeAddedCombatBuffs(addedBuffs = [], meta) {
    return (Array.isArray(addedBuffs) ? addedBuffs : [])
        .map(item => {
            if (!item?.id || !item?.sourceCategory || !item?.sourceKind) {
                return null
            }
            if (item.sourceKind === "custom") {
                const stats = (item.stats ?? []).map(stat => normalizeCustomBuffStat(stat, meta)).filter(Boolean)
                if (!stats.length) {
                    return null
                }
                return {
                    id: item.id,
                    sourceCategory: "custom",
                    sourceKind: "custom",
                    name: item.name || "自定义 Buff",
                    stats: stats.slice(0, 1),
                    runtime: item.runtime ?? null,
                }
            }
            if (item.sourceKind === "teammateDriveDisc4pc" && !item.setId) {
                return null
            }
            return {
                id: item.id,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                setId: item.setId ?? null,
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
        defaultRuntimeForBuff,
        runtimeForBuff,
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
