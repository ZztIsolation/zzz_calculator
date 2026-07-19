import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    disorderBaseMultiplier,
    disorderDurationSeconds,
    disorderElapsedStepSeconds,
    normalizeElapsedSeconds,
    resolveDamageEventMultiplier,
} from "../core/damageEventMultipliers.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input
const meta = buildMeta(catalog)
assert.ok(meta.anomalyEffects.some(effect => effect.id === "assault" && effect.baseMultiplier === 7.13), "Meta should expose data-backed anomaly effects")
assert.ok(meta.disorderEffects.some(effect => effect.id === "burn" && effect.tickMultiplier === 0.5), "Meta should expose data-backed disorder effects")
assert.ok(meta.disorderEffects.some(effect => effect.id === "frost_frozen" && effect.fixedMultiplier === 6 && effect.defaultDurationSeconds === 20), "Meta should expose Miyabi frost disorder effect")
const metaYouyeCinemaOne = meta.teammateCombatBuffGroups
    .find(group => group.id === "youye")
    ?.buffs?.find(buff => buff.id === "youye.cinema_1.amplify_additional_ability")
assert.equal(metaYouyeCinemaOne?.buffModifiers?.[0]?.factor, 1.3, "Meta should expose teammate Buff modifiers")

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function cloneCatalog(value) {
    const next = clone(value)
    delete next.agentsMap
    delete next.wEnginesMap
    delete next.driveDiscSetsMap
    return next
}

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

function calculateEvent(event, overrides = {}, sourceCatalog = catalog) {
    return calculateInCombatPanel(sourceCatalog, {
        agentId: exampleInput.agentId,
        coreSkillLevel: exampleInput.coreSkillLevel,
        wEngineId: exampleInput.wEngineId,
        driveDiscs: [],
        ...overrides,
        damage: {
            agentLevel: 60,
            selectedEventId: event.id,
            events: [event],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: {
                    physical: 0,
                    fire: 0,
                    ice: 0,
                    electric: 0,
                    ether: 0,
                },
            },
            ...(overrides.damage ?? {}),
        },
    })
}

for (const [effect, expectedMultiplier] of [
    ["assault", 7.13],
    ["shatter", 5],
    ["burn", 10],
    ["shock", 12.5],
    ["corruption", 12.5],
]) {
    const result = calculateEvent({
        id: effect,
        kind: "anomaly",
        anomalyEffect: effect,
    })
    approx(result.damage.multipliers.anomaly, expectedMultiplier, `${effect} default anomaly multiplier`)
}

const customCatalog = cloneCatalog(catalog)
customCatalog.anomalyEffects = customCatalog.anomalyEffects.map(effect => effect.id === "assault"
    ? { ...effect, baseMultiplier: 8 }
    : effect)
const customAssault = calculateEvent({
    id: "custom-assault",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {}, customCatalog)
approx(customAssault.damage.multipliers.anomaly, 8, "Anomaly multiplier should come from catalog data")

const burnSingleTick = calculateEvent({
    id: "burn-single",
    kind: "anomaly",
    anomalyEffect: "burn",
    procCount: 1,
})
approx(burnSingleTick.damage.multipliers.anomaly, 0.5, "Burn one proc multiplier")

for (const [effect, elapsedSeconds, durationSeconds, expectedMultiplier] of [
    ["burn", 0, 10, 14.5],
    ["burn", 0, 99, 14.5],
    ["burn", 3.2, 10, 11.5],
    ["burn", 10, 10, 4.5],
    ["burn", 20, 10, 4.5],
    ["shock", 0, 13, 17],
    ["shock", 4.5, 10, 10.75],
    ["corruption", 0, 10, 17],
    ["frozen", 0, 10, 5.25],
    ["frozen", 4.5, 10, 4.875],
    ["frost_frozen", 0, undefined, 21],
    ["frost_frozen", 0, 10, 21],
    ["frost_frozen", 3, 20, 18.75],
    ["frost_frozen", 4.5, 20, 17.25],
    ["flinch", 0, 10, 5.25],
    ["flinch", 4.5, 10, 4.875],
]) {
    const result = calculateEvent({
        id: `disorder-${effect}-${elapsedSeconds}`,
        kind: "disorder",
        previousAnomalyEffect: effect,
        elapsedSeconds,
        durationSeconds,
    })
    approx(result.damage.multipliers.anomaly, expectedMultiplier, `${effect} disorder multiplier`)
}

assert.equal(normalizeElapsedSeconds(3.2, 10), 3, "Elapsed seconds should round to the nearest half second")
assert.equal(normalizeElapsedSeconds(3.3, 10), 3.5, "Elapsed seconds should round upward past the half-step midpoint")
assert.equal(normalizeElapsedSeconds(20, 10), 10, "Elapsed seconds should clamp to the catalog duration")
assert.equal(normalizeElapsedSeconds(3.4, 10, 1), 3, "Whole-second Disorder should round down below the midpoint")
assert.equal(normalizeElapsedSeconds(3.5, 10, 1), 4, "Whole-second Disorder should round up at the midpoint")
assert.equal(normalizeElapsedSeconds(20, 10, 1), 10, "Whole-second Disorder should clamp to the catalog duration")
assert.equal(disorderDurationSeconds({ anomalyEffect: "burn" }, catalog), 10, "Disorder duration should resolve from the catalog")
for (const [effect, expectedStep] of [
    ["burn", 0.5],
    ["corruption", 0.5],
    ["shock", 1],
    ["frozen", 1],
    ["frost_frozen", 1],
    ["flinch", 1],
]) {
    assert.equal(disorderElapsedStepSeconds({ anomalyEffect: effect }, catalog), expectedStep, `${effect} elapsed step should resolve from the catalog`)
}
assert.equal(disorderElapsedStepSeconds({ anomalyEffect: "unknown" }, catalog), 0.5, "Unknown Disorder should retain the half-second compatibility fallback")
const frostBreakdown = disorderBaseMultiplier(meta.disorderEffects.find(effect => effect.id === "frost_frozen"), 4.5)
assert.deepEqual(
    {
        elapsed: frostBreakdown.elapsed,
        remaining: frostBreakdown.remaining,
        tickIntervalSeconds: frostBreakdown.tickIntervalSeconds,
        tickCount: frostBreakdown.tickCount,
        baseMultiplier: frostBreakdown.baseMultiplier,
    },
    { elapsed: 5, remaining: 15, tickIntervalSeconds: 1, tickCount: 15, baseMultiplier: 17.25 },
    "Frost Disorder should use whole-second normalization and keep the 1725% result",
)
approx(resolveDamageEventMultiplier({
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffect: "assault",
    procCount: 1,
    count: 99,
    damageRatioPct: 2.5,
}, catalog), 0.17825, "Displayed anomaly multiplier should include hidden event scale but exclude event count")
approx(resolveDamageEventMultiplier({
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: "burn",
    disorderType: "polarized",
    elapsedSeconds: 0.6,
    damageRatioPct: 50,
}, catalog), 1.75, "Displayed disorder multiplier should include half-second time, polarized scale, and hidden event scale")
approx(resolveDamageEventMultiplier({
    kind: "direct",
    skillMultiplier: 3300,
    damageRatioPct: 2.5,
    count: 6,
}, catalog), 0.825, "Displayed direct multiplier should include hidden event scale but exclude event count")

const ignoredDurationDisorder = calculateEvent({
    id: "ignored-duration",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 0,
    durationSeconds: 99,
})
assert.equal(ignoredDurationDisorder.damage.input.durationSeconds, 10, "Disorder duration should come from catalog defaults")
approx(ignoredDurationDisorder.damage.multipliers.anomaly, 14.5, "Disorder duration input should be ignored")

for (const [effect, elapsedSeconds] of [
    ["burn", 0],
    ["burn", 3.2],
    ["burn", 10],
    ["shock", 0],
    ["corruption", 0],
    ["frozen", 0],
    ["frost_frozen", 3],
    ["flinch", 0],
]) {
    const normal = calculateEvent({
        id: `normal-disorder-${effect}-${elapsedSeconds}`,
        kind: "disorder",
        disorderType: "normal",
        previousAnomalyEffect: effect,
        elapsedSeconds,
    })
    const polarized = calculateEvent({
        id: `polarized-disorder-${effect}-${elapsedSeconds}`,
        kind: "disorder",
        disorderType: "polarized",
        previousAnomalyEffect: effect,
        elapsedSeconds,
    })
    approx(polarized.damage.multipliers.anomaly, normal.damage.multipliers.anomaly / 4, `${effect} polarized disorder multiplier`)
    approx(polarized.damage.finalDamage, normal.damage.finalDamage / 4, `${effect} polarized disorder final damage`)
}

const unifiedDisorder = calculateEvent({
    id: "unified-disorder",
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: "burn",
    elapsedSeconds: 10,
})
assert.equal(unifiedDisorder.damage.events[0].kind, "anomaly")
assert.equal(unifiedDisorder.damage.events[0].settlementType, "disorder")
approx(unifiedDisorder.damage.multipliers.anomaly, 4.5, "Unified disorder event should resolve burn disorder")

const levelOne = calculateEvent({
    id: "level-one",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    damage: { agentLevel: 1 },
})
const levelSixty = calculateEvent({
    id: "level-sixty",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    damage: { agentLevel: 60 },
})
approx(levelOne.damage.multipliers.anomalyLevel, 1, "Level 1 anomaly level multiplier")
approx(levelSixty.damage.multipliers.anomalyLevel, 2, "Level 60 anomaly level multiplier")
approx(
    levelSixty.damage.finalDamage / levelOne.damage.finalDamage,
    2,
    "Level zone should scale anomaly damage from 1 to 2",
)

const modifierCatalog = cloneCatalog(catalog)
modifierCatalog.combatBuffs.push({
    id: "test.anomaly.modifiers",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "all_anomaly",
            type: "damageModifier",
            kind: "anomalyDamageBonus",
            value: 20,
        },
        {
            id: "shock_only",
            type: "damageModifier",
            kind: "anomalyDamageBonus",
            value: 30,
            appliesTo: {
                anomalyEffects: ["shock"],
            },
        },
        {
            id: "all_disorder",
            type: "damageModifier",
            kind: "disorderDamageBonus",
            value: 20,
        },
        {
            id: "disorder_base",
            type: "damageModifier",
            kind: "disorderBaseMultiplierBonus",
            value: 25,
            appliesTo: {
                damageKinds: ["disorder"],
            },
        },
        {
            id: "anomaly_crit_rate",
            type: "damageModifier",
            kind: "anomalyCritRate",
            value: 50,
        },
        {
            id: "anomaly_crit_dmg",
            type: "damageModifier",
            kind: "anomalyCritDmg",
            value: 100,
        },
    ],
})

const assaultWithModifiers = calculateEvent({
    id: "assault-mod",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: ["test.anomaly.modifiers"],
    },
}, modifierCatalog)
approx(assaultWithModifiers.damage.multipliers.attributeAnomalyDamage, 1.2, "Global attribute anomaly damage bonus")
approx(assaultWithModifiers.damage.multipliers.disorderDamage, 1, "Disorder damage bonus should not affect attribute anomaly")
approx(assaultWithModifiers.damage.multipliers.anomalyDamage, 1.2, "Anomaly damage alias should reflect the active attribute anomaly bonus")
approx(assaultWithModifiers.damage.multipliers.anomalyCrit, 1.5, "Anomaly crit multiplier")

const shockWithModifiers = calculateEvent({
    id: "shock-mod",
    kind: "anomaly",
    anomalyEffect: "shock",
}, {
    combatBuffs: {
        activeBuffIds: ["test.anomaly.modifiers"],
    },
}, modifierCatalog)
approx(shockWithModifiers.damage.multipliers.attributeAnomalyDamage, 1.5, "Shock-specific attribute anomaly damage bonus")

const manualEffectModifier = calculateEvent({
    id: "manual-effect",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_bonus",
                label: "手动属性异常增伤",
                effects: [
                    {
                        id: "manual_anomaly_bonus",
                        type: "damageModifier",
                        kind: "anomalyDamageBonus",
                        value: 40,
                        appliesTo: {
                            damageKinds: ["anomaly"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(manualEffectModifier.damage.multipliers.attributeAnomalyDamage, 1.4, "Manual attribute anomaly damageModifier effects should apply")

const anomalyOnlyModifier = calculateEvent({
    id: "manual-anomaly-only",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_damage_bonus",
                label: "属性异常增伤",
                effects: [
                    {
                        id: "manual_anomaly_damage_bonus",
                        type: "damageModifier",
                        kind: "anomalyDamageBonus",
                        value: 0.15,
                        appliesTo: {
                            damageKinds: ["anomaly"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(anomalyOnlyModifier.damage.multipliers.attributeAnomalyDamage, 1.15, "Attribute anomaly damage bonus should apply to attribute anomaly damage")

const disorderWithModifiers = calculateEvent({
    id: "disorder-mod",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: ["test.anomaly.modifiers"],
    },
}, modifierCatalog)
approx(disorderWithModifiers.damage.multipliers.baseMultiplierBonus, 0.25, "Disorder base multiplier bonus")
approx(disorderWithModifiers.damage.multipliers.disorderBaseMultiplierBonus, 0.25, "Disorder-specific base multiplier bonus alias")
approx(disorderWithModifiers.damage.multipliers.anomaly, 4.75, "Disorder base multiplier should include bonus")
approx(disorderWithModifiers.damage.multipliers.attributeAnomalyDamage, 1, "Attribute anomaly bonus should not affect disorder")
approx(disorderWithModifiers.damage.multipliers.disorderDamage, 1.2, "Disorder damage bonus should affect disorder")
approx(disorderWithModifiers.damage.multipliers.anomalyDamage, 1.2, "Anomaly damage alias should reflect the active disorder bonus")
approx(disorderWithModifiers.damage.multipliers.anomalyCrit, 1, "Anomaly crit should not affect disorder")
approx(disorderWithModifiers.damage.multipliers.anomalyCritRate, 0, "Anomaly crit rate should be suppressed for disorder")
approx(disorderWithModifiers.damage.multipliers.anomalyCritDmg, 0, "Anomaly crit damage should be suppressed for disorder")

const polarizedDisorderWithModifiers = calculateEvent({
    id: "polarized-disorder-mod",
    kind: "disorder",
    disorderType: "polarized",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: ["test.anomaly.modifiers"],
    },
}, modifierCatalog)
approx(polarizedDisorderWithModifiers.damage.multipliers.anomaly, disorderWithModifiers.damage.multipliers.anomaly / 4, "Polarized disorder should scale modified disorder multiplier")
approx(polarizedDisorderWithModifiers.damage.finalDamage, disorderWithModifiers.damage.finalDamage / 4, "Polarized disorder should scale modified final damage")

const disorderWithAnomalyOnlyModifier = calculateEvent({
    id: "disorder-anomaly-only",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_damage_bonus",
                label: "属性异常增伤",
                effects: [
                    {
                        id: "manual_anomaly_damage_bonus",
                        type: "damageModifier",
                        kind: "anomalyDamageBonus",
                        value: 0.15,
                        appliesTo: {
                            damageKinds: ["anomaly"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(disorderWithAnomalyOnlyModifier.damage.multipliers.attributeAnomalyDamage, 1, "Attribute anomaly bonus should not apply to disorder")
approx(disorderWithAnomalyOnlyModifier.damage.multipliers.disorderDamage, 1, "Disorder should stay unbuffed without disorder damage bonus")
approx(disorderWithAnomalyOnlyModifier.damage.multipliers.anomalyDamage, 1, "Anomaly damage alias should stay neutral for unbuffed disorder")

const disorderOnlyModifier = calculateEvent({
    id: "manual-disorder-only",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_disorder_damage_bonus",
                label: "紊乱增伤",
                effects: [
                    {
                        id: "manual_disorder_damage_bonus",
                        type: "damageModifier",
                        kind: "disorderDamageBonus",
                        value: 0.15,
                        appliesTo: {
                            damageKinds: ["disorder"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(disorderOnlyModifier.damage.multipliers.disorderDamage, 1.15, "Disorder damage bonus should apply to disorder")
approx(disorderOnlyModifier.damage.multipliers.attributeAnomalyDamage, 1, "Disorder damage bonus should not affect attribute anomaly bonus bucket")

const anomalyBaseMultiplierOnlyModifier = calculateEvent({
    id: "disorder-base-anomaly-only",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_base_multiplier_bonus",
                label: "异常倍率加算",
                effects: [
                    {
                        id: "manual_anomaly_base_multiplier_bonus",
                        type: "damageModifier",
                        kind: "baseMultiplierBonus",
                        value: 0.25,
                        appliesTo: {
                            damageKinds: ["disorder"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(anomalyBaseMultiplierOnlyModifier.damage.multipliers.baseMultiplierBonus, 0, "Attribute anomaly base multiplier bonus should not affect disorder")
approx(anomalyBaseMultiplierOnlyModifier.damage.multipliers.anomaly, 4.5, "Disorder should ignore baseMultiplierBonus")

const disorderBaseMultiplierOnlyModifier = calculateEvent({
    id: "disorder-base-only",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_disorder_base_multiplier_bonus",
                label: "紊乱倍率加算",
                effects: [
                    {
                        id: "manual_disorder_base_multiplier_bonus",
                        type: "damageModifier",
                        kind: "disorderBaseMultiplierBonus",
                        value: 0.25,
                        appliesTo: {
                            damageKinds: ["disorder"],
                        },
                    },
                ],
            },
        ],
    },
})
approx(disorderBaseMultiplierOnlyModifier.damage.multipliers.baseMultiplierBonus, 0.25, "Disorder base multiplier bonus should be exposed in base multiplier bucket")
approx(disorderBaseMultiplierOnlyModifier.damage.multipliers.disorderBaseMultiplierBonus, 0.25, "Disorder base multiplier bonus should expose a disorder-specific bucket")
approx(disorderBaseMultiplierOnlyModifier.damage.multipliers.anomaly, 4.75, "Disorder base multiplier bonus should add to disorder multiplier")

const youyeAdditionalBuffId = "youye.additional_ability.anomaly_damage_bonus"
const youyeCinemaOneBuffId = "youye.cinema_1.amplify_additional_ability"
const youyeCinemaSixBuffId = "youye.cinema_6.disorder_multiplier_bonus"
const youyeAdditionalEffectId = "youye_additional_anomaly_damage_bonus"
const youyeAdditionalDisorderEffectId = "youye_additional_disorder_damage_bonus"

const youyeAdditionalOnly = calculateEvent({
    id: "youye-additional",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId],
    },
})
approx(youyeAdditionalOnly.damage.multipliers.attributeAnomalyDamage, 1.2, "Youye additional ability should grant 20% attribute anomaly damage at 200 AM")
approx(youyeAdditionalOnly.damage.multipliers.disorderDamage, 1, "Youye disorder bonus should not affect attribute anomaly events")

const youyeAdditionalWithCinema = calculateEvent({
    id: "youye-additional-cinema",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
    },
})
approx(youyeAdditionalWithCinema.damage.multipliers.attributeAnomalyDamage, 1.26, "Youye cinema 1 should multiply the attribute anomaly additional ability by 130%")

const youyeCinemaOnly = calculateEvent({
    id: "youye-cinema-only",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeCinemaOneBuffId],
    },
})
approx(youyeCinemaOnly.damage.multipliers.attributeAnomalyDamage, 1, "Youye cinema 1 alone should not grant attribute anomaly damage")

const youyeAdditionalAt150 = calculateEvent({
    id: "youye-additional-150",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId],
        runtimeInputs: {
            [youyeAdditionalBuffId]: {
                effects: {
                    [youyeAdditionalEffectId]: {
                        sourceValue: 150,
                    },
                },
            },
        },
    },
})
approx(youyeAdditionalAt150.damage.multipliers.attributeAnomalyDamage, 1.1, "Youye additional ability should grant 10% attribute anomaly damage at 150 AM")

const youyeAdditionalAt150WithCinema = calculateEvent({
    id: "youye-additional-150-cinema",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
        runtimeInputs: {
            [youyeAdditionalBuffId]: {
                effects: {
                    [youyeAdditionalEffectId]: {
                        sourceValue: 150,
                    },
                },
            },
        },
    },
})
approx(youyeAdditionalAt150WithCinema.damage.multipliers.attributeAnomalyDamage, 1.13, "Youye cinema 1 should multiply the 150 AM attribute anomaly additional ability value")

const youyeDisorderWithCinema = calculateEvent({
    id: "youye-disorder-cinema",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
    },
})
approx(youyeDisorderWithCinema.damage.multipliers.attributeAnomalyDamage, 1, "Youye attribute anomaly bonus should not affect disorder")
approx(youyeDisorderWithCinema.damage.multipliers.disorderDamage, 1.26, "Youye amplified disorder bonus should apply to disorder")
approx(youyeDisorderWithCinema.damage.multipliers.anomalyDamage, 1.26, "Anomaly damage alias should reflect Youye's active disorder bonus")

const youyeDisorderAt150WithCinema = calculateEvent({
    id: "youye-disorder-150-cinema",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
        runtimeInputs: {
            [youyeAdditionalBuffId]: {
                effects: {
                    [youyeAdditionalEffectId]: {
                        sourceValue: 150,
                    },
                    [youyeAdditionalDisorderEffectId]: {
                        sourceValue: 150,
                    },
                },
            },
        },
    },
})
approx(youyeDisorderAt150WithCinema.damage.multipliers.disorderDamage, 1.13, "Youye cinema 1 should multiply the 150 AM disorder additional ability value")

const youyeCinemaSixDisorder = calculateEvent({
    id: "youye-cinema-6-disorder",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: [youyeCinemaSixBuffId],
    },
})
approx(youyeCinemaSixDisorder.damage.multipliers.disorderBaseMultiplierBonus, 3.15, "Youye cinema 6 should add 315% disorder multiplier at 3 stacks")
approx(youyeCinemaSixDisorder.damage.multipliers.disorderDamage, 1, "Youye cinema 6 should not enter the disorder damage bonus bucket")
approx(youyeCinemaSixDisorder.damage.multipliers.anomaly, 7.65, "Youye cinema 6 should add directly to disorder multiplier")

const youyeCinemaSixOneStackDisorder = calculateEvent({
    id: "youye-cinema-6-disorder-one-stack",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 10,
}, {
    combatBuffs: {
        activeBuffIds: [youyeCinemaSixBuffId],
        runtimeInputs: {
            [youyeCinemaSixBuffId]: {
                effects: {
                    youye_cinema_6_disorder_damage_bonus: {
                        stacks: 1,
                    },
                },
            },
        },
    },
})
approx(youyeCinemaSixOneStackDisorder.damage.multipliers.disorderBaseMultiplierBonus, 1.05, "Youye cinema 6 should add 105% disorder multiplier per stack")
approx(youyeCinemaSixOneStackDisorder.damage.multipliers.anomaly, 5.55, "Youye cinema 6 one stack should add directly to disorder multiplier")

const youyeCinemaSixAnomaly = calculateEvent({
    id: "youye-cinema-6-anomaly",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeCinemaSixBuffId],
    },
})
approx(youyeCinemaSixAnomaly.damage.multipliers.baseMultiplierBonus, 0, "Youye cinema 6 should not affect attribute anomaly multiplier")
approx(youyeCinemaSixAnomaly.damage.multipliers.anomaly, 7.13, "Youye cinema 6 should only affect disorder events")

const reversedYouyeCatalog = cloneCatalog(catalog)
reversedYouyeCatalog.combatBuffs = [...reversedYouyeCatalog.combatBuffs].sort((left, right) => {
    if (left.id === youyeCinemaOneBuffId && right.id === youyeAdditionalBuffId) {
        return -1
    }
    if (left.id === youyeAdditionalBuffId && right.id === youyeCinemaOneBuffId) {
        return 1
    }
    return 0
})
const youyeReversedOrder = calculateEvent({
    id: "youye-reversed-order",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
    },
}, reversedYouyeCatalog)
approx(youyeReversedOrder.damage.multipliers.attributeAnomalyDamage, 1.26, "Buff modifier result should not depend on catalog order")

const directWithoutModifiers = calculateEvent({
    id: "direct",
    kind: "direct",
    skillMultiplier: 100,
}, {}, modifierCatalog)
const directWithModifiers = calculateEvent({
    id: "direct",
    kind: "direct",
    skillMultiplier: 100,
}, {
    combatBuffs: {
        activeBuffIds: ["test.anomaly.modifiers"],
    },
}, modifierCatalog)
approx(directWithModifiers.damage.finalDamage, directWithoutModifiers.damage.finalDamage, "Anomaly modifiers should not affect direct damage")

const janeCoreBuffId = "jane_doe.core_insight"
const janeCinemaTwoBuffId = "jane_doe.cinema_2_assault_crit"
const janeCinemaFourBuffId = "jane_doe.cinema_4_anomaly_damage"
const janeCoreCritRateEffectId = "jane_doe_core_assault_crit_rate"

const flinchWithoutJane = calculateEvent({
    id: "flinch-without-jane",
    kind: "disorder",
    previousAnomalyEffect: "flinch",
    elapsedSeconds: 0,
})
approx(flinchWithoutJane.damage.multipliers.anomaly, 5.25, "Flinch Disorder should retain its 525% base multiplier")

for (const [elapsedSeconds, expectedMultiplier] of [[0, 5.625], [0.5, 5.55], [12, 4.725]]) {
    const result = calculateEvent({
        id: `flinch-jane-${elapsedSeconds}`,
        kind: "disorder",
        previousAnomalyEffect: "flinch",
        elapsedSeconds,
    }, {
        combatBuffs: { activeBuffIds: [janeCoreBuffId] },
    })
    approx(result.damage.multipliers.anomaly, expectedMultiplier, `Jane core Flinch Disorder at ${elapsedSeconds}s`)
    assert.equal(result.damage.multipliers.baseDurationSeconds, 10, "Jane core should retain the catalog base duration")
    assert.equal(result.damage.multipliers.durationBonusSeconds, 5, "Jane core should add five raw seconds")
    assert.equal(result.damage.multipliers.durationSeconds, 15, "Jane core should extend the effective duration to fifteen seconds")
}

const burnWithJane = calculateEvent({
    id: "burn-with-jane",
    kind: "disorder",
    previousAnomalyEffect: "burn",
    elapsedSeconds: 0,
}, {
    combatBuffs: { activeBuffIds: [janeCoreBuffId] },
})
approx(burnWithJane.damage.multipliers.anomaly, 14.5, "Jane core duration should not affect Burn Disorder")
assert.equal(burnWithJane.damage.multipliers.durationBonusSeconds, 0, "Jane core duration target should only match Flinch Disorder")

const assaultWithJaneCore = calculateEvent({
    id: "assault-with-jane-core",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: { activeBuffIds: [janeCoreBuffId] },
})
approx(assaultWithJaneCore.damage.multipliers.anomaly, 7.13, "Jane core should not change the Assault base multiplier")
approx(assaultWithJaneCore.damage.multipliers.anomalyCritRate, 1, "Jane core should reach 100% anomaly crit rate at 375 AP")
approx(assaultWithJaneCore.damage.multipliers.anomalyCritDmg, 0.5, "Jane core should grant 50% anomaly crit damage")
approx(assaultWithJaneCore.damage.multipliers.anomalyCrit, 1.5, "Jane core default anomaly crit multiplier")

const assaultWithJaneAt200 = calculateEvent({
    id: "assault-with-jane-at-200",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [janeCoreBuffId],
        runtimeInputs: {
            [janeCoreBuffId]: {
                effects: {
                    [janeCoreCritRateEffectId]: { sourceValue: 200 },
                },
            },
        },
    },
})
approx(assaultWithJaneAt200.damage.multipliers.anomalyCritRate, 0.72, "Jane core anomaly crit formula should use the runtime AP input")
approx(assaultWithJaneAt200.damage.multipliers.anomalyCrit, 1.36, "Jane core 200 AP expected anomaly crit multiplier")

const shockWithJaneCore = calculateEvent({
    id: "shock-with-jane-core",
    kind: "anomaly",
    anomalyEffect: "shock",
}, {
    combatBuffs: { activeBuffIds: [janeCoreBuffId] },
})
approx(shockWithJaneCore.damage.multipliers.anomalyCrit, 1, "Jane core anomaly crit should only affect Assault")

const assaultWithJaneCinemaTwo = calculateEvent({
    id: "assault-with-jane-cinema-two",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: { activeBuffIds: [janeCoreBuffId, janeCinemaTwoBuffId] },
})
approx(assaultWithJaneCinemaTwo.damage.multipliers.anomalyCritRate, 1, "Jane core plus cinema 2 should retain 100% anomaly crit rate")
approx(assaultWithJaneCinemaTwo.damage.multipliers.anomalyCritDmg, 1, "Jane core plus cinema 2 should reach 100% anomaly crit damage")
approx(assaultWithJaneCinemaTwo.damage.multipliers.anomalyCrit, 2, "Jane core plus cinema 2 anomaly crit multiplier")
approx(assaultWithJaneCinemaTwo.damage.targetBreakdown.enemyDefReduction, 0.15, "Jane cinema 2 should ignore 15% defense for Assault")

const shockWithJaneCinemaTwo = calculateEvent({
    id: "shock-with-jane-cinema-two",
    kind: "anomaly",
    anomalyEffect: "shock",
}, {
    combatBuffs: { activeBuffIds: [janeCinemaTwoBuffId] },
})
approx(shockWithJaneCinemaTwo.damage.targetBreakdown.enemyDefReduction, 0, "Jane cinema 2 defense ignore should not affect other anomalies")
approx(shockWithJaneCinemaTwo.damage.multipliers.anomalyCritDmg, 0, "Jane cinema 2 crit damage should not affect other anomalies")

const assaultWithJaneCinemaFour = calculateEvent({
    id: "assault-with-jane-cinema-four",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: { activeBuffIds: [janeCinemaFourBuffId] },
})
approx(assaultWithJaneCinemaFour.damage.multipliers.attributeAnomalyDamage, 1.18, "Jane cinema 4 should enter the attribute anomaly damage bucket")
approx(assaultWithJaneCinemaFour.damage.multipliers.disorderDamage, 1, "Jane cinema 4 should not enter the Disorder bucket")

const flinchWithJaneCinemaFour = calculateEvent({
    id: "flinch-with-jane-cinema-four",
    kind: "disorder",
    previousAnomalyEffect: "flinch",
    elapsedSeconds: 0,
}, {
    combatBuffs: { activeBuffIds: [janeCinemaFourBuffId] },
})
approx(flinchWithJaneCinemaFour.damage.multipliers.attributeAnomalyDamage, 1, "Jane cinema 4 attribute anomaly bonus should not affect Disorder")
approx(flinchWithJaneCinemaFour.damage.multipliers.disorderDamage, 1, "Jane cinema 4 should leave the Disorder damage bucket neutral")

console.log("anomaly damage tests passed")
