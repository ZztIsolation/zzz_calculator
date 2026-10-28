import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { describe, expect, it } from "vitest"
import WorkbenchSegmentedControl from "./WorkbenchSegmentedControl.vue"

const options = [
  { label: "自选", value: "manual" },
  { label: "优化结果", value: "optimized", disabled: true },
  { label: "已有套装", value: "sets" },
]

describe("WorkbenchSegmentedControl", () => {
  it("renders an accessible radio group and emits pointer selection", async () => {
    const wrapper = mount(WorkbenchSegmentedControl, {
      props: { modelValue: "manual", options, ariaLabel: "驱动盘方案来源" },
    })

    expect(wrapper.get("[role=radiogroup]").attributes("aria-label")).toBe("驱动盘方案来源")
    const radios = wrapper.findAll("[role=radio]")
    expect(radios.map(radio => radio.attributes("aria-checked"))).toEqual(["true", "false", "false"])
    expect(radios[1]!.attributes("disabled")).toBeDefined()

    await radios[2]!.trigger("click")
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["sets"])
  })

  it("moves with arrow keys, skips disabled options, and focuses the next choice", async () => {
    const wrapper = mount(WorkbenchSegmentedControl, {
      props: { modelValue: "manual", options },
      attachTo: document.body,
    })
    const radios = wrapper.findAll("[role=radio]")

    await radios[0]!.trigger("keydown", { key: "ArrowRight" })
    await nextTick()

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["sets"])
    expect(document.activeElement).toBe(radios[2]!.element)
    wrapper.unmount()
  })

  it("moves the indicator to the selected option", async () => {
    const wrapper = mount(WorkbenchSegmentedControl, {
      props: { modelValue: "manual", options },
    })

    await wrapper.setProps({ modelValue: "sets" })
    expect(wrapper.get(".workbench-segmented-control__indicator").attributes("style")).toContain("translateX(200%)")
  })
})
