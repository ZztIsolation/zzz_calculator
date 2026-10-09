import { expect, test, type Locator, type Page } from "@playwright/test"

// Headless Chromium hides native scrollbars by default. These tests must render
// the real gutter/thumb used in the desktop browser, not just inspect CSS values.
test.use({ launchOptions: {
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim() || undefined,
  ignoreDefaultArgs: ["--hide-scrollbars"],
} })

async function openTeammates(page: Page) {
  await page.getByTestId("open-buff-picker").click()
  await page.locator(".n-tabs-tab").filter({ hasText: /^队友 Buff$/ }).click()
  await expect(page.getByTestId("teammate-slot-0")).toBeVisible()
  await expect(page.locator(".calculation-modal")).toHaveCSS("transform", "none")
}

async function openSupportMenu(page: Page, mobile = false, slot = 0) {
  const control = page.getByTestId(`teammate-slot-${slot}`)
  await control.click()
  const menu = page.locator(".teammate-select-menu")
  await expect(menu).toHaveCSS("transform", "none")
  if (mobile) await menu.getByText("支援", { exact: true }).tap()
  else await menu.getByText("支援", { exact: true }).hover()
  await expect(menu.locator(".teammate-select-option").filter({ hasText: "卢西娅" })).toBeAttached()
  return menu
}

async function expectMenuLayout(page: Page, menu: Locator) {
  await expect.poll(() => menu.evaluate(root => {
    const issues: string[] = []
    const rect = root.getBoundingClientRect()
    if (rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1) issues.push("menu leaves viewport")
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push("page overflows horizontally")
    const columns = root.querySelectorAll<HTMLElement>(".n-cascader-submenu")
    columns.forEach((column, index) => {
      const container = column.querySelector<HTMLElement>(".n-scrollbar-container")!
      if (container.scrollWidth > container.clientWidth + 1) issues.push(`column ${index} overflows horizontally`)
      if (container.offsetHeight > container.clientHeight) issues.push(`column ${index} has a horizontal scrollbar`)
      if (index !== 0) return
      if (Math.abs(column.getBoundingClientRect().width - 100) > 1) issues.push("category width differs from 100px")
      if (container.offsetWidth !== container.clientWidth || container.scrollHeight > container.clientHeight) issues.push("categories scroll or are clipped")
      const bounds = container.getBoundingClientRect()
      for (const label of container.querySelectorAll<HTMLElement>(".n-cascader-option__label")) {
        const r = label.getBoundingClientRect()
        if (label.scrollWidth > label.clientWidth || r.bottom > bounds.bottom + 1 || r.top < bounds.top - 1) issues.push(`category clipped: ${label.textContent}`)
        const hit = document.elementFromPoint(r.left + 5, r.top + r.height / 2)
        if (!label.contains(hit)) issues.push(`category covered: ${label.textContent}`)
      }
    })
    return issues
  })).toEqual([])
}

async function expectReachable(option: Locator, container: Locator) {
  const bounds = await container.boundingBox()
  expect(bounds).not.toBeNull()
  await expect.poll(() => option.evaluate((element, r) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + 5, box.top + box.height / 2)
    return box.top >= r!.y - 1 && box.bottom <= r!.y + r!.height + 1 && element.contains(hit)
  }, bounds)).toBe(true)
}

async function chooseTeammate(page: Page, slot: number, name: string) {
  const control = page.getByTestId(`teammate-slot-${slot}`)
  await control.click()
  await control.locator("input").fill(name)
  // Select the searched teammate entirely with the keyboard.
  await control.locator("input").press("ArrowDown")
  await control.locator("input").press("Enter")
  await expect(control).toContainText(name)
}

async function savedSelection(page: Page) {
  return page.evaluate(() => {
    const document = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
    const owner = document.byOwner?.[document.currentOwnerId]
    return owner?.byAgent?.[owner.currentAgentId]
  })
}

test("keeps categories static and scrolls only overflowing characters", async ({ page }, testInfo) => {
  await page.goto("/")
  await openTeammates(page)
  const control = page.getByTestId("teammate-slot-0")
  const mobile = Boolean(testInfo.project.use.isMobile)
  const menu = await openSupportMenu(page, mobile)
  const last = menu.locator(".teammate-select-option").filter({ hasText: "卢西娅" })
  const container = menu.locator(".n-cascader-submenu").last().locator(".n-scrollbar-container")
  await expectMenuLayout(page, menu)
  expect(await menu.evaluate(element => Boolean(element.closest(".calculation-modal")))).toBe(false)
  await expectReachable(last, container)
  // Measure the native gutter: absence of Naive UI's custom thumb proves nothing.
  expect(await container.evaluate(element => element.offsetWidth - element.clientWidth)).toBe(0)

  await page.setViewportSize({ width: page.viewportSize()!.width, height: 400 })
  if (mobile) await menu.getByText("支援", { exact: true }).tap()
  else await menu.getByText("支援", { exact: true }).hover()
  await expectMenuLayout(page, menu)
  await expect.poll(() => container.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0)
  await page.mouse.move(1, 1)
  expect(await container.evaluate(element => element.offsetWidth - element.clientWidth)).toBe(10)
  await expect(menu.locator(".n-scrollbar-rail:visible")).toHaveCount(0)
  const rect = (await container.boundingBox())!
  await page.mouse.move(rect.x + 50, rect.y + rect.height / 2)
  await page.mouse.wheel(0, 500)
  await expect.poll(() => container.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expectReachable(last, container)

  await page.mouse.wheel(0, -500)
  await expect.poll(() => container.evaluate(element => element.scrollTop)).toBe(0)
  const thumbCenter = await container.evaluate(element => element.clientHeight * element.clientHeight / element.scrollHeight / 2)
  await page.mouse.move(rect.x + rect.width - 5, rect.y + thumbCenter)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width - 5, rect.y + rect.height - 2, { steps: 10 })
  await page.mouse.up()
  await expectReachable(last, container)
  await page.mouse.move(1, 1)
  await page.screenshot({ path: testInfo.outputPath("teammate-short.png") })
  await last.click()
  await expect(control).toContainText("卢西娅")
  await expect(menu).toBeHidden()

  await page.setViewportSize(testInfo.project.use.viewport!)
  await control.click()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await control.click()
  await page.locator(".calculation-modal .n-card-header").click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole("button", { name: "应用选择", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "取消", exact: true }).click()
  await openTeammates(page)
  await expect(control).not.toContainText("卢西娅")
  await chooseTeammate(page, 0, "卢西娅")
  await expect(control).toContainText("卢西娅")
})

test("category text and native scrollbars adapt across narrow, short and large viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1920", "Additional sizes use one desktop context; standard projects cover scale and touch")
  test.setTimeout(120_000)
  page.setDefaultTimeout(10_000)
  const sizes = [
    [2560, 1440], [1920, 1080], [1440, 900], [1366, 768], [1280, 720],
    [1024, 576], [768, 1024], [844, 360], [640, 320],
    [390, 844], [360, 640], [320, 568], [320, 400],
  ]
  await page.goto("/")
  await openTeammates(page)
  for (const [width, height] of sizes) {
    await test.step(`${width}x${height}`, async () => {
      await page.setViewportSize({ width: width!, height: height! })
      // Alternate slots so narrow layouts also exercise the lower selector.
      const menu = await openSupportMenu(page, false, width! < 768 ? 1 : 0)
      await expectMenuLayout(page, menu)
      const column = menu.locator(".n-cascader-submenu").last()
      const container = column.locator(".n-scrollbar-container")
      const rect = (await container.boundingBox())!
      const overflow = await container.evaluate(e => e.scrollHeight > e.clientHeight)
      expect(await container.evaluate(e => e.offsetWidth - e.clientWidth)).toBe(overflow ? 10 : 0)
      await page.mouse.move(rect.x + 50, rect.y + rect.height / 2)
      await page.mouse.wheel(0, 1000)
      await expectReachable(menu.locator(".teammate-select-option").filter({ hasText: "卢西娅" }), container)
      await menu.getByText("强攻", { exact: true }).hover()
      await expect(column.locator(".teammate-select-option")).toHaveCount(3)
      await expectMenuLayout(page, menu)
      const smallOverflow = await container.evaluate(e => e.scrollHeight > e.clientHeight)
      expect(await container.evaluate(e => e.offsetWidth - e.clientWidth)).toBe(smallOverflow ? 10 : 0)
      await page.mouse.move(1, 1)
      await page.screenshot({ path: testInfo.outputPath(`teammate-${width}x${height}.png`) })
      await menu.getByText("击破", { exact: true }).hover()
      await expect(column.locator(".teammate-select-option")).toHaveCount(10)
      await expectMenuLayout(page, menu)
      expect(await container.evaluate(e => e.offsetWidth - e.clientWidth)).toBe(10)
      const longRect = (await container.boundingBox())!
      await page.mouse.move(longRect.x + 50, longRect.y + longRect.height / 2)
      await page.mouse.wheel(0, 1000)
      await expectReachable(column.locator(".teammate-select-option").last(), container)
      await page.keyboard.press("Escape")
      await expect(menu).toBeHidden()
    })
  }
})

test("teammates remain in their own responsive columns and preserve manual cinema choices after reload", async ({ page }, testInfo) => {
  await page.goto("/")
  await expect(page.getByTestId("open-buff-picker")).toBeVisible()
  await openTeammates(page)
  await expect(page.locator(".teammate-buff-column")).toHaveCount(2)
  await expect(page.locator(".teammate-buff-column .buff-row")).toHaveCount(0)
  await expect(page.getByTestId("teammate-attribute-filter")).toHaveCount(0)
  await expect(page.getByTestId("teammate-specialty-filter")).toHaveCount(0)
  await page.getByTestId("teammate-slot-0").click()
  const menu = page.locator(".teammate-select-menu")
  await expect(menu).toHaveCSS("transform", "none")
  const supportCategory = menu.getByText("支援", { exact: true })
  const qianxiaOption = menu.locator(".teammate-select-option").filter({ hasText: "千夏" })
  if (testInfo.project.use.isMobile) {
    await supportCategory.tap()
  } else {
    await supportCategory.hover()
    await expect(qianxiaOption).toBeVisible()
    await menu.getByText("击破", { exact: true }).hover()
    await expect(menu.locator(".teammate-select-option").filter({ hasText: "琉音" })).toBeVisible()
    await expect(qianxiaOption).not.toBeVisible()
    await expect(page.locator(".teammate-buff-column .buff-row")).toHaveCount(0)
    await supportCategory.hover()
  }
  // A specialty expands the leaf menu without choosing a teammate.
  await expect(page.locator(".teammate-buff-column .buff-row")).toHaveCount(0)
  await expect(qianxiaOption.locator("img")).toBeVisible()
  if (testInfo.project.use.isMobile) await qianxiaOption.tap()
  else await qianxiaOption.click()
  await expect(page.getByTestId("teammate-slot-0").locator("img")).toBeVisible()
  await chooseTeammate(page, 1, "琉音")

  const columns = page.locator(".teammate-buff-column")
  const first = await columns.nth(0).boundingBox()
  const second = await columns.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  if (page.viewportSize()!.width >= 1000) {
    expect(second!.x).toBeGreaterThanOrEqual(first!.x + first!.width)
    expect(Math.abs(second!.y - first!.y)).toBeLessThan(2)
  } else {
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height)
    expect(Math.abs(second!.x - first!.x)).toBeLessThan(2)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2)
  await expect(columns.locator(".buff-row .avatar")).toHaveCount(0)
  await expect(columns.locator(".buff-row .chip-row")).toHaveCount(0)
  const applyButton = page.getByRole("button", { name: "应用选择", exact: true })
  const applyBox = await applyButton.boundingBox()
  expect(applyBox!.y + applyBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  if (page.viewportSize()!.width >= 1000) {
    const simpleCard = await page.locator('[data-buff-id="buff_23620b7000"]').boundingBox()
    const sourceCard = await page.locator('[data-buff-id="buff_j8kf2r9m4q"]').boundingBox()
    expect(simpleCard!.height).toBeLessThanOrEqual(130)
    expect(sourceCard!.height).toBeLessThanOrEqual(180)
    const lastCard = await columns.nth(0).locator(".buff-row").last().boundingBox()
    await testInfo.attach("teammate-layout", {
      body: JSON.stringify({
        viewport: page.viewportSize(),
        simpleCardHeight: simpleCard!.height,
        sourceCardHeight: sourceCard!.height,
        lastCardBottom: lastCard!.y + lastCard!.height,
        footerButtonTop: applyBox!.y,
      }, null, 2),
      contentType: "application/json",
    })
    if (page.viewportSize()!.height >= 1080) {
      expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(applyBox!.y)
    }
  } else {
    const scrollContainers = await page.locator('[data-layout-surface="buff-picker"]').evaluate(root =>
      [root as HTMLElement, ...root.querySelectorAll<HTMLElement>("*")].filter(element => {
        const style = getComputedStyle(element)
        return /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2
      }).map(element => ({ className: element.className, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight })))
    expect(scrollContainers, JSON.stringify(scrollContainers)).toHaveLength(1)
  }

  const cinemaOne = page.locator('[data-buff-id="qianxia.cinema_1.cat_gaze_def_reduction"]')
  const cinemaTwo = page.locator('[data-buff-id="qianxia.cinema_2.aether_curtain_atk_pct"]')
  const cinemaFour = page.locator('[data-buff-id="qianxia.cinema_4.ultimate_team_dmg_bonus"]')
  await expect(cinemaOne).not.toHaveClass(/is-selected/)
  await expect(cinemaFour).toBeAttached()
  await page.getByTestId("teammate-cinema-0").click()
  await page.locator(".n-base-select-option").filter({ hasText: /^2 影$/ }).click()
  await expect(cinemaOne).toHaveClass(/is-selected/)
  await expect(cinemaTwo).toHaveClass(/is-selected/)
  await expect(cinemaFour).not.toHaveClass(/is-selected/)
  await cinemaOne.locator(".buff-row-toggle").focus()
  await cinemaOne.locator(".buff-row-toggle").press("Space")
  await expect(cinemaOne).not.toHaveClass(/is-selected/)

  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await expect.poll(async () => (await savedSelection(page))?.buffPickerState).toEqual({
    teammateSlots: [{ teammateId: "qianxia", cinemaLevel: 2 }, { teammateId: "liuyin", cinemaLevel: 0 }],
  })
  const saved = await savedSelection(page)
  expect(saved.combat.activeBuffIds).toContain("qianxia.cinema_2.aether_curtain_atk_pct")
  expect(saved.combat.activeBuffIds).not.toContain("qianxia.cinema_1.cat_gaze_def_reduction")
  expect(saved.combat.buffPickerState).toBeUndefined()

  await page.reload()
  await openTeammates(page)
  await expect(page.getByTestId("teammate-slot-0")).toContainText("千夏")
  await expect(page.getByTestId("teammate-slot-1")).toContainText("琉音")
  await expect(page.getByTestId("teammate-cinema-0")).toContainText("2 影")
  await expect(cinemaOne).not.toHaveClass(/is-selected/)
  await expect(cinemaTwo).toHaveClass(/is-selected/)
  await expect(cinemaFour).toBeAttached()

  await page.getByRole("button", { name: "取消", exact: true }).click()
})

test("opening a legacy three-teammate configuration saves its reset immediately and cancellation keeps own Buffs", async ({ page }) => {
  const selfId = "agent:ye_shunguang.corePassive"
  const selfCinemaId = "agent:ye_shunguang.cinema.1"
  const engineSelfId = "wEngine:zzz_wiki_1826.self"
  const engineTeamId = "wEngine:zzz_wiki_1826.team"
  const teammateIds = ["buff_j8kf2r9m4q", "buff_6646686e01", "buff_7a09645b2f"]
  const fieldId = "field.defense_v5.v3_1.p1.wenyin_gongzhen"
  const externalEngineId = "wEngine:zzz_wiki_1753.team"
  const ownRuntime = {
    [selfId]: { effects: { "effect-1": { coverage: 0.4 } } },
    [selfCinemaId]: { effects: { "effect-1": { coverage: 0.5 } } },
    [engineSelfId]: { effects: { effect_wiki_1826_self_energy: { enabled: true } } },
    [engineTeamId]: { effects: { effect_wiki_1826_team_dmg: { stacks: 1, coverage: 0.6 } } },
  }
  const config = {
    wEngineId: "zzz_wiki_1826",
    cinemaLevel: 1,
    combat: {
      activeBuffIds: [selfCinemaId, engineSelfId, engineTeamId, ...teammateIds, fieldId, externalEngineId, "custom.legacy-e2e"],
      manuallyUncheckedDefaultBuffIds: [selfId],
      runtimeInputs: {
        ...ownRuntime,
        ...Object.fromEntries([...teammateIds, fieldId, externalEngineId, "custom.legacy-e2e"].map(id => [id, { coverage: 0.7 }])),
        "teammate:qianxia": { parameters: { count: 2 } },
      },
      addedBuffs: [
        { id: "custom.legacy-e2e", name: { zhCN: "旧版自定义增益" }, sourceKind: "custom", sourceCategory: "custom", stats: [{ stat: "atkFlat", value: 123 }] },
        { id: externalEngineId, sourceKind: "wEngineTeam", wEngineModificationLevel: 3 },
      ],
    },
  }
  await page.addInitScript(({ seededConfig }) => {
    if (sessionStorage.getItem("teammate-reset-e2e-seeded")) return
    sessionStorage.setItem("teammate-reset-e2e-seeded", "1")
    localStorage.setItem("zzz-calculator.currentAccount.v1", "default")
    const selection = {
      version: 2, currentOwnerId: "default",
      byOwner: { default: { currentAgentId: "ye_shunguang", byAgent: { ye_shunguang: seededConfig } } },
    }
    for (const key of ["zzz-calculator.webapp.build.v1", "zzz-calculator.homeSelection.v1"]) {
      localStorage.setItem(key, JSON.stringify(selection))
    }
  }, { seededConfig: config })
  await page.goto("/")
  await expect(page.getByTestId("open-buff-picker")).toBeVisible()
  expect((await savedSelection(page)).combat.activeBuffIds).toEqual(expect.arrayContaining(teammateIds))
  await page.getByTestId("open-buff-picker").click()
  const notice = page.getByText("旧配置包含超过两名队友，已保留自身及自身音擎 Buff，其余已重置", { exact: true })
  await expect(notice).toBeVisible()

  // The saved reset is observable before any Apply or Cancel interaction.
  await expect.poll(async () => (await savedSelection(page))?.buffPickerState).toEqual({ teammateSlots: [null, null] })
  const reset = await savedSelection(page)
  expect(reset.combat.activeBuffIds).toEqual([selfCinemaId, engineSelfId, engineTeamId])
  expect(reset.combat.manuallyUncheckedDefaultBuffIds).toEqual([selfId])
  expect(reset.combat.runtimeInputs).toEqual(ownRuntime)
  expect(reset.combat.addedBuffs).toEqual([])
  await expect(page.locator(`[data-buff-id="${selfId}"]`)).not.toHaveClass(/is-selected/)
  await expect(page.locator(`[data-buff-id="${selfCinemaId}"]`)).toHaveClass(/is-selected/)
  await page.locator(".n-tabs-tab").filter({ hasText: /^自身音擎 Buff$/ }).click()
  await expect(page.locator(`[data-buff-id="${engineSelfId}"]`)).toHaveClass(/is-selected/)
  await expect(page.locator(`[data-buff-id="${engineTeamId}"]`)).toHaveClass(/is-selected/)
  await page.locator(".n-tabs-tab").filter({ hasText: /^队友 Buff$/ }).click()
  await expect(page.locator(".teammate-buff-column .buff-row")).toHaveCount(0)
  // Subsequent edits remain a cancellable draft even though the reset was immediate.
  await chooseTeammate(page, 0, "千夏")
  await page.getByRole("button", { name: "取消", exact: true }).click()
  expect((await savedSelection(page)).combat).toEqual(reset.combat)
  expect((await savedSelection(page)).buffPickerState).toEqual({ teammateSlots: [null, null] })

  await page.reload()
  await openTeammates(page)
  await expect(notice).toHaveCount(0)
  await expect(page.locator(".teammate-buff-column .buff-row")).toHaveCount(0)
  const restored = await savedSelection(page)
  expect(restored.combat).toEqual(reset.combat)
  expect(restored.buffPickerState).toEqual({ teammateSlots: [null, null] })
  await page.getByRole("button", { name: "取消", exact: true }).click()
})
