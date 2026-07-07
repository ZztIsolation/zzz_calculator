import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
let port = 20000 + Math.floor(Math.random() * 1000)
let baseUrl = `http://127.0.0.1:${port}`
let serverOutput = ""
let server = null

function startServer(extraEnv = {}) {
    port = 20000 + Math.floor(Math.random() * 1000)
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
        body: await response.text(),
    }
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

try {
    startServer()
    await waitForServer()

    const appConfig = await getText("/api/app-config")
    assert.equal(appConfig.status, 200)
    assert.equal(JSON.parse(appConfig.body).maintenanceEnabled, false)

    const maintenanceRedirect = await getRedirect("/maintenance")
    assert.equal(maintenanceRedirect.status, 308)
    assert.equal(maintenanceRedirect.location, "/maintenance.html")
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
    const servesVueApp = /<div id="app"><\/div>/.test(appPage.body)
    if (servesVueApp) {
        assert.match(appPage.body, /ZZZ Calculator/)
        assert.equal((await getText("/discs")).status, 200)
        assert.equal((await getText("/accounts")).status, 200)
        assert.deepEqual(await getRedirect("/maintenance"), { status: 308, location: "/maintenance.html", body: "" })
        assert.deepEqual(await getRedirect("/calculate.html"), { status: 308, location: "/", body: "" })
        assert.deepEqual(await getRedirect("/drive-discs.html"), { status: 308, location: "/discs", body: "" })
        assert.deepEqual(await getRedirect("/accounts.html"), { status: 308, location: "/accounts", body: "" })
        assert.equal((await getText("/maintenance.html")).status, 404)
        assert.equal((await getText("/downloads/zzz-scanner/manifest.json")).status, 200)
        assert.equal((await getText("/missing-route")).status, 200)
    } else {
        assert.match(appPage.body, /驱动盘最优计算/)
        const legacyOptimizerPage = await getRedirect("/calculate.html")
        assert.equal(legacyOptimizerPage.status, 308)
        assert.equal(legacyOptimizerPage.location, "/")
        assert.equal((await getRedirect("/drive-discs.html")).location, "/discs")
        assert.equal((await getRedirect("/accounts.html")).location, "/accounts")
        assert.equal((await getText("/maintenance.html")).status, 404)
    }

    assert.equal((await getText("/missing.html")).status, 404)

    server.kill()
    await sleep(100)
    startServer({ MAINTENANCE_ENABLED: "true" })
    await waitForServer()

    const enabledConfig = await getText("/api/app-config")
    assert.equal(enabledConfig.status, 200)
    assert.equal(JSON.parse(enabledConfig.body).maintenanceEnabled, true)
    assert.deepEqual(await getRedirect("/maintenance"), { status: 308, location: "/maintenance.html", body: "" })
    const oldMaintenancePage = await getText("/maintenance.html")
    assert.equal(oldMaintenancePage.status, 200)
    assert.match(oldMaintenancePage.body, /维护界面/)
    assert.match(oldMaintenancePage.body, /maintenance\.js/)
    assert.equal((await getText("/maintenance.js")).status, 200)
    assert.equal((await getText("/maintenanceValidation.js")).status, 200)
    assert.equal((await getText("/maintenanceStats.js")).status, 200)
    const enabledMaintenanceCatalog = await getText("/api/maintenance/catalog")
    assert.equal(enabledMaintenanceCatalog.status, 200)
} finally {
    server?.kill()
}
