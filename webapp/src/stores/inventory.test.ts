import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const scannerMockState = vi.hoisted(() => ({
  instances: [] as any[],
  connectResults: [] as any[],
  ensureResults: [] as any[],
  updateResults: [] as any[],
}))

vi.mock("@runtime/scanner-bridge.js", () => {
  class MockScannerBridge {
    onProgress: ((payload: any) => void) | null = null
    onLauncherProgress: ((payload: any) => void) | null = null
    onScannerReady: ((payload: any) => void) | null = null
    onItem: ((payload: any) => void) | null = null
    onComplete: ((payload: any) => void) | null = null
    onError: ((payload: any) => void) | null = null
    onDiagnostics: ((payload: any) => void) | null = null
    onHelperUpdateProgress: ((payload: any) => void) | null = null
    onDisconnect: (() => void) | null = null
    connected = false
    scanning = false
    mode = "helper"
    helperVersion = "1.2.1"
    protocolVersion = 3
    connectCalls = 0
    ensureCalls = 0
    updateCalls = 0
    repairCalls = 0
    elevatedCalls = 0
    openLogCalls = 0
    diagnosticsCalls = 0
    launchCalls = 0
    disconnectCalls = 0
    stopCalls = 0
    startScanPayloads: any[] = []

    constructor() {
      scannerMockState.instances.push(this)
    }

    async connect() {
      this.connectCalls += 1
      const result = scannerMockState.connectResults.shift()
      if (result instanceof Error) {
        throw result
      }
      const hello = await (result ?? { version: this.helperVersion })
      this.helperVersion = String(hello?.version ?? this.helperVersion)
      this.protocolVersion = Number(hello?.protocolVersion ?? this.protocolVersion)
      this.connected = true
      return hello
    }

    launchHelper() {
      this.launchCalls += 1
    }

    async ensureScanner() {
      this.ensureCalls += 1
      const result = scannerMockState.ensureResults.shift()
      if (result instanceof Error) {
        throw result
      }
      return await result
    }

    async updateHelper() {
      this.updateCalls += 1
      const result = scannerMockState.updateResults.shift()
      if (result instanceof Error) throw result
      return await (result ?? { updateAvailable: true, availableVersion: "1.2.1", restarting: true })
    }

    async repairScanner() {
      this.repairCalls += 1
    }

    async restartScannerElevated() {
      this.elevatedCalls += 1
    }

    openLogFolder() {
      this.openLogCalls += 1
    }

    requestDiagnostics() {
      this.diagnosticsCalls += 1
      this.onDiagnostics?.({ helperVersion: this.helperVersion })
    }

    disconnect() {
      this.disconnectCalls += 1
      this.connected = false
      this.scanning = false
    }

    startScan(options?: any) {
      this.scanning = true
      this.startScanPayloads.push(options)
    }

    stopScan() {
      this.stopCalls += 1
      this.scanning = false
    }
  }

  return { ScannerBridge: MockScannerBridge }
})

import { useInventoryStore } from "@/stores/inventory"

function scannerDisc(sequence: number, overrides: any = {}) {
  return {
    "序号": sequence,
    "名称": overrides.setName ?? "流光咏叹",
    "槽位": overrides.partition ?? 1,
    "品质": overrides.rarity ?? "S",
    "等级": overrides.level ?? 15,
    "最大等级": overrides.maxLevel ?? 15,
    "主属性": overrides.mainStat ?? { "生命值": 2200 },
    "副属性": overrides.subStats ?? [
      { "攻击力": "6%" },
      { "暴击率": "4.8%" },
      { "暴击伤害": "14.4%" },
    ],
  }
}

describe("inventory store", () => {
  beforeEach(() => {
    vi.useRealTimers()
    setActivePinia(createPinia())
    const store = useInventoryStore()
    store.stopScan()
    store.closeScannerPanel()
    scannerMockState.instances.length = 0
    scannerMockState.connectResults.length = 0
    scannerMockState.ensureResults.length = 0
    scannerMockState.updateResults.length = 0
    localStorage.clear()
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [{ id: "default", label: "默认用户" }],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }))
  })

  afterEach(() => {
    const store = useInventoryStore()
    store.stopScan()
    store.closeScannerPanel()
    vi.useRealTimers()
  })

  it("saves drive discs and loadouts through the existing local-store schema", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "disc-a",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 4,
      mainStat: { stat: "critRate", value: 24 },
      subStats: [{ stat: "critDmg", value: 12 }],
      level: 15,
    })
    await store.saveLoadout({
      id: "loadout-a",
      name: "测试套装",
      agentId: "agent-a",
      driveDiscIdsBySlot: { "4": "disc-a" },
    })

    expect(store.driveDiscs).toHaveLength(1)
    expect(store.loadouts).toHaveLength(1)
    expect(store.calculatorDriveDiscs({ mode: "loadout", loadoutId: "loadout-a", autoFill: false })).toHaveLength(1)

    await store.removeDisc("disc-a")
    expect(store.driveDiscs).toHaveLength(0)
    expect(store.loadouts[0].status).toBe("incomplete")
  })

  it("does not auto-fill explicit manual or loadout selections", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "disc-slot-1",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
      level: 15,
    })
    await store.saveDisc({
      id: "disc-slot-2",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 2,
      mainStat: { stat: "atkFlat", value: 316 },
      subStats: [],
      level: 15,
    })

    expect(store.calculatorDriveDiscs({ mode: "manual" })).toEqual([])
    expect(store.calculatorDriveDiscs({ mode: "loadout" })).toEqual([])
    expect(store.calculatorDriveDiscs({ mode: "manual", idsBySlot: { "2": "disc-slot-2" } }).map((disc: any) => disc.id)).toEqual(["disc-slot-2"])
    expect(store.calculatorDriveDiscs({ mode: "auto" }).map((disc: any) => disc.id)).toEqual(["disc-slot-1", "disc-slot-2"])
  })

  it("previews scanner imports with a real diff before writing", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "manual-disc",
      setId: "manual",
      setName: "手动盘",
      partition: 6,
      mainStat: { stat: "critRate", value: 24 },
      subStats: [],
      level: 15,
    })

    const firstPayload = JSON.stringify([scannerDisc(1)])
    const firstPreview = await store.previewImportText(firstPayload, false)
    expect(firstPreview.summary.added).toBe(1)
    expect(firstPreview.summary.removed).toBe(0)
    expect(firstPreview.added[0].partition).toBe(1)

    await store.importScannerJson(firstPayload, false)
    const removePreview = await store.previewImportText(firstPayload, true)
    expect(removePreview.summary.skipped).toBe(1)
    expect(removePreview.summary.removed).toBe(1)
    expect(removePreview.removed.map((disc: any) => disc.id)).toContain("manual-disc")
  })

  it("automatically imports a completed scan session", async () => {
    const store = useInventoryStore()
    await store.load()
    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await store.openScannerPanel()
    await store.startScan()

    const helper = scannerMockState.instances[0]
    helper.scanning = false
    await Promise.resolve(helper.onComplete?.({
      items: [scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } })],
    }))

    expect(store.scanStatus).toBe("complete")
    expect(store.scanSession.imported).toBe(true)
    expect(store.scanMessage).toContain("扫描导入完成")
    expect(store.driveDiscs).toHaveLength(1)
    expect(store.importPreview.summary.added).toBe(1)
  })

  it("launches the helper and polls when the first connection fails", async () => {
    vi.useFakeTimers()
    const store = useInventoryStore()
    scannerMockState.connectResults.push(new Error("helper down"))

    await store.openScannerPanel()

    const helper = scannerMockState.instances[0]
    expect(helper.launchCalls).toBe(1)
    expect(store.scanStatus).toBe("waiting-helper")
    expect(store.scanPolling).toBe(true)
    expect(store.scanHelperDownloadUrl).toContain("helper-1.2.1")

    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await vi.advanceTimersByTimeAsync(3000)

    expect(helper.connectCalls).toBe(2)
    expect(helper.ensureCalls).toBe(1)
    expect(store.scanPolling).toBe(false)
    expect(store.scanStatus).toBe("ready")
  })

  it("formats launcher download progress for the scanner drawer", () => {
    const store = useInventoryStore()

    store.applyLauncherProgress({
      stage: "download",
      bytesDownloaded: 5 * 1024 * 1024,
      totalBytes: 10 * 1024 * 1024,
      bytesPerSecond: 1024 * 1024,
      message: "正在下载 OCR 扫描器...",
    })

    expect(store.scanStatus).toBe("downloading")
    expect(store.scanProgressPercent).toBe(50)
    expect(store.scanProgressText).toContain("5.00 MB / 10.00 MB")
    expect(store.scanProgressText).toContain("1.00 MB/s")
  })

  it("sends the stable local and cloud scanner payloads", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]

    await store.startScan()
    expect(helper.startScanPayloads[0]).toMatchObject({
      maxItems: 0,
      rarities: ["S"],
      stopAtNonLevel15: true,
      processName: "ZenlessZoneZero",
      visualProfileClient: "local",
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

    store.stopScan()
    store.scanClient = "cloud"
    store.scanRarityA = true
    store.scanMaxItems = 12
    store.scanStopAtNonLevel15 = false
    await store.startScan()

    expect(helper.startScanPayloads[1]).toMatchObject({
      maxItems: 12,
      rarities: ["S", "A"],
      stopAtNonLevel15: false,
      processName: "Zenless Zone Zero Cloud",
      visualProfileClient: "cloud",
      visualProfileQuality: "current",
    })
  })

  it("maps 9 scan statuses to 4 visible phases", () => {
    const store = useInventoryStore()
    expect(store.scanPhase).toBe("a") // idle

    store.$patch({ scanStatus: "connecting" })
    expect(store.scanPhase).toBe("a")

    store.$patch({ scanStatus: "waiting-helper" })
    expect(store.scanPhase).toBe("a")

    store.$patch({ scanStatus: "preparing" })
    expect(store.scanPhase).toBe("b")

    store.$patch({ scanStatus: "downloading" })
    expect(store.scanPhase).toBe("b")

    store.$patch({ scanStatus: "ready" })
    expect(store.scanPhase).toBe("c")

    store.$patch({ scanStatus: "scanning" })
    expect(store.scanPhase).toBe("d")

    store.$patch({ scanStatus: "complete" })
    expect(store.scanPhase).toBe("d")
  })

  it("keeps error state on its originating phase via scanErrorContext", () => {
    const store = useInventoryStore()
    store.$patch({ scanStatus: "error", scanErrorContext: "prepare" })
    expect(store.scanPhase).toBe("b")
    expect(store.scanErrorVariant).toBe("prepare-failed")

    store.$patch({ scanErrorContext: "scan", scanMessage: "WebSocket disconnected" })
    expect(store.scanPhase).toBe("d")
    expect(store.scanErrorVariant).toBe("scan-failed")

    store.$patch({ scanErrorContext: "scan", scanMessage: "未找到 ZenlessZoneZero 进程" })
    expect(store.scanErrorVariant).toBe("game-not-found")
  })

  it("surfaces helper-outdated when helper version is below required", () => {
    const store = useInventoryStore()
    store.$patch({
      scanStatus: "error",
      scanErrorContext: "prepare",
      scanHelperVersion: "1.0.1",
      scanMessage: "扫描器准备超时",
    })
    expect(store.scanErrorVariant).toBe("helper-outdated")

    store.$patch({ scanHelperVersion: "1.2.1" })
    expect(store.scanErrorVariant).toBe("prepare-failed")
  })

  it("stops before ensure_scanner and keeps the upgrade recovery card for Helper 1.1", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.1.0", protocolVersion: 2 })

    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]

    expect(helper.ensureCalls).toBe(0)
    expect(helper.updateCalls).toBe(0)
    expect(store.scanHelperVersion).toBe("1.1.0")
    expect(store.scanHelperProtocolVersion).toBe(2)
    expect(store.scanHelperUpgradeMode).toBe("legacy-manual")
    expect(store.scanErrorVariant).toBe("helper-outdated")
    expect(store.scanFailure).toBeNull()

    helper.onError?.({
      code: "manifest_invalid",
      phase: "prepare",
      title: "扫描器版本信息无效",
      message: "Unsupported scanner manifest schema 3; expected 1 or 2.",
      actions: [{ kind: "retry", label: "重试" }],
    })

    expect(store.scanErrorVariant).toBe("helper-outdated")
    expect(store.scanFailure).toBeNull()
  })

  it("automatically self-updates a protocol v3 Helper before preparing Scanner", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.0", protocolVersion: 3 })
    scannerMockState.updateResults.push({ updateAvailable: true, availableVersion: "1.2.1", restarting: true })

    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]

    expect(helper.ensureCalls).toBe(0)
    expect(helper.updateCalls).toBe(1)
    expect(store.scanHelperUpgradeMode).toBe("awaiting-restart")
    expect(store.scanStatus).toBe("downloading")
    expect(store.scanProgressText).toContain("正在重启")
    expect(store.scanPolling).toBe(true)
  })

  it("reconnects after self-update and resumes Scanner preparation", async () => {
    vi.useFakeTimers()
    const store = useInventoryStore()
    scannerMockState.connectResults.push(
      { version: "1.2.0", protocolVersion: 3 },
      { version: "1.2.1", protocolVersion: 3 },
    )
    scannerMockState.updateResults.push({ updateAvailable: true, availableVersion: "1.2.1", restarting: true })

    await store.openScannerPanel()
    await vi.advanceTimersByTimeAsync(3000)

    const helper = scannerMockState.instances[0]
    expect(helper.updateCalls).toBe(1)
    expect(helper.ensureCalls).toBe(1)
    expect(store.scanHelperVersion).toBe("1.2.1")
    expect(store.scanHelperUpgradeMode).toBe("")
    expect(store.scanStatus).toBe("ready")
  })

  it("offers retry and manual download when protocol v3 self-update fails", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.0", protocolVersion: 3 })
    scannerMockState.updateResults.push(new Error("checksum mismatch"))

    await store.openScannerPanel()

    expect(store.scanErrorVariant).toBe("helper-outdated")
    expect(store.scanHelperUpgradeMode).toBe("self-update-failed")
    expect(store.scanMessage).toContain("checksum mismatch")
    expect(store.scanPolling).toBe(false)
  })

  it("surfaces helper-missing while waiting for helper", () => {
    const store = useInventoryStore()
    store.$patch({ scanStatus: "waiting-helper" })
    expect(store.scanPhase).toBe("a")
    expect(store.scanErrorVariant).toBe("helper-missing")
  })

  it("preserves structured helper failures and executes repair actions", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]

    helper.onError?.({
      code: "package_corrupt",
      phase: "install",
      title: "扫描器安装包校验失败",
      message: "SHA-256 不匹配",
      remedy: "请重新下载并修复。",
      retryable: true,
      actions: [{ kind: "repair", label: "重新下载并修复" }],
      diagnosticId: "diag-1",
      details: { packageId: "win-x64-fdd" },
    })

    expect(store.scanErrorVariant).toBe("diagnostic-failure")
    expect(store.scanFailure?.code).toBe("package_corrupt")
    expect(store.scanFailure?.diagnosticId).toBe("diag-1")
    await store.handleScannerFailureAction("repair")
    expect(helper.repairCalls).toBe(1)
    expect(store.scanStatus).toBe("ready")
  })

  it("disables start-scan when no rarity is selected", () => {
    const store = useInventoryStore()
    store.$patch({ scanConnected: true, scanStatus: "ready", scanRarityS: false, scanRarityA: false })
    expect(store.scanRaritySelected).toBe(false)
    expect(store.scanCanStart).toBe(false)

    store.$patch({ scanRarityA: true })
    expect(store.scanCanStart).toBe(true)
  })

  it("does not switch to error status for the rarity validation", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await store.openScannerPanel()
    store.$patch({ scanRarityS: false, scanRarityA: false })
    await store.startScan()

    expect(store.scanStatus).not.toBe("error")
    expect(store.scanMessage).toContain("请至少选择一个品质")
    expect(scannerMockState.instances[0].startScanPayloads).toHaveLength(0)
  })

  it("reports hasDriveDiscs off when the local store is empty", async () => {
    const store = useInventoryStore()
    await store.load()
    expect(store.hasDriveDiscs).toBe(false)

    await store.saveDisc({
      id: "empty-check",
      setId: "manual",
      setName: "test",
      partition: 4,
      mainStat: { stat: "critRate", value: 24 },
      subStats: [],
      level: 15,
    })
    expect(store.hasDriveDiscs).toBe(true)
  })

  it("prepares an account-scoped native JSON export with a safe filename", async () => {
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "default",
      owners: [
        { id: "default", label: "主账号/测试" },
        { id: "alt", label: "其他账号" },
      ],
      imports: [],
      driveDiscs: [
        {
          id: "default-disc",
          ownerId: "default",
          setId: "woodpecker_electro",
          setName: "啄木鸟电音",
          partition: 1,
          rarity: "S",
          level: 15,
          maxLevel: 15,
          locked: true,
          equippedBy: "agent-a",
          mainStat: { stat: "hpFlat", value: 2200 },
          subStats: [],
          contentFingerprint: "stale-content",
          identityFingerprint: "stale-identity",
        },
        {
          id: "alt-disc",
          ownerId: "alt",
          setId: "swing_jazz",
          setName: "摇摆爵士",
          partition: 2,
          rarity: "S",
          level: 15,
          maxLevel: 15,
          mainStat: { stat: "atkFlat", value: 316 },
          subStats: [],
        },
      ],
      driveDiscLoadouts: [{ id: "loadout-a", ownerId: "default" }],
    }))
    const store = useInventoryStore()
    await store.load()
    store.slotFilter = 6
    store.search = "不会命中"

    const exported = await store.prepareCurrentAccountExport(new Date(2026, 6, 18, 12, 0, 0))

    expect(exported.fileName).toBe("zzz-drive-discs-主账号-测试-2026-07-18.json")
    expect(exported.mimeType).toBe("application/json;charset=utf-8")
    expect(exported.payload.sourceAccount).toEqual({ label: "主账号/测试" })
    expect(exported.payload.driveDiscs.map((disc: any) => disc.id)).toEqual(["default-disc"])
    expect(exported.payload.driveDiscs[0]).not.toHaveProperty("ownerId")
    expect(exported.payload.driveDiscs[0]).not.toHaveProperty("contentFingerprint")
    expect(exported.payload).not.toHaveProperty("driveDiscLoadouts")
    expect(JSON.parse(exported.text)).toEqual(exported.payload)
  })

  it("records helper version at prepare time", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.1", protocolVersion: 3 })
    await store.openScannerPanel()
    expect(store.scanHelperVersion).toBe("1.2.1")
  })
})
