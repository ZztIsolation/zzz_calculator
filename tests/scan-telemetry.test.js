import assert from "node:assert/strict"
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
    createScanTelemetryRateLimiter,
    resolveTelemetryRange,
    ScanTelemetryStore,
    ScanTelemetryValidationError,
    validateScanTelemetryEvent,
} from "../backend/scanTelemetry.js"

function event(eventType, sessionId = "11111111-1111-4111-8111-111111111111") {
    return {
        schemaVersion: 1,
        eventType,
        clientId: "22222222-2222-4222-8222-222222222222",
        sessionId,
        client: "local",
        settings: { rarities: ["S"], maxItems: 30, stopAtNonLevel15: true },
        versions: { helperVersion: "1.2.1", scannerVersion: "1.0.39" },
        durationMs: eventType === "started" ? undefined : 2500,
        counters: { visited: 10, queued: 10, completed: eventType === "completed" ? 10 : 0, failed: 0 },
        failure: eventType === "failed" ? { code: "scan_failed", phase: "scan", message: "timeout" } : {},
        diagnostics: eventType === "failed" ? {
            visibleRois: 10,
            totalRois: 12,
            acceptGateReason: "waiting_for_full_roi",
            preflightState: "accepted",
            visualTransformClass: "contrast_shifted",
            anchorScore: 82,
            gridScore: 67,
            warehouseHeaderDetected: true,
            headerScore: 91,
            gridStructureScore: 84,
            layoutScore: 79,
            inventoryCountDetected: true,
            countConsensusFrames: 2,
            hueDelta: 4,
            saturationDeltaPct: 12,
            valueDeltaPct: 18,
            firstMissingRoi: "subStat4",
            referenceLuma: 22,
            candidateLuma: 31,
            lumaDelta: 9,
            allowedLumaDelta: 18,
            edgeDensityPermille: 0,
            minimumEdgeDensityPermille: 3,
            connectionStage: "websocket",
            permissionName: "loopback-network",
            permissionState: "denied",
            browserName: "Google Chrome",
            browserMajor: "150",
            secureContext: true,
            lastHeartbeatAt: 1753000000000,
            lastProgressAt: 1753000001000,
            exitCode: "0xC0000005",
        } : {},
    }
}

const cleaned = validateScanTelemetryEvent(event("completed"))
assert.equal(cleaned.eventType, "completed")
assert.equal(cleaned.versions.scannerVersion, "1.0.39")
assert.throws(
    () => validateScanTelemetryEvent({ ...event("completed"), driveDiscs: [] }),
    ScanTelemetryValidationError,
)
assert.throws(
    () => validateScanTelemetryEvent({ ...event("completed"), clientId: "not-a-uuid" }),
    ScanTelemetryValidationError,
)
assert.throws(
    () => resolveTelemetryRange({ from: "2026-01-01", to: "2026-02-15" }),
    ScanTelemetryValidationError,
)
assert.throws(
    () => validateScanTelemetryEvent({
        ...event("failed"),
        diagnostics: { ...event("failed").diagnostics, referenceLuma: 256 },
    }),
    ScanTelemetryValidationError,
)
assert.throws(
    () => validateScanTelemetryEvent({
        ...event("failed"),
        diagnostics: { ...event("failed").diagnostics, sampledColor: "#1f1f1f" },
    }),
    ScanTelemetryValidationError,
)

let timestamp = new Date("2026-07-19T10:00:00.000Z")
const directory = await mkdtemp(path.join(os.tmpdir(), "zzz-scan-telemetry-"))
const store = new ScanTelemetryStore({
    directory,
    retentionDays: 30,
    deploymentVersion: "test-commit",
    now: () => timestamp,
})

try {
    await store.init()
    await store.append(validateScanTelemetryEvent(event("started")))
    await store.append(validateScanTelemetryEvent(event("completed")))

    timestamp = new Date("2026-07-20T10:00:00.000Z")
    await store.append(validateScanTelemetryEvent(event("started", "33333333-3333-4333-8333-333333333333")))
    await store.append(validateScanTelemetryEvent(event("failed", "33333333-3333-4333-8333-333333333333")))
    await writeFile(path.join(directory, "scan-events-2026-05-01.ndjson"), "stale\n", "utf8")
    await store.runMaintenance()

    const files = await readdir(directory)
    assert.ok(files.includes("scan-events-2026-07-19.ndjson.gz"))
    assert.ok(files.includes("scan-events-2026-07-20.ndjson"))
    assert.ok(!files.includes("scan-events-2026-05-01.ndjson"))

    const range = { from: "2026-07-19", to: "2026-07-20" }
    const summary = await store.summary(range)
    assert.equal(summary.total, 2)
    assert.equal(summary.completed, 1)
    assert.equal(summary.failed, 1)
    assert.equal(summary.durationMs.p95, 2500)
    assert.equal(summary.versions[0].key, "1.0.39")
    assert.equal(summary.browsers[0].key, "Google Chrome 150")
    assert.equal(summary.connectionStages[0].key, "websocket")
    assert.equal(summary.acceptGateReasons[0].key, "waiting_for_full_roi")
    assert.equal(summary.visualTransformClasses[0].key, "contrast_shifted")
    assert.equal(summary.firstMissingRois[0].key, "subStat4")

    const failed = await store.sessions(range, { status: "failed" })
    assert.equal(failed.length, 1)
    assert.equal(failed[0].diagnostics.visibleRois, 10)
    assert.equal(failed[0].diagnostics.firstMissingRoi, "subStat4")
    assert.equal(failed[0].diagnostics.warehouseHeaderDetected, true)
    assert.equal(failed[0].diagnostics.headerScore, 91)
    assert.equal(failed[0].diagnostics.layoutScore, 79)
    assert.equal(failed[0].diagnostics.countConsensusFrames, 2)
    assert.equal(failed[0].diagnostics.candidateLuma, 31)
    assert.equal(failed[0].diagnostics.lastHeartbeatAt, 1753000000000)
    assert.equal(failed[0].diagnostics.exitCode, "0xC0000005")
    assert.ok(JSON.stringify(failed[0]).length < 16 * 1024)
    assert.equal((await store.session(range, failed[0].sessionId)).failure.code, "scan_failed")

    const firstPage = await store.sessionPage(range, {}, { cursor: 0, limit: 1 })
    assert.equal(firstPage.total, 2)
    assert.equal(firstPage.sessions[0].status, "failed")
    assert.equal(firstPage.nextCursor, "1")
    const secondPage = await store.sessionPage(range, {}, { cursor: 1, limit: 1 })
    assert.equal(secondPage.sessions[0].status, "completed")
    assert.equal(secondPage.nextCursor, null)
} finally {
    store.close()
    await rm(directory, { recursive: true, force: true })
}

let clock = 0
const allow = createScanTelemetryRateLimiter({ max: 2, windowMs: 1000, now: () => clock })
assert.equal(allow("127.0.0.1"), true)
assert.equal(allow("127.0.0.1"), true)
assert.equal(allow("127.0.0.1"), false)
clock = 1000
assert.equal(allow("127.0.0.1"), true)

console.log("scan telemetry tests passed")
