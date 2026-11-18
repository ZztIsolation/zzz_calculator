import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import { anomalyReleaseProfiles, evaluateReleaseExpression, evaluateReleaseExpressionInterval, evaluateAnomalyReleaseProfileInterval, createAnomalySourceSnapshot } from "../core/anomalyRelease.js"
import { corePassiveScalingRow } from "../core/corePassiveScaling.js"
import { resolveDamageEventMultiplier } from "../core/damageEventMultipliers.js"
import { nangongyuReleaseInput, nangongyuReleaseStore } from "./fixtures/nangongyu-release.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const agent = catalog.agentsMap.get("nangongyu")
const near = (a, b, label = "value") => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`)
const coreProfile = agent.anomalyReleaseProfiles.find(p => p.id === "core_tremolo_4")
const legacy = structuredClone(agent)
for (const profile of legacy.anomalyReleaseProfiles) {
    profile.minCinemaLevel = profile.minimumCinemaLevel
    delete profile.minimumCinemaLevel
}
for (const cinema of [0, 1, 2, 5, 6]) {
    const profiles = anomalyReleaseProfiles(agent, cinema)
    assert.equal(profiles.length, cinema === 6 ? 8 : 4)
    assert.deepEqual(anomalyReleaseProfiles(legacy, cinema).map(p => p.id), profiles.map(p => p.id))
}
for (const cinema of [0, 1, 2, 5]) {
    assert.throws(() => calculateInCombatPanel(catalog, nangongyuReleaseInput(cinema, "cinema6_tremolo_4")), /暂不支持/)
}
const factor = coreProfile.expression.args[1]
for (const [cinema, expectedFactor] of [[0, 2], [1, 2], [2, 2.4], [3, 2.4], [4, 2.4], [5, 2.4], [6, 2.4]]) {
    near(evaluateReleaseExpression(factor, { cinemaLevel: cinema }).value, expectedFactor)
    const interval = evaluateReleaseExpressionInterval(factor, { cinemaLevel: cinema })
    near(interval.min, expectedFactor)
    near(interval.max, expectedFactor)
    const expectedBase = cinema < 2 ? 9 : 10.8 // 0.625 × 7.2 × (1 + 4 × 25%/35%)
    const request = nangongyuReleaseInput(cinema)
    request.damage.events[0].cinemaLevel = cinema === 0 ? 6 : 0 // current build overrides stale event snapshots
    const full = calculateInCombatPanel(catalog, request)
    const event = full.damage.events[0]
    assert.equal(event.input.cinemaLevel, cinema)
    near(event.multipliers.anomaly, expectedBase)
    assert.ok(event.whiteBoxRows.some(row => row.formula?.includes(cinema < 2 ? "25%" : "35%")))
    near(resolveDamageEventMultiplier(request.damage.events[0], catalog, { agent, cinemaLevel: cinema, coreSkillLevel: "F" }), expectedBase)
    const bounds = evaluateAnomalyReleaseProfileInterval(coreProfile, { cinemaLevel: cinema, originalBaseMultiplier: 0.625,
        eventElement: "ether", coreScalingRow: corePassiveScalingRow(agent, "F") })
    near(bounds.finalBaseMultiplier.min, expectedBase)
    near(bounds.finalBaseMultiplier.max, expectedBase)
    const calc = createInCombatPanelCalculator(catalog, request)
    const dense = calc.compileDensePanelScoreTarget({ statIds: ["atkFlat"], setIds: [], setIndexById: new Map() })
    assert.ok(dense)
    const fixed = dense.compileForSetCounts([])
    assert.equal(fixed.releaseIntervalBound, true)
    for (const result of [calc.calculate([], { round: false }).damage.totalFinalDamage,
        calc.scoreOnlyFromSummary(new Map(), new Map()).finalDamage,
        calc.scoreOnlyFromSummaryLegacy(new Map(), new Map()).finalDamage,
        calc.scoreOnlyFromIndexedSummary([], [], [], [], new Map()).finalDamage,
        dense.scoreDense([0], []).finalDamage, fixed.scoreScalar([0]).finalDamage,
        fixed.scoreObjectiveScalar([0]).finalDamage, fixed.scoreCombinedScalar([0]).finalDamage]) {
        near(result, full.damage.totalFinalDamage, `C${cinema} score path`)
    }
    const upper = fixed.scoreCombinedScalar([0], null, [63]).finalDamage
    for (let attack = 0; attack <= 63; attack++) {
        const exact = calc.scoreOnlyFromSummaryLegacy(new Map([["atkFlat", attack]]), new Map()).finalDamage
        assert.ok(upper + 1e-7 >= exact, `C${cinema} interval must bound every candidate`)
    }
}
near(calculateInCombatPanel(catalog, nangongyuReleaseInput(6, "cinema6_tremolo_4")).damage.events[0].multipliers.anomaly, 10,
    "C6 alternate tremolo retains 25% per stack: 0.625 × 8 × 2")
for (const event of [
    { kind: "direct", skillMultiplier: 100, damageElement: "ether" },
    { kind: "anomaly", settlementType: "attribute", anomalyEffect: "corruption", procCount: 1 },
    { kind: "anomaly", settlementType: "disorder", anomalyEffect: "corruption", elapsedSeconds: 0 },
]) {
    const at = cinema => {
        const request = nangongyuReleaseInput(cinema)
        request.damage.events = [{ ...event, id: "release", count: 1, stunned: false }]
        return calculateInCombatPanel(catalog, request).damage.totalFinalDamage
    }
    near(at(0), at(2), "cinema constants must not leak into other settlements")
}
const source = calculateInCombatPanel(catalog, nangongyuReleaseInput(0))
const snapshot = createAnomalySourceSnapshot({ agentId: "vivian", outOfCombatPanel: source.outOfCombat.panel, inCombatPanel: source.inCombat.panel })
const external = cinema => {
    const request = nangongyuReleaseInput(cinema)
    request.damage.events[0].anomalySource = { actorRef: { agentId: "vivian" }, snapshot }
    return calculateInCombatPanel(catalog, request).damage.totalFinalDamage
}
near(external(2) / external(0), 1.2, "trigger cinema changes ratio with a frozen external source")

const request = nangongyuReleaseInput(2)
const store = nangongyuReleaseStore()
// Independent enumeration of all 64 legal 4+2 combinations, using full calculation.
const oracle = []
for (let mask = 0; mask < 64; mask++) {
    const discs = Array.from({ length: 6 }, (_, i) => store.driveDiscs[i * 2 + ((mask >> i) & 1)])
    const result = calculateInCombatPanel(catalog, { ...request, driveDiscs: discs.map(d => ({ ...d, slot: d.partition })),
        combatBuffs: { activeBuffIds: ["driveDisc4pc:woodpecker_electro.self", "driveDisc4pc:woodpecker_electro.team"] } })
    oracle.push({ ids: Object.fromEntries(discs.map(d => [d.partition, d.id])), score: result.damage.totalFinalDamage })
}
oracle.sort((a, b) => b.score - a.score)
for (const result of [
    optimizeDriveDiscs(catalog, store, request),
    optimizeDriveDiscs(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } }),
    await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog, store, request),
    await optimizeDriveDiscsAsync(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } }),
]) {
    assert.equal(result.results.length, 10)
    assert.deepEqual(result.results.map(row => row.driveDiscIdsBySlot), oracle.slice(0, 10).map(row => row.ids))
    result.results.forEach((row, i) => near(row.score, oracle[i].score, "optimizer oracle"))
}
console.log("Nangongyu release: cinema gates, independent factors, score paths, bounds and exhaustive Top 10 passed")
