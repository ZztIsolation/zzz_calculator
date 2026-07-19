import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import OptimizerResultSelector from "@/components/OptimizerResultSelector.vue"

vi.mock("naive-ui", () => ({
  NSlider: {
    name: "NSlider",
    inheritAttrs: false,
    props: ["value", "min", "max", "step", "marks", "disabled", "formatTooltip"],
    emits: ["update:value"],
    template: "<input v-bind=\"$attrs\" type=\"range\" :value=\"value\" :min=\"min\" :max=\"max\" :step=\"step\" :disabled=\"disabled\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NInputNumber: {
    name: "NInputNumber",
    inheritAttrs: false,
    props: ["value", "min", "max", "step", "precision", "disabled", "buttonPlacement", "size"],
    emits: ["update:value"],
    template: `
      <div v-bind="$attrs" :data-button-placement="buttonPlacement">
        <button data-testid="rank-minus" :disabled="disabled || value <= min" @click="$emit('update:value', value - step)">-</button>
        <input :value="value" :disabled="disabled" @input="$emit('update:value', Number($event.target.value))">
        <button data-testid="rank-plus" :disabled="disabled || value >= max" @click="$emit('update:value', value + step)">+</button>
      </div>
    `,
  },
}))

const results = [
  { rank: 1, score: 1000 },
  { rank: 2, score: 978 },
  { rank: 3, score: 900 },
]
const topTenResults = Array.from({ length: 10 }, (_, index) => ({
  rank: index + 1,
  score: 1000 - index * 10,
}))

function mountSelector(modelValue = 1, resultOptions = results) {
  return mount(OptimizerResultSelector, {
    props: {
      modelValue,
      results: resultOptions,
    },
  })
}

describe("OptimizerResultSelector", () => {
  it("shows the selected result relative to the best score", async () => {
    const wrapper = mountSelector()

    expect(wrapper.text()).toContain("第 1 套 · 100% · 评分 1,000")

    await wrapper.setProps({ modelValue: 2 })

    expect(wrapper.text()).toContain("第 2 套 · 97.8% · 评分 978")
    expect(wrapper.get("[role='progressbar']").attributes("aria-valuenow")).toBe("97.8")
  })

  it("emits normalized ranks from the slider, number input, and step buttons", async () => {
    const wrapper = mountSelector(2)

    await wrapper.get("[data-testid='optimizer-result-slider']").setValue(1)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1])

    await wrapper.get("[data-testid='optimizer-result-rank-input'] input").setValue(2.6)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([3])

    await wrapper.get("[data-testid='rank-plus']").trigger("click")
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([3])
    expect(wrapper.get("[data-testid='optimizer-result-rank-input']").attributes("data-button-placement")).toBe("both")

    await wrapper.setProps({ modelValue: 3 })
    expect(wrapper.get("[data-testid='rank-plus']").attributes("disabled")).toBeDefined()
  })

  it("allows selecting the tenth result through every rank control", async () => {
    const wrapper = mountSelector(9, topTenResults)

    expect(wrapper.get("[data-testid='optimizer-result-slider']").attributes("max")).toBe("10")

    await wrapper.get("[data-testid='optimizer-result-slider']").setValue(10)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([10])

    await wrapper.get("[data-testid='optimizer-result-rank-input'] input").setValue(10)
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([10])

    await wrapper.get("[data-testid='rank-plus']").trigger("click")
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([10])

    await wrapper.setProps({ modelValue: 10 })
    expect(wrapper.get("[data-testid='rank-plus']").attributes("disabled")).toBeDefined()
  })

  it("disables a single result and returns to the first rank when results shrink", async () => {
    const wrapper = mountSelector(3)

    await wrapper.setProps({ results: [
      { rank: 1, score: 1000 },
      { rank: 2, score: 978 },
    ] })

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1])

    await wrapper.setProps({ modelValue: 1, results: [{ rank: 1, score: 1000 }] })
    expect(wrapper.get("[data-testid='optimizer-result-slider']").attributes("disabled")).toBeDefined()
    expect(wrapper.get("[data-testid='optimizer-result-rank-input'] input").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("第 1 套 · 100%")
  })

  it("does not render for an invalid best score", () => {
    const wrapper = mountSelector(1, [{ rank: 1, score: 0 }])

    expect(wrapper.find(".optimizer-result-selector").exists()).toBe(false)
    expect(wrapper.text()).not.toContain("NaN")
    expect(wrapper.text()).not.toContain("Infinity")
  })
})
