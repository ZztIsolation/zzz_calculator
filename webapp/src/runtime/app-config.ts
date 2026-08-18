export interface AppConfig {
  maintenanceEnabled: boolean
  scanTelemetryEnabled: boolean
  scanTelemetryRetentionDays: number
  enkaImportEnabled: boolean
  driveDiscReservationsUiEnabled: boolean
  driveDiscExclusionsUiEnabled: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  maintenanceEnabled: false,
  scanTelemetryEnabled: false,
  scanTelemetryRetentionDays: 30,
  enkaImportEnabled: import.meta.env.DEV,
  driveDiscReservationsUiEnabled: import.meta.env.DEV,
  driveDiscExclusionsUiEnabled: import.meta.env.DEV,
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
      enkaImportEnabled: payload?.enkaImportEnabled === true,
      driveDiscReservationsUiEnabled: payload?.driveDiscReservationsUiEnabled === true,
      driveDiscExclusionsUiEnabled: payload?.driveDiscExclusionsUiEnabled === true,
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
