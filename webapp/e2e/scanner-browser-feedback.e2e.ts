import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test, type Page, type TestInfo } from "@playwright/test"

test.beforeEach(({}, testInfo) => {
  const recoveryViewport = testInfo.title.startsWith("startup recovery") && testInfo.project.name === "mobile-390"
  test.skip(testInfo.project.name !== "desktop-1366" && !recoveryViewport, "Loopback simulations run on desktop; startup recovery also covers the mobile drawer.")
})

async function mockLoopbackPermission(page: Page, states: string[]) {
  await page.addInitScript(permissionStates => {
    let index = 0
    const originalQuery = navigator.permissions.query.bind(navigator.permissions)
    const query = async (description: any) => {
      if (["loopback-network", "local-network-access"].includes(String(description?.name ?? ""))) {
        const state = permissionStates[Math.min(index, permissionStates.length - 1)] ?? "granted"
        index += 1
        return { state }
      }
      return originalQuery(description)
    }
    Object.defineProperty(Object.getPrototypeOf(navigator.permissions), "query", {
      configurable: true,
      value: query,
    })
  }, states)
}

function helperCorsHeaders(route: any) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin ?? "http://127.0.0.1:8787",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  }
}

async function fulfillHelperRoute(route: any, status: number, body: unknown) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: helperCorsHeaders(route) })
    return
  }
  await route.fulfill({
    status,
    headers: helperCorsHeaders(route),
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

type ScannerCommand = { cmd: string; data: Record<string, any> }
type MockScannerResponse = (cmd: string, data: Record<string, any>) => void

async function mockScannerSession(
  page: Page,
  handleCommand?: (command: ScannerCommand, send: MockScannerResponse) => boolean,
) {
  const commands: ScannerCommand[] = []
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    await fulfillHelperRoute(route, 200, url.pathname === "/token"
      ? { token: "scanner-preferences-token" }
      : { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } })
  })
  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    const send: MockScannerResponse = (cmd, data) => socket.send(JSON.stringify({ cmd, data }))
    socket.onMessage(message => {
      const command = JSON.parse(String(message)) as ScannerCommand
      commands.push(command)
      if (handleCommand?.(command, send)) return
      if (["ensure_scanner", "restart_scanner_elevated"].includes(command.cmd)) {
        send("scanner_ready", { version: "1.0.49", installed: true })
      } else if (command.cmd === "scan_req") {
        send("scan_complete", { items: [], completed: 0, failed: 0, itemCount: 0 })
      } else if (command.cmd === "get_diagnostics") {
        send("helper_diagnostics", {
          requestId: command.data.requestId,
          helperVersion: "1.3.1", protocolVersion: 4,
          scanner: { version: "1.0.49", installed: true },
        })
      }
    })
    setTimeout(() => send("hello", {
      service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true },
    }), 0)
  })
  return commands
}

const scanCommands = (commands: ScannerCommand[]) => commands.filter(command => command.cmd === "scan_req")
const elevatedCommands = (commands: ScannerCommand[]) => commands.filter(command => command.cmd === "restart_scanner_elevated")

test("administrator preparation returns to settings before a separately confirmed scan", async ({ page }) => {
  const commands = await mockScannerSession(page)
  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await page.getByLabel("以管理员权限启动", { exact: true }).check()
  await page.getByLabel("同步删除缺失", { exact: true }).check()
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()

  await expect.poll(() => elevatedCommands(commands).length).toBe(1)
  await expect(page.getByRole("button", { name: "开始扫描", exact: true })).toBeEnabled()
  await expect(page.getByLabel("同步删除缺失", { exact: true })).toBeChecked()
  await expect(page.getByRole("button", { name: "继续扫描", exact: true })).toHaveCount(0)
  expect(scanCommands(commands)).toHaveLength(0)

  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await expect(page.getByRole("button", { name: "继续扫描", exact: true })).toBeVisible()
  expect(scanCommands(commands)).toHaveLength(0)
  await page.getByRole("button", { name: "继续扫描", exact: true }).click()
  await expect.poll(() => scanCommands(commands).length).toBe(1)
  expect(elevatedCommands(commands)).toHaveLength(1)
})

test("permission failure and cancelled UAC preserve editable settings for a later retry", async ({ page }) => {
  let scans = 0
  let elevationRequests = 0
  const commands = await mockScannerSession(page, (command, send) => {
    if (command.cmd === "scan_req" && ++scans === 1) {
      send("scan_error", {
        code: "elevation_required", phase: "scan", retainedItems: [],
        message: "游戏进程权限高于当前扫描器。",
      })
      return true
    }
    if (command.cmd === "restart_scanner_elevated" && ++elevationRequests === 1) {
      send("scan_error", nativeStartupFailure("uac_cancelled", "你取消了 Windows 管理员权限确认，扫描器没有启动。", "cancel-after-permission"))
      return true
    }
    return false
  })
  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  const limit = page.locator('[data-layout-surface="scanner-config"] .n-input-number input')
  await limit.fill("47")
  await limit.blur()
  await page.getByLabel("遇到非 15 级时停止", { exact: true }).uncheck()
  await page.getByLabel("同步删除缺失", { exact: true }).check()
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await page.getByRole("button", { name: "继续扫描", exact: true }).click()

  await expect(page.getByText("错误代码：elevation_required")).toBeVisible()
  await expect(limit).toHaveValue("47")
  await expect(limit).toBeEnabled()
  await expect(page.getByLabel("遇到非 15 级时停止", { exact: true })).not.toBeChecked()
  await expect(page.getByLabel("同步删除缺失", { exact: true })).toBeChecked()
  await page.getByLabel("以管理员权限启动", { exact: true }).check()
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()

  await expect(page.getByText("你取消了 Windows 授权，扫描尚未开始，设置已保留。", { exact: true })).toBeVisible()
  await expect(page.getByText("错误代码：uac_cancelled")).toBeHidden()
  await expect(limit).toHaveValue("47")
  await expect(limit).toBeEnabled()
  await expect(page.getByLabel("同步删除缺失", { exact: true })).toBeChecked()
  expect(scanCommands(commands)).toHaveLength(1)
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()

  await expect(page.getByText("错误代码：uac_cancelled")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "开始扫描", exact: true })).toBeEnabled()
  expect(scanCommands(commands)).toHaveLength(1)
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await page.getByRole("button", { name: "继续扫描", exact: true }).click()
  await expect.poll(() => scanCommands(commands).length).toBe(2)
  expect(scanCommands(commands)[1].data).toMatchObject({ maxItems: 47, stopAtNonLevel15: false })
  expect(elevatedCommands(commands)).toHaveLength(2)
})

function nativeStartupFailure(code: "uac_cancelled" | "child_start_failed", message: string, diagnosticId: string) {
  return {
    code, phase: "launch", retryable: true, diagnosticId, details: {},
    title: code === "uac_cancelled" ? "已取消管理员授权" : "无法启动 OCR 扫描器",
    message,
    remedy: code === "uac_cancelled"
      ? "如游戏以管理员身份运行，请重新选择管理员启动并确认 UAC。"
      : "请选择重新下载并修复；如果问题持续，请打开日志。",
    actions: [
      { kind: "retry", label: "重试" },
      { kind: "open_logs", label: "打开日志目录" },
      { kind: "copy_diagnostics", label: "复制诊断信息" },
    ],
  }
}

async function configureRecoveryScan(page: Page) {
  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await page.locator('[aria-label="扫描客户端"]').click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: "云绝区零" }).click()
  const limit = page.locator('[data-layout-surface="scanner-config"] .n-input-number input')
  await limit.fill("47")
  await limit.blur()
  await page.getByLabel("遇到非 15 级时停止", { exact: true }).uncheck()
  await page.getByLabel("以管理员权限启动", { exact: true }).check()
  await page.getByLabel("同步删除缺失", { exact: true }).check()
}

async function expectRecoverySettings(page: Page, runAsAdmin: boolean, disabled = false) {
  const config = page.locator('[data-layout-surface="scanner-config"]')
  await expect(config).toBeVisible()
  await expect(config.locator('[aria-label="扫描客户端"]')).toContainText("云绝区零")
  const limit = config.locator(".n-input-number input")
  await expect(limit).toHaveValue("47")
  if (disabled) await expect(limit).toBeDisabled()
  else await expect(limit).toBeEnabled()
  const stop = page.getByLabel("遇到非 15 级时停止", { exact: true })
  const admin = page.getByLabel("以管理员权限启动", { exact: true })
  const remove = page.getByLabel("同步删除缺失", { exact: true })
  await expect(stop).not.toBeChecked()
  await expect(admin).toBeChecked({ checked: runAsAdmin })
  await expect(remove).toBeChecked()
  for (const control of [stop, admin, remove]) {
    // Naive UI renders these as role=checkbox divs rather than native inputs.
    if (disabled) {
      await expect(control).toHaveClass(/n-checkbox--disabled/)
      await control.evaluate(element => (element as HTMLElement).click())
    } else {
      await expect(control).not.toHaveClass(/n-checkbox--disabled/)
    }
  }
  await expect(stop).not.toBeChecked()
  await expect(admin).toBeChecked({ checked: runAsAdmin })
  await expect(remove).toBeChecked()
}

function recoveryDetails(page: Page) {
  return page.locator(".n-drawer details").filter({ has: page.locator("summary").filter({ hasText: "查看详情" }) })
}

async function expectRecoveryPrimary(page: Page, label: string, disabled = false) {
  const primary = page.locator(".n-drawer button.n-button--primary-type:visible")
  await expect(primary).toHaveCount(1)
  await expect(primary).toHaveText(label)
  if (disabled) await expect(primary).toBeDisabled()
  else await expect(primary).toBeEnabled()
  return primary
}

async function mockRecoveryClipboard(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__scannerRecoveryClipboard = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { (window as any).__scannerRecoveryClipboard.push(text) } },
    })
  })
}

async function copyRecoveryFailure(page: Page, failure: ReturnType<typeof nativeStartupFailure>) {
  const details = recoveryDetails(page)
  await details.getByRole("button", { name: "复制问题信息", exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const copied = (window as any).__scannerRecoveryClipboard ?? []
    return copied.length ? JSON.parse(copied.at(-1)).failure?.diagnosticId : null
  })).toBe(failure.diagnosticId)
  const diagnostic = await page.evaluate(() => JSON.parse((window as any).__scannerRecoveryClipboard.at(-1)))
  expect(diagnostic.failure).toMatchObject({ code: failure.code, diagnosticId: failure.diagnosticId })
  expect(diagnostic.failure.details.nativeFailure).toMatchObject({
    code: failure.code, phase: failure.phase, title: failure.title,
    message: failure.message, remedy: failure.remedy,
    actions: failure.actions, diagnosticId: failure.diagnosticId,
  })
  expect(diagnostic.helperVersion).toBe("1.3.1")
  expect(diagnostic.scannerVersion ?? diagnostic.helper?.scanner?.version).toBe("1.0.49")
  expect(diagnostic.helperProtocolVersion ?? diagnostic.helper?.protocolVersion).toBe(4)
  return diagnostic
}

async function recoveryEvidence(page: Page, testInfo: TestInfo, scenario: string) {
  const directory = fileURLToPath(new URL("../../output/playwright/", import.meta.url))
  await mkdir(directory, { recursive: true })
  const prefix = `scanner-recovery-${scenario}-${testInfo.project.name}`
  const states: Record<string, any>[] = []
  const capture = async (state: string, commands: ScannerCommand[], additional: Record<string, unknown> = {}) => {
    const screenshot = join(directory, `${prefix}-${state}.png`)
    await page.locator(".n-drawer-body, .n-drawer-body-content-wrapper").evaluateAll(elements => {
      for (const element of elements) element.scrollTop = 0
    })
    await page.screenshot({ path: screenshot })
    states.push({
      state, screenshot, viewport: page.viewportSize(),
      snapshot: await page.locator(".n-drawer:visible").ariaSnapshot(),
      commands: structuredClone(commands), ...additional,
    })
    await writeFile(join(directory, `${prefix}-requests.json`), JSON.stringify({ scenario, states, commands }, null, 2))
  }
  return { capture }
}

const startupFailureScenarios = [
  { name: "uac-cancelled", code: "uac_cancelled" as const, message: "你取消了 Windows 管理员权限确认，扫描器没有启动。", role: "status" as const },
  { name: "access-denied", code: "child_start_failed" as const, message: "拒绝访问。", role: "alert" as const },
  { name: "empty-reason", code: "child_start_failed" as const, message: "", role: "alert" as const },
]

for (const scenario of startupFailureScenarios) {
  test(`startup recovery ${scenario.name} uses current settings and exposes current diagnostics`, async ({ page }, testInfo) => {
    test.setTimeout(75_000)
    await mockRecoveryClipboard(page)
    let holdPreparations = false
    const pending: Array<{ command: ScannerCommand; send: MockScannerResponse }> = []
    const commands = await mockScannerSession(page, (command, send) => {
      if (command.cmd === "restart_scanner_elevated" || (holdPreparations && command.cmd === "ensure_scanner")) {
        holdPreparations = true
        pending.push({ command, send })
        return true
      }
      return false
    })
    const evidence = await recoveryEvidence(page, testInfo, scenario.name)
    await configureRecoveryScan(page)
    await page.getByRole("button", { name: "开始扫描", exact: true }).click()
    await expect.poll(() => pending.length).toBe(1)
    await expectRecoverySettings(page, true, true)
    await expectRecoveryPrimary(page, "开始扫描", true)
    expect(scanCommands(commands)).toHaveLength(0)
    await evidence.capture("initial-pending", commands)

    const firstFailure = nativeStartupFailure(scenario.code, scenario.message, `${scenario.name}-first`)
    pending.shift()!.send("scan_error", firstFailure)
    await expectRecoveryPrimary(page, "开始扫描")
    await expectRecoverySettings(page, true)
    const details = recoveryDetails(page)
    await expect(details).toHaveJSProperty("open", false)
    const recoveryCard = page.getByRole(scenario.role).filter({ has: page.locator("details summary").filter({ hasText: "查看详情" }) })
    await expect(recoveryCard).toBeVisible()
    await expect(page.locator(".scan-runtime-status")).toHaveText("Helper 1.3.1 · Scanner 1.0.49")
    if (scenario.code === "uac_cancelled") {
      await expect(recoveryCard).toContainText("你取消了 Windows 授权，扫描尚未开始，设置已保留。")
    } else {
      await expect(recoveryCard).toContainText("扫描器未能启动，设置已保留。")
      await expect(recoveryCard).toContainText(scenario.message ? `系统返回：${scenario.message}` : "未返回具体原因")
    }
    await expect(page.getByText(`错误代码：${scenario.code}`, { exact: true })).toBeHidden()
    await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "以管理员权限重启", exact: true })).toHaveCount(0)
    await evidence.capture("failure-collapsed", commands)

    await details.locator("summary").focus()
    await page.keyboard.press("Enter")
    await expect(details).toHaveJSProperty("open", true)
    await expect(details.getByText(`错误代码：${scenario.code}`, { exact: true })).toBeVisible()
    const firstDiagnostic = await copyRecoveryFailure(page, firstFailure)
    await details.getByRole("button", { name: "打开日志", exact: true }).click()
    await expect.poll(() => commands.filter(command => command.cmd === "open_log_folder").length).toBe(1)
    await evidence.capture("failure-expanded", commands, { diagnostic: firstDiagnostic })

    const retry = await expectRecoveryPrimary(page, "开始扫描")
    await retry.evaluate(button => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
    await expect.poll(() => pending.length).toBe(1)
    await expect.poll(() => elevatedCommands(commands).length).toBe(2)
    await expectRecoveryPrimary(page, "开始扫描", true)
    await expectRecoverySettings(page, true, true)
    await expect(page.locator(".n-drawer details[open]")).toHaveCount(0)
    expect(scanCommands(commands)).toHaveLength(0)
    await evidence.capture("retry-pending", commands)

    const secondFailure = nativeStartupFailure(scenario.code, scenario.message, `${scenario.name}-second`)
    pending.shift()!.send("scan_error", secondFailure)
    await expectRecoveryPrimary(page, "开始扫描")
    await expect(details).toHaveJSProperty("open", false)
    await details.locator("summary").focus()
    await page.keyboard.press("Enter")
    const secondDiagnostic = await copyRecoveryFailure(page, secondFailure)
    expect(secondDiagnostic.failure.diagnosticId).not.toBe(firstDiagnostic.failure.diagnosticId)
    await details.locator("summary").press("Enter")
    await expect(details).toHaveJSProperty("open", false)
    await evidence.capture("repeated-failure-collapsed", commands)

    await page.getByLabel("以管理员权限启动", { exact: true }).uncheck()
    await expectRecoveryPrimary(page, "开始扫描")
    const elevatedBeforeDefault = elevatedCommands(commands).length
    await page.getByRole("button", { name: "开始扫描", exact: true }).click()
    await expect.poll(() => pending.length).toBe(1)
    expect(pending[0]!.command.cmd).toBe("ensure_scanner")
    await expectRecoveryPrimary(page, "开始扫描", true)
    await expectRecoverySettings(page, false, true)
    pending.shift()!.send("scanner_ready", { version: "1.0.49", installed: true })
    await expectRecoveryPrimary(page, "开始扫描")
    await expectRecoverySettings(page, false)
    expect(elevatedCommands(commands)).toHaveLength(elevatedBeforeDefault)
    expect(scanCommands(commands)).toHaveLength(0)
    await expect(details).toHaveCount(0)
    await evidence.capture("default-startup-ready", commands)

    await page.getByLabel("以管理员权限启动", { exact: true }).check()
    await page.getByRole("button", { name: "开始扫描", exact: true }).click()
    await expect.poll(() => pending.length).toBe(1)
    expect(pending[0]!.command.cmd).toBe("restart_scanner_elevated")
    pending.shift()!.send("scanner_ready", { version: "1.0.49", installed: true })
    await expectRecoveryPrimary(page, "开始扫描")
    await expectRecoverySettings(page, true)
    expect(scanCommands(commands)).toHaveLength(0)
    await evidence.capture("admin-startup-ready", commands)

    await page.getByRole("button", { name: "开始扫描", exact: true }).click()
    await expect(page.getByRole("button", { name: "继续扫描", exact: true })).toBeVisible()
    expect(scanCommands(commands)).toHaveLength(0)
    await page.getByRole("button", { name: "继续扫描", exact: true }).click()
    await expect.poll(() => scanCommands(commands).length).toBe(1)
    expect(scanCommands(commands)[0]!.data).toMatchObject({
      maxItems: 47, stopAtNonLevel15: false, processName: "Zenless Zone Zero Cloud", visualProfileClient: "cloud",
    })
    await evidence.capture("explicit-scan-complete", commands)
  })
}

test("startup recovery ignores a closed session's late responses while a new administrator request is pending", async ({ page }, testInfo) => {
  const pending: MockScannerResponse[] = []
  const commands = await mockScannerSession(page, (command, send) => {
    if (command.cmd === "restart_scanner_elevated") {
      pending.push(send)
      return true
    }
    return false
  })
  const evidence = await recoveryEvidence(page, testInfo, "late-session")
  await configureRecoveryScan(page)
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await expect.poll(() => pending.length).toBe(1)
  await expectRecoveryPrimary(page, "开始扫描", true)
  const previousSend = pending.shift()!

  await page.locator(".n-drawer .n-base-close").click()
  await expect(page.locator(".n-drawer:visible")).toHaveCount(0)
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await expectRecoveryPrimary(page, "开始扫描")
  await expectRecoverySettings(page, true)
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await expect.poll(() => pending.length).toBe(1)
  const currentSend = pending.shift()!
  const delayedFailure = nativeStartupFailure("uac_cancelled", "旧连接授权已取消。", "late-old-session")
  previousSend("scanner_ready", { version: "obsolete", installed: true })
  previousSend("scan_error", delayedFailure)
  await expectRecoveryPrimary(page, "开始扫描", true)
  await expectRecoverySettings(page, true, true)
  await expect(page.getByText("旧连接授权已取消。", { exact: true })).toHaveCount(0)
  expect(scanCommands(commands)).toHaveLength(0)
  expect(elevatedCommands(commands)).toHaveLength(2)
  await evidence.capture("old-response-ignored", commands, { delayedFailure })

  currentSend("scan_error", nativeStartupFailure("child_start_failed", "拒绝访问。", "new-session-failure"))
  await expectRecoveryPrimary(page, "开始扫描")
  await expect(recoveryDetails(page)).toHaveJSProperty("open", false)
  await evidence.capture("current-failure", commands)
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await expect.poll(() => pending.length).toBe(1)
  pending.shift()!("scanner_ready", { version: "1.0.49", installed: true })
  await expectRecoveryPrimary(page, "开始扫描")
  await expectRecoverySettings(page, true)
  expect(scanCommands(commands)).toHaveLength(0)
  await evidence.capture("current-retry-ready", commands)
})

test("reload restores reusable scan preferences but never deletion consent", async ({ page }) => {
  const commands = await mockScannerSession(page)
  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await page.locator('[aria-label="扫描客户端"]').click()
  await page.locator(".n-base-select-option:visible").filter({ hasText: "云绝区零" }).click()
  const limit = page.locator('[data-layout-surface="scanner-config"] .n-input-number input')
  await limit.fill("23")
  await limit.blur()
  await page.getByLabel("遇到非 15 级时停止", { exact: true }).uncheck()
  await page.getByLabel("以管理员权限启动", { exact: true }).check()
  await page.getByLabel("同步删除缺失", { exact: true }).check()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("zzz-calculator.scannerPreferences.v1") || "null"))).toEqual({
    client: "cloud", maxItems: 23, stopAtNonLevel15: false, runAsAdmin: true,
  })

  await page.reload()
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await expect(page.locator('[aria-label="扫描客户端"]')).toContainText("云绝区零")
  await expect(limit).toHaveValue("23")
  await expect(page.getByLabel("遇到非 15 级时停止", { exact: true })).not.toBeChecked()
  await expect(page.getByLabel("以管理员权限启动", { exact: true })).toBeChecked()
  await expect(page.getByLabel("同步删除缺失", { exact: true })).not.toBeChecked()
  expect(scanCommands(commands)).toHaveLength(0)
})

test("Chrome-style loopback denial is shown as a browser permission problem", async ({ page }) => {
  const helperRequests: string[] = []
  await mockLoopbackPermission(page, ["prompt", "denied"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    helperRequests.push(route.request().url())
    await route.abort("blockedbyclient")
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  const alert = page.getByRole("alert")
  await expect(alert.getByText("浏览器已阻止连接本机扫描助手")).toBeVisible()
  await expect(alert).toContainText("错误代码：loopback_permission_denied")
  await expect(alert).toContainText("原因：")
  await expect(alert).toContainText("解决方案：")
  await expect(alert).toContainText("本地网络")
  await expect(alert).toContainText("本机应用")
  await expect(page.getByRole("button", { name: "我已允许，重新连接", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "下载扫描助手", exact: true })).toHaveCount(0)
  expect(helperRequests).toHaveLength(1)
})

test("Helper token 403 is shown as an origin rejection instead of Helper missing", async ({ page }) => {
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    await fulfillHelperRoute(
      route,
      url.pathname === "/token" ? 403 : 200,
      url.pathname === "/token"
        ? { error: "Bad Origin" }
        : { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    )
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  await expect(page.getByRole("heading", { name: "扫描助手拒绝了当前网页", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "下载最新版 Helper", exact: true })).toBeVisible()
  await expect(page.getByText("未检测到扫描助手")).toHaveCount(0)
})

test("a failed WebSocket after successful HTTP probe has its own recovery state", async ({ page }) => {
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    await fulfillHelperRoute(
      route,
      200,
      url.pathname === "/token"
        ? { token: "blocked-websocket" }
        : { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    )
  })
  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    setTimeout(() => void socket.close({ code: 1008, reason: "blocked by policy" }), 0)
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  await expect(page.getByText("浏览器未能建立扫描连接")).toBeVisible()
  await expect(page.getByText(/WebSocket/)).toBeVisible()
  await expect(page.getByRole("button", { name: "重新连接", exact: true })).toBeVisible()
  await expect(page.getByText("未检测到扫描助手")).toHaveCount(0)
})

test("Helper auto-launch has a coded terminal state after 60 seconds", async ({ page }) => {
  await page.clock.install()
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", route => route.abort("connectionrefused"))

  await page.goto("/discs")
  await page.evaluate(() => {
    window.open = ((url?: string | URL) => {
      ;(window as any).__openedHelperDownloadUrl = String(url ?? "")
      return null
    }) as typeof window.open
  })
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await expect(page.getByRole("heading", { name: "未检测到扫描助手", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "下载扫描助手", exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__openedHelperDownloadUrl)).toBe(
    "https://download.zzzcaculator.top/downloads/zzz-scanner/helper/1.3.1/ZZZ-Scanner-Helper.exe",
  )
  await expect(page.getByRole("button", { name: "我已运行，重新连接", exact: true })).toBeVisible()

  await page.clock.fastForward(60_000)

  await expect(page.getByText("错误代码：helper_launch_timeout")).toBeVisible()
  await expect(page.getByText(/SmartScreen|安全软件/)).toBeVisible()
  await expect(page.getByRole("button", { name: "重新检测", exact: true })).toBeVisible()
})

test("partial OCR completion automatically imports without destructive synchronization", async ({ page }) => {
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    await fulfillHelperRoute(
      route,
      200,
      url.pathname === "/token"
        ? { token: "partial-token" }
        : { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    )
  })
  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    socket.onMessage(message => {
      const envelope = JSON.parse(String(message))
      if (envelope.cmd === "ensure_scanner") {
        socket.send(JSON.stringify({
          cmd: "scanner_ready",
          data: { version: "1.0.43", installed: true },
        }))
        return
      }
      if (envelope.cmd !== "scan_req") return
      socket.send(JSON.stringify({
        cmd: "scan_complete",
        data: {
          items: [{
            "序号": 1,
            "名称": "流光咏叹",
            "槽位": 1,
            "品质": "S",
            "等级": 15,
            "最大等级": 15,
            "主属性": { "生命值": 2200 },
            "副属性": [{ "攻击力": "6%" }],
          }],
          visited: 2,
          queued: 2,
          completed: 1,
          failed: 1,
        },
      }))
    })
    setTimeout(() => socket.send(JSON.stringify({
      cmd: "hello",
      data: { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    })), 0)
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await page.getByLabel("同步删除缺失").check()
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await page.getByRole("button", { name: "继续扫描", exact: true }).click()

  await expect(page.getByText("错误代码：scan_partial_failure")).toBeVisible()
  await expect(page.getByText(/已安全导入 1 件，未删除缺失/)).toBeVisible()
  await expect(page.getByRole("button", { name: "导入已识别结果（不删除）", exact: true })).toHaveCount(0)
  await expect(page.getByRole("row", { name: /流光咏叹 流光咏叹 #1/ })).toBeVisible()
})

test("configured non-level-15 stop completes without a partial-failure card", async ({ page }) => {
  await mockLoopbackPermission(page, ["granted"])
  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    await fulfillHelperRoute(
      route,
      200,
      url.pathname === "/token"
        ? { token: "level-stop-token" }
        : { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    )
  })
  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    socket.onMessage(message => {
      const envelope = JSON.parse(String(message))
      if (envelope.cmd === "ensure_scanner") {
        socket.send(JSON.stringify({
          cmd: "scanner_ready",
          data: { version: "1.0.49", installed: true },
        }))
        return
      }
      if (envelope.cmd !== "scan_req") return
      socket.send(JSON.stringify({
        cmd: "scan_complete",
        data: {
          items: [{
            "序号": 1,
            "名称": "流光咏叹",
            "槽位": 1,
            "品质": "S",
            "等级": 15,
            "最大等级": 15,
            "主属性": { "生命值": 2200 },
            "副属性": [{ "攻击力": "6%" }],
          }],
          visited: 2,
          queued: 1,
          completed: 1,
          failed: 0,
          partial: true,
          terminationCode: "non_level_15_stop",
        },
      }))
    })
    setTimeout(() => socket.send(JSON.stringify({
      cmd: "hello",
      data: { service: "zzz-scanner-helper", version: "1.3.1", protocolVersion: 4, scanner: { installed: true } },
    })), 0)
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()
  await expect(page.getByLabel("遇到非 15 级时停止")).toBeChecked()
  await page.getByLabel("同步删除缺失").check()
  await page.getByRole("button", { name: "开始扫描", exact: true }).click()
  await page.getByRole("button", { name: "继续扫描", exact: true }).click()

  await expect(page.getByText(/检测到非 15 级驱动盘，已按设置停止并安全导入 1 件，未删除缺失/)).toBeVisible()
  await expect(page.getByText("错误代码：scan_partial_failure")).toHaveCount(0)
  await expect(page.getByText("已安全导入", { exact: true })).toBeVisible()
  await expect(page.getByRole("row", { name: /流光咏叹 流光咏叹 #1/ })).toBeVisible()
})
