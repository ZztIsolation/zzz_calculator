const MIN_POTENTIAL_LEVEL = 0
const MAX_POTENTIAL_LEVEL = 6

function finiteInteger(value) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null
}

function potentialVisionMaxLevel(agent = {}) {
    if (!agent?.potentialVision) {
        return 0
    }
    const configured = finiteInteger(agent.potentialVision.maxLevel)
    return Math.min(MAX_POTENTIAL_LEVEL, Math.max(MIN_POTENTIAL_LEVEL, configured ?? MAX_POTENTIAL_LEVEL))
}

export function normalizePotentialLevel(agent = {}, value, fallback) {
    const maxLevel = potentialVisionMaxLevel(agent)
    if (maxLevel === 0) {
        return 0
    }

    const configuredFallback = fallback === undefined
        ? agent?.potentialVision?.defaultLevel ?? MIN_POTENTIAL_LEVEL
        : fallback
    const fallbackLevel = finiteInteger(configuredFallback) ?? MIN_POTENTIAL_LEVEL
    const requestedLevel = finiteInteger(value)
    return Math.min(maxLevel, Math.max(MIN_POTENTIAL_LEVEL, requestedLevel ?? fallbackLevel))
}

export function potentialVisionScalingRow(agent = {}, potentialLevel) {
    const levels = Array.isArray(agent?.potentialVision?.scaling?.levels)
        ? agent.potentialVision.scaling.levels
        : []
    if (!levels.length) {
        return null
    }

    const activeLevel = normalizePotentialLevel(agent, potentialLevel)
    return levels
        .filter(row => row && typeof row === "object" && finiteInteger(row.level) !== null)
        .filter(row => Number(row.level) <= activeLevel)
        .sort((left, right) => Number(right.level) - Number(left.level))[0] ?? null
}

function materializePotentialVisionRule(rule = {}, agent = {}, potentialLevel) {
    const source = rule?.valueSource
    if (source?.kind !== "potentialVisionScaling") {
        return rule
    }

    const field = String(source.field ?? "").trim()
    const scaling = potentialVisionScalingRow(agent, potentialLevel)
    const value = Number(scaling?.[field])
    if (!field || !Number.isFinite(value)) {
        throw new Error(`Invalid potential vision scaling source for ${agent?.id ?? "unknown"}: ${field || "missing field"}`)
    }
    return {
        ...rule,
        value,
        displayValue: value,
    }
}

function materializePotentialVisionValue(value, agent, potentialLevel) {
    if (Array.isArray(value)) {
        return value.map(item => materializePotentialVisionValue(item, agent, potentialLevel))
    }
    if (!value || typeof value !== "object") {
        return value
    }

    const materializedChildren = Object.fromEntries(Object.entries(value)
        .map(([key, child]) => [key, materializePotentialVisionValue(child, agent, potentialLevel)]))
    return materializePotentialVisionRule(materializedChildren, agent, potentialLevel)
}

export function materializePotentialVisionEffect(effect, agent = {}, potentialLevel) {
    if (!effect) {
        return effect
    }
    return materializePotentialVisionValue(effect, agent, normalizePotentialLevel(agent, potentialLevel))
}
