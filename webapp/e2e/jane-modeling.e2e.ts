import { expect, test } from "@playwright/test"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCalculatorContext } from "../../backend/calculator.js"
import { optimizeDriveDiscs } from "../../backend/driveDiscOptimizer.js"
import { janeOptimizerInput, janeOptimizerStore } from "../../tests/fixtures/jane-optimizer.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

test("Jane P6 default, explicit P0, C6 notice and single Assault survive reload", async ({ page, request }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => {
    if (sessionStorage.getItem("jane-seeded")) return
    sessionStorage.setItem("jane-seeded", "1")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default",
      byOwner: { default: { currentAgentId: "jane_doe", byAgent: { jane_doe: {} } } } }))
  })
  await page.goto("/")
  const potential = page.locator(".compact-field").filter({ has: page.getByText("潜能影像", { exact: true }) })
  await expect(potential).toContainText("P6")
  await expect(page.locator("body")).toContainText("强击")
  await potential.locator(".n-base-selection").click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: "P0" }).click()
  await page.reload()
  await expect(potential).toContainText("P0")
  const cinema = page.locator(".compact-field").filter({ has: page.getByText("影画", { exact: true }) })
  await cinema.locator(".n-base-selection").click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: "6" }).click()
  await expect(page.getByTestId("unmodeled-cinema-notice")).toContainText("1600%")
  await page.reload()
  await expect(potential).toContainText("P0")
  await expect(page.getByTestId("unmodeled-cinema-notice")).toBeVisible()
  await page.getByTestId("open-buff-picker").click()
  const frenzy = page.locator('[data-buff-id="agent:jane_doe.skill.frenzy"]')
  const core = page.locator('[data-buff-id="agent:jane_doe.corePassive"]')
  await expect(frenzy).toContainText("普通攻击｜狂热")
  await expect(core).not.toContainText("600")
  await expect(frenzy.getByRole("checkbox").first()).toBeChecked()
  await frenzy.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await page.reload()
  await page.getByTestId("open-buff-picker").click()
  await expect(frenzy.getByRole("checkbox").first()).not.toBeChecked()
  await expect(core.getByRole("checkbox").first()).toBeChecked()
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath("jane-workbench.png"), fullPage: true })
  const catalog = await (await request.get("/api/maintenance/catalog")).json()
  expect(catalog.data.combatBuffs.teammates.find((g: any) => g.id === "jane_doe").buffs).toHaveLength(3)
})

test("Jane maintenance roundtrip preserves dynamic targets and follows edited Core parameters", async ({ page, request }, testInfo) => {
  test.skip(!path.basename(path.dirname(process.env.ZZZ_CALCULATOR_DATA_DIR || "")).startsWith("zzz-agent-browser-"), "Requires a disposable maintenance catalog")
  test.setTimeout(60_000)
  const read = async () => (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = (await read()).agents.agents.find((a: any) => a.id === "jane_doe")
  try {
    await page.goto("/maintenance")
    await page.locator(".record-option").filter({ hasText: "简·杜" }).click()
    await expect(page.locator(".maintenance-editor-head")).toContainText("简·杜")
    const frenzyCard = page.locator(".skill-buff-card").filter({ hasText: "狂热" })
    const source = frenzyCard.locator(".maintenance-field").filter({ has: page.getByText("来源招式", { exact: true }) })
    await expect(source).toContainText("整个技能目录")
    await source.locator(".n-base-selection").click()
    await page.locator(".n-base-select-option:visible").filter({ hasText: /^普通攻击：跳步刃舞$/ }).click()
    await expect(source).toContainText("普通攻击：跳步刃舞")
    await source.locator(".n-base-selection").click()
    await page.locator(".n-base-select-option:visible").filter({ hasText: "整个技能目录" }).click()
    await page.getByRole("button", { name: "管理默认循环", exact: true }).click()
    const name = page.locator(".maintenance-field").filter({ has: page.getByText("方案名称", { exact: true }) }).locator("input")
    await expect(name).toHaveValue("单次物理异常")
    await name.fill("单次物理异常测试")
    await page.getByRole("button", { name: "应用", exact: true }).click()
    const coefficient = page.locator(".core-scaling-table tr").first().locator("label").filter({ hasText: "每点异常精通增加强击暴击率%" }).locator("input")
    await coefficient.fill("0.09")
    await coefficient.press("Enter")
    await coefficient.blur()
    await expect(coefficient).toHaveValue("0.09")
    const pending = page.waitForResponse(r => r.url().endsWith("/api/maintenance/agents") && r.request().method() === "POST")
    await page.getByRole("button", { name: "保存", exact: true }).first().click()
    expect((await pending).ok()).toBe(true)
    await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
    await page.reload()
    await page.locator(".record-option").filter({ hasText: "简·杜" }).click()
    await expect(coefficient).toHaveValue("0.09")
    const current = (await read()).agents.agents.find((a: any) => a.id === "jane_doe")
    const crit = current.combatBuffs.corePassive.effects.find((r: any) => r.formula?.parameterSources)
    expect(crit.stat).toBe("anomalyCritRate")
    expect(crit.target).toEqual({ kind: "anomaly", settlementType: "attribute", anomalyEffects: ["assault"] })
    expect(crit.formula.parameters.rate).toBe(.09)
    expect(current.defaultCalculationConfig.name.zhCN).toBe("单次物理异常测试")
    expect(current.potentialVision.defaultLevel).toBe(6)
    expect(current.combatBuffs.skillBuffs.find((b: any) => b.id === "frenzy").sourceSkillRef).toEqual({ agentSkillId: "jane_doe", categoryId: "basic" })
    await expect(source).toContainText("整个技能目录")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("jane-maintenance.png"), fullPage: true })
  } finally {
    const data = await read()
    expect((await request.post("/api/maintenance/agents", { headers: { "If-Match": `"${data.agentRevisions.jane_doe}"` }, data: original })).ok()).toBe(true)
  }
})

for (const critMode of ["expected", "crit", "nonCrit"]) {
test(`Jane built browser Worker matches ${critMode} Top 10 and supports cancellation and reuse`, async ({ page }) => {
  test.setTimeout(90_000)
  const asset = readdirSync(path.join(root, "dist/pages/static/app")).find(name => /^optimizer\.worker-.*\.js$/.test(name))!
  const catalog = await loadCalculatorContext(root)
  const serialized = JSON.stringify(catalog, (_k, value) => value instanceof Map ? { mapEntries: [...value] } : value)
  const input = janeOptimizerInput()
  input.damage.events[0].critMode = critMode
  const store = janeOptimizerStore()
  const truth = optimizeDriveDiscs(catalog, store, { ...input, settings: { ...input.settings, algorithm: "exact-legacy", enableUpperBoundPruning: false } })
  await page.route("**/__jane_worker__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Jane Worker</title>" }))
  await page.goto("/__jane_worker__")
  const result = await page.evaluate(async ({ url, serialized, input, store, large }) => {
    const worker = new Worker(url, { type: "module" })
    const catalog = JSON.parse(serialized, (_k, v) => v?.mapEntries ? new Map(v.mapEntries) : v)
    let progress = 0
    const run = (runId: string, store: any, cancel = false): Promise<any> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Worker timeout")), 30_000)
      worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message)) }
      worker.onmessage = ({ data }) => {
        if (data.runId !== runId) return
        if (data.type === "progress") progress++
        if (cancel && data.type === "preview") worker.postMessage({ type: "cancel", runId })
        if (["complete", "cancelled", "error"].includes(data.type)) {
          clearTimeout(timer)
          data.type === "error" ? reject(new Error(data.error)) : resolve(data)
        }
      }
      worker.postMessage({ type: "start", runId, input, store, settings: { yieldIntervalMs: 0, progressIntervalMs: 0 } })
    })
    worker.postMessage({ type: "init-catalog", catalog, catalogKey: "jane-test" })
    try { return { first: await run("first", store), cancelled: await run("cancel", large, true), again: await run("again", store), progress } }
    finally { worker.terminate() }
  }, { url: `/static/app/${asset}`, serialized, input, store, large: janeOptimizerStore(8) })
  expect(result.cancelled.type).toBe("cancelled")
  expect(result.progress).toBeGreaterThan(0)
  for (const r of [result.first, result.again]) {
    expect(r.type).toBe("complete")
    expect(r.result.results.map((x: any) => x.driveDiscIdsBySlot)).toEqual(truth.results.map((x: any) => x.driveDiscIdsBySlot))
    r.result.results.forEach((x: any, i: number) => expect(x.score).toBeCloseTo(truth.results[i].score, 6))
  }
})
}

test("Jane anomaly outcomes persist while Core CRIT and Frenzy stay independent", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("jane-crit-seeded")) return
    sessionStorage.setItem("jane-crit-seeded", "1")
    const config = { coreSkillLevel: "F", potentialLevel: 0, cinemaLevel: 0, wEngineId: "zzz_wiki_760", discMode: "manual",
      damage: { mode: "custom", selectedEventId: "assault", events: [{ id: "assault", kind: "anomaly", settlementType: "attribute",
        anomalyEffect: "assault", count: 1, procCount: 1, stunned: true, critMode: "expected" }] } }
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default",
      byOwner: { default: { currentAgentId: "jane_doe", byAgent: { jane_doe: config } } } }))
  })
  await page.goto("/")
  await expect(page.locator(".damage-current-mode")).toHaveText("当前模式：期望")
  for (const label of ["暴击", "非暴击"]) {
    await page.getByTestId("open-calculation-config").click()
    await page.getByLabel("暴击模式", { exact: true }).click()
    await page.locator(".n-base-select-option:visible").filter({ hasText: new RegExp(`^${label}$`) }).click()
    await page.getByRole("button", { name: "保存配置", exact: true }).click()
    await page.reload()
    await expect(page.locator(".damage-current-mode")).toHaveText(`当前模式：${label}`)
  }
  const core = page.locator('[data-buff-id="agent:jane_doe.corePassive"]').getByRole("checkbox").first()
  const frenzy = page.locator('[data-buff-id="agent:jane_doe.skill.frenzy"]').getByRole("checkbox").first()
  await page.getByTestId("open-buff-picker").click()
  await core.click()
  await expect(frenzy).toBeChecked()
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await page.reload()
  await expect(page.locator(".damage-whitebox-current")).toBeVisible()
  await expect(page.locator(".damage-selected-variants")).toHaveCount(0)
  await page.getByTestId("open-calculation-config").click()
  await expect(page.getByLabel("暴击模式", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "取消", exact: true }).click()
  await page.getByTestId("open-buff-picker").click()
  await expect(core).not.toBeChecked()
  await expect(frenzy).toBeChecked()
  await core.click()
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await expect(page.locator(".damage-current-mode")).toHaveText("当前模式：非暴击")
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1")!).byOwner.default.byAgent.jane_doe)
  expect(stored.damage.events[0].critMode).toBe("nonCrit")
  expect(stored.combat.janeFrenzySplitVersion).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator(".damage-whitebox-current").screenshot({ path: testInfo.outputPath("jane-anomaly-outcomes.png") })
})
