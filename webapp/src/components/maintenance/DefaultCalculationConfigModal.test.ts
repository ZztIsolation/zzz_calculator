import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import DefaultCalculationConfigModal from "./DefaultCalculationConfigModal.vue"

vi.mock("naive-ui", async () => {
  const { defineComponent, h, inject, provide } = await import("vue")
  const tabsKey = Symbol("default-loop-tabs")
  const optionValue = (options: any[], raw: string) => options?.find(option => String(option.value) === raw)?.value ?? raw
  return {
    NButton: {
      props: ["disabled", "title", "ariaLabel"],
      emits: ["click"],
      template: "<button type=\"button\" :disabled=\"disabled\" :title=\"title\" :aria-label=\"ariaLabel\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
    },
    NDropdown: {
      props: ["options", "disabled"],
      emits: ["select"],
      template: "<div><slot /><div class=\"dropdown-options\"><button v-for=\"option in options\" :key=\"option.key\" type=\"button\" :disabled=\"disabled\" @click=\"$emit('select', option.key)\">{{ option.label }}</button></div></div>",
    },
    NInput: {
      props: ["value", "disabled", "placeholder"],
      emits: ["update:value"],
      template: "<input :value=\"value\" :disabled=\"disabled\" :placeholder=\"placeholder\" @input=\"$emit('update:value', $event.target.value)\">",
    },
    NInputNumber: {
      props: ["value", "disabled", "step", "max", "precision"],
      emits: ["update:value"],
      template: "<input type=\"number\" :value=\"value\" :disabled=\"disabled\" :step=\"step\" :max=\"max\" :data-precision=\"precision\" @input=\"$emit('update:value', Number($event.target.value))\">",
    },
    NModal: {
      props: ["show", "title"],
      emits: ["update:show"],
      template: "<div v-if=\"show\" role=\"dialog\"><h2>{{ title }}</h2><slot /><slot name=\"footer\" /><slot name=\"action\" /></div>",
    },
    NSelect: defineComponent({
      props: ["value", "options", "disabled"],
      emits: ["update:value"],
      setup(props, { emit }) {
        return () => h("select", {
          value: props.value,
          disabled: props.disabled,
          onChange: (event: Event) => emit("update:value", optionValue(props.options as any[], (event.target as HTMLSelectElement).value)),
        }, (props.options as any[] ?? []).map(option => h("option", { key: option.value, value: option.value, disabled: option.disabled }, option.label)))
      },
    }),
    NSwitch: {
      props: ["value", "disabled"],
      emits: ["update:value"],
      template: "<button type=\"button\" role=\"switch\" :aria-checked=\"value\" :disabled=\"disabled\" @click=\"$emit('update:value', !value)\"><slot v-if=\"value\" name=\"checked\" /><slot v-else name=\"unchecked\" /></button>",
    },
    NTab: defineComponent({
      props: ["name"],
      setup(props, { slots }) {
        const update = inject(tabsKey, () => {}) as (value: unknown) => void
        return () => h("button", { type: "button", "data-tab-name": props.name, onClick: () => update(props.name) }, slots.default?.())
      },
    }),
    NTabs: defineComponent({
      props: ["value"],
      emits: ["update:value"],
      setup(_, { emit, slots }) {
        provide(tabsKey, (value: unknown) => emit("update:value", value))
        return () => h("div", { class: "tabs" }, slots.default?.())
      },
    }),
    NTag: { template: "<span><slot /></span>" },
  }
})

const agent = { id: "agent_a", name: { zhCN: "角色甲" }, specialty: "attack", attribute: "physical", damageElement: "physical" }
const catalog = {
  agentSkills: {
    agentSkills: [{
      id: "skills_a",
      agentId: "agent_a",
      categories: [{
        id: "basic",
        name: { zhCN: "普通攻击" },
        moves: [
          { id: "move_a", name: { zhCN: "第一式" }, rows: [{ id: "row_a", label: { zhCN: "第一段伤害" } }] },
          { id: "move_b", name: { zhCN: "第二式" }, rows: [{ id: "row_b", label: { zhCN: "第二段伤害" } }] },
        ],
      }],
    }],
  },
  anomalyEffects: { effects: [
    {
      id: "burn",
      settlementType: "disorder",
      label: { zhCN: "灼烧紊乱" },
      fixedMultiplier: 4.5,
      tickMultiplier: 0.5,
      tickIntervalSeconds: 0.5,
      defaultDurationSeconds: 10,
    },
    {
      id: "shock",
      settlementType: "disorder",
      label: { zhCN: "感电紊乱" },
      fixedMultiplier: 4.5,
      tickMultiplier: 1.25,
      tickIntervalSeconds: 1,
      defaultDurationSeconds: 10,
    },
  ] },
}

function event(id: string, moveId: string, rowId: string) {
  return { id, kind: "direct", count: 1, critMode: "expected", skillRef: { agentSkillId: "skills_a", categoryId: "basic", moveId, rowId } }
}

function config() {
  return {
    cinemaLevel: 0,
    mode: "custom",
    name: { zhCN: "基础循环" },
    selectedEventId: "event_b",
    events: [event("event_a", "move_a", "row_a"), event("event_b", "move_b", "row_b")],
    variants: [{
      cinemaLevel: 6,
      mode: "custom",
      name: { zhCN: "六影循环" },
      selectedEventId: "event_6",
      events: [event("event_6", "move_b", "row_b")],
    }],
  }
}

const wrappers: Array<ReturnType<typeof mount>> = []
function mountModal(value = config()) {
  const wrapper = mount(DefaultCalculationConfigModal, {
    props: { show: true, config: value, catalog, agent, skillGroups: [] },
    global: {
      stubs: {
        ConfirmDialog: {
          props: ["show", "confirmText"],
          emits: ["update:show", "confirm"],
          template: "<div v-if=\"show\" class=\"confirm-dialog\"><button type=\"button\" @click=\"$emit('confirm')\">{{ confirmText }}</button></div>",
        },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

function button(wrapper: any, text: string) {
  const result = wrapper.findAll("button").find((item: any) => item.text().trim() === text)
  expect(result, `button ${text}`).toBeTruthy()
  return result!
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe("DefaultCalculationConfigModal", () => {
  it("copies the active loop into a chosen cinema level with fresh event ids", async () => {
    const wrapper = mountModal()
    await button(wrapper, "新增 2 影循环").trigger("click")
    expect((wrapper.find(".default-loop-config-panel input").element as HTMLInputElement).value).toBe("2影默认方案")
    await button(wrapper, "应用").trigger("click")

    const applied = wrapper.emitted("apply")?.[0]?.[0] as any
    const variant = applied.variants.find((entry: any) => entry.cinemaLevel === 2)
    expect(applied.cinemaLevel).toBe(0)
    expect(variant.name.zhCN).toBe("2影默认方案")
    expect(variant.events).toHaveLength(2)
    expect(variant.events.map((entry: any) => entry.id)).not.toEqual(["event_a", "event_b"])
    expect(variant.selectedEventId).toBe(variant.events[1].id)
    expect(variant.events.map((entry: any) => entry.skillRef.moveId)).toEqual(["move_a", "move_b"])
  })

  it("keeps zero cinema fixed and exposes only unused levels", async () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain("0 影基础")
    expect(wrapper.text()).not.toContain("新增 6 影循环")
    expect(wrapper.find('[aria-label="删除当前影画循环"]').exists()).toBe(false)

    await wrapper.find('[data-tab-name="6"]').trigger("click")
    expect(wrapper.find('[aria-label="删除当前影画循环"]').exists()).toBe(true)
    const levelSelect = wrapper.findAll("select").find(item => item.element.value === "6")!
    await levelSelect.setValue("4")
    expect(wrapper.find('[data-tab-name="4"]').exists()).toBe(true)
    expect(wrapper.find('[data-tab-name="6"]').exists()).toBe(false)
    expect((wrapper.find(".default-loop-config-panel input").element as HTMLInputElement).value).toBe("六影循环")
    await wrapper.find('[aria-label="删除当前影画循环"]').trigger("click")
    await button(wrapper, "删除").trigger("click")
    expect(wrapper.find('[data-tab-name="4"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("0 影基础")
  })

  it("copies and deletes events while preserving a valid target", async () => {
    const wrapper = mountModal()
    const copyButtons = wrapper.findAll('[aria-label="复制目标事件"]')
    await copyButtons[0].trigger("click")
    expect(wrapper.findAll(".calculation-event-list-item")).toHaveLength(3)
    expect(wrapper.find(".calculation-event-list-item.active").text()).toContain("第一式")

    const activeIndex = wrapper.findAll(".calculation-event-list-item").findIndex(item => item.classes().includes("active"))
    await wrapper.findAll('[aria-label="删除目标事件"]')[activeIndex].trigger("click")
    expect(wrapper.findAll(".calculation-event-list-item")).toHaveLength(2)
    await wrapper.findAll('[aria-label="删除目标事件"]')[0].trigger("click")
    expect(wrapper.findAll(".calculation-event-list-item")).toHaveLength(1)
    expect(wrapper.find('[aria-label="删除目标事件"]').attributes("disabled")).toBeDefined()
    await button(wrapper, "应用").trigger("click")
    const applied = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(applied.events.some((entry: any) => entry.id === applied.selectedEventId)).toBe(true)
  })

  it("allows administrators to configure the selected event stun state", async () => {
    const wrapper = mountModal()
    const stunSwitch = wrapper.find('[role="switch"]')

    expect(stunSwitch.attributes("aria-checked")).toBe("true")
    await stunSwitch.trigger("click")
    await button(wrapper, "应用").trigger("click")

    const applied = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(applied.events.find((entry: any) => entry.id === applied.selectedEventId).stunned).toBe(false)
  })

  it("discards edits when cancelled", async () => {
    const source = config()
    const wrapper = mountModal(source)
    const input = wrapper.find(".default-loop-config-panel input")
    await input.setValue("不会应用")
    await button(wrapper, "取消").trigger("click")
    await nextTick()
    expect(wrapper.emitted("apply")).toBeUndefined()
    expect(source.name.zhCN).toBe("基础循环")
    expect(wrapper.emitted("update:show")?.at(-1)).toEqual([false])
  })

  it("keeps damage ratio maintenance while normalizing half-second Disorder time", async () => {
    const source = {
      cinemaLevel: 0,
      mode: "custom",
      name: { zhCN: "紊乱循环" },
      selectedEventId: "disorder",
      events: [{
        id: "disorder",
        kind: "anomaly",
        settlementType: "disorder",
        anomalyEffect: "burn",
        disorderType: "normal",
        elapsedSeconds: 0,
        damageRatioPct: 50,
        count: 1,
      }],
      variants: [],
    }
    const wrapper = mountModal(source)

    expect(wrapper.text()).toContain("伤害比例%")
    const elapsedInput = wrapper.findAll('input[type="number"]').find(input => input.attributes("step") === "0.5")
    expect(elapsedInput).toBeTruthy()
    expect(elapsedInput?.attributes("max")).toBeUndefined()
    await elapsedInput!.setValue("3.2")
    expect((elapsedInput!.element as HTMLInputElement).value).toBe("3")

    await button(wrapper, "应用").trigger("click")
    const applied = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(applied.events[0].elapsedSeconds).toBe(3)
    expect(applied.events[0].damageRatioPct).toBe(50)
  })

  it("uses whole-second input and normalizes existing values for whole-second Disorder", async () => {
    const source = {
      cinemaLevel: 0,
      mode: "custom",
      name: { zhCN: "感电紊乱循环" },
      selectedEventId: "shock-disorder",
      events: [{
        id: "shock-disorder",
        kind: "anomaly",
        settlementType: "disorder",
        anomalyEffect: "shock",
        disorderType: "normal",
        elapsedSeconds: 4.5,
        count: 1,
      }],
      variants: [],
    }
    const wrapper = mountModal(source)
    const elapsedField = wrapper.findAll("label.maintenance-field").find(field => field.text().includes("已生效秒数"))
    const elapsedInput = elapsedField?.find('input[type="number"]')

    expect(elapsedInput?.exists()).toBe(true)
    expect(elapsedInput?.attributes("step")).toBe("1")
    expect(elapsedInput?.attributes("data-precision")).toBe("0")
    expect((elapsedInput!.element as HTMLInputElement).value).toBe("5")

    await button(wrapper, "应用").trigger("click")
    const applied = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(applied.events[0].elapsedSeconds).toBe(5)
  })
})
