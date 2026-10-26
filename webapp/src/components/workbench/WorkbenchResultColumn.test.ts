import { mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it } from "vitest"
import WorkbenchResultColumn from "@/components/workbench/WorkbenchResultColumn.vue"
import { useBuildStore } from "@/stores/build"
import { useCatalogStore } from "@/stores/catalog"

function mountColumn(overrides: Record<string, any> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const buildStore = useBuildStore()
  buildStore.$patch({
    result: { inCombat: { panel: { hp: 1000, atk: 200, critRate: 0.5 } } },
    outOfCombat: { panel: { hp: 900, atk: 180, critRate: 0.4 } },
    error: "",
    ...(overrides.build ?? {}),
  })
  useCatalogStore().$patch({ meta: null, loading: false })
  return mount(WorkbenchResultColumn, {
    props: {
      summaryContextKey: "context",
      isLuminescenceScore: false,
      selectedAgent: { specialty: "attack", importantPanelStats: [] },
      selectedSkillCatalog: null,
      ...(overrides.props ?? {}),
    },
    global: { plugins: [pinia] },
  })
}

describe("WorkbenchResultColumn", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("keeps the right column order as panel, summary, then white box", () => {
    const wrapper = mountColumn()
    const right = wrapper.find(".workbench-right")
    expect(right.find(".damage-panel-card").exists()).toBe(true)
    expect(right.find(".workbench-summary-section").exists()).toBe(true)
    expect(right.find(".workbench-whitebox-section").exists()).toBe(true)
    const html = right.html()
    expect(html.indexOf("damage-panel-card")).toBeLessThan(html.indexOf("workbench-summary-section"))
    expect(html.indexOf("workbench-summary-section")).toBeLessThan(html.indexOf("workbench-whitebox-section"))
    const headers = wrapper.findAll(".damage-panel-card thead th").map(item => item.text())
    expect(headers).toEqual(["属性", "局外", "局内"])
    wrapper.unmount()
  })

  it("shows panel values from the build store without deriving deltas", () => {
    const wrapper = mountColumn()
    const rows = wrapper.findAll(".damage-panel-card tbody tr")
    const atkRow = rows.find(row => row.find("th").text() === "攻击力")
    expect(atkRow!.findAll("td").map(cell => cell.text())).toEqual(["180", "200"])
    expect(wrapper.find(".panel-stat-up").exists()).toBe(false)
    expect(wrapper.find(".panel-stat-down").exists()).toBe(false)
    wrapper.unmount()
  })

  it("renders the white box error and forwards the refresh action", async () => {
    const wrapper = mountColumn({ build: { error: "计算失败" } })
    expect(wrapper.find(".workbench-whitebox-section").text()).toContain("计算失败")
    await wrapper.find(".workbench-whitebox-section button").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("refresh")).toHaveLength(1)
    wrapper.unmount()
  })

  it("uses the luminescence title when the workbench scores team anomaly damage", () => {
    const wrapper = mountColumn({ props: { isLuminescenceScore: true } })
    expect(wrapper.find(".workbench-whitebox-section").text()).toContain("队伍异常评分白盒")
    wrapper.unmount()
  })
})
