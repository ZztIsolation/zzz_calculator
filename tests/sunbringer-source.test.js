import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

function readJson(path) {
    return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
}

const { agentSkills } = readJson("../data/agent_skills.json")
const catalog = agentSkills.find(agent => agent.id === "sunbringer")
const version = catalog.verification.sourceVersion
const snapshot = readJson(`../docs/sources/sunbringer-nanoka-${version}.json`)
assert.equal(snapshot.id, catalog.verification.sourceId)
let valuesChecked = 0
for (const [categoryId, source] of Object.entries(snapshot.skill)) {
    const category = catalog.categories.find(item => item.id === categoryId)
    const moves = source.description.filter(item => item.param)
    assert.equal(category.moves.length, moves.length, categoryId)
    for (const move of moves) {
        const moveId = Object.keys(snapshot.skill_list).find(id => snapshot.skill_list[id].name === move.name)
        const entry = category.moves.find(item => item.id === "move_" + moveId)
        assert.ok(entry, move.name)
        assert.equal(entry.rows.length, move.param.length, move.name)
        for (const sourceRow of move.param) {
            const label = move.name + " / " + sourceRow.name
            const row = entry.rows.find(item => item.label.zhCN === sourceRow.name)
            assert.ok(row, label)
            let expected
            if (row.kind === "energyCost") {
                assert.match(sourceRow.desc, /^\d+点$/, label)
                expected = Array(16).fill(parseInt(sourceRow.desc, 10))
            } else {
                const params = Object.values(sourceRow.param)
                assert.equal(params.length, 1, label)
                const [param] = params
                assert.equal(param.format, "%", label)
                expected = Array.from({ length: 16 }, (_, level) => (param.main + param.growth * level) / 100)
            }
            assert.deepEqual(row.values, expected, label)
            valuesChecked += expected.length
        }
    }
}
console.log(`Nanoka ${version}: ${valuesChecked} Sunbringer skill values verified`)
