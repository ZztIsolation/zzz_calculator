import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, expect, it } from "vitest"

const viewPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "WorkbenchView.vue")
const source = readFileSync(viewPath, "utf8").replace(/\r\n/g, "\n")
const componentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../components")
const slotCardSource = readFileSync(path.join(componentDir, "DriveDiscSlotCard.vue"), "utf8")
const pickerSource = readFileSync(path.join(componentDir, "DriveDiscPickerModal.vue"), "utf8")

describe("WorkbenchView optimizer progress", () => {
  it("uses the start button as the only optimizer entrypoint", () => {
    expect(source).not.toContain("任务规模预估")
    expect(source).not.toContain("previewOptimization")
    expect(source).toContain("@click=\"runOptimization\"")
  })

  it("renders optimizer progress only after a run has started", () => {
    expect(source).toContain("optimizer-progress-card")
    expect(source).toContain('v-if="optimizerProgressVisible"')
    expect(source).toContain("const optimizerProgressVisible = computed")
    expect(source).not.toContain(':data-active="optimizerProgress ? \'true\' : \'false\'"')
  })

  it("keeps the optimizer progress summary focused on state, percent, and elapsed time", () => {
    expect(source).toContain("optimizerProgressPercent")
    expect(source).toContain("optimizerElapsed")
    expect(source).toContain("optimizerUiStatus")
    expect(source).toContain("optimizerStatusSummary")
    expect(source).toContain("optimizerProgressPrimaryText")
    expect(source).toContain("optimizerProgressIndeterminate")
    expect(source).toContain("'is-indeterminate': optimizerProgressIndeterminate")
    expect(source).toContain('role="progressbar"')
    expect(source).toContain(':aria-valuenow="optimizerProgressIndeterminate ? undefined : Math.round(optimizerProgressPercent)"')
  })

  it("labels completed results from the submitted settings snapshot", () => {
    expect(source).toContain("const optimizerResultAlgorithm = computed")
    expect(source).toContain("optimizerProgress.value?.settings?.algorithm")
    expect(source).toContain("optimizerStore.completedSettings?.algorithm")
    expect(source).toContain('optimizerResultAlgorithm.value === "heuristic-potential"')
  })

  it("shows constraint chips only for non-default choices", () => {
    expect(source).toContain('optimizerStore.algorithm === "heuristic-potential"')
    expect(source).toContain('optimizerStore.fourPieceBuffMode === "manual"')
    expect(source).toContain("activeMainStatLimitCount.value")
    expect(source).toContain("activeMinimumCount.value")
    expect(source).toContain('v-if="optimizerConstraintChips.length"')
    expect(source).not.toContain('`算法：${optimizerAlgorithmOptions.find')
    expect(source).not.toContain('`4件套 Buff：${optimizerStore.fourPieceBuffMode')
    expect(source).not.toContain('"未限定主词条"')
    expect(source).not.toContain('"未限定最小值"')
  })

  it("does not expose optimizer implementation diagnostics in the workbench", () => {
    for (const symbol of [
      "optimizerRunMeta",
      "optimizerRunNote",
      "optimizerDetailChips",
      "optimizerRate",
      "optimizerHasFreeTwoPieceMetrics",
      "optimizerSetMetricChips",
      "candidateChipTexts",
      "algorithmProgressText",
      "candidateText",
      "prunedBySuperBound",
      "scoredCombinationCount",
      "boundChecksPerSecond",
      "freeTwoPieceAutoSetCount",
      "freeFourTwoPlanCount",
      "freeFourTwoCombinationCount",
      "freeSixPiecePlanCount",
      "freeSixPieceCombinationCount",
      "candidateCountsBySlot",
    ]) {
      expect(source).not.toContain(symbol)
    }
    for (const text of [
      "内核 dense",
      "内核 map",
      "真实评分",
      "上界速度",
      "自动套装",
      "4+2 计划",
      "4+2 组合",
      "六件计划",
      "六件组合",
      "候选 1号位",
    ]) {
      expect(source).not.toContain(text)
    }
  })

  it("keeps save actions in the drive-disc scheme instead of the optimizer controls", () => {
    const optimizerSectionStart = source.indexOf('<section class="workbench-section optimizer-constraint-panel">')
    const driveDiscSectionStart = source.indexOf('<section class="workbench-section drive-disc-workbench-panel">')
    expect(optimizerSectionStart).toBeGreaterThan(-1)
    expect(driveDiscSectionStart).toBeGreaterThan(optimizerSectionStart)
    const optimizerSection = source.slice(optimizerSectionStart, driveDiscSectionStart)
    expect(optimizerSection).not.toContain("openSaveOptimizedLoadout")
    expect(optimizerSection).not.toContain("存为套装")
    expect(source).toContain('@click="openSaveCurrentLoadout"')
    expect(source).toContain("存为套装")
  })

  it("offers only single-worker browser algorithms and hides pool metrics", () => {
    expect(source).not.toContain("精确搜索（并行）")
    expect(source).not.toContain('value: "exact-super-bound-parallel"')
    expect(source).not.toContain("并行 x${optimizerMetrics.value.workerCount}")
    expect(source).not.toContain("optimizerMetrics.value?.parallelTaskCount")
  })

  it("describes an empty two-piece restriction as automatic complete-set matching", () => {
    expect(source).toContain('"自动匹配任意 2 件套"')
    expect(source).not.toContain('"未选择额外 2 件套"')
  })

  it("keeps drive disc substat analysis on the calculation workbench", () => {
    expect(source).toContain("DriveDiscAnalysisModal")
    expect(source).toContain("showDriveDiscAnalysis")
    expect(source).toContain("driveDiscAnalysisInput")
    expect(source).toContain("driveDiscAnalysisSourceLabel")
    expect(source).toContain("词条分析")
    expect(source).toContain('<NButton type="primary" size="small" data-testid="open-drive-disc-analysis"')
    expect(source).toContain('${objectiveScoreText(selectedOptimizedScheme.value.score)}')
  })

  it("uses the team anomaly score label while accepting legacy Luminescence results", () => {
    expect(source).toContain('["luminescenceTeamScore", "luminescenceScore"]')
    expect(source).toContain("队伍异常评分")
    expect(source).not.toContain("耀变评分白盒")
    expect(source).toContain("currentLuminescenceDamageMultiplier")
    expect(source).toContain("currentTeamAnomalyDamageMultiplier")
    expect(source).toContain("luminescenceDamageMultiplier: currentLuminescenceDamageMultiplier")
    expect(source).toContain("teamAnomalyDamageMultiplier: currentTeamAnomalyDamageMultiplier")
  })

  it("edits Luminescence team parameters inside the calculation summary", () => {
    expect(source).toContain('import LuminescenceParameterFields from "@/components/LuminescenceParameterFields.vue"')
    expect(source).toContain('import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"')
    expect(source).toContain("const activeLuminescenceEvent = computed")
    expect(source).toContain("resolveLuminescenceParameters(activeLuminescenceEvent.value).valid")
    expect(source).toContain('data-layout-surface="calculation-summary"')
    expect(source).toContain("队伍评分参数")
    expect(source).toContain('variant="compact"')
    expect(source).toContain('@update="updateLuminescenceParameters"')
    expect(source).toContain("事件 {{ buildStore.damageConfig.events?.length ?? 1 }} 项")
    const updater = source.slice(
      source.indexOf("function updateLuminescenceParameters"),
      source.indexOf("function saveOptimizerConfig"),
    )
    expect(updater).toContain("if (!current || optimizerStore.isBusy) return")
    expect(updater).toContain("events[index] = { ...events[index], ...patch }")
    expect(updater).toContain("buildStore.setDamageConfig({")
    expect(updater).toContain("}, selectedAgent.value)")
    expect(updater).not.toContain("buildStore.upsertDamageEvent")
  })

  it("keeps non-Luminescence summaries unchanged and locks calculation inputs while optimizing", () => {
    expect(source).toContain('v-if="!activeLuminescenceEvent" class="metric calculation-event-summary"')
    expect(source).toContain('class="calculation-event-summary-heading"')
    expect(source).toContain('class="calculation-event-count"')
    expect(source).toContain(':disabled="optimizerStore.isBusy" @click="showCalculationConfig = true"')
    expect(source).toContain(':disabled="optimizerStore.isBusy"')
    expect(source).toContain("&& luminescenceParametersValid.value")
    expect(source).toContain("请先填写有效的队友初始攻击力和耀变伤害占比。")
  })

  it("does not invent or persist a measured-reference build", () => {
    expect(source).not.toContain('"referenceAnomalyProficiency"')
    expect(source).not.toContain('"referenceLuminescenceDamageMultiplier"')
    expect(source).not.toContain("patch.referenceAnomalyProficiency")
    expect(source).not.toContain("patch.referenceLuminescenceDamageMultiplier")
  })

  it("shows every active combat buff badge instead of truncating the list", () => {
    expect(source).toContain("activeBuffIdsForPanel")
    expect(source).not.toContain(".slice(0, 8).map(id =>")
    expect(source).toContain("v-if=\"!activeBuffIdsForPanel.length\"")
  })

  it("wires teammate w-engine refinement labels while counting only true custom buffs", () => {
    expect(source).toContain("buffLabelForId(id, {")
    expect(source).toContain("addedBuffs: buildStore.addedBuffs")
    expect(source).toContain("const customAddedBuffCount = computed")
    expect(source).toContain('.filter((buff: any) => buff?.sourceKind === "custom").length')
    expect(source).toContain("自定义 {{ customAddedBuffCount }} 条")
    expect(source).not.toContain("自定义 {{ buildStore.addedBuffs.length }} 条")
  })

  it("merges damage and optimizer into one three-column workbench", () => {
    expect(source).not.toContain("<NTabs")
    expect(source).not.toContain("NTabPane")
    expect(source).toContain("workbench-merged-grid")
    expect(source).toContain("workbench-left")
    expect(source).toContain("workbench-center")
    expect(source).toContain("workbench-right")
    expect(source.match(/class="[^"]*workbench-surface/g)).toHaveLength(3)
    expect(source).toContain("workbench-section")
    expect(source).toContain("DamageWhiteBox")
    expect(source).toContain("PanelStatTable")
    expect(source).toContain("damage-panel-grid")
    expect(source).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));")
  })

  it("orders the right column as panel, damage summary, then white box", () => {
    const panelStart = source.indexOf('<section class="workbench-section damage-panel-card">')
    const summaryStart = source.indexOf('<DamageSummaryBar class="workbench-summary-section"')
    const whiteBoxStart = source.indexOf('<section class="workbench-section workbench-whitebox-section">')

    expect(panelStart).toBeGreaterThan(-1)
    expect(summaryStart).toBeGreaterThan(panelStart)
    expect(whiteBoxStart).toBeGreaterThan(summaryStart)
    expect(source).toContain(".workbench-section + .workbench-summary-section,")
  })

  it("prevents long Miyabi calculation labels from widening the left workbench column", () => {
    expect(source).toContain('class="workbench-section-body metric-grid calculation-summary-grid"')
    expect(source).toContain('class="metric calculation-event-summary"')
    expect(source).toContain('class="chip-row calculation-event-summary-tags"')
    expect(source).toContain(".workbench-left .section-band {")
    expect(source).toContain("grid-template-columns: minmax(0, 1fr);")
    expect(source).toContain(".workbench-left > *,")
    expect(source).toContain(".calculation-event-summary-tags :deep(.n-tag__content)")
    expect(source).toContain("overflow-wrap: anywhere;")
    expect(source).toContain("white-space: normal;")
  })

  it("uses compact spacing and shared label typography in the calculation summary", () => {
    expect(source).toContain(`.calculation-summary-grid > .metric {
  margin: 0;
}`)
    expect(source).toContain(`.calculation-event-summary-heading .metric-title {
  min-width: 0;
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
}`)
  })

  it("keeps extra calculation events behind an accessible inline toggle", () => {
    expect(source).toContain("const showAllDamageEvents = ref(false)")
    expect(source).toContain("const visibleDamageEventSummary = computed")
    expect(source).toContain("damageEventSummary.value.slice(0, 2)")
    expect(source).toContain("const hiddenDamageEventCount = computed")
    expect(source).toContain('data-testid="calculation-event-summary-toggle"')
    expect(source).toContain(':aria-expanded="showAllDamageEvents"')
    expect(source).toContain('aria-controls="calculation-event-summary-list"')
    expect(source).toContain('showAllDamageEvents ? "收起其余" : `其余 ${hiddenDamageEventCount} 项`')
    expect(source).toContain("<ChevronDown")
    expect(source).toContain("<ChevronUp")
    expect(source.match(/class="calculation-event-summary-toggle-row"/g)).toHaveLength(2)
    expect(source.match(/<ChevronUp v-if="showAllDamageEvents" :size="16"/g)).toHaveLength(2)
    expect(source.match(/<ChevronDown v-else :size="16"/g)).toHaveLength(2)
    expect(source).toContain(".calculation-event-summary-toggle-row {")
    expect(source).toContain("flex: 0 0 100%;")
    expect(source).toContain("font-size: 14px;")
    expect(source).toContain("watch(damageEventSummarySignature")
    expect(source).toContain(".calculation-event-summary-toggle:focus-visible")
  })

  it("passes the rupture sheer-force flag to both panel tables", () => {
    expect(source.match(/:include-sheer-force=\"selectedAgent\?\.specialty === 'rupture'\"/g)).toHaveLength(2)
  })

  it("splits event management from optimizer configuration", () => {
    expect(source).toContain("showCalculationConfig")
    expect(source).toContain("showOptimizerConfig")
    expect(source).toContain("OptimizerConfigModal")
    expect(source).toContain("showOptimizerConfig = true")
    expect(source).toContain("计算配置")
    expect(source).toContain("@save=\"saveCalculationConfig\"")
    expect(source).toContain("@save=\"saveOptimizerConfig\"")
    expect(source).not.toContain("@save-optimizer")
  })

  it("exposes the four out-of-combat panel minimum fields", () => {
    expect(source).toContain('{ key: "atk", label: "攻击力" }')
    expect(source).toContain('{ key: "anomalyProficiency", label: "异常精通" }')
    expect(source).toContain('{ key: "critRate", label: "暴击率%" }')
    expect(source).toContain('{ key: "critDmg", label: "暴击伤害%" }')
    expect(source).not.toContain('{ key: "energyRegen", label: "能量自动回复%" }')
  })

  it("makes all workbench configuration entrypoints prominent", () => {
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="small" data-testid="open-buff-picker"')
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="small" data-testid="open-calculation-config"')
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-optimizer-config"')
    expect(source.match(/class="prominent-config-button"/g)).toHaveLength(3)
    expect(source).toContain("选择 Buff")
    expect(source).toContain(".workbench-left .prominent-config-button")
    expect(source).toContain("min-width: 96px;")
    expect(source).toContain("height: 34px;")
    expect(source).toContain("border: 2px solid var(--app-blue);")
    expect(source).toContain(".prominent-config-button:focus-visible")
  })

  it("uses one rich selector for each selected agent and w-engine", () => {
    expect(source).not.toContain("selection-summary")
    expect(source).toContain("renderAgentSelectLabel")
    expect(source).toContain("renderWEngineSelectLabel")
    expect(source).toContain(':render-label="renderAgentSelectLabel"')
    expect(source).toContain(':render-label="renderWEngineSelectLabel"')
    expect(source).toContain("workbench-entity-select-icon")
    expect(source).toContain('aria-label="选择角色"')
    expect(source).toContain('aria-label="选择音擎"')
  })

  it("packs the agent selector and level controls into a denser three-column section", () => {
    expect(source).toContain("workbench-agent-header")
    expect(source).toContain(".workbench-left .build-profile-grid,")
    expect(source).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));")
    expect(source).toContain(".workbench-left .build-profile-grid .compact-field-wide")
    expect(source).toContain(".workbench-agent-section .build-skill-grid")
    expect(source).toContain("min-height: 30px;")
  })

  it("keeps workbench borders scoped to one surface per column", () => {
    expect(source).toContain(".workbench-surface {")
    expect(source).toContain(".workbench-section + .workbench-section")
    expect(source).toContain(".workbench-surface :deep(.metric:not(.layer-metric))")
    expect(source).toContain(".workbench-summary-section")
    expect(source).not.toContain('class="panel optimizer-constraint-panel"')
    expect(source).not.toContain('class="panel drive-disc-workbench-panel"')
  })

  it("passes the selected core skill level into the Buff picker", () => {
    expect(source).toContain(':core-skill-level="String(buildStore.coreSkillLevel)"')
  })

  it("shows the resolved admin default calculation name in the settings summary", () => {
    expect(source).toContain("const calculationModeLabel = computed")
    expect(source).toContain("selectedAgent.value?.defaultCalculationConfig,")
    expect(source).toContain("buildStore.potentialLevel,")
    expect(source).toContain("`默认循环（${name}）`")
    expect(source).toContain("<dd>{{ calculationModeLabel }}</dd>")
    expect(source).not.toContain("<dd>{{ damageModeLabel(buildStore.damageConfig.mode) }}</dd>")
  })

  it("shows potential controls only for agents with a potential vision and wires the level everywhere", () => {
    expect(source).toContain('v-if="selectedAgent?.potentialVision"')
    expect(source).toContain('aria-label="潜能影像"')
    expect(source).toContain('label: level === 0 ? "P0 · 关闭 / 未激发" : `P${level}`')
    expect(source).toContain("buildStore.setPotentialLevel")
    expect(source).toContain("potentialLevel: buildStore.potentialLevel")
    expect(source.match(/:potential-level="buildStore\.potentialLevel"/g)).toHaveLength(2)
    expect(source).toContain("build-profile-grid--potential")
  })

  it("loads optimizer constraints from the selected agent", () => {
    expect(source).toContain("optimizerStore.initialize(")
    expect(source).toContain("catalogStore.displayAgents.find((item: any) => item.id === buildStore.agentId)")
    expect(source).toContain("optimizerStore.loadAgentSettings")
    expect(source).not.toContain("optimizerStore.applyAgentPreferredDriveDiscSet")
    expect(source).toContain("@update:value=\"value => selectAgent(String(value))\"")
  })

  it("uses display collections for every workbench catalog picker", () => {
    expect(source).toContain("catalogStore.displayAgents.map")
    expect(source).toContain("catalogStore.displayWEngines.find")
    expect(source).toContain("[...catalogStore.displayDriveDiscSets]")
    expect(source).toContain(':drive-disc-sets="catalogStore.displayDriveDiscSets"')
    expect(source).toContain("catalogStore.displayAgentSkills.find")
  })

  it("prevents optimization when a required display collection is empty", () => {
    expect(source).toContain("const canRunOptimization = computed")
    expect(source).toContain("if (!canRunOptimization.value)")
    expect(source).toContain(':disabled="!canRunOptimization"')
    expect(source).toContain("当前没有可用于优化的可见角色、音擎或驱动盘套装")
  })

  it("applies the currently saved matching four-piece runtime to every drive-disc mode", () => {
    expect(source).toContain("selectedDriveDiscRuntimeInputs")
    expect(source).toContain("activeDriveDisc4pcRuntimeInputs")
    expect(source).toContain("optimizerStore.settings")
    expect(source).not.toContain("selectedOptimizedRuntimeInputs")
    expect(source).toContain("selectedBuildOptions.value")
    expect(source).toContain("driveDiscRuntimeInputs: selectedDriveDiscRuntimeInputs.value")
  })

  it("marks retained optimizer rankings as stale after constraints or calculation inputs change", () => {
    expect(source).toContain("optimizerStore.resultsAreStale")
    expect(source).toContain("optimizerStore.calculationInputChanged(optimizerInput())")
    expect(source).toContain("optimizerResultsAreStale")
    expect(source).toContain("配置已更新，需重新优化")
    expect(source).toContain(':stale="optimizerResultsAreStale"')
    expect(source).toContain("上次评分")
  })

  it("keeps two-piece and four-piece limits in drafts until explicitly applied", () => {
    expect(source).toContain("draftFourPieceSetIds.value = optimizerStore.fourPieceSetIds.length")
    expect(source).toContain("optimizerStore.setFourPieceSets(draftFourPieceSetIds.value)")
    expect(source).toContain("draftTwoPieceSetIds.value = [...optimizerStore.twoPieceSetIds]")
    expect(source).toContain("optimizerStore.setTwoPieceSetIds(draftTwoPieceSetIds.value)")
    expect(source).toContain('@click="showFourPieceSetModal = false">取消')
    expect(source).toContain('@click="showTwoPieceSetModal = false">取消')
  })
})

describe("WorkbenchView drive disc loadout isolation", () => {
  it("uses the current agent loadouts for options, selection, scoring, and calculation", () => {
    expect(source).toContain("inventoryStore.loadoutsForAgent(buildStore.agentId)")
    expect(source).toContain("currentAgentLoadouts.value")
    expect(source).toContain("loadoutId: selectedLoadout.value?.id ?? \"\"")
    expect(source).toContain("agentId: buildStore.agentId")
    expect(source).toContain(":value=\"selectedLoadout?.id ?? ''\"")
    expect(source).toContain("hasMismatchedLoadoutSelection")
    expect(source).toContain('buildStore.discMode === "loadout" && selectedLoadout.value?.score')
    expect(source).toContain("当前保存的套装不属于该角色，请重新选择该角色的套装。")
    expect(source).not.toContain("inventoryStore.loadouts.find((item: any) => item.id === buildStore.selectedLoadoutId)")
    expect(source).not.toContain("...inventoryStore.loadouts.map((item: any)")
  })
})

describe("WorkbenchView optimizer result details", () => {
  it("uses an immediate top-ten slider selector instead of a rank dropdown", () => {
    expect(source).toContain("OPTIMIZED_RESULT_LIMIT = 10")
    expect(source).toContain("topOptimizedResultSchemes")
    expect(source).toContain("OptimizerResultSelector")
    expect(source).toContain(':model-value="buildStore.selectedOptimizedRank"')
    expect(source).toContain('@update:model-value="buildStore.selectOptimizedRank"')
    expect(source).toContain("buildStore.selectedOptimizedRank")
    expect(source).not.toContain("optimizer-result-rank-select")
    expect(source).not.toContain("showOptimizedApplyConfirm")
    expect(source).not.toContain("applySelectedOptimizerResult")
    expect(source).not.toContain("optimizerStore.results.slice(0, 10)")
  })

  it("renders every optimizer result slot with full drive disc attributes", () => {
    expect(source).toContain("OPTIMIZER_RESULT_SLOTS = [1, 2, 3, 4, 5, 6]")
    expect(source).toContain("selectedDriveDiscRows")
    expect(source).toContain("<DriveDiscSlotCard")
    expect(source).toContain('stat-layout="vertical"')
    expect(source).toContain(':show-reservation="reservationUiEnabled"')
    expect(source).toContain(':reservation-action="reservationUiEnabled"')
    expect(source).not.toContain('<template v-if="reservationUiEnabled">')
  })

  it("hides the panel stat summary only while viewing optimizer results", () => {
    expect(source).toContain('<NTag v-if="buildStore.discMode !== \'optimized\'" round>{{ panelSummaryText }}</NTag>')
    expect(source).not.toContain('<NTag round>{{ panelSummaryText }}</NTag>')
  })

  it("labels optimized results with the four-piece set that produced them", () => {
    expect(source).toContain("selectedOptimizedScheme.value?.fourPieceSetId")
    expect(source).toContain("实际 4 件套：{{ labelOf(selectedOptimizedFourPieceSet) }}")
  })

  it("gates one-disc reservation controls without exposing batch reservation actions", () => {
    expect(source).toContain("reservationUiEnabled")
    expect(source).toContain("toggleSchemeDiscReservation")
    expect(source).toContain("applySchemeDiscReservation")
    expect(source).toContain("schemeReservationConflicts")
    expect(source).toContain('target-agent-id="buildStore.agentId"')
    expect(source).toContain("reservation-action")
    expect(source).toContain('@toggle-reservation="toggleSchemeDiscReservation"')
    expect(source).toContain("转移并锁定")
    expect(source).toContain("inventoryById.get(String(disc.id))")
    expect(slotCardSource).toContain("disc-reservation-button")
    expect(slotCardSource).toContain("toggleReservation")
    expect(pickerSource).toContain("showReservation")
    expect(source).not.toContain("保存并锁定")
    expect(source).not.toContain("转移并锁定整套")
  })

  it("gates role exclusions separately and keeps results visible when restrictions change", () => {
    expect(source).toContain("driveDiscExclusionsUiEnabled")
    expect(source).toContain("toggleSchemeDiscExclusion")
    expect(source).toContain('@toggle-exclusion="toggleSchemeDiscExclusion"')
    expect(source).toContain("解除锁定并排除")
    expect(source).toContain("取消排除并锁定")
    expect(source).toContain("驱动盘使用限制已更新，需重新优化")
    expect(source).toContain("当前结果仍可查看和计算")
    expect(source).toContain("锁定：")
    expect(source).toContain("排除：")
    expect(source).toContain("restriction-hint-button-lock")
    expect(source).toContain("restriction-hint-button-exclusion")
    expect(source).toContain("<LockKeyhole")
    expect(source).toContain("<Ban")
    expect(slotCardSource).toContain("disc-exclusion-button")
    expect(pickerSource).toContain("excluded-explicit")
  })

  it("uses a modal picker and current-scheme save for manual drive discs", () => {
    expect(source).toContain("showManualDiscPicker")
    expect(source).toContain("manual-disc-option-list")
    expect(source).toContain("manualDiscSetFilterOptions")
    expect(source).toContain("manualDiscMainStatFilterOptions")
    expect(source).toContain("manualDiscSearch")
    expect(source).toContain("clearManualDriveDiscSlot")
    expect(source).toContain("showSaveLoadoutModal")
    expect(source).toContain("openSaveCurrentLoadout")
    expect(source).toContain("source: { type: \"manual\", scope: \"workbench\" }")
    expect(source).not.toContain("disc-slot-picker")
    expect(source).not.toContain("discOptions(row.slot)")
  })

  it("freezes the loadout payload while the save modal is open", () => {
    expect(source).toContain("type SaveLoadoutDraft = {")
    expect(source).toContain("id: string")
    expect(source).toContain("ownerId: string")
    expect(source).toContain("const saveLoadoutDraft = ref<SaveLoadoutDraft | null>(null)")
    expect(source).toContain("function createLoadoutId()")
    expect(source.match(/id: createLoadoutId\(\)/g)).toHaveLength(2)
    expect(source.match(/ownerId: String\(inventoryStore\.store\?\.currentOwnerId/g)).toHaveLength(2)
    expect(source).toContain("driveDiscIdsBySlot: driveDiscIdsBySlotFromDiscs(scheme.driveDiscs)")
    expect(source).toContain("agentId: String(buildStore.agentId ?? \"\")")
    expect(source).toContain("score: scheme.score")
    expect(source).toContain("source: { type: \"optimizer\", rank: scheme.rank }")
    expect(source).toContain("id: draft.id")
    expect(source).toContain("ownerId: draft.ownerId")
    expect(source).toContain("driveDiscIdsBySlot: { ...draft.driveDiscIdsBySlot }")
    expect(source).toContain("source: { ...draft.source }")
  })

  it("keeps a pending loadout save open and blocks duplicate or dismiss actions", () => {
    expect(source).toContain("const saveLoadoutBusy = ref(false)")
    expect(source).toContain("if (saveLoadoutBusy.value || !draft")
    expect(source).toContain(':mask-closable="!saveLoadoutBusy"')
    expect(source).toContain(':close-on-esc="!saveLoadoutBusy"')
    expect(source).toContain(':closable="!saveLoadoutBusy"')
    expect(source).toContain(':disabled="saveLoadoutBusy" @click="closeSaveLoadoutModal"')
    expect(source).toContain(':loading="saveLoadoutBusy"')
    expect(source).toContain(':disabled="saveLoadoutBusy || !saveLoadoutDiscCount"')
    expect(source).toContain("saveLoadoutBusy.value = false")
  })

  it("keeps save failures visible and retryable with stable error guidance", () => {
    expect(source).toContain("const SAVE_LOADOUT_WAIT_TIMEOUT_MS = 5_000")
    expect(source).toContain("const SAVE_LOADOUT_STORAGE_TIMEOUT_MS = 15_000")
    expect(source).toContain("waitTimeoutMs: SAVE_LOADOUT_WAIT_TIMEOUT_MS")
    expect(source).toContain("storageTimeoutMs: SAVE_LOADOUT_STORAGE_TIMEOUT_MS")
    expect(source).toContain('purpose: "保存套装"')
    expect(source).toContain('code === "DRIVE_DISC_STORE_BUSY"')
    expect(source).toContain('code === "DRIVE_DISC_STORAGE_TIMEOUT"')
    expect(source).toContain('data-testid="save-loadout-error"')
    expect(source).toContain("saveLoadoutError.value = saveLoadoutFailureMessage(error)")
    expect(source).toContain("message.error(saveLoadoutError.value)")
    expect(source).toContain('message.success("套装已保存")')
  })

  it("uses an icon-rich multi-select for manual drive disc sets", () => {
    expect(source).toContain("const manualDiscSetFilterIds = ref<string[]>([])")
    expect(source).toContain("for (const disc of inventoryStore.driveDiscs)")
    expect(source).toContain(':render-label="renderManualDiscSetLabel"')
    expect(source).toContain('max-tag-count="responsive"')
    expect(source).toContain("multiple")
    expect(source).toContain('placeholder="全部套装"')
    expect(source).toContain("imageForDriveDiscSet(set)")
    expect(source).not.toContain('{ label: "全部套装", value: "" }')
  })

  it("shares set filters across slots while resetting slot-specific filters", () => {
    expect(source).toContain("!setIds.length || setIds.includes(discSetId)")
    expect(source).toContain("manualDiscSetFilterIds.value.filter(id => availableSetIds.has(id))")
    expect(source).not.toMatch(/manualDiscSetFilterIds\.value = \[\]\s+manualDiscMainStatFilter\.value = ""/)
    expect(source).toMatch(/activeManualDiscSlot\.value = Number\(slot\)\s+manualDiscMainStatFilter\.value = ""\s+manualDiscSearch\.value = ""/)
  })

  it("formats stored drive disc stats through the shared combat formatter", () => {
    expect(source).toContain("storedStatLabel")
    expect(source).toContain("formatStoredStatValue")
  })
})
