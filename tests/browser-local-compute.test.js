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
    browserOptimized = await browserRuntime.optimizeDriveDiscsAsync(catalog, store, optimizerInput, {
        chunkSize: 2,
        progressIntervalMs: 0,
        yieldIntervalMs: 0,
    })
} finally {
    globalThis.setImmediate = originalSetImmediate
}

assert.ok(browserYieldCount > 0, "Browser optimizer should use the injected event-loop yield adapter.")

assert.deepEqual(
    browserOptimized.results.slice(0, 5).map(result => result.driveDiscs.map(disc => disc.id)),
    backendOptimized.results.slice(0, 5).map(result => result.driveDiscs.map(disc => disc.id)),
    "Browser optimizer top 5 drive-disc IDs should match backend.",
)
assert.deepEqual(
    browserOptimized.results.slice(0, 5).map(result => result.score),
    backendOptimized.results.slice(0, 5).map(result => result.score),
    "Browser optimizer top 5 scores should match backend.",
)
