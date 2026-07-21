import { expect, test } from "@playwright/test"

test("public Helper 1.2.1 upgrades transactionally and resumes Scanner 1.0.43 preparation", async ({ page }) => {
  test.skip(process.env.ZZZ_REAL_HELPER_UPGRADE !== "1", "Runs only against the isolated real-Helper upgrade fixture.")
  test.setTimeout(180_000)

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  await expect(page.getByText("Helper 1.3.1 · Scanner 1.0.43 · 后台运行", { exact: true }))
    .toBeVisible({ timeout: 150_000 })
  await expect(page.getByRole("button", { name: "开始扫描", exact: true })).toBeEnabled()
  await expect(page.getByText(/更新失败|确认失败|未检测到扫描助手/)).toHaveCount(0)
})
