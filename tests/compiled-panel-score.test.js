import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

const statIds = [
    "hpFlat",
    "hpPct",
    "atkFlat",
    "defFlat",
    "atkPct",
    "critRate",
    "critDmg",
    "dmgBonus",
    "iceDmg",
    "etherDmg",
    "physicalDmg",
    "anomalyProficiency",
    "anomalyMastery",
    "penRatio",
    "penFlat",
    "energyRegen",
    "allResIgnore",
]
const setIds = [
    "branch_blade_song",
    "polar_metal",
    "woodpecker_electro",
    "hormone_punk",
    "phaethons_melody",
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
    const panelStatIndexById = new Map(denseTarget.panelStatIds.map((key, index) => [key, index]))

    for (let seed = 1; seed <= seeds; seed += 1) {
        const { statValues, setCountValues } = statProbe(seed)
        const statTotals = valuesToMap(statValues, statIds)
        const setCounts = valuesToMap(setCountValues, setIds)
        const mapSummary = calculator.scoreOnlyFromSummary(statTotals, setCounts)
        const denseSummary = denseTarget.scoreDense(statValues, setCountValues)
        for (const key of ["hp", "atk", "def", "critRate", "critDmg", "anomalyProficiency", "anomalyMastery", "penRatio", "allResIgnore", "iceDmg", "sheerForce", "sheerForceFlat"]) {
            approx(denseSummary.panel[key], mapSummary.panel[key], `${label} seed ${seed} panel.${key}`)
            approx(
                denseSummary.outOfCombatPanelValues[panelStatIndexById.get(key)],
                mapSummary.outOfCombatPanel[key],
                `${label} seed ${seed} outOfCombatPanel.${key}`,
            )
        }
        approx(denseSummary.finalDamage, mapSummary.finalDamage, `${label} seed ${seed} finalDamage`)
        const fixedTarget = denseTarget.compileForSetCounts(setCountValues)
        const fixedSummary = fixedTarget.scoreScalar(statValues)
        for (const key of ["atk", "anomalyProficiency", "critRate", "critDmg"]) {
            approx(
                fixedSummary.outOfCombatPanelValues[panelStatIndexById.get(key)],
                mapSummary.outOfCombatPanel[key],
                `${label} seed ${seed} fixed outOfCombatPanel.${key}`,
            )
        }
        assert.equal(typeof fixedTarget.scoreObjectiveScalar, "function", `${label} should compile objective scalar target`)
        const objectiveSummary = fixedTarget.scoreObjectiveScalar(statValues)
        approx(objectiveSummary.finalDamage, denseSummary.finalDamage, `${label} seed ${seed} objective finalDamage`)
        const selectedValues = Float64Array.from(statValues, value => value / 2)
        const suffixValues = Float64Array.from(statValues, value => value / 2)
        const combinedSummary = fixedTarget.scoreCombinedScalar(selectedValues, null, suffixValues, null)
        approx(combinedSummary.finalDamage, denseSummary.finalDamage, `${label} seed ${seed} combined finalDamage`)
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

compareDense("miyabi-mixed-event-stun", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["driveDisc4pc:branch_blade_song.self"],
    },
    damage: {
        ...miyabi.defaultCalculationConfig,
        events: miyabi.defaultCalculationConfig.events.map((event, index) => ({
            ...event,
            stunned: index % 2 === 0,
        })),
        target: { stunMultiplierPercent: 175 },
    },
}, 24)

compareDense("ye-shunguang-curtain-cap", {
    agentId: "ye_shunguang",
    coreSkillLevel: "F",
    wEngineId: catalog.examples.yeShunguang.input.wEngineId,
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["agent:ye_shunguang.corePassive", "agent:ye_shunguang.cinema.4"],
    },
    damage: {
        events: [{
            id: "ye-return-dust-curtain",
            kind: "direct",
            critMode: "expected",
            stunned: false,
            skillRef: {
                agentSkillId: "ye_shunguang",
                categoryId: "special",
                moveId: "ex_clarity_return_dust",
                rowId: "damage",
                level: 12,
            },
        }],
        target: { stunMultiplierPercent: 350 },
    },
}, 24)

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

const alice = catalog.agentsMap.get("alice_thymefield")
const aliceInput = {
    agentId: "alice_thymefield",
    coreSkillLevel: "F",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: ["agent:alice_thymefield.additionalAbility"] },
    damage: alice.defaultCalculationConfig,
}
compareDense("alice-anomaly-mastery", aliceInput)
const aliceCalculator = createInCombatPanelCalculator(catalog, aliceInput)
const aliceDenseTarget = aliceCalculator.compileDensePanelScoreTarget({ statIds, setIds, setIndexById })
const aliceStatValues = new Float64Array(statIds.length)
aliceStatValues[statIds.indexOf("anomalyMastery")] = 30
const aliceSetCountValues = new Int16Array(setIds.length)
aliceSetCountValues[setIds.indexOf("phaethons_melody")] = 2
const aliceDenseSummary = aliceDenseTarget.scoreDense(aliceStatValues, aliceSetCountValues)
const aliceMapSummary = aliceCalculator.scoreOnlyFromSummary(
    new Map([["anomalyMastery", 30]]),
    new Map([["phaethons_melody", 2]]),
)
for (const result of [aliceDenseSummary, aliceMapSummary]) {
    approx(result.panel.anomalyMastery, 195.96, "Alice compiled mastery should preserve exact percentage scaling")
    approx(result.panel.anomalyProficiency, 207.536, "Alice compiled proficiency should use corrected mastery")
}

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

compareDense("jane-extended-flinch-disorder", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["jane_doe.core_insight"],
    },
    damage: {
        events: [
            {
                id: "flinch-disorder",
                kind: "anomaly",
                settlementType: "disorder",
                anomalyEffect: "flinch",
                elapsedSeconds: 12,
                count: 1,
            },
            {
                id: "assault",
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffect: "assault",
                count: 1,
            },
        ],
    },
})

compareDense("sheer", {
    agentId: "yixuan",
    coreSkillLevel: "F",
    wEngineId: "zzz_wiki_1342",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        events: [
            {
                id: "sheer",
                kind: "sheer",
                skillMultiplier: 12,
                critMode: "expected",
                damageElement: "ether",
            },
        ],
        target: {
            stunned: true,
            stunMultiplierPercent: 150,
        },
    },
})

compareDense("element-scoped-direct-modifiers", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: [],
        manualEffects: [{
            id: "element-scoped-direct",
            effects: [
                { id: "ice-crit-dmg", type: "fixed", target: { kind: "default" }, stat: "iceCritDmg", mode: "flat", value: 25 },
                { id: "ice-def-ignore", type: "fixed", target: { kind: "default" }, stat: "iceDefIgnore", mode: "flat", value: 15 },
                { id: "all-res-ignore", type: "fixed", target: { kind: "default" }, stat: "allResIgnore", mode: "flat", value: 10 },
            ],
        }],
    },
    damage: {
        events: [
            { id: "ice", kind: "direct", skillMultiplier: 12.5, critMode: "expected", damageElement: "ice" },
            { id: "fire", kind: "direct", skillMultiplier: 8, critMode: "crit", damageElement: "fire" },
        ],
        target: { stunned: true, stunMultiplierPercent: 150 },
    },
})

compareDense("element-scoped-sheer-crit", {
    agentId: "yixuan",
    coreSkillLevel: "F",
    wEngineId: "zzz_wiki_1342",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: [],
        manualEffects: [{
            id: "element-scoped-sheer",
            effects: [{ id: "ether-crit-dmg", type: "fixed", target: { kind: "default" }, stat: "etherCritDmg", mode: "flat", value: 30 }],
        }],
    },
    damage: {
        events: [
            { id: "ether", kind: "sheer", skillMultiplier: 12, critMode: "expected", damageElement: "ether" },
            { id: "physical", kind: "sheer", skillMultiplier: 9, critMode: "crit", damageElement: "physical" },
        ],
        target: { stunned: true, stunMultiplierPercent: 150 },
    },
})

console.log("compiled panel score tests passed")
