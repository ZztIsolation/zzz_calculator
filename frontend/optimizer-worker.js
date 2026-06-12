import {
    OptimizerCancelledError,
    optimizeDriveDiscsAsync,
    previewDriveDiscOptimization,
} from "./driveDiscOptimizer-core.js"

let activeRunId = null
let cancelledRunIds = new Set()

function post(type, payload = {}) {
    globalThis.postMessage({
        type,
        ...payload,
    })
}

function isCancelled(runId) {
    return cancelledRunIds.has(runId) || activeRunId !== runId
}

function normalizeWorkerInput(input = {}) {
    const algorithm = input.settings?.algorithm === "exact-super-bound-parallel"
        ? "exact-super-bound"
        : input.settings?.algorithm
    return {
        ...input,
        settings: {
            ...(input.settings ?? {}),
            algorithm: algorithm ?? "exact-super-bound",
            disableParallel: true,
        },
    }
}

globalThis.onmessage = async event => {
    const message = event.data ?? {}
    if (message.type === "cancel") {
        if (message.runId) {
            cancelledRunIds.add(message.runId)
        } else if (activeRunId) {
            cancelledRunIds.add(activeRunId)
        }
        return
    }

    if (message.type !== "start") {
        return
    }

    const runId = message.runId
    activeRunId = runId
    cancelledRunIds.delete(runId)
    const startedAt = Date.now()
    const input = normalizeWorkerInput(message.input)

    try {
        const preview = previewDriveDiscOptimization(message.catalog, message.store, input)
        post("preview", {
            runId,
            job: {
                status: "preview",
                ...preview,
                elapsedMs: Date.now() - startedAt,
            },
        })

        const result = await optimizeDriveDiscsAsync(message.catalog, message.store, input, {
            progressIntervalMs: message.settings?.progressIntervalMs ?? 250,
            yieldIntervalMs: message.settings?.yieldIntervalMs ?? 50,
            shouldCancel: () => isCancelled(runId),
            onProgress: progress => {
                post("progress", {
                    runId,
                    job: {
                        status: progress.status ?? "running",
                        ...progress,
                        elapsedMs: Date.now() - startedAt,
                    },
                })
            },
        })

        if (isCancelled(runId)) {
            post("cancelled", {
                runId,
                job: {
                    status: "cancelled",
                    elapsedMs: Date.now() - startedAt,
                },
            })
            return
        }

        post("complete", {
            runId,
            job: {
                status: "complete",
                result,
                settings: result.settings,
                metrics: result.metrics,
                elapsedMs: Date.now() - startedAt,
            },
        })
    } catch (error) {
        const cancelled = error instanceof OptimizerCancelledError || isCancelled(runId)
        post(cancelled ? "cancelled" : "error", {
            runId,
            job: {
                status: cancelled ? "cancelled" : "error",
                error: error?.message ?? String(error),
                elapsedMs: Date.now() - startedAt,
            },
        })
    } finally {
        if (activeRunId === runId) {
            activeRunId = null
        }
        cancelledRunIds.delete(runId)
    }
}
