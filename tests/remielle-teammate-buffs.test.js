import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { createAnomalySourceSnapshot } from "../core/anomalyRelease.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const alice = catalog.agentsMap.get("alice_thymefield")
const aria = catalog.agentsMap.get("aria")
const remielle = catalog.agentsMap.get("remielle_dan")

const ids = {
    core: "remielle_dan.core_passive.alienation",
    special: "remielle_dan.special.timeflow_hymn",
    additional: "remielle_dan.additional.fragrant_invitation",
    cinemaOne: "remielle_dan.cinema_1.green_vow",
    cinemaTwo: "remielle_dan.cinema_2.falling_clamor",
}

function approx(actual, expected, message, epsilon = 1e-8) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon,
        `${message}: expected ${expected}, got ${actual}`)
}

function runtimeInputs({ count, coreCount = count, additionalCount = count, legacyCount, proficiency = 450, skillLevel = 12, initialAtk = 4000 } = {}) {
    return {
        ...(legacyCount === undefined ? {} : {
            "teammate:remielle_dan": { parameters: { anomalyAgentCount: legacyCount } },
        }),
        [ids.core]: {
            ...(coreCount === undefined ? {} : { parameters: { anomalyAgentCount: coreCount } }),
            effects: {
                remielle_dan_core_ap_alienation: { sourceValue: proficiency },
            },
        },
        [ids.special]: {
            effects: {
                remielle_dan_special_team_dmg: { sourceValue: skillLevel },
            },
        },
        [ids.additional]: {
            ...(additionalCount === undefined ? {} : { parameters: { anomalyAgentCount: additionalCount } }),
            effects: {
                remielle_dan_additional_atk_one_anomaly: { sourceValue: initialAtk },
                remielle_dan_additional_atk_two_anomaly: { sourceValue: initialAtk },
                remielle_dan_additional_atk_three_anomaly: { sourceValue: initialAtk },
            },
        },
    }
}

const target = {
    defense: 953,
    levelCoefficient: 794,
    resistanceByElement: { physical: 0, ether: 0 },
}

const attributeEvent = {
    id: "assault",
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffect: "assault",
    stunned: false,
}

const disorderEvent = {
    id: "physical-disorder",
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: "flinch",
    disorderType: "normal",
    elapsedSeconds: 0,
    stunned: false,
}

const directEvent = {
    id: "physical-direct",
    kind: "direct",
    damageElement: "physical",
    skillMultiplier: 1,
    critMode: "nonCrit",
    stunned: false,
}

function inputFor(agentId, event, activeBuffIds = [], runtime = {}) {
    const agent = catalog.agentsMap.get(agentId)
    const wEngine = catalog.wEngines.find(item => item.specialty === agent?.specialty)
    return {
        agentId,
        coreSkillLevel: "F",
        wEngineId: wEngine.id,
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: { activeBuffIds, runtimeInputs: runtime },
        damage: {
            agentLevel: 60,
            selectedEventId: event.id,
            events: [event],
            target,
        },
    }
}

function calculate(agentId, event, activeBuffIds = [], runtime = {}) {
    return calculateInCombatPanel(catalog, inputFor(agentId, event, activeBuffIds, runtime))
}

assert.ok(alice && aria && remielle, "Remielle integration fixtures should exist")
const group = catalog.teammateCombatBuffGroups.find(item => item.id === "remielle_dan")
assert.equal(group.runtimeParameters, undefined)
const expectedRuntimeParameter = [{
    id: "anomalyAgentCount",
    kind: "enum",
    values: [1, 2, 3],
    defaultValue: 3,
}]
assert.deepEqual(group.buffs.map(buff => buff.id), Object.values(ids))
assert.deepEqual(group.buffs.find(buff => buff.id === ids.core).runtimeParameters, expectedRuntimeParameter)
assert.deepEqual(group.buffs.find(buff => buff.id === ids.additional).runtimeParameters, expectedRuntimeParameter)
assert.ok(group.buffs.filter(buff => ![ids.core, ids.additional].includes(buff.id))
    .every(buff => !buff.runtimeParameters?.length))
assert.ok(group.buffs.every(buff => !Object.hasOwn(buff, "runtimeGroupId")))
assert.deepEqual(group.buffs.find(buff => buff.id === ids.cinemaOne).effects.map(effect => effect.target?.settlementType),
    ["attribute"], "Cinema 1 should expose only its Attribute Anomaly rule")
assert.deepEqual(group.buffs.find(buff => buff.id === ids.cinemaTwo).effects.map(effect => effect.target?.settlementType ?? "default"),
    ["default", "attribute"], "Cinema 2 should not expose a duplicate Release DEF-ignore rule")

const attributeBase = calculate("alice_thymefield", attributeEvent)
const attributeCore = calculate("alice_thymefield", attributeEvent, [ids.core], runtimeInputs())
approx(attributeCore.damage.finalDamage, attributeBase.damage.finalDamage * 1.19,
    "Core alienation should multiply Attribute Anomaly by 1.19")
approx(attributeCore.damage.multipliers.alienation, 1.19, "Core alienation multiplier")
const alienationRow = attributeCore.damage.whiteBoxRows.find(row => row.label === "异化乘区")
assert.ok(alienationRow, "Selected alienation Buff should add a white-box row")
assert.match(alienationRow.formula, /450 × 0\.02%/)
assert.match(alienationRow.formula, /三异常 10%/)
assert.equal(attributeBase.damage.whiteBoxRows.some(row => row.label === "异化乘区"), false)
assert.equal(Object.hasOwn(attributeBase.damage.multipliers, "alienation"), false)
assert.equal(attributeBase.damage.whiteBoxRows.at(-1).formula.includes("× 1.0000"), false)
const zeroAlienation = calculate("alice_thymefield", attributeEvent, [ids.core], runtimeInputs({
    count: 2,
    proficiency: 0,
}))
approx(zeroAlienation.damage.multipliers.alienation, 1,
    "A selected zero-value alienation rule should retain an explicit multiplier")
assert.equal(zeroAlienation.damage.whiteBoxRows.some(row => row.label === "异化乘区"), true)

const attributeCinemaTwo = calculate("alice_thymefield", attributeEvent, [ids.core, ids.cinemaTwo], runtimeInputs())
approx(attributeCinemaTwo.damage.multipliers.alienation, 1.39, "Core plus Cinema 2 alienation multiplier")
assert.match(attributeCinemaTwo.damage.whiteBoxRows.find(row => row.label === "异化乘区").formula, /影画二 20%/)

const disorderBase = calculate("alice_thymefield", disorderEvent)
const disorderCore = calculate("alice_thymefield", disorderEvent, [ids.core], runtimeInputs())
approx(disorderCore.damage.finalDamage, disorderBase.damage.finalDamage * 1.19,
    "Core alienation should multiply Disorder by 1.19")
approx(disorderCore.damage.multipliers.alienation, 1.19, "Disorder alienation multiplier")

for (const [count, expectedAtk] of [[1, 240], [2, 480], [3, 1600]]) {
    const base = calculate("alice_thymefield", directEvent)
    const buffed = calculate("alice_thymefield", directEvent, [ids.additional], runtimeInputs({ additionalCount: count }))
    approx(buffed.inCombat.panel.atk - base.inCombat.panel.atk, expectedAtk,
        `Additional Ability ATK for ${count} Anomaly agents`)
}

const defaultCount = calculate("alice_thymefield", directEvent, [ids.additional], runtimeInputs())
const defaultCountBase = calculate("alice_thymefield", directEvent)
approx(defaultCount.inCombat.panel.atk - defaultCountBase.inCombat.panel.atk, 1600,
    "Missing saved Buff parameter should default to three Anomaly agents")

const independentCounts = calculate("alice_thymefield", attributeEvent, [ids.core, ids.additional], runtimeInputs({
    coreCount: 2,
    additionalCount: 3,
}))
approx(independentCounts.damage.multipliers.alienation, 1.09,
    "Core Passive should use its own Anomaly-agent count")
approx(independentCounts.inCombat.panel.atk - attributeBase.inCombat.panel.atk, 1600,
    "Additional Ability should use its own Anomaly-agent count")

const legacyCounts = calculate("alice_thymefield", attributeEvent, [ids.core, ids.additional], runtimeInputs({
    legacyCount: 2,
}))
approx(legacyCounts.damage.multipliers.alienation, 1.09,
    "Legacy teammate-group count should seed Core Passive when its own count is missing")
approx(legacyCounts.inCombat.panel.atk - attributeBase.inCombat.panel.atk, 480,
    "Legacy teammate-group count should seed Additional Ability when its own count is missing")

for (const [skillLevel, expectedBonus] of [[1, 0.015], [12, 0.18], [16, 0.24]]) {
    const result = calculate("alice_thymefield", directEvent, [ids.special], runtimeInputs({ skillLevel }))
    approx(result.inCombat.panel.dmgBonus, expectedBonus, `Special Skill level ${skillLevel}`)
}

const cinemaOneAttribute = calculate("alice_thymefield", attributeEvent, [ids.cinemaOne])
approx(cinemaOneAttribute.damage.finalDamage, attributeBase.damage.finalDamage * 1.1,
    "Cinema 1 should affect Attribute Anomaly")
const cinemaOneDisorder = calculate("alice_thymefield", disorderEvent, [ids.cinemaOne])
approx(cinemaOneDisorder.damage.finalDamage, disorderBase.damage.finalDamage,
    "Cinema 1 should not affect Disorder")

const cinemaTwoDirect = calculate("alice_thymefield", directEvent, [ids.cinemaTwo])
const directBase = calculate("alice_thymefield", directEvent)
approx(cinemaTwoDirect.damage.finalDamage, directBase.damage.finalDamage,
    "Cinema 2 DEF ignore and alienation should not affect direct damage")
const cinemaTwoDisorder = calculate("alice_thymefield", disorderEvent, [ids.cinemaTwo])
approx(cinemaTwoDisorder.damage.finalDamage, disorderBase.damage.finalDamage * 1.2,
    "Cinema 2 DEF ignore should not affect Disorder")
assert.ok(attributeCinemaTwo.damage.targetBreakdown.defenseMultiplier
    > attributeCore.damage.targetBreakdown.defenseMultiplier,
"Cinema 2 should ignore DEF for an Anomaly agent's Attribute Anomaly")

const nonAnomalyAgent = catalog.agents.find(item => item.specialty !== "anomaly" && item.damageElement === "physical")
const nonAnomalyBase = calculate(nonAnomalyAgent.id, attributeEvent)
const nonAnomalyCinemaTwo = calculate(nonAnomalyAgent.id, attributeEvent, [ids.cinemaTwo])
approx(nonAnomalyCinemaTwo.damage.finalDamage, nonAnomalyBase.damage.finalDamage * 1.2,
    "Cinema 2 DEF ignore should not affect a non-Anomaly agent")

function ariaReleaseInput(activeBuffIds = [], runtime = {}, damage = aria.defaultCalculationConfig) {
    return {
        agentId: "aria",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_1883",
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: { activeBuffIds, runtimeInputs: runtime },
        damage: {
            ...damage,
            target: { ...target, resistanceByElement: { ether: 0, physical: 0 } },
        },
    }
}

const releaseBase = calculateInCombatPanel(catalog, ariaReleaseInput())
const releaseCore = calculateInCombatPanel(catalog, ariaReleaseInput([ids.core], runtimeInputs()))
approx(releaseCore.damage.totalFinalDamage, releaseBase.damage.totalFinalDamage * 1.19,
    "Core alienation should multiply Release by 1.19")
approx(releaseCore.damage.events[0].multipliers.alienation, 1.19, "Release alienation multiplier")

const releaseCinemaOne = calculateInCombatPanel(catalog, ariaReleaseInput([ids.cinemaOne]))
approx(releaseCinemaOne.damage.totalFinalDamage, releaseBase.damage.totalFinalDamage * 1.1,
    "Cinema 1 should affect Release")
assert.equal(releaseCinemaOne.damage.events[0].multipliers.anomalyDamage, 1.1)

const releaseCinemaTwo = calculateInCombatPanel(catalog, ariaReleaseInput([ids.cinemaTwo]))
const expectedCinemaTwoDefenseMultiplier = 794 / (794 + 953 * 0.85)
approx(releaseCinemaTwo.damage.events[0].targetBreakdown.defenseMultiplier,
    expectedCinemaTwoDefenseMultiplier,
    "Cinema 2 Release should inherit exactly 15% DEF ignore from the source anomaly")
approx(releaseCinemaTwo.damage.totalFinalDamage / releaseBase.damage.totalFinalDamage,
    1.2 * expectedCinemaTwoDefenseMultiplier / releaseBase.damage.events[0].targetBreakdown.defenseMultiplier,
    "Cinema 2 Release should apply one 15% DEF ignore and one 20% alienation bonus")
assert.notEqual(releaseCinemaTwo.damage.events[0].targetBreakdown.defenseMultiplier, 0.54342618575,
    "Cinema 2 Release must not double its DEF ignore to 30%")

const sourceWithoutAlienation = calculate("alice_thymefield", attributeEvent)
const sourceWithAlienation = calculate("alice_thymefield", attributeEvent, [ids.core], runtimeInputs())
function snapshotOf(result, id) {
    return createAnomalySourceSnapshot({
        agentId: "alice_thymefield",
        agentLevel: 60,
        outOfCombatPanel: result.outOfCombat.panel,
        inCombatPanel: result.inCombat.panel,
        buffTotals: result.inCombat.buffTotals,
        capturedAt: "2026-08-12T00:00:00.000Z",
        sourceConfigHash: id,
    })
}
function externalDamage(snapshot) {
    return {
        ...aria.defaultCalculationConfig,
        events: aria.defaultCalculationConfig.events.map(event => ({
            ...event,
            anomalySource: { actorRef: { agentId: "alice_thymefield" }, snapshot },
        })),
    }
}
const externalWithoutSourceAlienation = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.core],
    runtimeInputs(),
    externalDamage(snapshotOf(sourceWithoutAlienation, "without-alienation")),
))
const externalWithSourceAlienation = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.core],
    runtimeInputs(),
    externalDamage(snapshotOf(sourceWithAlienation, "with-alienation")),
))
approx(externalWithSourceAlienation.damage.totalFinalDamage,
    externalWithoutSourceAlienation.damage.totalFinalDamage * 1.19,
"External Release should inherit source alienation without multiplying the trigger Buff again")
assert.equal(Object.hasOwn(externalWithoutSourceAlienation.damage.events[0].multipliers, "alienation"), false)

const sourceWithCinemaOne = calculate("alice_thymefield", attributeEvent, [ids.cinemaOne])
const externalTriggerOnlyCinemaOne = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.cinemaOne],
    {},
    externalDamage(snapshotOf(sourceWithoutAlienation, "trigger-only-cinema-one")),
))
const externalWithSourceCinemaOne = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.cinemaOne],
    {},
    externalDamage(snapshotOf(sourceWithCinemaOne, "source-cinema-one")),
))
approx(externalWithSourceCinemaOne.damage.totalFinalDamage,
    externalTriggerOnlyCinemaOne.damage.totalFinalDamage * 1.1,
    "External Release should inherit Cinema 1 from the source snapshot exactly once")

const sourceWithCinemaTwo = calculate("alice_thymefield", attributeEvent, [ids.cinemaTwo])
const externalTriggerOnlyCinemaTwo = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.cinemaTwo],
    {},
    externalDamage(snapshotOf(sourceWithoutAlienation, "trigger-only-cinema-two")),
))
const externalWithSourceCinemaTwo = calculateInCombatPanel(catalog, ariaReleaseInput(
    [ids.cinemaTwo],
    {},
    externalDamage(snapshotOf(sourceWithCinemaTwo, "source-cinema-two")),
))
approx(externalWithSourceCinemaTwo.damage.events[0].targetBreakdown.defenseMultiplier,
    expectedCinemaTwoDefenseMultiplier,
    "External Release should inherit Cinema 2 DEF ignore from the source snapshot")
approx(externalWithSourceCinemaTwo.damage.totalFinalDamage / externalTriggerOnlyCinemaTwo.damage.totalFinalDamage,
    1.2 * expectedCinemaTwoDefenseMultiplier
        / externalTriggerOnlyCinemaTwo.damage.events[0].targetBreakdown.defenseMultiplier,
    "External Release should inherit Cinema 2 alienation and DEF ignore exactly once")

const luminescenceBase = calculateInCombatPanel(catalog, {
    agentId: "remielle_dan",
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    driveDiscs: [],
    combatBuffs: { activeBuffIds: [] },
    damage: remielle.defaultCalculationConfig,
})
const luminescenceAlienation = calculateInCombatPanel(catalog, {
    agentId: "remielle_dan",
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    driveDiscs: [],
    combatBuffs: { activeBuffIds: [ids.core], runtimeInputs: runtimeInputs() },
    damage: remielle.defaultCalculationConfig,
})
approx(luminescenceAlienation.damage.totalFinalDamage, luminescenceBase.damage.totalFinalDamage,
    "Remielle Luminescence should not read the teammate alienation multiplier")

for (const [label, input] of [
    ["attribute", inputFor("alice_thymefield", attributeEvent, [ids.core], runtimeInputs())],
    ["disorder", inputFor("alice_thymefield", disorderEvent, [ids.core], runtimeInputs())],
    ["release", ariaReleaseInput([ids.core], runtimeInputs())],
    ["release Cinema 1", ariaReleaseInput([ids.cinemaOne])],
    ["release Cinema 2", ariaReleaseInput([ids.cinemaTwo])],
]) {
    const calculator = createInCombatPanelCalculator(catalog, input)
    const full = calculator.calculate([], { round: false })
    const compiled = calculator.scoreOnlyFromSummary(new Map(), new Map())
    const legacy = calculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
    approx(compiled.finalDamage, full.damage.totalFinalDamage, `${label} compiled score`)
    approx(legacy.finalDamage, full.damage.totalFinalDamage, `${label} prepared score`)
    const statIds = ["atkFlat", "atkPct", "anomalyProficiency", "anomalyMastery", "dmgBonus"]
    const denseTarget = calculator.compileDensePanelScoreTarget({
        statIds,
        setIds: [],
        setIndexById: new Map(),
    })
    const statValues = new Float64Array(statIds.length)
    const setCountValues = new Int16Array(0)
    const dense = denseTarget.scoreDense(statValues, setCountValues)
    const fixed = denseTarget.compileForSetCounts(setCountValues).scoreObjectiveScalar(statValues)
    approx(dense.finalDamage, full.damage.totalFinalDamage, `${label} dense score`)
    approx(fixed.finalDamage, full.damage.totalFinalDamage, `${label} fixed score`)
}

console.log("Remielle teammate Buff tests passed")
