import { defineStore } from "pinia"
import { toRaw } from "vue"
import { driveDiscContentFingerprint, driveDiscOptimizationInventoryFingerprint } from "@core/inventory-model.js"
import { toCalculatorDriveDisc } from "@core/drive-disc-core.js"
import { readSafeJson } from "@runtime/storage-guard.js"

type OptimizerStatus = "idle" | "estimating" | "preparing" | "running" | "cancelling" | "cancelled" | "done" | "error"

const SETTINGS_KEY = "zzz-calculator.webapp.optimizer.v1"
const SETTINGS_VERSION = 4
const SUPPORTED_SETTINGS_VERSIONS = new Set([2, 3, 4])
const FALLBACK_AGENT_SETTINGS_ID = "__default__"
const OPTIMIZER_WORKER_STALL_TIMEOUT_MS = 45_000
const MINIMUM_STAT_KEYS = ["atk", "def", "anomalyProficiency", "critRate", "critDmg", "lacerationDmg"] as const
const MINIMUM_DEFAULTS_VERSION = 2
const TWO_PIECE_DEFAULTS_VERSION = 1
const FOUR_PIECE_BUFF_DEFAULTS_VERSION = 1
const PREFERRED_FOUR_PIECE_BUFF_DEFAULTS_VERSION = 1
const CALCULATION_INPUT_FINGERPRINT_EXCLUDED_KEYS = new Set([
  "label",
  "settings",
  "ownerId",
  "driveDiscs",
])
const LEGACY_MINIMUM_DEFAULTS: Partial<Record<typeof MINIMUM_STAT_KEYS[number], number>> = {
  atk: 2500,
  anomalyProficiency: 250,
  critRate: 80,
  critDmg: 160,
}

let activeWorker: Worker | null = null
let activeRunId = ""
let activeRunResolve: (() => void) | null = null
let activeWatchdogTimer: ReturnType<typeof setInterval> | null = null
let lastWorkerMessageAt = 0
let activeWorkerCatalog: any = null
let activeWorkerCatalogFingerprint = ""

function clearActiveRun() {
  if (activeWatchdogTimer) {
    clearInterval(activeWatchdogTimer)
    activeWatchdogTimer = null
  }
  activeRunId = ""
  activeRunResolve = null
  lastWorkerMessageAt = 0
}

function disposeWorker() {
  const resolve = activeRunResolve
  clearActiveRun()
  activeWorker?.terminate()
  activeWorker = null
  activeWorkerCatalog = null
  activeWorkerCatalogFingerprint = ""
  resolve?.()
}

function reusableWorker() {
  if (!activeWorker) {
    activeWorker = new Worker(new URL("../workers/optimizer.worker.ts", import.meta.url), { type: "module" })
    activeWorkerCatalog = null
  }
  return activeWorker
}

function catalogForWorker(catalog: any) {
  const rawCatalog = toRaw(catalog)
  const fingerprint = JSON.stringify(rawCatalog, (_key, value) => value instanceof Map
    ? { mapEntries: [...value] } : value instanceof Set ? { setValues: [...value] } : value)
  if (rawCatalog === activeWorkerCatalog && fingerprint === activeWorkerCatalogFingerprint) {
    return undefined
  }
  activeWorkerCatalog = rawCatalog
  activeWorkerCatalogFingerprint = fingerprint
  return cloneWorkerPayload(catalog)
}

function runId() {
  return `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readSettings() {
  return readSafeJson(SETTINGS_KEY, null)
}

// 上次优化结果：按“账号 + 角色”保存方案里的驱动盘快照，刷新或切回角色后可直接查看。
// 只保留最近几组，避免占满本地存储；读取失败时当作没有保存，不影响优化设置。
const RESULTS_KEY = "zzz-calculator.webapp.optimizer-results.v1"
const RESULTS_VERSION = 1
const MAX_SAVED_RESULT_SETS = 6

function savedResultsKey(ownerId: string, agentId: string) {
  return `${ownerId}::${agentId}`
}

function readSavedResults(): Record<string, any> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    const value = raw ? JSON.parse(raw) : null
    return value?.version === RESULTS_VERSION && value.entries && typeof value.entries === "object" ? value.entries : {}
  } catch {
    return {}
  }
}

function writeSavedResults(entries: Record<string, any>) {
  const kept = Object.entries(entries)
    .sort(([, left], [, right]) => String(right?.savedAt ?? "").localeCompare(String(left?.savedAt ?? "")))
    .slice(0, MAX_SAVED_RESULT_SETS)
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify({ version: RESULTS_VERSION, entries: Object.fromEntries(kept) }))
  } catch {
    // 存储已满或不可用时放弃保存上次结果，本次结果仍在内存中可用
  }
}

function discContent(disc: any) {
  return driveDiscContentFingerprint(toCalculatorDriveDisc(disc))
}

function writeSettings(value: any) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
}

function plainObject(value: any = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return JSON.parse(JSON.stringify(value))
}

function settingsEnvelope(value: any = null) {
  return SUPPORTED_SETTINGS_VERSIONS.has(Number(value?.version))
    && value?.byAgent
    && typeof value.byAgent === "object"
    && !Array.isArray(value.byAgent)
    ? value
    : null
}

function agentSettingsId(agent: any = null, saved: any = null, fallback = "") {
  return String(agent?.id ?? settingsEnvelope(saved)?.currentAgentId ?? fallback ?? "").trim() || FALLBACK_AGENT_SETTINGS_ID
}

function defaultMainStatLimits(): Record<string, string[]> {
  return {
    "4": [],
    "5": [],
    "6": [],
  }
}

function defaultMinimums(): Record<string, number | null> {
  return {}
}

function normalizeArray(value: any) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function normalizeBrowserOptimizerAlgorithm(value: any) {
  const algorithm = String(value || "exact-super-bound")
  return algorithm === "exact-super-bound-parallel" ? "exact-super-bound" : algorithm
}

function normalizeFourPieceBuffMode(value: any): "auto" | "manual" {
  return String(value ?? "manual").trim() === "auto" ? "auto" : "manual"
}

function cleanMinimums(value: any = {}) {
  return Object.fromEntries(
    MINIMUM_STAT_KEYS
      .filter(key => Object.prototype.hasOwnProperty.call(value ?? {}, key))
      .map(key => [key, value?.[key]] as const)
      .map(([key, raw]) => [key, raw === "" || raw === null || raw === undefined ? null : Number(raw)])
      .filter(([, raw]) => raw === null || Number.isFinite(raw as number)),
  )
}

function normalizeMinimums(value: any = {}, removeLegacyDefaults = false) {
  const minimums = cleanMinimums(value)
  if (removeLegacyDefaults) {
    for (const key of MINIMUM_STAT_KEYS) {
      if (LEGACY_MINIMUM_DEFAULTS[key] !== undefined && minimums[key] === LEGACY_MINIMUM_DEFAULTS[key]) {
        delete minimums[key]
      }
    }
  }
  return minimums
}

function cleanMainStatLimits(value: any = {}) {
  return {
    ...defaultMainStatLimits(),
    ...Object.fromEntries(Object.entries(value ?? {}).map(([slot, values]) => [String(slot), normalizeArray(values)])),
  }
}

function canonicalValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(canonicalValue)
  }
  if (!value || typeof value !== "object") {
    return value
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalValue(value[key])]),
  )
}

function normalizedSetIds(value: any, fallback: any = "") {
  const values = normalizeArray(value)
  if (!values.length && fallback) {
    values.push(String(fallback))
  }
  return [...new Set(values)].sort()
}

function optimizerSettingsFingerprint(settings: any = {}) {
  const mainStatLimits = cleanMainStatLimits(settings.explicitMainStatLimits ?? settings.mainStatLimits)
  return JSON.stringify(canonicalValue({
    algorithm: normalizeBrowserOptimizerAlgorithm(settings.algorithm),
    fourPieceSetIds: normalizedSetIds(settings.fourPieceSetIds, settings.fourPieceSetId),
    twoPieceSetIds: normalizedSetIds(settings.twoPieceSetIds, settings.twoPieceSetId),
    fourPieceBuffMode: normalizeFourPieceBuffMode(settings.fourPieceBuffMode),
    fourPieceBuffRuntimeInputs: plainObject(settings.fourPieceBuffRuntimeInputs),
    mainStatLimits: Object.fromEntries(Object.entries(mainStatLimits)
      .map(([slot, values]) => [slot, [...new Set(normalizeArray(values))].sort()])),
    minimums: cleanMinimums(settings.minimums),
  }))
}

function optimizerCalculationInputFingerprint(input: any = {}) {
  const rawInput = toRaw(input)
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return JSON.stringify({})
  }
  const calculationInput = Object.fromEntries(
    Object.entries(rawInput)
      .filter(([key]) => !CALCULATION_INPUT_FINGERPRINT_EXCLUDED_KEYS.has(key)),
  )
  return JSON.stringify(canonicalValue(calculationInput))
}

function settingsFromState(state: any) {
  return {
    objective: "damage",
    algorithm: state.algorithm,
    fourPieceSetIds: state.fourPieceSetIds,
    fourPieceSetId: state.fourPieceSetIds[0] ?? "",
    twoPieceSetIds: state.twoPieceSetIds,
    fourPieceBuffMode: state.fourPieceBuffMode,
    fourPieceBuffRuntimeInputs: state.fourPieceBuffRuntimeInputs,
    mainStatLimits: state.mainStatLimits,
    minimums: cleanMinimums(state.minimums),
    enableUpperBoundPruning: true,
  }
}

function optimizerDriveDiscSets(catalog: any = null) {
  return catalog?.displayDriveDiscSets ?? catalog?.driveDiscSets ?? []
}

function preferredDriveDiscDefaultSetIds(agent: any = null, catalog: any = null) {
  const legacy = agent?.preferredDriveDiscs?.defaultSetId
    ?? agent?.preferredDriveDiscs?.defaultSet
    ?? agent?.defaultDriveDiscSetId
    ?? ""
  const raw = agent?.preferredDriveDiscs?.defaultSetIds ?? (legacy ? [legacy] : [])
  const setIds = [...new Set(normalizeArray(Array.isArray(raw) ? raw : [raw]))]
  if (!catalog) return setIds
  const validIds = new Set(optimizerDriveDiscSets(catalog).map((set: any) => String(set?.id ?? "")).filter(Boolean))
  return setIds.filter(setId => validIds.has(setId))
}

function preferredFourPieceBuffRuntimeInputs(agent: any = null, catalog: any = null) {
  const preferred = agent?.preferredDriveDiscs?.defaultFourPieceBuffRuntimeInputs
  if (!preferred || typeof preferred !== "object" || Array.isArray(preferred)) return {}
  const visibleSetIds = new Set(optimizerDriveDiscSets(catalog)
    .map((set: any) => String(set?.id ?? "").trim())
    .filter(Boolean))
  return Object.fromEntries(Object.entries(preferred).filter(([id, runtime]) => {
    const match = String(id).match(/^driveDisc4pc:(.+)\.(self|team)$/)
    return Boolean(match)
      && (!catalog || visibleSetIds.has(String(match?.[1] ?? "")))
      && runtime && typeof runtime === "object" && !Array.isArray(runtime)
  }).map(([id, runtime]) => [id, plainObject(runtime)]))
}

function mergeFourPieceBuffRuntimeInputs(defaults: any = {}, saved: any = {}) {
  const merged = plainObject(defaults)
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return merged
  for (const [id, rawRuntime] of Object.entries(saved)) {
    const runtime: any = rawRuntime
    if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
      merged[id] = runtime
      continue
    }
    const current: any = merged[id] && typeof merged[id] === "object" && !Array.isArray(merged[id]) ? merged[id] : {}
    const effects = runtime.effects && typeof runtime.effects === "object" && !Array.isArray(runtime.effects)
      ? Object.fromEntries(Object.entries(runtime.effects).map(([effectId, effectRuntime]) => {
          const base = current.effects?.[effectId]
          return [effectId, effectRuntime && typeof effectRuntime === "object" && !Array.isArray(effectRuntime)
            ? { ...(base ?? {}), ...effectRuntime }
            : effectRuntime]
        }))
      : runtime.effects
    merged[id] = { ...current, ...runtime, ...(effects !== undefined ? { effects: { ...(current.effects ?? {}), ...effects } } : {}) }
  }
  return merged
}

function firstDriveDiscSetId(catalog: any = null) {
  return String(optimizerDriveDiscSets(catalog)[0]?.id ?? "").trim()
}

function normalizeOptimizerSettings(value: any = {}, catalog: any = null, agent: any = null) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const visibleSetIds = new Set(
    optimizerDriveDiscSets(catalog)
      .map((set: any) => String(set?.id ?? "").trim())
      .filter(Boolean),
  )
  const preferredFourPieceSetIds = preferredDriveDiscDefaultSetIds(agent, catalog)
  const legacySavedSetId = String(saved.fourPieceSetId ?? "").trim()
  const savedFourPieceSetIds = [...new Set(normalizeArray(
    saved.fourPieceSetIds ?? (legacySavedSetId ? [legacySavedSetId] : []),
  ))].filter(id => !catalog || visibleSetIds.has(id))
  const hasManualFourPieceSet = saved.fourPieceSetSource === "manual" && savedFourPieceSetIds.length > 0
  const fourPieceSetIds = hasManualFourPieceSet
    ? savedFourPieceSetIds
    : preferredFourPieceSetIds.length
      ? preferredFourPieceSetIds
      : savedFourPieceSetIds.length
        ? savedFourPieceSetIds
        : [firstDriveDiscSetId(catalog)].filter(Boolean)
  const preferredTwoPieceSetIds = [...new Set(normalizeArray(agent?.preferredDriveDiscs?.defaultTwoPieceSetIds))]
    .filter(id => !catalog || visibleSetIds.has(id))
  const savedTwoPieceSetIds = [...new Set(normalizeArray(saved.twoPieceSetIds ?? saved.twoPieceSetId))]
    .filter(id => !catalog || visibleSetIds.has(id))
  // Apply the new recommendation once, including over legacy manual selections.
  // Afterwards an explicit manual empty list must continue to mean unrestricted.
  const migrateTwoPieceDefaults = preferredTwoPieceSetIds.length > 0
    && Number(saved.twoPieceDefaultsVersion ?? 0) < TWO_PIECE_DEFAULTS_VERSION
  const hasSavedTwoPieceSets = saved.twoPieceSetIds !== undefined || saved.twoPieceSetId !== undefined
  const followsTwoPieceDefaults = migrateTwoPieceDefaults
    || saved.twoPieceSetSource === "preferred"
    || (!hasSavedTwoPieceSets && saved.twoPieceSetSource !== "manual")
  const migrateFourPieceBuffDefaults = Number(saved.fourPieceBuffDefaultsVersion ?? 0) < FOUR_PIECE_BUFF_DEFAULTS_VERSION
  const migratePreferredFourPieceBuffDefaults = Number(saved.preferredFourPieceBuffDefaultsVersion ?? 0) < PREFERRED_FOUR_PIECE_BUFF_DEFAULTS_VERSION
  const defaultFourPieceBuffRuntimeInputs = preferredFourPieceBuffRuntimeInputs(agent, catalog)
  return {
    algorithm: normalizeBrowserOptimizerAlgorithm(saved.algorithm),
    fourPieceSetIds,
    fourPieceSetSource: hasManualFourPieceSet ? "manual" : "preferred",
    twoPieceSetIds: followsTwoPieceDefaults ? preferredTwoPieceSetIds : savedTwoPieceSetIds,
    twoPieceSetSource: followsTwoPieceDefaults ? "preferred" : "manual",
    twoPieceDefaultsVersion: migrateTwoPieceDefaults
      ? TWO_PIECE_DEFAULTS_VERSION : Number(saved.twoPieceDefaultsVersion ?? 0),
    fourPieceBuffDefaultsVersion: FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    preferredFourPieceBuffDefaultsVersion: PREFERRED_FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    fourPieceBuffMode: migrateFourPieceBuffDefaults ? "manual" : normalizeFourPieceBuffMode(saved.fourPieceBuffMode),
    fourPieceBuffRuntimeInputs: migratePreferredFourPieceBuffDefaults
      ? mergeFourPieceBuffRuntimeInputs(defaultFourPieceBuffRuntimeInputs, saved.fourPieceBuffRuntimeInputs)
      : plainObject(saved.fourPieceBuffRuntimeInputs),
    mainStatLimits: cleanMainStatLimits(saved.mainStatLimits),
    minimums: normalizeMinimums(
      saved.minimums,
      saved.minimumDefaultsVersion !== MINIMUM_DEFAULTS_VERSION,
    ),
  }
}

function optimizerSettingsPayload(state: any = {}, previous: any = {}) {
  const fourPieceSetIds = [...new Set(normalizeArray(state.fourPieceSetIds))]
  return {
    ...plainObject(previous),
    algorithm: normalizeBrowserOptimizerAlgorithm(state.algorithm),
    fourPieceSetId: fourPieceSetIds[0] ?? "",
    fourPieceSetIds,
    fourPieceSetSource: state.fourPieceSetSource === "manual" ? "manual" : "preferred",
    twoPieceSetIds: normalizeArray(state.twoPieceSetIds),
    twoPieceSetSource: state.twoPieceSetSource === "manual" ? "manual" : "preferred",
    twoPieceDefaultsVersion: Number(state.twoPieceDefaultsVersion ?? 0),
    fourPieceBuffDefaultsVersion: FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    preferredFourPieceBuffDefaultsVersion: PREFERRED_FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    fourPieceBuffMode: normalizeFourPieceBuffMode(state.fourPieceBuffMode),
    fourPieceBuffRuntimeInputs: plainObject(state.fourPieceBuffRuntimeInputs),
    mainStatLimits: cleanMainStatLimits(state.mainStatLimits),
    minimumDefaultsVersion: MINIMUM_DEFAULTS_VERSION,
    minimums: normalizeMinimums(state.minimums),
  }
}

function storedOptimizerSettingsForAgent(saved: any = null, agentId = "") {
  const envelope = settingsEnvelope(saved)
  if (envelope) {
    return envelope.byAgent?.[agentId] ?? {}
  }
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function processedCombinationCount(metrics: any = {}, fallback: unknown = null) {
  if (fallback !== null && fallback !== undefined) {
    return numeric(fallback)
  }
  return numeric(
    metrics?.processedCombinationCount
      ?? (numeric(metrics?.evaluated) + numeric(metrics?.prunedBySuperBound)),
  )
}

function percentFromProgress(progress: any = {}, metrics: any = {}) {
  const direct = Number(progress?.percent ?? metrics?.percent)
  if (Number.isFinite(direct)) {
    return Math.max(0, Math.min(100, direct))
  }
  const estimated = numeric(progress?.estimatedCombinationCount ?? metrics?.estimatedCombinationCount)
  if (progress?.status === "complete" && estimated > 0) {
    return 100
  }
  if (estimated <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, (processedCombinationCount(metrics, progress?.evaluated) / estimated) * 100))
}

function mergeProgress(previous: any = null, progress: any = {}) {
  const metrics = {
    ...(previous?.metrics ?? {}),
    ...(progress?.metrics ?? {}),
  }
  const estimatedCombinationCount = numeric(
    progress?.estimatedCombinationCount
      ?? metrics.estimatedCombinationCount
      ?? previous?.estimatedCombinationCount,
  )
  const evaluated = processedCombinationCount(metrics, progress?.evaluated ?? previous?.evaluated)
  const percent = percentFromProgress({ ...previous, ...progress, evaluated, estimatedCombinationCount }, metrics)
  return {
    ...(previous ?? {}),
    ...(progress ?? {}),
    status: progress?.status ?? previous?.status ?? "idle",
    settings: progress?.settings ?? previous?.settings ?? null,
    metrics,
    evaluated,
    estimatedCombinationCount,
    percent,
    elapsedMs: numeric(progress?.elapsedMs ?? previous?.elapsedMs),
  }
}

function cloneOptimizerDriveDisc(disc: any = {}, ownerId = "default") {
  return {
    id: disc.id,
    ownerId: disc.ownerId ?? ownerId,
    setId: disc.setId,
    setName: disc.setName,
    partition: disc.partition,
    rarity: disc.rarity,
    level: disc.level,
    maxLevel: disc.maxLevel,
    locked: Boolean(disc.locked),
    equippedBy: disc.equippedBy ?? null,
    reservedForAgentId: disc.reservedForAgentId ?? null,
    excludedForAgentIds: Array.isArray(disc.excludedForAgentIds) ? [...disc.excludedForAgentIds] : [],
    mainStat: disc.mainStat ? { ...disc.mainStat } : null,
    subStats: Array.isArray(disc.subStats) ? disc.subStats.map((stat: any) => ({ ...stat })) : [],
    source: disc.source
      ? {
          type: disc.source.type,
          sequence: disc.source.sequence,
          rawIndex: disc.source.rawIndex,
        }
      : undefined,
  }
}

function cloneWorkerPayload(value: any, seen = new WeakMap<object, any>()): any {
  const raw = toRaw(value)
  if (raw === null || typeof raw !== "object") {
    return raw
  }
  if (seen.has(raw)) {
    return seen.get(raw)
  }
  if (raw instanceof Date) {
    return new Date(raw)
  }
  if (raw instanceof Map) {
    const output = new Map()
    seen.set(raw, output)
    for (const [key, item] of raw.entries()) {
      output.set(cloneWorkerPayload(key, seen), cloneWorkerPayload(item, seen))
    }
    return output
  }
  if (raw instanceof Set) {
    const output = new Set()
    seen.set(raw, output)
    for (const item of raw.values()) {
      output.add(cloneWorkerPayload(item, seen))
    }
    return output
  }
  if (Array.isArray(raw)) {
    const output: any[] = []
    seen.set(raw, output)
    for (const item of raw) {
      output.push(cloneWorkerPayload(item, seen))
    }
    return output
  }
  const prototype = Object.getPrototypeOf(raw)
  if (prototype !== Object.prototype && prototype !== null) {
    return raw
  }
  const output: Record<string, any> = {}
  seen.set(raw, output)
  for (const [key, item] of Object.entries(raw)) {
    if (typeof item === "function" || typeof item === "symbol") {
      continue
    }
    output[key] = cloneWorkerPayload(item, seen)
  }
  return output
}

function optimizerStorePayload(sourceStore: any = {}, ownerId = "default") {
  const normalizedOwnerId = String(ownerId || sourceStore?.currentOwnerId || "default")
  const owner = (sourceStore?.owners ?? []).find((item: any) => item.id === normalizedOwnerId)
  const ownerPayload = owner
    ? {
        id: String(owner.id ?? normalizedOwnerId),
        label: String(owner.label ?? owner.name ?? owner.id ?? normalizedOwnerId),
      }
    : { id: normalizedOwnerId, label: normalizedOwnerId || "默认用户" }
  return {
    version: sourceStore?.version ?? 1,
    currentOwnerId: normalizedOwnerId,
    owners: [ownerPayload],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: (sourceStore?.driveDiscs ?? [])
      .filter((disc: any) => (disc.ownerId ?? "default") === normalizedOwnerId)
      .map((disc: any) => cloneOptimizerDriveDisc(disc, normalizedOwnerId)),
  }
}

function resultReason(result: any = {}) {
  return result?.error?.reason
    ?? result?.reason
    ?? "没有符合条件的结果。请放宽 2 件套、主词条或最小值限制后重试。"
}

export const useOptimizerStore = defineStore("optimizer", {
  state: () => ({
    status: "idle" as OptimizerStatus,
    activeAgentId: "",
    algorithm: "exact-super-bound",
    fourPieceSetIds: [] as string[],
    fourPieceSetSource: "preferred" as "preferred" | "manual",
    twoPieceSetIds: [] as string[],
    twoPieceSetSource: "preferred" as "preferred" | "manual",
    twoPieceDefaultsVersion: 0,
    fourPieceBuffDefaultsVersion: FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    preferredFourPieceBuffDefaultsVersion: PREFERRED_FOUR_PIECE_BUFF_DEFAULTS_VERSION,
    fourPieceBuffMode: "manual" as "auto" | "manual",
    fourPieceBuffRuntimeInputs: {} as Record<string, any>,
    mainStatLimits: defaultMainStatLimits(),
    minimums: defaultMinimums(),
    metrics: null as any,
    progressMetrics: null as any,
    progress: null as any,
    results: [] as any[],
    resultSchemes: [] as any[],
    resultsAreProvisional: false,
    completedSettings: null as any,
    completedSettingsFingerprint: "",
    completedInventoryFingerprint: "",
    completedCalculationInputFingerprint: "",
    /** 当前结果来自本地保存的上次优化时为保存时间（ISO），本次运行得到的结果为空串 */
    restoredResultsSavedAt: "",
    error: "",
    cancelRequested: false,
  }),
  getters: {
    isBusy: state => state.status === "estimating" || state.status === "preparing" || state.status === "running" || state.status === "cancelling",
    fourPieceSetId: state => state.fourPieceSetIds[0] ?? "",
    selectedResult: state => (rank: number) => state.resultSchemes.find((item: any) => Number(item.rank) === Number(rank)),
    settings: state => settingsFromState(state),
    resultsAreStale: state => Boolean(
      state.resultSchemes.length
      && state.completedSettingsFingerprint
      && state.completedSettingsFingerprint !== optimizerSettingsFingerprint(settingsFromState(state)),
    ),
    inventoryRestrictionsChanged: state => (store: any, ownerId: string, agentId: string) => Boolean(
      state.completedInventoryFingerprint
      && state.resultSchemes.length
      && state.completedInventoryFingerprint !== driveDiscOptimizationInventoryFingerprint(store, { ownerId, agentId }),
    ),
    calculationInputChanged: state => (input: any) => Boolean(
      state.resultSchemes.length
      && state.completedCalculationInputFingerprint
      && state.completedCalculationInputFingerprint !== optimizerCalculationInputFingerprint(input),
    ),
  },
  actions: {
    initialize(catalog: any = null, agent: any = null) {
      this.loadAgentSettings(agent, catalog)
    },
    applySettings(settings: any = {}) {
      this.algorithm = settings.algorithm
      this.fourPieceSetIds = settings.fourPieceSetIds
      this.fourPieceSetSource = settings.fourPieceSetSource
      this.twoPieceSetIds = settings.twoPieceSetIds
      this.twoPieceSetSource = settings.twoPieceSetSource
      this.twoPieceDefaultsVersion = settings.twoPieceDefaultsVersion
      this.fourPieceBuffDefaultsVersion = settings.fourPieceBuffDefaultsVersion
      this.preferredFourPieceBuffDefaultsVersion = settings.preferredFourPieceBuffDefaultsVersion
      this.fourPieceBuffMode = normalizeFourPieceBuffMode(settings.fourPieceBuffMode)
      this.fourPieceBuffRuntimeInputs = settings.fourPieceBuffRuntimeInputs
      this.mainStatLimits = settings.mainStatLimits
      this.minimums = settings.minimums
    },
    loadAgentSettings(agent: any = null, catalog: any = null) {
      const saved = readSettings()
      const agentId = agentSettingsId(agent, saved, this.activeAgentId)
      const settings = normalizeOptimizerSettings(storedOptimizerSettingsForAgent(saved, agentId), catalog, agent)
      this.activeAgentId = agentId
      this.applySettings(settings)
      this.persistSettings()
    },
    applyAgentPreferredDriveDiscSet(agent: any = null, catalog: any = null) {
      const preferredFourPieceSetIds = preferredDriveDiscDefaultSetIds(agent, catalog)
      if (!preferredFourPieceSetIds.length
        || JSON.stringify(preferredFourPieceSetIds) === JSON.stringify(this.fourPieceSetIds)) {
        return
      }
      this.fourPieceSetIds = preferredFourPieceSetIds
      this.fourPieceSetSource = "preferred"
      this.persistSettings()
    },
    persistSettings() {
      const saved = readSettings()
      const envelope = settingsEnvelope(saved)
      const currentAgentId = this.activeAgentId || agentSettingsId(null, saved)
      const previousAgentSettings = envelope?.byAgent?.[currentAgentId]
        ?? storedOptimizerSettingsForAgent(saved, currentAgentId)
      const byAgent = {
        ...(envelope?.byAgent ?? {}),
        [currentAgentId]: optimizerSettingsPayload(this, previousAgentSettings),
      }
      writeSettings({
        ...plainObject(envelope),
        version: SETTINGS_VERSION,
        currentAgentId,
        byAgent,
      })
    },
    setAlgorithm(value: string) {
      this.algorithm = normalizeBrowserOptimizerAlgorithm(value)
      this.persistSettings()
    },
    setFourPieceSet(id: string) {
      this.setFourPieceSets(id ? [id] : [])
    },
    setFourPieceSets(ids: string[]) {
      this.fourPieceSetIds = [...new Set(normalizeArray(ids))]
      this.fourPieceSetSource = "manual"
      this.persistSettings()
    },
    setTwoPieceSetIds(ids: string[]) {
      this.twoPieceSetIds = [...new Set(normalizeArray(ids))]
      this.twoPieceSetSource = "manual"
      this.persistSettings()
    },
    applyAdvancedSettings(settings: any = {}) {
      this.algorithm = normalizeBrowserOptimizerAlgorithm(settings.algorithm || this.algorithm)
      this.fourPieceBuffMode = normalizeFourPieceBuffMode(settings.fourPieceBuffMode)
      this.fourPieceBuffRuntimeInputs = plainObject(settings.fourPieceBuffRuntimeInputs)
      this.mainStatLimits = cleanMainStatLimits(settings.mainStatLimits)
      this.minimums = normalizeMinimums(settings.minimums)
      this.persistSettings()
    },
    setMainStatLimits(limits: any = {}) {
      this.mainStatLimits = cleanMainStatLimits(limits)
      this.persistSettings()
    },
    setMinimums(minimums: any = {}) {
      this.minimums = normalizeMinimums(minimums)
      this.persistSettings()
    },
    setFourPieceBuffRuntimeInputs(inputs: any = {}) {
      this.fourPieceBuffRuntimeInputs = plainObject(inputs)
      this.persistSettings()
    },
    toggleMainStatLimit(slot: string | number, stat: string) {
      const key = String(slot)
      const values = new Set(this.mainStatLimits[key] ?? [])
      if (values.has(stat)) {
        values.delete(stat)
      } else {
        values.add(stat)
      }
      this.mainStatLimits = {
        ...this.mainStatLimits,
        [key]: [...values],
      }
      this.persistSettings()
    },
    clearMainStatLimit(slot: string | number) {
      this.mainStatLimits = {
        ...this.mainStatLimits,
        [String(slot)]: [],
      }
      this.persistSettings()
    },
    setMinimum(stat: string, value: number | null) {
      if (!MINIMUM_STAT_KEYS.includes(stat as typeof MINIMUM_STAT_KEYS[number])) {
        return
      }
      this.minimums = {
        ...this.minimums,
        [stat]: value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value),
      }
      this.persistSettings()
    },
    setFourPieceBuffMode(mode: "auto" | "manual") {
      this.fourPieceBuffMode = mode === "manual" ? "manual" : "auto"
      this.persistSettings()
    },
    setFourPieceBuffRuntimeInput(id: string, runtime: any) {
      this.fourPieceBuffRuntimeInputs = {
        ...this.fourPieceBuffRuntimeInputs,
        [id]: runtime,
      }
      this.persistSettings()
    },
    reset() {
      disposeWorker()
      this.resultsAreProvisional = false
      this.status = "idle"
      this.metrics = null
      this.progressMetrics = null
      this.progress = null
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
      this.completedSettingsFingerprint = ""
      this.completedInventoryFingerprint = ""
      this.completedCalculationInputFingerprint = ""
      this.restoredResultsSavedAt = ""
      this.error = ""
      this.cancelRequested = false
    },
    saveCompletedResults(ownerId: string, agentId: string) {
      if (!ownerId || !agentId || !this.resultSchemes.length || this.resultsAreProvisional) return
      const entries = readSavedResults()
      entries[savedResultsKey(ownerId, agentId)] = {
        savedAt: new Date().toISOString(),
        resultSchemes: cloneWorkerPayload(this.resultSchemes),
        completedSettings: cloneWorkerPayload(this.completedSettings),
        completedSettingsFingerprint: this.completedSettingsFingerprint,
        completedInventoryFingerprint: this.completedInventoryFingerprint,
        completedCalculationInputFingerprint: this.completedCalculationInputFingerprint,
      }
      writeSavedResults(entries)
    },
    /**
     * 恢复该账号、角色上次保存的优化结果。方案中任一驱动盘已删除或词条已变化时丢弃该方案；
     * 正在优化或已有结果时不覆盖。返回是否恢复到了至少一套方案。
     */
    restoreSavedResults(ownerId: string, agentId: string, inventoryDiscs: any[] = []) {
      if (this.isBusy || this.resultSchemes.length || !ownerId || !agentId) return false
      const entry = readSavedResults()[savedResultsKey(ownerId, agentId)]
      if (!entry || !Array.isArray(entry.resultSchemes)) return false
      const liveContent = new Map<string, string>(inventoryDiscs.map((disc: any) => [String(disc?.id ?? ""), discContent(disc)]))
      const schemes = entry.resultSchemes.filter((scheme: any) => {
        const discs = Array.isArray(scheme?.driveDiscs) ? scheme.driveDiscs : []
        return discs.length > 0 && discs.every((disc: any) => liveContent.get(String(disc?.id ?? "")) === discContent(disc))
      })
      if (!schemes.length) return false
      this.resultSchemes = schemes
      this.results = []
      this.resultsAreProvisional = false
      this.completedSettings = entry.completedSettings ?? null
      this.completedSettingsFingerprint = String(entry.completedSettingsFingerprint ?? "")
      this.completedInventoryFingerprint = String(entry.completedInventoryFingerprint ?? "")
      this.completedCalculationInputFingerprint = String(entry.completedCalculationInputFingerprint ?? "")
      this.restoredResultsSavedAt = String(entry.savedAt ?? "")
      this.status = "idle"
      this.error = ""
      return true
    },
    disposeRuntime() {
      disposeWorker()
    },
    failBeforeRun(message: string, settings: any = null) {
      this.resultsAreProvisional = false
      disposeWorker()
      this.status = "error"
      this.error = message
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
      this.completedSettingsFingerprint = ""
      this.completedInventoryFingerprint = ""
      this.completedCalculationInputFingerprint = ""
      this.cancelRequested = false
      this.progress = null
      this.applyProgress({
        status: "error",
        settings,
        metrics: {
          candidateCountsBySlot: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          estimatedCombinationCount: 0,
          processedCombinationCount: 0,
        },
        evaluated: 0,
        estimatedCombinationCount: 0,
        percent: 0,
        elapsedMs: 0,
      })
    },
    inputWithSettings(input: any, sourceStore: any = null) {
      const ownerId = String(input?.ownerId ?? sourceStore?.currentOwnerId ?? "default")
      return {
        ...input,
        ownerId,
        settings: {
          ...(input?.settings ?? {}),
          ...this.settings,
          ownerId,
        },
      }
    },
    applyProgress(progress: any = {}) {
      this.progress = mergeProgress(this.progress, progress)
      this.metrics = this.progress.metrics
      this.progressMetrics = this.progress
    },
    preview(catalog: any, store: any, input: any) {
      this.status = "estimating"
      this.error = ""
      if (activeRunResolve) {
        disposeWorker()
      }
      const worker = reusableWorker()
      const id = runId()
      activeRunId = id
      const workerInput = this.inputWithSettings(input, store)
      const workerStore = optimizerStorePayload(store, workerInput.ownerId)
      const workerCatalog = catalogForWorker(catalog)
      return new Promise(resolve => {
        activeRunResolve = () => resolve(null)
        worker.onmessage = event => {
          const message = event.data ?? {}
          if (message.runId !== id || activeRunId !== id || activeWorker !== worker) {
            return
          }
          if (message.type === "preview") {
            this.applyProgress({
              status: "preview",
              settings: message.preview?.settings,
              metrics: message.preview?.metrics ?? {},
              evaluated: message.preview?.metrics?.processedCombinationCount ?? message.preview?.metrics?.evaluated ?? 0,
              estimatedCombinationCount: message.preview?.metrics?.estimatedCombinationCount ?? 0,
              percent: 0,
            })
            this.status = "idle"
            clearActiveRun()
            resolve(message.preview)
          } else {
            this.error = message.error ?? "预估失败"
            this.status = "error"
            disposeWorker()
            resolve(null)
          }
        }
        worker.onerror = event => {
          if (activeRunId !== id || activeWorker !== worker) return
          this.error = event.message
          this.status = "error"
          disposeWorker()
          resolve(null)
        }
        try {
          worker.postMessage({
            type: "preview",
            runId: id,
            ...(workerCatalog ? { catalog: workerCatalog } : {}),
            store: workerStore,
            input: cloneWorkerPayload(workerInput),
          })
        } catch (error) {
          this.error = error instanceof Error ? error.message : String(error)
          this.status = "error"
          disposeWorker()
          resolve(null)
        }
      })
    },
    async run(catalog: any, store: any, input: any) {
      if (activeRunResolve) {
        disposeWorker()
      }
      this.status = "preparing"
      this.resultsAreProvisional = false
      this.restoredResultsSavedAt = ""
      this.error = ""
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
      this.completedSettingsFingerprint = ""
      this.completedInventoryFingerprint = ""
      this.completedCalculationInputFingerprint = ""
      this.cancelRequested = false
      this.progress = null
      this.applyProgress({
        status: "preparing",
        metrics: {},
        evaluated: 0,
        estimatedCombinationCount: 0,
        percent: 0,
        elapsedMs: 0,
      })
      const id = runId()
      activeRunId = id
      lastWorkerMessageAt = Date.now()
      const worker = reusableWorker()
      const workerInput = this.inputWithSettings(input, store)
      const submittedSettingsFingerprint = optimizerSettingsFingerprint(workerInput.settings)
      const submittedCalculationInputFingerprint = optimizerCalculationInputFingerprint(workerInput)
      const inventoryFingerprint = driveDiscOptimizationInventoryFingerprint(store, {
        ownerId: workerInput.ownerId,
        agentId: workerInput.agentId,
      })
      const workerStore = optimizerStorePayload(store, workerInput.ownerId)
      const workerCatalog = catalogForWorker(catalog)
      const workerRequestInput = cloneWorkerPayload(workerInput)
      await new Promise<void>(resolve => {
        activeRunResolve = resolve
        const finishRun = (terminateWorker = false) => {
          if (activeRunResolve === resolve) {
            if (terminateWorker) {
              disposeWorker()
            } else {
              clearActiveRun()
            }
          }
          resolve()
        }
        const failStalledRun = () => {
          this.error = "优化 Worker 长时间没有返回进度，已自动停止。通常是候选数据准备或剪枝计划构建过重，请先限定 2 件套或 4/5/6 号位主词条后重试。"
          this.status = "error"
          this.applyProgress({
            status: "error",
            percent: this.progress?.percent ?? 0,
            elapsedMs: this.progress?.elapsedMs ?? 0,
          })
          finishRun(true)
        }
        activeWatchdogTimer = setInterval(() => {
          if (!activeRunResolve || activeRunResolve !== resolve) {
            return
          }
          if (Date.now() - lastWorkerMessageAt >= OPTIMIZER_WORKER_STALL_TIMEOUT_MS) {
            failStalledRun()
          }
        }, 1000)

        worker.onmessage = event => {
          const message = event.data ?? {}
          if (message.runId !== id || activeRunId !== id || activeWorker !== worker) {
            return
          }
          lastWorkerMessageAt = Date.now()
          if (message.type === "started") {
            if (this.status !== "cancelling" && this.status !== "cancelled") {
              this.status = "preparing"
            }
            this.applyProgress({
              status: "preparing",
              ...(message.job ?? {}),
            })
            return
          }
          if (message.type === "preview") {
            const job = message.job ?? {}
            const metrics = job.metrics ?? {}
            if (this.status !== "cancelling" && this.status !== "cancelled") {
              this.status = "running"
            }
            this.applyProgress({
              status: "preview",
              settings: job.settings,
              metrics,
              evaluated: job.evaluated ?? processedCombinationCount(metrics),
              estimatedCombinationCount: job.estimatedCombinationCount ?? metrics.estimatedCombinationCount ?? 0,
              percent: job.percent ?? 0,
              elapsedMs: job.elapsedMs ?? this.progress?.elapsedMs ?? 0,
            })
            return
          }
          if (message.type === "progress") {
            if (this.status !== "cancelling" && this.status !== "cancelled") {
              this.status = message.job?.status === "preparing" ? "preparing" : "running"
            }
            this.applyProgress(message.job ?? {})
            if (message.job?.currentResults?.length && !this.cancelRequested) {
              this.resultsAreProvisional = true
              this.resultSchemes = message.job.currentResults.map((row: any) => ({ ...row, driveDiscs: row.driveDiscs ?? [] }))
              this.completedSettings = cloneWorkerPayload(workerInput.settings)
              this.completedSettingsFingerprint = submittedSettingsFingerprint
              this.completedInventoryFingerprint = inventoryFingerprint
              this.completedCalculationInputFingerprint = submittedCalculationInputFingerprint
            }
            return
          }
          if (message.type === "complete") {
            this.resultsAreProvisional = false
            const result = message.result ?? message.job?.result ?? {}
            const metrics = result.metrics ?? {}
            const results = result.results ?? []
            const hasResults = results.length > 0
            const completedSettings = result.settings ?? workerInput.settings
            this.applyProgress({
              status: hasResults ? "complete" : "error",
              settings: completedSettings,
              metrics,
              evaluated: processedCombinationCount(metrics),
              estimatedCombinationCount: metrics.estimatedCombinationCount ?? 0,
              percent: hasResults ? 100 : this.progress?.percent ?? 0,
            })
            this.results = results
            this.completedSettings = hasResults ? cloneWorkerPayload(completedSettings) : null
            this.completedSettingsFingerprint = hasResults ? submittedSettingsFingerprint : ""
            this.completedInventoryFingerprint = hasResults ? inventoryFingerprint : ""
            this.completedCalculationInputFingerprint = hasResults ? submittedCalculationInputFingerprint : ""
            this.resultSchemes = this.results.map((result: any) => ({
              rank: result.rank,
              score: result.score,
              fourPieceSetId: result.fourPieceSetId,
              driveDiscs: result.driveDiscs ?? [],
              loadoutName: `${input?.label ?? "优化方案"}-${Math.round(Number(result.score ?? 0))}-第 ${result.rank} 名`,
            }))
            if (hasResults) {
              this.status = "done"
              this.error = ""
              this.saveCompletedResults(String(workerInput.ownerId ?? ""), String(workerInput.agentId ?? ""))
            } else {
              this.status = "error"
              this.error = resultReason(result)
            }
            finishRun()
            return
          }
          if (message.type === "cancelled") {
            this.applyProgress({
              status: "cancelled",
              percent: this.progress?.percent ?? 0,
              elapsedMs: this.progress?.elapsedMs ?? 0,
            })
            this.status = "cancelled"
            finishRun(true)
            return
          }
          if (message.type === "error") {
            this.error = message.error ?? "优化失败"
            this.status = "error"
            this.applyProgress({
              status: "error",
              percent: this.progress?.percent ?? 0,
              elapsedMs: this.progress?.elapsedMs ?? 0,
            })
            finishRun(true)
          }
        }
        worker.onerror = event => {
          if (activeRunId !== id || activeWorker !== worker) return
          this.error = event.message
          this.status = "error"
          this.applyProgress({
            status: "error",
            percent: this.progress?.percent ?? 0,
            elapsedMs: this.progress?.elapsedMs ?? 0,
          })
          finishRun(true)
        }
        try {
          worker.postMessage({
            type: "start",
            runId: activeRunId,
            ...(workerCatalog ? { catalog: workerCatalog } : {}),
            store: workerStore,
            input: workerRequestInput,
            settings: {
              progressIntervalMs: 200,
              yieldIntervalMs: 50,
            },
          })
        } catch (error) {
          this.error = error instanceof Error ? error.message : String(error)
          this.status = "error"
          this.applyProgress({
            status: "error",
            percent: this.progress?.percent ?? 0,
            elapsedMs: this.progress?.elapsedMs ?? 0,
          })
          finishRun(true)
        }
      })
    },
    cancel() {
      if (!["estimating", "preparing", "running", "cancelling"].includes(this.status)) {
        return
      }
      const resolve = activeRunResolve
      this.cancelRequested = true
      this.status = "cancelled"
      this.applyProgress({
        status: "cancelled",
        percent: this.progress?.percent ?? 0,
        elapsedMs: this.progress?.elapsedMs ?? 0,
      })
      disposeWorker()
      if (resolve) {
        resolve()
      }
    },
  },
})
