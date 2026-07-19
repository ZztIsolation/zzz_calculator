import { loadCatalog } from "@runtime/catalog-loader.js"

declare global {
  interface Window {
    __optimizerBenchmarkResult?: any
  }
}

const params = new URLSearchParams(location.search)
const measuredRuns = Math.max(1, Number(params.get("runs") ?? 5))
const variants = Math.max(2, Number(params.get("variants") ?? 3))
const enableObjectiveScalarKernel = params.get("kernel") !== "0"
const output = document.querySelector<HTMLPreElement>("#output")!

async function main() {
const catalog = await loadCatalog()
const exampleInput = catalog.examples.yeShunguang.input
const fourSet = "woodpecker_electro"
const twoSet = "hormone_punk"
const thirdSet = catalog.driveDiscSets.find((set: any) => ![fourSet, twoSet].includes(set.id))?.id ?? twoSet
const slotMain: Record<number, any> = {
  1: { stat: "hpFlat", value: 2200 },
  2: { stat: "atkFlat", value: 316 },
  3: { stat: "defFlat", value: 184 },
  4: { stat: "critRate", value: 24, mode: "pct" },
  5: { stat: "physicalDmg", value: 30, mode: "pct" },
  6: { stat: "atkPct", value: 30, mode: "pct" },
}
const subStatPool = ["critRate", "critDmg", "atkPct", "penRatio", "anomalyProficiency", "atkFlat"]

function disc(id: string, setId: string, partition: number, variant: number, mainStat = slotMain[partition]) {
  return {
    id,
    ownerId: "default",
    setId,
    setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
    partition,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: false,
    equippedBy: null,
    mainStat: { ...mainStat, mode: mainStat.mode ?? "flat" },
    subStats: Array.from({ length: 4 }, (_, index) => {
      const stat = subStatPool[(variant + index + partition) % subStatPool.length]
      const value = stat === "critRate"
        ? 2.4 + ((variant + partition) % 4) * 1.2
        : stat === "critDmg"
          ? 4.8 + ((variant + partition) % 5) * 2.4
          : stat === "atkFlat"
            ? 19 + ((variant + partition) % 5) * 19
            : stat === "anomalyProficiency"
              ? 9 + ((variant + partition) % 5) * 9
              : 3 + ((variant + partition + index) % 5) * 1.5
      return { stat, value, mode: ["atkFlat", "anomalyProficiency"].includes(stat) ? "flat" : "pct" }
    }),
    source: { type: "browser-benchmark", sequence: variant + partition * 100 },
  }
}

function store(setIds: string[], mainStatOverrides: Record<number, any> = {}) {
  const driveDiscs = []
  for (const partition of [1, 2, 3, 4, 5, 6]) {
    for (let setIndex = 0; setIndex < setIds.length; setIndex += 1) {
      for (let variant = 0; variant < variants; variant += 1) {
        driveDiscs.push(disc(
          `${setIndex}-${partition}-${variant}`,
          setIds[setIndex],
          partition,
          variant + setIndex * variants,
          mainStatOverrides[partition] ?? slotMain[partition],
        ))
      }
    }
  }
  return {
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "default" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs,
  }
}

function input(damage: any, freeTwoPiece = false, agent: any = {}) {
  return {
    agentId: agent.agentId ?? exampleInput.agentId,
    coreSkillLevel: agent.coreSkillLevel ?? exampleInput.coreSkillLevel,
    wEngineId: agent.wEngineId ?? exampleInput.wEngineId,
    wEngineModificationLevel: agent.wEngineModificationLevel ?? exampleInput.wEngineModificationLevel,
    combatBuffs: { activeBuffIds: [] },
    damage,
    settings: {
      objective: "damage",
      algorithm: "exact-super-bound",
      fourPieceSetId: fourSet,
      ...(freeTwoPiece ? {} : { twoPieceSetId: twoSet }),
      enableUpperBoundPruning: true,
      enableObjectiveScalarKernel,
      disableParallel: true,
    },
  }
}

const scenarios = [
  {
    id: "direct-fixed-4+2",
    store: store([fourSet, twoSet]),
    input: input({ events: [{ id: "direct", kind: "direct", damageElement: "physical", skillMultiplier: 100, critMode: "expected" }] }),
  },
  {
    id: "direct-auto-4+2-6",
    store: store([fourSet, twoSet, thirdSet]),
    input: input({ events: [{ id: "direct", kind: "direct", damageElement: "physical", skillMultiplier: 100, critMode: "expected" }] }, true),
  },
  {
    id: "anomaly",
    store: store([fourSet, twoSet]),
    input: input({ agentLevel: 60, events: [{ id: "anomaly", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", damageElement: "physical" }] }),
  },
  {
    id: "disorder",
    store: store([fourSet, twoSet]),
    input: input({ agentLevel: 60, events: [{ id: "disorder", kind: "anomaly", settlementType: "disorder", previousAnomalyEffect: "flinch", damageElement: "physical" }] }),
  },
  {
    id: "sheer",
    store: store([fourSet, twoSet], {
      5: { stat: "etherDmg", value: 30, mode: "pct" },
      6: { stat: "hpPct", value: 30, mode: "pct" },
    }),
    input: input(
      { events: [{ id: "sheer", kind: "sheer", damageElement: "ether", skillMultiplier: 100, critMode: "expected" }] },
      false,
      { agentId: "yixuan", coreSkillLevel: "F", wEngineId: "zzz_wiki_1342", wEngineModificationLevel: 1 },
    ),
  },
]

const worker = new Worker(new URL("../workers/optimizer.worker.ts", import.meta.url), { type: "module" })
let catalogSent = false

function runScenario(scenario: any) {
  return new Promise<any>((resolve, reject) => {
    const runId = `benchmark-${scenario.id}-${performance.now()}`
    const startedAt = performance.now()
    let workerStartedMs = 0
    let previewMs = 0
    worker.onmessage = event => {
      const message = event.data ?? {}
      if (message.runId !== runId) return
      if (message.type === "started") workerStartedMs = performance.now() - startedAt
      if (message.type === "preview") previewMs = performance.now() - startedAt
      if (message.type === "error" || message.type === "cancelled") {
        reject(new Error(message.error ?? `benchmark ${message.type}`))
      }
      if (message.type === "complete") {
        resolve({
          elapsedMs: performance.now() - startedAt,
          workerStartedMs,
          previewMs,
          top: message.result.results.slice(0, 10).map((result: any) => ({
            score: result.score,
            ids: result.driveDiscs.map((item: any) => item.id),
          })),
          metrics: message.result.metrics,
          error: message.result.error,
        })
      }
    }
    worker.onerror = event => reject(new Error(event.message))
    worker.postMessage({
      type: "start",
      runId,
      ...(!catalogSent ? { catalog } : {}),
      store: scenario.store,
      input: scenario.input,
      settings: { progressIntervalMs: 200, yieldIntervalMs: 50 },
    })
    catalogSent = true
  })
}

function median(values: any[]) {
  return [...values].sort((left, right) => left.elapsedMs - right.elapsedMs)[Math.floor(values.length / 2)]
}

try {
  const results = []
  for (const scenario of scenarios) {
    await runScenario(scenario)
    const samples = []
    for (let run = 0; run < measuredRuns; run += 1) samples.push(await runScenario(scenario))
    const selected = median(samples)
    results.push({
      id: scenario.id,
      elapsedMs: selected.elapsedMs,
      workerStartedMs: selected.workerStartedMs,
      preparationMs: selected.metrics.preparationMs,
      planBuildMs: selected.metrics.planBuildMs,
      previewMs: selected.previewMs,
      warmupMs: selected.metrics.warmupMs,
      boundCheckMs: selected.metrics.boundCheckMs,
      fullResultMs: selected.metrics.fullResultMs,
      objectiveScalarCalls: selected.metrics.objectiveScalarCalls,
      fallbackReason: selected.metrics.objectiveScalarFallbackReason,
      error: selected.error,
      top: selected.top,
    })
    output.textContent = JSON.stringify({ status: "running", enableObjectiveScalarKernel, results }, null, 2)
  }
  const report = { status: "complete", measuredRuns, variants, enableObjectiveScalarKernel, results }
  window.__optimizerBenchmarkResult = report
  output.textContent = JSON.stringify(report, null, 2)
} catch (error) {
  const report = { status: "error", error: error instanceof Error ? error.message : String(error) }
  window.__optimizerBenchmarkResult = report
  output.textContent = JSON.stringify(report, null, 2)
} finally {
  worker.terminate()
}
}

void main()
