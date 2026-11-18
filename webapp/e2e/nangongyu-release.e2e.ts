import { expect, test } from "@playwright/test"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../../backend/calculator.js"
import { optimizeDriveDiscs } from "../../backend/driveDiscOptimizer.js"
import { nangongyuReleaseInput, nangongyuReleaseStore } from "../../tests/fixtures/nangongyu-release.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

test("Nangongyu C2 release preview survives save and reload", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("nangongyu-seeded")) return
    sessionStorage.setItem("nangongyu-seeded", "1")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default",
      byOwner: { default: { currentAgentId: "nangongyu", byAgent: { nangongyu: { cinemaLevel: 2 } } } } }))
  })
  await page.goto("/")
  await page.getByTestId("open-calculation-config").click()
  await expect(page.locator('[data-layout-field="event-multiplier"]')).toContainText("1,080%")
  await page.locator('[aria-label="计算方式"] .n-base-selection').click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: "自定义" }).click()
  const selector = page.locator('[aria-label="异放倍率方案"]')
  await selector.locator(".n-base-selection").click()
  await expect(page.locator(".n-base-select-option:visible")).toHaveCount(4)
  await page.locator(".n-base-select-option:visible").filter({ hasText: /^颤音：2层$/ }).click()
  await expect(page.locator('[data-layout-field="event-multiplier"]')).toContainText("765%")
  await page.getByRole("button", { name: "保存配置", exact: true }).click()
  await page.reload()
  await page.getByTestId("open-calculation-config").click()
  await expect(selector).toContainText("颤音：2层")
  await expect(page.locator('[data-layout-field="event-multiplier"]')).toContainText("765%")
})

test("Nangongyu cinema table saves and reloads within its maintenance container", async ({ page, request }, testInfo) => {
  test.skip(!path.basename(process.env.ZZZ_CALCULATOR_DATA_DIR || "").startsWith("zzz-agent-browser-"), "Requires a disposable maintenance catalog")
  test.setTimeout(60_000)
  const read = async () => (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = (await read()).agents.agents.find((agent: any) => agent.id === "nangongyu")
  try {
    await page.goto("/maintenance")
    await page.locator(".record-option").filter({ hasText: "南宫羽" }).click()
    const profile = page.locator(".anomaly-release-profiles > details").filter({ has: page.locator("summary strong").filter({ hasText: /^颤音：4层$/ }) })
    const table = profile.locator(".release-cinema-values")
    await expect(table.locator("input")).toHaveCount(7)
    const input = table.locator("input").nth(2)
    await input.fill("36")
    await input.blur()
    const saved = page.waitForResponse(response => response.url().endsWith("/api/maintenance/agents") && response.request().method() === "POST")
    await page.getByRole("button", { name: "保存", exact: true }).first().click()
    expect((await saved).ok()).toBe(true)
    await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
    await page.reload()
    await page.locator(".record-option").filter({ hasText: "南宫羽" }).click()
    await expect(input).toHaveValue("36")
    const current = (await read()).agents.agents.find((agent: any) => agent.id === "nangongyu")
    const constant = current.anomalyReleaseProfiles.find((p: any) => p.id === "core_tremolo_4").expression.args[1].args[1].args[1]
    expect(constant.cinemaValues).toEqual([25, 25, 36, 35, 35, 35, 35])
    expect(current.anomalyReleaseProfiles.filter((p: any) => p.id.startsWith("cinema6_")).every((p: any) => p.minimumCinemaLevel === 6)).toBe(true)
    await table.scrollIntoViewIfNeeded()
    expect(await table.evaluate(element => Array.from(element.querySelectorAll("input")).every(input => {
      const box = input.getBoundingClientRect(), parent = element.getBoundingClientRect()
      return box.width > 0 && box.left >= parent.left - 1 && box.right <= parent.right + 1
    }))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("cinema-maintenance.png") })
  } finally {
    const data = await read()
    expect((await request.post("/api/maintenance/agents", { headers: { "If-Match": `"${data.agentRevisions.nangongyu}"` }, data: original })).ok()).toBe(true)
  }
})

test("built Worker preserves Nangongyu cinema growth between runs", async ({ page }) => {
  test.setTimeout(90_000)
  const asset = readdirSync(path.join(root, "dist/pages/static/app")).find(name => /^optimizer\.worker-.*\.js$/.test(name))!
  const catalog = await loadCalculatorContext(root)
  const store = nangongyuReleaseStore()
  const inputs = [nangongyuReleaseInput(0), nangongyuReleaseInput(2)]
  const truth = inputs.map(input => optimizeDriveDiscs(catalog, store, input))
  const serialized = JSON.stringify(catalog, (_key, value) => value instanceof Map ? { mapEntries: [...value] } : value)
  await page.route("**/__nangongyu_worker__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Release Worker</title>" }))
  await page.goto("/__nangongyu_worker__")
  const results = await page.evaluate(async ({ url, serialized, inputs, store }) => {
    const worker = new Worker(url, { type: "module" })
    try {
      worker.postMessage({ type: "init-catalog", catalog: JSON.parse(serialized, (_key, value) => value?.mapEntries ? new Map(value.mapEntries) : value), catalogKey: "release-cinema" })
      const results: any[] = []
      for (const input of inputs) results.push(await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Worker timeout")), 30_000)
        worker.onerror = error => { clearTimeout(timer); reject(new Error(error.message)) }
        worker.onmessage = event => {
          if (event.data.type === "complete") { clearTimeout(timer); resolve(event.data.result) }
          if (event.data.type === "error") { clearTimeout(timer); reject(new Error(event.data.error)) }
        }
        worker.postMessage({ type: "start", runId: `cinema-${input.cinemaLevel}`, input, store, settings: { yieldIntervalMs: 0, progressIntervalMs: 0 } })
      }))
      return results
    } finally { worker.terminate() }
  }, { url: `/static/app/${asset}`, serialized, inputs, store })
  results.forEach((result, cinema) => {
    expect(result.results.map((row: any) => row.driveDiscIdsBySlot)).toEqual(truth[cinema].results.map(row => row.driveDiscIdsBySlot))
    result.results.forEach((row: any, index: number) => expect(row.score).toBeCloseTo(truth[cinema].results[index].score, 6))
  })
  expect(results[1].results[0].score / results[0].results[0].score).toBeCloseTo(1.2, 10)
})
