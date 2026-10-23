import { expect, type Page } from "@playwright/test"

export async function expectNavigationFits(page: Page) {
  const nav = page.getByRole("navigation", { name: "主导航" })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2)
  if (page.viewportSize()!.width <= 900) await expect(nav).toHaveCSS("overflow-x", "auto")
  await expect.poll(() => nav.locator("a, a span").evaluateAll(elements => elements
    .filter(element => element.scrollWidth > element.clientWidth + 1)
    .map(element => element.textContent?.trim()))).toEqual([])
}

export async function expectNavigationReachable(page: Page) {
  const nav = page.getByRole("navigation", { name: "主导航" })
  const links = nav.getByRole("link")
  await expect(links).toHaveCount(6)
  for (let index = 0; index < 6; index++) {
    const link = links.nth(index)
    const href = await link.getAttribute("href")
    await link.scrollIntoViewIfNeeded()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/" : href}$`))
    await expect(link).toHaveAttribute("aria-current", "page")
    await expectNavigationFits(page)
    await expect.poll(() => link.evaluate(element => {
      const box = element.getBoundingClientRect()
      const container = element.closest("nav")!.getBoundingClientRect()
      return box.left >= container.left - 1 && box.right <= container.right + 1
    })).toBe(true)
    await expect.poll(() => nav.evaluate(element => {
      const current = element.querySelector('a[aria-current="page"]')!.getBoundingClientRect()
      const indicator = element.querySelector(".nav-indicator")!.getBoundingClientRect()
      return Math.max(Math.abs(current.left - indicator.left), Math.abs(current.width - indicator.width))
    })).toBeLessThanOrEqual(2)
  }
}
