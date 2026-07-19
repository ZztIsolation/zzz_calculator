import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import OptimizerConfigModal from "@/components/OptimizerConfigModal.vue"

const naiveStubs = {
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
  NInputNumber: {
    props: {
      value: { default: null },
      disabled: Boolean,
      min: Number,
      precision: Number,
      step: { type: Number, default: 1 },
    },
    emits: ["update:value"],
    template: "<input type=\"number\" :value=\"value\" :disabled=\"disabled\" :step=\"step\" @input=\"$emit('update:value', Number($event.target.value))\">",
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
  LayerSlider: {
    props: ["value"],
    emits: ["update:value"],
    template: "<input :value=\"value\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
}

let wrappers: Array<ReturnType<typeof mount>> = []

function mountModal(propOverrides: Record<string, any> = {}) {
  const wrapper = mount(OptimizerConfigModal, {
    attachTo: document.body,
    props: {
      show: false,
      optimizerConfig: {
        algorithm: "exact-super-bound",
        fourPieceBuffMode: "manual",
        fourPieceBuffRuntimeInputs: {},
        mainStatLimits: { "4": [], "5": [], "6": [] },
        minimums: {},
      },
      optimizerAlgorithmOptions: [
        { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
        { label: "启发式潜力", value: "heuristic-potential" },
      ],
      mainStatOptionsBySlot: {
        "4": [{ label: "暴击率", value: "critRate" }, { label: "暴击伤害", value: "critDmg" }],
        "5": [{ label: "攻击力%", value: "atkPct" }],
        "6": [{ label: "异常掌控", value: "anomalyMastery" }],
      },
      minimumStats: [
        { key: "atk", label: "攻击力" },
        { key: "anomalyProficiency", label: "异常精通" },
        { key: "critRate", label: "暴击率%" },
        { key: "critDmg", label: "暴击伤害%" },
      ],
      fourPieceRuntimeBuffs: [],
      ...propOverrides,
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

afterEach(() => {
  for (const wrapper of wrappers) {
    wrapper.unmount()
  }
  wrappers = []
  document.body.innerHTML = ""
})

describe("OptimizerConfigModal", () => {
  it("saves optimizer constraints from the dedicated optimization config modal", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    expect(document.body.textContent).toContain("优化约束")
    expect(document.body.textContent).toContain("计算配置")
    expect(document.body.textContent).toContain("4号位主词条")
    expect(document.body.textContent).toContain("攻击力")
    expect(document.body.textContent).toContain("异常精通")
    expect(document.body.textContent).toContain("以下四项均按局外面板数值判断，不计入局内 Buff。")
    expect(document.body.textContent).not.toContain("能量自动回复")

    const minimumInputs = document.body.querySelectorAll(".optimizer-minimum-grid input")
    expect(minimumInputs).toHaveLength(4)
    const minimumComponents = wrapper.findAllComponents({ name: "InputNumber" })
    expect(minimumComponents.map(input => input.props("value"))).toEqual([null, null, null, null])
    expect(minimumComponents.map(input => input.props("step"))).toEqual([50, 10, 10, 10])
    expect(minimumComponents.map(input => input.props("min"))).toEqual([0, 0, 0, 0])
    expect(minimumComponents.map(input => input.props("precision"))).toEqual([0, 0, 0, 0])

    for (const [index, value] of [2521, 257, 83, 167].entries()) {
      await minimumComponents[index].vm.$emit("update:value", value)
    }
    await nextTick()

    const algorithmSelect = selectComponentWithOption(wrapper, "heuristic-potential")
    expect(algorithmSelect).toBeTruthy()
    await algorithmSelect!.vm.$emit("update:value", "heuristic-potential")
    await nextTick()

    const mainStatToggle = document.body.querySelector(".main-stat-choice input")
    expect(mainStatToggle).toBeTruthy()
    mainStatToggle?.dispatchEvent(new Event("change", { bubbles: true }))
    await nextTick()

    const saved = await saveModal(wrapper)

    expect(saved).toMatchObject({
      algorithm: "heuristic-potential",
      fourPieceBuffMode: "manual",
      mainStatLimits: {
        "4": ["critRate"],
      },
      minimums: {
        atk: 2521,
        anomalyProficiency: 257,
        critRate: 83,
        critDmg: 167,
      },
    })
    expect(saved.minimums).not.toHaveProperty("energyRegen")
  })

  it("discards draft changes when cancelled", async () => {
    const wrapper = mountModal()
    await openModal(wrapper)
    const algorithmSelect = selectComponentWithOption(wrapper, "heuristic-potential")
    await algorithmSelect!.vm.$emit("update:value", "heuristic-potential")
    await nextTick()

    const cancelButton = Array.from(document.body.querySelectorAll("button"))
      .find(button => button.textContent?.trim() === "取消")
    cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted("save")).toBeUndefined()

    await wrapper.setProps({ show: false })
    await openModal(wrapper)
    expect((await saveModal(wrapper)).algorithm).toBe("exact-super-bound")
  })

  it("writes one stack value to every rule in a shared runtime group", async () => {
    const buff = {
      id: "shared-stack-runtime",
      name: { zhCN: "共享层数" },
      effects: [
        { id: "stack-dmg", type: "stacked", stat: "etherDmg", mode: "flat", valuePerStack: 8, maxStacks: 2, defaultStacks: 2, stackGroup: "shared", stackLabel: { zhCN: "共享层数" } },
        { id: "stack-sheer", type: "stacked", stat: "etherSheerDmg", mode: "flat", valuePerStack: 10, maxStacks: 2, defaultStacks: 2, stackGroup: "shared", stackLabel: { zhCN: "共享层数" } },
      ],
    }
    const wrapper = mountModal({
      optimizerConfig: {
        algorithm: "exact-super-bound",
        fourPieceBuffMode: "manual",
        fourPieceBuffRuntimeInputs: {},
        mainStatLimits: { "4": [], "5": [], "6": [] },
        minimums: {},
      },
      fourPieceRuntimeBuffs: [buff],
    })
    await openModal(wrapper)
    const stackInput = document.body.querySelector(".optimizer-runtime-layer input") as HTMLInputElement | null
    expect(stackInput).toBeTruthy()
    stackInput!.value = "1"
    stackInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await nextTick()
    const saved = await saveModal(wrapper)
    expect(saved.fourPieceBuffRuntimeInputs["shared-stack-runtime"].effects).toMatchObject({
      "stack-dmg": { stacks: 1 },
      "stack-sheer": { stacks: 1 },
    })
  })

  it("writes independent per-rule coverage and migrates legacy parent runtime", async () => {
    const buff = {
      id: "independent-coverage-runtime",
      name: { zhCN: "独立覆盖率" },
      effects: [
        { id: "covered-dmg", type: "fixed", stat: "dmgBonus", mode: "flat", value: 20, coverage: { default: 0.6, min: 0, max: 1, step: 0.1 } },
        { id: "fixed-crit", type: "fixed", stat: "critRate", mode: "flat", value: 10 },
      ],
    }
    const wrapper = mountModal({
      optimizerConfig: {
        algorithm: "exact-super-bound",
        fourPieceBuffMode: "manual",
        fourPieceBuffRuntimeInputs: { "independent-coverage-runtime": { coverage: 0.4 } },
        mainStatLimits: { "4": [], "5": [], "6": [] },
        minimums: {},
      },
      fourPieceRuntimeBuffs: [buff],
    })
    await openModal(wrapper)
    const inputs = document.body.querySelectorAll(".optimizer-coverage-metric input")
    expect(inputs).toHaveLength(1)
    expect((inputs[0] as HTMLInputElement).value).toBe("0.4")
    ;(inputs[0] as HTMLInputElement).value = "0.3"
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }))
    await nextTick()

    const saved = await saveModal(wrapper)
    const runtime = saved.fourPieceBuffRuntimeInputs["independent-coverage-runtime"]
    expect(runtime.coverage).toBeUndefined()
    expect(runtime.effects["covered-dmg"].coverage).toBe(0.3)
    expect(runtime.effects["fixed-crit"].coverage).toBeUndefined()
  })
})
