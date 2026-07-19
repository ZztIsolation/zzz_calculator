import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SettingsView from "@/views/SettingsView.vue"

const scanner = {
  mode: "helper",
  helperVersion: "1.2.1",
  protocolVersion: 3,
  onHelperUpdateProgress: null as any,
  connect: vi.fn(async () => ({ version: scanner.helperVersion, protocolVersion: scanner.protocolVersion })),
  getStorageInfo: vi.fn(async () => ({
    storage: {
      root: "C:\\Users\\test\\AppData\\Local\\ZZZScannerNext",
      totalBytes: 1024 * 1024 * 120,
      helperBytes: 8 * 1024 * 1024,
      runtimeBytes: 40 * 1024 * 1024,
      packageBytes: 60 * 1024 * 1024,
      outputBytes: 10 * 1024 * 1024,
      logBytes: 2 * 1024 * 1024,
      reclaimableBytes: 70 * 1024 * 1024,
    },
  })),
  cleanupStorage: vi.fn(async () => ({
    result: {
      reclaimedBytes: 70 * 1024 * 1024,
      errors: [],
      after: { totalBytes: 50 * 1024 * 1024, reclaimableBytes: 0 },
    },
  })),
  updateHelper: vi.fn(async () => ({ updateAvailable: false })),
  launchHelper: vi.fn(),
  disconnect: vi.fn(),
}

vi.mock("@/stores/inventory", () => ({
  REQUIRED_HELPER_VERSION: "1.2.1",
  helperVersionAtLeast: (actual = "", required = "1.2.1") => {
    const current = actual.split(".").map(Number)
    const target = required.split(".").map(Number)
    for (let index = 0; index < Math.max(current.length, target.length); index += 1) {
      if ((current[index] ?? 0) !== (target[index] ?? 0)) return (current[index] ?? 0) > (target[index] ?? 0)
    }
    return true
  },
  useInventoryStore: () => ({
    scanHelperDownloadUrl: "https://example.com/helper.exe",
    ensureScannerBridge: () => scanner,
  }),
}))

vi.mock("@runtime/local-store.js", () => ({ clearAllBrowserData: vi.fn() }))

const success = vi.fn()
vi.mock("naive-ui", () => ({
  NAlert: { template: "<div><slot /></div>" },
  NButton: { template: "<button :disabled='$attrs.disabled' @click='$emit(\"click\")'><slot name='icon' /><slot /></button>" },
  NProgress: { template: "<div />" },
  NTag: { template: "<span><slot /></span>" },
  NModal: { template: "<div v-if='$attrs.show'><slot /><slot name='action' /></div>" },
  useMessage: () => ({ success, warning: vi.fn(), error: vi.fn() }),
}))

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scanner.helperVersion = "1.2.1"
    scanner.protocolVersion = 3
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn(async () => ({ usage: 5 * 1024 * 1024 })) },
    })
  })

  it("keeps browser and scanner cleanup separate and reports reclaimable storage", async () => {
    const wrapper = mount(SettingsView)
    await vi.waitFor(() => expect(wrapper.text()).toContain("Helper 1.2.1"))
    expect(wrapper.text()).toContain("网页数据")
    expect(wrapper.text()).toContain("扫描器存储")
    expect(wrapper.text()).toContain("70.00 MiB")

    const cleanup = wrapper.findAll("button").find(button => button.text().includes("释放扫描器空间"))
    expect(cleanup).toBeTruthy()
    await cleanup!.trigger("click")
    await wrapper.vm.$nextTick()
    const confirm = wrapper.findAll("button").find(button => button.text().includes("开始清理"))
    expect(confirm).toBeTruthy()
    await confirm!.trigger("click")
    await vi.waitFor(() => expect(scanner.cleanupStorage).toHaveBeenCalled())
    expect(success).toHaveBeenCalledWith("已释放 70.00 MiB。")
  })

  it("offers the takeover installer instead of unsupported commands for Helper 1.1", async () => {
    scanner.helperVersion = "1.1.0"
    scanner.protocolVersion = 2

    const wrapper = mount(SettingsView)
    await vi.waitFor(() => expect(wrapper.text()).toContain("Helper 1.1.0"))

    expect(wrapper.text()).toContain("需要更新到 1.2.1")
    expect(wrapper.text()).toContain("下载并更新 Helper")
    expect(scanner.getStorageInfo).not.toHaveBeenCalled()
    expect(scanner.updateHelper).not.toHaveBeenCalled()
  })
})
