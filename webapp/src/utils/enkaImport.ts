import { buildEnkaImportPlan, enkaBindingForOwner } from "@core/enka-import/import-plan.js"
import { loadUserDriveDiscStore } from "@runtime/local-store.js"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
} from "@runtime/build-storage"
import { commitEnkaImportPlan } from "@runtime/enka-import-transaction"

async function requestJson(path: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(path, { cache: "no-store", signal })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.ok === false) {
    const error = new Error(json?.error || `请求失败（HTTP ${response.status}）。`) as Error & { code?: string, retryAfter?: number }
    error.code = json?.code
    error.retryAfter = Number(json?.retryAfter) || undefined
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

export async function currentEnkaBinding(): Promise<{ ownerId: string, binding: any }> {
  const store = await loadUserDriveDiscStore()
  const ownerId = String(store?.currentOwnerId ?? "default")
  return { ownerId, binding: enkaBindingForOwner(store, ownerId) }
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
