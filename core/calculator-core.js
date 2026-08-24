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
import { skillTagsForMove, skillTargetMatches, skillTypeForMove } from "./skillTargets.js"
import {
    disorderBaseMultiplier,
    disorderMultiplierScale,
    normalizeDamageScale,
    normalizeElapsedSeconds,
} from "./damageEventMultipliers.js"
import {
    ANOMALY_SETTLEMENT_TYPE_VALUES,
    ELEMENT_CRIT_DMG_STAT_BY_ELEMENT,
    ELEMENT_CRIT_DMG_STATS,
    ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT,
    ELEMENT_DEF_IGNORE_STATS,
} from "./effectRuleTargets.js"
import {
    corePassiveScalingRow,
    materializeCorePassiveScalingEffect,
} from "./corePassiveScaling.js"
import {
    materializePotentialVisionEffect,
    normalizePotentialLevel,
    potentialLevelRequirementMatches,
} from "./potentialVision.js"
import {
    anomalyReleaseProfile,
    evaluateAnomalyReleaseProfile,
    evaluateAnomalyReleaseProfileInterval,
    evaluateReleaseExpression,
    evaluateReleaseExpressionInterval,
    isReleaseSettlement,
    normalizeAnomalySourceSnapshot,
    releaseFormulaStatDependencies,
} from "./anomalyRelease.js"
import {
    evaluateLuminescence,
    isLuminescenceSettlement,
    normalizeLuminescenceEvent,
} from "./luminescence.js"
import {
    normalizedRuntimeParameterValue,
    runtimeParameterDefaults,
    runtimeParameterRequirementMatches,
} from "./shared-combat.js"

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
    anomalyMastery: "anomalyMasteryPct",
    anomalyMasteryFlat: "anomalyMasteryFlat",
    energyRegen: "energyRegenPct",
    energyRegenPct: "energyRegenPct",
    penFlat: "penFlat",
    penRatio: "penRatio",
    allResIgnore: "allResIgnore",
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
    anomalyProficiencyPerMasteryAbove140: "anomalyProficiencyPerMasteryAbove140",
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
    "anomalyMasteryPct",
    "anomalyMasteryFlat",
    "energyRegenPct",
    "penFlat",
    "penRatio",
    "allResIgnore",
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
    "anomalyProficiencyPerMasteryAbove140",
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
    "allResIgnore",
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

const OPTIMIZER_INPUT_STATS_BY_PANEL_STAT = {
    hp: ["hpFlat", "hpPct"],
    atk: ["atkFlat", "atkPct"],
    def: ["defFlat", "defPct"],
    critRate: ["critRate"],
    critDmg: ["critDmg"],
    impact: ["impact", "impactPct", "impactFlat"],
    anomalyProficiency: ["anomalyProficiency", "anomalyProficiencyFlat"],
    anomalyMastery: ["anomalyMastery", "anomalyMasteryFlat"],
    energyRegen: ["energyRegen", "energyRegenPct"],
    penFlat: ["penFlat"],
    penRatio: ["penRatio"],
    allResIgnore: ["allResIgnore"],
    physicalResIgnore: ["physicalResIgnore"],
    fireResIgnore: ["fireResIgnore"],
    iceResIgnore: ["iceResIgnore"],
    electricResIgnore: ["electricResIgnore"],
    etherResIgnore: ["etherResIgnore"],
    windResIgnore: ["windResIgnore"],
    dmgBonus: ["dmgBonus"],
    physicalDmg: ["physicalDmg"],
    fireDmg: ["fireDmg"],
    iceDmg: ["iceDmg"],
    electricDmg: ["electricDmg"],
    etherDmg: ["etherDmg"],
    windDmg: ["windDmg"],
    sheerForce: ["hpFlat", "hpPct", "atkFlat", "atkPct", "sheerForceFlat"],
    sheerForceFlat: ["sheerForceFlat"],
}

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
const BONUS_KEY_LOOKUP = Object.freeze(Object.fromEntries(BONUS_KEY_INDEX))
const COMBAT_BONUS_KEY_LOOKUP = Object.freeze(Object.fromEntries(COMBAT_BONUS_KEY_INDEX))
const PANEL_KEY_LOOKUP = Object.freeze(Object.fromEntries(PANEL_KEY_INDEX))

const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
const LUMIFLUX_DAMAGE_ELEMENT = "lumiflux"
const DIRECT_DAMAGE_ELEMENTS = new Set([...DAMAGE_ELEMENTS, LUMIFLUX_DAMAGE_ELEMENT])
const DAMAGE_ELEMENT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
    wind: "风",
    lumiflux: "流明",
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
const ALL_RES_IGNORE_KEY = "allResIgnore"
const RES_IGNORE_KEYS = [ALL_RES_IGNORE_KEY, ...Object.values(RES_IGNORE_KEY_BY_ELEMENT)]

const SHEER_DMG_KEY_BY_ELEMENT = {
    physical: "physicalSheerDmg",
    fire: "fireSheerDmg",
    ice: "iceSheerDmg",
    electric: "electricSheerDmg",
    ether: "etherSheerDmg",
    wind: "windSheerDmg",
}

const CRIT_DMG_KEY_BY_ELEMENT = ELEMENT_CRIT_DMG_STAT_BY_ELEMENT
const DEF_IGNORE_KEY_BY_ELEMENT = ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT

const DAMAGE_EVENT_KINDS = ["direct", "anomaly", "disorder", "sheer"]
const DISORDER_TYPE_VALUES = new Set(["normal", "polarized"])
// Kept in the accepted data vocabulary for old saved effects, but this legacy
// modifier is intentionally ignored by every calculation path.
const IGNORED_DAMAGE_MODIFIER_KINDS = new Set(["enemyDamageTakenBonus"])
const DAMAGE_MODIFIER_KINDS = ["enemyDamageTakenBonus", "anomalyDamageBonus", "disorderDamageBonus", "alienationCoefficientBonus", "baseMultiplierBonus", "disorderBaseMultiplierBonus", "anomalyCritRate", "anomalyCritDmg", "anomalyCritRatePerInitialMasteryAbove100", "anomalyDurationBonusSeconds", "stunDmgMultiplierBonus", "stunDmgMultiplierBonusAlways", "stunDmgMultiplierBonusCapAlways", "directDamageBonus", "sheerDmgBonus", "physicalSheerDmg", "fireSheerDmg", "iceSheerDmg", "electricSheerDmg", "etherSheerDmg", "windSheerDmg", "skillMultiplierBonus", ...ELEMENT_CRIT_DMG_STATS, ...ELEMENT_DEF_IGNORE_STATS]
const EVENT_MODIFIER_STAT_KEYS = new Set([
    "enemyDamageTakenBonus",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "alienationCoefficientBonus",
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "anomalyCritRatePerInitialMasteryAbove100",
    "anomalyDurationBonusSeconds",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "stunDmgMultiplierBonusCapAlways",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "skillMultiplierBonus",
    ...ELEMENT_CRIT_DMG_STATS,
    ...ELEMENT_DEF_IGNORE_STATS,
])
const SKILL_TARGET_STAT_KEYS = new Set([
    "penRatio",
    "allResIgnore",
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
    "critDmg",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "stunDmgMultiplierBonusCapAlways",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "skillMultiplierBonus",
    ...ELEMENT_CRIT_DMG_STATS,
    ...ELEMENT_DEF_IGNORE_STATS,
])
const EVENT_MODIFIER_KIND_VALUES = new Set([
    ...DAMAGE_MODIFIER_KINDS,
    ...EVENT_MODIFIER_STAT_KEYS,
    ...SKILL_TARGET_STAT_KEYS,
])
const TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY = "teamAnomalyDamageBonus"
const DAMAGE_MODIFIER_SUM_KEYS = [...EVENT_MODIFIER_KIND_VALUES, TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY]
const DAMAGE_MODIFIER_SUM_KEY_INDEX = new Map(DAMAGE_MODIFIER_SUM_KEYS.map((key, index) => [key, index]))
const DAMAGE_MODIFIER_SUM_KEY_LOOKUP = Object.freeze(Object.fromEntries(DAMAGE_MODIFIER_SUM_KEY_INDEX))

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
    "allResIgnore",
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
    "enemyDamageTakenBonus",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "alienationCoefficientBonus",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    ...ELEMENT_CRIT_DMG_STATS,
    ...ELEMENT_DEF_IGNORE_STATS,
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "stunDmgMultiplierBonusCapAlways",
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
    "allResIgnore",
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

function calculateAnomalyMastery(baseAnomalyMastery, anomalyMasteryPct = 0, anomalyMasteryFlat = 0) {
    return Number(baseAnomalyMastery ?? 0) * (1 + Number(anomalyMasteryPct ?? 0))
        + Number(anomalyMasteryFlat ?? 0)
}

const ANOMALY_MASTERY_PROFICIENCY_THRESHOLD = 140
const INITIAL_ANOMALY_MASTERY_CRIT_THRESHOLD = 100

function calculateMasteryConvertedProficiency(anomalyMastery, proficiencyPerPoint = 0) {
    const wholeMastery = Math.floor(Math.max(0, Number(anomalyMastery ?? 0)))
    const masteryAboveThreshold = Math.max(0, wholeMastery - ANOMALY_MASTERY_PROFICIENCY_THRESHOLD)
    return Math.floor(masteryAboveThreshold * Math.max(0, Number(proficiencyPerPoint ?? 0)))
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

function normalizeWEngineBuffKey(catalog, key) {
    const match = /^wEngine:([^.]+)\.(self|team)$/.exec(String(key ?? ""))
    if (!match) {
        return key
    }
    const wEngine = catalog.wEnginesMap?.get(match[1])
        ?? catalog.wEngines?.find(item => item.id === match[1] || (item.legacyIds ?? []).includes(match[1]))
    return wEngine ? `wEngine:${wEngine.id}.${match[2]}` : key
}

function normalizeWEngineKeyedRecord(catalog, value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {}
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [normalizeWEngineBuffKey(catalog, key), entry]))
}

function wEngineTeamModificationLevelMap(catalog, combatInput = {}) {
    return normalizeWEngineKeyedRecord(catalog, combatInput.wEngineTeamModificationLevels)
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

function coverageConfigForRule(rule, effect) {
    return rule?.coverage ?? effect?.coverage ?? null
}

function defaultCoverage(rule, effect) {
    const coverage = coverageConfigForRule(rule, effect)
    if (!coverage) {
        return 1
    }
    return clampNumber(coverage.default ?? 1, coverage.min ?? 0, coverage.max ?? 1)
}

function coverageFromRuntime(rule, effect, runtimeInput = {}) {
    const coverage = coverageConfigForRule(rule, effect)
    if (!coverage) {
        return 1
    }
    const ruleRuntime = effectRuntimeFor(rule, runtimeInput)
    return clampNumber(
        ruleRuntime.coverage ?? runtimeInput.coverage ?? defaultCoverage(rule, effect),
        coverage.min ?? 0,
        coverage.max ?? 1,
    )
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
    const effects = {}
    for (const rule of rules) {
        const id = rule.id ?? rule.stat ?? "effect"
        const legacyRuleRuntime = input[id] && typeof input[id] === "object" ? input[id] : {}
        const nestedRuleRuntime = input.effects?.[id] && typeof input.effects[id] === "object" ? input.effects[id] : {}
        const ruleRuntime = {
            ...legacyRuleRuntime,
            ...nestedRuleRuntime,
        }
        const coverage = coverageConfigForRule(rule, effect)
        if (coverage) {
            ruleRuntime.coverage = clampNumber(
                ruleRuntime.coverage ?? input.coverage ?? coverage.default ?? 1,
                coverage.min ?? 0,
                coverage.max ?? 1,
            )
        } else {
            delete ruleRuntime.coverage
        }
        effects[id] = ruleRuntime
    }

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

    for (const ids of grouped.values()) {
        if (ids.length < 2) {
            continue
        }
        let stacks = undefined
        for (const id of ids) {
            if (effects[id]?.stacks !== undefined) {
                stacks = effects[id].stacks
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
    const { coverage, ...rest } = input
    return { ...rest, effects }
}

function effectRuleEnabled(rule, runtimeInput = {}) {
    return effectRuntimeFor(rule, runtimeInput).enabled !== false
        && runtimeParameterRequirementMatches(rule, runtimeInput)
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
    if (target.kind === "anomaly") {
        const settlementType = ANOMALY_SETTLEMENT_TYPE_VALUES.has(target.settlementType)
            ? target.settlementType
            : "attribute"
        return {
            kind: "anomaly",
            settlementType,
            anomalyEffects: Array.isArray(target.anomalyEffects) ? target.anomalyEffects : [],
            anomalyVariants: Array.isArray(target.anomalyVariants) ? target.anomalyVariants : [],
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
        appliesTo.settlementTypes,
        appliesTo.anomalyEffects,
        appliesTo.anomalyVariants,
        appliesTo.elements,
        appliesTo.skillTargets,
    ].some(values => Array.isArray(values) && values.length > 0)
}

function isRuleEventModifier(rule = {}) {
    if ((rule.type ?? "fixed") === "damageModifier") {
        return true
    }
    const stat = canonicalBuffStat(rule.stat)
    return ["skill", "anomaly"].includes(ruleTargetKind(rule))
        || Object.prototype.hasOwnProperty.call(rule?.requirement ?? {}, "eventStunned")
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
    if (stat === "anomalyDurationBonusSeconds") {
        return value
    }
    if (EVENT_MODIFIER_STAT_KEYS.has(stat)) {
        return value / 100
    }
    return toCalcValue(stat, value, rule.mode)
}

function outOfCombatStatRequirement(requirement = {}) {
    const config = requirement?.outOfCombatStat
    const stat = String(config?.stat ?? "").trim()
    if (!stat) {
        return null
    }
    const optionalFinite = value => {
        if (value === undefined || value === null || value === "") return null
        return Number.isFinite(Number(value)) ? Number(value) : null
    }
    return {
        stat,
        min: optionalFinite(config.min),
        max: optionalFinite(config.max),
    }
}

function outOfCombatStatRequirementMatches(requirement = {}, panel = null) {
    const config = outOfCombatStatRequirement(requirement)
    if (!config) {
        return true
    }
    if (!panel) {
        return false
    }
    const value = Number(panel[config.stat])
    return Number.isFinite(value)
        && (config.min === null || value >= config.min)
        && (config.max === null || value <= config.max)
}

function hasOutOfCombatStatRequirement(rule = {}) {
    return Boolean(outOfCombatStatRequirement(rule?.requirement))
}

function effectRuleRequirementMatches(rule = {}, modifierContext = {}) {
    const requiredSpecialty = String(rule?.requirement?.specialty ?? "").trim()
    const requiredAttribute = String(rule?.requirement?.attribute ?? "").trim()
    const excludedAgentIds = stringArray(rule?.requirement?.excludedAgentIds)
    return (!requiredSpecialty || requiredSpecialty === modifierContext.agent?.specialty)
        && (!requiredAttribute || requiredAttribute === modifierContext.agent?.attribute)
        && (!excludedAgentIds.length || !excludedAgentIds.includes(String(modifierContext.agent?.id ?? "")))
        && (
            !hasOutOfCombatStatRequirement(rule)
            || outOfCombatStatRequirementMatches(rule.requirement, modifierContext.outOfCombat?.panel)
            || modifierContext.deferOutOfCombatStatRequirements === true
        )
}

function resolveEffectRule(rule, effect, runtimeInput = {}, modifierContext = {}) {
    const type = rule.type ?? "fixed"
    const runtime = effectRuntimeFor(rule, runtimeInput)
    const coverage = coverageFromRuntime(rule, effect, runtimeInput)
    const common = {
        id: rule.id ?? rule.stat ?? type,
        label: rule.label ?? null,
        type,
        stat: canonicalBuffStat(rule.stat),
        mode: rule.mode ?? "flat",
        basis: rule.basis ?? null,
        target: normalizedRuleTarget(rule),
        coverage,
        condition: rule.condition ?? null,
        durationSeconds: rule.durationSeconds ?? null,
        cooldownSeconds: rule.cooldownSeconds ?? null,
        requirement: rule.requirement ?? null,
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
        const inputSourceValue = Number(runtime.sourceValue ?? source.defaultValue ?? rule.defaultSourceValue ?? 0)
        const rawSourceValue = source.integer === true ? Math.round(inputSourceValue) : inputSourceValue
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
        const hasActivationStacks = rule.activationStacks !== undefined
            && rule.activationStacks !== null
            && rule.activationStacks !== ""
            && Number.isFinite(Number(rule.activationStacks))
        const activationStacks = hasActivationStacks
            ? clampNumber(Number(rule.activationStacks), 0, maxStacks)
            : null
        const hasActivationValue = activationStacks !== null
            && rule.value !== undefined
            && rule.value !== null
            && rule.value !== ""
            && Number.isFinite(Number(rule.value))
        const activeValue = hasActivationValue
            ? Number(rule.value)
            : valuePerStack * stacks
        const value = (activationStacks === null || stacks >= activationStacks ? activeValue : 0) * coverage
        return applyBuffModifiersToResolvedRule({
            ...common,
            value,
            valuePerStack,
            stacks,
            maxStacks,
            defaultStacks: Number(rule.defaultStacks ?? maxStacks),
            activationStacks,
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
        .filter(rule => effectRuleRequirementMatches(rule, modifierContext))
        .filter(rule => !isRuleEventModifier(rule))
        .map(rule => resolveEffectRule(rule, effect, runtimeInput, modifierContext))
        .filter(rule => rule.stat && Number.isFinite(Number(rule.value)))
}

function resolveEffectDamageModifiers(effect, runtimeInput = {}, modifierContext = {}) {
    return effectRules(effect)
        .filter(rule => effectRuleEnabled(rule, runtimeInput))
        .filter(rule => effectRuleRequirementMatches(rule, modifierContext))
        .filter(rule => isRuleEventModifier(rule))
        .map(rule => {
            const resolved = resolveEffectRule(rule, effect, runtimeInput, modifierContext)
            if ((rule.type ?? "fixed") === "damageModifier") {
                return resolved
            }
            const target = normalizedRuleTarget(rule)
            const targetAppliesTo = target.kind === "skill"
                ? { ...(rule.appliesTo ?? {}), skillTargets: target.skillTargets }
                : target.kind === "anomaly"
                    ? {
                        ...(rule.appliesTo ?? {}),
                        damageKinds: [target.settlementType === "disorder" ? "disorder" : "anomaly"],
                        settlementTypes: [target.settlementType],
                        ...(target.anomalyEffects.length ? { anomalyEffects: target.anomalyEffects } : {}),
                        ...(target.anomalyVariants.length ? { anomalyVariants: target.anomalyVariants } : {}),
                    }
                    : rule.appliesTo ?? null
            return {
                ...resolved,
                type: "eventModifier",
                kind: resolved.stat,
                value: eventModifierCalcValue(resolved),
                appliesTo: targetAppliesTo,
            }
        })
        .filter(rule => !IGNORED_DAMAGE_MODIFIER_KINDS.has(rule.kind)
            && !IGNORED_DAMAGE_MODIFIER_KINDS.has(rule.stat))
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
        runtime: normalizedRuntimeInput,
        appliesToOutOfCombatPanel: effect.appliesToOutOfCombatPanel ?? true,
    }
}

function densePanelValue(panelValues, key) {
    const index = PANEL_KEY_LOOKUP[key]
    return index === undefined ? 0 : Number(panelValues[index] ?? 0)
}

function denseCombatValue(combatValues, key) {
    const index = COMBAT_BONUS_KEY_LOOKUP[key]
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
    agent = null,
} = {}) {
    const normalized = normalizeEffect(effect, runtimeInput, {
        sourceKey: key,
        buffModifiers,
        agent,
        deferOutOfCombatStatRequirements: true,
    })
    if (!normalized || normalized.scope !== "inCombat") {
        return null
    }
    if (missingRequiredCombatBasis(normalized.stats, sourceType)) {
        return null
    }
    const damageModifiers = normalized.damageModifiers.map(modifier => ({
        ...modifier,
        sourceKey: key,
        sourceType,
    }))
    return {
        key,
        sourceType,
        setIndex,
        minSetCount,
        exclusiveGroup: String(effect.exclusiveGroup ?? "").trim() || null,
        stats: normalized.stats,
        damageModifiers,
        hasOutOfCombatStatRequirements: [...normalized.stats, ...damageModifiers]
            .some(hasOutOfCombatStatRequirement),
    }
}

function compileDenseDamageModifierEntries(effectEntries = [], compiledEvents = []) {
    return (compiledEvents ?? []).map(compiledEvent => {
        const result = []
        effectEntries.forEach((entry, entryIndex) => {
            for (const modifier of entry.damageModifiers ?? []) {
                if (IGNORED_DAMAGE_MODIFIER_KINDS.has(modifier?.kind)) {
                    continue
                }
                if (!damageModifierAppliesToCompiledEvent(modifier, compiledEvent.event)) {
                    continue
                }
                const kindIndex = DAMAGE_MODIFIER_SUM_KEY_INDEX.get(modifier.kind)
                if (kindIndex !== undefined) {
                    result.push({
                        entryIndex,
                        kindIndex,
                        value: modifierValueForEvent(modifier, compiledEvent.event),
                        requirement: modifier.requirement ?? null,
                    })
                }
                if (isTeamAnomalyDamageModifier(modifier)) {
                    result.push({
                        entryIndex,
                        kindIndex: DAMAGE_MODIFIER_SUM_KEY_INDEX.get(TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY),
                        value: modifierValueForEvent(modifier, compiledEvent.event),
                        requirement: modifier.requirement ?? null,
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
        baseDurationSeconds: Math.max(0, Number(effect.baseDurationSeconds ?? 0)),
        tickIntervalSeconds: Math.max(0, Number(effect.tickIntervalSeconds ?? 0)),
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
    for (const item of catalog.wEngines ?? []) {
        for (const legacyId of item.legacyIds ?? []) {
            if (legacyId && !wEngines.has(legacyId)) {
                wEngines.set(legacyId, item)
            }
        }
    }
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
        runtimeParameters: buff.runtimeParameters ?? [],
        source: buff.source ?? sourceLabel,
        sourceLabel,
        name: buff.name ?? nameWithSource(teammate.name, sourceLabel),
        description,
        conditionLabel: buff.conditionLabel ?? description,
        scope: buff.scope ?? "inCombat",
    }
}

const RELEASE_SOURCE_INHERITED_MODIFIER_KINDS = new Set([
    "anomalyDamageBonus",
    "enemyDefReduction",
    ...ELEMENT_DEF_IGNORE_STATS,
])

function damageModifierAppliesToCompiledEvent(modifier, event) {
    if (damageModifierAppliesTo(modifier, event)) return true
    if (!isReleaseSettlement(event) || !RELEASE_SOURCE_INHERITED_MODIFIER_KINDS.has(modifier?.kind)) {
        return false
    }
    return damageModifierAppliesTo(modifier, {
        ...event,
        settlementType: "attribute",
        anomalyVariant: "normal",
    })
}

function combatBuffRuntimeInput(buff = {}, runtimeInputs = {}) {
    const ownRuntime = runtimeInputs?.[buff.id] ?? {}
    const legacyGroupRuntime = buff.teammateId
        ? runtimeInputs?.[`teammate:${buff.teammateId}`] ?? {}
        : {}
    const rawParameters = {
        ...runtimeParameterDefaults(buff),
        ...(legacyGroupRuntime?.parameters ?? {}),
        ...(ownRuntime?.parameters ?? {}),
    }
    const parameters = Object.fromEntries((buff.runtimeParameters ?? []).flatMap(definition => {
        const id = String(definition?.id ?? "").trim()
        if (!id) return []
        return [[id, normalizedRuntimeParameterValue(definition, rawParameters[id])]]
    }))
    return {
        ...ownRuntime,
        ...(Object.keys(parameters).length ? { parameters } : {}),
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

function driveDiscTwoPieceCombatBuff(set) {
    const twoPiece = set?.twoPiece ?? null
    const effects = effectRules(twoPiece).filter(isRuleEventModifier)
    return effects.length
        ? {
            ...twoPiece,
            scope: "inCombat",
            appliesToOutOfCombatPanel: false,
            effects,
        }
        : null
}

function driveDisc2pcKey(setId) {
    return `driveDisc2pc:${setId}`
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

function agentCombatBuffEntries(agent, coreSkillLevel, potentialLevel) {
    const combatBuffs = agent?.combatBuffs ?? {}
    const fixedEntries = [
        ["corePassive", combatBuffs.corePassive],
        ["additionalAbility", combatBuffs.additionalAbility],
    ]
        .filter(([, buff]) => buff)
        .map(([key, buff]) => {
            const coreMaterializedBuff = key === "corePassive"
                ? materializeCorePassiveScalingEffect(buff, agent, coreSkillLevel)
                : buff
            const materializedBuff = materializePotentialVisionEffect(
                coreMaterializedBuff,
                agent,
                potentialLevel,
            )
            return {
                id: `agent:${agent.id}.${key}`,
                key,
                buff: materializedBuff,
                name: materializedBuff.name,
                conditionLabel: materializedBuff.conditionLabel,
            }
        })
    const skillEntries = (Array.isArray(combatBuffs.skillBuffs) ? combatBuffs.skillBuffs : [])
        .filter(buff => buff)
        .map(buff => ({
            id: `agent:${agent.id}.skill.${buff.id}`,
            key: `skill.${buff.id}`,
            buff,
            name: buff.name,
            conditionLabel: buff.conditionLabel ?? buff.description ?? null,
        }))
    const cinemaEntries = (combatBuffs.cinemaBuffs ?? [])
        .filter(buff => buff)
        .map(buff => {
            const materializedBuff = materializePotentialVisionEffect(buff, agent, potentialLevel)
            return {
                id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
                key: `cinema.${buff.cinemaLevel}`,
                buff: materializedBuff,
                name: materializedBuff.name ?? cinemaBuffName(materializedBuff),
                conditionLabel: materializedBuff.conditionLabel ?? materializedBuff.description ?? null,
            }
        })
    return [...fixedEntries, ...skillEntries, ...cinemaEntries]
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

function applyCombatEffect({ bonusTotals, effect, key, name, sourceType, conditionLabel, outOfCombat, runtimeInput, buffModifiers, activeEffects, ignoredEffects, agent, exclusiveGroups }) {
    const exclusiveGroup = String(effect?.exclusiveGroup ?? "").trim()
    if (exclusiveGroup && exclusiveGroups?.has(exclusiveGroup)) {
        ignoredEffects?.push({ key, sourceType, reason: "exclusiveGroup", exclusiveGroup })
        return
    }
    const normalized = normalizeEffect(effect, runtimeInput, {
        sourceKey: key,
        buffModifiers,
        agent,
        outOfCombat,
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
    const resolvedDamageModifiers = normalized.damageModifiers.map(modifier => ({
        ...modifier,
        sourceKey: key,
        sourceType,
    }))
    bonusTotals.damageModifiers.push(...resolvedDamageModifiers)
    if (exclusiveGroup) {
        exclusiveGroups?.add(exclusiveGroup)
    }

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
        runtime: normalized.runtime,
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
    const index = keyIndex === BONUS_KEY_INDEX ? BONUS_KEY_LOOKUP[key] : keyIndex.get(key)
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
    panel.anomalyMastery = calculateAnomalyMastery(
        outOfCombat.panel.anomalyMastery,
        bonusTotals.anomalyMasteryPct,
        bonusTotals.anomalyMasteryFlat,
    )
    panel.anomalyProficiency = outOfCombat.panel.anomalyProficiency
        + bonusTotals.anomalyProficiencyFlat
        + calculateMasteryConvertedProficiency(
            panel.anomalyMastery,
            bonusTotals.anomalyProficiencyPerMasteryAbove140,
        )
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

    if (DAMAGE_ELEMENTS.includes(damageElement) && resistanceByElement[damageElement] === undefined) {
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

function normalizeEventStunned(value, fallback = true) {
    return value === undefined ? fallback : normalizeStunned(value)
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
    const potentialLevel = normalizePotentialLevel(agent, options.potentialLevel)
    for (const [kind, value] of [["category", category], ["move", move], ["row", row]]) {
        if (!potentialLevelRequirementMatches(value, potentialLevel)) {
            throw new Error(
                `Skill ${kind} requires potential P${value.requiresPotentialLevel}: ${skillSet.id}.${categoryId}.${moveId}.${rowId} (current P${potentialLevel})`,
            )
        }
    }

    const isCoreSkillLevel = isCoreSkillLevelScale(category)
    const defaultLevel = defaultLevelForSkill(category, move, row)
    const currentLevel = isCoreSkillLevel
        ? options.coreSkillLevel
        : options.skillLevelsByCategory?.[categoryId]
    const rawRequestedLevel = currentLevel
        ?? skillRef.level
        ?? defaultLevel
    const requestedLevel = isCoreSkillLevel
        ? (String(rawRequestedLevel ?? "").trim() === "" || rawRequestedLevel === "none" ? "0" : String(rawRequestedLevel).trim())
        : Number(rawRequestedLevel)
    if (!isValidSkillLevel(category, move, row, requestedLevel)) {
        throw new Error(`Skill level out of range for ${skillSet.id}.${categoryId}.${moveId}.${rowId}: ${rawRequestedLevel}`)
    }

    const value = skillRowValue(category, move, row, requestedLevel)
    if (!Number.isFinite(value)) {
        throw new Error(`Missing skill multiplier for ${skillSet.id}.${categoryId}.${moveId}.${rowId} level ${requestedLevel}`)
    }

    const skillType = skillTypeForMove(category, move)
    if (!skillType) {
        throw new Error(`Skill move has invalid skillType: ${skillSet.id}.${categoryId}.${moveId}`)
    }

    const skillSourceForRow = resolvedRow => {
        const sourceLabelParts = [
            localizedName(category.name, category.id),
            localizedName(move.name, move.id),
            localizedName(resolvedRow.label, resolvedRow.id),
        ].filter(Boolean)
        return {
            agentSkillId: skillSet.id,
            categoryId,
            moveId,
            rowId: resolvedRow.id,
            skillType,
            skillTags: skillTagsForMove(move),
            generatedFromRowIds: Array.isArray(resolvedRow.generatedFromRowIds) ? resolvedRow.generatedFromRowIds : [],
            level: requestedLevel,
            levelScale: skillLevelScale(category),
            levelLabel: skillLevelLabel(category, requestedLevel),
            damageBasis: resolvedRow.damageBasis ?? "atk",
            damageElement: DIRECT_DAMAGE_ELEMENTS.has(move.damageElement) ? move.damageElement : null,
            categoryName: category.name,
            moveName: move.name,
            rowLabel: resolvedRow.label,
            label: sourceLabelParts.join(" / "),
            eventCountRange: normalizeSkillEventCountRange(resolvedRow.eventCountRange, {
                label: `${skillSet.id}.${categoryId}.${moveId}.${resolvedRow.id}`,
            }),
        }
    }
    const generatedSkillComponents = (Array.isArray(row.generatedFromRowIds) ? row.generatedFromRowIds : [])
        .map(componentRowId => (move.rows ?? []).find(item => item.id === componentRowId))
        .filter(Boolean)
        .map(componentRow => {
            const componentValue = skillRowValue(category, move, componentRow, requestedLevel)
            if (!Number.isFinite(componentValue)) {
                throw new Error(`Missing generated skill component for ${skillSet.id}.${categoryId}.${moveId}.${componentRow.id} level ${requestedLevel}`)
            }
            return {
                skillMultiplier: Math.max(0, componentValue / 100),
                skillPercent: componentValue,
                skillSource: skillSourceForRow(componentRow),
            }
        })

    return {
        skillMultiplier: Math.max(0, value / 100),
        skillPercent: value,
        eventCountRange: normalizeSkillEventCountRange(row.eventCountRange, {
            label: `${skillSet.id}.${categoryId}.${moveId}.${rowId}`,
        }),
        skillSource: skillSourceForRow(row),
        generatedSkillComponents,
    }
}

function normalizeDamageTarget(input = {}, damageElement) {
    const targetInput = input.target ?? {}
    const preset = damageTargetPreset(targetInput.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID)
    const defense = Number(targetInput.defense ?? preset?.defense ?? 953)
    const levelCoefficient = DEFAULT_DAMAGE_LEVEL_COEFFICIENT
    const stunMultiplierPercent = normalizeStunMultiplierPercent(targetInput)
    const stunMultiplier = stunMultiplierPercent / 100

    return {
        presetId: targetInput.presetId ?? preset?.id ?? DEFAULT_DAMAGE_TARGET_PRESET_ID,
        defense: Number.isFinite(defense) ? Math.max(0, defense) : Number(preset?.defense ?? 953),
        levelCoefficient,
        resistanceByElement: normalizeResistanceByElement(targetInput, damageElement),
        stunMultiplier,
    }
}

function normalizeDamageCount(value, fallback = 1) {
    const numeric = Number(value ?? fallback)
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
}

function normalizeSkillEventCountRange(range, { label = "skill row" } = {}) {
    if (range === undefined || range === null) {
        return null
    }
    if (!range || typeof range !== "object" || Array.isArray(range)) {
        throw new Error(`Invalid event count range for ${label}`)
    }
    const min = Number(range.min ?? 0)
    const max = Number(range.max)
    const defaultCount = Number(range.default ?? min)
    if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(defaultCount)
        || min < 0 || max < min || defaultCount < min || defaultCount > max) {
        throw new Error(`Invalid event count range for ${label}`)
    }
    return { min, max, default: defaultCount }
}

function normalizeSkillEventCount(value, range, fallback = 1, label = "skill event") {
    if (!range) {
        return normalizeDamageCount(value, fallback)
    }
    const count = value === undefined || value === null || value === ""
        ? range.default
        : Number(value)
    if (!Number.isInteger(count) || count < range.min || count > range.max) {
        throw new Error(`Event count out of range for ${label}: ${value} (expected ${range.min}..${range.max})`)
    }
    return count
}

function bossAppearanceLabel(appearance = {}) {
    const version = String(appearance.gameVersion ?? "").trim()
    const phaseNo = Number(appearance.phaseNo)
    if (!version && !Number.isFinite(phaseNo)) {
        return "敌情规则"
    }
    return `${version ? `${version}版本` : ""}${Number.isFinite(phaseNo) ? `第${phaseNo}期` : ""}`
}

function modeledBossEncounterEffects(encounter = {}) {
    return [
        ...(encounter.playerBuffs ?? []),
        ...(encounter.playerDebuffs ?? []),
    ].flatMap(item => item?.calculationStatus === "modeled" ? (item.effects ?? []) : [])
}

export function flattenBossCatalog(bosses = []) {
    return (bosses ?? []).flatMap(boss => (boss.encounters ?? []).map(encounter => {
        const appearance = encounter.appearances?.at(-1) ?? {}
        const sourcePeriod = { zhCN: bossAppearanceLabel(appearance) }
        const bossName = boss.name ?? { zhCN: "未命名 Boss" }
        return {
            id: encounter.id,
            bossId: boss.id,
            sourceType: "boss",
            sourceCategory: "boss",
            sourceKind: "boss",
            scope: "inCombat",
            bossName,
            aliases: boss.aliases ?? [],
            images: boss.images ?? null,
            target: boss.target ?? null,
            bossSource: { zhCN: "危局强袭战" },
            sourcePeriod,
            period: appearance,
            appearances: encounter.appearances ?? [],
            name: { zhCN: `${bossName.zhCN ?? "未命名 Boss"}｜${sourcePeriod.zhCN}敌情` },
            description: encounter.enemyIntel ?? null,
            conditionLabel: encounter.enemyIntel ?? null,
            enemyIntel: encounter.enemyIntel ?? null,
            recommendedSpecialties: encounter.recommendedSpecialties ?? [],
            playerBuffs: encounter.playerBuffs ?? [],
            playerDebuffs: encounter.playerDebuffs ?? [],
            sources: encounter.sources ?? [],
            effects: modeledBossEncounterEffects(encounter),
            buffModifiers: [],
            hidden: boss.hidden === true || encounter.hidden === true,
        }
    }))
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

function normalizeDisorderType(value) {
    return DISORDER_TYPE_VALUES.has(value) ? value : "normal"
}

function normalizeDirectDamageBasis(value) {
    return value === "anomalyProficiency" ? value : "atk"
}

function directDamageBasisValue(panel = {}, event = {}) {
    return event.damageBasis === "anomalyProficiency"
        ? Number(panel.anomalyProficiency ?? 0)
        : Number(panel.atk ?? 0)
}

function normalizeDirectDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    if (event.normalized === true) {
        const eventCountRange = normalizeSkillEventCountRange(
            event.eventCountRange ?? event.skillSource?.eventCountRange,
            { label: event.skillSource?.label ?? event.id ?? `direct-${index + 1}` },
        )
        const damageElement = DIRECT_DAMAGE_ELEMENTS.has(event.damageElement)
            ? event.damageElement
            : DIRECT_DAMAGE_ELEMENTS.has(event.skillSource?.damageElement)
                ? event.skillSource.damageElement
                : resolveDirectDamageElement(agent)
        return {
            ...event,
            id: String(event.id ?? `direct-${index + 1}`),
            kind: "direct",
            normalized: true,
            skillMultiplier: Math.max(0, Number(event.skillMultiplier ?? 1)),
            skillSource: event.skillSource ?? null,
            damageBasis: normalizeDirectDamageBasis(event.damageBasis ?? event.skillSource?.damageBasis),
            damageScale: normalizeDamageScale(event),
            label: normalizeDamageEventLabel(event),
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode)
                ? event.critMode
                : "expected",
            damageElement,
            count: normalizeSkillEventCount(event.count, eventCountRange, 1, event.id ?? `direct-${index + 1}`),
            eventCountRange,
            stunned: normalizeEventStunned(event.stunned),
        }
    }

    const skillRefResult = resolveDamageSkillRef(catalog, agent, event.skillRef, options)
    const skillMultiplier = skillRefResult?.skillMultiplier
        ?? (event.normalized === true ? Number(event.skillMultiplier ?? 1) : Number(event.skillMultiplier ?? 100) / 100)
    const critMode = ["expected", "crit", "nonCrit"].includes(event.critMode)
        ? event.critMode
        : "expected"
    const damageElement = DIRECT_DAMAGE_ELEMENTS.has(event.damageElement)
        ? event.damageElement
        : skillRefResult?.skillSource?.damageElement ?? resolveDirectDamageElement(agent)

    return {
        id: String(event.id ?? `direct-${index + 1}`),
        kind: "direct",
        normalized: true,
        skillMultiplier: Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 1,
        skillSource: skillRefResult?.skillSource ?? null,
        generatedSkillComponents: skillRefResult?.generatedSkillComponents ?? [],
        damageBasis: normalizeDirectDamageBasis(skillRefResult?.skillSource?.damageBasis ?? event.damageBasis),
        damageScale: normalizeDamageScale(event),
        label: normalizeDamageEventLabel(event),
        critMode,
        damageElement,
        count: normalizeSkillEventCount(
            event.count,
            skillRefResult?.eventCountRange,
            1,
            event.id ?? skillRefResult?.skillSource?.label ?? `direct-${index + 1}`,
        ),
        eventCountRange: skillRefResult?.eventCountRange ?? null,
        stunned: normalizeEventStunned(event.stunned),
    }
}

function generatedDirectDamageComponentEvents(event = {}) {
    const rawComponents = Array.isArray(event.generatedSkillComponents)
        ? event.generatedSkillComponents
        : []
    const components = rawComponents.filter(component =>
        component?.skillSource && Number.isFinite(Number(component.skillMultiplier)))
    if (event.kind !== "direct"
        || components.length < 2
        || components.length !== rawComponents.length) {
        return [event]
    }

    const totalMultiplier = components.reduce(
        (total, component) => total + Math.max(0, Number(component.skillMultiplier ?? 0)),
        0,
    )
    return components.map((component, index) => {
        const skillMultiplier = Math.max(0, Number(component.skillMultiplier ?? 0))
        return {
            ...event,
            id: `${event.id}::${component.skillSource.rowId ?? index + 1}`,
            skillMultiplier,
            skillSource: component.skillSource,
            generatedSkillComponents: [],
            generatedParentEventId: event.id,
            generatedParentSkillSource: event.skillSource,
            generatedComponentIndex: index,
            generatedComponentCount: components.length,
            generatedComponentWeight: totalMultiplier > 0 ? skillMultiplier / totalMultiplier : 1 / components.length,
            damageBasis: normalizeDirectDamageBasis(component.skillSource.damageBasis ?? event.damageBasis),
        }
    })
}

function normalizeSheerDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    if (event.normalized === true) {
        const eventCountRange = normalizeSkillEventCountRange(
            event.eventCountRange ?? event.skillSource?.eventCountRange,
            { label: event.skillSource?.label ?? event.id ?? `sheer-${index + 1}` },
        )
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
            damageScale: normalizeDamageScale(event),
            label: normalizeDamageEventLabel(event),
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode)
                ? event.critMode
                : "expected",
            damageElement,
            count: normalizeSkillEventCount(event.count, eventCountRange, 1, event.id ?? `sheer-${index + 1}`),
            eventCountRange,
            stunned: normalizeEventStunned(event.stunned),
        }
    }

    const skillRefResult = resolveDamageSkillRef(catalog, agent, event.skillRef, options)
    const skillMultiplier = skillRefResult?.skillMultiplier
        ?? Number(event.skillMultiplier ?? 100) / 100
    const critMode = ["expected", "crit", "nonCrit"].includes(event.critMode)
        ? event.critMode
        : "expected"
    const skillDamageElement = skillRefResult?.skillSource?.damageElement
    const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement)
        ? event.damageElement
        : DAMAGE_ELEMENTS.includes(skillDamageElement) ? skillDamageElement : resolveDamageElement(agent)

    return {
        id: String(event.id ?? `sheer-${index + 1}`),
        kind: "sheer",
        normalized: true,
        skillMultiplier: Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 1,
        skillSource: skillRefResult?.skillSource ?? null,
        damageScale: normalizeDamageScale(event),
        label: normalizeDamageEventLabel(event),
        critMode,
        damageElement,
        count: normalizeSkillEventCount(
            event.count,
            skillRefResult?.eventCountRange,
            1,
            event.id ?? skillRefResult?.skillSource?.label ?? `sheer-${index + 1}`,
        ),
        eventCountRange: skillRefResult?.eventCountRange ?? null,
        stunned: normalizeEventStunned(event.stunned),
    }
}

function anomalyReleaseEventData(event = {}, agent = {}, damageElement = "physical", options = {}) {
    const requestedTriggerAgentId = String(event.triggerActorRef?.agentId ?? agent.id ?? "")
    if (requestedTriggerAgentId !== String(agent.id ?? "")) {
        throw new Error("异放触发者必须是当前配装角色。")
    }
    const profile = anomalyReleaseProfile(agent, event.triggerActorRef?.profileId, damageElement)
    if (!profile) {
        throw new Error(`角色 ${agent.id ?? "unknown"} 暂不支持 ${damageElement} 属性异放。`)
    }
    const sourceAgentId = String(event.anomalySource?.actorRef?.agentId ?? agent.id ?? "")
    const sourceSnapshot = normalizeAnomalySourceSnapshot(event.anomalySource?.snapshot)
    if (sourceAgentId !== String(agent.id ?? "") && (!sourceSnapshot || sourceSnapshot.agentId !== sourceAgentId)) {
        throw new Error("外部原异常施加者必须提供与角色一致的冻结快照。")
    }
    return {
        profile,
        coreScalingRow: corePassiveScalingRow(agent, options.coreSkillLevel),
        triggerActorRef: {
            agentId: requestedTriggerAgentId,
            profileId: profile.id,
        },
        anomalySource: {
            actorRef: { agentId: sourceAgentId },
            ...(sourceSnapshot ? { snapshot: sourceSnapshot } : {}),
        },
    }
}

function normalizeLuminescenceDamageEvent(event = {}, agent = {}, index = 0, options = {}) {
    const triggerAgentId = String(event.triggerActorRef?.agentId ?? agent.id ?? "")
    if (!triggerAgentId || triggerAgentId !== String(agent.id ?? "")) {
        throw new Error("耀变触发者必须是当前配装角色。")
    }
    const cinemaLevel = clampNumber(Math.trunc(Number(options.cinemaLevel ?? event.cinemaLevel ?? 0)), 0, 6)
    return {
        ...normalizeLuminescenceEvent({
            ...event,
            id: String(event.id ?? `luminescence-${index + 1}`),
            triggerActorRef: { agentId: triggerAgentId },
            coreSkillLevel: options.coreSkillLevel ?? event.coreSkillLevel ?? "F",
            cinemaLevel,
        }),
        id: String(event.id ?? `luminescence-${index + 1}`),
        label: normalizeDamageEventLabel(event) ?? "队伍异常评分",
        damageElement: LUMIFLUX_DAMAGE_ELEMENT,
    }
}

function normalizeAnomalyDamageEvent(event = {}, agent = {}, catalog = {}, index = 0, options = {}) {
    const releaseSettlement = isReleaseSettlement(event)
    if (event.normalized === true) {
        const damageElement = DAMAGE_ELEMENTS.includes(event.damageElement) ? event.damageElement : "physical"
        const release = releaseSettlement ? anomalyReleaseEventData(event, agent, damageElement, options) : null
        return {
            ...event,
            id: String(event.id ?? `anomaly-${index + 1}`),
            kind: "anomaly",
            settlementType: releaseSettlement ? "release" : "attribute",
            normalized: true,
            anomalyEffect: String(event.anomalyEffect ?? ""),
            anomalyVariant: releaseSettlement
                ? undefined
                : event.anomalyVariant === "polarizedAssault" ? "polarizedAssault" : "normal",
            label: normalizeDamageEventLabel(event),
            damageScale: normalizeDamageScale(event),
            damageElement,
            baseMultiplier: Math.max(0, Number(event.baseMultiplier ?? 0)),
            baseMultiplierPerProc: Math.max(0, Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0)),
            procCount: releaseSettlement ? 1 : normalizeDamageCount(event.procCount, 1),
            usesDefaultProcCount: releaseSettlement ? false : event.usesDefaultProcCount === true,
            baseDurationSeconds: Math.max(0, Number(event.baseDurationSeconds ?? 0)),
            tickIntervalSeconds: Math.max(0, Number(event.tickIntervalSeconds ?? 0)),
            ...(release ? {
                releaseProfile: release.profile,
                releaseCoreScalingRow: release.coreScalingRow,
                triggerActorRef: release.triggerActorRef,
                anomalySource: release.anomalySource,
            } : {}),
            count: normalizeDamageCount(event.count, 1),
            stunned: normalizeEventStunned(event.stunned),
        }
    }

    const effect = anomalyEffectData(catalog, event.anomalyEffect ?? "assault")
    const anomalyVariant = releaseSettlement
        ? undefined
        : event.anomalyVariant === "polarizedAssault" && effect.id === "assault"
            ? "polarizedAssault"
            : "normal"
    const release = releaseSettlement ? anomalyReleaseEventData(event, agent, effect.element, options) : null
    const usesDefaultProcCount = event.procCount === undefined || event.procCount === null || event.procCount === ""
    const procCount = releaseSettlement
        ? 1
        : normalizeDamageCount(event.procCount, effect.defaultProcCount)
    return {
        id: String(event.id ?? `anomaly-${index + 1}`),
        kind: "anomaly",
        settlementType: releaseSettlement ? "release" : "attribute",
        normalized: true,
        anomalyEffect: effect.id,
        anomalyLabel: effect.label,
        anomalyVariant,
        label: normalizeDamageEventLabel(event),
        damageScale: normalizeDamageScale(event),
        damageElement: effect.element,
        baseMultiplier: Number(effect.baseMultiplier ?? 0) * procCount,
        baseMultiplierPerProc: Number(effect.baseMultiplier ?? 0),
        procCount,
        usesDefaultProcCount: releaseSettlement ? false : usesDefaultProcCount,
        baseDurationSeconds: Math.max(0, Number(effect.baseDurationSeconds ?? 0)),
        tickIntervalSeconds: Math.max(0, Number(effect.tickIntervalSeconds ?? 0)),
        ...(release ? {
            releaseProfile: release.profile,
            releaseCoreScalingRow: release.coreScalingRow,
            triggerActorRef: release.triggerActorRef,
            anomalySource: release.anomalySource,
        } : {}),
        count: normalizeDamageCount(event.count, 1),
        stunned: normalizeEventStunned(event.stunned),
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
        const fixedMultiplier = effect ? Number(effect.fixedMultiplier ?? 4.5) : Math.max(0, Number(event.fixedMultiplier ?? 4.5))
        const tickMultiplier = effect ? Number(effect.tickMultiplier ?? 0) : Math.max(0, Number(event.tickMultiplier ?? 0))
        const tickIntervalSeconds = effect ? Number(effect.tickIntervalSeconds ?? 1) : Math.max(0.0001, Number(event.tickIntervalSeconds ?? 1))
        const baseDurationSeconds = effect
            ? Number(effect.defaultDurationSeconds ?? 10)
            : Math.max(0, Number(event.baseDurationSeconds ?? event.durationSeconds ?? 10))
        const elapsed = normalizeElapsedSeconds(event.elapsedSeconds, Number.POSITIVE_INFINITY, tickIntervalSeconds)
        const disorder = disorderBaseMultiplier({
            defaultDurationSeconds: baseDurationSeconds,
            fixedMultiplier,
            tickMultiplier,
            tickIntervalSeconds,
        }, elapsed)
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
            label: normalizeDamageEventLabel(event),
            damageScale: normalizeDamageScale(event),
            damageElement: DAMAGE_ELEMENTS.includes(effect?.element) ? effect.element : DAMAGE_ELEMENTS.includes(event.damageElement) ? event.damageElement : "physical",
            baseMultiplier: disorder.baseMultiplier,
            fixedMultiplier,
            tickMultiplier,
            tickIntervalSeconds,
            tickCount: disorder.tickCount,
            baseDurationSeconds: disorder.baseDuration,
            durationBonusSeconds: 0,
            durationSeconds: disorder.duration,
            elapsedSeconds: elapsed,
            remainingSeconds: disorder.remaining,
            count: normalizeDamageCount(event.count, 1),
            stunned: normalizeEventStunned(event.stunned),
        }
    }

    const effect = disorderEffectData(catalog, event.anomalyEffect ?? event.previousAnomalyEffect ?? "burn")
    const elapsed = normalizeElapsedSeconds(
        event.elapsedSeconds,
        Number.POSITIVE_INFINITY,
        Number(effect.tickIntervalSeconds ?? 1),
    )
    const disorder = disorderBaseMultiplier(effect, elapsed)
    return {
        id: String(event.id ?? `disorder-${index + 1}`),
        kind: "anomaly",
        settlementType: "disorder",
        disorderType,
        normalized: true,
        previousAnomalyEffect: effect.id,
        anomalyEffect: effect.id,
        anomalyLabel: effect.label,
        label: normalizeDamageEventLabel(event),
        damageScale: normalizeDamageScale(event),
        damageElement: effect.element,
        baseMultiplier: disorder.baseMultiplier,
        fixedMultiplier: Number(effect.fixedMultiplier ?? 4.5),
        tickMultiplier: Number(effect.tickMultiplier ?? 0),
        tickIntervalSeconds: Number(effect.tickIntervalSeconds ?? 1),
        tickCount: disorder.tickCount,
        baseDurationSeconds: disorder.baseDuration,
        durationBonusSeconds: 0,
        durationSeconds: disorder.duration,
        elapsedSeconds: elapsed,
        remainingSeconds: disorder.remaining,
        count: normalizeDamageCount(event.count, 1),
        stunned: normalizeEventStunned(event.stunned),
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
    if (kind === "anomaly" && isLuminescenceSettlement(event)) {
        return normalizeLuminescenceDamageEvent(event, agent, index, options)
    }
    if (kind === "anomaly") {
        return normalizeAnomalyDamageEvent(event, agent, catalog, index, options)
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
    const legacyTargetInput = input.target ?? {}
    const legacyStunnedFallback = input.mode === "adminDefault"
        ? true
        : Object.prototype.hasOwnProperty.call(legacyTargetInput, "stunned")
            ? normalizeStunned(legacyTargetInput.stunned)
            : true
    const potentialLevel = normalizePotentialLevel(agent, options.potentialLevel)
    const expandedInput = expandCalculationConfigSkillGroups(input, agent, {
        strict: true,
        defaultStunned: legacyStunnedFallback,
        potentialLevel,
    })
    const skillOptions = {
        ...options,
        potentialLevel,
        skillLevelsByCategory: expandedInput.skillLevelsByCategory ?? options.skillLevelsByCategory,
    }
    const hasConfiguredEvents = Array.isArray(input.events) && input.events.length > 0
    if (hasConfiguredEvents && (!Array.isArray(expandedInput.events) || !expandedInput.events.length)) {
        throw new Error("技能组引用无法展开：没有可用于计算的普通事件。")
    }
    const rawEvents = Array.isArray(expandedInput.events) && expandedInput.events.length
        ? expandedInput.events
        : [legacyDirectDamageEvent(expandedInput)]
    const events = rawEvents.map((event, index) => normalizeDamageEvent({
        ...event,
        stunned: normalizeEventStunned(event?.stunned, legacyStunnedFallback),
    }, agent, catalog, index, skillOptions))
    if (events.some(isLuminescenceSettlement) && events.length !== 1) {
        throw new Error("队伍异常评分必须作为单独事件使用，不能与实际伤害事件合计。")
    }
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

function critMultiplierForMode(panel, mode, critDmgBonus = 0) {
    const critRate = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0) + Number(critDmgBonus ?? 0)

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

function targetActiveStunMultiplier(target = {}, stunned = true, eventTotals = {}) {
    const stunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonus ?? 0)
    const alwaysStunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonusAlways ?? 0)
    const alwaysStunDmgMultiplierBonusCap = Number(eventTotals.stunDmgMultiplierBonusCapAlways ?? 0)
    if (alwaysStunDmgMultiplierBonusCap > 0) {
        const capturedStunMultiplier = Math.max(
            0,
            targetConfiguredStunMultiplier(target) + stunDmgMultiplierBonus + alwaysStunDmgMultiplierBonus,
        )
        return Math.min(capturedStunMultiplier, 1 + alwaysStunDmgMultiplierBonusCap)
    }
    return normalizeEventStunned(stunned)
        ? Math.max(0, targetConfiguredStunMultiplier(target) + stunDmgMultiplierBonus + alwaysStunDmgMultiplierBonus)
        : Math.max(0, 1 + alwaysStunDmgMultiplierBonus)
}

function targetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals = {}, stunned = true) {
    const targetDefense = target.defense
    const levelCoefficient = target.levelCoefficient
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0) + Number(eventTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const panelPenRatio = Number(panel.penRatio ?? 0)
    const targetedPenRatio = Number(eventTotals.penRatio ?? 0)
    const penRatio = panelPenRatio + targetedPenRatio
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    const resistanceFixedOne = damageElement === LUMIFLUX_DAMAGE_ELEMENT
    const targetResistance = resistanceFixedOne ? 0 : Number(target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = resistanceFixedOne
        ? 0
        : Number(bonusTotals.enemyResReduction ?? 0)
            + Number(bonusTotals[enemyResReductionKey] ?? 0)
            + Number(eventTotals.enemyResReduction ?? 0)
            + Number(eventTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = resistanceFixedOne
        ? 0
        : Number(panel[ALL_RES_IGNORE_KEY] ?? 0)
            + Number(panel[resIgnoreKey] ?? 0)
            + Number(eventTotals[ALL_RES_IGNORE_KEY] ?? 0)
            + Number(eventTotals[resIgnoreKey] ?? 0)
    const effectiveResistance = targetResistance - enemyResReduction - resIgnore
    const rawResistanceMultiplier = 1 - effectiveResistance
    const resistanceMultiplier = resistanceFixedOne ? 1 : clampNumber(rawResistanceMultiplier, 0.01, 2)
    const stunDmgMultiplierBonus = Number(eventTotals.stunDmgMultiplierBonus ?? 0)
    const stunDmgMultiplierBonusAlways = Number(eventTotals.stunDmgMultiplierBonusAlways ?? 0)
    const stunDmgMultiplierBonusCapAlways = Number(eventTotals.stunDmgMultiplierBonusCapAlways ?? 0)
    const stunMultiplier = targetConfiguredStunMultiplier(target)
    const capturedStunMultiplier = Math.max(0, stunMultiplier + stunDmgMultiplierBonus + stunDmgMultiplierBonusAlways)
    const normalizedStunned = normalizeEventStunned(stunned)
    const activeStunMultiplier = targetActiveStunMultiplier(target, normalizedStunned, eventTotals)

    return {
        presetId: target.presetId,
        damageElement,
        targetDefense,
        levelCoefficient,
        enemyDefReduction,
        enemyDefFlatReduction,
        targetDefenseAfterReduction,
        panelPenRatio,
        targetedPenRatio,
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
        resistanceFixedOne,
        stunned: normalizedStunned,
        stunMultiplier,
        stunDmgMultiplierBonus,
        stunDmgMultiplierBonusAlways,
        stunDmgMultiplierBonusCapAlways,
        capturedStunMultiplier,
        activeStunMultiplier,
    }
}

function sheerTargetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals = {}, stunned = true) {
    const breakdown = targetBreakdownForElement(panel, bonusTotals, target, damageElement, eventTotals, stunned)
    return {
        ...breakdown,
        enemyDefReduction: 0,
        enemyDefFlatReduction: 0,
        targetDefenseAfterReduction: breakdown.targetDefense,
        panelPenRatio: 0,
        targetedPenRatio: 0,
        penRatio: 0,
        penFlat: 0,
        effectiveDefense: 0,
        defenseMultiplier: 1,
    }
}

function generatedModifierSkillTargets(modifier = {}) {
    const appliesToTargets = modifier?.appliesTo?.skillTargets
    if (Array.isArray(appliesToTargets) && appliesToTargets.length > 0) {
        return appliesToTargets
    }
    const targetTargets = modifier?.target?.skillTargets
    return Array.isArray(targetTargets) ? targetTargets : []
}

function generatedModifierTargetRowId(target = {}) {
    const rowId = String(target?.rowId ?? "").trim()
    return rowId || null
}

// Child events already match ordinary broad and source-row targets directly;
// only an explicit synthetic total-row target needs the parent source.
function generatedModifierParentRowTargetMatches(modifier = {}, event = {}) {
    const parentSource = event?.generatedParentSkillSource
    if (!parentSource) {
        return false
    }
    return generatedModifierSkillTargets(modifier).some(target =>
        generatedModifierTargetRowId(target) === String(parentSource.rowId ?? "")
        && skillTargetMatches(target, parentSource))
}

function generatedModifierMatchingTargets(modifier = {}, event = {}) {
    const targets = generatedModifierSkillTargets(modifier)
    if (!targets.length || !event?.skillSource) {
        return []
    }

    const matchingTargets = targets.filter(target => skillTargetMatches(target, event.skillSource))
    if (generatedModifierParentRowTargetMatches(modifier, event)) {
        matchingTargets.push(...targets.filter(target =>
            generatedModifierTargetRowId(target) === String(event.generatedParentSkillSource.rowId ?? "")
            && !matchingTargets.includes(target)))
    }
    return matchingTargets
}

function generatedModifierParentSource(modifier = {}, event = {}) {
    return generatedModifierParentRowTargetMatches(modifier, event)
        ? event.generatedParentSkillSource
        : null
}

function modifierMatchingEvent(modifier = {}, event = {}) {
    const parentSource = generatedModifierParentSource(modifier, event)
    return parentSource ? { ...event, skillSource: parentSource } : event
}

function modifierValueForEvent(modifier = {}, event = {}) {
    const value = Number(modifier?.value ?? 0)
    if (String(modifier?.kind ?? "") !== "skillMultiplierBonus"
        || !event?.generatedParentSkillSource) {
        return value
    }

    const aggregateTarget = generatedModifierMatchingTargets(modifier, event).some(target => {
        const rowId = generatedModifierTargetRowId(target)
        return !rowId || rowId === String(event.generatedParentSkillSource.rowId ?? "")
    })
    if (!aggregateTarget) {
        return value
    }

    const weight = Number(event.generatedComponentWeight)
    return Number.isFinite(weight) ? value * weight : value
}

export function damageModifierAppliesTo(modifier, event) {
    const matchingEvent = modifierMatchingEvent(modifier, event)
    const appliesTo = modifier.appliesTo ?? {}
    const skillTargets = generatedModifierSkillTargets(modifier)
    const hasSkillTargets = skillTargets.length > 0
    if (Object.prototype.hasOwnProperty.call(modifier?.requirement ?? {}, "eventStunned")
        && normalizeEventStunned(matchingEvent?.stunned) !== normalizeStunned(modifier.requirement.eventStunned)) {
        return false
    }
    if (modifier.target?.kind === "skill" && !hasSkillTargets) {
        return false
    }
    if (["directDamageBonus", "skillMultiplierBonus"].includes(modifier.kind) && !hasSkillTargets) {
        return false
    }
    if (Array.isArray(appliesTo.damageKinds) && appliesTo.damageKinds.length) {
        const eventKinds = eventDamageKindKeys(matchingEvent)
        if (!eventKinds.some(kind => appliesTo.damageKinds.includes(kind))) {
            return false
        }
    }
    if (Array.isArray(appliesTo.anomalyEffects) && appliesTo.anomalyEffects.length) {
        const effectIds = [matchingEvent.anomalyEffect, matchingEvent.previousAnomalyEffect].filter(Boolean)
        if (!effectIds.some(effectId => appliesTo.anomalyEffects.includes(effectId))) {
            return false
        }
    }
    if (Array.isArray(appliesTo.settlementTypes) && appliesTo.settlementTypes.length) {
        const settlementType = isLuminescenceSettlement(matchingEvent)
            ? "luminescence"
            : isReleaseSettlement(matchingEvent)
            ? "release"
            : isDisorderDamageEvent(matchingEvent) ? "disorder" : "attribute"
        if (!appliesTo.settlementTypes.includes(settlementType)) {
            return false
        }
    }
    if (Array.isArray(appliesTo.anomalyVariants) && appliesTo.anomalyVariants.length
        && !appliesTo.anomalyVariants.includes(matchingEvent.anomalyVariant ?? "normal")) {
        return false
    }
    if (Array.isArray(appliesTo.elements) && appliesTo.elements.length && !appliesTo.elements.includes(matchingEvent.damageElement)) {
        return false
    }
    if (skillTargets.length && !skillTargetsApplyTo(skillTargets, matchingEvent)) {
        return false
    }
    return true
}

const TEAM_ANOMALY_DAMAGE_SOURCE_TYPES = new Set(["field", "boss"])
const DAMAGE_MODIFIER_FILTER_KEYS = [
    "damageKinds",
    "settlementTypes",
    "anomalyEffects",
    "anomalyVariants",
    "elements",
    "skillTargets",
]

export function isTeamAnomalyDamageModifier(modifier = {}) {
    const requirement = modifier.requirement
    const hasRequirement = requirement !== undefined
        && requirement !== null
        && (
            typeof requirement !== "object"
            || Array.isArray(requirement)
            || Object.keys(requirement).length > 0
        )
    if (modifier.kind !== "anomalyDamageBonus"
        || !TEAM_ANOMALY_DAMAGE_SOURCE_TYPES.has(modifier.sourceType)
        || (modifier.target?.kind ?? "default") !== "default"
        || hasRequirement) {
        return false
    }
    const appliesTo = modifier.appliesTo ?? {}
    return !DAMAGE_MODIFIER_FILTER_KEYS.some(key =>
        Array.isArray(appliesTo[key]) && appliesTo[key].length > 0)
}

function skillTargetsApplyTo(skillTargets, event) {
    const source = event.skillSource
    if (!source) {
        return false
    }

    return skillTargets.some(target => skillTargetMatches(target, source))
}

function matchingDamageModifiers(bonusTotals, event, kind) {
    return (bonusTotals.damageModifiers ?? [])
        .filter(modifier => !IGNORED_DAMAGE_MODIFIER_KINDS.has(modifier?.kind)
            && modifier.kind === kind
            && damageModifierAppliesTo(modifier, event))
        .map(modifier => {
            const value = modifierValueForEvent(modifier, event)
            return value === Number(modifier.value ?? 0)
                ? modifier
                : { ...modifier, value }
        })
}

function sumDamageModifiers(bonusTotals, event, kind) {
    return matchingDamageModifiers(bonusTotals, event, kind)
        .reduce((total, modifier) => total + Number(modifier.value ?? 0), 0)
}

function alienationBreakdownForEvent(bonusTotals, event) {
    const modifiers = matchingDamageModifiers(bonusTotals, event, "alienationCoefficientBonus")
    const coefficientBonus = modifiers.reduce((total, modifier) => total + Number(modifier.value ?? 0), 0)
    return {
        active: modifiers.length > 0,
        coefficientBonus,
        multiplier: Math.max(0, 1 + coefficientBonus),
        modifiers,
    }
}

function alienationModifierFormulaPart(modifier = {}) {
    const sourceValue = Number(modifier.sourceValue)
    const formulaValue = Number(modifier.formulaValue)
    if (Number.isFinite(sourceValue) && sourceValue !== 0 && Number.isFinite(formulaValue)) {
        const ratio = formulaValue / sourceValue / 100
        const coverage = Number(modifier.coverage ?? 1)
        return `${formatDamageNumber(sourceValue)} × ${formatDamagePercent(ratio, 4)}${coverage !== 1 ? ` × 覆盖率 ${formatDamagePercent(coverage)}` : ""}`
    }
    const label = localizedName(modifier.label, modifier.sourceKey ?? "异化系数")
    return `${label} ${formatDamagePercent(Number(modifier.value ?? 0))}`
}

function alienationWhiteBoxFormula(alienation) {
    const parts = (alienation?.modifiers ?? []).map(alienationModifierFormulaPart)
    return `1${parts.length ? ` + ${parts.join(" + ")}` : ""} = ${formatDamageNumber(alienation?.multiplier ?? 1, 4)}`
}

function luminescenceDamageMultipliersFromModifiers(modifiers = [], event = {}) {
    let luminescenceDamageBonus = 0
    let teamAnomalyDamageBonus = 0
    for (const modifier of modifiers) {
        if (modifier?.kind !== "anomalyDamageBonus" || !damageModifierAppliesTo(modifier, event)) {
            continue
        }
        const value = Number(modifier.value ?? 0)
        luminescenceDamageBonus += value
        if (isTeamAnomalyDamageModifier(modifier)) {
            teamAnomalyDamageBonus += value
        }
    }
    return {
        luminescenceDamageMultiplier: Math.max(0, 1 + luminescenceDamageBonus),
        teamAnomalyDamageMultiplier: Math.max(0, 1 + teamAnomalyDamageBonus),
    }
}

function eventTargetTotalsForElement(bonusTotals, event) {
    const damageElement = event.damageElement
    const elementDmgKey = `${damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[damageElement]
    const elementCritDmgKey = CRIT_DMG_KEY_BY_ELEMENT[damageElement]
    const elementDefIgnoreKey = DEF_IGNORE_KEY_BY_ELEMENT[damageElement]
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
        critDmg: sumDamageModifiers(bonusTotals, event, "critDmg"),
        dmgBonus: sumDamageModifiers(bonusTotals, event, "dmgBonus"),
        [elementDmgKey]: sumDamageModifiers(bonusTotals, event, elementDmgKey),
        enemyDefReduction: sumDamageModifiers(bonusTotals, event, "enemyDefReduction")
            + sumDamageModifiers(bonusTotals, event, elementDefIgnoreKey),
        penRatio: sumDamageModifiers(bonusTotals, event, "penRatio"),
        enemyResReduction: sumDamageModifiers(bonusTotals, event, "enemyResReduction"),
        [resReductionKey]: sumDamageModifiers(bonusTotals, event, resReductionKey),
        [ALL_RES_IGNORE_KEY]: sumDamageModifiers(bonusTotals, event, ALL_RES_IGNORE_KEY),
        [resIgnoreKey]: sumDamageModifiers(bonusTotals, event, resIgnoreKey),
        stunDmgMultiplierBonus: sumDamageModifiers(bonusTotals, event, "stunDmgMultiplierBonus"),
        stunDmgMultiplierBonusAlways: sumDamageModifiers(bonusTotals, event, "stunDmgMultiplierBonusAlways"),
        stunDmgMultiplierBonusCapAlways: sumDamageModifiers(bonusTotals, event, "stunDmgMultiplierBonusCapAlways"),
        sheerDmgBonus: sumDamageModifiers(bonusTotals, event, "sheerDmgBonus"),
        ...(elementSheerDmgKey ? { [elementSheerDmgKey]: sumDamageModifiers(bonusTotals, event, elementSheerDmgKey) } : {}),
        ...(elementCritDmgKey ? { [elementCritDmgKey]: sumDamageModifiers(bonusTotals, event, elementCritDmgKey) } : {}),
        anomalyDamageBonus: isDisorder ? disorderDamageBonus : attributeAnomalyDamageBonus,
        attributeAnomalyDamageBonus,
        disorderDamageBonus,
        skillMultiplierBonus: sumDamageModifiers(bonusTotals, event, "skillMultiplierBonus"),
    }
}

function releaseBreakdownForEvent(event, panel = {}, outOfCombatPanel = panel) {
    if (!isReleaseSettlement(event)) {
        return {
            resultMode: null,
            originalBaseMultiplier: Number(event?.baseMultiplierPerProc ?? event?.baseMultiplier ?? 0),
            formulaValue: 1,
            finalBaseMultiplier: Number(event?.baseMultiplier ?? 0),
            releaseScale: 1,
            trace: null,
        }
    }
    return evaluateAnomalyReleaseProfile(event.releaseProfile, {
        originalBaseMultiplier: Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0),
        trigger: { inCombatPanel: panel, outOfCombatPanel },
        coreScalingRow: event.releaseCoreScalingRow,
        event,
        eventElement: event.damageElement,
    })
}

function releaseCritRateBonusForEvent(event, panel = {}, outOfCombatPanel = panel) {
    if (!isReleaseSettlement(event) || !event.releaseProfile?.critRateBonusExpression) {
        return 0
    }
    return Math.max(0, evaluateReleaseExpression(event.releaseProfile.critRateBonusExpression, {
        trigger: { inCombatPanel: panel, outOfCombatPanel },
        coreScalingRow: event.releaseCoreScalingRow,
        event,
        eventElement: event.damageElement,
    }).value)
}

function anomalyCritMultiplier(bonusTotals, event, panel = {}, outOfCombatPanel = panel) {
    if (isDisorderDamageEvent(event)) {
        return {
            baseCritRate: 0,
            convertedCritRate: 0,
            critRate: 0,
            critDmg: 0,
            multiplier: 1,
        }
    }

    const baseCritRate = sumDamageModifiers(bonusTotals, event, "anomalyCritRate")
    const conversionModifiers = matchingDamageModifiers(
        bonusTotals,
        event,
        "anomalyCritRatePerInitialMasteryAbove100",
    )
    const critRatePerInitialMasteryPoint = conversionModifiers
        .reduce((total, modifier) => total + Number(modifier.value ?? 0), 0)
    const initialAnomalyMastery = Number(outOfCombatPanel?.anomalyMastery ?? panel?.anomalyMastery ?? 0)
    const convertedCritRate = conversionModifiers.length
        ? calculateInitialMasteryConvertedAnomalyCritRate(
            initialAnomalyMastery,
            critRatePerInitialMasteryPoint,
        )
        : baseCritRate > 0
            ? releaseCritRateBonusForEvent(event, panel, outOfCombatPanel)
            : 0
    const critRate = clampNumber(baseCritRate + convertedCritRate, 0, 1)
    const critDmg = Math.max(0, sumDamageModifiers(bonusTotals, event, "anomalyCritDmg"))
    return {
        baseCritRate,
        convertedCritRate,
        critRatePerInitialMasteryPoint,
        initialAnomalyMastery,
        critRate,
        critDmg,
        multiplier: critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1,
    }
}

function effectiveAttributeAnomalyDamageEvent(event, bonusTotals) {
    if (isDisorderDamageEvent(event) || isReleaseSettlement(event) || !event.usesDefaultProcCount) {
        return event
    }
    const baseDurationSeconds = Number(event.baseDurationSeconds ?? 0)
    const tickIntervalSeconds = Number(event.tickIntervalSeconds ?? 0)
    if (!(baseDurationSeconds > 0) || !(tickIntervalSeconds > 0)) {
        return event
    }
    const durationBonusSeconds = sumDamageModifiers(bonusTotals, event, "anomalyDurationBonusSeconds")
    if (!(durationBonusSeconds > 0)) {
        return event
    }
    const extraProcCount = Math.max(0, Math.floor((durationBonusSeconds + 1e-9) / tickIntervalSeconds))
    const procCount = Number(event.procCount ?? 0) + extraProcCount
    return {
        ...event,
        durationBonusSeconds,
        durationSeconds: baseDurationSeconds + durationBonusSeconds,
        procCount,
        baseMultiplier: Number(event.baseMultiplierPerProc ?? 0) * procCount,
    }
}

function effectiveDisorderDamageEvent(event, bonusTotals) {
    if (!isDisorderDamageEvent(event)) {
        return event
    }
    const durationBonusSeconds = sumDamageModifiers(bonusTotals, event, "anomalyDurationBonusSeconds")
    const timing = disorderBaseMultiplier({
        defaultDurationSeconds: event.baseDurationSeconds ?? event.durationSeconds ?? 10,
        fixedMultiplier: event.fixedMultiplier ?? 4.5,
        tickMultiplier: event.tickMultiplier ?? 0,
        tickIntervalSeconds: event.tickIntervalSeconds ?? 0.5,
    }, event.elapsedSeconds, durationBonusSeconds)
    return {
        ...event,
        baseMultiplier: timing.baseMultiplier,
        baseDurationSeconds: timing.baseDuration,
        durationBonusSeconds: timing.durationBonus,
        durationSeconds: timing.duration,
        elapsedSeconds: timing.elapsed,
        remainingSeconds: timing.remaining,
        tickIntervalSeconds: timing.tickIntervalSeconds,
        tickCount: timing.tickCount,
    }
}

function defenseWhiteBoxRow(targetBreakdown) {
    const formulaLines = [
        `减防后防御（减防/无视防御）= ${formatDamageNumber(targetBreakdown.targetDefense)} × (1 - ${formatDamagePercent(targetBreakdown.enemyDefReduction)}) - ${formatDamageNumber(targetBreakdown.enemyDefFlatReduction)}`,
        `有效防御（穿透率）= ${formatDamageNumber(targetBreakdown.targetDefenseAfterReduction)} × (1 - ${formatDamagePercent(targetBreakdown.penRatio)}) - ${formatDamageNumber(targetBreakdown.penFlat)}（穿透率合计 ${formatDamagePercent(targetBreakdown.penRatio)} = 面板穿透率 ${formatDamagePercent(targetBreakdown.panelPenRatio)} + 技能目标穿透率 ${formatDamagePercent(targetBreakdown.targetedPenRatio)}）`,
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
    const alwaysBonusCap = Number(targetBreakdown.stunDmgMultiplierBonusCapAlways ?? 0)
    const bonusText = [
        bonus ? `失衡易伤倍率加算 ${formatDamagePercent(bonus)}` : "",
        alwaysBonus ? `失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : "",
    ].filter(Boolean).join(" + ")
    return {
        label: "失衡乘区",
        formula: alwaysBonusCap > 0
            ? `捕获失衡倍率 ${formatDamagePercent(targetBreakdown.capturedStunMultiplier)}，帷幕易伤加成上限 ${formatDamagePercent(alwaysBonusCap)}，最终倍率不超过 ${formatDamagePercent(1 + alwaysBonusCap)}`
            : targetBreakdown.stunned
                ? `Boss 已失衡，使用失衡倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)}${bonusText ? ` + ${bonusText}` : ""}`
                : `Boss 未失衡，配置倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)} 不生效${alwaysBonus ? ` + 失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : ""}`,
        value: targetBreakdown.activeStunMultiplier,
        displayValue: formatDamageNumber(targetBreakdown.activeStunMultiplier, 4),
    }
}

function critDmgBonusWhiteBoxText(skillTargetedCritDmgBonus, elementCritDmgBonus) {
    return [
        skillTargetedCritDmgBonus ? `定向暴击伤害 ${formatDamagePercent(skillTargetedCritDmgBonus)}` : "",
        elementCritDmgBonus ? `属性伤害暴击伤害 ${formatDamagePercent(elementCritDmgBonus)}` : "",
    ].filter(Boolean).join(" + ")
}

function directDamageWhiteBoxRows({ event, damageBasisValue, critMultiplier, critRateForDamage, critDmg, baseCritDmg, skillTargetedCritDmgBonus, elementCritDmgBonus, selectedDmgBonus, directDamageBonus, dmgMultiplier, targetBreakdown, skillMultiplierBonus, effectiveSkillMultiplier, finalDamage, singleDamage }) {
    const critModeLabel = {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[event.critMode]
    const damageElementText = damageElementLabel(event.damageElement)
    const critDmgBonusText = critDmgBonusWhiteBoxText(skillTargetedCritDmgBonus, elementCritDmgBonus)
    const rows = [
        {
            label: event.damageBasis === "anomalyProficiency" ? "局内异常精通" : "局内攻击力",
            formula: event.damageBasis === "anomalyProficiency" ? "本次伤害以局内异常精通为基础值" : "来自局内面板攻击力",
            value: damageBasisValue,
            displayValue: formatDamageNumber(damageBasisValue),
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
                ? `${formatDamagePercent(critRateForDamage)} × (1 + ${formatDamagePercent(baseCritDmg)}${critDmgBonusText ? ` + ${critDmgBonusText}` : ""}) + (1 - ${formatDamagePercent(critRateForDamage)})`
                : critDmgBonusText
                    ? `${critModeLabel}（面板暴击伤害 ${formatDamagePercent(baseCritDmg)} + ${critDmgBonusText}）`
                    : critModeLabel,
            value: critMultiplier,
            displayValue: formatDamageNumber(critMultiplier, 4),
        },
        {
            label: "增伤乘区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${directDamageBonus ? ` + 技能目标增伤 ${formatDamagePercent(directDamageBonus)}` : ""}`,
            value: dmgMultiplier,
            displayValue: formatDamageNumber(dmgMultiplier, 4),
        },
        defenseWhiteBoxRow(targetBreakdown),
        {
            label: "抗性乘区",
            formula: targetBreakdown.resistanceFixedOne
                ? "流明直伤不使用抗性，抗性乘区固定为 1"
                : `clamp(1 - (${damageElementText}抗性 ${formatDamagePercent(targetBreakdown.targetResistance)} - 减抗 ${formatDamagePercent(targetBreakdown.enemyResReduction)} - 抗性无视 ${formatDamagePercent(targetBreakdown.resIgnore)}), 0.01, 2)`,
            value: targetBreakdown.resistanceMultiplier,
            displayValue: targetBreakdown.resistanceFixedOne
                ? "1"
                : formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
        },
        stunWhiteBoxRow(targetBreakdown),
    ]
    if (event.damageScale !== 1) {
        rows.push({
            label: "伤害比例",
            formula: `本次额外伤害为原伤害的 ${formatDamagePercent(event.damageScale)}`,
            value: event.damageScale,
            displayValue: formatDamagePercent(event.damageScale),
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
            ? `${formatDamageNumber(damageBasisValue)} × ${formatDamagePercent(effectiveSkillMultiplier)} × ${formatDamageNumber(critMultiplier, 4)} × ${formatDamageNumber(dmgMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.defenseMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.resistanceMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.activeStunMultiplier, 4)}${event.damageScale !== 1 ? ` × ${formatDamagePercent(event.damageScale)}` : ""}`
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

function sheerDamageWhiteBoxRows({ event, hp, atk, sheerForceFlat, sheerForce, critMultiplier, critRateForDamage, critDmg, baseCritDmg, skillTargetedCritDmgBonus, elementCritDmgBonus, selectedDmgBonus, skillDamageBonus, dmgMultiplier, targetBreakdown, skillMultiplierBonus, effectiveSkillMultiplier, sheerDmgBonus, sheerDmgMultiplier, finalDamage, singleDamage }) {
    const critModeLabel = {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[event.critMode]
    const damageElementText = damageElementLabel(event.damageElement)
    const critDmgBonusText = critDmgBonusWhiteBoxText(skillTargetedCritDmgBonus, elementCritDmgBonus)
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
                ? `${formatDamagePercent(critRateForDamage)} × (1 + ${formatDamagePercent(baseCritDmg)}${critDmgBonusText ? ` + ${critDmgBonusText}` : ""}) + (1 - ${formatDamagePercent(critRateForDamage)})`
                : critDmgBonusText
                    ? `${critModeLabel}（面板暴击伤害 ${formatDamagePercent(baseCritDmg)} + ${critDmgBonusText}）`
                    : critModeLabel,
            value: critMultiplier,
            displayValue: formatDamageNumber(critMultiplier, 4),
        },
        {
            label: "普通增伤区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${skillDamageBonus ? ` + 技能目标增伤 ${formatDamagePercent(skillDamageBonus)}` : ""}`,
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
    if (event.damageScale !== 1) {
        rows.push({
            label: "伤害比例",
            formula: `本次额外伤害为原伤害的 ${formatDamagePercent(event.damageScale)}`,
            value: event.damageScale,
            displayValue: formatDamagePercent(event.damageScale),
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
            ? `${formatDamageNumber(sheerForce)} × ${formatDamagePercent(effectiveSkillMultiplier)} × ${formatDamageNumber(critMultiplier, 4)} × ${formatDamageNumber(dmgMultiplier, 4)} × ${formatDamageNumber(sheerDmgMultiplier, 4)} × 1 × ${formatDamageNumber(targetBreakdown.resistanceMultiplier, 4)} × ${formatDamageNumber(targetBreakdown.activeStunMultiplier, 4)}${event.damageScale !== 1 ? ` × ${formatDamagePercent(event.damageScale)}` : ""}`
            : `${formatDamageNumber(singleDamage)} × ${formatDamageNumber(event.count)}`,
        value: finalDamage,
        displayValue: formatDamageNumber(finalDamage),
    })
    return rows
}

function releaseTraceWhiteBoxRows(trace) {
    if (!trace) return []
    const nodes = []
    const visit = node => {
        nodes.push(node)
        for (const child of node.children ?? []) visit(child)
    }
    visit(trace)
    const conversionSource = nodes.find(node => node.whiteBoxRole === "conversionSource")
    const conditionRows = nodes
        .filter(node => node.kind === "condition" && node !== conversionSource)
        .map(node => ({
            label: node.label,
            formula: node.expression,
            value: Number(node.value ?? 0),
            displayValue: formatDamageNumber(node.value, 6),
        }))
    return [
        conversionSource ? {
            label: "转换数据来源",
            formula: conversionSource.label,
            value: Number(conversionSource.rawValue ?? conversionSource.value ?? 0),
            displayValue: conversionSource.rawDisplay ?? formatDamageNumber(conversionSource.rawValue ?? conversionSource.value, 6),
        } : null,
        ...conditionRows,
        {
            label: `异放公式：${trace.label}`,
            formula: trace.expression,
            value: Number(trace.value ?? 0),
            displayValue: formatDamageNumber(trace.value, 6),
        },
    ].filter(Boolean)
}

function calculateInitialMasteryConvertedAnomalyCritRate(initialAnomalyMastery, critRatePerPoint = 0) {
    const wholeMastery = Math.floor(Math.max(0, Number(initialAnomalyMastery ?? 0)))
    const masteryAboveThreshold = Math.max(0, wholeMastery - INITIAL_ANOMALY_MASTERY_CRIT_THRESHOLD)
    return masteryAboveThreshold * Math.max(0, Number(critRatePerPoint ?? 0))
}

function anomalyDamageWhiteBoxRows({ event, atk, selectedDmgBonus, skillDamageBonus, dmgMultiplier, targetBreakdown, anomalyProficiencyMultiplier, levelMultiplier, anomalyDamageBonus, alienation, anomalyCrit, releaseBreakdown = null, baseMultiplierBonus, effectiveBaseMultiplier, finalDamage, singleDamage }) {
    const damageElementText = damageElementLabel(event.damageElement)
    const effectLabel = localizedName(event.anomalyLabel, event.anomalyEffect ?? event.previousAnomalyEffect)
    const isDisorder = isDisorderDamageEvent(event)
    const specialBonusLabel = isDisorder ? "紊乱增伤区" : "属性异常增伤区"
    const specialBonusFormulaLabel = isDisorder ? "紊乱增伤" : "属性异常增伤"
    const multiplierScale = disorderMultiplierScale(event.disorderType)
    const isRelease = isReleaseSettlement(event)
    const rows = [
        {
            label: "局内攻击力",
            formula: "来自局内面板攻击力",
            value: atk,
            displayValue: formatDamageNumber(atk),
        },
        {
            label: isDisorder ? "紊乱倍率" : isRelease ? "异放最终倍率" : "异常倍率",
            formula: isDisorder
                ? multiplierScale === 1
                    ? `${effectLabel}${event.durationBonusSeconds ? `（基础 ${formatDamageNumber(event.baseDurationSeconds)} 秒 + 延长 ${formatDamageNumber(event.durationBonusSeconds)} 秒 = ${formatDamageNumber(event.durationSeconds)} 秒；已流逝 ${formatDamageNumber(event.elapsedSeconds)} 秒，剩余 ${formatDamageNumber(event.remainingSeconds)} 秒）` : ""}：${formatDamagePercent(event.fixedMultiplier)} + ${event.tickCount} × ${formatDamagePercent(event.tickMultiplier)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`
                    : `${effectLabel}${event.durationBonusSeconds ? `（基础 ${formatDamageNumber(event.baseDurationSeconds)} 秒 + 延长 ${formatDamageNumber(event.durationBonusSeconds)} 秒 = ${formatDamageNumber(event.durationSeconds)} 秒；已流逝 ${formatDamageNumber(event.elapsedSeconds)} 秒，剩余 ${formatDamageNumber(event.remainingSeconds)} 秒）` : ""}：(${formatDamagePercent(event.fixedMultiplier)} + ${event.tickCount} × ${formatDamagePercent(event.tickMultiplier)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}) × 极性紊乱 ${formatDamagePercent(multiplierScale)}`
                : isRelease
                    ? releaseBreakdown?.resultMode === "fixedAnomalyMultiplier"
                        ? `固定异放倍率 ${formatDamagePercent(releaseBreakdown.finalBaseMultiplier)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`
                        : `${effectLabel}单次 ${formatDamagePercent(event.baseMultiplierPerProc)} × 异放比例 ${formatDamageNumber(releaseBreakdown?.releaseScale, 6)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`
                    : `${effectLabel}：${formatDamagePercent(event.baseMultiplierPerProc)} × ${formatDamageNumber(event.procCount)}${baseMultiplierBonus ? ` + 倍率修正 ${formatDamagePercent(baseMultiplierBonus)}` : ""}`,
            value: effectiveBaseMultiplier,
            displayValue: formatDamagePercent(effectiveBaseMultiplier),
        },
        {
            label: "增伤乘区",
            formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}${skillDamageBonus ? ` + 技能目标增伤 ${formatDamagePercent(skillDamageBonus)}` : ""}`,
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
    if (isRelease) {
        rows.splice(1, 0,
            {
                label: "原异常单次倍率",
                formula: effectLabel,
                value: Number(event.baseMultiplierPerProc ?? 0),
                displayValue: formatDamagePercent(event.baseMultiplierPerProc),
            },
            ...releaseTraceWhiteBoxRows(releaseBreakdown?.trace),
        )
    }
    if (alienation?.active) {
        rows.push({
            label: "异化乘区",
            formula: alienationWhiteBoxFormula(alienation),
            value: alienation.multiplier,
            displayValue: formatDamageNumber(alienation.multiplier, 4),
        })
    }
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
    if (event.damageScale !== 1) {
        rows.push({
            label: "伤害比例",
            formula: `本次额外伤害为原异常伤害的 ${formatDamagePercent(event.damageScale)}`,
            value: event.damageScale,
            displayValue: formatDamagePercent(event.damageScale),
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
                ...(alienation?.active ? [formatDamageNumber(alienation.multiplier, 4)] : []),
                ...(!isDisorder ? [formatDamageNumber(anomalyCrit.multiplier, 4)] : []),
                ...(event.damageScale !== 1 ? [formatDamagePercent(event.damageScale)] : []),
            ].join(" × ")
            : `${formatDamageNumber(singleDamage)} × ${formatDamageNumber(event.count)}`,
        value: finalDamage,
        displayValue: formatDamageNumber(finalDamage),
    })
    return rows
}

function calculateDirectDamageEventCore({ event, panel, bonusTotals, target, includeWhiteBox }) {
    const atk = Number(panel.atk ?? 0)
    const damageBasisValue = directDamageBasisValue(panel, event)
    const rawCritRate = Number(panel.critRate ?? 0)
    const critRateForDamage = damageCritRate(panel)
    const baseCritDmg = Number(panel.critDmg ?? 0)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementCritDmgKey = CRIT_DMG_KEY_BY_ELEMENT[event.damageElement]
    const elementCritDmgBonus = Number(eventTotals[elementCritDmgKey] ?? 0)
    const skillTargetedCritDmgBonus = Number(eventTotals.critDmg ?? 0)
    const targetedCritDmgBonus = skillTargetedCritDmgBonus + elementCritDmgBonus
    const critDmg = baseCritDmg + targetedCritDmgBonus
    const directDamageBonus = sumDamageModifiers(bonusTotals, event, "directDamageBonus")
        + Number(eventTotals.dmgBonus ?? 0)
        + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + directDamageBonus
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    const targetBreakdown = targetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals, event.stunned)
    const baseSingleDamage = damageBasisValue
        * effectiveSkillMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * event.damageScale
    const damageVariant = mode => {
        const critMultiplier = critMultiplierForMode(panel, mode, targetedCritDmgBonus)
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
            anomalyProficiency: Number(panel.anomalyProficiency ?? 0),
            critRate: rawCritRate,
            effectiveCritRate: critRateForDamage,
            critDmg,
            baseCritDmg,
            elementCritDmgBonus,
            targetedCritDmgBonus,
            dmgBonus: Number(panel.dmgBonus ?? 0),
            ...(DAMAGE_ELEMENTS.includes(event.damageElement)
                ? { [elementDmgKey]: Number(panel[elementDmgKey] ?? 0) }
                : {}),
            penRatio: Number(panel.penRatio ?? 0),
            panelPenRatio: targetBreakdown.panelPenRatio,
            targetedPenRatio: targetBreakdown.targetedPenRatio,
            effectivePenRatio: targetBreakdown.penRatio,
            penFlat: Number(panel.penFlat ?? 0),
        },
        multipliers: {
            atk,
            damageBasis: event.damageBasis,
            damageBasisValue,
            damageScale: event.damageScale,
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
                damageBasisValue,
                critMultiplier,
                critRateForDamage,
                critDmg,
                baseCritDmg,
                skillTargetedCritDmgBonus,
                elementCritDmgBonus,
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

function generatedDirectDamageVariant(componentResults, mode, count) {
    let finalDamage = 0
    let singleDamage = 0
    let weightedCritMultiplier = 0
    let critWeight = 0
    for (const component of componentResults) {
        const variant = component?.damageVariants?.[mode]
        if (!variant) {
            continue
        }
        const componentSingleDamage = Number(variant.singleDamage ?? 0)
        finalDamage += Number(variant.finalDamage ?? componentSingleDamage * Number(count ?? 1))
        singleDamage += componentSingleDamage
        const componentCritMultiplier = Number(variant.critMultiplier ?? 1)
        const preCritDamage = componentCritMultiplier !== 0
            ? componentSingleDamage / componentCritMultiplier
            : componentSingleDamage
        weightedCritMultiplier += componentCritMultiplier * Math.max(0, preCritDamage)
        critWeight += Math.max(0, preCritDamage)
    }

    return {
        critMode: mode,
        critMultiplier: critWeight > 0 ? weightedCritMultiplier / critWeight : 1,
        singleDamage,
        finalDamage,
    }
}

function generatedUniformComponentValue(componentResults = [], key, fallback = null) {
    const values = componentResults.map(component => component?.[key])
    if (!values.length || values.some(value => value === undefined)) {
        return fallback
    }
    const first = values[0]
    const uniform = values.every(value => {
        if (typeof value === "number" && typeof first === "number") {
            return Math.abs(value - first) <= 1e-12 * Math.max(1, Math.abs(value), Math.abs(first))
        }
        return value === first
    })
    return uniform ? first : null
}

function generatedSummedComponentValue(componentResults = [], key, fallback = 0) {
    let sum = 0
    let found = false
    for (const component of componentResults) {
        const value = Number(component?.[key])
        if (!Number.isFinite(value)) {
            continue
        }
        sum += value
        found = true
    }
    return found ? sum : fallback
}

function generatedSegmentedNumericFields(parentValue = {}, componentValues = [], excludedKeys = new Set()) {
    const result = { ...parentValue }
    for (const [key, value] of Object.entries(parentValue)) {
        if (excludedKeys.has(key) || typeof value !== "number") {
            continue
        }
        result[key] = generatedUniformComponentValue(componentValues, key, value)
    }
    return result
}

function generatedWhiteBoxRowVaries(componentResults = [], label) {
    const componentRows = componentResults
        .map(component => (component.whiteBoxRows ?? []).find(row => row.label === label))
        .filter(Boolean)
    return componentRows.length > 1
        && generatedUniformComponentValue(componentRows, "value", null) === null
}

function generatedDirectDamageWhiteBoxRows(parentRows = [], componentResults = [], finalDamage = 0) {
    const rows = parentRows.map(row => ({
        ...row,
        ...(Array.isArray(row?.formulaLines) ? { formulaLines: [...row.formulaLines] } : {}),
    }))
    const componentLines = componentResults.map((component, index) =>
        `${index + 1}. ${component.label ?? component.input?.skillSource?.label ?? "分段"} = ${formatDamageNumber(component.finalDamage)}`)
    const segmentedLabels = new Set([
        "暴击乘区",
        "增伤乘区",
        "防御乘区",
        "抗性乘区",
        "失衡乘区",
    ])
    for (const row of rows) {
        if (!segmentedLabels.has(row.label) || !generatedWhiteBoxRowVaries(componentResults, row.label)) {
            continue
        }
        const componentLinesForRow = componentResults.map((component, index) => {
            const componentRow = (component.whiteBoxRows ?? []).find(item => item.label === row.label)
            if (!componentRow) {
                return `${index + 1}. ${component.label ?? "分段"}`
            }
            const lines = Array.isArray(componentRow.formulaLines)
                ? componentRow.formulaLines
                : String(componentRow.formula ?? "").split(/\r?\n/u).filter(Boolean)
            return `${index + 1}. ${component.label ?? "分段"}: ${lines.join("；")}`
        })
        row.formulaLines = [
            "本事件按各段分别匹配目标乘区",
            ...componentLinesForRow,
        ]
        delete row.formula
        row.value = null
        row.displayValue = "分段"
    }
    const finalRow = rows.find(row => row.label === "最终伤害")
    if (finalRow) {
        finalRow.formulaLines = [
            "各段最终伤害相加",
            ...componentLines,
        ]
        delete finalRow.formula
        finalRow.value = finalDamage
        finalRow.displayValue = formatDamageNumber(finalDamage)
    }
    if (componentLines.length) {
        rows.push({
            label: "分段明细",
            formulaLines: componentLines,
            value: finalDamage,
            displayValue: formatDamageNumber(finalDamage),
        })
    }
    return rows
}

function aggregateGeneratedDirectDamageEvent({ event, parentResult, componentResults, target, includeWhiteBox }) {
    const damageVariants = Object.fromEntries(
        ["expected", "crit", "nonCrit"].map(mode => [
            mode,
            generatedDirectDamageVariant(componentResults, mode, event.count),
        ]),
    )
    const selectedVariant = damageVariants[event.critMode] ?? damageVariants.expected
    const componentBreakdowns = componentResults.map(component => component.targetBreakdown)
    const componentMultipliers = componentResults.map(component => component.multipliers)
    const componentSnapshots = componentResults.map(component => component.panelSnapshot)
    const componentDamageBases = [...new Set(componentMultipliers
        .map(multipliers => String(multipliers?.damageBasis ?? "").trim())
        .filter(Boolean))]
    const aggregateMultipliers = {
        ...generatedSegmentedNumericFields(
            parentResult.multipliers,
            componentMultipliers,
            new Set(["skill", "baseSkill", "skillMultiplierBonus", "crit", "segmented", "componentMultipliers"]),
        ),
        damageBasis: componentDamageBases.length === 1 ? componentDamageBases[0] : null,
        baseSkill: generatedSummedComponentValue(componentMultipliers, "baseSkill", parentResult.multipliers.baseSkill),
        skillMultiplierBonus: generatedSummedComponentValue(
            componentMultipliers,
            "skillMultiplierBonus",
            parentResult.multipliers.skillMultiplierBonus,
        ),
        skill: generatedSummedComponentValue(componentMultipliers, "skill", parentResult.multipliers.skill),
        crit: selectedVariant.critMultiplier,
        segmented: true,
        componentMultipliers,
    }
    const aggregatePanelSnapshot = {
        ...generatedSegmentedNumericFields(
            parentResult.panelSnapshot,
            componentSnapshots,
            new Set(["segmented", "componentSnapshots"]),
        ),
        segmented: true,
        componentSnapshots,
    }
    const aggregateTargetBreakdown = {
        ...generatedSegmentedNumericFields(
            parentResult.targetBreakdown,
            componentBreakdowns,
            new Set(["segmented", "componentBreakdowns"]),
        ),
        segmented: true,
        componentBreakdowns,
    }
    const aggregateInput = {
        ...parentResult.input,
        ...event,
        target,
        generatedDamageBases: componentDamageBases,
        damageBasis: componentDamageBases.length === 1 ? componentDamageBases[0] : null,
        skillSource: event.skillSource
            ? {
                ...event.skillSource,
                damageBasis: componentDamageBases.length === 1 ? componentDamageBases[0] : null,
            }
            : event.skillSource,
    }
    return {
        ...parentResult,
        id: event.id,
        kind: event.kind,
        settlementType: event.settlementType ?? null,
        label: event.skillSource?.label ?? event.label ?? parentResult.label,
        finalDamage: selectedVariant.finalDamage,
        singleDamage: selectedVariant.singleDamage,
        damageVariants,
        count: event.count,
        input: aggregateInput,
        panelSnapshot: aggregatePanelSnapshot,
        multipliers: aggregateMultipliers,
        targetBreakdown: aggregateTargetBreakdown,
        components: componentResults,
        whiteBoxRows: includeWhiteBox
            ? generatedDirectDamageWhiteBoxRows(parentResult.whiteBoxRows, componentResults, selectedVariant.finalDamage)
            : [],
    }
}

function calculateDirectDamageEvent({ event, panel, bonusTotals, target, includeWhiteBox }) {
    const componentEvents = generatedDirectDamageComponentEvents(event)
    if (componentEvents.length < 2) {
        return calculateDirectDamageEventCore({ event, panel, bonusTotals, target, includeWhiteBox })
    }

    const componentResults = componentEvents.map(componentEvent =>
        calculateDirectDamageEventCore({
            event: componentEvent,
            panel,
            bonusTotals,
            target,
            includeWhiteBox,
        }))
    const parentResult = calculateDirectDamageEventCore({
        event: {
            ...event,
            generatedSkillComponents: [],
        },
        panel,
        bonusTotals,
        target,
        includeWhiteBox,
    })
    return aggregateGeneratedDirectDamageEvent({
        event,
        parentResult,
        componentResults,
        target,
        includeWhiteBox,
    })
}

function calculateSheerDamageEvent({ event, agent, panel, bonusTotals, target, includeWhiteBox }) {
    const hp = Number(panel.hp ?? 0)
    const atk = Number(panel.atk ?? 0)
    const sheerForceFlat = isRuptureAgent(agent) ? Number(panel.sheerForceFlat ?? 0) : 0
    const sheerForce = effectiveSheerForceFromPanel(agent, panel)
    const rawCritRate = Number(panel.critRate ?? 0)
    const critRateForDamage = damageCritRate(panel)
    const baseCritDmg = Number(panel.critDmg ?? 0)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[event.damageElement]
    const elementCritDmgKey = CRIT_DMG_KEY_BY_ELEMENT[event.damageElement]
    const elementCritDmgBonus = Number(eventTotals[elementCritDmgKey] ?? 0)
    const skillTargetedCritDmgBonus = Number(eventTotals.critDmg ?? 0)
    const targetedCritDmgBonus = skillTargetedCritDmgBonus + elementCritDmgBonus
    const critDmg = baseCritDmg + targetedCritDmgBonus
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + skillDamageBonus
    const sheerDmgBonus = Number(eventTotals.sheerDmgBonus ?? 0) + Number(eventTotals[elementSheerDmgKey] ?? 0)
    const sheerDmgMultiplier = 1 + sheerDmgBonus
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    const targetBreakdown = sheerTargetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals, event.stunned)
    const baseSingleDamage = sheerForce
        * effectiveSkillMultiplier
        * dmgMultiplier
        * sheerDmgMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * event.damageScale
    const damageVariant = mode => {
        const critMultiplier = critMultiplierForMode(panel, mode, targetedCritDmgBonus)
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
            damageScale: event.damageScale,
            sheerForce,
            critRate: rawCritRate,
            effectiveCritRate: critRateForDamage,
            critDmg,
            baseCritDmg,
            elementCritDmgBonus,
            targetedCritDmgBonus,
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
                baseCritDmg,
                skillTargetedCritDmgBonus,
                elementCritDmgBonus,
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

function releaseOnlyBonusTotals(bonusTotals = {}) {
    return {
        damageModifiers: (bonusTotals.damageModifiers ?? []).filter(modifier =>
            Array.isArray(modifier?.appliesTo?.settlementTypes)
            && modifier.appliesTo.settlementTypes.includes("release")),
    }
}

function releaseSourceBonusTotals(bonusTotals = {}) {
    return {
        ...bonusTotals,
        damageModifiers: (bonusTotals.damageModifiers ?? []).filter(modifier =>
            modifier?.kind !== "anomalyDamageBonus"
            || !Array.isArray(modifier?.appliesTo?.settlementTypes)
            || modifier.appliesTo.settlementTypes.length === 0
            || modifier.appliesTo.settlementTypes.includes("attribute")),
    }
}

function addEventTotals(...totals) {
    const result = Object.create(null)
    for (const source of totals) {
        for (const [key, value] of Object.entries(source ?? {})) {
            result[key] = Number(result[key] ?? 0) + Number(value ?? 0)
        }
    }
    return result
}

function releaseSourceContext(event, panel, outOfCombatPanel, bonusTotals, agentLevel) {
    const sourceAgentId = String(event.anomalySource?.actorRef?.agentId ?? event.triggerActorRef?.agentId ?? "")
    const triggerAgentId = String(event.triggerActorRef?.agentId ?? "")
    const snapshot = normalizeAnomalySourceSnapshot(event.anomalySource?.snapshot)
    if (sourceAgentId && sourceAgentId !== triggerAgentId) {
        if (!snapshot || snapshot.agentId !== sourceAgentId) {
            throw new Error("外部原异常施加者缺少有效的冻结快照。")
        }
        return {
            agentId: sourceAgentId,
            panel: snapshot.panel,
            outOfCombatPanel: snapshot.outOfCombatPanel,
            bonusTotals: snapshot.buffTotals,
            agentLevel: snapshot.agentLevel,
            snapshot,
        }
    }
    return {
        agentId: triggerAgentId,
        panel,
        outOfCombatPanel,
        bonusTotals,
        agentLevel,
        snapshot: null,
    }
}

export function calculateAnomalyUnitDamage({
    event,
    panel,
    bonusTotals,
    target,
    agentLevel,
    includeCrit = false,
    outOfCombatPanel = panel,
} = {}) {
    const sourceEvent = {
        ...event,
        settlementType: "attribute",
        anomalyVariant: "normal",
        baseMultiplier: Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0),
        procCount: 1,
        count: 1,
        damageScale: 1,
    }
    const eventTotals = eventTargetTotalsForElement(bonusTotals, sourceEvent)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, sourceEvent.damageElement)
    const elementDmgKey = `${sourceEvent.damageElement}Dmg`
    const targetedDmgBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + targetedDmgBonus
    const baseMultiplierBonus = sumDamageModifiers(bonusTotals, sourceEvent, "baseMultiplierBonus")
    const effectiveBaseMultiplier = Math.max(0, Number(sourceEvent.baseMultiplier ?? 0) + baseMultiplierBonus)
    const targetBreakdown = targetBreakdownForElement(
        panel,
        bonusTotals,
        target,
        sourceEvent.damageElement,
        eventTotals,
        sourceEvent.stunned,
    )
    const anomalyProficiencyMultiplier = Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100
    const levelMultiplier = anomalyLevelMultiplier(agentLevel)
    const anomalyDamageBonus = 1 + Number(eventTotals.anomalyDamageBonus ?? 0)
    const alienation = alienationBreakdownForEvent(bonusTotals, sourceEvent)
    const anomalyCrit = includeCrit
        ? anomalyCritMultiplier(bonusTotals, sourceEvent, panel, outOfCombatPanel)
        : { critRate: 0, critDmg: 0, multiplier: 1 }
    const damage = Number(panel.atk ?? 0)
        * effectiveBaseMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * anomalyProficiencyMultiplier
        * levelMultiplier
        * anomalyDamageBonus
        * alienation.multiplier
        * anomalyCrit.multiplier
    return {
        damage,
        sourceEvent,
        eventTotals,
        selectedDmgBonus,
        targetedDmgBonus,
        dmgMultiplier,
        baseMultiplierBonus,
        effectiveBaseMultiplier,
        targetBreakdown,
        anomalyProficiencyMultiplier,
        levelMultiplier,
        anomalyDamageBonus,
        alienation,
        anomalyCrit,
    }
}

function calculateReleaseDamageEvent({ event, panel, outOfCombatPanel, bonusTotals, target, agentLevel, includeWhiteBox }) {
    const source = releaseSourceContext(event, panel, outOfCombatPanel, bonusTotals, agentLevel)
    const sourceUnit = calculateAnomalyUnitDamage({
        event,
        panel: source.panel,
        outOfCombatPanel: source.outOfCombatPanel,
        bonusTotals: releaseSourceBonusTotals(source.bonusTotals),
        target,
        agentLevel: source.agentLevel,
    })
    const releaseBreakdown = releaseBreakdownForEvent(event, panel, outOfCombatPanel)
    const triggerBonusTotals = releaseOnlyBonusTotals(bonusTotals)
    const triggerEventTotals = eventTargetTotalsForElement(triggerBonusTotals, event)
    const combinedEventTotals = addEventTotals(sourceUnit.eventTotals, triggerEventTotals)
    const elementDmgKey = `${event.damageElement}Dmg`
    const releaseTargetedDmgBonus = Number(triggerEventTotals.dmgBonus ?? 0)
        + Number(triggerEventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = sourceUnit.dmgMultiplier + releaseTargetedDmgBonus
    const releaseBaseMultiplierBonus = sumDamageModifiers(triggerBonusTotals, event, "baseMultiplierBonus")
    const effectiveBaseMultiplier = Math.max(
        0,
        sourceUnit.effectiveBaseMultiplier * releaseBreakdown.releaseScale + releaseBaseMultiplierBonus,
    )
    const targetBreakdown = targetBreakdownForElement(
        source.panel,
        source.bonusTotals,
        target,
        event.damageElement,
        combinedEventTotals,
        event.stunned,
    )
    const sourceAnomalyDamageBonus = sourceUnit.anomalyDamageBonus
    const releaseAnomalyDamageBonus = Number(triggerEventTotals.anomalyDamageBonus ?? 0)
    const anomalyDamageBonus = sourceAnomalyDamageBonus + releaseAnomalyDamageBonus
    const alienation = sourceUnit.alienation
    const anomalyCrit = anomalyCritMultiplier(triggerBonusTotals, event, panel, outOfCombatPanel)
    const singleDamage = Number(source.panel.atk ?? 0)
        * effectiveBaseMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * sourceUnit.anomalyProficiencyMultiplier
        * sourceUnit.levelMultiplier
        * anomalyDamageBonus
        * alienation.multiplier
        * anomalyCrit.multiplier
        * event.damageScale
    const finalDamage = singleDamage * event.count

    return {
        id: event.id,
        kind: event.kind,
        settlementType: "release",
        label: event.label ?? "异放",
        finalDamage,
        singleDamage,
        count: event.count,
        input: { ...event, target, agentLevel: normalizeAgentLevel(agentLevel) },
        panelSnapshot: {
            atk: Number(source.panel.atk ?? 0),
            anomalyProficiency: Number(source.panel.anomalyProficiency ?? 0),
            penRatio: Number(source.panel.penRatio ?? 0),
            panelPenRatio: targetBreakdown.panelPenRatio,
            targetedPenRatio: targetBreakdown.targetedPenRatio,
            effectivePenRatio: targetBreakdown.penRatio,
            penFlat: Number(source.panel.penFlat ?? 0),
            triggerOutOfCombatPanel: outOfCombatPanel,
            sourceAgentId: source.agentId,
            sourceSnapshot: source.snapshot,
        },
        multipliers: {
            atk: Number(source.panel.atk ?? 0),
            anomaly: effectiveBaseMultiplier,
            baseMultiplier: releaseBreakdown.finalBaseMultiplier,
            originalAnomalyBaseMultiplier: releaseBreakdown.originalBaseMultiplier,
            releaseScale: releaseBreakdown.releaseScale,
            releaseFormulaValue: releaseBreakdown.formulaValue,
            releaseResultMode: releaseBreakdown.resultMode,
            releaseTrace: releaseBreakdown.trace,
            baseMultiplierBonus: sourceUnit.baseMultiplierBonus + releaseBaseMultiplierBonus,
            releaseBaseMultiplierBonus,
            baseMultiplierScale: 1,
            dmg: dmgMultiplier,
            defense: targetBreakdown.defenseMultiplier,
            resistance: targetBreakdown.resistanceMultiplier,
            stun: targetBreakdown.activeStunMultiplier,
            anomalyProficiency: sourceUnit.anomalyProficiencyMultiplier,
            anomalyLevel: sourceUnit.levelMultiplier,
            attributeAnomalyDamage: anomalyDamageBonus,
            disorderDamage: 1,
            anomalyDamage: anomalyDamageBonus,
            ...(alienation.active ? {
                alienation: alienation.multiplier,
                alienationCoefficientBonus: alienation.coefficientBonus,
            } : {}),
            anomalyCrit: anomalyCrit.multiplier,
            anomalyCritBaseRate: anomalyCrit.baseCritRate,
            anomalyCritConvertedRate: anomalyCrit.convertedCritRate,
            anomalyCritRate: anomalyCrit.critRate,
            anomalyCritDmg: anomalyCrit.critDmg,
            damageScale: event.damageScale,
        },
        targetBreakdown,
        releaseBreakdown,
        sourceUnit,
        whiteBoxRows: includeWhiteBox
            ? anomalyDamageWhiteBoxRows({
                event,
                atk: Number(source.panel.atk ?? 0),
                selectedDmgBonus: sourceUnit.selectedDmgBonus,
                skillDamageBonus: sourceUnit.targetedDmgBonus + releaseTargetedDmgBonus,
                dmgMultiplier,
                targetBreakdown,
                anomalyProficiencyMultiplier: sourceUnit.anomalyProficiencyMultiplier,
                levelMultiplier: sourceUnit.levelMultiplier,
                anomalyDamageBonus,
                alienation,
                anomalyCrit,
                releaseBreakdown,
                baseMultiplierBonus: sourceUnit.baseMultiplierBonus + releaseBaseMultiplierBonus,
                effectiveBaseMultiplier,
                finalDamage,
                singleDamage,
            })
            : [],
    }
}

function luminescenceRuntimeInput(event, panel = {}, outOfCombatPanel = panel, overrides = {}) {
    const danInitialAtk = Math.max(0, Number(overrides.danInitialAtk ?? outOfCombatPanel?.atk ?? panel?.atk ?? 0))
    const danAnomalyProficiency = Math.max(0, Number(overrides.danAnomalyProficiency ?? panel?.anomalyProficiency ?? 0))
    return {
        ...event,
        A: danInitialAtk,
        danInitialAtk,
        P: danAnomalyProficiency,
        danAnomalyProficiency,
    }
}

function evaluateLuminescenceForPanels(event, panel, outOfCombatPanel, bonusTotals, overrides = {}) {
    const modifierMultipliers = luminescenceDamageMultipliersFromModifiers(
        bonusTotals.damageModifiers ?? [],
        event,
    )
    const luminescenceDamageMultiplier = Number.isFinite(Number(overrides.luminescenceDamageMultiplier))
        ? Number(overrides.luminescenceDamageMultiplier)
        : modifierMultipliers.luminescenceDamageMultiplier
    const teamAnomalyDamageMultiplier = Number.isFinite(Number(overrides.teamAnomalyDamageMultiplier))
        ? Number(overrides.teamAnomalyDamageMultiplier)
        : modifierMultipliers.teamAnomalyDamageMultiplier
    return evaluateLuminescence({
        ...luminescenceRuntimeInput(event, panel, outOfCombatPanel, overrides),
        teamAnomalyDamageMultiplier,
        luminescenceDamageMultiplier,
    })
}

function luminescenceScoreWhiteBoxRows(evaluated) {
    const T = Number(evaluated.teammateAttack ?? 0)
    const A = Number(evaluated.danInitialAtk ?? 0)
    const P = Number(evaluated.danAnomalyProficiency ?? 0)
    const sharePct = Number(evaluated.luminescenceDamageSharePct ?? 50)
    const share = Number(evaluated.luminescenceDamageShare ?? sharePct / 100)
    const m2Term = Number(evaluated.cinemaTwoBonus ?? 0) > 0 ? " + 0.20" : ""
    const conversionCoefficient = Number(evaluated.conversionCoefficient ?? 1)
    const coreCoefficient = Number(evaluated.alpha ?? 0)
    const teamAnomalyMultiplier = Number(evaluated.teamAnomalyDamageMultiplier ?? 1)
    const luminescenceMultiplier = Number(evaluated.luminescenceDamageMultiplier ?? 1)
    const proficiencyMultiplier = Number(evaluated.proficiencyMultiplier ?? 1)
    const relativeDamageMultiplier = Number(
        evaluated.luminescenceRelativeDamageMultiplier
            ?? luminescenceMultiplier / teamAnomalyMultiplier,
    )
    const candidateCoreExpression = `[1 + ${formatDamageNumber(coreCoefficient, 6)} × ${formatDamageNumber(P)}]`
    const relativeDamageExpression = `[${formatDamageNumber(luminescenceMultiplier, 6)}`
        + ` / ${formatDamageNumber(teamAnomalyMultiplier, 6)}]`
    const formula = `[${formatDamageNumber(T)} + min(0.40 × ${formatDamageNumber(A)}, 1600)]`
        + ` × [1 + 0.10${m2Term} + 0.0002 × ${formatDamageNumber(P)}]`
        + ` × ${formatDamageNumber(teamAnomalyMultiplier, 6)}`
        + ` × (${candidateCoreExpression} × ${relativeDamageExpression})`
        + `^${formatDamageNumber(share, 6)} × k`
    const numericWeightedExpression = `(${formatDamageNumber(proficiencyMultiplier, 6)}`
        + ` × ${formatDamageNumber(relativeDamageMultiplier, 6)})`
        + `^${formatDamageNumber(share, 6)}`
    return [
        {
            label: "队友初始攻击力",
            value: T,
        },
        {
            label: "丹局外攻击力",
            value: A,
        },
        {
            label: "丹局内异常精通",
            value: P,
        },
        {
            label: "耀变在队伍总伤害中的占比",
            value: sharePct,
            displayValue: `${formatDamageNumber(sharePct, 3)}%`,
        },
        {
            label: "异化倍率",
            value: conversionCoefficient,
            displayValue: formatDamageNumber(conversionCoefficient, 6),
            formula: `1 + 0.10${m2Term} + 0.0002 × ${formatDamageNumber(P)}`
                + ` = ${formatDamageNumber(conversionCoefficient, 6)}`,
        },
        {
            label: "队伍异常评分",
            value: evaluated.score,
            displayValue: `${formatDamageNumber(evaluated.score)} × k`,
            formulaLines: [
                formula,
                `= ${formatDamageNumber(evaluated.commonDamageFactor)}`
                    + ` × ${formatDamageNumber(teamAnomalyMultiplier, 6)}`
                    + ` × ${numericWeightedExpression} × k`,
                `= ${formatDamageNumber(evaluated.score)} × k`,
                "丹所在队伍伤害的最大化，主要取决于队友攻击力、队友其他属性（如异常精通、穿透等）、耀变伤害占比、丹初始攻击力、丹局内精通。为了简化计算，我们将队友攻击力、耀变伤害占比设置为变量，队友其他属性设置为恒变量k，从而得到关于丹攻击力以及异常精通配置的最优解。",
                "该结果用于比较丹的驱动盘方案，不是实际伤害。",
            ],
        },
    ]
}

function calculateLuminescenceDamageEvent({ event, panel, outOfCombatPanel = panel, bonusTotals, includeWhiteBox }) {
    const evaluated = evaluateLuminescenceForPanels(event, panel, outOfCombatPanel, bonusTotals)
    const finalDamage = Number(evaluated.score)
    return {
        id: event.id,
        kind: "anomaly",
        settlementType: "luminescence",
        label: event.label ?? "队伍异常评分",
        objectiveKind: evaluated.objectiveKind,
        scoreSuffix: evaluated.scoreSuffix,
        score: finalDamage,
        finalDamage,
        singleDamage: finalDamage,
        count: 1,
        scalarReady: true,
        scalarBlockReasons: [],
        input: evaluated.event,
        panelSnapshot: {
            atk: Number(outOfCombatPanel?.atk ?? panel?.atk ?? 0),
            anomalyProficiency: Number(panel?.anomalyProficiency ?? 0),
        },
        multipliers: {
            alienation: evaluated.conversionCoefficient,
            proficiency: evaluated.proficiencyMultiplier,
            teamAnomalyDamage: evaluated.teamAnomalyDamageMultiplier,
            luminescenceDamage: evaluated.luminescenceDamageMultiplier,
            luminescenceShare: evaluated.luminescenceDamageShare,
            otherAnomaly: evaluated.otherAnomalyFactor,
            luminescenceFactor: evaluated.luminescenceFactor,
            weightedOtherAnomaly: evaluated.weightedOtherAnomalyMultiplier,
            weightedLuminescence: evaluated.weightedExclusiveMultiplier,
            weightedTeamScore: evaluated.weightedTeamScoreMultiplier,
        },
        targetBreakdown: {},
        luminescence: {
            teammateAttack: evaluated.teammateAttack,
            sharedAttack: evaluated.sharedAttack,
            attackPool: evaluated.attackPool,
            conversionCoefficient: evaluated.conversionCoefficient,
            proficiencyMultiplier: evaluated.proficiencyMultiplier,
            teamAnomalyDamageMultiplier: evaluated.teamAnomalyDamageMultiplier,
            teamAnomalyDamageBonus: evaluated.teamAnomalyDamageBonus,
            luminescenceDamageMultiplier: evaluated.luminescenceDamageMultiplier,
            luminescenceDamageBonus: evaluated.luminescenceDamageBonus,
            luminescenceExclusiveDamageBonus: evaluated.luminescenceExclusiveDamageBonus,
            luminescenceRelativeDamageMultiplier: evaluated.luminescenceRelativeDamageMultiplier,
            luminescenceDamageSharePct: evaluated.luminescenceDamageSharePct,
            luminescenceDamageShare: evaluated.luminescenceDamageShare,
            commonDamageFactor: evaluated.commonDamageFactor,
            otherAnomalyFactor: evaluated.otherAnomalyFactor,
            luminescenceFactor: evaluated.luminescenceFactor,
            luminescenceRelativeFactor: evaluated.luminescenceRelativeFactor,
            exclusiveLuminescenceFactor: evaluated.exclusiveLuminescenceFactor,
            weightedOtherAnomalyMultiplier: evaluated.weightedOtherAnomalyMultiplier,
            weightedExclusiveMultiplier: evaluated.weightedExclusiveMultiplier,
            weightedTeamScoreMultiplier: evaluated.weightedTeamScoreMultiplier,
            score: finalDamage,
        },
        whiteBoxRows: includeWhiteBox ? luminescenceScoreWhiteBoxRows(evaluated) : [],
    }
}

function calculateAnomalyDamageEvent({ event, panel, outOfCombatPanel = panel, bonusTotals, target, agentLevel, includeWhiteBox }) {
    if (isLuminescenceSettlement(event)) {
        return calculateLuminescenceDamageEvent({ event, panel, outOfCombatPanel, bonusTotals, includeWhiteBox })
    }
    event = effectiveDisorderDamageEvent(event, bonusTotals)
    event = effectiveAttributeAnomalyDamageEvent(event, bonusTotals)
    if (isReleaseSettlement(event)) {
        return calculateReleaseDamageEvent({ event, panel, outOfCombatPanel, bonusTotals, target, agentLevel, includeWhiteBox })
    }
    const atk = Number(panel.atk ?? 0)
    const isDisorder = isDisorderDamageEvent(event)
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const dmgMultiplier = 1 + selectedDmgBonus + skillDamageBonus
    const targetBreakdown = targetBreakdownForElement(panel, bonusTotals, target, event.damageElement, eventTotals, event.stunned)
    const anomalyProficiencyMultiplier = Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100
    const levelMultiplier = anomalyLevelMultiplier(agentLevel)
    const attributeAnomalyDamageBonus = isDisorder ? 1 : 1 + Number(eventTotals.attributeAnomalyDamageBonus ?? 0)
    const disorderDamageBonus = isDisorder ? 1 + Number(eventTotals.disorderDamageBonus ?? 0) : 1
    const anomalyDamageBonus = isDisorder ? disorderDamageBonus : attributeAnomalyDamageBonus
    const alienation = alienationBreakdownForEvent(bonusTotals, event)
    const baseMultiplierBonus = isDisorder
        ? sumDamageModifiers(bonusTotals, event, "disorderBaseMultiplierBonus")
        : sumDamageModifiers(bonusTotals, event, "baseMultiplierBonus")
    const baseMultiplierScale = isDisorder ? disorderMultiplierScale(event.disorderType) : 1
    const baseMultiplier = Number(event.baseMultiplier ?? 0)
    const effectiveBaseMultiplier = Math.max(0, baseMultiplier + baseMultiplierBonus) * baseMultiplierScale
    const anomalyCrit = anomalyCritMultiplier(bonusTotals, event, panel, outOfCombatPanel)
    const singleDamage = atk
        * effectiveBaseMultiplier
        * dmgMultiplier
        * targetBreakdown.defenseMultiplier
        * targetBreakdown.resistanceMultiplier
        * targetBreakdown.activeStunMultiplier
        * anomalyProficiencyMultiplier
        * levelMultiplier
        * anomalyDamageBonus
        * alienation.multiplier
        * anomalyCrit.multiplier
        * event.damageScale
    const finalDamage = singleDamage * event.count

    return {
        id: event.id,
        kind: event.kind,
        settlementType: event.settlementType ?? (isDisorderDamageEvent(event) ? "disorder" : "attribute"),
        label: event.label ?? (event.anomalyVariant === "polarizedAssault"
            ? "极性强击"
            : event.anomalyVariant === "release"
                ? "异放"
            : localizedName(event.anomalyLabel, event.anomalyEffect ?? event.previousAnomalyEffect)),
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
            initialAnomalyMastery: Number(outOfCombatPanel?.anomalyMastery ?? panel.anomalyMastery ?? 0),
            dmgBonus: Number(panel.dmgBonus ?? 0),
            [`${event.damageElement}Dmg`]: Number(panel[`${event.damageElement}Dmg`] ?? 0),
            penRatio: Number(panel.penRatio ?? 0),
            panelPenRatio: targetBreakdown.panelPenRatio,
            targetedPenRatio: targetBreakdown.targetedPenRatio,
            effectivePenRatio: targetBreakdown.penRatio,
            penFlat: Number(panel.penFlat ?? 0),
        },
        multipliers: {
            atk,
            anomaly: effectiveBaseMultiplier,
            baseMultiplier,
            originalAnomalyBaseMultiplier: Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0),
            releaseScale: 1,
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
            ...(alienation.active ? {
                alienation: alienation.multiplier,
                alienationCoefficientBonus: alienation.coefficientBonus,
            } : {}),
            anomalyCrit: anomalyCrit.multiplier,
            anomalyCritBaseRate: anomalyCrit.baseCritRate,
            anomalyCritConvertedRate: anomalyCrit.convertedCritRate,
            anomalyCritRate: anomalyCrit.critRate,
            anomalyCritDmg: anomalyCrit.critDmg,
            baseDurationSeconds: Number(event.baseDurationSeconds ?? 0),
            durationBonusSeconds: Number(event.durationBonusSeconds ?? 0),
            durationSeconds: Number(event.durationSeconds ?? 0),
            elapsedSeconds: Number(event.elapsedSeconds ?? 0),
            remainingSeconds: Number(event.remainingSeconds ?? 0),
            tickCount: Number(event.tickCount ?? 0),
            damageScale: event.damageScale,
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
                alienation,
                anomalyCrit,
                baseMultiplierBonus,
                effectiveBaseMultiplier,
                finalDamage,
                singleDamage,
            })
            : [],
    }
}

function calculateDamageResult({ catalog, agent, panel, outOfCombatPanel = panel, bonusTotals, input, includeWhiteBox = true, skillOptions = {} }) {
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
            outOfCombatPanel,
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
        scalarReady: selectedEvent?.scalarReady ?? true,
        scalarBlockReasons: selectedEvent?.scalarBlockReasons ?? [],
        objectiveKind: selectedEvent?.objectiveKind ?? null,
        scoreSuffix: selectedEvent?.scoreSuffix ?? null,
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

function targetDamageMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals = {}, stunned = true) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0) + Number(eventTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0) + Number(eventTotals.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * targetResistanceMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals)
        * targetActiveStunMultiplier(target, stunned, eventTotals)
}

function targetResistanceMultiplierForElement(panel, bonusTotals, target, damageElement, eventTotals = {}) {
    if (damageElement === LUMIFLUX_DAMAGE_ELEMENT) return 1
    const targetResistance = Number(target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[enemyResReductionKey] ?? 0)
        + Number(eventTotals.enemyResReduction ?? 0)
        + Number(eventTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = Number(panel[ALL_RES_IGNORE_KEY] ?? 0)
        + Number(panel[resIgnoreKey] ?? 0)
        + Number(eventTotals[ALL_RES_IGNORE_KEY] ?? 0)
        + Number(eventTotals[resIgnoreKey] ?? 0)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function calculateDirectDamageFinalValueCore(event, panel, bonusTotals, target) {
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementCritDmgKey = CRIT_DMG_KEY_BY_ELEMENT[event.damageElement]
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const directDamageBonus = sumDamageModifiers(bonusTotals, event, "directDamageBonus")
        + Number(eventTotals.dmgBonus ?? 0)
        + Number(eventTotals[elementDmgKey] ?? 0)
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    return directDamageBasisValue(panel, event)
        * effectiveSkillMultiplier
        * (1 + selectedDmgBonus + directDamageBonus)
        * targetDamageMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals, event.stunned)
        * critMultiplierForMode(
            panel,
            event.critMode,
            Number(eventTotals.critDmg ?? 0) + Number(eventTotals[elementCritDmgKey] ?? 0),
        )
        * event.damageScale
        * Number(event.count ?? 1)
}

function calculateAnomalyDamageFinalValue(event, panel, bonusTotals, target, agentLevel, outOfCombatPanel = panel) {
    if (isLuminescenceSettlement(event)) {
        return evaluateLuminescenceForPanels(event, panel, outOfCombatPanel, bonusTotals).score
    }
    event = effectiveDisorderDamageEvent(event, bonusTotals)
    event = effectiveAttributeAnomalyDamageEvent(event, bonusTotals)
    if (isReleaseSettlement(event)) {
        return calculateReleaseDamageEvent({
            event,
            panel,
            outOfCombatPanel,
            bonusTotals,
            target,
            agentLevel,
            includeWhiteBox: false,
        }).finalDamage
    }
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
    const baseMultiplier = Number(event.baseMultiplier ?? 0)
    const effectiveBaseMultiplier = Math.max(0, baseMultiplier + baseMultiplierBonus) * baseMultiplierScale
    const anomalyDamageBonus = 1 + Number(eventTotals.anomalyDamageBonus ?? 0)
    const alienationMultiplier = alienationBreakdownForEvent(bonusTotals, event).multiplier
    const anomalyCritMultiplierValue = anomalyCritMultiplier(bonusTotals, event, panel, outOfCombatPanel).multiplier
    return Number(panel.atk ?? 0)
        * effectiveBaseMultiplier
        * (1 + selectedDmgBonus + skillDamageBonus)
        * targetDamageMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals, event.stunned)
        * anomalyProficiencyMultiplier
        * anomalyLevelMultiplier(agentLevel)
        * anomalyDamageBonus
        * alienationMultiplier
        * anomalyCritMultiplierValue
        * event.damageScale
        * Number(event.count ?? 1)
}

function calculateSheerDamageFinalValue(event, panel, bonusTotals, target, agent = {}) {
    const eventTotals = eventTargetTotalsForElement(bonusTotals, event)
    const elementDmgKey = `${event.damageElement}Dmg`
    const elementSheerDmgKey = SHEER_DMG_KEY_BY_ELEMENT[event.damageElement]
    const elementCritDmgKey = CRIT_DMG_KEY_BY_ELEMENT[event.damageElement]
    const selectedDmgBonus = selectedDmgBonusForElement(panel, event.damageElement)
    const skillDamageBonus = Number(eventTotals.dmgBonus ?? 0) + Number(eventTotals[elementDmgKey] ?? 0)
    const sheerDmgBonus = Number(eventTotals.sheerDmgBonus ?? 0) + Number(eventTotals[elementSheerDmgKey] ?? 0)
    const skillMultiplierBonus = Number(eventTotals.skillMultiplierBonus ?? 0)
    const effectiveSkillMultiplier = Math.max(0, Number(event.skillMultiplier ?? 0) + skillMultiplierBonus)
    return effectiveSheerForceFromPanel(agent, panel)
        * effectiveSkillMultiplier
        * critMultiplierForMode(
            panel,
            event.critMode,
            Number(eventTotals.critDmg ?? 0) + Number(eventTotals[elementCritDmgKey] ?? 0),
        )
        * (1 + selectedDmgBonus + skillDamageBonus)
        * targetResistanceMultiplierForElement(panel, bonusTotals, target, event.damageElement, eventTotals)
        * (1 + sheerDmgBonus)
        * targetActiveStunMultiplier(target, event.stunned, eventTotals)
        * event.damageScale
        * Number(event.count ?? 1)
}

function calculateDirectDamageFinalValue(event, panel, bonusTotals, target) {
    const componentEvents = generatedDirectDamageComponentEvents(event)
    if (componentEvents.length < 2) {
        return calculateDirectDamageFinalValueCore(event, panel, bonusTotals, target)
    }

    return componentEvents.reduce(
        (total, componentEvent) => total + calculateDirectDamageFinalValueCore(componentEvent, panel, bonusTotals, target),
        0,
    )
}

function calculateDamageTotalFinalValue({ agent, panel, outOfCombatPanel = panel, bonusTotals, damageRequest }) {
    const target = damageRequest.target
    let total = 0
    for (const event of damageRequest.events ?? []) {
        if (event.kind === "direct") {
            total += calculateDirectDamageFinalValue(event, panel, bonusTotals, target)
        } else if (event.kind === "sheer") {
            total += calculateSheerDamageFinalValue(event, panel, bonusTotals, target, agent)
        } else {
            total += calculateAnomalyDamageFinalValue(event, panel, bonusTotals, target, damageRequest.agentLevel, outOfCombatPanel)
        }
    }
    return total
}

function compileDamageScoreEvent(event = {}) {
    const damageElement = event.damageElement
    return {
        event,
        kind: event.kind,
        settlementType: event.settlementType ?? null,
        isLuminescence: isLuminescenceSettlement(event),
        isRelease: isReleaseSettlement(event),
        isDisorder: isDisorderDamageEvent(event),
        damageElement,
        resistanceFixedOne: damageElement === LUMIFLUX_DAMAGE_ELEMENT,
        elementDmgKey: `${damageElement}Dmg`,
        elementSheerDmgKey: SHEER_DMG_KEY_BY_ELEMENT[damageElement],
        elementCritDmgKey: CRIT_DMG_KEY_BY_ELEMENT[damageElement],
        elementDefIgnoreKey: DEF_IGNORE_KEY_BY_ELEMENT[damageElement],
        resIgnoreKey: RES_IGNORE_KEY_BY_ELEMENT[damageElement],
        resReductionKey: RES_REDUCTION_KEY_BY_ELEMENT[damageElement],
        skillMultiplier: Number(event.skillMultiplier ?? 0),
        baseMultiplier: Number(event.baseMultiplier ?? 0),
        baseMultiplierPerProc: Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0),
        procCount: Number(event.procCount ?? 1),
        usesDefaultProcCount: event.usesDefaultProcCount === true,
        anomalyVariant: event.anomalyVariant ?? "normal",
        releaseProfile: event.releaseProfile ?? null,
        releaseCoreScalingRow: event.releaseCoreScalingRow ?? null,
        triggerActorRef: event.triggerActorRef ?? null,
        anomalySource: event.anomalySource ?? null,
        fixedMultiplier: Number(event.fixedMultiplier ?? 0),
        tickMultiplier: Number(event.tickMultiplier ?? 0),
        tickIntervalSeconds: Number(event.tickIntervalSeconds ?? 0.5),
        baseDurationSeconds: Number(event.baseDurationSeconds ?? event.durationSeconds ?? 0),
        elapsedSeconds: Number(event.elapsedSeconds ?? 0),
        baseMultiplierScale: isDisorderDamageEvent(event) ? disorderMultiplierScale(event.disorderType) : 1,
        damageBasis: normalizeDirectDamageBasis(event.damageBasis),
        damageScale: Number(event.damageScale ?? 1),
        remainingSeconds: Number(event.remainingSeconds ?? 0),
        count: Number(event.count ?? 1),
        critMode: event.critMode,
        stunned: normalizeEventStunned(event.stunned),
    }
}

function compileDamageScoreTarget(damageRequest = {}, agent = {}) {
    return {
        target: damageRequest.target,
        agentLevel: damageRequest.agentLevel,
        anomalyLevelMultiplier: anomalyLevelMultiplier(damageRequest.agentLevel),
        isRuptureAgent: isRuptureAgent(agent),
        // Keep the stored parent event intact for the UI, while compiled score
        // kernels evaluate generated hit totals one constituent at a time.
        events: (damageRequest.events ?? [])
            .flatMap(event => generatedDirectDamageComponentEvents(event))
            .map(event => compileDamageScoreEvent(event)),
    }
}

function compiledEventBaseMultiplier(compiledEvent, durationBonusSeconds = 0, panel = {}, outOfCombatPanel = panel) {
    if (compiledEvent.isRelease) {
        return releaseBreakdownForEvent(compiledEvent, panel, outOfCombatPanel).finalBaseMultiplier
    }
    if (!compiledEvent.isDisorder) {
        if (compiledEvent.usesDefaultProcCount
            && compiledEvent.baseDurationSeconds > 0
            && compiledEvent.tickIntervalSeconds > 0
            && durationBonusSeconds > 0) {
            const extraProcCount = Math.max(0, Math.floor((durationBonusSeconds + 1e-9) / compiledEvent.tickIntervalSeconds))
            return compiledEvent.baseMultiplierPerProc * (compiledEvent.procCount + extraProcCount)
        }
        return compiledEvent.baseMultiplier
    }
    return disorderBaseMultiplier({
        defaultDurationSeconds: compiledEvent.baseDurationSeconds,
        fixedMultiplier: compiledEvent.fixedMultiplier,
        tickMultiplier: compiledEvent.tickMultiplier,
        tickIntervalSeconds: compiledEvent.tickIntervalSeconds,
    }, compiledEvent.elapsedSeconds, durationBonusSeconds).baseMultiplier
}

function modifierSumsForCompiledEvent(modifiers = [], event = {}) {
    let sums = null
    for (const modifier of modifiers) {
        if (!modifier?.kind
            || IGNORED_DAMAGE_MODIFIER_KINDS.has(modifier.kind)
            || !damageModifierAppliesTo(modifier, event)) {
            continue
        }
        const value = modifierValueForEvent(modifier, event)
        sums ??= Object.create(null)
        sums[modifier.kind] = Number(sums[modifier.kind] ?? 0) + value
        if (isTeamAnomalyDamageModifier(modifier)) {
            sums[TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY] = Number(
                sums[TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY] ?? 0,
            ) + value
        }
    }
    return sums
}

function compiledModifierSum(sums, kind) {
    return Number(sums?.[kind] ?? 0)
}

function compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums) {
    if (compiledEvent.resistanceFixedOne) return 1
    const targetResistance = Number(target.resistanceByElement?.[compiledEvent.damageElement] ?? 0)
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[compiledEvent.resReductionKey] ?? 0)
        + compiledModifierSum(sums, "enemyResReduction")
        + compiledModifierSum(sums, compiledEvent.resReductionKey)
    const resIgnore = Number(panel[ALL_RES_IGNORE_KEY] ?? 0)
        + Number(panel[compiledEvent.resIgnoreKey] ?? 0)
        + compiledModifierSum(sums, ALL_RES_IGNORE_KEY)
        + compiledModifierSum(sums, compiledEvent.resIgnoreKey)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0)
        + compiledModifierSum(sums, "enemyDefReduction")
        + compiledModifierSum(sums, compiledEvent.elementDefIgnoreKey)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0) + compiledModifierSum(sums, "penRatio")
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums)
        * targetActiveStunMultiplier(target, compiledEvent.stunned, {
            stunDmgMultiplierBonus: compiledModifierSum(sums, "stunDmgMultiplierBonus"),
            stunDmgMultiplierBonusAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusAlways"),
            stunDmgMultiplierBonusCapAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusCapAlways"),
        })
}

function compiledCritMultiplier(panel, critMode, compiledEvent, sums) {
    const critRate = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)
        + compiledModifierSum(sums, "critDmg")
        + compiledModifierSum(sums, compiledEvent.elementCritDmgKey)
    if (critMode === "crit") {
        return 1 + critDmg
    }
    if (critMode === "nonCrit") {
        return 1
    }
    return critRate * (1 + critDmg) + (1 - critRate)
}

function compiledAnomalyCritMultiplier(compiledEvent, sums, initialAnomalyMastery = 0) {
    if (compiledEvent.isDisorder) {
        return 1
    }
    const baseCritRate = compiledModifierSum(sums, "anomalyCritRate")
    const masteryCritRate = compiledEvent.anomalyVariant === "release" && baseCritRate > 0
        ? Math.max(initialAnomalyMastery - compiledEvent.releaseCritRateMasteryThreshold, 0)
            * compiledEvent.releaseCritRatePerMasteryPoint
        : 0
    const critRate = clampNumber(baseCritRate + masteryCritRate, 0, 1)
    const critDmg = Math.max(0, compiledModifierSum(sums, "anomalyCritDmg"))
    return critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1
}

function calculateCompiledDamageScoreValue({ agent, panel, outOfCombatPanel = panel, bonusTotals, compiledDamageTarget }) {
    const modifiers = bonusTotals.damageModifiers ?? []
    const target = compiledDamageTarget.target
    let total = 0
    for (const compiledEvent of compiledDamageTarget.events ?? []) {
        const event = compiledEvent.event
        const initialAnomalyMastery = Number(outOfCombatPanel?.anomalyMastery ?? panel.anomalyMastery ?? 0)
        const sums = modifierSumsForCompiledEvent(modifiers, event)
        const selectedDmgBonus = selectedDmgBonusForElement(panel, compiledEvent.damageElement)
        const skillDamageBonus = compiledModifierSum(sums, "dmgBonus")
            + compiledModifierSum(sums, compiledEvent.elementDmgKey)

        if (compiledEvent.isLuminescence) {
            total += evaluateLuminescenceForPanels(event, panel, outOfCombatPanel, bonusTotals, {
                luminescenceDamageMultiplier: Math.max(
                    0,
                    1 + compiledModifierSum(sums, "anomalyDamageBonus"),
                ),
                teamAnomalyDamageMultiplier: Math.max(
                    0,
                    1 + compiledModifierSum(sums, TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY),
                ),
            }).score
            continue
        }

        if (compiledEvent.isRelease) {
            total += calculateReleaseDamageEvent({
                event,
                panel,
                outOfCombatPanel,
                bonusTotals,
                target,
                agentLevel: compiledDamageTarget.agentLevel,
                includeWhiteBox: false,
            }).finalDamage
            continue
        }

        if (compiledEvent.kind === "direct") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + compiledModifierSum(sums, "skillMultiplierBonus"),
            )
            const directDamageBonus = compiledModifierSum(sums, "directDamageBonus") + skillDamageBonus
            total += directDamageBasisValue(panel, compiledEvent)
                * effectiveSkillMultiplier
                * (1 + selectedDmgBonus + directDamageBonus)
                * compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums)
                * compiledCritMultiplier(panel, compiledEvent.critMode, compiledEvent, sums)
                * compiledEvent.damageScale
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
                * compiledCritMultiplier(panel, compiledEvent.critMode, compiledEvent, sums)
                * (1 + selectedDmgBonus + skillDamageBonus)
                * compiledResistanceMultiplier(panel, bonusTotals, target, compiledEvent, sums)
                * (1 + sheerDmgBonus)
                * targetActiveStunMultiplier(target, compiledEvent.stunned, {
                    stunDmgMultiplierBonus: compiledModifierSum(sums, "stunDmgMultiplierBonus"),
                    stunDmgMultiplierBonusAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusAlways"),
                    stunDmgMultiplierBonusCapAlways: compiledModifierSum(sums, "stunDmgMultiplierBonusCapAlways"),
                })
                * compiledEvent.damageScale
                * compiledEvent.count
            continue
        }

        const effectiveBaseMultiplier = Math.max(
            0,
            compiledEventBaseMultiplier(
                compiledEvent,
                compiledModifierSum(sums, "anomalyDurationBonusSeconds"),
                panel,
                outOfCombatPanel,
            ) + compiledModifierSum(
                sums,
                compiledEvent.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
            ),
        ) * compiledEvent.baseMultiplierScale
        const anomalyDamageBonus = 1 + (
            compiledEvent.isDisorder
                ? compiledModifierSum(sums, "disorderDamageBonus")
                : compiledModifierSum(sums, "anomalyDamageBonus")
        )
        const alienationMultiplier = Math.max(
            0,
            1 + compiledModifierSum(sums, "alienationCoefficientBonus"),
        )
        total += Number(panel.atk ?? 0)
            * effectiveBaseMultiplier
            * (1 + selectedDmgBonus + skillDamageBonus)
            * compiledTargetDamageMultiplier(panel, bonusTotals, target, compiledEvent, sums)
            * (Math.max(0, Number(panel.anomalyProficiency ?? 0)) / 100)
            * compiledDamageTarget.anomalyLevelMultiplier
            * anomalyDamageBonus
            * alienationMultiplier
            * compiledAnomalyCritMultiplier(compiledEvent, sums, initialAnomalyMastery)
            * compiledEvent.damageScale
            * compiledEvent.count
    }
    return total
}

function denseModifierSum(sums, kind) {
    const index = DAMAGE_MODIFIER_SUM_KEY_LOOKUP[kind]
    return index === undefined ? 0 : Number(sums[index] ?? 0)
}

function denseOutOfCombatStatRequirementMatches(requirement = {}, panelValues = null) {
    const config = outOfCombatStatRequirement(requirement)
    if (!config) {
        return true
    }
    if (!panelValues) {
        return false
    }
    const value = densePanelValue(panelValues, config.stat)
    return Number.isFinite(value)
        && (config.min === null || value >= config.min)
        && (config.max === null || value <= config.max)
}

function fillDenseModifierSums(sums, eventModifierEntries = [], activeEntryFlags = [], outOfCombatPanelValues = null) {
    sums.fill(0)
    for (const modifier of eventModifierEntries ?? []) {
        if (activeEntryFlags[modifier.entryIndex]
            && denseOutOfCombatStatRequirementMatches(modifier.requirement, outOfCombatPanelValues)) {
            sums[modifier.kindIndex] += modifier.value
        }
    }
}

function denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, sums) {
    if (compiledEvent.resistanceFixedOne) return 1
    const targetResistance = Number(target.resistanceByElement?.[compiledEvent.damageElement] ?? 0)
    const enemyResReduction = denseCombatValue(combatValues, "enemyResReduction")
        + denseCombatValue(combatValues, compiledEvent.resReductionKey)
        + denseModifierSum(sums, "enemyResReduction")
        + denseModifierSum(sums, compiledEvent.resReductionKey)
    const resIgnore = densePanelValue(panelValues, ALL_RES_IGNORE_KEY)
        + densePanelValue(panelValues, compiledEvent.resIgnoreKey)
        + denseModifierSum(sums, ALL_RES_IGNORE_KEY)
        + denseModifierSum(sums, compiledEvent.resIgnoreKey)
    return clampNumber(1 - (targetResistance - enemyResReduction - resIgnore), 0.01, 2)
}

function denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, sums) {
    const targetDefense = Number(target.defense ?? 0)
    const levelCoefficient = Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const enemyDefReduction = denseCombatValue(combatValues, "enemyDefReduction")
        + denseModifierSum(sums, "enemyDefReduction")
        + denseModifierSum(sums, compiledEvent.elementDefIgnoreKey)
    const enemyDefFlatReduction = denseCombatValue(combatValues, "enemyDefFlatReduction")
    const penRatio = densePanelValue(panelValues, "penRatio") + denseModifierSum(sums, "penRatio")
    const penFlat = densePanelValue(panelValues, "penFlat")
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    return defenseMultiplier
        * denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, sums)
        * targetActiveStunMultiplier(target, compiledEvent.stunned, {
            stunDmgMultiplierBonus: denseModifierSum(sums, "stunDmgMultiplierBonus"),
            stunDmgMultiplierBonusAlways: denseModifierSum(sums, "stunDmgMultiplierBonusAlways"),
            stunDmgMultiplierBonusCapAlways: denseModifierSum(sums, "stunDmgMultiplierBonusCapAlways"),
        })
}

function denseCritMultiplier(panelValues, critMode, compiledEvent, sums) {
    const critRate = clampNumber(densePanelValue(panelValues, "critRate"), 0, 1)
    const critDmg = densePanelValue(panelValues, "critDmg")
        + denseModifierSum(sums, "critDmg")
        + denseModifierSum(sums, compiledEvent.elementCritDmgKey)
    if (critMode === "crit") {
        return 1 + critDmg
    }
    if (critMode === "nonCrit") {
        return 1
    }
    return critRate * (1 + critDmg) + (1 - critRate)
}

function denseAnomalyCritMultiplier(compiledEvent, sums, panel = {}, outOfCombatPanel = panel) {
    if (compiledEvent.isDisorder) {
        return 1
    }
    const baseCritRate = denseModifierSum(sums, "anomalyCritRate")
    const critRatePerInitialMasteryPoint = denseModifierSum(
        sums,
        "anomalyCritRatePerInitialMasteryAbove100",
    )
    const convertedCritRate = critRatePerInitialMasteryPoint !== 0
        ? calculateInitialMasteryConvertedAnomalyCritRate(
            outOfCombatPanel?.anomalyMastery ?? panel?.anomalyMastery,
            critRatePerInitialMasteryPoint,
        )
        : baseCritRate > 0
            ? releaseCritRateBonusForEvent(compiledEvent, panel, outOfCombatPanel)
            : 0
    const critRate = clampNumber(baseCritRate + convertedCritRate, 0, 1)
    const critDmg = Math.max(0, denseModifierSum(sums, "anomalyCritDmg"))
    return critRate > 0 && critDmg > 0 ? 1 + critRate * critDmg : 1
}

function denseSelectedDmgBonusForElement(panelValues, damageElement) {
    return densePanelValue(panelValues, "dmgBonus") + densePanelValue(panelValues, `${damageElement}Dmg`)
}

function densePanelProxy(panelValues) {
    return new Proxy({}, {
        get(_target, property) {
            return typeof property === "string" ? densePanelValue(panelValues, property) : undefined
        },
    })
}

function calculateCompiledDamageScoreValueDense({
    agent,
    panelValues,
    outOfCombatPanelValues = panelValues,
    combatValues,
    compiledDamageTarget,
    eventModifierEntries,
    activeEntryFlags,
    modifierSums,
}) {
    const target = compiledDamageTarget.target
    let total = 0
    const events = compiledDamageTarget.events ?? []
    const panelProxy = densePanelProxy(panelValues)
    const outOfCombatPanelProxy = densePanelProxy(outOfCombatPanelValues)
    for (let index = 0; index < events.length; index += 1) {
        const compiledEvent = events[index]
        fillDenseModifierSums(
            modifierSums,
            eventModifierEntries[index],
            activeEntryFlags,
            outOfCombatPanelValues,
        )
        if (compiledEvent.isLuminescence) {
            const evaluated = evaluateLuminescence({
                ...luminescenceRuntimeInput(
                    compiledEvent.event,
                    panelProxy,
                    outOfCombatPanelProxy,
                ),
                luminescenceDamageMultiplier: Math.max(
                    0,
                    1 + denseModifierSum(modifierSums, "anomalyDamageBonus"),
                ),
                teamAnomalyDamageMultiplier: Math.max(
                    0,
                    1 + denseModifierSum(modifierSums, TEAM_ANOMALY_DAMAGE_MODIFIER_SUM_KEY),
                ),
            })
            total += evaluated.score
            continue
        }
        const selectedDmgBonus = denseSelectedDmgBonusForElement(panelValues, compiledEvent.damageElement)
        const skillDamageBonus = denseModifierSum(modifierSums, "dmgBonus")
            + denseModifierSum(modifierSums, compiledEvent.elementDmgKey)

        if (compiledEvent.kind === "direct") {
            const effectiveSkillMultiplier = Math.max(
                0,
                compiledEvent.skillMultiplier + denseModifierSum(modifierSums, "skillMultiplierBonus"),
            )
            const directDamageBonus = denseModifierSum(modifierSums, "directDamageBonus") + skillDamageBonus
            total += densePanelValue(panelValues, compiledEvent.damageBasis === "anomalyProficiency" ? "anomalyProficiency" : "atk")
                * effectiveSkillMultiplier
                * (1 + selectedDmgBonus + directDamageBonus)
                * denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
                * denseCritMultiplier(panelValues, compiledEvent.critMode, compiledEvent, modifierSums)
                * compiledEvent.damageScale
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
                * denseCritMultiplier(panelValues, compiledEvent.critMode, compiledEvent, modifierSums)
                * (1 + selectedDmgBonus + skillDamageBonus)
                * denseResistanceMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
                * (1 + sheerDmgBonus)
                * targetActiveStunMultiplier(target, compiledEvent.stunned, {
                    stunDmgMultiplierBonus: denseModifierSum(modifierSums, "stunDmgMultiplierBonus"),
                    stunDmgMultiplierBonusAlways: denseModifierSum(modifierSums, "stunDmgMultiplierBonusAlways"),
                    stunDmgMultiplierBonusCapAlways: denseModifierSum(modifierSums, "stunDmgMultiplierBonusCapAlways"),
                })
                * compiledEvent.damageScale
                * compiledEvent.count
            continue
        }

        const effectiveBaseMultiplier = Math.max(
            0,
            compiledEventBaseMultiplier(
                compiledEvent,
                denseModifierSum(modifierSums, "anomalyDurationBonusSeconds"),
                panelProxy,
                outOfCombatPanelProxy,
            ) + denseModifierSum(
                modifierSums,
                compiledEvent.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
            ),
        ) * compiledEvent.baseMultiplierScale
        const anomalyDamageBonus = 1 + (
            compiledEvent.isDisorder
                ? denseModifierSum(modifierSums, "disorderDamageBonus")
                : denseModifierSum(modifierSums, "anomalyDamageBonus")
        )
        const alienationMultiplier = Math.max(
            0,
            1 + denseModifierSum(modifierSums, "alienationCoefficientBonus"),
        )
        total += densePanelValue(panelValues, "atk")
            * effectiveBaseMultiplier
            * (1 + selectedDmgBonus + skillDamageBonus)
            * denseTargetDamageMultiplier(panelValues, combatValues, target, compiledEvent, modifierSums)
            * (Math.max(0, densePanelValue(panelValues, "anomalyProficiency")) / 100)
            * compiledDamageTarget.anomalyLevelMultiplier
            * anomalyDamageBonus
            * alienationMultiplier
            * denseAnomalyCritMultiplier(compiledEvent, modifierSums, panelProxy, outOfCombatPanelProxy)
            * compiledEvent.damageScale
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

function calculateDamageWhiteBox({ catalog, agent, panel, outOfCombatPanel = panel, selectedDmgBonus, bonusTotals, input, skillOptions = {} }) {
    void selectedDmgBonus
    return calculateDamageResult({
        catalog,
        agent,
        panel,
        outOfCombatPanel,
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

function resolveDirectDamageElement(agent = {}) {
    const damageElement = agent.damageElement ?? agent.attribute
    return DIRECT_DAMAGE_ELEMENTS.has(damageElement) ? damageElement : resolveDamageElement(agent)
}

function resolveAttributeBonusKey(agent) {
    const damageElement = resolveDirectDamageElement(agent)
    return DAMAGE_ELEMENTS.includes(damageElement) ? `${damageElement}Dmg` : null
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
    const panelBaseAdditions = {
        anomalyMastery: 0,
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
            } else if (stat.target === "panel" && stat.stat === "anomalyMasteryFlat" && stat.mode === "flat") {
                panelBaseAdditions.anomalyMastery += stat.value
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
        panelBaseAdditions,
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
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0) + coreSkill.panelBaseAdditions.anomalyMastery,
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
    panel.anomalyMastery = calculateAnomalyMastery(
        basePanelStats.anomalyMastery,
        bonusTotals.anomalyMasteryPct,
        bonusTotals.anomalyMasteryFlat,
    )
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
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0) + coreSkill.panelBaseAdditions.anomalyMastery,
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

    function compileDenseOutOfCombatTarget(statIds = [], setIds = [], candidateStatIndexes = []) {
        const baseBonusValues = new Float64Array(BONUS_KEYS.length)
        for (const key of BONUS_KEYS) {
            baseBonusValues[BONUS_KEY_INDEX.get(key)] = Number(staticBonusTotals[key] ?? 0)
        }
        const statToBonusIndexes = (statIds ?? []).map(stat => ({
            index: BONUS_KEY_INDEX.get(BONUS_KEY_MAP[stat]),
            factor: STORED_PERCENT_STATS.has(stat) ? 0.01 : 1,
        }))
        const statTermsByBonusIndex = Array.from({ length: BONUS_KEYS.length }, () => [])
        for (let statIndex = 0; statIndex < statToBonusIndexes.length; statIndex += 1) {
            const target = statToBonusIndexes[statIndex]
            if (target.index !== undefined) {
                statTermsByBonusIndex[target.index].push({ statIndex, factor: target.factor })
            }
        }
        const compiledSetBonuses = compileDenseOutOfCombatSetBonuses(driveDiscSets, setIds)
        const allStatIndexes = statToBonusIndexes.map((_, index) => index)
        const bonusValues = new Float64Array(BONUS_KEYS.length)
        const panelValues = new Float64Array(OUTPUT_PANEL_KEYS.length)
        const isRupture = isRuptureAgent(agent)

        function scorePrepared(statValues = [], activeStatIndexes = null) {
            const indexes = activeStatIndexes?.length
                ? activeStatIndexes
                : allStatIndexes
            for (const index of indexes) {
                const value = Number(statValues[index] ?? 0)
                const target = statToBonusIndexes[index]
                if (value !== 0 && target.index !== undefined) {
                    bonusValues[target.index] += value * target.factor
                }
            }

            const hp = base.hp * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "hpPct"))
                + denseValue(bonusValues, BONUS_KEY_INDEX, "hpFlat")
            const atk = base.atk * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "atkPct"))
                + denseValue(bonusValues, BONUS_KEY_INDEX, "atkFlat")
            const def = base.def * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "defPct"))
                + denseValue(bonusValues, BONUS_KEY_INDEX, "defFlat")
            panelValues[PANEL_KEY_LOOKUP.hp] = hp
            panelValues[PANEL_KEY_LOOKUP.atk] = atk
            panelValues[PANEL_KEY_LOOKUP.def] = def
            panelValues[PANEL_KEY_LOOKUP.critRate] = basePanelStats.critRate + denseValue(bonusValues, BONUS_KEY_INDEX, "critRate")
            panelValues[PANEL_KEY_LOOKUP.critDmg] = basePanelStats.critDmg + denseValue(bonusValues, BONUS_KEY_INDEX, "critDmg")
            panelValues[PANEL_KEY_LOOKUP.impact] = (basePanelStats.impact * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "impactPct")))
                + denseValue(bonusValues, BONUS_KEY_INDEX, "impactFlat")
            panelValues[PANEL_KEY_LOOKUP.anomalyProficiency] = basePanelStats.anomalyProficiency
                + denseValue(bonusValues, BONUS_KEY_INDEX, "anomalyProficiencyFlat")
            panelValues[PANEL_KEY_LOOKUP.anomalyMastery] = calculateAnomalyMastery(
                basePanelStats.anomalyMastery,
                denseValue(bonusValues, BONUS_KEY_INDEX, "anomalyMasteryPct"),
                denseValue(bonusValues, BONUS_KEY_INDEX, "anomalyMasteryFlat"),
            )
            panelValues[PANEL_KEY_LOOKUP.energyRegen] = basePanelStats.energyRegen
                * (1 + denseValue(bonusValues, BONUS_KEY_INDEX, "energyRegenPct"))
            panelValues[PANEL_KEY_LOOKUP.penFlat] = basePanelStats.penFlat + denseValue(bonusValues, BONUS_KEY_INDEX, "penFlat")
            panelValues[PANEL_KEY_LOOKUP.penRatio] = basePanelStats.penRatio + denseValue(bonusValues, BONUS_KEY_INDEX, "penRatio")
            for (const key of RES_IGNORE_KEYS) {
                panelValues[PANEL_KEY_LOOKUP[key]] = denseValue(bonusValues, BONUS_KEY_INDEX, key)
            }
            panelValues[PANEL_KEY_LOOKUP.dmgBonus] = basePanelStats.dmgBonus + denseValue(bonusValues, BONUS_KEY_INDEX, "dmgBonus")
            for (const element of DAMAGE_ELEMENTS) {
                const key = `${element}Dmg`
                panelValues[PANEL_KEY_LOOKUP[key]] = denseValue(bonusValues, BONUS_KEY_INDEX, key)
            }
            panelValues[PANEL_KEY_LOOKUP.sheerForceFlat] = isRupture
                ? denseValue(bonusValues, BONUS_KEY_INDEX, "sheerForceFlat")
                : 0
            panelValues[PANEL_KEY_LOOKUP.sheerForce] = isRupture
                ? Math.max(0, (hp * SHEER_FORCE_HP_RATIO) + (atk * SHEER_FORCE_ATK_RATIO) + panelValues[PANEL_KEY_LOOKUP.sheerForceFlat])
                : 0

            return {
                base,
                bonusValues,
                panelValues,
            }
        }

        return {
            score(statValues = [], setCountValues = []) {
                bonusValues.set(baseBonusValues)
                addDenseSetBonuses(bonusValues, setCountValues, compiledSetBonuses)
                return scorePrepared(statValues)
            },
            compileForSetCounts(setCountValues = []) {
                const fixedBonusValues = new Float64Array(baseBonusValues)
                addDenseSetBonuses(fixedBonusValues, setCountValues, compiledSetBonuses)

                function indexedVectorValue(vector, statIndex) {
                    if (!vector) {
                        return 0
                    }
                    for (let cursor = 0; cursor < vector.indexes.length; cursor += 1) {
                        if (vector.indexes[cursor] === statIndex) {
                            return Number(vector.values[cursor] ?? 0)
                        }
                    }
                    return 0
                }

                function bonusValue(statValues, key, denseVector = null, indexedVectorA = null, indexedVectorB = null) {
                    const bonusIndex = BONUS_KEY_INDEX.get(key)
                    if (bonusIndex === undefined) {
                        return 0
                    }
                    let value = Number(fixedBonusValues[bonusIndex] ?? 0)
                    for (const term of statTermsByBonusIndex[bonusIndex]) {
                        const statIndex = term.statIndex
                        const statValue = Number(statValues[statIndex] ?? 0)
                            + Number(denseVector?.[statIndex] ?? 0)
                            + indexedVectorValue(indexedVectorA, statIndex)
                            + indexedVectorValue(indexedVectorB, statIndex)
                        value += statValue * term.factor
                    }
                    return value
                }

                function panelValue(statValues, key, denseVector = null, indexedVectorA = null, indexedVectorB = null) {
                    if (key === "hp") return base.hp * (1 + bonusValue(statValues, "hpPct", denseVector, indexedVectorA, indexedVectorB))
                        + bonusValue(statValues, "hpFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "atk") return base.atk * (1 + bonusValue(statValues, "atkPct", denseVector, indexedVectorA, indexedVectorB))
                        + bonusValue(statValues, "atkFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "def") return base.def * (1 + bonusValue(statValues, "defPct", denseVector, indexedVectorA, indexedVectorB))
                        + bonusValue(statValues, "defFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "critRate") return basePanelStats.critRate
                        + bonusValue(statValues, "critRate", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "critDmg") return basePanelStats.critDmg
                        + bonusValue(statValues, "critDmg", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "impact") return basePanelStats.impact
                        * (1 + bonusValue(statValues, "impactPct", denseVector, indexedVectorA, indexedVectorB))
                        + bonusValue(statValues, "impactFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "anomalyProficiency") return basePanelStats.anomalyProficiency
                        + bonusValue(statValues, "anomalyProficiencyFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "anomalyMastery") return calculateAnomalyMastery(
                        basePanelStats.anomalyMastery,
                        bonusValue(statValues, "anomalyMasteryPct", denseVector, indexedVectorA, indexedVectorB),
                        bonusValue(statValues, "anomalyMasteryFlat", denseVector, indexedVectorA, indexedVectorB),
                    )
                    if (key === "energyRegen") return basePanelStats.energyRegen
                        * (1 + bonusValue(statValues, "energyRegenPct", denseVector, indexedVectorA, indexedVectorB))
                    if (key === "penFlat") return basePanelStats.penFlat
                        + bonusValue(statValues, "penFlat", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "penRatio") return basePanelStats.penRatio
                        + bonusValue(statValues, "penRatio", denseVector, indexedVectorA, indexedVectorB)
                    if (key === "dmgBonus") return basePanelStats.dmgBonus
                        + bonusValue(statValues, "dmgBonus", denseVector, indexedVectorA, indexedVectorB)
                    return bonusValue(statValues, key, denseVector, indexedVectorA, indexedVectorB)
                }

                return {
                    base,
                    panelValue,
                    score(statValues = []) {
                        bonusValues.set(fixedBonusValues)
                        return scorePrepared(statValues, candidateStatIndexes)
                    },
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
            panel.anomalyMastery = calculateAnomalyMastery(
                basePanelStats.anomalyMastery,
                bonusTotals.anomalyMasteryPct,
                bonusTotals.anomalyMasteryFlat,
            )
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
            panel.anomalyMastery = calculateAnomalyMastery(
                basePanelStats.anomalyMastery,
                bonusTotals.anomalyMasteryPct,
                bonusTotals.anomalyMasteryFlat,
            )
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
            panel.anomalyMastery = calculateAnomalyMastery(
                basePanelStats.anomalyMastery,
                bonusTotals.anomalyMasteryPct,
                bonusTotals.anomalyMasteryFlat,
            )
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
    bossesRaw = {},
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
    const archivedBossCombatBuffs = flattenBossCatalog(bossesRaw.bosses ?? [])
    const allBossCombatBuffs = [...rawBossBuffs, ...archivedBossCombatBuffs]
    const bossCombatBuffs = flattenBossCombatBuffs(allBossCombatBuffs)
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
        bosses: bossesRaw.bosses ?? [],
        teammateCombatBuffs,
        fieldCombatBuffs: rawFieldBuffs,
        bossCombatBuffs: allBossCombatBuffs,
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
    const agents = (catalog.agents ?? []).map(agent => ({
        id: agent.id,
        name: agent.name,
        rarity: agent.rarity,
        attribute: agent.attribute,
        damageElement: agent.damageElement,
        specialty: agent.specialty,
        faction: agent.faction,
        images: agent.images,
        coreSkill: agent.coreSkill,
        potentialVision: agent.potentialVision ?? null,
        anomalyReleaseProfiles: agent.anomalyReleaseProfiles ?? [],
        combatBuffs: agent.combatBuffs ?? {},
        preferredDriveDiscs: agent.preferredDriveDiscs ?? null,
        skillGroups: agent.skillGroups ?? [],
        defaultCalculationConfig: agent.defaultCalculationConfig ?? null,
    }))
    const visibleAgentIds = new Set(
        (catalog.displayAgents ?? (catalog.agents ?? []).filter(catalogItemVisible))
            .map(agent => agent.id),
    )
    const agentSkills = (catalog.agentSkills ?? []).map(item => ({
        id: item.id,
        agentId: item.agentId,
        name: item.name,
        categories: item.categories ?? [],
        sources: item.sources ?? [],
        verification: item.verification ?? null,
    }))
    const wEngines = (catalog.wEngines ?? []).map(item => ({
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
        legacyIds: item.legacyIds ?? [],
        images: item.images,
    }))
    const visibleWEngineIds = new Set(
        (catalog.displayWEngines ?? (catalog.wEngines ?? []).filter(catalogItemVisible))
            .map(item => item.id),
    )
    const driveDiscSets = (catalog.driveDiscSets ?? []).map(item => ({
        id: item.id,
        name: item.name,
        images: item.images,
        twoPiece: item.twoPiece,
        fourPiece: item.fourPiece,
    }))
    const visibleDriveDiscSetIds = new Set(
        (catalog.displayDriveDiscSets ?? (catalog.driveDiscSets ?? []).filter(catalogItemVisible))
            .map(item => item.id),
    )

    return {
        bosses: (catalog.bosses ?? []).filter(catalogItemVisible),
        agents,
        displayAgents: agents.filter(agent => visibleAgentIds.has(agent.id)),
        agentSkills,
        displayAgentSkills: agentSkills.filter(item => visibleAgentIds.has(item.agentId ?? item.id)),
        wEngines,
        displayWEngines: wEngines.filter(item => visibleWEngineIds.has(item.id)),
        driveDiscSets,
        displayDriveDiscSets: driveDiscSets.filter(item => visibleDriveDiscSetIds.has(item.id)),
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
                runtimeParameters: item.runtimeParameters ?? [],
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
        teammateCombatBuffGroups: (catalog.displayTeammateCombatBuffGroups ?? catalog.teammateCombatBuffGroups ?? []).map(teammate => ({
            id: teammate.id,
            name: teammate.name,
            attribute: teammate.attribute,
            specialty: teammate.specialty,
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
                    runtimeParameters: normalizedBuff.runtimeParameters,
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
        fieldCombatBuffs: flattenFieldCombatBuffs(catalog.displayFieldCombatBuffs ?? catalog.fieldCombatBuffs ?? [])
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
        bossCombatBuffs: flattenBossCombatBuffs(catalog.displayBossCombatBuffs ?? catalog.bossCombatBuffs ?? [])
            .filter(item => !item.hidden)
            .map(item => ({
                id: item.id,
                sourceType: item.sourceType,
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                bossName: item.bossName,
                bossId: item.bossId,
                aliases: item.aliases ?? [],
                images: item.images ?? null,
                target: item.target ?? null,
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
                appearances: item.appearances ?? [],
                enemyIntel: item.enemyIntel ?? null,
                recommendedSpecialties: item.recommendedSpecialties ?? [],
                playerBuffs: item.playerBuffs ?? [],
                playerDebuffs: item.playerDebuffs ?? [],
                sources: item.sources ?? [],
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
    const activeBuffIds = new Set(
        (Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
            .map(id => normalizeWEngineBuffKey(catalog, id)),
    )
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []
    const manualEffects = Array.isArray(combatInput.manualEffects) ? combatInput.manualEffects : []
    const runtimeInputs = normalizeWEngineKeyedRecord(catalog, combatInput.runtimeInputs)
    const wEngineTeamModificationLevels = wEngineTeamModificationLevelMap(catalog, combatInput)
    const outOfCombatCalculator = createPreparedOutOfCombatPanelCalculator({
        agent,
        wEngine,
        driveDiscSets,
        coreSkillLevel: input.coreSkillLevel,
    })
    const activeCatalogBuffs = (catalog.combatBuffs ?? []).filter(buff => activeBuffIds.has(buff.id))
    const potentialLevel = normalizePotentialLevel(agent, input.potentialLevel)
    const activeAgentBuffs = agentCombatBuffEntries(agent, input.coreSkillLevel, potentialLevel)
        .filter(entry => activeBuffIds.has(entry.id))
    const currentWEngineRequirement = wEngineEffectData(wEngine)?.requirement?.specialty ?? wEngine.specialty
    const activeCurrentWEngineEntries = wEngineCombatBuffEntries(wEngine).filter(entry => activeBuffIds.has(entry.key))
    const appliedCurrentWEngineKeys = new Set(activeCurrentWEngineEntries.map(entry => entry.key))
    // External team W-Engine Buffs represent another wearer that has already met its specialty/trigger requirements.
    const activeTeamWEngineEntries = (catalog.wEngines ?? [])
        .map(sourceWEngine => materializedTeamWEngineEntry(sourceWEngine, wEngineTeamModificationLevels))
        .filter(entry => activeBuffIds.has(entry.key) && !appliedCurrentWEngineKeys.has(entry.key))
    const activeDriveDisc4pcIds = [...activeBuffIds].filter(activeId => String(activeId).startsWith("driveDisc4pc:"))
    const normalizedDamageInput = normalizeDamageRequest(input.damage, agent, catalog, {
        coreSkillLevel: input.coreSkillLevel,
        cinemaLevel: input.cinemaLevel,
        potentialLevel,
    })
    const compiledDamageTarget = compileDamageScoreTarget(normalizedDamageInput, agent)
    const hasMasteryToProficiencyConversion = activeAgentBuffs.some(entry =>
        effectRules(entry.buff).some(rule => rule?.stat === "anomalyProficiencyPerMasteryAbove140")
    )
    const hasInitialMasteryToAnomalyCritConversion = activeAgentBuffs.some(entry =>
        effectRules(entry.buff).some(rule => rule?.stat === "anomalyCritRatePerInitialMasteryAbove100")
    )
    const activeOutOfCombatRequirementStats = new Set()
    const collectOutOfCombatRequirementStats = effect => {
        for (const rule of effectRules(effect)) {
            const requirement = outOfCombatStatRequirement(rule?.requirement)
            if (requirement) activeOutOfCombatRequirementStats.add(requirement.stat)
        }
    }
    for (const buff of activeCatalogBuffs) collectOutOfCombatRequirementStats(buff)
    for (const entry of activeAgentBuffs) collectOutOfCombatRequirementStats(entry.buff)
    for (const entry of activeCurrentWEngineEntries) collectOutOfCombatRequirementStats(entry.effect)
    for (const entry of activeTeamWEngineEntries) collectOutOfCombatRequirementStats(entry.teamBuff)
    for (const activeId of activeDriveDisc4pcIds) {
        const rawKey = String(activeId).slice("driveDisc4pc:".length)
        const [setId, part = "self"] = rawKey.split(".")
        const set = driveDiscSets.get(setId)
        const effect = part === "team"
            ? driveDiscFourPieceTeamBuff(set)
            : driveDiscFourPieceSelfBuff(set)
        collectOutOfCombatRequirementStats(effect)
    }

    function optimizerStatMetadata({ minimums = {} } = {}) {
        const panelStats = new Set()
        for (const event of compiledDamageTarget.events ?? []) {
            if (event.isLuminescence) {
                panelStats.add("atk")
                panelStats.add("anomalyProficiency")
                continue
            }
            const damageElement = String(event.damageElement ?? "physical")
            panelStats.add("dmgBonus")
            if (DAMAGE_ELEMENTS.includes(damageElement)) {
                panelStats.add(`${damageElement}Dmg`)
                panelStats.add(`${damageElement}ResIgnore`)
            }

            const usesAnomalyFormula = event.kind !== "direct" && event.kind !== "sheer"
            if (event.kind === "sheer") {
                if (compiledDamageTarget.isRuptureAgent) {
                    panelStats.add("sheerForce")
                }
            } else {
                if (event.kind === "direct" && event.damageBasis === "anomalyProficiency") {
                    panelStats.add("anomalyProficiency")
                } else {
                    panelStats.add("atk")
                }
                panelStats.add("penFlat")
                panelStats.add("penRatio")
            }

            if (!usesAnomalyFormula) {
                if (event.critMode !== "nonCrit") {
                    panelStats.add("critDmg")
                }
                if (event.critMode !== "crit" && event.critMode !== "nonCrit") {
                    panelStats.add("critRate")
                }
            } else {
                panelStats.add("anomalyProficiency")
                if (event.isRelease) {
                    for (const stat of releaseFormulaStatDependencies(event.releaseProfile)) {
                        panelStats.add(stat)
                    }
                }
            }
        }
        if (hasMasteryToProficiencyConversion && panelStats.has("anomalyProficiency")) {
            panelStats.add("anomalyMastery")
        }
        if (hasInitialMasteryToAnomalyCritConversion
            && (compiledDamageTarget.events ?? []).some(event => event.isRelease)) {
            panelStats.add("anomalyMastery")
        }
        for (const stat of activeOutOfCombatRequirementStats) {
            panelStats.add(stat)
        }
        for (const [stat, value] of Object.entries(minimums ?? {})) {
            if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
                panelStats.add(stat)
            }
        }

        const relevantStatIds = new Set()
        for (const panelStat of panelStats) {
            for (const stat of OPTIMIZER_INPUT_STATS_BY_PANEL_STAT[panelStat] ?? [panelStat]) {
                relevantStatIds.add(stat)
            }
        }
        const hasReleaseFormula = (compiledDamageTarget.events ?? []).some(event => event.isRelease)
        return {
            strictMonotonic: !hasReleaseFormula && activeOutOfCombatRequirementStats.size === 0,
            requiresReleaseIntervalBound: hasReleaseFormula,
            panelStatIds: [...panelStats].sort(),
            relevantStatIds: [...relevantStatIds].sort(),
        }
    }
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

    function compileDensePanelScoreTarget({ statIds = [], setIds = [], setIndexById = null, candidateStatIndexes = [] } = {}) {
        if (typeof outOfCombatCalculator.compileDenseOutOfCombatTarget !== "function") {
            return null
        }
        if ((compiledDamageTarget.events ?? []).some(event => event.isRelease
            && String(event.anomalySource?.actorRef?.agentId ?? agent.id) !== String(agent.id))) {
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
                agent,
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
                runtimeInput: combatBuffRuntimeInput(buff, runtimeInputs),
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

        for (let setIndex = 0; setIndex < setIds.length; setIndex += 1) {
            const setId = setIds[setIndex]
            const set = driveDiscSets.get(setId)
            const effect = driveDiscTwoPieceCombatBuff(set)
            if (!effect) continue
            if (!pushEntry({
                effect,
                key: driveDisc2pcKey(setId),
                sourceType: "driveDisc2pc",
                setIndex,
                minSetCount: 2,
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

        const denseOutOfCombat = outOfCombatCalculator.compileDenseOutOfCombatTarget(statIds, setIds, candidateStatIndexes)
        const combatValues = new Float64Array(COMBAT_BONUS_KEYS.length)
        const panelValues = new Float64Array(OUTPUT_PANEL_KEYS.length)
        const panel = createPanel()
        const result = {
            panel,
            outOfCombatPanelValues: null,
            selectedDmgBonus: 0,
            finalDamage: 0,
            minPanelPass: true,
            requiredPanel: null,
        }
        const scalarResult = {
            panelValues,
            outOfCombatPanelValues: null,
            selectedDmgBonus: 0,
            finalDamage: 0,
        }
        const activeEntryFlags = new Uint8Array(entries.length)
        const activeExclusiveGroups = new Set()
        const allEntryIndexes = entries.map((_, index) => index)
        const eventModifierEntries = compileDenseDamageModifierEntries(entries, compiledDamageTarget.events)
        const modifierSums = new Float64Array(DAMAGE_MODIFIER_SUM_KEYS.length)
        const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
        const isRupture = isRuptureAgent(agent)

        function scoreDense(
            statValues = [],
            setCountValues = [],
            includePanel = true,
            fixedOutOfCombatTarget = null,
            fixedActiveEntryIndexes = null,
            fixedCombatValues = null,
            fixedEntryFlags = null,
        ) {
                const outOfCombat = fixedOutOfCombatTarget
                    ? fixedOutOfCombatTarget.score(statValues)
                    : denseOutOfCombat.score(statValues, setCountValues)
                const outPanelValues = outOfCombat.panelValues
                result.outOfCombatPanelValues = outPanelValues
                const outBase = outOfCombat.base
                if (fixedCombatValues && fixedEntryFlags) {
                    combatValues.set(fixedCombatValues)
                    activeEntryFlags.set(fixedEntryFlags)
                } else {
                    combatValues.fill(0)
                    activeEntryFlags.fill(0)
                    activeExclusiveGroups.clear()
                    const entryIndexes = fixedActiveEntryIndexes ?? allEntryIndexes
                    for (const entryIndex of entryIndexes) {
                        const entry = entries[entryIndex]
                        if (!fixedActiveEntryIndexes && entry.setIndex !== null && Number(setCountValues[entry.setIndex] ?? 0) < Number(entry.minSetCount ?? 0)) {
                            continue
                        }
                        if (entry.exclusiveGroup && activeExclusiveGroups.has(entry.exclusiveGroup)) {
                            continue
                        }
                        if (entry.exclusiveGroup) activeExclusiveGroups.add(entry.exclusiveGroup)
                        activeEntryFlags[entryIndex] = 1
                        for (const stat of entry.stats ?? []) {
                            if (!denseOutOfCombatStatRequirementMatches(stat.requirement, outPanelValues)) {
                                continue
                            }
                            addDenseCombatStat(combatValues, stat, entry.sourceType, outBase, outPanelValues)
                        }
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

                panelValues[PANEL_KEY_LOOKUP.hp] = hp
                panelValues[PANEL_KEY_LOOKUP.atk] = atk
                panelValues[PANEL_KEY_LOOKUP.def] = def
                panelValues[PANEL_KEY_LOOKUP.critRate] = densePanelValue(outPanelValues, "critRate")
                    + denseCombatValue(combatValues, "critRate")
                panelValues[PANEL_KEY_LOOKUP.critDmg] = densePanelValue(outPanelValues, "critDmg")
                    + denseCombatValue(combatValues, "critDmg")
                panelValues[PANEL_KEY_LOOKUP.impact] = (densePanelValue(outPanelValues, "impact") * (1 + denseCombatValue(combatValues, "impactPct")))
                    + denseCombatValue(combatValues, "impactFlat")
                panelValues[PANEL_KEY_LOOKUP.anomalyMastery] = calculateAnomalyMastery(
                    densePanelValue(outPanelValues, "anomalyMastery"),
                    denseCombatValue(combatValues, "anomalyMasteryPct"),
                    denseCombatValue(combatValues, "anomalyMasteryFlat"),
                )
                panelValues[PANEL_KEY_LOOKUP.anomalyProficiency] = densePanelValue(outPanelValues, "anomalyProficiency")
                    + denseCombatValue(combatValues, "anomalyProficiencyFlat")
                    + calculateMasteryConvertedProficiency(
                        panelValues[PANEL_KEY_LOOKUP.anomalyMastery],
                        denseCombatValue(combatValues, "anomalyProficiencyPerMasteryAbove140"),
                    )
                panelValues[PANEL_KEY_LOOKUP.energyRegen] = densePanelValue(outPanelValues, "energyRegen")
                    * (1 + denseCombatValue(combatValues, "energyRegenPct"))
                panelValues[PANEL_KEY_LOOKUP.penFlat] = densePanelValue(outPanelValues, "penFlat")
                    + denseCombatValue(combatValues, "penFlat")
                panelValues[PANEL_KEY_LOOKUP.penRatio] = densePanelValue(outPanelValues, "penRatio")
                    + denseCombatValue(combatValues, "penRatio")
                for (const key of RES_IGNORE_KEYS) {
                    panelValues[PANEL_KEY_LOOKUP[key]] = densePanelValue(outPanelValues, key) + denseCombatValue(combatValues, key)
                }
                panelValues[PANEL_KEY_LOOKUP.dmgBonus] = densePanelValue(outPanelValues, "dmgBonus")
                    + denseCombatValue(combatValues, "dmgBonus")
                for (const element of DAMAGE_ELEMENTS) {
                    const key = `${element}Dmg`
                    panelValues[PANEL_KEY_LOOKUP[key]] = densePanelValue(outPanelValues, key)
                        + denseCombatValue(combatValues, key)
                }
                panelValues[PANEL_KEY_LOOKUP.sheerForceFlat] = isRupture
                    ? densePanelValue(outPanelValues, "sheerForceFlat") + denseCombatValue(combatValues, "sheerForceFlat")
                    : 0
                panelValues[PANEL_KEY_LOOKUP.sheerForce] = isRupture
                    ? Math.max(0, (hp * SHEER_FORCE_HP_RATIO) + (atk * SHEER_FORCE_ATK_RATIO) + panelValues[PANEL_KEY_LOOKUP.sheerForceFlat])
                    : 0

                if (includePanel) for (const key of OUTPUT_PANEL_KEYS) {
                    panel[key] = panelValues[PANEL_KEY_LOOKUP[key]] ?? 0
                }
                result.selectedDmgBonus = densePanelValue(panelValues, "dmgBonus")
                    + densePanelValue(panelValues, selectedAttributeBonusKey)
                result.finalDamage = calculateCompiledDamageScoreValueDense({
                    agent,
                    panelValues,
                    outOfCombatPanelValues: outPanelValues,
                    combatValues,
                    compiledDamageTarget,
                    eventModifierEntries,
                    activeEntryFlags,
                    modifierSums,
                })
            return result
        }

        function compileFixedDirectScoreKernel(fixedOutOfCombatTarget, fixedCombatValues, fixedEntryFlags) {
            const events = compiledDamageTarget.events ?? []
            if (!events.length
                || events.some(event => event.kind !== "direct" || event.damageBasis === "anomalyProficiency")
                || typeof fixedOutOfCombatTarget.panelValue !== "function") {
                return null
            }
            const target = compiledDamageTarget.target
            const compiledEvents = events.map((event, eventIndex) => {
                const sums = new Float64Array(DAMAGE_MODIFIER_SUM_KEYS.length)
                fillDenseModifierSums(sums, eventModifierEntries[eventIndex], fixedEntryFlags)
                const targetDefenseAfterReduction = Math.max(
                    0,
                    Number(target.defense ?? 0)
                        * (1 - (
                            fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.enemyDefReduction]
                            + denseModifierSum(sums, "enemyDefReduction")
                            + denseModifierSum(sums, event.elementDefIgnoreKey)
                        ))
                        - fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.enemyDefFlatReduction],
                )
                return {
                    count: event.count,
                    damageScale: event.damageScale,
                    critMode: event.critMode,
                    resistanceFixedOne: event.resistanceFixedOne,
                    damageIndex: PANEL_KEY_LOOKUP[`${event.damageElement}Dmg`],
                    resIgnoreIndex: PANEL_KEY_LOOKUP[event.resIgnoreKey],
                    effectiveSkillMultiplier: Math.max(0, event.skillMultiplier + denseModifierSum(sums, "skillMultiplierBonus")),
                    directDamageBonus: denseModifierSum(sums, "directDamageBonus")
                        + denseModifierSum(sums, "dmgBonus")
                        + denseModifierSum(sums, event.elementDmgKey),
                    targetedCritDmgBonus: denseModifierSum(sums, "critDmg")
                        + denseModifierSum(sums, event.elementCritDmgKey),
                    targetedPenRatio: denseModifierSum(sums, "penRatio"),
                    targetDefenseAfterReduction,
                    levelCoefficient: Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT),
                    targetResistance: event.resistanceFixedOne
                        ? 0
                        : Number(target.resistanceByElement?.[event.damageElement] ?? 0),
                    enemyResReduction: event.resistanceFixedOne
                        ? 0
                        : denseCombatValue(fixedCombatValues, "enemyResReduction")
                            + denseCombatValue(fixedCombatValues, event.resReductionKey)
                            + denseModifierSum(sums, "enemyResReduction")
                            + denseModifierSum(sums, event.resReductionKey),
                    modifierResIgnore: event.resistanceFixedOne
                        ? 0
                        : denseModifierSum(sums, ALL_RES_IGNORE_KEY)
                            + denseModifierSum(sums, event.resIgnoreKey),
                    stunMultiplier: targetActiveStunMultiplier(target, event.stunned, {
                        stunDmgMultiplierBonus: denseModifierSum(sums, "stunDmgMultiplierBonus"),
                        stunDmgMultiplierBonusAlways: denseModifierSum(sums, "stunDmgMultiplierBonusAlways"),
                        stunDmgMultiplierBonusCapAlways: denseModifierSum(sums, "stunDmgMultiplierBonusCapAlways"),
                    }),
                }
            })

            function scoreObjectiveScalar(
                statValues = [],
                suffixDenseVector = null,
                branchIndexedVector = null,
                optimisticIndexedVector = null,
            ) {
                scalarResult.outOfCombatPanelValues = null
                const outPanelValue = key => fixedOutOfCombatTarget.panelValue(
                    statValues,
                    key,
                    suffixDenseVector,
                    branchIndexedVector,
                    optimisticIndexedVector,
                )
                const outBase = fixedOutOfCombatTarget.base
                const outAtk = outPanelValue("atk")
                const atk = outAtk
                    + denseCombatValue(fixedCombatValues, "atkFlat")
                    + Number(outBase.atk ?? 0) * (
                        denseCombatValue(fixedCombatValues, "atkPct")
                        + denseCombatValue(fixedCombatValues, "atkPctBase")
                    )
                    + outAtk * denseCombatValue(fixedCombatValues, "atkPctOutOfCombat")
                const critRate = clampNumber(
                    outPanelValue("critRate") + denseCombatValue(fixedCombatValues, "critRate"),
                    0,
                    1,
                )
                const critDmg = outPanelValue("critDmg") + denseCombatValue(fixedCombatValues, "critDmg")
                const penFlat = outPanelValue("penFlat") + denseCombatValue(fixedCombatValues, "penFlat")
                const penRatio = outPanelValue("penRatio") + denseCombatValue(fixedCombatValues, "penRatio")
                const dmgBonus = outPanelValue("dmgBonus") + denseCombatValue(fixedCombatValues, "dmgBonus")
                let total = 0
                for (const event of compiledEvents) {
                    const resIgnoreKey = OUTPUT_PANEL_KEYS[event.resIgnoreIndex]
                    const damageKey = OUTPUT_PANEL_KEYS[event.damageIndex]
                    const resIgnore = event.resistanceFixedOne
                        ? 0
                        : outPanelValue(ALL_RES_IGNORE_KEY)
                            + denseCombatValue(fixedCombatValues, ALL_RES_IGNORE_KEY)
                            + outPanelValue(resIgnoreKey)
                            + denseCombatValue(fixedCombatValues, resIgnoreKey)
                    const elementDmg = damageKey
                        ? outPanelValue(damageKey) + denseCombatValue(fixedCombatValues, damageKey)
                        : 0
                    const effectiveDefense = Math.max(
                        0,
                        event.targetDefenseAfterReduction * (1 - (penRatio + event.targetedPenRatio)) - penFlat,
                    )
                    const defenseMultiplier = Math.min(1, event.levelCoefficient / (event.levelCoefficient + effectiveDefense))
                    const resistanceMultiplier = event.resistanceFixedOne
                        ? 1
                        : clampNumber(
                            1 - (event.targetResistance - event.enemyResReduction - (resIgnore + event.modifierResIgnore)),
                            0.01,
                            2,
                        )
                    const effectiveCritDmg = critDmg + event.targetedCritDmgBonus
                    const critMultiplier = event.critMode === "crit"
                        ? 1 + effectiveCritDmg
                        : event.critMode === "nonCrit"
                            ? 1
                            : critRate * (1 + effectiveCritDmg) + (1 - critRate)
                    total += atk
                        * event.effectiveSkillMultiplier
                        * (1 + dmgBonus + elementDmg + event.directDamageBonus)
                        * defenseMultiplier
                        * resistanceMultiplier
                        * event.stunMultiplier
                        * critMultiplier
                        * event.damageScale
                        * event.count
                }
                scalarResult.selectedDmgBonus = dmgBonus
                scalarResult.finalDamage = total
                return scalarResult
            }

            return {
                scoreObjectiveScalar,
                scoreCombinedScalar(statValues = [], branchIndexedVector = null, suffixDenseVector = null, optimisticIndexedVector = null) {
                    return scoreObjectiveScalar(statValues, suffixDenseVector, branchIndexedVector, optimisticIndexedVector)
                },
                scoreScalar(statValues = []) {
                    const outOfCombat = fixedOutOfCombatTarget.score(statValues)
                    const outPanelValues = outOfCombat.panelValues
                    scalarResult.outOfCombatPanelValues = outPanelValues
                    const outBase = outOfCombat.base
                    const hp = outPanelValues[PANEL_KEY_LOOKUP.hp]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.hpFlat]
                        + Number(outBase.hp ?? 0) * (
                            fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.hpPct]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.hpPctBase]
                        )
                        + outPanelValues[PANEL_KEY_LOOKUP.hp] * fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.hpPctOutOfCombat]
                    const atk = outPanelValues[PANEL_KEY_LOOKUP.atk]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.atkFlat]
                        + Number(outBase.atk ?? 0) * (
                            fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.atkPct]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.atkPctBase]
                        )
                        + outPanelValues[PANEL_KEY_LOOKUP.atk] * fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.atkPctOutOfCombat]
                    const def = outPanelValues[PANEL_KEY_LOOKUP.def]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.defFlat]
                        + Number(outBase.def ?? 0) * (
                            fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.defPct]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.defPctBase]
                        )
                        + outPanelValues[PANEL_KEY_LOOKUP.def] * fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.defPctOutOfCombat]

                    panelValues[PANEL_KEY_LOOKUP.hp] = hp
                    panelValues[PANEL_KEY_LOOKUP.atk] = atk
                    panelValues[PANEL_KEY_LOOKUP.def] = def
                    panelValues[PANEL_KEY_LOOKUP.critRate] = outPanelValues[PANEL_KEY_LOOKUP.critRate]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.critRate]
                    panelValues[PANEL_KEY_LOOKUP.critDmg] = outPanelValues[PANEL_KEY_LOOKUP.critDmg]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.critDmg]
                    panelValues[PANEL_KEY_LOOKUP.impact] = outPanelValues[PANEL_KEY_LOOKUP.impact]
                        * (1 + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.impactPct])
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.impactFlat]
                    panelValues[PANEL_KEY_LOOKUP.anomalyMastery] = calculateAnomalyMastery(
                        outPanelValues[PANEL_KEY_LOOKUP.anomalyMastery],
                        fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.anomalyMasteryPct],
                        fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.anomalyMasteryFlat],
                    )
                    panelValues[PANEL_KEY_LOOKUP.anomalyProficiency] = outPanelValues[PANEL_KEY_LOOKUP.anomalyProficiency]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.anomalyProficiencyFlat]
                        + calculateMasteryConvertedProficiency(
                            panelValues[PANEL_KEY_LOOKUP.anomalyMastery],
                            fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.anomalyProficiencyPerMasteryAbove140],
                        )
                    panelValues[PANEL_KEY_LOOKUP.energyRegen] = outPanelValues[PANEL_KEY_LOOKUP.energyRegen]
                        * (1 + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.energyRegenPct])
                    panelValues[PANEL_KEY_LOOKUP.penFlat] = outPanelValues[PANEL_KEY_LOOKUP.penFlat]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.penFlat]
                    panelValues[PANEL_KEY_LOOKUP.penRatio] = outPanelValues[PANEL_KEY_LOOKUP.penRatio]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.penRatio]
                    for (const key of RES_IGNORE_KEYS) {
                        panelValues[PANEL_KEY_LOOKUP[key]] = outPanelValues[PANEL_KEY_LOOKUP[key]]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP[key]]
                    }
                    panelValues[PANEL_KEY_LOOKUP.dmgBonus] = outPanelValues[PANEL_KEY_LOOKUP.dmgBonus]
                        + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.dmgBonus]
                    for (const element of DAMAGE_ELEMENTS) {
                        const key = `${element}Dmg`
                        panelValues[PANEL_KEY_LOOKUP[key]] = outPanelValues[PANEL_KEY_LOOKUP[key]]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP[key]]
                    }
                    panelValues[PANEL_KEY_LOOKUP.sheerForceFlat] = isRupture
                        ? outPanelValues[PANEL_KEY_LOOKUP.sheerForceFlat]
                            + fixedCombatValues[COMBAT_BONUS_KEY_LOOKUP.sheerForceFlat]
                        : 0
                    panelValues[PANEL_KEY_LOOKUP.sheerForce] = isRupture
                        ? Math.max(
                            0,
                            (hp * SHEER_FORCE_HP_RATIO)
                                + (atk * SHEER_FORCE_ATK_RATIO)
                                + panelValues[PANEL_KEY_LOOKUP.sheerForceFlat],
                        )
                        : 0

                    let total = 0
                    for (const event of compiledEvents) {
                        const effectiveDefense = Math.max(
                            0,
                            event.targetDefenseAfterReduction * (1 - (
                                panelValues[PANEL_KEY_LOOKUP.penRatio] + event.targetedPenRatio
                            ))
                                - panelValues[PANEL_KEY_LOOKUP.penFlat],
                        )
                        const defenseMultiplier = Math.min(
                            1,
                            event.levelCoefficient / (event.levelCoefficient + effectiveDefense),
                        )
                        const resistanceMultiplier = event.resistanceFixedOne
                            ? 1
                            : clampNumber(
                                1 - (
                                    event.targetResistance
                                    - event.enemyResReduction
                                    - (
                                        panelValues[PANEL_KEY_LOOKUP[ALL_RES_IGNORE_KEY]]
                                        + panelValues[event.resIgnoreIndex]
                                        + event.modifierResIgnore
                                    )
                                ),
                                0.01,
                                2,
                            )
                        const critRate = clampNumber(panelValues[PANEL_KEY_LOOKUP.critRate], 0, 1)
                        const critDmg = panelValues[PANEL_KEY_LOOKUP.critDmg]
                        const effectiveCritDmg = critDmg + event.targetedCritDmgBonus
                        const critMultiplier = event.critMode === "crit"
                            ? 1 + effectiveCritDmg
                            : event.critMode === "nonCrit"
                                ? 1
                                : critRate * (1 + effectiveCritDmg) + (1 - critRate)
                        const targetMultiplier = defenseMultiplier
                            * resistanceMultiplier
                            * event.stunMultiplier
                        total += atk
                            * event.effectiveSkillMultiplier
                            * (1 + panelValues[PANEL_KEY_LOOKUP.dmgBonus] + densePanelValue(panelValues, OUTPUT_PANEL_KEYS[event.damageIndex]) + event.directDamageBonus)
                            * targetMultiplier
                            * critMultiplier
                            * event.damageScale
                            * event.count
                    }
                    scalarResult.selectedDmgBonus = panelValues[PANEL_KEY_LOOKUP.dmgBonus]
                        + densePanelValue(panelValues, selectedAttributeBonusKey)
                    scalarResult.finalDamage = total
                    return scalarResult
                },
            }
        }

        function compileFixedNonDirectObjectiveKernel(fixedOutOfCombatTarget, fixedCombatValues, fixedEntryFlags) {
            const events = compiledDamageTarget.events ?? []
            if (!events.length
                || events.every(event => event.kind === "direct")
                || events.some(event => !["direct", "anomaly", "disorder", "sheer"].includes(event.kind))
                || events.some(event => event.isLuminescence)
                || events.some(event => event.isRelease
                    && String(event.anomalySource?.actorRef?.agentId ?? agent.id) !== String(agent.id))
                || typeof fixedOutOfCombatTarget.panelValue !== "function") {
                return null
            }
            const target = compiledDamageTarget.target
            const compiledEvents = events.map((event, eventIndex) => {
                const sums = new Float64Array(DAMAGE_MODIFIER_SUM_KEYS.length)
                fillDenseModifierSums(sums, eventModifierEntries[eventIndex], fixedEntryFlags)
                const targetDefenseAfterReduction = Math.max(
                    0,
                    Number(target.defense ?? 0)
                        * (1 - (
                            denseCombatValue(fixedCombatValues, "enemyDefReduction")
                            + denseModifierSum(sums, "enemyDefReduction")
                            + denseModifierSum(sums, event.elementDefIgnoreKey)
                        ))
                        - denseCombatValue(fixedCombatValues, "enemyDefFlatReduction"),
                )
                const skillDamageBonus = denseModifierSum(sums, "dmgBonus")
                    + denseModifierSum(sums, event.elementDmgKey)
                return {
                    kind: event.kind,
                    settlementType: event.settlementType,
                    isRelease: event.isRelease,
                    isDisorder: event.isDisorder,
                    anomalyVariant: event.anomalyVariant,
                    baseMultiplier: event.baseMultiplier,
                    baseMultiplierPerProc: event.baseMultiplierPerProc,
                    procCount: event.procCount,
                    usesDefaultProcCount: event.usesDefaultProcCount,
                    baseDurationSeconds: event.baseDurationSeconds,
                    tickIntervalSeconds: event.tickIntervalSeconds,
                    releaseProfile: event.releaseProfile,
                    releaseCoreScalingRow: event.releaseCoreScalingRow,
                    triggerActorRef: event.triggerActorRef,
                    anomalySource: event.anomalySource,
                    stunned: event.stunned,
                    count: event.count,
                    damageElement: event.damageElement,
                    resistanceFixedOne: event.resistanceFixedOne,
                    damageBasis: event.damageBasis,
                    damageScale: event.damageScale,
                    critMode: event.critMode,
                    damageKey: `${event.damageElement}Dmg`,
                    resIgnoreKey: event.resIgnoreKey,
                    effectiveSkillMultiplier: Math.max(0, event.skillMultiplier + denseModifierSum(sums, "skillMultiplierBonus")),
                    directDamageBonus: denseModifierSum(sums, "directDamageBonus") + skillDamageBonus,
                    skillDamageBonus,
                    targetedCritDmgBonus: denseModifierSum(sums, "critDmg")
                        + denseModifierSum(sums, event.elementCritDmgKey),
                    targetedPenRatio: denseModifierSum(sums, "penRatio"),
                    sheerDmgBonus: denseModifierSum(sums, "sheerDmgBonus")
                        + denseModifierSum(sums, event.elementSheerDmgKey),
                    effectiveBaseMultiplier: event.isRelease
                        ? 0
                        : Math.max(
                            0,
                            compiledEventBaseMultiplier(
                                event,
                                denseModifierSum(sums, "anomalyDurationBonusSeconds"),
                            ) + denseModifierSum(
                                sums,
                                event.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
                            ),
                        ) * event.baseMultiplierScale,
                    baseMultiplierBonus: denseModifierSum(
                        sums,
                        event.isDisorder ? "disorderBaseMultiplierBonus" : "baseMultiplierBonus",
                    ),
                    durationBonusSeconds: denseModifierSum(sums, "anomalyDurationBonusSeconds"),
                    baseMultiplierScale: event.baseMultiplierScale,
                    anomalyDamageBonus: 1 + denseModifierSum(
                        sums,
                        event.isDisorder ? "disorderDamageBonus" : "anomalyDamageBonus",
                    ),
                    alienationMultiplier: Math.max(
                        0,
                        1 + denseModifierSum(sums, "alienationCoefficientBonus"),
                    ),
                    anomalyCritRate: denseModifierSum(sums, "anomalyCritRate"),
                    anomalyCritDmg: Math.max(0, denseModifierSum(sums, "anomalyCritDmg")),
                    anomalyCritRatePerInitialMasteryAbove100: denseModifierSum(
                        sums,
                        "anomalyCritRatePerInitialMasteryAbove100",
                    ),
                    anomalyCritMultiplier: denseAnomalyCritMultiplier(event, sums),
                    targetDefenseAfterReduction,
                    levelCoefficient: Number(target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT),
                    targetResistance: event.resistanceFixedOne
                        ? 0
                        : Number(target.resistanceByElement?.[event.damageElement] ?? 0),
                    enemyResReduction: event.resistanceFixedOne
                        ? 0
                        : denseCombatValue(fixedCombatValues, "enemyResReduction")
                            + denseCombatValue(fixedCombatValues, event.resReductionKey)
                            + denseModifierSum(sums, "enemyResReduction")
                            + denseModifierSum(sums, event.resReductionKey),
                    modifierResIgnore: event.resistanceFixedOne
                        ? 0
                        : denseModifierSum(sums, ALL_RES_IGNORE_KEY)
                            + denseModifierSum(sums, event.resIgnoreKey),
                    stunMultiplier: targetActiveStunMultiplier(target, event.stunned, {
                        stunDmgMultiplierBonus: denseModifierSum(sums, "stunDmgMultiplierBonus"),
                        stunDmgMultiplierBonusAlways: denseModifierSum(sums, "stunDmgMultiplierBonusAlways"),
                        stunDmgMultiplierBonusCapAlways: denseModifierSum(sums, "stunDmgMultiplierBonusCapAlways"),
                    }),
                }
            })
            const needsSheer = compiledEvents.some(event => event.kind === "sheer")
            const needsAnomaly = compiledEvents.some(event => !["direct", "sheer"].includes(event.kind)
                || (event.kind === "direct" && event.damageBasis === "anomalyProficiency"))
            const needsCrit = compiledEvents.some(event => ["direct", "sheer"].includes(event.kind))
            const needsDefense = compiledEvents.some(event => event.kind !== "sheer")

            function scoreObjectiveScalar(
                statValues = [],
                suffixDenseVector = null,
                branchIndexedVector = null,
                optimisticIndexedVector = null,
            ) {
                scalarResult.outOfCombatPanelValues = null
                const outPanelValue = key => fixedOutOfCombatTarget.panelValue(
                    statValues,
                    key,
                    suffixDenseVector,
                    branchIndexedVector,
                    optimisticIndexedVector,
                )
                const hasFormulaInterval = Boolean(suffixDenseVector || branchIndexedVector || optimisticIndexedVector)
                const lowerOutPanelValue = key => fixedOutOfCombatTarget.panelValue(statValues, key)
                const outBase = fixedOutOfCombatTarget.base
                const outAtk = outPanelValue("atk")
                const atk = outAtk
                    + denseCombatValue(fixedCombatValues, "atkFlat")
                    + Number(outBase.atk ?? 0) * (
                        denseCombatValue(fixedCombatValues, "atkPct")
                        + denseCombatValue(fixedCombatValues, "atkPctBase")
                    )
                    + outAtk * denseCombatValue(fixedCombatValues, "atkPctOutOfCombat")
                const critRate = needsCrit
                    ? clampNumber(outPanelValue("critRate") + denseCombatValue(fixedCombatValues, "critRate"), 0, 1)
                    : 0
                const critDmg = needsCrit
                    ? outPanelValue("critDmg") + denseCombatValue(fixedCombatValues, "critDmg")
                    : 0
                const penFlat = needsDefense
                    ? outPanelValue("penFlat") + denseCombatValue(fixedCombatValues, "penFlat")
                    : 0
                const penRatio = needsDefense
                    ? outPanelValue("penRatio") + denseCombatValue(fixedCombatValues, "penRatio")
                    : 0
                const dmgBonus = outPanelValue("dmgBonus") + denseCombatValue(fixedCombatValues, "dmgBonus")
                const anomalyMastery = needsAnomaly
                    ? calculateAnomalyMastery(
                        outPanelValue("anomalyMastery"),
                        denseCombatValue(fixedCombatValues, "anomalyMasteryPct"),
                        denseCombatValue(fixedCombatValues, "anomalyMasteryFlat"),
                    )
                    : 0
                const anomalyProficiency = needsAnomaly
                    ? outPanelValue("anomalyProficiency")
                        + denseCombatValue(fixedCombatValues, "anomalyProficiencyFlat")
                        + calculateMasteryConvertedProficiency(
                            anomalyMastery,
                            denseCombatValue(fixedCombatValues, "anomalyProficiencyPerMasteryAbove140"),
                        )
                    : 0
                const lowerAnomalyMastery = needsAnomaly && hasFormulaInterval
                    ? calculateAnomalyMastery(
                        lowerOutPanelValue("anomalyMastery"),
                        denseCombatValue(fixedCombatValues, "anomalyMasteryPct"),
                        denseCombatValue(fixedCombatValues, "anomalyMasteryFlat"),
                    )
                    : anomalyMastery
                const lowerAnomalyProficiency = needsAnomaly && hasFormulaInterval
                    ? lowerOutPanelValue("anomalyProficiency")
                        + denseCombatValue(fixedCombatValues, "anomalyProficiencyFlat")
                        + calculateMasteryConvertedProficiency(
                            lowerAnomalyMastery,
                            denseCombatValue(fixedCombatValues, "anomalyProficiencyPerMasteryAbove140"),
                        )
                    : anomalyProficiency
                const lowerOutAtk = hasFormulaInterval ? lowerOutPanelValue("atk") : outAtk
                const lowerAtk = hasFormulaInterval
                    ? lowerOutAtk
                        + denseCombatValue(fixedCombatValues, "atkFlat")
                        + Number(outBase.atk ?? 0) * (
                            denseCombatValue(fixedCombatValues, "atkPct")
                            + denseCombatValue(fixedCombatValues, "atkPctBase")
                        )
                        + lowerOutAtk * denseCombatValue(fixedCombatValues, "atkPctOutOfCombat")
                    : atk
                let sheerForce = 0
                if (needsSheer && compiledDamageTarget.isRuptureAgent) {
                    const outHp = outPanelValue("hp")
                    const hp = outHp
                        + denseCombatValue(fixedCombatValues, "hpFlat")
                        + Number(outBase.hp ?? 0) * (
                            denseCombatValue(fixedCombatValues, "hpPct")
                            + denseCombatValue(fixedCombatValues, "hpPctBase")
                        )
                        + outHp * denseCombatValue(fixedCombatValues, "hpPctOutOfCombat")
                    const sheerForceFlat = outPanelValue("sheerForceFlat")
                        + denseCombatValue(fixedCombatValues, "sheerForceFlat")
                    sheerForce = Math.max(0, hp * SHEER_FORCE_HP_RATIO + atk * SHEER_FORCE_ATK_RATIO + sheerForceFlat)
                }

                let total = 0
                const formulaOutOfCombatPanel = new Proxy({}, {
                    get(_target, property) {
                        return typeof property === "string" ? outPanelValue(property) : undefined
                    },
                })
                const formulaInCombatPanel = new Proxy({}, {
                    get(_target, property) {
                        if (property === "anomalyMastery") return anomalyMastery
                        if (property === "anomalyProficiency") return anomalyProficiency
                        if (property === "atk") return atk
                        return typeof property === "string"
                            ? outPanelValue(property) + denseCombatValue(fixedCombatValues, property)
                            : undefined
                    },
                })
                const formulaOutOfCombatIntervalPanel = new Proxy({}, {
                    get(_target, property) {
                        if (typeof property !== "string") return undefined
                        return { min: lowerOutPanelValue(property), max: outPanelValue(property) }
                    },
                })
                const formulaInCombatIntervalPanel = new Proxy({}, {
                    get(_target, property) {
                        if (property === "anomalyMastery") return { min: lowerAnomalyMastery, max: anomalyMastery }
                        if (property === "anomalyProficiency") return { min: lowerAnomalyProficiency, max: anomalyProficiency }
                        if (property === "atk") return { min: lowerAtk, max: atk }
                        if (typeof property !== "string") return undefined
                        return {
                            min: lowerOutPanelValue(property) + denseCombatValue(fixedCombatValues, property),
                            max: outPanelValue(property) + denseCombatValue(fixedCombatValues, property),
                        }
                    },
                })
                for (const event of compiledEvents) {
                    const elementDmg = outPanelValue(event.damageKey) + denseCombatValue(fixedCombatValues, event.damageKey)
                    const resIgnore = event.resistanceFixedOne
                        ? 0
                        : outPanelValue(ALL_RES_IGNORE_KEY)
                            + denseCombatValue(fixedCombatValues, ALL_RES_IGNORE_KEY)
                            + outPanelValue(event.resIgnoreKey)
                            + denseCombatValue(fixedCombatValues, event.resIgnoreKey)
                            + event.modifierResIgnore
                    const resistanceMultiplier = event.resistanceFixedOne
                        ? 1
                        : clampNumber(
                            1 - (event.targetResistance - event.enemyResReduction - resIgnore),
                            0.01,
                            2,
                        )
                    const effectiveCritDmg = critDmg + event.targetedCritDmgBonus
                    const critMultiplier = event.critMode === "crit"
                        ? 1 + effectiveCritDmg
                        : event.critMode === "nonCrit"
                            ? 1
                            : critRate * (1 + effectiveCritDmg) + (1 - critRate)
                    if (event.kind === "sheer") {
                        total += sheerForce
                            * event.effectiveSkillMultiplier
                            * critMultiplier
                            * (1 + dmgBonus + elementDmg + event.skillDamageBonus)
                            * resistanceMultiplier
                            * (1 + event.sheerDmgBonus)
                            * event.stunMultiplier
                            * event.damageScale
                            * event.count
                        continue
                    }
                    const effectiveDefense = Math.max(
                        0,
                        event.targetDefenseAfterReduction * (1 - (penRatio + event.targetedPenRatio)) - penFlat,
                    )
                    const defenseMultiplier = Math.min(1, event.levelCoefficient / (event.levelCoefficient + effectiveDefense))
                    if (event.kind === "direct") {
                        total += (event.damageBasis === "anomalyProficiency" ? anomalyProficiency : atk)
                            * event.effectiveSkillMultiplier
                            * (1 + dmgBonus + elementDmg + event.directDamageBonus)
                            * defenseMultiplier
                            * resistanceMultiplier
                            * event.stunMultiplier
                            * critMultiplier
                            * event.damageScale
                            * event.count
                        continue
                    }
                    const releaseBaseMultiplier = event.isRelease && hasFormulaInterval
                        ? evaluateAnomalyReleaseProfileInterval(event.releaseProfile, {
                            originalBaseMultiplier: Number(event.baseMultiplierPerProc ?? event.baseMultiplier ?? 0),
                            trigger: {
                                inCombatPanel: formulaInCombatIntervalPanel,
                                outOfCombatPanel: formulaOutOfCombatIntervalPanel,
                            },
                            coreScalingRow: event.releaseCoreScalingRow,
                            event,
                            eventElement: event.damageElement,
                        }).finalBaseMultiplier.max
                        : null
                    const effectiveBaseMultiplier = event.isRelease
                        ? Math.max(
                            0,
                            (releaseBaseMultiplier ?? compiledEventBaseMultiplier(
                                event,
                                event.durationBonusSeconds,
                                formulaInCombatPanel,
                                formulaOutOfCombatPanel,
                            )) + event.baseMultiplierBonus,
                        ) * event.baseMultiplierScale
                        : event.effectiveBaseMultiplier
                    const explicitCritConversion = Number(event.anomalyCritRatePerInitialMasteryAbove100 ?? 0)
                    const releaseMasteryCritRate = event.isRelease && explicitCritConversion !== 0
                        ? calculateInitialMasteryConvertedAnomalyCritRate(
                            hasFormulaInterval
                                ? formulaOutOfCombatIntervalPanel.anomalyMastery.max
                                : formulaOutOfCombatPanel.anomalyMastery,
                            explicitCritConversion,
                        )
                        : event.isRelease && event.anomalyCritRate > 0
                            ? hasFormulaInterval && event.releaseProfile?.critRateBonusExpression
                                ? Math.max(0, evaluateReleaseExpressionInterval(event.releaseProfile.critRateBonusExpression, {
                                    trigger: {
                                        inCombatPanel: formulaInCombatIntervalPanel,
                                        outOfCombatPanel: formulaOutOfCombatIntervalPanel,
                                    },
                                    coreScalingRow: event.releaseCoreScalingRow,
                                    event,
                                    eventElement: event.damageElement,
                                }).max)
                                : releaseCritRateBonusForEvent(event, formulaInCombatPanel, formulaOutOfCombatPanel)
                            : 0
                    const anomalyCritMultiplier = event.anomalyCritDmg > 0
                        ? 1 + clampNumber(event.anomalyCritRate + releaseMasteryCritRate, 0, 1) * event.anomalyCritDmg
                        : 1
                    total += atk
                        * effectiveBaseMultiplier
                        * (1 + dmgBonus + elementDmg + event.skillDamageBonus)
                        * defenseMultiplier
                        * resistanceMultiplier
                        * event.stunMultiplier
                        * (Math.max(0, anomalyProficiency) / 100)
                        * compiledDamageTarget.anomalyLevelMultiplier
                        * event.anomalyDamageBonus
                        * event.alienationMultiplier
                        * anomalyCritMultiplier
                        * event.damageScale
                        * event.count
                }
                scalarResult.selectedDmgBonus = dmgBonus
                scalarResult.finalDamage = total
                return scalarResult
            }

            return {
                releaseIntervalBound: compiledEvents.some(event => event.isRelease),
                scoreObjectiveScalar,
                scoreCombinedScalar(statValues = [], branchIndexedVector = null, suffixDenseVector = null, optimisticIndexedVector = null) {
                    return scoreObjectiveScalar(statValues, suffixDenseVector, branchIndexedVector, optimisticIndexedVector)
                },
            }
        }

        return {
            scoreKernel: "compiled-dense",
            panelStatIds: OUTPUT_PANEL_KEYS,
            scoreDense,
            compileForSetCounts(setCountValues = []) {
                const fixedSetCountValues = new Int16Array(setCountValues)
                const fixedOutOfCombatTarget = denseOutOfCombat.compileForSetCounts?.(fixedSetCountValues) ?? null
                const fixedCandidates = entries
                    .map((entry, index) => ({ entry, index }))
                    .filter(({ entry }) => entry.setIndex === null || Number(fixedSetCountValues[entry.setIndex] ?? 0) >= Number(entry.minSetCount ?? 0))
                const fixedExclusiveGroups = new Set()
                const fixedActiveEntryIndexes = fixedCandidates
                    .filter(({ entry }) => {
                        if (!entry.exclusiveGroup) return true
                        if (fixedExclusiveGroups.has(entry.exclusiveGroup)) return false
                        fixedExclusiveGroups.add(entry.exclusiveGroup)
                        return true
                    })
                    .map(({ index }) => index)
                const hasDynamicOutOfCombatRequirements = fixedActiveEntryIndexes
                    .some(index => entries[index]?.hasOutOfCombatStatRequirements)
                const fixedCombatValues = new Float64Array(COMBAT_BONUS_KEYS.length)
                const fixedEntryFlags = new Uint8Array(entries.length)
                if (!hasDynamicOutOfCombatRequirements) {
                    for (const entryIndex of fixedActiveEntryIndexes) {
                        const entry = entries[entryIndex]
                        fixedEntryFlags[entryIndex] = 1
                        for (const stat of entry.stats ?? []) {
                            addDenseCombatStat(fixedCombatValues, stat, entry.sourceType, null, null)
                        }
                    }
                }
                const fixedDirectKernel = fixedOutOfCombatTarget && !hasDynamicOutOfCombatRequirements
                    ? compileFixedDirectScoreKernel(fixedOutOfCombatTarget, fixedCombatValues, fixedEntryFlags)
                    : null
                const fixedObjectiveKernel = fixedDirectKernel ?? (fixedOutOfCombatTarget && !hasDynamicOutOfCombatRequirements
                    ? compileFixedNonDirectObjectiveKernel(fixedOutOfCombatTarget, fixedCombatValues, fixedEntryFlags)
                    : null)
                return {
                    scoreKernel: fixedObjectiveKernel ? "compiled-objective-fixed-sets" : "compiled-dense-fixed-sets",
                    scoreObjectiveScalar: fixedObjectiveKernel?.scoreObjectiveScalar,
                    scoreCombinedScalar: fixedObjectiveKernel?.scoreCombinedScalar,
                    scoreScalar(statValues = []) {
                        if (fixedDirectKernel) {
                            return fixedDirectKernel.scoreScalar(statValues)
                        }
                        const summary = scoreDense(
                            statValues,
                            fixedSetCountValues,
                            false,
                            fixedOutOfCombatTarget,
                            fixedActiveEntryIndexes,
                            hasDynamicOutOfCombatRequirements ? null : fixedCombatValues,
                            hasDynamicOutOfCombatRequirements ? null : fixedEntryFlags,
                        )
                        scalarResult.outOfCombatPanelValues = summary.outOfCombatPanelValues
                        scalarResult.selectedDmgBonus = summary.selectedDmgBonus
                        scalarResult.finalDamage = summary.finalDamage
                        return scalarResult
                    },
                }
            },
        }
    }

    function scoreOnlyFromPreparedSummary(outOfCombat, { setCounts = new Map(), getSetCount = null, useCompiledDamage = true } = {}) {
        const bonusTotals = createCombatBonusTotals()
        const activeEffects = null
        const ignoredEffects = null
        const exclusiveGroups = new Set()
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
                agent,
                effect: buff,
                key: buff.id,
                name: buff.name,
                sourceType: buff.sourceType ?? "manual",
                conditionLabel: buff.conditionLabel,
                outOfCombat,
                runtimeInput: combatBuffRuntimeInput(buff, runtimeInputs),
                buffModifiers: activeBuffModifiers,
                activeEffects,
                ignoredEffects,
            })
        }

        for (const entry of activeAgentBuffs) {
            applyCombatEffect({
                bonusTotals,
                agent,
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
                agent,
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
                agent,
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

        for (const [setId, set] of driveDiscSets) {
            if (readSetCount(setId) < 2) continue
            const effect = driveDiscTwoPieceCombatBuff(set)
            if (!effect) continue
            applyCombatEffect({
                bonusTotals,
                agent,
                effect,
                key: driveDisc2pcKey(setId),
                name: set.name,
                sourceType: "driveDisc2pc",
                outOfCombat,
                runtimeInput: runtimeInputs[driveDisc2pcKey(setId)],
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
                agent,
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
                exclusiveGroups,
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
                agent,
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
                exclusiveGroups,
            })
        })

        for (const entry of activeManualEntries) {
            applyCombatEffect({
                bonusTotals,
                agent,
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
                agent,
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
            outOfCombatPanel: outOfCombat.panel,
            selectedDmgBonus: inCombatPanel.selectedDmgBonus,
            finalDamage: useCompiledDamage
                ? calculateCompiledDamageScoreValue({
                    agent,
                    panel: inCombatPanel.panel,
                    outOfCombatPanel: outOfCombat.panel,
                    bonusTotals,
                    compiledDamageTarget,
                })
                : calculateDamageTotalFinalValue({
                    agent,
                    panel: inCombatPanel.panel,
                    outOfCombatPanel: outOfCombat.panel,
                    bonusTotals,
                    damageRequest: normalizedDamageInput,
                }),
        }
    }

    return {
        compiledScoreOnly: true,
        compileDensePanelScoreTarget,
        optimizerStatMetadata,
        calculate(driveDiscs = [], options = {}) {
            const outOfCombat = outOfCombatCalculator.calculate(driveDiscs, { round: false })
            const bonusTotals = createCombatBonusTotals()
            const activeEffects = []
            const ignoredEffects = []
            const exclusiveGroups = new Set()
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
                    agent,
                    effect: buff,
                    key: buff.id,
                    name: buff.name,
                    sourceType: buff.sourceType ?? "manual",
                    conditionLabel: buff.conditionLabel,
                    outOfCombat,
                    runtimeInput: combatBuffRuntimeInput(buff, runtimeInputs),
                    buffModifiers: activeBuffModifiers,
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeAgentBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    agent,
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
                    agent,
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
                    agent,
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

            for (const [setId, set] of driveDiscSets) {
                if ((setCounts.get(setId) ?? 0) < 2) continue
                const effect = driveDiscTwoPieceCombatBuff(set)
                if (!effect) continue
                applyCombatEffect({
                    bonusTotals,
                    agent,
                    effect,
                    key: driveDisc2pcKey(setId),
                    name: set.name,
                    sourceType: "driveDisc2pc",
                    outOfCombat,
                    runtimeInput: runtimeInputs[driveDisc2pcKey(setId)],
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
                    agent,
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
                    exclusiveGroups,
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
                    agent,
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
                    exclusiveGroups,
                })
            })

            for (const entry of activeManualEntries) {
                applyCombatEffect({
                    bonusTotals,
                    agent,
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
                    agent,
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
                outOfCombatPanel: outOfCombat.panel,
                selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                bonusTotals,
                input: input.damage,
                skillOptions: {
                    coreSkillLevel: input.coreSkillLevel,
                    cinemaLevel: input.cinemaLevel,
                    potentialLevel,
                    outOfCombatBaseAtk: outOfCombat.base?.atk,
                },
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
    const activeBuffIds = new Set(
        (Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
            .map(id => normalizeWEngineBuffKey(catalog, id)),
    )
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []
    const manualEffects = Array.isArray(combatInput.manualEffects) ? combatInput.manualEffects : []
    const runtimeInputs = normalizeWEngineKeyedRecord(catalog, combatInput.runtimeInputs)
    const wEngineTeamModificationLevels = wEngineTeamModificationLevelMap(catalog, combatInput)

    const outOfCombat = calculateOutOfCombatPanel(catalog, input)
    const bonusTotals = createCombatBonusTotals()
    const activeEffects = []
    const ignoredEffects = []
    const exclusiveGroups = new Set()
    const activeCatalogBuffs = (catalog.combatBuffs ?? []).filter(buff => activeBuffIds.has(buff.id))
    const potentialLevel = normalizePotentialLevel(agent, input.potentialLevel)
    const activeAgentBuffs = agentCombatBuffEntries(agent, input.coreSkillLevel, potentialLevel)
        .filter(entry => activeBuffIds.has(entry.id))
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
            agent,
            effect: buff,
            key: buff.id,
            name: buff.name,
            sourceType: buff.sourceType ?? "manual",
            conditionLabel: buff.conditionLabel,
            outOfCombat,
            runtimeInput: combatBuffRuntimeInput(buff, runtimeInputs),
            buffModifiers: activeBuffModifiers,
            activeEffects,
            ignoredEffects,
        })
    }

    for (const entry of activeAgentBuffs) {
        applyCombatEffect({
            bonusTotals,
            agent,
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
            agent,
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
            agent,
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

    for (const [setId, set] of driveDiscSets) {
        if ((setCounts.get(setId) ?? 0) < 2) continue
        const effect = driveDiscTwoPieceCombatBuff(set)
        if (!effect) continue
        applyCombatEffect({
            bonusTotals,
            agent,
            effect,
            key: driveDisc2pcKey(setId),
            name: set.name,
            sourceType: "driveDisc2pc",
            outOfCombat,
            runtimeInput: runtimeInputs[driveDisc2pcKey(setId)],
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
            agent,
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
            exclusiveGroups,
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
            agent,
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
            exclusiveGroups,
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
            agent,
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
            agent,
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
        outOfCombatPanel: outOfCombat.panel,
        selectedDmgBonus: inCombatPanel.selectedDmgBonus,
        bonusTotals,
        input: input.damage,
        skillOptions: {
            coreSkillLevel: input.coreSkillLevel,
            cinemaLevel: input.cinemaLevel,
            potentialLevel,
            outOfCombatBaseAtk: outOfCombat.base?.atk,
        },
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

