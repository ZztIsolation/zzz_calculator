import { createInCombatPanelCalculator } from "./calculator-core.js"
import { toCalculatorDriveDisc } from "./drive-disc-core.js"

function browserAvailableParallelism() {
    return Math.max(1, Number(globalThis.navigator?.hardwareConcurrency ?? 1))
}

const DEFAULT_OPTIMIZER_RUNTIME = Object.freeze({
    yieldControl: defaultYieldControl,
    availableParallelism: browserAvailableParallelism,
    runParallel: null,
    maxWorkerCount: 6,
})

const SLOT_NUMBERS = [1, 2, 3, 4, 5, 6]
const RESULT_LIMIT = 10
const UPPER_BOUND_PRUNE_DEPTH = 3
const SUPER_BOUND_CHUNK_SIZE = 8
const DEFAULT_SEED_CUTOFF_ATTEMPTS = 768
const SUFFIX_TOPK_BOUND_MAX_LEAVES = 64
const FREE_TWO_PIECE_INSUFFICIENT_REASON = "已有驱动盘太少，无法组成 4+2 或 6 件同套。"
const SCORE_TIE_EPSILON = 1e-8
const SUFFIX_TOPK_PRUNE_EPSILON = SCORE_TIE_EPSILON
const SUFFIX_TOPK_SCORE_SAFETY_EPSILON = 1e-6
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
    "exact-super-bound-parallel": {
        id: "exact-super-bound-parallel",
        label: "精准 · 推荐 · 并行",
        strictExact: true,
        pruningStrategy: "super-bound+parallel",
    },
}
const ALGORITHM_ALIASES = {
    exact: "exact-super-bound",
    legacy: "exact-legacy",
    "super-bound": "exact-super-bound",
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
    windDmg: 5,
    sheerDmgBonus: 5,
    physicalSheerDmg: 5,
    fireSheerDmg: 5,
    iceSheerDmg: 5,
    electricSheerDmg: 5,
    etherSheerDmg: 5,
    windSheerDmg: 5,
    penRatio: 5,
    penFlat: 0.03,
    allResIgnore: 5,
    physicalResIgnore: 5,
    fireResIgnore: 5,
    iceResIgnore: 5,
    electricResIgnore: 5,
    etherResIgnore: 5,
    windResIgnore: 5,
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
    "windSheerDmg",
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
    "allResIgnore",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
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
    return ["exact-super-bound", "exact-super-bound-parallel", "heuristic-potential"].includes(normalizeAlgorithm(algorithm))
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

function hotMetricSample(metrics, key, callCount) {
    const count = Number(callCount ?? 0)
    if (count > 64 && count % 256 !== 0) {
        return null
    }
    return {
        startedAt: nowMs(),
        weight: count > 64 ? 256 : 1,
        samplesKey: `${key}Samples`,
    }
}

function finishHotMetricSample(metrics, key, sample) {
    if (!sample) {
        return
    }
    metrics[key] = Number(metrics[key] ?? 0) + elapsedMsSince(sample.startedAt) * sample.weight
    metrics[sample.samplesKey] = Number(metrics[sample.samplesKey] ?? 0) + 1
}

function compareTopResult(left, right) {
    const scoreDelta = Number(right.score) - Number(left.score)
    if (Math.abs(scoreDelta) > SCORE_TIE_EPSILON) {
        return scoreDelta
    }
    return compareStable(left, right)
}

function preferredDriveDiscDefaultSetId(agent = {}) {
    return String(
        agent?.preferredDriveDiscs?.defaultSetId
            ?? agent?.preferredDriveDiscs?.defaultSet
            ?? agent?.defaultDriveDiscSetId
            ?? "",
    ).trim()
}

function normalizeFourPieceBuffMode(value) {
    return String(value ?? "auto").trim() === "manual" ? "manual" : "auto"
}

function normalizeFourPieceBuffRuntimeInputs(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {}
    }
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key, runtime]) =>
                String(key).startsWith("driveDisc4pc:")
                && runtime
                && typeof runtime === "object"
                && !Array.isArray(runtime)
            )
    )
}

function normalizeSettings(input = {}, agent = null) {
    const settings = input.settings ?? input.optimization ?? {}
    const requestedFourPieceSetId = String(settings.fourPieceSetId ?? input.fourPieceSetId ?? "").trim()
    const fourPieceSetId = requestedFourPieceSetId || preferredDriveDiscDefaultSetId(agent)
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
        fourPieceBuffMode: normalizeFourPieceBuffMode(settings.fourPieceBuffMode ?? input.fourPieceBuffMode),
        fourPieceBuffRuntimeInputs: normalizeFourPieceBuffRuntimeInputs(
            settings.fourPieceBuffRuntimeInputs ?? input.fourPieceBuffRuntimeInputs,
        ),
        mainStatLimits,
        minimums,
        enableUpperBoundPruning: settings.enableUpperBoundPruning !== false,
        enableSpecializedScoreKernel: settings.enableSpecializedScoreKernel !== false,
        enableObjectiveScalarKernel: settings.enableObjectiveScalarKernel !== false,
        enableSuffixFrontierCache: settings.enableSuffixFrontierCache !== false,
        enableSuffixFrontierDominance: settings.enableSuffixFrontierDominance !== false,
        enableObjectiveRelevantDominance: settings.enableObjectiveRelevantDominance !== false,
        useIndexedScoreOnly: settings.useIndexedScoreOnly ?? input.useIndexedScoreOnly ?? "auto",
        workerCount: settings.workerCount ?? input.workerCount ?? "auto",
        parallelThreshold: Number(settings.parallelThreshold ?? input.parallelThreshold ?? 2_000_000),
        disableParallel: settings.disableParallel === true || input.disableParallel === true,
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

function indexMapFromIds(ids) {
    return new Map(ids.map((id, index) => [id, index]))
}

function mapToIndexedVector(vector, statIndexById) {
    const indexes = []
    const values = []
    for (const [stat, value] of vector?.entries?.() ?? []) {
        const index = statIndexById.get(stat)
        const numeric = Number(value)
        if (index === undefined || !Number.isFinite(numeric) || numeric === 0) {
            continue
        }
        indexes.push(index)
        values.push(numeric)
    }
    return { indexes, values }
}

function entriesToIndexedVector(entries, statIndexById) {
    const indexes = []
    const values = []
    for (const { stat, value } of entries ?? []) {
        const index = statIndexById.get(stat)
        const numeric = Number(value)
        if (index === undefined || !Number.isFinite(numeric) || numeric === 0) {
            continue
        }
        indexes.push(index)
        values.push(numeric)
    }
    return { indexes, values }
}

function addIndexedVectorToTotals(totals, indexedVector, direction = 1) {
    if (!totals || !indexedVector) {
        return
    }
    for (let cursor = 0; cursor < indexedVector.indexes.length; cursor += 1) {
        totals[indexedVector.indexes[cursor]] += indexedVector.values[cursor] * direction
    }
}

function addDenseVectorToTotals(totals, denseVector, direction = 1) {
    if (!totals || !denseVector) {
        return
    }
    for (let index = 0; index < denseVector.length; index += 1) {
        const value = Number(denseVector[index] ?? 0)
        if (value !== 0) {
            totals[index] += value * direction
        }
    }
}

function indexedStatTotalsToMap(values, statIds) {
    const totals = new Map()
    for (let index = 0; index < values.length; index += 1) {
        const value = Number(values[index] ?? 0)
        if (value !== 0) {
            totals.set(statIds[index], value)
        }
    }
    return totals
}

function indexedSetCountsToMap(counts, setIds) {
    const result = new Map()
    for (let index = 0; index < counts.length; index += 1) {
        const count = Number(counts[index] ?? 0)
        if (count > 0) {
            result.set(setIds[index], count)
        }
    }
    return result
}

function setCountsMapToArray(counts, setIndexById, setCount) {
    const result = new Int16Array(setCount)
    for (const [setId, count] of counts?.entries?.() ?? []) {
        const index = setIndexById.get(setId)
        if (index !== undefined) {
            result[index] = Number(count ?? 0)
        }
    }
    return result
}

function collectStatIds(candidatesBySlot, vectorById, optimisticEntries, optimisticEntriesByActiveCount) {
    const ids = new Set(Object.keys(DEFAULT_POTENTIAL_WEIGHTS))
    for (const slot of SLOT_NUMBERS) {
        for (const disc of candidatesBySlot[String(slot)] ?? []) {
            for (const stat of (vectorById.get(disc.id) ?? new Map()).keys()) {
                ids.add(stat)
            }
        }
    }
    for (const { stat } of optimisticEntries ?? []) {
        if (stat) {
            ids.add(stat)
        }
    }
    for (const entries of Object.values(optimisticEntriesByActiveCount ?? {})) {
        for (const { stat } of entries ?? []) {
            if (stat) {
                ids.add(stat)
            }
        }
    }
    return [...ids].sort()
}

function collectSetIds(candidatesBySlot, settings) {
    const ids = new Set([settings.fourPieceSetId, ...limitedTwoPieceSetIds(settings)].filter(Boolean))
    for (const slot of SLOT_NUMBERS) {
        for (const disc of candidatesBySlot[String(slot)] ?? []) {
            if (disc.setId) {
                ids.add(disc.setId)
            }
        }
    }
    return [...ids].sort()
}

function prepareIndexedCandidateData(candidatesBySlot, candidateData, settings, optimisticEntries, optimisticEntriesByActiveCount) {
    const statIds = collectStatIds(candidatesBySlot, candidateData.vectorById, optimisticEntries, optimisticEntriesByActiveCount)
    const setIds = collectSetIds(candidatesBySlot, settings)
    const statIndexById = indexMapFromIds(statIds)
    const setIndexById = indexMapFromIds(setIds)
    const indexedVectorById = new Map()
    const candidateStatIndexes = new Set()
    for (const [discId, vector] of candidateData.vectorById.entries()) {
        const indexedVector = mapToIndexedVector(vector, statIndexById)
        indexedVectorById.set(discId, indexedVector)
        for (const index of indexedVector.indexes) {
            candidateStatIndexes.add(index)
        }
    }
    const indexedOptimisticTwoPieceEntries = entriesToIndexedVector(optimisticEntries ?? [], statIndexById)
    const indexedOptimisticTwoPieceEntriesByActiveCount = Object.fromEntries(
        Object.entries(optimisticEntriesByActiveCount ?? {})
            .map(([count, entries]) => [count, entriesToIndexedVector(entries ?? [], statIndexById)]),
    )
    return {
        statIds,
        statIndexById,
        setIds,
        setIndexById,
        indexedVectorById,
        candidateStatIndexes: [...candidateStatIndexes].sort((left, right) => left - right),
        indexedOptimisticTwoPieceEntries,
        indexedOptimisticTwoPieceEntriesByActiveCount,
    }
}

function booleanSetting(value, fallback = null) {
    if (typeof value === "boolean") {
        return value
    }
    const normalized = String(value ?? "").trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) {
        return true
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
        return false
    }
    return fallback
}

function nearlyEqual(left, right, epsilon = 1e-8) {
    const a = Number(left ?? 0)
    const b = Number(right ?? 0)
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return a === b
    }
    return Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(a), Math.abs(b))
}

function summaryPanelValue(summary, key, panelStatIndexById, objectKey, valuesKey) {
    const panel = summary?.[objectKey]
    if (panel && Object.prototype.hasOwnProperty.call(panel, key)) {
        return panel[key]
    }
    const index = panelStatIndexById.get(key)
    return index === undefined ? undefined : summary?.[valuesKey]?.[index]
}

function scoreOnlySummariesMatch(left, right, panelStatIds = [], comparePanels = true) {
    if (!nearlyEqual(left?.finalDamage, right?.finalDamage)) {
        return false
    }
    if (!comparePanels) {
        return true
    }
    const panelStatIndexById = new Map(panelStatIds.map((key, index) => [key, index]))
    const leftPanel = left?.panel ?? {}
    const rightPanel = right?.panel ?? {}
    const keys = new Set([
        ...Object.keys(leftPanel),
        ...Object.keys(rightPanel),
        ...(left?.panelValues || right?.panelValues ? panelStatIds : []),
    ])
    for (const key of keys) {
        if (!nearlyEqual(
            summaryPanelValue(left, key, panelStatIndexById, "panel", "panelValues"),
            summaryPanelValue(right, key, panelStatIndexById, "panel", "panelValues"),
        )) {
            return false
        }
    }
    const leftOutOfCombatPanel = left?.outOfCombatPanel ?? {}
    const rightOutOfCombatPanel = right?.outOfCombatPanel ?? {}
    const outOfCombatKeys = new Set([
        ...Object.keys(leftOutOfCombatPanel),
        ...Object.keys(rightOutOfCombatPanel),
        ...(left?.outOfCombatPanelValues || right?.outOfCombatPanelValues ? panelStatIds : []),
    ])
    for (const key of outOfCombatKeys) {
        if (!nearlyEqual(
            summaryPanelValue(left, key, panelStatIndexById, "outOfCombatPanel", "outOfCombatPanelValues"),
            summaryPanelValue(right, key, panelStatIndexById, "outOfCombatPanel", "outOfCombatPanelValues"),
        )) {
            return false
        }
    }
    return true
}

function indexedProbeValues(indexedData, statEntries = [], setEntries = []) {
    const statValues = new Float64Array(indexedData.statIds?.length ?? 0)
    for (const [stat, value] of statEntries) {
        const index = indexedData.statIndexById?.get(stat)
        if (index !== undefined) {
            statValues[index] += Number(value ?? 0)
        }
    }
    const setCountValues = new Int16Array(indexedData.setIds?.length ?? 0)
    for (const [setId, count] of setEntries) {
        const index = indexedData.setIndexById?.get(setId)
        if (index !== undefined) {
            setCountValues[index] += Number(count ?? 0)
        }
    }
    return { statValues, setCountValues }
}

function validateIndexedScoreOnly(panelCalculator, indexedData) {
    const sampleStats = [
        ["atkFlat", 316],
        ["atkPct", 30],
        ["critRate", 24],
        ["critDmg", 48],
        ["dmgBonus", 15],
        ["iceDmg", 30],
        ["anomalyProficiency", 120],
        ["penRatio", 8],
    ].filter(([stat]) => indexedData.statIndexById?.has(stat))
    const broadStats = (indexedData.statIds ?? [])
        .slice(0, 12)
        .map((stat, index) => [stat, (index % 5 + 1) * 3])
    const setIds = indexedData.setIds ?? []
    const probes = [
        { stats: [], sets: [] },
        { stats: sampleStats, sets: [] },
        { stats: sampleStats.slice(0, 4), sets: setIds[0] ? [[setIds[0], 4]] : [] },
        {
            stats: broadStats,
            sets: [
                ...(setIds[0] ? [[setIds[0], 2]] : []),
                ...(setIds[1] ? [[setIds[1], 4]] : []),
            ],
        },
    ]

    for (const probe of probes) {
        const statTotals = new Map(probe.stats)
        const setCounts = new Map(probe.sets)
        const { statValues, setCountValues } = indexedProbeValues(indexedData, probe.stats, probe.sets)
        const mapSummary = panelCalculator.scoreOnlyFromSummary(statTotals, setCounts)
        const indexedSummary = panelCalculator.scoreOnlyFromIndexedSummary(
            statValues,
            indexedData.statIds,
            setCountValues,
            indexedData.setIds,
            indexedData.setIndexById,
        )
        if (!scoreOnlySummariesMatch(mapSummary, indexedSummary)) {
            return false
        }
    }
    return true
}

function shouldUseIndexedScoreOnly(panelCalculator, indexedData, settings) {
    if (!usesSuperBoundAlgorithm(settings.algorithm)) {
        return false
    }
    if (typeof panelCalculator.scoreOnlyFromIndexedSummary !== "function") {
        return false
    }

    if (String(settings.useIndexedScoreOnly ?? "").trim().toLowerCase() === "force") {
        return true
    }
    const explicit = booleanSetting(settings.useIndexedScoreOnly, null)
    if (explicit === false) {
        return false
    }
    if (explicit !== true) {
        return false
    }
    try {
        return validateIndexedScoreOnly(panelCalculator, indexedData)
    } catch {
        return false
    }
}

function denseProbeInputs(indexedData, candidatesBySlot, limit = 64) {
    const probes = []
    const pushProbe = (statValues, setCountValues) => {
        probes.push({
            statValues,
            setCountValues,
            statTotals: indexedStatTotalsToMap(statValues, indexedData.statIds ?? []),
            setCounts: indexedSetCountsToMap(setCountValues, indexedData.setIds ?? []),
        })
    }

    pushProbe(
        new Float64Array(indexedData.statIds?.length ?? 0),
        new Int16Array(indexedData.setIds?.length ?? 0),
    )

    const slotCandidates = SLOT_NUMBERS.map(slot => candidatesBySlot[String(slot)] ?? [])
    const maxLength = Math.max(0, ...slotCandidates.map(discs => discs.length))
    const rounds = Math.min(limit - probes.length, Math.max(1, maxLength, limit - 1))
    for (let round = 0; round < rounds && probes.length < limit; round += 1) {
        const statValues = new Float64Array(indexedData.statIds?.length ?? 0)
        const setCountValues = new Int16Array(indexedData.setIds?.length ?? 0)
        for (let slotIndex = 0; slotIndex < slotCandidates.length; slotIndex += 1) {
            const discs = slotCandidates[slotIndex]
            if (!discs.length) {
                continue
            }
            const disc = discs[(round + slotIndex * 7) % discs.length]
            addIndexedVectorToTotals(statValues, indexedData.indexedVectorById?.get(disc.id), 1)
            const setIndex = indexedData.setIndexById?.get(disc.setId)
            if (setIndex !== undefined) {
                setCountValues[setIndex] += 1
            }
        }
        pushProbe(statValues, setCountValues)
    }

    return probes
}

function probeCompiledDenseScoreKernel(panelCalculator, indexedData, denseTarget, candidatesBySlot, options = {}) {
    const startedAt = nowMs()
    const result = {
        enabled: false,
        scoreKernel: "map",
        scoreKernelProbeMs: 0,
        scoreKernelMapProbeMs: 0,
        scoreKernelDenseProbeMs: 0,
        scoreKernelProbeCount: 0,
        avgScoreKernelMs: 0,
        scoreKernelFallbackReason: null,
    }
    if (!denseTarget || typeof denseTarget.scoreDense !== "function") {
        result.scoreKernelFallbackReason = "unsupported"
        result.scoreKernelProbeMs = elapsedMsSince(startedAt)
        return result
    }

    const probes = denseProbeInputs(indexedData, candidatesBySlot, Number(options.limit ?? 64))
    result.scoreKernelProbeCount = probes.length
    try {
        const probeState = { panelCalculator }
        for (const probe of probes.slice(0, Math.min(16, probes.length))) {
            const mapSummary = scoreOnlyFromMaps(probeState, probe.statTotals, probe.setCounts)
            const denseSummary = denseTarget.scoreDense(probe.statValues, probe.setCountValues)
            if (!scoreOnlySummariesMatch(mapSummary, denseSummary, denseTarget.panelStatIds ?? [])) {
                result.scoreKernelFallbackReason = "mismatch"
                result.scoreKernelProbeMs = elapsedMsSince(startedAt)
                return result
            }
        }

        let denseSink = 0
        const denseStartedAt = nowMs()
        for (const probe of probes) {
            denseSink += Number(denseTarget.scoreDense(probe.statValues, probe.setCountValues)?.finalDamage ?? 0)
        }
        result.scoreKernelDenseProbeMs = elapsedMsSince(denseStartedAt)

        let mapSink = 0
        const mapStartedAt = nowMs()
        for (const probe of probes) {
            mapSink += Number(scoreOnlyFromMaps(probeState, probe.statTotals, probe.setCounts)?.finalDamage ?? 0)
        }
        result.scoreKernelMapProbeMs = elapsedMsSince(mapStartedAt)
        if (!Number.isFinite(denseSink + mapSink)) {
            result.scoreKernelFallbackReason = "nonFinite"
            result.scoreKernelProbeMs = elapsedMsSince(startedAt)
            return result
        }

        const denseMs = Math.max(0.0001, result.scoreKernelDenseProbeMs)
        const mapMs = Math.max(0.0001, result.scoreKernelMapProbeMs)
        if (denseMs > mapMs * 0.85) {
            result.scoreKernelFallbackReason = "notFaster"
            result.scoreKernelProbeMs = elapsedMsSince(startedAt)
            result.avgScoreKernelMs = denseMs / Math.max(1, probes.length)
            return result
        }

        result.enabled = true
        result.scoreKernel = "compiled-dense"
        result.avgScoreKernelMs = denseMs / Math.max(1, probes.length)
        result.scoreKernelProbeMs = elapsedMsSince(startedAt)
        return result
    } catch (error) {
        result.scoreKernelFallbackReason = error?.message || "error"
        result.scoreKernelProbeMs = elapsedMsSince(startedAt)
        return result
    }
}

function dominanceRow(disc, index) {
    return {
        disc,
        index,
        vector: statVector(disc),
    }
}

function dominatesRow(left, right, relevantStatIds = null) {
    if (left.disc.setId !== right.disc.setId || Number(left.disc.partition) !== Number(right.disc.partition)) {
        return false
    }

    const keys = relevantStatIds?.size
        ? relevantStatIds
        : new Set([...left.vector.keys(), ...right.vector.keys()])
    let strictlyBetter = sourceOrder(left.disc) < sourceOrder(right.disc)
        || String(left.disc.id) < String(right.disc.id)
    for (const key of keys) {
        const leftValue = left.vector.get(key) ?? 0
        const rightValue = right.vector.get(key) ?? 0
        if (leftValue < rightValue) {
            return false
        }
        if (leftValue > rightValue) {
            strictlyBetter = true
        }
    }

    return strictlyBetter
}

function removeDominatedDiscs(discs, relevantStatIds = null) {
    const rowsBySet = new Map()
    const rows = discs.map((disc, index) => dominanceRow(disc, index))
    for (const row of rows) {
        const key = String(row.disc.setId ?? "")
        if (!rowsBySet.has(key)) {
            rowsBySet.set(key, [])
        }
        rowsBySet.get(key).push(row)
    }

    const removed = new Set()
    for (const group of rowsBySet.values()) {
        for (const row of group) {
            const requiredDominators = relevantStatIds?.size ? RESULT_LIMIT : 1
            const dominatorCount = group.reduce((count, candidate) =>
                count + (candidate.index !== row.index && dominatesRow(candidate, row, relevantStatIds) ? 1 : 0),
            0)
            if (dominatorCount >= requiredDominators) {
                removed.add(row.index)
            }
        }
    }

    return discs.filter((_, index) => !removed.has(index))
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

function groupCandidatesBySlot(store, settings, relevantStatIds = null) {
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
        const baselineCandidates = removeDominatedDiscs(slotDiscs)
        return [String(slot), relevantStatIds?.size
            ? removeDominatedDiscs(baselineCandidates, relevantStatIds)
            : baselineCandidates]
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
    const extraSetIds = allowedExtraTwoPieceSetIds(settings)
    const autoMatchTwoPiece = !hasTwoPieceLimit(settings)

    function appendPlan(mask, extraSetId, freeTwoPieceMode = null) {
        const slotCandidates = SLOT_NUMBERS.map((slot, index) => {
            const requiredSetId = mask & (1 << index) ? settings.fourPieceSetId : extraSetId
            return (candidatesBySlot[String(slot)] ?? []).filter(disc => disc.setId === requiredSetId)
        })
        if (!slotCandidates.every(candidates => candidates.length > 0)) {
            return
        }
        plans.push({
            mask,
            extraSetId,
            slotCandidates,
            combinationCount: productOfCandidateLengths(slotCandidates),
            freeTwoPieceMode,
        })
    }

    if (autoMatchTwoPiece || allowsSixPieceSameSet(settings)) {
        appendPlan(allSlotsMask, settings.fourPieceSetId, autoMatchTwoPiece ? "6-piece" : null)
    }

    if (autoMatchTwoPiece) {
        for (let mask = 0; mask <= allSlotsMask; mask += 1) {
            if (bitCount(mask) !== 4) {
                continue
            }
            const freeSlotIndexes = SLOT_NUMBERS
                .map((_, index) => index)
                .filter(index => !(mask & (1 << index)))
            const [leftIndex, rightIndex] = freeSlotIndexes
            const leftSetIds = new Set((candidatesBySlot[String(SLOT_NUMBERS[leftIndex])] ?? [])
                .map(disc => disc.setId)
                .filter(setId => setId && setId !== settings.fourPieceSetId))
            const rightSetIds = new Set((candidatesBySlot[String(SLOT_NUMBERS[rightIndex])] ?? [])
                .map(disc => disc.setId)
                .filter(setId => setId && setId !== settings.fourPieceSetId))
            const matchingSetIds = [...leftSetIds]
                .filter(setId => rightSetIds.has(setId))
                .sort((left, right) => String(left).localeCompare(String(right)))
            for (const extraSetId of matchingSetIds) {
                appendPlan(mask, extraSetId, "4+2")
            }
        }
        return plans
    }

    for (let mask = 0; mask <= allSlotsMask; mask += 1) {
        if (bitCount(mask) !== 4) {
            continue
        }
        for (const extraSetId of extraSetIds) {
            appendPlan(mask, extraSetId)
        }
    }

    return plans
}

function freeTwoPiecePlanMetrics(plans, settings) {
    if (hasTwoPieceLimit(settings)) {
        return {
            freeTwoPieceAutoSetCount: 0,
            freeFourTwoPlanCount: 0,
            freeSixPiecePlanCount: 0,
            freeFourTwoCombinationCount: 0,
            freeSixPieceCombinationCount: 0,
        }
    }
    const fourTwoPlans = plans.filter(plan => plan.freeTwoPieceMode === "4+2")
    const sixPiecePlans = plans.filter(plan => plan.freeTwoPieceMode === "6-piece")
    return {
        freeTwoPieceAutoSetCount: new Set(fourTwoPlans.map(plan => plan.extraSetId)).size,
        freeFourTwoPlanCount: fourTwoPlans.length,
        freeSixPiecePlanCount: sixPiecePlans.length,
        freeFourTwoCombinationCount: fourTwoPlans.reduce((total, plan) => total + Number(plan.combinationCount ?? 0), 0),
        freeSixPieceCombinationCount: sixPiecePlans.reduce((total, plan) => total + Number(plan.combinationCount ?? 0), 0),
    }
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
    const fourPieceIds = fourPieceBuffIds(catalog, settings.fourPieceSetId)
    const activeBuffIds = [
        ...(Array.isArray(source.activeBuffIds) ? source.activeBuffIds : [])
            .filter(id => !String(id).startsWith("driveDisc4pc:")),
        ...fourPieceIds,
    ]
    const runtimeInputs = source.runtimeInputs && typeof source.runtimeInputs === "object"
        ? Object.fromEntries(
            Object.entries(source.runtimeInputs)
                .filter(([key]) => !String(key).startsWith("driveDisc4pc:"))
        )
        : {}
    if (settings.fourPieceBuffMode === "manual") {
        const optimizerRuntimeInputs = settings.fourPieceBuffRuntimeInputs ?? {}
        for (const id of fourPieceIds) {
            const runtime = optimizerRuntimeInputs[id]
            if (runtime && typeof runtime === "object" && !Array.isArray(runtime)) {
                runtimeInputs[id] = runtime
            }
        }
    }

    return {
        ...source,
        activeBuffIds: [...new Set(activeBuffIds)],
        teammateDriveDiscSetIds: Array.isArray(source.teammateDriveDiscSetIds)
            ? source.teammateDriveDiscSetIds
            : [],
        manualStats: Array.isArray(source.manualStats) ? source.manualStats : [],
        runtimeInputs,
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
    const panel = result.outOfCombat?.panel ?? {}
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
    results.sort(compareTopResult)
    if (results.length > limit) {
        results.length = limit
    }
}

function shouldKeepTopCandidate(results, score, driveDiscs, limit = RESULT_LIMIT) {
    if (results.length < limit) {
        return true
    }

    const cutoff = results.at(-1)
    if (Number(score) > Number(cutoff.score) + SCORE_TIE_EPSILON) {
        return true
    }
    if (Number(score) + SCORE_TIE_EPSILON < Number(cutoff.score)) {
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

function defaultYieldControl() {
    return new Promise(resolve => {
        if (typeof setImmediate === "function") {
            setImmediate(resolve)
            return
        }
        setTimeout(resolve, 0)
    })
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

function createEmptySlotResult(settings, candidatesBySlot, emptySlots, reason = null) {
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
            seedBudgetUsed: 0,
            seedPlanCount: 0,
            seedBeamWidth: 0,
            skippedDiscBoundChecks: 0,
            skippedDiscBoundChecksByPolicy: 0,
            groupBoundChecks: 0,
            chunkBoundChecks: 0,
            discBoundChecks: 0,
            suffixTopKBoundChecks: 0,
            boundOracleChecks: 0,
            safeBoundFallbacks: 0,
            avgBoundCheckMs: 0,
            boundChecksPerSecond: 0,
            indexedScoreEnabled: false,
            scoreKernel: "map",
            scoreKernelProbeMs: 0,
            scoreKernelMapProbeMs: 0,
            scoreKernelDenseProbeMs: 0,
            scoreKernelProbeCount: 0,
            scoreKernelFallbackReason: null,
            avgScoreKernelMs: 0,
            denseScoreCalls: 0,
            denseScoreMs: 0,
            denseScoreMsSamples: 0,
            specializedScoreCalls: 0,
            specializedScorePlanCount: 0,
            specializedScoreKernelCount: 0,
            specializedScoreKernelCacheHits: 0,
            specializedScoreFallbacks: 0,
            specializedScoreFallbackReason: null,
            objectiveScalarCalls: 0,
            objectiveScalarPlanCount: 0,
            objectiveScalarFallbacks: 0,
            objectiveScalarFallbackReason: null,
            boundCheckMsSamples: 0,
            suffixFrontierBuildMs: 0,
            suffixFrontierRawCount: 0,
            suffixFrontierCompressedCount: 0,
            suffixFrontierScoreCalls: 0,
            freeTwoPieceAutoSetCount: 0,
            freeFourTwoPlanCount: 0,
            freeSixPiecePlanCount: 0,
            freeFourTwoCombinationCount: 0,
            freeSixPieceCombinationCount: 0,
            freeSpecializedScorePlanCount: 0,
            scratchBufferReuses: 0,
            vectorScoreCalls: 0,
            vectorScoreFallbacks: 0,
            vectorScoreMs: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            prunedBySuperBound: 0,
            prunedByChunkBound: 0,
            prunedBySuffixTopKBound: 0,
            prunedByGlobalCutoff: 0,
            superBoundChecks: 0,
            parallelTaskCount: 0,
            browserWorkerCount: 0,
            parallelFallbackReason: null,
            completedTaskCount: 0,
            taskStealCount: 0,
            workerIdleMs: 0,
            workerIdleRatio: 0,
            slowestWorkerMs: 0,
            workerStartupMs: 0,
            taskDispatchMs: 0,
            globalCutoffUpdates: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
        error: {
            isError: true,
            reason: reason ?? `没有符合筛选条件的 ${emptySlots.join(", ")} 号位驱动盘。`,
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
        if (Number.isFinite(upperBound) && upperBound + SCORE_TIE_EPSILON < cutoff) {
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

function buildSuperBoundChunks(discs, state, chunkSize = SUPER_BOUND_CHUNK_SIZE) {
    if (!Array.isArray(discs) || discs.length <= chunkSize) {
        return []
    }
    const chunks = []
    for (let start = 0; start < discs.length; start += chunkSize) {
        const chunkDiscs = discs.slice(start, start + chunkSize)
        const superVector = maxVectorForDiscs(chunkDiscs, state.vectorById)
        chunks.push({
            start,
            end: start + chunkDiscs.length,
            discs: chunkDiscs,
            superVector,
            indexedSuperVector: mapToIndexedVector(superVector, state.statIndexById ?? new Map()),
        })
    }
    return chunks
}

function adaptiveSuperBoundChunkSize(discs) {
    const count = Number(discs?.length ?? 0)
    if (count <= SUPER_BOUND_CHUNK_SIZE) {
        return SUPER_BOUND_CHUNK_SIZE
    }
    if (count <= 24) {
        return 4
    }
    if (count >= 96) {
        return 16
    }
    return SUPER_BOUND_CHUNK_SIZE
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
    return !plan.extraSetId && !hasTwoPieceLimit(settings) && (SLOT_NUMBERS.length - bitCount(plan.mask)) >= 2
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

function suffixIndexedSuperVectors(orderedSlots, statCount) {
    const suffix = Array.from({ length: orderedSlots.length + 1 }, () => new Float64Array(statCount))
    for (let index = orderedSlots.length - 1; index >= 0; index -= 1) {
        suffix[index] = new Float64Array(suffix[index + 1])
        addIndexedVectorToTotals(suffix[index], orderedSlots[index].indexedSuperVector, 1)
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

function compileSpecializedPlanScoreKernel(state, setCountValues, orderedSlots) {
    const target = state.densePanelScoreTarget
    if (!state.settings.enableSpecializedScoreKernel || !state.useCompiledDenseScore || typeof target?.compileForSetCounts !== "function") {
        return null
    }
    const cacheKey = Array.from(setCountValues ?? [])
        .map((count, index) => Number(count) > 0 ? `${index}:${Number(count)}` : "")
        .filter(Boolean)
        .join("|")
    if (state.specializedScoreKernelCache?.has(cacheKey)) {
        state.metrics.specializedScoreKernelCacheHits += 1
        const cached = state.specializedScoreKernelCache.get(cacheKey)
        if (cached) {
            state.metrics.specializedScorePlanCount += 1
        }
        return cached
    }
    try {
        const baseCompiled = target.compileForSetCounts(setCountValues)
        if (typeof baseCompiled?.scoreScalar !== "function") {
            state.specializedScoreKernelCache?.set(cacheKey, null)
            return null
        }
        const useObjectiveScalar = state.settings.enableObjectiveScalarKernel
            && state.minimumPanelChecks?.length === 0
            && typeof baseCompiled.scoreObjectiveScalar === "function"
        const compiled = useObjectiveScalar
            ? {
                ...baseCompiled,
                scoreKernel: "objective-scalar",
                scoreScalar: baseCompiled.scoreObjectiveScalar,
                scoreCombinedScalar: baseCompiled.scoreCombinedScalar,
            }
            : {
                ...baseCompiled,
                scoreCombinedScalar: null,
            }
        if (state.settings.enableObjectiveScalarKernel && !useObjectiveScalar) {
            state.metrics.objectiveScalarFallbacks += 1
            state.metrics.objectiveScalarFallbackReason = state.minimumPanelChecks?.length
                ? "minimum-panel"
                : "unsupported-objective"
        }
        const probes = [new Float64Array(state.statIds?.length ?? 0)]
        const representative = new Float64Array(state.statIds?.length ?? 0)
        for (const slotEntry of orderedSlots ?? []) {
            const disc = slotEntry.groups?.[0]?.discs?.[0]
            if (disc) {
                addIndexedVectorToTotals(representative, state.indexedVectorById?.get(disc.id), 1)
            }
        }
        probes.push(representative)
        for (const statValues of probes) {
            const genericSummary = target.scoreDense(statValues, setCountValues)
            const specializedSummary = compiled.scoreScalar(statValues)
            if (!scoreOnlySummariesMatch(
                genericSummary,
                specializedSummary,
                target.panelStatIds ?? [],
                state.minimumPanelChecks?.length > 0,
            )) {
                state.metrics.specializedScoreFallbacks += 1
                state.metrics.specializedScoreFallbackReason = "mismatch"
                state.specializedScoreKernelCache?.set(cacheKey, null)
                return null
            }
        }
        state.metrics.specializedScorePlanCount += 1
        state.metrics.specializedScoreKernelCount += 1
        if (useObjectiveScalar) {
            state.metrics.objectiveScalarPlanCount += 1
        }
        state.specializedScoreKernelCache?.set(cacheKey, compiled)
        return compiled
    } catch (error) {
        state.metrics.specializedScoreFallbacks += 1
        state.metrics.specializedScoreFallbackReason = error?.message || "error"
        state.specializedScoreKernelCache?.set(cacheKey, null)
        return null
    }
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
            const superVector = maxVectorForDiscs(sortedDiscs, state.vectorById)
            const potentials = sortedDiscs.map(disc =>
                candidatePotential(disc, state.vectorById.get(disc.id) ?? new Map(), state.potentialWeights)
            )
            const bestPotentialScore = Math.max(0, ...potentials)
            const worstPotentialScore = Math.min(bestPotentialScore, ...potentials)
            return {
                mainStat,
                discs: sortedDiscs,
                superVector,
                indexedSuperVector: mapToIndexedVector(superVector, state.statIndexById ?? new Map()),
                chunks: buildSuperBoundChunks(sortedDiscs, state, adaptiveSuperBoundChunkSize(sortedDiscs)),
                bestPotentialScore,
                potentialSpread: bestPotentialScore - worstPotentialScore,
            }
        }).sort((left, right) =>
            right.bestPotentialScore - left.bestPotentialScore
            || right.potentialSpread - left.potentialSpread
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
            indexedSuperVector: mapToIndexedVector(superVector, state.statIndexById ?? new Map()),
            bestPotentialScore: groups.reduce((total, group) => total + group.bestPotentialScore, 0),
            potentialSpread: Math.max(0, ...groups.map(group => group.potentialSpread ?? 0)),
        }
    })

    const orderedSlots = [...slotEntries].sort((left, right) =>
        left.candidateCount - right.candidateCount
        || left.groupCount - right.groupCount
        || right.potentialSpread - left.potentialSpread
        || right.bestPotentialScore - left.bestPotentialScore
        || left.slot - right.slot
    )

    const maxFreeTwoPieceCount = maxOptimisticFreeTwoPieceCount(plan, state.settings)
    const completeSetCounts = superPlanSetCounts(plan, state.settings)
    const freeTwoPieceOptimisticEntries = maxFreeTwoPieceCount > 0
        ? state.optimisticTwoPieceStatEntriesByActiveCount?.[String(maxFreeTwoPieceCount)] ?? null
        : []
    const completeSetCountsArray = setCountsMapToArray(completeSetCounts, state.setIndexById ?? new Map(), state.setIds?.length ?? 0)
    const specializedScoreKernel = maxFreeTwoPieceCount === 0
        ? compileSpecializedPlanScoreKernel(state, completeSetCountsArray, orderedSlots)
        : null
    if (plan.freeTwoPieceMode && specializedScoreKernel) {
        state.metrics.freeSpecializedScorePlanCount += 1
    }
    return {
        ...plan,
        completeSetCounts,
        completeSetCountsArray,
        specializedScoreKernel,
        needsOptimisticFreeTwoPiece: maxFreeTwoPieceCount > 0,
        maxFreeTwoPieceCount,
        freeTwoPieceOptimisticEntries,
        indexedFreeTwoPieceOptimisticEntries: entriesToIndexedVector(freeTwoPieceOptimisticEntries ?? [], state.statIndexById ?? new Map()),
        orderedSlots,
        suffixSuperVectors: suffixSuperVectors(orderedSlots),
        suffixIndexedSuperVectors: suffixIndexedSuperVectors(orderedSlots, state.statIds?.length ?? 0),
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

function restrictedSlotEntryForGroup(slotEntry, groupIndex, state, discSlice = null) {
    const index = Number(groupIndex)
    if (!Number.isInteger(index) || index < 0 || index >= (slotEntry.groups?.length ?? 0)) {
        return null
    }
    const sourceGroup = slotEntry.groups[index]
    const totalDiscs = sourceGroup.discs?.length ?? 0
    const start = Math.max(0, Number(discSlice?.start ?? 0))
    const end = Math.min(totalDiscs, Number(discSlice?.end ?? totalDiscs))
    const discs = discSlice
        ? (sourceGroup.discs ?? []).slice(start, Math.max(start, end))
        : sourceGroup.discs
    if (!discs?.length) {
        return null
    }
    const superVector = discSlice
        ? maxVectorForDiscs(discs, state.vectorById)
        : sourceGroup.superVector
    const group = {
        ...sourceGroup,
        discs,
        superVector,
        indexedSuperVector: discSlice
            ? mapToIndexedVector(superVector, state.statIndexById ?? new Map())
            : sourceGroup.indexedSuperVector,
        chunks: discSlice
            ? buildSuperBoundChunks(discs, state, adaptiveSuperBoundChunkSize(discs))
            : sourceGroup.chunks,
    }
    return {
        ...slotEntry,
        groups: [group],
        candidateCount: group.discs?.length ?? 0,
        groupCount: 1,
        superVector: group.superVector,
        indexedSuperVector: group.indexedSuperVector,
        bestPotentialScore: group.bestPotentialScore ?? slotEntry.bestPotentialScore ?? 0,
    }
}

function rebuildSuperPlanDerivedFields(plan, orderedSlots, state) {
    return {
        ...plan,
        orderedSlots,
        suffixSuperVectors: suffixSuperVectors(orderedSlots),
        suffixIndexedSuperVectors: suffixIndexedSuperVectors(orderedSlots, state.statIds?.length ?? 0),
        suffixCandidateProducts: suffixCandidateProducts(orderedSlots),
        groupCombinationCount: orderedSlots.reduce((product, entry) => product * Math.max(1, Number(entry.groupCount ?? 0)), 1),
        combinationCount: orderedSlots.reduce((product, entry) => product * Math.max(1, Number(entry.candidateCount ?? 0)), 1),
        bestPotentialScore: orderedSlots.reduce((total, entry) => total + Number(entry.bestPotentialScore ?? 0), 0),
    }
}

function restrictSuperPlanForTask(plan, task = {}, state) {
    const groupPath = Array.isArray(task.groupPath) ? task.groupPath : []
    const discSlices = task.discSlices && typeof task.discSlices === "object" ? task.discSlices : {}
    if (!groupPath.length && !Object.keys(discSlices).length) {
        return plan
    }

    const orderedSlots = []
    for (let index = 0; index < (plan.orderedSlots?.length ?? 0); index += 1) {
        const slotEntry = plan.orderedSlots[index]
        const discSlice = discSlices[String(index)] ?? null
        if (index < groupPath.length || discSlice) {
            const groupIndex = index < groupPath.length
                ? groupPath[index]
                : discSlice?.groupIndex
            const restricted = restrictedSlotEntryForGroup(slotEntry, groupIndex, state, discSlice)
            if (!restricted) {
                return null
            }
            orderedSlots.push(restricted)
        } else {
            orderedSlots.push(slotEntry)
        }
    }
    return rebuildSuperPlanDerivedFields(plan, orderedSlots, state)
}

function taskDiscSlice(task, orderIndex) {
    return task?.discSlices?.[String(orderIndex)] ?? null
}

function taskGroupForOrderIndex(plan, task, orderIndex) {
    const slotEntry = plan?.orderedSlots?.[orderIndex]
    if (!slotEntry?.groups?.length) {
        return null
    }
    const slice = taskDiscSlice(task, orderIndex)
    const groupIndex = Number.isInteger(Number(task.groupPath?.[orderIndex]))
        ? Number(task.groupPath[orderIndex])
        : Number.isInteger(Number(slice?.groupIndex))
            ? Number(slice.groupIndex)
            : slotEntry.groups.length === 1
                ? 0
                : null
    if (groupIndex === null || groupIndex < 0 || groupIndex >= slotEntry.groups.length) {
        return null
    }
    return {
        slotEntry,
        groupIndex,
        group: slotEntry.groups[groupIndex],
        slice,
    }
}

function taskDiscCountForOrderIndex(plan, task, orderIndex) {
    const info = taskGroupForOrderIndex(plan, task, orderIndex)
    if (!info) {
        return 0
    }
    const total = info.group.discs?.length ?? 0
    const start = Math.max(0, Number(info.slice?.start ?? 0))
    const end = Math.min(total, Number(info.slice?.end ?? total))
    return Math.max(0, end - start)
}

function estimateTaskLeafCount(plan, taskOrGroupPath = []) {
    if (!plan?.orderedSlots?.length) {
        return 0
    }
    const task = Array.isArray(taskOrGroupPath) ? { groupPath: taskOrGroupPath } : taskOrGroupPath
    return plan.orderedSlots.reduce((product, slotEntry, index) => {
        const groupIndex = task.groupPath?.[index]
        if (Number.isInteger(Number(groupIndex))) {
            return product * taskDiscCountForOrderIndex(plan, task, index)
        }
        if (taskDiscSlice(task, index)) {
            return product * taskDiscCountForOrderIndex(plan, task, index)
        }
        return product * Math.max(1, Number(slotEntry.candidateCount ?? 0))
    }, 1)
}

function splitParallelTaskOnce(plan, task) {
    const nextSlot = plan?.orderedSlots?.[task.groupPath?.length ?? 0]
    if (!nextSlot?.groups?.length || nextSlot.groups.length <= 1) {
        return null
    }
    return nextSlot.groups.map((group, groupIndex) => {
        const groupPath = [...(task.groupPath ?? []), groupIndex]
        return {
            ...task,
            groupPath,
            estimatedLeafCount: estimateTaskLeafCount(plan, { ...task, groupPath }),
            bestPotentialScore: Number(task.bestPotentialScore ?? 0)
                + Number(group.bestPotentialScore ?? 0),
        }
    }).filter(item => Number(item.estimatedLeafCount ?? 0) > 0)
}

function splitParallelTaskByDisc(plan, task, targetLeafCount) {
    let splitOrderIndex = -1
    let splitCount = 0
    let splitInfo = null
    for (let orderIndex = 0; orderIndex < (plan?.orderedSlots?.length ?? 0); orderIndex += 1) {
        const info = taskGroupForOrderIndex(plan, task, orderIndex)
        if (!info) {
            continue
        }
        const count = taskDiscCountForOrderIndex(plan, task, orderIndex)
        if (count > splitCount) {
            splitCount = count
            splitOrderIndex = orderIndex
            splitInfo = info
        }
    }
    if (!splitInfo || splitOrderIndex < 0 || splitCount <= 1) {
        return null
    }

    const total = splitInfo.group.discs?.length ?? 0
    const currentStart = Math.max(0, Number(splitInfo.slice?.start ?? 0))
    const currentEnd = Math.min(total, Number(splitInfo.slice?.end ?? total))
    const desiredChunks = Math.max(2, Math.min(16, Math.ceil(Number(task.estimatedLeafCount ?? 0) / Math.max(1, targetLeafCount))))
    const chunkSize = Math.max(1, Math.ceil(splitCount / desiredChunks))
    const children = []
    for (let start = currentStart; start < currentEnd; start += chunkSize) {
        const end = Math.min(currentEnd, start + chunkSize)
        const discSlices = {
            ...(task.discSlices ?? {}),
            [String(splitOrderIndex)]: {
                groupIndex: splitInfo.groupIndex,
                start,
                end,
            },
        }
        children.push({
            ...task,
            discSlices,
            estimatedLeafCount: estimateTaskLeafCount(plan, { ...task, discSlices }),
        })
    }
    return children.filter(item => Number(item.estimatedLeafCount ?? 0) > 0)
}

function isSplittableParallelTask(plansByIndex, task, maxDepth) {
    if ((task.groupPath?.length ?? 0) >= maxDepth) {
        return false
    }
    const plan = plansByIndex.get(Number(task.superPlanIndex))
    const nextSlot = plan?.orderedSlots?.[task.groupPath?.length ?? 0]
    return (nextSlot?.groups?.length ?? 0) > 1
}

function parallelTaskScheduleScore(task) {
    const potential = Math.max(0, Number(task.bestPotentialScore ?? 0))
    const leafCount = Math.max(1, Number(task.estimatedLeafCount ?? 1))
    return potential / (Math.log2(leafCount + 2) + 1)
}

function buildParallelTasks(state, workerCount = 1) {
    const plans = state.superBoundPlans ?? []
    if (!plans.length) {
        return []
    }

    const totalEstimate = Number(state.metrics?.estimatedCombinationCount ?? 0)
    const targetTaskCount = Math.max(16, Number(workerCount ?? 1) * 32)
    const maxTaskCount = Math.max(targetTaskCount, Math.min(1024, Number(workerCount ?? 1) * 96))
    const targetLeafCount = Math.max(10_000, Math.ceil(totalEstimate / Math.max(1, Number(workerCount ?? 1) * 64)))
    const maxDepth = 3
    const plansByIndex = new Map(plans.map((plan, index) => [Number(plan.parallelPlanIndex ?? index), plan]))
    let tasks = []
    for (const [planIndex, plan] of plans.entries()) {
        const firstSlot = plan.orderedSlots?.[0]
        if (!firstSlot?.groups?.length) {
            tasks.push({
                superPlanIndex: plan.parallelPlanIndex ?? planIndex,
                groupPath: [],
                estimatedLeafCount: Number(plan.combinationCount ?? 0),
                bestPotentialScore: Number(plan.bestPotentialScore ?? 0),
            })
            continue
        }
        for (let groupIndex = 0; groupIndex < firstSlot.groups.length; groupIndex += 1) {
            const group = firstSlot.groups[groupIndex]
            tasks.push({
                superPlanIndex: plan.parallelPlanIndex ?? planIndex,
                groupPath: [groupIndex],
                estimatedLeafCount: estimateTaskLeafCount(plan, { groupPath: [groupIndex] }),
                bestPotentialScore: Number(group.bestPotentialScore ?? 0) + Number(plan.bestPotentialScore ?? 0),
            })
        }
    }

    while (tasks.length < maxTaskCount) {
        let splitIndex = -1
        let splitScore = Number.NEGATIVE_INFINITY
        let splitKind = ""
        for (let index = 0; index < tasks.length; index += 1) {
            const task = tasks[index]
            const leafCount = Number(task.estimatedLeafCount ?? 0)
            const shouldSplit = leafCount > targetLeafCount || tasks.length < targetTaskCount
            if (!shouldSplit) {
                continue
            }
            const plan = plansByIndex.get(Number(task.superPlanIndex))
            const canSplitByGroup = isSplittableParallelTask(plansByIndex, task, maxDepth)
            const canSplitByDisc = Boolean(splitParallelTaskByDisc(plan, task, targetLeafCount)?.length)
            if (!canSplitByGroup && !canSplitByDisc) {
                continue
            }
            if (leafCount > splitScore) {
                splitScore = leafCount
                splitIndex = index
                splitKind = canSplitByGroup ? "group" : "disc"
            }
        }
        if (splitIndex < 0) {
            break
        }
        const task = tasks[splitIndex]
        const plan = plansByIndex.get(Number(task.superPlanIndex))
        const children = splitKind === "group"
            ? splitParallelTaskOnce(plan, task)
            : splitParallelTaskByDisc(plan, task, targetLeafCount)
        if (!children?.length) {
            break
        }
        tasks.splice(splitIndex, 1, ...children)
    }

    return tasks
        .filter(task => Number(task.estimatedLeafCount ?? 0) > 0)
        .sort((left, right) =>
            parallelTaskScheduleScore(right) - parallelTaskScheduleScore(left)
            || Number(left.estimatedLeafCount ?? 0) - Number(right.estimatedLeafCount ?? 0)
            || Number(right.bestPotentialScore ?? 0) - Number(left.bestPotentialScore ?? 0)
            || Number(left.superPlanIndex ?? 0) - Number(right.superPlanIndex ?? 0)
            || JSON.stringify(left.groupPath ?? []).localeCompare(JSON.stringify(right.groupPath ?? []))
        )
        .map((task, taskId) => ({ ...task, taskId }))
}

function scoreOnlyFromMaps(state, statTotals, setCounts) {
    return (state.panelCalculator.scoreOnlyFromSummary ?? state.panelCalculator.scoreFromSummary)
        .call(state.panelCalculator, statTotals, setCounts)
}

function scoreOnlyFromIndexedState(state, statValues, setCountValues) {
    const startedAt = nowMs()
    state.metrics.vectorScoreCalls += 1
    try {
        if (typeof state.panelCalculator.scoreOnlyFromIndexedSummary === "function") {
            return state.panelCalculator.scoreOnlyFromIndexedSummary(
                statValues,
                state.statIds,
                setCountValues,
                state.setIds,
                state.setIndexById,
            )
        }
        state.metrics.vectorScoreFallbacks += 1
        return scoreOnlyFromMaps(
            state,
            indexedStatTotalsToMap(statValues, state.statIds ?? []),
            indexedSetCountsToMap(setCountValues, state.setIds ?? []),
        )
    } finally {
        addMetricTime(state.metrics, "vectorScoreMs", startedAt)
    }
}

function scoreOnlyFromDenseState(state, statValues, setCountValues, specializedScoreKernel = null) {
    const callCount = Number(state.metrics.denseScoreCalls ?? 0) + 1
    state.metrics.denseScoreCalls = callCount
    const sample = hotMetricSample(state.metrics, "denseScoreMs", callCount)
    try {
        if (typeof specializedScoreKernel?.scoreScalar === "function") {
            state.metrics.specializedScoreCalls += 1
            if (specializedScoreKernel.scoreKernel === "objective-scalar") {
                state.metrics.objectiveScalarCalls += 1
            }
            return specializedScoreKernel.scoreScalar(statValues)
        }
        if (state.densePanelScoreTarget && typeof state.densePanelScoreTarget.scoreDense === "function") {
            return state.densePanelScoreTarget.scoreDense(statValues, setCountValues)
        }
        return scoreOnlyFromMaps(
            state,
            indexedStatTotalsToMap(statValues, state.statIds ?? []),
            indexedSetCountsToMap(setCountValues, state.setIds ?? []),
        )
    } finally {
        finishHotMetricSample(state.metrics, "denseScoreMs", sample)
    }
}

function selectedDiscsInSlotOrder(state) {
    return [...state.selected].sort((left, right) =>
        Number(left.partition) - Number(right.partition)
        || sourceOrder(left) - sourceOrder(right)
        || String(left.id).localeCompare(String(right.id))
    )
}

function scoreSelectedDiscsInSlotOrder(state) {
    const statTotals = new Map()
    const setCounts = new Map()
    for (const disc of selectedDiscsInSlotOrder(state)) {
        addDiscVectorToTotals(statTotals, state.vectorById.get(disc.id) ?? statVector(disc), 1)
        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
    }
    return scoreOnlyFromMaps(state, statTotals, setCounts)
}

function selectedScoreOnlySummary(state) {
    if (usesSuperBoundAlgorithm(state.settings.algorithm)) {
        return scoreSelectedDiscsInSlotOrder(state)
    }
    if (state.useCompiledDenseScore && state.selectedStatValues && state.selectedSetCountValues) {
        return scoreOnlyFromDenseState(state, state.selectedStatValues, state.selectedSetCountValues)
    }
    if (state.useIndexedSearch && state.selectedStatValues && state.selectedSetCountValues) {
        return scoreOnlyFromIndexedState(state, state.selectedStatValues, state.selectedSetCountValues)
    }
    return scoreOnlyFromMaps(state, state.selectedStatTotals, state.selectedSetCounts)
}

function denseBoundScratch(state, nextOrderIndex) {
    const source = state.selectedStatValues
    if (!source) {
        return null
    }
    const index = Math.max(0, Math.min(6, Number(nextOrderIndex ?? 0)))
    if (!state.boundScratchBuffers) {
        state.boundScratchBuffers = []
    }
    let scratch = state.boundScratchBuffers[index]
    if (!scratch || scratch.length !== source.length) {
        scratch = new Float64Array(source.length)
        state.boundScratchBuffers[index] = scratch
    } else {
        state.metrics.scratchBufferReuses += 1
    }
    scratch.set(source)
    return scratch
}

function superBoundScoreDense(state, superPlan, nextOrderIndex, branchIndexedSuperVector = null, scoreFn = scoreOnlyFromDenseState) {
    if (superPlan.needsOptimisticFreeTwoPiece && !superPlan.freeTwoPieceOptimisticEntries) {
        return Number.POSITIVE_INFINITY
    }

    const boundCallCount = Number(state.metrics.superBoundChecks ?? 0) + 1
    const sample = hotMetricSample(state.metrics, "boundCheckMs", boundCallCount)
    try {
        if (scoreFn === scoreOnlyFromDenseState && typeof superPlan.specializedScoreKernel?.scoreCombinedScalar === "function") {
            state.metrics.superBoundChecks += 1
            state.metrics.upperBoundChecks += 1
            const scoreCallCount = Number(state.metrics.denseScoreCalls ?? 0) + 1
            state.metrics.denseScoreCalls = scoreCallCount
            state.metrics.specializedScoreCalls += 1
            state.metrics.objectiveScalarCalls += 1
            const scoreSample = hotMetricSample(state.metrics, "denseScoreMs", scoreCallCount)
            let summary
            try {
                summary = superPlan.specializedScoreKernel.scoreCombinedScalar(
                    state.selectedStatValues,
                    branchIndexedSuperVector,
                    superPlan.suffixIndexedSuperVectors?.[nextOrderIndex],
                    superPlan.needsOptimisticFreeTwoPiece ? superPlan.indexedFreeTwoPieceOptimisticEntries : null,
                )
            } finally {
                finishHotMetricSample(state.metrics, "denseScoreMs", scoreSample)
            }
            if (!passesMinimumScoreSummary(summary, state)) {
                return Number.NEGATIVE_INFINITY
            }
            return Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
        }

        const statTotals = denseBoundScratch(state, nextOrderIndex)
        if (!statTotals) {
            return Number.POSITIVE_INFINITY
        }
        if (branchIndexedSuperVector) {
            addIndexedVectorToTotals(statTotals, branchIndexedSuperVector, 1)
        }
        addDenseVectorToTotals(statTotals, superPlan.suffixIndexedSuperVectors?.[nextOrderIndex], 1)
        if (superPlan.needsOptimisticFreeTwoPiece) {
            addIndexedVectorToTotals(statTotals, superPlan.indexedFreeTwoPieceOptimisticEntries, 1)
        }

        state.metrics.superBoundChecks += 1
        state.metrics.upperBoundChecks += 1
        const summary = scoreFn === scoreOnlyFromDenseState
            ? scoreOnlyFromDenseState(
                state,
                statTotals,
                superPlan.completeSetCountsArray ?? new Int16Array(),
                superPlan.specializedScoreKernel,
            )
            : scoreFn(state, statTotals, superPlan.completeSetCountsArray ?? new Int16Array())
        if (!passesMinimumScoreSummary(summary, state)) {
            return Number.NEGATIVE_INFINITY
        }
        return Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
    } finally {
        finishHotMetricSample(state.metrics, "boundCheckMs", sample)
    }
}

function superBoundScoreIndexed(state, superPlan, nextOrderIndex, branchIndexedSuperVector = null) {
    return superBoundScoreDense(state, superPlan, nextOrderIndex, branchIndexedSuperVector, scoreOnlyFromIndexedState)
}

function superBoundScore(state, superPlan, nextOrderIndex, branchSuperVector = null) {
    if (state.useCompiledDenseScore && state.selectedStatValues && superPlan.completeSetCountsArray) {
        return superBoundScoreDense(
            state,
            superPlan,
            nextOrderIndex,
            branchSuperVector?.indexes ? branchSuperVector : mapToIndexedVector(branchSuperVector, state.statIndexById ?? new Map()),
            scoreOnlyFromDenseState,
        )
    }

    if (state.useIndexedSearch && state.selectedStatValues && superPlan.completeSetCountsArray) {
        return superBoundScoreIndexed(
            state,
            superPlan,
            nextOrderIndex,
            branchSuperVector?.indexes ? branchSuperVector : mapToIndexedVector(branchSuperVector, state.statIndexById ?? new Map()),
        )
    }

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
        const summary = scoreOnlyFromMaps(state, statTotals, superPlan.completeSetCounts)
        if (!passesMinimumScoreSummary(summary, state)) {
            return Number.NEGATIVE_INFINITY
        }
        return Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
    } finally {
        addMetricTime(state.metrics, "boundCheckMs", startedAt)
    }
}

function usableBoundScore(value) {
    return Number.isFinite(Number(value)) || Number(value) === Number.NEGATIVE_INFINITY
}

function shouldRunSuffixTopKBound(state, kind, prunedLeafCount, upperBound, cutoff) {
    if (kind !== "disc") {
        return false
    }
    const leafCount = Number(prunedLeafCount ?? 0)
    if (!Number.isFinite(leafCount) || leafCount < 2) {
        return false
    }
    if (leafCount > SUFFIX_TOPK_BOUND_MAX_LEAVES) {
        if (Number.isFinite(upperBound) && Number.isFinite(cutoff) && upperBound <= cutoff * 1.25) {
            state.metrics.safeBoundFallbacks += 1
        }
        return false
    }
    if (!state.useDenseSearchState && leafCount > 24) {
        state.metrics.safeBoundFallbacks += 1
        return false
    }
    if (!Number.isFinite(upperBound) || !Number.isFinite(cutoff) || cutoff <= 0) {
        return false
    }
    return leafCount <= 24 || upperBound <= cutoff * 1.5
}

function denseVectorDominates(left, right, relevantIndexes) {
    let strictlyBetter = false
    for (const index of relevantIndexes) {
        const leftValue = Number(left[index] ?? 0)
        const rightValue = Number(right[index] ?? 0)
        if (leftValue < rightValue) {
            return false
        }
        if (leftValue > rightValue) {
            strictlyBetter = true
        }
    }
    return strictlyBetter
}

function compressSuffixFrontier(vectors, relevantIndexes) {
    if (!relevantIndexes?.length || vectors.length < 2) {
        return vectors
    }
    const unique = []
    const signatures = new Set()
    for (const vector of vectors) {
        const signature = relevantIndexes.map(index => Number(vector[index] ?? 0)).join("|")
        if (!signatures.has(signature)) {
            signatures.add(signature)
            unique.push(vector)
        }
    }
    return unique.filter((vector, index) =>
        !unique.some((candidate, candidateIndex) =>
            candidateIndex !== index && denseVectorDominates(candidate, vector, relevantIndexes)
        )
    )
}

function suffixFrontierForPlan(state, superPlan, nextOrderIndex, maxLeaves) {
    const leafCount = Number(superPlan.suffixCandidateProducts?.[nextOrderIndex] ?? 0)
    if (
        !state.settings.enableSuffixFrontierCache
        || superPlan.needsOptimisticFreeTwoPiece
        || !state.useDenseSearchState
        || leafCount < 1
        || leafCount > maxLeaves
    ) {
        return null
    }
    if (!superPlan.suffixFrontierCache) {
        superPlan.suffixFrontierCache = new Map()
    }
    if (superPlan.suffixFrontierCache.has(nextOrderIndex)) {
        return superPlan.suffixFrontierCache.get(nextOrderIndex)
    }

    const startedAt = nowMs()
    const scratch = new Float64Array(state.statIds?.length ?? 0)
    const vectors = []
    function walk(orderIndex) {
        if (orderIndex >= superPlan.orderedSlots.length) {
            vectors.push(new Float64Array(scratch))
            return
        }
        const slotEntry = superPlan.orderedSlots[orderIndex]
        for (const group of slotEntry.groups) {
            for (const disc of group.discs) {
                const indexedVector = state.indexedVectorById?.get(disc.id)
                addIndexedVectorToTotals(scratch, indexedVector, 1)
                walk(orderIndex + 1)
                addIndexedVectorToTotals(scratch, indexedVector, -1)
            }
        }
    }
    walk(nextOrderIndex)
    const frontier = state.settings.enableSuffixFrontierDominance && state.optimizerStatMetadata?.strictMonotonic
        ? compressSuffixFrontier(vectors, state.relevantStatIndexes)
        : vectors
    state.metrics.suffixFrontierRawCount += vectors.length
    state.metrics.suffixFrontierCompressedCount += frontier.length
    addMetricTime(state.metrics, "suffixFrontierBuildMs", startedAt)
    superPlan.suffixFrontierCache.set(nextOrderIndex, frontier)
    return frontier
}

function suffixTopKReachableBoundScore(state, superPlan, nextOrderIndex, maxLeaves = SUFFIX_TOPK_BOUND_MAX_LEAVES) {
    const leafBudget = Math.max(1, Number(maxLeaves ?? SUFFIX_TOPK_BOUND_MAX_LEAVES))
    let leaves = 0
    let best = Number.NEGATIVE_INFINITY
    state.metrics.suffixTopKBoundChecks += 1

    const suffixFrontier = suffixFrontierForPlan(state, superPlan, nextOrderIndex, leafBudget)
    if (suffixFrontier) {
        if (!state.suffixScoreScratchBuffers) {
            state.suffixScoreScratchBuffers = []
        }
        let scratch = state.suffixScoreScratchBuffers[nextOrderIndex]
        if (!scratch || scratch.length !== state.selectedStatValues.length) {
            scratch = new Float64Array(state.selectedStatValues.length)
            state.suffixScoreScratchBuffers[nextOrderIndex] = scratch
        }
        for (const suffixVector of suffixFrontier) {
            scratch.set(state.selectedStatValues)
            addDenseVectorToTotals(scratch, suffixVector, 1)
            state.metrics.boundOracleChecks += 1
            state.metrics.suffixFrontierScoreCalls += 1
            const summary = scoreOnlyFromDenseState(
                state,
                scratch,
                superPlan.completeSetCountsArray,
                superPlan.specializedScoreKernel,
            )
            const rawScore = Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
            const score = Number.isFinite(rawScore)
                ? Number(rawScore.toFixed(12)) + SUFFIX_TOPK_SCORE_SAFETY_EPSILON
                : rawScore
            if (score > best) {
                best = score
            }
        }
        return best
    }

    function walk(orderIndex) {
        if (leaves > leafBudget) {
            return false
        }
        if (orderIndex >= superPlan.orderedSlots.length) {
            leaves += 1
            state.metrics.boundOracleChecks += 1
            const summary = state.useDenseSearchState && state.selectedStatValues && state.selectedSetCountValues
                ? scoreOnlyFromDenseState(
                    state,
                    state.selectedStatValues,
                    state.selectedSetCountValues,
                    superPlan.specializedScoreKernel,
                )
                : selectedScoreOnlySummary(state)
            const rawScore = Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY)
            const score = Number.isFinite(rawScore)
                ? Number(rawScore.toFixed(12)) + SUFFIX_TOPK_SCORE_SAFETY_EPSILON
                : rawScore
            if (score > best) {
                best = score
            }
            return leaves <= leafBudget
        }

        const slotEntry = superPlan.orderedSlots[orderIndex]
        for (const group of slotEntry.groups) {
            for (const disc of group.discs) {
                pushSelectedDisc(state, disc)
                const completed = walk(orderIndex + 1)
                popSelectedDisc(state)
                if (!completed) {
                    return false
                }
            }
        }
        return true
    }

    try {
        if (!walk(nextOrderIndex)) {
            state.metrics.safeBoundFallbacks += 1
            return null
        }
        return best
    } catch {
        state.metrics.safeBoundFallbacks += 1
        return null
    }
}

function finiteScoreOrNegativeInfinity(value) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : Number.NEGATIVE_INFINITY
}

function resultCutoffScore(state) {
    return state.results.length >= RESULT_LIMIT
        ? Number(state.results.at(-1)?.score ?? Number.NEGATIVE_INFINITY)
        : Number.NEGATIVE_INFINITY
}

function pruningCutoffScoreParts(state) {
    return {
        resultCutoff: resultCutoffScore(state),
        seedCutoff: finiteScoreOrNegativeInfinity(state.seedCutoffScore),
        globalCutoff: finiteScoreOrNegativeInfinity(state.globalCutoffScore),
    }
}

function pruningCutoffScore(state) {
    const parts = pruningCutoffScoreParts(state)
    return Math.max(parts.resultCutoff, parts.seedCutoff, parts.globalCutoff)
}

function refreshGlobalCutoffScore(state, options = {}) {
    if (typeof options.getGlobalCutoffScore !== "function") {
        return
    }
    const next = finiteScoreOrNegativeInfinity(options.getGlobalCutoffScore())
    if (next > finiteScoreOrNegativeInfinity(state.globalCutoffScore)) {
        state.globalCutoffScore = next
    }
}

function shouldPruneBySuperBound(state, superPlan, nextOrderIndex, branchSuperVector, prunedLeafCount) {
    return checkSuperBoundPrune(state, superPlan, nextOrderIndex, branchSuperVector, prunedLeafCount).pruned
}

function recordBoundCheckKind(state, kind, beforeChecks) {
    const afterChecks = Number(state.metrics.superBoundChecks ?? 0)
    if (afterChecks <= beforeChecks) {
        return
    }
    if (kind === "group") {
        state.metrics.groupBoundChecks += afterChecks - beforeChecks
    } else if (kind === "chunk") {
        state.metrics.chunkBoundChecks += afterChecks - beforeChecks
    } else if (kind === "disc") {
        state.metrics.discBoundChecks += afterChecks - beforeChecks
    }
}

function checkSuperBoundPrune(state, superPlan, nextOrderIndex, branchSuperVector, prunedLeafCount, kind = "unknown") {
    if (!state.settings.enableUpperBoundPruning) {
        return { pruned: false, upperBound: Number.POSITIVE_INFINITY }
    }
    const cutoffParts = pruningCutoffScoreParts(state)
    const cutoff = pruningCutoffScore(state)
    if (!Number.isFinite(cutoff)) {
        return { pruned: false, upperBound: Number.POSITIVE_INFINITY }
    }

    let upperBound = Number.POSITIVE_INFINITY
    const beforeChecks = Number(state.metrics.superBoundChecks ?? 0)
    try {
        upperBound = superBoundScore(state, superPlan, nextOrderIndex, branchSuperVector)
    } catch {
        state.metrics.safeBoundFallbacks += 1
        return { pruned: false, upperBound: Number.POSITIVE_INFINITY }
    }
    recordBoundCheckKind(state, kind, beforeChecks)
    let prunedBySuffixTopK = false
    if (
        !(usableBoundScore(upperBound) && upperBound + SCORE_TIE_EPSILON < cutoff)
        && shouldRunSuffixTopKBound(state, kind, prunedLeafCount, upperBound, cutoff)
    ) {
        const suffixBound = suffixTopKReachableBoundScore(state, superPlan, nextOrderIndex, prunedLeafCount)
        if (
            suffixBound !== null
            && usableBoundScore(suffixBound)
            && suffixBound < upperBound
            && suffixBound + SUFFIX_TOPK_PRUNE_EPSILON < cutoff
        ) {
            upperBound = suffixBound
            prunedBySuffixTopK = true
        }
    }
    if (usableBoundScore(upperBound) && upperBound + SCORE_TIE_EPSILON < cutoff) {
        const count = Math.max(1, Number(prunedLeafCount ?? 1))
        state.metrics.prunedBySuperBound += count
        state.metrics.prunedByUpperBound += count
        if (kind === "chunk") {
            state.metrics.prunedByChunkBound += count
        }
        if (prunedBySuffixTopK) {
            state.metrics.prunedBySuffixTopKBound += count
        }
        if (
            Number.isFinite(cutoffParts.globalCutoff)
            && cutoffParts.globalCutoff >= Math.max(cutoffParts.resultCutoff, cutoffParts.seedCutoff)
            && upperBound + SCORE_TIE_EPSILON < cutoffParts.globalCutoff
        ) {
            state.metrics.prunedByGlobalCutoff += count
        }
        return { pruned: true, upperBound }
    }
    return { pruned: false, upperBound }
}

function shouldRunDiscBoundCheck(state, groupUpperBound, remainingProduct) {
    if (Number(remainingProduct ?? 0) < 64) {
        return false
    }
    const cutoff = pruningCutoffScore(state)
    if (!Number.isFinite(cutoff) || cutoff <= 0 || !Number.isFinite(groupUpperBound)) {
        return true
    }
    return groupUpperBound <= cutoff * 1.5
}

function createOptimizerState(catalog, store, input = {}, options = {}) {
    const prepareStartedAt = nowMs()
    function reportPrepare(stage, label, settings = null, metrics = {}) {
        if (typeof options.onPrepareProgress !== "function") {
            return
        }
        try {
            options.onPrepareProgress({
                status: "preparing",
                settings,
                metrics: {
                    ...metrics,
                    prepareStage: stage,
                    prepareStageLabel: label,
                    prepareMs: elapsedMsSince(prepareStartedAt),
                },
                evaluated: Number(metrics.processedCombinationCount ?? metrics.evaluated ?? 0),
                estimatedCombinationCount: Number(metrics.estimatedCombinationCount ?? 0),
                percent: 0,
                elapsedMs: elapsedMsSince(prepareStartedAt),
                prepareStage: stage,
                prepareStageLabel: label,
            })
        } catch {
            // Progress reporting should never break optimizer setup.
        }
    }

    const agent = catalog.agentsMap?.get(input.agentId)
        ?? catalog.agents?.find(item => item.id === input.agentId)
    const rawSettings = normalizeSettings(input, agent)
    const settings = applyPreferredMainStatLimits(rawSettings, agent)
    reportPrepare("settings", "正在读取优化设置", settings)
    if (settings.objective !== "damage") {
        throw new Error(`Unsupported objective: ${settings.objective}`)
    }

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
    const optimizerStatMetadata = typeof panelCalculator.optimizerStatMetadata === "function"
        ? panelCalculator.optimizerStatMetadata({ minimums: settings.minimums })
        : null
    const relevantStatIds = settings.enableObjectiveRelevantDominance && optimizerStatMetadata?.strictMonotonic
        ? new Set(optimizerStatMetadata.relevantStatIds ?? [])
        : null

    let candidatesBySlot = groupCandidatesBySlot(store, settings, relevantStatIds)
    const emptySlots = SLOT_NUMBERS.filter(slot => !candidatesBySlot[String(slot)]?.length)
    reportPrepare("candidates", "正在筛选候选驱动盘", settings, {
        emptySlots,
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount: 0,
        evaluated: 0,
        processedCombinationCount: 0,
    })
    if (emptySlots.length) {
        const reason = hasTwoPieceLimit(settings) ? null : FREE_TWO_PIECE_INSUFFICIENT_REASON
        return {
            isEmpty: true,
            result: createEmptySlotResult(settings, candidatesBySlot, emptySlots, reason),
            settings,
        }
    }

    const candidateData = prepareCandidateData(candidatesBySlot)
    reportPrepare("candidate-vectors", "正在整理候选词条向量", settings, {
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount: 0,
        evaluated: 0,
        processedCombinationCount: 0,
    })
    const potentialWeights = inferPotentialWeights(panelCalculator)
    sortCandidatesByPotential(candidatesBySlot, candidateData.vectorById, potentialWeights)
    candidatesBySlot = filterCandidatesByPotential(candidatesBySlot, candidateData.vectorById, potentialWeights, settings)
    reportPrepare("potential", "正在排序候选评分潜力", settings, {
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount: 0,
        evaluated: 0,
        processedCombinationCount: 0,
    })
    const planBuildStartedAt = nowMs()
    const enumerationPlans = buildEnumerationPlans(candidatesBySlot, settings)
    const planBuildMs = elapsedMsSince(planBuildStartedAt)
    const freePlanMetrics = freeTwoPiecePlanMetrics(enumerationPlans, settings)
    const estimatedCombinationCount = enumerationPlans.reduce(
        (total, plan) => total + Number(plan.combinationCount ?? 0),
        0,
    )
    reportPrepare("enumeration-plans", "正在构建枚举计划", settings, {
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount,
        enumerationPlanCount: enumerationPlans.length,
        evaluated: 0,
        processedCombinationCount: 0,
        planBuildMs,
        ...freePlanMetrics,
        complexity: complexityForEstimate(estimatedCombinationCount),
    })
    if (!enumerationPlans.length && !hasTwoPieceLimit(settings)) {
        const result = createEmptySlotResult(
            settings,
            candidatesBySlot,
            [],
            FREE_TWO_PIECE_INSUFFICIENT_REASON,
        )
        Object.assign(result.metrics, freePlanMetrics, { planBuildMs })
        return {
            isEmpty: true,
            result,
            settings,
        }
    }
    const optimisticTwoPieceEntries = optimisticTwoPieceStatEntries(catalog)
    const optimisticTwoPieceEntriesByActiveCount = optimisticTwoPieceStatEntriesByActiveCount(catalog)
    const forceIndexedSearch = String(settings.useIndexedScoreOnly ?? "").trim().toLowerCase() === "force"
    const explicitIndexedSearch = booleanSetting(settings.useIndexedScoreOnly, null)
    const canCompileDenseScore = usesSuperBoundAlgorithm(settings.algorithm)
        && typeof panelCalculator.compileDensePanelScoreTarget === "function"
    const canPrepareIndexedSearch = usesSuperBoundAlgorithm(settings.algorithm)
        && (
            canCompileDenseScore
            || forceIndexedSearch
            || explicitIndexedSearch === true
        )
    const indexedCandidateData = canPrepareIndexedSearch
        ? prepareIndexedCandidateData(
            candidatesBySlot,
            candidateData,
            settings,
            optimisticTwoPieceEntries,
            optimisticTwoPieceEntriesByActiveCount,
        )
        : {}
    reportPrepare("indexed-data", "正在准备评分索引", settings, {
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount,
        enumerationPlanCount: enumerationPlans.length,
        evaluated: 0,
        processedCombinationCount: 0,
        planBuildMs,
        complexity: complexityForEstimate(estimatedCombinationCount),
    })
    const densePanelScoreTarget = canCompileDenseScore
        ? panelCalculator.compileDensePanelScoreTarget({
            statIds: indexedCandidateData.statIds ?? [],
            setIds: indexedCandidateData.setIds ?? [],
            setIndexById: indexedCandidateData.setIndexById,
            candidateStatIndexes: indexedCandidateData.candidateStatIndexes ?? [],
        })
        : null
    const denseProbe = canCompileDenseScore
        ? probeCompiledDenseScoreKernel(panelCalculator, indexedCandidateData, densePanelScoreTarget, candidatesBySlot)
        : {
            enabled: false,
            scoreKernel: "map",
            scoreKernelProbeMs: 0,
            scoreKernelMapProbeMs: 0,
            scoreKernelDenseProbeMs: 0,
            scoreKernelProbeCount: 0,
            avgScoreKernelMs: 0,
            scoreKernelFallbackReason: "unsupported",
        }
    reportPrepare("score-kernel", "正在探测评分内核", settings, {
        candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
        estimatedCombinationCount,
        enumerationPlanCount: enumerationPlans.length,
        evaluated: 0,
        processedCombinationCount: 0,
        planBuildMs,
        scoreKernel: denseProbe.enabled ? "compiled-dense" : "map",
        scoreKernelProbeMs: denseProbe.scoreKernelProbeMs,
        scoreKernelMapProbeMs: denseProbe.scoreKernelMapProbeMs,
        scoreKernelDenseProbeMs: denseProbe.scoreKernelDenseProbeMs,
        scoreKernelProbeCount: denseProbe.scoreKernelProbeCount,
        scoreKernelFallbackReason: denseProbe.scoreKernelFallbackReason,
        avgScoreKernelMs: Number(denseProbe.avgScoreKernelMs ?? 0),
        complexity: complexityForEstimate(estimatedCombinationCount),
    })
    const useCompiledDenseScore = Boolean(denseProbe.enabled)
    const canUseIndexedScore = canPrepareIndexedSearch
        && typeof panelCalculator.scoreOnlyFromIndexedSummary === "function"
    const useIndexedSearch = canUseIndexedScore
        ? shouldUseIndexedScoreOnly(panelCalculator, indexedCandidateData, settings)
        : false
    const useDenseSearchState = useCompiledDenseScore || useIndexedSearch
    const panelStatIndexById = new Map(
        (densePanelScoreTarget?.panelStatIds ?? []).map((stat, index) => [stat, index]),
    )
    const minimumPanelChecks = Object.entries(settings.minimums ?? {})
        .map(([stat, value]) => ({
            index: panelStatIndexById.get(stat),
            minimum: normalizedMinimumValue(stat, value),
        }))
        .filter(item => item.minimum !== null)
    const state = {
        isEmpty: false,
        startedAtMs: Date.now(),
        settings,
        candidatesBySlot,
        enumerationPlans,
        ...candidateData,
        ...indexedCandidateData,
        useIndexedSearch,
        useCompiledDenseScore,
        useDenseSearchState,
        densePanelScoreTarget: useCompiledDenseScore ? densePanelScoreTarget : null,
        minimumPanelChecks,
        optimizerStatMetadata,
        relevantStatIds,
        relevantStatIndexes: relevantStatIds
            ? [...relevantStatIds].map(stat => indexedCandidateData.statIndexById?.get(stat)).filter(index => index !== undefined)
            : null,
        potentialWeights,
        results: [],
        seedScores: [],
        seedCutoffScore: Number.NEGATIVE_INFINITY,
        globalCutoffScore: finiteScoreOrNegativeInfinity(input._globalCutoffScore),
        deferFullResultHydration: Boolean(input._optimizerTask),
        selected: [],
        selectedCalcDiscs: [],
        selectedStatTotals: new Map(),
        selectedSetCounts: new Map(),
        selectedStatValues: useDenseSearchState ? new Float64Array(indexedCandidateData.statIds.length) : null,
        selectedSetCountValues: useDenseSearchState ? new Int16Array(indexedCandidateData.setIds.length) : null,
        combatBuffs,
        remainingMaxStatEntriesByIndex: maxStatVectorsByRemainingIndex(candidatesBySlot, candidateData.vectorById),
        optimisticTwoPieceStatEntries: optimisticTwoPieceEntries,
        optimisticTwoPieceStatEntriesByActiveCount: optimisticTwoPieceEntriesByActiveCount,
        scoreInputBase,
        panelCalculator,
        specializedScoreKernelCache: new Map(),
        metrics: {
            ...algorithmMetricFields(settings.algorithm),
            emptySlots: [],
            candidateCountsBySlot: candidateCountsBySlot(candidatesBySlot),
            estimatedCombinationCount,
            enumerationPlanCount: enumerationPlans.length,
            ...freePlanMetrics,
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
            seedBudgetUsed: 0,
            seedPlanCount: 0,
            seedBeamWidth: 0,
            skippedDiscBoundChecks: 0,
            skippedDiscBoundChecksByPolicy: 0,
            groupBoundChecks: 0,
            chunkBoundChecks: 0,
            discBoundChecks: 0,
            suffixTopKBoundChecks: 0,
            boundOracleChecks: 0,
            safeBoundFallbacks: 0,
            avgBoundCheckMs: 0,
            boundChecksPerSecond: 0,
            indexedScoreEnabled: useIndexedSearch,
            scoreKernel: useCompiledDenseScore ? "compiled-dense" : "map",
            scoreKernelProbeMs: denseProbe.scoreKernelProbeMs,
            scoreKernelMapProbeMs: denseProbe.scoreKernelMapProbeMs,
            scoreKernelDenseProbeMs: denseProbe.scoreKernelDenseProbeMs,
            scoreKernelProbeCount: denseProbe.scoreKernelProbeCount,
            scoreKernelFallbackReason: denseProbe.scoreKernelFallbackReason,
            relevantStatCount: relevantStatIds?.size ?? 0,
            dominanceMode: relevantStatIds ? "objective-relevant" : "all-stats",
            avgScoreKernelMs: Number(denseProbe.avgScoreKernelMs ?? 0),
            denseScoreCalls: 0,
            denseScoreMs: 0,
            denseScoreMsSamples: 0,
            specializedScoreCalls: 0,
            specializedScorePlanCount: 0,
            specializedScoreKernelCount: 0,
            specializedScoreKernelCacheHits: 0,
            specializedScoreFallbacks: 0,
            specializedScoreFallbackReason: null,
            objectiveScalarCalls: 0,
            objectiveScalarPlanCount: 0,
            objectiveScalarFallbacks: 0,
            objectiveScalarFallbackReason: null,
            boundCheckMsSamples: 0,
            suffixFrontierBuildMs: 0,
            suffixFrontierRawCount: 0,
            suffixFrontierCompressedCount: 0,
            suffixFrontierScoreCalls: 0,
            freeSpecializedScorePlanCount: 0,
            scratchBufferReuses: 0,
            vectorScoreCalls: 0,
            vectorScoreFallbacks: 0,
            vectorScoreMs: 0,
            rejectedByMinimums: 0,
            prunedBySetFeasibility: 0,
            prunedByUpperBound: 0,
            upperBoundChecks: 0,
            prunedBySuperBound: 0,
            prunedByChunkBound: 0,
            prunedBySuffixTopKBound: 0,
            prunedByGlobalCutoff: 0,
            superBoundChecks: 0,
            parallelTaskCount: 0,
            browserWorkerCount: 0,
            parallelFallbackReason: null,
            completedTaskCount: 0,
            taskStealCount: 0,
            workerIdleMs: 0,
            workerIdleRatio: 0,
            slowestWorkerMs: 0,
            workerStartupMs: 0,
            taskDispatchMs: 0,
            globalCutoffUpdates: 0,
            appliedPreferredSlots: appliedPreferredSlots(settings),
            complexity: complexityForEstimate(estimatedCombinationCount),
        },
    }
    if (usesSuperBoundAlgorithm(settings.algorithm)) {
        const superPlanBuildStartedAt = nowMs()
        state.superBoundPlans = buildSuperBoundPlans(state)
            .map((plan, index) => ({ ...plan, parallelPlanIndex: index }))
        const shard = input._optimizerShard
        if (shard && Number(shard.total) > 1) {
            const shardIndex = Number(shard.index ?? 0)
            const shardTotal = Number(shard.total)
            state.superBoundPlans = state.superBoundPlans.filter((_, index) => index % shardTotal === shardIndex)
            state.metrics.workerShardIndex = shardIndex
            state.metrics.workerShardTotal = shardTotal
            state.metrics.estimatedCombinationCount = state.superBoundPlans.reduce(
                (total, plan) => total + Number(plan.combinationCount ?? 0),
                0,
            )
            state.metrics.enumerationPlanCount = state.superBoundPlans.length
        }
        const task = input._optimizerTask
        if (task && Number.isInteger(Number(task.superPlanIndex))) {
            const planIndex = Number(task.superPlanIndex)
            const plan = state.superBoundPlans.find(item => Number(item.parallelPlanIndex) === planIndex)
            const restrictedPlan = plan ? restrictSuperPlanForTask(plan, task, state) : null
            state.superBoundPlans = restrictedPlan ? [restrictedPlan] : []
            state.metrics.parallelTaskId = Number(task.taskId ?? -1)
            state.metrics.parallelTaskSuperPlanIndex = planIndex
            state.metrics.estimatedCombinationCount = Number(task.estimatedLeafCount ?? restrictedPlan?.combinationCount ?? 0)
            state.metrics.enumerationPlanCount = state.superBoundPlans.length
        }
        addMetricTime(state.metrics, "planBuildMs", superPlanBuildStartedAt)
        state.metrics.groupPlanCount = state.superBoundPlans.reduce(
            (total, plan) => total + Number(plan.groupCombinationCount ?? 0),
            0,
        )
        reportPrepare("super-bound-plans", "正在构建超级上界剪枝计划", settings, {
            ...state.metrics,
        })
    }
    return state
}

function createTaskOptimizerStateFromBase(baseState, task = {}, input = {}) {
    const startedAt = nowMs()
    const planIndex = Number(task.superPlanIndex)
    const sourcePlan = baseState.superBoundPlans?.find(item => Number(item.parallelPlanIndex) === planIndex)
    const restrictedPlan = sourcePlan ? restrictSuperPlanForTask(sourcePlan, task, baseState) : null
    const useIndexedSearch = Boolean(baseState.useIndexedSearch)
    const useCompiledDenseScore = Boolean(baseState.useCompiledDenseScore)
    const useDenseSearchState = Boolean(baseState.useDenseSearchState)
    const estimatedCombinationCount = Number(task.estimatedLeafCount ?? restrictedPlan?.combinationCount ?? 0)
    const metrics = {
        ...algorithmMetricFields("exact-super-bound"),
        emptySlots: [],
        candidateCountsBySlot: baseState.metrics?.candidateCountsBySlot ?? candidateCountsBySlot(baseState.candidatesBySlot),
        estimatedCombinationCount,
        enumerationPlanCount: restrictedPlan ? 1 : 0,
        groupPlanCount: restrictedPlan ? Number(restrictedPlan.groupCombinationCount ?? 0) : 0,
        evaluated: 0,
        scoredCombinationCount: 0,
        processedCombinationCount: 0,
        planBuildMs: 0,
        taskStateBuildMs: 0,
        workerStateReused: true,
        boundCheckMs: 0,
        scoreOnlyMs: 0,
        fullResultMs: 0,
        warmupMs: 0,
        seededTopKCount: 0,
        seededTopKAttempts: 0,
        seedBudgetUsed: 0,
        seedPlanCount: 0,
        seedBeamWidth: 0,
        skippedDiscBoundChecks: 0,
        skippedDiscBoundChecksByPolicy: 0,
        groupBoundChecks: 0,
        chunkBoundChecks: 0,
        discBoundChecks: 0,
        suffixTopKBoundChecks: 0,
        boundOracleChecks: 0,
        safeBoundFallbacks: 0,
        avgBoundCheckMs: 0,
        boundChecksPerSecond: 0,
        indexedScoreEnabled: useIndexedSearch,
        scoreKernel: useCompiledDenseScore ? "compiled-dense" : "map",
        scoreKernelProbeMs: 0,
        scoreKernelMapProbeMs: 0,
        scoreKernelDenseProbeMs: 0,
        scoreKernelProbeCount: 0,
        scoreKernelFallbackReason: baseState.metrics?.scoreKernelFallbackReason ?? null,
        avgScoreKernelMs: 0,
        denseScoreCalls: 0,
        denseScoreMs: 0,
        specializedScoreCalls: 0,
        specializedScorePlanCount: Number(baseState.metrics?.specializedScorePlanCount ?? 0),
        specializedScoreFallbacks: 0,
        specializedScoreFallbackReason: baseState.metrics?.specializedScoreFallbackReason ?? null,
        suffixFrontierBuildMs: 0,
        suffixFrontierRawCount: 0,
        suffixFrontierCompressedCount: 0,
        suffixFrontierScoreCalls: 0,
        scratchBufferReuses: 0,
        vectorScoreCalls: 0,
        vectorScoreFallbacks: 0,
        vectorScoreMs: 0,
        rejectedByMinimums: 0,
        prunedBySetFeasibility: 0,
        prunedByUpperBound: 0,
        upperBoundChecks: 0,
        prunedBySuperBound: 0,
        prunedByChunkBound: 0,
        prunedBySuffixTopKBound: 0,
        prunedByGlobalCutoff: 0,
        superBoundChecks: 0,
        parallelTaskCount: 0,
        browserWorkerCount: 0,
        parallelFallbackReason: null,
        completedTaskCount: 0,
        taskStealCount: 0,
        workerIdleMs: 0,
        workerIdleRatio: 0,
        slowestWorkerMs: 0,
        workerStartupMs: 0,
        taskDispatchMs: 0,
        globalCutoffUpdates: 0,
        appliedPreferredSlots: baseState.metrics?.appliedPreferredSlots ?? appliedPreferredSlots(baseState.settings),
        complexity: complexityForEstimate(estimatedCombinationCount),
        parallelTaskId: Number(task.taskId ?? -1),
        parallelTaskSuperPlanIndex: planIndex,
    }
    const state = {
        ...baseState,
        startedAtMs: Date.now(),
        results: [],
        seedScores: [],
        seedCutoffScore: Number.NEGATIVE_INFINITY,
        globalCutoffScore: finiteScoreOrNegativeInfinity(input._globalCutoffScore),
        deferFullResultHydration: true,
        selected: [],
        selectedCalcDiscs: [],
        selectedStatTotals: new Map(),
        selectedSetCounts: new Map(),
        selectedStatValues: useDenseSearchState ? new Float64Array(baseState.statIds?.length ?? 0) : null,
        selectedSetCountValues: useDenseSearchState ? new Int16Array(baseState.setIds?.length ?? 0) : null,
        superBoundPlans: restrictedPlan ? [restrictedPlan] : [],
        metrics,
    }
    metrics.taskStateBuildMs = elapsedMsSince(startedAt)
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
    const boundChecks = Number(metrics.superBoundChecks ?? 0)
    const rate = processed / (elapsedMs / 1000)
    const scoredRate = scored / (elapsedMs / 1000)
    metrics.scoredCombinationCount = scored
    metrics.processedCombinationCount = processed
    metrics.evaluationsPerSecond = Number.isFinite(rate) ? rate : 0
    metrics.scoredCombinationsPerSecond = Number.isFinite(scoredRate) ? scoredRate : 0
    metrics.boundChecksPerSecond = boundChecks / (elapsedMs / 1000)
    metrics.avgBoundCheckMs = boundChecks > 0
        ? Number(metrics.boundCheckMs ?? 0) / boundChecks
        : 0
    metrics.avgScoreKernelMs = Number(metrics.denseScoreCalls ?? 0) > 0
        ? Number(metrics.denseScoreMs ?? 0) / Number(metrics.denseScoreCalls ?? 1)
        : Number(metrics.avgScoreKernelMs ?? 0)
    return metrics.evaluationsPerSecond
}

function updateCutoffMetrics(state) {
    const metrics = state.result?.metrics ?? state.metrics
    if (!metrics || state.isEmpty) {
        return
    }
    const localCutoff = Math.max(
        resultCutoffScore(state),
        finiteScoreOrNegativeInfinity(state.seedCutoffScore),
    )
    const globalCutoff = finiteScoreOrNegativeInfinity(state.globalCutoffScore)
    const pruningCutoff = Math.max(localCutoff, globalCutoff)
    if (Number.isFinite(localCutoff)) {
        metrics.localCutoffScore = localCutoff
    }
    if (Number.isFinite(globalCutoff)) {
        metrics.globalCutoffScore = globalCutoff
    }
    if (Number.isFinite(pruningCutoff)) {
        metrics.pruningCutoffScore = pruningCutoff
    }
}

function progressFromState(state, status = "running") {
    updateEvaluationRate(state)
    updateCutoffMetrics(state)
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

function previewFromOptimizerState(state) {
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
        summary = selectedScoreOnlySummary(state)
    } finally {
        addMetricTime(state.metrics, "scoreOnlyMs", scoreStartedAt)
    }
    state.metrics.evaluated += 1
    if (!passesMinimumScoreSummary(summary, state)) {
        state.metrics.rejectedByMinimums += 1
        return
    }

    const score = Number(Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY).toFixed(12))
    if (!Number.isFinite(score)) {
        return
    }
    const inventoryDiscs = selectedDiscsInSlotOrder(state)
    if (!shouldKeepTopCandidate(state.results, score, inventoryDiscs)) {
        return
    }

    insertTopResult(state.results, {
        rank: 0,
        score,
        driveDiscIdsBySlot: Object.fromEntries(inventoryDiscs.map(disc => [String(disc.partition), disc.id])),
        driveDiscs: inventoryDiscs,
        setSummary: setSummary(inventoryDiscs, catalog),
        data: null,
    })
}

function hydrateOptimizerResults(catalog, state, results = state.results, metrics = state.metrics) {
    if (state.deferFullResultHydration) {
        return
    }
    for (const result of results ?? []) {
        if (result?.data) {
            continue
        }
        const calcDiscs = (result.driveDiscs ?? []).map(disc =>
            state.calcDiscById?.get(disc.id) ?? toCalculatorDriveDisc(disc)
        )
        const fullResultStartedAt = nowMs()
        result.data = state.panelCalculator.calculate(calcDiscs)
        addMetricTime(metrics, "fullResultMs", fullResultStartedAt)
        if (!result.setSummary && catalog) {
            result.setSummary = setSummary(result.driveDiscs ?? [], catalog)
        }
    }
}

function finalizeOptimizerResult(state) {
    if (state.isEmpty) {
        return state.result
    }
    updateEvaluationRate(state)
    updateCutoffMetrics(state)
    hydrateOptimizerResults(null, state)

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
    if (state.useDenseSearchState) {
        addIndexedVectorToTotals(state.selectedStatValues, state.indexedVectorById?.get(disc.id), 1)
        const setIndex = state.setIndexById?.get(disc.setId)
        if (setIndex !== undefined) {
            state.selectedSetCountValues[setIndex] += 1
        }
    } else {
        addDiscVectorToTotals(state.selectedStatTotals, state.vectorById.get(disc.id) ?? statVector(disc), 1)
        state.selectedSetCounts.set(disc.setId, (state.selectedSetCounts.get(disc.setId) ?? 0) + 1)
    }
}

function popSelectedDisc(state) {
    const disc = state.selected.pop()
    state.selectedCalcDiscs.pop()
    if (disc) {
        if (state.useDenseSearchState) {
            addIndexedVectorToTotals(state.selectedStatValues, state.indexedVectorById?.get(disc.id), -1)
            const setIndex = state.setIndexById?.get(disc.setId)
            if (setIndex !== undefined) {
                state.selectedSetCountValues[setIndex] -= 1
            }
        } else {
            addDiscVectorToTotals(state.selectedStatTotals, state.vectorById.get(disc.id) ?? statVector(disc), -1)
            const nextCount = (state.selectedSetCounts.get(disc.setId) ?? 0) - 1
            if (nextCount > 0) {
                state.selectedSetCounts.set(disc.setId, nextCount)
            } else {
                state.selectedSetCounts.delete(disc.setId)
            }
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
    const specializedScoreKernel = state.useCompiledDenseScore
        ? compileSpecializedPlanScoreKernel(state, state.selectedSetCountValues, [])
        : null
    const summary = state.useCompiledDenseScore
        ? scoreOnlyFromDenseState(
            state,
            state.selectedStatValues,
            state.selectedSetCountValues,
            specializedScoreKernel,
        )
        : selectedScoreOnlySummary(state)
    if (!passesMinimumScoreSummary(summary, state)) {
        return
    }
    insertSeedScore(state, Number(Number(summary.finalDamage ?? Number.NEGATIVE_INFINITY).toFixed(12)))
}

function seedTopKCutoffForSuperBound(state, maxAttempts = DEFAULT_SEED_CUTOFF_ATTEMPTS) {
    if (!["exact-super-bound", "exact-super-bound-parallel"].includes(normalizeAlgorithm(state.settings.algorithm)) || !state.settings.enableUpperBoundPruning) {
        return
    }
    const startedAt = nowMs()
    let attempts = 0
    const plans = state.superBoundPlans ?? []
    const activePlanCount = Math.min(plans.length, Math.max(1, maxAttempts))
    const baseBudget = activePlanCount > 0 ? Math.floor(maxAttempts / activePlanCount) : 0
    const remainder = activePlanCount > 0 ? maxAttempts % activePlanCount : 0
    let maxBeamWidth = 0

    for (let planIndex = 0; planIndex < activePlanCount; planIndex += 1) {
        const superPlan = plans[planIndex]
        const planBudget = Math.max(1, baseBudget + (planIndex < remainder ? 1 : 0))
        const beamWidth = Math.min(96, planBudget)
        maxBeamWidth = Math.max(maxBeamWidth, beamWidth)
        let beam = [{ discs: [], potential: 0 }]
        for (const slotEntry of superPlan.orderedSlots) {
            const candidates = slotEntry.groups
                .flatMap(group => group.discs)
                .map(disc => ({
                    disc,
                    potential: candidatePotential(disc, state.vectorById.get(disc.id) ?? new Map(), state.potentialWeights),
                }))
                .sort((left, right) =>
                    right.potential - left.potential
                    || sourceOrder(left.disc) - sourceOrder(right.disc)
                    || String(left.disc.id).localeCompare(String(right.disc.id))
                )
            const expanded = []
            for (const partial of beam) {
                for (const candidate of candidates) {
                    expanded.push({
                        discs: [...partial.discs, candidate.disc],
                        potential: partial.potential + candidate.potential,
                    })
                }
            }
            expanded.sort((left, right) =>
                right.potential - left.potential
                || stableDiscSignature(left.discs).localeCompare(stableDiscSignature(right.discs))
            )
            beam = expanded.slice(0, beamWidth)
            if (!beam.length) {
                break
            }
        }
        for (const candidate of beam.slice(0, planBudget)) {
            for (const disc of candidate.discs) {
                pushSelectedDisc(state, disc)
            }
            attempts += 1
            evaluateSelectedForSeedCutoff(state)
            for (let index = candidate.discs.length - 1; index >= 0; index -= 1) {
                popSelectedDisc(state)
            }
            if (attempts >= maxAttempts) {
                break
            }
        }
    }

    state.metrics.seededTopKCount = state.seedScores.length
    state.metrics.seededTopKAttempts = attempts
    state.metrics.seedBudgetUsed = Math.min(attempts, maxAttempts)
    state.metrics.seedPlanCount = activePlanCount
    state.metrics.seedBeamWidth = maxBeamWidth
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
            const branchSuperVector = state.useDenseSearchState ? group.indexedSuperVector : group.superVector
            const groupBound = checkSuperBoundPrune(state, superPlan, orderIndex + 1, branchSuperVector, groupLeafCount, "group")
            if (groupBound.pruned) {
                continue
            }

            const chunks = group.chunks?.length ? group.chunks : [{ discs: group.discs, upperBound: groupBound.upperBound }]
            for (const chunk of chunks) {
                let branchUpperBound = Number(chunk.upperBound ?? groupBound.upperBound)
                if (group.chunks?.length) {
                    const chunkLeafCount = chunk.discs.length * remainingProduct
                    const chunkSuperVector = state.useDenseSearchState ? chunk.indexedSuperVector : chunk.superVector
                    const chunkBound = checkSuperBoundPrune(state, superPlan, orderIndex + 1, chunkSuperVector, chunkLeafCount, "chunk")
                    if (chunkBound.pruned) {
                        continue
                    }
                    branchUpperBound = chunkBound.upperBound
                }

                for (const disc of chunk.discs) {
                    pushSelectedDisc(state, disc)
                    const skipDiscBoundCheck = chunk.discs.length === 1
                    if (skipDiscBoundCheck) {
                        state.metrics.skippedDiscBoundChecks += 1
                    }
                    const allowSuffixTopKBound = remainingProduct <= SUFFIX_TOPK_BOUND_MAX_LEAVES
                    const skipDiscBoundCheckByPolicy = !skipDiscBoundCheck
                        && !allowSuffixTopKBound
                        && !shouldRunDiscBoundCheck(state, branchUpperBound, remainingProduct)
                    if (skipDiscBoundCheckByPolicy) {
                        state.metrics.skippedDiscBoundChecksByPolicy += 1
                    }
                    if (
                        skipDiscBoundCheck
                        || skipDiscBoundCheckByPolicy
                        || !checkSuperBoundPrune(state, superPlan, orderIndex + 1, null, remainingProduct, "disc").pruned
                    ) {
                        walkPlan(superPlan, orderIndex + 1)
                    }
                    popSelectedDisc(state)
                }
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

export function createDriveDiscOptimizerWorkerSession(catalog, store, input = {}) {
    const {
        _optimizerTask,
        _optimizerShard,
        _globalCutoffScore,
        ...restInput
    } = input ?? {}
    const baseInput = {
        ...restInput,
        settings: {
            ...(input.settings ?? {}),
            algorithm: "exact-super-bound",
            disableParallel: true,
        },
    }
    const baseState = createOptimizerState(catalog, store, baseInput)
    return {
        baseState,
        async runTask(task, options = {}) {
            if (baseState.isEmpty) {
                return finalizeOptimizerResult(baseState)
            }
            const taskInput = {
                ...baseInput,
                _optimizerTask: task,
                _globalCutoffScore: options.globalCutoffScore,
            }
            const taskState = createTaskOptimizerStateFromBase(baseState, task, taskInput)
            return optimizeDriveDiscsSuperBoundExactAsync(catalog, store, taskInput, options, taskState)
        },
    }
}

async function optimizeDriveDiscsLegacyExactAsync(catalog, store, input = {}, options = {}) {
    const state = createOptimizerState(catalog, store, input, { onPrepareProgress: options.onProgress })
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
        await (options.yieldControl ?? defaultYieldControl)()
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

async function optimizeDriveDiscsSuperBoundExactAsync(catalog, store, input = {}, options = {}, prebuiltState = null) {
    const state = prebuiltState ?? createOptimizerState(catalog, store, input, { onPrepareProgress: options.onProgress })
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

        refreshGlobalCutoffScore(state, options)
        throwIfCancelled()
        const enoughProgressTime = now - lastProgressAt >= progressIntervalMs
        if (force || enoughProgressTime) {
            options.onProgress?.(progressFromState(state, "running"))
            lastProgressAt = now
        }

        lastYieldWork = currentWork
        lastYieldAt = now
        await (options.yieldControl ?? defaultYieldControl)()
        throwIfCancelled()
    }

    options.onProgress?.(progressFromState(state, state.isEmpty ? "complete" : "running"))
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }

    const seedAttempts = input._optimizerTask ? 64 : 512
    if (!Number.isFinite(finiteScoreOrNegativeInfinity(state.globalCutoffScore))) {
        seedTopKCutoffForSuperBound(state, seedAttempts)
    }
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
            const branchSuperVector = state.useDenseSearchState ? group.indexedSuperVector : group.superVector
            const groupBound = checkSuperBoundPrune(state, superPlan, orderIndex + 1, branchSuperVector, groupLeafCount, "group")
            if (groupBound.pruned) {
                await maybeYield()
                continue
            }

            const chunks = group.chunks?.length ? group.chunks : [{ discs: group.discs, upperBound: groupBound.upperBound }]
            for (const chunk of chunks) {
                let branchUpperBound = Number(chunk.upperBound ?? groupBound.upperBound)
                if (group.chunks?.length) {
                    const chunkLeafCount = chunk.discs.length * remainingProduct
                    const chunkSuperVector = state.useDenseSearchState ? chunk.indexedSuperVector : chunk.superVector
                    const chunkBound = checkSuperBoundPrune(state, superPlan, orderIndex + 1, chunkSuperVector, chunkLeafCount, "chunk")
                    if (chunkBound.pruned) {
                        await maybeYield()
                        continue
                    }
                    branchUpperBound = chunkBound.upperBound
                }

                for (const disc of chunk.discs) {
                    pushSelectedDisc(state, disc)
                    const skipDiscBoundCheck = chunk.discs.length === 1
                    if (skipDiscBoundCheck) {
                        state.metrics.skippedDiscBoundChecks += 1
                    }
                    const allowSuffixTopKBound = remainingProduct <= SUFFIX_TOPK_BOUND_MAX_LEAVES
                    const skipDiscBoundCheckByPolicy = !skipDiscBoundCheck
                        && !allowSuffixTopKBound
                        && !shouldRunDiscBoundCheck(state, branchUpperBound, remainingProduct)
                    if (skipDiscBoundCheckByPolicy) {
                        state.metrics.skippedDiscBoundChecksByPolicy += 1
                    }
                    if (
                        !skipDiscBoundCheck
                        && !skipDiscBoundCheckByPolicy
                        && checkSuperBoundPrune(state, superPlan, orderIndex + 1, null, remainingProduct, "disc").pruned
                    ) {
                        popSelectedDisc(state)
                        await maybeYield()
                        continue
                    }
                    await walkPlan(superPlan, orderIndex + 1)
                    popSelectedDisc(state)
                    await maybeYield()
                }
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

function configuredWorkerCount(settings = {}, estimatedCombinationCount = Number.POSITIVE_INFINITY, runtime = DEFAULT_OPTIMIZER_RUNTIME) {
    const explicit = Number(settings.workerCount)
    if (Number.isInteger(explicit) && explicit > 0) {
        return Math.max(1, Math.min(8, explicit))
    }
    const available = typeof runtime.availableParallelism === "function" ? runtime.availableParallelism() : 2
    const runtimeMaxWorkerCount = Math.max(1, Number(runtime.maxWorkerCount ?? 6))
    const maxAvailableWorkers = Math.max(1, Math.min(runtimeMaxWorkerCount, available - 1))
    const estimate = Number(estimatedCombinationCount ?? 0)
    if (estimate < 8_000_000) {
        return Math.min(maxAvailableWorkers, 2)
    }
    if (estimate < 25_000_000) {
        return Math.min(maxAvailableWorkers, 4)
    }
    return maxAvailableWorkers
}

function shouldUseParallelSuperBound(state, input = {}, runtime = DEFAULT_OPTIMIZER_RUNTIME) {
    if (typeof runtime.runParallel !== "function") {
        return false
    }
    if (input._optimizerShard || input._optimizerTask) {
        return false
    }
    if (state.settings.disableParallel === true) {
        return false
    }
    const algorithm = normalizeAlgorithm(state.settings.algorithm)
    const workerCount = configuredWorkerCount(state.settings, state.metrics.estimatedCombinationCount, runtime)
    if (algorithm === "exact-super-bound-parallel") {
        return workerCount > 1
    }
    if (algorithm !== "exact-super-bound") {
        return false
    }
    const threshold = Number(state.settings.parallelThreshold ?? 2_000_000)
    return Number(state.metrics.estimatedCombinationCount ?? 0) >= threshold
        && workerCount > 1
}

const PARALLEL_SUM_METRIC_KEYS = [
    "evaluated",
    "scoredCombinationCount",
    "processedCombinationCount",
    "boundCheckMs",
    "scoreOnlyMs",
    "fullResultMs",
    "taskStateBuildMs",
    "warmupMs",
    "seededTopKCount",
    "seededTopKAttempts",
    "seedBudgetUsed",
    "seedPlanCount",
    "skippedDiscBoundChecks",
    "skippedDiscBoundChecksByPolicy",
    "groupBoundChecks",
    "chunkBoundChecks",
    "discBoundChecks",
    "suffixTopKBoundChecks",
    "boundOracleChecks",
    "safeBoundFallbacks",
    "rejectedByMinimums",
    "prunedBySetFeasibility",
    "prunedByUpperBound",
    "upperBoundChecks",
    "prunedBySuperBound",
    "prunedByChunkBound",
    "prunedBySuffixTopKBound",
    "prunedByGlobalCutoff",
    "superBoundChecks",
    "denseScoreCalls",
    "denseScoreMs",
    "denseScoreMsSamples",
    "specializedScoreCalls",
    "specializedScoreFallbacks",
    "objectiveScalarCalls",
    "objectiveScalarPlanCount",
    "objectiveScalarFallbacks",
    "boundCheckMsSamples",
    "suffixFrontierBuildMs",
    "suffixFrontierRawCount",
    "suffixFrontierCompressedCount",
    "suffixFrontierScoreCalls",
    "scratchBufferReuses",
    "vectorScoreCalls",
    "vectorScoreFallbacks",
    "vectorScoreMs",
]

function addParallelMetricSnapshot(target, source) {
    if (!source) {
        return target
    }
    for (const key of PARALLEL_SUM_METRIC_KEYS) {
        target[key] = Number(target[key] ?? 0) + Number(source?.[key] ?? 0)
    }
    return target
}

function mergeParallelMetricSnapshots(...items) {
    const merged = {}
    for (const item of items) {
        addParallelMetricSnapshot(merged, item)
    }
    return merged
}

function combineParallelMetrics(baseMetrics = {}, workerMetricsList = [], startedAtMs = Date.now(), status = "running", parallelStats = {}) {
    const metrics = {
        ...baseMetrics,
        ...algorithmMetricFields("exact-super-bound-parallel"),
        workerCount: workerMetricsList.length,
        browserWorkerCount: Number(parallelStats.browserWorkerCount ?? baseMetrics.browserWorkerCount ?? 0),
        parallelFallbackReason: parallelStats.parallelFallbackReason ?? baseMetrics.parallelFallbackReason ?? null,
        workerMergeMs: Number(baseMetrics.workerMergeMs ?? 0),
        parallelTaskCount: Number(parallelStats.parallelTaskCount ?? baseMetrics.parallelTaskCount ?? 0),
        completedTaskCount: Number(parallelStats.completedTaskCount ?? baseMetrics.completedTaskCount ?? 0),
        taskStealCount: Number(parallelStats.taskStealCount ?? baseMetrics.taskStealCount ?? 0),
        workerIdleMs: Number(parallelStats.workerIdleMs ?? baseMetrics.workerIdleMs ?? 0),
        workerIdleRatio: Number(parallelStats.workerIdleRatio ?? baseMetrics.workerIdleRatio ?? 0),
        slowestWorkerMs: Number(parallelStats.slowestWorkerMs ?? baseMetrics.slowestWorkerMs ?? 0),
        workerStartupMs: Number(parallelStats.workerStartupMs ?? baseMetrics.workerStartupMs ?? 0),
        taskDispatchMs: Number(parallelStats.taskDispatchMs ?? baseMetrics.taskDispatchMs ?? 0),
        globalCutoffUpdates: Number(parallelStats.globalCutoffUpdates ?? baseMetrics.globalCutoffUpdates ?? 0),
        globalCutoffScore: finiteScoreOrNegativeInfinity(parallelStats.globalCutoffScore ?? baseMetrics.globalCutoffScore),
        parallelPrewarmMs: Number(parallelStats.parallelPrewarmMs ?? baseMetrics.parallelPrewarmMs ?? 0),
        parallelPrewarmCutoffScore: finiteScoreOrNegativeInfinity(parallelStats.parallelPrewarmCutoffScore ?? baseMetrics.parallelPrewarmCutoffScore),
        evaluated: 0,
        scoredCombinationCount: 0,
        processedCombinationCount: 0,
        boundCheckMs: 0,
        scoreOnlyMs: 0,
        fullResultMs: 0,
        taskStateBuildMs: 0,
        warmupMs: 0,
        seededTopKCount: 0,
        seededTopKAttempts: 0,
        seedBudgetUsed: 0,
        seedPlanCount: 0,
        seedBeamWidth: 0,
        skippedDiscBoundChecks: 0,
        skippedDiscBoundChecksByPolicy: 0,
        groupBoundChecks: 0,
        chunkBoundChecks: 0,
        discBoundChecks: 0,
        suffixTopKBoundChecks: 0,
        boundOracleChecks: 0,
        safeBoundFallbacks: 0,
        rejectedByMinimums: 0,
        prunedBySetFeasibility: 0,
        prunedByUpperBound: 0,
        upperBoundChecks: 0,
        prunedBySuperBound: 0,
        prunedByChunkBound: 0,
        prunedBySuffixTopKBound: 0,
        prunedByGlobalCutoff: 0,
        superBoundChecks: 0,
        denseScoreCalls: 0,
        denseScoreMs: 0,
        specializedScoreCalls: 0,
        specializedScoreFallbacks: 0,
        suffixFrontierBuildMs: 0,
        suffixFrontierRawCount: 0,
        suffixFrontierCompressedCount: 0,
        suffixFrontierScoreCalls: 0,
        scratchBufferReuses: 0,
        vectorScoreCalls: 0,
        vectorScoreFallbacks: 0,
        vectorScoreMs: 0,
    }
    for (const workerMetrics of workerMetricsList) {
        addParallelMetricSnapshot(metrics, workerMetrics)
    }
    metrics.estimatedCombinationCount = Number(baseMetrics.estimatedCombinationCount ?? 0)
    metrics.enumerationPlanCount = Number(baseMetrics.enumerationPlanCount ?? 0)
    metrics.groupPlanCount = Number(baseMetrics.groupPlanCount ?? 0)
    metrics.processedCombinationCount = processedCombinationCount(metrics)
    const elapsedMs = Math.max(1, Date.now() - startedAtMs)
    if (!metrics.workerIdleRatio && metrics.workerCount > 0) {
        metrics.workerIdleRatio = Math.max(0, Math.min(1, Number(metrics.workerIdleMs ?? 0) / (elapsedMs * metrics.workerCount)))
    }
    metrics.evaluationsPerSecond = metrics.processedCombinationCount / (elapsedMs / 1000)
    metrics.scoredCombinationsPerSecond = Number(metrics.evaluated ?? 0) / (elapsedMs / 1000)
    metrics.boundChecksPerSecond = Number(metrics.superBoundChecks ?? 0) / (elapsedMs / 1000)
    metrics.avgBoundCheckMs = Number(metrics.superBoundChecks ?? 0) > 0
        ? Number(metrics.boundCheckMs ?? 0) / Number(metrics.superBoundChecks ?? 0)
        : 0
    metrics.scoreKernel = workerMetricsList.some(item => item?.scoreKernel === "compiled-dense")
        || baseMetrics.scoreKernel === "compiled-dense"
        ? "compiled-dense"
        : "map"
    metrics.scoreKernelProbeMs = Number(baseMetrics.scoreKernelProbeMs ?? 0)
    metrics.scoreKernelMapProbeMs = Number(baseMetrics.scoreKernelMapProbeMs ?? 0)
    metrics.scoreKernelDenseProbeMs = Number(baseMetrics.scoreKernelDenseProbeMs ?? 0)
    metrics.scoreKernelProbeCount = Number(baseMetrics.scoreKernelProbeCount ?? 0)
    metrics.scoreKernelFallbackReason = metrics.scoreKernel === "compiled-dense"
        ? null
        : baseMetrics.scoreKernelFallbackReason ?? workerMetricsList.find(item => item?.scoreKernelFallbackReason)?.scoreKernelFallbackReason ?? null
    metrics.avgScoreKernelMs = Number(metrics.denseScoreCalls ?? 0) > 0
        ? Number(metrics.denseScoreMs ?? 0) / Number(metrics.denseScoreCalls ?? 1)
        : Number(baseMetrics.avgScoreKernelMs ?? 0)
    if (status === "complete") {
        metrics.processedCombinationCount = metrics.estimatedCombinationCount
    }
    return metrics
}

function mergeParallelResults(workerResults = [], settings, metrics, baseState = null, catalog = null) {
    const merged = []
    const startedAt = nowMs()
    for (const result of workerResults) {
        for (const item of result?.results ?? []) {
            insertTopResult(merged, item)
        }
    }
    merged.forEach((result, index) => {
        result.rank = index + 1
    })
    metrics.workerMergeMs = elapsedMsSince(startedAt)
    if (baseState) {
        hydrateOptimizerResults(catalog, baseState, merged, metrics)
    }
    return {
        results: merged,
        settings: {
            ...settings,
            algorithm: "exact-super-bound-parallel",
        },
        metrics,
        error: {
            isError: merged.length === 0,
            reason: merged.length === 0 ? "没有符合限定条件和最小面板要求的驱动盘套装。" : null,
        },
    }
}

async function optimizeDriveDiscsSuperBoundParallelExactAsync(catalog, store, input = {}, options = {}, baseState = null, runtime = DEFAULT_OPTIMIZER_RUNTIME) {
    const state = baseState ?? createOptimizerState(catalog, store, input, { onPrepareProgress: options.onProgress })
    if (state.isEmpty) {
        return finalizeOptimizerResult(state)
    }
    if (typeof runtime.runParallel !== "function") {
        return optimizeDriveDiscsSuperBoundExactAsync(catalog, store, {
            ...input,
            settings: {
                ...(input.settings ?? {}),
                algorithm: "exact-super-bound",
                disableParallel: true,
            },
        }, options, state)
    }

    const requestedWorkerCount = configuredWorkerCount(
        state.settings,
        state.metrics.estimatedCombinationCount,
        runtime,
    )
    const parallelTasks = buildParallelTasks(state, requestedWorkerCount)
    const workerCount = Math.min(requestedWorkerCount, parallelTasks.length || 1)
    if (workerCount <= 1) {
        return optimizeDriveDiscsSuperBoundExactAsync(catalog, store, input, options, state)
    }

    const prewarmStartedAt = nowMs()
    seedTopKCutoffForSuperBound(state, Number(input.settings?.parallelPrewarmAttempts ?? input.parallelPrewarmAttempts ?? 1024))
    const parallelPrewarmMs = elapsedMsSince(prewarmStartedAt)
    const parallelPrewarmCutoffScore = finiteScoreOrNegativeInfinity(state.seedCutoffScore)

    return runtime.runParallel({
        catalog,
        store,
        input,
        options,
        state,
        parallelTasks,
        workerCount,
        parallelPrewarmMs,
        parallelPrewarmCutoffScore,
        resultLimit: RESULT_LIMIT,
        hooks: {
            OptimizerCancelledError,
            addParallelMetricSnapshot,
            combineParallelMetrics,
            elapsedMsSince,
            finiteScoreOrNegativeInfinity,
            insertTopResult,
            mergeParallelMetricSnapshots,
            mergeParallelResults,
            nowMs,
            percentForMetrics,
            processedCombinationCount,
        },
    })
}

function passesMinimumScoreSummary(summary, state) {
    if (!state.minimumPanelChecks?.length) {
        return true
    }
    if (summary?.outOfCombatPanel) {
        return passesMinimumPanel(summary.outOfCombatPanel, state.settings)
    }
    if (!summary?.outOfCombatPanelValues) {
        return false
    }
    return state.minimumPanelChecks.every(({ index, minimum }) =>
        index === undefined || Number(summary.outOfCombatPanelValues[index] ?? Number.NEGATIVE_INFINITY) >= minimum
    )
}

function normalizedOptimizationInput(input = {}) {
    const algorithm = normalizeAlgorithm(input.settings?.algorithm ?? input.algorithm ?? "exact-super-bound")
    return {
        ...input,
        settings: {
            ...(input.settings ?? {}),
            algorithm,
        },
    }
}

function createDriveDiscOptimizationJobWithRuntime(runtime, catalog, store, input = {}, options = {}) {
    const runtimeOptions = {
        ...options,
        yieldControl: options.yieldControl ?? runtime.yieldControl,
    }
    const normalizedInput = normalizedOptimizationInput(input)
    const algorithm = normalizedInput.settings.algorithm
    const prepareStartedAt = nowMs()
    const state = createOptimizerState(catalog, store, normalizedInput, { onPrepareProgress: runtimeOptions.onProgress })
    const metrics = state.result?.metrics ?? state.metrics
    metrics.preparationMs = elapsedMsSince(prepareStartedAt)
    let runStarted = false

    return {
        preview() {
            return previewFromOptimizerState(state)
        },
        async run(runOptions = {}) {
            if (runStarted) {
                throw new Error("Optimization job can only be run once.")
            }
            runStarted = true
            const jobOptions = {
                ...runtimeOptions,
                ...runOptions,
                yieldControl: runOptions.yieldControl ?? runtimeOptions.yieldControl,
            }
            if (algorithm === "exact-legacy") {
                return optimizeDriveDiscsLegacyExactAsync(catalog, store, normalizedInput, jobOptions)
            }
            if (state.isEmpty) {
                const result = finalizeOptimizerResult(state)
                jobOptions.onProgress?.(progressFromState(state, "complete"))
                return result
            }
            if (shouldUseParallelSuperBound(state, normalizedInput, runtime)) {
                return optimizeDriveDiscsSuperBoundParallelExactAsync(catalog, store, normalizedInput, jobOptions, state, runtime)
            }
            if (algorithm === "exact-super-bound-parallel") {
                state.metrics.parallelFallbackReason = typeof runtime.runParallel !== "function"
                    ? "worker-unavailable"
                    : configuredWorkerCount(state.settings, state.metrics.estimatedCombinationCount, runtime) <= 1
                        ? "insufficient-parallelism"
                        : state.settings.disableParallel
                            ? "disabled"
                            : "serial-fallback"
            }
            return optimizeDriveDiscsSuperBoundExactAsync(catalog, store, normalizedInput, jobOptions, state)
        },
    }
}

async function optimizeDriveDiscsAsyncWithRuntime(runtime, catalog, store, input = {}, options = {}) {
    return createDriveDiscOptimizationJobWithRuntime(runtime, catalog, store, input, options).run()
}

export function createDriveDiscOptimizerRuntime(runtime = {}) {
    const configuredRuntime = {
        ...DEFAULT_OPTIMIZER_RUNTIME,
        ...runtime,
    }
    return {
        createJob(catalog, store, input = {}, options = {}) {
            return createDriveDiscOptimizationJobWithRuntime(configuredRuntime, catalog, store, input, options)
        },
        optimizeDriveDiscsAsync(catalog, store, input = {}, options = {}) {
            return optimizeDriveDiscsAsyncWithRuntime(configuredRuntime, catalog, store, input, options)
        },
    }
}

export function previewDriveDiscOptimization(catalog, store, input = {}, options = {}) {
    const prepareStartedAt = nowMs()
    const state = createOptimizerState(catalog, store, input, { onPrepareProgress: options.onProgress })
    const metrics = state.result?.metrics ?? state.metrics
    metrics.preparationMs = elapsedMsSince(prepareStartedAt)
    return previewFromOptimizerState(state)
}

export async function optimizeDriveDiscsAsync(catalog, store, input = {}, options = {}) {
    return optimizeDriveDiscsAsyncWithRuntime(DEFAULT_OPTIMIZER_RUNTIME, catalog, store, input, options)
}
