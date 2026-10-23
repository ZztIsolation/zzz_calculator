import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "@/App.vue"
import { useTheme } from "@/runtime/theme"
import { storageIssues } from "@runtime/storage-guard.js"

vi.mock("naive-ui", () => ({
  NAlert: { props: ["title"], template: '<div role="alert"><span>{{ title }}</span><slot /></div>' },
  NButton: { emits: ["click"], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  NConfigProvider: { template: "<div><slot /></div>" },
  NMessageProvider: { template: "<div><slot /></div>" },
  darkTheme: { name: "dark" },
}))

const routeFixture = vi.hoisted(() => ({ path: "/", query: {} as Record<string, string> }))
const routerFixture = vi.hoisted(() => ({
  guards: [] as Array<(to: { path: string }) => unknown>,
  beforeEach: vi.fn(),
}))
const accountFixture = vi.hoisted(() => ({
  currentOwnerLabel: "myself" as string | null,
  currentOwnerId: "internal-owner-id",
  loadState: "ready" as "idle" | "loading" | "ready" | "error",
  error: "",
}))

vi.mock("vue-router", () => ({
  useRoute: () => routeFixture,
  useRouter: () => routerFixture,
}))

vi.mock("@/stores/account", () => ({
  useAccountStore: () => accountFixture,
}))

const appConfigFixture = vi.hoisted(() => ({
  config: {
    maintenanceEnabled: false,
    scanTelemetryEnabled: false,
    scanTelemetryRetentionDays: 30,
    enkaImportEnabled: false,
    driveDiscReservationsUiEnabled: false,
    driveDiscExclusionsUiEnabled: false,
  },
}))

vi.mock("@/stores/app-config", () => ({
  useAppConfigStore: () => appConfigFixture,
}))

function mountApp(props: Record<string, unknown> = {}) {
  return mount(App, {
    props,
    global: {
      stubs: {
        RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
        RouterView: { template: '<div data-testid="router-view" />' },
      },
    },
  })
}

beforeEach(() => {
  appConfigFixture.config.maintenanceEnabled = false
  appConfigFixture.config.enkaImportEnabled = false
  routeFixture.path = "/"
  routeFixture.query = {}
  accountFixture.currentOwnerLabel = "myself"
  accountFixture.currentOwnerId = "internal-owner-id"
  accountFixture.loadState = "ready"
  accountFixture.error = ""
  storageIssues.value = []
  useTheme().setPreference("system")
  routerFixture.guards = []
  routerFixture.beforeEach.mockReset()
  routerFixture.beforeEach.mockImplementation((guard: (to: { path: string }) => unknown) => {
    routerFixture.guards.push(guard)
    return () => {}
  })
})

describe("App maintenance navigation", () => {
  it("hides maintenance when the API disables it", async () => {
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("账号 / myself"))
    expect(wrapper.text()).not.toContain("internal-owner-id")
    expect(wrapper.text()).not.toContain("维护")
  })

  it("does not expose the raw owner id when account loading fails", () => {
    accountFixture.currentOwnerLabel = null
    accountFixture.loadState = "error"
    accountFixture.error = "IndexedDB unavailable"
    const wrapper = mountApp()

    expect(wrapper.text()).toContain("账号加载失败")
    expect(wrapper.text()).not.toContain("internal-owner-id")
  })

  it("shows maintenance when the preloaded runtime config enables it", async () => {
    appConfigFixture.config.maintenanceEnabled = true
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("维护"))
  })

  it("shows the showcase navigation only when the runtime config enables it", async () => {
    appConfigFixture.config.enkaImportEnabled = true
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("展柜"))
    expect(wrapper.text()).not.toContain("导入")
  })

  it("shows a notice after a disabled direct import route is redirected", () => {
    routeFixture.query = { notice: "enka-import-disabled" }
    const wrapper = mountApp()
    expect(wrapper.get('[role="alert"]').text()).toContain("展柜数据导入当前未启用")
  })

  it("surfaces a startup recovery failure", () => {
    const wrapper = mountApp({ startupError: "恢复失败" })
    expect(wrapper.get('[role="alert"]').text()).toContain("恢复失败")
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)
  })

  it("shows the raw-data export action when storage parsing fails", () => {
    storageIssues.value = [{ key: "zzz-calculator.webapp.build.v1", raw: "{broken" }]
    const wrapper = mountApp()

    expect(wrapper.text()).toContain("本地数据读取失败，原始内容已保留")
    expect(wrapper.get('[role="alert"] button').text()).toBe("导出原始内容")
  })

  it("does not show a raw-data export action for a transaction recovery failure", () => {
    const wrapper = mountApp({ startupError: "未完成的驱动盘导入自动恢复失败，请刷新页面后再修改配置：数据库锁定" })

    expect(wrapper.text()).toContain("请刷新页面后再修改配置")
    expect(wrapper.find('[role="alert"] button').exists()).toBe(false)
  })
})

describe("App filing information", () => {
  it("links the ICP filing number to the MIIT filing system", () => {
    const wrapper = mountApp()
    const footer = wrapper.get("footer.site-footer")
    const filingLink = footer.get('a[href="https://beian.miit.gov.cn/"]')

    expect(filingLink.text()).toBe("浙ICP备2026054969号-1")
    expect(filingLink.attributes("target")).toBe("_blank")
    expect(filingLink.attributes("rel")).toBe("noopener noreferrer")
  })
})

it("cycles the visible theme button and announces current and next modes", async () => {
  const wrapper = mountApp()
  const button = wrapper.get('[data-testid="theme-toggle"]')
  for (const [current, next] of [["跟随系统", "浅色"], ["浅色", "深色"], ["深色", "跟随系统"]]) {
    const label = `主题：${current}（点击切换为${next}）`
    expect(button.attributes("aria-label")).toBe(label)
    expect(button.attributes("title")).toBe(label)
    await button.trigger("click")
  }
  expect(localStorage.getItem("zzz-calculator.webapp.theme.v1")).toBe("system")
  wrapper.unmount()
})

describe("App navigation indicator", () => {
  it("slides from cached link boxes with a transform-only animation and settles to the real width", async () => {
    const boxes: Record<string, { left: number, width: number }> = { "/": { left: 3, width: 80 }, "/discs": { left: 85, width: 96 } }
    const left = vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) { return boxes[this.getAttribute("href") ?? ""]?.left ?? 0 })
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) { return boxes[this.getAttribute("href") ?? ""]?.width ?? 0 })
    try {
      const wrapper = mountApp()
      const indicator = wrapper.get(".nav-indicator")
      await vi.waitFor(() => expect(indicator.attributes("style")).toContain("translateX(3px) scaleX(1)"))

      // 切页时不再读取布局：此后的位置都来自缓存。
      left.mockClear()
      width.mockClear()
      await routerFixture.guards[0]!({ path: "/discs" })
      await wrapper.vm.$nextTick()
      expect(left).not.toHaveBeenCalled()
      expect(width).not.toHaveBeenCalled()
      expect(indicator.classes()).toContain("is-animated")
      expect(indicator.attributes("style")).toContain("width: 80px")
      expect(indicator.attributes("style")).toContain("translateX(85px) scaleX(1.2)")

      await indicator.trigger("transitionend")
      expect(indicator.attributes("style")).toContain("width: 96px")
      expect(indicator.attributes("style")).toContain("translateX(85px) scaleX(1)")
      expect(indicator.classes()).not.toContain("is-animated")
    } finally {
      left.mockRestore()
      width.mockRestore()
    }
  })

  it("does not delay navigation to routes without a nav link", async () => {
    mountApp()
    await vi.waitFor(() => expect(routerFixture.guards).toHaveLength(1))
    vi.useFakeTimers()
    try {
      let settled = false
      void Promise.resolve(routerFixture.guards[0]!({ path: "/internal/scans" })).then(() => { settled = true })
      await Promise.resolve()
      await Promise.resolve()
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
