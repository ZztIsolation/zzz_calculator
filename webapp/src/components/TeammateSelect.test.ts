import { DOMWrapper, flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import TeammateSelect from "@/components/TeammateSelect.vue"

const options = [
  { value: "rina", label: "丽娜", specialty: "support", avatar: "/rina.png" },
  { value: "lycaon", label: "莱卡恩", specialty: "stun", avatar: "/lycaon.png" },
  { value: "chinatsu", label: "千夏", specialty: "support", avatar: "/chinatsu.png" },
  { value: "future", label: "新队友", specialty: "未来特性", avatar: "/future.png" },
  { value: "legacy", label: "旧队友", avatar: "/legacy.png" },
  { value: "armorer", label: "锋御队友", specialty: "armorer", avatar: "/armorer.png" },
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

function mountSelect(value: string | null = null, available = options) {
  wrapper = mount(TeammateSelect, {
    attachTo: document.body,
    props: { value, options: available, label: "队友一" },
    attrs: { "data-testid": "teammate-slot-0" },
  })
  return wrapper
}

async function openMenu() {
  await wrapper!.get(".n-base-selection").trigger("click")
  await flushPromises()
  return new DOMWrapper(document.body).get(".teammate-select-menu")
}

describe("TeammateSelect", () => {
  it("expands specialties on hover and selects a character only on click", async () => {
    const selected = mountSelect()
    const menu = await openMenu()
    const categories = menu.findAll(".n-cascader-option")
    expect(categories.map(option => option.text())).toEqual(["击破", "支援", "锋御", "未来特性", "其他"])

    await categories.find(option => option.text() === "支援")!.trigger("mouseenter")
    expect(selected.emitted("update:value")).toBeUndefined()

    expect(menu.findAll(".teammate-select-option").map(option => option.text())).toEqual(["丽娜", "千夏"])
    await categories.find(option => option.text() === "击破")!.trigger("mouseenter")
    expect(menu.findAll(".teammate-select-option").map(option => option.text())).toEqual(["莱卡恩"])
    expect(selected.emitted("update:value")).toBeUndefined()
    await categories.find(option => option.text() === "支援")!.trigger("mouseenter")

    const leaves = menu.findAll(".teammate-select-option")
    expect(leaves.map(option => option.text())).toEqual(["丽娜", "千夏"])
    expect(leaves.map(option => option.get("img").attributes("src"))).toEqual(["/rina.png", "/chinatsu.png"])
    await leaves[1]!.trigger("click")
    expect(selected.emitted("update:value")).toEqual([["chinatsu"]])
  })

  it("shows the selected character name and avatar and clears without emitting category identifiers", async () => {
    const selected = mountSelect("rina")
    expect(selected.get(".teammate-select-avatar img").attributes("src")).toBe("/rina.png")
    expect(selected.get(".n-base-selection-label").text()).toBe("丽娜")
    expect(selected.text()).not.toContain("support")

    await selected.get(".n-base-selection").trigger("mouseenter")
    await selected.get(".n-base-clear__clear").trigger("click")
    expect(selected.emitted("update:value")).toEqual([[null]])
    await selected.setProps({ value: null })
    expect(selected.find(".teammate-select-avatar").exists()).toBe(false)
  })

  it("searches names across categories and selects the matching teammate with the keyboard", async () => {
    const selected = mountSelect()
    await openMenu()
    const input = selected.get("input")
    await input.setValue("千夏")
    await flushPromises()
    // jsdom has no layout. Supply the viewport that ResizeObserver measures
    // in browsers, while retaining the native search and keyboard behavior.
    const list = selected.findComponent({ name: "VirtualList" })
    ;(list.vm as unknown as { handleListResize: (entry: unknown) => void }).handleListResize({
      target: list.element,
      contentRect: { width: 280, height: 240 },
    })
    await nextTick()

    const menu = new DOMWrapper(document.body).get(".teammate-select-search-menu")
    expect(menu.text()).toContain("千夏")
    expect(menu.text()).not.toContain("丽娜")
    await input.trigger("keydown", { key: "Enter", code: "Enter" })
    expect(selected.emitted("update:value")?.at(-1)).toEqual(["chinatsu"])
  })

  it("keeps excluded teammates unavailable after options change and leaves the current selection untouched", async () => {
    const selected = mountSelect("lycaon", options.filter(option => option.value !== "rina"))
    const menu = await openMenu()
    await menu.findAll(".n-cascader-option").find(option => option.text() === "支援")!.trigger("click")
    expect(menu.findAll(".teammate-select-option").map(option => option.text())).toEqual(["千夏"])
    await selected.setProps({ options: options.filter(option => option.value !== "chinatsu") })
    expect(selected.emitted("update:value")).toBeUndefined()
    expect(selected.get(".n-base-selection-label").text()).toBe("莱卡恩")
  })
})
