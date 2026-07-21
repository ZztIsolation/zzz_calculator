import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createServer as createNetServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceDataDir = path.join(rootDir, "data")
const tempRoot = await mkdtemp(path.join(tmpdir(), "zzz-drive-disc-reservation-api-"))
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
            const port = typeof address === "object" && address ? address.port : 0
            probe.close(error => error ? reject(error) : resolve(port))
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
        locked: false,
        equippedBy: null,
        reservedForAgentId: null,
        mainStat: { stat: slot === 1 ? "hpFlat" : "atkPct", value: slot === 1 ? 2200 : 30 },
        subStats: [],
    }
}

async function waitForServer(baseUrl) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/api/health`)
            if (response.ok) return
        } catch {
            // Startup races are expected.
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Reservation API server did not start.\n${serverOutput}`)
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
    for (const fileName of await readdir(sourceDataDir)) {
        if (fileName.endsWith(".json") && fileName !== "user_drive_discs.json") {
            await copyFile(path.join(sourceDataDir, fileName), path.join(tempDataDir, fileName))
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
        env: {
            ...process.env,
            NODE_ENV: "development",
            PORT: String(port),
            ZZZ_CALCULATOR_DATA_DIR: tempDataDir,
        },
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => { serverOutput += chunk.toString() })
    server.stderr.on("data", chunk => { serverOutput += chunk.toString() })
    await waitForServer(baseUrl)

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
    assert.equal(conflict.body.code, "drive_disc_reservation_conflict")
    assert.deepEqual(conflict.body.conflicts.map(item => item.discId), ["api-disc-1"])
    const afterConflict = JSON.parse(await readFile(path.join(tempDataDir, "user_drive_discs.json"), "utf8"))
    assert.equal(afterConflict.driveDiscs.find(item => item.id === "api-disc-1").reservedForAgentId, "agent-a")
    assert.equal(afterConflict.driveDiscs.find(item => item.id === "api-disc-2").reservedForAgentId, null)

    const loadout = {
        name: "API 原子套装",
        agentId: "agent-b",
        driveDiscIdsBySlot: Object.fromEntries([1, 2, 3, 4, 5, 6].map(slot => [slot, `api-disc-${slot}`])),
    }
    const blockedSave = await post(baseUrl, "/api/user-drive-disc-loadouts", {
        loadout,
        reservation: { enabled: true },
    })
    assert.equal(blockedSave.response.status, 409)
    const afterBlockedSave = await (await fetch(`${baseUrl}/api/user-drive-disc-loadouts`)).json()
    assert.equal(afterBlockedSave.loadouts.length, 0)

    const transferredSave = await post(baseUrl, "/api/user-drive-disc-loadouts", {
        loadout,
        reservation: { enabled: true, allowTransfer: true },
    })
    assert.equal(transferredSave.response.status, 200)
    assert.equal(transferredSave.body.store.driveDiscLoadouts.length, 1)
    assert.ok(transferredSave.body.store.driveDiscs.every(item => item.reservedForAgentId === "agent-b"))

    console.log("Drive Disc reservation API tests passed.")
} finally {
    server?.kill("SIGTERM")
    await rm(tempRoot, { recursive: true, force: true })
}
