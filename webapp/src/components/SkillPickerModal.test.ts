import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { nextTick } from "vue"
import SkillPickerModal from "@/components/SkillPickerModal.vue"

const skillCatalog = {
  id: "potential_agent",
  categories: [{
    id: "basic",
    label: { zhCN: "普通攻击" },
    moves: [
      {
        id: "normal",
        name: { zhCN: "常规招式" },
        rows: [{ id: "damage", label: { zhCN: "常规倍率" }, values: [100] }],
      },
      {
        id: "potential",
        name: { zhCN: "潜能招式" },
        requiresPotentialLevel: 1,
        rows: [{
          id: "extra",
          label: { zhCN: "潜能追加倍率" },
          requiresPotentialLevel: 1,
          eventCountRange: { min: 0, max: 6, default: 6 },
          values: [166.4],
        }],
      },
    ],
  }],
}

function mountPicker(potentialLevel: number) {
  return mount(SkillPickerModal, {
    attachTo: document.body,
    props: {
      show: false,
      skillCatalog,
      skillLevels: { basic: 1 },
      potentialLevel,
    },
    global: {
      stubs: {
        NModal: {
          props: ["show"],
          template: "<div v-if=\"show\"><slot /></div>",
        },
        NInput: { template: "<input />" },
        NSelect: { props: ["value", "options"], template: "<select />" },
        NTag: { template: "<span><slot /></span>" },
      },
    },
  })
}

describe("SkillPickerModal potential filtering", () => {
  it("hides P1 moves at P0 and exposes them at P1", async () => {
    const wrapper = mountPicker(0)
    await wrapper.setProps({ show: true })
    await nextTick()

    expect(document.body.textContent).toContain("常规招式")
    expect(document.body.textContent).not.toContain("潜能招式")

    await wrapper.setProps({ potentialLevel: 1 })
    await nextTick()
    expect(document.body.textContent).toContain("潜能招式")
    wrapper.unmount()
  })

  it("returns the authored count range with a potential multiplier row", async () => {
    const wrapper = mountPicker(1)
    await wrapper.setProps({ show: true })
    await nextTick()
    const potentialRow = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button.skill-row"))
      .find(button => button.textContent?.includes("潜能招式"))

    expect(potentialRow).toBeTruthy()
    potentialRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted("select")?.[0]?.[0]).toEqual(expect.objectContaining({
      skillMultiplier: 166.4,
      eventCountRange: { min: 0, max: 6, default: 6 },
    }))
    wrapper.unmount()
  })
})
