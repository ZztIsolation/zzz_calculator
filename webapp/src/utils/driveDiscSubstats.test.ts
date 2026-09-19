import { describe, expect, it } from "vitest"
import {
  driveDiscAdditionalRollText,
  driveDiscAdditionalRolls,
  driveDiscSubStatRollCount,
} from "@/utils/driveDiscSubstats"

const meta = {
  statRules: {
    driveDisc: {
      sRankSubStatBaseStep: {
        critRate: 2.4,
        anomalyProficiency: 9,
      },
    },
  },
}

describe("driveDiscSubstats", () => {
  it("converts total rolls into additional rolls", () => {
    expect(driveDiscSubStatRollCount("critRate", 2.4, meta)).toBe(1)
    expect(driveDiscAdditionalRolls("critRate", 7.2, meta)).toBe(2)
    expect(driveDiscAdditionalRollText("critRate", 7.2, meta)).toBe("+2")
    expect(driveDiscAdditionalRollText("anomalyProficiency", 9, meta)).toBe("")
  })

  it("rejects values that cannot be mapped to an integer roll count", () => {
    expect(driveDiscSubStatRollCount("critRate", 3.1, meta)).toBeNull()
    expect(driveDiscSubStatRollCount("critRate", 16.8, meta)).toBeNull()
    expect(driveDiscSubStatRollCount("unknown", 2.4, meta)).toBeNull()
    expect(driveDiscSubStatRollCount("critRate", 7.2000000001, meta)).toBe(3)
  })

  it("does not infer lower-rank roll counts from coincident S-rank values", () => {
    for (const rarity of ["A", "B", "unknown"]) {
      expect(driveDiscAdditionalRollText("critRate", 4.8, meta, rarity)).toBe("")
    }
    expect(driveDiscAdditionalRollText("critRate", 4.8, meta, "S")).toBe("+1")
  })
})
