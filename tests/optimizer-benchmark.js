import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs } from "../backend/driveDiscOptimizer.js"

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
            ...(algorithm === "exact-legacy" ? { enableUpperBoundPruning: false } : {}),
        },
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

function assertTopMatches(scale, legacy, superBound) {
    const legacyScores = legacy.top.map(item => item.score)
    const superBoundScores = superBound.top.map(item => item.score)
    if (JSON.stringify(legacyScores) !== JSON.stringify(superBoundScores)) {
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
        elapsedMs: Math.round(item.elapsedMs),
        evaluated: metrics.processedCombinationCount ?? (metrics.evaluated + (metrics.prunedBySuperBound ?? 0)),
        scored: metrics.scoredCombinationCount ?? metrics.evaluated,
        evalPerSecond: Math.round(metrics.evaluationsPerSecond ?? 0),
        planBuildMs: Number(metrics.planBuildMs ?? 0).toFixed(1),
        boundCheckMs: Number(metrics.boundCheckMs ?? 0).toFixed(1),
        scoreOnlyMs: Number(metrics.scoreOnlyMs ?? 0).toFixed(1),
        fullResultMs: Number(metrics.fullResultMs ?? 0).toFixed(1),
        warmupMs: Number(metrics.warmupMs ?? 0).toFixed(1),
        superBoundChecks: metrics.superBoundChecks ?? 0,
        prunedBySuperBound: metrics.prunedBySuperBound ?? 0,
        skippedDiscBoundChecks: metrics.skippedDiscBoundChecks ?? 0,
        topScore: Math.round(item.top[0]?.score ?? 0),
    }
}

const rows = []
for (const scale of scales) {
    const store = benchmarkStore(scale.variantsPerSetSlot)
    const legacy = runBenchmark(scale, store, "exact-legacy")
    const superBound = runBenchmark(scale, store, "exact-super-bound")
    assertTopMatches(scale, legacy, superBound)
    if (scale.id === "medium" && superBound.elapsedMs > legacy.elapsedMs) {
        throw new Error(`exact-super-bound should not be slower than exact-legacy on medium benchmark (${superBound.elapsedMs.toFixed(1)}ms > ${legacy.elapsedMs.toFixed(1)}ms)`)
    }
    rows.push(row(legacy), row(superBound))
}

console.table(rows)
