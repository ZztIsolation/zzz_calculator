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
    pojing: "field.critical_assault.v3_1.p2.pojing",
    luliPhase2: "field.critical_assault.v3_1.p2.luli",
    zhishuang: "field.critical_assault.v3_1.p2.zhishuang",
    cuixinPhase3: "field.critical_assault.v3_1.p3.cuixin",
    bingxi: "field.critical_assault.v3_1.p3.bingxi",
    yixi: "field.critical_assault.v3_1.p3.yixi",
    wenyin: "field.defense_v5.v3_1.p1.wenyin_gongzhen",
    zhongmuDefense31: "field.defense_v5.v3_1.p1.zhongmu_xiezou",
    shuanglei: "field.defense_v5.v3_1.p1.shuanglei_pofeng",
    zhuoluan: "field.defense_v5.v3_1.p2.zhuoluan_xuanwo",
    guiyu: "field.defense_v5.v3_1.p2.guiyu_qijue",
    guanche: "field.defense_v5.v3_1.p2.guanche_shuanghan",
    huanyan: "field.defense_v5.v3_1.p3.huanyan_shifeng",
    wenyinPhase3: "field.defense_v5.v3_1.p3.wenyin_gongzhen",
    yulei: "field.defense_v5.v3_1.p3.yulei_guanmang",
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
    pojingSheer: "field_critical_assault_v3_1_p2_pojing_rupture_sheer_dmg",
    luliPhase2Proficiency: "field_critical_assault_v3_1_p2_luli_anomaly_proficiency",
    luliPhase2Anomaly: "field_critical_assault_v3_1_p2_luli_anomaly_damage",
    luliPhase2Res: "field_critical_assault_v3_1_p2_luli_enemy_res_reduction",
    yixiAnomaly: "field_critical_assault_v3_1_p3_yixi_anomaly_damage",
    yixiAtk: "field_critical_assault_v3_1_p3_yixi_atk",
    wenyinAnomaly: "field_defense_v5_v3_1_p1_wenyin_attribute_anomaly_damage",
    zhuoluanProficiency: "field_defense_v5_v3_1_p2_zhuoluan_anomaly_proficiency",
    wenyinPhase3Anomaly: "field_defense_v5_v3_1_p3_wenyin_attribute_anomaly_damage",
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
    [FIELD_BUFF_IDS.pojing]: "破境",
    [FIELD_BUFF_IDS.luliPhase2]: "勠力",
    [FIELD_BUFF_IDS.zhishuang]: "制霜",
    [FIELD_BUFF_IDS.cuixinPhase3]: "摧心",
    [FIELD_BUFF_IDS.bingxi]: "冰袭",
    [FIELD_BUFF_IDS.yixi]: "异袭",
    [FIELD_BUFF_IDS.wenyin]: "紊音共振",
    [FIELD_BUFF_IDS.zhongmuDefense31]: "终幕协奏",
    [FIELD_BUFF_IDS.shuanglei]: "霜雷破锋",
    [FIELD_BUFF_IDS.zhuoluan]: "灼乱漩涡",
    [FIELD_BUFF_IDS.guiyu]: "诡域奇谲",
    [FIELD_BUFF_IDS.guanche]: "贯彻霜寒",
    [FIELD_BUFF_IDS.huanyan]: "幻霜蚀锋",
    [FIELD_BUFF_IDS.wenyinPhase3]: "紊音共振",
    [FIELD_BUFF_IDS.yulei]: "御雷贯芒",
    [FIELD_BUFF_IDS.zhongmu]: "终幕协奏",
    [FIELD_BUFF_IDS.lianshi]: "链式回路",
    [FIELD_BUFF_IDS.lingdu]: "零度行动",
    [FIELD_BUFF_IDS.yanwang]: "湮亡",
    [FIELD_BUFF_IDS.linxi]: "凛息",
    [FIELD_BUFF_IDS.gouxi]: "构析",
}

const DEFENSE_3_0_IDS = [FIELD_BUFF_IDS.zhongmu, FIELD_BUFF_IDS.lianshi, FIELD_BUFF_IDS.lingdu]
const DEFENSE_3_1_PHASE_1_IDS = [FIELD_BUFF_IDS.wenyin, FIELD_BUFF_IDS.zhongmuDefense31, FIELD_BUFF_IDS.shuanglei]
const DEFENSE_3_1_PHASE_2_IDS = [FIELD_BUFF_IDS.zhuoluan, FIELD_BUFF_IDS.guiyu, FIELD_BUFF_IDS.guanche]
const DEFENSE_3_1_PHASE_3_IDS = [FIELD_BUFF_IDS.huanyan, FIELD_BUFF_IDS.wenyinPhase3, FIELD_BUFF_IDS.yulei]
const DEFENSE_3_1_IDS = [...DEFENSE_3_1_PHASE_1_IDS, ...DEFENSE_3_1_PHASE_2_IDS, ...DEFENSE_3_1_PHASE_3_IDS]
const CRITICAL_ASSAULT_3_1_IDS = [
    FIELD_BUFF_IDS.cuixin,
    FIELD_BUFF_IDS.luli,
    FIELD_BUFF_IDS.guixi,
]
const CRITICAL_ASSAULT_3_1_PHASE_2_IDS = [
    FIELD_BUFF_IDS.pojing,
    FIELD_BUFF_IDS.luliPhase2,
    FIELD_BUFF_IDS.zhishuang,
]
const CRITICAL_ASSAULT_3_1_PHASE_3_IDS = [
    FIELD_BUFF_IDS.cuixinPhase3,
    FIELD_BUFF_IDS.bingxi,
    FIELD_BUFF_IDS.yixi,
]
const PHASE_2_IDS = [...DEFENSE_3_1_PHASE_2_IDS, ...CRITICAL_ASSAULT_3_1_PHASE_2_IDS]
const PHASE_3_IDS = [...DEFENSE_3_1_PHASE_3_IDS, ...CRITICAL_ASSAULT_3_1_PHASE_3_IDS]
const VERSION_3_1_IDS = [
    ...DEFENSE_3_1_IDS,
    ...CRITICAL_ASSAULT_3_1_IDS,
    ...CRITICAL_ASSAULT_3_1_PHASE_2_IDS,
    ...CRITICAL_ASSAULT_3_1_PHASE_3_IDS,
]

const ALL_RES_IGNORE_BUFF_IDS = [
    "liuyin.cinema_1.good_review_res_ignore",
    "lucia_elowen.cinema_1_dream_song_res_ignore",
    "field.defense_v5.v3_0.p2.jijing_chefeng",
    FIELD_BUFF_IDS.yanwang,
    FIELD_BUFF_IDS.yixi,
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
    const isDefense = DEFENSE_3_0_IDS.includes(id) || DEFENSE_3_1_IDS.includes(id)
    const isVersion31 = VERSION_3_1_IDS.includes(id)
    const isPhase2 = PHASE_2_IDS.includes(id)
    const isPhase3 = PHASE_3_IDS.includes(id)
    assert.deepEqual(buff.period, {
        modeId: isDefense ? "defense_v5" : "critical_assault",
        gameVersion: isVersion31 ? "3.1" : "3.0",
        phaseNo: isPhase3 ? 3 : isPhase2 ? 2 : isVersion31 ? 1 : 3,
        phaseName: { zhCN: isPhase3 ? "第三期" : isPhase2 ? "第二期" : isVersion31 ? "第一期" : "第三期" },
    })
    assert.equal(buff.source?.zhCN, isDefense ? "防卫战 v5" : "危局强袭战")
    assert.equal(buff.sourcePeriod?.zhCN, isPhase3 ? "3.1版本第三期" : isPhase2 ? "3.1版本第二期" : isVersion31 ? "3.1版本第一期" : "3.0版本第三期")

    const validation = validateMaintenanceItem("field-buffs", buff, {
        items: catalog.combatBuffs,
        currentId: id,
        agentSkills: catalog.agentSkills,
    })
    assert.equal(validation.ok, true, `${id} should pass field Buff validation: ${JSON.stringify(validation.errors)}`)
}

const allFieldBuffs = catalog.combatBuffs.filter(buff => buff.sourceType === "field")
assert.equal(allFieldBuffs.length, 27, "Field Buff catalog should keep all maintained entries")
assert.deepEqual(
    allFieldBuffs
        .filter(buff => buff.period?.modeId === "defense_v5" && buff.period?.gameVersion === "3.1" && buff.period?.phaseNo === 3)
        .map(buff => buff.id),
    DEFENSE_3_1_PHASE_3_IDS,
    "Defense Battle 3.1 phase 3 should be the latest authored field period",
)
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
    fieldBuff(FIELD_BUFF_IDS.wenyin).description.zhCN,
    "若队伍内有2名/3名[异常]特性的代理人，代理人造成的属性异常伤害提升10%/60%，全队入场时初始获得500/1500点喧响值。",
    "Wenyin Gongzhen should preserve the complete source text, including the descriptive-only initial Decibel clause",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.zhongmuDefense31).description.zhCN,
    "代理人的[终结技]、[连携技]造成的伤害提升40%。[连携技]命中敌人后，其失衡易伤倍率提升20%，失衡恢复速度降低15%，持续15秒，重复触发时刷新持续时间。",
    "Defense Battle Zhongmu Xiezou should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.shuanglei).description.zhCN,
    "代理人的冰属性伤害和电属性伤害提升30%。[强攻]特性的代理人发动[强化特殊技]后，自身暴击伤害提升30%，持续20秒，重复触发时刷新持续时间。",
    "Shuanglei Pofeng should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.zhuoluan).description.zhCN,
    "代理人造成的属性异常伤害提升15%。若队伍内有2名/3名[异常]特性的代理人，代理人的异常精通提升40点/120点。",
    "Zhuoluan Xuanwo should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.guiyu).description.zhCN,
    "代理人的以太属性伤害提升20%。代理人使敌人进入属性异常状态后，其防御力降低15%，全属性伤害抗性降低15%，持续10秒，重复触发时刷新持续时间。",
    "Guiyu Qijue should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.guanche).description.zhCN,
    "[强攻]特性的代理人的[普通攻击]命中敌人时，无视其30%的冰属性伤害抗性。[强攻]特性的代理人发动[连携技]和[强化特殊技]后，自身冰属性伤害提升20%，暴击伤害提升40%，持续15秒，重复触发时刷新持续时间。",
    "Guanche Shuanghan should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.huanyan).description.zhCN,
    "代理人的以太属性伤害和冰属性伤害提升35%，暴击伤害提升25%。[强攻]特性的代理人攻击命中失衡状态中的敌人后，其防御力降低25%，持续5秒，重复触发时刷新持续时间。",
    "Huanyan Shifeng should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.wenyinPhase3).description.zhCN,
    "若队伍内有2名/3名[异常]特性的代理人，代理人造成的属性异常伤害提升10%/60%，全队入场时初始获得500/1500点喧响值。",
    "Phase 3 Wenyin Gongzhen should preserve the complete source text, including the descriptive-only initial Decibel clause",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.yulei).description.zhCN,
    "代理人攻击命中敌人时无视其20%的电属性伤害抗性。代理人发动[强化特殊技]后，自身暴击率提升5%，暴击伤害提升20%，持续15秒，重复触发时刷新持续时间。",
    "Yulei Guanman should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.pojing).description.zhCN,
    "[命破]特性的代理人贯穿伤害提升15%。处于[以太帷幕]中的代理人，以太属性伤害提升25%，攻击命中敌人后使其失衡易伤倍率提升25%，持续10秒，重复触发时刷新持续时间。",
    "Pojing should retain only modeled damage-relevant source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.luliPhase2).description.zhCN,
    "队伍内存在2/3名[异常]特性代理人时，全队的异常精通分别提升30点/70点，造成的属性异常伤害分别提升10%/25%。对敌人施加属性异常效果后，敌人的全属性伤害抗性降低15%，持续10秒，重复触发时刷新持续时间。",
    "Phase 2 Luli should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.zhishuang).description.zhCN,
    "[强攻]特性的代理人攻击力提升25%，[普通攻击]、[强化特殊技]、[连携技]命中敌人时，无视其30%的冰属性伤害抗性和以太属性伤害抗性。代理人命中处于失衡状态的敌人时，其失衡易伤提升40%，持续5秒，重复触发时刷新持续时间。",
    "Zhishuang should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.cuixinPhase3).description.zhCN,
    "代理人的暴击伤害提升30%。[强攻]特性的代理人攻击力提升10%，[普通攻击]命中时造成的伤害提升30%，并无视敌人15%的防御力。",
    "Phase 3 Cuixin should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.bingxi).description.zhCN,
    "代理人的[普通攻击]、[终结技]造成的伤害提升30%。[强攻]特性的代理人攻击命中敌人时，无视其20%的冰属性伤害抗性。代理人发动[强化特殊技]后，自身的冰属性伤害提升30%，持续15秒，重复触发时刷新持续时间。",
    "Bingxi should preserve the complete source text",
)
assert.equal(
    fieldBuff(FIELD_BUFF_IDS.yixi).description.zhCN,
    "队伍中存在2/3名[异常]特性的代理人时，全队造成的属性异常伤害分别提升10%/30%，全队的攻击力分别提升5%/15%。对敌人造成属性异常伤害时，无视其10%的全属性伤害抗性与10%的防御力。",
    "Yixi should preserve the complete source text",
)
assert.equal(JSON.stringify(CRITICAL_ASSAULT_3_1_PHASE_2_IDS.map(fieldBuff)).includes("秽息盾削减值"), false)

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

function calculateAttackBasic(fieldBuffId, runtime = {}, damageElement = "") {
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
            ...(damageElement ? { damageElement } : {}),
            target: {
                defense: 953,
                levelCoefficient: 794,
                ...(damageElement ? { resistanceByElement: { [damageElement]: 20 } } : {}),
            },
        },
    })
}

const cuixinAttack = calculateAttackBasic(FIELD_BUFF_IDS.cuixin)
approx(
    cuixinAttack.inCombat.panel.atk - cuixinAttack.outOfCombat.panel.atk,
    cuixinAttack.outOfCombat.panel.atk * 0.1,
    "Cuixin should grant Attack agents 10% of out-of-combat ATK",
)

const cuixinPhase3Attack = calculateAttackBasic(FIELD_BUFF_IDS.cuixinPhase3)
approx(
    cuixinPhase3Attack.inCombat.panel.atk - cuixinPhase3Attack.outOfCombat.panel.atk,
    cuixinPhase3Attack.outOfCombat.panel.atk * 0.1,
    "Phase 3 Cuixin should grant Attack agents 10% of out-of-combat ATK",
)
approx(
    cuixinPhase3Attack.inCombat.panel.critDmg - cuixinPhase3Attack.outOfCombat.panel.critDmg,
    0.3,
    "Phase 3 Cuixin should grant 30% CRIT DMG",
)
approx(cuixinPhase3Attack.damage.multipliers.directDamageBonus, 0.3, "Phase 3 Cuixin should grant 30% Basic Attack damage")
approx(cuixinPhase3Attack.damage.targetBreakdown.enemyDefReduction, 0.15, "Phase 3 Cuixin should grant 15% Basic Attack DEF ignore")

const bingxiAttack = calculateAttackBasic(FIELD_BUFF_IDS.bingxi, {}, "ice")
approx(bingxiAttack.damage.multipliers.directDamageBonus, 0.3, "Bingxi should grant 30% Basic Attack damage")
approx(bingxiAttack.damage.targetBreakdown.resIgnore, 0.2, "Bingxi should grant Attack agents 20% Ice RES ignore")
approx(bingxiAttack.inCombat.panel.iceDmg - bingxiAttack.outOfCombat.panel.iceDmg, 0.3, "Bingxi should grant 30% Ice damage")
const bingxiUltimate = calculateSkill(FIELD_BUFF_IDS.bingxi, miyabiSkillRefs.ultimate)
approx(bingxiUltimate.damage.multipliers.directDamageBonus, 0.3, "Bingxi should grant 30% Ultimate damage")
approx(bingxiUltimate.damage.targetBreakdown.resIgnore, 0, "Bingxi Ice RES ignore should not apply to non-Attack agents")

const yixiDirect = calculateAttackBasic(FIELD_BUFF_IDS.yixi, {}, "ice")
approx(
    yixiDirect.inCombat.panel.atk - yixiDirect.outOfCombat.panel.atk,
    yixiDirect.outOfCombat.panel.atk * 0.15,
    "Yixi should grant 15% of out-of-combat ATK with three Anomaly agents",
)
approx(yixiDirect.damage.targetBreakdown.resIgnore, 0, "Yixi anomaly RES ignore should not affect direct damage")
approx(yixiDirect.damage.targetBreakdown.enemyDefReduction, 0, "Yixi anomaly DEF ignore should not affect direct damage")

const huanyanAttack = calculateAttackBasic(FIELD_BUFF_IDS.huanyan, {}, "ether")
approx(huanyanAttack.inCombat.panel.etherDmg - huanyanAttack.outOfCombat.panel.etherDmg, 0.35, "Huanyan Shifeng should grant 35% Ether damage")
approx(huanyanAttack.inCombat.panel.iceDmg - huanyanAttack.outOfCombat.panel.iceDmg, 0.35, "Huanyan Shifeng should grant 35% Ice damage")
approx(huanyanAttack.inCombat.panel.critDmg - huanyanAttack.outOfCombat.panel.critDmg, 0.25, "Huanyan Shifeng should grant 25% CRIT DMG")
approx(huanyanAttack.damage.targetBreakdown.enemyDefReduction, 0.25, "Huanyan Shifeng should reduce enemy DEF by 25% for Attack agents")
const huanyanAnomaly = calculateSkill(FIELD_BUFF_IDS.huanyan, miyabiSkillRefs.basic)
approx(huanyanAnomaly.inCombat.panel.iceDmg - huanyanAnomaly.outOfCombat.panel.iceDmg, 0.35, "Huanyan Shifeng Ice damage should apply to non-Attack agents")
approx(huanyanAnomaly.inCombat.panel.critDmg - huanyanAnomaly.outOfCombat.panel.critDmg, 0.25, "Huanyan Shifeng CRIT DMG should apply to non-Attack agents")
approx(huanyanAnomaly.damage.targetBreakdown.enemyDefReduction, 0, "Huanyan Shifeng DEF reduction should not apply to non-Attack agents")
const huanyanTriggeredRule = fieldBuff(FIELD_BUFF_IDS.huanyan).effects.find(effect => effect.stat === "enemyDefReduction")
assert.equal(huanyanTriggeredRule?.condition, "强攻特性代理人攻击命中失衡状态中的敌人后")
assert.equal(huanyanTriggeredRule?.durationSeconds, 5)

const yulei = calculateAttackBasic(FIELD_BUFF_IDS.yulei, {}, "electric")
approx(yulei.damage.targetBreakdown.resIgnore, 0.2, "Yulei Guanman should grant 20% Electric RES ignore")
approx(yulei.inCombat.panel.critRate - yulei.outOfCombat.panel.critRate, 0.05, "Yulei Guanman should grant 5% CRIT Rate")
approx(yulei.inCombat.panel.critDmg - yulei.outOfCombat.panel.critDmg, 0.2, "Yulei Guanman should grant 20% CRIT DMG")
const yuleiTriggeredRules = fieldBuff(FIELD_BUFF_IDS.yulei).effects
    .filter(effect => effect.stat === "critRate" || effect.stat === "critDmg")
assert.ok(yuleiTriggeredRules.every(effect => effect.condition === "代理人发动强化特殊技后"))
assert.ok(yuleiTriggeredRules.every(effect => effect.durationSeconds === 15))

const zhishuangAttack = calculateAttackBasic(FIELD_BUFF_IDS.zhishuang)
approx(
    zhishuangAttack.inCombat.panel.atk - zhishuangAttack.outOfCombat.panel.atk,
    zhishuangAttack.outOfCombat.panel.atk * 0.25,
    "Zhishuang should grant Attack agents 25% of out-of-combat ATK",
)
approx(zhishuangAttack.damage.multipliers.stun, 1.9, "Zhishuang should add 40% stun vulnerability")
const zhishuangRules = fieldBuff(FIELD_BUFF_IDS.zhishuang).effects
    .filter(effect => effect.stat === "iceResIgnore" || effect.stat === "etherResIgnore")
assert.deepEqual(zhishuangRules.map(effect => effect.stat), ["iceResIgnore", "etherResIgnore"])
assert.ok(zhishuangRules.every(effect => effect.requirement?.specialty === "attack"))
assert.equal(zhishuangRules.filter(effect => effect.target?.skillTargets?.some(target => target.skillType === "special")).length, 2)

const pojingSheer = calculateInCombatPanel(catalog, {
    agentId: "yixuan",
    wEngineId: "zzz_wiki_1342",
    combatBuffs: {
        activeBuffIds: [FIELD_BUFF_IDS.pojing],
        runtimeInputs: {},
    },
    damage: {
        selectedEventId: "pojing-sheer",
        events: [{
            id: "pojing-sheer",
            kind: "sheer",
            damageElement: "ether",
            skillMultiplier: 100,
            critMode: "nonCrit",
            stunned: true,
        }],
        target: { defense: 953, levelCoefficient: 794 },
    },
})
approx(pojingSheer.damage.multipliers.sheerDamage, 1.15, "Pojing should grant Rupture agents 15% sheer damage")
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

const zhongmuDefense31Chain = calculateSkill(FIELD_BUFF_IDS.zhongmuDefense31, miyabiSkillRefs.chain)
approx(zhongmuDefense31Chain.damage.multipliers.directDamageBonus, 0.4, "Defense Battle Zhongmu should grant Chain Attack 40% damage")
approx(zhongmuDefense31Chain.damage.multipliers.stun, 1.7, "Defense Battle Zhongmu should add 20% stun vulnerability")
const zhongmuDefense31Ultimate = calculateSkill(FIELD_BUFF_IDS.zhongmuDefense31, miyabiSkillRefs.ultimate)
approx(zhongmuDefense31Ultimate.damage.multipliers.directDamageBonus, 0.4, "Defense Battle Zhongmu should grant Ultimate 40% damage")
const zhongmuDefense31Basic = calculateSkill(FIELD_BUFF_IDS.zhongmuDefense31, miyabiSkillRefs.basic)
approx(zhongmuDefense31Basic.damage.multipliers.directDamageBonus, 0, "Defense Battle Zhongmu should not grant Basic Attack damage")

const shuangleiAttack = calculateAttackBasic(FIELD_BUFF_IDS.shuanglei)
approx(shuangleiAttack.inCombat.panel.iceDmg - shuangleiAttack.outOfCombat.panel.iceDmg, 0.3, "Shuanglei should grant 30% Ice damage")
approx(shuangleiAttack.inCombat.panel.electricDmg - shuangleiAttack.outOfCombat.panel.electricDmg, 0.3, "Shuanglei should grant 30% Electric damage")
approx(shuangleiAttack.inCombat.panel.critDmg - shuangleiAttack.outOfCombat.panel.critDmg, 0.3, "Shuanglei should grant Attack agents 30% CRIT DMG")
const shuangleiAnomaly = calculateSkill(FIELD_BUFF_IDS.shuanglei, miyabiSkillRefs.basic)
approx(shuangleiAnomaly.inCombat.panel.iceDmg - shuangleiAnomaly.outOfCombat.panel.iceDmg, 0.3, "Shuanglei Ice damage should apply to non-Attack agents")
approx(shuangleiAnomaly.inCombat.panel.electricDmg - shuangleiAnomaly.outOfCombat.panel.electricDmg, 0.3, "Shuanglei Electric damage should apply to non-Attack agents")
approx(shuangleiAnomaly.inCombat.panel.critDmg - shuangleiAnomaly.outOfCombat.panel.critDmg, 0, "Shuanglei CRIT DMG should not apply to non-Attack agents")

const guiyu = calculateSkill(FIELD_BUFF_IDS.guiyu, miyabiSkillRefs.basic)
approx(guiyu.inCombat.panel.etherDmg - guiyu.outOfCombat.panel.etherDmg, 0.2, "Guiyu Qijue should grant 20% Ether damage")
approx(guiyu.damage.targetBreakdown.enemyDefReduction, 0.15, "Guiyu Qijue should reduce enemy DEF by 15%")
approx(guiyu.damage.targetBreakdown.enemyResReduction, 0.15, "Guiyu Qijue should reduce all-attribute RES by 15%")
const guiyuTriggeredRules = fieldBuff(FIELD_BUFF_IDS.guiyu).effects
    .filter(effect => effect.stat === "enemyDefReduction" || effect.stat === "enemyResReduction")
assert.ok(guiyuTriggeredRules.every(effect => effect.durationSeconds === 10))
assert.ok(guiyuTriggeredRules.every(effect => effect.condition === "代理人使敌人进入属性异常状态后"))

const guancheAttack = calculateAttackBasic(FIELD_BUFF_IDS.guanche, {}, "ice")
approx(guancheAttack.inCombat.panel.iceDmg - guancheAttack.outOfCombat.panel.iceDmg, 0.2, "Guanche Shuanghan should grant Attack agents 20% Ice damage")
approx(guancheAttack.inCombat.panel.critDmg - guancheAttack.outOfCombat.panel.critDmg, 0.4, "Guanche Shuanghan should grant Attack agents 40% CRIT DMG")
approx(guancheAttack.damage.targetBreakdown.resIgnore, 0.3, "Guanche Shuanghan should grant Attack Basic Attacks 30% Ice RES ignore")
const guancheAnomaly = calculateSkill(FIELD_BUFF_IDS.guanche, miyabiSkillRefs.basic)
approx(guancheAnomaly.inCombat.panel.iceDmg - guancheAnomaly.outOfCombat.panel.iceDmg, 0, "Guanche Shuanghan Ice damage should not apply to non-Attack agents")
approx(guancheAnomaly.inCombat.panel.critDmg - guancheAnomaly.outOfCombat.panel.critDmg, 0, "Guanche Shuanghan CRIT DMG should not apply to non-Attack agents")
approx(guancheAnomaly.damage.targetBreakdown.resIgnore, 0, "Guanche Shuanghan Ice RES ignore should not apply to non-Attack agents")

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

for (const [anomalyAgentCount, expectedAnomalyDamage, expectedAtk] of [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0.1, 0.05],
    [3, 0.3, 0.15],
]) {
    const yixi = calculateAnomaly(FIELD_BUFF_IDS.yixi, {
        id: `yixi-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.yixiAnomaly]: { sourceValue: anomalyAgentCount },
            [EFFECT_IDS.yixiAtk]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        yixi.inCombat.panel.atk - yixi.outOfCombat.panel.atk,
        yixi.outOfCombat.panel.atk * expectedAtk,
        `Yixi should grant the correct ATK with ${anomalyAgentCount} Anomaly agents`,
    )
    approx(
        yixi.damage.multipliers.attributeAnomalyDamage,
        1 + expectedAnomalyDamage,
        `Yixi should grant the correct anomaly damage with ${anomalyAgentCount} Anomaly agents`,
    )
    approx(yixi.damage.targetBreakdown.resIgnore, 0.1, "Yixi should grant attribute anomaly 10% all-attribute RES ignore")
    approx(yixi.damage.targetBreakdown.enemyDefReduction, 0.1, "Yixi should grant attribute anomaly 10% DEF ignore")
}

for (const [anomalyAgentCount, expectedAnomalyDamage] of [[0, 0], [1, 0], [2, 0.1], [3, 0.6]]) {
    const wenyin = calculateAnomaly(FIELD_BUFF_IDS.wenyin, {
        id: `wenyin-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.wenyinAnomaly]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        wenyin.damage.multipliers.attributeAnomalyDamage,
        1 + expectedAnomalyDamage,
        `Wenyin Gongzhen should grant the correct attribute-anomaly damage for ${anomalyAgentCount} Anomaly agents`,
    )
}
const wenyinDisorder = calculateAnomaly(FIELD_BUFF_IDS.wenyin, {
    id: "wenyin-burn-disorder",
    kind: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
}, {
    effects: {
        [EFFECT_IDS.wenyinAnomaly]: { sourceValue: 3 },
    },
})
approx(wenyinDisorder.damage.multipliers.disorderDamage, 1, "Wenyin Gongzhen should not increase Disorder damage")

for (const [anomalyAgentCount, expectedAnomalyDamage] of [[0, 0], [1, 0], [2, 0.1], [3, 0.6]]) {
    const wenyinPhase3 = calculateAnomaly(FIELD_BUFF_IDS.wenyinPhase3, {
        id: `wenyin-phase3-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.wenyinPhase3Anomaly]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        wenyinPhase3.damage.multipliers.attributeAnomalyDamage,
        1 + expectedAnomalyDamage,
        `Phase 3 Wenyin Gongzhen should grant the correct attribute-anomaly damage for ${anomalyAgentCount} Anomaly agents`,
    )
}
const wenyinPhase3Disorder = calculateAnomaly(FIELD_BUFF_IDS.wenyinPhase3, {
    id: "wenyin-phase3-disorder",
    kind: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
}, {
    effects: {
        [EFFECT_IDS.wenyinPhase3Anomaly]: { sourceValue: 3 },
    },
})
approx(wenyinPhase3Disorder.damage.multipliers.disorderDamage, 1, "Phase 3 Wenyin Gongzhen should not increase Disorder damage")

for (const [anomalyAgentCount, expectedProficiency] of [[0, 0], [1, 0], [2, 40], [3, 120]]) {
    const zhuoluan = calculateAnomaly(FIELD_BUFF_IDS.zhuoluan, {
        id: `zhuoluan-burn-${anomalyAgentCount}`,
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "burn",
        procCount: 1,
    }, {
        effects: {
            [EFFECT_IDS.zhuoluanProficiency]: { sourceValue: anomalyAgentCount },
        },
    })
    approx(
        zhuoluan.inCombat.panel.anomalyProficiency - zhuoluan.outOfCombat.panel.anomalyProficiency,
        expectedProficiency,
        `Zhuoluan Xuanwo should grant the correct Anomaly Proficiency for ${anomalyAgentCount} Anomaly agents`,
    )
    approx(
        zhuoluan.damage.multipliers.attributeAnomalyDamage,
        1.15,
        "Zhuoluan Xuanwo should grant 15% attribute-anomaly damage",
    )
}
const zhuoluanDisorder = calculateAnomaly(FIELD_BUFF_IDS.zhuoluan, {
    id: "zhuoluan-burn-disorder",
    kind: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 0,
})
approx(zhuoluanDisorder.damage.multipliers.disorderDamage, 1, "Zhuoluan Xuanwo should not increase Disorder damage")

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
