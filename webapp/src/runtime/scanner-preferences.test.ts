import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadScannerPreferences, saveScannerPreferences } from "@runtime/scanner-preferences"

const key = "zzz-calculator.scannerPreferences.v1"
const defaults = { client: "local", maxItems: 0, stopAtNonLevel15: true, runAsAdmin: false }

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("scanner preferences", () => {
  it("uses defaults without changing other browser data", () => {
    localStorage.setItem("unrelated", "keep")
    expect(loadScannerPreferences()).toEqual(defaults)
    expect(localStorage.getItem("unrelated")).toBe("keep")
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("persists only reusable settings, never deletion consent or runtime state", () => {
    expect(saveScannerPreferences({
      client: "cloud",
      maxItems: 75,
      stopAtNonLevel15: false,
      runAsAdmin: true,
      removeMissing: true,
      scanRemoveMissing: true,
      adminRequestCompleted: true,
      scanDeleteConfirmation: { ownerId: "account-a" },
    })).toBe(true)
    const expected = { client: "cloud", maxItems: 75, stopAtNonLevel15: false, runAsAdmin: true }
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(expected)
    expect(loadScannerPreferences()).toEqual(expected)
  })

  it.each([null, [], "old", 1, { client: "invalid", maxItems: "12", stopAtNonLevel15: 0, runAsAdmin: "true" }])(
    "ignores invalid stored preference types: %j", value => {
      localStorage.setItem(key, JSON.stringify(value))
      expect(loadScannerPreferences()).toEqual(defaults)
    },
  )

  it.each([-1, 1.5, 10000, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid limits: %s", maxItems => {
    saveScannerPreferences({ client: "cloud", maxItems, stopAtNonLevel15: false, runAsAdmin: true })
    expect(loadScannerPreferences()).toEqual({ ...defaults, client: "cloud", stopAtNonLevel15: false, runAsAdmin: true })
  })

  it("loads known fields from an older document and ignores unknown fields", () => {
    localStorage.setItem(key, JSON.stringify({ client: "cloud", maxItems: 9999, removeMissing: true }))
    expect(loadScannerPreferences()).toEqual({ ...defaults, client: "cloud", maxItems: 9999 })
  })

  it("preserves malformed stored data while using defaults", () => {
    localStorage.setItem(key, "{broken")
    expect(loadScannerPreferences()).toEqual(defaults)
    expect(localStorage.getItem(key)).toBe("{broken")
  })

  it("handles unavailable storage and reports a failed save without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage unavailable") })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage full") })
    expect(loadScannerPreferences()).toEqual(defaults)
    expect(saveScannerPreferences(defaults)).toBe(false)
  })
})
