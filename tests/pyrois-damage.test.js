import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { buildMeta } from "../core/calculator-core.js"
import { expandCalculationConfigSkillGroups } from "../core/calculationSkillGroups.js"
import { resolveDefaultCalculationConfig } from "../core/defaultCalculationConfig.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import { analyzeDriveDiscStatGains } from "../core/driveDiscAnalysis-core.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const agent = catalog.agentsMap.get("pyrois")
const skills = catalog.agentSkillsMap.get("pyrois")
const fixture = JSON.parse(readFileSync(new URL("./fixtures/pyrois-source-values.json", import.meta.url)))
const zero = { id: "pyrois_zero", name: { zhCN: "零面板测试音擎" }, specialty: "attack", level60: { atkBase: 0 } }
catalog.wEngines.push(zero)
catalog.wEnginesMap.set(zero.id, zero)
const approx = (a, b, message = "parity") => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${message}: ${a} != ${b}`)
const event = (moveId, categoryId = "chain", options = {}) => ({
    id: moveId, kind: "direct", count: 1, stunned: true, critMode: "expected",
    skillRef: { agentSkillId: "pyrois", categoryId, moveId, rowId: "damage" }, ...options,
})
const ultimateIds = ["total_annihilation", "triumphant_return", "unbound_swordstorm", "eternal_imprisonment"].map(id => `ultimate_${id}`)
const coreId = "agent:pyrois.corePassive"
function input(events, overrides = {}) {
    return { agentId: "pyrois", coreSkillLevel: "F", cinemaLevel: 0, wEngineId: zero.id, driveDiscs: [],
        combatBuffs: { activeBuffIds: [coreId] }, damage: { mode: "custom", events, selectedEventId: events[0]?.id }, ...overrides }
}
const calculate = (events, overrides) => calculateInCombatPanel(catalog, input(events, overrides))
const total = result => result.damage.totalFinalDamage

for (const [kind, item] of [["agents", agent], ["agentSkills", skills], ["wEngines", catalog.wEnginesMap.get("zzz_wiki_2031")]]) {
    assert.deepEqual(validateMaintenanceItem(kind, item, catalog), { ok: true, errors: [] })
}
assert.equal(agent.verification.officialVersion, "1789136408")
for (const source of fixture.rows) {
    const row = skills.categories.find(c => c.id === source.categoryId).moves.find(m => m.id === source.moveId).rows.find(r => r.id === source.rowId)
    assert.deepEqual(row.values, [...source.officialValues, ...source.supplementalValues])
}
assert.equal(fixture.rows.length, 40)
assert.equal(fixture.officialOverrides.length, 3)
assert.equal(buildMeta(catalog).agents.find(a => a.id === "pyrois").cinemaDescriptions.at(-1).modeled, false)
assert.equal(agent.combatBuffs.skillBuffs.length, 0)
assert.equal(agent.combatBuffs.additionalAbility.defaultChecked, true)
assert.match(agent.combatBuffs.corePassive.description.zhCN, /万军诛绝.*凯旋坦途.*无拘剑势.*永陷幽囚/)
assert.match(agent.combatBuffs.corePassive.description.zhCN, /20%\/23\.4%\/26\.8%\/30\.2%\/33\.6%\/37%\/40%/)
assert.match(agent.combatBuffs.corePassive.description.zhCN, /浸染状态.*450%\/525%\/600%\/675%\/750%\/825%\/900%/)
assert.match(agent.combatBuffs.corePassive.description.zhCN, /失衡状态.*1125%\/1312%\/1499%\/1686%\/1873%\/2060%\/2250%/)
assert.equal(agent.combatBuffs.additionalAbility.description.zhCN, "队伍中存在击破或支援角色时，佩洛伊斯的暴击伤害提升40%。")

const base = calculate(ultimateIds.map(id => event(id)))
approx(base.outOfCombat.panel.atk, 924, "core F ATK applied once")
approx(base.outOfCombat.panel.critRate, .194, "core F CRIT applied once")
base.damage.events.forEach((e, i) => approx(e.multipliers.skill, [17.33, 10.714, 28.468, 42.447][i]))
const initial = calculate([event(ultimateIds[0])], { coreSkillLevel: "none" })
approx(initial.outOfCombat.panel.atk, 849)
approx(initial.outOfCombat.panel.critRate, .05)

const light = event("basic_celestial_light", "basic", { skillRef: { agentSkillId: "pyrois", categoryId: "basic", moveId: "basic_celestial_light", rowId: "hit_3" } })
const directive = event("special_assault_directive", "special")
const chain = event("chain_marching_regalia")
for (const [index, level] of ["none", "A", "B", "C", "D", "E", "F"].entries()) {
    for (const stunned of [false, true]) {
        const events = [...ultimateIds.map(id => event(id, "chain", { stunned })), { ...light, stunned }, { ...directive, stunned }, { ...chain, stunned }]
        const result = calculate(events, { coreSkillLevel: level, combatBuffs: { activeBuffIds: [coreId] } })
        const scaling = agent.coreSkill.corePassiveScaling.levels[index]
        result.damage.events.forEach((e, i) => {
            approx(e.multipliers.dmg, 1 + scaling.sunflareDamagePct / 100)
            approx(e.multipliers.critDmg, .5 + (i < 4 && stunned ? .4 : 0), "mirage excludes basic/directive/chain")
            const bonus = i === 2 ? scaling.contaminationMultiplierPct / 100 : i === 3 ? scaling.totalizeMultiplierPct / 100 : 0
            approx(e.multipliers.skillMultiplierBonus, bonus)
            const x = e.multipliers
            approx(e.finalDamage, x.atk * (x.baseSkill + bonus) * (1 + x.critRate * x.critDmg) * x.dmg * x.defense * x.resistance * x.stun, "independent direct damage oracle")
        })
        // Compile the same conditional snapshot through all optimizer scoring kernels.
        const prepared = createInCombatPanelCalculator(catalog, input(events, { coreSkillLevel: level, combatBuffs: { activeBuffIds: [coreId] } }))
        const statIds = ["atkPct", "critRate", "critDmg", "etherDmg", "penRatio"]
        const values = Float64Array.from([.3, .24, .48, .3, .12])
        const stats = new Map(statIds.map((id, i) => [id, values[i]]))
        const dense = prepared.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
        const expected = prepared.scoreOnlyFromSummaryLegacy(stats, new Map()).finalDamage
        approx(prepared.scoreOnlyFromSummary(stats, new Map()).finalDamage, expected, "compiled")
        approx(dense.scoreDense(values, new Int16Array()).finalDamage, expected, "dense")
        const fixed = dense.compileForSetCounts(new Int16Array())
        approx(fixed.scoreScalar(values).finalDamage, expected, "fixed scalar")
        approx(fixed.scoreObjectiveScalar(values).finalDamage, expected, "fixed objective")
        approx(fixed.scoreCombinedScalar(values, null, new Float64Array(values.length), null).finalDamage, expected, "combined")
        approx(prepared.scoreOnlyFromSummary(new Map(), new Map()).finalDamage, total(result), "whitebox parity")
    }
}
const off = calculate(ultimateIds.map(id => event(id, "chain", { stunned: false })))
off.damage.events.forEach((e, i) => approx(e.multipliers.skill, [17.33, 10.714, 28.468, 42.447][i]))
const rightRow = base.damage.events[3].whiteBoxRows.find(row => row.label === "技能倍率")
assert.match(rightRow.formula, /基础倍率 1994.7% \+ 技能倍率加算 2250%/)

for (const id of ultimateIds) {
    const config = expandCalculationConfigSkillGroups({ events: [{ id: "group", kind: "skillGroup", skillGroupId: `${id}_with_directive`, count: 2, stunned: true }] }, agent)
    const ultimateEvent = config.events.find(item => item.skillRef?.moveId === id)
    const directiveEvent = config.events.find(item => item.skillRef?.moveId === "special_assault_directive")
    assert.ok(ultimateEvent, `${id} skill group must retain its ultimate event`)
    assert.equal(ultimateEvent.count, 2)
    if (directiveEvent) {
        assert.equal(directiveEvent.count, 2)
    }
    const result = calculateInCombatPanel(catalog, { ...input([]), damage: config })
    const expectedEvents = [event(id, "chain", { count: 2 })]
    if (directiveEvent) expectedEvents.push({ ...directive, count: 2 })
    approx(total(result), total(calculate(expectedEvents)))
    const higherSpecial = calculateInCombatPanel(catalog, { ...input([]), damage: { ...config, skillLevelsByCategory: { chain: 12, special: 16 } } })
    approx(higherSpecial.damage.events[0].finalDamage, result.damage.events[0].finalDamage)
    if (directiveEvent) {
        approx(higherSpecial.damage.events[1].multipliers.skill, 1.968)
        const higherChain = calculateInCombatPanel(catalog, { ...input([]), damage: { ...config, skillLevelsByCategory: { chain: 16, special: 12 } } })
        approx(higherChain.damage.events[1].finalDamage, result.damage.events[1].finalDamage)
    }
}
for (const group of agent.skillGroups.filter(item => item.id.startsWith("celestial_light_"))) {
    const groupId = group.id
    const cfg = expandCalculationConfigSkillGroups({ events: [{ kind: "skillGroup", skillGroupId: groupId, count: 1, stunned: false }] }, agent)
    assert.equal(cfg.events.length, group.events.length)
    assert.deepEqual(
        cfg.events.map(item => item.skillRef),
        group.events.map(item => item.skillRef),
    )
    const result = calculateInCombatPanel(catalog, { ...input([]), damage: cfg })
    assert.equal(result.damage.events.length, cfg.events.length)
    result.damage.events.forEach(item => assert.ok(Number.isFinite(item.multipliers.skill)))
}
for (const cinemaLevel of [0, 1, 2, 3, 4, 5, 6]) {
    const cfg = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, cinemaLevel)
    if (cfg.skillLevelsByCategory?.chain !== undefined) {
        assert.equal(cfg.skillLevelsByCategory.chain, cinemaLevel >= 5 ? 16 : cinemaLevel >= 3 ? 14 : 12)
    } else {
        assert.equal(agent.defaultCalculationConfig.mode, "custom")
    }
    const result = calculate([event(ultimateIds[0])], { cinemaLevel, combatBuffs: { activeBuffIds: cinemaLevel ? ["agent:pyrois.cinema.1"] : [] } })
    approx(result.inCombat.panel.critRate, .194 + (cinemaLevel ? .08 : 0))
    approx(result.damage.events[0].multipliers.skill, 17.33, "explicit final skill level is not raised twice")
}
approx(calculate([chain], { combatBuffs: { activeBuffIds: ["agent:pyrois.additionalAbility"] } }).inCombat.panel.critDmg, .9)

for (const agentId of ["pyrois", "sigrid"]) {
    for (const modification of [1, 5]) {
        const payload = input([{ kind: "direct", skillMultiplier: 100, damageElement: "ether", stunned: false }], { agentId, wEngineId: "zzz_wiki_2031", wEngineModificationLevel: modification, combatBuffs: { activeBuffIds: ["wEngine:zzz_wiki_2031.self"] } })
        const result = calculateInCombatPanel(catalog, payload)
        approx(result.damage.events[0].targetBreakdown.resistanceMultiplier, agentId === "pyrois" ? 1 + (modification === 1 ? .16 : .22) : 1, "wearer-only ether resistance ignore")
        approx(result.inCombat.panel.critRate - result.outOfCombat.panel.critRate, .2, "shared engine crit")
        const prepared = createInCombatPanelCalculator(catalog, payload)
        approx(prepared.scoreOnlyFromSummary(new Map(), new Map()).finalDamage, total(result), "whitelist compiled")
        const dense = prepared.compileDensePanelScoreTarget({ statIds: [], setIds: [], setIndexById: new Map() })
        approx(dense.compileForSetCounts(new Int16Array()).scoreObjectiveScalar(new Float64Array()).finalDamage, total(result), "whitelist fixed")
    }
}
for (const ids of ["pyrois", [""], ["pyrois", "pyrois"], [null]]) {
    const engine = structuredClone(catalog.wEnginesMap.get("zzz_wiki_2031"))
    engine.effect.selfBuff.effects[1].requirement.agentIds = ids
    assert.equal(validateMaintenanceItem("wEngines", engine, catalog).ok, false)
}

const payload = input([...ultimateIds.map(id => event(id)), directive, light], { wEngineId: "zzz_wiki_2031", combatBuffs: { activeBuffIds: [coreId, "wEngine:zzz_wiki_2031.self"] } })
const gains = analyzeDriveDiscStatGains(catalog, payload)
approx(gains.baseline.finalDamage, total(calculateInCombatPanel(catalog, payload)), "disc analysis")
const main = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["critRate", 24], ["etherDmg", 30], ["atkPct", 30]]
const store = { version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "默认" }], driveDiscLoadouts: [], imports: [], driveDiscs: ["woodpecker_electro", "hormone_punk"].flatMap(setId => [1, 2, 3, 4, 5, 6].map(partition => ({
    id: `${setId}_${partition}`, ownerId: "default", setId, partition, rarity: "S", level: 15, maxLevel: 15,
    mainStat: { stat: main[partition][0], value: main[partition][1] }, subStats: [{ stat: "critDmg", value: setId === "woodpecker_electro" ? 9.6 : 19.2 }],
}))) }
const settings = { fourPieceSetId: "woodpecker_electro", twoPieceSetIds: ["hormone_punk"], objective: "damage", topN: 10 }
const serial = optimizeDriveDiscs(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-legacy" } })
const parallel = await optimizeDriveDiscsAsync(catalog, store, { ...payload, settings: { ...settings, algorithm: "exact-super-bound-parallel", workerCount: 2 } })
assert.equal(parallel.metrics.workerCount, 2)
assert.equal(parallel.results.length, serial.results.length)
parallel.results.forEach((r, i) => approx(r.score, serial.results[i].score, "worker optimizer"))
assert.equal(parallel.results.length, 10)
console.log("Pyrois official data, four branches, conditions, groups, all scoring kernels and Worker optimizer passed")
