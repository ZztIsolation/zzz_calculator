import { defineStore } from "pinia"
import {
  clearUserDriveDiscStore,
  deleteDriveDiscLoadout,
  deleteUserDriveDisc,
  exportCurrentUserDriveDiscs,
  importScannerExportToStore,
  loadCurrentUserDriveDiscStore,
  previewScannerExportImport,
  upsertDriveDiscLoadout,
  upsertUserDriveDisc,
} from "@runtime/local-store.js"
import { toCalculatorDriveDisc } from "@core/drive-disc-core.js"
import { analyzeDriveDiscStatDiffs, analyzeDriveDiscStatGains, analyzeDriveDiscSubstats } from "@core/driveDiscAnalysis-core.js"
import { ScannerBridge } from "@runtime/scanner-bridge.js"
import {
  createScanTelemetrySession,
  finishScanTelemetryEvent,
  scanTelemetryVersions,
  startedScanTelemetryEvent,
  type ActiveScanTelemetrySession,
} from "@runtime/scan-telemetry"

const HELPER_DOWNLOAD_URL = "https://download.zzzcaculator.top/downloads/zzz-scanner/helper/1.2.1/ZZZ-Scanner-Helper.exe"
const HELPER_POLL_INTERVAL_MS = 3000
export const REQUIRED_HELPER_VERSION = "1.2.1"
const SCAN_CLIENTS = {
  local: {
    processName: "ZenlessZoneZero",
    visualProfileClient: "local",
  },
  cloud: {
    processName: "Zenless Zone Zero Cloud",
    visualProfileClient: "cloud",
  },
} as const

type ScanStatus = "idle" | "connecting" | "waiting-helper" | "preparing" | "downloading" | "ready" | "scanning" | "complete" | "error"
type ScanClient = keyof typeof SCAN_CLIENTS
type ScanPhase = "a" | "b" | "c" | "d"
type ScanErrorContext = "" | "prepare" | "scan" | "helper-missing" | "helper-outdated" | "game-not-found"
type ScanErrorVariant = "helper-missing" | "helper-outdated" | "prepare-failed" | "scan-failed" | "game-not-found" | "diagnostic-failure"
type ScanHelperUpgradeMode = "" | "legacy-manual" | "manual-download" | "self-updating" | "awaiting-restart" | "self-update-failed"

type ScanFailure = {
  code: string
  phase: string
  title: string
  message: string
  remedy: string
  retryable: boolean
  actions: Array<{ kind: string; label: string }>
  diagnosticId: string
  details: Record<string, string | number | boolean>
}

const GAME_NOT_FOUND_PATTERNS = [
  /未找到/,
  /找不到.*(进程|窗口|游戏)/,
  /process.*not.*found/i,
  /window.*not.*found/i,
  /ZenlessZoneZero/,
]

function detectGameNotFound(message: string) {
  return GAME_NOT_FOUND_PATTERNS.some(pattern => pattern.test(message))
}

function normalizeScanFailure(value: any): ScanFailure | null {
  if (!value || typeof value !== "object" || !String(value.code ?? "").trim()) {
    return null
  }
  return {
    code: String(value.code),
    phase: String(value.phase ?? "prepare"),
    title: String(value.title ?? "OCR 扫描器发生错误"),
    message: String(value.message ?? "扫描器发生未知错误。"),
    remedy: String(value.remedy ?? "请重试；如果问题持续，请打开日志。"),
    retryable: value.retryable !== false,
    actions: Array.isArray(value.actions)
      ? value.actions
        .filter((action: any) => action?.kind && action?.label)
        .map((action: any) => ({ kind: String(action.kind), label: String(action.label) }))
      : [],
    diagnosticId: String(value.diagnosticId ?? ""),
    details: value.details && typeof value.details === "object" ? value.details : {},
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function asSlot(slot: unknown) {
  const number = Number(slot)
  return number >= 1 && number <= 6 ? String(number) : ""
}

function discId() {
  return `disc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function loadoutId() {
  return `loadout-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function exportFileSegment(value: unknown) {
  const cleaned = String(value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
  if (!cleaned) return "account"
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(cleaned)
    ? `account-${cleaned}`
    : cleaned
}

function localDateStamp(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeDiscDraft(input: any = {}, fallback: any = {}) {
  const partition = Number(input.partition ?? fallback.partition ?? 1)
  const mainStat = input.mainStat ?? fallback.mainStat ?? { stat: "hpFlat", value: 2200 }
  return {
    ...(fallback ?? {}),
    ...(input ?? {}),
    id: String(input.id ?? fallback.id ?? discId()),
    setId: String(input.setId ?? fallback.setId ?? "woodpecker_electro"),
    setName: input.setName ?? fallback.setName ?? "",
    partition: Math.max(1, Math.min(6, Number.isFinite(partition) ? partition : 1)),
    rarity: String(input.rarity ?? fallback.rarity ?? "S"),
    level: Math.max(0, Math.min(15, Number(input.level ?? fallback.level ?? 15))),
    maxLevel: Math.max(0, Math.min(15, Number(input.maxLevel ?? fallback.maxLevel ?? 15))),
    mainStat: {
      stat: String(mainStat.stat ?? "hpFlat"),
      value: Number(mainStat.value ?? 0),
      label: mainStat.label,
    },
    subStats: Array.isArray(input.subStats ?? fallback.subStats)
      ? clone(input.subStats ?? fallback.subStats).filter((item: any) => item?.stat)
      : [],
    equippedBy: String(input.equippedBy ?? fallback.equippedBy ?? ""),
    locked: Boolean(input.locked ?? fallback.locked ?? false),
  }
}

function normalizeLoadoutDraft(input: any = {}, fallback: any = {}) {
  const driveDiscIdsBySlot = Object.fromEntries(
    Object.entries(input.driveDiscIdsBySlot ?? input.idsBySlot ?? fallback.driveDiscIdsBySlot ?? {})
      .map(([slot, id]) => [asSlot(slot), String(id ?? "")])
      .filter(([slot, id]) => slot && id),
  )
  return {
    ...(fallback ?? {}),
    ...(input ?? {}),
    id: String(input.id ?? fallback.id ?? loadoutId()),
    name: String(input.name ?? fallback.name ?? "未命名套装"),
    agentId: String(input.agentId ?? fallback.agentId ?? ""),
    driveDiscIdsBySlot,
    source: input.source ?? fallback.source ?? { type: "manual" },
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : fallback.score ?? null,
  }
}

let scanner: ScannerBridge | null = null
let scanPollTimer: ReturnType<typeof setInterval> | null = null
let activeScanTelemetry: ActiveScanTelemetrySession | null = null

function currentScannerVersions(activeScanner: ScannerBridge | null, helperVersion = "", helperProtocolVersion = 0, payload: any = {}) {
  return scanTelemetryVersions({
    helperVersion,
    helperProtocolVersion,
    scannerVersion: activeScanner?.scannerVersion,
    scannerPackageId: activeScanner?.scannerInfo?.packageId,
    scannerPackageMode: activeScanner?.scannerInfo?.packageMode,
    scanner: payload?.scanner,
  })
}

function finishActiveScanTelemetry(eventType: "completed" | "failed" | "cancelled" | "import_failed", input: any = {}) {
  const session = activeScanTelemetry
  activeScanTelemetry = null
  void finishScanTelemetryEvent(session, eventType, input)
}

function numericProgressValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatByteCount(bytes: unknown) {
  const number = Number(bytes)
  if (!Number.isFinite(number) || number < 0) {
    return ""
  }
  const units = ["B", "KB", "MB", "GB"]
  let value = number
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = unitIndex === 0 ? 0 : value >= 100 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

function launcherProgressDisplay(data: any = {}) {
  const downloaded = numericProgressValue(data.bytesDownloaded)
  const total = numericProgressValue(data.totalBytes)
  const speed = numericProgressValue(data.bytesPerSecond)
  const rawPercent = numericProgressValue(data.percent)
  const percent = rawPercent !== null
    ? rawPercent
    : downloaded !== null && total !== null && total > 0
      ? (downloaded / total) * 100
      : null
  const parts: string[] = []
  if (downloaded !== null && total !== null && total > 0) {
    parts.push(`${formatByteCount(downloaded)} / ${formatByteCount(total)}`)
  } else if (downloaded !== null) {
    parts.push(`已下载 ${formatByteCount(downloaded)}`)
  }
  if (percent !== null) {
    parts.push(`${percent.toFixed(1)}%`)
  }
  if (speed !== null && speed > 0) {
    parts.push(`${formatByteCount(speed)}/s`)
  }
  if (Number(data.attempt) > 1 && Number(data.maxAttempts) > 1) {
    parts.push(`第 ${data.attempt}/${data.maxAttempts} 次尝试`)
  }
  const message = data.message || "正在下载 OCR 扫描器..."
  return {
    percent,
    text: parts.length ? `${message} ${parts.join("，")}` : `${message} 首次准备可能需要几分钟...`,
  }
}

export function helperVersionAtLeast(actual = "", required = REQUIRED_HELPER_VERSION) {
  const parse = (value: string) => String(value).split(".").map(part => Number(part) || 0)
  const current = parse(actual)
  const target = parse(required)
  for (let index = 0; index < Math.max(current.length, target.length); index += 1) {
    const left = current[index] ?? 0
    const right = target[index] ?? 0
    if (left !== right) {
      return left > right
    }
  }
  return true
}

export const useInventoryStore = defineStore("inventory", {
  state: () => ({
    store: null as any,
    loading: false,
    error: "",
    slotFilter: 0,
    mainStatFilter: "",
    search: "",
    importPreview: null as any,
    importSummary: null as any,
    scanStatus: "idle" as ScanStatus,
    scanMessage: "",
    scanProgress: null as any,
    scanProgressText: "",
    scanProgressPercent: null as number | null,
    scanClient: "local" as ScanClient,
    scanConnected: false,
    scanPolling: false,
    scanRarityS: true,
    scanRarityA: false,
    scanMaxItems: 0,
    scanStopAtNonLevel15: true,
    scanRemoveMissing: false,
    scanHelperDownloadUrl: HELPER_DOWNLOAD_URL,
    scanHelperMirrorDownloadUrl: HELPER_DOWNLOAD_URL,
    scanSession: null as any,
    scanErrorContext: "" as ScanErrorContext,
    scanHelperVersion: "" as string,
    scanHelperProtocolVersion: 0,
    scanHelperUpgradeMode: "" as ScanHelperUpgradeMode,
    scanHelperUpdateStartedAt: 0,
    scanFailure: null as ScanFailure | null,
    scanDiagnostics: null as any,
  }),
  getters: {
    driveDiscs: state => state.store?.driveDiscs ?? [],
    loadouts: state => state.store?.driveDiscLoadouts ?? [],
    imports: state => state.store?.imports ?? [],
    slotCounts: state => {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      for (const disc of state.store?.driveDiscs ?? []) {
        const slot = Number(disc.partition)
        if (slot >= 1 && slot <= 6) {
          counts[slot] += 1
        }
      }
      return counts
    },
    mainStatOptions(): string[] {
      return [...new Set(this.driveDiscs.map((disc: any) => disc.mainStat?.stat).filter(Boolean) as string[])].sort()
    },
    filteredDriveDiscs(): any[] {
      const needle = this.search.trim().toLowerCase()
      return this.driveDiscs.filter((disc: any) => {
        if (this.slotFilter && Number(disc.partition) !== this.slotFilter) {
          return false
        }
        if (this.mainStatFilter && disc.mainStat?.stat !== this.mainStatFilter) {
          return false
        }
        if (!needle) {
          return true
        }
        return [
          disc.id,
          disc.setName,
          disc.setId,
          disc.mainStat?.label,
          disc.mainStat?.stat,
          ...(disc.subStats ?? []).flatMap((stat: any) => [stat.stat, stat.label]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
      })
    },
    scanCanStart: state => Boolean(state.scanConnected)
      && (state.scanRarityS || state.scanRarityA)
      && !["connecting", "waiting-helper", "preparing", "downloading", "scanning"].includes(state.scanStatus),
    scanPreparing: state => ["connecting", "preparing", "downloading"].includes(state.scanStatus),
    scanWaitingForHelper: state => state.scanStatus === "waiting-helper",
    hasDriveDiscs: state => (state.store?.driveDiscs ?? []).length > 0,
    scanRaritySelected: state => state.scanRarityS || state.scanRarityA,
    scanHelperOutdated: state => Boolean(state.scanHelperVersion) && !helperVersionAtLeast(state.scanHelperVersion),
    scanHelperCanSelfUpdate: state => state.scanHelperProtocolVersion >= 3,
    scanPhase(state): ScanPhase {
      const status = state.scanStatus
      if (status === "scanning" || status === "complete") {
        return "d"
      }
      if (status === "ready") {
        return "c"
      }
      if (status === "preparing" || status === "downloading") {
        return "b"
      }
      if (status === "error") {
        // 保持在最能反映错误发生位置的段位上
        if (state.scanErrorContext === "scan") {
          return "d"
        }
        if (state.scanErrorContext === "prepare") {
          return "b"
        }
        return "a"
      }
      return "a"
    },
    scanErrorVariant(state): ScanErrorVariant | "" {
      if (state.scanStatus === "waiting-helper") {
        return "helper-missing"
      }
      if (state.scanStatus !== "error") {
        return ""
      }
      if (state.scanHelperVersion && !helperVersionAtLeast(state.scanHelperVersion)) {
        return "helper-outdated"
      }
      if (state.scanFailure) {
        return "diagnostic-failure"
      }
      if (state.scanErrorContext === "helper-missing") {
        return "helper-missing"
      }
      if (state.scanErrorContext === "game-not-found") {
        return "game-not-found"
      }
      if (state.scanErrorContext === "scan") {
        return detectGameNotFound(state.scanMessage) ? "game-not-found" : "scan-failed"
      }
      if (state.scanErrorContext === "prepare") {
        return "prepare-failed"
      }
      return "prepare-failed"
    },
  },
  actions: {
    async load() {
      this.loading = true
      this.error = ""
      try {
        this.store = await loadCurrentUserDriveDiscStore()
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    },
    calculatorDriveDiscs(options: any = {}) {
      const selected = new Map<number, any>()
      const mode = options.mode ?? "loadout"
      const resultDiscs = Array.isArray(options.optimizedDriveDiscs) ? options.optimizedDriveDiscs : []
      if (mode === "optimized" && resultDiscs.length) {
        return resultDiscs.map((disc: any) => toCalculatorDriveDisc(disc)).filter(Boolean)
      }
      if (mode === "manual") {
        const idsBySlot = options.idsBySlot ?? {}
        for (const [slot, id] of Object.entries(idsBySlot)) {
          const disc = this.driveDiscs.find((item: any) => item.id === id)
          if (disc) {
            selected.set(Number(slot), disc)
          }
        }
      } else if (mode === "loadout") {
        const loadout = options.loadoutId
          ? this.loadouts.find((item: any) => item.id === options.loadoutId)
          : null
        const idsBySlot = loadout?.driveDiscIdsBySlot ?? loadout?.idsBySlot ?? null
        if (idsBySlot) {
          for (const [slot, id] of Object.entries(idsBySlot)) {
            const disc = this.driveDiscs.find((item: any) => item.id === id)
            if (disc) {
              selected.set(Number(slot), disc)
            }
          }
        }
      }
      if (!selected.size && mode === "auto" && options.autoFill !== false) {
        for (const disc of this.driveDiscs) {
          const slot = Number(disc.partition)
          if (slot >= 1 && slot <= 6 && !selected.has(slot)) {
            selected.set(slot, disc)
          }
        }
      }
      return [...selected.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, disc]) => toCalculatorDriveDisc(disc))
        .filter(Boolean)
    },
    selectedCalculatorDriveDiscs(loadoutId = "") {
      return this.calculatorDriveDiscs({ mode: loadoutId ? "loadout" : "auto", loadoutId })
    },
    discOptionsForSlot(slot: number | string) {
      const slotNumber = Number(slot)
      return this.driveDiscs.filter((disc: any) => Number(disc.partition) === slotNumber)
    },
    async saveDisc(driveDisc: any) {
      this.store = await upsertUserDriveDisc(normalizeDiscDraft(driveDisc))
      await this.load()
    },
    async removeDisc(id: string) {
      const result = await deleteUserDriveDisc(id)
      this.store = result.store
      await this.load()
    },
    async clearCurrentStore() {
      const result = await clearUserDriveDiscStore()
      this.store = result.store
      return result.previous
    },
    async prepareCurrentAccountExport(now = new Date()) {
      const payload = await exportCurrentUserDriveDiscs({ exportedAt: now.toISOString() })
      const accountLabel = String(payload.sourceAccount?.label ?? "account")
      return {
        payload,
        fileName: `zzz-drive-discs-${exportFileSegment(accountLabel)}-${localDateStamp(now)}.json`,
        text: `${JSON.stringify(payload, null, 2)}\n`,
        mimeType: "application/json;charset=utf-8",
      }
    },
    async saveLoadout(loadout: any) {
      const result = await upsertDriveDiscLoadout(normalizeLoadoutDraft(loadout))
      this.store = result.store
      await this.load()
      return result.loadout
    },
    async removeLoadout(id: string) {
      const result = await deleteDriveDiscLoadout(id)
      this.store = result.store
      await this.load()
    },
    async previewImportPayload(payload: any, removeMissing = false, sourcePath = "webapp-paste") {
      this.importPreview = await previewScannerExportImport(payload, { removeMissing, sourcePath })
      return this.importPreview
    },
    async previewImportText(text: string, removeMissing = false) {
      const payload = JSON.parse(text)
      return this.previewImportPayload(payload, removeMissing, "webapp-paste")
    },
    async importScannerPayload(payload: any, removeMissing = false, sourcePath = "webapp-paste") {
      this.importPreview = await previewScannerExportImport(payload, { removeMissing, sourcePath })
      const store = await importScannerExportToStore(payload, { removeMissing, sourcePath })
      this.store = store
      this.importSummary = store.lastImportSummary ?? null
      await this.load()
      return this.importSummary
    },
    async importScannerJson(text: string, removeMissing = false) {
      const payload = JSON.parse(text)
      return this.importScannerPayload(payload, removeMissing, "webapp-paste")
    },
    async importScannerFile(file: File, removeMissing = false) {
      const text = await file.text()
      await this.importScannerJson(text, removeMissing)
    },
    async importScanSession(removeMissing = false) {
      if (!this.scanSession?.payload) {
        throw new Error("没有可导入的扫描结果。")
      }
      const summary = await this.importScannerPayload(this.scanSession.payload, removeMissing, "webapp-scan")
      this.scanSession = {
        ...this.scanSession,
        imported: true,
        importedAt: new Date().toISOString(),
        summary,
      }
      this.scanMessage = "扫描结果已导入仓库"
      return summary
    },
    analyze(catalog: any, input: any, view: "diff" | "substats" | "gains" = "diff") {
      if (view === "substats") {
        return analyzeDriveDiscSubstats(catalog, input)
      }
      if (view === "gains") {
        return analyzeDriveDiscStatGains(catalog, input)
      }
      return analyzeDriveDiscStatDiffs(catalog, input)
    },
    ensureScannerBridge() {
      scanner = scanner ?? new ScannerBridge()
      return scanner
    },
    stopScannerPolling() {
      if (scanPollTimer) {
        clearInterval(scanPollTimer)
        scanPollTimer = null
      }
      this.scanPolling = false
    },
    applyLauncherProgress(progress: any = {}) {
      const stage = progress?.stage || ""
      const downloadProgress = stage === "download" ? launcherProgressDisplay(progress) : null
      const percent = downloadProgress?.percent ?? (stage === "manifest" ? 18
        : stage === "select" ? 24
          : stage === "repair" ? 28
        : stage === "download" ? 34
          : stage === "checksum" ? 68
            : stage === "extract" ? 82
              : stage === "ready" ? 100
                : 20)
      const text = stage === "download"
        ? downloadProgress?.text ?? "正在下载 OCR 扫描器..."
        : progress?.message || "正在准备扫描器..."
      this.scanStatus = stage === "download" ? "downloading" : "preparing"
      this.scanFailure = null
      this.scanProgress = progress
      this.scanProgressPercent = percent
      this.scanProgressText = text
      this.scanMessage = text
    },
    applyHelperUpdateProgress(progress: any = {}) {
      const percent = numericProgressValue(progress.percent)
      this.scanStatus = "downloading"
      this.scanErrorContext = "helper-outdated"
      this.scanFailure = null
      this.scanProgress = progress
      this.scanProgressPercent = percent === null ? 20 : Math.min(100, Math.max(0, percent))
      this.scanProgressText = progress.message || "正在更新扫描助手..."
      this.scanMessage = this.scanProgressText
    },
    bindScannerEvents() {
      const activeScanner = this.ensureScannerBridge()
      activeScanner.onLauncherProgress = (progress: any) => {
        this.applyLauncherProgress(progress)
      }
      activeScanner.onHelperUpdateProgress = (progress: any) => {
        this.applyHelperUpdateProgress(progress)
      }
      activeScanner.onScannerReady = () => {
        this.scanStatus = "ready"
        this.scanFailure = null
        this.scanMessage = "已连接，可以开始扫描"
        this.scanProgressPercent = 100
        this.scanProgressText = "OCR 扫描器已准备"
      }
      activeScanner.onProgress = (progress: any) => {
        const total = Number(progress?.queued) || 1
        const completed = Number(progress?.completed) || 0
        const failed = Number(progress?.failed) || 0
        const percent = total > 0 ? ((completed + failed) / total) * 100 : 0
        this.scanStatus = "scanning"
        this.scanErrorContext = ""
        this.scanFailure = null
        this.scanProgress = progress
        this.scanProgressPercent = Math.min(100, Math.max(0, percent))
        this.scanProgressText = progress?.message ?? `访问 ${progress?.visited ?? 0} / 完成 ${completed} / 失败 ${failed}`
        this.scanMessage = this.scanProgressText
      }
      activeScanner.onComplete = async (payload: any) => {
        this.scanStatus = "complete"
        this.scanFailure = null
        this.scanMessage = "扫描完成，正在导入仓库"
        this.scanProgress = payload
        this.scanProgressPercent = 100
        this.scanProgressText = "扫描完成，正在导入"
        const scanPayload = payload?.items ?? payload
        const scanItems = Array.isArray(scanPayload) ? scanPayload : []
        this.scanSession = {
          payload: scanPayload,
          raw: payload,
          client: this.scanClient,
          completedAt: new Date().toISOString(),
          preview: null,
          error: "",
          imported: false,
        }
        if (!scanItems.length) {
          this.scanMessage = "扫描完成，未扫描到驱动盘"
          this.scanProgressText = "扫描完成"
          finishActiveScanTelemetry("completed", {
            counters: payload,
            versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion, payload),
            diagnostics: payload?.diagnostics,
          })
          return
        }
        try {
          const summary = await this.importScannerPayload(scanPayload, this.scanRemoveMissing, "webapp-scan")
          const preview = this.importPreview
          this.scanSession = {
            ...this.scanSession,
            preview,
            imported: true,
            importedAt: new Date().toISOString(),
            summary,
          }
          this.scanMessage = `扫描导入完成：新增 ${summary?.added ?? 0}，更新 ${summary?.updated ?? 0}，未变 ${summary?.skipped ?? 0}`
          this.scanProgressText = "扫描完成，已导入"
          this.scanRemoveMissing = false
          finishActiveScanTelemetry("completed", {
            counters: payload,
            versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion, payload),
            diagnostics: payload?.diagnostics,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.scanStatus = "error"
          this.scanErrorContext = "scan"
          this.scanSession = {
            ...this.scanSession,
            error: message,
          }
          this.scanMessage = `扫描完成，但导入失败：${message}`
          this.scanProgressText = "导入失败"
          finishActiveScanTelemetry("import_failed", {
            counters: payload,
            failure: { code: "import_failed", phase: "import", message },
            versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion, payload),
            diagnostics: payload?.diagnostics,
          })
        }
      }
      activeScanner.onError = (error: any) => {
        this.stopScannerPolling()
        this.scanStatus = "error"
        this.scanConnected = Boolean(scanner?.connected)
        const message = error?.message ?? String(error ?? "扫描失败")
        finishActiveScanTelemetry(error?.code === "scan_cancelled" ? "cancelled" : "failed", {
          counters: this.scanProgress,
          failure: error,
          diagnostics: error,
          versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion, error),
        })
        if (this.scanHelperOutdated) {
          this.scanFailure = null
          this.scanErrorContext = "helper-outdated"
          this.scanMessage = `当前 Helper ${this.scanHelperVersion} 低于所需版本 ${REQUIRED_HELPER_VERSION}。`
          if (!this.scanHelperCanSelfUpdate) {
            this.scanHelperUpgradeMode = "legacy-manual"
            this.startScannerPolling()
          }
          return
        }
        const failure = normalizeScanFailure(error)
        this.scanFailure = failure
        this.scanMessage = message
        this.scanErrorContext = failure?.code === "game_not_found" || detectGameNotFound(String(message ?? ""))
          ? "game-not-found"
          : failure?.phase === "scan" ? "scan" : "prepare"
      }
      activeScanner.onDiagnostics = (diagnostics: any) => {
        this.scanDiagnostics = diagnostics
      }
      activeScanner.onDisconnect = () => {
        this.scanConnected = false
        if (["legacy-manual", "manual-download", "self-updating", "awaiting-restart"].includes(this.scanHelperUpgradeMode)) {
          return
        }
        if (this.scanStatus === "scanning") {
          finishActiveScanTelemetry("failed", {
            counters: this.scanProgress,
            failure: { code: "scanner_disconnected", phase: "scan", message: "扫描助手连接已断开。" },
            versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
          })
          this.scanStatus = "idle"
          this.scanMessage = "扫描助手已断开"
        }
      }
    },
    async updateOutdatedHelper() {
      const activeScanner = this.ensureScannerBridge()
      if (!activeScanner.connected || !this.scanHelperCanSelfUpdate) {
        this.scanStatus = "error"
        this.scanErrorContext = "helper-outdated"
        this.scanFailure = null
        this.scanHelperUpgradeMode = "legacy-manual"
        this.scanMessage = `Helper ${this.scanHelperVersion || "旧版"} 需要下载新版安装器后完成一次接管升级。`
        if (!this.scanPolling) this.startScannerPolling()
        return
      }

      this.stopScannerPolling()
      this.scanHelperUpgradeMode = "self-updating"
      this.scanHelperUpdateStartedAt = Date.now()
      this.applyHelperUpdateProgress({ stage: "manifest", percent: 8, message: "正在检查 Helper 更新..." })
      try {
        const response = await activeScanner.updateHelper()
        if (!response?.restarting) {
          throw new Error(`更新清单未提供 ${REQUIRED_HELPER_VERSION} 或更高版本，请手动下载最新版。`)
        }
        this.scanHelperUpgradeMode = "awaiting-restart"
        this.scanConnected = false
        this.scanProgressPercent = 100
        this.scanProgressText = `Helper ${response.availableVersion} 已校验，正在重启并重新连接...`
        this.scanMessage = this.scanProgressText
        activeScanner.disconnect()
        this.startScannerPolling()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.stopScannerPolling()
        this.scanStatus = "error"
        this.scanErrorContext = "helper-outdated"
        this.scanFailure = null
        this.scanHelperUpgradeMode = "self-update-failed"
        this.scanProgressPercent = null
        this.scanMessage = `Helper 自动更新失败：${message}`
        this.scanProgressText = ""
      }
    },
    async prepareConnectedScanner(hello: any = {}) {
      const activeScanner = this.ensureScannerBridge()
      this.scanConnected = true
      this.scanStatus = "preparing"
      this.scanErrorContext = ""
      this.scanFailure = null
      this.scanProgress = null
      this.scanProgressPercent = 12
      const helperVersion = String(hello?.version ?? activeScanner.helperVersion ?? "")
      const helperProtocolVersion = Number(hello?.protocolVersion ?? activeScanner.protocolVersion ?? 0)
      this.scanHelperVersion = helperVersion ?? ""
      this.scanHelperProtocolVersion = helperProtocolVersion
      if (this.scanHelperOutdated) {
        this.scanFailure = null
        this.scanErrorContext = "helper-outdated"
        if (["legacy-manual", "manual-download"].includes(this.scanHelperUpgradeMode)) {
          this.scanStatus = "error"
          this.scanProgressPercent = null
          this.scanProgressText = ""
          this.scanMessage = `Helper ${helperVersion || "旧版"} 需要更新到 ${REQUIRED_HELPER_VERSION}。下载后运行安装器，它会自动接管当前旧 Helper。`
          if (!this.scanPolling) this.startScannerPolling()
          return
        }
        if (this.scanHelperUpgradeMode === "awaiting-restart") {
          if (Date.now() - this.scanHelperUpdateStartedAt <= 60_000) {
            this.scanStatus = "downloading"
            this.scanProgressPercent = 100
            this.scanProgressText = "正在等待新版 Helper 启动..."
            this.scanMessage = this.scanProgressText
            activeScanner.disconnect()
            if (!this.scanPolling) this.startScannerPolling()
            return
          }
          this.scanStatus = "error"
          this.scanHelperUpgradeMode = "self-update-failed"
          this.scanProgressPercent = null
          this.scanMessage = "Helper 更新后未能在 60 秒内启动，请重试自动更新或手动下载安装。"
          this.stopScannerPolling()
          return
        }
        if (this.scanHelperCanSelfUpdate) {
          await this.updateOutdatedHelper()
          return
        }
        this.scanStatus = "error"
        this.scanHelperUpgradeMode = "legacy-manual"
        this.scanProgressPercent = null
        this.scanProgressText = ""
        this.scanMessage = `Helper ${helperVersion || "旧版"} 需要更新到 ${REQUIRED_HELPER_VERSION}。下载后运行安装器，它会自动接管当前旧 Helper。`
        if (!this.scanPolling) this.startScannerPolling()
        return
      }

      this.stopScannerPolling()
      this.scanHelperUpgradeMode = ""
      this.scanHelperUpdateStartedAt = 0
      this.scanProgressText = "正在检查扫描器版本..."
      this.scanMessage = "已连接，正在准备 OCR 扫描器..."
      try {
        await activeScanner.ensureScanner()
        this.scanStatus = "ready"
        this.scanProgress = null
        this.scanProgressPercent = null
        this.scanProgressText = ""
        this.scanMessage = `扫描助手已连接${hello?.version ? ` · ${hello.version}` : ""}`
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.scanFailure = normalizeScanFailure(error)
        this.scanStatus = "error"
        this.scanErrorContext = "prepare"
        this.scanProgressPercent = null
        this.scanMessage = message
      }
    },
    async retryHelperUpgrade() {
      if (this.scanHelperCanSelfUpdate) {
        await this.updateOutdatedHelper()
        return
      }
      this.scanHelperUpgradeMode = "legacy-manual"
      this.scanStatus = "error"
      this.scanErrorContext = "helper-outdated"
      if (!this.scanPolling) this.startScannerPolling()
    },
    waitForManualHelperUpgrade() {
      this.scanHelperUpgradeMode = this.scanHelperCanSelfUpdate ? "manual-download" : "legacy-manual"
      this.scanStatus = "error"
      this.scanErrorContext = "helper-outdated"
      this.scanFailure = null
      this.scanMessage = "新版 Helper 下载后请直接运行；安装器确认一次后会自动接管旧版，网页会继续检测。"
      if (!this.scanPolling) this.startScannerPolling()
    },
    startScannerPolling() {
      this.stopScannerPolling()
      this.scanPolling = true
      scanPollTimer = setInterval(async () => {
        const activeScanner = this.ensureScannerBridge()
        this.bindScannerEvents()
        try {
          const hello = await activeScanner.connect()
          await this.prepareConnectedScanner(hello)
        } catch {}
      }, HELPER_POLL_INTERVAL_MS)
    },
    async openScannerPanel() {
      if (scanner?.scanning || (this.scanConnected && this.scanStatus === "ready")) {
        return
      }
      await this.connectScanner()
    },
    closeScannerPanel() {
      this.stopScannerPolling()
      if (scanner && !scanner.scanning) {
        scanner.disconnect()
        scanner = null
        this.scanConnected = false
      }
      if (this.scanStatus !== "complete" && this.scanStatus !== "scanning") {
        this.scanStatus = "idle"
        this.scanMessage = ""
        this.scanProgress = null
        this.scanProgressText = ""
        this.scanProgressPercent = null
        this.scanErrorContext = ""
        this.scanFailure = null
      }
    },
    async connectScanner() {
      const activeScanner = this.ensureScannerBridge()
      this.bindScannerEvents()
      this.stopScannerPolling()
      this.scanStatus = "connecting"
      this.scanErrorContext = ""
      this.scanFailure = null
      this.scanMessage = "正在连接扫描助手"
      this.scanProgress = null
      this.scanProgressText = ""
      this.scanProgressPercent = null
      this.scanConnected = false
      try {
        const hello = await activeScanner.connect()
        await this.prepareConnectedScanner(hello)
      } catch {
        activeScanner.launchHelper()
        this.scanStatus = "waiting-helper"
        this.scanErrorContext = "helper-missing"
        this.scanFailure = null
        this.scanMessage = "未检测到扫描助手。请下载并运行 Helper；如果已安装，浏览器会尝试自动唤起。"
        this.startScannerPolling()
      }
    },
    launchScannerHelper() {
      const activeScanner = this.ensureScannerBridge()
      this.bindScannerEvents()
      activeScanner.launchHelper()
      this.scanConnected = false
      this.scanStatus = "waiting-helper"
      this.scanErrorContext = "helper-missing"
      this.scanFailure = null
      this.scanMessage = "已请求打开扫描助手，正在等待连接..."
      this.startScannerPolling()
    },
    selectedScanRarities() {
      const rarities: string[] = []
      if (this.scanRarityS) {
        rarities.push("S")
      }
      if (this.scanRarityA) {
        rarities.push("A")
      }
      return rarities
    },
    async startScan() {
      const rarities = this.selectedScanRarities()
      if (!rarities.length) {
        this.scanMessage = "请至少选择一个品质"
        return
      }
      if (!scanner?.connected) {
        await this.connectScanner()
      }
      if (!scanner?.connected) {
        return
      }
      try {
        await scanner.ensureScanner()
        const client = SCAN_CLIENTS[this.scanClient] ?? SCAN_CLIENTS.local
        this.scanStatus = "scanning"
        this.scanErrorContext = ""
        this.scanFailure = null
        this.scanMessage = "正在扫描驱动盘"
        this.scanProgress = null
        this.scanProgressText = "准备中..."
        this.scanProgressPercent = 0
        activeScanTelemetry = createScanTelemetrySession({
          client: this.scanClient,
          settings: {
            rarities,
            maxItems: Number(this.scanMaxItems) || 0,
            stopAtNonLevel15: this.scanStopAtNonLevel15,
          },
          versions: currentScannerVersions(scanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
        })
        scanner.startScan({
          maxItems: Number(this.scanMaxItems) || 0,
          rarities,
          stopAtNonLevel15: this.scanStopAtNonLevel15,
          processName: client.processName,
          visualProfileClient: client.visualProfileClient,
          visualProfileQuality: "current",
          fastMode: true,
          captureMode: "dxgi",
          profileRouting: "strict",
          overlapConflictMode: "recover",
          panelAcceptMode: "adaptive-early-full-roi",
          scrollAcceptMode: "early-one-row",
          postScrollPanelAcceptMode: "safe",
          panelMinAcceptFloorMs: 120,
        })
        void startedScanTelemetryEvent(activeScanTelemetry)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        finishActiveScanTelemetry("failed", {
          counters: this.scanProgress,
          failure: { code: "scan_start_failed", phase: "prepare", message },
          versions: currentScannerVersions(scanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
        })
        this.scanFailure = normalizeScanFailure(error)
        this.scanStatus = "error"
        this.scanErrorContext = detectGameNotFound(message) ? "game-not-found" : "prepare"
        this.scanProgressPercent = null
        this.scanMessage = message
      }
    },
    stopScan() {
      scanner?.stopScan()
      this.scanStatus = "ready"
      this.scanErrorContext = ""
      this.scanFailure = null
      this.scanMessage = "已发送停止扫描请求"
      this.scanProgressText = ""
      this.scanProgressPercent = null
    },
    async handleScannerFailureAction(kind: string) {
      const activeScanner = this.ensureScannerBridge()
      if (kind === "open_logs") {
        activeScanner.openLogFolder()
        return
      }
      if (kind === "copy_diagnostics") {
        activeScanner.requestDiagnostics()
        return
      }
      if (kind === "retry_scan" || (kind === "retry" && this.scanFailure?.phase === "scan")) {
        await this.startScan()
        return
      }

      this.scanStatus = "preparing"
      this.scanErrorContext = ""
      this.scanProgressPercent = 12
      this.scanProgressText = kind === "repair" ? "正在重新下载并修复扫描器..." : "正在重新启动扫描器..."
      const shouldResumeScan = kind === "restart_elevated"
      try {
        if (kind === "repair") {
          await activeScanner.repairScanner()
        } else if (kind === "restart_elevated") {
          await activeScanner.restartScannerElevated()
        } else {
          await activeScanner.ensureScanner()
        }
        this.scanStatus = "ready"
        this.scanFailure = null
        this.scanProgressPercent = 100
        this.scanProgressText = "OCR 扫描器已准备"
        if (shouldResumeScan) {
          await this.startScan()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.scanStatus = "error"
        this.scanFailure = normalizeScanFailure(error)
        this.scanErrorContext = this.scanFailure?.phase === "scan" ? "scan" : "prepare"
        this.scanMessage = message
        this.scanProgressPercent = null
      }
    },
    scannerDiagnosticText() {
      return JSON.stringify({
        failure: this.scanFailure,
        helper: this.scanDiagnostics,
        helperVersion: this.scanHelperVersion,
        progress: this.scanProgress,
      }, null, 2)
    },
  },
})
