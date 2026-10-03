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

describe("ScannerBridge preparation command isolation", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function installSockets() {
    class Socket {
      static OPEN = 1
      static sockets: Socket[] = []
      readyState = 1
      send = vi.fn()
      close = vi.fn(() => { this.readyState = 3 })
      onmessage?: (event: { data: string }) => void
      onerror?: (event: Event) => void
      onclose?: () => void
      constructor() { Socket.sockets.push(this) }
      receive(cmd: string, data = {}) {
        this.onmessage?.({ data: JSON.stringify({ cmd, data }) })
      }
      commands() { return this.send.mock.calls.map(([raw]) => JSON.parse(raw).cmd) }
    }
    vi.stubGlobal("WebSocket", Socket)
    return Socket
  }

  async function openConnection(bridge: any, Socket: ReturnType<typeof installSockets>) {
    const pending = bridge._openWebSocket("ws://localhost/helper", "helper")
    const socket = Socket.sockets.at(-1)!
    socket.receive("hello", { version: "1.3.1", protocolVersion: 4 })
    await pending
    return socket
  }

  it("serializes different commands and only merges adjacent identical requests", async () => {
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const socket = await openConnection(bridge, Socket)
    const first = bridge.ensureScanner()
    const firstAgain = bridge.ensureScanner()
    const elevated = bridge.restartScannerElevated()
    const elevatedAgain = bridge.restartScannerElevated()
    const last = bridge.ensureScanner()
    let elevatedFinished = false
    void elevated.then(() => { elevatedFinished = true })
    expect(socket.commands()).toEqual(["ensure_scanner"])

    socket.receive("scanner_ready", { version: "ordinary" })
    await expect(first).resolves.toMatchObject({ version: "ordinary" })
    await expect(firstAgain).resolves.toMatchObject({ version: "ordinary" })
    expect(elevatedFinished).toBe(false)
    expect(socket.commands()).toEqual(["ensure_scanner", "restart_scanner_elevated"])

    socket.receive("scanner_ready", { version: "elevated" })
    await expect(elevated).resolves.toMatchObject({ version: "elevated" })
    await expect(elevatedAgain).resolves.toMatchObject({ version: "elevated" })
    expect(socket.commands()).toEqual(["ensure_scanner", "restart_scanner_elevated", "ensure_scanner"])
    socket.receive("scanner_ready", { version: "last" })
    await expect(last).resolves.toMatchObject({ version: "last" })
    bridge.disconnect()
  })

  it("refuses an elevated restart on a legacy connection", async () => {
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const socket = await openConnection(bridge, Socket)
    bridge._mode = "legacy"
    await expect(bridge.restartScannerElevated()).rejects.toMatchObject({
      code: "scanner_elevation_unsupported", phase: "prepare",
    })
    expect(socket.commands()).toEqual([])
    bridge.disconnect()
  })

  it("rejects all queued preparations on a terminal failure and permits an explicit retry", async () => {
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const socket = await openConnection(bridge, Socket)
    const first = bridge.restartScannerElevated()
    const queued = bridge.ensureScanner()
    const results = Promise.allSettled([first, queued])
    socket.receive("scan_error", { code: "uac_cancelled", message: "已取消管理员授权" })
    expect((await results).map(result => result.status === "rejected" && result.reason.code))
      .toEqual(["uac_cancelled", "uac_cancelled"])
    expect(socket.commands()).toEqual(["restart_scanner_elevated"])
    const retry = bridge.restartScannerElevated()
    expect(socket.commands()).toEqual(["restart_scanner_elevated", "restart_scanner_elevated"])
    socket.receive("scanner_ready")
    await retry
    bridge.disconnect()
  })

  it("cancels active and queued operations on disconnect and ignores every old socket callback", async () => {
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const oldSocket = await openConnection(bridge, Socket)
    const oldEpoch = bridge.connectionEpoch
    const first = bridge.ensureScanner()
    const elevated = bridge.restartScannerElevated()
    const results = Promise.allSettled([first, elevated])
    const onDisconnect = vi.fn()
    bridge.onDisconnect = onDisconnect
    oldSocket.onclose?.()
    expect((await results).map(result => result.status === "rejected" && result.reason.code))
      .toEqual(["helper_disconnected", "helper_disconnected"])
    expect(bridge.connectionEpoch).toBeGreaterThan(oldEpoch)
    expect(oldSocket.commands()).toEqual(["ensure_scanner"])

    const socket = await openConnection(bridge, Socket)
    const pending = bridge.restartScannerElevated()
    const ready = vi.fn()
    bridge.onScannerReady = ready
    oldSocket.receive("scanner_ready", { version: "obsolete" })
    oldSocket.receive("scan_error", { code: "obsolete" })
    oldSocket.onerror?.(new Event("error"))
    oldSocket.onclose?.()
    expect(bridge.connected).toBe(true)
    expect(bridge.scannerVersion).not.toBe("obsolete")
    expect(ready).not.toHaveBeenCalled()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    socket.receive("scanner_ready", { version: "current" })
    await expect(pending).resolves.toMatchObject({ version: "current" })
    bridge.disconnect()
  })

  it("retires a timed-out socket before a retry can consume its late ready response", async () => {
    vi.useFakeTimers()
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const oldSocket = await openConnection(bridge, Socket)
    const epoch = bridge.connectionEpoch
    const first = bridge.ensureScanner()
    const elevated = bridge.restartScannerElevated()
    const results = Promise.allSettled([first, elevated])
    await vi.advanceTimersByTimeAsync(90_000)
    expect((await results).map(result => result.status === "rejected" && result.reason.code))
      .toEqual(["scanner_prepare_stalled", "scanner_prepare_stalled"])
    expect(oldSocket.close).toHaveBeenCalledTimes(1)
    expect(bridge.connected).toBe(false)
    expect(bridge.connectionEpoch).toBeGreaterThan(epoch)

    const socket = await openConnection(bridge, Socket)
    const pending = bridge.restartScannerElevated()
    const resolved = vi.fn()
    void pending.then(resolved)
    oldSocket.receive("scanner_ready", { version: "late" })
    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()
    expect(socket.commands()).toEqual(["restart_scanner_elevated"])
    socket.receive("scanner_ready", { version: "retry" })
    await expect(pending).resolves.toMatchObject({ version: "retry" })
    bridge.disconnect()
  })

  it("also retires the socket at the overall timeout even while progress continues", async () => {
    vi.useFakeTimers()
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const socket = await openConnection(bridge, Socket)
    const pending = bridge.ensureScanner()
    const assertion = expect(pending).rejects.toMatchObject({ code: "scanner_prepare_timeout" })
    for (let minute = 0; minute < 14; minute += 1) {
      await vi.advanceTimersByTimeAsync(60_000)
      socket.receive("launcher_progress", { stage: "download" })
    }
    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
    expect(bridge.connected).toBe(false)
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it("shares a pending connection while preserving ordinary and elevated command order", async () => {
    const Socket = installSockets()
    vi.stubGlobal("navigator", { permissions: { query: async () => ({ state: "granted" }) } })
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => String(url).endsWith("/token") ? { token: "shared" } : {},
    }))
    vi.stubGlobal("fetch", fetchMock)
    const bridge: any = new ScannerBridge()
    const first = bridge.ensureScanner()
    const elevated = bridge.restartScannerElevated()
    await vi.waitFor(() => expect(Socket.sockets).toHaveLength(1))
    const socket = Socket.sockets[0]!
    socket.receive("hello", { version: "1.3.1", protocolVersion: 4 })
    await vi.waitFor(() => expect(socket.commands()).toEqual(["ensure_scanner"]))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    socket.receive("scanner_ready")
    await first
    expect(socket.commands()).toEqual(["ensure_scanner", "restart_scanner_elevated"])
    socket.receive("scanner_ready")
    await elevated
    bridge.disconnect()
  })

  it("does not let an abandoned HTTP connection attempt replace a newer socket", async () => {
    const Socket = installSockets()
    vi.stubGlobal("navigator", { permissions: { query: async () => ({ state: "granted" }) } })
    let finishProbe!: (value: any) => void
    const fetchMock = vi.fn(() => new Promise(resolve => { finishProbe = resolve }))
    vi.stubGlobal("fetch", fetchMock)
    const bridge: any = new ScannerBridge()
    const abandoned = bridge.ensureScanner()
    const assertion = expect(abandoned).rejects.toMatchObject({ code: "helper_disconnected" })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    bridge.disconnect()
    const currentSocket = await openConnection(bridge, Socket)
    const pending = bridge.restartScannerElevated()
    finishProbe({ ok: true, json: async () => ({ scanner: { installed: true } }) })
    await assertion
    expect(Socket.sockets).toHaveLength(1)
    expect(bridge._ws).toBe(currentSocket)
    expect(currentSocket.commands()).toEqual(["restart_scanner_elevated"])
    currentSocket.receive("scanner_ready")
    await pending
    bridge.disconnect()
  })

  it("rejects an abandoned handshake immediately and ignores its late hello", async () => {
    const Socket = installSockets()
    const bridge: any = new ScannerBridge()
    const handshake = bridge._openWebSocket("ws://localhost/old", "helper")
    const assertion = expect(handshake).rejects.toMatchObject({ code: "helper_disconnected" })
    const oldSocket = Socket.sockets[0]!
    bridge.disconnect()
    await assertion
    const socket = await openConnection(bridge, Socket)
    oldSocket.receive("hello", { version: "obsolete", protocolVersion: 1 })
    oldSocket.onclose?.()
    expect(bridge._ws).toBe(socket)
    expect(bridge.helperVersion).toBe("1.3.1")
    expect(bridge.protocolVersion).toBe(4)
    bridge.disconnect()
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
