import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"

const { loadAppConfig } = vi.hoisted(() => ({ loadAppConfig: vi.fn() }))
vi.mock("@/runtime/app-config", () => ({ loadAppConfig }))

import { useAppConfigStore } from "@/stores/app-config"

describe("app config store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadAppConfig.mockReset()
  })

  it("loads feature flags once before feature surfaces render", async () => {
    loadAppConfig.mockResolvedValue({
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      driveDiscReservationsUiEnabled: true,
    })
    const store = useAppConfigStore()
    await Promise.all([store.load(), store.load()])
    expect(store.loaded).toBe(true)
    expect(store.driveDiscReservationsUiEnabled).toBe(true)
    expect(loadAppConfig).toHaveBeenCalledOnce()
  })

  it("fails closed when runtime configuration cannot be loaded", async () => {
    loadAppConfig.mockRejectedValue(new Error("offline"))
    const store = useAppConfigStore()

    await expect(store.load()).rejects.toThrow("offline")
    expect(store.loaded).toBe(false)
    expect(store.driveDiscReservationsUiEnabled).toBe(false)
  })
})
