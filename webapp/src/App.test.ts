import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "@/App.vue"

vi.mock("naive-ui", () => ({
  NAlert: { props: ["title"], template: '<div role="alert">{{ title }}</div>' },
  NConfigProvider: { template: "<div><slot /></div>" },
  NMessageProvider: { template: "<div><slot /></div>" },
}))

const routeFixture = vi.hoisted(() => ({ query: {} as Record<string, string> }))
const accountFixture = vi.hoisted(() => ({
  currentOwnerLabel: "myself" as string | null,
  currentOwnerId: "internal-owner-id",
  loadState: "ready" as "idle" | "loading" | "ready" | "error",
  error: "",
}))

vi.mock("vue-router", () => ({
  useRoute: () => routeFixture,
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
        RouterLink: { template: "<a><slot /></a>" },
        RouterView: { template: '<div data-testid="router-view" />' },
      },
    },
  })
}

beforeEach(() => {
  appConfigFixture.config.maintenanceEnabled = false
  appConfigFixture.config.enkaImportEnabled = false
  routeFixture.query = {}
  accountFixture.currentOwnerLabel = "myself"
  accountFixture.currentOwnerId = "internal-owner-id"
  accountFixture.loadState = "ready"
  accountFixture.error = ""
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

  it("shows Enka import only when the runtime config enables it", async () => {
    appConfigFixture.config.enkaImportEnabled = true
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("导入"))
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
