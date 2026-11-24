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
function input(id, potential = 6, cinemaLevel = 0) {
    const agent = catalog.agentsMap.get(id)
    const baseReq = characterInput(catalog, id, potential)
    const cinemaBuffIds = (agent.combatBuffs?.cinemaBuffs ?? [])
        .filter(b => b.cinemaLevel <= cinemaLevel)
        .map(b => `agent:${id}.cinema.${b.cinemaLevel}`)
    const request = {
        ...baseReq,
        cinemaLevel,
        combatBuffs: {
            ...baseReq.combatBuffs,
            activeBuffIds: [...baseReq.combatBuffs.activeBuffIds, ...cinemaBuffIds],
        },
    }
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, cinemaLevel, potential)
    return { ...request, damage: { ...request.damage, ...expandCalculationConfigSkillGroups(config, agent) } }
}
function event(id, categoryId, moveId, rowId = "damage") {
    return {
        id: `${moveId}_${rowId}`, kind: "direct", count: 1, stunned: true, critMode: "expected",
        skillRef: { agentSkillId: id, categoryId, moveId, rowId },
    }
}
function calculateEvent(id, potential, e, extra = {}, cinemaLevel = 0) {
    const request = input(id, potential, cinemaLevel)
    return calculateInCombatPanel(catalog, { ...request, ...extra, damage: { ...request.damage, events: [e], selectedEventId: e.id } })
}

for (const [index, id] of characterIds.entries()) {
    const agent = catalog.agentsMap.get(id)
    const cleaned = cleanMaintenanceItem("agents", structuredClone(agent), catalog)
    assert.deepEqual(validateMaintenanceItem("agents", cleaned, catalog), { ok: true, errors: [] }, id)
    for (const field of ["defaultCalculationConfig", "skillGroups", "preferredDriveDiscs", "potentialVision", "cinemaDescriptions"]) {
        assert.deepEqual(cleaned[field], agent[field], `${id} maintenance preserves ${field}`)
    }
    assert.equal(AGENT_ID_OVERRIDES[["1021", "1201", "1321"][index]], id)
    assert.equal(catalog.wEnginesMap.get(input(id).wEngineId).relatedAgentId, id)
    assert.equal(agent.hidden, false, `${id} is visible on the workbench and optimizer`)
    assert.ok(catalog.displayAgents.some(item => item.id === id), `${id} appears in displayAgents`)
}

// Nekomata and Harumasa follow handbook buff/cinema/disc conventions.
const nekomata = catalog.agentsMap.get("nekomata")
const harumasa = catalog.agentsMap.get("asaba_harumasa")
assert.deepEqual(nekomata.combatBuffs.cinemaBuffs.map(b => b.cinemaLevel), [1, 4, 6])
assert.equal(nekomata.cinemaDescriptions.length, 6)
assert.equal(nekomata.combatBuffs.corePassive.defaultChecked, undefined)
assert.equal(nekomata.combatBuffs.additionalAbility.defaultChecked, undefined)
assert.deepEqual(nekomata.preferredDriveDiscs.defaultSetIds, ["woodpecker_electro", "puffer_electro", "hormone_punk", "fanged_metal"])
assert.equal(nekomata.preferredDriveDiscs.defaultFourPieceBuffRuntimeInputs["driveDisc4pc:woodpecker_electro.self"].effects.effect_k4p9x1nd.coverage, 0.7)
assert.equal(nekomata.preferredDriveDiscs.defaultFourPieceBuffRuntimeInputs["driveDisc4pc:puffer_electro.self"].effects.effect_puffer_electro_4pc_atk_pct.coverage, 0.8)

assert.deepEqual(harumasa.combatBuffs.cinemaBuffs.map(b => b.cinemaLevel), [2, 6])
assert.equal(harumasa.cinemaDescriptions.length, 6)
assert.equal(harumasa.combatBuffs.corePassive.defaultChecked, undefined)
assert.equal(harumasa.combatBuffs.additionalAbility.defaultChecked, undefined)
assert.deepEqual(harumasa.preferredDriveDiscs.defaultSetIds, ["shadow_harmony", "thunder_metal"])

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
assert.deepEqual(imported.skippedAgents, [], "all three agents are open for Enka import")
assert.deepEqual(imported.mappedAgents.map(a => a.agentId), ["nekomata", "asaba_harumasa", "evelyn_chevalier"])
assert.deepEqual(imported.mappedAgents.map(a => a.wEngine.id), ["zzz_wiki_224", "zzz_wiki_991", "zzz_wiki_1159"])
assert.ok(imported.mappedAgents.every(a => a.coreSkillLevel === "F" && a.skillLevels.chain === 12))

// Nekomata: P0 vs P1/P6 default rotations, independent arithmetic, and target exclusions.
for (const potential of [0, 1, 6]) {
    const request = input("nekomata", potential)
    const events = request.damage.events
    const count = (move, row) => events.filter(e => e.skillRef?.moveId === move && (!row || e.skillRef.rowId === row)).reduce((n, e) => n + e.count, 0)
    approx(count("basic_claw", "hit_5"), potential ? 4 : 3, "Nekomata fifth hits")
    assert.equal(count("potential_dodge_counter"), potential ? 2 : 0, "Nekomata potential dodge counter count")
    assert.equal(count("claw_mark"), potential ? 10 : 0, "Nekomata claw mark count")
    assert.equal(count("chain_claw"), potential ? 1 : 2, "Nekomata Chain count")
    assert.equal(count("ex_ambush"), 2, "Nekomata EX count")
    assert.equal(count("ultimate_claw"), potential ? 2 : 1, "Nekomata Ultimate count")
}
// Independent Nekomata arithmetic (P6, C0, Core F, R1 Steel Cushion, no discs):
// Base ATK = 835 + 75 + 684 = 1594; CR = 5 + 14.4 + 24 = 43.4%; CD = 50 + 60 (P6 Meatball) = 110%.
// potential_dodge_counter (Lv12 2527.8%, dodgeCounter): DMG mult = 1 + (20 phys + 60 core + 25 back + 70 Catwalk)/100 = 2.75.
const nekoDodge = event("nekomata", "dodge", "potential_dodge_counter")
const nekoDodgeP6 = calculateEvent("nekomata", 6, nekoDodge)
const nekoDodgeExpected = 1594 * 25.278 * (1 + 0.434 * 1.1) * 2.75 * (794 / (794 + 953)) * 1.5
approx(nekoDodgeP6.damage.totalFinalDamage, nekoDodgeExpected, "independent Nekomata P6 potential dodge counter formula")
// Exclusion: ultimate_claw does NOT receive Catwalk (+70% exSpecial/dodgeCounter) -> DMG mult = 2.05.
const nekoUlt = event("nekomata", "chain", "ultimate_claw")
const nekoUltP6 = calculateEvent("nekomata", 6, nekoUlt)
const nekoUltExpected = 1594 * 31.43 * (1 + 0.434 * 1.1) * 2.05 * (794 / (794 + 953)) * 1.5
approx(nekoUltP6.damage.totalFinalDamage, nekoUltExpected, "Nekomata Ultimate excludes Catwalk")
// P0 Catwalk targets exSpecial (50% coverage = +35%) and excludes dodgeCounter.
const nekoExP0 = calculateEvent("nekomata", 0, event("nekomata", "special", "ex_ambush"))
const nekoExP0Expected = 1594 * 10.798 * (1 + 0.434 * 0.5) * 2.4 * (794 / (794 + 953)) * 1.5
approx(nekoExP0.damage.totalFinalDamage, nekoExP0Expected, "Nekomata P0 EX receives 50% Catwalk")
const nekoDodgeP0 = calculateEvent("nekomata", 0, nekoDodge)
const nekoDodgeP0Expected = 1594 * 25.278 * (1 + 0.434 * 0.5) * 2.05 * (794 / (794 + 953)) * 1.5
approx(nekoDodgeP0.damage.totalFinalDamage, nekoDodgeP0Expected, "Nekomata P0 dodgeCounter excludes Catwalk")

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
approx(dashSet.damage.events[0].multipliers.directDamageBonus - dashBase.damage.events[0].multipliers.directDamageBonus, 0.15, "Shadow Harmony dash bonus")

// Asaba Harumasa: complete skill catalog, P0 vs P1/P6 default rotations, independent arithmetic & exclusions.
for (const potential of [0, 1, 6]) {
    const request = input("asaba_harumasa", potential)
    const result = calculateInCombatPanel(catalog, request)
    const totalRawMultiplier = result.damage.events.reduce((n, e) => n + e.multipliers.skill * e.count, 0)
    approx(totalRawMultiplier, potential ? 142.576 : 125.334, `Harumasa P${potential} default rotation raw multiplier sum`)
    const count = moveId => request.damage.events.filter(e => e.skillRef?.moveId === moveId).reduce((n, e) => n + e.count, 0)
    assert.equal(count("chain_huili"), 2)
    assert.equal(count("dash_hiten_slash"), 12)
    assert.equal(count("chasing_thunder"), potential ? 12 : 0)
    assert.equal(count("ultimate_bloom"), potential ? 1 : 0)
    assert.equal(count("ex_patrol"), potential ? 2 : 0)
    assert.equal(count("ex_ground_net"), potential ? 0 : 2)
    assert.equal(count("basic_falling_feather"), 1)
    assert.equal(count("basic_ha_oto_arrow"), 12)
}
// Independent Harumasa P6 arithmetic for dash_hiten_slash hit_1 (Lv12 325.1%, dashAttack, electric, C0, no discs):
// Base ATK = 840 + 75 + 713 = 1628; P6 in-combat ATK = 1628 * 1.12 = 1823.36.
// CR = 5 + 14.4 + 10 + 10 + 25 (core) = 64.4%; CD = 50 + 48 + 72 (6 Edge) = 170%.
// DMG = 1 + (40 Overclock + 40 signature dashAttack electric)/100 = 1.80; RES = 1 + 0.15 (P6 ignore) = 1.15.
const slash1 = event("asaba_harumasa", "dodge", "dash_hiten_slash", "hit_1")
const slash1P6 = calculateEvent("asaba_harumasa", 6, slash1)
const slash1P6Expected = (1628 * 1.12) * 3.251 * (1 + 0.644 * 1.7) * 1.8 * (794 / (794 + 953)) * 1.15 * 1.5
approx(slash1P6.damage.totalFinalDamage, slash1P6Expected, "independent Harumasa P6 dash_hiten_slash hit_1 formula")
// Verify harumasa-potential-atk scales off outOfCombatAtk (not baseAtk) when discs add +30% ATK%.
const atkDisc = [{ slot: 6, setId: "hormone_punk", mainStat: { stat: "atkPct", value: 30 } }]
const slash1P6WithAtkDisc = calculateEvent("asaba_harumasa", 6, slash1, { driveDiscs: atkDisc })
approx(slash1P6WithAtkDisc.inCombat.panel.atk, 1628 * 1.3 * 1.12, "Harumasa P6 potential ATK scales off outOfCombatAtk")

// Target inclusion & exclusion checks for Harumasa:
// 1. P0 core CR/CD applies to dash_hiten_slash, excludes ultimate_zanshin & ex_ground_net.
const ult = event("asaba_harumasa", "chain", "ultimate_zanshin")
const bloom = event("asaba_harumasa", "chain", "ultimate_bloom")
const thunder = event("asaba_harumasa", "dodge", "chasing_thunder")
const exPatrol = event("asaba_harumasa", "special", "ex_patrol")
const chainHuili = event("asaba_harumasa", "chain", "chain_huili")
const slash1P0 = calculateEvent("asaba_harumasa", 0, slash1)
const slash1P0Expected = 1628 * 3.251 * (1 + 0.644 * 1.7) * 1.8 * (794 / (794 + 953)) * 1.5
approx(slash1P0.damage.totalFinalDamage, slash1P0Expected, "Harumasa P0 dash_hiten_slash gets core CR/CD without P6 RES ignore or ATK")
const u0 = calculateEvent("asaba_harumasa", 0, ult), u1 = calculateEvent("asaba_harumasa", 1, ult), u6 = calculateEvent("asaba_harumasa", 6, ult)
approx(u1.damage.events[0].multipliers.critRate - u0.damage.events[0].multipliers.critRate, 0.25, "P1+ extends core CRIT to ultimate")
approx(u1.damage.events[0].multipliers.critDmg - u0.damage.events[0].multipliers.critDmg, 0.72, "P1+ extends 6 Edge stacks to ultimate")
approx(u6.damage.events[0].multipliers.resistance, 1.0, "ultimate excludes P6 dash/chasing_thunder electricResIgnore")
const bloom6 = calculateEvent("asaba_harumasa", 6, bloom)
approx(bloom6.damage.events[0].multipliers.critRate, 0.644, "ultimate_bloom inherits ultimate core CRIT")
approx(bloom6.damage.events[0].multipliers.resistance, 1.0, "ultimate_bloom excludes P6 electricResIgnore")
// 2. chasing_thunder (逐雷) gets P6 core CR/CD + 15% electricResIgnore, EXCLUDES dashAttack 40% (signature) & 15% (Shadow Harmony 2pc).
const thunderP6 = calculateEvent("asaba_harumasa", 6, thunder)
const thunderP6Expected = (1628 * 1.12) * 0.83 * (1 + 0.644 * 1.7) * 1.4 * (794 / (794 + 953)) * 1.15 * 1.5
approx(thunderP6.damage.totalFinalDamage, thunderP6Expected, "Harumasa P6 chasing_thunder gets core+RES ignore, excludes dashAttack bonus")
approx(calculateEvent("asaba_harumasa", 6, thunder, { driveDiscs: shadowDiscs }).damage.totalFinalDamage,
    thunderP6.damage.totalFinalDamage, "chasing_thunder excludes Shadow Harmony 2pc dashAttack")
// 3. EX Special & Chain exclude core CR/CD and P6 electricResIgnore.
approx(calculateEvent("asaba_harumasa", 1, exPatrol).damage.totalFinalDamage,
    calculateEvent("asaba_harumasa", 0, exPatrol).damage.totalFinalDamage, "EX excludes P1 core CRIT/CD")
approx(calculateEvent("asaba_harumasa", 6, chainHuili).damage.events[0].multipliers.resistance, 1.0, "Chain excludes P6 electricResIgnore")
approx(calculateEvent("asaba_harumasa", 6, chainHuili).damage.events[0].multipliers.critRate, 0.394, "Chain excludes core CRIT")
// 4. Basic Cloud Piercer element split: hits 1-3 physical vs hits 4-5 electric.
const basicPhys = event("asaba_harumasa", "basic", "basic_cloud_piercer_physical", "hit_1")
const basicElec = event("asaba_harumasa", "basic", "basic_cloud_piercer_electric", "hit_4")
const elecDisc = [{ slot: 5, setId: "hormone_punk", mainStat: { stat: "electricDmg", value: 30 } }]
approx(calculateEvent("asaba_harumasa", 6, basicPhys, { driveDiscs: elecDisc }).damage.totalFinalDamage,
    calculateEvent("asaba_harumasa", 6, basicPhys).damage.totalFinalDamage, "Cloud Piercer hits 1-3 are physical and exclude electricDmg")
assert.ok(calculateEvent("asaba_harumasa", 6, basicElec, { driveDiscs: elecDisc }).damage.totalFinalDamage
    > calculateEvent("asaba_harumasa", 6, basicElec).damage.totalFinalDamage, "Cloud Piercer hits 4-5 are electric and receive electricDmg")
// 5. Cinema C2 (+50% dmgBonus on dash_hiten_slash only) and C6 (global 15% electricResIgnore + optional 1500% explosion).
const slash1C2 = calculateEvent("asaba_harumasa", 6, slash1, {}, 2)
approx(slash1C2.damage.events[0].multipliers.directDamageBonus - slash1P6.damage.events[0].multipliers.directDamageBonus, 0.5, "C2 adds +50% dmgBonus to dash_hiten_slash")
approx(calculateEvent("asaba_harumasa", 6, thunder, {}, 2).damage.totalFinalDamage, thunderP6.damage.totalFinalDamage, "C2 excludes chasing_thunder")
approx(calculateEvent("asaba_harumasa", 6, ult, {}, 2).damage.totalFinalDamage, u6.damage.totalFinalDamage, "C2 excludes ultimate")
const slash1C6 = calculateEvent("asaba_harumasa", 6, slash1, {}, 6)
approx(slash1C6.damage.events[0].multipliers.resistance, 1.3, "C6 global 15% stacks with P6 15% electricResIgnore on dash_hiten_slash")
const c6Explosion = event("asaba_harumasa", "cinema", "cinema_6_electromagnetic_explosion")
const c6ExplosionRes = calculateEvent("asaba_harumasa", 6, c6Explosion, {}, 6)
const c6ExplosionExpected = (1628 * 1.12) * 15.0 * (1 + 0.394 * 0.98) * 1.4 * (794 / (794 + 953)) * 1.15 * 1.5
approx(c6ExplosionRes.damage.totalFinalDamage, c6ExplosionExpected, "C6 Electromagnetic Explosion 1500% ATK electric formula")

// Independent Evelyn arithmetic, including an additive multiplier: scaling
// affects the authored multiplier only, never the added 100 percentage points.
const e = event("evelyn_chevalier", "chain", "ultimate_nocturne")
const base = input("evelyn_chevalier", 0)
const modifiers = { activeBuffIds: base.combatBuffs.activeBuffIds, manualStats: [{ stat: "critRate", value: 11.6 }],
    manualEffects: [{ id: "additive-test", effects: [{ id: "additive", type: "fixed", stat: "skillMultiplierBonus", value: 100, mode: "flat", target: { kind: "skill", skillTargets: [{ kind: "skillType", skillType: "ultimate" }] } }] }] }
const independent = calculateEvent("evelyn_chevalier", 0, e, { combatBuffs: modifiers })
// Base ATK 854 + core 75 + engine 713; no discs. CRIT 80%, CD 100%
// (base 50 + engine 50), 30% damage, 25% RES ignore, 150% stun.
const expected = (854 + 75 + 713) * (39.773 * 1.25 + 1) * (1 + 0.8 * 1) * 1.3 * (794 / (794 + 953)) * 1.25 * 1.5
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
console.log("PR81 characters: defaults, independent formulas, exclusions, cinema/potential, maintenance, scoring paths and exhaustive/Node Worker Top 10 passed")
