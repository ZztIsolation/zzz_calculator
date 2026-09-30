import { DOMWrapper, flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import WEngineSelect from "@/components/WEngineSelect.vue"

function engine(id: string, rarity: string, specialty?: string, relatedAgentId?: string) {
  return { id, name: { zhCN: `音擎${id}`, en: `Engine ${id}` }, rarity, specialty, relatedAgentId, images: { icon: `/${id}.png` } }
}
const items = [
  engine("attack-b", "B", "attack"),
  engine("a", "A", "anomaly"),
  engine("b", "B", "anomaly"),
  engine("s1", "S", "anomaly"),
  engine("recommended", "A", "anomaly", "agent"),
  engine("unknown", "X", "anomaly"),
  engine("s2", "S", "anomaly", "other-agent"),
  engine("stun", "S", "stun"),
  engine("armorer", "S", "armorer"),
  engine("future", "S", "future"),
  engine("missing", "S"),
]
let wrapper: VueWrapper | undefined

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value() {} })
})
afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo")
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ""
})

function mountSelect(value = "recommended", available = items) {
  wrapper = mount(WEngineSelect, {
    attachTo: document.body,
    props: { items: available, agent: { id: "agent", specialty: "anomaly" }, value },
  })
  return wrapper
}
async function openMenu() {
  await wrapper!.get(".n-base-selection").trigger("click")
  await flushPromises()
  return new DOMWrapper(document.body).get(".w-engine-select-menu")
}
const leafIds = (menu: DOMWrapper<Element>) => menu.findAll("[data-engine-id]").map(leaf => leaf.attributes("data-engine-id"))

describe("WEngineSelect", () => {
  it("opens the selected category, sorts recommended A before S, and preserves ties without duplicates", async () => {
    const selected = mountSelect()
    expect(selected.get(".w-engine-select-display img").attributes("src")).toBe("/recommended.png")
    expect(selected.get(".w-engine-select-display").text()).toContain("异常 / A级")
    const menu = await openMenu()
    expect(menu.findAll("[data-engine-category]").map(category => category.text()))
      .toEqual(["异常", "强攻", "击破", "锋御", "future", "其他"])
    expect(leafIds(menu)).toEqual(["recommended", "s1", "s2", "a", "b", "unknown"])
    expect(menu.findAll(".w-engine-select-recommended")).toHaveLength(1)
    expect(selected.emitted("update:value")).toBeUndefined()
  })

  it("expands the current specialty without selecting anything when the stored ID is unavailable", async () => {
    const selected = mountSelect("unavailable")
    expect(selected.find(".w-engine-select-display").exists()).toBe(false)
    expect(leafIds(await openMenu())).toEqual(["recommended", "s1", "s2", "a", "b", "unknown"])
    expect(selected.emitted("update:value")).toBeUndefined()
  })

  it("supports hover and touch-style category clicks without changing equipment, and selects only leaves", async () => {
    const selected = mountSelect()
    const menu = await openMenu()
    const categories = menu.findAll("[data-engine-category]")
    await categories.find(category => category.text() === "强攻")!.trigger("mouseenter")
    // mouseenter does not bubble: dispatch on the native category row.
    await new DOMWrapper(categories.find(category => category.text() === "强攻")!.element.closest(".n-cascader-option")!).trigger("mouseenter")
    expect(leafIds(menu)).toEqual(["attack-b"])
    await categories.find(category => category.text() === "击破")!.trigger("click")
    expect(leafIds(menu)).toEqual(["stun"])
    expect(selected.emitted("update:value")).toBeUndefined()
    await menu.get('[data-engine-id="stun"]').trigger("click")
    expect(selected.emitted("update:value")).toEqual([["stun"]])
    expect(selected.find(".n-base-clear__clear").exists()).toBe(false)
  })

  it("keeps a saved cross-specialty engine visible and reopens its category", async () => {
    mountSelect("attack-b")
    expect(leafIds(await openMenu())).toEqual(["attack-b"])
    expect(wrapper!.get(".n-base-selection-label").text()).toContain("音擎attack-b")
  })

  it("updates recommendations after changing characters without emitting an equipment change", async () => {
    const selected = mountSelect()
    await openMenu()
    await selected.setProps({ agent: { id: "other-agent", specialty: "stun" } })
    await flushPromises()
    expect(selected.get(".w-engine-select-display").text()).toContain("音擎recommended")
    const menu = await openMenu()
    expect(menu.findAll("[data-engine-category]")[0]!.text()).toBe("击破")
    expect(leafIds(menu)).toEqual(["s2", "s1", "a", "recommended", "b", "unknown"])
    expect(menu.get('[data-engine-id="s2"]').text()).toContain("角色推荐")
    expect(menu.get('[data-engine-id="recommended"]').text()).not.toContain("角色推荐")
    expect(selected.emitted("update:value")).toBeUndefined()
  })

  it("searches all categories in sorted order with existing metadata fields and selects with the keyboard", async () => {
    const selected = mountSelect()
    await openMenu()
    const input = selected.get("input")
    await input.setValue("音擎")
    await flushPromises()
    const list = selected.findComponent({ name: "VirtualList" })
    ;(list.vm as unknown as { handleListResize: (entry: unknown) => void }).handleListResize({
      target: list.element, contentRect: { width: 360, height: 600 },
    })
    await nextTick()
    const menu = new DOMWrapper(document.body).get(".w-engine-select-search-menu")
    const names = menu.findAll(".n-base-select-option__content").map(option => option.text())
    expect(names[0]).toContain("音擎recommended")
    expect(names[1]).toContain("音擎s1")
    for (const query of ["Engine attack-b", "attack-b", "强攻", "attack"]) {
      await input.setValue(query)
      await flushPromises()
      expect(menu.text()).toContain("音擎attack-b")
      expect(menu.text()).not.toContain("音擎recommended")
    }
    await input.trigger("keydown", { key: "Enter", code: "Enter" })
    expect(selected.emitted("update:value")?.at(-1)).toEqual(["attack-b"])
  })

  it("closes with Escape, handles no matches, and never selects a category with Enter", async () => {
    const selected = mountSelect("")
    await openMenu()
    const input = selected.get("input")
    await input.trigger("keydown", { key: "Enter", code: "Enter" })
    expect(selected.emitted("update:value")).toBeUndefined()
    await input.setValue("does-not-exist")
    await flushPromises()
    expect(new DOMWrapper(document.body).findAll(".w-engine-select-search-menu .n-base-select-option")).toHaveLength(0)
    await input.trigger("keydown", { key: "Escape", code: "Escape" })
    expect(selected.get(".n-base-selection").classes()).not.toContain("n-base-selection--active")
    expect(selected.emitted("update:value")).toBeUndefined()
  })

  it("sorts by rarity without recommendations and handles an empty catalog", async () => {
    const selected = mountSelect("s1", items.filter(item => !item.relatedAgentId))
    expect(leafIds(await openMenu())).toEqual(["s1", "a", "b", "unknown"])
    await selected.setProps({ items: [] })
    expect(selected.find(".w-engine-select-display").exists()).toBe(false)
    expect(selected.emitted("update:value")).toBeUndefined()
  })
})
