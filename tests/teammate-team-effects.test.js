import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { defaultRuntimeForBuff, normalizeRuntimeForBuff } from "../core/shared-combat.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"

// Team-wide effects of Fioni, Vivian and Claret exposed as teammate entries.
// Expected values are derived independently from the source text, not from the model code.

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))

const FIONI = { core: "fioni.core.sear", additional: "fioni.additional.sear_crit_dmg", c1: "fioni.cinema_1.sear_crit_dmg" }
const VIVIAN = { additional: "vivian.additional.corruption_damage", c1: "vivian.cinema_1.prophecy_vulnerability" }
const CLARET = { additional: "claret.additional.remnant_edge" }

function approx(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`)
}

// Catalog shape: every entry mirrors the agent identity and validates as a teammate Buff.
for (const [agentId, ids] of [["fioni", Object.values(FIONI)], ["vivian", Object.values(VIVIAN)], ["claret", Object.values(CLARET)]]) {
    const agent = catalog.agentsMap.get(agentId)
    const group = catalog.teammateCombatBuffGroups.find(item => item.id === agentId)
    assert.ok(group, `${agentId} must have a teammate entry`)
    assert.equal(group.attribute, agent.attribute)
    assert.equal(group.specialty, agent.specialty)
    assert.equal(group.images.icon, agent.images.portrait ?? agent.images.icon)
    assert.deepEqual(group.buffs.map(buff => buff.id), ids)
    for (const buff of group.buffs) {
        assert.deepEqual(validateMaintenanceItem("teammate-buffs", { teammate: group, buff }, {
            ...catalog, teammates: catalog.teammateCombatBuffGroups, currentBuffId: buff.id,
        }), { ok: true, errors: [] }, buff.id)
        assert.ok(buff.effects.every(effect => effect.coverage?.default === 1), `${buff.id} defaults to full coverage`)
    }
}
// Cinema gating reads the level from the Buff source text and ID.
for (const id of [FIONI.c1, VIVIAN.c1]) {
    const buff = catalog.combatBuffsMap.get(id)
    assert.match(buff.source.zhCN, /^影画一：/)
    assert.match(id, /\.cinema_1\./)
}

function input(agentId, events, activeBuffIds = [], runtimeInputs = {}) {
    const agent = catalog.agentsMap.get(agentId)
    return {
        agentId, coreSkillLevel: "F", cinemaLevel: 0,
        wEngineId: catalog.wEngines.find(item => item.specialty === agent.specialty).id,
        driveDiscs: [], combatBuffs: { activeBuffIds, runtimeInputs },
        damage: {
            mode: "custom", agentLevel: 60, events, selectedEventId: events[0].id,
            target: { defense: 953, levelCoefficient: 794, stunMultiplierPercent: 150 },
        },
    }
}
const total = result => result.damage.totalFinalDamage
const run = (agentId, events, ids, runtime) => calculateInCombatPanel(catalog, input(agentId, events, ids, runtime))
const anomalyEvent = (rest = {}) => ({
    id: "anomaly", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", anomalyVariant: "normal",
    procCount: 1, count: 1, stunned: true, critMode: "expected", damageElement: "physical", ...rest,
})

// ---- Fioni: Sear anomaly CRIT. Main agent Alice has no anomaly CRIT of her own (baseline multiplier 1).
const fioniCore = catalog.combatBuffsMap.get(FIONI.core)
const fioniRuntime = mastery => ({
    [FIONI.core]: normalizeRuntimeForBuff(fioniCore, {
        effects: { fioni_core_sear_crit_rate: { sourceValue: mastery, coverage: 1 }, fioni_core_sear_crit_dmg: { coverage: 1 } },
    }),
})
assert.equal(defaultRuntimeForBuff(fioniCore).effects.fioni_core_sear_crit_rate.sourceValue, 255, "default mastery reaches the CRIT Rate cap")

const alice = [anomalyEvent()]
const baseline = run("alice_thymefield", alice, [])
assert.equal(baseline.damage.multipliers.anomalyCrit, 1)
const critRate = mastery => Math.min(1, 0.30 + Math.max(mastery - 155, 0) * 0.007)
for (const mastery of [0, 100, 155, 156, 205, 254, 255, 400]) {
    const result = run("alice_thymefield", alice, [FIONI.core], fioniRuntime(mastery))
    // CRIT DMG 25% (Core F); expected multiplier is 1 + rate * dmg.
    approx(total(result) / total(baseline), 1 + critRate(mastery) * 0.25, `Fioni core, mastery ${mastery}`)
}
// Missing runtime input falls back to the default 255 (CRIT Rate 100%).
approx(total(run("alice_thymefield", alice, [FIONI.core])) / total(baseline), 1.25, "Fioni core default runtime")

const at255 = fioniRuntime(255)
approx(total(run("alice_thymefield", alice, [FIONI.core, FIONI.additional], at255)) / total(baseline), 1 + 1 * (0.25 + 0.15), "Core + additional CRIT DMG")
approx(total(run("alice_thymefield", alice, [FIONI.core, FIONI.additional, FIONI.c1], at255)) / total(baseline), 1 + 1 * (0.25 + 0.15 + 0.25), "Core + additional + Cinema 1")
// CRIT DMG buffs alone do nothing without a CRIT Rate source.
approx(total(run("alice_thymefield", alice, [FIONI.additional, FIONI.c1])) / total(baseline), 1, "CRIT DMG without rate")
// Coverage scales the CRIT Rate effect.
const halfCoverage = { [FIONI.core]: normalizeRuntimeForBuff(fioniCore, { effects: { fioni_core_sear_crit_rate: { sourceValue: 255, coverage: 0.5 }, fioni_core_sear_crit_dmg: { coverage: 1 } } }) }
const halfRate = total(run("alice_thymefield", alice, [FIONI.core], halfCoverage)) / total(baseline)
assert.ok(halfRate > 1 && halfRate < 1.25, "Partial coverage lies between none and full")
// Turbulence is part of the anomaly CRIT target and uses the same anomaly CRIT zones.
const turbulence = [anomalyEvent({ id: "turbulence", settlementType: "turbulence", anomalyEffect: "assault", elapsedSeconds: 0 })]
const turbulenceBaseline = run("alice_thymefield", turbulence, [])
approx(total(run("alice_thymefield", turbulence, [FIONI.core], at255)) / total(turbulenceBaseline), 1.25, "Fioni core on Turbulence")
// Disorder is excluded from the anomaly CRIT target.
const disorder = [anomalyEvent({ id: "disorder", settlementType: "disorder", anomalyEffect: "flinch", disorderType: "normal", elapsedSeconds: 4 })]
const disorderBaseline = run("alice_thymefield", disorder, [])
approx(total(run("alice_thymefield", disorder, [FIONI.core, FIONI.additional, FIONI.c1], at255)) / total(disorderBaseline), 1, "Fioni CRIT must not touch Disorder")

// ---- Vivian: Corruption damage (Ether). Main agent Aria uses Ether Corruption.
const corruption = [anomalyEvent({ id: "corruption", anomalyEffect: "corruption", damageElement: "ether" })]
const corruptionDisorder = [anomalyEvent({ id: "corruption-disorder", anomalyEffect: "corruption", damageElement: "ether", settlementType: "disorder", disorderType: "normal", elapsedSeconds: 4 })]
const burn = [anomalyEvent({ id: "burn", anomalyEffect: "burn", damageElement: "fire" })]
const ariaBase = run("aria", corruption, [])
const ariaDisorderBase = run("aria", corruptionDisorder, [])
const ariaBurnBase = run("aria", burn, [])
const anomalyZone = result => result.damage.multipliers.anomalyDamage
const disorderZone = result => result.damage.multipliers.disorderDamage
const additional = run("aria", corruption, [VIVIAN.additional])
approx(anomalyZone(additional), anomalyZone(ariaBase) + 0.12, "Vivian additional Corruption zone")
approx(total(additional) / total(ariaBase), (anomalyZone(ariaBase) + 0.12) / anomalyZone(ariaBase), "Vivian additional Corruption total")
const additionalDisorder = run("aria", corruptionDisorder, [VIVIAN.additional])
approx(disorderZone(additionalDisorder), disorderZone(ariaDisorderBase) + 0.12, "Vivian additional Corruption Disorder zone")
approx(total(run("aria", burn, [VIVIAN.additional])) / total(ariaBurnBase), 1, "Vivian additional ignores other anomalies")
const c1 = run("aria", corruption, [VIVIAN.c1])
approx(anomalyZone(c1), anomalyZone(ariaBase) + 0.16, "Vivian Cinema 1 attribute anomaly zone")
approx(total(c1) / total(ariaBase), (anomalyZone(ariaBase) + 0.16) / anomalyZone(ariaBase), "Vivian Cinema 1 total")
approx(disorderZone(run("aria", corruptionDisorder, [VIVIAN.c1])), disorderZone(ariaDisorderBase) + 0.16, "Vivian Cinema 1 Disorder zone")
const burnC1 = run("aria", burn, [VIVIAN.c1])
approx(anomalyZone(burnC1), anomalyZone(ariaBurnBase) + 0.16, "Vivian Cinema 1 applies to every attribute anomaly")
approx(anomalyZone(run("aria", corruption, [VIVIAN.additional, VIVIAN.c1])), anomalyZone(ariaBase) + 0.12 + 0.16, "Vivian Buffs add in the same zone")

// ---- Claret: Remnant Edge, Laceration DMG +25 for armorer mains only.
const sharpEvent = mode => ({
    id: "sharp", kind: "sharp", skillMultiplier: 1, damageElement: "electric", critMode: mode, stunned: false, count: 1,
    sharpScenario: { crimsonInscription: false, gashStacks: 3 },
})
const claretBase = run("claret", [sharpEvent("lacerationCrit")], [])
const claretBuffed = run("claret", [sharpEvent("lacerationCrit")], [CLARET.additional])
const laceration = claretBase.damage.multipliers.lacerationDmg
approx(claretBuffed.damage.multipliers.lacerationDmg, laceration + 0.25, "Laceration DMG +25")
// A Laceration crit applies the Laceration multiplier twice in the current model: ((1 + L + 0.25) / (1 + L)) squared.
approx(total(claretBuffed) / total(claretBase), ((1 + laceration + 0.25) / (1 + laceration)) ** 2, "Remnant Edge on Laceration crit")
approx(total(run("claret", [sharpEvent("nonCrit")], [CLARET.additional])) / total(run("claret", [sharpEvent("nonCrit")], [])), 1, "No crit, no Laceration")
const direct = [{ id: "direct", kind: "direct", damageElement: "electric", skillMultiplier: 100, critMode: "crit", stunned: false, count: 1 }]
approx(total(run("pyrois", direct, [CLARET.additional])) / total(run("pyrois", direct, [])), 1, "Non-armorer mains ignore Remnant Edge")

console.log("teammate team effect tests passed")
