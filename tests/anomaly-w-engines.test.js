import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildMeta, calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext, materializeWEngineForModificationLevel } from "../backend/calculator.js"
import { optimizeDriveDiscs } from "../backend/driveDiscOptimizer.js"
import { cleanMaintenanceItem } from "../backend/server.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { defaultRuntimeForBuff, materializeWEngineForModificationLevel as frontendMaterialize, runtimeStackGroups, storedEffectRulesText } from "../core/shared-combat.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(root)
const meta = buildMeta(catalog)
const clone = value => JSON.parse(JSON.stringify(value))
const entries = [
    ["zzz_wiki_1964", "朔月裁霜", "S", 713, "anomalyMastery", 30, "终末裁决", [[20, 23, 26, 29, 32], [35, 38.5, 42, 45.5, 50]]],
    ["zzz_wiki_841", "灼心摇壶", "S", 713, "atkPct", 30, "焦油斟注", [[3.5, 4.4, 5.2, 6.1, 7], [50, 62, 75, 87, 100]]],
    ["zzz_wiki_2087", "咚哒回声", "A", 594, "anomalyProficiency", 75, "铿锵鸣鼔", [[11.5, 13.2, 15, 16.7, 18.4]]],
    ["zzz_wiki_154", "雨林饕客", "A", 594, "anomalyProficiency", 75, "开饭了！", [[2.5, 2.8, 3.2, 3.6, 4]]],
]
const engine = id => catalog.wEnginesMap.get(id)
function approx(actual, expected, label) {
    assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-12), `${label}: ${actual} != ${expected}`)
}

for (const [id, name, rarity, atk, stat, value, effectName, ranks] of entries) {
    const item = engine(id)
    assert.equal(catalog.wEngines.filter(w => w.id === id || w.name.zhCN === name).length, 1)
    assert.deepEqual([item.name.zhCN, item.rarity, item.specialty, item.level60.atkBase, item.level60.advancedStat.stat, item.level60.advancedStat.value, item.effect.name.zhCN], [name, rarity, "anomaly", atk, stat, value, effectName])
    assert.equal(item.relatedAgentId, undefined)
    assert.equal(item.effect.teamBuff, null)
    assert.equal(item.effect.selfBuff.appliesToOutOfCombatPanel, false)
    assert.deepEqual(item.modification, { minLevel: 1, maxLevel: 5, defaultLevel: 1 })
    assert.ok(item.sources.some(url => url.includes(`/content/${id.slice(9)}/detail`)))
    assert.match(item.verification.effectText, /version-\d+-2026-09-30/)
    const icon = fs.readFileSync(path.join(root, "webapp/public", item.images.icon))
    assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
    const cleaned = cleanMaintenanceItem("w-engines", clone(item))
    assert.deepEqual(cleaned.effect.selfBuff.effects, item.effect.selfBuff.effects, `${name} maintenance roundtrip`)
    assert.equal(validateMaintenanceItem("w-engines", cleaned).ok, true, `${name} validation`)
    item.effect.selfBuff.effects.forEach((rule, index) => {
        assert.deepEqual(rule.coverage, { default: 1, min: 0, max: 1, step: 0.1 })
        const key = rule.activationStacks !== undefined || rule.type === "fixed" ? "value" : "valuePerStack"
        assert.deepEqual(rule.modificationValues[key], ranks[index])
        for (let level = 1; level <= 5; level++) {
            approx(materializeWEngineForModificationLevel(item, level).effect.selfBuff.effects[index][key], ranks[index][level - 1], `${name} rank ${level}`)
            approx(frontendMaterialize(item, level).effect.selfBuff.effects[index][key], ranks[index][level - 1], `${name} frontend rank ${level}`)
        }
    })
}

// No maintained Ice Anomaly agent has a Release profile. Adapt an existing
// profile in memory to test the future wearer's real calculation paths without
// adding a character to the production catalog or bypassing the attribute gate.
const iceCatalog = clone(catalog)
delete iceCatalog.agentsMap
delete iceCatalog.wEnginesMap
delete iceCatalog.driveDiscSetsMap
iceCatalog.agents.find(a => a.id === "aria").attribute = "ice"
iceCatalog.agents.find(a => a.id === "remielle_dan").attribute = "ice"

function input(id, { level = 1, stacks, coverage = 1, active = true, agentId = "aria", damage } = {}) {
    const buffId = `wEngine:${id}.self`
    const rules = engine(id).effect.selfBuff.effects
    return {
        agentId, coreSkillLevel: "none", cinemaLevel: 0, wEngineId: id,
        wEngineModificationLevel: level, driveDiscs: [],
        combatBuffs: {
            activeBuffIds: active ? [buffId] : [],
            runtimeInputs: { [buffId]: { coverage, effects: stacks === undefined ? {} : { [rules[0].id]: { stacks } } } },
        },
        damage: damage ?? clone(catalog.agentsMap.get(agentId).defaultCalculationConfig ?? { events: [{ id: "direct", kind: "direct", skillMultiplier: 100, count: 1 }], selectedEventId: "direct" }),
    }
}
const run = (id, options, context = catalog) => calculateInCombatPanel(context, input(id, options))
function parity(context, request) {
    const calc = createInCombatPanelCalculator(context, request)
    const full = calc.calculate([], { round: false })
    const expected = full.damage.totalFinalDamage ?? full.damage.finalDamage
    assert.ok(expected > 0, "Parity must exercise a real positive damage event")
    const dense = calc.compileDensePanelScoreTarget({ statIds: [], setIds: [], setIndexById: new Map() })
    assert.ok(dense, "New rules must compile for optimizer scoring")
    const fixed = dense.compileForSetCounts([])
    const summaries = [calc.scoreOnlyFromSummary(new Map(), new Map()), calc.scoreOnlyFromSummaryLegacy(new Map(), new Map()), dense.scoreDense([], []), fixed.scoreScalar([])]
    if (fixed.scoreObjectiveScalar) summaries.push(fixed.scoreObjectiveScalar([]))
    for (const result of summaries) {
        approx(result.finalDamage, expected, `${request.wEngineId} score parity`)
    }
    approx(calculateInCombatPanel(context, clone(request)).damage.totalFinalDamage, calculateInCombatPanel(context, request).damage.totalFinalDamage, "Persisted runtime inputs preserve the result")
}

for (const id of ["zzz_wiki_1964", "zzz_wiki_841", "zzz_wiki_154"]) {
    const groups = runtimeStackGroups(engine(id).effect.selfBuff)
    assert.equal(groups.length, 1, `${id} must expose one stack control`)
    assert.equal(groups[0].ruleIds.length, engine(id).effect.selfBuff.effects.length)
    assert.equal(groups[0].defaultStacks, groups[0].maxStacks)
}

for (let level = 1; level <= 5; level++) {
    for (const stacks of [0, 1, 2]) {
        for (const coverage of [0, 0.5, 1]) {
            const options = { level, stacks, coverage }
            const result = run("zzz_wiki_1964", options, iceCatalog)
            approx(result.inCombat.buffTotals.iceDmg, [20, 23, 26, 29, 32][level - 1] * stacks * coverage / 100, "Ice damage stacks")
            approx(result.damage.events[0].multipliers.anomalyDamage, 1 + (stacks === 2 ? [35, 38.5, 42, 45.5, 50][level - 1] * coverage / 100 : 0), "Release bonus is fixed at two stacks")
            approx(run("zzz_wiki_1964", options).damage.events[0].multipliers.anomalyDamage, 1, "Non-Ice wearer gets no Release bonus")
            parity(iceCatalog, input("zzz_wiki_1964", options))
        }
    }
    for (const stacks of [0, 4, 5, 10]) {
        for (const coverage of [0, 0.5, 1]) {
            const options = { level, stacks, coverage }
            const result = run("zzz_wiki_841", options)
            approx(result.outOfCombat.bonusTotals.atkPct, 0.3, "Advanced ATK is a base-ATK percentage")
            approx(result.inCombat.buffTotals.dmgBonus, [3.5, 4.4, 5.2, 6.1, 7][level - 1] * stacks * coverage / 100, "Tar damage stacks")
            approx(result.inCombat.buffTotals.anomalyProficiencyFlat, stacks >= 5 ? [50, 62, 75, 87, 100][level - 1] * coverage : 0, "Tar AP threshold must not multiply by stacks")
            approx(result.inCombat.panel.energyRegen, result.outOfCombat.panel.energyRegen, "Flat off-field energy is not percentage regen")
            parity(catalog, input("zzz_wiki_841", options))
        }
    }
    for (const coverage of [0, 0.5, 1]) {
        for (const active of [false, true]) {
            const options = { level, coverage, active }
            const result = run("zzz_wiki_2087", options)
            approx(result.inCombat.buffTotals.dmgBonus, active ? [11.5, 13.2, 15, 16.7, 18.4][level - 1] * coverage / 100 : 0, "Echo damage needs no Wind/Turbulence prerequisite")
            approx(result.inCombat.panel.energyRegen, result.outOfCombat.panel.energyRegen, "Triggered energy is not percentage regen")
            parity(catalog, input("zzz_wiki_2087", options))
        }
    }
    for (const stacks of [0, 1, 10]) {
        const options = { level, stacks }
        const result = run("zzz_wiki_154", options)
        approx(result.inCombat.panel.atk - result.outOfCombat.panel.atk, result.outOfCombat.panel.atk * [2.5, 2.8, 3.2, 3.6, 4][level - 1] * stacks / 100, "Rainforest scales out-of-combat ATK")
        parity(catalog, input("zzz_wiki_154", options))
    }
}

for (const settlementType of ["attribute", "disorder", "turbulence"]) {
    const damage = { events: [{ id: "isolation", kind: "anomaly", settlementType, anomalyEffect: "corruption", elapsedSeconds: 0, count: 1, stunned: false }], selectedEventId: "isolation" }
    const request = input("zzz_wiki_1964", { damage })
    approx(calculateInCombatPanel(iceCatalog, request).damage.events[0].multipliers.anomalyDamage, 1, `Release bonus must not leak into ${settlementType}`)
    parity(iceCatalog, request)
}
const luminescence = run("zzz_wiki_1964", { agentId: "remielle_dan" }, iceCatalog)
approx(luminescence.damage.events[0].multipliers.luminescenceDamage, 1, "Release bonus must not leak into Luminescence")
parity(iceCatalog, input("zzz_wiki_1964", { agentId: "remielle_dan" }))
for (const [id] of entries) {
    const off = run(id, { active: false })
    const on = run(id, {})
    assert.deepEqual(on.outOfCombat.panel, off.outOfCombat.panel, "Passive Buffs must never enter the initial panel")
    const wrong = run(id, { agentId: "anby_demara" })
    for (const key of ["dmgBonus", "iceDmg", "anomalyProficiencyFlat", "atkPctOutOfCombat"]) approx(wrong.inCombat.buffTotals[key], 0, "Specialty mismatch rejects passive effects")
}
const frost = run("zzz_wiki_1964", { agentId: "hoshimi_miyabi" })
approx(frost.inCombat.buffTotals.iceDmg, 0, "Frost is not silently treated as an Ice wearer")
assert.match(engine("zzz_wiki_841").effect.description.zhCN, /0\.6\/0\.75\/0\.9\/1\.05\/1\.2点\/秒/)
assert.match(engine("zzz_wiki_2087").effect.description.zhCN, /2\/2\.3\/2\.6\/2\.9\/3\.2点能量，10秒/)
assert.match(engine("zzz_wiki_154").effect.description.zhCN, /每层效果单独结算持续时间/)
const preview = frontendMaterialize(engine("zzz_wiki_841"), 5)
const runtime = defaultRuntimeForBuff(preview.effect.selfBuff)
assert.match(storedEffectRulesText(preview.effect.selfBuff, runtime, meta), /100/)

// Small complete inventory: compare optimizer Top 10 against exhaustive legacy
// scoring, then verify every returned loadout through the ordinary calculator.
const driveDiscs = []
const mains = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["anomalyProficiency", 92], ["etherDmg", 30], ["atkPct", 30]]
for (let slot = 1; slot <= 6; slot++) {
    for (let variant = 0; variant < 2; variant++) {
        driveDiscs.push({ id: `${slot}-${variant}`, ownerId: "default", partition: slot, setId: slot <= 4 ? "woodpecker_electro" : "hormone_punk", rarity: "S", level: 15, maxLevel: 15, mainStat: { stat: mains[slot][0], value: mains[slot][1], mode: slot >= 5 ? "pct" : "flat" }, subStats: [{ stat: "anomalyProficiency", value: 9 + variant * 9, mode: "flat" }, { stat: "atkFlat", value: 19 + (1 - variant) * 38, mode: "flat" }].filter(s => s.stat !== mains[slot][0]), source: { type: "test", sequence: slot * 10 + variant } })
    }
}
const store = { version: 1, owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [], driveDiscs }
for (const [id] of entries) {
    const context = id === "zzz_wiki_1964" ? iceCatalog : catalog
    const request = { ...input(id, { level: 5 }), settings: { fourPieceSetId: "woodpecker_electro", twoPieceSetId: "hormone_punk", algorithm: "exact-super-bound", objective: "damage", mainStatLimits: { 4: ["anomalyProficiency"], 5: ["etherDmg"], 6: ["atkPct"] } } }
    const fast = optimizeDriveDiscs(context, store, request)
    const truth = optimizeDriveDiscs(context, store, { ...request, settings: { ...request.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } })
    assert.equal(fast.results.length, 10)
    assert.deepEqual(fast.results.map(row => row.driveDiscIdsBySlot), truth.results.map(row => row.driveDiscIdsBySlot))
    fast.results.forEach((row, index) => {
        approx(row.score, truth.results[index].score, "Exact optimizer rank score")
        const full = calculateInCombatPanel(context, {
            ...request,
            driveDiscs: row.driveDiscs.map(disc => ({ ...disc, slot: disc.partition })),
            combatBuffs: { ...request.combatBuffs, activeBuffIds: [...request.combatBuffs.activeBuffIds, "driveDisc4pc:woodpecker_electro.self", "driveDisc4pc:woodpecker_electro.team"] },
        })
        approx(row.score, full.damage.totalFinalDamage, "Ordinary calculation of optimized loadout")
    })
}
console.log("Four anomaly W-Engine catalog, thresholds, settlement isolation, score kernels and optimizer tests passed")
