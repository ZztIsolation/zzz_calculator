import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { optimizeDriveDiscs, previewDriveDiscOptimization } from "../backend/driveDiscOptimizer.js"
import {
    clearUserDriveDiscStore,
    deleteDriveDiscLoadout,
    loadUserDriveDiscStore,
    toCalculatorDriveDisc,
    upsertDriveDiscLoadout,
} from "../backend/driveDiscInventory.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input

function disc(id, setId, partition, mainStat, subStats = []) {
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
        subStats: subStats.map(stat => ({
            ...stat,
            mode: stat.mode ?? "flat",
            label: stat.stat,
        })),
        source: {
            type: "test",
            sequence: Number(id.replace(/\D/g, "")) || 999,
        },
    }
}

const fourSet = "woodpecker_electro"
const twoSet = "hormone_punk"
const thirdSet = catalog.driveDiscSets.find(set => ![fourSet, twoSet].includes(set.id))?.id ?? twoSet
const slotMain = {
    1: { stat: "hpFlat", value: 2200 },
    2: { stat: "atkFlat", value: 316 },
    3: { stat: "defFlat", value: 184 },
    4: { stat: "critRate", value: 24, mode: "pct" },
    5: { stat: "physicalDmg", value: 30, mode: "pct" },
    6: { stat: "atkPct", value: 30, mode: "pct" },
}
const store = {
    version: 1,
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`f${slot}`, fourSet, slot, slotMain[slot], [
            { stat: "critRate", value: slot === 4 ? 2.4 : 4.8, mode: "pct" },
            { stat: "critDmg", value: 9.6 + slot, mode: "pct" },
            { stat: "atkPct", value: 3 + slot, mode: "pct" },
        ])),
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`h${slot}`, twoSet, slot, slotMain[slot], [
            { stat: "critRate", value: 2.4, mode: "pct" },
            { stat: "critDmg", value: 4.8 + slot, mode: "pct" },
            { stat: "atkPct", value: 6, mode: "pct" },
        ])),
        ...[1, 2, 3, 4, 5, 6].map(slot => disc(`t${slot}`, thirdSet, slot, slotMain[slot], [
            { stat: "critRate", value: 1.2, mode: "pct" },
            { stat: "critDmg", value: 2.4 + slot, mode: "pct" },
            { stat: "atkPct", value: 2, mode: "pct" },
        ])),
        disc("f4-atk", fourSet, 4, { stat: "atkPct", value: 30, mode: "pct" }, [
            { stat: "critDmg", value: 24, mode: "pct" },
            { stat: "atkPct", value: 9, mode: "pct" },
        ]),
    ],
}

function optimizerInput(overrides = {}) {
    const { settings: settingsOverride = {}, ...rest } = overrides
    return {
        agentId: exampleInput.agentId,
        coreSkillLevel: exampleInput.coreSkillLevel,
        wEngineId: exampleInput.wEngineId,
        combatBuffs: {
            activeBuffIds: [],
        },
        damage: exampleInput.damage,
        settings: {
            fourPieceSetId: fourSet,
            objective: "damage",
            ...settingsOverride,
        },
        ...rest,
    }
}

function fourPieceIds(setId) {
    return [`driveDisc4pc:${setId}.self`, `driveDisc4pc:${setId}.team`]
}

function bruteForce(input) {
    const rawTwoPieceSetIds = input.settings.twoPieceSetIds
        ?? input.settings.twoPieceSetId
        ?? []
    const twoPieceSetIds = [
        ...new Set((Array.isArray(rawTwoPieceSetIds) ? rawTwoPieceSetIds : [rawTwoPieceSetIds])
            .map(item => String(item ?? "").trim())
            .filter(Boolean)),
    ]
    const bySlot = [1, 2, 3, 4, 5, 6].map(slot =>
        store.driveDiscs.filter(disc => {
            if (Number(disc.partition) !== slot) {
                return false
            }
            const limits = input.settings.mainStatLimits?.[slot] ?? input.settings.mainStatLimits?.[String(slot)] ?? []
            if (limits.length && !limits.includes(disc.mainStat.stat)) {
                return false
            }
            if (twoPieceSetIds.length) {
                return disc.setId === input.settings.fourPieceSetId || twoPieceSetIds.includes(disc.setId)
            }
            return true
        })
    )
    const results = []
    const selected = []

    function walk(index) {
        if (index === bySlot.length) {
            const counts = selected.reduce((map, item) => map.set(item.setId, (map.get(item.setId) ?? 0) + 1), new Map())
            if ((counts.get(input.settings.fourPieceSetId) ?? 0) < 4) {
                return
            }
            if (twoPieceSetIds.length === 1 && twoPieceSetIds[0] === input.settings.fourPieceSetId && (counts.get(input.settings.fourPieceSetId) ?? 0) < 6) {
                return
            }
            if (twoPieceSetIds.some(setId => setId !== input.settings.fourPieceSetId)
                && !twoPieceSetIds.some(setId => setId !== input.settings.fourPieceSetId && (counts.get(setId) ?? 0) >= 2)) {
                return
            }

            const data = calculateInCombatPanel(catalog, {
                ...input,
                driveDiscs: selected.map(toCalculatorDriveDisc),
                combatBuffs: {
                    ...input.combatBuffs,
                    activeBuffIds: fourPieceIds(input.settings.fourPieceSetId),
                },
            })
            const panel = data.inCombat.panel
            if (input.settings.minimums?.critRate && panel.critRate < input.settings.minimums.critRate / 100) {
                return
            }
            results.push({
                ids: selected.map(item => item.id).join("|"),
                score: data.damage.totalFinalDamage ?? data.damage.finalDamage,
                appliedTwoPieceCount: data.outOfCombat.appliedEffects.filter(item => item.key.endsWith(".twoPiece")).length,
            })
            return
        }

        for (const item of bySlot[index]) {
            selected.push(item)
            walk(index + 1)
            selected.pop()
        }
    }

    walk(0)
    return results
        .sort((left, right) => right.score - left.score || left.ids.localeCompare(right.ids))
        .slice(0, 5)
}

const exact = optimizeDriveDiscs(catalog, store, optimizerInput())
const exactAlias = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { algorithm: "exact" } }))
const exactLegacy = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { algorithm: "exact-legacy" } }))
const exactNoPrune = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { enableUpperBoundPruning: false } }))
const brute = bruteForce(optimizerInput())
assert.equal(exact.metrics.algorithmId, "exact-super-bound")
assert.equal(exact.metrics.algorithmLabel, "精准 · 推荐")
assert.equal(exact.metrics.strictExact, true)
assert.equal(exact.metrics.pruningStrategy, "super-bound")
assert.equal(exact.metrics.processedCombinationCount, exact.metrics.evaluated + exact.metrics.prunedBySuperBound)
assert.equal(exactAlias.metrics.algorithmId, "exact-super-bound")
assert.equal(exactLegacy.metrics.algorithmId, "exact-legacy")
assert.equal(exactLegacy.metrics.strictExact, true)
assert.equal(exact.results.length, brute.length)
assert.equal(exact.results[0].driveDiscs.map(item => item.id).join("|"), brute[0].ids)
assert.ok(Math.abs(exact.results[0].score - brute[0].score) < 1e-9)
assert.deepEqual(
    exact.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    exactLegacy.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
assert.deepEqual(
    exact.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    exactNoPrune.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
assert.equal(exact.metrics.complexity.level, "low")

const customDamageInput = optimizerInput({
    damage: {
        ...exampleInput.damage,
        selectedEventId: "direct-hit",
        events: [
            {
                id: "direct-hit",
                kind: "direct",
                skillMultiplier: 100,
                critMode: "expected",
                count: 2,
            },
            {
                id: "assault-hit",
                kind: "anomaly",
                anomalyEffect: "assault",
                procCount: 1,
                count: 1,
            },
        ],
    },
})
const customDamage = optimizeDriveDiscs(catalog, store, customDamageInput)
const customDamageLegacy = optimizeDriveDiscs(catalog, store, {
    ...customDamageInput,
    settings: {
        ...customDamageInput.settings,
        algorithm: "exact-legacy",
    },
})
const customDamageNoPrune = optimizeDriveDiscs(catalog, store, {
    ...customDamageInput,
    settings: {
        ...customDamageInput.settings,
        enableUpperBoundPruning: false,
    },
})
const customDamageBrute = bruteForce(customDamageInput)
assert.equal(customDamage.results[0].driveDiscs.map(item => item.id).join("|"), customDamageBrute[0].ids)
assert.deepEqual(
    customDamage.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    customDamageLegacy.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
assert.deepEqual(
    customDamage.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    customDamageNoPrune.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
assert.ok(Math.abs(customDamage.results[0].score - customDamage.results[0].data.damage.totalFinalDamage) < 1e-9)
assert.ok(customDamage.results[0].data.damage.totalFinalDamage > customDamage.results[0].data.damage.finalDamage)

const anomalyObjective = optimizeDriveDiscs(catalog, store, optimizerInput({
    damage: {
        agentLevel: 60,
        selectedEventId: "shatter-hit",
        events: [
            {
                id: "shatter-hit",
                kind: "anomaly",
                anomalyEffect: "shatter",
                procCount: 1,
                count: 1,
            },
        ],
    },
}))
assert.ok(anomalyObjective.results.length > 0)
assert.equal(anomalyObjective.results[0].score, anomalyObjective.results[0].data.damage.totalFinalDamage)

const heuristic = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { algorithm: "heuristic-potential" } }))
assert.equal(heuristic.metrics.algorithmId, "heuristic-potential")
assert.equal(heuristic.metrics.strictExact, false)
assert.ok(heuristic.results.length > 0)

const miyabi = catalog.agentsMap.get("hoshimi_miyabi")
assert.ok(miyabi.defaultCalculationConfig, "Miyabi should expose an admin default calculation config")
const miyabiDefaultDamage = calculateInCombatPanel(catalog, {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 1,
    driveDiscs: [],
    combatBuffs: { activeBuffIds: [] },
    damage: miyabi.defaultCalculationConfig,
})
assert.equal(miyabiDefaultDamage.damage.events.length, 7)
const miyabiDisorder = miyabiDefaultDamage.damage.events.find(event => event.id === "miyabi_frozen_disorder")
assert.equal(miyabiDisorder?.kind, "anomaly")
assert.equal(miyabiDisorder?.settlementType, "disorder")
assert.equal(miyabiDisorder?.input?.anomalyEffect, "frost_frozen")
assert.equal(miyabiDisorder?.input?.durationSeconds, 20)
assert.ok(miyabiDefaultDamage.damage.events.some(event => event.id === "miyabi_shatter" && event.kind === "anomaly"))
assert.ok(miyabiDefaultDamage.damage.events.some(event => event.id === "direct-7" && event.input?.skillSource?.moveId === "quick_support_flower_wind"))

const preview = previewDriveDiscOptimization(catalog, store, optimizerInput())
assert.equal(preview.metrics.estimatedCombinationCount, exact.metrics.estimatedCombinationCount)
assert.deepEqual(preview.metrics.candidateCountsBySlot, exact.metrics.candidateCountsBySlot)

const set22Input = optimizerInput({ settings: { twoPieceSetId: twoSet } })
const set22 = optimizeDriveDiscs(catalog, store, set22Input)
const set22Brute = bruteForce(set22Input)
assert.equal(set22.results[0].driveDiscs.map(item => item.id).join("|"), set22Brute[0].ids)
assert.equal(
    set22.results[0].data.outOfCombat.appliedEffects.filter(item => item.key.endsWith(".twoPiece")).length,
    2,
    "4+2 candidates should activate both set 2-piece effects",
)
assert.ok(
    set22.results[0].data.inCombat.activeEffects.some(item => item.key === `driveDisc4pc:${fourSet}.self`),
    "4+2 candidates should automatically apply the wearer 4-piece Buff",
)

const multiTwoPieceInput = optimizerInput({ settings: { twoPieceSetIds: [twoSet, thirdSet] } })
const multiTwoPiece = optimizeDriveDiscs(catalog, store, multiTwoPieceInput)
const multiTwoPieceBrute = bruteForce(multiTwoPieceInput)
assert.equal(multiTwoPiece.results[0].driveDiscs.map(item => item.id).join("|"), multiTwoPieceBrute[0].ids)
assert.deepEqual(multiTwoPiece.settings.twoPieceSetIds, [twoSet, thirdSet])
assert.ok(multiTwoPiece.results.every(result => {
    const counts = result.driveDiscs.reduce((map, item) => map.set(item.setId, (map.get(item.setId) ?? 0) + 1), new Map())
    return (counts.get(fourSet) ?? 0) >= 4
        && ((counts.get(twoSet) ?? 0) >= 2 || (counts.get(thirdSet) ?? 0) >= 2)
}))

const limitedInput = optimizerInput({
    settings: {
        mainStatLimits: {
            4: ["critRate"],
        },
        minimums: {
            critRate: 50,
        },
    },
})
const limited = optimizeDriveDiscs(catalog, store, limitedInput)
assert.ok(limited.results.length > 0)
assert.ok(limited.results.every(result => result.driveDiscs.find(disc => disc.partition === 4).mainStat.stat === "critRate"))
assert.ok(limited.results.every(result => result.data.inCombat.panel.critRate >= 0.5))

const preferredCatalog = {
    ...catalog,
    agents: catalog.agents.map(agent => agent.id === exampleInput.agentId
        ? {
            ...agent,
            preferredDriveDiscs: {
                mainStatLimits: {
                    4: ["critRate"],
                },
            },
        }
        : agent),
}
preferredCatalog.agentsMap = new Map(preferredCatalog.agents.map(agent => [agent.id, agent]))
const preferredLimited = optimizeDriveDiscs(preferredCatalog, store, optimizerInput())
assert.ok(preferredLimited.results.length > 0)
assert.ok(preferredLimited.results.every(result => result.driveDiscs.find(disc => disc.partition === 4).mainStat.stat === "critRate"))
assert.equal(preferredLimited.settings.preferredMainStatLimits["4"][0], "critRate")
const explicitOverridesPreferred = optimizeDriveDiscs(preferredCatalog, store, optimizerInput({
    settings: {
        mainStatLimits: {
            4: ["atkPct"],
        },
    },
}))
assert.ok(explicitOverridesPreferred.results.length > 0)
assert.ok(explicitOverridesPreferred.results.every(result => result.driveDiscs.find(disc => disc.partition === 4).mainStat.stat === "atkPct"))

const allSame = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { twoPieceSetId: fourSet } }))
assert.ok(allSame.results.length > 0)
assert.equal(
    allSame.results[0].data.outOfCombat.appliedEffects.filter(item => item.key === `${fourSet}.twoPiece`).length,
    1,
    "6 same-set discs should activate the 2-piece effect only once",
)

const noResult = optimizeDriveDiscs(catalog, store, optimizerInput({ settings: { fourPieceSetId: "shadow_harmony" } }))
assert.equal(noResult.results.length, 0)
assert.equal(noResult.error.isError, true)

const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-loadout-"))
const saved = await upsertDriveDiscLoadout(tempDir, {
    agentId: "ye_shunguang",
    name: "测试套装",
    driveDiscIdsBySlot: {
        1: "f1",
        2: "f2",
        3: "f3",
        4: "f4",
        5: "f5",
        6: "f6",
    },
})
assert.equal(saved.loadout.agentId, "ye_shunguang")
assert.equal((await loadUserDriveDiscStore(tempDir)).driveDiscLoadouts.length, 1)
const deleted = await deleteDriveDiscLoadout(tempDir, saved.loadout.id)
assert.equal(deleted.deleted, true)
assert.equal((await loadUserDriveDiscStore(tempDir)).driveDiscLoadouts.length, 0)

await upsertDriveDiscLoadout(tempDir, {
    agentId: "ye_shunguang",
    name: "待清空套装",
    driveDiscIdsBySlot: {
        1: "f1",
        2: "f2",
        3: "f3",
        4: "f4",
        5: "f5",
        6: "f6",
    },
})
const cleared = await clearUserDriveDiscStore(tempDir)
assert.deepEqual(cleared.previous, {
    imports: 0,
    driveDiscs: 0,
    driveDiscLoadouts: 1,
})
assert.equal(cleared.store.owners.length, 1)
assert.equal(cleared.store.driveDiscLoadouts.length, 0)
assert.equal(cleared.store.driveDiscs.length, 0)
assert.equal(cleared.store.imports.length, 0)
