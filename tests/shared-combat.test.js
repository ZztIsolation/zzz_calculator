import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    agentAttributeText,
    CUSTOM_BUFF_SKILL_STAT_OPTIONS,
    CUSTOM_BUFF_STAT_OPTIONS,
    damageElementForAgent,
    defaultRuntimeForBuff,
    nameOf,
    normalizeCustomBuffEffect,
    sanitizeAddedCombatBuffs,
    skillTargetLabel,
    storedBuffModifierTexts,
    storedEffectRuleText,
    storedEffectRulesText,
} from "../frontend/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const meta = buildMeta(catalog)
const exampleInput = catalog.examples.yeShunguang.input
const miyabiMeta = catalog.agents.find(agent => agent.id === "hoshimi_miyabi")

assert.equal(agentAttributeText(miyabiMeta), "烈霜（冰属性结算）")
assert.equal(damageElementForAgent(miyabiMeta), "ice")

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

const customStatBuff = {
    id: "custom-test",
    sourceCategory: "custom",
    sourceKind: "custom",
    name: "自定义 Buff1",
    stats: [
        {
            id: "stat-1",
            label: "通用伤害%",
            stat: "dmgBonus",
            value: 40,
            mode: "flat",
        },
    ],
    effects: [],
}

assert.equal(
    storedEffectRulesText(customStatBuff, defaultRuntimeForBuff(customStatBuff)),
    "通用伤害加成% +40%",
    "Custom Buff stats should display even when effects is an empty array",
)
assert.deepEqual(
    storedBuffModifierTexts(customStatBuff),
    [],
    "Buffs without modifiers should not report modifier text",
)

const modifierOnlyBuff = {
    id: "modifier-only-test",
    effects: [],
    buffModifiers: [
        {
            id: "modifier-only-test.modifier",
            operation: "multiplyResolvedValue",
            factor: 1.3,
            targetBuffIds: ["target-buff"],
            targetEffectIds: ["target-effect"],
            label: {
                zhCN: "[额外能力]中属性异常伤害和[紊乱]伤害增益效果提升至原本的130%。",
            },
        },
    ],
}

assert.equal(
    storedEffectRulesText(modifierOnlyBuff, defaultRuntimeForBuff(modifierOnlyBuff)),
    "",
    "Modifier-only Buffs should not mix modifier text into ordinary rule summaries",
)
assert.deepEqual(
    storedBuffModifierTexts(modifierOnlyBuff),
    ["[额外能力]中属性异常伤害和[紊乱]伤害增益效果提升至原本的130%。"],
    "Modifier-only Buffs should expose modifier text separately",
)

const fieldRuntimeBuff = {
    id: "field-runtime",
    sourceType: "field",
    name: { zhCN: "危局场地效果" },
    coverage: { default: 0.6, min: 0, max: 1, step: 0.1 },
    effects: [
        {
            id: "field-dmg",
            type: "fixed",
            stat: "dmgBonus",
            value: 30,
            mode: "flat",
        },
    ],
}
assert.equal(defaultRuntimeForBuff(fieldRuntimeBuff).coverage, 0.6, "Field Buff runtime should use coverage default")
assert.equal(
    storedEffectRulesText(fieldRuntimeBuff, defaultRuntimeForBuff(fieldRuntimeBuff)),
    "通用伤害加成% +18%（覆盖率 0.6）",
    "Field Buff runtime text should include effective coverage",
)
assert.equal(
    nameOf({ bossName: { zhCN: "测试 BOSS" } }),
    "测试 BOSS",
    "Boss Buff cards should display bossName when no name is present",
)
assert.deepEqual(
    sanitizeAddedCombatBuffs([
        {
            id: "wEngine:zzz_wiki_486.team",
            sourceCategory: "wEngine",
            sourceKind: "wEngineTeam",
            wEngineModificationLevel: 5,
        },
        {
            id: "wEngine:zzz_wiki_1753.team",
            sourceCategory: "wEngine",
            sourceKind: "wEngineTeam",
            wEngineModificationLevel: 99,
        },
        {
            id: "wEngine:zzz_wiki_1826.team",
            sourceCategory: "wEngine",
            sourceKind: "wEngineTeam",
        },
    ], meta).map(item => [item.id, item.wEngineModificationLevel]),
    [
        ["wEngine:zzz_wiki_486.team", 5],
        ["wEngine:zzz_wiki_1753.team", 5],
        ["wEngine:zzz_wiki_1826.team", 1],
    ],
    "Added W-Engine team Buffs should preserve and clamp their own modification level",
)

assert.equal(
    storedEffectRuleText({
        type: "damageModifier",
        kind: "anomalyDamageBonus",
        value: 0.2,
        appliesTo: {
            damageKinds: ["anomaly"],
            anomalyEffects: ["assault"],
        },
    }, {}, {}, catalog.meta),
    "异常伤害增伤 +20%（异常 / 强击）",
    "Damage modifier text should display decimal stored values as percentages",
)
assert.equal(
    skillTargetLabel({
        agentSkillId: "hoshimi_miyabi",
        categoryId: "basic",
        moveId: "frost_moon",
    }, meta),
    "星见雅/强化普攻：霜月",
    "Skill target labels should use the agent and move names without the skill table/category noise",
)
assert.equal(
    storedEffectRuleText({
        type: "fixed",
        stat: "enemyDefReduction",
        value: 30,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [
                {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                },
            ],
        },
    }, {}, {}, meta),
    "敌方减防率% +30%（技能：星见雅/强化普攻：霜月）",
    "Skill-targeted rule text should show compact skill labels",
)
const anomalyDamageBonusOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[1] === "异常伤害增伤%")
assert.ok(anomalyDamageBonusOption, "Custom Buff stat options should include anomaly damage bonus")
assert.equal(anomalyDamageBonusOption[0], "anomalyDamageBonus", "Anomaly damage bonus should be a fixed event stat")
assert.equal(anomalyDamageBonusOption[2], "eventModifier", "Anomaly damage bonus option should use the default event modifier bucket")
const defenseIgnoreOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[1] === "无视防御率%")
assert.ok(defenseIgnoreOption, "Custom Buff stat options should include defense ignore alias")
assert.equal(defenseIgnoreOption[0], "enemyDefIgnore", "Defense ignore should be exposed as a defense reduction alias")
assert.equal(
    CUSTOM_BUFF_STAT_OPTIONS.some(option => option[1] === "指定技能伤害增伤%"),
    false,
    "Default Custom Buff stat options should not include skill-targeted pseudo types",
)
assert.equal(
    CUSTOM_BUFF_STAT_OPTIONS.some(option => option[1] === "指定技能倍率加算%"),
    false,
    "Default Custom Buff stat options should not include skill multiplier pseudo types",
)
const directSkillDamageOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "dmgBonus")
assert.ok(directSkillDamageOption, "Skill Custom Buff stat options should include skill-targeted damage bonus")
assert.equal(directSkillDamageOption[1], "通用伤害加成%")
assert.equal(directSkillDamageOption[2], "skill", "Skill-targeted damage bonus option should be selected by target kind")
const skillAnomalyDamageOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "anomalyDamageBonus")
assert.ok(skillAnomalyDamageOption, "Skill Custom Buff stat options should include anomaly damage bonus")
assert.equal(skillAnomalyDamageOption[2], "skill")
const skillMultiplierOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "skillMultiplierBonus")
assert.ok(skillMultiplierOption, "Skill Custom Buff stat options should include skill multiplier bonus")
assert.equal(skillMultiplierOption[1], "技能倍率加算%")
assert.equal(skillMultiplierOption[2], "skill", "Skill multiplier bonus option should be selected by target kind")
const skillDefenseIgnoreOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "enemyDefIgnore")
assert.ok(skillDefenseIgnoreOption, "Skill Custom Buff stat options should include defense ignore alias")
assert.equal(skillDefenseIgnoreOption[1], "无视防御率%")
assert.equal(skillDefenseIgnoreOption[2], "skill")
assert.equal(
    CUSTOM_BUFF_SKILL_STAT_OPTIONS.some(option => option[0] === "atkFlat" || option[0] === "critRate"),
    false,
    "Skill Custom Buff stat options should exclude unrelated panel stats",
)
assert.deepEqual(
    normalizeCustomBuffEffect({
        id: "custom-fixed-anomaly",
        type: "fixed",
        stat: "anomalyDamageBonus",
        value: 30,
        target: { kind: "default" },
    }),
    {
        id: "custom-fixed-anomaly",
        type: "fixed",
        stat: "anomalyDamageBonus",
        value: 30,
        mode: "flat",
        target: { kind: "default" },
        label: null,
    },
    "Custom event modifier normalization should keep default target fixed rules",
)
assert.deepEqual(
    normalizeCustomBuffEffect({
        id: "custom-fixed-skill-multiplier",
        type: "fixed",
        stat: "skillMultiplierBonus",
        value: 1500,
        target: {
            kind: "skill",
            skillTargets: [
                {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                },
                {
                    agentSkillId: "ye_shunguang",
                    categoryId: "special",
                    moveId: "ex_clarity_return_dust",
                    rowId: "damage",
                },
            ],
        },
    }),
    {
        id: "custom-fixed-skill-multiplier",
        type: "fixed",
        stat: "skillMultiplierBonus",
        value: 1500,
        mode: "flat",
        target: {
            kind: "skill",
            skillTargets: [
                {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                },
                {
                    agentSkillId: "ye_shunguang",
                    categoryId: "special",
                    moveId: "ex_clarity_return_dust",
                    rowId: "damage",
                },
            ],
        },
        label: null,
    },
    "Custom skill-targeted normalization should preserve target.kind and multiple skill targets",
)
assert.equal(
    normalizeCustomBuffEffect({
        id: "custom-fixed-skill-empty",
        type: "fixed",
        stat: "dmgBonus",
        value: 50,
        target: { kind: "skill", skillTargets: [] },
    }),
    null,
    "Skill-targeted Custom Buff effects should require at least one skill target",
)
assert.deepEqual(
    normalizeCustomBuffEffect({
        id: "custom-skill-multiplier",
        type: "damageModifier",
        kind: "skillMultiplierBonus",
        value: 15,
        valueUnit: "decimal",
        appliesTo: {
            damageKinds: ["direct"],
            skillTargets: [
                {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                },
                {
                    agentSkillId: "ye_shunguang",
                    categoryId: "special",
                    moveId: "ex_clarity_return_dust",
                    rowId: "damage",
                },
            ],
        },
    }),
    {
        id: "custom-skill-multiplier",
        type: "damageModifier",
        kind: "skillMultiplierBonus",
        value: 15,
        valueUnit: "decimal",
        appliesTo: {
            damageKinds: ["direct"],
            skillTargets: [
                {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                },
                {
                    agentSkillId: "ye_shunguang",
                    categoryId: "special",
                    moveId: "ex_clarity_return_dust",
                    rowId: "damage",
                },
            ],
        },
        label: null,
    },
    "Custom damage modifier normalization should preserve valueUnit and multiple skill targets",
)

const withoutManual = calculateInCombatPanel(catalog, {
    ...exampleInput,
    combatBuffs: {
        activeBuffIds: [],
    },
})
const withManual = calculateInCombatPanel(catalog, {
    ...exampleInput,
    combatBuffs: {
        activeBuffIds: [],
        manualStats: [
            {
                id: "custom-test.stat-1",
                label: "自定义 Buff1｜通用伤害%",
                stat: "dmgBonus",
                value: 40,
                mode: "flat",
            },
        ],
    },
})

approx(
    withManual.inCombat.panel.dmgBonus - withoutManual.inCombat.panel.dmgBonus,
    0.4,
    "Custom manual stat Buff should still affect in-combat results",
)
