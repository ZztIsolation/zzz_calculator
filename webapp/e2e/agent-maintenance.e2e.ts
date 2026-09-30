import { expect, test, type Page } from "@playwright/test"
import path from "node:path"

// This spec writes catalogs. The dedicated runner supplies a disposable data directory.
test.skip(!path.basename(path.dirname(process.env.ZZZ_CALCULATOR_DATA_DIR || "")).startsWith("zzz-agent-browser-"), "Run with the isolated agent-maintenance browser runner")

async function selectVelina(page: Page) {
  await page.goto("/maintenance")
  await page.locator(".record-option").filter({ hasText: "维琳娜" }).click()
  await expect(page.locator(".maintenance-editor-head")).toContainText("维琳娜")
}
function nameInput(page: Page) {
  return page.locator(".maintenance-field").filter({ has: page.getByText("中文名称", { exact: true }) }).locator("input").first()
}

test("default two-piece choices can be edited, previewed, saved and cleared", async ({ page, request }, testInfo) => {
  test.setTimeout(60_000)
  const readCatalog = async () => (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = (await readCatalog()).agents.agents.find((agent: any) => agent.id === "velina")
  const field = page.locator(".maintenance-field").filter({ has: page.getByText("默认 2 件套", { exact: true }) })
  const save = async () => {
    const response = page.waitForResponse(response => response.url().endsWith("/api/maintenance/agents") && response.request().method() === "POST")
    await page.getByRole("button", { name: "保存", exact: true }).first().click()
    expect((await response).ok()).toBe(true)
    await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
  }
  const toggleSet = async (label: string) => {
    // Click the padding: the center may be a selected tag's remove button.
    await field.locator(".n-base-selection").click({ position: { x: 5, y: 5 } })
    await field.locator("input").fill(label)
    await page.locator(".n-base-select-option:visible").filter({ hasText: label }).click()
    await page.getByRole("heading", { name: "优先驱动盘", exact: true }).click()
    await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0)
  }
  try {
    await selectVelina(page)
    await expect(field).toContainText("摇摆爵士")
    await expect(field).toContainText("月光骑士颂")
    await toggleSet("摇摆爵士")
    await expect(field).toContainText("月光骑士颂")
    await expect(field).not.toContainText("摇摆爵士")
    await save()
    expect((await readCatalog()).agents.agents.find((agent: any) => agent.id === "velina").preferredDriveDiscs.defaultTwoPieceSetIds).toEqual(["moonlight_lullaby"])
    await page.reload()
    await page.locator(".record-option").filter({ hasText: "维琳娜" }).click()
    await expect(field).toContainText("月光骑士颂")
    await toggleSet("摇摆爵士")
    await expect(field).toContainText("月光骑士颂")
    await expect(field).toContainText("摇摆爵士")
    await page.locator(".save-preview summary").click()
    await expect(page.locator(".save-preview pre")).toContainText('"默认 2 件套"')
    await expect(page.locator(".save-preview pre")).toContainText("摇摆爵士")
    await expect(page.locator(".save-preview pre")).not.toContainText("swing_jazz")
    await save()
    await field.screenshot({ path: testInfo.outputPath("default-two-piece.png") })
    for (const label of ["摇摆爵士", "月光骑士颂"]) {
      await toggleSet(label)
    }
    await expect(field).not.toContainText("摇摆爵士")
    await expect(field).not.toContainText("月光骑士颂")
    await save()
    await page.reload()
    await page.locator(".record-option").filter({ hasText: "维琳娜" }).click()
    await expect(field).not.toContainText("摇摆爵士")
    await expect(field).not.toContainText("月光骑士颂")
    expect((await readCatalog()).agents.agents.find((agent: any) => agent.id === "velina").preferredDriveDiscs.defaultTwoPieceSetIds ?? []).toEqual([])
  } finally {
    const latest = await readCatalog()
    expect((await request.post("/api/maintenance/agents", { headers: { "If-Match": `"${latest.agentRevisions.velina}"` }, data: original })).ok()).toBe(true)
  }
})

test("Velina silently replaces old two-piece settings once and preserves a manual clear", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("two-piece-seeded")) return
    sessionStorage.setItem("two-piece-seeded", "1")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default", byOwner: { default: { currentAgentId: "velina", byAgent: { velina: {} } } } }))
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({ version: 4, currentAgentId: "velina", byAgent: { velina: { twoPieceSetIds: ["hormone_punk"] } } }))
  })
  await page.goto("/")
  const field = page.locator(".optimizer-set-choice-field").filter({ hasText: "额外 2 件套" })
  await expect(field).toContainText("摇摆爵士")
  await expect(field).toContainText("月光骑士颂")
  await expect(field).not.toContainText("激素朋克")
  await field.getByRole("button", { name: "清空", exact: true }).click()
  await expect(field).toContainText("自动匹配任意 2 件套")
  await page.reload()
  await expect(field).toContainText("自动匹配任意 2 件套")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.webapp.optimizer.v1")!).byAgent.velina)
  expect(saved.twoPieceSetIds).toEqual([])
  expect(saved.twoPieceSetSource).toBe("manual")
  expect(saved.twoPieceDefaultsVersion).toBe(1)
})

test("role save conflict survives refresh and retains the default rotation", async ({ page, browser, request }, testInfo) => {
  const data = (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = data.agents.agents.find((agent: any) => agent.id === "velina")
  const otherContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string, viewport: testInfo.project.use.viewport })
  const other = await otherContext.newPage()
  try {
    await selectVelina(page)
    await selectVelina(other)
    await nameInput(page).fill("维琳娜·服务器修改")
    await nameInput(other).fill("维琳娜·本机草稿")
    await page.getByRole("button", { name: "保存", exact: true }).first().click()
    await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
    await other.getByRole("button", { name: "保存", exact: true }).first().click()
    await expect(other.locator(".agent-conflict-panel")).toBeVisible()
    await expect(other.getByRole("button", { name: "保存", exact: true }).first()).toBeDisabled()
    await other.reload()
    await expect(other.locator(".agent-conflict-panel")).toContainText("维琳娜·本机草稿")
    await expect(other.locator(".agent-conflict-panel")).toContainText("维琳娜·服务器修改")
    const panel = other.locator(".agent-conflict-panel")
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 2)).toBe(true)
    await panel.screenshot({ path: testInfo.outputPath("role-conflict.png") })
    await other.getByRole("button", { name: "保留我的修改", exact: true }).click()
    await other.getByRole("button", { name: "保存", exact: true }).first().click()
    await expect(other.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
    const saved = (await (await request.get("/api/maintenance/catalog")).json()).data.agents.agents.find((agent: any) => agent.id === "velina")
    expect(saved.name.zhCN).toBe("维琳娜·本机草稿")
    expect(saved.defaultCalculationConfig.events).toEqual(original.defaultCalculationConfig.events)
    expect(saved.defaultCalculationConfig.name).toEqual(original.defaultCalculationConfig.name)
  } finally {
    await otherContext.close()
    const latest = (await (await request.get("/api/maintenance/catalog")).json()).data
    const response = await request.post("/api/maintenance/agents", { headers: { "If-Match": `"${latest.agentRevisions.velina}"` }, data: original })
    expect(response.ok()).toBe(true)
  }
})

async function seedFallback(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("agent-maintenance-test-seeded")) return
    sessionStorage.setItem("agent-maintenance-test-seeded", "1")
    const config = { agentLevel: 60, cinemaLevel: 0, damage: { mode: "single", selectedEventId: "direct-1", events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1, critMode: "expected", stunned: true }] } }
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default", byOwner: { default: { currentAgentId: "velina", byAgent: { velina: config } } } }))
  })
  await page.goto("/")
}

test("a new Velina build uses the maintained Wind Corrosion default", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("velina-default-seeded")) return
    sessionStorage.setItem("velina-default-seeded", "1")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify({ version: 2, currentOwnerId: "default", byOwner: { default: { currentAgentId: "velina", byAgent: { velina: {} } } } }))
  })
  await page.goto("/")
  const section = page.locator(".workbench-calculation-section")
  await expect(section).toContainText("单次风化")
  await expect(section).toContainText("属性异常 · 风化 ×1")
  await expect(page.locator(".velina-default-restore")).toHaveCount(0)
  await page.reload()
  await expect(section).toContainText("单次风化")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1")!).byOwner.default.byAgent.velina.damage)
  expect(saved.mode).toBe("adminDefault")
  expect(saved.events[0]).toMatchObject({ settlementType: "attribute", anomalyEffect: "wind_corrosion", procCount: 1, count: 1 })
  expect(saved.events[0]).not.toHaveProperty("releaseSource")
})

test("an existing Velina calculation survives reload without a recovery prompt", async ({ page }) => {
  await seedFallback(page)
  await expect(page.locator(".workbench-calculation-section")).toContainText("最大化单个技能伤害")
  await expect(page.locator(".velina-default-restore")).toHaveCount(0)
  await page.reload()
  await expect(page.locator(".workbench-calculation-section")).toContainText("最大化单个技能伤害")
  await expect(page.locator(".velina-default-restore")).toHaveCount(0)
})
