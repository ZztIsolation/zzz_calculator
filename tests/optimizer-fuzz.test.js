import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs } from "../backend/driveDiscOptimizer.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

const fourSet = "woodpecker_electro"
const twoSet = "hormone_punk"
const thirdSet = catalog.driveDiscSets.find(set => ![fourSet, twoSet].includes(set.id))?.id ?? twoSet
const setPool = [fourSet, twoSet, thirdSet]
const slotMainOptions = {
    1: [{ stat: "hpFlat", value: 2200 }],
    2: [{ stat: "atkFlat", value: 316 }],
    3: [{ stat: "defFlat", value: 184 }],
    4: [
        { stat: "critRate", value: 24, mode: "pct" },
        { stat: "critDmg", value: 48, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "anomalyProficiency", value: 92 },
    ],
    5: [
        { stat: "physicalDmg", value: 30, mode: "pct" },
        { stat: "electricDmg", value: 30, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "penRatio", value: 24, mode: "pct" },
    ],
    6: [
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "anomalyMastery", value: 30, mode: "pct" },
        { stat: "energyRegen", value: 60, mode: "pct" },
    ],
}
const subStatPool = [
    "critRate",
    "critDmg",
    "atkPct",
    "penRatio",
    "anomalyProficiency",
    "atkFlat",
    "hpPct",
    "dmgBonus",
]

function createRng(seed) {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

function pick(rng, items) {
    return items[Math.floor(rng() * items.length)]
}

function subStatValue(stat, rng) {
    if (stat === "critRate") {
        return 2.4 + Math.floor(rng() * 4) * 1.2
    }
    if (stat === "critDmg") {
        return 4.8 + Math.floor(rng() * 5) * 2.4
    }
    if (stat === "atkFlat") {
        return 19 + Math.floor(rng() * 5) * 19
    }
    if (stat === "anomalyProficiency") {
        return 9 + Math.floor(rng() * 5) * 9
    }
    return 3 + Math.floor(rng() * 5) * 1.5
}

function disc(seed, id, setId, partition, rng) {
    const mainStat = pick(rng, slotMainOptions[partition])
    const used = new Set([mainStat.stat])
    const subStats = []
    while (subStats.length < 4) {
        const stat = pick(rng, subStatPool)
        if (used.has(stat)) {
            continue
        }
        used.add(stat)
        subStats.push({
            stat,
            value: subStatValue(stat, rng),
            mode: stat === "atkFlat" || stat === "anomalyProficiency" ? "flat" : "pct",
            label: stat,
        })
    }
    return {
        id,
        ownerId: "default",
        setId,
        setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: {
            ...mainStat,
            mode: mainStat.mode ?? "flat",
            label: mainStat.stat,
        },
        subStats,
        source: {
            type: "fuzz",
            sequence: seed * 1000 + Number(id.replace(/\D/g, "")),
        },
    }
}

function fuzzStore(seed) {
    const rng = createRng(seed)
    const driveDiscs = []
    for (const slot of [1, 2, 3, 4, 5, 6]) {
        for (const setId of setPool) {
            for (let variant = 0; variant < 2; variant += 1) {
                driveDiscs.push(disc(seed, `${setId}-${slot}-${variant}`, setId, slot, rng))
            }
        }
    }
    return {
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs,
    }
}

function damageForScenario(index) {
    if (index === 1) {
        return {
            ...exampleInput.damage,
            selectedEventId: "direct-hit",
            events: [
                { id: "direct-hit", kind: "direct", skillMultiplier: 100, critMode: "expected", count: 2 },
                { id: "assault-hit", kind: "anomaly", anomalyEffect: "assault", procCount: 1, count: 1 },
            ],
        }
    }
    if (index === 2) {
        return {
            agentLevel: 60,
            selectedEventId: "shatter-hit",
            events: [
                { id: "shatter-hit", kind: "anomaly", anomalyEffect: "shatter", procCount: 1, count: 1 },
            ],
        }
    }
    if (index === 7) {
        return {
            agentLevel: 60,
            selectedEventId: "frost-disorder",
            events: [
                {
                    id: "frost-disorder",
                    kind: "anomaly",
                    settlementType: "disorder",
                    anomalyEffect: "frost_frozen",
                    elapsedSeconds: 0,
                    durationSeconds: 20,
                    count: 1,
                },
            ],
        }
    }
    return exampleInput.damage
}

function settingsForScenario(index) {
    const base = {
        fourPieceSetId: fourSet,
        objective: "damage",
    }
    if (index === 0 || index === 1 || index === 2) {
        return { ...base, twoPieceSetId: twoSet }
    }
    if (index === 3) {
        return { ...base, twoPieceSetId: fourSet }
    }
    if (index === 4) {
        return { ...base, twoPieceSetIds: [twoSet, thirdSet] }
    }
    if (index === 5) {
        return {
            ...base,
            twoPieceSetId: twoSet,
            mainStatLimits: { 4: ["critRate", "atkPct"], 5: ["physicalDmg", "atkPct"], 6: ["atkPct"] },
            minimums: { critRate: 25 },
        }
    }
    if (index === 6) {
        return base
    }
    return { ...base, twoPieceSetId: twoSet }
}

function optimizerInput(seed, scenarioIndex, algorithm, store) {
    return {
        agentId: exampleInput.agentId,
        coreSkillLevel: exampleInput.coreSkillLevel,
        wEngineId: exampleInput.wEngineId,
        combatBuffs: { activeBuffIds: [] },
        damage: damageForScenario(scenarioIndex),
        settings: {
            ...settingsForScenario(scenarioIndex),
            algorithm,
            ...(algorithm === "exact-legacy" ? { enableUpperBoundPruning: false } : {}),
        },
        _debug: {
            seed,
            scenarioIndex,
            discCount: store.driveDiscs.length,
        },
    }
}

function topSignature(result) {
    return result.results.map(item => ({
        ids: item.driveDiscs.map(disc => disc.id).join("|"),
        score: Number(item.score.toFixed(6)),
    }))
}

function assertSameTop(seed, scenarioIndex, legacy, superBound) {
    const legacyTop = topSignature(legacy)
    const superTop = topSignature(superBound)
    try {
        assert.deepEqual(superTop, legacyTop)
    } catch (error) {
        error.message = [
            error.message,
            `seed=${seed}`,
            `scenario=${scenarioIndex}`,
            `legacy=${JSON.stringify(legacyTop)}`,
            `superBound=${JSON.stringify(superTop)}`,
            `metrics=${JSON.stringify(superBound.metrics)}`,
        ].join("\n")
        throw error
    }
}

const FUZZ_SEEDS = 100
for (let seed = 1; seed <= FUZZ_SEEDS; seed += 1) {
    const store = fuzzStore(seed)
    const scenarioIndex = (seed - 1) % 8
    const legacy = optimizeDriveDiscs(catalog, store, optimizerInput(seed, scenarioIndex, "exact-legacy", store))
    const superBound = optimizeDriveDiscs(catalog, store, optimizerInput(seed, scenarioIndex, "exact-super-bound", store))
    assert.equal(superBound.metrics.strictExact, true)
    assertSameTop(seed, scenarioIndex, legacy, superBound)
}

console.log(`optimizer fuzz tests passed (${FUZZ_SEEDS} seeds)`)
