export interface AppConfig {
  maintenanceEnabled: boolean
  scanTelemetryEnabled: boolean
  scanTelemetryRetentionDays: number
  driveDiscReservationsUiEnabled: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  maintenanceEnabled: false,
  scanTelemetryEnabled: false,
  scanTelemetryRetentionDays: 30,
  driveDiscReservationsUiEnabled: false,
}

async function readConfig(pathname: string): Promise<AppConfig | null> {
  try {
    const response = await fetch(pathname, { cache: "no-store" })
    if (!response.ok) {
      return null
    }
    const payload = await response.json()
    return {
      maintenanceEnabled: payload?.maintenanceEnabled === true,
      scanTelemetryEnabled: payload?.scanTelemetryEnabled === true,
      scanTelemetryRetentionDays: Math.max(1, Math.min(365, Number(payload?.scanTelemetryRetentionDays) || 30)),
      driveDiscReservationsUiEnabled: payload?.driveDiscReservationsUiEnabled === true,
    }
  } catch {
    return null
  }
}

export async function loadAppConfig(): Promise<AppConfig> {
  return await readConfig("/api/app-config")
    ?? await readConfig("/static/app-config.json")
    ?? { ...DEFAULT_CONFIG }
}
