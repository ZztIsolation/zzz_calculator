import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { GENERATED_HIT_TOTAL_ROW_ID } from "../core/skillMultiplierCandidates.js"
import { buildMeta, damageModifierAppliesTo } from "../core/calculator-core.js"
import { defaultRuntimeForBuff, normalizeRuntimeForBuff, runtimeSourceGroups } from "../core/shared-combat.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { analyzeDriveDiscStatGains } from "../core/driveDiscAnalysis-core.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import { FROZEN_DAN_LUMINESCENCE_EVENT } from "./luminescence-cross-path-fixture.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const ids = {
    core: "roxy.core_crit_damage", stun: "roxy.additional_ability",
    imbued: "roxy.additional_ability", c1: "roxy.cinema_1_res_reduction", c2: "roxy.cinema_2_stun",
}
const normalId = "system.imbuement"
const group = catalog.teammateCombatBuffGroups.find(item => item.id === "roxy")
assert.deepEqual(group.buffs.map(buff => buff.id), [ids.core, ids.stun, ids.c1, ids.c2])
assert.equal(catalog.agentsMap.has("roxy"), false, "Teammate-only import")
assert.equal(group.verification.officialVersion, "1790832594")
for (const buff of group.buffs) {
    assert.deepEqual(validateMaintenanceItem("teammate-buffs", { teammate: group, buff }, {
        ...catalog, teammates: catalog.teammateCombatBuffGroups, currentBuffId: buff.id,
    }), { ok: true, errors: [] })
}
const core = group.buffs[0]
assert.equal(runtimeSourceGroups(core).length, 1, "One shared external CRIT input")
assert.deepEqual(group.buffs.find(buff => buff.id === ids.stun).effects.map(effect => effect.id), ["roxy_additional_stun", "roxy_additional_imbuement"])
assert.equal(defaultRuntimeForBuff(core).effects.roxy_core_crit_dmg.sourceValue, 100)
const meta = buildMeta(catalog)
assert.equal(catalog.combatBuffsMap.get(normalId).sourceKind, "general")
assert.equal(meta.combatBuffs.some(buff => buff.id === normalId), false, "General imbuement stays hidden from display metadata")
assert.equal(meta.teammateCombatBuffGroups.find(item => item.id === "roxy").buffs.length, 4)
const avatar = readFileSync(new URL("../webapp/public/assets/agents/roxy.png", import.meta.url))
assert.equal(avatar.subarray(1, 4).toString(), "PNG")
assert.ok(avatar.readUInt32BE(16) > 0 && avatar.readUInt32BE(20) > 0)

function approx(a, b, label = "parity") {
    assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), label + ": " + a + " != " + b)
}
const total = result => result.damage.totalFinalDamage
function input(agentId, events, activeBuffIds = [], runtimeInputs = {}) {
    const agent = catalog.agentsMap.get(agentId)
    return {
        agentId, coreSkillLevel: "F", cinemaLevel: 0,
        wEngineId: catalog.wEngines.find(item => item.specialty === agent.specialty).id,
        driveDiscs: [], combatBuffs: { activeBuffIds, runtimeInputs },
        damage: { mode: "custom", agentLevel: 60, events, selectedEventId: events[0].id,
            target: { defense: 953, levelCoefficient: 794, stunMultiplierPercent: 150 } },
    }
}
function event(kind = "direct", damageElement = "physical", rest = {}) {
    return { id: kind + "-" + damageElement, kind, damageElement,
        skillMultiplier: 100, critMode: "expected", stunned: false, count: 1, ...rest }
}
function coverageRuntime(id, coverage) {
    const buff = catalog.combatBuffsMap.get(id)
    return { [id]: { effects: Object.fromEntries(buff.effects.map(rule => [rule.id, { coverage }])) } }
}
function coreRuntime(sourceValue, coverage = 1) {
    return { [ids.core]: normalizeRuntimeForBuff(core, {
        effects: { roxy_core_crit_dmg: { sourceValue, coverage }, roxy_core_laceration_dmg: { coverage } },
    }) }
}
const actors = [["pyrois", "direct"], ["yixuan", "sheer"], ["claret", "sharp"]]
for (const [agentId, kind] of actors) {
    for (const element of ["physical", "fire", "ice", "electric", "ether", "wind", ...(kind === "direct" ? ["lumiflux"] : [])]) {
        for (const mode of kind === "sharp" ? ["expected", "nonCrit", "sharpCrit", "lacerationCrit"] : ["expected", "nonCrit", "crit"]) {
            const events = [event(kind, element, { critMode: mode })]
            const baseline = calculateInCombatPanel(catalog, input(agentId, events))
            assert.ok(total(baseline) > 0)
            assert.equal(baseline.damage.multipliers.imbuement, 1)
            for (const [id, bonus] of [[normalId, .1], [ids.imbued, .18]]) {
                for (const coverage of [0, .5, 1]) {
                    const result = calculateInCombatPanel(catalog, input(agentId, events, [id], coverageRuntime(id, coverage)))
                    approx(total(result), total(baseline) * (1 + bonus * coverage), kind + "/" + element + "/" + mode)
                    approx(result.damage.multipliers.imbuement, 1 + bonus * coverage)
                    const row = result.damage.whiteBoxRows.find(row => row.label === "浸染乘区")
                    approx(row.value, 1 + bonus * coverage)
                    assert.ok(result.damage.whiteBoxRows.at(-1).formula.includes(String(Number((1 + bonus * coverage).toFixed(3)))))
                }
            }
            for (const active of [[normalId, ids.imbued], [ids.imbued, normalId]]) {
                const both = calculateInCombatPanel(catalog, input(agentId, events, active))
                approx(total(both), total(baseline) * 1.18, "Same status must not stack")
                const partial = calculateInCombatPanel(catalog, input(agentId, events, active, coverageRuntime(ids.imbued, .5)))
                approx(total(partial), total(baseline) * 1.1, "Take maximum after coverage")
            }
        }
    }
    for (const [source, expectedCrit, expectedSharp] of [[0, 0, 0], [50, .2, .1], [100, .4, .2], [150, .4, .2]]) {
        const events = [event(kind)]
        const base = calculateInCombatPanel(catalog, input(agentId, events))
        const buffed = calculateInCombatPanel(catalog, input(agentId, events, [ids.core], coreRuntime(source)))
        approx(buffed.inCombat.panel.critDmg - base.inCombat.panel.critDmg, kind === "sharp" ? 0 : expectedCrit)
        approx(buffed.inCombat.panel.lacerationDmg - base.inCombat.panel.lacerationDmg, kind === "sharp" ? expectedSharp : 0)
    }
    for (const stunned of [false, true]) {
        const events = [event(kind, "fire", { stunned })]
        for (const [active, stun] of [[[], 1.5], [[ids.stun], 1.8], [[ids.c2], 1.8], [[ids.stun, ids.c2], 2.1]]) {
            const r = calculateInCombatPanel(catalog, input(agentId, events, active))
            approx(r.damage.multipliers.stun, stunned ? stun : 1)
        }
        const r = calculateInCombatPanel(catalog, input(agentId, events, [ids.c1]))
        approx(r.damage.multipliers.resistance, 1.15, "C1 all-element resistance reduction")
    }
}
const apEvent = event("direct", "ether", { damageBasis: "anomalyProficiency" })
const apBase = calculateInCombatPanel(catalog, input("alice_thymefield", [apEvent]))
approx(total(calculateInCombatPanel(catalog, input("alice_thymefield", [apEvent], [normalId]))), total(apBase) * 1.1,
    "Anomaly Proficiency based direct attacks receive imbuement")

const exclusions = [
    ["alice_thymefield", { id: "assault", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault" }],
    ["velina", { id: "wind", kind: "anomaly", settlementType: "attribute", anomalyEffect: "wind_corrosion" }],
    ...["normal", "polarized"].map(disorderType => ["alice_thymefield", {
        id: disorderType, kind: "anomaly", settlementType: "disorder", anomalyEffect: "flinch", disorderType, elapsedSeconds: 0,
    }]),
    ["alice_thymefield", { id: "turbulence", kind: "anomaly", settlementType: "turbulence", anomalyEffect: "burn", elapsedSeconds: 0 }],
    ["vivian", { id: "release", kind: "anomaly", settlementType: "release", anomalyEffect: "burn",
        triggerActorRef: { agentId: "vivian", profileId: catalog.agentsMap.get("vivian").anomalyReleaseProfiles[0].id },
        anomalySource: { actorRef: { agentId: "vivian" } } }],
    ["remielle_dan", FROZEN_DAN_LUMINESCENCE_EVENT],
]
for (const [agentId, e] of exclusions) {
    const baseline = calculateInCombatPanel(catalog, input(agentId, [e]))
    const buffed = calculateInCombatPanel(catalog, input(agentId, [e], [normalId]))
    approx(total(buffed), total(baseline), "Excluded " + e.id)
    assert.equal(buffed.damage.whiteBoxRows.some(row => row.label === "浸染乘区"), false)
    assert.equal(damageModifierAppliesTo({ kind: "imbuementDmgBonus" }, buffed.damage.events[0].input), false)
}

function parity(payload) {
    const prepared = createInCombatPanelCalculator(catalog, payload)
    approx(prepared.scoreOnlyFromSummary(new Map(), new Map()).finalDamage, total(calculateInCombatPanel(catalog, payload)), "Full/prepared")
    const statIds = ["atkPct", "defPct", "critRate", "critDmg", "anomalyProficiency", "penRatio"]
    const dense = prepared.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
    assert.ok(dense)
    for (let i = 0; i < 8; i++) {
        const values = Float64Array.of(.1 * i, .08 * i, .24 * i, .12 * i, 9 * i, .04 * i)
        const stats = new Map(statIds.map((id, n) => [id, values[n]]))
        const expected = prepared.scoreOnlyFromSummaryLegacy(stats, new Map()).finalDamage
        approx(prepared.scoreOnlyFromSummary(stats, new Map()).finalDamage, expected, "Compiled")
        approx(prepared.scoreOnlyFromIndexedSummary(values, statIds, new Int16Array(), []).finalDamage, expected, "Indexed")
        approx(dense.scoreDense(values, new Int16Array()).finalDamage, expected, "Dense")
        const fixed = dense.compileForSetCounts(new Int16Array())
        approx(fixed.scoreScalar(values).finalDamage, expected, "Fixed")
        if (fixed.scoreObjectiveScalar) approx(fixed.scoreObjectiveScalar(values).finalDamage, expected, "Fixed objective")
        if (fixed.scoreCombinedScalar) approx(fixed.scoreCombinedScalar(values.map(v => v / 2), null, values.map(v => v / 2), null).finalDamage, expected, "Combined")
    }
}
for (const [agentId, kind] of actors) {
    for (const extra of [[], [exclusions[0][1]]]) {
        parity(input(agentId, [event(kind), ...extra], Object.values(ids).concat(normalId), {
            ...coverageRuntime(normalId, 1), ...coverageRuntime(ids.imbued, .5), ...coreRuntime(50),
        }))
    }
}
parity(input("alice_thymefield", [apEvent], [normalId, ids.imbued]))
for (const [agentId, e] of exclusions) parity(input(agentId, [e], [normalId]))

// Generated totals must retain child-specific modifiers and apply the status once.
const sigridSkills = catalog.agentSkillsMap.get("sigrid")
const move = sigridSkills.categories.find(c => c.id === "basic").moves.find(m => m.id === "basic_chilling_spearpoint")
const skillEvents = move.rows.filter(row => /^hit_[1-4]$/.test(row.id)).map(row => ({
    ...event(), id: row.id, skillRef: { agentSkillId: "sigrid", categoryId: "basic", moveId: move.id, rowId: row.id },
}))
const generatedEvent = { ...skillEvents[0], id: "total", skillRef: { ...skillEvents[0].skillRef, rowId: GENERATED_HIT_TOTAL_ROW_ID } }
const sigridInput = input("sigrid", [generatedEvent], ["agent:sigrid.cinema.2", ids.imbued])
approx(total(calculateInCombatPanel(catalog, sigridInput)),
    total(calculateInCombatPanel(catalog, { ...sigridInput, damage: { events: skillEvents } })), "Generated sum")
parity(sigridInput)

// Mixed direct/anomaly optimization: compare every returned result with exhaustive search and full calculation.
const main = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["critRate", 24], ["physicalDmg", 30], ["atkPct", 30]]
const store = { version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "默认" }], imports: [], driveDiscLoadouts: [],
    driveDiscs: ["woodpecker_electro", "hormone_punk"].flatMap(setId => [1, 2, 3, 4, 5, 6].flatMap(partition =>
        [0, 1].map(v => ({ id: setId + "-" + partition + "-" + v, ownerId: "default", setId, partition,
            rarity: "S", level: 15, maxLevel: 15,
            mainStat: { stat: main[partition][0], value: main[partition][1] },
            subStats: [{ stat: v ? "anomalyProficiency" : "critDmg", value: v ? 9 * partition : 4.8 * partition }],
        })))) }
const payload = input("alice_thymefield", [event(), exclusions[0][1]], [normalId, ...Object.values(ids)], coreRuntime(50))
const settings = { fourPieceSetId: "woodpecker_electro", twoPieceSetIds: ["hormone_punk"], objective: "damage", topN: 10, mainStatLimits: { 4: ["critRate"], 5: ["physicalDmg"], 6: ["atkPct"] } }
const legacy = optimizeDriveDiscs(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } })
const fast = optimizeDriveDiscs(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-super-bound" } })
const parallel = await optimizeDriveDiscsAsync(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } })
assert.equal(parallel.metrics.workerCount, 2, JSON.stringify(parallel.metrics))
const runtime = createDriveDiscOptimizerRuntime({ availableParallelism: () => 1, yieldControl: async () => {} })
const browser = await runtime.optimizeDriveDiscsAsync(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-super-bound", disableParallel: true } })
for (const result of [fast, parallel, browser]) {
    assert.equal(result.results.length, 10)
    assert.deepEqual(result.results.map(r => r.driveDiscs.map(d => d.id)), legacy.results.map(r => r.driveDiscs.map(d => d.id)))
    result.results.forEach((r, i) => {
        approx(r.score, legacy.results[i].score, "Optimizer Top 10")
        approx(r.score, total(calculateInCombatPanel(catalog, { ...payload, driveDiscs: r.driveDiscs, combatBuffs: { ...payload.combatBuffs, activeBuffIds: [...payload.combatBuffs.activeBuffIds, "driveDisc4pc:" + r.fourPieceSetId + ".self"] } })), "Optimizer full recalc")
    })
}
approx(analyzeDriveDiscStatGains(catalog, payload).baseline.finalDamage,
    total(calculateInCombatPanel(catalog, payload)), "Disc analysis")
console.log("Roxy Buffs, all direct variants, anomaly exclusions, coverage, all kernels, generated totals and Worker Top 10 passed")
