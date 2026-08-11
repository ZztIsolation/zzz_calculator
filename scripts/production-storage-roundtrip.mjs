#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import http from "node:http"
import https from "node:https"
import { createRequire } from "node:module"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const PROXY_ORIGIN = "http://127.0.0.1:8788"
const CANDIDATE_ORIGIN = "http://127.0.0.1:8790"
const DB_NAME = "zzz-calculator-user-store"
const DB_VERSION = 1
const STATE_STORE = "state"
const STORE_KEY = "userDriveDiscStore"
const OTHER_STORE_KEY = "cicd-preserved-record"
const OTHER_STORE_VALUE = { sentinel: "preserve-other-record", future: { keep: true } }

function parseArgs(argv) {
    const values = {}
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index]
        if (!token.startsWith("--") || index + 1 >= argv.length) {
            throw new Error(`Invalid argument: ${token}`)
        }
        values[token.slice(2)] = argv[index + 1]
        index += 1
    }
    for (const key of ["candidate-dir", "current-url", "expected-commit", "evidence", "screenshot"]) {
        if (!values[key]) throw new Error(`Missing required --${key}`)
    }
    if (!/^[0-9a-f]{40}$/.test(values["expected-commit"])) {
        throw new Error("--expected-commit must be a lowercase 40-character Git SHA")
    }
    const currentUrl = new URL(values["current-url"])
    if (!["http:", "https:"].includes(currentUrl.protocol)) {
        throw new Error("--current-url must use HTTP or HTTPS")
    }
    return {
        candidateDir: path.resolve(values["candidate-dir"]),
        currentUrl: currentUrl.href.replace(/\/$/, ""),
        expectedCommit: values["expected-commit"],
        evidencePath: path.resolve(values.evidence),
        screenshotPath: path.resolve(values.screenshot),
    }
}

function inventoryFixture() {
    const baseDisc = {
        ownerId: "default",
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: true,
        equippedBy: "agent-a",
        reservedForAgentId: "agent-b",
        excludedForAgentIds: ["agent-c"],
        mainStat: { stat: "hpFlat", mode: "flat", value: 2200 },
        subStats: [{ stat: "anomalyProficiency", mode: "flat", value: 27 }],
        contentFingerprint: "content-fingerprint-sentinel",
        identityFingerprint: "identity-fingerprint-sentinel",
        source: { type: "zzz-scanner", importId: "cicd-import" },
        futureDiscField: { preserve: true },
    }
    return {
        version: 1,
        updatedAt: "2026-08-06T00:00:00.000Z",
        currentOwnerId: "default",
        owners: [
            { id: "default", label: "默认用户", futureOwnerField: "keep-default" },
            { id: "alt", label: "二号账号", futureOwnerField: "keep-alt" },
        ],
        imports: [{ id: "cicd-import", ownerId: "default", futureImportField: "keep" }],
        driveDiscs: [
            {
                ...baseDisc,
                id: "cicd-vow-disc",
                setId: "scanner-set-62cbf3b10eb2",
                setName: "谶羽之誓",
                partition: 1,
                locked: false,
                equippedBy: null,
                reservedForAgentId: null,
                excludedForAgentIds: [],
                raw: { 名称: "谶羽之誓", sentinel: "keep-vow" },
            },
            {
                ...baseDisc,
                id: "cicd-vow-disc-2",
                setId: "",
                setName: "谶羽之誓",
                partition: 2,
                locked: false,
                equippedBy: null,
                reservedForAgentId: null,
                excludedForAgentIds: [],
                raw: { 名称: "谶羽之誓", sentinel: "keep-vow-2" },
            },
            ...[
                [3, "defFlat"],
                [4, "anomalyProficiency"],
                [5, "atkPct"],
                [6, "atkPct"],
            ].map(([partition, mainStat]) => ({
                ...baseDisc,
                id: `cicd-vow-disc-${partition}`,
                setId: "scanner-set-62cbf3b10eb2",
                setName: "谶羽之誓",
                partition,
                mainStat: { stat: mainStat, mode: mainStat.endsWith("Pct") ? "pct" : "flat", value: 30 },
                locked: false,
                equippedBy: null,
                reservedForAgentId: null,
                excludedForAgentIds: [],
                contentFingerprint: `content-fingerprint-vow-${partition}`,
                identityFingerprint: `identity-fingerprint-vow-${partition}`,
                raw: { 名称: "谶羽之誓", sentinel: `keep-vow-${partition}` },
            })),
            {
                ...baseDisc,
                id: "cicd-thorn-disc",
                ownerId: "alt",
                setId: "zzz_wiki_2121",
                setName: "棘刺玫瑰",
                partition: 3,
                locked: false,
                equippedBy: null,
                reservedForAgentId: null,
                excludedForAgentIds: [],
                raw: { 名称: "棘刺玫瑰", sentinel: "keep-thorn" },
            },
            {
                ...baseDisc,
                id: "cicd-unknown-disc",
                setId: "scanner-set-future",
                setName: "未来未知套装",
                partition: 4,
                raw: { 名称: "未来未知套装", sentinel: "keep-unknown" },
            },
            {
                ...baseDisc,
                id: "cicd-custom-disc",
                setId: "custom-set-preserve",
                setName: "谶羽之誓",
                partition: 5,
                raw: { 名称: "谶羽之誓", sentinel: "keep-custom" },
            },
        ],
        driveDiscLoadouts: [{
            id: "cicd-loadout",
            ownerId: "default",
            agentId: "agent-a",
            driveDiscIdsBySlot: {
                1: "cicd-vow-disc",
                2: "cicd-vow-disc-2",
                4: "cicd-unknown-disc",
            },
            futureLoadoutField: "keep",
        }],
        futureStoreField: { preserve: true },
    }
}

function localStorageFixture(store) {
    return {
        "zzz-calculator.userStore.v1": JSON.stringify({ ...store, fallbackSentinel: "keep" }),
        "zzz-calculator.currentAccount.v1": "default",
        "zzz-calculator.homeSelection.v1": JSON.stringify({
            version: 2,
            currentOwnerId: "default",
            byOwner: {
                default: {
                    currentAgentId: "remielle_dan",
                    byAgent: {},
                    futureSelectionField: "keep",
                },
            },
        }),
        "zzz-calculator.webapp.build.v1": JSON.stringify({
            version: 2,
            currentOwnerId: "default",
            byOwner: {
                default: {
                    currentAgentId: "remielle_dan",
                    byAgent: {
                        remielle_dan: {
                            futureBuildField: { preserve: true },
                            damage: {
                                mode: "adminDefault",
                                selectedEventId: "cicd-luminescence",
                                events: [{
                                    id: "cicd-luminescence",
                                    kind: "anomaly",
                                    settlementType: "luminescence",
                                    triggerActorRef: { agentId: "remielle_dan" },
                                    teammateAttack: 3000,
                                    luminescenceDamageSharePct: 50,
                                }],
                            },
                        },
                    },
                },
                alt: {
                    currentAgentId: "agent-alt",
                    byAgent: { "agent-alt": { futureAltBuildField: "keep" } },
                },
            },
        }),
        "zzz-calculator.webapp.optimizer.v1": JSON.stringify({
            version: 3,
            byAgent: { "agent-a": { setIds: ["zzz_wiki_2116"], futureOptimizerField: "keep" } },
            futureOptimizerRoot: "keep",
        }),
        "zzz_maintenance_vue_draft_v3": JSON.stringify({ version: 3, incompatibleDraftSentinel: "keep" }),
        "cicd-unrelated-sentinel": "keep-unrelated",
    }
}

async function listen(server, port) {
    await new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(port, "127.0.0.1", resolve)
    })
}

async function assertPortFree(port) {
    const probe = createServer()
    await listen(probe, port)
    await closeServer(probe)
}

async function closeServer(server) {
    if (!server.listening) return
    await new Promise(resolve => server.close(resolve))
}

async function waitForUrl(url, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs
    let lastError
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
            if (response.ok) return response
            lastError = new Error(`${url} returned ${response.status}`)
        } catch (error) {
            lastError = error
        }
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}`)
}

function startCandidate(candidateDir) {
    const child = spawn(process.execPath, [path.join(candidateDir, "backend", "server.js")], {
        cwd: candidateDir,
        env: {
            ...process.env,
            HOST: "127.0.0.1",
            PORT: "8790",
            NODE_ENV: "production",
            MAINTENANCE_ENABLED: "false",
            SCAN_TELEMETRY_ENABLED: "false",
            DRIVE_DISC_RESERVATIONS_UI_ENABLED: "false",
            DRIVE_DISC_EXCLUSIONS_UI_ENABLED: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    })
    const output = []
    child.stdout.on("data", chunk => output.push(String(chunk)))
    child.stderr.on("data", chunk => output.push(String(chunk)))
    return { child, output }
}

async function stopChild(child) {
    if (child.exitCode !== null || child.signalCode !== null) return
    child.kill("SIGTERM")
    await Promise.race([
        new Promise(resolve => child.once("exit", resolve)),
        new Promise(resolve => setTimeout(resolve, 3_000)),
    ])
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

function createSwitchingProxy(initialTarget) {
    let target = initialTarget
    const server = createServer((request, response) => {
        if (request.url?.startsWith("/__cicd_blank__")) {
            response.writeHead(200, {
                "cache-control": "no-store",
                "content-type": "text/html; charset=utf-8",
            })
            response.end("<!doctype html><meta charset=utf-8><title>CI/CD storage fixture</title>")
            return
        }
        if (!["GET", "HEAD"].includes(request.method || "")) {
            response.writeHead(405, { "content-type": "text/plain; charset=utf-8" })
            response.end("CI/CD validation proxy is read-only")
            return
        }
        const upstreamUrl = new URL(request.url || "/", `${target}/`)
        const transport = upstreamUrl.protocol === "https:" ? https : http
        const headers = { ...request.headers, host: upstreamUrl.host, "accept-encoding": "identity" }
        const upstream = transport.request(upstreamUrl, {
            method: request.method,
            headers,
        }, upstreamResponse => {
            const responseHeaders = { ...upstreamResponse.headers }
            if (typeof responseHeaders.location === "string") {
                responseHeaders.location = responseHeaders.location.replace(target, PROXY_ORIGIN)
            }
            response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders)
            upstreamResponse.pipe(response)
        })
        upstream.on("error", error => {
            if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
            response.end(`CI/CD proxy error: ${error.message}`)
        })
        upstream.end()
    })
    return {
        server,
        setTarget(nextTarget) {
            target = nextTarget
        },
    }
}

async function seedBrowserStorage(page, store, localValues) {
    await page.goto(`${PROXY_ORIGIN}/__cicd_blank__`, { waitUntil: "domcontentloaded" })
    await page.evaluate(async ({
        databaseName,
        databaseVersion,
        stateStore,
        storeKey,
        storeValue,
        otherStoreKey,
        otherStoreValue,
        values,
    }) => {
        for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
        await new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, databaseVersion)
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(stateStore)) request.result.createObjectStore(stateStore)
            }
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                const database = request.result
                const transaction = database.transaction(stateStore, "readwrite")
                transaction.objectStore(stateStore).put(storeValue, storeKey)
                transaction.objectStore(stateStore).put(otherStoreValue, otherStoreKey)
                transaction.oncomplete = () => {
                    database.close()
                    resolve()
                }
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            }
        })
    }, {
        databaseName: DB_NAME,
        databaseVersion: DB_VERSION,
        stateStore: STATE_STORE,
        storeKey: STORE_KEY,
        storeValue: store,
        otherStoreKey: OTHER_STORE_KEY,
        otherStoreValue: OTHER_STORE_VALUE,
        values: localValues,
    })
}

async function readBrowserStorage(page, keys) {
    return await page.evaluate(async ({ databaseName, databaseVersion, stateStore, storeKey, otherStoreKey, storageKeys }) => {
        const databaseSnapshot = await new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, databaseVersion)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                const database = request.result
                const transaction = database.transaction(stateStore, "readonly")
                const objectStore = transaction.objectStore(stateStore)
                const getRequest = objectStore.get(storeKey)
                const otherRequest = objectStore.get(otherStoreKey)
                const keysRequest = objectStore.getAllKeys()
                let store
                let otherRecord
                let keys
                getRequest.onsuccess = () => { store = getRequest.result }
                otherRequest.onsuccess = () => { otherRecord = otherRequest.result }
                keysRequest.onsuccess = () => { keys = keysRequest.result }
                for (const activeRequest of [getRequest, otherRequest, keysRequest]) {
                    activeRequest.onerror = () => reject(activeRequest.error)
                }
                transaction.oncomplete = () => {
                    const snapshot = {
                        version: database.version,
                        objectStores: Array.from(database.objectStoreNames),
                        keys,
                        store,
                        otherRecord,
                    }
                    database.close()
                    resolve(snapshot)
                }
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            }
        })
        return {
            ...databaseSnapshot,
            localStorage: Object.fromEntries(storageKeys.map(key => [key, localStorage.getItem(key)])),
        }
    }, {
        databaseName: DB_NAME,
        databaseVersion: DB_VERSION,
        stateStore: STATE_STORE,
        storeKey: STORE_KEY,
        otherStoreKey: OTHER_STORE_KEY,
        storageKeys: keys,
    })
}

function assertDatabaseContract(snapshot) {
    assert.equal(snapshot.version, DB_VERSION)
    assert.deepEqual(snapshot.objectStores, [STATE_STORE])
    assert.deepEqual([...snapshot.keys].sort(), [OTHER_STORE_KEY, STORE_KEY].sort())
    assert.deepEqual(snapshot.otherRecord, OTHER_STORE_VALUE)
}

function withoutSetIdentity(store) {
    const clone = structuredClone(store)
    for (const disc of clone.driveDiscs ?? []) {
        delete disc.setId
        delete disc.canonicalSetName
    }
    return clone
}

function assertOnlySetIdentityChanged(before, after) {
    assert.deepEqual(withoutSetIdentity(after), withoutSetIdentity(before))
}

function assertCanonicalSetMigration(store) {
    const byId = new Map((store.driveDiscs ?? []).map(disc => [disc.id, disc]))
    for (const id of ["cicd-vow-disc", "cicd-vow-disc-2", "cicd-vow-disc-3", "cicd-vow-disc-4", "cicd-vow-disc-5", "cicd-vow-disc-6"]) {
        assert.equal(byId.get(id)?.setId, "zzz_wiki_2116")
        assert.deepEqual(byId.get(id)?.canonicalSetName, { zhCN: "谶羽之誓" })
    }
    assert.equal(byId.get("cicd-thorn-disc")?.setId, "zzz_wiki_2121")
    assert.deepEqual(byId.get("cicd-thorn-disc")?.canonicalSetName, { zhCN: "棘刺玫瑰" })
    assert.equal(byId.get("cicd-unknown-disc")?.setId, "scanner-set-future")
    assert.equal(byId.get("cicd-unknown-disc")?.canonicalSetName, undefined)
    assert.equal(byId.get("cicd-custom-disc")?.setId, "custom-set-preserve")
    assert.equal(byId.get("cicd-custom-disc")?.canonicalSetName, undefined)
}

function luminescenceEventFromBuild(store) {
    return store?.byOwner?.default?.byAgent?.remielle_dan?.damage?.events
        ?.find(event => event?.settlementType === "luminescence")
}

function assertLuminescenceBuildCompatibility(before, after, { checkAltOwner = true } = {}) {
    assert.equal(after?.version, 2)
    assert.equal(after?.currentOwnerId, "default")
    if (checkAltOwner) assert.deepEqual(after?.byOwner?.alt, before?.byOwner?.alt)
    assert.deepEqual(after?.byOwner?.default?.byAgent?.remielle_dan?.futureBuildField, { preserve: true })
    const beforeEvent = luminescenceEventFromBuild(before)
    const event = luminescenceEventFromBuild(after)
    assert.match(String(event?.id ?? ""), /\S/)
    assert.equal(event?.id, beforeEvent?.id)
    assert.equal(event?.kind, "anomaly")
    assert.equal(event?.settlementType, "luminescence")
    assert.deepEqual(event?.triggerActorRef, { agentId: "remielle_dan" })
    assert.equal(event?.teammateAttack, 3150)
    assert.equal(event?.luminescenceDamageSharePct, 62.5)
}

function stableBuildSnapshot(store) {
    const clone = structuredClone(store)
    for (const owner of Object.values(clone?.byOwner ?? {})) {
        for (const config of Object.values(owner?.byAgent ?? {})) {
            if (config?.lastAnomalySourceSnapshot) {
                delete config.lastAnomalySourceSnapshot.capturedAt
                delete config.lastAnomalySourceSnapshot.sourceConfigHash
            }
        }
    }
    return clone
}

function anomalySnapshotHashes(store) {
    const hashes = {}
    for (const [ownerId, owner] of Object.entries(store?.byOwner ?? {})) {
        for (const [agentId, config] of Object.entries(owner?.byAgent ?? {})) {
            const snapshot = config?.lastAnomalySourceSnapshot
            if (snapshot) hashes[`${ownerId}/${agentId}`] = snapshot.sourceConfigHash
        }
    }
    return hashes
}

function assertSnapshotHashesSynchronized(buildStore, compatibilityStore, phase) {
    const buildHashes = anomalySnapshotHashes(buildStore)
    const compatibilityHashes = anomalySnapshotHashes(compatibilityStore)
    assert(Object.keys(buildHashes).length > 0, `${phase} did not persist an anomaly source snapshot`)
    for (const hash of Object.values(buildHashes)) {
        assert.match(String(hash ?? ""), /^fnv1a-[0-9a-f]{8}$/)
    }
    assert.deepEqual(
        compatibilityHashes,
        buildHashes,
        `${phase} source config hashes diverged between the primary and compatibility stores`,
    )
}

async function visitRelease(page, proxy, target, label, route, readyLocator, pageErrors) {
    proxy.setTarget(target)
    const errorCountBefore = pageErrors.length
    const response = await page.goto(`${PROXY_ORIGIN}${route}?cicd=${encodeURIComponent(label)}-${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
    })
    assert(response, `${label} navigation returned no HTTP response`)
    assert(response.ok(), `${label} navigation returned HTTP ${response.status()}`)
    await page.locator("#app").waitFor({ state: "visible" })
    await readyLocator(page).waitFor({ state: "visible", timeout: 20_000 })
    await page.waitForTimeout(250)
    assert.deepEqual(pageErrors.slice(errorCountBefore), [], `${label} raised a page error`)
}

async function inspectCandidateCatalog(page) {
    const result = await page.evaluate(async () => {
        const response = await fetch("/api/catalog", { cache: "no-store" })
        if (!response.ok) throw new Error(`/api/catalog returned ${response.status}`)
        const catalog = await response.json()
        const sets = Array.isArray(catalog.driveDiscSets) ? catalog.driveDiscSets : []
        const checked = []
        for (const [id, name] of [["zzz_wiki_2116", "谶羽之誓"], ["zzz_wiki_2121", "棘刺玫瑰"]]) {
            const set = sets.find(item => item?.id === id)
            if (!set || set?.name?.zhCN !== name || !set?.images?.icon) {
                throw new Error(`Catalog set ${id} is incomplete`)
            }
            if (!set.twoPiece?.effects?.length || !set.fourPiece) {
                throw new Error(`Catalog effects for ${id} are incomplete`)
            }
            const iconResponse = await fetch(set.images.icon, { cache: "no-store" })
            if (!iconResponse.ok || !String(iconResponse.headers.get("content-type") || "").startsWith("image/")) {
                throw new Error(`Catalog icon for ${id} is unavailable`)
            }
            checked.push({ id, name, icon: set.images.icon })
        }
        return checked
    })
    assert.equal(result.length, 2)
    return result
}

async function writeLuminescenceThroughUi(page) {
    const teammateAttack = page.getByTestId("luminescence-teammate-attack").locator("input")
    const damageShare = page.getByTestId("luminescence-damage-share").locator("input")
    await teammateAttack.waitFor({ state: "visible", timeout: 20_000 })
    await damageShare.waitFor({ state: "visible", timeout: 20_000 })
    await teammateAttack.fill("3150")
    await teammateAttack.press("Tab")
    await damageShare.fill("62.5")
    await damageShare.press("Tab")
    await page.waitForFunction(() => {
        const key = "zzz-calculator.webapp.build.v1"
        const value = JSON.parse(localStorage.getItem(key) || "{}")
        const event = value?.byOwner?.default?.byAgent?.remielle_dan?.damage?.events?.[0]
        return event?.settlementType === "luminescence"
            && event?.teammateAttack === 3150
            && event?.luminescenceDamageSharePct === 62.5
    })
    const serialized = await page.evaluate(() => localStorage.getItem("zzz-calculator.webapp.build.v1"))
    const parsed = JSON.parse(serialized || "{}")
    const config = parsed?.byOwner?.default?.byAgent?.remielle_dan
    const event = config?.damage?.events?.[0]
    assert.equal(event?.settlementType, "luminescence")
    assert.equal(event?.teammateAttack, 3150)
    assert.equal(event?.luminescenceDamageSharePct, 62.5)
    assert.deepEqual(config?.futureBuildField, { preserve: true })
    assert.equal(parsed?.byOwner?.alt?.byAgent?.["agent-alt"]?.futureAltBuildField, "keep")
    return serialized
}

async function waitForStoredTeammateAttack(page, expected) {
    await page.waitForFunction(value => {
        const stored = JSON.parse(localStorage.getItem("zzz-calculator.webapp.build.v1") || "{}")
        return stored?.byOwner?.default?.byAgent?.remielle_dan?.damage?.events?.[0]?.teammateAttack === value
    }, expected)
}

async function assertLuminescenceUi(page, persistRoundTrip = false) {
    const teammateAttack = page.getByTestId("luminescence-teammate-attack").locator("input")
    await teammateAttack.waitFor({ state: "visible", timeout: 20_000 })
    assert.equal(await teammateAttack.inputValue(), "3150")
    assert.equal(await page.getByTestId("luminescence-damage-share").locator("input").inputValue(), "62.5")
    if (persistRoundTrip) {
        await teammateAttack.fill("3160")
        await teammateAttack.press("Tab")
        await waitForStoredTeammateAttack(page, 3160)
        await teammateAttack.fill("3150")
        await teammateAttack.press("Tab")
        await waitForStoredTeammateAttack(page, 3150)
    }
}

async function verifyOptimizerCanComposeSet(page) {
    const fourPieceField = page.locator(".optimizer-set-choice-field").first()
    await fourPieceField.getByRole("button", { name: "选择" }).click()
    const choices = page.locator(".set-choice")
    await choices.filter({ hasText: "谶羽之誓" }).waitFor({ state: "visible" })
    for (const choice of await choices.all()) {
        const checkbox = choice.locator('input[type="checkbox"]')
        const isVow = (await choice.textContent())?.includes("谶羽之誓") === true
        if (isVow && !await checkbox.isChecked()) await checkbox.check()
        if (!isVow && await checkbox.isChecked()) await checkbox.uncheck()
    }
    const applyButton = page.getByRole("button", { name: "应用限制" })
    if (await applyButton.isEnabled()) {
        await applyButton.click()
    } else {
        await page.getByRole("button", { name: "取消" }).click()
    }
    await fourPieceField.getByText("谶羽之誓", { exact: true }).waitFor({ state: "visible" })
    const runButton = page.getByRole("button", { name: "开始优化" })
    assert.equal(await runButton.isEnabled(), true, "optimizer cannot start with the migrated set")
    await runButton.click()
    await page.getByText("已完成", { exact: true }).waitFor({ state: "visible", timeout: 60_000 })
    assert.equal(await page.getByRole("button", { name: "优化结果" }).isEnabled(), true, "optimizer produced no set composition")
}

async function verifyLocalStorageFallback(context, proxy, currentPage, originalFallback) {
    proxy.setTarget(CANDIDATE_ORIGIN)
    const failurePage = await context.newPage()
    const failureErrors = []
    failurePage.on("pageerror", error => failureErrors.push(error.stack || error.message))
    await failurePage.addInitScript(fallbackKey => {
        Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined })
        const originalSetItem = Storage.prototype.setItem
        Storage.prototype.setItem = function setItem(key, value) {
            if (key === fallbackKey) throw new DOMException("CI/CD simulated quota failure", "QuotaExceededError")
            return originalSetItem.call(this, key, value)
        }
    }, "zzz-calculator.userStore.v1")
    await visitRelease(
        failurePage,
        proxy,
        CANDIDATE_ORIGIN,
        "candidate-fallback-write-failure",
        "/discs",
        activePage => activePage.getByText("cicd-vow-disc", { exact: true }),
        failureErrors,
    )
    assert.equal(await failurePage.evaluate(() => localStorage.getItem("zzz-calculator.userStore.v1")), originalFallback)
    const migratedIcon = failurePage.locator('img[src="/assets/drive-discs/zzz_wiki_2116.png"]').first()
    await migratedIcon.waitFor({ state: "visible" })
    await failurePage.close()

    const successPage = await context.newPage()
    const successErrors = []
    successPage.on("pageerror", error => successErrors.push(error.stack || error.message))
    await successPage.addInitScript(() => {
        Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined })
    })
    await visitRelease(
        successPage,
        proxy,
        CANDIDATE_ORIGIN,
        "candidate-fallback-success",
        "/discs",
        activePage => activePage.getByText("cicd-vow-disc", { exact: true }),
        successErrors,
    )
    const migratedFallback = await successPage.evaluate(() => localStorage.getItem("zzz-calculator.userStore.v1"))
    const parsedFallback = JSON.parse(migratedFallback || "null")
    const originalStore = JSON.parse(originalFallback)
    assertOnlySetIdentityChanged(originalStore, parsedFallback)
    assertCanonicalSetMigration(parsedFallback)
    await successPage.reload({ waitUntil: "domcontentloaded" })
    await successPage.getByText("cicd-vow-disc", { exact: true }).waitFor({ state: "visible" })
    assert.equal(await successPage.evaluate(() => localStorage.getItem("zzz-calculator.userStore.v1")), migratedFallback)
    await successPage.close()
    await currentPage.bringToFront()
}

async function inspectCurrentWithoutExecutingApp(page, proxy, currentUrl) {
    proxy.setTarget(currentUrl)
    const result = await page.evaluate(async () => {
        const [healthResponse, homeResponse] = await Promise.all([
            fetch("/api/health", { cache: "no-store" }),
            fetch("/", { cache: "no-store" }),
        ])
        return {
            healthStatus: healthResponse.status,
            health: await healthResponse.json(),
            homeStatus: homeResponse.status,
            home: await homeResponse.text(),
        }
    })
    assert.equal(result.healthStatus, 200)
    assert.deepEqual(result.health, { ok: true, service: "zzz_calculator" })
    assert.equal(result.homeStatus, 200)
    assert.match(result.home, /<div id="app"><\/div>/)
}

async function main() {
    const options = parseArgs(process.argv.slice(2))
    const evidence = {
        status: "failed",
        expectedCommit: options.expectedCommit,
        currentUrl: options.currentUrl,
        proxyOrigin: PROXY_ORIGIN,
        candidateOrigin: CANDIDATE_ORIGIN,
        sequence: [],
    }
    await mkdir(path.dirname(options.evidencePath), { recursive: true })
    await mkdir(path.dirname(options.screenshotPath), { recursive: true })

    const deployedCommit = (await readFile(path.join(options.candidateDir, ".deployed-commit"), "utf8")).trim()
    assert.equal(deployedCommit, options.expectedCommit, "candidate .deployed-commit does not match")

    const requireFromWebapp = createRequire(path.join(options.candidateDir, "webapp", "package.json"))
    const { chromium } = requireFromWebapp("@playwright/test")
    const profileDir = await mkdtemp(path.join(os.tmpdir(), "zzz-cd-browser-"))
    const tracePath = path.join(path.dirname(options.evidencePath), "storage-roundtrip-trace.zip")
    await assertPortFree(8790)
    const candidate = startCandidate(options.candidateDir)
    const proxy = createSwitchingProxy(options.currentUrl)
    let context
    let page
    try {
        const candidateHealth = await waitForUrl(`${CANDIDATE_ORIGIN}/api/health`)
        assert.equal(candidate.child.exitCode, null, "candidate process exited before health verification")
        assert.deepEqual(await candidateHealth.json(), { ok: true, service: "zzz_calculator" })
        const candidateConfigResponse = await fetch(`${CANDIDATE_ORIGIN}/api/app-config`)
        assert.equal(candidateConfigResponse.ok, true)
        const candidateConfig = await candidateConfigResponse.json()
        assert.equal(candidateConfig.maintenanceEnabled, false)
        assert.equal(candidateConfig.scanTelemetryEnabled, false)
        await listen(proxy.server, 8788)

        context = await chromium.launchPersistentContext(profileDir, {
            headless: true,
            viewport: { width: 1440, height: 1000 },
        })
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
        page = context.pages()[0] ?? await context.newPage()
        const pageErrors = []
        page.on("pageerror", error => pageErrors.push(error.stack || error.message))

        const initialStore = inventoryFixture()
        const initialLocalStorage = localStorageFixture(initialStore)
        const storageKeys = Object.keys(initialLocalStorage)
        await seedBrowserStorage(page, initialStore, initialLocalStorage)

        await inspectCurrentWithoutExecutingApp(page, proxy, options.currentUrl)
        const currentBefore = await readBrowserStorage(page, storageKeys)
        assertDatabaseContract(currentBefore)
        assert.deepEqual(currentBefore.store, initialStore)
        for (const [key, value] of Object.entries(initialLocalStorage)) {
            assert.equal(currentBefore.localStorage[key], value, `current release changed localStorage key ${key}`)
        }
        evidence.sequence.push({ release: "current", phase: "seed-and-readonly-baseline", ok: true })

        await visitRelease(
            page,
            proxy,
            CANDIDATE_ORIGIN,
            "candidate-first",
            "/discs",
            activePage => activePage.getByText("cicd-vow-disc", { exact: true }),
            pageErrors,
        )
        const candidateFirst = await readBrowserStorage(page, storageKeys)
        assertDatabaseContract(candidateFirst)
        assertOnlySetIdentityChanged(initialStore, candidateFirst.store)
        assertCanonicalSetMigration(candidateFirst.store)
        const catalogSets = await inspectCandidateCatalog(page)
        await visitRelease(
            page,
            proxy,
            CANDIDATE_ORIGIN,
            "candidate-write-luminescence",
            "/",
            activePage => activePage.getByTestId("luminescence-parameter-fields"),
            pageErrors,
        )
        await writeLuminescenceThroughUi(page)
        await verifyOptimizerCanComposeSet(page)
        const luminescenceValue = await page.evaluate(() => localStorage.getItem("zzz-calculator.webapp.build.v1"))
        const luminescenceStore = JSON.parse(luminescenceValue || "{}")
        assertLuminescenceBuildCompatibility(luminescenceStore, luminescenceStore)
        const candidateLocalAfterWrite = await readBrowserStorage(page, storageKeys)
        assertDatabaseContract(candidateLocalAfterWrite)
        assert.equal(candidateLocalAfterWrite.localStorage["zzz-calculator.webapp.build.v1"], luminescenceValue)
        assert.equal(candidateLocalAfterWrite.localStorage["zzz_maintenance_vue_draft_v3"], initialLocalStorage["zzz_maintenance_vue_draft_v3"])
        assertSnapshotHashesSynchronized(
            luminescenceStore,
            JSON.parse(candidateLocalAfterWrite.localStorage["zzz-calculator.homeSelection.v1"]),
            "first candidate load",
        )
        evidence.sequence.push({ release: "candidate", phase: "first", ok: true, catalogSets })

        await visitRelease(
            page,
            proxy,
            options.currentUrl,
            "current-rollback",
            "/",
            activePage => activePage.getByTestId("luminescence-parameter-fields"),
            pageErrors,
        )
        await assertLuminescenceUi(page, true)
        const rollback = await readBrowserStorage(page, storageKeys)
        assertDatabaseContract(rollback)
        assert.deepEqual(rollback.store, candidateFirst.store, "rollback release changed IndexedDB data")
        const rollbackBuild = JSON.parse(rollback.localStorage["zzz-calculator.webapp.build.v1"])
        const rollbackHome = JSON.parse(rollback.localStorage["zzz-calculator.homeSelection.v1"])
        assertSnapshotHashesSynchronized(rollbackBuild, rollbackHome, "rollback load")
        assertLuminescenceBuildCompatibility(luminescenceStore, rollbackBuild)
        assertLuminescenceBuildCompatibility(luminescenceStore, rollbackHome, { checkAltOwner: false })
        for (const [key, value] of Object.entries(initialLocalStorage)) {
            if (!["zzz-calculator.webapp.build.v1", "zzz-calculator.homeSelection.v1"].includes(key)) {
                assert.equal(rollback.localStorage[key], candidateLocalAfterWrite.localStorage[key], `rollback release changed localStorage key ${key}`)
            }
        }
        evidence.sequence.push({ release: "current", phase: "rollback", ok: true })

        await visitRelease(
            page,
            proxy,
            CANDIDATE_ORIGIN,
            "candidate-second",
            "/",
            activePage => activePage.getByTestId("luminescence-parameter-fields"),
            pageErrors,
        )
        await assertLuminescenceUi(page)
        const candidateSecond = await readBrowserStorage(page, storageKeys)
        assertDatabaseContract(candidateSecond)
        assert.deepEqual(candidateSecond.store, candidateFirst.store, "second candidate load was not idempotent")
        const candidateSecondBuild = JSON.parse(candidateSecond.localStorage["zzz-calculator.webapp.build.v1"])
        const candidateSecondHome = JSON.parse(candidateSecond.localStorage["zzz-calculator.homeSelection.v1"])
        assert.deepEqual(
            stableBuildSnapshot(candidateSecondBuild),
            stableBuildSnapshot(rollbackBuild),
        )
        assert.deepEqual(
            stableBuildSnapshot(candidateSecondHome),
            stableBuildSnapshot(rollbackHome),
        )
        assertSnapshotHashesSynchronized(candidateSecondBuild, candidateSecondHome, "second candidate load")
        assertLuminescenceBuildCompatibility(luminescenceStore, candidateSecondBuild)
        assertCanonicalSetMigration(candidateSecond.store)
        evidence.sequence.push({ release: "candidate", phase: "second", ok: true })
        await verifyLocalStorageFallback(
            context,
            proxy,
            page,
            initialLocalStorage["zzz-calculator.userStore.v1"],
        )
        evidence.sequence.push({ release: "candidate", phase: "localStorage-fallback", ok: true })
        await page.screenshot({ path: options.screenshotPath, fullPage: true })
        evidence.status = "success"
    } catch (error) {
        evidence.status = "failed"
        evidence.error = error instanceof Error ? error.stack || error.message : String(error)
        if (page) await page.screenshot({ path: options.screenshotPath, fullPage: true }).catch(() => {})
        throw error
    } finally {
        if (context) {
            await context.tracing.stop({ path: tracePath }).catch(() => {})
            await context.close().catch(() => {})
        }
        await closeServer(proxy.server).catch(() => {})
        await stopChild(candidate.child)
        await rm(profileDir, { recursive: true, force: true })
        evidence.candidateOutput = candidate.output.join("").slice(-4_000)
        await writeFile(options.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")
    }
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
