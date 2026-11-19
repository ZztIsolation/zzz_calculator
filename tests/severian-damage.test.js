import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext, calculateInCombatPanel, createInCombatPanelCalculator, buildMeta } from "../backend/calculator.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { cleanMaintenanceItem } from "../backend/server.js"
import { normalizeRuntimeForBuff, defaultWEngineIdForAgent } from "../core/shared-combat.js"
import { isAllowedInCombatFormulaOutput } from "../core/effectFormula.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import { severianOptimizerInput, severianOptimizerStore } from "./fixtures/severian-optimizer.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const agent = catalog.agentsMap.get("severian_lowell"), skills = catalog.agentSkillsMap.get(agent.id)
const weapon = catalog.wEnginesMap.get("zzz_wiki_2305")
const fixture = JSON.parse(readFileSync(new URL("./fixtures/severian-source-values.json", import.meta.url)))
const core = `agent:${agent.id}.corePassive`, additional = `agent:${agent.id}.additionalAbility`, weaponBuff = `wEngine:${weapon.id}.self`
const approx = (a, b, label) => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`)
const moves = skills.categories.flatMap(c => c.moves)
const rowFor = (category, move, row) => skills.categories.find(c => c.id === category).moves.find(m => m.id === move).rows.find(r => r.id === row)
function input(buffs = [], overrides = {}) {
    const base = severianOptimizerInput()
    return { ...base, ...overrides, driveDiscs: [], combatBuffs: { activeBuffIds: buffs, ...overrides.combatBuffs } }
}
const run = (buffs, overrides) => calculateInCombatPanel(catalog, input(buffs, overrides))

assert.equal(agent.hidden, true)
assert.equal(weapon.hidden, true)
assert.equal(buildMeta(catalog).displayAgents.some(a => a.id === agent.id), false)
assert.equal(buildMeta(catalog).displayWEngines.some(w => w.id === weapon.id), false)
assert.equal(defaultWEngineIdForAgent(catalog.wEngines, agent.id, "zzz_wiki_14163"), weapon.id)
assert.equal(agent.defaultCalculationConfig, undefined)
assert.equal(agent.skillGroups?.length ?? 0, 0)
assert.equal(agent.cinemaDescriptions.length, 6)
assert.deepEqual(agent.level60, fixture.level60)
for (const [kind, item] of [["agents", agent], ["agent-skills", skills], ["wEngines", weapon]]) {
    assert.deepEqual(validateMaintenanceItem(kind, item, catalog), { ok: true, errors: [] })
    const cleaned = cleanMaintenanceItem(kind, structuredClone(item), catalog)
    assert.deepEqual(validateMaintenanceItem(kind, cleaned, catalog), { ok: true, errors: [] })
    if (kind === "agent-skills") assert.deepEqual(cleaned.categories, item.categories)
    if (kind === "agents") assert.deepEqual(cleaned.combatBuffs.additionalAbility.effects, item.combatBuffs.additionalAbility.effects)
}
assert.equal(fixture.rows.length, 39)
assert.equal(moves.reduce((sum, m) => sum + m.rows.length, 0), 41)
for (const f of fixture.rows) assert.deepEqual(rowFor(f.categoryId, f.moveId, f.rowId).values, f.values, f.sourceLabel)
for (const f of fixture.derivedRows) assert.deepEqual(rowFor(f.categoryId, f.moveId, f.rowId).values,
    rowFor(f.sourceCategoryId, f.sourceMoveId, f.sourceRowId).values)
assert.equal(rowFor("special", "special_move_2", "row_2").values[2], 402.8)
assert.ok(moves.find(m => m.id === "assist_move_3").skillTags.includes("assistAttack"))
assert.ok(moves.find(m => m.id === "assist_move_4").skillTags.includes("assistAttack"))
assert.ok(moves.find(m => m.id === "special_move_2").skillTags.includes("exSpecial"))

const base = run([])
approx(base.inCombat.panel.atk, 858 + 75 + 713, "base ATK excludes converted ATK")
approx(base.inCombat.panel.critRate, .29, "weapon base CRIT Rate")
approx(run([additional]).inCombat.panel.atk, 1646 + 246.5, "29% crit -> 246.5 ATK")
approx(run([additional, "nicole.cinema_6.energy_field_crit_rate"]).inCombat.panel.atk,
    1646 + 44 * 8.5, "teammate global crit participates in conversion")
const targeted = run([additional], { combatBuffs: { manualEffects: [{ id: "targeted-crit", effects: [{
    id: "targeted-crit-rule", type: "fixed", stat: "critRate", value: 20, mode: "flat",
    target: { kind: "skill", skillTargets: [{ kind: "skillType", skillType: "basic" }] },
}] }] } })
approx(targeted.inCombat.panel.atk, 1892.5, "event-only crit does not feed panel conversion")
approx(targeted.damage.events[0].multipliers.critRate, .49, "event-only crit still affects damage")
for (const [cinemaLevel, stat, expected] of [[2,"penRatio",.2],[4,"atkPctOutOfCombat",.1]]) {
    const buff = agent.combatBuffs.cinemaBuffs.find(b => b.cinemaLevel === cinemaLevel)
    const id = `agent:${agent.id}.cinema.${cinemaLevel}`
    approx(run([id], {cinemaLevel}).inCombat.buffTotals[stat], expected, `cinema ${cinemaLevel} on`)
    const runtime = normalizeRuntimeForBuff(buff, { effects: { [buff.effects[0].id]: { coverage: 0 } } })
    approx(run([id], {cinemaLevel, combatBuffs: {runtimeInputs: {[id]: runtime}}}).inCombat.buffTotals[stat], 0, `cinema ${cinemaLevel} off`)
}
for (const cr of [0, 29, 99.9, 100, 140]) {
    const result = run([additional], { combatBuffs: { manualStats: [{ stat: "critRate", value: cr - 29, mode: "flat" }] } })
    approx(result.inCombat.panel.atk, 1646 + Math.min(cr, 100) * 8.5, `CRIT cap ${cr}`)
    approx(result.damage.totalFinalDamage, (1646 + Math.min(cr, 100) * 8.5) * 40.561
        * (1 + Math.min(cr / 100, 1) * .788) * 794 / 1747 * 1.5, `independent damage ${cr}`)
}
for (const [i, level] of ["none", "A", "B", "C", "D", "E", "F"].entries()) {
    const r = run([core], { coreSkillLevel: level })
    approx(r.inCombat.buffTotals.critDmg, [30,35,40,45,50,55,60][i] / 100, `core crit ${level}`)
    approx(r.inCombat.buffTotals.dmgBonus, ([12.5,14.6,16.7,18.8,20.8,22.9,25][i] + [15,17.5,20,22.5,25,27.5,30][i]) / 100, `core damage ${level}`)
}
const coreRuntime = normalizeRuntimeForBuff(agent.combatBuffs.corePassive, { effects: { "severian-core-wind-dmg": { coverage: 0 } } })
const withoutWind = run([core], { combatBuffs: { runtimeInputs: { [core]: coreRuntime } } })
approx(withoutWind.inCombat.buffTotals.dmgBonus, .25, "no wind teammate")
approx(withoutWind.inCombat.buffTotals.critDmg, .6, "other core effects stay active")
for (let rank = 1; rank <= 5; rank++) {
    const r = run([additional, weaponBuff], { wEngineModificationLevel: rank })
    const cr = .29 + [20,23,26,29,32][rank - 1] / 100
    approx(r.inCombat.panel.atk, 1646 * (1 + [10,11.5,13,14.5,16][rank - 1] / 100) + cr * 850, `weapon ${rank} before conversion`)
    approx(r.inCombat.buffTotals.windResIgnore, [15,17.3,19.5,21.8,24][rank - 1] / 100, `weapon RES ${rank}`)
}
const inactiveWeapon = normalizeRuntimeForBuff(weapon.effect.selfBuff, { effects: {
    "severian-signature-atk": { coverage: 0 }, "severian-signature-wind-res-ignore": { coverage: 0 } } })
const dormant = run([additional, weaponBuff], { combatBuffs: { runtimeInputs: { [weaponBuff]: inactiveWeapon } } })
approx(dormant.inCombat.panel.atk, 1646 + .49 * 850, "only weapon permanent crit remains")
const oldWeapon = run([additional, "wEngine:zzz_wiki_14163.self"], { wEngineId: "zzz_wiki_14163",
    combatBuffs: { runtimeInputs: { "wEngine:zzz_wiki_14163.self": inactiveWeapon } } })
approx(oldWeapon.inCombat.panel.atk, dormant.inCombat.panel.atk, "legacy weapon and runtime IDs")

const conversion = agent.combatBuffs.additionalAbility.effects[0]
for (const source of ["atk", "critDmg", "def"]) assert.equal(isAllowedInCombatFormulaOutput({ ...conversion, source: { ...conversion.source, stat: source } }), false)
assert.equal(isAllowedInCombatFormulaOutput(conversion, "wEngine"), false)
assert.equal(isAllowedInCombatFormulaOutput({ ...conversion, stat: "critRate" }), false, "no reverse panel feedback")
const downstream = structuredClone(agent)
downstream.combatBuffs.additionalAbility.effects.push({ id: "read-converted-atk", type: "formula", stat: "dmgBonus", mode: "flat", target: { kind: "default" },
    source: { kind: "inCombatStat", stat: "atk", unit: "storedValue" }, formula: { expression: "x / 100", valueUnit: "storedPercent" } })
const extended = { ...catalog, agentsMap: new Map(catalog.agentsMap).set(agent.id, downstream) }
approx(calculateInCombatPanel(extended, input([additional])).inCombat.panel.dmgBonus, 1892.5 / 10000, "downstream reads converted attack")

const c6 = `agent:${agent.id}.cinema.6`
const six = run([c6], { cinemaLevel: 6 })
approx(six.inCombat.buffTotals.windResIgnore, 0, "six has no invented RES ignore")
approx(six.damage.totalFinalDamage / base.damage.totalFinalDamage, (4056.1 + 350) / 4056.1, "six adds 350 once to complete attack")
assert.match(JSON.stringify(six.damage.events[0].whiteBoxRows), /350/)
for (const source of fixture.rows.filter(r => r.kind === "damageMultiplier")) {
    const request = input([], { damage: { ...input().damage, events: [{ ...input().damage.events[0], skillRef: {
        agentSkillId: agent.id, categoryId: source.categoryId, moveId: source.moveId, rowId: source.rowId } }] } })
    for (const level of [1,12,16]) {
        request.damage.skillLevelsByCategory = { [source.categoryId]: level }
        const value = calculateInCombatPanel(catalog, request)
        approx(value.damage.totalFinalDamage, 1646 * source.values[level - 1] / 100 * (1 + .29 * .788) * 794 / 1747 * 1.5, `source damage ${source.moveId}/${source.rowId}/${level}`)
    }
    request.combatBuffs.activeBuffIds = [c6];request.cinemaLevel = 6
    const result = calculateInCombatPanel(catalog, request)
    approx(result.damage.events[0].multipliers.skillMultiplierBonus || 0, source.moveId === "basic_move_3" ? 3.5 : 0, "C6 excludes other moves")
}
for (const moveId of ["basic_move_1", "special_move_2"]) {
    const categoryId = moveId.startsWith("basic") ? "basic" : "special"
    const request = input()
    const event = request.damage.events[0]
    const sum = moves.find(m => m.id === moveId).rows.filter(r => r.kind === "damageMultiplier").reduce((total, row) => {
        event.skillRef = { agentSkillId: agent.id, categoryId, moveId, rowId: row.id }
        return total + calculateInCombatPanel(catalog, request).damage.totalFinalDamage
    }, 0)
    request.damage.events = moves.find(m => m.id === moveId).rows.filter(r => r.kind === "damageMultiplier")
        .map(row => ({ ...event, id: row.id, skillRef: { agentSkillId: agent.id, categoryId, moveId, rowId: row.id } }))
    request.damage.selectedEventId = request.damage.events[0].id
    approx(calculateInCombatPanel(catalog, request).damage.totalFinalDamage, sum, "multi-hit sum excludes alternate fourth hit")
}

// Source dependencies must remain relevant even when direct damage cannot crit.
const statIds = ["atkPct", "critRate", "critDmg", "windDmg", "penRatio"]
for (const level of [0,6]) for (const critMode of ["expected", "nonCrit", "crit"]) {
    const request = severianOptimizerInput(level);request.damage.events[0].critMode = critMode
    const prepared = createInCombatPanelCalculator(catalog, request)
    for (const cr of [0,24,90]) {
        const values = Float64Array.from([30,cr,48,30,12]), sums = new Map(statIds.map((s,i)=>[s,values[i]]))
        const legacy = prepared.scoreOnlyFromSummaryLegacy(sums, new Map()).finalDamage
        approx(prepared.scoreOnlyFromSummary(sums, new Map()).finalDamage, legacy, "compiled")
        approx(prepared.scoreOnlyFromIndexedSummary(values, statIds, [], [], new Map()).finalDamage, legacy, "indexed")
        const dense = prepared.compileDensePanelScoreTarget({statIds,setIds:[],setIndexById:new Map()})
        approx(dense.scoreDense(values, []).finalDamage, legacy, "dense")
        approx(dense.compileForSetCounts([]).scoreScalar(values).finalDamage, legacy, "fixed sets")
    }
}
for (const cinema of [0,6]) for (const mode of ["expected","nonCrit"]) {
    const request = severianOptimizerInput(cinema), store = severianOptimizerStore(), oracle = []
    request.damage.events[0].critMode = mode
    function enumerate(discs) {
        if (discs.length === 6) { oracle.push({ ids: discs.map(d=>d.id), score: calculateInCombatPanel(catalog,{...request,driveDiscs:discs}).damage.totalFinalDamage });return }
        for (const disc of store.driveDiscs.filter(d=>d.partition===discs.length+1)) enumerate([...discs,disc])
    }
    enumerate([]);oracle.sort((a,b)=>b.score-a.score||a.ids.join('|').localeCompare(b.ids.join('|')))
    for (const result of [optimizeDriveDiscs(catalog,store,request),await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog,store,request),
        await optimizeDriveDiscsAsync(catalog,store,{...request,settings:{...request.settings,algorithm:'exact-super-bound-parallel',workerCount:2}})]) {
        assert.equal(result.results.length,10)
        result.results.forEach((r,i)=>{assert.deepEqual(Object.values(r.driveDiscIdsBySlot),oracle[i].ids);approx(r.score,oracle[i].score,'independent Top10')})
    }
}
console.log("Severian: source tables, independent formulas, exclusions, growth, legacy IDs, scoring paths and exhaustive Top10 passed")
