import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { skillTargetMatches } from "../core/skillTargets.js"
import { cleanMaintenanceItem } from "../backend/server.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { characterStore, characterInput } from "./fixtures/pr81-characters.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("evelyn_chevalier")
assert.ok(agent, "Evelyn should be present in the catalog")

const ultimateMoves = ["ultimate_nocturne", "ultimate_shadow"]
const additionalAbilityId = "agent:evelyn_chevalier.additionalAbility"
const corePassiveId = "agent:evelyn_chevalier.corePassive"
const skills = catalog.agentSkillsMap.get(agent.id)

function damageInput(moveId, rowId = "damage", extraCritRate = 0) {
    return {
        agentId: agent.id,
        coreSkillLevel: "F",
        cinemaLevel: 0,
        wEngineId: "zzz_wiki_1159",
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: [corePassiveId, additionalAbilityId],
            manualStats: extraCritRate
                ? [{ stat: "critRate", value: extraCritRate, mode: "flat" }]
                : [],
        },
        damage: {
            mode: "custom",
            agentLevel: 60,
            selectedEventId: "evelyn-test",
            events: [{
                id: "evelyn-test",
                kind: "direct",
                count: 1,
                stunned: true,
                critMode: "expected",
                skillRef: {
                    agentSkillId: agent.id,
                    categoryId: skills.categories.find(category => category.moves.some(move => move.id === moveId)).id,
                    moveId,
                    rowId,
                },
            }],
            target: {
                defense: 953,
                resistanceByElement: { fire: 0 },
                stunned: true,
                stunMultiplierPercent: 150,
            },
        },
    }
}

function calculate(moveId, rowId = "damage", extraCritRate = 0) {
    return calculateInCombatPanel(catalog, damageInput(moveId, rowId, extraCritRate))
}

function scaleBonus(result) {
    return Number(result.damage.events[0]?.multipliers?.skillMultiplierScaleBonus ?? 0)
}

const thresholdRule = agent.combatBuffs.additionalAbility.effects.find(effect => effect.id === "evelyn-crit-threshold-multiplier")
assert.ok(thresholdRule, "Evelyn threshold rule should exist")
assert.equal(thresholdRule.coverage, undefined, "The deterministic threshold must not expose coverage")
const damageRule = agent.combatBuffs.additionalAbility.effects.find(effect => effect.id === "evelyn-ultimate-damage")
assert.deepEqual(
    damageRule?.target?.skillTargets,
    [{ kind: "skillType", skillType: "chain" }, { kind: "skillType", skillType: "ultimate" }],
    "Evelyn's 30% damage rule should target Chain and Ultimate skills",
)
assert.equal(agent.defaultCalculationConfig.events[0].skillRef.moveId, "ultimate_nocturne",
    "Evelyn's default calculation should remain the first Ultimate")

const chainMove = catalog.agentSkillsMap.get(agent.id).categories
    .find(category => category.id === "chain")
    ?.moves.find(move => move.id === "chain_moonlight_bond")
assert.ok(chainMove, "Evelyn's Chain move should exist")
assert.equal(chainMove.skillType, "chain")
assert.equal(chainMove.damageElement, "fire")
assert.equal(chainMove.rows.find(row => row.id === "damage")?.values[11], 1658.7)
assert.equal(chainMove.rows.find(row => row.id === "daze")?.values[11], 355.4)

const thresholdTargets = thresholdRule.target.skillTargets
assert.equal(thresholdTargets.length, 3, "The 125% rule should name exactly three moves")
assert.equal(skillTargetMatches(thresholdTargets[0], {
    agentSkillId: agent.id,
    categoryId: "chain",
    moveId: "chain_moonlight_bond",
    rowId: "damage",
    skillType: "chain",
}), true)
assert.equal(skillTargetMatches(thresholdTargets[0], {
    agentSkillId: agent.id,
    categoryId: "chain",
    moveId: "another_chain_move",
    rowId: "damage",
    skillType: "chain",
}), false)

const below = calculate("ultimate_nocturne", "damage", 11.59)
const at = calculate("ultimate_nocturne", "damage", 11.6)
const above = calculate("ultimate_nocturne", "damage", 11.61)
assert.equal(Number((below.inCombat.panel.critRate * 100).toFixed(2)), 79.99)
assert.equal(Number((at.inCombat.panel.critRate * 100).toFixed(2)), 80)
assert.equal(Number((above.inCombat.panel.critRate * 100).toFixed(2)), 80.01)
assert.equal(scaleBonus(below), 0, "79.99% must not activate the multiplier")
assert.equal(scaleBonus(at), 0.25, "80% must activate the multiplier")
assert.equal(scaleBonus(above), 0.25, "80.01% must activate the multiplier")

const chainBelow = calculate("chain_moonlight_bond", "damage")
const chainAt = calculate("chain_moonlight_bond", "damage", 11.6)
assert.equal(Number(chainBelow.damage.events[0]?.multipliers?.directDamageBonus ?? 0), 0.3,
    "Chain should receive Evelyn's 30% damage bonus")
assert.equal(scaleBonus(chainBelow), 0, "Chain should remain below the 125% threshold without 80% CRIT")
assert.equal(scaleBonus(chainAt), 0.25, "Chain should receive the exact 125% multiplier target")

for (const moveId of ultimateMoves) {
    const result = calculate(moveId, "damage", 11.6)
    assert.equal(scaleBonus(result), 0.25, `${moveId} should receive the 25% scale bonus`)
}

const exSpecial = calculate("ex_final", "hit_1", 11.6)
assert.equal(scaleBonus(exSpecial), 0, "EX Special must not receive the Ultimate scale bonus")
assert.equal(Number(exSpecial.damage.events[0]?.multipliers?.directDamageBonus ?? 0), 0,
    "EX Special must not receive Evelyn's Ultimate-only 30% bonus")

const highThreshold = calculate("ultimate_nocturne", "damage", 11.6)
assert.match(
    highThreshold.damage.events[0].whiteBoxRows.find(row => row.label === "技能倍率")?.formula ?? "",
    /倍率乘算 25%/u,
)

const calculator = createInCombatPanelCalculator(catalog, damageInput("ultimate_nocturne", "damage"))
const baseline = calculate("ultimate_nocturne")
const compiled = calculator.scoreOnlyFromSummary(new Map([["critRate", 11.6]]), new Map())
assert.ok(Math.abs(compiled.finalDamage - highThreshold.damage.totalFinalDamage) < 1e-8,
    "Compiled scoring should use the same threshold result as ordinary calculation")
assert.ok(compiled.finalDamage > baseline.damage.totalFinalDamage,
    "The compiled threshold result should exceed the below-threshold baseline")

const chainCalculator = createInCombatPanelCalculator(catalog, damageInput("chain_moonlight_bond", "damage"))
const chainCompiled = chainCalculator.scoreOnlyFromSummary(new Map([["critRate", 11.6]]), new Map())
assert.ok(Math.abs(chainCompiled.finalDamage - chainAt.damage.totalFinalDamage) < 1e-8,
    "Compiled scoring should preserve Chain targets and the 125% threshold")

const approx = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-11), `${label}: ${actual} != ${expected}`)
const finalLv12 = {
    basic_cut: [102.9, 124.8, 157.4, 373.7, 447.8, 38.8, 81.3, 94, 230, 253],
    basic_strangle_i: [453, 182.7], basic_strangle_ii: [490.5, 187.5],
    dash_attack: [121, 45.7], dodge_counter: [421.4, 281.7],
    quick_assist: [155.2, 116.7], defensive_assist: [407.7, 514.4, 250.4],
    assist_followup: [584.2, 374.4], special_bind: [105.1, 78.7], special_burst: [81.1, 68.1, 61.3, 51.6],
}
const moves = skills.categories.flatMap(category => category.moves)
assert.equal(moves.length, 14)
assert.equal(agent.skillGroups?.length ?? 0, 0)
const cleanedSkills = cleanMaintenanceItem("agent-skills", structuredClone(skills), catalog)
assert.deepEqual(validateMaintenanceItem("agent-skills", cleanedSkills, catalog), { ok: true, errors: [] })
assert.deepEqual(cleanedSkills.categories, skills.categories)
for (const [moveId, expected] of Object.entries(finalLv12)) {
    const move = moves.find(move => move.id === moveId)
    assert.deepEqual(move.rows.map(row => row.values[11]), expected, moveId)
    assert.ok(move.rows.every(row => row.values.length === 16 && row.values.every(Number.isFinite)))
    for (const row of move.rows.filter(row => row.kind === "damageMultiplier")) for (const level of [1, 12, 16]) {
        const request = damageInput(moveId, row.id, 11.6)
        request.damage.skillLevelsByCategory = Object.fromEntries(skills.categories.map(category => [category.id, level]))
        const result = calculateInCombatPanel(catalog, request)
        const m = result.damage.events[0].multipliers
        assert.equal(scaleBonus(result), 0, `${moveId} excludes named Chain/Ultimate threshold`)
        approx(m.directDamageBonus, 0, `${moveId} excludes Chain/Ultimate damage bonus`)
        approx(m.skill, row.values[level - 1] / 100, `${moveId} level ${level}`)
        // No W-Engine passive selected: ATK 1642, CRIT 80%, CD 50%,
        // zero element resistance, 953 DEF, level coefficient 794, 150% stun.
        approx(result.damage.totalFinalDamage, 1642 * row.values[level - 1] / 100 * 1.4 * 794 / 1747 * 1.5, `${moveId} independent formula`)
        const boosted = structuredClone(request)
        boosted.combatBuffs.manualStats.push({ stat: "fireDmg", value: 50 })
        approx(calculateInCombatPanel(catalog, boosted).damage.totalFinalDamage / result.damage.totalFinalDamage,
            moveId === "dash_attack" ? 1 : 1.5, `${moveId} fire targeting`)
        const calculator = createInCombatPanelCalculator(catalog, request)
        const dense = calculator.compileDensePanelScoreTarget({ statIds: [], setIds: [], setIndexById: new Map() })
        for (const score of [calculator.scoreOnlyFromSummary(new Map(), new Map()),
            dense.scoreDense([], []), dense.compileForSetCounts([]).scoreScalar([])]) {
            approx(score.finalDamage, result.damage.totalFinalDamage, `${moveId} scoring parity`)
        }
    }
}
for (const moveId of ["basic_cut", "special_burst", "ex_final"]) {
    const move = moves.find(move => move.id === moveId)
    const sum = move.rows.filter(row => row.kind === "damageMultiplier")
        .reduce((value, row) => value + calculate(moveId, row.id, 11.6).damage.totalFinalDamage, 0)
    approx(calculate(moveId, "__generated_hit_total", 11.6).damage.totalFinalDamage, sum, `${moveId} generated total`)
}
assert.ok(moves.find(move => move.id === "defensive_assist").rows.every(row => row.kind === "dazeMultiplier"))
const request = characterInput(catalog, agent.id, 0)
request.damage.events = [["basic_cut", "__generated_hit_total"], ["dash_attack", "damage"], ["special_burst", "hit_1"]]
    .map(([moveId, rowId]) => ({ ...damageInput(moveId, rowId).damage.events[0], id: moveId }))
request.damage.selectedEventId = "basic_cut"
const store = characterStore(), oracle = []
function enumerate(discs) {
    if (discs.length === 6) {
        oracle.push({ ids: discs.map(disc => disc.id), score: calculateInCombatPanel(catalog, { ...request, driveDiscs: discs }).damage.totalFinalDamage })
        return
    }
    for (const disc of store.driveDiscs.filter(disc => disc.partition === discs.length + 1)) enumerate([...discs, disc])
}
enumerate([])
oracle.sort((a, b) => b.score - a.score || a.ids.join("|").localeCompare(b.ids.join("|")))
for (const result of [optimizeDriveDiscs(catalog, store, request),
    await optimizeDriveDiscsAsync(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } })]) {
    assert.equal(result.results.length, 10)
    result.results.forEach((row, i) => {
        assert.deepEqual(Object.values(row.driveDiscIdsBySlot), oracle[i].ids)
        approx(row.score, oracle[i].score, "expanded skills exhaustive Top 10")
    })
}
console.log("Evelyn damage tests passed: full skill tables, final values, elements, exclusions, totals, maintenance and scoring")
