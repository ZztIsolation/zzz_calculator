import { computed, readonly, ref } from "vue"
import type { GlobalThemeOverrides } from "naive-ui"
import { editorialDarkThemeOverrides, editorialLightThemeOverrides } from "./editorial-theme-overrides"

export type SkinPreference = "classic" | "editorial"

const SKIN_KEY = "zzz-calculator.webapp.skin.v1"
const VALID_SKINS: SkinPreference[] = ["classic", "editorial"]

function normalizeSkin(value: unknown): SkinPreference | null {
  const text = String(value ?? "").trim().toLowerCase()
  return VALID_SKINS.includes(text as SkinPreference) ? (text as SkinPreference) : null
}

function readSkinFromQuery(): SkinPreference | null {
  if (typeof window === "undefined") return null
  try {
    const params = new URLSearchParams(window.location.search)
    return normalizeSkin(params.get("skin"))
  } catch {
    return null
  }
}

function readStoredSkin(): SkinPreference {
  const fromQuery = readSkinFromQuery()
  if (fromQuery) return fromQuery
  try {
    return normalizeSkin(localStorage.getItem(SKIN_KEY)) ?? "classic"
  } catch {
    return "classic"
  }
}

const skin = ref<SkinPreference>(readStoredSkin())
const isEditorial = computed(() => skin.value === "editorial")
let initialized = false

function applySkinAttribute() {
  if (typeof document === "undefined") return
  if (skin.value === "editorial") {
    document.documentElement.setAttribute("data-skin", "editorial")
  } else {
    document.documentElement.removeAttribute("data-skin")
  }
}

function persistSkin(next: SkinPreference) {
  try {
    if (next === "classic") localStorage.removeItem(SKIN_KEY)
    else localStorage.setItem(SKIN_KEY, next)
  } catch {
    // Keep in-memory toggle usable when browser storage is unavailable.
  }
}

export function initSkin() {
  if (!initialized) {
    initialized = true
    const fromQuery = readSkinFromQuery()
    if (fromQuery) {
      skin.value = fromQuery
      persistSkin(fromQuery)
    } else {
      skin.value = readStoredSkin()
    }
  }
  applySkinAttribute()
}

function setSkin(next: SkinPreference) {
  const normalized = normalizeSkin(next) ?? "classic"
  skin.value = normalized
  applySkinAttribute()
  persistSkin(normalized)
}

function syncSkinFromQueryParam(queryValue: unknown) {
  const normalized = normalizeSkin(Array.isArray(queryValue) ? queryValue[0] : queryValue)
  if (normalized && normalized !== skin.value) {
    setSkin(normalized)
  }
}

function toggleSkin() {
  setSkin(skin.value === "editorial" ? "classic" : "editorial")
}

function resolveThemeOverrides(baseOverrides: GlobalThemeOverrides, isDark: boolean): GlobalThemeOverrides {
  if (skin.value !== "editorial") return baseOverrides
  return isDark ? editorialDarkThemeOverrides : editorialLightThemeOverrides
}

export function useSkin() {
  initSkin()
  return {
    skin: readonly(skin),
    isEditorial,
    setSkin,
    toggleSkin,
    syncSkinFromQueryParam,
    resolveThemeOverrides,
  }
}
