import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import DriveDiscAnalysisModal from "@/components/DriveDiscAnalysisModal.vue"

vi.mock("@core/driveDiscAnalysis-core.js", () => ({
  analyzeDriveDiscStatDiffs: vi.fn(() => ({
    baseline: { finalDamage: 1000 },
    substatDiffs: [{
      stat: "critRate",
      mode: "pct",
      currentValue: 4.8,
      addedValue: 2.4,
      absoluteDiff: 120,
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
        absoluteDiff: 80,
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
          absoluteDiff: 60,
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
        { rolls: 1, addedValue: 2.4, finalDamage: 1100, absoluteGain: 100, relativeGain: 0.1 },
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
  NTag: {
    template: "<span><slot /></span>",
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
      sourceLabel: "优化结果：第 1 名",
    },
  })
}

describe("DriveDiscAnalysisModal", () => {
  it("renders detailed diff, substat, and gain views for the current calculation scheme", async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain("优化结果：第 1 名")
    expect(wrapper.text()).toContain("副词条差异计算")
    expect(wrapper.text()).toContain("已有副词条替换参考")
    expect(wrapper.text()).toContain("主词条差异计算")
    expect(wrapper.text()).toContain("角色优先配置")

    const buttons = wrapper.findAll("button")
    await buttons.find(button => button.text().includes("当前副词条"))?.trigger("click")

    expect(wrapper.text()).toContain("总有效词条")
    expect(wrapper.text()).toContain("出现次数")

    await buttons.find(button => button.text().includes("收益曲线"))?.trigger("click")

    expect(wrapper.text()).toContain("累计提升")
    expect(wrapper.text()).toContain("下一条累计提升")

    await wrapper.findAll("button").find(button => button.text().includes("边际收益"))?.trigger("click")

    expect(wrapper.text()).toContain("第1条边际收益")
  })
})
