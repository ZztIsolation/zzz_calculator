export interface AppConfig {
  maintenanceEnabled: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  maintenanceEnabled: false,
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
