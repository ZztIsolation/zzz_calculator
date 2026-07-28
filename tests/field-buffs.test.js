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
    cuixin: "field.critical_assault.v3_1.p1.cuixin",
    luli: "field.critical_assault.v3_1.p1.luli",
    guixi: "field.critical_assault.v3_1.p1.guixi",
    zhongmu: "field.defense_v5.v3_0.p3.zhongmu_xiezou",
    lianshi: "field.defense_v5.v3_0.p3.lianshi_huilu",
    lingdu: "field.defense_v5.v3_0.p3.lingdu_xingdong",
    yanwang: "field.critical_assault.v3_0.p3.yanwang",
    linxi: "field.critical_assault.v3_0.p3.linxi",
    gouxi: "field.critical_assault.v3_0.p3.gouxi",
}

const EFFECT_IDS = {
    cuixinCrit: "field_critical_assault_v3_1_p1_cuixin_crit_dmg",
    cuixinAtk: "field_critical_assault_v3_1_p1_cuixin_attack_atk",
    luliProficiency: "field_critical_assault_v3_1_p1_luli_anomaly_proficiency",
    luliAnomaly: "field_critical_assault_v3_1_p1_luli_anomaly_damage",
    luliRes: "field_critical_assault_v3_1_p1_luli_enemy_res_reduction",
    guixiDef: "field_critical_assault_v3_1_p1_guixi_enemy_def_reduction",
    lianshiRes: "field_defense_v5_v3_0_p3_lianshi_anomaly_res_ignore",
    yanwangAtk: "field_critical_assault_v3_0_p3_yanwang_chain_atk",
    linxiRes: "field_critical_assault_v3_0_p3_linxi_enemy_res_reduction",
    linxiAnomaly: "field_critical_assault_v3_0_p3_linxi_anomaly_damage",
    gouxiAnomalyDef: "field_critical_assault_v3_0_p3_gouxi_anomaly_def_reduction",
    gouxiDisorderDef: "field_critical_assault_v3_0_p3_gouxi_disorder_def_reduction",
}

const EXPECTED_NAMES = {
    [FIELD_BUFF_IDS.cuixin]: "摧心",
    [FIELD_BUFF_IDS.luli]: "勠力",
    [FIELD_BUFF_IDS.guixi]: "诡袭",
    [FIELD_BUFF_IDS.zhongmu]: "终幕协奏",
    [FIELD_BUFF_IDS.lianshi]: "链式回路",
    [FIELD_BUFF_IDS.lingdu]: "零度行动",
    [FIELD_BUFF_IDS.yanwang]: "湮亡",
    [FIELD_BUFF_IDS.linxi]: "凛息",
    [FIELD_BUFF_IDS.gouxi]: "构析",
}

const DEFENSE_3_0_IDS = [FIELD_BUFF_IDS.zhongmu, FIELD_BUFF_IDS.lianshi, FIELD_BUFF_IDS.lingdu]
const CRITICAL_ASSAULT_3_1_IDS = [FIELD_BUFF_IDS.cuixin, FIELD_BUFF_IDS.luli, FIELD_BUFF_IDS.guixi]

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
    const isDefense = DEFENSE_3_0_IDS.includes(id)
    const isCriticalAssault31 = CRITICAL_ASSAULT_3_1_IDS.includes(id)
    assert.deepEqual(buff.period, {
        modeId: isDefense ? "defense_v5" : "critical_assault",
        gameVersion: isCriticalAssault31 ? "3.1" : "3.0",
        phaseNo: isCriticalAssault31 ? 1 : 3,
        phaseName: { zhCN: isCriticalAssault31 ? "第一期" : "第三期" },
    })
    assert.equal(buff.source?.zhCN, isDefense ? "防卫战 v5" : "危局强袭战")
    assert.equal(buff.sourcePeriod?.zhCN, isCriticalAssault31 ? "3.1版本第一期" : "3.0版本第三期")

    const validation = validateMaintenanceItem("field-buffs", buff, {
        items: catalog.combatBuffs,
        currentId: id,
        agentSkills: catalog.agentSkills,
    })
    assert.equal(validation.ok, true, `${id} should pass field Buff validation: ${JSON.stringify(validation.errors)}`)
}

const allFieldBuffs = catalog.combatBuffs.filter(buff => buff.sourceType === "field")
assert.equal(allFieldBuffs.length, 12, "Field Buff catalog should keep all maintained entries")
for (const buff of allFieldBuffs) {
    assert.ok(buff.effects.length > 0, `${buff.id} should expose structured effects`)
    for (const effect of buff.effects) {
        assert.deepEqual(
            effect.coverage,
            { default: 1, min: 0, max: 1, step: 0.1 },
            `${buff.id}.${effect.id} should expose standard independent coverage`,
        )
    }
}

assert.equal(
    fieldBuff(FIELD_BUFF_IDS.cuixin).description.zhCN,
    "代理人的暴击伤害提升30%。[强攻]特性的代理人攻击力提升10%，[普通攻击]命中时造成的伤害提升30%，并无视敌人15%的防御。",
    "Cuixin should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.luli).description.zhCN,
    "队伍内存在2/3名[异常]特性代理人时，全队的异常精通分别提升30点/70点，造成的属性异常伤害分别提升10%/25%。对敌人施加属性异常效果后，敌人的全属性伤害抗性降低15%，持续10秒，重复触发时刷新持续时间。",
    "Luli should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.guixi).description.zhCN,
    "代理人的攻击力提升10%，异常精通提升30点，暴击伤害提升40%。代理人对敌人施加属性异常效果后，其防御力降低10%，持续10秒，重复触发时刷新持续时间。",
    "Guixi should preserve the complete source text",
)

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

function calculateAttackBasic(fieldBuffId, runtime = {}) {
    return calculateInCombatPanel(catalog, {
        ...catalog.examples.yeShunguang.input,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: [fieldBuffId],
            runtimeInputs: { [fieldBuffId]: runtime },
        },
        damage: {
            skillRef: {
                agentSkillId: "ye_shunguang",
                categoryId: "basic",
                moveId: "quick_sword",
                rowId: "hit_1",
                level: 12,
            },
            target: { defense: 953, levelCoefficient: 794 },
        },
    })
}

const cuixinAttack = calculateAttackBasic(FIELD_BUFF_IDS.cuixin)
approx(
    cuixinAttack.inCombat.panel.atk - cuixinAttack.outOfCombat.panel.atk,
    cuixinAttack.outOfCombat.panel.atk * 0.1,
    "Cuixin should grant Attack agents 10% of out-of-combat ATK",
)
approx(
    cuixinAttack.inCombat.panel.critDmg - cuixinAttack.outOfCombat.panel.critDmg,
    0.3,
    "Cuixin should grant every agent 30% CRIT DMG",
)
approx(cuixinAttack.damage.multipliers.directDamageBonus, 0.3, "Cuixin should grant Attack agents 30% Basic Attack damage")
approx(cuixinAttack.damage.targetBreakdown.enemyDefReduction, 0.15, "Cuixin should grant Attack agents 15% Basic Attack DEF ignore")

const configuredCuixinAttack = calculateAttackBasic(FIELD_BUFF_IDS.cuixin, {
    effects: {
        [EFFECT_IDS.cuixinCrit]: { enabled: false, coverage: 0.3 },
        [EFFECT_IDS.cuixinAtk]: { coverage: 0.5 },
    },
})
approx(
    configuredCuixinAttack.inCombat.panel.atk - configuredCuixinAttack.outOfCombat.panel.atk,
    configuredCuixinAttack.outOfCombat.panel.atk * 0.05,
    "Cuixin ATK coverage should scale only the ATK effect",
)
approx(
    configuredCuixinAttack.inCombat.panel.critDmg - configuredCuixinAttack.outOfCombat.panel.critDmg,
    0,
    "Cuixin disabled CRIT DMG should not affect sibling effects",
)

const reenabledCuixinAttack = calculateAttackBasic(FIELD_BUFF_IDS.cuixin, {
    effects: {
        [EFFECT_IDS.cuixinCrit]: { enabled: true, coverage: 0.3 },
    },
})
approx(
    reenabledCuixinAttack.inCombat.panel.critDmg - reenabledCuixinAttack.outOfCombat.panel.critDmg,
    0.09,
    "Cuixin re-enabled CRIT DMG should reuse its retained coverage",
)

const cuixinAnomaly = calculateSkill(FIELD_BUFF_IDS.cuixin, miyabiSkillRefs.basic)
approx(cuixinAnomaly.inCombat.panel.atk - cuixinAnomaly.outOfCombat.panel.atk, 0, "Cuixin should not grant non-Attack agents ATK")
approx(cuixinAnomaly.damage.multipliers.directDamageBonus, 0, "Cuixin should not grant non-Attack agents Basic Attack damage")
approx(cuixinAnomaly.damage.targetBreakdown.enemyDefReduction, 0, "Cuixin should not grant non-Attack agents DEF ignore")
approx(
    cuixinAnomaly.inCombat.panel.critDmg - cuixinAnomaly.outOfCombat.panel.critDmg,
    0.3,
    "Cuixin's unconditional CRIT DMG should still apply to non-Attack agents",
)

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

for (const [anomalyAgentCount, expectedProficiency, expectedAnomalyDamage] of [
    [0, 0, 0],
    [1, 0, 0],
    [2, 30, 0.1],
    [3, 70, 0.25],
]) {
    const luli = calculateAnomaly(FIELD_BUFF_IDS.luli, {
        id: `luli-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.luliProficiency]: { sourceValue: anomalyAgentCount },
            [EFFECT_IDS.luliAnomaly]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        luli.inCombat.panel.anomalyProficiency - luli.outOfCombat.panel.anomalyProficiency,
        expectedProficiency,
        `Luli should grant the correct Anomaly Proficiency for ${anomalyAgentCount} Anomaly agents`,
    )
    approx(
        luli.damage.multipliers.attributeAnomalyDamage,
        1 + expectedAnomalyDamage,
        `Luli should grant the correct attribute-anomaly damage for ${anomalyAgentCount} Anomaly agents`,
    )
    approx(luli.damage.targetBreakdown.enemyResReduction, 0.15, "Luli should reduce all-attribute RES after applying an Anomaly")
}

const luliHalfResCoverage = calculateAnomaly(FIELD_BUFF_IDS.luli, {
    id: "luli-half-res-coverage",
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffect: "burn",
    procCount: 1,
}, {
    effects: {
        [EFFECT_IDS.luliRes]: { coverage: 0.5 },
    },
})
approx(luliHalfResCoverage.damage.targetBreakdown.enemyResReduction, 0.075, "Luli RES reduction should honor coverage")

const guixi = calculateAnomaly(FIELD_BUFF_IDS.guixi, {
    id: "guixi-burn",
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffect: "burn",
    procCount: 1,
}, {
    effects: {
        [EFFECT_IDS.guixiDef]: { coverage: 0.5 },
    },
})
approx(
    guixi.inCombat.panel.atk - guixi.outOfCombat.panel.atk,
    guixi.outOfCombat.panel.atk * 0.1,
    "Guixi should grant 10% of out-of-combat ATK",
)
approx(
    guixi.inCombat.panel.anomalyProficiency - guixi.outOfCombat.panel.anomalyProficiency,
    30,
    "Guixi should grant 30 Anomaly Proficiency",
)
approx(guixi.inCombat.panel.critDmg - guixi.outOfCombat.panel.critDmg, 0.4, "Guixi should grant 40% CRIT DMG")
approx(guixi.damage.targetBreakdown.enemyDefReduction, 0.05, "Guixi DEF reduction should honor coverage")

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
