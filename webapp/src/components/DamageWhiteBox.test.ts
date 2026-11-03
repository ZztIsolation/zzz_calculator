import { mount } from "@vue/test-utils"
import { NSelect } from "naive-ui"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"

describe("DamageWhiteBox", () => {
  it("shows three anomaly outcomes, current mode and guaranteed-CRIT counterfactual without changing configuration", async () => {
    const event = {
      id: "assault", kind: "anomaly", settlementType: "attribute", count: 2, finalDamage: 20000,
      input: { kind: "anomaly", anomalyEffect: "assault", critMode: "nonCrit" },
      critInfo: { available: true, effectiveMode: "nonCrit", critRate: 1, critDmg: 0.5 },
      damageVariants: { expected: { finalDamage: 30000 }, crit: { finalDamage: 30000 }, nonCrit: { finalDamage: 20000 } },
    }
    const wrapper = mount(DamageWhiteBox, { props: { damage: { events: [event] } } })
    expect(wrapper.text()).toContain("当前模式：非暴击")
    expect(wrapper.text()).toContain("非暴击（对照） 20,000")
    expect(wrapper.get('.damage-selected-variant').text()).toContain("非暴击")
    await wrapper.get('.damage-selected-variant').trigger('click')
    expect(event.input.critMode).toBe("nonCrit")
    await wrapper.setProps({ damage: { events: [{ ...event, critInfo: { ...event.critInfo, available: false }, damageVariants: undefined }] } })
    expect(wrapper.find('.damage-selected-variants').exists()).toBe(false)
    expect(wrapper.find('.damage-current-mode').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([
    [undefined, "乱流 · 烈霜（星见雅）"],
    ["手动命名事件", "乱流 · 手动命名事件"],
  ])("uses the shared turbulence title while retaining authored label %s", (label, expected) => {
    const wrapper = mount(DamageWhiteBox, { props: { damage: { events: [{
      id: "turbulence", kind: "anomaly", settlementType: "turbulence", count: 1,
      label: label ?? "乱流（烈霜乱流）", finalDamage: 1500,
      input: { kind: "anomaly", settlementType: "turbulence", anomalyEffect: "frost_frozen", count: 1, label },
    }] } } })
    expect(wrapper.find(".damage-whitebox-current strong").text()).toBe(`${expected} ×1`)
    expect(wrapper.find(".damage-skill-chip-name").text()).toBe(expected)
    expect(wrapper.find(".damage-skill-chip-count").exists()).toBe(false)
    expect(wrapper.text()).not.toContain("乱流（烈霜乱流）")
    wrapper.unmount()
  })
  it("keeps the event select and excludes skill groups from its options", () => {
    const wrapper = mountWhiteBox()
    expect(wrapper.find(".damage-event-select .n-select").exists()).toBe(true)
    const options = wrapper.getComponent(NSelect).props("options") as Array<{ label: string, value: string }>
    expect(options.map(option => option.value)).toEqual(["direct-1", "disorder-1"])
    expect(options[0]?.label).toContain("1,235")
    expect(options.map(option => option.label).join("|")).not.toContain("技能组")
    expect(wrapper.text()).not.toContain("结算面板")
    wrapper.unmount()
  })

  it("keeps the turbulence title in the event options", () => {
    const wrapper = mount(DamageWhiteBox, { props: { damage: { events: [{
      id: "turbulence", kind: "anomaly", settlementType: "turbulence", count: 1,
      label: "乱流（烈霜乱流）", finalDamage: 1500,
      input: { kind: "anomaly", settlementType: "turbulence", anomalyEffect: "frost_frozen", count: 1 },
    }] } } })
    const options = wrapper.getComponent(NSelect).props("options") as Array<{ label: string }>
    expect(options[0]?.label).toContain("乱流 · 烈霜（星见雅）")
    wrapper.unmount()
  })

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
          expected: { finalDamage: 389141.437 },
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

  it("shows the selected event summary, compact skill pills and its preview", () => {
    const wrapper = mountWhiteBox()

    expect(wrapper.text()).toContain("当前白盒")
    expect(wrapper.text()).toContain("普通攻击 / 强化普攻：霜月 / 三段蓄力斩击伤害倍率 ×2")
    expect(wrapper.text()).toContain("本事件 1,235")
    expect(wrapper.text()).toContain("总计 3,457")
    expect(wrapper.text()).toContain("期望 389,141")
    expect(wrapper.text()).not.toContain("389,141.437")
    expect(wrapper.findAll(".damage-skill-chip")).toHaveLength(2)
    expect(wrapper.findAll(".damage-skill-chip-name").map(pill => pill.text())).toEqual(["强化普攻：霜月", "烈霜霜寒紊乱（星见雅）"])
    expect(wrapper.find(".damage-skill-chip-damage").text()).toBe("1,235")
    expect(wrapper.find(".damage-preview-name").text()).toBe("强化普攻：霜月")
    expect(wrapper.text()).toContain("技能倍率")
    expect(wrapper.text()).toContain("520%")
    expect(wrapper.findAll(".damage-whitebox-row")).toHaveLength(0)
    expect(wrapper.findAll(".damage-preview-row")).toHaveLength(2)
    expect(wrapper.findAll(".damage-whitebox-current-values > span")).toHaveLength(2)
    expect(wrapper.findAll(".damage-preview-row-value").map(row => row.text())).toEqual(["520%", "0.5101"])
  })

  it("keeps derivations collapsed and reveals them only when a multiplier is clicked", async () => {
    const wrapper = mountWhiteBox()
    const rows = () => wrapper.findAll(".damage-preview-row")
    const derivationVisible = (index: number) => rows()[index]!.find(".damage-preview-row-main").exists()

    expect(rows().map(row => row.get("button.damage-preview-row-head").attributes("aria-expanded"))).toEqual(["false", "false"])
    expect(derivationVisible(1)).toBe(false)

    await rows()[1]!.get("button.damage-preview-row-head").trigger("click")
    expect(derivationVisible(1)).toBe(true)
    expect(rows()[1]!.get("button.damage-preview-row-head").attributes("aria-expanded")).toBe("true")
    expect(wrapper.text()).toContain("防御乘区 = 794 / (794 + 762.4)")

    await rows()[1]!.get("button.damage-preview-row-head").trigger("click")
    expect(derivationVisible(1)).toBe(false)
  })

  it("keeps Buff sources hidden until the multiplier is expanded", async () => {
    const wrapper = mountWhiteBox()
    const row = wrapper.find(".damage-preview-row")
    const source = {
      key: "driveDisc4pc:shadow_harmony.self",
      name: "如影相随",
      sourceTypeLabel: "驱动盘 4 件套",
      condition: "追加攻击命中敌人",
      stat: "critRate",
      value: 0.12,
    }
    await wrapper.setProps({ damage: {
      ...damage,
      events: damage.events.map(event => event.id === "direct-1" ? {
        ...event,
        whiteBoxRows: [{
          label: "暴击乘区",
          value: 1.2,
          displayValue: "1.2",
          sources: [source],
        }],
      } : event),
    } })
    expect(wrapper.find(".damage-preview-sources").exists()).toBe(false)
    await row.get("button.damage-preview-row-head").trigger("click")
    expect(wrapper.find(".damage-preview-sources").text()).toContain("如影相随")
    expect(wrapper.find(".damage-preview-sources").text()).toContain("驱动盘 4 件套")
    expect(wrapper.find(".damage-preview-source-value").text()).toBe("+12%")
    expect(wrapper.get(".damage-preview-source-contribution").text()).toBe("暴击率 +12%")
  })

  it("shows flat attack gains with their percentage basis instead of treating percent as flat attack", async () => {
    const wrapper = mount(DamageWhiteBox, { props: { damage: { events: [{
      id: "attack", kind: "direct", count: 1, finalDamage: 100,
      whiteBoxRows: [{ label: "局内攻击力", value: 2168.1, sources: [
        { name: "基础攻击力", sourceTypeLabel: "角色 / 音擎 / 核心技", value: 1681, valueKind: "flat" },
        { name: "测试攻击 Buff", sourceTypeLabel: "队友 Buff", value: 168.1, valueKind: "flat", formula: "基础攻击力 1681 × 10%" },
      ] }],
    }] } } })
    expect(wrapper.find(".damage-preview-sources").exists()).toBe(false)
    await wrapper.get("button.damage-preview-row-head").trigger("click")
    const sourceArea = wrapper.get(".damage-preview-sources")
    expect(sourceArea.findAll(".damage-preview-source-value").map(source => source.text())).toEqual(["+1,681", "+168.1"])
    expect(sourceArea.text()).toContain("基础攻击力 1681 × 10%")
    expect(sourceArea.text()).not.toContain("+168100%")
  })

  it("switches the preview only when a skill pill is clicked", async () => {
    const wrapper = mountWhiteBox()
    const pills = wrapper.findAll(".damage-skill-chip")
    await pills[1]!.trigger("mouseenter")
    expect(wrapper.find(".damage-preview-name").text()).toBe("强化普攻：霜月")
    await pills[1]!.trigger("click")
    await wrapper.vm.$nextTick()

    expect(wrapper.find(".damage-preview-name").text()).toBe("烈霜霜寒紊乱（星见雅）")
    expect(wrapper.text()).toContain("紊乱倍率")
    expect(pills[1]!.attributes("aria-pressed")).toBe("true")

    await pills[0]!.trigger("click")
    await wrapper.vm.$nextTick()
    expect(wrapper.find(".damage-preview-name").text()).toBe("强化普攻：霜月")
    expect(wrapper.find(".damage-preview-row-value").text()).toBe("520%")
  })

  it("keeps luminescence score precision and suffix separate from damage rounding", () => {
    const wrapper = mount(DamageWhiteBox, {
      props: {
        damage: {
          objectiveKind: "luminescenceTeamScore",
          scoreSuffix: "× k",
          events: [{
            id: "score-1",
            kind: "anomaly",
            objectiveKind: "luminescenceTeamScore",
            finalDamage: 12.3456,
          }],
        },
      },
    })

    expect(wrapper.text()).toContain("本评分 12.346 × k")
  })
})
