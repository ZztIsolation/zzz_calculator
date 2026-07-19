const DEFAULT_ELAPSED_STEP_SECONDS = 0.5

function finiteNonNegative(value, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
}

function positiveFinite(value, fallback) {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function decimalPlaces(value) {
    const normalized = Number(value).toFixed(10).replace(/0+$/, "")
    const decimalIndex = normalized.indexOf(".")
    return decimalIndex < 0 ? 0 : normalized.length - decimalIndex - 1
}

function effectCollection(catalog = {}, settlementType) {
    const directKey = settlementType === "disorder" ? "disorderEffects" : "anomalyEffects"
    const direct = catalog?.[directKey]
    if (Array.isArray(direct)) {
        return direct
    }
    if (Array.isArray(direct?.effects)) {
        return direct.effects.filter(effect => settlementType === "disorder"
            ? effect?.settlementType === "disorder"
            : effect?.settlementType !== "disorder")
    }
    if (Array.isArray(catalog?.anomalyEffects?.effects)) {
        return catalog.anomalyEffects.effects.filter(effect => settlementType === "disorder"
            ? effect?.settlementType === "disorder"
            : effect?.settlementType !== "disorder")
    }
    if (Array.isArray(catalog?.effects)) {
        return catalog.effects.filter(effect => settlementType === "disorder"
            ? effect?.settlementType === "disorder"
            : effect?.settlementType !== "disorder")
    }
    return []
}

function effectById(catalog, settlementType, effectId) {
    const key = String(effectId ?? "").trim()
    const mapKey = settlementType === "disorder" ? "disorderEffectsMap" : "anomalyEffectsMap"
    return (typeof catalog?.[mapKey]?.get === "function" ? catalog[mapKey].get(key) : null)
        ?? effectCollection(catalog, settlementType).find(effect => String(effect?.id ?? "") === key)
        ?? null
}

export function disorderElapsedStepSeconds(event = {}, catalog = {}) {
    const effect = effectById(catalog, "disorder", event.anomalyEffect ?? event.previousAnomalyEffect)
    return positiveFinite(effect?.tickIntervalSeconds, DEFAULT_ELAPSED_STEP_SECONDS)
}

export function normalizeElapsedSeconds(
    value,
    durationSeconds = Number.POSITIVE_INFINITY,
    stepSeconds = DEFAULT_ELAPSED_STEP_SECONDS,
) {
    const numeric = finiteNonNegative(value, 0)
    const duration = Number(durationSeconds)
    const step = positiveFinite(stepSeconds, DEFAULT_ELAPSED_STEP_SECONDS)
    const maxStep = Number.isFinite(duration)
        ? Math.max(0, Math.floor((Math.max(0, duration) + 1e-9) / step) * step)
        : Number.POSITIVE_INFINITY
    const snapped = Math.round(numeric / step) * step
    return Number(Math.min(snapped, maxStep).toFixed(decimalPlaces(step)))
}

export function normalizeDamageScale(event = {}) {
    if (event.damageRatioPct === undefined && Number.isFinite(Number(event.damageScale))) {
        return finiteNonNegative(event.damageScale, 1)
    }
    const damageRatioPct = Number(event.damageRatioPct ?? 100)
    return Number.isFinite(damageRatioPct) ? Math.max(0, damageRatioPct) / 100 : 1
}

export function disorderBaseMultiplier(effect = {}, elapsedSeconds, durationBonusSeconds = 0) {
    const baseDuration = finiteNonNegative(effect.defaultDurationSeconds ?? 10, 10)
    const durationBonus = finiteNonNegative(durationBonusSeconds, 0)
    const duration = baseDuration + durationBonus
    const interval = positiveFinite(effect.tickIntervalSeconds, DEFAULT_ELAPSED_STEP_SECONDS)
    const elapsed = normalizeElapsedSeconds(elapsedSeconds, duration, interval)
    const remaining = Math.max(0, duration - elapsed)
    const tickCount = Math.floor((remaining + 1e-9) / interval)
    return {
        baseDuration,
        durationBonus,
        duration,
        elapsed,
        remaining,
        tickIntervalSeconds: interval,
        tickCount,
        baseMultiplier: finiteNonNegative(effect.fixedMultiplier ?? 4.5, 4.5)
            + tickCount * finiteNonNegative(effect.tickMultiplier, 0),
    }
}

export function disorderMultiplierScale(type) {
    return type === "polarized" ? 0.25 : 1
}

export function resolveDamageEventMultiplier(event = {}, catalog = {}) {
    if (!event || event.kind === "skillGroup") {
        return null
    }

    const damageScale = normalizeDamageScale(event)
    if (event.kind === "direct" || event.kind === "sheer") {
        const skillMultiplierPct = Number(event.skillMultiplier)
        return Number.isFinite(skillMultiplierPct)
            ? Math.max(0, skillMultiplierPct) / 100 * damageScale
            : null
    }

    const isDisorder = event.kind === "disorder" || event.settlementType === "disorder"
    const effectId = event.anomalyEffect ?? event.previousAnomalyEffect
    const effect = effectById(catalog, isDisorder ? "disorder" : "attribute", effectId)
    if (!effect) {
        return null
    }

    if (isDisorder) {
        const disorder = disorderBaseMultiplier(effect, event.elapsedSeconds)
        return disorder.baseMultiplier * disorderMultiplierScale(event.disorderType) * damageScale
    }

    const procCountValue = Number(event.procCount ?? effect.defaultProcCount ?? 1)
    const procCount = Number.isFinite(procCountValue) ? Math.max(0, procCountValue) : 1
    return finiteNonNegative(effect.baseMultiplier, 0) * procCount * damageScale
}

export function disorderDurationSeconds(event = {}, catalog = {}, durationBonusSeconds = 0) {
    const effect = effectById(catalog, "disorder", event.anomalyEffect ?? event.previousAnomalyEffect)
    return effect
        ? finiteNonNegative(effect.defaultDurationSeconds ?? 10, 10) + finiteNonNegative(durationBonusSeconds, 0)
        : Number.POSITIVE_INFINITY
}
