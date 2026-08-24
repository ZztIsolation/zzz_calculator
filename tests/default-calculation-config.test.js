import assert from "node:assert/strict"

import {
    defaultCalculationConfigEntries,
    resolveDefaultCalculationConfig,
} from "../core/defaultCalculationConfig.js"
import {
    materializePotentialVisionEffect,
    normalizePotentialLevel,
    potentialLevelRequirementMatches,
    potentialVisionScalingRow,
} from "../core/potentialVision.js"

const config = {
    mode: "custom",
    name: { zhCN: "自定义 0 影循环" },
    selectedEventId: "loop-0",
    events: [{ id: "loop-0", kind: "direct", count: 1 }],
    variants: [
        {
            cinemaLevel: 2,
            mode: "custom",
            selectedEventId: "loop-2",
            events: [{ id: "loop-2", kind: "direct", count: 2 }],
        },
        {
            cinemaLevel: 6,
            mode: "custom",
            name: { zhCN: "自定义 6 影循环" },
            selectedEventId: "loop-6",
            events: [{ id: "loop-6", kind: "direct", count: 6 }],
        },
    ],
}

assert.deepEqual(defaultCalculationConfigEntries(config).map(entry => entry.cinemaLevel), [0, 2, 6])

assert.equal(resolveDefaultCalculationConfig(config, 0).selectedEventId, "loop-0")
assert.equal(resolveDefaultCalculationConfig(config, 1).selectedEventId, "loop-0")
assert.equal(resolveDefaultCalculationConfig(config, 2).selectedEventId, "loop-2")
assert.equal(resolveDefaultCalculationConfig(config, 5).selectedEventId, "loop-2")
assert.equal(resolveDefaultCalculationConfig(config, 6).selectedEventId, "loop-6")

assert.equal(resolveDefaultCalculationConfig(config, 0).name.zhCN, "自定义 0 影循环")
assert.equal(resolveDefaultCalculationConfig(config, 2).name.zhCN, "默认循环（2影）")
assert.equal(resolveDefaultCalculationConfig(config, 6).name.zhCN, "自定义 6 影循环")
assert.equal(resolveDefaultCalculationConfig(null, 6), null)

const potentialConfig = {
    mode: "custom",
    selectedEventId: "p0-c0",
    events: [{ id: "p0-c0", kind: "direct", count: 1 }],
    variants: [{
        cinemaLevel: 2,
        selectedEventId: "p0-c2",
        events: [{ id: "p0-c2", kind: "direct", count: 2 }],
    }],
    potentialVariants: [{
        minPotentialLevel: 1,
        maxPotentialLevel: 6,
        mode: "custom",
        selectedEventId: "p1-c0",
        events: [{ id: "p1-c0", kind: "direct", count: 10 }],
        variants: [{
            cinemaLevel: 2,
            selectedEventId: "p1-c2",
            events: [{ id: "p1-c2", kind: "direct", count: 12 }],
        }],
    }],
}
assert.equal(resolveDefaultCalculationConfig(potentialConfig, 0, 0).selectedEventId, "p0-c0")
assert.equal(resolveDefaultCalculationConfig(potentialConfig, 2, 0).selectedEventId, "p0-c2")
assert.equal(resolveDefaultCalculationConfig(potentialConfig, 0, 1).selectedEventId, "p1-c0")
assert.equal(resolveDefaultCalculationConfig(potentialConfig, 2, 6).selectedEventId, "p1-c2")
assert.equal(resolveDefaultCalculationConfig(potentialConfig, 6, 7).selectedEventId, "p1-c2")

const potentialAgent = {
    id: "potential_agent",
    potentialVision: {
        defaultLevel: 6,
        maxLevel: 6,
        scaling: {
            levels: [
                { level: 0, critDmgPct: 0 },
                { level: 2, critDmgPct: 16 },
                { level: 6, critDmgPct: 48 },
            ],
        },
    },
}
assert.equal(normalizePotentialLevel(potentialAgent, undefined), 6)
assert.equal(normalizePotentialLevel(potentialAgent, -1), 0)
assert.equal(normalizePotentialLevel(potentialAgent, 9), 6)
assert.equal(normalizePotentialLevel({}, 6), 0)
assert.equal(potentialVisionScalingRow(potentialAgent, 4).critDmgPct, 16)
assert.equal(potentialLevelRequirementMatches({ requiresPotentialLevel: 1 }, 0), false)
assert.equal(potentialLevelRequirementMatches({ requiresPotentialLevel: 1 }, 1), true)
const potentialEffect = {
    effects: [{
        id: "potential-crit-dmg",
        stat: "critDmg",
        value: 0,
        valueSource: { kind: "potentialVisionScaling", field: "critDmgPct" },
    }],
}
assert.equal(materializePotentialVisionEffect(potentialEffect, potentialAgent, 2).effects[0].value, 16)
assert.equal(potentialEffect.effects[0].value, 0)

console.log("default calculation config tests passed")
