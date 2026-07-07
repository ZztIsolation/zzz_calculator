<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from "vue"
import { NButton, NCheckbox, NInputNumber, NModal, NSelect, NTabPane, NTabs, NTag } from "naive-ui"
import { LineChart, RefreshCcw, Save, SlidersHorizontal, Sparkles, X } from "lucide-vue-next"
import BuffPickerModal from "@/components/BuffPickerModal.vue"
import CalculationConfigModal from "@/components/CalculationConfigModal.vue"
import DamageSummaryBar from "@/components/DamageSummaryBar.vue"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"
import DriveDiscAnalysisModal from "@/components/DriveDiscAnalysisModal.vue"
import EnemyTargetConfigPanel from "@/components/EnemyTargetConfigPanel.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import PanelStatTable from "@/components/PanelStatTable.vue"
import { imageForAgent, imageForDriveDiscSet, imageForWEngine } from "@/utils/assets"
import { buffLabelForId } from "@/utils/combatBuffs"
import {
  attributeLabel,
  buffDisplayName,
  buffEffectLines,
  damageEventSummaryTitle,
  damageModeLabel,
  entityMetaText,
  entitySearchText,
  entitySelectLabel,
  formatNumber,
  formatStoredStatValue,
  labelOf,
  optimizerStatusLabel,
  skillCategoryLabel,
  statLabel,
  storedStatLabel,
} from "@/utils/format"
import { SKILL_CATEGORIES, activeDriveDisc4pcBuffIds, useBuildStore } from "@/stores/build"
import { useAccountStore } from "@/stores/account"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"
import { useOptimizerStore } from "@/stores/optimizer"
import {
  damageSkillRowsWithGeneratedTotals,
  defaultSkillLevel,
  normalizeSkillLevel,
  skillLevelLabel,
  skillLevelValues,
} from "@core/skillMultiplierCandidates.js"
import {
  defaultRuntimeForBuff,
  normalizeRuntimeForBuff,
  runtimeSourceGroups,
  runtimeStackGroups,
} from "@core/shared-combat.js"

const catalogStore = useCatalogStore()
const accountStore = useAccountStore()
const inventoryStore = useInventoryStore()
const buildStore = useBuildStore()
const optimizerStore = useOptimizerStore()

const showBuffPicker = ref(false)
const showCalculationConfig = ref(false)
const showDriveDiscAnalysis = ref(false)
const showOptimizedApplyConfirm = ref(false)
const showFourPieceSetModal = ref(false)
const showTwoPieceSetModal = ref(false)
const pendingOptimizedRank = ref(0)
const selectedOptimizerResultRank = ref(0)
const draftFourPieceSetId = ref("")
const draftTwoPieceSetIds = ref<string[]>([])
const OPTIMIZED_RESULT_LIMIT = 5
const OPTIMIZER_RESULT_SLOTS = [1, 2, 3, 4, 5, 6]

onMounted(async () => {
  await Promise.all([catalogStore.load(), accountStore.load()])
  await inventoryStore.load()
  if (catalogStore.catalog && catalogStore.meta) {
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    optimizerStore.initialize(catalogStore.catalog)
    if (!optimizerStore.fourPieceSetId) {
      optimizerStore.setFourPieceSet(catalogStore.driveDiscSets[0]?.id ?? "")
    }
    recalculate()
  }
})

watch(() => accountStore.currentOwnerId, async () => {
  await inventoryStore.load()
  optimizerStore.reset()
  if (catalogStore.catalog && catalogStore.meta) {
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
  }
  recalculate()
})

const selectedAgent = computed(() => catalogStore.agents.find((item: any) => item.id === buildStore.agentId))
const selectedWEngine = computed(() => catalogStore.wEngines.find((item: any) => item.id === buildStore.wEngineId))
const selectedSkillCatalog = computed(() => catalogStore.meta?.agentSkills?.find((item: any) => item.id === buildStore.agentId || item.agentId === buildStore.agentId))
const agentSelectOptions = computed(() => catalogStore.agents.map((agent: any) => ({
  label: entitySelectLabel(agent),
  value: agent.id,
  searchText: entitySearchText(agent),
})))
const wEngineOptions = computed(() => buildStore.wEnginesForAgent(catalogStore.meta))
const wEngineSelectOptions = computed(() => wEngineOptions.value.map((wEngine: any) => ({
  label: entitySelectLabel(wEngine),
  value: wEngine.id,
  searchText: entitySearchText(wEngine),
  wEngine,
})))
const selectedOptimizedScheme = computed(() => optimizerStore.selectedResult(buildStore.selectedOptimizedRank))
const pendingOptimizedScheme = computed(() => optimizerStore.selectedResult(pendingOptimizedRank.value))
const selectedDriveDiscs = computed(() => inventoryStore.calculatorDriveDiscs({
  mode: buildStore.discMode,
  idsBySlot: buildStore.manualDriveDiscIdsBySlot,
  loadoutId: buildStore.selectedLoadoutId,
  optimizedDriveDiscs: selectedOptimizedScheme.value?.driveDiscs ?? [],
}))
const selectedOptimizedRuntimeInputs = computed(() => {
  if (buildStore.discMode !== "optimized" || !catalogStore.catalog || !selectedOptimizedScheme.value) {
    return {}
  }
  const settings = optimizerStore.completedSettings ?? optimizerStore.progress?.settings ?? null
  if (settings?.fourPieceBuffMode !== "manual") {
    return {}
  }
  const source = settings.fourPieceBuffRuntimeInputs
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {}
  }
  return Object.fromEntries(
    activeDriveDisc4pcBuffIds(catalogStore.catalog, selectedDriveDiscs.value)
      .map(id => [id, source[id]] as [string, any])
      .filter(([, runtime]) => runtime && typeof runtime === "object" && !Array.isArray(runtime))
      .map(([id, runtime]) => [id, JSON.parse(JSON.stringify(runtime))]),
  )
})
const selectedBuildOptions = computed(() => ({
  runtimeInputs: selectedOptimizedRuntimeInputs.value,
}))
const selectedLoadout = computed(() => inventoryStore.loadouts.find((item: any) => item.id === buildStore.selectedLoadoutId))
const loadoutOptions = computed(() => [
  { label: "选择套装预设", value: "" },
  ...inventoryStore.loadouts.map((item: any) => ({ label: item.name || item.id, value: item.id })),
])
const driveDiscAnalysisInput = computed(() => {
  if (!catalogStore.catalog || !catalogStore.meta || !buildStore.agentId || !buildStore.wEngineId) {
    return null
  }
  try {
    return buildStore.buildInput(catalogStore.catalog, catalogStore.meta, selectedDriveDiscs.value, selectedBuildOptions.value)
  } catch {
    return null
  }
})
const driveDiscAnalysisSourceLabel = computed(() => {
  if (buildStore.discMode === "optimized") {
    return selectedOptimizedScheme.value
      ? `优化结果：第 ${selectedOptimizedScheme.value.rank} 名 · ${formatNumber(selectedOptimizedScheme.value.score, 0)}`
      : "优化结果"
  }
  if (buildStore.discMode === "loadout") {
    return selectedLoadout.value ? `套装预设：${selectedLoadout.value.name || selectedLoadout.value.id}` : "套装预设"
  }
  return "手动选择"
})
const coreSkillOptions = computed(() => {
  const levels = selectedAgent.value?.coreSkill?.levels ?? []
  return [
    { label: "无核心技", value: "none" },
    ...levels.map((level: any) => {
      const value = String(level.level)
      const label = String(level.label?.zhCN ?? level.label?.en ?? value)
      return {
        label: label && label !== value ? `${value} - ${label}` : value,
        value: level.level,
      }
    }),
  ]
})
const cinemaLevelOptions = Array.from({ length: 7 }, (_, level) => ({ label: `${level} 影`, value: level }))
const modificationOptions = computed(() => {
  const min = Number(selectedWEngine.value?.modification?.minLevel ?? 1)
  const max = Number(selectedWEngine.value?.modification?.maxLevel ?? 5)
  return Array.from({ length: Math.max(1, max - min + 1) }, (_, index) => {
    const value = min + index
    return { label: `${value} 精`, value }
  })
})
const optimizerSetChoices = computed(() => [...catalogStore.driveDiscSets].sort((left: any, right: any) => labelOf(left).localeCompare(labelOf(right), "zh-CN")))
const selectedOptimizerSet = computed(() => catalogStore.driveDiscSets.find((set: any) => set.id === optimizerStore.fourPieceSetId))
const draftFourPieceSet = computed(() => catalogStore.driveDiscSets.find((set: any) => set.id === draftFourPieceSetId.value))
const selectedTwoPieceSets = computed(() => optimizerStore.twoPieceSetIds
  .map(id => catalogStore.driveDiscSets.find((set: any) => set.id === id))
  .filter(Boolean))
const optimizerAlgorithmOptions = [
  { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
  { label: "精确搜索（并行）", value: "exact-super-bound-parallel" },
  { label: "启发式潜力", value: "heuristic-potential" },
  { label: "旧版精确", value: "exact-legacy" },
]
const minimumStats = [
  { key: "energyRegen", label: "能量自动回复%" },
  { key: "anomalyProficiency", label: "异常精通" },
  { key: "critRate", label: "暴击率%" },
  { key: "critDmg", label: "暴击伤害%" },
]
const mainStatOptionsBySlot = computed(() => {
  const pools = catalogStore.meta?.statRules?.driveDisc?.mainStatPools ?? {}
  const fallback = ["critRate", "critDmg", "atkPct", "hpPct", "defPct", "anomalyProficiency", "anomalyMastery", "energyRegen"]
  return Object.fromEntries([4, 5, 6].map(slot => {
    const pool = pools[String(slot)] ?? fallback
    return [String(slot), pool.map((stat: string) => ({ label: statLabel(stat, catalogStore.meta), value: stat }))]
  }))
})
const draftTwoPieceSetSummary = computed(() => {
  const count = draftTwoPieceSetIds.value.length
  return count ? `已选择 ${count} 个额外 2 件套` : "未选择额外 2 件套"
})
const twoPieceDraftUnchanged = computed(() => [...draftTwoPieceSetIds.value].sort().join("|") === [...optimizerStore.twoPieceSetIds].sort().join("|"))
const topOptimizedResultSchemes = computed(() => optimizerStore.resultSchemes.slice(0, OPTIMIZED_RESULT_LIMIT))
const optimizedRankOptions = computed(() => topOptimizedResultSchemes.value.map((scheme: any) => ({
  label: `第 ${scheme.rank} 名 · ${formatNumber(scheme.score)}`,
  value: scheme.rank,
})))
const selectedOptimizerResultScheme = computed(() => {
  const rank = Number(selectedOptimizerResultRank.value)
  return topOptimizedResultSchemes.value.find((scheme: any) => Number(scheme.rank) === rank)
    ?? topOptimizedResultSchemes.value[0]
    ?? null
})
const selectedOptimizerResultRows = computed<Array<{ slot: number, disc: any | null }>>(() => {
  const bySlot = new Map<number, any>(
    (selectedOptimizerResultScheme.value?.driveDiscs ?? [])
      .map((disc: any) => [Number(disc.partition), disc] as [number, any]),
  )
  return OPTIMIZER_RESULT_SLOTS.map(slot => ({
    slot,
    disc: bySlot.get(slot) ?? null,
  }))
})
const selectedOptimizerResultDiscCount = computed(() => selectedOptimizerResultRows.value.filter(row => row.disc).length)
watch(optimizedRankOptions, options => {
  const values = options.map(option => Number(option.value))
  if (!values.length) {
    selectedOptimizerResultRank.value = 0
    return
  }
  if (!values.includes(Number(selectedOptimizerResultRank.value))) {
    selectedOptimizerResultRank.value = values[0]
  }
}, { immediate: true })
const skillLevelControls = computed(() => SKILL_CATEGORIES.map(categoryId => {
  const category = selectedSkillCatalog.value?.categories?.find((item: any) => item.id === categoryId)
  if (!category) {
    return {
      id: categoryId,
      label: skillCategoryLabel(categoryId),
      value: Number(buildStore.skillLevels[categoryId] ?? 12),
      options: Array.from({ length: 16 }, (_, index) => ({ label: `LV${index + 1}`, value: index + 1 })),
      summary: "暂无倍率目录，按等级保存",
    }
  }
  const firstMove = (category.moves ?? []).find((move: any) => damageSkillRowsWithGeneratedTotals(category, move).length)
  const firstRow = firstMove ? damageSkillRowsWithGeneratedTotals(category, firstMove)[0] : null
  if (!firstMove || !firstRow) {
    return {
      id: categoryId,
      label: skillCategoryLabel(categoryId, category),
      value: Number(buildStore.skillLevels[categoryId] ?? 12),
      options: Array.from({ length: 16 }, (_, index) => ({ label: `LV${index + 1}`, value: index + 1 })),
      summary: "暂无可选伤害倍率，按等级保存",
    }
  }
  const value = normalizeSkillLevel(category, firstMove, firstRow, buildStore.skillLevels[categoryId] ?? defaultSkillLevel(category, firstMove, firstRow))
  return {
    id: categoryId,
    label: skillCategoryLabel(categoryId, category),
    value,
    options: skillLevelValues(category, firstMove, firstRow).map((level: any) => ({
      label: skillLevelLabel(category, level),
      value: level,
    })),
    summary: `${labelOf(firstMove)} · ${labelOf(firstRow)} · ${skillLevelLabel(category, value)}`,
  }
}))
const damageEventSummary = computed(() => (buildStore.damageConfig.events ?? []).map((event: any) => {
  return {
    id: event.id,
    label: damageEventSummaryTitle(event, catalogStore.meta, selectedSkillCatalog.value),
  }
}))
const selectedDamageEvent = computed(() => {
  const events = buildStore.damageConfig.events ?? []
  return events.find((event: any) => event.id === buildStore.damageConfig.selectedEventId) ?? events[0]
})
const currentDamageElement = computed(() => selectedDamageEvent.value?.damageElement ?? selectedAgent.value?.damageElement ?? selectedAgent.value?.attribute ?? "physical")
const fourPieceRuntimeBuffs = computed(() => {
  const set = selectedOptimizerSet.value
  const fourPiece = set?.fourPiece
  if (!set || !fourPiece) {
    return []
  }
  const buffs: any[] = []
  const selfBuff = fourPiece.selfBuff ?? (Array.isArray(fourPiece.effects) ? fourPiece : null)
  if (selfBuff?.effects?.length) {
    buffs.push({
      ...selfBuff,
      id: `driveDisc4pc:${set.id}.self`,
      name: { zhCN: `${labelOf(set)} 4 件套自身` },
      sourceCategory: "driveDisc",
    })
  }
  if (fourPiece.teamBuff?.effects?.length) {
    buffs.push({
      ...fourPiece.teamBuff,
      id: `driveDisc4pc:${set.id}.team`,
      name: { zhCN: `${labelOf(set)} 4 件套团队` },
      sourceCategory: "driveDisc",
    })
  }
  return buffs
})
const activeBuffBadges = computed(() => buildStore.activeBuffIds(catalogStore.meta, catalogStore.catalog, selectedDriveDiscs.value).slice(0, 8).map(id => ({
  id,
  label: buffLabelForId(id, {
    meta: catalogStore.meta,
    catalogBuffs: catalogStore.combatBuffs,
    driveDiscSets: catalogStore.driveDiscSets,
    agentId: buildStore.agentId,
    cinemaLevel: buildStore.cinemaLevel,
    wEngineId: buildStore.wEngineId,
    wEngineModificationLevel: buildStore.wEngineModificationLevel,
    addedBuffs: buildStore.addedBuffs,
  }),
})))
const optimizerProgress = computed(() => optimizerStore.progress ?? null)
const optimizerMetrics = computed(() => optimizerProgress.value?.metrics ?? optimizerStore.metrics ?? {})
const optimizerProcessed = computed(() => optimizerProgress.value?.evaluated ?? processedOptimizationCount(optimizerMetrics.value))
const optimizerEstimated = computed(() => optimizerProgress.value?.estimatedCombinationCount ?? optimizerMetrics.value?.estimatedCombinationCount ?? 0)
const optimizerProgressPercent = computed(() => Math.max(0, Math.min(100, Number(optimizerProgress.value?.percent ?? 0))))
const optimizerProgressFillStyle = computed(() => ({ width: `${optimizerProgressPercent.value}%` }))
const optimizerRate = computed(() => formatRate(optimizerMetrics.value?.evaluationsPerSecond ?? optimizerProgress.value?.evaluationsPerSecond))
const optimizerElapsed = computed(() => formatDuration(optimizerProgress.value?.elapsedMs ?? 0))
const optimizerRunStatus = computed(() => progressTextForStatus(optimizerProgress.value?.status ?? optimizerStore.status))
const optimizerPrepareStageLabel = computed(() => optimizerProgress.value?.status === "preparing"
  ? optimizerProgress.value?.prepareStageLabel ?? optimizerMetrics.value?.prepareStageLabel ?? ""
  : "")
const optimizerRunMeta = computed(() => {
  if (!optimizerProgress.value && optimizerStore.status === "idle") {
    return "未计算"
  }
  const parts = optimizerEstimated.value
    ? [
        `${formatPercentValue(optimizerProgressPercent.value)}`,
        `${formatNumber(optimizerProcessed.value)} / ${formatNumber(optimizerEstimated.value)}`,
        optimizerRate.value,
        Number(optimizerMetrics.value?.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatNumber(optimizerMetrics.value.prunedBySuperBound)}` : "",
      ]
    : [optimizerRunStatus.value]
  return parts.filter(Boolean).join(" · ")
})
const optimizerRunNote = computed(() => {
  const preparingHint = optimizerProgress.value?.status === "preparing" && !optimizerEstimated.value
    ? "正在构建候选与剪枝计划，仓库较大时这一步会先停在 0%"
    : ""
  return [
    optimizerRunStatus.value,
    optimizerPrepareStageLabel.value,
    preparingHint,
    algorithmProgressText(optimizerMetrics.value),
    candidateText(optimizerMetrics.value),
    complexityText(optimizerMetrics.value, optimizerProgress.value?.settings ?? optimizerStore.settings),
  ].filter(Boolean).join(" · ")
})
const optimizerDetailChips = computed(() => [
  optimizerPrepareStageLabel.value ? `阶段：${optimizerPrepareStageLabel.value}` : "",
  optimizerMetrics.value?.algorithmLabel ? `算法：${optimizerMetrics.value.algorithmLabel}` : "",
  optimizerMetrics.value?.scoreKernel ? `内核 ${optimizerMetrics.value.scoreKernel === "compiled-dense" ? "dense" : "map"}` : "",
  Number(optimizerMetrics.value?.scoredCombinationCount ?? optimizerMetrics.value?.evaluated ?? 0) > 0
    ? `真实评分 ${formatNumber(optimizerMetrics.value.scoredCombinationCount ?? optimizerMetrics.value.evaluated)}` : "",
  Number(optimizerMetrics.value?.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatNumber(optimizerMetrics.value.prunedBySuperBound)}` : "",
  Number(optimizerMetrics.value?.boundChecksPerSecond ?? 0) > 0 ? `上界 ${formatRate(optimizerMetrics.value.boundChecksPerSecond)}` : "",
  Number(optimizerMetrics.value?.workerCount ?? 0) > 1 ? `并行 x${optimizerMetrics.value.workerCount}` : "",
  Number(optimizerMetrics.value?.parallelTaskCount ?? 0) > 0
    ? `任务 ${formatNumber(optimizerMetrics.value.completedTaskCount ?? 0)}/${formatNumber(optimizerMetrics.value.parallelTaskCount)}` : "",
  candidateText(optimizerMetrics.value),
  complexityText(optimizerMetrics.value, optimizerProgress.value?.settings ?? optimizerStore.settings),
].filter(Boolean))

const buildSignature = computed(() => JSON.stringify({
  agentId: buildStore.agentId,
  agentLevel: buildStore.agentLevel,
  coreSkillLevel: buildStore.coreSkillLevel,
  cinemaLevel: buildStore.cinemaLevel,
  skillLevels: buildStore.skillLevels,
  wEngineId: buildStore.wEngineId,
  wEngineLevel: buildStore.wEngineLevel,
  wEngineModificationLevel: buildStore.wEngineModificationLevel,
  selectedBuffIds: buildStore.selectedBuffIds,
  addedBuffs: buildStore.addedBuffs,
  runtimeInputs: buildStore.runtimeInputs,
  uncheckedDefaultBuffs: buildStore.manuallyUncheckedDefaultBuffIds,
  damageConfig: buildStore.damageConfig,
  targetConfig: buildStore.targetConfig,
  discMode: buildStore.discMode,
  manualDriveDiscIdsBySlot: buildStore.manualDriveDiscIdsBySlot,
  loadoutId: buildStore.selectedLoadoutId,
  optimizedRank: buildStore.selectedOptimizedRank,
  discs: selectedDriveDiscs.value.map((disc: any) => disc.id),
  optimizedRuntimeInputs: selectedOptimizedRuntimeInputs.value,
}))

watch(buildSignature, () => recalculate())

function recalculate() {
  buildStore.calculate(catalogStore.catalog, catalogStore.meta, selectedDriveDiscs.value, selectedBuildOptions.value)
}

function filterSelectOption(pattern: string, option: any) {
  const needle = pattern.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return String(option?.searchText ?? option?.label ?? option?.value ?? "").toLowerCase().includes(needle)
}

function renderWEngineSelectLabel(option: any) {
  const wEngine = option?.wEngine ?? catalogStore.wEngines.find((item: any) => item.id === option?.value)
  const label = labelOf(wEngine) || String(option?.label ?? option?.value ?? "")
  return h("span", { class: "w-engine-select-label" }, [
    h("img", {
      class: "w-engine-select-icon",
      src: imageForWEngine(wEngine),
      alt: label,
      loading: "lazy",
    }),
    h("span", { class: "w-engine-select-copy" }, [
      h("span", { class: "w-engine-select-name" }, label),
      h("span", { class: "w-engine-select-meta" }, entityMetaText(wEngine)),
    ]),
  ])
}

function applyBuffs(payload: any) {
  buildStore.applyBuffState(payload, catalogStore.meta)
}

function saveCalculationConfig(config: any) {
  buildStore.setDamageConfig(config, selectedAgent.value)
}

function updateTargetConfig(config: any) {
  buildStore.setTargetConfig(config)
}

function optimizerInput(ownerId = inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default") {
  return {
    ...buildStore.buildInput(catalogStore.catalog, catalogStore.meta, []),
    ownerId,
  }
}

async function runOptimization() {
  await inventoryStore.load()
  const ownerId = inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default"
  const owner = (inventoryStore.store?.owners ?? accountStore.owners ?? []).find((item: any) => item.id === ownerId)
  const input = optimizerInput(ownerId)
  const inputWithSettings = optimizerStore.inputWithSettings(input, inventoryStore.store)
  if (!inventoryStore.driveDiscs.length) {
    optimizerStore.failBeforeRun(
      `当前账号「${owner?.label ?? ownerId}」没有可用于优化的驱动盘。请先到驱动盘页导入，或切换到包含驱动盘的账号。`,
      inputWithSettings.settings,
    )
    return
  }
  await optimizerStore.run(catalogStore.catalog, inventoryStore.store, input)
  if (optimizerStore.resultSchemes[0]) {
    selectedOptimizerResultRank.value = Number(optimizerStore.resultSchemes[0].rank)
  }
}

function requestApplyOptimizedRank(rank: number) {
  pendingOptimizedRank.value = rank
  showOptimizedApplyConfirm.value = true
}

function applyPendingOptimizedRank() {
  if (pendingOptimizedRank.value) {
    buildStore.selectOptimizedRank(pendingOptimizedRank.value)
  }
  showOptimizedApplyConfirm.value = false
}

function selectOptimizerResultRank(rank: number) {
  selectedOptimizerResultRank.value = Number(rank ?? 0)
}

function applySelectedOptimizerResult() {
  if (selectedOptimizerResultScheme.value?.rank) {
    requestApplyOptimizedRank(Number(selectedOptimizerResultScheme.value.rank))
  }
}

async function saveOptimizedLoadout() {
  const scheme = selectedOptimizedScheme.value
  if (!scheme?.driveDiscs?.length) {
    return
  }
  const driveDiscIdsBySlot = Object.fromEntries(
    scheme.driveDiscs
      .map((disc: any) => [String(Number(disc.partition)), disc.id])
      .filter(([slot, id]: [string, string]) => slot && id),
  )
  const loadout = await inventoryStore.saveLoadout({
    name: scheme.loadoutName,
    agentId: buildStore.agentId,
    driveDiscIdsBySlot,
    score: scheme.score,
    source: { type: "optimizer", rank: scheme.rank },
  })
  buildStore.selectLoadout(loadout.id)
}

function discOptionLabel(disc: any) {
  return `${disc.setName || disc.setId} · ${disc.partition}号位 · ${statLabel(disc.mainStat?.stat, catalogStore.meta)} ${disc.mainStat?.value ?? ""}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`
}

function driveDiscSetForDisc(disc: any) {
  const byId = catalogStore.driveDiscSets.find((set: any) => set.id === disc?.setId)
  if (byId) {
    return byId
  }
  const setName = String(disc?.setName ?? "").trim()
  const byName = setName
    ? catalogStore.driveDiscSets.find((set: any) => labelOf(set) === setName || set?.name?.zhCN === setName || set?.name?.en === setName)
    : null
  if (byName) {
    return byName
  }
  return {
    id: String(disc?.setId ?? ""),
    name: { zhCN: setName || String(disc?.setId ?? "未知套装") },
    images: {},
  }
}

function driveDiscSetName(disc: any) {
  return disc?.setName || labelOf(driveDiscSetForDisc(disc)) || disc?.setId || "未知套装"
}

function driveDiscSetIcon(disc: any) {
  return imageForDriveDiscSet(driveDiscSetForDisc(disc))
}

function driveDiscStatText(stat: any) {
  if (!stat?.stat) {
    return "-"
  }
  const mode = String(stat.mode ?? "")
  return `${storedStatLabel(String(stat.stat), mode, catalogStore.meta)} ${formatStoredStatValue(String(stat.stat), stat.value, mode)}`
}

function driveDiscSubStatText(disc: any) {
  return (disc?.subStats ?? [])
    .map((stat: any) => driveDiscStatText(stat))
    .join(" / ") || "-"
}

function driveDiscRarityLevelText(disc: any) {
  const rarity = disc?.rarity ? String(disc.rarity) : "-"
  const level = Number(disc?.level)
  return `${rarity}${Number.isFinite(level) ? ` +${level}` : ""}`
}

function driveDiscIdentityMeta(disc: any) {
  return disc?.source?.sequence ? `#${disc.source.sequence}` : disc?.id ?? "-"
}

function discOptions(slot: number) {
  return [
    { label: "空槽位", value: "" },
    ...inventoryStore.discOptionsForSlot(slot).map((disc: any) => ({ label: discOptionLabel(disc), value: disc.id })),
  ]
}

function twoPieceSetEffectText(set: any) {
  return buffEffectLines(set?.twoPiece, undefined, catalogStore.meta).join("；") || "2件套效果未录入"
}

function openFourPieceSetModal() {
  draftFourPieceSetId.value = optimizerStore.fourPieceSetId || optimizerSetChoices.value[0]?.id || ""
  showFourPieceSetModal.value = true
}

function applyFourPieceSetModalSelection() {
  optimizerStore.setFourPieceSet(draftFourPieceSetId.value)
  showFourPieceSetModal.value = false
}

function openTwoPieceSetModal() {
  draftTwoPieceSetIds.value = [...optimizerStore.twoPieceSetIds]
  showTwoPieceSetModal.value = true
}

function draftHasTwoPieceSet(id: string) {
  return draftTwoPieceSetIds.value.includes(id)
}

function toggleDraftTwoPieceSet(id: string) {
  const selected = new Set(draftTwoPieceSetIds.value)
  if (selected.has(id)) {
    selected.delete(id)
  } else {
    selected.add(id)
  }
  draftTwoPieceSetIds.value = [...selected]
}

function applyTwoPieceSetModalSelection() {
  optimizerStore.setTwoPieceSetIds(draftTwoPieceSetIds.value)
  showTwoPieceSetModal.value = false
}

function removeTwoPieceSet(id: string) {
  optimizerStore.setTwoPieceSetIds(optimizerStore.twoPieceSetIds.filter(setId => setId !== id))
}

function clearTwoPieceSetLimits() {
  optimizerStore.setTwoPieceSetIds([])
}

function hasMainStatLimit(slot: string, stat: string) {
  return (optimizerStore.mainStatLimits[slot] ?? []).includes(stat)
}

function fourPieceRuntimeFor(buff: any) {
  return normalizeRuntimeForBuff(buff, optimizerStore.fourPieceBuffRuntimeInputs[buff.id] ?? defaultRuntimeForBuff(buff))
}

function fourPieceRuntimePartLabel(buff: any) {
  return String(buff?.id ?? "").endsWith(".team") ? "团队效果" : "装备者效果"
}

function updateFourPieceRuntime(buff: any, runtime: any) {
  optimizerStore.setFourPieceBuffRuntimeInput(buff.id, normalizeRuntimeForBuff(buff, runtime))
}

function setFourPieceCoverage(buff: any, value: number | null) {
  updateFourPieceRuntime(buff, {
    ...fourPieceRuntimeFor(buff),
    coverage: Number(value ?? 0),
  })
}

function setFourPieceSourceValue(buff: any, group: any, value: number | null) {
  const runtime = fourPieceRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      sourceValue: Number(value ?? 0),
    }
  }
  updateFourPieceRuntime(buff, { ...runtime, effects })
}

function setFourPieceStacks(buff: any, group: any, value: number | null) {
  const runtime = fourPieceRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      stacks: Number(value ?? 0),
    }
  }
  updateFourPieceRuntime(buff, { ...runtime, effects })
}

function processedOptimizationCount(metrics: any = {}, fallback: any = null) {
  if (fallback !== null && fallback !== undefined) {
    return Number(fallback ?? 0)
  }
  return Number(metrics.processedCombinationCount
    ?? (Number(metrics.evaluated ?? 0) + Number(metrics.prunedBySuperBound ?? 0)))
}

function formatRate(value: any) {
  const rate = Number(value ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) {
    return ""
  }
  return `${formatNumber(Math.round(rate))}/秒`
}

function formatDuration(ms: any) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms ?? 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

function formatPercentValue(value: any) {
  const percent = Math.max(0, Math.min(100, Number(value ?? 0)))
  if (percent > 0 && percent < 0.1) {
    return "<0.1%"
  }
  if (percent > 0 && percent < 10) {
    return `${formatNumber(percent, 1)}%`
  }
  return `${formatNumber(Math.round(percent))}%`
}

function progressTextForStatus(status: any) {
  if (status === "preparing") {
    return "正在准备候选数据"
  }
  if (status === "preview") {
    return "已完成计算预估"
  }
  if (status === "complete" || status === "done") {
    return "计算完成"
  }
  if (status === "cancelling" || status === "canceling") {
    return "正在取消计算"
  }
  if (status === "cancelled") {
    return "计算已取消"
  }
  if (status === "error") {
    return "计算失败"
  }
  if (status === "idle") {
    return "等待开始"
  }
  return "正在精确枚举候选组合"
}

function algorithmProgressText(metrics: any = {}) {
  const label = metrics.algorithmLabel || metrics.algorithmId
  if (!label) {
    return ""
  }
  const parts = [`算法：${label}`, metrics.strictExact === false ? "非严格精准" : "严格精准"]
  if (metrics.scoreKernel) {
    parts.push(`内核 ${metrics.scoreKernel === "compiled-dense" ? "dense" : "map"}`)
    if (metrics.scoreKernel !== "compiled-dense" && metrics.scoreKernelFallbackReason) {
      parts.push(`回退 ${metrics.scoreKernelFallbackReason}`)
    }
  }
  if (Number(metrics.prunedBySuperBound ?? 0) > 0) {
    parts.push(`真实评分 ${formatNumber(metrics.scoredCombinationCount ?? metrics.evaluated ?? 0)}`)
    parts.push(`剪枝 ${formatNumber(metrics.prunedBySuperBound)}`)
  }
  return parts.join(" · ")
}

function candidateText(metrics: any = {}) {
  const counts = metrics.candidateCountsBySlot ?? {}
  const entries = Object.entries(counts)
  if (!entries.length) {
    return ""
  }
  return `候选 ${entries.map(([slot, count]) => `${slot}号位 ${formatNumber(count)}`).join(" / ")}`
}

function complexityText(metrics: any = {}, settings: any = {}) {
  const complexity = metrics.complexity
  if (!complexity?.label) {
    return ""
  }
  const high = ["high", "extreme"].includes(complexity.level)
  if (!high) {
    return `复杂度：${complexity.label}`
  }
  const hasMainStatLimit = Object.values(settings.mainStatLimits ?? {})
    .some((values: any) => Array.isArray(values) && values.length > 0)
  const hasTwoPieceLimit = Array.isArray(settings.twoPieceSetIds)
    ? settings.twoPieceSetIds.length > 0
    : Boolean(settings.twoPieceSetId)
  if (hasMainStatLimit) {
    return hasTwoPieceLimit
      ? `复杂度：${complexity.label}，已限定主词条，候选仍多时可继续收窄`
      : `复杂度：${complexity.label}，已限定主词条，建议再限定 2 件套`
  }
  return hasTwoPieceLimit
    ? `复杂度：${complexity.label}，建议限定主词条`
    : `复杂度：${complexity.label}，建议限定 2 件套或主词条`
}

</script>

<template>
  <section class="workbench-grid">
    <aside class="section-band">
      <div class="panel">
        <div class="panel-header">
          <h1 class="panel-title">角色</h1>
          <NTag v-if="selectedAgent" round>{{ attributeLabel(selectedAgent.attribute) }}</NTag>
        </div>
        <div class="panel-body section-band">
          <div v-if="selectedAgent" class="selection-summary">
            <ImageAvatar :src="imageForAgent(selectedAgent)" :name="labelOf(selectedAgent)" :size="56" round />
            <div class="selection-summary-copy">
              <strong>{{ labelOf(selectedAgent) }}</strong>
              <div class="muted">{{ entityMetaText(selectedAgent) }}</div>
            </div>
          </div>
          <NSelect
            :value="buildStore.agentId"
            :options="agentSelectOptions"
            :filter="filterSelectOption"
            filterable
            placeholder="选择角色"
            @update:value="value => buildStore.selectAgent(String(value), catalogStore.meta)"
          />
          <div class="build-compact-grid build-profile-grid">
            <label class="compact-field">
              <span>等级</span>
              <NInputNumber v-model:value="buildStore.agentLevel" :min="1" :max="60" size="small" />
            </label>
            <label class="compact-field">
              <span>影画</span>
              <NSelect v-model:value="buildStore.cinemaLevel" :options="cinemaLevelOptions" size="small" />
            </label>
            <label class="compact-field compact-field-wide">
              <span>核心技</span>
              <NSelect v-model:value="buildStore.coreSkillLevel" :options="coreSkillOptions" size="small" />
            </label>
          </div>
          <div class="build-skill-grid">
            <label v-for="control in skillLevelControls" :key="control.id" class="compact-field">
              <span>{{ control.label }}</span>
              <NSelect
                :value="control.value"
                :options="control.options"
                size="small"
                @update:value="buildStore.updateSkillLevel(control.id, $event)"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">音擎</h2>
          <NTag v-if="selectedWEngine" round>{{ buildStore.wEngineModificationLevel }} 精</NTag>
        </div>
        <div class="panel-body section-band">
          <div v-if="selectedWEngine" class="selection-summary">
            <ImageAvatar :src="imageForWEngine(selectedWEngine)" :name="labelOf(selectedWEngine)" :size="46" />
            <div class="selection-summary-copy">
              <strong>{{ labelOf(selectedWEngine) }}</strong>
              <div class="muted">{{ entityMetaText(selectedWEngine) }}</div>
            </div>
          </div>
          <NSelect
            :value="buildStore.wEngineId"
            :options="wEngineSelectOptions"
            :filter="filterSelectOption"
            :render-label="renderWEngineSelectLabel"
            filterable
            placeholder="选择音擎"
            @update:value="value => buildStore.selectWEngine(String(value), catalogStore.meta)"
          />
          <div class="build-compact-grid">
            <label class="compact-field">
              <span>等级</span>
              <NInputNumber v-model:value="buildStore.wEngineLevel" :min="1" :max="60" size="small" />
            </label>
            <label class="compact-field">
              <span>精修</span>
              <NSelect v-model:value="buildStore.wEngineModificationLevel" :options="modificationOptions" size="small" />
            </label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">局内 Buff</h2>
          <NButton size="small" @click="showBuffPicker = true">
            <template #icon><SlidersHorizontal :size="16" /></template>
            选择
          </NButton>
        </div>
        <div class="panel-body section-band">
          <div class="chip-row">
            <NTag v-for="item in activeBuffBadges" :key="item.id" round>{{ item.label }}</NTag>
            <NTag v-if="!buildStore.activeBuffIds(catalogStore.meta).length" round>未启用 Buff</NTag>
          </div>
          <NTag v-if="buildStore.addedBuffs.length" type="info" round>自定义 {{ buildStore.addedBuffs.length }} 条</NTag>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">计算设置</h2>
          <NButton size="small" @click="showCalculationConfig = true">
            <template #icon><SlidersHorizontal :size="16" /></template>
            配置
          </NButton>
        </div>
        <div class="panel-body metric-grid">
          <dl class="metric">
            <dt>模式</dt>
            <dd>{{ damageModeLabel(buildStore.damageConfig.mode) }}</dd>
          </dl>
          <dl class="metric">
            <dt>事件</dt>
            <dd>{{ buildStore.damageConfig.events?.length ?? 1 }} 项</dd>
          </dl>
          <div class="metric" style="grid-column: 1 / -1;">
            <dt>事件摘要</dt>
            <dd class="chip-row">
              <NTag v-for="event in damageEventSummary" :key="event.id" round>{{ event.label }}</NTag>
            </dd>
          </div>
        </div>
      </div>

      <EnemyTargetConfigPanel
        :target-config="buildStore.targetConfig"
        :meta="catalogStore.meta"
        :damage-element="currentDamageElement"
        @update:target-config="updateTargetConfig"
      />

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">驱动盘方案</h2>
          <NTag round>{{ selectedDriveDiscs.length }} / 6</NTag>
        </div>
        <div class="panel-body section-band">
          <div class="toolbar">
            <NButton size="small" :type="buildStore.discMode === 'manual' ? 'primary' : 'default'" @click="buildStore.setDiscMode('manual')">手动</NButton>
            <NButton size="small" :type="buildStore.discMode === 'loadout' ? 'primary' : 'default'" @click="buildStore.setDiscMode('loadout')">套装</NButton>
            <NButton size="small" :type="buildStore.discMode === 'optimized' ? 'primary' : 'default'" :disabled="!optimizerStore.resultSchemes.length" @click="buildStore.setDiscMode('optimized')">优化结果</NButton>
            <NButton size="small" :disabled="!selectedDriveDiscs.length" @click="showDriveDiscAnalysis = true">
              <template #icon><LineChart :size="16" /></template>
              词条分析
            </NButton>
          </div>
          <div v-if="buildStore.discMode === 'manual'" class="section-band">
            <label v-for="slot in [1,2,3,4,5,6]" :key="slot" class="metric">
              <dt>{{ slot }}号位</dt>
              <dd>
                <NSelect
                  :value="buildStore.manualDriveDiscIdsBySlot[String(slot)] ?? ''"
                  :options="discOptions(slot)"
                  filterable
                  clearable
                  @update:value="buildStore.setManualDriveDisc(slot, String($event ?? ''))"
                />
              </dd>
            </label>
          </div>
          <NSelect
            v-else-if="buildStore.discMode === 'loadout'"
            :value="buildStore.selectedLoadoutId"
            :options="loadoutOptions"
            filterable
            @update:value="buildStore.selectLoadout(String($event ?? ''))"
          />
          <NSelect
            v-else
            :value="buildStore.selectedOptimizedRank"
            :options="optimizedRankOptions"
            @update:value="buildStore.selectOptimizedRank(Number($event ?? 0))"
          />
          <div class="metric-grid">
            <div v-for="disc in selectedDriveDiscs" :key="disc.id" class="metric">
              <dt>{{ disc.partition }}号位 · {{ disc.setName || disc.setId }}</dt>
              <dd>{{ statLabel(disc.mainStat?.stat, catalogStore.meta) }} {{ disc.mainStat?.value }}</dd>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section>
      <DamageSummaryBar :result="buildStore.result" :error="buildStore.error" :loading="catalogStore.loading" />
      <NTabs type="line" animated>
        <NTabPane name="damage" tab="伤害详情">
          <div class="section-band">
            <div class="panel">
              <div class="panel-header">
                <h2 class="panel-title">白盒结果</h2>
                <NButton size="small" @click="recalculate">
                  <template #icon><RefreshCcw :size="16" /></template>
                  刷新
                </NButton>
              </div>
              <div class="panel-body">
                <div v-if="buildStore.error" class="empty-state">{{ buildStore.error }}</div>
                <DamageWhiteBox
                  v-else
                  :damage="buildStore.result?.damage"
                  :meta="catalogStore.meta"
                  :skill-catalog="selectedSkillCatalog"
                />
              </div>
            </div>
            <div class="panel">
              <div class="panel-header">
                <h2 class="panel-title">面板</h2>
              </div>
              <div class="panel-body metric-grid">
                <div>
                  <h3>局外</h3>
                  <PanelStatTable :panel="buildStore.outOfCombat?.panel" :meta="catalogStore.meta" />
                </div>
                <div>
                  <h3>局内</h3>
                  <PanelStatTable :panel="buildStore.result?.inCombat?.panel" :meta="catalogStore.meta" />
                </div>
              </div>
            </div>
          </div>
        </NTabPane>
        <NTabPane name="optimizer" tab="驱动盘优化">
          <div class="panel">
            <div class="panel-header">
              <h2 class="panel-title">优化设置</h2>
              <NTag :type="optimizerStore.status === 'error' ? 'error' : optimizerStore.status === 'done' ? 'success' : 'info'" round>{{ optimizerStatusLabel(optimizerStore.status) }}</NTag>
            </div>
            <div class="panel-body section-band">
              <div class="metric-grid">
                <label class="metric">
                  <dt>算法</dt>
                  <dd><NSelect :value="optimizerStore.algorithm" :options="optimizerAlgorithmOptions" @update:value="optimizerStore.setAlgorithm(String($event))" /></dd>
                </label>
                <div class="metric optimizer-set-choice-field">
                  <dt>四件套</dt>
                  <dd class="set-summary-actions">
                    <NButton size="small" @click="openFourPieceSetModal">选择套装</NButton>
                    <div class="selected-set-summary" aria-live="polite">
                      <span v-if="selectedOptimizerSet" class="selected-set-chip selected-set-chip-with-icon">
                        <img :src="imageForDriveDiscSet(selectedOptimizerSet)" alt="" loading="lazy">
                        <span>{{ labelOf(selectedOptimizerSet) }}</span>
                      </span>
                      <span v-else class="selected-set-empty">未选择限定 4 件套</span>
                    </div>
                  </dd>
                </div>
                <div class="metric optimizer-set-choice-field">
                  <dt class="metric-title-row">
                    <span>二件套</span>
                    <NButton size="tiny" text :disabled="!optimizerStore.twoPieceSetIds.length" @click="clearTwoPieceSetLimits">清空</NButton>
                  </dt>
                  <dd class="set-summary-actions">
                    <NButton size="small" @click="openTwoPieceSetModal">选择套装</NButton>
                    <div class="selected-set-summary" aria-live="polite">
                      <span v-if="!selectedTwoPieceSets.length" class="selected-set-empty">未选择额外 2 件套</span>
                      <template v-else>
                        <span v-for="set in selectedTwoPieceSets" :key="set.id" class="selected-set-chip selected-set-chip-with-icon">
                          <img :src="imageForDriveDiscSet(set)" alt="" loading="lazy">
                          <span>{{ labelOf(set) }}</span>
                          <button type="button" class="selected-set-remove" :aria-label="`移除 ${labelOf(set)}`" @click="removeTwoPieceSet(set.id)">
                            <X :size="14" />
                          </button>
                        </span>
                      </template>
                    </div>
                  </dd>
                </div>
                <label class="metric">
                  <dt>4 件套 Buff</dt>
                  <dd><NCheckbox :checked="optimizerStore.fourPieceBuffMode === 'manual'" @update:checked="optimizerStore.setFourPieceBuffMode($event ? 'manual' : 'auto')">手动</NCheckbox></dd>
                </label>
              </div>
              <div v-if="optimizerStore.fourPieceBuffMode === 'manual'" class="panel">
                <div class="panel-header">
                  <h3 class="panel-title">4 件套 Buff 参数</h3>
                  <NTag round>{{ fourPieceRuntimeBuffs.length }} 项</NTag>
                </div>
                <div class="panel-body section-band">
                  <article v-for="buff in fourPieceRuntimeBuffs" :key="buff.id" class="panel">
                    <div class="panel-header">
                      <h4 class="panel-title">{{ buffDisplayName(buff) }}</h4>
                      <NTag round>{{ fourPieceRuntimePartLabel(buff) }}</NTag>
                    </div>
                    <div class="panel-body buff-runtime-grid">
                      <label v-if="buff.coverage" class="metric buff-runtime-metric">
                        <dt>覆盖率</dt>
                        <dd>
                          <NInputNumber
                            :value="fourPieceRuntimeFor(buff).coverage"
                            :min="buff.coverage.min ?? 0"
                            :max="buff.coverage.max ?? 1"
                            :step="buff.coverage.step ?? 0.1"
                            @update:value="setFourPieceCoverage(buff, Number($event))"
                          />
                        </dd>
                      </label>
                      <label v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric buff-runtime-metric">
                        <dt>{{ group.label || '来源数值' }}</dt>
                        <dd>
                          <NInputNumber
                            :value="fourPieceRuntimeFor(buff).effects?.[group.ruleIds?.[0]]?.sourceValue ?? group.defaultValue ?? 0"
                            :min="Number.isFinite(group.min) ? group.min : undefined"
                            :max="Number.isFinite(group.max) ? group.max : undefined"
                            @update:value="setFourPieceSourceValue(buff, group, Number($event))"
                          />
                        </dd>
                      </label>
                      <label v-for="group in runtimeStackGroups(buff)" :key="group.key" class="metric layer-metric buff-runtime-layer">
                        <dd>
                          <LayerSlider
                            :label="group.label || '层数'"
                            :value="fourPieceRuntimeFor(buff).effects?.[group.ruleIds?.[0]]?.stacks ?? group.defaultStacks ?? group.maxStacks ?? 1"
                            :min="0"
                            :max="group.maxStacks ?? 99"
                            :step="1"
                            @update:value="setFourPieceStacks(buff, group, Number($event))"
                          />
                        </dd>
                      </label>
                    </div>
                  </article>
                  <div v-if="!fourPieceRuntimeBuffs.length" class="empty-state">当前四件套没有可手动配置的 Buff</div>
                </div>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <h3 class="panel-title">限定主词条</h3>
                </div>
                <div class="panel-body optimizer-main-stat-grid">
                  <div v-for="slot in ['4','5','6']" :key="slot" class="metric optimizer-main-stat-field">
                    <dt class="metric-title-row">
                      <span>{{ slot }}号位</span>
                      <NButton size="tiny" text :disabled="!(optimizerStore.mainStatLimits[slot] ?? []).length" @click="optimizerStore.clearMainStatLimit(slot)">清空</NButton>
                    </dt>
                    <dd class="main-stat-choice-list">
                      <label
                        v-for="option in mainStatOptionsBySlot[slot]"
                        :key="option.value"
                        class="main-stat-choice"
                        :class="{ active: hasMainStatLimit(slot, option.value) }"
                      >
                        <input
                          type="checkbox"
                          :checked="hasMainStatLimit(slot, option.value)"
                          @change="optimizerStore.toggleMainStatLimit(slot, option.value)"
                        >
                        <span>{{ option.label }}</span>
                      </label>
                    </dd>
                  </div>
                </div>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <h3 class="panel-title">限定最小值</h3>
                </div>
                <div class="panel-body metric-grid">
                  <label v-for="item in minimumStats" :key="item.key" class="metric">
                    <dt>{{ item.label }}</dt>
                    <dd>
                      <NInputNumber
                        :value="optimizerStore.minimums[item.key]"
                        clearable
                        :step="item.key === 'anomalyProficiency' ? 1 : 0.1"
                        placeholder="不限定"
                        @update:value="optimizerStore.setMinimum(item.key, $event === null ? null : Number($event))"
                      />
                    </dd>
                  </label>
                </div>
              </div>
              <div class="toolbar">
                <NButton v-if="!optimizerStore.isBusy" type="primary" @click="runOptimization">
                  <template #icon><Sparkles :size="16" /></template>
                  开始优化
                </NButton>
                <NButton v-else type="warning" disabled>
                  {{ optimizerStore.status === "preparing" ? "准备中" : optimizerStore.status === "cancelling" ? "正在取消..." : "运行中" }}
                </NButton>
                <NButton v-if="optimizerStore.status === 'preparing' || optimizerStore.status === 'running' || optimizerStore.status === 'cancelling'" type="warning" @click="optimizerStore.cancel">取消优化</NButton>
                <NButton :disabled="!selectedOptimizedScheme" @click="saveOptimizedLoadout">
                  <template #icon><Save :size="16" /></template>
                  存为套装
                </NButton>
              </div>
              <div class="optimizer-progress-card" :data-active="optimizerProgress ? 'true' : 'false'">
                <div class="optimizer-progress-head">
                  <strong>{{ formatPercentValue(optimizerProgressPercent) }}</strong>
                  <span>{{ optimizerElapsed }}</span>
                </div>
                <div class="optimizer-progress-track" aria-hidden="true">
                  <div class="optimizer-progress-fill" :style="optimizerProgressFillStyle"></div>
                </div>
                <div class="optimizer-progress-copy">
                  <strong>{{ optimizerRunMeta }}</strong>
                  <p>{{ optimizerRunNote }}</p>
                </div>
                <div v-if="optimizerDetailChips.length" class="chip-row optimizer-detail-chips">
                  <NTag v-for="chip in optimizerDetailChips" :key="chip" round>{{ chip }}</NTag>
                </div>
              </div>
              <div class="metric-grid optimizer-metric-grid">
                <dl class="metric">
                  <dt>预估组合</dt>
                  <dd class="num">{{ formatNumber(optimizerEstimated) }}</dd>
                </dl>
                <dl class="metric">
                  <dt>已处理</dt>
                  <dd class="num">{{ formatNumber(optimizerProcessed) }}</dd>
                </dl>
                <dl class="metric">
                  <dt>百分比</dt>
                  <dd class="num">{{ formatPercentValue(optimizerProgressPercent) }}</dd>
                </dl>
                <dl class="metric">
                  <dt>速度</dt>
                  <dd class="num">{{ optimizerRate || "-" }}</dd>
                </dl>
                <dl class="metric">
                  <dt>耗时</dt>
                  <dd class="num">{{ optimizerElapsed }}</dd>
                </dl>
                <dl class="metric">
                  <dt>结果</dt>
                  <dd class="num">{{ optimizerStore.results.length }}</dd>
                </dl>
              </div>
              <div v-if="optimizerStore.error" class="empty-state">{{ optimizerStore.error }}</div>
              <div v-else-if="optimizerStore.results.length" class="section-band optimizer-result-detail-shell">
                <div class="optimizer-result-toolbar">
                  <NSelect
                    class="optimizer-result-rank-select"
                    :value="selectedOptimizerResultRank"
                    :options="optimizedRankOptions"
                    @update:value="selectOptimizerResultRank(Number($event ?? 0))"
                  />
                  <div class="toolbar">
                    <NTag type="success" round>评分 {{ formatNumber(selectedOptimizerResultScheme?.score ?? 0) }}</NTag>
                    <NTag round>{{ selectedOptimizerResultDiscCount }} / 6</NTag>
                    <NButton size="small" :disabled="!selectedOptimizerResultScheme" @click="applySelectedOptimizerResult">应用</NButton>
                  </div>
                </div>
                <div v-if="selectedOptimizerResultScheme" class="optimizer-result-disc-list">
                  <div
                    v-for="row in selectedOptimizerResultRows"
                    :key="row.slot"
                    class="optimizer-result-disc-row"
                    :class="{ 'optimizer-result-disc-row-empty': !row.disc }"
                  >
                    <img :src="row.disc ? driveDiscSetIcon(row.disc) : '/assets/drive-discs/empty.svg'" alt="" loading="lazy">
                    <div class="optimizer-result-disc-copy">
                      <strong>{{ row.disc ? `${row.slot}号位 · ${driveDiscSetName(row.disc)}` : `${row.slot}号位 · 未选择` }}</strong>
                      <span>{{ row.disc ? driveDiscStatText(row.disc.mainStat) : "无驱动盘" }}</span>
                      <small>{{ row.disc ? driveDiscSubStatText(row.disc) : "-" }}</small>
                    </div>
                    <div v-if="row.disc" class="optimizer-result-disc-meta">
                      <NTag round>{{ driveDiscRarityLevelText(row.disc) }}</NTag>
                      <span>{{ driveDiscIdentityMeta(row.disc) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">完成后将在这里选择并展示前 5 套方案</div>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </section>
  </section>

  <NModal v-model:show="showOptimizedApplyConfirm" preset="card" title="应用优化结果" style="max-width: 760px">
    <div class="section-band">
      <div class="toolbar">
        <NTag type="success" round>第 {{ pendingOptimizedScheme?.rank }} 名</NTag>
        <NTag round>评分 {{ formatNumber(pendingOptimizedScheme?.score ?? 0) }}</NTag>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>槽位</th>
            <th>套装</th>
            <th>主词条</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="disc in pendingOptimizedScheme?.driveDiscs ?? []" :key="disc.id">
            <td class="num">{{ disc.partition }}</td>
            <td>{{ disc.setName || disc.setId }}</td>
            <td>{{ statLabel(disc.mainStat?.stat, catalogStore.meta) }} {{ disc.mainStat?.value ?? "" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showOptimizedApplyConfirm = false">取消</NButton>
        <NButton type="primary" @click="applyPendingOptimizedRank">应用到当前角色</NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showFourPieceSetModal" preset="card" title="选择限定 4 件套" style="max-width: 920px">
    <div class="set-choice-list">
      <label
        v-for="set in optimizerSetChoices"
        :key="set.id"
        class="set-choice"
        :class="{ active: draftFourPieceSetId === set.id }"
      >
        <input
          type="radio"
          name="optimizer-four-piece-set"
          :checked="draftFourPieceSetId === set.id"
          @change="draftFourPieceSetId = set.id"
        >
        <img :src="imageForDriveDiscSet(set)" alt="" loading="lazy">
        <span class="set-choice-text">
          <strong>{{ labelOf(set) }}</strong>
        </span>
      </label>
    </div>
    <template #footer>
      <div class="drawer-footer set-modal-footer">
        <span class="modal-summary">{{ draftFourPieceSet ? `已选择 ${labelOf(draftFourPieceSet)}` : "未选择限定 4 件套" }}</span>
        <span class="toolbar">
          <NButton @click="showFourPieceSetModal = false">取消</NButton>
          <NButton type="primary" :disabled="draftFourPieceSetId === optimizerStore.fourPieceSetId" @click="applyFourPieceSetModalSelection">应用限制</NButton>
        </span>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showTwoPieceSetModal" preset="card" title="选择额外 2 件套" style="max-width: 920px">
    <div class="set-choice-list">
      <label
        v-for="set in optimizerSetChoices"
        :key="set.id"
        class="set-choice"
        :class="{ active: draftHasTwoPieceSet(set.id) }"
      >
        <input
          type="checkbox"
          :checked="draftHasTwoPieceSet(set.id)"
          @change="toggleDraftTwoPieceSet(set.id)"
        >
        <img :src="imageForDriveDiscSet(set)" alt="" loading="lazy">
        <span class="set-choice-text">
          <strong>{{ labelOf(set) }}</strong>
          <span>{{ twoPieceSetEffectText(set) }}</span>
        </span>
      </label>
    </div>
    <template #footer>
      <div class="drawer-footer set-modal-footer">
        <span class="modal-summary">{{ draftTwoPieceSetSummary }}</span>
        <span class="toolbar">
          <NButton @click="showTwoPieceSetModal = false">取消</NButton>
          <NButton type="primary" :disabled="twoPieceDraftUnchanged" @click="applyTwoPieceSetModalSelection">应用限制</NButton>
        </span>
      </div>
    </template>
  </NModal>

  <BuffPickerModal
    v-model:show="showBuffPicker"
    :buffs="catalogStore.combatBuffs"
    :selected-ids="buildStore.activeBuffIds(catalogStore.meta)"
    :default-ids="buildStore.defaultBuffIds(catalogStore.meta)"
    :added-buffs="buildStore.addedBuffs"
    :runtime-inputs="buildStore.runtimeInputs"
    :meta="catalogStore.meta"
    :drive-disc-sets="catalogStore.driveDiscSets"
    :agent-id="buildStore.agentId"
    :cinema-level="buildStore.cinemaLevel"
    :w-engine-id="buildStore.wEngineId"
    :w-engine-modification-level="buildStore.wEngineModificationLevel"
    @apply="applyBuffs"
  />

  <CalculationConfigModal
    v-model:show="showCalculationConfig"
    :damage-config="buildStore.damageConfig"
    :skill-catalog="selectedSkillCatalog"
    :skill-levels="buildStore.skillLevels"
    :meta="catalogStore.meta"
    :agent="selectedAgent"
    @save="saveCalculationConfig"
  />

  <DriveDiscAnalysisModal
    v-model:show="showDriveDiscAnalysis"
    :catalog="catalogStore.catalog"
    :meta="catalogStore.meta"
    :input="driveDiscAnalysisInput"
    :source-label="driveDiscAnalysisSourceLabel"
  />
</template>

<style scoped>
.selection-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.selection-summary-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.selection-summary-copy strong,
.selection-summary-copy .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.build-compact-grid,
.build-skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.compact-field {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.compact-field > span {
  overflow: hidden;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-field-wide {
  grid-column: 1 / -1;
}

.compact-field :deep(.n-input-number),
.compact-field :deep(.n-select) {
  width: 100%;
  min-width: 0;
}

:global(.w-engine-select-label) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

:global(.w-engine-select-icon) {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

:global(.w-engine-select-copy) {
  display: grid;
  min-width: 0;
  gap: 1px;
  line-height: 1.25;
}

:global(.w-engine-select-name),
:global(.w-engine-select-meta) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.w-engine-select-name) {
  color: var(--app-text);
  font-weight: 750;
}

:global(.w-engine-select-meta) {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
}

.buff-runtime-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 10px;
}

.buff-runtime-metric {
  display: grid;
  width: max-content;
  max-width: 100%;
  min-width: 0;
}

.buff-runtime-metric :deep(.n-input-number) {
  width: 108px;
  max-width: 100%;
}

.buff-runtime-layer {
  flex: 1 1 260px;
  min-width: min(100%, 260px);
}

.optimizer-set-choice-field,
.optimizer-main-stat-field {
  align-content: start;
}

.metric-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.set-summary-actions {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  font-weight: 600;
}

.selected-set-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  min-height: 34px;
  padding: 5px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.selected-set-empty {
  align-self: center;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
}

.selected-set-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 26px;
  gap: 6px;
  padding: 3px 4px 3px 9px;
  border: 1px solid #cfe1ff;
  border-radius: 999px;
  background: #f2f7ff;
  color: #285da8;
  font-size: 12px;
  font-weight: 800;
}

.selected-set-chip-with-icon {
  padding-left: 5px;
}

.selected-set-chip img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
  background: var(--app-panel-muted);
}

.selected-set-chip span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.selected-set-remove {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #285da8;
  cursor: pointer;
}

.selected-set-remove:hover {
  background: rgba(40, 93, 168, 0.12);
  color: var(--app-text);
}

.optimizer-main-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.main-stat-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
  min-width: 0;
}

.main-stat-choice {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 7px 9px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.main-stat-choice:hover,
.main-stat-choice.active {
  border-color: var(--app-blue);
  background: #eef5ff;
  color: var(--app-blue);
}

.main-stat-choice input {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--app-blue);
}

.main-stat-choice span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.set-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}

.set-choice {
  display: grid;
  grid-template-columns: 18px 46px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.set-choice:hover,
.set-choice.active {
  border-color: var(--app-blue);
  background: #eef5ff;
}

.set-choice input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--app-blue);
}

.set-choice img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.set-choice-text {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.set-choice-text strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.set-choice-text span {
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.set-modal-footer {
  align-items: center;
  justify-content: space-between;
}

.optimizer-result-detail-shell {
  gap: 10px;
}

.optimizer-result-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 320px) auto;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.optimizer-result-rank-select {
  width: 100%;
}

.optimizer-result-disc-list {
  display: grid;
  gap: 8px;
}

.optimizer-result-disc-row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 72px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.optimizer-result-disc-row-empty {
  background: var(--app-panel-muted);
  color: var(--app-muted);
}

.optimizer-result-disc-row img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.optimizer-result-disc-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.optimizer-result-disc-copy strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.optimizer-result-disc-copy span,
.optimizer-result-disc-copy small {
  color: var(--app-muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.optimizer-result-disc-copy span {
  font-size: 13px;
  font-weight: 650;
}

.optimizer-result-disc-copy small {
  font-size: 12px;
}

.optimizer-result-disc-meta {
  display: grid;
  justify-items: end;
  min-width: 72px;
  gap: 4px;
}

.optimizer-result-disc-meta span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
  text-align: right;
}

.optimizer-progress-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.optimizer-progress-card[data-active="true"] {
  border-color: #cfe1ff;
  background: #f6f9ff;
}

.optimizer-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 750;
}

.optimizer-progress-head strong {
  color: var(--app-blue);
  font-size: 18px;
}

.optimizer-progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #dde6f5;
}

.optimizer-progress-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--app-blue);
  transition: width 0.18s ease;
}

.optimizer-progress-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.optimizer-progress-copy strong {
  color: var(--app-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.optimizer-progress-copy p {
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.optimizer-detail-chips {
  gap: 6px;
}

.optimizer-metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
}

.modal-summary {
  min-width: 0;
  color: var(--app-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 680px) {
  .optimizer-result-toolbar {
    grid-template-columns: minmax(0, 1fr);
  }

  .optimizer-result-disc-row {
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: start;
  }

  .optimizer-result-disc-row img {
    width: 42px;
    height: 42px;
  }

  .optimizer-result-disc-meta {
    grid-column: 2;
    justify-items: start;
  }

  .optimizer-result-disc-meta span {
    text-align: left;
  }

  .set-summary-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .set-choice-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .set-modal-footer {
    align-items: stretch;
    flex-direction: column;
  }
}

</style>
