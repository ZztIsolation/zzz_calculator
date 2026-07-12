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
    props: ["value", "disabled", "placeholder", "type"],
    emits: ["update:value", "input"],
    template: `
      <textarea v-if="type === 'textarea'" :value="value" :disabled="disabled" :placeholder="placeholder" @input="$emit('update:value', $event.target.value); $emit('input', $event)" />
      <input v-else :value="value" :disabled="disabled" :placeholder="placeholder" @input="$emit('update:value', $event.target.value); $emit('input', $event)">
    `,
  },
  NSelect: {
    props: ["value", "options", "disabled"],
    emits: ["update:value"],
    template: `
      <select :value="value" :disabled="disabled" @change="$emit('update:value', optionValue($event.target.value))">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
    methods: {
      optionValue(raw: string) {
        const option = (this as any).options?.find((item: any) => String(item.value) === raw)
        return option?.value ?? raw
      },
    },
  },
  NTag: {
    template: "<span><slot /></span>",
  },
  NModal: {
    props: ["show", "title"],
    emits: ["update:show"],
    template: "<div v-if=\"show\" class=\"modal\"><h3>{{ title }}</h3><slot /><div><slot name=\"action\" /></div></div>",
  },
}))

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => structuredClone(body),
  } as Response
}

function makeCatalog() {
  return {
    agents: { agents: [{ id: "agent_a", name: { zhCN: "角色甲" } }] },
    agentSkills: { agentSkills: [{ id: "skills_a", agentId: "agent_a", name: { zhCN: "角色甲技能" }, categories: [] }] },
    wEngines: { wEngines: [{ id: "engine_a", name: { zhCN: "音擎甲" } }] },
    driveDiscSets: { sets: [{ id: "disc_set_a", name: { zhCN: "套装甲" } }] },
    anomalyEffects: {
      effects: [
        { id: "assault", settlementType: "attribute", label: { zhCN: "强击" }, element: "physical", baseMultiplier: 7.13, defaultProcCount: 1 },
        { id: "burn_disorder", settlementType: "disorder", label: { zhCN: "灼烧紊乱" }, element: "fire", fixedMultiplier: 4.5, tickMultiplier: 0.5, tickIntervalSeconds: 1, defaultDurationSeconds: 10 },
      ],
    },
    combatBuffs: {
      buffs: [{ id: "generic_hidden", sourceType: "manual", name: { zhCN: "不应显示的通用 Buff" } }],
      teammates: [
        {
          id: "teammate_a",
          name: { zhCN: "队友甲" },
          images: { icon: "/assets/agents/a.png" },
          buffs: [
            {
              id: "buff_a",
              source: { zhCN: "核心被动" },
              description: { zhCN: "测试" },
              scope: "inCombat",
              effects: [{ id: "teammate_test_atk", type: "fixed", target: { kind: "default" }, stat: "atkPct", mode: "flat", value: 10 }],
              coverage: { default: 1, min: 0, max: 1, step: 0.1 },
            },
          ],
        },
      ],
      fieldBuffs: [
        {
          id: "field.defense_v5.v3_0.p1.original",
          sourceType: "field",
          scope: "inCombat",
          name: { zhCN: "原场地 Buff" },
          source: { zhCN: "防卫战 v5" },
          period: { modeId: "defense_v5", gameVersion: "3.0", phaseNo: 1, phaseName: { zhCN: "第一期" } },
          sourcePeriod: { zhCN: "3.0版本第一期" },
          description: { zhCN: "测试" },
          coverage: { default: 1, min: 0, max: 1, step: 0.1 },
          effects: [{ id: "field_test_atk", type: "fixed", target: { kind: "default" }, stat: "atkPct", mode: "flat", value: 10 }],
          buffModifiers: [],
        },
      ],
      bossBuffs: [{ id: "boss_a", sourceType: "boss", bossName: { zhCN: "Boss 甲" }, effects: [] }],
      systemBuffs: [{ id: "system_hidden", name: { zhCN: "系统 Buff" } }],
    },
    meta: { statRules: { statDisplay: {} } },
  }
}

async function mountView(options: { catalog?: any, appConfigFromStatic?: boolean, failCatalogAfterSave?: boolean, delayFieldSave?: boolean } = {}) {
  let currentCatalog = structuredClone(options.catalog ?? makeCatalog())
  let successfulSaveCount = 0
  let releaseFieldSave = () => {}
  const fieldSaveGate = options.delayFieldSave
    ? new Promise<void>(resolve => { releaseFieldSave = resolve })
    : null
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/app-config") {
      return options.appConfigFromStatic
        ? jsonResponse({ error: "not found" }, 404)
        : jsonResponse({ maintenanceEnabled: true })
    }
    if (url === "/static/app-config.json") {
      return jsonResponse({ maintenanceEnabled: true })
    }
    if (url === "/api/maintenance/catalog") {
      if (options.failCatalogAfterSave && successfulSaveCount > 0) {
        return jsonResponse({ ok: false, error: "catalog refresh unavailable" }, 503)
      }
      return jsonResponse({ ok: true, data: currentCatalog })
    }

    if (url === "/api/maintenance/field-buffs" && init?.method === "POST") {
      await fieldSaveGate
      const body = JSON.parse(String(init.body ?? "{}"))
      const savedItem = { ...body, id: body._maintenanceOriginalId ?? body.id ?? "generated_field_buff" }
      delete savedItem._maintenanceOriginalId
      currentCatalog.combatBuffs.fieldBuffs = [savedItem]
      successfulSaveCount += 1
      return jsonResponse({
        ok: true,
        data: { version: 2, fieldBuffs: [savedItem] },
        savedItem,
        meta: {},
      })
    }

    if (url === "/api/maintenance/teammate-buffs" && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const buff = { ...body.buff, id: body.buff.id || "generated_teammate_buff" }
      const teammate = {
        ...body.teammate,
        buffs: [buff],
      }
      currentCatalog.combatBuffs.teammates = [teammate]
      successfulSaveCount += 1
      return jsonResponse({
        ok: true,
        data: { version: 2, teammates: [teammate] },
        savedItem: {
          ...buff,
          maintenanceType: "teammate",
          teammateId: teammate.id,
          teammateName: teammate.name,
        },
        meta: {},
      })
    }

    if (url === "/api/maintenance/teammate-buffs/teammate_a/buff_a" && init?.method === "DELETE") {
      currentCatalog.combatBuffs.teammates[0].buffs = []
      return jsonResponse({ ok: true, meta: {} })
    }

    if (url === "/api/maintenance/anomaly-effects/disorder/burn_disorder" && init?.method === "DELETE") {
      currentCatalog.anomalyEffects.effects = currentCatalog.anomalyEffects.effects.filter((item: any) => item.id !== "burn_disorder")
      return jsonResponse({ ok: true, meta: {} })
    }

    return jsonResponse({ ok: false, error: `Unhandled request: ${url}` }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div>首页</div>" } },
      { path: "/maintenance", component: MaintenanceView },
    ],
  })
  await router.push("/maintenance")
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain("角色甲"))
  return { wrapper, fetchMock, router, getCatalog: () => currentCatalog, releaseFieldSave }
}

async function switchResource(wrapper: ReturnType<typeof mount>, value: string) {
  await wrapper.find("select[aria-label='维护资源']").setValue(value)
}

function editor(wrapper: ReturnType<typeof mount>) {
  return wrapper.find("textarea[aria-label='维护 JSON']")
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("MaintenanceView", () => {
  it("maps all eight maintenance resources and hides generic and system buffs", async () => {
    const { wrapper } = await mountView({ appConfigFromStatic: true })
    const resourceSelect = wrapper.find("select[aria-label='维护资源']")
    expect(resourceSelect.findAll("option").map(option => option.text())).toEqual([
      "角色",
      "角色技能",
      "音擎",
      "驱动盘套装",
      "异常/紊乱",
      "队友 Buff",
      "场地 Buff",
      "Boss Buff",
    ])

    for (const [value, expected] of [
      ["agents", "角色甲"],
      ["agent-skills", "角色甲技能"],
      ["w-engines", "音擎甲"],
      ["drive-disc-sets", "套装甲"],
      ["anomaly-effects", "强击"],
      ["teammate-buffs", "队友甲｜核心被动"],
      ["field-buffs", "原场地 Buff"],
      ["boss-buffs", "Boss 甲"],
    ]) {
      await switchResource(wrapper, value)
      expect(wrapper.text()).toContain(expected)
    }

    expect(wrapper.text()).not.toContain("不应显示的通用 Buff")
    expect(wrapper.text()).not.toContain("系统 Buff")
  })

  it("creates and clones local drafts for all eight resources", async () => {
    for (const value of [
      "agents",
      "agent-skills",
      "w-engines",
      "drive-disc-sets",
      "anomaly-effects",
      "teammate-buffs",
      "field-buffs",
      "boss-buffs",
    ]) {
      const { wrapper, fetchMock } = await mountView()
      await switchResource(wrapper, value)
      const original = JSON.parse((editor(wrapper).element as HTMLTextAreaElement).value)
      await wrapper.findAll("button").find(button => button.text() === "复制当前")!.trigger("click")
      const cloned = JSON.parse((editor(wrapper).element as HTMLTextAreaElement).value)
      expect(wrapper.text()).toContain("复制条目已保存为本地草稿")
      if (value === "field-buffs") {
        expect(cloned.id).toBeUndefined()
      } else {
        expect(cloned.id).toBeTruthy()
        expect(cloned.id).not.toBe(original.id)
      }

      await wrapper.findAll("button").find(button => button.text() === "删除")!.trigger("click")
      await wrapper.find(".modal").findAll("button").find(button => button.text() === "删除")!.trigger("click")
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)
      await wrapper.findAll("button").find(button => button.text() === "新增")!.trigger("click")
      expect(wrapper.text()).toContain("新增条目已保存为本地草稿")
      expect(JSON.parse((editor(wrapper).element as HTMLTextAreaElement).value)).toBeTypeOf("object")
      wrapper.unmount()
      localStorage.clear()
    }
  })

  it("rejects identity changes instead of silently creating a second record", async () => {
    const { wrapper, fetchMock } = await mountView()
    const changed = JSON.parse((editor(wrapper).element as HTMLTextAreaElement).value)
    changed.id = "renamed_agent"
    await editor(wrapper).setValue(JSON.stringify(changed, null, 2))
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")
    expect(wrapper.text()).toContain("已有条目的 ID 不可修改")
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/maintenance/agents")).toBe(false)
  })

  it("uses field selectors and reloads the full catalog after the single-file save response", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "field-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("原场地 Buff"))!.trigger("click")

    const fieldSelects = wrapper.findAll("select")
    expect(fieldSelects[1].text()).toContain("防卫战")
    expect(fieldSelects[1].text()).toContain("危局")
    await fieldSelects[1].setValue("critical_assault")
    await fieldSelects[2].setValue("3.3")
    await fieldSelects[3].setValue("4")

    const draft = JSON.parse((editor(wrapper).element as HTMLTextAreaElement).value)
    draft.id = "hand_edited_wrong_id"
    await editor(wrapper).setValue(JSON.stringify(draft, null, 2))
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")

    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/maintenance/field-buffs")!
    const body = JSON.parse(String(saveCall[1]?.body ?? "{}"))
    expect(body.id).toBe("hand_edited_wrong_id")
    expect(body._maintenanceOriginalId).toBe("field.defense_v5.v3_0.p1.original")
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/maintenance/catalog")).toHaveLength(2)
    expect(wrapper.text()).toContain("原场地 Buff")
  })

  it("saves teammate buffs with teammate and buff objects, then reloads the catalog", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "teammate-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("队友甲｜核心被动"))!.trigger("click")
    await wrapper.find("input[aria-label='队友名称']").setValue("队友甲改")
    await wrapper.find("input[aria-label='Buff 来源']").setValue("额外能力")
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")

    await vi.waitFor(() => expect(wrapper.text()).toContain("队友甲改｜额外能力"))
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/maintenance/teammate-buffs")!
    expect(JSON.parse(String(saveCall[1]?.body ?? "{}"))).toMatchObject({
      teammate: { id: "teammate_a", name: { zhCN: "队友甲改" } },
      buff: { id: "buff_a", source: { zhCN: "额外能力" } },
    })
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/maintenance/catalog")).toHaveLength(2)
  })

  it("does not repeat a successful POST when the full catalog refresh fails", async () => {
    const { wrapper, fetchMock } = await mountView({ failCatalogAfterSave: true })
    await switchResource(wrapper, "field-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("原场地 Buff"))!.trigger("click")
    await wrapper.findAll("button").find(button => button.text() === "复制当前")!.trigger("click")
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")

    await vi.waitFor(() => expect(wrapper.text()).toContain("已保存，刷新失败"))
    expect((editor(wrapper).element as HTMLTextAreaElement).value).toContain("generated_field_buff")
    expect(localStorage.getItem("zzz_maintenance_vue_draft_v1")).toBeNull()
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "/api/maintenance/field-buffs" && init?.method === "POST")).toHaveLength(1)

    await wrapper.findAll("button").find(button => button.text() === "刷新")!.trigger("click")
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/maintenance/catalog")).toHaveLength(3))
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "/api/maintenance/field-buffs" && init?.method === "POST")).toHaveLength(1)
  })

  it("locks resource selection and editing while a save is in flight", async () => {
    const { wrapper, releaseFieldSave } = await mountView({ delayFieldSave: true })
    await switchResource(wrapper, "field-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("原场地 Buff"))!.trigger("click")
    const originalDraft = (editor(wrapper).element as HTMLTextAreaElement).value
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")
    await vi.waitFor(() => expect(wrapper.text()).toContain("保存中"))

    const resourceSelect = wrapper.find("select[aria-label='维护资源']")
    expect(resourceSelect.attributes("disabled")).toBeDefined()
    expect(editor(wrapper).attributes("disabled")).toBeDefined()
    expect(wrapper.findAll("button.entity-option").every(button => button.attributes("disabled") !== undefined)).toBe(true)
    await resourceSelect.setValue("agents")
    await editor(wrapper).setValue('{"id":"should_not_apply"}')

    releaseFieldSave()
    await vi.waitFor(() => expect(wrapper.text()).toContain("完整目录已刷新"))
    expect((resourceSelect.element as HTMLSelectElement).value).toBe("field-buffs")
    expect((editor(wrapper).element as HTMLTextAreaElement).value).toBe(originalDraft)
    expect((editor(wrapper).element as HTMLTextAreaElement).value).not.toContain("should_not_apply")
  })

  it("requires confirmation and uses both teammate keys when deleting", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "teammate-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("队友甲｜核心被动"))!.trigger("click")
    await wrapper.findAll("button").find(button => button.text() === "删除")!.trigger("click")

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)
    expect(wrapper.find(".modal").text()).toContain("删除维护条目")
    await wrapper.find(".modal").findAll("button").find(button => button.text() === "删除")!.trigger("click")

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/maintenance/teammate-buffs/teammate_a/buff_a",
      { method: "DELETE" },
    ))
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/maintenance/catalog")).toHaveLength(2)
  })

  it("uses the anomaly type and id in the confirmed delete URL", async () => {
    const { wrapper, fetchMock } = await mountView()
    await switchResource(wrapper, "anomaly-effects")
    await wrapper.findAll("button").find(button => button.text().includes("灼烧紊乱"))!.trigger("click")
    await wrapper.findAll("button").find(button => button.text() === "删除")!.trigger("click")
    await wrapper.find(".modal").findAll("button").find(button => button.text() === "删除")!.trigger("click")

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/maintenance/anomaly-effects/disorder/burn_disorder",
      { method: "DELETE" },
    ))
  })

  it("restores local drafts and prompts before leaving with unsaved changes", async () => {
    localStorage.setItem("zzz_maintenance_vue_draft_v1", JSON.stringify({
      resource: "agents",
      selectedKey: "agent_a",
      draftText: JSON.stringify({ id: "agent_a", name: { zhCN: "本地草稿角色" } }, null, 2),
      baselineText: JSON.stringify({ id: "agent_a", name: { zhCN: "角色甲" } }, null, 2),
      draftIsNew: false,
      originalIdentity: { id: "agent_a", teammateId: "", maintenanceType: "" },
    }))
    const { wrapper, router } = await mountView()
    expect(wrapper.text()).toContain("已恢复草稿")
    expect((editor(wrapper).element as HTMLTextAreaElement).value).toContain("本地草稿角色")

    await router.push("/")
    await vi.waitFor(() => expect(wrapper.find(".modal").text()).toContain("离开维护页"))
    expect(router.currentRoute.value.path).toBe("/maintenance")
    await wrapper.find(".modal").findAll("button").find(button => button.text() === "离开")!.trigger("click")
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/"))
    expect(localStorage.getItem("zzz_maintenance_vue_draft_v1")).not.toBeNull()
  })

  it("reports malformed JSON without sending a save request", async () => {
    const { wrapper, fetchMock } = await mountView()
    await editor(wrapper).setValue("{ invalid")
    await wrapper.findAll("button").find(button => button.text().includes("校验 JSON"))!.trigger("click")
    expect(wrapper.text()).toContain("JSON 无效")
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/maintenance/agents")).toBe(false)
  })
})
