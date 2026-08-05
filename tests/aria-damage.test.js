import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    OptimizerCancelledError,
    optimizeDriveDiscs,
    optimizeDriveDiscsAsync,
} from "../core/driveDiscOptimizer-core.js"
import {
    createAnomalySourceSnapshot,
    evaluateAnomalyReleaseProfile,
    evaluateReleaseExpression,
    evaluateReleaseExpressionInterval,
    normalizeAnomalySourceSnapshot,
    validateAnomalyReleaseProfile,
} from "../core/anomalyRelease.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("aria")
const signature = catalog.wEnginesMap.get("zzz_wiki_1883")

const futureSnapshot = normalizeAnomalySourceSnapshot({
    schemaVersion: 2,
    agentId: "future_source",
    panel: { atk: 1000, futurePanelField: { keep: true } },
    outOfCombatPanel: { atk: 900 },
    buffTotals: { dmgBonus: 20 },
    futureSnapshotField: { keep: true },
})
assert.equal(futureSnapshot.schemaVersion, 2)
assert.deepEqual(futureSnapshot.futureSnapshotField, { keep: true })
assert.deepEqual(futureSnapshot.panel.futurePanelField, { keep: true })

function approx(actual, expected, message, epsilon = 1e-8) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon, `${message}: expected ${expected}, got ${actual}`)
}

function disc(id, setId, partition, mainStat, subStats = []) {
    return {
        id,
        ownerId: "default",
        setId,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat,
        subStats,
        source: { type: "test", sequence: Number(id.replace(/\D/g, "")) || 1 },
    }
}

const masteryDiscs = [
    disc("aria-1", "phaethons_melody", 1, { stat: "hpFlat", value: 0, mode: "flat" }),
    disc("aria-6", "phaethons_melody", 6, { stat: "anomalyMastery", value: 30, mode: "pct" }),
]

function releaseInput(overrides = {}) {
    const activeBuffIds = overrides.activeBuffIds ?? [
        "agent:aria.corePassive",
        "agent:aria.additionalAbility",
        "wEngine:zzz_wiki_1883.self",
    ]
    return {
        agentId: "aria",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_1883",
        wEngineModificationLevel: 1,
        driveDiscs: masteryDiscs,
        combatBuffs: {
            activeBuffIds,
            manualStats: overrides.manualStats ?? [],
            runtimeInputs: overrides.runtimeInputs ?? {},
        },
        damage: {
            ...agent.defaultCalculationConfig,
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: { ether: 0 },
            },
            ...(overrides.damage ?? {}),
        },
        ...overrides.input,
    }
}

function catalogWithAria(testAgent) {
    const agentsMap = new Map(catalog.agentsMap)
    agentsMap.set(testAgent.id, testAgent)
    return {
        ...catalog,
        agents: catalog.agents.map(item => item.id === testAgent.id ? testAgent : item),
        agentsMap,
    }
}

assert.ok(agent, "Aria should be present in the agent catalog")
assert.deepEqual(agent.level60, {
    hpBase: 7749,
    atkBase: 788,
    defBase: 619,
    critRate: 5,
    critDmg: 50,
    impact: 87,
    anomalyProficiency: 116,
    anomalyMastery: 115,
    energyRegen: 120,
    penRatio: 0,
})
assert.equal(agent.images.portrait, "/assets/agents/aria.png")
assert.deepEqual(agent.preferredDriveDiscs.defaultSetIds, ["phaethons_melody"])
const cinemaOneBuff = agent.combatBuffs.cinemaBuffs.find(buff => buff.cinemaLevel === 1)
assert.deepEqual(
    agent.combatBuffs.cinemaBuffs.map(buff => buff.cinemaLevel),
    [1, 2, 6],
    "Aria should expose only the modeled Cinema Buffs",
)
assert.deepEqual(
    cinemaOneBuff.effects.map(effect => ({
        stat: effect.stat,
        value: effect.value,
        target: effect.target,
    })),
    [
        {
            stat: "anomalyCritRate",
            value: 25,
            target: { kind: "anomaly", settlementType: "release" },
        },
        {
            stat: "anomalyCritDmg",
            value: 25,
            target: { kind: "anomaly", settlementType: "release" },
        },
        {
            stat: "anomalyCritRatePerInitialMasteryAbove100",
            value: 0.5,
            target: { kind: "anomaly", settlementType: "release" },
        },
    ],
    "Aria Cinema 1 should store base Crit, Crit DMG, and initial-Mastery conversion as separate effects",
)
assert.equal(agent.anomalyReleaseProfiles[0].critRateBonusExpression, undefined)
assert.deepEqual(
    agent.combatBuffs.additionalAbility.effects.map(effect => ({
        type: effect.type,
        stat: effect.stat,
        value: effect.value,
        mode: effect.mode,
        target: effect.target,
    })),
    [
        {
            type: "fixed",
            stat: "anomalyDurationBonusSeconds",
            value: 3,
            mode: "flat",
            target: {
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffects: ["corruption"],
                anomalyVariants: ["normal"],
            },
        },
        {
            type: "fixed",
            stat: "anomalyDurationBonusSeconds",
            value: 3,
            mode: "flat",
            target: {
                kind: "anomaly",
                settlementType: "disorder",
                anomalyEffects: ["corruption"],
            },
        },
    ],
    "Aria additional ability should extend both Corruption and Corruption Disorder without relying on generated effect ids",
)
assert.equal(agent.coreSkill.corePassiveScaling.levels.length, 7)
assert.deepEqual(
    agent.coreSkill.corePassiveScaling.levels.map(level => level.anomalyProficiencyFlat),
    [45, 52, 60, 67, 75, 82, 90],
)
assert.deepEqual(agent.combatBuffs.corePassive.effects[0].valueSource, {
    kind: "corePassiveScaling",
    field: "anomalyProficiencyFlat",
})
assert.ok(agent.coreSkill.levels.every(level =>
    !(level.stats ?? []).some(stat => stat.stat === "anomalyProficiencyFlat")))
assert.deepEqual(
    agent.coreSkill.corePassiveScaling.levels.map(level => level.releaseCoefficientPctByElement.ether),
    [13.8, 16, 18.3, 20.6, 22.9, 25.2, 27.5],
)
for (const level of agent.coreSkill.corePassiveScaling.levels) {
    assert.deepEqual(Object.keys(level.releaseCoefficientPctByElement), ["ether", "electric", "fire", "physical", "ice", "wind"])
}
assert.equal(agent.defaultCalculationConfig.events[0].settlementType, "release")
assert.equal(agent.defaultCalculationConfig.events[0].anomalyVariant, undefined)
assert.deepEqual(agent.defaultCalculationConfig.events[0].triggerActorRef, { agentId: "aria", profileId: "core_passive" })
assert.equal(agent.defaultCalculationConfig.events[0].stunned, true)

const percentLeaf = evaluateReleaseExpression({
    kind: "constant",
    value: 62.5,
    unit: "percent",
    label: { zhCN: "百分数边界" },
})
approx(percentLeaf.value, 0.625, "percent values convert exactly once at the formula boundary")
assert.equal(percentLeaf.trace.rawValue, 62.5)
assert.equal(percentLeaf.trace.unit, "percent")
assert.equal(percentLeaf.trace.expression, "62.5%")
const dividedInterval = evaluateReleaseExpressionInterval({
    op: "divide",
    args: [
        { kind: "triggerStat", panel: "outOfCombat", stat: "anomalyMastery", unit: "raw" },
        { kind: "triggerStat", panel: "outOfCombat", stat: "anomalyProficiency", unit: "raw" },
    ],
}, {
    trigger: {
        outOfCombatPanel: {
            anomalyMastery: { min: 10, max: 20 },
            anomalyProficiency: { min: 2, max: 5 },
        },
    },
})
assert.deepEqual(dividedInterval, { min: 2, max: 10 }, "division bounds must use opposite denominator endpoints")

const fixedRelease = evaluateAnomalyReleaseProfile({
    id: "fixed-test",
    name: { zhCN: "固定倍率测试" },
    resultMode: "fixedAnomalyMultiplier",
    expression: { kind: "constant", value: 5, unit: "decimal" },
}, { originalBaseMultiplier: 0.625 })
approx(fixedRelease.formulaValue, 5, "fixed profile formula value")
approx(fixedRelease.finalBaseMultiplier, 5, "fixed profile replaces the anomaly base multiplier")
approx(fixedRelease.releaseScale, 8, "fixed profile converts relative to the original anomaly unit")
const screenshotRelease = evaluateAnomalyReleaseProfile(agent.anomalyReleaseProfiles[0], {
    originalBaseMultiplier: 0.625,
    trigger: { outOfCombatPanel: { anomalyMastery: 196.3 } },
    coreScalingRow: { releaseCoefficientPctByElement: { ether: 27.5 } },
    event: { stunned: true },
    eventElement: "ether",
})
assert.equal(screenshotRelease.trace.expression, "196.3 / 10 × 27.5% × 1.5 = 8.097375")
assert.throws(() => evaluateReleaseExpression({
    op: "divide",
    args: [
        { kind: "constant", value: 1, unit: "raw" },
        { kind: "constant", value: 0, unit: "raw" },
    ],
}), /不能除以 0/)
assert.ok(validateAnomalyReleaseProfile({
    id: "illegal-stat",
    supportedElements: ["ether"],
    resultMode: "originalAnomalyRatio",
    expression: { kind: "triggerStat", panel: "outOfCombat", stat: "critRate", unit: "raw", whiteBoxRole: "conversionSource" },
}).some(message => message.includes("不是允许的触发者属性")))

const skills = catalog.agentSkillsMap.get("aria")
assert.equal(skills.categories.find(category => category.id === "basic").moves
    .find(move => move.id === "sweetheart_rhythm").rows.find(row => row.id === "hit_4").values.at(-1), 459.7)
assert.equal(skills.categories.find(category => category.id === "basic").moves
    .find(move => move.id === "absolute_pitch").rows.find(row => row.id === "enhanced_charge_damage").values.at(-1), 758.9)
assert.equal(skills.categories.find(category => category.id === "special").moves
    .find(move => move.id === "ex_fall_into_delusion").rows.find(row => row.id === "damage").values.at(-1), 1208.7)
assert.equal(skills.categories.find(category => category.id === "chain").moves
    .find(move => move.id === "ultimate_full_vitality").rows.find(row => row.id === "damage").values.at(-1), 3835)

assert.ok(signature, "Aria signature W-Engine should be present")
assert.equal(signature.level60.atkBase, 713)
assert.deepEqual(signature.level60.advancedStat, { stat: "anomalyMastery", value: 30, mode: "pct" })
assert.equal(signature.images.icon, "/assets/w-engines/zzz_wiki_1883.png")
assert.deepEqual(signature.effect.selfBuff.effects[0].modificationValues.value, [90, 103, 117, 130, 144])
assert.deepEqual(signature.effect.selfBuff.effects[1].modificationValues.value, [20, 23, 26, 29, 32])
assert.deepEqual(signature.effect.selfBuff.effects[2].modificationValues.value, [10, 11.5, 13, 14.5, 16])
const vitalityEtherBonus = signature.effect.selfBuff.effects.find(effect => effect.id === "vitality-hit-ether-dmg")
const vitalityAnomalyBonus = signature.effect.selfBuff.effects.find(effect => effect.id === "vitality-hit-anomaly-dmg")
const vitalityDisorderBonus = signature.effect.selfBuff.effects.find(effect => effect.id === "vitality-hit-disorder-dmg")
assert.deepEqual(vitalityEtherBonus.requirement, { attribute: "ether" })
assert.deepEqual(vitalityAnomalyBonus.target, { kind: "default" })
assert.equal(vitalityAnomalyBonus.requirement, undefined)
assert.equal(vitalityDisorderBonus.requirement, undefined)

const coreProficiencyByLevel = new Map([
    ["none", 45],
    ["A", 52],
    ["B", 60],
    ["C", 67],
    ["D", 75],
    ["E", 82],
    ["F", 90],
])
for (const [coreSkillLevel, corePassiveProficiency] of coreProficiencyByLevel) {
    const baseInput = {
        agentId: "aria",
        coreSkillLevel,
        wEngineId: "zzz_wiki_212",
        driveDiscs: [],
        damage: {
            ...agent.defaultCalculationConfig,
            target: { defense: 953, levelCoefficient: 794, resistanceByElement: { ether: 0 } },
        },
    }
    const enabled = calculateInCombatPanel(catalog, {
        ...baseInput,
        combatBuffs: { activeBuffIds: ["agent:aria.corePassive"] },
    })
    const disabled = calculateInCombatPanel(catalog, {
        ...baseInput,
        combatBuffs: { activeBuffIds: [] },
    })
    approx(enabled.outOfCombat.panel.anomalyProficiency, 116, `${coreSkillLevel} out-of-combat proficiency`)
    approx(enabled.inCombat.panel.anomalyProficiency, 116 + corePassiveProficiency, `${coreSkillLevel} active core proficiency`)
    approx(disabled.inCombat.panel.anomalyProficiency, 116, `${coreSkillLevel} disabled core proficiency`)
    const resolvedCore = enabled.inCombat.activeEffects.find(effect => effect.key === "agent:aria.corePassive")
    approx(resolvedCore.resolvedStats[0].value, corePassiveProficiency, `${coreSkillLevel} resolved core effect`)
}

const release = calculateInCombatPanel(catalog, releaseInput())
approx(release.outOfCombat.panel.anomalyProficiency, 116, "F core proficiency must stay out of the out-of-combat panel")
approx(release.inCombat.panel.anomalyProficiency, 296, "F core and signature proficiency should remain 296")
approx(release.outOfCombat.panel.anomalyMastery, 253.68, "unrounded out-of-combat anomaly mastery")
approx(release.damage.multipliers.releaseScale, 10.4643, "stunned F-level ether release ratio")
approx(release.damage.multipliers.originalAnomalyBaseMultiplier, 0.625, "release should inherit one corruption proc")
approx(release.damage.multipliers.anomaly, 0.625 * 10.4643, "release effective anomaly multiplier")
const releaseWhiteBoxRows = release.damage.whiteBoxRows
assert.equal(releaseWhiteBoxRows.find(row => row.label === "原异常单次倍率")?.formula, "侵蚀")
assert.deepEqual(
    releaseWhiteBoxRows.find(row => row.label === "转换数据来源"),
    {
        label: "转换数据来源",
        formula: "局外异常掌控",
        value: 253.68,
        displayValue: "253.68",
    },
)
assert.equal(
    releaseWhiteBoxRows.find(row => row.label === "异放公式：异放倍率")?.formula,
    "253.68 / 10 × 27.5% × 1.5 = 10.4643",
)
for (const hiddenLabel of ["异放倍率方案", "异常掌控除数", "局外异常掌控换算", "核心属性系数"]) {
    assert.equal(releaseWhiteBoxRows.some(row => row.label === hiddenLabel), false, `${hiddenLabel} should not occupy its own white-box row`)
}
assert.ok(release.damage.whiteBoxRows.some(row => row.label === "异放失衡倍率修正" && row.value === 1.5))
assert.ok(release.damage.whiteBoxRows.some(row => row.label === "失衡乘区" && row.value === 1.5))

const legacyReleaseEvent = {
    ...agent.defaultCalculationConfig.events[0],
    settlementType: "attribute",
    anomalyVariant: "release",
}
delete legacyReleaseEvent.triggerActorRef
delete legacyReleaseEvent.anomalySource
const migratedLegacyRelease = calculateInCombatPanel(catalog, releaseInput({
    damage: {
        selectedEventId: legacyReleaseEvent.id,
        events: [legacyReleaseEvent],
    },
}))
approx(migratedLegacyRelease.damage.totalFinalDamage, release.damage.totalFinalDamage,
    "legacy release variants must upgrade without changing damage")
assert.equal(migratedLegacyRelease.damage.input.settlementType, "release")
assert.equal(migratedLegacyRelease.damage.input.anomalyVariant, undefined)
assert.deepEqual(migratedLegacyRelease.damage.input.triggerActorRef, { agentId: "aria", profileId: "core_passive" })

const inCombatMastery = calculateInCombatPanel(catalog, releaseInput({
    manualStats: [{ id: "combat-am", stat: "anomalyMasteryFlat", value: 100, mode: "flat" }],
}))
assert.ok(inCombatMastery.inCombat.panel.anomalyMastery > inCombatMastery.outOfCombat.panel.anomalyMastery)
approx(inCombatMastery.damage.multipliers.releaseScale, release.damage.multipliers.releaseScale, "in-combat mastery must not change release ratio")

const withoutMasteryMain = calculateInCombatPanel(catalog, releaseInput({ input: { driveDiscs: masteryDiscs.slice(0, 1) } }))
assert.ok(withoutMasteryMain.damage.multipliers.releaseScale < release.damage.multipliers.releaseScale)

const cinemaOneLowMastery = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    input: {
        coreSkillLevel: "none",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [],
    },
}))
approx(cinemaOneLowMastery.outOfCombat.panel.anomalyMastery, 115, "low-mastery cinema test panel")
approx(cinemaOneLowMastery.damage.multipliers.anomalyCritBaseRate, 0.25, "cinema 1 base release crit rate")
approx(cinemaOneLowMastery.damage.multipliers.anomalyCritConvertedRate, 0.075, "cinema 1 converted release crit rate")
approx(cinemaOneLowMastery.damage.multipliers.anomalyCritRate, 0.325, "cinema 1 release crit formula below cap")
approx(cinemaOneLowMastery.damage.multipliers.anomalyCritDmg, 0.25, "cinema 1 release crit damage")

const fractionalMasteryDisc = disc(
    "aria-fractional-mastery",
    "astral_voice",
    6,
    { stat: "anomalyMastery", value: 70.69565217391305, mode: "pct" },
)
const coreFInitialMasteryDisc = disc(
    "aria-core-f-initial-mastery",
    "astral_voice",
    6,
    { stat: "anomalyMastery", value: 30, mode: "pct" },
)
const cinemaOneFractionalMastery = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    input: {
        coreSkillLevel: "none",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [fractionalMasteryDisc],
    },
}))
approx(cinemaOneFractionalMastery.outOfCombat.panel.anomalyMastery, 196.3, "fractional out-of-combat mastery")
approx(cinemaOneFractionalMastery.damage.multipliers.anomalyCritConvertedRate, 0.48,
    "conversion should floor the final out-of-combat panel mastery before applying the coefficient")
approx(cinemaOneFractionalMastery.damage.multipliers.anomalyCritRate, 0.73,
    "196 displayed initial mastery should produce 73% total anomaly Crit Rate")
assert.equal(
    cinemaOneFractionalMastery.damage.whiteBoxRows.some(row => row.label === "异常暴击率转换"),
    false,
    "Release whitebox should not expose a separate anomaly Crit conversion row",
)
assert.equal(
    cinemaOneFractionalMastery.damage.whiteBoxRows.find(row => row.label === "异常暴击区")?.formula,
    "1 + 73% × 25%",
    "Release whitebox should show only the combined anomaly Crit zone",
)

const legacyCritRateBonusExpression = {
    op: "multiply",
    args: [
        {
            op: "max",
            args: [
                {
                    op: "subtract",
                    args: [
                        { kind: "triggerStat", panel: "outOfCombat", stat: "anomalyMastery", unit: "raw" },
                        { kind: "constant", value: 100, unit: "raw" },
                    ],
                },
                { kind: "constant", value: 0, unit: "raw" },
            ],
        },
        { kind: "constant", value: 0.5, unit: "percent" },
    ],
}
const ariaWithBothCritSources = structuredClone(agent)
ariaWithBothCritSources.anomalyReleaseProfiles[0].critRateBonusExpression = legacyCritRateBonusExpression
const dualEncodedCinemaOne = calculateInCombatPanel(catalogWithAria(ariaWithBothCritSources), releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    input: {
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [coreFInitialMasteryDisc],
    },
}))
approx(dualEncodedCinemaOne.damage.multipliers.anomalyCritRate, 0.73,
    "the explicit Cinema Buff conversion must replace, not stack with, a legacy profile expression")

const legacyAria = structuredClone(ariaWithBothCritSources)
legacyAria.combatBuffs.cinemaBuffs.find(buff => buff.cinemaLevel === 1).effects =
    legacyAria.combatBuffs.cinemaBuffs.find(buff => buff.cinemaLevel === 1).effects
        .filter(effect => effect.stat !== "anomalyCritRatePerInitialMasteryAbove100")
const legacyCinemaOne = calculateInCombatPanel(catalogWithAria(legacyAria), releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    input: {
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [coreFInitialMasteryDisc],
    },
}))
approx(legacyCinemaOne.damage.multipliers.anomalyCritRate, 0.7315,
    "legacy catalogs without the explicit conversion Buff should retain the profile fallback")

const cinemaOneWithInCombatMastery = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    manualStats: [{ id: "combat-am", stat: "anomalyMasteryFlat", value: 100, mode: "flat" }],
    input: {
        coreSkillLevel: "none",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [],
    },
}))
approx(cinemaOneWithInCombatMastery.outOfCombat.panel.anomalyMastery, 115, "in-combat Buff must not alter initial mastery")
approx(cinemaOneWithInCombatMastery.inCombat.panel.anomalyMastery, 215, "in-combat mastery fixture")
approx(cinemaOneWithInCombatMastery.damage.multipliers.anomalyCritRate, 0.325,
    "in-combat mastery must not change the Cinema 1 conversion")

const ordinaryCorruption = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    damage: {
        mode: "anomaly",
        selectedEventId: "ordinary-corruption",
        events: [{
            id: "ordinary-corruption",
            kind: "anomaly",
            count: 1,
            stunned: true,
            settlementType: "attribute",
            anomalyEffect: "corruption",
            anomalyVariant: "normal",
            procCount: 1,
        }],
    },
}))
approx(ordinaryCorruption.damage.multipliers.anomalyCritRate, 0,
    "Cinema 1 anomaly Crit effects must not apply to ordinary Corruption")

const cinemaOneCapped = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
}))
approx(cinemaOneCapped.damage.multipliers.anomalyCritRate, 1, "cinema 1 release crit cap")

const cinemaTwo = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.2"],
}))
approx(cinemaTwo.damage.targetBreakdown.enemyDefReduction, 0.24, "cinema 2 default 16% + delusion 8% DEF ignore")
const cinemaTwoNoDelusion = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.2"],
    runtimeInputs: {
        "agent:aria.cinema.2": {
            effects: { "release-delusion-def-ignore-8": { coverage: 0 } },
        },
    },
}))
approx(cinemaTwoNoDelusion.damage.targetBreakdown.enemyDefReduction, 0.16, "cinema 2 independent delusion coverage")

const normalCorruption = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.additionalAbility"],
    damage: {
        selectedEventId: "normal-corruption",
        events: [{ id: "normal-corruption", kind: "anomaly", anomalyEffect: "corruption", anomalyVariant: "normal", stunned: false }],
    },
}))
assert.equal(normalCorruption.damage.input.procCount, 26, "additional ability should extend a full corruption to 26 procs")
const releaseWithDurationBuff = calculateInCombatPanel(catalog, releaseInput())
assert.equal(releaseWithDurationBuff.damage.input.procCount, 1, "corruption duration must not multiply release")
approx(releaseWithDurationBuff.damage.multipliers.anomalyDamage, 1.1, "default-scoped Vitality anomaly bonus should affect Release")

function directEventsInput() {
    return {
        selectedEventId: "enhanced",
        events: [
            { id: "enhanced", kind: "direct", stunned: false, skillRef: { agentSkillId: "aria", categoryId: "basic", moveId: "absolute_pitch", rowId: "enhanced_charge_damage" } },
            { id: "charge", kind: "direct", stunned: false, skillRef: { agentSkillId: "aria", categoryId: "basic", moveId: "absolute_pitch", rowId: "charge_3_damage" } },
            { id: "ultimate", kind: "direct", stunned: false, skillRef: { agentSkillId: "aria", categoryId: "chain", moveId: "ultimate_full_vitality", rowId: "damage" } },
        ],
    }
}
const cinemaSix = calculateInCombatPanel(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.6"],
    damage: directEventsInput(),
}))
const cinemaSixById = new Map(cinemaSix.damage.events.map(event => [event.id, event]))
approx(cinemaSixById.get("enhanced").multipliers.dmg, 1.4, "cinema 6 enhanced charged basic bonus")
approx(cinemaSixById.get("ultimate").multipliers.dmg, 1.4, "cinema 6 ultimate bonus")
approx(cinemaSixById.get("charge").multipliers.dmg, 1.4, "cinema 6 current Ether damage bonus target")

function teammateRelease(activeBuffIds) {
    return calculateInCombatPanel(catalog, releaseInput({
        activeBuffIds: ["agent:aria.corePassive", ...activeBuffIds],
        input: {
            wEngineId: "zzz_wiki_212",
            driveDiscs: [],
        },
    }))
}

const teammateReleaseBaseline = teammateRelease([])
for (const buff of catalog.teammateCombatBuffs) {
    const result = teammateRelease([buff.id])
    assert.ok(
        Number.isFinite(result.damage.totalFinalDamage) && result.damage.totalFinalDamage > 0,
        `${buff.id} should produce a finite positive Aria Release result`,
    )
}

for (const buffId of [
    "buff_j8kf2r9m4q",
    "qianxia.cinema_1.cat_gaze_def_reduction",
    "qianxia.cinema_2.aether_curtain_atk_pct",
    "qianxia.cinema_4.ultimate_team_dmg_bonus",
    "buff_23620b7000",
    "youye.additional_ability.anomaly_damage_bonus",
    "rina.core_pen_ratio",
    "nicole.additional_ether_damage",
    "liuyin.cinema_1.good_review_res_ignore",
    "yaojiayin.cinema_1.enemy_res_reduction",
]) {
    assert.ok(
        teammateRelease([buffId]).damage.totalFinalDamage > teammateReleaseBaseline.damage.totalFinalDamage,
        `${buffId} should increase Aria Corruption Release damage`,
    )
}

for (const buffId of [
    "rina.additional_electric_damage",
    "soukaku.additional_ice_damage",
    "lucia_elowen.ex_special_darkbreaker_sheer_force",
    "jane_doe.core_insight",
]) {
    approx(
        teammateRelease([buffId]).damage.totalFinalDamage,
        teammateReleaseBaseline.damage.totalFinalDamage,
        `${buffId} should not affect Aria Corruption Release damage`,
    )
}

const qingyiCoreRelease = teammateRelease(["qingyi.core_subjugation_stun_multiplier"])
const qingyiCinemaTwoOnlyRelease = teammateRelease(["qingyi.cinema_2_subjugation_amplify"])
const qingyiCombinedRelease = teammateRelease([
    "qingyi.core_subjugation_stun_multiplier",
    "qingyi.cinema_2_subjugation_amplify",
])
approx(
    qingyiCinemaTwoOnlyRelease.damage.totalFinalDamage,
    teammateReleaseBaseline.damage.totalFinalDamage,
    "Qingyi Cinema 2 modifier should not create a standalone Aria damage Buff",
)
assert.ok(
    qingyiCombinedRelease.damage.totalFinalDamage > qingyiCoreRelease.damage.totalFinalDamage,
    "Qingyi Cinema 2 should amplify the selected core stun multiplier for Aria Release",
)

const alienAttribute = calculateInCombatPanel(catalog, {
    ...releaseInput(),
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    combatBuffs: { activeBuffIds: ["wEngine:zzz_wiki_1883.self"] },
    damage: {
        selectedEventId: "assault",
        events: [{ id: "assault", kind: "anomaly", anomalyEffect: "assault", stunned: false }],
        target: { defense: 953, levelCoefficient: 794, resistanceByElement: { physical: 0 } },
    },
})
approx(alienAttribute.inCombat.panel.etherDmg, 0, "ether-only signature damage rule must not apply to physical anomaly agents")
approx(alienAttribute.damage.multipliers.anomalyDamage, 1.1, "signature anomaly bonus should apply to physical Attribute Anomaly")

const aliceCinemaTwoAttribute = calculateInCombatPanel(catalog, {
    ...releaseInput(),
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    combatBuffs: {
        activeBuffIds: ["agent:alice_thymefield.cinema.2", "wEngine:zzz_wiki_1883.self"],
    },
    damage: {
        selectedEventId: "assault",
        events: [{ id: "assault", kind: "anomaly", anomalyEffect: "assault", stunned: false }],
        target: { defense: 953, levelCoefficient: 794, resistanceByElement: { physical: 0 } },
    },
})
approx(aliceCinemaTwoAttribute.damage.multipliers.anomalyDamage, 1.25,
    "Alice Cinema 2 Assault bonus should share the Attribute Anomaly bonus zone")

const alienDisorder = calculateInCombatPanel(catalog, {
    ...releaseInput(),
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    combatBuffs: { activeBuffIds: ["wEngine:zzz_wiki_1883.self"] },
    damage: {
        selectedEventId: "physical-disorder",
        events: [{
            id: "physical-disorder",
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: "flinch",
            disorderType: "normal",
            elapsedSeconds: 0,
            stunned: false,
        }],
        target: { defense: 953, levelCoefficient: 794, resistanceByElement: { physical: 0 } },
    },
})
approx(alienDisorder.damage.multipliers.disorderDamage, 1.1, "signature Disorder bonus should apply to physical Disorder")

const aliceSnapshot = createAnomalySourceSnapshot({
    agentId: "alice_thymefield",
    agentLevel: 60,
    outOfCombatPanel: aliceCinemaTwoAttribute.outOfCombat.panel,
    inCombatPanel: aliceCinemaTwoAttribute.inCombat.panel,
    buffTotals: aliceCinemaTwoAttribute.inCombat.buffTotals,
    capturedAt: "2026-07-23T00:00:00.000Z",
    sourceConfigHash: "alice-source-v1",
})
const externalReleaseDamage = {
    ...agent.defaultCalculationConfig,
    events: agent.defaultCalculationConfig.events.map(event => ({
        ...event,
        anomalySource: {
            actorRef: { agentId: "alice_thymefield" },
            snapshot: aliceSnapshot,
        },
    })),
}
const externalRelease = calculateInCombatPanel(catalog, releaseInput({ damage: externalReleaseDamage }))
const externalReleaseEvent = externalRelease.damage.events[0]
assert.equal(externalReleaseEvent.panelSnapshot.sourceAgentId, "alice_thymefield")
assert.equal(externalReleaseEvent.panelSnapshot.sourceSnapshot.sourceConfigHash, "alice-source-v1")
approx(externalReleaseEvent.multipliers.anomalyDamage, 1.1,
    "Alice Cinema 2 precise Assault bonus should not leak into Release")
approx(externalReleaseEvent.panelSnapshot.atk, aliceSnapshot.panel.atk, "external release uses frozen source ATK")
approx(externalRelease.damage.multipliers.anomalyProficiency, aliceSnapshot.panel.anomalyProficiency / 100,
    "external release uses frozen source anomaly proficiency")

const externalWithLowerTriggerMastery = calculateInCombatPanel(catalog, releaseInput({
    input: { driveDiscs: masteryDiscs.slice(0, 1) },
    damage: externalReleaseDamage,
}))
approx(externalWithLowerTriggerMastery.damage.events[0].panelSnapshot.atk, aliceSnapshot.panel.atk,
    "trigger equipment changes must not overwrite the source snapshot")
assert.ok(externalWithLowerTriggerMastery.damage.multipliers.releaseScale < externalRelease.damage.multipliers.releaseScale,
    "trigger out-of-combat mastery still drives the release formula")

const refreshedAliceSnapshot = createAnomalySourceSnapshot({
    ...aliceSnapshot,
    inCombatPanel: { ...aliceSnapshot.panel, atk: aliceSnapshot.panel.atk + 500 },
    outOfCombatPanel: aliceSnapshot.outOfCombatPanel,
    buffTotals: aliceSnapshot.buffTotals,
    capturedAt: "2026-07-23T01:00:00.000Z",
    sourceConfigHash: "alice-source-v2",
})
const refreshedExternalRelease = calculateInCombatPanel(catalog, releaseInput({
    damage: {
        ...externalReleaseDamage,
        events: externalReleaseDamage.events.map(event => ({
            ...event,
            anomalySource: { actorRef: { agentId: "alice_thymefield" }, snapshot: refreshedAliceSnapshot },
        })),
    },
}))
assert.ok(refreshedExternalRelease.damage.totalFinalDamage > externalRelease.damage.totalFinalDamage,
    "source changes affect release only after replacing the frozen snapshot")
assert.throws(() => calculateInCombatPanel(catalog, releaseInput({
    damage: {
        ...agent.defaultCalculationConfig,
        events: agent.defaultCalculationConfig.events.map(event => ({
            ...event,
            triggerActorRef: { agentId: "alice_thymefield", profileId: "core_passive" },
        })),
    },
})), /触发者必须是当前配装角色/)
assert.throws(() => calculateInCombatPanel(catalog, releaseInput({
    damage: {
        ...agent.defaultCalculationConfig,
        events: agent.defaultCalculationConfig.events.map(event => ({
            ...event,
            anomalySource: { actorRef: { agentId: "alice_thymefield" } },
        })),
    },
})), /必须提供与角色一致的冻结快照/)

const summaryStats = new Map()
const summarySets = new Map()
for (const item of masteryDiscs) {
    summarySets.set(item.setId, (summarySets.get(item.setId) ?? 0) + 1)
    for (const stat of [item.mainStat, ...(item.subStats ?? [])]) {
        summaryStats.set(stat.stat, (summaryStats.get(stat.stat) ?? 0) + Number(stat.value ?? 0))
    }
}
const prepared = createInCombatPanelCalculator(catalog, releaseInput())
const fullPrepared = prepared.calculate(masteryDiscs, { round: false })
const compiledPrepared = prepared.scoreOnlyFromSummary(summaryStats, summarySets)
const mapPrepared = prepared.scoreOnlyFromSummaryLegacy(summaryStats, summarySets)
approx(compiledPrepared.finalDamage, fullPrepared.damage.totalFinalDamage, "compiled release score")
approx(mapPrepared.finalDamage, fullPrepared.damage.totalFinalDamage, "map release score")

const scopedBonusAgent = structuredClone(agent)
scopedBonusAgent.combatBuffs.cinemaBuffs.push({
    cinemaLevel: 5,
    cinemaName: { zhCN: "测试：异放增伤乘区" },
    description: { zhCN: "仅用于锁定广域、属性异常精确和异放精确增伤边界。" },
    scope: "inCombat",
    defaultChecked: false,
    effects: [
        {
            id: "test-release-anomaly-damage",
            type: "fixed",
            stat: "anomalyDamageBonus",
            value: 20,
            mode: "flat",
            target: { kind: "anomaly", settlementType: "release" },
        },
        {
            id: "test-attribute-corruption-damage",
            type: "fixed",
            stat: "anomalyDamageBonus",
            value: 30,
            mode: "flat",
            target: {
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffects: ["corruption"],
            },
        },
    ],
    buffModifiers: [],
})
const scopedBonusCatalog = catalogWithAria(scopedBonusAgent)
const scopedBonusInput = releaseInput({
    activeBuffIds: [
        "agent:aria.corePassive",
        "agent:aria.additionalAbility",
        "agent:aria.cinema.5",
        "wEngine:zzz_wiki_1883.self",
    ],
})
const scopedBonusPrepared = createInCombatPanelCalculator(scopedBonusCatalog, scopedBonusInput)
const scopedBonusFull = scopedBonusPrepared.calculate(masteryDiscs, { round: false })
approx(
    scopedBonusFull.damage.events[0].multipliers.anomalyDamage,
    1.3,
    "Release should add broad and precise Release bonuses while excluding precise Attribute Anomaly bonuses",
)
const scopedBonusCompiled = scopedBonusPrepared.scoreOnlyFromSummary(summaryStats, summarySets)
const scopedBonusLegacy = scopedBonusPrepared.scoreOnlyFromSummaryLegacy(summaryStats, summarySets)
const scopedStatIds = [...summaryStats.keys()]
const scopedSetIds = [...summarySets.keys()]
const scopedSetIndexById = new Map(scopedSetIds.map((setId, index) => [setId, index]))
const scopedStatValues = Float64Array.from(scopedStatIds, statId => summaryStats.get(statId) ?? 0)
const scopedSetCounts = Int16Array.from(scopedSetIds, setId => summarySets.get(setId) ?? 0)
const scopedBonusDenseTarget = scopedBonusPrepared.compileDensePanelScoreTarget({
    statIds: scopedStatIds,
    setIds: scopedSetIds,
    setIndexById: scopedSetIndexById,
})
assert.ok(scopedBonusDenseTarget, "Scoped Release anomaly bonuses should compile a dense target")
const scopedBonusDense = scopedBonusDenseTarget.scoreDense(scopedStatValues, scopedSetCounts)
const scopedBonusFixed = scopedBonusDenseTarget.compileForSetCounts(scopedSetCounts).scoreScalar(scopedStatValues)
for (const [label, result] of [
    ["compiled", scopedBonusCompiled],
    ["legacy", scopedBonusLegacy],
    ["dense", scopedBonusDense],
    ["fixed", scopedBonusFixed],
]) {
    approx(result.finalDamage, scopedBonusFull.damage.totalFinalDamage,
        `${label} Release score should preserve the shared anomaly-damage bonus zone`)
}

const externalPrepared = createInCombatPanelCalculator(catalog, releaseInput({ damage: externalReleaseDamage }))
const externalFullPrepared = externalPrepared.calculate(masteryDiscs, { round: false })
const externalCompiledPrepared = externalPrepared.scoreOnlyFromSummary(summaryStats, summarySets)
const externalMapPrepared = externalPrepared.scoreOnlyFromSummaryLegacy(summaryStats, summarySets)
approx(externalCompiledPrepared.finalDamage, externalFullPrepared.damage.totalFinalDamage, "compiled external-source release score")
approx(externalMapPrepared.finalDamage, externalFullPrepared.damage.totalFinalDamage, "map external-source release score")

const cinemaOnePrepared = createInCombatPanelCalculator(catalog, releaseInput({
    activeBuffIds: ["agent:aria.corePassive", "agent:aria.cinema.1"],
    input: {
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_212",
        driveDiscs: [],
    },
}))
const fractionalSummaryStats = new Map([["anomalyMastery", 30]])
const fractionalSummarySets = new Map([["astral_voice", 1]])
const cinemaOnePreparedFull = cinemaOnePrepared.calculate([coreFInitialMasteryDisc], { round: false })
const cinemaOneCompiled = cinemaOnePrepared.scoreOnlyFromSummary(fractionalSummaryStats, fractionalSummarySets)
const cinemaOneMap = cinemaOnePrepared.scoreOnlyFromSummaryLegacy(fractionalSummaryStats, fractionalSummarySets)
const cinemaOneIndexed = cinemaOnePrepared.scoreOnlyFromIndexedSummary(
    [30],
    ["anomalyMastery"],
    [1],
    ["astral_voice"],
    new Map([["astral_voice", 0]]),
)
for (const [label, result] of [
    ["compiled", cinemaOneCompiled],
    ["map", cinemaOneMap],
    ["indexed", cinemaOneIndexed],
]) {
    approx(result.finalDamage, cinemaOnePreparedFull.damage.totalFinalDamage,
        `Cinema 1 ${label} score should use displayed initial Anomaly Mastery`)
}
assert.ok(cinemaOnePrepared.optimizerStatMetadata().relevantStatIds.includes("anomalyMastery"),
    "Cinema 1 conversion must keep Anomaly Mastery relevant to optimization")

const cinemaOneDenseTarget = cinemaOnePrepared.compileDensePanelScoreTarget({
    statIds: ["anomalyMastery"],
    setIds: ["astral_voice"],
    setIndexById: new Map([["astral_voice", 0]]),
})
assert.ok(cinemaOneDenseTarget, "Cinema 1 should compile a dense Release target")
const cinemaOneDense = cinemaOneDenseTarget.scoreDense(
    Float64Array.of(30),
    Int16Array.of(1),
)
approx(cinemaOneDense.finalDamage, cinemaOnePreparedFull.damage.totalFinalDamage,
    "Cinema 1 dense score should equal the full calculation")
const cinemaOneFixedTarget = cinemaOneDenseTarget.compileForSetCounts(Int16Array.of(1))
const cinemaOneFixed = cinemaOneFixedTarget.scoreScalar(Float64Array.of(30))
approx(cinemaOneFixed.finalDamage, cinemaOnePreparedFull.damage.totalFinalDamage,
    "Cinema 1 fixed score should equal the full calculation")
assert.equal(typeof cinemaOneFixedTarget.scoreObjectiveScalar, "function")
approx(
    cinemaOneFixedTarget.scoreObjectiveScalar(Float64Array.of(30)).finalDamage,
    cinemaOnePreparedFull.damage.totalFinalDamage,
    "Cinema 1 fixed objective score should equal the full calculation",
)

const optimizerSets = ["astral_voice", "phaethons_melody", "freedom_blues"]
const mainBySlot = {
    1: { stat: "hpFlat", value: 2200, mode: "flat" },
    2: { stat: "atkFlat", value: 316, mode: "flat" },
    3: { stat: "defFlat", value: 184, mode: "flat" },
    4: { stat: "anomalyProficiency", value: 92, mode: "flat" },
    5: { stat: "etherDmg", value: 30, mode: "flat" },
    6: { stat: "anomalyMastery", value: 30, mode: "pct" },
}
const optimizerDiscs = optimizerSets.flatMap((setId, setIndex) => Array.from({ length: 6 }, (_, slotIndex) => {
    const slot = slotIndex + 1
    return disc(
        `opt-${setIndex + 1}-${slot}`,
        setId,
        slot,
        mainBySlot[slot],
        [{ stat: "atkPct", value: 3 + setIndex + slot / 10, mode: "pct" }],
    )
}))
const optimizerStore = { currentOwnerId: "default", driveDiscs: optimizerDiscs }
function optimizationInput(fourPieceSetIds) {
    return {
        ...releaseInput({
            activeBuffIds: [
                "agent:aria.corePassive",
                "agent:aria.additionalAbility",
                "agent:aria.cinema.1",
                "wEngine:zzz_wiki_1883.self",
            ],
        }),
        settings: {
            objective: "damage",
            algorithm: "exact-super-bound",
            fourPieceSetIds,
            twoPieceSetIds: ["freedom_blues"],
            mainStatLimits: agent.preferredDriveDiscs.mainStatLimits,
            minimums: {},
            disableParallel: true,
        },
    }
}
const astralOnly = optimizeDriveDiscs(catalog, optimizerStore, optimizationInput(["astral_voice"]))
const phaethonOnly = optimizeDriveDiscs(catalog, optimizerStore, optimizationInput(["phaethons_melody"]))
const expectedMerged = [...astralOnly.results, ...phaethonOnly.results]
    .sort((left, right) => Number(right.score) - Number(left.score)
        || left.driveDiscs.map(item => item.id).join("|").localeCompare(right.driveDiscs.map(item => item.id).join("|")))
    .slice(0, 10)
const dual = optimizeDriveDiscs(catalog, optimizerStore, optimizationInput(["astral_voice", "phaethons_melody"]))
assert.deepEqual(
    dual.results.map(item => ({ score: item.score, ids: item.driveDiscs.map(disc => disc.id), set: item.fourPieceSetId })),
    expectedMerged.map(item => ({ score: item.score, ids: item.driveDiscs.map(disc => disc.id), set: item.fourPieceSetId })),
    "dual-set Top 10 should exactly equal the merged single-set Top 10",
)
assert.equal(dual.results.length, 10)
assert.equal(dual.metrics.fourPieceSets.length, 2)
assert.equal(dual.metrics.estimatedCombinationCount,
    astralOnly.metrics.estimatedCombinationCount + phaethonOnly.metrics.estimatedCombinationCount)
const dualTopInput = optimizationInput(["astral_voice", "phaethons_melody"])
const dualTopFull = calculateInCombatPanel(catalog, {
    ...dualTopInput,
    combatBuffs: {
        ...dualTopInput.combatBuffs,
        activeBuffIds: [
            ...dualTopInput.combatBuffs.activeBuffIds,
            `driveDisc4pc:${dual.results[0].fourPieceSetId}.self`,
        ],
    },
    driveDiscs: dual.results[0].driveDiscs,
})
approx(dual.results[0].score, dualTopFull.damage.totalFinalDamage,
    "Cinema 1 strict optimizer score must equal the full calculation")

const externalOptimizationInput = {
    ...optimizationInput(["astral_voice"]),
    damage: {
        ...externalReleaseDamage,
        target: releaseInput().damage.target,
    },
}
const externalOptimized = optimizeDriveDiscs(catalog, optimizerStore, externalOptimizationInput)
assert.ok(externalOptimized.results.length > 0, "external frozen sources must remain optimizable")
const externalOptimizedFull = calculateInCombatPanel(catalog, {
    ...externalOptimizationInput,
    driveDiscs: externalOptimized.results[0].driveDiscs,
})
approx(externalOptimized.results[0].score, externalOptimizedFull.damage.totalFinalDamage,
    "external-source strict optimizer score must equal full calculation")

const dualWithEmptyBranch = optimizeDriveDiscs(catalog, optimizerStore, optimizationInput(["missing_set", "astral_voice"]))
assert.ok(dualWithEmptyBranch.results.length > 0)
assert.ok(dualWithEmptyBranch.results.every(item => item.fourPieceSetId === "astral_voice"))

const asyncDual = await optimizeDriveDiscsAsync(catalog, optimizerStore, optimizationInput(["astral_voice", "phaethons_melody"]), {
    progressIntervalMs: 0,
})
assert.deepEqual(
    asyncDual.results.map(item => ({ score: item.score, ids: item.driveDiscs.map(disc => disc.id), set: item.fourPieceSetId })),
    dual.results.map(item => ({ score: item.score, ids: item.driveDiscs.map(disc => disc.id), set: item.fourPieceSetId })),
)
assert.equal(asyncDual.metrics.percent, 100)

await assert.rejects(
    optimizeDriveDiscsAsync(catalog, optimizerStore, optimizationInput(["astral_voice", "phaethons_melody"]), {
        shouldCancel: () => true,
    }),
    error => error instanceof OptimizerCancelledError,
)

console.log("aria damage and dual-set optimizer tests passed")
