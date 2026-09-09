import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCatalog,
} from "../backend/calculator.js"
import {
    sharpCritBreakdown,
    sharpOverflowDamageBonus,
} from "../core/sharpDamage.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCatalog(path.join(rootDir, "data"), path.join(rootDir, "examples"))
const claret = catalog.agentsMap.get("claret")

function approx(actual, expected, label, epsilon = 1e-10) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon * Math.max(1, Math.abs(Number(expected))), `${label}: expected ${expected}, got ${actual}`)
}

for (const [percent, expectedP1, expectedP2] of [
    [0, 0, 0],
    [50, 0.5, 0],
    [100, 1, 0],
    [132.3, 1, 0.323],
    [150, 1, 0.5],
    [200, 1, 1],
    [220, 1, 1],
]) {
    const breakdown = sharpCritBreakdown({
        panel: { critRate: percent / 100, lacerationDmg: 1.5 },
        outOfCombatPanel: { critDmg: 0 },
    })
    approx(breakdown.effectiveCritRate, Math.min(percent / 100, 2), `sharp CR ${percent}`)
    approx(breakdown.p1, expectedP1, `sharp p1 ${percent}`)
    approx(breakdown.p2, expectedP2, `sharp p2 ${percent}`)
    assert.ok(breakdown.p2 <= 1, `sharp CR ${percent} must have at most a second check`)
    approx(breakdown.modes.nonCrit, 1, `sharp nonCrit ${percent}`)
    approx(breakdown.modes.sharpCrit, 2.5, `sharpCrit ${percent}`)
    approx(breakdown.modes.lacerationCrit, 6.25, `lacerationCrit ${percent}`)
    if (percent === 132.3) approx(breakdown.expected, 2.5 * (1 + 0.323 * 1.5), "figure formula")
    if (percent === 220) approx(breakdown.expected, 6.25, "sharp cap")
}

const marrowOverflow = sharpOverflowDamageBonus({
    effectiveCritRate: 1.188,
    eventTotals: { sharpOverflowPerCritRate: 0.008, sharpOverflowCap: 0.4 },
})
approx(marrowOverflow.value, 0.1504, "Blood Marrow overflow")

assert.equal(claret.specialty, "armorer")
assert.deepEqual(claret.level60, {
    hpBase: 5651,
    atkBase: 626,
    defBase: 441,
    critRate: 22.5,
    critDmg: 50,
    lacerationDmg: 150,
    impact: 93,
    anomalyProficiency: 79,
    anomalyMastery: 80,
    energyRegen: 100,
    penRatio: 0,
})
assert.equal(catalog.agentSkillsMap.get("claret").categories.flatMap(category => category.moves).length, 19)
assert.equal(catalog.agentSkillsMap.get("claret").categories.flatMap(category => category.moves).filter(move => move.damageKind === "sharp").length, 17)
for (const id of ["zzz_wiki_2188", "zzz_wiki_2189", "zzz_wiki_2190", "zzz_wiki_2200"]) {
    const engine = catalog.wEnginesMap.get(id)
    assert.equal(Number(engine.level60.defBase) > 0, true, `${id} should use DEF base`)
    assert.equal(engine.level60.atkBase, undefined, `${id} must not disguise DEF as ATK`)
}

function sharpInput(wEngineId, damage = claret.defaultCalculationConfig, extra = {}) {
    return {
        agentId: "claret",
        wEngineId,
        wEngineModificationLevel: 5,
        coreSkillLevel: "F",
        cinemaLevel: extra.cinemaLevel ?? 0,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: [
                "agent:claret.corePassive",
                "agent:claret.additionalAbility",
                `wEngine:${wEngineId}.self`,
                ...(extra.cinemaLevel ? [`agent:claret.cinema.${extra.cinemaLevel}`] : []),
            ],
        },
        damage,
    }
}

const marrow = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2189"))
const marrowEvent = marrow.damage.events[0]
approx(marrowEvent.sharp.crit.effectiveCritRate, 1.188, "marrow effective CR")
approx(marrowEvent.sharp.crit.overflowValue, 0.1504, "marrow dynamic bonus")
const scarlet = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188"))
assert.equal(scarlet.outOfCombat.base.def, 872)
assert.equal(scarlet.outOfCombat.baseBreakdown.wEngine.def, 431)
assert.equal(scarlet.outOfCombat.baseBreakdown.wEngine.atk, 0)

const c1 = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", claret.defaultCalculationConfig, { cinemaLevel: 1 }))
assert.equal(c1.damage.events[2].multipliers.maimMultiplier, 1.3)

const c2Crimson = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2188", claret.defaultCalculationConfig, { cinemaLevel: 2 }),
})
assert.equal(c2Crimson.damage.events[0].multipliers.resistance, 1.18, "C2 applies to Crimson sharp damage")
const c2Plain = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2188", {
        mode: "custom",
        events: [{
            id: "plain",
            kind: "sharp",
            skillRef: {
                agentSkillId: "claret",
                categoryId: "basic",
                moveId: "basic_blood_forge",
                rowId: "hit_1",
            },
            sharpScenario: { crimsonInscription: false, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "plain",
    }, { cinemaLevel: 2 }),
})
assert.equal(c2Plain.damage.events[0].multipliers.resistance, 1, "C2 does not affect plain non-Crimson basic sharp damage")

const luckyReady = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2200"),
    damage: {
        mode: "custom",
        events: [{
            id: "ready",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpScenario: { triggeredEngineEffects: true, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "ready",
    },
})
const luckyUntriggered = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2200"),
    damage: {
        mode: "custom",
        events: [{
            id: "ready",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpScenario: { triggeredEngineEffects: false, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "ready",
    },
})
approx(luckyReady.inCombat.panel.def, (441 + 356) * (1 + 0.4 + 0.12), "Lucky Paw permanent DEF")
approx(luckyReady.damage.events[0].multipliers.damageBasisValue, luckyReady.inCombat.panel.def + (441 + 356) * 0.12, "Lucky Paw triggered DEF")
approx(luckyUntriggered.damage.events[0].multipliers.damageBasisValue, luckyUntriggered.inCombat.panel.def, "Lucky Paw untriggered DEF")

const chainWithoutCrimson = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2189"),
    damage: {
        mode: "custom",
        events: [{
            id: "chain",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            skillSource: { skillType: "chain", moveId: "ultimate_hundred_hammers" },
            sharpScenario: { crimsonInscription: false, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "chain",
    },
})
assert.ok(chainWithoutCrimson.damage.events[0].multipliers.critRate > 0.8, "chain keeps the core sharp CR bonus outside Crimson Inscription")

const noGash = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2189"),
    damage: {
        mode: "custom",
        events: [{
            id: "empty-gash",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpComponent: "maim",
            maimTrigger: "gash",
            sharpScenario: { crimsonInscription: true, gashStacks: 0 },
            count: 1,
        }],
        selectedEventId: "empty-gash",
    },
})
assert.equal(noGash.damage.events[0].multipliers.gashActive, false)
assert.equal(noGash.damage.events[0].finalDamage, 0)

const calculator = createInCombatPanelCalculator(catalog, sharpInput("zzz_wiki_2189"))
const legacy = calculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
const compiled = calculator.scoreOnlyFromSummary(new Map(), new Map())
const statIds = ["defFlat", "defPct", "critRate", "critDmg"]
const denseTarget = calculator.compileDensePanelScoreTarget({ statIds, setIds: [] })
const dense = denseTarget.scoreDense(new Float64Array(statIds.length), new Int16Array())
const fixed = denseTarget.compileForSetCounts(new Int16Array()).scoreScalar(new Float64Array(statIds.length))
approx(compiled.finalDamage, legacy.finalDamage, "compiled versus legacy")
approx(dense.finalDamage, legacy.finalDamage, "dense versus legacy")
approx(fixed.finalDamage, legacy.finalDamage, "fixed versus legacy")

const ordinary = calculateInCombatPanel(catalog, {
    agentId: "soldier_11",
    wEngineId: "zzz_wiki_223",
    wEngineModificationLevel: 1,
    coreSkillLevel: "F",
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: ["agent:soldier_11.corePassive"],
        manualStats: [{ stat: "critRate", value: 150, mode: "flat" }],
    },
    damage: {
        mode: "custom",
        events: [{
            id: "ordinary",
            kind: "direct",
            skillMultiplier: 100,
            damageElement: "fire",
            critMode: "expected",
            count: 1,
            stunned: true,
        }],
        selectedEventId: "ordinary",
    },
})
assert.equal(ordinary.damage.events[0].multipliers.critRate, 1, "ordinary CR remains capped at 100%")

console.log("sharp damage tests passed")
