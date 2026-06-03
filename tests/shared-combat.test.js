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
    DAMAGE_KIND_LABELS,
    damageElementForAgent,
    defaultWEngineIdForAgent,
    defaultRuntimeForBuff,
    ENUM_LABELS,
    nameOf,
    normalizeCustomBuffEffect,
    runtimeForBuff,
    runtimeSourceGroups,
    runtimeSourceRuleIdsForGroup,
    sanitizeAddedCombatBuffs,
    skillTargetLabel,
    sortWEnginesForAgent,
    storedBuffModifierTexts,
    storedEffectRuleText,
    storedEffectRulesText,
} from "../frontend/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const meta = buildMeta(catalog)
const exampleInput = catalog.examples.yeShunguang.input
const miyabiMeta = catalog.agents.find(agent => agent.id === "hoshimi_miyabi")
const yixuanMeta = catalog.agents.find(agent => agent.id === "yixuan")

assert.equal(agentAttributeText(miyabiMeta), "烈霜（冰属性结算）")
assert.equal(damageElementForAgent(miyabiMeta), "ice")
assert.equal(agentAttributeText(yixuanMeta), "玄墨（以太属性结算）")
assert.equal(damageElementForAgent(yixuanMeta), "ether")

const defaultWEngines = [
    { id: "catalog-first", rarity: "B" },
    { id: "agent-a-rank", rarity: "A", relatedAgentId: "agent-a" },
    { id: "agent-s-rank-first", rarity: "S", relatedAgentId: "agent-a" },
    { id: "agent-s-rank-second", rarity: "S", relatedAgentId: "agent-a" },
]
assert.equal(
    defaultWEngineIdForAgent(defaultWEngines, "agent-a", ""),
    "agent-s-rank-first",
    "Related W-Engine defaults should prefer S rank and keep catalog order within the same rarity",
)
assert.equal(
    defaultWEngineIdForAgent(defaultWEngines, "agent-a", "agent-a-rank"),
    "agent-a-rank",
    "A saved valid W-Engine should not be replaced by the related default",
)
assert.equal(
    defaultWEngineIdForAgent(defaultWEngines, "agent-a", "missing-w-engine"),
    "agent-s-rank-first",
    "An invalid saved W-Engine should fall back to the related default",
)
assert.equal(
    defaultWEngineIdForAgent(defaultWEngines, "agent-without-related", ""),
    "catalog-first",
    "Agents without a related W-Engine should keep the catalog fallback",
)

const specialtySortEngines = [
    { id: "attack-first", specialty: "attack" },
    { id: "stun-first", specialty: "stun" },
    { id: "attack-second", specialty: "attack" },
    { id: "rupture-first", specialty: "rupture" },
    { id: "stun-second", specialty: "stun" },
]
assert.deepEqual(
    sortWEnginesForAgent(specialtySortEngines, { specialty: "stun" }).map(item => item.id),
    ["stun-first", "stun-second", "attack-first", "attack-second", "rupture-first"],
    "W-Engines matching the agent specialty should be moved before non-matching engines",
)
assert.deepEqual(
    sortWEnginesForAgent(specialtySortEngines, { specialty: "anomaly" }).map(item => item.id),
    specialtySortEngines.map(item => item.id),
    "When no W-Engines match the agent specialty, catalog order should be preserved",
)
assert.deepEqual(
    sortWEnginesForAgent(specialtySortEngines, null).map(item => item.id),
    specialtySortEngines.map(item => item.id),
    "Missing agent data should keep catalog order",
)
assert.deepEqual(
    sortWEnginesForAgent([], { specialty: "stun" }),
    [],
    "Empty W-Engine lists should stay empty",
)

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

const groupedFormulaRuntimeBuff = {
    id: "grouped-formula-runtime",
    effects: [
        {
            id: "formula-anomaly",
            type: "formula",
            stat: "anomalyDamageBonus",
            mode: "flat",
            source: {
                label: { zhCN: "柚叶异常掌控" },
                defaultValue: 200,
                min: 100,
                max: 200,
            },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
        {
            id: "formula-disorder",
            type: "formula",
            stat: "disorderDamageBonus",
            mode: "flat",
            source: {
                label: { zhCN: "柚叶异常掌控" },
                defaultValue: 200,
                min: 100,
                max: 200,
            },
            formula: { expression: "x * 2", valueUnit: "storedPercent" },
        },
        {
            id: "stacked-dmg",
            type: "stacked",
            stat: "dmgBonus",
            mode: "flat",
            valuePerStack: 10,
            maxStacks: 3,
            defaultStacks: 2,
        },
    ],
}
const groupedFormulaRuntime = runtimeForBuff({
    runtime: {
        effects: {
            "formula-anomaly": { sourceValue: 171 },
            "formula-disorder": { sourceValue: 199 },
            "stacked-dmg": { stacks: 1 },
        },
    },
}, groupedFormulaRuntimeBuff)
const groupedFormulaSources = runtimeSourceGroups(groupedFormulaRuntimeBuff)
assert.deepEqual(
    groupedFormulaSources.map(group => group.ruleIds),
    [["formula-anomaly", "formula-disorder"]],
    "Formula rules with matching source name/default/min/max should share one runtime source group",
)
assert.deepEqual(
    runtimeSourceRuleIdsForGroup(groupedFormulaRuntimeBuff, groupedFormulaSources[0].key),
    ["formula-anomaly", "formula-disorder"],
    "Runtime source helper should return every rule in the same source group",
)
assert.equal(groupedFormulaRuntime.effects["formula-anomaly"].sourceValue, 171)
assert.equal(
    groupedFormulaRuntime.effects["formula-disorder"].sourceValue,
    171,
    "Grouped formula rules should normalize to the first rule's source value",
)
assert.equal(
    groupedFormulaRuntime.effects["stacked-dmg"].stacks,
    1,
    "Stacked runtime values should not be affected by source grouping",
)

const splitRuntimeBuff = {
    id: "split-runtime",
    effects: [
        {
            id: "formula-default-a",
            type: "formula",
            stat: "dmgBonus",
            source: { label: { zhCN: "同源" }, defaultValue: 200, min: 100, max: 200 },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
        {
            id: "formula-default-b",
            type: "formula",
            stat: "critDmg",
            source: { label: { zhCN: "同源" }, defaultValue: 199, min: 100, max: 200 },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
        {
            id: "formula-min-b",
            type: "formula",
            stat: "critRate",
            source: { label: { zhCN: "同源" }, defaultValue: 200, min: 0, max: 200 },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
        {
            id: "derived-no-bounds",
            type: "derived",
            stat: "atkFlat",
            sourceLabel: { zhCN: "同源" },
            defaultSourceValue: 200,
            ratio: 10,
        },
    ],
}
const splitRuntime = runtimeForBuff({
    runtime: {
        effects: {
            "formula-default-a": { sourceValue: 111 },
            "formula-default-b": { sourceValue: 222 },
            "formula-min-b": { sourceValue: 333 },
            "derived-no-bounds": { sourceValue: 444 },
        },
    },
}, splitRuntimeBuff)
assert.equal(runtimeSourceGroups(splitRuntimeBuff).length, 4, "Different source defaults or bounds should not merge")
assert.equal(splitRuntime.effects["formula-default-a"].sourceValue, 111)
assert.equal(splitRuntime.effects["formula-default-b"].sourceValue, 222)
assert.equal(splitRuntime.effects["formula-min-b"].sourceValue, 333)
assert.equal(splitRuntime.effects["derived-no-bounds"].sourceValue, 444)

const crossTypeRuntimeBuff = {
    id: "cross-type-runtime",
    effects: [
        {
            id: "derived-source",
            type: "derived",
            stat: "atkFlat",
            sourceLabel: { zhCN: "共享来源" },
            defaultSourceValue: 50,
            ratio: 20,
        },
        {
            id: "formula-source",
            type: "formula",
            stat: "dmgBonus",
            source: {
                label: { zhCN: "共享来源" },
                defaultValue: 50,
            },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
    ],
}
const crossTypeRuntime = runtimeForBuff({
    runtime: {
        effects: {
            "derived-source": { sourceValue: 60 },
            "formula-source": { sourceValue: 70 },
        },
    },
}, crossTypeRuntimeBuff)
assert.deepEqual(
    runtimeSourceGroups(crossTypeRuntimeBuff).map(group => group.ruleIds),
    [["derived-source", "formula-source"]],
    "Derived and formula rules can share a source group when name/default/bounds match",
)
assert.equal(crossTypeRuntime.effects["formula-source"].sourceValue, 60)

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
    "属性异常增伤 +20%（异常 / 强击）",
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
const anomalyDamageBonusOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[1] === "属性异常增伤%")
assert.ok(anomalyDamageBonusOption, "Custom Buff stat options should include anomaly damage bonus")
assert.equal(anomalyDamageBonusOption[0], "anomalyDamageBonus", "Anomaly damage bonus should be a fixed event stat")
assert.equal(anomalyDamageBonusOption[2], "eventModifier", "Anomaly damage bonus option should use the default event modifier bucket")
const disorderDamageBonusOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[1] === "紊乱增伤%")
assert.ok(disorderDamageBonusOption, "Custom Buff stat options should include disorder damage bonus")
assert.equal(disorderDamageBonusOption[0], "disorderDamageBonus", "Disorder damage bonus should be a fixed event stat")
assert.equal(disorderDamageBonusOption[2], "eventModifier", "Disorder damage bonus option should use the default event modifier bucket")
assert.equal(DAMAGE_KIND_LABELS.sheer, "贯穿", "Damage kind labels should include sheer")
assert.equal(ENUM_LABELS.attribute.xuanmo, "玄墨", "Attribute labels should include Yixuan's Xuanmo display attribute")
const sheerForceFlatOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[0] === "sheerForceFlat")
assert.ok(sheerForceFlatOption, "Custom Buff stat options should include flat sheer force")
assert.equal(sheerForceFlatOption[2], "flat", "Flat sheer force should be a panel stat option")
const sheerDamageBonusOption = CUSTOM_BUFF_STAT_OPTIONS.find(option => option[1] === "贯穿增伤%")
assert.ok(sheerDamageBonusOption, "Custom Buff stat options should include sheer damage bonus")
assert.equal(sheerDamageBonusOption[0], "sheerDmgBonus", "Sheer damage bonus should be a fixed event stat")
assert.equal(sheerDamageBonusOption[2], "eventModifier", "Sheer damage bonus option should use the default event modifier bucket")
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
const skillDisorderDamageOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "disorderDamageBonus")
assert.ok(skillDisorderDamageOption, "Skill Custom Buff stat options should include disorder damage bonus")
assert.equal(skillDisorderDamageOption[2], "skill")
const skillSheerDamageOption = CUSTOM_BUFF_SKILL_STAT_OPTIONS.find(option => option[0] === "sheerDmgBonus")
assert.ok(skillSheerDamageOption, "Skill Custom Buff stat options should include sheer damage bonus")
assert.equal(skillSheerDamageOption[2], "skill")
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
        id: "custom-fixed-disorder",
        type: "fixed",
        stat: "disorderDamageBonus",
        value: 15,
        target: { kind: "default" },
    }),
    {
        id: "custom-fixed-disorder",
        type: "fixed",
        stat: "disorderDamageBonus",
        value: 15,
        mode: "flat",
        target: { kind: "default" },
        label: null,
    },
    "Custom event modifier normalization should keep disorder damage bonus fixed rules",
)
assert.deepEqual(
    normalizeCustomBuffEffect({
        id: "custom-fixed-sheer",
        type: "fixed",
        stat: "sheerDmgBonus",
        value: 10,
        target: { kind: "default" },
    }),
    {
        id: "custom-fixed-sheer",
        type: "fixed",
        stat: "sheerDmgBonus",
        value: 10,
        mode: "flat",
        target: { kind: "default" },
        label: null,
    },
    "Custom event modifier normalization should keep sheer damage bonus fixed rules",
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
