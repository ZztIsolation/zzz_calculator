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

const validFieldBuff = {
    id: "test_field_buff",
    sourceType: "field",
    scope: "inCombat",
    name: { zhCN: "测试场地 Buff" },
    source: { zhCN: "危局强袭战" },
    sourcePeriod: { zhCN: "2.8版本第三期" },
    description: { zhCN: "场地使代理人造成的伤害提升。" },
    coverage: { default: 0.5, min: 0, max: 1, step: 0.1 },
    effects: [
        {
            type: "fixed",
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
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
    coverage: { default: 1, min: 0, max: 1, step: 0.1 },
    effects: [
        {
            type: "fixed",
            stat: "enemyPhysicalResReduction",
            value: 20,
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
    attribute: "frost",
    damageElement: "ice",
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
const wEngineWithModificationScaling = clone(validWEngine)
wEngineWithModificationScaling.modification = { minLevel: 1, maxLevel: 5, defaultLevel: 1 }
wEngineWithModificationScaling.effect.selfBuff.effects[0].modificationScaling = {
    value: {
        base: 20,
        step: 2,
        displayValues: [20, 22, 24, 26, 28],
    },
}
assertValid("wEngines", wEngineWithModificationScaling)

const wEngineWithStackedModificationScaling = clone(validWEngine)
wEngineWithStackedModificationScaling.effect.selfBuff.effects = [
    {
        type: "stacked",
        stat: "dmgBonus",
        valuePerStack: 5,
        mode: "flat",
        maxStacks: 4,
        defaultStacks: 4,
        modificationScaling: {
            valuePerStack: {
                base: 5,
                step: 1,
                displayValues: [5, 6, 7, 8, 9],
            },
        },
    },
]
assertValid("wEngines", wEngineWithStackedModificationScaling)

const wEngineScalingMissingDisplay = clone(wEngineWithModificationScaling)
wEngineScalingMissingDisplay.effect.selfBuff.effects[0].modificationScaling.value.displayValues = [20, 22, 24]
assertInvalid("wEngines", wEngineScalingMissingDisplay, "必须覆盖 1-5")

const wEngineScalingBadDisplay = clone(wEngineWithModificationScaling)
wEngineScalingBadDisplay.effect.selfBuff.effects[0].modificationScaling.value.displayValues = [20, 22, "oops", 26, 28]
assertInvalid("wEngines", wEngineScalingBadDisplay, "必须是有效数字")

const wEngineScalingBaseMismatch = clone(wEngineWithModificationScaling)
wEngineScalingBaseMismatch.effect.selfBuff.effects[0].modificationScaling.value.base = 19
assertInvalid("wEngines", wEngineScalingBaseMismatch, "1级计算值必须与规则当前数值一致")
assertValid("driveDiscSets", validDriveDiscSet)
assertValid("driveDiscSets", validDriveDiscSetWithSplitFourPiece)
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
assertInvalid("field-buffs", {
    ...validFieldBuff,
    sourcePeriod: { zhCN: "" },
}, "中文名必填")
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
        },
        {
            id: "disorder-1",
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: "test_burn",
            elapsedSeconds: 0,
            durationSeconds: 10,
            count: 1,
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
        events: [],
    },
}, "至少需要一个事件", validCalculationContext)
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
    ],
}
assertValid("combat-buffs", buffWithDamageModifier)
assertValid("combat-buffs", {
    ...buffWithDamageModifier,
    effects: [
        {
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
})
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
    ],
}
assertValid("combat-buffs", buffWithSkillTargetRules)
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
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                    },
                ],
            },
        },
    ],
}, "必须填写角色技能表、技能大类和招式")
assertValid("agents", {
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
})
assertValid("agents", {
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
})
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
        kind: "baseMultiplierBonus",
        value: 0.1,
        appliesTo: {
            damageKinds: ["disorder"],
        },
    },
]
assertValid("wEngines", wEngineWithDamageModifier)

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
                    kind: "baseMultiplierBonus",
                    value: 0.1,
                    appliesTo: {
                        damageKinds: ["disorder"],
                    },
                },
            ],
        },
    },
}
assertValid("drive-disc-sets", driveDiscWithDamageModifier)
assertValid("drive-disc-sets", {
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
})

console.log("maintenance validation tests passed")
