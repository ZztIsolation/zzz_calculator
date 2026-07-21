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
  scanTelemetryBrowserContext,
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

  it("collects only coarse browser and loopback connection diagnostics", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Chrome/150.0.7871.127 Safari/537.36",
      userAgentData: { brands: [{ brand: "Google Chrome", version: "150" }] },
    })
    expect(scanTelemetryBrowserContext()).toMatchObject({
      browserName: "Google Chrome",
      browserMajor: "150",
    })
    expect(scanTelemetryDiagnostics({
      connectionStage: "websocket",
      permissionName: "loopback-network",
      permissionState: "denied",
      browserName: "Google Chrome",
      browserMajor: "150",
      secureContext: true,
      lastHeartbeatAt: 1_753_000_000_000,
      lastProgressAt: 1_753_000_001_000,
      exitCode: "0xC0000005",
      userAgent: "must-not-be-collected",
    })).toEqual({
      connectionStage: "websocket",
      permissionName: "loopback-network",
      permissionState: "denied",
      browserName: "Google Chrome",
      browserMajor: "150",
      secureContext: true,
      lastHeartbeatAt: 1_753_000_000_000,
      lastProgressAt: 1_753_000_001_000,
      exitCode: "0xC0000005",
    })
  })

  it("keeps bounded visual diagnostics without collecting pixels or OCR text", () => {
    expect(scanTelemetryDiagnostics({
      details: {
        preflightState: "accepted",
        visualTransformClass: "contrast_shifted",
        anchorScore: 82,
        gridScore: 67,
        warehouseHeaderDetected: true,
        headerScore: 91,
        gridStructureScore: 84,
        layoutScore: 79,
        inventoryCountDetected: true,
        countConsensusFrames: 2,
        hueDelta: 4,
        saturationDeltaPct: 12,
        valueDeltaPct: 18,
        visibleRois: 10,
        totalRois: 12,
        firstMissingRoi: "subStat4",
        referenceLuma: 22,
        candidateLuma: 31,
        lumaDelta: 9,
        allowedLumaDelta: 18,
        edgeDensityPermille: 0,
        minimumEdgeDensityPermille: 3,
        sampledColor: "#1f1f1f",
        ocrText: "must-not-be-collected",
      },
    })).toEqual({
      visibleRois: 10,
      totalRois: 12,
      anchorScore: 82,
      gridScore: 67,
      headerScore: 91,
      gridStructureScore: 84,
      layoutScore: 79,
      countConsensusFrames: 2,
      hueDelta: 4,
      saturationDeltaPct: 12,
      valueDeltaPct: 18,
      referenceLuma: 22,
      candidateLuma: 31,
      lumaDelta: 9,
      allowedLumaDelta: 18,
      edgeDensityPermille: 0,
      minimumEdgeDensityPermille: 3,
      warehouseHeaderDetected: true,
      inventoryCountDetected: true,
      preflightState: "accepted",
      visualTransformClass: "contrast_shifted",
      firstMissingRoi: "subStat4",
    })

    expect(scanTelemetryDiagnostics({
      details: {
        referenceLuma: 256,
        edgeDensityPermille: 1001,
        hueDelta: -1,
      },
    })).toEqual({})
  })
})
