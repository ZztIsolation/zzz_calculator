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

const driveDiscs = []
for (const slot of [1, 2, 3, 4, 5, 6]) {
    for (let variant = 0; variant < 4; variant += 1) {
        driveDiscs.push(disc(`f${slot}-${variant}`, fourSet, slot, variant))
        driveDiscs.push(disc(`h${slot}-${variant}`, twoSet, slot, variant + 8))
    }
}

const store = {
    version: 1,
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs,
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
        },
    }
}

function runBenchmark(algorithm) {
    const started = performance.now()
    const result = optimizeDriveDiscs(catalog, store, optimizerInput(algorithm))
    const elapsedMs = performance.now() - started
    return {
        algorithm,
        elapsedMs,
        topScore: result.results[0]?.score ?? 0,
        metrics: result.metrics,
    }
}

const legacy = runBenchmark("exact-legacy")
const superBound = runBenchmark("exact-super-bound")

const rows = [legacy, superBound].map(item => ({
    algorithm: item.algorithm,
    strictExact: item.metrics.strictExact,
    elapsedMs: Math.round(item.elapsedMs),
    evaluated: item.metrics.processedCombinationCount ?? (item.metrics.evaluated + (item.metrics.prunedBySuperBound ?? 0)),
    scored: item.metrics.scoredCombinationCount ?? item.metrics.evaluated,
    evalPerSecond: Math.round(item.metrics.evaluationsPerSecond ?? 0),
    prunedBySuperBound: item.metrics.prunedBySuperBound ?? 0,
    superBoundChecks: item.metrics.superBoundChecks ?? 0,
    topScore: Math.round(item.topScore),
}))

console.table(rows)
if (Math.abs(legacy.topScore - superBound.topScore) > 1e-6) {
    throw new Error("exact-super-bound top score does not match exact-legacy")
}
