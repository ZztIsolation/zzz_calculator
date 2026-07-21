import { expect, test } from "@playwright/test"

test("Helper 1.1.x is offered a takeover upgrade without receiving scanner commands", async ({ page }) => {
  const commands: string[] = []

  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/token") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "legacy-helper-token" }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        service: "zzz-scanner-helper",
        version: "1.1.0",
        protocolVersion: 2,
        scanner: { installed: false },
      }),
    })
  })

  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    socket.onMessage(message => {
      const envelope = JSON.parse(String(message))
      commands.push(String(envelope.cmd ?? envelope.command ?? ""))
    })
    setTimeout(() => {
      socket.send(JSON.stringify({
        cmd: "hello",
        data: {
          service: "zzz-scanner-helper",
          version: "1.1.0",
          protocolVersion: 2,
        },
      }))
    }, 0)
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  await expect(page.getByText("扫描助手版本过低")).toBeVisible()
  await expect(page.getByText("Helper 1.1.0 需要更新到 1.3.1。下载后运行安装器，它会自动接管当前旧 Helper。")).toBeVisible()
  await expect(page.getByText("错误代码：helper_outdated")).toBeVisible()
  await expect(page.getByRole("button", { name: "更新 Helper", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "手动下载", exact: true })).toBeVisible()
  await expect(page.getByText(/Unsupported scanner manifest schema/)).toHaveCount(0)

  await page.waitForTimeout(500)
  expect(commands).not.toContain("ensure_scanner")
  expect(commands).not.toContain("repair_scanner")
  expect(commands).not.toContain("get_storage_info")
  expect(commands).not.toContain("update_helper")
})

test("Helper 1.2.0 self-updates, reconnects, and resumes scanner preparation", async ({ page }) => {
  const commands: string[] = []
  let updated = false
  let updateConfirmed = false

  await page.route("http://127.0.0.1:22355/**", async route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/token") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: updated ? "updated-helper-token" : "old-helper-token" }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        service: "zzz-scanner-helper",
        version: updated ? "1.3.1" : "1.2.0",
        protocolVersion: updated ? 4 : 3,
        scanner: { installed: false },
        helperUpdate: updated && !updateConfirmed
          ? { state: "pending_confirmation", transactionId: "tx-e2e-upgrade", previousVersion: "1.2.0" }
          : null,
      }),
    })
  })

  await page.routeWebSocket("ws://127.0.0.1:22355/**", socket => {
    const helloVersion = updated ? "1.3.1" : "1.2.0"
    socket.onMessage(message => {
      const envelope = JSON.parse(String(message))
      const command = String(envelope.cmd ?? envelope.command ?? "")
      commands.push(command)
      if (command === "update_helper") {
        const requestId = String(envelope.data?.requestId ?? "")
        socket.send(JSON.stringify({
          cmd: "helper_update_progress",
          data: { requestId, stage: "download", percent: 64, message: "正在下载 Helper 1.3.1..." },
        }))
        updated = true
        socket.send(JSON.stringify({
          cmd: "helper_update_result",
          data: { requestId, restarting: true, availableVersion: "1.3.1" },
        }))
      } else if (command === "get_diagnostics") {
        socket.send(JSON.stringify({
          cmd: "helper_diagnostics",
          data: { requestId: envelope.data?.requestId, helperVersion: "1.3.1", protocolVersion: 4 },
        }))
      } else if (command === "confirm_helper_update") {
        updateConfirmed = true
        socket.send(JSON.stringify({
          cmd: "helper_update_commit_result",
          data: {
            requestId: envelope.data?.requestId,
            transactionId: envelope.data?.transactionId,
            committed: true,
            previousVersion: "1.2.0",
          },
        }))
      } else if (command === "ensure_scanner") {
        socket.send(JSON.stringify({
          cmd: "scanner_ready",
          data: { version: "1.0.38" },
        }))
      }
    })
    setTimeout(() => {
      socket.send(JSON.stringify({
        cmd: "hello",
        data: {
          service: "zzz-scanner-helper",
          version: helloVersion,
          protocolVersion: updated ? 4 : 3,
          helperUpdate: updated && !updateConfirmed
            ? { state: "pending_confirmation", transactionId: "tx-e2e-upgrade", previousVersion: "1.2.0" }
            : null,
        },
      }))
    }, 0)
  })

  await page.goto("/discs")
  await page.getByRole("button", { name: "扫描", exact: true }).click()

  await expect(page.getByRole("button", { name: "开始扫描", exact: true })).toBeVisible({ timeout: 15_000 })
  expect(commands.filter(command => command === "update_helper")).toHaveLength(1)
  expect(commands.filter(command => command === "get_diagnostics")).toHaveLength(1)
  expect(commands.filter(command => command === "confirm_helper_update")).toHaveLength(1)
  expect(commands.filter(command => command === "ensure_scanner")).toHaveLength(1)
  expect(commands.indexOf("update_helper")).toBeLessThan(commands.indexOf("ensure_scanner"))
  expect(commands.indexOf("confirm_helper_update")).toBeLessThan(commands.indexOf("ensure_scanner"))
})
