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

  it("reuses completed optimized four-piece runtime for calculation and analysis", () => {
    expect(source).toContain("selectedOptimizedRuntimeInputs")
    expect(source).toContain("optimizerStore.completedSettings")
    expect(source).toContain("activeDriveDisc4pcBuffIds")
    expect(source).toContain("selectedBuildOptions.value")
  })
})

describe("WorkbenchView optimizer result details", () => {
  it("uses a top-five rank dropdown instead of compact result chips", () => {
    expect(source).toContain("OPTIMIZED_RESULT_LIMIT = 5")
    expect(source).toContain("topOptimizedResultSchemes")
    expect(source).toContain("optimizer-result-rank-select")
    expect(source).toContain("selectedOptimizerResultRank")
    expect(source).not.toContain("optimizerStore.results.slice(0, 10)")
  })

  it("renders every optimizer result slot with full drive disc attributes", () => {
    expect(source).toContain("OPTIMIZER_RESULT_SLOTS = [1, 2, 3, 4, 5, 6]")
    expect(source).toContain("selectedOptimizerResultRows")
    expect(source).toContain("optimizer-result-disc-row")
    expect(source).toContain("driveDiscSetIcon")
    expect(source).toContain("driveDiscStatText(row.disc.mainStat)")
    expect(source).toContain("driveDiscSubStatText(row.disc)")
    expect(source).toContain("driveDiscRarityLevelText(row.disc)")
    expect(source).toContain("driveDiscIdentityMeta(row.disc)")
  })

  it("formats stored drive disc stats through the shared combat formatter", () => {
    expect(source).toContain("storedStatLabel")
    expect(source).toContain("formatStoredStatValue")
    expect(source).toContain("applySelectedOptimizerResult")
  })
})
