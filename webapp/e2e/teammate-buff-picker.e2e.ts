import { expect, test, type Page } from "@playwright/test"

async function openTeammates(page: Page) {
  await page.getByTestId("open-buff-picker").click()
  await page.locator(".n-tabs-tab").filter({ hasText: /^队友 Buff$/ }).click()
  await expect(page.getByTestId("teammate-slot-0")).toBeVisible()
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
      }).length)
    expect(scrollContainers).toBe(1)
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
