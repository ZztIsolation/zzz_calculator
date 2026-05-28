import { evaluateFormulaExpression, validateFormulaExpression } from "./formulaEvaluator.js"

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/
const PLACEHOLDER_NAMES = new Set(["未命名"])

const ATTRIBUTE_VALUES = new Set(["physical", "fire", "ice", "electric", "ether", "honed_edge"])
const DAMAGE_ELEMENT_VALUES = new Set(["physical", "fire", "ice", "electric", "ether"])
const SPECIALTY_VALUES = new Set(["attack", "stun", "anomaly", "support", "defense", "rupture"])
const RARITY_VALUES = new Set(["B", "A", "S"])
const SOURCE_TYPE_VALUES = new Set(["teammate", "self", "boss", "field", "manual"])
const EFFECT_SCOPE_VALUES = new Set(["outOfCombat", "inCombat"])
const EFFECT_TYPE_VALUES = new Set(["fixed", "derived", "formula", "stacked"])
const FORMULA_VALUE_UNIT_VALUES = new Set(["storedValue", "storedPercent"])
const SKILL_ROW_KIND_VALUES = new Set(["damageMultiplier", "dazeMultiplier", "energyCost", "statBonus"])
const STAT_VALUES = new Set([
    "atkFlat",
    "atkPct",
    "hpFlat",
    "hpPct",
    "defFlat",
    "defPct",
    "critRate",
    "critDmg",
    "impact",
    "impactPct",
    "impactFlat",
    "anomalyProficiency",
    "anomalyMastery",
    "anomalyMasteryFlat",
    "energyRegen",
    "energyRegenPct",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "enemyDefReduction",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
])
const TARGET_STAT_VALUES = new Set([
    "enemyDefReduction",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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
        add(errors, path, "只能使用小写字母、数字、下划线或连字符，且必须以小写字母或数字开头。")
    }
}

function validateOptionalId(errors, item, path = "id") {
    const id = String(item?.id ?? "").trim()
    if (id && !ID_PATTERN.test(id)) {
        add(errors, path, "只能使用小写字母、数字、下划线或连字符，且必须以小写字母或数字开头。")
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

function validateEffectRule(errors, rule = {}, path, sourceType = "manual", scope = "outOfCombat") {
    const type = rule.type ?? "fixed"
    requireEnum(errors, type, EFFECT_TYPE_VALUES, `${path}.type`)
    requireEnum(errors, rule.stat, STAT_VALUES, `${path}.stat`)

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
        return
    }

    const value = requireFinite(errors, rule.value, `${path}.value`)
    if (Number.isFinite(value) && value === 0) {
        add(errors, `${path}.value`, "数值不能为 0。")
    }
}

function validateEffectSet(errors, effect, path, options = {}) {
    if (!effect) {
        return
    }

    requireEnum(errors, effect.scope ?? "outOfCombat", EFFECT_SCOPE_VALUES, `${path}.scope`)
    validateCoverage(errors, effect.coverage, `${path}.coverage`)

    if (effect.durationSeconds !== undefined && effect.durationSeconds !== null && effect.durationSeconds !== "") {
        const duration = requireFinite(errors, effect.durationSeconds, `${path}.durationSeconds`)
        if (Number.isFinite(duration) && duration <= 0) {
            add(errors, `${path}.durationSeconds`, "持续时间必须大于 0。")
        }
    }

    const rules = rulesOf(effect)
    if (options.requireRule && !rules.length) {
        add(errors, `${path}.effects`, "至少需要一条有效规则。")
    }

    rules.forEach((rule, index) => validateEffectRule(
        errors,
        rule,
        `${path}.effects[${index}]`,
        options.sourceType,
        effect.scope ?? "outOfCombat",
    ))
}

function validatePreferredDriveDiscs(errors, preferredDriveDiscs) {
    if (!preferredDriveDiscs) {
        return
    }
    if (typeof preferredDriveDiscs !== "object" || Array.isArray(preferredDriveDiscs)) {
        add(errors, "preferredDriveDiscs", "必须是对象。")
        return
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

function validateSkillLevelRange(errors, range, path, fallback = null) {
    const source = range ?? fallback
    if (!source) {
        add(errors, path, "等级范围必填。")
        return null
    }
    if (typeof source !== "object" || Array.isArray(source)) {
        add(errors, path, "必须是对象。")
        return null
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

    const expectedLength = levelRange ? levelRange.max - levelRange.min + 1 : NaN
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
            const icon = String(category?.icon ?? "").trim()
            if (icon && !icon.startsWith("/assets/") && !isValidHttpUrl(icon)) {
                add(errors, `${categoryPath}.icon`, "图标路径必须是 /assets/... 或 http(s) URL。")
            }
            const categoryRange = validateSkillLevelRange(errors, category?.levelRange, `${categoryPath}.levelRange`)

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
                if (move?.damageElement) {
                    requireEnum(errors, move.damageElement, DAMAGE_ELEMENT_VALUES, `${movePath}.damageElement`)
                }
                const moveRange = move?.levelRange
                    ? validateSkillLevelRange(errors, move.levelRange, `${movePath}.levelRange`, categoryRange)
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
                    const rowRange = row?.levelRange
                        ? validateSkillLevelRange(errors, row.levelRange, `${rowPath}.levelRange`, moveRange)
                        : moveRange
                    validateSkillValues(errors, { ...row, kind: row?.kind ?? "damageMultiplier" }, rowRange, rowPath)
                })
            })
        })
    }

    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateCinemaBuffs(errors, cinemaBuffs) {
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
        validateEffectSet(errors, buff, path, { requireRule: true, sourceType: "self" })
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

    validateEffectSet(errors, item?.combatBuffs?.corePassive, "combatBuffs.corePassive", { sourceType: "self" })
    validateEffectSet(errors, item?.combatBuffs?.additionalAbility, "combatBuffs.additionalAbility", { sourceType: "self" })
    validateCinemaBuffs(errors, item?.combatBuffs?.cinemaBuffs)
    validatePreferredDriveDiscs(errors, item?.preferredDriveDiscs)

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
    if (!rulesOf(selfBuff).length && !rulesOf(teamBuff).length) {
        add(errors, "effect", "至少需要一条音擎 Buff 规则。")
    }
    validateEffectSet(errors, selfBuff, "effect.selfBuff", { sourceType: "wEngine" })
    validateEffectSet(errors, teamBuff, "effect.teamBuff", { sourceType: "wEngineTeam" })
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
        validateEffectSet(errors, item.twoPiece, "twoPiece", { requireRule: true })
    }

    if (item?.fourPiece) {
        const selfBuff = item.fourPiece.selfBuff ?? (
            rulesOf(item.fourPiece).length ? item.fourPiece : null
        )
        const teamBuff = item.fourPiece.teamBuff
        const rules = [
            ...rulesOf(selfBuff),
            ...rulesOf(teamBuff),
        ]
        if (!rules.length && !hasEffectText(item.fourPiece)) {
            add(errors, "fourPiece", "需要中文效果文案或至少一条有效规则。")
        }
        validateEffectSet(errors, selfBuff, "fourPiece.selfBuff", { sourceType: "driveDisc4pc" })
        validateEffectSet(errors, teamBuff, "fourPiece.teamBuff", { sourceType: "driveDisc4pcTeam" })
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

function validateGenericBuff(item, context) {
    const errors = []
    validateOptionalId(errors, item)
    requireEnum(errors, item?.sourceType, SOURCE_TYPE_VALUES, "sourceType")
    requireEnum(errors, item?.scope, EFFECT_SCOPE_VALUES, "scope")
    requireName(errors, item?.name, "name.zhCN")
    validateCoverage(errors, item?.coverage, "coverage")
    validateEffectSet(errors, item, "effects", { requireRule: true, sourceType: item?.sourceType ?? "manual" })
    validateDuplicateId(errors, item?.id, context, "id")
    return errors
}

function validateTeammateBuff(item, context) {
    const errors = []
    requireId(errors, item?.teammate, "teammate.id")
    requireName(errors, item?.teammate?.name, "teammate.name.zhCN")
    validateOptionalId(errors, item?.buff, "buff.id")
    requireName(errors, item?.buff?.source, "buff.source.zhCN")
    requireEnum(errors, item?.buff?.scope, EFFECT_SCOPE_VALUES, "buff.scope")
    validateCoverage(errors, item?.buff?.coverage, "buff.coverage")
    validateEffectSet(errors, item?.buff, "buff", { requireRule: true, sourceType: "teammate" })

    const teammate = (context?.teammates ?? []).find(entry => entry.id === item?.teammate?.id)
    validateDuplicateId(errors, item?.buff?.id, {
        items: teammate?.buffs,
        currentId: context?.currentBuffId,
    }, "buff.id")
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
            return "buffs"
        default:
            return kind
    }
}

export function validateMaintenanceItem(kind, item, context = {}) {
    const normalized = normalizeKind(kind)
    const errors = normalized === "agents"
        ? validateAgent(item, context)
        : normalized === "wEngines"
            ? validateWEngine(item, context)
        : normalized === "driveDiscSets"
            ? validateDriveDiscSet(item, context)
            : normalized === "agentSkills"
                ? validateAgentSkill(item, context)
                : normalized === "buffs"
                    ? validateBuffPayload(item, context)
                    : [`kind: unsupported maintenance kind ${kind}`]

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
