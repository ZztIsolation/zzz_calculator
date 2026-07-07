import { mount } from "@vue/test-utils"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import BuffPickerModal from "@/components/BuffPickerModal.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
  NCheckbox: {
    props: ["checked"],
    emits: ["update:checked"],
    template: "<label><input type=\"checkbox\" :checked=\"checked\" @change=\"$emit('update:checked', $event.target.checked)\"><slot /></label>",
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
    props: ["show"],
    emits: ["update:show"],
    template: "<div v-if=\"show\" role=\"dialog\"><slot /><slot name=\"footer\" /></div>",
  },
  NScrollbar: {
    template: "<div><slot /></div>",
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
  NTabPane: {
    props: ["name", "tab"],
    template: "<button class=\"n-tabs-tab\" type=\"button\" :data-tab-name=\"name\">{{ tab }}</button>",
  },
  NTabs: {
    props: ["value"],
    emits: ["update:value"],
    template: "<div><slot /></div>",
  },
  NTag: {
    template: "<span><slot /></span>",
  },
}))

const meta = {
  agents: [{
    id: "agent_a",
    name: { zhCN: "角色甲" },
    combatBuffs: {
      corePassive: {
        scope: "inCombat",
        source: { zhCN: "核心被动" },
        effects: [{ id: "atk", type: "fixed", stat: "atkFlat", value: 10 }],
      },
    },
  }],
  combatBuffs: [],
  statRules: {
    statDisplay: {
      atkFlat: { label: { zhCN: "攻击力" } },
    },
  },
}

function mountModal() {
  return mount(BuffPickerModal, {
    props: {
      show: false,
      buffs: [],
      selectedIds: [],
      defaultIds: [],
      addedBuffs: [],
      runtimeInputs: {},
      meta,
      driveDiscSets: [],
      agentId: "agent_a",
      cinemaLevel: 0,
      wEngineId: "",
      wEngineModificationLevel: 1,
    },
    global: {
      stubs: {
        ImageAvatar: {
          props: ["name"],
          template: "<span class=\"avatar\">{{ name }}</span>",
        },
        LayerSlider: {
          template: "<input type=\"range\">",
        },
      },
    },
  })
}

async function openModal(wrapper: ReturnType<typeof mountModal>) {
  await wrapper.setProps({ show: true })
  await nextTick()
}

describe("BuffPickerModal", () => {
  it("renders the buff category tabs as a dedicated control strip", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)

    const tabs = wrapper.find(".buff-category-tabs")
    expect(tabs.exists()).toBe(true)
    expect(tabs.text()).toContain("自身 Buff")
    expect(tabs.text()).toContain("队友 Buff")
    expect(tabs.text()).toContain("自定义 Buff")
  })

  it("toggles a buff from the main card area and applies the draft selection", async () => {
    const wrapper = mountModal()

    await openModal(wrapper)
    await wrapper.find(".buff-row-toggle").trigger("click")
    await nextTick()

    expect(wrapper.find(".buff-row").classes()).toContain("is-selected")

    const applyButton = wrapper.findAll("button")
      .find(button => button.text() === "应用选择")
    expect(applyButton).toBeTruthy()

    await applyButton!.trigger("click")

    const payload = wrapper.emitted("apply")?.[0]?.[0] as any
    expect(payload.selectedBuffIds).toEqual(["agent:agent_a.corePassive"])
  })

  it("stores custom percentage effects with the core pct mode", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/BuffPickerModal.vue"), "utf8")

    expect(source).toContain("{ label: '倍率', value: 'pct' }")
    expect(source).not.toContain("{ label: '倍率', value: 'percent' }")
  })
})
