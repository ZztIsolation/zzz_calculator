import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    loadCalculatorContext,
    materializeWEngineForModificationLevel,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const attackEngines = catalog.wEngines.filter(item => item.specialty === "attack")

const expected = [
    ["cloudcleave_radiance", "云霓孤光", "S", 743, "critDmg", 48, "玉魄冰心"],
    ["zzz_wiki_114", "「月相」-晦", "B", 475, "atkPct", 20, "残月"],
    ["zzz_wiki_117", "「月相」-朔", "B", 475, "critRate", 15.9, "新月"],
    ["zzz_wiki_118", "「月相」-望", "B", 475, "atkPct", 20, "满月"],
    ["zzz_wiki_156", "星徽引擎", "A", 594, "atkPct", 25, "骑士连打"],
    ["zzz_wiki_211", "防暴者Ⅵ型", "S", 713, "critDmg", 48, "安全巡查"],
    ["zzz_wiki_221", "加农转子", "A", 594, "critRate", 20, "口径超规"],
    ["zzz_wiki_222", "街头巨星", "A", 594, "atkPct", 25, "火热腔调"],
    ["zzz_wiki_223", "硫磺石", "S", 684, "atkPct", 30, "炽烈吐息"],
    ["zzz_wiki_224", "钢铁肉垫", "S", 684, "critRate", 24, "合金猫爪"],
    ["zzz_wiki_225", "深海访客", "S", 713, "critRate", 24, "诸洋之王"],
    ["zzz_wiki_263", "仿制星徽引擎", "A", 624, "atkPct", 25, "骑士光波：改"],
    ["zzz_wiki_264", "家政员", "A", 624, "atkPct", 25, "安心家用轮锯"],
    ["zzz_wiki_265", "旋钻机-赤轴", "A", 624, "energyRegen", 50, "红莲电机"],
    ["zzz_wiki_744", "鎏金花信", "A", 594, "atkPct", 25, "超规防盗措施"],
    ["zzz_wiki_991", "残心青囊", "S", 713, "critDmg", 48, "啖若逆修"],
    ["zzz_wiki_995", "强音热望", "A", 594, "critRate", 20, "躁动全场"],
    ["zzz_wiki_1159", "心弦夜响", "S", 713, "critRate", 24, "弦音相随"],
    ["zzz_wiki_1197", "牺牲洁纯", "S", 713, "critDmg", 48, "光静花冷"],
    ["zzz_wiki_1305", "千面日陨", "S", 713, "critRate", 24, "万千非我"],
    ["zzz_wiki_1553", "机巧心种", "S", 713, "critRate", 24, "芽生炉心"],
    ["zzz_wiki_1586", "嚣枪喧焰", "S", 713, "energyRegen", 60, "喋声吞炎"],
    ["zzz_wiki_1941", "鳞齿寻踪", "S", 713, "energyRegen", 60, "仿生毒素"],
    ["zzz_wiki_2031", "日冕遗蜕", "S", 713, "atkPct", 30, "日蚀效应"],
]

function textOf(value) {
    return value?.zhCN ?? ""
}

function engine(id) {
    return attackEngines.find(item => item.id === id)
}

function rules(id) {
    return engine(id)?.effect?.selfBuff?.effects ?? []
}

function approx(actual, expectedValue, message) {
    assert.ok(Math.abs(Number(actual) - expectedValue) < 1e-9, `${message}: expected ${expectedValue}, got ${actual}`)
}

assert.equal(attackEngines.length, 24, "Official Attack W-Engine catalog should contain 24 entries")
assert.equal(new Set(attackEngines.map(item => textOf(item.name))).size, 24, "Attack W-Engine names should be unique")
assert.deepEqual(
    Object.fromEntries(["B", "A", "S"].map(rarity => [rarity, attackEngines.filter(item => item.rarity === rarity).length])),
    { B: 3, A: 8, S: 13 },
    "Official rarity distribution should remain 3 B / 8 A / 13 S",
)

for (const [id, name, rarity, atkBase, stat, value, effectName] of expected) {
    const item = engine(id)
    assert.ok(item, `${name} should exist as ${id}`)
    assert.equal(textOf(item.name), name, `${id} should keep the official Chinese name`)
    assert.equal(item.rarity, rarity, `${name} should keep the official rarity`)
    assert.equal(item.level60.atkBase, atkBase, `${name} should keep the official level 60 Base ATK`)
    assert.equal(item.level60.advancedStat.stat, stat, `${name} should keep the official advanced stat`)
    approx(item.level60.advancedStat.value, value, `${name} advanced stat`)
    assert.equal(textOf(item.effect.name), effectName, `${name} should keep the official effect name`)
    assert.equal(item.effect.requirement.specialty, "attack", `${name} should require Attack specialty`)
    assert.ok(item.effect.description.zhCN, `${name} should keep the full official effect text`)
    assert.ok(item.sources.includes("https://baike.mihoyo.com/zzz/wiki/channel/map/2/45"), `${name} should cite the official channel`)
    assert.ok(item.sources.some(source => source.includes("baike.mihoyo.com/zzz/wiki/content/")), `${name} should cite its official detail page`)

    const iconPath = path.join(rootDir, "webapp", "public", item.images.icon.replace(/^\/assets\//, "assets/"))
    assert.ok(fs.existsSync(iconPath), `${name} official icon should exist`)
    assert.equal(fs.readFileSync(iconPath).subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} icon should be PNG`)

    if (item.relatedAgentId) {
        assert.ok(catalog.agents.some(agent => agent.id === item.relatedAgentId), `${name} relatedAgentId should reference an existing agent`)
    }

    for (const rule of item.effect.selfBuff?.effects ?? []) {
        const valueKey = rule.type === "stacked" ? "valuePerStack" : "value"
        const rankValues = rule.modificationValues?.[valueKey]
        if (!rankValues) continue
        assert.equal(rankValues.length, 5, `${name} ${rule.id} should store five exact modification values`)
        for (let level = 1; level <= 5; level += 1) {
            const materialized = materializeWEngineForModificationLevel(item, level)
            const materializedRule = materialized.effect.selfBuff.effects.find(candidate => candidate.id === rule.id)
            approx(materializedRule[valueKey], rankValues[level - 1], `${name} ${rule.id} modification ${level}`)
        }
    }
}

const agentIds = new Set(catalog.agents.map(item => item.id))
assert.deepEqual(
    attackEngines.filter(item => item.relatedAgentId).map(item => [item.id, item.relatedAgentId]),
    [["cloudcleave_radiance", "ye_shunguang"]],
    "Only the currently maintained Attack agent should receive a relatedAgentId",
)
assert.ok(agentIds.has("ye_shunguang"))

assert.equal(engine("zzz_wiki_117").effect.selfBuff, null, "Fixed Energy restoration should not be misrepresented as Energy Regen")
assert.deepEqual(rules("zzz_wiki_221").map(rule => rule.stat), ["atkPct"], "Cannon Rotor proc damage should not be converted into a generic damage Buff")
assert.deepEqual(rules("zzz_wiki_264").map(rule => rule.stat), ["physicalDmg"], "Housekeeper flat Energy per second should remain text-only")
assert.equal(rules("zzz_wiki_211").find(rule => rule.id.includes("charged"))?.type, "fixed", "Riot Suppressor charges should not multiply the per-hit bonus")
assert.equal(rules("zzz_wiki_211").find(rule => rule.id.includes("charged"))?.stat, "etherDmg", "Riot Suppressor charged hit should remain Ether-only")
assert.equal(rules("zzz_wiki_1941").find(rule => rule.stat === "electricDefIgnore")?.type, "fixed", "Spectral Gaze duration extension should not multiply DEF Ignore")
assert.match(rules("zzz_wiki_2031").find(rule => rule.stat === "etherResIgnore")?.condition ?? "", /佩洛伊斯/, "Corona Husk should preserve its wearer restriction")

const cloudRules = rules("cloudcleave_radiance")
assert.equal(cloudRules.find(rule => rule.stat === "physicalResIgnore")?.condition, undefined, "Cloudcleave Physical RES Ignore should be unconditional")
assert.equal(cloudRules.find(rule => rule.stat === "dmgBonus")?.condition, "开启以太帷幕", "Cloudcleave damage bonus should require Ether Veil")
assert.equal(cloudRules.find(rule => rule.stat === "critDmg")?.durationSeconds, 40, "Cloudcleave conditional CRIT DMG should retain its duration")

assert.deepEqual(
    rules("zzz_wiki_114")[0].target.skillTargets.map(target => target.skillType),
    ["chain", "ultimate"],
    "Waning Moon should target Chain Attacks and Ultimates",
)
assert.deepEqual(
    rules("zzz_wiki_265")[0].target.skillTargets,
    [{ kind: "skillType", skillType: "basic" }, { kind: "skillTag", skillTag: "dashAttack" }],
    "Drill Rig should target Basic and Dash Attacks without broadening to all Dodge moves",
)

const baseInput = catalog.examples.yeShunguang.input
const brimstone = calculateInCombatPanel(catalog, {
    ...baseInput,
    wEngineId: "zzz_wiki_223",
    wEngineModificationLevel: 5,
    combatBuffs: { activeBuffIds: ["wEngine:zzz_wiki_223.self"] },
})
approx(brimstone.inCombat.buffTotals.atkPctOutOfCombat, 0.56, "Brimstone rank 5 should apply eight exact ATK stacks")

const deepSeaVisitor = calculateInCombatPanel(catalog, {
    ...baseInput,
    wEngineId: "zzz_wiki_225",
    wEngineModificationLevel: 5,
    combatBuffs: { activeBuffIds: ["wEngine:zzz_wiki_225.self"] },
})
approx(deepSeaVisitor.inCombat.buffTotals.iceDmg, 0.5, "Deep Sea Visitor rank 5 should apply exact Ice DMG")
approx(deepSeaVisitor.inCombat.buffTotals.critRate, 0.4, "Deep Sea Visitor rank 5 should allow both independent CRIT Rate Buffs")

console.log("attack W-Engine catalog tests passed")
