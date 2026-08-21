import { describe, expect, it } from "vitest"
import {
  driveDiscScannerSequence,
  driveDiscSourceDescriptors,
  driveDiscSourceText,
} from "@/utils/driveDiscProvenance"

describe("drive disc provenance display", () => {
  it("returns multi-source labels in a stable order", () => {
    const disc = {
      provenance: {
        version: 1,
        manual: { lastEditedAt: "2026-08-18T00:00:00.000Z" },
        calculatorJson: { sourceRecordId: "json-disc" },
        scanner: { lastSequence: 27 },
        enkaZzz: { uid: "1302309616", equipmentUid: "equipment-1" },
      },
      source: { type: "enka-zzz-showcase" },
    }

    expect(driveDiscSourceDescriptors(disc).map(source => source.label)).toEqual([
      "Enka",
      "扫描器",
      "JSON",
      "手动",
    ])
    expect(driveDiscScannerSequence(disc)).toBe("27")
    expect(driveDiscSourceText(disc, { includeScannerSequence: true })).toBe("Enka、扫描器 #27、JSON、手动")
  })

  it.each([
    ["enka-showcase", "Enka"],
    ["zzz-scanner", "扫描器"],
    ["calculator-json", "JSON"],
    ["manual", "手动"],
  ])("supports legacy source type %s", (type, label) => {
    expect(driveDiscSourceDescriptors({ source: { type } }).map(source => source.label)).toEqual([label])
  })

  it("recognizes sequence-only legacy Scanner sources", () => {
    const disc = { source: { sequence: 88 } }
    expect(driveDiscSourceDescriptors(disc).map(source => source.label)).toEqual(["扫描器"])
    expect(driveDiscScannerSequence(disc)).toBe("88")
    expect(driveDiscSourceText(disc, { includeScannerSequence: true })).toBe("扫描器 #88")
  })

  it("does not treat an Enka sequence-shaped compatibility field as Scanner provenance", () => {
    const disc = { source: { type: "enka-zzz-showcase", sequence: 9 } }
    expect(driveDiscScannerSequence(disc)).toBeNull()
    expect(driveDiscSourceText(disc, { includeScannerSequence: true })).toBe("Enka")
  })
})
