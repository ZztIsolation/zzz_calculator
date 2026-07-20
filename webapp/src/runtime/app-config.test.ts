import { afterEach, describe, expect, it, vi } from "vitest"
import { loadAppConfig } from "@/runtime/app-config"

function response(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("loadAppConfig", () => {
  it("prefers the Node API config", async () => {
    const fetchMock = vi.fn(async () => response({ maintenanceEnabled: true, scanTelemetryEnabled: true, scanTelemetryRetentionDays: 30 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(loadAppConfig()).resolves.toEqual({ maintenanceEnabled: true, scanTelemetryEnabled: true, scanTelemetryRetentionDays: 30 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("falls back to the static Pages config", async () => {
    const fetchMock = vi.fn(async (url: string) => (
      url === "/api/app-config"
        ? response({}, 404)
        : response({ maintenanceEnabled: true })
    ))
    vi.stubGlobal("fetch", fetchMock)
    await expect(loadAppConfig()).resolves.toEqual({ maintenanceEnabled: true, scanTelemetryEnabled: false, scanTelemetryRetentionDays: 30 })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/app-config",
      "/static/app-config.json",
    ])
  })

  it("defaults to maintenance disabled when neither source is available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline")
    }))
    await expect(loadAppConfig()).resolves.toEqual({ maintenanceEnabled: false, scanTelemetryEnabled: false, scanTelemetryRetentionDays: 30 })
  })
})
