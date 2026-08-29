import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    expandCalculationConfigSkillGroups,
} from "../core/calculationSkillGroups.js"
import {
    corePassiveScalingRow,
} from "../core/corePassiveScaling.js"
import {
    resolveDefaultCalculationConfig,
} from "../core/defaultCalculationConfig.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadedCatalog = await loadCalculatorContext(rootDir)
const agent = loadedCatalog.agentsMap.get("sigrid")
const skillCatalog = loadedCatalog.agentSkillsMap.get("sigrid")

const zeroEngine = {
    id: "sigrid_test_zero_engine",
    name: { zhCN: "希格莉德测试零面板音擎" },
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

function skillRow(categoryId, moveId, rowId) {
    return skillCatalog.categories
        .find(category => category.id === categoryId)?.moves
        .find(move => move.id === moveId)?.rows
        .find(row => row.id === rowId)
}

function directEvent(categoryId, moveId, rowId, overrides = {}) {
    return {
        id: overrides.id ?? `${categoryId}-${moveId}-${rowId}`,
        kind: "direct",
        count: 1,
        stunned: overrides.stunned ?? true,
        critMode: overrides.critMode ?? "expected",
        skillRef: { agentSkillId: "sigrid", categoryId, moveId, rowId },
    }
}

function activeAgentBuffIds(cinemaLevel = 0) {
    return [
        "agent:sigrid.corePassive",
        "agent:sigrid.additionalAbility",
        ...(agent.combatBuffs.skillBuffs ?? [])
            .filter(buff => buff.defaultChecked === true)
            .map(buff => `agent:sigrid.skill.${buff.id}`),
        ...(agent.combatBuffs.cinemaBuffs ?? [])
            .filter(buff => Number(buff.cinemaLevel) <= cinemaLevel)
            .map(buff => `agent:sigrid.cinema.${buff.cinemaLevel}`),
    ]
}

function calculate(events, {
    cinemaLevel = 0,
    coreSkillLevel = "F",
    runtimeInputs = {},
    manualStats = [],
    driveDiscs = [],
    activeBuffIds = activeAgentBuffIds(cinemaLevel),
    extraActiveBuffIds = [],
} = {}) {
    return calculateInCombatPanel(catalog, {
        agentId: "sigrid",
        coreSkillLevel,
        cinemaLevel,
        wEngineId: zeroEngine.id,
        wEngineModificationLevel: 1,
        driveDiscs,
        combatBuffs: {
            activeBuffIds: [...activeBuffIds, ...extraActiveBuffIds],
            runtimeInputs,
            manualStats,
        },
        damage: {
            mode: "custom",
            selectedEventId: events[0]?.id,
            events,
            target: {
                defense: 953,
                stunMultiplierPercent: 150,
                resistanceByElement: { physical: 0, ice: 0 },
            },
        },
    })
}

assert.ok(agent)
assert.ok(skillCatalog)
assert.equal(agent.name.zhCN, "希格莉德·德拉叙尔")
assert.equal(agent.attribute, "ice")
assert.equal(agent.damageElement, "ice")
assert.equal(agent.specialty, "attack")
assert.deepEqual(agent.attackTypes, ["pierce"])
assert.deepEqual(agent.level60, {
    hpBase: 7788,
    atkBase: 863,
    defBase: 606,
    critRate: 5,
    critDmg: 50,
    impact: 93,
    anomalyProficiency: 90,
    anomalyMastery: 92,
    energyRegen: 120,
    penRatio: 0,
})
assert.deepEqual(agent.preferredDriveDiscs.defaultSetIds, ["zzz_wiki_1552"])
assert.deepEqual(agent.preferredDriveDiscs.mainStatLimits, {
    4: ["critDmg", "atkPct"],
    5: ["penRatio", "iceDmg", "atkPct"],
    6: ["atkPct"],
})

assert.deepEqual(
    ["none", "A", "B", "C", "D", "E", "F"]
        .map(level => corePassiveScalingRow(agent, level).skyPatrolStanceCritRatePct),
    [33, 39, 44, 50, 55, 61, 66],
)

const coreF = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
])
approx(coreF.outOfCombat.panel.atk, 938, "F core character ATK before in-combat buffs")
approx(coreF.outOfCombat.panel.critRate, 0.194, "F core out-of-combat Crit Rate")
approx(coreF.inCombat.panel.atk, 1778, "F core plus Additional Ability fixed ATK")
approx(coreF.inCombat.panel.critRate, 0.854, "F core plus Sky Patrol Stance Crit Rate")

const coreNone = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
], { coreSkillLevel: "none" })
approx(coreNone.outOfCombat.panel.atk, 863, "No-core character ATK")
approx(coreNone.outOfCombat.panel.critRate, 0.05, "No-core out-of-combat Crit Rate")
approx(coreNone.inCombat.panel.critRate, 0.38, "Initial Sky Patrol Stance Crit Rate")

const levelTwelveExpected = new Map([
    ["basic/basic_chilling_spearpoint/hit_4", 442.1],
    ["basic/basic_sheathed_spear/stage_1", 716.9],
    ["basic/basic_sheathed_spear/stage_2", 1218.5],
    ["basic/basic_sheathed_spear/stage_3", 1629.7],
    ["dodge/dash_attack_chasing_wind/damage", 238.9],
    ["dodge/dodge_counter_returning_spear/damage", 486.2],
    ["assist/quick_assist_sky_patrol_guard/damage", 80.4],
    ["assist/assist_followup_ice_glutton/damage", 1030.8],
    ["special/special_ice_bloom/damage", 107.6],
    ["special/ex_special_scattered_jade/damage", 877.7],
    ["special/ex_special_shattered_jade/damage", 2096.1],
    ["chain/chain_ice_sweeps_the_earth/damage", 1887.5],
    ["chain/ultimate_frost_sky/damage", 4379.9],
])
for (const [ref, expected] of levelTwelveExpected) {
    const [categoryId, moveId, rowId] = ref.split("/")
    assert.equal(skillRow(categoryId, moveId, rowId)?.values[11], expected, `${ref} Lv12`)
}
assert.deepEqual(skillRow("basic", "basic_sheathed_spear", "stage_1").values.slice(0, 3), [358.3, 390.9, 423.5])
assert.equal(skillRow("basic", "basic_sheathed_spear", "stage_3_daze").values[6], 250.2)
assert.deepEqual(skillRow("special", "ex_special_scattered_jade", "energy_cost").values, Array(16).fill(60))
assert.deepEqual(skillRow("special", "ex_special_shattered_jade", "energy_cost").values, Array(16).fill(50))

for (const category of skillCatalog.categories.filter(item => item.id !== "cinema")) {
    for (const move of category.moves) {
        for (const row of move.rows) {
            assert.equal(row.values.length, 16,
                `${category.id}/${move.id}/${row.id} should contain its complete level range`)
            assert.ok(row.values.every(Number.isFinite), `${category.id}/${move.id}/${row.id} should be numeric`)
        }
        const damagingRows = move.rows.filter(row => row.kind === "damageMultiplier")
        if (damagingRows.length) {
            assert.equal(move.damageElement, move.id === "dash_attack_chasing_wind" ? "physical" : "ice")
        }
    }
}
const ordinary = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
]).damage.events[0]
const imbued = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
], {
    runtimeInputs: {
        "agent:sigrid.additionalAbility": {
            effects: { "sky-alliance-imbued-target-damage": { coverage: 1 } },
        },
    },
}).damage.events[0]
approx(ordinary.multipliers.dmg, 1, "Imbued defaults off")
approx(imbued.multipliers.dmg, 1.15, "Imbued target damage bonus")

const sheathed = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
]).damage.events[0]
const nonSheathed = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1"),
]).damage.events[0]
approx(sheathed.multipliers.dmg, 1.2, "Tempering applies to Sheathed Spear")
approx(nonSheathed.multipliers.dmg, 1, "Tempering excludes ordinary Basic Attack")
approx(sheathed.targetBreakdown.activeStunMultiplier, 1.7, "Sky Patrol Stance stunned-target bonus")
approx(ordinary.targetBreakdown.activeStunMultiplier, 1, "Stunned-target bonus does not affect a non-stunned event")

const temperingBuff = agent.combatBuffs.skillBuffs.find(buff => buff.id === "tempering")
assert.deepEqual(temperingBuff.sourceSkillRef, {
    agentSkillId: "sigrid",
    categoryId: "chain",
    moveId: "chain_ice_sweeps_the_earth",
})
assert.equal(temperingBuff.defaultChecked, true)
assert.equal(temperingBuff.effects[0].id, "tempering-sheathed-spear-damage")
assert.equal(temperingBuff.mechanics.temperingDamageBonusPct, 20)
assert.equal(temperingBuff.mechanics.temperingDurationSeconds, 50)
assert.ok(!agent.combatBuffs.corePassive.effects.some(effect => effect.id === "tempering-sheathed-spear-damage"))
assert.equal(agent.combatBuffs.corePassive.mechanics.temperingDamageBonusPct, undefined)
assert.equal(agent.combatBuffs.corePassive.mechanics.temperingDurationSeconds, undefined)

const coreOnly = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
], { activeBuffIds: ["agent:sigrid.corePassive"] })
approx(coreOnly.inCombat.panel.critRate, 0.854, "Core Passive remains independently active")
approx(coreOnly.damage.events[0].multipliers.dmg, 1, "Core Passive no longer grants Tempering")
approx(coreOnly.damage.events[0].targetBreakdown.activeStunMultiplier, 1.7,
    "Core Passive retains stunned-target multiplier")

const temperingOnly = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
], { activeBuffIds: ["agent:sigrid.skill.tempering"] })
approx(temperingOnly.inCombat.panel.critRate, 0.194, "Tempering does not grant Sky Patrol Crit Rate")
approx(temperingOnly.damage.events[0].multipliers.dmg, 1.2, "Tempering independently grants Sheathed Spear damage")
approx(temperingOnly.damage.events[0].targetBreakdown.activeStunMultiplier, 1.5,
    "Tempering does not grant the Core Passive stunned-target multiplier")

for (const rowId of ["stage_1", "stage_2", "stage_3"]) {
    const result = calculate([directEvent("basic", "basic_sheathed_spear", rowId)], {
        activeBuffIds: ["agent:sigrid.skill.tempering"],
    }).damage.events[0]
    approx(result.multipliers.dmg, 1.2, `Tempering applies to Sheathed Spear ${rowId}`)
}
for (const [categoryId, moveId, rowId] of [
    ["basic", "basic_chilling_spearpoint", "hit_1"],
    ["chain", "chain_ice_sweeps_the_earth", "damage"],
    ["chain", "ultimate_frost_sky", "damage"],
    ["special", "ex_special_shattered_jade", "damage"],
]) {
    const result = calculate([directEvent(categoryId, moveId, rowId)], {
        activeBuffIds: ["agent:sigrid.skill.tempering"],
    }).damage.events[0]
    approx(result.multipliers.dmg, 1, `Tempering excludes ${moveId}`)
}

const cinemaOne = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
], { cinemaLevel: 1 })
approx(cinemaOne.inCombat.panel.atk, 2012.5, "Cinema 1 ATK +25% of base ATK")

const m2Targets = [
    ["basic", "basic_chilling_spearpoint", "hit_4"],
    ["basic", "basic_sheathed_spear", "stage_1"],
    ["basic", "basic_sheathed_spear", "stage_2"],
    ["basic", "basic_sheathed_spear", "stage_3"],
    ["dodge", "dodge_counter_returning_spear", "damage"],
    ["assist", "assist_followup_ice_glutton", "damage"],
    ["special", "ex_special_scattered_jade", "damage"],
    ["special", "ex_special_shattered_jade", "damage"],
    ["chain", "chain_ice_sweeps_the_earth", "damage"],
    ["chain", "ultimate_frost_sky", "damage"],
]
for (const [categoryId, moveId, rowId] of m2Targets) {
    const result = calculate([directEvent(categoryId, moveId, rowId)], { cinemaLevel: 2 }).damage.events[0]
    approx(result.targetBreakdown.panelPenRatio, 0, `${moveId}/${rowId} panel PEN remains separate`)
    approx(result.targetBreakdown.targetedPenRatio, 0.24, `${moveId}/${rowId} Cinema 2 targeted PEN`)
}
const m2Misses = [
    ["basic", "basic_chilling_spearpoint", "hit_1"],
    ["basic", "basic_chilling_spearpoint", "hit_2"],
    ["basic", "basic_chilling_spearpoint", "hit_3"],
    ["dodge", "dash_attack_chasing_wind", "damage"],
    ["assist", "quick_assist_sky_patrol_guard", "damage"],
    ["special", "special_ice_bloom", "damage"],
]
for (const [categoryId, moveId, rowId] of m2Misses) {
    const result = calculate([directEvent(categoryId, moveId, rowId)], { cinemaLevel: 2 }).damage.events[0]
    approx(result.targetBreakdown.targetedPenRatio, 0, `${moveId}/${rowId} should not receive Cinema 2 PEN`)
}

const defenseOrder = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
], {
    cinemaLevel: 2,
    manualStats: [
        { stat: "enemyDefReduction", value: 20, mode: "flat" },
        { stat: "penRatio", value: 8, mode: "flat" },
        { stat: "penFlat", value: 50, mode: "flat" },
    ],
}).damage.events[0].targetBreakdown
approx(defenseOrder.targetDefenseAfterReduction, 762.4, "Defense reduction applies before PEN")
approx(defenseOrder.penRatio, 0.32, "Panel and targeted PEN add")
approx(defenseOrder.effectiveDefense, 468.432, "PEN ratio applies before flat PEN")

const cinemaFour = calculate([
    directEvent("basic", "basic_chilling_spearpoint", "hit_1", { stunned: false }),
], { cinemaLevel: 4 }).damage.events[0]
approx(cinemaFour.multipliers.dmg, 1.18, "Cinema 4 all-damage bonus")

for (const [rowId, expectedBonus] of [["stage_1", 0.8], ["stage_2", 0.9], ["stage_3", 1]]) {
    const result = calculate([
        directEvent("basic", "basic_sheathed_spear", rowId),
    ], { cinemaLevel: 6 }).damage.events[0]
    approx(result.multipliers.skillMultiplierBonus, expectedBonus, `Cinema 6 ${rowId} multiplier addition`)
}
const cinemaSixOther = calculate([
    directEvent("chain", "ultimate_frost_sky", "damage"),
], { cinemaLevel: 6 }).damage.events[0]
approx(cinemaSixOther.multipliers.skillMultiplierBonus, 0, "Cinema 6 multiplier additions exclude other moves")

function configRows(cinemaLevel) {
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, cinemaLevel)
    const expanded = expandCalculationConfigSkillGroups(config, agent, { strict: true })
    return { config, expanded, rows: expanded.events.map(event => event.skillRef?.rowId) }
}
const zeroConfig = configRows(0)
const zeroGroup = agent.skillGroups.find(group => group.id === "formation_break_sequence")
assert.equal(zeroGroup.name.zhCN, "强化普攻总倍率（敛枪1/2/3）")
assert.deepEqual(zeroGroup.events.map(event => event.skillRef), [
    { agentSkillId: "sigrid", categoryId: "basic", moveId: "basic_sheathed_spear", rowId: "stage_1" },
    { agentSkillId: "sigrid", categoryId: "basic", moveId: "basic_sheathed_spear", rowId: "stage_2" },
    { agentSkillId: "sigrid", categoryId: "basic", moveId: "basic_sheathed_spear", rowId: "stage_3" },
])
assert.deepEqual(zeroConfig.config.events.map(event => [
    event.kind === "skillGroup" ? event.skillGroupId : event.skillRef?.moveId,
    event.skillRef?.rowId ?? null,
    event.count,
]), [
    ["formation_break_sequence", null, 2],
    ["chain_ice_sweeps_the_earth", "damage", 2],
    ["ultimate_frost_sky", "damage", 1],
    ["ex_special_shattered_jade", "damage", 2],
    ["basic_sheathed_spear", "stage_3", 1],
])
assert.deepEqual(zeroConfig.rows, ["stage_1", "stage_2", "stage_3", "damage", "damage", "damage", "stage_3"])
assert.deepEqual(zeroConfig.expanded.events.map(event => event.count), [2, 2, 2, 2, 1, 2, 1])
const oneConfig = configRows(1)
assert.deepEqual(oneConfig.rows, ["stage_1", "stage_2", "stage_3", "stage_3", "stage_1", "damage", "damage", "damage"])
assert.deepEqual(oneConfig.expanded.events.map(event => event.count), [2, 2, 2, 1, 1, 1, 2, 2])
const sixConfig = configRows(6)
assert.deepEqual(sixConfig.rows, ["damage", "damage", "damage", "stage_1", "stage_2", "stage_3"])
assert.deepEqual(sixConfig.expanded.events.map(event => event.count), [1, 2, 2, 4, 4, 4])
assert.deepEqual(agent.skillGroups.map(group => [group.defaultCount, group.minCount, group.maxCount, group.step]), [
    [1, 0, 100, 1],
])

function dawnDisc(partition) {
    return {
        id: `sigrid-dawn-${partition}`,
        setId: "zzz_wiki_1552",
        partition,
        mainStat: { stat: partition === 1 ? "hpFlat" : "atkFlat", value: 0, mode: "flat" },
        subStats: [],
    }
}
const dawnSheathed = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
], { driveDiscs: [dawnDisc(1), dawnDisc(2)] }).damage.events[0]
approx(dawnSheathed.multipliers.dmg, 1.35, "Sheathed Spear receives Tempering and Ablooming Dawn two-piece Basic damage")

const dawnFourPieceSheathed = calculate([
    directEvent("basic", "basic_sheathed_spear", "stage_1"),
], {
    driveDiscs: [dawnDisc(1), dawnDisc(2), dawnDisc(3), dawnDisc(4)],
    extraActiveBuffIds: ["driveDisc4pc:zzz_wiki_1552.self"],
}).damage.events[0]
approx(dawnFourPieceSheathed.multipliers.dmg, 1.75,
    "Sheathed Spear receives Tempering plus Ablooming Dawn two-piece and both four-piece bonuses")

console.log("sigrid damage tests passed")
