import assert from "node:assert/strict"
import {
    hasLegacyEffectAppliesTo,
    normalizeLegacyEffectAppliesToInValue,
} from "../core/effectRuleTargets.js"

function clone(value) {
    return structuredClone(value)
}

const migrated = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [
        {
            id: "multi-dmg",
            type: "fixed",
            stat: "dmgBonus",
            mode: "flat",
            value: 20,
            appliesTo: { elements: ["physical", "fire"] },
        },
        {
            id: "element-crit",
            type: "stacked",
            stat: "critDmg",
            mode: "flat",
            valuePerStack: 2,
            maxStacks: 3,
            defaultStacks: 3,
            appliesTo: { elements: ["ice", "fire"] },
        },
        {
            id: "electric-ignore",
            type: "formula",
            stat: "enemyDefIgnore",
            mode: "flat",
            appliesTo: { elements: ["electric"] },
            source: { variable: "x", defaultValue: 1 },
            formula: { expression: "x", valueUnit: "storedPercent" },
        },
        {
            id: "redundant-element",
            type: "fixed",
            stat: "electricResIgnore",
            mode: "flat",
            value: 5,
            appliesTo: { elements: ["electric"] },
        },
    ],
    buffModifiers: [{
        id: "modifier",
        operation: "multiplyResolvedValue",
        factor: 2,
        targetBuffIds: [],
        targetEffectIds: ["element-crit"],
    }],
}))

assert.deepEqual(
    migrated.effects.slice(0, 2).map(rule => rule.stat),
    ["physicalDmg", "fireDmg"],
    "Generic element-filtered damage should split into explicit element damage stats",
)
const critRules = migrated.effects.filter(rule => rule.stat.endsWith("CritDmg"))
assert.deepEqual(critRules.map(rule => rule.stat), ["iceCritDmg", "fireCritDmg"])
assert.equal(critRules[0].stackGroup, critRules[1].stackGroup, "Split stacked rules should share stack state")
assert.deepEqual(
    migrated.buffModifiers[0].targetEffectIds,
    critRules.map(rule => rule.id),
    "Buff modifier references should expand to every split rule",
)
assert.equal(migrated.effects.find(rule => rule.id === "electric-ignore")?.stat, "electricDefIgnore")
assert.equal(migrated.effects.find(rule => rule.id === "redundant-element")?.appliesTo, undefined)
assert.equal(hasLegacyEffectAppliesTo(migrated), false)

const skillTargetMigration = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "legacy-skill",
        type: "damageModifier",
        kind: "directDamageBonus",
        value: 0.2,
        valueUnit: "decimal",
        appliesTo: {
            skillTargets: [{
                kind: "skillType",
                skillType: "ultimate",
            }],
        },
    }],
}))
assert.deepEqual(skillTargetMigration.effects[0], {
    id: "legacy-skill",
    type: "fixed",
    stat: "dmgBonus",
    value: 20,
    mode: "flat",
    target: {
        kind: "skill",
        skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
    },
})

const unsupported = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "legacy-anomaly-filter",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        appliesTo: { anomalyEffects: ["burn"] },
    }],
}))
assert.equal(hasLegacyEffectAppliesTo(unsupported), true, "Unsupported legacy filters must remain visible to validation")

console.log("effect rule target migration tests passed")
