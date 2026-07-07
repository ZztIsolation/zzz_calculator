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
    return new URL(`../frontend/catalog-loader.js?test=${label}-${importCounter}`, import.meta.url).href
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

console.log("catalog loader tests passed")
