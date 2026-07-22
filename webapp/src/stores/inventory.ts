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
  normalizeScannerFailure,
  type ScannerFailure,
  type ScannerFailurePhase,
} from "@runtime/scanner-errors"
import {
  createScanTelemetrySession,
  finishScanTelemetryEvent,
  scanTelemetryBrowserContext,
  scanTelemetryVersions,
  startedScanTelemetryEvent,
  type ActiveScanTelemetrySession,
} from "@runtime/scan-telemetry"

const HELPER_DOWNLOAD_URL = "https://download.zzzcaculator.top/downloads/zzz-scanner/helper/1.3.1/ZZZ-Scanner-Helper.exe"
const HELPER_POLL_INTERVAL_MS = 3000
const HELPER_LAUNCH_TIMEOUT_MS = 60_000
export const REQUIRED_HELPER_VERSION = "1.3.1"
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

type ScanStatus = "idle" | "connecting" | "waiting-helper" | "preparing" | "downloading" | "ready" | "scanning" | "stopping" | "complete" | "warning" | "error"
type ScanClient = keyof typeof SCAN_CLIENTS
type ScanPhase = "a" | "b" | "c" | "d"
type ScanErrorContext = "" | "prepare" | "scan" | "helper-missing" | "helper-outdated" | "helper-rejected" | "browser-permission" | "browser-websocket" | "game-not-found"
type ScanErrorVariant = "helper-missing" | "helper-outdated" | "helper-rejected" | "browser-permission" | "browser-websocket" | "prepare-failed" | "scan-failed" | "game-not-found" | "diagnostic-failure"
type ScanHelperUpgradeMode = "" | "legacy-manual" | "manual-download" | "self-updating" | "awaiting-restart" | "confirming" | "self-update-failed"

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
let helperLaunchTimer: ReturnType<typeof setTimeout> | null = null
let activeScanTelemetry: ActiveScanTelemetrySession | null = null
let lastFailureTelemetryKey = ""
let lastFailureTelemetryAt = 0

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
    scanRunNonce: 0,
    scanTerminalHandledNonce: -1,
    scanErrorContext: "" as ScanErrorContext,
    scanHelperVersion: "" as string,
    scanHelperProtocolVersion: 0,
    scanScannerVersion: "" as string,
    scanHelperUpgradeMode: "" as ScanHelperUpgradeMode,
    scanHelperUpdateStartedAt: 0,
    scanFailure: null as ScannerFailure | null,
    scanDiagnostics: null as any,
    scanLastHeartbeatAt: 0,
    scanLastProgressAt: 0,
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
      && !["connecting", "waiting-helper", "preparing", "downloading", "scanning", "stopping"].includes(state.scanStatus),
    scanPreparing: state => ["connecting", "preparing", "downloading"].includes(state.scanStatus),
    scanWaitingForHelper: state => state.scanStatus === "waiting-helper",
    hasDriveDiscs: state => (state.store?.driveDiscs ?? []).length > 0,
    scanRaritySelected: () => true,
    scanHelperOutdated: state => Boolean(state.scanHelperVersion) && !helperVersionAtLeast(state.scanHelperVersion),
    scanHelperCanSelfUpdate: state => state.scanHelperProtocolVersion >= 3,
    scanPhase(state): ScanPhase {
      const status = state.scanStatus
      if (["scanning", "stopping", "complete", "warning"].includes(status)) {
        return "d"
      }
      if (status === "ready") {
        return "c"
      }
      if (status === "preparing" || status === "downloading") {
        return "b"
      }
      if (status === "error" || status === "warning") {
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
      if (state.scanStatus === "waiting-helper" && state.scanErrorContext === "helper-missing") {
        return "helper-missing"
      }
      if (state.scanStatus !== "error" && state.scanStatus !== "warning") {
        return ""
      }
      if (state.scanHelperVersion && !helperVersionAtLeast(state.scanHelperVersion)) {
        return "helper-outdated"
      }
      if (state.scanErrorContext === "browser-permission") {
        return "browser-permission"
      }
      if (state.scanErrorContext === "browser-websocket") {
        return "browser-websocket"
      }
      if (state.scanErrorContext === "helper-rejected") {
        return "helper-rejected"
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
    async previewImportPayload(payload: any, removeMissing = false, sourcePath = "webapp-paste", removeMissingRarities: string[] | null = null) {
      this.importPreview = await previewScannerExportImport(payload, { removeMissing, sourcePath, removeMissingRarities })
      return this.importPreview
    },
    async previewImportText(text: string, removeMissing = false) {
      const payload = JSON.parse(text)
      return this.previewImportPayload(payload, removeMissing, "webapp-paste")
    },
    async importScannerPayload(payload: any, removeMissing = false, sourcePath = "webapp-paste", removeMissingRarities: string[] | null = null) {
      // Scanner exports are JSON data. Snapshotting here strips Vue proxies before IndexedDB cloning.
      const importPayload = JSON.parse(JSON.stringify(payload))
      const importOptions = { removeMissing, sourcePath, removeMissingRarities }
      this.importPreview = await previewScannerExportImport(importPayload, importOptions)
      const store = await importScannerExportToStore(importPayload, importOptions)
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
      if (helperLaunchTimer) {
        clearTimeout(helperLaunchTimer)
        helperLaunchTimer = null
      }
      this.scanPolling = false
    },
    recordScannerFailure(failure: ScannerFailure) {
      const telemetryKey = `${failure.code}:${failure.phase}:${failure.diagnosticId}`
      const now = Date.now()
      if (telemetryKey === lastFailureTelemetryKey && now - lastFailureTelemetryAt < 2000) return
      lastFailureTelemetryKey = telemetryKey
      lastFailureTelemetryAt = now
      const activeScanner = this.ensureScannerBridge()
      if (activeScanTelemetry) {
        finishActiveScanTelemetry(failure.code === "scan_cancelled" ? "cancelled" : "failed", {
          counters: this.scanProgress,
          failure,
          diagnostics: { ...failure.details, lastHeartbeatAt: this.scanLastHeartbeatAt, lastProgressAt: this.scanLastProgressAt },
          versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
        })
        return
      }
      const session = createScanTelemetrySession({
        client: this.scanClient,
        settings: {
          rarities: this.selectedScanRarities(),
          maxItems: Number(this.scanMaxItems) || 0,
          stopAtNonLevel15: this.scanStopAtNonLevel15,
        },
        versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
      })
      void finishScanTelemetryEvent(session, "failed", {
        failure,
        diagnostics: {
          ...failure.details,
          connectionStage: String(failure.details?.connectionStage ?? failure.phase),
          permissionName: String(failure.details?.permissionName ?? ""),
          permissionState: String(failure.details?.permissionState ?? "unknown"),
          bridgeMode: String(activeScanner.mode ?? ""),
          lastHeartbeatAt: this.scanLastHeartbeatAt,
          lastProgressAt: this.scanLastProgressAt,
          ...scanTelemetryBrowserContext(),
        },
        versions: currentScannerVersions(activeScanner, this.scanHelperVersion, this.scanHelperProtocolVersion),
      })
    },
    applyScannerFailure(
      value: unknown,
      fallback: { phase?: ScannerFailurePhase; code?: string; context?: ScanErrorContext } = {},
    ) {
      const failure = normalizeScannerFailure(value, fallback)
      this.stopScannerPolling()
      this.scanStatus = failure.severity === "warning" ? "warning" : "error"
      this.scanFailure = failure
      this.scanMessage = failure.message
      this.scanProgressText = failure.message
      this.scanProgressPercent = null
      this.scanErrorContext = fallback.context
        ?? (failure.code === "game_not_found" ? "game-not-found"
          : failure.phase === "scan" || failure.phase === "import" ? "scan"
            : failure.phase === "connect" ? "helper-missing" : "prepare")
      this.recordScannerFailure(failure)
      return failure
    },
    applyTerminalScannerConnectionError(error: any) {
      const contextByCode: Record<string, ScanErrorContext> = {
        loopback_permission_denied: "browser-permission",
        helper_websocket_blocked: "browser-websocket",
        helper_connection_timeout: "browser-websocket",
        helper_origin_rejected: "helper-rejected",
      }
      const code = String(error?.code ?? "")
      const context = contextByCode[code]
      if (!context) return false

      this.scanConnected = false
      this.scanProgress = null
      this.applyScannerFailure(error, { phase: "connect", context })
      return true
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
    async finalizeScanTerminal(payload: any, terminalError: any = null) {
      if (this.scanRunNonce > 0 && this.scanTerminalHandledNonce === this.scanRunNonce) return
      this.scanTerminalHandledNonce = this.scanRunNonce

      const envelope = Array.isArray(payload) ? { items: payload } : (payload ?? {})
      const hasResultArray = Array.isArray(payload)
        || Array.isArray(envelope.items)
        || Array.isArray(envelope.retainedItems)
      if (!terminalError && !hasResultArray) {
        this.applyScannerFailure({
          code: "scan_result_invalid",
          phase: "scan",
          details: { payloadType: typeof payload },
        }, { phase: "scan", context: "scan" })
        return
      }
      const retainedItems = Array.isArray(envelope.items)
        ? envelope.items
        : Array.isArray(envelope.retainedItems) ? envelope.retainedItems : []
      const failedCount = Math.max(0, Number(envelope.failed) || 0)
      const streamIncomplete = Boolean(envelope.streamIncomplete)
      const partial = Boolean(terminalError || envelope.partial || failedCount > 0 || streamIncomplete)
      const terminalCode = String(terminalError?.code ?? envelope.terminationCode ?? "")
      const requestedRemoveMissing = this.scanRemoveMissing

      this.scanProgress = envelope
      this.scanProgressPercent = 100
      this.scanSession = {
        payload: retainedItems,
        raw: envelope,
        client: this.scanClient,
        completedAt: new Date().toISOString(),
        preview: null,
        error: terminalError?.message ?? "",
        imported: false,
        partial,
        terminalCode,
        requestedRemoveMissing,
      }

      if (!retainedItems.length) {
        this.scanRemoveMissing = false
        if (partial) {
          const failure = terminalError ?? {
            code: streamIncomplete ? "scan_result_stream_incomplete" : "scan_partial_failure",
            phase: "scan",
            severity: "warning",
            message: "扫描未完整结束，且没有可安全导入的结果。",
          }
          this.applyScannerFailure(failure, { phase: "scan", context: "scan" })
          return
        }

        this.scanStatus = "complete"
        this.scanFailure = null
        this.scanErrorContext = ""
        this.scanMessage = "扫描完成，未扫描到驱动盘"
        this.scanProgressText = "扫描完成"
        finishActiveScanTelemetry("completed", {
          counters: envelope,
          versions: currentScannerVersions(scanner, this.scanHelperVersion, this.scanHelperProtocolVersion, envelope),
          diagnostics: envelope?.diagnostics,
        })
        return
      }

      this.scanStatus = partial ? "warning" : "complete"
      this.scanFailure = null
      this.scanErrorContext = ""
      this.scanMessage = partial ? "扫描未完整结束，正在安全导入已识别结果" : "扫描完成，正在导入仓库"
      this.scanProgressText = this.scanMessage
      try {
        const removeMissing = partial ? false : requestedRemoveMissing
        const sourcePath = partial ? "webapp-scan-partial" : "webapp-scan"
        const summary = await this.importScannerPayload(retainedItems, removeMissing, sourcePath, removeMissing ? ["S"] : null)
        this.scanSession = {
          ...this.scanSession,
          preview: this.importPreview,
          imported: true,
          importedAt: new Date().toISOString(),
          summary,
        }
        this.scanRemoveMissing = false

        if (partial) {
          const baseFailure = terminalError ?? {
            code: streamIncomplete ? "scan_result_stream_incomplete" : "scan_partial_failure",
            phase: "scan",
            severity: "warning",
            message: failedCount > 0
              ? `扫描已结束，但有 ${failedCount} 个驱动盘识别失败。`
              : terminalCode === "non_level_15_stop"
                ? "检测到非 15 级驱动盘，扫描已按设置停止。"
                : "扫描未完整结束。",
          }
          const originalMessage = String(baseFailure.message ?? "扫描未完整结束。")
          this.applyScannerFailure({
            ...baseFailure,
            phase: "scan",
            severity: "warning",
            message: `${originalMessage} 已安全导入 ${retainedItems.length} 件，未删除缺失。`,
            details: {
              ...(baseFailure.details ?? {}),
              retained: retainedItems.length,
              failed: failedCount,
              streamIncomplete,
              terminationCode: terminalCode,
            },
          }, { phase: "scan", context: "scan" })
          this.scanProgress = envelope
          this.scanProgressPercent = 100
          this.scanProgressText = `已安全导入 ${retainedItems.length} 件，未删除缺失`
          this.scanMessage = this.scanProgressText
          return
        }

        this.scanStatus = "complete"
        this.scanMessage = `扫描导入完成：新增 ${summary?.added ?? 0}，更新 ${summary?.updated ?? 0}，未变 ${summary?.skipped ?? 0}`
        this.scanProgressText = "扫描完成，已导入"
        finishActiveScanTelemetry("completed", {
          counters: envelope,
          versions: currentScannerVersions(scanner, this.scanHelperVersion, this.scanHelperProtocolVersion, envelope),
          diagnostics: envelope?.diagnostics,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.scanSession = { ...this.scanSession, error: message }
        this.applyScannerFailure({
          code: "import_failed",
          phase: "import",
          details: { ...(envelope?.diagnostics ?? {}), importMessage: message, retained: retainedItems.length },
        }, { phase: "import", context: "scan" })
      }
    },
    bindScannerEvents() {
      const activeScanner = this.ensureScannerBridge()
      activeScanner.onLauncherProgress = (progress: any) => {
        this.applyLauncherProgress(progress)
      }
      activeScanner.onHelperUpdateProgress = (progress: any) => {
        this.applyHelperUpdateProgress(progress)
      }
      activeScanner.onScannerReady = (scannerInfo: any = {}) => {
        this.scanScannerVersion = String(
          scannerInfo?.version ?? scannerInfo?.appVersion ?? activeScanner.scannerVersion ?? this.scanScannerVersion,
        )
        this.scanStatus = "ready"
        this.scanFailure = null
        this.scanErrorContext = ""
        this.scanMessage = "已连接，可以开始扫描"
        this.scanProgressPercent = 100
        this.scanProgressText = "OCR 扫描器已准备"
      }
      activeScanner.onHeartbeat = () => {
        this.scanLastHeartbeatAt = Date.now()
      }
      activeScanner.onStopAck = () => {
        this.scanStatus = "stopping"
        this.scanMessage = "Scanner 已收到停止请求，正在安全结束..."
        this.scanProgressText = this.scanMessage
      }
      activeScanner.onProgress = (progress: any) => {
        const total = Number(progress?.queued) || 1
        const completed = Number(progress?.completed) || 0
        const failed = Number(progress?.failed) || 0
        const percent = total > 0 ? ((completed + failed) / total) * 100 : 0
        this.scanStatus = "scanning"
        this.scanErrorContext = ""
        this.scanFailure = null
        this.scanLastHeartbeatAt = Date.now()
        this.scanLastProgressAt = Date.now()
        this.scanProgress = progress
        this.scanProgressPercent = Math.min(100, Math.max(0, percent))
        this.scanProgressText = progress?.message ?? `访问 ${progress?.visited ?? 0} / 完成 ${completed} / 失败 ${failed}`
        this.scanMessage = this.scanProgressText
      }
      activeScanner.onComplete = async (payload: any) => this.finalizeScanTerminal(payload)
      activeScanner.onError = async (error: any) => {
        this.scanConnected = Boolean(scanner?.connected)
        if (this.scanHelperOutdated) {
          this.applyScannerFailure({
            code: "helper_outdated",
            phase: "helper",
            message: `当前 Helper ${this.scanHelperVersion} 低于所需版本 ${REQUIRED_HELPER_VERSION}。`,
          }, { phase: "helper", context: "helper-outdated" })
          if (!this.scanHelperCanSelfUpdate) {
            this.scanHelperUpgradeMode = "legacy-manual"
            this.startScannerPolling()
          }
          return
        }
        await this.finalizeScanTerminal(error, error)
      }
      activeScanner.onDiagnostics = (diagnostics: any) => {
        this.scanDiagnostics = diagnostics
      }
      activeScanner.onDisconnect = async (error: any) => {
        this.scanConnected = false
        if (["legacy-manual", "manual-download", "self-updating", "awaiting-restart"].includes(this.scanHelperUpgradeMode)) {
          return
        }
        const duringScan = ["scanning", "stopping"].includes(this.scanStatus)
          || Array.isArray(error?.retainedItems) && error.retainedItems.length > 0
        if (duringScan) {
          await this.finalizeScanTerminal(error, error ?? { code: "helper_disconnected", phase: "scan" })
          return
        }
        this.applyScannerFailure(error ?? { code: "helper_disconnected" }, { phase: "helper", context: "helper-missing" })
      }
    },
    async updateOutdatedHelper() {
      const activeScanner = this.ensureScannerBridge()
      if (!activeScanner.connected || !this.scanHelperCanSelfUpdate) {
        this.scanHelperUpgradeMode = "legacy-manual"
        this.applyScannerFailure({
          code: "helper_outdated",
          phase: "helper",
          message: `Helper ${this.scanHelperVersion || "旧版"} 需要下载新版安装器后完成一次接管升级。`,
        }, { phase: "helper", context: "helper-outdated" })
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
        this.scanHelperUpgradeMode = "self-update-failed"
        this.applyScannerFailure({
          ...(error && typeof error === "object" ? error : {}),
          code: "helper_update_failed",
          phase: "helper",
          message: `Helper 自动更新失败：${message}`,
        }, { phase: "helper", context: "helper-outdated" })
      }
    },
    async confirmPendingHelperUpdate(hello: any = {}) {
      const activeScanner = this.ensureScannerBridge()
      const helperUpdate = hello?.helperUpdate ?? activeScanner.helperUpdate
      if (helperUpdate?.state !== "pending_confirmation" || !helperUpdate?.transactionId) {
        return true
      }

      this.scanHelperUpgradeMode = "confirming"
      this.scanStatus = "preparing"
      this.scanProgressPercent = 100
      this.scanProgressText = "新版 Helper 已启动，正在确认更新..."
      this.scanMessage = this.scanProgressText
      try {
        const diagnostics = await activeScanner.getDiagnostics()
        const diagnosticVersion = String(diagnostics?.helperVersion ?? "")
        const diagnosticProtocol = Number(diagnostics?.protocolVersion ?? 0)
        if (!helperVersionAtLeast(diagnosticVersion) || diagnosticProtocol < 4) {
          throw new Error(`新版 Helper 自检返回异常版本 ${diagnosticVersion || "unknown"} / 协议 ${diagnosticProtocol || "unknown"}。`)
        }
        const result = await activeScanner.confirmHelperUpdate(String(helperUpdate.transactionId))
        if (!result?.committed || result?.transactionId !== helperUpdate.transactionId) {
          throw new Error("Helper 更新事务未被确认。")
        }
        this.scanProgressText = "Helper 更新已确认，正在准备 OCR 扫描器..."
        this.scanMessage = this.scanProgressText
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.scanHelperUpgradeMode = "self-update-failed"
        this.applyScannerFailure({
          ...(error && typeof error === "object" ? error : {}),
          code: "helper_update_confirmation_failed",
          phase: "helper",
          message: `Helper 更新确认失败：${message}`,
          remedy: "旧版 Helper 会自动恢复；请等待片刻后重试自动更新。",
        }, { phase: "helper", context: "helper-outdated" })
        return false
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
      this.scanScannerVersion = String(
        hello?.scanner?.version ?? hello?.scanner?.appVersion ?? activeScanner.scannerVersion ?? this.scanScannerVersion,
      )
      if (this.scanHelperOutdated) {
        this.scanErrorContext = "helper-outdated"
        if (["legacy-manual", "manual-download"].includes(this.scanHelperUpgradeMode)) {
          this.applyScannerFailure({
            code: "helper_outdated",
            phase: "helper",
            message: `Helper ${helperVersion || "旧版"} 需要更新到 ${REQUIRED_HELPER_VERSION}。下载后运行安装器，它会自动接管当前旧 Helper。`,
          }, { phase: "helper", context: "helper-outdated" })
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
          this.scanHelperUpgradeMode = "self-update-failed"
          this.applyScannerFailure({
            code: "helper_update_failed",
            phase: "helper",
            message: "Helper 更新后未能在 60 秒内启动。",
          }, { phase: "helper", context: "helper-outdated" })
          return
        }
        if (this.scanHelperUpgradeMode === "self-update-failed") {
          this.applyScannerFailure({
            code: "helper_update_failed",
            phase: "helper",
            message: "Helper 自动更新未完成，旧版 Helper 已恢复或正在恢复。",
          }, { phase: "helper", context: "helper-outdated" })
          return
        }
        if (this.scanHelperCanSelfUpdate) {
          await this.updateOutdatedHelper()
          return
        }
        this.scanHelperUpgradeMode = "legacy-manual"
        this.applyScannerFailure({
          code: "helper_outdated",
          phase: "helper",
          message: `Helper ${helperVersion || "旧版"} 需要更新到 ${REQUIRED_HELPER_VERSION}。下载后运行安装器，它会自动接管当前旧 Helper。`,
        }, { phase: "helper", context: "helper-outdated" })
        if (!this.scanPolling) this.startScannerPolling()
        return
      }

      if (!await this.confirmPendingHelperUpdate(hello)) {
        return
      }

      this.stopScannerPolling()
      this.scanHelperUpgradeMode = ""
      this.scanHelperUpdateStartedAt = 0
      this.scanProgressText = "正在检查扫描器版本..."
      this.scanMessage = "已连接，正在准备 OCR 扫描器..."
      try {
        const scannerInfo = await activeScanner.ensureScanner()
        this.scanScannerVersion = String(
          scannerInfo?.version ?? scannerInfo?.appVersion ?? activeScanner.scannerVersion ?? this.scanScannerVersion,
        )
        this.scanStatus = "ready"
        this.scanProgress = null
        this.scanProgressPercent = null
        this.scanProgressText = ""
        this.scanMessage = `扫描助手已连接${hello?.version ? ` · ${hello.version}` : ""}`
      } catch (error) {
        this.applyScannerFailure(error, { phase: "prepare", context: "prepare" })
      }
    },
    async retryHelperUpgrade() {
      if (this.scanHelperCanSelfUpdate) {
        await this.updateOutdatedHelper()
        return
      }
      this.scanHelperUpgradeMode = "legacy-manual"
      this.applyScannerFailure({ code: "helper_outdated", phase: "helper" }, { phase: "helper", context: "helper-outdated" })
      if (!this.scanPolling) this.startScannerPolling()
    },
    waitForManualHelperUpgrade() {
      this.scanHelperUpgradeMode = this.scanHelperCanSelfUpdate ? "manual-download" : "legacy-manual"
      this.applyScannerFailure({
        code: "helper_outdated",
        phase: "helper",
        message: "新版 Helper 下载后请直接运行；安装器确认一次后会自动接管旧版。",
      }, { phase: "helper", context: "helper-outdated" })
      if (!this.scanPolling) this.startScannerPolling()
    },
    startScannerPolling(options: { launchDeadline?: boolean } = {}) {
      this.stopScannerPolling()
      this.scanPolling = true
      scanPollTimer = setInterval(async () => {
        const activeScanner = this.ensureScannerBridge()
        this.bindScannerEvents()
        try {
          const hello = await activeScanner.connect()
          await this.prepareConnectedScanner(hello)
        } catch (error) {
          this.applyTerminalScannerConnectionError(error)
        }
      }, HELPER_POLL_INTERVAL_MS)
      if (options.launchDeadline) {
        helperLaunchTimer = setTimeout(() => {
          this.scanConnected = false
          this.applyScannerFailure({ code: "helper_launch_timeout", phase: "connect" }, {
            phase: "connect",
            context: "helper-missing",
          })
        }, HELPER_LAUNCH_TIMEOUT_MS)
      }
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
      lastFailureTelemetryKey = ""
      try {
        const hello = await activeScanner.connect()
        await this.prepareConnectedScanner(hello)
      } catch (error) {
        if (this.applyTerminalScannerConnectionError(error)) {
          return
        }
        activeScanner.launchHelper()
        this.scanStatus = "waiting-helper"
        this.scanErrorContext = "helper-missing"
        this.scanFailure = null
        this.scanMessage = "未检测到扫描助手。请下载并运行 Helper；如果已安装，浏览器会尝试自动唤起。"
        this.startScannerPolling({ launchDeadline: true })
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
      this.startScannerPolling({ launchDeadline: true })
    },
    selectedScanRarities() {
      return ["S"]
    },
    async startScan() {
      const rarities = this.selectedScanRarities()
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
        this.scanLastHeartbeatAt = Date.now()
        this.scanLastProgressAt = Date.now()
        this.scanRunNonce += 1
        this.scanTerminalHandledNonce = -1
        lastFailureTelemetryKey = ""
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
        this.applyScannerFailure({
          ...(error && typeof error === "object" ? error : {}),
          code: (error as any)?.code || "prepare_failed",
          phase: (error as any)?.phase || "prepare",
          message,
        }, {
          phase: "prepare",
          context: detectGameNotFound(message) ? "game-not-found" : "prepare",
        })
      }
    },
    stopScan() {
      scanner?.stopScan()
      this.scanStatus = "stopping"
      this.scanErrorContext = ""
      this.scanFailure = null
      this.scanMessage = "已发送停止请求，正在等待 Scanner 安全结束..."
      this.scanProgressText = this.scanMessage
    },
    async importRetainedScan(partial = false) {
      const payload = this.scanSession?.payload
      if (!Array.isArray(payload)) {
        this.applyScannerFailure({ code: "scan_result_invalid", phase: "scan" }, { phase: "scan" })
        return
      }
      try {
        const safePartial = partial || Boolean(this.scanSession?.partial)
        const removeMissing = safePartial ? false : Boolean(this.scanSession?.requestedRemoveMissing)
        const summary = await this.importScannerPayload(
          payload,
          removeMissing,
          safePartial ? "webapp-scan-partial" : "webapp-scan-retry",
          removeMissing ? ["S"] : null,
        )
        this.scanSession = {
          ...this.scanSession,
          preview: this.importPreview,
          imported: true,
          importedAt: new Date().toISOString(),
          summary,
          error: "",
        }
        this.scanStatus = "complete"
        this.scanFailure = null
        this.scanErrorContext = ""
        this.scanProgressPercent = 100
        this.scanProgressText = safePartial ? "已导入可识别结果，未删除缺失" : "扫描完成，已导入"
        this.scanMessage = safePartial
          ? `已安全导入可识别结果：新增 ${summary?.added ?? 0}，更新 ${summary?.updated ?? 0}，未删除缺失`
          : `扫描结果重新导入完成：新增 ${summary?.added ?? 0}，更新 ${summary?.updated ?? 0}`
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.scanSession = { ...this.scanSession, error: message }
        this.applyScannerFailure({
          code: "import_failed",
          phase: "import",
          details: { importMessage: message },
        }, {
          phase: "import",
          context: "scan",
        })
      }
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
      if (kind === "download_helper") {
        window.open(this.scanHelperDownloadUrl, "_blank")
        return
      }
      if (kind === "retry_connect") {
        await this.connectScanner()
        return
      }
      if (kind === "update_helper") {
        await this.retryHelperUpgrade()
        return
      }
      if (kind === "retry_import") {
        await this.importRetainedScan(false)
        return
      }
      if (kind === "import_partial") {
        await this.importRetainedScan(true)
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
        this.applyScannerFailure(error, { phase: kind === "restart_elevated" ? "scan" : "prepare" })
      }
    },
    scannerDiagnosticText() {
      return JSON.stringify({
        failure: this.scanFailure,
        helper: this.scanDiagnostics,
        helperVersion: this.scanHelperVersion,
        progress: this.scanProgress,
        lastHeartbeatAt: this.scanLastHeartbeatAt,
        lastProgressAt: this.scanLastProgressAt,
      }, null, 2)
    },
  },
})
