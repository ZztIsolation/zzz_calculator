import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { defaultRuntimeForBuff, runtimeSourceGroups } from "../core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const c6BuffId = "agent:velina.cinema.6"
const c6RuleId = "velina-c6-wind-corrosion-recast-damage"

function event(overrides = {}) {
    return {
        id: "velina-c6-event",
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "wind_corrosion",
        count: 1,
        stunned: false,
        ...overrides,
    }
}

function calculate({ value, activeBuffIds = [c6BuffId], damageEvent = event(), runtimeInputs = {} } = {}) {
    const runtime = value === undefined
        ? runtimeInputs
        : {
            ...runtimeInputs,
            [c6BuffId]: {
                effects: {
                    [c6RuleId]: { sourceValue: value },
                },
            },
        }
    return calculateInCombatPanel(catalog, {
        agentId: "velina",
        coreSkillLevel: "F",
        wEngineId: catalog.wEngines[0].id,
        driveDiscs: [],
        combatBuffs: { activeBuffIds, runtimeInputs: runtime },
        damage: {
            events: [damageEvent],
            selectedEventId: damageEvent.id,
            target: {
                defense: 0,
                resistanceByElement: {
                    physical: 0,
                    fire: 0,
                    ice: 0,
                    electric: 0,
                    ether: 0,
                    wind: 0,
                },
            },
        },
    })
}

const c6 = catalog.agentsMap.get("velina")?.combatBuffs?.cinemaBuffs?.find(buff => buff.cinemaLevel === 6)
const c6Rule = c6?.effects?.find(rule => rule.id === c6RuleId)
assert.equal(c6Rule?.type, "formula")
assert.equal(c6Rule?.stat, "anomalyDamageBonus")
assert.deepEqual(c6Rule?.target, {
    kind: "anomaly",
    settlementType: "attribute",
    anomalyEffects: ["wind_corrosion"],
})
assert.deepEqual(c6Rule?.source, {
    variable: "x",
    defaultValue: 40,
    min: 0,
    max: 40,
    step: 1,
    label: { zhCN: "风化增伤" },
})
assert.deepEqual(runtimeSourceGroups(c6), [{
    key: JSON.stringify(["风化增伤", 40, 0, 40, 1, false]),
    label: "风化增伤",
    defaultValue: 40,
    min: 0,
    max: 40,
    step: 1,
    integer: false,
    ruleIds: [c6RuleId],
    rules: [c6Rule],
}])
assert.equal(defaultRuntimeForBuff(c6).effects[c6RuleId].sourceValue, 40)

const baseline = calculate({ activeBuffIds: [] })
const zero = calculate({ value: 0 })
const quarter = calculate({ value: 25 })
const defaultValue = calculate()
const capped = calculate({ value: 60 })
const negative = calculate({ value: -10 })

assert.equal(zero.damage.events[0].multipliers.anomalyDamage, 1)
assert.equal(quarter.damage.events[0].multipliers.anomalyDamage, 1.25)
assert.equal(defaultValue.damage.events[0].multipliers.anomalyDamage, 1.4)
assert.equal(capped.damage.events[0].multipliers.anomalyDamage, 1.4)
assert.equal(negative.damage.events[0].multipliers.anomalyDamage, 1)
assert.equal(zero.damage.events[0].finalDamage, baseline.damage.events[0].finalDamage)
assert.equal(defaultValue.damage.events[0].finalDamage / baseline.damage.events[0].finalDamage, 1.4)

const combined = calculate({
    value: 40,
    activeBuffIds: ["agent:velina.cinema.2", c6BuffId],
})
assert.equal(combined.damage.events[0].multipliers.anomalyDamage, 1.55)

const kernelInput = {
    agentId: "velina",
    coreSkillLevel: "F",
    wEngineId: catalog.wEngines[0].id,
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: [c6BuffId],
        runtimeInputs: {
            [c6BuffId]: {
                effects: {
                    [c6RuleId]: { sourceValue: 40 },
                },
            },
        },
    },
    damage: {
        events: [event()],
        selectedEventId: "velina-c6-event",
        target: {
            defense: 0,
            resistanceByElement: { physical: 0, fire: 0, ice: 0, electric: 0, ether: 0, wind: 0 },
        },
    },
}
const calculator = createInCombatPanelCalculator(catalog, kernelInput)
const compiled = calculator.scoreOnlyFromSummary(new Map(), new Map())
const legacy = calculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
const dense = calculator.compileDensePanelScoreTarget({
    statIds: [],
    setIds: [],
    setIndexById: new Map(),
})
const denseScore = dense.scoreDense(new Float64Array(), new Int16Array())
const fixedScore = dense.compileForSetCounts(new Int16Array()).scoreScalar(new Float64Array())
assert.ok(Math.abs(compiled.finalDamage - legacy.finalDamage) < 1e-8)
assert.ok(Math.abs(denseScore.finalDamage - legacy.finalDamage) < 1e-8)
assert.ok(Math.abs(fixedScore.finalDamage - legacy.finalDamage) < 1e-8)
assert.equal(
    defaultValue.damage.events[0].whiteBoxRows.find(row => row.label === "属性异常增伤区")?.formula,
    "1 + 属性异常增伤 40%",
)

const physical = calculate({
    value: 40,
    damageEvent: event({
        id: "assault",
        anomalyEffect: "assault",
        damageElement: "physical",
    }),
})
assert.equal(physical.damage.events[0].multipliers.anomalyDamage, 1)

const direct = calculate({
    value: 40,
    damageEvent: {
        id: "direct",
        kind: "direct",
        skillMultiplier: 1,
        stunned: false,
    },
})
assert.equal(direct.damage.events[0].multipliers.dmg, 1)

const release = calculate({
    value: 40,
    damageEvent: event({
        id: "release",
        settlementType: "release",
        releaseSource: "broad_vortex",
    }),
})
assert.equal(release.damage.events[0].multipliers.anomalyDamage, 1)

console.log("Velina C6 damage tests passed")
