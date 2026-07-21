import { expect, test, type Page } from "@playwright/test"

const FIELD_SELECTOR = [
  "[data-layout-field]",
  ".maintenance-field",
  ".maintenance-switch-field",
].join(", ")

async function openApp(page: Page, pathname = "/") {
  await page.goto(pathname)
  await expect(page.locator("#app")).toBeVisible()
  await page.waitForLoadState("networkidle")
}

async function expectStableLayout(page: Page, surfaceName: string) {
  const surface = page.locator(`[data-layout-surface="${surfaceName}"]`).first()
  await expect(surface).toBeVisible()

  const issues = await surface.evaluate((root, fieldSelector) => {
    const tolerance = 2
    const messages: string[] = []
    const rootElement = root as HTMLElement
    const surfaceRect = rootElement.getBoundingClientRect()

    if (rootElement.scrollWidth > rootElement.clientWidth + tolerance) {
      messages.push(`surface ${rootElement.getAttribute("data-layout-surface")} overflows by ${rootElement.scrollWidth - rootElement.clientWidth}px`)
    }

    for (const element of rootElement.querySelectorAll<HTMLElement>(fieldSelector)) {
      const fieldRect = element.getBoundingClientRect()
      if (fieldRect.width === 0 || fieldRect.height === 0) continue

      const owner = element.closest<HTMLElement>("[data-layout-surface]") ?? rootElement
      const ownerRect = owner.getBoundingClientRect()
      const fieldName = element.getAttribute("data-layout-field")
        || element.querySelector(":scope > .metric-title, :scope > dt, :scope > span")?.textContent?.trim()
        || element.className

      if (fieldRect.left < ownerRect.left - tolerance || fieldRect.right > ownerRect.right + tolerance) {
        messages.push(`field ${fieldName} escapes ${owner.getAttribute("data-layout-surface")}`)
      }

      const label = element.querySelector<HTMLElement>(":scope > .metric-title, :scope > dt, :scope > span")
      if (label && (label.scrollWidth > label.clientWidth + tolerance || label.scrollHeight > label.clientHeight + tolerance)) {
        messages.push(`label ${label.textContent?.trim()} is clipped`)
      }

      const control = element.matches(".n-input, .n-input-number, .n-select")
        ? element
        : element.querySelector<HTMLElement>(".n-input, .n-input-number, .n-select")
      if (control) {
        const controlRect = control.getBoundingClientRect()
        if (controlRect.left < fieldRect.left - tolerance || controlRect.right > fieldRect.right + tolerance) {
          messages.push(`control in ${fieldName} escapes its field`)
        }
      }
    }

    if (surfaceRect.left < -tolerance || surfaceRect.right > window.innerWidth + tolerance) {
      messages.push(`surface ${rootElement.getAttribute("data-layout-surface")} escapes the viewport`)
    }

    return messages
  }, FIELD_SELECTOR)

  const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (documentOverflow > 2) issues.push(`document overflows by ${documentOverflow}px`)
  expect(issues, issues.join("\n")).toEqual([])
}

async function chooseNaiveOption(page: Page, label: string, option: string) {
  await page.getByLabel(label).click()
  await page.locator(".n-base-select-option").filter({ hasText: option }).last().click()
}

async function expectProminentConfigButton(page: Page, testId: string, label: string) {
  const button = page.getByTestId(testId)
  await expect(button).toBeVisible()
  await expect(button).toHaveText(label)

  const appearance = await button.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      width: rect.width,
      height: rect.height,
      backgroundColor: style.backgroundColor,
      fontWeight: Number(style.fontWeight),
      borderColor: style.borderColor,
      borderWidth: Number.parseFloat(style.borderWidth),
    }
  })

  expect(appearance.width).toBeGreaterThanOrEqual(116)
  expect(appearance.height).toBeGreaterThanOrEqual(40)
  expect(appearance.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  expect(appearance.fontWeight).toBeGreaterThanOrEqual(700)
  expect(appearance.borderWidth).toBeGreaterThanOrEqual(2)
  expect(appearance.borderColor).not.toBe(appearance.backgroundColor)

  await button.focus()
  await expect(button).toBeFocused()
  const focusAppearance = await button.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      focusVisible: element.matches(":focus-visible"),
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineOffset: Number.parseFloat(style.outlineOffset),
    }
  })
  expect(focusAppearance.focusVisible).toBe(true)
  expect(focusAppearance.outlineWidth).toBeGreaterThanOrEqual(3)
  expect(focusAppearance.outlineOffset).toBeGreaterThanOrEqual(2)
}

test("event management keeps disorder labels and controls visible", async ({ page }) => {
  await openApp(page)
  await expectProminentConfigButton(page, "open-calculation-config", "配置")
  await page.getByTestId("open-calculation-config").click()
  await chooseNaiveOption(page, "计算方式", "自定义")
  await page.getByRole("button", { name: "添加异常事件", exact: true }).click()
  await page.getByTestId("anomaly-settlement-selector").getByText("紊乱结算", { exact: true }).click()

  const elapsedField = page.locator('[data-layout-field="elapsed-seconds"]')
  await expect(elapsedField).toBeVisible()
  await expect(elapsedField.locator(".metric-title")).toHaveText("已流逝秒数")
  await expect(elapsedField.locator(".n-input-number")).toBeVisible()
  await expectStableLayout(page, "calculation-config")

  await elapsedField.locator(".metric-title").evaluate(element => {
    element.textContent = "用于验证完整显示的超长中文字段名称"
  })
  await expectStableLayout(page, "calculation-config")
})

test("optimizer and buff configuration use protected field layouts", async ({ page }) => {
  await openApp(page)
  await expectProminentConfigButton(page, "open-optimizer-config", "计算配置")
  await expectProminentConfigButton(page, "open-buff-picker", "选择 Buff")

  await page.getByTestId("open-optimizer-config").click()
  await expectStableLayout(page, "optimizer-config")
  await page.getByRole("button", { name: "取消", exact: true }).click()

  await page.getByTestId("open-buff-picker").click()
  await page.locator(".n-tabs-tab").filter({ hasText: "自定义 Buff" }).click()
  await expectStableLayout(page, "custom-buff-effect")

  for (const tab of ["自身 Buff", "自身音擎 Buff", "队友 Buff", "队友音擎buff", "队友驱动盘buff", "场地 Buff", "Boss Buff"]) {
    await page.locator(".n-tabs-tab").filter({ hasText: tab }).click()
    if (await page.locator('[data-layout-surface="buff-runtime"]').count()) break
  }
  expect(await page.locator('[data-layout-surface="buff-runtime"]').count()).toBeGreaterThan(0)
  await expect(page.locator('[data-layout-surface="buff-runtime"]').first()).toBeVisible()
  await expectStableLayout(page, "buff-picker")
})

test("drive-disc editor and analysis stay inside their modal surfaces", async ({ page }) => {
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

  await openApp(page, "/discs")
  await page.getByTestId("open-drive-disc-editor").click()
  await expectStableLayout(page, "drive-disc-editor")
  await page.getByRole("button", { name: "取消", exact: true }).click()

  await openApp(page)
  await page.locator(".disc-slot-card").filter({ hasText: "1号位" }).first().click()
  await expectStableLayout(page, "manual-drive-disc-picker")
  await page.locator(".manual-disc-option").first().click()
  await page.getByTestId("open-drive-disc-analysis").click()
  await expectStableLayout(page, "drive-disc-analysis")
})

test("maintenance forms reflow within the editor container", async ({ page }) => {
  await openApp(page, "/maintenance")
  await expect(page.locator(".maintenance-field").first()).toBeVisible()
  await expectStableLayout(page, "maintenance-editor")
})

test("administrator default-loop events remain reachable inside the modal", async ({ page }) => {
  const browserErrors: string[] = []
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", error => browserErrors.push(error.message))

  await openApp(page, "/maintenance")
  await page.locator(".record-option").filter({ hasText: "仪玄" }).click()
  await page.getByRole("button", { name: "管理默认循环" }).click()
  await page.locator(".default-loop-tabs .n-tabs-tab").filter({ hasText: /^6 影$/ }).click()

  const surface = page.locator('[data-layout-surface="default-calculation-config"]')
  const eventList = surface.locator(".calculation-event-list")
  const eventItems = eventList.locator(".calculation-event-list-item")
  const lastEvent = eventItems.last()
  const editorPanel = surface.locator(".calculation-master-editor-panel")
  const footer = page.locator(".default-loop-footer")

  await expect(eventItems).toHaveCount(6)
  await expectStableLayout(page, "default-calculation-config")
  await expect(footer).toBeVisible()

  const listMetrics = await eventList.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight)

  await eventList.evaluate(element => { element.scrollTop = element.scrollHeight })
  const lastEventIsVisible = await lastEvent.evaluate(element => {
    const list = element.closest(".calculation-event-list")!
    const listRect = list.getBoundingClientRect()
    const eventRect = element.getBoundingClientRect()
    return eventRect.top >= listRect.top - 1 && eventRect.bottom <= listRect.bottom + 1
  })
  expect(lastEventIsVisible).toBe(true)

  const expectedTitle = (await lastEvent.locator("strong").innerText()).trim()
  await lastEvent.locator(".calculation-event-select").click()
  await expect(lastEvent).toHaveClass(/active/)
  await expect(editorPanel.locator("h4")).toHaveText(expectedTitle)

  const viewportWidth = page.viewportSize()?.width ?? 0
  const surfaceMetrics = await surface.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }))

  if (viewportWidth <= 600) {
    expect(surfaceMetrics.scrollHeight).toBeGreaterThan(surfaceMetrics.clientHeight)
    await surface.evaluate(element => { element.scrollTop = element.scrollHeight })
    const detailIsReachable = await editorPanel.evaluate(element => {
      const surface = element.closest<HTMLElement>('[data-layout-surface="default-calculation-config"]')!
      const surfaceRect = surface.getBoundingClientRect()
      const detailRect = element.getBoundingClientRect()
      return detailRect.bottom > surfaceRect.top && detailRect.top < surfaceRect.bottom
    })
    expect(detailIsReachable).toBe(true)
  } else {
    expect(surfaceMetrics.scrollHeight).toBeLessThanOrEqual(surfaceMetrics.clientHeight + 1)
    expect(surfaceMetrics.scrollTop).toBe(0)
    await expect(footer).toBeVisible()
  }

  expect(browserErrors).toEqual([])
})
