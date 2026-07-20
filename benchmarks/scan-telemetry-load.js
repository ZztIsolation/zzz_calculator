import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const durationSeconds = Math.max(1, Number(process.env.SCAN_TELEMETRY_LOAD_SECONDS) || 300)
const requestsPerSecond = Math.max(1, Number(process.env.SCAN_TELEMETRY_LOAD_RPS) || 20)
const directory = await mkdtemp(path.join(os.tmpdir(), "zzz-telemetry-load-"))

function percentile(values, ratio) {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0
}

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createServer()
        probe.once("error", reject)
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address()
            const port = typeof address === "object" && address ? address.port : 0
            probe.close(error => {
                if (error) reject(error)
                else if (port < 12_000) resolve(availablePort())
                else resolve(port)
            })
        })
    })
}

function command(file, args) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { encoding: "utf8" }, (error, stdout) => error ? reject(error) : resolve(stdout.trim()))
    })
}

async function processMemoryBytes(pid) {
    try {
        if (process.platform === "win32") {
            const output = await command("powershell.exe", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).WorkingSet64`])
            return Number(output)
        }
        const output = await command("sh", ["-c", `awk '/VmRSS/ { print $2 * 1024 }' /proc/${pid}/status`])
        return Number(output)
    } catch {
        return 0
    }
}

const port = await availablePort()
const baseUrl = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: rootDir,
    env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        SCAN_TELEMETRY_ENABLED: "true",
        SCAN_TELEMETRY_DIR: directory,
        SCAN_TELEMETRY_RATE_LIMIT_MAX: String(requestsPerSecond * durationSeconds + 1000),
    },
    stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
child.stdout.on("data", chunk => { output += chunk })
child.stderr.on("data", chunk => { output += chunk })

async function waitForServer() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            if ((await fetch(`${baseUrl}/api/health`)).ok) return
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Server did not start.\n${output}`)
}

function event(index) {
    const suffix = index.toString(16).padStart(12, "0").slice(-12)
    return {
        schemaVersion: 1,
        eventType: "started",
        clientId: "11111111-1111-4111-8111-111111111111",
        sessionId: `22222222-2222-4222-8222-${suffix}`,
        client: "local",
        settings: { rarities: ["S"], maxItems: 30, stopAtNonLevel15: true },
        versions: { helperVersion: "1.2.1", scannerVersion: "1.0.39" },
        counters: { visited: 0, queued: 0, completed: 0, failed: 0 },
    }
}

try {
    await waitForServer()
    const memoryBefore = await processMemoryBytes(child.pid)
    const ingestionLatencies = []
    const healthLatencies = []
    let sent = 0
    for (let second = 0; second < durationSeconds; second += 1) {
        const tick = Date.now()
        const requests = Array.from({ length: requestsPerSecond }, async () => {
            const index = ++sent
            const started = performance.now()
            const response = await fetch(`${baseUrl}/api/scan-telemetry/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Origin: baseUrl },
                body: JSON.stringify(event(index)),
            })
            ingestionLatencies.push(performance.now() - started)
            assert.equal(response.status, 202)
        })
        const healthStarted = performance.now()
        const health = await fetch(`${baseUrl}/api/health`)
        healthLatencies.push(performance.now() - healthStarted)
        assert.equal(health.status, 200)
        await Promise.all(requests)
        const remaining = 1000 - (Date.now() - tick)
        if (remaining > 0 && second < durationSeconds - 1) await new Promise(resolve => setTimeout(resolve, remaining))
    }
    const memoryAfter = await processMemoryBytes(child.pid)
    const ingestionP95 = percentile(ingestionLatencies, 0.95)
    const healthP95 = percentile(healthLatencies, 0.95)
    const memoryDelta = Math.max(0, memoryAfter - memoryBefore)
    console.log(`scan_telemetry_load.duration_seconds=${durationSeconds}`)
    console.log(`scan_telemetry_load.requests=${sent}`)
    console.log(`scan_telemetry_load.ingestion_p95_ms=${ingestionP95.toFixed(2)}`)
    console.log(`scan_telemetry_load.health_p95_ms=${healthP95.toFixed(2)}`)
    console.log(`scan_telemetry_load.memory_delta_bytes=${memoryDelta}`)
    assert.ok(ingestionP95 < 100, `ingestion P95 ${ingestionP95.toFixed(2)}ms exceeded 100ms`)
    assert.ok(healthP95 < 100, `health P95 ${healthP95.toFixed(2)}ms exceeded 100ms`)
    assert.ok(memoryDelta < 100 * 1024 * 1024, `memory delta ${memoryDelta} exceeded 100 MiB`)
} finally {
    child.kill()
    await new Promise(resolve => child.once("exit", resolve))
    await rm(directory, { recursive: true, force: true })
}
