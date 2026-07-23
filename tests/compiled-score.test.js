import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

function approxEqual(actual, expected, label) {
    const delta = Math.abs(Number(actual ?? 0) - Number(expected ?? 0))
    assert.ok(delta < 1e-9, `${label}: expected ${expected}, got ${actual}`)
}

function compareCalculator(label, input) {
    const calculator = createInCombatPanelCalculator(catalog, input)
    assert.equal(calculator.compiledScoreOnly, true, `${label} should expose compiled score-only`)
    const statSamples = [
        new Map(),
        new Map([
            ["atkPct", 0.3],
            ["atkFlat", 120],
            ["critRate", 0.18],
            ["critDmg", 0.42],
            ["dmgBonus", 0.12],
        ]),
        new Map([
            ["anomalyProficiency", 90],
            ["penRatio", 0.12],
            ["iceDmg", 0.3],
            ["etherDmg", 0.2],
            ["sheerForceFlat", 300],
        ]),
    ]
    const setSamples = [
        new Map(),
        new Map([["woodpecker_electro", 4], ["hormone_punk", 2]]),
        new Map([["branch_blade_song", 4], ["polar_metal", 2]]),
    ]
    for (const statTotals of statSamples) {
        for (const setCounts of setSamples) {
            const compiled = calculator.scoreOnlyFromSummary(statTotals, setCounts)
            const legacy = calculator.scoreOnlyFromSummaryLegacy(statTotals, setCounts)
            approxEqual(compiled.finalDamage, legacy.finalDamage, `${label} finalDamage`)
            approxEqual(compiled.panel.atk, legacy.panel.atk, `${label} atk`)
            approxEqual(compiled.panel.critRate, legacy.panel.critRate, `${label} critRate`)
            approxEqual(compiled.panel.anomalyProficiency, legacy.panel.anomalyProficiency, `${label} anomalyProficiency`)
        }
    }
}

compareCalculator("direct", {
    agentId: exampleInput.agentId,
    coreSkillLevel: exampleInput.coreSkillLevel,
    wEngineId: exampleInput.wEngineId,
    combatBuffs: { activeBuffIds: [] },
    damage: exampleInput.damage,
})

compareCalculator("direct-stunned", {
    agentId: exampleInput.agentId,
    coreSkillLevel: exampleInput.coreSkillLevel,
    wEngineId: exampleInput.wEngineId,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        ...exampleInput.damage,
        target: {
            ...(exampleInput.damage?.target ?? {}),
            stunned: true,
            stunMultiplierPercent: 150,
        },
    },
})

const miyabi = catalog.agentsMap.get("hoshimi_miyabi")
compareCalculator("miyabi-custom", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: miyabi.defaultCalculationConfig,
})

compareCalculator("miyabi-mixed-event-stun", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        ...miyabi.defaultCalculationConfig,
        events: miyabi.defaultCalculationConfig.events.map((event, index) => ({
            ...event,
            stunned: index % 2 === 0,
        })),
        target: {
            stunMultiplierPercent: 175,
        },
    },
})

compareCalculator("miyabi-targeted-crit-dmg", {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: ["field.defense_v5.v3_0.p3.lingdu_xingdong"] },
    damage: {
        events: [
            {
                id: "lingdu-basic",
                kind: "direct",
                critMode: "expected",
                skillRef: {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "basic",
                    moveId: "frost_moon",
                    rowId: "charge_3",
                    level: 12,
                },
            },
            {
                id: "lingdu-ultimate",
                kind: "direct",
                critMode: "expected",
                skillRef: {
                    agentSkillId: "hoshimi_miyabi",
                    categoryId: "chain",
                    moveId: "ultimate_lingering_snow",
                    rowId: "damage",
                    level: 12,
                },
            },
        ],
    },
})

const yixuan = catalog.agentsMap.get("yixuan")
compareCalculator("sheer", {
    agentId: "yixuan",
    coreSkillLevel: "F",
    wEngineId: "zzz_wiki_1342",
    wEngineModificationLevel: 1,
    combatBuffs: { activeBuffIds: [] },
    damage: {
        ...yixuan.defaultCalculationConfig,
        target: {
            stunned: true,
            stunMultiplierPercent: 150,
        },
    },
})

compareCalculator("jane-extended-flinch-disorder", {
    agentId: exampleInput.agentId,
    coreSkillLevel: exampleInput.coreSkillLevel,
    wEngineId: exampleInput.wEngineId,
    combatBuffs: { activeBuffIds: ["jane_doe.core_insight"] },
    damage: {
        events: [{
            id: "flinch-disorder",
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: "flinch",
            elapsedSeconds: 12,
            count: 1,
        }],
    },
})

console.log("compiled score-only tests passed")
