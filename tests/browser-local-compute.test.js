import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { calculateInCombatPanel as backendCalculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { analyzeDriveDiscStatDiffs as backendAnalyzeDriveDiscStatDiffs, analyzeDriveDiscStatGains as backendAnalyzeDriveDiscStatGains, analyzeDriveDiscSubstats as backendAnalyzeDriveDiscSubstats } from "../core/driveDiscAnalysis-core.js"
import { optimizeDriveDiscsAsync as backendOptimizeDriveDiscsAsync, previewDriveDiscOptimization as backendPreviewDriveDiscOptimization } from "../backend/driveDiscOptimizer.js"
import { calculateInCombatPanel as browserCalculateInCombatPanel } from "../core/calculator-core.js"
import { analyzeDriveDiscStatDiffs as browserAnalyzeDriveDiscStatDiffs, analyzeDriveDiscStatGains as browserAnalyzeDriveDiscStatGains, analyzeDriveDiscSubstats as browserAnalyzeDriveDiscSubstats } from "../core/driveDiscAnalysis-core.js"
import { createDriveDiscOptimizerRuntime, previewDriveDiscOptimization as browserPreviewDriveDiscOptimization } from "../core/driveDiscOptimizer-core.js"

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
    currentOwnerId: "default",
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
    ],
}

const payload = {
    ...exampleInput,
    driveDiscs: store.driveDiscs.slice(0, 6),
    combatBuffs: {
        activeBuffIds: ["buff_h2r7x5p1kd"],
    },
    damage: {
        selectedEventId: "direct-hit",
        events: [
            {
                id: "direct-hit",
                kind: "direct",
                label: "Direct Hit",
                skillMultiplier: 100,
                critMode: "expected",
                count: 1,
            },
        ],
    },
}
const optimizerInput = {
    ...payload,
    driveDiscs: [],
    settings: {
        objective: "damage",
        fourPieceSetId: fourSet,
        twoPieceSetId: twoSet,
        algorithm: "exact-super-bound",
        enableUpperBoundPruning: true,
    },
}

assert.deepEqual(
    browserCalculateInCombatPanel(catalog, payload),
    backendCalculateInCombatPanel(catalog, payload),
    "Browser damage core should match backend damage calculation.",
)

const aliceMasteryDiscs = [
    disc("alice-p1", "phaethons_melody", 1, { stat: "hpFlat", value: 0 }),
    disc("alice-p2", "phaethons_melody", 2, { stat: "atkFlat", value: 0 }),
    disc("alice-f3", "fanged_metal", 3, { stat: "defFlat", value: 0 }),
    disc("alice-f4", "fanged_metal", 4, { stat: "anomalyProficiency", value: 0 }),
    disc("alice-f5", "fanged_metal", 5, { stat: "physicalDmg", value: 0, mode: "pct" }),
    disc("alice-f6", "fanged_metal", 6, { stat: "anomalyMastery", value: 30, mode: "pct" }),
]
const alicePayload = {
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    driveDiscs: aliceMasteryDiscs,
    combatBuffs: { activeBuffIds: ["agent:alice_thymefield.additionalAbility"] },
    damage: catalog.agentsMap.get("alice_thymefield").defaultCalculationConfig,
}
const browserAlice = browserCalculateInCombatPanel(catalog, alicePayload)
const backendAlice = backendCalculateInCombatPanel(catalog, alicePayload)
assert.deepEqual(browserAlice, backendAlice, "Browser Alice mastery calculation should match backend.")
assert.equal(browserAlice.outOfCombat.panel.anomalyMastery, 195.96)
assert.equal(browserAlice.inCombat.panel.anomalyProficiency, 207.536)

assert.deepEqual(
    browserAnalyzeDriveDiscSubstats(catalog, payload),
    backendAnalyzeDriveDiscSubstats(catalog, payload),
    "Browser drive-disc substat analysis should match backend.",
)

assert.deepEqual(
    browserAnalyzeDriveDiscStatGains(catalog, payload),
    backendAnalyzeDriveDiscStatGains(catalog, payload),
    "Browser drive-disc gain analysis should match backend.",
)

assert.deepEqual(
    browserAnalyzeDriveDiscStatDiffs(catalog, payload),
    backendAnalyzeDriveDiscStatDiffs(catalog, payload),
    "Browser drive-disc difference analysis should match backend.",
)

const browserPreview = browserPreviewDriveDiscOptimization(catalog, store, optimizerInput)
const backendPreview = backendPreviewDriveDiscOptimization(catalog, store, optimizerInput)
assert.equal(browserPreview.metrics.algorithmId, backendPreview.metrics.algorithmId)
assert.equal(browserPreview.metrics.estimatedCombinationCount, backendPreview.metrics.estimatedCombinationCount)
assert.deepEqual(browserPreview.metrics.candidateCountsBySlot, backendPreview.metrics.candidateCountsBySlot)
assert.deepEqual(browserPreview.settings.mainStatLimits, backendPreview.settings.mainStatLimits)

const backendOptimized = await backendOptimizeDriveDiscsAsync(catalog, store, optimizerInput, {
    chunkSize: 2,
    progressIntervalMs: 0,
    yieldIntervalMs: 0,
})
const originalSetImmediate = globalThis.setImmediate
let browserOptimized
let browserYieldCount = 0
try {
    globalThis.setImmediate = undefined
    const browserRuntime = createDriveDiscOptimizerRuntime({
        availableParallelism: () => 1,
        yieldControl: async () => {
            browserYieldCount += 1
        },
    })
    const preparedJob = browserRuntime.createJob(catalog, store, optimizerInput)
    const preparedPreview = preparedJob.preview()
    assert.equal(preparedPreview.metrics.estimatedCombinationCount, browserPreview.metrics.estimatedCombinationCount)
    browserOptimized = await preparedJob.run({
        chunkSize: 2,
        progressIntervalMs: 0,
        yieldIntervalMs: 0,
    })
    assert.equal(browserOptimized.metrics, preparedPreview.metrics, "Prepared preview and run should share one metrics object.")
    await assert.rejects(() => preparedJob.run(), /only be run once/)
} finally {
    globalThis.setImmediate = originalSetImmediate
}

assert.ok(browserYieldCount > 0, "Browser optimizer should use the injected event-loop yield adapter.")
assert.equal(browserOptimized.results.length, 10)
assert.equal(backendOptimized.results.length, 10)

assert.deepEqual(
    browserOptimized.results.slice(0, 10).map(result => result.driveDiscs.map(disc => disc.id)),
    backendOptimized.results.slice(0, 10).map(result => result.driveDiscs.map(disc => disc.id)),
    "Browser optimizer top 10 drive-disc IDs should match backend.",
)
assert.deepEqual(
    browserOptimized.results.slice(0, 10).map(result => result.score),
    backendOptimized.results.slice(0, 10).map(result => result.score),
    "Browser optimizer top 10 scores should match backend.",
)

const fallbackRuntime = createDriveDiscOptimizerRuntime({
    availableParallelism: () => 1,
    yieldControl: async () => {},
    runParallel: null,
})
const fallbackOptimized = await fallbackRuntime.optimizeDriveDiscsAsync(catalog, store, {
    ...optimizerInput,
    settings: {
        ...optimizerInput.settings,
        algorithm: "exact-super-bound-parallel",
    },
}, {
    chunkSize: 2,
    progressIntervalMs: 0,
    yieldIntervalMs: 0,
})
assert.equal(fallbackOptimized.metrics.parallelFallbackReason, "worker-unavailable")
assert.deepEqual(
    fallbackOptimized.results.slice(0, 10).map(result => result.driveDiscs.map(disc => disc.id)),
    browserOptimized.results.slice(0, 10).map(result => result.driveDiscs.map(disc => disc.id)),
    "Browser optimizer should preserve exact results when parallel workers are unavailable.",
)

const aliceFourSet = "fanged_metal"
const aliceTwoSet = "phaethons_melody"
const aliceOptimizerSlotMain = {
    1: { stat: "hpFlat", value: 2200 },
    2: { stat: "atkFlat", value: 316 },
    3: { stat: "defFlat", value: 184 },
    4: { stat: "anomalyProficiency", value: 92 },
}
const aliceOptimizerStore = {
    ...store,
    driveDiscs: [
        ...[1, 2, 3, 4].flatMap(slot => [
            disc(`browser-alice-ap-${slot}`, aliceFourSet, slot, aliceOptimizerSlotMain[slot], [
                { stat: "anomalyProficiency", value: 9 },
            ]),
            disc(`browser-alice-atk-${slot}`, aliceFourSet, slot, aliceOptimizerSlotMain[slot], [
                { stat: "atkPct", value: 6, mode: "pct" },
            ]),
        ]),
        disc("browser-alice-physical-5", aliceTwoSet, 5, { stat: "physicalDmg", value: 30, mode: "pct" }),
        disc("browser-alice-mastery-6", aliceTwoSet, 6, { stat: "anomalyMastery", value: 30, mode: "pct" }),
        disc("browser-alice-atk-6", aliceTwoSet, 6, { stat: "atkPct", value: 30, mode: "pct" }),
    ],
}
const aliceOptimizerInput = {
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: [
            "agent:alice_thymefield.corePassive",
            "agent:alice_thymefield.additionalAbility",
        ],
    },
    damage: catalog.agentsMap.get("alice_thymefield").defaultCalculationConfig,
    settings: {
        objective: "damage",
        fourPieceSetId: aliceFourSet,
        twoPieceSetId: aliceTwoSet,
        mainStatLimits: { 6: ["anomalyMastery", "atkPct"] },
        algorithm: "exact-super-bound",
    },
}
const backendAliceOptimized = await backendOptimizeDriveDiscsAsync(catalog, aliceOptimizerStore, aliceOptimizerInput)
const aliceBrowserRuntime = createDriveDiscOptimizerRuntime({
    availableParallelism: () => 1,
    yieldControl: async () => {},
})
const browserAliceOptimized = await aliceBrowserRuntime.optimizeDriveDiscsAsync(catalog, aliceOptimizerStore, aliceOptimizerInput)
assert.equal(browserAliceOptimized.results.length, 10, "Browser Alice optimizer fixture should return a full Top 10.")
assert.deepEqual(
    browserAliceOptimized.results.map(result => result.driveDiscs.map(item => item.id)),
    backendAliceOptimized.results.map(result => result.driveDiscs.map(item => item.id)),
    "Browser Alice optimizer Top 10 IDs should match backend.",
)
assert.deepEqual(
    browserAliceOptimized.results.map(result => result.score),
    backendAliceOptimized.results.map(result => result.score),
    "Browser Alice optimizer Top 10 scores should match backend.",
)
assert.equal(
    browserAliceOptimized.results[0].driveDiscs.find(item => Number(item.partition) === 6)?.mainStat?.stat,
    "anomalyMastery",
)
assert.equal(browserAliceOptimized.results[0].data.outOfCombat.panel.anomalyMastery, 195.96)
