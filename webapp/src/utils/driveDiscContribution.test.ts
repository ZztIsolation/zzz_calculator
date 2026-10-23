import { describe, expect, it } from "vitest"
import { computeDriveDiscContributions, contributionLabel, objectiveValueOf } from "@/utils/driveDiscContribution"

describe("drive disc contribution", () => {
  it("reads the same objective as the result bar", () => {
    expect(objectiveValueOf({ damage: { totalFinalDamage: 1000, finalDamage: 10 } })).toBe(1000)
    expect(objectiveValueOf({ damage: { objectiveKind: "luminescenceTeamScore", score: 12.5, totalFinalDamage: 1000 } })).toBe(12.5)
    expect(objectiveValueOf({ damage: { scalarReady: false, totalFinalDamage: 0 } })).toBeNull()
    expect(objectiveValueOf(null)).toBeNull()
  })

  it("removes one disc at a time and reports the share of the current value", () => {
    const discs = [{ id: "a", value: 300 }, { id: "b", value: 100 }, { id: "c", value: -50 }]
    const evaluate = (remaining: any[]) => 600 + remaining.reduce((sum, disc) => sum + disc.value, 0)
    const contributions = computeDriveDiscContributions({ baseValue: 950, discs, evaluate })

    expect(contributions.a!.withoutValue).toBe(650)
    expect(contributions.a!.share).toBeCloseTo(300 / 950)
    expect(contributions.c!.share).toBeCloseTo(-50 / 950)
  })

  it("skips discs whose evaluation fails and returns nothing for an invalid base", () => {
    const discs = [{ id: "a" }, { id: "b" }]
    expect(Object.keys(computeDriveDiscContributions({ baseValue: 100, discs, evaluate: remaining => (remaining[0]?.id === "b" ? null : 80) }))).toEqual(["b"])
    expect(computeDriveDiscContributions({ baseValue: 0, discs, evaluate: () => 1 })).toEqual({})
  })

  it("labels gains, losses, and ignores negligible changes", () => {
    expect(contributionLabel({ discId: "a", withoutValue: 0, share: 0.123 })).toMatchObject({ text: "贡献 12.3%", tone: "positive" })
    expect(contributionLabel({ discId: "a", withoutValue: 0, share: 0.0456 })).toMatchObject({ text: "贡献 4.56%" })
    expect(contributionLabel({ discId: "a", withoutValue: 0, share: -0.008 })).toMatchObject({ text: "去掉反而 +0.80%", tone: "negative" })
    expect(contributionLabel({ discId: "a", withoutValue: 0, share: 0.0003 })).toBeNull()
    expect(contributionLabel(null)).toBeNull()
  })
})
