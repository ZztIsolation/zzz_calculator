import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalFetch = globalThis.fetch
const originalWebSocket = globalThis.WebSocket

function installDom() {
    const appended = []
    globalThis.window = { location: { origin: "http://localhost:8787" } }
    globalThis.document = {
        createElement(tag) {
            return {
                tag,
                hidden: false,
                src: "",
                remove() {
                    this.removed = true
                },
            }
        },
        body: {
            append(node) {
                appended.push(node)
            },
        },
    }
    return appended
}

function okJson(payload) {
    return {
        ok: true,
        json: async () => payload,
    }
}

async function loadBridge() {
    return await import(`../webapp/src/runtime/scanner-bridge.js?case=${Date.now()}-${Math.random()}`)
}

function assertScannerPackageManifest() {
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
    const scannerRoot = join(repoRoot, "downloads", "zzz-scanner")
    const manifestPath = join(repoRoot, "config", "scanner-manifest.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    const helperManifest = JSON.parse(readFileSync(join(repoRoot, "config", "helper-manifest.json"), "utf8"))
    assert.equal(manifest.schemaVersion, 3)
    assert.equal(manifest.launcherMinVersion, "1.2.1")
    assert.equal(manifest.scannerVersion, "1.0.38")
    assert.equal(helperManifest.schemaVersion, 1)
    assert.equal(helperManifest.version, "1.2.1")
    assert.equal(manifest.support.minWindowsBuild, 17763)
    assert.deepEqual(manifest.support.architectures, ["x64"])
    assert.deepEqual(manifest.packages.map(packageInfo => packageInfo.id), ["win-x64-fdd", "win-x64-self-contained"])
    assert.equal(manifest.packages[0].framework.name, "Microsoft.WindowsDesktop.App")
    assert.equal(manifest.packages[1].framework, undefined)

    for (const packageInfo of manifest.packages) {
        assert.ok(packageInfo.size > 0)
        assert.ok(packageInfo.expandedSize >= packageInfo.size)
        assert.equal(packageInfo.entry, "ZZZ-Scanner.Next.exe")
        assert.ok(packageInfo.packageUrls[0].startsWith("https://download.zzzcaculator.top/downloads/zzz-scanner/1.0.38/"))
        assert.ok(packageInfo.packageUrls.some(url => url.startsWith("./1.0.38/")))
        assert.ok(packageInfo.packageUrls.some(url => url.startsWith("https://zzzcaculator.top/downloads/zzz-scanner/1.0.38/")))
        assert.ok(packageInfo.packageUrls.some(url => url.startsWith("https://github.com/")))
        assert.equal(packageInfo.packageUrls.some(url => url.startsWith("http://121.199.21.10")), false)
        assert.ok(packageInfo.files.length > 0)
        assert.equal(packageInfo.files.reduce((sum, file) => sum + file.size, 0), packageInfo.expandedSize)
        assert.ok(packageInfo.files.some(file => file.path === packageInfo.entry))

        const localUrl = packageInfo.packageUrls.find(url => url.startsWith("./"))
        const packagePath = normalize(join(scannerRoot, localUrl))
        if (existsSync(packagePath)) {
            const packageStat = statSync(packagePath)
            assert.equal(packageStat.size, packageInfo.size)
            assert.equal(createHash("sha256").update(readFileSync(packagePath)).digest("hex"), packageInfo.sha256)
        }
    }
}

try {
    const appended = installDom()
    let fetchUrls = []
    globalThis.fetch = async (url) => {
        fetchUrls.push(String(url))
        if (String(url).endsWith("/")) {
            return okJson({ scanner: { installed: false } })
        }
        return okJson({ token: "abc" })
    }

    class HelperSocket {
        static OPEN = 1
        constructor(url) {
            this.url = url
            this.readyState = HelperSocket.OPEN
            HelperSocket.last = this
            queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ cmd: "hello", data: { ok: true } }) }))
        }
        send(raw) {
            this.sent = JSON.parse(raw)
            if (["ensure_scanner", "repair_scanner", "restart_scanner_elevated"].includes(this.sent.cmd)) {
                queueMicrotask(() => this.onmessage?.({
                    data: JSON.stringify({ cmd: "scanner_ready", data: { installed: true } }),
                }))
            }
        }
        close() {}
    }
    globalThis.WebSocket = HelperSocket

    const { ScannerBridge } = await loadBridge()
    const bridge = new ScannerBridge()
    await bridge.connect()
    assert.equal(bridge.mode, "helper")
    assert.deepEqual(fetchUrls, ["http://127.0.0.1:22355/", "http://127.0.0.1:22355/token"])
    assert.equal(HelperSocket.last.url, "ws://127.0.0.1:22355/ws/abc")
    await bridge.ensureScanner()
    assert.equal(HelperSocket.last.sent.cmd, "ensure_scanner")
    await bridge.repairScanner()
    assert.equal(HelperSocket.last.sent.cmd, "repair_scanner")
    await bridge.restartScannerElevated()
    assert.equal(HelperSocket.last.sent.cmd, "restart_scanner_elevated")
    bridge.openLogFolder()
    assert.equal(HelperSocket.last.sent.cmd, "open_log_folder")

    let structuredError = null
    bridge.onError = data => { structuredError = data }
    HelperSocket.last.onmessage({
        data: JSON.stringify({
            cmd: "scan_error",
            data: { code: "disk_insufficient", phase: "preflight", message: "磁盘空间不足" },
        }),
    })
    assert.equal(structuredError.code, "disk_insufficient")
    bridge.startScan({ maxItems: 12, rarities: ["S", "A"] })
    assert.deepEqual(HelperSocket.last.sent, {
        cmd: "scan_req",
        data: {
            maxItems: 12,
            rarities: ["S", "A"],
            stopAtNonLevel15: true,
            profileName: "",
            processName: "ZenlessZoneZero",
            visualProfileClient: "local",
            visualProfileQuality: "current",
            fastMode: true,
            captureMode: "dxgi",
            profileRouting: "strict",
            overlapConflictMode: "recover",
            panelAcceptMode: "adaptive-early-full-roi",
            scrollAcceptMode: "early-one-row",
            postScrollPanelAcceptMode: "safe",
            panelMinAcceptFloorMs: 120,
        },
    })

    bridge.startScan({
        maxItems: 3,
        processName: "Zenless Zone Zero Cloud",
        visualProfileClient: "cloud",
        visualProfileQuality: "current",
    })
    assert.equal(HelperSocket.last.sent.data.processName, "Zenless Zone Zero Cloud")
    assert.equal(HelperSocket.last.sent.data.visualProfileClient, "cloud")
    assert.equal(HelperSocket.last.sent.data.visualProfileQuality, "current")

    let completedItems = null
    bridge.onComplete = (data) => {
        completedItems = data.items
    }
    HelperSocket.last.onmessage({
        data: JSON.stringify({ Cmd: "scan_complete", Data: { items: [{ name: "from child" }] } }),
    })
    assert.deepEqual(completedItems, [{ name: "from child" }])

    bridge.launchHelper()
    assert.equal(appended.at(-1).src, "zzz-scanner://launch?origin=http%3A%2F%2Flocalhost%3A8787")

    globalThis.fetch = async (url) => {
        fetchUrls.push(String(url))
        if (String(url).endsWith("/")) {
            return okJson({ scanner: { installed: true, version: "1.0.36" } })
        }
        return okJson({ token: "ready" })
    }
    class ReadySocket {
        static OPEN = 1
        constructor(url) {
            this.url = url
            this.readyState = ReadySocket.OPEN
            ReadySocket.last = this
            this.sent = []
            queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ cmd: "hello", data: { ok: true } }) }))
        }
        send(raw) {
            this.sent.push(JSON.parse(raw))
        }
        close() {}
    }
    globalThis.WebSocket = ReadySocket
    const readyBridge = new ScannerBridge()
    await readyBridge.connect()
    await readyBridge.ensureScanner()
    assert.deepEqual(ReadySocket.last.sent, [])

    let legacyAttempted = false
    globalThis.fetch = async () => {
        throw new Error("helper down")
    }
    class LegacySocket {
        static OPEN = 1
        constructor(url) {
            legacyAttempted = true
            this.url = url
            this.readyState = LegacySocket.OPEN
            queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ cmd: "hello", data: { legacy: true } }) }))
        }
        send() {}
        close() {}
    }
    globalThis.WebSocket = LegacySocket
    const legacyBridge = new ScannerBridge()
    await legacyBridge.connect()
    assert.equal(legacyBridge.mode, "legacy")
    assert.equal(legacyAttempted, true)

    assertScannerPackageManifest()
} finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
}
