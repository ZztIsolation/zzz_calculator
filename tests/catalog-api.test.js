import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCatalog } from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zzz-catalog-cache-"))
const dataDir = path.join(tempRoot, "data")
const port = await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once("error", reject)
    probe.listen(0, "127.0.0.1", () => {
        const selectedPort = probe.address().port
        probe.close(error => error ? reject(error) : resolve(selectedPort))
    })
})
const baseUrl = `http://127.0.0.1:${port}`
let server
let serverOutput = ""

async function readCatalog(etag) {
    const response = await fetch(`${baseUrl}/api/catalog`, {
        headers: { Origin: "https://read-only.example", ...(etag ? { "If-None-Match": etag } : {}) },
    })
    const text = await response.text()
    assert.equal(response.headers.get("cache-control"), "no-cache")
    assert.equal(response.headers.get("access-control-allow-origin"), "*")
    return { status: response.status, etag: response.headers.get("etag"), text }
}

async function saveEngine(engine) {
    return fetch(`${baseUrl}/api/maintenance/w-engines`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(engine),
    })
}

try {
    await mkdir(dataDir)
    for (const fileName of await readdir(path.join(rootDir, "data"))) {
        if (fileName.endsWith(".json") && fileName !== "user_drive_discs.json") {
            await copyFile(path.join(rootDir, "data", fileName), path.join(dataDir, fileName))
        }
    }
    const expected = JSON.parse(JSON.stringify(await loadCatalog(dataDir, path.join(rootDir, "examples"))))
    server = spawn(process.execPath, ["backend/server.js"], {
        cwd: rootDir,
        env: {
            ...process.env,
            HOST: "127.0.0.1",
            PORT: String(port),
            NODE_ENV: "production",
            ENKA_IMPORT_ENABLED: "false",
            MAINTENANCE_ENABLED: "true",
            ZZZ_CALCULATOR_DATA_DIR: dataDir,
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => { serverOutput += chunk.toString() })
    server.stderr.on("data", chunk => { serverOutput += chunk.toString() })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await fetch(`${baseUrl}/api/health`).then(response => response.ok).catch(() => false)) {
            ready = true
            break
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.ok(ready, `Catalog integration server did not start.\n${serverOutput}`)

    const initial = await readCatalog()
    assert.equal(initial.status, 200)
    assert.match(initial.etag, /^"[a-f0-9]{64}"$/)
    assert.deepEqual(JSON.parse(initial.text), expected, "compact serialization must retain every existing field")
    assert.equal(initial.text, JSON.stringify(expected), "catalog must use compact JSON")
    for (const condition of [initial.etag, `W/${initial.etag}`, `"stale", W/${initial.etag}`, "*"]) {
        const unchanged = await readCatalog(condition)
        assert.equal(unchanged.status, 304, `matching If-None-Match ${condition} must avoid retransmission`)
        assert.equal(unchanged.etag, initial.etag)
        assert.equal(unchanged.text, "")
    }
    const stale = await readCatalog('"stale"')
    assert.equal(stale.status, 200)
    assert.equal(stale.text, initial.text)

    const source = JSON.parse(await readFile(path.join(dataDir, "w_engines.json"), "utf8")).wEngines[0]
    const engine = { ...source, id: `${source.id}__catalog_cache_test`, name: { zhCN: "目录缓存测试音擎" } }
    const saved = await saveEngine(engine)
    assert.equal(saved.status, 200, await saved.text())
    const changed = await readCatalog(initial.etag)
    assert.equal(changed.status, 200)
    assert.notEqual(changed.etag, initial.etag)
    assert.ok(JSON.parse(changed.text).wEngines.some(item => item.id === engine.id))
    assert.equal((await readCatalog(changed.etag)).status, 304)

    // Break a separate source only in the disposable fixture, after the server is running.
    const rulesPath = path.join(dataDir, "stat_rules.json")
    const rulesText = await readFile(rulesPath, "utf8")
    await writeFile(rulesPath, "{invalid JSON", "utf8")
    const pendingEngine = { ...engine, name: { zhCN: "重新加载后才可见" } }
    const failed = await saveEngine(pendingEngine)
    assert.equal(failed.status, 400, await failed.text())
    const retained = await readCatalog()
    assert.deepEqual(retained, changed, "failed reload must retain the previous complete response")
    assert.equal((await readCatalog(changed.etag)).status, 304)

    await writeFile(rulesPath, rulesText, "utf8")
    const repaired = await saveEngine(pendingEngine)
    assert.equal(repaired.status, 200, await repaired.text())
    const recovered = await readCatalog(changed.etag)
    assert.equal(recovered.status, 200)
    assert.notEqual(recovered.etag, changed.etag)
    assert.equal(JSON.parse(recovered.text).wEngines.find(item => item.id === engine.id).name.zhCN, pendingEngine.name.zhCN)

    console.log("catalog API cache, maintenance reload, and failed reload tests passed")
} finally {
    if (server && server.exitCode === null) {
        const exited = new Promise(resolve => server.once("exit", resolve))
        server.kill()
        await exited
    }
    await rm(tempRoot, { recursive: true, force: true })
}
