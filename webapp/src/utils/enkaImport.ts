import {
  buildEnkaImportPlan,
  buildEnkaRebindPlan,
  enkaBindingForOwner,
  enkaImportHistoryForOwner,
  enkaRebindEligibility,
} from "@core/enka-import/import-plan.js"
import { loadUserDriveDiscStore } from "@runtime/local-store.js"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
} from "@runtime/build-storage"
import {
  commitEnkaImportPlan,
  ensureEnkaImportHistoryBackfill,
  applyEnkaRebindPlan,
} from "@runtime/enka-import-transaction"

export type EnkaRequestError = Error & {
  code?: string
  retryAfter?: number
  status?: number
}

function retryAfterSeconds(response: Response, json: any): number | undefined {
  const jsonValue = Number(json?.retryAfter)
  if (Number.isFinite(jsonValue) && jsonValue > 0) return Math.ceil(jsonValue)

  const header = response.headers.get("Retry-After")?.trim()
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds)
  const retryAt = Date.parse(header)
  if (!Number.isFinite(retryAt)) return undefined
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000))
}

async function requestJson(path: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(path, { cache: "no-store", signal })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.ok === false) {
    const error = new Error(json?.error || `请求失败（HTTP ${response.status}）。`) as EnkaRequestError
    error.code = json?.code
    error.retryAfter = retryAfterSeconds(response, json)
    error.status = response.status
    throw error
  }
  return json
}

export async function importEnkaShowcase(uid: string, signal?: AbortSignal): Promise<any> {
  const result = await requestJson(`/api/enka/zzz/${encodeURIComponent(String(uid).trim())}`, signal)
  return {
    uid: result.uid,
    mappedAgents: Array.isArray(result.agents) ? result.agents : [],
    skippedAgents: Array.isArray(result.skippedAgents) ? result.skippedAgents : [],
    warnings: Array.isArray(result.warnings)
      ? result.warnings.map((warning: any) => String(warning?.message ?? warning)).filter(Boolean)
      : [],
    ttlSeconds: Math.max(0, Number(result.ttlSeconds) || 0),
    cache: result.cache ?? null,
  }
}

export async function currentEnkaBinding(): Promise<{ ownerId: string, binding: any, history: any, rebindEligibility: any }> {
  const store = await loadUserDriveDiscStore()
  const ownerId = String(store?.currentOwnerId ?? "default")
  return {
    ownerId,
    binding: enkaBindingForOwner(store, ownerId),
    history: enkaImportHistoryForOwner(store, ownerId),
    rebindEligibility: enkaRebindEligibility(store, ownerId),
  }
}

export async function backfillCurrentEnkaHistory(ownerId: string, knownAgents: any[]): Promise<any> {
  return ensureEnkaImportHistoryBackfill(ownerId, knownAgents)
}

export async function planEnkaImport(uid: string, mappedAgents: any[], driveDiscResolutions: Record<string, any> = {}): Promise<any> {
  const store = await loadUserDriveDiscStore()
  const ownerId = String(store?.currentOwnerId ?? "default")
  return buildEnkaImportPlan({
    uid,
    mappedAgents,
    store,
    ownerId,
    buildSelection: readBuildSelectionDocument(),
    legacySelection: readLegacySelectionDocument(),
    driveDiscResolutions,
    transactionId: crypto.randomUUID(),
    now: new Date(),
  })
}

export async function applyEnkaImportPlan(plan: any): Promise<any> {
  return commitEnkaImportPlan(plan)
}

export async function planEnkaRebind(
  previousUid: string,
  uid: string,
  mappedAgents: any[],
  driveDiscResolutions: Record<string, any> = {},
): Promise<any> {
  const store = await loadUserDriveDiscStore()
  const ownerId = String(store?.currentOwnerId ?? "default")
  return buildEnkaRebindPlan({
    previousUid,
    uid,
    mappedAgents,
    store,
    ownerId,
    buildSelection: readBuildSelectionDocument(),
    legacySelection: readLegacySelectionDocument(),
    driveDiscResolutions,
    transactionId: crypto.randomUUID(),
    now: new Date(),
  })
}

export async function applyPlannedEnkaRebind(plan: any): Promise<any> {
  return applyEnkaRebindPlan(plan)
}
