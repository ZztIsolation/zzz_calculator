import { flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DiscsView from "@/views/DiscsView.vue"
import { useInventoryStore } from "@/stores/inventory"

const catalogFixture = vi.hoisted(() => ({
  catalog: {
    driveDiscSets: [{
      id: "woodpecker_electro",
      name: { zhCN: "啄木鸟电音" },
      images: { icon: "/assets/drive-discs/woodpecker_electro.webp" },
    }],
  },
  meta: {
    agents: [{ id: "agent-a", name: { zhCN: "测试代理人" } }],
    wEngines: [],
    combatBuffs: [],
    statRules: {
      statDisplay: {
        hpFlat: { label: { zhCN: "生命值" } },
        atkFlat: { label: { zhCN: "攻击力" } },
        defFlat: { label: { zhCN: "防御力" } },
        hpPct: { label: { zhCN: "生命值%" } },
        atkPct: { label: { zhCN: "攻击力%" } },
        defPct: { label: { zhCN: "防御力%" } },
        critRate: { label: { zhCN: "暴击率" } },
        critDmg: { label: { zhCN: "暴击伤害" } },
        anomalyProficiency: { label: { zhCN: "异常精通" } },
        penFlat: { label: { zhCN: "穿透值" } },
        fireDmg: { label: { zhCN: "火属性伤害加成" } },
        iceResIgnore: { label: { zhCN: "冰抗性无视" } },
      },
      driveDisc: {
        mainStatPools: {
          1: ["hpFlat"],
          2: ["atkFlat"],
          3: ["defFlat"],
          4: ["hpPct", "atkPct", "defPct", "critRate", "critDmg", "anomalyProficiency"],
          5: ["fireDmg"],
          6: ["hpPct"],
        },
        subStatPool: [
          "hpFlat",
          "atkFlat",
          "defFlat",
          "hpPct",
          "atkPct",
          "defPct",
          "critRate",
          "critDmg",
          "anomalyProficiency",
          "penFlat",
        ],
        sRankSubStatBaseStep: {
          hpFlat: 112,
          atkFlat: 19,
          defFlat: 15,
          hpPct: 3,
          atkPct: 3,
          defPct: 4.8,
          critRate: 2.4,
          critDmg: 4.8,
          anomalyProficiency: 9,
          penFlat: 9,
        },
      },
    },
  },
}))

vi.mock("@runtime/catalog-loader.js", () => ({
  loadCatalog: vi.fn(async () => catalogFixture.catalog),
  loadMeta: vi.fn(async () => catalogFixture.meta),
}))

vi.mock("naive-ui", () => ({
  NAlert: {
    props: ["title"],
    template: "<aside role=\"alert\"><strong>{{ title }}</strong><slot /></aside>",
  },
  NButton: {
    props: ["disabled", "type"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" :data-button-type=\"type || undefined\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
  },
  NCheckbox: {
    props: ["checked", "disabled"],
    emits: ["update:checked"],
    template: "<label><input type=\"checkbox\" :checked=\"checked\" :disabled=\"disabled\" @change=\"$emit('update:checked', $event.target.checked)\"><slot /></label>",
  },
  NDrawer: {
    props: ["show"],
    template: "<div v-if=\"show\"><slot /></div>",
  },
  NDrawerContent: {
    template: "<section><slot /></section>",
  },
  NInput: {
    props: ["value"],
    emits: ["update:value"],
    template: "<input :value=\"value\" @input=\"$emit('update:value', $event.target.value)\">",
  },
  NInputNumber: {
    props: ["value"],
    emits: ["update:value"],
    template: "<input :value=\"value\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NModal: {
    props: ["show", "title"],
    template: "<div v-if=\"show\" class=\"test-modal\"><h2>{{ title }}</h2><slot /><slot name=\"footer\" /></div>",
  },
  NProgress: {
    template: "<div class=\"progress\"></div>",
  },
  NSelect: {
    props: ["value", "options"],
    emits: ["update:value"],
    template: `
      <select :value="value" @change="$emit('update:value', $event.target.value)">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
  },
  NSpin: {
    template: "<div class=\"spin\"></div>",
  },
  NTab: {
    props: ["name"],
    template: "<button type=\"button\"><slot /></button>",
  },
  NTabs: {
    template: "<div><slot /></div>",
  },
  NTag: {
    template: "<span><slot /></span>",
  },
  useMessage: () => ({
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

function seedInventory(driveDiscs: any[]) {
  localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscs,
    driveDiscLoadouts: [],
  }))
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(DiscsView, {
    global: {
      plugins: [pinia],
      stubs: {
        ConfirmDialog: {
          template: "<div></div>",
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function button(wrapper: any, label: string) {
  const match = wrapper.findAll("button").find((item: any) => item.text().trim() === label)
  if (!match) {
    throw new Error(`Button not found: ${label}`)
  }
  return match
}

async function setSubStat(wrapper: any, index: number, stat: string, rolls: number) {
  const row = wrapper.findAll(".substat-editor-row")[index]
  const selects = row.findAll("select")
  await selects[0].setValue(stat)
  await selects[1].setValue(String(rolls))
  return row
}

describe("DiscsView", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders drive disc set icons from the catalog in the inventory table", async () => {
    seedInventory([{
      id: "disc-a",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      rarity: "S",
      level: 15,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [{ stat: "critRate", value: 4.8 }],
      source: { sequence: 7 },
    }])

    const wrapper = await mountView()
    const identity = wrapper.find(".disc-row-identity")

    expect(identity.exists()).toBe(true)
    expect(identity.find("img").attributes("src")).toBe("/assets/drive-discs/woodpecker_electro.webp")
    expect(identity.text()).toContain("啄木鸟电音")
    expect(identity.text()).toContain("#7")
  })

  it("falls back to the shared empty drive disc icon for unknown sets", async () => {
    seedInventory([{
      id: "disc-unknown",
      ownerId: "default",
      setId: "unknown_set",
      setName: "未知套装",
      partition: 2,
      rarity: "A",
      level: 9,
      mainStat: { stat: "hpFlat", value: 1200 },
      subStats: [],
    }])

    const wrapper = await mountView()
    const identity = wrapper.find(".disc-row-identity")

    expect(identity.find("img").attributes("src")).toBe("/assets/drive-discs/empty.svg")
    expect(identity.text()).toContain("未知套装")
    expect(identity.text()).toContain("disc-unknown")
  })

  it("does not expose calculation-specific substat analysis from the inventory page", async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).not.toContain("词条分析")
  })

  it("labels bulk actions and makes scan the only primary toolbar command", async () => {
    const wrapper = await mountView()
    const toolbar = wrapper.find('[data-layout-surface="drive-discs-page"] > .panel > .panel-header .toolbar')
    const toolbarButtons = toolbar.findAll("button")

    expect(toolbarButtons.map(item => item.text().trim())).toEqual([
      "新增单个",
      "刷新",
      "批量导入",
      "批量导出",
      "扫描",
    ])
    expect(toolbarButtons
      .filter(item => item.attributes("data-button-type") === "primary")
      .map(item => item.text().trim())).toEqual(["扫描"])
  })

  it("shows the required game display modes and inventory page before scanning", async () => {
    const wrapper = await mountView()
    const inventoryStore = useInventoryStore()
    inventoryStore.scanConnected = true
    inventoryStore.scanStatus = "ready"
    inventoryStore.scanHelperVersion = "1.3.1"
    inventoryStore.scanScannerVersion = "1.0.43"

    await button(wrapper, "扫描").trigger("click")
    await flushPromises()

    expect(wrapper.find(".scan-runtime-status").text()).toBe("Helper 1.3.1 · Scanner 1.0.43 · 后台运行")
    const reminder = wrapper.find(".scan-prerequisite-alert")
    expect(reminder.exists()).toBe(true)
    expect(reminder.text()).toContain("扫描前请确认")
    expect(reminder.text()).toContain("背包中的“驱动盘”界面")
    expect(reminder.text()).toContain("1920 × 1080 全屏")
    expect(reminder.text()).toContain("1600 × 900 窗口")
    expect(reminder.text()).toContain("1280 × 720 窗口")
    expect(reminder.text()).toContain("影响识别速度和准确率")
  })

  it("downloads the current account export and disables export for an empty inventory", async () => {
    const emptyWrapper = await mountView()
    expect(button(emptyWrapper, "批量导出").attributes()).toHaveProperty("disabled")
    emptyWrapper.unmount()

    seedInventory([{
      id: "disc-export",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 1,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "hpFlat", value: 2200 },
      subStats: [],
    }])
    const createObjectURL = vi.fn(() => "blob:drive-disc-export")
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const wrapper = await mountView()

    await button(wrapper, "批量导出").trigger("click")
    await flushPromises()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("application/json;charset=utf-8")
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:drive-disc-export")
  })

  it("uses a refresh icon and hides manual identity, equipped agent, and rarity controls", async () => {
    const wrapper = await mountView()

    const refreshButton = button(wrapper, "刷新")
    expect(refreshButton.find("svg").classes()).toContain("lucide-refresh-cw-icon")

    await button(wrapper, "新增单个").trigger("click")
    const modal = wrapper.find(".test-modal")
    expect(modal.find("h2").text()).toBe("新增驱动盘")
    expect(modal.find('[aria-label="驱动盘 ID"]').exists()).toBe(false)
    expect(modal.find('[aria-label="驱动盘装备角色"]').exists()).toBe(false)
    expect(modal.find('[aria-label="驱动盘品质"]').exists()).toBe(false)
    expect(modal.text()).toContain("品质")
    expect(modal.text()).toContain("S")
    expect(modal.findAll(".substat-editor-row")).toHaveLength(4)
    expect(modal.text()).not.toContain("新增副词条")
    expect(modal.find('[aria-label^="移除副词条"]').exists()).toBe(false)
  })

  it("offers only legal S-rank substats with clear large and small stat labels", async () => {
    const wrapper = await mountView()
    await button(wrapper, "新增单个").trigger("click")

    await wrapper.find('[aria-label="驱动盘位置"]').setValue("5")
    await flushPromises()

    const typeSelect = wrapper.find('[aria-label="副词条 1 类型"]')
    const optionLabels = typeSelect.findAll("option").map(option => option.text())
    expect(optionLabels).toEqual([
      "小生命（固定生命值）",
      "小攻击（固定攻击力）",
      "小防御（固定防御力）",
      "大生命（生命值%）",
      "大攻击（攻击力%）",
      "大防御（防御力%）",
      "暴击率",
      "暴击伤害",
      "异常精通",
      "穿透值",
    ])
    expect(optionLabels).not.toContain("冰抗性无视")

    await typeSelect.setValue("critRate")
    const secondOptions = wrapper.find('[aria-label="副词条 2 类型"]').findAll("option").map(option => option.attributes("value"))
    expect(secondOptions).not.toContain("critRate")
    expect(secondOptions).toContain("hpFlat")

    const rollOptions = wrapper.find('[aria-label="副词条 1 词条数"]').findAll("option").map(option => option.attributes("value"))
    expect(rollOptions).toEqual(["1", "2", "3", "4", "5", "6"])
  })

  it("clears a conflicting substat without removing its fixed row", async () => {
    const wrapper = await mountView()
    await button(wrapper, "新增单个").trigger("click")
    await wrapper.find('[aria-label="驱动盘位置"]').setValue("4")
    await flushPromises()
    await setSubStat(wrapper, 0, "critRate", 2)
    expect(wrapper.findAll(".substat-editor-row")).toHaveLength(4)

    await wrapper.find('[aria-label="驱动盘主词条"]').setValue("critRate")
    await flushPromises()
    expect(wrapper.findAll(".substat-editor-row")).toHaveLength(4)
    expect(wrapper.find('[aria-label="副词条 1 类型"]').attributes("value")).toBe("")
    expect(wrapper.find(".disc-editor-warning").text()).toContain("四个副词条")
  })

  it("converts roll counts into stored values and generates the id on save", async () => {
    const wrapper = await mountView()
    await button(wrapper, "新增单个").trigger("click")

    await setSubStat(wrapper, 0, "critRate", 3)
    await setSubStat(wrapper, 1, "critDmg", 6)
    await setSubStat(wrapper, 2, "anomalyProficiency", 1)
    await setSubStat(wrapper, 3, "atkFlat", 1)

    expect(wrapper.find('[aria-label="副词条 1 换算结果"]').text()).toBe("7.2%")
    expect(wrapper.find('[aria-label="副词条 2 换算结果"]').text()).toBe("28.8%")
    expect(wrapper.find('[aria-label="副词条 3 换算结果"]').text()).toBe("9")
    expect(wrapper.find('[aria-label="副词条 4 换算结果"]').text()).toBe("19")

    await button(wrapper, "保存").trigger("click")
    await flushPromises()

    const store = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    const saved = store.driveDiscs[0]
    expect(saved.id).toMatch(/^disc-\d+-[a-f0-9]+$/)
    expect(saved.rarity).toBe("S")
    expect(saved.maxLevel).toBe(15)
    expect(saved.subStats).toEqual([
      { stat: "critRate", value: 7.2 },
      { stat: "critDmg", value: 28.8 },
      { stat: "anomalyProficiency", value: 9 },
      { stat: "atkFlat", value: 19 },
    ])
    expect(saved.subStats.every((item: any) => !("rolls" in item))).toBe(true)
  })

  it("restores roll counts and preserves hidden equipped-agent data while editing", async () => {
    seedInventory([{
      id: "disc-equipped",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 5,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "fireDmg", value: 30 },
      subStats: [
        { stat: "critRate", value: 7.2 },
        { stat: "critDmg", value: 28.8 },
        { stat: "anomalyProficiency", value: 9 },
        { stat: "atkFlat", value: 19 },
      ],
      equippedBy: "agent-a",
      locked: false,
    }])
    const wrapper = await mountView()

    await wrapper.find("tbody tr").trigger("click")
    expect(wrapper.find(".test-modal h2").text()).toBe("编辑驱动盘")
    expect(wrapper.find('[aria-label="副词条 1 词条数"]').attributes("value")).toBe("3")
    expect(wrapper.find('[aria-label="副词条 1 换算结果"]').text()).toBe("7.2%")
    expect(wrapper.find('[aria-label="驱动盘装备角色"]').exists()).toBe(false)

    await button(wrapper, "保存").trigger("click")
    await flushPromises()
    const store = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(store.driveDiscs[0].equippedBy).toBe("agent-a")
    expect(store.driveDiscs[0].subStats).toEqual([
      { stat: "critRate", value: 7.2 },
      { stat: "critDmg", value: 28.8 },
      { stat: "anomalyProficiency", value: 9 },
      { stat: "atkFlat", value: 19 },
    ])
  })

  it("blocks non-S records without changing stored data", async () => {
    seedInventory([{
      id: "disc-a-rank",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 5,
      rarity: "A",
      level: 9,
      maxLevel: 12,
      mainStat: { stat: "fireDmg", value: 20 },
      subStats: [{ stat: "critRate", value: 3.1 }],
      equippedBy: "agent-a",
    }])
    const wrapper = await mountView()

    await wrapper.find("tbody tr").trigger("click")
    const modal = wrapper.find(".test-modal")
    expect(modal.text()).toContain("手动编辑仅支持 S 级驱动盘")
    expect(button(wrapper, "保存").attributes()).toHaveProperty("disabled")
    expect(modal.find(".raw").text()).toContain('"value": 3.1')
  })

  it("does not round a non-integral legacy S-rank value", async () => {
    seedInventory([{
      id: "disc-invalid-rolls",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      partition: 5,
      rarity: "S",
      level: 15,
      maxLevel: 15,
      mainStat: { stat: "fireDmg", value: 30 },
      subStats: [{ stat: "critRate", value: 3.1 }],
    }])
    const wrapper = await mountView()

    await wrapper.find("tbody tr").trigger("click")
    const modal = wrapper.find(".test-modal")
    expect(modal.text()).toContain("无法精确换算为 1～6 个词条")
    expect(button(wrapper, "保存").attributes()).toHaveProperty("disabled")
    expect(modal.find(".raw").text()).toContain('"value": 3.1')
  })
})
