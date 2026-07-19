import { mount } from "@vue/test-utils"
import { NSelect } from "naive-ui"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"

describe("DamageWhiteBox", () => {
  function mountWhiteBox() {
    return mount(DamageWhiteBox, {
      props: {
        damage,
      },
    })
  }

  const damage = {
    finalDamage: 1234.5,
    totalFinalDamage: 3456.75,
    selectedEventId: "direct-1",
    events: [
      {
        id: "direct-1",
        kind: "direct",
        label: "普通攻击 / 强化普攻：霜月 / 三段蓄力斩击伤害倍率",
        count: 2,
        finalDamage: 1234.5,
        damageVariants: {
          expected: { finalDamage: 1234.5 },
          crit: { finalDamage: 1600 },
          nonCrit: { finalDamage: 900 },
        },
        panelSnapshot: {
          atk: 3000,
          critRate: 0.72,
          iceDmg: 0.46,
        },
        whiteBoxRows: [
          {
            label: "技能倍率",
            formula: "普通攻击 / 强化普攻：霜月 / 三段蓄力斩击伤害倍率 LV12",
            value: 5.2,
            displayValue: "520%",
          },
          {
            label: "防御乘区",
            formulaLines: [
              "减防后防御（减防/无视防御）= 953 × (1 - 20%) - 0",
              "有效防御（穿透率）= 762.4 × (1 - 0%) - 0",
              "防御乘区 = 794 / (794 + 762.4)",
            ],
            value: 0.5101,
            displayValue: "0.5101",
          },
        ],
      },
      {
        id: "disorder-1",
        kind: "anomaly",
        settlementType: "disorder",
        label: "烈霜霜寒紊乱（星见雅）",
        count: 1,
        finalDamage: 2222.25,
        panelSnapshot: {
          atk: 3000,
          anomalyProficiency: 320,
        },
        whiteBoxRows: [
          {
            label: "紊乱倍率",
            formula: "烈霜霜寒紊乱（星见雅）：450% + 10 × 7.5%",
            value: 5.25,
            displayValue: "525%",
          },
        ],
      },
      {
        id: "loop-ref",
        kind: "skillGroup",
        label: "技能组 · 一变",
        count: 10,
        finalDamage: 999999,
      },
    ],
  }

  it("shows the selected skill event, formulas, event variants, and a compact event select", () => {
    const wrapper = mountWhiteBox()

    expect(wrapper.text()).toContain("当前白盒")
    expect(wrapper.text()).toContain("普通攻击 / 强化普攻：霜月 / 三段蓄力斩击伤害倍率 ×2")
    expect(wrapper.text()).toContain("本事件 1,234.5")
    expect(wrapper.text()).toContain("总计 3,456.75")
    expect(wrapper.text()).toContain("期望 1,234.5")
    expect(wrapper.find(".damage-event-select .n-select").exists()).toBe(true)
    const options = wrapper.getComponent(NSelect).props("options") as Array<{ label: string, value: string }>
    expect(options.map(option => option.value)).toEqual(["direct-1", "disorder-1"])
    expect(options.map(option => option.label).join("|")).not.toContain("技能组")
    expect(wrapper.findAll(".damage-event-button")).toHaveLength(0)
    expect(wrapper.text()).not.toContain("结算面板")
    expect(wrapper.text()).toContain("技能倍率")
    expect(wrapper.text()).toContain("520%")
    expect(wrapper.text()).toContain("减防后防御（减防/无视防御）= 953 × (1 - 20%) - 0")
    expect(wrapper.text()).toContain("防御乘区 = 794 / (794 + 762.4)")
  })

  it("switches the visible white-box rows from the event select", async () => {
    const wrapper = mountWhiteBox()

    wrapper.getComponent(NSelect).vm.$emit("update:value", "disorder-1")
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain("当前白盒")
    expect(wrapper.text()).toContain("烈霜霜寒紊乱（星见雅） ×1")
    expect(wrapper.text()).toContain("紊乱倍率")
    expect(wrapper.text()).toContain("烈霜霜寒紊乱（星见雅）：450% + 10 × 7.5%")
    expect(wrapper.text()).not.toContain("防御乘区 = 794 / (794 + 762.4)")
  })
})
