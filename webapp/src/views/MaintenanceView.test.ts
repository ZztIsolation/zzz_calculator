import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryHistory, createRouter, RouterView } from "vue-router"
import MaintenanceView from "@/views/MaintenanceView.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled", "type"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
  },
  NInput: {
    props: ["value", "disabled", "placeholder", "type", "id"],
    emits: ["update:value", "input"],
    template: `
      <textarea v-if="type === 'textarea'" :id="id" :value="value" :disabled="disabled" :placeholder="placeholder" @input="$emit('update:value', $event.target.value); $emit('input', $event)" />
      <input v-else :id="id" :value="value" :disabled="disabled" :placeholder="placeholder" @input="$emit('update:value', $event.target.value); $emit('input', $event)">
    `,
  },
  NInputNumber: {
    props: ["value", "disabled", "id"],
    emits: ["update:value"],
    template: "<input :id=\"id\" type=\"number\" :value=\"value\" :disabled=\"disabled\" @input=\"$emit('update:value', Number($event.target.value))\">",
  },
  NAlert: { props: ["title"], template: "<div><strong>{{ title }}</strong><slot /></div>" },
  NDropdown: {
    props: ["options", "disabled"],
    emits: ["select"],
    template: "<div><slot /><button v-for=\"option in options\" :key=\"option.key\" type=\"button\" :disabled=\"disabled\" @click=\"$emit('select', option.key)\">{{ option.label }}</button></div>",
  },
  NSelect: {
    props: ["value", "options", "disabled", "multiple", "id"],
    emits: ["update:value"],
    template: `
      <select :id="id" :value="value" :disabled="disabled" :multiple="multiple" @change="update($event)">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
    methods: {
      optionValue(raw: string) {
        const option = (this as any).options?.find((item: any) => String(item.value) === raw)
        return option?.value ?? raw
      },
      update(event: Event) {
        const select = event.target as HTMLSelectElement
        const hasMultiple = (this as any).multiple !== undefined && (this as any).multiple !== false
        const value = hasMultiple
          ? [...select.selectedOptions].map(option => (this as any).optionValue(option.value))
          : (this as any).optionValue(select.value)
        ;(this as any).$emit("update:value", value)
      },
    },
  },
  NSwitch: {
    props: ["value", "disabled", "id"],
    emits: ["update:value"],
    template: "<input :id=\"id\" type=\"checkbox\" :checked=\"value\" :disabled=\"disabled\" @change=\"$emit('update:value', $event.target.checked)\">",
  },
  NRadioGroup: { props: ["value"], emits: ["update:value"], template: "<div><slot /></div>" },
  NRadioButton: { props: ["value", "label"], emits: ["click"], template: "<button type=\"button\" @click=\"$emit('click', $event)\">{{ label }}</button>" },
  NTabs: { props: ["value"], emits: ["update:value"], template: "<div><slot /></div>" },
  NTab: { props: ["name"], template: "<button type=\"button\"><slot /></button>" },
  NTag: { template: "<span><slot /></span>" },
  NTooltip: { template: "<span><slot name=\"trigger\" /><slot /></span>" },
  NModal: {
    props: ["show", "title"],
    emits: ["update:show"],
    template: "<div v-if=\"show\" class=\"modal\"><h3>{{ title }}</h3><slot /><div><slot name=\"action\" /><slot name=\"footer\" /></div></div>",
  },
}))

function jsonResponse(body: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) } as Response
}

function effect(id: string) {
  return { id, type: "fixed", target: { kind: "default" }, stat: "atkPct", mode: "flat", value: 10 }
}

function makeCatalog() {
  return {
    agents: { agents: [{
      id: "agent_a", name: { zhCN: "角色甲" }, rarity: "S", attribute: "physical", damageElement: "physical", specialty: "attack",
      attackTypes: [], faction: "测试阵营", images: { portrait: "", source: "" },
      level60: { hpBase: 1, atkBase: 1, defBase: 1, critRate: 5, critDmg: 50, impact: 0, anomalyProficiency: 0, anomalyMastery: 0, energyRegen: 120, penRatio: 0 },
      combatBuffs: {
        corePassive: { name: { zhCN: "核心被动" }, description: { zhCN: "测试核心被动" }, scope: "inCombat", effects: [effect("core_effect")], coverage: { default: 1, min: 0, max: 1, step: 0.1 }, buffModifiers: [] },
        additionalAbility: null, cinemaBuffs: [],
      },
      skillGroups: [],
      defaultCalculationConfig: {
        cinemaLevel: 0, mode: "custom", name: { zhCN: "2影12变2大" }, selectedEventId: "event_b",
        events: [
          { id: "event_a", kind: "direct", count: 1, critMode: "expected", skillRef: { agentSkillId: "skills_a", categoryId: "basic", moveId: "move", rowId: "hit" } },
          { id: "event_b", kind: "direct", count: 1, critMode: "expected", skillRef: { agentSkillId: "skills_a", categoryId: "basic", moveId: "ultimate_alpha", rowId: "hit_alpha" } },
        ],
      },
      sources: ["https://example.com/agent-primary", "https://example.com/agent-secondary"], verification: {},
    }] },
    agentSkills: { agentSkills: [{
      id: "skills_a", agentId: "agent_a", name: { zhCN: "角色甲技能" },
      categories: [{ id: "basic", name: { zhCN: "普通攻击" }, levelRange: { min: 1, max: 1, default: 1 }, moves: [
        { id: "move", name: { zhCN: "普通攻击" }, skillType: "basic", rows: [{ id: "hit", label: { zhCN: "伤害倍率" }, kind: "damageMultiplier", values: [100] }] },
        { id: "ultimate_alpha", name: { zhCN: "终结技：第一式" }, skillType: "ultimate", rows: [{ id: "hit_alpha", label: { zhCN: "第一式伤害" }, kind: "damageMultiplier", values: [200] }] },
        { id: "ultimate_beta", name: { zhCN: "终结技：第二式" }, skillType: "ultimate", rows: [{ id: "hit_beta", label: { zhCN: "第二式伤害" }, kind: "damageMultiplier", values: [300] }] },
      ] }],
      sources: [], verification: {},
    }] },
    wEngines: { wEngines: [{
      id: "engine_a", name: { zhCN: "音擎甲" }, rarity: "S", specialty: "attack", attribute: "physical", images: { icon: "", source: "" },
      level60: { atkBase: 1, advancedStat: { stat: "critDmg", value: 1, mode: "flat" } }, modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
      effect: {
        name: { zhCN: "音擎效果" }, description: { zhCN: "测试" },
        selfBuff: { scope: "inCombat", condition: "exSpecial", durationSeconds: 10, effectText: { zhCN: "强化特殊技触发。" }, coverage: { default: 1, min: 0, max: 1, step: 0.1 }, effects: [effect("engine_effect")], buffModifiers: [] },
        teamBuff: null,
      }, sources: ["https://example.com/engine-primary", "https://example.com/engine-secondary"], verification: {},
    }] },
    driveDiscSets: { sets: [{ id: "disc_set_a", name: { zhCN: "套装甲" }, images: { icon: "", source: "https://example.com/disc-image" }, sources: ["https://example.com/disc-primary", "https://example.com/disc-secondary"], twoPiece: { effects: [effect("disc_effect")] }, fourPiece: { effectText: { zhCN: "四件套说明" }, selfBuff: { condition: "launchChainAttackOrUltimate", durationSeconds: 12, effects: [effect("disc_four_effect")], buffModifiers: [] }, teamBuff: null } }] },
    anomalyEffects: { effects: [
      { id: "assault", settlementType: "attribute", label: { zhCN: "强击" }, element: "physical", baseMultiplier: 7.13, defaultProcCount: 1 },
      { id: "burn_disorder", settlementType: "disorder", label: { zhCN: "灼烧紊乱" }, element: "fire", fixedMultiplier: 4.5, tickMultiplier: 0.5, tickIntervalSeconds: 1, defaultDurationSeconds: 10 },
    ] },
    combatBuffs: {
      buffs: [{ id: "generic_hidden", sourceType: "manual", name: { zhCN: "不应显示的通用 Buff" } }],
      teammates: [{
        id: "teammate_a", name: { zhCN: "队友甲" }, attribute: "ice", specialty: "stun", images: { icon: "/assets/agents/a.png", source: "https://example.com/a" },
        buffs: [
          { id: "buff_a", source: { zhCN: "核心被动" }, description: { zhCN: "测试核心" }, scope: "inCombat", effects: [effect("teammate_effect_a")], coverage: { default: 1, min: 0, max: 1, step: 0.1 }, buffModifiers: [] },
          { id: "buff_b", source: { zhCN: "额外能力" }, description: { zhCN: "测试额外" }, scope: "inCombat", effects: [effect("teammate_effect_b")], coverage: { default: 1, min: 0, max: 1, step: 0.1 }, buffModifiers: [] },
          { id: "buff_c", source: { zhCN: "影画一" }, description: { zhCN: "测试影画" }, scope: "inCombat", effects: [effect("teammate_effect_c")], coverage: { default: 1, min: 0, max: 1, step: 0.1 }, buffModifiers: [] },
        ],
      }],
      fieldBuffs: [{
        id: "field.defense_v5.v3_0.p1.original", sourceType: "field", scope: "inCombat", name: { zhCN: "原场地 Buff" }, source: { zhCN: "防卫战 v5" },
        period: { modeId: "defense_v5", gameVersion: "3.0", phaseNo: 1, phaseName: { zhCN: "第一期" } }, sourcePeriod: { zhCN: "3.0版本第一期" }, description: { zhCN: "测试" },
        coverage: { default: 1, min: 0, max: 1, step: 0.1 }, effects: [effect("field_effect")], buffModifiers: [],
      }],
      bossBuffs: [{ id: "boss_a", sourceType: "boss", bossName: { zhCN: "Boss 甲" }, effects: [] }],
      systemBuffs: [{ id: "system_hidden", name: { zhCN: "系统 Buff" } }],
    },
    bosses: { bosses: [{
      id: "boss_a", name: { zhCN: "Boss 甲" }, aliases: [], images: { icon: "", source: "" },
      target: { defense: 952, weaknessElements: ["ice"], resistanceElements: ["fire"], resistanceOverrides: {} },
      encounters: [{
        id: "boss_encounter_a", appearances: [{ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 1 }],
        enemyIntel: { zhCN: "测试敌情" }, recommendedSpecialties: [], playerBuffs: [], playerDebuffs: [], sources: [], hidden: false,
      }], hidden: false,
    }] },
    meta: { statRules: { statDisplay: { atkPct: { label: "攻击力百分比" }, critDmg: { label: "暴击伤害" } } }, combatBuffs: [] },
  }
}

async function mountView(options: { failCatalogAfterSave?: boolean, delayFieldSave?: boolean } = {}) {
  let currentCatalog = structuredClone(makeCatalog())
  let successfulSaveCount = 0
  let releaseFieldSave = () => {}
  const fieldSaveGate = options.delayFieldSave ? new Promise<void>(resolve => { releaseFieldSave = resolve }) : null
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/app-config") return jsonResponse({ maintenanceEnabled: true })
    if (url === "/api/maintenance/catalog") {
      if (options.failCatalogAfterSave && successfulSaveCount > 0) return jsonResponse({ ok: false, error: "catalog refresh unavailable" }, 503)
      return jsonResponse({ ok: true, data: currentCatalog })
    }
    if (url === "/api/maintenance/agents" && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const savedItem = { ...body, id: body.id || "generated_agent" }
      currentCatalog.agents.agents.push(savedItem)
      successfulSaveCount += 1
      return jsonResponse({ ok: true, savedItem })
    }
    if (url === "/api/maintenance/drive-disc-sets" && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const savedItem = { ...body, id: body.id || "generated_drive_disc_set" }
      currentCatalog.driveDiscSets.sets = [savedItem]
      successfulSaveCount += 1
      return jsonResponse({ ok: true, savedItem })
    }
    if (url === "/api/maintenance/field-buffs" && init?.method === "POST") {
      await fieldSaveGate
      const body = JSON.parse(String(init.body ?? "{}"))
      const savedItem = { ...body, id: body._maintenanceOriginalId ?? body.id ?? "generated_field_buff" }
      delete savedItem._maintenanceOriginalId
      currentCatalog.combatBuffs.fieldBuffs = [savedItem]
      successfulSaveCount += 1
      return jsonResponse({ ok: true, savedItem })
    }
    if (url === "/api/maintenance/teammate-buffs" && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const teammateId = body.teammate.id || "generated_teammate"
      const buff = { ...body.buff, id: body.buff.id || "generated_buff" }
      const existing = currentCatalog.combatBuffs.teammates.find((item: any) => item.id === teammateId)
      const buffs = [...(existing?.buffs ?? [])]
      const existingBuffIndex = buffs.findIndex((item: any) => item.id === buff.id)
      if (existingBuffIndex >= 0) buffs[existingBuffIndex] = buff
      else buffs.push(buff)
      const buffById = new Map(buffs.map((item: any) => [item.id, item]))
      const orderedBuffs = Array.isArray(body.buffOrder) ? body.buffOrder.map((id: string) => buffById.get(id)) : buffs
      const nextTeammate = { ...existing, ...body.teammate, id: teammateId, buffs: orderedBuffs }
      const teammateIndex = currentCatalog.combatBuffs.teammates.findIndex((item: any) => item.id === teammateId)
      if (teammateIndex >= 0) currentCatalog.combatBuffs.teammates[teammateIndex] = nextTeammate
      else currentCatalog.combatBuffs.teammates.push(nextTeammate)
      successfulSaveCount += 1
      return jsonResponse({ ok: true, savedItem: { ...buff, teammateId, teammateName: body.teammate.name, maintenanceType: "teammate" } })
    }
    if (url === "/api/maintenance/teammate-buffs/teammate_a/buff_a" && init?.method === "DELETE") {
      currentCatalog.combatBuffs.teammates[0].buffs = []
      return jsonResponse({ ok: true })
    }
    if (url === "/api/maintenance/teammate-buffs/teammate_a" && init?.method === "DELETE") {
      currentCatalog.combatBuffs.teammates = []
      return jsonResponse({ ok: true })
    }
    return jsonResponse({ ok: false, error: `Unhandled request: ${url}` }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<div>首页</div>" } }, { path: "/maintenance", component: MaintenanceView }],
  })
  await router.push("/maintenance")
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain("角色甲"))
  return { wrapper, fetchMock, router, releaseFieldSave }
}

const resourceLabels: Record<string, string> = {
  agents: "角色", "agent-skills": "角色技能", "w-engines": "音擎", "drive-disc-sets": "驱动盘套装",
  "anomaly-effects": "异常 / 紊乱", "teammate-buffs": "队友 Buff", "field-buffs": "场地 Buff", "boss-buffs": "Boss Buff",
}

async function switchResource(wrapper: any, value: string) {
  const button = wrapper.findAll(".maintenance-tabs button").find((item: any) => item.text().includes(resourceLabels[value]))
  expect(button).toBeTruthy()
  await button!.trigger("click")
}

function button(wrapper: any, text: string, selector = "button") {
  const found = wrapper.findAll(selector).find((item: any) => item.text().trim() === text)
  expect(found, `button ${text}`).toBeTruthy()
  return found!
}

function field(scope: any, label: string) {
  const row = scope.findAll(".maintenance-field").find((item: any) => item.find("span").text().trim() === label)
  expect(row, `field ${label}`).toBeTruthy()
  return row!
}

beforeEach(() => localStorage.clear())
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe("MaintenanceView structured editor", () => {
  it("maps all eight resources without exposing editable ids, raw JSON, generic buffs, or system buffs", async () => {
    const { wrapper } = await mountView()
    expect(wrapper.findAll(".maintenance-tabs button")).toHaveLength(8)
    expect(wrapper.text()).not.toContain("agent_a")
    expect(wrapper.find("textarea[aria-label='维护 JSON']").exists()).toBe(false)
    expect(wrapper.text()).not.toContain("不应显示的通用 Buff")
    expect(wrapper.text()).not.toContain("系统 Buff")

    for (const [value, visible] of Object.entries({
      agents: "60 级面板", "agent-skills": "技能分类与倍率", "w-engines": "音擎效果", "drive-disc-sets": "2 件套",
      "anomaly-effects": "基础倍率", "teammate-buffs": "Buff 列表", "field-buffs": "场地 Buff 信息", "boss-buffs": "Boss 甲",
    })) {
      await switchResource(wrapper, value)
      expect(wrapper.text()).toContain(visible)
    }
  })

  it("shows skill catalog ids only inside collapsed read-only technical information", async () => {
    const { wrapper } = await mountView()
    await switchResource(wrapper, "agent-skills")

    const technicalInfo = wrapper.find(".skill-technical-info")
    expect(technicalInfo.exists()).toBe(true)
    expect(technicalInfo.attributes("open")).toBeUndefined()
    expect(technicalInfo.text()).toContain("技能目录 ID")
    expect(technicalInfo.text()).toContain("ultimate_alpha")
    expect(technicalInfo.text()).toContain("hit_alpha")
    expect(technicalInfo.find("input").exists()).toBe(false)
    expect(technicalInfo.find("textarea").exists()).toBe(false)
  })

  it("assigns an unused explicit type to the first move in a new skill category", async () => {
    const { wrapper } = await mountView()
    await switchResource(wrapper, "agent-skills")
    await button(wrapper, "添加大类").trigger("click")
    const newCategory = wrapper.findAll(".skill-category-card").at(-1)!
    await button(newCategory, "添加招式").trigger("click")

    expect(field(newCategory, "招式大类").find("select").element.value).toBe("dodge")
  })

  it("creates an agent through the wizard and lets the backend generate its id", async () => {
    const { wrapper, fetchMock } = await mountView()
    await button(wrapper, "新增").trigger("click")
    const modal = wrapper.find(".modal")
    await modal.find("input").setValue("新增角色")
    await button(modal, "创建草稿").trigger("click")
    expect(wrapper.text()).toContain("新增角色")
    expect(wrapper.text()).not.toContain("条目 ID")

    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.id).toBeUndefined()
    expect(body.name.zhCN).toBe("新增角色")
  })

  it("edits field metadata with readable selectors while preserving the hidden identity", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "field-buffs")
    await field(wrapper, "模式").find("select").setValue("critical_assault")
    await field(wrapper, "版本").find("select").setValue("3.3")
    await field(wrapper, "第几期").find("select").setValue("4")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))

    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/field-buffs" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body._maintenanceOriginalId).toBe("field.defense_v5.v3_0.p1.original")
    expect(body.period).toMatchObject({ modeId: "critical_assault", gameVersion: "3.3", phaseNo: 4 })
    expect(wrapper.text()).not.toContain("field.defense_v5.v3_0.p1.original")
  })

  it("keeps teammate roles grouped and saves only the selected buff", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "teammate-buffs")
    const profileName = field(wrapper.find(".teammate-profile-layout"), "队友中文名").find("input")
    await profileName.setValue("队友甲改")
    await field(wrapper.find(".teammate-profile-layout"), "属性").find("select").setValue("fire")
    await field(wrapper.find(".teammate-profile-layout"), "特性").find("select").setValue("support")
    const buffName = field(wrapper.find(".teammate-current-buff"), "来源中文名").find("input")
    await buffName.setValue("额外能力")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("队友甲改"))

    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/teammate-buffs" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body).toMatchObject({
      teammate: { id: "teammate_a", name: { zhCN: "队友甲改" }, attribute: "fire", specialty: "support" },
      buff: { id: "buff_a", source: { zhCN: "额外能力" } },
      buffOrder: ["buff_a", "buff_b", "buff_c"],
    })
    expect(body.teammate.effects).toBeUndefined()
    expect(body.teammate.buffModifiers).toBeUndefined()
    expect(wrapper.text()).not.toContain("teammate_a")
    expect(wrapper.text()).not.toContain("buff_a")
  })

  it("reorders teammate buffs with buttons and drag while preserving selection and saving the complete order", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "teammate-buffs")

    const listLabels = () => wrapper.findAll(".teammate-buff-item").map((item: any) => item.find("strong").text())
    expect(listLabels()).toEqual(["核心被动", "额外能力", "影画一"])
    expect(wrapper.find('[aria-label="上移 核心被动"]').attributes("disabled")).toBeDefined()
    expect(wrapper.find('[aria-label="下移 影画一"]').attributes("disabled")).toBeDefined()

    await wrapper.find('[aria-label="下移 核心被动"]').trigger("click")
    expect(listLabels()).toEqual(["额外能力", "核心被动", "影画一"])
    await wrapper.find('[aria-label="上移 影画一"]').trigger("click")
    expect(listLabels()).toEqual(["额外能力", "影画一", "核心被动"])
    expect(wrapper.find(".teammate-buff-item.active strong").text()).toBe("核心被动")
    expect(wrapper.text()).toContain("有未保存修改")

    const dataTransfer = {
      value: "",
      effectAllowed: "",
      dropEffect: "",
      setData(_type: string, value: string) { this.value = value },
      getData() { return this.value },
    }
    const cinemaHandle = wrapper.find('[aria-label="拖拽调整 影画一 顺序"]')
    await cinemaHandle.trigger("dragstart", { dataTransfer })
    const additionalItem = wrapper.findAll(".teammate-buff-item").find((item: any) => item.text().includes("额外能力"))!
    Object.defineProperty(additionalItem.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 240, width: 240, x: 0, y: 0, toJSON: () => ({}) }),
    })
    await additionalItem.trigger("dragover", { dataTransfer, clientY: 1 })
    await additionalItem.trigger("drop", { dataTransfer, clientY: 1 })
    expect(listLabels()).toEqual(["影画一", "额外能力", "核心被动"])
    expect(wrapper.find(".teammate-buff-item.active strong").text()).toBe("核心被动")

    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const calls = fetchMock.mock.calls.filter(([url, init]) => url === "/api/maintenance/teammate-buffs" && init?.method === "POST")
    const body = JSON.parse(String(calls.at(-1)?.[1]?.body ?? "{}"))
    expect(body.buffOrder).toEqual(["buff_c", "buff_b", "buff_a"])
    expect(listLabels()).toEqual(["影画一", "额外能力", "核心被动"])
  })

  it("supports deleting a selected teammate buff and the whole teammate group", async () => {
    const first = await mountView()
    await switchResource(first.wrapper, "teammate-buffs")
    await button(first.wrapper, "删除当前 Buff").trigger("click")
    await button(first.wrapper.find(".modal"), "删除").trigger("click")
    await vi.waitFor(() => expect(first.fetchMock).toHaveBeenCalledWith("/api/maintenance/teammate-buffs/teammate_a/buff_a", { method: "DELETE" }))
    first.wrapper.unmount()

    const second = await mountView()
    await switchResource(second.wrapper, "teammate-buffs")
    await button(second.wrapper, "删除角色").trigger("click")
    expect(second.wrapper.find(".modal").text()).toContain("全部 3 个 Buff")
    await button(second.wrapper.find(".modal"), "删除").trigger("click")
    await vi.waitFor(() => expect(second.fetchMock).toHaveBeenCalledWith("/api/maintenance/teammate-buffs/teammate_a", { method: "DELETE" }))
  })

  it("does not repeat a successful POST when the full catalog refresh fails", async () => {
    const { wrapper, fetchMock } = await mountView({ failCatalogAfterSave: true })
    await switchResource(wrapper, "field-buffs")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("已保存，刷新失败"))
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "/api/maintenance/field-buffs" && init?.method === "POST")).toHaveLength(1)
    await button(wrapper, "刷新").trigger("click")
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/maintenance/catalog").length).toBeGreaterThan(2))
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "/api/maintenance/field-buffs" && init?.method === "POST")).toHaveLength(1)
  })

  it("locks navigation and fields while a save is in flight", async () => {
    const { wrapper, releaseFieldSave } = await mountView({ delayFieldSave: true })
    await switchResource(wrapper, "field-buffs")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("保存中"))
    expect(wrapper.findAll(".maintenance-tabs button").every(item => item.attributes("disabled") !== undefined)).toBe(true)
    expect(wrapper.findAll(".maintenance-field input, .maintenance-field select").every(item => item.attributes("disabled") !== undefined)).toBe(true)
    releaseFieldSave()
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
  })

  it("migrates the v1 JSON draft and keeps route-leave protection", async () => {
    localStorage.setItem("zzz_maintenance_vue_draft_v1", JSON.stringify({
      resource: "agents", selectedKey: "agent_a", draftText: JSON.stringify({ id: "agent_a", name: { zhCN: "本地草稿角色" } }),
      baselineText: JSON.stringify({ id: "agent_a", name: { zhCN: "角色甲" } }), draftIsNew: false,
      originalIdentity: { id: "agent_a", teammateId: "", maintenanceType: "" },
    }))
    const { wrapper, router } = await mountView()
    expect(wrapper.text()).toContain("已迁移旧草稿")
    expect(wrapper.text()).toContain("本地草稿角色")
    expect(localStorage.getItem("zzz_maintenance_vue_draft_v3")).not.toBeNull()

    await router.push("/")
    await vi.waitFor(() => expect(wrapper.find(".modal").text()).toContain("离开维护页"))
    expect(router.currentRoute.value.path).toBe("/maintenance")
    await button(wrapper.find(".modal"), "离开").trigger("click")
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/"))
  })

  it("shows readable validation errors and does not send invalid data", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "boss-buffs")
    await button(wrapper, "保存").trigger("click")
    expect(wrapper.text()).toContain("请修正以下内容")
    expect(wrapper.text()).toContain("Boss 图片必填")
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/maintenance/boss-buffs")).toBe(false)
    document.body.appendChild(wrapper.element)
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus")
    await wrapper.findAll(".validation-summary button").find(item => item.text().includes("Boss 图片必填"))!.trigger("click")
    await vi.waitFor(() => expect(focusSpy).toHaveBeenCalled())
    expect(focusSpy.mock.contexts).toContain(field(wrapper, "本地图片路径").find("input").element)
    focusSpy.mockRestore()
    wrapper.element.remove()
  })

  it("uses the old calculation objectives and keeps custom selectable", async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find(".default-calc-card").exists()).toBe(false)
    expect(wrapper.find(".default-loop-summary").text()).toContain("已配置 1 套管理员默认循环")
    await button(wrapper, "管理默认循环").trigger("click")
    const modeField = field(wrapper.find(".modal"), "计算方式")
    expect(modeField.find("select").element.value).toBe("custom")
    expect(modeField.text()).toContain("自定义")
    expect(modeField.text()).toContain("最大化单个技能伤害")
    expect(modeField.text()).toContain("最大化异常伤害")
  })

  it("keeps skill-group counts managed while saving per-rule coverage defaults", async () => {
    const { wrapper, fetchMock } = await mountView()
    await button(wrapper, "定义技能组").trigger("click")
    const group = wrapper.find(".skill-group-card")
    expect(group.exists()).toBe(true)
    expect(group.text()).not.toContain("默认次数")
    expect(group.text()).not.toContain("最小次数")
    expect(group.text()).not.toContain("最大次数")
    expect(group.text()).not.toContain("步长")

    expect(wrapper.find(".coverage-editor").exists()).toBe(true)
    expect(wrapper.text()).toContain("允许用户调整覆盖率")
    expect(wrapper.text()).toContain("默认覆盖率%")
    await field(wrapper, "默认覆盖率%").find("input").setValue(40)
    expect(wrapper.text()).not.toContain("调整步长")

    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.skillGroups[0]).toMatchObject({ defaultCount: 1, minCount: 0, maxCount: 100, step: 1 })
    expect(body.combatBuffs.corePassive.coverage).toBeUndefined()
    expect(body.combatBuffs.corePassive.effects[0].coverage).toEqual({ default: 0.4, min: 0, max: 1, step: 0.1 })
  })

  it("renders complete cascading selectors when an effect targets a skill", async () => {
    const { wrapper } = await mountView()
    const rule = wrapper.find(".maintenance-rule-card")
    await button(rule, "指定角色招式").trigger("click")
    expect(field(rule, "角色").find("select").element.value).toBe("skills_a")
    expect(field(rule, "技能大类").text()).toContain("普通攻击")
    expect(field(rule, "招式").text()).toContain("普通攻击")
    expect(field(rule, "招式").text()).toContain("该角色此大类的全部招式")
    expect(field(rule, "增幅类型").text()).toContain("技能目标伤害加成%")
    expect(field(rule, "增幅类型").text()).toContain("技能倍率加算%")
    await field(rule, "招式").find("select").setValue("move")
    expect(field(rule, "倍率行").text()).toContain("伤害倍率")
    expect(rule.find(".skill-target-specific-grid").exists()).toBe(true)
    expect(rule.text()).not.toContain("招式系列")
    expect(rule.text()).not.toContain("既有招式系列")
  })

  it("keeps the complete maintenance stat catalog while hiding the legacy range panel", async () => {
    const { wrapper } = await mountView()
    const rule = wrapper.find(".maintenance-rule-card")
    const statField = field(rule, "增幅类型")
    expect(statField.text()).toContain("火属性伤害暴击伤害%")
    expect(statField.text()).toContain("电属性伤害无视防御率%")
    expect(statField.text()).toContain("风属性贯穿增伤%")
    expect(statField.text()).toContain("冰属性抗性无视%")
    expect(statField.text()).toContain("敌方以太抗性降低%")
    expect(statField.text()).toContain("异常掌控超过 140 时每点转异常精通")
    await statField.find("select").setValue("sheerDmgBonus")
    expect(rule.text()).not.toContain("适用范围")
    expect(rule.text()).not.toContain("伤害类型")
    expect(rule.text()).not.toContain("技能限定")
  })

  it("edits and saves a structured anomaly target", async () => {
    const { wrapper, fetchMock } = await mountView()
    const rule = wrapper.find(".maintenance-rule-card")
    await button(rule, "异常目标").trigger("click")
    expect(field(rule, "结算类型").text()).toContain("属性异常")
    expect(field(rule, "具体异常").text()).toContain("强击")
    expect(field(rule, "增幅类型").text()).toContain("异常持续时间延长（秒）")

    await field(rule, "结算类型").find("select").setValue("disorder")
    await field(rule, "具体异常").find("select").setValue(["burn_disorder"])
    await field(rule, "增幅类型").find("select").setValue("anomalyDurationBonusSeconds")
    await field(rule, "数值").find("input").setValue(5)
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))

    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.combatBuffs.corePassive.effects[0]).toMatchObject({
      stat: "anomalyDurationBonusSeconds",
      value: 5,
      target: { kind: "anomaly", settlementType: "disorder", anomalyEffects: ["burn_disorder"] },
    })
    expect(body.combatBuffs.corePassive.effects[0].appliesTo).toBeUndefined()
  })

  it("uses a readable multi-select for general skill types", async () => {
    const { wrapper } = await mountView()
    const rule = wrapper.find(".maintenance-rule-card")
    await button(rule, "通用技能大类").trigger("click")
    const skillTypes = field(rule, "技能大类").find("select")
    expect(skillTypes.attributes("multiple")).toBeDefined()
    expect(field(rule, "技能大类").text()).toContain("连携技")
    expect(field(rule, "技能大类").text()).toContain("终结技")
    expect(rule.find('[data-field-key="agentSkillId"]').exists()).toBe(false)
    expect(rule.text()).not.toContain("招式系列")
  })

  it("saves a scope-less drive-disc four-piece skill target and keeps new Buff drafts canonical", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "drive-disc-sets")
    const subcards = wrapper.findAll(".maintenance-subcard")
    const selfBuffCard = subcards.find(item => item.text().includes("佩戴者效果"))!
    const selfBuffRule = selfBuffCard.find(".maintenance-rule-card")
    await button(selfBuffRule, "通用技能大类").trigger("click")
    await field(selfBuffRule, "技能大类").find("select").setValue(["ultimate"])
    await field(selfBuffRule, "增幅类型").find("select").setValue("dmgBonus")

    const teamBuffCard = subcards.find(item => item.text().includes("团队效果"))!
    await teamBuffCard.find("input[type='checkbox']").setValue(true)
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))

    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/drive-disc-sets" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.fourPiece.selfBuff.scope).toBeUndefined()
    expect(body.fourPiece.selfBuff.effects[0]).toMatchObject({
      stat: "dmgBonus",
      target: { kind: "skill", skillTargets: [{ kind: "skillType", skillType: "ultimate" }] },
    })
    expect(body.fourPiece.teamBuff.scope).toBeUndefined()
    expect(body.fourPiece.teamBuff.appliesToOutOfCombatPanel).toBeUndefined()
  })

  it("preserves multiple sources separately from image provenance", async () => {
    const { wrapper, fetchMock } = await mountView()
    const sourceInputs = wrapper.findAll(".source-list-row input")
    expect(sourceInputs).toHaveLength(2)
    await sourceInputs[1].setValue("https://example.com/agent-secondary-updated")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.sources).toEqual(["https://example.com/agent-primary", "https://example.com/agent-secondary-updated"])
    expect(body.images.source).toBe("")
  })

  it("keeps a readable target event and normalizes objectives after specialty changes", async () => {
    const { wrapper, fetchMock } = await mountView()
    await button(wrapper, "管理默认循环").trigger("click")
    const modal = wrapper.find(".modal")
    const target = modal.find(".calculation-event-list-item.active")
    expect(target.text()).toContain("终结技：第一式")

    const mode = field(modal, "计算方式").find("select")
    await mode.setValue("single")
    await button(modal, "应用").trigger("click")
    await field(wrapper, "特性").find("select").setValue("rupture")
    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.defaultCalculationConfig.selectedEventId).toBe("event_b")
    expect(body.defaultCalculationConfig.mode).toBe("sheer")
  })

  it("discards modal edits on cancel and applies them only to the maintenance draft", async () => {
    const { wrapper, fetchMock } = await mountView()
    await button(wrapper, "管理默认循环").trigger("click")
    let modal = wrapper.find(".modal")
    await field(modal, "方案名称").find("input").setValue("取消的名称")
    await button(modal, "取消").trigger("click")

    await button(wrapper, "管理默认循环").trigger("click")
    modal = wrapper.find(".modal")
    expect(field(modal, "方案名称").find("input").element.value).toBe("2影12变2大")
    await field(modal, "方案名称").find("input").setValue("已应用名称")
    await button(modal, "应用").trigger("click")
    expect(wrapper.find(".maintenance-save-strip").text()).toContain("有未保存修改")

    await button(wrapper, "保存").trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/maintenance/agents" && init?.method === "POST")!
    const body = JSON.parse(String(call[1]?.body ?? "{}"))
    expect(body.defaultCalculationConfig.name.zhCN).toBe("已应用名称")
    expect(body.defaultCalculationConfig.selectedEventId).toBe("event_b")
  })

  it("shows complete w-engine and drive-disc buff metadata without internal condition values", async () => {
    const { wrapper } = await mountView()
    await switchResource(wrapper, "w-engines")
    expect(wrapper.text()).toContain("触发条件")
    expect(wrapper.text()).toContain("发动强化特殊技")
    expect(wrapper.text()).toContain("分段效果文案")
    expect(wrapper.text()).toContain("可读效果预览")
    expect(wrapper.text()).not.toContain("exSpecial")

    await switchResource(wrapper, "drive-disc-sets")
    expect(wrapper.text()).toContain("发动连携技或终结技")
    expect(wrapper.text()).toContain("持续秒数")
    expect(wrapper.findAll(".source-list-row")).toHaveLength(2)
  })

  it("exposes formula result units and readable shared stack groups", async () => {
    const { wrapper } = await mountView()
    const rule = wrapper.find(".maintenance-rule-card")
    await field(rule, "计算类型").find("select").setValue("formula")
    expect(field(rule, "公式结果单位").text()).toContain("百分比数值")
    await field(rule, "计算类型").find("select").setValue("stacked")
    await field(rule, "共享层数显示名").find("input").setValue("测试共享层数")
    expect(field(rule, "共享层数组").text()).toContain("测试共享层数")
    expect(wrapper.text()).not.toContain("stack_")
  })
})
