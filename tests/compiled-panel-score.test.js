import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

const statIds = [
    "hpFlat",
    "atkFlat",
    "defFlat",
    "atkPct",
    "critRate",
    "critDmg",
    "dmgBonus",
    "iceDmg",
    "physicalDmg",
    "anomalyProficiency",
    "anomalyMastery",
    "penRatio",
    "penFlat",
    "energyRegen",
]
const setIds = [
    "branch_blade_song",
    "polar_metal",
    "woodpecker_electro",
    "hormone_punk",
]
const setIndexById = new Map(setIds.map((id, index) => [id, index]))

function lcg(seed) {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

function statProbe(seed) {
    const random = lcg(seed)
    const statValues = new Float64Array(statIds.length)
    for (let index = 0; index < statIds.length; index += 1) {
        const roll = random()
        if (roll < 0.35) {
            continue
        }
        const stat = statIds[index]
        statValues[index] = stat.endsWith("Flat") || stat === "anomalyProficiency" || stat === "anomalyMastery" || stat === "penFlat"
            ? Math.round(random() * 240)
            : Number((random() * 40).toFixed(6))
    }
    const setCountValues = new Int16Array(setIds.length)
    for (let slot = 0; slot < 6; slot += 1) {
        setCountValues[Math.floor(random() * setIds.length)] += 1
    }
    return { statValues, setCountValues }
}

function valuesToMap(values, ids) {
    const result = new Map()
    values.forEach((value, index) => {
        if (Number(value) !== 0) {
            result.set(ids[index], Number(value))
        }
    })
    return result
}

function approx(actual, expected, label) {
    const left = Number(actual ?? 0)
    const right = Number(expected ?? 0)
    const delta = Math.abs(left - right)
    assert.ok(delta <= 1e-8 * Math.max(1, Math.abs(left), Math.abs(right)), `${label}: expected ${right}, got ${left}`)
}

function compareDense(label, input, seeds = 64) {
    const calculator = createInCombatPanelCalculator(catalog, input)
    const denseTarget = calculator.compileDensePanelScoreTarget({ statIds, setIds, setIndexById })
    assert.ok(denseTarget, `${label} should compile dense panel score target`)

    for (let seed = 1; seed <= seeds; seed += 1) {
        const { statValues, setCountValues } = statProbe(seed)
        const statTotals = valuesToMap(statValues, statIds)
        const setCounts = valuesToMap(setCountValues, setIds)
        const mapSummary = calculator.scoreOnlyFromSummary(statTotals, setCounts)
        const denseSummary = denseTarget.scoreDense(statValues, setCountValues)
        approx(denseSummary.finalDamage, mapSummary.finalDamage, `${label} seed ${seed} finalDamage`)
        for (const key of ["hp", "atk", "def", "critRate", "critDmg", "anomalyProficiency", "penRatio", "iceDmg"]) {
            approx(denseSummary.panel[key], mapSummary.panel[key], `${label} seed ${seed} panel.${key}`)
        }
    }
}

const miyabi = catalog.agentsMap.get("hoshimi_miyabi")
compareDense("miyabi-custom", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["driveDisc4pc:branch_blade_song.self"],
    },
    damage: miyabi.defaultCalculationConfig,
})

compareDense("direct", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        events: [
            {
                id: "direct",
                kind: "direct",
                skillMultiplier: 12.5,
                critMode: "expected",
                damageElement: "ice",
            },
        ],
        target: {
            stunned: true,
            stunMultiplierPercent: 150,
        },
    },
})

compareDense("attribute-anomaly", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        events: [
            {
                id: "shatter",
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffect: "shatter",
                count: 2,
            },
        ],
        target: {
            stunned: true,
            stunMultiplierPercent: 150,
        },
    },
})

compareDense("buff-modifier-source", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: [
            "youye.additional_ability.anomaly_damage_bonus",
            "youye.cinema_1.amplify_additional_ability",
        ],
    },
    damage: {
        events: [
            {
                id: "shatter",
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffect: "shatter",
                count: 2,
            },
            {
                id: "frozen-disorder",
                kind: "anomaly",
                settlementType: "disorder",
                previousAnomalyEffect: "frozen",
                durationSeconds: 10,
                elapsedSeconds: 0,
                count: 1,
            },
        ],
    },
})

console.log("compiled panel score tests passed")
