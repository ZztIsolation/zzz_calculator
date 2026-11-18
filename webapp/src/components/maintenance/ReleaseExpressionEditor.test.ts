import { mount } from "@vue/test-utils"
import { NInputNumber, NSelect, NSwitch } from "naive-ui"
import { reactive } from "vue"
import ReleaseExpressionEditor from "./ReleaseExpressionEditor.vue"

describe("ReleaseExpressionEditor", () => {
  it("edits all seven cinema values and preserves them when reopened", async () => {
    const node = reactive<any>({ kind: "constant", value: 25, unit: "percent" })
    const wrapper = mount(ReleaseExpressionEditor, { props: { node } })
    await wrapper.findComponent(NSwitch).vm.$emit("update:value", true)
    expect(node.cinemaValues).toEqual(Array(7).fill(25))
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs).toHaveLength(7)
    for (let level = 2; level <= 6; level++) await inputs[level]!.vm.$emit("update:value", 35)
    await inputs[0]!.vm.$emit("update:value", 20)
    expect(node.value).toBe(20)
    const saved = JSON.parse(JSON.stringify(node))
    wrapper.unmount()
    const reopened = mount(ReleaseExpressionEditor, { props: { node: reactive(saved), disabled: true } })
    expect(reopened.findAllComponents(NInputNumber).map(input => input.props("value"))).toEqual([20, 25, 35, 35, 35, 35, 35])
    expect(reopened.findAllComponents(NInputNumber).every(input => input.props("disabled"))).toBe(true)
    await reopened.setProps({ disabled: false })
    await reopened.findComponent(NSwitch).vm.$emit("update:value", false)
    expect(reopened.props("node")).not.toHaveProperty("cinemaValues")
    expect(reopened.findComponent(NInputNumber).props("value")).toBe(20)
    reopened.unmount()
  })
  it("creates the supported Release event modifier leaf", async () => {
    const node: Record<string, unknown> = { kind: "constant", value: 1, unit: "raw" }
    const wrapper = mount(ReleaseExpressionEditor, {
      props: { node },
      global: {
        stubs: {
          NInput: true,
          NInputNumber: true,
          NButton: true,
        },
      },
    })

    const selectComponents = () => wrapper.findAllComponents(NSelect)
    const nodeTypeSelect = selectComponents().find(component =>
      component.props("options")?.some((option: any) => option.value === "releaseModifier"),
    )
    expect(nodeTypeSelect).toBeTruthy()

    await nodeTypeSelect!.vm.$emit("update:value", "releaseModifier")
    await wrapper.vm.$nextTick()

    expect(node).toEqual({
      kind: "releaseModifier",
      modifier: "releaseProficiencyYieldBonus",
      unit: "decimal",
    })
    expect(wrapper.text()).toContain("事件修正")
    const modifierSelect = selectComponents().find(component =>
      component.props("options")?.some((option: any) => option.value === "releaseProficiencyYieldBonus"),
    )
    expect(modifierSelect?.props("value")).toBe("releaseProficiencyYieldBonus")
    expect(wrapper.emitted("change")).toHaveLength(1)
  })
})
