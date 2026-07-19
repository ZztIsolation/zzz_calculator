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
      props: ["value", "disabled", "size"],
      emits: ["update:value"],
      template: "<input type=\"number\" :value=\"value\" :disabled=\"disabled\" @input=\"$emit('update:value', Number($event.target.value))\">",
    },
    NModal: {
      props: ["show"],
      emits: ["update:show"],
      template: "<div v-if=\"show\" role=\"dialog\"><slot /><slot name=\"footer\" /></div>",
    },
    NScrollbar: {
      template: "<div><slot /></div>",
    },
    NRadioGroup: {
      props: ["value"],
      template: "<div><slot /></div>",
    },
    NRadioButton: {
      props: ["value", "label"],
      emits: ["click"],
      template: "<button type=\"button\" @click=\"$emit('click', $event)\">{{ label }}</button>",
    },
    NSelect: defineComponent({
      props: {
        value: { type: [String, Number, Array] },
        options: { type: Array, default: () => [] },
        multiple: { type: Boolean, default: false },
      },
      emits: ["update:value"],
      setup(props, { emit }) {
        return () => h("select", {
          value: props.value,
          multiple: props.multiple,
          onChange: (event: Event) => {
            const select = event.target as HTMLSelectElement
            const resolve = (raw: string) => (props.options ?? []).find((item: any) => String(item.value) === raw)?.value ?? raw
            emit("update:value", props.multiple ? [...select.selectedOptions].map(option => resolve(option.value)) : resolve(select.value))
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
    id: "field.critical_assault.v3_0.p3.yanwang",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "危局强袭战" },
    sourcePeriod: { zhCN: "3.0版本第三期" },
    period: {
      modeId: "critical_assault",
      gameVersion: "3.0",
      phaseNo: 3,
      phaseName: { zhCN: "第三期" },
    },
    name: { zhCN: "湮亡" },
    description: { zhCN: "失衡值与抗性无视提升" },
    effects: [{
      id: "field-critical-yanwang",
      type: "fixed",
      stat: "allResIgnore",
      value: 30,
      mode: "flat",
      target: {
        kind: "skill",
        skillTargets: [
          { kind: "skillType", skillType: "chain" },
          { kind: "skillType", skillType: "ultimate" },
        ],
      },
    }],
  },
  {
    id: "field.critical_assault.v3_0.p3.linxi",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "危局强袭战" },
    sourcePeriod: { zhCN: "3.0版本第三期" },
    period: {
      modeId: "critical_assault",
      gameVersion: "3.0",
      phaseNo: 3,
      phaseName: { zhCN: "第三期" },
    },
    name: { zhCN: "凛息" },
    description: { zhCN: "风属性、冰属性与异常精通提升" },
    effects: [{ id: "field-critical-linxi", type: "fixed", stat: "windDmg", value: 20, mode: "flat" }],
  },
  {
    id: "field.critical_assault.v3_0.p3.gouxi",
    sourceType: "field",
    sourceCategory: "field",
    sourceKind: "field",
    source: { zhCN: "危局强袭战" },
    sourcePeriod: { zhCN: "3.0版本第三期" },
    period: {
      modeId: "critical_assault",
      gameVersion: "3.0",
      phaseNo: 3,
      phaseName: { zhCN: "第三期" },
    },
    name: { zhCN: "构析" },
    description: { zhCN: "异常精通与敌方防御力降低" },
    effects: [{ id: "field-critical-gouxi", type: "fixed", stat: "anomalyProficiency", value: 45, mode: "flat" }],
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

const bossBuffs = [
  {
    id: "boss.encounter.a",
    bossId: "boss.a",
    sourceType: "boss",
    bossName: { zhCN: "Boss 甲" },
    name: { zhCN: "Boss 甲敌情" },
    aliases: ["甲别名"],
    images: { icon: "/assets/bosses/a.webp" },
    target: { defense: 952, weaknessElements: ["ice"], resistanceElements: ["fire"] },
    appearances: [
      { modeId: "critical_assault", gameVersion: "3.0", phaseNo: 3 },
      { modeId: "critical_assault", gameVersion: "3.1", phaseNo: 2 },
    ],
    enemyIntel: { zhCN: "Boss 甲完整敌情" },
    playerBuffs: [{ id: "a-modeled", name: { zhCN: "甲增益" }, description: { zhCN: "每层异常伤害提升" }, calculationStatus: "modeled" }],
    playerDebuffs: [{ id: "a-info", name: { zhCN: "甲说明" }, description: { zhCN: "仅记录的敌方效果" }, calculationStatus: "descriptiveOnly", unmodeledReason: { zhCN: "当前模型不支持" } }],
    effects: [{ id: "a-stack", type: "stacked", stat: "anomalyDamageBonus", valuePerStack: 8, maxStacks: 6, defaultStacks: 6, stackGroup: "a-stacks", stackLabel: { zhCN: "甲层数" } }],
  },
  {
    id: "boss.encounter.b",
    bossId: "boss.b",
    sourceType: "boss",
    bossName: { zhCN: "Boss 乙" },
    name: { zhCN: "Boss 乙敌情" },
    images: { icon: "/assets/bosses/b.webp" },
    target: { defense: 953, weaknessElements: ["physical"], resistanceElements: ["electric"] },
    appearances: [{ modeId: "critical_assault", gameVersion: "3.1", phaseNo: 2 }],
    enemyIntel: { zhCN: "Boss 乙完整敌情" },
    playerBuffs: [],
    playerDebuffs: [],
    effects: [{ id: "b-crit", type: "fixed", stat: "critDmg", value: 15 }],
  },
  {
    id: "boss.encounter.c",
    bossId: "boss.c",
    sourceType: "boss",
    bossName: { zhCN: "Boss 丙" },
    name: { zhCN: "Boss 丙敌情" },
    images: { icon: "/assets/bosses/c.webp" },
    target: { defense: 952, weaknessElements: ["wind"], resistanceElements: [] },
    appearances: [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 3 }],
    enemyIntel: { zhCN: "Boss 丙完整敌情" },
    playerBuffs: [],
    playerDebuffs: [],
    effects: [{ id: "c-dmg", type: "fixed", stat: "dmgBonus", value: 10 }],
  },
]

const teammateWEngines = [
  {
    id: "team_engine_a",
    name: { zhCN: "队友音擎甲" },
    modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
    effect: {
      teamBuff: {
        scope: "inCombat",
        effects: [{
          id: "team-engine-a-atk",
          type: "fixed",
          stat: "atkFlat",
          value: 10,
          modificationValues: { value: [10, 20, 30, 40, 50] },
        }],
      },
    },
  },
  {
    id: "team_engine_b",
    name: { zhCN: "队友音擎乙" },
    modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
    effect: {
      teamBuff: {
        scope: "inCombat",
        effects: [{
          id: "team-engine-b-atk",
          type: "fixed",
          stat: "atkFlat",
          value: 5,
          modificationValues: { value: [5, 10, 15, 20, 25] },
        }],
      },
    },
  },
]

const teammateGroups = [
  ["physical_support", "物理支援队友", "physical", "support", "物理支援增益"],
  ["physical_stun", "物理击破队友", "physical", "stun", "物理击破增益"],
  ["fire_support", "火系支援队友", "fire", "support", "火系团队增益"],
  ["fire_attack", "火系强攻队友", "fire", "attack", "火系强攻增益"],
  ["legacy_unknown", "旧版未标注队友", "", "", "旧版增益"],
].map(([id, name, attribute, specialty, description]) => ({
  id,
  name: { zhCN: name },
  ...(attribute ? { attribute } : {}),
  ...(specialty ? { specialty } : {}),
  buffs: [{
    id: `teammate.${id}`,
    source: { zhCN: "核心被动" },
    description: { zhCN: description },
    scope: "inCombat",
    effects: [{ id: `effect.${id}`, type: "fixed", stat: "atkFlat", mode: "flat", value: 10 }],
  }],
}))

const meta = {
  agents: [{
    id: "agent_a",
    name: { zhCN: "角色甲" },
    attribute: "ice",
    combatBuffs: {
      corePassive: {
        scope: "inCombat",
        source: { zhCN: "核心被动" },
        effects: [
          { id: "atk", type: "fixed", stat: "atkFlat", value: 10, coverage: { default: 0.6, min: 0, max: 1, step: 0.1 } },
          { id: "crit", type: "fixed", stat: "critRate", value: 10 },
        ],
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
        skillType: "basic",
        rows: [
          { id: "hit_1", label: { zhCN: "一段伤害" }, multipliers: { "12": 100 } },
        ],
      }],
    }],
  }],
  wEngines: [
    { id: "current_engine", name: { zhCN: "当前音擎" } },
    ...teammateWEngines,
  ],
  combatBuffs: [...fieldBuffs, ...bossBuffs],
  teammateCombatBuffGroups: teammateGroups,
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
      buffs: [...fieldBuffs, ...bossBuffs],
      selectedIds: [],
      defaultIds: [],
      addedBuffs: [],
      runtimeInputs: {},
      meta,
      driveDiscSets: [],
      agentId: "agent_a",
      cinemaLevel: 0,
      wEngineId: "current_engine",
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

async function openBossTab(wrapper: ReturnType<typeof mountModal>) {
  await openModal(wrapper)
  const bossTab = wrapper.findAll(".n-tabs-tab")
    .find(tab => tab.text() === "Boss Buff")
  expect(bossTab).toBeTruthy()
  await bossTab!.trigger("click")
  await nextTick()
}

async function openTeammateTab(wrapper: ReturnType<typeof mountModal>) {
  await openModal(wrapper)
  const tab = wrapper.findAll(".n-tabs-tab")
    .find(item => item.text() === "队友 Buff")
  expect(tab).toBeTruthy()
  await tab!.trigger("click")
  await nextTick()
}

async function openTeammateWEngineTab(wrapper: ReturnType<typeof mountModal>) {
  await openModal(wrapper)
  const tab = wrapper.findAll(".n-tabs-tab")
    .find(item => item.text() === "队友音擎buff")
  expect(tab).toBeTruthy()
  await tab!.trigger("click")
  await nextTick()
}

function buffRowByText(wrapper: ReturnType<typeof mountModal>, text: string) {
  const row = wrapper.findAll(".buff-row").find(item => item.text().includes(text))
  expect(row).toBeTruthy()
  return row!
}

function buttonByText(wrapper: ReturnType<typeof mountModal>, text: string) {
  const button = wrapper.findAll("button").find(item => item.text() === text)
  expect(button).toBeTruthy()
  return button!
}

function selectByLabel(wrapper: ReturnType<typeof mountModal>, label: string) {
  const field = wrapper.findAll(".custom-field")
    .find(item => item.find("span").text() === label)
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
    expect(tabs.text()).toContain("Boss Buff")
    expect(tabs.text()).toContain("自定义 Buff")
  })

  it("combines dynamic teammate attribute, specialty, search, and bulk filters", async () => {
    const wrapper = mountModal()

    await openTeammateTab(wrapper)
    expect(wrapper.text()).toContain("物理支援队友")
    expect(wrapper.text()).toContain("旧版未标注队友")

    const attributeSelect = selectByLabel(wrapper, "属性")
    const specialtySelect = selectByLabel(wrapper, "特性")
    expect(attributeSelect.findAll("option").map(option => option.text())).toEqual(["物理属性", "火属性"])
    expect(specialtySelect.findAll("option").map(option => option.text())).toEqual(["强攻", "击破", "支援"])

    await attributeSelect.setValue(["physical"])
    await nextTick()
    expect(wrapper.text()).toContain("物理支援队友")
    expect(wrapper.text()).toContain("物理击破队友")
    expect(wrapper.text()).not.toContain("火系支援队友")
    expect(wrapper.text()).not.toContain("旧版未标注队友")

    await specialtySelect.setValue(["support"])
    await nextTick()
    expect(wrapper.text()).toContain("物理支援队友")
    expect(wrapper.text()).not.toContain("物理击破队友")

    await attributeSelect.setValue(["physical", "fire"])
    await nextTick()
    expect(wrapper.text()).toContain("物理支援队友")
    expect(wrapper.text()).toContain("火系支援队友")
    expect(wrapper.text()).not.toContain("火系强攻队友")

    await wrapper.find("input[placeholder='搜索来源、名称、效果']").setValue("火系")
    await nextTick()
    expect(wrapper.text()).not.toContain("物理支援队友")
    expect(wrapper.text()).toContain("火系支援队友")

    await buttonByText(wrapper, "添加当前列表").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")
    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toEqual(["teammate.fire_support"])

    await wrapper.setProps({ show: false })
    await openTeammateTab(wrapper)
    expect(wrapper.text()).toContain("物理支援队友")
    expect(wrapper.text()).toContain("火系强攻队友")
    expect(wrapper.text()).toContain("旧版未标注队友")
  })

  it("filters Boss Buffs by every appearance, phase, and Boss name", async () => {
    const wrapper = mountModal()

    await openBossTab(wrapper)
    expect(wrapper.text()).toContain("Boss 甲")
    expect(wrapper.text()).toContain("Boss 乙")
    expect(wrapper.text()).not.toContain("Boss 丙")
    expect(wrapper.text()).toContain("仅说明，未计入计算")
    expect(wrapper.text()).toContain("防御 952")
    expect(wrapper.find("input[type='range']").exists()).toBe(true)
    expect(buttonByText(wrapper, "添加当前列表").attributes("disabled")).toBeDefined()

    const selects = wrapper.findAll(".boss-buff-filter-row select")
    expect(selects).toHaveLength(3)
    await selects[0].setValue("3.0")
    await nextTick()
    await selects[1].setValue("critical_assault:3.0:3")
    await nextTick()

    expect(wrapper.text()).toContain("Boss 甲")
    expect(wrapper.text()).toContain("Boss 丙")
    expect(wrapper.text()).not.toContain("Boss 乙")

    await selects[2].setValue("boss.c")
    await nextTick()
    const rows = wrapper.findAll(".buff-row").map(row => row.text())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain("Boss 丙")
  })

  it("selects at most one Boss Buff without clearing a selected field Buff", async () => {
    const fieldId = "field.defense_v5.v3_0.p2.jijing_chefeng"
    const wrapper = mountModal({
      selectedIds: [fieldId, "boss.encounter.a"],
      runtimeInputs: {
        "boss.encounter.a": { effects: { "a-stack": { stacks: 3 } } },
        [fieldId]: { effects: {} },
      },
    })

    await openBossTab(wrapper)
    await buffRowByText(wrapper, "Boss 乙").find(".buff-row-toggle").trigger("click")
    await nextTick()
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toContain(fieldId)
    expect(payload.selectedBuffIds).toContain("boss.encounter.b")
    expect(payload.selectedBuffIds).not.toContain("boss.encounter.a")
    expect(payload.runtimeInputs).toHaveProperty(fieldId)
    expect(payload.runtimeInputs).not.toHaveProperty("boss.encounter.a")
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
    await selects[1].setValue("defense_v5|3.0|2")
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

  it("defaults 3.0 field buffs to critical assault phase 3 and keeps one selection", async () => {
    const wrapper = mountModal()

    await openFieldTab(wrapper)
    const selects = wrapper.findAll(".field-buff-filter-row select")
    await selects[0].setValue("3.0")
    await nextTick()

    const selectedPeriod = selects[1].findAll("option")
      .find(option => (option.element as HTMLOptionElement).selected)
    expect(selectedPeriod?.text()).toBe("危局强袭战 · 3.0版本 · 第三期")
    const visibleRows = wrapper.findAll(".buff-row").map(row => row.text())
    expect(visibleRows.some(text => text.includes("湮亡"))).toBe(true)
    expect(visibleRows.some(text => text.includes("凛息"))).toBe(true)
    expect(visibleRows.some(text => text.includes("构析"))).toBe(true)
    const yanwangText = visibleRows.find(text => text.includes("湮亡")) ?? ""
    expect(yanwangText).toContain("全属性抗性无视% +30%（技能：连携技；终结技）")
    expect(yanwangText).not.toContain("物理抗性无视")

    const yanwang = wrapper.findAll(".buff-row-toggle")
      .find(row => row.text().includes("湮亡"))
    expect(yanwang).toBeTruthy()
    await yanwang!.trigger("click")

    const linxi = wrapper.findAll(".buff-row-toggle")
      .find(row => row.text().includes("凛息"))
    expect(linxi).toBeTruthy()
    await linxi!.trigger("click")
    await nextTick()
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toEqual(["field.critical_assault.v3_0.p3.linxi"])
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

  it("edits only maintenance-enabled child coverage and writes canonical runtime", async () => {
    const wrapper = mountModal({
      runtimeInputs: {
        "agent:agent_a.corePassive": { coverage: 0.4 },
      },
    })

    await openModal(wrapper)
    const coverageInputs = wrapper.findAll(".rule-coverage-control input")
    expect(coverageInputs).toHaveLength(1)
    expect((coverageInputs[0].element as HTMLInputElement).disabled).toBe(true)

    await wrapper.find(".buff-row-toggle").trigger("click")
    await nextTick()
    expect((coverageInputs[0].element as HTMLInputElement).disabled).toBe(false)
    expect((coverageInputs[0].element as HTMLInputElement).value).toBe("0.4")
    await coverageInputs[0].setValue(0.35)
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    const runtime = payload.runtimeInputs["agent:agent_a.corePassive"]
    expect(runtime.coverage).toBeUndefined()
    expect(runtime.effects.atk.coverage).toBe(0.35)
    expect(runtime.effects.crit.coverage).toBeUndefined()
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

  it("exposes the simplified Chinese custom buff whitelist for every target kind", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)

    const defaultLabels = selectByLabel(wrapper, "增幅类型").findAll("option").map(option => option.text())
    for (const label of [
      "固定攻击力",
      "暴击伤害%",
      "贯穿增伤%",
      "无视防御率%",
      "当前属性减抗%",
      "当前属性抗性无视%",
      "全属性抗性无视%",
      "物理伤害%",
      "火属性伤害%",
      "冰属性伤害%",
      "电属性伤害%",
      "以太伤害%",
      "风属性伤害%",
      "紊乱倍率加算%",
    ]) {
      expect(defaultLabels).toContain(label)
    }
    for (const label of [
      "异常掌控超过 140 时每点转异常精通",
      "火贯穿增伤%",
      "火属性伤害暴击伤害%",
      "电属性伤害无视防御率%",
      "冰减抗%",
      "以太抗性无视%",
    ]) {
      expect(defaultLabels).not.toContain(label)
    }
    expect(wrapper.text()).not.toContain("ATK")
    expect(wrapper.text()).not.toContain("atkFlat")
    expect(wrapper.html()).not.toContain("技能分类 ID")
    expect(wrapper.html()).not.toContain("招式 ID")
    expect(wrapper.html()).not.toContain("倍率行 ID")

    for (const targetLabel of ["指定角色招式", "通用技能大类"]) {
      await buttonByText(wrapper, targetLabel).trigger("click")
      await nextTick()
      const skillLabels = selectByLabel(wrapper, "增幅类型").findAll("option").map(option => option.text())
      expect(skillLabels).toContain("技能目标伤害加成%")
      expect(skillLabels).toContain("贯穿增伤%")
      expect(skillLabels).toContain("当前属性减抗%")
      expect(skillLabels).toContain("当前属性抗性无视%")
      expect(skillLabels).toContain("全属性抗性无视%")
      expect(skillLabels).toContain("火属性伤害加成%")
      expect(skillLabels).not.toContain("暴击伤害%")
      expect(skillLabels).not.toContain("火贯穿增伤%")
      expect(skillLabels).not.toContain("火属性伤害暴击伤害%")
      expect(skillLabels).not.toContain("电属性伤害无视防御率%")
      expect(skillLabels).not.toContain("冰减抗%")
      expect(skillLabels).not.toContain("以太抗性无视%")
    }
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

  it("adds an all-attribute resistance-ignore custom buff as one stat", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)
    const statSelect = selectByLabel(wrapper, "增幅类型")
    const option = statSelect.findAll("option").find(item => item.text() === "全属性抗性无视%")
    expect(option).toBeTruthy()
    await statSelect.setValue((option!.element as HTMLOptionElement).value)
    await wrapper.find("input[type=\"number\"]").setValue("15")
    await buttonByText(wrapper, "添加到本次选择").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.addedBuffs[0].stats).toEqual([
      expect.objectContaining({ stat: "allResIgnore", value: 15, mode: "flat", label: "全属性抗性无视%" }),
    ])
    expect(payload.addedBuffs[0].effects).toEqual([])
  })

  it("normalizes current-attribute resistance aliases for global custom buffs", async () => {
    const cases = [
      ["当前属性减抗%", "enemyResReduction", "冰减抗%"],
      ["当前属性抗性无视%", "iceResIgnore", "冰抗性无视%"],
    ]

    for (const [optionLabel, expectedStat, expectedLabel] of cases) {
      const wrapper = mountModal()
      await openCustomTab(wrapper)
      const statSelect = selectByLabel(wrapper, "增幅类型")
      const option = statSelect.findAll("option").find(item => item.text() === optionLabel)
      expect(option).toBeTruthy()
      await statSelect.setValue((option!.element as HTMLOptionElement).value)
      await wrapper.find("input[type=\"number\"]").setValue("15")
      await buttonByText(wrapper, "添加到本次选择").trigger("click")
      await buttonByText(wrapper, "应用选择").trigger("click")

      const payload = wrapper.emitted("apply")?.[0]?.[0] as any
      expect(payload.addedBuffs[0].stats).toEqual([
        expect.objectContaining({ stat: expectedStat, value: 15, mode: "flat", label: expectedLabel }),
      ])
      expect(payload.addedBuffs[0].effects).toEqual([])
    }
  })

  it("normalizes current-attribute resistance aliases for skill-targeted custom buffs", async () => {
    const cases = [
      ["当前属性减抗%", "enemyResReduction", "冰减抗%"],
      ["当前属性抗性无视%", "iceResIgnore", "冰抗性无视%"],
    ]

    for (const [optionLabel, expectedStat, expectedLabel] of cases) {
      const wrapper = mountModal()
      await openCustomTab(wrapper)
      await buttonByText(wrapper, "指定角色招式").trigger("click")
      await nextTick()
      const statSelect = selectByLabel(wrapper, "增幅类型")
      const option = statSelect.findAll("option").find(item => item.text() === optionLabel)
      expect(option).toBeTruthy()
      await statSelect.setValue((option!.element as HTMLOptionElement).value)
      await selectByLabel(wrapper, "倍率行").setValue("hit_1")
      await wrapper.find("input[type=\"number\"]").setValue("10")
      await buttonByText(wrapper, "添加到本次选择").trigger("click")
      await buttonByText(wrapper, "应用选择").trigger("click")

      const payload = wrapper.emitted("apply")?.[0]?.[0] as any
      expect(payload.addedBuffs[0].stats).toEqual([])
      expect(payload.addedBuffs[0].effects).toEqual([
        expect.objectContaining({
          stat: expectedStat,
          value: 10,
          mode: "flat",
          label: expectedLabel,
          target: {
            kind: "skill",
            skillTargets: [expect.objectContaining({
              kind: "specific",
              agentSkillId: "agent_a",
              categoryId: "basic",
              skillType: "basic",
              moveId: "basic_1",
              rowId: "hit_1",
            })],
          },
        }),
      ])
    }
  })

  it("adds skill-targeted custom buffs as effects with selected skill targets", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)
    await buttonByText(wrapper, "指定角色招式").trigger("click")
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
      label: "技能目标伤害加成%",
      target: {
        kind: "skill",
        skillTargets: [{
          kind: "specific",
          agentSkillId: "agent_a",
          categoryId: "basic",
          skillType: "basic",
          moveId: "basic_1",
          rowId: "hit_1",
        }],
      },
    }))
  })

  it("adds one custom effect for multiple general skill types", async () => {
    const wrapper = mountModal()

    await openCustomTab(wrapper)
    await buttonByText(wrapper, "通用技能大类").trigger("click")
    await nextTick()
    await selectByLabel(wrapper, "技能大类").setValue(["chain", "ultimate"])
    await wrapper.find("input[type=\"number\"]").setValue("40")
    await buttonByText(wrapper, "添加到本次选择").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.addedBuffs[0].effects[0].target).toEqual({
      kind: "skill",
      skillTargets: [
        { kind: "skillType", skillType: "chain" },
        { kind: "skillType", skillType: "ultimate" },
      ],
    })
  })

  it("migrates known legacy targets when opening an existing custom buff", async () => {
    const wrapper = mountModal({
      addedBuffs: [{
        id: "legacy-ultimate",
        sourceCategory: "custom",
        sourceKind: "custom",
        name: { zhCN: "旧终结技 Buff" },
        effects: [{
          type: "fixed",
          stat: "dmgBonus",
          value: 20,
          target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["ultimate_"] }] },
        }],
      }],
    })

    await openModal(wrapper)
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.addedBuffs[0].effects[0].target.skillTargets).toEqual([
      { kind: "skillType", skillType: "ultimate" },
    ])
  })

  it("uses display skill catalogs for custom skill targets", async () => {
    const hiddenAgent = { id: "hidden_agent", name: { zhCN: "隐藏角色" } }
    const hiddenSkill = { id: "hidden_skill", agentId: "hidden_agent", name: { zhCN: "隐藏角色技能倍率" }, categories: [] }
    const wrapper = mountModal({
      meta: {
        ...meta,
        agents: [...meta.agents, hiddenAgent],
        displayAgents: meta.agents,
        agentSkills: [...meta.agentSkills, hiddenSkill],
        displayAgentSkills: meta.agentSkills,
      },
    })

    await openCustomTab(wrapper)
    await buttonByText(wrapper, "指定角色招式").trigger("click")
    await nextTick()

    const agentSelect = selectByLabel(wrapper, "角色")
    expect(agentSelect.text()).toContain("角色甲")
    expect(agentSelect.text()).not.toContain("隐藏角色")
  })

  it("selects an independent teammate w-engine refinement and refreshes its preview", async () => {
    const wrapper = mountModal()

    await openTeammateWEngineTab(wrapper)
    expect(wrapper.find(".w-engine-modification-control").exists()).toBe(false)

    await buffRowByText(wrapper, "队友音擎甲").find(".buff-row-toggle").trigger("click")
    await nextTick()

    let row = buffRowByText(wrapper, "队友音擎甲")
    const control = row.find(".w-engine-modification-control")
    expect(control.exists()).toBe(true)
    expect(control.findAll("option").map(option => option.text())).toEqual([
      "精 1",
      "精 2",
      "精 3",
      "精 4",
      "精 5",
    ])
    expect(row.find(".buff-effect-lines").text()).toContain("10")

    await control.find("select").setValue("3")
    await nextTick()
    row = buffRowByText(wrapper, "队友音擎甲")
    expect(row.find(".buff-effect-lines").text()).toContain("30")

    await buttonByText(wrapper, "应用选择").trigger("click")
    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toContain("wEngine:team_engine_a.team")
    expect(payload.addedBuffs).toContainEqual({
      id: "wEngine:team_engine_a.team",
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: 3,
    })
  })

  it("restores legacy added-only teammate w-engines and discards cancelled refinement changes", async () => {
    const addedBuffs = [{
      id: "wEngine:team_engine_a.team",
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: 3,
    }]
    const wrapper = mountModal({ addedBuffs })

    await openTeammateWEngineTab(wrapper)
    let row = buffRowByText(wrapper, "队友音擎甲")
    expect(row.classes()).toContain("is-selected")
    expect((row.find(".w-engine-modification-control select").element as HTMLSelectElement).value).toBe("3")
    expect(row.find(".buff-effect-lines").text()).toContain("30")

    await row.find(".w-engine-modification-control select").setValue("5")
    await buttonByText(wrapper, "取消").trigger("click")

    expect(wrapper.emitted("apply")).toBeUndefined()
    expect(addedBuffs[0].wEngineModificationLevel).toBe(3)

    await wrapper.setProps({ show: false })
    await openTeammateWEngineTab(wrapper)
    row = buffRowByText(wrapper, "队友音擎甲")
    expect((row.find(".w-engine-modification-control select").element as HTMLSelectElement).value).toBe("3")
  })

  it("removes teammate w-engine refinement and runtime when the item is unchecked", async () => {
    const id = "wEngine:team_engine_a.team"
    const wrapper = mountModal({
      selectedIds: [id],
      addedBuffs: [{
        id,
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        wEngineModificationLevel: 4,
      }],
      runtimeInputs: {
        [id]: { effects: { "team-engine-a-atk": { coverage: 0.5 } } },
      },
    })

    await openTeammateWEngineTab(wrapper)
    await buffRowByText(wrapper, "队友音擎甲").find(".buff-row-toggle").trigger("click")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).not.toContain(id)
    expect(payload.addedBuffs).not.toContainEqual(expect.objectContaining({ id }))
    expect(payload.runtimeInputs).not.toHaveProperty(id)
  })

  it("bulk-adds teammate w-engines at refinement 1 and bulk-removes their references", async () => {
    const wrapper = mountModal()

    await openTeammateWEngineTab(wrapper)
    await buttonByText(wrapper, "添加当前列表").trigger("click")
    await nextTick()
    expect(wrapper.findAll(".w-engine-modification-control")).toHaveLength(2)
    expect(wrapper.text()).toContain("已选 2 项")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const addedPayload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(addedPayload.addedBuffs.filter((item: any) => item.sourceKind === "wEngineTeam")).toEqual([
      expect.objectContaining({ id: "wEngine:team_engine_a.team", wEngineModificationLevel: 1 }),
      expect.objectContaining({ id: "wEngine:team_engine_b.team", wEngineModificationLevel: 1 }),
    ])

    const ids = ["wEngine:team_engine_a.team", "wEngine:team_engine_b.team"]
    const removeWrapper = mountModal({
      selectedIds: ids,
      addedBuffs: ids.map(id => ({
        id,
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        wEngineModificationLevel: 5,
      })),
      runtimeInputs: Object.fromEntries(ids.map(id => [id, { effects: {} }])),
    })

    await openTeammateWEngineTab(removeWrapper)
    await buttonByText(removeWrapper, "移除当前列表").trigger("click")
    await buttonByText(removeWrapper, "应用选择").trigger("click")

    const removedPayload = removeWrapper.emitted("apply")?.[0]?.[0] as any
    expect(removedPayload.selectedBuffIds).toEqual([])
    expect(removedPayload.addedBuffs).toEqual([])
    expect(removedPayload.runtimeInputs).toEqual({})
  })

  it("counts and renders only true custom buffs as custom entries", async () => {
    const wrapper = mountModal({
      addedBuffs: [
        {
          id: "wEngine:team_engine_a.team",
          sourceCategory: "wEngine",
          sourceKind: "wEngineTeam",
          wEngineModificationLevel: 5,
        },
        {
          id: "custom-a",
          sourceCategory: "custom",
          sourceKind: "custom",
          name: { zhCN: "真正的自定义 Buff" },
          stats: [{ stat: "atkFlat", value: 10, mode: "flat" }],
          effects: [],
        },
      ],
    })

    await openModal(wrapper)
    expect(wrapper.text()).toContain("已选 2 项")
    const customTab = wrapper.findAll(".n-tabs-tab").find(tab => tab.text() === "自定义 Buff")
    await customTab!.trigger("click")
    await nextTick()

    expect(wrapper.findAll(".buff-row")).toHaveLength(1)
    expect(wrapper.text()).toContain("真正的自定义 Buff")
    expect(wrapper.text()).not.toContain("队友音擎甲")
  })

  it("keeps legacy custom buffs that use hidden element-scoped stats", async () => {
    const legacyBuff = {
      id: "legacy-fire-crit-dmg",
      sourceCategory: "custom",
      sourceKind: "custom",
      name: { zhCN: "旧火属性爆伤 Buff" },
      stats: [],
      effects: [{
        id: "legacy-fire-crit-dmg-effect",
        type: "fixed",
        stat: "fireCritDmg",
        value: 25,
        mode: "flat",
        label: "火属性伤害暴击伤害%",
        target: { kind: "default" },
      }],
    }
    const wrapper = mountModal({ addedBuffs: [legacyBuff] })

    await openCustomTab(wrapper)
    expect(wrapper.text()).toContain("旧火属性爆伤 Buff")
    expect(wrapper.text()).toContain("火属性伤害暴击伤害% +25%")
    await buttonByText(wrapper, "应用选择").trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.addedBuffs).toEqual([legacyBuff])
  })

  it("uses display w-engines for teammate w-engine buffs", async () => {
    const teamBuff = (value: number) => ({
      scope: "inCombat",
      effects: [{ id: `team-${value}`, type: "fixed", stat: "atkFlat", value }],
    })
    const currentEngine = { id: "current_engine", name: { zhCN: "当前音擎" } }
    const visibleEngine = { id: "visible_engine", name: { zhCN: "可见队友音擎" }, effect: { teamBuff: teamBuff(10) } }
    const hiddenEngine = { id: "hidden_engine", name: { zhCN: "隐藏队友音擎" }, effect: { teamBuff: teamBuff(20) } }
    const wrapper = mountModal({
      meta: {
        ...meta,
        wEngines: [currentEngine, visibleEngine, hiddenEngine],
        displayWEngines: [currentEngine, visibleEngine],
      },
      wEngineId: "current_engine",
    })

    await openModal(wrapper)
    const tab = wrapper.findAll(".n-tabs-tab").find(item => item.text() === "队友音擎buff")
    expect(tab).toBeTruthy()
    await tab!.trigger("click")
    await nextTick()

    expect(wrapper.text()).toContain("可见队友音擎")
    expect(wrapper.text()).not.toContain("隐藏队友音擎")
  })
})
