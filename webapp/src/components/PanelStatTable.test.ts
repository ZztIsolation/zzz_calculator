import { mount } from "@vue/test-utils"
import PanelStatTable from "@/components/PanelStatTable.vue"

describe("PanelStatTable", () => {
  const panel = {
    hp: 18165.2,
    atk: 2249,
    def: 625,
    critRate: 0.578,
    critDmg: 1.716,
    sheerForce: 1509.39,
    impact: 93,
    anomalyProficiency: 99,
    anomalyMastery: 92,
    penFlat: 36,
    penRatio: 0,
    dmgBonus: 0,
  }

  it("shows sheer force after attack when enabled for rupture agents", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel,
        includeSheerForce: true,
      },
    })

    const labels = wrapper.findAll("th").map(item => item.text())
    expect(labels.slice(0, 3)).toEqual(["生命值", "攻击力", "贯穿力"])
    expect(wrapper.text()).toContain("1,509.4")
  })

  it("hides zero sheer force when not enabled for non-rupture agents", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel: {
          ...panel,
          sheerForce: 0,
        },
      },
    })

    const labels = wrapper.findAll("th").map(item => item.text())
    expect(labels).not.toContain("贯穿力")
  })
})
