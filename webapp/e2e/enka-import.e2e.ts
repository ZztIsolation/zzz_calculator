import { expect, test, type Page } from "@playwright/test"

const uid = "1302309616"
const agents: any[] = [
  ["hoshimi_miyabi", "星见雅", 6, "F"],
  ["aria", "爱芮", 2, "D"],
  ["yixuan", "仪玄", 1, "C"],
  ["alice_thymefield", "爱丽丝", 0, "B"],
  ["ye_shunguang", "叶瞬光", 3, "A"],
].map(([agentId, agentName, cinemaLevel, coreSkillLevel]) => ({
  agentId,
  agentName,
  agentLevel: 60,
  cinemaLevel,
  coreSkillLevel,
  skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12 },
  wEngine: null,
  driveDiscSourceCount: 0,
  driveDiscPreset: null,
}))
agents[0].driveDiscSourceCount = 1
agents[0].driveDiscPreset = {
  driveDiscs: [{
    id: `enka-zzz:${uid}:e2e-disc-1`,
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: false,
    equippedBy: "hoshimi_miyabi",
    mainStat: { stat: "hpFlat", value: 2200 },
    subStats: [],
    source: {
      type: "enka-zzz-showcase",
      uid,
      agentId: "hoshimi_miyabi",
      equipmentUid: "e2e-disc-1",
      equipmentId: "e2e-equipment-1",
    },
  }],
}

async function mockAppConfig(page: Page, enkaImportEnabled: boolean) {
  await page.route("**/api/app-config", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      enkaImportEnabled,
      driveDiscReservationsUiEnabled: false,
      driveDiscExclusionsUiEnabled: false,
    }),
  }))
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clipped: Array.from(document.querySelectorAll<HTMLElement>(".nav, .nav a, .nav a span"))
      .filter(element => element.scrollWidth > element.clientWidth + 1)
      .map(element => ({
        text: element.textContent?.trim(),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
  }))
  expect(metrics.scrollWidth - metrics.viewportWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(2)
  expect(metrics.clipped, JSON.stringify(metrics, null, 2)).toEqual([])
}

async function readInventoryStore(page: Page): Promise<any> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("zzz-calculator-user-store", 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction("state", "readonly")
      const getRequest = transaction.objectStore("state").get("userDriveDiscStore")
      getRequest.onerror = () => reject(getRequest.error)
      getRequest.onsuccess = () => {
        resolve(getRequest.result)
        database.close()
      }
    }
  }))
}

async function writeInventoryStore(page: Page, store: any): Promise<void> {
  await page.evaluate(value => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("zzz-calculator-user-store", 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction("state", "readwrite")
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.objectStore("state").put(value, "userDriveDiscStore")
    }
  }), store)
}

async function mockShowcase(page: Page) {
  await page.route("**/api/enka/zzz/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      uid,
      cache: { hit: false, expiresAt: "2026-08-18T12:00:00.000Z" },
      ttlSeconds: 60,
      agents,
      skippedAgents: [{ enkaId: "999", name: "未收录角色", reason: "目录未映射" }],
      warnings: [{ code: "DISC_SKIPPED", message: "6号位属性无法映射，已跳过。" }],
    }),
  }))
}

async function importFiveAgents(page: Page) {
  await page.goto("/import")
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await page.getByRole("button", { name: "预览更改（5）" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "确认导入" }).click()
  await expect(page.locator(".n-message").filter({ hasText: "已导入 5 个角色，库存与配置已同步。" })).toBeVisible()
}

test("disabled import route redirects home with a visible notice", async ({ page }) => {
  await mockAppConfig(page, false)
  await page.goto("/import")
  await expect(page).toHaveURL(/\/?\?notice=enka-import-disabled$/)
  await expect(page.getByRole("alert")).toContainText("展柜数据导入当前未启用")
  await expect(page.getByRole("link", { name: "导入" })).toHaveCount(0)
})

test("five-agent import requires preview, persists both configs, and can undo", async ({ page }) => {
  test.slow()
  await mockAppConfig(page, true)
  await mockShowcase(page)

  await page.goto("/")
  const initialStore = await readInventoryStore(page) ?? {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscs: [],
    driveDiscLoadouts: [],
  }
  initialStore.owners = initialStore.owners.map((owner: any) => owner.id === initialStore.currentOwnerId
    ? { ...owner, label: "myself" }
    : owner)
  await writeInventoryStore(page, initialStore)
  await page.goto("/import")
  await expect(page.getByRole("heading", { name: "展柜数据导入" })).toBeVisible()
  await expect(page.locator(".account-chip")).toHaveText("账号 / myself")
  await expect(page.locator(".page-header p")).toContainText("当前账号：myself")
  await expect(page.locator(".page-header p")).not.toContainText("account-")
  await page.evaluate(() => {
    localStorage.removeItem("zzz-calculator.webapp.build.v1")
    localStorage.removeItem("zzz-calculator.homeSelection.v1")
  })
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await expect(page.getByRole("button", { name: "预览更改（5）" })).toBeVisible()

  for (const width of [320, 360, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `../output/playwright/enka-import-${width}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole("button", { name: "预览更改（5）" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(`UID ${uid} / 5 个角色`)
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(5)
  await expect(dialog.getByRole("list", { name: "驱动盘同步变化" })).toContainText("新增：1号位 啄木鸟电音")
  await expect(dialog).toContainText("未收录角色：目录未映射")
  await expect(dialog).toContainText("6号位属性无法映射，已跳过。")
  await expect(page.getByLabel("游戏 UID")).toBeDisabled()
  for (const agent of agents) await expect(page.getByLabel(`选择导入 ${agent.agentName}`)).toBeDisabled()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: "../output/playwright/enka-import-preview-320.png", fullPage: true })

  const beforeConfirm = await page.evaluate(() => localStorage.getItem("zzz-calculator.webapp.build.v1"))
  expect(beforeConfirm).toBeNull()
  await dialog.getByRole("button", { name: "确认导入" }).click()
  const importFeedback = page.locator(".n-message").filter({ hasText: "已导入 5 个角色，库存与配置已同步。" })
  await expect(importFeedback).toBeVisible()
  await expect(importFeedback).toContainText("已导入 5 个角色，库存与配置已同步。")

  const persisted = await page.evaluate(() => ({
    build: JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null"),
    legacy: JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "null"),
  }))
  for (const agent of agents) {
    expect(persisted.build.byOwner.default.byAgent[agent.agentId].agentLevel).toBe(60)
    expect(persisted.legacy.byOwner.default.byAgent[agent.agentId].agentLevel).toBe(60)
  }
  let inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding.uid).toBe(uid)
  expect(inventory.enkaImportState.byOwner.default.undoJournal.status).toBe("committed")
  expect(inventory.driveDiscs).toHaveLength(1)

  await page.getByRole("button", { name: "撤销上次导入" }).click()
  const undoFeedback = page.locator(".n-message").filter({ hasText: "最近一次展柜数据导入已撤销。" })
  await expect(undoFeedback).toBeVisible()
  await expect(undoFeedback).toContainText("最近一次展柜数据导入已撤销。")
  const undone = await page.evaluate(() => ({
    build: JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null"),
    legacy: JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "null"),
  }))
  for (const agent of agents) {
    expect(undone.build.byOwner.default.byAgent[agent.agentId]).toBeUndefined()
    expect(undone.legacy.byOwner.default.byAgent[agent.agentId]).toBeUndefined()
  }
  inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding).toBeUndefined()
  expect(inventory.enkaImportState.byOwner.default.undoJournal).toBeNull()
  expect(inventory.driveDiscs).toHaveLength(0)
})

test("startup recovery rolls back a prepared transaction with partial configs", async ({ page }) => {
  test.slow()
  await mockAppConfig(page, true)
  await mockShowcase(page)
  await importFiveAgents(page)

  const preparedStore = await readInventoryStore(page)
  preparedStore.enkaImportState.byOwner.default.undoJournal.status = "prepared"
  delete preparedStore.enkaImportState.byOwner.default.undoJournal.committedAt
  await writeInventoryStore(page, preparedStore)
  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "{}")
    delete legacy.byOwner.default.byAgent.hoshimi_miyabi
    localStorage.setItem("zzz-calculator.homeSelection.v1", JSON.stringify(legacy))
  })

  await page.reload()
  await expect(page.getByRole("heading", { name: "展柜数据导入" })).toBeVisible()
  await expect.poll(async () => (await readInventoryStore(page)).enkaImportState.byOwner.default.undoJournal).toBeNull()
  const recovered = await page.evaluate(() => ({
    build: JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null"),
    legacy: JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "null"),
  }))
  for (const agent of agents) {
    expect(recovered.build.byOwner.default.byAgent[agent.agentId]).toBeUndefined()
    expect(recovered.legacy.byOwner.default.byAgent[agent.agentId]).toBeUndefined()
  }
  const inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding).toBeUndefined()
  expect(inventory.driveDiscs).toHaveLength(0)
})
