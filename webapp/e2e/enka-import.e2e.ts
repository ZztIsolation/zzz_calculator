import { expect, test, type Page } from "@playwright/test"

const uid = "1302309616"
const replacementUid = "1300027938"
const showcaseDiscId = `enka-zzz:${uid}:e2e-disc-1`
const showcaseOnlyDiscId = `enka-zzz:${uid}:e2e-disc-2`
const showcaseLoadoutId = `enka-zzz:${uid}:hoshimi_miyabi`
const showcaseLoadoutName = "展柜佩戴套装 - 星见雅"
const previousManualDiscId = "manual-before-showcase-import"
const miyabiHistoryLoadoutName = "星见雅历史套装"
const ariaHistoryLoadoutName = "爱芮历史套装"
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
    id: showcaseDiscId,
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: false,
    equippedBy: "hoshimi_miyabi",
    mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
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
const additionalAgents = [
  ["anby_demara", "安比"],
  ["ellen_joe", "艾莲"],
  ["koleda_belobog", "珂蕾妲"],
  ["von_lycaon", "莱卡恩"],
].map(([agentId, agentName]) => ({
  agentId,
  agentName,
  agentLevel: 60,
  cinemaLevel: 0,
  coreSkillLevel: "A",
  skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12 },
  wEngine: null,
  driveDiscSourceCount: 0,
  driveDiscPreset: null,
}))

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

async function mockShowcaseAgents(
  page: Page,
  showcaseAgents: any[],
  skippedAgents: any[] = [],
  responseUid = uid,
) {
  await page.route("**/api/enka/zzz/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      uid: responseUid,
      cache: { hit: false, expiresAt: "2026-08-18T12:00:00.000Z" },
      ttlSeconds: 60,
      agents: showcaseAgents,
      skippedAgents,
      warnings: [{ code: "DISC_SKIPPED", message: "6号位属性无法映射，已跳过。" }],
    }),
  }))
}

async function mockShowcase(page: Page) {
  await mockShowcaseAgents(page, agents, [{ enkaId: "999", name: "未收录角色", reason: "目录未映射" }])
}

async function importFiveAgents(page: Page) {
  await page.goto("/import")
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await page.getByRole("button", { name: "预览更改（5 个角色）" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "确认导入" }).click()
  await expect(page.locator(".n-message").filter({ hasText: "已导入 5 个角色，库存与配置已同步。" })).toBeVisible()
}

async function directImportFiveAgents(page: Page) {
  await page.goto("/import")
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await expect(page.getByText("输入游戏 UID，读取公开展柜中的角色、音擎和驱动盘")).toBeVisible()
  const directButton = page.getByRole("button", { name: "确认导入", exact: true }).first()
  await expect(directButton).toBeVisible()
  await directButton.click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator(".n-message").filter({ hasText: "已导入 5 个角色，库存与配置已同步。" })).toBeVisible()
}

test("disabled import route redirects home with a visible notice", async ({ page }) => {
  await mockAppConfig(page, false)
  await page.goto("/import")
  await expect(page).toHaveURL(/\/?\?notice=enka-import-disabled$/)
  await expect(page.getByRole("alert")).toContainText("展柜数据导入当前未启用")
  await expect(page.getByRole("link", { name: "导入" })).toHaveCount(0)
})

test("direct confirmation imports without preview and remains idempotent", async ({ page }) => {
  test.slow()
  await mockAppConfig(page, true)
  await mockShowcase(page)

  await directImportFiveAgents(page)
  await expect(page.getByRole("heading", { name: "已导入角色（5）" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "本次读取角色（5）" })).toBeVisible()
  const first = await readInventoryStore(page)
  expect(first.driveDiscs).toHaveLength(1)
  expect(first.driveDiscLoadouts.find((loadout: any) => loadout.id === showcaseLoadoutId)?.name).toBe(showcaseLoadoutName)
  expect(Object.keys(first.enkaImportState.byOwner.default.history.byAgent)).toHaveLength(5)
  const firstUndoJournal = structuredClone(first.enkaImportState.byOwner.default.undoJournal)

  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await page.getByRole("button", { name: "确认导入", exact: true }).first().click()
  await expect(page.getByRole("alert").filter({ hasText: "当前选择已经是最新数据。" })).toBeVisible()
  const second = await readInventoryStore(page)
  expect(second.driveDiscs).toHaveLength(first.driveDiscs.length)
  expect(second.driveDiscLoadouts).toHaveLength(first.driveDiscLoadouts.length)
  expect(second.enkaImportState.byOwner.default.undoJournal).toEqual(firstUndoJournal)

  await page.getByRole("button", { name: "撤销上次导入" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "最近一次展柜数据导入已撤销。" })).toBeVisible()
  const undone = await readInventoryStore(page)
  expect(undone.driveDiscs).toHaveLength(0)
  expect(undone.driveDiscLoadouts).toHaveLength(0)
  expect(undone.enkaImportState.byOwner.default.undoJournal).toBeNull()
  expect(Object.keys(undone.enkaImportState.byOwner.default.history?.byAgent ?? {})).toHaveLength(0)

  await page.goto("/accounts")
  await expect(page.getByText("游戏 UID", { exact: true })).toBeVisible()
  await expect(page.getByText("Enka UID", { exact: true })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test("multiple showcase imports accumulate history across reload and undo only the latest batch", async ({ page }) => {
  test.slow()
  await mockAppConfig(page, true)
  await mockShowcase(page)
  await directImportFiveAgents(page)
  await expect(page.getByRole("heading", { name: "已导入角色（5）" })).toBeVisible()

  await page.unroute("**/api/enka/zzz/**")
  await mockShowcaseAgents(page, additionalAgents)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByRole("heading", { name: "本次读取角色（4）" })).toBeVisible()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(4)
  await page.getByRole("button", { name: "确认导入", exact: true }).first().click()
  await expect(page.locator(".n-message").filter({ hasText: "已导入 4 个角色，库存与配置已同步。" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "已导入角色（9）" })).toBeVisible()

  let inventory = await readInventoryStore(page)
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history.byAgent)).toHaveLength(9)
  await page.reload()
  await expect(page.getByRole("heading", { name: "已导入角色（9）" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /本次读取角色/ })).toHaveCount(0)
  for (const agent of [...agents, ...additionalAgents]) {
    await expect(page.locator(".imported-agent-list").getByText(agent.agentName, { exact: true })).toBeVisible()
  }

  for (const width of [320, 360, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `../output/playwright/enka-import-history-${width}.png`, fullPage: true })
  }

  await page.getByRole("button", { name: "撤销上次导入" }).click()
  await expect(page.getByRole("heading", { name: "已导入角色（5）" })).toBeVisible()
  inventory = await readInventoryStore(page)
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history.byAgent)).toHaveLength(5)
  for (const agent of additionalAgents) {
    expect(inventory.enkaImportState.byOwner.default.history.byAgent[agent.agentId]).toBeUndefined()
  }
})

test("changing the UID invalidates the loaded showcase before either import path can run", async ({ page }) => {
  await mockAppConfig(page, true)
  await mockShowcase(page)
  await page.goto("/import")
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)

  await page.getByLabel("游戏 UID").fill("1300027938")

  await expect(page.getByRole("alert").filter({ hasText: "UID 已变化，请重新读取展柜。" })).toBeVisible()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "确认导入", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /预览更改/ })).toHaveCount(0)
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
  initialStore.driveDiscs = [{
    id: previousManualDiscId,
    ownerId: "default",
    setId: "swing_jazz",
    setName: "摇摆爵士",
    partition: 2,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: false,
    equippedBy: "",
    mainStat: { stat: "atkFlat", value: 316, mode: "flat", label: "攻击力" },
    subStats: [],
    source: { type: "manual" },
  }]
  initialStore.driveDiscLoadouts = [{
    id: "miyabi-history-loadout",
    ownerId: "default",
    agentId: "hoshimi_miyabi",
    name: miyabiHistoryLoadoutName,
    driveDiscIdsBySlot: { 2: previousManualDiscId },
    source: { type: "manual" },
  }, {
    id: "aria-history-loadout",
    ownerId: "default",
    agentId: "aria",
    name: ariaHistoryLoadoutName,
    driveDiscIdsBySlot: {},
    source: { type: "manual" },
  }]
  await writeInventoryStore(page, initialStore)
  await page.goto("/import")
  await expect(page.getByRole("heading", { name: "展柜数据导入" })).toBeVisible()
  await expect(page.locator(".account-chip")).toHaveText("账号 / myself")
  await expect(page.locator(".page-header").getByText("当前账号：myself", { exact: false })).toBeVisible()
  await expect(page.locator(".page-header")).not.toContainText("account-")
  const previousMiyabiConfig = {
    agentLevel: 40,
    discMode: "manual",
    selectedLoadoutId: "miyabi-history-loadout",
    manualDriveDiscIdsBySlot: { 2: previousManualDiscId },
    combat: { activeBuffIds: ["keep-before-showcase"] },
  }
  const initialBuildSelection = {
    version: 2,
    currentOwnerId: "default",
    byOwner: {
      default: {
        currentAgentId: "hoshimi_miyabi",
        byAgent: { hoshimi_miyabi: previousMiyabiConfig },
      },
    },
  }
  const initialLegacySelection = structuredClone(initialBuildSelection)
  await page.evaluate(({ build, legacy }) => {
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify(build))
    localStorage.setItem("zzz-calculator.homeSelection.v1", JSON.stringify(legacy))
  }, { build: initialBuildSelection, legacy: initialLegacySelection })
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await expect(page.getByRole("heading", { name: "本次读取角色（5）" })).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: "有 1 个角色暂未收录，已跳过。" })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="showcase-title"]')).not.toContainText("未收录角色")
  await expect(page.getByRole("button", { name: "预览更改（5 个角色）" })).toBeVisible()

  for (const width of [320, 360, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `../output/playwright/enka-import-${width}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole("button", { name: "预览更改（5 个角色）" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(`UID ${uid} / 5 个角色`)
  await expect(dialog.locator("details.preview-agent")).toHaveCount(5)
  await dialog.locator("details.preview-agent summary").first().click()
  await expect(dialog.getByRole("list", { name: "驱动盘同步变化" })).toContainText("新增：1号位 啄木鸟电音")
  await expect(dialog).toContainText("未收录角色：目录未映射")
  await expect(dialog).toContainText("6号位属性无法映射，已跳过。")
  await expect(dialog).not.toContainText("enka-zzz:")
  await expect(dialog).not.toContainText("hoshimi_miyabi")
  await expect(page.getByLabel("游戏 UID")).toBeDisabled()
  for (const agent of agents) await expect(page.getByLabel(`选择导入 ${agent.agentName}`)).toBeDisabled()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: "../output/playwright/enka-import-preview-320.png", fullPage: true })

  const beforeConfirm = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null"))
  expect(beforeConfirm).toEqual(initialBuildSelection)
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
  for (const document of [persisted.build, persisted.legacy]) {
    const config = document.byOwner.default.byAgent.hoshimi_miyabi
    expect(config.discMode).toBe("loadout")
    expect(config.selectedLoadoutId).toBe(showcaseLoadoutId)
    expect(config.manualDriveDiscIdsBySlot).toEqual({ 1: showcaseDiscId })
    expect(config.combat.activeBuffIds).toEqual(["keep-before-showcase"])
  }
  let inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding.uid).toBe(uid)
  expect(inventory.enkaImportState.byOwner.default.undoJournal.status).toBe("committed")
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history.byAgent)).toHaveLength(5)
  expect(inventory.driveDiscs).toHaveLength(2)
  expect(inventory.driveDiscLoadouts.find((loadout: any) => loadout.id === showcaseLoadoutId)?.name).toBe(showcaseLoadoutName)

  await page.reload()
  await expect(page.getByRole("heading", { name: "已导入角色（5）" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /本次读取角色/ })).toHaveCount(0)
  for (const agent of agents) await expect(page.locator(".imported-agent-list").getByText(agent.agentName, { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "撤销上次导入" }).click()
  const undoFeedback = page.locator(".n-message").filter({ hasText: "最近一次展柜数据导入已撤销。" })
  await expect(undoFeedback).toBeVisible()
  await expect(undoFeedback).toContainText("最近一次展柜数据导入已撤销。")
  const undone = await page.evaluate(() => ({
    build: JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null"),
    legacy: JSON.parse(localStorage.getItem("zzz-calculator.homeSelection.v1") || "null"),
  }))
  for (const document of [undone.build, undone.legacy]) {
    expect(document.byOwner.default.byAgent.hoshimi_miyabi).toEqual(previousMiyabiConfig)
    for (const agent of agents.slice(1)) {
      expect(document.byOwner.default.byAgent[agent.agentId]).toBeUndefined()
    }
  }
  inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding).toBeUndefined()
  expect(inventory.enkaImportState.byOwner.default.undoJournal).toBeNull()
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history?.byAgent ?? {})).toHaveLength(0)
  expect(inventory.driveDiscs.map((disc: any) => disc.id)).toEqual([previousManualDiscId])
  expect(inventory.driveDiscLoadouts.map((loadout: any) => loadout.name)).toEqual([
    miyabiHistoryLoadoutName,
    ariaHistoryLoadoutName,
  ])

  await importFiveAgents(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/discs")
  await expect(page.getByText(showcaseLoadoutName, { exact: true })).toBeVisible()
  await expect(page.getByText(miyabiHistoryLoadoutName, { exact: true })).toBeVisible()
  await expect(page.getByText(ariaHistoryLoadoutName, { exact: true })).toBeVisible()

  await page.evaluate(loadoutId => {
    for (const key of ["zzz-calculator.webapp.build.v1", "zzz-calculator.homeSelection.v1"]) {
      const document = JSON.parse(localStorage.getItem(key) || "null")
      const config = document?.byOwner?.default?.byAgent?.aria
      if (!config) continue
      config.discMode = "loadout"
      config.selectedLoadoutId = loadoutId
      localStorage.setItem(key, JSON.stringify(document))
    }
  }, showcaseLoadoutId)

  await page.goto("/")
  await page.getByRole("button", { name: "已有套装", exact: true }).click()
  const loadoutSelect = page.locator(".drive-disc-mode-control .n-select")
  await loadoutSelect.click()
  const openLoadoutOptions = page.locator(".n-base-select-option")
  await expect(openLoadoutOptions.filter({ hasText: showcaseLoadoutName })).toBeVisible()
  await expect(openLoadoutOptions.filter({ hasText: miyabiHistoryLoadoutName })).toBeVisible()
  await expect(openLoadoutOptions.filter({ hasText: ariaHistoryLoadoutName })).toHaveCount(0)

  await page.keyboard.press("Escape")
  const agentSelect = page.locator(".workbench-left .n-select").first()
  await agentSelect.click()
  await agentSelect.locator("input").fill("爱芮")
  await page.locator(".n-base-select-option").filter({ hasText: "爱芮" }).last().click()
  await expect(page.locator(".workbench-left .workbench-entity-select-name").first()).toHaveText("爱芮")
  await page.getByRole("button", { name: "已有套装", exact: true }).click()
  await expect(page.locator(".loadout-agent-mismatch-alert")).toContainText("当前保存的套装不属于该角色")
  await expect(page.locator(".drive-disc-workbench-panel .panel-header .n-tag")).toHaveText("0 / 6")
  await expect(page.getByTestId("open-drive-disc-analysis")).toBeDisabled()
  await loadoutSelect.click()
  await expect(openLoadoutOptions.filter({ hasText: ariaHistoryLoadoutName })).toBeVisible()
  await expect(openLoadoutOptions.filter({ hasText: showcaseLoadoutName })).toHaveCount(0)
  await expect(openLoadoutOptions.filter({ hasText: miyabiHistoryLoadoutName })).toHaveCount(0)
  await page.keyboard.press("Escape")
  const persistedMismatchedLoadoutId = await page.evaluate(() => {
    const document = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null")
    return document?.byOwner?.default?.byAgent?.aria?.selectedLoadoutId
  })
  expect(persistedMismatchedLoadoutId).toBe(showcaseLoadoutId)
  await page.screenshot({ path: "../output/playwright/showcase-loadouts-by-agent-1440.png", fullPage: true })
})

test("safe UID rebind detaches shared sources, removes old-only data, and undoes atomically", async ({ page }) => {
  test.slow()
  await mockAppConfig(page, true)
  const oldAgents = structuredClone(agents)
  oldAgents[0].driveDiscSourceCount = 2
  oldAgents[0].driveDiscPreset.driveDiscs.push({
    id: showcaseOnlyDiscId,
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 2,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: true,
    equippedBy: "hoshimi_miyabi",
    mainStat: { stat: "atkFlat", value: 316, mode: "flat", label: "攻击力" },
    subStats: [],
    source: {
      type: "enka-zzz-showcase",
      uid,
      agentId: "hoshimi_miyabi",
      equipmentUid: "e2e-disc-2",
      equipmentId: "e2e-equipment-2",
    },
  })
  await mockShowcaseAgents(page, oldAgents)

  await page.goto("/")
  const initialStore = await readInventoryStore(page) ?? {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscs: [],
    driveDiscLoadouts: [],
  }
  const scannerCanonicalId = "scanner-shared-before-rebind"
  initialStore.driveDiscs = [{
    id: scannerCanonicalId,
    ownerId: "default",
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    statUnitVersion: 2,
    locked: false,
    equippedBy: null,
    reservedForAgentId: "aria",
    excludedForAgentIds: ["yixuan"],
    mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
    subStats: [],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    source: {
      type: "zzz-scanner",
      importId: "scanner-before-rebind",
      sourcePath: "scanner-before-rebind.json",
      sequence: 1,
      rawIndex: 0,
    },
    provenance: {
      version: 1,
      scanner: {
        firstSeenAt: "2026-08-17T00:00:00.000Z",
        lastSeenAt: "2026-08-17T00:00:00.000Z",
        lastImportId: "scanner-before-rebind",
        lastSourcePath: "scanner-before-rebind.json",
        lastSequence: 1,
        lastRawIndex: 0,
      },
    },
  }]
  initialStore.driveDiscLoadouts = []
  await writeInventoryStore(page, initialStore)

  await page.goto("/import")
  await page.getByLabel("游戏 UID").fill(uid)
  await page.getByRole("button", { name: "读取展柜" }).click()
  await expect(page.getByLabel(/^选择导入 /)).toHaveCount(5)
  await page.getByRole("button", { name: "确认导入", exact: true }).first().click()
  await expect(page.locator(".n-message").filter({ hasText: "已导入 5 个角色" })).toBeVisible()

  let inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding.uid).toBe(uid)
  expect(inventory.enkaImportState.byOwner.default.bindingSession.complete).toBe(true)
  expect(inventory.driveDiscs.some((disc: any) => disc.id === showcaseDiscId)).toBe(false)
  const sharedAfterOldImport = inventory.driveDiscs.find((disc: any) => disc.id === scannerCanonicalId)
  expect(sharedAfterOldImport.provenance.scanner).toBeTruthy()
  expect(sharedAfterOldImport.provenance.enkaZzz).toBeTruthy()
  expect(inventory.driveDiscs.some((disc: any) => disc.id === showcaseOnlyDiscId)).toBe(true)

  await page.unroute("**/api/enka/zzz/**")
  const malformedReplacementAgent = {
    ...structuredClone(agents[1]),
    driveDiscSourceCount: 1,
    driveDiscPreset: {
      agentId: "aria",
      driveDiscs: [{
        id: `enka-zzz:${replacementUid}:malformed-disc`,
        setId: "woodpecker_electro",
        setName: "啄木鸟电音",
        partition: 1,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        equippedBy: "aria",
        mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
        subStats: [],
        source: {
          type: "enka-zzz-showcase",
          uid,
          agentId: "aria",
          equipmentUid: "malformed-disc",
          equipmentId: "malformed-equipment",
        },
      }],
    },
  }
  await mockShowcaseAgents(page, [malformedReplacementAgent], [], replacementUid)
  await page.getByRole("button", { name: "更换 UID" }).click()
  await page.getByLabel("游戏 UID").fill(replacementUid)
  await page.getByRole("button", { name: "读取新展柜" }).click()
  await expect(page.getByRole("heading", { name: "本次读取角色（1）" })).toBeVisible()
  const beforeBlockedPreview = await readInventoryStore(page)
  await page.getByRole("button", { name: "预览并更换 UID" }).click()
  let dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("部分驱动盘的来源 UID 与本次读取不一致")
  await expect(dialog.getByRole("button", { name: "确认更换 UID" })).toBeDisabled()
  expect(await readInventoryStore(page)).toEqual(beforeBlockedPreview)
  await dialog.getByRole("button", { name: "取消" }).click()

  await page.unroute("**/api/enka/zzz/**")
  const replacementAgent = {
    ...structuredClone(agents[1]),
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  }
  await mockShowcaseAgents(page, [replacementAgent], [], replacementUid)
  await page.getByRole("button", { name: "读取新展柜" }).click()
  await page.getByRole("button", { name: "预览并更换 UID" }).click()
  dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(`UID ${uid} → ${replacementUid}`)
  await expect(dialog).toContainText("删除 1 张仅属于旧 UID 的驱动盘")
  await expect(dialog).toContainText("保留 1 张 Scanner、JSON 或手动共用盘")

  for (const width of [320, 360, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await expectNoHorizontalOverflow(page)
    await expect.poll(() => dialog.evaluate(element => {
      const box = element.getBoundingClientRect()
      return box.left >= 0 && box.right <= window.innerWidth
        && box.top >= 0 && box.bottom <= window.innerHeight
    })).toBe(true)
    const dialogGeometry = await dialog.evaluate(element => {
      const box = element.getBoundingClientRect()
      const buttons = Array.from(element.querySelectorAll<HTMLElement>(".modal-actions button"))
        .map(button => button.getBoundingClientRect())
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttons: buttons.map(button => ({ left: button.left, right: button.right, top: button.top, bottom: button.bottom })),
      }
    })
    expect(dialogGeometry.left).toBeGreaterThanOrEqual(0)
    expect(dialogGeometry.right).toBeLessThanOrEqual(dialogGeometry.viewportWidth)
    expect(dialogGeometry.top).toBeGreaterThanOrEqual(0)
    expect(dialogGeometry.bottom).toBeLessThanOrEqual(dialogGeometry.viewportHeight)
    expect(dialogGeometry.buttons).toHaveLength(2)
    expect(dialogGeometry.buttons[0].right).toBeLessThanOrEqual(dialogGeometry.buttons[1].left)
    await page.screenshot({ path: `../output/playwright/enka-rebind-preview-${width}.png`, fullPage: true })
  }

  await dialog.getByRole("button", { name: "确认更换 UID" }).click()
  await expect(page.locator(".n-message").filter({ hasText: `已从 UID ${uid} 更换为 ${replacementUid}` })).toBeVisible()
  inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding.uid).toBe(replacementUid)
  expect(inventory.enkaImportState.byOwner.default.bindingSession.uid).toBe(replacementUid)
  expect(inventory.enkaImportState.byOwner.default.undoJournal).toMatchObject({
    kind: "enka-rebind",
    previousUid: uid,
    uid: replacementUid,
    status: "committed",
  })
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history.byAgent)).toEqual(["aria"])
  expect(inventory.driveDiscs.some((disc: any) => disc.id === showcaseOnlyDiscId)).toBe(false)
  const detachedShared = inventory.driveDiscs.find((disc: any) => disc.id === scannerCanonicalId)
  expect(detachedShared.id).toBe(scannerCanonicalId)
  expect(detachedShared.provenance.enkaZzz).toBeUndefined()
  expect(detachedShared.provenance.scanner).toBeTruthy()
  expect(detachedShared.source.type).toBe("zzz-scanner")
  expect(detachedShared.reservedForAgentId).toBe("aria")
  expect(detachedShared.excludedForAgentIds).toEqual(["yixuan"])
  expect(inventory.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(false)

  await page.reload()
  await expect(page.locator(".page-header")).toContainText(`已绑定 UID ${replacementUid}`)
  await expect(page.getByRole("heading", { name: "已导入角色（1）" })).toBeVisible()
  await page.getByRole("button", { name: "撤销上次导入" }).click()
  await expect(page.locator(".n-message").filter({ hasText: "最近一次展柜数据导入已撤销" })).toBeVisible()
  inventory = await readInventoryStore(page)
  expect(inventory.enkaImportState.byOwner.default.binding.uid).toBe(uid)
  expect(inventory.enkaImportState.byOwner.default.bindingSession.uid).toBe(uid)
  expect(inventory.enkaImportState.byOwner.default.undoJournal).toBeNull()
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history.byAgent)).toHaveLength(5)
  expect(inventory.driveDiscs.some((disc: any) => disc.id === showcaseOnlyDiscId)).toBe(true)
  expect(inventory.driveDiscs.find((disc: any) => disc.id === scannerCanonicalId).provenance.enkaZzz).toBeTruthy()
  expect(inventory.driveDiscLoadouts.some((loadout: any) => loadout.id === showcaseLoadoutId)).toBe(true)
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
  expect(Object.keys(inventory.enkaImportState.byOwner.default.history?.byAgent ?? {})).toHaveLength(0)
  expect(inventory.driveDiscs).toHaveLength(0)
})
