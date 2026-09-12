import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
    normalizeCatalog,
} from "../backend/calculator.js"
import { analyzeDriveDiscStatGains } from "../core/driveDiscAnalysis-core.js"
import { optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"
import {
    evaluateInCombatFormulaRule,
    formulaExpressionVariables,
    formulaParameterNames,
    formulaParameterValues,
    isAllowedInCombatFormulaSourceType,
    materializeFormulaRuleForModificationLevel,
    migrateLegacyBloodMarrowWEngine,
    migrateLegacySharpOverflowEffect,
} from "../core/effectFormula.js"
import { validateFormulaExpression } from "../core/formulaEvaluator.js"
import {
    defaultRuntimeForBuff,
    sanitizeAddedCombatBuffs,
    storedEffectRuleText,
} from "../core/shared-combat.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function cloneCatalog(value = catalog) {
    const next = clone(value)
    for (const key of [
        "agentsMap",
        "wEnginesMap",
        "driveDiscSetsMap",
        "combatBuffsMap",
        "agentSkillsMap",
        "agentSkillsByAgentMap",
        "anomalyEffectsMap",
        "disorderEffectsMap",
    ]) {
        delete next[key]
    }
    return next
}

function approx(actual, expected, message, epsilon = 1e-9) {
    assert.ok(
        Math.abs(Number(actual) - Number(expected)) <= epsilon,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

const marrow = catalog.wEnginesMap.get("zzz_wiki_2189")
assert.ok(marrow, "Blood Marrow must remain in the official catalog")
const marrowRules = marrow.effect.selfBuff.effects
assert.equal(marrowRules.length, 1, "Blood Marrow must expose one formula rule")
const marrowRule = marrowRules[0]
assert.equal(marrowRule.id, "marrow-overflow-damage")
assert.equal(marrowRule.source.kind, "inCombatStat")
assert.equal(marrowRule.scope, "inCombat")
assert.equal(marrowRule.stat, "dmgBonus")
assert.equal(marrowRule.target.kind, "default")
assert.deepEqual(formulaParameterNames(marrowRule), ["threshold", "rate", "cap"])
assert.deepEqual(formulaParameterValues(marrowRule), { threshold: 100, rate: 0.48, cap: 24 })

const parameterRule = {
    ...clone(marrowRule),
    formula: {
        ...clone(marrowRule.formula),
        parameters: { threshold: 100, rate: 0.8, cap: 40 },
    },
}
assert.deepEqual(formulaExpressionVariables(parameterRule), ["x", "threshold", "rate", "cap"])
validateFormulaExpression(parameterRule.formula.expression, new Set(formulaExpressionVariables(parameterRule)))
assert.throws(
    () => validateFormulaExpression("x + undeclared", new Set(formulaExpressionVariables(parameterRule))),
    /Unknown variable/u,
)
assert.throws(
    () => validateFormulaExpression("x + window", new Set(formulaExpressionVariables(parameterRule))),
    /Unknown variable/u,
)
const convertedSource = evaluateInCombatFormulaRule(parameterRule, { critRate: 1.188 })
assert.equal(convertedSource.rawSourceValue, 1.188)
assert.equal(convertedSource.sourceValue, 118.8)
approx(convertedSource.formulaValue, 15.04, "storedPercent formula output")
approx(convertedSource.value, 0.1504, "storedPercent formula conversion")

for (let level = 1; level <= 5; level += 1) {
    const materialized = materializeFormulaRuleForModificationLevel(marrowRule, level)
    const parameters = materialized.formula.parameters
    approx(parameters.rate, [0.48, 0.56, 0.64, 0.72, 0.8][level - 1], `Blood Marrow R${level} rate`)
    approx(parameters.cap, [24, 28, 32, 36, 40][level - 1], `Blood Marrow R${level} cap`)
}

function marrowInput({ active = true, level = 5, manualStats = [] } = {}) {
    return {
        agentId: "claret",
        coreSkillLevel: "F",
        cinemaLevel: 0,
        wEngineId: "zzz_wiki_2189",
        wEngineModificationLevel: level,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: active
                ? ["agent:claret.corePassive", "wEngine:zzz_wiki_2189.self"]
                : [],
            manualStats,
        },
        damage: {
            events: [{
                id: "marrow-sharp",
                kind: "sharp",
                damageElement: "electric",
                skillMultiplier: 100,
                critMode: "nonCrit",
            }],
        },
    }
}

const belowThreshold = calculateInCombatPanel(catalog, marrowInput({ active: false }))
assert.equal(belowThreshold.inCombat.dynamicDmgBonus, 0)
const rank5At101 = calculateInCombatPanel(catalog, marrowInput())
approx(rank5At101.inCombat.panel.critRate, 1.013, "Blood Marrow 101.3% panel")
approx(rank5At101.inCombat.dynamicDmgBonus, 0.0104, "Blood Marrow R5 101.3%")
const rank1Text = storedEffectRuleText(
    marrowRule,
    defaultRuntimeForBuff(marrow.effect.selfBuff),
    marrow.effect.selfBuff,
    { agents: [], agentSkills: [] },
    { inCombatPanel: rank5At101.inCombat.panel },
)
assert.match(rank1Text, /当前局内暴击率101\.3%，/u)
const rank5At118 = calculateInCombatPanel(catalog, marrowInput({
    manualStats: [{ stat: "critRate", value: 17.5, mode: "flat" }],
}))
approx(rank5At118.inCombat.panel.critRate, 1.188, "Blood Marrow 118.8% panel")
approx(rank5At118.inCombat.dynamicDmgBonus, 0.1504, "Blood Marrow R5 118.8%")
assert.match(
    rank5At118.damage.events[0].whiteBoxRows.find(row => row.label === "普通增伤区")?.formula ?? "",
    /通用\/属性增伤 15\.04%/u,
    "Blood Marrow actual value must be visible in the white box",
)
const rank5At200 = calculateInCombatPanel(catalog, marrowInput({
    manualStats: [{ stat: "critRate", value: 98.7, mode: "flat" }],
}))
approx(rank5At200.inCombat.panel.critRate, 2, "Blood Marrow 200% panel")
approx(rank5At200.inCombat.dynamicDmgBonus, 0.4, "Blood Marrow R5 200% cap")
const marrowAudit = rank5At118.inCombat.activeEffects
    .find(effect => effect.key === "wEngine:zzz_wiki_2189.self")
assert.ok(marrowAudit?.resolvedDynamicFormulas?.length)
const marrowResolved = marrowAudit.resolvedDynamicFormulas[0]
assert.equal(marrowResolved.sourceValue, 118.8)
assert.equal(marrowResolved.formulaValue, 15.04)
assert.equal(marrowResolved.value, 0.1504)

function catalogWithDynamicSelfBuff(agentIds) {
    const next = cloneCatalog()
    for (const agentId of agentIds) {
        const agent = next.agents.find(item => item.id === agentId)
        assert.ok(agent, `dynamic fixture agent ${agentId}`)
        agent.combatBuffs ??= {}
        agent.combatBuffs.skillBuffs ??= []
        agent.combatBuffs.skillBuffs.push({
            id: "dynamic-generic-dmg",
            name: { zhCN: "测试通用增伤" },
            description: { zhCN: "测试通用增伤" },
            scope: "inCombat",
            effects: [{
                id: "dynamic-generic-dmg-effect",
                type: "formula",
                stat: "dmgBonus",
                mode: "flat",
                target: { kind: "default" },
                source: {
                    kind: "inCombatStat",
                    stat: "critRate",
                    unit: "storedPercent",
                    label: { zhCN: "局内暴击率" },
                },
                formula: {
                    expression: "20",
                    valueUnit: "storedPercent",
                    parameters: {},
                },
            }],
        })
    }
    return normalizeCatalog(next)
}

const genericCases = [
    ["direct", "hoshimi_miyabi", "hailfall_star_palace", {
        events: [{ id: "direct", kind: "direct", skillMultiplier: 100, damageElement: "ice", critMode: "nonCrit" }],
    }],
    ["sheer", "yixuan", "zzz_wiki_1342", {
        events: [{ id: "sheer", kind: "sheer", skillMultiplier: 100, damageElement: "ether", critMode: "nonCrit" }],
    }],
    ["sharp", "claret", "zzz_wiki_2188", {
        events: [{ id: "sharp", kind: "sharp", skillMultiplier: 100, damageElement: "electric", critMode: "nonCrit" }],
    }],
    ["attribute-anomaly", "hoshimi_miyabi", "hailfall_star_palace", {
        events: [{ id: "attribute", kind: "anomaly", settlementType: "attribute", anomalyEffect: "shatter" }],
    }],
    ["disorder", "hoshimi_miyabi", "hailfall_star_palace", {
        events: [{ id: "disorder", kind: "anomaly", settlementType: "disorder", anomalyEffect: "frost_frozen", elapsedSeconds: 0 }],
    }],
    ["release", "aria", "zzz_wiki_1883", null],
]

for (const [label, agentId, wEngineId, damage] of genericCases) {
    const dynamicCatalog = catalogWithDynamicSelfBuff([agentId])
    const agent = dynamicCatalog.agentsMap.get(agentId)
    const input = {
        agentId,
        coreSkillLevel: "F",
        cinemaLevel: 0,
        wEngineId,
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [`agent:${agentId}.skill.dynamic-generic-dmg`] },
        damage: damage ?? agent.defaultCalculationConfig,
    }
    const without = calculateInCombatPanel(dynamicCatalog, { ...input, combatBuffs: { activeBuffIds: [] } })
    const withBuff = calculateInCombatPanel(dynamicCatalog, input)
    const withoutDamage = Number(without.damage.events[0]?.finalDamage ?? 0)
    const withDamage = Number(withBuff.damage.events[0]?.finalDamage ?? 0)
    assert.ok(withoutDamage > 0, `${label} fixture should produce damage`)
    approx(withBuff.inCombat.dynamicDmgBonus, 0.2, `${label} dynamic bonus`)
    approx(withDamage / withoutDamage, 1.2, `${label} generic damage multiplier`, 1e-8)
}

const luminescenceCatalog = catalogWithDynamicSelfBuff(["remielle_dan"])
const luminescenceInput = {
    agentId: "remielle_dan",
    coreSkillLevel: "F",
    cinemaLevel: 0,
    wEngineId: "zzz_wiki_2109",
    wEngineModificationLevel: 1,
    driveDiscs: [],
    damage: luminescenceCatalog.agentsMap.get("remielle_dan").defaultCalculationConfig,
}
const luminescenceWithout = calculateInCombatPanel(luminescenceCatalog, {
    ...luminescenceInput,
    combatBuffs: { activeBuffIds: [] },
})
const luminescenceWith = calculateInCombatPanel(luminescenceCatalog, {
    ...luminescenceInput,
    combatBuffs: { activeBuffIds: ["agent:remielle_dan.skill.dynamic-generic-dmg"] },
})
assert.equal(luminescenceWith.damage.objectiveKind, "luminescenceTeamScore")
assert.equal(luminescenceWith.damage.finalDamage, luminescenceWithout.damage.finalDamage,
    "Luminescence score must ignore ordinary dynamic dmgBonus")

const parityCatalog = catalogWithDynamicSelfBuff(["claret"])
const parityInput = {
    agentId: "claret",
    coreSkillLevel: "F",
    cinemaLevel: 0,
    wEngineId: "zzz_wiki_2189",
    wEngineModificationLevel: 5,
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: [
            "agent:claret.corePassive",
            "wEngine:zzz_wiki_2189.self",
            "agent:claret.skill.dynamic-generic-dmg",
        ],
    },
    damage: {
        events: [{ id: "parity", kind: "sharp", damageElement: "electric", skillMultiplier: 100, critMode: "expected" }],
    },
}
const parityCalculator = createInCombatPanelCalculator(parityCatalog, parityInput)
const ordinary = parityCalculator.calculate([], { round: false })
const summary = parityCalculator.scoreOnlyFromSummary(new Map(), new Map())
const legacySummary = parityCalculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
approx(summary.finalDamage, ordinary.damage.totalFinalDamage, "summary vs ordinary parity", 1e-7)
approx(legacySummary.finalDamage, summary.finalDamage, "legacy summary parity", 1e-7)
approx(summary.dynamicDmgBonus, 0.2104, "summary dynamic bonus")
const metadata = parityCalculator.optimizerStatMetadata()
assert.ok(metadata.panelStatIds.includes("critRate"))
assert.ok(metadata.relevantStatIds.includes("critRate"))
assert.equal(metadata.strictMonotonic, false)
const indexedStatIds = [...new Set(metadata.relevantStatIds)]
const indexedValues = new Float64Array(indexedStatIds.length)
const denseTarget = parityCalculator.compileDensePanelScoreTarget({
    statIds: indexedStatIds,
    setIds: [],
    setIndexById: new Map(),
})
assert.ok(denseTarget)
const denseSummary = denseTarget.scoreDense(indexedValues, new Int16Array())
const fixedSummary = denseTarget.compileForSetCounts(new Int16Array()).scoreScalar(indexedValues)
const indexedSummary = parityCalculator.scoreOnlyFromIndexedSummary(
    indexedValues,
    indexedStatIds,
    new Int16Array(),
    [],
    new Map(),
)
approx(denseSummary.finalDamage, summary.finalDamage, "dense parity", 1e-7)
approx(fixedSummary.finalDamage, summary.finalDamage, "fixed-set parity", 1e-7)
approx(indexedSummary.finalDamage, summary.finalDamage, "indexed parity", 1e-7)

const analysis = analyzeDriveDiscStatGains(parityCatalog, {
    ...parityInput,
    driveDiscs: [],
    maxRolls: 1,
})
approx(analysis.baseline.panel.dmgBonus, ordinary.inCombat.panel.dmgBonus, "drive-disc analysis dynamic panel", 1e-7)

const optimizerSetId = "woodpecker_electro"
const optimizerMainStats = {
    1: { stat: "hpFlat", value: 2200 },
    2: { stat: "atkFlat", value: 316 },
    3: { stat: "defFlat", value: 184 },
    4: { stat: "critRate", value: 24, mode: "pct" },
    5: { stat: "physicalDmg", value: 30, mode: "pct" },
    6: { stat: "atkPct", value: 30, mode: "pct" },
}
const optimizerDiscs = []
for (let slot = 1; slot <= 6; slot += 1) {
    for (let variant = 0; variant < 2; variant += 1) {
        optimizerDiscs.push({
            id: `formula-optimizer-${slot}-${variant}`,
            ownerId: "default",
            setId: optimizerSetId,
            partition: slot,
            rarity: "S",
            level: 15,
            mainStat: { ...optimizerMainStats[slot] },
            subStats: [
                { stat: "critRate", value: variant ? 2.4 : 4.8, mode: "pct" },
                { stat: "atkPct", value: 3 + variant, mode: "pct" },
            ],
            source: { type: "test", sequence: slot * 10 + variant },
        })
    }
}
const optimizerStore = {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: optimizerDiscs,
}
const optimizerInput = {
    ...parityInput,
    settings: {
        objective: "damage",
        fourPieceSetId: optimizerSetId,
        twoPieceSetId: optimizerSetId,
        algorithm: "exact-super-bound",
        enableUpperBoundPruning: true,
        parallelThreshold: 0,
        workerCount: 2,
        mainStatLimits: { 4: ["critRate"], 5: ["physicalDmg"], 6: ["atkPct"] },
    },
}
const nodeOptimizer = await optimizeDriveDiscsAsync(parityCatalog, optimizerStore, optimizerInput, {
    chunkSize: 20,
    progressIntervalMs: 0,
    yieldIntervalMs: 0,
})
const browserOptimizer = await createDriveDiscOptimizerRuntime({
    availableParallelism: () => 1,
    yieldControl: async () => {},
}).optimizeDriveDiscsAsync(parityCatalog, optimizerStore, optimizerInput, {
    chunkSize: 20,
    progressIntervalMs: 0,
    yieldIntervalMs: 0,
})
assert.equal(nodeOptimizer.metrics.strictExact, true)
assert.ok(Number(nodeOptimizer.metrics.parallelTaskCount ?? 0) > 0)
assert.equal(nodeOptimizer.metrics.dominanceMode, "all-stats")
assert.deepEqual(
    nodeOptimizer.results.map(result => result.driveDiscs.map(disc => disc.id)),
    browserOptimizer.results.map(result => result.driveDiscs.map(disc => disc.id)),
    "Node Worker and browser optimizer must rank the same dynamic-formula loadouts",
)
assert.deepEqual(
    nodeOptimizer.results.map(result => result.score),
    browserOptimizer.results.map(result => result.score),
    "Node Worker and browser optimizer dynamic-formula scores must match",
)

const validFormulaWEngine = {
    id: "formula_w_engine",
    name: { zhCN: "公式音擎" },
    rarity: "A",
    specialty: "armorer",
    level60: { defBase: 1, advancedStat: { stat: "critRate", value: 20, mode: "pct" } },
    modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
    effect: {
        name: { zhCN: "公式" },
        description: { zhCN: "公式" },
        selfBuff: {
            scope: "inCombat",
            effects: [clone(marrowRule)],
        },
    },
}
const validFormulaResult = validateMaintenanceItem("w-engines", validFormulaWEngine)
assert.deepEqual(validFormulaResult.errors, [])
const incompleteFormulaWEngine = clone(validFormulaWEngine)
delete incompleteFormulaWEngine.effect.selfBuff.effects[0].formula.modificationValues
const incompleteFormulaResult = validateMaintenanceItem("w-engines", incompleteFormulaWEngine)
assert.equal(incompleteFormulaResult.ok, false)
assert.ok(incompleteFormulaResult.errors.some(error => error.includes("完整的改装等级参数")))
const partialFormulaWEngine = clone(validFormulaWEngine)
delete partialFormulaWEngine.effect.selfBuff.effects[0].formula.modificationValues.cap
const partialFormulaResult = validateMaintenanceItem("w-engines", partialFormulaWEngine)
assert.equal(partialFormulaResult.ok, false)
assert.ok(partialFormulaResult.errors.some(error => error.includes("modificationValues.cap")))
assert.equal(isAllowedInCombatFormulaSourceType("wEngine"), true)
assert.equal(isAllowedInCombatFormulaSourceType("driveDisc4pc"), true)
assert.equal(isAllowedInCombatFormulaSourceType("teammate"), false)
const invalidTeamFormula = clone(validFormulaWEngine)
invalidTeamFormula.effect.selfBuff.effects[0].source.kind = "inCombatStat"
const invalidTeamResult = validateMaintenanceItem("teammate-buffs", {
    teammate: {
        id: "formula_teammate",
        name: { zhCN: "队友" },
        attribute: "physical",
        specialty: "support",
        buffs: [],
    },
    buff: {
        id: "formula_teammate.buff",
        source: { zhCN: "核心被动" },
        description: { zhCN: "公式" },
        scope: "inCombat",
        effects: [clone(marrowRule)],
    },
}, { teammates: [] })
assert.equal(invalidTeamResult.ok, false)
assert.ok(invalidTeamResult.errors.some(error => error.includes("角色自身或当前装备的音擎")))

const legacyEffect = {
    scope: "inCombat",
    effects: [
        {
            id: "marrow-overflow-rate",
            type: "fixed",
            stat: "sharpOverflowPerCritRate",
            value: 0.48,
            modificationValues: { value: [0.48, 0.56, 0.64, 0.72, 0.8] },
            mode: "flat",
            target: { kind: "sharp" },
        },
        {
            id: "marrow-overflow-cap",
            type: "fixed",
            stat: "sharpOverflowCap",
            value: 24,
            modificationValues: { value: [24, 28, 32, 36, 40] },
            mode: "flat",
            target: { kind: "sharp" },
        },
    ],
}
const migratedEffect = migrateLegacySharpOverflowEffect(legacyEffect)
assert.equal(migratedEffect.effects.length, 1)
assert.equal(migratedEffect.effects[0].id, "marrow-overflow-damage")
assert.equal(migratedEffect.effects[0].source.kind, "inCombatStat")
assert.equal(migratedEffect.effects[0].scope, "inCombat")
const migratedOfficial = migrateLegacyBloodMarrowWEngine({ id: "zzz_wiki_2189", effect: { selfBuff: legacyEffect } })
assert.equal(migratedOfficial.effect.selfBuff.effects.length, 1)
const migratedTopLevelOfficial = migrateLegacyBloodMarrowWEngine({ id: "zzz_wiki_2189", selfBuff: legacyEffect })
assert.equal(migratedTopLevelOfficial.selfBuff, undefined)
assert.equal(migratedTopLevelOfficial.effect.selfBuff.effects.length, 1)
const legacyCatalog = cloneCatalog()
legacyCatalog.wEngines = legacyCatalog.wEngines.map(engine => engine.id === "zzz_wiki_2189"
    ? { ...engine, effect: { ...engine.effect, selfBuff: legacyEffect } }
    : engine)
const normalizedLegacyCatalog = normalizeCatalog(legacyCatalog)
assert.equal(
    normalizedLegacyCatalog.wEnginesMap.get("zzz_wiki_2189").effect.selfBuff.effects[0].id,
    "marrow-overflow-damage",
    "catalog loading must migrate the official legacy Blood Marrow pair",
)
assert.equal(
    migrateLegacyBloodMarrowWEngine({ id: "custom", effect: { selfBuff: legacyEffect } }).effect.selfBuff.effects.length,
    2,
    "non-official legacy entries must not be guessed into Blood Marrow",
)
const sanitizedLegacyCustom = sanitizeAddedCombatBuffs([{
    id: "legacy-custom",
    sourceCategory: "custom",
    sourceKind: "custom",
    name: "旧自定义",
    stats: [
        { id: "old-rate", stat: "sharpOverflowPerCritRate", value: 0.8 },
        { id: "valid", stat: "critRate", value: 10 },
    ],
    effects: [
        { id: "old-cap", type: "fixed", stat: "sharpOverflowCap", value: 40 },
        { id: "valid-effect", type: "fixed", stat: "dmgBonus", value: 10 },
    ],
}], {})
assert.equal(sanitizedLegacyCustom.length, 1)
assert.deepEqual(sanitizedLegacyCustom[0].stats.map(item => item.stat), ["critRate"])
assert.deepEqual(sanitizedLegacyCustom[0].effects.map(item => item.stat), ["dmgBonus"])
assert.equal("marrow-overflow-rate" in (sanitizedLegacyCustom[0].runtime?.effects ?? {}), false)

for (const value of [catalog, catalog.wEngines]) {
    const text = JSON.stringify(value)
    assert.equal(text.includes("sharpOverflowPerCritRate"), false)
    assert.equal(text.includes("sharpOverflowCap"), false)
}

const marrowText = storedEffectRuleText(
    materializeFormulaRuleForModificationLevel(marrowRule, 5),
    defaultRuntimeForBuff(marrow.effect.selfBuff),
    marrow.effect.selfBuff,
    { agents: [], agentSkills: [] },
    { inCombatPanel: { critRate: 1.188 } },
)
assert.match(marrowText, /局内暴击率超过100%时/u)
assert.match(marrowText, /当前局内暴击率118.8%，通用伤害提升15.04%/u)
assert.doesNotMatch(marrowText, /来源数值输入/u)

console.log("in-combat formula tests passed")
