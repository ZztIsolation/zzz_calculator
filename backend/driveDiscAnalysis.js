import { createInCombatPanelCalculator } from "./calculator.js"

const DEFAULT_MAX_GAIN_ROLLS = 10
const PERCENT_SUB_STATS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
])

function objectiveOf(input = {}) {
    return input.objective ?? input.settings?.objective ?? "damage"
}

function assertDamageObjective(input = {}) {
    const objective = objectiveOf(input)
    if (objective !== "damage") {
        throw new Error(`Unsupported objective: ${objective}`)
    }
    return objective
}

function driveDiscRules(catalog) {
    const rules = catalog?.statRules?.driveDisc
    if (!rules) {
        throw new Error("Drive disc stat rules are missing.")
    }
    return rules
}

function subStatPool(catalog) {
    const rules = driveDiscRules(catalog)
    return Array.isArray(rules.subStatPool) ? rules.subStatPool : []
}

function subStatSteps(catalog) {
    return driveDiscRules(catalog).sRankSubStatBaseStep ?? {}
}

function numericValue(value) {
    const number = Number(value ?? 0)
    return Number.isFinite(number) ? number : 0
}

function addStat(map, stat, value) {
    if (!stat) {
        return
    }
    const number = numericValue(value)
    if (number === 0) {
        return
    }
    map.set(stat, (map.get(stat) ?? 0) + number)
}

function driveDiscStatTotals(driveDiscs = []) {
    const totals = new Map()
    for (const disc of driveDiscs) {
        if (disc?.mainStat?.stat) {
            addStat(totals, disc.mainStat.stat, disc.mainStat.value)
        }
        for (const stat of disc?.subStats ?? []) {
            addStat(totals, stat.stat, stat.value)
        }
    }
    return totals
}

function driveDiscSetCounts(driveDiscs = []) {
    const counts = new Map()
    for (const disc of driveDiscs) {
        if (!disc?.setId) {
            continue
        }
        counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    }
    return counts
}

function scoreInput(input = {}) {
    return {
        agentId: input.agentId,
        coreSkillLevel: input.coreSkillLevel,
        wEngineId: input.wEngineId,
        wEngineModificationLevel: input.wEngineModificationLevel,
        combatBuffs: input.combatBuffs ?? input.combat ?? {},
        damage: input.damage,
    }
}

function scoreSummary(panelCalculator, statTotals, setCounts) {
    const scoreOnly = panelCalculator.scoreOnlyFromSummary ?? panelCalculator.scoreFromSummary
    if (typeof scoreOnly !== "function") {
        throw new Error("Current calculator does not support summary scoring.")
    }
    return scoreOnly.call(panelCalculator, statTotals, setCounts)
}

function finalDamage(summary) {
    const value = Number(summary?.finalDamage ?? 0)
    return Number.isFinite(value) ? value : 0
}

function cloneTotalsWithAddedStat(totals, stat, value) {
    const next = new Map(totals)
    addStat(next, stat, value)
    return next
}

export function analyzeDriveDiscSubstats(catalog, input = {}) {
    const objective = assertDamageObjective(input)
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []
    const steps = subStatSteps(catalog)
    const allowedStats = new Set(subStatPool(catalog))
    const byStat = new Map()

    for (const disc of driveDiscs) {
        for (const subStat of disc?.subStats ?? []) {
            const stat = subStat?.stat
            const step = Number(steps[stat] ?? 0)
            if (!allowedStats.has(stat) || !Number.isFinite(step) || step <= 0) {
                continue
            }
            const value = numericValue(subStat.value)
            const current = byStat.get(stat) ?? {
                stat,
                mode: PERCENT_SUB_STATS.has(stat) ? "pct" : "flat",
                value: 0,
                step,
                effectiveRolls: 0,
                occurrenceCount: 0,
                discIds: [],
            }
            current.value += value
            current.effectiveRolls += value / step
            current.occurrenceCount += 1
            if (disc?.id) {
                current.discIds.push(disc.id)
            }
            byStat.set(stat, current)
        }
    }

    const stats = [...byStat.values()]
        .map(item => ({
            ...item,
            value: Number(item.value.toFixed(6)),
            effectiveRolls: Number(item.effectiveRolls.toFixed(6)),
        }))
        .sort((left, right) =>
            Number(right.effectiveRolls) - Number(left.effectiveRolls)
            || String(left.stat).localeCompare(String(right.stat))
        )

    const totalEffectiveRolls = stats.reduce((total, item) => total + Number(item.effectiveRolls ?? 0), 0)

    return {
        objective,
        driveDiscCount: driveDiscs.length,
        totalEffectiveRolls: Number(totalEffectiveRolls.toFixed(6)),
        stats,
    }
}

export function analyzeDriveDiscStatGains(catalog, input = {}) {
    const objective = assertDamageObjective(input)
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []
    const maxRolls = Math.max(1, Math.min(50, Number(input.maxRolls ?? DEFAULT_MAX_GAIN_ROLLS) || DEFAULT_MAX_GAIN_ROLLS))
    const steps = subStatSteps(catalog)
    const stats = subStatPool(catalog).filter(stat => Number(steps[stat] ?? 0) > 0)
    const statTotals = driveDiscStatTotals(driveDiscs)
    const setCounts = driveDiscSetCounts(driveDiscs)
    const panelCalculator = createInCombatPanelCalculator(catalog, scoreInput(input))
    const baselineSummary = scoreSummary(panelCalculator, statTotals, setCounts)
    const baselineFinalDamage = finalDamage(baselineSummary)

    const statResults = stats.map(stat => {
        const step = Number(steps[stat])
        const points = []
        for (let rolls = 1; rolls <= maxRolls; rolls += 1) {
            const addedValue = step * rolls
            const summary = scoreSummary(
                panelCalculator,
                cloneTotalsWithAddedStat(statTotals, stat, addedValue),
                setCounts,
            )
            const currentFinalDamage = finalDamage(summary)
            const absoluteGain = currentFinalDamage - baselineFinalDamage
            points.push({
                rolls,
                addedValue: Number(addedValue.toFixed(6)),
                finalDamage: Number(currentFinalDamage.toFixed(6)),
                absoluteGain: Number(absoluteGain.toFixed(6)),
                relativeGain: baselineFinalDamage > 0
                    ? Number((absoluteGain / baselineFinalDamage).toFixed(10))
                    : 0,
            })
        }
        return {
            stat,
            mode: PERCENT_SUB_STATS.has(stat) ? "pct" : "flat",
            step,
            points,
        }
    })

    return {
        objective,
        maxRolls,
        baseline: {
            finalDamage: Number(baselineFinalDamage.toFixed(6)),
            panel: baselineSummary?.panel ?? {},
            selectedDmgBonus: baselineSummary?.selectedDmgBonus ?? 0,
        },
        stats: statResults,
    }
}
