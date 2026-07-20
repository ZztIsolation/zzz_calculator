import { createReadStream, createWriteStream } from "node:fs"
import { appendFile, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { pipeline } from "node:stream/promises"
import { createGunzip, createGzip } from "node:zlib"
import { randomUUID } from "node:crypto"

const EVENT_TYPES = new Set(["started", "completed", "failed", "cancelled", "import_failed"])
const CLIENT_TYPES = new Set(["local", "cloud"])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FILE_PATTERN = /^scan-events-(\d{4}-\d{2}-\d{2})\.ndjson(?:\.gz)?$/
const MAX_RANGE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function assertObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ScanTelemetryValidationError(`${name} must be an object.`)
    }
    return value
}

function assertAllowedKeys(value, allowed, name) {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            throw new ScanTelemetryValidationError(`${name}.${key} is not allowed.`)
        }
    }
}

function stringValue(value, name, maxLength, { optional = false, pattern = null } = {}) {
    if ((value === undefined || value === null || value === "") && optional) {
        return ""
    }
    if (typeof value !== "string") {
        throw new ScanTelemetryValidationError(`${name} must be a string.`)
    }
    const next = value.trim()
    if (!next || next.length > maxLength || (pattern && !pattern.test(next))) {
        throw new ScanTelemetryValidationError(`${name} is invalid.`)
    }
    return next
}

function numberValue(value, name, { optional = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    if ((value === undefined || value === null) && optional) {
        return null
    }
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new ScanTelemetryValidationError(`${name} is invalid.`)
    }
    return Math.round(value)
}

function booleanValue(value, name, { optional = false } = {}) {
    if (value === undefined && optional) {
        return null
    }
    if (typeof value !== "boolean") {
        throw new ScanTelemetryValidationError(`${name} must be a boolean.`)
    }
    return value
}

function optionalObject(value, name, allowedKeys) {
    if (value === undefined || value === null) {
        return {}
    }
    const input = assertObject(value, name)
    assertAllowedKeys(input, allowedKeys, name)
    return input
}

function cleanSettings(value) {
    const input = optionalObject(value, "settings", new Set(["rarities", "maxItems", "stopAtNonLevel15"]))
    const rarities = input.rarities === undefined
        ? []
        : Array.isArray(input.rarities)
            ? input.rarities.map((item, index) => stringValue(item, `settings.rarities[${index}]`, 1))
            : (() => { throw new ScanTelemetryValidationError("settings.rarities must be an array.") })()
    if (rarities.some(item => !["S", "A"].includes(item)) || rarities.length > 2) {
        throw new ScanTelemetryValidationError("settings.rarities is invalid.")
    }
    return {
        rarities,
        maxItems: numberValue(input.maxItems ?? 0, "settings.maxItems", { max: 9999 }),
        stopAtNonLevel15: booleanValue(input.stopAtNonLevel15 ?? true, "settings.stopAtNonLevel15"),
    }
}

function cleanVersions(value) {
    const input = optionalObject(value, "versions", new Set([
        "helperVersion", "helperProtocolVersion", "scannerVersion", "scannerFileVersion", "scannerPackageId", "scannerPackageMode",
    ]))
    return {
        helperVersion: stringValue(input.helperVersion, "versions.helperVersion", 32, { optional: true }),
        helperProtocolVersion: numberValue(input.helperProtocolVersion, "versions.helperProtocolVersion", { optional: true, max: 100 }),
        scannerVersion: stringValue(input.scannerVersion, "versions.scannerVersion", 32, { optional: true }),
        scannerFileVersion: stringValue(input.scannerFileVersion, "versions.scannerFileVersion", 64, { optional: true }),
        scannerPackageId: stringValue(input.scannerPackageId, "versions.scannerPackageId", 64, { optional: true }),
        scannerPackageMode: stringValue(input.scannerPackageMode, "versions.scannerPackageMode", 64, { optional: true }),
    }
}

function cleanCounters(value) {
    const input = optionalObject(value, "counters", new Set(["visited", "queued", "completed", "failed"]))
    return {
        visited: numberValue(input.visited ?? 0, "counters.visited", { max: 100000 }),
        queued: numberValue(input.queued ?? 0, "counters.queued", { max: 100000 }),
        completed: numberValue(input.completed ?? 0, "counters.completed", { max: 100000 }),
        failed: numberValue(input.failed ?? 0, "counters.failed", { max: 100000 }),
    }
}

function cleanFailure(value) {
    const input = optionalObject(value, "failure", new Set(["code", "phase", "message", "diagnosticId"]))
    return {
        code: stringValue(input.code, "failure.code", 80, { optional: true }),
        phase: stringValue(input.phase, "failure.phase", 32, { optional: true }),
        message: stringValue(input.message, "failure.message", 500, { optional: true }),
        diagnosticId: stringValue(input.diagnosticId, "failure.diagnosticId", 80, { optional: true }),
    }
}

function cleanDiagnostics(value) {
    const allowed = new Set([
        "logicalRow", "visualRow", "column", "maxColumns", "visibleRois", "totalRois", "acceptGateReason",
        "sawPanelChange", "selectionChanged", "stableFrames", "requiredStableFrames", "attempts", "frameCount",
        "clientWidth", "clientHeight", "dpi", "captureMode", "visualProfileId",
        "preflightState", "visualTransformClass", "anchorScore", "gridScore", "inventoryCountDetected",
        "hueDelta", "saturationDeltaPct", "valueDeltaPct",
    ])
    const input = optionalObject(value, "diagnostics", allowed)
    return {
        logicalRow: numberValue(input.logicalRow, "diagnostics.logicalRow", { optional: true, max: 100000 }),
        visualRow: numberValue(input.visualRow, "diagnostics.visualRow", { optional: true, max: 100 }),
        column: numberValue(input.column, "diagnostics.column", { optional: true, max: 100 }),
        maxColumns: numberValue(input.maxColumns, "diagnostics.maxColumns", { optional: true, max: 100 }),
        visibleRois: numberValue(input.visibleRois, "diagnostics.visibleRois", { optional: true, max: 100 }),
        totalRois: numberValue(input.totalRois, "diagnostics.totalRois", { optional: true, max: 100 }),
        acceptGateReason: stringValue(input.acceptGateReason, "diagnostics.acceptGateReason", 100, { optional: true }),
        sawPanelChange: booleanValue(input.sawPanelChange, "diagnostics.sawPanelChange", { optional: true }),
        selectionChanged: booleanValue(input.selectionChanged, "diagnostics.selectionChanged", { optional: true }),
        stableFrames: numberValue(input.stableFrames, "diagnostics.stableFrames", { optional: true, max: 10000 }),
        requiredStableFrames: numberValue(input.requiredStableFrames, "diagnostics.requiredStableFrames", { optional: true, max: 100 }),
        attempts: numberValue(input.attempts, "diagnostics.attempts", { optional: true, max: 20 }),
        frameCount: numberValue(input.frameCount, "diagnostics.frameCount", { optional: true, max: 100000 }),
        clientWidth: numberValue(input.clientWidth, "diagnostics.clientWidth", { optional: true, max: 20000 }),
        clientHeight: numberValue(input.clientHeight, "diagnostics.clientHeight", { optional: true, max: 20000 }),
        dpi: numberValue(input.dpi, "diagnostics.dpi", { optional: true, max: 1000 }),
        captureMode: stringValue(input.captureMode, "diagnostics.captureMode", 32, { optional: true }),
        visualProfileId: stringValue(input.visualProfileId, "diagnostics.visualProfileId", 100, { optional: true }),
        preflightState: stringValue(input.preflightState, "diagnostics.preflightState", 64, { optional: true }),
        visualTransformClass: stringValue(input.visualTransformClass, "diagnostics.visualTransformClass", 64, { optional: true }),
        anchorScore: numberValue(input.anchorScore, "diagnostics.anchorScore", { optional: true, max: 100 }),
        gridScore: numberValue(input.gridScore, "diagnostics.gridScore", { optional: true, max: 100 }),
        inventoryCountDetected: booleanValue(input.inventoryCountDetected, "diagnostics.inventoryCountDetected", { optional: true }),
        hueDelta: numberValue(input.hueDelta, "diagnostics.hueDelta", { optional: true, max: 180 }),
        saturationDeltaPct: numberValue(input.saturationDeltaPct, "diagnostics.saturationDeltaPct", { optional: true, max: 100 }),
        valueDeltaPct: numberValue(input.valueDeltaPct, "diagnostics.valueDeltaPct", { optional: true, max: 100 }),
    }
}

function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== "" && item !== undefined))
}

export function validateScanTelemetryEvent(value) {
    const input = assertObject(value, "event")
    assertAllowedKeys(input, new Set([
        "schemaVersion", "eventType", "clientId", "sessionId", "client", "settings", "versions", "durationMs", "counters", "failure", "diagnostics",
    ]), "event")
    if (input.schemaVersion !== 1) {
        throw new ScanTelemetryValidationError("schemaVersion must be 1.")
    }
    const eventType = stringValue(input.eventType, "eventType", 32)
    if (!EVENT_TYPES.has(eventType)) {
        throw new ScanTelemetryValidationError("eventType is invalid.")
    }
    const client = stringValue(input.client, "client", 16)
    if (!CLIENT_TYPES.has(client)) {
        throw new ScanTelemetryValidationError("client is invalid.")
    }
    return {
        schemaVersion: 1,
        eventType,
        clientId: stringValue(input.clientId, "clientId", 36, { pattern: UUID_PATTERN }),
        sessionId: stringValue(input.sessionId, "sessionId", 36, { pattern: UUID_PATTERN }),
        client,
        settings: cleanSettings(input.settings),
        versions: compactObject(cleanVersions(input.versions)),
        durationMs: numberValue(input.durationMs, "durationMs", { optional: true, max: 24 * 60 * 60 * 1000 }),
        counters: cleanCounters(input.counters),
        failure: compactObject(cleanFailure(input.failure)),
        diagnostics: compactObject(cleanDiagnostics(input.diagnostics)),
    }
}

export class ScanTelemetryValidationError extends Error {}

function utcDate(value = new Date()) {
    return value.toISOString().slice(0, 10)
}

function parseDate(value, fallback) {
    if (!value) return fallback
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ScanTelemetryValidationError("Date must use YYYY-MM-DD.")
    }
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.valueOf()) || utcDate(parsed) !== value) {
        throw new ScanTelemetryValidationError("Date is invalid.")
    }
    return parsed
}

export function resolveTelemetryRange(query = {}, now = new Date()) {
    const today = new Date(`${utcDate(now)}T00:00:00.000Z`)
    const defaultFrom = new Date(today.valueOf() - 6 * DAY_MS)
    const from = parseDate(query.from, defaultFrom)
    const to = parseDate(query.to, today)
    if (to < from || (to.valueOf() - from.valueOf()) / DAY_MS >= MAX_RANGE_DAYS) {
        throw new ScanTelemetryValidationError("Date range must be between 1 and 30 days.")
    }
    return { from: utcDate(from), to: utcDate(to) }
}

function matchesRange(fileName, range) {
    const match = fileName.match(FILE_PATTERN)
    return match && match[1] >= range.from && match[1] <= range.to
}

async function* readLines(filePath) {
    const source = createReadStream(filePath)
    const input = filePath.endsWith(".gz") ? source.pipe(createGunzip()) : source
    const lines = createInterface({ input, crlfDelay: Infinity })
    for await (const line of lines) {
        if (!line.trim()) continue
        try {
            yield JSON.parse(line)
        } catch {
        }
    }
}

function terminalStatus(eventType) {
    return eventType === "started" ? "started" : eventType
}

function sessionFromTerminal(event, started = null) {
    return {
        sessionId: event.sessionId,
        clientId: event.clientId,
        client: event.client,
        startedAt: started?.receivedAt ?? event.receivedAt,
        finishedAt: event.receivedAt,
        status: terminalStatus(event.eventType),
        durationMs: event.durationMs ?? null,
        settings: event.settings ?? started?.settings ?? {},
        versions: { ...(started?.versions ?? {}), ...(event.versions ?? {}) },
        counters: event.counters ?? started?.counters ?? {},
        failure: event.failure ?? {},
        diagnostics: event.diagnostics ?? {},
        deploymentVersion: event.deploymentVersion ?? started?.deploymentVersion ?? "unknown",
    }
}

function sessionFromStart(event) {
    return {
        sessionId: event.sessionId,
        clientId: event.clientId,
        client: event.client,
        startedAt: event.receivedAt,
        finishedAt: null,
        status: "started",
        durationMs: null,
        settings: event.settings ?? {},
        versions: event.versions ?? {},
        counters: event.counters ?? {},
        failure: {},
        diagnostics: {},
        deploymentVersion: event.deploymentVersion ?? "unknown",
    }
}

function matchesSessionFilters(session, filters = {}) {
    return (!filters.status || session.status === filters.status)
        && (!filters.client || session.client === filters.client)
        && (!filters.scannerVersion || session.versions?.scannerVersion === filters.scannerVersion)
        && (!filters.errorCode || session.failure?.code === filters.errorCode)
        && (!filters.visualTransformClass || session.diagnostics?.visualTransformClass === filters.visualTransformClass)
}

function sessionOrder(left, right) {
    return String(left.startedAt).localeCompare(String(right.startedAt))
        || left.sessionId.localeCompare(right.sessionId)
}

function heapPush(heap, value) {
    heap.push(value)
    let index = heap.length - 1
    while (index > 0) {
        const parent = Math.floor((index - 1) / 2)
        if (sessionOrder(heap[parent], heap[index]) <= 0) break
        ;[heap[parent], heap[index]] = [heap[index], heap[parent]]
        index = parent
    }
}

function heapReplaceOldest(heap, value) {
    heap[0] = value
    let index = 0
    while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let oldest = index
        if (left < heap.length && sessionOrder(heap[left], heap[oldest]) < 0) oldest = left
        if (right < heap.length && sessionOrder(heap[right], heap[oldest]) < 0) oldest = right
        if (oldest === index) break
        ;[heap[index], heap[oldest]] = [heap[oldest], heap[index]]
        index = oldest
    }
}

function percentile(values, ratio) {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))]
}

function incrementCount(counts, key) {
    const normalized = key || "unknown"
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
}

function countEntries(counts) {
    return [...counts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export class ScanTelemetryStore {
    constructor({ directory, retentionDays = 30, deploymentVersion = "unknown", now = () => new Date() }) {
        this.directory = path.resolve(directory)
        this.retentionDays = Math.max(1, Math.min(365, Number(retentionDays) || 30))
        this.deploymentVersion = deploymentVersion
        this.now = now
        this.writeQueue = Promise.resolve()
        this.maintenanceTimer = null
    }

    async init() {
        await mkdir(this.directory, { recursive: true })
        await this.runMaintenance()
        this.maintenanceTimer = setInterval(() => {
            void this.runMaintenance().catch(error => console.error("Scan telemetry maintenance failed:", error))
        }, DAY_MS)
        this.maintenanceTimer.unref?.()
    }

    close() {
        if (this.maintenanceTimer) clearInterval(this.maintenanceTimer)
        this.maintenanceTimer = null
    }

    append(event) {
        const now = this.now()
        const record = {
            recordId: randomUUID(),
            receivedAt: now.toISOString(),
            deploymentVersion: this.deploymentVersion,
            ...event,
        }
        const target = path.join(this.directory, `scan-events-${utcDate(now)}.ndjson`)
        const operation = this.writeQueue.then(async () => {
            await mkdir(this.directory, { recursive: true })
            await appendFile(target, `${JSON.stringify(record)}\n`, "utf8")
            return record
        })
        this.writeQueue = operation.catch(() => {})
        return operation
    }

    async runMaintenance() {
        await this.writeQueue
        await mkdir(this.directory, { recursive: true })
        const files = await readdir(this.directory)
        const today = utcDate(this.now())
        const cutoff = new Date(`${today}T00:00:00.000Z`).valueOf() - (this.retentionDays - 1) * DAY_MS
        for (const fileName of files) {
            const match = fileName.match(FILE_PATTERN)
            if (!match) continue
            const fileDate = new Date(`${match[1]}T00:00:00.000Z`).valueOf()
            const filePath = path.join(this.directory, fileName)
            if (fileDate < cutoff) {
                await rm(filePath, { force: true })
                continue
            }
            if (fileName.endsWith(".ndjson") && match[1] < today) {
                const compressed = `${filePath}.gz`
                const temporary = `${compressed}.${process.pid}.tmp`
                await pipeline(createReadStream(filePath), createGzip(), createWriteStream(temporary))
                await rename(temporary, compressed)
                await rm(filePath, { force: true })
            }
        }
    }

    async *records(range) {
        await this.writeQueue
        const files = (await readdir(this.directory))
            .filter(fileName => matchesRange(fileName, range))
            .sort()
        for (const fileName of files) {
            for await (const record of readLines(path.join(this.directory, fileName))) {
                yield record
            }
        }
    }

    async scanSessions(range, visitor) {
        const pending = new Map()
        const finished = new Set()
        for await (const event of this.records(range)) {
            if (event.eventType === "started") {
                if (!finished.has(event.sessionId)) pending.set(event.sessionId, event)
                continue
            }
            if (finished.has(event.sessionId)) continue
            const started = pending.get(event.sessionId) ?? null
            pending.delete(event.sessionId)
            finished.add(event.sessionId)
            visitor(sessionFromTerminal(event, started))
        }
        for (const event of pending.values()) visitor(sessionFromStart(event))
    }

    async sessions(range, filters = {}) {
        const sessions = []
        await this.scanSessions(range, session => {
            if (matchesSessionFilters(session, filters)) sessions.push(session)
        })
        return sessions.sort((left, right) => sessionOrder(right, left))
    }

    async sessionPage(range, filters = {}, { cursor = 0, limit = 50 } = {}) {
        const offset = Math.max(0, Math.floor(Number(cursor) || 0))
        const pageSize = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)))
        const retain = offset + pageSize
        const newest = []
        let total = 0
        await this.scanSessions(range, session => {
            if (!matchesSessionFilters(session, filters)) return
            total += 1
            if (newest.length < retain) {
                heapPush(newest, session)
            } else if (retain > 0 && sessionOrder(session, newest[0]) > 0) {
                heapReplaceOldest(newest, session)
            }
        })
        const ordered = newest.sort((left, right) => sessionOrder(right, left))
        return {
            sessions: ordered.slice(offset, offset + pageSize),
            total,
            nextCursor: offset + pageSize < total ? String(offset + pageSize) : null,
        }
    }

    async summary(range) {
        const durations = []
        const versions = new Map()
        const errors = new Map()
        const clients = new Map()
        const visualTransforms = new Map()
        const preflightStates = new Map()
        let total = 0
        let startedOnly = 0
        let completed = 0
        let failed = 0
        let cancelled = 0
        await this.scanSessions(range, session => {
            if (session.status === "started") {
                startedOnly += 1
                return
            }
            total += 1
            if (Number.isFinite(session.durationMs)) durations.push(session.durationMs)
            if (session.status === "completed") completed += 1
            if (["failed", "import_failed"].includes(session.status)) failed += 1
            if (session.status === "cancelled") cancelled += 1
            incrementCount(versions, session.versions?.scannerVersion)
            if (session.failure?.code) incrementCount(errors, session.failure.code)
            incrementCount(clients, session.client)
            incrementCount(visualTransforms, session.diagnostics?.visualTransformClass)
            incrementCount(preflightStates, session.diagnostics?.preflightState)
        })
        return {
            range,
            total,
            startedOnly,
            completed,
            failed,
            cancelled,
            successRate: total ? completed / total : 0,
            durationMs: {
                p50: percentile(durations, 0.5),
                p95: percentile(durations, 0.95),
            },
            versions: countEntries(versions),
            errors: countEntries(errors),
            clients: countEntries(clients),
            visualTransforms: countEntries(visualTransforms),
            preflightStates: countEntries(preflightStates),
        }
    }

    async session(range, sessionId) {
        let started = null
        let terminal = null
        for await (const event of this.records(range)) {
            if (event.sessionId !== sessionId) continue
            if (event.eventType === "started") started = event
            else terminal = event
        }
        if (terminal) return sessionFromTerminal(terminal, started)
        return started ? sessionFromStart(started) : null
    }
}

export async function readDeploymentVersion(rootDir) {
    try {
        const value = (await readFile(path.join(rootDir, ".deployed-commit"), "utf8")).trim()
        return value.slice(0, 64) || "unknown"
    } catch {
        return "unknown"
    }
}

export function createScanTelemetryRateLimiter({ max = 60, windowMs = 60_000, now = () => Date.now() } = {}) {
    const clients = new Map()
    return ip => {
        const current = now()
        const previous = clients.get(ip)
        if (!previous || current - previous.startedAt >= windowMs) {
            clients.set(ip, { startedAt: current, count: 1 })
            return true
        }
        previous.count += 1
        if (clients.size > 10_000) {
            for (const [key, value] of clients) {
                if (current - value.startedAt >= windowMs) clients.delete(key)
            }
        }
        return previous.count <= max
    }
}

export async function directorySize(directory) {
    let total = 0
    for (const fileName of await readdir(directory).catch(() => [])) {
        const info = await stat(path.join(directory, fileName)).catch(() => null)
        if (info?.isFile()) total += info.size
    }
    return total
}
