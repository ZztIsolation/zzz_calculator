import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import * as fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AgentMaintenanceHistory, agentRevision } from "../backend/agentMaintenance.js"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const root = await fs.mkdtemp(path.join(os.tmpdir(), "zzz-agent-maintenance-api-"))
const dataDir = path.join(root, "data")
await fs.mkdir(dataDir)
for (const file of await fs.readdir(path.join(repo, "data"))) {
    if (file.endsWith(".json") && !file.startsWith("user_")) await fs.copyFile(path.join(repo, "data", file), path.join(dataDir, file))
}
const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once("error", reject)
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)) })
})
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ["backend/server.js"], {
    cwd: repo, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), NODE_ENV: "development", MAINTENANCE_ENABLED: "true", ZZZ_CALCULATOR_DATA_DIR: dataDir },
})
let log = ""
server.stdout.on("data", chunk => { log += chunk })
server.stderr.on("data", chunk => { log += chunk })
const read = async () => (await (await fetch(`${base}/api/maintenance/catalog`)).json()).data
const write = async (item, headers = {}, method = "POST") => {
    const response = await fetch(`${base}/api/maintenance/agents${method === "DELETE" ? `/${item.id}` : ""}`, {
        method, headers: { "Content-Type": "application/json", Origin: base, ...headers },
        ...(method === "DELETE" ? {} : { body: JSON.stringify(item) }),
    })
    return { status: response.status, body: await response.json() }
}
const match = item => ({ "If-Match": `"${agentRevision(item)}"` })
const agentFile = path.join(dataDir, "agents.json")
try {
    let ready = false
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break } } catch {}
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert(ready, log)
    const data = await read()
    const original = data.agents.agents.find(item => item.id === "velina")
    assert.equal(data.agentRevisions.velina, agentRevision(original))
    assert.equal((await write(original)).status, 428)
    assert.equal((await write(original, { "If-None-Match": "*" })).status, 412)
    const stale = structuredClone(original)
    delete stale.defaultCalculationConfig
    for (const profile of stale.anomalyReleaseProfiles) {
        delete profile.default
        if (profile.id === "micro_vortex") profile.default = true
    }
    stale.name.zhCN += " 旧草稿文本"
    const rejected = await write(stale, { "If-Match": `"${agentRevision(stale)}"` })
    assert.equal(rejected.status, 412)
    assert.deepEqual(rejected.body.currentItem.defaultCalculationConfig, original.defaultCalculationConfig)
    assert.equal((await new AgentMaintenanceHistory(dataDir).records()).length, 0)
    const textEdit = structuredClone(original)
    textEdit.name.zhCN += " 文本维护"
    textEdit.preferredDriveDiscs.defaultTwoPieceSetIds = ["moonlight_lullaby", "swing_jazz"]
    for (const invalid of [["missing_drive_disc"], "swing_jazz"]) {
        const rejectedPreference = await write({ ...textEdit, preferredDriveDiscs: { defaultTwoPieceSetIds: invalid } }, match(original))
        assert.equal(rejectedPreference.status, 400, JSON.stringify(rejectedPreference.body))
    }
    const saved = await write(textEdit, match(original))
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.equal(saved.body.agentRevision, agentRevision(saved.body.savedItem))
    assert.deepEqual(saved.body.savedItem.defaultCalculationConfig.events, original.defaultCalculationConfig.events)
    assert.deepEqual(saved.body.savedItem.defaultCalculationConfig.name, original.defaultCalculationConfig.name)
    assert.deepEqual(saved.body.savedItem.preferredDriveDiscs.defaultTwoPieceSetIds, ["moonlight_lullaby", "swing_jazz"])
    assert.deepEqual((await read()).agents.agents.find(item => item.id === "velina").preferredDriveDiscs.defaultTwoPieceSetIds, ["moonlight_lullaby", "swing_jazz"])
    assert.equal((await write(original, match(original), "DELETE")).status, 412)

    // A disk edit must invalidate the revision, even without reloading the server catalog.
    const disk = JSON.parse(await fs.readFile(agentFile, "utf8"))
    const external = disk.agents.find(item => item.id === "velina")
    external.name.zhCN += " 外部修改"
    await fs.writeFile(agentFile, JSON.stringify(disk))
    assert.equal((await write(saved.body.savedItem, { "If-Match": `"${saved.body.agentRevision}"` })).status, 412)
    const current = (await read()).agents.agents.find(item => item.id === "velina")
    const other = disk.agents.find(item => item.id !== "velina")
    const otherEdit = structuredClone(other); otherEdit.name.zhCN += " 独立修改"
    assert.equal((await write(otherEdit, match(other))).status, 200)
    assert.equal((await read()).agentRevisions.velina, agentRevision(current))
    const first = { ...current, name: { zhCN: "并发一" } }
    const second = { ...current, name: { zhCN: "并发二" } }
    const concurrent = await Promise.all([write(first, match(current)), write(second, match(current))])
    assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 412])

    const clone = structuredClone(original); delete clone.id; delete clone.defaultCalculationConfig; delete clone.skillGroups
    const created = await write(clone, { "If-None-Match": "*" })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    const createdItem = created.body.savedItem
    assert.equal((await write(createdItem, { "If-None-Match": "*" })).status, 412)
    assert.equal((await write(createdItem, match(createdItem), "DELETE")).status, 200)
    const afterDelete = await write(createdItem, match(createdItem))
    assert.equal(afterDelete.status, 412)
    assert.equal(afterDelete.body.currentItem, null)
    const history = await new AgentMaintenanceHistory(dataDir).records()
    assert.equal(history.filter(item => item.record.agentId === createdItem.id).length, 2)
    assert(history.every(item => item.record.status === "committed"))

    const preflight = await fetch(`${base}/api/maintenance/agents`, { method: "OPTIONS", headers: { Origin: base, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "If-Match" } })
    assert.match(preflight.headers.get("access-control-allow-headers"), /If-Match/)

    // A broken history directory blocks mutation, rather than saving without evidence.
    const historyDirectory = path.join(dataDir, ".agent-history")
    await fs.rename(historyDirectory, `${historyDirectory}-held`)
    await fs.writeFile(historyDirectory, "unavailable")
    const beforeFailure = await fs.readFile(agentFile, "utf8")
    const latest = JSON.parse(beforeFailure).agents.find(item => item.id === "velina")
    const denied = await write({ ...latest, name: { zhCN: "不得落盘" } }, match(latest))
    assert(denied.status >= 400)
    assert.equal(await fs.readFile(agentFile, "utf8"), beforeFailure)
    await fs.rm(historyDirectory)
    await fs.rename(`${historyDirectory}-held`, historyDirectory)
    console.log("agent maintenance API: conditional writes, disk revisions, concurrent saves, deletion, history failure: ok")
} finally {
    if (server.exitCode === null) {
        const closed = new Promise(resolve => server.once("close", resolve)); server.kill(); await closed
    }
    await fs.rm(root, { recursive: true, force: true })
}
