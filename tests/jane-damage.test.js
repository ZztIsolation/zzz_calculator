import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext, calculateInCombatPanel, createInCombatPanelCalculator } from "../backend/calculator.js"
import { resolveDefaultCalculationConfig } from "../core/defaultCalculationConfig.js"
import { calculationSkillGroups } from "../core/calculationSkillGroups.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { materializeCorePassiveScalingEffect } from "../core/corePassiveScaling.js"
import { repairDynamicValueSourceFallbacks } from "../core/maintenanceValidation.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import { janeOptimizerInput, janeOptimizerStore } from "./fixtures/jane-optimizer.js"
import { storedEffectRuleText } from "../core/shared-combat.js"

const root = fileURLToPath(new URL("../", import.meta.url))
const catalog = await loadCalculatorContext(root)
const agent = catalog.agentsMap.get("jane_doe")
const skills = catalog.agentSkillsMap.get("jane_doe")
const fixture = JSON.parse(readFileSync(new URL("./fixtures/jane-source-values.json", import.meta.url)))
const baseId = "agent:jane_doe.corePassive"
const additionalId = "agent:jane_doe.additionalAbility"
const frenzyId = "agent:jane_doe.skill.frenzy"
const frenzy = agent.combatBuffs.skillBuffs.find(buff => buff.id === "frenzy")
const approx = (a, b, label) => assert.ok(Math.abs(Number(a) - Number(b)) <= 1e-8 * Math.max(1, Math.abs(Number(b))), `${label}: ${a} != ${b}`)
const assault = { id: "assault", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", anomalyVariant: "normal", count: 1, procCount: 1, stunned: true }
const shock = { ...assault, id: "shock", anomalyEffect: "shock" }
const flinch = { id: "flinch", kind: "anomaly", settlementType: "disorder", anomalyEffect: "flinch", elapsedSeconds: 0, count: 1, stunned: true }
const direct = { id: "direct", kind: "direct", count: 1, stunned: true, critMode: "expected", skillRef: { agentSkillId: "jane_doe", categoryId: "chain", moveId: "ultimate_finale", rowId: "damage" } }
function input(events = [assault], { potentialLevel = 6, coreSkillLevel = "F", buffs = [baseId, additionalId, frenzyId], runtimeInputs = {}, proficiency = 0 } = {}) {
  return { agentId: agent.id, coreSkillLevel, potentialLevel, wEngineId: "zzz_wiki_760", wEngineModificationLevel: 1, driveDiscs: [],
    combatBuffs: { activeBuffIds: buffs, runtimeInputs, manualStats: proficiency ? [{ stat: "anomalyProficiency", value: proficiency, mode: "flat" }] : [] },
    damage: { mode: "custom", selectedEventId: events[0]?.id, events } }
}
function calc(events, options) { return calculateInCombatPanel(catalog, input(events, options)) }

assert.equal(agent.hidden, false)
assert.equal(fixture.officialEntryVersion, "1788063783")
assert.deepEqual(agent.level60, fixture.level60)
assert.equal(agent.potentialVision.defaultLevel, 6)
assert.deepEqual(agent.potentialVision.scaling.levels.map(x => x.assaultCritDmgPct), [0, 0, 10, 15, 20, 25, 30])
assert.equal(agent.potentialVision.mechanics.c6ExtraAttackModeled, false)
assert.equal(agent.cinemaDescriptions.find(x => x.cinemaLevel === 6).modeled, false)
assert.equal(fixture.confirmedModeling.c1DamageFormula, "clamp(max(x - 120, 0) * 0.1, 0, 30)")
assert.deepEqual(validateMaintenanceItem("agents", agent, catalog), { ok: true, errors: [] })
assert.deepEqual(validateMaintenanceItem("agentSkills", skills, catalog), { ok: true, errors: [] })
assert.equal(catalog.wEnginesMap.get("zzz_wiki_760").relatedAgentId, agent.id)
assert.equal(catalog.combatBuffsMap.get("jane_doe.core_insight").teammateId, "jane_doe")
assert.deepEqual(frenzy.sourceSkillRef, { agentSkillId: "jane_doe", categoryId: "basic" })
assert.equal(frenzy.defaultChecked, true)
assert.equal(fixture.frenzySource.category, "普通攻击")
assert.match(fixture.frenzySource.text, /120点/)
assert.doesNotMatch(JSON.stringify(agent.combatBuffs.corePassive), /狂热|frenzy/)

for (const source of fixture.rows) {
  const row = skills.categories.find(c => c.id === source.categoryId).moves.find(m => m.id === source.moveId).rows.find(r => r.id === source.rowId)
  assert.equal(row.kind, source.kind, `${source.moveId}/${source.rowId} must not turn Daze into damage`)
  assert.deepEqual(row.values, source.values)
  assert.equal(row.values.length, 16)
}
for (const source of fixture.inheritedRows) {
  const category = skills.categories.find(c => c.id === source.categoryId)
  const move = category.moves.find(m => m.id === source.moveId)
  const original = category.moves.find(m => m.id === source.baseMoveId)
  assert.ok(move.skillTags.includes("dashAttack"))
  source.rowIds.forEach(id => assert.deepEqual(move.rows.find(r => r.id === id).values, original.rows.find(r => r.id === id).values))
}
assert.deepEqual(skills.categories.find(c => c.id === "assist").moves.find(m => m.id === "defensive_assist_last_line").rows.map(r => r.kind), ["dazeMultiplier", "dazeMultiplier", "dazeMultiplier"])
assert.equal(fixture.normalizations.length, 4)
const scaledAgent = structuredClone(agent)
const parameterRule = scaledAgent.combatBuffs.corePassive.effects.find(r => r.formula?.parameterSources)
parameterRule.formula.parameters.rate = 9
assert.equal(validateMaintenanceItem("agents", scaledAgent, catalog).ok, false)
assert.equal(repairDynamicValueSourceFallbacks(scaledAgent).length, 1)
assert.equal(parameterRule.formula.parameters.rate, .1)
assert.equal(validateMaintenanceItem("agents", scaledAgent, catalog).ok, true)
parameterRule.formula.parameterSources.rate.field = "missing"
assert.equal(validateMaintenanceItem("agents", scaledAgent, catalog).ok, false)
for (const sourceStat of ["atk", "def", "dmgBonus"]) {
  const invalid = structuredClone(agent)
  invalid.combatBuffs.skillBuffs.find(b => b.id === "frenzy").effects[0].source.stat = sourceStat
  assert.equal(validateMaintenanceItem("agents", invalid, catalog).ok, false, "Reject panel feedback and unsupported outputs")
}

const base = calc([assault], { buffs: [] })
approx(base.outOfCombat.panel.atk, 805 + 75 + 713, "F Core and signature ATK")
approx(base.outOfCombat.panel.anomalyMastery, 112 + 36, "Core mastery")
approx(base.outOfCombat.panel.anomalyProficiency, 114 + 90, "Signature proficiency")
const initial = calc([assault], { buffs: [], coreSkillLevel: "none" })
approx(initial.outOfCombat.panel.atk, 805 + 713, "Initial ATK")
approx(initial.outOfCombat.panel.anomalyMastery, 112, "Initial mastery")

const coreOnly = calc([assault], { buffs: [baseId] })
approx(coreOnly.inCombat.panel.atk, base.inCombat.panel.atk, "Core no longer grants Frenzy ATK")
assert.ok(coreOnly.damage.events[0].multipliers.anomalyCritRate > 0)
const frenzyOnly = calc([assault], { buffs: [frenzyId] })
approx(frenzyOnly.inCombat.panel.atk - base.inCombat.panel.atk, 168, "Frenzy works independently of Core")
approx(frenzyOnly.damage.events[0].multipliers.anomalyCritRate, 0, "Frenzy does not grant Core CRIT")
for (const coverage of [0, .5, 1]) {
  const result = calc([assault], { buffs: [baseId, frenzyId], runtimeInputs: {
    [frenzyId]: { effects: { "jane-frenzy-atk-from-proficiency": { coverage } } },
  } })
  approx(result.inCombat.panel.atk - base.inCombat.panel.atk, 168 * coverage, "Independent Frenzy coverage")
  approx(result.damage.events[0].multipliers.anomalyCritRate, coreOnly.damage.events[0].multipliers.anomalyCritRate, "Frenzy coverage leaves Core intact")
}
// Reconstruct the prior combined catalog to prove the default snapshot is unchanged.
const combined = structuredClone(agent)
combined.combatBuffs.corePassive.effects.push(...combined.combatBuffs.skillBuffs.find(b => b.id === "frenzy").effects)
combined.combatBuffs.skillBuffs = combined.combatBuffs.skillBuffs.filter(b => b.id !== "frenzy")
const combinedCatalog = { ...catalog, agentsMap: new Map(catalog.agentsMap).set(agent.id, combined) }
const previous = calculateInCombatPanel(combinedCatalog, input([assault, flinch, direct], { buffs: [baseId, additionalId] }))
const split = calc([assault, flinch, direct])
assert.deepEqual(split.inCombat.panel, previous.inCombat.panel)
approx(split.damage.totalFinalDamage, previous.damage.totalFinalDamage, "Split preserves combined snapshot damage")

for (const [index, coreSkillLevel] of ["none", "A", "B", "C", "D", "E", "F"].entries()) {
  const result = calc([assault], { coreSkillLevel, potentialLevel: 0 })
  const P = result.inCombat.panel.anomalyProficiency
  const row = agent.coreSkill.corePassiveScaling.levels[index]
  approx(result.damage.events[0].multipliers.anomalyCritRate, Math.min(1, (row.assaultCritRatePct + P * row.assaultCritRatePerAnomalyProficiencyPct) / 100), `Core ${coreSkillLevel} dynamic crit`)
  approx(result.damage.events[0].multipliers.anomalyCritDmg, .5, "Core anomaly crit damage")
  approx(result.inCombat.panel.atk - result.outOfCombat.panel.atk, Math.min(Math.max(P - 120, 0) * 2, 600), "Frenzy AP to ATK")
  const materialized = materializeCorePassiveScalingEffect(agent.combatBuffs.corePassive, agent, coreSkillLevel)
  approx(materialized.effects.find(x => x.id === "jane-assault-crit-rate-from-proficiency").formula.parameters.rate, row.assaultCritRatePerAnomalyProficiencyPct, "Parameter materialization")
}
for (const [potentialLevel, bonus] of [0, 0, .1, .15, .2, .25, .3].entries()) {
  const result = calc([assault, shock, direct], { potentialLevel })
  approx(result.damage.events[0].multipliers.anomalyCritDmg, .5 + bonus, `P${potentialLevel} Assault crit damage`)
  approx(result.damage.events[1].multipliers.anomalyCritDmg, 0, "Does not affect Shock")
  approx(result.damage.events[2].multipliers.critDmg, .5, "Does not affect direct CRIT DMG")
}
approx(calc([flinch]).damage.events[0].multipliers.anomaly, 5.625, "Flinch extends to 15 seconds")
approx(calc([flinch], { buffs: [] }).damage.events[0].multipliers.anomaly, 5.25, "Base Flinch stays 10 seconds")

const c1Id = "agent:jane_doe.cinema.1"
for (const P of [0, 119, 120, 121, 299, 300, 419, 420, 600]) {
  const result = calc([assault], { proficiency: P - 204, buffs: [baseId, frenzyId, c1Id] })
  approx(result.inCombat.panel.dmgBonus, Math.min(Math.max(P - 120, 0) * .1, 30) / 100, `C1 ${P}`)
  approx(result.inCombat.panel.atk - result.outOfCombat.panel.atk, Math.min(Math.max(P - 120, 0) * 2, 600), `Frenzy cap ${P}`)
}
const half = calc([assault], { buffs: [c1Id], runtimeInputs: { [c1Id]: { effects: { "jane-c1-damage-from-proficiency": { coverage: .5 } } } } })
approx(half.inCombat.panel.dmgBonus, .042, "C1 coverage")
const previewBuff = materializeCorePassiveScalingEffect(agent.combatBuffs.corePassive, agent, "F")
const attackRule = frenzy.effects.find(r => r.stat === "atkFlat")
assert.match(storedEffectRuleText(attackRule, {}, previewBuff, {}, { inCombatPanel: { anomalyProficiency: 204 } }), /168/u)
assert.doesNotMatch(storedEffectRuleText(attackRule, {}, previewBuff, {}, { inCombatPanel: { anomalyProficiency: 204 } }), /通用伤害|16800/u)
const liveCritRule = previewBuff.effects.find(r => r.formula?.parameterSources)
assert.match(storedEffectRuleText(liveCritRule, {}, previewBuff, {}, { inCombatPanel: { anomalyProficiency: 204 } }), /强击/u)
const c2 = calc([assault, shock, direct], { buffs: [baseId, "agent:jane_doe.cinema.2"] })
approx(c2.damage.events[0].targetBreakdown.enemyDefReduction, .15, "C2 Assault DEF ignore")
approx(c2.damage.events[0].multipliers.anomalyCritDmg, 1, "C2 Assault crit damage")
approx(c2.damage.events[1].targetBreakdown.enemyDefReduction, 0, "C2 excludes Shock")
approx(c2.damage.events[2].targetBreakdown.enemyDefReduction, 0, "C2 current snapshot excludes direct")
const c4 = calc([assault, flinch], { buffs: ["agent:jane_doe.cinema.4"] })
approx(c4.damage.events[0].multipliers.attributeAnomalyDamage, 1.18, "C4 Attribute Anomaly bonus")
approx(c4.damage.events[1].multipliers.disorderDamage, 1, "C4 excludes Disorder")

// Integration: Jane's live AP/Core/Potential CRIT uses the same selectable
// conditional outcomes as the teammate-based anomaly model.
for (const [coreIndex, coreSkillLevel] of ["none", "A", "B", "C", "D", "E", "F"].entries()) {
  for (const potentialLevel of [0, 6]) for (const cinemaTwo of [false, true]) {
    for (const P of [204, 374, 375, 600]) {
      const options = { coreSkillLevel, potentialLevel, proficiency: P - 204,
        buffs: [baseId, additionalId, frenzyId, ...(cinemaTwo ? ["agent:jane_doe.cinema.2"] : [])] }
      const outcomes = Object.fromEntries(["expected", "crit", "nonCrit"].map(critMode =>
        [critMode, calc([{ ...assault, critMode }], options).damage.events[0]]))
      const row = agent.coreSkill.corePassiveScaling.levels[coreIndex]
      const r = Math.min(1, (row.assaultCritRatePct + P * row.assaultCritRatePerAnomalyProficiencyPct) / 100)
      const c = .5 + (potentialLevel === 6 ? .3 : 0) + (cinemaTwo ? .5 : 0)
      const D = outcomes.nonCrit.finalDamage
      approx(outcomes.expected.finalDamage, D * (1 + r * c), "Jane live expected outcome")
      approx(outcomes.crit.finalDamage, D * (1 + c), "Jane live critical outcome")
      for (const [mode, outcome] of Object.entries(outcomes)) {
        assert.equal(outcome.critInfo.effectiveMode, mode)
        approx(outcome.critInfo.critRate, r, "Jane live rate in CRIT metadata")
        approx(outcome.damageVariants[mode].finalDamage, outcome.finalDamage, "Jane selected white-box outcome")
      }
    }
  }
}
const dormantCrit = calc([{ ...assault, critMode: "crit" }], { buffs: [additionalId, frenzyId, "agent:jane_doe.cinema.2"] }).damage.events[0]
assert.equal(dormantCrit.critInfo.available, false, "Potential/C2 CRIT damage cannot grant CRIT without Core")
assert.equal(dormantCrit.input.critMode, "crit", "Keep dormant requested outcome")
assert.equal(dormantCrit.damageVariants, undefined)

// Verify the phase ordering with an ATK reader, and the same extension on Sheer.
const downstream = structuredClone(agent)
const atkReader = downstream.combatBuffs.cinemaBuffs[0].effects[0]
atkReader.source.stat = "atk"
atkReader.formula.expression = "x / 1000"
const downstreamCatalog = { ...catalog, agentsMap: new Map(catalog.agentsMap).set(agent.id, downstream) }
const downstreamInput = input([assault], { buffs: [baseId, frenzyId, c1Id] })
const downstreamFull = calculateInCombatPanel(downstreamCatalog, downstreamInput)
approx(downstreamFull.inCombat.panel.dmgBonus, downstreamFull.inCombat.panel.atk / 100000, "Damage formula reads converted ATK")
const downstreamDense = createInCombatPanelCalculator(downstreamCatalog, downstreamInput).compileDensePanelScoreTarget({ statIds: [], setIds: [] })
approx(downstreamDense.scoreDense([], []).finalDamage, downstreamFull.damage.totalFinalDamage, "Converted ATK reader dense parity")
const sheerAgent = structuredClone(catalog.agentsMap.get("yixuan"))
const flatAttackRule = structuredClone(attackRule)
flatAttackRule.formula.expression = "100"
sheerAgent.combatBuffs.additionalAbility.effects = [flatAttackRule]
const sheerCatalog = { ...catalog, agentsMap: new Map(catalog.agentsMap).set("yixuan", sheerAgent) }
const sheerInput = { agentId: "yixuan", coreSkillLevel: "F", wEngineId: "zzz_wiki_1342",
  combatBuffs: { activeBuffIds: ["agent:yixuan.additionalAbility"] },
  damage: { events: [{ id: "sheer", kind: "sheer", skillMultiplier: 100, damageElement: "ether", critMode: "nonCrit" }] } }
const sheerFull = calculateInCombatPanel(sheerCatalog, sheerInput)
const sheerDense = createInCombatPanelCalculator(sheerCatalog, sheerInput).compileDensePanelScoreTarget({ statIds: [], setIds: [] })
approx(sheerDense.scoreDense([], []).finalDamage, sheerFull.damage.totalFinalDamage, "Sheer force includes converted ATK")

const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, 6, 6)
assert.equal(config.name.zhCN, "单次物理异常")
assert.equal(config.events.length, 1)
assert.equal(config.events[0].anomalyEffect, "assault")
assert.deepEqual(calculationSkillGroups(agent), [])
assert.equal(JSON.stringify(skills).includes("requiresPotentialLevel"), false)

const c6 = calc([assault], { buffs: ["agent:jane_doe.cinema.6"] })
approx(c6.inCombat.panel.critRate - c6.outOfCombat.panel.critRate, 0.2, "C6 CRIT Rate")
approx(c6.inCombat.panel.critDmg - c6.outOfCombat.panel.critDmg, 0.4, "C6 CRIT DMG")
assert.equal(c6.damage.events.length, 1, "C6 extra attack remains unmodeled")

const statIds = ["atkPct", "anomalyProficiency", "physicalDmg", "penRatio", "critRate", "critDmg"]
const values = Float64Array.from([30, 120, 30, 12, 24, 48])
const sums = new Map(statIds.map((id, i) => [id, values[i]]))
for (const events of [[assault], [direct], [assault, flinch, direct]]) {
  for (const potentialLevel of [0, 2, 6]) for (const critMode of ["expected", "crit", "nonCrit"]) {
    const modeEvents = events.map(event => event.settlementType === "attribute" ? { ...event, critMode } : event)
    const prepared = createInCombatPanelCalculator(catalog, input(modeEvents, { potentialLevel, buffs: [baseId, additionalId, frenzyId, c1Id, "agent:jane_doe.cinema.2", "agent:jane_doe.cinema.4"] }))
    const legacy = prepared.scoreOnlyFromSummaryLegacy(sums, new Map()).finalDamage
    approx(prepared.scoreOnlyFromSummary(sums, new Map()).finalDamage, legacy, "compiled parity")
    approx(prepared.scoreOnlyFromIndexedSummary(values, statIds, new Int16Array(), [], new Map()).finalDamage, legacy, "indexed parity")
    const dense = prepared.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
    assert.ok(dense)
    approx(dense.scoreDense(values, new Int16Array()).finalDamage, legacy, "dense parity")
    approx(dense.compileForSetCounts(new Int16Array()).scoreScalar(values).finalDamage, legacy, "fixed-set parity")
  }
}

// Enumerate the full Cartesian inventory independently of the optimizer search.
const store = janeOptimizerStore()
const buckets = Array.from({ length: 6 }, (_, i) => store.driveDiscs.filter(d => d.partition === i + 1))
for (const potentialLevel of [0, 6]) for (const critMode of ["expected", "crit", "nonCrit"]) {
  const request = janeOptimizerInput(potentialLevel)
  request.damage.events[0].critMode = critMode
  const oracle = []
  function enumerate(discs) {
    if (discs.length === 6) {
      const value = calculateInCombatPanel(catalog, { ...request, driveDiscs: discs.map(d => ({ ...d, slot: d.partition })) }).damage.totalFinalDamage
      oracle.push({ ids: discs.map(d => d.id), score: value })
      return
    }
    for (const disc of buckets[discs.length]) enumerate([...discs, disc])
  }
  enumerate([])
  oracle.sort((a, b) => b.score - a.score || a.ids.join("|").localeCompare(b.ids.join("|")))
  const assertTop = result => {
    assert.equal(result.results.length, 10)
    result.results.forEach((row, i) => {
      assert.deepEqual(Object.values(row.driveDiscIdsBySlot), oracle[i].ids)
      approx(row.score, oracle[i].score, `independent Top 10/${i}`)
    })
  }
  assertTop(optimizeDriveDiscs(catalog, store, request))
  assertTop(await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog, store, request))
  assertTop(await optimizeDriveDiscsAsync(catalog, store, { ...request,
    settings: { ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } }))
}

console.log("Jane damage tests passed")
