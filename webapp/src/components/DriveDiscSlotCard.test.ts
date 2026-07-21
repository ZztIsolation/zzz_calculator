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

function mountCard(reservedForAgentId: string | null = null) {
  return mount(DriveDiscSlotCard, {
    props: {
      slot: 1,
      disc: { ...disc, reservedForAgentId },
      agents,
      driveDiscSets,
      targetAgentId: "agent-a",
      interactive: true,
      showReservation: true,
      reservationAction: true,
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

  it("emits only the reservation action when the overlaid lock is clicked", async () => {
    const wrapper = mountCard()
    await wrapper.get(".disc-reservation-button").trigger("click")

    expect(wrapper.emitted("toggleReservation")?.[0]).toEqual([expect.objectContaining({ id: "disc-1" })])
    expect(wrapper.emitted("select")).toBeUndefined()

    await wrapper.get(".disc-slot-card").trigger("click")
    expect(wrapper.emitted("select")?.[0]).toEqual([1])
  })

  it("keeps the overlaid lock at the prominent 32px size", () => {
    const source = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "DriveDiscSlotCard.vue"), "utf8")
    expect(source).toMatch(/\.disc-reservation-button\s*\{[\s\S]*width: 32px;[\s\S]*height: 32px;/)
    expect(source).toContain('class="disc-slot-card-icon"')
  })
})
