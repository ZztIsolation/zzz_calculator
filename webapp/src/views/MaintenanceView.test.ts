import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import MaintenanceView from "@/views/MaintenanceView.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
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
}))

function jsonResponse(body: any) {
  return {
    ok: true,
    json: async () => body,
  } as Response
}

function mountView(options: { fieldBuffs?: any[] } = {}) {
  const catalog = {
    agents: { agents: [] },
    agentSkills: { agentSkills: [] },
    wEngines: { wEngines: [] },
    driveDiscSets: { sets: [] },
    combatBuffs: { buffs: [], fieldBuffs: options.fieldBuffs ?? [], bossBuffs: [] },
    anomalyEffects: { effects: [] },
    meta: { statRules: { statDisplay: {} } },
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/app-config") {
      return jsonResponse({ maintenanceEnabled: true })
    }
    if (url === "/api/maintenance/catalog") {
      return jsonResponse({
        ok: true,
        data: catalog,
      })
    }
    if (url === "/api/maintenance/field-buffs") {
      const body = JSON.parse(String(init?.body ?? "{}"))
      const savedItem = { ...body, id: body._maintenanceOriginalId ?? body.id ?? "generated_field_buff" }
      delete savedItem._maintenanceOriginalId
      return jsonResponse({
        ok: true,
        data: {
          ...catalog,
          combatBuffs: {
            ...catalog.combatBuffs,
            fieldBuffs: [savedItem],
          },
        },
        savedItem,
      })
    }
    return jsonResponse({ ok: true })
  })
  vi.stubGlobal("fetch", fetchMock)
  const wrapper = mount(MaintenanceView, {
    global: {},
  })
  return { wrapper, fetchMock }
}

describe("MaintenanceView", () => {
  it("uses controlled field buff selectors and defaults for new records", async () => {
    const { wrapper } = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("0 / 0"))

    const selects = wrapper.findAll("select")
    await selects[0].setValue("field-buffs")
    await wrapper.findAll("button").find(button => button.text().includes("新增"))!.trigger("click")

    const fieldSelects = wrapper.findAll("select")
    expect(fieldSelects[1].text()).toContain("防卫战")
    expect(fieldSelects[1].text()).toContain("危局")
    expect(fieldSelects[1].element.value).toBe("defense_v5")
    expect(fieldSelects[2].text()).toContain("3.0版本")
    expect(fieldSelects[2].text()).toContain("3.3版本")
    expect(fieldSelects[2].element.value).toBe("3.0")
    expect(fieldSelects[3].text()).toContain("第一期")
    expect(fieldSelects[3].text()).toContain("第四期")
    expect(fieldSelects[3].element.value).toBe("1")

    expect(wrapper.findAll(".metric").some(metric => metric.text().includes("ID"))).toBe(false)
    expect(wrapper.findAll(".metric").some(metric => metric.text().includes("来源"))).toBe(false)

    const draft = JSON.parse((wrapper.find("textarea").element as HTMLTextAreaElement).value)
    expect(draft.id).toBeUndefined()
    expect(draft.source.zhCN).toBe("防卫战 v5")
    expect(draft.period).toEqual({
      modeId: "defense_v5",
      gameVersion: "3.0",
      phaseNo: 1,
      phaseName: { zhCN: "第一期" },
    })
    expect(draft.sourcePeriod.zhCN).toBe("3.0版本第一期")

    await fieldSelects[1].setValue("critical_assault")
    await fieldSelects[2].setValue("3.3")
    await fieldSelects[3].setValue("4")

    const updatedDraft = JSON.parse((wrapper.find("textarea").element as HTMLTextAreaElement).value)
    expect(updatedDraft.source.zhCN).toBe("危局强袭战")
    expect(updatedDraft.period).toEqual({
      modeId: "critical_assault",
      gameVersion: "3.3",
      phaseNo: 4,
      phaseName: { zhCN: "第四期" },
    })
    expect(updatedDraft.sourcePeriod.zhCN).toBe("3.3版本第四期")
  })

  it("preserves the original field buff id when saving an edited JSON draft", async () => {
    const { wrapper, fetchMock } = mountView({
      fieldBuffs: [
        {
          id: "field.defense_v5.v3_0.p1.original",
          sourceType: "field",
          scope: "inCombat",
          name: { zhCN: "原场地 Buff" },
          source: { zhCN: "防卫战 v5" },
          period: {
            modeId: "defense_v5",
            gameVersion: "3.0",
            phaseNo: 1,
            phaseName: { zhCN: "第一期" },
          },
          sourcePeriod: { zhCN: "3.0版本第一期" },
          description: { zhCN: "测试" },
          coverage: { default: 1, min: 0, max: 1, step: 0.1 },
          effects: [],
          buffModifiers: [],
        },
      ],
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain("0 / 0"))

    await wrapper.findAll("select")[0].setValue("field-buffs")
    await vi.waitFor(() => expect(wrapper.text()).toContain("原场地 Buff"))
    await wrapper.findAll("button").find(button => button.text().includes("原场地 Buff"))!.trigger("click")

    const textarea = wrapper.find("textarea")
    const draft = JSON.parse((textarea.element as HTMLTextAreaElement).value)
    draft.id = "hand_edited_wrong_id"
    await textarea.setValue(JSON.stringify(draft, null, 2))
    await wrapper.findAll("button").find(button => button.text() === "保存")!.trigger("click")

    await vi.waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/maintenance/field-buffs")
      expect(saveCall).toBeTruthy()
    })
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/maintenance/field-buffs")!
    const body = JSON.parse(String(saveCall[1]?.body ?? "{}"))
    expect(body.id).toBe("hand_edited_wrong_id")
    expect(body._maintenanceOriginalId).toBe("field.defense_v5.v3_0.p1.original")
  })
})
