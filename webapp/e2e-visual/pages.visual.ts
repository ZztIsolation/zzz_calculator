import { expect, test, type Page } from "@playwright/test"

/*
 * 外观回归：用截图代替“在源码里查 CSS 字符串”的断言。
 * 改了样式后先确认界面变化符合预期，再运行 `npm run test:visual:update` 更新基线。
 */

async function openPage(page: Page, pathname: string) {
  await page.goto(pathname)
  await expect(page.locator("#app")).toBeVisible()
  await page.waitForLoadState("networkidle")
  // 等字体就绪，避免首帧字体回退造成像素差异
  await page.evaluate(() => document.fonts.ready)
}

for (const [name, pathname] of [
  ["workbench", "/"],
  ["discs", "/discs"],
  ["accounts", "/accounts"],
  ["settings", "/settings"],
] as const) {
  test(`${name} page`, async ({ page }) => {
    await openPage(page, pathname)
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true })
  })
}

test("buff picker dialog", async ({ page }) => {
  await openPage(page, "/")
  await page.getByTestId("open-buff-picker").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveScreenshot("buff-picker.png")
})

test("calculation config dialog", async ({ page }) => {
  await openPage(page, "/")
  await page.getByTestId("open-calculation-config").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveScreenshot("calculation-config.png")
})
