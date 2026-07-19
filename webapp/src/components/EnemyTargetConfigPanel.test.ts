import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import EnemyTargetConfigPanel from "@/components/EnemyTargetConfigPanel.vue"
import { defaultTargetConfig } from "@/stores/build"

const naiveStubs = {
  NButton: {
    template: "<button><slot /></button>",
  },
  NCheckbox: {
    props: ["checked"],
    emits: ["update:checked"],
    template: "<label><input type=\"checkbox\" :checked=\"checked\" @change=\"$emit('update:checked', $event.target.checked)\"><slot /></label>",
  },
  NInputNumber: {
    inheritAttrs: false,
    props: ["value", "min", "max", "step"],
    emits: ["update:value"],
    template: "<input v-bind=\"$attrs\" :value=\"value\" :data-step=\"step\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NSelect: {
    props: ["value", "options"],
    emits: ["update:value"],
    template: "<select :value=\"value\" @change=\"$emit('update:value', $event.target.value)\"></select>",
  },
  NTag: {
    template: "<span><slot /></span>",
  },
}

function mountPanel(targetConfig: any = {}, metaOverrides: any = {}) {
  return mount(EnemyTargetConfigPanel, {
    props: {
      damageElement: "ice",
      meta: {
        damageTargetPresets: [
          { id: "wandering-hunter", name: { zhCN: "彷徨猎手" }, defense: 1588 },
          { id: "taichu-nightmare", name: { zhCN: "低防怪如太初梦魇" }, defense: 476 },
          { id: "normal-boss", name: { zhCN: "正常boss" }, defense: 953 },
        ],
        ...metaOverrides,
      },
      targetConfig: {
        ...defaultTargetConfig(),
        resistanceByElement: {
          ...defaultTargetConfig().resistanceByElement,
          ice: -20,
        },
        ...targetConfig,
      },
    },
    global: {
      stubs: naiveStubs,
    },
  })
}

describe("EnemyTargetConfigPanel", () => {
  it("uses the current damage element as the resistance field", async () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain("冰抗性")
    expect(wrapper.text()).not.toContain("抗性元素")
    expect(wrapper.text()).not.toContain("抗性%")
    const resistanceInput = wrapper.findComponent("[data-testid='target-resistance-input']")
    expect(resistanceInput.props("step")).toBe(1)

    await resistanceInput.vm.$emit("update:value", 12.6)

    const emitted = wrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.resistanceByElement.ice).toBe(13)
  })

  it("keeps only the stun multiplier in target configuration", async () => {
    const wrapper = mountPanel({ stunned: false, stunMultiplierPercent: 150 })

    expect(wrapper.text()).toContain("初始失衡倍率")
    expect(wrapper.text()).not.toContain("启用")
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)

    const multiplier = wrapper.findComponent("[data-testid='target-stun-multiplier-input']")
    expect(multiplier.props("step")).toBe(5)
    await multiplier.vm.$emit("update:value", 175)
    const emitted = wrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.stunMultiplierPercent).toBe(175)
    expect(emitted).not.toHaveProperty("stunned")
  })

  it("locks preset defense values and only edits custom defense", async () => {
    const presetWrapper = mountPanel({ presetId: "normal-boss", defense: 953 })

    expect(presetWrapper.text()).toContain("953")
    expect(presetWrapper.find("[data-testid='target-defense-input']").exists()).toBe(false)

    const customWrapper = mountPanel({ presetId: "custom", defense: 1234 })

    const defenseInput = customWrapper.findComponent("[data-testid='target-defense-input']")
    expect(defenseInput.exists()).toBe(true)
    expect(defenseInput.props("step")).toBe(50)
    await defenseInput.vm.$emit("update:value", 1000)

    const emitted = customWrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.defense).toBe(1000)
  })

  it("copies preset defense when selecting a normal preset", async () => {
    const wrapper = mountPanel({ presetId: "normal-boss", defense: 1200 })
    const select = wrapper.findComponent("[data-testid='target-preset-select']")

    await select.vm.$emit("update:value", "normal-boss")

    const emitted = wrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.presetId).toBe("normal-boss")
    expect(emitted.defense).toBe(953)
  })

  it("keeps the original preset order and has no concrete Boss controls", () => {
    const wrapper = mountPanel()
    const select = wrapper.findComponent("[data-testid='target-preset-select']")

    expect(select.props("options").map((option: any) => option.label)).toEqual([
      "1588（彷徨猎手）",
      "476（低防怪如太初梦魇）",
      "953（正常boss）",
      "自定义",
    ])
    expect(wrapper.text()).not.toContain("具体 Boss")
    expect(wrapper.find("[data-testid='boss-profile-select']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='boss-encounter-select']").exists()).toBe(false)
  })
})
