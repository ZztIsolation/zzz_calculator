import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const input = catalog.examples.yeShunguang.input

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

const formulaCatalog = cloneCatalog(catalog)
formulaCatalog.combatBuffs.push({
    id: "test.formula.dmg_bonus",
    sourceType: "teammate",
    scope: "inCombat",
    effects: [
        {
            id: "hp_to_dmg",
            type: "formula",
            stat: "dmgBonus",
            mode: "flat",
            source: {
                variable: "x",
                label: {
                    zhCN: "照的初始最大生命值",
                },
                defaultValue: 27000,
                min: 15000,
                max: 27000,
            },
            formula: {
                expression: "clamp(floor((x - 15000) / 400) + 10, 10, 40)",
                valueUnit: "storedPercent",
            },
        },
    ],
})

function calculateWithSourceValue(sourceValue) {
    return calculateInCombatPanel(formulaCatalog, {
        ...input,
        combatBuffs: {
            activeBuffIds: ["test.formula.dmg_bonus"],
            runtimeInputs: {
                "test.formula.dmg_bonus": {
                    effects: {
                        hp_to_dmg: {
                            sourceValue,
                        },
                    },
                },
            },
        },
    })
}

const cases = [
    [15000, 0.1],
    [15399, 0.1],
    [15400, 0.11],
    [27000, 0.4],
    [31000, 0.4],
]

for (const [sourceValue, expectedDmgBonus] of cases) {
    const result = calculateWithSourceValue(sourceValue)
    approx(
        result.inCombat.panel.dmgBonus - result.outOfCombat.panel.dmgBonus,
        expectedDmgBonus,
        `formula sourceValue=${sourceValue}`,
    )
}

const cappedResult = calculateWithSourceValue(31000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].rawSourceValue, 31000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].sourceValue, 27000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].value, 0.4)

const qianxia = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["buff_j8kf2r9m4q"],
        runtimeInputs: {
            buff_j8kf2r9m4q: {
                effects: {
                    effect_d4n8q2lm: {
                        sourceValue: 3000,
                    },
                },
            },
        },
    },
})
approx(
    qianxia.inCombat.panel.atk - qianxia.outOfCombat.panel.atk,
    900,
    "Existing derived ratio Buff should keep using sourceValue * ratio / 100",
)

console.log("formula tests passed")
