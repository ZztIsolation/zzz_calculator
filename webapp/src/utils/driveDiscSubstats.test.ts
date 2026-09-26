import { describe, expect, it } from "vitest"
import {
  driveDiscAdditionalRollText,
  driveDiscAdditionalRolls,
  driveDiscSubStatRollCount,
  countEffectiveDriveDiscSubstats,
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

  it("counts important substat rolls and separates PEN", () => {
    const counts = countEffectiveDriveDiscSubstats([
      {
        rarity: "S",
        subStats: [
          { stat: "critRate", value: 7.2 },
          { stat: "penFlat", value: 18 },
          { stat: "atkPct", value: 3 },
        ],
      },
    ], ["critRate", "penFlat", "atkPct"], {
      statRules: {
        driveDisc: {
          sRankSubStatBaseStep: { critRate: 2.4, penFlat: 9, atkPct: 3 },
        },
      },
    })

    expect(counts).toEqual({ total: 6, withoutPenFlat: 4, includesPenFlat: true })
  })

  it("counts unknown and lower-rarity values once without inventing extra rolls", () => {
    const counts = countEffectiveDriveDiscSubstats([
      {
        rarity: "A",
        subStats: [{ stat: "critRate", value: 4.8 }],
      },
      {
        rarity: "S",
        subStats: [{ stat: "critRate", value: 3.1 }, { stat: "critRate", value: 0 }],
      },
    ], ["critRate"], meta)

    expect(counts).toEqual({ total: 2, withoutPenFlat: 2, includesPenFlat: false })
  })

  it("returns zero for an empty important-substat configuration", () => {
    expect(countEffectiveDriveDiscSubstats([
      { rarity: "S", subStats: [{ stat: "critRate", value: 7.2 }] },
    ], [], meta)).toEqual({ total: 0, withoutPenFlat: 0, includesPenFlat: false })
  })
})
