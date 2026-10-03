import { describe, expect, it } from "vitest"
import {
  isScannerStartupRecovery,
  normalizeScannerFailure,
  scannerFailureCatalogEntries,
} from "@runtime/scanner-errors"

const chinese = /[\u3400-\u9fff]/

describe("scanner error contract", () => {
  it("gives every public code a Chinese reason, remedy and recovery action", () => {
    const entries = scannerFailureCatalogEntries()
    expect(entries.length).toBeGreaterThan(40)
    expect(new Set(entries.map(entry => entry.code)).size).toBe(entries.length)
    for (const entry of entries) {
      expect(entry.code).toMatch(/^[a-z][a-z0-9_]+$/)
      expect(entry.title).toMatch(chinese)
      expect(entry.message).toMatch(chinese)
      expect(entry.remedy).toMatch(chinese)
      expect(entry.actions.length, entry.code).toBeGreaterThan(0)
    }
    expect(entries.some(entry => entry.code === "inventory_screen_unreadable")).toBe(true)
    expect(entries.find(entry => entry.code === "warehouse_context_lost")).toMatchObject({
      title: "无法确认驱动盘仓库界面",
    })
    expect(entries.map(entry => entry.code)).toEqual(expect.arrayContaining([
      "scanner_message_too_large",
      "scanner_transport_failed",
      "scan_result_stream_incomplete",
    ]))
  })

  it.each([
    [{}, { phase: "connect" as const }, "connect_failed"],
    ["Failed to fetch", { phase: "prepare" as const }, "prepare_failed"],
    [new Error("WebSocket closed"), { phase: "scan" as const }, "scan_failed"],
    [{ code: "new_future_code", message: "raw English" }, { phase: "import" as const }, "new_future_code"],
  ])("normalizes legacy or unknown failures without exposing English UI copy", (value, fallback, code) => {
    const result = normalizeScannerFailure(value, fallback)
    expect(result.code).toBe(code)
    expect(result.title).toMatch(chinese)
    expect(result.message).toMatch(chinese)
    expect(result.remedy).toMatch(chinese)
    expect(result.actions.length).toBeGreaterThan(0)
  })

  it("uses the current webpage recovery flow for old native permission errors", () => {
    const result = normalizeScannerFailure({
      code: "elevation_required",
      title: "需要管理员权限",
      message: "游戏进程权限高于当前扫描器",
      remedy: "只有本次启动会请求 UAC，重启后自动开始扫描。",
      actions: [{ kind: "retry_scan", label: "立即重试" }],
      diagnosticId: "permission-1",
      details: { processId: 123 },
    })
    expect(result.message).toContain("也可能是权限检测失败")
    expect(result.remedy).toContain("扫描设置已保留")
    expect(result.remedy).toContain("再点击开始扫描")
    expect(result.actions[0]).toEqual({ kind: "restart_elevated", label: "以管理员权限重启" })
    expect(result.diagnosticId).toBe("permission-1")
    expect(result.details).toEqual({ processId: 123 })
  })

  it("keeps cancellation as a warning and preserves the original Helper failure", () => {
    const nativeActions = [{ kind: "retry", label: "重试" }]
    const result = normalizeScannerFailure({
      code: "uac_cancelled",
      phase: "launch",
      severity: "error",
      title: "已取消管理员授权",
      message: "扫描器没有启动。",
      remedy: "请重试。",
      actions: nativeActions,
      diagnosticId: "cancelled-1",
    })
    expect(result.phase).toBe("prepare")
    expect(result.title).toBe("已取消管理员启动")
    expect(result.severity).toBe("warning")
    expect(result.message).toBe("你取消了 Windows 授权，扫描尚未开始，设置已保留。")
    expect(result.actions).toEqual([
      { kind: "copy_diagnostics", label: "复制问题信息" },
      { kind: "open_logs", label: "打开日志" },
    ])
    expect(result.details.nativeFailure).toEqual({
      code: "uac_cancelled",
      phase: "launch",
      title: "已取消管理员授权",
      message: "扫描器没有启动。",
      remedy: "请重试。",
      actions: nativeActions,
      diagnosticId: "cancelled-1",
    })
  })

  it("keeps process-start failure copy actionable without assuming a broken installation", () => {
    const result = normalizeScannerFailure({
      code: "child_start_failed",
      title: "无法启动 OCR 扫描器",
      severity: "warning",
      message: "拒绝访问。",
      remedy: "请选择重新下载并修复。",
      actions: [{ kind: "repair", label: "重新下载并修复" }],
      details: { windowsError: 5 },
    })
    expect(result.title).toBe("扫描器启动失败")
    expect(result.severity).toBe("error")
    expect(result.message).toBe("扫描器未能启动，设置已保留。")
    expect(result.remedy).not.toContain("下载")
    expect(result.actions.map(action => action.kind)).toEqual(["copy_diagnostics", "open_logs"])
    expect(result.details).toMatchObject({
      windowsError: 5,
      nativeFailure: {
        message: "拒绝访问。",
        remedy: "请选择重新下载并修复。",
        actions: [{ kind: "repair", label: "重新下载并修复" }],
      },
    })
  })

  it.each(["child_start_failed", "uac_cancelled"])("preserves the earliest native failure when %s is normalized again", code => {
    const first = normalizeScannerFailure({
      code, phase: "launch", title: "原生错误", message: "Access denied (5)",
      remedy: "旧版恢复建议", actions: [{ kind: "retry", label: "旧版重试" }], diagnosticId: "same-id",
    })
    const second = normalizeScannerFailure(first)
    const third = normalizeScannerFailure(second)
    expect(second.details.nativeFailure).toEqual(first.details.nativeFailure)
    expect(third.details.nativeFailure).toEqual(first.details.nativeFailure)
    expect(second.message).toBe(first.message)
    expect(second.details.rawMessage).toBe("Access denied (5)")
  })

  it("keeps an absent original reason absent across normalization", () => {
    const first = normalizeScannerFailure({ code: "child_start_failed" })
    expect((first.details.nativeFailure as any).message).toBe("")
    expect((normalizeScannerFailure(first).details.nativeFailure as any).message).toBe("")
  })

  it("identifies only the two startup recovery codes", () => {
    expect(isScannerStartupRecovery("uac_cancelled")).toBe(true)
    expect(isScannerStartupRecovery("child_start_failed")).toBe(true)
    for (const code of ["elevation_required", "scan_failed", "child_exited", "package_corrupt", "UAC_CANCELLED", null, undefined]) {
      expect(isScannerStartupRecovery(code)).toBe(false)
    }
  })
})
