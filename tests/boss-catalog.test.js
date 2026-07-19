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
assert.equal(source.bosses.length, 3)
assert.equal(meta.bosses.length, 3)
assert.equal(meta.bossCombatBuffs.length, 3)

for (const boss of source.bosses) {
    assert.ok(boss.images.icon.startsWith("/assets/bosses/"))
    assert.match(boss.images.source, /^https:\/\//)
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
