import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    optimizeDriveDiscs,
} from "../backend/driveDiscOptimizer.js"
import {
    createDriveDiscOptimizerRuntime,
} from "../core/driveDiscOptimizer-core.js"
import {
    expandCalculationConfigSkillGroups,
} from "../core/calculationSkillGroups.js"
import {
    corePassiveScalingRow,
} from "../core/corePassiveScaling.js"
import {
    resolveDefaultCalculationConfig,
} from "../core/defaultCalculationConfig.js"
import {
    potentialVisionScalingRow,
} from "../core/potentialVision.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadedCatalog = await loadCalculatorContext(rootDir)
const agent = loadedCatalog.agentsMap.get("soldier_11")
const skillCatalog = loadedCatalog.agentSkillsMap.get("soldier_11")

const zeroEngine = {
    id: "soldier_11_test_zero_engine",
    name: { zhCN: "11号测试零面板音擎" },
    rarity: "B",
    specialty: "attack",
    level60: { atkBase: 0 },
    modification: { minLevel: 1, maxLevel: 1, defaultLevel: 1 },
}
const catalog = {
    ...loadedCatalog,
    wEngines: [...loadedCatalog.wEngines, zeroEngine],
    wEnginesMap: new Map(loadedCatalog.wEnginesMap).set(zeroEngine.id, zeroEngine),
}

function approx(actual, expected, label, tolerance = 1e-8) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance,
        `${label}: expected ${expected}, got ${actual}`)
}

function move(categoryId, moveId) {
    return skillCatalog.categories
        .find(category => category.id === categoryId)?.moves
        .find(item => item.id === moveId)
}

function skillRow(categoryId, moveId, rowId) {
    return move(categoryId, moveId)?.rows.find(row => row.id === rowId)
}

function directEvent(categoryId, moveId, rowId, overrides = {}) {
    const event = {
        id: overrides.id ?? `${categoryId}-${moveId}-${rowId}`,
        kind: "direct",
        stunned: overrides.stunned ?? true,
        critMode: overrides.critMode ?? "expected",
        skillRef: { agentSkillId: "soldier_11", categoryId, moveId, rowId },
    }
    if (overrides.count !== undefined) {
        event.count = overrides.count
    } else if (!overrides.omitCount) {
        event.count = 1
    }
    return event
}

function activeAgentBuffIds(cinemaLevel = 0, { additionalAbility = true } = {}) {
    return [
        "agent:soldier_11.corePassive",
        ...(additionalAbility ? ["agent:soldier_11.additionalAbility"] : []),
        ...(agent.combatBuffs.cinemaBuffs ?? [])
            .filter(buff => Number(buff.cinemaLevel) <= cinemaLevel)
            .map(buff => `agent:soldier_11.cinema.${buff.cinemaLevel}`),
    ]
}

function calculate(events, {
    potentialLevel = 0,
    cinemaLevel = 0,
    coreSkillLevel = "F",
    additionalAbility = true,
    activeBuffIds = activeAgentBuffIds(cinemaLevel, { additionalAbility }),
} = {}) {
    return calculateInCombatPanel(catalog, {
        agentId: "soldier_11",
        coreSkillLevel,
        cinemaLevel,
        potentialLevel,
        wEngineId: zeroEngine.id,
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds,
            runtimeInputs: {},
            manualStats: [],
        },
        damage: {
            mode: "custom",
            selectedEventId: events[0]?.id,
            events,
            target: {
                defense: 953,
                stunMultiplierPercent: 150,
                resistanceByElement: { physical: 0, fire: 0 },
            },
        },
    })
}

assert.ok(agent)
assert.ok(skillCatalog)
assert.equal(agent.name.zhCN, "11号")
assert.equal(agent.attribute, "fire")
assert.equal(agent.specialty, "attack")
assert.deepEqual(agent.attackTypes, ["slash"])
assert.deepEqual(agent.level60, {
    hpBase: 7673,
    atkBase: 813,
    defBase: 612,
    critRate: 5,
    critDmg: 50,
    impact: 93,
    anomalyProficiency: 93,
    anomalyMastery: 94,
    energyRegen: 120,
    penRatio: 0,
})
assert.equal(agent.images.portrait, "/assets/agents/soldier_11.png")
assert.deepEqual(agent.preferredDriveDiscs.defaultSetIds, ["inferno_metal"])
assert.deepEqual(agent.preferredDriveDiscs.mainStatLimits, {
    4: ["critRate", "critDmg", "atkPct"],
    5: ["fireDmg", "penRatio", "atkPct"],
    6: ["atkPct"],
})

assert.deepEqual(agent.potentialVision, {
    ...agent.potentialVision,
    defaultLevel: 6,
    maxLevel: 6,
    mechanicUnlockLevel: 1,
})
assert.deepEqual(
    Array.from({ length: 7 }, (_, level) => potentialVisionScalingRow(agent, level).critDmgPct),
    [0, 0, 16, 24, 32, 40, 48],
)
assert.deepEqual(
    ["none", "A", "B", "C", "D", "E", "F"]
        .map(level => corePassiveScalingRow(agent, level).fireSuppressionDmgBonusPct),
    [35, 40.8, 46.6, 52.5, 58.3, 64.1, 70],
)

const levelTwelveExpected = new Map([
    ["basic/warmup_sparks/hit_1", 69.6],
    ["basic/warmup_sparks/hit_2", 83],
    ["basic/warmup_sparks/hit_3", 206.2],
    ["basic/warmup_sparks/hit_4", 426.8],
    ["basic/fire_suppression/hit_1", 111.2],
    ["basic/fire_suppression/hit_2", 114.4],
    ["basic/fire_suppression/hit_3", 264],
    ["basic/fire_suppression/hit_4", 681.7],
    ["basic/potential_fire_suppression_fifth/damage", 883.9],
    ["basic/potential_empowered_fire_suppression_fifth/base_damage", 883.9],
    ["basic/potential_empowered_fire_suppression_fifth/extra_damage", 166.4],
    ["basic/potential_firepower_burst/damage", 188.7],
    ["dodge/dash_attack_blazing_fire/damage", 137.6],
    ["dodge/dash_attack_fire_suppression/damage", 158],
    ["dodge/dodge_counter_backfire/damage", 524.9],
    ["assist/quick_assist_fire_cover/damage", 241.8],
    ["assist/assist_followup_reignite/damage", 767.8],
    ["special/special_raging_fire/damage", 105.4],
    ["special/ex_special_fervent_fire/damage", 1350.4],
    ["chain/chain_uplifting_flame/damage", 1265],
    ["chain/ultimate_roaring_flame/damage", 4206.2],
])
const levelSixteenExpected = new Map([
    ["basic/warmup_sparks/hit_1", 82.4],
    ["basic/warmup_sparks/hit_2", 98.2],
    ["basic/warmup_sparks/hit_3", 243.8],
    ["basic/warmup_sparks/hit_4", 504.4],
    ["basic/fire_suppression/hit_1", 131.6],
    ["basic/fire_suppression/hit_2", 135.2],
    ["basic/fire_suppression/hit_3", 312],
    ["basic/fire_suppression/hit_4", 805.7],
    ["dodge/dash_attack_blazing_fire/damage", 162.8],
    ["dodge/dash_attack_fire_suppression/damage", 186.8],
    ["dodge/dodge_counter_backfire/damage", 620.5],
    ["assist/quick_assist_fire_cover/damage", 285.8],
    ["assist/assist_followup_reignite/damage", 907.2],
    ["special/special_raging_fire/damage", 124.6],
    ["special/ex_special_fervent_fire/damage", 1596],
    ["chain/chain_uplifting_flame/damage", 1495],
    ["chain/ultimate_roaring_flame/damage", 4971],
])
const levelFourteenExpected = new Map([
    ["basic/warmup_sparks/hit_4", 465.6],
    ["basic/fire_suppression/hit_4", 743.7],
    ["basic/potential_fire_suppression_fifth/damage", 964.3],
    ["basic/potential_empowered_fire_suppression_fifth/extra_damage", 181.6],
    ["special/ex_special_fervent_fire/damage", 1473.2],
    ["chain/chain_uplifting_flame/damage", 1380],
    ["chain/ultimate_roaring_flame/damage", 4588.6],
])
for (const [ref, expected] of levelTwelveExpected) {
    const [categoryId, moveId, rowId] = ref.split("/")
    assert.equal(skillRow(categoryId, moveId, rowId)?.values[11], expected, `${ref} Lv12`)
}
for (const [ref, expected] of levelSixteenExpected) {
    const [categoryId, moveId, rowId] = ref.split("/")
    assert.equal(skillRow(categoryId, moveId, rowId)?.values[15], expected, `${ref} Lv16`)
}
for (const [ref, expected] of levelFourteenExpected) {
    const [categoryId, moveId, rowId] = ref.split("/")
    assert.equal(skillRow(categoryId, moveId, rowId)?.values[13], expected, `${ref} Lv14`)
}

for (const category of skillCatalog.categories) {
    for (const skillMove of category.moves) {
        for (const row of skillMove.rows) {
            assert.equal(row.values.length, 16,
                `${category.id}/${skillMove.id}/${row.id} should contain levels 1-16`)
            assert.ok(row.values.every(Number.isFinite),
                `${category.id}/${skillMove.id}/${row.id} should contain only finite numbers`)
        }
        const damagingRows = skillMove.rows.filter(row => row.kind === "damageMultiplier")
        if (!damagingRows.length) continue
        const isPhysical = ["warmup_sparks", "dash_attack_blazing_fire"].includes(skillMove.id)
        assert.equal(skillMove.damageElement, isPhysical ? "physical" : "fire")
    }
}
assert.deepEqual(skillRow("special", "ex_special_fervent_fire", "energy_cost").values, Array(16).fill(80))
assert.deepEqual(skillRow("basic", "potential_fire_suppression_fifth", "damage").values,
    Array.from({ length: 16 }, (_, index) => Number((441.7 + 40.2 * index).toFixed(1))))
assert.deepEqual(skillRow("basic", "potential_empowered_fire_suppression_fifth", "extra_damage").values,
    Array.from({ length: 16 }, (_, index) => Number((82.8 + 7.6 * index).toFixed(1))))
assert.deepEqual(skillRow("basic", "potential_fire_suppression_fifth", "daze").values,
    Array.from({ length: 16 }, (_, index) => Number((145.3 + 6.7 * index).toFixed(1))))
assert.deepEqual(skillRow("basic", "potential_firepower_burst", "damage").values,
    Array.from({ length: 16 }, (_, index) => Number((94.1 + 8.6 * index).toFixed(1))))
assert.deepEqual(skillRow("basic", "potential_firepower_burst", "daze").values,
    Array.from({ length: 16 }, (_, index) => Number((30.7 + 1.4 * index).toFixed(1))))
assert.equal(skillRow("basic", "fire_suppression", "hit_3").values[12], 276)
assert.deepEqual(skillRow("basic", "potential_empowered_fire_suppression_fifth", "extra_damage").eventCountRange,
    { min: 0, max: 6, default: 6 })

for (const invalidCount of [1.5, 7]) {
    assert.throws(
        () => calculate([{
            ...directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage"),
            count: invalidCount,
        }], { potentialLevel: 1 }),
        /Event count out of range/,
    )
}

for (const moveId of [
    "potential_fire_suppression_fifth",
    "potential_empowered_fire_suppression_fifth",
    "potential_firepower_burst",
]) {
    assert.equal(move("basic", moveId).requiresPotentialLevel, 1)
    assert.ok(move("basic", moveId).rows.every(row => row.requiresPotentialLevel === 1))
}
assert.deepEqual(move("basic", "fire_suppression").skillTags, ["fireSuppression"])
assert.deepEqual(move("dodge", "dash_attack_fire_suppression").skillTags, ["dashAttack", "fireSuppression"])
assert.deepEqual(move("dodge", "dodge_counter_backfire").skillTags, ["dodgeCounter"])
assert.equal(move("basic", "potential_firepower_burst").skillTags, undefined)

const basicCategory = skillCatalog.categories.find(category => category.id === "basic")
basicCategory.requiresPotentialLevel = 1
try {
    assert.throws(
        () => calculate([directEvent("basic", "warmup_sparks", "hit_1")], { potentialLevel: 0 }),
        /Skill category requires potential P1/,
    )
} finally {
    delete basicCategory.requiresPotentialLevel
}

assert.throws(
    () => calculate([
        directEvent("basic", "potential_fire_suppression_fifth", "damage"),
    ], { potentialLevel: 0 }),
    /requires potential P1/,
)
assert.throws(
    () => calculate([
        directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage"),
    ], { potentialLevel: 0 }),
    /requires potential P1/,
)
const omittedExtraCount = calculate([
    directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage", { omitCount: true }),
], { potentialLevel: 1 }).damage.events[0]
assert.equal(omittedExtraCount.count, 6)
for (const count of [0, 1, 6]) {
    const result = calculate([
        directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage", { count }),
    ], { potentialLevel: 1 }).damage.events[0]
    assert.equal(result.count, count)
}
assert.throws(
    () => calculate([
        directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage", { count: 7 }),
    ], { potentialLevel: 1 }),
    /Event count out of range/,
)

const p0Core = calculate([
    directEvent("basic", "fire_suppression", "hit_1"),
], { potentialLevel: 0 }).damage.events[0]
const p6Core = calculate([
    directEvent("basic", "fire_suppression", "hit_1"),
], { potentialLevel: 6 }).damage.events[0]
const p6NonStunned = calculate([
    directEvent("basic", "fire_suppression", "hit_1", { stunned: false }),
], { potentialLevel: 6 }).damage.events[0]
const p6Burst = calculate([
    directEvent("basic", "potential_firepower_burst", "damage"),
], { potentialLevel: 6 }).damage.events[0]
approx(p0Core.multipliers.dmg, 2.025, "P0 stunned Fire Suppression receives Heat Wave and Prairie Fire")
approx(p6Core.multipliers.dmg, 2.025, "P6 does not alter the damage-bonus multiplier")
approx(p6NonStunned.multipliers.dmg, 1.8, "non-stunned event excludes Prairie Fire 22.5%")
approx(p6Burst.multipliers.dmg, 1.325, "Firepower Burst excludes Heat Wave")

const p0Panel = calculate([
    directEvent("basic", "fire_suppression", "hit_1"),
], { potentialLevel: 0 }).inCombat.panel
const p6Panel = calculate([
    directEvent("basic", "fire_suppression", "hit_1"),
], { potentialLevel: 6 }).inCombat.panel
const p6WithoutAdditional = calculate([
    directEvent("basic", "fire_suppression", "hit_1"),
], { potentialLevel: 6, additionalAbility: false })
approx(p0Panel.critDmg, 0.5, "P0 Crit DMG")
approx(p6Panel.critDmg, 0.98, "P6 potential Crit DMG")
approx(p6WithoutAdditional.inCombat.panel.critDmg, 0.5, "potential Crit DMG requires Additional Ability")
approx(p6WithoutAdditional.damage.events[0].multipliers.dmg, 1.7,
    "disabling Additional Ability removes both Prairie Fire bonuses")

const m2Basic = calculate([
    directEvent("basic", "warmup_sparks", "hit_1", { stunned: false }),
], { cinemaLevel: 2, potentialLevel: 6 }).damage.events[0]
const m2Dash = calculate([
    directEvent("dodge", "dash_attack_blazing_fire", "damage", { stunned: false }),
], { cinemaLevel: 2, potentialLevel: 6 }).damage.events[0]
const m2Counter = calculate([
    directEvent("dodge", "dodge_counter_backfire", "damage", { stunned: false }),
], { cinemaLevel: 2, potentialLevel: 6 }).damage.events[0]
const m2Miss = calculate([
    directEvent("special", "special_raging_fire", "damage", { stunned: false }),
], { cinemaLevel: 2, potentialLevel: 6 }).damage.events[0]
approx(m2Basic.multipliers.dmg, 1.36, "M2 targets ordinary Basic Attack")
approx(m2Dash.multipliers.dmg, 1.36, "M2 targets physical Dash Attack")
approx(m2Counter.multipliers.dmg, 1.46, "M2 targets Dodge Counter plus 10% fire damage")
approx(m2Miss.multipliers.dmg, 1.1, "M2 excludes Special Attack")
const m2Rule = agent.combatBuffs.cinemaBuffs
    .find(buff => buff.cinemaLevel === 2).effects
    .find(effect => effect.id === "high-temperature-convergence-damage")
assert.equal(m2Rule.valuePerStack, 3)
assert.equal(m2Rule.maxStacks, 12)
assert.equal(m2Rule.defaultStacks, 12)

const m6Suppression = calculate([
    directEvent("basic", "fire_suppression", "hit_1", { stunned: false }),
], { cinemaLevel: 6, potentialLevel: 6 }).damage.events[0]
const m6Extra = calculate([
    directEvent("basic", "potential_empowered_fire_suppression_fifth", "extra_damage", { count: 1, stunned: false }),
], { cinemaLevel: 6, potentialLevel: 6 }).damage.events[0]
const m6Burst = calculate([
    directEvent("basic", "potential_firepower_burst", "damage", { stunned: false }),
], { cinemaLevel: 6, potentialLevel: 6 }).damage.events[0]
approx(m6Suppression.multipliers.resistance, 1.25, "M6 Fire Suppression fire resistance ignore")
approx(m6Extra.multipliers.resistance, 1.25, "M6 empowered fifth extra inherits fire resistance ignore")
approx(m6Burst.multipliers.resistance, 1, "M6 excludes Firepower Burst")

function expandedConfig(potentialLevel) {
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, 0, potentialLevel)
    return {
        config,
        expanded: expandCalculationConfigSkillGroups(config, agent, { strict: true, potentialLevel }),
    }
}
const p0Config = expandedConfig(0)
assert.equal(p0Config.config.name.zhCN, "P0失衡爆发轴")
assert.deepEqual(p0Config.expanded.events.map(event => event.skillRef.rowId),
    ["damage", "hit_1", "hit_2", "hit_3", "hit_4", "damage", "hit_1", "hit_2", "hit_3", "hit_4"])
const p1Config = expandedConfig(1)
assert.equal(p1Config.config.name.zhCN, "P1及以上失衡爆发轴")
assert.deepEqual(p1Config.expanded.events.map(event => event.skillRef.rowId),
    ["damage", "hit_4", "base_damage", "extra_damage", "damage", "hit_4", "base_damage", "extra_damage"])
assert.ok(p1Config.expanded.events.every(event => event.stunned))
const levelTwelveRawMultiplier = p1Config.expanded.events.reduce((total, event) => {
    const { categoryId, moveId, rowId } = event.skillRef
    return total + skillRow(categoryId, moveId, rowId).values[11] * event.count
}, 0)
approx(levelTwelveRawMultiplier, 10599.2, "P1+ Lv12 default raw multiplier package")
assert.equal(agent.skillGroups.find(group => group.id === "potential_empowered_fifth_package").requiresPotentialLevel, 1)
assert.equal(agent.skillGroups.find(group => group.id === "potential_empowered_fifth_package").maxCount, 1)
assert.throws(
    () => expandCalculationConfigSkillGroups(p1Config.config, agent, { strict: true, potentialLevel: 0 }),
    /需要潜能 P1/,
)

const p6PreparedInput = {
    agentId: "soldier_11",
    coreSkillLevel: "F",
    cinemaLevel: 6,
    potentialLevel: 6,
    wEngineId: zeroEngine.id,
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: activeAgentBuffIds(6),
        runtimeInputs: {},
        manualStats: [],
    },
    damage: p1Config.config,
}
const p6Prepared = createInCombatPanelCalculator(catalog, p6PreparedInput)
const p6PreparedFull = p6Prepared.calculate([], { round: false })
const p6ExpectedDamage = p6PreparedFull.damage.totalFinalDamage
const p6Compiled = p6Prepared.scoreOnlyFromSummary(new Map(), new Map())
const p6LegacyPrepared = p6Prepared.scoreOnlyFromSummaryLegacy(new Map(), new Map())
const p6Indexed = p6Prepared.scoreOnlyFromIndexedSummary([], [], [], [], new Map())
const p6DenseTarget = p6Prepared.compileDensePanelScoreTarget({
    statIds: [],
    setIds: [],
    setIndexById: new Map(),
})
assert.ok(p6DenseTarget, "P6 Soldier 11 should compile a dense score target")
const p6Dense = p6DenseTarget.scoreDense(new Float64Array(), new Int16Array())
const p6Fixed = p6DenseTarget.compileForSetCounts(new Int16Array()).scoreScalar(new Float64Array())
for (const [label, result] of [
    ["compiled", p6Compiled],
    ["prepared legacy", p6LegacyPrepared],
    ["indexed", p6Indexed],
    ["dense", p6Dense],
    ["fixed", p6Fixed],
]) {
    approx(result.finalDamage, p6ExpectedDamage, `${label} P6 default rotation parity`)
}

const optimizerSlotMainStats = {
    1: { stat: "hpFlat", value: 2200, mode: "flat" },
    2: { stat: "atkFlat", value: 316, mode: "flat" },
    3: { stat: "defFlat", value: 184, mode: "flat" },
    4: { stat: "critRate", value: 24, mode: "pct" },
    5: { stat: "fireDmg", value: 30, mode: "pct" },
    6: { stat: "atkPct", value: 30, mode: "pct" },
}
function optimizerDisc(setId, partition, variant) {
    return {
        id: `soldier-11-${setId}-${partition}`,
        ownerId: "default",
        setId,
        setName: loadedCatalog.driveDiscSetsMap.get(setId).name.zhCN,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: {
            ...optimizerSlotMainStats[partition],
            label: optimizerSlotMainStats[partition].stat,
        },
        subStats: [
            { stat: "critRate", value: 2.4 + variant * 0.6, mode: "pct", label: "critRate" },
            { stat: "critDmg", value: 4.8 + partition + variant, mode: "pct", label: "critDmg" },
            { stat: "atkPct", value: 3 + variant, mode: "pct", label: "atkPct" },
        ],
        source: { type: "test", sequence: partition + variant * 10 },
    }
}
const optimizerStore = {
    version: 1,
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [
        ...Array.from({ length: 6 }, (_, index) => optimizerDisc("inferno_metal", index + 1, 0)),
        ...Array.from({ length: 6 }, (_, index) => optimizerDisc("hormone_punk", index + 1, 1)),
    ],
}
function optimizerInput(algorithm, potentialLevel = 6) {
    return {
        ...p6PreparedInput,
        potentialLevel,
        damage: potentialLevel >= 1 ? p1Config.config : p0Config.config,
        settings: {
            fourPieceSetId: "inferno_metal",
            twoPieceSetId: "hormone_punk",
            mainStatLimits: agent.preferredDriveDiscs.mainStatLimits,
            objective: "damage",
            algorithm,
            resultLimit: 10,
            disableParallel: true,
        },
    }
}
const p6Exact = optimizeDriveDiscs(catalog, optimizerStore, optimizerInput("exact-super-bound"))
const p6LegacyExact = optimizeDriveDiscs(catalog, optimizerStore, optimizerInput("exact-legacy"))
const p0Exact = optimizeDriveDiscs(catalog, optimizerStore, optimizerInput("exact-super-bound", 0))
assert.ok(p6Exact.results.length > 0)
assert.deepEqual(
    p6Exact.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    p6LegacyExact.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
assert.deepEqual(
    p6Exact.results.map(result => Number(result.score.toFixed(8))),
    p6LegacyExact.results.map(result => Number(result.score.toFixed(8))),
)
assert.equal(p6Exact.metrics.strictExact, true)
assert.equal(p6Exact.metrics.processedCombinationCount, p6Exact.metrics.estimatedCombinationCount)

const browserWorkerRuntime = createDriveDiscOptimizerRuntime({
    availableParallelism: () => 1,
    yieldControl: async () => {},
})
const p0BrowserWorker = await browserWorkerRuntime.optimizeDriveDiscsAsync(
    catalog,
    optimizerStore,
    optimizerInput("exact-super-bound", 0),
)
const p6BrowserWorker = await browserWorkerRuntime.optimizeDriveDiscsAsync(
    catalog,
    optimizerStore,
    optimizerInput("exact-super-bound", 6),
)
for (const [potentialLevel, browserResult, nodeResult] of [
    [0, p0BrowserWorker, p0Exact],
    [6, p6BrowserWorker, p6Exact],
]) {
    assert.deepEqual(
        browserResult.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
        nodeResult.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
        `browser Worker P${potentialLevel} ranking parity`,
    )
    assert.deepEqual(
        browserResult.results.map(result => Number(result.score.toFixed(8))),
        nodeResult.results.map(result => Number(result.score.toFixed(8))),
        `browser Worker P${potentialLevel} score parity`,
    )
}
assert.notEqual(p0BrowserWorker.results[0].score, p6BrowserWorker.results[0].score)

const brimstone = loadedCatalog.wEnginesMap.get("zzz_wiki_223")
assert.equal(brimstone.relatedAgentId, "soldier_11")
const enkaMapping = JSON.parse(readFileSync(path.join(rootDir, "data", "enka_zzz_mapping.json"), "utf8"))
assert.deepEqual(enkaMapping.agents["1041"], { id: "soldier_11", name: "11号" })
const avatar = readFileSync(path.join(rootDir, "webapp", "public", "assets", "agents", "soldier_11.png"))
assert.deepEqual([...avatar.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
assert.equal(avatar.readUInt32BE(16), 300)
assert.equal(avatar.readUInt32BE(20), 300)

console.log("soldier 11 damage tests passed")
