import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from "../backend/driveDiscOptimizer.js"
import { toCalculatorDriveDisc } from "../backend/driveDiscInventory.js"
import { anomalyDamageVariants, resolveAnomalyCritState } from "../core/anomalyCrit.js"
import { cleanStoredReactiveEvent } from "../core/anomalySettlement.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const modes = ["expected", "crit", "nonCrit"]
function near(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${message}: ${actual} != ${expected}`)
}

// Independent conditional outcomes, including the guaranteed-CRIT counterfactual.
for (const [rate, damages] of [[0.72, [13600, 15000, 10000]], [1.2, [15000, 15000, 10000]]]) {
    for (const [index, mode] of modes.entries()) {
        const state = resolveAnomalyCritState({ critRate: rate, critDmg: 0.5, critMode: mode })
        near(state.multiplier * 10000, damages[index], `${rate} ${mode}`)
        const variants = anomalyDamageVariants(10000, 2, state)
        for (const [variantIndex, key] of modes.entries()) near(variants[key].finalDamage, damages[variantIndex] * 2, key)
    }
}
for (const [critRate, critDmg] of [[0, 0], [0, 0.5], [0.72, 0], [-1, 0.5]]) {
    const state = resolveAnomalyCritState({ critRate, critDmg, critMode: "crit" })
    assert.equal(state.available, false)
    assert.equal(state.requestedMode, "crit")
    assert.equal(state.effectiveMode, "nonCrit")
    assert.equal(state.multiplier, 1)
    assert.equal(anomalyDamageVariants(10000, 1, state), undefined)
}

function input(settlementType, critMode, enabled = true) {
    const release = settlementType === "release"
    const event = release
        ? structuredClone(catalog.agentsMap.get("aria").defaultCalculationConfig.events[0])
        : { id: "anomaly", kind: "anomaly", settlementType, anomalyEffect: "assault", procCount: 1, elapsedSeconds: 0 }
    Object.assign(event, { critMode, count: 2, stunned: false, damageRatioPct: 75 })
    return {
        agentId: release ? "aria" : "alice_thymefield",
        coreSkillLevel: "F", wEngineId: "zzz_wiki_212", cinemaLevel: release ? 1 : 0, driveDiscs: [],
        combatBuffs: {
            activeBuffIds: enabled ? release ? ["agent:aria.cinema.1"] : settlementType === "attribute" ? ["jane_doe.core_insight"] : [] : [],
            runtimeInputs: { "jane_doe.core_insight": { effects: { jane_doe_core_assault_crit_rate: { sourceValue: 200 } } } },
            manualEffects: enabled && settlementType === "turbulence" ? [{ id: "turbulence-crit", effects: [
                { id: "rate", type: "fixed", stat: "anomalyCritRate", value: 72, mode: "flat", target: { kind: "anomaly", settlementType: "turbulence", anomalyEffects: ["assault"] } },
                { id: "damage", type: "fixed", stat: "anomalyCritDmg", value: 50, mode: "flat", target: { kind: "anomaly", settlementType: "turbulence", anomalyEffects: ["assault"] } },
            ] }] : [],
        },
        damage: { events: [event], agentLevel: 60, target: { defense: 0, resistanceByElement: { physical: 0, ether: 0 } } },
    }
}

const statIds = ["atkPct", "atkFlat", "anomalyProficiency", "anomalyMastery", "critRate", "critDmg"]
const setIds = ["freedom_blues", "hormone_punk"]
const counts = Int16Array.of(4, 2)
function summaryDiscs(values) {
    return Array.from({ length: 6 }, (_, i) => ({
        id: `summary-${i}`, partition: i + 1, setId: i < 4 ? setIds[0] : setIds[1],
        mainStat: { stat: "hpFlat", value: 0, mode: "flat" },
        subStats: i ? [] : statIds.map((stat, j) => ({ stat, value: values[j] })),
    }))
}
for (const settlement of ["attribute", "turbulence", "release"]) {
    for (const mode of modes) {
        const request = input(settlement, mode)
        const result = calculateInCombatPanel(catalog, request)
        const event = result.damage.events[0]
        assert.equal(event.input.critMode, mode)
        assert.equal(event.critInfo.available, true)
        near(event.finalDamage, event.damageVariants[mode].finalDamage, `${settlement} selected variant`)
        near(event.damageVariants.expected.finalDamage,
            event.damageVariants.nonCrit.finalDamage * (1 + event.critInfo.critRate * event.critInfo.critDmg), "expectation")
        if (settlement !== "release") near(event.critInfo.critRate, 0.72, "72% fixture")
        const row = event.whiteBoxRows.find(row => row.label === "异常暴击区")
        assert.ok(row.formulaLines.join(" ").includes("当前模式"))
        if (mode === "nonCrit") assert.ok(row.formulaLines.includes("非暴击乘区 = 1"))

        // Ordinary panel CRIT never substitutes for anomaly CRIT.
        const calculator = createInCombatPanelCalculator(catalog, request)
        const dense = calculator.compileDensePanelScoreTarget({ statIds, setIds, setIndexById: new Map(setIds.map((id, i) => [id, i])) })
        const fixed = dense.compileForSetCounts(counts)
        assert.equal(typeof fixed.scoreObjectiveScalar, "function")
        for (const mastery of [0, 12.5, 70, 150]) {
            const values = Float64Array.of(30, 40, 80, mastery, 200, 300)
            const totals = new Map(statIds.map((id, i) => [id, values[i]]))
            const sets = new Map(setIds.map((id, i) => [id, counts[i]]))
            const full = calculator.calculate(summaryDiscs(values), { round: false }).damage.totalFinalDamage
            near(calculator.scoreOnlyFromSummaryLegacy(totals, sets).finalDamage, full, "fast score")
            near(calculator.scoreOnlyFromSummary(totals, sets).finalDamage, full, "compiled score")
            near(dense.scoreDense(values, counts).finalDamage, full, "dense score")
            near(fixed.scoreScalar(values).finalDamage, full, "fixed score")
            near(fixed.scoreObjectiveScalar(values).finalDamage, full, "fixed objective")
            const half = Float64Array.from(values, value => value / 2)
            const indexed = { indexes: Int32Array.from(statIds.map((_, i) => i)), values: half }
            near(fixed.scoreCombinedScalar(half, indexed).finalDamage, full, "indexed score")
            assert.ok(fixed.scoreCombinedScalar(half, null, half).finalDamage >= full * (1 - 1e-9), "optimistic bound")
            const noPanelCrit = values.slice()
            noPanelCrit[4] = 0; noPanelCrit[5] = 0
            near(calculator.calculate(summaryDiscs(noPanelCrit), { round: false }).damage.totalFinalDamage, full, "ordinary CRIT isolation")
        }

        const dormant = calculateInCombatPanel(catalog, input(settlement, mode, false)).damage.events[0]
        assert.equal(dormant.input.critMode, mode)
        assert.equal(dormant.critInfo.available, false)
        assert.equal(dormant.damageVariants, undefined)
        assert.ok(!dormant.whiteBoxRows.some(row => row.label === "异常暴击区"))
        assert.equal(cleanStoredReactiveEvent(request.damage.events[0]).critMode, mode)
    }
    const missing = calculateInCombatPanel(catalog, input(settlement, undefined)).damage.finalDamage
    near(missing, calculateInCombatPanel(catalog, input(settlement, "invalid")).damage.finalDamage, "legacy default")
    near(missing, calculateInCombatPanel(catalog, input(settlement, "expected")).damage.finalDamage, "default expectation")
}

for (const [settlement, effect] of [["attribute", "shock"], ["turbulence", "assault"], ["disorder", "flinch"]]) {
    const request = input("attribute", "crit")
    Object.assign(request.damage.events[0], { settlementType: settlement, anomalyEffect: effect })
    const event = calculateInCombatPanel(catalog, request).damage.events[0]
    assert.equal(event.critInfo.available, false, "Jane matching scope must remain unchanged")
    assert.equal(event.damageVariants, undefined)
}

for (const mode of modes) {
    const request = input("attribute", mode)
    const original = calculateInCombatPanel(catalog, request).damage.finalDamage
    const agent = { ...catalog.agentsMap.get(request.agentId), skillGroups: [{
        id: "crit-group", name: { zhCN: "异常暴击组" }, defaultCount: 1, events: request.damage.events,
    }] }
    const groupedCatalog = { ...catalog, agentsMap: new Map(catalog.agentsMap).set(agent.id, agent) }
    const grouped = calculateInCombatPanel(groupedCatalog, { ...request, damage: { ...request.damage,
        events: [{ id: "group", kind: "skillGroup", skillGroupId: "crit-group", count: 3, stunned: false }],
    } }).damage
    assert.equal(grouped.events[0].input.critMode, mode)
    near(grouped.totalFinalDamage, original * 3, "group expansion retains child outcome")
}

// An external source's panel and CRIT rules must not replace Release's trigger CRIT.
const snapshot = {
    schemaVersion: 2, agentId: "alice_thymefield", agentLevel: 60, sourceConfigHash: "crit-fixture",
    capturedAt: "2026-10-08T00:00:00.000Z",
    panel: { atk: 2000, anomalyProficiency: 300, anomalyMastery: 100 },
    outOfCombatPanel: { atk: 2000, anomalyProficiency: 300, anomalyMastery: 100 },
    buffTotals: { damageModifiers: [{ kind: "anomalyCritRate", value: 1 }, { kind: "anomalyCritDmg", value: 10 }] },
}
for (const mode of modes) {
    const request = input("release", mode)
    request.damage.events[0].anomalySource = { actorRef: { agentId: snapshot.agentId }, snapshot }
    const damage = calculateInCombatPanel(catalog, request).damage.events[0]
    assert.equal(damage.panelSnapshot.atk, 2000)
    near(damage.critInfo.critDmg, 0.25, "Release uses trigger CRIT damage only")
    const inactive = structuredClone(request)
    inactive.combatBuffs.activeBuffIds = []
    assert.equal(calculateInCombatPanel(catalog, inactive).damage.events[0].critInfo.available, false)
}

// Independent full enumeration, with ATK/AP/Mastery tradeoffs and fixed legal 4+2 sets.
const mainStats = [
    { stat: "hpFlat", value: 2200 }, { stat: "atkFlat", value: 316 }, { stat: "defFlat", value: 184 },
    { stat: "anomalyProficiency", value: 92 }, { stat: "atkPct", value: 30, mode: "pct" },
    { stat: "anomalyMastery", value: 30, mode: "pct" },
]
const bySlot = mainStats.map((mainStat, slot) => [0, 1].map(variant => ({
    id: `crit-${slot + 1}-${variant}`, ownerId: "default", partition: slot + 1,
    setId: slot < 4 ? setIds[0] : setIds[1], rarity: "S", level: 15, maxLevel: 15,
    mainStat: { mode: "flat", ...mainStat },
    subStats: variant ? [{ stat: "atkPct", value: [7.9, 9.6, 7.3, 10.4, 8.1, 11.8][slot], mode: "pct" }]
        : [{ stat: "anomalyProficiency", value: [23, 29, 31, 37, 41, 43][slot], mode: "flat" }],
})))
const store = { currentOwnerId: "default", driveDiscs: bySlot.flat() }
for (const settlement of ["attribute", "turbulence", "release"]) for (const mode of modes) {
    const request = { ...input(settlement, mode), settings: {
        objective: "damage", algorithm: "exact-super-bound", fourPieceSetIds: [setIds[0]], twoPieceSetIds: [setIds[1]],
        minimums: {}, mainStatLimits: {}, enableObjectiveRelevantDominance: false,
    } }
    const brute = Array.from({ length: 64 }, (_, mask) => {
        const discs = bySlot.map((choices, slot) => choices[(mask >> slot) & 1])
        return { ids: discs.map(disc => disc.id).join("|"), score: calculateInCombatPanel(catalog, {
            ...request, driveDiscs: discs.map(toCalculatorDriveDisc),
        }).damage.totalFinalDamage }
    }).sort((a, b) => b.score - a.score || a.ids.localeCompare(b.ids)).slice(0, 10)
    const exact = optimizeDriveDiscs(catalog, store, request)
    assert.equal(exact.metrics.strictExact, true)
    const worker = await optimizeDriveDiscsAsync(catalog, store, { ...request, settings: {
        ...request.settings, algorithm: "exact-super-bound-parallel", workerCount: 2,
    } })
    assert.ok(worker.metrics.parallelTaskCount > 0, "Node Worker must execute the fixture")
    for (const result of [exact, worker]) {
        assert.deepEqual(result.results.map(row => row.driveDiscs.map(disc => disc.id).join("|")), brute.map(row => row.ids), `${settlement} ${mode} Top 10 IDs`)
        result.results.forEach((row, i) => near(row.score, brute[i].score, `${settlement} ${mode} Top 10 score`))
    }
}
console.log("anomaly CRIT modes: formulas, matching, all scoring paths, bounds and Node Worker Top 10 passed")
