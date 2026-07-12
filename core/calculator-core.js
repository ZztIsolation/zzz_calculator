import { evaluateFormulaExpression } from "./formulaEvaluator.js"
import {
    damageSkillRowsWithGeneratedTotals,
    defaultSkillLevel as defaultLevelForSkill,
    isCoreSkillLevelScale,
    isValidSkillLevel,
    skillLevelLabel,
    skillLevelScale,
    skillRowValue,
} from "./skillMultiplierCandidates.js"
import { expandCalculationConfigSkillGroups } from "./calculationSkillGroups.js"

const BONUS_KEY_MAP = {
    hpFlat: "hpFlat",
    hpPct: "hpPct",
    atkFlat: "atkFlat",
    atkPct: "atkPct",
    defFlat: "defFlat",
    defPct: "defPct",
    critRate: "critRate",
    critDmg: "critDmg",
    impact: "impactPct",
    impactPct: "impactPct",
    impactFlat: "impactFlat",
    anomalyProficiency: "anomalyProficiencyFlat",
    anomalyProficiencyFlat: "anomalyProficiencyFlat",
    anomalyMastery: "anomalyMasteryFlat",
    anomalyMasteryFlat: "anomalyMasteryFlat",
    energyRegen: "energyRegenPct",
    energyRegenPct: "energyRegenPct",
    penFlat: "penFlat",
    penRatio: "penRatio",
    physicalResIgnore: "physicalResIgnore",
    fireResIgnore: "fireResIgnore",
    iceResIgnore: "iceResIgnore",
    electricResIgnore: "electricResIgnore",
    etherResIgnore: "etherResIgnore",
    windResIgnore: "windResIgnore",
    dmgBonus: "dmgBonus",
    physicalDmg: "physicalDmg",
    fireDmg: "fireDmg",
    iceDmg: "iceDmg",
    electricDmg: "electricDmg",
    etherDmg: "etherDmg",
    windDmg: "windDmg",
    sheerForceFlat: "sheerForceFlat",
}

const BONUS_KEYS = [
    "hpFlat",
    "hpPct",
    "atkFlat",
    "atkPct",
    "defFlat",
    "defPct",
    "critRate",
    "critDmg",
    "impactPct",
    "impactFlat",
    "anomalyProficiencyFlat",
    "anomalyMasteryFlat",
    "energyRegenPct",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "sheerForceFlat",
]

const OUTPUT_PANEL_KEYS = [
    "hp",
    "atk",
    "def",
    "critRate",
    "critDmg",
    "impact",
    "anomalyProficiency",
    "anomalyMastery",
    "energyRegen",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "sheerForce",
    "sheerForceFlat",
]

const CORE_BASE_STAT_MAP = {
    hpBase: "hp",
    atkBase: "atk",
    defBase: "def",
}

const COMBAT_PCT_BASIS_BY_STAT = {
    hpPct: {
        defaultBasis: "baseHp",
        baseKey: "hpPctBase",
        outOfCombatKey: "hpPctOutOfCombat",
    },
    atkPct: {
        defaultBasis: "baseAtk",
        baseKey: "atkPctBase",
        outOfCombatKey: "atkPctOutOfCombat",
    },
    defPct: {
        defaultBasis: "baseDef",
        baseKey: "defPctBase",
        outOfCombatKey: "defPctOutOfCombat",
    },
}

const COMBAT_PCT_KEY_BY_BASIS = {
    baseHp: "hpPctBase",
    outOfCombatHp: "hpPctOutOfCombat",
    baseAtk: "atkPctBase",
    outOfCombatAtk: "atkPctOutOfCombat",
    baseDef: "defPctBase",
    outOfCombatDef: "defPctOutOfCombat",
}

const COMBAT_BONUS_EXTRA_KEYS = [
    "hpPctBase",
    "hpPctOutOfCombat",
    "atkPctBase",
    "atkPctOutOfCombat",
    "defPctBase",
    "defPctOutOfCombat",
]

const COMBAT_TARGET_BONUS_KEYS = [
    "enemyDefReduction",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
]

const COMBAT_BONUS_KEYS = [
    ...BONUS_KEYS,
    ...COMBAT_BONUS_EXTRA_KEYS,
    ...COMBAT_TARGET_BONUS_KEYS,
]
const BONUS_KEY_INDEX = new Map(BONUS_KEYS.map((key, index) => [key, index]))
const COMBAT_BONUS_KEY_INDEX = new Map(COMBAT_BONUS_KEYS.map((key, index) => [key, index]))
const PANEL_KEY_INDEX = new Map(OUTPUT_PANEL_KEYS.map((key, index) => [key, index]))

const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
const DAMAGE_ELEMENT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
    wind: "风",
}
const RES_IGNORE_KEY_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
    wind: "windResIgnore",
}
const RES_REDUCTION_KEY_BY_ELEMENT = {
    physical: "enemyPhysicalResReduction",
    fire: "enemyFireResReduction",
    ice: "enemyIceResReduction",
    electric: "enemyElectricResReduction",
    ether: "enemyEtherResReduction",
    wind: "enemyWindResReduction",
}
const RES_IGNORE_KEYS = Object.values(RES_IGNORE_KEY_BY_ELEMENT)

const SHEER_DMG_KEY_BY_ELEMENT = {
    physical: "physicalSheerDmg",
    fire: "fireSheerDmg",
    ice: "iceSheerDmg",
    electric: "electricSheerDmg",
    ether: "etherSheerDmg",
    wind: "windSheerDmg",
}

const DAMAGE_EVENT_KINDS = ["direct", "anomaly", "disorder", "sheer"]
const DISORDER_TYPE_VALUES = new Set(["normal", "polarized"])
const DAMAGE_MODIFIER_KINDS = ["anomalyDamageBonus", "disorderDamageBonus", "baseMultiplierBonus", "disorderBaseMultiplierBonus", "anomalyCritRate", "anomalyCritDmg", "stunDmgMultiplierBonus", "stunDmgMultiplierBonusAlways", "directDamageBonus", "sheerDmgBonus", "physicalSheerDmg", "fireSheerDmg", "iceSheerDmg", "electricSheerDmg", "etherSheerDmg", "windSheerDmg", "skillMultiplierBonus"]
const EVENT_MODIFIER_STAT_KEYS = new Set([
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "skillMultiplierBonus",
])
const SKILL_TARGET_STAT_KEYS = new Set([
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "skillMultiplierBonus",
])
const EVENT_MODIFIER_KIND_VALUES = new Set([
    ...DAMAGE_MODIFIER_KINDS,
    ...EVENT_MODIFIER_STAT_KEYS,
    ...SKILL_TARGET_STAT_KEYS,
])
const DAMAGE_MODIFIER_SUM_KEYS = [...EVENT_MODIFIER_KIND_VALUES]
const DAMAGE_MODIFIER_SUM_KEY_INDEX = new Map(DAMAGE_MODIFIER_SUM_KEYS.map((key, index) => [key, index]))

const DAMAGE_TARGET_PRESETS = [
    {
        id: "wandering-hunter",
        name: {
            zhCN: "彷徨猎手",
            en: "Wandering Hunter",
        },
        defense: 1588,
    },
    {
        id: "taichu-nightmare",
        name: {
            zhCN: "低防怪如太初梦魇",
            en: "Low DEF Enemy such as Taichu Nightmare",
        },
        defense: 476,
    },
    {
        id: "normal-boss",
        name: {
            zhCN: "正常boss",
            en: "Normal Boss",
        },
        defense: 953,
    },
]

const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
const DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT = 150
const SHEER_FORCE_ATK_RATIO = 0.3
const SHEER_FORCE_HP_RATIO = 0.1

const OUT_OF_COMBAT_BASIS_SOURCE_TYPES = new Set(["teammate", "wEngineTeam", "driveDisc4pcTeam", "field", "boss", "manual"])
const REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES = new Set(["self", "wEngine", "driveDisc4pc"])
const TARGET_STAT_KEYS = new Set(COMBAT_TARGET_BONUS_KEYS)
const STAT_ALIAS_MAP = {
    enemyDefIgnore: "enemyDefReduction",
}

const STORED_PERCENT_STATS = new Set([
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
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
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
])

const BASE_PERCENT_STATS = new Set([
    "critRate",
    "critDmg",
    "energyRegen",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
])

function roundNumbers(value) {
    if (typeof value === "number") {
        return Number(value.toFixed(12))
    }

    if (Array.isArray(value)) {
        return value.map(item => roundNumbers(item))
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, roundNumbers(item)])
        )
    }

    return value
}

function createBonusTotals() {
    return Object.fromEntries(BONUS_KEYS.map(key => [key, 0]))
}

function createCombatBonusTotals() {
    return {
        ...createBonusTotals(),
        ...Object.fromEntries(COMBAT_BONUS_EXTRA_KEYS.map(key => [key, 0])),
        ...Object.fromEntries(COMBAT_TARGET_BONUS_KEYS.map(key => [key, 0])),
        damageModifiers: [],
    }
}

function createPanel() {
    return Object.fromEntries(OUTPUT_PANEL_KEYS.map(key => [key, 0]))
}

function isStoredPercentStat(stat, mode) {
    return mode === "pct" || STORED_PERCENT_STATS.has(stat)
}

function canonicalBuffStat(stat) {
    return STAT_ALIAS_MAP[stat] ?? stat
}

function toCalcValue(stat, value, mode) {
    const numeric = Number(value ?? 0)
    return isStoredPercentStat(stat, mode) ? numeric / 100 : numeric
}

function toBaseCalcValue(stat, value) {
    const numeric = Number(value ?? 0)
    return BASE_PERCENT_STATS.has(stat) ? numeric / 100 : numeric
}

function toDamageModifierCalcValue(value, valueUnit = null) {
    const numeric = Number(value ?? 0)
    if (!Number.isFinite(numeric)) {
        return 0
    }

    if (valueUnit === "decimal") {
        return numeric
    }

    return Math.abs(numeric) > 1 ? numeric / 100 : numeric
}

function addBonus(totals, stat, value, mode) {
    const key = BONUS_KEY_MAP[stat]
    if (!key) {
        return
    }

    totals[key] += toCalcValue(stat, value, mode)
}

function addBonusCalcValue(totals, stat, value) {
    const key = BONUS_KEY_MAP[stat]
    if (!key) {
        return
    }

    totals[key] += Number(value ?? 0)
}

function basisValue(outOfCombat, basis) {
    switch (basis) {
        case "baseHp":
            return Number(outOfCombat.base?.hp ?? 0)
        case "outOfCombatHp":
            return Number(outOfCombat.panel?.hp ?? 0)
        case "baseAtk":
            return Number(outOfCombat.base?.atk ?? 0)
        case "outOfCombatAtk":
            return Number(outOfCombat.panel?.atk ?? 0)
        case "baseDef":
            return Number(outOfCombat.base?.def ?? 0)
        case "outOfCombatDef":
            return Number(outOfCombat.panel?.def ?? 0)
        default:
            throw new Error(`Unsupported combat buff basis: ${basis}`)
    }
}

function flatStatForPct(stat) {
    if (stat === "hpPct") {
        return "hpFlat"
    }

    if (stat === "atkPct") {
        return "atkFlat"
    }

    if (stat === "defPct") {
        return "defFlat"
    }

    return stat
}

function defaultCombatBasis(stat, sourceType) {
    if (stat.basis) {
        return stat.basis
    }

    if (stat.stat === "atkPct" && OUT_OF_COMBAT_BASIS_SOURCE_TYPES.has(sourceType)) {
        return "outOfCombatAtk"
    }

    return COMBAT_PCT_BASIS_BY_STAT[stat.stat]?.defaultBasis ?? null
}

function missingRequiredCombatBasis(stats, sourceType) {
    return stats.find(stat =>
        stat.stat === "atkPct"
        && (stat.mode ?? "flat") === "pct"
        && !stat.basis
        && !OUT_OF_COMBAT_BASIS_SOURCE_TYPES.has(sourceType)
    ) ?? null
}

function clampNumber(value, min, max) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return Number(min ?? 0)
    }

    return Math.max(Number(min ?? numeric), Math.min(Number(max ?? numeric), numeric))
}

export function clampWEngineModificationLevel(value, wEngine = {}) {
    const modification = wEngine?.modification ?? {}
    const min = Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1
    const max = Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5
    const defaultLevel = Number.isInteger(Number(modification.defaultLevel)) ? Number(modification.defaultLevel) : min
    const numeric = Number(value ?? defaultLevel)
    const level = Number.isFinite(numeric) ? Math.trunc(numeric) : defaultLevel
    return clampNumber(level, min, max)
}

function wEngineModificationRange(wEngine = {}) {
    const modification = wEngine?.modification ?? {}
    return {
        min: Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1,
        max: Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5,
        defaultLevel: Number.isInteger(Number(modification.defaultLevel)) ? Number(modification.defaultLevel) : 1,
    }
}

function strictWEngineModificationLevel(value, wEngine = {}) {
    const { min, max, defaultLevel } = wEngineModificationRange(wEngine)
    const numeric = Number(value)
    if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
        return defaultLevel
    }
    return numeric
}

function wEngineTeamModificationLevelMap(combatInput = {}) {
    return combatInput.wEngineTeamModificationLevels && typeof combatInput.wEngineTeamModificationLevels === "object"
        ? combatInput.wEngineTeamModificationLevels
        : {}
}

function materializedTeamWEngineEntry(sourceWEngine, levelMap = {}) {
    const key = wEngineTeamBuffKey(sourceWEngine)
    const modificationLevel = strictWEngineModificationLevel(levelMap[key], sourceWEngine)
    const materializedSourceWEngine = materializeWEngineForModificationLevel(sourceWEngine, modificationLevel)
    return {
        key,
        sourceWEngine: materializedSourceWEngine,
        teamBuff: wEngineEffectTeamBuff(materializedSourceWEngine),
        wEngineModificationLevel: modificationLevel,
    }
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

function defaultCoverage(effect) {
    return clampNumber(effect.coverage?.default ?? 1, effect.coverage?.min ?? 0, effect.coverage?.max ?? 1)
}

function coverageFromRuntime(effect, runtimeInput = {}) {
    return clampNumber(runtimeInput.coverage ?? defaultCoverage(effect), effect.coverage?.min ?? 0, effect.coverage?.max ?? 1)
}

function legacyStatsToEffects(stats = []) {
    return stats.map((stat, index) => ({
        id: stat.id ?? `legacy-${index + 1}`,
        type: "fixed",
        stat: stat.stat,
        value: Number(stat.value ?? 0),
        mode: stat.mode ?? "flat",
        basis: stat.basis ?? null,
        label: stat.label ?? null,
    }))
}

function effectRules(effect) {
    if (Array.isArray(effect?.effects)) {
        return effect.effects
    }

    const stats = Array.isArray(effect?.stats)
        ? effect.stats
        : effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
    return legacyStatsToEffects(stats)
}

function effectRuntimeFor(rule, runtimeInput = {}) {
    const id = rule.id ?? rule.stat ?? "effect"
    return runtimeInput.effects?.[id] ?? runtimeInput[id] ?? {}
}

function runtimeStackGroupKey(rule = {}) {
    if ((rule.type ?? "fixed") !== "stacked") {
        return ""
    }
    const stackGroup = String(rule.stackGroup ?? "").trim()
    return stackGroup
        ? `stackGroup:${stackGroup}`
        : `rule:${rule.id ?? rule.stat ?? "effect"}`
}

function normalizeEffectRuntimeInput(effect, runtimeInput = {}) {
    const input = runtimeInput && typeof runtimeInput === "object" ? runtimeInput : {}
    const rules = effectRules(effect)
    const grouped = new Map()
    for (const rule of rules) {
        const key = runtimeStackGroupKey(rule)
        if (!key) {
            continue
        }
        const id = rule.id ?? rule.stat ?? "effect"
        if (!grouped.has(key)) {
            grouped.set(key, [])
        }
        grouped.get(key).push(id)
    }

    if (![...grouped.values()].some(ids => ids.length > 1)) {
        return input
    }

    const effects = {
        ...(input.effects ?? {}),
    }
    for (const ids of grouped.values()) {
        if (ids.length < 2) {
            continue
        }
        let stacks = undefined
        for (const id of ids) {
            if (input.effects?.[id]?.stacks !== undefined) {
                stacks = input.effects[id].stacks
                break
            }
            if (input[id]?.stacks !== undefined) {
                stacks = input[id].stacks
                break
            }
        }
        if (stacks === undefined) {
            continue
        }
        for (const id of ids) {
            effects[id] = {
                ...(effects[id] ?? {}),
                stacks,
            }
        }
    }
    return {
        ...input,
        effects,
    }
}

function effectRuleEnabled(rule, runtimeInput = {}) {
    return effectRuntimeFor(rule, runtimeInput).enabled !== false
}

function effectBuffModifiers(effect) {
    return Array.isArray(effect?.buffModifiers) ? effect.buffModifiers : []
}

function stringArray(value) {
    return Array.isArray(value)
        ? value.map(item => String(item ?? "").trim()).filter(Boolean)
        : []
}

function normalizeBuffModifier(modifier = {}, source = {}) {
    const operation = modifier.operation ?? "multiplyResolvedValue"
    const factor = Number(modifier.factor ?? 1)
    if (operation !== "multiplyResolvedValue" || !Number.isFinite(factor) || factor <= 0) {
        return null
    }

    const targetBuffIds = stringArray(modifier.targetBuffIds)
    const targetEffectIds = stringArray(modifier.targetEffectIds)
    if (!targetBuffIds.length || !targetEffectIds.length) {
        return null
    }

    return {
        id: modifier.id ?? `${source.key ?? "buff"}.modifier`,
        label: modifier.label ?? null,
        operation,
        factor,
        targetBuffIds,
        targetEffectIds,
        sourceKey: source.key ?? null,
        sourceType: source.sourceType ?? null,
        sourceName: source.name ?? null,
    }
}

function collectBuffModifiers(effect, source = {}) {
    if ((effect?.scope ?? "outOfCombat") !== "inCombat") {
        return []
    }

    return effectBuffModifiers(effect)
        .map(modifier => normalizeBuffModifier(modifier, source))
        .filter(Boolean)
}

function buffModifierAppliesToRule(modifier, sourceKey, rule = {}) {
    const ruleId = String(rule.id ?? rule.stat ?? "").trim()
    if (!sourceKey || !ruleId) {
        return false
    }
    if (!modifier.targetBuffIds.includes(sourceKey)) {
        return false
    }
    if (!modifier.targetEffectIds.includes(ruleId)) {
        return false
    }
    return true
}

function applyBuffModifiersToResolvedRule(resolved, rule, modifierContext = {}) {
    const sourceKey = modifierContext.sourceKey
    const modifiers = Array.isArray(modifierContext.buffModifiers) ? modifierContext.buffModifiers : []
    const appliedBuffModifiers = modifiers.filter(modifier => buffModifierAppliesToRule(modifier, sourceKey, rule))
    if (!appliedBuffModifiers.length) {
        return resolved
    }

    const buffModifierFactor = appliedBuffModifiers.reduce((total, modifier) => total * modifier.factor, 1)
    return {
        ...resolved,
        value: Number(resolved.value ?? 0) * buffModifierFactor,
        buffModifierFactor,
        appliedBuffModifiers,
    }
}

function normalizedRuleTarget(rule = {}) {
    const target = rule.target ?? {}
    if (target.kind === "skill") {
        return {
            kind: "skill",
            skillTargets: Array.isArray(target.skillTargets) ? target.skillTargets : [],
        }
    }
    return { kind: "default" }
}

function ruleTargetKind(rule = {}) {
    return normalizedRuleTarget(rule).kind
}

function hasEventAppliesToFilters(rule = {}) {
    const appliesTo = rule.appliesTo ?? null
    return Boolean(appliesTo) && [
        appliesTo.damageKinds,
        appliesTo.anomalyEffects,
        appliesTo.elements,
        appliesTo.skillTargets,
    ].some(values => Array.isArray(values) && values.length > 0)
}

function isRuleEventModifier(rule = {}) {
    if ((rule.type ?? "fixed") === "damageModifier") {
        return true
    }
    const stat = canonicalBuffStat(rule.stat)
    return ruleTargetKind(rule) === "skill"
        || EVENT_MODIFIER_STAT_KEYS.has(stat)
        || (hasEventAppliesToFilters(rule) && EVENT_MODIFIER_KIND_VALUES.has(stat))
}

function eventModifierCalcValue(rule = {}) {
    const value = Number(rule.value ?? rule.valuePerStack ?? 0)
    if (!Number.isFinite(value)) {
        return 0
    }
    const stat = canonicalBuffStat(rule.stat)
    if (stat === "skillMultiplierBonus") {
        return value / 100
    }
    if (EVENT_MODIFIER_STAT_KEYS.has(stat)) {
        return value / 100
    }
    return toCalcValue(stat, value, rule.mode)
}

function resolveEffectRule(rule, effect, runtimeInput = {}, modifierContext = {}) {
    const type = rule.type ?? "fixed"
    const runtime = effectRuntimeFor(rule, runtimeInput)
    const coverage = coverageFromRuntime(effect, runtimeInput)
    const common = {
        id: rule.id ?? rule.stat ?? type,
        label: rule.label ?? null,
        type,
        stat: canonicalBuffStat(rule.stat),
        mode: rule.mode ?? "flat",
        basis: rule.basis ?? null,
        target: normalizedRuleTarget(rule),
        coverage,
    }

    if (type === "damageModifier") {
        return applyBuffModifiersToResolvedRule({
            ...common,
            kind: rule.kind,
            value: toDamageModifierCalcValue(rule.value, rule.valueUnit) * coverage,
            valueUnit: rule.valueUnit ?? null,
            appliesTo: rule.appliesTo ?? null,
        }, rule, modifierContext)
    }

    if (type === "derived") {
        const sourceValue = Number(runtime.sourceValue ?? rule.defaultSourceValue ?? 0)
        const ratio = Number(rule.ratio ?? rule.ratioPct ?? 0) / 100
        const uncappedValue = sourceValue * ratio
        const cappedValue = Number.isFinite(Number(rule.cap))
            ? Math.min(uncappedValue, Number(rule.cap))
            : uncappedValue
        const value = cappedValue * coverage
        return applyBuffModifiersToResolvedRule({
            ...common,
            sourceLabel: rule.sourceLabel ?? null,
            sourceValue,
            ratio: Number(rule.ratio ?? rule.ratioPct ?? 0),
            cap: Number.isFinite(Number(rule.cap)) ? Number(rule.cap) : null,
            uncappedValue,
            value,
        }, rule, modifierContext)
    }

    if (type === "formula") {
        const source = rule.source ?? {}
        const variable = source.variable ?? "x"
        const rawSourceValue = Number(runtime.sourceValue ?? source.defaultValue ?? rule.defaultSourceValue ?? 0)
        const min = Number(source.min)
        const max = Number(source.max)
        const sourceValue = clampNumber(
            rawSourceValue,
            Number.isFinite(min) ? min : rawSourceValue,
            Number.isFinite(max) ? max : rawSourceValue,
        )
        const expression = rule.formula?.expression ?? ""
        const formulaValue = evaluateFormulaExpression(expression, { [variable]: sourceValue })
        const value = formulaValue * coverage
        return applyBuffModifiersToResolvedRule({
            ...common,
            source,
            sourceLabel: source.label ?? rule.sourceLabel ?? null,
            variable,
            rawSourceValue,
            sourceValue,
            expression,
            valueUnit: rule.formula?.valueUnit ?? "storedValue",
            formulaValue,
            value,
        }, rule, modifierContext)
    }

    if (type === "stacked") {
        const maxStacks = Math.max(0, Number(rule.maxStacks ?? 1))
        const stacks = clampNumber(runtime.stacks ?? rule.defaultStacks ?? maxStacks, 0, maxStacks)
        const valuePerStack = Number(rule.valuePerStack ?? rule.value ?? 0)
        const value = valuePerStack * stacks * coverage
        return applyBuffModifiersToResolvedRule({
            ...common,
            value,
            valuePerStack,
            stacks,
            maxStacks,
            defaultStacks: Number(rule.defaultStacks ?? maxStacks),
        }, rule, modifierContext)
    }

    return applyBuffModifiersToResolvedRule({
        ...common,
        value: Number(rule.value ?? 0) * coverage,
    }, rule, modifierContext)
}

function resolveEffectStats(effect, runtimeInput = {}, modifierContext = {}) {
    return effectRules(effect)
        .filter(rule => effectRuleEnabled(rule, runtimeInput))
        .filter(rule => !isRuleEventModifier(rule))
        .map(rule => resolveEffectRule(rule, effect, runtimeInput, modifierContext))
        .filter(rule => rule.stat && Number.isFinite(Number(rule.value)))
}

function resolveEffectDamageModifiers(effect, runtimeInput = {}, modifierContext = {}) {
    return effectRules(effect)
        .filter(rule => effectRuleEnabled(rule, runtimeInput))
        .filter(rule => isRuleEventModifier(rule))
        .map(rule => {
            const resolved = resolveEffectRule(rule, effect, runtimeInput, modifierContext)
            if ((rule.type ?? "fixed") === "damageModifier") {
                return resolved
            }
            const target = normalizedRuleTarget(rule)
            return {
                ...resolved,
                type: "eventModifier",
                kind: resolved.stat,
                value: eventModifierCalcValue(resolved),
                appliesTo: target.kind === "skill"
                    ? { ...(rule.appliesTo ?? {}), skillTargets: target.skillTargets }
                    : rule.appliesTo ?? null,
            }
        })
        .filter(rule => EVENT_MODIFIER_KIND_VALUES.has(rule.kind) && Number.isFinite(Number(rule.value)))
}

function addCombatStat(totals, stat, sourceType, outOfCombat, resolvedStats) {
    const statKey = canonicalBuffStat(stat.stat)
    const value = toCalcValue(statKey, stat.value, stat.mode)
    const mode = stat.mode ?? "flat"
    const pctMeta = COMBAT_PCT_BASIS_BY_STAT[statKey]

    if (TARGET_STAT_KEYS.has(statKey)) {
        totals[statKey] += value
        resolvedStats?.push({
            ...stat,
            stat: statKey,
            value,
            mode,
        })
        return
    }

    if (pctMeta && mode === "pct") {
        const basis = defaultCombatBasis(stat, sourceType)
        const key = basis === pctMeta.defaultBasis
            ? pctMeta.baseKey
            : COMBAT_PCT_KEY_BY_BASIS[basis] === pctMeta.outOfCombatKey
                ? pctMeta.outOfCombatKey
                : null
        if (!key) {
            throw new Error(`Unsupported combat buff basis for ${statKey}: ${basis}`)
        }

        totals[key] += value
        resolvedStats?.push({
            ...stat,
            stat: statKey,
            value,
            mode,
            basis,
            resolvedStat: flatStatForPct(statKey),
            resolvedValue: basisValue(outOfCombat, basis) * value,
        })
        return
    }

    addBonusCalcValue(totals, statKey, value)
    resolvedStats?.push({
        ...stat,
        stat: statKey,
        value,
        mode,
    })
}

function normalizeEffect(effect, runtimeInput = {}, modifierContext = {}) {
    if (!effect) {
        return null
    }

    const normalizedRuntimeInput = normalizeEffectRuntimeInput(effect, runtimeInput)
    const stats = resolveEffectStats(effect, normalizedRuntimeInput, modifierContext)
    const damageModifiers = resolveEffectDamageModifiers(effect, normalizedRuntimeInput, modifierContext)

    return {
        name: effect.name ?? null,
        scope: effect.scope ?? "outOfCombat",
        condition: effect.condition ?? null,
        stats,
        damageModifiers,
        effects: effectRules(effect),
        buffModifiers: effectBuffModifiers(effect),
        coverage: effect.coverage ?? null,
        appliesToOutOfCombatPanel: effect.appliesToOutOfCombatPanel ?? true,
    }
}

function densePanelValue(panelValues, key) {
    const index = PANEL_KEY_INDEX.get(key)
    return index === undefined ? 0 : Number(panelValues[index] ?? 0)
}

function denseCombatValue(combatValues, key) {
    const index = COMBAT_BONUS_KEY_INDEX.get(key)
    return index === undefined ? 0 : Number(combatValues[index] ?? 0)
}

function addDenseCombatStat(totals, stat, sourceType, outBase, outPanelValues) {
    const statKey = canonicalBuffStat(stat.stat)
    const value = toCalcValue(statKey, stat.value, stat.mode)
    const mode = stat.mode ?? "flat"
    const pctMeta = COMBAT_PCT_BASIS_BY_STAT[statKey]

    if (TARGET_STAT_KEYS.has(statKey)) {
        const index = COMBAT_BONUS_KEY_INDEX.get(statKey)
        if (index !== undefined) {
            totals[index] += value
        }
        return
    }

    if (pctMeta && mode === "pct") {
        const basis = defaultCombatBasis(stat, sourceType)
        const key = basis === pctMeta.defaultBasis
            ? pctMeta.baseKey
            : COMBAT_PCT_KEY_BY_BASIS[basis] === pctMeta.outOfCombatKey
                ? pctMeta.outOfCombatKey
                : null
        const index = COMBAT_BONUS_KEY_INDEX.get(key)
        if (index !== undefined) {
            totals[index] += value
        }
        return
    }

    addBonusArrayCalcValue(totals, COMBAT_BONUS_KEY_INDEX, statKey, value)
}

function compileDenseCombatEffectEntry({
    effect,
    key,
    sourceType,
    runtimeInput,
    buffModifiers = [],
    setIndex = null,
    minSetCount = 0,
} = {}) {
    const normalized = normalizeEffect(effect, runtimeInput, { sourceKey: key, buffModifiers })
    if (!normalized || normalized.scope !== "inCombat") {
        return null
    }
    if (missingRequiredCombatBasis(normalized.stats, sourceType)) {
        return null
    }
    return {
        key,
        sourceType,
        setIndex,
        minSetCount,
        stats: normalized.stats,
        damageModifiers: normalized.damageModifiers,
    }
}

function compileDenseDamageModifierEntries(effectEntries = [], compiledEvents = []) {
    return (compiledEvents ?? []).map(compiledEvent => {
        const result = []
        effectEntries.forEach((entry, entryIndex) => {
            for (const modifier of entry.damageModifiers ?? []) {
                if (!damageModifierAppliesTo(modifier, compiledEvent.event)) {
                    continue
                }
                const kindIndex = DAMAGE_MODIFIER_SUM_KEY_INDEX.get(modifier.kind)
                if (kindIndex !== undefined) {
                    result.push({
                        entryIndex,
                        kindIndex,
                        value: Number(modifier.value ?? 0),
                    })
                }
            }
        })
        return result
    })
}

function normalizeCatalogLabel(label, fallback) {
    if (typeof label === "string") {
        return { zhCN: label }
    }

    return {
        zhCN: String(label?.zhCN ?? fallback ?? "").trim(),
        ...(label?.en ? { en: String(label.en).trim() } : {}),
    }
}

function normalizeAnomalyCatalogEffect(effect = {}) {
    const id = String(effect.id ?? "").trim()
    return {
        id,
        settlementType: "attribute",
        label: normalizeCatalogLabel(effect.label, id),
        element: DAMAGE_ELEMENTS.includes(effect.element) ? effect.element : "physical",
        baseMultiplier: Math.max(0, Number(effect.baseMultiplier ?? 0)),
        defaultProcCount: Math.max(0, Number(effect.defaultProcCount ?? 1)),
    }
}

function normalizeDisorderCatalogEffect(effect = {}) {
    const id = String(effect.id ?? "").trim()
    return {
        id,
        settlementType: "disorder",
        label: normalizeCatalogLabel(effect.label, id),
        element: DAMAGE_ELEMENTS.includes(effect.element) ? effect.element : "physical",
        fixedMultiplier: Math.max(0, Number(effect.fixedMultiplier ?? 4.5)),
        tickMultiplier: Math.max(0, Number(effect.tickMultiplier ?? 0)),
        tickIntervalSeconds: Math.max(0.0001, Number(effect.tickIntervalSeconds ?? 1)),
        defaultDurationSeconds: Math.max(0, Number(effect.defaultDurationSeconds ?? 10)),
    }
}

function rawAnomalyCatalogEffects(payload = {}) {
    if (Array.isArray(payload.effects)) {
        return payload.effects
    }
    return [
        ...(payload.anomalyEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "attribute",
        })),
        ...(payload.disorderEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "disorder",
        })),
    ]
}

function normalizeAnomalyCatalogPayload(payload = {}) {
    const effects = rawAnomalyCatalogEffects(payload)
    const anomalyEffects = effects
        .filter(effect => effect?.settlementType !== "disorder" && effect?.maintenanceType !== "disorder")
        .map(effect => normalizeAnomalyCatalogEffect(effect))
    const disorderEffects = effects
        .filter(effect => effect?.settlementType === "disorder" || effect?.maintenanceType === "disorder")
        .map(effect => normalizeDisorderCatalogEffect(effect))
    return {
        anomalyEffects,
        disorderEffects,
        anomalySettlementEffects: [
            ...anomalyEffects,
            ...disorderEffects,
        ],
    }
}

function buildMaps(catalog) {
    const agents = new Map(catalog.agents.map(agent => [agent.id, agent]))
    const wEngines = new Map(catalog.wEngines.map(item => [item.id, item]))
    const sets = new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const combatBuffs = new Map((catalog.combatBuffs ?? []).map(item => [item.id, item]))
    const agentSkills = new Map((catalog.agentSkills ?? []).map(item => [item.id, item]))
    const agentSkillsByAgent = new Map((catalog.agentSkills ?? []).map(item => [item.agentId, item]))
    const anomalyEffects = new Map((catalog.anomalyEffects ?? []).map(item => [item.id, item]))
    const disorderEffects = new Map((catalog.disorderEffects ?? []).map(item => [item.id, item]))
    const anomalySettlementEffects = new Map((catalog.anomalySettlementEffects ?? [
        ...(catalog.anomalyEffects ?? []),
        ...(catalog.disorderEffects ?? []),
    ]).map(item => [`${item.settlementType ?? "attribute"}:${item.id}`, item]))
    return {
        agentsMap: agents,
        wEnginesMap: wEngines,
        driveDiscSetsMap: sets,
        combatBuffsMap: combatBuffs,
        agentSkillsMap: agentSkills,
        agentSkillsByAgentMap: agentSkillsByAgent,
        anomalyEffectsMap: anomalyEffects,
        disorderEffectsMap: disorderEffects,
        anomalySettlementEffectsMap: anomalySettlementEffects,
    }
}

function catalogItemVisible(item = {}) {
    return item?.hidden !== true
}

function visibleTeammateCombatBuffGroups(groups = []) {
    return groups
        .filter(catalogItemVisible)
        .map(group => ({
            ...group,
            buffs: (group.buffs ?? [])
                .filter(catalogItemVisible)
                .map(buff => normalizeTeammateCombatBuffForGroup(group, buff)),
        }))
        .filter(group => group.buffs.length > 0)
}

function normalizeTeammateCombatBuffForGroup(teammate = {}, buff = {}) {
    const sourceLabel = buff.source ?? buff.sourceLabel ?? {}
    const description = buff.description ?? buff.conditionLabel ?? null
    return {
        ...buff,
        sourceType: "teammate",
        sourceCategory: "agent",
        sourceKind: "teammate",
        ownerId: teammate.id,
        ownerName: teammate.name,
        teammateId: teammate.id,
        teammateName: teammate.name,
        teammateImages: teammate.images ?? null,
        source: buff.source ?? sourceLabel,
        sourceLabel,
        name: buff.name ?? nameWithSource(teammate.name, sourceLabel),
        description,
        conditionLabel: buff.conditionLabel ?? description,
        scope: buff.scope ?? "inCombat",
    }
}

function visibleCatalogCollections(catalog = {}) {
    return {
        displayAgents: (catalog.agents ?? []).filter(catalogItemVisible),
        displayWEngines: (catalog.wEngines ?? []).filter(catalogItemVisible),
        displayDriveDiscSets: (catalog.driveDiscSets ?? []).filter(catalogItemVisible),
        displayCombatBuffs: (catalog.combatBuffs ?? []).filter(catalogItemVisible),
        displayTeammateCombatBuffGroups: visibleTeammateCombatBuffGroups(catalog.teammateCombatBuffGroups ?? []),
        displayTeammateCombatBuffs: (catalog.teammateCombatBuffs ?? []).filter(catalogItemVisible),
        displayFieldCombatBuffs: (catalog.fieldCombatBuffs ?? []).filter(catalogItemVisible),
        displayBossCombatBuffs: (catalog.bossCombatBuffs ?? []).filter(catalogItemVisible),
        displaySystemCombatBuffs: (catalog.systemCombatBuffs ?? []).filter(catalogItemVisible),
    }
}

function applyEffectSet(bonusTotals, effect, label, appliedEffects, ignoredEffects) {
    const normalized = normalizeEffect(effect)
    if (!normalized) {
        return
    }

    const isOutOfCombat = normalized.scope === "outOfCombat" && normalized.condition == null && normalized.appliesToOutOfCombatPanel !== false
    if (!isOutOfCombat) {
        ignoredEffects?.push(label)
        return
    }

    for (const stat of normalized.stats) {
        addBonus(bonusTotals, stat.stat, stat.value, stat.mode)
    }

    if (!appliedEffects) {
        return
    }

    appliedEffects.push({
        key: label,
        scope: normalized.scope,
        condition: normalized.condition,
        stats: normalized.stats.map(stat => ({
            ...stat,
            value: toCalcValue(stat.stat, stat.value, stat.mode),
        })),
    })
}

function wEngineEffectData(wEngine) {
    if (wEngine?.effect) {
        return wEngine.effect
    }

    if (wEngine?.passive) {
        return {
            name: wEngine.passive.name,
            description: null,
            requirement: wEngine.specialty
                ? {
                    specialty: wEngine.specialty,
                }
                : null,
            buff: wEngine.passive,
        }
    }

    return null
}

function wEngineEffectSelfBuff(wEngine) {
    const effect = wEngineEffectData(wEngine)
    return effect?.selfBuff ?? effect?.buff ?? null
}

function wEngineEffectTeamBuff(wEngine) {
    return wEngineEffectData(wEngine)?.teamBuff ?? null
}

function wEngineEffectBuff(wEngine) {
    return wEngineEffectSelfBuff(wEngine)
}

function wEngineSelfBuffKey(wEngine) {
    return `wEngine:${wEngine.id}.self`
}

function wEngineTeamBuffKey(wEngine) {
    return `wEngine:${wEngine.id}.team`
}

function wEngineCombatBuffEntries(wEngine) {
    const effectData = wEngineEffectData(wEngine)
    return [
        {
            key: wEngineSelfBuffKey(wEngine),
            effect: wEngineEffectSelfBuff(wEngine),
            sourceType: "wEngine",
            name: effectData?.name ?? wEngine.name,
            conditionLabel: wEngineEffectSelfBuff(wEngine)?.condition,
            requiresCurrentWearer: true,
        },
        {
            key: wEngineTeamBuffKey(wEngine),
            effect: wEngineEffectTeamBuff(wEngine),
            sourceType: "wEngineTeam",
            name: effectData?.name ?? wEngine.name,
            conditionLabel: wEngineEffectTeamBuff(wEngine)?.condition,
            requiresCurrentWearer: true,
        },
    ].filter(entry => entry.effect)
}

function driveDiscFourPiece(set) {
    return set?.fourPiece ?? null
}

function legacyFourPieceBuff(fourPiece) {
    if (!fourPiece || fourPiece.selfBuff || !effectRules(fourPiece).length) {
        return null
    }

    return {
        scope: "inCombat",
        condition: fourPiece.condition ?? null,
        durationSeconds: fourPiece.durationSeconds ?? null,
        cooldownSeconds: fourPiece.cooldownSeconds ?? null,
        appliesToOutOfCombatPanel: false,
        ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
        effects: effectRules(fourPiece),
    }
}

function driveDiscFourPieceSelfBuff(set) {
    const fourPiece = driveDiscFourPiece(set)
    const buff = fourPiece?.selfBuff ?? legacyFourPieceBuff(fourPiece)
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDiscFourPieceTeamBuff(set) {
    const buff = driveDiscFourPiece(set)?.teamBuff ?? null
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDisc4pcSelfKey(setId) {
    return `driveDisc4pc:${setId}.self`
}

function driveDisc4pcTeamKey(setId) {
    return `driveDisc4pc:${setId}.team`
}

function driveDisc4pcLegacyKey(setId) {
    return `driveDisc4pc:${setId}`
}

function cinemaBuffName(buff = {}) {
    const level = Number(buff.cinemaLevel)
    const prefix = Number.isInteger(level) ? `影画${level}` : "影画"
    const zhName = buff.cinemaName?.zhCN ?? buff.name?.zhCN ?? ""
    const enName = buff.cinemaName?.en ?? buff.name?.en ?? ""
    const name = {
        zhCN: [prefix, zhName].filter(Boolean).join("｜"),
    }
    if (enName) {
        name.en = [prefix, enName].filter(Boolean).join(" | ")
    }
    return name
}

function agentCombatBuffEntries(agent) {
    const combatBuffs = agent?.combatBuffs ?? {}
    const fixedEntries = [
        ["corePassive", combatBuffs.corePassive],
        ["additionalAbility", combatBuffs.additionalAbility],
    ]
        .filter(([, buff]) => buff)
        .map(([key, buff]) => ({
            id: `agent:${agent.id}.${key}`,
            key,
            buff,
            name: buff.name,
            conditionLabel: buff.conditionLabel,
        }))
    const cinemaEntries = (combatBuffs.cinemaBuffs ?? [])
        .filter(buff => buff)
        .map(buff => ({
            id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
            key: `cinema.${buff.cinemaLevel}`,
            buff,
            name: buff.name ?? cinemaBuffName(buff),
            conditionLabel: buff.conditionLabel ?? buff.description ?? null,
        }))
    return [...fixedEntries, ...cinemaEntries]
}

function nameWithSource(teammateName, sourceLabel) {
    const name = {
        zhCN: [teammateName?.zhCN, sourceLabel?.zhCN].filter(Boolean).join("｜"),
    }
    if (teammateName?.en || sourceLabel?.en) {
        name.en = [teammateName?.en, sourceLabel?.en].filter(Boolean).join(" | ")
    }
    return name
}

function flattenTeammateCombatBuffs(teammates) {
    return (teammates ?? []).flatMap(teammate =>
        (teammate.buffs ?? []).map(buff => normalizeTeammateCombatBuffForGroup(teammate, buff))
    )
}

function flattenFieldCombatBuffs(fieldBuffs) {
    return (fieldBuffs ?? []).map(buff => {
        const sourceLabel = buff.source ?? buff.sourceLabel ?? null
        const description = buff.description ?? buff.conditionLabel ?? null
        return {
            ...buff,
            sourceType: "field",
            sourceCategory: "field",
            sourceKind: "field",
            sourceLabel,
            period: buff.period ?? null,
            description,
            conditionLabel: buff.conditionLabel ?? description,
            scope: buff.scope ?? "inCombat",
        }
    })
}

function bossBuffName(buff = {}) {
    const name = {
        zhCN: [
            buff.bossName?.zhCN ?? buff.name?.zhCN,
            buff.bossSource?.zhCN ?? buff.source?.zhCN,
        ].filter(Boolean).join("｜"),
    }
    if (buff.bossName?.en || buff.name?.en || buff.bossSource?.en || buff.source?.en) {
        name.en = [
            buff.bossName?.en ?? buff.name?.en,
            buff.bossSource?.en ?? buff.source?.en,
        ].filter(Boolean).join(" | ")
    }
    return name
}

function flattenBossCombatBuffs(bossBuffs) {
    return (bossBuffs ?? []).map(buff => {
        const bossSource = buff.bossSource ?? buff.source ?? buff.sourceLabel ?? null
        const description = buff.description ?? buff.conditionLabel ?? null
        return {
            ...buff,
            sourceType: "boss",
            sourceCategory: "boss",
            sourceKind: "boss",
            bossSource,
            sourceLabel: bossSource,
            name: buff.name ?? bossBuffName(buff),
            description,
            conditionLabel: buff.conditionLabel ?? description,
            scope: buff.scope ?? "inCombat",
        }
    })
}

function legacyCombatBuffBuckets(buffs) {
    const buckets = {
        fieldBuffs: [],
        bossBuffs: [],
        systemBuffs: [],
    }

    for (const buff of buffs ?? []) {
        if (buff?.sourceType === "field") {
            buckets.fieldBuffs.push(buff)
        } else if (buff?.sourceType === "boss") {
            buckets.bossBuffs.push(buff)
        } else {
            buckets.systemBuffs.push(buff)
        }
    }

    return buckets
}

function collectMissingAtkPctBasis(violations, sourceType, label, effect) {
    const isImplicitInCombat = sourceType === "driveDisc4pc"
    if (!REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES.has(sourceType) || (!isImplicitInCombat && effect?.scope !== "inCombat")) {
        return
    }

    effectRules(effect).forEach((rule, index) => {
        if (rule.stat === "atkPct" && (rule.mode ?? "flat") === "pct" && !rule.basis) {
            violations.push(`${label}.effects[${index}]`)
        }
    })
}

function collectCinemaBuffViolations(violations, agent) {
    const cinemaBuffs = agent?.combatBuffs?.cinemaBuffs
    if (cinemaBuffs === undefined || cinemaBuffs === null) {
        return
    }
    if (!Array.isArray(cinemaBuffs)) {
        violations.push(`agent:${agent.id}.combatBuffs.cinemaBuffs must be an array`)
        return
    }

    const seenLevels = new Set()
    cinemaBuffs.forEach((buff, index) => {
        const level = Number(buff?.cinemaLevel)
        const label = `agent:${agent.id}.combatBuffs.cinemaBuffs[${index}].cinemaLevel`
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            violations.push(`${label} must be an integer from 1 to 6`)
            return
        }
        if (seenLevels.has(level)) {
            violations.push(`${label} duplicates cinema ${level}`)
            return
        }
        seenLevels.add(level)
    })
}

function validateCatalogModeling(catalog) {
    const violations = []

    for (const agent of catalog.agents ?? []) {
        collectCinemaBuffViolations(violations, agent)
        for (const entry of agentCombatBuffEntries(agent)) {
            collectMissingAtkPctBasis(violations, "self", entry.id, entry.buff)
        }
    }

    for (const wEngine of catalog.wEngines ?? []) {
        collectMissingAtkPctBasis(violations, "wEngine", wEngineSelfBuffKey(wEngine), wEngineEffectSelfBuff(wEngine))
        collectMissingAtkPctBasis(violations, "wEngineTeam", wEngineTeamBuffKey(wEngine), wEngineEffectTeamBuff(wEngine))
    }

    for (const set of catalog.driveDiscSets ?? []) {
        collectMissingAtkPctBasis(violations, "driveDisc4pc", driveDisc4pcSelfKey(set.id), driveDiscFourPieceSelfBuff(set))
        collectMissingAtkPctBasis(violations, "driveDisc4pcTeam", driveDisc4pcTeamKey(set.id), driveDiscFourPieceTeamBuff(set))
    }

    for (const buff of catalog.combatBuffs ?? []) {
        collectMissingAtkPctBasis(violations, buff.sourceType, buff.id, buff)
    }

    if (violations.length) {
        throw new Error(`Catalog modeling violations: ${violations.join(", ")}`)
    }
}

function applyCombatEffect({ bonusTotals, effect, key, name, sourceType, conditionLabel, outOfCombat, runtimeInput, buffModifiers, activeEffects, ignoredEffects }) {
    const normalized = normalizeEffect(effect, runtimeInput, {
        sourceKey: key,
        buffModifiers,
    })
    if (!normalized) {
        ignoredEffects?.push({
            key,
            sourceType,
            reason: "missingEffect",
        })
        return
    }

    if (normalized.scope !== "inCombat") {
        ignoredEffects?.push({
            key,
            sourceType,
            scope: normalized.scope,
            reason: "notInCombat",
        })
        return
    }

    const missingBasisStat = missingRequiredCombatBasis(normalized.stats, sourceType)
    if (missingBasisStat) {
        ignoredEffects?.push({
            key,
            sourceType,
            reason: "missingAtkPctBasis",
            stat: missingBasisStat.stat,
        })
        return
    }

    const resolvedStats = activeEffects ? [] : null
    for (const stat of normalized.stats) {
        addCombatStat(bonusTotals, stat, sourceType, outOfCombat, resolvedStats)
    }
    const resolvedDamageModifiers = activeEffects
        ? normalized.damageModifiers.map(modifier => ({
            ...modifier,
            sourceKey: key,
            sourceType,
        }))
        : normalized.damageModifiers
    bonusTotals.damageModifiers.push(...resolvedDamageModifiers)

    if (!activeEffects) {
        return
    }

    activeEffects.push({
        key,
        name: name ?? normalized.name,
        sourceType,
        scope: normalized.scope,
        condition: normalized.condition,
        conditionLabel: conditionLabel ?? effect.conditionLabel ?? normalized.condition ?? null,
        stats: normalized.stats.map(stat => ({
            ...stat,
            value: toCalcValue(stat.stat, stat.value, stat.mode),
        })),
        effects: normalized.effects,
        buffModifiers: normalized.buffModifiers,
        coverage: normalized.coverage,
        runtime: runtimeInput ?? null,
        resolvedStats,
        resolvedDamageModifiers,
    })
}

function collectActiveBuffModifiers({
    activeCatalogBuffs = [],
    activeAgentBuffs = [],
    activeCurrentWEngineEntries = [],
    activeTeamWEngineEntries = [],
    activeDriveDisc4pcIds = [],
    teammateDriveDiscSetIds = [],
    driveDiscSets = new Map(),
    setCounts = new Map(),
    getSetCount = null,
    currentWEngineRequirement = null,
    agent = null,
} = {}) {
    const modifiers = []
    const readSetCount = typeof getSetCount === "function"
        ? getSetCount
        : setId => setCounts.get(setId) ?? 0

    for (const buff of activeCatalogBuffs) {
        modifiers.push(...collectBuffModifiers(buff, {
            key: buff.id,
            name: buff.name,
            sourceType: buff.sourceType ?? "manual",
        }))
    }

    for (const entry of activeAgentBuffs) {
        modifiers.push(...collectBuffModifiers(entry.buff, {
            key: entry.id,
            name: entry.name,
            sourceType: "self",
        }))
    }

    for (const entry of activeCurrentWEngineEntries) {
        if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent?.specialty) {
            continue
        }

        modifiers.push(...collectBuffModifiers(entry.effect, {
            key: entry.key,
            name: entry.effect?.name ?? entry.name,
            sourceType: entry.sourceType,
        }))
    }

    for (const entry of activeTeamWEngineEntries) {
        modifiers.push(...collectBuffModifiers(entry.teamBuff, {
            key: entry.key,
            name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine?.name,
            sourceType: "wEngineTeam",
        }))
    }

    for (const activeId of activeDriveDisc4pcIds) {
        const rawKey = String(activeId).slice("driveDisc4pc:".length)
        const [setId, part = "self"] = rawKey.split(".")
        const set = driveDiscSets.get(setId)
        const count = readSetCount(setId)
        if (!set || count < 4) {
            continue
        }

        const effect = part === "team"
            ? driveDiscFourPieceTeamBuff(set)
            : driveDiscFourPieceSelfBuff(set)
        modifiers.push(...collectBuffModifiers(effect, {
            key: activeId,
            name: set.name,
            sourceType: part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc",
        }))
    }

    teammateDriveDiscSetIds.forEach((setId, index) => {
        if (!setId) {
            return
        }

        const set = driveDiscSets.get(setId)
        if (!set) {
            return
        }

        const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
        const teamBuff = driveDiscFourPieceTeamBuff(set)
        modifiers.push(...collectBuffModifiers(teamBuff, {
            key,
            name: set.name,
            sourceType: "driveDisc4pcTeam",
        }))
    })

    return modifiers
}

function indexedSetCountGetter(setCountValues, setIds = [], setIndexById = null) {
    return setId => {
        const mappedIndex = setIndexById?.get?.(setId)
        const index = mappedIndex !== undefined
            ? mappedIndex
            : Array.isArray(setIds)
                ? setIds.indexOf(setId)
                : -1
        return index >= 0 ? Number(setCountValues?.[index] ?? 0) : 0
    }
}

function addIndexedStatTotals(bonusTotals, statValues = [], statIds = []) {
    const length = Math.min(statValues.length ?? 0, statIds.length ?? 0)
    for (let index = 0; index < length; index += 1) {
        const value = Number(statValues[index] ?? 0)
        if (value !== 0) {
            addBonus(bonusTotals, statIds[index], value)
        }
    }
}

function addBonusArrayValue(totals, keyIndex, stat, value, mode) {
    const key = BONUS_KEY_MAP[stat]
    const index = keyIndex.get(key)
    if (index === undefined) {
        return
    }
    totals[index] += toCalcValue(stat, value, mode)
}

function addBonusArrayCalcValue(totals, keyIndex, stat, value) {
    const key = BONUS_KEY_MAP[stat]
    const index = keyIndex.get(key)
    if (index === undefined) {
        return
    }
    totals[index] += Number(value ?? 0)
}

function denseValue(values, keyIndex, key) {
    const index = keyIndex.get(key)
    return index === undefined ? 0 : Number(values[index] ?? 0)
}

function compileDenseOutOfCombatSetBonuses(driveDiscSets = new Map(), setIds = []) {
    return (setIds ?? []).map(setId => {
        const set = driveDiscSets.get(setId)
        const normalized = normalizeEffect(set?.twoPiece)
        if (
            !normalized
            || normalized.scope !== "outOfCombat"
            || normalized.condition != null
            || normalized.appliesToOutOfCombatPanel === false
        ) {
            return []
        }
        return normalized.stats
            .map(stat => {
                const key = BONUS_KEY_MAP[stat.stat]
                const index = BONUS_KEY_INDEX.get(key)
                return index === undefined
                    ? null
                    : { index, stat: stat.stat, value: toCalcValue(stat.stat, stat.value, stat.mode) }
            })
            .filter(Boolean)
    })
}

function addDenseSetBonuses(bonusTotals, setCountValues = [], compiledSetBonuses = []) {
    const length = Math.min(setCountValues.length ?? 0, compiledSetBonuses.length ?? 0)
    for (let index = 0; index < length; index += 1) {
        if (Number(setCountValues[index] ?? 0) < 2) {
            continue
        }
        for (const stat of compiledSetBonuses[index] ?? []) {
            bonusTotals[stat.index] += stat.value
        }
    }
}

function setCountsSignature(setCounts = new Map()) {
    return [...setCounts.entries()]
        .filter(([, count]) => Number(count ?? 0) > 0)
        .sort(([left], [right]) => String(left).localeCompare(String(right)))
        .map(([setId, count]) => `${setId}:${Number(count ?? 0)}`)
        .join("|")
}

function indexedSetCountsSignature(setCountValues = [], setIds = []) {
    const entries = []
    const length = Math.min(setCountValues.length ?? 0, setIds.length ?? 0)
    for (let index = 0; index < length; index += 1) {
        const count = Number(setCountValues[index] ?? 0)
        if (count > 0) {
            entries.push(`${setIds[index]}:${count}`)
        }
    }
    return entries.sort().join("|")
}

function combatFlatFromPct(totals, outOfCombat) {
    return {
        hp: (outOfCombat.base.hp * totals.hpPctBase) + (outOfCombat.panel.hp * totals.hpPctOutOfCombat),
        atk: (outOfCombat.base.atk * totals.atkPctBase) + (outOfCombat.panel.atk * totals.atkPctOutOfCombat),
        def: (outOfCombat.base.def * totals.defPctBase) + (outOfCombat.panel.def * totals.defPctOutOfCombat),
    }
}

function calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals) {
    const panel = {
        ...createPanel(),
        ...outOfCombat.panel,
    }

    panel.hp = outOfCombat.panel.hp
        + bonusTotals.hpFlat
        + outOfCombat.base.hp * (bonusTotals.hpPct + bonusTotals.hpPctBase)
        + outOfCombat.panel.hp * bonusTotals.hpPctOutOfCombat
    panel.atk = outOfCombat.panel.atk
        + bonusTotals.atkFlat
        + outOfCombat.base.atk * (bonusTotals.atkPct + bonusTotals.atkPctBase)
        + outOfCombat.panel.atk * bonusTotals.atkPctOutOfCombat
    panel.def = outOfCombat.panel.def
        + bonusTotals.defFlat
        + outOfCombat.base.def * (bonusTotals.defPct + bonusTotals.defPctBase)
        + outOfCombat.panel.def * bonusTotals.defPctOutOfCombat
    panel.critRate = outOfCombat.panel.critRate + bonusTotals.critRate
    panel.critDmg = outOfCombat.panel.critDmg + bonusTotals.critDmg
    panel.impact = (outOfCombat.panel.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
    panel.anomalyProficiency = outOfCombat.panel.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
    panel.anomalyMastery = outOfCombat.panel.anomalyMastery + bonusTotals.anomalyMasteryFlat
    panel.energyRegen = outOfCombat.panel.energyRegen * (1 + bonusTotals.energyRegenPct)
    panel.penFlat = outOfCombat.panel.penFlat + bonusTotals.penFlat
    panel.penRatio = outOfCombat.panel.penRatio + bonusTotals.penRatio
    for (const key of RES_IGNORE_KEYS) {
        panel[key] = outOfCombat.panel[key] + bonusTotals[key]
    }
    panel.dmgBonus = outOfCombat.panel.dmgBonus + bonusTotals.dmgBonus
    for (const element of DAMAGE_ELEMENTS) {
        const key = `${element}Dmg`
        panel[key] = outOfCombat.panel[key] + bonusTotals[key]
    }
    applyPanelSheerForce(agent, panel, bonusTotals)

    const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
    const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

    return {
        panel,
        selectedDmgBonus,
    }
}

function damageTargetPreset(id) {
    return DAMAGE_TARGET_PRESETS.find(item => item.id === id)
        ?? DAMAGE_TARGET_PRESETS.find(item => item.id === DEFAULT_DAMAGE_TARGET_PRESET_ID)
        ?? DAMAGE_TARGET_PRESETS[0]
}

function normalizeResistancePercent(value, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric / 100 : fallback
}

function normalizeResistanceByElement(targetInput, damageElement) {
    const source = targetInput.resistanceByElement && typeof targetInput.resistanceByElement === "object"
        ? targetInput.resistanceByElement
        : {}
    const fallbackResistance = normalizeResistancePercent(targetInput.resistance, 0)
    const resistanceByElement = {}
    for (const element of DAMAGE_ELEMENTS) {
        if (source[element] !== undefined && source[element] !== null && source[element] !== "") {
            resistanceByElement[element] = normalizeResistancePercent(source[element])
        } else {
            resistanceByElement[element] = fallbackResistance
        }
    }

    if (resistanceByElement[damageElement] === undefined) {
        resistanceByElement[damageElement] = fallbackResistance
    }

    return resistanceByElement
}

function normalizeStunMultiplierPercent(targetInput = {}) {
    const rawValue = targetInput.stunMultiplierPercent !== undefined
        ? targetInput.stunMultiplierPercent
        : targetInput.stunMultiplier !== undefined
            ? Number(targetInput.stunMultiplier) * 100
            : DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT
    const numeric = Number(rawValue)
    return Number.isFinite(numeric) ? Math.max(0, numeric) : DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT
}

function normalizeStunned(value) {
    return value === true || value === "true" || value === 1 || value === "1"
}

function localizedName(value, fallback = "") {
    if (typeof value === "string") {
        return value || fallback
    }

    return value?.zhCN ?? value?.en ?? fallback
}

function resolveDamageSkillRef(catalog, agent, skillRef = null, options = {}) {
    if (!skillRef || typeof skillRef !== "object") {
        return null
    }

    const agentSkillId = String(skillRef.agentSkillId ?? "").trim()
    const skillSet = agentSkillId
        ? (typeof catalog.agentSkillsMap?.get === "function" ? catalog.agentSkillsMap.get(agentSkillId) : null)
            ?? (catalog.agentSkills ?? []).find(item => item.id === agentSkillId)
        : (typeof catalog.agentSkillsByAgentMap?.get === "function" ? catalog.agentSkillsByAgentMap.get(agent.id) : null)
            ?? (catalog.agentSkills ?? []).find(item => item.agentId === agent.id)
    if (!skillSet) {
        throw new Error(`Unknown agent skill catalog: ${agentSkillId || agent.id}`)
    }
    if (skillSet.agentId !== agent.id) {
        throw new Error(`Skill catalog ${skillSet.id} does not belong to agent ${agent.id}`)
    }

    const categoryId = String(skillRef.categoryId ?? "").trim()
    const moveId = String(skillRef.moveId ?? "").trim()
    const rowId = String(skillRef.rowId ?? "").trim()
    const category = (skillSet.categories ?? []).find(item => item.id === categoryId)
    if (!category) {
        throw new Error(`Unknown skill category for ${skillSet.id}: ${categoryId}`)
    }
    const move = (category.moves ?? []).find(item => item.id === moveId)
    if (!move) {
        throw new Error(`Unknown skill move for ${skillSet.id}.${categoryId}: ${moveId}`)
    }
    const row = damageSkillRowsWithGeneratedTotals(category, move).find(item => item.id === rowId)
    if (!row) {
        throw new Error(`Unknown skill multiplier row for ${skillSet.id}.${categoryId}.${moveId}: ${rowId}`)
    }
    if ((row.kind ?? "damageMultiplier") !== "damageMultiplier") {
        throw new Error(`Skill row is not a damage multiplier: ${skillSet.id}.${categoryId}.${moveId}.${rowId}`)
    }

    const isCoreSkillLevel = isCoreSkillLevelScale(category)
    const defaultLevel = defaultLevelForSkill(category, move, row)
    const rawRequestedLevel = skillRef.level
        ?? (isCoreSkillLevel ? options.coreSkillLevel : undefined)
        ?? defaultLevel
    const requestedLevel = isCoreSkillLevel
        ? (String(rawRequestedLevel ?? "").trim() === "" || rawRequestedLevel === "none" ? "0" : String(rawRequestedLevel).trim())
        : Number(rawRequestedLevel)
    if (!isValidSkillLevel(category, move, row, requestedLevel)) {
        throw new Error(`Skill level out of range for ${skillSet.id}.${categoryId}.${moveId}.${rowId}: ${skillRef.level}`)
    }

    const value = skillRowValue(category, move, row, requestedLevel)
    if (!Number.isFinite(value)) {
        throw new Error(`Missing skill multiplier for ${skillSet.id}.${categoryId}.${moveId}.${rowId} level ${requestedLevel}`)
    }

    const labelParts = [
        localizedName(category.name, category.id),
        localizedName(move.name, move.id),
        localizedName(row.label, row.id),
    ].filter(Boolean)

    return {
        skillMultiplier: Math.max(0, value / 100),
        skillPercent: value,
        skillSource: {
            agentSkillId: skillSet.id,
            categoryId,
            moveId,
            rowId,
            generatedFromRowIds: Array.isArray(row.generatedFromRowIds) ? row.generatedFromRowIds : [],
            level: requestedLevel,
            levelScale: skillLevelScale(category),
            levelLabel: skillLevelLabel(category, requestedLevel),
            damageBasis: row.damageBasis ?? "atk",
            damageElement: DAMAGE_ELEMENTS.includes(move.damageElement) ? move.damageElement : null,
            categoryName: category.name,
            moveName: move.name,
            rowLabel: row.label,
            label: labelParts.join(" / "),
        },
    }
}

function normalizeDamageTarget(input = {}, damageElement) {
    const targetInput = input.target ?? {}
    const preset = damageTargetPreset(targetInput.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID)
    const defense = Number(targetInput.defense ?? preset?.defense ?? 953)
    const levelCoefficient = DEFAULT_DAMAGE_LEVEL_COEFFICIENT
    const stunned = normalizeStunned(targetInput.stunned)
    const stunMultiplierPercent = normalizeStunMultiplierPercent(targetInput)
    const stunMultiplier = stunMultiplierPercent / 100

    return {
        presetId: targetInput.presetId ?? preset?.id ?? DEFAULT_DAMAGE_TARGET_PRESET_ID,
        defense: Number.isFinite(defense) ? Math.max(0, defense) : Number(preset?.defense ?? 953),
        levelCoefficient,
        resistanceByElement: normalizeResistanceByElement(targetInput, damageElement),
        stunned,
        stunMultiplier,
        activeStunMultiplier: stunned ? stunMultiplier : 1,
    }
}

function normalizeDamageCount(value, fallback = 1) {
    const numeric = Number(value ?? fallback)
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
}

function normalizeDamageEventLabel(event = {}) {
    const label = typeof event.label === "string"
        ? event.label.trim()
        : localizedName(event.label, "").trim()
    return label || null
}

function normalizeAgentLevel(value) {
    const numeric = Number(value ?? 60)
    return Number.isFinite(numeric) ? clampNumber(numeric, 1, 60) : 60
}

function trunc4(value) {
    return Math.trunc(Number(value ?? 0) * 10000) / 10000
}

function anomalyLevelMultiplier(agentLevel) {
    return clampNumber(trunc4(1 + (normalizeAgentLevel(agentLevel) - 1) / 59), 1, 2)
}

function anomalyEffectData(catalog, effectId) {
    const key = String(effectId ?? "").trim()
    const effect = (typeof catalog?.anomalyEffectsMap?.get === "function" ? catalog.anomalyEffectsMap.get(key) : null)
        ?? (catalog?.anomalyEffects ?? []).find(item => item.id === key)
    if (!effect) {
        throw new Error(`Unknown anomaly effect: ${effectId}`)
    }
    return effect
}

function disorderEffectData(catalog, effectId) {
    const key = String(effectId ?? "").trim()
    const effect = (typeof catalog?.disorderEffectsMap?.get === "function" ? catalog.disorderEffectsMap.get(key) : null)
        ?? (catalog?.disorderEffects ?? []).find(item => item.id === key)
    if (!effect) {
        throw new Error(`Unknown disorder anomaly effect: ${effectId}`)
    }
    return effect
}

function disorderBaseMultiplier(effect, elapsedSeconds) {
    const duration = Math.max(0, Number(effect.defaultDurationSeconds ?? 10))
    const elapsed = clampNumber(Number(elapsedSeconds ?? 0), 0, duration)
    const remaining = Math.max(0, duration - elapsed)
    const interval = Math.max(0.0001, Number(effect.tickIntervalSeconds ?? 1))
    const tickCount = Math.floor((remaining + 1e-9) / interval)
    return {
        duration,
        elapsed,
        remaining,
        tickCount,
        baseMultiplier: Number(effect.fixedMultiplier ?? 4.5) + tickCount * Number(effect.tickMultiplier ?? 0),
    }
}

function normalizeDisorderType(value) {
    return DISORDER_TYPE_VALUES.has(value) ? value : "normal"
}

function disorderMultiplierScale(type) {
    return normalizeDisorderType(type) === "polarized" ? 0.25 : 1
}

function normalizeDirectDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    if (event.normalized === true) {
        const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement)
            ? event.damageElement
            : resolveDamageElement(agent)
        return {
            ...event,
            id: String(event.id ?? `direct-${index + 1}`),
            kind: "direct",
            normalized: true,
            skillMultiplier: Math.max(0, Number(event.skillMultiplier ?? 1)),
            skillSource: event.skillSource ?? null,
            label: normalizeDamageEventLabel(event),
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode)
                ? event.critMode
                : "expected",
            damageElement,
            count: normalizeDamageCount(event.count, 1),
        }
    }

    const skillRefResult = resolveDamageSkillRef(catalog, agent, event.skillRef, options)
    const skillMultiplier = skillRefResult?.skillMultiplier
        ?? (event.normalized === true ? Number(event.skillMultiplier ?? 1) : Number(event.skillMultiplier ?? 100) / 100)
    const critMode = ["expected", "crit", "nonCrit"].includes(event.critMode)
        ? event.critMode
        : "expected"
    const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement)
        ? event.damageElement
        : skillRefResult?.skillSource?.damageElement ?? resolveDamageElement(agent)

    return {
        id: String(event.id ?? `direct-${index + 1}`),
        kind: "direct",
        normalized: true,
        skillMultiplier: Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 1,
        skillSource: skillRefResult?.skillSource ?? null,
        label: normalizeDamageEventLabel(event),
        critMode,
        damageElement,
        count: normalizeDamageCount(event.count, 1),
    }
}

function normalizeSheerDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    if (event.normalized === true) {
        const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement)
            ? event.damageElement
            : resolveDamageElement(agent)
        return {
            ...event,
            id: String(event.id ?? `sheer-${index + 1}`),
            kind: "sheer",
            normalized: true,
            skillMultiplier: Math.max(0, Number(event.skillMultiplier ?? 1)),
            skillSource: event.skillSource ?? null,
            label: normalizeDamageEventLabel(event),
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode)
                ? event.critMode
                : "expected",
            damageElement,
            count: normalizeDamageCount(event.count, 1),
        }
    }

    const skillRefResult = resolveDamageSkillRef(catalog, agent, event.skillRef, options)
    const skillMultiplier = skillRefResult?.skillMultiplier
        ?? Number(event.skillMultiplier ?? 100) / 100
    const critMode = ["expected", "crit", "nonCrit"].includes(event.critMode)
        ? event.critMode
        : "expected"
    const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement)
        ? event.damageElement
        : skillRefResult?.skillSource?.damageElement ?? resolveDamageElement(agent)

    return {
        id: String(event.id ?? `sheer-${index + 1}`),
        kind: "sheer",
        normalized: true,
        skillMultiplier: Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 1,
        skillSource: skillRefResult?.skillSource ?? null,
        label: normalizeDamageEventLabel(event),
        critMode,
        damageElement,
        count: normalizeDamageCount(event.count, 1),
    }
}

function normalizeAnomalyDamageEvent(event = {}, catalog = {}, index = 0) {
    if (event.normalized === true) {
        return {
            ...event,
            id: String(event.id ?? `anomaly-${index + 1}`),
            kind: "anomaly",
            settlementType: "attribute",
            normalized: true,
            anomalyEffect: String(event.anomalyEffect ?? ""),
            damageElement: DAMAGE_ELEMENTS.includes(event.damageElement) ? event.damageElement : "physical",
            baseMultiplier: Math.max(0, Number(event.baseMultiplier ?? 0)),
            baseMultiplierPerProc: Math.max(0, Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0)),
            procCount: normalizeDamageCount(event.procCount, 1),
            count: normalizeDamageCount(event.count, 1),
        }
    }

    const effect = anomalyEffectData(catalog, event.anomalyEffect ?? "assault")
    const procCount = normalizeDamageCount(event.procCount, effect.defaultProcCount)
    return {
        id: String(event.id ?? `anomaly-${index + 1}`),
        kind: "anomaly",
        settlementType: "attribute",
        normalized: true,
        anomalyEffect: effect.id,
        anomalyLabel: effect.label,
        damageElement: effect.element,
        baseMultiplier: Number(effect.baseMultiplier ?? 0) * procCount,
        baseMultiplierPerProc: Number(effect.baseMultiplier ?? 0),
        procCount,
        count: normalizeDamageCount(event.count, 1),
    }
}

function normalizeDisorderDamageEvent(event = {}, catalog = {}, index = 0) {
    const disorderType = normalizeDisorderType(event.disorderType)
    if (event.normalized === true) {
        let effect = null
        try {
            effect = disorderEffectData(catalog, event.anomalyEffect ?? event.previousAnomalyEffect ?? "burn")
        } catch {
            effect = null
        }
        const disorder = effect ? disorderBaseMultiplier(effect, event.elapsedSeconds) : null
        const duration = disorder?.duration ?? Math.max(0, Number(event.durationSeconds ?? 10))
        const elapsed = disorder?.elapsed ?? clampNumber(Number(event.elapsedSeconds ?? 0), 0, duration)
        return {
            ...event,
            id: String(event.id ?? `disorder-${index + 1}`),
            kind: "anomaly",
            settlementType: "disorder",
            disorderType,
            normalized: true,
            previousAnomalyEffect: effect?.id ?? String(event.previousAnomalyEffect ?? event.anomalyEffect ?? ""),
            anomalyEffect: effect?.id ?? String(event.anomalyEffect ?? event.previousAnomalyEffect ?? ""),
            anomalyLabel: effect?.label ?? event.anomalyLabel,
            damageElement: DAMAGE_ELEMENTS.includes(effect?.element) ? effect.element : DAMAGE_ELEMENTS.includes(event.damageElement) ? event.damageElement : "physical",
            baseMultiplier: disorder?.baseMultiplier ?? Math.max(0, Number(event.baseMultiplier ?? 0)),
            fixedMultiplier: effect ? Number(effect.fixedMultiplier ?? 4.5) : Math.max(0, Number(event.fixedMultiplier ?? 4.5)),
            tickMultiplier: effect ? Number(effect.tickMultiplier ?? 0) : Math.max(0, Number(event.tickMultiplier ?? 0)),
            tickIntervalSeconds: effect ? Number(effect.tickIntervalSeconds ?? 1) : Math.max(0.0001, Number(event.tickIntervalSeconds ?? 1)),
            tickCount: disorder?.tickCount ?? Math.max(0, Number(event.tickCount ?? 0)),
            durationSeconds: duration,
            elapsedSeconds: elapsed,
            remainingSeconds: disorder?.remaining ?? Math.max(0, duration - elapsed),
            count: normalizeDamageCount(event.count, 1),
        }
    }

    const effect = disorderEffectData(catalog, event.anomalyEffect ?? event.previousAnomalyEffect ?? "burn")
    const disorder = disorderBaseMultiplier(effect, event.elapsedSeconds)
    return {
        id: String(event.id ?? `disorder-${index + 1}`),
        kind: "anomaly",
        settlementType: "disorder",
        disorderType,
        normalized: true,
        previousAnomalyEffect: effect.id,
        anomalyEffect: effect.id,
        anomalyLabel: effect.label,
        damageElement: effect.element,
        baseMultiplier: disorder.baseMultiplier,
        fixedMultiplier: Number(effect.fixedMultiplier ?? 4.5),
        tickMultiplier: Number(effect.tickMultiplier ?? 0),
        tickIntervalSeconds: Number(effect.tickIntervalSeconds ?? 1),
        tickCount: disorder.tickCount,
        durationSeconds: disorder.duration,
        elapsedSeconds: disorder.elapsed,
        remainingSeconds: disorder.remaining,
        count: normalizeDamageCount(event.count, 1),
    }
}

function normalizeDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    if (event.kind === "skillGroup") {
        throw new Error(`技能组引用无法展开：事件 ${event.id ?? index + 1} 仍是技能组引用。`)
    }
    const kind = event.kind === undefined || event.kind === null || event.kind === ""
        ? "direct"
        : event.kind
    if (!DAMAGE_EVENT_KINDS.includes(kind)) {
        throw new Error(`不支持的伤害事件类型：${kind}`)
    }
    if (kind === "anomaly" && event.settlementType === "disorder") {
        return normalizeDisorderDamageEvent(event, catalog, index)
    }
    if (kind === "anomaly") {
        return normalizeAnomalyDamageEvent(event, catalog, index)
    }
    if (kind === "disorder") {
        return normalizeDisorderDamageEvent(event, catalog, index)
    }
    if (kind === "sheer") {
        return normalizeSheerDamageEvent(event, agent, catalog, index, options)
    }
    return normalizeDirectDamageEvent(event, agent, catalog, index, options)
}

function legacyDirectDamageEvent(input = {}) {
    return {
        id: "direct-1",
        kind: "direct",
        skillMultiplier: input.skillMultiplier,
        skillRef: input.skillRef,
        critMode: input.critMode,
        count: input.count,
        damageElement: input.damageElement,
    }
}

function normalizeDamageRequest(input = {}, agent = {}, catalog = {}, options = {}) {
    const expandedInput = expandCalculationConfigSkillGroups(input, agent, { strict: true })
    const hasConfiguredEvents = Array.isArray(input.events) && input.events.length > 0
    if (hasConfiguredEvents && (!Array.isArray(expandedInput.events) || !expandedInput.events.length)) {
        throw new Error("技能组引用无法展开：没有可用于计算的普通事件。")
    }
    const rawEvents = Array.isArray(expandedInput.events) && expandedInput.events.length
        ? expandedInput.events
        : [legacyDirectDamageEvent(expandedInput)]
    const events = rawEvents.map((event, index) => normalizeDamageEvent(event, agent, catalog, index, options))
    const firstElement = events[0]?.damageElement ?? resolveDamageElement(agent)
    return {
        agentLevel: normalizeAgentLevel(expandedInput.agentLevel),
        target: normalizeDamageTarget(expandedInput, firstElement),
        selectedEventId: expandedInput.selectedEventId ?? events[0]?.id ?? null,
        events,
    }
}

function normalizeDamageInput(input = {}, agent = {}, catalog = {}, options = {}) {
    const request = normalizeDamageRequest(input, agent, catalog, options)
    return {
        ...request.events[0],
        target: request.target,
        agentLevel: request.agentLevel,
    }
}

function formatDamageNumber(value, digits = 3) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }

    if (Number.isInteger(number)) {
        return String(number)
    }

    return String(Number(number.toFixed(digits)))
}

function formatDamagePercent(value, digits = 1) {
    return `${formatDamageNumber(Number(value ?? 0) * 100, digits)}%`
}

function damageCritRate(panel) {
    return Math.max(0, Math.min(1, Number(panel.critRate ?? 0)))
}

function critMultiplierForMode(panel, mode) {
    const critRate = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)

    if (mode === "crit") {
        return 1 + critDmg
    }

    if (mode === "nonCrit") {
        return 1
    }

    return critRate * (1 + critDmg) + (1 - critRate)
}

function isDisorderDamageEvent(event = {}) {
    return event.kind === "disorder" || event.settlementType === "disorder"
}

function eventDamageKindKeys(event = {}) {
    if (event.kind === "direct") {
        return ["direct"]
    }
    if (event.kind === "sheer") {
        return ["sheer"]
    }
    return isDisorderDamageEvent(event) ? ["disorder"] : ["anomaly"]
}

function selectedDmgBonusForElement(panel, damageElement) {
    const elementKey = `${damageElement}Dmg`
    return Number(panel.dmgBonus ?? 0) + Number(panel[elementKey] ?? 0)
}

function sheerForceFromPanel(panel = {}) {
    return Math.max(
        0,
        Number(panel.hp ?? 0) * SHEER_FORCE_HP_RATIO
            + Number(panel.atk ?? 0) * SHEER_FORCE_ATK_RATIO
            + Number(panel.sheerForceFlat ?? 0),
    )
}

function isRuptureAgent(agent = {}) {
    return agent?.specialty === "rupture"
}

function effectiveSheerForceFromPanel(agent = {}, panel = {}) {
    if (!isRuptureAgent(agent)) {
        return 0
    }
    return Number.isFinite(Number(panel.sheerForce))
        ? Number(panel.sheerForce)
        : sheerForceFromPanel(panel)
}

function applyPanelSheerForce(agent = {}, panel = {}, bonusTotals = {}) {
    if (!isRuptureAgent(agent)) {
        panel.sheerForceFlat = 0
        panel.sheerForce = 0
        return
    }
    panel.sheerForceFlat = Number(bonusTotals.sheerForceFlat ?? 0)
    panel.sheerForce = sheerForceFromPanel(panel)
}

function damageElementLabel(damageElement) {
    return DAMAGE_ELEMENT_LABELS[damageElement] ?? damageElement
}

function targetConfiguredStunMultiplier(target = {}) {
    const explicitMultiplier = Number(target.stunMultiplier)
    if (Number.isFinite(explicitMultiplier)) {
        return Math.max(0, explicitMultiplier)
    }
    const percent = Number(target.stunMultiplierPercent)
    if (Number.isFinite(percent)) {
        return Math.max(0, percent) / 100
    }
    const explicitActiveMultiplier = Number(target.activeStunMultiplier)
    if (Number.isFinite(explicitActiveMultiplier) && explicitActiveMultiplier !== 1) {
        return Math.max(0, explicitActiveMultiplier)
    }
    return DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT / 100
}

function targetIsStunned(target = {}) {
    if (Object.prototype.hasOwnProperty.call(target, "stunned")) {
        return normalizeStunned(target.stunned)
    }
    const explicitActiveMultiplier = Number(target.activeStunMultiplier)
    return Number.isFinite(explicitActiveMultiplier) ? explicitActiveMultiplier !== 1 : false
}

function targetActiveStunMultiplier(target = {}, eventTotals = {}) {
    const explicitActiveMultiplier = Number(target.activeStunMultiplier)
    const stunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonus ?? 0)
    const alwaysStunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonusAlways ?? 0)
    if (Number.isFinite(explicitActiveMultiplier)) {
        return Math.max(0, explicitActiveMultiplier + alwaysStunDmgMultiplierBonus + (explicitActiveMultiplier !== 1 ? stunDmgMultiplierBonus : 0))
    }
    return targetIsStunned(target)
        ? Math.max(0, targetConfiguredStunMultiplier(target) + stunDmgMultiplierBonus + alwaysStunDmgMultiplierBonus)
        : Math.max(0, 1 + alwaysStunDmgMultiplierBonus)
}

function targetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals = {}) {
    const targetDefense = target.defense
    const levelCoefficient = target.levelCoefficient
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0) + Number(eventTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    const targetResistance = Number(target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[enemyResReductionKey] ?? 0)
        + Number(eventTotals.enemyResReduction ?? 0)
        + Number(eventTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = Number(panel[resIgnoreKey] ?? 0) + Number(eventTotals[resIgnoreKey] ?? 0)
    const effectiveResistance = targetResistance - enemyResReduction - resIgnore
    const rawResistanceMultiplier = 1 - effectiveResistance
    const resistanceMultiplier = clampNumber(rawResistanceMultiplier, 0.01, 2)
    const stunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonus ?? 0)
    const stunDmgMultiplierBonusAlways = Number(eventTotals.stunDmgMultiplierBonusAlways ?? 0)
    const stunMultiplier = targetConfiguredStunMultiplier(target)
    const activeStunMultiplier = targetActiveStunMultiplier(target, eventTotals)

    return {
        presetId: target.presetId,
        damageElement,
        targetDefense,
        levelCoefficient,
        enemyDefReduction,
        enemyDefFlatReduction,
        targetDefenseAfterReduction,
        penRatio,
        penFlat,
        effectiveDefense,
        defenseMultiplier,
        targetResistance,
        enemyResReduction,
        enemyResReductionKey,
        resIgnore,
        resIgnoreKey,
        effectiveResistance,
        rawResistanceMultiplier,
        resistanceMultiplier,
        stunned: targetIsStunned(target),
        stunMultiplier,
        stunDmgMultiplierBonus,
        stunDmgMultiplierBonusAlways,
        activeStunMultiplier,
    }
}

function sheerTargetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals = {}) {
    const breakdown = targetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals)
    return {
        ...breakdown,
        enemyDefReduction: 0,
        enemyDefFlatReduction: 0,
        targetDefenseAfterReduction: breakdown.targetDefense,
        penRatio: 0,
        penFlat: 0,
        effectiveDefense: 0,
        defenseMultiplier: 1,
    }
}

function damageModifierAppliesTo(modifier, event) {
    const appliesTo = modifier.appliesTo ?? {}
    const hasSkillTargets = Array.isArray(appliesTo.skillTargets) && appliesTo.skillTargets.length
    if (modifier.target?.kind === "skill" && !hasSkillTargets) {
        return false
    }
    if (["directDamageBonus", "skillMultiplierBonus"].includes(modifier.kind) && !hasSkillTargets) {
        return false
    }
    if (Array.isArray(appliesTo.damageKinds) && appliesTo.damageKinds.length) {
        const eventKinds = eventDamageKindKeys(event)
        if (!eventKinds.some(kind => appliesTo.damageKinds.includes(kind))) {
            return false
        }
    }
    if (Array.isArray(appliesTo.anomalyEffects) && appliesTo.anomalyEffects.length) {
        const effectIds = [event.anomalyEffect, event.previousAnomalyEffect].filter(Boolean)
        if (!effectIds.some(effectId => appliesTo.anomalyEffects.includes(effectId))) {
            return false
        }
    }
    if (Array.isArray(appliesTo.elements) && appliesTo.elements.length && !appliesTo.elements.includes(event.damageElement)) {
        return false
    }
    if (Array.isArray(appliesTo.skillTargets) && appliesTo.skillTargets.length && !skillTargetsApplyTo(appliesTo.skillTargets, event)) {
        return false
    }
    return true
}

function skillTargetsApplyTo(skillTargets, event) {
    const source = event.skillSource
    if (!source) {
        return false
    }

    return skillTargets.some(target => skillTargetAppliesTo(target, source))
}

function skillTargetAppliesTo(target = {}, source = {}) {
    if (!target || typeof target !== "object") {
        return false
    }

    const hasMoveIdPrefixes = Array.isArray(target.moveIdPrefixes)
        && target.moveIdPrefixes.some(prefix => String(prefix ?? "").trim())
    if (!target.agentSkillId && !target.categoryId && !target.moveId && !target.rowId && !hasMoveIdPrefixes) {
        return false
    }
    if (target.agentSkillId && target.agentSkillId !== source.agentSkillId) {
        return false
    }
    if (target.categoryId && target.categoryId !== source.categoryId) {
        return false
    }
    if (target.moveId && target.moveId !== source.moveId) {
        return false
    }
    if (hasMoveIdPrefixes && !target.moveIdPrefixes.some(prefix => source.moveId?.startsWith(String(prefix ?? "").trim()))) {
        return false
    }
    if (target.rowId) {
        const sourceRowIds = [
            source.rowId,
            ...(Array.isArray(source.generatedFromRowIds) ? source.generatedFromRowIds : []),
        ].filter(Boolean)
        if (!sourceRowIds.includes(target.rowId)) {
            return false
        }
    }
    return true
}

function sumDamageModifiers(bonusTotals, event, kind) {
    return (bonusTotals.damageModifiers ?? [])
        .filter(modifier => modifier.kind === kind && damageModifierAppliesTo(modifier, event))
        .reduce((total, modifier) => total + Number(modifier.value ?? 0), 0)
}

function eventTargetTotalsForElement(bonusTotals, event) {
    const damageElement = event.damageElement
    const elementDmgKey = `${damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[damageElement]
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const isDisorder = isDisorderDamageEvent(event)
    const attributeAnomalyDamageBonus = isDisorder
        ? 0
        : sumDamageModifiers(bonusTotals, event, "anomalyDamageBonus")
    const disorderDamageBonus = isDisorder
        ? sumDamageModifiers(bonusTotals, event, "disorderDamageBonus")
        : 0
    return {
        dmgBonus: sumDamageModifiers(bonusTotals, event, "dmgBonus"),
        [elementDmgKey]: sumDamageModifiers(bonusTotals, event, elementDmgKey),
        enemyDefReduction: sumDamageModifiers(bonusTotals, event, "enemyDefReduction"),
        enemyResReduction: sumDamageModifiers(bonusTotals, event, "enemyResReduction"),
        [resReductionKey]: sumDamageModifiers(bonusTotals, event, resReductionKey),
        [resIgnoreKey]: sumDamageModifiers(bonusTotals, event, resIgnoreKey),
        stunDmgMultiplierBonus: sumDamageModifiers(bonusTotals, event, "stunDmgMultiplierBonus"),
        stunDmgMultiplierBonusAlways: sumDamageModifiers(bonusTotals, event, "stunDmgMultiplierBonusAlways"),
        sheerDmgBonus: sumDamageModifiers(bonusTotals, event, "sheerDmgBonus"),
        ...(elementSheerDmgKey ? { [elementSheerDmgKey]: sumDamageModifiers(bonusTotals, event, elementSheerDmgKey) } : {}),
        anomalyDamageBonus: isDisorder ? disorderDamageBonus : attributeAnomalyDamageBonus,
        attributeAnomalyDamageBonus,
        disorderDamageBonus,
        skillMultiplierBonus: sumDamageModifiers(bonusTotals, event, "skillMultiplierBonus"),
    }
}

function anomalyCritMultiplier(bonusTotals, event) {
    if (isDisorderDamageEvent(event)) {
        return {
            critRate: 0,
            critDmg: 0,
            multiplier: 1,
        }
    }

    const critRate = clampNumber(sumDamageModifiers(bonusTotals, event, "anomalyCritRate"), 0, 1)
    const critDmg = Math.max(0, sumDamageModifiers(bonusTotals, event, "anomalyCritDmg"))
    return {
        critRate,
        critDmg,
        multiplier: critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1,
    }
}

function defenseWhiteBoxRow(targetBreakdown) {
    const formulaLines = [
        `减防后防御（减防/无视防御）= ${formatDamageNumber(targetBreakdown.targetDefense)} × (1 - ${formatDamagePercent(targetBreakdown.enemyDefReduction)}) - ${formatDamageNumber(targetBreakdown.enemyDefFlatReduction)}`,
        `有效防御（穿透率）= ${formatDamageNumber(targetBreakdown.targetDefenseAfterReduction)} × (1 - ${formatDamagePercent(targetBreakdown.penRatio)}) - ${formatDamageNumber(targetBreakdown.penFlat)}`,
        `防御乘区 = ${formatDamageNumber(targetBreakdown.levelCoefficient)} / (${formatDamageNumber(targetBreakdown.levelCoefficient)} + ${formatDamageNumber(targetBreakdown.effectiveDefense)})`,
    ]
    return {
        label: "防御乘区",
        formula: formulaLines.join("\n"),
        formulaLines,
        value: targetBreakdown.defenseMultiplier,
        displayValue: formatDamageNumber(targetBreakdown.defenseMultiplier, 4),
    }
}

function stunWhiteBoxRow(targetBreakdown) {
    const bonus = Number(targetBreakdown.stunDmgMultiplierBonus ?? 0)
    const alwaysBonus = Number(targetBreakdown.stunDmgMultiplierBonusAlways ?? 0)
    const bonusText = [
        bonus ? `失衡易伤倍率加算 ${formatDamagePercent(bonus)}` : "",
        alwaysBonus ? `失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : "",
    ].filter(Boolean).join(" + ")
    return {
        label: "失衡乘区",
        formula: targetBreakdown.stunned
            ? `Boss 已失衡，使用失衡倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)}${bonusText ? ` + ${bonusText}` : ""}`
            : `Boss 未失衡，配置倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)} 不生效${alwaysBonus ? ` + 失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : ""}`,
        value: targetBreakdown.activeStunMultiplier,
        displayValue: formatDamageNumber(targetBreakdown.activeStunMultiplier, 4),
    }
}

function directDamageWhiteBoxRows({ event, atk, critMultiplier, critRateForDamage, critDmg, selectedDmgBonus, directDamageBonus, dmgMultiplier, targetBreakdown, skillMultiplierBonus, effectiveSkillMultiplier, finalDamage, singleDamage }) {
    const critModeLabel = {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[event.critMode]
    const damageElementText = damageElementLabel(event.damageElement)
    const rows = [
        {
            label: "局内攻击力",
            formula: "来自局内面板攻击力",
            value: atk,
            displayValue: formatDamageNumber(atk),
        },
        {
            label: "技能倍率",
            formula: event.skillSource
                ? `${event.skillSource.label} ${event.skillSource.levelLabel ?? `LV${event.skillSource.level}`}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`
                : `${event.label ?? "本次直伤倍率"}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`,
            value: effectiveSkillMultiplier,
            displayValue: formatDamagePercent(effectiveSkillMultiplier),
        },
        {
            label: "暴击乘区",
            formula: event.critMode === "expected"
                ? `${formatDamagePercent(critRateForDamage)} × (1 + ${formatDamagePercent(critDmg)}) + (1 - ${formatDamagePercent(critRateForDamage)})`
                : critModeLabel,
            value: critMultiplier,
            displayValue: formatDamageNumber(critMultiplier, 4),
        },
        {
            label: "增伤乘区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${directDamageBonus ? ` + 技能专属增伤 ${formatDamagePercent(directDamageBonus)}` : ""}`,
            value: dmgMultiplier,
            displayValue: formatDamageNumber(dmgMultiplier, 4),
        },
        defenseWhiteBoxRow(targetBreakdown),
        {
            label: "抗性乘区",
            formula: `clamp(1 - (${damageElementText}抗性 ${formatDamagePercent(targetBreakdown.targetResistance)} - 减抗 ${formatDamagePercent(targetBreakdown.enemyResReduction)} - 抗性无视 ${formatDamagePercent(targetBreakdown.resIgnore)}), 0.01, 2)`,
            value: targetBreakdown.resistanceMultiplier,
            displayValue: formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
        },
        stunWhiteBoxRow(targetBreakdown),
    ]
    if (event.count !== 1) {
        rows.push({
            label: "事件次数",
            formula: "单次伤害 × 次数",
            value: event.count,
            displayValue: formatDamageNumber(event.count),
        })
    }
    rows.push({
        label: "最终伤害",
        formula: event.count === 1
            ? `${formatDamageNumber(atk)} × ${formatDamagePercent(effectiveSkillMultiplier)} × ${formatDamageNumber(critMultiplier, 4)} × ${formatDamageNumber(dmgMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.defenseMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.resistanceMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.activeStunMultiplier, 4)}`
            : `${formatDamageNumber(singleDamage)} × ${formatDamageNumber(event.count)}`,
        value: finalDamage,
        displayValue: formatDamageNumber(finalDamage),
    })
    return rows
}

function sheerDefenseWhiteBoxRow() {
    return {
        label: "防御乘区",
        formula: "贯穿伤害不计算防御、减防、防御无视、穿透率或穿透值",
        value: 1,
        displayValue: "1",
    }
}

function sheerDamageWhiteBoxRows({ event, hp, atk, sheerForceFlat, sheerForce, critMultiplier, critRateForDamage, critDmg, selectedDmgBonus, skillDamageBonus, dmgMultiplier, targetBreakdown, skillMultiplierBonus, effectiveSkillMultiplier, sheerDmgBonus, sheerDmgMultiplier, finalDamage, singleDamage }) {
    const critModeLabel = {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[event.critMode]
    const damageElementText = damageElementLabel(event.damageElement)
    const rows = [
        {
            label: "局内贯穿力",
            formula: "来自局内生命值、局内攻击力和固定贯穿力",
            value: sheerForce,
            displayValue: formatDamageNumber(sheerForce),
        },
        {
            label: "贯穿力换算",
            formula: `${formatDamageNumber(hp)} × ${formatDamagePercent(SHEER_FORCE_HP_RATIO)} + ${formatDamageNumber(atk)} × ${formatDamagePercent(SHEER_FORCE_ATK_RATIO)} + ${formatDamageNumber(sheerForceFlat)}`,
            value: sheerForce,
            displayValue: formatDamageNumber(sheerForce),
        },
        {
            label: "贯穿倍率",
            formula: event.skillSource
                ? `${event.skillSource.label} ${event.skillSource.levelLabel ?? `LV${event.skillSource.level}`}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`
                : `${event.label ?? "本次贯穿倍率"}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`,
            value: effectiveSkillMultiplier,
            displayValue: formatDamagePercent(effectiveSkillMultiplier),
        },
        {
            label: "暴击乘区",
            formula: event.critMode === "expected"
                ? `${formatDamagePercent(critRateForDamage)} × (1 + ${formatDamagePercent(critDmg)}) + (1 - ${formatDamagePercent(critRateForDamage)})`
                : critModeLabel,
            value: critMultiplier,
            displayValue: formatDamageNumber(critMultiplier, 4),
        },
        {
            label: "普通增伤区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${skillDamageBonus ? ` + 技能专属增伤 ${formatDamagePercent(skillDamageBonus)}` : ""}`,
            value: dmgMultiplier,
            displayValue: formatDamageNumber(dmgMultiplier, 4),
        },
        {
            label: "贯穿增伤区",
            formula: `1 + 贯穿增伤 ${formatDamagePercent(sheerDmgBonus)}`,
            value: sheerDmgMultiplier,
            displayValue: formatDamageNumber(sheerDmgMultiplier, 4),
        },
        sheerDefenseWhiteBoxRow(),
        {
            label: "抗性乘区",
            formula: `clamp(1 - (${damageElementText}抗性 ${formatDamagePercent(targetBreakdown.targetResistance)} - 减抗 ${formatDamagePercent(targetBreakdown.enemyResReduction)} - 抗性无视 ${formatDamagePercent(targetBreakdown.resIgnore)}), 0.01, 2)`,
            value: targetBreakdown.resistanceMultiplier,
            displayValue: formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
        },
        stunWhiteBoxRow(targetBreakdown),
    ]
    if (event.count !== 1) {
        rows.push({
            label: "事件次数",
            formula: "单次伤害 × 次数",
            value: event.count,
            displayValue: formatDamageNumber(event.count),
        })
    }
    rows.push({
        label: "最终伤害",
        formula: event.count === 1
            ? `${formatDamageNumber(sheerForce)} × ${formatDamagePercent(effectiveSkillMultiplier)} × ${formatDamageNumber(critMultiplier, 4)} × ${formatDamageNumber(dmgMultiplier, 4)} × ${formatDamageNumber(sheerDmgMultiplier, 4)} × 1 × ${formatDamageNumber(targetBreakdown.resistanceMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.activeStunMultiplier, 4)}`
            : `${formatDamageNumber(singleDamage)} × ${formatDamageNumber(event.count)}`,
        value: finalDamage,
        displayValue: formatDamageNumber(finalDamage),
    })
    return rows
}

function anomalyDamageWhiteBoxRows({ event, atk, selectedDmgBonus, skillDamageBonus, dmgMultiplier, targetBreakdown, anomalyProficiencyMultiplier, levelMultiplier, anomalyDamageBonus, anomalyCrit, baseMultiplierBonus, effectiveBaseMultiplier, finalDamage, singleDamage }) {
    const damageElementText = damageElementLabel(event.damageElement)
    const effectLabel = localizedName(event.anomalyLabel, event.anomalyEffect ?? event.previousAnomalyEffect)
    const isDisorder = isDisorderDamageEvent(event)
    const specialBonusLabel = isDisorder ? "紊乱增伤区" : "属性异常增伤区"
    const specialBonusFormulaLabel = isDisorder ? "紊乱增伤" : "属性异常增伤"
    const multiplierScale = disorderMultiplierScale(event.disorderType)
    const rows = [
        {
            label: "局内攻击力",
            formula: "来自局内面板攻击力",
            value: atk,
            displayValue: formatDamageNumber(atk),
        },
        {
            label: isDisorder ? "紊乱倍率" : "异常倍率",
            formula: isDisorder
                ? multiplierScale === 1
                    ? `${effectLabel}：${formatDamagePercent(event.fixedMultiplier)} + ${event.tickCount} × ${formatDamagePercent(event.tickMultiplier)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`
                    : `${effectLabel}：(${formatDamagePercent(event.fixedMultiplier)} + ${event.tickCount} × ${formatDamagePercent(event.tickMultiplier)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}) × 极性紊乱 ${formatDamagePercent(multiplierScale)}`
                : `${effectLabel}：${formatDamagePercent(event.baseMultiplierPerProc)} × ${formatDamageNumber(event.procCount)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`,
            value: effectiveBaseMultiplier,
            displayValue: formatDamagePercent(effectiveBaseMultiplier),
        },
        {
            label: "增伤乘区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${skillDamageBonus ? ` + 技能专属增伤 ${formatDamagePercent(skillDamageBonus)}` : ""}`,
            value: dmgMultiplier,
            displayValue: formatDamageNumber(dmgMultiplier, 4),
        },
        defenseWhiteBoxRow(targetBreakdown),
        {
            label: "抗性乘区",
            formula: `clamp(1 - (${damageElementText}抗性 ${formatDamagePercent(targetBreakdown.targetResistance)} - 减抗 ${formatDamagePercent(targetBreakdown.enemyResReduction)} - 抗性无视 ${formatDamagePercent(targetBreakdown.resIgnore)}), 0.01, 2)`,
            value: targetBreakdown.resistanceMultiplier,
            displayValue: formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
        },
        stunWhiteBoxRow(targetBreakdown),
        {
            label: "异常精通区",
            formula: "异常精通 / 100",
            value: anomalyProficiencyMultiplier,
            displayValue: formatDamageNumber(anomalyProficiencyMultiplier, 4),
        },
        {
            label: "等级区",
            formula: "trunc(1 + (角色等级 - 1) / 59, 4)",
            value: levelMultiplier,
            displayValue: formatDamageNumber(levelMultiplier, 4),
        },
        {
            label: specialBonusLabel,
            formula: `1 + ${specialBonusFormulaLabel} ${formatDamagePercent(anomalyDamageBonus - 1)}`,
            value: anomalyDamageBonus,
            displayValue: formatDamageNumber(anomalyDamageBonus, 4),
        },
    ]
    if (!isDisorder) {
        rows.push({
            label: "异常暴击区",
            formula: anomalyCrit.multiplier === 1
                ? "未启用异常暴击"
                : `1 + ${formatDamagePercent(anomalyCrit.critRate)} × ${formatDamagePercent(anomalyCrit.critDmg)}`,
            value: anomalyCrit.multiplier,
            displayValue: formatDamageNumber(anomalyCrit.multiplier, 4),
        })
    }
    if (event.count !== 1) {
        rows.push({
            label: "事件次数",
            formula: "单次伤害 × 次数",
            value: event.count,
            displayValue: formatDamageNumber(event.count),
        })
    }
    rows.push({
        label: "最终伤害",
        formula: event.count === 1
            ? [
                formatDamageNumber(atk),
                formatDamagePercent(effectiveBaseMultiplier),
                formatDamageNumber(dmgMultiplier, 4),
                formatDamageNumber(targetBreakdown.defenseMultiplier, 4),
                formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
                formatDamageNumber(targetBreakdown.activeStunMultiplier, 4),
                formatDamageNumber(anomalyProficiencyMultiplier, 4),
                formatDamageNumber(levelMultiplier, 4),
                formatDamageNumber(anomalyDamageBonus, 4),
                ...(!isDisorder ? [formatDamageNumber(anomalyCrit.multiplier, 4)] : []),
            ].join(" × ")
            : `${formatDamageNumber(singleDamage)} × ${formatDamageNumber(event.count)}`,
        value: finalDamage,
        displayValue: formatDamageNumber(finalDamage),
    })
    return rows
}

function calculateDirectDamageEvent({ event, panel, bonusTotals, target, includeWhiteBox }) {
    const atk = Number(panel.atk ?? 0)
    const rawCritRate = Number(panel.critRate ?? 0)
    const critRateForDamage = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const directDamageBonus = sumDamageModifiers(bonusTotals, event, "directDamageBonus")
        + Number(eventTotals.dmgBonus ?? 0)
        + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + directDamageBonus
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    const targetBreakdown = targetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
    const baseSingleDamage = atk
        * effectiveSkillMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
    const damageVariant = mode => {
        const critMultiplier = critMultiplierForMode(panel, mode)
        const singleDamage = baseSingleDamage * critMultiplier
        return {
            critMode: mode,
            critMultiplier,
            singleDamage,
            finalDamage: singleDamage * event.count,
        }
    }
    const damageVariants = {
        expected: damageVariant("expected"),
        crit: damageVariant("crit"),
        nonCrit: damageVariant("nonCrit"),
    }
    const selectedVariant = damageVariants[event.critMode] ?? damageVariants.expected
    const critMultiplier = selectedVariant.critMultiplier
    const singleDamage = selectedVariant.singleDamage
    const finalDamage = singleDamage * event.count

    return {
        id: event.id,
        kind: event.kind,
        settlementType: event.settlementType ?? null,
        label: event.skillSource?.label ?? event.label ?? "直伤",
        finalDamage,
        singleDamage,
        damageVariants,
        count: event.count,
        input: {
            ...event,
            target,
        },
        panelSnapshot: {
            atk,
            critRate: rawCritRate,
            effectiveCritRate: critRateForDamage,
            critDmg,
            dmgBonus: Number(panel.dmgBonus ?? 0),
            [elementDmgKey]: Number(panel[elementDmgKey] ?? 0),
            penRatio: Number(panel.penRatio ?? 0),
            penFlat: Number(panel.penFlat ?? 0),
        },
        multipliers: {
            atk,
            skill: effectiveSkillMultiplier,
            baseSkill: event.skillMultiplier,
            skillMultiplierBonus,
            crit: critMultiplier,
            critRate: critRateForDamage,
            rawCritRate,
            critDmg,
            dmg: dmgMultiplier,
            directDamageBonus,
            defense: targetBreakdown.defenseMultiplier,
            resistance: targetBreakdown.resistanceMultiplier,
            stun: targetBreakdown.activeStunMultiplier,
        },
        targetBreakdown,
        whiteBoxRows: includeWhiteBox
            ? directDamageWhiteBoxRows({
                event,
                atk,
                critMultiplier,
                critRateForDamage,
                critDmg,
                selectedDmgBonus,
                directDamageBonus,
                dmgMultiplier,
                targetBreakdown,
                skillMultiplierBonus,
                effectiveSkillMultiplier,
                finalDamage,
                singleDamage,
            })
            : [],
    }
}

function calculateSheerDamageEvent({ event, agent, panel, bonusTotals, target, includeWhiteBox }) {
    const hp = Number(panel.hp ?? 0)
    const atk = Number(panel.atk ?? 0)
    const sheerForceFlat = isRuptureAgent(agent) ? Number(panel.sheerForceFlat ?? 0) : 0
    const sheerForce = effectiveSheerForceFromPanel(agent, panel)
    const rawCritRate = Number(panel.critRate ?? 0)
    const critRateForDamage = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[event.damageElement]
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + skillDamageBonus
    const sheerDmgBonus = Number(eventTotals.sheerDmgBonus ?? 0) + Number(eventTotals[elementSheerDmgKey] ?? 0)
    const sheerDmgMultiplier = 1 + sheerDmgBonus
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    const targetBreakdown = sheerTargetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
    const baseSingleDamage = sheerForce
        * effectiveSkillMultiplier
        * dmgMultiplier
        * sheerDmgMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
    const damageVariant = mode => {
        const critMultiplier = critMultiplierForMode(panel, mode)
        const singleDamage = baseSingleDamage * critMultiplier
        return {
            critMode: mode,
            critMultiplier,
            singleDamage,
            finalDamage: singleDamage * event.count,
        }
    }
    const damageVariants = {
        expected: damageVariant("expected"),
        crit: damageVariant("crit"),
        nonCrit: damageVariant("nonCrit"),
    }
    const selectedVariant = damageVariants[event.critMode] ?? damageVariants.expected
    const critMultiplier = selectedVariant.critMultiplier
    const singleDamage = selectedVariant.singleDamage
    const finalDamage = singleDamage * event.count

    return {
        id: event.id,
        kind: event.kind,
        settlementType: event.settlementType ?? null,
        label: event.skillSource?.label ?? event.label ?? "贯穿伤害",
        finalDamage,
        singleDamage,
        damageVariants,
        count: event.count,
        input: {
            ...event,
            target,
        },
        panelSnapshot: {
            hp,
            atk,
            sheerForceFlat,
            sheerForce,
            critRate: rawCritRate,
            effectiveCritRate: critRateForDamage,
            critDmg,
            dmgBonus: Number(panel.dmgBonus ?? 0),
            [elementDmgKey]: Number(panel[elementDmgKey] ?? 0),
        },
        multipliers: {
            hp,
            atk,
            sheerForce,
            sheerForceFlat,
            skill: effectiveSkillMultiplier,
            baseSkill: event.skillMultiplier,
            skillMultiplierBonus,
            crit: critMultiplier,
            critRate: critRateForDamage,
            rawCritRate,
            critDmg,
            dmg: dmgMultiplier,
            skillDamageBonus,
            sheerDamage: sheerDmgMultiplier,
            sheerDmgBonus,
            defense: 1,
            resistance: targetBreakdown.resistanceMultiplier,
            stun: targetBreakdown.activeStunMultiplier,
        },
        targetBreakdown,
        whiteBoxRows: includeWhiteBox
            ? sheerDamageWhiteBoxRows({
                event,
                hp,
                atk,
                sheerForceFlat,
                sheerForce,
                critMultiplier,
                critRateForDamage,
                critDmg,
                selectedDmgBonus,
                skillDamageBonus,
                dmgMultiplier,
                targetBreakdown,
                skillMultiplierBonus,
                effectiveSkillMultiplier,
                sheerDmgBonus,
                sheerDmgMultiplier,
                finalDamage,
                singleDamage,
            })
            : [],
    }
}

function calculateAnomalyDamageEvent({ event, panel, bonusTotals, target, agentLevel, includeWhiteBox }) {
    const atk = Number(panel.atk ?? 0)
    const isDisorder = isDisorderDamageEvent(event)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + skillDamageBonus
    const targetBreakdown = targetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
    const anomalyProficiencyMultiplier = Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100
    const levelMultiplier = anomalyLevelMultiplier(agentLevel)
    const attributeAnomalyDamageBonus = isDisorder ? 1 : 1 + Number(eventTotals.attributeAnomalyDamageBonus ?? 0)
    const disorderDamageBonus = isDisorder ? 1 + Number(eventTotals.disorderDamageBonus ?? 0) : 1
    const anomalyDamageBonus = isDisorder ? disorderDamageBonus : attributeAnomalyDamageBonus
    const baseMultiplierBonus = isDisorder
        ? sumDamageModifiers(bonusTotals, event, "disorderBaseMultiplierBonus")
        : sumDamageModifiers(bonusTotals, event, "baseMultiplierBonus")
    const baseMultiplierScale = isDisorder ? disorderMultiplierScale(event.disorderType) : 1
    const effectiveBaseMultiplier = Math.max(0, Number(event.baseMultiplier ?? 0) + baseMultiplierBonus) * baseMultiplierScale
    const anomalyCrit = anomalyCritMultiplier(bonusTotals, event)
    const singleDamage = atk
        * effectiveBaseMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * anomalyProficiencyMultiplier
        * levelMultiplier
        * anomalyDamageBonus
        * anomalyCrit.multiplier
    const finalDamage = singleDamage * event.count

    return {
        id: event.id,
        kind: event.kind,
        settlementType: event.settlementType ?? (isDisorderDamageEvent(event) ? "disorder" : "attribute"),
        label: localizedName(event.anomalyLabel, event.anomalyEffect ?? event.previousAnomalyEffect),
        finalDamage,
        singleDamage,
        count: event.count,
        input: {
            ...event,
            target,
            agentLevel: normalizeAgentLevel(agentLevel),
        },
        panelSnapshot: {
            atk,
            anomalyProficiency: Number(panel.anomalyProficiency ?? 0),
            dmgBonus: Number(panel.dmgBonus ?? 0),
            [`${event.damageElement}Dmg`]: Number(panel[`${event.damageElement}Dmg`] ?? 0),
            penRatio: Number(panel.penRatio ?? 0),
            penFlat: Number(panel.penFlat ?? 0),
        },
        multipliers: {
            atk,
            anomaly: effectiveBaseMultiplier,
            baseMultiplier: Number(event.baseMultiplier ?? 0),
            baseMultiplierBonus,
            disorderBaseMultiplierBonus: isDisorder ? baseMultiplierBonus : 0,
            baseMultiplierScale,
            dmg: dmgMultiplier,
            defense: targetBreakdown.defenseMultiplier,
            resistance: targetBreakdown.resistanceMultiplier,
            stun: targetBreakdown.activeStunMultiplier,
            anomalyProficiency: anomalyProficiencyMultiplier,
            anomalyLevel: levelMultiplier,
            attributeAnomalyDamage: attributeAnomalyDamageBonus,
            disorderDamage: disorderDamageBonus,
            anomalyDamage: anomalyDamageBonus,
            anomalyCrit: anomalyCrit.multiplier,
            anomalyCritRate: anomalyCrit.critRate,
            anomalyCritDmg: anomalyCrit.critDmg,
        },
        targetBreakdown,
        whiteBoxRows: includeWhiteBox
            ? anomalyDamageWhiteBoxRows({
                event,
                atk,
                selectedDmgBonus,
                skillDamageBonus,
                dmgMultiplier,
                targetBreakdown,
                anomalyProficiencyMultiplier,
                levelMultiplier,
                anomalyDamageBonus,
                anomalyCrit,
                baseMultiplierBonus,
                effectiveBaseMultiplier,
                finalDamage,
                singleDamage,
            })
            : [],
    }
}

function calculateDamageResult({ catalog, agent, panel, bonusTotals, input, includeWhiteBox = true, skillOptions = {} }) {
    const damageRequest = normalizeDamageRequest(input, agent, catalog, skillOptions)
    const events = damageRequest.events.map(event => {
        if (event.kind === "direct") {
            return calculateDirectDamageEvent({
                event,
                panel,
                bonusTotals,
                target: damageRequest.target,
                includeWhiteBox,
            })
        }
        if (event.kind === "sheer") {
            return calculateSheerDamageEvent({
                event,
                agent,
                panel,
                bonusTotals,
                target: damageRequest.target,
                includeWhiteBox,
            })
        }
        return calculateAnomalyDamageEvent({
            event,
            panel,
            bonusTotals,
            target: damageRequest.target,
            agentLevel: damageRequest.agentLevel,
            includeWhiteBox,
        })
    })
    const selectedEvent = events.find(event => event.id === damageRequest.selectedEventId) ?? events[0] ?? null
    const totalFinalDamage = events.reduce((total, event) => total + Number(event.finalDamage ?? 0), 0)

    return {
        finalDamage: Number(selectedEvent?.finalDamage ?? 0),
        totalFinalDamage,
        selectedEventId: selectedEvent?.id ?? null,
        input: selectedEvent?.input ?? normalizeDamageInput(input, agent, catalog, skillOptions),
        multipliers: selectedEvent?.multipliers ?? {},
        targetBreakdown: selectedEvent?.targetBreakdown ?? {},
        whiteBoxRows: selectedEvent?.whiteBoxRows ?? [],
        events,
        request: {
            agentLevel: damageRequest.agentLevel,
            target: damageRequest.target,
            selectedEventId: damageRequest.selectedEventId,
        },
    }
}

function targetDamageMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals = {}) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0) + Number(eventTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * targetResistanceMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals)
        * targetActiveStunMultiplier(target, eventTotals)
}

function targetResistanceMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals = {}) {
    const targetResistance = Number(target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[enemyResReductionKey] ?? 0)
        + Number(eventTotals.enemyResReduction ?? 0)
        + Number(eventTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = Number(panel[resIgnoreKey] ?? 0) + Number(eventTotals[resIgnoreKey] ?? 0)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function calculateDirectDamageFinalValue(event, panel, bonusTotals, target) {
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const directDamageBonus = sumDamageModifiers(bonusTotals, event, "directDamageBonus")
        + Number(eventTotals.dmgBonus ?? 0)
        + Number(eventTotals[elementDmgKey] ?? 0)
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    return Number(panel.atk ?? 0)
        * effectiveSkillMultiplier
        * (1 + selectedDmgBonus + directDamageBonus)
        * targetDamageMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
        * critMultiplierForMode(panel, event.critMode)
        * Number(event.count ?? 1)
}

function calculateAnomalyDamageFinalValue(event, panel, bonusTotals, target, agentLevel) {
    const isDisorder = isDisorderDamageEvent(event)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const anomalyProficiencyMultiplier = Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100
    const baseMultiplierBonus = isDisorder
        ? sumDamageModifiers(bonusTotals, event, "disorderBaseMultiplierBonus")
        : sumDamageModifiers(bonusTotals, event, "baseMultiplierBonus")
    const baseMultiplierScale = isDisorder ? disorderMultiplierScale(event.disorderType) : 1
    const effectiveBaseMultiplier = Math.max(0, Number(event.baseMultiplier ?? 0) + baseMultiplierBonus) * baseMultiplierScale
    const anomalyDamageBonus = 1 + Number(eventTotals.anomalyDamageBonus ?? 0)
    const anomalyCritMultiplierValue = anomalyCritMultiplier(bonusTotals, event).multiplier
    return Number(panel.atk ?? 0)
        * effectiveBaseMultiplier
        * (1 + selectedDmgBonus + skillDamageBonus)
        * targetDamageMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
        * anomalyProficiencyMultiplier
        * anomalyLevelMultiplier(agentLevel)
        * anomalyDamageBonus
        * anomalyCritMultiplierValue
        * Number(event.count ?? 1)
}

function calculateSheerDamageFinalValue(event, panel, bonusTotals, target, agent = {}) {
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[event.damageElement]
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const sheerDmgBonus = Number(eventTotals.sheerDmgBonus ?? 0) + Number(eventTotals[elementSheerDmgKey] ?? 0)
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    return effectiveSheerForceFromPanel(agent, panel)
        * effectiveSkillMultiplier
        * critMultiplierForMode(panel, event.critMode)
        * (1 + selectedDmgBonus + skillDamageBonus)
        * targetResistanceMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
        * (1 + sheerDmgBonus)
        * targetActiveStunMultiplier(target, eventTotals)
        * Number(event.count ?? 1)
}

function calculateDamageTotalFinalValue({ agent, panel, bonusTotals, damageRequest }) {
    const target = damageRequest.target
    let total = 0
    for (const event of damageRequest.events ?? []) {
        if (event.kind === "direct") {
            total += calculateDirectDamageFinalValue(event, panel, bonusTotals, target)
        } else if (event.kind === "sheer") {
            total += calculateSheerDamageFinalValue(event, panel, bonusTotals, target, agent)
        } else {
            total += calculateAnomalyDamageFinalValue(event, panel, bonusTotals, target, damageRequest.agentLevel)
        }
    }
    return total
}

function compileDamageScoreEvent(event = {}) {
    const damageElement = event.damageElement
    return {
        event,
        kind: event.kind,
        isDisorder: isDisorderDamageEvent(event),
        damageElement,
        elementDmgKey: `${damageElement}Dmg`,
        elementSheerDmgKey: SHEER_DMG_KEY_BY_ELEMENT[damageElement],
        resIgnoreKey: RES_IGNORE_KEY_BY_ELEMENT[damageElement],
        resReductionKey: RES_REDUCTION_KEY_BY_ELEMENT[damageElement],
        skillMultiplier: Number(event.skillMultiplier ?? 0),
        baseMultiplier: Number(event.baseMultiplier ?? 0),
        count: Number(event.count ?? 1),
        critMode: event.critMode,
    }
}

function compileDamageScoreTarget(damageRequest = {}, agent = {}) {
    return {
        target: damageRequest.target,
        agentLevel: damageRequest.agentLevel,
        anomalyLevelMultiplier: anomalyLevelMultiplier(damageRequest.agentLevel),
        isRuptureAgent: isRuptureAgent(agent),
        events: (damageRequest.events ?? []).map(event => compileDamageScoreEvent(event)),
    }
}

function modifierSumsForCompiledEvent(modifiers = [], event = {}) {
    let sums = null
    for (const modifier of modifiers) {
        if (!modifier?.kind || !damageModifierAppliesTo(modifier, event)) {
            continue
        }
        sums ??= Object.create(null)
        sums[modifier.kind] = Number(sums[modifier.kind] ?? 0) + Number(modifier.value ?? 0)
    }
    return sums
}

function compiledModifierSum(sums, kind) {
    return Number(sums?.[kind] ?? 0)
}

function compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums) {
    const targetResistance = Number(target.resistanceByElement?.[compiledEvent.damageElement] ?? 0)
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[compiledEvent.resReductionKey] ?? 0)
        + compiledModifierSum(sums, "enemyResReduction")
        + compiledModifierSum(sums, compiledEvent.resReductionKey)
    const resIgnore = Number(panel[compiledEvent.resIgnoreKey] ?? 0)
        + compiledModifierSum(sums, compiledEvent.resIgnoreKey)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0)
        + compiledModifierSum(sums, "enemyDefReduction")
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums)
        * targetActiveStunMultiplier(target, {
            stunDmgMultiplierBonus: compiledModifierSum(sums, "stunDmgMultiplierBonus"),
            stunDmgMultiplierBonusAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusAlways"),
        })
}

function compiledCritMultiplier(panel, critMode) {
    const critRate = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)
    if (critMode === "crit") {
        return 1 + critDmg
    }
    if (critMode === "nonCrit") {
        return 1
    }
    return critRate * (1 + critDmg) + (1 - critRate)
}

function compiledAnomalyCritMultiplier(compiledEvent, sums) {
    if (compiledEvent.isDisorder) {
        return 1
    }
    const critRate = clampNumber(compiledModifierSum(sums, "anomalyCritRate"), 0, 1)
    const critDmg = Math.max(0, compiledModifierSum(sums, "anomalyCritDmg"))
    return critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1
}

function calculateCompiledDamageScoreValue({ agent, panel, bonusTotals, compiledDamageTarget }) {
    const modifiers = bonusTotals.damageModifiers ?? []
    const target = compiledDamageTarget.target
    let total = 0
    for (const compiledEvent of compiledDamageTarget.events ?? []) {
        const event = compiledEvent.event
        const sums = modifierSumsForCompiledEvent(modifiers, event)
        const selectedDmgBonus = selectedDmgBonusForElement(panel, compiledEvent.damageElement)
        const skillDamageBonus = compiledModifierSum(sums, "dmgBonus")
            + compiledModifierSum(sums, compiledEvent.elementDmgKey)

        if (compiledEvent.kind === "direct") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + compiledModifierSum(sums, "skillMultiplierBonus"),
            )
            const directDamageBonus = compiledModifierSum(sums, "directDamageBonus") + skillDamageBonus
            total += Number(panel.atk ?? 0)
                * effectiveSkillMultiplier
                * (1 + selectedDmgBonus + directDamageBonus)
                * compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums)
                * compiledCritMultiplier(panel, compiledEvent.critMode)
                * compiledEvent.count
            continue
        }

        if (compiledEvent.kind === "sheer") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + compiledModifierSum(sums, "skillMultiplierBonus"),
            )
            const sheerDmgBonus = compiledModifierSum(sums, "sheerDmgBonus")
                + compiledModifierSum(sums, compiledEvent.elementSheerDmgKey)
            total += (compiledDamageTarget.isRuptureAgent
                ? effectiveSheerForceFromPanel(agent, panel)
                : 0)
                * effectiveSkillMultiplier
                * compiledCritMultiplier(panel, compiledEvent.critMode)
                * (1 + selectedDmgBonus + skillDamageBonus)
                * compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums)
                * (1 + sheerDmgBonus)
                * targetActiveStunMultiplier(target, {
                    stunDmgMultiplierBonus: compiledModifierSum(sums, "stunDmgMultiplierBonus"),
                    stunDmgMultiplierBonusAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusAlways"),
                })
                * compiledEvent.count
            continue
        }

        const effectiveBaseMultiplier = Math.max(
            0,
            compiledEvent.baseMultiplier + compiledModifierSum(
                sums,
                compiledEvent.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
            ),
        )
        const anomalyDamageBonus = 1 + (
            compiledEvent.isDisorder
                ? compiledModifierSum(sums, "disorderDamageBonus")
                : compiledModifierSum(sums, "anomalyDamageBonus")
        )
        total += Number(panel.atk ?? 0)
            * effectiveBaseMultiplier
            * (1 + selectedDmgBonus + skillDamageBonus)
            * compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums)
            * (Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100)
            * compiledDamageTarget.anomalyLevelMultiplier
            * anomalyDamageBonus
            * compiledAnomalyCritMultiplier(compiledEvent, sums)
            * compiledEvent.count
    }
    return total
}

function denseModifierSum(sums, kind) {
    const index = DAMAGE_MODIFIER_SUM_KEY_INDEX.get(kind)
    return index === undefined ? 0 : Number(sums[index] ?? 0)
}

function fillDenseModifierSums(sums, eventModifierEntries = [], activeEntryFlags = []) {
    sums.fill(0)
    for (const modifier of eventModifierEntries ?? []) {
        if (activeEntryFlags[modifier.entryIndex]) {
            sums[modifier.kindIndex] += modifier.value
        }
    }
}

function denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, sums) {
    const targetResistance = Number(target.resistanceByElement?.[compiledEvent.damageElement] ?? 0)
    const enemyResReduction = denseCombatValue(combatValues, "enemyResReduction")
        + denseCombatValue(combatValues, compiledEvent.resReductionKey)
        + denseModifierSum(sums, "enemyResReduction")
        + denseModifierSum(sums, compiledEvent.resReductionKey)
    const resIgnore = densePanelValue(panelValues, compiledEvent.resIgnoreKey)
        + denseModifierSum(sums, compiledEvent.resIgnoreKey)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, sums) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = denseCombatValue(combatValues, "enemyDefReduction")
        + denseModifierSum(sums, "enemyDefReduction")
    const enemyDefFlatReduction = denseCombatValue(combatValues, "enemyDefFlatReduction")
    const penRatio = densePanelValue(panelValues, "penRatio")
    const penFlat = densePanelValue(panelValues, "penFlat")
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, sums)
        * targetActiveStunMultiplier(target, {
            stunDmgMultiplierBonus: denseModifierSum(sums, "stunDmgMultiplierBonus"),
            stunDmgMultiplierBonusAlways: denseModifierSum(sums, "stunDmgMultiplierBonusAlways"),
        })
}

function denseCritMultiplier(panelValues, critMode) {
    const critRate = clampNumber(densePanelValue(panelValues, "critRate"), 0, 1)
    const critDmg = densePanelValue(panelValues, "critDmg")
    if (critMode === "crit") {
        return 1 + critDmg
    }
    if (critMode === "nonCrit") {
        return 1
    }
    return critRate * (1 + critDmg) + (1 - critRate)
}

function denseAnomalyCritMultiplier(compiledEvent, sums) {
    if (compiledEvent.isDisorder) {
        return 1
    }
    const critRate = clampNumber(denseModifierSum(sums, "anomalyCritRate"), 0, 1)
    const critDmg = Math.max(0, denseModifierSum(sums, "anomalyCritDmg"))
    return critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1
}

function denseSelectedDmgBonusForElement(panelValues, damageElement) {
    return densePanelValue(panelValues, "dmgBonus") + densePanelValue(panelValues, `${damageElement}Dmg`)
}

function calculateCompiledDamageScoreValueDense({
    agent,
    panelValues,
    combatValues,
    compiledDamageTarget,
    eventModifierEntries,
    activeEntryFlags,
    modifierSums,
}) {
    const target = compiledDamageTarget.target
    let total = 0
    const events = compiledDamageTarget.events ?? []
    for (let index = 0; index < events.length; index += 1) {
        const compiledEvent = events[index]
        fillDenseModifierSums(modifierSums, eventModifierEntries[index], activeEntryFlags)
        const selectedDmgBonus = denseSelectedDmgBonusForElement(panelValues, compiledEvent.damageElement)
        const skillDamageBonus = denseModifierSum(modifierSums, "dmgBonus")
            + denseModifierSum(modifierSums, compiledEvent.elementDmgKey)

        if (compiledEvent.kind === "direct") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + denseModifierSum(modifierSums, "skillMultiplierBonus"),
            )
            const directDamageBonus = denseModifierSum(modifierSums, "directDamageBonus") + skillDamageBonus
            total += densePanelValue(panelValues, "atk")
                * effectiveSkillMultiplier
                * (1 + selectedDmgBonus + directDamageBonus)
                * denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
                * denseCritMultiplier(panelValues, compiledEvent.critMode)
                * compiledEvent.count
            continue
        }

        if (compiledEvent.kind === "sheer") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + denseModifierSum(modifierSums, "skillMultiplierBonus"),
            )
            const sheerDmgBonus = denseModifierSum(modifierSums, "sheerDmgBonus")
                + denseModifierSum(modifierSums, compiledEvent.elementSheerDmgKey)
            total += (compiledDamageTarget.isRuptureAgent
                ? densePanelValue(panelValues, "sheerForce")
                : 0)
                * effectiveSkillMultiplier
                * denseCritMultiplier(panelValues, compiledEvent.critMode)
                * (1 + selectedDmgBonus + skillDamageBonus)
                * denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
                * (1 + sheerDmgBonus)
                * targetActiveStunMultiplier(target, {
                    stunDmgMultiplierBonus: denseModifierSum(modifierSums, "stunDmgMultiplierBonus"),
                    stunDmgMultiplierBonusAlways: denseModifierSum(modifierSums, "stunDmgMultiplierBonusAlways"),
                })
                * compiledEvent.count
            continue
        }

        const effectiveBaseMultiplier = Math.max(
            0,
            compiledEvent.baseMultiplier + denseModifierSum(
                modifierSums,
                compiledEvent.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
            ),
        )
        const anomalyDamageBonus = 1 + (
            compiledEvent.isDisorder
                ? denseModifierSum(modifierSums, "disorderDamageBonus")
                : denseModifierSum(modifierSums, "anomalyDamageBonus")
        )
        total += densePanelValue(panelValues, "atk")
            * effectiveBaseMultiplier
            * (1 + selectedDmgBonus + skillDamageBonus)
            * denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
            * (Math.max(0, densePanelValue(panelValues, "anomalyProficiency")) / 100)
            * compiledDamageTarget.anomalyLevelMultiplier
            * anomalyDamageBonus
            * denseAnomalyCritMultiplier(compiledEvent, modifierSums)
            * compiledEvent.count
    }
    return total
}

function calculateDamageFinalValue({ agent, panel, bonusTotals, damageInput }) {
    const damageRequest = Array.isArray(damageInput?.events) && damageInput?.target
        ? damageInput
        : normalizeDamageRequest(damageInput, agent, {})
    return calculateDamageTotalFinalValue({
        agent,
        panel,
        bonusTotals,
        damageRequest,
    })
}

function calculateDamageWhiteBox({ catalog, agent, panel, selectedDmgBonus, bonusTotals, input, skillOptions = {} }) {
    void selectedDmgBonus
    return calculateDamageResult({
        catalog,
        agent,
        panel,
        bonusTotals,
        input,
        includeWhiteBox: true,
        skillOptions,
    })
}

function outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel) {
    return {
        baseAtk: {
            agent: baseBreakdown.agent.atk,
            wEngine: baseBreakdown.wEngine.atk,
            coreSkill: baseBreakdown.coreSkill.atk,
            total: baseBreakdown.total.atk,
        },
        atkPanel: {
            baseAtk: baseBreakdown.total.atk,
            atkPct: bonusTotals.atkPct,
            atkFromPct: baseBreakdown.total.atk * bonusTotals.atkPct,
            atkFlat: bonusTotals.atkFlat,
            total: panel.atk,
        },
    }
}

function inCombatAtkBreakdown(outOfCombat, bonusTotals, panel) {
    const basePct = bonusTotals.atkPct + bonusTotals.atkPctBase
    const outOfCombatPct = bonusTotals.atkPctOutOfCombat
    return {
        atkPanel: {
            outOfCombatAtk: outOfCombat.panel.atk,
            atkFlat: bonusTotals.atkFlat,
            baseAtk: outOfCombat.base.atk,
            baseAtkPct: basePct,
            atkFromBasePct: outOfCombat.base.atk * basePct,
            outOfCombatAtkPct: outOfCombatPct,
            atkFromOutOfCombatPct: outOfCombat.panel.atk * outOfCombatPct,
            total: panel.atk,
        },
    }
}

function resolveDamageElement(agent = {}) {
    const damageElement = agent.damageElement ?? agent.attribute
    return DAMAGE_ELEMENTS.includes(damageElement) ? damageElement : "physical"
}

function resolveAttributeBonusKey(agent) {
    const damageElement = resolveDamageElement(agent)
    return `${damageElement}Dmg`
}

function defaultCoreSkillLevel(agent) {
    const levels = agent.coreSkill?.levels ?? []
    return agent.coreSkill?.defaultLevel ?? levels.at(-1)?.level ?? "none"
}

function activeCoreSkillLevels(agent, requestedLevel) {
    const levels = agent.coreSkill?.levels ?? []
    const selectedLevel = requestedLevel ?? defaultCoreSkillLevel(agent)
    if (!levels.length || selectedLevel === "none" || selectedLevel == null || selectedLevel === "") {
        return {
            selectedLevel: "none",
            levels: [],
        }
    }

    const selectedIndex = levels.findIndex(item => item.level === selectedLevel)
    if (selectedIndex < 0) {
        throw new Error(`Unknown core skill level for ${agent.id}: ${selectedLevel}`)
    }

    return {
        selectedLevel,
        levels: levels.slice(0, selectedIndex + 1),
    }
}

function collectCoreSkillBonuses(agent, requestedLevel) {
    const active = activeCoreSkillLevels(agent, requestedLevel)
    const baseAdditions = {
        hp: 0,
        atk: 0,
        def: 0,
    }
    const panelBonuses = []
    const appliedEffects = []

    for (const level of active.levels) {
        const stats = (level.stats ?? []).map(item => ({
            stat: item.stat,
            value: Number(item.value ?? 0),
            mode: item.mode ?? "flat",
            target: item.target ?? (CORE_BASE_STAT_MAP[item.stat] ? "base" : "panel"),
        }))

        for (const stat of stats) {
            const baseKey = CORE_BASE_STAT_MAP[stat.stat]
            if (stat.target === "base" && baseKey) {
                baseAdditions[baseKey] += stat.value
            } else {
                panelBonuses.push(stat)
            }
        }

        appliedEffects.push({
            key: `${agent.id}.coreSkill.${level.level}`,
            scope: "outOfCombat",
            condition: null,
            stats: stats.map(stat => ({
                ...stat,
                value: CORE_BASE_STAT_MAP[stat.stat]
                    ? stat.value
                    : toCalcValue(stat.stat, stat.value, stat.mode),
            })),
        })
    }

    return {
        selectedLevel: active.selectedLevel,
        appliedLevels: active.levels.map(level => level.level),
        baseAdditions,
        panelBonuses,
        appliedEffects,
    }
}

function calculatePanel({ agent, wEngine, driveDiscs, driveDiscSets, coreSkillLevel }) {
    const coreSkill = collectCoreSkillBonuses(agent, coreSkillLevel)
    const base = {
        hp: Number(agent.level60.hpBase ?? 0) + coreSkill.baseAdditions.hp,
        atk: Number(agent.level60.atkBase ?? 0) + Number(wEngine.level60.atkBase ?? 0) + coreSkill.baseAdditions.atk,
        def: Number(agent.level60.defBase ?? 0) + coreSkill.baseAdditions.def,
    }

    const baseBreakdown = {
        agent: {
            hp: Number(agent.level60.hpBase ?? 0),
            atk: Number(agent.level60.atkBase ?? 0),
            def: Number(agent.level60.defBase ?? 0),
        },
        wEngine: {
            hp: 0,
            atk: Number(wEngine.level60.atkBase ?? 0),
            def: 0,
        },
        coreSkill: coreSkill.baseAdditions,
        total: base,
    }

    const basePanelStats = {
        critRate: toBaseCalcValue("critRate", agent.level60.critRate ?? 0),
        critDmg: toBaseCalcValue("critDmg", agent.level60.critDmg ?? 0),
        impact: Number(agent.level60.impact ?? 0),
        anomalyProficiency: Number(agent.level60.anomalyProficiency ?? 0),
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0),
        energyRegen: toBaseCalcValue("energyRegen", agent.level60.energyRegen ?? 100),
        penFlat: Number(agent.level60.penFlat ?? 0),
        penRatio: toBaseCalcValue("penRatio", agent.level60.penRatio ?? 0),
        dmgBonus: toBaseCalcValue("dmgBonus", agent.level60.dmgBonus ?? 0),
    }

    const bonusTotals = createBonusTotals()

    if (wEngine.level60.advancedStat) {
        addBonus(
            bonusTotals,
            wEngine.level60.advancedStat.stat,
            wEngine.level60.advancedStat.value ?? 0,
            wEngine.level60.advancedStat.mode
        )
    }

    for (const bonus of coreSkill.panelBonuses) {
        addBonus(bonusTotals, bonus.stat, bonus.value, bonus.mode)
    }

    const setCounts = new Map()
    for (const disc of driveDiscs) {
        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)

        addBonus(bonusTotals, disc.mainStat.stat, disc.mainStat.value ?? 0, disc.mainStat.mode)
        for (const subStat of disc.subStats ?? []) {
            addBonus(bonusTotals, subStat.stat, subStat.value ?? 0, subStat.mode)
        }
    }

    const appliedEffects = []
    const ignoredEffects = []

    for (const [setId, count] of setCounts.entries()) {
        const set = driveDiscSets.get(setId)
        if (!set) {
            ignoredEffects.push(`${setId}.missing`)
            continue
        }

        if (count >= 2) {
            applyEffectSet(
                bonusTotals,
                set.twoPiece,
                `${setId}.twoPiece`,
                appliedEffects,
                ignoredEffects
            )
        }

    }

    appliedEffects.unshift(...coreSkill.appliedEffects)

    const panel = createPanel()
    panel.hp = base.hp * (1 + bonusTotals.hpPct) + bonusTotals.hpFlat
    panel.atk = base.atk * (1 + bonusTotals.atkPct) + bonusTotals.atkFlat
    panel.def = base.def * (1 + bonusTotals.defPct) + bonusTotals.defFlat
    panel.critRate = basePanelStats.critRate + bonusTotals.critRate
    panel.critDmg = basePanelStats.critDmg + bonusTotals.critDmg
    panel.impact = (basePanelStats.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
    panel.anomalyProficiency = basePanelStats.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
    panel.anomalyMastery = basePanelStats.anomalyMastery + bonusTotals.anomalyMasteryFlat
    panel.energyRegen = basePanelStats.energyRegen * (1 + bonusTotals.energyRegenPct)
    panel.penFlat = basePanelStats.penFlat + bonusTotals.penFlat
    panel.penRatio = basePanelStats.penRatio + bonusTotals.penRatio
    for (const key of RES_IGNORE_KEYS) {
        panel[key] = bonusTotals[key]
    }
    panel.dmgBonus = basePanelStats.dmgBonus + bonusTotals.dmgBonus
    for (const element of DAMAGE_ELEMENTS) {
        const key = `${element}Dmg`
        panel[key] = bonusTotals[key]
    }
    applyPanelSheerForce(agent, panel, bonusTotals)

    const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
    const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

    const simpleTargetScore = panel.atk
        * (1 + Math.min(panel.critRate, 1) * panel.critDmg)
        * (1 + selectedDmgBonus)

    return roundNumbers({
        base,
        baseBreakdown,
        breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
        bonusTotals,
        panel,
        simpleTargetScore,
        selectedDmgBonus,
        coreSkill,
        appliedEffects,
        ignoredEffects,
    })
}

function createPreparedOutOfCombatPanelCalculator({ agent, wEngine, driveDiscSets, coreSkillLevel }) {
    const coreSkill = collectCoreSkillBonuses(agent, coreSkillLevel)
    const base = {
        hp: Number(agent.level60.hpBase ?? 0) + coreSkill.baseAdditions.hp,
        atk: Number(agent.level60.atkBase ?? 0) + Number(wEngine.level60.atkBase ?? 0) + coreSkill.baseAdditions.atk,
        def: Number(agent.level60.defBase ?? 0) + coreSkill.baseAdditions.def,
    }

    const baseBreakdown = {
        agent: {
            hp: Number(agent.level60.hpBase ?? 0),
            atk: Number(agent.level60.atkBase ?? 0),
            def: Number(agent.level60.defBase ?? 0),
        },
        wEngine: {
            hp: 0,
            atk: Number(wEngine.level60.atkBase ?? 0),
            def: 0,
        },
        coreSkill: coreSkill.baseAdditions,
        total: base,
    }

    const basePanelStats = {
        critRate: toBaseCalcValue("critRate", agent.level60.critRate ?? 0),
        critDmg: toBaseCalcValue("critDmg", agent.level60.critDmg ?? 0),
        impact: Number(agent.level60.impact ?? 0),
        anomalyProficiency: Number(agent.level60.anomalyProficiency ?? 0),
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0),
        energyRegen: toBaseCalcValue("energyRegen", agent.level60.energyRegen ?? 100),
        penFlat: Number(agent.level60.penFlat ?? 0),
        penRatio: toBaseCalcValue("penRatio", agent.level60.penRatio ?? 0),
        dmgBonus: toBaseCalcValue("dmgBonus", agent.level60.dmgBonus ?? 0),
    }

    const staticBonusTotals = createBonusTotals()

    if (wEngine.level60.advancedStat) {
        addBonus(
            staticBonusTotals,
            wEngine.level60.advancedStat.stat,
            wEngine.level60.advancedStat.value ?? 0,
            wEngine.level60.advancedStat.mode
        )
    }

    for (const bonus of coreSkill.panelBonuses) {
        addBonus(staticBonusTotals, bonus.stat, bonus.value, bonus.mode)
    }

    const scoreOnlySetBonusCache = new Map()

    function scoreOnlyBaseBonusTotalsForSetCounts(setCounts = new Map()) {
        const signature = setCountsSignature(setCounts)
        if (scoreOnlySetBonusCache.has(signature)) {
            return scoreOnlySetBonusCache.get(signature)
        }

        const bonusTotals = { ...staticBonusTotals }
        for (const [setId, count] of setCounts.entries()) {
            const set = driveDiscSets.get(setId)
            if (!set || count < 2) {
                continue
            }
            applyEffectSet(
                bonusTotals,
                set.twoPiece,
                `${setId}.twoPiece`,
                null,
                null
            )
        }
        scoreOnlySetBonusCache.set(signature, bonusTotals)
        return bonusTotals
    }

    function scoreOnlyBaseBonusTotalsForIndexedSetCounts(setCountValues = [], setIds = []) {
        const signature = indexedSetCountsSignature(setCountValues, setIds)
        if (scoreOnlySetBonusCache.has(signature)) {
            return scoreOnlySetBonusCache.get(signature)
        }

        const bonusTotals = { ...staticBonusTotals }
        const length = Math.min(setCountValues.length ?? 0, setIds.length ?? 0)
        for (let index = 0; index < length; index += 1) {
            const count = Number(setCountValues[index] ?? 0)
            if (count < 2) {
                continue
            }
            const setId = setIds[index]
            const set = driveDiscSets.get(setId)
            if (!set) {
                continue
            }
            applyEffectSet(
                bonusTotals,
                set.twoPiece,
                `${setId}.twoPiece`,
                null,
                null
            )
        }
        scoreOnlySetBonusCache.set(signature, bonusTotals)
        return bonusTotals
    }

    function compileDenseOutOfCombatTarget(statIds = [], setIds = []) {
        const baseBonusValues = new Float64Array(BONUS_KEYS.length)
        for (const key of BONUS_KEYS) {
            baseBonusValues[BONUS_KEY_INDEX.get(key)] = Number(staticBonusTotals[key] ?? 0)
        }
        const statToBonusIndexes = (statIds ?? []).map(stat => ({
            stat,
            index: BONUS_KEY_INDEX.get(BONUS_KEY_MAP[stat]),
        }))
        const compiledSetBonuses = compileDenseOutOfCombatSetBonuses(driveDiscSets, setIds)
        const bonusValues = new Float64Array(BONUS_KEYS.length)
        const panelValues = new Float64Array(OUTPUT_PANEL_KEYS.length)
        const isRupture = isRuptureAgent(agent)

        return {
            score(statValues = [], setCountValues = []) {
                bonusValues.set(baseBonusValues)
                addDenseSetBonuses(bonusValues, setCountValues, compiledSetBonuses)
                const length = Math.min(statValues.length ?? 0, statToBonusIndexes.length)
                for (let index = 0; index < length; index += 1) {
                    const value = Number(statValues[index] ?? 0)
                    const target = statToBonusIndexes[index]
                    if (value !== 0 && target.index !== undefined) {
                        bonusValues[target.index] += toCalcValue(target.stat, value)
                    }
                }

                const hp = base.hp * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "hpPct"))
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "hpFlat")
                const atk = base.atk * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "atkPct"))
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "atkFlat")
                const def = base.def * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "defPct"))
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "defFlat")
                panelValues[PANEL_KEY_INDEX.get("hp")] = hp
                panelValues[PANEL_KEY_INDEX.get("atk")] = atk
                panelValues[PANEL_KEY_INDEX.get("def")] = def
                panelValues[PANEL_KEY_INDEX.get("critRate")] = basePanelStats.critRate + denseValue(bonusValues, BONUS_KEY_INDEX, "critRate")
                panelValues[PANEL_KEY_INDEX.get("critDmg")] = basePanelStats.critDmg + denseValue(bonusValues, BONUS_KEY_INDEX, "critDmg")
                panelValues[PANEL_KEY_INDEX.get("impact")] = (basePanelStats.impact * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "impactPct")))
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "impactFlat")
                panelValues[PANEL_KEY_INDEX.get("anomalyProficiency")] = basePanelStats.anomalyProficiency
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "anomalyProficiencyFlat")
                panelValues[PANEL_KEY_INDEX.get("anomalyMastery")] = basePanelStats.anomalyMastery
                    + denseValue(bonusValues, BONUS_KEY_INDEX, "anomalyMasteryFlat")
                panelValues[PANEL_KEY_INDEX.get("energyRegen")] = basePanelStats.energyRegen
                    * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "energyRegenPct"))
                panelValues[PANEL_KEY_INDEX.get("penFlat")] = basePanelStats.penFlat + denseValue(bonusValues, BONUS_KEY_INDEX, "penFlat")
                panelValues[PANEL_KEY_INDEX.get("penRatio")] = basePanelStats.penRatio + denseValue(bonusValues, BONUS_KEY_INDEX, "penRatio")
                for (const key of RES_IGNORE_KEYS) {
                    panelValues[PANEL_KEY_INDEX.get(key)] = denseValue(bonusValues, BONUS_KEY_INDEX, key)
                }
                panelValues[PANEL_KEY_INDEX.get("dmgBonus")] = basePanelStats.dmgBonus + denseValue(bonusValues, BONUS_KEY_INDEX, "dmgBonus")
                for (const element of DAMAGE_ELEMENTS) {
                    const key = `${element}Dmg`
                    panelValues[PANEL_KEY_INDEX.get(key)] = denseValue(bonusValues, BONUS_KEY_INDEX, key)
                }
                panelValues[PANEL_KEY_INDEX.get("sheerForceFlat")] = isRupture
                    ? denseValue(bonusValues, BONUS_KEY_INDEX, "sheerForceFlat")
                    : 0
                panelValues[PANEL_KEY_INDEX.get("sheerForce")] = isRupture
                    ? Math.max(0, (hp * SHEER_FORCE_HP_RATIO) + (atk * SHEER_FORCE_ATK_RATIO) + panelValues[PANEL_KEY_INDEX.get("sheerForceFlat")])
                    : 0

                return {
                    base,
                    bonusValues,
                    panelValues,
                }
            },
        }
    }

    return {
        compileDenseOutOfCombatTarget,
        calculate(driveDiscs = [], options = {}) {
            const bonusTotals = { ...staticBonusTotals }
            const setCounts = new Map()
            for (const disc of driveDiscs) {
                setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)

                addBonus(bonusTotals, disc.mainStat.stat, disc.mainStat.value ?? 0, disc.mainStat.mode)
                for (const subStat of disc.subStats ?? []) {
                    addBonus(bonusTotals, subStat.stat, subStat.value ?? 0, subStat.mode)
                }
            }

            const appliedEffects = []
            const ignoredEffects = []

            for (const [setId, count] of setCounts.entries()) {
                const set = driveDiscSets.get(setId)
                if (!set) {
                    ignoredEffects.push(`${setId}.missing`)
                    continue
                }

                if (count >= 2) {
                    applyEffectSet(
                        bonusTotals,
                        set.twoPiece,
                        `${setId}.twoPiece`,
                        appliedEffects,
                        ignoredEffects
                    )
                }
            }

            appliedEffects.unshift(...coreSkill.appliedEffects)

            const panel = createPanel()
            panel.hp = base.hp * (1 + bonusTotals.hpPct) + bonusTotals.hpFlat
            panel.atk = base.atk * (1 + bonusTotals.atkPct) + bonusTotals.atkFlat
            panel.def = base.def * (1 + bonusTotals.defPct) + bonusTotals.defFlat
            panel.critRate = basePanelStats.critRate + bonusTotals.critRate
            panel.critDmg = basePanelStats.critDmg + bonusTotals.critDmg
            panel.impact = (basePanelStats.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
            panel.anomalyProficiency = basePanelStats.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
            panel.anomalyMastery = basePanelStats.anomalyMastery + bonusTotals.anomalyMasteryFlat
            panel.energyRegen = basePanelStats.energyRegen * (1 + bonusTotals.energyRegenPct)
            panel.penFlat = basePanelStats.penFlat + bonusTotals.penFlat
            panel.penRatio = basePanelStats.penRatio + bonusTotals.penRatio
            for (const key of RES_IGNORE_KEYS) {
                panel[key] = bonusTotals[key]
            }
            panel.dmgBonus = basePanelStats.dmgBonus + bonusTotals.dmgBonus
            for (const element of DAMAGE_ELEMENTS) {
                const key = `${element}Dmg`
                panel[key] = bonusTotals[key]
            }
            applyPanelSheerForce(agent, panel, bonusTotals)

            const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
            const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

            const simpleTargetScore = panel.atk
                * (1 + Math.min(panel.critRate, 1) * panel.critDmg)
                * (1 + selectedDmgBonus)

            const result = {
                base,
                baseBreakdown,
                breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
                bonusTotals,
                panel,
                simpleTargetScore,
                selectedDmgBonus,
                coreSkill,
                appliedEffects,
                ignoredEffects,
            }

            return options.round === false ? result : roundNumbers(result)
        },
        calculateFromSummary(statTotals = new Map(), setCounts = new Map(), options = {}) {
            const scoreOnly = options.scoreOnly === true
            const bonusTotals = scoreOnly
                ? { ...scoreOnlyBaseBonusTotalsForSetCounts(setCounts) }
                : { ...staticBonusTotals }
            for (const [stat, value] of statTotals.entries()) {
                addBonus(bonusTotals, stat, value)
            }

            const appliedEffects = scoreOnly ? null : []
            const ignoredEffects = scoreOnly ? null : []

            if (!scoreOnly) {
                for (const [setId, count] of setCounts.entries()) {
                    const set = driveDiscSets.get(setId)
                    if (!set) {
                        ignoredEffects.push(`${setId}.missing`)
                        continue
                    }

                    if (count >= 2) {
                        applyEffectSet(
                            bonusTotals,
                            set.twoPiece,
                            `${setId}.twoPiece`,
                            appliedEffects,
                            ignoredEffects
                        )
                    }
                }
            }

            appliedEffects?.unshift(...coreSkill.appliedEffects)

            const panel = createPanel()
            panel.hp = base.hp * (1 + bonusTotals.hpPct) + bonusTotals.hpFlat
            panel.atk = base.atk * (1 + bonusTotals.atkPct) + bonusTotals.atkFlat
            panel.def = base.def * (1 + bonusTotals.defPct) + bonusTotals.defFlat
            panel.critRate = basePanelStats.critRate + bonusTotals.critRate
            panel.critDmg = basePanelStats.critDmg + bonusTotals.critDmg
            panel.impact = (basePanelStats.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
            panel.anomalyProficiency = basePanelStats.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
            panel.anomalyMastery = basePanelStats.anomalyMastery + bonusTotals.anomalyMasteryFlat
            panel.energyRegen = basePanelStats.energyRegen * (1 + bonusTotals.energyRegenPct)
            panel.penFlat = basePanelStats.penFlat + bonusTotals.penFlat
            panel.penRatio = basePanelStats.penRatio + bonusTotals.penRatio
            for (const key of RES_IGNORE_KEYS) {
                panel[key] = bonusTotals[key]
            }
            panel.dmgBonus = basePanelStats.dmgBonus + bonusTotals.dmgBonus
            for (const element of DAMAGE_ELEMENTS) {
                const key = `${element}Dmg`
                panel[key] = bonusTotals[key]
            }
            applyPanelSheerForce(agent, panel, bonusTotals)

            const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
            const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

            const result = scoreOnly ? {
                base,
                bonusTotals,
                panel,
                selectedDmgBonus,
            } : {
                base,
                baseBreakdown,
                breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
                bonusTotals,
                panel,
                simpleTargetScore: panel.atk
                    * (1 + Math.min(panel.critRate, 1) * panel.critDmg)
                    * (1 + selectedDmgBonus),
                selectedDmgBonus,
                coreSkill,
                appliedEffects,
                ignoredEffects,
            }

            return options.round === false ? result : roundNumbers(result)
        },
        calculateFromIndexedSummary(statValues = [], statIds = [], setCountValues = [], setIds = [], _setIndexById = null, options = {}) {
            const scoreOnly = options.scoreOnly === true
            const bonusTotals = scoreOnly
                ? { ...scoreOnlyBaseBonusTotalsForIndexedSetCounts(setCountValues, setIds) }
                : { ...staticBonusTotals }
            addIndexedStatTotals(bonusTotals, statValues, statIds)

            const appliedEffects = scoreOnly ? null : []
            const ignoredEffects = scoreOnly ? null : []

            if (!scoreOnly) {
                const setLength = Math.min(setCountValues.length ?? 0, setIds.length ?? 0)
                for (let index = 0; index < setLength; index += 1) {
                    const count = Number(setCountValues[index] ?? 0)
                    if (count <= 0) {
                        continue
                    }
                    const setId = setIds[index]
                    const set = driveDiscSets.get(setId)
                    if (!set) {
                        ignoredEffects?.push(`${setId}.missing`)
                        continue
                    }

                    if (count >= 2) {
                        applyEffectSet(
                            bonusTotals,
                            set.twoPiece,
                            `${setId}.twoPiece`,
                            appliedEffects,
                            ignoredEffects
                        )
                    }
                }
            }

            appliedEffects?.unshift(...coreSkill.appliedEffects)

            const panel = createPanel()
            panel.hp = base.hp * (1 + bonusTotals.hpPct) + bonusTotals.hpFlat
            panel.atk = base.atk * (1 + bonusTotals.atkPct) + bonusTotals.atkFlat
            panel.def = base.def * (1 + bonusTotals.defPct) + bonusTotals.defFlat
            panel.critRate = basePanelStats.critRate + bonusTotals.critRate
            panel.critDmg = basePanelStats.critDmg + bonusTotals.critDmg
            panel.impact = (basePanelStats.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
            panel.anomalyProficiency = basePanelStats.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
            panel.anomalyMastery = basePanelStats.anomalyMastery + bonusTotals.anomalyMasteryFlat
            panel.energyRegen = basePanelStats.energyRegen * (1 + bonusTotals.energyRegenPct)
            panel.penFlat = basePanelStats.penFlat + bonusTotals.penFlat
            panel.penRatio = basePanelStats.penRatio + bonusTotals.penRatio
            for (const key of RES_IGNORE_KEYS) {
                panel[key] = bonusTotals[key]
            }
            panel.dmgBonus = basePanelStats.dmgBonus + bonusTotals.dmgBonus
            for (const element of DAMAGE_ELEMENTS) {
                const key = `${element}Dmg`
                panel[key] = bonusTotals[key]
            }
            applyPanelSheerForce(agent, panel, bonusTotals)

            const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
            const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

            const result = scoreOnly ? {
                base,
                bonusTotals,
                panel,
                selectedDmgBonus,
            } : {
                base,
                baseBreakdown,
                breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
                bonusTotals,
                panel,
                simpleTargetScore: panel.atk
                    * (1 + Math.min(panel.critRate, 1) * panel.critDmg)
                    * (1 + selectedDmgBonus),
                selectedDmgBonus,
                coreSkill,
                appliedEffects,
                ignoredEffects,
            }

            return options.round === false ? result : roundNumbers(result)
        },
    }
}

export function normalizeCatalogPayload({
    agentsRaw = {},
    agentSkillsRaw = {},
    wEnginesRaw = {},
    driveDiscSetsRaw = {},
    combatBuffsRaw = {},
    anomalyEffectsRaw = {},
    statRulesRaw = {},
    exampleRaw = {},
    yeShunguangExampleRaw = {},
} = {}) {
    const legacyCombatBuffs = legacyCombatBuffBuckets(combatBuffsRaw.buffs ?? [])
    const rawFieldBuffs = [
        ...(combatBuffsRaw.fieldBuffs ?? []),
        ...legacyCombatBuffs.fieldBuffs,
    ]
    const rawBossBuffs = [
        ...(combatBuffsRaw.bossBuffs ?? []),
        ...legacyCombatBuffs.bossBuffs,
    ]
    const rawSystemBuffs = [
        ...(combatBuffsRaw.systemBuffs ?? []),
        ...legacyCombatBuffs.systemBuffs,
    ]
    const teammateCombatBuffs = flattenTeammateCombatBuffs(combatBuffsRaw.teammates ?? [])
    const fieldCombatBuffs = flattenFieldCombatBuffs(rawFieldBuffs)
    const bossCombatBuffs = flattenBossCombatBuffs(rawBossBuffs)
    const anomalyCatalog = normalizeAnomalyCatalogPayload(anomalyEffectsRaw)
    const catalog = {
        agents: agentsRaw.agents ?? [],
        agentSkills: agentSkillsRaw.agentSkills ?? [],
        wEngines: wEnginesRaw.wEngines ?? [],
        driveDiscSets: driveDiscSetsRaw.sets ?? [],
        anomalyEffects: anomalyCatalog.anomalyEffects,
        disorderEffects: anomalyCatalog.disorderEffects,
        anomalySettlementEffects: anomalyCatalog.anomalySettlementEffects,
        combatBuffs: [
            ...teammateCombatBuffs,
            ...fieldCombatBuffs,
            ...bossCombatBuffs,
            ...rawSystemBuffs,
        ],
        teammateCombatBuffGroups: visibleTeammateCombatBuffGroups(combatBuffsRaw.teammates ?? []),
        teammateCombatBuffs,
        fieldCombatBuffs: rawFieldBuffs,
        bossCombatBuffs: rawBossBuffs,
        systemCombatBuffs: rawSystemBuffs,
        statRules: statRulesRaw,
        example: exampleRaw,
        examples: {
            outOfCombat: exampleRaw,
            yeShunguang: yeShunguangExampleRaw,
        },
    }

    const maps = buildMaps(catalog)
    validateCatalogModeling(catalog)
    return {
        ...catalog,
        ...visibleCatalogCollections(catalog),
        ...maps,
    }
}

export function normalizeCatalog(catalog = {}) {
    const maps = buildMaps(catalog)
    validateCatalogModeling(catalog)
    return {
        ...catalog,
        ...visibleCatalogCollections(catalog),
        ...maps,
    }
}

export function buildMeta(catalog) {
    return {
        agents: catalog.agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            rarity: agent.rarity,
            attribute: agent.attribute,
            damageElement: agent.damageElement,
            specialty: agent.specialty,
            faction: agent.faction,
            images: agent.images,
            coreSkill: agent.coreSkill,
            combatBuffs: agent.combatBuffs ?? {},
            preferredDriveDiscs: agent.preferredDriveDiscs ?? null,
            skillGroups: agent.skillGroups ?? [],
            defaultCalculationConfig: agent.defaultCalculationConfig ?? null,
        })),
        agentSkills: (catalog.agentSkills ?? []).map(item => ({
            id: item.id,
            agentId: item.agentId,
            name: item.name,
            categories: item.categories ?? [],
            sources: item.sources ?? [],
            verification: item.verification ?? null,
        })),
        wEngines: catalog.wEngines.map(item => ({
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            specialty: item.specialty,
            attribute: item.attribute,
            level60: item.level60,
            modification: item.modification ?? { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
            effect: item.effect ?? null,
            passive: wEngineEffectSelfBuff(item),
            selfBuff: wEngineEffectSelfBuff(item),
            teamBuff: wEngineEffectTeamBuff(item),
            relatedAgentId: item.relatedAgentId,
            images: item.images,
        })),
        driveDiscSets: catalog.driveDiscSets.map(item => ({
            id: item.id,
            name: item.name,
            images: item.images,
            twoPiece: item.twoPiece,
            fourPiece: item.fourPiece,
        })),
        combatBuffs: (catalog.combatBuffs ?? [])
            .filter(item => !item.hidden)
            .map(item => ({
                id: item.id,
                sourceType: item.sourceType,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                ownerId: item.ownerId,
                ownerName: item.ownerName,
                teammateId: item.teammateId,
                teammateName: item.teammateName,
                teammateImages: item.teammateImages ?? null,
                source: item.source,
                sourceLabel: item.sourceLabel,
                sourcePeriod: item.sourcePeriod,
                period: item.period ?? null,
                bossName: item.bossName,
                bossSource: item.bossSource,
                name: item.name,
                description: item.description,
                conditionLabel: item.conditionLabel,
                stats: item.stats ?? [],
                effects: item.effects ?? null,
                buffModifiers: item.buffModifiers ?? null,
                coverage: item.coverage ?? null,
            })),
        teammateCombatBuffGroups: (catalog.teammateCombatBuffGroups ?? []).map(teammate => ({
            id: teammate.id,
            name: teammate.name,
            images: teammate.images ?? null,
            buffs: (teammate.buffs ?? []).map(buff => {
                const normalizedBuff = normalizeTeammateCombatBuffForGroup(teammate, buff)
                return {
                    id: buff.id,
                    sourceType: normalizedBuff.sourceType,
                    sourceCategory: normalizedBuff.sourceCategory,
                    sourceKind: normalizedBuff.sourceKind,
                    ownerId: normalizedBuff.ownerId,
                    ownerName: normalizedBuff.ownerName,
                    teammateId: normalizedBuff.teammateId,
                    teammateName: normalizedBuff.teammateName,
                    teammateImages: normalizedBuff.teammateImages,
                    source: normalizedBuff.source,
                    sourceLabel: normalizedBuff.sourceLabel,
                    name: normalizedBuff.name,
                    description: normalizedBuff.description,
                    conditionLabel: normalizedBuff.conditionLabel,
                    stats: normalizedBuff.stats ?? [],
                    effects: normalizedBuff.effects ?? null,
                    buffModifiers: normalizedBuff.buffModifiers ?? null,
                    coverage: normalizedBuff.coverage ?? null,
                }
            }),
        })),
        fieldCombatBuffs: flattenFieldCombatBuffs(catalog.fieldCombatBuffs ?? [])
            .filter(item => !item.hidden)
            .map(item => ({
                id: item.id,
                sourceType: item.sourceType,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                source: item.source,
                sourceLabel: item.sourceLabel,
                sourcePeriod: item.sourcePeriod,
                period: item.period ?? null,
                name: item.name,
                description: item.description,
                conditionLabel: item.conditionLabel,
                stats: item.stats ?? [],
                effects: item.effects ?? null,
                buffModifiers: item.buffModifiers ?? null,
                coverage: item.coverage ?? null,
            })),
        bossCombatBuffs: flattenBossCombatBuffs(catalog.bossCombatBuffs ?? [])
            .filter(item => !item.hidden)
            .map(item => ({
                id: item.id,
                sourceType: item.sourceType,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                bossName: item.bossName,
                bossSource: item.bossSource,
                sourceLabel: item.sourceLabel,
                sourcePeriod: item.sourcePeriod,
                name: item.name,
                description: item.description,
                conditionLabel: item.conditionLabel,
                stats: item.stats ?? [],
                effects: item.effects ?? null,
                buffModifiers: item.buffModifiers ?? null,
                coverage: item.coverage ?? null,
            })),
        statRules: catalog.statRules,
        damageTargetPresets: DAMAGE_TARGET_PRESETS,
        anomalySettlementEffects: catalog.anomalySettlementEffects ?? [
            ...(catalog.anomalyEffects ?? []),
            ...(catalog.disorderEffects ?? []),
        ],
        anomalyEffects: catalog.anomalyEffects ?? [],
        disorderEffects: catalog.disorderEffects ?? [],
    }
}

export function calculateOutOfCombatPanel(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const rawWEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!rawWEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }
    const wEngine = materializeWEngineForModificationLevel(rawWEngine, input.wEngineModificationLevel)

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []

    return calculatePanel({ agent, wEngine, driveDiscs, driveDiscSets, coreSkillLevel: input.coreSkillLevel })
}

export function createInCombatPanelCalculator(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const rawWEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!rawWEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }
    const wEngine = materializeWEngineForModificationLevel(rawWEngine, input.wEngineModificationLevel)

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const combatInput = input.combatBuffs ?? input.combat ?? {}
    const activeBuffIds = new Set(Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []
    const manualEffects = Array.isArray(combatInput.manualEffects) ? combatInput.manualEffects : []
    const runtimeInputs = combatInput.runtimeInputs && typeof combatInput.runtimeInputs === "object"
        ? combatInput.runtimeInputs
        : {}
    const wEngineTeamModificationLevels = wEngineTeamModificationLevelMap(combatInput)
    const outOfCombatCalculator = createPreparedOutOfCombatPanelCalculator({
        agent,
        wEngine,
        driveDiscSets,
        coreSkillLevel: input.coreSkillLevel,
    })
    const activeCatalogBuffs = (catalog.combatBuffs ?? []).filter(buff => activeBuffIds.has(buff.id))
    const activeAgentBuffs = agentCombatBuffEntries(agent).filter(entry => activeBuffIds.has(entry.id))
    const currentWEngineRequirement = wEngineEffectData(wEngine)?.requirement?.specialty ?? wEngine.specialty
    const activeCurrentWEngineEntries = wEngineCombatBuffEntries(wEngine).filter(entry => activeBuffIds.has(entry.key))
    const appliedCurrentWEngineKeys = new Set(activeCurrentWEngineEntries.map(entry => entry.key))
    // External team W-Engine Buffs represent another wearer that has already met its specialty/trigger requirements.
    const activeTeamWEngineEntries = (catalog.wEngines ?? [])
        .map(sourceWEngine => materializedTeamWEngineEntry(sourceWEngine, wEngineTeamModificationLevels))
        .filter(entry => activeBuffIds.has(entry.key) && !appliedCurrentWEngineKeys.has(entry.key))
    const activeDriveDisc4pcIds = [...activeBuffIds].filter(activeId => String(activeId).startsWith("driveDisc4pc:"))
    const normalizedDamageInput = normalizeDamageRequest(input.damage, agent, catalog, { coreSkillLevel: input.coreSkillLevel })
    const compiledDamageTarget = compileDamageScoreTarget(normalizedDamageInput, agent)
    const activeManualEntries = manualStats
        .map((item, index) => {
            const value = Number(item?.value ?? 0)
            if (!item?.stat || !Number.isFinite(value) || value === 0) {
                return null
            }

            return {
                key: item.id ? `manual:${item.id}` : `manual:${index + 1}`,
                name: {
                    zhCN: item.label ?? "手动修正",
                    en: item.label ?? "Manual Correction",
                },
                effect: {
                    scope: "inCombat",
                    condition: null,
                    stats: [
                        {
                            stat: item.stat,
                            value,
                            mode: item.mode ?? "flat",
                            basis: item.basis ?? null,
                        },
                    ],
                },
            }
        })
        .filter(Boolean)
    const activeManualEffectEntries = manualEffects
        .map((item, index) => {
            const effects = Array.isArray(item?.effects) ? item.effects : []
            if (!effects.length) {
                return null
            }
            return {
                key: item.id ? `manualEffect:${item.id}` : `manualEffect:${index + 1}`,
                name: {
                    zhCN: item.label ?? item.name ?? "手动修正",
                    en: item.label ?? item.name ?? "Manual Correction",
                },
                effect: {
                    scope: "inCombat",
                    condition: null,
                    effects,
                },
            }
        })
        .filter(Boolean)

    function compileDensePanelScoreTarget({ statIds = [], setIds = [], setIndexById = null } = {}) {
        if (typeof outOfCombatCalculator.compileDenseOutOfCombatTarget !== "function") {
            return null
        }

        for (const activeId of activeDriveDisc4pcIds) {
            const rawKey = String(activeId).slice("driveDisc4pc:".length)
            const [setId, part = "self"] = rawKey.split(".")
            const set = driveDiscSets.get(setId)
            const effect = part === "team"
                ? driveDiscFourPieceTeamBuff(set)
                : driveDiscFourPieceSelfBuff(set)
            if (effectBuffModifiers(effect).length) {
                return null
            }
        }
        const denseBuffModifiers = collectActiveBuffModifiers({
            activeCatalogBuffs,
            activeAgentBuffs,
            activeCurrentWEngineEntries,
            activeTeamWEngineEntries,
            activeDriveDisc4pcIds: [],
            teammateDriveDiscSetIds,
            driveDiscSets,
            setCounts: new Map(),
            currentWEngineRequirement,
            agent,
        })
        const entries = []
        const pushEntry = options => {
            const effect = options?.effect
            if (!effect) {
                return true
            }
            const entry = compileDenseCombatEffectEntry({
                ...options,
                buffModifiers: denseBuffModifiers,
            })
            if (entry) {
                entries.push(entry)
            }
            return true
        }

        for (const buff of activeCatalogBuffs) {
            if (!pushEntry({
                effect: buff,
                key: buff.id,
                sourceType: buff.sourceType ?? "manual",
                runtimeInput: runtimeInputs[buff.id],
            })) {
                return null
            }
        }

        for (const entry of activeAgentBuffs) {
            if (!pushEntry({
                effect: entry.buff,
                key: entry.id,
                sourceType: "self",
                runtimeInput: runtimeInputs[entry.id],
            })) {
                return null
            }
        }

        for (const entry of activeCurrentWEngineEntries) {
            if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
                continue
            }
            if (!pushEntry({
                effect: entry.effect,
                key: entry.key,
                sourceType: entry.sourceType,
                runtimeInput: runtimeInputs[entry.key],
            })) {
                return null
            }
        }

        for (const entry of activeTeamWEngineEntries) {
            if (!pushEntry({
                effect: entry.teamBuff,
                key: entry.key,
                sourceType: "wEngineTeam",
                runtimeInput: runtimeInputs[entry.key],
            })) {
                return null
            }
        }

        for (const activeId of activeDriveDisc4pcIds) {
            const rawKey = String(activeId).slice("driveDisc4pc:".length)
            const [setId, part = "self"] = rawKey.split(".")
            const set = driveDiscSets.get(setId)
            if (!set) {
                continue
            }
            const effect = part === "team"
                ? driveDiscFourPieceTeamBuff(set)
                : driveDiscFourPieceSelfBuff(set)
            const setIndex = setIndexById?.get?.(setId)
            if (setIndex === undefined) {
                continue
            }
            if (!pushEntry({
                effect,
                key: activeId,
                sourceType: part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc",
                runtimeInput: runtimeInputs[activeId],
                setIndex,
                minSetCount: 4,
            })) {
                return null
            }
        }

        for (let index = 0; index < teammateDriveDiscSetIds.length; index += 1) {
            const setId = teammateDriveDiscSetIds[index]
            if (!setId) {
                continue
            }
            const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
            const set = driveDiscSets.get(setId)
            if (!set) {
                continue
            }
            const teamBuff = driveDiscFourPieceTeamBuff(set)
            if (!pushEntry({
                effect: teamBuff,
                key,
                sourceType: "driveDisc4pcTeam",
                runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
            })) {
                return null
            }
        }

        for (const entry of activeManualEntries) {
            if (!pushEntry({
                effect: entry.effect,
                key: entry.key,
                sourceType: "manual",
            })) {
                return null
            }
        }

        for (const entry of activeManualEffectEntries) {
            if (!pushEntry({
                effect: entry.effect,
                key: entry.key,
                sourceType: "manual",
            })) {
                return null
            }
        }

        const denseOutOfCombat = outOfCombatCalculator.compileDenseOutOfCombatTarget(statIds, setIds)
        const combatValues = new Float64Array(COMBAT_BONUS_KEYS.length)
        const panelValues = new Float64Array(OUTPUT_PANEL_KEYS.length)
        const panel = createPanel()
        const result = {
            panel,
            selectedDmgBonus: 0,
            finalDamage: 0,
            minPanelPass: true,
            requiredPanel: null,
        }
        const activeEntryFlags = new Uint8Array(entries.length)
        const eventModifierEntries = compileDenseDamageModifierEntries(entries, compiledDamageTarget.events)
        const modifierSums = new Float64Array(DAMAGE_MODIFIER_SUM_KEYS.length)
        const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
        const isRupture = isRuptureAgent(agent)

        return {
            scoreKernel: "compiled-dense",
            scoreDense(statValues = [], setCountValues = []) {
                const outOfCombat = denseOutOfCombat.score(statValues, setCountValues)
                const outPanelValues = outOfCombat.panelValues
                const outBase = outOfCombat.base
                combatValues.fill(0)
                activeEntryFlags.fill(0)

                for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
                    const entry = entries[entryIndex]
                    if (entry.setIndex !== null && Number(setCountValues[entry.setIndex] ?? 0) < Number(entry.minSetCount ?? 0)) {
                        continue
                    }
                    activeEntryFlags[entryIndex] = 1
                    for (const stat of entry.stats ?? []) {
                        addDenseCombatStat(combatValues, stat, entry.sourceType, outBase, outPanelValues)
                    }
                }

                const hp = densePanelValue(outPanelValues, "hp")
                    + denseCombatValue(combatValues, "hpFlat")
                    + Number(outBase.hp ?? 0) * (denseCombatValue(combatValues, "hpPct") + denseCombatValue(combatValues, "hpPctBase"))
                    + densePanelValue(outPanelValues, "hp") * denseCombatValue(combatValues, "hpPctOutOfCombat")
                const atk = densePanelValue(outPanelValues, "atk")
                    + denseCombatValue(combatValues, "atkFlat")
                    + Number(outBase.atk ?? 0) * (denseCombatValue(combatValues, "atkPct") + denseCombatValue(combatValues, "atkPctBase"))
                    + densePanelValue(outPanelValues, "atk") * denseCombatValue(combatValues, "atkPctOutOfCombat")
                const def = densePanelValue(outPanelValues, "def")
                    + denseCombatValue(combatValues, "defFlat")
                    + Number(outBase.def ?? 0) * (denseCombatValue(combatValues, "defPct") + denseCombatValue(combatValues, "defPctBase"))
                    + densePanelValue(outPanelValues, "def") * denseCombatValue(combatValues, "defPctOutOfCombat")

                panelValues[PANEL_KEY_INDEX.get("hp")] = hp
                panelValues[PANEL_KEY_INDEX.get("atk")] = atk
                panelValues[PANEL_KEY_INDEX.get("def")] = def
                panelValues[PANEL_KEY_INDEX.get("critRate")] = densePanelValue(outPanelValues, "critRate")
                    + denseCombatValue(combatValues, "critRate")
                panelValues[PANEL_KEY_INDEX.get("critDmg")] = densePanelValue(outPanelValues, "critDmg")
                    + denseCombatValue(combatValues, "critDmg")
                panelValues[PANEL_KEY_INDEX.get("impact")] = (densePanelValue(outPanelValues, "impact") * (1 + denseCombatValue(combatValues, "impactPct")))
                    + denseCombatValue(combatValues, "impactFlat")
                panelValues[PANEL_KEY_INDEX.get("anomalyProficiency")] = densePanelValue(outPanelValues, "anomalyProficiency")
                    + denseCombatValue(combatValues, "anomalyProficiencyFlat")
                panelValues[PANEL_KEY_INDEX.get("anomalyMastery")] = densePanelValue(outPanelValues, "anomalyMastery")
                    + denseCombatValue(combatValues, "anomalyMasteryFlat")
                panelValues[PANEL_KEY_INDEX.get("energyRegen")] = densePanelValue(outPanelValues, "energyRegen")
                    * (1 + denseCombatValue(combatValues, "energyRegenPct"))
                panelValues[PANEL_KEY_INDEX.get("penFlat")] = densePanelValue(outPanelValues, "penFlat")
                    + denseCombatValue(combatValues, "penFlat")
                panelValues[PANEL_KEY_INDEX.get("penRatio")] = densePanelValue(outPanelValues, "penRatio")
                    + denseCombatValue(combatValues, "penRatio")
                for (const key of RES_IGNORE_KEYS) {
                    panelValues[PANEL_KEY_INDEX.get(key)] = densePanelValue(outPanelValues, key) + denseCombatValue(combatValues, key)
                }
                panelValues[PANEL_KEY_INDEX.get("dmgBonus")] = densePanelValue(outPanelValues, "dmgBonus")
                    + denseCombatValue(combatValues, "dmgBonus")
                for (const element of DAMAGE_ELEMENTS) {
                    const key = `${element}Dmg`
                    panelValues[PANEL_KEY_INDEX.get(key)] = densePanelValue(outPanelValues, key)
                        + denseCombatValue(combatValues, key)
                }
                panelValues[PANEL_KEY_INDEX.get("sheerForceFlat")] = isRupture
                    ? densePanelValue(outPanelValues, "sheerForceFlat") + denseCombatValue(combatValues, "sheerForceFlat")
                    : 0
                panelValues[PANEL_KEY_INDEX.get("sheerForce")] = isRupture
                    ? Math.max(0, (hp * SHEER_FORCE_HP_RATIO) + (atk * SHEER_FORCE_ATK_RATIO) + panelValues[PANEL_KEY_INDEX.get("sheerForceFlat")])
                    : 0

                for (const key of OUTPUT_PANEL_KEYS) {
                    panel[key] = panelValues[PANEL_KEY_INDEX.get(key)] ?? 0
                }
                result.selectedDmgBonus = densePanelValue(panelValues, "dmgBonus")
                    + densePanelValue(panelValues, selectedAttributeBonusKey)
                result.finalDamage = calculateCompiledDamageScoreValueDense({
                    agent,
                    panelValues,
                    combatValues,
                    compiledDamageTarget,
                    eventModifierEntries,
                    activeEntryFlags,
                    modifierSums,
                })
                return result
            },
        }
    }

    function scoreOnlyFromPreparedSummary(outOfCombat, { setCounts = new Map(), getSetCount = null, useCompiledDamage = true } = {}) {
        const bonusTotals = createCombatBonusTotals()
        const activeEffects = null
        const ignoredEffects = null
        const readSetCount = typeof getSetCount === "function"
            ? getSetCount
            : setId => setCounts.get(setId) ?? 0
        const activeBuffModifiers = collectActiveBuffModifiers({
            activeCatalogBuffs,
            activeAgentBuffs,
            activeCurrentWEngineEntries,
            activeTeamWEngineEntries,
            activeDriveDisc4pcIds,
            teammateDriveDiscSetIds,
            driveDiscSets,
            setCounts,
            getSetCount: readSetCount,
            currentWEngineRequirement,
            agent,
        })

        for (const buff of activeCatalogBuffs) {
            applyCombatEffect({
                bonusTotals,
                effect: buff,
                key: buff.id,
                name: buff.name,
                sourceType: buff.sourceType ?? "manual",
                conditionLabel: buff.conditionLabel,
                outOfCombat,
                runtimeInput: runtimeInputs[buff.id],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        for (const entry of activeAgentBuffs) {
            applyCombatEffect({
                bonusTotals,
                effect: entry.buff,
                key: entry.id,
                name: entry.buff.name,
                sourceType: "self",
                conditionLabel: entry.buff.conditionLabel,
                outOfCombat,
                runtimeInput: runtimeInputs[entry.id],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        for (const entry of activeCurrentWEngineEntries) {
            if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
                continue
            }

            applyCombatEffect({
                bonusTotals,
                effect: entry.effect,
                key: entry.key,
                name: entry.effect.name ?? entry.name,
                sourceType: entry.sourceType,
                conditionLabel: entry.conditionLabel,
                outOfCombat,
                runtimeInput: runtimeInputs[entry.key],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        for (const entry of activeTeamWEngineEntries) {
            applyCombatEffect({
                bonusTotals,
                effect: entry.teamBuff,
                key: entry.key,
                name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine.name,
                sourceType: "wEngineTeam",
                conditionLabel: entry.teamBuff?.condition,
                outOfCombat,
                runtimeInput: runtimeInputs[entry.key],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        for (const activeId of activeDriveDisc4pcIds) {
            const rawKey = String(activeId).slice("driveDisc4pc:".length)
            const [setId, part = "self"] = rawKey.split(".")
            const set = driveDiscSets.get(setId)
            const count = readSetCount(setId)
            if (!set || count < 4) {
                continue
            }

            const effect = part === "team"
                ? driveDiscFourPieceTeamBuff(set)
                : driveDiscFourPieceSelfBuff(set)
            applyCombatEffect({
                bonusTotals,
                effect,
                key: activeId,
                name: set.name,
                sourceType: part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc",
                conditionLabel: effect?.condition,
                outOfCombat,
                runtimeInput: runtimeInputs[activeId],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        teammateDriveDiscSetIds.forEach((setId, index) => {
            if (!setId) {
                return
            }

            const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
            const set = driveDiscSets.get(setId)
            if (!set) {
                return
            }

            const teamBuff = driveDiscFourPieceTeamBuff(set)
            applyCombatEffect({
                bonusTotals,
                effect: teamBuff,
                key,
                name: set.name,
                sourceType: "driveDisc4pcTeam",
                conditionLabel: teamBuff?.condition,
                outOfCombat,
                runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        })

        for (const entry of activeManualEntries) {
            applyCombatEffect({
                bonusTotals,
                effect: entry.effect,
                key: entry.key,
                name: entry.name,
                sourceType: "manual",
                conditionLabel: null,
                outOfCombat,
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }
        for (const entry of activeManualEffectEntries) {
            applyCombatEffect({
                bonusTotals,
                effect: entry.effect,
                key: entry.key,
                name: entry.name,
                sourceType: "manual",
                conditionLabel: null,
                outOfCombat,
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
        return {
            panel: inCombatPanel.panel,
            selectedDmgBonus: inCombatPanel.selectedDmgBonus,
            finalDamage: useCompiledDamage
                ? calculateCompiledDamageScoreValue({
                    agent,
                    panel: inCombatPanel.panel,
                    bonusTotals,
                    compiledDamageTarget,
                })
                : calculateDamageTotalFinalValue({
                    agent,
                    panel: inCombatPanel.panel,
                    bonusTotals,
                    damageRequest: normalizedDamageInput,
                }),
        }
    }

    return {
        compiledScoreOnly: true,
        compileDensePanelScoreTarget,
        calculate(driveDiscs = [], options = {}) {
            const outOfCombat = outOfCombatCalculator.calculate(driveDiscs, { round: false })
            const bonusTotals = createCombatBonusTotals()
            const activeEffects = []
            const ignoredEffects = []
            const setCounts = new Map()
            for (const disc of driveDiscs) {
                if (!disc.setId) {
                    continue
                }

                setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
            }

            const activeBuffModifiers = collectActiveBuffModifiers({
                activeCatalogBuffs,
                activeAgentBuffs,
                activeCurrentWEngineEntries,
                activeTeamWEngineEntries,
                activeDriveDisc4pcIds,
                teammateDriveDiscSetIds,
                driveDiscSets,
                setCounts,
                currentWEngineRequirement,
                agent,
            })

            for (const buff of activeCatalogBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: buff,
                    key: buff.id,
                    name: buff.name,
                    sourceType: buff.sourceType ?? "manual",
                    conditionLabel: buff.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[buff.id],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeAgentBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.buff,
                    key: entry.id,
                    name: entry.name,
                    sourceType: "self",
                    conditionLabel: entry.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.id],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeCurrentWEngineEntries) {
                if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
                    ignoredEffects.push({
                        key: entry.key,
                        sourceType: entry.sourceType,
                        reason: "specialtyMismatch",
                    })
                    continue
                }

                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.effect.name ?? entry.name,
                    sourceType: entry.sourceType,
                    conditionLabel: entry.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeTeamWEngineEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.teamBuff,
                    key: entry.key,
                    name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine.name,
                    sourceType: "wEngineTeam",
                    conditionLabel: entry.teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const activeId of activeDriveDisc4pcIds) {
                const rawKey = String(activeId).slice("driveDisc4pc:".length)
                const [setId, part = "self"] = rawKey.split(".")
                const set = driveDiscSets.get(setId)
                const count = setCounts.get(setId) ?? 0
                const effect = part === "team"
                    ? driveDiscFourPieceTeamBuff(set)
                    : driveDiscFourPieceSelfBuff(set)
                const sourceType = part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc"

                if (!set) {
                    ignoredEffects.push({
                        key: activeId,
                        sourceType,
                        reason: "missingSet",
                    })
                    continue
                }

                if (count < 4) {
                    ignoredEffects.push({
                        key: activeId,
                        sourceType,
                        reason: "notEquipped4pc",
                    })
                    continue
                }

                applyCombatEffect({
                    bonusTotals,
                    effect,
                    key: activeId,
                    name: set.name,
                    sourceType,
                    conditionLabel: effect?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[activeId],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            teammateDriveDiscSetIds.forEach((setId, index) => {
                if (!setId) {
                    return
                }

                const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
                const set = driveDiscSets.get(setId)
                if (!set) {
                    ignoredEffects.push({
                        key,
                        sourceType: "driveDisc4pcTeam",
                        reason: "missingSet",
                    })
                    return
                }

                const teamBuff = driveDiscFourPieceTeamBuff(set)
                applyCombatEffect({
                    bonusTotals,
                    effect: teamBuff,
                    key,
                    name: set.name,
                    sourceType: "driveDisc4pcTeam",
                    conditionLabel: teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            })

            for (const entry of activeManualEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.name,
                    sourceType: "manual",
                    conditionLabel: null,
                    outOfCombat,
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }
            for (const entry of activeManualEffectEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.name,
                    sourceType: "manual",
                    conditionLabel: null,
                    outOfCombat,
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
            const flatFromPct = combatFlatFromPct(bonusTotals, outOfCombat)
            const damage = calculateDamageWhiteBox({
                catalog,
                agent,
                panel: inCombatPanel.panel,
                selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                bonusTotals,
                input: input.damage,
                skillOptions: { coreSkillLevel: input.coreSkillLevel },
            })

            const result = {
                outOfCombat,
                inCombat: {
                    panel: inCombatPanel.panel,
                    selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                    buffTotals: bonusTotals,
                    activeEffects,
                    ignoredEffects,
                    breakdown: {
                        flatFromPct,
                        ...inCombatAtkBreakdown(outOfCombat, bonusTotals, inCombatPanel.panel),
                        basis: {
                            base: outOfCombat.base,
                            outOfCombatPanel: outOfCombat.panel,
                        },
                    },
                },
                damage,
            }

            return options.round === false ? result : roundNumbers(result)
        },
        scoreOnlyFromSummary(statTotals = new Map(), setCounts = new Map()) {
            const outOfCombat = outOfCombatCalculator.calculateFromSummary(statTotals, setCounts, { round: false, scoreOnly: true })
            return scoreOnlyFromPreparedSummary(outOfCombat, { setCounts })
        },
        scoreOnlyFromSummaryLegacy(statTotals = new Map(), setCounts = new Map()) {
            const outOfCombat = outOfCombatCalculator.calculateFromSummary(statTotals, setCounts, { round: false, scoreOnly: true })
            return scoreOnlyFromPreparedSummary(outOfCombat, { setCounts, useCompiledDamage: false })
        },
        scoreOnlyFromIndexedSummary(statValues = [], statIds = [], setCountValues = [], setIds = [], setIndexById = null) {
            const outOfCombat = outOfCombatCalculator.calculateFromIndexedSummary(
                statValues,
                statIds,
                setCountValues,
                setIds,
                setIndexById,
                { round: false, scoreOnly: true },
            )
            return scoreOnlyFromPreparedSummary(outOfCombat, {
                getSetCount: indexedSetCountGetter(setCountValues, setIds, setIndexById),
            })
        },
        scoreFromSummary(statTotals = new Map(), setCounts = new Map()) {
            return this.scoreOnlyFromSummary(statTotals, setCounts)
        },
    }
}

export function calculateInCombatPanel(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const rawWEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!rawWEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }
    const wEngine = materializeWEngineForModificationLevel(rawWEngine, input.wEngineModificationLevel)

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []
    const combatInput = input.combatBuffs ?? input.combat ?? {}
    const activeBuffIds = new Set(Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []
    const manualEffects = Array.isArray(combatInput.manualEffects) ? combatInput.manualEffects : []
    const runtimeInputs = combatInput.runtimeInputs && typeof combatInput.runtimeInputs === "object"
        ? combatInput.runtimeInputs
        : {}
    const wEngineTeamModificationLevels = wEngineTeamModificationLevelMap(combatInput)

    const outOfCombat = calculateOutOfCombatPanel(catalog, input)
    const bonusTotals = createCombatBonusTotals()
    const activeEffects = []
    const ignoredEffects = []
    const activeCatalogBuffs = (catalog.combatBuffs ?? []).filter(buff => activeBuffIds.has(buff.id))
    const activeAgentBuffs = agentCombatBuffEntries(agent).filter(entry => activeBuffIds.has(entry.id))
    const currentWEngineRequirement = wEngineEffectData(wEngine)?.requirement?.specialty ?? wEngine.specialty
    const activeCurrentWEngineEntries = wEngineCombatBuffEntries(wEngine).filter(entry => activeBuffIds.has(entry.key))
    const appliedWEngineKeys = new Set(activeCurrentWEngineEntries.map(entry => entry.key))
    // External team W-Engine Buffs represent another wearer that has already met its specialty/trigger requirements.
    const activeTeamWEngineEntries = (catalog.wEngines ?? [])
        .map(sourceWEngine => materializedTeamWEngineEntry(sourceWEngine, wEngineTeamModificationLevels))
        .filter(entry => activeBuffIds.has(entry.key) && !appliedWEngineKeys.has(entry.key))
    const activeDriveDisc4pcIds = [...activeBuffIds].filter(activeId => String(activeId).startsWith("driveDisc4pc:"))
    const setCounts = new Map()
    for (const disc of driveDiscs) {
        if (!disc.setId) {
            continue
        }

        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
    }
    const activeBuffModifiers = collectActiveBuffModifiers({
        activeCatalogBuffs,
        activeAgentBuffs,
        activeCurrentWEngineEntries,
        activeTeamWEngineEntries,
        activeDriveDisc4pcIds,
        teammateDriveDiscSetIds,
        driveDiscSets,
        setCounts,
        currentWEngineRequirement,
        agent,
    })

    for (const buff of activeCatalogBuffs) {
        applyCombatEffect({
            bonusTotals,
            effect: buff,
            key: buff.id,
            name: buff.name,
            sourceType: buff.sourceType ?? "manual",
            conditionLabel: buff.conditionLabel,
            outOfCombat,
            runtimeInput: runtimeInputs[buff.id],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    for (const entry of activeAgentBuffs) {
        applyCombatEffect({
            bonusTotals,
            effect: entry.buff,
            key: entry.id,
            name: entry.name,
            sourceType: "self",
            conditionLabel: entry.conditionLabel,
            outOfCombat,
            runtimeInput: runtimeInputs[entry.id],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    for (const entry of activeCurrentWEngineEntries) {
        if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
            ignoredEffects.push({
                key: entry.key,
                sourceType: entry.sourceType,
                reason: "specialtyMismatch",
            })
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect: entry.effect,
            key: entry.key,
            name: entry.effect.name ?? entry.name,
            sourceType: entry.sourceType,
            conditionLabel: entry.conditionLabel,
            outOfCombat,
            runtimeInput: runtimeInputs[entry.key],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    for (const entry of activeTeamWEngineEntries) {
        applyCombatEffect({
            bonusTotals,
            effect: entry.teamBuff,
            key: entry.key,
            name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine.name,
            sourceType: "wEngineTeam",
            conditionLabel: entry.teamBuff?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[entry.key],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    for (const activeId of activeDriveDisc4pcIds) {
        const rawKey = activeId.slice("driveDisc4pc:".length)
        const [setId, part = "self"] = rawKey.split(".")
        const set = driveDiscSets.get(setId)
        const count = setCounts.get(setId) ?? 0
        const effect = part === "team"
            ? driveDiscFourPieceTeamBuff(set)
            : driveDiscFourPieceSelfBuff(set)
        const sourceType = part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc"

        if (!set) {
            ignoredEffects.push({
                key: activeId,
                sourceType,
                reason: "missingSet",
            })
            continue
        }

        if (count < 4) {
            ignoredEffects.push({
                key: activeId,
                sourceType,
                reason: "notEquipped4pc",
            })
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect,
            key: activeId,
            name: set.name,
            sourceType,
            conditionLabel: effect?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[activeId],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    teammateDriveDiscSetIds.forEach((setId, index) => {
        if (!setId) {
            return
        }

        const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
        const set = driveDiscSets.get(setId)
        if (!set) {
            ignoredEffects.push({
                key,
                sourceType: "driveDisc4pcTeam",
                reason: "missingSet",
            })
            return
        }

        const teamBuff = driveDiscFourPieceTeamBuff(set)
        applyCombatEffect({
            bonusTotals,
            effect: teamBuff,
            key,
            name: set.name,
            sourceType: "driveDisc4pcTeam",
            conditionLabel: teamBuff?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    })

    manualStats.forEach((item, index) => {
        const value = Number(item?.value ?? 0)
        if (!item?.stat || !Number.isFinite(value) || value === 0) {
            return
        }

        const key = item.id ? `manual:${item.id}` : `manual:${index + 1}`
        applyCombatEffect({
            bonusTotals,
            effect: {
                scope: "inCombat",
                condition: null,
                stats: [
                    {
                        stat: item.stat,
                        value,
                        mode: item.mode ?? "flat",
                        basis: item.basis ?? null,
                    },
                ],
            },
            key,
            name: {
                zhCN: item.label ?? "手动修正",
                en: item.label ?? "Manual Correction",
            },
            sourceType: "manual",
            conditionLabel: null,
            outOfCombat,
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    })
    manualEffects.forEach((item, index) => {
        const effects = Array.isArray(item?.effects) ? item.effects : []
        if (!effects.length) {
            return
        }

        const key = item.id ? `manualEffect:${item.id}` : `manualEffect:${index + 1}`
        applyCombatEffect({
            bonusTotals,
            effect: {
                scope: "inCombat",
                condition: null,
                effects,
            },
            key,
            name: {
                zhCN: item.label ?? item.name ?? "手动修正",
                en: item.label ?? item.name ?? "Manual Correction",
            },
            sourceType: "manual",
            conditionLabel: null,
            outOfCombat,
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    })

    const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
    const flatFromPct = combatFlatFromPct(bonusTotals, outOfCombat)
    const damage = calculateDamageWhiteBox({
        catalog,
        agent,
        panel: inCombatPanel.panel,
        selectedDmgBonus: inCombatPanel.selectedDmgBonus,
        bonusTotals,
        input: input.damage,
        skillOptions: { coreSkillLevel: input.coreSkillLevel },
    })

    return roundNumbers({
        outOfCombat,
        inCombat: {
            panel: inCombatPanel.panel,
            selectedDmgBonus: inCombatPanel.selectedDmgBonus,
            buffTotals: bonusTotals,
            activeEffects,
            ignoredEffects,
            breakdown: {
                flatFromPct,
                ...inCombatAtkBreakdown(outOfCombat, bonusTotals, inCombatPanel.panel),
                basis: {
                    base: outOfCombat.base,
                    outOfCombatPanel: outOfCombat.panel,
                },
            },
        },
        damage,
    })
}

