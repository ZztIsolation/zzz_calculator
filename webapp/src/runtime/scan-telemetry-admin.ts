export type ScanTelemetryFilters = {
  from: string
  to: string
  status?: string
  client?: string
  scannerVersion?: string
  errorCode?: string
  cursor?: number
  limit?: number
}

function queryString(filters: ScanTelemetryFilters) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value))
  }
  return query.toString()
}

async function readJson(pathname: string) {
  const response = await fetch(pathname, {
    credentials: "same-origin",
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || `请求失败（${response.status}）`)
  return payload
}

export async function loadScanTelemetrySummary(filters: Pick<ScanTelemetryFilters, "from" | "to">) {
  return (await readJson(`/api/internal/scan-telemetry/summary?${queryString(filters)}`)).summary
}

export async function loadScanTelemetrySessions(filters: ScanTelemetryFilters) {
  return await readJson(`/api/internal/scan-telemetry/sessions?${queryString(filters)}`)
}

export async function loadScanTelemetrySession(sessionId: string, filters: Pick<ScanTelemetryFilters, "from" | "to">) {
  return (await readJson(`/api/internal/scan-telemetry/sessions/${encodeURIComponent(sessionId)}?${queryString(filters)}`)).session
}
