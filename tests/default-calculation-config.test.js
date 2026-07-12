import assert from "node:assert/strict"

import {
    defaultCalculationConfigEntries,
    resolveDefaultCalculationConfig,
} from "../core/defaultCalculationConfig.js"

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

console.log("default calculation config tests passed")
