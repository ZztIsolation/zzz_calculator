import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import DamageSummaryBar from "./DamageSummaryBar.vue"

describe("DamageSummaryBar", () => {
  it("labels the Luminescence team objective as a score with the symbolic k suffix", () => {
    const wrapper = mount(DamageSummaryBar, {
      props: {
        result: {
          damage: {
            objectiveKind: "luminescenceTeamScore",
            scoreSuffix: "× k",
            finalDamage: 8330.59,
            totalFinalDamage: 8330.59,
            events: [{}],
          },
        },
      },
    })

    expect(wrapper.text()).toContain("当前队伍异常评分")
    expect(wrapper.text()).toContain("8,330.59 × k")
    expect(wrapper.text()).not.toContain("当前最终伤害")
    expect(wrapper.text()).not.toContain("归一化")
  })

  it("uses the formal team-score label for legacy Luminescence results", () => {
    const wrapper = mount(DamageSummaryBar, {
      props: {
        result: { damage: { objectiveKind: "luminescenceScore", finalDamage: 100, events: [{}] } },
      },
    })

    expect(wrapper.text()).toContain("当前队伍异常评分")
    expect(wrapper.text()).not.toContain("当前耀变评分")
  })

  it("keeps the ordinary final-damage label for other objectives", () => {
    const wrapper = mount(DamageSummaryBar, {
      props: { result: { damage: { finalDamage: 100, events: [{}] } } },
    })

    expect(wrapper.text()).toContain("当前最终伤害")
  })

  it("does not render a blocked Luminescence score as zero", () => {
    const wrapper = mount(DamageSummaryBar, {
      props: {
        result: {
          damage: {
            objectiveKind: "luminescenceTeamScore",
            scoreSuffix: "× k",
            scalarReady: false,
            finalDamage: 0,
            totalFinalDamage: 0,
            events: [{}],
          },
        },
      },
    })

    expect(wrapper.text()).toContain("参数待确认")
    expect(wrapper.text()).not.toContain("0.00")
  })

  it("shows a placeholder instead of zero before the first result", () => {
    const wrapper = mount(DamageSummaryBar, { props: { result: null, loading: true } })

    expect(wrapper.find(".summary-value-skeleton").exists()).toBe(true)
    expect(wrapper.find(".summary-value").exists()).toBe(false)
    expect(wrapper.text()).toContain("加载中")
  })

  describe("relative change badge", () => {
    const result = (value: number) => ({ damage: { totalFinalDamage: value, events: [{}] } })
    const settle = async (wrapper: any) => {
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()
    }

    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it("shows the change once the value settles and fades out later", async () => {
      const wrapper = mount(DamageSummaryBar, { props: { result: result(1000), contextKey: "a" } })
      expect(wrapper.find(".summary-delta").exists()).toBe(false)

      await wrapper.setProps({ result: result(1100) })
      expect(wrapper.find(".summary-delta").exists()).toBe(false)
      await settle(wrapper)
      expect(wrapper.find(".summary-delta--up").text()).toContain("+10.0%")

      await wrapper.setProps({ result: result(1045) })
      await settle(wrapper)
      expect(wrapper.find(".summary-delta--down").text()).toContain("−5.00%")

      vi.advanceTimersByTime(5000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".summary-delta").exists()).toBe(false)
    })

    it("ignores intermediate values from back-to-back recalculations", async () => {
      const wrapper = mount(DamageSummaryBar, { props: { result: result(1000), contextKey: "a" } })

      await wrapper.setProps({ result: result(400) })
      vi.advanceTimersByTime(50)
      await wrapper.setProps({ result: result(1200) })
      await settle(wrapper)

      expect(wrapper.findAll(".summary-delta")).toHaveLength(1)
      expect(wrapper.get(".summary-delta--up").text()).toContain("+20.0%")
    })

    it("only resets the baseline when the context changes", async () => {
      const wrapper = mount(DamageSummaryBar, { props: { result: result(1000), contextKey: "a" } })
      await wrapper.setProps({ result: result(1100) })
      await settle(wrapper)
      expect(wrapper.find(".summary-delta").exists()).toBe(true)

      // 切换方案：旧提示立即清掉，新方案的值不算涨跌
      await wrapper.setProps({ result: result(5000), contextKey: "b" })
      expect(wrapper.find(".summary-delta").exists()).toBe(false)
      await settle(wrapper)
      expect(wrapper.find(".summary-delta").exists()).toBe(false)

      // 新方案下继续调参，按新基准比较
      await wrapper.setProps({ result: result(5500) })
      await settle(wrapper)
      expect(wrapper.get(".summary-delta--up").text()).toContain("+10.0%")
    })

    it("keeps the badge on the status row so the value line never reflows", async () => {
      const wrapper = mount(DamageSummaryBar, { props: { result: result(1000), contextKey: "a" } })
      await wrapper.setProps({ result: result(1100) })
      await settle(wrapper)

      expect(wrapper.find(".summary-value-row .summary-delta").exists()).toBe(false)
      expect(wrapper.find(".summary-chip-row .summary-delta").exists()).toBe(true)
    })
  })

  it("keeps only the status chip in the summary row", () => {
    const wrapper = mount(DamageSummaryBar, {
      props: { result: { damage: { finalDamage: 100, events: [{}, {}] } } },
    })

    expect(wrapper.text()).toContain("即时刷新")
    expect(wrapper.text()).not.toContain("局内面板")
    expect(wrapper.text()).not.toContain("事件 ")
  })
})
