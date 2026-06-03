import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { analyzeDriveDiscStatGains, analyzeDriveDiscSubstats } from "../backend/driveDiscAnalysis.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

function approx(actual, expected, message, epsilon = 1e-6) {
    assert.ok(
        Math.abs(Number(actual) - Number(expected)) < epsilon,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

function finalDamage(result) {
    return Number(result.damage?.totalFinalDamage ?? result.damage?.finalDamage ?? 0)
}

function disc(id, partition, mainStat, subStats = []) {
    return {
        id,
        setId: "woodpecker_electro",
        partition,
        rarity: "S",
        level: 15,
        mainStat,
        subStats,
    }
}

const driveDiscs = [
    disc("d1", 1, { stat: "hpFlat", value: 2200 }, [
        { stat: "atkPct", value: 6 },
        { stat: "critDmg", value: 9.6 },
    ]),
    disc("d2", 2, { stat: "atkFlat", value: 316 }, [
        { stat: "atkPct", value: 3 },
        { stat: "critRate", value: 2.4 },
    ]),
    disc("d3", 3, { stat: "defFlat", value: 184 }, [
        { stat: "penFlat", value: 18 },
    ]),
    disc("d4", 4, { stat: "critRate", value: 24 }, [
        { stat: "critRate", value: 4.8 },
    ]),
    disc("d5", 5, { stat: "physicalDmg", value: 30 }, [
        { stat: "anomalyProficiency", value: 18 },
    ]),
    disc("d6", 6, { stat: "atkPct", value: 30 }, [
        { stat: "hpFlat", value: 224 },
    ]),
]

const payload = {
    ...exampleInput,
    driveDiscs,
    combatBuffs: {
        activeBuffIds: ["buff_h2r7x5p1kd"],
    },
    damage: {
        selectedEventId: "direct-hit",
        events: [
            {
                id: "direct-hit",
                kind: "direct",
                label: "Direct Hit",
                skillMultiplier: 100,
                critMode: "expected",
                count: 1,
            },
        ],
    },
    objective: "damage",
}

const substats = analyzeDriveDiscSubstats(catalog, payload)
const statsByName = new Map(substats.stats.map(item => [item.stat, item]))

approx(statsByName.get("atkPct").effectiveRolls, 3, "ATK% effective rolls should use drive disc substat step")
approx(statsByName.get("critDmg").effectiveRolls, 2, "CRIT DMG effective rolls should use drive disc substat step")
approx(statsByName.get("penFlat").effectiveRolls, 2, "PEN effective rolls should use drive disc substat step")
assert.equal(statsByName.has("atkFlat"), false, "main stat ATK should not enter substat analysis")

const gains = analyzeDriveDiscStatGains(catalog, payload)
const gainByStat = new Map(gains.stats.map(item => [item.stat, item]))
const baseline = calculateInCombatPanel(catalog, payload)
approx(gains.baseline.finalDamage, finalDamage(baseline), "Gain baseline should match full whitebox damage")

const atkPctPoint1 = gainByStat.get("atkPct").points[0]
const withOneMoreAtkPctRoll = JSON.parse(JSON.stringify(driveDiscs))
withOneMoreAtkPctRoll[0].subStats.push({ stat: "atkPct", value: 3 })
const fullRecalc = calculateInCombatPanel(catalog, {
    ...payload,
    driveDiscs: withOneMoreAtkPctRoll,
})
approx(
    atkPctPoint1.finalDamage,
    finalDamage(fullRecalc),
    "One ATK% roll gain must match full recomputation through out-of-combat panel",
)
assert.ok(atkPctPoint1.relativeGain > 0, "ATK% should increase direct damage")
assert.ok(gainByStat.get("penFlat"), "PEN flat gain curve should be returned")

const anomalyGain = gainByStat.get("anomalyProficiency")
assert.ok(
    anomalyGain.points.every(point => point.relativeGain === 0),
    "Anomaly Proficiency should have no direct-damage gain for this target",
)

const zeroPayload = {
    ...payload,
    damage: {
        selectedEventId: "zero-hit",
        events: [
            {
                id: "zero-hit",
                kind: "direct",
                label: "Zero Hit",
                skillMultiplier: 0,
                critMode: "expected",
                count: 1,
            },
        ],
    },
}
const zeroGains = analyzeDriveDiscStatGains(catalog, zeroPayload)
assert.equal(zeroGains.baseline.finalDamage, 0)
assert.ok(
    zeroGains.stats.every(stat => stat.points.every(point => point.relativeGain === 0)),
    "Zero baseline should return zero relative gains instead of Infinity or NaN",
)

const highCritPayload = {
    ...payload,
    driveDiscs: driveDiscs.map(item => ({
        ...item,
        subStats: [
            ...(item.subStats ?? []),
            { stat: "critRate", value: 120 },
        ],
    })),
}
const highCritGains = analyzeDriveDiscStatGains(catalog, highCritPayload)
const highCritRateGain = highCritGains.stats.find(item => item.stat === "critRate")
assert.ok(
    highCritRateGain.points.every(point => point.absoluteGain === 0),
    "CRIT Rate should not gain damage after the effective rate is capped",
)
