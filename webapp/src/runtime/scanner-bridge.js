const HELPER_PORT = 22355
const LEGACY_PORT = 22350
const CONNECT_TIMEOUT_MS = 2500
const ENSURE_TIMEOUT_MS = 15 * 60 * 1000
const ENSURE_STALL_TIMEOUT_MS = 90 * 1000
const REQUEST_TIMEOUT_MS = 60 * 1000
const SCAN_HEARTBEAT_TIMEOUT_MS = 30 * 1000
const SCAN_STOP_TIMEOUT_MS = 15 * 1000
const HELPER_BASE_URL = `http://127.0.0.1:${HELPER_PORT}`
const HELPER_PROTOCOL_URL = `zzz-scanner://launch?origin=${encodeURIComponent(window.location.origin)}`
const LOOPBACK_PERMISSION_NAMES = ["loopback-network", "local-network-access"]
const LEGACY_FALLBACK_CODES = new Set(["helper_unreachable"])
const DEFAULT_SCAN_TUNING = {
    fastMode: true,
    captureMode: "dxgi",
    processName: "ZenlessZoneZero",
    visualProfileClient: "local",
    visualProfileQuality: "current",
    profileRouting: "strict",
    overlapConflictMode: "recover",
    panelAcceptMode: "adaptive-early-full-roi",
    scrollAcceptMode: "early-one-row",
    postScrollPanelAcceptMode: "safe",
    panelMinAcceptFloorMs: 120,
}

export class ScannerConnectionError extends Error {
    constructor(code, stage, message, { permission = null, cause = null } = {}) {
        super(message)
        this.name = "ScannerConnectionError"
        this.code = code
        this.phase = "connect"
        this.stage = stage
        this.permissionName = String(permission?.name ?? "")
        this.permissionState = String(permission?.state ?? "unknown")
        this.retryable = code !== "helper_origin_rejected"
        this.details = {
            connectionStage: stage,
            permissionName: this.permissionName,
            permissionState: this.permissionState,
            causeName: String(cause?.name ?? ""),
        }
    }
}

export async function queryLoopbackPermission() {
    if (typeof navigator === "undefined" || typeof navigator.permissions?.query !== "function") {
        return { name: "", state: "unsupported" }
    }
    for (const name of LOOPBACK_PERMISSION_NAMES) {
        try {
            const status = await navigator.permissions.query({ name })
            const state = String(status?.state ?? "")
            if (state) {
                return { name, state }
            }
        } catch {
        }
    }
    return { name: "", state: "unsupported" }
}

function connectionError(code, stage, message, options = {}) {
    return new ScannerConnectionError(code, stage, message, options)
}

function permissionDeniedError(stage, permission, cause = null) {
    return connectionError(
        "loopback_permission_denied",
        stage,
        "浏览器已阻止当前网站连接本机扫描助手。",
        { permission, cause },
    )
}

export class ScannerBridge {
    constructor() {
        this._ws = null
        this._mode = ""
        this._helloData = null
        this._scanning = false
        this._scannerReady = false
        this._ensureResolver = null
        this._requestResolvers = new Map()
        this._heartbeatTimer = null
        this._lastHeartbeatAt = 0
        this._scanWasHidden = false
        this._stopTimer = null
        this._scanItems = new Map()
        this._scanRunId = 0
        this._scanTerminalDelivered = false
        this.onProgress = null
        this.onLauncherProgress = null
        this.onScannerReady = null
        this.onItem = null
        this.onComplete = null
        this.onError = null
        this.onDiagnostics = null
        this.onHelperUpdateProgress = null
        this.onHeartbeat = null
        this.onStopAck = null
        this.onDisconnect = null
    }

    get connected() {
        return this._ws?.readyState === WebSocket.OPEN
    }

    get scanning() {
        return this._scanning
    }

    get mode() {
        return this._mode
    }

    get helperVersion() {
        return this._mode === "helper" ? String(this._helloData?.version ?? "") : ""
    }

    get protocolVersion() {
        return this._mode === "helper" ? Number(this._helloData?.protocolVersion ?? 0) : 0
    }

    get scannerInfo() {
        return this._helloData?.scanner ?? {}
    }

    get scannerVersion() {
        return String(this.scannerInfo?.version ?? this.scannerInfo?.appVersion ?? "")
    }

    async connect() {
        if (this.connected) {
            return this._helloData
        }

        this.disconnect()
        const permission = await queryLoopbackPermission()
        if (permission.state === "denied") {
            throw permissionDeniedError("permission", permission)
        }
        try {
            return await this._connectHelper()
        } catch (helperError) {
            if (helperError instanceof ScannerConnectionError && !LEGACY_FALLBACK_CODES.has(helperError.code)) {
                throw helperError
            }
            try {
                return await this._connectLegacy()
            } catch {
                throw helperError
            }
        }
    }

    launchHelper() {
        const frame = document.createElement("iframe")
        frame.hidden = true
        frame.src = HELPER_PROTOCOL_URL
        document.body.append(frame)
        setTimeout(() => frame.remove(), 1200)
    }

    async ensureScanner() {
        if (!this.connected) {
            await this.connect()
        }
        if (this._mode !== "helper") {
            return
        }
        return this._runEnsureCommand("ensure_scanner")
    }

    async repairScanner() {
        if (!this.connected) {
            await this.connect()
        }
        this._scannerReady = false
        return this._runEnsureCommand("repair_scanner")
    }

    async restartScannerElevated() {
        if (!this.connected) {
            await this.connect()
        }
        this._scannerReady = false
        return this._runEnsureCommand("restart_scanner_elevated")
    }

    openLogFolder() {
        this._send("open_log_folder", {})
    }

    requestDiagnostics() {
        this._send("get_diagnostics", {})
    }

    async getStorageInfo() {
        if (!this.connected) {
            await this.connect()
        }
        this._requireProtocolV3()
        return this._request("get_storage_info", "storage_info")
    }

    async cleanupStorage() {
        if (!this.connected) {
            await this.connect()
        }
        this._requireProtocolV3()
        return this._request("cleanup_storage", "storage_cleanup_result")
    }

    async updateHelper() {
        if (!this.connected) {
            await this.connect()
        }
        this._requireProtocolV3()
        return this._request("update_helper", "helper_update_result", {}, 10 * 60 * 1000)
    }

    _requireProtocolV3() {
        if (this._mode !== "helper" || this.protocolVersion < 3) {
            throw new Error("当前 Helper 不支持存储管理，请先安装 1.2.0 或更高版本。")
        }
    }

    _request(command, responseCommand, data = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
        const requestId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._requestResolvers.delete(requestId)
                const code = command === "update_helper" ? "helper_update_failed" : "prepare_failed"
                reject(Object.assign(new Error("扫描助手响应超时，请重试。"), {
                    code,
                    phase: command === "update_helper" ? "helper" : "prepare",
                }))
            }, timeoutMs)
            this._requestResolvers.set(requestId, { responseCommand, resolve, reject, timer })
            this._send(command, { ...data, requestId })
        })
    }

    _runEnsureCommand(command) {
        if (this._ensureResolver) {
            return this._ensureResolver.promise
        }
        let resolveEnsure
        let rejectEnsure
        const promise = new Promise((resolve, reject) => {
            resolveEnsure = resolve
            rejectEnsure = reject
        })
        const timer = setTimeout(() => {
            this._rejectEnsure(Object.assign(new Error("OCR 扫描器在 15 分钟内没有完成准备。"), {
                code: "scanner_prepare_timeout",
                phase: "prepare",
            }))
        }, ENSURE_TIMEOUT_MS)
        this._ensureResolver = { resolve: resolveEnsure, reject: rejectEnsure, promise, timer, stallTimer: null }
        this._touchEnsureProgress()
        this._send(command, {})
        return promise
    }

    _touchEnsureProgress() {
        if (!this._ensureResolver) return
        if (this._ensureResolver.stallTimer) clearTimeout(this._ensureResolver.stallTimer)
        this._ensureResolver.stallTimer = setTimeout(() => {
            this._rejectEnsure(Object.assign(new Error("扫描器准备过程连续 90 秒没有进展。"), {
                code: "scanner_prepare_stalled",
                phase: "prepare",
            }))
        }, ENSURE_STALL_TIMEOUT_MS)
    }

    disconnect() {
        this._scanning = false
        this._scannerReady = false
        if (this._ensureResolver?.timer) {
            clearTimeout(this._ensureResolver.timer)
        }
        if (this._ensureResolver?.stallTimer) {
            clearTimeout(this._ensureResolver.stallTimer)
        }
        this._ensureResolver?.reject(Object.assign(new Error("扫描助手连接已断开。"), {
            code: "helper_disconnected",
            phase: "helper",
        }))
        this._ensureResolver = null
        this._rejectRequests(Object.assign(new Error("扫描助手连接已断开。"), {
            code: "helper_disconnected",
            phase: "helper",
        }))
        this._clearScanTimers()
        if (this._ws) {
            try { this._ws.close() } catch {}
            this._ws = null
        }
    }

    startScan(options = {}) {
        if (!this.connected) {
            throw new Error("Not connected")
        }
        this._scanning = true
        this._scanRunId += 1
        this._scanItems.clear()
        this._scanTerminalDelivered = false
        this._lastHeartbeatAt = Date.now()
        this._startHeartbeatWatchdog()
        this._send("scan_req", {
            maxItems: options.maxItems ?? 0,
            rarities: options.rarities ?? ["S"],
            resultDelivery: "stream-items-v1",
            stopAtNonLevel15: options.stopAtNonLevel15 ?? true,
            profileName: options.profileName ?? "",
            processName: options.processName ?? DEFAULT_SCAN_TUNING.processName,
            visualProfileClient: options.visualProfileClient ?? DEFAULT_SCAN_TUNING.visualProfileClient,
            visualProfileQuality: options.visualProfileQuality ?? DEFAULT_SCAN_TUNING.visualProfileQuality,
            fastMode: options.fastMode ?? DEFAULT_SCAN_TUNING.fastMode,
            captureMode: options.captureMode ?? DEFAULT_SCAN_TUNING.captureMode,
            profileRouting: options.profileRouting ?? DEFAULT_SCAN_TUNING.profileRouting,
            overlapConflictMode: options.overlapConflictMode ?? DEFAULT_SCAN_TUNING.overlapConflictMode,
            panelAcceptMode: options.panelAcceptMode ?? DEFAULT_SCAN_TUNING.panelAcceptMode,
            scrollAcceptMode: options.scrollAcceptMode ?? DEFAULT_SCAN_TUNING.scrollAcceptMode,
            postScrollPanelAcceptMode: options.postScrollPanelAcceptMode ?? DEFAULT_SCAN_TUNING.postScrollPanelAcceptMode,
            panelMinAcceptFloorMs: options.panelMinAcceptFloorMs ?? DEFAULT_SCAN_TUNING.panelMinAcceptFloorMs,
        })
    }

    stopScan() {
        if (!this.connected || !this._scanning) {
            return
        }
        this._send("scan_stop", {})
        if (this._stopTimer) clearTimeout(this._stopTimer)
        this._stopTimer = setTimeout(() => {
            if (!this._scanning) return
            this._scanning = false
            this._clearScanTimers()
            this._deliverScanTerminal("error", {
                code: "scan_stop_timeout",
                phase: "scan",
                title: "停止扫描超时",
                message: "发出停止请求后 15 秒内没有收到 Scanner 的终态回执。",
                remedy: "请重新连接 Helper；若 Scanner 仍在操作游戏，请关闭 Helper 后重试。",
                retryable: true,
                actions: [{ kind: "retry_connect", label: "重新连接" }],
            })
        }, SCAN_STOP_TIMEOUT_MS)
    }

    _startHeartbeatWatchdog() {
        if (this._mode !== "helper" || this.protocolVersion < 4) return
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer)
        this._scanWasHidden = typeof document !== "undefined" && document.visibilityState === "hidden"
        this._heartbeatTimer = setInterval(() => {
            if (!this._scanning) {
                this._clearScanTimers()
                return
            }
            const hidden = typeof document !== "undefined" && document.visibilityState === "hidden"
            if (hidden) {
                this._scanWasHidden = true
                return
            }
            if (this._scanWasHidden) {
                this._scanWasHidden = false
                this._lastHeartbeatAt = Date.now()
                return
            }
            if (Date.now() - this._lastHeartbeatAt < SCAN_HEARTBEAT_TIMEOUT_MS) return
            this._deliverScanTerminal("error", {
                code: "scanner_heartbeat_lost",
                phase: "scan",
                title: "扫描器心跳中断",
                message: "网页连续 30 秒没有收到 Scanner 心跳。",
                remedy: "请确认 Helper 和 Scanner 仍在运行，然后重新连接。",
                retryable: true,
                actions: [{ kind: "retry_connect", label: "重新连接" }],
            })
        }, 1000)
    }

    _touchHeartbeat(data = {}) {
        this._lastHeartbeatAt = Date.now()
        this.onHeartbeat?.(data)
    }

    _clearScanTimers() {
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer)
        if (this._stopTimer) clearTimeout(this._stopTimer)
        this._heartbeatTimer = null
        this._stopTimer = null
    }

    async _connectHelper() {
        let probe
        try {
            probe = await fetch(`${HELPER_BASE_URL}/`, {
                method: "GET",
                cache: "no-store",
                mode: "cors",
            })
        } catch (cause) {
            throw await this._fetchConnectionError("probe", cause)
        }
        if (!probe.ok) {
            throw connectionError(
                "helper_unreachable",
                "probe",
                `扫描助手健康检查失败${probe.status ? `（HTTP ${probe.status}）` : ""}。`,
            )
        }
        const info = await probe.json().catch(() => ({}))

        let tokenResponse
        try {
            tokenResponse = await fetch(`${HELPER_BASE_URL}/token`, {
                method: "POST",
                cache: "no-store",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ origin: window.location.origin }),
            })
        } catch (cause) {
            throw await this._fetchConnectionError("token", cause)
        }
        if (!tokenResponse.ok) {
            if (tokenResponse.status === 403) {
                throw connectionError(
                    "helper_origin_rejected",
                    "token",
                    "扫描助手拒绝了当前网页来源，请更新 Helper 后重试。",
                )
            }
            throw connectionError(
                "helper_unreachable",
                "token",
                `扫描助手令牌请求失败${tokenResponse.status ? `（HTTP ${tokenResponse.status}）` : ""}。`,
            )
        }
        const tokenData = await tokenResponse.json()
        if (!tokenData?.token) {
            throw connectionError("helper_origin_rejected", "token", "扫描助手未返回有效连接令牌，请更新 Helper 后重试。")
        }

        this._mode = "helper"
        this._scannerReady = Boolean(info?.scanner?.installed)
        try {
            return await this._openWebSocket(`ws://127.0.0.1:${HELPER_PORT}/ws/${encodeURIComponent(tokenData.token)}`, "helper")
        } catch (error) {
            const latestPermission = await queryLoopbackPermission()
            if (latestPermission.state === "denied") {
                throw permissionDeniedError("websocket", latestPermission, error)
            }
            throw error
        }
    }

    async _fetchConnectionError(stage, cause) {
        const permission = await queryLoopbackPermission()
        if (permission.state === "denied") {
            return permissionDeniedError(stage, permission, cause)
        }
        return connectionError(
            "helper_unreachable",
            stage,
            stage === "probe" ? "无法访问本机扫描助手。" : "无法向本机扫描助手申请连接令牌。",
            { permission, cause },
        )
    }

    async _connectLegacy() {
        this._mode = "legacy"
        this._scannerReady = true
        return await this._openWebSocket(`ws://127.0.0.1:${LEGACY_PORT}/ws/`, "legacy")
    }

    _openWebSocket(url, mode) {
        return new Promise((resolve, reject) => {
            let settled = false
            let handshakeComplete = false
            let timer = null
            const socketError = (code, message, cause = null) => mode === "helper"
                ? connectionError(code, "websocket", message, { cause })
                : new Error(message)

            try {
                this._ws = new WebSocket(url)
            } catch (cause) {
                reject(socketError("helper_websocket_blocked", "浏览器无法创建扫描助手 WebSocket。", cause))
                return
            }

            timer = setTimeout(() => {
                if (!settled) {
                    settled = true
                    this.disconnect()
                    reject(socketError("helper_connection_timeout", "连接扫描助手超时。"))
                }
            }, CONNECT_TIMEOUT_MS)

            this._ws.onmessage = (event) => {
                let envelope
                try { envelope = JSON.parse(event.data) } catch { return }
                const cmd = this._envelopeCmd(envelope)
                if (!settled && cmd === "hello") {
                    settled = true
                    handshakeComplete = true
                    clearTimeout(timer)
                    this._mode = mode
                    this._helloData = this._envelopeData(envelope)
                    this._bindMessageHandler()
                    resolve(this._helloData)
                    return
                }
                this._handleMessage(envelope)
            }

        this._ws.onerror = (event) => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(socketError("helper_websocket_blocked", "扫描助手已响应，但浏览器未能建立 WebSocket。", event))
                return
            }
            this._rejectEnsure(new Error("扫描助手连接出错，请重试。"))
        }

        this._ws.onclose = () => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(socketError("helper_websocket_blocked", "扫描助手 WebSocket 在握手完成前关闭。"))
            }
            if (!handshakeComplete) {
                return
            }
            const wasScanning = this._scanning
            this._scanning = false
            this._clearScanTimers()
            const failure = this._scanPayload({
                code: "helper_disconnected",
                phase: wasScanning ? "scan" : "helper",
                title: "扫描助手连接已断开",
                message: "网页与 Helper 的连接意外中断。",
                remedy: "请确认 Helper 仍在运行，然后重新连接。",
                retryable: true,
                actions: [{ kind: "retry_connect", label: "重新连接" }],
            })
            this._rejectEnsure(Object.assign(new Error(failure.message), failure))
            this._rejectRequests(Object.assign(new Error(failure.message), failure))
            if (!wasScanning || !this._scanTerminalDelivered) {
                if (wasScanning) this._scanTerminalDelivered = true
                this.onDisconnect?.(failure)
            }
        }
        })
    }

    _send(cmd, data) {
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({ cmd, data }))
        }
    }

    _rejectEnsure(error) {
        if (this._ensureResolver?.timer) {
            clearTimeout(this._ensureResolver.timer)
        }
        if (this._ensureResolver?.stallTimer) {
            clearTimeout(this._ensureResolver.stallTimer)
        }
        this._ensureResolver?.reject(error)
        this._ensureResolver = null
    }

    _rejectRequests(error) {
        for (const pending of this._requestResolvers.values()) {
            clearTimeout(pending.timer)
            pending.reject(error)
        }
        this._requestResolvers.clear()
    }

    _bindMessageHandler() {
        if (!this._ws) {
            return
        }
        this._ws.onmessage = (event) => {
            let envelope
            try { envelope = JSON.parse(event.data) } catch { return }
            this._handleMessage(envelope)
        }
    }

    _handleMessage(envelope) {
        const cmd = this._envelopeCmd(envelope)
        const data = this._envelopeData(envelope)
        const requestId = String(data?.requestId ?? "")
        const pending = requestId ? this._requestResolvers.get(requestId) : null
        if (pending && (cmd === "helper_update_error" || cmd === "request_error")) {
            clearTimeout(pending.timer)
            this._requestResolvers.delete(requestId)
            pending.reject(Object.assign(new Error(data?.message || "扫描助手请求失败。"), data ?? {}))
            return
        }
        if (pending && pending.responseCommand === cmd) {
            clearTimeout(pending.timer)
            this._requestResolvers.delete(requestId)
            pending.resolve(data)
        }
        switch (cmd) {
            case "launcher_progress":
                this._touchEnsureProgress()
                this.onLauncherProgress?.(data)
                break
            case "scanner_ready":
                this._scannerReady = true
                this._helloData = {
                    ...(this._helloData ?? {}),
                    scanner: data ?? this._helloData?.scanner ?? {},
                }
                if (this._ensureResolver?.timer) clearTimeout(this._ensureResolver.timer)
                if (this._ensureResolver?.stallTimer) clearTimeout(this._ensureResolver.stallTimer)
                this._ensureResolver?.resolve(data)
                this._ensureResolver = null
                this.onScannerReady?.(data)
                break
            case "scan_progress":
                this._touchHeartbeat(data)
                this.onProgress?.(data)
                break
            case "scan_heartbeat":
                this._touchHeartbeat(data)
                break
            case "scan_stop_ack":
                this._touchHeartbeat(data)
                this.onStopAck?.(data)
                break
            case "scan_item":
                this._retainScanItem(data)
                this.onItem?.(data)
                break
            case "scan_complete":
                this._deliverScanTerminal("complete", data)
                break
            case "scan_error":
                this._rejectEnsure(Object.assign(new Error(data?.message || "Scanner error"), data ?? {}))
                this._deliverScanTerminal("error", data)
                break
            case "helper_diagnostics":
                this.onDiagnostics?.(data)
                break
            case "helper_update_progress":
                this.onHelperUpdateProgress?.(data)
                break
        }
    }

    _retainScanItem(item) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return
        const rawIndex = Number(item["序号"] ?? item.index ?? item.Index)
        const index = Number.isInteger(rawIndex) && rawIndex > 0
            ? rawIndex
            : this._scanItems.size + 1
        this._scanItems.set(index, item)
    }

    _retainedScanItems() {
        return [...this._scanItems.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, item]) => item)
    }

    _scanPayload(data = {}) {
        const source = data && typeof data === "object" && !Array.isArray(data) ? data : {}
        const legacyItems = Array.isArray(source.items) ? source.items : null
        const retainedItems = legacyItems ?? this._retainedScanItems()
        const expectedCount = Number(source.itemCount ?? source.completed)
        const streamed = source.resultDelivery === "stream-items-v1"
        const streamIncomplete = streamed
            && Number.isFinite(expectedCount)
            && expectedCount >= 0
            && expectedCount !== retainedItems.length
        return {
            ...source,
            items: retainedItems,
            retainedItems,
            scanRunId: this._scanRunId,
            streamIncomplete,
        }
    }

    _deliverScanTerminal(kind, data) {
        if (this._scanTerminalDelivered) return
        this._scanTerminalDelivered = true
        this._scanning = false
        this._clearScanTimers()
        const payload = this._scanPayload(data)
        if (kind === "complete") this.onComplete?.(payload)
        else this.onError?.(payload)
    }

    _envelopeCmd(envelope) {
        return envelope?.cmd ?? envelope?.Cmd ?? ""
    }

    _envelopeData(envelope) {
        return envelope?.data ?? envelope?.Data
    }
}
