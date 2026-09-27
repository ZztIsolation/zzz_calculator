import assert from "node:assert/strict"
import { loadCatalog, calculateInCombatPanel } from "../backend/calculator.js"

const catalog = await loadCatalog("E:/yan1/zzz/zzz_calculator/data", "E:/yan1/zzz/zzz_calculator/examples")

function input(event, manualEffects = []) {
    return {
        agentId: "velina",
        wEngineId: "zzz_wiki_2030",
        wEngineModificationLevel: 1,
        coreSkillLevel: "F",
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [], manualEffects },
        damage: {
            agentLevel: 60,
            target: {
                defense: 0,
                levelCoefficient: 794,
                resistanceByElement: { physical: 0, fire: 0, ice: 0, electric: 0, ether: 0, wind: 0 },
                stunMultiplierPercent: 100,
            },
            events: [event],
            selectedEventId: event.id,
        },
    }
}

function turbulenceEvent(overrides = {}) {
    return {
        id: "velina-turbulence",
        kind: "anomaly",
        settlementType: "turbulence",
        anomalyEffect: "turbulence",
        turbulenceEffect: "turbulence",
        secondaryAnomalyEffect: "burn",
        secondaryElement: "fire",
        baseMultiplier: 4.5,
        remainingSeconds: 10,
        windSource: { actorRef: { agentId: "velina" } },
        anomalySource: { actorRef: { agentId: "velina" } },
        count: 1,
        stunned: false,
        ...overrides,
    }
}

function damage(result) {
    return Number(result.damage.events[0].finalDamage)
}

const baseline = damage(calculateInCombatPanel(catalog, input(turbulenceEvent())))
assert.ok(baseline > 0)

const sourceContext = calculateInCombatPanel(catalog, input({ id: "source-context", kind: "anomaly", settlementType: "attribute", anomalyEffect: "wind_corrosion", count: 1, stunned: false }))
const secondarySnapshot = {
    schemaVersion: 1,
    agentId: "velina",
    agentLevel: 60,
    capturedAt: "2026-09-22T00:00:00.000Z",
    sourceConfigHash: "turbulence-test",
    panel: { ...sourceContext.inCombat.panel, atk: 900 },
    outOfCombatPanel: { ...sourceContext.outOfCombat.panel, atk: 900 },
    buffTotals: sourceContext.inCombat.buffTotals,
}
const dualSource = calculateInCombatPanel(catalog, input(turbulenceEvent({
    anomalySource: { actorRef: { agentId: "velina" }, snapshot: secondarySnapshot },
})))
assert.equal(dualSource.damage.events[0].panelSnapshot.atk, 900)
assert.ok(damage(dualSource) < baseline)

const turbulenceBonus = damage(calculateInCombatPanel(catalog, input(turbulenceEvent(), [{
    id: "manual-turbulence-bonus",
    label: "乱流测试增伤",
    effects: [{
        id: "manual-turbulence-bonus-effect",
        type: "fixed",
        stat: "turbulenceDamageBonus",
        value: 20,
        mode: "flat",
        target: { kind: "anomaly", settlementType: "turbulence" },
    }],
}])))
assert.equal(turbulenceBonus / baseline, 1.2)

const fireBonus = damage(calculateInCombatPanel(catalog, input(turbulenceEvent(), [{
    id: "manual-fire-bonus",
    label: "火属性测试增伤",
    effects: [{
        id: "manual-fire-bonus-effect",
        type: "fixed",
        stat: "fireDmg",
        value: 25,
        mode: "flat",
        target: { kind: "default" },
    }],
}])))
assert.equal(fireBonus / baseline, 1.25)

const windBonus = damage(calculateInCombatPanel(catalog, input(turbulenceEvent(), [{
    id: "manual-wind-bonus",
    label: "风属性测试增伤",
    effects: [{
        id: "manual-wind-bonus-effect",
        type: "fixed",
        stat: "windDmg",
        value: 25,
        mode: "flat",
        target: { kind: "default" },
    }],
}])))
assert.equal(windBonus, baseline)

assert.throws(
    () => calculateInCombatPanel(catalog, input(turbulenceEvent({ baseMultiplier: undefined }))),
    /乱流倍率缺少已确认的版本化资料|乱流倍率表缺少已确认资料/,
)

console.log("turbulence damage tests passed")
