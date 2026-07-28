import assert from "node:assert/strict"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { buildMeta, calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const meta = buildMeta(catalog)
const source = JSON.parse(await readFile(path.join(rootDir, "data", "bosses.json"), "utf8"))

assert.equal(source.version, 2)
assert.equal(source.bosses.length, 7)
assert.equal(meta.bosses.length, 7)
assert.equal(meta.bossCombatBuffs.length, 7)

for (const boss of source.bosses) {
    assert.ok(boss.images.icon.startsWith("/assets/bosses/"))
    assert.match(boss.images.source, /^https:\/\//)
    const image = await readFile(path.join(rootDir, "webapp", "public", ...boss.images.icon.split("/").filter(Boolean)))
    assert.ok(image.length > 0, `${boss.id} should have a non-empty local image`)
    for (const encounter of boss.encounters) {
        assert.deepEqual(Object.keys(encounter), [
            "id",
            "appearances",
            "enemyIntel",
            "recommendedSpecialties",
            "playerBuffs",
            "playerDebuffs",
            "sources",
            "hidden",
        ])
        const validation = validateMaintenanceItem("boss-buffs", { boss, encounter }, {
            bosses: source.bosses,
            currentBossId: boss.id,
            currentEncounterId: encounter.id,
        })
        assert.deepEqual(validation.errors, [], `${boss.id} should satisfy the Boss maintenance contract`)
    }
}

const bossEntries = source.bosses.flatMap(boss =>
    boss.encounters.flatMap(encounter => [
        ...(encounter.playerBuffs ?? []),
        ...(encounter.playerDebuffs ?? []),
    ]))
const bossEffects = bossEntries.flatMap(entry => entry.effects ?? [])
assert.equal(bossEntries.length, 9)
assert.equal(bossEffects.length, 11)
for (const effect of bossEffects) {
    assert.deepEqual(
        effect.coverage,
        { default: 1, min: 0, max: 1, step: 0.1 },
        `${effect.id} should expose standard independent coverage`,
    )
}

const exampleInput = catalog.examples.yeShunguang.input
function resultFor(encounterId, runtimeInputs = {}) {
    const input = structuredClone(exampleInput)
    input.combatBuffs = { activeBuffIds: [encounterId], runtimeInputs }
    return calculateInCombatPanel(catalog, input)
}

const scorchedId = "boss_encounter.scorched_horizon_phaethon.v3_0.p3"
const scorched = resultFor(scorchedId, {
    [scorchedId]: { effects: { scorched_departing_flame_crit_dmg: { stacks: 5 } } },
})
assert.equal(scorched.inCombat.buffTotals.critDmg, -1.25)

const pompey = resultFor("boss_encounter.notorious_pompey.v3_0.p3")
assert.equal(pompey.inCombat.buffTotals.critDmg, 0.6)

const miasma = resultFor("boss_encounter.miasma_fiend_named.v3_0.p3")
const miasmaModifier = miasma.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
    .find(effect => effect.stat === "anomalyDamageBonus")
assert.equal(miasmaModifier?.value, 0.48)

const stagnantId = "boss_encounter.girtablullu_stagnant_aberrant.v3_1.p1"
const withoutBoss = (() => {
    const input = structuredClone(exampleInput)
    input.combatBuffs = { activeBuffIds: [], runtimeInputs: {} }
    return calculateInCombatPanel(catalog, input)
})()
const stagnant = resultFor(stagnantId)
const stagnantModifiers = stagnant.inCombat.activeEffects.flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(stagnant.inCombat.buffTotals.anomalyProficiencyFlat, 60)
assert.equal(stagnantModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.16)
assert.equal(stagnantModifiers.find(effect => effect.stat === "enemyDamageTakenBonus")?.value, 0.16)
assert.equal(stagnant.damage.multipliers.enemyDamageTaken, 1.16)
assert.equal(stagnant.damage.whiteBoxRows.find(row => row.label === "敌方承伤乘区")?.value, 1.16)
assert.ok(
    Math.abs(stagnant.damage.finalDamage / withoutBoss.damage.finalDamage - 1.16) < 1e-9,
    "Stagnant Aberrant marks should apply an independent 16% damage-taken multiplier to direct damage",
)

const stagnantOneStack = resultFor(stagnantId, {
    [stagnantId]: {
        effects: {
            girtablullu_blight_anomaly_damage: { stacks: 1 },
            girtablullu_blight_damage_taken: { stacks: 1 },
        },
    },
})
const stagnantOneStackModifiers = stagnantOneStack.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(stagnantOneStackModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.08)
assert.equal(stagnantOneStackModifiers.find(effect => effect.stat === "enemyDamageTakenBonus")?.value, 0.08)

const configuredStagnant = resultFor(stagnantId, {
    [stagnantId]: {
        effects: {
            girtablullu_blight_anomaly_damage: { enabled: false, coverage: 0.25, stacks: 2 },
            girtablullu_blight_damage_taken: { coverage: 0.5, stacks: 2 },
        },
    },
})
const configuredStagnantModifiers = configuredStagnant.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(configuredStagnantModifiers.some(effect => effect.stat === "anomalyDamageBonus"), false)
assert.equal(configuredStagnantModifiers.find(effect => effect.stat === "enemyDamageTakenBonus")?.value, 0.08)
assert.equal(configuredStagnant.inCombat.buffTotals.anomalyProficiencyFlat, 60)
assert.equal(configuredStagnant.damage.multipliers.enemyDamageTaken, 1.08)

const deadEndId = "boss_encounter.notorious_dead_end_butcher.v3_1.p1"
const deadEndBoss = source.bosses.find(boss => boss.id === "boss.notorious_dead_end_butcher")
const deadEnd = resultFor(deadEndId)
const deadEndModifiers = deadEnd.inCombat.activeEffects.flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(deadEndModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.5)
assert.equal(deadEndModifiers.some(effect => effect.stat === "enemyDamageTakenBonus"), false)
assert.equal(JSON.stringify(deadEndBoss).includes("以太强化"), false)
assert.deepEqual(deadEndBoss.target.weaknessElements, ["ice", "ether"])

const unknown = resultFor("boss_encounter.unknown_corruption_complex.v3_1.p1")
assert.equal(unknown.inCombat.buffTotals.critDmg, 1)

const integrated = resultFor("boss_encounter.integrated_girtablullu.v3_1.p1")
const integratedModifiers = integrated.inCombat.activeEffects.flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(integrated.inCombat.buffTotals.dmgBonus, 0.15)
assert.equal(integrated.inCombat.buffTotals.anomalyProficiencyFlat, 20)
assert.equal(integratedModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.4)

const currentBosses = source.bosses.slice(-4)
assert.ok(currentBosses.every(boss => boss.target.defense === 953))
assert.deepEqual(currentBosses[0].target.weaknessElements, [])
assert.deepEqual(currentBosses[2].target.weaknessElements, ["electric", "ether"])
assert.deepEqual(currentBosses[3].target.weaknessElements, [])

for (const buff of meta.bossCombatBuffs) {
    assert.equal("mechanics" in buff, false)
    assert.equal("scoreRules" in buff, false)
    const modeledEffectIds = new Set((buff.effects ?? []).map(effect => effect.id))
    const descriptiveEntries = [...(buff.playerBuffs ?? []), ...(buff.playerDebuffs ?? [])]
        .filter(entry => entry.calculationStatus === "descriptiveOnly")
    assert.ok(descriptiveEntries.every(entry => (entry.effects ?? []).length === 0))
    assert.ok(descriptiveEntries.every(entry => !modeledEffectIds.has(entry.id)))
}

const overlapBoss = structuredClone(source.bosses[0])
overlapBoss.target.resistanceElements.push(overlapBoss.target.weaknessElements[0])
assert.equal(validateMaintenanceItem("boss-buffs", { boss: overlapBoss, encounter: overlapBoss.encounters[0] }, {
    bosses: source.bosses,
    currentBossId: overlapBoss.id,
    currentEncounterId: overlapBoss.encounters[0].id,
}).ok, false)

const descriptiveWithRule = structuredClone(source.bosses[1])
const entry = descriptiveWithRule.encounters[0].playerBuffs[0]
entry.calculationStatus = "descriptiveOnly"
entry.unmodeledReason = { zhCN: "测试" }
assert.equal(validateMaintenanceItem("boss-buffs", { boss: descriptiveWithRule, encounter: descriptiveWithRule.encounters[0] }, {
    bosses: source.bosses,
    currentBossId: descriptiveWithRule.id,
    currentEncounterId: descriptiveWithRule.encounters[0].id,
}).ok, false)

const duplicateAppearance = structuredClone(source.bosses[2])
duplicateAppearance.encounters[0].appearances.push(structuredClone(duplicateAppearance.encounters[0].appearances[0]))
assert.equal(validateMaintenanceItem("boss-buffs", { boss: duplicateAppearance, encounter: duplicateAppearance.encounters[0] }, {
    bosses: source.bosses,
    currentBossId: duplicateAppearance.id,
    currentEncounterId: duplicateAppearance.encounters[0].id,
}).ok, false)

console.log("boss catalog tests passed")
