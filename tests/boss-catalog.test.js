import assert from "node:assert/strict"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { buildMeta, calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { storedEffectRuleText } from "../core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const meta = buildMeta(catalog)
const source = JSON.parse(await readFile(path.join(rootDir, "data", "bosses.json"), "utf8"))

assert.equal(source.version, 2)
assert.equal(source.bosses.length, 10)
assert.equal(meta.bosses.length, 10)
assert.equal(meta.bossCombatBuffs.length, 11)

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
assert.equal(bossEntries.length, 16)
assert.equal(bossEffects.length, 22)
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
const stagnantMarkBuff = source.bosses
    .find(boss => boss.id === "boss.girtablullu_stagnant_aberrant")
    ?.encounters.find(encounter => encounter.id === stagnantId)
    ?.playerBuffs.find(buff => buff.id === "girtablullu_blight_marks")
const stagnantAnomalyRule = stagnantMarkBuff?.effects
    .find(effect => effect.id === "girtablullu_blight_anomaly_damage")
assert.equal(stagnantAnomalyRule?.stat, "anomalyDamageBonus")
assert.equal(
    storedEffectRuleText(stagnantAnomalyRule, {}, {}, meta),
    "属性异常增伤% +16%（2/2 层，覆盖率 1）",
)
assert.equal(stagnantMarkBuff?.effects.some(effect => effect.id === "girtablullu_blight_damage_taken"), false)
assert.equal(stagnantMarkBuff?.description?.zhCN.includes("所有伤害"), false)
const withoutBoss = (() => {
    const input = structuredClone(exampleInput)
    input.combatBuffs = { activeBuffIds: [], runtimeInputs: {} }
    return calculateInCombatPanel(catalog, input)
})()
const stagnant = resultFor(stagnantId)
const stagnantModifiers = stagnant.inCombat.activeEffects.flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(stagnant.inCombat.buffTotals.anomalyProficiencyFlat, 60)
assert.equal(stagnantModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.16)
assert.equal(stagnantModifiers.some(effect => effect.stat === "enemyDamageTakenBonus"), false)
assert.equal(stagnant.inCombat.buffTotals.dmgBonus, withoutBoss.inCombat.buffTotals.dmgBonus)
assert.equal(stagnant.damage.multipliers.dmg, withoutBoss.damage.multipliers.dmg)
assert.equal(Object.hasOwn(stagnant.damage.multipliers, "enemyDamageTaken"), false)
assert.equal(
    stagnant.damage.whiteBoxRows.find(row => row.label === "增伤乘区")?.value,
    stagnant.damage.multipliers.dmg,
)
assert.equal(stagnant.damage.whiteBoxRows.some(row => row.label === "敌方承伤乘区"), false)
assert.equal(stagnant.damage.finalDamage, withoutBoss.damage.finalDamage)

const stagnantPhase2Id = "boss_encounter.girtablullu_stagnant_aberrant.v3_1.p2"
const stagnantPhase2 = resultFor(stagnantPhase2Id)
const stagnantPhase2Modifiers = stagnantPhase2.inCombat.activeEffects
    .flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.equal(stagnantPhase2.inCombat.buffTotals.anomalyProficiencyFlat, 60)
assert.equal(stagnantPhase2Modifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.36)
assert.equal(source.bosses.find(boss => boss.id === "boss.girtablullu_stagnant_aberrant")?.encounters.length, 2)

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
assert.equal(stagnantOneStackModifiers.some(effect => effect.stat === "enemyDamageTakenBonus"), false)
assert.equal(stagnantOneStack.inCombat.buffTotals.dmgBonus, withoutBoss.inCombat.buffTotals.dmgBonus)
assert.equal(stagnantOneStack.damage.multipliers.dmg, withoutBoss.damage.multipliers.dmg)
assert.equal(Object.hasOwn(stagnantOneStack.damage.multipliers, "enemyDamageTaken"), false)

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
assert.equal(configuredStagnantModifiers.some(effect => effect.stat === "enemyDamageTakenBonus"), false)
assert.equal(configuredStagnant.inCombat.buffTotals.anomalyProficiencyFlat, 60)
assert.equal(configuredStagnant.inCombat.buffTotals.dmgBonus, withoutBoss.inCombat.buffTotals.dmgBonus)
assert.equal(configuredStagnant.damage.multipliers.dmg, withoutBoss.damage.multipliers.dmg)
assert.equal(Object.hasOwn(configuredStagnant.damage.multipliers, "enemyDamageTaken"), false)

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

const dreamBound = resultFor("boss_encounter.dream_bound_ye_shiyuan.v3_1.p2")
assert.equal(dreamBound.inCombat.buffTotals.critDmg, 0.5)
assert.equal(dreamBound.damage.targetBreakdown.enemyDefReduction, 0.24)

const miasmaPriest = resultFor("boss_encounter.miasma_priest.v3_1.p2")
assert.equal(miasmaPriest.inCombat.buffTotals.critDmg, 0.6)

const bloodHunter = resultFor("boss_encounter.replica_blood_hunter_janitor.v3_1.p2")
const bloodHunterModifiers = bloodHunter.inCombat.activeEffects.flatMap(effect => effect.resolvedDamageModifiers ?? [])
assert.ok(
    Math.abs(
        bloodHunter.inCombat.panel.atk - bloodHunter.outOfCombat.panel.atk
        - bloodHunter.outOfCombat.panel.atk * 0.2,
    ) < 1e-6,
)
assert.equal(bloodHunter.inCombat.panel.penRatio - bloodHunter.outOfCombat.panel.penRatio, 0.25)
assert.equal(bloodHunter.inCombat.buffTotals.anomalyProficiencyFlat, 40)
assert.equal(bloodHunterModifiers.find(effect => effect.stat === "anomalyDamageBonus")?.value, 0.3)
assert.equal(bloodHunterModifiers.find(effect => effect.stat === "iceCritDmg")?.value, 0.6)
assert.equal(bloodHunterModifiers.find(effect => effect.stat === "etherCritDmg")?.value, 0.6)

const phaseOneBosses = source.bosses.filter(boss => boss.encounters.some(encounter =>
    encounter.appearances.some(appearance => appearance.gameVersion === "3.1" && appearance.phaseNo === 1)))
assert.ok(phaseOneBosses.every(boss => boss.target.defense === 953))
assert.deepEqual(source.bosses.find(boss => boss.id === "boss.girtablullu_stagnant_aberrant")?.target.weaknessElements, [])
assert.deepEqual(source.bosses.find(boss => boss.id === "boss.unknown_corruption_complex")?.target.weaknessElements, ["electric", "ether"])
assert.deepEqual(source.bosses.find(boss => boss.id === "boss.integrated_girtablullu")?.target.weaknessElements, [])

const phaseTwoBossIds = source.bosses
    .filter(boss => boss.encounters.some(encounter => encounter.appearances.some(appearance =>
        appearance.gameVersion === "3.1" && appearance.phaseNo === 2)))
    .map(boss => boss.id)
assert.deepEqual(phaseTwoBossIds, [
    "boss.girtablullu_stagnant_aberrant",
    "boss.dream_bound_ye_shiyuan",
    "boss.miasma_priest",
    "boss.replica_blood_hunter_janitor",
])
const phaseTwoText = JSON.stringify(source.bosses.filter(boss => phaseTwoBossIds.includes(boss.id)))
assert.equal(phaseTwoText.includes("操作分"), false)
assert.equal(phaseTwoText.includes("异常积蓄"), false)

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
