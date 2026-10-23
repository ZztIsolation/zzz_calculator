import { defineComponent, h, nextTick, ref, watch } from "vue"
import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LAZY_DIALOG_LOAD_ERROR, prefetchWhenIdle, useLazyDialog } from "./useLazyDialog"

// 模拟真实弹窗：只在 show 从 false 变为 true 时初始化草稿（watch 不带 immediate）
const FakeDialog = defineComponent({
  props: { show: { type: Boolean, default: false } },
  setup(props) {
    const draft = ref("")
    watch(() => props.show, value => {
      if (value) draft.value = "initialized"
    })
    return () => h("div", { "data-show": String(props.show) }, draft.value)
  },
})

describe("useLazyDialog", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("mounts the dialog closed first so its open watcher initializes the draft", async () => {
    const loader = vi.fn(async () => ({ default: FakeDialog }))
    const show = ref(false)
    const dialog = useLazyDialog(loader)
    const Host = defineComponent({
      setup() {
        return () => dialog.component.value ? h(dialog.component.value, { show: show.value }) : null
      },
    })
    const wrapper = mount(Host)
    expect(wrapper.html()).not.toContain("data-show")

    await dialog.open(show)
    await nextTick()

    expect(show.value).toBe(true)
    expect(wrapper.text()).toBe("initialized")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("loads only once and retries after a failed download", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ default: FakeDialog })
    const dialog = useLazyDialog(loader)

    await expect(dialog.load()).rejects.toThrow(LAZY_DIALOG_LOAD_ERROR)
    expect(dialog.component.value).toBeNull()

    await Promise.all([dialog.load(), dialog.load()])
    expect(dialog.component.value).toBe(FakeDialog)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("prefetches when the browser is idle and swallows failures", async () => {
    vi.useFakeTimers()
    const ok = vi.fn(async () => {})
    const failing = vi.fn(async () => { throw new Error("offline") })
    prefetchWhenIdle([ok, failing], 500)
    expect(ok).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(ok).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(1)
  })

  it("cancels a pending prefetch", async () => {
    vi.useFakeTimers()
    const task = vi.fn(async () => {})
    const cancel = prefetchWhenIdle([task], 500)
    cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(task).not.toHaveBeenCalled()
  })
})
