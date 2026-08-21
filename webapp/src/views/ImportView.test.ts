import { defineComponent } from "vue"
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  binding: null as any,
  history: { version: 1, backfillVersion: 1, byAgent: {} } as any,
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  catalogLoad: vi.fn(async () => {}),
  buildInitialize: vi.fn(),
  inventoryLoad: vi.fn(async () => {}),
  accountEnsureLoaded: vi.fn(async () => {}),
  accountStore: null as any,
  currentEnkaBinding: vi.fn(),
  backfillCurrentEnkaHistory: vi.fn(async () => ({ backfilled: false })),
  importEnkaShowcase: vi.fn(),
  planEnkaImport: vi.fn(),
  planEnkaRebind: vi.fn(),
  applyEnkaImportPlan: vi.fn(async () => {}),
  applyPlannedEnkaRebind: vi.fn(async () => {}),
  recoverPendingEnkaImport: vi.fn(async () => "none"),
  undoLastEnkaImport: vi.fn(async () => {}),
  hasCommittedEnkaUndo: vi.fn(async () => false),
}))

vi.mock("naive-ui", async importOriginal => ({
  ...(await importOriginal<any>()),
  useMessage: () => mocks.message,
}))

vi.mock("@/stores/catalog", () => ({
  useCatalogStore: () => ({
    load: mocks.catalogLoad,
    catalog: {},
    meta: {},
    error: "",
    displayAgents: [
      { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
      { id: "aria", name: { zhCN: "爱芮" } },
    ],
    displayWEngines: [{ id: "tenfold_starforge", name: { zhCN: "十方锻星" } }],
    displayDriveDiscSets: [],
  }),
}))
vi.mock("@/stores/build", () => ({ useBuildStore: () => ({ initialize: mocks.buildInitialize }) }))
vi.mock("@/stores/inventory", () => ({ useInventoryStore: () => ({ load: mocks.inventoryLoad, loadouts: [], error: "" }) }))
vi.mock("@/stores/account", async () => {
  const { reactive } = await import("vue")
  const store: any = reactive({
    loadState: "ready",
    error: "",
    currentOwnerId: "default",
    owners: [{ id: "default", label: "myself" }],
    ensureLoaded: mocks.accountEnsureLoaded,
  })
  store.ownerLabelById = (ownerId: string) => String(store.owners.find((owner: any) => owner.id === ownerId)?.label ?? "").trim() || null
  mocks.accountStore = store
  return { useAccountStore: () => store }
})
vi.mock("@/utils/enkaImport", () => ({
  backfillCurrentEnkaHistory: mocks.backfillCurrentEnkaHistory,
  currentEnkaBinding: mocks.currentEnkaBinding,
  importEnkaShowcase: mocks.importEnkaShowcase,
  planEnkaImport: mocks.planEnkaImport,
  planEnkaRebind: mocks.planEnkaRebind,
  applyEnkaImportPlan: mocks.applyEnkaImportPlan,
  applyPlannedEnkaRebind: mocks.applyPlannedEnkaRebind,
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
  props: { title: String },
  template: `<section><header>{{ title }}<slot name="header"/></header><slot/><footer><slot name="footer"/></footer></section>`,
})
const AlertStub = defineComponent({
  name: "NAlert",
  props: { title: String },
  template: `<div role="alert">{{ title }}<slot/><slot name="action"/></div>`,
})
const ModalStub = defineComponent({
  name: "NModal",
  props: { show: Boolean, maskClosable: Boolean, closeOnEsc: Boolean },
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

function buttonWithin(wrapper: any, text: string) {
  const match = wrapper.findAll("button").find((candidate: any) => candidate.text().includes(text))
  if (!match) throw new Error(`Button not found: ${text}`)
  return match
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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

function historyRecord(agent: any, overrides: any = {}) {
  return {
    agentId: agent.agentId,
    agentName: agent.agentName,
    uid: "1302309616",
    completeness: "full",
    firstImportedAt: "2026-08-18T01:00:00.000Z",
    lastImportedAt: "2026-08-18T02:00:00.000Z",
    snapshot: {
      agentLevel: agent.agentLevel,
      cinemaLevel: agent.cinemaLevel,
      coreSkillLevel: agent.coreSkillLevel === "F" ? 6 : 1,
      wEngine: null,
      driveDiscCount: 0,
      driveDiscSourceCount: agent.driveDiscSourceCount,
    },
    ...overrides,
  }
}

beforeEach(() => {
  mocks.binding = null
  mocks.history = { version: 1, backfillVersion: 1, byAgent: {} }
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockClear" in value) (value as any).mockClear()
  }
  for (const value of Object.values(mocks.message)) value.mockClear()
  Object.assign(mocks.accountStore, {
    loadState: "ready",
    error: "",
    currentOwnerId: "default",
    owners: [{ id: "default", label: "myself" }],
  })
  mocks.accountEnsureLoaded.mockResolvedValue({
    currentOwnerId: "default",
    owners: [{ id: "default", label: "myself" }],
  })
  mocks.currentEnkaBinding.mockImplementation(async () => ({
    ownerId: mocks.accountStore.currentOwnerId,
    binding: mocks.binding,
    history: JSON.parse(JSON.stringify(mocks.history)),
    rebindEligibility: mocks.binding
      ? { allowed: true, uid: mocks.binding.uid, code: null }
      : { allowed: false, uid: null, code: "ENKA_NOT_BOUND" },
  }))
  mocks.importEnkaShowcase.mockResolvedValue({
    uid: "1302309616",
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
  mocks.planEnkaRebind.mockResolvedValue({
    kind: "enka-rebind",
    uid: "1300027938",
    previousUid: "1302309616",
    ownerId: "default",
    agents: [{
      agentId: "aria",
      agentName: "爱芮",
      changes: [{ field: "agentLevel", label: "角色等级", before: "40", after: "60" }],
    }],
    warnings: [],
    blockingErrors: [],
    hasBlockingErrors: false,
    hasUnresolvedConflicts: false,
    changeCount: 1,
    rebind: {
      previousUid: "1302309616",
      nextUid: "1300027938",
      deletedDriveDiscs: 1,
      detachedDriveDiscs: 1,
      deletedLoadouts: 1,
      restoredConfigFields: 2,
      preservedUserFields: 1,
      deletedDriveDiscIds: ["old-enka-disc"],
      detachedDriveDiscIds: ["shared-disc"],
      deletedLoadoutIds: ["old-enka-loadout"],
      restoredFields: [{ agentId: "hoshimi_miyabi", field: "agentLevel" }],
      preservedFields: [{ agentId: "hoshimi_miyabi", field: "cinemaLevel" }],
      cleanedReferenceAgentIds: ["hoshimi_miyabi"],
    },
  })
  mocks.applyPlannedEnkaRebind.mockResolvedValue({ transactionId: "tx-rebind" })
  mocks.recoverPendingEnkaImport.mockResolvedValue("none")
  mocks.hasCommittedEnkaUndo.mockResolvedValue(false)
})

describe("ImportView", () => {
  it("restores accumulated imported characters separately after a page refresh", async () => {
    mocks.binding = { uid: "1302309616" }
    mocks.history = {
      version: 1,
      backfillVersion: 1,
      byAgent: {
        hoshimi_miyabi: historyRecord(agents[0]),
        aria: historyRecord(agents[1], {
          completeness: "partial",
          firstImportedAt: null,
          lastImportedAt: null,
          backfilledAt: "2026-08-18T03:00:00.000Z",
          snapshot: { driveDiscCount: 4, driveDiscSourceCount: null },
        }),
      },
    }

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain("已导入角色（2）")
    expect(wrapper.text()).toContain("星见雅")
    expect(wrapper.text()).toContain("最近导入 2026-08-18")
    expect(wrapper.text()).toContain("爱芮")
    expect(wrapper.text()).toContain("历史记录（详情不完整） / 驱动盘 4/6")
    expect(wrapper.text()).toContain("导入时间不可确认")
    expect(wrapper.text()).not.toContain("本次读取角色")
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it("separates this showcase read and marks characters already in history", async () => {
    mocks.binding = { uid: "1302309616" }
    mocks.history = {
      version: 1,
      backfillVersion: 1,
      byAgent: { hoshimi_miyabi: historyRecord(agents[0]) },
    }
    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("已导入角色（1）")
    expect(wrapper.text()).toContain("本次读取角色（2）")
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    const miyabiRow = wrapper.findAll(".agent-row").find(row => row.text().includes("星见雅") && row.find('input[type="checkbox"]').exists())
    expect(miyabiRow?.text()).toContain("已导入")
    const ariaRow = wrapper.findAll(".agent-row").find(row => row.text().includes("爱芮") && row.find('input[type="checkbox"]').exists())
    expect(ariaRow?.text()).not.toContain("已导入")
  })

  it("refreshes imported history after commit while keeping the current read", async () => {
    mocks.applyEnkaImportPlan.mockImplementationOnce(async () => {
      mocks.history = {
        version: 1,
        backfillVersion: 1,
        byAgent: {
          hoshimi_miyabi: historyRecord(agents[0]),
          aria: historyRecord(agents[1]),
        },
      }
      return { transactionId: "tx-history" }
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("已导入角色（2）")
    expect(wrapper.text()).toContain("本次读取角色（2）")
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
  })

  it("reloads the persistent history for the newly selected account", async () => {
    const histories: Record<string, any> = {
      default: { version: 1, backfillVersion: 1, byAgent: { hoshimi_miyabi: historyRecord(agents[0]) } },
      alt: { version: 1, backfillVersion: 1, byAgent: { aria: historyRecord(agents[1]) } },
    }
    mocks.accountStore.owners = [
      { id: "default", label: "myself" },
      { id: "alt", label: "second" },
    ]
    mocks.currentEnkaBinding.mockImplementation(async () => ({
      ownerId: mocks.accountStore.currentOwnerId,
      binding: { uid: "1302309616" },
      history: histories[mocks.accountStore.currentOwnerId],
    }))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain("星见雅")
    expect(wrapper.text()).not.toContain("爱芮")

    mocks.accountStore.currentOwnerId = "alt"
    await flushPromises()
    expect(wrapper.text()).toContain("当前账号：second")
    expect(wrapper.text()).toContain("爱芮")
    expect(wrapper.text()).not.toContain("星见雅")
  })

  it("shows import guidance and can commit directly without opening the preview", async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("输入游戏 UID，读取公开展柜中的角色、音擎和驱动盘")
    expect(wrapper.text()).toContain("展柜更新后请等待1~2分钟再重新读取")
    expect(wrapper.text()).not.toContain("缓存剩余")
    expect(wrapper.text()).toContain("会覆盖：角色等级、影画、技能、成功映射的音擎、展柜佩戴套装和自选槽位")
    expect(wrapper.text()).toContain("会保留：Buff、伤害事件、敌人设置、优化设置及用户自定义套装")
    const resultButtons = wrapper.get(".list-actions").findAll("button")
    expect(resultButtons).toHaveLength(2)
    expect(resultButtons[0].text()).toContain("确认导入")
    expect(resultButtons[1].text()).toContain("预览更改（2 个角色）")

    await resultButtons[0].trigger("click")
    await flushPromises()
    expect(mocks.planEnkaImport).toHaveBeenCalledWith("1302309616", expect.arrayContaining([
      expect.objectContaining({ agentId: "hoshimi_miyabi", sourceUid: "1302309616" }),
      expect.objectContaining({ agentId: "aria", sourceUid: "1302309616" }),
    ]), {})
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(wrapper.find("[data-modal]").exists()).toBe(false)
    expect(mocks.message.success).toHaveBeenCalledWith("已导入 2 个角色，库存与配置已同步。")
  })

  it("freezes a multi-agent selection through the preview before committing", async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get("h1").text()).toBe("展柜数据导入")
    expect(wrapper.text()).toContain("当前账号：myself")
    expect(wrapper.text()).not.toContain("当前账号：default")
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    await uidInput.setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("星见雅")
    expect(wrapper.text()).toContain("爱芮")
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.get('input[aria-label="选择导入 星见雅"]')).toBeTruthy()
    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()

    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()
    expect(wrapper.get("[data-modal]").text()).toContain("确认展柜数据导入")
    expect(mocks.planEnkaImport).toHaveBeenCalledWith("1302309616", expect.arrayContaining([
      expect.objectContaining({ agentId: "hoshimi_miyabi" }),
      expect.objectContaining({ agentId: "aria" }),
    ]), {})
    expect(wrapper.get("[data-modal]").text()).toContain("2 个角色 / 2 项更改")
    expect(uidInput.attributes("disabled")).toBeDefined()

    await buttonWithin(wrapper.get("[data-modal]"), "确认导入").trigger("click")
    await flushPromises()
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(mocks.inventoryLoad).toHaveBeenCalled()
    expect(mocks.buildInitialize).toHaveBeenCalled()
    expect(mocks.message.success).toHaveBeenCalledWith("已导入 2 个角色，库存与配置已同步。")
  })

  it("does not submit a direct import twice while the transaction is pending", async () => {
    let resolveApply: (value: any) => void = () => {}
    mocks.applyEnkaImportPlan.mockImplementation(() => new Promise(resolve => { resolveApply = resolve }))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    const direct = wrapper.get(".list-actions").findAll("button")[0]
    await direct.trigger("click")
    await flushPromises()
    await direct.trigger("click")
    expect(mocks.planEnkaImport).toHaveBeenCalledOnce()
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(direct.attributes("disabled")).toBeDefined()

    resolveApply({ transactionId: "tx" })
    await flushPromises()
  })

  it("blocks direct import when the generated plan has unresolved conflicts", async () => {
    mocks.planEnkaImport.mockResolvedValueOnce({
      uid: "1302309616",
      ownerId: "default",
      agents,
      conflicts: [{ key: "disc-conflict" }],
      hasUnresolvedConflicts: true,
      changeCount: 1,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()
    expect(mocks.message.warning).toHaveBeenCalledWith(expect.stringContaining("请使用“预览更改”处理"))
    expect(wrapper.text()).toContain("请使用“预览更改”处理")
  })

  it("invalidates loaded characters as soon as the UID changes", async () => {
    const wrapper = mountView()
    await flushPromises()
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    await uidInput.setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("星见雅")

    await uidInput.setValue("1300027938")
    await flushPromises()

    expect(wrapper.text()).toContain("UID 已变化，请重新读取展柜")
    expect(wrapper.text()).not.toContain("星见雅")
    expect(wrapper.find(".list-actions").exists()).toBe(false)
    expect(mocks.planEnkaImport).not.toHaveBeenCalled()
  })

  it("invalidates loaded characters as soon as the Calculator account changes", async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("星见雅")

    mocks.accountStore.owners = [
      { id: "default", label: "myself" },
      { id: "alt", label: "second" },
    ]
    mocks.accountStore.currentOwnerId = "alt"
    await flushPromises()

    expect(wrapper.text()).toContain("当前账号已切换，请重新读取展柜")
    expect(wrapper.text()).not.toContain("星见雅")
    expect(mocks.planEnkaImport).not.toHaveBeenCalled()
  })

  it("discards a delayed preview plan after the Calculator account changes", async () => {
    const pendingPlan = deferred<any>()
    mocks.planEnkaImport.mockImplementationOnce(() => pendingPlan.promise)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")

    mocks.accountStore.owners = [
      { id: "default", label: "myself" },
      { id: "alt", label: "second" },
    ]
    mocks.accountStore.currentOwnerId = "alt"
    await flushPromises()
    pendingPlan.resolve({
      uid: "1302309616",
      ownerId: "alt",
      agents: [],
      warnings: [],
      conflicts: [],
      blockingErrors: [],
      changeCount: 0,
    })
    await flushPromises()

    expect(wrapper.find("[data-modal]").exists()).toBe(false)
    expect(wrapper.text()).toContain("当前账号已切换，请重新读取展柜")
    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()
  })

  it("rejects a response whose normalized UID differs from the requested UID", async () => {
    mocks.importEnkaShowcase.mockResolvedValueOnce({
      uid: "1300027938",
      mappedAgents: agents,
      skippedAgents: [],
      warnings: [],
      ttlSeconds: 30,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Enka 返回的 UID 与本次读取不一致")
    expect(wrapper.text()).not.toContain("星见雅")
    expect(mocks.planEnkaImport).not.toHaveBeenCalled()
  })

  it("shows blocking identity errors persistently and disables preview confirmation", async () => {
    mocks.planEnkaImport.mockResolvedValue({
      uid: "1302309616",
      ownerId: "default",
      agents: [],
      conflicts: [],
      blockingErrors: [{ code: "ENKA_EQUIPMENT_IDENTITY_CONFLICT", message: "同一 Equipment UID secret-123 出现在多个槽位。" }],
      hasBlockingErrors: true,
      hasUnresolvedConflicts: true,
      warnings: [],
      changeCount: 0,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("同一驱动盘身份对应了互相矛盾的角色、槽位或套装")
    expect(wrapper.text()).not.toContain("secret-123")
    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()

    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()
    const modal = wrapper.get("[data-modal]")
    expect(modal.text()).toContain("同一驱动盘身份对应了互相矛盾的角色、槽位或套装")
    expect(buttonWithin(modal, "确认导入").attributes("disabled")).toBeDefined()
  })

  it("does not close the preview while a conflict replan is pending", async () => {
    const conflict = {
      key: "disc-conflict",
      imported: { id: "incoming", setName: "啄木鸟电音", partition: 4, rarity: "S", level: 15 },
      candidates: [{ id: "existing", setName: "啄木鸟电音", partition: 4, rarity: "S", level: 12 }],
    }
    mocks.planEnkaImport.mockResolvedValueOnce({
      uid: "1302309616",
      ownerId: "default",
      agents: [{ agentId: "hoshimi_miyabi", agentName: "星见雅", changes: [], drive: null }],
      conflicts: [conflict],
      hasUnresolvedConflicts: true,
      blockingErrors: [],
      warnings: [],
      changeCount: 0,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()

    const pendingReplan = deferred<any>()
    mocks.planEnkaImport.mockImplementationOnce(() => pendingReplan.promise)
    wrapper.findComponent({ name: "DriveDiscConflictResolver" }).vm.$emit("resolve", { key: conflict.key, action: "add" })
    await wrapper.vm.$nextTick()

    const modalComponent = wrapper.findComponent({ name: "NModal" })
    expect(modalComponent.props("maskClosable")).toBe(false)
    expect(modalComponent.props("closeOnEsc")).toBe(false)
    expect(buttonWithin(wrapper.get("[data-modal]"), "取消").attributes("disabled")).toBeDefined()
    modalComponent.vm.$emit("update:show", false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find("[data-modal]").exists()).toBe(true)

    pendingReplan.resolve({
      uid: "1302309616",
      ownerId: "default",
      agents: [{ agentId: "hoshimi_miyabi", agentName: "星见雅", changes: [], drive: null }],
      conflicts: [],
      blockingErrors: [],
      warnings: [],
      changeCount: 0,
    })
    await flushPromises()
    expect(wrapper.find("[data-modal]").exists()).toBe(true)
  })

  it("does not write or replace feedback when a repeated import is a no-op", async () => {
    mocks.planEnkaImport.mockResolvedValueOnce({
      uid: "1302309616",
      ownerId: "default",
      agents,
      warnings: [],
      conflicts: [],
      blockingErrors: [],
      isNoop: true,
      changeCount: 0,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain("当前选择已经是最新数据")
    expect(mocks.message.info).toHaveBeenCalledWith("当前选择已经是最新数据。")
    expect(mocks.message.success).not.toHaveBeenCalled()
  })

  it("keeps a no-op preview subject to the transaction fingerprint check", async () => {
    mocks.planEnkaImport.mockResolvedValueOnce({
      uid: "1302309616",
      ownerId: "default",
      agents,
      warnings: [],
      conflicts: [],
      blockingErrors: [],
      isNoop: true,
      changeCount: 0,
    })
    mocks.applyEnkaImportPlan.mockRejectedValueOnce(new Error("预览后相关配置或库存已变化，请重新生成预览。"))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain("预览后相关配置或库存已变化")
    expect(wrapper.text()).not.toContain("当前选择已经是最新数据")
  })

  it("keeps a failed commit visible on the page", async () => {
    mocks.applyEnkaImportPlan.mockRejectedValueOnce(new Error("库存写入失败，已回滚"))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("库存写入失败，已回滚")
  })

  it("keeps a failed preview commit visible inside the open dialog", async () => {
    mocks.applyEnkaImportPlan.mockRejectedValueOnce(new Error("库存写入失败，已完整回滚"))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()
    const modal = wrapper.get("[data-modal]")
    await buttonWithin(modal, "确认导入").trigger("click")
    await flushPromises()

    expect(wrapper.get("[data-modal]").text()).toContain("导入未完成")
    expect(wrapper.get("[data-modal]").text()).toContain("库存写入失败，已完整回滚")
  })

  it("reports a committed import separately when only the page refresh fails", async () => {
    const wrapper = mountView()
    await flushPromises()
    mocks.inventoryLoad.mockRejectedValueOnce(new Error("IndexedDB refresh failed"))
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[0].trigger("click")
    await flushPromises()

    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain("导入已提交，但页面刷新失败")
    expect(mocks.message.warning).toHaveBeenCalledWith(expect.stringContaining("导入已提交，但页面刷新失败"))
    expect(mocks.message.error).not.toHaveBeenCalledWith(expect.stringContaining("IndexedDB refresh failed"))
  })

  it("keeps a failed undo visible on the page", async () => {
    mocks.hasCommittedEnkaUndo.mockResolvedValue(true)
    mocks.undoLastEnkaImport.mockRejectedValueOnce(new Error("相关数据已被修改，无法自动撤销"))
    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, "撤销上次导入").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("相关数据已被修改，无法自动撤销")
  })

  it("reports a completed undo separately when only the page refresh fails", async () => {
    mocks.hasCommittedEnkaUndo.mockResolvedValue(true)
    const wrapper = mountView()
    await flushPromises()
    mocks.inventoryLoad.mockRejectedValueOnce(new Error("inventory reload failed"))
    await button(wrapper, "撤销上次导入").trigger("click")
    await flushPromises()

    expect(mocks.undoLastEnkaImport).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain("导入已撤销，但页面刷新失败")
    expect(mocks.message.warning).toHaveBeenCalledWith(expect.stringContaining("导入已撤销，但页面刷新失败"))
  })

  it("keeps Enka cooldown visible and disables reading after a throttled response", async () => {
    const throttled = Object.assign(new Error("请求过于频繁"), {
      code: "RATE_LIMITED",
      status: 429,
      retryAfter: 2,
    })
    mocks.importEnkaShowcase.mockRejectedValueOnce(throttled)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Enka 服务暂时不可用，请在 2 秒后重试")
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeDefined()
    await wrapper.get('input[aria-label="游戏 UID"]').trigger("keyup", { key: "Enter" })
    await flushPromises()
    expect(mocks.importEnkaShowcase).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it("renders preview values as Chinese labels without exposing config identifiers or JSON", async () => {
    mocks.planEnkaImport.mockResolvedValueOnce({
      uid: "1302309616",
      ownerId: "default",
      agents: [{
        agentId: "hoshimi_miyabi",
        agentName: "星见雅",
        changes: [
          { field: "skillLevels", label: "技能等级", before: "{}", after: '{"basic":12,"special":11}' },
          { field: "wEngineId", label: "音擎", before: "未设置", after: "tenfold_starforge" },
          { field: "discMode", label: "驱动盘模式", before: "manual", after: "loadout" },
          { field: "selectedLoadoutId", label: "驱动盘配装", before: "未设置", after: "enka-zzz:1302309616:hoshimi_miyabi" },
        ],
        drive: {
          operations: {
            migratedLoadouts: [{ beforeId: "enka-showcase-old", afterId: "enka-zzz:new" }],
          },
        },
      }],
      warnings: [],
      conflicts: [],
      blockingErrors: [],
      changeCount: 4,
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()

    const previewText = wrapper.get("[data-modal]").text()
    expect(wrapper.get('[data-modal] [role="dialog"]').attributes("aria-label")).toBe("确认展柜数据导入")
    expect(previewText).toContain("普通攻击 12、特殊技 11")
    expect(previewText).toContain("十方锻星")
    expect(previewText).toContain("自选套装")
    expect(previewText).toContain("已有套装")
    expect(previewText).toContain("展柜佩戴套装 - 星见雅")
    expect(previewText).not.toContain("tenfold_starforge")
    expect(previewText).not.toContain("enka-zzz:")
    expect(previewText).not.toContain('{"basic"')
    expect(wrapper.get("details.preview-agent").attributes("open")).toBeUndefined()
    expect(wrapper.get(".preview-agent-chevron").exists()).toBe(true)
  })

  it("blocks importing and offers retry when account loading fails", async () => {
    mocks.accountStore.loadState = "error"
    mocks.accountStore.error = "IndexedDB unavailable"
    mocks.accountStore.currentOwnerId = null
    mocks.accountStore.owners = []
    mocks.accountEnsureLoaded
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"))
      .mockImplementation(async () => {
        Object.assign(mocks.accountStore, {
          loadState: "ready",
          error: "",
          currentOwnerId: "default",
          owners: [{ id: "default", label: "myself" }],
        })
        return { currentOwnerId: "default", owners: mocks.accountStore.owners }
      })

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain("账号信息加载失败")
    expect(wrapper.text()).toContain("IndexedDB unavailable")
    expect(wrapper.text()).not.toContain("当前账号：default")
    expect(wrapper.get('input[aria-label="游戏 UID"]').attributes("disabled")).toBeDefined()
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeDefined()

    await button(wrapper, "重试").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("当前账号：myself")
    expect(wrapper.get('input[aria-label="游戏 UID"]').attributes("disabled")).toBeUndefined()
  })

  it("keeps importing locked until a failed account context recovery is retried", async () => {
    mocks.recoverPendingEnkaImport.mockRejectedValueOnce(new Error("prepared transaction recovery failed"))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain("账号上下文初始化失败")
    expect(wrapper.text()).toContain("prepared transaction recovery failed")
    expect(wrapper.get('input[aria-label="游戏 UID"]').attributes("disabled")).toBeDefined()
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeDefined()

    await button(wrapper, "重试").trigger("click")
    await flushPromises()
    expect(wrapper.text()).not.toContain("账号上下文初始化失败")
    expect(wrapper.get('input[aria-label="游戏 UID"]').attributes("disabled")).toBeUndefined()
  })

  it("clears a bound UID when switching to an unbound account", async () => {
    mocks.binding = { uid: "1302309616" }
    const wrapper = mountView()
    await flushPromises()
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    expect((uidInput.element as HTMLInputElement).value).toBe("1302309616")

    mocks.binding = null
    mocks.accountStore.owners = [
      { id: "default", label: "myself" },
      { id: "alt", label: "second" },
    ]
    mocks.accountStore.currentOwnerId = "alt"
    await flushPromises()

    expect(wrapper.text()).toContain("当前账号：second")
    expect((uidInput.element as HTMLInputElement).value).toBe("")
  })

  it("keeps ordinary imports on the bound UID until rebind is explicitly started", async () => {
    mocks.binding = { uid: "1302309616" }
    const wrapper = mountView()
    await flushPromises()
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    expect((uidInput.element as HTMLInputElement).value).toBe("1302309616")
    expect(uidInput.attributes("disabled")).toBeDefined()
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeUndefined()
    await button(wrapper, "读取展柜").trigger("click")
    await flushPromises()
    expect(mocks.importEnkaShowcase).toHaveBeenCalledWith("1302309616", expect.anything())
    expect(mocks.planEnkaRebind).not.toHaveBeenCalled()
  })

  it("requires a dedicated preview before atomically replacing a bound UID", async () => {
    mocks.binding = { uid: "1302309616" }
    mocks.importEnkaShowcase.mockResolvedValueOnce({
      uid: "1300027938",
      mappedAgents: [agents[1]],
      skippedAgents: [],
      warnings: [],
      ttlSeconds: 45,
    })
    const wrapper = mountView()
    await flushPromises()

    await button(wrapper, "更换 UID").trigger("click")
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    expect(uidInput.attributes("disabled")).toBeUndefined()
    expect((uidInput.element as HTMLInputElement).value).toBe("")
    expect(wrapper.text()).toContain("读取和选择角色不会修改本地数据")
    await uidInput.setValue("1300027938")
    await button(wrapper, "读取新展柜").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("本次读取角色（1）")
    expect(wrapper.text()).toContain("预览并更换 UID")
    expect(wrapper.text()).not.toContain("确认导入")
    expect(mocks.applyPlannedEnkaRebind).not.toHaveBeenCalled()
    await button(wrapper, "预览并更换 UID").trigger("click")
    await flushPromises()

    expect(mocks.planEnkaRebind).toHaveBeenCalledWith(
      "1302309616",
      "1300027938",
      [expect.objectContaining({ agentId: "aria", sourceUid: "1300027938" })],
      {},
    )
    const modal = wrapper.get("[data-modal]")
    expect(modal.text()).toContain("确认更换游戏 UID")
    expect(modal.text()).toContain("删除 1 张仅属于旧 UID 的驱动盘")
    expect(modal.text()).toContain("保留 1 张 Scanner、JSON 或手动共用盘")
    expect(modal.text()).toContain("恢复 2 个配置字段")
    expect(modal.text()).toContain("保留 1 个用户后续修改字段")
    expect(mocks.applyEnkaImportPlan).not.toHaveBeenCalled()

    await buttonWithin(modal, "确认更换 UID").trigger("click")
    await flushPromises()
    expect(mocks.applyPlannedEnkaRebind).toHaveBeenCalledOnce()
    expect(mocks.importEnkaShowcase).toHaveBeenCalledOnce()
  })

  it("fails closed when an upgraded account has no trustworthy binding baseline", async () => {
    mocks.binding = { uid: "1302309616" }
    mocks.currentEnkaBinding.mockResolvedValue({
      ownerId: "default",
      binding: mocks.binding,
      history: mocks.history,
      rebindEligibility: {
        allowed: false,
        uid: "1302309616",
        code: "ENKA_REBIND_BASELINE_INCOMPLETE",
        message: "该账号的旧展柜导入缺少完整回退记录，无法安全更换 UID。",
      },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain("当前账号暂不能安全换绑")
    expect(wrapper.text()).toContain("请新建 Calculator 账号，或删除旧账号后重新创建")
    expect(button(wrapper, "更换 UID").attributes("disabled")).toBeDefined()
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeUndefined()
  })

  it("shows a blocking rebind plan but never writes it", async () => {
    mocks.binding = { uid: "1302309616" }
    mocks.importEnkaShowcase.mockResolvedValueOnce({
      uid: "1300027938",
      mappedAgents: [agents[1]],
      skippedAgents: [],
      warnings: [],
      ttlSeconds: 45,
    })
    mocks.planEnkaRebind.mockResolvedValueOnce({
      kind: "enka-rebind",
      uid: "1300027938",
      previousUid: "1302309616",
      ownerId: "default",
      agents: [],
      warnings: [],
      conflicts: [],
      blockingErrors: [{ code: "ENKA_REBIND_UNTRACKED_DATA", message: "contains internal ids" }],
      hasBlockingErrors: true,
      hasUnresolvedConflicts: true,
      changeCount: 0,
      rebind: null,
    })
    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, "更换 UID").trigger("click")
    await wrapper.get('input[aria-label="游戏 UID"]').setValue("1300027938")
    await button(wrapper, "读取新展柜").trigger("click")
    await flushPromises()
    await button(wrapper, "预览并更换 UID").trigger("click")
    await flushPromises()

    const modal = wrapper.get("[data-modal]")
    expect(modal.text()).toContain("检测到未纳入绑定周期记录的旧展柜数据")
    expect(modal.text()).not.toContain("internal ids")
    expect(buttonWithin(modal, "确认更换 UID").attributes("disabled")).toBeDefined()
    await buttonWithin(modal, "确认更换 UID").trigger("click")
    expect(mocks.applyPlannedEnkaRebind).not.toHaveBeenCalled()
  })

  it("allows a failed showcase request to be retried", async () => {
    mocks.importEnkaShowcase
      .mockRejectedValueOnce(new Error("temporary upstream failure"))
      .mockResolvedValueOnce({ uid: "1302309616", mappedAgents: agents, skippedAgents: [], warnings: [], ttlSeconds: 30 })
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

  it("locks the read action before the asynchronous account preflight completes", async () => {
    const wrapper = mountView()
    await flushPromises()
    const pendingBinding = deferred<any>()
    mocks.currentEnkaBinding.mockClear()
    mocks.currentEnkaBinding.mockImplementationOnce(() => pendingBinding.promise)
    const uidInput = wrapper.get('input[aria-label="游戏 UID"]')
    await uidInput.setValue("1302309616")
    await button(wrapper, "读取展柜").trigger("click")
    await uidInput.trigger("keyup", { key: "Enter" })

    expect(mocks.currentEnkaBinding).toHaveBeenCalledOnce()
    expect(button(wrapper, "读取展柜").attributes("disabled")).toBeDefined()
    pendingBinding.resolve({ ownerId: "default", binding: null })
    await flushPromises()

    expect(mocks.importEnkaShowcase).toHaveBeenCalledOnce()
  })

  it("freezes diagnostics in preview and ignores duplicate confirmation", async () => {
    mocks.importEnkaShowcase.mockResolvedValue({
      uid: "1302309616",
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
    expect(wrapper.text()).toContain("有 1 个角色暂未收录，已跳过")
    expect(wrapper.get('section[aria-labelledby="showcase-title"] .agent-list').text()).not.toContain("未收录角色")
    await wrapper.get(".list-actions").findAll("button")[1].trigger("click")
    await flushPromises()
    expect(wrapper.get("[data-modal]").text()).toContain("未收录角色：目录未映射")
    expect(wrapper.get("[data-modal]").text()).toContain("服务端映射警告")

    const confirm = buttonWithin(wrapper.get("[data-modal]"), "确认导入")
    await confirm.trigger("click")
    await confirm.trigger("click")
    expect(mocks.applyEnkaImportPlan).toHaveBeenCalledOnce()
    resolveApply({ transactionId: "tx" })
    await flushPromises()
  })
})
