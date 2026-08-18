import { defineComponent } from "vue"
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  binding: null as any,
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  catalogLoad: vi.fn(async () => {}),
  buildInitialize: vi.fn(),
  inventoryLoad: vi.fn(async () => {}),
  importEnkaShowcase: vi.fn(),
  planEnkaImport: vi.fn(),
  applyEnkaImportPlan: vi.fn(async () => {}),
  recoverPendingEnkaImport: vi.fn(async () => "none"),
  undoLastEnkaImport: vi.fn(async () => {}),
  hasCommittedEnkaUndo: vi.fn(async () => false),
}))

vi.mock("naive-ui", async importOriginal => ({
  ...(await importOriginal<any>()),
  useMessage: () => mocks.message,
}))

vi.mock("@/stores/catalog", () => ({
  useCatalogStore: () => ({ load: mocks.catalogLoad, catalog: {}, meta: {} }),
}))
vi.mock("@/stores/build", () => ({ useBuildStore: () => ({ initialize: mocks.buildInitialize }) }))
vi.mock("@/stores/inventory", () => ({ useInventoryStore: () => ({ load: mocks.inventoryLoad }) }))
vi.mock("@/utils/enkaImport", () => ({
  currentEnkaBinding: vi.fn(async () => ({ ownerId: "default", binding: mocks.binding })),
  importEnkaShowcase: mocks.importEnkaShowcase,
  planEnkaImport: mocks.planEnkaImport,
  applyEnkaImportPlan: mocks.applyEnkaImportPlan,
}))
vi.mock("@runtime/enka-import-transaction", () => ({
  recoverPendingEnkaImport: mocks.recoverPendingEnkaImport,
  undoLastEnkaImport: mocks.undoLastEnkaImport,
  hasCommittedEnkaUndo: mocks.hasCommittedEnkaUndo,
}))

import ImportView from "@/views/ImportView.vue"

const ButtonStub = defineComponent({
  name: "NButton",
  inheritAttrs: false,
  props: { disabled: Boolean, loading: Boolean },
  emits: ["click"],
  template: `<button v-bind="$attrs" :disabled="disabled" @click="$emit('click')"><slot name="icon"/><slot/></button>`,
})
const InputStub = defineComponent({
  name: "NInput",
  inheritAttrs: false,
  props: { value: String, disabled: Boolean, inputProps: Object },
  emits: ["update:value", "keyup"],
  template: `<input v-bind="{ ...$attrs, ...inputProps }" :value="value" :disabled="disabled" @input="$emit('update:value', $event.target.value)" @keyup="$emit('keyup', $event)"/>`,
})
const CheckboxStub = defineComponent({
  name: "NCheckbox",
  inheritAttrs: false,
  props: { checked: Boolean, disabled: Boolean },
  emits: ["update:checked"],
  template: `<input v-bind="$attrs" type="checkbox" :checked="checked" :disabled="disabled" @change="$emit('update:checked', $event.target.checked)"/>`,
})
const CardStub = defineComponent({
  name: "NCard",
  template: `<section><header><slot name="header"/></header><slot/><footer><slot name="footer"/></footer></section>`,
})
const AlertStub = defineComponent({
  name: "NAlert",
  props: { title: String },
  template: `<div role="alert">{{ title }}<slot/></div>`,
})
const ModalStub = defineComponent({
  name: "NModal",
  props: { show: Boolean },
  emits: ["update:show"],
  template: `<div v-if="show" data-modal><slot/></div>`,
})
const PassStub = defineComponent({ name: "PassStub", template: `<div><slot/></div>` })

function mountView() {
  return mount(ImportView, {
    global: {
      stubs: {
        NButton: ButtonStub,
        Button: ButtonStub,
        NInput: InputStub,
        Input: InputStub,
        NCheckbox: CheckboxStub,
        Checkbox: CheckboxStub,
        NCard: CardStub,
        Card: CardStub,
        NAlert: AlertStub,
        Alert: AlertStub,
        NModal: ModalStub,
        Modal: ModalStub,
        NSpin: PassStub,
        Spin: PassStub,
        NTag: PassStub,
        Tag: PassStub,
        RouterLink: { template: `<a><slot/></a>` },
      },
    },
  })
}

function button(wrapper: any, text: string) {
  const match = wrapper.findAll("button").find((candidate: any) => candidate.text().includes(text))
  if (!match) throw new Error(`Button not found: ${text}`)
  return match
}

const agents = [
  {
    agentId: "hoshimi_miyabi",
    agentName: "星见雅",
    agentLevel: 60,
    cinemaLevel: 6,
    coreSkillLevel: "F",
    skillLevels: { basic: 16 },
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  },
  {
    agentId: "aria",
    agentName: "爱芮",
    agentLevel: 60,
    cinemaLevel: 0,
    coreSkillLevel: "A",
    skillLevels: { basic: 12 },
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  },
]

beforeEach(() => {
  mocks.binding = null
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockClear" in value) (value as any).mockClear()
  }
  for (const value of Object.values(mocks.message)) value.mockClear()
  mocks.importEnkaShowcase.mockResolvedValue({
    mappedAgents: agents,
    skippedAgents: [],
    warnings: [],
    ttlSeconds: 45,
  })
  mocks.planEnkaImport.mockResolvedValue({
    uid: "1302309616",
    ownerId: "default",
    agents: agents.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      changes: [{ field: "agentLevel", label: "角色等级", before: "40", after: "60" }],
    })),
    warnings: [],
    changeCount: 2,
  })
  mocks.applyEnkaImportPlan.mockResolvedValue({ transactionId: "tx" })
  mocks.recoverPendingEnkaImport.mockResolvedValue("none")
  mocks.hasCommittedEnkaUndo.mockResolvedValue(false)
})

describe("ImportView", () => {
  it("requires preview before committing a frozen multi-agent selection", async () => {
    const wrapper = mountView()
    await flushPromises()
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    await uidInput.setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("星见雅")
    expect(wrapper.text()).toContain("爱芮")
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.get('input[aria-label="选择导入 星见雅"]')).toBeTruthy()
    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()

    await button(wrapper, "预览更改（2）").trigger("click")
    await flushPromises()
    expect(mocks.planEnkaImport).toHaveBeenCalledWith("1302309616", expect.arrayContaining([
      expect.objectContaining({ agentId: "hoshimi_miyabi" }),
      expect.objectContaining({ agentId: "aria" }),
    ]))
    expect(wrapper.get("[data-modal]").text()).toContain("2 个角色 / 2 项更改")
    expect(uidInput.attributes("disabled")).toBeDefined()

    await button(wrapper, "确认导入").trigger("click")
    await flushPromises()
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(mocks.inventoryLoad).toHaveBeenCalled()
    expect(mocks.buildInitialize).toHaveBeenCalled()
    expect(mocks.message.success).toHaveBeenCalledWith("已导入 2 个角色，库存与配置已同步。")
  })

  it("blocks a different UID for an already bound Calculator account", async () => {
    mocks.binding = { uid: "1302309616" }
    const wrapper = mountView()
    await flushPromises()
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    expect((uidInput.element as HTMLInputElement).value).toBe("1302309616")
    await uidInput.setValue("1300027938")
    expect(wrapper.text()).toContain("已绑定 UID 1302309616")
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeDefined()
    expect(mocks.importEnkaShowcase).not.toHaveBeenCalled()
  })

  it("allows a failed showcase request to be retried", async () => {
    mocks.importEnkaShowcase
      .mockRejectedValueOnce(new Error("temporary upstream failure"))
      .mockResolvedValueOnce({ mappedAgents: agents, skippedAgents: [], warnings: [], ttlSeconds: 30 })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("temporary upstream failure")

    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    expect(mocks.importEnkaShowcase).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain("星见雅")
  })

  it("freezes diagnostics in preview and ignores duplicate confirmation", async () => {
    mocks.importEnkaShowcase.mockResolvedValue({
      mappedAgents: agents,
      skippedAgents: [{ enkaId: "999", name: "未收录角色", reason: "目录未映射" }],
      warnings: ["服务端映射警告"],
      ttlSeconds: 30,
    })
    let resolveApply: (value: any) => void = () => {}
    mocks.applyEnkaImportPlan.mockImplementation(() => new Promise(resolve => { resolveApply = resolve }))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await button(wrapper, "预览更改（2）").trigger("click")
    await flushPromises()
    expect(wrapper.get("[data-modal]").text()).toContain("未收录角色：目录未映射")
    expect(wrapper.get("[data-modal]").text()).toContain("服务端映射警告")

    const confirm = button(wrapper, "确认导入")
    await confirm.trigger("click")
    await confirm.trigger("click")
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    resolveApply({ transactionId: "tx" })
    await flushPromises()
  })
})
