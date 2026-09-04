import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { optimizeDriveDiscs } from "../core/driveDiscOptimizer-core.js"
import {
    evaluateAnomalyReleaseProfile,
    validateAnomalyReleaseProfile,
} from "../core/anomalyRelease.js"
import { corePassiveScalingRow } from "../core/corePassiveScaling.js"
import { defaultWEngineIdForAgent } from "../core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("vivian")
const signature = catalog.wEnginesMap.get("zzz_wiki_1277")

function approx(actual, expected, message, epsilon = 1e-8) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon,
        `${message}: expected ${expected}, got ${actual}`)
}

function releaseEvent() {
    return {
        id: "vivian-self-corruption-release",
        kind: "anomaly",
        settlementType: "release",
        anomalyEffect: "corruption",
        count: 1,
        stunned: true,
        triggerActorRef: { agentId: "vivian", profileId: "core_passive" },
        anomalySource: { actorRef: { agentId: "vivian" } },
    }
}

function releaseInput(overrides = {}) {
    const activeBuffIds = overrides.activeBuffIds ?? [
        "agent:vivian.additionalAbility",
        "wEngine:zzz_wiki_1277.self",
    ]
    const event = overrides.event ?? releaseEvent()
    return {
        agentId: "vivian",
        coreSkillLevel: overrides.coreSkillLevel ?? "F",
        cinemaLevel: overrides.cinemaLevel ?? 0,
        wEngineId: overrides.wEngineId ?? "zzz_wiki_1277",
        wEngineModificationLevel: overrides.wEngineModificationLevel ?? 1,
        driveDiscs: overrides.driveDiscs ?? [],
        combatBuffs: {
            activeBuffIds,
            manualStats: overrides.manualStats ?? [],
            runtimeInputs: overrides.runtimeInputs ?? {},
        },
        damage: {
            mode: "anomaly",
            selectedEventId: event.id,
            events: [event],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: { ether: 0 },
            },
            ...(overrides.damage ?? {}),
        },
        ...overrides.input,
    }
}

assert.ok(agent, "Vivian should be present in the agent catalog")
assert.deepEqual(agent.level60, {
    hpBase: 7673,
    atkBase: 805,
    defBase: 606,
    critRate: 5,
    critDmg: 50,
    impact: 86,
    anomalyProficiency: 118,
    anomalyMastery: 108,
    energyRegen: 120,
    penRatio: 0,
})
assert.equal(agent.images.portrait, "/assets/agents/vivian.png")
assert.equal(agent.defaultCalculationConfig, undefined,
    "Vivian should not define an administrator default rotation")
assert.equal(agent.skillGroups, undefined,
    "Vivian should not infer an administrator rotation from skill groups")
assert.deepEqual(agent.preferredDriveDiscs.defaultSetIds, ["phaethons_melody"])
assert.equal(signature.relatedAgentId, "vivian")
assert.equal(defaultWEngineIdForAgent(catalog.wEngines, "vivian"), "zzz_wiki_1277")

const profile = agent.anomalyReleaseProfiles[0]
assert.deepEqual(validateAnomalyReleaseProfile(profile), [])
assert.equal(profile.resultMode, "originalAnomalyRatio")
const conversionLeaf = profile.expression.args[0].args[0]
assert.deepEqual(
    {
        kind: conversionLeaf.kind,
        panel: conversionLeaf.panel,
        stat: conversionLeaf.stat,
        whiteBoxRole: conversionLeaf.whiteBoxRole,
    },
    {
        kind: "triggerStat",
        panel: "inCombat",
        stat: "anomalyProficiency",
        whiteBoxRole: "conversionSource",
    },
)
assert.deepEqual(
    agent.coreSkill.corePassiveScaling.levels.map(level => level.releaseCoefficientPctByElement.ether),
    [3.07, 3.59, 4.11, 4.63, 5.15, 5.65, 6.15],
)
assert.deepEqual(
    ["none", "A", "B", "C", "D", "E", "F"].map(level =>
        corePassiveScalingRow(agent, level)?.releaseCoefficientPctByElement.ether),
    [3.07, 3.59, 4.11, 4.63, 5.15, 5.65, 6.15],
)

const ratioAtF = evaluateAnomalyReleaseProfile(profile, {
    originalBaseMultiplier: 0.625,
    trigger: { inCombatPanel: { anomalyProficiency: 328 } },
    coreScalingRow: corePassiveScalingRow(agent, "F"),
    event: releaseEvent(),
    eventElement: "ether",
})
approx(ratioAtF.releaseScale, 2.0172, "F-level Ether release ratio at 328 AP")
assert.equal(ratioAtF.trace.formula, "328 / 10 × 6.15%")

const result = calculateInCombatPanel(catalog, releaseInput())
const eventResult = result.damage.events[0]
assert.equal(result.damage.events.length, 1, "Vivian target must be a single release event")
assert.equal(eventResult.input.settlementType, "release")
assert.equal(eventResult.input.anomalyEffect, "corruption")
assert.equal(eventResult.input.procCount, 1, "Release should inherit one Ether anomaly unit")
assert.equal(eventResult.input.anomalyVariant, undefined)
assert.deepEqual(eventResult.input.triggerActorRef, { agentId: "vivian", profileId: "core_passive" })
assert.deepEqual(eventResult.input.anomalySource, { actorRef: { agentId: "vivian" } })
assert.equal(eventResult.panelSnapshot.sourceAgentId, "vivian")
approx(result.outOfCombat.panel.anomalyProficiency, 208, "signature advanced AP is out-of-combat")
approx(result.inCombat.panel.anomalyProficiency, 328, "signature six-stack AP is in-combat")
approx(eventResult.multipliers.originalAnomalyBaseMultiplier, 0.625, "Ether base is one Corruption unit")
approx(eventResult.multipliers.releaseScale, 2.0172, "release ratio uses current AP")
approx(eventResult.multipliers.anomaly, 0.625 * 2.0172, "release base multiplier")
approx(eventResult.multipliers.attributeAnomalyDamage, 1.12, "additional ability Corruption bonus")
assert.ok(eventResult.whiteBoxRows.some(row => row.label === "转换数据来源" && row.value === 328))
assert.ok(eventResult.whiteBoxRows.some(row => row.label === "异放公式：异放倍率" && row.formula.includes("328 / 10")))

const lowerAp = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:vivian.additionalAbility"],
}))
approx(lowerAp.inCombat.panel.anomalyProficiency, 208, "without signature stacks, in-combat AP is 208")
approx(lowerAp.damage.events[0].multipliers.releaseScale, 1.2792, "release ratio at 208 AP")
assert.ok(result.damage.totalFinalDamage > lowerAp.damage.totalFinalDamage)

const extraAp = calculateInCombatPanel(catalog, releaseInput({
    manualStats: [{ stat: "anomalyProficiencyFlat", value: 100, mode: "flat" }],
}))
approx(extraAp.inCombat.panel.anomalyProficiency, 428, "manual in-combat AP correction")
approx(extraAp.damage.events[0].multipliers.releaseScale, 2.6322, "release ratio follows manual AP")
approx(
    extraAp.damage.totalFinalDamage / result.damage.totalFinalDamage,
    (428 / 328) ** 2,
    "self-sourced AP must affect both the base anomaly and release ratio",
    1e-7,
)

const cinemaOne = calculateInCombatPanel(catalog, releaseInput({
    cinemaLevel: 1,
    activeBuffIds: ["agent:vivian.additionalAbility", "wEngine:zzz_wiki_1277.self", "agent:vivian.cinema.1"],
}))
approx(cinemaOne.damage.events[0].multipliers.attributeAnomalyDamage, 1.28, "Cinema 1 Prophecy anomaly bonus")
const cinemaTwo = calculateInCombatPanel(catalog, releaseInput({
    cinemaLevel: 2,
    activeBuffIds: ["agent:vivian.additionalAbility", "wEngine:zzz_wiki_1277.self", "agent:vivian.cinema.2"],
}))
approx(cinemaTwo.damage.events[0].targetBreakdown.resIgnore, 0.15, "Cinema 2 release resistance ignore")
const cinemaFour = calculateInCombatPanel(catalog, releaseInput({
    cinemaLevel: 4,
    activeBuffIds: ["agent:vivian.additionalAbility", "wEngine:zzz_wiki_1277.self", "agent:vivian.cinema.4"],
}))
approx(cinemaFour.inCombat.panel.atk, cinemaFour.outOfCombat.panel.atk * 1.12, "Cinema 4 attack bonus")
const cinemaSix = calculateInCombatPanel(catalog, releaseInput({
    cinemaLevel: 6,
    activeBuffIds: ["agent:vivian.additionalAbility", "wEngine:zzz_wiki_1277.self", "agent:vivian.cinema.6"],
}))
approx(cinemaSix.damage.events[0].multipliers.dmg, 1.4, "Cinema 6 Ether damage bonus")

const prepared = createInCombatPanelCalculator(catalog, releaseInput())
const fullPrepared = prepared.calculate([], { round: false })
const compiledPrepared = prepared.scoreOnlyFromSummary(new Map(), new Map())
const legacyPrepared = prepared.scoreOnlyFromSummaryLegacy(new Map(), new Map())
const indexedPrepared = prepared.scoreOnlyFromIndexedSummary([], [], [], [], new Map())
for (const [label, value] of [
    ["compiled", compiledPrepared],
    ["legacy", legacyPrepared],
    ["indexed", indexedPrepared],
]) {
    approx(value.finalDamage, fullPrepared.damage.totalFinalDamage, `${label} release score parity`)
}
const denseTarget = prepared.compileDensePanelScoreTarget({
    statIds: [],
    setIds: [],
    setIndexById: new Map(),
})
assert.ok(denseTarget, "self-sourced Vivian release should compile a dense target")
const densePrepared = denseTarget.scoreDense(new Float64Array(), new Int16Array())
const fixedPrepared = denseTarget.compileForSetCounts(new Int16Array()).scoreScalar(new Float64Array())
approx(densePrepared.finalDamage, fullPrepared.damage.totalFinalDamage, "dense release score parity")
approx(fixedPrepared.finalDamage, fullPrepared.damage.totalFinalDamage, "fixed release score parity")
const metadata = prepared.optimizerStatMetadata()
assert.equal(metadata.requiresReleaseIntervalBound, true)
assert.equal(metadata.strictMonotonic, false)
for (const stat of ["anomalyProficiency", "anomalyProficiencyFlat", "atkFlat", "atkPct", "etherDmg", "penRatio"]) {
    assert.ok(metadata.relevantStatIds.includes(stat), `optimizer should retain ${stat} for Vivian release`)
}

function optimizerDisc(id, partition, mainStat) {
    return {
        id,
        ownerId: "default",
        setId: "phaethons_melody",
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat,
        subStats: [],
        source: { type: "test", sequence: partition },
    }
}

const optimizerStore = {
    currentOwnerId: "default",
    driveDiscs: [
        optimizerDisc("vivian-opt-1", 1, { stat: "hpFlat", value: 2200, mode: "flat" }),
        optimizerDisc("vivian-opt-2", 2, { stat: "atkFlat", value: 316, mode: "flat" }),
        optimizerDisc("vivian-opt-3", 3, { stat: "defFlat", value: 184, mode: "flat" }),
        optimizerDisc("vivian-opt-4", 4, { stat: "anomalyProficiency", value: 92, mode: "flat" }),
        optimizerDisc("vivian-opt-5", 5, { stat: "etherDmg", value: 30, mode: "flat" }),
        optimizerDisc("vivian-opt-6", 6, { stat: "anomalyMastery", value: 30, mode: "pct" }),
    ],
}
const optimizationInput = {
    ...releaseInput(),
    settings: {
        objective: "damage",
        algorithm: "exact-super-bound",
        fourPieceSetIds: ["phaethons_melody"],
        twoPieceSetIds: ["phaethons_melody"],
        mainStatLimits: agent.preferredDriveDiscs.mainStatLimits,
        minimums: {},
        disableParallel: true,
    },
}
const optimized = optimizeDriveDiscs(catalog, optimizerStore, optimizationInput)
assert.equal(optimized.results.length, 1, "the one legal six-piece Vivian fixture should produce one result")
assert.equal(optimized.metrics.strictExact, true)
const optimizedFull = calculateInCombatPanel(catalog, {
    ...optimizationInput,
    combatBuffs: {
        ...optimizationInput.combatBuffs,
        activeBuffIds: [
            ...optimizationInput.combatBuffs.activeBuffIds,
            `driveDisc4pc:${optimized.results[0].fourPieceSetId}.self`,
        ],
    },
    driveDiscs: optimized.results[0].driveDiscs,
})
approx(optimized.results[0].score, optimizedFull.damage.totalFinalDamage, "strict optimizer release score parity")
assert.equal(optimizedFull.damage.events.length, 1)

console.log("Vivian release modeling tests passed")
