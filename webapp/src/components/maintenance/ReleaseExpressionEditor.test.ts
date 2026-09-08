import { mount } from "@vue/test-utils"
import { NSelect } from "naive-ui"
import ReleaseExpressionEditor from "./ReleaseExpressionEditor.vue"

describe("ReleaseExpressionEditor", () => {
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
