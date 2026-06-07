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
const ALGORITHM_DEFINITIONS = {
    "exact-super-bound": {
        id: "exact-super-bound",
        label: "精准 · 推荐",
        strictExact: true,
        pruningStrategy: "super-bound",
    },
    "exact-legacy": {
        id: "exact-legacy",
        label: "精准 · 旧算法对照",
        strictExact: true,
        pruningStrategy: "legacy-upper-bound",
    },
    "heuristic-potential": {
        id: "heuristic-potential",
        label: "非精准 · 极速",
        strictExact: false,
        pruningStrategy: "potential-filter+super-bound",
    },
}
const ALGORITHM_ALIASES = {
    exact: "exact-super-bound",
    legacy: "exact-legacy",
    "super-bound": "exact-super-bound",
    "exact-super-bound-parallel": "exact-super-bound",
}
const DEFAULT_POTENTIAL_WEIGHTS = {
    hpFlat: 0.02,
    hpPct: 4,
    sheerForceFlat: 0.1,
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
    sheerDmgBonus: 5,
    physicalSheerDmg: 5,
    fireSheerDmg: 5,
    iceSheerDmg: 5,
    electricSheerDmg: 5,
    etherSheerDmg: 5,
    penRatio: 5,
    penFlat: 0.03,
    physicalResIgnore: 5,
    fireResIgnore: 5,
    iceResIgnore: 5,
    electricResIgnore: 5,
    etherResIgnore: 5,
    anomalyProficiency: 0.01,
    energyRegen: 0.02,
    energyRegenPct: 0.02,
    impact: 0.02,
    impactPct: 0.02,
    anomalyMastery: 0.02,
}
const PERCENT_PANEL_STATS = new Set([
    "hpPct",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
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

function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()
}

function elapsedMsSince(startedAt) {
    return nowMs() - Number(startedAt ?? nowMs())
}

function addMetricTime(metrics, key, startedAt) {
    if (!metrics) {
        return
    }
    metrics[key] = Number(metrics[key] ?? 0) + elapsedMsSince(startedAt)
}

function normalizeAlgorithm(rawAlgorithm) {
    const raw = String(rawAlgorithm ?? "exact-super-bound").trim() || "exact-super-bound"
    const algorithm = ALGORITHM_ALIASES[raw] ?? raw
    return ALGORITHM_DEFINITIONS[algorithm] ? algorithm : "exact-super-bound"
}

function algorithmDefinition(algorithm) {
    return ALGORITHM_DEFINITIONS[normalizeAlgorithm(algorithm)]
}

function algorithmMetricFields(algorithm) {
    const definition = algorithmDefinition(algorithm)
    return {
        algorithmId: definition.id,
        algorithmLabel: definition.label,
        strictExact: definition.strictExact,
        pruningStrategy: definition.pruningStrategy,
    }
}

function usesSuperBoundAlgorithm(algorithm) {
    return ["exact-super-bound", "heuristic-potential"].includes(normalizeAlgorithm(algorithm))
}

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

    const rawTwoPieceIds = settings.twoPieceSetIds ?? settings.twoPieceSetId ?? input.twoPieceSetIds ?? input.twoPieceSetId ?? []
    const twoPieceSetIds = [...new Set((Array.isArray(rawTwoPieceIds) ? rawTwoPieceIds : [rawTwoPieceIds])
        .map(item => String(item ?? "").trim())
        .filter(Boolean))]
    const twoPieceSetId = twoPieceSetIds.length === 1 ? twoPieceSetIds[0] : ""
    const mainStatLimits = settings.mainStatLimits ?? settings.mainStats ?? {}
    const minimums = settings.minimums ?? settings.minPanel ?? {}

    return {
        ownerId: String(settings.ownerId ?? input.ownerId ?? "default"),
        objective: settings.objective ?? input.objective ?? "damage",
        algorithm: normalizeAlgorithm(settings.algorithm ?? input.algorithm ?? "exact-super-bound"),
        fourPieceSetId,
        twoPieceSetId,
        twoPieceSetIds,
        mainStatLimits,
        minimums,
        enableUpperBoundPruning: settings.enableUpperBoundPruning !== false,
    }
}

function limitedTwoPieceSetIds(settings = {}) {
    if (Array.isArray(settings.twoPieceSetIds) && settings.twoPieceSetIds.length) {
        return settings.twoPieceSetIds
    }
    return settings.twoPieceSetId ? [settings.twoPieceSetId] : []
}

function hasTwoPieceLimit(settings = {}) {
    return limitedTwoPieceSetIds(settings).length > 0
}

function allowedExtraTwoPieceSetIds(settings = {}) {
    return limitedTwoPieceSetIds(settings).filter(setId => setId !== settings.fourPieceSetId)
}

function allowsSixPieceSameSet(settings = {}) {
    return limitedTwoPieceSetIds(settings).includes(settings.fourPieceSetId)
}

function isAllowedExtraSet(settings = {}, setId) {
    return limitedTwoPieceSetIds(settings).includes(setId)
}

function primaryExtraTwoPieceSetId(settings = {}) {
    return allowedExtraTwoPieceSetIds(settings)[0] ?? (allowsSixPieceSameSet(settings) ? settings.fourPieceSetId : "")
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
            const twoPieceSetIds = limitedTwoPieceSetIds(settings)
            if (!twoPieceSetIds.length) {
                return true
            }
            if (twoPieceSetIds.length === 1 && twoPieceSetIds[0] === settings.fourPieceSetId) {
                return disc.setId === settings.fourPieceSetId
            }
            return disc.setId === settings.fourPieceSetId || twoPieceSetIds.includes(disc.setId)
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
    const twoPieceSetIds = limitedTwoPieceSetIds(settings)
    const requiredCount = twoPieceSetIds.length === 1 && twoPieceSetIds[0] === settings.fourPieceSetId ? 6 : 4
    const optionalCount = twoPieceSetIds.some(setId => setId !== settings.fourPieceSetId) ? 2 : 0

    function walk(index, fourCount, twoCounts, product) {
        if (index >= slots.length) {
            const hasAllowedExtra = optionalCount === 0 || allowedExtraTwoPieceSetIds(settings).some(setId => (twoCounts.get(setId) ?? 0) >= 2)
            if (fourCount >= requiredCount && hasAllowedExtra) {
                total += product
            }
            return
        }

        const remaining = slots.length - index
        const bestExtraCount = Math.max(0, ...allowedExtraTwoPieceSetIds(settings).map(setId => twoCounts.get(setId) ?? 0))
        if (fourCount + remaining < requiredCount || bestExtraCount + remaining < optionalCount) {
            return
        }

        const groups = new Map()
        for (const disc of candidatesBySlot[slots[index]] ?? []) {
            const key = disc.setId
            groups.set(key, (groups.get(key) ?? 0) + 1)
        }

        for (const [setId, count] of groups.entries()) {
            const nextTwoCounts = new Map(twoCounts)
            if (isAllowedExtraSet(settings, setId) && setId !== settings.fourPieceSetId) {
                nextTwoCounts.set(setId, (nextTwoCounts.get(setId) ?? 0) + 1)
            }
            walk(
                index + 1,
                fourCount + (setId === settings.fourPieceSetId ? 1 : 0),
                nextTwoCounts,
                product * count,
            )
        }
    }

    walk(0, 0, new Map(), 1)
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
    const extraSetIds = allowedExtraTwoPieceSetIds(settings)

    if (allowsSixPieceSameSet(settings)) {
        masks.push(allSlotsMask)
    }
    if (extraSetIds.length) {
        for (let mask = 0; mask <= allSlotsMask; mask += 1) {
            if (bitCount(mask) === 4) {
                masks.push(mask)
            }
        }
    } else if (!hasTwoPieceLimit(settings)) {
        for (let mask = 0; mask <= allSlotsMask; mask += 1) {
            const count = bitCount(mask)
            if (count >= 4) {
                masks.push(mask)
            }
        }
    }

    const planExtraSetIds = hasTwoPieceLimit(settings) ? (extraSetIds.length ? extraSetIds : [settings.fourPieceSetId]) : [""]
    for (const mask of masks) {
        const extraSetCandidates = mask === allSlotsMask ? [settings.fourPieceSetId] : planExtraSetIds
        for (const extraSetId of extraSetCandidates) {
        const slotCandidates = SLOT_NUMBERS.map((slot, index) => {
            const needsFourPieceSet = Boolean(mask & (1 << index))
            const candidates = candidatesBySlot[String(slot)] ?? []
            if (needsFourPieceSet) {
                return candidates.filter(disc => disc.setId === settings.fourPieceSetId)
            }
            if (extraSetId) {
                return candidates.filter(disc => disc.setId === extraSetId)
            }
            return candidates.filter(disc => disc.setId !== settings.fourPieceSetId)
        })
        if (slotCandidates.every(candidates => candidates.length > 0)) {
            plans.push({
                mask,
                extraSetId,
                slotCandidates,
                combinationCount: productOfCandidateLengths(slotCandidates),
            })
        }
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
    const requiredCount = allowsSixPieceSameSet(settings) && !allowedExtraTwoPieceSetIds(settings).length ? 6 : 4
    const optionalCount = allowedExtraTwoPieceSetIds(settings).length ? 2 : 0
    return fourCount + remaining >= requiredCount && twoCount + remaining >= optionalCount
}

function isCompleteSetMatch(fourCount, twoCount, settings) {
    const requiredCount = allowsSixPieceSameSet(settings) && !allowedExtraTwoPieceSetIds(settings).length ? 6 : 4
    const optionalCount = allowedExtraTwoPieceSetIds(settings).length ? 2 : 0
    return fourCount >= requiredCount && twoCount >= optionalCount
}

function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve))
}

function processedCombinationCount(metrics = {}) {
    return Number(metrics?.evaluated ?? 0) + Number(metrics?.prunedBySuperBound ?? 0)
}

function percentForMetrics(metrics, status = "running") {
    if (status === "complete") {
        return 100
    }
    const estimated = Number(metrics?.estimatedCombinationCount ?? 0)
    if (estimated <= 0) {
        return 0
    }
    const completed = processedCombinationCount(metrics)
    return Math.min(99.9, (completed / estimated) * 100)
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
            ...algorithmMetricFields(settings.algorithm),
            emptySlots,
            candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
            estimatedCombinationCount,
            enumerationPlanCount: 0,
            groupPlanCount: 0,
            evaluated: 0,
            scoredCombinationCount: 0,
            processedCombinationCount: 0,
            planBuildMs: 0,
            boundCheckMs: 0,
            scoreOnlyMs: 0,
            fullResultMs: 0,
            warmupMs: 0,
            seededTopKCount: 0,
            seededTopKAttempts: 0,
            skippedDiscBoundChecks: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            prunedBySuperBound: 0,
            superBoundChecks: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
        error: {
            isError: true,
            reason: `没有符合筛选条件的 ${emptySlots.join(", ")} 号位驱动盘。`,
        },
    }
}

function candidatePotential(disc, vector, weights = DEFAULT_POTENTIAL_WEIGHTS) {
    let score = disc.setId ? 1 : 0
    for (const [stat, value] of vector.entries()) {
        score += Number(value) * (weights[stat] ?? 0)
    }
    return score
}

function probeValueForStat(stat) {
    if (stat === "atkFlat" || stat === "penFlat" || stat === "sheerForceFlat") {
        return 100
    }
    if (stat === "hpFlat") {
        return 1000
    }
    if (stat === "anomalyProficiency") {
        return 30
    }
    if (stat === "energyRegen" || stat === "energyRegenPct") {
        return 10
    }
    if (stat === "impact" || stat === "impactPct" || stat === "anomalyMastery") {
        return 10
    }
    return 1
}

function inferPotentialWeights(panelCalculator) {
    const weights = { ...DEFAULT_POTENTIAL_WEIGHTS }
    const scoreOnly = panelCalculator.scoreOnlyFromSummary ?? panelCalculator.scoreFromSummary
    if (typeof scoreOnly !== "function") {
        return weights
    }

    let baseScore = 0
    try {
        const base = scoreOnly.call(panelCalculator, new Map(), new Map())
        baseScore = Number(base?.finalDamage ?? 0)
    } catch {
        return weights
    }

    for (const stat of Object.keys(DEFAULT_POTENTIAL_WEIGHTS)) {
        const probeValue = probeValueForStat(stat)
        try {
            const probe = scoreOnly.call(panelCalculator, new Map([[stat, probeValue]]), new Map())
            const delta = (Number(probe?.finalDamage ?? 0) - baseScore) / probeValue
            if (Number.isFinite(delta) && delta > 0) {
                weights[stat] = delta
            }
        } catch {
            // Keep the static fallback weight for stats that the current target cannot probe.
        }
    }
    return weights
}

function sortCandidatesByPotential(candidatesBySlot, vectorById, weights) {
    for (const slot of SLOT_NUMBERS) {
        const key = String(slot)
        candidatesBySlot[key]?.sort((left, right) =>
            candidatePotential(right, vectorById.get(right.id) ?? new Map(), weights)
            - candidatePotential(left, vectorById.get(left.id) ?? new Map(), weights)
            || sourceOrder(left) - sourceOrder(right)
            || String(left.id).localeCompare(String(right.id))
        )
    }
}

function filterCandidatesByPotential(candidatesBySlot, vectorById, weights, settings) {
    if (normalizeAlgorithm(settings.algorithm) !== "heuristic-potential") {
        return candidatesBySlot
    }

    const filtered = {}
    for (const slot of SLOT_NUMBERS) {
        const key = String(slot)
        const groups = new Map()
        for (const disc of candidatesBySlot[key] ?? []) {
            const groupKey = `${disc.setId}::${disc.mainStat?.stat ?? ""}`
            if (!groups.has(groupKey)) {
                groups.set(groupKey, [])
            }
            groups.get(groupKey).push(disc)
        }

        const kept = []
        for (const group of groups.values()) {
            const sorted = [...group].sort((left, right) =>
                candidatePotential(right, vectorById.get(right.id) ?? new Map(), weights)
                - candidatePotential(left, vectorById.get(left.id) ?? new Map(), weights)
                || sourceOrder(left) - sourceOrder(right)
                || String(left.id).localeCompare(String(right.id))
            )
            const targetRelated = sorted.some(disc =>
                disc.setId === settings.fourPieceSetId || limitedTwoPieceSetIds(settings).includes(disc.setId)
            )
            const keepRatio = targetRelated ? 0.5 : 0.75
            const keepCount = Math.max(1, Math.ceil(sorted.length * keepRatio))
            kept.push(...sorted.slice(0, keepCount))
        }
        kept.sort((left, right) =>
            candidatePotential(right, vectorById.get(right.id) ?? new Map(), weights)
            - candidatePotential(left, vectorById.get(left.id) ?? new Map(), weights)
            || sourceOrder(left) - sourceOrder(right)
            || String(left.id).localeCompare(String(right.id))
        )
        filtered[key] = kept
    }
    return filtered
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

function optimisticTwoPieceVectors(catalog) {
    const vectors = []
    for (const set of catalog.driveDiscSets ?? []) {
        const entries = optimisticEffectStatEntries(set.twoPiece)
        if (entries === null) {
            return null
        }
        const vector = new Map()
        for (const { stat, value } of entries) {
            addToVector(vector, stat, value)
        }
        if (vector.size) {
            vectors.push({
                setId: set.id,
                vector,
                potential: [...vector.entries()].reduce(
                    (total, [stat, value]) => total + Number(value) * (DEFAULT_POTENTIAL_WEIGHTS[stat] ?? 0),
                    0,
                ),
            })
        }
    }
    return vectors
}

function optimisticTwoPieceStatEntriesForSlots(catalog, maxActiveSetCount = 0) {
    const vectors = optimisticTwoPieceVectors(catalog)
    if (vectors === null) {
        return null
    }
    const count = Math.max(0, Math.floor(Number(maxActiveSetCount ?? 0)))
    if (count <= 0 || !vectors.length) {
        return []
    }

    const valuesByStat = new Map()
    for (const item of vectors) {
        for (const [stat, value] of item.vector.entries()) {
            if (!valuesByStat.has(stat)) {
                valuesByStat.set(stat, [])
            }
            valuesByStat.get(stat).push(Number(value))
        }
    }
    return [...valuesByStat.entries()].map(([stat, values]) => ({
        stat,
        value: values
            .filter(value => Number.isFinite(value) && value > 0)
            .sort((left, right) => right - left)
            .slice(0, count)
            .reduce((total, value) => total + value, 0),
    })).filter(item => item.value > 0)
}

function optimisticTwoPieceStatEntriesByActiveCount(catalog) {
    const result = {}
    for (let count = 0; count <= 3; count += 1) {
        const entries = optimisticTwoPieceStatEntriesForSlots(catalog, count)
        if (entries === null) {
            return null
        }
        result[String(count)] = entries
    }
    return result
}

function fakeCompletionSetIds(remainingSlots, fourCount, twoCount, settings) {
    const setIds = []
    let nextFourCount = fourCount
    let nextTwoCount = twoCount
    const extraSetId = primaryExtraTwoPieceSetId(settings)
    const requiredFourCount = extraSetId === settings.fourPieceSetId && !allowedExtraTwoPieceSetIds(settings).length ? 6 : 4
    const requiredTwoCount = extraSetId && extraSetId !== settings.fourPieceSetId ? 2 : 0
    for (const slot of remainingSlots) {
        if (nextFourCount < requiredFourCount) {
            setIds.push(settings.fourPieceSetId)
            nextFourCount += 1
            if (extraSetId === settings.fourPieceSetId) {
                nextTwoCount += 1
            }
            continue
        }
        if (extraSetId && extraSetId !== settings.fourPieceSetId && nextTwoCount < requiredTwoCount) {
            setIds.push(extraSetId)
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
    return Number(data.damage?.totalFinalDamage ?? data.damage?.finalDamage ?? Number.POSITIVE_INFINITY)
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

function addVectorEntriesToTotals(totals, entries) {
    for (const { stat, value } of entries ?? []) {
        addToVector(totals, stat, value)
    }
}

function maxVectorForDiscs(discs, vectorById) {
    const max = new Map()
    for (const disc of discs) {
        for (const [stat, value] of (vectorById.get(disc.id) ?? new Map()).entries()) {
            const numeric = Number(value)
            if (numeric > 0 && numeric > (max.get(stat) ?? 0)) {
                max.set(stat, numeric)
            }
        }
    }
    return max
}

function addVectorToTotals(totals, vector) {
    for (const [stat, value] of vector?.entries?.() ?? []) {
        addToVector(totals, stat, value)
    }
}

function superPlanSetCounts(plan, settings) {
    const counts = new Map()
    for (let index = 0; index < SLOT_NUMBERS.length; index += 1) {
        const setId = plan.mask & (1 << index)
            ? settings.fourPieceSetId
            : plan.extraSetId
        if (setId) {
            counts.set(setId, (counts.get(setId) ?? 0) + 1)
        }
    }
    return counts
}

function needsOptimisticFreeTwoPiece(plan, settings) {
    return !hasTwoPieceLimit(settings) && (SLOT_NUMBERS.length - bitCount(plan.mask)) >= 2
}

function maxOptimisticFreeTwoPieceCount(plan, settings) {
    if (!needsOptimisticFreeTwoPiece(plan, settings)) {
        return 0
    }
    return Math.floor((SLOT_NUMBERS.length - bitCount(plan.mask)) / 2)
}

function suffixSuperVectors(orderedSlots) {
    const suffix = Array.from({ length: orderedSlots.length + 1 }, () => new Map())
    for (let index = orderedSlots.length - 1; index >= 0; index -= 1) {
        suffix[index] = new Map(suffix[index + 1])
        addVectorToTotals(suffix[index], orderedSlots[index].superVector)
    }
    return suffix
}

function suffixCandidateProducts(orderedSlots) {
    const suffix = Array.from({ length: orderedSlots.length + 1 }, () => 1)
    for (let index = orderedSlots.length - 1; index >= 0; index -= 1) {
        suffix[index] = suffix[index + 1] * Math.max(1, Number(orderedSlots[index].candidateCount ?? 0))
    }
    return suffix
}

function buildSuperBoundPlan(plan, state) {
    const slotEntries = SLOT_NUMBERS.map((slot, slotIndex) => {
        const groupsByMainStat = new Map()
        for (const disc of plan.slotCandidates[slotIndex] ?? []) {
            const mainStat = String(disc.mainStat?.stat ?? "")
            if (!groupsByMainStat.has(mainStat)) {
                groupsByMainStat.set(mainStat, [])
            }
            groupsByMainStat.get(mainStat).push(disc)
        }

        const groups = [...groupsByMainStat.entries()].map(([mainStat, discs]) => {
            const sortedDiscs = [...discs].sort((left, right) =>
                candidatePotential(right, state.vectorById.get(right.id) ?? new Map(), state.potentialWeights)
                - candidatePotential(left, state.vectorById.get(left.id) ?? new Map(), state.potentialWeights)
                || sourceOrder(left) - sourceOrder(right)
                || String(left.id).localeCompare(String(right.id))
            )
            return {
                mainStat,
                discs: sortedDiscs,
                superVector: maxVectorForDiscs(sortedDiscs, state.vectorById),
                bestPotentialScore: Math.max(
                    0,
                    ...sortedDiscs.map(disc =>
                        candidatePotential(disc, state.vectorById.get(disc.id) ?? new Map(), state.potentialWeights)
                    ),
                ),
            }
        }).sort((left, right) =>
            right.bestPotentialScore - left.bestPotentialScore
            || String(left.mainStat).localeCompare(String(right.mainStat))
        )

        const superVector = new Map()
        for (const group of groups) {
            for (const [stat, value] of group.superVector.entries()) {
                if (Number(value) > (superVector.get(stat) ?? 0)) {
                    superVector.set(stat, Number(value))
                }
            }
        }

        return {
            slot,
            slotIndex,
            groups,
            candidateCount: groups.reduce((total, group) => total + group.discs.length, 0),
            groupCount: groups.length,
            superVector,
            bestPotentialScore: groups.reduce((total, group) => total + group.bestPotentialScore, 0),
        }
    })

    const orderedSlots = [...slotEntries].sort((left, right) =>
        left.candidateCount - right.candidateCount
        || left.groupCount - right.groupCount
        || right.bestPotentialScore - left.bestPotentialScore
        || left.slot - right.slot
    )

    const maxFreeTwoPieceCount = maxOptimisticFreeTwoPieceCount(plan, state.settings)
    return {
        ...plan,
        completeSetCounts: superPlanSetCounts(plan, state.settings),
        needsOptimisticFreeTwoPiece: maxFreeTwoPieceCount > 0,
        maxFreeTwoPieceCount,
        freeTwoPieceOptimisticEntries: maxFreeTwoPieceCount > 0
            ? state.optimisticTwoPieceStatEntriesByActiveCount?.[String(maxFreeTwoPieceCount)] ?? null
            : [],
        orderedSlots,
        suffixSuperVectors: suffixSuperVectors(orderedSlots),
        suffixCandidateProducts: suffixCandidateProducts(orderedSlots),
        groupCombinationCount: slotEntries.reduce((product, entry) => product * Math.max(1, entry.groupCount), 1),
        bestPotentialScore: slotEntries.reduce((total, entry) => total + entry.bestPotentialScore, 0),
    }
}

function buildSuperBoundPlans(state) {
    return state.enumerationPlans
        .map(plan => buildSuperBoundPlan(plan, state))
        .sort((left, right) =>
            right.bestPotentialScore - left.bestPotentialScore
            || left.combinationCount - right.combinationCount
            || bitCount(left.mask) - bitCount(right.mask)
            || String(left.extraSetId).localeCompare(String(right.extraSetId))
        )
}

function superBoundScore(state, superPlan, nextOrderIndex, branchSuperVector = null) {
    if (superPlan.needsOptimisticFreeTwoPiece && !superPlan.freeTwoPieceOptimisticEntries) {
        return Number.POSITIVE_INFINITY
    }

    const startedAt = nowMs()
    const statTotals = new Map(state.selectedStatTotals)
    try {
        if (branchSuperVector) {
            addVectorToTotals(statTotals, branchSuperVector)
        }
        addVectorToTotals(statTotals, superPlan.suffixSuperVectors[nextOrderIndex] ?? new Map())
        if (superPlan.needsOptimisticFreeTwoPiece) {
            addVectorEntriesToTotals(statTotals, superPlan.freeTwoPieceOptimisticEntries)
        }

        state.metrics.superBoundChecks += 1
        state.metrics.upperBoundChecks += 1
        const summary = (state.panelCalculator.scoreOnlyFromSummary ?? state.panelCalculator.scoreFromSummary)
            .call(state.panelCalculator, statTotals, superPlan.completeSetCounts)
        if (!passesMinimumPanel(summary.panel, state.settings)) {
            return Number.NEGATIVE_INFINITY
        }
        return Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
    } finally {
        addMetricTime(state.metrics, "boundCheckMs", startedAt)
    }
}

function pruningCutoffScore(state) {
    const resultCutoff = state.results.length >= RESULT_LIMIT
        ? Number(state.results.at(-1)?.score ?? Number.NEGATIVE_INFINITY)
        : Number.NEGATIVE_INFINITY
    const seedCutoff = Number(state.seedCutoffScore ?? Number.NEGATIVE_INFINITY)
    return Math.max(resultCutoff, seedCutoff)
}

function shouldPruneBySuperBound(state, superPlan, nextOrderIndex, branchSuperVector, prunedLeafCount) {
    if (!state.settings.enableUpperBoundPruning) {
        return false
    }
    const cutoff = pruningCutoffScore(state)
    if (!Number.isFinite(cutoff)) {
        return false
    }

    let upperBound = Number.POSITIVE_INFINITY
    try {
        upperBound = superBoundScore(state, superPlan, nextOrderIndex, branchSuperVector)
    } catch {
        return false
    }
    if (Number.isFinite(upperBound) && upperBound + 1e-9 < cutoff) {
        const count = Math.max(1, Number(prunedLeafCount ?? 1))
        state.metrics.prunedBySuperBound += count
        state.metrics.prunedByUpperBound += count
        return true
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

    let candidatesBySlot = groupCandidatesBySlot(store, settings)
    const emptySlots = SLOT_NUMBERS.filter(slot => !candidatesBySlot[String(slot)]?.length)
    if (emptySlots.length) {
        return {
            isEmpty: true,
            result: createEmptySlotResult(settings, candidatesBySlot, emptySlots),
            settings,
        }
    }

    const candidateData = prepareCandidateData(candidatesBySlot)
    const combatBuffs = combatBuffsForCandidate(catalog, input, settings)
    const scoreInputBase = {
        agentId: input.agentId,
        coreSkillLevel: input.coreSkillLevel,
        wEngineId: input.wEngineId,
        wEngineModificationLevel: input.wEngineModificationLevel,
        combatBuffs,
        damage: input.damage,
    }
    const panelCalculator = createInCombatPanelCalculator(catalog, scoreInputBase)
    const potentialWeights = inferPotentialWeights(panelCalculator)
    sortCandidatesByPotential(candidatesBySlot, candidateData.vectorById, potentialWeights)
    candidatesBySlot = filterCandidatesByPotential(candidatesBySlot, candidateData.vectorById, potentialWeights, settings)
    const planBuildStartedAt = nowMs()
    const enumerationPlans = buildEnumerationPlans(candidatesBySlot, settings)
    const planBuildMs = elapsedMsSince(planBuildStartedAt)
    const estimatedCombinationCount = enumerationPlans.reduce(
        (total, plan) => total + Number(plan.combinationCount ?? 0),
        0,
    )
    const optimisticTwoPieceEntries = optimisticTwoPieceStatEntries(catalog)
    const optimisticTwoPieceEntriesByActiveCount = optimisticTwoPieceStatEntriesByActiveCount(catalog)
    const state = {
        isEmpty: false,
        startedAtMs: Date.now(),
        settings,
        candidatesBySlot,
        enumerationPlans,
        ...candidateData,
        potentialWeights,
        results: [],
        seedScores: [],
        seedCutoffScore: Number.NEGATIVE_INFINITY,
        selected: [],
        selectedCalcDiscs: [],
        selectedStatTotals: new Map(),
        selectedSetCounts: new Map(),
        combatBuffs,
        remainingMaxStatEntriesByIndex: maxStatVectorsByRemainingIndex(candidatesBySlot, candidateData.vectorById),
        optimisticTwoPieceStatEntries: optimisticTwoPieceEntries,
        optimisticTwoPieceStatEntriesByActiveCount: optimisticTwoPieceEntriesByActiveCount,
        scoreInputBase,
        panelCalculator,
        metrics: {
            ...algorithmMetricFields(settings.algorithm),
            emptySlots: [],
            candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
            estimatedCombinationCount,
            enumerationPlanCount: enumerationPlans.length,
            groupPlanCount: 0,
            evaluated: 0,
            scoredCombinationCount: 0,
            processedCombinationCount: 0,
            planBuildMs,
            boundCheckMs: 0,
            scoreOnlyMs: 0,
            fullResultMs: 0,
            warmupMs: 0,
            seededTopKCount: 0,
            seededTopKAttempts: 0,
            skippedDiscBoundChecks: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            prunedBySuperBound: 0,
            superBoundChecks: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
    }
    if (usesSuperBoundAlgorithm(settings.algorithm)) {
        const superPlanBuildStartedAt = nowMs()
        state.superBoundPlans = buildSuperBoundPlans(state)
        addMetricTime(state.metrics, "planBuildMs", superPlanBuildStartedAt)
        state.metrics.groupPlanCount = state.superBoundPlans.reduce(
            (total, plan) => total + Number(plan.groupCombinationCount ?? 0),
            0,
        )
    }
    return state
}

function updateEvaluationRate(state) {
    const metrics = state.result?.metrics ?? state.metrics
    if (!metrics) {
        return 0
    }
    const elapsedMs = Math.max(1, Date.now() - Number(state.startedAtMs ?? Date.now()))
    const processed = processedCombinationCount(metrics)
    const scored = Number(metrics.evaluated ?? 0)
    const rate = processed / (elapsedMs / 1000)
    const scoredRate = scored / (elapsedMs / 1000)
    metrics.scoredCombinationCount = scored
    metrics.processedCombinationCount = processed
    metrics.evaluationsPerSecond = Number.isFinite(rate) ? rate : 0
    metrics.scoredCombinationsPerSecond = Number.isFinite(scoredRate) ? scoredRate : 0
    return metrics.evaluationsPerSecond
}

function progressFromState(state, status = "running") {
    updateEvaluationRate(state)
    const metrics = state.result?.metrics ?? state.metrics
    return {
        status,
        settings: state.settings,
        metrics: { ...metrics },
        evaluated: processedCombinationCount(metrics),
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
    const scoreStartedAt = nowMs()
    let summary
    try {
        summary = (state.panelCalculator.scoreOnlyFromSummary ?? state.panelCalculator.scoreFromSummary)
            .call(state.panelCalculator, state.selectedStatTotals, state.selectedSetCounts)
    } finally {
        addMetricTime(state.metrics, "scoreOnlyMs", scoreStartedAt)
    }
    state.metrics.evaluated += 1
    if (!passesMinimumPanel(summary.panel, state.settings)) {
        state.metrics.rejectedByMinimums += 1
        return
    }

    const score = Number(Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY).toFixed(12))
    if (!Number.isFinite(score)) {
        return
    }
    const inventoryDiscs = [...state.selected].sort((left, right) =>
        Number(left.partition) - Number(right.partition)
        || sourceOrder(left) - sourceOrder(right)
        || String(left.id).localeCompare(String(right.id))
    )
    if (!shouldKeepTopCandidate(state.results, score, inventoryDiscs)) {
        return
    }

    const calcDiscs = inventoryDiscs.map(disc => state.calcDiscById.get(disc.id) ?? toCalculatorDriveDisc(disc))
    const fullResultStartedAt = nowMs()
    const data = state.panelCalculator.calculate(calcDiscs)
    addMetricTime(state.metrics, "fullResultMs", fullResultStartedAt)
    insertTopResult(state.results, {
        rank: 0,
        score,
        driveDiscIdsBySlot: Object.fromEntries(inventoryDiscs.map(disc => [String(disc.partition), disc.id])),
        driveDiscs: inventoryDiscs,
        setSummary: setSummary(inventoryDiscs, catalog),
        data,
    })
}

function finalizeOptimizerResult(state) {
    if (state.isEmpty) {
        return state.result
    }
    updateEvaluationRate(state)

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

function insertSeedScore(state, score) {
    if (!Number.isFinite(Number(score))) {
        return
    }
    state.seedScores.push(Number(score))
    state.seedScores.sort((left, right) => right - left)
    if (state.seedScores.length > RESULT_LIMIT) {
        state.seedScores.length = RESULT_LIMIT
    }
    state.seedCutoffScore = state.seedScores.length >= RESULT_LIMIT
        ? Number(state.seedScores.at(-1))
        : Number.NEGATIVE_INFINITY
}

function evaluateSelectedForSeedCutoff(state) {
    const summary = (state.panelCalculator.scoreOnlyFromSummary ?? state.panelCalculator.scoreFromSummary)
        .call(state.panelCalculator, state.selectedStatTotals, state.selectedSetCounts)
    if (!passesMinimumPanel(summary.panel, state.settings)) {
        return
    }
    insertSeedScore(state, Number(Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY).toFixed(12)))
}

function seedTopKCutoffForSuperBound(state, maxAttempts = 512) {
    if (normalizeAlgorithm(state.settings.algorithm) !== "exact-super-bound" || !state.settings.enableUpperBoundPruning) {
        return
    }
    const startedAt = nowMs()
    let attempts = 0

    function walkPlan(superPlan, orderIndex) {
        if (attempts >= maxAttempts || state.seedScores.length >= RESULT_LIMIT) {
            return
        }
        if (orderIndex >= superPlan.orderedSlots.length) {
            attempts += 1
            evaluateSelectedForSeedCutoff(state)
            return
        }

        const slotEntry = superPlan.orderedSlots[orderIndex]
        for (const group of slotEntry.groups) {
            for (const disc of group.discs) {
                pushSelectedDisc(state, disc)
                walkPlan(superPlan, orderIndex + 1)
                popSelectedDisc(state)
                if (attempts >= maxAttempts || state.seedScores.length >= RESULT_LIMIT) {
                    return
                }
            }
        }
    }

    for (const superPlan of state.superBoundPlans ?? []) {
        walkPlan(superPlan, 0)
        if (attempts >= maxAttempts || state.seedScores.length >= RESULT_LIMIT) {
            break
        }
    }

    state.metrics.seededTopKCount = state.seedScores.length
    state.metrics.seededTopKAttempts = attempts
    addMetricTime(state.metrics, "warmupMs", startedAt)
}

function optimizeDriveDiscsLegacyExact(catalog, store, input = {}) {
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
                twoCount + (isAllowedExtraSet(state.settings, disc.setId) ? 1 : 0),
            )
            popSelectedDisc(state)
        }
    }

    for (const plan of state.enumerationPlans) {
        walkPlan(plan.slotCandidates, 0, 0, 0)
    }
    return finalizeOptimizerResult(state)
}

function optimizeDriveDiscsSuperBoundExact(catalog, store, input = {}) {
    const state = createOptimizerState(catalog, store, input)
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }
    seedTopKCutoffForSuperBound(state)

    function walkPlan(superPlan, orderIndex) {
        if (orderIndex >= superPlan.orderedSlots.length) {
            evaluateSelected(catalog, input, state)
            return
        }

        const slotEntry = superPlan.orderedSlots[orderIndex]
        const remainingProduct = superPlan.suffixCandidateProducts[orderIndex + 1] ?? 1
        for (const group of slotEntry.groups) {
            const groupLeafCount = group.discs.length * remainingProduct
            if (shouldPruneBySuperBound(state, superPlan, orderIndex + 1, group.superVector, groupLeafCount)) {
                continue
            }

            for (const disc of group.discs) {
                pushSelectedDisc(state, disc)
                const skipDiscBoundCheck = group.discs.length === 1
                if (skipDiscBoundCheck) {
                    state.metrics.skippedDiscBoundChecks += 1
                }
                if (skipDiscBoundCheck || !shouldPruneBySuperBound(state, superPlan, orderIndex + 1, null, remainingProduct)) {
                    walkPlan(superPlan, orderIndex + 1)
                }
                popSelectedDisc(state)
            }
        }
    }

    for (const superPlan of state.superBoundPlans ?? []) {
        walkPlan(superPlan, 0)
    }
    return finalizeOptimizerResult(state)
}

export function optimizeDriveDiscs(catalog, store, input = {}) {
    const algorithm = normalizeAlgorithm(input.settings?.algorithm ?? input.algorithm ?? "exact-super-bound")
    if (algorithm === "exact-legacy") {
        return optimizeDriveDiscsLegacyExact(catalog, store, {
            ...input,
            settings: {
                ...(input.settings ?? {}),
                algorithm,
            },
        })
    }
    return optimizeDriveDiscsSuperBoundExact(catalog, store, {
        ...input,
        settings: {
            ...(input.settings ?? {}),
            algorithm,
        },
    })
}

async function optimizeDriveDiscsLegacyExactAsync(catalog, store, input = {}, options = {}) {
    const state = createOptimizerState(catalog, store, input)
    const chunkSize = Math.max(1, Number(options.chunkSize ?? 10000))
    const progressIntervalMs = Math.max(0, Number(options.progressIntervalMs ?? 250))
    const yieldIntervalMs = Math.max(0, Number(options.yieldIntervalMs ?? 50))
    let lastProgressAt = 0
    let lastYieldAt = 0
    let lastYieldEvaluated = 0

    function throwIfCancelled() {
        if (options.shouldCancel?.()) {
            throw new OptimizerCancelledError()
        }
    }

    async function maybeYield(force = false) {
        const now = Date.now()
        const currentEvaluated = state.metrics?.evaluated ?? 0
        const enoughEvaluated = state.isEmpty
            || currentEvaluated - lastYieldEvaluated >= chunkSize
        const enoughYieldTime = now - lastYieldAt >= yieldIntervalMs
        if (!force && !enoughEvaluated && !enoughYieldTime) {
            return
        }

        throwIfCancelled()
        const enoughProgressTime = now - lastProgressAt >= progressIntervalMs
        if (force || enoughProgressTime) {
            options.onProgress?.(progressFromState(state, "running"))
            lastProgressAt = now
        }

        lastYieldEvaluated = currentEvaluated
        lastYieldAt = now
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
                twoCount + (isAllowedExtraSet(state.settings, disc.setId) ? 1 : 0),
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

async function optimizeDriveDiscsSuperBoundExactAsync(catalog, store, input = {}, options = {}) {
    const state = createOptimizerState(catalog, store, input)
    const chunkSize = Math.max(1, Number(options.chunkSize ?? 10000))
    const progressIntervalMs = Math.max(0, Number(options.progressIntervalMs ?? 250))
    const yieldIntervalMs = Math.max(0, Number(options.yieldIntervalMs ?? 50))
    let lastProgressAt = 0
    let lastYieldAt = 0
    let lastYieldWork = 0

    function throwIfCancelled() {
        if (options.shouldCancel?.()) {
            throw new OptimizerCancelledError()
        }
    }

    function workUnits() {
        return Number(state.metrics?.evaluated ?? 0) + Number(state.metrics?.superBoundChecks ?? 0)
    }

    async function maybeYield(force = false) {
        const now = Date.now()
        const currentWork = workUnits()
        const enoughWork = state.isEmpty || currentWork - lastYieldWork >= chunkSize
        const enoughYieldTime = now - lastYieldAt >= yieldIntervalMs
        if (!force && !enoughWork && !enoughYieldTime) {
            return
        }

        throwIfCancelled()
        const enoughProgressTime = now - lastProgressAt >= progressIntervalMs
        if (force || enoughProgressTime) {
            options.onProgress?.(progressFromState(state, "running"))
            lastProgressAt = now
        }

        lastYieldWork = currentWork
        lastYieldAt = now
        await yieldToEventLoop()
        throwIfCancelled()
    }

    options.onProgress?.(progressFromState(state, state.isEmpty ? "complete" : "running"))
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }

    seedTopKCutoffForSuperBound(state)
    await maybeYield(true)

    async function walkPlan(superPlan, orderIndex) {
        throwIfCancelled()
        if (orderIndex >= superPlan.orderedSlots.length) {
            evaluateSelected(catalog, input, state)
            await maybeYield()
            return
        }

        const slotEntry = superPlan.orderedSlots[orderIndex]
        const remainingProduct = superPlan.suffixCandidateProducts[orderIndex + 1] ?? 1
        for (const group of slotEntry.groups) {
            const groupLeafCount = group.discs.length * remainingProduct
            if (shouldPruneBySuperBound(state, superPlan, orderIndex + 1, group.superVector, groupLeafCount)) {
                await maybeYield()
                continue
            }

            for (const disc of group.discs) {
                pushSelectedDisc(state, disc)
                const skipDiscBoundCheck = group.discs.length === 1
                if (skipDiscBoundCheck) {
                    state.metrics.skippedDiscBoundChecks += 1
                }
                if (!skipDiscBoundCheck && shouldPruneBySuperBound(state, superPlan, orderIndex + 1, null, remainingProduct)) {
                    popSelectedDisc(state)
                    await maybeYield()
                    continue
                }
                await walkPlan(superPlan, orderIndex + 1)
                popSelectedDisc(state)
            }
        }
    }

    for (const superPlan of state.superBoundPlans ?? []) {
        await walkPlan(superPlan, 0)
    }
    const result = finalizeOptimizerResult(state)
    options.onProgress?.(progressFromState(state, "complete"))
    return result
}

export async function optimizeDriveDiscsAsync(catalog, store, input = {}, options = {}) {
    const algorithm = normalizeAlgorithm(input.settings?.algorithm ?? input.algorithm ?? "exact-super-bound")
    const normalizedInput = {
        ...input,
        settings: {
            ...(input.settings ?? {}),
            algorithm,
        },
    }
    if (algorithm === "exact-legacy") {
        return optimizeDriveDiscsLegacyExactAsync(catalog, store, normalizedInput, options)
    }
    return optimizeDriveDiscsSuperBoundExactAsync(catalog, store, normalizedInput, options)
}
