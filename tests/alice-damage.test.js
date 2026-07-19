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

function configForCinema(cinemaLevel = 0) {
    if (cinemaLevel >= 6) {
        return agent.defaultCalculationConfig.variants.find(item => item.cinemaLevel === 6)
    }
    if (cinemaLevel >= 2) {
        return agent.defaultCalculationConfig.variants.find(item => item.cinemaLevel === 2)
    }
    return agent.defaultCalculationConfig
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

const defaultResult = calculate(configForCinema(0).events)
approx(defaultResult.inCombat.panel.anomalyMastery, 142, "Alice in-combat anomaly mastery")
approx(defaultResult.inCombat.panel.anomalyProficiency, 121.2, "Mastery above 140 should convert to proficiency")

const masteryMainStatResult = calculate(configForCinema(0).events, { driveDiscs: masteryMainStatDiscs })
approx(masteryMainStatResult.outOfCombat.panel.anomalyMastery, 184.6, "Alice slot 6 mastery should scale the 142 white stat by 30%")
approx(masteryMainStatResult.outOfCombat.bonusTotals.anomalyMasteryPct, 0.3, "Slot 6 mastery should use the percentage bucket")
approx(masteryMainStatResult.outOfCombat.bonusTotals.anomalyMasteryFlat, 0, "Core skill mastery should remain part of the white stat")

const phaethonMasteryResult = calculate(configForCinema(0).events, { driveDiscs: phaethonMasteryDiscs })
approx(phaethonMasteryResult.outOfCombat.panel.anomalyMastery, 195.96, "Alice slot 6 and Phaethon 2-piece mastery")
approx(phaethonMasteryResult.inCombat.panel.anomalyMastery, 195.96, "Alice in-combat mastery without an additional mastery Buff")
approx(phaethonMasteryResult.inCombat.panel.anomalyProficiency, 207.536, "Corrected mastery should convert 89.536 proficiency")
approx(phaethonMasteryResult.outOfCombat.bonusTotals.anomalyMasteryPct, 0.38, "Slot 6 and Phaethon percentages should add")
assert.ok(
    phaethonMasteryResult.outOfCombat.appliedEffects.some(effect => effect.key === "phaethons_melody.twoPiece"),
    "Phaethon 2-piece should be applied to the out-of-combat panel",
)

const polarizedAssault = defaultResult.damage.events.find(event => event.id === "alice_polarized_assault")
const physicalFollowup = defaultResult.damage.events.find(event => event.id === "alice_physical_anomaly_followup")
const physicalDisorder = defaultResult.damage.events.find(event => event.id === "alice_full_duration_physical_disorder")
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

const cinemaSixConfig = configForCinema(6)
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
    approx(result.panel.anomalyProficiency, 207.536, `Alice ${label} proficiency summary`)
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
