import { createInCombatPanelCalculator } from "./calculator.js"
import { toCalculatorDriveDisc } from "./driveDiscInventory.js"

const SLOT_NUMBERS = [1, 2, 3, 4, 5, 6]
const RESULT_LIMIT = 5
const UPPER_BOUND_PRUNE_DEPTH = 3
const COMPLEXITY_LEVELS = [
    { level: "low", max: 100_000, label: "较快" },
    { level: "medium", max: 1_000_000, label: "中等" },
    { level: "high", max: 5_000_000, label: "较慢" },
    { level: "extreme", max: Number.POSITIVE_INFINITY, label: "很慢" },
]
const PERCENT_PANEL_STATS = new Set([
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
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
])

function nameOf(item) {
    return item?.name?.zhCN ?? item?.name?.en ?? item?.setName ?? item?.id ?? "-"
}

function sourceOrder(disc) {
    return Number.isFinite(Number(disc?.source?.sequence))
        ? Number(disc.source.sequence)
        : Number.MAX_SAFE_INTEGER
}

function stableDiscSignature(discs) {
    return discs
        .map(disc => `${String(sourceOrder(disc)).padStart(8, "0")}:${disc.id}`)
        .join("|")
}

function compareStable(left, right) {
    return stableDiscSignature(left.driveDiscs).localeCompare(stableDiscSignature(right.driveDiscs))
}

function normalizeSettings(input = {}) {
    const settings = input.settings ?? input.optimization ?? {}
    const fourPieceSetId = String(settings.fourPieceSetId ?? input.fourPieceSetId ?? "").trim()
    if (!fourPieceSetId) {
        throw new Error("必须选择限定 4 件套。")
    }

    const rawTwoPiece = settings.twoPieceSetId ?? input.twoPieceSetId ?? ""
    const twoPieceSetId = rawTwoPiece ? String(rawTwoPiece).trim() : ""
    const mainStatLimits = settings.mainStatLimits ?? settings.mainStats ?? {}
    const minimums = settings.minimums ?? settings.minPanel ?? {}

    return {
        ownerId: String(settings.ownerId ?? input.ownerId ?? "default"),
        objective: settings.objective ?? input.objective ?? "damage",
        algorithm: settings.algorithm ?? input.algorithm ?? "exact",
        fourPieceSetId,
        twoPieceSetId,
        mainStatLimits,
        minimums,
        enableUpperBoundPruning: settings.enableUpperBoundPruning === true,
    }
}

function statValueEntries(disc) {
    const entries = []
    if (disc?.mainStat?.stat) {
        entries.push([disc.mainStat.stat, Number(disc.mainStat.value ?? 0)])
    }
    for (const stat of disc?.subStats ?? []) {
        if (stat?.stat) {
            entries.push([stat.stat, Number(stat.value ?? 0)])
        }
    }
    return entries
}

function statVector(disc) {
    const vector = new Map()
    for (const [stat, value] of statValueEntries(disc)) {
        vector.set(stat, (vector.get(stat) ?? 0) + value)
    }
    return vector
}

function addToVector(vector, stat, value) {
    if (!stat || !Number.isFinite(Number(value))) {
        return
    }
    vector.set(stat, (vector.get(stat) ?? 0) + Number(value))
}

function addDiscVectorToTotals(totals, vector, direction = 1) {
    for (const [stat, value] of vector.entries()) {
        addToVector(totals, stat, value * direction)
    }
}

function dominates(left, right) {
    if (left.setId !== right.setId || Number(left.partition) !== Number(right.partition)) {
        return false
    }

    const leftVector = statVector(left)
    const rightVector = statVector(right)
    const keys = new Set([...leftVector.keys(), ...rightVector.keys()])
    let strictlyBetter = sourceOrder(left) < sourceOrder(right) || String(left.id) < String(right.id)
    for (const key of keys) {
        const leftValue = leftVector.get(key) ?? 0
        const rightValue = rightVector.get(key) ?? 0
        if (leftValue < rightValue) {
            return false
        }
        if (leftValue > rightValue) {
            strictlyBetter = true
        }
    }

    return strictlyBetter
}

function removeDominatedDiscs(discs) {
    return discs.filter((disc, index) =>
        !discs.some((candidate, candidateIndex) =>
            candidateIndex !== index && dominates(candidate, disc)
        )
    )
}

function mainStatValuesForSlot(mainStatLimits = {}, slot) {
    const raw = mainStatLimits[String(slot)] ?? mainStatLimits[slot] ?? []
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    return values.filter(Boolean).map(String)
}

function normalizeMainStatLimits(mainStatLimits = {}) {
    const result = {}
    for (const slot of SLOT_NUMBERS) {
        result[String(slot)] = new Set(mainStatValuesForSlot(mainStatLimits, slot))
    }
    return result
}

function passesMainStatLimit(disc, limits) {
    const limit = limits[String(disc.partition)]
    return !limit?.size || limit.has(disc.mainStat?.stat)
}

function preferredMainStatLimitsForAgent(agent = {}) {
    const source = agent.preferredDriveDiscs?.mainStatLimits
        ?? agent.preferredDriveDiscs?.mainStats
        ?? agent.preferredDriveDiscs
        ?? {}
    return Object.fromEntries([4, 5, 6].map(slot => [String(slot), mainStatValuesForSlot(source, slot)]))
}

function applyPreferredMainStatLimits(settings, agent) {
    const preferredMainStatLimits = preferredMainStatLimitsForAgent(agent)
    const mainStatLimits = {}
    const explicitMainStatLimits = {}
    const appliedPreferredMainStatLimits = {}
    for (const slot of SLOT_NUMBERS) {
        const explicit = mainStatValuesForSlot(settings.mainStatLimits, slot)
        const preferred = preferredMainStatLimits[String(slot)] ?? []
        explicitMainStatLimits[String(slot)] = explicit
        mainStatLimits[String(slot)] = explicit.length ? explicit : preferred
        appliedPreferredMainStatLimits[String(slot)] = explicit.length ? [] : preferred
    }
    return {
        ...settings,
        mainStatLimits,
        explicitMainStatLimits,
        preferredMainStatLimits,
        appliedPreferredMainStatLimits,
    }
}

function groupCandidatesBySlot(store, settings) {
    const mainStatLimits = normalizeMainStatLimits(settings.mainStatLimits)
    const filtered = (store.driveDiscs ?? [])
        .filter(disc => (disc.ownerId ?? "default") === settings.ownerId)
        .filter(disc => Number(disc.partition) >= 1 && Number(disc.partition) <= 6)
        .filter(disc => disc.setId && disc.mainStat?.stat && disc.mainStat?.stat !== "unknown")
        .filter(disc => {
            if (!settings.twoPieceSetId) {
                return true
            }
            if (settings.twoPieceSetId === settings.fourPieceSetId) {
                return disc.setId === settings.fourPieceSetId
            }
            return disc.setId === settings.fourPieceSetId || disc.setId === settings.twoPieceSetId
        })
        .filter(disc => passesMainStatLimit(disc, mainStatLimits))

    return Object.fromEntries(SLOT_NUMBERS.map(slot => {
        const slotDiscs = filtered
            .filter(disc => Number(disc.partition) === slot)
            .sort((left, right) =>
                sourceOrder(left) - sourceOrder(right)
                || String(left.id).localeCompare(String(right.id))
            )
        return [String(slot), removeDominatedDiscs(slotDiscs)]
    }))
}

function estimateCombinationCount(candidatesBySlot, settings) {
    let total = 0
    const slots = SLOT_NUMBERS.map(String)
    const requiredCount = settings.twoPieceSetId === settings.fourPieceSetId ? 6 : 4
    const optionalCount = settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId ? 2 : 0

    function walk(index, fourCount, twoCount, product) {
        if (index >= slots.length) {
            if (fourCount >= requiredCount && twoCount >= optionalCount) {
                total += product
            }
            return
        }

        const remaining = slots.length - index
        if (fourCount + remaining < requiredCount || twoCount + remaining < optionalCount) {
            return
        }

        const groups = new Map()
        for (const disc of candidatesBySlot[slots[index]] ?? []) {
            const key = disc.setId
            groups.set(key, (groups.get(key) ?? 0) + 1)
        }

        for (const [setId, count] of groups.entries()) {
            walk(
                index + 1,
                fourCount + (setId === settings.fourPieceSetId ? 1 : 0),
                twoCount + (settings.twoPieceSetId && setId === settings.twoPieceSetId ? 1 : 0),
                product * count,
            )
        }
    }

    walk(0, 0, 0, 1)
    return total
}

function bitCount(value) {
    let count = 0
    let cursor = Number(value) >>> 0
    while (cursor) {
        count += cursor & 1
        cursor >>>= 1
    }
    return count
}

function productOfCandidateLengths(slotCandidates) {
    return slotCandidates.reduce((product, candidates) => product * candidates.length, 1)
}

function buildEnumerationPlans(candidatesBySlot, settings) {
    const plans = []
    const allSlotsMask = (1 << SLOT_NUMBERS.length) - 1
    const masks = []

    if (settings.twoPieceSetId === settings.fourPieceSetId) {
        masks.push(allSlotsMask)
    } else if (settings.twoPieceSetId) {
        for (let mask = 0; mask <= allSlotsMask; mask += 1) {
            if (bitCount(mask) === 4) {
                masks.push(mask)
            }
        }
    } else {
        for (let mask = 0; mask <= allSlotsMask; mask += 1) {
            const count = bitCount(mask)
            if (count >= 4) {
                masks.push(mask)
            }
        }
    }

    for (const mask of masks) {
        const slotCandidates = SLOT_NUMBERS.map((slot, index) => {
            const needsFourPieceSet = Boolean(mask & (1 << index))
            const candidates = candidatesBySlot[String(slot)] ?? []
            if (needsFourPieceSet) {
                return candidates.filter(disc => disc.setId === settings.fourPieceSetId)
            }
            if (settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId) {
                return candidates.filter(disc => disc.setId === settings.twoPieceSetId)
            }
            return candidates.filter(disc => disc.setId !== settings.fourPieceSetId)
        })
        if (slotCandidates.every(candidates => candidates.length > 0)) {
            plans.push({
                mask,
                slotCandidates,
                combinationCount: productOfCandidateLengths(slotCandidates),
            })
        }
    }

    return plans
}

function hasEffectRules(effect) {
    return Array.isArray(effect?.effects) && effect.effects.length > 0
        || Array.isArray(effect?.stats) && effect.stats.length > 0
        || Boolean(effect?.statsByPhase)
}

function fourPieceBuffIds(catalog, setId) {
    const set = catalog.driveDiscSetsMap?.get(setId)
        ?? catalog.driveDiscSets?.find(item => item.id === setId)
    const result = []
    if (!set?.fourPiece) {
        return result
    }

    if (hasEffectRules(set.fourPiece.selfBuff) || (!set.fourPiece.selfBuff && hasEffectRules(set.fourPiece))) {
        result.push(`driveDisc4pc:${setId}.self`)
    }
    if (hasEffectRules(set.fourPiece.teamBuff)) {
        result.push(`driveDisc4pc:${setId}.team`)
    }
    return result
}

function combatBuffsForCandidate(catalog, input, settings) {
    const source = input.combatBuffs ?? input.combat ?? {}
    const activeBuffIds = [
        ...(Array.isArray(source.activeBuffIds) ? source.activeBuffIds : [])
            .filter(id => !String(id).startsWith("driveDisc4pc:")),
        ...fourPieceBuffIds(catalog, settings.fourPieceSetId),
    ]

    return {
        ...source,
        activeBuffIds: [...new Set(activeBuffIds)],
        teammateDriveDiscSetIds: Array.isArray(source.teammateDriveDiscSetIds)
            ? source.teammateDriveDiscSetIds
            : [],
        manualStats: Array.isArray(source.manualStats) ? source.manualStats : [],
        runtimeInputs: source.runtimeInputs && typeof source.runtimeInputs === "object"
            ? Object.fromEntries(
                Object.entries(source.runtimeInputs)
                    .filter(([key]) => !String(key).startsWith("driveDisc4pc:"))
            )
            : {},
    }
}

function normalizedMinimumValue(stat, value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return null
    }

    return PERCENT_PANEL_STATS.has(stat) && Math.abs(numeric) > 1
        ? numeric / 100
        : numeric
}

function passesMinimums(result, settings) {
    const panel = result.inCombat?.panel ?? result.outOfCombat?.panel ?? {}
    return passesMinimumPanel(panel, settings)
}

function passesMinimumPanel(panel, settings) {
    return Object.entries(settings.minimums ?? {}).every(([stat, rawValue]) => {
        const min = normalizedMinimumValue(stat, rawValue)
        if (min === null) {
            return true
        }
        return Number(panel[stat] ?? 0) >= min
    })
}

function setSummary(discs, catalog) {
    const counts = new Map()
    for (const disc of discs) {
        counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    }

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || nameOf(catalog.driveDiscSetsMap?.get(left[0])).localeCompare(nameOf(catalog.driveDiscSetsMap?.get(right[0])), "zh-CN"))
        .map(([setId, count]) => ({
            setId,
            name: nameOf(catalog.driveDiscSetsMap?.get(setId)),
            count,
            twoPieceActive: count >= 2,
            fourPieceActive: count >= 4,
        }))
}

function insertTopResult(results, candidate, limit = RESULT_LIMIT) {
    results.push(candidate)
    results.sort((left, right) =>
        Number(right.score) - Number(left.score)
        || compareStable(left, right)
    )
    if (results.length > limit) {
        results.length = limit
    }
}

function shouldKeepTopCandidate(results, score, driveDiscs, limit = RESULT_LIMIT) {
    if (results.length < limit) {
        return true
    }

    const cutoff = results.at(-1)
    if (Number(score) > Number(cutoff.score)) {
        return true
    }
    if (Number(score) < Number(cutoff.score)) {
        return false
    }

    return compareStable({ driveDiscs }, cutoff) < 0
}

function canStillSatisfy(index, fourCount, twoCount, settings) {
    const remaining = 6 - index
    const requiredCount = settings.twoPieceSetId === settings.fourPieceSetId ? 6 : 4
    const optionalCount = settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId ? 2 : 0
    return fourCount + remaining >= requiredCount && twoCount + remaining >= optionalCount
}

function isCompleteSetMatch(fourCount, twoCount, settings) {
    const requiredCount = settings.twoPieceSetId === settings.fourPieceSetId ? 6 : 4
    const optionalCount = settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId ? 2 : 0
    return fourCount >= requiredCount && twoCount >= optionalCount
}

function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve))
}

function percentForMetrics(metrics, status = "running") {
    if (status === "complete") {
        return 100
    }
    const estimated = Number(metrics?.estimatedCombinationCount ?? 0)
    if (estimated <= 0) {
        return 0
    }
    return Math.min(99.9, (Number(metrics?.evaluated ?? 0) / estimated) * 100)
}

function candidateCountsBySlot(candidatesBySlot) {
    return Object.fromEntries(SLOT_NUMBERS.map(slot => [slot, candidatesBySlot[String(slot)]?.length ?? 0]))
}

function complexityForEstimate(estimatedCombinationCount) {
    const numeric = Number(estimatedCombinationCount ?? 0)
    const match = COMPLEXITY_LEVELS.find(item => numeric <= item.max) ?? COMPLEXITY_LEVELS.at(-1)
    return {
        level: match.level,
        label: match.label,
    }
}

function appliedPreferredSlots(settings = {}) {
    return Object.entries(settings.appliedPreferredMainStatLimits ?? {})
        .filter(([, values]) => Array.isArray(values) && values.length > 0)
        .map(([slot]) => slot)
}

function createEmptySlotResult(settings, candidatesBySlot, emptySlots) {
    const estimatedCombinationCount = 0
    return {
        results: [],
        settings,
        metrics: {
            emptySlots,
            candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
            estimatedCombinationCount,
            enumerationPlanCount: 0,
            evaluated: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
        error: {
            isError: true,
            reason: `没有符合筛选条件的 ${emptySlots.join(", ")} 号位驱动盘。`,
        },
    }
}

function candidatePotential(disc, vector) {
    const weights = {
        atkFlat: 0.05,
        atkPct: 6,
        critRate: 12,
        critDmg: 7,
        dmgBonus: 6,
        physicalDmg: 5,
        fireDmg: 5,
        iceDmg: 5,
        electricDmg: 5,
        etherDmg: 5,
        penRatio: 5,
        penFlat: 0.03,
        physicalResIgnore: 5,
        fireResIgnore: 5,
        iceResIgnore: 5,
        electricResIgnore: 5,
        etherResIgnore: 5,
        anomalyProficiency: 0.01,
        energyRegen: 0.02,
        impact: 0.02,
        anomalyMastery: 0.02,
    }
    let score = disc.setId ? 1 : 0
    for (const [stat, value] of vector.entries()) {
        score += Number(value) * (weights[stat] ?? 0)
    }
    return score
}

function prepareCandidateData(candidatesBySlot) {
    const calcDiscById = new Map()
    const vectorById = new Map()
    for (const slot of SLOT_NUMBERS) {
        const key = String(slot)
        for (const disc of candidatesBySlot[key] ?? []) {
            const vector = statVector(disc)
            calcDiscById.set(disc.id, toCalculatorDriveDisc(disc))
            vectorById.set(disc.id, vector)
        }
        candidatesBySlot[key]?.sort((left, right) =>
            candidatePotential(right, vectorById.get(right.id) ?? new Map())
            - candidatePotential(left, vectorById.get(left.id) ?? new Map())
            || sourceOrder(left) - sourceOrder(right)
            || String(left.id).localeCompare(String(right.id))
        )
    }
    return {
        calcDiscById,
        vectorById,
    }
}

function maxStatVectorsByRemainingIndex(candidatesBySlot, vectorById) {
    const perSlot = {}
    for (const slot of SLOT_NUMBERS) {
        const max = new Map()
        for (const disc of candidatesBySlot[String(slot)] ?? []) {
            for (const [stat, value] of (vectorById.get(disc.id) ?? new Map()).entries()) {
                if (Number(value) > 0 && Number(value) > (max.get(stat) ?? 0)) {
                    max.set(stat, Number(value))
                }
            }
        }
        perSlot[String(slot)] = max
    }

    const suffix = {}
    for (let index = SLOT_NUMBERS.length; index >= 0; index -= 1) {
        const vector = new Map()
        for (let cursor = index; cursor < SLOT_NUMBERS.length; cursor += 1) {
            for (const [stat, value] of perSlot[String(SLOT_NUMBERS[cursor])] ?? []) {
                addToVector(vector, stat, value)
            }
        }
        suffix[index] = [...vector.entries()].map(([stat, value]) => ({ stat, value }))
    }
    return suffix
}

function optimisticEffectStatEntries(effect) {
    const rules = Array.isArray(effect?.effects)
        ? effect.effects
        : Array.isArray(effect?.stats)
            ? effect.stats.map(stat => ({ type: "fixed", ...stat }))
            : []
    const entries = []
    for (const rule of rules) {
        const type = rule.type ?? "fixed"
        if (!rule.stat) {
            continue
        }
        if (type === "fixed") {
            const value = Number(rule.value ?? 0)
            if (Number.isFinite(value) && value > 0) {
                entries.push({ stat: rule.stat, value })
            }
            continue
        }
        if (type === "stacked") {
            const value = Number(rule.valuePerStack ?? rule.value ?? 0) * Number(rule.maxStacks ?? rule.defaultStacks ?? 1)
            if (Number.isFinite(value) && value > 0) {
                entries.push({ stat: rule.stat, value })
            }
            continue
        }
        return null
    }
    return entries
}

function optimisticTwoPieceStatEntries(catalog) {
    const totals = new Map()
    for (const set of catalog.driveDiscSets ?? []) {
        const entries = optimisticEffectStatEntries(set.twoPiece)
        if (entries === null) {
            return null
        }
        for (const { stat, value } of entries) {
            addToVector(totals, stat, value)
        }
    }
    return [...totals.entries()].map(([stat, value]) => ({ stat, value }))
}

function fakeCompletionSetIds(remainingSlots, fourCount, twoCount, settings) {
    const setIds = []
    let nextFourCount = fourCount
    let nextTwoCount = twoCount
    const requiredFourCount = settings.twoPieceSetId === settings.fourPieceSetId ? 6 : 4
    const requiredTwoCount = settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId ? 2 : 0
    for (const slot of remainingSlots) {
        if (nextFourCount < requiredFourCount) {
            setIds.push(settings.fourPieceSetId)
            nextFourCount += 1
            if (settings.twoPieceSetId === settings.fourPieceSetId) {
                nextTwoCount += 1
            }
            continue
        }
        if (settings.twoPieceSetId && settings.twoPieceSetId !== settings.fourPieceSetId && nextTwoCount < requiredTwoCount) {
            setIds.push(settings.twoPieceSetId)
            nextTwoCount += 1
            continue
        }
        setIds.push(settings.fourPieceSetId)
    }
    return setIds
}

function optimisticCompletionDiscs(state, index, fourCount, twoCount) {
    const remainingSlots = SLOT_NUMBERS.slice(index)
    const setIds = fakeCompletionSetIds(remainingSlots, fourCount, twoCount, state.settings)
    const optimisticStats = [
        ...(state.remainingMaxStatEntriesByIndex[index] ?? []),
        ...(state.optimisticTwoPieceStatEntries ?? []),
    ]
    return remainingSlots.map((slot, cursor) => ({
        id: `optimistic-${slot}`,
        setId: setIds[cursor] ?? state.settings.fourPieceSetId,
        partition: slot,
        rarity: "S",
        level: 15,
        mainStat: {
            stat: "atkFlat",
            value: 0,
        },
        subStats: cursor === 0 ? optimisticStats : [],
    }))
}

function optimisticUpperBoundScore(catalog, input, state, index, fourCount, twoCount) {
    if (!state.optimisticTwoPieceStatEntries) {
        return Number.POSITIVE_INFINITY
    }
    const driveDiscs = [
        ...state.selectedCalcDiscs,
        ...optimisticCompletionDiscs(state, index, fourCount, twoCount),
    ]
    const data = state.panelCalculator.calculate(driveDiscs, { round: false })
    state.metrics.upperBoundChecks += 1
    return Number(data.damage?.finalDamage ?? Number.POSITIVE_INFINITY)
}

function shouldPruneByUpperBound(catalog, input, state, index, fourCount, twoCount) {
    if (!state.settings.enableUpperBoundPruning || index !== UPPER_BOUND_PRUNE_DEPTH || state.results.length < RESULT_LIMIT) {
        return false
    }
    const cutoff = Number(state.results.at(-1)?.score ?? Number.NEGATIVE_INFINITY)
    if (!Number.isFinite(cutoff)) {
        return false
    }
    try {
        const upperBound = optimisticUpperBoundScore(catalog, input, state, index, fourCount, twoCount)
        if (Number.isFinite(upperBound) && upperBound + 1e-9 < cutoff) {
            state.metrics.prunedByUpperBound += 1
            return true
        }
    } catch {
        return false
    }
    return false
}

function createOptimizerState(catalog, store, input = {}) {
    const rawSettings = normalizeSettings(input)
    const agent = catalog.agentsMap?.get(input.agentId)
        ?? catalog.agents?.find(item => item.id === input.agentId)
    const settings = applyPreferredMainStatLimits(rawSettings, agent)
    if (settings.objective !== "damage") {
        throw new Error(`Unsupported objective: ${settings.objective}`)
    }

    const candidatesBySlot = groupCandidatesBySlot(store, settings)
    const emptySlots = SLOT_NUMBERS.filter(slot => !candidatesBySlot[String(slot)]?.length)
    if (emptySlots.length) {
        return {
            isEmpty: true,
            result: createEmptySlotResult(settings, candidatesBySlot, emptySlots),
            settings,
        }
    }

    const candidateData = prepareCandidateData(candidatesBySlot)
    const enumerationPlans = buildEnumerationPlans(candidatesBySlot, settings)
    const estimatedCombinationCount = enumerationPlans.reduce(
        (total, plan) => total + Number(plan.combinationCount ?? 0),
        0,
    )
    const combatBuffs = combatBuffsForCandidate(catalog, input, settings)
    const scoreInputBase = {
        agentId: input.agentId,
        coreSkillLevel: input.coreSkillLevel,
        wEngineId: input.wEngineId,
        combatBuffs,
        damage: input.damage,
    }
    return {
        isEmpty: false,
        settings,
        candidatesBySlot,
        enumerationPlans,
        ...candidateData,
        results: [],
        selected: [],
        selectedCalcDiscs: [],
        selectedStatTotals: new Map(),
        selectedSetCounts: new Map(),
        combatBuffs,
        remainingMaxStatEntriesByIndex: maxStatVectorsByRemainingIndex(candidatesBySlot, candidateData.vectorById),
        optimisticTwoPieceStatEntries: optimisticTwoPieceStatEntries(catalog),
        scoreInputBase,
        panelCalculator: createInCombatPanelCalculator(catalog, scoreInputBase),
        metrics: {
            emptySlots: [],
            candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
            estimatedCombinationCount,
            enumerationPlanCount: enumerationPlans.length,
            evaluated: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
    }
}

function progressFromState(state, status = "running") {
    const metrics = state.result?.metrics ?? state.metrics
    return {
        status,
        settings: state.settings,
        metrics: { ...metrics },
        evaluated: Number(metrics?.evaluated ?? 0),
        estimatedCombinationCount: Number(metrics?.estimatedCombinationCount ?? 0),
        percent: percentForMetrics(metrics, status),
    }
}

export function previewDriveDiscOptimization(catalog, store, input = {}) {
    const state = createOptimizerState(catalog, store, input)
    const result = state.isEmpty ? state.result : null
    const metrics = result?.metrics ?? state.metrics
    return {
        settings: state.settings,
        metrics,
        error: result?.error ?? {
            isError: false,
            reason: null,
        },
    }
}

function evaluateSelected(catalog, input, state) {
    const inventoryDiscs = [...state.selected]
    const calcDiscs = [...state.selectedCalcDiscs]
    const summary = state.panelCalculator.scoreFromSummary(state.selectedStatTotals, state.selectedSetCounts)
    state.metrics.evaluated += 1
    if (!passesMinimumPanel(summary.panel, state.settings)) {
        state.metrics.rejectedByMinimums += 1
        return
    }

    const score = Number(Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY).toFixed(12))
    if (!Number.isFinite(score)) {
        return
    }
    if (!shouldKeepTopCandidate(state.results, score, inventoryDiscs)) {
        return
    }

    insertTopResult(state.results, {
        rank: 0,
        score,
        driveDiscIdsBySlot: Object.fromEntries(inventoryDiscs.map(disc => [String(disc.partition), disc.id])),
        driveDiscs: inventoryDiscs,
        setSummary: setSummary(inventoryDiscs, catalog),
        data: state.panelCalculator.calculate(calcDiscs),
    })
}

function finalizeOptimizerResult(state) {
    if (state.isEmpty) {
        return state.result
    }

    state.results.forEach((result, index) => {
        result.rank = index + 1
    })

    return {
        results: state.results,
        settings: state.settings,
        metrics: state.metrics,
        error: {
            isError: state.results.length === 0,
            reason: state.results.length === 0 ? "没有符合限定条件和最小面板要求的驱动盘套装。" : null,
        },
    }
}

export class OptimizerCancelledError extends Error {
    constructor(message = "计算已取消。") {
        super(message)
        this.name = "OptimizerCancelledError"
    }
}

function pushSelectedDisc(state, disc) {
    state.selected.push(disc)
    state.selectedCalcDiscs.push(state.calcDiscById.get(disc.id) ?? toCalculatorDriveDisc(disc))
    addDiscVectorToTotals(state.selectedStatTotals, state.vectorById.get(disc.id) ?? statVector(disc), 1)
    state.selectedSetCounts.set(disc.setId, (state.selectedSetCounts.get(disc.setId) ?? 0) + 1)
}

function popSelectedDisc(state) {
    const disc = state.selected.pop()
    state.selectedCalcDiscs.pop()
    if (disc) {
        addDiscVectorToTotals(state.selectedStatTotals, state.vectorById.get(disc.id) ?? statVector(disc), -1)
        const nextCount = (state.selectedSetCounts.get(disc.setId) ?? 0) - 1
        if (nextCount > 0) {
            state.selectedSetCounts.set(disc.setId, nextCount)
        } else {
            state.selectedSetCounts.delete(disc.setId)
        }
    }
}

export function optimizeDriveDiscs(catalog, store, input = {}) {
    const state = createOptimizerState(catalog, store, input)
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }

    function walkPlan(slotCandidates, index, fourCount, twoCount) {
        if (shouldPruneByUpperBound(catalog, input, state, index, fourCount, twoCount)) {
            return
        }

        if (index >= SLOT_NUMBERS.length) {
            evaluateSelected(catalog, input, state)
            return
        }

        for (const disc of slotCandidates[index]) {
            pushSelectedDisc(state, disc)
            walkPlan(
                slotCandidates,
                index + 1,
                fourCount + (disc.setId === state.settings.fourPieceSetId ? 1 : 0),
                twoCount + (state.settings.twoPieceSetId && disc.setId === state.settings.twoPieceSetId ? 1 : 0),
            )
            popSelectedDisc(state)
        }
    }

    for (const plan of state.enumerationPlans) {
        walkPlan(plan.slotCandidates, 0, 0, 0)
    }
    return finalizeOptimizerResult(state)
}

export async function optimizeDriveDiscsAsync(catalog, store, input = {}, options = {}) {
    const state = createOptimizerState(catalog, store, input)
    const chunkSize = Math.max(1, Number(options.chunkSize ?? 100))
    const progressIntervalMs = Math.max(0, Number(options.progressIntervalMs ?? 100))
    let lastProgressAt = 0
    let lastYieldEvaluated = 0

    function throwIfCancelled() {
        if (options.shouldCancel?.()) {
            throw new OptimizerCancelledError()
        }
    }

    async function maybeYield(force = false) {
        throwIfCancelled()
        const now = Date.now()
        const enoughEvaluated = state.isEmpty
            || state.metrics.evaluated - lastYieldEvaluated >= chunkSize
        const enoughTime = now - lastProgressAt >= progressIntervalMs
        if (!force && !enoughEvaluated && !enoughTime) {
            return
        }

        options.onProgress?.(progressFromState(state, "running"))
        lastProgressAt = now
        lastYieldEvaluated = state.metrics?.evaluated ?? 0
        await yieldToEventLoop()
        throwIfCancelled()
    }

    options.onProgress?.(progressFromState(state, state.isEmpty ? "complete" : "running"))
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }

    await maybeYield(true)

    async function walkPlan(slotCandidates, index, fourCount, twoCount) {
        throwIfCancelled()
        if (shouldPruneByUpperBound(catalog, input, state, index, fourCount, twoCount)) {
            await maybeYield()
            return
        }

        if (index >= SLOT_NUMBERS.length) {
            evaluateSelected(catalog, input, state)
            await maybeYield()
            return
        }

        for (const disc of slotCandidates[index]) {
            pushSelectedDisc(state, disc)
            await walkPlan(
                slotCandidates,
                index + 1,
                fourCount + (disc.setId === state.settings.fourPieceSetId ? 1 : 0),
                twoCount + (state.settings.twoPieceSetId && disc.setId === state.settings.twoPieceSetId ? 1 : 0),
            )
            popSelectedDisc(state)
        }
    }

    for (const plan of state.enumerationPlans) {
        await walkPlan(plan.slotCandidates, 0, 0, 0)
    }
    const result = finalizeOptimizerResult(state)
    options.onProgress?.(progressFromState(state, "complete"))
    return result
}
