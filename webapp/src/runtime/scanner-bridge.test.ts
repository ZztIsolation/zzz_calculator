import { describe, expect, it, vi } from "vitest"
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
})
