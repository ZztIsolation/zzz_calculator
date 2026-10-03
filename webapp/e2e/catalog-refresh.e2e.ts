import { expect, test } from "@playwright/test"

test("catalog refresh revalidates over HTTP and reuses an unchanged body", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "HTTP 304 observation uses Chromium CDP")
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.enable")
  const catalogRequests = new Set<string>()
  // CDP ExtraInfo may arrive before requestWillBeSent, especially on revalidation.
  const responses: Array<{ requestId: string, statusCode: number }> = []
  const requests: Array<{ requestId: string, headers: Record<string, string> }> = []
  const statuses = () => responses.filter(event => catalogRequests.has(event.requestId)).map(event => event.statusCode)
  cdp.on("Network.requestWillBeSent", event => {
    if (new URL(event.request.url).pathname === "/api/catalog") catalogRequests.add(event.requestId)
  })
  cdp.on("Network.requestWillBeSentExtraInfo", event => {
    requests.push(event)
  })
  cdp.on("Network.responseReceivedExtraInfo", event => {
    responses.push(event)
  })
  await page.goto("/")
  await expect(page.locator('.w-engine-select-display img')).toBeAttached()
  await page.waitForLoadState("networkidle")
  expect(statuses()).toEqual([200])
  await page.reload()
  await expect(page.locator('.w-engine-select-display img')).toBeAttached()
  await page.waitForLoadState("networkidle")
  expect(statuses()).toEqual([200, 304])
  const conditionalHeaders = requests.filter(event => catalogRequests.has(event.requestId))
    .flatMap(event => Object.entries(event.headers).filter(([name]) => name.toLowerCase() === "if-none-match"))
  expect(conditionalHeaders).toHaveLength(1)
  const entry = await page.evaluate(() => {
    const catalog = performance.getEntriesByType("resource")
      .find(entry => new URL(entry.name).pathname === "/api/catalog") as PerformanceResourceTiming
    return { transferred: catalog.transferSize, decoded: catalog.decodedBodySize }
  })
  expect(entry.transferred).toBeLessThan(1_024)
  expect(entry.decoded).toBeGreaterThan(1_024)
  await cdp.detach()
})
