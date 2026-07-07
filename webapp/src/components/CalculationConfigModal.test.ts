import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import CalculationConfigModal from "@/components/CalculationConfigModal.vue"
import agentsData from "../../../data/agents.json"
import agentSkillsData from "../../../data/agent_skills.json"
import anomalyEffectsData from "../../../data/anomaly_effects.json"

const miyabi = (agentsData as any).agents.find((agent: any) => agent.id === "hoshimi_miyabi")
const miyabiSkillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "hoshimi_miyabi")
const anomalyEffects = (anomalyEffectsData as any).effects.filter((effect: any) => effect.settlementType !== "disorder")
const disorderEffects = (anomalyEffectsData as any).effects.filter((effect: any) => effect.settlementType === "disorder")
const yixuan = (agentsData as any).agents.find((agent: any) => agent.id === "yixuan")
const yixuanSkillCatalog = (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === "yixuan")

const naiveStubs = {
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
  NInputNumber: {
    props: ["value", "disabled"],
    emits: ["update:value"],
    template: "<input :value=\"value\" :disabled=\"disabled\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NModal: {
    props: ["show"],
    emits: ["update:show"],
    template: "<div v-if=\"show\" role=\"dialog\"><slot /><slot name=\"footer\" /></div>",
  },
  NSelect: {
    props: ["value", "options", "disabled"],
    emits: ["update:value"],
    template: `
      <select :value="value" :disabled="disabled" @change="$emit('update:value', $event.target.value)">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
  },
  NTag: {
    template: "<span><slot /></span>",
  },
  SkillPickerModal: {
    template: "<div />",
  },
}

let wrappers: Array<ReturnType<typeof mount>> = []

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function mountModal(overrides: { agent?: any, damageConfig?: any, meta?: any, skillCatalog?: any } = {}) {
  const agent = overrides.agent ?? miyabi
  const skillCatalog = overrides.skillCatalog ?? (agent?.id === "yixuan" ? yixuanSkillCatalog : miyabiSkillCatalog)
  const wrapper = mount(CalculationConfigModal, {
    attachTo: document.body,
    props: {
      show: false,
      agent,
      damageConfig: overrides.damageConfig ?? {
        ...agent.defaultCalculationConfig,
        mode: "adminDefault",
      },
      meta: {
        anomalyEffects,
        disorderEffects,
        agentSkills: [skillCatalog],
        ...(overrides.meta ?? {}),
      },
      skillCatalog,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core_skill: "F" },
    },
    global: {
      stubs: naiveStubs,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

async function openModal(wrapper: ReturnType<typeof mount>) {
  await wrapper.setProps({ show: true })
  await nextTick()
}

async function saveModal(wrapper: ReturnType<typeof mount>) {
  const saveButton = Array.from(document.body.querySelectorAll("button"))
    .find(button => button.textContent?.trim() === "保存配置")
  expect(saveButton).toBeTruthy()
  saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  await nextTick()
  const emitted = wrapper.emitted("save") ?? []
  return emitted[emitted.length - 1]?.[0] as any
}

function selectComponentWithOption(wrapper: ReturnType<typeof mount>, value: string) {
  return wrapper.findAllComponents({ name: "Select" })
    .find(select => ((select.props("options") as Array<{ value: string }> | undefined) ?? [])
      .some(option => option.value === value))
}

function selectLabelsWithOption(wrapper: ReturnType<typeof mount>, value: string) {
  const select = selectComponentWithOption(wrapper, value)
  return ((select?.props("options") as Array<{ label: string }> | undefined) ?? [])
    .map(option => option.label)
}

afterEach(() => {
  for (const wrapper of wrappers) {
    wrapper.unmount()
  }
  wrappers = []
  document.body.innerHTML = ""
})

describe("CalculationConfigModal", () => {
  it("only offers the sheer objective for rupture agents", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "single",
        selectedEventId: "direct-1",
        events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const modeOptions = selectLabelsWithOption(wrapper, "custom")
    expect(modeOptions).toContain("最大化单个伤害")
    expect(modeOptions).not.toContain("最大化贯穿伤害")
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .map(button => button.textContent?.trim())
      .filter(text => ["直伤", "贯穿", "异常", "紊乱"].includes(text ?? ""))
    expect(addButtons).toEqual(["直伤", "异常", "紊乱"])
  })

  it("keeps the sheer objective available for rupture agents", async () => {
    const wrapper = mountModal({
      agent: yixuan,
      skillCatalog: yixuanSkillCatalog,
      damageConfig: {
        mode: "sheer",
        selectedEventId: "sheer-1",
        events: [{ id: "sheer-1", kind: "sheer", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const modeOptions = selectLabelsWithOption(wrapper, "custom")
    expect(modeOptions).not.toContain("最大化单个伤害")
    expect(modeOptions).toContain("最大化贯穿伤害")
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .map(button => button.textContent?.trim())
      .filter(text => ["直伤", "贯穿", "异常", "紊乱"].includes(text ?? ""))
    expect(addButtons).toEqual(["直伤", "贯穿", "异常", "紊乱"])
  })

  it("renders target events as a full selectable list", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    const items = Array.from(document.body.querySelectorAll(".calculation-event-list-item"))
    expect(items).toHaveLength(9)
    expect(document.body.querySelector(".calculation-event-list select")).toBeNull()
    expect(items[0].textContent).toContain("强化普攻：霜月")
    expect(items[0].textContent).toContain("三段蓄力斩击伤害倍率")
    expect(document.body.textContent).not.toContain("miyabi_frost_moon_charge_3")
    expect(document.body.textContent).not.toMatch(/\bcharge_3\b/)
  })

  it("switches the editor when another event is selected", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)
    document.body.querySelectorAll(".calculation-event-select")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()

    expect(document.body.querySelectorAll(".panel-title")[1].textContent).toContain("连携技：春临")
    expect(document.body.querySelectorAll(".calculation-event-list-item")[1].classList.contains("active")).toBe(true)
  })

  it("keeps admin default events visible but read-only", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    expect(document.body.querySelector(".calculation-event-inline-actions")).toBeNull()
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .filter(button => ["直伤", "贯穿", "异常", "紊乱"].includes(button.textContent?.trim() ?? ""))
    expect(addButtons).toHaveLength(0)
  })

  it("disables admin default when the agent has no default calculation", async () => {
    const wrapper = mountModal({
      agent: { id: "agent_no_default", name: { zhCN: "无默认循环角色" }, specialty: "attack" },
      skillCatalog: { id: "agent_no_default", agentId: "agent_no_default", categories: [] },
      damageConfig: {
        mode: "adminDefault",
        selectedEventId: "direct-1",
        events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const modeSelect = selectComponentWithOption(wrapper, "adminDefault")
    const adminOption = ((modeSelect?.props("options") as Array<{ label: string, value: string, disabled?: boolean }> | undefined) ?? [])
      .find(option => option.value === "adminDefault")

    expect(adminOption).toMatchObject({
      label: "管理员默认循环（未配置）",
      disabled: true,
    })
    expect(modeSelect?.props("value")).toBe("single")
  })

  it("uses the disorder anomalyEffect as the source effect without leaking raw ids", async () => {
    const wrapper = mountModal({
      damageConfig: {
        ...clone(miyabi.defaultCalculationConfig),
        mode: "custom",
        selectedEventId: "miyabi_frozen_disorder",
      },
    })

    await openModal(wrapper)

    expect(document.body.textContent).toContain("原异常")
    expect(document.body.textContent).toContain("烈霜霜寒紊乱（星见雅）")
    expect(document.body.textContent).not.toContain("前置异常")
    expect(document.body.textContent).not.toContain("frost_frozen")
    expect(document.body.textContent).not.toContain("紊乱事件需要选择")
    expect(document.body.querySelectorAll(".panel-title")[1].textContent).toContain("紊乱 · 烈霜霜寒紊乱（星见雅）")
    expect(document.body.querySelectorAll(".panel-title")[1].textContent).not.toContain("异常紊乱")
  })

  it("hydrates legacy direct events with the displayed skill ref instead of manual multiplier text", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "legacy-direct",
        events: [{
          id: "legacy-direct",
          kind: "direct",
          count: 1,
          critMode: "expected",
          skillMultiplier: 100,
        }],
      },
    })

    await openModal(wrapper)

    expect(document.body.textContent).toContain("普通攻击：风花（一至二段）")
    expect(document.body.textContent).toContain("一段伤害倍率")
    expect(document.body.textContent).not.toContain("手填倍率")

    const saved = await saveModal(wrapper)
    expect(saved.events[0].skillRef).toMatchObject({
      agentSkillId: "hoshimi_miyabi",
      categoryId: "basic",
      moveId: "windflower_opening",
      rowId: "hit_1",
      level: 12,
    })
    const expectedRow = miyabiSkillCatalog.categories[0].moves[0].rows.find((row: any) => row.id === "hit_1")
    expect(saved.events[0].skillMultiplier).toBe(expectedRow.values[11])
  })

  it("saves the selected multiplier row and matching current-level multiplier", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "legacy-direct",
        events: [{
          id: "legacy-direct",
          kind: "direct",
          count: 1,
          critMode: "expected",
          skillMultiplier: 100,
        }],
      },
    })

    await openModal(wrapper)
    const rowSelect = selectComponentWithOption(wrapper, "hit_2")
    expect(rowSelect).toBeTruthy()
    await rowSelect!.vm.$emit("update:value", "hit_2")
    await nextTick()

    const expectedRow = miyabiSkillCatalog.categories[0].moves[0].rows.find((row: any) => row.id === "hit_2")
    const saved = await saveModal(wrapper)

    expect(saved.events[0].skillRef).toMatchObject({
      agentSkillId: "hoshimi_miyabi",
      categoryId: "basic",
      moveId: "windflower_opening",
      rowId: "hit_2",
      level: 12,
    })
    expect(saved.events[0].skillMultiplier).toBe(expectedRow.values[11])
  })
})
