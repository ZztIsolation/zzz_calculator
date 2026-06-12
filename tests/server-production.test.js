import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = 20000 + Math.floor(Math.random() * 1000)
const baseUrl = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ["backend/server.js"], {
    cwd: rootDir,
    env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
})

let serverOutput = ""
server.stdout.on("data", chunk => {
    serverOutput += chunk.toString()
})
server.stderr.on("data", chunk => {
    serverOutput += chunk.toString()
})

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

try {
    await waitForServer()

    const appConfig = await getText("/api/app-config")
    assert.equal(appConfig.status, 200)
    assert.equal(JSON.parse(appConfig.body).maintenanceEnabled, false)

    assert.equal((await getText("/maintenance.html")).status, 404)
    assert.equal((await getText("/maintenance.js")).status, 404)

    const maintenanceCatalog = await getText("/api/maintenance/catalog")
    assert.equal(maintenanceCatalog.status, 403)
    assert.equal(JSON.parse(maintenanceCatalog.body).ok, false)

    const catalog = await getText("/api/catalog")
    assert.equal(catalog.status, 200)
    assert.ok(Array.isArray(JSON.parse(catalog.body).agents))

    for (const pathname of [
        "/api/calculate/in-combat",
        "/api/analysis/drive-disc-substats",
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

    const calculatorPage = await getText("/calculate.html")
    assert.equal(calculatorPage.status, 200)
} finally {
    server.kill()
}
