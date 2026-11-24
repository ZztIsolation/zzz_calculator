import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { useCatalogStore } from "@/stores/catalog"
import {
  useBuildStore,
  activeDriveDisc4pcRuntimeInputs,
  isArmorerAgent,
  savedAnomalySourceSnapshotForAgent,
  SKILL_CATEGORIES,
} from "@/stores/build"
import { useOptimizerStore } from "@/stores/optimizer"
import { loadUserDriveDiscStoreFresh } from "@runtime/local-store.js"
import { readBuildSelectionDocument } from "@runtime/build-storage"
import { enkaBindingForOwner, enkaImportHistoryForOwner } from "@core/enka-import/import-plan.js"
import { toCalculatorDriveDisc } from "@core/drive-disc-core.js"
import { driveDiscImportFingerprint } from "@core/drive-disc-import/transaction-plan.js"
import { isLuminescenceSettlement } from "@core/luminescence.js"
import {
  damageSkillRowsWithGeneratedTotals,
  defaultSkillLevel,
  normalizeSkillLevel,
  skillLevelLabel,
  skillLevelValues,
} from "@core/skillMultiplierCandidates.js"
import { buildCombatBuffGroups } from "@/utils/combatBuffs"
import { countEffectiveDriveDiscSubstats, importantSubStatsForAgent } from "@/utils/driveDiscSubstats"
import type { TeammateSources } from "@/utils/enkaTeammates"
import { labelOf, skillCategoryLabel, statLabel } from "@/utils/format"
import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"

export type LabChapterId = "agent" | "buffs" | "combat" | "optimizer"

export const LAB_CHAPTERS: Array<{ id: LabChapterId, code: string, title: string, subtitle: string }> = [
  { id: "agent", code: "01", title: "代理人与武装", subtitle: "角色 · 音擎 · 影画与技能" },
  { id: "buffs", code: "02", title: "队友与局内增益", subtitle: "自身 · 队友 · 套装 · 场地" },
  { id: "combat", code: "03", title: "敌人环境与事件", subtitle: "防御抗性 · 失衡 · 循环事件" },
  { id: "optimizer", code: "04", title: "优化策略与筛选", subtitle: "4/2 件套 · 主词条 · 面板门槛" },
]

export function useLabWorkbench() {
  const catalogStore = useCatalogStore()
  const buildStore = useBuildStore()
  const optimizerStore = useOptimizerStore()

  // Sandbox protection: keep all experiment tweaks in-memory so the classic
  // workbench's saved localStorage & IndexedDB state stay untouched.
  buildStore.persist = () => Promise.resolve()
  optimizerStore.persistSettings = () => {}
  optimizerStore.saveCompletedResults = () => {}

  const loading = ref(true)
  const loadError = ref("")
  const rawInventoryStore = ref<any>(null)
  const activeOwnerId = ref("default")
  const activeChapter = ref<LabChapterId>("agent")
  const isManualScrollLock = ref(false)
  let scrollLockTimer: ReturnType<typeof setTimeout> | undefined

  // Track subtle delta for the carbon HUD readout within the same context
  const baselineValue = ref<number | null>(null)
  const lastDelta = ref<{ diff: number, pct: number } | null>(null)
  let deltaTimer: ReturnType<typeof setTimeout> | undefined

  const owners = computed<any[]>(() => {
    const list = rawInventoryStore.value?.owners
    if (Array.isArray(list) && list.length) return list
    return [{ id: "default", label: "默认账号" }]
  })

  const activeOwnerLabel = computed(() => {
    const found = owners.value.find(item => item.id === activeOwnerId.value)
    return String(found?.label ?? activeOwnerId.value ?? "默认账号")
  })

  const ownerDriveDiscs = computed<any[]>(() => {
    const ownerId = activeOwnerId.value || "default"
    return (rawInventoryStore.value?.driveDiscs ?? [])
      .filter((disc: any) => String(disc?.ownerId ?? "default") === ownerId)
  })

  const ownerLoadouts = computed<any[]>(() => {
    const ownerId = activeOwnerId.value || "default"
    return (rawInventoryStore.value?.driveDiscLoadouts ?? [])
      .filter((loadout: any) => String(loadout?.ownerId ?? "default") === ownerId)
  })

  const scopedStoreForOptimizer = computed(() => {
    const base = rawInventoryStore.value ?? { version: 1, owners: owners.value, driveDiscs: [], driveDiscLoadouts: [], imports: [] }
    return {
      ...base,
      currentOwnerId: activeOwnerId.value || "default",
    }
  })

  const selectedAgent = computed(() =>
    catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId) ?? null,
  )

  const selectedWEngine = computed(() =>
    catalogStore.displayWEngines.find((item: any) => item.id === buildStore.wEngineId) ?? null,
  )

  const selectedSkillCatalog = computed(() =>
    catalogStore.displayAgentSkills.find((item: any) => item.id === buildStore.agentId || item.agentId === buildStore.agentId) ?? null,
  )

  const sortedWEngines = computed(() =>
    catalogStore.meta ? buildStore.wEnginesForAgent(catalogStore.meta) : [],
  )

  const currentAgentLoadouts = computed(() =>
    ownerLoadouts.value.filter((item: any) => String(item?.agentId ?? "") === buildStore.agentId),
  )

  const selectedOptimizedScheme = computed(() =>
    optimizerStore.selectedResult(buildStore.selectedOptimizedRank) ?? optimizerStore.resultSchemes[0] ?? null,
  )

  const selectedDriveDiscs = computed<any[]>(() => {
    const discById = new Map(ownerDriveDiscs.value.map((disc: any) => [String(disc.id), disc]))
    if (buildStore.discMode === "optimized") {
      const optimized = selectedOptimizedScheme.value?.driveDiscs ?? []
      return optimized.map((disc: any) => toCalculatorDriveDisc(disc))
    }
    if (buildStore.discMode === "loadout") {
      const loadout = currentAgentLoadouts.value.find((item: any) => item.id === buildStore.selectedLoadoutId)
      if (!loadout) return []
      const ids = Object.values(loadout.driveDiscIdsBySlot ?? {})
      return ids
        .map(id => discById.get(String(id)))
        .filter(Boolean)
        .map(disc => toCalculatorDriveDisc(disc))
    }
    // manual
    return [1, 2, 3, 4, 5, 6]
      .map(slot => discById.get(String(buildStore.manualDriveDiscIdsBySlot[String(slot)] ?? "")))
      .filter(Boolean)
      .map(disc => toCalculatorDriveDisc(disc))
  })

  const selectedDriveDiscRuntimeInputs = computed(() => {
    if (!catalogStore.catalog) return {}
    return activeDriveDisc4pcRuntimeInputs(catalogStore.catalog, selectedDriveDiscs.value, optimizerStore.settings)
  })

  const selectedBuildOptions = computed(() => ({
    runtimeInputs: selectedDriveDiscRuntimeInputs.value,
  }))

  const activeBuffIds = computed(() =>
    catalogStore.meta
      ? buildStore.activeBuffIds(catalogStore.meta, catalogStore.catalog, selectedDriveDiscs.value)
      : [],
  )

  const activeBuffIdsWithoutDriveDisc = computed(() =>
    catalogStore.meta
      ? buildStore.activeBuffIds(catalogStore.meta)
      : [],
  )

  const defaultBuffIds = computed(() =>
    catalogStore.meta
      ? buildStore.defaultBuffIds(catalogStore.meta)
      : [],
  )

  const teammateSources = computed<TeammateSources | undefined>(() => {
    const store = rawInventoryStore.value
    if (!store) return undefined
    const ownerId = activeOwnerId.value || "default"
    const build = readBuildSelectionDocument()
    const history = enkaImportHistoryForOwner(store, ownerId)
    return {
      ownerId,
      uid: String(enkaBindingForOwner(store, ownerId)?.uid ?? ""),
      history: history?.byAgent ?? {},
      configs: build?.byOwner?.[ownerId]?.byAgent ?? (ownerId === "default" ? build?.byAgent : null) ?? {},
      loadouts: ownerLoadouts.value,
      discs: ownerDriveDiscs.value,
    }
  })

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

  const optimizerAlgorithmOptions = [
    { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
    { label: "启发式潜力", value: "heuristic-potential" },
    { label: "旧版精确", value: "exact-legacy" },
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

  const mainStatOptionsBySlot = computed<Record<string, Array<{ label: string, value: string }>>>(() => {
    const pools = catalogStore.meta?.statRules?.driveDisc?.mainStatPools ?? {}
    const fallback = ["critRate", "critDmg", "atkPct", "hpPct", "defPct", "anomalyProficiency", "anomalyMastery", "energyRegen"]
    return Object.fromEntries([4, 5, 6].map(slot => {
      const pool = pools[String(slot)] ?? fallback
      return [String(slot), pool.map((stat: string) => ({ label: statLabel(stat, catalogStore.meta), value: stat }))]
    }))
  })

  const fourPieceRuntimeBuffs = computed(() => {
    const buffs: any[] = []
    for (const setId of optimizerStore.fourPieceSetIds) {
      const set = catalogStore.displayDriveDiscSets.find((item: any) => item.id === setId)
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

  function anomalySourceSnapshotForAgent(agentId: string) {
    if (agentId === buildStore.agentId) return buildStore.lastAnomalySourceSnapshot
    return savedAnomalySourceSnapshotForAgent(agentId)
  }

  function applyBuffsInstant(payload: any) {
    if (!catalogStore.meta) return
    buildStore.applyBuffState(payload, catalogStore.meta)
  }

  function saveCalculationConfigInstant(config: any) {
    buildStore.setDamageConfig(config, selectedAgent.value)
  }

  function updateTargetConfigInstant(config: any) {
    buildStore.setTargetConfig(config)
  }

  function applyOptimizerConfigInstant(config: any) {
    optimizerStore.applyAdvancedSettings(config)
  }

  const combatBuffGroups = computed(() => {
    if (!catalogStore.meta) {
      return {
        self: [], selfWEngine: [], teammate: [], teammateWEngine: [],
        teammateDriveDisc: [], field: [], boss: [], custom: [],
      }
    }
    return buildCombatBuffGroups({
      meta: catalogStore.meta,
      catalogBuffs: catalogStore.combatBuffs,
      driveDiscSets: catalogStore.displayDriveDiscSets,
      agentId: buildStore.agentId,
      coreSkillLevel: String(buildStore.coreSkillLevel),
      cinemaLevel: buildStore.cinemaLevel,
      potentialLevel: buildStore.potentialLevel,
      wEngineId: buildStore.wEngineId,
      wEngineModificationLevel: buildStore.wEngineModificationLevel,
      addedBuffs: buildStore.addedBuffs,
    })
  })

  const importantSubStats = computed(() =>
    importantSubStatsForAgent(buildStore.agentId, catalogStore.meta, catalogStore.displayAgents),
  )

  const effectiveSubstatCounts = computed(() =>
    countEffectiveDriveDiscSubstats(selectedDriveDiscs.value, importantSubStats.value, catalogStore.meta),
  )

  const skillLevelControls = computed(() => SKILL_CATEGORIES.map(categoryId => {
    const category = selectedSkillCatalog.value?.categories?.find((item: any) => item.id === categoryId)
    if (!category) {
      return {
        id: categoryId,
        label: skillCategoryLabel(categoryId),
        value: Number(buildStore.skillLevels[categoryId] ?? 12),
        options: Array.from({ length: 16 }, (_, index) => ({ label: `Lv.${index + 1}`, value: index + 1 })),
      }
    }
    const firstMove = (category.moves ?? []).find((move: any) => damageSkillRowsWithGeneratedTotals(category, move).length)
    const firstRow = firstMove ? damageSkillRowsWithGeneratedTotals(category, firstMove)[0] : null
    if (!firstMove || !firstRow) {
      return {
        id: categoryId,
        label: skillCategoryLabel(categoryId, category),
        value: Number(buildStore.skillLevels[categoryId] ?? 12),
        options: Array.from({ length: 16 }, (_, index) => ({ label: `Lv.${index + 1}`, value: index + 1 })),
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
    }
  }))

  const activeLuminescenceEvent = computed(() =>
    (buildStore.damageConfig.events ?? []).find((event: any) => isLuminescenceSettlement(event)) ?? null,
  )

  const luminescenceValid = computed(() =>
    activeLuminescenceEvent.value ? resolveLuminescenceParameters(activeLuminescenceEvent.value).valid : true,
  )

  const isLuminescenceScore = computed(() =>
    ["luminescenceTeamScore", "luminescenceScore"].includes(String(buildStore.result?.damage?.objectiveKind ?? "")),
  )

  const primaryObjectiveValue = computed<number | null>(() => {
    const dmg = buildStore.result?.damage
    if (!dmg) return null
    const raw = isLuminescenceScore.value
      ? (dmg.score ?? dmg.finalDamage ?? dmg.totalFinalDamage)
      : (dmg.totalFinalDamage ?? dmg.finalDamage)
    const num = Number(raw)
    return Number.isFinite(num) ? num : null
  })

  const selectedDamageElement = computed(() => {
    const events = buildStore.damageConfig.events ?? []
    const current = events.find((e: any) => e.id === buildStore.damageConfig.selectedEventId) ?? events[0]
    return String(current?.damageElement ?? selectedAgent.value?.damageElement ?? selectedAgent.value?.attribute ?? "physical")
  })

  const canRunOptimization = computed(() => Boolean(
    buildStore.agentId
    && buildStore.wEngineId
    && optimizerStore.fourPieceSetIds.length > 0
    && ownerDriveDiscs.value.length > 0
    && luminescenceValid.value
    && !optimizerStore.isBusy,
  ))

  const catalogFingerprint = computed(() =>
    catalogStore.meta ? driveDiscImportFingerprint(catalogStore.meta) : "",
  )

  function recalculate() {
    if (!catalogStore.catalog || !catalogStore.meta || !buildStore.agentId || !buildStore.wEngineId) return
    buildStore.calculate(catalogStore.catalog, catalogStore.meta, selectedDriveDiscs.value, selectedBuildOptions.value)
  }

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

  watch(buildSignature, () => {
    if (!loading.value) recalculate()
  })

  // Context key resets delta baseline when switching agent or disc source
  const deltaContextKey = computed(() => `${activeOwnerId.value}|${buildStore.agentId}|${buildStore.discMode}|${buildStore.selectedOptimizedRank}`)
  watch(deltaContextKey, () => {
    clearTimeout(deltaTimer)
    baselineValue.value = primaryObjectiveValue.value
    lastDelta.value = null
  })

  watch(primaryObjectiveValue, (nextVal) => {
    clearTimeout(deltaTimer)
    if (nextVal === null) {
      lastDelta.value = null
      return
    }
    if (baselineValue.value === null) {
      baselineValue.value = nextVal
      lastDelta.value = null
      return
    }
    const base = baselineValue.value
    if (Math.abs(nextVal - base) < 1e-6) return
    const diff = nextVal - base
    const pct = base > 0 ? (diff / base) * 100 : 0
    lastDelta.value = { diff, pct }
    deltaTimer = setTimeout(() => {
      baselineValue.value = nextVal
    }, 3500)
  })

  async function initialize() {
    loading.value = true
    loadError.value = ""
    try {
      await catalogStore.load()
      if (!catalogStore.catalog || !catalogStore.meta) {
        throw new Error(catalogStore.error || "目录数据加载失败，请确认后端服务（端口 8787）已启动。")
      }
      try {
        const inv = await loadUserDriveDiscStoreFresh()
        rawInventoryStore.value = inv
        activeOwnerId.value = String(inv?.currentOwnerId ?? inv?.owners?.[0]?.id ?? "default")
      } catch {
        rawInventoryStore.value = { version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "默认账号" }], driveDiscs: [], driveDiscLoadouts: [], imports: [] }
        activeOwnerId.value = "default"
      }
      buildStore.initialize(catalogStore.catalog, catalogStore.meta)
      optimizerStore.initialize(
        catalogStore.catalog,
        catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId),
      )
      optimizerStore.restoreSavedResults(
        activeOwnerId.value,
        buildStore.agentId,
        ownerDriveDiscs.value,
        catalogFingerprint.value,
      )
      if (buildStore.discMode === "optimized" && !optimizerStore.resultSchemes.length) {
        buildStore.setDiscMode("manual")
      }
      recalculate()
      baselineValue.value = primaryObjectiveValue.value
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.value = false
    }
  }

  function selectAgent(agentId: string) {
    if (!catalogStore.meta || !catalogStore.catalog) return
    optimizerStore.reset()
    buildStore.selectAgent(agentId, catalogStore.meta)
    const agent = catalogStore.displayAgents.find((item: any) => item.id === agentId)
    optimizerStore.loadAgentSettings(agent, catalogStore.catalog)
    optimizerStore.restoreSavedResults(
      activeOwnerId.value,
      agentId,
      ownerDriveDiscs.value,
      catalogFingerprint.value,
    )
    if (buildStore.discMode === "optimized" && !optimizerStore.resultSchemes.length) {
      buildStore.setDiscMode("manual")
    }
    recalculate()
  }

  function switchOwner(ownerId: string) {
    if (!ownerId || ownerId === activeOwnerId.value) return
    activeOwnerId.value = ownerId
    optimizerStore.reset()
    optimizerStore.restoreSavedResults(
      ownerId,
      buildStore.agentId,
      ownerDriveDiscs.value,
      catalogFingerprint.value,
    )
    if (buildStore.discMode === "optimized" && !optimizerStore.resultSchemes.length) {
      buildStore.setDiscMode("manual")
    }
    recalculate()
  }

  async function runOptimization() {
    if (!catalogStore.catalog || !catalogStore.meta || !canRunOptimization.value) return
    optimizerStore.setCatalogFingerprint(catalogFingerprint.value)
    const input = {
      ...buildStore.buildInput(catalogStore.catalog, catalogStore.meta, []),
      ownerId: activeOwnerId.value || "default",
    }
    await optimizerStore.run(catalogStore.catalog, scopedStoreForOptimizer.value, input)
    if (optimizerStore.status === "done" && optimizerStore.resultSchemes[0]) {
      buildStore.selectOptimizedRank(Number(optimizerStore.resultSchemes[0].rank))
      await nextTick()
      recalculate()
    }
  }

  function cancelOptimization() {
    optimizerStore.cancel()
  }

  function jumpToChapter(id: LabChapterId) {
    activeChapter.value = id
    isManualScrollLock.value = true
    clearTimeout(scrollLockTimer)
    const el = document.getElementById(`lab-chapter-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    scrollLockTimer = setTimeout(() => {
      isManualScrollLock.value = false
    }, 650)
  }

  // Chapter summaries for the left sticky step rail
  const chapterSummaries = computed<Record<LabChapterId, { primary: string, badge: string }>>(() => {
    const agentName = selectedAgent.value ? labelOf(selectedAgent.value) : "未选择角色"
    const wEngineName = selectedWEngine.value ? labelOf(selectedWEngine.value) : "未选音擎"
    const activeCount = activeBuffIds.value.length

    const preset = (catalogStore.meta?.damageTargetPresets ?? []).find(
      (item: any) => item.id === buildStore.targetConfig?.presetId,
    )
    const defenseLabel = preset ? labelOf(preset) : `防御 ${buildStore.targetConfig?.defense ?? 953}`
    const eventCount = (buildStore.damageConfig.events ?? []).length

    const fourNames = optimizerStore.fourPieceSetIds
      .map(id => {
        const set = catalogStore.displayDriveDiscSets.find((s: any) => s.id === id)
        return set ? labelOf(set) : id
      })
      .slice(0, 2)
      .join(" / ")

    const mainLimitCount = [4, 5, 6].reduce(
      (sum, slot) => sum + ((optimizerStore.mainStatLimits?.[String(slot)] ?? []).length ? 1 : 0),
      0,
    )

    return {
      agent: {
        primary: `${agentName} · ${wEngineName}`,
        badge: `M${buildStore.cinemaLevel} · 精${buildStore.wEngineModificationLevel}`,
      },
      buffs: {
        primary: activeCount ? `已启用 ${activeCount} 项局内增益` : "暂未启用额外增益",
        badge: `${activeCount} ACTIVE`,
      },
      combat: {
        primary: `${defenseLabel} · ${eventCount} 个事件`,
        badge: `失衡 ${buildStore.targetConfig?.stunMultiplierPercent ?? 150}%`,
      },
      optimizer: {
        primary: fourNames || "请选择 4 件套候选",
        badge: mainLimitCount ? `${mainLimitCount} 槽限定` : "主词条不限",
      },
    }
  })

  onBeforeUnmount(() => {
    clearTimeout(scrollLockTimer)
    clearTimeout(deltaTimer)
    if (optimizerStore.isBusy) optimizerStore.reset()
  })

  return {
    catalogStore,
    buildStore,
    optimizerStore,
    loading,
    loadError,
    owners,
    activeOwnerId,
    activeOwnerLabel,
    ownerDriveDiscs,
    currentAgentLoadouts,
    activeChapter,
    isManualScrollLock,
    selectedAgent,
    selectedWEngine,
    selectedSkillCatalog,
    sortedWEngines,
    selectedOptimizedScheme,
    selectedDriveDiscs,
    activeBuffIds,
    activeBuffIdsWithoutDriveDisc,
    defaultBuffIds,
    teammateSources,
    combatBuffGroups,
    importantSubStats,
    effectiveSubstatCounts,
    skillLevelControls,
    isLuminescenceScore,
    currentLuminescenceDamageMultiplier,
    currentTeamAnomalyDamageMultiplier,
    primaryObjectiveValue,
    lastDelta,
    selectedDamageElement,
    canRunOptimization,
    optimizerAlgorithmOptions,
    minimumStats,
    mainStatOptionsBySlot,
    fourPieceRuntimeBuffs,
    chapterSummaries,
    initialize,
    selectAgent,
    switchOwner,
    recalculate,
    runOptimization,
    cancelOptimization,
    jumpToChapter,
    anomalySourceSnapshotForAgent,
    applyBuffsInstant,
    saveCalculationConfigInstant,
    updateTargetConfigInstant,
    applyOptimizerConfigInstant,
  }
}

export type LabWorkbenchApi = ReturnType<typeof useLabWorkbench>
