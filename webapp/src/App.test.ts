import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "@/App.vue"

vi.mock("naive-ui", () => ({
  NConfigProvider: { template: "<div><slot /></div>" },
  NMessageProvider: { template: "<div><slot /></div>" },
}))

vi.mock("@/stores/account", () => ({
  useAccountStore: () => ({
    load: vi.fn(),
    currentOwner: null,
    currentOwnerId: "default",
  }),
}))

const appConfigFixture = vi.hoisted(() => ({
  config: {
    maintenanceEnabled: false,
    scanTelemetryEnabled: false,
    scanTelemetryRetentionDays: 30,
    driveDiscReservationsUiEnabled: false,
  },
}))

vi.mock("@/stores/app-config", () => ({
  useAppConfigStore: () => appConfigFixture,
}))

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        RouterView: { template: "<div />" },
      },
    },
  })
}

beforeEach(() => {
  appConfigFixture.config.maintenanceEnabled = false
})

describe("App maintenance navigation", () => {
  it("hides maintenance when the API disables it", async () => {
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("账号 / default"))
    expect(wrapper.text()).not.toContain("维护")
  })

  it("shows maintenance when the preloaded runtime config enables it", async () => {
    appConfigFixture.config.maintenanceEnabled = true
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("维护"))
  })
})

describe("App filing information", () => {
  it("links the ICP filing number to the MIIT filing system", () => {
    const wrapper = mountApp()
    const filingLink = wrapper.get('a[href="https://beian.miit.gov.cn/"]')

    expect(filingLink.text()).toBe("浙ICP备2026054969号-1")
    expect(filingLink.attributes("target")).toBe("_blank")
    expect(filingLink.attributes("rel")).toBe("noopener noreferrer")
  })
})
