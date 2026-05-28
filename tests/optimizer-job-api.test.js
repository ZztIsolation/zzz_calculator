import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = 19000 + Math.floor(Math.random() * 1000)
const baseUrl = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ["backend/server.js"], {
    cwd: rootDir,
    env: {
        ...process.env,
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

async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
        ...options,
    })
    const json = await response.json()
    if (!response.ok || json.ok === false) {
        throw new Error(json.error || response.statusText)
    }
    return json
}

async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
            await request("/api/health")
            return
        } catch {
            await sleep(100)
        }
    }
    throw new Error(`Server did not start.\n${serverOutput}`)
}

try {
    await waitForServer()
    const meta = await request("/api/meta")
    const example = await request("/api/example/ye-shunguang")
    const fourPieceSetId = meta.driveDiscSets[0].id
    const payload = {
        ...example.input,
        driveDiscs: [],
        settings: {
            fourPieceSetId,
            objective: "damage",
            mainStatLimits: {
                4: ["__never_a_real_stat__"],
            },
        },
    }
    const previewResponse = await request("/api/optimize/drive-discs/preview", {
        method: "POST",
        body: JSON.stringify(payload),
    })
    assert.equal(previewResponse.data.metrics.estimatedCombinationCount, 0)
    assert.equal(previewResponse.data.error.isError, true)

    const createResponse = await request("/api/optimize/drive-discs/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
    })
    const jobId = createResponse.data.jobId
    assert.ok(jobId)
    assert.equal(createResponse.data.estimatedCombinationCount, 0)
    assert.ok(["running", "complete"].includes(createResponse.data.status))

    let job = createResponse.data
    for (let attempt = 0; attempt < 20 && job.status !== "complete"; attempt += 1) {
        await sleep(50)
        job = (await request(`/api/optimize/drive-discs/jobs/${encodeURIComponent(jobId)}`)).data
    }
    assert.equal(job.status, "complete")
    assert.equal(job.percent, 100)
    assert.equal(job.result.results.length, 0)
    assert.equal(job.result.error.isError, true)

    const deleteResponse = await request(`/api/optimize/drive-discs/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
    })
    assert.equal(deleteResponse.data.jobId, jobId)
} finally {
    server.kill()
}
