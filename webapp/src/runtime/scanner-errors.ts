export type ScannerFailurePhase = "connect" | "helper" | "prepare" | "scan" | "import"
export type ScannerFailureSeverity = "error" | "warning"

export type ScannerFailureAction = {
  kind: string
  label: string
}

export type ScannerFailure = {
  code: string
  phase: ScannerFailurePhase
  severity: ScannerFailureSeverity
  title: string
  message: string
  remedy: string
  retryable: boolean
  actions: ScannerFailureAction[]
  diagnosticId: string
  details: Record<string, unknown>
}

type FailureCatalogEntry = Omit<ScannerFailure, "code" | "diagnosticId" | "details">

const retryConnect = [{ kind: "retry_connect", label: "重新连接" }]
const retryPrepare = [
  { kind: "retry", label: "重试" },
  { kind: "open_logs", label: "打开日志" },
]
const retryScan = [
  { kind: "retry_scan", label: "重新扫描" },
  { kind: "open_logs", label: "打开日志" },
]

function failure(
  phase: ScannerFailurePhase,
  title: string,
  message: string,
  remedy: string,
  actions: ScannerFailureAction[],
  options: { retryable?: boolean; severity?: ScannerFailureSeverity } = {},
): FailureCatalogEntry {
  return {
    phase,
    severity: options.severity ?? "error",
    title,
    message,
    remedy,
    retryable: options.retryable !== false,
    actions,
  }
}

export const SCANNER_ERROR_CATALOG: Record<string, FailureCatalogEntry> = {
  unknown_error: failure("scan", "扫描器发生未知错误", "扫描器返回了无法识别的错误。", "请重试；如果问题持续，请复制诊断信息并联系维护人员。", retryScan),
  connect_failed: failure("connect", "无法连接扫描助手", "网页未能连接本机扫描助手。", "请确认 Helper 已运行，并检查浏览器、本地网络权限和安全软件设置。", retryConnect),
  loopback_permission_denied: failure("connect", "浏览器已阻止连接本机扫描助手", "当前网站没有访问本机扫描助手的权限。", "请在地址栏左侧的网站设置中允许“本地网络”或“本机应用”访问，然后重新连接。", [{ kind: "retry_connect", label: "我已允许，重新连接" }]),
  helper_unreachable: failure("connect", "未检测到扫描助手", "网页无法访问本机扫描助手。", "请运行或重新下载 Helper；同时检查 Windows SmartScreen、安全软件和企业策略。", [
    { kind: "download_helper", label: "下载扫描助手" },
    { kind: "retry_connect", label: "我已运行，重新连接" },
  ]),
  helper_launch_timeout: failure("connect", "扫描助手启动超时", "网页发出启动请求后 60 秒内仍未检测到 Helper。", "请检查 Helper 是否被下载拦截、SmartScreen 或安全软件阻止；手动运行后再重新连接。", [
    { kind: "download_helper", label: "下载扫描助手" },
    { kind: "retry_connect", label: "重新检测" },
  ]),
  helper_origin_rejected: failure("connect", "扫描助手拒绝了当前网页", "当前 Helper 不允许此网页建立扫描连接。", "请安装最新版 Helper；若仍失败，请确认访问的是正式网站或受支持的本地地址。", [
    { kind: "download_helper", label: "下载最新版 Helper" },
    { kind: "retry_connect", label: "重新检测" },
  ]),
  helper_websocket_blocked: failure("connect", "浏览器未能建立扫描连接", "Helper 已响应，但 WebSocket 连接失败。", "请暂时停用拦截本机连接的浏览器扩展，并检查安全软件或企业浏览器策略。", retryConnect),
  helper_connection_timeout: failure("connect", "连接扫描助手超时", "Helper 已响应，但没有在规定时间内完成连接。", "请重启 Helper 和浏览器后重试；如果持续发生，请打开日志。", retryConnect),
  helper_disconnected: failure("helper", "扫描助手连接已断开", "网页与 Helper 的连接意外中断。", "请确认 Helper 仍在运行，然后重新连接。", retryConnect),
  helper_outdated: failure("helper", "扫描助手版本过低", "当前 Helper 不支持完整的扫描错误诊断协议。", "请下载并运行最新版 Helper，网页会在升级后重新连接。", [
    { kind: "update_helper", label: "更新 Helper" },
    { kind: "download_helper", label: "手动下载" },
  ]),
  helper_update_failed: failure("helper", "扫描助手更新失败", "Helper 未能完成自动更新。", "请检查网络后重试；仍然失败时请手动下载最新版 Helper。", [
    { kind: "update_helper", label: "重试自动更新" },
    { kind: "download_helper", label: "手动下载" },
  ]),
  protocol_registration_failed: failure("helper", "无法注册自动启动协议", "Windows 不允许 Helper 注册网页自动启动协议。", "可以手动运行 Helper；如需自动唤起，请检查当前用户的注册表策略。", retryConnect),
  unsupported_os: failure("prepare", "Windows 版本不受支持", "当前 Windows 版本低于扫描器要求。", "请升级到 Windows 10 1809 或更高版本。", [{ kind: "open_logs", label: "打开日志" }], { retryable: false }),
  unsupported_arch: failure("prepare", "系统架构不受支持", "当前系统不是受支持的 Windows x64。", "请在 x64 Windows 10 或 Windows 11 上使用扫描器。", [{ kind: "open_logs", label: "打开日志" }], { retryable: false }),
  cache_unwritable: failure("prepare", "无法写入扫描器目录", "Helper 无法写入扫描器缓存或运行目录。", "请检查目录权限、安全软件和受控文件夹访问设置。", [
    { kind: "retry", label: "重试" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  disk_insufficient: failure("prepare", "磁盘空间不足", "系统盘可用空间不足，无法准备扫描器。", "请释放系统盘空间后重试。", retryPrepare),
  manifest_unreachable: failure("prepare", "无法获取扫描器版本信息", "Helper 无法下载扫描器版本清单。", "请检查网络、代理或防火墙后重试。", retryPrepare),
  manifest_invalid: failure("prepare", "扫描器版本信息无效", "下载到的扫描器清单格式或签名不符合要求。", "请更新 Helper；如果问题持续，请打开日志。", retryPrepare),
  download_failed: failure("prepare", "扫描器下载失败", "所有扫描器下载地址均不可用。", "请检查网络后重试，Helper 会再次尝试备用地址。", retryPrepare),
  package_corrupt: failure("prepare", "扫描器安装包校验失败", "扫描器文件大小、哈希或内容校验不通过。", "请选择重新下载并修复，Helper 会清除损坏缓存。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  install_access_denied: failure("prepare", "没有权限安装扫描器", "Windows 或安全软件拒绝写入扫描器运行目录。", "请检查安全软件和受控文件夹访问设置，然后重新修复。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  install_failed: failure("prepare", "扫描器安装失败", "Helper 无法完成扫描器解压或安装。", "请选择重新下载并修复；仍然失败时请打开日志。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  native_dependency_missing: failure("prepare", "扫描器缺少运行组件", "扫描器启动时找不到所需的原生组件。", "请选择重新下载并修复，所需组件应包含在扫描器包中。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  child_start_failed: failure("prepare", "无法启动 OCR 扫描器", "Helper 无法创建 Scanner 子进程。", "请选择重新下载并修复；仍然失败时请打开日志。", retryPrepare),
  child_exited: failure("prepare", "扫描器启动后立即退出", "Scanner 尚未连接就已退出。", "请选择重新下载并修复，并提供诊断编号。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  child_handshake_timeout: failure("prepare", "扫描器启动超时", "Scanner 已启动，但没有完成本地连接。", "请重试；如果持续发生，请打开 Helper 日志。", retryPrepare),
  port_in_use: failure("helper", "扫描助手端口被占用", "Helper 使用的本机端口已被其他程序占用。", "请关闭其他 Helper 实例；仍然失败时请重启电脑。", retryConnect),
  uac_cancelled: failure("prepare", "已取消管理员授权", "Windows 管理员权限确认被取消，Scanner 没有启动。", "如果游戏以管理员身份运行，请重新选择管理员启动并确认 UAC。", [
    { kind: "restart_elevated", label: "以管理员权限重启" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  scanner_prepare_stalled: failure("prepare", "扫描器准备没有进展", "扫描器准备过程连续 90 秒没有收到下载或启动进展。", "请检查网络和安全软件后重试；仍然失败时请打开日志。", retryPrepare),
  scanner_prepare_timeout: failure("prepare", "扫描器准备超时", "扫描器在 15 分钟内没有完成准备。", "请重启 Helper 后重试；如果持续发生，请重新下载并修复。", [
    { kind: "repair", label: "重新下载并修复" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  prepare_failed: failure("prepare", "OCR 扫描器准备失败", "扫描器准备过程中发生未分类错误。", "请重试；如果问题持续，请打开日志并复制诊断信息。", retryPrepare),
  scan_busy: failure("scan", "扫描器正被占用", "已有扫描任务正在运行。", "请关闭其他扫描页面或等待当前任务完成。", retryScan),
  scan_request_invalid: failure("scan", "扫描请求无效", "网页发送的扫描参数无法被 Scanner 解析。", "请刷新网页并重试；仍然失败时请更新 Helper。", retryScan),
  scan_cancelled: failure("scan", "扫描已停止", "扫描任务已按请求停止。", "可以调整选项后重新开始扫描。", [{ kind: "retry_scan", label: "重新扫描" }], { severity: "warning" }),
  scan_stop_timeout: failure("scan", "停止扫描超时", "发出停止请求后 15 秒内没有收到 Scanner 回执。", "请重新连接 Helper；若 Scanner 仍在操作游戏，请关闭 Helper 后重试。", retryConnect),
  game_not_found: failure("scan", "未找到绝区零窗口", "Scanner 没有找到所选客户端的游戏窗口。", "请启动游戏并打开驱动盘仓库；云游戏用户请切换客户端选项。", retryScan),
  elevation_required: failure("scan", "需要管理员权限", "游戏进程权限高于 Scanner，无法可靠截图或发送输入。", "请以管理员权限重启 Scanner；只有本次启动会请求 UAC。", [
    { kind: "restart_elevated", label: "以管理员权限重启" },
    { kind: "open_logs", label: "打开日志" },
  ]),
  capture_failed: failure("scan", "无法读取游戏画面", "Scanner 无法稳定截取游戏窗口。", "请保持游戏可见且未最小化，并关闭遮挡窗口后重试。", retryScan),
  unsupported_display_layout: failure("scan", "当前显示布局不受支持", "游戏客户区不是扫描器支持的 16:9 布局。", "请切换到页面列出的 16:9 分辨率后重试。", retryScan),
  inventory_screen_not_detected: failure("scan", "未识别到驱动盘仓库", "Scanner 无法安全确认当前页面是驱动盘仓库。", "请使用简体中文并打开背包中的驱动盘页面，然后重试。", retryScan),
  inventory_screen_unreadable: failure("scan", "驱动盘仓库画面无法确认", "Scanner 已检测到部分仓库证据，但标题和布局无法同时确认。", "请关闭遮挡窗口，保持仓库界面完整可见，并确认游戏使用简体中文后重试。", retryScan),
  color_profile_unsupported: failure("scan", "当前显示色彩无法安全识别", "过强的反色、单色或自定义色彩滤镜影响了识别。", "请关闭相关滤镜后重试；普通 HDR 和夜间模式会自动兼容。", retryScan),
  panel_capture_timeout: failure("scan", "驱动盘详情读取超时", "选中驱动盘后，详情面板没有在规定时间内稳定。", "请保持游戏前台且无遮挡后重试；持续发生时请打开日志。", retryScan),
  inventory_count_ocr_failed: failure("scan", "仓库数量识别失败", "Scanner 无法识别仓库数量，因此不能安全判断扫描范围。", "请确认仓库数量区域完整可见，并关闭遮挡或缩放后重试。", retryScan),
  scan_navigation_failed: failure("scan", "驱动盘列表滚动失败", "Scanner 无法确认列表滚动位置，已停止以避免重复或漏扫。", "请保持游戏前台且不要操作鼠标滚轮，然后重新扫描。", retryScan),
  warehouse_context_lost: failure("scan", "无法确认驱动盘仓库界面", "扫描期间 Scanner 无法继续确认驱动盘仓库界面，已在下一次输入前停止。", "请确保游戏可见、未被遮挡并停留在背包中的驱动盘页面，然后重新扫描。", retryScan),
  ocr_worker_failed: failure("scan", "OCR 识别进程失败", "后台 OCR 工作线程发生异常。", "请重新扫描；如果持续发生，请打开日志并提供诊断信息。", retryScan),
  scanner_process_exited: failure("scan", "Scanner 进程意外退出", "扫描过程中 Scanner 子进程已退出。", "请重新连接并扫描；持续发生时请打开日志并提供退出码。", retryConnect),
  scanner_message_too_large: failure("scan", "扫描结果消息过大", "Scanner 返回的单条消息超过 Helper 的安全上限。", "已识别结果会安全保留；请更新 Scanner 后重新扫描。", retryScan),
  scanner_transport_failed: failure("scan", "Scanner 结果传输失败", "Helper 读取或转发 Scanner 结果时发生异常。", "已识别结果会安全保留；请重试并在持续发生时打开日志。", retryScan),
  scan_result_stream_incomplete: failure("scan", "扫描结果传输不完整", "网页收到的逐条结果数量与 Scanner 完成摘要不一致。", "已收到的结果会安全导入且不会删除缺失，请重新扫描缺少的部分。", retryScan, { severity: "warning" }),
  scan_no_progress_timeout: failure("scan", "扫描长时间没有进展", "Scanner 连续 180 秒没有产生新的扫描进展，任务已停止。", "请确认游戏仍在驱动盘仓库且未被遮挡，然后重新扫描。", retryScan),
  scanner_heartbeat_lost: failure("scan", "扫描器心跳中断", "网页连续 30 秒没有收到 Scanner 心跳。", "请确认 Helper 和 Scanner 仍在运行，然后重新连接。", retryConnect),
  scan_partial_failure: failure("scan", "部分驱动盘识别失败", "扫描已结束，但有部分驱动盘未能识别。", "已识别结果会自动安全导入且不会同步删除缺失。", [
    { kind: "retry_scan", label: "重新扫描" },
    { kind: "open_logs", label: "打开日志" },
  ], { severity: "warning" }),
  scan_result_invalid: failure("scan", "扫描结果格式无效", "Scanner 返回的完成数据缺少有效的驱动盘列表。", "请更新 Helper 和 Scanner 后重试；持续发生时请复制诊断信息。", retryScan),
  scan_failed: failure("scan", "扫描失败", "扫描过程中发生未分类错误。", "请重试；如果问题持续，请打开日志并复制诊断信息。", retryScan),
  import_failed: failure("import", "扫描结果导入失败", "扫描已完成，但网页无法把结果写入当前仓库。", "请重试导入；无需重新扫描。", [
    { kind: "retry_import", label: "重试导入" },
    { kind: "copy_diagnostics", label: "复制诊断信息" },
  ]),
}

const allowedActionKinds = new Set([
  "retry_connect", "download_helper", "update_helper", "retry", "repair", "restart_elevated",
  "retry_scan", "open_logs", "copy_diagnostics", "retry_import", "import_partial",
])

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value ?? ""))
}

function phaseFallbackCode(phase: ScannerFailurePhase) {
  if (phase === "connect") return "connect_failed"
  if (phase === "import") return "import_failed"
  if (phase === "scan") return "scan_failed"
  return "prepare_failed"
}

function asPhase(value: unknown, fallback: ScannerFailurePhase): ScannerFailurePhase {
  return ["connect", "helper", "prepare", "scan", "import"].includes(String(value))
    ? value as ScannerFailurePhase
    : fallback
}

export function normalizeScannerFailure(
  value: unknown,
  fallback: { phase?: ScannerFailurePhase; code?: string } = {},
): ScannerFailure {
  const input = value && typeof value === "object" ? value as Record<string, any> : {}
  const fallbackPhase = fallback.phase ?? "scan"
  const rawCode = String(input.code ?? fallback.code ?? "").trim()
  const code = rawCode || phaseFallbackCode(fallbackPhase)
  const catalog = SCANNER_ERROR_CATALOG[code]
    ?? SCANNER_ERROR_CATALOG[fallback.code ?? ""]
    ?? SCANNER_ERROR_CATALOG[phaseFallbackCode(fallbackPhase)]
    ?? SCANNER_ERROR_CATALOG.unknown_error
  const phase = asPhase(input.phase, catalog.phase)
  const rawMessage = input.message ?? (value instanceof Error ? value.message : typeof value === "string" ? value : "")
  const sourceDetails = input.details && typeof input.details === "object" && !Array.isArray(input.details)
    ? input.details
    : {}
  const actions = Array.isArray(input.actions)
    ? input.actions
      .filter((action: any) => allowedActionKinds.has(String(action?.kind)) && String(action?.label ?? "").trim())
      .map((action: any) => ({ kind: String(action.kind), label: String(action.label) }))
    : []

  return {
    code,
    phase,
    severity: input.severity === "warning" ? "warning" : catalog.severity,
    title: hasChinese(input.title) ? String(input.title) : catalog.title,
    message: hasChinese(rawMessage) ? String(rawMessage) : catalog.message,
    remedy: hasChinese(input.remedy) ? String(input.remedy) : catalog.remedy,
    retryable: input.retryable === undefined ? catalog.retryable : input.retryable !== false,
    actions: actions.length ? actions : catalog.actions.map(action => ({ ...action })),
    diagnosticId: String(input.diagnosticId ?? ""),
    details: {
      ...sourceDetails,
      ...(!hasChinese(rawMessage) && rawMessage ? { rawMessage: String(rawMessage).slice(0, 500) } : {}),
    },
  }
}

export function scannerFailureCatalogEntries() {
  return Object.entries(SCANNER_ERROR_CATALOG).map(([code, entry]) => ({ code, ...entry }))
}
