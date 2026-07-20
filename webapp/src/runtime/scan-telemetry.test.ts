import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/runtime/app-config", () => ({
  loadAppConfig: vi.fn(async () => ({
    maintenanceEnabled: false,
    scanTelemetryEnabled: true,
    scanTelemetryRetentionDays: 30,
  })),
}))

import {
  createScanTelemetrySession,
  finishScanTelemetryEvent,
  resetScanTelemetryClientId,
  resetScanTelemetryRuntimeForTests,
  sanitizeTelemetryMessage,
  scanTelemetryClientId,
  scanTelemetryDiagnostics,
  scanTelemetryPreferenceEnabled,
  sendScanTelemetryEvent,
  setScanTelemetryPreference,
  startedScanTelemetryEvent,
} from "@runtime/scan-telemetry"

function okResponse() {
  return { ok: true, json: async () => ({ ok: true }) } as Response
}

beforeEach(() => {
  localStorage.clear()
  resetScanTelemetryRuntimeForTests()
  vi.unstubAllGlobals()
})

describe("scan telemetry runtime", () => {
  it("defaults on and persists a resettable anonymous id", () => {
    expect(scanTelemetryPreferenceEnabled()).toBe(true)
    const first = scanTelemetryClientId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/i)
    const second = resetScanTelemetryClientId()
    expect(second).toMatch(/^[0-9a-f-]{36}$/i)
    expect(second).not.toBe(first)
  })

  it("sends only started and terminal summaries", async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal("fetch", fetchMock)
    const session = createScanTelemetrySession({
      client: "local",
      settings: { rarities: ["S"], maxItems: 30, stopAtNonLevel15: true },
      versions: { helperVersion: "1.2.1", scannerVersion: "1.0.39" },
    })
    await startedScanTelemetryEvent(session)
    await finishScanTelemetryEvent(session, "failed", {
      counters: { visited: 1 },
      failure: {
        code: "scan_failed",
        phase: "scan",
        message: "C:\\Users\\Someone\\secret.log token=abc logicalRow=1, visualRow=1, col=1/9",
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const terminal = JSON.parse(fetchMock.mock.calls[1][1]?.body as string)
    expect(terminal.eventType).toBe("failed")
    expect(terminal.failure.message).not.toContain("Someone")
    expect(terminal.failure.message).not.toContain("abc")
    expect(terminal.diagnostics).toMatchObject({ logicalRow: 1, visualRow: 1, column: 1, maxColumns: 9 })
    expect(terminal).not.toHaveProperty("driveDiscs")
  })

  it("does not send after the user turns collection off", async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal("fetch", fetchMock)
    setScanTelemetryPreference(false)
    expect(await sendScanTelemetryEvent({
      eventType: "started",
      sessionId: crypto.randomUUID(),
      client: "local",
      settings: { rarities: ["S"], maxItems: 0, stopAtNonLevel15: true },
      versions: {},
      counters: { visited: 0, queued: 0, completed: 0, failed: 0 },
    })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redacts paths and safely ignores endpoint failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    expect(sanitizeTelemetryMessage("C:\\Users\\Name\\scan.log key=secret")).toBe("[local-path] key=[redacted]")
    expect(scanTelemetryDiagnostics({ message: "logicalRow=2, visualRow=3, col=4/9" })).toMatchObject({
      logicalRow: 2,
      visualRow: 3,
      column: 4,
      maxColumns: 9,
    })
    expect(await sendScanTelemetryEvent({
      eventType: "started",
      sessionId: crypto.randomUUID(),
      client: "cloud",
      settings: { rarities: ["S"], maxItems: 0, stopAtNonLevel15: true },
      versions: {},
      counters: { visited: 0, queued: 0, completed: 0, failed: 0 },
    })).toBe(false)
  })
})
