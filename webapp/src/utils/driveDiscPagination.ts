import { computed, isRef, ref, watch, type ComputedRef, type Ref } from "vue"

export function useDriveDiscPagination(items: ComputedRef<any[]>, pageSize: number | Ref<number> = 10) {
  const page = ref(1)
  const size = isRef(pageSize) ? pageSize : ref(pageSize)
  // Filtering still runs on the full inventory. Only the rendered slice changes.
  watch(items, () => { page.value = 1 }, { flush: "sync" })
  // 改每页数量后回到第一页，避免停在已不存在的页码
  watch(size, () => { page.value = 1 }, { flush: "sync" })
  const pagedItems = computed(() => items.value.slice((page.value - 1) * size.value, page.value * size.value))
  return { page, pageSize: size, pagedItems }
}

// 默认每页 5 个：低配电脑一次渲染的驱动盘卡片少，切页和滚动更轻
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const

/** 记住用户选择的每页数量；读写失败时退回默认值，不影响分页本身 */
export function usePersistedPageSize(storageKey: string, fallback: number = PAGE_SIZE_OPTIONS[0]) {
  let initial = fallback
  try {
    const saved = Number(localStorage.getItem(storageKey))
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(saved)) initial = saved
  } catch {
    // 读不到就用默认值
  }
  const size = ref(initial)
  watch(size, value => {
    try { localStorage.setItem(storageKey, String(value)) } catch { /* 存不下就只在本次会话生效 */ }
  })
  return { pageSize: size, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }
}
