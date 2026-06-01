import { createServer } from "node:http"
import { randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildMeta, calculateInCombatPanel, calculateOutOfCombatPanel, loadCalculatorContext } from "./calculator.js"
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
    switchAccount,
    updateAccount,
    upsertDriveDiscLoadout,
    upsertUserDriveDisc,
} from "./driveDiscInventory.js"
import { assertValidMaintenanceItem } from "../frontend/maintenanceValidation.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const dataDir = path.join(rootDir, "data")
const frontendDir = path.join(rootDir, "frontend")
const port = Number(process.env.PORT || 8787)

let catalog = await loadCalculatorContext(rootDir)
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
    "combat-buffs": {
        fileName: "combat_buffs.json",
        collectionKey: "buffs",
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

function sendJson(res, statusCode, payload) {
    const text = JSON.stringify(payload, null, 2)
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end(text)
}

function sendText(res, statusCode, text, contentType) {
    res.writeHead(statusCode, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end(text)
}

async function readBody(req) {
    const chunks = []
    for await (const chunk of req) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString("utf8")
}

async function readDataFile(fileName) {
    return JSON.parse(await readFile(path.join(dataDir, fileName), "utf8"))
}

async function writeDataFile(fileName, payload) {
    await writeFile(path.join(dataDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8")
    catalog = await loadCalculatorContext(rootDir)
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

function canonicalBuffStat(stat) {
    return stat === "enemyDefIgnore" ? "enemyDefReduction" : stat
}

function cleanEffectRule(effect = {}) {
    const { sourceStat, ...rest } = effect
    const next = {
        ...rest,
        id: rest.id || randomId("effect"),
    }

    if (next.stat) {
        next.stat = canonicalBuffStat(next.stat)
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

function cleanFieldBuff(buff = {}) {
    const next = cleanBuff({
        ...buff,
        sourceType: "field",
        scope: "inCombat",
    })

    if (buff.sourcePeriod) {
        next.sourcePeriod = zhOnly(buff.sourcePeriod)
    } else {
        delete next.sourcePeriod
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
                    stat: canonicalBuffStat(stat.stat),
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
    const source = preferredDriveDiscs.mainStatLimits
        ?? preferredDriveDiscs.mainStats
        ?? preferredDriveDiscs
    const mainStatLimits = {}
    for (const slot of ["4", "5", "6"]) {
        const raw = source?.[slot] ?? source?.[Number(slot)] ?? []
        const values = Array.isArray(raw) ? raw : raw ? [raw] : []
        mainStatLimits[slot] = [...new Set(values.filter(Boolean).map(String))]
    }
    return Object.values(mainStatLimits).some(values => values.length)
        ? { mainStatLimits }
        : null
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

function cleanCalculationEvent(event = {}, index = 0) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null
    }
    const inputKind = ["direct", "anomaly", "disorder"].includes(event.kind)
        ? event.kind
        : "direct"
    const settlementType = inputKind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
    const kind = inputKind === "direct" ? "direct" : "anomaly"
    const id = String(event.id ?? `${kind}-${index + 1}`).trim() || `${kind}-${index + 1}`
    const count = Number(event.count ?? 1)
    const base = {
        id,
        kind,
        count: Number.isFinite(count) ? Math.max(0, count) : 1,
    }
    if (kind === "direct") {
        const skillRef = cleanCalculationSkillRef(event.skillRef)
        return {
            ...base,
            critMode: ["expected", "crit", "nonCrit"].includes(event.critMode) ? event.critMode : "expected",
            ...(skillRef ? { skillRef } : {}),
        }
    }
    if (kind === "anomaly") {
        if (settlementType === "disorder") {
            const elapsedSeconds = Number(event.elapsedSeconds ?? 0)
            const durationSeconds = Number(event.durationSeconds ?? 10)
            return {
                ...base,
                settlementType: "disorder",
                anomalyEffect: String(event.anomalyEffect ?? event.previousAnomalyEffect ?? "").trim(),
                elapsedSeconds: Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0,
                durationSeconds: Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 10,
            }
        }
        const procCount = Number(event.procCount ?? 1)
        return {
            ...base,
            settlementType: "attribute",
            anomalyEffect: String(event.anomalyEffect ?? "").trim(),
            procCount: Number.isFinite(procCount) ? Math.max(0, procCount) : 1,
        }
    }
    return null
}

function cleanDefaultCalculationConfig(config = null) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return null
    }
    const events = Array.isArray(config.events)
        ? config.events.map(cleanCalculationEvent).filter(Boolean)
        : []
    if (!events.length) {
        return null
    }
    const mode = ["single", "anomaly", "custom"].includes(config.mode) ? config.mode : "custom"
    const selectedEventId = String(config.selectedEventId ?? events[0]?.id ?? "").trim()
    return {
        mode,
        ...(config.name ? { name: zhOnly(config.name) } : {}),
        selectedEventId: events.some(event => event.id === selectedEventId) ? selectedEventId : events[0].id,
        events,
    }
}

function cleanAgent(item = {}) {
    const preferredDriveDiscs = cleanPreferredDriveDiscs(item.preferredDriveDiscs)
    const defaultCalculationConfig = cleanDefaultCalculationConfig(item.defaultCalculationConfig)
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

function cleanMaintenanceItem(resource, item) {
    if (resource === "combat-buffs") {
        return cleanBuff(item)
    }
    if (resource === "field-buffs") {
        return cleanFieldBuff(item)
    }
    if (resource === "boss-buffs") {
        return cleanBossBuff(item)
    }
    if (resource === "agent-skills") {
        return item
    }
    if (resource === "w-engines") {
        return cleanWEngine(item)
    }
    if (resource === "drive-disc-sets") {
        return cleanDriveDiscSet(item)
    }
    if (resource === "agents") {
        return cleanAgent(item)
    }
    return item
}

function cleanTeammate(teammate = {}) {
    return {
        ...teammate,
        name: zhOnly(teammate.name),
    }
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

async function saveAnomalyMaintenanceItem(item) {
    const payload = await readDataFile("anomaly_effects.json")
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
    await writeDataFile("anomaly_effects.json", nextPayload)
    return {
        payload: nextPayload,
        savedItem,
    }
}

async function deleteAnomalyMaintenanceItem(maintenanceType, id) {
    const payload = await readDataFile("anomaly_effects.json")
    const nextPayload = anomalyPayloadWithEffects(
        payload,
        deleteAnomalyEffectByType(rawAnomalyEffectsFromPayload(payload), maintenanceType, id),
    )
    await writeDataFile("anomaly_effects.json", nextPayload)
    return nextPayload
}

async function saveMaintenanceItem(resource, item) {
    if (resource === "anomaly-effects") {
        return saveAnomalyMaintenanceItem(item)
    }

    const config = maintenanceResources[resource]
    if (!config) {
        throw new Error(`Unsupported maintenance resource: ${resource}`)
    }

    const payload = await readDataFile(config.fileName)
    const validationContext = {
        items: payload[config.collectionKey] ?? [],
        currentId: item?.id,
    }
    if (resource === "agents") {
        const [agentSkillsPayload, anomalyEffectsPayload] = await Promise.all([
            readDataFile("agent_skills.json"),
            readDataFile("anomaly_effects.json"),
        ])
        validationContext.agentSkills = agentSkillsPayload.agentSkills ?? []
        validationContext.anomalyEffects = anomalyEffectsForType(anomalyEffectsPayload, "attribute")
        validationContext.disorderEffects = anomalyEffectsForType(anomalyEffectsPayload, "disorder")
    }
    assertValidMaintenanceItem(resource, item, validationContext)
    const savedItem = cleanMaintenanceItem(resource, item)
    payload[config.collectionKey] = upsertById(payload[config.collectionKey] ?? [], savedItem)
    await writeDataFile(config.fileName, payload)
    return {
        payload,
        savedItem,
    }
}

async function deleteMaintenanceItem(resource, id) {
    if (resource === "anomaly-effects") {
        return deleteAnomalyMaintenanceItem("anomaly", id)
    }

    const config = maintenanceResources[resource]
    if (!config) {
        throw new Error(`Unsupported maintenance resource: ${resource}`)
    }

    const payload = await readDataFile(config.fileName)
    payload[config.collectionKey] = deleteById(payload[config.collectionKey] ?? [], id)
    await writeDataFile(config.fileName, payload)
    return payload
}

async function saveTeammateBuff(input) {
    const payload = await readDataFile("combat_buffs.json")
    assertValidMaintenanceItem("teammate-buffs", input, {
        teammates: payload.teammates ?? [],
        currentBuffId: input?.buff?.id,
    })
    const teammate = cleanTeammate(input?.teammate ?? {})
    const buff = cleanBuff(input?.buff ?? {})
    delete buff.sourceLabel
    const teammateId = requireId(teammate, "teammate")
    requireId(buff, "buff")

    const teammates = [...(payload.teammates ?? [])]
    const index = teammates.findIndex(item => item.id === teammateId)
    const nextTeammate = {
        ...(index >= 0 ? teammates[index] : {}),
        ...teammate,
        id: teammateId,
        buffs: upsertById(index >= 0 ? teammates[index].buffs ?? [] : [], buff),
    }

    if (index >= 0) {
        teammates[index] = nextTeammate
    } else {
        teammates.push(nextTeammate)
    }

    payload.teammates = teammates
    await writeDataFile("combat_buffs.json", payload)
    return {
        payload,
        savedItem: {
            ...buff,
            maintenanceType: "teammate",
            teammateId,
            teammateName: teammate.name,
        },
    }
}

async function deleteTeammateBuff(teammateId, buffId) {
    const payload = await readDataFile("combat_buffs.json")
    payload.teammates = (payload.teammates ?? []).map(teammate => {
        if (teammate.id !== teammateId) {
            return teammate
        }

        return {
            ...teammate,
            buffs: deleteById(teammate.buffs ?? [], buffId),
        }
    })
    await writeDataFile("combat_buffs.json", payload)
    return payload
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

async function serveStatic(res, pathname) {
    const fileName = pathname === "/" ? "index.html" : pathname.replace(/^\//, "")
    const absPath = path.resolve(frontendDir, fileName)
    const relativePath = path.relative(frontendDir, absPath)
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        sendText(res, 403, "Forbidden", "text/plain; charset=utf-8")
        return
    }

    if (!existsSync(absPath)) {
        const indexPath = path.join(frontendDir, "index.html")
        if (!existsSync(indexPath)) {
            sendText(res, 404, "Not Found", "text/plain; charset=utf-8")
            return
        }

        const html = await readFile(indexPath, "utf8")
        sendText(res, 200, html, "text/html; charset=utf-8")
        return
    }

    res.writeHead(200, {
        "Content-Type": contentType(absPath),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })
    createReadStream(absPath).pipe(res)
}

async function routeApi(req, res, pathname) {
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

    if (req.method === "GET" && pathname === "/api/meta") {
        sendJson(res, 200, buildMeta(catalog))
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
        const id = decodeURIComponent(pathname.slice("/api/accounts/".length))
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
        const [agents, agentSkills, wEngines, driveDiscSets, combatBuffs, anomalyEffects] = await Promise.all([
            readDataFile("agents.json"),
            readDataFile("agent_skills.json"),
            readDataFile("w_engines.json"),
            readDataFile("drive_disc_sets.json"),
            readDataFile("combat_buffs.json"),
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
                    : await saveMaintenanceItem(resource, body)
                sendJson(res, 200, {
                    ok: true,
                    data: result.payload,
                    savedItem: result.savedItem,
                    meta: buildMeta(catalog),
                })
                return
            }

            if (req.method === "DELETE") {
                if (resource === "teammate-buffs") {
                    await deleteTeammateBuff(decodeURIComponent(parts[1] ?? ""), decodeURIComponent(parts[2] ?? ""))
                } else if (resource === "anomaly-effects") {
                    await deleteAnomalyMaintenanceItem(decodeURIComponent(parts[1] ?? "anomaly"), decodeURIComponent(parts[2] ?? ""))
                } else {
                    await deleteMaintenanceItem(resource, decodeURIComponent(parts[1] ?? ""))
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

    if (req.method === "POST" && pathname === "/api/optimize/drive-discs/preview") {
        try {
            const body = await readBody(req)
            const input = JSON.parse(body || "{}")
            const store = await loadUserDriveDiscStore(dataDir)
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
            const store = await loadUserDriveDiscStore(dataDir)
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
        const id = decodeURIComponent(pathname.slice("/api/optimize/drive-discs/jobs/".length))
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
            const store = await loadUserDriveDiscStore(dataDir)
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
                const result = await upsertDriveDiscLoadout(dataDir, JSON.parse(body || "{}"))
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
        const id = decodeURIComponent(pathname.slice("/api/user-drive-disc-loadouts/".length))
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
                const result = await upsertDriveDiscLoadout(dataDir, {
                    ...JSON.parse(body || "{}"),
                    id,
                })
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
        const id = decodeURIComponent(pathname.slice("/api/user-drive-discs/".length))
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

const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    const pathname = decodeURIComponent(url.pathname)

    try {
        if (pathname.startsWith("/api/")) {
            await routeApi(req, res, pathname)
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

server.listen(port, () => {
    console.log(`ZZZ calculator running at http://localhost:${port}`)
})
