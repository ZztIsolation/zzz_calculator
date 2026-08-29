import { expect, test, type Page } from "@playwright/test"

const DB_NAME = "zzz-calculator-user-store"
const DB_VERSION = 1
const STATE_STORE = "state"
const STORE_KEY = "userDriveDiscStore"
const GLOBAL_DRIVE_DISC_STORE_LOCK = "zzz-drive-disc-import:store"
const AGENT_ID = "ye_shunguang"

const slotMainStats: Record<number, { stat: string, value: number, mode?: string }> = {
  1: { stat: "hpFlat", value: 2200 },
  2: { stat: "atkFlat", value: 316 },
  3: { stat: "defFlat", value: 184 },
  4: { stat: "critRate", value: 24, mode: "pct" },
  5: { stat: "physicalDmg", value: 30, mode: "pct" },
  6: { stat: "atkPct", value: 30, mode: "pct" },
}

const seededDiscs = [1, 2, 3, 4, 5, 6].map(slot => ({
  id: `loadout-save-lock-e2e-disc-${slot}`,
  ownerId: "default",
  setId: slot <= 4 ? "woodpecker_electro" : "hormone_punk",
  setName: slot <= 4 ? "啄木鸟电音" : "激素朋克",
  partition: slot,
  rarity: "S",
  level: 15,
  maxLevel: 15,
  locked: false,
  equippedBy: null,
  mainStat: {
    ...slotMainStats[slot],
    mode: slotMainStats[slot].mode ?? "flat",
    label: slotMainStats[slot].stat,
  },
  subStats: [
    { stat: "critRate", value: 4.8, mode: "pct", label: "暴击率" },
    { stat: "critDmg", value: 9.6 + slot, mode: "pct", label: "暴击伤害" },
    { stat: "atkPct", value: 6, mode: "pct", label: "攻击力" },
  ],
  source: { type: "test", sequence: slot },
}))

const seededStore = {
  version: 1,
  updatedAt: "2026-08-30T00:00:00.000Z",
  currentOwnerId: "default",
  owners: [{ id: "default", label: "默认用户" }],
  imports: [],
  driveDiscs: seededDiscs,
  driveDiscLoadouts: [],
}

const seededBuildSelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: {
    default: {
      currentAgentId: AGENT_ID,
      byAgent: {
        [AGENT_ID]: {
          discMode: "manual",
          manualDriveDiscIdsBySlot: {},
        },
      },
    },
  },
}

const seededOptimizerSettings = {
  version: 3,
  currentAgentId: AGENT_ID,
  byAgent: {
    [AGENT_ID]: {
      algorithm: "exact-super-bound",
      fourPieceSetId: "woodpecker_electro",
      fourPieceSetIds: ["woodpecker_electro"],
      fourPieceSetSource: "manual",
      twoPieceSetIds: ["hormone_punk"],
      fourPieceBuffMode: "auto",
      fourPieceBuffRuntimeInputs: {},
      mainStatLimits: { 4: [], 5: [], 6: [] },
      minimumDefaultsVersion: 2,
      minimums: {},
    },
  },
}

async function openDatabase(page: Page): Promise<void> {
  await page.evaluate(({ dbName, dbVersion, stateStore }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(stateStore)) {
        database.createObjectStore(stateStore)
      }
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  }), { dbName: DB_NAME, dbVersion: DB_VERSION, stateStore: STATE_STORE })
}

async function writeInventoryStore(page: Page, store: any): Promise<void> {
  await page.evaluate(({ dbName, dbVersion, stateStore, storeKey, value }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(stateStore, "readwrite")
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.objectStore(stateStore).put(value, storeKey)
    }
  }), {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stateStore: STATE_STORE,
    storeKey: STORE_KEY,
    value: store,
  })
}

async function readInventoryStore(page: Page): Promise<any> {
  return page.evaluate(({ dbName, dbVersion, stateStore, storeKey }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(stateStore, "readonly")
      const getRequest = transaction.objectStore(stateStore).get(storeKey)
      getRequest.onerror = () => reject(getRequest.error)
      getRequest.onsuccess = () => {
        database.close()
        resolve(getRequest.result)
      }
    }
  }), {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stateStore: STATE_STORE,
    storeKey: STORE_KEY,
  })
}

async function seedBrowserState(page: Page): Promise<void> {
  // Seed from a same-origin inert page so an already-mounted app cannot race
  // the fixture with its own startup persistence.
  const seedPath = "/__drive_disc_loadout_save_seed__"
  await page.route(`**${seedPath}`, route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><html><body>seed</body></html>",
  }))
  await page.goto(seedPath)
  await openDatabase(page)
  await writeInventoryStore(page, seededStore)
  await page.evaluate(({ buildSelection, optimizerSettings }) => {
    localStorage.setItem("zzz-calculator.currentAccount.v1", "default")
    localStorage.setItem("zzz-calculator.webapp.build.v1", JSON.stringify(buildSelection))
    localStorage.setItem("zzz-calculator.homeSelection.v1", JSON.stringify(buildSelection))
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify(optimizerSettings))
  }, { buildSelection: seededBuildSelection, optimizerSettings: seededOptimizerSettings })
  await page.unroute(`**${seedPath}`)
  await page.goto("/")
  await expect(page.locator("#app")).toBeVisible()
  await page.waitForLoadState("networkidle")
  await expect.poll(
    async () => (await readInventoryStore(page))?.driveDiscs?.length,
    { timeout: 15_000 },
  ).toBe(6)
  await expect(page.locator(".workbench-left .n-select").first()).toContainText("叶瞬光")
}

async function prepareOptimizedScheme(page: Page): Promise<void> {
  await seedBrowserState(page)
  expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe("function")

  const startOptimization = page.getByRole("button", { name: "开始优化", exact: true })
  await expect(startOptimization).toBeEnabled()
  await startOptimization.click()
  await expect(page.getByRole("button", { name: "优化结果", exact: true })).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('.drive-disc-workbench-panel .disc-slot-card[data-slot="1"]')).toContainText("啄木鸟电音")
  await expect(page.locator('.drive-disc-workbench-panel .disc-slot-card[data-slot="6"]')).toContainText("激素朋克")
  await expect(page.getByRole("button", { name: "存为套装", exact: true })).toBeEnabled()
}

async function openSaveOptimizedLoadout(page: Page, name: string) {
  await page.getByRole("button", { name: "存为套装", exact: true }).click()
  const modal = page.getByTestId("save-loadout-modal")
  await expect(modal).toBeVisible()
  await expect(modal).toContainText("保存优化结果")
  await expect(modal).toContainText("六槽完整")
  await modal.getByPlaceholder("输入套装名称").fill(name)
  return modal
}

async function holdGlobalStoreLock(page: Page): Promise<void> {
  await page.evaluate(lockName => {
    const state = window as typeof window & {
      __driveDiscLockAcquired?: boolean
      __driveDiscLockRelease?: () => void
      __driveDiscLockTask?: Promise<unknown>
    }
    state.__driveDiscLockAcquired = false
    state.__driveDiscLockTask = navigator.locks.request(lockName, async () => {
      state.__driveDiscLockAcquired = true
      await new Promise<void>(resolve => {
        state.__driveDiscLockRelease = resolve
      })
    })
  }, GLOBAL_DRIVE_DISC_STORE_LOCK)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__driveDiscLockAcquired))).toBe(true)
}

async function releaseGlobalStoreLock(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const state = window as typeof window & {
      __driveDiscLockRelease?: () => void
      __driveDiscLockTask?: Promise<unknown>
    }
    state.__driveDiscLockRelease?.()
    await state.__driveDiscLockTask
  })
}

async function pendingGlobalStoreLockCount(page: Page): Promise<number> {
  return page.evaluate(async lockName => {
    const snapshot = await navigator.locks.query()
    return (snapshot.pending ?? []).filter(lock => lock.name === lockName).length
  }, GLOBAL_DRIVE_DISC_STORE_LOCK)
}

test("workbench saves an optimized loadout through real Web Locks and IndexedDB", async ({ page }) => {
  test.slow()
  await prepareOptimizedScheme(page)

  const loadoutName = "E2E 优化套装 - 直接保存"
  const modal = await openSaveOptimizedLoadout(page, loadoutName)
  await modal.getByTestId("confirm-save-loadout").click()

  await expect(modal).toBeHidden({ timeout: 10_000 })
  await expect(page.locator(".n-message").filter({ hasText: "套装已保存" })).toBeVisible()
  const persisted = await readInventoryStore(page)
  expect(persisted.driveDiscLoadouts).toHaveLength(1)
  expect(persisted.driveDiscLoadouts[0]).toMatchObject({
    ownerId: "default",
    agentId: AGENT_ID,
    name: loadoutName,
    status: "complete",
    source: { type: "optimizer", rank: 1 },
    driveDiscIdsBySlot: Object.fromEntries(seededDiscs.map(disc => [String(disc.partition), disc.id])),
  })
})

test("workbench times out behind another page lock without a late write, then saves on retry", async ({ context, page }) => {
  test.slow()
  await prepareOptimizedScheme(page)

  const loadoutName = "E2E 优化套装 - 锁释放后重试"
  const modal = await openSaveOptimizedLoadout(page, loadoutName)
  const lockPage = await context.newPage()
  await lockPage.goto("/")
  await expect(lockPage.locator("#app")).toBeVisible()
  await holdGlobalStoreLock(lockPage)

  const saveButton = modal.getByTestId("confirm-save-loadout")
  const cancelButton = modal.getByTestId("cancel-save-loadout")
  const nameInput = modal.getByPlaceholder("输入套装名称")
  const saveStartedAt = Date.now()
  await saveButton.click()
  await expect(saveButton).toBeDisabled()
  await expect(cancelButton).toBeDisabled()
  await expect(nameInput).toBeDisabled()
  await expect(modal.getByTestId("save-loadout-error")).toContainText("其他页面或旧版本页面正在写入驱动盘库存", { timeout: 8_000 })
  expect(Date.now() - saveStartedAt).toBeGreaterThanOrEqual(4_500)
  await expect(saveButton).toBeEnabled()
  await expect(cancelButton).toBeEnabled()
  await expect(nameInput).toBeEnabled()
  await expect(nameInput).toHaveValue(loadoutName)

  let persisted = await readInventoryStore(page)
  expect(persisted.driveDiscLoadouts).toHaveLength(0)
  // Edge can retain an aborted lock entry until the held lock is released;
  // the timed-out callback guard must still prevent that entry from writing.
  expect(await pendingGlobalStoreLockCount(page)).toBeLessThanOrEqual(1)

  await releaseGlobalStoreLock(lockPage)
  await expect.poll(() => pendingGlobalStoreLockCount(page)).toBe(0)
  await page.waitForTimeout(500)
  persisted = await readInventoryStore(page)
  expect(persisted.driveDiscLoadouts).toHaveLength(0)
  await lockPage.close()

  await saveButton.click()
  await expect(modal).toBeHidden({ timeout: 10_000 })
  await expect(page.locator(".n-message").filter({ hasText: "套装已保存" })).toBeVisible()
  persisted = await readInventoryStore(page)
  expect(persisted.driveDiscLoadouts).toHaveLength(1)
  expect(persisted.driveDiscLoadouts[0]).toMatchObject({
    ownerId: "default",
    agentId: AGENT_ID,
    name: loadoutName,
    source: { type: "optimizer", rank: 1 },
  })
})
