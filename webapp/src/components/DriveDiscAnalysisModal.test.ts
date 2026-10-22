import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import DriveDiscAnalysisModal from "@/components/DriveDiscAnalysisModal.vue"
import {
  analyzeDriveDiscStatDiffs,
  analyzeDriveDiscStatGains,
  analyzeDriveDiscSubstats,
} from "@core/driveDiscAnalysis-core.js"

vi.mock("@core/driveDiscAnalysis-core.js", () => ({
  analyzeDriveDiscStatDiffs: vi.fn(() => ({
    baseline: { finalDamage: 1000 },
    substatDiffs: [{
      stat: "critRate",
      mode: "pct",
      currentValue: 4.8,
      addedValue: 2.4,
      absoluteDiff: 120.75,
      relativeDiff: 0.12,
    }],
    substatReplacements: [{
      stat: "atkPct",
      mode: "pct",
      removedValue: 3,
      candidates: [{
        stat: "critRate",
        mode: "pct",
        addedValue: 2.4,
        absoluteDiff: 80.25,
        relativeDiff: 0.08,
      }],
    }],
    mainStatDiffsBySlot: {
      "4": {
        slot: 4,
        source: "preferredDriveDiscs",
        current: { stat: "critRate", mode: "pct", value: 24 },
        candidates: [{
          stat: "critDmg",
          mode: "pct",
          value: 48,
          absoluteDiff: 60.5,
          relativeDiff: 0.06,
        }],
      },
    },
  })),
  analyzeDriveDiscSubstats: vi.fn(() => ({
    driveDiscCount: 6,
    totalEffectiveRolls: 5,
    stats: [{
      stat: "critRate",
      mode: "pct",
      value: 4.8,
      step: 2.4,
      effectiveRolls: 2,
      occurrenceCount: 1,
    }],
  })),
  analyzeDriveDiscStatGains: vi.fn(() => ({
    maxRolls: 10,
    baseline: { finalDamage: 1000 },
    stats: [{
      stat: "critRate",
      mode: "pct",
      step: 2.4,
      points: [
        { rolls: 1, addedValue: 2.4, finalDamage: 1100, absoluteGain: 100.75, relativeGain: 0.1 },
        { rolls: 2, addedValue: 4.8, finalDamage: 1175, absoluteGain: 175, relativeGain: 0.175 },
      ],
    }],
  })),
}))

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled", "type", "size"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
  },
  NModal: {
    props: ["show"],
    emits: ["update:show"],
    template: "<section v-if=\"show\"><slot /></section>",
  },
}))

const input = {
  driveDiscs: Array.from({ length: 6 }, (_, index) => ({
    id: `disc-${index + 1}`,
    partition: index + 1,
    mainStat: { stat: "atkPct", value: 30 },
    subStats: [],
  })),
}

const meta = {
  statRules: {
    statDisplay: {
      atkPct: { label: "攻击力%" },
      critRate: { label: "暴击率" },
      critDmg: { label: "暴击伤害" },
    },
  },
}

function mountModal() {
  return mount(DriveDiscAnalysisModal, {
    props: {
      show: true,
      catalog: {},
      meta,
      input,
    },
  })
}

describe("DriveDiscAnalysisModal", () => {
  it("renders detailed diff, substat, and gain views for the current calculation scheme", async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain("副词条差异计算")
    expect(wrapper.text()).toContain("已有副词条替换参考")
    expect(wrapper.text()).toContain("主词条差异计算")
    expect(wrapper.text()).toContain("角色优先配置")
    expect(wrapper.text()).toContain("+121")
    expect(wrapper.text()).not.toContain("+120.75")
    expect(wrapper.find(".analysis-context").exists()).toBe(false)
    expect(wrapper.findAll(".analysis-summary-grid")).toHaveLength(0)
    expect(wrapper.text()).not.toContain("刷新")

    const buttons = wrapper.findAll("button")
    await buttons.find(button => button.text().includes("当前副词条"))?.trigger("click")

    expect(wrapper.text()).toContain("出现次数")
    expect(wrapper.findAll(".analysis-summary-grid")).toHaveLength(0)

    await buttons.find(button => button.text().includes("收益曲线"))?.trigger("click")

    expect(wrapper.text()).toContain("累计提升")
    expect(wrapper.text()).toContain("下一条累计提升")
    expect(wrapper.findAll(".analysis-summary-grid")).toHaveLength(0)

    await wrapper.findAll("button").find(button => button.text().includes("边际收益"))?.trigger("click")

    expect(wrapper.text()).toContain("第1条边际收益")
  })

  it("ranks substat gains as bars with only the best value labelled", async () => {
    vi.mocked(analyzeDriveDiscStatDiffs).mockReturnValueOnce({
      ...vi.mocked(analyzeDriveDiscStatDiffs).getMockImplementation()!(),
      substatDiffs: [
        { stat: "atkPct", mode: "pct", currentValue: 3, addedValue: 3, absoluteDiff: 30, relativeDiff: 0.03 },
        { stat: "critDmg", mode: "pct", currentValue: 4.8, addedValue: 4.8, absoluteDiff: 150, relativeDiff: 0.15 },
        { stat: "critRate", mode: "pct", currentValue: 4.8, addedValue: 2.4, absoluteDiff: -5, relativeDiff: -0.005 },
        { stat: "atkFlat", mode: "flat", currentValue: 19, addedValue: 19, absoluteDiff: 10, relativeDiff: 0.01 },
      ],
    } as any)
    const wrapper = mountModal()
    await flushPromises()

    const rows = wrapper.findAll("[data-testid='substat-gain-bars'] .gain-bar-row")
    // 攻击力百分比与固定值同名时补上区分
    expect(rows.map(row => row.get(".gain-bar-name").text())).toEqual(["暴击伤害", "攻击力%", "攻击力（固定）", "暴击率"])
    expect(rows.map(row => row.classes().includes("is-best"))).toEqual([true, false, false, false])
    expect(rows.map(row => (row.get(".gain-bar-fill").element as HTMLElement).style.width)).toEqual(["100%", "20%", "6.666666666666667%", "0%"])
    expect(rows[0]!.attributes("aria-label")).toBe("暴击伤害：伤害 +150（+15%）")
    expect(rows[0]!.attributes("tabindex")).toBe("0")
    // 精确数值仍保留在下方表格
    expect(wrapper.find(".analysis-table").exists()).toBe(true)
  })

  it("keeps automatic analysis refresh when the input changes", async () => {
    const wrapper = mountModal()
    await flushPromises()
    const initialCalls = analyzeDriveDiscStatDiffs.mock.calls.length

    await wrapper.setProps({ input: { ...input, driveDiscs: [...input.driveDiscs] } })
    await flushPromises()

    expect(analyzeDriveDiscStatDiffs.mock.calls.length).toBeGreaterThan(initialCalls)
    expect(analyzeDriveDiscSubstats).toHaveBeenCalled()
    expect(analyzeDriveDiscStatGains).toHaveBeenCalled()
  })
})
