import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

const fourSet = "woodpecker_electro"
const twoSet = "hormone_punk"
const slotMain = {
    1: { stat: "hpFlat", value: 2200 },
    2: { stat: "atkFlat", value: 316 },
    3: { stat: "defFlat", value: 184 },
    4: { stat: "critRate", value: 24, mode: "pct" },
    5: { stat: "physicalDmg", value: 30, mode: "pct" },
    6: { stat: "atkPct", value: 30, mode: "pct" },
}
const subStatPool = [
    "critRate",
    "critDmg",
    "atkPct",
    "penRatio",
    "anomalyProficiency",
    "atkFlat",
]
const warehouseSlotMainOptions = {
    1: [{ stat: "hpFlat", value: 2200 }],
    2: [{ stat: "atkFlat", value: 316 }],
    3: [{ stat: "defFlat", value: 184 }],
    4: [
        { stat: "critRate", value: 24, mode: "pct" },
        { stat: "critDmg", value: 48, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "anomalyProficiency", value: 92 },
    ],
    5: [
        { stat: "physicalDmg", value: 30, mode: "pct" },
        { stat: "electricDmg", value: 30, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "penRatio", value: 24, mode: "pct" },
    ],
    6: [
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "anomalyMastery", value: 30, mode: "pct" },
        { stat: "energyRegen", value: 60, mode: "pct" },
    ],
}
const warehouseSubStatPool = [
    "critRate",
    "critDmg",
    "atkPct",
    "penRatio",
    "anomalyProficiency",
    "atkFlat",
    "hpPct",
    "defPct",
    "energyRegen",
    "impact",
]
const scales = [
    { id: "small", variantsPerSetSlot: 3 },
    { id: "medium", variantsPerSetSlot: 4 },
    { id: "large", variantsPerSetSlot: 5 },
]

function disc(id, setId, partition, variant) {
    return {
        id,
        ownerId: "default",
        setId,
        setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: {
            ...slotMain[partition],
            mode: slotMain[partition].mode ?? "flat",
            label: slotMain[partition].stat,
        },
        subStats: Array.from({ length: 4 }, (_, index) => {
            const stat = subStatPool[(variant + index + partition) % subStatPool.length]
            const value = stat === "critRate"
                ? 2.4 + ((variant + partition) % 4) * 1.2
                : stat === "critDmg"
                    ? 4.8 + ((variant + partition) % 5) * 2.4
                    : stat === "atkFlat"
                        ? 19 + ((variant + partition) % 5) * 19
                        : 3 + ((variant + partition + index) % 5) * 1.5
            return {
                stat,
                value,
                mode: stat === "atkFlat" ? "flat" : "pct",
                label: stat,
            }
        }),
        source: {
            type: "benchmark",
            sequence: Number(id.replace(/\D/g, "")) || 999,
        },
    }
}

function benchmarkStore(variantsPerSetSlot) {
    const driveDiscs = []
    for (const slot of [1, 2, 3, 4, 5, 6]) {
        for (let variant = 0; variant < variantsPerSetSlot; variant += 1) {
            driveDiscs.push(disc(`f${slot}-${variant}`, fourSet, slot, variant))
            driveDiscs.push(disc(`h${slot}-${variant}`, twoSet, slot, variant + variantsPerSetSlot))
        }
    }
    return {
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs,
    }
}

function optimizerInput(algorithm) {
    return {
        agentId: exampleInput.agentId,
        coreSkillLevel: exampleInput.coreSkillLevel,
        wEngineId: exampleInput.wEngineId,
        combatBuffs: {
            activeBuffIds: [],
        },
        damage: exampleInput.damage,
        settings: {
            fourPieceSetId: fourSet,
            twoPieceSetId: twoSet,
            objective: "damage",
            algorithm,
            ...(algorithm === "exact-super-bound-parallel" ? { workerCount: 2 } : {}),
            ...(algorithm === "exact-legacy" ? { enableUpperBoundPruning: false } : {}),
        },
    }
}

function warehouseDisc(id, setId, partition, mainStat, variant) {
    const used = new Set([mainStat.stat])
    const subStats = []
    let cursor = 0
    while (subStats.length < 4 && cursor < warehouseSubStatPool.length * 2) {
        const stat = warehouseSubStatPool[(variant + cursor + partition) % warehouseSubStatPool.length]
        cursor += 1
        if (used.has(stat)) {
            continue
        }
        used.add(stat)
        const value = stat === "critRate"
            ? 2.4 + ((variant + partition + cursor) % 4) * 1.2
            : stat === "critDmg"
                ? 4.8 + ((variant + partition + cursor) % 5) * 2.4
                : stat === "atkFlat"
                    ? 19 + ((variant + partition + cursor) % 5) * 19
                    : stat === "anomalyProficiency"
                        ? 9 + ((variant + partition + cursor) % 5) * 9
                        : 3 + ((variant + partition + cursor) % 5) * 1.5
        subStats.push({
            stat,
            value,
            mode: stat === "atkFlat" || stat === "anomalyProficiency" ? "flat" : "pct",
            label: stat,
        })
    }
    return {
        id,
        ownerId: "default",
        setId,
        setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: {
            ...mainStat,
            mode: mainStat.mode ?? "flat",
            label: mainStat.stat,
        },
        subStats,
        source: {
            type: "benchmark-warehouse",
            sequence: Number(id.replace(/\D/g, "")) || 9999,
        },
    }
}

function warehouseStore(variantsPerMainSetSlot = 4) {
    const driveDiscs = []
    for (const slot of [1, 2, 3, 4, 5, 6]) {
        for (const setId of [fourSet, twoSet]) {
            for (const mainStat of warehouseSlotMainOptions[slot]) {
                for (let variant = 0; variant < variantsPerMainSetSlot; variant += 1) {
                    driveDiscs.push(warehouseDisc(
                        `w-${setId}-${slot}-${mainStat.stat}-${variant}`,
                        setId,
                        slot,
                        mainStat,
                        variant + slot,
                    ))
                }
            }
        }
    }
    return {
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs,
    }
}

function runBenchmark(scale, store, algorithm) {
    const started = performance.now()
    const result = optimizeDriveDiscs(catalog, store, optimizerInput(algorithm))
    const elapsedMs = performance.now() - started
    return {
        scale: scale.id,
        algorithm,
        elapsedMs,
        top: result.results.map(item => ({
            ids: item.driveDiscs.map(disc => disc.id).join("|"),
            score: Number(item.score.toFixed(6)),
        })),
        metrics: result.metrics,
    }
}

async function runBenchmarkAsync(scale, store, algorithm) {
    const started = performance.now()
    const result = await optimizeDriveDiscsAsync(catalog, store, optimizerInput(algorithm))
    const elapsedMs = performance.now() - started
    return {
        scale: scale.id,
        algorithm,
        elapsedMs,
        top: result.results.map(item => ({
            ids: item.driveDiscs.map(disc => disc.id).join("|"),
            score: Number(item.score.toFixed(6)),
        })),
        metrics: result.metrics,
    }
}

function assertTopMatches(scale, legacy, superBound) {
    if (JSON.stringify(legacy.top) !== JSON.stringify(superBound.top)) {
        throw new Error([
            `exact-super-bound Top5 scores do not match exact-legacy for ${scale.id}`,
            `legacy=${JSON.stringify(legacy.top)}`,
            `superBound=${JSON.stringify(superBound.top)}`,
            `metrics=${JSON.stringify(superBound.metrics)}`,
        ].join("\n"))
    }
}

function row(item) {
    const metrics = item.metrics
    return {
        scale: item.scale,
        algorithm: item.algorithm,
        strictExact: metrics.strictExact,
        scoreKernel: metrics.scoreKernel ?? "map",
        kernelProbeMs: Number(metrics.scoreKernelProbeMs ?? 0).toFixed(1),
        kernelDenseMs: Number(metrics.scoreKernelDenseProbeMs ?? 0).toFixed(1),
        kernelMapMs: Number(metrics.scoreKernelMapProbeMs ?? 0).toFixed(1),
        avgKernelMs: Number(metrics.avgScoreKernelMs ?? 0).toFixed(5),
        kernelFallback: metrics.scoreKernelFallbackReason ?? "",
        indexedScore: metrics.indexedScoreEnabled ?? false,
        workerCount: metrics.workerCount ?? 1,
        elapsedMs: Math.round(item.elapsedMs),
        evaluated: metrics.processedCombinationCount ?? (metrics.evaluated + (metrics.prunedBySuperBound ?? 0)),
        scored: metrics.scoredCombinationCount ?? metrics.evaluated,
        evalPerSecond: Math.round(metrics.evaluationsPerSecond ?? 0),
        planBuildMs: Number(metrics.planBuildMs ?? 0).toFixed(1),
        boundCheckMs: Number(metrics.boundCheckMs ?? 0).toFixed(1),
        scoreOnlyMs: Number(metrics.scoreOnlyMs ?? 0).toFixed(1),
        denseScoreMs: Number(metrics.denseScoreMs ?? 0).toFixed(1),
        vectorScoreMs: Number(metrics.vectorScoreMs ?? 0).toFixed(1),
        fullResultMs: Number(metrics.fullResultMs ?? 0).toFixed(1),
        taskStateBuildMs: Number(metrics.taskStateBuildMs ?? 0).toFixed(1),
        warmupMs: Number(metrics.warmupMs ?? 0).toFixed(1),
        seedBudgetUsed: metrics.seedBudgetUsed ?? 0,
        parallelPrewarmMs: Number(metrics.parallelPrewarmMs ?? 0).toFixed(1),
        superBoundChecks: metrics.superBoundChecks ?? 0,
        groupBoundChecks: metrics.groupBoundChecks ?? 0,
        chunkBoundChecks: metrics.chunkBoundChecks ?? 0,
        discBoundChecks: metrics.discBoundChecks ?? 0,
        suffixTopKChecks: metrics.suffixTopKBoundChecks ?? 0,
        boundOracleChecks: metrics.boundOracleChecks ?? 0,
        safeBoundFallbacks: metrics.safeBoundFallbacks ?? 0,
        avgBoundCheckMs: Number(metrics.avgBoundCheckMs ?? 0).toFixed(4),
        prunedBySuperBound: metrics.prunedBySuperBound ?? 0,
        prunedByChunkBound: metrics.prunedByChunkBound ?? 0,
        prunedBySuffixTopK: metrics.prunedBySuffixTopKBound ?? 0,
        prunedByGlobalCutoff: metrics.prunedByGlobalCutoff ?? 0,
        skippedDiscBoundChecks: metrics.skippedDiscBoundChecks ?? 0,
        skippedDiscByPolicy: metrics.skippedDiscBoundChecksByPolicy ?? 0,
        parallelTasks: metrics.parallelTaskCount ?? 0,
        completedTasks: metrics.completedTaskCount ?? 0,
        taskSteals: metrics.taskStealCount ?? 0,
        workerIdlePct: `${(Number(metrics.workerIdleRatio ?? 0) * 100).toFixed(1)}%`,
        slowestWorkerMs: Number(metrics.slowestWorkerMs ?? 0).toFixed(1),
        workerStartupMs: Number(metrics.workerStartupMs ?? 0).toFixed(1),
        taskDispatchMs: Number(metrics.taskDispatchMs ?? 0).toFixed(3),
        globalCutoffUpdates: metrics.globalCutoffUpdates ?? 0,
        denseScoreCalls: metrics.denseScoreCalls ?? 0,
        scratchBufferReuses: metrics.scratchBufferReuses ?? 0,
        vectorScoreCalls: metrics.vectorScoreCalls ?? 0,
        vectorScoreFallbacks: metrics.vectorScoreFallbacks ?? 0,
        topScore: Math.round(item.top[0]?.score ?? 0),
    }
}

const rows = []
for (const scale of scales) {
    const store = benchmarkStore(scale.variantsPerSetSlot)
    const legacy = runBenchmark(scale, store, "exact-legacy")
    const superBound = runBenchmark(scale, store, "exact-super-bound")
    const parallel = await runBenchmarkAsync(scale, store, "exact-super-bound-parallel")
    assertTopMatches(scale, legacy, superBound)
    assertTopMatches(scale, legacy, parallel)
    if (scale.id === "medium" && superBound.elapsedMs > legacy.elapsedMs) {
        throw new Error(`exact-super-bound should not be slower than exact-legacy on medium benchmark (${superBound.elapsedMs.toFixed(1)}ms > ${legacy.elapsedMs.toFixed(1)}ms)`)
    }
    rows.push(row(legacy), row(superBound), row(parallel))
}

const chunked = runBenchmark(
    { id: "chunked" },
    benchmarkStore(9),
    "exact-super-bound",
)
if (!chunked.metrics.strictExact || Number(chunked.metrics.chunkBoundChecks ?? 0) <= 0) {
    throw new Error("chunked exact-super-bound benchmark must exercise strict chunk bounds")
}
rows.push(row(chunked))

const warehouse = runBenchmark(
    { id: "warehouse" },
    warehouseStore(4),
    "exact-super-bound",
)
if (!warehouse.metrics.strictExact) {
    throw new Error("warehouse exact-super-bound benchmark must remain strict exact")
}
rows.push(row(warehouse))

console.table(rows)
