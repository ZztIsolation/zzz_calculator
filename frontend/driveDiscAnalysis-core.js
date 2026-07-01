import { createInCombatPanelCalculator } from "./calculator-core.js"

const DEFAULT_MAX_GAIN_ROLLS = 10
const MAIN_STAT_SLOTS = [4, 5, 6]
const DIFF_EPSILON = 1e-9
const PERCENT_SUB_STATS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
])
const PERCENT_STATS = new Set([
    ...PERCENT_SUB_STATS,
    "impact",
    "anomalyMastery",
    "energyRegen",
    "penRatio",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
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

function mainStatPools(catalog) {
    return driveDiscRules(catalog).mainStatPools ?? {}
}

function mainStatMaxValues(catalog) {
    return driveDiscRules(catalog).sRankMaxMainStat ?? {}
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

function cloneTotalsWithStatDelta(totals, changes = []) {
    const next = new Map(totals)
    for (const change of changes) {
        addStat(next, change.stat, change.value)
    }
    return next
}

function rounded(value, digits = 6) {
    const number = Number(value)
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0
}

function relativeDiff(absoluteDiff, baselineFinalDamage) {
    const baseline = Number(baselineFinalDamage)
    return baseline > 0 ? rounded(Number(absoluteDiff) / baseline, 10) : 0
}

function statMode(stat) {
    return PERCENT_STATS.has(stat) ? "pct" : "flat"
}

function agentForInput(catalog, input = {}) {
    const id = input.agentId
    return catalog?.agentsMap?.get?.(id)
        ?? (Array.isArray(catalog?.agents) ? catalog.agents.find(item => item?.id === id) : null)
        ?? null
}

function preferredMainStatSource(agent = {}, slot) {
    const source = agent?.preferredDriveDiscs?.mainStatLimits
        ?? agent?.preferredDriveDiscs?.mainStats
        ?? agent?.preferredDriveDiscs
        ?? {}
    const raw = source?.[String(slot)] ?? source?.[slot] ?? []
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    return values.map(item => String(item ?? "").trim()).filter(Boolean)
}

function uniqueStats(stats = []) {
    return [...new Set(stats.map(item => String(item ?? "").trim()).filter(Boolean))]
}

function mainStatCandidates(catalog, agent, slot) {
    const pool = mainStatPools(catalog)?.[String(slot)] ?? []
    const allowed = new Set(pool)
    const preferred = uniqueStats(preferredMainStatSource(agent, slot)).filter(stat => allowed.has(stat))
    const values = preferred.length ? preferred : pool
    return {
        source: preferred.length ? "preferredDriveDiscs" : "slotPool",
        stats: uniqueStats(values),
    }
}

function currentMainDiscBySlot(driveDiscs = []) {
    const result = new Map()
    for (const disc of driveDiscs) {
        const slot = Number(disc?.partition)
        if (MAIN_STAT_SLOTS.includes(slot) && !result.has(slot)) {
            result.set(slot, disc)
        }
    }
    return result
}

function subStatTotals(driveDiscs = []) {
    const totals = new Map()
    for (const disc of driveDiscs) {
        for (const stat of disc?.subStats ?? []) {
            addStat(totals, stat.stat, stat.value)
        }
    }
    return totals
}

function scoreDiff(panelCalculator, totals, setCounts, baselineFinalDamage) {
    const summary = scoreSummary(panelCalculator, totals, setCounts)
    const currentFinalDamage = finalDamage(summary)
    const absoluteDiff = currentFinalDamage - baselineFinalDamage
    return {
        finalDamage: rounded(currentFinalDamage),
        absoluteDiff: rounded(absoluteDiff),
        relativeDiff: relativeDiff(absoluteDiff, baselineFinalDamage),
    }
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

export function analyzeDriveDiscStatDiffs(catalog, input = {}) {
    const objective = assertDamageObjective(input)
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []
    const steps = subStatSteps(catalog)
    const allowedSubStats = subStatPool(catalog).filter(stat => Number(steps[stat] ?? 0) > 0)
    const statTotals = driveDiscStatTotals(driveDiscs)
    const setCounts = driveDiscSetCounts(driveDiscs)
    const panelCalculator = createInCombatPanelCalculator(catalog, scoreInput(input))
    const baselineSummary = scoreSummary(panelCalculator, statTotals, setCounts)
    const baselineFinalDamage = finalDamage(baselineSummary)
    const currentSubTotals = subStatTotals(driveDiscs)

    const substatDiffs = allowedSubStats
        .map(stat => {
            const step = Number(steps[stat])
            const diff = scoreDiff(
                panelCalculator,
                cloneTotalsWithAddedStat(statTotals, stat, step),
                setCounts,
                baselineFinalDamage,
            )
            return {
                stat,
                mode: statMode(stat),
                currentValue: rounded(currentSubTotals.get(stat) ?? 0),
                step,
                addedValue: rounded(step),
                ...diff,
            }
        })
        .filter(item => Math.abs(Number(item.absoluteDiff ?? 0)) > DIFF_EPSILON)
        .sort((left, right) =>
            Number(right.absoluteDiff) - Number(left.absoluteDiff)
            || String(left.stat).localeCompare(String(right.stat))
        )

    const relevantSubStats = new Set(substatDiffs.map(item => item.stat))
    const currentSubStats = [...currentSubTotals.entries()]
        .filter(([stat, value]) => allowedSubStats.includes(stat) && Number(value) > 0)
        .map(([stat]) => stat)
        .sort((left, right) => String(left).localeCompare(String(right)))
    const replacementTargetStats = uniqueStats([...relevantSubStats, ...currentSubStats])
    const substatReplacements = currentSubStats.map(fromStat => {
        const fromStep = Number(steps[fromStat])
        const fromValue = Number(currentSubTotals.get(fromStat) ?? 0)
        const candidates = replacementTargetStats.map(toStat => {
            const toStep = Number(steps[toStat])
            if (toStat === fromStat) {
                return {
                    stat: toStat,
                    mode: statMode(toStat),
                    addedValue: rounded(toStep),
                    removedValue: rounded(fromStep),
                    finalDamage: rounded(baselineFinalDamage),
                    absoluteDiff: 0,
                    relativeDiff: 0,
                }
            }
            const diff = scoreDiff(
                panelCalculator,
                cloneTotalsWithStatDelta(statTotals, [
                    { stat: fromStat, value: -fromStep },
                    { stat: toStat, value: toStep },
                ]),
                setCounts,
                baselineFinalDamage,
            )
            return {
                stat: toStat,
                mode: statMode(toStat),
                addedValue: rounded(toStep),
                removedValue: rounded(fromStep),
                ...diff,
            }
        })
        return {
            stat: fromStat,
            mode: statMode(fromStat),
            currentValue: rounded(fromValue),
            removedValue: rounded(fromStep),
            candidates,
        }
    })

    const agent = agentForInput(catalog, input)
    const maxMainValues = mainStatMaxValues(catalog)
    const mainDiscs = currentMainDiscBySlot(driveDiscs)
    const mainStatDiffsBySlot = Object.fromEntries(MAIN_STAT_SLOTS.map(slot => {
        const disc = mainDiscs.get(slot) ?? null
        const currentStat = disc?.mainStat?.stat ?? ""
        const currentValue = numericValue(disc?.mainStat?.value)
        const { source, stats } = mainStatCandidates(catalog, agent, slot)
        const candidates = stats
            .filter(stat => stat !== currentStat)
            .filter(stat => Number.isFinite(Number(maxMainValues[stat])))
            .map(stat => {
                const value = Number(maxMainValues[stat])
                const diff = scoreDiff(
                    panelCalculator,
                    cloneTotalsWithStatDelta(statTotals, [
                        { stat: currentStat, value: -currentValue },
                        { stat, value },
                    ]),
                    setCounts,
                    baselineFinalDamage,
                )
                return {
                    stat,
                    mode: statMode(stat),
                    value: rounded(value),
                    currentStat,
                    currentValue: rounded(currentValue),
                    ...diff,
                }
            })
            .sort((left, right) =>
                Number(right.absoluteDiff) - Number(left.absoluteDiff)
                || String(left.stat).localeCompare(String(right.stat))
            )

        return [String(slot), {
            slot,
            source,
            current: currentStat ? {
                stat: currentStat,
                mode: statMode(currentStat),
                value: rounded(currentValue),
                discId: disc?.id ?? null,
            } : null,
            candidates,
        }]
    }))

    return {
        objective,
        baseline: {
            finalDamage: rounded(baselineFinalDamage),
            panel: baselineSummary?.panel ?? {},
            selectedDmgBonus: baselineSummary?.selectedDmgBonus ?? 0,
        },
        substatDiffs,
        substatReplacements,
        mainStatDiffsBySlot,
    }
}
