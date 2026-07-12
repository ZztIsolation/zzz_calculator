import { availableParallelism } from "node:os"
import { Worker } from "node:worker_threads"

import { createDriveDiscOptimizerRuntime } from "../core/driveDiscOptimizer-core.js"

function yieldNodeControl() {
    return new Promise(resolve => setImmediate(resolve))
}

export {
    OptimizerCancelledError,
    createDriveDiscOptimizerWorkerSession,
    optimizeDriveDiscs,
    previewDriveDiscOptimization,
} from "../core/driveDiscOptimizer-core.js"

async function runNodeParallel({
    catalog,
    store,
    input,
    options,
    state,
    parallelTasks,
    workerCount,
    parallelPrewarmMs,
    parallelPrewarmCutoffScore,
    resultLimit,
    hooks,
}) {
    const {
        OptimizerCancelledError,
        addParallelMetricSnapshot,
        combineParallelMetrics,
        elapsedMsSince,
        finiteScoreOrNegativeInfinity,
        insertTopResult,
        mergeParallelMetricSnapshots,
        mergeParallelResults,
        nowMs,
        percentForMetrics,
        processedCombinationCount,
    } = hooks
    const startedAtMs = Date.now()
    const workerCompletedMetrics = Array.from({ length: workerCount }, () => ({}))
    const workerCurrentMetrics = Array.from({ length: workerCount }, () => ({}))
    const taskResults = []
    const globalResults = []
    const workers = []
    const workerReadyAt = Array.from({ length: workerCount }, () => 0)
    const workerActiveStartedAt = Array.from({ length: workerCount }, () => 0)
    const workerWorkMs = Array.from({ length: workerCount }, () => 0)
    let nextTaskIndex = 0
    let assignedTaskCount = 0
    let activeTaskCount = 0
    let completedTaskCount = 0
    let taskStealCount = 0
    let workerIdleMs = 0
    let workerStartupMs = 0
    let taskDispatchMs = 0
    let globalCutoffScore = parallelPrewarmCutoffScore
    let globalCutoffUpdates = Number.isFinite(globalCutoffScore) ? 1 : 0
    let settled = false

    const metricSnapshots = () => workerCompletedMetrics.map((completed, index) =>
        mergeParallelMetricSnapshots(completed, workerCurrentMetrics[index])
    )

    const parallelStats = () => {
        const elapsedMs = Math.max(1, Date.now() - startedAtMs)
        const idleRatio = workerCount > 0
            ? Math.max(0, Math.min(1, workerIdleMs / (elapsedMs * workerCount)))
            : 0
        return {
            parallelTaskCount: parallelTasks.length,
            completedTaskCount,
            taskStealCount,
            workerIdleMs,
            workerIdleRatio: idleRatio,
            slowestWorkerMs: Math.max(0, ...workerWorkMs),
            workerStartupMs,
            taskDispatchMs,
            globalCutoffUpdates,
            globalCutoffScore,
            parallelPrewarmMs,
            parallelPrewarmCutoffScore,
        }
    }

    const emitProgress = (status = "running") => {
        const metrics = combineParallelMetrics(state.metrics, metricSnapshots(), startedAtMs, status, parallelStats())
        options.onProgress?.({
            status,
            settings: {
                ...state.settings,
                algorithm: "exact-super-bound-parallel",
            },
            metrics,
            evaluated: processedCombinationCount(metrics),
            estimatedCombinationCount: Number(metrics.estimatedCombinationCount ?? 0),
            percent: percentForMetrics(metrics, status),
        })
    }

    return await new Promise((resolve, reject) => {
        let cancelTimer = null

        const stopWorkers = () => {
            for (const worker of workers) {
                void worker.terminate()
            }
        }

        const fail = error => {
            if (settled) {
                return
            }
            settled = true
            if (cancelTimer) {
                clearInterval(cancelTimer)
            }
            stopWorkers()
            reject(error)
        }

        cancelTimer = setInterval(() => {
            if (options.shouldCancel?.()) {
                fail(new OptimizerCancelledError())
            }
        }, 100)

        const broadcastGlobalCutoff = () => {
            for (const worker of workers) {
                worker.postMessage({
                    type: "globalCutoff",
                    globalCutoffScore,
                })
            }
        }

        const updateGlobalCutoff = score => {
            const numeric = finiteScoreOrNegativeInfinity(score)
            if (numeric <= globalCutoffScore) {
                return
            }
            globalCutoffScore = numeric
            globalCutoffUpdates += 1
            broadcastGlobalCutoff()
        }

        const updateGlobalResults = result => {
            const beforeCutoff = globalResults.length >= resultLimit
                ? Number(globalResults.at(-1)?.score ?? Number.NEGATIVE_INFINITY)
                : Number.NEGATIVE_INFINITY
            for (const item of result?.results ?? []) {
                insertTopResult(globalResults, item)
            }
            const afterCutoff = globalResults.length >= resultLimit
                ? Number(globalResults.at(-1)?.score ?? Number.NEGATIVE_INFINITY)
                : Number.NEGATIVE_INFINITY
            if (Number.isFinite(afterCutoff) && afterCutoff > Math.max(beforeCutoff, globalCutoffScore)) {
                updateGlobalCutoff(afterCutoff)
            }
        }

        const finishIfReady = () => {
            if (settled || completedTaskCount < parallelTasks.length || activeTaskCount > 0) {
                return
            }
            settled = true
            if (cancelTimer) {
                clearInterval(cancelTimer)
            }
            stopWorkers()
            const metrics = combineParallelMetrics(state.metrics, metricSnapshots(), startedAtMs, "complete", parallelStats())
            const result = mergeParallelResults(taskResults, state.settings, metrics, state, catalog)
            emitProgress("complete")
            resolve(result)
        }

        const assignTask = (worker, index) => {
            if (settled) {
                return
            }
            if (nextTaskIndex >= parallelTasks.length) {
                workerReadyAt[index] = Date.now()
                finishIfReady()
                return
            }
            const now = Date.now()
            if (workerReadyAt[index]) {
                workerIdleMs += Math.max(0, now - workerReadyAt[index])
                workerReadyAt[index] = 0
            }
            const task = parallelTasks[nextTaskIndex]
            nextTaskIndex += 1
            if (assignedTaskCount >= workerCount) {
                taskStealCount += 1
            }
            assignedTaskCount += 1
            activeTaskCount += 1
            workerActiveStartedAt[index] = now
            const dispatchStartedAt = nowMs()
            worker.postMessage({
                type: "task",
                task,
                globalCutoffScore,
            })
            taskDispatchMs += elapsedMsSince(dispatchStartedAt)
        }

        for (let index = 0; index < workerCount; index += 1) {
            const workerInput = {
                ...input,
                settings: {
                    ...(input.settings ?? {}),
                    algorithm: "exact-super-bound",
                    disableParallel: true,
                },
            }
            const worker = new Worker(new URL("./driveDiscOptimizerWorker.js", import.meta.url), {
                execArgv: [],
                workerData: {
                    index,
                    catalog,
                    store,
                    input: workerInput,
                    options: {
                        chunkSize: options.chunkSize ?? 10000,
                        progressIntervalMs: options.progressIntervalMs ?? 250,
                        yieldIntervalMs: options.yieldIntervalMs ?? 50,
                    },
                },
            })
            workers.push(worker)
            worker.on("message", message => {
                if (settled || !message) {
                    return
                }
                if (message.type === "ready") {
                    workerStartupMs += Math.max(0, Date.now() - startedAtMs)
                    workerReadyAt[message.index] = Date.now()
                    assignTask(worker, message.index)
                } else if (message.type === "progress") {
                    workerCurrentMetrics[message.index] = message.progress?.metrics ?? {}
                    updateGlobalCutoff(workerCurrentMetrics[message.index]?.localCutoffScore)
                    emitProgress("running")
                } else if (message.type === "taskResult") {
                    const workerIndex = message.index
                    workerWorkMs[workerIndex] += Math.max(0, Date.now() - Number(workerActiveStartedAt[workerIndex] ?? Date.now()))
                    workerActiveStartedAt[workerIndex] = 0
                    addParallelMetricSnapshot(workerCompletedMetrics[workerIndex], message.result?.metrics ?? {})
                    workerCurrentMetrics[workerIndex] = {}
                    taskResults.push(message.result)
                    completedTaskCount += 1
                    activeTaskCount = Math.max(0, activeTaskCount - 1)
                    updateGlobalResults(message.result)
                    emitProgress("running")
                    assignTask(worker, workerIndex)
                    finishIfReady()
                } else if (message.type === "error") {
                    fail(new Error(message.error ?? "Parallel optimizer worker failed."))
                }
            })
            worker.on("error", fail)
            worker.on("exit", code => {
                if (!settled && code !== 0) {
                    fail(new Error(`Parallel optimizer worker exited with code ${code}.`))
                }
            })
        }

        emitProgress("running")
    })
}

const nodeOptimizerRuntime = createDriveDiscOptimizerRuntime({
    yieldControl: yieldNodeControl,
    availableParallelism,
    runParallel: runNodeParallel,
})

export const optimizeDriveDiscsAsync = nodeOptimizerRuntime.optimizeDriveDiscsAsync
