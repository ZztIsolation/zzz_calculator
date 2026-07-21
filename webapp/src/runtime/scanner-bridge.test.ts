import { afterEach, describe, expect, it, vi } from "vitest"
import { ScannerBridge } from "@runtime/scanner-bridge.js"

describe("ScannerBridge protocol v3 requests", () => {
  function connectedBridge() {
    const bridge: any = new ScannerBridge()
    const send = vi.fn()
    bridge._mode = "helper"
    bridge._helloData = { version: "1.2.0", protocolVersion: 3 }
    bridge._ws = { readyState: WebSocket.OPEN, send, close: vi.fn() }
    return { bridge, send }
  }

  it("correlates storage responses without replacing scanner callbacks", async () => {
    const { bridge, send } = connectedBridge()
    const onProgress = vi.fn()
    bridge.onProgress = onProgress

    const pending = bridge.getStorageInfo()
    const request = JSON.parse(send.mock.calls[0][0])
    expect(request.cmd).toBe("get_storage_info")
    bridge._handleMessage({
      cmd: "storage_info",
      data: { requestId: request.data.requestId, storage: { totalBytes: 123 } },
    })

    await expect(pending).resolves.toMatchObject({ storage: { totalBytes: 123 } })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it("reports update progress before resolving the final update response", async () => {
    const { bridge, send } = connectedBridge()
    const onUpdate = vi.fn()
    bridge.onHelperUpdateProgress = onUpdate

    const pending = bridge.updateHelper()
    const request = JSON.parse(send.mock.calls[0][0])
    bridge._handleMessage({
      cmd: "helper_update_progress",
      data: { requestId: request.data.requestId, percent: 50 },
    })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ percent: 50 }))
    bridge._handleMessage({
      cmd: "helper_update_result",
      data: { requestId: request.data.requestId, updateAvailable: false },
    })
    await expect(pending).resolves.toMatchObject({ updateAvailable: false })
  })

  it("rejects Helper update failures immediately by request id", async () => {
    const { bridge, send } = connectedBridge()
    const pending = bridge.updateHelper()
    const request = JSON.parse(send.mock.calls[0][0])

    bridge._handleMessage({
      cmd: "helper_update_error",
      data: {
        requestId: request.data.requestId,
        code: "helper_update_failed",
        phase: "helper",
        message: "更新包校验失败。",
      },
    })

    await expect(pending).rejects.toMatchObject({ code: "helper_update_failed", phase: "helper" })
  })

  it("checks the release manifest even when an older Scanner is already installed", async () => {
    const { bridge, send } = connectedBridge()
    bridge._scannerReady = true

    const pending = bridge.ensureScanner()
    expect(JSON.parse(send.mock.calls[0][0])).toMatchObject({ cmd: "ensure_scanner" })

    bridge._handleMessage({ cmd: "scanner_ready", data: { version: "1.0.43" } })
    await expect(pending).resolves.toMatchObject({ version: "1.0.43" })
  })

  it("verifies diagnostics before confirming a protocol-v4 Helper update transaction", async () => {
    const { bridge, send } = connectedBridge()
    bridge._helloData = {
      version: "1.3.1",
      protocolVersion: 4,
      helperUpdate: {
        state: "pending_confirmation",
        transactionId: "tx-confirm-1",
        previousVersion: "1.2.1",
      },
    }
    expect(bridge.helperUpdate).toMatchObject({ transactionId: "tx-confirm-1" })

    const diagnosticsPending = bridge.getDiagnostics()
    const diagnosticsRequest = JSON.parse(send.mock.calls[0][0])
    expect(diagnosticsRequest.cmd).toBe("get_diagnostics")
    bridge._handleMessage({
      cmd: "helper_diagnostics",
      data: {
        requestId: diagnosticsRequest.data.requestId,
        helperVersion: "1.3.1",
        protocolVersion: 4,
      },
    })
    await expect(diagnosticsPending).resolves.toMatchObject({ helperVersion: "1.3.1" })

    const confirmPending = bridge.confirmHelperUpdate("tx-confirm-1")
    const confirmRequest = JSON.parse(send.mock.calls[1][0])
    expect(confirmRequest).toMatchObject({
      cmd: "confirm_helper_update",
      data: { transactionId: "tx-confirm-1" },
    })
    bridge._handleMessage({
      cmd: "helper_update_commit_result",
      data: {
        requestId: confirmRequest.data.requestId,
        transactionId: "tx-confirm-1",
        committed: true,
      },
    })
    await expect(confirmPending).resolves.toMatchObject({ committed: true, transactionId: "tx-confirm-1" })
  })
})

describe("ScannerBridge terminal watchdogs", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function connectedBridge(protocolVersion = 4) {
    const bridge: any = new ScannerBridge()
    bridge._mode = "helper"
    bridge._helloData = { version: "1.3.1", protocolVersion }
    bridge._ws = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() }
    return bridge
  }

  it("turns a stalled Scanner preparation into a structured error after 90 seconds", async () => {
    vi.useFakeTimers()
    const bridge = connectedBridge()
    const pending = bridge.ensureScanner()
    const assertion = expect(pending).rejects.toMatchObject({ code: "scanner_prepare_stalled", phase: "prepare" })

    await vi.advanceTimersByTimeAsync(90_000)
    await assertion
  })

  it("reports a visible-page heartbeat loss after 30 seconds", async () => {
    vi.useFakeTimers()
    const bridge = connectedBridge()
    const onError = vi.fn()
    bridge.onError = onError

    bridge.startScan()
    await vi.advanceTimersByTimeAsync(31_000)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "scanner_heartbeat_lost" }))
    expect(bridge.scanning).toBe(false)
  })

  it("waits for a stop terminal event and reports timeout after 15 seconds", async () => {
    vi.useFakeTimers()
    const bridge = connectedBridge(3)
    const onError = vi.fn()
    bridge.onError = onError

    bridge.startScan()
    bridge.stopScan()
    await vi.advanceTimersByTimeAsync(15_000)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "scan_stop_timeout" }))
  })

  it("clears the stop watchdog when Helper reports that Scanner exited", async () => {
    vi.useFakeTimers()
    const bridge = connectedBridge()
    const onError = vi.fn()
    bridge.onError = onError

    bridge.startScan()
    bridge.stopScan()
    bridge._handleMessage({
      cmd: "scan_error",
      data: {
        code: "scanner_process_exited",
        phase: "scan",
        message: "Scanner exited with code 0xC0000005.",
      },
    })
    await vi.advanceTimersByTimeAsync(15_000)

    expect(bridge.scanning).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "scanner_process_exited" }))
  })

  it("buffers streamed items and completes without a repeated items array", () => {
    const bridge = connectedBridge()
    const onComplete = vi.fn()
    bridge.onComplete = onComplete

    bridge.startScan({ rarities: ["S"] })
    const request = JSON.parse(bridge._ws.send.mock.calls[0][0])
    expect(request.data.resultDelivery).toBe("stream-items-v1")
    bridge._handleMessage({ cmd: "scan_item", data: { 序号: 2, 名称: "第二张" } })
    bridge._handleMessage({ cmd: "scan_item", data: { 序号: 1, 名称: "第一张" } })
    bridge._handleMessage({ cmd: "scan_item", data: { 序号: 2, 名称: "第二张-更新" } })
    bridge._handleMessage({
      cmd: "scan_complete",
      data: { resultDelivery: "stream-items-v1", itemCount: 2, completed: 2, failed: 0 },
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toMatchObject({ streamIncomplete: false, scanRunId: 1 })
    expect(onComplete.mock.calls[0][0].items.map((item: any) => item.名称)).toEqual(["第一张", "第二张-更新"])
  })

  it("marks missing streamed items partial and retains items on transport failure", () => {
    const bridge = connectedBridge()
    const onComplete = vi.fn()
    const onError = vi.fn()
    bridge.onComplete = onComplete
    bridge.onError = onError

    bridge.startScan()
    bridge._handleMessage({ cmd: "scan_item", data: { 序号: 1, 名称: "已完成" } })
    bridge._handleMessage({
      cmd: "scan_complete",
      data: { resultDelivery: "stream-items-v1", itemCount: 2, completed: 2 },
    })
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ streamIncomplete: true }))

    bridge._handleMessage({ cmd: "scan_error", data: { code: "scanner_transport_failed" } })
    expect(onError).not.toHaveBeenCalled()

    bridge.startScan()
    bridge._handleMessage({ cmd: "scan_item", data: { 序号: 9, 名称: "崩溃前结果" } })
    bridge._handleMessage({ cmd: "scan_error", data: { code: "scanner_transport_failed" } })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].retainedItems).toEqual([{ 序号: 9, 名称: "崩溃前结果" }])
  })
})

describe("ScannerBridge browser connection diagnostics", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function permissionSequence(...states: string[]) {
    const query = vi.fn(async () => ({ state: states.shift() ?? "granted" }))
    vi.stubGlobal("navigator", { permissions: { query } })
    return query
  }

  function helperResponses(tokenResponse: any = { ok: true, json: async () => ({ token: "token-1" }) }) {
    return vi.fn(async (url: string) => String(url).endsWith("/token")
      ? tokenResponse
      : { ok: true, status: 200, json: async () => ({ scanner: { installed: true } }) })
  }

  it("reports an already denied loopback permission before contacting Helper", async () => {
    permissionSequence("denied")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(new ScannerBridge().connect()).rejects.toMatchObject({
      code: "loopback_permission_denied",
      phase: "connect",
      stage: "permission",
      permissionName: "loopback-network",
      permissionState: "denied",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("detects permission denial that occurs during the first Helper request", async () => {
    const query = permissionSequence("prompt", "denied")
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))

    await expect(new ScannerBridge().connect()).rejects.toMatchObject({
      code: "loopback_permission_denied",
      stage: "probe",
      permissionState: "denied",
    })
    expect(query).toHaveBeenCalledTimes(2)
  })

  it("reports a rejected page origin without falling back to legacy WebSocket", async () => {
    permissionSequence("granted")
    vi.stubGlobal("fetch", helperResponses({ ok: false, status: 403, json: async () => ({}) }))
    const socket = Object.assign(vi.fn(), { OPEN: 1 })
    vi.stubGlobal("WebSocket", socket)

    await expect(new ScannerBridge().connect()).rejects.toMatchObject({
      code: "helper_origin_rejected",
      stage: "token",
    })
    expect(socket).not.toHaveBeenCalled()
  })

  it("distinguishes a WebSocket handshake failure after Helper HTTP succeeds", async () => {
    permissionSequence("granted", "granted")
    vi.stubGlobal("fetch", helperResponses())
    class BlockedSocket {
      static OPEN = 1
      readyState = 0
      close() {}
      constructor() {
        queueMicrotask(() => {
          ;(this as any).onerror?.(new Event("error"))
          ;(this as any).onclose?.(new CloseEvent("close"))
        })
      }
    }
    vi.stubGlobal("WebSocket", BlockedSocket)
    const bridge = new ScannerBridge()
    const onDisconnect = vi.fn()
    bridge.onDisconnect = onDisconnect

    await expect(bridge.connect()).rejects.toMatchObject({
      code: "helper_websocket_blocked",
      stage: "websocket",
      permissionState: "unknown",
    })
    expect(onDisconnect).not.toHaveBeenCalled()
  })
})
