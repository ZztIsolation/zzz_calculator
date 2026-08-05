import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    optimizeDriveDiscs,
    optimizeDriveDiscsAsync,
    previewDriveDiscOptimization,
} from "../backend/driveDiscOptimizer.js"
import { toCalculatorDriveDisc } from "../backend/driveDiscInventory.js"
import {
    damageModifierAppliesTo,
    isTeamAnomalyDamageModifier,
} from "../core/calculator-core.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const dan = catalog.agentsMap.get("remielle_dan")
assert.ok(dan, "Remielle Dan must be available in the public catalog")
assert.equal(dan.hidden, false)
assert.equal(dan.attribute, "lumiflux")
assert.equal(dan.damageElement, "lumiflux", "Lumiflux direct damage must keep its own settlement marker")

function approx(actual, expected, label, epsilon = 1e-8) {
    const left = Number(actual)
    const right = Number(expected)
    const delta = Math.abs(left - right)
    assert.ok(delta <= epsilon * Math.max(1, Math.abs(left), Math.abs(right)), `${label}: expected ${right}, got ${left}`)
}

function input(overrides = {}) {
    const damage = structuredClone(overrides.damage ?? dan.defaultCalculationConfig)
    return {
        agentId: "remielle_dan",
        coreSkillLevel: "F",
        cinemaLevel: 0,
        wEngineId: "hailfall_star_palace",
        wEngineModificationLevel: 1,
        combatBuffs: { activeBuffIds: [] },
        damage,
        ...overrides,
        damage,
    }
}

function damageWith(eventPatch = {}, configPatch = {}) {
    const source = structuredClone(dan.defaultCalculationConfig)
    return {
        ...source,
        ...configPatch,
        events: [{ ...source.events[0], ...eventPatch }],
    }
}

const baseline = calculateInCombatPanel(catalog, input())
const baselineEvent = baseline.damage.events[0]
const A = baseline.outOfCombat.panel.atk
const P = baseline.inCombat.panel.anomalyProficiency
const expected = (2800 + Math.min(0.4 * A, 1600))
    * (1.10 + 0.0002 * P)
    * Math.pow(1 + 0.002 * P, 0.5)
approx(baselineEvent.finalDamage, expected, "geometric-share team anomaly score")
assert.equal(baselineEvent.objectiveKind, "luminescenceTeamScore")
assert.equal(baselineEvent.scoreSuffix, "× k")
assert.equal(baseline.damage.objectiveKind, "luminescenceTeamScore")
assert.equal(baseline.damage.scoreSuffix, "× k")
assert.equal(baselineEvent.input.teammateAttack, 2800)
assert.equal(baselineEvent.input.luminescenceDamageSharePct, 50)
assert.equal("referenceAnomalyProficiency" in baselineEvent.input, false)
assert.equal("referenceLuminescenceDamageMultiplier" in baselineEvent.input, false)
assert.equal(baselineEvent.multipliers.teamAnomalyDamage, 1)
assert.equal(baselineEvent.multipliers.luminescenceDamage, 1)
for (const removedField of ["records", "k", "B", "sourceElement", "m4MultiplierMode", "resistanceMode", "moveRef"]) {
    assert.equal(removedField in baselineEvent.input, false, `${removedField} must not survive canonical normalization`)
}
assert.deepEqual(
    baselineEvent.whiteBoxRows.map(row => row.label),
    [
        "队友初始攻击力",
        "丹局外攻击力",
        "丹局内异常精通",
        "耀变在队伍总伤害中的占比",
        "异化倍率",
        "队伍异常评分",
    ],
)
for (const label of [
    "队友初始攻击力",
    "丹局外攻击力",
    "丹局内异常精通",
    "耀变在队伍总伤害中的占比",
]) {
    const row = baselineEvent.whiteBoxRows.find(item => item.label === label)
    assert.equal("formula" in row, false, `${label} must not use formula as descriptive copy`)
}
const baselineAlienationRow = baselineEvent.whiteBoxRows.find(row => row.label === "异化倍率")
assert.equal(baselineAlienationRow.value, baselineEvent.multipliers.alienation)
assert.match(
    baselineAlienationRow.formula,
    /^1 \+ 0\.10 \+ 0\.0002 × [\d.]+ = [\d.]+$/,
    "Alienation row must show the complete substituted formula",
)
const whiteBoxText = JSON.stringify(baselineEvent.whiteBoxRows)
assert.match(whiteBoxText, /× k/)
assert.match(whiteBoxText, /0\.002 ×/, "F-core white box must use the flattened decimal coefficient")
assert.match(whiteBoxText, /\^0\.5/, "White box must expose the geometric share exponent")
assert.match(
    whiteBoxText,
    /丹所在队伍伤害的最大化，主要取决于队友攻击力、队友其他属性（如异常精通、穿透等）、耀变伤害占比、丹初始攻击力、丹局内精通。为了简化计算，我们将队友攻击力、耀变伤害占比设置为变量，队友其他属性设置为恒变量k，从而得到关于丹攻击力以及异常精通配置的最优解。/,
)
assert.doesNotMatch(whiteBoxText, /公共环境异常增伤完整作用|例如公共倍率为 1\.16/)
assert.doesNotMatch(whiteBoxText, /实测参考构筑|参考耀变/, "No unknown measured-build reference may appear")
assert.doesNotMatch(whiteBoxText, /归一化|本次虚曜|原异常倍率 B|抗性口径|特殊虚曜/)

const bossAnomalyBuffId = "boss_encounter.notorious_dead_end_butcher.v3_1.p1"
const bossEnvironment = calculateInCombatPanel(catalog, input({
    combatBuffs: { activeBuffIds: [bossAnomalyBuffId] },
}))
const bossEnvironmentEvent = bossEnvironment.damage.events[0]
const bossEnvironmentA = bossEnvironment.outOfCombat.panel.atk
const bossEnvironmentP = bossEnvironment.inCombat.panel.anomalyProficiency
const bossEnvironmentBase = (2800 + Math.min(0.4 * bossEnvironmentA, 1600))
    * (1.10 + 0.0002 * bossEnvironmentP)
const bossEnvironmentExpected = bossEnvironmentBase
    * 1.5
    * Math.pow((1 + 0.002 * bossEnvironmentP) * (1.5 / 1.5), 0.5)
approx(
    bossEnvironmentEvent.finalDamage,
    bossEnvironmentExpected,
    "Boss environment multiplier is retained in full",
)
assert.equal(bossEnvironmentEvent.multipliers.teamAnomalyDamage, 1.5)
assert.equal(bossEnvironmentEvent.multipliers.luminescenceDamage, 1.5)
assert.equal(bossEnvironmentEvent.luminescence.teamAnomalyDamageBonus, 0.5)
assert.equal(bossEnvironmentEvent.luminescence.luminescenceExclusiveDamageBonus, 0)
const bossEnvironmentWhiteBoxText = JSON.stringify(bossEnvironmentEvent.whiteBoxRows)
assert.match(bossEnvironmentWhiteBoxText, /1\.5/)
assert.match(bossEnvironmentWhiteBoxText, /\^0\.5/)
const resolvedBossModifier = bossEnvironment.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
    .find(modifier => modifier.kind === "anomalyDamageBonus")
assert.equal(resolvedBossModifier?.sourceType, "boss")
assert.equal(resolvedBossModifier?.sourceKey, bossAnomalyBuffId)
assert.equal(isTeamAnomalyDamageModifier(resolvedBossModifier), true)

const personalLuminescenceBonus = {
    id: "dan-personal-luminescence-bonus",
    label: "丹个人属性异常增伤",
    effects: [{
        id: "dan-personal-luminescence-bonus-value",
        type: "fixed",
        target: { kind: "anomaly", settlementType: "luminescence" },
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 35,
    }],
}
const environmentAndPersonalInput = input({
    combatBuffs: {
        activeBuffIds: [bossAnomalyBuffId],
        manualEffects: [personalLuminescenceBonus],
    },
})
const environmentAndPersonal = calculateInCombatPanel(catalog, environmentAndPersonalInput)
const environmentAndPersonalEvent = environmentAndPersonal.damage.events[0]
const environmentAndPersonalA = environmentAndPersonal.outOfCombat.panel.atk
const environmentAndPersonalP = environmentAndPersonal.inCombat.panel.anomalyProficiency
const environmentAndPersonalBase = (2800 + Math.min(0.4 * environmentAndPersonalA, 1600))
    * (1.10 + 0.0002 * environmentAndPersonalP)
const environmentAndPersonalExpected = environmentAndPersonalBase
    * 1.5
    * Math.pow((1 + 0.002 * environmentAndPersonalP) * (1.85 / 1.5), 0.5)
approx(
    environmentAndPersonalEvent.finalDamage,
    environmentAndPersonalExpected,
    "public environment and personal Luminescence bonuses use relative weighting",
)
assert.equal(environmentAndPersonalEvent.multipliers.teamAnomalyDamage, 1.5)
assert.equal(environmentAndPersonalEvent.multipliers.luminescenceDamage, 1.85)
approx(environmentAndPersonalEvent.luminescence.luminescenceExclusiveDamageBonus, 0.35, "personal bonus S")
assert.notEqual(environmentAndPersonalEvent.multipliers.luminescenceDamage, 1.5 * 1.35)
const resolvedPersonalModifier = environmentAndPersonal.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
    .find(modifier => modifier.sourceKey === "manualEffect:dan-personal-luminescence-bonus")
assert.equal(isTeamAnomalyDamageModifier(resolvedPersonalModifier), false)
const environmentAndPersonalWhiteBoxText = JSON.stringify(environmentAndPersonalEvent.whiteBoxRows)
assert.match(environmentAndPersonalWhiteBoxText, /1\.85/)
assert.match(environmentAndPersonalWhiteBoxText, /1\.5/)
assert.match(environmentAndPersonalWhiteBoxText, /\^0\.5/)

const personalOnly = calculateInCombatPanel(catalog, input({
    combatBuffs: {
        activeBuffIds: [],
        manualEffects: [personalLuminescenceBonus],
    },
})).damage.events[0]
assert.equal(personalOnly.multipliers.teamAnomalyDamage, 1)
assert.equal(personalOnly.multipliers.luminescenceDamage, 1.35)

const fieldEnvironment = calculateInCombatPanel(catalog, input({
    combatBuffs: { activeBuffIds: ["field.critical_assault.v3_1.p1.luli"] },
})).damage.events[0]
assert.equal(fieldEnvironment.multipliers.teamAnomalyDamage, 1.25)
assert.equal(fieldEnvironment.multipliers.luminescenceDamage, 1.25)

const targetedBossBuffId = "test.boss.luminescence_only"
const publicEnvironmentBuffId = "test.field.public_anomaly_16"
const attributeSpecificFieldBuffId = "test.field.lumiflux_only"
const elementSpecificFieldBuffId = "test.field.lumiflux_element_only"
const specialtySpecificFieldBuffId = "test.field.anomaly_specialty_only"
const statSpecificBossBuffId = "test.boss.initial_atk_only"
const targetedBossCatalog = {
    ...catalog,
    combatBuffs: [
        ...catalog.combatBuffs,
        {
            id: publicEnvironmentBuffId,
            sourceType: "field",
            scope: "inCombat",
            effects: [{
                id: "test_field_public_anomaly_16_value",
                type: "fixed",
                target: { kind: "default" },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 16,
            }],
        },
        {
            id: targetedBossBuffId,
            sourceType: "boss",
            scope: "inCombat",
            effects: [{
                id: "test_boss_luminescence_only_value",
                type: "fixed",
                target: { kind: "anomaly", settlementType: "luminescence" },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 50,
            }],
        },
        {
            id: attributeSpecificFieldBuffId,
            sourceType: "field",
            scope: "inCombat",
            effects: [{
                id: "test_field_lumiflux_only_value",
                type: "fixed",
                target: { kind: "default" },
                requirement: { attribute: "lumiflux" },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 50,
            }],
        },
        {
            id: elementSpecificFieldBuffId,
            sourceType: "field",
            scope: "inCombat",
            effects: [{
                id: "test_field_lumiflux_element_only_value",
                type: "fixed",
                target: { kind: "default" },
                appliesTo: { elements: ["lumiflux"] },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 50,
            }],
        },
        {
            id: specialtySpecificFieldBuffId,
            sourceType: "field",
            scope: "inCombat",
            effects: [{
                id: "test_field_anomaly_specialty_only_value",
                type: "fixed",
                target: { kind: "default" },
                requirement: { specialty: dan.specialty },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 20,
            }],
        },
        {
            id: statSpecificBossBuffId,
            sourceType: "boss",
            scope: "inCombat",
            effects: [{
                id: "test_boss_initial_atk_only_value",
                type: "fixed",
                target: { kind: "default" },
                requirement: { outOfCombatStat: { stat: "atk", min: 0 } },
                stat: "anomalyDamageBonus",
                mode: "flat",
                value: 30,
            }],
        },
    ],
}
const publicEnvironmentAndPersonalInput = input({
    combatBuffs: {
        activeBuffIds: [publicEnvironmentBuffId],
        manualEffects: [personalLuminescenceBonus],
    },
})
const publicEnvironmentAndPersonal = calculateInCombatPanel(
    targetedBossCatalog,
    publicEnvironmentAndPersonalInput,
)
const publicEnvironmentAndPersonalEvent = publicEnvironmentAndPersonal.damage.events[0]
const publicEnvironmentAndPersonalA = publicEnvironmentAndPersonal.outOfCombat.panel.atk
const publicEnvironmentAndPersonalP = publicEnvironmentAndPersonal.inCombat.panel.anomalyProficiency
const publicEnvironmentAndPersonalBase = (2800
    + Math.min(0.4 * publicEnvironmentAndPersonalA, 1600))
    * (1.10 + 0.0002 * publicEnvironmentAndPersonalP)
const publicEnvironmentAndPersonalExpected = publicEnvironmentAndPersonalBase
    * 1.16
    * Math.pow(
        (1 + 0.002 * publicEnvironmentAndPersonalP) * (1.51 / 1.16),
        0.5,
    )
const equivalentTwoBranchExpected = publicEnvironmentAndPersonalBase
    * Math.pow(1.16, 0.5)
    * Math.pow((1 + 0.002 * publicEnvironmentAndPersonalP) * 1.51, 0.5)
approx(
    publicEnvironmentAndPersonalEvent.finalDamage,
    publicEnvironmentAndPersonalExpected,
    "16% public and 35% Luminescence-only bonus formal score",
)
approx(
    publicEnvironmentAndPersonalExpected,
    equivalentTwoBranchExpected,
    "relative-advantage and two-branch geometric formulas are equivalent",
)
assert.equal(publicEnvironmentAndPersonalEvent.multipliers.teamAnomalyDamage, 1.16)
assert.equal(publicEnvironmentAndPersonalEvent.multipliers.luminescenceDamage, 1.51)
assert.match(JSON.stringify(publicEnvironmentAndPersonalEvent.whiteBoxRows), /1\.51 \/ 1\.16/)
assert.match(JSON.stringify(publicEnvironmentAndPersonalEvent.whiteBoxRows), /\^0\.5/)
const targetedBoss = calculateInCombatPanel(targetedBossCatalog, input({
    combatBuffs: { activeBuffIds: [targetedBossBuffId] },
})).damage.events[0]
assert.equal(targetedBoss.multipliers.teamAnomalyDamage, 1)
assert.equal(targetedBoss.multipliers.luminescenceDamage, 1.5)
const attributeSpecificField = calculateInCombatPanel(targetedBossCatalog, input({
    combatBuffs: { activeBuffIds: [attributeSpecificFieldBuffId] },
})).damage.events[0]
assert.equal(attributeSpecificField.multipliers.teamAnomalyDamage, 1)
assert.equal(attributeSpecificField.multipliers.luminescenceDamage, 1.5)
const elementSpecificField = calculateInCombatPanel(targetedBossCatalog, input({
    combatBuffs: { activeBuffIds: [elementSpecificFieldBuffId] },
})).damage.events[0]
assert.equal(elementSpecificField.multipliers.teamAnomalyDamage, 1)
assert.equal(elementSpecificField.multipliers.luminescenceDamage, 1.5)
approx(
    elementSpecificField.finalDamage,
    baselineEvent.finalDamage * Math.pow(1.5, 0.5),
    "Lumiflux element-targeted bonus must affect only the Luminescence branch",
)
const specialtySpecificField = calculateInCombatPanel(targetedBossCatalog, input({
    combatBuffs: { activeBuffIds: [specialtySpecificFieldBuffId] },
})).damage.events[0]
assert.equal(specialtySpecificField.multipliers.teamAnomalyDamage, 1)
assert.equal(specialtySpecificField.multipliers.luminescenceDamage, 1.2)
const statSpecificBoss = calculateInCombatPanel(targetedBossCatalog, input({
    combatBuffs: { activeBuffIds: [statSpecificBossBuffId] },
})).damage.events[0]
assert.equal(statSpecificBoss.multipliers.teamAnomalyDamage, 1)
assert.equal(statSpecificBoss.multipliers.luminescenceDamage, 1.3)
for (const requirement of [undefined, null, {}]) {
    assert.equal(isTeamAnomalyDamageModifier({
        kind: "anomalyDamageBonus",
        sourceType: "field",
        target: { kind: "default" },
        ...(requirement === undefined ? {} : { requirement }),
    }), true)
}
for (const requirement of [
    { specialty: dan.specialty },
    { outOfCombatStat: { stat: "atk", min: 0 } },
]) {
    assert.equal(isTeamAnomalyDamageModifier({
        kind: "anomalyDamageBonus",
        sourceType: "field",
        target: { kind: "default" },
        requirement,
    }), false)
}

const targetIndependent = calculateInCombatPanel(catalog, input({
    damage: damageWith({}, {
        target: {
            presetId: "custom",
            defense: 999999,
            levelCoefficient: 1,
            resistanceByElement: {
                physical: 0.99,
                fire: -0.5,
                ice: 0.75,
                electric: 0.4,
                ether: 0.8,
                wind: 0.6,
            },
            stunMultiplier: 9,
        },
    }),
})).damage.finalDamage
approx(targetIndependent, baseline.damage.finalDamage, "enemy target must not affect Luminescence score")

const cinemaTwo = calculateInCombatPanel(catalog, input({ cinemaLevel: 2 }))
const cinemaTwoP = cinemaTwo.inCombat.panel.anomalyProficiency
const cinemaTwoExpected = (2800 + Math.min(0.4 * cinemaTwo.outOfCombat.panel.atk, 1600))
    * (1.30 + 0.0002 * cinemaTwoP)
    * Math.pow(1 + 0.002 * cinemaTwoP, 0.5)
approx(cinemaTwo.damage.finalDamage, cinemaTwoExpected, "Cinema 2 conversion coefficient")
const cinemaTwoAlienationRow = cinemaTwo.damage.events[0].whiteBoxRows
    .find(row => row.label === "异化倍率")
assert.match(
    cinemaTwoAlienationRow.formula,
    /^1 \+ 0\.10 \+ 0\.20 \+ 0\.0002 × [\d.]+ = [\d.]+$/,
    "Cinema 2 white box must expose the +0.20 conversion term",
)
for (const cinemaLevel of [1, 4, 6]) {
    const result = calculateInCombatPanel(catalog, input({ cinemaLevel }))
    assert.equal(result.damage.scalarReady, true, `Cinema ${cinemaLevel} must not block the score`)
    assert.equal(result.damage.events[0].count, 1, `Cinema ${cinemaLevel} fixed trigger mechanics belong to k`)
}

const legacyA = calculateInCombatPanel(catalog, input({
    damage: damageWith({
        teammateAttack: undefined,
        records: [{ kind: "normal", T: 2345, k: 1, B: 1, sourceElement: "ice" }],
        m4MultiplierMode: "unconfirmed",
        resistanceMode: "sourceElement",
    }),
})).damage.events[0]
const legacyB = calculateInCombatPanel(catalog, input({
    damage: damageWith({
        teammateAttack: undefined,
        records: [{ kind: "normal", T: 2345, k: 9, B: 99, sourceElement: "fire" }],
    }),
})).damage.events[0]
assert.equal(legacyA.input.teammateAttack, 2345)
assert.equal(legacyA.input.luminescenceDamageSharePct, 50)
approx(legacyA.finalDamage, legacyB.finalDamage, "legacy B and k are represented by symbolic k")
assert.throws(
    () => calculateInCombatPanel(catalog, input({ damage: damageWith({ teammateAttack: -1 }) })),
    /teammateAttack/,
)
for (const teammateAttack of [null, ""]) {
    assert.throws(
        () => calculateInCombatPanel(catalog, input({ damage: damageWith({ teammateAttack }) })),
        /teammateAttack/,
    )
}
assert.throws(
    () => calculateInCombatPanel(catalog, input({ damage: damageWith({ luminescenceDamageSharePct: 101 }) })),
    /luminescenceDamageSharePct/,
)
for (const luminescenceDamageSharePct of [null, ""]) {
    assert.throws(
        () => calculateInCombatPanel(catalog, input({
            damage: damageWith({ luminescenceDamageSharePct }),
        })),
        /luminescenceDamageSharePct/,
    )
}
assert.throws(
    () => calculateInCombatPanel(catalog, input({
        damage: {
            ...structuredClone(dan.defaultCalculationConfig),
            events: [
                structuredClone(dan.defaultCalculationConfig.events[0]),
                { id: "mixed-direct", kind: "direct", skillMultiplier: 1, damageElement: "physical" },
            ],
        },
    })),
    /队伍异常评分必须作为单独事件使用/,
)

const calculator = createInCombatPanelCalculator(catalog, input())
const statTotals = new Map([["atkPct", 0.24], ["atkFlat", 80], ["anomalyProficiency", 54]])
const compiled = calculator.scoreOnlyFromSummary(statTotals, new Map())
const ordinary = calculator.scoreOnlyFromSummaryLegacy(statTotals, new Map())
approx(compiled.finalDamage, ordinary.finalDamage, "ordinary and compiled score")
const statIds = ["atkPct", "atkFlat", "anomalyProficiency"]
const statValues = Float64Array.from(statIds.map(id => statTotals.get(id) ?? 0))
const dense = calculator.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
const denseSummary = dense.scoreDense(statValues, new Int16Array())
const fixed = dense.compileForSetCounts(new Int16Array()).scoreScalar(statValues)
approx(denseSummary.finalDamage, compiled.finalDamage, "dense and compiled score")
approx(fixed.finalDamage, compiled.finalDamage, "fixed and compiled score")

const environmentCalculator = createInCombatPanelCalculator(
    targetedBossCatalog,
    publicEnvironmentAndPersonalInput,
)
const environmentCompiled = environmentCalculator.scoreOnlyFromSummary(statTotals, new Map())
const environmentOrdinary = environmentCalculator.scoreOnlyFromSummaryLegacy(statTotals, new Map())
const environmentDense = environmentCalculator.compileDensePanelScoreTarget({
    statIds,
    setIds: [],
    setIndexById: new Map(),
})
const environmentDenseSummary = environmentDense.scoreDense(statValues, new Int16Array())
const environmentFixed = environmentDense.compileForSetCounts(new Int16Array()).scoreScalar(statValues)
for (const [label, summary] of Object.entries({
    ordinary: environmentOrdinary,
    dense: environmentDenseSummary,
    fixed: environmentFixed,
})) {
    approx(
        summary.finalDamage,
        environmentCompiled.finalDamage,
        `16% environment and 35% personal bonus ${label} cross-path score`,
    )
}

const elementSpecificInput = input({
    combatBuffs: { activeBuffIds: [elementSpecificFieldBuffId] },
})
const elementSpecificCalculator = createInCombatPanelCalculator(targetedBossCatalog, elementSpecificInput)
const elementSpecificCompiled = elementSpecificCalculator.scoreOnlyFromSummary(statTotals, new Map())
const elementSpecificOrdinary = elementSpecificCalculator.scoreOnlyFromSummaryLegacy(statTotals, new Map())
const elementSpecificDense = elementSpecificCalculator.compileDensePanelScoreTarget({
    statIds,
    setIds: [],
    setIndexById: new Map(),
})
const elementSpecificDenseSummary = elementSpecificDense.scoreDense(statValues, new Int16Array())
const elementSpecificFixed = elementSpecificDense.compileForSetCounts(new Int16Array()).scoreScalar(statValues)
for (const [label, summary] of Object.entries({
    ordinary: elementSpecificOrdinary,
    dense: elementSpecificDenseSummary,
    fixed: elementSpecificFixed,
})) {
    approx(
        summary.finalDamage,
        elementSpecificCompiled.finalDamage,
        `Lumiflux element-targeted ${label} cross-path score`,
    )
}

const settlementEvents = {
    attribute: { kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault" },
    disorder: { kind: "anomaly", settlementType: "disorder", anomalyEffect: "burn" },
    release: { kind: "anomaly", settlementType: "release", anomalyEffect: "corruption" },
    luminescence: { kind: "anomaly", settlementType: "luminescence" },
}
for (const settlementType of Object.keys(settlementEvents)) {
    const modifier = {
        appliesTo: {
            damageKinds: [settlementType === "disorder" ? "disorder" : "anomaly"],
            settlementTypes: [settlementType],
        },
    }
    for (const [eventType, event] of Object.entries(settlementEvents)) {
        assert.equal(
            damageModifierAppliesTo(modifier, event),
            eventType === settlementType,
            `${settlementType} modifier isolation from ${eventType}`,
        )
    }
}

const lumifluxDirectSkillRef = {
    agentSkillId: "remielle_dan",
    categoryId: "basic",
    moveId: "basic_vertical_rainbow",
    rowId: "direct_damage",
}

function lumifluxDirectDamage(target = undefined) {
    return {
        selectedEventId: "lumiflux-direct",
        events: [{
            id: "lumiflux-direct",
            kind: "direct",
            critMode: "nonCrit",
            skillRef: lumifluxDirectSkillRef,
        }],
        ...(target ? { target } : {}),
    }
}

const lumifluxDirect = calculateInCombatPanel(catalog, input({ damage: lumifluxDirectDamage() }))
assert.ok(Number.isFinite(lumifluxDirect.damage.finalDamage))
assert.equal(lumifluxDirect.damage.input.damageElement, "lumiflux")
assert.equal(lumifluxDirect.damage.input.skillSource.damageElement, "lumiflux")
assert.equal(lumifluxDirect.damage.targetBreakdown.damageElement, "lumiflux")
assert.equal(lumifluxDirect.damage.targetBreakdown.targetResistance, 0)
assert.equal(lumifluxDirect.damage.targetBreakdown.enemyResReduction, 0)
assert.equal(lumifluxDirect.damage.targetBreakdown.resIgnore, 0)
assert.equal(lumifluxDirect.damage.targetBreakdown.resistanceFixedOne, true)
assert.equal(lumifluxDirect.damage.multipliers.resistance, 1)
assert.equal("lumifluxDmg" in lumifluxDirect.damage.events[0].panelSnapshot, false)
assert.equal("lumiflux" in lumifluxDirect.damage.input.target.resistanceByElement, false)
const lumifluxResistanceRow = lumifluxDirect.damage.whiteBoxRows.find(row => row.label === "抗性乘区")
assert.equal(lumifluxResistanceRow?.value, 1)
assert.equal(lumifluxResistanceRow?.displayValue, "1")
assert.match(lumifluxResistanceRow?.formula ?? "", /流明直伤不使用抗性.*固定为 1/)

const lumifluxDirectAgainstExtremeSixResistance = calculateInCombatPanel(catalog, input({
    damage: lumifluxDirectDamage({
        presetId: "custom",
        defense: 953,
        resistanceByElement: {
            physical: 99,
            fire: -99,
            ice: 80,
            electric: -50,
            ether: 60,
            wind: 45,
        },
        stunMultiplierPercent: 150,
    }),
}))
approx(
    lumifluxDirectAgainstExtremeSixResistance.damage.finalDamage,
    lumifluxDirect.damage.finalDamage,
    "six-element resistance must not affect Lumiflux direct damage",
)
const lumifluxDirectWithResistanceModifiers = calculateInCombatPanel(catalog, input({
    combatBuffs: {
        activeBuffIds: [],
        manualEffects: [{
            id: "lumiflux-resistance-modifiers",
            label: "流明抗性边界测试",
            effects: [
                { id: "generic-res-reduction", type: "fixed", stat: "enemyResReduction", value: 90, mode: "flat", target: { kind: "default" } },
                { id: "all-res-ignore", type: "fixed", stat: "allResIgnore", value: 90, mode: "flat", target: { kind: "default" } },
            ],
        }],
    },
    damage: lumifluxDirectDamage(),
}))
approx(
    lumifluxDirectWithResistanceModifiers.damage.finalDamage,
    lumifluxDirect.damage.finalDamage,
    "resistance reduction and resistance ignore must not affect Lumiflux direct damage",
)
assert.equal(lumifluxDirectWithResistanceModifiers.damage.targetBreakdown.enemyResReduction, 0)
assert.equal(lumifluxDirectWithResistanceModifiers.damage.targetBreakdown.resIgnore, 0)

const lumifluxDirectCalculator = createInCombatPanelCalculator(catalog, input({ damage: lumifluxDirectDamage() }))
const lumifluxDirectMetadata = lumifluxDirectCalculator.optimizerStatMetadata()
for (const irrelevantStat of ["physicalDmg", "lumifluxDmg", "lumifluxResIgnore", "allResIgnore"]) {
    assert.equal(
        lumifluxDirectMetadata.panelStatIds.includes(irrelevantStat),
        false,
        `${irrelevantStat} must not be relevant to Lumiflux direct damage`,
    )
}

const lumifluxDirectStatIds = ["atkPct", "atkFlat", "dmgBonus", "physicalDmg", "allResIgnore"]
const lumifluxDirectStatTotals = new Map([
    ["atkPct", 0.24],
    ["atkFlat", 80],
    ["dmgBonus", 0.2],
    ["physicalDmg", 0.75],
    ["allResIgnore", 0.9],
])
const lumifluxDirectStatValues = Float64Array.from(
    lumifluxDirectStatIds.map(id => lumifluxDirectStatTotals.get(id) ?? 0),
)
const lumifluxDirectCompiled = lumifluxDirectCalculator.scoreOnlyFromSummary(lumifluxDirectStatTotals, new Map())
const lumifluxDirectLegacy = lumifluxDirectCalculator.scoreOnlyFromSummaryLegacy(lumifluxDirectStatTotals, new Map())
const lumifluxDirectDense = lumifluxDirectCalculator.compileDensePanelScoreTarget({
    statIds: lumifluxDirectStatIds,
    setIds: [],
    setIndexById: new Map(),
})
const lumifluxDirectDenseSummary = lumifluxDirectDense.scoreDense(lumifluxDirectStatValues, new Int16Array())
const lumifluxDirectFixed = lumifluxDirectDense.compileForSetCounts(new Int16Array())
const lumifluxDirectFixedSummary = lumifluxDirectFixed.scoreScalar(lumifluxDirectStatValues)
const lumifluxDirectFixedObjective = lumifluxDirectFixed.scoreObjectiveScalar(lumifluxDirectStatValues)
for (const [label, summary] of Object.entries({
    compiled: lumifluxDirectCompiled,
    legacy: lumifluxDirectLegacy,
    dense: lumifluxDirectDenseSummary,
    fixed: lumifluxDirectFixedSummary,
    fixedObjective: lumifluxDirectFixedObjective,
})) {
    assert.ok(Number.isFinite(summary.finalDamage), `${label} Lumiflux direct damage must be finite`)
    approx(summary.finalDamage, lumifluxDirectCompiled.finalDamage, `${label} Lumiflux direct cross-path score`)
}
const lumifluxDirectWithoutIrrelevantStats = lumifluxDirectCalculator.scoreOnlyFromSummary(
    new Map([["atkPct", 0.24], ["atkFlat", 80], ["dmgBonus", 0.2]]),
    new Map(),
)
approx(
    lumifluxDirectCompiled.finalDamage,
    lumifluxDirectWithoutIrrelevantStats.finalDamage,
    "physical damage and all-resistance ignore must not affect Lumiflux direct damage",
)
const lumifluxDirectWithoutGenericBonus = lumifluxDirectCalculator.scoreOnlyFromSummary(
    new Map([["atkPct", 0.24], ["atkFlat", 80]]),
    new Map(),
)
assert.ok(
    lumifluxDirectCompiled.finalDamage > lumifluxDirectWithoutGenericBonus.finalDamage,
    "generic damage bonus must still affect Lumiflux direct damage",
)

const mixedLumifluxCalculator = createInCombatPanelCalculator(catalog, input({
    damage: {
        selectedEventId: "lumiflux-direct",
        events: [
            lumifluxDirectDamage().events[0],
            {
                id: "physical-assault",
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffect: "assault",
                damageElement: "physical",
            },
        ],
    },
}))
const mixedStatIds = [...lumifluxDirectStatIds, "anomalyProficiency", "anomalyMastery"]
const mixedStatTotals = new Map([...lumifluxDirectStatTotals, ["anomalyProficiency", 54], ["anomalyMastery", 30]])
const mixedStatValues = Float64Array.from(mixedStatIds.map(id => mixedStatTotals.get(id) ?? 0))
const mixedCompiled = mixedLumifluxCalculator.scoreOnlyFromSummary(mixedStatTotals, new Map())
const mixedLegacy = mixedLumifluxCalculator.scoreOnlyFromSummaryLegacy(mixedStatTotals, new Map())
const mixedDense = mixedLumifluxCalculator.compileDensePanelScoreTarget({
    statIds: mixedStatIds,
    setIds: [],
    setIndexById: new Map(),
})
const mixedDenseSummary = mixedDense.scoreDense(mixedStatValues, new Int16Array())
const mixedFixed = mixedDense.compileForSetCounts(new Int16Array())
const mixedFixedSummary = mixedFixed.scoreScalar(mixedStatValues)
const mixedFixedObjective = mixedFixed.scoreObjectiveScalar(mixedStatValues)
for (const [label, summary] of Object.entries({
    legacy: mixedLegacy,
    dense: mixedDenseSummary,
    fixed: mixedFixedSummary,
    fixedObjective: mixedFixedObjective,
})) {
    assert.ok(Number.isFinite(summary.finalDamage), `${label} mixed Lumiflux score must be finite`)
    approx(summary.finalDamage, mixedCompiled.finalDamage, `${label} mixed Lumiflux cross-path score`)
}

function optimizerDisc(id, partition, mainStat, variableSubStat) {
    const setId = "zzz_wiki_2116"
    const withDisplay = stat => ({
        ...stat,
        mode: stat.mode ?? "flat",
        label: stat.stat,
    })
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
        mainStat: withDisplay(mainStat),
        subStats: [
            withDisplay(variableSubStat),
            withDisplay({ stat: "hpPct", value: 3, mode: "pct" }),
            withDisplay({ stat: "defPct", value: 4.8, mode: "pct" }),
            withDisplay({ stat: "critDmg", value: 4.8, mode: "pct" }),
        ],
        source: { type: "test", sequence: partition * 10 + (id.endsWith("-ap") ? 2 : 1) },
    }
}

const optimizerMainStats = {
    1: { stat: "hpFlat", value: 2200 },
    2: { stat: "atkFlat", value: 316 },
    3: { stat: "defFlat", value: 184 },
    4: { stat: "anomalyProficiency", value: 92 },
    5: { stat: "atkPct", value: 30, mode: "pct" },
    6: { stat: "atkPct", value: 30, mode: "pct" },
}
const optimizerStore = {
    version: 1,
    owners: [{ id: "default", label: "Default" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [1, 2, 3, 4, 5, 6].flatMap(partition => [
        optimizerDisc(`dan-${partition}-atk`, partition, optimizerMainStats[partition], { stat: "atkPct", value: 3, mode: "pct" }),
        optimizerDisc(`dan-${partition}-ap`, partition, optimizerMainStats[partition], { stat: "anomalyProficiency", value: 9 }),
    ]),
}
const optimizerSettings = {
    fourPieceSetId: "zzz_wiki_2116",
    twoPieceSetId: "zzz_wiki_2116",
    objective: "damage",
    algorithm: "exact",
}
const optimizerRunInput = input({ settings: optimizerSettings })
const optimizerMetadata = createInCombatPanelCalculator(catalog, optimizerRunInput).optimizerStatMetadata()
assert.deepEqual(optimizerMetadata.panelStatIds, ["anomalyProficiency", "atk"])
assert.deepEqual(
    optimizerMetadata.relevantStatIds,
    ["anomalyProficiency", "anomalyProficiencyFlat", "atkFlat", "atkPct"],
)

const optimized = optimizeDriveDiscs(catalog, optimizerStore, optimizerRunInput)
assert.equal(optimized.metrics.strictExact, true)
assert.equal(optimized.metrics.estimatedCombinationCount, 64)
assert.ok(optimized.results.length > 0)
const ordinaryPreview = previewDriveDiscOptimization(catalog, optimizerStore, optimizerRunInput)
assert.equal(ordinaryPreview.error?.isError, false)

function calculateOptimizerSelection(selected) {
    return calculateInCombatPanel(catalog, {
        ...optimizerRunInput,
        driveDiscs: selected.map(toCalculatorDriveDisc),
        combatBuffs: {
            ...optimizerRunInput.combatBuffs,
            activeBuffIds: ["driveDisc4pc:zzz_wiki_2116.self"],
        },
    })
}

const selected = optimized.results[0].driveDiscs
const selectedCalculation = calculateOptimizerSelection(selected)
assert.equal(selectedCalculation.damage.events[0].multipliers.luminescenceDamage, 1.15)
assert.ok(selectedCalculation.inCombat.panel.anomalyProficiency >= baseline.inCombat.panel.anomalyProficiency + 80)
approx(
    optimized.results[0].score,
    selectedCalculation.damage.totalFinalDamage,
    "strict optimizer and ordinary score for selected build",
)

let bruteForceBest = Number.NEGATIVE_INFINITY
const chosen = []
function enumerateOptimizerCandidates(partition = 1) {
    if (partition > 6) {
        bruteForceBest = Math.max(bruteForceBest, calculateOptimizerSelection(chosen).damage.totalFinalDamage)
        return
    }
    for (const candidate of optimizerStore.driveDiscs.filter(item => item.partition === partition)) {
        chosen.push(candidate)
        enumerateOptimizerCandidates(partition + 1)
        chosen.pop()
    }
}
enumerateOptimizerCandidates()
approx(optimized.results[0].score, bruteForceBest, "strict optimizer must match brute force")

const environmentOptimizerRunInput = input({
    settings: optimizerSettings,
    combatBuffs: {
        activeBuffIds: [publicEnvironmentBuffId],
        manualEffects: [personalLuminescenceBonus],
    },
})
const environmentOptimized = optimizeDriveDiscs(
    targetedBossCatalog,
    optimizerStore,
    environmentOptimizerRunInput,
)
assert.equal(environmentOptimized.metrics.strictExact, true)
assert.ok(environmentOptimized.results.length > 0)
function calculateEnvironmentOptimizerSelection(selected) {
    return calculateInCombatPanel(targetedBossCatalog, {
        ...environmentOptimizerRunInput,
        driveDiscs: selected.map(toCalculatorDriveDisc),
        combatBuffs: {
            ...environmentOptimizerRunInput.combatBuffs,
            activeBuffIds: [publicEnvironmentBuffId, "driveDisc4pc:zzz_wiki_2116.self"],
        },
    })
}
const environmentSelectedCalculation = calculateEnvironmentOptimizerSelection(
    environmentOptimized.results[0].driveDiscs,
)
assert.equal(environmentSelectedCalculation.damage.events[0].multipliers.teamAnomalyDamage, 1.16)
assert.equal(environmentSelectedCalculation.damage.events[0].multipliers.luminescenceDamage, 1.66)
approx(
    environmentOptimized.results[0].score,
    environmentSelectedCalculation.damage.totalFinalDamage,
    "strict optimizer and ordinary environment score for selected build",
)
let environmentBruteForceBest = Number.NEGATIVE_INFINITY
function enumerateEnvironmentOptimizerCandidates(partition = 1) {
    if (partition > 6) {
        environmentBruteForceBest = Math.max(
            environmentBruteForceBest,
            calculateEnvironmentOptimizerSelection(chosen).damage.totalFinalDamage,
        )
        return
    }
    for (const candidate of optimizerStore.driveDiscs.filter(item => item.partition === partition)) {
        chosen.push(candidate)
        enumerateEnvironmentOptimizerCandidates(partition + 1)
        chosen.pop()
    }
}
enumerateEnvironmentOptimizerCandidates()
approx(
    environmentOptimized.results[0].score,
    environmentBruteForceBest,
    "strict environment optimizer must match brute force",
)

for (const cinemaLevel of [4, 6]) {
    const sync = optimizeDriveDiscs(catalog, optimizerStore, input({ cinemaLevel, settings: optimizerSettings }))
    assert.ok(sync.results.length > 0, `Cinema ${cinemaLevel} sync optimization must run`)
    const asyncResult = await optimizeDriveDiscsAsync(catalog, optimizerStore, input({ cinemaLevel, settings: optimizerSettings }))
    assert.ok(asyncResult.results.length > 0, `Cinema ${cinemaLevel} async optimization must run`)
}

console.log("Luminescence integration tests passed.")
