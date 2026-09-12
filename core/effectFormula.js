import { evaluateFormulaExpression } from "./formulaEvaluator.js"

// These are the panel values that are fully determined before dynamic damage
// bonuses are evaluated. Output-only values such as dmgBonus are deliberately
// excluded so an in-combat formula cannot create a dependency cycle.
export const IN_COMBAT_FORMULA_SOURCE_STATS = Object.freeze([
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
])

export const IN_COMBAT_FORMULA_SOURCE_TYPES = Object.freeze([
    "self",
    "wEngine",
    "driveDisc4pc",
])

const IN_COMBAT_FORMULA_SOURCE_STAT_SET = new Set(IN_COMBAT_FORMULA_SOURCE_STATS)
const IN_COMBAT_FORMULA_SOURCE_TYPE_SET = new Set(IN_COMBAT_FORMULA_SOURCE_TYPES)
const PARAMETER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

export function isInCombatFormulaRule(rule = {}) {
    return rule?.type === "formula" && rule?.source?.kind === "inCombatStat"
}

export function isAllowedInCombatFormulaSourceStat(stat) {
    return IN_COMBAT_FORMULA_SOURCE_STAT_SET.has(String(stat ?? "").trim())
}

export function isAllowedInCombatFormulaSourceType(sourceType) {
    return IN_COMBAT_FORMULA_SOURCE_TYPE_SET.has(String(sourceType ?? "").trim())
}

export function formulaParameterDefaults(rule = {}) {
    const parameters = rule?.formula?.parameters
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
        return {}
    }
    return Object.fromEntries(Object.entries(parameters)
        .filter(([name, value]) => PARAMETER_NAME_PATTERN.test(name) && name !== "x" && Number.isFinite(Number(value)))
        .map(([name, value]) => [name, Number(value)]))
}

export function formulaParameterNames(rule = {}) {
    return Object.keys(formulaParameterDefaults(rule))
}

export function formulaModificationValues(rule = {}) {
    const values = rule?.formula?.modificationValues
    if (!values || typeof values !== "object" || Array.isArray(values)) {
        return {}
    }
    return Object.fromEntries(Object.entries(values)
        .filter(([name, list]) => PARAMETER_NAME_PATTERN.test(name)
            && name !== "x"
            && Array.isArray(list)
            && list.length > 0
            && list.every(value => Number.isFinite(Number(value))))
        .map(([name, list]) => [name, list.map(value => Number(value))]))
}

export function formulaParameterValues(rule = {}) {
    const defaults = formulaParameterDefaults(rule)
    const values = formulaModificationValues(rule)
    return Object.fromEntries(Object.entries(defaults).map(([name, value]) => [
        name,
        Number.isFinite(Number(rule?.formula?.parameters?.[name]))
            ? Number(rule.formula.parameters[name])
            : Number.isFinite(Number(values[name]?.[0]))
                ? Number(values[name][0])
                : value,
    ]))
}

export function formulaParameterModificationValues(rule = {}) {
    return formulaModificationValues(rule)
}

export function materializeFormulaRuleForModificationLevel(rule = {}, level, minLevel = 1) {
    if (!rule || rule.type !== "formula") {
        return rule
    }
    const modificationValues = formulaModificationValues(rule)
    if (!Object.keys(modificationValues).length) {
        return rule
    }
    const numericLevel = Number.isFinite(Number(level)) ? Math.trunc(Number(level)) : Number(minLevel)
    const index = Math.max(0, numericLevel - Number(minLevel))
    const parameters = {
        ...formulaParameterDefaults(rule),
    }
    for (const [name, values] of Object.entries(modificationValues)) {
        const value = Number(values[Math.min(index, values.length - 1)])
        if (Number.isFinite(value)) {
            parameters[name] = value
        }
    }
    return {
        ...rule,
        formula: {
            ...(rule.formula ?? {}),
            parameters,
        },
    }
}

function sourceUnitIsPercent(source = {}) {
    return source.unit === "storedPercent"
}

export function inCombatFormulaSourceValue(rule = {}, panel = {}) {
    const source = rule.source ?? {}
    const rawSourceValue = Number(panel?.[source.stat] ?? 0)
    const sourceValue = sourceUnitIsPercent(source) ? rawSourceValue * 100 : rawSourceValue
    return {
        rawSourceValue: Number.isFinite(rawSourceValue) ? rawSourceValue : 0,
        sourceValue: Number.isFinite(sourceValue) ? sourceValue : 0,
        sourceUnit: source.unit ?? "storedValue",
    }
}

export function evaluateInCombatFormulaRule(rule = {}, panel = {}) {
    if (!isInCombatFormulaRule(rule)) {
        return null
    }
    const expression = String(rule.formula?.expression ?? "").trim()
    const source = inCombatFormulaSourceValue(rule, panel)
    const parameterValues = formulaParameterValues(rule)
    const formulaValue = evaluateFormulaExpression(expression, {
        x: source.sourceValue,
        ...parameterValues,
    })
    const valueUnit = rule.formula?.valueUnit ?? "storedValue"
    const value = valueUnit === "storedPercent" ? formulaValue / 100 : formulaValue
    return {
        ...rule,
        sourceValue: source.sourceValue,
        rawSourceValue: source.rawSourceValue,
        sourceUnit: source.sourceUnit,
        parameterValues,
        expression,
        formulaValue,
        valueUnit,
        value,
        dynamic: true,
    }
}

export function formulaExpressionVariables(rule = {}) {
    return ["x", ...formulaParameterNames(rule)]
}

export function migrateLegacySharpOverflowEffect(effect = {}) {
    const effects = Array.isArray(effect?.effects) ? effect.effects : []
    const rateRule = effects.find(rule => rule?.stat === "sharpOverflowPerCritRate"
        && rule?.id === "marrow-overflow-rate")
    const capRule = effects.find(rule => rule?.stat === "sharpOverflowCap"
        && rule?.id === "marrow-overflow-cap")
    if (!rateRule || !capRule) {
        return effect
    }
    const rateValues = Array.isArray(rateRule?.modificationValues?.value)
        ? rateRule.modificationValues.value.map(Number)
        : [Number(rateRule?.value ?? 0)]
    const capValues = Array.isArray(capRule?.modificationValues?.value)
        ? capRule.modificationValues.value.map(Number)
        : [Number(capRule?.value ?? 0)]
    const hasCap = capValues.some(value => Number.isFinite(value) && value > 0)
    const parameters = {
        threshold: 100,
        rate: Number(rateValues[0] ?? 0),
        ...(hasCap ? { cap: Number(capValues[0] ?? 0) } : {}),
    }
    const modificationValues = {
        rate: rateValues,
        ...(hasCap ? { cap: capValues } : {}),
    }
    const expression = hasCap
        ? "clamp(max(x - threshold, 0) * rate, 0, cap)"
        : "max(x - threshold, 0) * rate"
    const migratedRule = {
        id: "marrow-overflow-damage",
        type: "formula",
        scope: "inCombat",
        stat: "dmgBonus",
        mode: "flat",
        target: { kind: "default" },
        source: {
            kind: "inCombatStat",
            stat: "critRate",
            unit: "storedPercent",
            label: { zhCN: "局内暴击率" },
        },
        formula: {
            expression,
            valueUnit: "storedPercent",
            parameters,
            modificationValues,
        },
    }
    const firstIndex = Math.max(0, effects.findIndex(rule => rule === rateRule || rule === capRule))
    const nextEffects = effects.filter(rule => rule !== rateRule && rule !== capRule)
    nextEffects.splice(firstIndex, 0, migratedRule)
    return { ...effect, effects: nextEffects }
}

export function migrateLegacyBloodMarrowWEngine(wEngine = {}) {
    if (String(wEngine?.id ?? "") !== "zzz_wiki_2189") {
        return wEngine
    }
    const effect = wEngine.effect
        ? {
            ...wEngine.effect,
            ...(wEngine.effect.selfBuff || !wEngine.selfBuff
                ? {}
                : { selfBuff: wEngine.selfBuff }),
            ...(wEngine.effect.teamBuff || !wEngine.teamBuff
                ? {}
                : { teamBuff: wEngine.teamBuff }),
        }
        : (
        wEngine.selfBuff || wEngine.teamBuff || wEngine.buff || wEngine.passive
            ? {
                name: wEngine.passive?.name ?? wEngine.name,
                selfBuff: wEngine.selfBuff ?? wEngine.buff ?? wEngine.passive,
                teamBuff: wEngine.teamBuff ?? null,
            }
            : null
        )
    if (!effect || typeof effect !== "object") {
        return wEngine
    }
    const next = {
        ...wEngine,
        effect: {
            ...effect,
            ...(effect.selfBuff
                ? { selfBuff: migrateLegacySharpOverflowEffect(effect.selfBuff) }
                : {}),
            ...(effect.teamBuff
                ? { teamBuff: migrateLegacySharpOverflowEffect(effect.teamBuff) }
                : {}),
            ...(effect.buff
                ? { buff: migrateLegacySharpOverflowEffect(effect.buff) }
                : {}),
        },
    }
    if (!wEngine.effect) {
        delete next.selfBuff
        delete next.teamBuff
        delete next.buff
        delete next.passive
    }
    return next
}
