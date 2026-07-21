import { describe, expect, it } from "vitest"
import {
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
})
