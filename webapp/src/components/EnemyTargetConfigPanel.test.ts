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

function mountPanel(targetConfig: any = {}) {
  return mount(EnemyTargetConfigPanel, {
    props: {
      damageElement: "ice",
      meta: {
        damageTargetPresets: [{ id: "normal-boss", name: { zhCN: "普通 Boss" }, defense: 953 }],
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

  it("locks preset defense values and only edits custom defense", async () => {
    const presetWrapper = mountPanel({ presetId: "normal-boss", defense: 953 })

    expect(presetWrapper.text()).toContain("953")
    expect(presetWrapper.find("[data-testid='target-defense-input']").exists()).toBe(false)

    const customWrapper = mountPanel({ presetId: "custom", defense: 1234 })

    const defenseInput = customWrapper.findComponent("[data-testid='target-defense-input']")
    expect(defenseInput.exists()).toBe(true)
    await defenseInput.vm.$emit("update:value", 1000)

    const emitted = customWrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.defense).toBe(1000)
  })

  it("copies preset defense when selecting a normal preset", async () => {
    const wrapper = mountPanel({ presetId: "custom", defense: 1200 })
    const select = wrapper.findComponent("[data-testid='target-preset-select']")

    await select.vm.$emit("update:value", "normal-boss")

    const emitted = wrapper.emitted("update:targetConfig")?.at(-1)?.[0] as any
    expect(emitted.presetId).toBe("normal-boss")
    expect(emitted.defense).toBe(953)
  })
})
