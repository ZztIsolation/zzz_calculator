import assert from "node:assert/strict"
import {
    ANOMALY_SETTLEMENT_TYPES,
    hasLegacyEffectAppliesTo,
    normalizeLegacyEffectAppliesToInValue,
} from "../core/effectRuleTargets.js"

function clone(value) {
    return structuredClone(value)
}

assert.deepEqual(ANOMALY_SETTLEMENT_TYPES, ["attribute", "disorder", "release", "luminescence"])

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

const releaseTargetMigration = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "legacy-release-target",
        type: "fixed",
        stat: "critRate",
        mode: "flat",
        value: 10,
        target: {
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffects: ["corruption"],
            anomalyVariants: ["release"],
        },
    }, {
        id: "legacy-release-applies-to",
        type: "fixed",
        stat: "dmgBonus",
        mode: "flat",
        value: 20,
        appliesTo: {
            anomalyEffects: ["corruption"],
            anomalyVariants: ["release"],
        },
    }],
}))
assert.deepEqual(releaseTargetMigration.effects[0].target, {
    kind: "anomaly",
    settlementType: "release",
    anomalyEffects: ["corruption"],
})
assert.deepEqual(releaseTargetMigration.effects[1].target, {
    kind: "anomaly",
    settlementType: "release",
    anomalyEffects: ["corruption"],
})
assert.equal(releaseTargetMigration.effects[1].appliesTo, undefined)

const releaseWildcardMigration = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "legacy-release-wildcard",
        type: "fixed",
        stat: "dmgBonus",
        mode: "flat",
        value: 20,
        appliesTo: {
            anomalyVariants: ["release"],
        },
    }],
}))
assert.deepEqual(releaseWildcardMigration.effects[0].target, {
    kind: "anomaly",
    settlementType: "release",
})
assert.equal(releaseWildcardMigration.effects[0].appliesTo, undefined)

const luminescenceTargetNormalization = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "luminescence-wildcard",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        target: {
            kind: "anomaly",
            settlementType: "luminescence",
            anomalyEffects: [],
            anomalyVariants: [],
        },
    }, {
        id: "invalid-luminescence-specific-target",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        target: {
            kind: "anomaly",
            settlementType: "luminescence",
            anomalyEffects: ["corruption"],
            anomalyVariants: ["normal"],
        },
    }],
}))
assert.deepEqual(luminescenceTargetNormalization.effects[0].target, {
    kind: "anomaly",
    settlementType: "luminescence",
}, "Empty Luminescence filters should normalize to the settlement-wide target")
assert.deepEqual(luminescenceTargetNormalization.effects[1].target, {
    kind: "anomaly",
    settlementType: "luminescence",
    anomalyEffects: ["corruption"],
    anomalyVariants: ["normal"],
}, "Non-empty Luminescence filters must survive normalization so validation can reject them")

const anomalyDamageTargetNormalization = normalizeLegacyEffectAppliesToInValue(clone({
    effects: [{
        id: "broad-anomaly-damage-with-stale-filters",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        target: {
            kind: "default",
            settlementType: "attribute",
            anomalyEffects: ["assault"],
            anomalyVariants: ["normal"],
        },
    }, {
        id: "implicit-broad-anomaly-damage",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
    }, {
        id: "precise-anomaly-damage",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        target: {
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffects: ["assault"],
            anomalyVariants: ["normal"],
        },
    }, {
        id: "legacy-skill-anomaly-damage",
        type: "fixed",
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        target: {
            kind: "skill",
            skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
        },
    }],
}))
assert.deepEqual(anomalyDamageTargetNormalization.effects[0].target, { kind: "default" })
assert.deepEqual(anomalyDamageTargetNormalization.effects[1].target, { kind: "default" })
assert.deepEqual(anomalyDamageTargetNormalization.effects[2].target, {
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffects: ["assault"],
    anomalyVariants: ["normal"],
}, "Precise Anomaly Damage targets must not be widened during normalization")
assert.deepEqual(anomalyDamageTargetNormalization.effects[3].target, {
    kind: "skill",
    skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
}, "Legacy skill-targeted payloads must remain readable instead of being widened")

console.log("effect rule target migration tests passed")
