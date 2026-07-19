import assert from "node:assert/strict"

import {
    defaultSkillGroupReferenceEvent,
    expandCalculationConfigSkillGroups,
    expandCalculationEvents,
    normalizeSkillGroupCounts,
} from "../core/calculationSkillGroups.js"

const agent = {
    id: "test_agent",
    skillGroups: [
        {
            id: "loop",
            name: { zhCN: "一变" },
            defaultCount: 10,
            minCount: 0,
            maxCount: 30,
            step: 1,
            events: [
                {
                    id: "slash",
                    kind: "direct",
                    count: 2,
                    stunned: true,
                    critMode: "expected",
                    skillRef: {
                        agentSkillId: "test_agent_skill",
                        categoryId: "basic",
                        moveId: "normal",
                        rowId: "hit_1",
                    },
                },
            ],
        },
        {
            id: "ultimate",
            name: { zhCN: "一大" },
            defaultCount: 2,
            minCount: 0,
            maxCount: 10,
            step: 1,
            events: [
                {
                    id: "burst",
                    kind: "direct",
                    count: 1,
                    critMode: "expected",
                    skillRef: {
                        agentSkillId: "test_agent_skill",
                        categoryId: "chain",
                        moveId: "ultimate",
                        rowId: "damage",
                    },
                },
            ],
        },
    ],
}

const config = {
    mode: "custom",
    selectedEventId: "loop-ref",
    events: [
        {
            id: "intro",
            kind: "direct",
            count: 1,
            critMode: "expected",
            skillMultiplier: 100,
        },
        {
            id: "loop-ref",
            kind: "skillGroup",
            skillGroupId: "loop",
            count: 10,
            stunned: false,
        },
        {
            id: "ult-ref",
            kind: "skillGroup",
            skillGroupId: "ultimate",
            count: 2,
        },
        {
            id: "loop-ref-2",
            kind: "skillGroup",
            skillGroupId: "loop",
            count: 3,
            stunned: true,
        },
    ],
}

const before = JSON.stringify({ agent, config })
const counts = normalizeSkillGroupCounts(agent, { loop: 13, ultimate: 3 })
assert.deepEqual(counts, { loop: 13, ultimate: 3 })

const expandedConfig = expandCalculationConfigSkillGroups(config, agent)
assert.equal(expandedConfig.mode, "custom")
assert.equal(expandedConfig.selectedEventId, "loop-ref__slash")
assert.deepEqual(expandedConfig.events.map(event => event.id), [
    "intro",
    "loop-ref__slash",
    "ult-ref__burst",
    "loop-ref-2__slash",
])
assert.equal(expandedConfig.events[0].count, 1)
assert.equal(expandedConfig.events[1].count, 20)
assert.equal(expandedConfig.events[2].count, 2)
assert.equal(expandedConfig.events[3].count, 6)
assert.equal(expandedConfig.events[1].stunned, false)
assert.equal(expandedConfig.events[2].stunned, true)
assert.equal(expandedConfig.events[3].stunned, true)
assert.equal(JSON.stringify({ agent, config }), before)

const expandedEvents = expandCalculationEvents(config.events, agent, { selectedEventId: "ult-ref" })
assert.equal(expandedEvents.selectedEventId, "ult-ref__burst")
assert.deepEqual(expandedEvents.events.map(event => event.id), expandedConfig.events.map(event => event.id))

const defaultRef = defaultSkillGroupReferenceEvent(agent, "loop", 0)
assert.deepEqual(defaultRef, {
    id: "loop-ref-1",
    kind: "skillGroup",
    skillGroupId: "loop",
    count: 10,
    stunned: true,
})

const clamped = normalizeSkillGroupCounts(agent, { loop: 999, ultimate: -5 })
assert.deepEqual(clamped, { loop: 30, ultimate: 0 })

assert.throws(
    () => expandCalculationConfigSkillGroups({
        mode: "custom",
        selectedEventId: "missing-ref",
        events: [{ id: "missing-ref", kind: "skillGroup", skillGroupId: "missing", count: 1 }],
    }, agent, { strict: true }),
    /技能组引用无法展开.*missing/u,
)

assert.throws(
    () => expandCalculationConfigSkillGroups({
        mode: "custom",
        selectedEventId: "empty-ref",
        events: [{ id: "empty-ref", kind: "skillGroup", skillGroupId: "empty", count: 1 }],
    }, {
        ...agent,
        skillGroups: [
            ...agent.skillGroups,
            { id: "empty", name: { zhCN: "空组" }, events: [] },
        ],
    }, { strict: true }),
    /没有配置可展开的事件/u,
)

console.log("calculation skill group tests passed")
