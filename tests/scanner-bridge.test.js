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
    return await import(`../frontend/scanner-bridge.js?case=${Date.now()}-${Math.random()}`)
}

function assertScannerPackageManifest() {
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
    const scannerRoot = join(repoRoot, "downloads", "zzz-scanner")
    const manifestPath = join(scannerRoot, "manifest.json")
    if (!existsSync(manifestPath)) {
        return
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    const localPackageUrl = "./1.0.28/ZZZ-Scanner.Next-win-x64.zip"
    const mirrorPackageUrl = "http://121.199.21.10/downloads/zzz-scanner/1.0.28/ZZZ-Scanner.Next-win-x64.zip"
    const packagePath = normalize(join(scannerRoot, localPackageUrl))

    assert.equal(manifest.scannerVersion, "1.0.28")
    assert.equal(manifest.packageUrl, "https://github.com/ZztIsolation/zzz_calculator/releases/download/scanner-1.0.28/ZZZ-Scanner.Next-win-x64.zip")
    assert.ok(Array.isArray(manifest.packageUrls))
    assert.equal(manifest.packageUrls[0], mirrorPackageUrl)
    assert.ok(manifest.packageUrls.includes(manifest.packageUrl))
    assert.ok(manifest.packageUrls.includes(mirrorPackageUrl))
    assert.ok(manifest.packageUrls.includes(localPackageUrl))
    assert.equal(manifest.entry, "ZZZ-Scanner.Next.exe")
    assert.equal(existsSync(join(scannerRoot, "1.0.0")), false)
    assert.equal(existsSync(join(scannerRoot, "1.0.1")), false)
    assert.equal(existsSync(join(scannerRoot, "1.0.3")), false)
    assert.equal(existsSync(join(scannerRoot, "1.0.27")), false)
    assert.equal(existsSync(packagePath), true)

    const packageStat = statSync(packagePath)
    assert.equal(packageStat.size, manifest.size)
    assert.equal(createHash("sha256").update(readFileSync(packagePath)).digest("hex"), manifest.sha256)
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
            if (this.sent.cmd === "ensure_scanner") {
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
    bridge.startScan({ maxItems: 12, rarities: ["S", "A"] })
    assert.deepEqual(HelperSocket.last.sent, {
        cmd: "scan_req",
        data: {
            maxItems: 12,
            rarities: ["S", "A"],
            stopAtNonLevel15: true,
            profileName: "",
            fastMode: true,
            captureMode: "dxgi",
            panelMinAcceptFloorMs: 120,
            postScrollPanelAcceptMode: "safe",
            sameRowPanelMinAcceptFloorMs: 105,
            postScrollPanelMinAcceptFloorMs: 110,
            overlapConflictMode: "recover",
        },
    })

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
            return okJson({ scanner: { installed: true, version: "1.0.28" } })
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
