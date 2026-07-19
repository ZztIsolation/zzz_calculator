import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("alice_thymefield")
const skillCatalog = catalog.agentSkillsMap.get("alice_thymefield")

function approx(actual, expected, label, tolerance = 1e-8) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) < tolerance, `${label}: expected ${expected}, got ${actual}`)
}

function activeBuffIds(cinemaLevel = 0) {
    return [
        "agent:alice_thymefield.corePassive",
        "agent:alice_thymefield.additionalAbility",
        ...(agent.combatBuffs.cinemaBuffs ?? [])
            .filter(buff => Number(buff.cinemaLevel) <= cinemaLevel)
            .map(buff => `agent:alice_thymefield.cinema.${buff.cinemaLevel}`),
    ]
}

function calculate(events, { cinemaLevel = 0, driveDiscs = [], runtimeInputs = {} } = {}) {
    return calculateInCombatPanel(catalog, {
        agentId: agent.id,
        coreSkillLevel: "F",
        wEngineId: "tenfold_starforge",
        wEngineModificationLevel: 1,
        driveDiscs,
        combatBuffs: {
            activeBuffIds: activeBuffIds(cinemaLevel),
            runtimeInputs,
        },
        damage: {
            mode: "custom",
            agentLevel: 60,
            selectedEventId: events[0].id,
            events,
            target: {
                defense: 953,
                resistanceByElement: { physical: 0, fire: 0 },
            },
        },
    })
}

function driveDisc(partition, setId, mainStat) {
    return {
        id: `${setId}-${partition}-${mainStat.stat}`,
        setId,
        partition,
        mainStat,
        subStats: [],
    }
}

function driveDiscWithProficiency(partition, setId, mainStat, anomalyProficiency = 0) {
    return {
        ...driveDisc(partition, setId, mainStat),
        subStats: anomalyProficiency > 0
            ? [{ stat: "anomalyProficiency", value: anomalyProficiency, mode: "flat" }]
            : [],
    }
}

const emptyMainStats = {
    1: { stat: "hpFlat", value: 0, mode: "flat" },
    2: { stat: "atkFlat", value: 0, mode: "flat" },
    3: { stat: "defFlat", value: 0, mode: "flat" },
    4: { stat: "anomalyProficiency", value: 0, mode: "flat" },
    5: { stat: "physicalDmg", value: 0, mode: "pct" },
}
const masteryMainStatDiscs = [1, 2, 3, 4, 5]
    .map(partition => driveDisc(partition, "fanged_metal", emptyMainStats[partition]))
masteryMainStatDiscs.push(driveDisc(6, "fanged_metal", {
    stat: "anomalyMastery",
    value: 30,
    mode: "pct",
}))
const phaethonMasteryDiscs = [
    driveDisc(1, "phaethons_melody", emptyMainStats[1]),
    driveDisc(2, "phaethons_melody", emptyMainStats[2]),
    ...masteryMainStatDiscs.slice(2),
]

const aliceMechanicsEvents = [
    {
        id: "alice_polarized_assault",
        kind: "anomaly",
        count: 1,
        settlementType: "attribute",
        anomalyEffect: "assault",
        anomalyVariant: "polarizedAssault",
        procCount: 1,
    },
    {
        id: "alice_physical_anomaly_followup",
        kind: "anomaly",
        label: "核心被动：物理异常追伤",
        count: 10,
        damageRatioPct: 2.5,
        settlementType: "attribute",
        anomalyEffect: "assault",
        procCount: 1,
    },
    {
        id: "alice_full_duration_physical_disorder",
        kind: "anomaly",
        count: 1,
        settlementType: "disorder",
        anomalyEffect: "flinch",
        disorderType: "normal",
        elapsedSeconds: 0,
    },
]

const aliceCinemaSixEvents = [
    ...aliceMechanicsEvents,
    {
        id: "alice_winning_state_followup",
        kind: "direct",
        count: 6,
        critMode: "crit",
        skillRef: {
            agentSkillId: "alice_thymefield",
            categoryId: "cinema",
            moveId: "winning_state_followup",
            rowId: "damage",
        },
    },
]

const screenshotDiscs = [
    driveDiscWithProficiency(1, "phaethons_melody", { stat: "hpFlat", value: 2200, mode: "flat" }, 36),
    driveDiscWithProficiency(2, "fanged_metal", { stat: "atkFlat", value: 316, mode: "flat" }, 18),
    driveDiscWithProficiency(3, "phaethons_melody", { stat: "defFlat", value: 184, mode: "flat" }, 27),
    driveDiscWithProficiency(4, "fanged_metal", { stat: "anomalyProficiency", value: 92, mode: "flat" }),
    driveDiscWithProficiency(5, "fanged_metal", { stat: "physicalDmg", value: 30, mode: "pct" }, 27),
    driveDiscWithProficiency(6, "fanged_metal", { stat: "anomalyMastery", value: 30, mode: "pct" }, 18),
]

assert.equal(agent.hidden, false, "Alice should be available after her mechanics are modeled")
assert.ok(agent.combatBuffs.corePassive)
assert.ok(agent.combatBuffs.additionalAbility)
assert.deepEqual(agent.combatBuffs.cinemaBuffs.map(buff => buff.cinemaLevel), [1, 2, 4, 6])
assert.deepEqual(agent.preferredDriveDiscs.mainStatLimits["6"], ["anomalyMastery", "atkPct"])
assert.deepEqual(agent.combatBuffs.corePassive.effects, [{
    id: "disorder-multiplier-bonus",
    type: "stacked",
    stat: "disorderBaseMultiplierBonus",
    valuePerStack: 18,
    maxStacks: 10,
    defaultStacks: 10,
    mode: "flat",
    target: { kind: "default" },
}])

const cinemaSixRow = skillCatalog.categories
    .find(category => category.id === "cinema")
    ?.moves.find(move => move.id === "winning_state_followup")
    ?.rows.find(row => row.id === "damage")
assert.equal(cinemaSixRow?.damageBasis, "anomalyProficiency")
assert.deepEqual(cinemaSixRow?.values, [3300])

const defaultResult = calculate(agent.defaultCalculationConfig.events)
approx(defaultResult.inCombat.panel.anomalyMastery, 142, "Alice in-combat anomaly mastery")
approx(defaultResult.inCombat.panel.anomalyProficiency, 121, "Converted proficiency should floor the decimal result")

const masteryMainStatResult = calculate(agent.defaultCalculationConfig.events, { driveDiscs: masteryMainStatDiscs })
approx(masteryMainStatResult.outOfCombat.panel.anomalyMastery, 184.6, "Alice slot 6 mastery should scale the 142 white stat by 30%")
approx(masteryMainStatResult.inCombat.panel.anomalyProficiency, 188, "184.6 mastery should convert 70 proficiency after game rounding")
approx(masteryMainStatResult.outOfCombat.bonusTotals.anomalyMasteryPct, 0.3, "Slot 6 mastery should use the percentage bucket")
approx(masteryMainStatResult.outOfCombat.bonusTotals.anomalyMasteryFlat, 0, "Core skill mastery should remain part of the white stat")

const phaethonMasteryResult = calculate(agent.defaultCalculationConfig.events, { driveDiscs: phaethonMasteryDiscs })
approx(phaethonMasteryResult.outOfCombat.panel.anomalyMastery, 195.96, "Alice slot 6 and Phaethon 2-piece mastery")
approx(phaethonMasteryResult.inCombat.panel.anomalyMastery, 195.96, "Alice in-combat mastery without an additional mastery Buff")
approx(phaethonMasteryResult.inCombat.panel.anomalyProficiency, 206, "Corrected mastery should convert 88 proficiency after game rounding")
approx(phaethonMasteryResult.outOfCombat.bonusTotals.anomalyMasteryPct, 0.38, "Slot 6 and Phaethon percentages should add")
assert.ok(
    phaethonMasteryResult.outOfCombat.appliedEffects.some(effect => effect.key === "phaethons_melody.twoPiece"),
    "Phaethon 2-piece should be applied to the out-of-combat panel",
)

const screenshotResult = calculateInCombatPanel(catalog, {
    agentId: agent.id,
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    driveDiscs: screenshotDiscs,
    combatBuffs: {
        activeBuffIds: [...activeBuffIds(0), "wEngine:tenfold_starforge.self"],
    },
})
approx(screenshotResult.outOfCombat.panel.anomalyProficiency, 336, "Screenshot out-of-combat proficiency")
approx(screenshotResult.outOfCombat.panel.anomalyMastery, 195.96, "Screenshot out-of-combat mastery retains exact precision")
approx(screenshotResult.inCombat.panel.anomalyMastery, 255.96, "Screenshot in-combat mastery retains exact precision")
approx(
    screenshotResult.inCombat.panel.anomalyProficiency - screenshotResult.outOfCombat.panel.anomalyProficiency,
    184,
    "Screenshot converted proficiency",
)
approx(screenshotResult.inCombat.panel.anomalyProficiency, 520, "Screenshot in-combat proficiency")

function calculateThresholdCase(anomalyMasteryFlat) {
    return calculateInCombatPanel(catalog, {
        agentId: agent.id,
        coreSkillLevel: "none",
        wEngineId: "tenfold_starforge",
        wEngineModificationLevel: 1,
        driveDiscs: [driveDisc(6, "fanged_metal", {
            stat: "anomalyMasteryFlat",
            value: anomalyMasteryFlat,
            mode: "flat",
        })],
        combatBuffs: { activeBuffIds: ["agent:alice_thymefield.additionalAbility"] },
    })
}

const belowThreshold = calculateThresholdCase(34.99)
approx(belowThreshold.inCombat.panel.anomalyMastery, 140.99, "Fractional mastery below the next whole point")
approx(belowThreshold.inCombat.panel.anomalyProficiency, 118, "140.99 mastery should not cross the 140-point threshold")

const firstWholePoint = calculateThresholdCase(35)
approx(firstWholePoint.inCombat.panel.anomalyMastery, 141, "First whole mastery point above the threshold")
approx(firstWholePoint.inCombat.panel.anomalyProficiency, 119, "1.6 converted proficiency should floor to 1")

const mechanicsResult = calculate(aliceMechanicsEvents)
const polarizedAssault = mechanicsResult.damage.events.find(event => event.id === "alice_polarized_assault")
const physicalFollowup = mechanicsResult.damage.events.find(event => event.id === "alice_physical_anomaly_followup")
const physicalDisorder = mechanicsResult.damage.events.find(event => event.id === "alice_full_duration_physical_disorder")
assert.equal(polarizedAssault.label, "极性强击")
approx(physicalFollowup.finalDamage / polarizedAssault.finalDamage, 0.25, "Ten 2.5% follow-ups should equal 25% of one Assault")
approx(physicalDisorder.multipliers.disorderBaseMultiplierBonus, 1.8, "Default ten stacks should add 180% Disorder multiplier")
approx(physicalDisorder.multipliers.anomaly, 7.05, "Full-duration Flinch disorder multiplier")

const fiveStackPhysicalDisorder = calculate([{
    id: "five-stack-physical-disorder",
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: "flinch",
    elapsedSeconds: 0,
}], {
    runtimeInputs: {
        "agent:alice_thymefield.corePassive": {
            effects: {
                "disorder-multiplier-bonus": { stacks: 5 },
            },
        },
    },
}).damage
approx(fiveStackPhysicalDisorder.multipliers.disorderBaseMultiplierBonus, 0.9, "Five stacks should add 90% Disorder multiplier")
approx(fiveStackPhysicalDisorder.multipliers.anomaly, 6.15, "Five-stack Flinch disorder multiplier")

const fireDisorder = calculate([{
    id: "fire-disorder",
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
}]).damage
approx(fireDisorder.multipliers.disorderBaseMultiplierBonus, 1.8, "Alice's unified Disorder multiplier should not use a physical-only stat")
approx(fireDisorder.multipliers.anomaly, 16.3, "Burn disorder should receive the same ten-stack multiplier addition")

const assaultEvent = [{
    id: "assault",
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffect: "assault",
    procCount: 1,
}]
const baseAssault = calculate(assaultEvent).damage
const cinemaOneAssault = calculate(assaultEvent, { cinemaLevel: 1 }).damage
const cinemaTwoAssault = calculate(assaultEvent, { cinemaLevel: 2 }).damage
const cinemaFourAssault = calculate(assaultEvent, { cinemaLevel: 4 }).damage
approx(cinemaOneAssault.targetBreakdown.enemyDefReduction, 0.2, "Cinema 1 defense reduction")
approx(cinemaTwoAssault.finalDamage / cinemaOneAssault.finalDamage, 1.15, "Cinema 2 Assault damage bonus")
approx(cinemaFourAssault.targetBreakdown.resIgnore, 0.1, "Cinema 4 physical resistance ignore")
assert.ok(cinemaOneAssault.finalDamage > baseAssault.finalDamage)

const cinemaSixConfig = {
    mode: "custom",
    cinemaLevel: 6,
    events: aliceCinemaSixEvents,
    selectedEventId: "alice_winning_state_followup",
}
const cinemaSixResult = calculate(cinemaSixConfig.events, { cinemaLevel: 6 })
const winningStateFollowup = cinemaSixResult.damage.events.find(event => event.id === "alice_winning_state_followup")
assert.equal(winningStateFollowup.count, 6)
assert.equal(winningStateFollowup.input.critMode, "crit")
assert.equal(winningStateFollowup.multipliers.damageBasis, "anomalyProficiency")
approx(winningStateFollowup.multipliers.damageBasisValue, cinemaSixResult.inCombat.panel.anomalyProficiency, "Cinema 6 should use anomaly proficiency as its base")

const compiledCalculator = createInCombatPanelCalculator(catalog, {
    agentId: agent.id,
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: activeBuffIds(6) },
    damage: cinemaSixConfig,
})
const statTotals = new Map([
    ["atkPct", 0.3],
    ["anomalyProficiency", 92],
    ["anomalyMastery", 60],
    ["physicalDmg", 0.3],
])
const compiled = compiledCalculator.scoreOnlyFromSummary(statTotals, new Map())
const legacy = compiledCalculator.scoreOnlyFromSummaryLegacy(statTotals, new Map())
approx(compiled.finalDamage, legacy.finalDamage, "Alice compiled and legacy score paths", 1e-6)
approx(compiled.panel.anomalyProficiency, legacy.panel.anomalyProficiency, "Alice compiled and legacy proficiency", 1e-9)
assert.ok(compiledCalculator.optimizerStatMetadata().relevantStatIds.includes("anomalyMastery"))

const masterySummaryStats = new Map([["anomalyMastery", 30]])
const masterySummarySets = new Map([["phaethons_melody", 2]])
const compiledMastery = compiledCalculator.scoreOnlyFromSummary(masterySummaryStats, masterySummarySets)
const legacyMastery = compiledCalculator.scoreOnlyFromSummaryLegacy(masterySummaryStats, masterySummarySets)
const indexedMastery = compiledCalculator.scoreOnlyFromIndexedSummary(
    [30],
    ["anomalyMastery"],
    [2],
    ["phaethons_melody"],
    new Map([["phaethons_melody", 0]]),
)
for (const [label, result] of [["compiled", compiledMastery], ["legacy", legacyMastery], ["indexed", indexedMastery]]) {
    approx(result.panel.anomalyMastery, 195.96, `Alice ${label} mastery summary`)
    approx(result.panel.anomalyProficiency, 206, `Alice ${label} proficiency summary`)
}
approx(compiledMastery.finalDamage, legacyMastery.finalDamage, "Corrected mastery compiled and legacy damage", 1e-6)

const cinemaSixOnlyInput = {
    agentId: agent.id,
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: activeBuffIds(6) },
    damage: {
        mode: "custom",
        events: [cinemaSixConfig.events.find(event => event.id === "alice_winning_state_followup")],
    },
}
const cinemaSixOnlyCalculator = createInCombatPanelCalculator(catalog, cinemaSixOnlyInput)
const noExtraAtk = cinemaSixOnlyCalculator.scoreOnlyFromSummary(new Map(), new Map())
const extraAtk = cinemaSixOnlyCalculator.scoreOnlyFromSummary(new Map([["atkFlat", 1000]]), new Map())
approx(extraAtk.finalDamage, noExtraAtk.finalDamage, "Cinema 6 anomaly-proficiency damage should not scale with attack")

console.log("alice damage tests passed")
