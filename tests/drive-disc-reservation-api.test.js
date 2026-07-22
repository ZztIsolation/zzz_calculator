import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createServer as createNetServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tempRoot = await mkdtemp(path.join(tmpdir(), "zzz-reservation-api-"))
const tempDataDir = path.join(tempRoot, "data")
let server = null
let serverOutput = ""

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer()
        probe.unref()
        probe.once("error", reject)
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address()
            probe.close(error => error ? reject(error) : resolve(address.port))
        })
    })
}

function disc(slot) {
    return {
        id: `api-disc-${slot}`,
        ownerId: "default",
        setId: "woodpecker_electro",
        setName: "啄木鸟电音",
        partition: slot,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        reservedForAgentId: null,
        mainStat: { stat: slot === 1 ? "hpFlat" : "atkPct", value: slot === 1 ? 2200 : 30 },
        subStats: [],
    }
}

async function post(baseUrl, pathname, payload) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    return { response, body: await response.json() }
}

try {
    await mkdir(tempDataDir, { recursive: true })
    for (const fileName of await readdir(path.join(rootDir, "data"))) {
        if (fileName.endsWith(".json") && fileName !== "user_drive_discs.json") {
            await copyFile(path.join(rootDir, "data", fileName), path.join(tempDataDir, fileName))
        }
    }
    await writeFile(path.join(tempDataDir, "user_drive_discs.json"), JSON.stringify({
        version: 1,
        currentOwnerId: "default",
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscs: [1, 2, 3, 4, 5, 6].map(disc),
        driveDiscLoadouts: [],
    }), "utf8")

    const port = await availablePort()
    const baseUrl = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, ["backend/server.js"], {
        cwd: rootDir,
        env: { ...process.env, NODE_ENV: "development", PORT: String(port), ZZZ_CALCULATOR_DATA_DIR: tempDataDir },
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => { serverOutput += chunk.toString() })
    server.stderr.on("data", chunk => { serverOutput += chunk.toString() })
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            if ((await fetch(`${baseUrl}/api/health`)).ok) break
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 50))
        if (attempt === 99) throw new Error(`Reservation API server did not start.\n${serverOutput}`)
    }

    const assigned = await post(baseUrl, "/api/user-drive-disc-reservations", {
        discIds: ["api-disc-1"],
        reservedForAgentId: "agent-a",
    })
    assert.equal(assigned.response.status, 200)
    assert.equal(assigned.body.store.driveDiscs.find(item => item.id === "api-disc-1").reservedForAgentId, "agent-a")

    const conflict = await post(baseUrl, "/api/user-drive-disc-reservations", {
        discIds: ["api-disc-1", "api-disc-2"],
        reservedForAgentId: "agent-b",
    })
    assert.equal(conflict.response.status, 409)
    assert.deepEqual(conflict.body.conflicts.map(item => item.discId), ["api-disc-1"])
    const afterConflict = JSON.parse(await readFile(path.join(tempDataDir, "user_drive_discs.json"), "utf8"))
    assert.equal(afterConflict.driveDiscs.find(item => item.id === "api-disc-2").reservedForAgentId, null)

    const loadout = {
        name: "API 原子套装",
        agentId: "agent-b",
        driveDiscIdsBySlot: Object.fromEntries([1, 2, 3, 4, 5, 6].map(slot => [slot, `api-disc-${slot}`])),
    }
    assert.equal((await post(baseUrl, "/api/user-drive-disc-loadouts", {
        loadout,
        reservation: { enabled: true },
    })).response.status, 409)

    const transferred = await post(baseUrl, "/api/user-drive-disc-loadouts", {
        loadout,
        reservation: { enabled: true, allowTransfer: true },
    })
    assert.equal(transferred.response.status, 200)
    assert.ok(transferred.body.store.driveDiscs.every(item => item.reservedForAgentId === "agent-b"))
    console.log("Drive Disc reservation API tests passed.")
} finally {
    server?.kill("SIGTERM")
    await rm(tempRoot, { recursive: true, force: true })
}
