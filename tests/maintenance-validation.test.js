import assert from "node:assert/strict"
import { validateMaintenanceItem } from "../frontend/maintenanceValidation.js"

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
assertValid("driveDiscSets", validDriveDiscSet)
assertValid("driveDiscSets", validDriveDiscSetWithSplitFourPiece)
assertValid("buffs", validBuff)
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

const missingWEngineRule = clone(validWEngine)
missingWEngineRule.effect.selfBuff.effects = []
assertInvalid("wEngines", missingWEngineRule, "至少需要一条")

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
    coverage: {
        default: 1.5,
        min: 0,
        max: 1,
        step: 0.1,
    },
}
assertInvalid("buffs", badCoverage, "覆盖率必须在 0 到 1")

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

console.log("maintenance validation tests passed")
