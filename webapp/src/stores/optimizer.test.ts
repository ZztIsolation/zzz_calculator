import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { reactive } from "vue"
import { useOptimizerStore } from "@/stores/optimizer"

class MockWorker {
  static instances: MockWorker[] = []
  static throwOnPostMessage = false
  onmessage: ((event: { data: any }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  messages: any[] = []
  terminated = false

  constructor() {
    MockWorker.instances.push(this)
  }

  postMessage(message: any) {
    if (MockWorker.throwOnPostMessage) {
      throw new Error("could not be cloned")
    }
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emit(message: any) {
    this.onmessage?.({ data: message })
  }

  fail(message = "worker failed") {
    this.onerror?.({ message })
  }
}

const catalog = { driveDiscSets: [{ id: "woodpecker_electro" }] }
const preferredCatalog = {
  driveDiscSets: [
    { id: "woodpecker_electro" },
    { id: "fanged_metal" },
  ],
}
const originalWorker = globalThis.Worker

function optimizerInput(overrides: any = {}) {
  return {
    ownerId: "default",
    agentId: "agent_a",
    label: "测试角色 / 测试音擎",
    ...overrides,
  }
}

function inventoryStore(overrides: any = {}) {
  return {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [{ id: "import-a", ownerId: "default" }],
    driveDiscLoadouts: [{ id: "loadout-a", ownerId: "default" }],
    driveDiscs: [],
    ...overrides,
  }
}

describe("optimizer store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem("zzz-calculator.webapp.optimizer.v1")
    MockWorker.instances = []
    MockWorker.throwOnPostMessage = false
    vi.stubGlobal("Worker", MockWorker)
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalWorker) {
      vi.stubGlobal("Worker", originalWorker)
    } else {
      delete (globalThis as any).Worker
    }
  })

  it("moves a manual cancel request to a settled cancelled state", () => {
    const store = useOptimizerStore()
    store.status = "running"
    store.cancel()
    expect(store.status).toBe("cancelled")
    expect(store.cancelRequested).toBe(true)
    expect(store.isBusy).toBe(false)
  })

  it("resets results and error together", () => {
    const store = useOptimizerStore()
    store.status = "error"
    store.error = "boom"
    store.results = [{ rank: 1 }]
    store.completedSettings = { ownerId: "default" }
    store.progress = { percent: 50 }
    store.reset()
    expect(store.status).toBe("idle")
    expect(store.error).toBe("")
    expect(store.results).toEqual([])
    expect(store.completedSettings).toBe(null)
    expect(store.progress).toBe(null)
  })

  it("can fail before starting a worker when the active account has no discs", () => {
    const store = useOptimizerStore()

    store.failBeforeRun("当前账号没有可用于优化的驱动盘。", { ownerId: "default" })

    expect(MockWorker.instances).toHaveLength(0)
    expect(store.status).toBe("error")
    expect(store.error).toContain("当前账号")
    expect(store.progress.status).toBe("error")
    expect(store.progress.metrics.candidateCountsBySlot).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
    expect(store.isBusy).toBe(false)
  })

  it("persists optimizer constraints and exposes them in worker input", () => {
    const store = useOptimizerStore()
    store.initialize({ driveDiscSets: [{ id: "woodpecker_electro" }] })
    store.setAlgorithm("heuristic-potential")
    store.setFourPieceSet("woodpecker_electro")
    store.setTwoPieceSetIds(["swing_jazz"])
    store.toggleMainStatLimit("4", "critRate")
    store.setMinimum("critRate", 50)
    store.setFourPieceBuffMode("manual")
    store.setFourPieceBuffRuntimeInput("driveDisc4pc:woodpecker_electro", { effects: {} })

    const input = store.inputWithSettings({ agentId: "agent_a" })
    expect(input.settings.algorithm).toBe("heuristic-potential")
    expect(input.settings.fourPieceSetId).toBe("woodpecker_electro")
    expect(input.settings.twoPieceSetIds).toEqual(["swing_jazz"])
    expect(input.settings.mainStatLimits["4"]).toEqual(["critRate"])
    expect(input.settings.minimums.critRate).toBe(50)
    expect(input.settings.fourPieceBuffMode).toBe("manual")
    expect(input.ownerId).toBe("default")
    expect(input.settings.ownerId).toBe("default")
  })

  it("uses the active agent preferred four-piece drive-disc set by default", () => {
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({
      fourPieceSetId: "woodpecker_electro",
    }))
    const store = useOptimizerStore()

    store.initialize(preferredCatalog, {
      id: "agent_a",
      preferredDriveDiscs: { defaultSetId: "fanged_metal" },
    })

    expect(store.fourPieceSetId).toBe("fanged_metal")
    expect(store.inputWithSettings({ agentId: "agent_a" }).settings.fourPieceSetId).toBe("fanged_metal")
  })

  it("preserves an explicitly selected four-piece drive-disc set on reload", () => {
    const agent = {
      id: "agent_a",
      preferredDriveDiscs: { defaultSetId: "fanged_metal" },
    }
    const store = useOptimizerStore()
    store.initialize(preferredCatalog, agent)
    store.setFourPieceSet("woodpecker_electro")

    setActivePinia(createPinia())
    const reloaded = useOptimizerStore()
    reloaded.initialize(preferredCatalog, agent)

    expect(reloaded.fourPieceSetId).toBe("woodpecker_electro")
  })

  it("updates the four-piece drive-disc set when the active agent changes", () => {
    const store = useOptimizerStore()
    store.initialize(preferredCatalog)

    store.applyAgentPreferredDriveDiscSet({
      id: "agent_b",
      preferredDriveDiscs: { defaultSetId: "fanged_metal" },
    }, preferredCatalog)

    expect(store.fourPieceSetId).toBe("fanged_metal")
  })

  it("applies advanced settings in one payload without changing worker input shape", () => {
    const store = useOptimizerStore()
    store.initialize({ driveDiscSets: [{ id: "woodpecker_electro" }] })

    store.applyAdvancedSettings({
      algorithm: "heuristic-potential",
      fourPieceBuffMode: "manual",
      fourPieceBuffRuntimeInputs: { "driveDisc4pc:woodpecker_electro.self": { coverage: 0.5 } },
      mainStatLimits: { "4": ["critRate"], "6": ["anomalyMastery"] },
      minimums: { critRate: 45 },
    })

    const input = store.inputWithSettings({ agentId: "agent_a" })
    expect(input.settings).toMatchObject({
      objective: "damage",
      algorithm: "heuristic-potential",
      fourPieceBuffMode: "manual",
      mainStatLimits: { "4": ["critRate"], "6": ["anomalyMastery"] },
      minimums: { critRate: 45 },
    })
    expect(input.settings.fourPieceBuffRuntimeInputs["driveDisc4pc:woodpecker_electro.self"]).toEqual({ coverage: 0.5 })
  })

  it("preserves progress envelope fields and stores completed results", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]
    const startMessage = worker.messages[0]

    worker.emit({
      type: "progress",
      runId: startMessage.runId,
      job: {
        status: "running",
        percent: 25,
        elapsedMs: 1200,
        evaluated: 5,
        estimatedCombinationCount: 20,
        metrics: {
          estimatedCombinationCount: 20,
          processedCombinationCount: 5,
          evaluationsPerSecond: 4,
        },
      },
    })

    expect(store.status).toBe("running")
    expect(store.progress.percent).toBe(25)
    expect(store.progress.elapsedMs).toBe(1200)
    expect(store.progress.evaluated).toBe(5)
    expect(store.metrics.evaluationsPerSecond).toBe(4)

    worker.emit({
      type: "complete",
      runId: startMessage.runId,
      result: {
        settings: {
          ownerId: "default",
          fourPieceBuffMode: "manual",
          fourPieceBuffRuntimeInputs: {
            "driveDisc4pc:woodpecker_electro.self": { coverage: 0.5 },
          },
        },
        metrics: {
          estimatedCombinationCount: 20,
          processedCombinationCount: 20,
          evaluationsPerSecond: 8,
        },
        results: [{
          rank: 1,
          score: 12345,
          driveDiscs: [{ id: "disc-a", partition: 1, setId: "woodpecker_electro" }],
        }],
      },
    })
    await runPromise

    expect(store.status).toBe("done")
    expect(store.progress.status).toBe("complete")
    expect(store.progress.percent).toBe(100)
    expect(store.results).toHaveLength(1)
    expect(store.resultSchemes[0].loadoutName).toContain("第 1 名")
    expect(store.completedSettings).toEqual({
      ownerId: "default",
      fourPieceBuffMode: "manual",
      fourPieceBuffRuntimeInputs: {
        "driveDisc4pc:woodpecker_electro.self": { coverage: 0.5 },
      },
    })
    expect(worker.terminated).toBe(true)
  })

  it("keeps preparation stage progress visible before enumeration starts", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]
    const startMessage = worker.messages[0]

    worker.emit({
      type: "progress",
      runId: startMessage.runId,
      job: {
        status: "preparing",
        prepareStage: "enumeration-plans",
        prepareStageLabel: "正在构建枚举计划",
        elapsedMs: 500,
        metrics: {
          prepareStage: "enumeration-plans",
          prepareStageLabel: "正在构建枚举计划",
          candidateCountsBySlot: { 1: 10, 2: 8 },
          estimatedCombinationCount: 0,
        },
      },
    })

    expect(store.status).toBe("preparing")
    expect(store.progress.prepareStageLabel).toBe("正在构建枚举计划")
    expect(store.progressMetrics.metrics.candidateCountsBySlot).toEqual({ 1: 10, 2: 8 })

    store.cancel()
    await runPromise
  })

  it("keeps the run active while surfacing the startup preview", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]
    const startMessage = worker.messages[0]

    worker.emit({
      type: "preview",
      runId: startMessage.runId,
      job: {
        status: "preview",
        settings: { ownerId: "default" },
        estimatedCombinationCount: 1200,
        percent: 0,
        elapsedMs: 180,
        metrics: {
          estimatedCombinationCount: 1200,
          candidateCountsBySlot: { 1: 10, 2: 10, 3: 8, 4: 6, 5: 5, 6: 5 },
          algorithmLabel: "精确超级上界剪枝",
        },
      },
    })

    expect(store.status).toBe("running")
    expect(store.isBusy).toBe(true)
    expect(store.progress.status).toBe("preview")
    expect(store.progress.estimatedCombinationCount).toBe(1200)
    expect(store.progress.elapsedMs).toBe(180)
    expect(store.progress.metrics.candidateCountsBySlot["4"]).toBe(6)

    store.cancel()
    await runPromise
  })

  it("terminates the active worker and resolves run immediately on cancel", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]

    store.cancel()
    await runPromise

    expect(worker.terminated).toBe(true)
    expect(store.status).toBe("cancelled")
    expect(store.progress.status).toBe("cancelled")
    expect(store.isBusy).toBe(false)
  })

  it("fails and terminates the worker when no progress returns for too long", async () => {
    vi.useFakeTimers()
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]

    await vi.advanceTimersByTimeAsync(45_000)
    await runPromise

    expect(worker.terminated).toBe(true)
    expect(store.status).toBe("error")
    expect(store.error).toContain("长时间没有返回进度")
    expect(store.isBusy).toBe(false)
  })

  it("surfaces worker postMessage clone failures instead of staying busy", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)
    MockWorker.throwOnPostMessage = true

    await store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]

    expect(worker.terminated).toBe(true)
    expect(store.status).toBe("error")
    expect(store.error).toContain("could not be cloned")
    expect(store.isBusy).toBe(false)
  })

  it("sends a trimmed current-owner payload to the optimizer worker", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)
    const sourceStore = inventoryStore({
      currentOwnerId: "alice",
      owners: [
        { id: "default", label: "默认用户" },
        { id: "alice", label: "Alice" },
      ],
      driveDiscs: [
        {
          id: "alice-disc",
          ownerId: "alice",
          setId: "woodpecker_electro",
          setName: "啄木鸟电音",
          partition: 1,
          rarity: "S",
          level: 15,
          mainStat: { stat: "hpFlat", value: 2200 },
          subStats: [{ stat: "critRate", value: 4.8 }],
          source: { type: "scanner", sequence: 1, rawIndex: 3, bulky: true },
        },
        {
          id: "default-disc",
          ownerId: "default",
          setId: "swing_jazz",
          partition: 1,
          mainStat: { stat: "hpFlat", value: 1200 },
          subStats: [],
        },
      ],
    })

    const runPromise = store.run(catalog, reactive(sourceStore), optimizerInput({ ownerId: "alice" }))
    const worker = MockWorker.instances[0]
    const startMessage = worker.messages[0]

    expect(() => structuredClone(startMessage)).not.toThrow()
    expect(startMessage.input.ownerId).toBe("alice")
    expect(startMessage.input.settings.ownerId).toBe("alice")
    expect(startMessage.store.currentOwnerId).toBe("alice")
    expect(startMessage.store.imports).toEqual([])
    expect(startMessage.store.driveDiscLoadouts).toEqual([])
    expect(startMessage.store.driveDiscs.map((disc: any) => disc.id)).toEqual(["alice-disc"])
    expect(startMessage.store.driveDiscs[0].source).toEqual({ type: "scanner", sequence: 1, rawIndex: 3 })

    store.cancel()
    await runPromise
  })

  it("surfaces an empty-result reason after a completed worker run", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const runPromise = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]
    const startMessage = worker.messages[0]

    worker.emit({
      type: "complete",
      runId: startMessage.runId,
      result: {
        settings: { ownerId: "default" },
        metrics: {
          estimatedCombinationCount: 0,
          processedCombinationCount: 0,
        },
        results: [],
        error: {
          isError: true,
          reason: "没有符合筛选条件的 4 号位驱动盘。",
        },
      },
    })
    await runPromise

    expect(store.status).toBe("error")
    expect(store.progress.status).toBe("error")
    expect(store.error).toBe("没有符合筛选条件的 4 号位驱动盘。")
    expect(store.resultSchemes).toEqual([])
  })
})
