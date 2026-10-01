import { expect, test, type Page } from '@playwright/test'
import { createEmptyInventoryStore } from '../../core/inventory-model.js'

const special = 'yaojiayin.special_aria_buff'
const core = 'yaojiayin.core_andante_atk'
const cinema = 'yaojiayin.cinema_1.enemy_res_reduction'

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('zzz-calculator.webapp.build.v1')!).byOwner.default.byAgent.ye_shunguang)
}

async function setImportedLevel(page: Page, level: number) {
  await page.evaluate(value => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('zzz-calculator-user-store', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('state', 'readwrite')
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Seed transaction aborted')) }
      const state = transaction.objectStore('state')
      const get = state.get('userDriveDiscStore')
      get.onsuccess = () => {
        const store = get.result ?? value.emptyStore
        store.enkaImportState ??= { version: 1, byOwner: {} }
        store.enkaImportState.byOwner.default = {
          binding: { uid: '123456789', boundAt: '2026-10-02T00:00:00Z', lastImportedAt: '2026-10-02T00:00:00Z' },
          history: { version: 1, byAgent: { yaojiayin: {
            agentId: 'yaojiayin', agentName: '耀嘉音', uid: '123456789', completeness: 'full',
            firstImportedAt: '2026-10-02T00:00:00Z', lastImportedAt: '2026-10-02T00:00:00Z',
            snapshot: { coreSkillLevel: 6, cinemaLevel: 2, skillLevels: { special: value.level }, driveDiscCount: 0, driveDiscSourceCount: 0, wEngine: null },
          } } },
        }
        state.put(store, 'userDriveDiscStore')
      }
    }
  }), { level, emptyStore: createEmptyInventoryStore() })
}

async function seed(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('open-buff-picker')).toBeEnabled()
  await setImportedLevel(page, 12)
  await page.evaluate(({ special, core }) => {
    const config = {
      agentLevel: 60,
      buffPickerState: { teammateSlots: [{ teammateId: 'yaojiayin', cinemaLevel: 6 }, null] },
      combat: { activeBuffIds: [special], addedBuffs: [], runtimeInputs: {
        [special]: { effects: { yaojiayin_special_aria_dmg_bonus: { sourceValue: 16, coverage: 0.5 } } },
        [core]: { effects: { yaojiayin_core_andante_atk_flat: { sourceValue: 2900 } } },
      } },
    }
    const document = { version: 2, currentOwnerId: 'default', byOwner: { default: { currentAgentId: 'ye_shunguang', byAgent: { ye_shunguang: config } } } }
    for (const key of ['zzz-calculator.webapp.build.v1', 'zzz-calculator.homeSelection.v1']) localStorage.setItem(key, JSON.stringify(document))
  }, { special, core })
  await page.reload()
  await expect(page.getByTestId('open-buff-picker')).toBeEnabled()
}

async function openPicker(page: Page) {
  await page.getByTestId('open-buff-picker').click()
  await page.locator('.n-tabs-tab').filter({ hasText: /^队友 Buff$/ }).click()
  await expect(page.locator(`[data-buff-id="${special}"]`)).toBeVisible()
}

test('imported teammate adoption, three refresh saves, retry and concurrent source rejection', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await seed(page)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await page.reload()
    await openPicker(page)
    await expect(page.locator(`[data-buff-id="${core}"]`)).not.toHaveClass(/is-selected/)
    await page.getByRole('button', { name: '应用选择', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  const adopted = await saved(page)
  expect(adopted.buffPickerState.teammateSlots[0].cinemaLevel).toBe(2)
  expect(adopted.combat.runtimeInputs[special].effects.yaojiayin_special_aria_dmg_bonus).toMatchObject({ sourceValue: 12, coverage: 0.5 })
  await openPicker(page)
  await page.locator(`[data-buff-id="${core}"] .buff-row-toggle`).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'zzz-calculator.homeSelection.v1') {
        Storage.prototype.setItem = original
        throw new Error('e2e-one-shot-save-failure')
      }
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '应用选择', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'e2e-one-shot-save-failure' })).toBeVisible()
  expect((await saved(page)).combat.activeBuffIds).not.toContain(core)
  await expect(page.locator(`[data-buff-id="${core}"]`)).toHaveClass(/is-selected/)
  await page.getByRole('button', { name: '应用选择', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect((await saved(page)).combat.activeBuffIds).toContain(core)

  await openPicker(page)
  const other = await page.context().newPage()
  await other.goto('/')
  await expect(other.getByTestId('open-buff-picker')).toBeEnabled()
  await setImportedLevel(other, 14)
  await page.getByRole('button', { name: '应用选择', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '账号、配装或导入资料已变化' })).toBeVisible()
  await expect(page.locator(`[data-buff-id="${core}"]`)).toHaveClass(/is-selected/)
  await other.close()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.reload()
  await expect(page.getByTestId('open-buff-picker')).toBeEnabled()
  expect((await saved(page)).combat.runtimeInputs[special].effects.yaojiayin_special_aria_dmg_bonus).toMatchObject({ sourceValue: 14, coverage: 0.5 })
  expect(errors).toEqual([])
})

test('resync stays a cancellable draft and retains scenario inputs on apply', async ({ page }, testInfo) => {
  await seed(page)
  await openPicker(page)
  await page.getByRole('button', { name: '从导入资料重新同步' }).click()
  await expect(page.locator(`[data-buff-id="${core}"]`)).toHaveClass(/is-selected/)
  await expect(page.locator(`[data-buff-id="${cinema}"]`)).toHaveClass(/is-selected/)
  await page.locator('.teammate-source-notices summary').click()
  if (testInfo.project.use.isMobile) {
    const scrollContainers = await page.locator('[data-layout-surface="buff-picker"]').evaluate(root =>
      [root as HTMLElement, ...root.querySelectorAll<HTMLElement>('*')].filter(element =>
        /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 2).length)
    expect(scrollContainers).toBe(1)
  }
  const applyBox = await page.getByRole('button', { name: '应用选择', exact: true }).boundingBox()
  expect(applyBox!.y + applyBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  await page.screenshot({ path: testInfo.outputPath('enka-teammate-sync.png') })
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect((await saved(page)).combat.activeBuffIds).not.toContain(core)
  await openPicker(page)
  await page.getByRole('button', { name: '从导入资料重新同步' }).click()
  await page.getByRole('button', { name: '应用选择', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const result = await saved(page)
  expect(result.combat.activeBuffIds).toEqual(expect.arrayContaining([core, cinema]))
  expect(result.combat.runtimeInputs[core].effects.yaojiayin_core_andante_atk_flat.sourceValue).toBe(2900)
  expect(result.combat.runtimeInputs[special].effects.yaojiayin_special_aria_dmg_bonus).toMatchObject({ sourceValue: 12, coverage: 0.5 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2)
})
