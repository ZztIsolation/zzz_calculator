import { createServer } from "node:http"
import { createHash, randomUUID } from "node:crypto"
import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { createReadStream, existsSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    createScanTelemetryRateLimiter,
    readDeploymentVersion,
    resolveTelemetryRange,
    ScanTelemetryStore,
    ScanTelemetryValidationError,
    validateScanTelemetryEvent,
} from "./scanTelemetry.js"
import { buildMeta, calculateInCombatPanel, calculateOutOfCombatPanel, loadCatalog } from "./calculator.js"
import { analyzeDriveDiscStatDiffs, analyzeDriveDiscStatGains, analyzeDriveDiscSubstats } from "../core/driveDiscAnalysis-core.js"
import { OptimizerCancelledError, optimizeDriveDiscs, optimizeDriveDiscsAsync, previewDriveDiscOptimization } from "./driveDiscOptimizer.js"
import {
    accountSummary,
    clearUserDriveDiscStore,
    createAccount,
    deleteAccount,
    deleteDriveDiscLoadout,
    deleteUserDriveDisc,
    importScannerExportToStore,
    loadCurrentUserDriveDiscStore,
    loadUserDriveDiscStore,
    ownerScopedStore,
    setDriveDiscReservations,
    switchAccount,
    updateAccount,
    upsertDriveDiscLoadout,
    upsertUserDriveDisc,
} from "./driveDiscInventory.js"
import {
    applySystemManagedMaintenanceFields,
    assertValidMaintenanceItem,
    fieldBuffModeOption,
    fieldBuffPhaseName,
    SYSTEM_MANAGED_SKILL_GROUP_COUNTS,
} from "../core/maintenanceValidation.js"
import {
    defaultCalculationVariantName,
    isDefaultCalculationCinemaLevel,
    normalizeDefaultCalculationCinemaLevel,
} from "../core/defaultCalculationConfig.js"
import { normalizeSkillTargetsInValue } from "../core/skillTargets.js"
import { normalizeLegacyEffectAppliesToInValue } from "../core/effectRuleTargets.js"
import { disorderElapsedStepSeconds, normalizeElapsedSeconds } from "../core/damageEventMultipliers.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const dataDir = process.env.ZZZ_CALCULATOR_DATA_DIR
    ? path.resolve(process.env.ZZZ_CALCULATOR_DATA_DIR)
    : path.join(rootDir, "data")
const exampleDir = path.join(rootDir, "examples")
const pagesDir = path.join(rootDir, "dist", "pages")
const port = Number(process.env.PORT || 8787)
const host = String(process.env.HOST || "127.0.0.1").trim() || "127.0.0.1"
const nodeEnv = String(process.env.NODE_ENV ?? "development").toLowerCase()
const DAMAGE_ELEMENTS = new Set(["physical", "fire", "ice", "electric", "ether", "wind"])
const maintenanceAllowedOrigins = new Set(
    String(process.env.MAINTENANCE_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
            try {
                return new URL(value).origin
            } catch {
                return ""
            }
        })
        .filter(Boolean),
)

function envFlag(name) {
    const value = process.env[name]
    if (value === undefined) {
        return null
    }
    if (["1", "true", "yes", "on"].includes(String(value).toLowerCase())) {
        return true
    }
    if (["0", "false", "no", "off"].includes(String(value).toLowerCase())) {
        return false
    }
    return null
}

const scanTelemetryEnabled = envFlag("SCAN_TELEMETRY_ENABLED") === true
const scanTelemetryRetentionDays = Math.max(1, Math.min(365, Number(process.env.SCAN_TELEMETRY_RETENTION_DAYS) || 30))
const scanTelemetryDirectory = path.resolve(process.env.SCAN_TELEMETRY_DIR || path.join(dataDir, "scan-telemetry"))
const scanTelemetryStore = scanTelemetryEnabled
    ? new ScanTelemetryStore({
        directory: scanTelemetryDirectory,
        retentionDays: scanTelemetryRetentionDays,
        deploymentVersion: await readDeploymentVersion(rootDir),
    })
    : null
const scanTelemetryRateLimitMax = Math.max(1, Math.min(1_000_000, Number(process.env.SCAN_TELEMETRY_RATE_LIMIT_MAX) || 60))
const allowScanTelemetryRequest = createScanTelemetryRateLimiter({ max: scanTelemetryRateLimitMax, windowMs: 60_000 })
await scanTelemetryStore?.init()

function isMaintenanceEnabled() {
    return envFlag("MAINTENANCE_ENABLED") ?? nodeEnv !== "production"
}

function maintenanceRequestMethod(req) {
    if (req.method === "OPTIONS") {
        return String(req.headers["access-control-request-method"] ?? "").toUpperCase()
    }
    return String(req.method ?? "GET").toUpperCase()
}

function isMaintenanceWriteRequest(req, pathname) {
    return pathname.startsWith("/api/maintenance/")
        && ["POST", "PUT", "PATCH", "DELETE"].includes(maintenanceRequestMethod(req))
}

function isLoopbackHostname(hostname) {
    const normalized = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "")
    return normalized === "localhost"
        || normalized.endsWith(".localhost")
        || normalized === "::1"
        || /^127(?:\.\d{1,3}){3}$/.test(normalized)
}

function isAllowedMaintenanceOrigin(req) {
    const origin = String(req.headers.origin ?? "").trim()
    if (!origin) {
        return true
    }
    let parsedOrigin
    try {
        parsedOrigin = new URL(origin)
    } catch {
        return false
    }
    return maintenanceAllowedOrigins.has(parsedOrigin.origin)
        || isLoopbackHostname(parsedOrigin.hostname)
}

function applyMaintenanceCors(req, res) {
    const origin = String(req.headers.origin ?? "").trim()
    if (!origin) {
        return
    }
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    res.setHeader("Vary", "Origin")
}

function isLegacyMaintenanceStaticPath(pathname) {
    return pathname === "/maintenance.js"
        || pathname === "/maintenanceValidation.js"
        || pathname === "/maintenanceStats.js"
}

function isRetiredUserDataPath(pathname) {
    return pathname === "/api/accounts"
        || pathname === "/api/accounts/current"
        || pathname.startsWith("/api/accounts/")
        || pathname === "/api/user-drive-discs"
        || pathname.startsWith("/api/user-drive-discs/")
        || pathname === "/api/user-drive-disc-reservations"
        || pathname === "/api/user-drive-disc-loadouts"
        || pathname.startsWith("/api/user-drive-disc-loadouts/")
}

function isDevelopmentDriveDiscReservationPath(pathname) {
    return pathname === "/api/user-drive-disc-reservations"
        || pathname === "/api/user-drive-disc-loadouts"
        || pathname.startsWith("/api/user-drive-disc-loadouts/")
}

function isServerComputePath(pathname) {
    return pathname.startsWith("/api/calculate/")
        || pathname.startsWith("/api/analysis/")
        || pathname.startsWith("/api/optimize/")
}

function createRequestStore(input = {}) {
    const rawStore = input.store && typeof input.store === "object" && !Array.isArray(input.store)
        ? input.store
        : {}
    const ownerId = String(
        input.settings?.ownerId
        ?? input.ownerId
        ?? rawStore.currentOwnerId
        ?? "default",
    ).trim() || "default"
    const owners = Array.isArray(rawStore.owners) && rawStore.owners.some(owner => owner?.id === ownerId)
        ? rawStore.owners
        : [{ id: ownerId, label: ownerId === "default" ? "默认用户" : ownerId }]
    return {
        version: 1,
        updatedAt: rawStore.updatedAt ?? null,
        ...rawStore,
        currentOwnerId: ownerId,
        owners,
        imports: Array.isArray(rawStore.imports) ? rawStore.imports : [],
        driveDiscs: Array.isArray(rawStore.driveDiscs) ? rawStore.driveDiscs : [],
        driveDiscLoadouts: Array.isArray(rawStore.driveDiscLoadouts) ? rawStore.driveDiscLoadouts : [],
    }
}

let catalog = await loadCatalog(dataDir, exampleDir)
const optimizerJobs = new Map()
const OPTIMIZER_JOB_TTL_MS = 10 * 60 * 1000

const maintenanceResources = {
    agents: {
        fileName: "agents.json",
        collectionKey: "agents",
    },
    "agent-skills": {
        fileName: "agent_skills.json",
        collectionKey: "agentSkills",
    },
    "w-engines": {
        fileName: "w_engines.json",
        collectionKey: "wEngines",
    },
    "drive-disc-sets": {
        fileName: "drive_disc_sets.json",
        collectionKey: "sets",
    },
    "field-buffs": {
        fileName: "combat_buffs.json",
        collectionKey: "fieldBuffs",
    },
    "boss-buffs": {
        fileName: "combat_buffs.json",
        collectionKey: "bossBuffs",
    },
    "anomaly-effects": {
        fileName: "anomaly_effects.json",
    },
}

function materializeBossMaintenanceInput(input = {}) {
    const next = applySystemManagedMaintenanceFields(structuredClone(input ?? {}))
    ensureMaintenanceId(next.boss ??= {}, "boss")
    ensureMaintenanceId(next.encounter ??= {}, "boss_encounter")
    for (const group of [next.encounter.playerBuffs ??= [], next.encounter.playerDebuffs ??= []]) {
        for (const entry of group) {
            ensureMaintenanceId(entry, "boss_effect")
            materializeEffectSetIds(entry)
        }
    }
    return next
}

function cleanBossProfile(boss = {}) {
    const next = structuredClone(boss)
    delete next.encounters
    next.name = zhOnly(boss.name)
    next.aliases = [...new Set((boss.aliases ?? []).map(value => String(value).trim()).filter(Boolean))]
    next.images = {
        icon: String(boss.images?.icon ?? "").trim(),
        source: String(boss.images?.source ?? "").trim(),
    }
    next.target = {
        defense: Number(boss.target?.defense),
        weaknessElements: [...new Set(boss.target?.weaknessElements ?? [])],
        resistanceElements: [...new Set(boss.target?.resistanceElements ?? [])],
        resistanceOverrides: Object.fromEntries(Object.entries(boss.target?.resistanceOverrides ?? {}).map(([key, value]) => [key, Number(value)])),
    }
    next.hidden = boss.hidden === true
    return next
}

function cleanBossEncounter(encounter = {}) {
    const next = {
        id: String(encounter.id ?? "").trim(),
        appearances: (encounter.appearances ?? []).map(appearance => ({
            modeId: String(appearance.modeId ?? "").trim(),
            gameVersion: String(appearance.gameVersion ?? "").trim(),
            phaseNo: Number(appearance.phaseNo),
            ...(appearance.startDate ? { startDate: String(appearance.startDate) } : {}),
            ...(appearance.endDate ? { endDate: String(appearance.endDate) } : {}),
        })),
        enemyIntel: zhOnly(encounter.enemyIntel),
        recommendedSpecialties: [...new Set(encounter.recommendedSpecialties ?? [])],
        playerBuffs: [],
        playerDebuffs: [],
        sources: (encounter.sources ?? []).map(item => ({ label: zhOnly(item.label), url: String(item.url ?? "").trim() })),
        hidden: encounter.hidden === true,
    }
    for (const key of ["playerBuffs", "playerDebuffs"]) {
        next[key] = (encounter[key] ?? []).map(entry => ({
            ...entry,
            name: zhOnly(entry.name),
            description: zhOnly(entry.description),
            ...(entry.unmodeledReason ? { unmodeledReason: zhOnly(entry.unmodeledReason) } : {}),
            effects: entry.calculationStatus === "modeled" ? (entry.effects ?? []).map(cleanEffectRule) : [],
        }))
    }
    return next
}

async function saveBossEncounter(input) {
    const materialized = normalizeSkillTargetsInValue(materializeBossMaintenanceInput(input))
    return mutateDataFile("bosses.json", payload => {
        const boss = cleanBossProfile(materialized.boss)
        const encounter = cleanBossEncounter(materialized.encounter)
        const existingBoss = (payload.bosses ?? []).find(item => item.id === boss.id)
        const validationInput = { boss, encounter }
        assertValidMaintenanceItem("boss-buffs", validationInput, {
            bosses: payload.bosses ?? [],
            currentBossId: existingBoss?.id ?? "",
            currentEncounterId: encounter.id,
        })
        const savedBoss = {
            ...(existingBoss ?? {}),
            ...boss,
            encounters: upsertById(existingBoss?.encounters ?? [], encounter),
        }
        const nextPayload = {
            ...payload,
            version: 2,
            bosses: upsertById(payload.bosses ?? [], savedBoss),
        }
        const savedItem = {
            ...encounter,
            bossId: savedBoss.id,
            bossName: savedBoss.name,
            images: savedBoss.images,
            target: savedBoss.target,
        }
        return { payload: nextPayload, value: { payload: nextPayload, savedItem, savedBoss, savedEncounter: encounter } }
    })
}

async function deleteBossMaintenanceItem(bossOrEncounterId, encounterId = "") {
    let deleted = false
    await mutateDataFile("bosses.json", payload => {
        let bosses = payload.bosses ?? []
        if (encounterId) {
            bosses = bosses.map(boss => boss.id === bossOrEncounterId
                ? { ...boss, encounters: deleteById(boss.encounters ?? [], encounterId) }
                : boss)
            deleted = true
        } else if (bosses.some(boss => boss.id === bossOrEncounterId)) {
            bosses = deleteById(bosses, bossOrEncounterId)
            deleted = true
        } else if (bosses.some(boss => (boss.encounters ?? []).some(item => item.id === bossOrEncounterId))) {
            bosses = bosses.map(boss => ({ ...boss, encounters: deleteById(boss.encounters ?? [], bossOrEncounterId) }))
            deleted = true
        }
        return { payload: { ...payload, bosses }, value: payload }
    })
    if (!deleted) {
        await deleteMaintenanceItem("boss-buffs", bossOrEncounterId)
    }
}

function applyDefaultCors(res) {
    if (!res.hasHeader("Access-Control-Allow-Origin")) {
        res.setHeader("Access-Control-Allow-Origin", "*")
    }
    if (!res.hasHeader("Access-Control-Allow-Methods")) {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    }
    if (!res.hasHeader("Access-Control-Allow-Headers")) {
        res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    }
}

function sendJson(res, statusCode, payload) {
    const text = JSON.stringify(payload, null, 2)
    applyDefaultCors(res)
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
    })
    res.end(text)
}

function sendText(res, statusCode, text, contentType) {
    applyDefaultCors(res)
    res.writeHead(statusCode, {
        "Content-Type": contentType,
    })
    res.end(text)
}

function sendRedirect(res, location, statusCode = 308) {
    applyDefaultCors(res)
    res.writeHead(statusCode, {
        "Location": location,
    })
    res.end()
}

class RequestBodyTooLargeError extends Error {}

async function readBody(req, maxBytes = Number.POSITIVE_INFINITY) {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
        total += chunk.length
        if (total > maxBytes) {
            throw new RequestBodyTooLargeError(`Request body exceeds ${maxBytes} bytes.`)
        }
        chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString("utf8")
}

function requestClientIp(req) {
    return String(req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "unknown").trim()
}

function isSameOriginRequest(req) {
    const origin = String(req.headers.origin ?? "").trim()
    if (!origin) return false
    try {
        const parsed = new URL(origin)
        const expectedHost = String(req.headers.host ?? "").trim().toLowerCase()
        const expectedProtocol = String(req.headers["x-forwarded-proto"] ?? (req.socket.encrypted ? "https" : "http"))
            .split(",")[0]
            .trim()
            .toLowerCase()
        return parsed.host.toLowerCase() === expectedHost && parsed.protocol === `${expectedProtocol}:`
    } catch {
        return false
    }
}

function isTelemetryAdminRequest(req) {
    return nodeEnv !== "production" || req.headers["x-scan-telemetry-admin"] === "1"
}

async function readDataFile(fileName) {
    return JSON.parse(await readFile(path.join(dataDir, fileName), "utf8"))
}

async function writeDataFile(fileName, payload) {
    const targetPath = path.join(dataDir, fileName)
    const tempPath = path.join(dataDir, `.${fileName}.${process.pid}.${randomUUID()}.tmp`)
    try {
        await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
        await rename(tempPath, targetPath)
    } finally {
        await rm(tempPath, { force: true }).catch(() => {})
    }
    catalog = await loadCatalog(dataDir, exampleDir)
}

let maintenanceMutationQueue = Promise.resolve()

function mutateDataFile(fileName, mutation) {
    const run = maintenanceMutationQueue.then(async () => {
        const payload = await readDataFile(fileName)
        const result = await mutation(payload)
        await writeDataFile(fileName, result.payload)
        return result.value
    })
    maintenanceMutationQueue = run.then(() => undefined, () => undefined)
    return run
}

function optimizerPercent(metrics = {}, status = "running") {
    if (status === "complete") {
        return 100
    }

    const estimated = Number(metrics.estimatedCombinationCount ?? 0)
    if (estimated <= 0) {
        return 0
    }

    const completed = Number(metrics.processedCombinationCount ?? (Number(metrics.evaluated ?? 0) + Number(metrics.prunedBySuperBound ?? 0)))
    return Math.min(99.9, (completed / estimated) * 100)
}

function optimizerProcessedCombinationCount(metrics = {}) {
    return Number(metrics.processedCombinationCount ?? (Number(metrics.evaluated ?? 0) + Number(metrics.prunedBySuperBound ?? 0)))
}

function cleanupOptimizerJobs() {
    const now = Date.now()
    for (const [id, job] of optimizerJobs.entries()) {
        if (job.finishedAt && now - job.finishedAt > OPTIMIZER_JOB_TTL_MS) {
            optimizerJobs.delete(id)
        }
    }
}

function formatOptimizerJob(job) {
    const metrics = job.result?.metrics ?? job.metrics ?? {}
    const elapsedMs = Math.max(0, (job.finishedAt ?? Date.now()) - job.startedAt)
    return {
        id: job.id,
        jobId: job.id,
        status: job.status,
        elapsedMs,
        evaluated: optimizerProcessedCombinationCount(metrics),
        estimatedCombinationCount: Number(metrics.estimatedCombinationCount ?? 0),
        percent: optimizerPercent(metrics, job.status),
        metrics,
        settings: job.result?.settings ?? job.settings ?? null,
        result: job.result ?? null,
        error: job.error,
    }
}

function createOptimizerJob(store, input) {
    cleanupOptimizerJobs()
    const now = Date.now()
    const job = {
        id: randomId("opt_job"),
        status: "running",
        cancelRequested: false,
        startedAt: now,
        updatedAt: now,
        finishedAt: null,
        metrics: {
            estimatedCombinationCount: 0,
            evaluated: 0,
            processedCombinationCount: 0,
            scoredCombinationCount: 0,
        },
        settings: null,
        result: null,
        error: null,
    }
    optimizerJobs.set(job.id, job)

    job.promise = optimizeDriveDiscsAsync(catalog, store, input, {
        chunkSize: 10000,
        progressIntervalMs: 250,
        shouldCancel: () => job.cancelRequested,
        onProgress: progress => {
            job.metrics = progress.metrics
            job.settings = progress.settings
            job.updatedAt = Date.now()
        },
    })
        .then(result => {
            job.result = result
            job.metrics = result.metrics
            job.settings = result.settings
            job.status = job.cancelRequested ? "cancelled" : "complete"
            job.error = job.cancelRequested ? "计算已取消。" : null
        })
        .catch(error => {
            job.status = error instanceof OptimizerCancelledError || job.cancelRequested ? "cancelled" : "error"
            job.error = error instanceof Error ? error.message : String(error)
        })
        .finally(() => {
            job.finishedAt = Date.now()
            job.updatedAt = job.finishedAt
        })

    return job
}

function requireId(item, label = "item") {
    const id = String(item?.id ?? "").trim()
    if (!id) {
        throw new Error(`${label} id is required.`)
    }

    return id
}

function randomId(prefix) {
    return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 10)}`
}

function stableSlug(value, fallback = "item") {
    const raw = String(value ?? "").trim()
    const slug = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    if (slug) {
        return slug
    }
    const hashSource = raw || fallback
    return `${fallback}_${createHash("sha1").update(hashSource, "utf8").digest("hex").slice(0, 8)}`
}

function zhOnly(value) {
    if (typeof value === "string") {
        return { zhCN: value }
    }

    return {
        zhCN: String(value?.zhCN ?? value?.en ?? "").trim(),
    }
}

function cleanOptionalZh(value) {
    const clean = zhOnly(value)
    return clean.zhCN ? clean : null
}

function cleanImages(images = {}, key = "icon") {
    const imagePath = String(images?.[key] ?? images?.icon ?? images?.portrait ?? "").trim()
    const source = String(images?.source ?? "").trim()
    return {
        ...(imagePath ? { [key]: imagePath } : {}),
        ...(source ? { source } : {}),
    }
}

function cleanEffectRule(effect = {}) {
    const { sourceStat, ...rest } = effect
    const next = {
        ...rest,
        id: rest.id || randomId("effect"),
    }

    if (rest.sourceLabel) {
        next.sourceLabel = zhOnly(rest.sourceLabel)
    }

    return next
}

function cleanBuffModifier(modifier = {}) {
    const next = {
        ...modifier,
        id: modifier.id || randomId("modifier"),
        operation: modifier.operation ?? "multiplyResolvedValue",
    }

    if (modifier.label) {
        next.label = zhOnly(modifier.label)
    }

    next.targetBuffIds = Array.isArray(modifier.targetBuffIds)
        ? modifier.targetBuffIds.map(item => String(item ?? "").trim()).filter(Boolean)
        : []
    next.targetEffectIds = Array.isArray(modifier.targetEffectIds)
        ? modifier.targetEffectIds.map(item => String(item ?? "").trim()).filter(Boolean)
        : []

    return next
}

function cleanBuff(buff = {}) {
    const next = {
        ...buff,
        id: buff.id || randomId("buff"),
        effects: (buff.effects ?? []).map(cleanEffectRule),
        buffModifiers: (buff.buffModifiers ?? []).map(cleanBuffModifier),
    }

    if (buff.name) {
        next.name = zhOnly(buff.name)
    }

    const source = cleanOptionalZh(buff.source ?? buff.sourceLabel)
    if (source) {
        next.source = source
        next.sourceLabel = source
    } else {
        delete next.source
        delete next.sourceLabel
    }

    const description = cleanOptionalZh(buff.description)
    if (description) {
        next.description = description
    } else {
        delete next.description
    }

    if (buff.conditionLabel && typeof buff.conditionLabel === "object") {
        next.conditionLabel = zhOnly(buff.conditionLabel)
    }

    return next
}

function cleanFieldPeriod(period = {}) {
    const modeId = String(period.modeId ?? "").trim()
    const gameVersion = String(period.gameVersion ?? "").trim()
    const phaseNo = Number(period.phaseNo)
    const canonicalPhaseName = fieldBuffPhaseName(phaseNo)
    return {
        modeId,
        gameVersion,
        phaseNo: Number.isFinite(phaseNo) ? phaseNo : period.phaseNo,
        phaseName: canonicalPhaseName ?? zhOnly(period.phaseName),
    }
}

function fieldSourcePeriod(period = {}) {
    const version = String(period.gameVersion ?? "").trim()
    const phase = String(period.phaseName?.zhCN ?? period.phaseName ?? "").trim()
    if (!version || !phase) {
        return null
    }
    return { zhCN: `${version}版本${phase}` }
}

function cleanFieldBuff(buff = {}, options = {}) {
    const originalId = String(options.originalId ?? buff.id ?? "").trim()
    const next = cleanBuff({
        ...buff,
        ...(originalId ? { id: originalId } : {}),
        sourceType: "field",
        scope: "inCombat",
    })
    delete next._maintenanceOriginalId
    next.period = cleanFieldPeriod(buff.period)
    const mode = fieldBuffModeOption(next.period.modeId)
    if (mode?.source) {
        next.source = zhOnly(mode.source)
        delete next.sourceLabel
    }

    const generatedSourcePeriod = fieldSourcePeriod(next.period)
    if (generatedSourcePeriod) {
        next.sourcePeriod = generatedSourcePeriod
    } else {
        delete next.sourcePeriod
    }

    if (!originalId) {
        const versionSlug = String(next.period.gameVersion ?? "").replace(/\./g, "_")
        const nameSlug = stableSlug(next.name?.en ?? next.name?.zhCN ?? next.name, "buff")
        next.id = [
            "field",
            next.period.modeId || "unknown",
            versionSlug ? `v${versionSlug}` : "vunknown",
            next.period.phaseNo ? `p${next.period.phaseNo}` : "punknown",
            nameSlug,
        ].join(".")
    } else {
        next.id = originalId
    }

    return next
}

function cleanBossBuff(buff = {}) {
    const next = cleanBuff({
        ...buff,
        sourceType: "boss",
        scope: "inCombat",
    })

    next.bossName = zhOnly(buff.bossName)
    next.bossSource = zhOnly(buff.bossSource)
    if (buff.sourcePeriod) {
        next.sourcePeriod = zhOnly(buff.sourcePeriod)
    } else {
        delete next.sourcePeriod
    }

    delete next.source
    delete next.sourceLabel
    return next
}

function cleanEffectSet(effect = {}) {
    if (!effect) {
        return effect
    }

    return {
        ...effect,
        ...(Array.isArray(effect.stats)
            ? {
                stats: effect.stats.map(stat => ({
                    ...stat,
                })),
            }
            : {}),
        effects: (effect.effects ?? []).map(cleanEffectRule),
        buffModifiers: (effect.buffModifiers ?? []).map(cleanBuffModifier),
    }
}

function cleanDriveDiscEffectSet(effect = {}) {
    if (!effect) {
        return effect
    }

    const { scope, appliesToOutOfCombatPanel, ...rest } = cleanEffectSet(effect)
    return rest
}

function cleanDriveDiscFourPiece(fourPiece = {}) {
    if (!fourPiece) {
        return fourPiece
    }

    const selfBuff = fourPiece.selfBuff ?? (
        (fourPiece.effects?.length || fourPiece.stats?.length || fourPiece.statsByPhase)
            ? {
                condition: fourPiece.condition ?? null,
                durationSeconds: fourPiece.durationSeconds ?? null,
                cooldownSeconds: fourPiece.cooldownSeconds ?? null,
                ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
                effects: fourPiece.effects ?? fourPiece.stats ?? [],
            }
            : null
    )
    const {
        scope,
        appliesToOutOfCombatPanel,
        effects,
        stats,
        statsByPhase,
        condition,
        durationSeconds,
        cooldownSeconds,
        coverage,
        ...rest
    } = fourPiece

    return {
        ...rest,
        selfBuff: selfBuff ? cleanDriveDiscEffectSet(selfBuff) : selfBuff,
        teamBuff: fourPiece.teamBuff ? cleanDriveDiscEffectSet(fourPiece.teamBuff) : fourPiece.teamBuff,
    }
}

function cleanAgentCombatBuff(buff) {
    if (!buff) {
        return buff
    }

    const next = cleanEffectSet(buff)
    if (next.name) {
        next.name = zhOnly(next.name)
    }
    if (next.conditionLabel) {
        next.conditionLabel = zhOnly(next.conditionLabel)
    }

    const description = cleanOptionalZh(next.description)
    if (description) {
        next.description = description
    } else {
        delete next.description
    }

    return next
}

function cleanAgentCinemaBuff(buff) {
    if (!buff) {
        return buff
    }

    const next = cleanAgentCombatBuff({
        ...buff,
        scope: buff.scope ?? "inCombat",
        defaultChecked: buff.defaultChecked ?? false,
    })
    next.cinemaLevel = Number(next.cinemaLevel)

    if (next.cinemaName) {
        next.cinemaName = zhOnly(next.cinemaName)
    }

    return next
}

function cleanPreferredDriveDiscs(preferredDriveDiscs = null) {
    if (!preferredDriveDiscs || typeof preferredDriveDiscs !== "object" || Array.isArray(preferredDriveDiscs)) {
        return null
    }
    const defaultSetId = String(preferredDriveDiscs.defaultSetId ?? preferredDriveDiscs.defaultSet ?? "").trim()
    const source = preferredDriveDiscs.mainStatLimits
        ?? preferredDriveDiscs.mainStats
        ?? preferredDriveDiscs
    const mainStatLimits = {}
    for (const slot of ["4", "5", "6"]) {
        const raw = source?.[slot] ?? source?.[Number(slot)] ?? []
        const values = Array.isArray(raw) ? raw : raw ? [raw] : []
        mainStatLimits[slot] = [...new Set(values.filter(Boolean).map(String))]
    }
    const hasMainStatLimits = Object.values(mainStatLimits).some(values => values.length)
    if (!defaultSetId && !hasMainStatLimits) {
        return null
    }
    return {
        ...(defaultSetId ? { defaultSetId } : {}),
        ...(hasMainStatLimits ? { mainStatLimits } : {}),
    }
}

function cleanCalculationSkillRef(skillRef = null) {
    if (!skillRef || typeof skillRef !== "object" || Array.isArray(skillRef)) {
        return null
    }
    const result = {
        agentSkillId: String(skillRef.agentSkillId ?? "").trim(),
        categoryId: String(skillRef.categoryId ?? "").trim(),
        moveId: String(skillRef.moveId ?? "").trim(),
        rowId: String(skillRef.rowId ?? "").trim(),
    }
    return Object.values(result).every(Boolean) ? result : null
}

function cleanCalculationEvent(event = {}, index = 0, options = {}) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null
    }
    if (event.kind === "skillGroup" && !options.allowSkillGroup) {
        return null
    }
    const inputKind = ["direct", "sheer", "anomaly", "disorder", ...(options.allowSkillGroup ? ["skillGroup"] : [])].includes(event.kind)
        ? event.kind
        : "direct"
    if (inputKind === "skillGroup") {
        const id = String(event.id ?? `skill-group-${index + 1}`).trim() || `skill-group-${index + 1}`
        const skillGroupId = String(event.skillGroupId ?? event.groupId ?? "").trim()
        const count = Number(event.count ?? 1)
        if (!skillGroupId || (options.skillGroupIds instanceof Set && !options.skillGroupIds.has(skillGroupId))) {
            return null
        }
        return {
            id,
            kind: "skillGroup",
            skillGroupId,
            count: Number.isFinite(count) ? Math.max(0, count) : 1,
            stunned: event.stunned === undefined ? true : Boolean(event.stunned),
        }
    }
    const settlementType = inputKind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
    const kind = inputKind === "direct" || inputKind === "sheer" ? inputKind : "anomaly"
    const id = String(event.id ?? `${kind}-${index + 1}`).trim() || `${kind}-${index + 1}`
    const count = Number(event.count ?? 1)
    const base = {
        id,
        kind,
        count: Number.isFinite(count) ? Math.max(0, count) : 1,
        stunned: event.stunned === undefined ? true : Boolean(event.stunned),
    }
    const damageRatioPct = Number(event.damageRatioPct)
    if (event.damageRatioPct !== undefined && Number.isFinite(damageRatioPct)) {
        base.damageRatioPct = Math.max(0, damageRatioPct)
    }
    const eventLabel = String(event.label ?? "").trim()
    if (eventLabel) {
        base.label = eventLabel
    }
    if (kind === "direct" || kind === "sheer") {
        const skillRef = cleanCalculationSkillRef(event.skillRef)
        const result = {
            ...base,
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode) ? event.critMode : "expected",
        }
        if (["atk", "anomalyProficiency"].includes(event.damageBasis)) {
            result.damageBasis = event.damageBasis
        }
        if (skillRef) {
            result.skillRef = skillRef
            return result
        }
        const skillMultiplier = Number(event.skillMultiplier ?? 100)
        result.skillMultiplier = Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 100
        const damageElement = String(event.damageElement ?? "").trim()
        if (DAMAGE_ELEMENTS.has(damageElement)) {
            result.damageElement = damageElement
        }
        return result
    }
    if (kind === "anomaly") {
        if (settlementType === "disorder") {
            return {
                ...base,
                settlementType: "disorder",
                anomalyEffect: String(event.anomalyEffect ?? event.previousAnomalyEffect ?? "").trim(),
                disorderType: ["normal", "polarized"].includes(event.disorderType) ? event.disorderType : "normal",
                elapsedSeconds: normalizeElapsedSeconds(
                    event.elapsedSeconds,
                    Number.POSITIVE_INFINITY,
                    disorderElapsedStepSeconds(event, options),
                ),
            }
        }
        const procCount = Number(event.procCount ?? 1)
        return {
            ...base,
            settlementType: "attribute",
            anomalyEffect: String(event.anomalyEffect ?? "").trim(),
            anomalyVariant: event.anomalyVariant === "polarizedAssault" ? "polarizedAssault" : "normal",
            procCount: Number.isFinite(procCount) ? Math.max(0, procCount) : 1,
        }
    }
    return null
}

function legacySkillGroupCount(config = {}, group = {}) {
    const presets = Array.isArray(config.skillGroupPresets)
        ? config.skillGroupPresets.filter(preset => preset && typeof preset === "object" && !Array.isArray(preset))
        : []
    const selectedPresetId = String(config.defaultSkillGroupPresetId ?? "").trim()
    const preset = presets.find(item => String(item.id ?? "").trim() === selectedPresetId) ?? presets[0] ?? null
    const presetCount = preset?.counts && typeof preset.counts === "object" && !Array.isArray(preset.counts)
        ? Number(preset.counts[group.id])
        : Number.NaN
    return Number.isFinite(presetCount) ? Math.max(0, presetCount) : Number(group.defaultCount ?? 0)
}

function legacySkillGroupReferenceEvents(config = {}, skillGroups = []) {
    return skillGroups.map((group, index) => ({
        id: `${group.id}-ref-${index + 1}`,
        kind: "skillGroup",
        skillGroupId: group.id,
        count: legacySkillGroupCount(config, group),
    }))
}

function cleanDefaultCalculationConfigEntry(config = null, skillGroups = [], options = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return null
    }
    const skillGroupIds = new Set(skillGroups.map(group => group.id).filter(Boolean))
    let events = Array.isArray(config.events)
        ? config.events.map((event, index) => cleanCalculationEvent(event, index, {
            ...options,
            allowSkillGroup: true,
            skillGroupIds,
        })).filter(Boolean)
        : []
    if (!events.length && skillGroups.length) {
        events = legacySkillGroupReferenceEvents(config, skillGroups)
            .map((event, index) => cleanCalculationEvent(event, index, {
                ...options,
                allowSkillGroup: true,
                skillGroupIds,
            }))
            .filter(Boolean)
    }
    if (!events.length) {
        return null
    }
    const mode = ["single", "sheer", "anomaly", "custom"].includes(config.mode) ? config.mode : "custom"
    const selectedEventId = String(config.selectedEventId ?? events[0]?.id ?? "").trim()
    const cinemaLevel = normalizeDefaultCalculationCinemaLevel(config.cinemaLevel, options.defaultCinemaLevel ?? 0)
    const name = config.name ? zhOnly(config.name) : defaultCalculationVariantName(cinemaLevel)
    const result = {
        mode,
        ...(options.includeCinemaLevel ? { cinemaLevel } : {}),
        ...(name ? { name } : {}),
        events,
    }
    if (events.length) {
        result.selectedEventId = events.some(event => event.id === selectedEventId) ? selectedEventId : events[0].id
    }
    return result
}

function cleanDefaultCalculationConfig(config = null, skillGroups = [], options = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return null
    }
    const rawVariants = Array.isArray(config.variants) ? config.variants : []
    const baseConfig = cleanDefaultCalculationConfigEntry(config, skillGroups, {
        ...options,
        defaultCinemaLevel: 0,
        includeCinemaLevel: config.cinemaLevel !== undefined || rawVariants.length > 0,
    })
    if (!baseConfig) {
        return null
    }
    const seenLevels = new Set([Number(baseConfig.cinemaLevel ?? 0)])
    const variants = rawVariants
        .map(variant => {
            if (!variant || typeof variant !== "object" || Array.isArray(variant) || !isDefaultCalculationCinemaLevel(variant.cinemaLevel)) {
                return null
            }
            const cinemaLevel = Number(variant.cinemaLevel)
            if (seenLevels.has(cinemaLevel)) {
                return null
            }
            const cleanVariant = cleanDefaultCalculationConfigEntry(variant, skillGroups, {
                ...options,
                defaultCinemaLevel: cinemaLevel,
                includeCinemaLevel: true,
            })
            if (cleanVariant) {
                seenLevels.add(cinemaLevel)
            }
            return cleanVariant
        })
        .filter(Boolean)
        .sort((left, right) => Number(left.cinemaLevel ?? 0) - Number(right.cinemaLevel ?? 0))
    if (variants.length) {
        baseConfig.variants = variants
    }
    return baseConfig
}

function cleanCalculationSkillGroups(groups = [], options = {}) {
    if (!Array.isArray(groups)) {
        return []
    }
    return groups
        .map((group, index) => {
            if (!group || typeof group !== "object" || Array.isArray(group)) {
                return null
            }
            const id = String(group.id ?? "").trim()
            const events = Array.isArray(group.events)
                ? group.events.map((event, eventIndex) => cleanCalculationEvent(event, eventIndex, {
                    ...options,
                    allowSkillGroup: false,
                })).filter(Boolean)
                : []
            if (!id || !events.length) {
                return null
            }
            return {
                id,
                ...(group.name ? { name: zhOnly(group.name) } : {}),
                ...(cleanOptionalZh(group.description) ? { description: cleanOptionalZh(group.description) } : {}),
                ...SYSTEM_MANAGED_SKILL_GROUP_COUNTS,
                events,
            }
        })
        .filter(Boolean)
}

function mergeCalculationSkillGroups(primaryGroups = [], legacyGroups = []) {
    const groups = []
    const seen = new Set()
    for (const group of [...primaryGroups, ...legacyGroups]) {
        if (!group?.id || seen.has(group.id)) {
            continue
        }
        seen.add(group.id)
        groups.push(group)
    }
    return groups
}

function cleanAgent(item = {}, options = {}) {
    const preferredDriveDiscs = cleanPreferredDriveDiscs(item.preferredDriveDiscs)
    const skillGroups = mergeCalculationSkillGroups(
        cleanCalculationSkillGroups(item.skillGroups, options),
        cleanCalculationSkillGroups(item.defaultCalculationConfig?.skillGroups, options),
    )
    const defaultCalculationConfig = cleanDefaultCalculationConfig(item.defaultCalculationConfig, skillGroups, options)
    const next = {
        ...item,
        name: zhOnly(item.name),
        combatBuffs: item.combatBuffs
            ? {
                ...item.combatBuffs,
                corePassive: cleanAgentCombatBuff(item.combatBuffs.corePassive),
                additionalAbility: cleanAgentCombatBuff(item.combatBuffs.additionalAbility),
                cinemaBuffs: (item.combatBuffs.cinemaBuffs ?? [])
                    .map(cleanAgentCinemaBuff)
                    .filter(Boolean),
            }
            : item.combatBuffs,
    }
    if (preferredDriveDiscs) {
        next.preferredDriveDiscs = preferredDriveDiscs
    } else {
        delete next.preferredDriveDiscs
    }
    if (skillGroups.length) {
        next.skillGroups = skillGroups
    } else {
        delete next.skillGroups
    }
    if (defaultCalculationConfig) {
        next.defaultCalculationConfig = defaultCalculationConfig
    } else {
        delete next.defaultCalculationConfig
    }
    return next
}

function cleanWEngine(item = {}) {
    const effect = item.effect
    const selfBuff = effect?.selfBuff ?? effect?.buff
    const teamBuff = effect?.teamBuff
    const { buff, ...effectRest } = effect ?? {}
    return {
        ...item,
        name: zhOnly(item.name),
        effect: effect
            ? {
                ...effectRest,
                name: effect.name ? zhOnly(effect.name) : effect.name,
                selfBuff: selfBuff ? cleanEffectSet(selfBuff) : selfBuff,
                teamBuff: teamBuff ? cleanEffectSet(teamBuff) : teamBuff,
            }
            : effect,
    }
}

function cleanAgentSkill(item = {}) {
    return {
        ...item,
        categories: (item.categories ?? []).map(category => {
            const { icon, ...categoryRest } = category ?? {}
            return categoryRest
        }),
    }
}

function cleanDriveDiscSet(item = {}) {
    return {
        ...item,
        name: zhOnly(item.name),
        twoPiece: item.twoPiece ? cleanDriveDiscEffectSet(item.twoPiece) : item.twoPiece,
        fourPiece: item.fourPiece ? cleanDriveDiscFourPiece(item.fourPiece) : item.fourPiece,
    }
}

function cleanAnomalyEffect(item = {}) {
    return {
        id: requireId(item),
        settlementType: "attribute",
        label: zhOnly(item.label),
        element: item.element,
        baseMultiplier: Number(item.baseMultiplier ?? 0),
        defaultProcCount: Number(item.defaultProcCount ?? 1),
    }
}

function cleanDisorderEffect(item = {}) {
    return {
        id: requireId(item),
        settlementType: "disorder",
        label: zhOnly(item.label),
        element: item.element,
        fixedMultiplier: Number(item.fixedMultiplier ?? 0),
        tickMultiplier: Number(item.tickMultiplier ?? 0),
        tickIntervalSeconds: Number(item.tickIntervalSeconds ?? 1),
        defaultDurationSeconds: Number(item.defaultDurationSeconds ?? 10),
    }
}

function anomalyMaintenanceType(itemOrType = {}) {
    const raw = typeof itemOrType === "string"
        ? itemOrType
        : itemOrType?.settlementType ?? itemOrType?.maintenanceType
    return raw === "disorder" ? "disorder" : "attribute"
}

function anomalyMaintenanceTypeForUi(itemOrType = {}) {
    return anomalyMaintenanceType(itemOrType) === "disorder" ? "disorder" : "anomaly"
}

function rawAnomalyEffectsFromPayload(payload = {}) {
    if (Array.isArray(payload.effects)) {
        return payload.effects
    }
    return [
        ...(payload.anomalyEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "attribute",
        })),
        ...(payload.disorderEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "disorder",
        })),
    ]
}

function anomalyPayloadWithEffects(payload = {}, effects = []) {
    const next = {
        ...payload,
        effects,
    }
    delete next.anomalyEffects
    delete next.disorderEffects
    return next
}

function anomalyEffectsForType(payload = {}, type = "attribute") {
    return rawAnomalyEffectsFromPayload(payload)
        .filter(effect => anomalyMaintenanceType(effect) === type)
}

function upsertAnomalyEffect(items, item) {
    const id = requireId(item)
    const settlementType = anomalyMaintenanceType(item)
    const next = [...items]
    const index = next.findIndex(entry => entry.id === id && anomalyMaintenanceType(entry) === settlementType)
    if (index >= 0) {
        next[index] = item
    } else {
        next.push(item)
    }
    return next
}

function deleteAnomalyEffectByType(items, type, id) {
    const settlementType = anomalyMaintenanceType(type)
    return items.filter(item => !(item.id === id && anomalyMaintenanceType(item) === settlementType))
}

export function cleanMaintenanceItem(resource, item, options = {}) {
    item = normalizeLegacyEffectAppliesToInValue(
        normalizeSkillTargetsInValue(applySystemManagedMaintenanceFields(structuredClone(item ?? {}))),
    )
    if (resource === "combat-buffs") {
        return cleanBuff(item)
    }
    if (resource === "field-buffs") {
        return cleanFieldBuff(item, options)
    }
    if (resource === "boss-buffs") {
        return cleanBossBuff(item)
    }
    if (resource === "agent-skills") {
        return cleanAgentSkill(item)
    }
    if (resource === "w-engines") {
        return cleanWEngine(item)
    }
    if (resource === "drive-disc-sets") {
        return cleanDriveDiscSet(item)
    }
    if (resource === "agents") {
        return cleanAgent(item, options)
    }
    return item
}

function cleanTeammate(teammate = {}) {
    const images = cleanImages(teammate.images, "icon")
    const next = {
        ...teammate,
        name: zhOnly(teammate.name),
        attribute: String(teammate.attribute ?? "").trim(),
        specialty: String(teammate.specialty ?? "").trim(),
    }
    if (Object.keys(images).length) {
        next.images = images
    } else {
        delete next.images
    }
    return next
}

function upsertById(items, item) {
    const id = requireId(item)
    const next = [...items]
    const index = next.findIndex(entry => entry.id === id)
    if (index >= 0) {
        next[index] = item
    } else {
        next.push(item)
    }

    return next
}

function reorderByExactIds(items, requestedOrder, label = "条目") {
    if (requestedOrder === undefined) {
        return items
    }
    if (!Array.isArray(requestedOrder)) {
        throw new Error(`${label}顺序必须是完整的 ID 数组。`)
    }

    const order = requestedOrder.map(id => String(id ?? "").trim())
    const itemEntries = items.map(item => [requireId(item), item])
    const itemIds = itemEntries.map(([id]) => id)
    const uniqueOrder = new Set(order)
    const itemById = new Map(itemEntries)
    const isExactOrder = order.length === itemIds.length
        && uniqueOrder.size === order.length
        && order.every(id => id && itemById.has(id))

    if (!isExactOrder) {
        throw new Error(`${label}顺序已过期或不完整，请刷新维护页后重试。`)
    }
    return order.map(id => itemById.get(id))
}

function ensureMaintenanceId(item, prefix) {
    if (item && typeof item === "object" && !Array.isArray(item) && !String(item.id ?? "").trim()) {
        item.id = randomId(prefix)
    }
    return item
}

function materializeEffectSetIds(effect) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
        return effect
    }
    if (Array.isArray(effect.effects)) {
        effect.effects = effect.effects.map(rule => ensureMaintenanceId(rule, "effect"))
    }
    if (Array.isArray(effect.buffModifiers)) {
        effect.buffModifiers = effect.buffModifiers.map(modifier => ensureMaintenanceId(modifier, "modifier"))
    }
    return effect
}

function materializeCalculationEventIds(events = []) {
    return Array.isArray(events)
        ? events.map(event => ensureMaintenanceId(event, "event"))
        : events
}

function materializeCalculationConfigIds(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return config
    }
    config.events = materializeCalculationEventIds(config.events)
    if (Array.isArray(config.variants)) {
        config.variants = config.variants.map(variant => materializeCalculationConfigIds(variant))
    }
    return config
}

function materializeAgentIds(item) {
    ensureMaintenanceId(item, "agent")
    const combatBuffs = item.combatBuffs ?? {}
    materializeEffectSetIds(combatBuffs.corePassive)
    materializeEffectSetIds(combatBuffs.additionalAbility)
    if (Array.isArray(combatBuffs.cinemaBuffs)) {
        combatBuffs.cinemaBuffs.forEach(materializeEffectSetIds)
    }
    if (Array.isArray(item.skillGroups)) {
        item.skillGroups = item.skillGroups.map(group => {
            ensureMaintenanceId(group, "skill_group")
            group.events = materializeCalculationEventIds(group.events)
            return group
        })
    }
    materializeCalculationConfigIds(item.defaultCalculationConfig)
    return item
}

function materializeAgentSkillIds(item) {
    ensureMaintenanceId(item, "agent_skill")
    if (!Array.isArray(item.categories)) {
        return item
    }
    item.categories = item.categories.map(category => {
        ensureMaintenanceId(category, "skill_category")
        if (Array.isArray(category.moves)) {
            category.moves = category.moves.map(move => {
                ensureMaintenanceId(move, "skill_move")
                if (Array.isArray(move.rows)) {
                    move.rows = move.rows.map(row => ensureMaintenanceId(row, "skill_row"))
                }
                return move
            })
        }
        return category
    })
    return item
}

function materializeWEngineIds(item) {
    ensureMaintenanceId(item, "w_engine")
    materializeEffectSetIds(item.effect?.selfBuff ?? item.effect?.buff)
    materializeEffectSetIds(item.effect?.teamBuff)
    return item
}

function materializeDriveDiscSetIds(item) {
    ensureMaintenanceId(item, "drive_disc_set")
    materializeEffectSetIds(item.twoPiece)
    materializeEffectSetIds(item.fourPiece)
    materializeEffectSetIds(item.fourPiece?.selfBuff)
    materializeEffectSetIds(item.fourPiece?.teamBuff)
    return item
}

function materializeBuffIds(item, prefix = "buff") {
    ensureMaintenanceId(item, prefix)
    materializeEffectSetIds(item)
    return item
}

function materializeMaintenanceItem(resource, input = {}) {
    const item = applySystemManagedMaintenanceFields(structuredClone(input ?? {}))
    if (resource === "agents") {
        return materializeAgentIds(item)
    }
    if (resource === "agent-skills") {
        return materializeAgentSkillIds(item)
    }
    if (resource === "w-engines") {
        return materializeWEngineIds(item)
    }
    if (resource === "drive-disc-sets") {
        return materializeDriveDiscSetIds(item)
    }
    if (resource === "anomaly-effects") {
        const prefix = item.settlementType === "disorder" || item.maintenanceType === "disorder"
            ? "disorder"
            : "anomaly"
        return ensureMaintenanceId(item, prefix)
    }
    if (resource === "field-buffs") {
        materializeEffectSetIds(item)
        return item
    }
    if (resource === "boss-buffs") {
        return materializeBuffIds(item, "boss_buff")
    }
    return item
}

function materializeTeammateBuffInput(input = {}) {
    const next = applySystemManagedMaintenanceFields(structuredClone(input ?? {}))
    ensureMaintenanceId(next.teammate ??= {}, "teammate")
    materializeBuffIds(next.buff ??= {}, "buff")
    return next
}

function existingMaintenanceOriginalId(item = {}, items = []) {
    const originalId = String(item?._maintenanceOriginalId ?? "").trim()
    return originalId && items.some(entry => entry?.id === originalId) ? originalId : ""
}

function deleteById(items, id) {
    return items.filter(item => item.id !== id)
}

function anomalyMaintenanceCollectionKey(itemOrType = {}) {
    return anomalyMaintenanceType(itemOrType) === "disorder" ? "disorderEffects" : "anomalyEffects"
}

function cleanAnomalyMaintenanceItem(item = {}) {
    const settlementType = anomalyMaintenanceType(item)
    const maintenanceType = anomalyMaintenanceTypeForUi(item)
    const cleaned = settlementType === "disorder"
        ? cleanDisorderEffect(item)
        : cleanAnomalyEffect(item)
    return {
        settlementType,
        maintenanceType,
        cleaned,
        savedItem: {
            ...cleaned,
            maintenanceType,
        },
    }
}

async function saveAnomalyMaintenanceItem(input) {
    const item = materializeMaintenanceItem("anomaly-effects", input)
    return mutateDataFile("anomaly_effects.json", payload => {
        const settlementType = anomalyMaintenanceType(item)
        assertValidMaintenanceItem("anomaly-effects", item, {
            items: anomalyEffectsForType(payload, settlementType),
            currentId: item?.id,
        })
        const { cleaned, savedItem } = cleanAnomalyMaintenanceItem(item)
        const nextPayload = anomalyPayloadWithEffects(
            payload,
            upsertAnomalyEffect(rawAnomalyEffectsFromPayload(payload), cleaned),
        )
        return {
            payload: nextPayload,
            value: {
                payload: nextPayload,
                savedItem,
            },
        }
    })
}

async function deleteAnomalyMaintenanceItem(maintenanceType, id) {
    return mutateDataFile("anomaly_effects.json", payload => {
        const nextPayload = anomalyPayloadWithEffects(
            payload,
            deleteAnomalyEffectByType(rawAnomalyEffectsFromPayload(payload), maintenanceType, id),
        )
        return { payload: nextPayload, value: nextPayload }
    })
}

async function saveMaintenanceItem(resource, item) {
    if (resource === "anomaly-effects") {
        return saveAnomalyMaintenanceItem(item)
    }

    item = materializeMaintenanceItem(resource, item)
    const config = maintenanceResources[resource]
    if (!config) {
        throw new Error(`Unsupported maintenance resource: ${resource}`)
    }

    return mutateDataFile(config.fileName, async payload => {
        const collection = payload[config.collectionKey] ?? []
        const fieldBuffOriginalId = resource === "field-buffs"
            ? existingMaintenanceOriginalId(item, collection)
            : ""
        const cleanOptions = fieldBuffOriginalId ? { originalId: fieldBuffOriginalId } : {}
        const validationContext = {
            items: collection,
            currentId: fieldBuffOriginalId || item?.id,
        }
        const normalizedItem = normalizeSkillTargetsInValue(item)
        if (resource !== "agent-skills") {
            const agentSkillsPayload = await readDataFile("agent_skills.json")
            validationContext.agentSkills = agentSkillsPayload.agentSkills ?? []
        }
        if (resource === "agents") {
            const [anomalyEffectsPayload, driveDiscSetsPayload] = await Promise.all([
                readDataFile("anomaly_effects.json"),
                readDataFile("drive_disc_sets.json"),
            ])
            validationContext.anomalyEffects = anomalyEffectsForType(anomalyEffectsPayload, "attribute")
            validationContext.disorderEffects = anomalyEffectsForType(anomalyEffectsPayload, "disorder")
            validationContext.driveDiscSets = driveDiscSetsPayload.sets ?? []
            cleanOptions.anomalyEffects = validationContext.anomalyEffects
            cleanOptions.disorderEffects = validationContext.disorderEffects
        }
        const itemForValidation = cleanMaintenanceItem(resource, normalizedItem, cleanOptions)
        assertValidMaintenanceItem(resource, itemForValidation, validationContext)
        const savedItem = itemForValidation
        const nextPayload = {
            ...payload,
            [config.collectionKey]: upsertById(collection, savedItem),
        }
        return {
            payload: nextPayload,
            value: {
                payload: nextPayload,
                savedItem,
            },
        }
    })
}

async function deleteMaintenanceItem(resource, id) {
    if (resource === "anomaly-effects") {
        return deleteAnomalyMaintenanceItem("anomaly", id)
    }

    const config = maintenanceResources[resource]
    if (!config) {
        throw new Error(`Unsupported maintenance resource: ${resource}`)
    }

    return mutateDataFile(config.fileName, payload => {
        const nextPayload = {
            ...payload,
            [config.collectionKey]: deleteById(payload[config.collectionKey] ?? [], id),
        }
        return { payload: nextPayload, value: nextPayload }
    })
}

async function saveTeammateBuff(input) {
    input = normalizeSkillTargetsInValue(materializeTeammateBuffInput(input))
    const agentSkillsPayload = await readDataFile("agent_skills.json")
    return mutateDataFile("combat_buffs.json", payload => {
        const teammate = cleanTeammate(input?.teammate ?? {})
        const buff = cleanMaintenanceItem("combat-buffs", input?.buff ?? {})
        const cleanedInput = { ...input, teammate, buff }
        assertValidMaintenanceItem("teammate-buffs", cleanedInput, {
            teammates: payload.teammates ?? [],
            currentBuffId: buff.id,
            agentSkills: agentSkillsPayload.agentSkills ?? [],
        })
        delete buff.sourceLabel
        const teammateId = requireId(teammate, "teammate")
        requireId(buff, "buff")

        const teammates = [...(payload.teammates ?? [])]
        const index = teammates.findIndex(item => item.id === teammateId)
        const savedBuffs = upsertById(index >= 0 ? teammates[index].buffs ?? [] : [], buff)
        const nextTeammate = {
            ...(index >= 0 ? teammates[index] : {}),
            ...teammate,
            id: teammateId,
            buffs: reorderByExactIds(savedBuffs, input.buffOrder, "Buff "),
        }

        if (index >= 0) {
            teammates[index] = nextTeammate
        } else {
            teammates.push(nextTeammate)
        }

        const nextPayload = { ...payload, teammates }
        return {
            payload: nextPayload,
            value: {
                payload: nextPayload,
                savedItem: {
                    ...buff,
                    maintenanceType: "teammate",
                    teammateId,
                    teammateName: teammate.name,
                },
            },
        }
    })
}

async function deleteTeammateBuff(teammateId, buffId) {
    return mutateDataFile("combat_buffs.json", payload => {
        const nextPayload = {
            ...payload,
            teammates: (payload.teammates ?? []).map(teammate => {
                if (teammate.id !== teammateId) {
                    return teammate
                }

                return {
                    ...teammate,
                    buffs: deleteById(teammate.buffs ?? [], buffId),
                }
            }),
        }
        return { payload: nextPayload, value: nextPayload }
    })
}

async function deleteTeammate(teammateId) {
    return mutateDataFile("combat_buffs.json", payload => {
        const nextPayload = {
            ...payload,
            teammates: (payload.teammates ?? []).filter(teammate => teammate.id !== teammateId),
        }
        return { payload: nextPayload, value: nextPayload }
    })
}

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8"
        case ".js":
            return "text/javascript; charset=utf-8"
        case ".css":
            return "text/css; charset=utf-8"
        case ".json":
            return "application/json; charset=utf-8"
        case ".svg":
            return "image/svg+xml"
        case ".png":
            return "image/png"
        case ".jpg":
        case ".jpeg":
            return "image/jpeg"
        case ".webp":
            return "image/webp"
        default:
            return "application/octet-stream"
    }
}

function isSafeStaticPath(root, absPath) {
    const relativePath = path.relative(root, absPath)
    return !(relativePath.startsWith("..") || path.isAbsolute(relativePath))
}

function streamFileResponse(res, absPath, headers = {}) {
    return new Promise(resolve => {
        const stream = createReadStream(absPath)
        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            resolve()
        }
        stream.once("open", () => {
            applyDefaultCors(res)
            res.writeHead(200, headers)
            stream.pipe(res)
        })
        stream.once("error", error => {
            if (!res.headersSent) {
                sendText(res, error?.code === "ENOENT" ? 404 : 500, error?.code === "ENOENT" ? "Not Found" : "File read failed", "text/plain; charset=utf-8")
            } else {
                res.destroy(error)
            }
            finish()
        })
        stream.once("end", finish)
        res.once("close", finish)
    })
}

function staticCacheControl(absPath) {
    const relativePath = path.relative(pagesDir, absPath).split(path.sep).join("/")
    if (path.extname(absPath).toLowerCase() === ".html") {
        return "no-store"
    }
    if (relativePath.startsWith("static/app/") && /\.(?:js|css)$/i.test(relativePath)) {
        return "public, max-age=31536000, immutable"
    }
    return "no-cache"
}

function streamStaticFile(res, absPath) {
    return streamFileResponse(res, absPath, {
        "Content-Type": contentType(absPath),
        "Cache-Control": staticCacheControl(absPath),
    })
}

function resolveStaticCandidate(root, fileName) {
    const absPath = path.resolve(root, fileName)
    if (!isSafeStaticPath(root, absPath)) {
        return { forbidden: true, absPath }
    }
    try {
        const fileStat = statSync(absPath)
        return {
            forbidden: false,
            absPath,
            exists: fileStat.isFile(),
            isDirectory: fileStat.isDirectory(),
        }
    } catch {
        return { forbidden: false, absPath, exists: false, isDirectory: false }
    }
}

async function serveStatic(res, pathname) {
    if (pathname === "/maintenance" || pathname === "/maintenance/" || pathname === "/maintenance.html") {
        if (!isMaintenanceEnabled()) {
            sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
            return
        }
        if (pathname !== "/maintenance") {
            sendRedirect(res, "/maintenance")
            return
        }
    }
    if (pathname === "/calculate.html") {
        sendRedirect(res, "/")
        return
    }
    if (pathname === "/drive-discs.html") {
        sendRedirect(res, "/discs")
        return
    }
    if (pathname === "/accounts.html") {
        sendRedirect(res, "/accounts")
        return
    }

    if (isLegacyMaintenanceStaticPath(pathname)) {
        sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
        return
    }

    const fileName = pathname === "/" ? "index.html" : pathname.replace(/^\//, "")

    const candidate = resolveStaticCandidate(pagesDir, fileName)
    if (candidate.forbidden) {
        sendText(res, 403, "Forbidden", "text/plain; charset=utf-8")
        return
    }
    if (candidate.isDirectory) {
        sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
        return
    }
    if (candidate.exists) {
        await streamStaticFile(res, candidate.absPath)
        return
    }

    const spaIndex = path.join(pagesDir, "index.html")
    if (!path.extname(pathname) && existsSync(spaIndex)) {
        await streamStaticFile(res, spaIndex)
        return
    }

    if (!existsSync(spaIndex) && !path.extname(pathname)) {
        sendText(res, 503, "Vue build not found. Run `npm run build:webapp` before `npm run serve`.", "text/plain; charset=utf-8")
        return
    }

    sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
}

async function serveDownload(res, pathname) {
    const fileName = pathname.replace(/^\/downloads\//, "")
    for (const root of [path.join(pagesDir, "downloads"), downloadsDir]) {
        const absPath = path.resolve(root, fileName)
        if (!isSafeStaticPath(root, absPath)) {
            sendText(res, 403, "Forbidden", "text/plain; charset=utf-8")
            return
        }
        if (!existsSync(absPath)) {
            continue
        }
        const stat = await import("node:fs/promises").then(m => m.stat(absPath))
        if (!stat.isFile()) {
            continue
        }
        await streamFileResponse(res, absPath, {
            "Content-Type": contentType(absPath),
            "Content-Disposition": `attachment; filename="${encodeURIComponent(path.basename(absPath))}"`,
            "Content-Length": stat.size,
        })
        return
    }
    sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
}

async function routeScanTelemetry(req, res, pathname, searchParams) {
    if (pathname === "/api/scan-telemetry/events") {
        if (!scanTelemetryStore) {
            sendJson(res, 404, { ok: false, error: "Scan telemetry is disabled." })
            return true
        }
        if (req.method !== "POST") {
            sendJson(res, 405, { ok: false, error: "Method not allowed." })
            return true
        }
        if (!isSameOriginRequest(req)) {
            sendJson(res, 403, { ok: false, error: "Same-origin request required." })
            return true
        }
        if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
            sendJson(res, 415, { ok: false, error: "Content-Type must be application/json." })
            return true
        }
        if (!allowScanTelemetryRequest(requestClientIp(req))) {
            res.setHeader("Retry-After", "60")
            sendJson(res, 429, { ok: false, error: "Too many telemetry requests." })
            return true
        }
        try {
            const body = await readBody(req, 16 * 1024)
            const event = validateScanTelemetryEvent(JSON.parse(body || "{}"))
            const record = await scanTelemetryStore.append(event)
            sendJson(res, 202, { ok: true, recordId: record.recordId, receivedAt: record.receivedAt })
        } catch (error) {
            if (error instanceof RequestBodyTooLargeError) {
                sendJson(res, 413, { ok: false, error: error.message })
            } else if (error instanceof ScanTelemetryValidationError || error instanceof SyntaxError) {
                sendJson(res, 400, { ok: false, error: error.message })
            } else {
                console.error("Scan telemetry write failed:", error)
                sendJson(res, 503, { ok: false, error: "Scan telemetry is temporarily unavailable." })
            }
        }
        return true
    }

    if (!pathname.startsWith("/api/internal/scan-telemetry")) {
        return false
    }
    if (!scanTelemetryStore) {
        sendJson(res, 404, { ok: false, error: "Scan telemetry is disabled." })
        return true
    }
    if (!isTelemetryAdminRequest(req)) {
        res.setHeader("WWW-Authenticate", "Basic realm=\"ZZZ Scanner Diagnostics\"")
        sendJson(res, 401, { ok: false, error: "Authentication required." })
        return true
    }
    if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." })
        return true
    }

    try {
        const range = resolveTelemetryRange({
            from: searchParams.get("from") ?? "",
            to: searchParams.get("to") ?? "",
        })
        if (pathname === "/api/internal/scan-telemetry/summary") {
            sendJson(res, 200, { ok: true, summary: await scanTelemetryStore.summary(range) })
            return true
        }
        if (pathname === "/api/internal/scan-telemetry/sessions") {
            const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 50))
            const cursor = Math.max(0, Number(searchParams.get("cursor")) || 0)
            const result = await scanTelemetryStore.sessionPage(range, {
                status: String(searchParams.get("status") ?? ""),
                client: String(searchParams.get("client") ?? ""),
                scannerVersion: String(searchParams.get("scannerVersion") ?? ""),
                errorCode: String(searchParams.get("errorCode") ?? ""),
            }, {
                cursor,
                limit,
            })
            sendJson(res, 200, {
                ok: true,
                range,
                ...result,
            })
            return true
        }
        const prefix = "/api/internal/scan-telemetry/sessions/"
        if (pathname.startsWith(prefix)) {
            const sessionId = pathname.slice(prefix.length)
            if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
                throw new ScanTelemetryValidationError("Session ID is invalid.")
            }
            const session = await scanTelemetryStore.session(range, sessionId)
            if (!session) {
                sendJson(res, 404, { ok: false, error: "Session not found." })
            } else {
                sendJson(res, 200, { ok: true, range, session })
            }
            return true
        }
        sendJson(res, 404, { ok: false, error: "Not found." })
    } catch (error) {
        if (error instanceof ScanTelemetryValidationError) {
            sendJson(res, 400, { ok: false, error: error.message })
        } else {
            console.error("Scan telemetry query failed:", error)
            sendJson(res, 500, { ok: false, error: "Unable to query scan telemetry." })
        }
    }
    return true
}

async function routeApi(req, res, pathname, searchParams) {
    if (await routeScanTelemetry(req, res, pathname, searchParams)) {
        return
    }
    if (!isMaintenanceEnabled() && pathname.startsWith("/api/maintenance/")) {
        sendJson(res, 403, {
            ok: false,
            error: "Maintenance is disabled in production.",
        })
        return
    }

    if (isMaintenanceWriteRequest(req, pathname)) {
        if (!isAllowedMaintenanceOrigin(req)) {
            sendJson(res, 403, {
                ok: false,
                error: "Cross-origin maintenance writes are not allowed.",
            })
            return
        }
        applyMaintenanceCors(req, res)
    }

    if (req.method === "OPTIONS") {
        sendText(res, 204, "", "text/plain; charset=utf-8")
        return
    }

    if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, {
            ok: true,
            service: "zzz_calculator",
        })
        return
    }

    if (req.method === "GET" && pathname === "/api/app-config") {
        sendJson(res, 200, {
            maintenanceEnabled: isMaintenanceEnabled(),
            scanTelemetryEnabled,
            scanTelemetryRetentionDays,
        })
        return
    }

    if (req.method === "GET" && pathname === "/api/meta") {
        sendJson(res, 200, buildMeta(catalog))
        return
    }

    if (req.method === "GET" && pathname === "/api/catalog") {
        sendJson(res, 200, catalog)
        return
    }

    if (nodeEnv === "production" && isServerComputePath(pathname)) {
        sendJson(res, 403, {
            ok: false,
            error: "Server-side calculation APIs are disabled in production. Calculations run in the browser.",
        })
        return
    }

    if (isRetiredUserDataPath(pathname)
        && (nodeEnv === "production" || !isDevelopmentDriveDiscReservationPath(pathname))) {
        sendJson(res, 410, {
            ok: false,
            error: "User data is stored in the browser locally. This server endpoint is retired.",
        })
        return
    }

    if (pathname === "/api/accounts") {
        if (req.method === "GET") {
            sendJson(res, 200, {
                ok: true,
                ...(await accountSummary(dataDir)),
            })
            return
        }

        if (req.method === "POST") {
            try {
                const body = await readBody(req)
                const result = await createAccount(dataDir, JSON.parse(body || "{}"))
                sendJson(res, 200, {
                    ok: true,
                    account: result.account,
                    ...result.summary,
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }
    }

    if (req.method === "POST" && pathname === "/api/accounts/current") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = await switchAccount(dataDir, input.id ?? input.ownerId)
            sendJson(res, 200, {
                ok: true,
                ...result.summary,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (pathname.startsWith("/api/accounts/")) {
        const id = pathname.slice("/api/accounts/".length)
        if (!id) {
            sendJson(res, 400, {
                ok: false,
                error: "Account id is required.",
            })
            return
        }

        if (req.method === "PUT") {
            try {
                const body = await readBody(req)
                const result = await updateAccount(dataDir, id, JSON.parse(body || "{}"))
                sendJson(res, 200, {
                    ok: true,
                    account: result.account,
                    ...result.summary,
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }

        if (req.method === "DELETE") {
            try {
                const result = await deleteAccount(dataDir, id)
                sendJson(res, 200, {
                    ok: true,
                    deleted: result.deleted,
                    ...result.summary,
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }
    }

    if (req.method === "GET" && pathname === "/api/maintenance/catalog") {
        const [agents, agentSkills, wEngines, driveDiscSets, combatBuffs, bosses, anomalyEffects] = await Promise.all([
            readDataFile("agents.json"),
            readDataFile("agent_skills.json"),
            readDataFile("w_engines.json"),
            readDataFile("drive_disc_sets.json"),
            readDataFile("combat_buffs.json"),
            readDataFile("bosses.json"),
            readDataFile("anomaly_effects.json"),
        ])
        sendJson(res, 200, {
            ok: true,
            data: {
                agents,
                agentSkills,
                wEngines,
                driveDiscSets,
                combatBuffs,
                bosses,
                anomalyEffects,
                meta: buildMeta(catalog),
            },
        })
        return
    }

    if (pathname.startsWith("/api/maintenance/")) {
        try {
            const parts = pathname.slice("/api/maintenance/".length).split("/")
            const resource = parts[0]

            if (req.method === "POST" || req.method === "PUT") {
                const body = JSON.parse(await readBody(req) || "{}")
                const result = resource === "teammate-buffs"
                    ? await saveTeammateBuff(body)
                    : resource === "boss-buffs" && body?.boss && body?.encounter
                        ? await saveBossEncounter(body)
                        : await saveMaintenanceItem(resource, body)
                sendJson(res, 200, {
                    ok: true,
                    data: result.payload,
                    savedItem: result.savedItem,
                    ...(result.savedBoss ? { savedBoss: result.savedBoss } : {}),
                    ...(result.savedEncounter ? { savedEncounter: result.savedEncounter } : {}),
                    meta: buildMeta(catalog),
                })
                return
            }

            if (req.method === "DELETE") {
                if (resource === "teammate-buffs") {
                    if (parts[2]) {
                        await deleteTeammateBuff(parts[1] ?? "", parts[2])
                    } else {
                        await deleteTeammate(parts[1] ?? "")
                    }
                } else if (resource === "boss-buffs") {
                    await deleteBossMaintenanceItem(parts[1] ?? "", parts[2] ?? "")
                } else if (resource === "anomaly-effects") {
                    await deleteAnomalyMaintenanceItem(parts[1] ?? "anomaly", parts[2] ?? "")
                } else {
                    await deleteMaintenanceItem(resource, parts[1] ?? "")
                }
                sendJson(res, 200, {
                    ok: true,
                    meta: buildMeta(catalog),
                })
                return
            }
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
            return
        }
    }

    if (req.method === "GET" && pathname === "/api/example/out-of-combat") {
        sendJson(res, 200, catalog.example)
        return
    }

    if (req.method === "GET" && pathname === "/api/example/ye-shunguang") {
        sendJson(res, 200, catalog.examples.yeShunguang)
        return
    }

    if (req.method === "POST" && pathname === "/api/calculate/out-of-combat") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = calculateOutOfCombatPanel(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/calculate/in-combat") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = calculateInCombatPanel(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/analysis/drive-disc-substats") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = analyzeDriveDiscSubstats(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/analysis/drive-disc-stat-diffs") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = analyzeDriveDiscStatDiffs(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/analysis/drive-disc-stat-gains") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const result = analyzeDriveDiscStatGains(catalog, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/optimize/drive-discs/preview") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const store = createRequestStore(input)
            input.ownerId = input.ownerId ?? store.currentOwnerId
            input.settings = {
                ...(input.settings ?? {}),
                ownerId: input.settings?.ownerId ?? input.ownerId,
            }
            const preview = previewDriveDiscOptimization(catalog, store, input)
            sendJson(res, 200, {
                ok: true,
                data: preview,
                error: preview.error?.reason ?? null,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/optimize/drive-discs/jobs") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const store = createRequestStore(input)
            input.ownerId = input.ownerId ?? store.currentOwnerId
            input.settings = {
                ...(input.settings ?? {}),
                ownerId: input.settings?.ownerId ?? input.ownerId,
            }
            const job = createOptimizerJob(store, input)
            sendJson(res, 200, {
                ok: true,
                data: formatOptimizerJob(job),
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (pathname.startsWith("/api/optimize/drive-discs/jobs/")) {
        const id = pathname.slice("/api/optimize/drive-discs/jobs/".length)
        const job = optimizerJobs.get(id)
        if (!id || !job) {
            sendJson(res, 404, {
                ok: false,
                error: "Optimization job not found.",
            })
            return
        }

        if (req.method === "GET") {
            sendJson(res, 200, {
                ok: true,
                data: formatOptimizerJob(job),
            })
            return
        }

        if (req.method === "DELETE") {
            if (job.status === "running" || job.status === "canceling") {
                job.cancelRequested = true
                job.status = "canceling"
                job.updatedAt = Date.now()
            }
            sendJson(res, 200, {
                ok: true,
                data: formatOptimizerJob(job),
            })
            return
        }
    }

    if (req.method === "POST" && pathname === "/api/optimize/drive-discs") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const store = createRequestStore(input)
            input.ownerId = input.ownerId ?? store.currentOwnerId
            input.settings = {
                ...(input.settings ?? {}),
                ownerId: input.settings?.ownerId ?? input.ownerId,
            }
            const result = optimizeDriveDiscs(catalog, store, input)
            sendJson(res, 200, {
                ok: true,
                data: result,
                error: result.error?.reason ?? null,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "GET" && pathname === "/api/user-drive-discs") {
        sendJson(res, 200, await loadCurrentUserDriveDiscStore(dataDir))
        return
    }

    if (req.method === "DELETE" && pathname === "/api/user-drive-discs") {
        const result = await clearUserDriveDiscStore(dataDir)
        sendJson(res, 200, {
            ok: true,
            cleared: result.previous,
            store: ownerScopedStore(result.store),
        })
        return
    }

    if (pathname === "/api/user-drive-disc-reservations" && req.method === "POST") {
        try {
            const body = await readBody(req)
            const result = await setDriveDiscReservations(dataDir, JSON.parse(body || "{}"))
            if (!result.applied) {
                sendJson(res, 409, {
                    ok: false,
                    code: "drive_disc_reservation_conflict",
                    conflicts: result.conflicts,
                })
                return
            }
            sendJson(res, 200, {
                ok: true,
                applied: true,
                changedIds: result.changedIds,
                conflicts: result.conflicts,
                store: ownerScopedStore(result.store, result.ownerId),
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (pathname === "/api/user-drive-disc-loadouts") {
        if (req.method === "GET") {
            const store = await loadCurrentUserDriveDiscStore(dataDir)
            sendJson(res, 200, {
                ok: true,
                loadouts: store.driveDiscLoadouts ?? [],
                store,
            })
            return
        }

        if (req.method === "POST") {
            try {
                const body = await readBody(req)
                const input = JSON.parse(body || "{}")
                const loadout = input?.loadout && typeof input.loadout === "object" ? input.loadout : input
                const result = await upsertDriveDiscLoadout(dataDir, loadout, {
                    reserveDiscs: input?.reservation?.enabled === true,
                    allowTransfer: input?.reservation?.allowTransfer === true,
                })
                if (!result.applied) {
                    sendJson(res, 409, {
                        ok: false,
                        code: "drive_disc_reservation_conflict",
                        conflicts: result.conflicts,
                    })
                    return
                }
                sendJson(res, 200, {
                    ok: true,
                    loadout: result.loadout,
                    store: ownerScopedStore(result.store),
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }
    }

    if (pathname.startsWith("/api/user-drive-disc-loadouts/")) {
        const id = pathname.slice("/api/user-drive-disc-loadouts/".length)
        if (!id) {
            sendJson(res, 400, {
                ok: false,
                error: "Drive disc loadout id is required.",
            })
            return
        }

        if (req.method === "PUT") {
            try {
                const body = await readBody(req)
                const input = JSON.parse(body || "{}")
                const loadout = input?.loadout && typeof input.loadout === "object" ? input.loadout : input
                const result = await upsertDriveDiscLoadout(dataDir, {
                    ...loadout,
                    id,
                }, {
                    reserveDiscs: input?.reservation?.enabled === true,
                    allowTransfer: input?.reservation?.allowTransfer === true,
                })
                if (!result.applied) {
                    sendJson(res, 409, {
                        ok: false,
                        code: "drive_disc_reservation_conflict",
                        conflicts: result.conflicts,
                    })
                    return
                }
                sendJson(res, 200, {
                    ok: true,
                    loadout: result.loadout,
                    store: ownerScopedStore(result.store),
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }

        if (req.method === "DELETE") {
            const result = await deleteDriveDiscLoadout(dataDir, id)
            sendJson(res, 200, {
                ok: true,
                deleted: result.deleted,
                store: ownerScopedStore(result.store),
            })
            return
        }
    }

    if (req.method === "POST" && pathname === "/api/user-drive-discs/import/zzz-scanner") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "[]")
            const embeddedData = Array.isArray(input)
                ? input
                : input.items ?? input.driveDiscs ?? input.drive_discs ?? input.discs ?? input.data ?? input.export
            const sourceData = embeddedData ?? (
                input.sourcePath
                    ? JSON.parse(await readFile(input.sourcePath, "utf8"))
                    : input
            )
            const store = await importScannerExportToStore(dataDir, sourceData, {
                ownerId: input.ownerId ?? undefined,
                sourcePath: input.sourcePath ?? null,
                removeMissing: Boolean(input.removeMissing),
            })
            sendJson(res, 200, {
                ok: true,
                store: ownerScopedStore(store),
                summary: store.lastImportSummary ?? null,
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (req.method === "POST" && pathname === "/api/user-drive-discs") {
        try {
            const body = await readBody(req)
            const driveDisc = JSON.parse(body || "{}")
            const store = await upsertUserDriveDisc(dataDir, driveDisc)
            sendJson(res, 200, {
                ok: true,
                store: ownerScopedStore(store),
            })
        } catch (error) {
            sendJson(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
        return
    }

    if (pathname.startsWith("/api/user-drive-discs/")) {
        const id = pathname.slice("/api/user-drive-discs/".length)
        if (!id) {
            sendJson(res, 400, {
                ok: false,
                error: "Drive disc id is required.",
            })
            return
        }

        if (req.method === "PUT") {
            try {
                const body = await readBody(req)
                const driveDisc = {
                    ...JSON.parse(body || "{}"),
                    id,
                }
                const store = await upsertUserDriveDisc(dataDir, driveDisc)
                sendJson(res, 200, {
                    ok: true,
                    store: ownerScopedStore(store),
                })
            } catch (error) {
                sendJson(res, 400, {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
            return
        }

        if (req.method === "DELETE") {
            const result = await deleteUserDriveDisc(dataDir, id)
            sendJson(res, 200, {
                ok: true,
                deleted: result.deleted,
                store: ownerScopedStore(result.store),
            })
            return
        }
    }

    sendJson(res, 404, {
        ok: false,
        error: "Not found",
    })
}

const downloadsDir = path.join(rootDir, "downloads")

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
        let pathname
        try {
            pathname = decodeURIComponent(url.pathname)
        } catch (error) {
            if (error instanceof URIError) {
                sendJson(res, 400, {
                    ok: false,
                    error: "Malformed URL encoding.",
                })
                return
            }
            throw error
        }

        if (pathname.startsWith("/api/")) {
            await routeApi(req, res, pathname, url.searchParams)
            return
        }

        if (pathname.startsWith("/downloads/")) {
            await serveDownload(res, pathname)
            return
        }

        await serveStatic(res, pathname)
    } catch (error) {
        sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        })
    }
})

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (!existsSync(path.join(pagesDir, "index.html"))) {
        console.warn("Vue build not found. Run `npm run build:webapp` before `npm run serve`.")
    }
    server.listen(port, host, () => {
        console.log(`ZZZ calculator running at http://${host}:${port}`)
    })
}
