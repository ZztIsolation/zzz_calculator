import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { expandCalculationEvents } from "../core/calculationSkillGroups.js"
import { resolveDefaultCalculationConfig } from "../core/defaultCalculationConfig.js"

const readCatalog = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"))
const agent = readCatalog("agents").agents.find(entry => entry.id === "sunbringer")
const skills = readCatalog("agent_skills").agentSkills.find(entry => entry.agentId === "sunbringer")
assert.ok(agent?.defaultCalculationConfig, "挽昼应有管理员默认轴")
assert.ok(skills, "挽昼应有技能表")

function rotation(cinema) {
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, cinema)
    return expandCalculationEvents(config.events, agent, { strict: true }).events
}

for (let cinema = 0; cinema <= 6; cinema++) {
    const events = rotation(cinema)
    const openingRelease = cinema === 6 ? "1601021" : "1601012"
    assert.deepEqual(events.map(event => event.skillRef.moveId.slice(5)), [
        "1601004", "1601009", openingRelease, "1601018", "1601001",
        "1601004", "1601009", "1601020", "1601021",
    ])
    assert.deepEqual(events.map(event => event.count), [1, 1, 1, 1, 3, 1, 1, 1, 1])
    assert.equal(events[4].skillRef.rowId, "maim", "连携后三次毁伤应参与第二次结算")
    for (const event of events) {
        assert.equal(event.stunned, true)
        assert.equal(event.kind, "sharp")
        const { agentSkillId, categoryId, moveId, rowId } = event.skillRef
        assert.equal(agentSkillId, "sunbringer")
        const move = skills.categories.find(item => item.id === categoryId)?.moves.find(item => item.id === moveId)
        assert.equal(move?.rows.find(item => item.id === rowId)?.kind, "damageMultiplier")
    }
}
const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
for (const cinemaLevel of [0, 2, 4, 6]) {
    const events = rotation(cinemaLevel)
    const request = {
        agentId: agent.id, cinemaLevel, coreSkillLevel: "F", wEngineId: "dragonfire_mirage", driveDiscs: [],
        damage: { mode: "custom", selectedEventId: events[0].id, events },
    }
    const result = calculateInCombatPanel(catalog, request).damage
    const hits = result.events.filter(event => event.kind === "sharp").map(event => event.finalDamage)
    const releases = result.events.filter(event => event.kind === "emberSettlement")
    const mainRate = cinemaLevel >= 2 ? .81 : .60
    const openingRate = cinemaLevel >= 4 ? 1.20 : mainRate
    const first = mainRate * (hits[0] + hits[1]) + openingRate * hits[2]
    const second = (cinemaLevel >= 2 ? .405 * hits[3] + .54 * hits[4] : .40 * hits[4])
        + mainRate * (hits[5] + hits[6] + hits[7] + hits[8])
    const expected = cinemaLevel === 6
        ? [first, .80 * openingRate * hits[2], second, .80 * mainRate * hits[8]] : [first, second]
    assert.equal(result.ember.pendingDamage, 0)
    assert.equal(releases.length, expected.length)
    expected.forEach((value, index) => {
        assert.ok(value > 0 && Math.abs(releases[index].finalDamage - value) < value * 1e-9,
            `影画 ${cinemaLevel} 第 ${index + 1} 次烬灭的积攒来源不符`)
    })
}
// A release followed by a fresh deposit must carry its tail across the group boundary.
const source = {
    ...agent,
    skillGroups: [{
        id: "release-then-tail",
        orderSensitive: true,
        events: [
            { id: "red", kind: "sharp", skillRef: { moveId: "move_1601012" } },
            { id: "spear", kind: "sharp", skillRef: { moveId: "move_1601004" } },
            { id: "wish", kind: "sharp", skillRef: { moveId: "move_1601021" } },
            { id: "ordinary", kind: "sharp", skillRef: { moveId: "move_1601001" } },
        ],
    }],
}
function repeated(count) {
    return expandCalculationEvents([{ id: "ordered", kind: "skillGroup", skillGroupId: "release-then-tail", count }], source)
}
const pair = repeated(2)
assert.deepEqual(pair.events.map(event => event.skillRef.moveId),
    Array(2).fill(source.skillGroups[0].events.map(event => event.skillRef.moveId)).flat())
assert.equal(new Set(pair.events.map(event => event.id)).size, pair.events.length)
assert.deepEqual(expandCalculationEvents(pair.events, source, { selectedEventId: pair.selectedEventId }), pair,
    "前端预展开再进入核心时，事件顺序、次数和所选行保持一致")

// Use whole numbers as independent deposits. Two different releases also test attribution.
function deposits(events) {
    let pending = 0
    const settlement = { red: 0, wish: 0 }
    for (const event of events) {
        const move = event.skillRef.moveId
        pending += event.count * ({ move_1601012: 2, move_1601004: 5, move_1601021: 3, move_1601001: 7 })[move]
        if (move === "move_1601012" || move === "move_1601021") {
            settlement[move === "move_1601012" ? "red" : "wish"] += pending
            pending = 0
        }
    }
    return { ...settlement, pending }
}
const million = repeated(1_000_000)
assert.ok(million.events.length < 60, "重复次数不应线性增加内存")
assert.deepEqual(deposits(million.events), { red: 8_999_993, wish: 8_000_000, pending: 7 })
assert.deepEqual(deposits(repeated(2.5).events), { red: 15.5, wish: 20, pending: 7 })
assert.deepEqual(deposits(repeated(0.5).events), { red: 1, wish: 4, pending: 3.5 })
source.skillGroups[0].events.push({ ...source.skillGroups[0].events.at(-1), id: "second-tail" })
const explicit = Array.from({ length: 65 }, () => repeated(1).events).flat()
assert.deepEqual(deposits(repeated(65).events), deposits(explicit), "多个末尾命中的烬痕按原顺序留到下一轮")
console.log("sunbringer rotation tests passed")
