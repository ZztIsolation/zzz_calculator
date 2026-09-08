import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"

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
    "defPct",
    "energyRegen",
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
        reservedForAgentId: null,
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
    for (const item of driveDiscs) {
        const reservationRoll = rng()
        if (reservationRoll < 0.12) item.reservedForAgentId = "alice_thymefield"
        else if (reservationRoll < 0.24) item.reservedForAgentId = exampleInput.agentId
    }
    return {
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs,
    }
}

function chunkBoundStore() {
    const seed = 9001
    const rng = createRng(seed)
    const focusStats = ["critRate", "critDmg", "atkPct", "penRatio", "anomalyProficiency", "atkFlat", "hpPct", "defPct", "energyRegen", "dmgBonus"]
    const driveDiscs = []
    for (let variant = 0; variant < 10; variant += 1) {
        const stat = focusStats[variant]
        driveDiscs.push({
            ...disc(seed, `${fourSet}-chunk-1-${variant}`, fourSet, 1, rng),
            subStats: [{
                stat,
                value: subStatValue(stat, rng) + 20,
                mode: stat === "atkFlat" || stat === "anomalyProficiency" ? "flat" : "pct",
                label: stat,
            }],
        })
    }
    for (const slot of [2, 3, 4]) {
        driveDiscs.push(disc(seed, `${fourSet}-chunk-${slot}-0`, fourSet, slot, rng))
    }
    for (const slot of [5, 6]) {
        driveDiscs.push(disc(seed, `${twoSet}-chunk-${slot}-0`, twoSet, slot, rng))
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
    if (index === 8) {
        return {
            ...exampleInput.damage,
            selectedEventId: "mixed-direct",
            events: [
                { id: "mixed-direct", kind: "direct", skillMultiplier: 180, critMode: "expected", count: 1 },
                { id: "mixed-extra", kind: "direct", skillMultiplier: 80, critMode: "never", count: 3 },
                { id: "mixed-assault", kind: "anomaly", anomalyEffect: "assault", procCount: 1, count: 1 },
            ],
        }
    }
    if (index === 9) {
        return {
            agentLevel: 60,
            selectedEventId: "energy-direct",
            events: [
                { id: "energy-direct", kind: "direct", skillMultiplier: 240, critMode: "always", count: 1 },
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
    if (index === 8) {
        return {
            ...base,
            twoPieceSetIds: [twoSet, thirdSet],
            mainStatLimits: { 4: ["critRate", "critDmg", "atkPct"], 5: ["physicalDmg", "electricDmg", "atkPct"], 6: ["atkPct", "energyRegen"] },
            minimums: { critRate: 20, atk: 1800 },
        }
    }
    if (index === 9) {
        return {
            ...base,
            mainStatLimits: { 4: ["critDmg", "atkPct"], 5: ["atkPct", "penRatio"], 6: ["atkPct"] },
        }
    }
    return { ...base, twoPieceSetId: twoSet }
}

function optimizerInput(seed, scenarioIndex, algorithm, store, extraSettings = {}) {
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
            ...extraSettings,
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

const VIVIAN_RELEASE_FUZZ_CASES = [
    { seed: 3101, cinemaLevel: 0, coreSkillLevel: "A", fourPieceSetId: "phaethons_melody", twoPieceSetId: "freedom_blues" },
    { seed: 3102, cinemaLevel: 2, coreSkillLevel: "B", fourPieceSetId: "chaos_jazz", twoPieceSetId: "freedom_blues" },
    { seed: 3103, cinemaLevel: 0, coreSkillLevel: "C", fourPieceSetId: "phaethons_melody", twoPieceSetId: "chaos_jazz" },
    { seed: 3104, cinemaLevel: 2, coreSkillLevel: "D", fourPieceSetId: "phaethons_melody", twoPieceSetId: "freedom_blues" },
    { seed: 3105, cinemaLevel: 0, coreSkillLevel: "E", fourPieceSetId: "chaos_jazz", twoPieceSetId: "freedom_blues" },
    { seed: 3106, cinemaLevel: 2, coreSkillLevel: "F", fourPieceSetId: "phaethons_melody", twoPieceSetId: "chaos_jazz" },
]
const vivianReleaseMainStatOptions = {
    1: [{ stat: "hpFlat", value: 2200 }],
    2: [{ stat: "atkFlat", value: 316 }],
    3: [{ stat: "defFlat", value: 184 }],
    4: [
        { stat: "anomalyProficiency", value: 92 },
        { stat: "atkPct", value: 30, mode: "pct" },
    ],
    5: [
        { stat: "etherDmg", value: 30, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
        { stat: "penRatio", value: 24, mode: "pct" },
    ],
    6: [
        { stat: "anomalyMastery", value: 30, mode: "pct" },
        { stat: "atkPct", value: 30, mode: "pct" },
    ],
}
const vivianReleaseSubStatPool = [
    "anomalyProficiency",
    "atkPct",
    "atkFlat",
    "penRatio",
    "dmgBonus",
]

function vivianReleaseFuzzDisc(scenario, scenarioIndex, setId, setIndex, slot, variant, rng) {
    const mainOptions = vivianReleaseMainStatOptions[slot]
    const mainStat = mainOptions[(scenarioIndex + setIndex + slot + variant) % mainOptions.length]
    const used = new Set([mainStat.stat])
    const subStats = []
    while (subStats.length < 3) {
        const stat = pick(rng, vivianReleaseSubStatPool)
        if (used.has(stat)) continue
        used.add(stat)
        subStats.push({
            stat,
            value: subStatValue(stat, rng),
            mode: stat === "atkFlat" || stat === "anomalyProficiency" ? "flat" : "pct",
            label: stat,
        })
    }
    return {
        id: `vivian-release-${scenario.seed}-${setIndex}-${slot}-${variant}`,
        ownerId: "default",
        setId,
        setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
        partition: slot,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        reservedForAgentId: null,
        mainStat: {
            ...mainStat,
            mode: mainStat.mode ?? "flat",
            label: mainStat.stat,
        },
        subStats,
        source: {
            type: "release-fuzz",
            sequence: scenario.seed * 100 + setIndex * 20 + slot * 2 + variant,
        },
    }
}

function vivianReleaseFuzzStore(scenario, scenarioIndex) {
    const rng = createRng(scenario.seed)
    return {
        version: 1,
        currentOwnerId: "default",
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs: [scenario.fourPieceSetId, scenario.twoPieceSetId].flatMap((setId, setIndex) =>
            [1, 2, 3, 4, 5, 6].flatMap(slot => [0, 1].map(variant =>
                vivianReleaseFuzzDisc(scenario, scenarioIndex, setId, setIndex, slot, variant, rng),
            )),
        ),
    }
}

function vivianReleaseOptimizerInput(scenario, algorithm) {
    const activeBuffIds = [
        "agent:vivian.corePassive",
        "agent:vivian.additionalAbility",
        "wEngine:zzz_wiki_1277.self",
    ]
    if (scenario.cinemaLevel >= 2) activeBuffIds.push("agent:vivian.cinema.2")
    return {
        agentId: "vivian",
        coreSkillLevel: scenario.coreSkillLevel,
        cinemaLevel: scenario.cinemaLevel,
        wEngineId: "zzz_wiki_1277",
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: { activeBuffIds },
        damage: {
            mode: "anomaly",
            selectedEventId: "vivian-fuzz-release",
            events: [{
                id: "vivian-fuzz-release",
                kind: "anomaly",
                settlementType: "release",
                anomalyEffect: "corruption",
                count: 1,
                stunned: true,
                triggerActorRef: { agentId: "vivian", profileId: "core_passive" },
                anomalySource: { actorRef: { agentId: "vivian" } },
            }],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: { ether: 0 },
            },
        },
        settings: {
            objective: "damage",
            algorithm,
            fourPieceSetId: scenario.fourPieceSetId,
            twoPieceSetId: scenario.twoPieceSetId,
            mainStatLimits: {
                4: ["anomalyProficiency", "atkPct"],
                5: ["etherDmg", "atkPct", "penRatio"],
                6: ["anomalyMastery", "atkPct"],
            },
            minimums: {},
            disableParallel: true,
            enableUpperBoundPruning: algorithm !== "exact-legacy",
        },
    }
}

const FUZZ_SEEDS = 160
let suffixTopKBoundCoverage = 0
let chunkBoundCoverage = 0
let reservationCoverage = 0
for (let seed = 1; seed <= FUZZ_SEEDS; seed += 1) {
    const store = fuzzStore(seed)
    const scenarioIndex = (seed - 1) % 10
    const legacy = optimizeDriveDiscs(catalog, store, optimizerInput(seed, scenarioIndex, "exact-legacy", store))
    const superBound = optimizeDriveDiscs(catalog, store, optimizerInput(seed, scenarioIndex, "exact-super-bound", store))
    assert.equal(superBound.metrics.strictExact, true)
    assertSameTop(seed, scenarioIndex, legacy, superBound)
    const reservedForOther = new Set(store.driveDiscs
        .filter(item => item.reservedForAgentId && item.reservedForAgentId !== exampleInput.agentId)
        .map(item => item.id))
    assert.ok(superBound.results.every(result => result.driveDiscs.every(item => !reservedForOther.has(item.id))))
    if (Number(superBound.metrics.excludedByReservation ?? 0) > 0) {
        reservationCoverage += 1
    }
    if (Number(superBound.metrics.suffixTopKBoundChecks ?? 0) > 0) {
        suffixTopKBoundCoverage += 1
    }
    if (Number(superBound.metrics.chunkBoundChecks ?? 0) > 0) {
        chunkBoundCoverage += 1
    }
    if (seed <= 20) {
        const indexed = optimizeDriveDiscs(
            catalog,
            store,
            optimizerInput(seed, scenarioIndex, "exact-super-bound", store, { useIndexedScoreOnly: "force" }),
        )
        if (Number(indexed.metrics.estimatedCombinationCount ?? 0) > 0) {
            assert.equal(indexed.metrics.indexedScoreEnabled, true)
        }
        assertSameTop(seed, scenarioIndex, legacy, indexed)
    }
    if (seed <= 30) {
        const parallel = await optimizeDriveDiscsAsync(
            catalog,
            store,
            optimizerInput(seed, scenarioIndex, "exact-super-bound-parallel", store, { workerCount: 2 }),
        )
        assert.equal(parallel.metrics.strictExact, true)
        assertSameTop(seed, scenarioIndex, legacy, parallel)
    }
}

let vivianReleaseBoundChecks = 0
let vivianReleasePruned = 0
const vivianReleaseCinemaCoverage = new Set()
const vivianReleaseCoreLevelCoverage = new Set()
const vivianReleaseSetCoverage = new Set()
for (const [scenarioIndex, scenario] of VIVIAN_RELEASE_FUZZ_CASES.entries()) {
    const releaseStore = vivianReleaseFuzzStore(scenario, scenarioIndex)
    const legacy = optimizeDriveDiscs(
        catalog,
        releaseStore,
        vivianReleaseOptimizerInput(scenario, "exact-legacy"),
    )
    const superBound = optimizeDriveDiscs(
        catalog,
        releaseStore,
        vivianReleaseOptimizerInput(scenario, "exact-super-bound"),
    )
    const scenarioLabel = `${scenario.coreSkillLevel}/C${scenario.cinemaLevel}/${scenario.fourPieceSetId}+${scenario.twoPieceSetId}`
    assert.equal(legacy.metrics.strictExact, true)
    assert.equal(superBound.metrics.strictExact, true)
    assert.equal(superBound.results.length, 10, `Vivian Release ${scenarioLabel} should produce a full Top 10.`)
    assertSameTop(`vivian-release-${scenario.seed}`, scenarioLabel, legacy, superBound)
    assert.equal(
        Number(superBound.metrics.scoredCombinationCount ?? 0)
            + Number(superBound.metrics.prunedBySuperBound ?? 0),
        Number(superBound.metrics.estimatedCombinationCount ?? 0),
        `Vivian Release ${scenarioLabel} should account for every scored or pruned loadout.`,
    )
    assert.ok(
        Number(superBound.metrics.superBoundChecks ?? 0) > 0,
        `Vivian Release ${scenarioLabel} should execute its interval upper bound.`,
    )
    assert.equal(
        superBound.results[0].data.damage.events[0].multipliers.releaseProficiencyYieldFactor ?? 1,
        scenario.cinemaLevel >= 2 ? 1.3 : 1,
        `Vivian Release ${scenarioLabel} should preserve its Cinema proficiency factor.`,
    )
    vivianReleaseBoundChecks += Number(superBound.metrics.superBoundChecks ?? 0)
    vivianReleasePruned += Number(superBound.metrics.prunedBySuperBound ?? 0)
    vivianReleaseCinemaCoverage.add(scenario.cinemaLevel)
    vivianReleaseCoreLevelCoverage.add(scenario.coreSkillLevel)
    vivianReleaseSetCoverage.add(`${scenario.fourPieceSetId}+${scenario.twoPieceSetId}`)
}
assert.deepEqual([...vivianReleaseCinemaCoverage].sort((a, b) => a - b), [0, 2])
assert.deepEqual([...vivianReleaseCoreLevelCoverage].sort(), ["A", "B", "C", "D", "E", "F"])
assert.ok(vivianReleaseSetCoverage.size >= 3, "Vivian Release fuzz should cover multiple 4+2 set pairs.")
assert.ok(vivianReleaseBoundChecks > 0, "Vivian Release fuzz should exercise interval-bound checks.")
assert.ok(vivianReleasePruned > 0, "Vivian Release fuzz should exercise strict upper-bound pruning.")

const chunkStore = chunkBoundStore()
const chunkLegacy = optimizeDriveDiscs(catalog, chunkStore, optimizerInput("chunk", 0, "exact-legacy", chunkStore))
const chunkSuperBound = optimizeDriveDiscs(catalog, chunkStore, optimizerInput(
    "chunk",
    0,
    "exact-super-bound",
    chunkStore,
    { enableObjectiveRelevantDominance: false },
))
assert.equal(chunkSuperBound.metrics.strictExact, true)
assertSameTop("chunk", 0, chunkLegacy, chunkSuperBound)
assert.ok(Number(chunkSuperBound.metrics.chunkBoundChecks ?? 0) > 0, "chunk bound fixture should exercise chunk checks")
chunkBoundCoverage += 1

assert.ok(reservationCoverage > 0, "reservation fuzz should exclude other-agent candidates")
console.log(`optimizer fuzz tests passed (${FUZZ_SEEDS} seeds, reservations=${reservationCoverage}, suffixTopK=${suffixTopKBoundCoverage}, chunk=${chunkBoundCoverage}, vivianReleaseChecks=${vivianReleaseBoundChecks}, vivianReleasePruned=${vivianReleasePruned})`)
