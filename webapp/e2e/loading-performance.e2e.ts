import { expect, test } from "@playwright/test"

test("workbench uses small thumbnails without changing image layout", async ({ page }) => {
  const failures: string[] = []
  const originalRequests: string[] = []
  page.on("pageerror", error => failures.push(error.message))
  page.on("requestfailed", request => failures.push(request.url()))
  page.on("request", request => {
    if (/\/assets\/(agents|w-engines|drive-discs)\/.*\.(png|webp|jpe?g)$/i.test(request.url())) {
      originalRequests.push(request.url())
    }
  })
  await page.goto("/")
  for (const category of ["agents", "w-engines", "drive-discs"]) {
    const image = page.locator(`img[src^="/assets/thumbs/${category}/"]`).first()
    await expect(image).toBeAttached()
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect(image).toHaveAttribute("loading", "lazy")
  }
  await page.waitForLoadState("networkidle")
  const thumbnailBytes = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming && entry.name.includes("/assets/thumbs/"))
    .reduce((sum, entry) => sum + entry.encodedBodySize, 0))
  expect(thumbnailBytes).toBeGreaterThan(0)
  expect(thumbnailBytes).toBeLessThan(50_000)
  expect(originalRequests).toEqual([])
  expect(failures).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2)
})
