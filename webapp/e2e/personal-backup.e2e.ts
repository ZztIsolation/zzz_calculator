import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { createEmptyInventoryStore } from "../../core/inventory-model.js"

const MARKER = "zzz-calculator.e2e.personal-backup-marker.v1"

async function mockAppConfig(page: Page) {
  await page.route("**/api/app-config", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      enkaImportEnabled: false,
      driveDiscReservationsUiEnabled: false,
      driveDiscExclusionsUiEnabled: false,
    }),
  }))
}

async function seedInventory(page: Page) {
  await page.evaluate(store => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("zzz-calculator-user-store", 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction("state", "readwrite")
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
      const state = transaction.objectStore("state")
      const get = state.get("userDriveDiscStore")
      get.onsuccess = () => {
        const current = get.result
        state.put(current?.owners?.length ? current : store, "userDriveDiscStore")
      }
    }
  }), createEmptyInventoryStore())
}

test("complete personal backup exports and restores browser data", async ({ page }) => {
  await mockAppConfig(page)
  await page.goto("/settings")
  await expect(page.locator("#app")).toBeVisible()
  await page.waitForLoadState("networkidle")
  await seedInventory(page)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: MARKER, value: "backup-value" })

  const panel = page.locator('[data-layout-surface="personal-backup"]')
  await expect(panel).toBeVisible()

  const backupDownload = page.waitForEvent("download")
  await panel.getByRole("button", { name: "导出完整备份", exact: true }).click()
  const backupPath = await (await backupDownload).path()
  expect(backupPath).toBeTruthy()
  const backup = JSON.parse(await readFile(backupPath!, "utf8"))
  expect(backup.format).toBe("zzz-calculator-personal-backup")
  expect(backup.version).toBe(1)

  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: MARKER, value: "changed-after-backup" })

  await page.getByLabel("选择完整备份恢复").setInputFiles(backupPath!)
  const restorePanel = page.locator('[data-layout-surface="personal-restore"]')
  await expect(restorePanel).toBeVisible()
  await expect(restorePanel).toContainText("当前：")
  await expect(restorePanel).toContainText("恢复后：")

  const copyDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "下载恢复前副本", exact: true }).click()
  await copyDownload

  const dialog = page.getByRole("dialog")
  await dialog.getByRole("checkbox").click()
  await dialog.getByRole("button", { name: "确认完整恢复", exact: true }).click()

  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), MARKER).catch(() => null))
    .toBe("backup-value")
  await expect(page.locator('[data-layout-surface="personal-backup"]')).toBeVisible()
})
