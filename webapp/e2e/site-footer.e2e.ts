import { expect, test, type Page } from "@playwright/test"

const viewports = [
  { width: 320, height: 844 },
  { width: 360, height: 844 },
  { width: 1440, height: 1000 },
]

function accountStore(ownerCount: number) {
  return {
    version: 1,
    currentOwnerId: "default",
    owners: Array.from({ length: ownerCount }, (_, index) => ({
      id: index === 0 ? "default" : `footer-account-${index}`,
      label: index === 0 ? "默认用户" : `页脚布局账号 ${String(index).padStart(2, "0")}`,
    })),
    imports: [],
    driveDiscs: [],
    driveDiscLoadouts: [],
  }
}

async function mockAppConfig(page: Page) {
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
}

async function seedAccounts(page: Page, ownerCount: number) {
  await page.addInitScript(store => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined })
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(store))
  }, accountStore(ownerCount))
}

async function openAccounts(page: Page, ownerCount: number) {
  await page.goto("/accounts")
  await expect(page.getByRole("heading", { name: "账号", exact: true })).toBeVisible()
  await expect(page.locator(".entity-grid > article")).toHaveCount(ownerCount)
  await expect(page.getByRole("contentinfo")).toBeVisible()
}

async function openShortPage(page: Page) {
  await page.goto("/import")
  await expect(page.locator(".app-main")).toBeVisible()
  await expect(page.getByRole("contentinfo")).toBeVisible()
}

async function footerMetrics(page: Page) {
  return page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>(".site-footer")!
    const link = footer.querySelector<HTMLElement>("a")!
    const main = document.querySelector<HTMLElement>(".app-main")!
    const footerRect = footer.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    const mainRect = main.getBoundingClientRect()
    const footerStyle = getComputedStyle(footer)
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      footerTop: footerRect.top,
      footerBottom: footerRect.bottom,
      footerDocumentTop: footerRect.top + window.scrollY,
      mainBottom: mainRect.bottom,
      mainDocumentBottom: mainRect.bottom + window.scrollY,
      linkCenter: (linkRect.left + linkRect.right) / 2,
      footerPosition: footerStyle.position,
      footerPaddingLeft: Number.parseFloat(footerStyle.paddingLeft),
      footerPaddingRight: Number.parseFloat(footerStyle.paddingRight),
      footerPaddingBottom: Number.parseFloat(footerStyle.paddingBottom),
    }
  })
}

function expectSharedFooterGeometry(metrics: Awaited<ReturnType<typeof footerMetrics>>) {
  expect(metrics.documentScrollWidth - metrics.viewportWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(2)
  expect(metrics.bodyScrollWidth - metrics.viewportWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.linkCenter - metrics.viewportWidth / 2), JSON.stringify(metrics)).toBeLessThanOrEqual(2)
  expect(metrics.footerPosition).toBe("static")
  expect(metrics.footerPaddingLeft).toBeGreaterThanOrEqual(16)
  expect(metrics.footerPaddingRight).toBeGreaterThanOrEqual(16)
  expect(metrics.footerPaddingBottom).toBeGreaterThanOrEqual(12)
  expect(metrics.mainDocumentBottom).toBeLessThanOrEqual(metrics.footerDocumentTop + 2)
}

test.beforeEach(async ({ page }) => {
  await mockAppConfig(page)
})

test("filing footer stays centered at the viewport bottom on short pages", async ({ page }) => {
  await seedAccounts(page, 1)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await openShortPage(page)
    const metrics = await footerMetrics(page)

    expectSharedFooterGeometry(metrics)
    expect(metrics.documentScrollHeight - metrics.viewportHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(2)
    expect(Math.abs(metrics.footerBottom - metrics.viewportHeight), JSON.stringify(metrics)).toBeLessThanOrEqual(2)
    expect(metrics.mainBottom).toBeLessThanOrEqual(metrics.footerTop + 2)

    const filingLink = page.getByRole("link", { name: "浙ICP备2026054969号-1" })
    await page.keyboard.press("Tab")
    await filingLink.focus()
    await expect(filingLink).toBeFocused()
    const focusStyle = await filingLink.evaluate(element => {
      const style = getComputedStyle(element)
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) }
    })
    expect(focusStyle.outlineStyle).not.toBe("none")
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(3)

    await page.screenshot({
      path: `../output/playwright/site-footer-short-${viewport.width}.png`,
      fullPage: true,
    })
  }
})

test("filing footer follows long content without covering the last account", async ({ page }) => {
  const ownerCount = 36
  await seedAccounts(page, ownerCount)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await openAccounts(page, ownerCount)
    await page.evaluate(() => window.scrollTo(0, 0))

    const initialMetrics = await footerMetrics(page)
    expectSharedFooterGeometry(initialMetrics)
    expect(initialMetrics.documentScrollHeight).toBeGreaterThan(initialMetrics.viewportHeight + 2)
    expect(initialMetrics.footerTop).toBeGreaterThanOrEqual(initialMetrics.viewportHeight - 2)

    const footer = page.getByRole("contentinfo")
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeInViewport()
    const finalMetrics = await footerMetrics(page)
    expectSharedFooterGeometry(finalMetrics)
    expect(finalMetrics.footerBottom).toBeLessThanOrEqual(finalMetrics.viewportHeight + 2)

    const noOverlap = await page.evaluate(() => {
      const lastAccount = document.querySelector<HTMLElement>(".entity-grid > article:last-child")!
      const footer = document.querySelector<HTMLElement>(".site-footer")!
      const lastRect = lastAccount.getBoundingClientRect()
      const footerRect = footer.getBoundingClientRect()
      return {
        lastBottom: lastRect.bottom,
        footerTop: footerRect.top,
        separated: lastRect.bottom <= footerRect.top + 2,
      }
    })
    expect(noOverlap.separated, JSON.stringify(noOverlap)).toBe(true)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `../output/playwright/site-footer-long-${viewport.width}.png`,
      fullPage: true,
    })
  }
})
