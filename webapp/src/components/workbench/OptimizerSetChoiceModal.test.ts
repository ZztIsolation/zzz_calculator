import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import OptimizerSetChoiceModal from "@/components/workbench/OptimizerSetChoiceModal.vue"

vi.mock("naive-ui", () => ({
  NModal: {
    props: ["show", "title"],
    emits: ["update:show"],
    template: '<section v-if="show"><h2>{{ title }}</h2><slot /><slot name="footer" /></section>',
  },
  NButton: {
    props: ["disabled", "type"],
    emits: ["click"],
    template: '<button type="button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}))

const sets = [
  { id: "woodpecker", name: { zhCN: "啄木鸟电音" } },
  { id: "chaos_jazz", name: { zhCN: "混沌爵士" } },
]

function mountModal(props: Record<string, any> = {}) {
  return mount(OptimizerSetChoiceModal, {
    props: {
      show: true,
      title: "选择限定 4 件套（可多选）",
      sets,
      initialIds: ["woodpecker"],
      committedIds: ["woodpecker"],
      requireSelection: true,
      emptySummary: "至少选择一套 4 件套",
      selectedSummary: (count: number) => `已选择 ${count} 套`,
      ...props,
    },
  })
}

const applyButton = (wrapper: any) => wrapper.findAll("button").find((button: any) => button.text() === "应用限制")!

describe("OptimizerSetChoiceModal", () => {
  it("starts from the initial ids and only enables apply after a real change", async () => {
    const wrapper = mountModal()
    const boxes = wrapper.findAll("input[type=checkbox]")
    expect(boxes.map(box => (box.element as HTMLInputElement).checked)).toEqual([true, false])
    expect(wrapper.text()).toContain("已选择 1 套")
    expect(applyButton(wrapper).attributes("disabled")).toBeDefined()

    await boxes[1]!.trigger("change")
    expect(wrapper.text()).toContain("已选择 2 套")
    await applyButton(wrapper).trigger("click")
    expect(wrapper.emitted("apply")?.[0]?.[0]).toEqual(["woodpecker", "chaos_jazz"])
  })

  it("requires at least one selection when configured and shows the empty summary", async () => {
    const wrapper = mountModal()
    await wrapper.findAll("input[type=checkbox]")[0]!.trigger("change")
    expect(wrapper.text()).toContain("至少选择一套 4 件套")
    expect(applyButton(wrapper).attributes("disabled")).toBeDefined()
  })

  it("allows an empty selection and descriptions for optional two-piece limits", async () => {
    const wrapper = mountModal({
      title: "选择额外 2 件套",
      initialIds: ["chaos_jazz"],
      committedIds: ["chaos_jazz"],
      requireSelection: false,
      describe: (set: any) => `${set.id} 的 2 件套效果`,
      emptySummary: "自动匹配任意 2 件套",
      selectedSummary: (count: number) => `已选择 ${count} 个额外 2 件套`,
    })
    expect(wrapper.text()).toContain("chaos_jazz 的 2 件套效果")
    await wrapper.findAll("input[type=checkbox]")[1]!.trigger("change")
    expect(wrapper.text()).toContain("自动匹配任意 2 件套")
    await applyButton(wrapper).trigger("click")
    expect(wrapper.emitted("apply")?.[0]?.[0]).toEqual([])
  })

  it("discards the draft on cancel and resets it when reopened", async () => {
    const wrapper = mountModal()
    await wrapper.findAll("input[type=checkbox]")[1]!.trigger("change")
    await wrapper.findAll("button").find(button => button.text() === "取消")!.trigger("click")
    expect(wrapper.emitted("update:show")?.[0]).toEqual([false])
    expect(wrapper.emitted("apply")).toBeUndefined()

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.findAll("input[type=checkbox]").map(box => (box.element as HTMLInputElement).checked)).toEqual([true, false])
  })
})
