import { expect, test, type Locator, type Page } from "@playwright/test"

const uid = "1302309616"
const agentId = "hoshimi_miyabi"
const agentName = "星见雅"
const equipmentUid = "unified-e2e-disc-1"
const enkaCanonicalId = `enka-zzz:${uid}:${equipmentUid}`

const scannerPayload = [{
  "序号": 1,
  "名称": "啄木鸟电音",
  "槽位": 1,
  "品质": "S",
  "等级": 15,
  "最大等级": 15,
  "主属性": { "生命值": 2200 },
  "副属性": [],
}]

const showcaseAgent = {
  agentId,
  agentName,
  agentLevel: 60,
  cinemaLevel: 0,
  coreSkillLevel: "none",
  skillLevels: { basic: 10, dodge: 10, assist: 10, special: 10, chain: 10 },
  wEngine: null,
  driveDiscSourceCount: 1,
  driveDiscPreset: {
    driveDiscs: [{
      id: enkaCanonicalId,
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      canonicalSetName: { zhCN: "啄木鸟电音" },
      partition: 1,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      statUnitVersion: 2,
      locked: true,
      equippedBy: agentId,
      mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
      subStats: [],
      source: {
        type: "enka-zzz-showcase",
        uid,
        agentId,
        equipmentUid,
        equipmentId: "31000",
      },
    }],
  },
}

async function mockApis(page: Page) {
  await page.route("**/api/app-config", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      enkaImportEnabled: true,
      driveDiscReservationsUiEnabled: false,
      driveDiscExclusionsUiEnabled: false,
    }),
  }))
  await page.route("**/api/enka/zzz/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      uid,
      cache: { hit: false, expiresAt: "2026-08-18T12:00:00.000Z" },
      ttlSeconds: 60,
      agents: [showcaseAgent],
      skippedAgents: [],
      warnings: [],
    }),
  }))
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

async function expectUnifiedDisc(page: Page, expectedCanonicalId: string) {
  const inventory = await readInventoryStore(page)
  expect(inventory.driveDiscs).toHaveLength(1)
  const [disc] = inventory.driveDiscs
  expect(disc.id).toBe(expectedCanonicalId)
  expect(disc.provenance?.version).toBe(1)
  expect(disc.provenance?.enkaZzz).toMatchObject({ uid, equipmentUid })
  expect(disc.provenance?.scanner).toMatchObject({ lastSequence: 1 })
  return disc
}

async function openJsonImport(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "批量导入", exact: true }).click()
  const modal = page.locator(".n-modal").filter({ hasText: "导入驱动盘 JSON" })
  await expect(modal).toBeVisible()
  await modal.getByLabel("驱动盘 JSON 内容").locator("textarea").fill(JSON.stringify(scannerPayload))
  await modal.getByRole("button", { name: "预览", exact: true }).click()
  return modal
}

async function confirmJsonImport(page: Page, expectedSummary: string) {
  const modal = await openJsonImport(page)
  await expect(modal).toContainText(expectedSummary)
  await modal.getByRole("button", { name: "确认导入", exact: true }).click()
  await expect(page.locator(".n-message").filter({ hasText: "导入完成" }).last()).toBeVisible()
  await expect(modal).toBeHidden()
}

async function importEnka(page: Page, expectedDriveOperation?: string) {
  await page.goto("/import")
  await expect(page.getByRole("heading", { name: "Enka 展柜导入" })).toBeVisible()
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜", exact: true }).click()
  await expect(page.getByLabel(`选择导入 ${agentName}`)).toBeVisible()
  await page.getByRole("button", { name: "预览更改（1）", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  if (expectedDriveOperation) await expect(dialog).toContainText(expectedDriveOperation)
  await dialog.getByRole("button", { name: "确认导入", exact: true }).click()
  await expect(page.locator(".n-message").filter({ hasText: "已导入 1 个角色" })).toBeVisible()
  await expect(dialog).toBeHidden()
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  expect(metrics.scrollWidth - metrics.viewportWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(2)
  expect(metrics.bodyScrollWidth - metrics.viewportWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(2)
}

test.beforeEach(async ({ page }) => {
  await mockApis(page)
})

test("Enka then Scanner JSON merges provenance and remains idempotent", async ({ page }) => {
  await importEnka(page, "新增：1号位 啄木鸟电音")
  let inventory = await readInventoryStore(page)
  expect(inventory.driveDiscs).toHaveLength(1)
  expect(inventory.driveDiscs[0].id).toBe(enkaCanonicalId)

  await page.goto("/discs")
  await confirmJsonImport(page, "合并来源 1")
  await expectUnifiedDisc(page, enkaCanonicalId)
  await expect(page.getByLabel("来源：Enka、扫描器")).toBeVisible()

  await confirmJsonImport(page, "未变 1")
  await expectUnifiedDisc(page, enkaCanonicalId)

  for (const width of [320, 360, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `../output/playwright/unified-drive-disc-import-${width}.png`,
      fullPage: true,
    })
  }

  inventory = await readInventoryStore(page)
  expect(inventory.driveDiscs.map((disc: any) => disc.id)).toEqual([enkaCanonicalId])
})

test("Scanner JSON then Enka keeps the Scanner canonical id and remains idempotent", async ({ page }) => {
  await page.goto("/discs")
  await confirmJsonImport(page, "新增 1")
  let inventory = await readInventoryStore(page)
  expect(inventory.driveDiscs).toHaveLength(1)
  const scannerCanonicalId = inventory.driveDiscs[0].id
  expect(scannerCanonicalId).toMatch(/^scanner-v2:/)
  expect(inventory.driveDiscs[0].provenance?.scanner).toBeTruthy()

  await importEnka(page, "合并来源：1号位 啄木鸟电音")
  await expectUnifiedDisc(page, scannerCanonicalId)

  await importEnka(page)
  await expectUnifiedDisc(page, scannerCanonicalId)

  await page.goto("/discs")
  await expect(page.getByLabel("来源：Enka、扫描器")).toBeVisible()
  inventory = await readInventoryStore(page)
  expect(inventory.driveDiscs.map((disc: any) => disc.id)).toEqual([scannerCanonicalId])
})
