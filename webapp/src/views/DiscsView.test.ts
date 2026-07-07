import { flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { beforeEach, describe, expect, it, vi } from "vitest"
import DiscsView from "@/views/DiscsView.vue"

const catalogFixture = vi.hoisted(() => ({
  catalog: {
    driveDiscSets: [{
      id: "woodpecker_electro",
      name: { zhCN: "啄木鸟电音" },
      images: { icon: "/assets/drive-discs/woodpecker_electro.png" },
    }],
  },
  meta: {
    agents: [],
    wEngines: [],
    combatBuffs: [],
    statRules: {
      statDisplay: {
        hpFlat: { label: { zhCN: "生命值" } },
        critRate: { label: { zhCN: "暴击率" } },
      },
    },
  },
}))

vi.mock("@core/catalog-loader.js", () => ({
  loadCatalog: vi.fn(async () => catalogFixture.catalog),
  loadMeta: vi.fn(async () => catalogFixture.meta),
}))

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot name=\"icon\" /><slot /></button>",
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
    props: ["show"],
    template: "<div v-if=\"show\"><slot /><slot name=\"footer\" /></div>",
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

describe("DiscsView", () => {
  beforeEach(() => {
    localStorage.clear()
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
    expect(identity.find("img").attributes("src")).toBe("/assets/drive-discs/woodpecker_electro.png")
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
})
