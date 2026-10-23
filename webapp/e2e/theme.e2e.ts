import { expectNavigationFits, expectNavigationReachable } from "./navigation-assertions"
import { expect, test, type Locator } from "@playwright/test"

const THEME_KEY = "zzz-calculator.webapp.theme.v1"

for (const width of [320, 360, 390]) {
  test(`all six navigation entries remain reachable and aligned at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route("**/api/app-config", async route => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), maintenanceEnabled: true, enkaImportEnabled: true } })
    })
    await page.goto("/")
    await expectNavigationReachable(page)
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`) })
    // A narrower local container exercises scrolling even when the viewport's links all fit.
    const nav = page.getByRole("navigation", { name: "主导航" })
    await nav.evaluate(element => { element.style.width = "140px" })
    await expect.poll(() => nav.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
    await expectNavigationReachable(page)
    await expect.poll(() => nav.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`navigation-scrolled-${width}.png`) })
  })
}

// Composite transparent surfaces, including the score bar's separate fill layer.
async function expectReadable(locator: Locator, overlay?: string) {
  const measureContrast = () => locator.evaluate((element, overlaySelector) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
    const blend = (front: number[], back: number[]) => {
      const alpha = front[3] ?? 1
      return front.slice(0, 3).map((value, index) => value * alpha + back[index]! * (1 - alpha))
    }
    const chain: Element[] = []
    for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node)
    let background = [255, 255, 255]
    for (const node of chain) background = blend(parse(getComputedStyle(node).backgroundColor), background)
    if (overlaySelector) {
      const fill = element.parentElement!.querySelector(overlaySelector)!
      background = blend(parse(getComputedStyle(fill).backgroundColor), background)
    }
    const foreground = blend(parse(getComputedStyle(element).color), background)
    const luminance = (rgb: number[]) => rgb.map(channel => {
      const s = channel / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0)
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (values[0]! + 0.05) / (values[1]! + 0.05)
  }, overlay)
  await expect.poll(measureContrast, { message: `text contrast for ${locator}` }).toBeGreaterThanOrEqual(4.5)
}

for (const width of [1440, 390, 320]) {
  test(`theme button, persistence and readable workbench at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/")
    const button = page.getByTestId("theme-toggle")
    const resultScore = page.locator(".optimizer-result-score-value")
    await expect(button).toHaveAccessibleName("主题：跟随系统（点击切换为浅色）")
    await expect(resultScore).toBeVisible()
    await button.focus()
    await expect(button).toBeFocused()
    expect(await button.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2)
    await button.press("Enter")
    await expect(button).toHaveAccessibleName("主题：浅色（点击切换为深色）")
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`light-${width}.png`) })
    await button.press("Space")
    await expect(button).toHaveAccessibleName("主题：深色（点击切换为跟随系统）")
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 19, 29)")
    for (const selector of [".drive-disc-source-label", ".selected-set-chip", ".optimizer-set-select-button"]) {
      await expectReadable(page.locator(selector).first())
    }
    await expectReadable(resultScore, ".optimizer-result-ratio-fill")
    await expectReadable(page.locator(".drive-disc-analysis-strip span"))
    await expectReadable(page.locator(".optimizer-result-effective-substats"))
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`dark-${width}.png`) })
    await expect(page.locator(".nav")).toBeVisible()
    const overflow = await page.locator(".app-topbar").evaluate(el => ({
      page: document.documentElement.scrollWidth - innerWidth,
      bar: el.scrollWidth - el.clientWidth,
      buttonRight: el.querySelector(".theme-toggle")!.getBoundingClientRect().right,
    }))
    expect(overflow.page).toBeLessThanOrEqual(2)
    expect(overflow.bar).toBeLessThanOrEqual(2)
    await expectNavigationFits(page)
    expect(overflow.buttonRight).toBeLessThanOrEqual(width)
    await page.reload()
    await expect(button).toHaveAccessibleName("主题：深色（点击切换为跟随系统）")
    expect(await page.evaluate(key => localStorage.getItem(key), THEME_KEY)).toBe("dark")
    await page.getByRole("link", { name: "设置", exact: true }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(button).toHaveAccessibleName("主题：深色（点击切换为跟随系统）")
    await button.click()
    await expect(page.locator("html")).not.toHaveAttribute("data-theme")
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(238, 241, 246)")
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 19, 29)")
  })
}

test("open dialogs follow the system without closing or losing their draft", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await page.locator(".optimizer-set-select-button").first().click()
  const choice = page.locator(".set-choice").first()
  await expect(choice).toBeVisible()
  const checked = await choice.locator("input").isChecked()
  await choice.click()
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 19, 29)")
  await expect(choice).toBeVisible()
  await expect(choice.locator("input")).toBeChecked({ checked: !checked })
  await expectReadable(choice.locator("strong"))
  await page.screenshot({ animations: "disabled", path: test.info().outputPath("dark-set-dialog.png") })
  await page.getByRole("button", { name: "取消", exact: true }).click()
  await page.getByRole("button", { name: "选择 Buff", exact: true }).click()
  const tabs = page.locator(".buff-category-tabs")
  await expect(tabs).toBeVisible()
  await page.screenshot({ animations: "disabled", path: test.info().outputPath("dark-buff-dialog.png") })
  await page.emulateMedia({ colorScheme: "light" })
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(238, 241, 246)")
  await expect(tabs).toBeVisible()
})

test("explicit preference overrides system changes on every main route", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await page.getByTestId("theme-toggle").click()
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(238, 241, 246)")
  await page.emulateMedia({ colorScheme: "light" })
  await page.getByTestId("theme-toggle").click()
  for (const path of ["/discs", "/accounts", "/settings", "/import", "/maintenance"]) {
    await page.goto(path)
    await expect(page.getByTestId("theme-toggle")).toHaveAccessibleName("主题：深色（点击切换为跟随系统）")
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 19, 29)")
    await page.waitForLoadState("networkidle")
    await page.screenshot({ animations: "disabled", path: test.info().outputPath(`dark${path.replaceAll("/", "-")}.png`) })
  }
  expect(errors).toEqual([])
})


test("equipped discs, analysis and configuration dialogs stay readable in dark mode", async ({ page }) => {
  test.slow()
  await page.addInitScript(store => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined })
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(store))
  }, {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [{
      id: "layout-disc-1",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [
        { stat: "critRate", value: 9.6 },
        { stat: "critDmg", value: 19.2 },
        { stat: "atkPct", value: 9 },
        { stat: "atkFlat", value: 57 },
      ],
    }],
  })
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await page.locator(".disc-slot-card").filter({ hasText: "1号位" }).first().click()
  const option = page.locator(".manual-disc-option").first()
  await expect(option).toBeVisible()
  await expectReadable(option.locator("strong").first())
  await option.click()
  await page.getByTestId("open-drive-disc-analysis").click()
  const analysis = page.locator('[data-layout-surface="drive-disc-analysis"]')
  await expect(analysis).toBeVisible()
  await page.screenshot({ animations: "disabled", path: test.info().outputPath("dark-analysis.png") })
  await page.keyboard.press("Escape")
  await expect(analysis).not.toBeVisible()
  for (const [name, surface] of [["编辑事件", "calculation-config"], ["计算配置", "optimizer-config"]]) {
    await page.getByRole("button", { name, exact: true }).click()
    const dialog = page.locator(`[data-layout-surface="${surface}"]`)
    await expect(dialog).toBeVisible()
    await page.screenshot({ animations: "disabled", path: test.info().outputPath(`dark-${surface}.png`) })
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
  }
})
