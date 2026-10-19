import { computed, ref, watch, type ComputedRef } from "vue"

export function useDriveDiscPagination(items: ComputedRef<any[]>, pageSize = 10) {
  const page = ref(1)
  // Filtering still runs on the full inventory. Only the rendered slice changes.
  watch(items, () => { page.value = 1 }, { flush: "sync" })
  const pagedItems = computed(() => items.value.slice((page.value - 1) * pageSize, page.value * pageSize))
  return { page, pageSize, pagedItems }
}
