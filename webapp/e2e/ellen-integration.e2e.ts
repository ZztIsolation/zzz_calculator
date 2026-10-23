import { expect, test, type Page } from "@playwright/test"
import path from "node:path"
import { createEmptyInventoryStore } from "../../core/inventory-model.js"

async function selectEllen(page: Page) {
  await page.goto("/")
  const control = page.locator(".agent-select")
  await control.locator(".n-base-selection").click()
  await control.locator("input").fill("艾莲")
  await control.locator("input").press("ArrowDown")
  await control.locator("input").press("Enter")
  await expect(control).toContainText("艾莲")
}

async function openTeammates(page: Page) {
  await page.getByTestId("open-buff-picker").click()
  await page.locator(".n-tabs-tab").filter({ hasText: /^队友 Buff(?: \(\d+\))?$/ }).click()
}

async function seedQianxiaEnka(page: Page) {
  await page.evaluate(emptyStore => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("zzz-calculator-user-store", 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction("state", "readwrite")
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
      const state = transaction.objectStore("state")
      const get = state.get("userDriveDiscStore")
      get.onsuccess = () => {
        const store = get.result ?? emptyStore
        store.enkaImportState ??= { version: 1, byOwner: {} }
        store.enkaImportState.byOwner.default = {
          binding: { uid: "ellen-e2e", boundAt: "2026-10-11T00:00:00Z", lastImportedAt: "2026-10-11T00:00:00Z" },
          history: { version: 1, byAgent: { qianxia: {
            agentId: "qianxia", agentName: "千夏", uid: "ellen-e2e", completeness: "full",
            firstImportedAt: "2026-10-11T00:00:00Z", lastImportedAt: "2026-10-11T00:00:00Z",
            snapshot: { coreSkillLevel: 6, cinemaLevel: 2, skillLevels: { special: 12 }, wEngine: null },
          } } },
        }
        state.put(store, "userDriveDiscStore")
      }
    }
  }), createEmptyInventoryStore())
}

test("Ellen defaults, potential changes and cleared team survive refresh", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/")
  await expect(page.getByTestId("open-buff-picker")).toBeEnabled()
  await seedQianxiaEnka(page)
  await selectEllen(page)
  const potential = page.locator(".compact-field").filter({ has: page.getByText("潜能影像", { exact: true }) })
  await expect(potential).toContainText("P6")
  for (const level of [0, 1, 6]) {
    await potential.locator(".n-base-selection").click()
    await page.locator(".n-base-select-option:visible").filter({ hasText: level === 0 ? "P0 · 关闭 / 未激发" : new RegExp(`^P${level}$`) }).click()
    await expect(potential).toContainText(`P${level}`)
  }
  await openTeammates(page)
  await expect(page.getByTestId("teammate-slot-0")).toContainText("琉音")
  await expect(page.getByTestId("teammate-slot-1")).toContainText("千夏")
  await expect(page.getByTestId("teammate-cinema-1")).toContainText("2 影")
  await expect(page.locator('[data-buff-id="qianxia.cinema_2.aether_curtain_atk_pct"]')).toHaveClass(/is-selected/)
  await page.screenshot({ path: testInfo.outputPath("ellen-default-team.png") })
  await page.getByTestId("teammate-cinema-1").click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: /^0 影$/ }).click()
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await page.reload()
  await expect(page.getByTestId("open-buff-picker")).toBeEnabled()
  await openTeammates(page)
  await expect(page.getByTestId("teammate-cinema-1")).toContainText("0 影")
  await page.getByRole("button", { name: "取消", exact: true }).click()
  await openTeammates(page)
  for (const index of [0, 1]) {
    const slot = page.getByTestId(`teammate-slot-${index}`)
    await slot.hover()
    await slot.locator(".n-base-clear").click()
  }
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await page.reload()
  await expect(page.locator(".agent-select")).toContainText("艾莲")
  await openTeammates(page)
  await expect(page.getByTestId("teammate-slot-0")).not.toContainText("琉音")
  await expect(page.getByTestId("teammate-slot-1")).not.toContainText("千夏")
  await page.getByRole("button", { name: "取消", exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  await page.screenshot({ path: testInfo.outputPath("ellen-workbench.png"), fullPage: true })
  expect(errors).toEqual([])
})

test("Ellen default teammates can be maintained and read back in a disposable catalog", async ({ page, request }, testInfo) => {
  test.skip(!path.basename(path.dirname(process.env.ZZZ_CALCULATOR_DATA_DIR || "")).startsWith("zzz-agent-browser-"), "Requires disposable maintenance data")
  const readCatalog = async () => (await (await request.get("/api/maintenance/catalog")).json()).data
  const original = (await readCatalog()).agents.agents.find((agent: any) => agent.id === "ellen_joe")
  try {
  await page.goto("/maintenance")
  await page.locator(".record-option").filter({ hasText: "艾莲" }).click()
  const section = page.locator(".maintenance-form-section").filter({ has: page.getByRole("heading", { name: "默认队友", exact: true }) })
  await expect(section).toContainText("琉音")
  await expect(section).toContainText("千夏")
  await section.getByRole("button", { name: "移除", exact: true }).first().click()
  const saved = page.waitForResponse(response => response.url().endsWith("/api/maintenance/agents") && response.request().method() === "POST")
  await page.getByRole("button", { name: "保存", exact: true }).first().click()
  expect((await saved).ok()).toBe(true)
  await expect(page.locator(".maintenance-save-strip")).toContainText("完整目录已刷新")
  const data = (await (await request.get("/api/maintenance/catalog")).json()).data
  expect(data.agents.agents.find((agent: any) => agent.id === "ellen_joe").defaultTeammates).toEqual([{ teammateId: "qianxia", cinemaLevel: 0 }])
  await page.reload()
  await page.locator(".record-option").filter({ hasText: "艾莲" }).click()
  await expect(section).not.toContainText("琉音")
  await expect(section).toContainText("千夏")
  await section.screenshot({ path: testInfo.outputPath("ellen-maintenance.png") })
  } finally {
    const latest = await readCatalog()
    expect((await request.post("/api/maintenance/agents", {
      headers: { "If-Match": `"${latest.agentRevisions.ellen_joe}"` }, data: original,
    })).ok()).toBe(true)
  }
})
