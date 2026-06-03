import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../backend/calculator.js"
import {
    OptimizerCancelledError,
    optimizeDriveDiscs,
    optimizeDriveDiscsAsync,
} from "../backend/driveDiscOptimizer.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

function disc(id, setId, partition, mainStat, subStats = []) {
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
        subStats: subStats.map(stat => ({
            ...stat,
            mode: stat.mode ?? "flat",
            label: stat.stat,
        })),
        source: {
            type: "test",
            sequence: Number(id.replace(/\D/g, "")) || 999,
        },
    }
}

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
const store = {
    version: 1,
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`f${slot}`, fourSet, slot, slotMain[slot], [
            { stat: "critRate", value: slot === 4 ? 2.4 : 4.8, mode: "pct" },
            { stat: "critDmg", value: 9.6 + slot, mode: "pct" },
            { stat: "atkPct", value: 3 + slot, mode: "pct" },
        ])),
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`h${slot}`, twoSet, slot, slotMain[slot], [
            { stat: "critRate", value: 2.4, mode: "pct" },
            { stat: "critDmg", value: 4.8 + slot, mode: "pct" },
            { stat: "atkPct", value: 6, mode: "pct" },
        ])),
        disc("f4-atk", fourSet, 4, { stat: "atkPct", value: 30, mode: "pct" }, [
            { stat: "critDmg", value: 24, mode: "pct" },
            { stat: "atkPct", value: 9, mode: "pct" },
        ]),
    ],
}

function responsiveCancellationStore(candidatesPerSet = 6) {
    const driveDiscs = []
    for (const slot of [1, 2, 3, 4, 5, 6]) {
        for (const setId of [fourSet, twoSet]) {
            for (let index = 0; index < candidatesPerSet; index += 1) {
                driveDiscs.push(disc(`cancel-${setId}-${slot}-${index}`, setId, slot, slotMain[slot], [
                    { stat: "critRate", value: 2 + index * 0.7, mode: "pct" },
                    { stat: "critDmg", value: 24 - index * 2, mode: "pct" },
                    { stat: "atkPct", value: index % 3, mode: "pct" },
                ]))
            }
        }
    }
    return {
        ...store,
        driveDiscs,
    }
}

function optimizerInput(overrides = {}) {
    const { settings: settingsOverride = {}, ...rest } = overrides
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
            objective: "damage",
            ...settingsOverride,
        },
        ...rest,
    }
}

function resultIds(result) {
    return result.results.map(item => item.driveDiscs.map(disc => disc.id).join("|"))
}

const sync = optimizeDriveDiscs(catalog, store, optimizerInput())
const progressEvents = []
const asyncResult = await optimizeDriveDiscsAsync(catalog, store, optimizerInput(), {
    chunkSize: 1,
    progressIntervalMs: 0,
    onProgress: progress => {
        progressEvents.push(progress)
    },
})
assert.deepEqual(resultIds(asyncResult), resultIds(sync))
assert.equal(asyncResult.metrics.evaluated, sync.metrics.evaluated)
assert.equal(
    asyncResult.metrics.processedCombinationCount,
    asyncResult.metrics.evaluated + asyncResult.metrics.prunedBySuperBound,
)
assert.ok(progressEvents.length > 2)
assert.equal(progressEvents.at(-1).status, "complete")
assert.equal(progressEvents.at(-1).percent, 100)
assert.equal(asyncResult.metrics.algorithmId, "exact-super-bound")
assert.equal(asyncResult.metrics.strictExact, true)
assert.ok(progressEvents.some(progress => progress.evaluated > 0 && progress.percent > 0))
assert.ok(progressEvents.some(progress => progress.evaluated === progress.metrics?.processedCombinationCount))
assert.ok(progressEvents.some(progress => Number(progress.metrics?.evaluationsPerSecond ?? 0) > 0))

const noResultEvents = []
const noResult = await optimizeDriveDiscsAsync(catalog, store, optimizerInput({
    settings: {
        mainStatLimits: {
            4: ["anomalyProficiency"],
        },
    },
}), {
    chunkSize: 1,
    progressIntervalMs: 0,
    onProgress: progress => noResultEvents.push(progress),
})
assert.equal(noResult.results.length, 0)
assert.equal(noResult.error.isError, true)
assert.equal(noResultEvents.at(-1).status, "complete")
assert.equal(noResultEvents.at(-1).percent, 100)

let shouldCancel = false
const cancelEvents = []
await assert.rejects(
    () => optimizeDriveDiscsAsync(catalog, store, optimizerInput({ settings: { twoPieceSetId: twoSet } }), {
        chunkSize: 1,
        progressIntervalMs: 0,
        shouldCancel: () => shouldCancel,
        onProgress: progress => {
            cancelEvents.push(progress)
            if (progress.evaluated >= 1) {
                shouldCancel = true
            }
        },
    }),
    OptimizerCancelledError,
)
assert.ok(cancelEvents.some(progress => progress.evaluated >= 1))
assert.ok(cancelEvents.at(-1).evaluated < cancelEvents.at(-1).estimatedCombinationCount)

let timedCancelRequested = false
const timedCancelTimer = setTimeout(() => {
    timedCancelRequested = true
}, 10)
try {
    await assert.rejects(
        () => optimizeDriveDiscsAsync(catalog, responsiveCancellationStore(), optimizerInput({
            settings: {
                algorithm: "exact-legacy",
                twoPieceSetId: twoSet,
                enableUpperBoundPruning: false,
            },
        }), {
            chunkSize: Number.MAX_SAFE_INTEGER,
            progressIntervalMs: 60_000,
            yieldIntervalMs: 1,
            shouldCancel: () => timedCancelRequested,
        }),
        OptimizerCancelledError,
    )
} finally {
    clearTimeout(timedCancelTimer)
}
assert.equal(timedCancelRequested, true)
