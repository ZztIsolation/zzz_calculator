import { defineStore } from "pinia"
import {
  clearUserDriveDiscStore,
  deleteDriveDiscLoadout,
  deleteUserDriveDisc,
  importScannerExportToStore,
  loadCurrentUserDriveDiscStore,
  previewScannerExportImport,
  upsertDriveDiscLoadout,
  upsertUserDriveDisc,
} from "@core/local-store.js"
import { toCalculatorDriveDisc } from "@core/drive-disc-core.js"
import { analyzeDriveDiscStatDiffs, analyzeDriveDiscStatGains, analyzeDriveDiscSubstats } from "@core/driveDiscAnalysis-core.js"
import { ScannerBridge } from "@core/scanner-bridge.js"

const HELPER_DOWNLOAD_URL = "https://github.com/ZztIsolation/zzz_calculator/releases/download/scanner-1.0.35/ZZZ-Scanner-Helper.exe?v=1.0.2"
const HELPER_POLL_INTERVAL_MS = 3000
const REQUIRED_HELPER_VERSION = "1.0.2"
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

function helperVersionAtLeast(actual = "", required = REQUIRED_HELPER_VERSION) {
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
      && !["connecting", "waiting-helper", "preparing", "downloading", "scanning"].includes(state.scanStatus),
    scanPreparing: state => ["connecting", "preparing", "downloading"].includes(state.scanStatus),
    scanWaitingForHelper: state => state.scanStatus === "waiting-helper",
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
      } else {
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
      if (!selected.size && options.autoFill !== false) {
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
        : stage === "download" ? 34
          : stage === "checksum" ? 68
            : stage === "extract" ? 82
              : stage === "ready" ? 100
                : 20)
      const text = stage === "download"
        ? downloadProgress?.text ?? "正在下载 OCR 扫描器..."
        : progress?.message || "正在准备扫描器..."
      this.scanStatus = stage === "download" ? "downloading" : "preparing"
      this.scanProgress = progress
      this.scanProgressPercent = percent
      this.scanProgressText = text
      this.scanMessage = text
    },
    bindScannerEvents() {
      const activeScanner = this.ensureScannerBridge()
      activeScanner.onLauncherProgress = (progress: any) => {
        this.applyLauncherProgress(progress)
      }
      activeScanner.onScannerReady = () => {
        this.scanStatus = "ready"
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
        this.scanProgress = progress
        this.scanProgressPercent = Math.min(100, Math.max(0, percent))
        this.scanProgressText = progress?.message ?? `访问 ${progress?.visited ?? 0} / 完成 ${completed} / 失败 ${failed}`
        this.scanMessage = this.scanProgressText
      }
      activeScanner.onComplete = async (payload: any) => {
        this.scanStatus = "complete"
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
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.scanStatus = "error"
          this.scanSession = {
            ...this.scanSession,
            error: message,
          }
          this.scanMessage = `扫描完成，但导入失败：${message}`
          this.scanProgressText = "导入失败"
        }
      }
      activeScanner.onError = (error: any) => {
        this.stopScannerPolling()
        this.scanStatus = "error"
        this.scanConnected = Boolean(scanner?.connected)
        this.scanMessage = error?.message ?? String(error ?? "扫描失败")
      }
      activeScanner.onDisconnect = () => {
        this.scanConnected = false
        if (this.scanStatus === "scanning") {
          this.scanStatus = "idle"
          this.scanMessage = "扫描助手已断开"
        }
      }
    },
    async prepareConnectedScanner(hello: any = {}) {
      const activeScanner = this.ensureScannerBridge()
      this.stopScannerPolling()
      this.scanConnected = true
      this.scanStatus = "preparing"
      this.scanProgress = null
      this.scanProgressPercent = 12
      const helperVersion = activeScanner.helperVersion
      this.scanProgressText = helperVersion && !helperVersionAtLeast(helperVersion)
        ? "正在检查扫描器版本... 当前 Helper 版本较旧，下载进度可能无法显示；请重新下载新版 Helper。"
        : "正在检查扫描器版本..."
      this.scanMessage = "已连接，正在准备 OCR 扫描器..."
      try {
        await activeScanner.ensureScanner()
        this.scanStatus = "ready"
        this.scanProgress = null
        this.scanProgressPercent = null
        this.scanProgressText = ""
        this.scanMessage = `扫描助手已连接${hello?.version ? ` · ${hello.version}` : ""}`
      } catch (error) {
        this.scanStatus = "error"
        this.scanProgressPercent = null
        this.scanMessage = error instanceof Error ? error.message : String(error)
      }
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
      }
    },
    async connectScanner() {
      const activeScanner = this.ensureScannerBridge()
      this.bindScannerEvents()
      this.stopScannerPolling()
      this.scanStatus = "connecting"
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
        this.scanStatus = "error"
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
        this.scanMessage = "正在扫描驱动盘"
        this.scanProgress = null
        this.scanProgressText = "准备中..."
        this.scanProgressPercent = 0
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
      } catch (error) {
        this.scanStatus = "error"
        this.scanProgressPercent = null
        this.scanMessage = error instanceof Error ? error.message : String(error)
      }
    },
    stopScan() {
      scanner?.stopScan()
      this.scanStatus = "ready"
      this.scanMessage = "已发送停止扫描请求"
      this.scanProgressText = ""
      this.scanProgressPercent = null
    },
  },
})
