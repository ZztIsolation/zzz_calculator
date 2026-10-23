<script setup lang="ts">
import { computed, h, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue"
import { NAlert, NButton, NInput, NInputNumber, NModal, NSelect, NTag, useMessage } from "naive-ui"
import { Ban, CheckSquare, LineChart, LockKeyhole, UnlockKeyhole, Save, SlidersHorizontal, Sparkles, X } from "lucide-vue-next"
import BuffPickerModal from "@/components/BuffPickerModal.vue"
import CalculationConfigModal from "@/components/CalculationConfigModal.vue"
import DriveDiscAnalysisModal from "@/components/DriveDiscAnalysisModal.vue"
import DriveDiscPickerModal from "@/components/DriveDiscPickerModal.vue"
import DriveDiscPagination from "@/components/DriveDiscPagination.vue"
import ExpandToggle from "@/components/ExpandToggle.vue"
import { useDriveDiscPagination } from "@/utils/driveDiscPagination"
import DriveDiscSlotCard from "@/components/DriveDiscSlotCard.vue"
import EnemyTargetConfigPanel from "@/components/EnemyTargetConfigPanel.vue"
import AgentSelect from "@/components/AgentSelect.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LuminescenceParameterFields from "@/components/LuminescenceParameterFields.vue"
import OptimizerConfigModal from "@/components/OptimizerConfigModal.vue"
import OptimizerResultSelector from "@/components/OptimizerResultSelector.vue"
import OptimizerSetChoiceModal from "@/components/workbench/OptimizerSetChoiceModal.vue"
import WorkbenchSegmentedControl from "@/components/workbench/WorkbenchSegmentedControl.vue"
import WorkbenchResultColumn from "@/components/workbench/WorkbenchResultColumn.vue"
import WEngineSelect from "@/components/WEngineSelect.vue"
import { groupActiveBuffs } from "@/utils/activeBuffGroups"
import { fallbackIcon, thumbnailForDriveDiscSet } from "@/utils/assets"
import { buffLabelForId, teammateBuffCandidates } from "@/utils/combatBuffs"
import { inferBuffPickerState, selectedTeammateOwnerIds } from '@/utils/teammateBuffPicker'
import { sameTeammateValue, syncEnkaTeammates, type TeammateSources } from '@/utils/enkaTeammates'
import { readTeammateSources } from '@runtime/enka-teammate-sources'
import { countEffectiveDriveDiscSubstats } from "@/utils/driveDiscSubstats"
import {
  buffEffectLines,
  damageEventSummaryTitle,
  damageModeLabel,
  formatNumber,
  formatStoredStatValue,
  labelOf,
  skillCategoryLabel,
  statLabel,
  storedStatLabel,
} from "@/utils/format"
import { SKILL_CATEGORIES, activeDriveDisc4pcRuntimeInputs, isArmorerAgent, savedAnomalySourceSnapshotForAgent, useBuildStore } from "@/stores/build"
import { useAccountStore } from "@/stores/account"
import { useAppConfigStore } from "@/stores/app-config"
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
import { driveDiscUsageStateForAgent } from "@core/inventory-model.js"
import { isLuminescenceSettlement } from "@core/luminescence.js"
import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"

const catalogStore = useCatalogStore()
const accountStore = useAccountStore()
const appConfigStore = useAppConfigStore()
const inventoryStore = useInventoryStore()
const buildStore = useBuildStore()
const optimizerStore = useOptimizerStore()
const message = useMessage()
const reservationUiEnabled = computed(() => appConfigStore.driveDiscReservationsUiEnabled)
const exclusionUiEnabled = computed(() => reservationUiEnabled.value && appConfigStore.driveDiscExclusionsUiEnabled)

const showBuffPicker = ref(false)
const openingBuffPicker = ref(false)
const buffContextReady = ref(false)
const buffContextError = ref('')
const buffPickerResetNotice = ref("")
const BUFF_SECTION_STORAGE_KEY = "zzz-workbench-buff-expanded"
const buffSectionExpanded = ref(false)
function restoreBuffSectionState() {
  try {
    buffSectionExpanded.value = window.localStorage.getItem(BUFF_SECTION_STORAGE_KEY) === "true"
  } catch {
    buffSectionExpanded.value = false
  }
}
watch(buffSectionExpanded, expanded => {
  try {
    window.localStorage.setItem(BUFF_SECTION_STORAGE_KEY, String(expanded))
  } catch {
    // 隐私模式或禁用存储时保持当前会话状态即可。
  }
})
const teammateSources = ref<TeammateSources>()
let buffSession: { context: Awaited<ReturnType<typeof readTeammateSources>>, state: string, agentId: string } | null = null
let disposed = false
let optimizationRequest = 0
function invalidateOptimization() {
  optimizationRequest++
  optimizerStore.reset()
}
watch(() => [accountStore.currentOwnerId, buildStore.agentId], invalidateOptimization, { flush: "sync" })
onBeforeUnmount(() => { disposed = true; invalidateOptimization() })

function currentBuffPayload() {
  return { selectedBuffIds: buildStore.activeBuffIds(catalogStore.meta), addedBuffs: buildStore.addedBuffs,
    runtimeInputs: buildStore.runtimeInputs, buffPickerState: buildStore.buffPickerState }
}

async function commitBuffDraft(payload: any, session: NonNullable<typeof buffSession>) {
  await buildStore.saveBuffState(payload, catalogStore.meta, {
    expectedBuild: session.context.build,
    expectedLegacy: session.context.legacy,
    validate: async () => {
      const current = await readTeammateSources()
      if (disposed || buildStore.agentId !== session.agentId
        || accountStore.currentOwnerId !== session.context.sources.ownerId
        || buildStore.buffSaveFingerprint() !== session.state
        || !sameTeammateValue(current.sources, session.context.sources)) {
        throw new Error('账号、配装或导入资料已变化，草稿已保留。请核对后重新打开 Buff 配置。')
      }
    },
  })
}

async function refreshAutomaticTeammates() {
  if (showBuffPicker.value || disposed) return
  const ownerId = accountStore.currentOwnerId
  const agentId = buildStore.agentId
  await nextTick()
  if (disposed || ownerId !== accountStore.currentOwnerId || agentId !== buildStore.agentId) return
  await buildStore.persist()
  const state = buildStore.buffSaveFingerprint()
  const context = await readTeammateSources()
  if (disposed || showBuffPicker.value || ownerId !== accountStore.currentOwnerId || context.sources.ownerId !== ownerId
    || agentId !== buildStore.agentId || state !== buildStore.buffSaveFingerprint()) return
  const input = currentBuffPayload()
  if (!input.buffPickerState) {
    const candidates = teammateBuffCandidates(catalogStore.meta)
    const owners = selectedTeammateOwnerIds(candidates, input.selectedBuffIds)
    // Leave the existing explicit legacy reset flow in charge of >2 owners.
    if (!owners.size || owners.size > 2) return
    input.buffPickerState = inferBuffPickerState(candidates, input.selectedBuffIds)
  }
  const result = syncEnkaTeammates(input, context.sources, catalogStore.meta, agentId, { kind: 'refresh' }, buildStore.wEngineId)
  if (!sameTeammateValue(currentBuffPayload(), result.payload)) await commitBuffDraft(result.payload, { context, state, agentId })
}
const showCalculationConfig = ref(false)
const showAllDamageEvents = ref(false)
const showOptimizerConfig = ref(false)
const showDriveDiscAnalysis = ref(false)
const showFourPieceSetModal = ref(false)
const showTwoPieceSetModal = ref(false)
const showManualDiscPicker = ref(false)
const showSaveLoadoutModal = ref(false)
const showSchemeReservationConflict = ref(false)
const schemeReservationConflicts = ref<any[]>([])
const pendingSchemeReservation = ref<any | null>(null)
const schemeReservationBusy = ref(false)
// 套装选择弹窗打开时的草稿初始值；草稿本身由弹窗组件管理。
const fourPieceSetModalInitialIds = ref<string[]>([])
const twoPieceSetModalInitialIds = ref<string[]>([])
const activeManualDiscSlot = ref(0)
const manualDiscSetFilterIds = ref<string[]>([])
const manualDiscMainStatFilter = ref("")
const manualDiscSearch = ref("")
const loadoutNameDraft = ref("")
type SaveLoadoutDraft = {
  id: string
  ownerId: string
  mode: "manual" | "optimized"
  defaultName: string
  agentId: string
  driveDiscIdsBySlot: Record<string, string>
  source: Record<string, unknown>
  score?: unknown
}
const saveLoadoutDraft = ref<SaveLoadoutDraft | null>(null)
const saveLoadoutBusy = ref(false)
const saveLoadoutError = ref("")
const OPTIMIZED_RESULT_LIMIT = 10
const OPTIMIZER_RESULT_SLOTS = [1, 2, 3, 4, 5, 6]
const DRIVE_DISC_DISPLAY_SLOTS = [1, 6, 2, 5, 3, 4]
const SAVE_LOADOUT_WAIT_TIMEOUT_MS = 5_000
const SAVE_LOADOUT_STORAGE_TIMEOUT_MS = 15_000

let loadSequence = 0
async function loadWorkbench(initial = false) {
  const sequence = ++loadSequence
  const ownerId = accountStore.currentOwnerId
  buffContextReady.value = false
  buffContextError.value = ''
  try {
    await catalogStore.load()
    await inventoryStore.load()
    if (disposed || sequence !== loadSequence || ownerId !== accountStore.currentOwnerId) return
    if (!catalogStore.catalog || !catalogStore.meta) throw new Error('目录加载失败，请重试。')
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    if (initial) optimizerStore.initialize(catalogStore.catalog, catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId))
    else {
      optimizerStore.reset()
      optimizerStore.loadAgentSettings(catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId), catalogStore.catalog)
    }
    if (!optimizerStore.fourPieceSetIds.length) {
      optimizerStore.setFourPieceSets([catalogStore.displayDriveDiscSets[0]?.id ?? ""].filter(Boolean))
    }
    recalculate()
    restoreOptimizerResults()
    await refreshAutomaticTeammates()
    await nextTick()
    if (disposed || sequence !== loadSequence || ownerId !== accountStore.currentOwnerId) return
    await buildStore.persist()
    if (!disposed && sequence === loadSequence) buffContextReady.value = true
  } catch (error) {
    if (!disposed && sequence === loadSequence) buffContextError.value = error instanceof Error ? error.message : '队友资料加载失败，请重试。'
  }
}
onMounted(() => loadWorkbench(true))
onMounted(restoreBuffSectionState)
watch(() => accountStore.currentOwnerId, () => loadWorkbench())

// 优化结果只在内存里，刷新或切换角色后会丢失；这里从本地恢复该角色上次的结果。
// 恢复不到却仍停在“优化结果”时，回到“自选”并提示，避免显示一个空方案。
const optimizedResultsExpired = ref(false)
function restoreOptimizerResults() {
  if (!catalogStore.catalog || !inventoryStore.store || optimizerStore.isBusy) return
  const ownerId = String(inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default")
  const restored = optimizerStore.restoreSavedResults(ownerId, buildStore.agentId, inventoryStore.driveDiscs)
  if (restored || optimizerStore.resultSchemes.length) {
    optimizedResultsExpired.value = false
    return
  }
  if (buildStore.discMode === "optimized") {
    buildStore.setDiscMode("manual")
    optimizedResultsExpired.value = true
  }
}
watch(() => buildStore.agentId, (agentId, previousAgentId) => {
  // 加载时角色从空值初始化不算切换，不能清掉刚出现的“已失效”提示
  if (previousAgentId && previousAgentId !== agentId) optimizedResultsExpired.value = false
  void nextTick(restoreOptimizerResults)
})
const restoredResultsTimeText = computed(() => {
  const savedAt = optimizerStore.restoredResultsSavedAt
  const date = savedAt ? new Date(savedAt) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date)
})

const selectedAgent = computed(() => catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId))
const selectedWEngine = computed(() => catalogStore.displayWEngines.find((item: any) => item.id === buildStore.wEngineId))
const selectedSkillCatalog = computed(() => catalogStore.displayAgentSkills.find((item: any) => item.id === buildStore.agentId || item.agentId === buildStore.agentId))
const activeLuminescenceEvent = computed(() => (buildStore.damageConfig.events ?? [])
  .find((event: any) => isLuminescenceSettlement(event)) ?? null)
const luminescenceParametersValid = computed(() => activeLuminescenceEvent.value
  ? resolveLuminescenceParameters(activeLuminescenceEvent.value).valid
  : true)
const canRunOptimization = computed(() => Boolean(
  buildStore.agentId
  && buildStore.wEngineId
  && optimizerStore.fourPieceSetIds.length
  && luminescenceParametersValid.value,
))
const selectedOptimizedScheme = computed(() => optimizerStore.selectedResult(buildStore.selectedOptimizedRank))
const currentAgentLoadouts = computed(() => inventoryStore.loadoutsForAgent(buildStore.agentId))
const selectedLoadout = computed(() => currentAgentLoadouts.value
  .find((item: any) => item.id === buildStore.selectedLoadoutId))
const loadoutOptions = computed(() => [
  { label: "选择套装预设", value: "" },
  ...currentAgentLoadouts.value.map((item: any) => ({ label: item.name || item.id, value: item.id })),
])
const hasMismatchedLoadoutSelection = computed(() => buildStore.discMode === "loadout"
  && Boolean(buildStore.selectedLoadoutId)
  && !selectedLoadout.value)
const selectedDriveDiscs = computed(() => inventoryStore.calculatorDriveDiscs({
  mode: buildStore.discMode,
  idsBySlot: buildStore.manualDriveDiscIdsBySlot,
  loadoutId: selectedLoadout.value?.id ?? "",
  agentId: buildStore.agentId,
  optimizedDriveDiscs: selectedOptimizedScheme.value?.driveDiscs ?? [],
}))
const selectedDriveDiscRuntimeInputs = computed(() => {
  if (!catalogStore.catalog) {
    return {}
  }
  return activeDriveDisc4pcRuntimeInputs(catalogStore.catalog, selectedDriveDiscs.value, optimizerStore.settings)
})
const selectedBuildOptions = computed(() => ({
  runtimeInputs: selectedDriveDiscRuntimeInputs.value,
}))
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
const potentialLevelOptions = computed(() => {
  const maxLevel = Math.max(0, Math.trunc(Number(selectedAgent.value?.potentialVision?.maxLevel ?? 0)))
  return Array.from({ length: maxLevel + 1 }, (_, level) => ({
    label: level === 0 ? "P0 · 关闭 / 未激发" : `P${level}`,
    value: level,
  }))
})
const modificationOptions = computed(() => {
  const min = Number(selectedWEngine.value?.modification?.minLevel ?? 1)
  const max = Number(selectedWEngine.value?.modification?.maxLevel ?? 5)
  return Array.from({ length: Math.max(1, max - min + 1) }, (_, index) => {
    const value = min + index
    return { label: `${value} 精`, value }
  })
})
const optimizerSetChoices = computed(() => [...catalogStore.displayDriveDiscSets].sort((left: any, right: any) => labelOf(left).localeCompare(labelOf(right), "zh-CN")))
const selectedOptimizerSets = computed(() => optimizerStore.fourPieceSetIds
  .map(id => catalogStore.displayDriveDiscSets.find((set: any) => set.id === id))
  .filter(Boolean))
const selectedOptimizedFourPieceSet = computed(() => catalogStore.displayDriveDiscSets
  .find((set: any) => set.id === selectedOptimizedScheme.value?.fourPieceSetId))
const optimizedResultSetIsUserPinned = computed(() => {
  const id = selectedOptimizedScheme.value?.fourPieceSetId
  return !!id && optimizerStore.fourPieceSetIds.includes(id)
})
const selectedTwoPieceSets = computed(() => optimizerStore.twoPieceSetIds
  .map(id => catalogStore.displayDriveDiscSets.find((set: any) => set.id === id))
  .filter(Boolean))
const optimizerAlgorithmOptions = [
  { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
  { label: "启发式潜力", value: "heuristic-potential" },
  { label: "旧版精确", value: "exact-legacy" },
]
const driveDiscModeOptions = [
  { label: "自选", value: "manual" },
  { label: "已有套装", value: "loadout" },
  { label: "优化结果", value: "optimized" },
]
const minimumStats = computed(() => isArmorerAgent(selectedAgent.value)
  ? [
      { key: "def", label: "防御力" },
      { key: "critRate", label: "暴击率%" },
      { key: "critDmg", label: "暴击伤害%" },
      { key: "lacerationDmg", label: "锐暴伤害%" },
    ]
  : [
      { key: "atk", label: "攻击力" },
      { key: "anomalyProficiency", label: "异常精通" },
      { key: "critRate", label: "暴击率%" },
      { key: "critDmg", label: "暴击伤害%" },
    ])
const mainStatOptionsBySlot = computed(() => {
  const pools = catalogStore.meta?.statRules?.driveDisc?.mainStatPools ?? {}
  const fallback = ["critRate", "critDmg", "atkPct", "hpPct", "defPct", "anomalyProficiency", "anomalyMastery", "energyRegen"]
  return Object.fromEntries([4, 5, 6].map(slot => {
    const pool = pools[String(slot)] ?? fallback
    return [String(slot), pool.map((stat: string) => ({ label: statLabel(stat, catalogStore.meta), value: stat }))]
  }))
})
const topOptimizedResultSchemes = computed(() => optimizerStore.resultSchemes.slice(0, OPTIMIZED_RESULT_LIMIT))
const isLuminescenceScore = computed(() => ["luminescenceTeamScore", "luminescenceScore"]
  .includes(String(buildStore.result?.damage?.objectiveKind ?? "")))
const currentLuminescenceDamageMultiplier = computed(() => {
  const event = (buildStore.result?.damage?.events ?? [])
    .find((item: any) => item?.settlementType === "luminescence")
  if (!event) return undefined
  const value = Number(event?.luminescence?.luminescenceDamageMultiplier)
  return Number.isFinite(value) && value >= 0 ? value : undefined
})
const currentTeamAnomalyDamageMultiplier = computed(() => {
  const event = (buildStore.result?.damage?.events ?? [])
    .find((item: any) => item?.settlementType === "luminescence")
  if (!event) return undefined
  const value = Number(event?.luminescence?.teamAnomalyDamageMultiplier)
  return Number.isFinite(value) && value >= 0 ? value : undefined
})

const currentScoreSuffix = computed(() => isLuminescenceScore.value
  ? String(buildStore.result?.damage?.scoreSuffix ?? "× k")
  : "")

const selectedDriveDiscRows = computed<Array<{ slot: number, disc: any | null }>>(() => {
  const inventoryById = new Map<string, any>(
    inventoryStore.driveDiscs.map((disc: any) => [String(disc.id), disc] as [string, any]),
  )
  const bySlot = new Map<number, any>(
    selectedDriveDiscs.value.map((disc: any) => {
      const inventoryDisc = inventoryById.get(String(disc.id))
      const displayDisc = inventoryDisc
        ? {
            ...disc,
            reservedForAgentId: inventoryDisc.reservedForAgentId ?? null,
            excludedForAgentIds: inventoryDisc.excludedForAgentIds ?? [],
          }
        : disc
      return [Number(disc.partition), displayDisc] as [number, any]
    }),
  )
  return DRIVE_DISC_DISPLAY_SLOTS.map(slot => ({
    slot,
    disc: bySlot.get(slot) ?? null,
  }))
})
const selectedSchemeInventoryDiscs = computed(() => {
  const inventoryById = new Map<string, any>(inventoryStore.driveDiscs.map((disc: any) => [String(disc.id), disc]))
  return selectedDriveDiscRows.value.map(row => {
    const disc = inventoryById.get(String(row.disc?.id ?? ""))
    return disc && Number(disc.partition) === row.slot ? disc : null
  })
})
const selectedSchemeCanBeLocked = computed(() => buildStore.discMode === "optimized"
  && Boolean(buildStore.agentId)
  && accountStore.currentOwnerId === inventoryStore.store?.currentOwnerId
  && selectedSchemeInventoryDiscs.value.every(disc => Boolean(disc?.id))
  && new Set(selectedSchemeInventoryDiscs.value.map(disc => disc?.id)).size === 6)
const selectedSchemeIsLocked = computed(() => selectedSchemeCanBeLocked.value
  && selectedSchemeInventoryDiscs.value.every(disc => disc.reservedForAgentId === buildStore.agentId))
const calculationModeLabel = computed(() => {
  if (buildStore.damageConfig.mode !== "adminDefault") {
    return damageModeLabel(buildStore.damageConfig.mode)
  }
  const config = resolveDefaultCalculationConfig(
    selectedAgent.value?.defaultCalculationConfig,
    buildStore.cinemaLevel,
    buildStore.potentialLevel,
  )
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
const { page: manualDiscPage, pageSize: manualDiscPageSize, pagedItems: pagedManualDiscOptions } = useDriveDiscPagination(filteredManualDiscOptions)
const saveLoadoutIdsBySlot = computed(() => saveLoadoutDraft.value?.driveDiscIdsBySlot ?? {})
const saveLoadoutDiscCount = computed(() => Object.keys(saveLoadoutIdsBySlot.value).length)
const saveLoadoutMissingSlots = computed(() => OPTIMIZER_RESULT_SLOTS.filter(slot => !saveLoadoutIdsBySlot.value[String(slot)]))
const saveLoadoutTitle = computed(() => saveLoadoutDraft.value?.mode === "optimized" ? "保存优化结果" : "保存自选套装")
const saveLoadoutSourceLabel = computed(() => saveLoadoutDraft.value?.mode === "optimized" ? "优化结果" : "手动选择")
const canSaveCurrentScheme = computed(() => {
  if (buildStore.discMode === "manual") {
    return selectedDriveDiscs.value.length > 0
  }
  if (buildStore.discMode === "optimized") {
    return !optimizerStore.resultsAreProvisional && Boolean(selectedOptimizedScheme.value?.driveDiscs?.length)
  }
  return false
})
const activeMainStatLimitCount = computed(() => Object.values(optimizerStore.mainStatLimits ?? {})
  .reduce((total: number, values: any) => total + (Array.isArray(values) ? values.length : 0), 0))
const activeMinimumCount = computed(() => Object.values(optimizerStore.minimums ?? {})
  .filter(value => value !== null && value !== undefined).length)
const optimizerConstraintChips = computed(() => [
  optimizerStore.algorithm === "heuristic-potential"
    ? { key: "algorithm", label: "启发式搜索", type: "warning" as const }
    : null,
  optimizerStore.fourPieceBuffMode === "manual"
    ? { key: "four-piece-buff", label: "4件套 Buff：手动", type: "info" as const }
    : null,
  activeMainStatLimitCount.value
    ? { key: "main-stats", label: `主词条限制 ${activeMainStatLimitCount.value} 项`, type: "default" as const }
    : null,
  activeMinimumCount.value
    ? { key: "minimums", label: `属性下限 ${activeMinimumCount.value} 项`, type: "default" as const }
    : null,
].filter(Boolean))
watch(topOptimizedResultSchemes, schemes => {
  const values = schemes.map(scheme => Number(scheme.rank))
  if (!values.length) {
    // Result-list housekeeping must not switch the user's loadout source or
    // persist the previous character while this view is initializing.
    buildStore.selectedOptimizedRank = 0
    return
  }
  if (!values.includes(Number(buildStore.selectedOptimizedRank))) {
    buildStore.selectedOptimizedRank = values[0]!
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
// 每个类别取可选值中最接近目标的一档；“max”取最高档。
function skillLevelPresetFor(control: { options: { value: any }[] }, target: number | "max") {
  const values = control.options.map(option => Number(option.value)).filter(Number.isFinite)
  if (!values.length) return null
  if (target === "max") return Math.max(...values)
  return values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, values[0]!)
}
function skillLevelPresetActive(target: number | "max") {
  const controls = skillLevelControls.value
  return controls.length > 0 && controls.every(control => Number(control.value) === skillLevelPresetFor(control, target))
}
function applySkillLevelPreset(target: number | "max") {
  const levels: Record<string, number> = {}
  for (const control of skillLevelControls.value) {
    const level = skillLevelPresetFor(control, target)
    if (level !== null && Number(control.value) !== level) levels[control.id] = level
  }
  buildStore.updateSkillLevels(levels)
}
// 事件摘要拆成“名称 + 次数”两列显示；标题文字末尾的“×N”就是次数。默认全部收起，只显示总数。
const damageEventSummary = computed(() => (buildStore.damageConfig.events ?? []).map((event: any) => {
  const label = damageEventSummaryTitle(event, catalogStore.meta, selectedSkillCatalog.value)
  const match = /^(.*?)\s*×\s*([\d.]+)$/.exec(label)
  return {
    id: event.id,
    label,
    name: match ? match[1] : label,
    count: match ? match[2] : "",
  }
}))
const visibleDamageEventSummary = computed(() => showAllDamageEvents.value ? damageEventSummary.value : [])
const damageEventSummarySignature = computed(() => [
  buildStore.agentId,
  buildStore.damageConfig.mode,
  ...(buildStore.damageConfig.events ?? []).map((event: any) => String(event?.id ?? "")),
].join("|"))
watch(damageEventSummarySignature, () => {
  showAllDamageEvents.value = false
})
const selectedDamageEvent = computed(() => {
  const events = buildStore.damageConfig.events ?? []
  return events.find((event: any) => event.id === buildStore.damageConfig.selectedEventId) ?? events[0]
})
const currentDamageElement = computed(() => selectedDamageEvent.value?.damageElement ?? selectedAgent.value?.damageElement ?? selectedAgent.value?.attribute ?? "physical")
const fourPieceRuntimeBuffs = computed(() => {
  const buffs: any[] = []
  for (const set of selectedOptimizerSets.value) {
    const fourPiece = set?.fourPiece
    const selfBuff = fourPiece?.selfBuff ?? (Array.isArray(fourPiece?.effects) ? fourPiece : null)
    if (selfBuff?.effects?.length) {
      buffs.push({
        ...selfBuff,
        id: `driveDisc4pc:${set.id}.self`,
        name: { zhCN: `${labelOf(set)} 4 件套自身` },
        description: fourPiece.effectText,
        sourceCategory: "driveDisc",
      })
    }
    if (fourPiece?.teamBuff?.effects?.length) {
      buffs.push({
        ...fourPiece.teamBuff,
        id: `driveDisc4pc:${set.id}.team`,
        name: { zhCN: `${labelOf(set)} 4 件套团队` },
        description: fourPiece.effectText,
        sourceCategory: "driveDisc",
      })
    }
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
    potentialLevel: buildStore.potentialLevel,
    wEngineId: buildStore.wEngineId,
    wEngineModificationLevel: buildStore.wEngineModificationLevel,
    addedBuffs: buildStore.addedBuffs,
  }),
})))
const activeBuffGroups = computed(() => groupActiveBuffs(activeBuffBadges.value))
const customAddedBuffCount = computed(() => buildStore.addedBuffs
  .filter((buff: any) => buff?.sourceKind === "custom").length)
const optimizerProgress = computed(() => optimizerStore.progress ?? null)
const optimizerMetrics = computed(() => optimizerProgress.value?.metrics ?? optimizerStore.metrics ?? {})
const optimizerProgressPercent = computed(() => Math.max(0, Math.min(100, Number(optimizerProgress.value?.percent ?? 0))))
const optimizerProgressFillStyle = computed(() => ({ width: `${optimizerProgressPercent.value}%` }))
const optimizerElapsed = computed(() => formatDuration(optimizerProgress.value?.elapsedMs ?? 0))
const optimizerUiStatus = computed(() => optimizerStore.status === "done"
  ? "done"
  : String(optimizerProgress.value?.status ?? optimizerStore.status ?? "idle"))
const optimizerProgressVisible = computed(() => [
  "preparing",
  "preview",
  "running",
  "cancelling",
  "cancelled",
  "complete",
  "done",
].includes(optimizerUiStatus.value))
const optimizerProgressIndeterminate = computed(() => optimizerUiStatus.value === "preparing"
  && optimizerProgressPercent.value <= 0)
const optimizerPrepareStageLabel = computed(() => optimizerProgress.value?.status === "preparing"
  ? optimizerProgress.value?.prepareStageLabel ?? optimizerMetrics.value?.prepareStageLabel ?? ""
  : "")
const optimizerProgressPrimaryText = computed(() => optimizerProgressIndeterminate.value
  ? "准备中"
  : formatPercentValue(optimizerProgressPercent.value))
const optimizerResultAlgorithm = computed(() => optimizerProgress.value?.settings?.algorithm
  ?? optimizerStore.completedSettings?.algorithm
  ?? optimizerStore.algorithm)
const optimizerResultKindText = computed(() => optimizerResultAlgorithm.value === "heuristic-potential"
  ? "启发式结果，可能不是全局最优"
  : "精确结果")
const optimizerStatusSummary = computed(() => {
  if (optimizerUiStatus.value === "preparing") {
    return optimizerPrepareStageLabel.value || "正在准备候选数据"
  }
  if (["preview", "running"].includes(optimizerUiStatus.value)) {
    return optimizerStore.resultsAreProvisional
      ? `正在优化 · 已找到 ${optimizerStore.resultSchemes.length} 套临时方案`
      : "正在优化"
  }
  if (optimizerUiStatus.value === "cancelling") {
    return "正在取消优化"
  }
  if (optimizerUiStatus.value === "cancelled") {
    return "优化已取消"
  }
  if (["complete", "done"].includes(optimizerUiStatus.value)) {
    return `优化完成 · 找到 ${optimizerStore.resultSchemes.length} 套 · ${optimizerResultKindText.value}`
  }
  return ""
})
const optimizerGuidance = computed(() => {
  if (!["preparing", "preview", "running"].includes(optimizerUiStatus.value)) {
    return ""
  }
  const complexity = optimizerMetrics.value?.complexity
  if (!["high", "extreme"].includes(String(complexity?.level ?? ""))) {
    return ""
  }
  const settings = optimizerProgress.value?.settings ?? optimizerStore.settings
  const hasMainStatLimit = Object.values(settings.mainStatLimits ?? {})
    .some((values: any) => Array.isArray(values) && values.length > 0)
  const hasTwoPieceLimit = Array.isArray(settings.twoPieceSetIds)
    ? settings.twoPieceSetIds.length > 0
    : Boolean(settings.twoPieceSetId)
  if (!hasMainStatLimit && !hasTwoPieceLimit) {
    return "候选较多，可限定额外 2 件套或 4/5/6 号位主词条以缩短时间。"
  }
  if (!hasTwoPieceLimit) {
    return "候选仍多，可再限定额外 2 件套以缩短时间。"
  }
  if (!hasMainStatLimit) {
    return "候选仍多，可再限定 4/5/6 号位主词条以缩短时间。"
  }
  return "候选仍多，可继续收窄主词条限制。"
})

function anomalySourceSnapshotForAgent(agentId: string) {
  if (agentId === buildStore.agentId) return buildStore.lastAnomalySourceSnapshot
  return savedAnomalySourceSnapshotForAgent(agentId)
}
const optimizerInventoryStale = computed(() => optimizerStore.inventoryRestrictionsChanged(
  inventoryStore.store,
  inventoryStore.store?.currentOwnerId ?? "default",
  buildStore.agentId,
))

const optimizerCalculationStale = computed(() => {
  if (!catalogStore.catalog || !catalogStore.meta || !buildStore.agentId || !buildStore.wEngineId) {
    return false
  }
  try {
    return optimizerStore.calculationInputChanged(optimizerInput())
  } catch {
    return false
  }
})
const optimizerResultsAreStale = computed(() => optimizerStore.resultsAreStale || optimizerCalculationStale.value)
const currentDriveDiscScore = computed<number | null>(() => {
  const damage = buildStore.result?.damage ?? {}
  const value = isLuminescenceScore.value
    ? damage.score ?? damage.finalDamage ?? damage.totalFinalDamage
    : damage.totalFinalDamage ?? damage.finalDamage
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})
const optimizerReferenceScore = computed<number | null>(() => {
  const numeric = Number(topOptimizedResultSchemes.value[0]?.score)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})
const driveDiscReferenceScore = computed(() => optimizerReferenceScore.value ?? currentDriveDiscScore.value)
const showDriveDiscComparisonPercentage = computed(() => !optimizerResultsAreStale.value)
const selectedAgentImportantSubStats = computed(() => {
  const agentId = String(buildStore.agentId ?? "")
  const metaAgent = (catalogStore.meta?.agents ?? []).find((agent: any) => String(agent?.id ?? "") === agentId)
  if (Array.isArray(metaAgent?.importantSubStats)) return metaAgent.importantSubStats
  return Array.isArray(selectedAgent.value?.importantSubStats) ? selectedAgent.value.importantSubStats : []
})
const effectiveDriveDiscSubstats = computed(() => countEffectiveDriveDiscSubstats(
  selectedDriveDiscs.value,
  selectedAgentImportantSubStats.value,
  catalogStore.meta,
))

const buildSignature = computed(() => JSON.stringify({
  agentId: buildStore.agentId,
  agentLevel: buildStore.agentLevel,
  coreSkillLevel: buildStore.coreSkillLevel,
  cinemaLevel: buildStore.cinemaLevel,
  potentialLevel: buildStore.potentialLevel,
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
  driveDiscRuntimeInputs: selectedDriveDiscRuntimeInputs.value,
}))

watch(buildSignature, () => recalculate())

// 结果条的涨跌只比较同一角色、同一驱动盘方案下的参数调整；
// 切换角色、方案来源、已有套装、优化结果第几套，或优化过程中结果刷新时只重置基准。
// 自选模式下手动换盘属于参数调整，仍显示涨跌。
const summaryContextKey = computed(() => {
  const mode = buildStore.discMode
  const scheme = mode === "manual"
    ? ""
    : selectedDriveDiscs.value.map((disc: any) => disc.id).join(",")
  return `${buildStore.agentId}|${mode}|${scheme}`
})

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

function renderManualDiscSetLabel(option: any) {
  const set = option?.set ?? catalogStore.driveDiscSets.find((item: any) => item.id === option?.value)
  const label = labelOf(set) || String(option?.label ?? option?.value ?? "未知套装")
  return h("span", { class: "manual-disc-set-select-label" }, [
    h(ImageAvatar, {
      src: thumbnailForDriveDiscSet(set),
      name: label,
      size: 20,
    }),
    h("span", { class: "manual-disc-set-select-name", title: label }, label),
  ])
}

function updateManualDiscSetFilter(value: Array<string | number> | null) {
  manualDiscSetFilterIds.value = Array.isArray(value) ? value.map(String) : []
}

async function openBuffPicker() {
  if (openingBuffPicker.value || !buffContextReady.value) return
  const ownerId = accountStore.currentOwnerId
  const agentId = buildStore.agentId
  openingBuffPicker.value = true
  buffPickerResetNotice.value = ""
  try {
    const reset = await buildStore.prepareBuffPicker(catalogStore.meta)
    // Flush calculation watchers and queued writes before capturing the draft baseline.
    await nextTick()
    if (disposed || ownerId !== accountStore.currentOwnerId || agentId !== buildStore.agentId) return
    await buildStore.persist()
    const context = await readTeammateSources()
    if (ownerId !== accountStore.currentOwnerId || agentId !== buildStore.agentId) return
    if (context.sources.ownerId !== ownerId || disposed) return
    teammateSources.value = context.sources
    buffSession = { context, state: buildStore.buffSaveFingerprint(), agentId }
    buffPickerResetNotice.value = reset
      ? "旧配置包含超过两名队友，已保留自身及自身音擎 Buff，其余已重置"
      : ""
    showBuffPicker.value = true
  } catch (error) {
    message.error(error instanceof Error ? error.message : "Buff 配置保存失败，请重试。")
  } finally {
    openingBuffPicker.value = false
  }
}

async function applyBuffs(payload: any) {
  if (!buffSession) throw new Error('请重新打开 Buff 配置。')
  await commitBuffDraft(payload, buffSession)
}

function saveCalculationConfig(config: any) {
  buildStore.setDamageConfig(config, selectedAgent.value)
}

function updateLuminescenceParameters(patch: Record<string, unknown>) {
  const current = activeLuminescenceEvent.value
  if (!current || optimizerStore.isBusy) return
  const events = [...(buildStore.damageConfig.events ?? [])]
  const index = events.findIndex((event: any) => event === current
    || (event?.id === current?.id && isLuminescenceSettlement(event)))
  if (index < 0) return
  events[index] = { ...events[index], ...patch }
  buildStore.setDamageConfig({
    ...buildStore.damageConfig,
    events,
  }, selectedAgent.value)
}

function saveOptimizerConfig(config: any) {
  optimizerStore.applyAdvancedSettings(config)
}

function selectAgent(agentId: string) {
  buildStore.selectAgent(agentId, catalogStore.meta)
  void refreshAutomaticTeammates().catch(error => {
    if (!disposed) message.error(error instanceof Error ? error.message : '队友资料同步失败，请打开 Buff 配置重试。')
  })
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
  const request = ++optimizationRequest
  const requestedOwnerId = accountStore.currentOwnerId
  const requestedAgentId = buildStore.agentId
  const isCurrent = () => !disposed && request === optimizationRequest
    && requestedOwnerId === accountStore.currentOwnerId && requestedAgentId === buildStore.agentId
  try {
    await inventoryStore.load()
  } catch (error) {
    if (isCurrent()) optimizerStore.failBeforeRun(error instanceof Error ? error.message : String(error), optimizerStore.settings)
    return
  }
  if (!isCurrent()) return
  const ownerId = inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default"
  const owner = (inventoryStore.store?.owners ?? accountStore.owners ?? []).find((item: any) => item.id === ownerId)
  if (!luminescenceParametersValid.value) {
    optimizerStore.failBeforeRun(
      "请先填写有效的队友初始攻击力和耀变伤害占比。",
      optimizerStore.settings,
    )
    return
  }
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
    const ownerLabel = String(owner?.label ?? "").trim()
    optimizerStore.failBeforeRun(
      `当前账号${ownerLabel ? `「${ownerLabel}」` : ""}没有可用于优化的驱动盘。请先到驱动盘页导入，或切换到包含驱动盘的账号。`,
      inputWithSettings.settings,
    )
    return
  }
  await optimizerStore.run(catalogStore.catalog, inventoryStore.store, input)
  if (isCurrent() && optimizerStore.status === "done" && optimizerStore.resultSchemes[0]) {
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

function createLoadoutId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid
    ? `loadout-${uuid}`
    : `loadout-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
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
  const defaultName = defaultLoadoutName("manual")
  saveLoadoutDraft.value = {
    id: createLoadoutId(),
    ownerId: String(inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default"),
    mode: "manual",
    defaultName,
    agentId: String(buildStore.agentId ?? ""),
    driveDiscIdsBySlot: driveDiscIdsBySlotFromDiscs(selectedDriveDiscs.value),
    source: { type: "manual", scope: "workbench" },
  }
  loadoutNameDraft.value = defaultName
  saveLoadoutError.value = ""
  showSaveLoadoutModal.value = true
}

function openSaveOptimizedLoadout() {
  const scheme = selectedOptimizedScheme.value
  if (!scheme?.driveDiscs?.length) {
    return
  }
  const defaultName = defaultLoadoutName("optimized")
  saveLoadoutDraft.value = {
    id: createLoadoutId(),
    ownerId: String(inventoryStore.store?.currentOwnerId ?? accountStore.currentOwnerId ?? "default"),
    mode: "optimized",
    defaultName,
    agentId: String(buildStore.agentId ?? ""),
    driveDiscIdsBySlot: driveDiscIdsBySlotFromDiscs(scheme.driveDiscs),
    score: scheme.score,
    source: { type: "optimizer", rank: scheme.rank },
  }
  loadoutNameDraft.value = defaultName
  saveLoadoutError.value = ""
  showSaveLoadoutModal.value = true
}

function closeSaveLoadoutModal() {
  if (saveLoadoutBusy.value) {
    return
  }
  showSaveLoadoutModal.value = false
  saveLoadoutError.value = ""
  saveLoadoutDraft.value = null
}

function updateSaveLoadoutModalVisibility(visible: boolean) {
  if (saveLoadoutBusy.value) {
    return
  }
  if (!visible) {
    closeSaveLoadoutModal()
  }
}

function saveLoadoutFailureMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : ""
  if (code === "DRIVE_DISC_STORE_BUSY") {
    return "其他页面或旧版本页面正在写入驱动盘库存。请刷新或关闭其他 Calculator 页面后重试。"
  }
  if (code === "DRIVE_DISC_STORAGE_TIMEOUT") {
    return "浏览器数据库响应超时，本次套装未保存。请稍后重试。"
  }
  const detail = error instanceof Error ? error.message : String(error ?? "")
  return detail || "保存套装时发生未知错误，请重试。"
}

async function saveLoadoutFromModal() {
  const draft = saveLoadoutDraft.value
  if (saveLoadoutBusy.value || !draft || !Object.keys(draft.driveDiscIdsBySlot).length) {
    return
  }
  saveLoadoutBusy.value = true
  saveLoadoutError.value = ""
  let loadout: any = null
  try {
    loadout = await inventoryStore.saveLoadout({
      id: draft.id,
      name: loadoutNameDraft.value.trim() || draft.defaultName,
      agentId: draft.agentId,
      driveDiscIdsBySlot: { ...draft.driveDiscIdsBySlot },
      source: { ...draft.source },
      ...(draft.mode === "optimized" ? { score: draft.score } : {}),
    }, {
      ownerId: draft.ownerId,
      waitTimeoutMs: SAVE_LOADOUT_WAIT_TIMEOUT_MS,
      storageTimeoutMs: SAVE_LOADOUT_STORAGE_TIMEOUT_MS,
      purpose: "保存套装",
    })
  } catch (error) {
    saveLoadoutError.value = saveLoadoutFailureMessage(error)
    message.error(saveLoadoutError.value)
    return
  } finally {
    saveLoadoutBusy.value = false
  }
  const mode = draft.mode
  closeSaveLoadoutModal()
  if (mode === "optimized") {
    buildStore.selectLoadout(loadout.id)
  }
  message.success("套装已保存")
}

function schemeConflictDisc(conflict: any) {
  return inventoryStore.driveDiscs.find((disc: any) => disc.id === conflict?.discId)
}

function agentNameForId(agentId: string | null | undefined) {
  const agent = catalogStore.displayAgents.find((item: any) => item.id === agentId)
  return agent ? labelOf(agent) : `未知角色（${agentId}）`
}

async function applySchemeDiscReservation(action: any, options: any = {}) {
  if (schemeReservationBusy.value) return false
  const contextAgentId = action.contextAgentId ?? action.agentId
  if (action.ownerId && (action.ownerId !== accountStore.currentOwnerId
    || action.ownerId !== inventoryStore.store?.currentOwnerId || contextAgentId !== buildStore.agentId)) {
    showSchemeReservationConflict.value = false
    pendingSchemeReservation.value = null
    schemeReservationConflicts.value = []
    message.warning("账号或角色已切换，请重新选择方案后操作")
    return false
  }
  const discIds = action.discIds ?? [action.discId]
  schemeReservationBusy.value = true
  try {
    const result = await inventoryStore.reserveDiscs(
      discIds,
      action.agentId,
      options.allowTransfer === true,
      options.allowExclusionOverride === true,
      { ownerId: action.ownerId, expectedReservedForAgentId: action.expectedReservedForAgentId },
    )
    if (action.ownerId && (action.ownerId !== accountStore.currentOwnerId || contextAgentId !== buildStore.agentId)) {
      await inventoryStore.load()
      showSchemeReservationConflict.value = false
      schemeReservationConflicts.value = []
      pendingSchemeReservation.value = null
      return result.applied
    }
    if (!result.applied) {
      pendingSchemeReservation.value = action
      schemeReservationConflicts.value = result.conflicts ?? []
      showSchemeReservationConflict.value = true
      return false
    }
    message.success(action.agentId
      ? discIds.length > 1
        ? `已将${discIds.length}张盘锁定给${agentNameForId(action.agentId)}`
        : `已锁定给${agentNameForId(action.agentId)}`
      : discIds.length > 1 ? `已解锁${discIds.length}张盘` : "已解除角色专属")
    showSchemeReservationConflict.value = false
    schemeReservationConflicts.value = []
    pendingSchemeReservation.value = null
    return true
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
    return false
  } finally {
    schemeReservationBusy.value = false
  }
}

async function toggleSelectedSchemeReservation() {
  if (!reservationUiEnabled.value || !selectedSchemeCanBeLocked.value
    || schemeReservationBusy.value) return
  const releasing = selectedSchemeIsLocked.value
  await applySchemeDiscReservation({
    kind: "reservation",
    discIds: selectedSchemeInventoryDiscs.value.map(disc => String(disc.id)),
    agentId: releasing ? null : buildStore.agentId,
    contextAgentId: buildStore.agentId,
    expectedReservedForAgentId: releasing ? buildStore.agentId : undefined,
    ownerId: accountStore.currentOwnerId,
  })
}

async function applySchemeDiscExclusion(action: any, allowReservationRelease = false) {
  schemeReservationBusy.value = true
  try {
    const result = await inventoryStore.excludeDiscs(
      [action.discId],
      action.agentId,
      action.excluded,
      allowReservationRelease,
    )
    if (!result.applied) {
      pendingSchemeReservation.value = { ...action, kind: "exclusion" }
      schemeReservationConflicts.value = result.conflicts ?? []
      showSchemeReservationConflict.value = true
      return false
    }
    message.success(action.excluded ? "已排除，下次自动优化将跳过此盘" : "已取消排除")
    showSchemeReservationConflict.value = false
    schemeReservationConflicts.value = []
    pendingSchemeReservation.value = null
    return true
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
    return false
  } finally {
    schemeReservationBusy.value = false
  }
}

async function toggleSchemeDiscReservation(disc: any) {
  const inventoryDisc = inventoryStore.driveDiscs.find((item: any) => item.id === disc?.id)
  if (!inventoryDisc?.id || !buildStore.agentId) return
  const currentAgentId = String(inventoryDisc.reservedForAgentId ?? "").trim()
  await applySchemeDiscReservation({
    kind: "reservation",
    discId: inventoryDisc.id,
    agentId: currentAgentId === buildStore.agentId ? null : buildStore.agentId,
  })
}

async function toggleSchemeDiscExclusion(disc: any) {
  const inventoryDisc = inventoryStore.driveDiscs.find((item: any) => item.id === disc?.id)
  if (!inventoryDisc?.id || !buildStore.agentId) return
  const state = driveDiscUsageStateForAgent(inventoryDisc, buildStore.agentId).state
  if (state === "excluded-by-reservation") return
  await applySchemeDiscExclusion({
    kind: "exclusion",
    discId: inventoryDisc.id,
    agentId: buildStore.agentId,
    excluded: state !== "excluded-explicit",
  })
}

const schemeRestrictionConfirmMode = computed(() => {
  if ((pendingSchemeReservation.value?.discIds?.length ?? 0) > 1) {
    return {
      title: "整套锁定存在冲突",
      copy: "当前方案含其他角色专属盘或已主动排除的盘。确认后会转移列出的专属关系、取消当前角色对这些盘的排除，并将本方案六张盘一起锁定给当前角色。取消不会改动任何盘。",
      action: "确认锁定当前方案",
    }
  }
  const kind = schemeReservationConflicts.value[0]?.kind
  if (pendingSchemeReservation.value?.kind === "exclusion" || kind === "reserved-current") {
    return {
      title: "解除锁定并排除",
      copy: "此盘当前锁定给该角色。确认后会解除锁定并加入该角色的主动排除列表，其他角色不受影响。",
      action: "解除锁定并排除",
    }
  }
  if (kind === "excluded-current") {
    return {
      title: "取消排除并锁定",
      copy: "此盘已被该角色主动排除。确认后会取消该角色的排除记录并锁定给该角色。",
      action: "取消排除并锁定",
    }
  }
  return {
    title: "专属角色冲突",
    copy: "该驱动盘已专属其他角色。确认后只转移这一块盘，未确认前不会修改专属关系。",
    action: "转移并锁定",
  }
})

async function confirmSchemeReservationTransfer() {
  if (!pendingSchemeReservation.value) return
  if (pendingSchemeReservation.value.kind === "exclusion") {
    await applySchemeDiscExclusion(pendingSchemeReservation.value, true)
    return
  }
  const conflicts = schemeReservationConflicts.value
  await applySchemeDiscReservation(pendingSchemeReservation.value, {
    allowTransfer: conflicts.some(conflict => conflict.kind !== "excluded-current"),
    allowExclusionOverride: conflicts.some(conflict => conflict.kind === "excluded-current"),
  })
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
  return thumbnailForDriveDiscSet(driveDiscSetForDisc(disc))
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
  fourPieceSetModalInitialIds.value = optimizerStore.fourPieceSetIds.length
    ? [...optimizerStore.fourPieceSetIds]
    : [optimizerSetChoices.value[0]?.id].filter(Boolean)
  showFourPieceSetModal.value = true
}

function applyFourPieceSetModalSelection(ids: string[]) {
  optimizerStore.setFourPieceSets(ids)
  showFourPieceSetModal.value = false
}

function openTwoPieceSetModal() {
  twoPieceSetModalInitialIds.value = [...optimizerStore.twoPieceSetIds]
  showTwoPieceSetModal.value = true
}

function applyTwoPieceSetModalSelection(ids: string[]) {
  optimizerStore.setTwoPieceSetIds(ids)
  showTwoPieceSetModal.value = false
}

function removeTwoPieceSet(id: string) {
  optimizerStore.setTwoPieceSetIds(optimizerStore.twoPieceSetIds.filter(setId => setId !== id))
}

function clearTwoPieceSetLimits() {
  optimizerStore.setTwoPieceSetIds([])
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

</script>

<template>
  <section class="workbench-grid workbench-merged-grid ui-layout-scope" data-layout-surface="workbench">
    <aside class="workbench-left workbench-surface">
      <section class="workbench-section workbench-agent-section">
        <div class="panel-header workbench-section-header workbench-agent-header">
          <h1 class="panel-title">角色</h1>
          <AgentSelect
            class="workbench-entity-select"
            :value="buildStore.agentId"
            :items="catalogStore.displayAgents"
            aria-label="选择角色"
            @update:value="value => selectAgent(String(value))"
          />
        </div>
        <div class="workbench-section-body section-band">
          <div
            class="build-compact-grid build-profile-grid ui-field-grid"
            :class="{ 'build-profile-grid--potential': selectedAgent?.potentialVision }"
            data-layout-surface="agent-profile-fields"
          >
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
            <label v-if="selectedAgent?.potentialVision" class="compact-field ui-field" data-layout-field>
              <span>潜能影像</span>
              <NSelect
                :value="buildStore.potentialLevel"
                :options="potentialLevelOptions"
                size="small"
                aria-label="潜能影像"
                @update:value="buildStore.setPotentialLevel(Number($event ?? 0), catalogStore.meta)"
              />
            </label>
            <label class="compact-field compact-field-wide ui-field ui-field--full" data-layout-field>
              <span>核心技</span>
              <NSelect v-model:value="buildStore.coreSkillLevel" :options="coreSkillOptions" size="small" />
            </label>
          </div>
          <div class="skill-level-presets" role="group" aria-label="技能等级快捷设置">
            <span>技能等级</span>
            <button
              type="button"
              class="skill-level-preset"
              :class="{ active: skillLevelPresetActive(12) }"
              :aria-pressed="skillLevelPresetActive(12)"
              data-testid="skill-level-preset-12"
              @click="applySkillLevelPreset(12)"
            >全 Lv12</button>
            <button
              type="button"
              class="skill-level-preset"
              :class="{ active: skillLevelPresetActive('max') }"
              :aria-pressed="skillLevelPresetActive('max')"
              data-testid="skill-level-preset-max"
              @click="applySkillLevelPreset('max')"
            >全满级</button>
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
      </section>

      <section class="workbench-section workbench-w-engine-section">
        <div class="panel-header workbench-section-header">
          <h2 class="panel-title">音擎</h2>
        </div>
        <div class="workbench-section-body section-band">
          <WEngineSelect
            class="workbench-entity-select"
            :value="buildStore.wEngineId"
            :items="catalogStore.displayWEngines"
            :agent="selectedAgent"
            aria-label="选择音擎"
            @update:value="value => buildStore.selectWEngine(value, catalogStore.meta)"
          />
          <div class="build-compact-grid ui-field-grid" data-layout-surface="w-engine-fields">
            <label class="compact-field ui-field" data-layout-field>
              <span>等级</span>
              <NInputNumber v-model:value="buildStore.wEngineLevel" :min="0" :max="60" size="small" />
            </label>
            <label class="compact-field ui-field" data-layout-field>
              <span>精修</span>
              <NSelect v-model:value="buildStore.wEngineModificationLevel" :options="modificationOptions" size="small" />
            </label>
          </div>
        </div>
      </section>

      <section class="workbench-section workbench-buff-section">
        <div class="panel-header workbench-section-header">
          <div class="workbench-buff-title">
            <h2 class="panel-title">局内 Buff</h2>
            <!-- 已启用数量用小徽标显示，窄栏里不会被截断 -->
            <span class="workbench-count-badge" :class="{ 'is-empty': !activeBuffIdsForPanel.length }" data-testid="workbench-buff-count" :title="`已启用 ${activeBuffIdsForPanel.length} 个 Buff`">{{ activeBuffIdsForPanel.length }}</span>
            <ExpandToggle
              class="workbench-collapse-button"
              data-testid="toggle-workbench-buff"
              :expanded="buffSectionExpanded"
              aria-controls="workbench-buff-content"
              :aria-label="buffSectionExpanded ? '收起局内 Buff' : '展开局内 Buff'"
              @toggle="buffSectionExpanded = !buffSectionExpanded"
            />
          </div>
          <NButton class="prominent-config-button workbench-action-button workbench-action-button--buff" type="primary" size="small" data-testid="open-buff-picker" :loading="openingBuffPicker" :disabled="openingBuffPicker || !buffContextReady" @click="openBuffPicker">
            <template #icon><SlidersHorizontal :size="16" /></template>
            选择 Buff
          </NButton>
        </div>
        <div id="workbench-buff-content" class="workbench-section-body section-band" :hidden="!buffSectionExpanded && !buffContextError">
          <p v-if="buffContextError" role="alert">
            {{ buffContextError }}
            <NButton size="small" @click="loadWorkbench()">重新加载队友资料</NButton>
          </p>
          <!-- 按来源分组：同一位代理人的 Buff 放一组，组内只写“核心被动 / 影画一…” -->
          <div v-if="buffSectionExpanded" class="workbench-buff-groups workbench-buff-tags">
            <div v-for="group in activeBuffGroups" :key="group.key" class="workbench-buff-group">
              <span class="workbench-buff-group-title">{{ group.title }}</span>
              <div class="workbench-buff-group-items">
                <span v-for="item in group.items" :key="item.id" class="workbench-buff-chip" :title="item.title">{{ item.label }}</span>
              </div>
            </div>
            <p v-if="!activeBuffIdsForPanel.length" class="workbench-buff-empty">未启用 Buff</p>
          </div>
          <NTag v-if="buffSectionExpanded && customAddedBuffCount" type="info" size="small" round>自定义 {{ customAddedBuffCount }} 条</NTag>
        </div>
      </section>

      <section class="workbench-section workbench-calculation-section">
        <div class="panel-header workbench-section-header">
          <h2 class="panel-title">计算设置</h2>
          <NButton class="prominent-config-button workbench-action-button workbench-action-button--calculation" type="primary" size="small" data-testid="open-calculation-config" :disabled="optimizerStore.isBusy" @click="showCalculationConfig = true">
            <template #icon><CheckSquare :size="16" /></template>
            编辑事件
          </NButton>
        </div>
        <div class="workbench-section-body metric-grid calculation-summary-grid" data-layout-surface="calculation-summary">
          <dl class="metric" :class="{ 'calculation-mode-summary--luminescence': activeLuminescenceEvent }" data-layout-field>
            <dt>模式</dt>
            <dd>{{ calculationModeLabel }}</dd>
          </dl>
          <section v-if="activeLuminescenceEvent" class="metric calculation-luminescence-parameters" data-layout-field>
            <div class="calculation-luminescence-heading">
              <span>队伍评分参数</span>
              <NTag v-if="!luminescenceParametersValid" type="error" size="small" round>参数无效</NTag>
            </div>
            <LuminescenceParameterFields
              :event="activeLuminescenceEvent"
              :disabled="optimizerStore.isBusy"
              variant="compact"
              @update="updateLuminescenceParameters"
            />
          </section>
          <div v-if="activeLuminescenceEvent" id="calculation-event-summary-list" class="calculation-luminescence-summary" data-layout-field>
            <strong>事件 {{ buildStore.damageConfig.events?.length ?? 1 }} 项</strong>
            <ExpandToggle
              v-if="damageEventSummary.length"
              class="calculation-event-summary-toggle"
              data-testid="calculation-event-summary-toggle"
              :expanded="showAllDamageEvents"
              aria-controls="calculation-event-summary-list"
              label="展开"
              expanded-label="收起"
              @toggle="showAllDamageEvents = !showAllDamageEvents"
            />
            <NTag v-for="event in visibleDamageEventSummary" :key="event.id" round>{{ event.label }}</NTag>
          </div>
          <div v-if="!activeLuminescenceEvent" class="metric calculation-event-summary" data-layout-field>
            <div class="calculation-event-summary-heading">
              <span class="metric-title">事件摘要</span>
              <strong class="calculation-event-count">{{ buildStore.damageConfig.events?.length ?? 1 }} 项</strong>
              <!-- 默认全部收起；开关在这一行，展开后位置不变 -->
              <ExpandToggle
                v-if="damageEventSummary.length"
                class="calculation-event-summary-toggle"
                data-testid="calculation-event-summary-toggle"
                :expanded="showAllDamageEvents"
                aria-controls="calculation-event-summary-list"
                label="展开"
                expanded-label="收起"
                @toggle="showAllDamageEvents = !showAllDamageEvents"
              />
            </div>
            <ol v-show="showAllDamageEvents" id="calculation-event-summary-list" class="workbench-inset-list calculation-event-summary-tags">
              <li v-for="event in visibleDamageEventSummary" :key="event.id" class="workbench-inset-row calculation-event-row">
                <span class="workbench-inset-name" :title="event.label">{{ event.name }}</span>
                <span v-if="event.count" class="workbench-inset-value num">×{{ event.count }}</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <EnemyTargetConfigPanel
        class="workbench-section workbench-enemy-section"
        :target-config="buildStore.targetConfig"
        :meta="catalogStore.meta"
        :damage-element="currentDamageElement"
        @update:target-config="updateTargetConfig"
      />
    </aside>

    <main class="workbench-center workbench-surface">
      <section class="workbench-section optimizer-constraint-panel">
        <div class="panel-header workbench-section-header">
          <div>
            <h2 class="panel-title">优化约束</h2>
            <p class="panel-subtitle">外部只保留套装限制，高级项在计算配置中调整</p>
          </div>
          <div class="toolbar optimizer-config-actions">
            <NButton class="prominent-config-button workbench-action-button workbench-action-button--optimizer" type="primary" size="large" data-testid="open-optimizer-config" @click="showOptimizerConfig = true">
              <template #icon><SlidersHorizontal :size="18" /></template>
              计算配置
            </NButton>
            <NTag v-if="optimizerResultsAreStale" type="warning" round>配置已更新，需重新优化</NTag>
          </div>
        </div>
        <div class="workbench-section-body section-band">
          <div class="optimizer-set-grid ui-field-grid ui-field-grid--comfortable" data-layout-surface="optimizer-set-fields">
            <div class="metric optimizer-set-choice-field ui-field" data-layout-field>
              <dt>限定 4 件套</dt>
              <dd class="set-summary-actions">
                <NButton class="optimizer-set-select-button" size="small" @click="openFourPieceSetModal">选择</NButton>
                <div class="selected-set-summary" aria-live="polite">
                  <template v-if="selectedOptimizerSets.length">
                    <span v-for="set in selectedOptimizerSets" :key="set.id" class="selected-set-chip selected-set-chip-with-icon">
                      <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
                      <span>{{ labelOf(set) }}</span>
                    </span>
                  </template>
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
                <NButton class="optimizer-set-select-button" size="small" @click="openTwoPieceSetModal">选择</NButton>
                <div class="selected-set-summary" aria-live="polite">
                  <span v-if="!selectedTwoPieceSets.length" class="selected-set-empty">自动匹配任意 2 件套</span>
                  <template v-else>
                    <span v-for="set in selectedTwoPieceSets" :key="set.id" class="selected-set-chip selected-set-chip-with-icon">
                      <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
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
          <div v-if="optimizerConstraintChips.length" class="chip-row optimizer-constraint-chips">
            <NTag v-for="chip in optimizerConstraintChips" :key="chip?.key" :type="chip?.type" round>{{ chip?.label }}</NTag>
          </div>
          <div class="optimizer-run-row" :class="{ 'optimizer-run-row-has-progress': optimizerProgressVisible }">
            <div class="toolbar">
              <NButton v-if="!optimizerStore.isBusy" class="optimizer-action-button optimizer-action-button--start" type="primary" :disabled="!canRunOptimization" @click="runOptimization">
                <template #icon><Sparkles :size="16" /></template>
                开始优化
              </NButton>
              <NButton v-else class="optimizer-action-button optimizer-action-button--cancel" type="warning" @click="optimizerStore.cancel">取消优化</NButton>
            </div>
            <div
              v-if="optimizerProgressVisible"
              class="optimizer-progress-card"
              :data-status="optimizerUiStatus"
              role="status"
              aria-live="polite"
            >
              <div class="optimizer-progress-head">
                <strong>{{ optimizerProgressPrimaryText }}</strong>
                <span>{{ optimizerElapsed }}</span>
              </div>
              <div
                class="optimizer-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="optimizerProgressIndeterminate ? undefined : Math.round(optimizerProgressPercent)"
                :aria-valuetext="optimizerProgressIndeterminate ? optimizerStatusSummary : undefined"
                :aria-label="optimizerStatusSummary"
              >
                <div
                  class="optimizer-progress-fill"
                  :class="{ 'is-indeterminate': optimizerProgressIndeterminate }"
                  :style="optimizerProgressIndeterminate ? undefined : optimizerProgressFillStyle"
                ></div>
              </div>
              <div class="optimizer-progress-copy">
                <strong>{{ optimizerStatusSummary }}</strong>
                <p v-if="optimizerGuidance">{{ optimizerGuidance }}</p>
              </div>
            </div>
          </div>
          <NAlert v-if="optimizerStore.error" type="error" :show-icon="false" class="optimizer-error-state">
            {{ optimizerStore.error }}
          </NAlert>
        </div>
      </section>

      <section class="workbench-section drive-disc-workbench-panel">
        <div class="panel-header workbench-section-header">
          <div>
            <h2 class="panel-title">驱动盘方案</h2>
          </div>
        </div>
        <div class="workbench-section-body section-band">
          <div class="drive-disc-source-row" role="group" aria-label="驱动盘方案来源">
            <span class="drive-disc-source-label">方案来源</span>
            <WorkbenchSegmentedControl
              class="drive-disc-source-options"
              :model-value="buildStore.discMode"
              :options="driveDiscModeOptions.map(option => ({ ...option, disabled: option.value === 'optimized' && !optimizerStore.resultSchemes.length }))"
              aria-label="驱动盘方案来源"
              @update:model-value="value => buildStore.setDiscMode(value as any)"
            />
          </div>
          <div class="toolbar drive-disc-action-toolbar">
            <NButton size="small" :disabled="!canSaveCurrentScheme" @click="openSaveCurrentLoadout">
              <template #icon><Save :size="16" /></template>
              存为套装
            </NButton>
            <NButton type="primary" size="small" data-testid="open-drive-disc-analysis" :disabled="!selectedDriveDiscs.length" @click="showDriveDiscAnalysis = true">
              <template #icon><LineChart :size="16" /></template>
              词条分析
            </NButton>
          </div>

          <div class="drive-disc-analysis-strip">
            <div>
              <span>{{ selectedDriveDiscs.length ? `${selectedDriveDiscs.length} 件驱动盘参与当前${isLuminescenceScore ? "评分" : "伤害"}计算` : "选择驱动盘后可查看词条分析" }}</span>
            </div>
          </div>

          <NAlert
            v-if="optimizedResultsExpired"
            type="info"
            :show-icon="false"
            closable
            data-testid="optimizer-results-expired-notice"
            @close="optimizedResultsExpired = false"
          >
            上次的优化结果已失效（驱动盘有变化或尚未保存），已切换到“自选”。重新优化即可得到新方案。
          </NAlert>
          <p
            v-if="buildStore.discMode === 'optimized' && restoredResultsTimeText"
            class="restored-results-note"
            data-testid="optimizer-restored-results-note"
          >
            正在查看 {{ restoredResultsTimeText }} 的上次优化结果，可直接使用，也可重新优化。
          </p>

          <NAlert v-if="optimizerStore.resultsAreProvisional" type="info" :show-icon="false" data-testid="optimizer-provisional-notice">
            {{ optimizerStore.isBusy ? '搜索仍在进行' : '搜索未完成' }}，以下为当前已找到的方案，尚未确认最终最优。完整结果出来后可保存或锁定。
            <NButton v-if="buildStore.discMode !== 'optimized'" text type="primary" @click="buildStore.selectOptimizedRank(1)">
              查看当前方案
            </NButton>
          </NAlert>

          <div v-if="buildStore.discMode === 'loadout'" class="drive-disc-mode-control">
            <NSelect
              :value="selectedLoadout?.id ?? ''"
              :options="loadoutOptions"
              filterable
              @update:value="buildStore.selectLoadout(String($event ?? ''))"
            />
            <NAlert
              v-if="hasMismatchedLoadoutSelection"
              type="warning"
              :show-icon="false"
              class="loadout-agent-mismatch-alert"
            >
              当前保存的套装不属于该角色，请重新选择该角色的套装。
            </NAlert>
          </div>
          <OptimizerResultSelector
            v-else-if="buildStore.discMode === 'optimized'"
            class="drive-disc-mode-control"
            :model-value="buildStore.selectedOptimizedRank"
            :results="topOptimizedResultSchemes"
            :stale="optimizerResultsAreStale"
            :score-label="isLuminescenceScore ? '队伍异常评分' : '评分'"
            :score-suffix="currentScoreSuffix"
            :score-digits="isLuminescenceScore ? 3 : 0"
            :effective-substat-counts="effectiveDriveDiscSubstats"
            @update:model-value="buildStore.selectOptimizedRank"
          >
            <template v-if="reservationUiEnabled" #rank-actions>
              <NButton
                size="small"
                type="primary"
                secondary
                data-testid="lock-optimized-scheme"
                :loading="schemeReservationBusy"
                :disabled="optimizerStore.resultsAreProvisional || !selectedSchemeCanBeLocked || schemeReservationBusy"
                :title="selectedSchemeIsLocked ? '解除当前方案六张盘对当前角色的专属锁定' : '将当前方案六张盘锁定给当前角色'"
                @click="toggleSelectedSchemeReservation"
              >
                <template #icon><UnlockKeyhole v-if="selectedSchemeIsLocked" :size="16" /><LockKeyhole v-else :size="16" /></template>
                {{ selectedSchemeIsLocked ? '一键解锁' : '一键锁定' }}
              </NButton>
            </template>
          </OptimizerResultSelector>
          <OptimizerResultSelector
            v-else
            class="drive-disc-mode-control"
            :model-value="0"
            :results="[]"
            :current-score="currentDriveDiscScore"
            :reference-score="driveDiscReferenceScore"
            :show-rank="false"
            :show-controls="false"
            :show-percentage="showDriveDiscComparisonPercentage"
            :score-label="isLuminescenceScore ? '队伍异常评分' : '评分'"
            :score-suffix="currentScoreSuffix"
            :score-digits="isLuminescenceScore ? 3 : 0"
            :effective-substat-counts="effectiveDriveDiscSubstats"
          />
          <div v-if="buildStore.discMode === 'optimized' && selectedOptimizedFourPieceSet && !optimizedResultSetIsUserPinned" class="selected-set-summary optimized-result-set">
            <span class="selected-set-chip selected-set-chip-with-icon">
              <img :src="thumbnailForDriveDiscSet(selectedOptimizedFourPieceSet)" alt="" loading="lazy" decoding="async">
              <span>实际 4 件套：{{ labelOf(selectedOptimizedFourPieceSet) }}</span>
            </span>
          </div>
          <NAlert v-if="optimizerInventoryStale" type="warning" :show-icon="false" class="optimizer-stale-alert">
            驱动盘使用限制已更新，需重新优化。当前结果仍可查看和计算。
          </NAlert>

          <div class="drive-disc-slot-grid">
            <DriveDiscSlotCard
              v-for="row in selectedDriveDiscRows"
              :key="row.slot"
              :slot="row.slot"
              :disc="row.disc"
              :drive-disc-sets="catalogStore.displayDriveDiscSets"
              :meta="catalogStore.meta"
              :agents="catalogStore.displayAgents"
              :target-agent-id="buildStore.agentId"
              :interactive="buildStore.discMode === 'manual'"
              :show-reservation="reservationUiEnabled"
              :reservation-action="reservationUiEnabled"
              :reservation-busy="schemeReservationBusy"
              :show-exclusion="exclusionUiEnabled"
              :exclusion-action="exclusionUiEnabled"
              :exclusion-busy="schemeReservationBusy"
              stat-layout="vertical"
              @select="openManualDiscPicker"
              @toggle-reservation="toggleSchemeDiscReservation"
              @toggle-exclusion="toggleSchemeDiscExclusion"
            />
          </div>
          <div v-if="exclusionUiEnabled" class="drive-disc-restriction-hints ui-notice" aria-label="驱动盘使用限制说明">
            <div class="drive-disc-restriction-hint">
              <span class="restriction-hint-button restriction-hint-button-lock" title="锁定按钮" aria-hidden="true">
                <LockKeyhole :size="16" />
              </span>
              <span><strong>锁定：</strong>自动优化时只供当前角色使用，其他角色会自动排除。</span>
            </div>
            <div class="drive-disc-restriction-hint">
              <span class="restriction-hint-button restriction-hint-button-exclusion" title="排除按钮" aria-hidden="true">
                <Ban :size="16" />
              </span>
              <span><strong>排除：</strong>当前角色下次优化跳过此盘，不影响其他角色、手动方案或已有套装。</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <WorkbenchResultColumn
      :summary-context-key="summaryContextKey"
      :is-luminescence-score="isLuminescenceScore"
      :selected-agent="selectedAgent"
      :selected-skill-catalog="selectedSkillCatalog"
      @refresh="recalculate"
    />
  </section>

  <DriveDiscPickerModal
    v-if="reservationUiEnabled"
    v-model:show="showManualDiscPicker"
    :slot="activeManualDiscSlot"
    :discs="inventoryStore.driveDiscs"
    :selected-id="buildStore.manualDriveDiscIdsBySlot[String(activeManualDiscSlot)] ?? ''"
    :drive-disc-sets="catalogStore.displayDriveDiscSets"
    :meta="catalogStore.meta"
    :agents="catalogStore.displayAgents"
    :target-agent-id="buildStore.agentId"
    show-reservation
    :show-exclusion="exclusionUiEnabled"
    @select="selectManualDriveDisc"
    @clear="clearManualDriveDiscSlot"
  />
  <NModal v-else v-model:show="showManualDiscPicker" preset="card" :title="manualDiscPickerTitle" style="width: min(980px, calc(100vw - 16px)); max-width: 980px">
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
          v-for="disc in pagedManualDiscOptions"
          :key="disc.id"
          type="button"
          class="manual-disc-option"
          :class="{ active: buildStore.manualDriveDiscIdsBySlot[String(activeManualDiscSlot)] === disc.id }"
          @click="selectManualDriveDisc(disc)"
        >
          <img :src="driveDiscSetIcon(disc)" alt="" loading="lazy" decoding="async">
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
      <DriveDiscPagination v-model:page="manualDiscPage" :total="filteredManualDiscOptions.length" :page-size="manualDiscPageSize" />
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

  <NModal
    v-if="reservationUiEnabled"
    v-model:show="showSchemeReservationConflict"
    preset="card"
    :title="schemeRestrictionConfirmMode.title"
    style="width: min(720px, calc(100vw - 16px)); max-width: 720px"
  >
    <div class="section-band">
      <NAlert type="warning" :show-icon="false">
        {{ schemeRestrictionConfirmMode.copy }}
      </NAlert>
      <div class="scheme-reservation-conflict-list">
        <div v-for="conflict in schemeReservationConflicts" :key="`${conflict.kind ?? 'reservation'}-${conflict.discId}`" class="scheme-reservation-conflict-row">
          <div>
            <strong>{{ driveDiscSetName(schemeConflictDisc(conflict)) }} · {{ schemeConflictDisc(conflict)?.partition }}号位</strong>
            <span>{{ driveDiscStatText(schemeConflictDisc(conflict)?.mainStat) }}</span>
          </div>
          <span v-if="conflict.kind === 'excluded-current'">已被{{ agentNameForId(conflict.requestedAgentId) }}主动排除</span>
          <span v-else>{{ agentNameForId(conflict.currentAgentId) }} → {{ agentNameForId(conflict.requestedAgentId) }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton :disabled="schemeReservationBusy" @click="showSchemeReservationConflict = false">取消</NButton>
        <NButton type="primary" :loading="schemeReservationBusy" @click="confirmSchemeReservationTransfer">{{ schemeRestrictionConfirmMode.action }}</NButton>
      </div>
    </template>
  </NModal>

  <NModal
    :show="showSaveLoadoutModal"
    preset="card"
    :title="saveLoadoutTitle"
    style="width: min(640px, calc(100vw - 16px)); max-width: 640px"
    data-testid="save-loadout-modal"
    :mask-closable="!saveLoadoutBusy"
    :close-on-esc="!saveLoadoutBusy"
    :closable="!saveLoadoutBusy"
    @update:show="updateSaveLoadoutModalVisibility"
  >
    <div class="section-band ui-layout-scope" data-layout-surface="save-loadout">
      <div class="metric" data-layout-field>
        <dt>套装名称</dt>
        <dd><NInput v-model:value="loadoutNameDraft" clearable placeholder="输入套装名称" :disabled="saveLoadoutBusy" /></dd>
      </div>
      <div class="chip-row save-loadout-summary">
        <NTag round>{{ saveLoadoutSourceLabel }}</NTag>
        <NTag round>{{ saveLoadoutDiscCount }} / 6</NTag>
        <NTag :type="saveLoadoutMissingSlots.length ? 'warning' : 'success'" round>
          {{ saveLoadoutMissingSlots.length ? `缺失 ${saveLoadoutMissingSlots.join('、')} 号位` : '六槽完整' }}
        </NTag>
      </div>
    </div>
    <NAlert
      v-if="saveLoadoutError"
      class="save-loadout-error"
      type="error"
      title="套装未保存"
      data-testid="save-loadout-error"
    >
      {{ saveLoadoutError }}
    </NAlert>
    <template #footer>
      <div class="drawer-footer">
        <span class="modal-summary">保存后会更新驱动盘页中的套装预设</span>
        <span class="toolbar">
          <NButton data-testid="cancel-save-loadout" :disabled="saveLoadoutBusy" @click="closeSaveLoadoutModal">取消</NButton>
          <NButton
            type="primary"
            data-testid="confirm-save-loadout"
            :loading="saveLoadoutBusy"
            :disabled="saveLoadoutBusy || !saveLoadoutDiscCount"
            @click="saveLoadoutFromModal"
          >
            保存套装
          </NButton>
        </span>
      </div>
    </template>
  </NModal>

  <OptimizerSetChoiceModal
    v-model:show="showFourPieceSetModal"
    title="选择限定 4 件套（可多选）"
    :sets="optimizerSetChoices"
    :initial-ids="fourPieceSetModalInitialIds"
    :committed-ids="optimizerStore.fourPieceSetIds"
    require-selection
    empty-summary="至少选择一套 4 件套"
    :selected-summary="count => `已选择 ${count} 套`"
    @apply="applyFourPieceSetModalSelection"
  />

  <OptimizerSetChoiceModal
    v-model:show="showTwoPieceSetModal"
    title="选择额外 2 件套"
    :sets="optimizerSetChoices"
    :initial-ids="twoPieceSetModalInitialIds"
    :committed-ids="optimizerStore.twoPieceSetIds"
    :describe="twoPieceSetEffectText"
    empty-summary="自动匹配任意 2 件套"
    :selected-summary="count => `已选择 ${count} 个额外 2 件套`"
    @apply="applyTwoPieceSetModalSelection"
  />

  <BuffPickerModal
    v-model:show="showBuffPicker"
    :buffs="catalogStore.combatBuffs"
    :selected-ids="buildStore.activeBuffIds(catalogStore.meta)"
    :default-ids="buildStore.defaultBuffIds(catalogStore.meta)"
    :added-buffs="buildStore.addedBuffs"
    :runtime-inputs="buildStore.runtimeInputs"
    :buff-picker-state="buildStore.buffPickerState"
    :reset-notice="buffPickerResetNotice"
    :meta="catalogStore.meta"
    :drive-disc-sets="catalogStore.displayDriveDiscSets"
    :agent-id="buildStore.agentId"
    :core-skill-level="String(buildStore.coreSkillLevel)"
    :cinema-level="buildStore.cinemaLevel"
    :potential-level="buildStore.potentialLevel"
    :w-engine-id="buildStore.wEngineId"
    :w-engine-modification-level="buildStore.wEngineModificationLevel"
    :in-combat-panel="buildStore.result?.inCombat?.panel"
    :teammate-sources="teammateSources"
    :save="applyBuffs"
    :out-of-combat-panel="buildStore.result?.outOfCombat?.panel"
  />

  <CalculationConfigModal
    v-model:show="showCalculationConfig"
    :damage-config="buildStore.damageConfig"
    :skill-catalog="selectedSkillCatalog"
    :skill-levels="buildStore.skillLevels"
    :meta="catalogStore.meta"
    :agent="selectedAgent"
    :cinema-level="buildStore.cinemaLevel"
    :potential-level="buildStore.potentialLevel"
    :combat-effects="buildStore.result?.inCombat?.activeEffects ?? []"
    :release-context="{ inCombatPanel: buildStore.result?.inCombat?.panel, outOfCombatPanel: buildStore.result?.outOfCombat?.panel, outOfCombatBaseAtk: buildStore.result?.outOfCombat?.base?.atk, coreSkillLevel: buildStore.coreSkillLevel, luminescenceDamageMultiplier: currentLuminescenceDamageMultiplier, teamAnomalyDamageMultiplier: currentTeamAnomalyDamageMultiplier }"
    :source-snapshot-provider="anomalySourceSnapshotForAgent"
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
  />
</template>

<style scoped>
.workbench-merged-grid {
  /* 宽屏三栏共用同一可视高度，避免整页滚动。 */
  --app-bottom-clearance: 88px;
  --workbench-sticky-top: calc(var(--app-topbar-height) + var(--app-sticky-gap));
  --workbench-sticky-height: calc(100vh - var(--app-topbar-height) - var(--app-sticky-gap) - var(--app-bottom-clearance));
  grid-template-columns: minmax(250px, 300px) minmax(480px, 1fr) minmax(340px, 430px);
  gap: 14px;
}

@supports (height: 100dvh) {
  .workbench-merged-grid {
    --workbench-sticky-height: calc(100dvh - var(--app-topbar-height) - var(--app-sticky-gap) - var(--app-bottom-clearance));
  }
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
  gap: 8px;
}

.workbench-left .build-compact-grid,
.workbench-left .build-skill-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workbench-left .build-profile-grid,
.workbench-left .build-skill-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.workbench-left .build-profile-grid--potential {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workbench-left .build-profile-grid .compact-field-wide {
  grid-column: auto;
}

.workbench-agent-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
}

.workbench-agent-section .workbench-section-body {
  gap: 6px;
  padding-top: 4px;
}

.workbench-agent-section .build-profile-grid,
.workbench-agent-section .build-skill-grid {
  gap: 6px 8px;
}

.workbench-agent-section .compact-field {
  gap: 2px;
}

.workbench-left .compact-field {
  gap: 4px;
}

.skill-level-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 4px;
}

.skill-level-presets > span {
  flex: 1 1 auto;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
}

.skill-level-preset {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--app-border-strong);
  border-radius: 999px;
  background: var(--app-panel);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.skill-level-preset:hover {
  border-color: var(--app-blue);
  color: var(--app-blue-strong);
}

.skill-level-preset.active {
  border-color: var(--app-blue-line);
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
}

.skill-level-preset:focus-visible {
  outline: var(--app-focus-ring);
  outline-offset: 2px;
}

.workbench-left .prominent-config-button {
  min-width: 112px;
  height: 40px;
  padding: 0 12px;
  border-width: 2px;
}

.workbench-left .workbench-buff-tags {
  gap: 4px 6px;
}

.workbench-enemy-section :deep(.enemy-target-config-header) {
  padding: 10px 12px;
  border-bottom: 0;
}

.workbench-enemy-section :deep(.enemy-target-config-body) {
  padding: 8px 12px 12px;
}

.workbench-left :deep(.n-input),
.workbench-left :deep(.n-input-number),
.workbench-left :deep(.n-base-selection) {
  min-height: 32px;
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

.calculation-summary-grid > .metric {
  margin: 0;
}

/* 计算设置：左列标签、右列内容对齐，像一张小表。 */
.calculation-summary-grid {
  --calculation-summary-label-width: 60px;
  gap: 8px;
}

.calculation-summary-grid > dl.metric:not(.calculation-mode-summary--luminescence) {
  display: grid;
  grid-template-columns: var(--calculation-summary-label-width) minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
}

.calculation-summary-grid > dl.metric:not(.calculation-mode-summary--luminescence) dt {
  margin: 0;
}

.calculation-summary-grid > dl.metric:not(.calculation-mode-summary--luminescence) dd {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.calculation-event-summary {
  grid-column: 1 / -1;
}

.calculation-event-summary-heading {
  display: grid;
  grid-template-columns: var(--calculation-summary-label-width) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 28px;
}

.calculation-event-summary-tags {
  margin-top: 6px;
}

.calculation-event-summary-heading .metric-title {
  min-width: 0;
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
}

/* 展开开关靠右，与“N 项”同一行。 */
.calculation-event-summary-heading .calculation-event-summary-toggle {
  justify-self: end;
}

.calculation-event-count {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 700;
}

.calculation-mode-summary--luminescence,
.calculation-luminescence-parameters,
.calculation-luminescence-summary {
  grid-column: 1 / -1;
}

.calculation-luminescence-parameters {
  display: grid;
  gap: 10px;
}

.calculation-luminescence-heading,
.calculation-luminescence-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.calculation-luminescence-heading > span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

.calculation-luminescence-summary {
  min-height: 30px;
  padding: 2px 2px 0;
  color: var(--app-muted);
  font-size: 12px;
}

.calculation-luminescence-summary strong {
  color: var(--app-text);
  font-size: 13px;
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

.calculation-event-summary-toggle-row {
  display: flex;
  flex: 0 0 100%;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.calculation-event-summary-toggle {
  flex: 0 0 auto;
  min-height: 30px;
  max-width: 100%;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--app-blue);
  font-size: 14px;
  font-weight: 750;
  white-space: nowrap;
}

.calculation-event-summary-toggle:not(.n-button--disabled):hover {
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
}

.calculation-event-summary-toggle:not(.n-button--disabled):active {
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
}

.calculation-event-summary-toggle:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.28);
  outline-offset: 2px;
}

.calculation-event-summary-toggle :deep(.n-button__content) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.prominent-config-button {
  min-width: 116px;
  height: 40px;
  padding: 0 16px;
  border: 2px solid var(--app-blue);
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
  font-weight: 750;
  box-shadow: 0 2px 5px rgba(47, 125, 246, 0.12);
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.prominent-config-button:not(.n-button--disabled):hover {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
  box-shadow: 0 3px 8px rgba(47, 125, 246, 0.18);
  transform: translateY(-1px);
}

.prominent-config-button:not(.n-button--disabled):active {
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
  box-shadow: 0 1px 3px rgba(47, 125, 246, 0.16);
  transform: translateY(0);
}

.prominent-config-button:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.28);
  outline-offset: 2px;
}

.workbench-action-button {
  position: relative;
  overflow: hidden;
  border-radius: 9px;
  font-weight: 800;
  letter-spacing: 0.01em;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.workbench-action-button::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: linear-gradient(115deg, transparent 25%, rgba(255, 255, 255, 0.28) 50%, transparent 75%);
  opacity: 0;
  transform: translateX(-120%);
  transition: opacity 0.18s ease, transform 0.45s ease;
}

.workbench-action-button :deep(.n-button__content),
.workbench-action-button :deep(.n-button__icon) {
  position: relative;
  z-index: 1;
}

.workbench-action-button :deep(.n-button__icon) {
  margin-right: 6px;
}

.workbench-action-button--buff,
.workbench-action-button--calculation,
.workbench-action-button--optimizer {
  border-color: #1d64d8;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 5px 12px rgba(37, 99, 235, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.workbench-action-button--buff:not(.n-button--disabled):hover,
.workbench-action-button--calculation:not(.n-button--disabled):hover,
.workbench-action-button--optimizer:not(.n-button--disabled):hover {
  border-color: #174ea6;
  background: linear-gradient(135deg, #4b8df8 0%, #1d4ed8 100%);
  color: #fff;
  box-shadow: 0 7px 16px rgba(37, 99, 235, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  transform: translateY(-2px);
}

.workbench-action-button:not(.n-button--disabled):hover::after {
  opacity: 1;
  transform: translateX(120%);
}

.workbench-action-button:not(.n-button--disabled):active {
  box-shadow: 0 2px 5px rgba(47, 125, 246, 0.2), inset 0 1px 3px rgba(15, 23, 42, 0.12);
  transform: translateY(0);
}

.workbench-action-button:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.32);
  outline-offset: 3px;
}

.workbench-action-button.n-button--disabled {
  opacity: 0.56;
  box-shadow: none;
}

.optimizer-action-button {
  position: relative;
  min-width: 116px;
  height: 40px;
  padding: 0 16px;
  overflow: hidden;
  border-radius: 9px;
  border-style: solid;
  border-width: 2px;
  font-weight: 800;
  letter-spacing: 0.01em;
  transition: background-color 0.18s ease, background-image 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.optimizer-action-button::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: linear-gradient(115deg, transparent 25%, rgba(255, 255, 255, 0.28) 50%, transparent 75%);
  opacity: 0;
  transform: translateX(-120%);
  transition: opacity 0.18s ease, transform 0.45s ease;
}

.optimizer-action-button :deep(.n-button__content),
.optimizer-action-button :deep(.n-button__icon) {
  position: relative;
  z-index: 1;
}

.optimizer-action-button :deep(.n-button__icon) {
  margin-right: 6px;
}

.optimizer-action-button:not(.n-button--disabled):hover {
  transform: translateY(-2px);
}

.optimizer-action-button:not(.n-button--disabled):hover::after {
  opacity: 1;
  transform: translateX(120%);
}

.optimizer-action-button:not(.n-button--disabled):active {
  transform: translateY(0);
}

.optimizer-action-button--start {
  border-color: #066847;
  background: linear-gradient(135deg, #0f9f6e 0%, #087a55 100%);
  color: #fff;
  box-shadow: 0 5px 12px rgba(8, 122, 85, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.optimizer-action-button--start:not(.n-button--disabled):hover {
  border-color: #05573d;
  background: linear-gradient(135deg, #18b57e 0%, #066847 100%);
  color: #fff;
  box-shadow: 0 7px 16px rgba(8, 122, 85, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.optimizer-action-button--start:not(.n-button--disabled):active {
  border-color: #04452f;
  background: #05573d;
  color: #fff;
  box-shadow: 0 2px 5px rgba(8, 122, 85, 0.22), inset 0 1px 3px rgba(4, 69, 47, 0.2);
}

.optimizer-action-button--start:focus-visible {
  outline: 3px solid rgba(8, 122, 85, 0.28);
  outline-offset: 3px;
}

.optimizer-action-button--cancel:focus-visible {
  outline: 3px solid rgba(183, 121, 31, 0.3);
  outline-offset: 3px;
}

.optimizer-action-button.n-button--disabled {
  opacity: 0.56;
  filter: saturate(0.35);
  box-shadow: none;
}

.optimizer-action-button.n-button--disabled::after {
  opacity: 0;
  transform: none;
  transition: none;
}

.optimizer-action-button :deep(.n-button__border),
.optimizer-action-button :deep(.n-button__state-border),
.workbench-action-button :deep(.n-button__border),
.workbench-action-button :deep(.n-button__state-border) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .optimizer-action-button,
  .optimizer-action-button::after {
    transition: none;
  }

  .optimizer-action-button:not(.n-button--disabled):hover,
  .optimizer-action-button:not(.n-button--disabled):active {
    transform: none;
  }

  .optimizer-action-button:not(.n-button--disabled):hover::after {
    opacity: 0;
    transform: none;
  }
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
  grid-template-columns: auto;
  align-items: start;
  gap: 10px;
  min-width: 0;
}

.optimizer-run-row-has-progress {
  grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
}

.optimizer-run-row > * {
  min-width: 0;
}

.optimizer-run-row > .toolbar {
  align-content: start;
}

.optimizer-error-state {
  min-height: 0;
}

.drive-disc-source-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
  padding: 8px 10px;
  border-left: 3px solid var(--app-blue);
  background: var(--app-panel-muted);
}

.drive-disc-source-label {
  color: var(--app-muted);
  font-size: var(--font-xs);
  font-weight: 700;
}

.drive-disc-source-options {
  width: 100%;
  min-width: 0;
}

.drive-disc-action-toolbar {
  justify-content: flex-end;
}

.drive-disc-analysis-strip {
  padding: 8px 10px;
  border: 0;
  border-left: 3px solid var(--app-blue-line);
  border-radius: 0;
  background: var(--app-blue-soft);
}

.drive-disc-analysis-strip > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.drive-disc-analysis-strip span {
  color: var(--app-muted);
  font-size: 12px;
}

.drive-disc-mode-control {
  min-width: 0;
}

.loadout-agent-mismatch-alert {
  margin-top: 8px;
}

.drive-disc-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  container-type: inline-size;
  container-name: drive-disc-slots;
}

@container drive-disc-slots (max-width: 540px) {
  .drive-disc-slot-grid :deep(.disc-slot-card) {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 8px;
  }

  .drive-disc-slot-grid :deep(.disc-slot-card-meta) {
    grid-column: 1;
    grid-template-columns: auto minmax(0, 1fr);
    justify-items: start;
    gap: 6px;
    width: 100%;
    max-width: 100%;
  }

  .drive-disc-slot-grid :deep(.disc-slot-card-actions) {
    grid-column: 1 / -1;
    justify-content: start;
  }

  .drive-disc-slot-grid :deep(.disc-slot-card-meta .n-tag__content) {
    text-align: left;
  }
}

.drive-disc-restriction-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.5;
}

.drive-disc-restriction-hint {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: min(100%, 220px);
  flex: 1 1 230px;
}

.drive-disc-restriction-hints strong {
  color: var(--app-text);
}

.restriction-hint-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid;
  border-radius: 50%;
  background: var(--app-panel);
}

.restriction-hint-button-lock {
  border-color: var(--app-blue-line);
  background: var(--app-blue-soft);
  color: var(--app-blue);
}

.restriction-hint-button-exclusion {
  border-color: var(--app-red-line);
  background: var(--app-red-soft);
  color: var(--app-red-strong);
}

.optimizer-stale-alert {
  margin-top: 2px;
}

.restored-results-note {
  margin: 0;
  color: var(--app-muted);
  font-size: var(--font-xs);
  line-height: 1.5;
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
  background: var(--app-panel);
}

.disc-slot-card-empty {
  background: var(--app-panel-muted);
}

.disc-slot-card-manual {
  cursor: pointer;
}

.disc-slot-card-manual:hover {
  border-color: var(--app-blue-line);
  background: var(--app-blue-soft);
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
  background: var(--app-panel);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.manual-disc-option:hover,
.manual-disc-option.active {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
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

.save-loadout-error {
  margin-top: 12px;
}

.scheme-reservation-conflict-list {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.scheme-reservation-conflict-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, auto);
  gap: 16px;
  align-items: center;
  padding: 10px 12px;
  background: var(--app-surface);
}

.scheme-reservation-conflict-row > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.scheme-reservation-conflict-row span {
  color: var(--app-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
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

.workbench-entity-select :deep(.n-base-selection) {
  min-height: 42px;
}

.workbench-entity-select :deep(.n-base-selection-label) {
  min-height: 40px;
  align-items: center;
}

.workbench-agent-header .workbench-entity-select :deep(.n-base-selection),
.workbench-agent-header .workbench-entity-select :deep(.n-base-selection-label) {
  min-height: 38px;
}

.workbench-agent-section :deep(.n-input),
.workbench-agent-section :deep(.n-input-number),
.workbench-agent-section :deep(.n-base-selection) {
  min-height: 30px;
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

/* 边框只由 naive-ui 的覆盖层绘制：宿主若也加 border，覆盖层会被推入内侧，两层叠成双倍粗边。 */
.optimizer-set-select-button {
  min-width: 48px;
  height: 32px;
  padding: 0 10px;
  color: var(--app-text-secondary);
  background: var(--app-panel);
  font-weight: 650;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
}

.optimizer-set-select-button :deep(.n-button__border),
.optimizer-set-select-button :deep(.n-button__state-border) {
  border: 1px solid var(--app-border-strong);
}

.optimizer-set-select-button:not(.n-button--disabled):hover {
  color: var(--app-text);
  background: var(--app-panel-muted);
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);
}

.optimizer-set-select-button:not(.n-button--disabled):hover :deep(.n-button__border),
.optimizer-set-select-button:not(.n-button--disabled):hover :deep(.n-button__state-border) {
  border-color: var(--app-muted);
}

.optimizer-set-select-button:not(.n-button--disabled):active {
  background: var(--app-panel-sunken);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
}

.optimizer-set-select-button:not(.n-button--disabled):active :deep(.n-button__border),
.optimizer-set-select-button:not(.n-button--disabled):active :deep(.n-button__state-border) {
  border-color: var(--app-text-secondary);
}

.optimizer-set-select-button:focus-visible {
  outline: 3px solid rgba(71, 85, 105, 0.28);
  outline-offset: 2px;
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
  background: var(--app-panel);
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
  border: 1px solid var(--app-blue-line);
  border-radius: 999px;
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
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
  color: var(--app-blue-strong);
  cursor: pointer;
}

.selected-set-remove:hover {
  background: var(--app-blue-soft);
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
  background: var(--app-panel);
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.main-stat-choice:hover,
.main-stat-choice.active {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
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
  background: var(--app-panel);
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
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-blue-soft);
}

.optimizer-progress-card[data-status="complete"],
.optimizer-progress-card[data-status="done"] {
  border-color: var(--app-green-strong);
  background: var(--app-green-soft);
}

.optimizer-progress-card[data-status="cancelled"] {
  background: var(--app-panel-muted);
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
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-panel-sunken);
}

.optimizer-progress-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--app-blue);
  transition: width 0.18s ease;
}

.optimizer-progress-fill.is-indeterminate {
  width: 36%;
  animation: optimizer-progress-indeterminate 1.2s ease-in-out infinite;
}

@keyframes optimizer-progress-indeterminate {
  0% {
    transform: translateX(-110%);
  }

  100% {
    transform: translateX(300%);
  }
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

.optimizer-metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
}

@media (prefers-reduced-motion: reduce) {
  .optimizer-progress-fill.is-indeterminate {
    width: 100%;
    opacity: 0.45;
    animation: none;
  }
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

  .workbench-left :deep(.n-input),
  .workbench-left :deep(.n-input-number),
  .workbench-left :deep(.n-base-selection),
  .workbench-left .prominent-config-button {
    min-height: 36px;
  }

  .optimizer-run-row,
  .manual-disc-filter-row {
    grid-template-columns: 1fr;
  }

  .drive-disc-source-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .drive-disc-action-toolbar {
    justify-content: flex-start;
  }

  .drive-disc-analysis-strip {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 680px) {
  .scheme-reservation-conflict-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
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

}

</style>
