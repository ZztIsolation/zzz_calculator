import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import DriveDiscSlotCard from "@/components/DriveDiscSlotCard.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    inheritAttrs: false,
    props: ["disabled", "loading", "type"],
    emits: ["click"],
    template: "<button v-bind=\"$attrs\" :disabled=\"disabled\" :data-type=\"type\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
  },
  NTag: {
    props: ["type"],
    template: "<span :data-type=\"type\"><slot /></span>",
  },
}))

const disc = {
  id: "disc-1",
  setId: "woodpecker_electro",
  setName: "啄木鸟电音",
  partition: 1,
  rarity: "S",
  level: 15,
  mainStat: { stat: "hpFlat", value: 2200 },
  subStats: [],
  reservedForAgentId: null,
}
const agents = [
  { id: "agent-a", name: { zhCN: "角色甲" } },
  { id: "agent-b", name: { zhCN: "角色乙" } },
]
const driveDiscSets = [{ id: "woodpecker_electro", name: { zhCN: "啄木鸟电音" } }]
const statMeta = {
  statRules: {
    statDisplay: {
      hpFlat: { label: "生命值" },
      critRate: { label: "暴击率" },
      critDmg: { label: "暴击伤害" },
      anomalyProficiency: { label: "异常精通" },
      atkPct: { label: "攻击力%" },
      exceptionallyLongStat: { label: "这是一个需要在狭窄卡片中自动换行的超长词条名称" },
    },
  },
}

function mountCard(reservedForAgentId: string | null = null, excludedForAgentIds: string[] = []) {
  return mount(DriveDiscSlotCard, {
    props: {
      slot: 1,
      disc: { ...disc, reservedForAgentId, excludedForAgentIds },
      agents,
      driveDiscSets,
      targetAgentId: "agent-a",
      interactive: true,
      showReservation: true,
      reservationAction: true,
      showExclusion: true,
      exclusionAction: true,
    },
  })
}

describe("DriveDiscSlotCard reservation action", () => {
  it("renders public, current, other, and unknown reservation states with clear actions", async () => {
    const wrapper = mountCard()
    expect(wrapper.get(".disc-slot-card").attributes("data-reservation-state")).toBe("public")
    expect(wrapper.get(".disc-reservation-button").attributes("aria-label")).toBe("锁定给角色甲")

    await wrapper.setProps({ disc: { ...disc, reservedForAgentId: "agent-a" } })
    expect(wrapper.get(".disc-reservation-button").classes()).toContain("disc-reservation-button-current")
    expect(wrapper.get(".disc-reservation-button").attributes("aria-label")).toBe("解除角色甲专属")

    await wrapper.setProps({ disc: { ...disc, reservedForAgentId: "agent-b" } })
    expect(wrapper.get(".disc-reservation-button").classes()).toContain("disc-reservation-button-other")
    expect(wrapper.get(".disc-reservation-button").attributes("aria-label")).toBe("转移给角色甲")

    await wrapper.setProps({ disc: { ...disc, reservedForAgentId: "retired-agent" } })
    expect(wrapper.get(".disc-reservation-button").classes()).toContain("disc-reservation-button-unknown")
    expect(wrapper.text()).toContain("未知角色（retired-agent）")
  })

  it("emits only the reservation action when the lock is clicked", async () => {
    const wrapper = mountCard()
    await wrapper.get(".disc-reservation-button").trigger("click")

    expect(wrapper.emitted("toggleReservation")?.[0]).toEqual([expect.objectContaining({ id: "disc-1" })])
    expect(wrapper.emitted("select")).toBeUndefined()

    await wrapper.get(".disc-slot-card").trigger("click")
    expect(wrapper.emitted("select")?.[0]).toEqual([1])
  })

  it("renders explicit and derived exclusion states with a disabled derived action", async () => {
    const wrapper = mountCard(null, ["agent-a"])
    expect(wrapper.get(".disc-exclusion-button").classes()).toContain("disc-exclusion-button-excluded-explicit")
    expect(wrapper.get(".disc-exclusion-button").attributes("aria-label")).toBe("取消角色甲排除")
    await wrapper.get(".disc-exclusion-button").trigger("click")
    expect(wrapper.emitted("toggleExclusion")?.[0]).toEqual([expect.objectContaining({ id: "disc-1" })])

    await wrapper.setProps({ disc: { ...disc, reservedForAgentId: "agent-b", excludedForAgentIds: [] } })
    expect(wrapper.get(".disc-exclusion-button").classes()).toContain("disc-exclusion-button-excluded-by-reservation")
    expect(wrapper.get(".disc-exclusion-button").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("已排除")
  })

  it("keeps both right-side restriction actions at a stable 32px size", () => {
    const source = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "DriveDiscSlotCard.vue"), "utf8")
    expect(source).toMatch(/\.disc-restriction-button\s*\{[\s\S]*width: 32px;[\s\S]*height: 32px;/)
    expect(source).toContain('class="disc-slot-card-actions"')
  })

  it("shows combined provenance in a stable order and reads Scanner sequence from provenance", () => {
    const wrapper = mount(DriveDiscSlotCard, {
      props: {
        slot: 1,
        disc: {
          ...disc,
          source: { type: "enka-zzz-showcase" },
          provenance: {
            version: 1,
            manual: { lastEditedAt: "2026-08-18T00:00:00.000Z" },
            calculatorJson: { sourceRecordId: "disc-1" },
            scanner: { lastSequence: 42 },
            enkaZzz: { uid: "1302309616", equipmentUid: "equipment-1" },
          },
        },
        agents,
        driveDiscSets,
        showSequence: true,
      },
    })

    expect(wrapper.findAll(".drive-disc-source-tag").map(tag => tag.text().trim())).toEqual([
      "Enka",
      "扫描器 #42",
      "JSON",
      "手动",
    ])
    expect(wrapper.get(".drive-disc-source-tags").attributes("aria-label"))
      .toBe("来源：Enka、扫描器 #42、JSON、手动")
  })
})

describe("DriveDiscSlotCard stat layout", () => {
  it("keeps the compact presentation as the default", () => {
    const wrapper = mount(DriveDiscSlotCard, {
      props: { slot: 1, disc, driveDiscSets, meta: statMeta },
    })

    expect(wrapper.get(".disc-slot-card").attributes("data-stat-layout")).toBe("compact")
    expect(wrapper.find(".disc-slot-card-stats").exists()).toBe(false)
    expect(wrapper.text()).toContain("生命值 2200")
  })

  it("renders the main stat and four substats as ordered label-value rows", () => {
    const wrapper = mount(DriveDiscSlotCard, {
      props: {
        slot: 1,
        statLayout: "vertical",
        driveDiscSets,
        meta: statMeta,
        disc: {
          ...disc,
          subStats: [
            { stat: "critRate", mode: "pct", value: 4.8 },
            { stat: "critDmg", mode: "pct", value: 9.6 },
            { stat: "anomalyProficiency", mode: "flat", value: 18 },
            { stat: "atkPct", mode: "pct", value: 3 },
            { stat: "hpFlat", mode: "flat", value: 112 },
          ],
        },
      },
    })

    expect(wrapper.get(".disc-slot-card").classes()).toContain("disc-slot-card-vertical")
    expect(wrapper.get(".disc-slot-card-main-stat dt").text()).toBe("生命值")
    expect(wrapper.get(".disc-slot-card-main-stat dd").text()).toBe("2200")
    expect(wrapper.findAll(".disc-slot-card-sub-stat").map(row => [
      row.get("dt").text(),
      row.get("dd").text(),
    ])).toEqual([
      ["暴击率%", "4.8%"],
      ["暴击伤害%", "9.6%"],
      ["异常精通", "18"],
      ["百分比攻击力%", "3%"],
    ])
  })

  it("uses the same stable stats region for empty and missing slots without placeholder rows", async () => {
    const wrapper = mount(DriveDiscSlotCard, {
      props: { slot: 1, statLayout: "vertical" },
    })

    expect(wrapper.get(".disc-slot-card-stats").classes()).toContain("disc-slot-card-stats-empty")
    expect(wrapper.findAll(".disc-slot-card-stat-row")).toHaveLength(0)
    expect(wrapper.text()).toContain("空槽位")

    await wrapper.setProps({ missingReference: true })
    expect(wrapper.get(".disc-slot-card").classes()).toContain("disc-slot-card-missing")
    expect(wrapper.findAll(".disc-slot-card-stat-row")).toHaveLength(0)
    expect(wrapper.text()).toContain("此预设引用的驱动盘已不在当前库存")
  })

  it("keeps long labels wrappable and values non-wrapping without changing selection actions", async () => {
    const wrapper = mount(DriveDiscSlotCard, {
      props: {
        slot: 1,
        disc: {
          ...disc,
          subStats: [{ stat: "exceptionallyLongStat", mode: "flat", value: 123.456 }],
        },
        driveDiscSets,
        meta: statMeta,
        statLayout: "vertical",
        interactive: true,
      },
    })

    expect(wrapper.get(".disc-slot-card-sub-stat dt").text()).toBe("这是一个需要在狭窄卡片中自动换行的超长词条名称")
    expect(wrapper.get(".disc-slot-card-sub-stat dd").text()).toBe("123.456")
    await wrapper.get(".disc-slot-card").trigger("click")
    expect(wrapper.emitted("select")?.[0]).toEqual([1])

    const source = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "DriveDiscSlotCard.vue"), "utf8")
    expect(source).toMatch(/\.disc-slot-card-stat-row dt\s*\{[\s\S]*overflow-wrap: anywhere;/)
    expect(source).toMatch(/\.disc-slot-card-stat-row dd\s*\{[\s\S]*white-space: nowrap;/)
  })
})
