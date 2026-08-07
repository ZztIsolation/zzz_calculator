function defaultCoreSkillLevel(agent = {}) {
    const levels = agent?.coreSkill?.levels ?? []
    return agent?.coreSkill?.defaultLevel ?? levels.at(-1)?.level ?? "none"
}

export function activeCoreSkillLevelCount(agent = {}, requestedLevel) {
    const levels = agent?.coreSkill?.levels ?? []
    const selectedLevel = requestedLevel ?? defaultCoreSkillLevel(agent)
    if (!levels.length || selectedLevel === "none" || selectedLevel === "0" || selectedLevel == null || selectedLevel === "") {
        return 0
    }

    const selectedIndex = levels.findIndex(item => item?.level === selectedLevel)
    if (selectedIndex < 0) {
        throw new Error(`Unknown core skill level for ${agent?.id ?? "unknown"}: ${selectedLevel}`)
    }
    return selectedIndex + 1
}

export function corePassiveScalingRow(agent = {}, requestedLevel) {
    const levels = agent?.coreSkill?.corePassiveScaling?.levels ?? []
    if (!levels.length) {
        return null
    }
    const index = Math.min(activeCoreSkillLevelCount(agent, requestedLevel), levels.length - 1)
    return levels[index] ?? null
}

function bindScalingFields(expression, scaling, fields) {
    const fieldSet = new Set(fields)
    return String(expression ?? "").replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => {
        if (!fieldSet.has(name)) {
            return name
        }
        return String(Number(scaling?.[name]))
    })
}

export function materializeCorePassiveScalingRule(rule = {}, agent = {}, requestedLevel) {
    const source = rule?.valueSource
    if (source?.kind !== "corePassiveScaling") {
        return rule
    }

    const scaling = corePassiveScalingRow(agent, requestedLevel)
    if (!scaling) {
        throw new Error(`No core passive scaling row for ${agent?.id ?? "unknown"} at level ${requestedLevel ?? "default"}`)
    }

    // Formula path: bind one or more scaling fields as numeric literals in the
    // expression, leaving the external input variable (e.g. `x`) to be supplied
    // at evaluation time. This is how a core passive that composes a base value
    // plus a per-panel coefficient stays keyed to the source-backed A-F table.
    if (rule.type === "formula" && Array.isArray(source.fields) && source.fields.length) {
        for (const field of source.fields) {
            if (!field || !Number.isFinite(Number(scaling?.[field]))) {
                throw new Error(`Invalid core passive scaling field for ${agent?.id ?? "unknown"}: ${field || "missing field"}`)
            }
        }
        return {
            ...rule,
            formula: {
                ...rule.formula,
                expression: bindScalingFields(rule.formula?.expression, scaling, source.fields),
            },
        }
    }

    // Legacy single-field path: materialize a flat value keyed to the selected level.
    const field = String(source.field ?? "").trim()
    const value = Number(scaling?.[field])
    if (!field || !Number.isFinite(value)) {
        throw new Error(`Invalid core passive scaling source for ${agent?.id ?? "unknown"}: ${field || "missing field"}`)
    }
    return {
        ...rule,
        value,
        displayValue: value,
    }
}

export function materializeCorePassiveScalingEffect(effect, agent = {}, requestedLevel) {
    if (!effect) {
        return effect
    }
    if (Array.isArray(effect.effects)) {
        return {
            ...effect,
            effects: effect.effects.map(rule => materializeCorePassiveScalingRule(rule, agent, requestedLevel)),
        }
    }
    if (Array.isArray(effect.stats)) {
        return {
            ...effect,
            stats: effect.stats.map(rule => materializeCorePassiveScalingRule(rule, agent, requestedLevel)),
        }
    }
    return effect
}
