import { parentPort, workerData } from "node:worker_threads"
import { createDriveDiscOptimizerWorkerSession } from "./driveDiscOptimizer.js"

const {
    index = 0,
    catalog,
    store,
    input,
    options = {},
} = workerData ?? {}

let running = false
let cancelled = false
let latestGlobalCutoffScore = Number.NEGATIVE_INFINITY
let session = null

function post(message) {
    parentPort?.postMessage({
        index,
        ...message,
    })
}

async function runTask(task, initialGlobalCutoffScore = Number.NEGATIVE_INFINITY) {
    if (running) {
        post({ type: "error", error: "Parallel optimizer worker received overlapping tasks." })
        return
    }
    running = true
    latestGlobalCutoffScore = Math.max(
        latestGlobalCutoffScore,
        Number.isFinite(Number(initialGlobalCutoffScore)) ? Number(initialGlobalCutoffScore) : Number.NEGATIVE_INFINITY,
    )

    try {
        const result = await session.runTask(task, {
            globalCutoffScore: latestGlobalCutoffScore,
            chunkSize: options.chunkSize ?? 10000,
            progressIntervalMs: options.progressIntervalMs ?? 250,
            yieldIntervalMs: options.yieldIntervalMs ?? 50,
            shouldCancel: () => cancelled,
            getGlobalCutoffScore: () => latestGlobalCutoffScore,
            onProgress: progress => {
                post({
                    type: "progress",
                    taskId: task?.taskId,
                    progress,
                })
            },
        })
        post({
            type: "taskResult",
            taskId: task?.taskId,
            result,
        })
    } catch (error) {
        post({
            type: "error",
            taskId: task?.taskId,
            error: error instanceof Error ? error.message : String(error),
        })
    } finally {
        running = false
    }
}

parentPort?.on("message", message => {
    if (!message) {
        return
    }
    if (message.type === "globalCutoff") {
        const score = Number(message.globalCutoffScore)
        if (Number.isFinite(score) && score > latestGlobalCutoffScore) {
            latestGlobalCutoffScore = score
        }
        return
    }
    if (message.type === "stop") {
        cancelled = true
        parentPort?.close()
        return
    }
    if (message.type === "task") {
        runTask(message.task, message.globalCutoffScore)
    }
})

try {
    session = createDriveDiscOptimizerWorkerSession(catalog, store, input)
    post({ type: "ready" })
} catch (error) {
    post({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
    })
}
