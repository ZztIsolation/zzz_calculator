import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { request as httpRequest } from "node:http"
import { createServer as createNetServer } from "node:net"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
let port = 0
let baseUrl = `http://127.0.0.1:${port}`
let serverOutput = ""
let server = null
let telemetryDirectory = null

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer()
        probe.unref()
        probe.once("error", reject)
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address()
            const selectedPort = typeof address === "object" && address ? address.port : 0
            probe.close(error => {
                if (error) reject(error)
                else if (selectedPort < 12_000) resolve(availablePort())
                else resolve(selectedPort)
            })
        })
    })
}

async function startServer(extraEnv = {}) {
    port = await availablePort()
    baseUrl = `http://127.0.0.1:${port}`
    serverOutput = ""
    server = spawn(process.execPath, ["backend/server.js"], {
        cwd: rootDir,
        env: {
            ...process.env,
            NODE_ENV: "production",
            PORT: String(port),
            ...extraEnv,
        },
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => {
        serverOutput += chunk.toString()
    })
    server.stderr.on("data", chunk => {
        serverOutput += chunk.toString()
    })
    return server
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function runNodeTool(entry, args = [], cwd = rootDir) {
    return new Promise((resolve, reject) => {
        let output = ""
        const child = spawn(process.execPath, [entry, ...args], {
            cwd,
            env: {
                ...process.env,
                VITE_INCLUDE_MAINTENANCE: "true",
            },
            stdio: ["ignore", "pipe", "pipe"],
        })
        child.stdout.on("data", chunk => {
            output += chunk.toString()
        })
        child.stderr.on("data", chunk => {
            output += chunk.toString()
        })
        child.on("error", reject)
        child.on("exit", code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${path.basename(entry)} failed with exit code ${code}.\n${output}`))
        })
    })
}

async function buildVueApp() {
    const webappDir = path.join(rootDir, "webapp")
    await runNodeTool(path.join(webappDir, "node_modules", "vue-tsc", "bin", "vue-tsc.js"), ["--noEmit"], webappDir)
    await runNodeTool(path.join(webappDir, "node_modules", "vite", "bin", "vite.js"), ["build"], webappDir)
}

async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/api/health`)
            if (response.ok) {
                return
            }
        } catch {
            await sleep(100)
        }
    }
    throw new Error(`Server did not start.\n${serverOutput}`)
}

async function getText(pathname) {
    const response = await fetch(`${baseUrl}${pathname}`)
    return {
        status: response.status,
        headers: response.headers,
        body: await response.text(),
    }
}

async function postTelemetry(payload, options = {}) {
    const response = await fetch(`${baseUrl}/api/scan-telemetry/events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options.origin === false ? {} : { Origin: baseUrl }),
            ...(options.headers ?? {}),
        },
        body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
    return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function getRedirect(pathname) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        redirect: "manual",
    })
    return {
        status: response.status,
        location: response.headers.get("location"),
        body: await response.text(),
    }
}

function getRaw(pathname) {
    return new Promise((resolve, reject) => {
        const request = httpRequest({
            hostname: "127.0.0.1",
            port,
            method: "GET",
            path: pathname,
        }, response => {
            let body = ""
            response.setEncoding("utf8")
            response.on("data", chunk => { body += chunk })
            response.on("end", () => resolve({ status: response.statusCode, body }))
        })
        request.on("error", reject)
        request.end()
    })
}

try {
    await buildVueApp()
    await startServer()
    await waitForServer()

    const appConfig = await getText("/api/app-config")
    assert.equal(appConfig.status, 200)
    assert.equal(JSON.parse(appConfig.body).maintenanceEnabled, false)
    assert.equal(JSON.parse(appConfig.body).scanTelemetryEnabled, false)

    const malformedUrl = await getRaw("/%")
    assert.equal(malformedUrl.status, 400)
    assert.match(JSON.parse(malformedUrl.body).error, /malformed url/i)
    assert.equal((await getText("/api/health")).status, 200, "server must remain healthy after malformed URL")

    const maintenanceRedirect = await getRedirect("/maintenance")
    assert.equal(maintenanceRedirect.status, 404)
    assert.equal(maintenanceRedirect.location, null)
    assert.equal((await getText("/maintenance/")).status, 404)
    assert.equal((await getText("/maintenance.html")).status, 404)
    assert.equal((await getText("/maintenance.js")).status, 404)
    assert.equal((await getText("/maintenanceValidation.js")).status, 404)
    assert.equal((await getText("/maintenanceStats.js")).status, 404)

    const maintenanceCatalog = await getText("/api/maintenance/catalog")
    assert.equal(maintenanceCatalog.status, 403)
    assert.equal(JSON.parse(maintenanceCatalog.body).ok, false)

    const catalog = await getText("/api/catalog")
    assert.equal(catalog.status, 200)
    assert.ok(Array.isArray(JSON.parse(catalog.body).agents))

    for (const pathname of [
        "/api/calculate/in-combat",
        "/api/analysis/drive-disc-substats",
        "/api/analysis/drive-disc-stat-diffs",
        "/api/analysis/drive-disc-stat-gains",
        "/api/optimize/drive-discs/preview",
        "/api/optimize/drive-discs/jobs",
    ]) {
        const response = await fetch(`${baseUrl}${pathname}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        })
        const body = await response.json()
        assert.equal(response.status, 403, `${pathname} should be disabled in production`)
        assert.match(body.error, /disabled in production/i)
    }

    for (const pathname of [
        "/api/accounts",
        "/api/accounts/current",
        "/api/accounts/default",
        "/api/user-drive-discs",
        "/api/user-drive-discs/import/zzz-scanner",
        "/api/user-drive-discs/example",
        "/api/user-drive-disc-loadouts",
        "/api/user-drive-disc-loadouts/example",
    ]) {
        const response = await getText(pathname)
        assert.equal(response.status, 410, `${pathname} should be retired`)
        assert.match(JSON.parse(response.body).error, /browser locally/i)
    }

    const appPage = await getText("/")
    assert.equal(appPage.status, 200)
    assert.equal(appPage.headers.get("cache-control"), "no-store")
    assert.match(appPage.body, /<div id="app"><\/div>/)
    assert.match(appPage.body, /ZZZ Calculator/)
    const appAssetPath = appPage.body.match(/src="(\/static\/app\/[^"]+\.js)"/)?.[1]
    assert.ok(appAssetPath, "built page should reference a hashed JavaScript asset")
    const appAsset = await getText(appAssetPath)
    assert.equal(appAsset.status, 200)
    assert.equal(appAsset.headers.get("cache-control"), "public, max-age=31536000, immutable")
    const stableAsset = await getText("/zzz-mark.svg")
    assert.equal(stableAsset.status, 200)
    assert.equal(stableAsset.headers.get("cache-control"), "no-cache")
    assert.equal((await getText("/discs")).status, 200)
    assert.equal((await getText("/accounts")).status, 200)
    assert.equal((await getText("/static")).status, 404)
    assert.equal((await getText("/assets")).status, 404)
    assert.equal((await getText("/downloads/zzz-scanner")).status, 404)
    assert.equal((await getText("/api/health")).status, 200, "server must remain healthy after directory requests")
    assert.equal((await getText("/maintenance")).status, 404)
    assert.deepEqual(await getRedirect("/calculate.html"), { status: 308, location: "/", body: "" })
    assert.deepEqual(await getRedirect("/drive-discs.html"), { status: 308, location: "/discs", body: "" })
    assert.deepEqual(await getRedirect("/accounts.html"), { status: 308, location: "/accounts", body: "" })
    assert.equal((await getText("/maintenance.html")).status, 404)
    assert.equal((await getText("/downloads/zzz-scanner/manifest.json")).status, 200)
    const missingRoute = await getText("/missing-route")
    assert.equal(missingRoute.status, 200)
    assert.equal(missingRoute.headers.get("cache-control"), "no-store")

    assert.equal((await getText("/missing.html")).status, 404)

    server.kill()
    await sleep(100)
    await startServer({ MAINTENANCE_ENABLED: "true" })
    await waitForServer()

    const enabledConfig = await getText("/api/app-config")
    assert.equal(enabledConfig.status, 200)
    assert.equal(JSON.parse(enabledConfig.body).maintenanceEnabled, true)
    const enabledMaintenancePage = await getText("/maintenance")
    assert.equal(enabledMaintenancePage.status, 200)
    assert.match(enabledMaintenancePage.body, /<div id="app"><\/div>/)
    assert.deepEqual(await getRedirect("/maintenance.html"), { status: 308, location: "/maintenance", body: "" })
    assert.deepEqual(await getRedirect("/maintenance/"), { status: 308, location: "/maintenance", body: "" })
    assert.equal((await getText("/maintenance.js")).status, 404)
    assert.equal((await getText("/maintenanceValidation.js")).status, 404)
    assert.equal((await getText("/maintenanceStats.js")).status, 404)
    const enabledMaintenanceCatalog = await getText("/api/maintenance/catalog")
    assert.equal(enabledMaintenanceCatalog.status, 200)
    const maintenanceData = JSON.parse(enabledMaintenanceCatalog.body).data
    assert.ok(Array.isArray(maintenanceData.agents.agents))
    assert.ok(Array.isArray(maintenanceData.agentSkills.agentSkills))
    assert.ok(Array.isArray(maintenanceData.wEngines.wEngines))
    assert.ok(Array.isArray(maintenanceData.driveDiscSets.sets))
    assert.ok(Array.isArray(maintenanceData.anomalyEffects.effects))
    assert.ok(Array.isArray(maintenanceData.combatBuffs.teammates))
    assert.ok(Array.isArray(maintenanceData.combatBuffs.fieldBuffs))
    assert.ok(Array.isArray(maintenanceData.combatBuffs.bossBuffs))

    server.kill()
    await sleep(100)
    telemetryDirectory = await mkdtemp(path.join(os.tmpdir(), "zzz-server-telemetry-"))
    await startServer({
        SCAN_TELEMETRY_ENABLED: "true",
        SCAN_TELEMETRY_DIR: telemetryDirectory,
        SCAN_TELEMETRY_RETENTION_DAYS: "30",
    })
    await waitForServer()

    const telemetryConfig = JSON.parse((await getText("/api/app-config")).body)
    assert.equal(telemetryConfig.scanTelemetryEnabled, true)
    assert.equal(telemetryConfig.scanTelemetryRetentionDays, 30)

    const telemetryEvent = {
        schemaVersion: 1,
        eventType: "started",
        clientId: "11111111-1111-4111-8111-111111111111",
        sessionId: "22222222-2222-4222-8222-222222222222",
        client: "local",
        settings: { rarities: ["S"], maxItems: 30, stopAtNonLevel15: true },
        versions: { helperVersion: "1.2.1", scannerVersion: "1.0.39" },
        counters: { visited: 0, queued: 0, completed: 0, failed: 0 },
    }
    assert.equal((await postTelemetry(telemetryEvent, { origin: false })).status, 403)
    assert.equal((await postTelemetry(telemetryEvent, {
        headers: { Origin: "https://attacker.invalid", "X-Forwarded-Host": "attacker.invalid" },
    })).status, 403)
    assert.equal((await postTelemetry({ ...telemetryEvent, driveDiscs: [] })).status, 400)
    assert.equal((await postTelemetry("x".repeat(17 * 1024))).status, 413)
    assert.equal((await postTelemetry(telemetryEvent)).status, 202)
    assert.equal((await getText("/api/internal/scan-telemetry/summary")).status, 401)

    const summaryResponse = await fetch(`${baseUrl}/api/internal/scan-telemetry/summary?from=2026-07-01&to=2026-07-30`, {
        headers: { "X-Scan-Telemetry-Admin": "1" },
    })
    assert.equal(summaryResponse.status, 200)
    assert.equal((await summaryResponse.json()).summary.startedOnly, 1)
} finally {
    server?.kill()
    if (telemetryDirectory) await rm(telemetryDirectory, { recursive: true, force: true })
}
