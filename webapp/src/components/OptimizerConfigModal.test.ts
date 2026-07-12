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
        minimums: { energyRegen: null, anomalyProficiency: null, critRate: 50, critDmg: null },
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
        critRate: 50,
      },
    })
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
})
