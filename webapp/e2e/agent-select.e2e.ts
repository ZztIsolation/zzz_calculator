import { expect, test, type Page } from "@playwright/test"

async function openAgentMenu(page: Page) {
  const control = page.locator(".agent-select")
  await control.locator(".n-base-selection").click()
  const menu = page.locator(".agent-select-menu")
  await expect(menu).toBeVisible()
  return { control, menu }
}

test("selects a role through specialty then character", async ({ page }) => {
  await page.goto("/")
  const { control, menu } = await openAgentMenu(page)
  await expect(menu.getByText("强攻", { exact: true })).toBeVisible()
  const specialty = menu.getByText("强攻", { exact: true })
  if (test.info().project.use.isMobile) await specialty.tap()
  else await specialty.hover()
  const agent = menu.locator(".agent-select-option").first()
  const name = (await agent.locator(".agent-select-name").textContent())!.trim()
  if (test.info().project.use.isMobile) await agent.tap()
  else await agent.click()
  await expect(control).toContainText(name)
  await expect(menu).toBeHidden()
})

test("searches roles across specialties and selects with the keyboard", async ({ page }) => {
  await page.goto("/")
  const { control } = await openAgentMenu(page)
  await control.locator("input").fill("爱芮")
  await control.locator("input").press("ArrowDown")
  await control.locator("input").press("Enter")
  await expect(control).toContainText("爱芮")
})

test("keeps the role menu inside the viewport at narrow and short sizes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1920", "The standard projects cover desktop and mobile viewport classes")
  await page.goto("/")
  for (const [width, height] of [[1366, 768], [844, 360], [390, 844], [320, 400]]) {
    await test.step(`${width}x${height}`, async () => {
      await page.setViewportSize({ width, height })
      const { menu } = await openAgentMenu(page)
      const bounds = await menu.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
      await page.keyboard.press("Escape")
      await expect(menu).toBeHidden()
    })
  }
})
