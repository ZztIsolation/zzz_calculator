import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, expect, it } from "vitest"

const viewPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "WorkbenchView.vue")
const source = readFileSync(viewPath, "utf8")

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

  it("keeps drive disc substat analysis on the calculation workbench", () => {
    expect(source).toContain("DriveDiscAnalysisModal")
    expect(source).toContain("showDriveDiscAnalysis")
    expect(source).toContain("driveDiscAnalysisInput")
    expect(source).toContain("driveDiscAnalysisSourceLabel")
    expect(source).toContain("词条分析")
  })

  it("shows every active combat buff badge instead of truncating the list", () => {
    expect(source).toContain("activeBuffIdsForPanel")
    expect(source).not.toContain(".slice(0, 8).map(id =>")
    expect(source).toContain("v-if=\"!activeBuffIdsForPanel.length\"")
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

  it("shows the resolved admin default calculation name in the settings summary", () => {
    expect(source).toContain("const calculationModeLabel = computed")
    expect(source).toContain("resolveDefaultCalculationConfig(selectedAgent.value?.defaultCalculationConfig, buildStore.cinemaLevel)")
    expect(source).toContain("`默认循环（${name}）`")
    expect(source).toContain("<dd>{{ calculationModeLabel }}</dd>")
    expect(source).not.toContain("<dd>{{ damageModeLabel(buildStore.damageConfig.mode) }}</dd>")
  })

  it("loads optimizer constraints from the selected agent", () => {
    expect(source).toContain("optimizerStore.initialize(")
    expect(source).toContain("catalogStore.agents.find((item: any) => item.id === buildStore.agentId)")
    expect(source).toContain("optimizerStore.loadAgentSettings")
    expect(source).not.toContain("optimizerStore.applyAgentPreferredDriveDiscSet")
    expect(source).toContain("@update:value=\"value => selectAgent(String(value))\"")
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
  it("uses a top-five rank dropdown instead of compact result chips", () => {
    expect(source).toContain("OPTIMIZED_RESULT_LIMIT = 5")
    expect(source).toContain("topOptimizedResultSchemes")
    expect(source).toContain("optimizer-result-rank-select")
    expect(source).toContain("buildStore.selectedOptimizedRank")
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

  it("formats stored drive disc stats through the shared combat formatter", () => {
    expect(source).toContain("storedStatLabel")
    expect(source).toContain("formatStoredStatValue")
    expect(source).toContain("applySelectedOptimizerResult")
  })
})
