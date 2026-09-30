import { test, expect } from "@playwright/test"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../../backend/calculator.js"
import { optimizeDriveDiscs } from "../../backend/driveDiscOptimizer.js"
import { velinaOptimizerInput, velinaOptimizerStore } from "../../tests/fixtures/velina-optimizer.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

for (const useDefaults of [false, true]) {
test(`Velina built Worker preserves exact Top 10, progress, cancellation and reuse (defaults=${useDefaults})`, async ({ page }) => {
  test.setTimeout(90_000)
  const assets = readdirSync(path.join(root, "dist/pages/static/app"))
    .filter(name => /^optimizer\.worker-.*\.js$/.test(name))
  expect(assets).toHaveLength(1)
  const catalog = await loadCalculatorContext(root)
  const catalogData = JSON.stringify(catalog, (_key, value) => value instanceof Map ? { testMapEntries: [...value] } : value)
  const input = velinaOptimizerInput({ recommended: true, freeTwoPiece: true })
  if (useDefaults) delete input.settings.twoPieceSetIds
  input.combatBuffs.activeBuffIds.push("agent:velina.cinema.2", "agent:velina.cinema.6", "wEngine:zzz_wiki_2030.self")
  const store = velinaOptimizerStore({ variants: 2, recommended: true, variableEnergy: true, freeTwoPiece: true })
  store.driveDiscs.push(...store.driveDiscs.filter((disc: any) => disc.setId === "swing_jazz")
    .map((disc: any) => ({ ...disc, id: `moonlight-${disc.id}`, setId: "moonlight_lullaby" })))
  const truth = optimizeDriveDiscs(catalog, store, { ...input, settings: { ...input.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } })
  const largeStore = velinaOptimizerStore({ variants: 12, recommended: true, variableEnergy: true, freeTwoPiece: true })
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.route("**/__velina-worker-test__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Optimizer Worker regression</title>" }))
  await page.goto("/__velina-worker-test__")
  const result = await page.evaluate(async ({ workerUrl, catalogData, input, store, largeStore }) => {
    const worker = new Worker(workerUrl, { type: "module" })
    const catalog = JSON.parse(catalogData, (_key, value) => value?.testMapEntries ? new Map(value.testMapEntries) : value)
    localStorage.setItem("velina-optimizer-sentinel", "preserved")
    const progress: any[] = []
    const run = (runId: string, inventory: any, cancel = false): Promise<any> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Worker timeout")), 30_000)
      worker.onerror = error => { clearTimeout(timer); reject(new Error(error.message)) }
      worker.onmessage = ({ data }) => {
        if (data.runId !== runId) return
        if (data.type === "progress") progress.push({ ...data.job, runId: data.runId })
        if (cancel && data.type === "preview") worker.postMessage({ type: "cancel", runId })
        if (["complete", "cancelled", "error"].includes(data.type)) {
          clearTimeout(timer)
          if (data.type === "error") reject(new Error(data.error))
          else resolve(data)
        }
      }
      worker.postMessage({ type: "start", runId, input, store: inventory, settings: { yieldIntervalMs: 0, progressIntervalMs: 0 } })
    })
    worker.postMessage({ type: "init-catalog", catalog, catalogKey: "velina-test" })
    try {
      const complete = await run("first", store)
      const cancelled = await run("cancel", largeStore, true)
      const again = await run("again", store)
      return { complete, cancelType: cancelled.type, again, progress, sentinel: localStorage.getItem("velina-optimizer-sentinel") }
    } finally {
      worker.terminate()
    }
  }, { workerUrl: `/static/app/${assets[0]}`, catalogData, input, store, largeStore })

  expect(result.cancelType).toBe("cancelled")
  expect(result.sentinel).toBe("preserved")
  expect(errors).toEqual([])
  expect(result.progress.length).toBeGreaterThan(0)
  for (const run of [result.complete, result.again]) {
    expect(run.type).toBe("complete")
    expect(run.result.settings.twoPieceSetIds).toEqual(useDefaults ? ["swing_jazz", "moonlight_lullaby"] : [])
    expect(run.result.results.map((row: any) => row.driveDiscIdsBySlot)).toEqual(truth.results.map((row: any) => row.driveDiscIdsBySlot))
    run.result.results.forEach((row: any, i: number) => expect(row.score).toBeCloseTo(truth.results[i].score, 6))
    const metrics = run.result.metrics
    expect(metrics.strictExact).toBe(true)
    expect(metrics.scoreKernel).toBe("compiled-dense")
    expect(metrics.scoreKernelFallbackReason).toBeNull()
    expect(metrics.objectiveScalarCalls).toBeGreaterThan(0)
    expect(metrics.prunedBySuperBound).toBeGreaterThan(0)
    expect(metrics.processedCombinationCount).toBe(metrics.estimatedCombinationCount)
    expect(metrics.scoredCombinationCount + metrics.prunedBySuperBound).toBe(metrics.estimatedCombinationCount)
    expect(result.progress.filter((progress: any) => progress.runId === run.runId).at(-1)?.percent).toBe(100)
  }
})
}
