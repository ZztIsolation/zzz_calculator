import { expect, test } from "@playwright/test"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../../backend/calculator.js"
import { optimizeDriveDiscs } from "../../backend/driveDiscOptimizer.js"
import { severianOptimizerInput, severianOptimizerStore } from "../../tests/fixtures/severian-optimizer.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

test("released Severian and its weapon appear in player selectors", async ({ page, request }) => {
  const meta = await (await request.get("/api/meta")).json()
  const payload = meta.data ?? meta
  expect(payload.displayAgents.some((a: any) => a.id === "severian_lowell")).toBe(true)
  expect(payload.displayWEngines.some((w: any) => w.id === "zzz_wiki_2305")).toBe(true)
  await page.goto("/")
  await expect(page.getByTestId("open-calculation-config")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test("Severian formula survives maintenance edit, save and reload", async ({ page, request }, testInfo) => {
  test.skip(!path.basename(process.env.ZZZ_CALCULATOR_DATA_DIR || "").startsWith("zzz-agent-browser-"), "Requires disposable maintenance catalog")
  const read = async () => (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = (await read()).agents.agents.find((a: any) => a.id === "severian_lowell")
  try {
    await page.goto("/maintenance")
    await page.locator(".record-option").filter({ hasText: "赛维里安" }).click()
    const expression = page.locator("input, textarea").filter({ visible: true })
    // Locate by stored formula value, independent of translated field labels.
    const index = await expression.evaluateAll(elements => elements.findIndex(e => (e as HTMLInputElement).value === "min(max(x, 0), 100) * 8.5"))
    expect(index).toBeGreaterThanOrEqual(0)
    const field = expression.nth(index)
    await field.fill("min(max(x, 0), 100) * 8.50")
    await field.blur()
    const saved = page.waitForResponse(r => r.url().endsWith("/api/maintenance/agents") && r.request().method() === "POST")
    await page.getByRole("button", { name: "保存", exact: true }).first().click()
    expect((await saved).ok()).toBe(true)
    await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
    await page.reload()
    await page.locator(".record-option").filter({ hasText: "赛维里安" }).click()
    const current = (await read()).agents.agents.find((a: any) => a.id === "severian_lowell")
    expect(current.combatBuffs.additionalAbility.effects[0]).toMatchObject({ stat: "atkFlat", source: { stat: "critRate", unit: "storedPercent" }, formula: { expression: "min(max(x, 0), 100) * 8.50", valueUnit: "storedValue" } })
    expect(current.hidden).toBe(false)
    expect(current.combatBuffs.corePassive.effects[2].coverage.default).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("severian-maintenance.png") })
  } finally {
    const data = await read()
    expect((await request.post("/api/maintenance/agents", { headers: { "If-Match": `"${data.agentRevisions.severian_lowell}"` }, data: original })).ok()).toBe(true)
  }
})

test("built Worker applies Severian crit conversion and six-cinema additive multiplier", async ({ page }) => {
  test.setTimeout(90_000)
  const asset = readdirSync(path.join(root, "dist/pages/static/app")).find(name => /^optimizer\.worker-.*\.js$/.test(name))!
  const catalog = await loadCalculatorContext(root), store = severianOptimizerStore()
  const inputs = [severianOptimizerInput(0), severianOptimizerInput(6)]
  const truth = inputs.map(input => optimizeDriveDiscs(catalog, store, input))
  const serialized = JSON.stringify(catalog, (_key, value) => value instanceof Map ? { mapEntries: [...value] } : value)
  await page.route("**/__severian_worker__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Severian Worker</title>" }))
  await page.goto("/__severian_worker__")
  const results = await page.evaluate(async ({ url, serialized, inputs, store }) => {
    const worker = new Worker(url, { type: "module" })
    try {
      worker.postMessage({ type: "init-catalog", catalog: JSON.parse(serialized, (_key, v) => v?.mapEntries ? new Map(v.mapEntries) : v), catalogKey: "severian" })
      const results: any[] = []
      for (const input of inputs) results.push(await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Worker timeout")), 30_000)
        worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message)) }
        worker.onmessage = e => {
          if (e.data.type === "complete") { clearTimeout(timer); resolve(e.data.result) }
          if (e.data.type === "error") { clearTimeout(timer); reject(new Error(e.data.error)) }
        }
        worker.postMessage({ type: "start", runId: `severian-${input.cinemaLevel}`, input, store, settings: { yieldIntervalMs: 0, progressIntervalMs: 0 } })
      }))
      return results
    } finally { worker.terminate() }
  }, { url: `/static/app/${asset}`, serialized, inputs, store })
  results.forEach((r, i) => {
    expect(r.results.map((x: any) => x.driveDiscIdsBySlot)).toEqual(truth[i].results.map(x => x.driveDiscIdsBySlot))
    r.results.forEach((x: any, n: number) => expect(x.score).toBeCloseTo(truth[i].results[n].score, 6))
  })
  expect(results[1].results[0].score / results[0].results[0].score).toBeCloseTo((4056.1 + 350) / 4056.1, 10)
})
