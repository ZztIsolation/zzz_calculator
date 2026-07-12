import { defineStore } from "pinia"
import { toRaw } from "vue"

type OptimizerStatus = "idle" | "estimating" | "preparing" | "running" | "cancelling" | "cancelled" | "done" | "error"

const SETTINGS_KEY = "zzz-calculator.webapp.optimizer.v1"
const SETTINGS_VERSION = 2
const FALLBACK_AGENT_SETTINGS_ID = "__default__"
const OPTIMIZER_WORKER_STALL_TIMEOUT_MS = 45_000

let activeWorker: Worker | null = null
let activeRunId = ""
let activeRunResolve: (() => void) | null = null
let activeWatchdogTimer: ReturnType<typeof setInterval> | null = null
let lastWorkerMessageAt = 0

function disposeWorker() {
  if (activeWatchdogTimer) {
    clearInterval(activeWatchdogTimer)
    activeWatchdogTimer = null
  }
  activeWorker?.terminate()
  activeWorker = null
  activeRunId = ""
  activeRunResolve = null
  lastWorkerMessageAt = 0
}

function runId() {
  return `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null")
  } catch {
    return null
  }
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
  return value?.version === SETTINGS_VERSION && value?.byAgent && typeof value.byAgent === "object" && !Array.isArray(value.byAgent)
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
  return {
    energyRegen: null,
    anomalyProficiency: null,
    critRate: null,
    critDmg: null,
  }
}

function normalizeArray(value: any) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function cleanMinimums(value: any = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, raw === "" || raw === null || raw === undefined ? null : Number(raw)])
      .filter(([, raw]) => raw === null || Number.isFinite(raw as number)),
  )
}

function cleanMainStatLimits(value: any = {}) {
  return {
    ...defaultMainStatLimits(),
    ...Object.fromEntries(Object.entries(value ?? {}).map(([slot, values]) => [String(slot), normalizeArray(values)])),
  }
}

function preferredDriveDiscDefaultSetId(agent: any = null, catalog: any = null) {
  const setId = String(
    agent?.preferredDriveDiscs?.defaultSetId
      ?? agent?.preferredDriveDiscs?.defaultSet
      ?? agent?.defaultDriveDiscSetId
      ?? "",
  ).trim()
  if (!setId) {
    return ""
  }
  const validIds = new Set((catalog?.driveDiscSets ?? []).map((set: any) => String(set?.id ?? "")).filter(Boolean))
  return !validIds.size || validIds.has(setId) ? setId : ""
}

function firstDriveDiscSetId(catalog: any = null) {
  return String(catalog?.driveDiscSets?.[0]?.id ?? "").trim()
}

function normalizeOptimizerSettings(value: any = {}, catalog: any = null, agent: any = null) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const preferredFourPieceSetId = preferredDriveDiscDefaultSetId(agent, catalog)
  const savedFourPieceSetId = String(saved.fourPieceSetId ?? "").trim()
  const hasManualFourPieceSet = saved.fourPieceSetSource === "manual" && savedFourPieceSetId
  const fourPieceSetId = hasManualFourPieceSet
    ? savedFourPieceSetId
    : preferredFourPieceSetId || savedFourPieceSetId || firstDriveDiscSetId(catalog)
  return {
    algorithm: String(saved.algorithm || "exact-super-bound"),
    fourPieceSetId,
    fourPieceSetSource: hasManualFourPieceSet ? "manual" : "preferred",
    twoPieceSetIds: normalizeArray(saved.twoPieceSetIds ?? saved.twoPieceSetId),
    fourPieceBuffMode: saved.fourPieceBuffMode === "manual" ? "manual" : "auto",
    fourPieceBuffRuntimeInputs: plainObject(saved.fourPieceBuffRuntimeInputs),
    mainStatLimits: cleanMainStatLimits(saved.mainStatLimits),
    minimums: {
      ...defaultMinimums(),
      ...cleanMinimums(saved.minimums),
    },
  }
}

function optimizerSettingsPayload(state: any = {}) {
  return {
    algorithm: String(state.algorithm || "exact-super-bound"),
    fourPieceSetId: String(state.fourPieceSetId ?? "").trim(),
    fourPieceSetSource: state.fourPieceSetSource === "manual" ? "manual" : "preferred",
    twoPieceSetIds: normalizeArray(state.twoPieceSetIds),
    fourPieceBuffMode: state.fourPieceBuffMode === "manual" ? "manual" : "auto",
    fourPieceBuffRuntimeInputs: plainObject(state.fourPieceBuffRuntimeInputs),
    mainStatLimits: cleanMainStatLimits(state.mainStatLimits),
    minimums: {
      ...defaultMinimums(),
      ...cleanMinimums(state.minimums),
    },
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
    fourPieceSetId: "",
    fourPieceSetSource: "preferred" as "preferred" | "manual",
    twoPieceSetIds: [] as string[],
    fourPieceBuffMode: "auto" as "auto" | "manual",
    fourPieceBuffRuntimeInputs: {} as Record<string, any>,
    mainStatLimits: defaultMainStatLimits(),
    minimums: defaultMinimums(),
    metrics: null as any,
    progressMetrics: null as any,
    progress: null as any,
    results: [] as any[],
    resultSchemes: [] as any[],
    completedSettings: null as any,
    error: "",
    cancelRequested: false,
  }),
  getters: {
    isBusy: state => state.status === "estimating" || state.status === "preparing" || state.status === "running" || state.status === "cancelling",
    selectedResult: state => (rank: number) => state.resultSchemes.find((item: any) => Number(item.rank) === Number(rank)),
    settings(state) {
      return {
        objective: "damage",
        algorithm: state.algorithm,
        fourPieceSetId: state.fourPieceSetId,
        twoPieceSetIds: state.twoPieceSetIds,
        fourPieceBuffMode: state.fourPieceBuffMode,
        fourPieceBuffRuntimeInputs: state.fourPieceBuffRuntimeInputs,
        mainStatLimits: state.mainStatLimits,
        minimums: cleanMinimums(state.minimums),
        enableUpperBoundPruning: true,
      }
    },
  },
  actions: {
    initialize(catalog: any = null, agent: any = null) {
      this.loadAgentSettings(agent, catalog)
    },
    applySettings(settings: any = {}) {
      this.algorithm = settings.algorithm
      this.fourPieceSetId = settings.fourPieceSetId
      this.fourPieceSetSource = settings.fourPieceSetSource
      this.twoPieceSetIds = settings.twoPieceSetIds
      this.fourPieceBuffMode = settings.fourPieceBuffMode
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
      const preferredFourPieceSetId = preferredDriveDiscDefaultSetId(agent, catalog)
      if (!preferredFourPieceSetId || preferredFourPieceSetId === this.fourPieceSetId) {
        return
      }
      this.fourPieceSetId = preferredFourPieceSetId
      this.fourPieceSetSource = "preferred"
      this.persistSettings()
    },
    persistSettings() {
      const saved = readSettings()
      const envelope = settingsEnvelope(saved)
      const currentAgentId = this.activeAgentId || agentSettingsId(null, saved)
      const byAgent = {
        ...(envelope?.byAgent ?? {}),
        [currentAgentId]: optimizerSettingsPayload(this),
      }
      writeSettings({
        version: SETTINGS_VERSION,
        currentAgentId,
        byAgent,
      })
    },
    setAlgorithm(value: string) {
      this.algorithm = value || "exact-super-bound"
      this.persistSettings()
    },
    setFourPieceSet(id: string) {
      this.fourPieceSetId = id
      this.fourPieceSetSource = "manual"
      this.persistSettings()
    },
    setTwoPieceSetIds(ids: string[]) {
      this.twoPieceSetIds = normalizeArray(ids)
      this.persistSettings()
    },
    applyAdvancedSettings(settings: any = {}) {
      this.algorithm = String(settings.algorithm || this.algorithm || "exact-super-bound")
      this.fourPieceBuffMode = settings.fourPieceBuffMode === "manual" ? "manual" : "auto"
      this.fourPieceBuffRuntimeInputs = plainObject(settings.fourPieceBuffRuntimeInputs)
      this.mainStatLimits = cleanMainStatLimits(settings.mainStatLimits)
      this.minimums = {
        ...defaultMinimums(),
        ...cleanMinimums(settings.minimums),
      }
      this.persistSettings()
    },
    setMainStatLimits(limits: any = {}) {
      this.mainStatLimits = cleanMainStatLimits(limits)
      this.persistSettings()
    },
    setMinimums(minimums: any = {}) {
      this.minimums = {
        ...defaultMinimums(),
        ...cleanMinimums(minimums),
      }
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
      this.status = "idle"
      this.metrics = null
      this.progressMetrics = null
      this.progress = null
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
      this.error = ""
      this.cancelRequested = false
    },
    failBeforeRun(message: string, settings: any = null) {
      disposeWorker()
      this.status = "error"
      this.error = message
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
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
      const worker = new Worker(new URL("../workers/optimizer.worker.ts", import.meta.url), { type: "module" })
      const id = runId()
      const workerInput = this.inputWithSettings(input, store)
      const workerStore = optimizerStorePayload(store, workerInput.ownerId)
      const workerCatalog = cloneWorkerPayload(catalog)
      return new Promise(resolve => {
        worker.onmessage = event => {
          const message = event.data ?? {}
          if (message.runId !== id) {
            return
          }
          worker.terminate()
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
            resolve(message.preview)
          } else {
            this.error = message.error ?? "预估失败"
            this.status = "error"
            resolve(null)
          }
        }
        worker.onerror = event => {
          worker.terminate()
          this.error = event.message
          this.status = "error"
          resolve(null)
        }
        try {
          worker.postMessage({ type: "preview", runId: id, catalog: workerCatalog, store: workerStore, input: cloneWorkerPayload(workerInput) })
        } catch (error) {
          worker.terminate()
          this.error = error instanceof Error ? error.message : String(error)
          this.status = "error"
          resolve(null)
        }
      })
    },
    async run(catalog: any, store: any, input: any) {
      disposeWorker()
      this.status = "preparing"
      this.error = ""
      this.results = []
      this.resultSchemes = []
      this.completedSettings = null
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
      activeRunId = runId()
      lastWorkerMessageAt = Date.now()
      activeWorker = new Worker(new URL("../workers/optimizer.worker.ts", import.meta.url), { type: "module" })
      const worker = activeWorker
      const workerInput = this.inputWithSettings(input, store)
      const workerStore = optimizerStorePayload(store, workerInput.ownerId)
      const workerCatalog = cloneWorkerPayload(catalog)
      const workerRequestInput = cloneWorkerPayload(workerInput)
      await new Promise<void>(resolve => {
        activeRunResolve = resolve
        const finishRun = () => {
          if (activeRunResolve === resolve) {
            disposeWorker()
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
          finishRun()
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
          if (message.runId !== activeRunId) {
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
            return
          }
          if (message.type === "complete") {
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
            this.resultSchemes = this.results.map((result: any) => ({
              rank: result.rank,
              score: result.score,
              driveDiscs: result.driveDiscs ?? [],
              loadoutName: `${input?.label ?? "优化方案"}-${Math.round(Number(result.score ?? 0))}-第 ${result.rank} 名`,
            }))
            if (hasResults) {
              this.status = "done"
              this.error = ""
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
            finishRun()
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
            finishRun()
          }
        }
        worker.onerror = event => {
          this.error = event.message
          this.status = "error"
          this.applyProgress({
            status: "error",
            percent: this.progress?.percent ?? 0,
            elapsedMs: this.progress?.elapsedMs ?? 0,
          })
          finishRun()
        }
        try {
          worker.postMessage({
            type: "start",
            runId: activeRunId,
            catalog: workerCatalog,
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
          finishRun()
        }
      })
    },
    cancel() {
      if (!["preparing", "running", "cancelling"].includes(this.status)) {
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
