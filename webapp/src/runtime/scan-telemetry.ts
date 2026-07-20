import { loadAppConfig } from "@/runtime/app-config"

const ENABLED_KEY = "zzz-calculator.scanTelemetry.enabled.v1"
const CLIENT_ID_KEY = "zzz-calculator.scanTelemetry.clientId.v1"
const REQUEST_TIMEOUT_MS = 2_000

export type ScanTelemetryEventType = "started" | "completed" | "failed" | "cancelled" | "import_failed"

export type ScanTelemetryEvent = {
  schemaVersion: 1
  eventType: ScanTelemetryEventType
  clientId: string
  sessionId: string
  client: "local" | "cloud"
  settings: {
    rarities: string[]
    maxItems: number
    stopAtNonLevel15: boolean
  }
  versions: Record<string, string | number>
  durationMs?: number
  counters: {
    visited: number
    queued: number
    completed: number
    failed: number
  }
  failure?: Record<string, string>
  diagnostics?: Record<string, string | number | boolean>
}

export type ActiveScanTelemetrySession = {
  sessionId: string
  startedAt: number
  client: "local" | "cloud"
  settings: ScanTelemetryEvent["settings"]
  versions: ScanTelemetryEvent["versions"]
}

let runtimeConfigPromise: ReturnType<typeof loadAppConfig> | null = null

function storage() {
  return typeof localStorage === "undefined" ? null : localStorage
}

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, character => (
    Number(character) ^ (Math.random() * 16 >> Number(character) / 4)
  ).toString(16))
}

export function scanTelemetryPreferenceEnabled() {
  return storage()?.getItem(ENABLED_KEY) !== "false"
}

export function setScanTelemetryPreference(enabled: boolean) {
  storage()?.setItem(ENABLED_KEY, enabled ? "true" : "false")
}

export function resetScanTelemetryClientId() {
  storage()?.removeItem(CLIENT_ID_KEY)
  return scanTelemetryClientId()
}

export function scanTelemetryClientId() {
  const current = storage()?.getItem(CLIENT_ID_KEY)
  if (current) return current
  const next = uuid()
  storage()?.setItem(CLIENT_ID_KEY, next)
  return next
}

export function sanitizeTelemetryMessage(value: unknown) {
  return String(value ?? "")
    .replace(/[A-Za-z]:\\[^\s,;]+/g, "[local-path]")
    .replace(/\\\\[^\s,;]+/g, "[network-path]")
    .replace(/(token|signature|sig|key)=[^&\s]+/gi, "$1=[redacted]")
    .slice(0, 500)
}

function finiteCounter(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0
}

function safeString(value: unknown, maxLength = 100) {
  return String(value ?? "").trim().slice(0, maxLength)
}

export function scanTelemetryCounters(value: any = {}) {
  return {
    visited: finiteCounter(value?.visited),
    queued: finiteCounter(value?.queued),
    completed: finiteCounter(value?.completed),
    failed: finiteCounter(value?.failed),
  }
}

export function scanTelemetryVersions(value: any = {}) {
  const scanner = value?.scanner && typeof value.scanner === "object" ? value.scanner : {}
  const result: Record<string, string | number> = {}
  const fields = {
    helperVersion: value?.helperVersion,
    helperProtocolVersion: value?.helperProtocolVersion,
    scannerVersion: value?.scannerVersion ?? scanner?.version ?? scanner?.appVersion,
    scannerFileVersion: value?.scannerFileVersion ?? scanner?.fileVersion,
    scannerPackageId: value?.scannerPackageId ?? scanner?.packageId,
    scannerPackageMode: value?.scannerPackageMode ?? scanner?.packageMode,
  }
  for (const [key, raw] of Object.entries(fields)) {
    if (typeof raw === "number" && Number.isFinite(raw)) result[key] = raw
    else if (raw !== undefined && raw !== null && String(raw).trim()) result[key] = safeString(raw, 64)
  }
  return result
}

const DIAGNOSTIC_NUMBER_FIELDS = [
  "logicalRow", "visualRow", "column", "maxColumns", "visibleRois", "totalRois", "stableFrames",
  "requiredStableFrames", "attempts", "frameCount", "clientWidth", "clientHeight", "dpi",
  "anchorScore", "gridScore", "hueDelta", "saturationDeltaPct", "valueDeltaPct",
] as const
const DIAGNOSTIC_BOOLEAN_FIELDS = ["sawPanelChange", "selectionChanged", "inventoryCountDetected"] as const
const DIAGNOSTIC_STRING_FIELDS = [
  "acceptGateReason", "captureMode", "visualProfileId", "preflightState", "visualTransformClass",
] as const

export function scanTelemetryDiagnostics(value: any = {}) {
  const source = value?.diagnostics ?? value?.details ?? value ?? {}
  const result: Record<string, string | number | boolean> = {}
  for (const key of DIAGNOSTIC_NUMBER_FIELDS) {
    const number = Number(source?.[key])
    if (Number.isFinite(number) && number >= 0) result[key] = Math.round(number)
  }
  for (const key of DIAGNOSTIC_BOOLEAN_FIELDS) {
    if (typeof source?.[key] === "boolean") result[key] = source[key]
  }
  for (const key of DIAGNOSTIC_STRING_FIELDS) {
    if (source?.[key]) result[key] = safeString(source[key], 100)
  }

  const message = String(value?.message ?? "")
  const coordinateFields: Array<[string, RegExp]> = [
    ["logicalRow", /logicalRow=(\d+)/i],
    ["visualRow", /visualRow=(\d+)/i],
    ["column", /col=(\d+)\/(\d+)/i],
    ["maxColumns", /col=\d+\/(\d+)/i],
  ]
  for (const [key, pattern] of coordinateFields) {
    if (result[key] !== undefined) continue
    const match = message.match(pattern)
    if (match) result[key] = Number(match[1])
  }
  return result
}

export function scanTelemetryFailure(value: any = {}) {
  const result: Record<string, string> = {}
  const code = safeString(value?.code || "scan_failed", 80)
  if (code) result.code = code
  const phase = safeString(value?.phase || "scan", 32)
  if (phase) result.phase = phase
  const message = sanitizeTelemetryMessage(value?.message)
  if (message) result.message = message
  const diagnosticId = safeString(value?.diagnosticId, 80)
  if (diagnosticId) result.diagnosticId = diagnosticId
  return result
}

async function runtimeEnabled() {
  runtimeConfigPromise ??= loadAppConfig()
  const config = await runtimeConfigPromise
  return config.scanTelemetryEnabled && scanTelemetryPreferenceEnabled()
}

export async function sendScanTelemetryEvent(event: Omit<ScanTelemetryEvent, "schemaVersion" | "clientId">) {
  if (!scanTelemetryPreferenceEnabled() || !await runtimeEnabled()) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch("/api/scan-telemetry/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      signal: controller.signal,
      body: JSON.stringify({
        schemaVersion: 1,
        clientId: scanTelemetryClientId(),
        ...event,
      }),
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function createScanTelemetrySession(input: {
  client: "local" | "cloud"
  settings: ScanTelemetryEvent["settings"]
  versions?: ScanTelemetryEvent["versions"]
}) {
  return {
    sessionId: uuid(),
    startedAt: Date.now(),
    client: input.client,
    settings: input.settings,
    versions: input.versions ?? {},
  } satisfies ActiveScanTelemetrySession
}

export function startedScanTelemetryEvent(session: ActiveScanTelemetrySession) {
  return sendScanTelemetryEvent({
    eventType: "started",
    sessionId: session.sessionId,
    client: session.client,
    settings: session.settings,
    versions: session.versions,
    counters: scanTelemetryCounters(),
  })
}

export function finishScanTelemetryEvent(
  session: ActiveScanTelemetrySession | null,
  eventType: Exclude<ScanTelemetryEventType, "started">,
  input: { counters?: any; failure?: any; diagnostics?: any; versions?: any } = {},
) {
  if (!session) return Promise.resolve(false)
  return sendScanTelemetryEvent({
    eventType,
    sessionId: session.sessionId,
    client: session.client,
    settings: session.settings,
    versions: { ...session.versions, ...scanTelemetryVersions(input.versions) },
    durationMs: Math.max(0, Date.now() - session.startedAt),
    counters: scanTelemetryCounters(input.counters),
    failure: input.failure ? scanTelemetryFailure(input.failure) : undefined,
    diagnostics: scanTelemetryDiagnostics(input.diagnostics ?? input.failure),
  })
}

export function resetScanTelemetryRuntimeForTests() {
  runtimeConfigPromise = null
}
