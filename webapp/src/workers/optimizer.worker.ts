import { createDriveDiscOptimizerRuntime } from "@core/driveDiscOptimizer-core.js"

const browserOptimizerRuntime = createDriveDiscOptimizerRuntime({
  yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
})

let activeRunId = ""
let cancelRequested = false
let cachedCatalog: any = null
let cachedCatalogKey = ""

function post(type: string, payload: Record<string, any> = {}) {
  self.postMessage({
    type,
    ...payload,
  })
}

function normalizeWorkerInput(input: any = {}) {
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

self.onmessage = async event => {
  const message = event.data ?? {}
  if (message.type === "init-catalog") {
    cachedCatalog = message.catalog
    cachedCatalogKey = String(message.catalogKey ?? "")
    post("catalog-ready", { catalogKey: cachedCatalogKey })
    return
  }
  if (message.catalog) {
    cachedCatalog = message.catalog
    cachedCatalogKey = String(message.catalogKey ?? cachedCatalogKey)
  }
  const catalog = cachedCatalog
  if (message.type === "cancel") {
    if (!message.runId || message.runId === activeRunId) {
      cancelRequested = true
    }
    return
  }

  if (message.type === "preview") {
    try {
      if (!catalog) {
        throw new Error("Optimizer catalog is not initialized.")
      }
      const preview = browserOptimizerRuntime.createJob(catalog, message.store, normalizeWorkerInput(message.input)).preview()
      post("preview", { runId: message.runId, preview })
    } catch (error) {
      post("error", { runId: message.runId, error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (message.type !== "start") {
    return
  }

  activeRunId = message.runId
  cancelRequested = false
  const startedAt = Date.now()
  const input = normalizeWorkerInput(message.input)
  try {
    if (!catalog) {
      throw new Error("Optimizer catalog is not initialized.")
    }
    post("started", {
      runId: message.runId,
      job: {
        status: "preparing",
        elapsedMs: 0,
      },
    })

    const job = browserOptimizerRuntime.createJob(catalog, message.store, input, {
      onProgress: (progress: any) => {
        post("progress", {
          runId: message.runId,
          job: {
            status: progress.status ?? "preparing",
            ...progress,
            elapsedMs: Date.now() - startedAt,
          },
        })
      },
    })
    const preview = job.preview()
    post("preview", {
      runId: message.runId,
      job: {
        status: "preview",
        ...preview,
        evaluated: 0,
        estimatedCombinationCount: preview.metrics?.estimatedCombinationCount ?? 0,
        percent: 0,
        elapsedMs: Date.now() - startedAt,
      },
    })

    const result = await job.run({
      chunkSize: 5000,
      progressIntervalMs: message.settings?.progressIntervalMs ?? 200,
      yieldIntervalMs: message.settings?.yieldIntervalMs ?? 50,
      shouldCancel: () => cancelRequested,
      onProgress: (progress: any) => {
        post("progress", {
          runId: message.runId,
          job: {
            status: progress.status ?? "running",
            ...progress,
            elapsedMs: Date.now() - startedAt,
          },
        })
      },
    })
    post(cancelRequested ? "cancelled" : "complete", {
      runId: message.runId,
      result,
      job: {
        status: cancelRequested ? "cancelled" : "complete",
        result,
        settings: result.settings,
        metrics: result.metrics,
        elapsedMs: Date.now() - startedAt,
      },
    })
  } catch (error) {
    post(cancelRequested ? "cancelled" : "error", {
      runId: message.runId,
      error: error instanceof Error ? error.message : String(error),
      job: {
        status: cancelRequested ? "cancelled" : "error",
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startedAt,
      },
    })
  } finally {
    if (activeRunId === message.runId) {
      activeRunId = ""
      cancelRequested = false
    }
  }
}
