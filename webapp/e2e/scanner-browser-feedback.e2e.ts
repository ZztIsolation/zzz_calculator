import { expect, test, type Page } from "@playwright/test"

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1366", "Loopback protocol simulations run once; layout has separate multi-viewport coverage.")
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
