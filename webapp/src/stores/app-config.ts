import { defineStore } from "pinia"
import { loadAppConfig, type AppConfig } from "@/runtime/app-config"

const DEFAULT_CONFIG: AppConfig = {
  maintenanceEnabled: false,
  scanTelemetryEnabled: false,
  scanTelemetryRetentionDays: 30,
  driveDiscReservationsUiEnabled: false,
}

let configPromise: ReturnType<typeof loadAppConfig> | null = null

export const useAppConfigStore = defineStore("app-config", {
  state: () => ({
    loaded: false,
    config: { ...DEFAULT_CONFIG },
  }),
  getters: {
    driveDiscReservationsUiEnabled: state => state.config.driveDiscReservationsUiEnabled,
  },
  actions: {
    async load() {
      if (this.loaded) return this.config
      configPromise ??= loadAppConfig()
      try {
        this.config = await configPromise
        this.loaded = true
        return this.config
      } finally {
        configPromise = null
      }
    },
  },
})
