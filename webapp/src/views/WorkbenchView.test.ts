import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, expect, it } from "vitest"

const viewPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "WorkbenchView.vue")
const source = readFileSync(viewPath, "utf8")
const componentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../components")
const slotCardSource = readFileSync(path.join(componentDir, "DriveDiscSlotCard.vue"), "utf8")
const pickerSource = readFileSync(path.join(componentDir, "DriveDiscPickerModal.vue"), "utf8")

describe("WorkbenchView optimizer progress", () => {
  it("uses the start button as the only optimizer entrypoint", () => {
    expect(source).not.toContain("任务规模预估")
    expect(source).not.toContain("previewOptimization")
    expect(source).toContain("@click=\"runOptimization\"")
  })

  it("renders the full optimizer progress summary", () => {
    expect(source).toContain("optimizer-progress-card")
    expect(source).toContain("optimizerProgressPercent")
    expect(source).toContain("optimizerRunMeta")
    expect(source).toContain("optimizerRunNote")
    expect(source).toContain("optimizerDetailChips")
    expect(source).toContain("prepareStageLabel")
    expect(source).toContain("optimizerRate")
    expect(source).toContain("optimizerElapsed")
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
    expect(source).toContain("optimizerHasFreeTwoPieceMetrics")
    expect(source).toContain("自动套装 ${formatNumber(optimizerMetrics.value.freeTwoPieceAutoSetCount")
    expect(source).toContain("4+2 计划 ${formatNumber(optimizerMetrics.value.freeFourTwoPlanCount")
    expect(source).toContain("4+2 组合 ${formatNumber(optimizerMetrics.value.freeFourTwoCombinationCount")
    expect(source).toContain("六件计划 ${formatNumber(optimizerMetrics.value.freeSixPiecePlanCount")
    expect(source).toContain("六件组合 ${formatNumber(optimizerMetrics.value.freeSixPieceCombinationCount")
  })

  it("keeps drive disc substat analysis on the calculation workbench", () => {
    expect(source).toContain("DriveDiscAnalysisModal")
    expect(source).toContain("showDriveDiscAnalysis")
    expect(source).toContain("driveDiscAnalysisInput")
    expect(source).toContain("driveDiscAnalysisSourceLabel")
    expect(source).toContain("词条分析")
    expect(source).toContain('<NButton type="primary" size="small" data-testid="open-drive-disc-analysis"')
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
    expect(source).toContain("DamageWhiteBox")
    expect(source).toContain("PanelStatTable")
    expect(source).toContain("damage-panel-grid")
    expect(source).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));")
  })

  it("prevents long Miyabi calculation labels from widening the left workbench column", () => {
    expect(source).toContain('class="panel-body metric-grid calculation-summary-grid"')
    expect(source).toContain('class="metric calculation-event-summary"')
    expect(source).toContain('class="chip-row calculation-event-summary-tags"')
    expect(source).toContain(".workbench-left .section-band {")
    expect(source).toContain("grid-template-columns: minmax(0, 1fr);")
    expect(source).toContain(".workbench-left > *,")
    expect(source).toContain(".calculation-event-summary-tags :deep(.n-tag__content)")
    expect(source).toContain("overflow-wrap: anywhere;")
    expect(source).toContain("white-space: normal;")
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
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-buff-picker"')
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-calculation-config"')
    expect(source).toContain('<NButton class="prominent-config-button" type="primary" secondary size="large" data-testid="open-optimizer-config"')
    expect(source.match(/class="prominent-config-button"/g)).toHaveLength(3)
    expect(source).toContain("选择 Buff")
    expect(source).toContain("min-width: 116px;")
    expect(source).toContain("height: 40px;")
    expect(source).toContain("border: 2px solid var(--app-blue);")
    expect(source).toContain(".prominent-config-button:focus-visible")
  })

  it("shows the resolved admin default calculation name in the settings summary", () => {
    expect(source).toContain("const calculationModeLabel = computed")
    expect(source).toContain("resolveDefaultCalculationConfig(selectedAgent.value?.defaultCalculationConfig, buildStore.cinemaLevel)")
    expect(source).toContain("`默认循环（${name}）`")
    expect(source).toContain("<dd>{{ calculationModeLabel }}</dd>")
    expect(source).not.toContain("<dd>{{ damageModeLabel(buildStore.damageConfig.mode) }}</dd>")
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

  it("reuses completed optimized four-piece runtime for calculation and analysis", () => {
    expect(source).toContain("selectedOptimizedRuntimeInputs")
    expect(source).toContain("optimizerStore.completedSettings")
    expect(source).toContain("activeDriveDisc4pcBuffIds")
    expect(source).toContain("selectedBuildOptions.value")
  })

  it("keeps two-piece and four-piece limits in drafts until explicitly applied", () => {
    expect(source).toContain("draftFourPieceSetId.value = optimizerStore.fourPieceSetId")
    expect(source).toContain("optimizerStore.setFourPieceSet(draftFourPieceSetId.value)")
    expect(source).toContain("draftTwoPieceSetIds.value = [...optimizerStore.twoPieceSetIds]")
    expect(source).toContain("optimizerStore.setTwoPieceSetIds(draftTwoPieceSetIds.value)")
    expect(source).toContain('@click="showFourPieceSetModal = false">取消')
    expect(source).toContain('@click="showTwoPieceSetModal = false">取消')
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
    expect(source).toContain("disc-slot-card")
    expect(source).toContain("driveDiscSetIcon")
    expect(source).toContain("driveDiscStatText(row.disc.mainStat)")
    expect(source).toContain("driveDiscSubStatText(row.disc)")
    expect(source).toContain("driveDiscRarityLevelText(row.disc)")
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
    expect(source).toContain("排除其他角色专属盘")
    expect(slotCardSource).toContain("disc-reservation-button")
    expect(slotCardSource).toContain("toggleReservation")
    expect(pickerSource).toContain("showReservation")
    expect(source).not.toContain("保存并锁定")
    expect(source).not.toContain("转移并锁定整套")
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
