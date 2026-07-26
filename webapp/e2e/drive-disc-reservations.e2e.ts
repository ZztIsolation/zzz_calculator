import { expect, test, type Page } from "@playwright/test"

const legacyDiscs = [1, 2, 3, 4, 5, 6].map(slot => ({
  id: `reservation-e2e-disc-${slot}`,
  ownerId: "default",
  setId: slot === 1 ? "swing_jazz" : "woodpecker_electro",
  setName: slot === 1 ? "摇摆爵士" : "啄木鸟电音",
  partition: slot,
  rarity: "S",
  level: 15,
  maxLevel: 15,
  mainStat: { stat: slot === 1 ? "hpFlat" : "atkPct", value: slot === 1 ? 2200 : 30 },
  subStats: [
    { stat: "critRate", value: 4.8 },
    { stat: "critDmg", value: 9.6 },
  ],
  source: { sequence: slot },
  ...(slot === 2 ? { reservedForAgentId: "hoshimi_miyabi" } : {}),
}))

const legacyStore = {
  version: 1,
  currentOwnerId: "default",
  owners: [
    { id: "default", label: "默认用户" },
    { id: "second-account", label: "第二账号" },
  ],
  imports: [{ id: "legacy-import", sourcePath: "legacy.json", importedAt: "2026-07-21T00:00:00.000Z" }],
  driveDiscs: [
    ...legacyDiscs,
    {
      ...legacyDiscs[0],
      id: "reservation-e2e-candidate",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      source: { sequence: 88 },
    },
    {
      ...legacyDiscs[2],
      id: "reservation-e2e-unknown",
      setName: "未知角色测试盘",
      reservedForAgentId: "retired-agent",
    },
  ],
  driveDiscLoadouts: [{
    id: "reservation-e2e-loadout",
    ownerId: "default",
    name: "旧数据六槽预设",
    agentId: "anby_demara",
    driveDiscIdsBySlot: Object.fromEntries(legacyDiscs.map(disc => [String(disc.partition), disc.id])),
    score: 197608702,
  }],
}

async function seedLegacyLocalStorage(page: Page) {
  await page.addInitScript(store => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined })
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(store))
    localStorage.setItem("zzz-calculator.reservation-e2e-sentinel", "preserve-me")
    localStorage.setItem("zzz-calculator.homeSelection.v1", JSON.stringify({ byOwner: { default: { currentAgentId: "anby_demara" } } }))
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({ algorithm: "exact-super-bound" }))
    localStorage.setItem("zzz_maintenance_vue_draft_v3", JSON.stringify({ kind: "legacy-draft" }))
  }, legacyStore)
}

async function mockRestrictionUi(page: Page, reservations: boolean, exclusions = false) {
  await page.route("**/api/app-config", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      driveDiscReservationsUiEnabled: reservations,
      driveDiscExclusionsUiEnabled: exclusions,
    }),
  }))
}

async function openDiscs(page: Page) {
  await page.goto("/discs")
  await expect(page.locator("#app")).toBeVisible()
  await page.waitForLoadState("networkidle")
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`,
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
        }
      })
      .filter(candidate => candidate.right > viewportWidth + 2)
      .sort((left, right) => right.right - left.right)
      .slice(0, 10)

    return {
      pixels: document.documentElement.scrollWidth - viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders,
    }
  })

  expect(metrics.pixels, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(2)
}

test("reservation UI stays absent when the runtime flag is disabled", async ({ page }) => {
  await seedLegacyLocalStorage(page)
  await mockRestrictionUi(page, false)
  await openDiscs(page)

  await expect(page.getByLabel("专属角色筛选")).toHaveCount(0)
  await expect(page.locator(".loadout-visual-grid")).toHaveCount(0)
  await expect(page.locator(".entity-grid")).toBeVisible()
  await expect(page.getByText("旧数据六槽预设", { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("zzz-calculator.reservation-e2e-sentinel"))).toBe("preserve-me")
})

test("reservation UI preserves legacy data and supports per-disc visual workflows", async ({ page }) => {
  test.slow()
  await seedLegacyLocalStorage(page)
  await mockRestrictionUi(page, true)
  await openDiscs(page)

  const preset = page.locator(".loadout-visual-card").filter({ hasText: "旧数据六槽预设" })
  await expect(preset.locator(".disc-slot-card")).toHaveCount(6)
  await expect(preset).toContainText("专属 0 / 6")
  await expect(preset).toContainText("评分 197,608,702")
  await expect(preset.getByRole("button", { name: /整套/ })).toHaveCount(0)
  await expect(page.getByLabel("专属角色筛选")).toBeVisible()

  await page.getByLabel("专属角色筛选").click()
  await expect(page.locator(".n-base-select-option").filter({ hasText: "未知角色（retired-agent）" })).toBeVisible()
  await page.keyboard.press("Escape")

  const publicDisc = preset.locator('.disc-slot-card[data-slot="3"]')
  await publicDisc.locator(".disc-reservation-button").click()
  await expect(publicDisc).toHaveAttribute("data-reservation-state", "current")
  await expect(preset).toContainText("专属 1 / 6")

  const conflictingDisc = preset.locator('.disc-slot-card[data-slot="2"]')
  await conflictingDisc.locator(".disc-reservation-button").click()
  const conflictModal = page.locator('[data-layout-surface="reservation-conflict"]')
  await expect(conflictModal).toContainText("星见雅")
  await expect(conflictModal).toContainText("安比")
  await page.getByRole("button", { name: "转移并锁定", exact: true }).click()
  await expect(conflictingDisc).toHaveAttribute("data-reservation-state", "current")
  await expect(preset).toContainText("专属 2 / 6")

  const beforeDraft = await page.evaluate(() => localStorage.getItem("zzz-calculator.userStore.v1"))
  await preset.getByRole("button", { name: "编辑", exact: true }).click()
  await page.locator('.loadout-editor-slot-grid .disc-slot-card[data-slot="1"]').click()
  await page.getByRole("button", { name: /选择 1号位 啄木鸟电音.*扫描序号 88/ }).click()
  await page.getByRole("button", { name: "取消", exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem("zzz-calculator.userStore.v1"))).toBe(beforeDraft)

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}"))
  expect(persisted.version).toBe(1)
  expect(persisted.currentOwnerId).toBe("default")
  expect(persisted.owners).toHaveLength(2)
  expect(persisted.imports[0].id).toBe("legacy-import")
  expect(persisted.driveDiscLoadouts[0].driveDiscIdsBySlot["1"]).toBe("reservation-e2e-disc-1")
  expect(persisted.driveDiscs.find((disc: any) => disc.id === "reservation-e2e-disc-2").reservedForAgentId).toBe("anby_demara")
  expect(persisted.driveDiscs.find((disc: any) => disc.id === "reservation-e2e-disc-3").reservedForAgentId).toBe("anby_demara")
  expect(await page.evaluate(() => localStorage.getItem("zzz-calculator.reservation-e2e-sentinel"))).toBe("preserve-me")
  expect(await page.evaluate(() => localStorage.getItem("zzz-calculator.homeSelection.v1"))).toContain("anby_demara")
  expect(await page.evaluate(() => localStorage.getItem("zzz-calculator.webapp.optimizer.v1"))).toContain("exact-super-bound")
  expect(await page.evaluate(() => localStorage.getItem("zzz_maintenance_vue_draft_v3"))).toContain("legacy-draft")

  await expectNoHorizontalOverflow(page)
})

test("exclusion UI supports effective states and both confirmed conversions", async ({ page }) => {
  test.slow()
  await seedLegacyLocalStorage(page)
  await mockRestrictionUi(page, true, true)
  await openDiscs(page)

  await expect(page.getByLabel("限制状态筛选")).toBeVisible()
  await expect(page.getByLabel("限制角色筛选")).toBeVisible()
  await expect(page.locator('[data-field="usage-restriction"]').first()).toBeVisible()

  const preset = page.locator(".loadout-visual-card").filter({ hasText: "旧数据六槽预设" })
  const publicDisc = preset.locator('.disc-slot-card[data-slot="3"]')
  const autoExcludedDisc = preset.locator('.disc-slot-card[data-slot="2"]')

  await expect(autoExcludedDisc).toHaveAttribute("data-usage-state", "excluded-by-reservation")
  await expect(autoExcludedDisc.locator(".disc-exclusion-button")).toBeDisabled()

  await publicDisc.locator(".disc-exclusion-button").click()
  await expect(publicDisc).toHaveAttribute("data-usage-state", "excluded-explicit")
  await expect(publicDisc).toContainText("已排除")

  await publicDisc.locator(".disc-reservation-button").click()
  await expect(page.getByRole("heading", { name: "取消排除并锁定", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "取消排除并锁定", exact: true }).click()
  await expect(publicDisc).toHaveAttribute("data-usage-state", "reserved-current")

  await publicDisc.locator(".disc-exclusion-button").click()
  await expect(page.getByRole("heading", { name: "解除锁定并排除", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "解除锁定并排除", exact: true }).click()
  await expect(publicDisc).toHaveAttribute("data-usage-state", "excluded-explicit")

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}"))
  const converted = persisted.driveDiscs.find((disc: any) => disc.id === "reservation-e2e-disc-3")
  expect(converted.reservedForAgentId).toBeNull()
  expect(converted.excludedForAgentIds).toEqual(["anby_demara"])
  expect(persisted.version).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem("zzz-calculator.reservation-e2e-sentinel"))).toBe("preserve-me")

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(preset).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})
