import { flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DiscsView from "@/views/DiscsView.vue"
import { useAppConfigStore } from "@/stores/app-config"
import { useInventoryStore } from "@/stores/inventory"
import { normalizeInventoryStore } from "@core/inventory-model.js"

const catalogFixture = vi.hoisted(() => ({
  catalog: {
    driveDiscSets: [{
      id: "woodpecker_electro",
      name: { zhCN: "啄木鸟电音" },
      images: { icon: "/assets/drive-discs/woodpecker_electro.webp" },
    }, {
      id: "swing_jazz",
      name: { zhCN: "摇摆爵士" },
      images: { icon: "/assets/drive-discs/swing_jazz.webp" },
    }, {
      id: "scanner-set-48ee0a14625f",
      name: { zhCN: "折枝剑歌" },
      images: { icon: "/assets/drive-discs/branch_blade_song.webp" },
    }],
  },
  meta: {
    agents: [
      { id: "agent-a", name: { zhCN: "角色甲" } },
      { id: "agent-b", name: { zhCN: "角色乙" } },
    ],
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

const messageFixture = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
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
    props: ["disabled", "type", "loading"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" :data-button-type=\"type || undefined\" :data-loading=\"loading || undefined\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
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
    props: ["value", "options", "multiple"],
    emits: ["update:value"],
    template: `
      <select
        :value="value"
        :multiple="multiple !== undefined && multiple !== false"
        @change="$emit('update:value', multiple !== undefined && multiple !== false ? Array.from($event.target.selectedOptions).map(option => option.value) : $event.target.value)"
      >
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
  useMessage: () => messageFixture,
}))

function seedInventory(driveDiscs: any[], driveDiscLoadouts: any[] = []) {
  localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify({
    version: 1,
    currentOwnerId: "default",
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscs,
    driveDiscLoadouts,
  }))
}

async function mountView(reservationUiEnabled = false, exclusionUiEnabled = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const appConfigStore = useAppConfigStore(pinia)
  appConfigStore.$patch({
    loaded: true,
    config: {
      maintenanceEnabled: false,
      scanTelemetryEnabled: false,
      scanTelemetryRetentionDays: 30,
      enkaImportEnabled: false,
      driveDiscReservationsUiEnabled: reservationUiEnabled,
      driveDiscExclusionsUiEnabled: exclusionUiEnabled,
    },
  })
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

function driveDisc(slot: number, overrides: any = {}) {
  return {
    id: `preset-disc-${slot}`,
    ownerId: "default",
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: slot,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    mainStat: { stat: slot === 1 ? "hpFlat" : "atkPct", value: slot === 1 ? 2200 : 30 },
    subStats: [
      { stat: "critRate", value: 4.8 },
      { stat: "critDmg", value: 9.6 },
    ],
    source: { sequence: slot + 20 },
    ...overrides,
  }
}

describe("DiscsView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(identity.find("img").attributes("src")).toBe("/assets/drive-discs/empty-5ad1cbe3.svg")
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

  it("keeps the production inventory UI unchanged while the reservation flag is off", async () => {
    seedInventory([driveDisc(1, { reservedForAgentId: "agent-a" })])
    const wrapper = await mountView(false)

    expect(wrapper.find('[aria-label="专属角色筛选"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="调整专属角色"]').exists()).toBe(false)
    expect(wrapper.find(".loadout-visual-grid").exists()).toBe(false)
  })

  it("filters unknown owners and requires confirmation before transferring one disc", async () => {
    seedInventory([
      driveDisc(1, { id: "public-filter-disc", setName: "公共筛选盘" }),
      driveDisc(2, { id: "known-filter-disc", setName: "已知角色筛选盘", reservedForAgentId: "agent-a" }),
      driveDisc(3, { id: "unknown-filter-disc", setName: "未知角色筛选盘", reservedForAgentId: "retired-agent" }),
    ])
    const wrapper = await mountView(true)
    const filter = wrapper.get('[aria-label="专属角色筛选"]')

    expect(filter.findAll("option").map(option => option.text())).toContain("未知角色（retired-agent）")
    await filter.setValue("reserved")
    expect(wrapper.findAll("tbody tr")).toHaveLength(2)
    await filter.setValue("agent-a")
    expect(wrapper.findAll("tbody tr")).toHaveLength(1)

    await wrapper.get('[aria-label="调整专属角色"]').trigger("click")
    await wrapper.get('select[aria-label="专属角色"]').setValue("agent-b")
    await button(wrapper, "应用专属").trigger("click")
    await flushPromises()
    let persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(persisted.driveDiscs.find((disc: any) => disc.id === "known-filter-disc").reservedForAgentId).toBe("agent-a")
    expect(wrapper.text()).toContain("角色甲 → 角色乙")

    await button(wrapper, "转移并锁定").trigger("click")
    await flushPromises()
    persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(persisted.driveDiscs.find((disc: any) => disc.id === "known-filter-disc").reservedForAgentId).toBe("agent-b")
  })

  it("filters effective exclusions by role and manages explicit unknown-role exclusions", async () => {
    seedInventory([
      driveDisc(1, { id: "available-disc", setName: "可用盘" }),
      driveDisc(2, { id: "explicit-disc", setName: "主动排除盘", excludedForAgentIds: ["agent-a"] }),
      driveDisc(3, { id: "locked-other-disc", setName: "其他角色锁定盘", reservedForAgentId: "agent-b" }),
      driveDisc(4, { id: "unknown-exclusion-disc", setName: "未知角色排除盘", excludedForAgentIds: ["retired-agent"] }),
    ])
    const wrapper = await mountView(true, true)

    expect(wrapper.text()).toContain("使用限制")
    expect(wrapper.find('[aria-label="专属角色筛选"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="限制角色筛选"]').findAll("option").map(option => option.text())).toContain("未知角色（retired-agent）")

    await wrapper.get('[aria-label="限制状态筛选"]').setValue("excluded")
    await wrapper.get('[aria-label="限制角色筛选"]').setValue("agent-a")
    const filteredText = wrapper.find("tbody").text()
    expect(filteredText).toContain("主动排除盘")
    expect(filteredText).toContain("其他角色锁定盘")
    expect(filteredText).not.toContain("可用盘")

    await wrapper.get('[aria-label="限制状态筛选"]').setValue("")
    await wrapper.get('[aria-label="限制角色筛选"]').setValue("")
    const availableRow = wrapper.findAll("tbody tr").find(row => row.text().includes("可用盘"))
    await availableRow?.get('[aria-label="管理排除角色"]').trigger("click")
    await wrapper.get('[aria-label="主动排除角色"]').setValue(["agent-a", "retired-agent"])
    await button(wrapper, "保存排除设置").trigger("click")
    await flushPromises()

    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(persisted.driveDiscs.find((disc: any) => disc.id === "available-disc").excludedForAgentIds)
      .toEqual(["agent-a", "retired-agent"])
  })

  it("renders six visual preset slots and keeps picker edits as drafts until save", async () => {
    const original = driveDisc(1, { reservedForAgentId: "agent-a" })
    const candidate = driveDisc(1, {
      id: "candidate-disc-1",
      setId: "swing_jazz",
      setName: "摇摆爵士",
      source: { sequence: 88 },
      reservedForAgentId: "agent-b",
    })
    const discs = [original, candidate, driveDisc(2), driveDisc(3), driveDisc(4)]
    seedInventory(discs, [{
      id: "visual-loadout",
      ownerId: "default",
      name: "角色甲可视套装",
      agentId: "agent-a",
      driveDiscIdsBySlot: {
        1: original.id,
        2: "preset-disc-2",
        3: "preset-disc-3",
        4: "preset-disc-4",
        5: "deleted-disc-5",
      },
      score: 197608702,
    }])
    const wrapper = await mountView(true)
    const card = wrapper.get(".loadout-visual-card")

    expect(card.findAll(".disc-slot-card")).toHaveLength(6)
    expect(card.text()).toContain("专属 1 / 6")
    expect(card.text()).toContain("评分 197,608,702")
    expect(card.text()).toContain("驱动盘已缺失")
    expect(card.text()).toContain("未选择")
    expect(card.text()).not.toContain("整套锁定")

    await button(wrapper, "编辑").trigger("click")
    await wrapper.get('.loadout-editor-slot-grid .disc-slot-card[data-slot="1"]').trigger("click")
    await wrapper.get('[aria-label*="摇摆爵士"]').trigger("click")
    await button(wrapper, "取消").trigger("click")

    const persisted = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    expect(persisted.driveDiscLoadouts[0].driveDiscIdsBySlot["1"]).toBe(original.id)
    expect(persisted.driveDiscs.find((disc: any) => disc.id === candidate.id).reservedForAgentId).toBe("agent-b")
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

  it("saves cloneable scanner-disc edits and leaves unrelated browser data unchanged", async () => {
    const rawScan = {
      序号: 1,
      名称: "折枝剑歌",
      槽位: 2,
      品质: "S",
      等级: 15,
    }
    const initialStore = normalizeInventoryStore({
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
      currentOwnerId: "default",
      owners: [
        { id: "default", label: "默认用户" },
        { id: "alt", label: "二号账号" },
      ],
      imports: [{ id: "scanner-import-1", ownerId: "default", itemCount: 2 }],
      driveDiscs: [{
        id: "scanner-fold-disc",
        ownerId: "default",
        setId: "scanner-set-48ee0a14625f",
        setName: "折枝剑歌",
        canonicalSetName: { zhCN: "折枝剑歌" },
        partition: 2,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat: { stat: "atkFlat", value: 316 },
        subStats: [
          { stat: "hpFlat", value: 224 },
          { stat: "anomalyProficiency", value: 9 },
          { stat: "critRate", value: 4.8 },
          { stat: "atkPct", value: 15 },
        ],
        equippedBy: "agent-a",
        locked: false,
        reservedForAgentId: "agent-a",
        excludedForAgentIds: ["agent-b"],
        source: { type: "zzz-scanner", importId: "scanner-import-1", sequence: 1 },
        raw: rawScan,
        futureDiscField: { preserve: true },
      }, {
        id: "untouched-default-disc",
        ownerId: "default",
        setId: "swing_jazz",
        setName: "摇摆爵士",
        canonicalSetName: { zhCN: "摇摆爵士" },
        partition: 1,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat: { stat: "hpFlat", value: 2200 },
        subStats: [],
        locked: true,
      }, {
        id: "untouched-alt-disc",
        ownerId: "alt",
        setId: "woodpecker_electro",
        setName: "啄木鸟电音",
        canonicalSetName: { zhCN: "啄木鸟电音" },
        partition: 3,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        mainStat: { stat: "defFlat", value: 184 },
        subStats: [],
        locked: false,
      }],
      driveDiscLoadouts: [{
        id: "saved-loadout",
        ownerId: "default",
        name: "原有预设",
        driveDiscIdsBySlot: { 1: "untouched-default-disc", 2: "scanner-fold-disc" },
      }],
      futureStoreField: { preserve: true },
    })
    localStorage.setItem("zzz-calculator.userStore.v1", JSON.stringify(initialStore))
    localStorage.setItem("zzz-calculator.save-regression-sentinel", "preserve-me")

    const wrapper = await mountView()
    const inventoryStore = useInventoryStore()
    const originalSaveDisc = inventoryStore.saveDisc
    let submitted: any = null
    const saveSpy = vi.spyOn(inventoryStore, "saveDisc").mockImplementation(async input => {
      submitted = input
      expect(() => structuredClone(input)).not.toThrow()
      await originalSaveDisc(input)
    })
    const before = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    const untouchedDefaultBefore = structuredClone(before.driveDiscs.find((disc: any) => disc.id === "untouched-default-disc"))
    const untouchedAltBefore = structuredClone(before.driveDiscs.find((disc: any) => disc.id === "untouched-alt-disc"))
    const targetRow = wrapper.findAll("tbody tr").find(row => row.text().includes("折枝剑歌"))
    expect(targetRow).toBeTruthy()

    await targetRow!.trigger("click")
    const modal = wrapper.find(".test-modal")
    await modal.find('[aria-label="驱动盘套装"]').setValue("swing_jazz")
    await modal.find('[aria-label="驱动盘位置"]').setValue("4")
    await flushPromises()
    await modal.find('[aria-label="驱动盘等级"]').setValue("14")
    await modal.find('[aria-label="驱动盘主词条"]').setValue("critDmg")
    await modal.find('[aria-label="驱动盘主词条数值"]').setValue("48")
    await modal.find('input[type="checkbox"]').setValue(true)
    await setSubStat(wrapper, 0, "defFlat", 3)
    await setSubStat(wrapper, 1, "anomalyProficiency", 3)

    expect(wrapper.find('[aria-label="副词条 1 换算结果"]').text()).toBe("45")
    expect(wrapper.find('[aria-label="副词条 2 换算结果"]').text()).toBe("27")
    await button(wrapper, "保存").trigger("click")
    await flushPromises()

    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find(".test-modal").exists()).toBe(false)
    expect(submitted).toMatchObject({
      id: "scanner-fold-disc",
      ownerId: "default",
      setId: "swing_jazz",
      setName: "摇摆爵士",
      canonicalSetName: { zhCN: "摇摆爵士" },
      level: 14,
      mainStat: { stat: "critDmg", value: 48 },
      locked: true,
      source: { type: "zzz-scanner", importId: "scanner-import-1", sequence: 1 },
      raw: rawScan,
      futureDiscField: { preserve: true },
      subStats: [
        { stat: "defFlat", value: 45 },
        { stat: "anomalyProficiency", value: 27 },
        { stat: "critRate", value: 4.8 },
        { stat: "atkPct", value: 15 },
      ],
    })

    const after = JSON.parse(localStorage.getItem("zzz-calculator.userStore.v1") || "{}")
    const saved = after.driveDiscs.find((disc: any) => disc.id === "scanner-fold-disc")
    expect(saved).toMatchObject({
      id: "scanner-fold-disc",
      ownerId: "default",
      setId: "swing_jazz",
      setName: "摇摆爵士",
      canonicalSetName: { zhCN: "摇摆爵士" },
      partition: 4,
      level: 14,
      mainStat: { stat: "critDmg", value: 48 },
      locked: true,
      equippedBy: "agent-a",
      reservedForAgentId: "agent-a",
      excludedForAgentIds: ["agent-b"],
      source: { type: "zzz-scanner", importId: "scanner-import-1", sequence: 1 },
      raw: rawScan,
      futureDiscField: { preserve: true },
    })
    expect(saved.subStats).toEqual([
      { stat: "defFlat", value: 45 },
      { stat: "anomalyProficiency", value: 27 },
      { stat: "critRate", value: 4.8 },
      { stat: "atkPct", value: 15 },
    ])
    expect(after.driveDiscs.find((disc: any) => disc.id === "untouched-default-disc")).toEqual(untouchedDefaultBefore)
    expect(after.driveDiscs.find((disc: any) => disc.id === "untouched-alt-disc")).toEqual(untouchedAltBefore)
    expect(after.owners).toEqual(before.owners)
    expect(after.imports).toEqual(before.imports)
    expect(after.driveDiscLoadouts).toEqual(before.driveDiscLoadouts)
    expect(after.futureStoreField).toEqual(before.futureStoreField)
    expect(localStorage.getItem("zzz-calculator.save-regression-sentinel")).toBe("preserve-me")

    const savedRow = wrapper.findAll("tbody tr").find(row => row.text().includes("摇摆爵士") && row.text().includes("#1"))
    expect(savedRow).toBeTruthy()
    await savedRow!.trigger("click")
    expect(wrapper.find('[aria-label="驱动盘等级"]').attributes("value")).toBe("14")
    expect(wrapper.find('[aria-label="副词条 1 词条数"]').attributes("value")).toBe("3")
    expect(wrapper.find('[aria-label="副词条 2 词条数"]').attributes("value")).toBe("3")
    expect(wrapper.find('.test-modal input[type="checkbox"]').attributes()).toHaveProperty("checked")
  })

  it("keeps the editor draft and reports the reason when saving fails", async () => {
    seedInventory([{
      id: "disc-save-failure",
      ownerId: "default",
      setId: "woodpecker_electro",
      setName: "啄木鸟电音",
      canonicalSetName: { zhCN: "啄木鸟电音" },
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
    }])
    const wrapper = await mountView()
    const inventoryStore = useInventoryStore()
    let rejectSave!: (reason: Error) => void
    const pendingSave = new Promise<void>((_resolve, reject) => {
      rejectSave = reject
    })
    const saveSpy = vi.spyOn(inventoryStore, "saveDisc").mockReturnValue(pendingSave)

    await wrapper.find("tbody tr").trigger("click")
    await wrapper.find('[aria-label="驱动盘等级"]').setValue("14")
    await button(wrapper, "保存").trigger("click")

    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(button(wrapper, "保存").attributes()).toMatchObject({ disabled: "", "data-loading": "true" })
    await button(wrapper, "保存").trigger("click")
    expect(saveSpy).toHaveBeenCalledTimes(1)

    rejectSave(new Error("浏览器数据库事务失败。"))
    await flushPromises()

    expect(messageFixture.error).toHaveBeenCalledWith("保存驱动盘失败：浏览器数据库事务失败。")
    expect(wrapper.find(".test-modal").exists()).toBe(true)
    expect(wrapper.find('[aria-label="驱动盘等级"]').attributes("value")).toBe("14")
    expect(button(wrapper, "保存").attributes()).not.toHaveProperty("disabled")
    expect(button(wrapper, "保存").attributes()).not.toHaveProperty("data-loading")

    saveSpy.mockResolvedValueOnce(undefined)
    await button(wrapper, "保存").trigger("click")
    await flushPromises()
    expect(saveSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.find(".test-modal").exists()).toBe(false)
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
