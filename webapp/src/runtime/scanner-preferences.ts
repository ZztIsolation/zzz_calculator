export type ScannerPreferences = {
  client: "local" | "cloud"
  maxItems: number
  stopAtNonLevel15: boolean
  runAsAdmin: boolean
}

const SCANNER_PREFERENCES_KEY = "zzz-calculator.scannerPreferences.v1"

function normalizedPreferences(input: unknown): ScannerPreferences {
  const value = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  return {
    client: value.client === "cloud" ? "cloud" : "local",
    maxItems: typeof value.maxItems === "number"
      && Number.isInteger(value.maxItems)
      && value.maxItems >= 0
      && value.maxItems <= 9999 ? value.maxItems : 0,
    stopAtNonLevel15: typeof value.stopAtNonLevel15 === "boolean" ? value.stopAtNonLevel15 : true,
    runAsAdmin: typeof value.runAsAdmin === "boolean" ? value.runAsAdmin : false,
  }
}

export function loadScannerPreferences(): ScannerPreferences {
  try {
    return normalizedPreferences(JSON.parse(localStorage.getItem(SCANNER_PREFERENCES_KEY) || "null"))
  } catch {
    return normalizedPreferences(null)
  }
}

export function saveScannerPreferences(input: unknown): boolean {
  try {
    localStorage.setItem(SCANNER_PREFERENCES_KEY, JSON.stringify(normalizedPreferences(input)))
    return true
  } catch {
    return false
  }
}
