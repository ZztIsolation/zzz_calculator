import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { expandCalculationEvents } from "../core/calculationSkillGroups.js"
import { resolveDefaultCalculationConfig } from "../core/defaultCalculationConfig.js"

const readCatalog = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"))
const agent = readCatalog("agents").agents.find(entry => entry.id === "sunbringer")
const skills = readCatalog("agent_skills").agentSkills.find(entry => entry.agentId === "sunbringer")
assert.ok(agent?.defaultCalculationConfig, "挽昼应有管理员默认轴")
assert.ok(skills, "挽昼应有技能表")

function rotation(cinema, toggleExtraMaim = false) {
    const config = resolveDefaultCalculationConfig(agent.defaultCalculationConfig, cinema)
    if (toggleExtraMaim) {
        const adjustable = config.events.find(event => event.skillGroupId === "variable_maim")
        assert.ok(adjustable, "单投轮内的一次毁伤应能单独切换失衡状态")
        adjustable.stunned = true
    }
    return expandCalculationEvents(config.events, agent, { strict: true }).events
}

function hits(events, move, row, stunned) {
    return events.filter(event => event.skillRef.moveId === move && event.skillRef.rowId === row
        && (stunned === undefined || event.stunned === stunned))
        .reduce((total, event) => total + event.count, 0)
}

const single = rotation(0)
const double = rotation(2)
assert.deepEqual(rotation(1), single)
assert.deepEqual(rotation(6), double)
for (const event of double.concat(single)) {
    const { agentSkillId, categoryId, moveId, rowId } = event.skillRef
    assert.equal(agentSkillId, "sunbringer")
    assert.equal(event.kind, "sharp")
    const category = skills.categories.find(item => item.id === categoryId)
    const move = category?.moves.find(item => item.id === moveId)
    assert.equal(move?.rows.find(item => item.id === rowId)?.kind, "damageMultiplier", `${categoryId}/${moveId}/${rowId}`)
}
for (const [cinema, totalMaims, stunnedMaims, count] of [[0, 3, 1, 3], [2, 9, 4, 6]]) {
    const base = rotation(cinema)
    const alternate = rotation(cinema, true)
    assert.equal(hits(base, "move_1601001", "maim"), totalMaims)
    assert.equal(hits(base, "move_1601001", "maim", true), stunnedMaims)
    assert.equal(hits(alternate, "move_1601001", "maim"), totalMaims)
    assert.equal(hits(alternate, "move_1601001", "maim", true), stunnedMaims + 1)
    for (const row of ["damage_1", "damage_2", "damage_3", "damage_4"]) {
        assert.equal(hits(base, "move_1601001", row, false), count)
    }
    assert.equal(base.at(-1).skillRef.moveId, "move_1601021", "轴尾此愿应结清累计烬痕")
}

const stunnedMoves = double.filter(event => event.stunned && event.skillRef.rowId !== "maim")
    .flatMap(event => Array(event.count).fill(event.skillRef.moveId))
assert.deepEqual(stunnedMoves, [
    "move_1601004", "move_1601009", "move_1601012", "move_1601018", "move_1601004", "move_1601020", "move_1601021",
    "move_1601004", "move_1601009", "move_1601018", "move_1601020", "move_1601018", "move_1601011", "move_1601021",
])
assert.equal(hits(double, "move_1601009", "damage", false), 1, "第二轮失衡前只有黄星")
assert.equal(hits(double, "move_1601012", "damage", false), 0)
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
