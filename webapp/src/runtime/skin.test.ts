import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { editorialDarkThemeOverrides, editorialLightThemeOverrides } from "./editorial-theme-overrides"

const SKIN_KEY = "zzz-calculator.webapp.skin.v1"

async function loadSkin() {
  vi.resetModules()
  return import("@/runtime/skin")
}

describe("skin preference", () => {
  beforeEach(() => {
    localStorage.removeItem(SKIN_KEY)
    document.documentElement.removeAttribute("data-skin")
    window.history.replaceState({}, "", "/")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem(SKIN_KEY)
    document.documentElement.removeAttribute("data-skin")
    window.history.replaceState({}, "", "/")
  })

  it("defaults to classic without setting data-skin or altering theme overrides", async () => {
    const { initSkin, useSkin } = await loadSkin()
    initSkin()
    const { skin, isEditorial, resolveThemeOverrides } = useSkin()
    const base = { common: { primaryColor: "#2f7df6" } }
    expect(skin.value).toBe("classic")
    expect(isEditorial.value).toBe(false)
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false)
    expect(resolveThemeOverrides(base, false)).toBe(base)
    expect(resolveThemeOverrides(base, true)).toBe(base)
  })

  it("toggles between classic and editorial, persists, and resolves editorial overrides", async () => {
    const { useSkin } = await loadSkin()
    const { skin, isEditorial, toggleSkin, resolveThemeOverrides } = useSkin()
    const base = { common: { primaryColor: "#2f7df6" } }

    toggleSkin()
    expect(skin.value).toBe("editorial")
    expect(isEditorial.value).toBe(true)
    expect(document.documentElement.getAttribute("data-skin")).toBe("editorial")
    expect(localStorage.getItem(SKIN_KEY)).toBe("editorial")
    expect(resolveThemeOverrides(base, false)).toEqual(editorialLightThemeOverrides)
    expect(resolveThemeOverrides(base, true)).toEqual(editorialDarkThemeOverrides)

    toggleSkin()
    expect(skin.value).toBe("classic")
    expect(isEditorial.value).toBe(false)
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false)
    expect(localStorage.getItem(SKIN_KEY)).toBeNull()
  })

  it("activates editorial skin from ?skin=editorial query parameter and persists it", async () => {
    window.history.replaceState({}, "", "/?skin=editorial")
    const { initSkin, useSkin } = await loadSkin()
    initSkin()
    expect(useSkin().skin.value).toBe("editorial")
    expect(document.documentElement.getAttribute("data-skin")).toBe("editorial")
    expect(localStorage.getItem(SKIN_KEY)).toBe("editorial")
  })
})
