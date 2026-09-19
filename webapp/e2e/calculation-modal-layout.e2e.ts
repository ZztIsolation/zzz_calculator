import { expect, test, type Locator, type Page } from "@playwright/test"

const categories = ["自身 Buff", "自身音擎 Buff", "队友 Buff", "队友音擎buff", "队友驱动盘buff", "场地 Buff", "Boss Buff", "自定义 Buff"]

async function expectPinnedActions(page: Page) {
  const modal = page.getByRole("dialog")
  await expect(modal).toHaveClass(/calculation-modal/)
  // Check geometry before clicking: Playwright's auto-scroll could hide the original bug.
  await expect.poll(() => modal.evaluate(root => {
    const rect = root.getBoundingClientRect()
    const footer = root.querySelector<HTMLElement>(".calculation-modal-footer")!
    const footerRect = footer.getBoundingClientRect()
    const actions = [...footer.querySelectorAll<HTMLButtonElement>("button")]
    const wrapper = root.closest<HTMLElement>(".n-scrollbar-container")
    return rect.top >= 15 && rect.bottom <= innerHeight - 15
      && rect.left >= 0 && rect.right <= innerWidth
      && footerRect.top >= rect.top && footerRect.bottom <= rect.bottom
      && actions.every(button => {
        const box = button.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return box.height >= 40 && box.bottom <= innerHeight && !!hit && button.contains(hit)
      })
      && (!wrapper || wrapper.scrollHeight <= wrapper.clientHeight + 2)
      && document.documentElement.scrollWidth <= innerWidth + 2
  })).toBe(true)

  const nestedScrollers = await modal.evaluate(root => {
    const scrollers = [...root.querySelectorAll<HTMLElement>("*")].filter(element =>
      /auto|scroll/.test(getComputedStyle(element).overflowY)
      && element.scrollHeight > element.clientHeight + 2)
    return scrollers.filter(element => scrollers.some(parent => parent !== element && parent.contains(element)))
      .map(element => element.className)
  })
  expect(nestedScrollers).toEqual([])
}

async function scrollWithoutMovingActions(page: Page, scroller: Locator) {
  const footer = page.locator(".calculation-modal-footer")
  const before = await footer.boundingBox()
  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  const after = await footer.boundingBox()
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1)
  await expectPinnedActions(page)
}

async function exerciseBuffCategories(page: Page) {
  await page.getByTestId("open-buff-picker").click()
  const modal = page.getByRole("dialog")
  const header = modal.locator(".n-card-header")
  const toolbar = modal.locator(".toolbar")

  for (const category of categories) {
    await modal.locator(".n-tabs-tab").filter({ hasText: new RegExp(`^${category}$`) }).click()
    await expectPinnedActions(page)
    const list = modal.locator(".buff-list-scrollbar .n-scrollbar-container").first()
    const listBox = await list.boundingBox()
    expect(listBox!.height, `${category}: readable content area`).toBeGreaterThan(60)

    if (category === "队友音擎buff") {
      const headerBefore = await header.boundingBox()
      const toolbarBefore = await toolbar.boundingBox()
      await scrollWithoutMovingActions(page, list)
      expect((await header.boundingBox())!.y).toBeCloseTo(headerBefore!.y, 0)
      expect((await toolbar.boundingBox())!.y).toBeCloseTo(toolbarBefore!.y, 0)
      const lastRow = modal.locator(".buff-row").last()
      const lastBox = await lastRow.boundingBox()
      expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(listBox!.y + listBox!.height + 2)
      await lastRow.locator(".buff-check").click()
      await expect(lastRow).toHaveClass(/is-selected/)
      await expectPinnedActions(page)
    }

    if (category === "自定义 Buff") {
      await modal.getByPlaceholder("名称", { exact: true }).fill("短屏草稿")
      await modal.locator(".n-radio-button").filter({ hasText: /^指定角色招式$/ }).click()
      const add = modal.getByRole("button", { name: "添加到本次选择", exact: true })
      await add.scrollIntoViewIfNeeded()
      await expect(add).toBeInViewport()
      await expectPinnedActions(page)
      // Form and existing custom entries share this list's scroll area.
      await expect(list.locator(".custom-buff-editor")).toHaveCount(1)
    }
  }
  const cancel = modal.getByRole("button", { name: "取消", exact: true })
  await cancel.focus()
  await expect(cancel).toBeFocused()
  await cancel.press("Tab")
  await expect(modal.getByRole("button", { name: "应用选择", exact: true })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(modal).toHaveCount(0)
}

async function exerciseOtherModals(page: Page) {
  for (const entry of ["open-calculation-config", "open-optimizer-config"]) {
    await page.getByTestId(entry).click()
    const modal = page.getByRole("dialog")
    await expectPinnedActions(page)
    const body = modal.locator(".calculation-modal-body")
    const overflows = await body.evaluate(element => element.scrollHeight > element.clientHeight + 2)
    if (overflows) await scrollWithoutMovingActions(page, body)
    await modal.getByRole("button", { name: "保存配置", exact: true }).click()
    await expect(modal).toHaveCount(0)
    await page.getByTestId(entry).click()
    await expectPinnedActions(page)
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click()
    await expect(modal).toHaveCount(0)
  }
}

test("calculation dialogs keep actions pinned while every Buff category stays usable", async ({ page }) => {
  await page.goto("/")
  await exerciseBuffCategories(page)
  await exerciseOtherModals(page)
})

for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 576 }]) {
  test(`short calculation dialogs at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    // 1024x576 is the CSS viewport of a 1280x720 content area at 125% browser zoom.
    test.skip(testInfo.project.name !== "desktop-1440", "Run these additional short viewports once")
    await page.setViewportSize(viewport)
    await page.goto("/")
    await exerciseBuffCategories(page)
    await exerciseOtherModals(page)
  })
}

test("Buff scrolling preserves the draft until apply and restores it on cancel", async ({ page }) => {
  await page.goto("/")
  const selectedOnPage = page.locator(".workbench-left .chip-row").first()
  await expect(page.getByTestId("open-buff-picker")).toBeVisible()
  const openList = async () => {
    await page.getByTestId("open-buff-picker").click()
    await page.locator(".n-tabs-tab").filter({ hasText: /^队友音擎buff$/ }).click()
  }
  await openList()
  const original = await selectedOnPage.innerText()
  const row = page.getByRole("dialog").locator(".buff-row").last()
  await row.locator(".buff-check").click()
  await expect(row).toHaveClass(/is-selected/)
  expect(await selectedOnPage.innerText()).toBe(original)
  await page.getByRole("button", { name: "取消", exact: true }).click()
  await openList()
  await expect(row).not.toHaveClass(/is-selected/)
  await row.locator(".buff-check").click()
  await expectPinnedActions(page)
  await page.getByRole("button", { name: "应用选择", exact: true }).click()
  await openList()
  await expect(row).toHaveClass(/is-selected/)
  await page.keyboard.press("Escape")
})
