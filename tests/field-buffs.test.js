import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

const FIELD_BUFF_IDS = {
    zhongmu: "field.defense_v5.v3_0.p3.zhongmu_xiezou",
    lianshi: "field.defense_v5.v3_0.p3.lianshi_huilu",
    lingdu: "field.defense_v5.v3_0.p3.lingdu_xingdong",
    yanwang: "field.critical_assault.v3_0.p3.yanwang",
    linxi: "field.critical_assault.v3_0.p3.linxi",
    gouxi: "field.critical_assault.v3_0.p3.gouxi",
}

const EFFECT_IDS = {
    lianshiRes: "field_defense_v5_v3_0_p3_lianshi_anomaly_res_ignore",
    yanwangAtk: "field_critical_assault_v3_0_p3_yanwang_chain_atk",
    linxiRes: "field_critical_assault_v3_0_p3_linxi_enemy_res_reduction",
    linxiAnomaly: "field_critical_assault_v3_0_p3_linxi_anomaly_damage",
    gouxiAnomalyDef: "field_critical_assault_v3_0_p3_gouxi_anomaly_def_reduction",
    gouxiDisorderDef: "field_critical_assault_v3_0_p3_gouxi_disorder_def_reduction",
}

const EXPECTED_NAMES = {
    [FIELD_BUFF_IDS.zhongmu]: "终幕协奏",
    [FIELD_BUFF_IDS.lianshi]: "链式回路",
    [FIELD_BUFF_IDS.lingdu]: "零度行动",
    [FIELD_BUFF_IDS.yanwang]: "湮亡",
    [FIELD_BUFF_IDS.linxi]: "凛息",
    [FIELD_BUFF_IDS.gouxi]: "构析",
}

const ALL_RES_IGNORE_BUFF_IDS = [
    "liuyin.cinema_1.good_review_res_ignore",
    "lucia_elowen.cinema_1_dream_song_res_ignore",
    "field.defense_v5.v3_0.p2.jijing_chefeng",
    FIELD_BUFF_IDS.yanwang,
]
const ELEMENT_RES_IGNORE_STATS = new Set([
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
])

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(Number(actual) - Number(expected)) < 1e-6,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

function fieldBuff(id) {
    const buff = catalog.combatBuffs.find(item => item.id === id)
    assert.ok(buff, `Field Buff should exist: ${id}`)
    return buff
}

for (const id of Object.values(FIELD_BUFF_IDS)) {
    const buff = fieldBuff(id)
    assert.equal(buff.name?.zhCN, EXPECTED_NAMES[id], `${id} should keep its maintained name`)
    assert.equal(buff.sourceType, "field", `${id} should be a field Buff`)
    assert.equal(buff.scope, "inCombat", `${id} should be an in-combat Buff`)
    const isDefense = [FIELD_BUFF_IDS.zhongmu, FIELD_BUFF_IDS.lianshi, FIELD_BUFF_IDS.lingdu].includes(id)
    assert.deepEqual(buff.period, {
        modeId: isDefense ? "defense_v5" : "critical_assault",
        gameVersion: "3.0",
        phaseNo: 3,
        phaseName: { zhCN: "第三期" },
    })
    assert.equal(buff.source?.zhCN, isDefense ? "防卫战 v5" : "危局强袭战")
    assert.equal(buff.sourcePeriod?.zhCN, "3.0版本第三期")

    const validation = validateMaintenanceItem("field-buffs", buff, {
        items: catalog.combatBuffs,
        currentId: id,
        agentSkills: catalog.agentSkills,
    })
    assert.equal(validation.ok, true, `${id} should pass field Buff validation: ${JSON.stringify(validation.errors)}`)
}

assert.equal(
    fieldBuff(FIELD_BUFF_IDS.zhongmu).description.zhCN,
    "代理人的[终结技]、[连携技]造成的伤害提升40%。[连携技]命中敌人后，其失衡易伤倍率提升20%，失衡恢复速度降低15%，持续15秒，重复触发时刷新持续时间。",
    "Zhongmu should preserve the complete source text, including the descriptive-only stun recovery clause",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.lianshi).description.zhCN,
    "代理人的异常精通提升20点，造成的属性异常伤害提升15%。若队伍内有1名/2名[异常]特性的代理人，代理人的属性异常伤害命中敌人时无视其5%/15%全属性伤害抗性。",
    "Lianshi should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.lingdu).description.zhCN,
    "代理人的冰属性伤害和以太属性伤害提升30%。代理人的[普通攻击]和[连携技]造成的伤害提升20%，造成的暴击伤害提升35%。",
    "Lingdu should preserve the complete source text",
)

const allCatalogBuffs = [
    ...(catalog.combatBuffs ?? []),
    ...(catalog.teammateCombatBuffs ?? []),
]
for (const id of ALL_RES_IGNORE_BUFF_IDS) {
    const buff = allCatalogBuffs.find(item => item.id === id)
    assert.ok(buff, `All-attribute RES-ignore Buff should exist: ${id}`)
    assert.deepEqual(
        buff.effects.filter(effect => effect.stat === "allResIgnore" || ELEMENT_RES_IGNORE_STATS.has(effect.stat))
            .map(effect => effect.stat),
        ["allResIgnore"],
        `${id} should store all-attribute RES ignore as one rule`,
    )
}

const miyabiInput = {
    agentId: "hoshimi_miyabi",
    wEngineId: "hailfall_star_palace",
    driveDiscs: [],
}

const miyabiSkillRefs = {
    basic: {
        agentSkillId: "hoshimi_miyabi",
        categoryId: "basic",
        moveId: "frost_moon",
        rowId: "charge_3",
        level: 12,
    },
    chain: {
        agentSkillId: "hoshimi_miyabi",
        categoryId: "chain",
        moveId: "chain_spring_arrival",
        rowId: "damage",
        level: 12,
    },
    ultimate: {
        agentSkillId: "hoshimi_miyabi",
        categoryId: "chain",
        moveId: "ultimate_lingering_snow",
        rowId: "damage",
        level: 12,
    },
}

function iceTarget() {
    return {
        defense: 953,
        levelCoefficient: 794,
        resistanceByElement: { ice: 20 },
    }
}

function calculateSkill(fieldBuffId, skillRef, runtime = {}) {
    return calculateInCombatPanel(catalog, {
        ...miyabiInput,
        combatBuffs: {
            activeBuffIds: [fieldBuffId],
            runtimeInputs: {
                [fieldBuffId]: runtime,
            },
        },
        damage: {
            skillRef,
            target: iceTarget(),
        },
    })
}

const yanwangOneStackRuntime = {
    effects: {
        [EFFECT_IDS.yanwangAtk]: { stacks: 1 },
    },
}
const yanwangChain = calculateSkill(FIELD_BUFF_IDS.yanwang, miyabiSkillRefs.chain, yanwangOneStackRuntime)
approx(
    yanwangChain.inCombat.panel.atk - yanwangChain.outOfCombat.panel.atk,
    yanwangChain.outOfCombat.panel.atk * 0.1,
    "Yanwang one shared stack should grant 10% of out-of-combat ATK",
)
approx(
    yanwangChain.inCombat.panel.critDmg - yanwangChain.outOfCombat.panel.critDmg,
    0.15,
    "Yanwang one shared stack should grant 15% CRIT DMG",
)
approx(yanwangChain.damage.targetBreakdown.resIgnore, 0.3, "Yanwang should grant Chain Attack 30% all-attribute RES ignore")

const yanwangUltimate = calculateSkill(FIELD_BUFF_IDS.yanwang, miyabiSkillRefs.ultimate, yanwangOneStackRuntime)
approx(yanwangUltimate.damage.targetBreakdown.resIgnore, 0.3, "Yanwang should grant Ultimate 30% all-attribute RES ignore")

const yanwangBasic = calculateSkill(FIELD_BUFF_IDS.yanwang, miyabiSkillRefs.basic, yanwangOneStackRuntime)
approx(yanwangBasic.damage.targetBreakdown.resIgnore, 0, "Yanwang should not grant Basic Attack RES ignore")

const zhongmuChain = calculateSkill(FIELD_BUFF_IDS.zhongmu, miyabiSkillRefs.chain)
approx(zhongmuChain.damage.multipliers.directDamageBonus, 0.4, "Zhongmu should grant Chain Attack 40% damage")
approx(zhongmuChain.damage.multipliers.stun, 1.7, "Zhongmu should add 20% stun vulnerability")
const zhongmuUltimate = calculateSkill(FIELD_BUFF_IDS.zhongmu, miyabiSkillRefs.ultimate)
approx(zhongmuUltimate.damage.multipliers.directDamageBonus, 0.4, "Zhongmu should grant Ultimate 40% damage")
const zhongmuBasic = calculateSkill(FIELD_BUFF_IDS.zhongmu, miyabiSkillRefs.basic)
approx(zhongmuBasic.damage.multipliers.directDamageBonus, 0, "Zhongmu should not grant Basic Attack damage")

function calculateAnomaly(fieldBuffId, event, runtime = {}) {
    return calculateInCombatPanel(catalog, {
        ...miyabiInput,
        combatBuffs: {
            activeBuffIds: [fieldBuffId],
            runtimeInputs: {
                [fieldBuffId]: runtime,
            },
        },
        damage: {
            selectedEventId: event.id,
            events: [event],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: { fire: 20 },
            },
        },
    })
}

const jijingFireAnomaly = calculateAnomaly("field.defense_v5.v3_0.p2.jijing_chefeng", {
    id: "jijing-fire-burn",
    kind: "anomaly",
    anomalyEffect: "burn",
    procCount: 1,
})
approx(jijingFireAnomaly.damage.targetBreakdown.resIgnore, 0.1, "Jijing all-attribute RES ignore should apply to fire damage")

const linxiRuntime = {
    effects: {
        [EFFECT_IDS.linxiRes]: { coverage: 0.5 },
        [EFFECT_IDS.linxiAnomaly]: { coverage: 0.25 },
    },
}
const linxiAnomaly = calculateAnomaly(FIELD_BUFF_IDS.linxi, {
    id: "linxi-burn",
    kind: "anomaly",
    anomalyEffect: "burn",
    procCount: 1,
}, linxiRuntime)
approx(
    linxiAnomaly.inCombat.panel.anomalyProficiency - linxiAnomaly.outOfCombat.panel.anomalyProficiency,
    20,
    "Linxi should grant 20 Anomaly Proficiency",
)
approx(
    linxiAnomaly.inCombat.panel.windDmg - linxiAnomaly.outOfCombat.panel.windDmg,
    0.2,
    "Linxi should grant 20% Wind DMG",
)
approx(
    linxiAnomaly.inCombat.panel.iceDmg - linxiAnomaly.outOfCombat.panel.iceDmg,
    0.2,
    "Linxi should grant 20% Ice DMG",
)
approx(linxiAnomaly.damage.targetBreakdown.enemyResReduction, 0.05, "Linxi RES reduction should honor 50% coverage")
approx(linxiAnomaly.damage.multipliers.attributeAnomalyDamage, 1.025, "Linxi anomaly bonus should honor 25% coverage")

const linxiDisorder = calculateAnomaly(FIELD_BUFF_IDS.linxi, {
    id: "linxi-burn-disorder",
    kind: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
}, linxiRuntime)
approx(linxiDisorder.damage.targetBreakdown.enemyResReduction, 0.05, "Linxi RES reduction coverage should also affect Disorder damage")
approx(linxiDisorder.damage.multipliers.disorderDamage, 1, "Linxi attribute-anomaly bonus should not affect Disorder damage")

for (const [anomalyAgentCount, expectedResIgnore] of [[0, 0], [1, 0.05], [2, 0.15]]) {
    const lianshi = calculateAnomaly(FIELD_BUFF_IDS.lianshi, {
        id: `lianshi-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.lianshiRes]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        lianshi.inCombat.panel.anomalyProficiency - lianshi.outOfCombat.panel.anomalyProficiency,
        20,
        `Lianshi should grant 20 Anomaly Proficiency with ${anomalyAgentCount} Anomaly agents`,
    )
    approx(lianshi.damage.multipliers.attributeAnomalyDamage, 1.15, "Lianshi should grant 15% attribute-anomaly damage")
    approx(
        lianshi.damage.targetBreakdown.resIgnore,
        expectedResIgnore,
        `Lianshi should grant the correct attribute-anomaly RES ignore for ${anomalyAgentCount} Anomaly agents`,
    )
}

const lianshiDisorder = calculateAnomaly(FIELD_BUFF_IDS.lianshi, {
    id: "lianshi-burn-disorder",
    kind: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
})
approx(lianshiDisorder.damage.targetBreakdown.resIgnore, 0, "Lianshi RES ignore should not affect Disorder")
approx(lianshiDisorder.damage.multipliers.disorderDamage, 1, "Lianshi damage bonus should not affect Disorder")
const lianshiDirect = calculateSkill(FIELD_BUFF_IDS.lianshi, miyabiSkillRefs.basic)
approx(lianshiDirect.damage.targetBreakdown.resIgnore, 0, "Lianshi RES ignore should not affect direct damage")

const lingduBasic = calculateSkill(FIELD_BUFF_IDS.lingdu, miyabiSkillRefs.basic)
approx(lingduBasic.inCombat.panel.iceDmg - lingduBasic.outOfCombat.panel.iceDmg, 0.3, "Lingdu should grant 30% Ice damage")
approx(lingduBasic.inCombat.panel.etherDmg - lingduBasic.outOfCombat.panel.etherDmg, 0.3, "Lingdu should grant 30% Ether damage")
approx(lingduBasic.damage.multipliers.directDamageBonus, 0.2, "Lingdu should grant Basic Attack 20% damage")
approx(lingduBasic.damage.multipliers.critDmg, 0.85, "Lingdu should grant Basic Attack 35% targeted CRIT DMG")
assert.ok(
    lingduBasic.damage.whiteBoxRows.some(row => String(row.formula ?? "").includes("定向暴击伤害 35%")),
    "Lingdu targeted CRIT DMG should be inspectable in the white-box calculation",
)
const lingduChain = calculateSkill(FIELD_BUFF_IDS.lingdu, miyabiSkillRefs.chain)
approx(lingduChain.damage.multipliers.directDamageBonus, 0.2, "Lingdu should grant Chain Attack 20% damage")
approx(lingduChain.damage.multipliers.critDmg, 0.85, "Lingdu should grant Chain Attack 35% targeted CRIT DMG")
const lingduUltimate = calculateSkill(FIELD_BUFF_IDS.lingdu, miyabiSkillRefs.ultimate)
approx(lingduUltimate.damage.multipliers.directDamageBonus, 0, "Lingdu should not grant Ultimate targeted damage")
approx(lingduUltimate.damage.multipliers.critDmg, 0.5, "Lingdu should not grant Ultimate targeted CRIT DMG")

const gouxiBoth = calculateSkill(FIELD_BUFF_IDS.gouxi, miyabiSkillRefs.basic)
approx(
    gouxiBoth.inCombat.panel.anomalyProficiency - gouxiBoth.outOfCombat.panel.anomalyProficiency,
    45,
    "Gouxi should grant 45 Anomaly Proficiency",
)
approx(gouxiBoth.damage.targetBreakdown.enemyDefReduction, 0.25, "Gouxi should grant 10% plus 15% DEF reduction at full coverage")

const gouxiAnomalyOnly = calculateSkill(FIELD_BUFF_IDS.gouxi, miyabiSkillRefs.basic, {
    effects: {
        [EFFECT_IDS.gouxiDisorderDef]: { coverage: 0 },
    },
})
approx(gouxiAnomalyOnly.damage.targetBreakdown.enemyDefReduction, 0.1, "Gouxi anomaly DEF reduction should remain independently active")

const gouxiDisorderOnly = calculateSkill(FIELD_BUFF_IDS.gouxi, miyabiSkillRefs.basic, {
    effects: {
        [EFFECT_IDS.gouxiAnomalyDef]: { coverage: 0 },
    },
})
approx(gouxiDisorderOnly.damage.targetBreakdown.enemyDefReduction, 0.15, "Gouxi Disorder DEF reduction should remain independently active")

console.log("field Buff regression tests passed")
