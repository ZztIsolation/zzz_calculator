import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, createInCombatPanelCalculator, loadCalculatorContext } from "../backend/calculator.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const agentId = "sunbringer"
const moves = {
    spear: ["basic", "1601004", "damage"],
    maim: ["basic", "1601001", "maim"],
    ordinary: ["basic", "1601001", "damage_1"],
    red: ["special", "1601012", "damage"],
    wish: ["chain", "1601021", "damage"],
}

function close(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
        `${label}: expected ${expected}, got ${actual}`)
}

function hit(name, options = {}) {
    const [categoryId, move, rowId] = moves[name]
    return {
        id: name, kind: "sharp", critMode: "nonCrit", count: 1, stunned: false,
        skillRef: { agentSkillId: agentId, categoryId, moveId: "move_" + move, rowId },
        ...options,
    }
}

function input(cinemaLevel, events) {
    return {
        agentId, wEngineId: "demara_battery_mark_ii", cinemaLevel, coreSkillLevel: "F", driveDiscs: [],
        skillLevelsByCategory: { basic: 12, special: 12, chain: 12 },
        combatBuffs: { activeBuffIds: [1, 2, 4, 6]
            .filter(level => level <= cinemaLevel).map(level => `agent:${agentId}.cinema.${level}`) },
        damage: {
            mode: "custom", agentLevel: 60, selectedEventId: events[0].id, events,
            target: { defense: 0, levelCoefficient: 794, resistance: 0, stunMultiplierPercent: 150 },
        },
    }
}

const assists = ["1601025", "1601026", "1601028"].map(id =>
    hit("ordinary", { id, skillRef: { agentSkillId: agentId, categoryId: "assist", moveId: "move_" + id, rowId: "damage" } }))
const fighter = input(0, assists)
fighter.damage.target.defense = 953
fighter.combatBuffs.activeBuffIds = ["agent:sunbringer.corePassive"]
for (const [coreSkillLevel, critRate, ignore] of [["none", .22, .11], ["F", .40, .20]]) {
    const build = calculateInCombatPanel(catalog, { ...fighter, coreSkillLevel })
    const baseRate = .05 + (coreSkillLevel === "F" ? .288 : 0) + .50 * .35
    close(build.outOfCombat.panel.critRate, baseRate, "initial CRIT conversion " + coreSkillLevel)
    close(build.inCombat.panel.critRate, baseRate + critRate, "polar state CRIT " + coreSkillLevel)
    close(build.inCombat.panel.lacerationDmg, 1.50, "unaccompanied laceration damage")
    const hits = build.damage.events.filter(event => event.kind === "sharp")
    assert.deepEqual(hits.map(event => event.multipliers.damage), [1.2, 1.2, 1],
        "only the two named assist follow-ups receive +20%")
    close(hits[0].multipliers.defense, 794 / (794 + 953 * (1 - ignore)), "polar defense ignore " + coreSkillLevel)
}

// Build an independent oracle from the V5 level-12 Nanoka multipliers.
// No skippable live-state buffs, enemy defense or teammate multipliers enter these examples.
function directValues(cinema, defense = 441) {
    const unit = defense * (cinema >= 1 ? 1.15 : 1) * (cinema >= 4 ? 1.1 : 1)
    return {
        spear: unit * 19.618, maim: unit * 1.619, ordinary: unit * 1.667,
        red: unit * 16.83, wish: unit * 23.076,
    }
}

function verify(cinema, events, expected, label) {
    const request = input(cinema, events)
    const result = calculateInCombatPanel(catalog, request).damage
    const [direct, settled, pending] = expected(directValues(cinema))
    assert.ok(result.ember, `${label}: missing ember breakdown`)
    close(result.ember.directDamage, direct, label + " direct")
    close(result.ember.settledDamage, settled, label + " settled")
    close(result.ember.pendingDamage, pending, label + " pending")
    close(result.totalFinalDamage, direct + settled, label + " total")
    const settlements = result.events.filter(event => event.kind === "emberSettlement")
    close(settlements.reduce((sum, event) => sum + event.finalDamage, 0), settled, label + " settlement rows")
    if (!settled) assert.equal(settlements.length, 0, label + " no premature settlement")

    // Compare each scoring entry point to the external oracle with two real stat candidates.
    const calculator = createInCombatPanelCalculator(catalog, request)
    const statIds = ["defFlat"]
    const setCounts = new Int16Array(0)
    const dense = calculator.compileDensePanelScoreTarget({ statIds, setIds: [] })
    const fixed = dense.compileForSetCounts(setCounts)
    for (const extra of [0, 83]) {
        const values = Float64Array.of(extra), totals = new Map([["defFlat", extra]])
        const [base, release] = expected(directValues(cinema, 441 + extra))
        const wanted = base + release
        const scores = {
            prepared: calculator.scoreOnlyFromSummaryLegacy(totals, new Map()),
            compiled: calculator.scoreOnlyFromSummary(totals, new Map()),
            indexed: calculator.scoreOnlyFromIndexedSummary(values, statIds, setCounts, [], new Map()),
            dense: dense.scoreDense(values, setCounts),
            fixed: fixed.scoreScalar(values),
            objective: fixed.scoreObjectiveScalar(values),
            combined: fixed.scoreCombinedScalar(values, null, null, null),
        }
        for (const [path, summary] of Object.entries(scores))
            close(summary.finalDamage, wanted, `${label} ${path} DEF+${extra}`)
    }
}

verify(0, [hit("spear"), hit("maim", { count: 3 }), hit("ordinary")], d =>
    [d.spear + 3 * d.maim + d.ordinary, 0, .60 * d.spear + .40 * 3 * d.maim],
"an unfinished sequence retains its ember")

for (const cinema of [0, 2]) {
    const featured = cinema === 2 ? .81 : .60
    const maim = cinema === 2 ? .54 : .40
    const ordinary = cinema === 2 ? .405 : 0
    verify(cinema, [hit("spear", { stunned: true }), hit("maim", { count: 3 }), hit("red"), hit("ordinary")], d =>
        [1.5 * d.spear + 3 * d.maim + d.red + d.ordinary,
            featured * (1.5 * d.spear + d.red) + maim * 3 * d.maim, ordinary * d.ordinary],
    "red settles the actual prior hit values at M" + cinema)
}

verify(4, [hit("red"), hit("spear"), hit("wish"), hit("red", { id: "red-again" })], d =>
    [2 * d.red + d.spear + d.wish, .81 * (2 * d.red + d.spear) + 1.20 * d.wish, 0],
"the one-time M4 bonus is armed by the first spear and consumed by the next qualifying finisher")

verify(4, [hit("spear"), hit("wish", { count: 2 })], d =>
    [d.spear + 2 * d.wish, .81 * d.spear + (1.20 + .81) * d.wish, 0],
"two casts in one row consume the M4 bonus once")

verify(6, [hit("spear"), hit("ordinary"), hit("maim", { count: 3 }), hit("wish"), hit("red")], d =>
    [d.spear + d.ordinary + 3 * d.maim + d.wish + d.red,
        .81 * (d.spear + d.red) + .405 * d.ordinary + .54 * 3 * d.maim + 1.20 * d.wish * 1.80, 0],
"M6 echoes only the local deposit from this wish")

console.log("sunbringer damage and optimizer scoring passed")
