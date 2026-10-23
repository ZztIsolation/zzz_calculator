import { nextTick, shallowRef, type Component, type Ref } from "vue"

export const LAZY_DIALOG_LOAD_ERROR = "弹窗加载失败，请检查网络后重试。"

/**
 * 按需加载的弹窗：弹窗代码不进入页面首屏，第一次打开前（或浏览器空闲预取时）才下载。
 * 组件先以关闭状态挂载、再打开，弹窗内“打开时初始化草稿”的 watch 才能照常触发。
 */
export function useLazyDialog(loader: () => Promise<{ default: Component }>) {
  const component = shallowRef<Component | null>(null)
  let loading: Promise<void> | null = null

  function load() {
    loading ??= loader().then(
      module => {
        component.value = module.default
      },
      () => {
        loading = null
        throw new Error(LAZY_DIALOG_LOAD_ERROR)
      },
    )
    return loading
  }

  async function open(show: Ref<boolean>) {
    await load()
    // 等加载好的弹窗以关闭状态完成挂载
    await nextTick()
    show.value = true
  }

  return { component, load, open }
}

/** 浏览器空闲时预取，第一次点开弹窗不必再等下载；失败不打扰用户，打开时会重试。 */
export function prefetchWhenIdle(tasks: Array<() => Promise<unknown>>, timeout = 3000) {
  const run = () => {
    for (const task of tasks) void task().catch(() => {})
  }
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback
  if (typeof idle === "function") {
    const handle = idle(run, { timeout })
    return () => (globalThis as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(handle)
  }
  const handle = setTimeout(run, timeout)
  return () => clearTimeout(handle)
}
