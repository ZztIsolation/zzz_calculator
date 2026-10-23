import { mount } from "@vue/test-utils"
import PanelStatTable from "@/components/PanelStatTable.vue"

describe("PanelStatTable", () => {
  const panel = {
    hp: 18165.2,
    atk: 2249,
    def: 625,
    critRate: 0.578,
    critDmg: 1.716,
    sheerForce: 1509.39,
    impact: 93,
    anomalyProficiency: 99,
    anomalyMastery: 92,
    penFlat: 36,
    penRatio: 0,
    dmgBonus: 0,
  }

  it("shows sheer force after attack when enabled for rupture agents", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel,
        includeSheerForce: true,
      },
    })

    const labels = wrapper.findAll("th").map(item => item.text())
    expect(labels.slice(0, 3)).toEqual(["生命值", "攻击力", "贯穿力"])
    expect(wrapper.text()).toContain("1,509.4")
  })

  it("hides zero sheer force when not enabled for non-rupture agents", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel: {
          ...panel,
          sheerForce: 0,
        },
      },
    })

    const labels = wrapper.findAll("th").map(item => item.text())
    expect(labels).not.toContain("贯穿力")
  })

  it("truncates anomaly mastery like the in-game panel without changing the input", () => {
    const precisePanel = {
      ...panel,
      anomalyProficiency: 520,
      anomalyMastery: 195.96,
    }
    const wrapper = mount(PanelStatTable, {
      props: {
        panel: precisePanel,
      },
    })

    const masteryRow = wrapper.findAll("tr").find(row => row.text().includes("异常掌控"))
    const proficiencyRow = wrapper.findAll("tr").find(row => row.text().includes("异常精通"))
    expect(masteryRow?.text()).toContain("195")
    expect(masteryRow?.text()).not.toContain("196")
    expect(proficiencyRow?.text()).toContain("520")
    expect(proficiencyRow?.text()).not.toContain("520.0")
    expect(precisePanel.anomalyMastery).toBe(195.96)
  })

  it("highlights only configured stat names while leaving values unchanged", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel,
        includeSheerForce: true,
        importantStats: ["atk", "critRate", "sheerForce"],
      },
    })

    const rows = wrapper.findAll("tr")
    for (const label of ["攻击力", "暴击率", "贯穿力"]) {
      const row = rows.find(item => item.find("th").text() === label)
      expect(row?.find("th").classes()).toContain("panel-stat-important")
      expect(row?.find("td").classes()).not.toContain("panel-stat-important")
    }
    expect(rows.find(item => item.find("th").text() === "暴击伤害")?.find("th").classes())
      .not.toContain("panel-stat-important")
  })

  it("compares out-of-combat and in-combat values in one table and marks buff gains", () => {
    const wrapper = mount(PanelStatTable, {
      props: {
        panel,
        inCombatPanel: { ...panel, atk: 2749, critRate: 0.578, critDmg: 1.616 },
      },
    })

    expect(wrapper.findAll("thead th").map(item => item.text())).toEqual(["属性", "局外", "局内"])
    const row = (label: string) => wrapper.findAll("tbody tr").find(item => item.find("th").text() === label)!
    expect(row("攻击力").findAll("td").map(cell => cell.find("span").exists() ? cell.find("span").text() : cell.text()))
      .toEqual(["2,249", "2,749"])
    expect(row("攻击力").find(".panel-stat-up small").text()).toBe("+500")
    expect(row("暴击率").find(".panel-stat-up").exists()).toBe(false)
    expect(row("暴击率").find("small").exists()).toBe(false)
    expect(row("暴击伤害").find(".panel-stat-down small").text()).toContain("−")
  })

  it("keeps every stat name unhighlighted without a configuration", () => {
    const wrapper = mount(PanelStatTable, { props: { panel } })

    expect(wrapper.findAll("th.panel-stat-important")).toHaveLength(0)
  })
})
