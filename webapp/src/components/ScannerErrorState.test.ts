import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import ScannerErrorState from "@/components/ScannerErrorState.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["type", "size"],
    emits: ["click"],
    template: "<button :data-type=\"type\" :data-size=\"size\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
}))

vi.mock("lucide-vue-next", () => ({
  AlertCircle: { template: "<i data-lucide=\"alert-circle\" />" },
  Download: { template: "<i data-lucide=\"download\" />" },
  Gamepad2: { template: "<i data-lucide=\"gamepad2\" />" },
  RefreshCcw: { template: "<i data-lucide=\"refresh-ccw\" />" },
  WifiOff: { template: "<i data-lucide=\"wifi-off\" />" },
}))

describe("ScannerErrorState", () => {
  it("renders helper-missing preset with download + reconnect actions", async () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "helper-missing" },
    })

    expect(wrapper.text()).toContain("未检测到扫描助手")
    expect(wrapper.text()).toContain("浏览器已尝试自动唤起")
    const buttons = wrapper.findAll("button")
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.text()).toContain("下载扫描助手")
    expect(buttons[1]!.text()).toContain("我已运行")

    await buttons[0]!.trigger("click")
    await buttons[1]!.trigger("click")
    expect(wrapper.emitted("primary")).toHaveLength(1)
    expect(wrapper.emitted("secondary")).toHaveLength(1)
  })

  it("renders helper-outdated preset showing the detected helper version", () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "helper-outdated", helperVersion: "1.0.1" },
    })

    expect(wrapper.text()).toContain("扫描助手版本过低")
    expect(wrapper.text()).toContain("v1.0.1")
    expect(wrapper.text()).toContain("下载新版助手")
    expect(wrapper.text()).toContain("我已更新")
  })

  it("renders prepare-failed with a custom message and only a primary action", async () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "prepare-failed", message: "OCR 校验失败：checksum mismatch" },
    })

    expect(wrapper.text()).toContain("OCR 扫描器准备失败")
    expect(wrapper.text()).toContain("checksum mismatch")

    const buttons = wrapper.findAll("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.text()).toContain("重试")

    await buttons[0]!.trigger("click")
    expect(wrapper.emitted("primary")).toHaveLength(1)
    expect(wrapper.emitted("secondary")).toBeUndefined()
  })

  it("renders scan-failed with only a retry action", () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "scan-failed", message: "WebSocket disconnected" },
    })

    expect(wrapper.text()).toContain("扫描失败")
    expect(wrapper.text()).toContain("WebSocket disconnected")
    expect(wrapper.findAll("button")).toHaveLength(1)
    expect(wrapper.findAll("button")[0]!.text()).toContain("重新扫描")
  })

  it("renders game-not-found with a retry-connect action", () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "game-not-found" },
    })

    expect(wrapper.text()).toContain("未找到绝区零窗口")
    expect(wrapper.text()).toContain("云绝区零请在客户端选择器中切换")
    const buttons = wrapper.findAll("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.text()).toContain("重试连接")
  })

  it("honours primaryLabel/secondaryLabel overrides", () => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "helper-missing",
        primaryLabel: "自定义主按钮",
        secondaryLabel: "自定义副按钮",
      },
    })

    const buttons = wrapper.findAll("button")
    expect(buttons[0]!.text()).toBe("自定义主按钮")
    expect(buttons[1]!.text()).toBe("自定义副按钮")
  })
})
