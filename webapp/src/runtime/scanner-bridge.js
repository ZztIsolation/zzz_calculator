const HELPER_PORT = 22355
const LEGACY_PORT = 22350
const CONNECT_TIMEOUT_MS = 2500
const ENSURE_TIMEOUT_MS = 10 * 60 * 1000
const HELPER_BASE_URL = `http://127.0.0.1:${HELPER_PORT}`
const HELPER_PROTOCOL_URL = `zzz-scanner://launch?origin=${encodeURIComponent(window.location.origin)}`
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

export class ScannerBridge {
    constructor() {
        this._ws = null
        this._mode = ""
        this._helloData = null
        this._scanning = false
        this._scannerReady = false
        this._ensureResolver = null
        this.onProgress = null
        this.onLauncherProgress = null
        this.onScannerReady = null
        this.onItem = null
        this.onComplete = null
        this.onError = null
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

    async connect() {
        if (this.connected) {
            return this._helloData
        }

        this.disconnect()
        try {
            return await this._connectHelper()
        } catch (helperError) {
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
        if (this._mode !== "helper" || this._scannerReady) {
            return
        }
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
            this._ensureResolver?.reject(new Error("准备 OCR 扫描器超时，请检查网络后重启扫描助手。"))
            this._ensureResolver = null
        }, ENSURE_TIMEOUT_MS)
        this._ensureResolver = { resolve: resolveEnsure, reject: rejectEnsure, promise, timer }
        this._send("ensure_scanner", {})
        return promise
    }

    disconnect() {
        this._scanning = false
        this._scannerReady = false
        if (this._ensureResolver?.timer) {
            clearTimeout(this._ensureResolver.timer)
        }
        this._ensureResolver?.reject(new Error("Scanner helper disconnected"))
        this._ensureResolver = null
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
        this._send("scan_req", {
            maxItems: options.maxItems ?? 0,
            rarities: options.rarities ?? ["S"],
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
        if (!this.connected) {
            return
        }
        this._send("scan_stop", {})
    }

    async _connectHelper() {
        const probe = await fetch(`${HELPER_BASE_URL}/`, {
            method: "GET",
            cache: "no-store",
            mode: "cors",
        })
        if (!probe.ok) {
            throw new Error("Scanner helper is not ready")
        }
        const info = await probe.json().catch(() => ({}))

        const tokenResponse = await fetch(`${HELPER_BASE_URL}/token`, {
            method: "POST",
            cache: "no-store",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin: window.location.origin }),
        })
        if (!tokenResponse.ok) {
            throw new Error("Scanner helper rejected this page")
        }
        const tokenData = await tokenResponse.json()
        if (!tokenData?.token) {
            throw new Error("Scanner helper did not return a token")
        }

        this._mode = "helper"
        this._scannerReady = Boolean(info?.scanner?.installed)
        return await this._openWebSocket(`ws://127.0.0.1:${HELPER_PORT}/ws/${encodeURIComponent(tokenData.token)}`, "helper")
    }

    async _connectLegacy() {
        this._mode = "legacy"
        this._scannerReady = true
        return await this._openWebSocket(`ws://127.0.0.1:${LEGACY_PORT}/ws/`, "legacy")
    }

    _openWebSocket(url, mode) {
        return new Promise((resolve, reject) => {
            let settled = false
            let timer = null

            try {
                this._ws = new WebSocket(url)
            } catch {
                reject(new Error("WebSocket creation failed"))
                return
            }

            timer = setTimeout(() => {
                if (!settled) {
                    settled = true
                    this.disconnect()
                    reject(new Error("Connection timed out"))
                }
            }, CONNECT_TIMEOUT_MS)

            this._ws.onmessage = (event) => {
                let envelope
                try { envelope = JSON.parse(event.data) } catch { return }
                const cmd = this._envelopeCmd(envelope)
                if (!settled && cmd === "hello") {
                    settled = true
                    clearTimeout(timer)
                    this._mode = mode
                    this._helloData = this._envelopeData(envelope)
                    this._bindMessageHandler()
                    resolve(this._helloData)
                    return
                }
                this._handleMessage(envelope)
            }

        this._ws.onerror = () => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(new Error("Cannot connect to scanner helper"))
                return
            }
            this._rejectEnsure(new Error("扫描助手连接出错，请重试。"))
        }

        this._ws.onclose = () => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(new Error("Connection closed"))
            }
            this._scanning = false
            this._rejectEnsure(new Error("扫描助手连接已断开，请重新点击扫描。"))
            this.onDisconnect?.()
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
        this._ensureResolver?.reject(error)
        this._ensureResolver = null
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
        switch (cmd) {
            case "launcher_progress":
                this.onLauncherProgress?.(data)
                break
            case "scanner_ready":
                this._scannerReady = true
                if (this._ensureResolver?.timer) clearTimeout(this._ensureResolver.timer)
                this._ensureResolver?.resolve(data)
                this._ensureResolver = null
                this.onScannerReady?.(data)
                break
            case "scan_progress":
                this.onProgress?.(data)
                break
            case "scan_item":
                this.onItem?.(data)
                break
            case "scan_complete":
                this._scanning = false
                this.onComplete?.(data)
                break
            case "scan_error":
                this._scanning = false
                this._rejectEnsure(new Error(data?.message || "Scanner error"))
                this.onError?.(data)
                break
        }
    }

    _envelopeCmd(envelope) {
        return envelope?.cmd ?? envelope?.Cmd ?? ""
    }

    _envelopeData(envelope) {
        return envelope?.data ?? envelope?.Data
    }
}
