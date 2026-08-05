import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

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
})
