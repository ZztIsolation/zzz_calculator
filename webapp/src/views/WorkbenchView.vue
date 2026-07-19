<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from "vue"
import { NButton, NInput, NInputNumber, NModal, NSelect, NTag } from "naive-ui"
import { LineChart, RefreshCcw, Save, SlidersHorizontal, Sparkles, X } from "lucide-vue-next"
import BuffPickerModal from "@/components/BuffPickerModal.vue"
import CalculationConfigModal from "@/components/CalculationConfigModal.vue"
import DamageSummaryBar from "@/components/DamageSummaryBar.vue"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"
import DriveDiscAnalysisModal from "@/components/DriveDiscAnalysisModal.vue"
import EnemyTargetConfigPanel from "@/components/EnemyTargetConfigPanel.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import OptimizerConfigModal from "@/components/OptimizerConfigModal.vue"
import OptimizerResultSelector from "@/components/OptimizerResultSelector.vue"
import PanelStatTable from "@/components/PanelStatTable.vue"
import { fallbackIcon, imageForAgent, imageForDriveDiscSet, imageForWEngine } from "@/utils/assets"
import { buffLabelForId } from "@/utils/combatBuffs"
import {
  attributeLabel,
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
import { resolveDefaultCalculationConfig } from "@core/defaultCalculationConfig.js"

const catalogStore = useCatalogStore()
const accountStore = useAccountStore()
const inventoryStore = useInventoryStore()
const buildStore = useBuildStore()
const optimizerStore = useOptimizerStore()

const showBuffPicker = ref(false)
const showCalculationConfig = ref(false)
const showOptimizerConfig = ref(false)
const showDriveDiscAnalysis = ref(false)
const showFourPieceSetModal = ref(false)
const showTwoPieceSetModal = ref(false)
const showManualDiscPicker = ref(false)
const showSaveLoadoutModal = ref(false)
const draftFourPieceSetId = ref("")
const draftTwoPieceSetIds = ref<string[]>([])
const activeManualDiscSlot = ref(0)
const manualDiscSetFilterIds = ref<string[]>([])
const manualDiscMainStatFilter = ref("")
const manualDiscSearch = ref("")
const loadoutNameDraft = ref("")
const saveLoadoutMode = ref<"manual" | "optimized">("manual")
const OPTIMIZED_RESULT_LIMIT = 10
const OPTIMIZER_RESULT_SLOTS = [1, 2, 3, 4, 5, 6]

onMounted(async () => {
  await Promise.all([catalogStore.load(), accountStore.load()])
  await inventoryStore.load()
  if (catalogStore.catalog && catalogStore.meta) {
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    optimizerStore.initialize(
      catalogStore.catalog,
      catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId),
    )
    if (!optimizerStore.fourPieceSetId) {
      optimizerStore.setFourPieceSet(catalogStore.displayDriveDiscSets[0]?.id ?? "")
    }
    recalculate()
  }
})

watch(() => accountStore.currentOwnerId, async () => {
  await inventoryStore.load()
  optimizerStore.reset()
  if (catalogStore.catalog && catalogStore.meta) {
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    optimizerStore.loadAgentSettings(
      catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId),
      catalogStore.catalog,
    )
  }
  recalculate()
})

const selectedAgent = computed(() => catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId))
const selectedWEngine = computed(() => catalogStore.displayWEngines.find((item: any) => item.id === buildStore.wEngineId))
const selectedSkillCatalog = computed(() => catalogStore.displayAgentSkills.find((item: any) => item.id === buildStore.agentId || item.agentId === buildStore.agentId))
const agentSelectOptions = computed(() => catalogStore.displayAgents.map((agent: any) => ({
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
const canRunOptimization = computed(() => Boolean(
  buildStore.agentId
  && buildStore.wEngineId
  && optimizerStore.fourPieceSetId,
))
const selectedOptimizedScheme = computed(() => optimizerStore.selectedResult(buildStore.selectedOptimizedRank))
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
const optimizerSetChoices = computed(() => [...catalogStore.displayDriveDiscSets].sort((left: any, right: any) => labelOf(left).localeCompare(labelOf(right), "zh-CN")))
const selectedOptimizerSet = computed(() => catalogStore.displayDriveDiscSets.find((set: any) => set.id === optimizerStore.fourPieceSetId))
const draftFourPieceSet = computed(() => catalogStore.displayDriveDiscSets.find((set: any) => set.id === draftFourPieceSetId.value))
const selectedTwoPieceSets = computed(() => optimizerStore.twoPieceSetIds
  .map(id => catalogStore.displayDriveDiscSets.find((set: any) => set.id === id))
  .filter(Boolean))
const optimizerAlgorithmOptions = [
  { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
  { label: "启发式潜力", value: "heuristic-potential" },
  { label: "旧版精确", value: "exact-legacy" },
]
const minimumStats = [
  { key: "atk", label: "攻击力" },
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
  return count ? `已选择 ${count} 个额外 2 件套` : "自动匹配任意 2 件套"
})
const twoPieceDraftUnchanged = computed(() => [...draftTwoPieceSetIds.value].sort().join("|") === [...optimizerStore.twoPieceSetIds].sort().join("|"))
const topOptimizedResultSchemes = computed(() => optimizerStore.resultSchemes.slice(0, OPTIMIZED_RESULT_LIMIT))
const selectedDriveDiscRows = computed<Array<{ slot: number, disc: any | null }>>(() => {
  const bySlot = new Map<number, any>(
    selectedDriveDiscs.value.map((disc: any) => [Number(disc.partition), disc] as [number, any]),
  )
  return OPTIMIZER_RESULT_SLOTS.map(slot => ({
    slot,
    disc: bySlot.get(slot) ?? null,
  }))
})
const currentSchemeScoreLabel = computed(() => {
  if (buildStore.discMode === "optimized" && selectedOptimizedScheme.value) {
    return `第 ${selectedOptimizedScheme.value.rank} 名 · ${formatNumber(selectedOptimizedScheme.value.score, 0)}`
  }
  if (buildStore.discMode === "loadout" && selectedLoadout.value?.score !== undefined) {
    return `评分 ${formatNumber(selectedLoadout.value.score, 0)}`
  }
  return selectedDriveDiscs.value.length ? `${selectedDriveDiscs.value.length} / 6` : "未选择"
})
const calculationModeLabel = computed(() => {
  if (buildStore.damageConfig.mode !== "adminDefault") {
    return damageModeLabel(buildStore.damageConfig.mode)
  }
  const config = resolveDefaultCalculationConfig(selectedAgent.value?.defaultCalculationConfig, buildStore.cinemaLevel)
  if (!config) {
    return "默认循环"
  }
  const name = labelOf(config).trim()
  if (!name || name === "-") {
    return "默认循环"
  }
  return /^默认循环[（(]/u.test(name) ? name : `默认循环（${name}）`
})
const activeManualDiscSlotDiscs = computed(() => inventoryStore.discOptionsForSlot(activeManualDiscSlot.value))
const manualDiscPickerTitle = computed(() => activeManualDiscSlot.value ? `选择 ${activeManualDiscSlot.value} 号位驱动盘` : "选择驱动盘")
const manualDiscSetFilterOptions = computed(() => {
  const sets = new Map<string, { label: string, value: string, set: any, searchText: string }>()
  for (const disc of inventoryStore.driveDiscs) {
    const set = driveDiscSetForDisc(disc)
    const id = String(set?.id || disc?.setId || "")
    if (id) {
      const label = driveDiscSetName(disc)
      sets.set(id, {
        label,
        value: id,
        set,
        searchText: `${label} ${id}`,
      })
    }
  }
  return [...sets.values()]
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"))
})
watch(manualDiscSetFilterOptions, options => {
  const availableSetIds = new Set(options.map(option => option.value))
  const validSetIds = manualDiscSetFilterIds.value.filter(id => availableSetIds.has(id))
  if (validSetIds.length !== manualDiscSetFilterIds.value.length) {
    manualDiscSetFilterIds.value = validSetIds
  }
})
const manualDiscMainStatFilterOptions = computed(() => {
  const stats = Array.from(new Set<string>(activeManualDiscSlotDiscs.value
    .map((disc: any) => String(disc.mainStat?.stat ?? ""))
    .filter(Boolean)))
    .sort((left: string, right: string) => statLabel(left, catalogStore.meta).localeCompare(statLabel(right, catalogStore.meta), "zh-CN"))
  return [
    { label: "全部主词条", value: "" },
    ...stats.map((stat: string) => ({ label: statLabel(stat, catalogStore.meta), value: stat })),
  ]
})
const filteredManualDiscOptions = computed(() => {
  const slot = Number(activeManualDiscSlot.value)
  const setIds = manualDiscSetFilterIds.value
  const mainStat = manualDiscMainStatFilter.value
  const search = manualDiscSearch.value.trim().toLowerCase()
  const selectedId = buildStore.manualDriveDiscIdsBySlot[String(slot)] ?? ""
  return inventoryStore.driveDiscs
    .filter((disc: any) => {
      const set = driveDiscSetForDisc(disc)
      const discSetId = String(set?.id || disc?.setId || "")
      const haystack = [
        disc.id,
        disc.setId,
        disc.setName,
        driveDiscSetName(disc),
        disc.source?.sequence,
        storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode, catalogStore.meta),
        disc.mainStat?.label,
        ...(disc.subStats ?? []).flatMap((stat: any) => [
          storedStatLabel(stat.stat, stat.mode, catalogStore.meta),
          stat.label,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return Number(disc.partition) === slot
        && (!setIds.length || setIds.includes(discSetId))
        && (!mainStat || disc.mainStat?.stat === mainStat)
        && (!search || haystack.includes(search))
    })
    .sort((left: any, right: any) => {
      const leftSelected = left.id === selectedId ? 0 : 1
      const rightSelected = right.id === selectedId ? 0 : 1
      return leftSelected - rightSelected
        || driveDiscSetName(left).localeCompare(driveDiscSetName(right), "zh-CN")
        || Number(left.source?.sequence ?? 999999) - Number(right.source?.sequence ?? 999999)
    })
})
const saveLoadoutDiscs = computed(() => saveLoadoutMode.value === "optimized"
  ? selectedOptimizedScheme.value?.driveDiscs ?? []
  : selectedDriveDiscs.value)
const saveLoadoutIdsBySlot = computed(() => driveDiscIdsBySlotFromDiscs(saveLoadoutDiscs.value))
const saveLoadoutMissingSlots = computed(() => OPTIMIZER_RESULT_SLOTS.filter(slot => !saveLoadoutIdsBySlot.value[String(slot)]))
const saveLoadoutTitle = computed(() => saveLoadoutMode.value === "optimized" ? "保存优化结果" : "保存自选套装")
const saveLoadoutSourceLabel = computed(() => saveLoadoutMode.value === "optimized" ? "优化结果" : "手动选择")
const canSaveCurrentScheme = computed(() => {
  if (buildStore.discMode === "manual") {
    return selectedDriveDiscs.value.length > 0
  }
  if (buildStore.discMode === "optimized") {
    return Boolean(selectedOptimizedScheme.value?.driveDiscs?.length)
  }
  return false
})
const activeMainStatLimitCount = computed(() => Object.values(optimizerStore.mainStatLimits ?? {})
  .reduce((total: number, values: any) => total + (Array.isArray(values) ? values.length : 0), 0))
const activeMinimumCount = computed(() => Object.values(optimizerStore.minimums ?? {})
  .filter(value => value !== null && value !== undefined).length)
const optimizerConstraintChips = computed(() => [
  `算法：${optimizerAlgorithmOptions.find(option => option.value === optimizerStore.algorithm)?.label ?? optimizerStore.algorithm}`,
  `4件套 Buff：${optimizerStore.fourPieceBuffMode === "manual" ? "手动" : "自动"}`,
  activeMainStatLimitCount.value ? `主词条限制 ${activeMainStatLimitCount.value} 项` : "未限定主词条",
  activeMinimumCount.value ? `最小值 ${activeMinimumCount.value} 项` : "未限定最小值",
])
const totalDamageLabel = computed(() => {
  const damage = buildStore.result?.damage
  const value = damage?.totalFinalDamage ?? damage?.finalDamage
  return value === undefined || value === null ? "-" : formatNumber(value, 0)
})
const panelSummaryText = computed(() => {
  const panel = buildStore.result?.inCombat?.panel ?? buildStore.outOfCombat?.panel ?? {}
  const atk = panel.finalAtk ?? panel.atk ?? panel.baseAtk
  const critRate = panel.critRate
  const critDmg = panel.critDmg
  return [
    atk !== undefined ? `攻击 ${formatNumber(atk, 0)}` : "",
    critRate !== undefined ? `暴击 ${formatNumber(Number(critRate) * 100, 1)}%` : "",
    critDmg !== undefined ? `爆伤 ${formatNumber(Number(critDmg) * 100, 1)}%` : "",
  ].filter(Boolean).join(" · ") || "等待计算"
})
watch(topOptimizedResultSchemes, schemes => {
  const values = schemes.map(scheme => Number(scheme.rank))
  if (!values.length) {
    buildStore.selectOptimizedRank(0)
    return
  }
  if (!values.includes(Number(buildStore.selectedOptimizedRank))) {
    buildStore.selectOptimizedRank(values[0])
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
const activeBuffIdsForPanel = computed(() => buildStore.activeBuffIds(catalogStore.meta, catalogStore.catalog, selectedDriveDiscs.value))
const activeBuffBadges = computed(() => activeBuffIdsForPanel.value.map(id => ({
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
const customAddedBuffCount = computed(() => buildStore.addedBuffs
  .filter((buff: any) => buff?.sourceKind === "custom").length)
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
const optimizerHasFreeTwoPieceMetrics = computed(() => {
  const settings = optimizerProgress.value?.settings ?? optimizerStore.settings
  const twoPieceSetIds = Array.isArray(settings?.twoPieceSetIds)
    ? settings.twoPieceSetIds
    : settings?.twoPieceSetId
      ? [settings.twoPieceSetId]
      : []
  return twoPieceSetIds.length === 0
    && optimizerMetrics.value
    && Object.hasOwn(optimizerMetrics.value, "freeTwoPieceAutoSetCount")
})
const optimizerDetailChips = computed(() => [
  optimizerPrepareStageLabel.value ? `阶段：${optimizerPrepareStageLabel.value}` : "",
  optimizerMetrics.value?.algorithmLabel ? `算法：${optimizerMetrics.value.algorithmLabel}` : "",
  optimizerMetrics.value?.scoreKernel ? `内核 ${optimizerMetrics.value.scoreKernel === "compiled-dense" ? "dense" : "map"}` : "",
  Number(optimizerMetrics.value?.scoredCombinationCount ?? optimizerMetrics.value?.evaluated ?? 0) > 0
    ? `真实评分 ${formatNumber(optimizerMetrics.value.scoredCombinationCount ?? optimizerMetrics.value.evaluated)}` : "",
  Number(optimizerMetrics.value?.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatNumber(optimizerMetrics.value.prunedBySuperBound)}` : "",
  Number(optimizerMetrics.value?.boundChecksPerSecond ?? 0) > 0 ? `上界 ${formatRate(optimizerMetrics.value.boundChecksPerSecond)}` : "",
  optimizerHasFreeTwoPieceMetrics.value ? `自动套装 ${formatNumber(optimizerMetrics.value.freeTwoPieceAutoSetCount ?? 0)}` : "",
  optimizerHasFreeTwoPieceMetrics.value ? `4+2 计划 ${formatNumber(optimizerMetrics.value.freeFourTwoPlanCount ?? 0)}` : "",
  optimizerHasFreeTwoPieceMetrics.value ? `4+2 组合 ${formatNumber(optimizerMetrics.value.freeFourTwoCombinationCount ?? 0)}` : "",
  optimizerHasFreeTwoPieceMetrics.value ? `六件计划 ${formatNumber(optimizerMetrics.value.freeSixPiecePlanCount ?? 0)}` : "",
  optimizerHasFreeTwoPieceMetrics.value ? `六件组合 ${formatNumber(optimizerMetrics.value.freeSixPieceCombinationCount ?? 0)}` : "",
  ...candidateChipTexts(optimizerMetrics.value),
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
  const wEngine = option?.wEngine ?? catalogStore.displayWEngines.find((item: any) => item.id === option?.value)
  const label = labelOf(wEngine) || String(option?.label ?? option?.value ?? "")
  return h("span", { class: "w-engine-select-label" }, [
    h("img", {
      class: "w-engine-select-icon",
      src: imageForWEngine(wEngine),
      alt: label,
      loading: "lazy",
    }),
    h("span", { class: "w-engine-select-copy" }, [
      h("span", { class: "w-engine-select-name", title: label }, label),
      h("span", { class: "w-engine-select-meta", title: entityMetaText(wEngine) }, entityMetaText(wEngine)),
    ]),
  ])
}

function renderManualDiscSetLabel(option: any) {
  const set = option?.set ?? catalogStore.driveDiscSets.find((item: any) => item.id === option?.value)
  const label = labelOf(set) || String(option?.label ?? option?.value ?? "未知套装")
  return h("span", { class: "manual-disc-set-select-label" }, [
    h(ImageAvatar, {
      src: imageForDriveDiscSet(set),
      name: label,
      size: 20,
    }),
    h("span", { class: "manual-disc-set-select-name", title: label }, label),
  ])
}

function updateManualDiscSetFilter(value: Array<string | number> | null) {
  manualDiscSetFilterIds.value = Array.isArray(value) ? value.map(String) : []
}

function applyBuffs(payload: any) {
  buildStore.applyBuffState(payload, catalogStore.meta)
}

function saveCalculationConfig(config: any) {
  buildStore.setDamageConfig(config, selectedAgent.value)
}

function saveOptimizerConfig(config: any) {
  optimizerStore.applyAdvancedSettings(config)
}

function selectAgent(agentId: string) {
  buildStore.selectAgent(agentId, catalogStore.meta)
  optimizerStore.loadAgentSettings(
    catalogStore.displayAgents.find((item: any) => item.id === agentId),
    catalogStore.catalog,
  )
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
  if (!canRunOptimization.value) {
    optimizerStore.failBeforeRun(
      "当前没有可用于优化的可见角色、音擎或驱动盘套装。请先在维护页启用至少一项。",
      optimizerStore.settings,
    )
    return
  }
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
    buildStore.selectOptimizedRank(Number(optimizerStore.resultSchemes[0].rank))
  }
}

function driveDiscIdsBySlotFromDiscs(discs: any[] = []) {
  return Object.fromEntries(
    discs
      .map((disc: any): [string, string] => [String(Number(disc.partition)), String(disc.id ?? "")])
      .filter(([slot, id]) => Number(slot) >= 1 && Number(slot) <= 6 && Boolean(id)),
  )
}

function defaultLoadoutName(mode: "manual" | "optimized") {
  const agentName = labelOf(selectedAgent.value) || buildStore.agentId || "当前角色"
  if (mode === "optimized" && selectedOptimizedScheme.value) {
    const scheme = selectedOptimizedScheme.value
    return scheme.loadoutName || `${agentName}-${Math.round(Number(scheme.score ?? 0))}-第${scheme.rank}名`
  }
  return `${agentName}-自选套装`
}

function openSaveCurrentLoadout() {
  if (buildStore.discMode === "optimized") {
    openSaveOptimizedLoadout()
    return
  }
  openSaveManualLoadout()
}

function openSaveManualLoadout() {
  if (!selectedDriveDiscs.value.length) {
    return
  }
  saveLoadoutMode.value = "manual"
  loadoutNameDraft.value = defaultLoadoutName("manual")
  showSaveLoadoutModal.value = true
}

function openSaveOptimizedLoadout() {
  if (!selectedOptimizedScheme.value?.driveDiscs?.length) {
    return
  }
  saveLoadoutMode.value = "optimized"
  loadoutNameDraft.value = defaultLoadoutName("optimized")
  showSaveLoadoutModal.value = true
}

async function saveLoadoutFromModal() {
  const driveDiscIdsBySlot = saveLoadoutIdsBySlot.value
  if (!Object.keys(driveDiscIdsBySlot).length) {
    return
  }
  const mode = saveLoadoutMode.value
  const scheme = selectedOptimizedScheme.value
  const loadout = await inventoryStore.saveLoadout({
    name: loadoutNameDraft.value.trim() || defaultLoadoutName(mode),
    agentId: buildStore.agentId,
    driveDiscIdsBySlot,
    ...(mode === "optimized"
      ? {
          score: scheme?.score,
          source: { type: "optimizer", rank: scheme?.rank },
        }
      : {
          source: { type: "manual", scope: "workbench" },
        }),
  })
  showSaveLoadoutModal.value = false
  if (mode === "optimized") {
    buildStore.selectLoadout(loadout.id)
  }
}

function openManualDiscPicker(slot: number) {
  if (buildStore.discMode !== "manual") {
    return
  }
  activeManualDiscSlot.value = Number(slot)
  manualDiscMainStatFilter.value = ""
  manualDiscSearch.value = ""
  showManualDiscPicker.value = true
}

function selectManualDriveDisc(disc: any) {
  if (!activeManualDiscSlot.value || !disc?.id) {
    return
  }
  buildStore.setManualDriveDisc(activeManualDiscSlot.value, disc.id)
  showManualDiscPicker.value = false
}

function clearManualDriveDiscSlot() {
  if (!activeManualDiscSlot.value) {
    return
  }
  buildStore.setManualDriveDisc(activeManualDiscSlot.value, "")
  showManualDiscPicker.value = false
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

function candidateChipTexts(metrics: any = {}) {
  const counts = metrics.candidateCountsBySlot ?? {}
  return Object.entries(counts).map(([slot, count]) => `候选 ${slot}号位 ${formatNumber(count)}`)
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
  <section class="workbench-grid workbench-merged-grid ui-layout-scope" data-layout-surface="workbench">
    <aside class="workbench-left section-band">
      <div class="panel">
        <div class="panel-header">
          <h1 class="panel-title">角色</h1>
          <NTag v-if="selectedAgent" round>{{ attributeLabel(selectedAgent.attribute) }}</NTag>
        </div>
        <div class="panel-body section-band">
          <div v-if="selectedAgent" class="selection-summary">
            <ImageAvatar :src="imageForAgent(selectedAgent)" :name="labelOf(selectedAgent)" :size="56" round />
            <div class="selection-summary-copy">
              <strong :title="labelOf(selectedAgent)">{{ labelOf(selectedAgent) }}</strong>
              <div class="muted" :title="entityMetaText(selectedAgent)">{{ entityMetaText(selectedAgent) }}</div>
            </div>
          </div>
          <NSelect
            :value="buildStore.agentId"
            :options="agentSelectOptions"
            :filter="filterSelectOption"
            filterable
            placeholder="选择角色"
            @update:value="value => selectAgent(String(value))"
          />
          <div class="build-compact-grid build-profile-grid ui-field-grid" data-layout-surface="agent-profile-fields">
            <label class="compact-field ui-field" data-layout-field>
              <span>等级</span>
              <NInputNumber v-model:value="buildStore.agentLevel" :min="1" :max="60" size="small" />
            </label>
            <label class="compact-field ui-field" data-layout-field>
              <span>影画</span>
              <NSelect
                :value="buildStore.cinemaLevel"
                :options="cinemaLevelOptions"
                size="small"
                @update:value="buildStore.setCinemaLevel(Number($event ?? 0), catalogStore.meta)"
              />
            </label>
            <label class="compact-field compact-field-wide ui-field ui-field--full" data-layout-field>
              <span>核心技</span>
              <NSelect v-model:value="buildStore.coreSkillLevel" :options="coreSkillOptions" size="small" />
            </label>
          </div>
          <div class="build-skill-grid ui-field-grid" data-layout-surface="skill-level-fields">
            <label v-for="control in skillLevelControls" :key="control.id" class="compact-field ui-field" data-layout-field>
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
              <strong :title="labelOf(selectedWEngine)">{{ labelOf(selectedWEngine) }}</strong>
              <div class="muted" :title="entityMetaText(selectedWEngine)">{{ entityMetaText(selectedWEngine) }}</div>
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
          <div class="build-compact-grid ui-field-grid" data-layout-surface="w-engine-fields">
            <label class="compact-field ui-field" data-layout-field>
              <span>等级</span>
              <NInputNumber v-model:value="buildStore.wEngineLevel" :min="1" :max="60" size="small" />
            </label>
            <label class="compact-field ui-field" data-layout-field>
              <span>精修</span>
              <NSelect v-model:value="buildStore.wEngineModificationLevel" :options="modificationOptions" size="small" />
            </label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">局内 Buff</h2>
          <NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-buff-picker" @click="showBuffPicker = true">
            <template #icon><SlidersHorizontal :size="18" /></template>
            选择 Buff
          </NButton>
        </div>
        <div class="panel-body section-band">
          <div class="chip-row">
            <NTag v-for="item in activeBuffBadges" :key="item.id" round>{{ item.label }}</NTag>
            <NTag v-if="!activeBuffIdsForPanel.length" round>未启用 Buff</NTag>
          </div>
          <NTag v-if="customAddedBuffCount" type="info" round>自定义 {{ customAddedBuffCount }} 条</NTag>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">计算设置</h2>
          <NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-calculation-config" @click="showCalculationConfig = true">
            <template #icon><SlidersHorizontal :size="18" /></template>
            配置
          </NButton>
        </div>
        <div class="panel-body metric-grid calculation-summary-grid">
          <dl class="metric" data-layout-field>
            <dt>模式</dt>
            <dd>{{ calculationModeLabel }}</dd>
          </dl>
          <dl class="metric" data-layout-field>
            <dt>事件</dt>
            <dd>{{ buildStore.damageConfig.events?.length ?? 1 }} 项</dd>
          </dl>
          <div class="metric calculation-event-summary" data-layout-field>
            <dt>事件摘要</dt>
            <dd class="chip-row calculation-event-summary-tags">
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
    </aside>

    <main class="workbench-center section-band">
      <div class="panel optimizer-constraint-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">优化约束</h2>
            <p class="panel-subtitle">外部只保留套装限制，高级项在计算配置中调整</p>
          </div>
          <div class="toolbar optimizer-config-actions">
            <NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-optimizer-config" @click="showOptimizerConfig = true">
              <template #icon><SlidersHorizontal :size="18" /></template>
              计算配置
            </NButton>
            <NTag :type="optimizerStore.status === 'error' ? 'error' : optimizerStore.status === 'done' ? 'success' : 'info'" round>{{ optimizerStatusLabel(optimizerStore.status) }}</NTag>
          </div>
        </div>
        <div class="panel-body section-band">
          <div class="optimizer-set-grid ui-field-grid ui-field-grid--comfortable" data-layout-surface="optimizer-set-fields">
            <div class="metric optimizer-set-choice-field ui-field" data-layout-field>
              <dt>限定 4 件套</dt>
              <dd class="set-summary-actions">
                <NButton size="small" @click="openFourPieceSetModal">选择</NButton>
                <div class="selected-set-summary" aria-live="polite">
                  <span v-if="selectedOptimizerSet" class="selected-set-chip selected-set-chip-with-icon">
                    <img :src="imageForDriveDiscSet(selectedOptimizerSet)" alt="" loading="lazy">
                    <span>{{ labelOf(selectedOptimizerSet) }}</span>
                  </span>
                  <span v-else class="selected-set-empty">未选择限定 4 件套</span>
                </div>
              </dd>
            </div>
            <div class="metric optimizer-set-choice-field ui-field" data-layout-field>
              <dt class="metric-title-row">
                <span>额外 2 件套</span>
                <NButton size="tiny" text :disabled="!optimizerStore.twoPieceSetIds.length" @click="clearTwoPieceSetLimits">清空</NButton>
              </dt>
              <dd class="set-summary-actions">
                <NButton size="small" @click="openTwoPieceSetModal">选择</NButton>
                <div class="selected-set-summary" aria-live="polite">
                  <span v-if="!selectedTwoPieceSets.length" class="selected-set-empty">自动匹配任意 2 件套</span>
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
          </div>
          <div class="chip-row optimizer-constraint-chips">
            <NTag v-for="chip in optimizerConstraintChips" :key="chip" round>{{ chip }}</NTag>
          </div>
          <div class="optimizer-run-row">
            <div class="toolbar">
              <NButton v-if="!optimizerStore.isBusy" type="primary" :disabled="!canRunOptimization" @click="runOptimization">
                <template #icon><Sparkles :size="16" /></template>
                开始优化
              </NButton>
              <NButton v-else type="warning" disabled>
                {{ optimizerStore.status === "preparing" ? "准备中" : optimizerStore.status === "cancelling" ? "正在取消..." : "运行中" }}
              </NButton>
              <NButton v-if="optimizerStore.status === 'preparing' || optimizerStore.status === 'running' || optimizerStore.status === 'cancelling'" type="warning" @click="optimizerStore.cancel">取消优化</NButton>
              <NButton :disabled="!selectedOptimizedScheme" @click="openSaveOptimizedLoadout">
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
          </div>
          <div v-if="optimizerStore.error" class="empty-state optimizer-error-state">{{ optimizerStore.error }}</div>
        </div>
      </div>

      <div class="panel drive-disc-workbench-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">驱动盘方案</h2>
            <p class="panel-subtitle">{{ driveDiscAnalysisSourceLabel }} · {{ currentSchemeScoreLabel }}</p>
          </div>
          <NTag round>{{ selectedDriveDiscs.length }} / 6</NTag>
        </div>
        <div class="panel-body section-band">
          <div class="drive-disc-mode-row">
            <div class="toolbar drive-disc-mode-toolbar">
              <NButton size="small" :type="buildStore.discMode === 'manual' ? 'primary' : 'default'" @click="buildStore.setDiscMode('manual')">自选</NButton>
              <NButton size="small" :type="buildStore.discMode === 'loadout' ? 'primary' : 'default'" @click="buildStore.setDiscMode('loadout')">已有套装</NButton>
              <NButton size="small" :type="buildStore.discMode === 'optimized' ? 'primary' : 'default'" :disabled="!optimizerStore.resultSchemes.length" @click="buildStore.setDiscMode('optimized')">优化结果</NButton>
            </div>
            <div class="toolbar drive-disc-action-toolbar">
              <NButton size="small" :disabled="!canSaveCurrentScheme" @click="openSaveCurrentLoadout">
                <template #icon><Save :size="16" /></template>
                存为套装
              </NButton>
              <NButton size="small" data-testid="open-drive-disc-analysis" :disabled="!selectedDriveDiscs.length" @click="showDriveDiscAnalysis = true">
                <template #icon><LineChart :size="16" /></template>
                词条分析
              </NButton>
            </div>
          </div>

          <div class="drive-disc-analysis-strip">
            <div>
              <strong>{{ driveDiscAnalysisSourceLabel }}</strong>
              <span>{{ selectedDriveDiscs.length ? `${selectedDriveDiscs.length} 件驱动盘参与当前伤害计算` : "选择驱动盘后可查看词条分析" }}</span>
            </div>
            <NTag round>{{ panelSummaryText }}</NTag>
          </div>

          <div v-if="buildStore.discMode === 'loadout'" class="drive-disc-mode-control">
            <NSelect
              :value="buildStore.selectedLoadoutId"
              :options="loadoutOptions"
              filterable
              @update:value="buildStore.selectLoadout(String($event ?? ''))"
            />
          </div>
          <OptimizerResultSelector
            v-else-if="buildStore.discMode === 'optimized'"
            class="drive-disc-mode-control"
            :model-value="buildStore.selectedOptimizedRank"
            :results="topOptimizedResultSchemes"
            @update:model-value="buildStore.selectOptimizedRank"
          />

          <div class="drive-disc-slot-grid">
            <article
              v-for="row in selectedDriveDiscRows"
              :key="row.slot"
              class="disc-slot-card"
              :class="{ 'disc-slot-card-empty': !row.disc, 'disc-slot-card-manual': buildStore.discMode === 'manual' }"
              @click="openManualDiscPicker(row.slot)"
            >
              <img :src="row.disc ? driveDiscSetIcon(row.disc) : fallbackIcon" alt="" loading="lazy">
              <div class="disc-slot-card-copy">
                <strong>{{ row.disc ? `${row.slot}号位 · ${driveDiscSetName(row.disc)}` : `${row.slot}号位 · 未选择` }}</strong>
                <span>{{ row.disc ? driveDiscStatText(row.disc.mainStat) : "空槽位" }}</span>
                <small>{{ row.disc ? driveDiscSubStatText(row.disc) : "可在自选模式选择已有驱动盘" }}</small>
              </div>
              <div class="disc-slot-card-meta">
                <NTag v-if="row.disc" round>{{ driveDiscRarityLevelText(row.disc) }}</NTag>
                <NButton
                  v-if="buildStore.discMode === 'manual'"
                  size="tiny"
                  @click.stop="openManualDiscPicker(row.slot)"
                >
                  {{ row.disc ? "更换" : "选择" }}
                </NButton>
              </div>
            </article>
          </div>
        </div>
      </div>
    </main>

    <aside class="workbench-right section-band">
      <div class="workbench-right-sticky section-band">
        <DamageSummaryBar :result="buildStore.result" :error="buildStore.error" :loading="catalogStore.loading" />
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">伤害白盒</h2>
              <p class="panel-subtitle">随当前驱动盘方案实时刷新</p>
            </div>
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
        <div class="panel damage-panel-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">面板</h2>
              <p class="panel-subtitle">局外与局内对照</p>
            </div>
            <NTag round>{{ totalDamageLabel }}</NTag>
          </div>
          <div class="panel-body damage-panel-grid">
            <div>
              <h3>局外</h3>
              <PanelStatTable
                :panel="buildStore.outOfCombat?.panel"
                :meta="catalogStore.meta"
                :include-sheer-force="selectedAgent?.specialty === 'rupture'"
              />
            </div>
            <div>
              <h3>局内</h3>
              <PanelStatTable
                :panel="buildStore.result?.inCombat?.panel"
                :meta="catalogStore.meta"
                :include-sheer-force="selectedAgent?.specialty === 'rupture'"
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  </section>

  <NModal v-model:show="showManualDiscPicker" preset="card" :title="manualDiscPickerTitle" style="width: min(980px, calc(100vw - 16px)); max-width: 980px">
    <div class="section-band manual-disc-picker ui-layout-scope" data-layout-surface="manual-drive-disc-picker">
      <div class="manual-disc-picker-head">
        <span>只显示当前号位的已有驱动盘</span>
        <NTag round>{{ filteredManualDiscOptions.length }} 件可选</NTag>
      </div>
      <div class="manual-disc-filter-row ui-field-grid ui-field-grid--comfortable" data-layout-surface="manual-drive-disc-filters">
        <div class="metric" data-layout-field>
          <dt>套装</dt>
          <dd>
            <NSelect
              class="manual-disc-set-select"
              :value="manualDiscSetFilterIds"
              :options="manualDiscSetFilterOptions"
              :filter="filterSelectOption"
              :render-label="renderManualDiscSetLabel"
              max-tag-count="responsive"
              multiple
              filterable
              clearable
              placeholder="全部套装"
              @update:value="updateManualDiscSetFilter"
            />
          </dd>
        </div>
        <div class="metric" data-layout-field>
          <dt>主词条</dt>
          <dd>
            <NSelect
              :value="manualDiscMainStatFilter"
              :options="manualDiscMainStatFilterOptions"
              clearable
              @update:value="manualDiscMainStatFilter = String($event ?? '')"
            />
          </dd>
        </div>
        <div class="metric" data-layout-field>
          <dt>搜索</dt>
          <dd><NInput v-model:value="manualDiscSearch" clearable placeholder="套装、属性、序号" /></dd>
        </div>
      </div>

      <div v-if="filteredManualDiscOptions.length" class="manual-disc-option-list">
        <button
          v-for="disc in filteredManualDiscOptions"
          :key="disc.id"
          type="button"
          class="manual-disc-option"
          :class="{ active: buildStore.manualDriveDiscIdsBySlot[String(activeManualDiscSlot)] === disc.id }"
          @click="selectManualDriveDisc(disc)"
        >
          <img :src="driveDiscSetIcon(disc)" alt="" loading="lazy">
          <span class="manual-disc-option-main">
            <strong>{{ driveDiscSetName(disc) }}</strong>
            <span>{{ disc.partition }}号位 · {{ driveDiscRarityLevelText(disc) }}{{ disc.source?.sequence ? ` · #${disc.source.sequence}` : "" }}</span>
          </span>
          <span class="manual-disc-option-stat">
            <strong>{{ driveDiscStatText(disc.mainStat) }}</strong>
            <span>{{ driveDiscSubStatText(disc) }}</span>
          </span>
        </button>
      </div>
      <div v-else class="empty-state manual-disc-empty">
        <img :src="fallbackIcon" alt="">
        <strong>暂无驱动盘</strong>
        <span>暂无符合筛选条件的驱动盘</span>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <span class="modal-summary">{{ activeManualDiscSlot ? `${activeManualDiscSlot} 号位` : "未选择槽位" }}</span>
        <span class="toolbar">
          <NButton
            type="error"
            :disabled="!buildStore.manualDriveDiscIdsBySlot[String(activeManualDiscSlot)]"
            @click="clearManualDriveDiscSlot"
          >
            卸下此槽位
          </NButton>
          <NButton @click="showManualDiscPicker = false">关闭</NButton>
        </span>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showSaveLoadoutModal" preset="card" :title="saveLoadoutTitle" style="width: min(640px, calc(100vw - 16px)); max-width: 640px">
    <div class="section-band ui-layout-scope" data-layout-surface="save-loadout">
      <div class="metric" data-layout-field>
        <dt>套装名称</dt>
        <dd><NInput v-model:value="loadoutNameDraft" clearable placeholder="输入套装名称" /></dd>
      </div>
      <div class="chip-row save-loadout-summary">
        <NTag round>{{ saveLoadoutSourceLabel }}</NTag>
        <NTag round>{{ saveLoadoutDiscs.length }} / 6</NTag>
        <NTag :type="saveLoadoutMissingSlots.length ? 'warning' : 'success'" round>
          {{ saveLoadoutMissingSlots.length ? `缺失 ${saveLoadoutMissingSlots.join('、')} 号位` : '六槽完整' }}
        </NTag>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <span class="modal-summary">保存后会更新驱动盘页中的套装预设</span>
        <span class="toolbar">
          <NButton @click="showSaveLoadoutModal = false">取消</NButton>
          <NButton type="primary" :disabled="!saveLoadoutDiscs.length" @click="saveLoadoutFromModal">保存套装</NButton>
        </span>
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
    :drive-disc-sets="catalogStore.displayDriveDiscSets"
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
    :cinema-level="buildStore.cinemaLevel"
    :combat-effects="buildStore.result?.inCombat?.activeEffects ?? []"
    @save="saveCalculationConfig"
  />

  <OptimizerConfigModal
    v-model:show="showOptimizerConfig"
    :optimizer-config="optimizerStore.settings"
    :optimizer-algorithm-options="optimizerAlgorithmOptions"
    :main-stat-options-by-slot="mainStatOptionsBySlot"
    :minimum-stats="minimumStats"
    :four-piece-runtime-buffs="fourPieceRuntimeBuffs"
    @save="saveOptimizerConfig"
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
.workbench-merged-grid {
  grid-template-columns: minmax(250px, 300px) minmax(480px, 1fr) minmax(340px, 430px);
  gap: 14px;
}

.workbench-left,
.workbench-center,
.workbench-right {
  min-width: 0;
}

.workbench-left {
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  max-width: 100%;
}

.workbench-left > *,
.workbench-left .section-band,
.workbench-left .metric-grid,
.workbench-left .metric,
.workbench-left .chip-row {
  min-width: 0;
  max-width: 100%;
}

.workbench-left .section-band {
  grid-template-columns: minmax(0, 1fr);
}

.workbench-left :deep(.n-select),
.workbench-left :deep(.n-input),
.workbench-left :deep(.n-input-number),
.workbench-left :deep(.n-base-selection),
.workbench-left :deep(.n-input-wrapper) {
  min-width: 0;
  max-width: 100%;
}

.calculation-summary-grid .metric dd,
.calculation-event-summary,
.calculation-event-summary-tags {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.calculation-event-summary {
  grid-column: 1 / -1;
}

.calculation-event-summary-tags :deep(.n-tag) {
  max-width: 100%;
  height: auto;
  min-height: 28px;
  white-space: normal;
}

.calculation-event-summary-tags :deep(.n-tag__content) {
  min-width: 0;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}

.workbench-right-sticky {
  position: sticky;
  top: 74px;
}

.panel-subtitle {
  margin: 4px 0 0;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.35;
}

.prominent-config-button {
  min-width: 116px;
  height: 40px;
  padding: 0 16px;
  border: 2px solid var(--app-blue);
  background: #eef5ff;
  color: #185abd;
  font-weight: 750;
  box-shadow: 0 2px 5px rgba(47, 125, 246, 0.12);
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.prominent-config-button:not(.n-button--disabled):hover {
  border-color: #1f6fe6;
  background: #dbeafe;
  color: #124b9c;
  box-shadow: 0 3px 8px rgba(47, 125, 246, 0.18);
  transform: translateY(-1px);
}

.prominent-config-button:not(.n-button--disabled):active {
  background: #cfe1ff;
  color: #0f438c;
  box-shadow: 0 1px 3px rgba(47, 125, 246, 0.16);
  transform: translateY(0);
}

.prominent-config-button:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.28);
  outline-offset: 2px;
}

.optimizer-set-grid {
  --ui-field-min: 220px;
  gap: 10px;
}

.optimizer-constraint-chips {
  gap: 6px;
}

.optimizer-run-row {
  display: grid;
  grid-template-columns: minmax(170px, auto) minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  min-width: 0;
}

.optimizer-run-row > * {
  min-width: 0;
}

.optimizer-run-row > .toolbar {
  align-content: start;
}

.optimizer-error-state {
  min-height: 72px;
}

.drive-disc-mode-row,
.drive-disc-analysis-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.drive-disc-mode-toolbar {
  gap: 6px;
}

.drive-disc-action-toolbar {
  justify-content: flex-end;
}

.drive-disc-analysis-strip {
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: var(--app-radius-sm);
  background: #f7fbff;
}

.drive-disc-analysis-strip > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.drive-disc-analysis-strip strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--app-text);
  font-size: 13px;
}

.drive-disc-analysis-strip span {
  color: var(--app-muted);
  font-size: 12px;
}

.drive-disc-mode-control {
  min-width: 0;
}

.drive-disc-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.disc-slot-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 112px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
}

.disc-slot-card-empty {
  background: var(--app-panel-muted);
}

.disc-slot-card-manual {
  cursor: pointer;
}

.disc-slot-card-manual:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.disc-slot-card img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.disc-slot-card-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.disc-slot-card-copy strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.disc-slot-card-copy span,
.disc-slot-card-copy small {
  color: var(--app-muted);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.disc-slot-card-copy span {
  font-size: 12px;
  font-weight: 700;
}

.disc-slot-card-copy small {
  font-size: 11px;
}

.disc-slot-card-meta {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.manual-disc-picker {
  gap: 12px;
}

.manual-disc-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-muted);
  font-size: 12px;
}

.manual-disc-filter-row {
  --ui-field-min: 180px;
  gap: 10px;
}

.manual-disc-set-select-label {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  gap: 6px;
  vertical-align: middle;
}

.manual-disc-set-select-label :deep(.avatar) {
  flex: 0 0 auto;
}

.manual-disc-set-select-label :deep(.avatar img) {
  object-fit: contain;
}

.manual-disc-set-select-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manual-disc-set-select :deep(.n-base-selection-tags) {
  min-width: 0;
}

.manual-disc-set-select :deep(.n-tag__content) {
  min-width: 0;
  max-width: 100%;
}

.manual-disc-option-list {
  display: grid;
  gap: 8px;
  max-height: min(560px, calc(100vh - 300px));
  overflow: auto;
}

.manual-disc-option {
  display: grid;
  grid-template-columns: 54px minmax(160px, 0.78fr) minmax(220px, 1.22fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 72px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.manual-disc-option:hover,
.manual-disc-option.active {
  border-color: #2563eb;
  background: #f8fbff;
}

.manual-disc-option.active {
  box-shadow: inset 4px 0 0 #facc15;
}

.manual-disc-option img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.manual-disc-option-main,
.manual-disc-option-stat {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.manual-disc-option-main strong,
.manual-disc-option-stat strong,
.manual-disc-option-main span,
.manual-disc-option-stat span {
  min-width: 0;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.manual-disc-option-main strong,
.manual-disc-option-stat strong {
  color: var(--app-text);
  font-size: 13px;
}

.manual-disc-option-main span,
.manual-disc-option-stat span {
  color: var(--app-muted);
  font-size: 12px;
}

.manual-disc-empty {
  min-height: 260px;
}

.save-loadout-summary {
  margin-top: 10px;
}

.damage-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 12px 12px;
}

.damage-panel-card > .panel-header {
  padding: 10px 12px;
}

.damage-panel-grid > div {
  min-width: 0;
}

.damage-panel-grid h3 {
  margin: 0 0 6px;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.2;
}

.damage-panel-card :deep(.data-table) {
  table-layout: fixed;
}

.damage-panel-card :deep(.data-table th),
.damage-panel-card :deep(.data-table td) {
  padding: 6px 8px;
  line-height: 1.25;
}

.damage-panel-card :deep(.data-table th) {
  width: 54%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.damage-panel-card :deep(.data-table td) {
  white-space: normal;
  overflow-wrap: anywhere;
}

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
  --ui-field-min: 124px;
  gap: 8px;
}

.compact-field {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.compact-field > span {
  overflow: visible;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
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
  min-width: 0;
  padding: 12px;
  overflow: hidden;
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
  min-width: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 750;
}

.optimizer-progress-head strong {
  min-width: 0;
  color: var(--app-blue);
  font-size: 18px;
  overflow-wrap: anywhere;
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
  min-width: 0;
  color: var(--app-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.optimizer-progress-copy p {
  min-width: 0;
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.optimizer-detail-chips {
  gap: 6px;
  min-width: 0;
}

.optimizer-detail-chips :deep(.n-tag) {
  max-width: 100%;
  height: auto;
  min-height: 28px;
  white-space: normal;
}

.optimizer-detail-chips :deep(.n-tag__content) {
  min-width: 0;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
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

@media (max-width: 1280px) {
  .workbench-merged-grid {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }

  .workbench-right {
    grid-column: 1 / -1;
  }

  .workbench-right-sticky {
    position: static;
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 980px) {
  .workbench-merged-grid {
    grid-template-columns: 1fr;
  }

  .workbench-right {
    order: -1;
  }

  .workbench-left {
    order: 0;
  }

  .workbench-center {
    order: 1;
  }

  .optimizer-run-row,
  .drive-disc-slot-grid,
  .manual-disc-filter-row {
    grid-template-columns: 1fr;
  }

  .drive-disc-mode-row,
  .drive-disc-analysis-strip {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 680px) {
  .damage-panel-grid {
    grid-template-columns: 1fr;
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

  .manual-disc-option {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .manual-disc-option-stat {
    grid-column: 2;
  }

  .manual-disc-option img {
    width: 42px;
    height: 42px;
  }

  .set-modal-footer {
    align-items: stretch;
    flex-direction: column;
  }
}

</style>
