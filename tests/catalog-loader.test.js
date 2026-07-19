import assert from "node:assert/strict"

const baseCatalog = {
    agents: [],
    agentSkills: [],
    wEngines: [],
    driveDiscSets: [],
    anomalyEffects: [],
    disorderEffects: [],
    anomalySettlementEffects: [],
    combatBuffs: [],
    statRules: {},
}

let importCounter = 0

function loaderUrl(label) {
    importCounter += 1
    return new URL(`../webapp/src/runtime/catalog-loader.js?test=${label}-${importCounter}`, import.meta.url).href
}

function response(body, options = {}) {
    return {
        ok: options.ok ?? true,
        async json() {
            return body
        },
        async text() {
            return options.text ?? ""
        },
    }
}

async function withFetch(responses, callback) {
    const originalFetch = globalThis.fetch
    const calls = []
    globalThis.fetch = async (path, init) => {
        calls.push({ path, cache: init?.cache })
        const next = responses[path]
        if (!next) {
            return response(null, { ok: false, text: `missing ${path}` })
        }
        return typeof next === "function" ? next(path) : next
    }
    try {
        await callback(calls)
    } finally {
        globalThis.fetch = originalFetch
    }
}

await withFetch({
    "/api/catalog": response({
        ...baseCatalog,
        agents: [{ id: "api-agent" }],
    }),
    "/static/catalog.json": response({
        ...baseCatalog,
        agents: [{ id: "static-agent" }],
    }),
}, async calls => {
    const { loadCatalog } = await import(loaderUrl("api-first"))
    const catalog = await loadCatalog()
    assert.deepEqual(calls, [{ path: "/api/catalog", cache: "no-store" }])
    assert.equal(catalog.agents[0].id, "api-agent")
})

await withFetch({
    "/api/catalog": response(null, { ok: false, text: "api unavailable" }),
    "/static/catalog.json": response({
        ...baseCatalog,
        agents: [{ id: "static-agent" }],
    }),
}, async calls => {
    const { loadCatalog } = await import(loaderUrl("static-fallback"))
    const catalog = await loadCatalog()
    assert.deepEqual(calls, [
        { path: "/api/catalog", cache: "no-store" },
        { path: "/static/catalog.json", cache: "no-store" },
    ])
    assert.equal(catalog.agents[0].id, "static-agent")
})

await withFetch({
    "/api/catalog": response({
        ...baseCatalog,
        agents: [{
            id: "agent-with-groups",
            name: { zhCN: "技能组角色" },
            skillGroups: [{
                id: "loop",
                name: { zhCN: "一变" },
                events: [{ id: "hit", kind: "direct", skillMultiplier: 100, count: 1 }],
            }],
            defaultCalculationConfig: {
                mode: "custom",
                selectedEventId: "loop-ref",
                events: [{ id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 1 }],
            },
        }],
    }),
}, async () => {
    const { loadMeta } = await import(loaderUrl("meta-skill-groups"))
    const meta = await loadMeta()
    assert.equal(meta.agents[0].id, "agent-with-groups")
    assert.equal(meta.agents[0].skillGroups[0].id, "loop")
})

await withFetch({
    "/api/catalog": response({
        ...baseCatalog,
        agents: [
            { id: "visible-agent", name: { zhCN: "可见角色" } },
            { id: "hidden-agent", name: { zhCN: "隐藏角色" }, hidden: true },
        ],
        agentSkills: [
            { id: "visible-skills", agentId: "visible-agent" },
            { id: "hidden-skills", agentId: "hidden-agent" },
        ],
        wEngines: [
            { id: "visible-engine", name: { zhCN: "可见音擎" } },
            { id: "hidden-engine", name: { zhCN: "隐藏音擎" }, hidden: true },
        ],
        driveDiscSets: [
            { id: "visible-set", name: { zhCN: "可见套装" } },
            { id: "hidden-set", name: { zhCN: "隐藏套装" }, hidden: true },
        ],
        combatBuffs: [
            { id: "visible-buff", name: { zhCN: "可见 Buff" } },
            { id: "hidden-buff", name: { zhCN: "隐藏 Buff" }, hidden: true },
        ],
        teammateCombatBuffGroups: [
            {
                id: "visible-teammate",
                name: { zhCN: "可见队友" },
                attribute: "physical",
                specialty: "support",
                buffs: [
                    { id: "visible-teammate-buff", name: { zhCN: "可见队友 Buff" } },
                    { id: "hidden-teammate-buff", name: { zhCN: "隐藏队友 Buff" }, hidden: true },
                ],
            },
            {
                id: "hidden-teammate",
                name: { zhCN: "隐藏队友" },
                hidden: true,
                buffs: [{ id: "hidden-group-buff", name: { zhCN: "隐藏分组 Buff" } }],
            },
        ],
        fieldCombatBuffs: [
            { id: "visible-field", name: { zhCN: "可见场地 Buff" } },
            { id: "hidden-field", name: { zhCN: "隐藏场地 Buff" }, hidden: true },
        ],
        bossCombatBuffs: [
            { id: "visible-boss", name: { zhCN: "可见 Boss Buff" } },
            { id: "hidden-boss", name: { zhCN: "隐藏 Boss Buff" }, hidden: true },
        ],
    }),
}, async () => {
    const { loadCatalog, loadMeta } = await import(loaderUrl("display-collections"))
    const catalog = await loadCatalog()
    const meta = await loadMeta()

    assert.deepEqual(catalog.agents.map(item => item.id), ["visible-agent", "hidden-agent"])
    assert.deepEqual(catalog.displayAgents.map(item => item.id), ["visible-agent"])
    assert.equal(catalog.agentsMap.get("hidden-agent").name.zhCN, "隐藏角色")
    assert.deepEqual(meta.agents.map(item => item.id), ["visible-agent", "hidden-agent"])
    assert.deepEqual(meta.displayAgents.map(item => item.id), ["visible-agent"])
    assert.deepEqual(meta.displayAgentSkills.map(item => item.id), ["visible-skills"])
    assert.deepEqual(meta.displayWEngines.map(item => item.id), ["visible-engine"])
    assert.deepEqual(meta.displayDriveDiscSets.map(item => item.id), ["visible-set"])
    assert.deepEqual(meta.combatBuffs.map(item => item.id), ["visible-buff"])
    assert.deepEqual(meta.teammateCombatBuffGroups.map(item => item.id), ["visible-teammate"])
    assert.equal(meta.teammateCombatBuffGroups[0].attribute, "physical")
    assert.equal(meta.teammateCombatBuffGroups[0].specialty, "support")
    assert.deepEqual(meta.teammateCombatBuffGroups[0].buffs.map(item => item.id), ["visible-teammate-buff"])
    assert.deepEqual(meta.fieldCombatBuffs.map(item => item.id), ["visible-field"])
    assert.deepEqual(meta.bossCombatBuffs.map(item => item.id), ["visible-boss"])
})

console.log("catalog loader tests passed")
