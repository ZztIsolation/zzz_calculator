import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createServer as createNetServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceDataDir = path.join(rootDir, "data")
const tempRoot = await mkdtemp(path.join(tmpdir(), "zzz-calculator-maintenance-"))
const tempDataDir = path.join(tempRoot, "data")
const port = await availablePort()
const baseUrl = `http://127.0.0.1:${port}`
let server = null
let serverOutput = ""

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer()
        probe.unref()
        probe.once("error", reject)
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address()
            const selectedPort = typeof address === "object" && address ? address.port : 0
            probe.close(error => error ? reject(error) : resolve(selectedPort))
        })
    })
}

async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, options)
    const body = await response.json().catch(() => ({}))
    assert.equal(response.ok, true, `${options.method ?? "GET"} ${pathname}: ${response.status} ${JSON.stringify(body)}`)
    assert.notEqual(body.ok, false, `${options.method ?? "GET"} ${pathname}: ${JSON.stringify(body)}`)
    return body
}

async function catalog() {
    return (await request("/api/maintenance/catalog")).data
}

async function save(resource, item, origin = baseUrl) {
    const response = await fetch(`${baseUrl}/api/maintenance/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(item),
    })
    const body = await response.json().catch(() => ({}))
    assert.equal(response.ok, true, `POST ${resource}: ${response.status} ${JSON.stringify(body)}`)
    assert.notEqual(body.ok, false)
    assert.equal(response.headers.get("access-control-allow-origin"), origin)
    return body
}

async function remove(pathname) {
    return request(pathname, { method: "DELETE", headers: { Origin: baseUrl } })
}

async function waitForServer() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/api/health`)
            if (response.ok) {
                return
            }
        } catch {
            // Server startup races are expected.
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Maintenance integration server did not start.\n${serverOutput}`)
}

function cloneWithId(item, suffix) {
    return {
        ...structuredClone(item),
        id: `${item.id}__${suffix}`,
    }
}

try {
    await mkdir(tempDataDir, { recursive: true })
    for (const fileName of await readdir(sourceDataDir)) {
        if (fileName.endsWith(".json") && fileName !== "user_drive_discs.json") {
            await copyFile(path.join(sourceDataDir, fileName), path.join(tempDataDir, fileName))
        }
    }

    server = spawn(process.execPath, ["backend/server.js"], {
        cwd: rootDir,
        env: {
            ...process.env,
            NODE_ENV: "production",
            MAINTENANCE_ENABLED: "true",
            PORT: String(port),
            ZZZ_CALCULATOR_DATA_DIR: tempDataDir,
            MAINTENANCE_ALLOWED_ORIGINS: "https://trusted.example",
        },
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => { serverOutput += chunk.toString() })
    server.stderr.on("data", chunk => { serverOutput += chunk.toString() })
    await waitForServer()

    const crossOriginCatalog = await fetch(`${baseUrl}/api/catalog`, {
        headers: { Origin: "https://read-only.example" },
    })
    assert.equal(crossOriginCatalog.status, 200)
    assert.equal(crossOriginCatalog.headers.get("access-control-allow-origin"), "*")

    for (const [method, pathname] of [
        ["POST", "/api/maintenance/agents"],
        ["DELETE", "/api/maintenance/agents/agent_a"],
        ["OPTIONS", "/api/maintenance/agents"],
    ]) {
        const response = await fetch(`${baseUrl}${pathname}`, {
            method,
            headers: {
                Origin: `http://evil.example:${port}`,
                Host: `evil.example:${port}`,
                "Content-Type": "application/json",
                ...(method === "OPTIONS" ? { "Access-Control-Request-Method": "POST" } : {}),
            },
            ...(method === "POST" ? { body: "{}" } : {}),
        })
        assert.equal(response.status, 403, `${method} maintenance request from a foreign Origin must be rejected`)
        assert.match((await response.json()).error, /cross-origin/i)
    }

    const genericResources = [
        ["agents", data => data.agents.agents],
        ["agent-skills", data => data.agentSkills.agentSkills],
        ["w-engines", data => data.wEngines.wEngines],
        ["drive-disc-sets", data => data.driveDiscSets.sets],
        ["field-buffs", data => data.combatBuffs.fieldBuffs],
    ]

    for (const [resource, itemsFor] of genericResources) {
        const before = await catalog()
        const source = itemsFor(before)[0]
        assert.ok(source, `${resource} fixture must exist`)
        const copy = cloneWithId(source, "maintenance_api_copy")
        const result = await save(resource, copy, resource === "agents" ? "https://trusted.example" : baseUrl)
        const savedId = result.savedItem.id
        assert.ok(savedId)
        assert.ok(itemsFor(await catalog()).some(item => item.id === savedId), `${resource} save must persist after full reload`)
        await remove(`/api/maintenance/${resource}/${encodeURIComponent(savedId)}`)
        assert.equal(itemsFor(await catalog()).some(item => item.id === savedId), false, `${resource} delete must persist after full reload`)
    }

    const anomalyData = await catalog()
    const anomalySource = anomalyData.anomalyEffects.effects[0]
    const anomalyCopy = cloneWithId(anomalySource, "maintenance_api_copy")
    const anomalyResult = await save("anomaly-effects", anomalyCopy)
    const anomalySaved = anomalyResult.savedItem
    assert.ok((await catalog()).anomalyEffects.effects.some(item => item.id === anomalySaved.id))
    await remove(`/api/maintenance/anomaly-effects/${encodeURIComponent(anomalySaved.maintenanceType)}/${encodeURIComponent(anomalySaved.id)}`)
    assert.equal((await catalog()).anomalyEffects.effects.some(item => item.id === anomalySaved.id), false)

    const bossData = await catalog()
    const fieldTemplate = bossData.combatBuffs.fieldBuffs[0]
    const bossTemplate = {
        sourceType: "boss",
        scope: "inCombat",
        bossName: { zhCN: "集成测试 Boss" },
        bossSource: { zhCN: "集成测试" },
        sourcePeriod: { zhCN: "集成测试期" },
        description: { zhCN: "使用真实后端契约验证 Boss Buff。" },
        coverage: structuredClone(fieldTemplate.coverage),
        effects: structuredClone(fieldTemplate.effects),
        buffModifiers: structuredClone(fieldTemplate.buffModifiers ?? []),
    }
    const bossCopies = [1, 2].map(index => ({
        ...structuredClone(bossTemplate),
        id: `boss__maintenance_api_concurrent_${index}`,
        bossName: { zhCN: `并发集成测试 Boss ${index}` },
    }))
    const bossResults = await Promise.all(bossCopies.map(item => save("boss-buffs", item)))
    const catalogAfterConcurrentBossSaves = await catalog()
    for (const result of bossResults) {
        assert.ok(catalogAfterConcurrentBossSaves.combatBuffs.bossBuffs.some(item => item.id === result.savedItem.id))
    }
    await Promise.all(bossResults.map(result => remove(`/api/maintenance/boss-buffs/${encodeURIComponent(result.savedItem.id)}`)))
    const catalogAfterConcurrentBossDeletes = await catalog()
    for (const result of bossResults) {
        assert.equal(catalogAfterConcurrentBossDeletes.combatBuffs.bossBuffs.some(item => item.id === result.savedItem.id), false)
    }

    const teammateData = await catalog()
    const teammateSource = teammateData.combatBuffs.teammates.find(item => item.buffs?.length)
    assert.ok(teammateSource, "teammate Buff fixture must exist")
    const { buffs: _buffs, ...teammateBase } = teammateSource
    const teammateId = `${teammateSource.id}__maintenance_api_copy`
    const buff = cloneWithId(teammateSource.buffs[0], "maintenance_api_copy")
    const teammateResult = await save("teammate-buffs", {
        teammate: { ...teammateBase, id: teammateId },
        buff,
    })
    assert.equal(teammateResult.savedItem.teammateId, teammateId)
    assert.ok((await catalog()).combatBuffs.teammates
        .find(item => item.id === teammateId)?.buffs.some(item => item.id === buff.id))
    await remove(`/api/maintenance/teammate-buffs/${encodeURIComponent(teammateId)}/${encodeURIComponent(buff.id)}`)
    assert.equal((await catalog()).combatBuffs.teammates
        .find(item => item.id === teammateId)?.buffs.some(item => item.id === buff.id), false)

    assert.equal((await readdir(tempDataDir)).some(fileName => fileName.endsWith(".tmp")), false)

    console.log("maintenance API integration: ok (8 resources, same-origin guard, atomic concurrent writes)")
} finally {
    server?.kill()
    await rm(tempRoot, { recursive: true, force: true })
}
