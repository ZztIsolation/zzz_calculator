import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime, OptimizerCancelledError } from "../core/driveDiscOptimizer-core.js"
import { compileInitialEnergyFormula } from "../core/effectFormula.js"
import { evaluateFormulaExpression } from "../core/formulaEvaluator.js"
import { velinaOptimizerInput, velinaOptimizerStore } from "./fixtures/velina-optimizer.js"

const catalog = await loadCalculatorContext(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
const energySetIds = ["swing_jazz", "moonlight_lullaby"]
assert.deepEqual(catalog.agentsMap.get("velina").preferredDriveDiscs.defaultTwoPieceSetIds, energySetIds)
const energyStore = velinaOptimizerStore({ variants: 1, recommended: true, freeTwoPiece: true })
energyStore.driveDiscs.push(...energyStore.driveDiscs.filter(disc => disc.setId === "swing_jazz")
    .map(disc => ({ ...disc, id: `moonlight-${disc.id}`, setId: "moonlight_lullaby" })))
const defaultEnergyInput = velinaOptimizerInput({ recommended: true, freeTwoPiece: true })
delete defaultEnergyInput.settings.twoPieceSetIds
const defaultEnergyResult = optimizeDriveDiscs(catalog, energyStore, defaultEnergyInput)
assert.deepEqual(defaultEnergyResult.settings.twoPieceSetIds, energySetIds)
assert.ok(defaultEnergyResult.results.length > 0)
assert.ok(defaultEnergyResult.results.every(row => {
    const counts = new Map()
    for (const disc of row.driveDiscs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    return counts.get("zzz_wiki_2038") === 4 && energySetIds.some(id => counts.get(id) === 2)
}))
const explicitEnergy = optimizeDriveDiscs(catalog, energyStore, { ...defaultEnergyInput, settings: { ...defaultEnergyInput.settings, twoPieceSetIds: energySetIds } })
assert.deepEqual(defaultEnergyResult.results.map(row => row.driveDiscIdsBySlot), explicitEnergy.results.map(row => row.driveDiscIdsBySlot))
const defaultBrowserResult = await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog, energyStore, defaultEnergyInput)
assert.deepEqual(defaultBrowserResult.results.map(row => row.driveDiscIdsBySlot), explicitEnergy.results.map(row => row.driveDiscIdsBySlot))
const unrestrictedEnergy = optimizeDriveDiscs(catalog, energyStore, { ...defaultEnergyInput, settings: { ...defaultEnergyInput.settings, twoPieceSetIds: [] } })
assert.deepEqual(unrestrictedEnergy.settings.twoPieceSetIds, [])
assert.ok(unrestrictedEnergy.metrics.estimatedCombinationCount > defaultEnergyResult.metrics.estimatedCombinationCount)
const noEnergyStore = velinaOptimizerStore({ variants: 1, recommended: true })
assert.equal(optimizeDriveDiscs(catalog, noEnergyStore, defaultEnergyInput).results.length, 0)
assert.ok(optimizeDriveDiscs(catalog, noEnergyStore, { ...defaultEnergyInput, settings: { ...defaultEnergyInput.settings, twoPieceSetIds: [] } }).results.length > 0)
const input = velinaOptimizerInput()
const calculator = createInCombatPanelCalculator(catalog, input)
const stats = new Map([["energyRegen", 60], ["atkPct", 30], ["anomalyProficiency", 92]])
const dense = calculator.compileDensePanelScoreTarget({ statIds: [...stats.keys()], setIds: [], setIndexById: new Map() })
const expected = calculator.scoreOnlyFromSummaryLegacy(stats, new Map())
const actual = dense.scoreDense([...stats.values()], [])
assert.ok(Math.abs(actual.finalDamage - expected.finalDamage) < 1e-7, `Core Passive must be evaluated from each candidate's initial panel: ${actual.finalDamage} vs ${expected.finalDamage}`)
assert.equal(actual.panel.anomalyMastery, expected.panel.anomalyMastery)

function approx(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-12), `${label}: ${actual} vs ${expected}`)
}
const energyRules = catalog.agentsMap.get("velina").combatBuffs.corePassive.effects.filter(rule => rule.source?.kind === "outOfCombatStat")
const boundaries = [0, 1.2 - 1e-12, 1.2, 1.2 + 1e-12, 1.21 - 1e-12, 1.21, 1.21 + 1e-12, 1.92, 2.64, 2.87 - 1e-12, 2.87, 2.87 + 1e-12, 2.88 - 1e-12, 2.88, 2.88 + 1e-12, 3.5]
for (const rule of energyRules) {
    const compiled = compileInitialEnergyFormula(rule)
    assert.equal(typeof compiled, "function")
    for (const x of boundaries) assert.equal(compiled(x), evaluateFormulaExpression(rule.formula.expression, { x }), `${rule.id}/${x}`)
    const parameterized = { ...rule, formula: { expression: "clamp(floor(max(x - threshold, 0) / step) * rate, 0, cap)", parameters: { threshold: 1.2, step: 0.01, rate: 0.21, cap: 35 } } }
    for (const x of boundaries) assert.equal(compileInitialEnergyFormula(parameterized)(x), evaluateFormulaExpression(parameterized.formula.expression, { x, ...parameterized.formula.parameters }))
    const percentSource = { ...rule, source: { ...rule.source, unit: "storedPercent", integer: true, min: 1.2, max: 2.9 } }
    for (const value of [0, 0.012, 0.0192, 0.0264, 1]) {
        const x = Math.max(1.2, Math.min(2.9, Math.round(value * 100)))
        assert.equal(compileInitialEnergyFormula(percentSource)(value), evaluateFormulaExpression(rule.formula.expression, { x }))
    }
}
for (const expression of ["clamp(floor(max(x - 1 .2, 0) / 0.01) * 0.21, 0, 35)", "clamp(floor(max(x - 1.2, 0) / 0) * 0.21, 0, 35)"]) {
    assert.equal(compileInitialEnergyFormula({ ...energyRules[0], formula: { expression } }), null)
}

const directEvent = { id: "direct", kind: "direct", skillMultiplier: 1.7, count: 2, stunned: false }
const eventCases = [
    ...["micro_vortex", "broad_vortex", "ultimate_wind"].map(releaseSource => velinaOptimizerInput({ releaseSource }).damage.events),
    [{ id: "attribute", kind: "anomaly", settlementType: "attribute", anomalyEffect: "wind_corrosion", count: 1 }],
    [directEvent],
    [directEvent, ...input.damage.events],
]
let parityChecks = 0
for (const [caseIndex, events] of eventCases.entries()) {
    for (const coverage of [0, 0.5, 1]) {
        const probeInput = velinaOptimizerInput({
            coreSkillLevel: caseIndex % 2 ? "A" : "F",
            damage: { mode: "custom", events, selectedEventId: events[0].id },
            combatBuffs: {
                activeBuffIds: ["agent:velina.corePassive", "agent:velina.cinema.2", "agent:velina.cinema.6", "wEngine:zzz_wiki_2030.self"],
                runtimeInputs: { "agent:velina.corePassive": { coverage } },
                // Initial-source conversion must ignore in-combat energy, and
                // mastery must be available before mastery-to-proficiency conversion.
                manualStats: [{ stat: "energyRegen", value: 100, mode: "pct" }, { stat: "anomalyProficiencyPerMasteryAbove140", value: 0.5 }],
            },
        })
        const p = createInCombatPanelCalculator(catalog, probeInput)
        const statIds = ["energyRegen", "atkPct", "anomalyProficiency"]
        const d = p.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
        assert.ok(d)
        const f = d.compileForSetCounts([])
        assert.equal(typeof f.scoreObjectiveScalar, "function")
        if (events.some(event => event.settlementType === "release")) assert.equal(f.releaseIntervalBound, true)
        for (const energy of [0, 0.8333333333, 0.8333333334, 60, 80, 160]) {
            const values = [energy, 30, 92]
            const totals = new Map(statIds.map((id, i) => [id, values[i]]))
            const legacy = p.scoreOnlyFromSummaryLegacy(totals, new Map())
            for (const summary of [p.scoreOnlyFromSummary(totals, new Map()), p.scoreOnlyFromIndexedSummary(values, statIds, [], [], new Map()), d.scoreDense(values, [])]) {
                approx(summary.finalDamage, legacy.finalDamage, `summary ${caseIndex}/${coverage}/${energy}`)
                for (const stat of ["dmgBonus", "anomalyMastery", "anomalyProficiency", "energyRegen"]) approx(summary.panel[stat], legacy.panel[stat], stat)
            }
            approx(f.scoreScalar(values).finalDamage, legacy.finalDamage, "fixed")
            approx(f.scoreObjectiveScalar(values).finalDamage, legacy.finalDamage, "scalar")
            approx(f.scoreCombinedScalar(values).finalDamage, legacy.finalDamage, "combined exact")
            const full = p.calculate([{ slot: 6, mainStat: { stat: "energyRegen", value: energy, mode: "pct" }, subStats: [{ stat: "atkPct", value: 30, mode: "pct" }, { stat: "anomalyProficiency", value: 92 }] }], { round: false })
            approx(full.damage.totalFinalDamage, legacy.finalDamage, "ordinary calculator")
            parityChecks += 1
        }
    }
}

// Unsupported rules must reject the fast target, rather than silently becoming
// zero in the compiled entry. Disabled / statically inapplicable rules are safe.
for (const change of [
    { formula: { expression: "x * x" } },
    { formula: { expression: "clamp(floor(max(x - 1.2, 0) / 0.01) * -0.21, 0, 35)" } },
    { source: { ...energyRules[0].source, stat: "atk" } },
    { target: { kind: "anomaly", settlementType: "release" } },
    { requirement: { outOfCombatStat: { stat: "energyRegen", min: 2 } } },
]) {
    const rule = { ...energyRules[0], ...change, id: "unsupported" }
    const fallbackInput = velinaOptimizerInput({ combatBuffs: { activeBuffIds: [], manualEffects: [{ id: "unsupported", effects: [rule] }] } })
    const p = createInCombatPanelCalculator(catalog, fallbackInput)
    assert.equal(p.compileDensePanelScoreTarget(), null)
}
const disabled = velinaOptimizerInput({ combatBuffs: { activeBuffIds: ["agent:velina.corePassive"], runtimeInputs: { "agent:velina.corePassive": { effects: Object.fromEntries(energyRules.map(rule => [rule.id, { enabled: false }])) } } } })
const disabledCalc = createInCombatPanelCalculator(catalog, disabled)
approx(disabledCalc.compileDensePanelScoreTarget({ statIds: [...stats.keys()] }).scoreDense([...stats.values()], []).finalDamage, disabledCalc.scoreOnlyFromSummaryLegacy(stats, new Map()).finalDamage, "disabled formula")

function assertTop(actual, truth, label) {
    assert.equal(actual.results.length, 10, `${label}: full Top 10`)
    assert.deepEqual(actual.results.map(row => row.driveDiscIdsBySlot), truth.results.map(row => row.driveDiscIdsBySlot), `${label}: stable IDs`)
    actual.results.forEach((row, i) => approx(row.score, truth.results[i].score, `${label}/${i}`))
    assert.equal(actual.metrics.strictExact, true)
    assert.equal(actual.metrics.estimatedCombinationCount, truth.metrics.estimatedCombinationCount)
}

let totalPruned = 0
for (let index = 0; index < eventCases.length; index += 1) {
    const options = { variants: 2, variableEnergy: true, recommended: index % 2 === 0, freeTwoPiece: index === 2 }
    const store = velinaOptimizerStore(options)
    const events = eventCases[index]
    const request = velinaOptimizerInput({ ...options, damage: { mode: "custom", events, selectedEventId: events[0].id } })
    if (index === 0 || index === 3) request.settings.minimums = { anomalyMastery: catalog.agentsMap.get("velina").level60.anomalyMastery + 50 }
    request.combatBuffs.activeBuffIds.push("agent:velina.cinema.2", "agent:velina.cinema.6", "wEngine:zzz_wiki_2030.self")
    const truth = optimizeDriveDiscs(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } })
    const fast = optimizeDriveDiscs(catalog, store, request)
    assertTop(fast, truth, `optimizer ${index}`)
    assert.notEqual(fast.metrics.scoreKernelFallbackReason, "mismatch")
    totalPruned += fast.metrics.prunedBySuperBound
    for (const row of fast.results) {
        const full = calculateInCombatPanel(catalog, {
            ...request,
            driveDiscs: row.driveDiscs.map(disc => ({ ...disc, slot: disc.partition })),
            combatBuffs: { ...request.combatBuffs, activeBuffIds: [...request.combatBuffs.activeBuffIds, `driveDisc4pc:${request.settings.fourPieceSetId}.self`, `driveDisc4pc:${request.settings.fourPieceSetId}.team`] },
        })
        approx(row.score, full.damage.totalFinalDamage, "full-result oracle")
    }
    if (index === 1) {
        const nodeWorker = await optimizeDriveDiscsAsync(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } })
        assertTop(nodeWorker, truth, "Node workers")
        const progress = []
        const browserRuntime = createDriveDiscOptimizerRuntime({ yieldControl: () => Promise.resolve() })
        const browser = await browserRuntime.optimizeDriveDiscsAsync(catalog, store, request, { chunkSize: 1, yieldIntervalMs: 0, progressIntervalMs: 0, onProgress: p => progress.push(p) })
        assertTop(browser, truth, "browser runtime")
        assert.ok(progress.length > 0)
        assert.equal(browser.metrics.processedCombinationCount, browser.metrics.estimatedCombinationCount)
        await assert.rejects(browserRuntime.optimizeDriveDiscsAsync(catalog, store, request, { shouldCancel: () => true, chunkSize: 1 }), OptimizerCancelledError)
    }
}
assert.ok(totalPruned > 0)

// At every node of each small randomized tree, the combined scalar bound must
// cover all actual descendants. Ordinary legacy scoring supplies the oracle.
let boundChecks = 0
for (let seed = 1; seed <= 16; seed += 1) {
    let state = seed
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32)
    const request = velinaOptimizerInput({ releaseSource: ["micro_vortex", "broad_vortex", "ultimate_wind"][seed % 3] })
    request.combatBuffs.manualStats = [{ stat: "anomalyProficiencyPerMasteryAbove140", value: 0.5 }]
    const p = createInCombatPanelCalculator(catalog, request)
    const ids = ["energyRegen", "atkPct", "anomalyProficiency"]
    const f = p.compileDensePanelScoreTarget({ statIds: ids }).compileForSetCounts([])
    const slots = Array.from({ length: 6 }, () => Array.from({ length: 2 }, () => [random() * 18, random() * 10, Math.floor(random() * 50)]))
    const suffix = Array.from({ length: 7 }, () => [0, 0, 0])
    for (let i = 5; i >= 0; i -= 1) suffix[i] = ids.map((_, j) => suffix[i + 1][j] + Math.max(...slots[i].map(v => v[j])))
    function walk(depth, values) {
        if (depth === 6) return p.scoreOnlyFromSummaryLegacy(new Map(ids.map((id, i) => [id, values[i]])), new Map()).finalDamage
        const bound = f.scoreCombinedScalar(values, null, suffix[depth]).finalDamage
        const max = Math.max(...slots[depth].map(option => walk(depth + 1, values.map((v, i) => v + option[i]))))
        assert.ok(bound + 1e-7 >= max, `seed ${seed}, depth ${depth}: ${bound} < ${max}`)
        boundChecks += 1
        return max
    }
    walk(0, [0, 0, 0])
}
console.log(`Velina optimizer tests passed (${parityChecks} cross-path candidates, ${boundChecks} exhaustive subtree bounds, ${totalPruned} pruned combinations)`)
