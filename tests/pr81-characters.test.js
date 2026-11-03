import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import { resolveDefaultCalculationConfig } from "../core/defaultCalculationConfig.js"
import { expandCalculationConfigSkillGroups } from "../core/calculationSkillGroups.js"
import { cleanMaintenanceItem } from "../backend/server.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { AGENT_ID_OVERRIDES } from "../core/enka-import/aliases.js"
import { parseEnkaShowcase } from "../core/enka-import/parse-enka.js"
import { mapShowcaseToCatalog } from "../core/enka-import/entity-mapping.js"
import { characterIds, characterInput, characterStore } from "./fixtures/pr81-characters.js"

const catalog = await loadCalculatorContext(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
const approx = (a, b, label) => assert.ok(Math.abs(a - b) <= Math.max(1e-7, Math.abs(b) * 1e-11), `${label}: ${a} != ${b}`)
function input(id, potential = 6) {
    const agent = catalog.agentsMap.get(id)
    const request = characterInput(catalog, id, potential)
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, 0, potential)
    return { ...request, damage: { ...request.damage, ...expandCalculationConfigSkillGroups(config, agent) } }
}
function event(id, categoryId, moveId, rowId = "damage") {
    return { id: moveId, kind: "direct", count: 1, stunned: true, critMode: "expected",
        skillRef: { agentSkillId: id, categoryId, moveId, rowId } }
}
function calculateEvent(id, potential, e, extra = {}) {
    const request = input(id, potential)
    return calculateInCombatPanel(catalog, { ...request, ...extra, damage: { ...request.damage, events: [e], selectedEventId: e.id } })
}

for (const [index, id] of characterIds.entries()) {
    const agent = catalog.agentsMap.get(id)
    const cleaned = cleanMaintenanceItem("agents", structuredClone(agent), catalog)
    assert.deepEqual(validateMaintenanceItem("agents", cleaned, catalog), { ok: true, errors: [] }, id)
    for (const field of ["defaultCalculationConfig", "skillGroups", "preferredDriveDiscs", "potentialVision"]) {
        assert.deepEqual(cleaned[field], agent[field], `${id} maintenance preserves ${field}`)
    }
    assert.equal(AGENT_ID_OVERRIDES[["1021", "1201", "1321"][index]], id)
    assert.equal(catalog.wEnginesMap.get(input(id).wEngineId).relatedAgentId, id)
    if (id === "evelyn_chevalier") {
        assert.equal(agent.hidden, false, "Evelyn remains visible on the workbench")
        assert.ok(catalog.displayAgents.some(item => item.id === id))
    } else {
        assert.equal(agent.hidden, true, `${id} stays in the catalog but is hidden from the workbench until review finishes`)
        assert.equal(catalog.displayAgents.some(item => item.id === id), false)
    }
}

assert.equal(catalog.wEnginesMap.get("zzz_wiki_224").hidden, undefined)
assert.equal(catalog.wEnginesMap.get("zzz_wiki_991").hidden, undefined)
assert.ok(catalog.displayWEngines.some(item => item.id === "zzz_wiki_224"), "Nekomata signature stays visible")
assert.ok(catalog.displayWEngines.some(item => item.id === "zzz_wiki_991"), "Harumasa signature stays visible")

const mapping = JSON.parse(readFileSync(new URL("../data/enka_zzz_mapping.json", import.meta.url), "utf8"))
const imported = mapShowcaseToCatalog(parseEnkaShowcase({ PlayerInfo: { ShowcaseDetail: {
    AvatarList: [1021, 1201, 1321].map((Id, i) => ({ Id, Level: 60, TalentLevel: 0, CoreSkillEnhancement: 6,
        SkillLevelList: [0, 1, 2, 3, 6].map(Index => ({ Index, Level: 12 })),
        Weapon: { Id: [14102, 14120, 14132][i], Level: 60, UpgradeLevel: 1 }, EquippedList: [] })),
} } }), catalog, mapping, { uid: "100000001" })
assert.deepEqual(imported.skippedAgents.map(item => item.enkaId), ["1021", "1201"])
assert.ok(imported.skippedAgents.every(item => item.reason === "Calculator 当前目录未开放"))
assert.deepEqual(imported.mappedAgents.map(a => a.agentId), ["evelyn_chevalier"])
assert.deepEqual(imported.mappedAgents.map(a => a.wEngine.id), ["zzz_wiki_1159"])
assert.ok(imported.mappedAgents.every(a => a.coreSkillLevel === "F" && a.skillLevels.chain === 12))

// Explicit default events and independent multiplier sums preserve the author's
// scope, including original fifth-hit expectation and potential claw count.
for (const potential of [0, 1, 6]) {
    const request = input("nekomata", potential)
    const events = request.damage.events
    const count = (move, row) => events.filter(e => e.skillRef?.moveId === move && (!row || e.skillRef.rowId === row)).reduce((n, e) => n + e.count, 0)
    approx(count("basic_claw", "hit_5"), potential ? 9 : 5, "Nekomata fifth hits")
    assert.equal(count("claw_mark"), potential ? 10 : 0)
    assert.equal(count("ex_ambush"), 2)
    assert.equal(count("ultimate_claw"), 1)
}
const claw = event("nekomata", "core_skill", "claw_mark")
const claw0 = calculateEvent("nekomata", 0, claw)
const claw6 = calculateEvent("nekomata", 6, claw)
approx(claw6.inCombat.panel.critDmg - claw0.inCombat.panel.critDmg, 0.6, "P6 meatball CRIT DMG")
approx(claw6.damage.events[0].multipliers.skill, 0.3, "claw fixed 30% multiplier")
const shadowDiscs = [1, 2].map(slot => ({ slot, setId: "shadow_harmony", mainStat: { stat: "hpFlat", value: 0 } }))
approx(calculateEvent("nekomata", 6, claw, { driveDiscs: shadowDiscs }).damage.totalFinalDamage,
    claw6.damage.totalFinalDamage, "unconfirmed claw follow-up classification is excluded")
const dash = event("nekomata", "dodge", "dash_attack")
const dashBase = calculateEvent("nekomata", 6, dash)
const dashSet = calculateEvent("nekomata", 6, dash, { driveDiscs: shadowDiscs })
approx(dashSet.damage.events[0].multipliers.directDamageBonus - dashBase.damage.events[0].multipliers.directDamageBonus, .15, "Shadow Harmony dash bonus")

for (const potential of [0, 1, 6]) {
    const result = calculateInCombatPanel(catalog, input("asaba_harumasa", potential))
    assert.equal(result.damage.events.length, potential ? 2 : 1)
    approx(result.damage.events.reduce((n, e) => n + e.multipliers.skill, 0), potential ? 43.816 : 39.086, "Harumasa authored ultimate sum")
}
const ult = event("asaba_harumasa", "chain", "ultimate_zanshin")
const ex = event("asaba_harumasa", "special", "ex_ground_net")
const u0 = calculateEvent("asaba_harumasa", 0, ult), u1 = calculateEvent("asaba_harumasa", 1, ult)
approx(u1.damage.events[0].multipliers.critRate - u0.damage.events[0].multipliers.critRate, .25, "potential targeted CRIT")
approx(u1.damage.events[0].multipliers.critDmg - u0.damage.events[0].multipliers.critDmg, .72, "six Edge stacks")
approx(calculateEvent("asaba_harumasa", 1, ex).damage.totalFinalDamage,
    calculateEvent("asaba_harumasa", 0, ex).damage.totalFinalDamage, "EX excludes potential ultimate CRIT")

// Independent Evelyn arithmetic, including an additive multiplier: scaling
// affects the authored multiplier only, never the added 100 percentage points.
const e = event("evelyn_chevalier", "chain", "ultimate_nocturne")
const base = input("evelyn_chevalier", 0)
const modifiers = { activeBuffIds: base.combatBuffs.activeBuffIds, manualStats: [{ stat: "critRate", value: 11.6 }],
    manualEffects: [{ id: "additive-test", effects: [{ id: "additive", type: "fixed", stat: "skillMultiplierBonus", value: 100, mode: "flat", target: { kind: "skill", skillTargets: [{ kind: "skillType", skillType: "ultimate" }] } }] }] }
const independent = calculateEvent("evelyn_chevalier", 0, e, { combatBuffs: modifiers })
// Base ATK 854 + core 75 + engine 713; no discs. CRIT 80%, CD 100%
// (base 50 + engine 50), 30% damage, 25% RES ignore, 150% stun.
const expected = (854 + 75 + 713) * (39.773 * 1.25 + 1) * (1 + .8 * 1) * 1.3 * (794 / (794 + 953)) * 1.25 * 1.5
approx(independent.damage.totalFinalDamage, expected, "independent Evelyn formula")

// All scoring entry points must reevaluate candidate stats, especially CRIT
// values immediately below/at/above the discontinuity.
for (const id of characterIds) for (const critRate of [0, 11.59, 11.6, 11.61, 50]) {
    const request = input(id), p = createInCombatPanelCalculator(catalog, request)
    const statIds = ["critRate", "critDmg", "atkPct"], values = [critRate, 9.6, 30]
    const stats = new Map(statIds.map((s, i) => [s, values[i]])), sets = new Map()
    const discs = statIds.map((stat, i) => ({ mainStat: { stat, value: values[i] } }))
    const truth = calculateInCombatPanel(catalog, { ...request, driveDiscs: discs }).damage.totalFinalDamage
    approx(p.calculate(discs).damage.totalFinalDamage, truth, `${id} prepared`)
    approx(p.scoreOnlyFromSummaryLegacy(stats, sets).finalDamage, truth, `${id} legacy`)
    approx(p.scoreOnlyFromSummary(stats, sets).finalDamage, truth, `${id} compiled`)
    approx(p.scoreOnlyFromIndexedSummary(values, statIds, [], [], sets).finalDamage, truth, `${id} indexed`)
    const dense = p.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: sets })
    assert.ok(dense, `${id} dense target`)
    approx(dense.scoreDense(values, []).finalDamage, truth, `${id} dense`)
    const fixed = dense.compileForSetCounts([])
    approx(fixed.scoreScalar(values).finalDamage, truth, `${id} fixed`)
    if (fixed.scoreObjectiveScalar) approx(fixed.scoreObjectiveScalar(values).finalDamage, truth, `${id} objective`)
    if (id === "evelyn_chevalier") {
        assert.equal(p.optimizerStatMetadata().strictMonotonic, false, "unproven dynamic formula must retain safe fallback")
        assert.ok(p.optimizerStatMetadata().relevantStatIds.includes("critRate"))
    }
}

// Exhaustive ordinary-calculator oracle (64 combinations), not an alternate
// optimizer kernel. Also cover fewer than 10 legal builds and Node workers.
for (const id of characterIds) for (const variants of [1, 2]) {
    const store = characterStore(variants), request = input(id)
    const buckets = Array.from({ length: 6 }, (_, i) => store.driveDiscs.filter(d => d.partition === i + 1))
    const oracle = []
    function enumerate(discs) {
        if (discs.length === 6) {
            oracle.push({ ids: discs.map(d => d.id), score: calculateInCombatPanel(catalog, { ...request, driveDiscs: discs }).damage.totalFinalDamage })
            return
        }
        for (const disc of buckets[discs.length]) enumerate([...discs, disc])
    }
    enumerate([])
    oracle.sort((a, b) => b.score - a.score || a.ids.join("|").localeCompare(b.ids.join("|")))
    function check(result) {
        assert.equal(result.results.length, Math.min(10, oracle.length))
        result.results.forEach((r, i) => {
            assert.deepEqual(Object.values(r.driveDiscIdsBySlot), oracle[i].ids, `${id} Top ${i + 1}`)
            approx(r.score, oracle[i].score, `${id} exhaustive score`)
        })
    }
    check(optimizeDriveDiscs(catalog, store, request))
    check(optimizeDriveDiscs(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } }))
    check(await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog, store, request))
    if (variants === 2) check(await optimizeDriveDiscsAsync(catalog, store, { ...request, settings: { ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } }))
}
console.log("PR81 characters: defaults, independent formula, exclusions, maintenance, scoring paths and exhaustive/Node Worker Top 10 passed")
