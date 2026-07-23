import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
    SKILL_TAG_VALUES,
    SKILL_TYPE_VALUES,
    legacySkillTypeForMove,
    normalizeSkillTarget,
    normalizeSkillTargetsInValue,
    skillTargetMatches,
    skillTagsForMove,
    skillTypeForMove,
    unknownLegacySkillTargetPrefixes,
} from "../core/skillTargets.js"

assert.equal(skillTypeForMove({ id: "chain" }, { id: "chain_test" }), "")
assert.equal(skillTypeForMove({ id: "chain" }, { id: "ultimate_test" }), "")
assert.equal(legacySkillTypeForMove({ id: "chain" }, { id: "chain_test" }), "chain")
assert.equal(legacySkillTypeForMove({ id: "chain" }, { id: "ultimate_test" }), "ultimate")
assert.equal(skillTypeForMove({ id: "special" }, { id: "ex_test", skillType: "special" }), "special")
assert.equal(skillTypeForMove({ id: "chain" }, { id: "ultimate_misleading", skillType: "chain" }), "chain")

assert.deepEqual(normalizeSkillTarget({ categoryId: "chain", moveIdPrefixes: ["chain_"] }), [
    { kind: "skillType", skillType: "chain" },
])
assert.deepEqual(normalizeSkillTarget({ categoryId: "chain", moveIdPrefixes: ["ultimate_"] }), [
    { kind: "skillType", skillType: "ultimate" },
])
assert.deepEqual(normalizeSkillTarget({ agentSkillId: "agent_a", categoryId: "chain" }), [
    { kind: "specific", agentSkillId: "agent_a", categoryId: "chain", skillType: "chain" },
    { kind: "specific", agentSkillId: "agent_a", categoryId: "chain", skillType: "ultimate" },
])

const unknownLegacy = { categoryId: "chain", moveIdPrefixes: ["future_"] }
assert.deepEqual(normalizeSkillTarget(unknownLegacy), [unknownLegacy])
assert.deepEqual(unknownLegacySkillTargetPrefixes(unknownLegacy), ["future_"])
assert.equal(skillTargetMatches(
    unknownLegacy,
    { agentSkillId: "agent_a", categoryId: "chain", moveId: "future_finisher", rowId: "damage", skillType: "ultimate" },
), true)

const migrated = normalizeSkillTargetsInValue({
    effects: [{
        target: {
            kind: "skill",
            skillTargets: [
                { categoryId: "chain", moveIdPrefixes: ["chain_"] },
                { categoryId: "chain", moveIdPrefixes: ["ultimate_"] },
            ],
        },
    }],
})
assert.deepEqual(migrated.effects[0].target.skillTargets, [
    { kind: "skillType", skillType: "chain" },
    { kind: "skillType", skillType: "ultimate" },
])
assert.equal(JSON.stringify(migrated).includes("moveIdPrefixes"), false)

const chainSource = { agentSkillId: "agent_a", categoryId: "chain", moveId: "chain_test", rowId: "damage", skillType: "chain" }
const ultimateSource = { agentSkillId: "agent_a", categoryId: "chain", moveId: "ultimate_test", rowId: "damage", skillType: "ultimate" }
assert.equal(skillTargetMatches({ kind: "skillType", skillType: "chain" }, chainSource), true)
assert.equal(skillTargetMatches({ kind: "skillType", skillType: "chain" }, ultimateSource), false)
assert.equal(skillTargetMatches({ kind: "skillType", skillType: "ultimate" }, ultimateSource), true)
const dashSource = { agentSkillId: "agent_a", categoryId: "dodge", moveId: "dash_test", rowId: "damage", skillType: "dodge", skillTags: ["dashAttack"] }
const dodgeCounterSource = { ...dashSource, moveId: "dodge_counter_test", skillTags: [] }
const exSpecialSource = { agentSkillId: "agent_a", categoryId: "special", moveId: "ex_test", rowId: "damage", skillType: "special", skillTags: ["exSpecial"] }
const normalSpecialSource = { ...exSpecialSource, moveId: "normal_special_test", skillTags: [] }
const assistAttackSource = { agentSkillId: "agent_a", categoryId: "assist", moveId: "quick_assist_test", rowId: "damage", skillType: "assist", skillTags: ["assistAttack"] }
const supportActionSource = { ...assistAttackSource, moveId: "defensive_assist_test", skillTags: [] }
assert.deepEqual(normalizeSkillTarget({ kind: "skillTag", skillTag: "dashAttack" }), [{ kind: "skillTag", skillTag: "dashAttack" }])
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "dashAttack" }, dashSource), true)
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "dashAttack" }, dodgeCounterSource), false)
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "exSpecial" }, exSpecialSource), true)
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "exSpecial" }, normalSpecialSource), false)
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "assistAttack" }, assistAttackSource), true)
assert.equal(skillTargetMatches({ kind: "skillTag", skillTag: "assistAttack" }, supportActionSource), false)
assert.deepEqual(skillTagsForMove({ skillTags: ["dashAttack", "dashAttack", "unknown"] }), ["dashAttack"])
assert.equal(skillTargetMatches({ categoryId: "chain", moveIdPrefixes: ["ultimate_"] }, ultimateSource), true)
assert.equal(skillTargetMatches({ categoryId: "chain", moveIdPrefixes: ["ultimate_"] }, chainSource), false)
assert.equal(skillTargetMatches(
    { categoryId: "chain", moveIdPrefixes: ["ultimate_"] },
    { ...ultimateSource, moveId: "finisher_without_prefix" },
), true)

const wholeSpecificType = { kind: "specific", agentSkillId: "agent_a", categoryId: "chain", skillType: "ultimate" }
assert.equal(skillTargetMatches(wholeSpecificType, ultimateSource), true)
assert.equal(skillTargetMatches(wholeSpecificType, { ...ultimateSource, agentSkillId: "agent_b" }), false)
assert.equal(skillTargetMatches({ ...wholeSpecificType, moveId: "ultimate_test", rowId: "damage" }, ultimateSource), true)
assert.equal(skillTargetMatches({ ...wholeSpecificType, moveId: "ultimate_test", rowId: "other" }, ultimateSource), false)

const skillCatalog = JSON.parse(readFileSync(new URL("../data/agent_skills.json", import.meta.url), "utf8")).agentSkills
const dataRoots = [
    JSON.parse(readFileSync(new URL("../data/agents.json", import.meta.url), "utf8")),
    JSON.parse(readFileSync(new URL("../data/combat_buffs.json", import.meta.url), "utf8")),
]
const skillsById = new Map(skillCatalog.map(skill => [skill.id, skill]))
let moveCount = 0
let rowCount = 0
const skillTagCounts = new Map()
for (const skill of skillCatalog) {
    const typeOwners = new Map()
    for (const category of skill.categories ?? []) {
        for (const move of category.moves ?? []) {
            moveCount += 1
            assert.ok(SKILL_TYPE_VALUES.has(move.skillType), `${skill.id}.${category.id}.${move.id} must have an explicit skillType`)
            for (const tag of move.skillTags ?? []) {
                assert.ok(SKILL_TAG_VALUES.has(tag), `${skill.id}.${category.id}.${move.id} has an invalid skill tag`)
                skillTagCounts.set(tag, (skillTagCounts.get(tag) ?? 0) + 1)
            }
            assert.equal(new Set(move.skillTags ?? []).size, (move.skillTags ?? []).length, `${skill.id}.${category.id}.${move.id} must not repeat skill tags`)
            const owner = typeOwners.get(move.skillType)
            assert.ok(!owner || owner === category.id, `${skill.id}.${move.skillType} must belong to one category`)
            typeOwners.set(move.skillType, category.id)
            for (const row of move.rows ?? []) {
                rowCount += 1
                assert.ok(row.id, `${skill.id}.${category.id}.${move.id} must not contain an empty row id`)
            }
        }
    }
}

const storedTargets = []
function collectSkillTargets(value, path = "data") {
    if (Array.isArray(value)) {
        value.forEach((item, index) => collectSkillTargets(item, `${path}[${index}]`))
        return
    }
    if (!value || typeof value !== "object") {
        return
    }
    if (Array.isArray(value.skillTargets)) {
        value.skillTargets.forEach((target, index) => storedTargets.push({ target, path: `${path}.skillTargets[${index}]` }))
    }
    for (const [key, child] of Object.entries(value)) {
        collectSkillTargets(child, `${path}.${key}`)
    }
}
dataRoots.forEach((root, index) => collectSkillTargets(root, `root[${index}]`))
for (const { target, path } of storedTargets) {
    assert.ok(["specific", "skillType", "skillTag"].includes(target.kind), `${path} must use the canonical target discriminator`)
    assert.equal(Object.hasOwn(target, "moveIdPrefixes"), false, `${path} must not contain legacy prefixes`)
    if (target.kind === "skillTag") {
        assert.ok(SKILL_TAG_VALUES.has(target.skillTag), `${path} must have a valid skill tag`)
        continue
    }
    assert.ok(SKILL_TYPE_VALUES.has(target.skillType), `${path} must have a valid skillType`)
    if (target.kind !== "specific") {
        continue
    }
    const skill = skillsById.get(target.agentSkillId)
    assert.ok(skill, `${path} references a missing skill catalog`)
    const category = skill.categories.find(item => item.id === target.categoryId)
    assert.ok(category, `${path} references a missing category`)
    const matchingMoves = category.moves.filter(move => move.skillType === target.skillType)
    assert.ok(matchingMoves.length, `${path} references a type outside its category`)
    if (target.moveId) {
        const move = matchingMoves.find(item => item.id === target.moveId)
        assert.ok(move, `${path} references a missing move`)
        if (target.rowId) {
            assert.ok(move.rows.some(row => row.id === target.rowId), `${path} references a missing row`)
        }
    }
}
assert.equal(moveCount, 64)
assert.equal(rowCount, 93)
assert.deepEqual(Object.fromEntries(skillTagCounts), {
    dashAttack: 4,
    assistAttack: 9,
    exSpecial: 10,
})
assert.equal(storedTargets.length, 50)
const yeShunguangTargetMoveIds = new Set(storedTargets
    .map(item => item.target)
    .filter(target => target.kind === "specific" && target.agentSkillId === "ye_shunguang")
    .map(target => target.moveId))
for (const moveId of [
    "clarity_parting_water",
    "ex_clarity_return_dust",
    "chain_clarity_pull_thunder",
    "ultimate_cut_delusion_open_heaven",
]) {
    assert.ok(yeShunguangTargetMoveIds.has(moveId), `Ye Shunguang should retain the modeled target ${moveId}`)
}

console.log("skill target tests passed")
