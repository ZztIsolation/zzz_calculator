import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { skillTargetMatches } from "../core/skillTargets.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("evelyn_chevalier")
assert.ok(agent, "Evelyn should be present in the catalog")

const ultimateMoves = ["ultimate_nocturne", "ultimate_shadow"]
const additionalAbilityId = "agent:evelyn_chevalier.additionalAbility"
const corePassiveId = "agent:evelyn_chevalier.corePassive"

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
                    categoryId: moveId === "ex_final" ? "special" : "chain",
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

console.log("Evelyn damage tests passed")
