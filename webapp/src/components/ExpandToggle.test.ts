import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import ExpandToggle from "@/components/ExpandToggle.vue"

function mountToggle(props: Record<string, any> = {}) {
  return mount(ExpandToggle, {
    props: { expanded: false, ...props },
  })
}

describe("ExpandToggle", () => {
  it("emits toggle and exposes aria-expanded / is-expanded", async () => {
    const wrapper = mountToggle()
    const button = wrapper.get("button")
    expect(button.attributes("aria-expanded")).toBe("false")
    expect(button.classes()).not.toContain("is-expanded")

    await button.trigger("click")
    expect(wrapper.emitted("toggle")).toHaveLength(1)

    await wrapper.setProps({ expanded: true })
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("true")
    expect(wrapper.get("button").classes()).toContain("is-expanded")
  })

  it("switches between label and expandedLabel", async () => {
    const wrapper = mountToggle({ label: "展开", expandedLabel: "收起" })
    expect(wrapper.text()).toContain("展开")
    await wrapper.setProps({ expanded: true })
    expect(wrapper.text()).toContain("收起")
  })

  it("stays icon-only without a label", () => {
    const wrapper = mountToggle()
    expect(wrapper.get("button").classes()).toContain("is-icon-only")
    expect(wrapper.find(".expand-toggle-label").exists()).toBe(false)
  })

  it("passes the icon size through", () => {
    const wrapper = mountToggle({ size: 20 })
    expect(wrapper.find("svg").attributes("width")).toBe("20")
  })
})
