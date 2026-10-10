import { DOMWrapper, flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import AgentSelect from "@/components/AgentSelect.vue"

function agent(id: string, specialty: string, attribute = "physical", rarity = "S") {
  return { id, name: { zhCN: `角色${id}`, en: `Agent ${id}` }, specialty, attribute, rarity, images: { portrait: `/${id}.png` } }
}

const items = [
  agent("attack-a", "attack", "fire", "A"),
  agent("anomaly-a", "anomaly"),
  agent("anomaly-b", "anomaly", "ether"),
  agent("stun", "stun", "electric"),
  agent("rupture", "rupture", "honed_edge"),
  agent("armorer", "armorer", "electric"),
  agent("future", "future-specialty", "physical"),
  agent("missing", ""),
]

let wrapper: VueWrapper | undefined

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value() {} })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ""
})

function mountSelect(value = "anomaly-a", available = items) {
  wrapper = mount(AgentSelect, {
    attachTo: document.body,
    props: { items: available, value },
  })
  return wrapper
}

async function openMenu() {
  await wrapper!.get(".n-base-selection").trigger("click")
  await flushPromises()
  return new DOMWrapper(document.body).get(".agent-select-menu")
}

const leafIds = (menu: DOMWrapper<Element>) => menu.findAll("[data-agent-id]").map(leaf => leaf.attributes("data-agent-id"))

describe("AgentSelect", () => {
  it("groups agents by specialty and preserves catalog order", async () => {
    const selected = mountSelect()
    expect(selected.get(".agent-select-display img").attributes("src")).toBe("/anomaly-a.png")
    expect(selected.get(".agent-select-display").text()).toContain("角色anomaly-a")
    expect(selected.get(".agent-select-display").text()).toContain("异常 / S级")
    const menu = await openMenu()
    expect(menu.findAll("[data-agent-category]").map(category => category.text()))
      .toEqual(["异常", "强攻", "击破", "命破", "锋御", "future-specialty", "其他"])
    expect(leafIds(menu)).toEqual(["anomaly-a", "anomaly-b"])
    const attackCategory = menu.findAll("[data-agent-category]").find(category => category.text() === "强攻")!
    await attackCategory.trigger("mouseenter")
    await new DOMWrapper(attackCategory.element.closest(".n-cascader-option")!).trigger("mouseenter")
    expect(leafIds(menu)).toEqual(["attack-a"])
    expect(selected.emitted("update:value")).toBeUndefined()
  })

  it("expands categories without selecting them and emits only leaf IDs", async () => {
    const selected = mountSelect("")
    const menu = await openMenu()
    const categories = menu.findAll("[data-agent-category]")
    await categories.find(category => category.text() === "击破")!.trigger("click")
    expect(leafIds(menu)).toEqual(["stun"])
    expect(selected.emitted("update:value")).toBeUndefined()
    await menu.get('[data-agent-id="stun"]').trigger("click")
    expect(selected.emitted("update:value")).toEqual([["stun"]])
  })

  it("searches all categories and selects the matching agent with the keyboard", async () => {
    const selected = mountSelect("")
    await openMenu()
    const input = selected.get("input")
    await input.setValue("Agent attack-a")
    await flushPromises()
    const list = selected.findComponent({ name: "VirtualList" })
    ;(list.vm as unknown as { handleListResize: (entry: unknown) => void }).handleListResize({
      target: list.element, contentRect: { width: 360, height: 600 },
    })
    await flushPromises()
    const menu = new DOMWrapper(document.body).get(".agent-select-search-menu")
    expect(menu.text()).toContain("角色attack-a")
    expect(menu.text()).not.toContain("角色anomaly-a")
    await input.trigger("keydown", { key: "Enter", code: "Enter" })
    expect(selected.emitted("update:value")?.at(-1)).toEqual(["attack-a"])
  })

  it("does not select a category with Enter and handles an unavailable value", async () => {
    const selected = mountSelect("unavailable")
    expect(selected.find(".agent-select-display").exists()).toBe(false)
    const menu = await openMenu()
    await selected.get("input").trigger("keydown", { key: "Enter", code: "Enter" })
    expect(selected.emitted("update:value")).toBeUndefined()
    await selected.get("input").trigger("keydown", { key: "Escape", code: "Escape" })
    expect(selected.get(".n-base-selection").classes()).not.toContain("n-base-selection--active")
    expect(menu.exists()).toBe(true)
  })
})
