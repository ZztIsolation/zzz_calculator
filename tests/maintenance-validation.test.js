import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cleanMaintenanceItem } from "../backend/server.js"
import { loadCalculatorContext } from "../backend/calculator.js"
import {
    applySystemManagedMaintenanceFields,
    validateMaintenanceItem,
} from "../core/maintenanceValidation.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const systemManagedFixture = applySystemManagedMaintenanceFields({
    skillGroups: [{ defaultCount: 9, minCount: 2, maxCount: 3, step: 0.5 }],
    nested: { coverage: { default: 1.5, min: 0.4, max: 0.6, step: 0.2 } },
})
assert.deepEqual(systemManagedFixture.skillGroups[0], { defaultCount: 1, minCount: 0, maxCount: 100, step: 1 })
assert.deepEqual(systemManagedFixture.nested.coverage, { default: 1.5, min: 0, max: 1, step: 0.1 })
const migratedCoverageFixture = applySystemManagedMaintenanceFields({
    coverage: { default: 0.4, min: 0.2, max: 0.8, step: 0.2 },
    effects: [
        { id: "coverage-a", type: "fixed", stat: "dmgBonus", value: 10 },
        { id: "coverage-b", type: "fixed", stat: "critRate", value: 10 },
    ],
})
assert.equal(migratedCoverageFixture.coverage, undefined)
assert.deepEqual(migratedCoverageFixture.effects.map(rule => rule.coverage), [
    { default: 0.4, min: 0, max: 1, step: 0.1 },
    { default: 0.4, min: 0, max: 1, step: 0.1 },
])

const validAgent = {
    id: "test_agent",
    name: { zhCN: "测试角色" },
    rarity: "S",
    attribute: "physical",
    specialty: "attack",
    level60: {
        hpBase: 7000,
        atkBase: 800,
        defBase: 600,
        critRate: 5,
        critDmg: 50,
        impact: 90,
        anomalyProficiency: 90,
        anomalyMastery: 90,
        energyRegen: 120,
        penRatio: 0,
    },
    combatBuffs: {
        corePassive: null,
        additionalAbility: null,
    },
}

const validWEngine = {
    id: "test_w_engine",
    name: { zhCN: "测试音擎" },
    rarity: "S",
    specialty: "attack",
    level60: {
        atkBase: 700,
        advancedStat: {
            stat: "critDmg",
            value: 48,
            mode: "flat",
        },
    },
    effect: {
        name: { zhCN: "测试效果" },
        description: { zhCN: "造成伤害时提升暴击伤害。" },
        selfBuff: {
            scope: "inCombat",
            effects: [
                {
                    type: "fixed",
                    stat: "critDmg",
                    value: 20,
                    mode: "flat",
                },
            ],
        },
    },
}

const validDriveDiscSet = {
    id: "test_drive_disc",
    name: { zhCN: "测试驱动盘" },
}

const validAgentSkill = {
    id: "test_agent_skill",
    agentId: "test_agent",
    name: { zhCN: "测试角色技能倍率" },
    categories: [
        {
            id: "basic",
            name: { zhCN: "普通攻击" },
            levelRange: { min: 1, max: 3, default: 2 },
            moves: [
                {
                    id: "normal",
                    name: { zhCN: "普通攻击：测试" },
                    skillType: "basic",
                    damageElement: "physical",
                    rows: [
                        {
                            id: "hit_1",
                            label: { zhCN: "一段伤害倍率" },
                            kind: "damageMultiplier",
                            values: [100, 110, 120],
                        },
                    ],
                },
            ],
        },
    ],
}
const catalog = await loadCalculatorContext(rootDir)
const juhufuCoreBuff = catalog.combatBuffs.find(buff => buff.id === "juhufu.core_tiger_roar_crit_dmg")
assert.ok(juhufuCoreBuff, "Juhufu core passive teammate Buff should exist")

const validDriveDiscSetWithSplitFourPiece = {
    ...validDriveDiscSet,
    fourPiece: {
        effectText: { zhCN: "4件套测试效果。" },
        selfBuff: {
            condition: "selfCondition",
            effects: [
                {
                    type: "fixed",
                    stat: "atkPct",
                    value: 10,
                    mode: "pct",
                    basis: "baseAtk",
                },
            ],
        },
        teamBuff: {
            condition: "teamCondition",
            effects: [
                {
                    type: "fixed",
                    stat: "atkPct",
                    value: 10,
                    mode: "pct",
                },
            ],
        },
    },
}

const validBuff = {
    id: "test_buff",
    sourceType: "manual",
    scope: "inCombat",
    name: { zhCN: "测试 Buff" },
    effects: [
        {
            type: "fixed",
            stat: "atkFlat",
            value: 100,
            mode: "flat",
        },
    ],
}

const validFieldBuff = {
    id: "test_field_buff",
    sourceType: "field",
    scope: "inCombat",
    name: { zhCN: "测试场地 Buff" },
    source: { zhCN: "危局强袭战" },
    period: {
        modeId: "critical_assault",
        gameVersion: "3.0",
        phaseNo: 3,
        phaseName: { zhCN: "第三期" },
    },
    sourcePeriod: { zhCN: "3.0版本第三期" },
    description: { zhCN: "场地使代理人造成的伤害提升。" },
    effects: [
        {
            type: "fixed",
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
            coverage: { default: 0.5, min: 0, max: 1, step: 0.1 },
        },
    ],
}

const validBossBuff = {
    id: "test_boss_buff",
    sourceType: "boss",
    scope: "inCombat",
    bossName: { zhCN: "测试 BOSS" },
    bossSource: { zhCN: "防卫战" },
    sourcePeriod: { zhCN: "2.8版本第三期" },
    description: { zhCN: "BOSS 受到的物理伤害提高。" },
    effects: [
        {
            type: "fixed",
            stat: "enemyPhysicalResReduction",
            value: 20,
            mode: "flat",
            coverage: { default: 1, min: 0, max: 1, step: 0.1 },
        },
    ],
}

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function assertValid(kind, item, context = {}) {
    assert.deepEqual(validateMaintenanceItem(kind, item, context), {
        ok: true,
        errors: [],
    })
}

function assertInvalid(kind, item, text, context = {}) {
    const result = validateMaintenanceItem(kind, item, context)
    assert.equal(result.ok, false)
    assert.ok(
        result.errors.some(error => error.includes(text)),
        `Expected an error containing ${text}, got:\n${result.errors.join("\n")}`,
    )
}

assertValid("agents", validAgent)
assertValid("agents", {
    ...validAgent,
    attribute: "frost",
    damageElement: "ice",
})
assertValid("agents", {
    ...validAgent,
    attribute: "xuanmo",
    damageElement: "ether",
    specialty: "rupture",
})
assertInvalid("agents", {
    ...validAgent,
    attribute: "frost",
    damageElement: "",
}, "特殊显示属性必须填写真实伤害结算属性")
assertValid("agents", {
    ...validAgent,
    preferredDriveDiscs: {
        mainStatLimits: {
            4: ["critRate", "critDmg"],
            5: ["physicalDmg", "atkPct"],
            6: ["atkPct"],
        },
    },
})
assertValid("agents", {
    ...validAgent,
    preferredDriveDiscs: {
        defaultSetId: validDriveDiscSet.id,
        mainStatLimits: {
            4: ["critRate"],
        },
    },
}, {
    driveDiscSets: [validDriveDiscSet],
})
assertInvalid("agents", {
    ...validAgent,
    preferredDriveDiscs: {
        defaultSetId: "missing_drive_disc",
    },
}, "驱动盘套装不存在", {
    driveDiscSets: [validDriveDiscSet],
})
assertValid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        cinemaBuffs: [1, 4, 6].map(level => ({
            cinemaLevel: level,
            cinemaName: { zhCN: `影画${level}名称` },
            description: { zhCN: `影画${level} Buff 描述` },
            scope: "inCombat",
            defaultChecked: false,
            effects: [
                {
                    type: "fixed",
                    stat: "atkFlat",
                    value: 100,
                    mode: "flat",
                },
            ],
        })),
    },
})
assertValid("agent-skills", validAgentSkill)
const agentSkillWithTags = clone(validAgentSkill)
agentSkillWithTags.categories[0].moves[0].skillTags = ["dashAttack", "assistAttack"]
assertValid("agent-skills", agentSkillWithTags)
const agentSkillWithUnknownTag = clone(validAgentSkill)
agentSkillWithUnknownTag.categories[0].moves[0].skillTags = ["futureAttack"]
assertInvalid("agent-skills", agentSkillWithUnknownTag, "不是支持的选项")
const agentSkillWithDuplicateTag = clone(validAgentSkill)
agentSkillWithDuplicateTag.categories[0].moves[0].skillTags = ["dashAttack", "dashAttack"]
assertInvalid("agent-skills", agentSkillWithDuplicateTag, "同一招式不能重复标签")
const agentSkillWithoutType = clone(validAgentSkill)
delete agentSkillWithoutType.categories[0].moves[0].skillType
assertInvalid("agent-skills", agentSkillWithoutType, "skillType")
const agentSkillWithSplitType = clone(validAgentSkill)
agentSkillWithSplitType.categories.push({
    ...clone(validAgentSkill.categories[0]),
    id: "second_basic_category",
    moves: [{
        ...clone(validAgentSkill.categories[0].moves[0]),
        id: "second_basic_move",
    }],
})
assertInvalid("agent-skills", agentSkillWithSplitType, "不能拆到多个技能目录")
const agentSkillWithLegacyCategoryIcon = clone(validAgentSkill)
agentSkillWithLegacyCategoryIcon.categories[0].icon = "not-a-maintained-field"
assertValid(
    "agent-skills",
    agentSkillWithLegacyCategoryIcon,
)
assertInvalid("agent-skills", {
    ...validAgentSkill,
    categories: [
        {
            ...validAgentSkill.categories[0],
            levelRange: { min: 1, max: 3, default: 4 },
        },
    ],
}, "默认等级必须在范围内")
assertInvalid("agent-skills", {
    ...validAgentSkill,
    categories: [
        {
            ...validAgentSkill.categories[0],
            moves: [
                {
                    ...validAgentSkill.categories[0].moves[0],
                    rows: [
                        {
                            ...validAgentSkill.categories[0].moves[0].rows[0],
                            values: [100, 110],
                        },
                    ],
                },
            ],
        },
    ],
}, "数量必须等于等级范围长度")
assertInvalid("agent-skills", {
    ...validAgentSkill,
    categories: [
        {
            ...validAgentSkill.categories[0],
            moves: [
                {
                    ...validAgentSkill.categories[0].moves[0],
                    rows: [
                        {
                            ...validAgentSkill.categories[0].moves[0].rows[0],
                            values: [100, "oops", 120],
                        },
                    ],
                },
            ],
        },
    ],
}, "必须是有效数字")
assertValid("wEngines", validWEngine)
assertValid("wEngines", {
    ...validWEngine,
    effect: {
        name: { zhCN: "无 Buff 测试效果" },
        description: { zhCN: "该音擎暂未建模 Buff 规则。" },
    },
})
const wEngineWithMismatchedRequirement = clone(validWEngine)
wEngineWithMismatchedRequirement.effect.requirement = {
    specialty: "stun",
}
assertInvalid("wEngines", wEngineWithMismatchedRequirement, "必须与音擎适配特性一致")

const wEngineWithModificationValues = clone(validWEngine)
wEngineWithModificationValues.modification = { minLevel: 1, maxLevel: 5, defaultLevel: 1 }
wEngineWithModificationValues.effect.selfBuff.effects[0].modificationValues = {
    value: [20, 22, 24, 26, 28],
}
assertValid("wEngines", wEngineWithModificationValues)

const wEngineWithStackedModificationValues = clone(validWEngine)
wEngineWithStackedModificationValues.effect.selfBuff.effects = [
    {
        type: "stacked",
        stat: "dmgBonus",
        valuePerStack: 5,
        mode: "flat",
        maxStacks: 4,
        defaultStacks: 4,
        modificationValues: {
            valuePerStack: [5, 6, 7, 8, 9],
        },
    },
]
assertValid("wEngines", wEngineWithStackedModificationValues)

const wEngineValuesMissingRanks = clone(wEngineWithModificationValues)
wEngineValuesMissingRanks.effect.selfBuff.effects[0].modificationValues.value = [20, 22, 24]
assertInvalid("wEngines", wEngineValuesMissingRanks, "必须覆盖 1-5")

const wEngineValuesBadNumber = clone(wEngineWithModificationValues)
wEngineValuesBadNumber.effect.selfBuff.effects[0].modificationValues.value = [20, 22, "oops", 26, 28]
assertInvalid("wEngines", wEngineValuesBadNumber, "必须是有效数字")

const wEngineValuesRankOneMismatch = clone(wEngineWithModificationValues)
wEngineValuesRankOneMismatch.effect.selfBuff.effects[0].modificationValues.value[0] = 19
assertInvalid("wEngines", wEngineValuesRankOneMismatch, "1级实际值必须与规则当前数值一致")

const wEngineWithLegacyModificationScaling = clone(validWEngine)
wEngineWithLegacyModificationScaling.effect.selfBuff.effects[0].modificationScaling = {
    value: {
        base: 20,
        step: 2,
        displayValues: [20, 22, 24, 26, 28],
    },
}
assertInvalid("wEngines", wEngineWithLegacyModificationScaling, "旧的改装等级缩放格式已废弃")
assertValid("driveDiscSets", validDriveDiscSet)
assertValid("driveDiscSets", validDriveDiscSetWithSplitFourPiece)
const driveDiscWithImplicitInCombatFourPiece = clone(validDriveDiscSetWithSplitFourPiece)
driveDiscWithImplicitInCombatFourPiece.fourPiece.selfBuff.effects = [
    {
        id: "drive_disc_self_skill_target",
        type: "fixed",
        target: {
            kind: "skill",
            skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
        },
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
    },
]
driveDiscWithImplicitInCombatFourPiece.fourPiece.teamBuff.effects = [
    {
        id: "drive_disc_team_skill_target",
        type: "fixed",
        target: {
            kind: "skill",
            skillTargets: [{ kind: "skillType", skillType: "chain" }],
        },
        stat: "skillMultiplierBonus",
        value: 10,
        mode: "flat",
    },
]
driveDiscWithImplicitInCombatFourPiece.fourPiece.teamBuff.buffModifiers = [
    {
        id: "drive_disc_team_modifier",
        operation: "multiplyResolvedValue",
        factor: 1.2,
        targetBuffIds: ["teammate.buff"],
        targetEffectIds: ["teammate.effect"],
    },
]
assertValid("driveDiscSets", driveDiscWithImplicitInCombatFourPiece)
assertValid("buffs", validBuff)
assertValid("field-buffs", validFieldBuff)
assertValid("boss-buffs", validBossBuff)
assertValid("buffs", {
    ...validBuff,
    id: undefined,
})
assertValid("buffs", {
    ...validBuff,
    sourceType: "boss",
    effects: [
        {
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
        },
    ],
})
const defenseIgnoreBuff = {
    ...validBuff,
    effects: [
        {
            id: "effect-defense-ignore",
            type: "fixed",
            stat: "enemyDefIgnore",
            value: 20,
            mode: "flat",
        },
    ],
}
assert.equal(
    cleanMaintenanceItem("combat-buffs", defenseIgnoreBuff).effects[0].stat,
    "enemyDefIgnore",
    "Maintenance save cleanup should preserve defense ignore as a display-distinct stat",
)
const curtainCapBuff = {
    ...validBuff,
    effects: [{
        id: "curtain-cap",
        type: "fixed",
        stat: "stunDmgMultiplierBonusCapAlways",
        value: 110,
        mode: "flat",
        target: { kind: "default" },
    }],
    buffModifiers: [{
        id: "curtain-cap-amplify",
        operation: "multiplyResolvedValue",
        factor: 20 / 11,
        targetBuffIds: [validBuff.id],
        targetEffectIds: ["curtain-cap"],
    }],
}
assertValid("combat-buffs", curtainCapBuff)
const cleanedCurtainCapBuff = cleanMaintenanceItem("combat-buffs", curtainCapBuff)
assert.equal(cleanedCurtainCapBuff.effects[0].stat, "stunDmgMultiplierBonusCapAlways")
assert.equal(cleanedCurtainCapBuff.effects[0].value, 110)
assert.equal(cleanedCurtainCapBuff.buffModifiers[0].factor, 20 / 11)
assert.deepEqual(cleanedCurtainCapBuff.buffModifiers[0].targetEffectIds, ["curtain-cap"])
const cleanedElementScopedBuff = cleanMaintenanceItem("combat-buffs", {
    ...validBuff,
    effects: [
        { id: "multi-dmg", type: "fixed", stat: "dmgBonus", value: 20, mode: "flat", appliesTo: { elements: ["physical", "fire"] } },
        { id: "electric-ignore", type: "fixed", stat: "enemyDefIgnore", value: 15, mode: "flat", appliesTo: { elements: ["electric"] } },
    ],
    buffModifiers: [{
        id: "modifier",
        operation: "multiplyResolvedValue",
        factor: 2,
        targetBuffIds: [validBuff.id],
        targetEffectIds: ["multi-dmg"],
    }],
})
assert.deepEqual(cleanedElementScopedBuff.effects.map(rule => rule.stat), ["physicalDmg", "fireDmg", "electricDefIgnore"])
assert.ok(cleanedElementScopedBuff.effects.every(rule => rule.appliesTo === undefined))
assert.deepEqual(cleanedElementScopedBuff.buffModifiers[0].targetEffectIds, ["multi-dmg_physicalDmg", "multi-dmg_fireDmg"])
assertValid("combat-buffs", cleanedElementScopedBuff)
const cleanedLegacySkillModifier = cleanMaintenanceItem("combat-buffs", {
    ...validBuff,
    effects: [{
        id: "legacy-skill-modifier",
        type: "damageModifier",
        kind: "directDamageBonus",
        value: 0.2,
        valueUnit: "decimal",
        appliesTo: {
            skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
        },
    }],
})
assert.equal(cleanedLegacySkillModifier.effects[0].type, "fixed")
assert.equal(cleanedLegacySkillModifier.effects[0].stat, "dmgBonus")
assert.equal(cleanedLegacySkillModifier.effects[0].value, 20)
assert.deepEqual(cleanedLegacySkillModifier.effects[0].target, {
    kind: "skill",
    skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
})
assertValid("combat-buffs", cleanedLegacySkillModifier)
assert.equal(
    cleanMaintenanceItem("combat-buffs", {
        ...defenseIgnoreBuff,
        effects: [],
        stats: [
            {
                stat: "enemyDefIgnore",
                value: 20,
                mode: "flat",
            },
        ],
    }).stats[0].stat,
    "enemyDefIgnore",
    "Legacy stat cleanup should preserve defense ignore as a display-distinct stat",
)
assertValid("buffs", {
    ...validBuff,
    sourceType: "boss",
    effects: [
        {
            type: "fixed",
            stat: "enemyDefIgnore",
            value: 20,
            mode: "flat",
        },
    ],
})
assertValid("buffs", {
    ...validBuff,
    sourceType: "boss",
    effects: [
        {
            type: "fixed",
            stat: "enemyPhysicalResReduction",
            value: 20,
            mode: "flat",
        },
    ],
})
assert.equal(
    cleanMaintenanceItem("field-buffs", {
        ...validFieldBuff,
        sourcePeriod: undefined,
    }).sourcePeriod.zhCN,
    "3.0版本第三期",
)
assert.equal(
    cleanMaintenanceItem("field-buffs", {
        ...validFieldBuff,
        id: "existing_field_id",
    }).id,
    "existing_field_id",
    "Existing Field Buff ids should be preserved on save",
)
{
    const cleanedFieldBuff = cleanMaintenanceItem("field-buffs", {
        ...validFieldBuff,
        id: "hand_edited_wrong_id",
        _maintenanceOriginalId: "existing_field_id",
    }, { originalId: "existing_field_id" })
    assert.equal(cleanedFieldBuff.id, "existing_field_id")
    assert.equal(
        Object.hasOwn(cleanedFieldBuff, "_maintenanceOriginalId"),
        false,
        "Internal maintenance id hints should not be persisted",
    )
}
assert.equal(
    cleanMaintenanceItem("field-buffs", {
        ...validFieldBuff,
        id: undefined,
        name: { zhCN: "stage buff" },
    }).id,
    "field.critical_assault.v3_0.p3.stage_buff",
    "Missing Field Buff ids should be generated from period and name",
)
{
    const cleanedFieldBuff = cleanMaintenanceItem("field-buffs", {
        ...validFieldBuff,
        source: { zhCN: "管理员乱填" },
        sourcePeriod: { zhCN: "管理员乱填" },
        period: {
            ...validFieldBuff.period,
            phaseName: { zhCN: "管理员乱填" },
        },
    })
    assert.equal(cleanedFieldBuff.source.zhCN, "危局强袭战")
    assert.equal(cleanedFieldBuff.period.phaseName.zhCN, "第三期")
    assert.equal(cleanedFieldBuff.sourcePeriod.zhCN, "3.0版本第三期")
}
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        modeId: "free_text_mode",
    },
}, "period.modeId")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        gameVersion: "",
    },
}, "period.gameVersion")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        gameVersion: "3.4",
    },
}, "period.gameVersion")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        phaseNo: "",
    },
}, "period.phaseNo")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        phaseNo: 5,
        phaseName: { zhCN: "第五期" },
    },
}, "period.phaseNo")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    period: {
        ...validFieldBuff.period,
        phaseName: { zhCN: "" },
    },
}, "period.phaseName.zhCN")
assertInvalid("field-buffs", {
    ...validFieldBuff,
    scope: "outOfCombat",
}, "不是支持的选项")
assertInvalid("boss-buffs", {
    ...validBossBuff,
    bossName: { zhCN: "" },
}, "中文名必填")
assertInvalid("boss-buffs", {
    ...validBossBuff,
    effects: [],
}, "至少需要一条")
assertInvalid("buffs", {
    ...validBuff,
    scope: "outOfCombat",
    effects: [
        {
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
        },
    ],
}, "敌方目标属性只能用于局内")
assertInvalid("buffs", {
    ...validBuff,
    scope: "outOfCombat",
    effects: [
        {
            type: "fixed",
            stat: "enemyResReduction",
            value: 20,
            mode: "flat",
        },
    ],
}, "敌方目标属性只能用于局内")

assertInvalid("agents", { ...validAgent, id: "" }, "id: 必填")
assertInvalid("agents", { ...validAgent, id: "Bad ID" }, "只能使用小写字母")
assertInvalid("agents", { ...validAgent, name: { zhCN: "未命名" } }, "保存前请把")
assertInvalid("agents", { ...validAgent, rarity: "SS" }, "rarity")
assertInvalid("agents", {
    ...validAgent,
    preferredDriveDiscs: {
        mainStatLimits: {
            4: ["not_a_stat"],
        },
    },
}, "preferredDriveDiscs.mainStatLimits.4")
assertInvalid("agents", {
    ...validAgent,
    level60: {
        ...validAgent.level60,
        atkBase: 0,
    },
}, "level60.atkBase")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        cinemaBuffs: [
            {
                cinemaLevel: 0,
                cinemaName: { zhCN: "错误影画" },
                description: { zhCN: "错误影画 Buff 描述" },
                scope: "inCombat",
                effects: [
                    {
                        type: "fixed",
                        stat: "atkFlat",
                        value: 100,
                        mode: "flat",
                    },
                ],
            },
        ],
    },
}, "影画序号必须是 1 到 6")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        cinemaBuffs: [
            {
                cinemaLevel: 1,
                cinemaName: { zhCN: "影画一" },
                description: { zhCN: "影画一 Buff 描述" },
                scope: "inCombat",
                effects: [
                    {
                        type: "fixed",
                        stat: "atkFlat",
                        value: 100,
                        mode: "flat",
                    },
                ],
            },
            {
                cinemaLevel: 1,
                cinemaName: { zhCN: "影画一重复" },
                description: { zhCN: "影画一重复 Buff 描述" },
                scope: "inCombat",
                effects: [
                    {
                        type: "fixed",
                        stat: "atkFlat",
                        value: 100,
                        mode: "flat",
                    },
                ],
            },
        ],
    },
}, "同一角色不能重复录入同一影画")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        cinemaBuffs: [
            {
                cinemaLevel: 1,
                cinemaName: { zhCN: "缺少基准" },
                description: { zhCN: "缺少基准 Buff 描述" },
                scope: "inCombat",
                effects: [
                    {
                        type: "fixed",
                        stat: "atkPct",
                        value: 10,
                        mode: "pct",
                    },
                ],
            },
        ],
    },
}, "必须填写基准")
assertInvalid("agents", validAgent, "重复 ID", {
    items: [{ id: validAgent.id }],
})
assertValid("agents", validAgent, {
    items: [{ id: validAgent.id }],
    currentId: validAgent.id,
})

const missingAdvanced = clone(validWEngine)
missingAdvanced.level60.advancedStat = null
assertInvalid("wEngines", missingAdvanced, "高级属性必填")

const wEngineWithoutBuffRules = clone(validWEngine)
wEngineWithoutBuffRules.effect.selfBuff.effects = []
assertValid("wEngines", wEngineWithoutBuffRules)

assertValid("driveDiscSets", validDriveDiscSet)

const brokenFourPiece = {
    ...validDriveDiscSet,
    fourPiece: {
        effects: [],
    },
}
assertInvalid("driveDiscSets", brokenFourPiece, "中文效果文案")

const missingDriveDiscSelfBasis = clone(validDriveDiscSetWithSplitFourPiece)
delete missingDriveDiscSelfBasis.fourPiece.selfBuff.effects[0].basis
assertInvalid("driveDiscSets", missingDriveDiscSelfBasis, "必须填写基准")

const badCoverage = {
    ...validBuff,
    effects: [{ ...validBuff.effects[0], coverage: { default: 1.5, min: 0, max: 1, step: 0.1 } }],
}
assertInvalid("buffs", badCoverage, "覆盖率必须在 0 到 1")
assertInvalid("buffs", {
    ...validBuff,
    scope: "outOfCombat",
    effects: [{ ...validBuff.effects[0], coverage: { default: 0.5, min: 0, max: 1, step: 0.1 } }],
}, "只有局内 Buff 增幅可以配置覆盖率")

const emptyBuffRules = {
    ...validBuff,
    effects: [],
}
assertInvalid("buffs", emptyBuffRules, "至少需要一条")

assertInvalid("buffs", {
    ...validBuff,
    id: "Bad ID",
}, "只能使用小写字母")

const badDerived = {
    ...validBuff,
    effects: [
        {
            type: "derived",
            stat: "atkFlat",
            mode: "flat",
            sourceLabel: { zhCN: "来源攻击力" },
            defaultSourceValue: 3000,
            ratio: 0,
        },
    ],
}
assertInvalid("buffs", badDerived, "转换比例不能为 0")

const badStacked = {
    ...validBuff,
    effects: [
        {
            type: "stacked",
            stat: "atkPct",
            mode: "pct",
            valuePerStack: 5,
            maxStacks: 3,
            defaultStacks: 4,
        },
    ],
}
assertInvalid("buffs", badStacked, "默认层数")

const badSharedStackGroup = {
    ...validBuff,
    effects: [
        {
            id: "stack-a",
            type: "stacked",
            stat: "etherDmg",
            mode: "flat",
            valuePerStack: 8,
            maxStacks: 2,
            defaultStacks: 2,
            stackGroup: "qingming_companion",
            stackLabel: { zhCN: "青溟同行层数" },
        },
        {
            id: "stack-b",
            type: "stacked",
            stat: "etherSheerDmg",
            mode: "flat",
            valuePerStack: 10,
            maxStacks: 3,
            defaultStacks: 2,
            stackGroup: "qingming_companion",
            stackLabel: { zhCN: "青溟同行层数" },
        },
    ],
}
assertInvalid("buffs", badSharedStackGroup, "共享层数组")

const validFormula = {
    ...validBuff,
    effects: [
        {
            type: "formula",
            stat: "dmgBonus",
            mode: "flat",
            source: {
                variable: "x",
                label: { zhCN: "照的初始最大生命值" },
                defaultValue: 27000,
                min: 15000,
                max: 27000,
            },
            formula: {
                expression: "clamp(floor((x - 15000) / 400) + 10, 10, 40)",
                valueUnit: "storedPercent",
            },
        },
    ],
}
assertValid("buffs", validFormula)

const badFormula = clone(validFormula)
badFormula.effects[0].formula.expression = "window.x"
assertInvalid("buffs", badFormula, "公式无效")

const badFormulaUnknownFunction = clone(validFormula)
badFormulaUnknownFunction.effects[0].formula.expression = "sqrt(x)"
assertInvalid("buffs", badFormulaUnknownFunction, "公式无效")

const badFormulaUnknownVariable = clone(validFormula)
badFormulaUnknownVariable.effects[0].formula.expression = "y + 1"
assertInvalid("buffs", badFormulaUnknownVariable, "公式无效")

const badFormulaEmpty = clone(validFormula)
badFormulaEmpty.effects[0].formula.expression = ""
assertInvalid("buffs", badFormulaEmpty, "公式必填")

const badFormulaInfinite = clone(validFormula)
badFormulaInfinite.effects[0].formula.expression = "1 / 0"
assertInvalid("buffs", badFormulaInfinite, "公式无效")

const badFormulaDefault = clone(validFormula)
badFormulaDefault.effects[0].source.defaultValue = 30000
assertInvalid("buffs", badFormulaDefault, "不能高于上限")

const missingWEngineBasis = clone(validWEngine)
missingWEngineBasis.effect.selfBuff.effects = [
    {
        type: "fixed",
        stat: "atkPct",
        value: 10,
        mode: "pct",
    },
]
assertInvalid("wEngines", missingWEngineBasis, "必须填写基准")

const teamWEngineAtkPercent = clone(validWEngine)
teamWEngineAtkPercent.effect.selfBuff = null
teamWEngineAtkPercent.effect.teamBuff = {
    scope: "inCombat",
    effects: [
        {
            type: "fixed",
            stat: "atkPct",
            value: 10,
            mode: "pct",
        },
    ],
}
assertValid("wEngines", teamWEngineAtkPercent)

const validTeammateBuff = {
    teammate: {
        id: "test_teammate",
        name: { zhCN: "测试队友" },
        attribute: "physical",
        specialty: "support",
    },
    buff: {
        id: "test_teammate_buff",
        source: { zhCN: "核心被动" },
        scope: "inCombat",
        effects: [
            {
                type: "fixed",
                stat: "atkFlat",
                value: 100,
                mode: "flat",
            },
        ],
    },
}
assertValid("teammate-buffs", validTeammateBuff)
assertInvalid("teammate-buffs", {
    ...validTeammateBuff,
    teammate: { ...validTeammateBuff.teammate, attribute: "" },
}, "teammate.attribute")
assertInvalid("teammate-buffs", {
    ...validTeammateBuff,
    teammate: { ...validTeammateBuff.teammate, specialty: "healer" },
}, "teammate.specialty")
assertValid("teammate-buffs", {
    ...validTeammateBuff,
    teammate: {
        ...validTeammateBuff.teammate,
        images: {
            icon: "/assets/agents/lucy.png",
            source: "https://wiki.biligame.com/zzz/%E8%A7%92%E8%89%B2%E5%9B%BE%E9%89%B4",
        },
    },
})
assertInvalid("teammate-buffs", {
    ...validTeammateBuff,
    teammate: {
        ...validTeammateBuff.teammate,
        images: {
            icon: "assets/agents/lucy.png",
            source: "wiki.biligame.com/zzz",
        },
    },
}, "图片路径必须是")
assertValid("teammate-buffs", {
    ...validTeammateBuff,
    buff: {
        ...validTeammateBuff.buff,
        id: undefined,
    },
})
assertInvalid("teammate-buffs", {
    ...validTeammateBuff,
    buff: {
        ...validTeammateBuff.buff,
        id: "Bad ID",
    },
}, "只能使用小写字母")
assertInvalid("teammate-buffs", {
    ...validTeammateBuff,
    buff: {
        ...validTeammateBuff.buff,
        source: { zhCN: "" },
    },
}, "buff.source.zhCN")

const validAnomalyEffect = {
    id: "test_assault",
    maintenanceType: "anomaly",
    settlementType: "attribute",
    label: { zhCN: "测试强击" },
    element: "physical",
    baseMultiplier: 7.13,
    defaultProcCount: 1,
}
assertValid("anomaly-effects", validAnomalyEffect)
assertInvalid("anomaly-effects", {
    ...validAnomalyEffect,
    label: { zhCN: "" },
}, "label.zhCN")
assertInvalid("anomaly-effects", {
    ...validAnomalyEffect,
    element: "honed_edge",
}, "element")
assertInvalid("anomaly-effects", {
    ...validAnomalyEffect,
    element: "frost",
}, "element")
assertInvalid("anomaly-effects", {
    ...validAnomalyEffect,
    baseMultiplier: -1,
}, "不能小于 0")
assertInvalid("anomaly-effects", validAnomalyEffect, "重复", {
    items: [validAnomalyEffect],
})

const validDisorderEffect = {
    id: "test_burn",
    maintenanceType: "disorder",
    settlementType: "disorder",
    label: { zhCN: "测试灼烧紊乱" },
    element: "fire",
    fixedMultiplier: 4.5,
    tickMultiplier: 0.5,
    tickIntervalSeconds: 0.5,
    defaultDurationSeconds: 10,
}
assertValid("anomaly-effects", validDisorderEffect)
assertInvalid("anomaly-effects", {
    ...validDisorderEffect,
    tickIntervalSeconds: 0,
}, "跳间隔必须大于 0")

const validCalculationContext = {
    agentSkills: [validAgentSkill],
    anomalyEffects: [validAnomalyEffect],
    disorderEffects: [validDisorderEffect],
    effects: [validAnomalyEffect, validDisorderEffect],
}
const validDefaultCalculationConfig = {
    mode: "custom",
    name: { zhCN: "测试默认循环" },
    selectedEventId: "direct-1",
    events: [
        {
            id: "direct-1",
            kind: "direct",
            count: 2,
            stunned: true,
            critMode: "expected",
            skillRef: {
                agentSkillId: "test_agent_skill",
                categoryId: "basic",
                moveId: "normal",
                rowId: "hit_1",
            },
        },
        {
            id: "anomaly-1",
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffect: "test_assault",
            procCount: 1,
            count: 1,
            stunned: false,
        },
        {
            id: "disorder-1",
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: "test_burn",
            elapsedSeconds: 0,
            durationSeconds: 10,
            count: 1,
            stunned: true,
        },
    ],
}
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: validDefaultCalculationConfig,
}, validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        events: [{ ...validDefaultCalculationConfig.events[0], stunned: "false" }],
    },
}, "是否失衡必须是布尔值", validCalculationContext)
const validCinemaVariantCalculationConfig = {
    ...validDefaultCalculationConfig,
    cinemaLevel: 0,
    name: { zhCN: "默认循环（0影）" },
    variants: [
        {
            cinemaLevel: 2,
            mode: "custom",
            name: { zhCN: "默认循环（2影）" },
            selectedEventId: "direct-2",
            events: [
                {
                    ...validDefaultCalculationConfig.events[0],
                    id: "direct-2",
                    count: 4,
                },
            ],
        },
        {
            cinemaLevel: 6,
            mode: "custom",
            selectedEventId: "direct-6",
            events: [
                {
                    ...validDefaultCalculationConfig.events[0],
                    id: "direct-6",
                    count: 6,
                },
            ],
        },
    ],
}
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: validCinemaVariantCalculationConfig,
}, validCalculationContext)
const cleanedCinemaVariantAgent = cleanMaintenanceItem("agents", {
    ...validAgent,
    defaultCalculationConfig: validCinemaVariantCalculationConfig,
})
assert.equal(cleanedCinemaVariantAgent.defaultCalculationConfig.cinemaLevel, 0)
assert.equal(cleanedCinemaVariantAgent.defaultCalculationConfig.variants[0].cinemaLevel, 2)
assert.equal(cleanedCinemaVariantAgent.defaultCalculationConfig.variants[0].selectedEventId, "direct-2")
assert.equal(cleanedCinemaVariantAgent.defaultCalculationConfig.variants[1].name.zhCN, "默认循环（6影）")
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validCinemaVariantCalculationConfig,
        variants: [
            {
                ...validCinemaVariantCalculationConfig.variants[0],
                cinemaLevel: 0,
            },
        ],
    },
}, "默认循环影画等级不能重复", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validCinemaVariantCalculationConfig,
        variants: [
            {
                ...validCinemaVariantCalculationConfig.variants[0],
                cinemaLevel: 7,
            },
        ],
    },
}, "影画等级必须是 0 到 6", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validCinemaVariantCalculationConfig,
        variants: [
            {
                ...validCinemaVariantCalculationConfig.variants[0],
                events: [],
            },
        ],
    },
}, "至少需要一个事件或技能组", validCalculationContext)
const validSkillGroups = [
    {
        id: "loop",
        name: { zhCN: "一变" },
        description: { zhCN: "一轮技能循环" },
        defaultCount: 10,
        minCount: 0,
        maxCount: 30,
        step: 1,
        events: [
            {
                ...validDefaultCalculationConfig.events[0],
                id: "loop-direct",
                count: 2,
            },
        ],
    },
    {
        id: "ultimate",
        name: { zhCN: "一大" },
        defaultCount: 2,
        minCount: 0,
        maxCount: 10,
        step: 1,
        events: [
            {
                ...validDefaultCalculationConfig.events[0],
                id: "ultimate-direct",
                count: 1,
            },
        ],
    },
]
const validSkillGroupCalculationConfig = {
    ...validDefaultCalculationConfig,
    selectedEventId: "loop-ref",
    events: [
        {
            id: "loop-ref",
            kind: "skillGroup",
            skillGroupId: "loop",
            count: 10,
            stunned: false,
        },
        {
            id: "ultimate-ref",
            kind: "skillGroup",
            skillGroupId: "ultimate",
            count: 2,
            stunned: true,
        },
    ],
}
assertValid("agents", {
    ...validAgent,
    skillGroups: validSkillGroups,
    defaultCalculationConfig: validSkillGroupCalculationConfig,
}, validCalculationContext)
const cleanedSkillGroupAgent = cleanMaintenanceItem("agents", {
    ...validAgent,
    skillGroups: validSkillGroups,
    defaultCalculationConfig: validSkillGroupCalculationConfig,
})
assert.equal(cleanedSkillGroupAgent.skillGroups[0].id, "loop")
assert.equal(cleanedSkillGroupAgent.skillGroups[0].events[0].id, "loop-direct")
assert.equal(cleanedSkillGroupAgent.skillGroups[0].events[0].stunned, true)
assert.equal(cleanedSkillGroupAgent.defaultCalculationConfig.events[0].kind, "skillGroup")
assert.equal(cleanedSkillGroupAgent.defaultCalculationConfig.events[0].skillGroupId, "loop")
assert.equal(cleanedSkillGroupAgent.defaultCalculationConfig.events[0].stunned, false)
assert.equal(cleanedSkillGroupAgent.defaultCalculationConfig.skillGroups, undefined)
assert.equal(cleanedSkillGroupAgent.defaultCalculationConfig.skillGroupPresets, undefined)
const legacySkillGroupOnlyCalculationConfig = {
    ...validSkillGroupCalculationConfig,
    selectedEventId: null,
    events: [],
    skillGroups: validSkillGroups,
    skillGroupPresets: [
        {
            id: "10_loop_2_ult",
            name: { zhCN: "10变2大" },
            counts: {
                loop: 10,
                ultimate: 2,
            },
        },
    ],
    defaultSkillGroupPresetId: "10_loop_2_ult",
}
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: legacySkillGroupOnlyCalculationConfig,
}, validCalculationContext)
const cleanedLegacySkillGroupOnlyAgent = cleanMaintenanceItem("agents", {
    ...validAgent,
    defaultCalculationConfig: legacySkillGroupOnlyCalculationConfig,
})
assert.equal(cleanedLegacySkillGroupOnlyAgent.skillGroups[0].id, "loop")
assert.equal(cleanedLegacySkillGroupOnlyAgent.defaultCalculationConfig.events[0].kind, "skillGroup")
assert.equal(cleanedLegacySkillGroupOnlyAgent.defaultCalculationConfig.events[0].count, 10)
assert.equal(cleanedLegacySkillGroupOnlyAgent.defaultCalculationConfig.events[1].skillGroupId, "ultimate")
assert.equal(cleanedLegacySkillGroupOnlyAgent.defaultCalculationConfig.skillGroups, undefined)
assert.equal(cleanedLegacySkillGroupOnlyAgent.defaultCalculationConfig.skillGroupPresets, undefined)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: validSkillGroups.map(group => ({ ...group, id: "loop" })),
    defaultCalculationConfig: validSkillGroupCalculationConfig,
}, "技能组 ID 不能重复", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: [
        {
            ...validSkillGroups[0],
            id: "",
        },
    ],
    defaultCalculationConfig: validSkillGroupCalculationConfig,
}, "必填", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: [
        {
            ...validSkillGroups[0],
            events: [
                {
                    ...validSkillGroups[0].events[0],
                    skillRef: {
                        ...validSkillGroups[0].events[0].skillRef,
                        rowId: "missing",
                    },
                },
            ],
        },
    ],
    defaultCalculationConfig: validSkillGroupCalculationConfig,
}, "技能倍率行不存在", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: validSkillGroups,
    defaultCalculationConfig: {
        ...validSkillGroupCalculationConfig,
        events: [
            {
                ...validSkillGroupCalculationConfig.events[0],
                skillGroupId: "missing",
            },
        ],
    },
}, "技能组不存在", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: validSkillGroups,
    defaultCalculationConfig: {
        ...validSkillGroupCalculationConfig,
        events: [
            {
                ...validSkillGroupCalculationConfig.events[0],
                count: -1,
            },
        ],
    },
}, "次数不能小于 0", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    skillGroups: validSkillGroups,
    defaultCalculationConfig: {
        ...validSkillGroupCalculationConfig,
        events: [
            {
                ...validSkillGroupCalculationConfig.events[1],
                count: 99,
            },
        ],
    },
}, "次数不能大于技能组最大次数", validCalculationContext)
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        selectedEventId: "disorder-1",
        events: [
            {
                ...validDefaultCalculationConfig.events[2],
                disorderType: "polarized",
            },
        ],
    },
}, validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        selectedEventId: "disorder-1",
        events: [
            {
                ...validDefaultCalculationConfig.events[2],
                disorderType: "invalid",
            },
        ],
    },
}, "disorderType", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        selectedEventId: null,
        events: [],
    },
}, "至少需要一个事件或技能组", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        events: [
            {
                ...validDefaultCalculationConfig.events[0],
                count: -1,
            },
        ],
    },
}, "次数必须大于 0", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        events: [
            {
                ...validDefaultCalculationConfig.events[0],
                skillRef: {
                    ...validDefaultCalculationConfig.events[0].skillRef,
                    rowId: "missing",
                },
            },
        ],
    },
}, "技能倍率行不存在", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        events: [
            {
                ...validDefaultCalculationConfig.events[1],
                anomalyEffect: "missing",
            },
        ],
    },
}, "属性异常不存在", validCalculationContext)
assertInvalid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        events: [
            {
                ...validDefaultCalculationConfig.events[2],
                anomalyEffect: "missing",
            },
        ],
    },
}, "紊乱类型不存在", validCalculationContext)
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        mode: "sheer",
        selectedEventId: "sheer-1",
        events: [
            {
                id: "sheer-1",
                kind: "sheer",
                count: 1,
                critMode: "expected",
                skillRef: {
                    agentSkillId: "test_agent_skill",
                    categoryId: "basic",
                    moveId: "normal",
                    rowId: "hit_1",
                },
            },
        ],
    },
}, validCalculationContext)
const manualSheerCalculationConfig = {
    ...validDefaultCalculationConfig,
    mode: "sheer",
    selectedEventId: "manual-sheer",
    events: [
        {
            id: "manual-sheer",
            kind: "sheer",
            label: "额外能力：落雷",
            skillMultiplier: 225,
            damageElement: "ether",
            count: 1,
            critMode: "expected",
        },
    ],
}
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: manualSheerCalculationConfig,
}, validCalculationContext)
const cleanedManualSheerAgent = cleanMaintenanceItem("agents", {
    ...validAgent,
    defaultCalculationConfig: manualSheerCalculationConfig,
})
assert.equal(cleanedManualSheerAgent.defaultCalculationConfig.events[0].label, "额外能力：落雷")
assert.equal(cleanedManualSheerAgent.defaultCalculationConfig.events[0].skillMultiplier, 225)
assert.equal(cleanedManualSheerAgent.defaultCalculationConfig.events[0].damageElement, "ether")
assertValid("agents", {
    ...validAgent,
    defaultCalculationConfig: {
        ...validDefaultCalculationConfig,
        selectedEventId: "legacy-disorder",
        events: [
            {
                id: "legacy-disorder",
                kind: "disorder",
                previousAnomalyEffect: "test_burn",
                elapsedSeconds: 0,
                durationSeconds: 10,
                count: 1,
            },
        ],
    },
}, validCalculationContext)

const buffWithDamageModifier = {
    id: "test_damage_modifier",
    sourceType: "manual",
    scope: "inCombat",
    name: { zhCN: "测试异常增伤" },
    effects: [
        {
            type: "damageModifier",
            kind: "anomalyDamageBonus",
            value: 0.2,
            appliesTo: {
                damageKinds: ["anomaly"],
                anomalyEffects: ["test_assault"],
                elements: ["physical"],
            },
        },
        {
            type: "damageModifier",
            kind: "disorderDamageBonus",
            value: 0.3,
            appliesTo: {
                damageKinds: ["disorder"],
            },
        },
    ],
}
assertInvalid("combat-buffs", buffWithDamageModifier, "旧适用范围不能继续保存")
assertValid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            id: "effect-disorder-fixed",
            type: "fixed",
            stat: "disorderDamageBonus",
            value: 15,
            mode: "flat",
        },
        {
            id: "effect-disorder-multiplier-fixed",
            type: "fixed",
            stat: "disorderBaseMultiplierBonus",
            value: 105,
            mode: "flat",
        },
    ],
})
assertValid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            id: "effect-sheer-fixed",
            type: "fixed",
            stat: "sheerDmgBonus",
            value: 10,
            mode: "flat",
        },
        {
            id: "effect-physical-sheer-fixed",
            type: "fixed",
            stat: "physicalSheerDmg",
            value: 15,
            mode: "flat",
        },
    ],
})
assertInvalid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            type: "damageModifier",
            kind: "sheerDmgBonus",
            value: 0.2,
            valueUnit: "decimal",
            appliesTo: {
                damageKinds: ["sheer"],
            },
        },
    ],
}, "旧适用范围不能继续保存")
assertInvalid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            type: "damageModifier",
            kind: "skillMultiplierBonus",
            value: 15,
            valueUnit: "decimal",
            appliesTo: {
                damageKinds: ["sheer"],
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                        rowId: "hit_1",
                    },
                ],
            },
        },
        {
            type: "damageModifier",
            kind: "directDamageBonus",
            value: 0.6,
            valueUnit: "decimal",
            appliesTo: {
                damageKinds: ["direct"],
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                    },
                ],
            },
        },
    ],
}, "旧适用范围不能继续保存")
const buffWithSkillTargetRules = {
    ...validBuff,
    id: "test_skill_target_rules",
    scope: "inCombat",
    effects: [
        {
            id: "effect-skill-dmg",
            type: "fixed",
            stat: "dmgBonus",
            value: 50,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                    },
                ],
            },
        },
        {
            id: "effect-skill-multiplier",
            type: "fixed",
            stat: "skillMultiplierBonus",
            value: 1500,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                        rowId: "hit_1",
                    },
                ],
            },
        },
        {
            id: "effect-skill-res-ignore",
            type: "fixed",
            stat: "physicalResIgnore",
            value: 20,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                    },
                ],
            },
        },
        {
            id: "effect-skill-all-res-ignore",
            type: "fixed",
            stat: "allResIgnore",
            value: 15,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        kind: "skillType",
                        skillType: "ultimate",
                    },
                ],
            },
        },
    ],
}
assertValid("combat-buffs", buffWithSkillTargetRules)
assertValid("combat-buffs", {
    ...validBuff,
    id: "test_skill_category_target",
    scope: "inCombat",
    effects: [
        {
            id: "effect-chain-dmg",
            type: "fixed",
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        categoryId: "chain",
                        moveIdPrefixes: ["chain_"],
                    },
                ],
            },
        },
    ],
})
assert.deepEqual(
    cleanMaintenanceItem("combat-buffs", {
        ...validBuff,
        effects: [{
            id: "legacy-chain",
            type: "fixed",
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
            target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["chain_"] }] },
        }],
    }).effects[0].target.skillTargets,
    [{ kind: "skillType", skillType: "chain" }],
)
assertValid("combat-buffs", {
    ...validBuff,
    id: "test_canonical_skill_types",
    effects: [{
        id: "canonical-types",
        type: "fixed",
        stat: "dmgBonus",
        value: 40,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [
                { kind: "skillType", skillType: "chain" },
                { kind: "skillType", skillType: "ultimate" },
            ],
        },
    }],
})
assertValid("combat-buffs", {
    ...validBuff,
    id: "test_canonical_skill_tags",
    effects: [{
        id: "canonical-tags",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [
                { kind: "skillTag", skillTag: "exSpecial" },
                { kind: "skillTag", skillTag: "assistAttack" },
            ],
        },
    }],
})
assertInvalid("combat-buffs", {
    ...validBuff,
    effects: [{
        id: "mixed-skill-target-modes",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [
                { kind: "skillTag", skillTag: "dashAttack" },
                { kind: "skillType", skillType: "dodge" },
            ],
        },
    }],
}, "不能混合指定角色招式、通用技能大类和通用招式标签")
assertInvalid("combat-buffs", {
    ...validBuff,
    effects: [{
        id: "unknown-skill-tag",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [{ kind: "skillTag", skillTag: "futureAttack" }],
        },
    }],
}, "不是支持的选项")
assertValid("combat-buffs", {
    ...validBuff,
    id: "test_canonical_specific_type",
    effects: [{
        id: "canonical-specific",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [{
                kind: "specific",
                agentSkillId: "test_agent_skill",
                categoryId: "basic",
                skillType: "basic",
            }],
        },
    }],
}, { agentSkills: [validAgentSkill] })
assertInvalid("combat-buffs", {
    ...validBuff,
    effects: [{
        id: "unknown-prefix",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["future_"] }] },
    }],
}, "旧版招式前缀无法转换")
assertInvalid("combat-buffs", {
    ...validBuff,
    effects: [{
        id: "mismatched-specific",
        type: "fixed",
        stat: "dmgBonus",
        value: 20,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [{
                kind: "specific",
                agentSkillId: "test_agent_skill",
                categoryId: "basic",
                skillType: "ultimate",
            }],
        },
    }],
}, "没有对应招式", { agentSkills: [validAgentSkill] })
assertValid("combat-buffs", juhufuCoreBuff)
assertValid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        corePassive: {
            scope: "inCombat",
            effects: [
                {
                    id: "effect-1",
                    type: "fixed",
                    stat: "skillMultiplierBonus",
                    value: 1500,
                    mode: "flat",
                    target: {
                        kind: "skill",
                        skillTargets: [
                            {
                                agentSkillId: "test_agent_skill",
                                categoryId: "basic",
                                moveId: "normal",
                            },
                        ],
                    },
                },
            ],
        },
    },
})
assertInvalid("combat-buffs", {
    ...validBuff,
    scope: "inCombat",
    effects: [
        {
            type: "fixed",
            stat: "dmgBonus",
            value: 50,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [],
            },
        },
    ],
}, "技能增幅必须至少选择一个技能目标")
assertInvalid("combat-buffs", {
    ...validBuff,
    scope: "inCombat",
    effects: [
        {
            type: "fixed",
            stat: "atkFlat",
            value: 100,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                    },
                ],
            },
        },
    ],
}, "技能增幅对象不支持该增幅类型")
assertInvalid("combat-buffs", {
    ...validBuff,
    scope: "inCombat",
    effects: [
        {
            type: "fixed",
            stat: "skillMultiplierBonus",
            value: 1500,
            mode: "flat",
            target: { kind: "default" },
        },
    ],
}, "不是支持的选项")
assertInvalid("combat-buffs", {
    ...validBuff,
    scope: "outOfCombat",
    effects: [
        {
            type: "fixed",
            stat: "dmgBonus",
            value: 50,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                    },
                ],
            },
        },
    ],
}, "技能增幅对象只能用于局内 Buff")
assertInvalid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            type: "damageModifier",
            kind: "skillMultiplierBonus",
            value: 15,
            valueUnit: "percent",
            appliesTo: {
                skillTargets: [
                    {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                    },
                ],
            },
        },
    ],
}, "不是支持的选项")
assertInvalid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
            type: "damageModifier",
            kind: "skillMultiplierBonus",
            value: 15,
            valueUnit: "decimal",
            appliesTo: {
                skillTargets: [
                    {
                        categoryId: "basic",
                    },
                ],
            },
        },
    ],
}, "旧适用范围不能继续保存")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        corePassive: {
            scope: "inCombat",
            effects: [
                {
                    id: "effect-1",
                    type: "damageModifier",
                    kind: "anomalyDamageBonus",
                    value: 0.15,
                    appliesTo: {
                        damageKinds: ["anomaly"],
                    },
                },
            ],
        },
    },
}, "旧适用范围不能继续保存")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        corePassive: {
            scope: "inCombat",
            effects: [
                {
                    id: "effect-1",
                    type: "damageModifier",
                    kind: "skillMultiplierBonus",
                    value: 15,
                    valueUnit: "decimal",
                    appliesTo: {
                        damageKinds: ["direct"],
                        skillTargets: [
                            {
                                agentSkillId: "test_agent_skill",
                                categoryId: "basic",
                                moveId: "normal",
                            },
                        ],
                    },
                },
            ],
        },
    },
}, "旧适用范围不能继续保存")
assertInvalid("agents", {
    ...validAgent,
    combatBuffs: {
        ...validAgent.combatBuffs,
        corePassive: {
            scope: "inCombat",
            effects: [
                {
                    id: "effect-1",
                    type: "damageModifier",
                    kind: "skillMultiplierBonus",
                    value: 15,
                    valueUnit: "decimal",
                    appliesTo: {
                        damageKinds: ["direct"],
                    },
                },
            ],
        },
    },
}, "指定技能修正必须至少选择一个技能目标")
assertInvalid("combat-buffs", {
    ...buffWithDamageModifier,
    scope: "outOfCombat",
}, "伤害修正只能用于局内 Buff")

const anomalyTargetBuff = {
    ...validBuff,
    scope: "inCombat",
    effects: [
        {
            id: "flinch-duration",
            type: "fixed",
            target: { kind: "anomaly", settlementType: "disorder", anomalyEffects: ["flinch"] },
            stat: "anomalyDurationBonusSeconds",
            mode: "flat",
            value: 5,
        },
        {
            id: "assault-crit",
            type: "fixed",
            target: { kind: "anomaly", settlementType: "attribute", anomalyEffects: ["assault"] },
            stat: "anomalyCritRate",
            mode: "flat",
            value: 100,
        },
    ],
}
assertValid("combat-buffs", anomalyTargetBuff)
assert.deepEqual(cleanMaintenanceItem("combat-buffs", anomalyTargetBuff).effects[0].target, {
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffects: ["flinch"],
})
assertInvalid("combat-buffs", {
    ...anomalyTargetBuff,
    effects: [{
        ...anomalyTargetBuff.effects[0],
        target: { kind: "anomaly", settlementType: "attribute", anomalyEffects: ["assault"] },
    }],
}, "异常持续时间延长必须指定一个紊乱原异常")
assertInvalid("combat-buffs", {
    ...anomalyTargetBuff,
    effects: [{ ...anomalyTargetBuff.effects[0], target: { kind: "anomaly", settlementType: "disorder", anomalyEffects: [] } }],
}, "异常增幅必须至少选择一个异常效果")

const buffWithModifierOnly = {
    ...validBuff,
    id: "youye.cinema_1.amplify_additional_ability",
    effects: [],
    buffModifiers: [
        {
            id: "youye_cinema1_amplify_additional",
            operation: "multiplyResolvedValue",
            factor: 1.3,
            targetBuffIds: ["youye.additional_ability.anomaly_damage_bonus"],
            targetEffectIds: ["youye_additional_anomaly_damage_bonus"],
            label: { zhCN: "额外能力效果提升至原本的130%" },
        },
    ],
}
assertValid("combat-buffs", buffWithModifierOnly)
assertValid("teammate-buffs", {
    teammate: {
        id: "youye",
        name: { zhCN: "浮波柚叶" },
        attribute: "physical",
        specialty: "support",
    },
    buff: {
        id: "youye.cinema_1.amplify_additional_ability",
        source: { zhCN: "影画一" },
        description: { zhCN: "额外能力效果提升至原本的130%。" },
        scope: "inCombat",
        effects: [],
        buffModifiers: buffWithModifierOnly.buffModifiers,
    },
})
assertInvalid("combat-buffs", {
    ...buffWithModifierOnly,
    buffModifiers: [
        {
            ...buffWithModifierOnly.buffModifiers[0],
            targetBuffIds: [],
        },
    ],
}, "目标 Buff ID至少需要填写一个")
assertInvalid("combat-buffs", {
    ...buffWithModifierOnly,
    buffModifiers: [
        {
            ...buffWithModifierOnly.buffModifiers[0],
            targetEffectIds: [],
        },
    ],
}, "目标效果 ID至少需要填写一个")
assertInvalid("combat-buffs", {
    ...buffWithModifierOnly,
    buffModifiers: [
        {
            ...buffWithModifierOnly.buffModifiers[0],
            factor: 0,
        },
    ],
}, "倍率必须大于 0")
assertInvalid("combat-buffs", {
    ...buffWithModifierOnly,
    buffModifiers: [
        {
            ...buffWithModifierOnly.buffModifiers[0],
            operation: "addResolvedValue",
        },
    ],
}, "不是支持的选项")

const wEngineWithDamageModifier = clone(validWEngine)
wEngineWithDamageModifier.effect.selfBuff.effects = [
    {
        type: "damageModifier",
        kind: "disorderBaseMultiplierBonus",
        value: 0.1,
        appliesTo: {
            damageKinds: ["disorder"],
        },
    },
]
assertInvalid("wEngines", wEngineWithDamageModifier, "旧适用范围不能继续保存")

const driveDiscWithDamageModifier = {
    ...validDriveDiscSet,
    twoPiece: null,
    fourPiece: {
        effectText: { zhCN: "触发后提升紊乱倍率。" },
        selfBuff: {
            scope: "inCombat",
            effects: [
                {
                    type: "damageModifier",
                    kind: "disorderBaseMultiplierBonus",
                    value: 0.1,
                    appliesTo: {
                        damageKinds: ["disorder"],
                    },
                },
            ],
        },
    },
}
assertInvalid("drive-disc-sets", driveDiscWithDamageModifier, "旧适用范围不能继续保存")
assertInvalid("drive-disc-sets", {
    ...validDriveDiscSet,
    twoPiece: {
        scope: "inCombat",
        effects: [
            {
                id: "effect-1",
                type: "damageModifier",
                kind: "anomalyDamageBonus",
                value: 0.15,
                appliesTo: {
                    damageKinds: ["anomaly"],
                },
            },
        ],
    },
}, "旧适用范围不能继续保存")

assertValid("driveDiscSets", {
    ...validDriveDiscSet,
    twoPiece: {
        effects: [
            {
                id: "drive_disc_two_piece_skill_target",
                type: "fixed",
                target: {
                    kind: "skill",
                    skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
                },
                stat: "dmgBonus",
                value: 20,
                mode: "flat",
                condition: { zhCN: "冲刺攻击命中" },
                durationSeconds: 8,
                cooldownSeconds: 1,
                requirement: { specialty: "attack" },
                coverage: { default: 1, min: 0, max: 1, step: 0.1 },
            },
        ],
    },
})
assertInvalid("driveDiscSets", {
    ...validDriveDiscSet,
    twoPiece: {
        effects: [{
            id: "drive_disc_two_piece_invalid_requirement",
            type: "fixed",
            target: {
                kind: "skill",
                skillTargets: [{ kind: "skillTag", skillTag: "dashAttack" }],
            },
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
            durationSeconds: 0,
            requirement: { specialty: "future" },
        }],
    },
}, "持续时间必须大于 0")
assertInvalid("driveDiscSets", {
    ...validDriveDiscSet,
    twoPiece: {
        effects: [{
            id: "drive_disc_two_piece_invalid_requirement",
            type: "fixed",
            target: {
                kind: "skill",
                skillTargets: [{ kind: "skillTag", skillTag: "dashAttack" }],
            },
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
            requirement: { specialty: "future" },
        }],
    },
}, "不是支持的选项")
assertInvalid("driveDiscSets", {
    ...validDriveDiscSet,
    twoPiece: {
        scope: "inCombat",
        effects: [
            {
                id: "drive_disc_two_piece_event_stat",
                type: "fixed",
                target: { kind: "default" },
                stat: "anomalyDamageBonus",
                value: 20,
                mode: "flat",
            },
        ],
    },
}, "事件增幅只能用于局内 Buff")

console.log("maintenance validation tests passed")
