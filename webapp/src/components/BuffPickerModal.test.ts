import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import BuffPickerModal from "@/components/BuffPickerModal.vue"

vi.mock("naive-ui", async () => {
  const { defineComponent, h, inject, provide } = await import("vue")
  const tabsKey = Symbol("tabs")

  return {
    NButton: {
      props: ["disabled"],
      emits: ["click"],
      template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
    },
    NCheckbox: {
      props: ["checked"],
      emits: ["update:checked"],
      template: "<label><input type=\"checkbox\" :checked=\"checked\" @change=\"$emit('update:checked', $event.target.checked)\"><slot /></label>",
    },
    NInput: {
      props: ["value", "placeholder"],
      emits: ["update:value"],
      template: "<input :placeholder=\"placeholder\" :value=\"value\" @input=\"$emit('update:value', $event.target.value)\">",
    },
    NInputNumber: {
      props: ["value"],
      emits: ["update:value"],
      template: "<input type=\"number\" :value=\"value\" @input=\"$emit('update:value', Number($event.target.value))\">",
    },
    NModal: {
      props: ["show"],
      emits: ["update:show"],
      template: "<div v-if=\"show\" role=\"dialog\"><slot /><slot name=\"footer\" /></div>",
    },
    NScrollbar: {
      template: "<div><slot /></div>",
    },
    NSelect: defineComponent({
      props: ["value", "options"],
      emits: ["update:value"],
      setup(props, { emit }) {
        return () => h("select", {
          value: props.value,
          onChange: (event: Event) => {
            const raw = (event.target as HTMLSelectElement).value
            const option = (props.options ?? []).find((item: any) => String(item.value) === raw)
            emit("update:value", option?.value ?? raw)
          },
        }, (props.options ?? []).map((option: any) =>
          h("option", { key: option.value, value: option.value }, option.label)))
      },
    }),
    NTabPane: defineComponent({
      props: ["name", "tab"],
      setup(props) {
        const update = inject(tabsKey, () => {}) as (value: unknown) => void
        return () => h("button", {
          class: "n-tabs-tab",
          type: "button",
          "data-tab-name": props.name,
          onClick: () => update(props.name),
        }, String(props.tab ?? ""))
      },
    }),
    NTabs: defineComponent({
      props: ["value"],
      emits: ["update:value"],
      setup(_, { emit, slots }) {
        provide(tabsKey, (value: unknown) => emit("update:value", value))
        return () => h("div", slots.default?.())
      },
    }),
    NTag: {
      template: "<span><slot /></span>",
    },
  }
})

const fieldBuffs = [
  {
    id: "field.defense_v5.v3_0.p2.jijing_chefeng",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "防卫战 v5" },
    sourcePeriod: { zhCN: "3.0版本第二期" },
    period: {
      modeId: "defense_v5",
      gameVersion: "3.0",
      phaseNo: 2,
      phaseName: { zhCN: "第二期" },
    },
    name: { zhCN: "极境彻风" },
    description: { zhCN: "风属性和冰属性提升" },
    effects: [{ id: "field-wind", type: "fixed", stat: "windDmg", value: 10 }],
  },
  {
    id: "field.defense_v5.v3_0.p2.mingse_yinguang",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "防卫战 v5" },
    sourcePeriod: { zhCN: "3.0版本第二期" },
    period: {
      modeId: "defense_v5",
      gameVersion: "3.0",
      phaseNo: 2,
      phaseName: { zhCN: "第二期" },
    },
    name: { zhCN: "暝色引光" },
    description: { zhCN: "攻击力和暴击伤害提升" },
    effects: [{ id: "field-atk", type: "fixed", stat: "atkPct", value: 30, mode: "pct", basis: "outOfCombatAtk" }],
  },
  {
    id: "field.defense_v5.v3_1.p1.future",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "防卫战 v5" },
    sourcePeriod: { zhCN: "3.1版本第一期" },
    period: {
      modeId: "defense_v5",
      gameVersion: "3.1",
      phaseNo: 1,
      phaseName: { zhCN: "第一期" },
    },
    name: { zhCN: "新版本场地" },
    description: { zhCN: "最新版本默认显示" },
    effects: [{ id: "field-new", type: "fixed", stat: "dmgBonus", value: 5 }],
  },
]

const meta = {
  agents: [{
    id: "agent_a",
    name: { zhCN: "角色甲" },
    attribute: "ice",
    combatBuffs: {
      corePassive: {
        scope: "inCombat",
        source: { zhCN: "核心被动" },
        effects: [{ id: "atk", type: "fixed", stat: "atkFlat", value: 10 }],
      },
    },
  }],
  agentSkills: [{
    id: "agent_a",
    agentId: "agent_a",
    name: { zhCN: "角色甲技能倍率" },
    categories: [{
      id: "basic",
      name: { zhCN: "普通攻击" },
      moves: [{
        id: "basic_1",
        name: { zhCN: "普攻一段" },
        rows: [
          { id: "hit_1", label: { zhCN: "一段伤害" }, multipliers: { "12": 100 } },
        ],
      }],
    }],
  }],
  combatBuffs: fieldBuffs,
  statRules: {
    statDisplay: {
      ATK: { label: { en: "ATK" } },
      atkFlat: { label: { zhCN: "攻击力" } },
    },
  },
}

function mountModal(propOverrides: Record<string, any> = {}) {
  return mount(BuffPickerModal, {
    props: {
      show: false,
      buffs: fieldBuffs,
      selectedIds: [],
      defaultIds: [],
      addedBuffs: [],
      runtimeInputs: {},
      meta,
      driveDiscSets: [],
      agentId: "agent_a",
      cinemaLevel: 0,
      wEngineId: "",
      wEngineModificationLevel: 1,
      ...propOverrides,
    },
    global: {
      stubs: {
        ImageAvatar: {
          props: ["name"],
          template: "<span class=\"avatar\">{{ name }}</span>",
        },
        LayerSlider: {
          template: "<input type=\"range\">",
        },
      },
    },
  })
}

async function openModal(wrapper: ReturnType<typeof mountModal>) {
  await wrapper.setProps({ show: true })
  await nextTick()
}

async function openCustomTab(wrapper: ReturnType<typeof mountModal>) {
  await openModal(wrapper)
  const customTab = wrapper.findAll(".n-tabs-tab")
    .find(tab => tab.text() === "自定义 Buff")
  expect(customTab).toBeTruthy()
  await customTab!.trigger("click")
  await nextTick()
}

async function openFieldTab(wrapper: ReturnType<typeof mountModal>) {
  await openModal(wrapper)
  const fieldTab = wrapper.findAll(".n-tabs-tab")
    .find(tab => tab.text() === "场地 Buff")
  expect(fieldTab).toBeTruthy()
  await fieldTab!.trigger("click")
  await nextTick()
}

function buttonByText(wrapper: ReturnType<typeof mountModal>, text: string) {
  const button = wrapper.findAll("button").find(item => item.text() === text)
  expect(button).toBeTruthy()
  return button!
}

function selectByLabel(wrapper: ReturnType<typeof mountModal>, label: string) {
  const field = wrapper.findAll(".custom-field")
    .find(item => item.text().includes(label))
  expect(field).toBeTruthy()
  return field!.find("select")
}

describe("BuffPickerModal", () => {
  it("renders the buff category tabs as a dedicated control strip", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    const tabs = wrapper.find(".buff-category-tabs")
    expect(tabs.exists()).toBe(true)
    expect(tabs.text()).toContain("自身 Buff")
    expect(tabs.text()).toContain("队友 Buff")
    expect(tabs.text()).toContain("场地 Buff")
    expect(tabs.text()).toContain("自定义 Buff")
  })

  it("filters field buffs by version, phase, and name, with single selection per phase", async () => {
    const wrapper = mountModal()

    await openFieldTab(wrapper)

    expect(wrapper.text()).toContain("新版本场地")
    expect(wrapper.text()).not.toContain("极境彻风")

    const selects = wrapper.findAll(".field-buff-filter-row select")
    expect(selects).toHaveLength(3)
    await selects[0].setValue("3.0")
    await nextTick()
    await selects[2].setValue("field.defense_v5.v3_0.p2.mingse_yinguang")
    await nextTick()

    const filteredRows = wrapper.findAll(".buff-row").map(row => row.text())
    expect(filteredRows.some(text => text.includes("暝色引光"))).toBe(true)
    expect(filteredRows.some(text => text.includes("极境彻风"))).toBe(false)

    await selects[2].setValue("")
    await nextTick()
    const fieldRows = wrapper.findAll(".buff-row-toggle")
    const first = fieldRows.find(row => row.text().includes("极境彻风"))
    const second = fieldRows.find(row => row.text().includes("暝色引光"))
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()

    await first!.trigger("click")
    await second!.trigger("click")
    await nextTick()
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toEqual(["field.defense_v5.v3_0.p2.mingse_yinguang"])
  })

  it("toggles a buff from the main card area and applies the draft selection", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)
    await wrapper.find(".buff-row-toggle").trigger("click")
    await nextTick()

    expect(wrapper.find(".buff-row").classes()).toContain("is-selected")

    const applyButton = wrapper.findAll("button")
      .find(button => button.text() === "应用选择")
    expect(applyButton).toBeTruthy()

    await applyButton!.trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toEqual(["agent:agent_a.corePassive"])
  })

  it("discards the draft selection when cancelled", async () => {
    const wrapper = mountModal()
    await openModal(wrapper)
    await wrapper.find(".buff-row-toggle").trigger("click")
    await nextTick()
    await buttonByText(wrapper, "取消").trigger("click")

    expect(wrapper.emitted("apply")).toBeUndefined()
    expect(wrapper.emitted("update:show")?.at(-1)).toEqual([false])
  })

  it("keeps unchecked default buffs unselected when reopening the picker", async () => {
    const wrapper = mountModal({
      defaultIds: ["agent:agent_a.corePassive"],
      selectedIds: [],
    })

    await openModal(wrapper)

    const row = wrapper.find(".buff-row")
    expect(row.exists()).toBe(true)
    expect(row.classes()).not.toContain("is-selected")
  })

  it("uses the main-branch Chinese custom buff option whitelist", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)

    expect(wrapper.text()).toContain("固定攻击力")
    expect(wrapper.text()).toContain("通用伤害%")
    expect(wrapper.text()).toContain("无视防御率%")
    expect(wrapper.text()).not.toContain("ATK")
    expect(wrapper.text()).not.toContain("atkFlat")
    expect(wrapper.html()).not.toContain("技能分类 ID")
    expect(wrapper.html()).not.toContain("招式 ID")
    expect(wrapper.html()).not.toContain("倍率行 ID")
  })

  it("adds default custom panel buffs as stats instead of skill effects", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)
    await wrapper.find("input[type=\"number\"]").setValue("123")
    await buttonByText(wrapper, "添加到本次选择").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    const buff = payload.addedBuffs[0]
    expect(buff).toEqual(expect.objectContaining({
      sourceCategory: "custom",
      sourceKind: "custom",
      name: { zhCN: "自定义 Buff" },
    }))
    expect(buff).not.toHaveProperty("scope")
    expect(buff).not.toHaveProperty("sourceType")
    expect(buff).not.toHaveProperty("label")
    expect(buff.stats).toEqual([
      expect.objectContaining({ stat: "atkFlat", value: 123, mode: "flat", label: "固定攻击力" }),
    ])
    expect(buff.effects).toEqual([])
  })

  it("adds skill-targeted custom buffs as effects with selected skill targets", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)
    await selectByLabel(wrapper, "增幅对象").setValue("skill")
    await nextTick()
    await selectByLabel(wrapper, "倍率行").setValue("hit_1")
    await wrapper.find("input[type=\"number\"]").setValue("20")
    await buttonByText(wrapper, "添加到本次选择").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    const buff = payload.addedBuffs[0]
    expect(buff.stats).toEqual([])
    expect(buff.effects[0]).toEqual(expect.objectContaining({
      type: "fixed",
      stat: "dmgBonus",
      value: 20,
      mode: "flat",
      label: "通用伤害加成%",
      target: {
        kind: "skill",
        skillTargets: [{
          agentSkillId: "agent_a",
          categoryId: "basic",
          moveId: "basic_1",
          rowId: "hit_1",
        }],
      },
    }))
  })
})
