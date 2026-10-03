import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const scannerMockState = vi.hoisted(() => ({
  instances: [] as any[],
  connectResults: [] as any[],
  ensureResults: [] as any[],
  updateResults: [] as any[],
  diagnosticsResults: [] as any[],
  confirmResults: [] as any[],
  elevatedResults: [] as any[],
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
    onHeartbeat: ((payload: any) => void) | null = null
    onStopAck: ((payload: any) => void) | null = null
    onDisconnect: ((failure?: any) => void) | null = null
    connected = false
    connectionEpoch = 0
    scanning = false
    mode = "helper"
    helperVersion = "1.3.1"
    protocolVersion = 4
    helperUpdate: any = null
    connectCalls = 0
    ensureCalls = 0
    updateCalls = 0
    repairCalls = 0
    elevatedCalls = 0
    openLogCalls = 0
    diagnosticsCalls = 0
    confirmCalls = 0
    launchCalls = 0
    disconnectCalls = 0
    stopCalls = 0
    startScanPayloads: any[] = []

    constructor() {
      scannerMockState.instances.push(this)
    }

    async connect() {
      this.connectCalls += 1
      if (!this.connected) this.connectionEpoch += 1
      const result = scannerMockState.connectResults.shift()
      if (result instanceof Error) {
        throw result
      }
      const hello = await (result ?? { version: this.helperVersion })
      this.helperVersion = String(hello?.version ?? this.helperVersion)
      this.protocolVersion = Number(hello?.protocolVersion ?? this.protocolVersion)
      this.helperUpdate = hello?.helperUpdate ?? null
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
      return await (result ?? { updateAvailable: true, availableVersion: "1.3.1", restarting: true })
    }

    async repairScanner() {
      this.repairCalls += 1
    }

    async restartScannerElevated() {
      this.elevatedCalls += 1
      const result = scannerMockState.elevatedResults.shift()
      if (result instanceof Error) throw result
      return await result
    }

    openLogFolder() {
      this.openLogCalls += 1
    }

    requestDiagnostics() {
      this.diagnosticsCalls += 1
      this.onDiagnostics?.({ helperVersion: this.helperVersion })
    }

    async getDiagnostics() {
      this.diagnosticsCalls += 1
      const result = scannerMockState.diagnosticsResults.shift()
      if (result instanceof Error) throw result
      return await (result ?? { helperVersion: this.helperVersion, protocolVersion: this.protocolVersion })
    }

    async confirmHelperUpdate(transactionId: string) {
      this.confirmCalls += 1
      const result = scannerMockState.confirmResults.shift()
      if (result instanceof Error) throw result
      return await (result ?? { committed: true, transactionId })
    }

    disconnect() {
      this.disconnectCalls += 1
      this.connectionEpoch += 1
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

function nativeLaunchFailure(code: "uac_cancelled" | "child_start_failed", diagnosticId = `native-${code}`) {
  return Object.assign(new Error(code === "uac_cancelled" ? "你取消了 Windows 管理员权限确认，扫描器没有启动。" : "拒绝访问。"), {
    code,
    phase: "launch",
    title: code === "uac_cancelled" ? "已取消管理员授权" : "无法启动 OCR 扫描器",
    remedy: "请选择重新下载并修复；如果问题持续，请打开日志。",
    retryable: true,
    actions: [
      { kind: "retry", label: "重试" },
      { kind: "open_logs", label: "打开日志目录" },
      { kind: "copy_diagnostics", label: "复制诊断信息" },
    ],
    diagnosticId,
    details: {},
  })
}

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
    scannerMockState.diagnosticsResults.length = 0
    scannerMockState.confirmResults.length = 0
    scannerMockState.elevatedResults.length = 0
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

  it.each(["uac_cancelled", "child_start_failed"] as const)(
    "retries native %s directly with the selected admin launch, preserving the draft", async code => {
      const store = useInventoryStore()
      await store.openScannerPanel()
      const helper = scannerMockState.instances[0]
      store.updateScanPreferences({ runAsAdmin: true, client: "cloud", maxItems: 47, stopAtNonLevel15: false })
      store.scanRemoveMissing = true
      scannerMockState.elevatedResults.push(nativeLaunchFailure(code))
      await store.startScan()
      expect(store.scanStartupRecovery).toBe(true)
      expect(store.scanPhase).toBe("c")
      expect(store.scanStatus).toBe(code === "uac_cancelled" ? "warning" : "error")
      const ensureCalls = helper.ensureCalls
      await store.handleScannerFailureAction("retry")
      expect(helper.ensureCalls).toBe(ensureCalls)
      expect(helper.elevatedCalls).toBe(2)
      expect(helper.startScanPayloads).toHaveLength(0)
      expect(store.scanStatus).toBe("ready")
      expect([store.scanClient, store.scanMaxItems, store.scanStopAtNonLevel15, store.scanRunAsAdmin, store.scanRemoveMissing])
        .toEqual(["cloud", 47, false, true, true])
      await store.startScan()
      expect(store.scanDeleteConfirmation).not.toBeNull()
      expect(helper.startScanPayloads).toHaveLength(0)
      await store.confirmScanStart()
      expect(helper.elevatedCalls).toBe(2)
      expect(helper.startScanPayloads).toHaveLength(1)
      expect(helper.startScanPayloads[0]).toMatchObject({ visualProfileClient: "cloud", maxItems: 47, stopAtNonLevel15: false })
    },
  )

  it.each(["uac_cancelled", "child_start_failed"] as const)(
    "uses the unchecked preference for %s recovery after a one-off admin request", async code => {
      const store = useInventoryStore()
      await store.openScannerPanel()
      const helper = scannerMockState.instances[0]
      scannerMockState.elevatedResults.push(nativeLaunchFailure(code))
      await store.handleScannerFailureAction("restart_elevated")
      expect(store.scanRunAsAdmin).toBe(false)
      expect(store.scanRequiresElevation).toBe(true)
      const ensureCalls = helper.ensureCalls
      await store.startScan()
      expect(helper.ensureCalls).toBe(ensureCalls + 1)
      expect(helper.elevatedCalls).toBe(1)
      expect(store.scanRequiresElevation).toBe(false)
      expect(helper.startScanPayloads).toHaveLength(0)
      await store.startScan()
      expect(helper.startScanPayloads).toHaveLength(1)
      expect(helper.elevatedCalls).toBe(1)
      expect(localStorage.getItem("zzz-calculator.scannerPreferences.v1")).toBeNull()
    },
  )

  it("re-evaluates the checkbox after each failure without downgrading an admin retry", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.updateScanPreferences({ runAsAdmin: true })
    store.scanRemoveMissing = true
    scannerMockState.elevatedResults.push(nativeLaunchFailure("child_start_failed", "first"))
    await store.startScan()
    store.updateScanPreferences({ runAsAdmin: false })
    scannerMockState.ensureResults.push(nativeLaunchFailure("child_start_failed", "second"))
    const ensureCalls = helper.ensureCalls
    await store.startScan()
    expect(helper.ensureCalls).toBe(ensureCalls + 1)
    expect(helper.elevatedCalls).toBe(1)
    expect(store.scanFailure?.diagnosticId).toBe("second")
    store.updateScanPreferences({ runAsAdmin: true })
    await store.startScan()
    expect(helper.ensureCalls).toBe(ensureCalls + 1)
    expect(helper.elevatedCalls).toBe(2)
    expect(store.scanRemoveMissing).toBe(true)
    expect(helper.startScanPayloads).toHaveLength(0)
  })

  it("keeps the config visible and blocks duplicate starts while recovery is pending", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.updateScanPreferences({ runAsAdmin: true })
    scannerMockState.elevatedResults.push(nativeLaunchFailure("uac_cancelled"))
    await store.startScan()
    let finish!: () => void
    scannerMockState.elevatedResults.push(new Promise<void>(resolve => { finish = resolve }))
    const retry = store.startScan()
    expect(store.scanShowConfig).toBe(true)
    expect(store.scanFailure).toBeNull()
    expect(store.scanPreparing).toBe(true)
    expect(store.scanStartPending).toBe(true)
    expect(store.scanCanStart).toBe(false)
    await Promise.all([store.startScan(), store.handleScannerFailureAction("retry")])
    expect(helper.elevatedCalls).toBe(2)
    expect(helper.startScanPayloads).toHaveLength(0)
    finish()
    await retry
    expect(store.scanCanStart).toBe(true)
  })

  it("shows recovery config even when the initial native launch fails before the first ready", async () => {
    const store = useInventoryStore()
    scannerMockState.ensureResults.push(nativeLaunchFailure("child_start_failed"))
    await store.openScannerPanel()
    expect(store.scanShowConfig).toBe(true)
    expect(store.scanCanStart).toBe(true)
    await store.startScan()
    expect(store.scanStatus).toBe("ready")
    expect(scannerMockState.instances[0].startScanPayloads).toHaveLength(0)
  })

  it("retains explicit admin and repair semantics independently of generic startup recovery", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    scannerMockState.elevatedResults.push(nativeLaunchFailure("uac_cancelled"))
    await store.handleScannerFailureAction("restart_elevated")
    expect(store.scanRunAsAdmin).toBe(false)
    await store.handleScannerFailureAction("restart_elevated")
    expect(helper.elevatedCalls).toBe(2)
    expect(store.scanRunAsAdmin).toBe(false)
    store.updateScanPreferences({ runAsAdmin: true })
    store.applyScannerFailure(nativeLaunchFailure("child_start_failed"))
    await store.handleScannerFailureAction("repair")
    expect(helper.repairCalls).toBe(1)
    expect(helper.elevatedCalls).toBe(2)
    expect(store.scanAdminRequestCompleted).toBe(false)
    expect(store.scanStatus).toBe("ready")
    expect(helper.startScanPayloads).toHaveLength(0)
  })

  it("copies the current native failure together with actual reported versions", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    store.scanScannerVersion = "1.0.49"
    store.applyScannerFailure(nativeLaunchFailure("child_start_failed", "native-copy"))
    const diagnostic = JSON.parse(store.scannerDiagnosticText())
    expect(diagnostic).toMatchObject({
      helperVersion: "1.3.1", helperProtocolVersion: 4, scannerVersion: "1.0.49",
      failure: {
        code: "child_start_failed", diagnosticId: "native-copy",
        details: { nativeFailure: { phase: "launch", message: "拒绝访问。", diagnosticId: "native-copy" } },
      },
    })
  })

  it("uses the unchecked preference after repair instead of reviving a cancelled one-off admin request", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    scannerMockState.elevatedResults.push(nativeLaunchFailure("uac_cancelled"))
    await store.handleScannerFailureAction("restart_elevated")
    await store.handleScannerFailureAction("repair")
    expect(helper.repairCalls).toBe(1)
    expect(store.scanRequiresElevation).toBe(false)
    expect(helper.startScanPayloads).toHaveLength(0)
    await store.startScan()
    expect(helper.elevatedCalls).toBe(1)
    expect(helper.startScanPayloads).toHaveLength(1)
  })

  it("prepares the requested admin launch before deletion confirmation, then starts only once", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.updateScanPreferences({ runAsAdmin: true, client: "cloud", maxItems: 37, stopAtNonLevel15: false })
    store.scanRemoveMissing = true

    await store.startScan()
    expect(helper.elevatedCalls).toBe(1)
    expect(helper.startScanPayloads).toHaveLength(0)
    expect(store.scanStatus).toBe("ready")
    expect(store.scanDeleteConfirmation).toBeNull()
    expect(store.scanRemoveMissing).toBe(true)

    await store.startScan()
    expect(helper.elevatedCalls).toBe(1)
    expect(helper.startScanPayloads).toHaveLength(0)
    expect(store.scanDeleteConfirmation).toMatchObject({ ownerId: "default", removeMissing: true, client: "cloud", maxItems: 37 })
    await Promise.all([store.confirmScanStart(), store.confirmScanStart(), store.startScan()])
    expect(helper.startScanPayloads).toHaveLength(1)
    expect(helper.startScanPayloads[0]).toMatchObject({ visualProfileClient: "cloud", maxItems: 37, stopAtNonLevel15: false })
    expect(store.scanActiveRequest).toMatchObject({ ownerId: "default", removeMissing: true })
    expect(store.scanDeleteConfirmation).toBeNull()
  })

  it("restores only safe preferences without requesting UAC when the panel opens", async () => {
    const store = useInventoryStore()
    store.updateScanPreferences({ runAsAdmin: true, client: "cloud", maxItems: 37, stopAtNonLevel15: false })
    store.scanRemoveMissing = true
    setActivePinia(createPinia())
    const fresh = useInventoryStore()
    await fresh.openScannerPanel()
    expect([fresh.scanRunAsAdmin, fresh.scanClient, fresh.scanMaxItems, fresh.scanStopAtNonLevel15, fresh.scanRemoveMissing])
      .toEqual([true, "cloud", 37, false, false])
    expect(scannerMockState.instances[0].elevatedCalls).toBe(0)
    expect(scannerMockState.instances[0].startScanPayloads).toHaveLength(0)
  })

  it("keeps the complete draft on elevation_required and returns to settings after restart", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.updateScanPreferences({ client: "cloud", maxItems: 37, stopAtNonLevel15: false })
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    helper.scanning = false
    await helper.onError({ code: "elevation_required", phase: "scan", retainedItems: [] })
    expect(store.scanShowConfig).toBe(true)
    expect(store.scanActiveRequest).toBeNull()
    expect(store.scanRemoveMissing).toBe(true)

    await store.handleScannerFailureAction("restart_elevated")
    expect(helper.startScanPayloads).toHaveLength(1)
    expect(store.scanStatus).toBe("ready")
    expect([store.scanClient, store.scanMaxItems, store.scanStopAtNonLevel15, store.scanRemoveMissing, store.scanRunAsAdmin])
      .toEqual(["cloud", 37, false, true, false])
    await store.startScan()
    expect(helper.startScanPayloads).toHaveLength(1)
    expect(store.scanDeleteConfirmation).not.toBeNull()
    await store.confirmScanStart()
    expect(helper.elevatedCalls).toBe(1)
    expect(helper.startScanPayloads).toHaveLength(2)
  })

  it("retains settings after UAC cancellation and only prepares on explicit retry", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.scanRunAsAdmin = true
    store.scanRemoveMissing = true
    scannerMockState.elevatedResults.push(Object.assign(new Error("cancelled"), { code: "uac_cancelled", phase: "prepare" }))
    await store.startScan()
    expect(store.scanFailure?.code).toBe("uac_cancelled")
    expect(store.scanRemoveMissing).toBe(true)
    expect(store.scanShowConfig).toBe(true)
    expect(store.scanAdminRequestCompleted).toBe(false)
    expect(store.scanStartPending).toBe(false)
    expect(helper.startScanPayloads).toHaveLength(0)
    await store.handleScannerFailureAction("restart_elevated")
    expect(helper.elevatedCalls).toBe(2)
    expect(store.scanStatus).toBe("ready")
    expect(helper.startScanPayloads).toHaveLength(0)
  })

  it("does not allow ordinary ready messages or duplicate clicks to finish an admin request", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.scanRunAsAdmin = true
    let finish!: () => void
    scannerMockState.elevatedResults.push(new Promise<void>(resolve => { finish = resolve }))
    const first = store.startScan()
    await store.startScan()
    helper.onScannerReady({ version: "1.0.49" })
    expect(helper.elevatedCalls).toBe(1)
    expect(store.scanAdminRequestCompleted).toBe(false)
    expect(store.scanStartPending).toBe(true)
    expect(helper.startScanPayloads).toHaveLength(0)
    finish()
    await first
    expect(store.scanAdminRequestCompleted).toBe(true)
    expect(store.scanStatus).toBe("ready")
  })

  it("ignores a late admin completion after closing and reconnecting the panel", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const oldHelper = scannerMockState.instances[0]
    store.scanRunAsAdmin = true
    let finish!: () => void
    scannerMockState.elevatedResults.push(new Promise<void>(resolve => { finish = resolve }))
    const first = store.startScan()
    store.closeScannerPanel()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[1]
    oldHelper.onScannerReady({ version: "stale" })
    finish()
    await first
    expect(store.scanAdminRequestCompleted).toBe(false)
    expect(store.scanScannerVersion).not.toBe("stale")
    await store.startScan()
    expect(helper.elevatedCalls).toBe(1)
    expect(helper.startScanPayloads).toHaveLength(0)
  })

  it.each(["child_exited", "scanner_process_exited", "scanner_transport_failed", "elevation_required"])(
    "invalidates a completed admin request when %s is reported", async code => {
      const store = useInventoryStore()
      await store.openScannerPanel()
      const helper = scannerMockState.instances[0]
      store.scanRunAsAdmin = true
      await store.startScan()
      await helper.onError({ code, phase: "prepare" })
      expect(store.scanAdminRequestCompleted).toBe(false)
      await store.startScan()
      expect(helper.elevatedCalls).toBe(2)
      expect(helper.startScanPayloads).toHaveLength(0)
    },
  )

  it("invalidates admin preparation after repair or a changed connection epoch", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.scanRunAsAdmin = true
    await store.startScan()
    await store.handleScannerFailureAction("repair")
    expect(store.scanAdminRequestCompleted).toBe(false)
    await store.startScan()
    helper.connectionEpoch += 1
    await store.startScan()
    expect(helper.elevatedCalls).toBe(3)
    expect(helper.startScanPayloads).toHaveLength(0)
  })

  it("uses deletion confirmation for retry actions and rejects confirmation after settings change", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    store.scanRemoveMissing = true
    await store.handleScannerFailureAction("retry_scan")
    expect(store.scanDeleteConfirmation).not.toBeNull()
    expect(helper.startScanPayloads).toHaveLength(0)
    store.scanMaxItems = 12
    await store.confirmScanStart()
    expect(helper.startScanPayloads).toHaveLength(0)
    expect(store.scanMessage).toContain("已变化")
    await store.startScan()
    await store.confirmScanStart()
    expect(helper.startScanPayloads).toHaveLength(1)
  })

  it("invalidates deletion confirmation when the persisted target account changes", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1")!)
    persisted.owners.push({ id: "other", label: "另一个账号" })
    persisted.currentOwnerId = "other"
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(persisted))
    await store.confirmScanStart()
    expect(scannerMockState.instances[0].startScanPayloads).toHaveLength(0)
    expect(store.scanDeleteConfirmation).toBeNull()
    expect(store.scanMessage).toContain("已变化")
  })

  it("imports into the frozen scan account and does not pick up later delete or stop options", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    store.scanStopAtNonLevel15 = false
    await store.startScan()
    const helper = scannerMockState.instances[0]
    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1")!)
    persisted.owners.push({ id: "other", label: "另一个账号" })
    persisted.currentOwnerId = "other"
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(persisted))
    store.scanRemoveMissing = true
    store.scanStopAtNonLevel15 = true
    await helper.onComplete({ items: [scannerDisc(1)], terminationCode: "non_level_15_stop", completed: 1, failed: 0 })
    const after = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1")!)
    expect(after.driveDiscs).toHaveLength(1)
    expect(after.driveDiscs[0].ownerId).toBe("default")
    expect(after.currentOwnerId).toBe("other")
    expect(store.scanSession.ownerId).toBe("default")
    expect(store.scanSession.requestedRemoveMissing).toBe(false)
    expect(store.scanStatus).toBe("warning")
    expect(store.scanRemoveMissing).toBe(false)
  })

  it("prevents a second scan while automatic import is still finishing", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]
    helper.scanning = false
    let finish!: (summary: any) => void
    const spy = vi.spyOn(store, "importScannerPayload").mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const terminal = helper.onComplete({ items: [scannerDisc(1)], completed: 1 })
    expect(store.scanFinalizing).toBe(true)
    await store.startScan()
    expect(helper.startScanPayloads).toHaveLength(1)
    finish({ added: 1, updated: 0, skipped: 0 })
    await terminal
    expect(store.scanFinalizing).toBe(false)
    spy.mockRestore()
  })

  it("serializes import retries and does not start another scan during the retry", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]
    helper.scanning = false
    const spy = vi.spyOn(store, "importScannerPayload").mockRejectedValueOnce(new Error("busy"))
    await helper.onComplete({ items: [scannerDisc(1)], completed: 1 })
    expect(store.scanFailure?.code).toBe("import_failed")
    let finish!: (summary: any) => void
    spy.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const retry = store.handleScannerFailureAction("retry_import")
    await store.handleScannerFailureAction("retry_import")
    await store.startScan()
    expect(store.scanFinalizing).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(helper.startScanPayloads).toHaveLength(1)
    finish({ added: 1, updated: 0, skipped: 0 })
    await retry
    expect(store.scanStatus).toBe("complete")
    expect(store.scanFinalizing).toBe(false)
    spy.mockRestore()
  })

  it("does not resume a pending connection poll after closing the scanner panel", async () => {
    vi.useFakeTimers()
    const store = useInventoryStore()
    scannerMockState.connectResults.push(new Error("helper down"))
    await store.openScannerPanel()
    const helper = scannerMockState.instances[0]
    let finish!: (hello: any) => void
    scannerMockState.connectResults.push(new Promise(resolve => { finish = resolve }))
    await vi.advanceTimersByTimeAsync(3000)
    const callsBefore = helper.connectCalls
    await vi.advanceTimersByTimeAsync(9000)
    expect(helper.connectCalls).toBe(callsBefore)
    store.closeScannerPanel()
    finish({ version: "1.3.1", protocolVersion: 4 })
    await vi.advanceTimersByTimeAsync(0)
    expect(store.scanStatus).toBe("idle")
    expect(store.scanConnected).toBe(false)
    expect(store.scanPolling).toBe(false)
    expect(scannerMockState.instances).toHaveLength(1)
    expect(helper.ensureCalls).toBe(0)
  })

  it("shows a preparation timeout even when the bridge retires the timed-out connection", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    const helper = store.ensureScannerBridge() as any
    vi.spyOn(helper, "ensureScanner").mockImplementationOnce(async () => {
      helper.disconnect()
      throw Object.assign(new Error("timeout"), { code: "scanner_prepare_stalled", phase: "prepare" })
    })
    await store.connectScanner()
    expect(store.scanFailure?.code).toBe("scanner_prepare_stalled")
    expect(store.scanConnected).toBe(false)
    expect(store.scanShowConfig).toBe(true)
    expect(store.scanStartPending).toBe(false)
  })

  it("retains results instead of importing into another account when the original account was deleted", async () => {
    const store = useInventoryStore()
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1, currentOwnerId: "other", owners: [{ id: "other", label: "其他" }],
      imports: [], driveDiscs: [], driveDiscLoadouts: [],
    }))
    await helper.onComplete({ items: [scannerDisc(1)], completed: 1 })
    expect(store.scanFailure?.code).toBe("import_failed")
    expect(store.scanSession.ownerId).toBe("default")
    expect(store.scanSession.payload).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1")!).driveDiscs).toEqual([])
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

  it("captures the current owner when saving a loadout and preserves other owners", async () => {
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "alt",
      owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "其他账号" },
      ],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [{
        id: "default-loadout",
        ownerId: "default",
        name: "默认账号套装",
        agentId: "agent-default",
        driveDiscIdsBySlot: {},
      }],
    }))
    const store = useInventoryStore()
    await store.load()

    const saved = await store.saveLoadout({
      id: "alt-loadout",
      name: "其他账号套装",
      agentId: "agent-alt",
      driveDiscIdsBySlot: {},
    }, {
      waitTimeoutMs: 5_000,
      storageTimeoutMs: 15_000,
      purpose: "保存套装",
    })

    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "null")
    expect(saved.ownerId).toBe("alt")
    expect(store.loadouts.map((loadout: any) => loadout.id)).toEqual(["alt-loadout"])
    expect(persisted.driveDiscLoadouts.map((loadout: any) => [loadout.id, loadout.ownerId])).toEqual([
      ["default-loadout", "default"],
      ["alt-loadout", "alt"],
    ])
  })

  it("honors an explicitly frozen loadout owner after the active account changes", async () => {
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
      version: 1,
      currentOwnerId: "alt",
      owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "其他账号" },
      ],
      imports: [],
      driveDiscs: [],
      driveDiscLoadouts: [],
    }))
    const store = useInventoryStore()
    await store.load()

    const saved = await store.saveLoadout({
      id: "frozen-owner-loadout",
      name: "冻结账号套装",
      agentId: "agent-default",
      driveDiscIdsBySlot: {},
    }, { ownerId: "default" })

    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "null")
    expect(saved.ownerId).toBe("default")
    expect(store.loadouts).toEqual([])
    expect(persisted.driveDiscLoadouts).toContainEqual(expect.objectContaining({
      id: "frozen-owner-loadout",
      ownerId: "default",
    }))
  })

  it("isolates loadouts and loadout calculations by their exact agent id", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "disc-a",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
      level: 15,
    })
    await store.saveLoadout({
      id: "loadout-agent-a",
      name: "角色 A 套装",
      agentId: "agent-a",
      driveDiscIdsBySlot: { "1": "disc-a" },
    })
    await store.saveLoadout({
      id: "loadout-agent-b",
      name: "角色 B 套装",
      agentId: "agent-b",
      driveDiscIdsBySlot: { "1": "disc-a" },
    })
    store.store.driveDiscLoadouts.push({
      id: "legacy-unassigned-loadout",
      name: "缺少角色的旧套装",
      driveDiscIdsBySlot: { "1": "disc-a" },
    })

    expect(store.loadoutsForAgent("agent-a").map((item: any) => item.id)).toEqual(["loadout-agent-a"])
    expect(store.loadoutsForAgent("agent-b").map((item: any) => item.id)).toEqual(["loadout-agent-b"])
    expect(store.loadoutsForAgent("agent-a ")).toEqual([])
    expect(store.loadoutsForAgent("")).toEqual([])
    expect(store.calculatorDriveDiscs({
      mode: "loadout",
      loadoutId: "loadout-agent-a",
      agentId: "agent-a",
    }).map((disc: any) => disc.id)).toEqual(["disc-a"])
    expect(store.calculatorDriveDiscs({
      mode: "loadout",
      loadoutId: "loadout-agent-a",
      agentId: "agent-b",
    })).toEqual([])
    expect(store.calculatorDriveDiscs({
      mode: "loadout",
      loadoutId: "loadout-agent-a",
      agentId: "agent-a ",
    })).toEqual([])
    expect(store.calculatorDriveDiscs({
      mode: "loadout",
      loadoutId: "legacy-unassigned-loadout",
      agentId: "agent-a",
    })).toEqual([])

    expect(store.loadouts.map((item: any) => item.id)).toEqual([
      "loadout-agent-a",
      "loadout-agent-b",
      "legacy-unassigned-loadout",
    ])
  })

  it("keeps reservation conflicts atomic and filters known, unknown, and public reservations", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "reserved-disc",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
      level: 15,
    })

    const assigned = await store.reserveDiscs(["reserved-disc"], "agent-a")
    expect(assigned.applied).toBe(true)
    expect(store.driveDiscs[0].reservedForAgentId).toBe("agent-a")

    const blocked = await store.reserveDiscs(["reserved-disc"], "agent-b")
    expect(blocked.applied).toBe(false)
    expect(store.driveDiscs[0].reservedForAgentId).toBe("agent-a")

    const converted = await store.excludeDiscs(["reserved-disc"], "agent-a", true, true)
    expect(converted.applied).toBe(true)
    expect(store.driveDiscs[0].reservedForAgentId).toBeNull()
    expect(store.driveDiscs[0].excludedForAgentIds).toEqual(["agent-a"])

    const restored = await store.reserveDiscs(["reserved-disc"], "agent-a", false, true)
    expect(restored.applied).toBe(true)
    expect(store.driveDiscs[0].reservedForAgentId).toBe("agent-a")
    expect(store.driveDiscs[0].excludedForAgentIds).toEqual([])

    await store.saveDisc({
      id: "unknown-reserved-disc",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 2,
      mainStat: { stat: "atkFlat", value: 316 },
      subStats: [],
      level: 15,
    })
    await store.reserveDiscs(["unknown-reserved-disc"], "retired-agent")
    await store.saveDisc({
      id: "public-disc",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
      level: 15,
    })

    store.reservationFilter = "reserved"
    expect(store.filteredDriveDiscs.map((disc: any) => disc.id)).toEqual([
      "reserved-disc",
      "unknown-reserved-disc",
    ])
    store.slotFilter = 2
    expect(store.filteredDriveDiscs.map((disc: any) => disc.id)).toEqual(["unknown-reserved-disc"])
    store.slotFilter = 0

    store.reservationFilter = "agent-a"
    expect(store.filteredDriveDiscs.map((disc: any) => disc.id)).toEqual(["reserved-disc"])
    store.reservationFilter = "public"
    expect(store.filteredDriveDiscs.map((disc: any) => disc.id)).toEqual(["public-disc"])
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
    expect(removePreview.summary.removed).toBe(0)
    expect(removePreview.removed.map((disc: any) => disc.id)).not.toContain("manual-disc")
  })

  it("automatically imports a completed scan session", async () => {
    const store = useInventoryStore()
    await store.load()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
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

  it("keeps a scanner conflict review available after closing and reopening the drawer", async () => {
    const store = useInventoryStore()
    const reviewSession = {
      payload: [scannerDisc(1)],
      plan: { hasUnresolvedConflicts: true, conflicts: [{ key: "conflict-a" }] },
      importDraft: { payload: [scannerDisc(1)], options: {}, resolutions: {} },
      preview: { summary: { conflicts: 1 } },
    }
    store.scanSession = reviewSession
    store.scanStatus = "review"
    store.scanMessage = "请确认疑似同盘"

    store.closeScannerPanel()
    await store.openScannerPanel()

    expect(store.scanStatus).toBe("review")
    expect(store.scanSession).toEqual(reviewSession)
    expect(store.scanMessage).toBe("请确认疑似同盘")
  })

  it("serializes conflict decisions while rebuilding a frozen import plan", async () => {
    const store = useInventoryStore()
    store.importDraft = { payload: [scannerDisc(1)], options: {}, resolutions: {} }
    let releasePlan!: (plan: any) => void
    const planPromise = new Promise<any>(resolve => { releasePlan = resolve })
    const planSpy = vi.spyOn(store, "createFrozenImportPlan").mockReturnValue(planPromise)

    const first = store.resolveImportConflict({ key: "conflict-a", action: "add" })
    await Promise.resolve()
    const second = store.resolveImportConflict({ key: "conflict-b", action: "add" })

    expect(store.importResolving).toBe(true)
    expect(planSpy).toHaveBeenCalledTimes(1)
    releasePlan({ preview: { summary: {} }, hasUnresolvedConflicts: false })
    await Promise.all([first, second])
    expect(store.importResolutions).toEqual({ "conflict-a": { action: "add" } })
    expect(store.importResolving).toBe(false)
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
    expect(store.scanErrorVariant).toBe("helper-missing")
    expect(store.scanHelperDownloadUrl).toBe("https://download.zzzcaculator.top/downloads/zzz-scanner/helper/1.3.1/ZZZ-Scanner-Helper.exe")

    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await vi.advanceTimersByTimeAsync(3000)

    expect(helper.connectCalls).toBe(2)
    expect(helper.ensureCalls).toBe(1)
    expect(store.scanPolling).toBe(false)
    expect(store.scanStatus).toBe("ready")
  })

  it.each([
    ["loopback_permission_denied", "browser-permission"],
    ["helper_websocket_blocked", "browser-websocket"],
    ["helper_connection_timeout", "browser-websocket"],
    ["helper_origin_rejected", "helper-rejected"],
  ])("surfaces terminal connection error %s without launching or polling", async (code, variant) => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push(Object.assign(new Error(`connection failed: ${code}`), {
      code,
      phase: "connect",
      stage: code === "helper_origin_rejected" ? "token" : "websocket",
      permissionName: code === "loopback_permission_denied" ? "loopback-network" : "",
      permissionState: code === "loopback_permission_denied" ? "denied" : "granted",
      details: { connectionStage: "websocket" },
    }))

    await store.openScannerPanel()

    const helper = scannerMockState.instances[0]
    expect(store.scanStatus).toBe("error")
    expect(store.scanErrorVariant).toBe(variant)
    expect(store.scanPolling).toBe(false)
    expect(helper.launchCalls).toBe(0)
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
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
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
      panelAcceptMode: "safe",
      panelStabilityMode: "text-core",
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
      rarities: ["S"],
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

    store.$patch({ scanHelperVersion: "1.3.1" })
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
    expect(store.scanFailure?.code).toBe("helper_outdated")

    helper.onError?.({
      code: "manifest_invalid",
      phase: "prepare",
      title: "扫描器版本信息无效",
      message: "Unsupported scanner manifest schema 3; expected 1 or 2.",
      actions: [{ kind: "retry", label: "重试" }],
    })

    expect(store.scanErrorVariant).toBe("helper-outdated")
    expect(store.scanFailure?.code).toBe("helper_outdated")
  })

  it("automatically self-updates a protocol v3 Helper before preparing Scanner", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.2.0", protocolVersion: 3 })
    scannerMockState.updateResults.push({ updateAvailable: true, availableVersion: "1.3.1", restarting: true })

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
      {
        version: "1.3.1",
        protocolVersion: 4,
        helperUpdate: {
          state: "pending_confirmation",
          transactionId: "tx-upgrade-1",
          previousVersion: "1.2.1",
        },
      },
    )
    scannerMockState.updateResults.push({ updateAvailable: true, availableVersion: "1.3.1", restarting: true })

    await store.openScannerPanel()
    await vi.advanceTimersByTimeAsync(3000)

    const helper = scannerMockState.instances[0]
    expect(helper.updateCalls).toBe(1)
    expect(helper.diagnosticsCalls).toBe(1)
    expect(helper.confirmCalls).toBe(1)
    expect(helper.ensureCalls).toBe(1)
    expect(store.scanHelperVersion).toBe("1.3.1")
    expect(store.scanHelperUpgradeMode).toBe("")
    expect(store.scanStatus).toBe("ready")
  })

  it("does not prepare Scanner when the new Helper transaction cannot be confirmed", async () => {
    vi.useFakeTimers()
    const store = useInventoryStore()
    scannerMockState.connectResults.push(
      { version: "1.2.1", protocolVersion: 3 },
      {
        version: "1.3.1",
        protocolVersion: 4,
        helperUpdate: {
          state: "pending_confirmation",
          transactionId: "tx-upgrade-failed",
          previousVersion: "1.2.1",
        },
      },
    )
    scannerMockState.confirmResults.push(new Error("confirmation rejected"))

    await store.openScannerPanel()
    await vi.advanceTimersByTimeAsync(3000)

    const helper = scannerMockState.instances[0]
    expect(helper.updateCalls).toBe(1)
    expect(helper.diagnosticsCalls).toBe(1)
    expect(helper.confirmCalls).toBe(1)
    expect(helper.ensureCalls).toBe(0)
    expect(store.scanHelperUpgradeMode).toBe("self-update-failed")
    expect(store.scanFailure?.code).toBe("helper_update_confirmation_failed")
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

  it("shows Helper download recovery while startup remains pending", () => {
    const store = useInventoryStore()
    store.$patch({ scanStatus: "waiting-helper", scanErrorContext: "helper-missing" })
    expect(store.scanPhase).toBe("a")
    expect(store.scanErrorVariant).toBe("helper-missing")
  })

  it("preserves structured helper failures and executes repair actions", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
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

  it("keeps official S-rank scanning enabled regardless of legacy rarity flags", () => {
    const store = useInventoryStore()
    store.$patch({ scanConnected: true, scanStatus: "ready", scanRarityS: false, scanRarityA: false })
    expect(store.scanRaritySelected).toBe(true)
    expect(store.scanCanStart).toBe(true)

    store.$patch({ scanRarityA: true })
    expect(store.scanCanStart).toBe(true)
  })

  it("always sends S-rank even when persisted legacy rarity flags are disabled", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.$patch({ scanRarityS: false, scanRarityA: false })
    await store.startScan()

    expect(store.scanStatus).toBe("scanning")
    expect(scannerMockState.instances[0].startScanPayloads[0].rarities).toEqual(["S"])
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
    expect(exported.payload.sourceAccount).toEqual({ id: "default", label: "主账号/测试" })
    expect(exported.payload.driveDiscs.map((disc: any) => disc.id)).toEqual(["default-disc"])
    expect(exported.payload.driveDiscs[0]).not.toHaveProperty("ownerId")
    expect(exported.payload.driveDiscs[0]).not.toHaveProperty("contentFingerprint")
    expect(exported.payload).not.toHaveProperty("driveDiscLoadouts")
    expect(JSON.parse(exported.text)).toEqual(exported.payload)
  })

  it("records helper and Scanner versions at prepare time", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    scannerMockState.ensureResults.push({ version: "1.0.43" })
    await store.openScannerPanel()
    expect(store.scanHelperVersion).toBe("1.3.1")
    expect(store.scanScannerVersion).toBe("1.0.43")
  })

  it("turns a Helper launch that never connects into a coded terminal error", async () => {
    vi.useFakeTimers()
    const store = useInventoryStore()
    scannerMockState.connectResults.push(...Array.from({ length: 25 }, () => new Error("helper down")))

    await store.openScannerPanel()
    expect(store.scanStatus).toBe("waiting-helper")

    await vi.advanceTimersByTimeAsync(60_000)

    expect(store.scanStatus).toBe("error")
    expect(store.scanFailure?.code).toBe("helper_launch_timeout")
    expect(store.scanFailure?.message).toMatch(/[\u3400-\u9fff]/)
    expect(store.scanFailure?.remedy).toMatch(/[\u3400-\u9fff]/)
    expect(store.scanPolling).toBe(false)
  })

  it("automatically imports partial OCR results without deleting missing discs", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "preserved-disc",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 2,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "atkFlat", value: 316 },
      subStats: [],
    })
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({
      items: [scannerDisc(1)],
      visited: 2,
      queued: 2,
      completed: 1,
      failed: 1,
    })

    expect(store.scanStatus).toBe("warning")
    expect(store.scanFailure?.code).toBe("scan_partial_failure")
    expect(store.scanSession.imported).toBe(true)
    expect(store.scanRemoveMissing).toBe(false)
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("preserved-disc")
    expect(store.driveDiscs).toHaveLength(2)
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("preserved-disc")
    expect(store.scanMessage).toContain("未删除缺失")
  })

  it("treats a configured non-level-15 stop as successful non-destructive completion", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "preserved-after-level-stop",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 2,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "atkFlat", value: 316 },
      subStats: [],
    })
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({
      items: [scannerDisc(1)],
      visited: 2,
      queued: 1,
      completed: 1,
      failed: 0,
      terminationCode: "non_level_15_stop",
    })

    expect(store.scanStatus).toBe("complete")
    expect(store.scanFailure).toBeNull()
    expect(store.scanErrorVariant).toBe("")
    expect(store.scanSession.partial).toBe(true)
    expect(store.scanSession.imported).toBe(true)
    expect(store.scanRemoveMissing).toBe(false)
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("preserved-after-level-stop")
    expect(store.driveDiscs).toHaveLength(2)
    expect(store.scanMessage).toContain("已按设置停止并安全导入 1 件")
    expect(store.scanMessage).toContain("未删除缺失")
  })

  it("completes without an error card when the first scanned disc triggers the configured level stop", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({
      items: [],
      visited: 1,
      queued: 0,
      completed: 0,
      failed: 0,
      partial: true,
      terminationCode: "non_level_15_stop",
    })

    expect(store.scanStatus).toBe("complete")
    expect(store.scanFailure).toBeNull()
    expect(store.scanErrorVariant).toBe("")
    expect(store.scanSession.partial).toBe(true)
    expect(store.scanMessage).toContain("扫描已按设置停止")
  })

  it("rejects malformed completion payloads and retains disconnect failures", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({ completed: 1 })
    expect(store.scanFailure?.code).toBe("scan_result_invalid")

    helper.scanning = false
    await store.startScan()
    await helper.onDisconnect?.({ code: "helper_disconnected", phase: "scan" })
    expect(store.scanStatus).toBe("error")
    expect(store.scanFailure?.code).toBe("helper_disconnected")
    expect(store.scanErrorVariant).toBe("diagnostic-failure")
  })

  it("waits for Scanner cancellation instead of immediately returning to ready", async () => {
    const store = useInventoryStore()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]

    store.stopScan()
    expect(store.scanStatus).toBe("stopping")

    await helper.onError?.({ code: "scan_cancelled", phase: "scan", severity: "warning" })
    expect(store.scanStatus).toBe("warning")
    expect(store.scanFailure?.code).toBe("scan_cancelled")
  })

  it("safely imports 549 retained items when the final item fails and ignores duplicate terminals", async () => {
    const store = useInventoryStore()
    await store.load()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    const helper = scannerMockState.instances[0]
    const retainedItems = Array.from({ length: 549 }, (_, index) => scannerDisc(index + 1, {
      partition: (index % 6) + 1,
      mainStat: { "生命值": 2201 + index },
    }))

    await helper.onError?.({
      code: "panel_read_timeout",
      phase: "scan",
      message: "最后一个驱动盘面板读取超时。",
      retainedItems,
      completed: 549,
      failed: 1,
    })

    expect(store.scanStatus).toBe("warning")
    expect(store.scanSession.imported).toBe(true)
    expect(store.driveDiscs).toHaveLength(549)
    expect(store.scanMessage).toContain("已安全导入 549 件")
    expect(store.scanMessage).toContain("未删除缺失")

    await helper.onDisconnect?.({
      code: "helper_disconnected",
      phase: "scan",
      retainedItems,
    })
    expect(store.driveDiscs).toHaveLength(549)
    expect(store.scanSession.summary.added).toBe(549)
  })

  it.each(["scanner_process_exited", "helper_disconnected"])(
    "auto-imports retained items exactly once for %s",
    async (code) => {
      const store = useInventoryStore()
      await store.load()
      scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
      await store.openScannerPanel()
      await store.startScan()
      const helper = scannerMockState.instances[0]
      const retainedItems = [scannerDisc(1)]

      if (code === "helper_disconnected") {
        await helper.onDisconnect?.({ code, phase: "scan", retainedItems })
      } else {
        await helper.onError?.({ code, phase: "scan", retainedItems })
      }
      await helper.onError?.({ code: "scan_stop_timeout", phase: "scan", retainedItems })

      expect(store.scanStatus).toBe("warning")
      expect(store.driveDiscs).toHaveLength(1)
      expect(store.scanSession.imported).toBe(true)
      expect(store.scanFailure?.code).toBe(code)
    },
  )

  it("treats a stream count mismatch as partial and imports without deletion", async () => {
    const store = useInventoryStore()
    await store.load()
    await store.saveDisc({
      id: "keep-on-mismatch",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 6,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "critRate", value: 24 },
      subStats: [],
    })
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({
      items: [scannerDisc(1)],
      itemCount: 2,
      completed: 2,
      streamIncomplete: true,
    })

    expect(store.scanStatus).toBe("warning")
    expect(store.scanFailure?.code).toBe("scan_result_stream_incomplete")
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("keep-on-mismatch")
    expect(store.driveDiscs).toHaveLength(2)
  })

  it("does not delete manual discs during complete Scanner synchronization", async () => {
    const store = useInventoryStore()
    await store.load()
    for (const rarity of ["S", "A", "B"]) {
      await store.saveDisc({
        id: `existing-${rarity}`,
        setId: "woodpecker_electro",
        setName: "啄木鸟电音",
        partition: rarity === "S" ? 1 : rarity === "A" ? 2 : 3,
        rarity,
        level: rarity === "S" ? 15 : 12,
        maxLevel: rarity === "S" ? 15 : 12,
        mainStat: { stat: "hpFlat", value: 2200 },
        subStats: [],
      })
    }
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    store.scanRemoveMissing = true
    await store.startScan()
    await store.confirmScanStart()
    const helper = scannerMockState.instances[0]

    await helper.onComplete?.({ items: [scannerDisc(1)], itemCount: 1, completed: 1 })

    expect(store.scanStatus).toBe("complete")
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("existing-S")
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("existing-A")
    expect(store.driveDiscs.map((disc: any) => disc.id)).toContain("existing-B")
  })

  it("retains scan results when automatic import fails and retries them", async () => {
    const store = useInventoryStore()
    await store.load()
    scannerMockState.connectResults.push({ version: "1.3.1", protocolVersion: 4 })
    await store.openScannerPanel()
    await store.startScan()
    const helper = scannerMockState.instances[0]
    const originalImport = store.importScannerPayload.bind(store)
    const importSpy = vi.spyOn(store, "importScannerPayload")
      .mockRejectedValueOnce(new Error("temporary storage failure"))
      .mockImplementation(originalImport)

    await helper.onComplete?.({ items: [scannerDisc(1)], itemCount: 1, completed: 1 })

    expect(store.scanFailure?.code).toBe("import_failed")
    expect(store.scanSession.payload).toHaveLength(1)
    expect(store.scanSession.imported).toBe(false)

    await store.handleScannerFailureAction("retry_import")

    expect(importSpy).toHaveBeenCalledTimes(2)
    expect(store.scanStatus).toBe("complete")
    expect(store.scanSession.imported).toBe(true)
    expect(store.driveDiscs).toHaveLength(1)
  })
})
