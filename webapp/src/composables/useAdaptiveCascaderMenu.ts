import { computed, onBeforeUnmount, onMounted, ref, useId, type Ref } from "vue"

export type AdaptiveCascaderMenuOptions = {
  optionHeight?: number
  optionFontSize?: number
  preferredHeight?: number
  minRows?: number
  viewportGutter?: number
}

const DEFAULT_OPTIONS: Required<AdaptiveCascaderMenuOptions> = {
  optionHeight: 36,
  optionFontSize: 14,
  preferredHeight: 288,
  minRows: 2,
  viewportGutter: 8,
}

export function adaptiveCascaderMenuHeight(
  viewportHeight: number | null,
  options: AdaptiveCascaderMenuOptions = {},
  availableHeight?: number,
) {
  const resolved = { ...DEFAULT_OPTIONS, ...options }
  const minimumHeight = resolved.optionHeight * resolved.minRows
  if (availableHeight !== undefined && Number.isFinite(availableHeight)) {
    // A minimum row count must never force the popup outside the visible area.
    return `${Math.max(0, Math.floor(Math.min(resolved.preferredHeight, availableHeight)))}px`
  }
  if (!Number.isFinite(viewportHeight) || Number(viewportHeight) <= 0) {
    return `min(${resolved.preferredHeight}px, calc(50dvh - ${resolved.viewportGutter}px))`
  }

  const viewportLimit = Math.floor(Number(viewportHeight) / 2 - resolved.viewportGutter)
  return `${Math.min(resolved.preferredHeight, Math.max(minimumHeight, viewportLimit))}px`
}

export function useAdaptiveCascaderMenu(options: AdaptiveCascaderMenuOptions = {}, anchor?: Ref<HTMLElement | null>) {
  const resolved = { ...DEFAULT_OPTIONS, ...options }
  const viewportHeight = ref<number | null>(null)
  const availableHeight = ref<number>()
  const placement = ref<"top-start" | "bottom-start">("bottom-start")
  const menuId = `adaptive-cascader-${useId()}`
  let observedMenu: HTMLElement | null = null
  let visualViewport: VisualViewport | null = null
  let observer: ResizeObserver | undefined
  let frame: number | undefined
  let open = false

  function updateViewportHeight() {
    const height = visualViewport?.height || window.innerHeight
    viewportHeight.value = Number.isFinite(height) && height > 0 ? height : null
    const rect = anchor?.value?.getBoundingClientRect()
    if (!rect?.height) return
    const top = visualViewport?.offsetTop ?? 0
    // Include Naive UI's 4px popup margin on both edges of its follower box.
    const above = Math.max(0, rect.top - top - resolved.viewportGutter - 8)
    const below = Math.max(0, top + height - rect.bottom - resolved.viewportGutter - 8)
    const useBottom = below >= resolved.preferredHeight || below >= above
    placement.value = useBottom ? "bottom-start" : "top-start"
    availableHeight.value = useBottom ? below : above
    const menu = document.getElementById(menuId)
    if (menu !== observedMenu) {
      if (observedMenu) observer?.unobserve(observedMenu)
      observedMenu = menu
      if (menu) observer?.observe(menu)
    }
    const follower = menu?.parentElement
    if (menu && follower?.classList.contains("v-binder-follower-content")) {
      // Naive UI flips the popup, but does not shift a wide menu at a narrow
      // screen edge. Correct only that remaining horizontal overflow.
      const left = menu.getBoundingClientRect().left - (Number.parseFloat(follower.style.marginLeft) || 0)
      const minLeft = (visualViewport?.offsetLeft ?? 0) + resolved.viewportGutter
      const maxLeft = minLeft + (visualViewport?.width ?? window.innerWidth) - 2 * resolved.viewportGutter - menu.offsetWidth
      // Move the follower box as well: shifting only its child leaves an empty
      // overflowing box which still creates document-level horizontal scrolling.
      follower.style.marginLeft = `${Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft)) - left}px`
    }
  }

  function scheduleMeasure() {
    if (!open || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      updateViewportHeight()
    })
  }

  function updateShow(show: boolean) {
    open = show
    if (show) {
      updateViewportHeight()
      scheduleMeasure()
    }
  }

  onMounted(() => {
    visualViewport = window.visualViewport ?? null
    updateViewportHeight()
    window.addEventListener("resize", scheduleMeasure)
    window.addEventListener("scroll", scheduleMeasure, true)
    visualViewport?.addEventListener("resize", scheduleMeasure)
    visualViewport?.addEventListener("scroll", scheduleMeasure)
    if (anchor?.value && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleMeasure)
      observer.observe(anchor.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener("resize", scheduleMeasure)
    window.removeEventListener("scroll", scheduleMeasure, true)
    visualViewport?.removeEventListener("resize", scheduleMeasure)
    visualViewport?.removeEventListener("scroll", scheduleMeasure)
    observer?.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    visualViewport = null
  })

  return {
    to: "body" as const,
    placement,
    updateShow,
    menuProps: computed(() => ({
      id: menuId,
      onTransitionend: scheduleMeasure,
    })),
    themeOverrides: computed(() => ({
      optionHeight: `${resolved.optionHeight}px`,
      optionFontSize: `${resolved.optionFontSize}px`,
      menuHeight: adaptiveCascaderMenuHeight(viewportHeight.value, resolved, availableHeight.value),
    })),
    scrollbarProps: {
      trigger: "none" as const,
      themeOverrides: {
        width: "10px",
        height: "10px",
        borderRadius: "6px",
        color: "rgba(51, 65, 85, 0.72)",
        colorHover: "rgba(15, 23, 42, 0.9)",
        railColor: "rgba(148, 163, 184, 0.35)",
      },
    },
  }
}
