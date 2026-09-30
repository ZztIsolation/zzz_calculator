import { expect, test } from "@playwright/test"

test("four anomaly engines expose exact ranks, shared stacks and persisted runtime controls", async ({ page }) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(10_000)
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/")
  const agent = page.locator(".workbench-left .n-select").first()
  await agent.click()
  await agent.locator("input").fill("爱芮")
  await page.locator(".n-base-select-option").filter({ hasText: "爱芮" }).last().click()

  for (const [id, name, maxStacks] of [
    ["zzz_wiki_1964", "朔月裁霜", 2],
    ["zzz_wiki_841", "灼心摇壶", 10],
    ["zzz_wiki_2087", "咚哒回声", 0],
    ["zzz_wiki_154", "雨林饕客", 10],
  ] as const) {
    const selector = page.locator(".workbench-w-engine-section .w-engine-select")
    await selector.locator(".n-base-selection").click()
    await selector.locator("input").fill(name)
    await page.getByText(new RegExp(`异常 / ${name} /`)).click()
    await expect(selector).toContainText(name)
    await expect(selector.locator("img")).toBeVisible()
    await expect.poll(() => selector.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

    const rank = page.locator(".workbench-w-engine-section .n-select")
    await rank.click()
    await page.locator(".n-base-select-option").last().click()
    await page.getByTestId("open-buff-picker").click()
    await page.locator(".n-tabs-tab").filter({ hasText: "自身音擎 Buff" }).click()
    const card = page.locator(`[data-buff-id="wEngine:${id}.self"]`)
    await expect(card).toBeVisible()
    await expect(card.locator('input[type="range"]')).toHaveCount(maxStacks ? 1 : 0)
    if (maxStacks) {
      const slider = card.getByRole("slider")
      await expect(slider).toHaveValue(String(maxStacks))
      await slider.focus()
      await slider.press("Home")
      for (let i = 0; i < (id === "zzz_wiki_1964" ? 1 : 4); i++) await slider.press("ArrowRight")
      await expect(slider).toHaveValue(id === "zzz_wiki_1964" ? "1" : "4")
    }
    if (id === "zzz_wiki_841") {
      await expect(card.locator(".buff-effect-lines")).toContainText("+28%")
      await expect(card.locator(".buff-effect-lines")).toContainText("+0")
      await card.getByRole("slider").press("ArrowRight")
      await expect(card.locator(".buff-effect-lines")).toContainText("+100")
    }
    if (id === "zzz_wiki_2087") await expect(card.locator(".buff-effect-lines")).toContainText("+18.4%")
    await page.getByRole("button", { name: "应用选择", exact: true }).click()
    await expect(card).not.toBeVisible()
    const expectedStacks = id === "zzz_wiki_1964" ? 1 : id === "zzz_wiki_841" ? 5 : 4
    await expect.poll(() => page.evaluate(({ id, maxStacks, expectedStacks }) => {
      const doc = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "null")
      const config = doc?.byOwner?.default?.byAgent?.aria
      const effects = config?.combat?.runtimeInputs?.[`wEngine:${id}.self`]?.effects
      const expectedRules = id === "zzz_wiki_1964" || id === "zzz_wiki_841" ? 2 : 1
      return config?.wEngineId === id && config?.wEngineModificationLevel === 5
        && (!maxStacks || (Object.keys(effects ?? {}).length === expectedRules
          && Object.values(effects ?? {}).every((rule: any) => rule.stacks === expectedStacks)))
    }, { id, maxStacks, expectedStacks })).toBe(true)
    await page.reload()
    await expect(selector).toContainText(name)
    await page.getByTestId("open-buff-picker").click()
    await page.locator(".n-tabs-tab").filter({ hasText: "自身音擎 Buff" }).click()
    if (maxStacks) await expect(card.getByRole("slider")).toHaveValue(String(expectedStacks))
    await page.getByRole("button", { name: "取消", exact: true }).click()
  }
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2)
})
