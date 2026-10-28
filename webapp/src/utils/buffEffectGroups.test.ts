import { describe, expect, it } from "vitest"
import { effectGroupForStat, effectGroupsForRules } from "./buffEffectGroups"

describe("buff effect groups", () => {
  it("classifies stats by what they change, preferring the more specific prefix", () => {
    expect(effectGroupForStat("atkPct")).toBe("atk")
    expect(effectGroupForStat("atkFlat")).toBe("atk")
    expect(effectGroupForStat("critRate")).toBe("crit")
    expect(effectGroupForStat("critDmg")).toBe("crit")
    expect(effectGroupForStat("iceCritDmg")).toBe("crit")
    expect(effectGroupForStat("dmgBonus")).toBe("dmg")
    expect(effectGroupForStat("etherDmg")).toBe("dmg")
    expect(effectGroupForStat("sharpDmgBonus")).toBe("dmg")
    expect(effectGroupForStat("penRatio")).toBe("pen")
    expect(effectGroupForStat("enemyDefReduction")).toBe("pen")
    expect(effectGroupForStat("electricDefIgnore")).toBe("pen")
    expect(effectGroupForStat("allResIgnore")).toBe("res")
    expect(effectGroupForStat("enemyIceResReduction")).toBe("res")
    expect(effectGroupForStat("anomalyProficiency")).toBe("anomaly")
    expect(effectGroupForStat("anomalyCritDmg")).toBe("anomaly")
    expect(effectGroupForStat("disorderDamageBonus")).toBe("anomaly")
    expect(effectGroupForStat("stunDmgMultiplierBonus")).toBe("stun")
    expect(effectGroupForStat("impactPct")).toBe("stun")
    expect(effectGroupForStat("hpPct")).toBe("survival")
    expect(effectGroupForStat("defPct")).toBe("survival")
    expect(effectGroupForStat("energyRegen")).toBe("energy")
    expect(effectGroupForStat("somethingNew")).toBe("other")
    expect(effectGroupForStat(undefined)).toBe("other")
  })

  it("collects every group a buff touches and falls back to other", () => {
    expect([...effectGroupsForRules([{ stat: "dmgBonus" }, { stat: "hpPct" }, { stat: "etherDmg" }])].sort()).toEqual(["dmg", "survival"])
    expect([...effectGroupsForRules([])]).toEqual(["other"])
  })
})
