import { evaluateFormulaExpression, validateFormulaExpression } from "./formulaEvaluator.js"
import { isDefaultCalculationCinemaLevel } from "./defaultCalculationConfig.js"
import {
    SKILL_TAG_VALUES,
    SKILL_TYPE_LABELS,
    SKILL_TYPE_VALUES,
    normalizeSkillTarget,
    skillTypeForMove,
    unknownLegacySkillTargetPrefixes,
} from "./skillTargets.js"
import { ELEMENT_CRIT_DMG_STATS, ELEMENT_DEF_IGNORE_STATS } from "./effectRuleTargets.js"

const ID_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/
const PLACEHOLDER_NAMES = new Set(["未命名"])

export const SYSTEM_MANAGED_SKILL_GROUP_COUNTS = Object.freeze({
    defaultCount: 1,
    minCount: 0,
    maxCount: 100,
    step: 1,
})

export const SYSTEM_MANAGED_COVERAGE = Object.freeze({
    default: 1,
    min: 0,
    max: 1,
    step: 0.1,
})

export function createSystemManagedCoverage(defaultValue = 1) {
    return { ...SYSTEM_MANAGED_COVERAGE, default: defaultValue }
}

function normalizeCoverageMetadata(coverage) {
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) {
        return coverage
    }
    if (coverage.default === undefined || coverage.default === null || coverage.default === "") {
        coverage.default = 1
    }
    coverage.min = SYSTEM_MANAGED_COVERAGE.min
    coverage.max = SYSTEM_MANAGED_COVERAGE.max
    coverage.step = SYSTEM_MANAGED_COVERAGE.step
    return coverage
}

export function applySystemManagedMaintenanceFields(value) {
    if (Array.isArray(value)) {
        value.forEach(applySystemManagedMaintenanceFields)
        return value
    }
    if (!value || typeof value !== "object") {
        return value
    }

    if (Array.isArray(value.skillGroups)) {
        value.skillGroups.forEach(group => {
            if (group && typeof group === "object" && !Array.isArray(group)) {
                Object.assign(group, SYSTEM_MANAGED_SKILL_GROUP_COUNTS)
            }
        })
    }
    const legacyCoverage = normalizeCoverageMetadata(value.coverage)
    if (legacyCoverage && Array.isArray(value.effects)) {
        value.effects.forEach(rule => {
            if (rule && typeof rule === "object" && !Array.isArray(rule) && !rule.coverage) {
                rule.coverage = { ...legacyCoverage }
            }
        })
        delete value.coverage
    }

    normalizeCoverageMetadata(value.coverage)
    Object.values(value).forEach(applySystemManagedMaintenanceFields)
    return value
}

export const FIELD_BUFF_MODE_OPTIONS = Object.freeze([
    {
        modeId: "defense_v5",
        label: "Defense Battle",
        selectLabel: { zhCN: "防卫战" },
        source: { zhCN: "防卫战 v5", en: "Defense Battle" },
    },
    {
        modeId: "critical_assault",
        label: "Perilous Situation",
        selectLabel: { zhCN: "危局" },
        source: { zhCN: "危局强袭战", en: "Perilous Situation" },
    },
])
export const FIELD_BUFF_GAME_VERSIONS = Object.freeze(["3.0", "3.1", "3.2", "3.3"])
export const FIELD_BUFF_PHASE_OPTIONS = Object.freeze([
    { phaseNo: 1, phaseName: { zhCN: "第一期" } },
    { phaseNo: 2, phaseName: { zhCN: "第二期" } },
    { phaseNo: 3, phaseName: { zhCN: "第三期" } },
    { phaseNo: 4, phaseName: { zhCN: "第四期" } },
])

const FIELD_BUFF_MODE_IDS = new Set(FIELD_BUFF_MODE_OPTIONS.map(option => option.modeId))
const FIELD_BUFF_GAME_VERSION_VALUES = new Set(FIELD_BUFF_GAME_VERSIONS)
const FIELD_BUFF_PHASE_VALUES = new Set(FIELD_BUFF_PHASE_OPTIONS.map(option => option.phaseNo))

export function fieldBuffModeOption(modeId) {
    const id = String(modeId ?? "").trim()
    return FIELD_BUFF_MODE_OPTIONS.find(option => option.modeId === id) ?? null
}

export function fieldBuffPhaseOption(phaseNo) {
    const no = Number(phaseNo)
    return FIELD_BUFF_PHASE_OPTIONS.find(option => option.phaseNo === no) ?? null
}

export function fieldBuffPhaseName(phaseNo) {
    return fieldBuffPhaseOption(phaseNo)?.phaseName ?? null
}

const ATTRIBUTE_VALUES = new Set(["physical", "fire", "ice", "electric", "ether", "wind", "honed_edge", "frost", "xuanmo"])
const DAMAGE_ELEMENT_VALUES = new Set(["physical", "fire", "ice", "electric", "ether", "wind"])
const SPECIALTY_VALUES = new Set(["attack", "stun", "anomaly", "support", "defense", "rupture"])
const RARITY_VALUES = new Set(["B", "A", "S"])
const SOURCE_TYPE_VALUES = new Set(["teammate", "self", "boss", "field", "manual"])
const EFFECT_SCOPE_VALUES = new Set(["outOfCombat", "inCombat"])
const IMPLICIT_EFFECT_SCOPE_BY_SOURCE_TYPE = new Map([
    ["driveDisc2pc", "outOfCombat"],
    ["driveDisc4pc", "inCombat"],
    ["driveDisc4pcTeam", "inCombat"],
])
const EFFECT_TYPE_VALUES = new Set(["fixed", "derived", "formula", "stacked", "damageModifier"])
const BUFF_MODIFIER_OPERATION_VALUES = new Set(["multiplyResolvedValue"])
const FORMULA_VALUE_UNIT_VALUES = new Set(["storedValue", "storedPercent"])
const SKILL_ROW_KIND_VALUES = new Set(["damageMultiplier", "dazeMultiplier", "energyCost", "statBonus"])
const SKILL_ROW_DAMAGE_BASIS_VALUES = new Set(["atk", "sheerForce", "anomalyProficiency"])
const SKILL_LEVEL_SCALE_VALUES = new Set(["skill", "coreSkill"])
const CORE_SKILL_LEVEL_VALUES = new Set(["0", "A", "B", "C", "D", "E", "F"])
const DAMAGE_EVENT_KIND_VALUES = new Set(["direct", "anomaly", "disorder", "sheer"])
const CALCULATION_EVENT_KIND_VALUES = new Set([...DAMAGE_EVENT_KIND_VALUES, "skillGroup"])
const ANOMALY_SETTLEMENT_TYPE_VALUES = new Set(["attribute", "disorder"])
const DISORDER_TYPE_VALUES = new Set(["normal", "polarized"])
const ANOMALY_VARIANT_VALUES = new Set(["normal", "polarizedAssault"])
const CALCULATION_MODE_VALUES = new Set(["single", "sheer", "anomaly", "custom"])
const SHEER_DAMAGE_MODIFIER_KIND_VALUES = ["sheerDmgBonus", "physicalSheerDmg", "fireSheerDmg", "iceSheerDmg", "electricSheerDmg", "etherSheerDmg", "windSheerDmg"]
const DAMAGE_MODIFIER_KIND_VALUES = new Set(["anomalyDamageBonus", "disorderDamageBonus", "baseMultiplierBonus", "disorderBaseMultiplierBonus", "anomalyCritRate", "anomalyCritDmg", "stunDmgMultiplierBonus", "stunDmgMultiplierBonusAlways", "stunDmgMultiplierBonusCapAlways", "directDamageBonus", "skillMultiplierBonus", ...SHEER_DAMAGE_MODIFIER_KIND_VALUES, ...ELEMENT_CRIT_DMG_STATS, ...ELEMENT_DEF_IGNORE_STATS])
const SKILL_TARGET_DAMAGE_MODIFIER_KIND_VALUES = new Set(["directDamageBonus", "skillMultiplierBonus"])
const DAMAGE_MODIFIER_VALUE_UNIT_VALUES = new Set(["decimal"])
const RULE_TARGET_KIND_VALUES = new Set(["default", "skill", "anomaly"])
const DEFAULT_EVENT_MODIFIER_STAT_VALUES = new Set(["anomalyDamageBonus", "disorderDamageBonus", "baseMultiplierBonus", "disorderBaseMultiplierBonus", "anomalyCritRate", "anomalyCritDmg", "anomalyDurationBonusSeconds", "stunDmgMultiplierBonus", "stunDmgMultiplierBonusAlways", "stunDmgMultiplierBonusCapAlways", ...SHEER_DAMAGE_MODIFIER_KIND_VALUES, ...ELEMENT_CRIT_DMG_STATS, ...ELEMENT_DEF_IGNORE_STATS])
const SKILL_TARGET_STAT_VALUES = new Set([
    "allResIgnore",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "enemyDefReduction",
    "enemyDefIgnore",
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
    "stunDmgMultiplierBonusCapAlways",
    ...SHEER_DAMAGE_MODIFIER_KIND_VALUES,
    ...ELEMENT_CRIT_DMG_STATS,
    ...ELEMENT_DEF_IGNORE_STATS,
    "skillMultiplierBonus",
])
const ANOMALY_TARGET_STAT_VALUES = new Set([
    "allResIgnore",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "enemyDefReduction",
    "enemyDefIgnore",
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
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "anomalyDurationBonusSeconds",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "stunDmgMultiplierBonusCapAlways",
    ...ELEMENT_DEF_IGNORE_STATS,
])
const ANOMALY_EFFECT_VALUES = new Set(["assault", "shatter", "burn", "shock", "corruption", "frozen", "flinch"])
const ANOMALY_MAINTENANCE_TYPE_VALUES = new Set(["anomaly", "disorder"])
const STAT_VALUES = new Set([
    "atkFlat",
    "atkPct",
    "hpFlat",
    "hpPct",
    "sheerForceFlat",
    "defFlat",
    "defPct",
    "critRate",
    "critDmg",
    "impact",
    "impactPct",
    "impactFlat",
    "anomalyProficiency",
    "anomalyProficiencyPerMasteryAbove140",
    "anomalyMastery",
    "anomalyMasteryFlat",
    "energyRegen",
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
    "hpBase",
    "atkBase",
    "defBase",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
])
const RULE_STAT_VALUES = new Set([...STAT_VALUES, ...DEFAULT_EVENT_MODIFIER_STAT_VALUES, ...SKILL_TARGET_STAT_VALUES])
const TARGET_STAT_VALUES = new Set([
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
])
const MODE_VALUES = new Set(["flat", "pct"])
const BASIS_VALUES = new Set(["baseHp", "outOfCombatHp", "baseAtk", "outOfCombatAtk", "baseDef", "outOfCombatDef"])
const REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES = new Set(["self", "wEngine", "driveDisc4pc"])

const AGENT_LEVEL_STATS = [
    "hpBase",
    "atkBase",
    "defBase",
    "critRate",
    "critDmg",
    "impact",
    "anomalyProficiency",
    "anomalyMastery",
    "energyRegen",
    "penRatio",
]

function zh(value) {
    if (typeof value === "string") {
        return value.trim()
    }

    return String(value?.zhCN ?? value?.en ?? "").trim()
}

function numeric(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : NaN
}

function hasText(value) {
    return zh(value).length > 0
}

function isPlaceholderName(value) {
    return PLACEHOLDER_NAMES.has(zh(value))
}

function rulesOf(effect = {}) {
    if (Array.isArray(effect?.effects)) {
        return effect.effects
    }

    if (Array.isArray(effect?.stats)) {
        return effect.stats.map((stat, index) => ({
            id: stat.id ?? `legacy-${index + 1}`,
            type: "fixed",
            ...stat,
        }))
    }

    return []
}

function buffModifiersOf(effect = {}) {
    return Array.isArray(effect?.buffModifiers) ? effect.buffModifiers : []
}

function hasRulesOrModifiers(effect = {}) {
    return rulesOf(effect).length > 0 || buffModifiersOf(effect).length > 0
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch {
        return false
    }
}

function add(errors, path, message) {
    errors.push(`${path}: ${message}`)
}

function requireId(errors, item, path = "id") {
    const id = String(item?.id ?? "").trim()
    if (!id) {
        add(errors, path, "必填。")
        return
    }
    if (!ID_PATTERN.test(id)) {
        add(errors, path, "只能使用小写字母、数字、下划线、点号或连字符，且必须以小写字母或数字开头。")
    }
}

function validateOptionalId(errors, item, path = "id") {
    const id = String(item?.id ?? "").trim()
    if (id && !ID_PATTERN.test(id)) {
        add(errors, path, "只能使用小写字母、数字、下划线、点号或连字符，且必须以小写字母或数字开头。")
    }
}

function requireName(errors, value, path) {
    if (!hasText(value)) {
        add(errors, path, "中文名必填。")
        return
    }
    if (isPlaceholderName(value)) {
        add(errors, path, "保存前请把“未命名”改成正式名称。")
    }
}

function requireEnum(errors, value, values, path) {
    if (!values.has(value)) {
        add(errors, path, "不是支持的选项。")
    }
}

function requireFinite(errors, value, path) {
    if (!Number.isFinite(numeric(value))) {
        add(errors, path, "必须是有效数字。")
        return NaN
    }
    return numeric(value)
}

function validateOptionalSources(errors, item, imagePath) {
    const image = imagePath ? String(imagePath).trim() : ""
    if (image && !image.startsWith("/assets/") && !isValidHttpUrl(image)) {
        add(errors, "images", "图片路径必须是 /assets/... 或 http(s) URL。")
    }

    const source = String(item?.images?.source ?? item?.sources?.[0] ?? "").trim()
    if (source && !isValidHttpUrl(source)) {
        add(errors, "sources", "资料来源必须是 http(s) URL。")
    }
}

function validateCoverage(errors, coverage, path) {
    if (!coverage) {
        return
    }

    const value = requireFinite(errors, coverage.default, `${path}.default`)
    if (Number.isFinite(value) && (value < 0 || value > 1)) {
        add(errors, `${path}.default`, "覆盖率必须在 0 到 1 之间。")
    }
}

function validateModificationValues(errors, container, key, path, rankOneValue) {
    if (!container) {
        return
    }

    if (typeof container !== "object" || Array.isArray(container)) {
        add(errors, path, "必须是 JSON 对象。")
        return
    }

    const values = container[key]
    if (!Array.isArray(values) || values.length !== 5) {
        add(errors, `${path}.${key}`, "必须覆盖 1-5 级五个实际值。")
    } else {
        values.forEach((value, index) => requireFinite(errors, value, `${path}.${key}[${index}]`))
    }

    const rankOne = Number(values?.[0])
    if (Number.isFinite(rankOne) && Number.isFinite(rankOneValue) && Math.abs(rankOne - rankOneValue) > 1e-9) {
        add(errors, `${path}.${key}[0]`, "1级实际值必须与规则当前数值一致。")
    }
}

function validateEffectRule(errors, rule = {}, path, sourceType = "manual", scope = "outOfCombat", context = {}) {
    const type = rule.type ?? "fixed"
    const targetKind = rule.target?.kind ?? "default"
    const effectiveScope = sourceType === "driveDisc2pc" && targetKind === "skill"
        ? "inCombat"
        : scope
    requireEnum(errors, type, EFFECT_TYPE_VALUES, `${path}.type`)
    validateCoverage(errors, rule.coverage, `${path}.coverage`)
    if (rule.coverage && effectiveScope !== "inCombat") {
        add(errors, `${path}.coverage`, "只有局内 Buff 增幅可以配置覆盖率。")
    }
    for (const [key, label] of [["durationSeconds", "持续时间"], ["cooldownSeconds", "冷却时间"]]) {
        if (rule[key] === undefined || rule[key] === null || rule[key] === "") continue
        const value = requireFinite(errors, rule[key], `${path}.${key}`)
        if (Number.isFinite(value) && value <= 0) {
            add(errors, `${path}.${key}`, `${label}必须大于 0。`)
        }
    }
    if (rule.requirement?.specialty) {
        requireEnum(errors, rule.requirement.specialty, SPECIALTY_VALUES, `${path}.requirement.specialty`)
    }
    if (rule.modificationScaling) {
        add(errors, `${path}.modificationScaling`, "旧的改装等级缩放格式已废弃，请使用 modificationValues。")
    }

    if (type === "damageModifier") {
        if (rule.modificationValues) {
            add(errors, `${path}.modificationValues`, "改装等级实际值只支持固定值或叠层规则。")
        }
        requireEnum(errors, rule.kind, DAMAGE_MODIFIER_KIND_VALUES, `${path}.kind`)
        const value = requireFinite(errors, rule.value, `${path}.value`)
        if (Number.isFinite(value) && value === 0) {
            add(errors, `${path}.value`, "数值不能为 0。")
        }
        if (rule.valueUnit != null && rule.valueUnit !== "") {
            requireEnum(errors, rule.valueUnit, DAMAGE_MODIFIER_VALUE_UNIT_VALUES, `${path}.valueUnit`)
        }
        const appliesTo = rule.appliesTo ?? {}
        if (rule.appliesTo != null) {
            add(errors, `${path}.appliesTo`, "旧适用范围不能继续保存，请重新选择明确的增幅类型或技能增幅对象。")
        }
        if (SKILL_TARGET_DAMAGE_MODIFIER_KIND_VALUES.has(rule.kind)
            && (!Array.isArray(appliesTo.skillTargets) || !appliesTo.skillTargets.length)) {
            add(errors, `${path}.appliesTo.skillTargets`, "指定技能修正必须至少选择一个技能目标。")
        }
        if (effectiveScope !== "inCombat") {
            add(errors, `${path}.type`, "伤害修正只能用于局内 Buff。")
        }
        return
    }

    const target = rule.target ?? { kind: "default" }
    requireEnum(errors, targetKind, RULE_TARGET_KIND_VALUES, `${path}.target.kind`)
    if (targetKind === "skill") {
        if (!Array.isArray(target.skillTargets) || !target.skillTargets.length) {
            add(errors, `${path}.target.skillTargets`, "技能增幅必须至少选择一个技能目标。")
        } else {
            target.skillTargets.forEach((skillTarget, index) => validateSkillTarget(errors, skillTarget, `${path}.target.skillTargets[${index}]`, context))
            validateSkillTargetModes(errors, target.skillTargets, `${path}.target.skillTargets`)
        }
        if (!SKILL_TARGET_STAT_VALUES.has(rule.stat)) {
            add(errors, `${path}.stat`, "技能增幅对象不支持该增幅类型。")
        }
        if (effectiveScope !== "inCombat") {
            add(errors, `${path}.target.kind`, "技能增幅对象只能用于局内 Buff。")
        }
    } else if (targetKind === "anomaly") {
        const settlementType = target.settlementType
        requireEnum(errors, settlementType, ANOMALY_SETTLEMENT_TYPE_VALUES, `${path}.target.settlementType`)
        if (!Array.isArray(target.anomalyEffects) || !target.anomalyEffects.length) {
            add(errors, `${path}.target.anomalyEffects`, "异常增幅必须至少选择一个异常效果。")
        } else {
            const validEffects = calculationAnomalyIds(context, settlementType === "disorder" ? "disorder" : "anomaly")
            target.anomalyEffects.forEach((effectId, index) => {
                if (!validEffects.has(effectId)) {
                    add(errors, `${path}.target.anomalyEffects[${index}]`, "异常效果不存在或不属于所选结算类型。")
                }
            })
        }
        if (!ANOMALY_TARGET_STAT_VALUES.has(rule.stat)) {
            add(errors, `${path}.stat`, "异常增幅对象不支持该增幅类型。")
        }
        if (effectiveScope !== "inCombat") {
            add(errors, `${path}.target.kind`, "异常增幅对象只能用于局内 Buff。")
        }
    } else if (!STAT_VALUES.has(rule.stat) && !DEFAULT_EVENT_MODIFIER_STAT_VALUES.has(rule.stat)) {
        add(errors, `${path}.stat`, "不是支持的选项。")
    }
    if (rule.stat === "anomalyDurationBonusSeconds"
        && (targetKind !== "anomaly" || target.settlementType !== "disorder")) {
        add(errors, `${path}.stat`, "异常持续时间延长必须指定一个紊乱原异常。")
    }
    if (DEFAULT_EVENT_MODIFIER_STAT_VALUES.has(rule.stat) && effectiveScope !== "inCombat") {
        add(errors, `${path}.stat`, "事件增幅只能用于局内 Buff。")
    }
    if (rule.appliesTo != null) {
        add(errors, `${path}.appliesTo`, "旧适用范围不能继续保存，请重新选择明确的增幅类型或技能增幅对象。")
    }

    requireEnum(errors, rule.stat, RULE_STAT_VALUES, `${path}.stat`)

    const mode = rule.mode ?? "flat"
    requireEnum(errors, mode, MODE_VALUES, `${path}.mode`)

    if (rule.basis != null && rule.basis !== "") {
        requireEnum(errors, rule.basis, BASIS_VALUES, `${path}.basis`)
    }

    if (rule.stat === "atkPct" && mode === "pct" && REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES.has(sourceType) && !rule.basis) {
        add(errors, `${path}.basis`, "局内 atkPct 对自身、音擎或驱动盘 4 件套必须填写基准。")
    }

    if (TARGET_STAT_VALUES.has(rule.stat) && scope !== "inCombat") {
        add(errors, `${path}.stat`, "敌方目标属性只能用于局内 Buff。")
    }

    if (type === "derived") {
        if (rule.modificationValues) {
            add(errors, `${path}.modificationValues`, "改装等级实际值只支持固定值或叠层规则。")
        }
        requireName(errors, rule.sourceLabel, `${path}.sourceLabel`)
        requireFinite(errors, rule.defaultSourceValue, `${path}.defaultSourceValue`)
        const ratio = requireFinite(errors, rule.ratio ?? rule.ratioPct, `${path}.ratio`)
        if (Number.isFinite(ratio) && ratio === 0) {
            add(errors, `${path}.ratio`, "转换比例不能为 0。")
        }
        if (rule.cap !== undefined && rule.cap !== null && rule.cap !== "") {
            const cap = requireFinite(errors, rule.cap, `${path}.cap`)
            if (Number.isFinite(cap) && cap <= 0) {
                add(errors, `${path}.cap`, "上限必须大于 0。")
            }
        }
        return
    }

    if (type === "formula") {
        if (rule.modificationValues) {
            add(errors, `${path}.modificationValues`, "改装等级实际值只支持固定值或叠层规则。")
        }
        const source = rule.source ?? {}
        requireName(errors, source.label ?? rule.sourceLabel, `${path}.source.label`)
        const variable = source.variable ?? "x"
        if (variable !== "x") {
            add(errors, `${path}.source.variable`, "首版公式只支持变量 x。")
        }

        const defaultValue = requireFinite(errors, source.defaultValue, `${path}.source.defaultValue`)
        const min = source.min !== undefined && source.min !== null && source.min !== ""
            ? requireFinite(errors, source.min, `${path}.source.min`)
            : NaN
        const max = source.max !== undefined && source.max !== null && source.max !== ""
            ? requireFinite(errors, source.max, `${path}.source.max`)
            : NaN
        if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
            add(errors, `${path}.source.min`, "来源数值下限不能大于上限。")
        }
        if (Number.isFinite(defaultValue)) {
            if (Number.isFinite(min) && defaultValue < min) {
                add(errors, `${path}.source.defaultValue`, "默认来源数值不能低于下限。")
            }
            if (Number.isFinite(max) && defaultValue > max) {
                add(errors, `${path}.source.defaultValue`, "默认来源数值不能高于上限。")
            }
        }

        const expression = String(rule.formula?.expression ?? "").trim()
        if (!expression) {
            add(errors, `${path}.formula.expression`, "公式必填。")
        } else {
            try {
                validateFormulaExpression(expression, new Set(["x"]))
                const x = Math.max(
                    Number.isFinite(min) ? min : defaultValue,
                    Math.min(Number.isFinite(max) ? max : defaultValue, defaultValue),
                )
                evaluateFormulaExpression(expression, { x })
            } catch (error) {
                add(errors, `${path}.formula.expression`, `公式无效：${error.message}`)
            }
        }
        requireEnum(errors, rule.formula?.valueUnit ?? "storedValue", FORMULA_VALUE_UNIT_VALUES, `${path}.formula.valueUnit`)
        return
    }

    if (type === "stacked") {
        validateOptionalId(errors, { id: rule.stackGroup }, `${path}.stackGroup`)
        const value = requireFinite(errors, rule.valuePerStack ?? rule.value, `${path}.valuePerStack`)
        if (Number.isFinite(value) && value === 0) {
            add(errors, `${path}.valuePerStack`, "每层数值不能为 0。")
        }
        const maxStacks = requireFinite(errors, rule.maxStacks, `${path}.maxStacks`)
        if (Number.isFinite(maxStacks) && (!Number.isInteger(maxStacks) || maxStacks <= 0)) {
            add(errors, `${path}.maxStacks`, "最大层数必须是正整数。")
        }
        const defaultStacks = requireFinite(errors, rule.defaultStacks, `${path}.defaultStacks`)
        if (Number.isFinite(defaultStacks) && Number.isFinite(maxStacks) && (defaultStacks < 0 || defaultStacks > maxStacks)) {
            add(errors, `${path}.defaultStacks`, "默认层数必须在 0 到最大层数之间。")
        }
        validateModificationValues(errors, rule.modificationValues, "valuePerStack", `${path}.modificationValues`, value)
        return
    }

    const value = requireFinite(errors, rule.value, `${path}.value`)
    if (Number.isFinite(value) && value === 0) {
        add(errors, `${path}.value`, "数值不能为 0。")
    }
    validateModificationValues(errors, rule.modificationValues, "value", `${path}.modificationValues`, value)
}

function validateStackRuleGroups(errors, rules = [], path) {
    const groups = new Map()
    rules.forEach((rule, index) => {
        if ((rule?.type ?? "fixed") !== "stacked") {
            return
        }
        const stackGroup = String(rule.stackGroup ?? "").trim()
        if (!stackGroup) {
            return
        }
        const maxStacks = Number(rule.maxStacks)
        const defaultStacks = Number(rule.defaultStacks)
        const groupPath = `${path}.effects[${index}].stackGroup`
        const existing = groups.get(stackGroup)
        if (!existing) {
            groups.set(stackGroup, {
                maxStacks,
                defaultStacks,
            })
            return
        }
        if (Number.isFinite(maxStacks)
            && Number.isFinite(existing.maxStacks)
            && Math.abs(maxStacks - existing.maxStacks) > 1e-9) {
            add(errors, groupPath, "同一共享层数组的最大层数必须一致。")
        }
        if (Number.isFinite(defaultStacks)
            && Number.isFinite(existing.defaultStacks)
            && Math.abs(defaultStacks - existing.defaultStacks) > 1e-9) {
            add(errors, groupPath, "同一共享层数组的默认层数必须一致。")
        }
    })
}

function validateRequiredStringList(errors, value, path, label) {
    if (!Array.isArray(value) || !value.length) {
        add(errors, path, `${label}至少需要填写一个。`)
        return
    }

    value.forEach((item, index) => {
        if (!String(item ?? "").trim()) {
            add(errors, `${path}[${index}]`, `${label}不能为空。`)
        }
    })
}

function validateBuffModifier(errors, modifier = {}, path, scope = "outOfCombat") {
    if (modifier.id) {
        validateOptionalId(errors, { id: modifier.id }, `${path}.id`)
    }

    const operation = modifier.operation ?? "multiplyResolvedValue"
    requireEnum(errors, operation, BUFF_MODIFIER_OPERATION_VALUES, `${path}.operation`)

    const factor = requireFinite(errors, modifier.factor, `${path}.factor`)
    if (Number.isFinite(factor) && factor <= 0) {
        add(errors, `${path}.factor`, "倍率必须大于 0。")
    }

    validateRequiredStringList(errors, modifier.targetBuffIds, `${path}.targetBuffIds`, "目标 Buff ID")
    validateRequiredStringList(errors, modifier.targetEffectIds, `${path}.targetEffectIds`, "目标效果 ID")

    if (modifier.label && !hasText(modifier.label)) {
        add(errors, `${path}.label.zhCN`, "说明不能为空。")
    }

    if (scope !== "inCombat") {
        add(errors, `${path}.operation`, "Buff 修饰只能用于局内 Buff。")
    }
}

function validateSkillTargetModes(errors, targets = [], path) {
    const modes = new Set((Array.isArray(targets) ? targets : [])
        .flatMap(target => normalizeSkillTarget(target))
        .map(target => target.kind)
        .filter(kind => kind === "specific" || kind === "skillType" || kind === "skillTag"))
    if (modes.size > 1) {
        add(errors, path, "同一增幅中不能混合指定角色招式、通用技能大类和通用招式标签。")
    }
}

function validateSkillTarget(errors, target = {}, path, context = {}) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
        add(errors, path, "必须是技能目标对象。")
        return
    }

    if (target.kind === "skillType") {
        requireEnum(errors, target.skillType, SKILL_TYPE_VALUES, `${path}.skillType`)
        for (const key of ["agentSkillId", "categoryId", "moveId", "rowId", "moveIdPrefixes"]) {
            if (target[key] != null && (Array.isArray(target[key]) ? target[key].length : String(target[key]).trim())) {
                add(errors, `${path}.${key}`, "通用技能大类不能包含角色或具体招式条件。")
            }
        }
        return
    }

    if (target.kind === "skillTag") {
        requireEnum(errors, target.skillTag, SKILL_TAG_VALUES, `${path}.skillTag`)
        for (const key of ["agentSkillId", "categoryId", "skillType", "moveId", "rowId", "moveIdPrefixes"]) {
            if (target[key] != null && (Array.isArray(target[key]) ? target[key].length : String(target[key]).trim())) {
                add(errors, `${path}.${key}`, "通用招式标签不能包含角色、技能大类或具体招式条件。")
            }
        }
        return
    }

    if (target.kind === "specific") {
        requireId(errors, { id: target.agentSkillId }, `${path}.agentSkillId`)
        requireId(errors, { id: target.categoryId }, `${path}.categoryId`)
        requireEnum(errors, target.skillType, SKILL_TYPE_VALUES, `${path}.skillType`)
        validateOptionalId(errors, { id: target.moveId }, `${path}.moveId`)
        validateOptionalId(errors, { id: target.rowId }, `${path}.rowId`)
        if (target.rowId && !target.moveId) {
            add(errors, `${path}.rowId`, "选择具体招式后才能限定倍率行。")
        }
        if (Array.isArray(target.moveIdPrefixes) && target.moveIdPrefixes.length) {
            add(errors, `${path}.moveIdPrefixes`, "新技能目标不能包含旧版招式前缀。")
        }
        validateSpecificSkillTargetReference(errors, target, path, context)
        return
    }

    if (target.kind != null && target.kind !== "") {
        add(errors, `${path}.kind`, "只能选择指定角色招式、通用技能大类或通用招式标签。")
        return
    }

    validateOptionalId(errors, { id: target.agentSkillId }, `${path}.agentSkillId`)
    validateOptionalId(errors, { id: target.categoryId }, `${path}.categoryId`)
    validateOptionalId(errors, { id: target.moveId }, `${path}.moveId`)
    validateOptionalId(errors, { id: target.rowId }, `${path}.rowId`)
    if (target.moveIdPrefixes !== undefined) {
        if (!Array.isArray(target.moveIdPrefixes)) {
            add(errors, `${path}.moveIdPrefixes`, "必须是招式 ID 前缀数组。")
        } else {
            target.moveIdPrefixes.forEach((prefix, index) => {
                const text = String(prefix ?? "").trim()
                if (!text) {
                    add(errors, `${path}.moveIdPrefixes[${index}]`, "不能为空。")
                }
            })
        }
    }

    if (unknownLegacySkillTargetPrefixes(target).length) {
        add(errors, `${path}.moveIdPrefixes`, "旧版招式前缀无法转换，请重新选择通用技能大类或指定角色招式。")
    }

    const hasMoveIdPrefixes = Array.isArray(target.moveIdPrefixes)
        && target.moveIdPrefixes.some(prefix => String(prefix ?? "").trim())
    if (!target.agentSkillId && !target.categoryId && !target.moveId && !target.rowId && !hasMoveIdPrefixes) {
        add(errors, path, "必须至少填写一个技能目标条件。")
    }
}

function validateSpecificSkillTargetReference(errors, target, path, context = {}) {
    const agentSkills = Array.isArray(context.agentSkills) ? context.agentSkills : []
    if (!agentSkills.length) {
        return
    }
    const skillSet = agentSkills.find(item => item.id === target.agentSkillId)
    if (!skillSet) {
        add(errors, `${path}.agentSkillId`, "角色技能表不存在。")
        return
    }
    const category = (skillSet.categories ?? []).find(item => item.id === target.categoryId)
    if (!category) {
        add(errors, `${path}.categoryId`, "技能大类不存在。")
        return
    }
    const matchingMoves = (category.moves ?? []).filter(move => skillTypeForMove(category, move) === target.skillType)
    if (!matchingMoves.length) {
        add(errors, `${path}.skillType`, "该角色技能大类中没有对应招式。")
        return
    }
    if (!target.moveId) {
        return
    }
    const move = matchingMoves.find(item => item.id === target.moveId)
    if (!move) {
        add(errors, `${path}.moveId`, "招式不存在或不属于所选技能大类。")
        return
    }
    if (target.rowId && !(move.rows ?? []).some(row => row.id === target.rowId)) {
        add(errors, `${path}.rowId`, "倍率行不存在。")
    }
}

function validateEffectSet(errors, effect, path, options = {}) {
    if (!effect) {
        return
    }

    const configuredScope = effect.scope ?? "outOfCombat"
    requireEnum(errors, configuredScope, EFFECT_SCOPE_VALUES, `${path}.scope`)
    const effectiveScope = IMPLICIT_EFFECT_SCOPE_BY_SOURCE_TYPE.get(options.sourceType) ?? configuredScope
    validateCoverage(errors, effect.coverage, `${path}.coverage`)
    if (effect.exclusiveGroup) {
        validateOptionalId(errors, { id: effect.exclusiveGroup }, `${path}.exclusiveGroup`)
    }

    if (effect.durationSeconds !== undefined && effect.durationSeconds !== null && effect.durationSeconds !== "") {
        const duration = requireFinite(errors, effect.durationSeconds, `${path}.durationSeconds`)
        if (Number.isFinite(duration) && duration <= 0) {
            add(errors, `${path}.durationSeconds`, "持续时间必须大于 0。")
        }
    }

    const rules = rulesOf(effect)
    const buffModifiers = buffModifiersOf(effect)
    if (options.requireRule && !rules.length && !buffModifiers.length) {
        add(errors, `${path}.effects`, "至少需要一条有效规则。")
    }

    rules.forEach((rule, index) => validateEffectRule(
        errors,
        rule,
        `${path}.effects[${index}]`,
        options.sourceType,
        effectiveScope,
        options.context,
    ))
    validateStackRuleGroups(errors, rules, path)
    buffModifiers.forEach((modifier, index) => validateBuffModifier(
        errors,
        modifier,
        `${path}.buffModifiers[${index}]`,
        effectiveScope,
    ))
}

function validatePreferredDriveDiscs(errors, preferredDriveDiscs, context = {}) {
    if (!preferredDriveDiscs) {
        return
    }
    if (typeof preferredDriveDiscs !== "object" || Array.isArray(preferredDriveDiscs)) {
        add(errors, "preferredDriveDiscs", "必须是对象。")
        return
    }

    if (preferredDriveDiscs.defaultSetId !== undefined) {
        validateOptionalId(errors, { id: preferredDriveDiscs.defaultSetId }, "preferredDriveDiscs.defaultSetId")
        const driveDiscSets = Array.isArray(context.driveDiscSets) ? context.driveDiscSets : []
        if (String(preferredDriveDiscs.defaultSetId ?? "").trim()
            && driveDiscSets.length
            && !driveDiscSets.some(set => set?.id === preferredDriveDiscs.defaultSetId)) {
            add(errors, "preferredDriveDiscs.defaultSetId", "驱动盘套装不存在。")
        }
    }

    const mainStatLimits = preferredDriveDiscs.mainStatLimits ?? preferredDriveDiscs
    if (typeof mainStatLimits !== "object" || Array.isArray(mainStatLimits)) {
        add(errors, "preferredDriveDiscs.mainStatLimits", "必须是对象。")
        return
    }

    for (const slot of ["4", "5", "6"]) {
        const raw = mainStatLimits[slot] ?? mainStatLimits[Number(slot)] ?? []
        const values = Array.isArray(raw) ? raw : raw ? [raw] : []
        for (const [index, stat] of values.entries()) {
            if (!STAT_VALUES.has(stat)) {
                add(errors, `preferredDriveDiscs.mainStatLimits.${slot}[${index}]`, "不是支持的属性。")
            }
        }
    }
}

function calculationAnomalyIds(context = {}, maintenanceType) {
    const settlementType = maintenanceType === "disorder" ? "disorder" : "attribute"
    const fromUnified = Array.isArray(context.effects)
        ? context.effects
            .filter(item => (item?.settlementType === "disorder" ? "disorder" : "attribute") === settlementType)
            .map(item => item?.id)
            .filter(Boolean)
        : []
    const explicit = settlementType === "disorder"
        ? context.disorderEffects
        : context.anomalyEffects
    const fromContext = Array.isArray(explicit)
        ? explicit.map(item => item?.id).filter(Boolean)
        : []
    const defaults = settlementType === "disorder"
        ? ["burn", "shock", "corruption", "frozen", "flinch"]
        : ["assault", "shatter", "burn", "shock", "corruption"]
    return new Set([...defaults, ...fromUnified, ...fromContext])
}

function skillCatalogForRef(context = {}, skillRef = {}) {
    const agentSkills = Array.isArray(context.agentSkills) ? context.agentSkills : []
    return agentSkills.find(skill => skill.id === skillRef.agentSkillId) ?? null
}

function validateCalculationSkillRef(errors, skillRef, path, context = {}, agentId = "") {
    if (!skillRef || typeof skillRef !== "object" || Array.isArray(skillRef)) {
        add(errors, path, "必须选择技能倍率。")
        return
    }
    for (const key of ["agentSkillId", "categoryId", "moveId", "rowId"]) {
        if (!String(skillRef[key] ?? "").trim()) {
            add(errors, `${path}.${key}`, "必填。")
        }
    }
    if (skillRef.level !== undefined && skillRef.level !== null && skillRef.level !== "") {
        add(errors, `${path}.level`, "默认计算配置不保存技能等级。")
    }

    const skill = skillCatalogForRef(context, skillRef)
    if (!skill) {
        add(errors, `${path}.agentSkillId`, "技能倍率目录不存在。")
        return
    }
    if (agentId && skill.agentId !== agentId) {
        add(errors, `${path}.agentSkillId`, "技能倍率目录不属于当前角色。")
    }
    const category = (skill.categories ?? []).find(item => item.id === skillRef.categoryId)
    if (!category) {
        add(errors, `${path}.categoryId`, "技能大类不存在。")
        return
    }
    const move = (category.moves ?? []).find(item => item.id === skillRef.moveId)
    if (!move) {
        add(errors, `${path}.moveId`, "技能招式不存在。")
        return
    }
    const row = (move.rows ?? []).find(item => item.id === skillRef.rowId)
    if (!row) {
        add(errors, `${path}.rowId`, "技能倍率行不存在。")
        return
    }
    if ((row.kind ?? "damageMultiplier") !== "damageMultiplier") {
        add(errors, `${path}.rowId`, "只能选择伤害倍率行。")
    }
}

function validatePositiveNumber(errors, value, path, label = "数值") {
    const numericValue = requireFinite(errors, value, path)
    if (Number.isFinite(numericValue) && numericValue <= 0) {
        add(errors, path, `${label}必须大于 0。`)
    }
}

function validateNonNegativeNumber(errors, value, path, label = "数值") {
    const numericValue = requireFinite(errors, value, path)
    if (Number.isFinite(numericValue) && numericValue < 0) {
        add(errors, path, `${label}不能小于 0。`)
    }
}

function validateCalculationEvent(errors, event, path, context = {}, agentId = "", options = {}) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        add(errors, path, "必须是对象。")
        return
    }
    validateOptionalId(errors, event, `${path}.id`)
    requireEnum(errors, event.kind, options.allowSkillGroup ? CALCULATION_EVENT_KIND_VALUES : DAMAGE_EVENT_KIND_VALUES, `${path}.kind`)
    if (event.stunned !== undefined && typeof event.stunned !== "boolean") {
        add(errors, `${path}.stunned`, "是否失衡必须是布尔值。")
    }
    if (event.kind === "skillGroup") {
        if (!options.allowSkillGroup) {
            return
        }
        const skillGroupId = String(event.skillGroupId ?? event.groupId ?? "").trim()
        if (!skillGroupId) {
            add(errors, `${path}.skillGroupId`, "必须选择技能组。")
        }
        const group = options.skillGroupById?.get(skillGroupId)
        if (skillGroupId && !group) {
            add(errors, `${path}.skillGroupId`, "技能组不存在。")
        }
        const count = validateSkillGroupCount(errors, event.count ?? group?.defaultCount ?? 1, `${path}.count`)
        if (group) {
            const minCount = Number(group.minCount ?? 0)
            const maxCount = group.maxCount === undefined || group.maxCount === null || group.maxCount === ""
                ? null
                : Number(group.maxCount)
            if (Number.isFinite(count) && Number.isFinite(minCount) && count < minCount) {
                add(errors, `${path}.count`, "次数不能小于技能组最小次数。")
            }
            if (Number.isFinite(count) && Number.isFinite(maxCount) && count > maxCount) {
                add(errors, `${path}.count`, "次数不能大于技能组最大次数。")
            }
        }
        return
    }
    validatePositiveNumber(errors, event.count ?? 1, `${path}.count`, "次数")
    if (event.damageRatioPct !== undefined) {
        validateNonNegativeNumber(errors, event.damageRatioPct, `${path}.damageRatioPct`, "伤害比例")
    }

    if (event.kind === "direct" || event.kind === "sheer") {
        const hasSkillRef = event.skillRef && typeof event.skillRef === "object" && !Array.isArray(event.skillRef)
        const hasManualSkillMultiplier = event.skillMultiplier !== undefined
            && event.skillMultiplier !== null
            && String(event.skillMultiplier).trim() !== ""
        if (hasSkillRef) {
            validateCalculationSkillRef(errors, event.skillRef, `${path}.skillRef`, context, agentId)
        } else if (hasManualSkillMultiplier) {
            validatePositiveNumber(errors, event.skillMultiplier, `${path}.skillMultiplier`, "手填倍率")
            if (event.damageElement !== undefined && event.damageElement !== "") {
                requireEnum(errors, event.damageElement, DAMAGE_ELEMENT_VALUES, `${path}.damageElement`)
            }
        } else {
            add(errors, `${path}.skillRef`, "必须选择技能倍率或填写手填倍率。")
        }
        if (event.critMode !== undefined) {
            requireEnum(errors, event.critMode, new Set(["expected", "crit", "nonCrit"]), `${path}.critMode`)
        }
        if (event.damageBasis !== undefined) {
            requireEnum(errors, event.damageBasis, new Set(["atk", "anomalyProficiency"]), `${path}.damageBasis`)
        }
        return
    }
    const settlementType = event.kind === "disorder"
        ? "disorder"
        : (event.settlementType === "disorder" ? "disorder" : "attribute")
    if (event.settlementType !== undefined) {
        requireEnum(errors, event.settlementType, ANOMALY_SETTLEMENT_TYPE_VALUES, `${path}.settlementType`)
    }
    if (settlementType === "attribute") {
        if (!calculationAnomalyIds(context, "anomaly").has(event.anomalyEffect)) {
            add(errors, `${path}.anomalyEffect`, "属性异常不存在。")
        }
        validatePositiveNumber(errors, event.procCount ?? 1, `${path}.procCount`, "结算次数")
        if (event.anomalyVariant !== undefined) {
            requireEnum(errors, event.anomalyVariant, ANOMALY_VARIANT_VALUES, `${path}.anomalyVariant`)
            if (event.anomalyVariant === "polarizedAssault" && event.anomalyEffect !== "assault") {
                add(errors, `${path}.anomalyVariant`, "极性强击只能用于强击结算。")
            }
        }
        return
    }
    const disorderEffectId = event.anomalyEffect ?? event.previousAnomalyEffect
    if (!calculationAnomalyIds(context, "disorder").has(disorderEffectId)) {
        add(errors, event.anomalyEffect === undefined ? `${path}.previousAnomalyEffect` : `${path}.anomalyEffect`, "紊乱类型不存在。")
    }
    if (event.disorderType !== undefined) {
        requireEnum(errors, event.disorderType, DISORDER_TYPE_VALUES, `${path}.disorderType`)
    }
    validateNonNegativeNumber(errors, event.elapsedSeconds ?? 0, `${path}.elapsedSeconds`, "已生效秒数")
}

function validateCalculationEventList(errors, events, path, context = {}, agentId = "", options = {}) {
    if (!Array.isArray(events)) {
        add(errors, path, "必须是数组。")
        return new Set()
    }
    if (!events.length) {
        if (!options.allowEmpty) {
            add(errors, path, "至少需要一个事件。")
        }
        return new Set()
    }
    const ids = new Set()
    events.forEach((event, index) => {
        validateCalculationEvent(errors, event, `${path}[${index}]`, context, agentId, options)
        if (event?.id) {
            if (ids.has(event.id)) {
                add(errors, `${path}[${index}].id`, "事件 ID 不能重复。")
            }
            ids.add(event.id)
        }
    })
    return ids
}

function validateSkillGroupCount(errors, value, path, label = "次数") {
    const numericValue = requireFinite(errors, value, path)
    if (Number.isFinite(numericValue) && numericValue < 0) {
        add(errors, path, `${label}不能小于 0。`)
    }
    return numericValue
}

function validateCalculationSkillGroups(errors, groups, path, context = {}, agentId = "") {
    if (groups === undefined || groups === null) {
        return new Map()
    }
    if (!Array.isArray(groups)) {
        add(errors, path, "必须是数组。")
        return new Map()
    }
    const groupById = new Map()
    groups.forEach((group, index) => {
        const groupPath = `${path}[${index}]`
        if (!group || typeof group !== "object" || Array.isArray(group)) {
            add(errors, groupPath, "必须是对象。")
            return
        }
        requireId(errors, group, `${groupPath}.id`)
        const id = String(group.id ?? "").trim()
        if (id) {
            if (groupById.has(id)) {
                add(errors, `${groupPath}.id`, "技能组 ID 不能重复。")
            }
            groupById.set(id, group)
        }
        if (group.name !== undefined) {
            requireName(errors, group.name, `${groupPath}.name.zhCN`)
        }
        if (group.description !== undefined && hasText(group.description)) {
            requireName(errors, group.description, `${groupPath}.description.zhCN`)
        }
        const minCount = validateSkillGroupCount(errors, group.minCount ?? 0, `${groupPath}.minCount`)
        const maxCount = group.maxCount === undefined || group.maxCount === null || group.maxCount === ""
            ? null
            : validateSkillGroupCount(errors, group.maxCount, `${groupPath}.maxCount`)
        const defaultCount = validateSkillGroupCount(errors, group.defaultCount ?? 0, `${groupPath}.defaultCount`)
        const step = requireFinite(errors, group.step ?? 1, `${groupPath}.step`)
        if (Number.isFinite(step) && step <= 0) {
            add(errors, `${groupPath}.step`, "步长必须大于 0。")
        }
        if (Number.isFinite(minCount) && Number.isFinite(maxCount) && maxCount < minCount) {
            add(errors, `${groupPath}.maxCount`, "最大次数不能小于最小次数。")
        }
        if (Number.isFinite(defaultCount) && Number.isFinite(minCount) && defaultCount < minCount) {
            add(errors, `${groupPath}.defaultCount`, "默认次数不能小于最小次数。")
        }
        if (Number.isFinite(defaultCount) && Number.isFinite(maxCount) && defaultCount > maxCount) {
            add(errors, `${groupPath}.defaultCount`, "默认次数不能大于最大次数。")
        }
        validateCalculationEventList(errors, group.events, `${groupPath}.events`, context, agentId)
    })
    return groupById
}

function mergedSkillGroupMap(primary = new Map(), legacy = new Map()) {
    const merged = new Map(primary)
    for (const [id, group] of legacy.entries()) {
        if (!merged.has(id)) {
            merged.set(id, group)
        }
    }
    return merged
}

function validateDefaultCalculationCinemaLevel(errors, value, path, seenLevels) {
    if (!isDefaultCalculationCinemaLevel(value)) {
        add(errors, path, "影画等级必须是 0 到 6 的整数。")
        return null
    }
    const level = Number(value)
    if (seenLevels.has(level)) {
        add(errors, path, "默认循环影画等级不能重复。")
    }
    seenLevels.add(level)
    return level
}

function validateDefaultCalculationConfigEntry(errors, config, path, context = {}, agentId = "", roleSkillGroupById = new Map(), options = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        add(errors, path, "必须是对象。")
        return { legacyGroupById: new Map(), eventIds: new Set() }
    }
    requireEnum(errors, config.mode ?? "custom", CALCULATION_MODE_VALUES, `${path}.mode`)
    if (config.name !== undefined) {
        requireName(errors, config.name, `${path}.name.zhCN`)
    }
    const legacyGroupById = options.allowLegacySkillGroups
        ? validateCalculationSkillGroups(errors, config.skillGroups, `${path}.skillGroups`, context, agentId)
        : new Map()
    const skillGroupById = mergedSkillGroupMap(roleSkillGroupById, legacyGroupById)
    const eventIds = validateCalculationEventList(errors, config.events, `${path}.events`, context, agentId, {
        allowEmpty: true,
        allowSkillGroup: true,
        skillGroupById,
    })
    if (config.selectedEventId && !eventIds.has(config.selectedEventId)) {
        add(errors, `${path}.selectedEventId`, "必须指向一个已配置事件。")
    }
    if (!eventIds.size && !legacyGroupById.size) {
        add(errors, `${path}.events`, "至少需要一个事件或技能组。")
    }
    return { legacyGroupById, eventIds }
}

function validateDefaultCalculationConfig(errors, config, context = {}, agentId = "", roleSkillGroupById = new Map()) {
    if (config === undefined || config === null) {
        return
    }
    if (typeof config !== "object" || Array.isArray(config)) {
        add(errors, "defaultCalculationConfig", "必须是对象。")
        return
    }
    const seenLevels = new Set()
    const baseCinemaLevel = validateDefaultCalculationCinemaLevel(errors, config.cinemaLevel ?? 0, "defaultCalculationConfig.cinemaLevel", seenLevels)
    if (baseCinemaLevel !== null && baseCinemaLevel !== 0) {
        add(errors, "defaultCalculationConfig.cinemaLevel", "基础默认循环必须是 0 影。")
    }
    const { legacyGroupById } = validateDefaultCalculationConfigEntry(
        errors,
        config,
        "defaultCalculationConfig",
        context,
        agentId,
        roleSkillGroupById,
        { allowLegacySkillGroups: true },
    )
    const skillGroupById = mergedSkillGroupMap(roleSkillGroupById, legacyGroupById)
    if (config.variants !== undefined) {
        if (!Array.isArray(config.variants)) {
            add(errors, "defaultCalculationConfig.variants", "必须是数组。")
        } else {
            config.variants.forEach((variant, index) => {
                const path = `defaultCalculationConfig.variants[${index}]`
                if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
                    add(errors, path, "必须是对象。")
                    return
                }
                validateDefaultCalculationCinemaLevel(errors, variant.cinemaLevel, `${path}.cinemaLevel`, seenLevels)
                validateDefaultCalculationConfigEntry(errors, variant, path, context, agentId, skillGroupById)
            })
        }
    }
}

function validateSkillLevelRange(errors, range, path, fallback = null, levelScale = "skill") {
    const source = range ?? fallback
    if (!source) {
        add(errors, path, "等级范围必填。")
        return null
    }
    if (typeof source !== "object" || Array.isArray(source)) {
        add(errors, path, "必须是对象。")
        return null
    }

    if (levelScale === "coreSkill") {
        const levels = Array.isArray(source.levels)
            ? source.levels.map(level => String(level ?? "").trim())
            : []
        if (!levels.length) {
            add(errors, `${path}.levels`, "核心技等级至少需要一项。")
            return null
        }
        const seenLevels = new Set()
        levels.forEach((level, index) => {
            if (!CORE_SKILL_LEVEL_VALUES.has(level)) {
                add(errors, `${path}.levels[${index}]`, "核心技等级必须是 0 或 A-F。")
            } else if (seenLevels.has(level)) {
                add(errors, `${path}.levels[${index}]`, "核心技等级不能重复。")
            }
            seenLevels.add(level)
        })
        const defaultLevel = String(source.default ?? "").trim()
        if (!defaultLevel) {
            add(errors, `${path}.default`, "默认核心技等级必填。")
        } else if (!levels.includes(defaultLevel)) {
            add(errors, `${path}.default`, "默认核心技等级必须在等级列表内。")
        }
        return {
            levels,
            default: defaultLevel || levels.at(-1),
        }
    }

    const min = requireFinite(errors, source.min, `${path}.min`)
    const max = requireFinite(errors, source.max, `${path}.max`)
    const defaultLevel = requireFinite(errors, source.default, `${path}.default`)
    if (![min, max, defaultLevel].every(Number.isFinite)) {
        return null
    }
    if (![min, max, defaultLevel].every(Number.isInteger)) {
        add(errors, path, "等级范围必须使用整数。")
    }
    if (min < 1) {
        add(errors, `${path}.min`, "最低等级必须大于等于 1。")
    }
    if (max < min) {
        add(errors, `${path}.max`, "最高等级不能小于最低等级。")
    }
    if (defaultLevel < min || defaultLevel > max) {
        add(errors, `${path}.default`, "默认等级必须在范围内。")
    }

    return {
        min,
        max,
        default: defaultLevel,
    }
}

function validateSkillValues(errors, row, levelRange, path) {
    if (!Array.isArray(row?.values)) {
        add(errors, `${path}.values`, "必须是数组。")
        return
    }

    const expectedLength = Array.isArray(levelRange?.levels)
        ? levelRange.levels.length
        : levelRange
            ? levelRange.max - levelRange.min + 1
            : NaN
    if (Number.isFinite(expectedLength) && row.values.length !== expectedLength) {
        add(errors, `${path}.values`, `数量必须等于等级范围长度 ${expectedLength}。`)
    }

    row.values.forEach((value, index) => {
        const numericValue = requireFinite(errors, value, `${path}.values[${index}]`)
        if (Number.isFinite(numericValue) && numericValue <= 0 && (row.kind ?? "damageMultiplier") === "damageMultiplier") {
            add(errors, `${path}.values[${index}]`, "伤害倍率必须大于 0。")
        }
    })
}

function validateAgentSkill(item, context) {
    const errors = []
    requireId(errors, item)
    requireId(errors, { id: item?.agentId }, "agentId")
    if (item?.name) {
        requireName(errors, item.name, "name.zhCN")
    }

    if (!Array.isArray(item?.categories)) {
        add(errors, "categories", "必须是数组。")
    } else if (!item.categories.length) {
        add(errors, "categories", "至少需要一个技能大类。")
    } else {
        const seenCategories = new Set()
        const skillTypeCategoryOwners = new Map()
        item.categories.forEach((category, categoryIndex) => {
            const categoryPath = `categories[${categoryIndex}]`
            requireId(errors, category, `${categoryPath}.id`)
            if (category?.id) {
                if (seenCategories.has(category.id)) {
                    add(errors, `${categoryPath}.id`, "同一角色技能中不能重复。")
                }
                seenCategories.add(category.id)
            }
            requireName(errors, category?.name, `${categoryPath}.name.zhCN`)
            const levelScale = category?.levelScale ?? "skill"
            requireEnum(errors, levelScale, SKILL_LEVEL_SCALE_VALUES, `${categoryPath}.levelScale`)
            const categoryRange = validateSkillLevelRange(errors, category?.levelRange, `${categoryPath}.levelRange`, null, levelScale)

            if (!Array.isArray(category?.moves)) {
                add(errors, `${categoryPath}.moves`, "必须是数组。")
                return
            }
            if (!category.moves.length) {
                add(errors, `${categoryPath}.moves`, "至少需要一个有倍率的招式。")
            }

            const seenMoves = new Set()
            category.moves.forEach((move, moveIndex) => {
                const movePath = `${categoryPath}.moves[${moveIndex}]`
                requireId(errors, move, `${movePath}.id`)
                if (move?.id) {
                    if (seenMoves.has(move.id)) {
                        add(errors, `${movePath}.id`, "同一技能大类中不能重复。")
                    }
                    seenMoves.add(move.id)
                }
                requireName(errors, move?.name, `${movePath}.name.zhCN`)
                requireEnum(errors, move?.skillType, SKILL_TYPE_VALUES, `${movePath}.skillType`)
                if (move?.skillTags !== undefined) {
                    if (!Array.isArray(move.skillTags)) {
                        add(errors, `${movePath}.skillTags`, "必须是数组。")
                    } else {
                        const seenTags = new Set()
                        move.skillTags.forEach((tag, tagIndex) => {
                            requireEnum(errors, tag, SKILL_TAG_VALUES, `${movePath}.skillTags[${tagIndex}]`)
                            if (seenTags.has(tag)) {
                                add(errors, `${movePath}.skillTags[${tagIndex}]`, "同一招式不能重复标签。")
                            }
                            seenTags.add(tag)
                        })
                    }
                }
                if (SKILL_TYPE_VALUES.has(move?.skillType)) {
                    const owner = skillTypeCategoryOwners.get(move.skillType)
                    if (owner && owner.category !== category) {
                        add(errors, `${movePath}.skillType`, `同一角色的${SKILL_TYPE_LABELS[move.skillType] ?? move.skillType}不能拆到多个技能目录。`)
                    } else if (!owner) {
                        skillTypeCategoryOwners.set(move.skillType, { category, categoryPath })
                    }
                }
                if (move?.damageElement) {
                    requireEnum(errors, move.damageElement, DAMAGE_ELEMENT_VALUES, `${movePath}.damageElement`)
                }
                const moveRange = move?.levelRange
                    ? validateSkillLevelRange(errors, move.levelRange, `${movePath}.levelRange`, categoryRange, levelScale)
                    : categoryRange

                if (!Array.isArray(move?.rows)) {
                    add(errors, `${movePath}.rows`, "必须是数组。")
                    return
                }
                if (!move.rows.length) {
                    add(errors, `${movePath}.rows`, "至少需要一条倍率。")
                }

                const seenRows = new Set()
                move.rows.forEach((row, rowIndex) => {
                    const rowPath = `${movePath}.rows[${rowIndex}]`
                    requireId(errors, row, `${rowPath}.id`)
                    if (row?.id) {
                        if (seenRows.has(row.id)) {
                            add(errors, `${rowPath}.id`, "同一招式中不能重复。")
                        }
                        seenRows.add(row.id)
                    }
                    requireName(errors, row?.label, `${rowPath}.label.zhCN`)
                    requireEnum(errors, row?.kind ?? "damageMultiplier", SKILL_ROW_KIND_VALUES, `${rowPath}.kind`)
                    if (row?.damageBasis !== undefined && row.damageBasis !== "") {
                        requireEnum(errors, row.damageBasis, SKILL_ROW_DAMAGE_BASIS_VALUES, `${rowPath}.damageBasis`)
                    }
                    const rowRange = row?.levelRange
                        ? validateSkillLevelRange(errors, row.levelRange, `${rowPath}.levelRange`, moveRange, levelScale)
                        : moveRange
                    validateSkillValues(errors, { ...row, kind: row?.kind ?? "damageMultiplier" }, rowRange, rowPath)
                })
            })
        })
    }

    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateCinemaBuffs(errors, cinemaBuffs, context = {}) {
    if (cinemaBuffs === undefined || cinemaBuffs === null) {
        return
    }
    if (!Array.isArray(cinemaBuffs)) {
        add(errors, "combatBuffs.cinemaBuffs", "必须是数组。")
        return
    }

    const seenLevels = new Set()
    cinemaBuffs.forEach((buff, index) => {
        const path = `combatBuffs.cinemaBuffs[${index}]`
        const level = Number(buff?.cinemaLevel)
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            add(errors, `${path}.cinemaLevel`, "影画序号必须是 1 到 6 的整数。")
        } else if (seenLevels.has(level)) {
            add(errors, `${path}.cinemaLevel`, "同一角色不能重复录入同一影画。")
        } else {
            seenLevels.add(level)
        }

        requireName(errors, buff?.cinemaName, `${path}.cinemaName.zhCN`)
        if (!hasText(buff?.description)) {
            add(errors, `${path}.description`, "Buff 描述必填。")
        }
        validateEffectSet(errors, buff, path, { requireRule: false, sourceType: "self", context })
    })
}

function validateAgent(item, context) {
    const errors = []
    requireId(errors, item)
    requireName(errors, item?.name, "name.zhCN")
    requireEnum(errors, item?.rarity, RARITY_VALUES, "rarity")
    requireEnum(errors, item?.attribute, ATTRIBUTE_VALUES, "attribute")
    requireEnum(errors, item?.specialty, SPECIALTY_VALUES, "specialty")
    if (item?.damageElement) {
        requireEnum(errors, item.damageElement, DAMAGE_ELEMENT_VALUES, "damageElement")
    } else if (item?.attribute && !DAMAGE_ELEMENT_VALUES.has(item.attribute)) {
        add(errors, "damageElement", "特殊显示属性必须填写真实伤害结算属性。")
    }
    validateOptionalSources(errors, item, item?.images?.portrait ?? item?.images?.icon)

    for (const stat of AGENT_LEVEL_STATS) {
        const value = requireFinite(errors, item?.level60?.[stat], `level60.${stat}`)
        if (!Number.isFinite(value)) {
            continue
        }
        const mustBePositive = ["hpBase", "atkBase", "defBase", "energyRegen"].includes(stat)
        if (mustBePositive ? value <= 0 : value < 0) {
            add(errors, `level60.${stat}`, mustBePositive ? "必须大于 0。" : "不能小于 0。")
        }
    }

    validateEffectSet(errors, item?.combatBuffs?.corePassive, "combatBuffs.corePassive", { sourceType: "self", context })
    validateEffectSet(errors, item?.combatBuffs?.additionalAbility, "combatBuffs.additionalAbility", { sourceType: "self", context })
    validateCinemaBuffs(errors, item?.combatBuffs?.cinemaBuffs, context)
    validatePreferredDriveDiscs(errors, item?.preferredDriveDiscs, context)
    const roleSkillGroupById = validateCalculationSkillGroups(errors, item?.skillGroups, "skillGroups", context, item?.id)
    validateDefaultCalculationConfig(errors, item?.defaultCalculationConfig, context, item?.id, roleSkillGroupById)

    if (item?.coreSkill) {
        if (typeof item.coreSkill !== "object" || Array.isArray(item.coreSkill)) {
            add(errors, "coreSkill", "必须是 JSON 对象。")
        } else if (item.coreSkill.levels !== undefined && !Array.isArray(item.coreSkill.levels)) {
            add(errors, "coreSkill.levels", "必须是数组。")
        }
    }

    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateWEngine(item, context) {
    const errors = []
    requireId(errors, item)
    requireName(errors, item?.name, "name.zhCN")
    requireEnum(errors, item?.rarity, RARITY_VALUES, "rarity")
    requireEnum(errors, item?.specialty, SPECIALTY_VALUES, "specialty")
    if (item?.attribute) {
        requireEnum(errors, item.attribute, ATTRIBUTE_VALUES, "attribute")
    }
    if (item?.effect?.requirement?.specialty) {
        requireEnum(errors, item.effect.requirement.specialty, SPECIALTY_VALUES, "effect.requirement.specialty")
        if (item?.specialty && item.effect.requirement.specialty !== item.specialty) {
            add(errors, "effect.requirement.specialty", "必须与音擎适配特性一致；跨职业佩戴只提供基础攻击力和高级属性，不触发音擎被动。")
        }
    }
    validateOptionalSources(errors, item, item?.images?.icon ?? item?.images?.portrait)

    const atkBase = requireFinite(errors, item?.level60?.atkBase, "level60.atkBase")
    if (Number.isFinite(atkBase) && atkBase <= 0) {
        add(errors, "level60.atkBase", "必须大于 0。")
    }

    if (!item?.level60?.advancedStat) {
        add(errors, "level60.advancedStat", "高级属性必填。")
    } else {
        validateEffectRule(errors, { type: "fixed", ...item.level60.advancedStat }, "level60.advancedStat")
    }

    requireName(errors, item?.effect?.name, "effect.name.zhCN")
    requireName(errors, item?.effect?.description, "effect.description.zhCN")
    const selfBuff = item?.effect?.selfBuff ?? item?.effect?.buff
    const teamBuff = item?.effect?.teamBuff
    validateEffectSet(errors, selfBuff, "effect.selfBuff", { sourceType: "wEngine", context })
    validateEffectSet(errors, teamBuff, "effect.teamBuff", { sourceType: "wEngineTeam", context })
    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function hasEffectText(effect) {
    return hasText(effect?.effectText) || hasText(effect?.effectText?.zhCN)
}

function validateDriveDiscSet(item, context) {
    const errors = []
    requireId(errors, item)
    requireName(errors, item?.name, "name.zhCN")
    validateOptionalSources(errors, item, item?.images?.icon)

    if (item?.twoPiece) {
        validateEffectSet(errors, item.twoPiece, "twoPiece", { requireRule: true, sourceType: "driveDisc2pc", context })
    }

    if (item?.fourPiece) {
        const selfBuff = item.fourPiece.selfBuff ?? (
            hasRulesOrModifiers(item.fourPiece) ? item.fourPiece : null
        )
        const teamBuff = item.fourPiece.teamBuff
        const rules = [
            ...rulesOf(selfBuff),
            ...rulesOf(teamBuff),
        ]
        const buffModifierCount = buffModifiersOf(selfBuff).length + buffModifiersOf(teamBuff).length
        if (!rules.length && !buffModifierCount && !hasEffectText(item.fourPiece)) {
            add(errors, "fourPiece", "需要中文效果文案或至少一条有效规则。")
        }
        validateEffectSet(errors, selfBuff, "fourPiece.selfBuff", { sourceType: "driveDisc4pc", context })
        validateEffectSet(errors, teamBuff, "fourPiece.teamBuff", { sourceType: "driveDisc4pcTeam", context })
    }

    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateBuffPayload(item, context) {
    if (item?.teammate || item?.buff) {
        return validateTeammateBuff(item, context)
    }

    return validateGenericBuff(item, context)
}

function validateAnomalyMaintenanceItem(item, context) {
    const errors = []
    const maintenanceType = item?.settlementType === "disorder" || item?.maintenanceType === "disorder"
        ? "disorder"
        : "anomaly"
    requireEnum(errors, maintenanceType, ANOMALY_MAINTENANCE_TYPE_VALUES, "maintenanceType")
    if (item?.settlementType !== undefined) {
        requireEnum(errors, item.settlementType, ANOMALY_SETTLEMENT_TYPE_VALUES, "settlementType")
    }
    requireId(errors, item)
    requireName(errors, item?.label, "label.zhCN")
    requireEnum(errors, item?.element, DAMAGE_ELEMENT_VALUES, "element")

    if (maintenanceType === "disorder") {
        for (const stat of ["fixedMultiplier", "tickMultiplier", "tickIntervalSeconds", "defaultDurationSeconds"]) {
            const value = requireFinite(errors, item?.[stat], stat)
            if (Number.isFinite(value)) {
                if (stat === "tickIntervalSeconds" && value <= 0) {
                    add(errors, stat, "跳间隔必须大于 0。")
                } else if (stat !== "tickIntervalSeconds" && value < 0) {
                    add(errors, stat, "不能小于 0。")
                }
            }
        }
    } else {
        const baseMultiplier = requireFinite(errors, item?.baseMultiplier, "baseMultiplier")
        if (Number.isFinite(baseMultiplier) && baseMultiplier < 0) {
            add(errors, "baseMultiplier", "不能小于 0。")
        }
        const defaultProcCount = requireFinite(errors, item?.defaultProcCount, "defaultProcCount")
        if (Number.isFinite(defaultProcCount) && (!Number.isInteger(defaultProcCount) || defaultProcCount < 0)) {
            add(errors, "defaultProcCount", "默认结算次数必须是非负整数。")
        }
    }

    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateGenericBuff(item, context) {
    const errors = []
    validateOptionalId(errors, item)
    requireEnum(errors, item?.sourceType, SOURCE_TYPE_VALUES, "sourceType")
    requireEnum(errors, item?.scope, EFFECT_SCOPE_VALUES, "scope")
    requireName(errors, item?.name, "name.zhCN")
    validateCoverage(errors, item?.coverage, "coverage")
    validateEffectSet(errors, item, "effects", { requireRule: true, sourceType: item?.sourceType ?? "manual", context })
    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateTeammateBuff(item, context) {
    const errors = []
    requireId(errors, item?.teammate, "teammate.id")
    requireName(errors, item?.teammate?.name, "teammate.name.zhCN")
    requireEnum(errors, item?.teammate?.attribute, ATTRIBUTE_VALUES, "teammate.attribute")
    requireEnum(errors, item?.teammate?.specialty, SPECIALTY_VALUES, "teammate.specialty")
    validateOptionalSources(errors, item?.teammate, item?.teammate?.images?.icon ?? item?.teammate?.images?.portrait)
    validateOptionalId(errors, item?.buff, "buff.id")
    requireName(errors, item?.buff?.source, "buff.source.zhCN")
    requireEnum(errors, item?.buff?.scope, EFFECT_SCOPE_VALUES, "buff.scope")
    validateCoverage(errors, item?.buff?.coverage, "buff.coverage")
    validateEffectSet(errors, item?.buff, "buff", { requireRule: true, sourceType: "teammate", context })

    const teammate = (context?.teammates ?? []).find(entry => entry.id === item?.teammate?.id)
    validateDuplicateId(errors, item?.buff?.id, {
        items: teammate?.buffs,
        currentId: context?.currentBuffId,
    }, "buff.id")
    return errors
}

function validateFieldBuff(item, context) {
    const errors = []
    validateOptionalId(errors, item)
    if (item?.sourceType !== undefined) {
        requireEnum(errors, item.sourceType, new Set(["field"]), "sourceType")
    }
    requireEnum(errors, item?.scope, new Set(["inCombat"]), "scope")
    requireName(errors, item?.name, "name.zhCN")
    requireName(errors, item?.source, "source.zhCN")
    validateFieldPeriod(errors, item?.period)
    requireName(errors, item?.description, "description.zhCN")
    validateCoverage(errors, item?.coverage, "coverage")
    validateEffectSet(errors, item, "effects", { requireRule: true, sourceType: "field", context })
    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateFieldPeriod(errors, period = {}) {
    if (!period || typeof period !== "object" || Array.isArray(period)) {
        add(errors, "period", "必须填写版本和期数信息。")
        return
    }

    const modeId = String(period.modeId ?? "").trim()
    if (!modeId) {
        add(errors, "period.modeId", "必填。")
    } else if (!FIELD_BUFF_MODE_IDS.has(modeId)) {
        add(errors, "period.modeId", "只能选择防卫战或危局。")
    }

    const version = String(period.gameVersion ?? "").trim()
    if (!version) {
        add(errors, "period.gameVersion", "必填。")
    } else if (!FIELD_BUFF_GAME_VERSION_VALUES.has(version)) {
        add(errors, "period.gameVersion", "只能选择 3.0、3.1、3.2 或 3.3。")
    }

    const phaseNo = requireFinite(errors, period.phaseNo, "period.phaseNo")
    if (Number.isFinite(phaseNo) && (!Number.isInteger(phaseNo) || !FIELD_BUFF_PHASE_VALUES.has(phaseNo))) {
        add(errors, "period.phaseNo", "只能选择第 1 到第 4 期。")
    }

    requireName(errors, period.phaseName, "period.phaseName.zhCN")
}

function validateBossBuff(item, context) {
    if (item?.boss && item?.encounter) {
        return validateBossEncounterPayload(item, context)
    }
    const errors = []
    validateOptionalId(errors, item)
    if (item?.sourceType !== undefined) {
        requireEnum(errors, item.sourceType, new Set(["boss"]), "sourceType")
    }
    requireEnum(errors, item?.scope, new Set(["inCombat"]), "scope")
    requireName(errors, item?.bossName, "bossName.zhCN")
    requireName(errors, item?.bossSource, "bossSource.zhCN")
    requireName(errors, item?.sourcePeriod, "sourcePeriod.zhCN")
    requireName(errors, item?.description, "description.zhCN")
    validateCoverage(errors, item?.coverage, "coverage")
    validateEffectSet(errors, item, "effects", { requireRule: true, sourceType: "boss", context })
    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateBossEffectEntries(errors, entries, path, context) {
    if (!Array.isArray(entries)) {
        add(errors, path, "必须是数组。")
        return
    }
    entries.forEach((entry, index) => {
        const entryPath = `${path}[${index}]`
        requireId(errors, entry, `${entryPath}.id`)
        requireName(errors, entry?.name, `${entryPath}.name.zhCN`)
        requireName(errors, entry?.description, `${entryPath}.description.zhCN`)
        requireEnum(errors, entry?.calculationStatus, new Set(["modeled", "descriptiveOnly"]), `${entryPath}.calculationStatus`)
        const effects = Array.isArray(entry?.effects) ? entry.effects : []
        if (entry?.calculationStatus === "modeled") {
            validateEffectSet(errors, { scope: "inCombat", effects, buffModifiers: [] }, entryPath, { requireRule: true, sourceType: "boss", context })
        } else {
            if (effects.length > 0) {
                add(errors, `${entryPath}.effects`, "仅说明条目不能携带计算规则。")
            }
            requireName(errors, entry?.unmodeledReason, `${entryPath}.unmodeledReason.zhCN`)
        }
    })
}

function bossAppearanceKey(appearance = {}) {
    return [appearance.modeId, appearance.gameVersion, appearance.phaseNo].join(":")
}

function validateBossEncounterPayload(item, context) {
    const errors = []
    const boss = item?.boss ?? {}
    const encounter = item?.encounter ?? {}
    requireId(errors, boss, "boss.id")
    requireName(errors, boss?.name, "boss.name.zhCN")
    if (!Array.isArray(boss?.aliases)) {
        add(errors, "boss.aliases", "必须是数组。")
    }
    if (!String(boss?.images?.icon ?? "").trim()) {
        add(errors, "boss.images.icon", "Boss 图片必填。")
    }
    if (!String(boss?.images?.source ?? "").trim()) {
        add(errors, "boss.images.source", "图片来源必填。")
    }
    validateOptionalSources(errors, boss, boss?.images?.icon)

    const defense = requireFinite(errors, boss?.target?.defense, "boss.target.defense")
    if (Number.isFinite(defense) && (!Number.isInteger(defense) || defense < 0)) {
        add(errors, "boss.target.defense", "必须是大于等于 0 的整数。")
    }
    const weaknessElements = Array.isArray(boss?.target?.weaknessElements) ? boss.target.weaknessElements : []
    const resistanceElements = Array.isArray(boss?.target?.resistanceElements) ? boss.target.resistanceElements : []
    weaknessElements.forEach((element, index) => requireEnum(errors, element, DAMAGE_ELEMENT_VALUES, `boss.target.weaknessElements[${index}]`))
    resistanceElements.forEach((element, index) => requireEnum(errors, element, DAMAGE_ELEMENT_VALUES, `boss.target.resistanceElements[${index}]`))
    const overlap = weaknessElements.filter(element => resistanceElements.includes(element))
    if (overlap.length > 0) {
        add(errors, "boss.target.resistanceElements", `弱点与抗性不能重叠：${overlap.join("、")}。`)
    }
    for (const [element, value] of Object.entries(boss?.target?.resistanceOverrides ?? {})) {
        requireEnum(errors, element, DAMAGE_ELEMENT_VALUES, `boss.target.resistanceOverrides.${element}`)
        requireFinite(errors, value, `boss.target.resistanceOverrides.${element}`)
    }

    requireId(errors, encounter, "encounter.id")
    requireName(errors, encounter?.enemyIntel, "encounter.enemyIntel.zhCN")
    if (!Array.isArray(encounter?.appearances) || encounter.appearances.length === 0) {
        add(errors, "encounter.appearances", "至少需要一个来源期数。")
    }
    const localAppearanceKeys = new Set()
    for (const [index, appearance] of (encounter?.appearances ?? []).entries()) {
        const path = `encounter.appearances[${index}]`
        if (!String(appearance?.modeId ?? "").trim()) add(errors, `${path}.modeId`, "必填。")
        if (!String(appearance?.gameVersion ?? "").trim()) add(errors, `${path}.gameVersion`, "必填。")
        const phaseNo = requireFinite(errors, appearance?.phaseNo, `${path}.phaseNo`)
        if (Number.isFinite(phaseNo) && (!Number.isInteger(phaseNo) || phaseNo < 1)) add(errors, `${path}.phaseNo`, "必须是大于 0 的整数。")
        const key = bossAppearanceKey(appearance)
        if (localAppearanceKeys.has(key)) add(errors, path, "同一规则版本内期数不能重复。")
        localAppearanceKeys.add(key)
    }

    const existingBoss = (context?.bosses ?? []).find(candidate => candidate?.id === boss.id)
    for (const sibling of existingBoss?.encounters ?? []) {
        if (sibling?.id === (context?.currentEncounterId ?? encounter.id)) continue
        const siblingKeys = new Set((sibling.appearances ?? []).map(bossAppearanceKey))
        for (const [index, appearance] of (encounter.appearances ?? []).entries()) {
            if (siblingKeys.has(bossAppearanceKey(appearance))) {
                add(errors, `encounter.appearances[${index}]`, "该 Boss 的同一期数已绑定其他规则版本。")
            }
        }
    }

    validateBossEffectEntries(errors, encounter?.playerBuffs, "encounter.playerBuffs", context)
    validateBossEffectEntries(errors, encounter?.playerDebuffs, "encounter.playerDebuffs", context)
    if (!Array.isArray(encounter?.sources) || encounter.sources.length === 0) {
        add(errors, "encounter.sources", "至少需要一个资料来源。")
    } else {
        encounter.sources.forEach((source, index) => {
            requireName(errors, source?.label, `encounter.sources[${index}].label.zhCN`)
            if (!isValidHttpUrl(String(source?.url ?? ""))) add(errors, `encounter.sources[${index}].url`, "必须是 http(s) URL。")
        })
    }
    validateDuplicateId(errors, boss?.id, { items: context?.bosses, currentId: context?.currentBossId ?? boss?.id }, "boss.id")
    return errors
}

function validateDuplicateId(errors, id, context = {}, path) {
    const items = context?.items ?? []
    if (!id || !Array.isArray(items)) {
        return
    }

    const count = items.filter(item => item?.id === id).length
    const allowed = context?.currentId === id ? 1 : 0
    if (count > allowed) {
        add(errors, path, "同分类内存在重复 ID。")
    }
}

function normalizeKind(kind) {
    switch (kind) {
        case "w-engines":
            return "wEngines"
        case "drive-disc-sets":
            return "driveDiscSets"
        case "agent-skills":
            return "agentSkills"
        case "combat-buffs":
        case "teammate-buffs":
        case "teammateBuffs":
            return "buffs"
        case "field-buffs":
            return "fieldBuffs"
        case "boss-buffs":
            return "bossBuffs"
        case "anomaly-effects":
            return "anomalyEffects"
        default:
            return kind
    }
}

export function validateMaintenanceItem(kind, item, context = {}) {
    const normalized = normalizeKind(kind)
    let errors
    if (normalized === "agents") {
        errors = validateAgent(item, context)
    } else if (normalized === "wEngines") {
        errors = validateWEngine(item, context)
    } else if (normalized === "driveDiscSets") {
        errors = validateDriveDiscSet(item, context)
    } else if (normalized === "agentSkills") {
        errors = validateAgentSkill(item, context)
    } else if (normalized === "buffs") {
        errors = validateBuffPayload(item, context)
    } else if (normalized === "fieldBuffs") {
        errors = validateFieldBuff(item, context)
    } else if (normalized === "bossBuffs") {
        errors = validateBossBuff(item, context)
    } else if (normalized === "anomalyEffects") {
        errors = validateAnomalyMaintenanceItem(item, context)
    } else {
        errors = [`kind: unsupported maintenance kind ${kind}`]
    }

    return {
        ok: errors.length === 0,
        errors,
    }
}

export function assertValidMaintenanceItem(kind, item, context = {}) {
    const result = validateMaintenanceItem(kind, item, context)
    if (!result.ok) {
        throw new Error(result.errors.join("\n"))
    }
    return item
}
