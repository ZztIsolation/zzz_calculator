import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
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

function response(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response
}

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("App maintenance navigation", () => {
  it("hides maintenance when the API disables it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ maintenanceEnabled: false })))
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("账号 / default"))
    expect(wrapper.text()).not.toContain("维护")
  })

  it("shows maintenance when the static fallback enables it", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (
      url === "/api/app-config"
        ? response({}, 404)
        : response({ maintenanceEnabled: true })
    )))
    const wrapper = mountApp()
    await vi.waitFor(() => expect(wrapper.text()).toContain("维护"))
  })
})

describe("App filing information", () => {
  it("links the ICP filing number to the MIIT filing system", () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ maintenanceEnabled: false })))
    const wrapper = mountApp()
    const filingLink = wrapper.get('a[href="https://beian.miit.gov.cn/"]')

    expect(filingLink.text()).toBe("浙ICP备2026054969号-1")
    expect(filingLink.attributes("target")).toBe("_blank")
    expect(filingLink.attributes("rel")).toBe("noopener noreferrer")
  })
})
