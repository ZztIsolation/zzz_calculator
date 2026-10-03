import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import ScannerErrorState from "@/components/ScannerErrorState.vue"
import { normalizeScannerFailure } from "@runtime/scanner-errors"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["type", "size", "disabled"],
    emits: ["click"],
    template: "<button :data-type=\"type\" :data-size=\"size\" :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
}))

afterEach(() => { document.body.innerHTML = "" })

vi.mock("lucide-vue-next", () => ({
  AlertCircle: { template: "<i data-lucide=\"alert-circle\" />" },
  Cable: { template: "<i data-lucide=\"cable\" />" },
  Download: { template: "<i data-lucide=\"download\" />" },
  Gamepad2: { template: "<i data-lucide=\"gamepad2\" />" },
  RefreshCcw: { template: "<i data-lucide=\"refresh-ccw\" />" },
  ShieldAlert: { template: "<i data-lucide=\"shield-alert\" />" },
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
    expect(wrapper.text()).toContain("下载并更新 Helper")
    expect(wrapper.text()).toContain("重新检测")
  })

  it("renders a dedicated browser permission recovery instead of a Helper download", () => {
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "browser-permission" },
    })

    expect(wrapper.text()).toContain("浏览器已阻止连接本机扫描助手")
    expect(wrapper.text()).toContain("本机应用或本地网络访问")
    expect(wrapper.text()).not.toContain("下载扫描助手")
    expect(wrapper.findAll("button")).toHaveLength(1)
    expect(wrapper.find("button").text()).toContain("我已允许，重新连接")
  })

  it("renders separate Helper-origin and WebSocket failures", () => {
    const rejected = mount(ScannerErrorState, { props: { variant: "helper-rejected" } })
    expect(rejected.text()).toContain("扫描助手拒绝了当前网页")
    expect(rejected.text()).toContain("下载最新版 Helper")

    const blocked = mount(ScannerErrorState, {
      props: { variant: "browser-websocket", message: "WebSocket 被浏览器策略阻止" },
    })
    expect(blocked.text()).toContain("浏览器未能建立扫描连接")
    expect(blocked.text()).toContain("WebSocket 被浏览器策略阻止")
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

  it("renders structured diagnostics and emits declared actions", async () => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "diagnostic-failure",
        failure: {
          code: "disk_insufficient",
          severity: "error",
          title: "磁盘空间不足",
          message: "至少需要 300 MB，当前只有 100 MB。",
          remedy: "请释放系统盘空间后重试。",
          diagnosticId: "abc123",
          actions: [
            { kind: "retry", label: "重试" },
            { kind: "open_logs", label: "打开日志目录" },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain("磁盘空间不足")
    expect(wrapper.text()).toContain("错误代码：disk_insufficient")
    expect(wrapper.text()).toContain("原因：")
    expect(wrapper.text()).toContain("解决方案：")
    expect(wrapper.text()).toContain("请释放系统盘空间")
    expect(wrapper.text()).toContain("abc123")
    const buttons = wrapper.findAll("button")
    expect(buttons).toHaveLength(2)
    await buttons[1]!.trigger("click")
    expect(wrapper.emitted("action")?.[0]).toEqual(["open_logs"])
  })

  it("shows a compact cancellation status with collapsed diagnostics and no startup buttons", async () => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "diagnostic-failure", presentation: "startup-recovery",
        failure: normalizeScannerFailure({
          code: "uac_cancelled", message: "The operation was canceled by the user.", diagnosticId: "cancel-1",
          actions: [{ kind: "restart_elevated", label: "以管理员权限重启" }],
        }),
      },
    })
    expect(wrapper.attributes("role")).toBe("status")
    expect(wrapper.classes()).toContain("tone-warning")
    expect(wrapper.find("h3").text()).toBe("已取消管理员启动")
    expect(wrapper.find(".scanner-startup-message").text()).toBe("你取消了 Windows 授权，扫描尚未开始，设置已保留。")
    expect(wrapper.find(".scanner-error-state").exists()).toBe(false)
    expect(wrapper.find(".scanner-startup-reason").exists()).toBe(false)
    expect(wrapper.find("details").element.open).toBe(false)
    expect(wrapper.find("summary").text()).toBe("查看详情")
    expect(wrapper.find("summary").attributes("aria-expanded")).toBe("false")
    const buttons = wrapper.findAll("button")
    expect(buttons.map(button => button.text())).toEqual(["复制问题信息", "打开日志"])
    expect(buttons.every(button => button.attributes("data-type") === "default")).toBe(true)

    wrapper.find("details").element.open = true
    await wrapper.find("details").trigger("toggle")
    expect(wrapper.find("summary").attributes("aria-expanded")).toBe("true")
    expect(wrapper.find(".scanner-startup-details-content").text()).toContain("cancel-1")
    expect(wrapper.find("pre").text()).toContain("The operation was canceled by the user.")
    await buttons[0]!.trigger("click")
    await buttons[1]!.trigger("click")
    expect(wrapper.emitted("action")).toEqual([["copy_diagnostics"], ["open_logs"]])
  })

  it.each(["拒绝访问。", "Access is denied."])("shows the original system reason separately for a process launch failure: %s", reason => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "diagnostic-failure", presentation: "startup-recovery",
        failure: normalizeScannerFailure({ code: "child_start_failed", message: reason, remedy: "重新下载并修复" }),
      },
    })
    expect(wrapper.attributes("role")).toBe("alert")
    expect(wrapper.classes()).toContain("tone-error")
    expect(wrapper.find("h3").text()).toBe("扫描器启动失败")
    expect(wrapper.find(".scanner-startup-message").text()).toBe("扫描器未能启动，设置已保留。")
    expect(wrapper.find(".scanner-startup-reason").text()).toBe(`系统返回：${reason}`)
    expect(wrapper.find(".scanner-error-remedy").exists()).toBe(false)
    expect(wrapper.find("details").element.open).toBe(false)
    expect(wrapper.find("pre").text()).toContain("重新下载并修复")
  })

  it("shows a neutral fallback when Windows did not return a specific reason", () => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "diagnostic-failure", presentation: "startup-recovery",
        failure: normalizeScannerFailure({ code: "child_start_failed" }),
      },
    })
    expect(wrapper.find(".scanner-startup-reason").text()).toBe("未返回具体原因")
  })

  it("collapses diagnostics for a new failure object even with the same code and diagnostic ID", async () => {
    const failure = normalizeScannerFailure({ code: "child_start_failed", message: "拒绝访问", diagnosticId: "same-id" })
    const wrapper = mount(ScannerErrorState, {
      props: { variant: "diagnostic-failure", presentation: "startup-recovery", failure },
    })
    wrapper.find("details").element.open = true
    await wrapper.find("details").trigger("toggle")
    await wrapper.setProps({ failure: { ...failure } })
    expect(wrapper.find("details").element.open).toBe(false)
    expect(wrapper.find("summary").attributes("aria-expanded")).toBe("false")
  })

  it("keeps native keyboard disclosure available and blocks diagnostics while busy", async () => {
    const wrapper = mount(ScannerErrorState, {
      attachTo: document.body,
      props: {
        variant: "diagnostic-failure", presentation: "startup-recovery",
        failure: normalizeScannerFailure({ code: "uac_cancelled" }),
      },
    })
    const summary = wrapper.find("summary")
    summary.element.focus()
    expect(document.activeElement).toBe(summary.element)
    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      summary.element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    wrapper.find("details").element.open = true
    await wrapper.find("details").trigger("toggle")
    await wrapper.setProps({ busy: true })
    expect(wrapper.find("details").element.open).toBe(false)
    expect(summary.attributes("aria-disabled")).toBe("true")
    expect(summary.attributes("tabindex")).toBe("-1")
    expect(wrapper.findAll("button").every(button => button.element.disabled)).toBe(true)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true })
    summary.element.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    await wrapper.find("button").trigger("click")
    expect(wrapper.emitted("action")).toBeUndefined()
    await wrapper.setProps({ busy: false })
    expect(summary.attributes("tabindex")).toBe("0")
    expect(wrapper.find("details").element.open).toBe(false)
    wrapper.unmount()
  })

  it("keeps the default presentation for other errors even when compact presentation is requested", () => {
    const wrapper = mount(ScannerErrorState, {
      props: {
        variant: "diagnostic-failure", presentation: "startup-recovery",
        failure: normalizeScannerFailure({ code: "package_corrupt" }),
      },
    })
    expect(wrapper.find(".scanner-error-state").exists()).toBe(true)
    expect(wrapper.find("details").exists()).toBe(false)
    expect(wrapper.find("button").attributes("data-type")).toBe("primary")
    expect(wrapper.find("button").text()).toBe("重新下载并修复")
  })
})
