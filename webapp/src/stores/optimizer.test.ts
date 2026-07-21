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
    { id: "swing_jazz" },
  ],
}
const preferredAgentA = {
  id: "agent_a",
  preferredDriveDiscs: { defaultSetId: "woodpecker_electro" },
}
const preferredAgentB = {
  id: "agent_b",
  preferredDriveDiscs: { defaultSetId: "fanged_metal" },
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
    useOptimizerStore().disposeRuntime()
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
    store.initialize({ driveDiscSets: [{ id: "woodpecker_electro" }, { id: "swing_jazz" }] })
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

  it("drops saved hidden optimizer sets and falls back to the first visible set", () => {
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({
      fourPieceSetId: "hidden_set",
      fourPieceSetSource: "manual",
      twoPieceSetIds: ["hidden_set", "visible_two_piece"],
    }))
    const store = useOptimizerStore()
    const visibilityCatalog = {
      driveDiscSets: [
        { id: "hidden_set" },
        { id: "visible_four_piece" },
        { id: "visible_two_piece" },
      ],
      displayDriveDiscSets: [
        { id: "visible_four_piece" },
        { id: "visible_two_piece" },
      ],
    }

    store.initialize(visibilityCatalog, {
      id: "agent_a",
      preferredDriveDiscs: { defaultSetId: "hidden_set" },
    })

    expect(store.fourPieceSetId).toBe("visible_four_piece")
    expect(store.fourPieceSetSource).toBe("preferred")
    expect(store.twoPieceSetIds).toEqual(["visible_two_piece"])
  })

  it("keeps optimizer set selections empty when no sets are visible", () => {
    const store = useOptimizerStore()
    store.initialize({
      driveDiscSets: [{ id: "hidden_set" }],
      displayDriveDiscSets: [],
    }, {
      id: "agent_a",
      preferredDriveDiscs: { defaultSetId: "hidden_set" },
    })

    expect(store.fourPieceSetId).toBe("")
    expect(store.twoPieceSetIds).toEqual([])
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
    const store = useOptimizerStore()
    store.initialize(preferredCatalog, preferredAgentB)
    store.setFourPieceSet("woodpecker_electro")

    setActivePinia(createPinia())
    const reloaded = useOptimizerStore()
    reloaded.initialize(preferredCatalog, preferredAgentB)

    expect(reloaded.fourPieceSetId).toBe("woodpecker_electro")
  })

  it("keeps optimizer constraints scoped to each active agent", () => {
    const store = useOptimizerStore()
    store.initialize(preferredCatalog, preferredAgentA)
    store.setAlgorithm("heuristic-potential")
    store.setFourPieceSet("woodpecker_electro")
    store.setTwoPieceSetIds(["swing_jazz"])
    store.setFourPieceBuffMode("manual")
    store.setFourPieceBuffRuntimeInput("driveDisc4pc:woodpecker_electro.self", { coverage: 0.5 })
    store.toggleMainStatLimit("4", "critRate")
    store.setMinimum("critRate", 50)

    store.loadAgentSettings(preferredAgentB, preferredCatalog)

    expect(store.fourPieceSetId).toBe("fanged_metal")
    expect(store.fourPieceSetSource).toBe("preferred")
    expect(store.algorithm).toBe("exact-super-bound")
    expect(store.twoPieceSetIds).toEqual([])
    expect(store.fourPieceBuffMode).toBe("auto")
    expect(store.fourPieceBuffRuntimeInputs).toEqual({})
    expect(store.mainStatLimits).toEqual({ "4": [], "5": [], "6": [] })
    expect(store.minimums).toEqual({})

    store.setAlgorithm("exact-legacy")
    store.setTwoPieceSetIds(["fanged_metal"])
    store.loadAgentSettings(preferredAgentA, preferredCatalog)

    expect(store.algorithm).toBe("heuristic-potential")
    expect(store.fourPieceSetId).toBe("woodpecker_electro")
    expect(store.fourPieceSetSource).toBe("manual")
    expect(store.twoPieceSetIds).toEqual(["swing_jazz"])
    expect(store.fourPieceBuffMode).toBe("manual")
    expect(store.fourPieceBuffRuntimeInputs["driveDisc4pc:woodpecker_electro.self"]).toEqual({ coverage: 0.5 })
    expect(store.mainStatLimits["4"]).toEqual(["critRate"])
    expect(store.minimums.critRate).toBe(50)

    store.loadAgentSettings(preferredAgentB, preferredCatalog)

    expect(store.algorithm).toBe("exact-legacy")
    expect(store.twoPieceSetIds).toEqual(["fanged_metal"])
  })

  it("migrates legacy flat optimizer settings to only the initialized agent", () => {
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({
      algorithm: "heuristic-potential",
      fourPieceSetId: "woodpecker_electro",
      fourPieceSetSource: "manual",
      twoPieceSetIds: ["swing_jazz"],
      fourPieceBuffMode: "manual",
      fourPieceBuffRuntimeInputs: { "driveDisc4pc:woodpecker_electro.self": { coverage: 0.5 } },
      mainStatLimits: { "4": ["critRate"] },
      minimums: { critRate: 50 },
    }))
    const store = useOptimizerStore()

    store.initialize(preferredCatalog, preferredAgentA)

    expect(store.algorithm).toBe("heuristic-potential")
    expect(store.fourPieceSetId).toBe("woodpecker_electro")
    expect(store.twoPieceSetIds).toEqual(["swing_jazz"])
    expect(store.mainStatLimits["4"]).toEqual(["critRate"])
    expect(store.minimums.critRate).toBe(50)

    store.loadAgentSettings(preferredAgentB, preferredCatalog)

    expect(store.algorithm).toBe("exact-super-bound")
    expect(store.fourPieceSetId).toBe("fanged_metal")
    expect(store.twoPieceSetIds).toEqual([])
    expect(store.mainStatLimits).toEqual({ "4": [], "5": [], "6": [] })
    expect(store.minimums).toEqual({})

    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.optimizer.v1") || "{}")
    expect(saved.version).toBe(2)
    expect(saved.currentAgentId).toBe("agent_b")
    expect(saved.byAgent.agent_a.twoPieceSetIds).toEqual(["swing_jazz"])
    expect(saved.byAgent.agent_b.twoPieceSetIds).toEqual([])
  })

  it("drops removed fields and legacy defaults while preserving custom minimums", () => {
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({
      version: 2,
      currentAgentId: "agent_a",
      byAgent: {
        agent_a: {
          fourPieceSetId: "woodpecker_electro",
          fourPieceSetSource: "manual",
          minimumDefaultsVersion: 1,
          minimums: { atk: 2500, anomalyProficiency: 250, critRate: 50, critDmg: 160, energyRegen: 140 },
        },
      },
    }))
    const store = useOptimizerStore()

    store.initialize(preferredCatalog, preferredAgentA)

    expect(store.minimums).toEqual({ critRate: 50 })
    expect(store.minimums).not.toHaveProperty("energyRegen")
    store.setMinimum("energyRegen", 160)
    expect(store.minimums).not.toHaveProperty("energyRegen")
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.optimizer.v1") || "{}")
    expect(saved.byAgent.agent_a.minimums).not.toHaveProperty("energyRegen")
    expect(saved.byAgent.agent_a.minimumDefaultsVersion).toBe(2)
    expect(saved.byAgent.agent_a.minimums).toEqual({ critRate: 50 })

    store.setMinimum("atk", null)
    setActivePinia(createPinia())
    const reloaded = useOptimizerStore()
    reloaded.initialize(preferredCatalog, preferredAgentA)
    expect(reloaded.minimums.atk).toBe(null)
    expect(reloaded.minimums).not.toHaveProperty("anomalyProficiency")
  })

  it("silently migrates the removed browser parallel algorithm to strict serial exact", () => {
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", JSON.stringify({
      version: 2,
      currentAgentId: "agent_a",
      byAgent: {
        agent_a: {
          algorithm: "exact-super-bound-parallel",
          fourPieceSetId: "woodpecker_electro",
          fourPieceSetSource: "manual",
          twoPieceSetIds: ["swing_jazz"],
        },
      },
    }))
    const store = useOptimizerStore()

    store.initialize(preferredCatalog, preferredAgentA)

    expect(store.algorithm).toBe("exact-super-bound")
    expect(store.inputWithSettings({ agentId: "agent_a" }).settings.algorithm).toBe("exact-super-bound")
    const saved = JSON.parse(localStorage.getItem("zzz-calculator.webapp.optimizer.v1") || "{}")
    expect(saved.byAgent.agent_a.algorithm).toBe("exact-super-bound")
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
    expect(worker.terminated).toBe(false)
  })

  it("reuses one worker and transfers an unchanged catalog only once", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const firstRun = store.run(catalog, inventoryStore(), optimizerInput())
    const worker = MockWorker.instances[0]
    const firstMessage = worker.messages[0]
    expect(firstMessage.catalog).toEqual(catalog)
    worker.emit({
      type: "complete",
      runId: firstMessage.runId,
      result: {
        settings: { ownerId: "default" },
        metrics: { estimatedCombinationCount: 1, processedCombinationCount: 1 },
        results: [{ rank: 1, score: 1, driveDiscs: [] }],
      },
    })
    await firstRun

    const secondRun = store.run(catalog, inventoryStore(), optimizerInput())
    const secondMessage = worker.messages[1]
    expect(MockWorker.instances).toHaveLength(1)
    expect(secondMessage.catalog).toBeUndefined()
    worker.emit({
      type: "complete",
      runId: secondMessage.runId,
      result: {
        settings: { ownerId: "default" },
        metrics: { estimatedCombinationCount: 1, processedCombinationCount: 1 },
        results: [{ rank: 1, score: 1, driveDiscs: [] }],
      },
    })
    await secondRun
    expect(worker.terminated).toBe(false)
  })

  it("creates a fresh worker and retransfers catalog after cancellation", async () => {
    const store = useOptimizerStore()
    store.initialize(catalog)

    const firstRun = store.run(catalog, inventoryStore(), optimizerInput())
    store.cancel()
    await firstRun

    const secondRun = store.run(catalog, inventoryStore(), optimizerInput())
    const secondWorker = MockWorker.instances[1]
    expect(MockWorker.instances).toHaveLength(2)
    expect(secondWorker.messages[0].catalog).toEqual(catalog)
    store.cancel()
    await secondRun
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
