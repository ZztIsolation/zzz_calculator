import { describe, expect, it } from "vitest"
import { buffEffectSummary } from "@/utils/buffEffectSummary"

describe("buffEffectSummary", () => {
  it("strips parentheses from effect rows and joins rows with modifiers", () => {
    expect(buffEffectSummary(
      [{ text: "暴击率 +30%（持续 3 秒）" }, { text: "通用伤害加成% +25%" }],
      ["受到的失衡易伤 +10%"],
    )).toBe("暴击率 +30% · 通用伤害加成% +25% · 受到的失衡易伤 +10%")
  })

  it("falls back when there are no effect rows or modifiers", () => {
    expect(buffEffectSummary([], [], "基础说明")).toBe("基础说明")
    expect(buffEffectSummary([], [])).toBe("")
  })
})
