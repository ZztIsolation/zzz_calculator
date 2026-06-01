import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input
const meta = buildMeta(catalog)
assert.ok(meta.anomalyEffects.some(effect => effect.id === "assault" && effect.baseMultiplier === 7.13), "Meta should expose data-backed anomaly effects")
assert.ok(meta.disorderEffects.some(effect => effect.id === "burn" && effect.tickMultiplier === 0.5), "Meta should expose data-backed disorder effects")
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
    ["burn", 3.2, 10, 11],
    ["burn", 10, 10, 4.5],
    ["burn", 20, 10, 4.5],
    ["shock", 0, 13, 20.75],
    ["corruption", 0, 10, 17],
    ["frozen", 0, 10, 5.25],
    ["flinch", 0, 10, 5.25],
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
            id: "disorder_base",
            type: "damageModifier",
            kind: "baseMultiplierBonus",
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
approx(assaultWithModifiers.damage.multipliers.anomalyDamage, 1.2, "Global anomaly damage bonus")
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
approx(shockWithModifiers.damage.multipliers.anomalyDamage, 1.5, "Shock-specific anomaly damage bonus")

const manualEffectModifier = calculateEvent({
    id: "manual-effect",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_bonus",
                label: "手动异常增伤",
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
approx(manualEffectModifier.damage.multipliers.anomalyDamage, 1.4, "Manual damageModifier effects should apply")

const anomalyOnlyModifier = calculateEvent({
    id: "manual-anomaly-only",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_anomaly_damage_bonus",
                label: "异常伤害增伤",
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
approx(anomalyOnlyModifier.damage.multipliers.anomalyDamage, 1.15, "Anomaly-only damage bonus should apply to anomaly damage")

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
approx(disorderWithModifiers.damage.multipliers.anomaly, 4.75, "Disorder base multiplier should include bonus")

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
                label: "异常伤害增伤",
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
approx(disorderWithAnomalyOnlyModifier.damage.multipliers.anomalyDamage, 1, "Anomaly-only damage bonus should not apply to disorder")

const youyeAdditionalBuffId = "youye.additional_ability.anomaly_damage_bonus"
const youyeCinemaOneBuffId = "youye.cinema_1.amplify_additional_ability"
const youyeAdditionalEffectId = "youye_additional_anomaly_damage_bonus"

const youyeAdditionalOnly = calculateEvent({
    id: "youye-additional",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId],
    },
})
approx(youyeAdditionalOnly.damage.multipliers.anomalyDamage, 1.2, "Youye additional ability should grant 20% anomaly damage at 200 AM")

const youyeAdditionalWithCinema = calculateEvent({
    id: "youye-additional-cinema",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeAdditionalBuffId, youyeCinemaOneBuffId],
    },
})
approx(youyeAdditionalWithCinema.damage.multipliers.anomalyDamage, 1.26, "Youye cinema 1 should multiply the additional ability by 130%")

const youyeCinemaOnly = calculateEvent({
    id: "youye-cinema-only",
    kind: "anomaly",
    anomalyEffect: "assault",
}, {
    combatBuffs: {
        activeBuffIds: [youyeCinemaOneBuffId],
    },
})
approx(youyeCinemaOnly.damage.multipliers.anomalyDamage, 1, "Youye cinema 1 alone should not grant anomaly damage")

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
approx(youyeAdditionalAt150.damage.multipliers.anomalyDamage, 1.1, "Youye additional ability should grant 10% anomaly damage at 150 AM")

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
approx(youyeAdditionalAt150WithCinema.damage.multipliers.anomalyDamage, 1.13, "Youye cinema 1 should multiply the 150 AM additional ability value")

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
approx(youyeDisorderWithCinema.damage.multipliers.anomalyDamage, 1.26, "Youye amplified additional ability should also apply to disorder")

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
approx(youyeReversedOrder.damage.multipliers.anomalyDamage, 1.26, "Buff modifier result should not depend on catalog order")

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

console.log("anomaly damage tests passed")
