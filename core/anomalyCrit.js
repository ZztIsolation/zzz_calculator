export const ANOMALY_CRIT_MODES = Object.freeze(["expected", "crit", "nonCrit"])

export function normalizeAnomalyCritMode(mode) {
    return ANOMALY_CRIT_MODES.includes(mode) ? mode : "expected"
}

export function supportsAnomalyCrit(event = {}) {
    return event.kind === "anomaly"
        && [undefined, "attribute", "release", "turbulence"].includes(event.settlementType)
}

function nonNegative(value) {
    return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
}

// Shared by normal calculation, compiled scoring and optimistic score bounds.
// A requested outcome cannot grant CRIT when no effective anomaly CRIT exists.
export function anomalyCritMultiplierForMode(rate, damage, mode = "expected", supported = true) {
    const critRate = Math.min(1, nonNegative(rate))
    const critDmg = nonNegative(damage)
    if (!supported || critRate <= 0 || critDmg <= 0 || mode === "nonCrit") return 1
    return mode === "crit" ? 1 + critDmg : 1 + critRate * critDmg
}

export function resolveAnomalyCritState({ critRate = 0, critDmg = 0, critMode, supported = true } = {}) {
    critRate = supported ? Math.min(1, nonNegative(critRate)) : 0
    critDmg = supported ? nonNegative(critDmg) : 0
    const available = critRate > 0 && critDmg > 0
    const requestedMode = normalizeAnomalyCritMode(critMode)
    return {
        available,
        requestedMode,
        effectiveMode: available ? requestedMode : "nonCrit",
        critRate,
        critDmg,
        multiplier: anomalyCritMultiplierForMode(critRate, critDmg, requestedMode, supported),
    }
}

export function anomalyDamageVariants(baseSingleDamage, count, crit) {
    if (!crit.available) return undefined
    return Object.fromEntries(ANOMALY_CRIT_MODES.map(critMode => {
        const critMultiplier = anomalyCritMultiplierForMode(crit.critRate, crit.critDmg, critMode)
        const singleDamage = baseSingleDamage * critMultiplier
        return [critMode, { critMode, critMultiplier, singleDamage, finalDamage: singleDamage * count }]
    }))
}
