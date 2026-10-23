import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { NInputNumber, NSlider } from "naive-ui"
import OptimizerResultSelector from "@/components/OptimizerResultSelector.vue"

const results = [
  { rank: 1, score: 1000 },
  { rank: 2, score: 978 },
  { rank: 3, score: 900 },
]
const topTenResults = Array.from({ length: 10 }, (_, index) => ({
  rank: index + 1,
  score: 1000 - index * 10,
}))

function mountSelector(modelValue = 1, resultOptions = results, stale = false) {
  return mount(OptimizerResultSelector, {
    props: {
      modelValue,
      results: resultOptions,
      stale,
    },
  })
}

describe("OptimizerResultSelector", () => {
  // 评分区分三块：标签、数值、“第 N 套 · 比例”说明
  function expectScore(wrapper: any, label: string, value: string, caption: string | null) {
    const tile = wrapper.get(".optimizer-result-score")
    expect(tile.get(".optimizer-result-metric-label").text()).toBe(label)
    expect(tile.get(".optimizer-result-score-value").text()).toBe(value)
    if (caption === null) expect(tile.find(".optimizer-result-caption").exists()).toBe(false)
    else expect(tile.get(".optimizer-result-caption").text()).toBe(caption)
  }
  it("shows the selected result relative to the best score", async () => {
    const wrapper = mountSelector()

    expectScore(wrapper, "评分", "1,000", "第 1 套 · 相对第一套 100%")

    await wrapper.setProps({ modelValue: 2 })

    expectScore(wrapper, "评分", "978", "第 2 套 · 相对第一套 97.8%")
    expect(wrapper.get("[role='progressbar']").attributes("aria-valuenow")).toBe("97.8")
  })

  it("emits ranks from the slider and rank input", async () => {
    const wrapper = mountSelector(2)

    await wrapper.getComponent(NSlider).vm.$emit("update:value", 1)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1])

    await wrapper.getComponent(NInputNumber).vm.$emit("update:value", 3)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([3])
    expect(wrapper.get("[data-testid='optimizer-result-slider']").exists()).toBe(true)
    expect(wrapper.get("[data-testid='optimizer-result-rank-input']").exists()).toBe(true)
  })

  it("allows selecting the tenth result directly", async () => {
    const wrapper = mountSelector(9, topTenResults)

    await wrapper.getComponent(NSlider).vm.$emit("update:value", 10)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([10])

    await wrapper.setProps({ modelValue: 10 })
    expect(wrapper.get("[data-testid='optimizer-result-slider']").exists()).toBe(true)
    expect(wrapper.get("[data-testid='optimizer-result-rank-input']").exists()).toBe(true)
  })

  it("disables a single result and returns to the first rank when results shrink", async () => {
    const wrapper = mountSelector(3)

    await wrapper.setProps({ results: [
      { rank: 1, score: 1000 },
      { rank: 2, score: 978 },
    ] })

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1])

    await wrapper.setProps({ modelValue: 1, results: [{ rank: 1, score: 1000 }] })
    expect(wrapper.get("[data-testid='optimizer-result-slider']").exists()).toBe(true)
    expect(wrapper.get("[data-testid='optimizer-result-rank-input']").exists()).toBe(true)
    expect(wrapper.get(".optimizer-result-caption").text()).toBe("第 1 套 · 相对第一套 100%")
  })

  it("does not render for an invalid best score", () => {
    const wrapper = mountSelector(1, [{ rank: 1, score: 0 }])

    expect(wrapper.find(".optimizer-result-selector").exists()).toBe(false)
    expect(wrapper.text()).not.toContain("NaN")
    expect(wrapper.text()).not.toContain("Infinity")
  })

  it("labels retained result scores as stale after constraints change", () => {
    const wrapper = mountSelector(2, results, true)

    expectScore(wrapper, "上次评分", "978", "第 2 套 · 相对第一套 97.8%")
    expect(wrapper.get("[role='progressbar']").classes()).toContain("is-stale")
    expect(wrapper.get("[role='progressbar']").attributes("aria-label")).toContain("上次评分")
  })

  it("formats Luminescence team optimization results as a three-decimal score with k", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 1,
        results: [{ rank: 1, score: 5134.289 }],
        scoreLabel: "队伍异常评分",
        scoreSuffix: "× k",
        scoreDigits: 3,
      },
    })

    expectScore(wrapper, "队伍异常评分", "5,134.289 × k", "第 1 套 · 相对第一套 100%")
    expect(wrapper.get("[role='progressbar']").attributes("aria-label")).toContain("队伍异常评分比例")
  })

  it("renders a manual or loadout score without a rank", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 0,
        results: [],
        currentScore: 810,
        referenceScore: 900,
        showRank: false,
        showControls: false,
      },
    })

    expectScore(wrapper, "评分", "810", "相对优化第一套 90.0%")
    expect(wrapper.text()).not.toMatch(/第 \d+ 套/)
    expect(wrapper.find(".optimizer-result-pager").exists()).toBe(false)
    expect(wrapper.get("[role='progressbar']").attributes("aria-valuenow")).toBe("90")
    expect(wrapper.get("[role='progressbar']").attributes("aria-label")).toContain("当前方案相对优化第一套")
  })

  it("falls back to 100 percent when no optimizer reference exists", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 0,
        results: [],
        currentScore: 810,
        referenceScore: 810,
        showRank: false,
        showControls: false,
      },
    })

    expectScore(wrapper, "评分", "810", "相对优化第一套 100%")
  })

  it("hides the comparison percentage for a stale manual or loadout score", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 0,
        results: [],
        currentScore: 810,
        referenceScore: 900,
        showRank: false,
        showControls: false,
        showPercentage: false,
      },
    })

    expectScore(wrapper, "评分", "810", null)
    expect(wrapper.text()).not.toContain("90%")
    expect(wrapper.find("[role='progressbar']").exists()).toBe(false)
    expect(wrapper.get(".optimizer-result-score").attributes("aria-label")).toBe("当前方案评分")
  })

  it("shows one effective-substat tile when PEN is not important", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 1,
        results: [{ rank: 1, score: 1000 }],
        effectiveSubstatCounts: { total: 12, withoutPenFlat: 12, includesPenFlat: false },
      },
    })

    const tile = wrapper.get(".optimizer-result-effective-substats")
    expect(tile.get(".optimizer-result-metric-label").text()).toBe("有效副词条")
    expect(tile.get(".optimizer-result-effective-total").text()).toBe("12")
    expect(tile.find(".optimizer-result-effective-note").exists()).toBe(false)
    expect(tile.attributes("title")).toBe("有效副词条数量 12")
    expect(wrapper.text()).not.toContain("穿透值")
  })

  it("adds the without-PEN count under the total when PEN is important", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 1,
        results: [{ rank: 1, score: 1000 }],
        effectiveSubstatCounts: { total: 15, withoutPenFlat: 12, includesPenFlat: true },
      },
    })

    const tile = wrapper.get(".optimizer-result-effective-substats")
    expect(tile.get(".optimizer-result-effective-total").text()).toBe("15")
    expect(tile.get(".optimizer-result-effective-note").text()).toBe("不含穿透值 12")
    expect(tile.attributes("title")).toBe("有效副词条数量（包含穿透值）15，不含穿透值 12")
  })

  it("keeps the effective-substat tile visible when stale comparison percentage is hidden", () => {
    const wrapper = mount(OptimizerResultSelector, {
      props: {
        modelValue: 0,
        results: [],
        currentScore: 810,
        referenceScore: 900,
        showRank: false,
        showControls: false,
        showPercentage: false,
        effectiveSubstatCounts: { total: 9, withoutPenFlat: 9, includesPenFlat: false },
      },
    })

    expectScore(wrapper, "评分", "810", null)
    expect(wrapper.get(".optimizer-result-effective-total").text()).toBe("9")
    expect(wrapper.text()).not.toContain("90%")
  })
})
