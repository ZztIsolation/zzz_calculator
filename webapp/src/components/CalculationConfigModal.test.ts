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
const alice = (agentsData as any).agents.find((agent: any) => agent.id === "alice_thymefield")

const miyabiWithSkillGroups = {
  ...JSON.parse(JSON.stringify(miyabi)),
  skillGroups: [
    {
      id: "loop",
      name: { zhCN: "一变" },
      defaultCount: 10,
      minCount: 0,
      maxCount: 30,
      step: 1,
      events: [
        {
          id: "charge",
          kind: "direct",
          count: 2,
          critMode: "expected",
          skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "basic",
            moveId: "frost_moon",
            rowId: "charge_3",
          },
        },
      ],
    },
    {
      id: "ultimate",
      name: { zhCN: "一大" },
      defaultCount: 2,
      minCount: 0,
      maxCount: 10,
      step: 1,
      events: [
        {
          id: "ult",
          kind: "direct",
          count: 1,
          critMode: "expected",
          skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "chain",
            moveId: "ultimate_lingering_snow",
            rowId: "damage",
          },
        },
      ],
    },
  ],
  defaultCalculationConfig: {
    ...JSON.parse(JSON.stringify(miyabi.defaultCalculationConfig)),
    selectedEventId: "loop-ref",
    events: [
      {
        id: "loop-ref",
        kind: "skillGroup",
        skillGroupId: "loop",
        count: 10,
      },
      {
        id: "ultimate-ref",
        kind: "skillGroup",
        skillGroupId: "ultimate",
        count: 2,
      },
    ],
  },
}

const miyabiWithOnlySkillGroups = {
  ...JSON.parse(JSON.stringify(miyabiWithSkillGroups)),
  defaultCalculationConfig: {
    ...JSON.parse(JSON.stringify(miyabiWithSkillGroups.defaultCalculationConfig)),
    selectedEventId: null,
    events: [],
  },
}

const naiveStubs = {
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
  NInputNumber: {
    props: ["value", "disabled", "step", "max", "precision"],
    emits: ["update:value"],
    template: "<input type=\"number\" :value=\"value\" :disabled=\"disabled\" :step=\"step\" :max=\"max\" :data-precision=\"precision\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NModal: {
    props: ["show"],
    emits: ["update:show"],
    template: "<div v-if=\"show\" role=\"dialog\"><slot /><slot name=\"footer\" /></div>",
  },
  NRadioGroup: {
    name: "RadioGroup",
    inheritAttrs: false,
    props: ["value", "disabled"],
    template: "<div v-bind=\"$attrs\" role=\"radiogroup\"><slot /></div>",
  },
  NRadioButton: {
    name: "RadioButton",
    inheritAttrs: false,
    props: ["value", "label", "disabled"],
    emits: ["click"],
    template: "<button v-bind=\"$attrs\" type=\"button\" role=\"radio\" :disabled=\"disabled\" @click=\"$emit('click', $event)\">{{ label }}<slot /></button>",
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
  NSwitch: {
    name: "Switch",
    inheritAttrs: false,
    props: ["value", "disabled"],
    emits: ["update:value"],
    template: "<button v-bind=\"$attrs\" type=\"button\" role=\"switch\" :aria-checked=\"value\" :disabled=\"disabled\" @click=\"$emit('update:value', !value)\"><slot v-if=\"value\" name=\"checked\" /><slot v-else name=\"unchecked\" /></button>",
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

function mountModal(overrides: { agent?: any, damageConfig?: any, meta?: any, skillCatalog?: any, cinemaLevel?: number, combatEffects?: any[] } = {}) {
  const agent = overrides.agent ?? miyabi
  const skillCatalog = overrides.skillCatalog
    ?? (agentSkillsData as any).agentSkills.find((skill: any) => skill.id === agent?.id)
    ?? miyabiSkillCatalog
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
      cinemaLevel: overrides.cinemaLevel ?? 0,
      combatEffects: overrides.combatEffects ?? [],
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

function readonlyDetailText() {
  return Array.from(document.body.querySelectorAll(".calculation-readonly-value"))
    .map(element => element.textContent?.trim())
    .filter(Boolean)
}

afterEach(() => {
  for (const wrapper of wrappers) {
    wrapper.unmount()
  }
  wrappers = []
  document.body.innerHTML = ""
})

describe("CalculationConfigModal", () => {
  it("restores the saved configuration after cancelling draft changes", async () => {
    const wrapper = mountModal()
    await openModal(wrapper)
    const modeSelect = selectComponentWithOption(wrapper, "custom")
    await modeSelect!.vm.$emit("update:value", "custom")
    await nextTick()

    const cancelButton = Array.from(document.body.querySelectorAll("button"))
      .find(button => button.textContent?.trim() === "取消")
    cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted("save")).toBeUndefined()

    await wrapper.setProps({ show: false })
    await openModal(wrapper)
    expect((await saveModal(wrapper)).mode).toBe("adminDefault")
  })

  it("locks event structure while keeping right-side skill selection editable for single-skill objectives", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "single",
        selectedEventId: "direct-1",
        events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const modeOptions = selectLabelsWithOption(wrapper, "custom")
    expect(modeOptions).toContain("最大化单个技能伤害")
    expect(modeOptions).not.toContain("最大化贯穿伤害")
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .map(button => button.textContent?.trim())
      .filter(text => ["添加技能", "添加贯穿", "添加异常事件", "添加技能组", "紊乱"].includes(text ?? ""))
    expect(addButtons).toEqual([])
    expect(document.body.querySelector(".calculation-event-inline-actions")).toBeNull()

    const moveSelect = selectComponentWithOption(wrapper, "windflower_frost")
    expect(moveSelect).toBeTruthy()
    expect(moveSelect?.props("disabled")).not.toBe(true)
    const moveOptions = (moveSelect?.props("options") as Array<{ value: string }> | undefined) ?? []
    const nextMoveId = moveOptions.find(option => option.value !== moveSelect?.props("value"))?.value
    expect(nextMoveId).toBeTruthy()
    await moveSelect!.vm.$emit("update:value", nextMoveId)
    await nextTick()
    expect(document.body.querySelector(".calculation-readonly-tag")).toBeNull()

    const stunSwitch = wrapper.findComponent('[data-testid="event-stunned-switch"]')
    expect(stunSwitch.exists()).toBe(true)
    await stunSwitch.vm.$emit("update:value", false)
    await nextTick()
    expect(document.body.textContent).toContain("未失衡")

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("single")
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0].skillRef.moveId).toBe(nextMoveId)
    expect(saved.events[0].stunned).toBe(false)
  })

  it("locks event structure while keeping right-side skill selection editable for sheer objectives", async () => {
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
    expect(modeOptions).not.toContain("最大化单个技能伤害")
    expect(modeOptions).toContain("最大化贯穿伤害")
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .map(button => button.textContent?.trim())
      .filter(text => ["添加技能", "添加贯穿", "添加异常事件", "添加技能组", "紊乱"].includes(text ?? ""))
    expect(addButtons).toEqual([])
    expect(document.body.querySelector(".calculation-event-inline-actions")).toBeNull()

    const listTitle = document.body.querySelector(".calculation-event-copy strong")?.textContent ?? ""
    const detailTitle = document.body.querySelectorAll(".panel-title")[1]?.textContent ?? ""
    expect(listTitle).not.toContain("贯穿 ·")
    expect(detailTitle).toContain("贯穿 ·")

    const moveSelect = selectComponentWithOption(wrapper, "ink_shadow_condensing_cloud")
    expect(moveSelect).toBeTruthy()
    expect(moveSelect?.props("disabled")).not.toBe(true)
    const moveOptions = (moveSelect?.props("options") as Array<{ value: string }> | undefined) ?? []
    const nextMoveId = moveOptions.find(option => option.value !== moveSelect?.props("value"))?.value
    expect(nextMoveId).toBeTruthy()
    await moveSelect!.vm.$emit("update:value", nextMoveId)
    await nextTick()

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("sheer")
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0].skillRef.moveId).toBe(nextMoveId)
  })

  it("locks event structure while keeping right-side anomaly selection editable", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "anomaly",
        selectedEventId: "anomaly-1",
        events: [{ id: "anomaly-1", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", procCount: 1, count: 1 }],
      },
    })

    await openModal(wrapper)

    expect(document.body.querySelector(".calculation-event-inline-actions")).toBeNull()
    expect(Array.from(document.body.querySelectorAll(".toolbar button"))
      .some(button => button.textContent?.trim().startsWith("添加"))).toBe(false)

    const settlementSelector = document.body.querySelector('[data-testid="anomaly-settlement-selector"]')
    const settlementButtons = wrapper.findAllComponents({ name: "RadioButton" })
    expect(settlementSelector?.nextElementSibling?.classList.contains("calculation-editor-grid")).toBe(true)
    expect(settlementSelector?.textContent).toContain("结算类型")
    expect(settlementButtons.map(button => button.props("label"))).toEqual(["属性异常", "紊乱结算"])
    expect(wrapper.findComponent({ name: "RadioGroup" }).props("value")).toBe("attribute")
    expect(selectComponentWithOption(wrapper, "disorder")).toBeUndefined()

    const anomalySelect = selectComponentWithOption(wrapper, "assault")
    expect(anomalySelect).toBeTruthy()
    expect(anomalySelect?.props("disabled")).not.toBe(true)
    const anomalyOptions = (anomalySelect?.props("options") as Array<{ value: string }> | undefined) ?? []
    const nextEffectId = anomalyOptions.find(option => option.value !== anomalySelect?.props("value"))?.value
    expect(nextEffectId).toBeTruthy()
    await anomalySelect!.vm.$emit("update:value", nextEffectId)
    await nextTick()

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("anomaly")
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0].anomalyEffect).toBe(nextEffectId)
  })

  it("switches anomaly settlement through the prominent segmented control", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "anomaly-1",
        events: [{ id: "anomaly-1", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", procCount: 3, count: 1 }],
      },
    })

    await openModal(wrapper)

    const settlementButton = (value: string) => wrapper.findAllComponents({ name: "RadioButton" })
      .find(button => button.props("value") === value)

    await settlementButton("disorder")!.vm.$emit("click")
    await nextTick()

    expect(wrapper.findComponent({ name: "RadioGroup" }).props("value")).toBe("disorder")
    expect(document.body.textContent).toContain("原异常")
    expect(document.body.textContent).toContain("紊乱类型")
    expect(document.body.textContent).not.toContain("触发次数")
    expect(document.body.querySelector(".disorder-explanation")).toBeTruthy()
    expect(selectComponentWithOption(wrapper, "frost_frozen")?.props("value")).toBe("frost_frozen")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("2,100%")

    await settlementButton("attribute")!.vm.$emit("click")
    await nextTick()

    expect(wrapper.findComponent({ name: "RadioGroup" }).props("value")).toBe("attribute")
    expect(document.body.textContent).toContain("触发次数")
    expect(document.body.textContent).not.toContain("原异常")
    expect(document.body.querySelector(".disorder-explanation")).toBeNull()
    expect(selectComponentWithOption(wrapper, "assault")?.props("value")).toBe("shatter")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("500%")

    const saved = await saveModal(wrapper)
    expect(saved.events[0]).toMatchObject({
      kind: "anomaly",
      settlementType: "attribute",
      procCount: 1,
    })
    expect(saved.events[0]).not.toHaveProperty("disorderType")
    expect(saved.events[0]).not.toHaveProperty("elapsedSeconds")
  })

  it("uses Alice defaults in both settlement directions and never leaks Flinch into attribute anomaly", async () => {
    const wrapper = mountModal({
      agent: alice,
      damageConfig: {
        mode: "custom",
        selectedEventId: "alice-anomaly",
        events: [{ id: "alice-anomaly", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", procCount: 1, count: 1 }],
      },
    })
    await openModal(wrapper)

    const settlementButton = (value: string) => wrapper.findAllComponents({ name: "RadioButton" })
      .find(button => button.props("value") === value)
    await settlementButton("disorder")!.vm.$emit("click")
    await nextTick()
    expect(selectComponentWithOption(wrapper, "flinch")?.props("value")).toBe("flinch")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("525%")

    await settlementButton("attribute")!.vm.$emit("click")
    await nextTick()
    expect(selectComponentWithOption(wrapper, "assault")?.props("value")).toBe("assault")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("713%")

    const saved = await saveModal(wrapper)
    expect(saved.events[0]).toMatchObject({ settlementType: "attribute", anomalyEffect: "assault" })
  })

  it("repairs an invalid saved attribute anomaly before rendering its multiplier", async () => {
    const wrapper = mountModal({
      agent: alice,
      damageConfig: {
        mode: "custom",
        selectedEventId: "invalid-attribute",
        events: [{ id: "invalid-attribute", kind: "anomaly", settlementType: "attribute", anomalyEffect: "flinch", procCount: 1, count: 1 }],
      },
    })
    await openModal(wrapper)

    expect(selectComponentWithOption(wrapper, "assault")?.props("value")).toBe("assault")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("713%")
    expect(document.body.textContent).not.toContain("当前倍率 -")
    expect((await saveModal(wrapper)).events[0].anomalyEffect).toBe("assault")
  })

  it("renders target events as a full selectable list", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    const items = Array.from(document.body.querySelectorAll(".calculation-event-list-item"))
    expect(items).toHaveLength(8)
    expect(document.body.querySelector(".calculation-event-list select")).toBeNull()
    const listTitle = items[0].querySelector("strong")?.textContent ?? ""
    expect(listTitle).toBe("强化普攻：霜月 / 三段蓄力斩击伤害倍率")
    const skillRow = miyabiSkillCatalog.categories
      .flatMap((category: any) => category.moves)
      .find((move: any) => move.id === "frost_moon")
      ?.rows.find((row: any) => row.id === "charge_3")
    const expectedMultiplier = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(skillRow.values[11])
    expect(items[0].querySelector("small")?.textContent).toContain(`当前倍率 ${expectedMultiplier}%`)
    expect(listTitle).not.toContain("直伤 ·")
    expect(document.body.querySelectorAll(".panel-title")[1].textContent).toContain("紊乱 · 烈霜霜寒紊乱（星见雅）")
    expect(document.body.textContent).not.toContain("miyabi_frost_moon_charge_3")
    expect(document.body.textContent).not.toMatch(/\bcharge_3\b/)
  })

  it("shows live event multipliers, hides the ratio editor, and normalizes elapsed time by catalog interval", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "scaled-assault",
        events: [
          { id: "scaled-assault", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", procCount: 1, count: 7, damageRatioPct: 2.5 },
          { id: "burn-disorder", kind: "anomaly", settlementType: "disorder", anomalyEffect: "burn", disorderType: "normal", elapsedSeconds: 0, count: 9 },
        ],
      },
    })

    await openModal(wrapper)

    const items = Array.from(document.body.querySelectorAll(".calculation-event-list-item"))
    expect(items[0].querySelector("small")?.textContent).toContain("当前倍率 17.825% · 次数 ×7")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("17.825%")
    expect(document.body.textContent).not.toContain("伤害比例")
    expect(document.body.querySelector('[aria-label="事件伤害比例"]')).toBeNull()

    items[1].querySelector(".calculation-event-select")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()

    const elapsedControl = wrapper.findAllComponents({ name: "InputNumber" })
      .find(component => component.props("step") === 0.5)
    expect(elapsedControl).toBeTruthy()
    expect(elapsedControl?.props("max")).toBeUndefined()
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("1,450%")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("当前倍率")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("450% + 20 × 50% = 1,450%")

    await elapsedControl!.vm.$emit("update:value", 0.6)
    await nextTick()

    expect(elapsedControl!.props("value")).toBe(0.5)
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("1,400%")
    expect(items[1].querySelector("small")?.textContent).toContain("当前倍率 1,400% · 次数 ×9")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("10.0 - 0.5 = 9.5 秒")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("floor(T / 0.5) = floor(9.5 / 0.5) = 19 段")

    await elapsedControl!.vm.$emit("update:value", 12.4)
    await nextTick()
    expect(elapsedControl!.props("value")).toBe(12.5)
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("450%")

    const saved = await saveModal(wrapper)
    expect(saved.events[1].elapsedSeconds).toBe(12.5)
    expect(saved.events[0].damageRatioPct).toBe(2.5)
  })

  it("explains frost, burn, and shock disorder timing with the selected catalog interval", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "frost-disorder",
        events: [{
          id: "frost-disorder",
          kind: "anomaly",
          settlementType: "disorder",
          anomalyEffect: "frost_frozen",
          disorderType: "normal",
          elapsedSeconds: 4.5,
          count: 1,
        }],
      },
    })

    await openModal(wrapper)

    const explanation = () => document.body.querySelector(".disorder-explanation")?.textContent ?? ""
    const elapsedControl = () => wrapper.findAllComponents({ name: "InputNumber" })
      .find(component => component.attributes("aria-label") === "异常已流逝秒数")
    expect(elapsedControl()?.props("step")).toBe(1)
    expect(elapsedControl()?.props("precision")).toBe(0)
    expect(elapsedControl()?.props("value")).toBe(5)
    expect(explanation()).toContain("本次计算时长上限")
    expect(explanation()).toContain("20.0 秒")
    expect(explanation()).toContain("20.0 - 5.0 = 15.0 秒")
    expect(explanation()).toContain("floor(T) = floor(15.0) = 15 段")
    expect(explanation()).toContain("600% + 15 × 75% = 1,725%")
    expect(explanation()).toContain("灼烧、侵蚀每0.5秒一段；感电、畏缩、霜寒、烈霜霜寒每1秒一段")
    expect(explanation()).not.toContain("角色效果带来的异常持续时间延长会在最终伤害与白盒中结算")
    expect(explanation()).not.toContain("这里展示的是事件倍率，不是最终伤害")

    const disorderSelect = selectComponentWithOption(wrapper, "frost_frozen")
    await disorderSelect!.vm.$emit("update:value", "burn")
    await nextTick()
    expect(elapsedControl()?.props("step")).toBe(0.5)
    expect(elapsedControl()?.props("precision")).toBe(1)
    expect(explanation()).toContain("10.0 - 5.0 = 5.0 秒")
    expect(explanation()).toContain("floor(T / 0.5) = floor(5.0 / 0.5) = 10 段")
    expect(explanation()).toContain("450% + 10 × 50% = 950%")

    await elapsedControl()!.vm.$emit("update:value", 4.5)
    await nextTick()
    expect(elapsedControl()?.props("value")).toBe(4.5)

    await disorderSelect!.vm.$emit("update:value", "shock")
    await nextTick()
    expect(elapsedControl()?.props("step")).toBe(1)
    expect(elapsedControl()?.props("precision")).toBe(0)
    expect(elapsedControl()?.props("value")).toBe(5)
    expect(explanation()).toContain("floor(T) = floor(5.0) = 5 段")
    expect(explanation()).toContain("450% + 5 × 125% = 1,075%")
  })

  it("applies resolved Jane duration buffs to Flinch timing, multiplier, list summary, and notes", async () => {
    const wrapper = mountModal({
      agent: alice,
      damageConfig: {
        mode: "custom",
        selectedEventId: "flinch-disorder",
        events: [{ id: "flinch-disorder", kind: "anomaly", settlementType: "disorder", anomalyEffect: "flinch", disorderType: "normal", elapsedSeconds: 0, count: 1 }],
      },
      combatEffects: [{
        key: "jane_doe.core_passive.f",
        name: { zhCN: "简｜核心被动（F级）" },
        resolvedDamageModifiers: [{
          kind: "anomalyDurationBonusSeconds",
          value: 5,
          appliesTo: { damageKinds: ["disorder"], anomalyEffects: ["flinch"] },
        }],
      }],
    })
    await openModal(wrapper)

    const explanation = () => document.body.querySelector(".disorder-explanation")?.textContent ?? ""
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("562.5%")
    expect(document.body.querySelector(".calculation-event-list-item small")?.textContent).toContain("当前倍率 562.5%")
    expect(explanation()).toContain("15.0 秒")
    expect(explanation()).toContain("450% + 15 × 7.5% = 562.5%")
    expect(explanation()).toContain("简｜核心被动（F级）：畏缩持续时间 +5.0 秒（10.0 → 15.0 秒）")

    await selectComponentWithOption(wrapper, "flinch")!.vm.$emit("update:value", "burn")
    await nextTick()
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("1,450%")
    expect(explanation()).toContain("10.0 秒")
    expect(explanation()).not.toContain("简｜核心被动（F级）")
  })

  it("includes resolved Disorder multiplier additions in the formula and source notes", async () => {
    const wrapper = mountModal({
      agent: alice,
      damageConfig: {
        mode: "custom",
        selectedEventId: "flinch-disorder",
        events: [{ id: "flinch-disorder", kind: "anomaly", settlementType: "disorder", anomalyEffect: "flinch", disorderType: "normal", elapsedSeconds: 0, count: 1 }],
      },
      combatEffects: [{
        key: "youye.cinema_6.disorder_multiplier_bonus",
        name: { zhCN: "浮波柚叶｜影画六" },
        resolvedDamageModifiers: [{
          kind: "disorderBaseMultiplierBonus",
          value: 1.05,
          appliesTo: { damageKinds: ["disorder"] },
        }],
      }],
    })
    await openModal(wrapper)

    const explanation = document.body.querySelector(".disorder-explanation")?.textContent ?? ""
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("630%")
    expect(explanation).toContain("525% + 105% = 630%")
    expect(explanation).toContain("浮波柚叶｜影画六：紊乱倍率 +105%")
  })

  it("preserves elapsed time beyond the base duration when switching disorder types", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "frost-disorder",
        events: [{
          id: "frost-disorder",
          kind: "anomaly",
          settlementType: "disorder",
          anomalyEffect: "frost_frozen",
          disorderType: "normal",
          elapsedSeconds: 15.5,
          count: 1,
        }],
      },
    })

    await openModal(wrapper)
    const disorderSelect = selectComponentWithOption(wrapper, "frost_frozen")
    await disorderSelect!.vm.$emit("update:value", "burn")
    await nextTick()

    const elapsedControl = wrapper.findAllComponents({ name: "InputNumber" })
      .find(component => component.props("step") === 0.5)
    expect(elapsedControl?.props("value")).toBe(16)
    expect(elapsedControl?.props("max")).toBeUndefined()
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("10.0 - 10.0 = 0.0 秒")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("450% + 0 × 50% = 450%")
  })

  it("shows polarized and event-ratio steps while keeping the final preview aligned", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "scaled-polarized-frost",
        events: [{
          id: "scaled-polarized-frost",
          kind: "anomaly",
          settlementType: "disorder",
          anomalyEffect: "frost_frozen",
          disorderType: "polarized",
          elapsedSeconds: 4.5,
          damageRatioPct: 25,
          count: 1,
        }],
      },
    })

    await openModal(wrapper)

    const explanation = document.body.querySelector(".disorder-explanation")?.textContent ?? ""
    expect(explanation).toContain("基础紊乱倍率")
    expect(explanation).toContain("20.0 - 5.0 = 15.0 秒")
    expect(explanation).toContain("1,725% × 25% = 431.25%")
    expect(explanation).toContain("431.25% × 25% = 107.813%")
    expect(document.body.querySelector(".calculation-current-multiplier")?.textContent).toBe("107.813%")
  })

  it("only renders the multiplier explanation for disorder events", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "direct-1",
        events: [
          { id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 },
          { id: "anomaly-1", kind: "anomaly", settlementType: "attribute", anomalyEffect: "assault", procCount: 1, count: 1 },
        ],
      },
    })

    await openModal(wrapper)
    expect(document.body.querySelector(".disorder-explanation")).toBeNull()
    expect(document.body.querySelector('[data-testid="anomaly-settlement-selector"]')).toBeNull()

    document.body.querySelectorAll(".calculation-event-select")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(document.body.querySelector(".disorder-explanation")).toBeNull()
    expect(document.body.querySelector('[data-testid="anomaly-settlement-selector"]')).toBeTruthy()
  })

  it("keeps add, copy, and delete controls available as labeled icon actions in custom mode", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "direct-1",
        events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const copyButton = document.body.querySelector('button[aria-label="复制目标事件"]') as HTMLButtonElement
    const deleteButton = document.body.querySelector('button[aria-label="删除目标事件"]') as HTMLButtonElement
    expect(copyButton).toBeTruthy()
    expect(copyButton.title).toBe("复制目标事件")
    expect(deleteButton).toBeTruthy()
    expect(deleteButton.title).toBe("删除目标事件")
    expect(Array.from(document.body.querySelectorAll(".calculation-add-toolbar button"))
      .map(button => button.textContent?.trim())).toEqual(["添加技能", "添加异常事件", "添加技能组"])

    copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(document.body.querySelectorAll(".calculation-event-list-item")).toHaveLength(2)

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("custom")
    expect(saved.events).toHaveLength(2)
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

  it("renders admin default skill and anomaly events as high-contrast static details", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    expect(document.body.querySelector(".calculation-event-inline-actions")).toBeNull()
    const addButtons = Array.from(document.body.querySelectorAll(".toolbar button"))
      .filter(button => ["添加技能", "添加贯穿", "添加异常事件", "添加技能组", "紊乱"].includes(button.textContent?.trim() ?? ""))
    expect(addButtons).toHaveLength(0)
    expect(document.body.querySelector(".calculation-readonly-tag")?.textContent).toContain("管理员配置 · 只读")
    document.body.querySelectorAll(".calculation-event-select")[0]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(readonlyDetailText()).toEqual(expect.arrayContaining([
      "4",
      "普通攻击",
      "强化普攻：霜月",
      "三段蓄力斩击伤害倍率",
      "期望",
      "是",
    ]))
    const editor = document.body.querySelector(".calculation-editor-panel") as HTMLElement
    expect(editor.querySelector("input")).toBeNull()
    expect(editor.querySelector("select")).toBeNull()
    expect(editor.querySelector("button")).toBeNull()
    expect(editor.textContent).not.toContain("选择技能倍率")
    expect(editor.querySelector(".calculation-readonly-summary")?.textContent)
      .toContain("普通攻击 / 强化普攻：霜月 / 三段蓄力斩击伤害倍率")

    document.body.querySelectorAll(".calculation-event-select")[4]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(readonlyDetailText()).toEqual(expect.arrayContaining([
      "2",
      "紊乱结算",
      "烈霜霜寒紊乱（星见雅）",
      "普通紊乱",
      "4 秒",
    ]))
    const readonlySettlement = document.body.querySelector('[data-testid="anomaly-settlement-selector"]')
    expect(readonlySettlement?.textContent).toContain("结算类型")
    expect(readonlySettlement?.textContent).toContain("紊乱结算")
    expect(readonlySettlement?.querySelector('[role="radiogroup"]')).toBeNull()
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("紊乱倍率说明")
    expect(document.body.querySelector(".disorder-explanation")?.textContent).toContain("20.0 - 4.0 = 16.0 秒")
    expect(document.body.textContent).not.toContain("frost_frozen")

    document.body.querySelectorAll(".calculation-event-select")[5]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(readonlyDetailText()).toEqual(expect.arrayContaining(["2", "属性异常", "碎冰", "1"]))
    expect(document.body.querySelector(".disorder-explanation")).toBeNull()

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("adminDefault")
    expect(saved.selectedEventId).toBe(miyabi.defaultCalculationConfig.selectedEventId)
    expect(saved.events).toEqual(clone(miyabi.defaultCalculationConfig.events).map((event: any) => ({
      ...event,
      stunned: event.stunned !== false,
    })))
  })

  it("renders admin default sheer events as static details", async () => {
    const wrapper = mountModal({
      agent: yixuan,
      skillCatalog: yixuanSkillCatalog,
      damageConfig: {
        ...clone(yixuan.defaultCalculationConfig),
        mode: "adminDefault",
      },
    })

    await openModal(wrapper)

    expect(document.body.querySelector(".calculation-readonly-tag")?.textContent).toContain("管理员配置 · 只读")
    expect(readonlyDetailText()).toEqual(expect.arrayContaining([
      "2",
      "是",
      "468.6%",
      "特殊技",
      "强化特殊技：墨烬影消",
      "总伤害倍率",
      "期望",
    ]))
    expect(document.body.querySelectorAll(".panel-title")[1].textContent).toContain("贯穿 ·")
    expect(document.body.querySelector(".calculation-editor-panel input")).toBeNull()
    expect(document.body.querySelector(".calculation-editor-panel select")).toBeNull()
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

  it("uses consistent disorder names for source anomalies with shared ids", async () => {
    const wrapper = mountModal({
      damageConfig: {
        mode: "custom",
        selectedEventId: "burn-disorder",
        events: [{
          id: "burn-disorder",
          kind: "anomaly",
          settlementType: "disorder",
          anomalyEffect: "burn",
          disorderType: "normal",
          elapsedSeconds: 0,
          count: 1,
        }],
      },
    })

    await openModal(wrapper)

    const disorderSelect = selectComponentWithOption(wrapper, "burn")
    const labels = (disorderSelect?.props("options") as Array<{ label: string }> | undefined) ?? []
    expect(labels.map(option => option.label)).toEqual([
      "灼烧紊乱",
      "感电紊乱",
      "侵蚀紊乱",
      "霜寒紊乱",
      "烈霜霜寒紊乱（星见雅）",
      "畏缩紊乱",
    ])
    expect(document.body.querySelectorAll(".panel-title")[1].textContent).toContain("紊乱 · 灼烧紊乱")
  })

  it("keeps optimizer constraints out of the event management modal", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    expect(document.body.textContent).not.toContain("优化约束")
    expect(document.body.textContent).not.toContain("4号位主词条")
    await saveModal(wrapper)
    expect(wrapper.emitted("save-optimizer")).toBeUndefined()
  })

  it("adds editable skill group references to custom events", async () => {
    const wrapper = mountModal({
      agent: miyabiWithSkillGroups,
      damageConfig: {
        mode: "custom",
        selectedEventId: "direct-1",
        events: [{ id: "direct-1", kind: "direct", skillMultiplier: 100, count: 1 }],
      },
    })

    await openModal(wrapper)

    const addSkillGroupButton = Array.from(document.body.querySelectorAll("button"))
      .find(button => button.textContent?.trim() === "添加技能组")
    expect(addSkillGroupButton).toBeTruthy()
    addSkillGroupButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()

    expect(document.body.textContent).toContain("技能组 · 一变")
    const countInput = document.body.querySelector(".calculation-editor-grid input") as HTMLInputElement
    countInput.value = "3"
    countInput.dispatchEvent(new Event("input", { bubbles: true }))
    await nextTick()

    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("custom")
    expect(saved.events).toHaveLength(2)
    expect(saved.events[1]).toMatchObject({
      kind: "skillGroup",
      skillGroupId: "loop",
      count: 3,
    })
  })

  it("gives skill group count and long group names dedicated editor space", async () => {
    const agent = JSON.parse(JSON.stringify(miyabiWithSkillGroups))
    agent.skillGroups[0].name.zhCN = "2命叶变身短轴（不含归尘）"
    const wrapper = mountModal({
      agent,
      damageConfig: {
        mode: "custom",
        selectedEventId: "loop-ref",
        events: [{ id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 12 }],
      },
    })

    await openModal(wrapper)

    const countField = document.body.querySelector(".calculation-skill-group-count-field") as HTMLElement
    const selectField = document.body.querySelector(".calculation-skill-group-select-field") as HTMLElement
    const summaryField = document.body.querySelector(".calculation-skill-group-summary-field") as HTMLElement
    const skillGroupSelect = selectComponentWithOption(wrapper, "loop")
    expect(countField.querySelector("input")?.getAttribute("value")).toBe("12")
    expect(skillGroupSelect?.props("value")).toBe("loop")
    expect(selectField.textContent).toContain("技能组")
    expect(selectLabelsWithOption(wrapper, "loop")).toContain("2命叶变身短轴（不含归尘）")
    expect(summaryField.textContent).toContain("1 项")
  })

  it("shows skill group child events as a read-only resolved preview", async () => {
    const wrapper = mountModal({
      agent: miyabiWithSkillGroups,
      damageConfig: {
        mode: "custom",
        selectedEventId: "loop-ref",
        events: [{ id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 10 }],
      },
    })

    await openModal(wrapper)

    const preview = document.body.querySelector(".skill-group-child-preview") as HTMLElement
    expect(preview).toBeTruthy()
    expect(preview.textContent).toContain("组内技能（只读）")
    expect(preview.textContent).toContain("强化普攻：霜月")
    expect(preview.textContent).toContain("三段蓄力斩击伤害倍率")
    expect(preview.textContent).toContain("当前倍率")
    expect(preview.textContent).toContain("组内次数 ×2")
    expect(preview.textContent).toContain("当前合计 ×20")
    expect(preview.textContent).not.toContain("手填倍率")
    expect(preview.querySelector("input")).toBeNull()
    expect(preview.querySelector("select")).toBeNull()

    const saved = await saveModal(wrapper)
    expect(saved.events).toEqual([
      expect.objectContaining({
        kind: "skillGroup",
        skillGroupId: "loop",
        count: 10,
      }),
    ])
  })

  it("refreshes the read-only skill group preview when the selected group changes", async () => {
    const wrapper = mountModal({
      agent: miyabiWithSkillGroups,
      damageConfig: {
        mode: "custom",
        selectedEventId: "loop-ref",
        events: [{ id: "loop-ref", kind: "skillGroup", skillGroupId: "loop", count: 10 }],
      },
    })

    await openModal(wrapper)

    expect(document.body.querySelector(".skill-group-child-preview")?.textContent).toContain("三段蓄力斩击伤害倍率")
    const skillGroupSelect = selectComponentWithOption(wrapper, "ultimate")
    expect(skillGroupSelect).toBeTruthy()
    await skillGroupSelect!.vm.$emit("update:value", "ultimate")
    await nextTick()

    const preview = document.body.querySelector(".skill-group-child-preview") as HTMLElement
    expect(preview.textContent).toContain("终结技")
    expect(preview.textContent).toContain("当前合计 ×10")
    expect(preview.textContent).not.toContain("三段蓄力斩击伤害倍率")
  })

  it("uses skill group references when the admin config has no base events", async () => {
    const wrapper = mountModal({
      agent: miyabiWithOnlySkillGroups,
      damageConfig: {
        mode: "adminDefault",
        selectedEventId: null,
        events: [],
      },
    })

    await openModal(wrapper)

    expect(document.body.querySelector(".calculation-readonly-tag")?.textContent).toContain("管理员配置 · 只读")
    expect(readonlyDetailText()).toEqual(expect.arrayContaining(["10", "一变", "1 项"]))
    expect(document.body.querySelector(".calculation-editor-panel input")).toBeNull()
    expect(document.body.querySelector(".calculation-editor-panel select")).toBeNull()
    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("adminDefault")
    expect(saved.selectedEventId).toBe("loop-ref-1")
    expect(saved.events.map((event: any) => event.kind)).toEqual(["skillGroup", "skillGroup"])
    expect(saved.events.map((event: any) => event.skillGroupId)).toEqual(["loop", "ultimate"])
    expect(saved.events.map((event: any) => event.count)).toEqual([10, 2])
  })

  it("uses the role admin default instead of stale saved admin events", async () => {
    const wrapper = mountModal({
      agent: miyabiWithSkillGroups,
      damageConfig: {
        mode: "adminDefault",
        selectedEventId: "stale-direct",
        events: [{ id: "stale-direct", kind: "direct", skillMultiplier: 100, count: 10 }],
      },
    })

    await openModal(wrapper)

    expect(document.body.textContent).toContain("技能组 · 一变")
    expect(document.body.textContent).not.toContain("快剑")
    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("adminDefault")
    expect(saved.selectedEventId).toBe("loop-ref")
    expect(saved.events.map((event: any) => event.kind)).toEqual(["skillGroup", "skillGroup"])
  })

  it("uses the current-cinema admin default variant instead of stale saved events", async () => {
    const agent = {
      id: "agent_variant",
      name: { zhCN: "变体角色" },
      specialty: "attack",
      defaultCalculationConfig: {
        mode: "custom",
        selectedEventId: "loop-0",
        events: [{ id: "loop-0", kind: "direct", count: 1, skillMultiplier: 100 }],
        variants: [
          {
            cinemaLevel: 2,
            mode: "custom",
            selectedEventId: "loop-2",
            events: [{ id: "loop-2", kind: "direct", count: 2, skillMultiplier: 200 }],
          },
        ],
      },
    }
    const wrapper = mountModal({
      agent,
      skillCatalog: { id: "agent_variant", agentId: "agent_variant", categories: [] },
      cinemaLevel: 5,
      damageConfig: {
        mode: "adminDefault",
        selectedEventId: "stale-direct",
        events: [{ id: "stale-direct", kind: "direct", skillMultiplier: 50, count: 10 }],
      },
    })

    await openModal(wrapper)

    expect(document.body.textContent).toContain("默认循环（2影）")
    expect(document.body.textContent).not.toContain("stale-direct")
    const saved = await saveModal(wrapper)
    expect(saved.mode).toBe("adminDefault")
    expect(saved.selectedEventId).toBe("loop-2")
    expect(saved.events).toEqual([
      expect.objectContaining({ id: "loop-2", count: 2, skillMultiplier: 200 }),
    ])
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
