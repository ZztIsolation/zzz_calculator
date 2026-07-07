import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const scannerMockState = vi.hoisted(() => ({
  instances: [] as any[],
  connectResults: [] as any[],
  ensureResults: [] as any[],
}))

vi.mock("@core/scanner-bridge.js", () => {
  class MockScannerBridge {
    onProgress: ((payload: any) => void) | null = null
    onLauncherProgress: ((payload: any) => void) | null = null
    onScannerReady: ((payload: any) => void) | null = null
    onItem: ((payload: any) => void) | null = null
    onComplete: ((payload: any) => void) | null = null
    onError: ((payload: any) => void) | null = null
    onDisconnect: (() => void) | null = null
    connected = false
    scanning = false
    mode = "helper"
    helperVersion = "1.0.2"
    connectCalls = 0
    ensureCalls = 0
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
    useInventoryStore().closeScannerPanel()
    scannerMockState.instances.length = 0
    scannerMockState.connectResults.length = 0
    scannerMockState.ensureResults.length = 0
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
    useInventoryStore().closeScannerPanel()
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
    scannerMockState.connectResults.push({ version: "1.0.2" })
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
    expect(store.scanHelperDownloadUrl).toContain("scanner-1.0.35")

    scannerMockState.connectResults.push({ version: "1.0.2" })
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
    scannerMockState.connectResults.push({ version: "1.0.2" })
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
})
