import { recordNonEnkaBindingSessionChanges } from "./enka-import/binding-session.js"

const DRIVE_DISC_SET_ALIASES = {
    "雪兔梦游仙境": { id: "zzz_wiki_1907", name: { zhCN: "雪兔梦游仙境" } },
    "囚徒手记": { id: "zzz_wiki_1906", name: { zhCN: "囚徒手记" } },
    "啄木鸟电音": { id: "woodpecker_electro", name: { zhCN: "啄木鸟电音" } },
    "摇摆爵士": { id: "swing_jazz", name: { zhCN: "摇摆爵士" } },
    "激素朋克": { id: "hormone_punk", name: { zhCN: "激素朋克" } },
    "獠牙重金属": { id: "fanged_metal", name: { zhCN: "獠牙重金属" } },
    "震星迪斯科": { id: "shockstar_disco", name: { zhCN: "震星迪斯科" } },
    "雷暴重金属": { id: "thunder_metal", name: { zhCN: "雷暴重金属" } },
    "极地重金属": { id: "polar_metal", name: { zhCN: "极地重金属" } },
    "自由蓝调": { id: "freedom_blues", name: { zhCN: "自由蓝调" } },
    "炎狱重金属": { id: "inferno_metal", name: { zhCN: "炎狱重金属" } },
    "河豚电音": { id: "puffer_electro", name: { zhCN: "河豚电音" } },
    "灵魂摇滚": { id: "soul_rock", name: { zhCN: "灵魂摇滚" } },
    "混沌重金属": { id: "chaotic_metal", name: { zhCN: "混沌重金属" } },
    "原始朋克": { id: "proto_punk", name: { zhCN: "原始朋克" } },
    "混沌爵士": { id: "chaos_jazz", name: { zhCN: "混沌爵士" } },
    "静听嘉音": { id: "zzz_wiki_1001", name: { zhCN: "静听嘉音" } },
    "沧浪行歌": { id: "scanner-set-fcf8ae93d798", name: { zhCN: "沧浪行歌" } },
    "拂晓生花": { id: "zzz_wiki_1552", name: { zhCN: "拂晓生花" } },
    "折枝剑歌": { id: "scanner-set-48ee0a14625f", name: { zhCN: "折枝剑歌" } },
    "流光咏叹": { id: "astral_voice", name: { zhCN: "流光咏叹" } },
    "法厄同之歌": { id: "phaethons_melody", name: { zhCN: "法厄同之歌" } },
    "云岿如我": { id: "yunkui_tales", name: { zhCN: "云岿如我" } },
    "月光骑士颂": { id: "moonlight_lullaby", name: { zhCN: "月光骑士颂" } },
    "如影相随": { id: "shadow_harmony", name: { zhCN: "如影相随" } },
    "山大王": { id: "king_of_the_summit", name: { zhCN: "山大王" } },
    "呼啸沙龙": { id: "zzz_wiki_2038", name: { zhCN: "呼啸沙龙" } },
    "拂晓行纪": { id: "zzz_wiki_2029", name: { zhCN: "拂晓行纪" } },
    "棘刺玫瑰": { id: "zzz_wiki_2121", name: { zhCN: "棘刺玫瑰" } },
    "谶羽之誓": { id: "zzz_wiki_2116", name: { zhCN: "谶羽之誓" } },
}

export const DRIVE_DISC_EXPORT_FORMAT = "zzz-calculator-drive-disc-export"
export const DRIVE_DISC_EXPORT_VERSION = 1
export const DRIVE_DISC_FINGERPRINT_VERSION = 2
export const DRIVE_DISC_PROVENANCE_VERSION = 1

const STAT_LABELS = {
    "生命值": { flat: "hpFlat", pct: "hpPct" },
    "攻击力": { flat: "atkFlat", pct: "atkPct" },
    "防御力": { flat: "defFlat", pct: "defPct" },
    "暴击率": { pct: "critRate" },
    "暴击伤害": { pct: "critDmg" },
    "异常精通": { flat: "anomalyProficiency" },
    "异常掌控": { pct: "anomalyMastery" },
    "冲击力": { pct: "impact" },
    "能量自动回复": { pct: "energyRegen" },
    "穿透值": { flat: "penFlat" },
    "穿透率": { pct: "penRatio" },
    "物理伤害加成": { pct: "physicalDmg" },
    "火属性伤害加成": { pct: "fireDmg" },
    "冰属性伤害加成": { pct: "iceDmg" },
    "电属性伤害加成": { pct: "electricDmg" },
    "以太伤害加成": { pct: "etherDmg" },
    "风属性伤害加成": { pct: "windDmg" },
}
const KNOWN_DRIVE_DISC_STATS = new Set(
    Object.values(STAT_LABELS).flatMap(modes => Object.values(modes)),
)

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`
    }
    return JSON.stringify(value)
}

export function defaultInventoryHash(value) {
    let h1 = 0xdeadbeef
    let h2 = 0x41c6ce57
    const text = String(value ?? "")
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index)
        h1 = Math.imul(h1 ^ code, 2654435761)
        h2 = Math.imul(h2 ^ code, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`.slice(0, 12)
}

function hashWith(options, value) {
    return (options?.hashText ?? defaultInventoryHash)(value)
}

function nowIso() {
    return new Date().toISOString()
}

function cloneJsonValue(value) {
    return JSON.parse(JSON.stringify(value))
}

function normalizedStatValue(value) {
    const number = Number(value ?? 0)
    return Number.isFinite(number) ? Number(number.toFixed(5)) : 0
}

function statFingerprintEntry(stat, { includeValue = true } = {}) {
    const entry = {
        stat: stat?.stat ?? "unknown",
        mode: stat?.mode ?? "unknown",
    }
    if (entry.stat === "unknown" || entry.mode === "unknown") {
        entry.rawIdentity = {
            propertyId: String(stat?.raw?.propertyId ?? stat?.propertyId ?? "").trim(),
            label: String(stat?.label ?? "").trim(),
            rawValue: stat?.rawValue ?? stat?.raw?.propertyValue ?? null,
        }
    }
    if (includeValue) {
        entry.value = normalizedStatValue(stat?.value)
    }
    return entry
}

export function hasUnknownDriveDiscStat(disc) {
    const stats = [disc?.mainStat, ...(disc?.subStats ?? [])]
    return stats.some(stat => {
        const statKey = String(stat?.stat ?? "").trim()
        return !stat
            || !KNOWN_DRIVE_DISC_STATS.has(statKey)
            || (stat.mode != null && String(stat.mode).trim() === "unknown")
    })
}

function localizedText(value) {
    if (typeof value === "string") return value.trim()
    if (!value || typeof value !== "object") return ""
    return String(value.zhCN ?? value.en ?? Object.values(value).find(item => typeof item === "string") ?? "").trim()
}

function canonicalSetKey(disc) {
    const setId = String(disc?.setId ?? "").trim()
    if (setId && !setId.startsWith("scanner-set-")) return `id:${setId}`
    return `name:${localizedText(disc?.canonicalSetName) || String(disc?.setName ?? "").trim()}`
}

function sortedStatFingerprintEntries(stats, options = {}) {
    return (stats ?? [])
        .map(stat => statFingerprintEntry(stat, options))
        .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
}

export function canonicalDriveDiscContent(disc) {
    return {
        set: canonicalSetKey(disc),
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? "").trim().toUpperCase(),
        level: Number(disc?.level ?? 0),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: true }),
        subStats: sortedStatFingerprintEntries(disc?.subStats, { includeValue: true }),
    }
}

export function canonicalDriveDiscIdentity(disc) {
    return {
        set: canonicalSetKey(disc),
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? "").trim().toUpperCase(),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: false }),
        subStats: sortedStatFingerprintEntries(disc?.subStats, { includeValue: false }),
    }
}

export function driveDiscContentFingerprint(disc, options = {}) {
    return `v${DRIVE_DISC_FINGERPRINT_VERSION}:${hashWith(options, stableStringify(canonicalDriveDiscContent(disc)))}`
}

export function driveDiscIdentityFingerprint(disc, options = {}) {
    return `v${DRIVE_DISC_FINGERPRINT_VERSION}:${hashWith(options, stableStringify(canonicalDriveDiscIdentity(disc)))}`
}

export function sameDriveDiscContent(left, right) {
    return stableStringify(canonicalDriveDiscContent(left)) === stableStringify(canonicalDriveDiscContent(right))
}

export function sameDriveDiscIdentity(left, right) {
    return stableStringify(canonicalDriveDiscIdentity(left)) === stableStringify(canonicalDriveDiscIdentity(right))
}

export function withDriveDiscFingerprints(disc, options = {}) {
    const next = { ...(disc ?? {}) }
    next.fingerprintVersion = DRIVE_DISC_FINGERPRINT_VERSION
    next.contentFingerprint = driveDiscContentFingerprint(next, options)
    next.identityFingerprint = driveDiscIdentityFingerprint(next, options)
    return next
}

function timeValue(value, fallback = null) {
    const text = String(value ?? "").trim()
    return text || fallback
}

function legacyProvenance(disc) {
    const source = disc?.source ?? {}
    const provenance = disc?.provenance?.version === DRIVE_DISC_PROVENANCE_VERSION
        ? cloneJsonValue(disc.provenance)
        : { version: DRIVE_DISC_PROVENANCE_VERSION }
    const sourceType = String(source.type ?? "")
    const sequenceOnlyScanner = !sourceType
        && source.sequence != null
        && String(source.sequence).trim() !== ""
    const firstSeenAt = timeValue(source.importedAt, disc?.createdAt ?? null)
    const lastSeenAt = timeValue(source.matchedAt, source.importedAt ?? disc?.updatedAt ?? firstSeenAt)

    if (["enka-zzz-showcase", "enka-showcase"].includes(sourceType)
        || (source.uid != null && source.equipmentUid != null)) {
        provenance.enkaZzz = {
            ...(provenance.enkaZzz ?? {}),
            uid: String(source.uid ?? provenance.enkaZzz?.uid ?? ""),
            equipmentUid: String(source.equipmentUid ?? provenance.enkaZzz?.equipmentUid ?? ""),
            ...(source.equipmentId != null ? { equipmentId: String(source.equipmentId) } : {}),
            ...(source.agentId != null ? { lastAgentId: String(source.agentId) } : {}),
            firstSeenAt: provenance.enkaZzz?.firstSeenAt ?? firstSeenAt,
            lastSeenAt: provenance.enkaZzz?.lastSeenAt ?? lastSeenAt,
        }
    }
    if (["zzz-scanner", "scanner"].includes(sourceType) || sequenceOnlyScanner) {
        provenance.scanner = {
            ...(provenance.scanner ?? {}),
            firstSeenAt: provenance.scanner?.firstSeenAt ?? firstSeenAt,
            lastSeenAt: provenance.scanner?.lastSeenAt ?? lastSeenAt,
            lastImportId: source.importId ?? provenance.scanner?.lastImportId ?? null,
            lastSourcePath: source.sourcePath ?? provenance.scanner?.lastSourcePath ?? null,
            lastSequence: source.sequence ?? provenance.scanner?.lastSequence ?? null,
            lastRawIndex: source.rawIndex ?? provenance.scanner?.lastRawIndex ?? null,
        }
    }
    if (sourceType === "calculator-json") {
        provenance.calculatorJson = {
            ...(provenance.calculatorJson ?? {}),
            firstSeenAt: provenance.calculatorJson?.firstSeenAt ?? firstSeenAt,
            lastSeenAt: provenance.calculatorJson?.lastSeenAt ?? lastSeenAt,
            lastImportId: source.importId ?? provenance.calculatorJson?.lastImportId ?? null,
            sourceRecordId: source.sourceRecordId ?? provenance.calculatorJson?.sourceRecordId ?? disc?.id ?? null,
        }
    }
    if (sourceType === "manual") {
        provenance.manual = {
            ...(provenance.manual ?? {}),
            lastEditedAt: provenance.manual?.lastEditedAt ?? timeValue(disc?.updatedAt, firstSeenAt),
        }
    }
    return provenance
}

export function mergeDriveDiscProvenance(left, right) {
    const current = left?.version === DRIVE_DISC_PROVENANCE_VERSION ? cloneJsonValue(left) : { version: DRIVE_DISC_PROVENANCE_VERSION }
    const incoming = right?.version === DRIVE_DISC_PROVENANCE_VERSION ? right : {}
    const mergeSeen = (before, after) => after ? {
        ...(before ?? {}),
        ...cloneJsonValue(after),
        firstSeenAt: before?.firstSeenAt ?? after.firstSeenAt ?? null,
        lastSeenAt: after.lastSeenAt ?? before?.lastSeenAt ?? null,
    } : before
    return {
        ...current,
        version: DRIVE_DISC_PROVENANCE_VERSION,
        ...(incoming.enkaZzz || current.enkaZzz ? { enkaZzz: mergeSeen(current.enkaZzz, incoming.enkaZzz) } : {}),
        ...(incoming.scanner || current.scanner ? { scanner: mergeSeen(current.scanner, incoming.scanner) } : {}),
        ...(incoming.calculatorJson || current.calculatorJson
            ? { calculatorJson: mergeSeen(current.calculatorJson, incoming.calculatorJson) }
            : {}),
        ...(incoming.manual || current.manual ? { manual: { ...(current.manual ?? {}), ...(incoming.manual ?? {}) } } : {}),
    }
}

export function projectDriveDiscSource(provenance, fallback = null) {
    if (provenance?.enkaZzz) {
        return {
            type: "enka-zzz-showcase",
            uid: provenance.enkaZzz.uid,
            equipmentUid: provenance.enkaZzz.equipmentUid,
            ...(provenance.enkaZzz.equipmentId ? { equipmentId: provenance.enkaZzz.equipmentId } : {}),
            ...(provenance.enkaZzz.lastAgentId ? { agentId: provenance.enkaZzz.lastAgentId } : {}),
        }
    }
    if (provenance?.scanner) {
        return {
            type: "zzz-scanner",
            importId: provenance.scanner.lastImportId ?? null,
            sourcePath: provenance.scanner.lastSourcePath ?? null,
            sequence: provenance.scanner.lastSequence ?? null,
            rawIndex: provenance.scanner.lastRawIndex ?? null,
        }
    }
    if (provenance?.calculatorJson) {
        return {
            type: "calculator-json",
            importId: provenance.calculatorJson.lastImportId ?? null,
            sourceRecordId: provenance.calculatorJson.sourceRecordId ?? null,
        }
    }
    if (provenance?.manual) return { type: "manual" }
    return fallback ?? null
}

function convertLegacyEnkaStatUnits(disc) {
    const version = Number(disc?.statUnitVersion ?? 0)
    const percentStats = [disc?.mainStat, ...(disc?.subStats ?? [])]
        .filter(stat => stat?.mode === "pct")
    const hasCorruptedPercentUnits = percentStats
        .some(stat => Math.abs(Number(stat?.value ?? 0)) >= 100)
    if (version >= 2 && !hasCorruptedPercentUnits) return disc
    const normalizeStat = stat => {
        if (stat?.mode !== "pct") return stat
        const value = Number(stat.value ?? 0)
        const absoluteValue = Math.abs(value)
        const multiplier = absoluteValue >= 100
            ? 0.01
            : version < 2 && absoluteValue > 0 && absoluteValue <= 1
                ? 100
                : 1
        return multiplier === 1
            ? stat
            : { ...stat, value: normalizedStatValue(value * multiplier) }
    }
    return {
        ...disc,
        statUnitVersion: 2,
        mainStat: normalizeStat(disc.mainStat),
        subStats: (disc.subStats ?? []).map(normalizeStat),
    }
}

function normalizeLegacyEnkaStatUnits(disc) {
    const sourceType = String(disc?.source?.type ?? "")
    const isEnka = ["enka-zzz-showcase", "enka-showcase"].includes(sourceType)
        || disc?.provenance?.enkaZzz
    return isEnka ? convertLegacyEnkaStatUnits(disc) : disc
}

export function migrateConfirmedLegacyEnkaStatUnits(disc) {
    return convertLegacyEnkaStatUnits(disc)
}

export function withDriveDiscProvenance(disc, options = {}) {
    const normalizedUnits = normalizeLegacyEnkaStatUnits(disc ?? {})
    const provenance = legacyProvenance(normalizedUnits)
    const pendingLegacyEnkaMigration = /^enka-(?!zzz:)/.test(String(normalizedUnits?.id ?? ""))
        && !provenance.enkaZzz
        && Number(normalizedUnits?.statUnitVersion ?? 0) < 2
    const next = {
        ...normalizedUnits,
        provenance,
        source: projectDriveDiscSource(provenance, normalizedUnits.source),
    }
    if (!pendingLegacyEnkaMigration) next.statUnitVersion = 2
    else if (!Object.prototype.hasOwnProperty.call(normalizedUnits, "statUnitVersion")) delete next.statUnitVersion
    return withDriveDiscFingerprints(next, options)
}

export function migrateDriveDiscStatUnits(store, options = {}) {
    if (!store || typeof store !== "object" || !Array.isArray(store.driveDiscs)) {
        return store
    }

    let changed = false
    const driveDiscs = store.driveDiscs.map(disc => {
        const normalized = normalizeLegacyEnkaStatUnits(disc)
        if (normalized === disc) return disc
        changed = true
        return withDriveDiscProvenance(normalized, options)
    })
    return changed ? { ...store, driveDiscs } : store
}

function cleanReservedForAgentId(value) {
    const agentId = String(value ?? "").trim()
    return agentId || null
}

export function normalizeExcludedForAgentIds(value, reservedForAgentId = null) {
    const reservedAgentId = cleanReservedForAgentId(reservedForAgentId)
    const seen = new Set()
    return (Array.isArray(value) ? value : [])
        .map(agentId => String(agentId ?? "").trim())
        .filter(agentId => agentId && agentId !== reservedAgentId && !seen.has(agentId) && seen.add(agentId))
}

function normalizeDriveDiscUsageRestrictions(disc) {
    const reservedForAgentId = cleanReservedForAgentId(disc?.reservedForAgentId)
    return {
        ...(disc ?? {}),
        reservedForAgentId,
        excludedForAgentIds: normalizeExcludedForAgentIds(disc?.excludedForAgentIds, reservedForAgentId),
    }
}

export function driveDiscUsageStateForAgent(disc, agentId) {
    const targetAgentId = String(agentId ?? "").trim()
    const reservedForAgentId = cleanReservedForAgentId(disc?.reservedForAgentId)
    const excludedForAgentIds = normalizeExcludedForAgentIds(disc?.excludedForAgentIds, reservedForAgentId)
    if (reservedForAgentId) {
        if (targetAgentId && reservedForAgentId === targetAgentId) {
            return {
                state: "reserved-current",
                available: true,
                reservedForAgentId,
                excludedForAgentIds,
            }
        }
        return {
            state: "excluded-by-reservation",
            available: false,
            reservedForAgentId,
            excludedForAgentIds,
        }
    }
    if (targetAgentId && excludedForAgentIds.includes(targetAgentId)) {
        return {
            state: "excluded-explicit",
            available: false,
            reservedForAgentId: null,
            excludedForAgentIds,
        }
    }
    return {
        state: "available",
        available: true,
        reservedForAgentId: null,
        excludedForAgentIds,
    }
}

export function driveDiscOptimizationInventoryFingerprint(store, input = {}, options = {}) {
    const normalized = normalizeInventoryStore(store, options)
    const ownerId = String(input.ownerId ?? normalized.currentOwnerId ?? "default")
    const agentId = String(input.agentId ?? "").trim()
    const driveDiscs = normalized.driveDiscs
        .filter(disc => (disc.ownerId ?? "default") === ownerId)
        .map(disc => ({
            id: String(disc.id ?? ""),
            contentFingerprint: disc.contentFingerprint ?? driveDiscContentFingerprint(disc, options),
            reservedForAgentId: cleanReservedForAgentId(disc.reservedForAgentId),
            excludedForAgentIds: normalizeExcludedForAgentIds(disc.excludedForAgentIds, disc.reservedForAgentId).sort(),
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    return hashWith(options, stableStringify({ ownerId, agentId, driveDiscs }))
}

export function createEmptyInventoryStore() {
    return {
        version: 1,
        updatedAt: null,
        currentOwnerId: "default",
        owners: [{ id: "default", label: "默认用户" }],
        imports: [],
        driveDiscs: [],
        driveDiscLoadouts: [],
    }
}

function cleanOwnerId(id) {
    return String(id ?? "").trim()
}

function defaultOwner() {
    return { id: "default", label: "默认用户" }
}

function isMissingCanonicalSetName(value) {
    if (value === null || value === undefined) return true
    if (typeof value === "string") return !value.trim()
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value).length === 0
    }
    return false
}

export function normalizeDriveDiscSetAlias(disc, options = {}) {
    if (!disc || typeof disc !== "object") return disc

    const setName = String(disc.setName ?? "").trim()
    const setMatch = options.setAliases?.[setName] ?? DRIVE_DISC_SET_ALIASES[setName]
    if (!setMatch?.id) return disc

    const currentSetId = String(disc.setId ?? "").trim()
    const replaceSetId = !currentSetId || currentSetId.startsWith("scanner-set-")
    const fillCanonicalSetName = (replaceSetId || currentSetId === setMatch.id)
        && isMissingCanonicalSetName(disc.canonicalSetName)
    if (!replaceSetId && !fillCanonicalSetName) return disc

    return {
        ...disc,
        ...(replaceSetId ? { setId: setMatch.id } : {}),
        ...(fillCanonicalSetName ? { canonicalSetName: cloneJsonValue(setMatch.name) } : {}),
    }
}

export function migrateDriveDiscSetAliases(store, options = {}) {
    if (!store || typeof store !== "object" || !Array.isArray(store.driveDiscs)) {
        return store
    }

    let changed = false
    const driveDiscs = store.driveDiscs.map(disc => {
        const normalized = normalizeDriveDiscSetAlias(disc, options)
        if (normalized !== disc) changed = true
        return normalized
    })

    return changed ? { ...store, driveDiscs } : store
}

export function normalizeInventoryStore(store, options = {}) {
    const fallback = createEmptyInventoryStore()
    const owners = Array.isArray(store?.owners) && store.owners.length
        ? store.owners
            .map(owner => ({
                id: cleanOwnerId(owner.id),
                label: String(owner.label ?? owner.name ?? owner.id ?? "").trim() || cleanOwnerId(owner.id),
            }))
            .filter(owner => owner.id)
        : fallback.owners
    const safeOwners = owners.length ? owners : [defaultOwner()]
    const currentOwnerId = safeOwners.some(owner => owner.id === store?.currentOwnerId)
        ? store.currentOwnerId
        : safeOwners[0].id

    return {
        ...fallback,
        ...(store ?? {}),
        currentOwnerId,
        owners: safeOwners,
        imports: Array.isArray(store?.imports) ? store.imports : [],
        driveDiscs: Array.isArray(store?.driveDiscs)
            ? store.driveDiscs.map(disc => withDriveDiscProvenance(
                normalizeDriveDiscUsageRestrictions(normalizeDriveDiscSetAlias(disc, options)),
                options,
            ))
            : [],
        driveDiscLoadouts: Array.isArray(store?.driveDiscLoadouts) ? store.driveDiscLoadouts : [],
    }
}

export function ownerScopedStore(store, ownerId = store?.currentOwnerId, options = {}) {
    const normalized = normalizeInventoryStore(store, options)
    const scopedOwnerId = normalized.owners.some(owner => owner.id === ownerId) ? ownerId : normalized.currentOwnerId
    return {
        ...normalized,
        currentOwnerId: scopedOwnerId,
        imports: normalized.imports.filter(item => (item.ownerId ?? "default") === scopedOwnerId),
        driveDiscs: normalized.driveDiscs.filter(item => (item.ownerId ?? "default") === scopedOwnerId),
        driveDiscLoadouts: normalized.driveDiscLoadouts.filter(item => (item.ownerId ?? "default") === scopedOwnerId),
    }
}

export function currentOwnerId(store, options = {}) {
    return normalizeInventoryStore(store, options).currentOwnerId
}

function driveDiscForExport(disc) {
    const {
        ownerId: _ownerId,
        contentFingerprint: _contentFingerprint,
        identityFingerprint: _identityFingerprint,
        ...exported
    } = disc ?? {}
    return cloneJsonValue(exported)
}

export function createDriveDiscExport(store, options = {}) {
    const normalized = normalizeInventoryStore(store, options)
    const ownerId = options.ownerId ?? normalized.currentOwnerId
    const owner = normalized.owners.find(item => item.id === ownerId)
    if (!owner) {
        throw new Error(`Cannot export unknown account "${ownerId}".`)
    }
    return {
        format: DRIVE_DISC_EXPORT_FORMAT,
        version: DRIVE_DISC_EXPORT_VERSION,
        exportedAt: options.exportedAt ?? nowIso(),
        sourceAccount: { id: owner.id, label: owner.label },
        driveDiscs: normalized.driveDiscs
            .filter(item => (item.ownerId ?? "default") === ownerId)
            .map(driveDiscForExport),
    }
}

function pickScannerItems(input) {
    if (Array.isArray(input)) {
        return input
    }
    if (!input || typeof input !== "object") {
        throw new Error("ZZZ Scanner export must be an array or an object containing drive disc items.")
    }
    const candidates = [input.items, input.driveDiscs, input.drive_discs, input.discs, input.data, input.export]
    const items = candidates.find(Array.isArray)
    if (!items) {
        throw new Error("Could not find drive disc array in ZZZ Scanner export.")
    }
    return items
}

function parseScannerValue(rawValue) {
    if (typeof rawValue === "string") {
        const trimmed = rawValue.trim()
        if (trimmed.endsWith("%")) {
            return { value: Number(trimmed.slice(0, -1)), mode: "pct", rawValue }
        }
        const numeric = Number(trimmed)
        if (!Number.isNaN(numeric)) {
            return { value: numeric, mode: "flat", rawValue }
        }
    }
    if (typeof rawValue === "number") {
        return { value: rawValue, mode: "flat", rawValue }
    }
    return { value: 0, mode: "unknown", rawValue }
}

function resolveStat(label, mode) {
    const normalizedLabel = String(label ?? "").trim()
        .replace(/%$/, "")
        .replace(/^物理属性伤害加成$/, "物理伤害加成")
    const entry = STAT_LABELS[normalizedLabel]
    return entry ? entry[mode] ?? entry.flat ?? entry.pct ?? null : null
}

function normalizeStat(rawStat, warnings, context) {
    const entries = Object.entries(rawStat ?? {})
    if (entries.length !== 1) {
        warnings.push(`${context}: expected exactly one stat entry, got ${entries.length}.`)
    }
    const [label, rawValue] = entries[0] ?? ["unknown", 0]
    const parsed = parseScannerValue(rawValue)
    const stat = resolveStat(label, parsed.mode)
    if (!stat) {
        warnings.push(`${context}: unknown stat label "${label}" with value "${rawValue}".`)
    }
    return {
        stat: stat ?? "unknown",
        value: parsed.value,
        mode: parsed.mode,
        label,
        rawValue,
    }
}

function normalizeScannerItem(rawItem, index, options, warnings) {
    const sourceSequence = Number(rawItem["序号"] ?? index + 1)
    const setName = String(rawItem["名称"] ?? "未知套装")
    const partition = Number(rawItem["槽位"] ?? 0)
    const rarity = String(rawItem["品质"] ?? "S")
    const level = Number(rawItem["等级"] ?? 0)
    const maxLevel = Number(rawItem["最大等级"] ?? level)
    const normalized = normalizeDriveDiscSetAlias({
        id: `scanner-${sourceSequence}-${hashWith(options, `${options.ownerId}:${setName}:${partition}:${rarity}:${stableStringify(rawItem["主属性"])}:${stableStringify(rawItem["副属性"])}`)}`,
        ownerId: options.ownerId,
        setId: `scanner-set-${hashWith(options, setName)}`,
        setName,
        canonicalSetName: null,
        partition,
        rarity,
        level,
        maxLevel,
        locked: false,
        equippedBy: null,
        reservedForAgentId: null,
        mainStat: normalizeStat(rawItem["主属性"], warnings, `disc ${sourceSequence} mainStat`),
        subStats: (rawItem["副属性"] ?? []).map((item, subIndex) =>
            normalizeStat(item, warnings, `disc ${sourceSequence} subStat ${subIndex + 1}`)
        ),
        source: {
            type: "zzz-scanner",
            sourcePath: options.sourcePath ?? null,
            importId: options.importId,
            importedAt: options.importedAt,
            sequence: sourceSequence,
            rawIndex: index,
        },
        raw: rawItem,
    }, options)
    const withFingerprints = withDriveDiscProvenance(normalized, options)
    return { ...withFingerprints, id: `scanner-${withFingerprints.contentFingerprint}` }
}

export function normalizeScannerExport(input, options = {}) {
    const ownerId = String(options.ownerId ?? "").trim() || "default"
    const importedAt = options.importedAt ?? nowIso()
    const sourcePath = options.sourcePath ?? null
    const importId = options.importId ?? `zzz-scanner-${hashWith(options, `${ownerId}:${sourcePath ?? ""}:${importedAt}`)}`
    const warnings = []
    const driveDiscs = pickScannerItems(input).map((item, index) =>
        normalizeScannerItem(item, index, { ...options, ownerId, importedAt, sourcePath, importId }, warnings)
    )
    return {
        importRecord: {
            id: importId,
            type: "zzz-scanner",
            ownerId,
            sourcePath,
            importedAt,
            itemCount: driveDiscs.length,
            warnings,
            removeMissing: Boolean(options.removeMissing),
        },
        driveDiscs,
    }
}

function assertPlainObject(value, context) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${context} must be an object.`)
    }
}

function normalizeNativeStat(rawStat, context) {
    assertPlainObject(rawStat, context)
    const stat = String(rawStat.stat ?? "").trim()
    const value = Number(rawStat.value)
    if (!stat) {
        throw new Error(`${context}.stat is required.`)
    }
    if (!Number.isFinite(value)) {
        throw new Error(`${context}.value must be a finite number.`)
    }
    return {
        ...cloneJsonValue(rawStat),
        stat,
        value,
    }
}

function normalizeNativeDriveDisc(rawItem, index, options) {
    const context = `driveDiscs[${index}]`
    assertPlainObject(rawItem, context)
    const id = String(rawItem.id ?? "").trim()
    const setId = String(rawItem.setId ?? "").trim()
    const setName = String(rawItem.setName ?? "").trim()
    const partition = Number(rawItem.partition)
    const rarity = String(rawItem.rarity ?? "").trim()
    const level = Number(rawItem.level)
    const maxLevel = Number(rawItem.maxLevel ?? rawItem.level)
    if (!id) throw new Error(`${context}.id is required.`)
    if (!setId && !setName) throw new Error(`${context} must include setId or setName.`)
    if (!Number.isInteger(partition) || partition < 1 || partition > 6) {
        throw new Error(`${context}.partition must be an integer from 1 to 6.`)
    }
    if (!rarity) throw new Error(`${context}.rarity is required.`)
    if (!Number.isFinite(level) || !Number.isFinite(maxLevel)) {
        throw new Error(`${context} level values must be finite numbers.`)
    }
    if (!Array.isArray(rawItem.subStats)) {
        throw new Error(`${context}.subStats must be an array.`)
    }
    const {
        ownerId: _ownerId,
        contentFingerprint: _contentFingerprint,
        identityFingerprint: _identityFingerprint,
        ...record
    } = cloneJsonValue(rawItem)
    const normalized = withDriveDiscProvenance(normalizeDriveDiscUsageRestrictions(normalizeDriveDiscSetAlias({
        ...record,
        id,
        ownerId: options.ownerId,
        setId,
        setName,
        partition,
        rarity,
        level,
        maxLevel,
        mainStat: normalizeNativeStat(rawItem.mainStat, `${context}.mainStat`),
        subStats: rawItem.subStats.map((stat, statIndex) =>
            normalizeNativeStat(stat, `${context}.subStats[${statIndex}]`)
        ),
    }, options)), options)
    const observedAt = options.importedAt ?? nowIso()
    const provenance = mergeDriveDiscProvenance(normalized.provenance, {
        version: DRIVE_DISC_PROVENANCE_VERSION,
        calculatorJson: {
            firstSeenAt: observedAt,
            lastSeenAt: observedAt,
            lastImportId: options.importId ?? null,
            sourceRecordId: id,
            sourceAccountKey: options.sourceAccountKey ?? null,
            sourceAccountId: options.sourceAccountId ?? null,
            sourceAccountLabel: options.sourceAccountLabel ?? null,
        },
    })
    return withDriveDiscProvenance({
        ...normalized,
        provenance,
        source: projectDriveDiscSource(provenance, normalized.source),
    }, options)
}

function normalizeNativeDriveDiscExport(input, options = {}) {
    assertPlainObject(input, "Drive Disc export")
    if (input.version !== DRIVE_DISC_EXPORT_VERSION) {
        throw new Error(`Unsupported Drive Disc export version "${input.version}". Expected version ${DRIVE_DISC_EXPORT_VERSION}.`)
    }
    assertPlainObject(input.sourceAccount, "Drive Disc export sourceAccount")
    if (!String(input.sourceAccount.label ?? "").trim()) {
        throw new Error("Drive Disc export sourceAccount.label is required.")
    }
    if (!String(input.exportedAt ?? "").trim() || !Number.isFinite(Date.parse(input.exportedAt))) {
        throw new Error("Drive Disc export exportedAt must be a valid ISO date string.")
    }
    if (!Array.isArray(input.driveDiscs)) {
        throw new Error("Drive Disc export driveDiscs must be an array.")
    }
    const ownerId = String(options.ownerId ?? "").trim() || "default"
    const importedAt = options.importedAt ?? nowIso()
    const sourcePath = options.sourcePath ?? null
    const sourceAccountId = String(input.sourceAccount.id ?? "").trim()
    const sourceAccountLabel = String(input.sourceAccount.label).trim()
    const sourceAccountKey = sourceAccountId
        ? `id:${sourceAccountId}`
        : `label:${sourceAccountLabel}`
    const importId = options.importId ?? `zzz-calculator-export-${hashWith(options, `${ownerId}:${sourcePath ?? ""}:${importedAt}`)}`
    const driveDiscs = input.driveDiscs.map((item, index) =>
        normalizeNativeDriveDisc(item, index, {
            ...options,
            ownerId,
            importedAt,
            importId,
            sourceAccountKey,
            sourceAccountId: sourceAccountId || null,
            sourceAccountLabel,
        })
    )
    const ids = new Set()
    for (const disc of driveDiscs) {
        if (ids.has(disc.id)) {
            throw new Error(`Drive Disc export contains duplicate id "${disc.id}".`)
        }
        ids.add(disc.id)
    }
    return {
        importRecord: {
            id: importId,
            type: DRIVE_DISC_EXPORT_FORMAT,
            version: DRIVE_DISC_EXPORT_VERSION,
            ownerId,
            sourcePath,
            sourceAccount: cloneJsonValue(input.sourceAccount),
            sourceExportedAt: input.exportedAt,
            importedAt,
            itemCount: driveDiscs.length,
            warnings: [],
            removeMissing: Boolean(options.removeMissing),
        },
        driveDiscs,
    }
}

export function normalizeDriveDiscImport(input, options = {}) {
    if (input && typeof input === "object" && !Array.isArray(input) && Object.prototype.hasOwnProperty.call(input, "format")) {
        if (input.format !== DRIVE_DISC_EXPORT_FORMAT) {
            throw new Error(`Unsupported Drive Disc import format "${input.format}".`)
        }
        return normalizeNativeDriveDiscExport(input, options)
    }
    return normalizeScannerExport(input, options)
}

function enkaProvenanceKey(disc) {
    const enka = disc?.provenance?.enkaZzz
    const source = disc?.source ?? {}
    const uid = String(enka?.uid ?? source.uid ?? "").trim()
    const equipmentUid = String(enka?.equipmentUid ?? source.equipmentUid ?? "").trim()
    return uid && equipmentUid ? `${uid}:${equipmentUid}` : ""
}

function enkaIdentityObservation(disc) {
    const enka = disc?.provenance?.enkaZzz
    const source = disc?.source ?? {}
    const uid = String(enka?.uid ?? source.uid ?? "").trim()
    const equipmentUid = String(enka?.equipmentUid ?? source.equipmentUid ?? "").trim()
    return {
        uid,
        equipmentUid,
        agentId: String(enka?.lastAgentId ?? source.agentId ?? disc?.equippedBy ?? "").trim(),
        partition: Number(disc?.partition ?? 0),
        set: canonicalSetKey(disc),
        templateId: String(enka?.equipmentId ?? source.equipmentId ?? "").trim(),
        locked: Boolean(disc?.locked),
        content: canonicalDriveDiscContent(disc),
    }
}

function enkaImmutableIdentity(disc) {
    const enka = disc?.provenance?.enkaZzz
    const source = disc?.source ?? {}
    return {
        partition: Number(disc?.partition ?? 0),
        set: canonicalSetKey(disc),
        equipmentId: String(enka?.equipmentId ?? source.equipmentId ?? "").trim(),
        rarity: String(disc?.rarity ?? "").trim().toUpperCase(),
        maxLevel: Number(disc?.maxLevel ?? 0),
    }
}

function immutableEnkaIdentityDifferences(existing, imported) {
    const before = enkaImmutableIdentity(existing)
    const after = enkaImmutableIdentity(imported)
    return Object.keys(before).flatMap(field => {
        const left = before[field]
        const right = after[field]
        const leftKnown = typeof left === "number" ? left > 0 : Boolean(left)
        const rightKnown = typeof right === "number" ? right > 0 : Boolean(right)
        return leftKnown && rightKnown && left !== right ? [{ field, before: left, after: right }] : []
    })
}

export function validateEnkaDriveDiscIdentities(discs = [], { expectedUid = null, existingDiscs = [] } = {}) {
    const normalizedExpectedUid = expectedUid == null ? null : String(expectedUid).trim()
    const observationsByKey = new Map()
    const blockingErrors = []
    const immutableErrorKeys = new Set()
    const canonicalCollisionErrorKeys = new Set()

    for (const disc of discs ?? []) {
        const observation = enkaIdentityObservation(disc)
        if (!observation.uid || !observation.equipmentUid) {
            blockingErrors.push({
                code: "ENKA_DISC_IDENTITY_MISSING",
                message: "展柜驱动盘缺少游戏 UID 或 Equipment UID，无法建立安全身份。",
                details: { observation },
            })
            continue
        }
        if (normalizedExpectedUid !== null && observation.uid !== normalizedExpectedUid) {
            blockingErrors.push({
                code: "ENKA_DISC_UID_MISMATCH",
                message: `驱动盘 ${observation.equipmentUid} 的来源 UID 与本次展柜 UID 不一致。`,
                details: { expectedUid: normalizedExpectedUid, observation },
            })
            continue
        }
        const key = `${observation.uid}:${observation.equipmentUid}`
        const canonicalId = `enka-zzz:${observation.uid}:${observation.equipmentUid}`
        const previous = observationsByKey.get(key)
        if (!previous) {
            observationsByKey.set(key, observation)
        } else if (stableStringify(previous) !== stableStringify(observation)) {
            blockingErrors.push({
                code: "ENKA_EQUIPMENT_IDENTITY_CONFLICT",
                message: `同一 Equipment UID ${observation.equipmentUid} 在本次展柜数据中对应了互相矛盾的角色、槽位、套装或模板。`,
                details: {
                    uid: observation.uid,
                    equipmentUid: observation.equipmentUid,
                    observations: [previous, observation],
                },
            })
        }

        for (const existing of existingDiscs ?? []) {
            if (String(existing?.id ?? "") === canonicalId) {
                const existingEnkaKey = enkaProvenanceKey(existing)
                const sameStrongIdentity = existingEnkaKey === key
                const safelyMatchesContent = !hasUnknownDriveDiscStat(existing)
                    && !hasUnknownDriveDiscStat(disc)
                    && !excludesDifferentStrongIdentity(existing, disc)
                    && sameDriveDiscContent(existing, disc)
                if (!sameStrongIdentity && !safelyMatchesContent) {
                    const errorKey = stableStringify([canonicalId, existingEnkaKey])
                    if (!canonicalCollisionErrorKeys.has(errorKey)) {
                        canonicalCollisionErrorKeys.add(errorKey)
                        blockingErrors.push({
                            code: "ENKA_CANONICAL_ID_COLLISION",
                            message: `驱动盘 ${observation.equipmentUid} 的 canonical ID 已被其他记录占用，无法安全合并。`,
                            details: {
                                uid: observation.uid,
                                equipmentUid: observation.equipmentUid,
                                canonicalId,
                                existingId: String(existing.id),
                                existingEnkaIdentity: existingEnkaKey || null,
                            },
                        })
                    }
                }
            }
            if (enkaProvenanceKey(existing) !== key) continue
            const differences = immutableEnkaIdentityDifferences(existing, disc)
            if (!differences.length) continue
            const errorKey = stableStringify([key, existing?.id, differences])
            if (immutableErrorKeys.has(errorKey)) continue
            immutableErrorKeys.add(errorKey)
            blockingErrors.push({
                code: "ENKA_EQUIPMENT_IMMUTABLE_IDENTITY_CONFLICT",
                message: `驱动盘 ${observation.equipmentUid} 与已有同一 Equipment UID 记录的槽位、套装或模板身份不一致。`,
                details: {
                    uid: observation.uid,
                    equipmentUid: observation.equipmentUid,
                    existingId: String(existing?.id ?? ""),
                    differences,
                },
            })
        }
    }

    return {
        blockingErrors,
        hasBlockingErrors: blockingErrors.length > 0,
    }
}

function calculatorJsonProvenanceKey(disc) {
    const source = disc?.provenance?.calculatorJson
    const accountKey = String(source?.sourceAccountKey ?? "").trim()
    const recordId = String(source?.sourceRecordId ?? "").trim()
    return accountKey && recordId ? stableStringify([accountKey, recordId]) : ""
}

function sourceKindForImport(importRecord) {
    return importRecord?.type === DRIVE_DISC_EXPORT_FORMAT ? "calculatorJson" : "scanner"
}

function hasSourceKind(disc, sourceKind) {
    if (sourceKind === "enka") return Boolean(disc?.provenance?.enkaZzz)
    return Boolean(disc?.provenance?.[sourceKind])
}

function candidateSort(sourceKind) {
    return (left, right) => {
        const sourceDelta = Number(hasSourceKind(right, sourceKind)) - Number(hasSourceKind(left, sourceKind))
        if (sourceDelta) return sourceDelta
        const createdDelta = String(left?.createdAt ?? "").localeCompare(String(right?.createdAt ?? ""))
        return createdDelta || String(left?.id ?? "").localeCompare(String(right?.id ?? ""))
    }
}

function materialDriveDiscSignature(disc) {
    const value = driveDiscForExport(disc)
    delete value.updatedAt
    delete value.source
    delete value.raw
    if (value.provenance?.enkaZzz) {
        delete value.provenance.enkaZzz.lastSeenAt
    }
    if (value.provenance?.scanner) {
        delete value.provenance.scanner.lastSeenAt
        delete value.provenance.scanner.lastImportId
        delete value.provenance.scanner.lastSourcePath
        delete value.provenance.scanner.lastSequence
        delete value.provenance.scanner.lastRawIndex
    }
    if (value.provenance?.calculatorJson) {
        delete value.provenance.calculatorJson.lastSeenAt
        delete value.provenance.calculatorJson.lastImportId
        delete value.provenance.calculatorJson.sourceAccountLabel
    }
    return stableStringify(value)
}

function mergeReconciledDriveDisc(existing, imported, { sourceKind, matchReason, now, options }) {
    const strongNativeMatch = ["same-native-source", "same-native-id"].includes(matchReason)
    const replaceCore = sourceKind === "enka"
        || (sourceKind === "calculatorJson" && strongNativeMatch)
        || matchReason === "resolved-identity"
    const coreFields = [
        "setId", "setName", "canonicalSetName", "partition", "rarity", "level", "maxLevel",
        "mainStat", "subStats", "statUnitVersion", "raw",
    ]
    const core = {}
    if (replaceCore) {
        for (const field of coreFields) {
            if (Object.prototype.hasOwnProperty.call(imported, field)) core[field] = cloneJsonValue(imported[field])
        }
    } else if (sourceKind === "scanner" && imported.raw) {
        core.raw = cloneJsonValue(imported.raw)
    }
    const provenance = mergeDriveDiscProvenance(existing.provenance, imported.provenance)
    const reservedForAgentId = Object.prototype.hasOwnProperty.call(existing, "reservedForAgentId")
        ? existing.reservedForAgentId ?? null
        : imported.reservedForAgentId ?? null
    const next = {
        ...existing,
        ...core,
        id: existing.id,
        ownerId: existing.ownerId ?? imported.ownerId,
        locked: sourceKind === "enka"
            ? Boolean(imported.locked)
            : sourceKind === "calculatorJson" && strongNativeMatch
                ? Boolean(imported.locked)
                : Boolean(existing.locked),
        equippedBy: sourceKind === "enka"
            ? imported.equippedBy ?? null
            : sourceKind === "calculatorJson" && strongNativeMatch
                ? imported.equippedBy ?? existing.equippedBy ?? null
                : existing.equippedBy ?? null,
        reservedForAgentId,
        excludedForAgentIds: normalizeExcludedForAgentIds(existing.excludedForAgentIds, reservedForAgentId),
        createdAt: existing.createdAt ?? imported.createdAt ?? now,
        updatedAt: now,
        provenance,
        source: projectDriveDiscSource(provenance, existing.source ?? imported.source),
    }
    return withDriveDiscProvenance(next, options)
}

function reconciliationKey(sourceKind, imported, index) {
    return enkaProvenanceKey(imported)
        || calculatorJsonProvenanceKey(imported)
        || `${sourceKind}:${index}:${stableStringify(canonicalDriveDiscIdentity(imported))}`
}

function contentCandidates(items, imported) {
    return items.filter(item => item.contentFingerprint === imported.contentFingerprint && sameDriveDiscContent(item, imported))
}

function identityCandidates(items, imported) {
    return items.filter(item => item.identityFingerprint === imported.identityFingerprint && sameDriveDiscIdentity(item, imported))
}

function excludesDifferentStrongIdentity(candidate, imported) {
    const incomingKey = enkaProvenanceKey(imported)
    const candidateKey = enkaProvenanceKey(candidate)
    if (incomingKey && candidateKey && incomingKey !== candidateKey) return true
    const incomingNativeKey = calculatorJsonProvenanceKey(imported)
    const candidateNativeKey = calculatorJsonProvenanceKey(candidate)
    return Boolean(incomingNativeKey && candidateNativeKey && incomingNativeKey !== candidateNativeKey)
}

function sourceWasAlreadyObserved(existing, imported, sourceKind) {
    if (sourceKind === "enka") return enkaProvenanceKey(existing) === enkaProvenanceKey(imported)
    if (sourceKind === "scanner") return Boolean(existing?.provenance?.scanner)
    const importedKey = calculatorJsonProvenanceKey(imported)
    return Boolean(importedKey && calculatorJsonProvenanceKey(existing) === importedKey)
}

export function planDriveDiscReconciliation({
    existingDiscs = [],
    importedDiscs = [],
    ownerId = "default",
    sourceKind = "scanner",
    resolutions = {},
    now = nowIso(),
    options = {},
}) {
    const normalizedOwnerId = String(ownerId ?? "default")
    const mismatchedExisting = existingDiscs.find(disc => String(disc?.ownerId ?? "default") !== normalizedOwnerId)
    const mismatchedImported = importedDiscs.find(disc => disc?.ownerId != null
        && String(disc.ownerId) !== normalizedOwnerId)
    if (mismatchedExisting || mismatchedImported) {
        throw new Error(`Drive Disc reconciliation cannot cross owner boundary "${normalizedOwnerId}".`)
    }
    const normalizedExisting = existingDiscs.map(disc => withDriveDiscProvenance(
        normalizeDriveDiscUsageRestrictions(normalizeDriveDiscSetAlias(disc, options)),
        options,
    ))
    const normalizedImported = importedDiscs.map(disc => withDriveDiscProvenance(
        normalizeDriveDiscUsageRestrictions(normalizeDriveDiscSetAlias({ ...disc, ownerId: normalizedOwnerId }, options)),
        options,
    ))
    const identityValidation = sourceKind === "enka"
        ? validateEnkaDriveDiscIdentities(normalizedImported, { existingDiscs: normalizedExisting })
        : { blockingErrors: [], hasBlockingErrors: false }
    const nextById = new Map(normalizedExisting.map(disc => [String(disc.id), disc]))
    const initialIds = new Set(nextById.keys())
    const added = []
    const updated = []
    const unchanged = []
    const sourceMerged = []
    const conflicts = []
    const warnings = []
    const resolvedIds = {}
    const matchedExistingIds = new Set()
    const protectedHistoricalIds = new Set()
    const seenWeakContent = new Set()
    const firstImportedIdByEnkaKey = new Map()
    let duplicateInImport = 0
    let historicalDuplicates = 0

    if (identityValidation.hasBlockingErrors) {
        return {
            driveDiscs: existingDiscs.map(cloneJsonValue),
            added,
            updated,
            unchanged,
            sourceMerged,
            conflicts,
            warnings,
            blockingErrors: identityValidation.blockingErrors,
            hasBlockingErrors: true,
            resolvedIds,
            matchedExistingIds,
            protectedHistoricalIds,
            initialIds,
            duplicateInImport,
            historicalDuplicates,
            changed: false,
        }
    }

    normalizedImported.forEach((imported, index) => {
        const incomingEnkaKey = enkaProvenanceKey(imported)
        const firstImportedId = incomingEnkaKey ? firstImportedIdByEnkaKey.get(incomingEnkaKey) : null
        if (firstImportedId != null) {
            duplicateInImport += 1
            resolvedIds[String(imported.id)] = resolvedIds[firstImportedId]
            return
        }
        if (incomingEnkaKey) firstImportedIdByEnkaKey.set(incomingEnkaKey, String(imported.id))
        const hasUnknownStats = hasUnknownDriveDiscStat(imported)
        const weakContentKey = stableStringify(canonicalDriveDiscContent(imported))
        const isWeakDuplicate = !incomingEnkaKey && !hasUnknownStats && seenWeakContent.has(weakContentKey)
        if (!incomingEnkaKey && !hasUnknownStats) seenWeakContent.add(weakContentKey)

        const currentItems = [...nextById.values()]
        let candidates = incomingEnkaKey
            ? currentItems.filter(item => enkaProvenanceKey(item) === incomingEnkaKey)
            : []
        let matchReason = candidates.length ? "same-enka-identity" : ""

        if (!candidates.length && sourceKind === "calculatorJson" && !hasUnknownStats) {
            const sourceRecordId = calculatorJsonProvenanceKey(imported)
            if (sourceRecordId) {
                candidates = currentItems
                    .filter(item => calculatorJsonProvenanceKey(item) === sourceRecordId)
                    .filter(item => !excludesDifferentStrongIdentity(item, imported))
                if (candidates.length) matchReason = "same-native-source"
            }
        }
        if (!candidates.length && sourceKind === "calculatorJson" && !hasUnknownStats) {
            const exactId = nextById.get(String(imported.id))
            if (exactId && !excludesDifferentStrongIdentity(exactId, imported)) {
                candidates = [exactId]
                matchReason = "same-native-id"
            }
        }
        if (!candidates.length && !hasUnknownStats) {
            candidates = contentCandidates(currentItems, imported)
                .filter(item => !excludesDifferentStrongIdentity(item, imported))
            if (candidates.length) matchReason = "same-content"
        }

        if (candidates.length) {
            candidates.sort(candidateSort(sourceKind))
            const existing = candidates[0]
            if (candidates.length > 1) {
                historicalDuplicates += candidates.length - 1
                for (const candidate of candidates) protectedHistoricalIds.add(String(candidate.id))
                warnings.push(`驱动盘 ${imported.setName ?? imported.setId} ${imported.partition}号位存在 ${candidates.length} 条历史重复；本次未新增或删除历史记录。`)
            }
            const observed = sourceWasAlreadyObserved(existing, imported, sourceKind)
            const after = mergeReconciledDriveDisc(existing, imported, { sourceKind, matchReason, now, options })
            matchedExistingIds.add(String(existing.id))
            resolvedIds[String(imported.id)] = String(existing.id)
            if (isWeakDuplicate) duplicateInImport += 1
            if (!observed) {
                nextById.set(String(existing.id), after)
                sourceMerged.push({ id: existing.id, before: existing, after, imported, reason: matchReason })
            } else if (materialDriveDiscSignature(existing) === materialDriveDiscSignature(after)) {
                nextById.set(String(existing.id), existing)
                unchanged.push({ id: existing.id, before: existing, after: existing, imported, reason: matchReason })
            } else {
                nextById.set(String(existing.id), after)
                updated.push({ id: existing.id, before: existing, after, imported, reason: matchReason })
            }
            return
        }

        // A shape-only match is not enough evidence that two records are the
        // same physical disc.  In particular, a level or stat value change is
        // a valid observation of a different disc (and two Enka equipment UIDs
        // always represent different entities).  Exact content matches were
        // handled above; every remaining record therefore gets a new canonical
        // ID instead of entering the old update/add conflict flow.

        const baseId = String(imported.id)
        let nextId = baseId
        let collisionIndex = 0
        while (nextById.has(nextId)) {
            collisionIndex += 1
            nextId = `${baseId}-${hashWith(options, `${baseId}:${collisionIndex}`)}-${collisionIndex}`
        }
        const nextDisc = withDriveDiscProvenance({
            ...imported,
            id: nextId,
            ownerId: normalizedOwnerId,
            createdAt: imported.createdAt ?? now,
            updatedAt: imported.updatedAt ?? now,
        }, options)
        nextById.set(nextId, nextDisc)
        matchedExistingIds.add(nextId)
        resolvedIds[String(imported.id)] = nextId
        added.push(nextDisc)
    })

    return {
        driveDiscs: [...nextById.values()],
        added,
        updated,
        unchanged,
        sourceMerged,
        conflicts,
        warnings,
        blockingErrors: [],
        hasBlockingErrors: false,
        resolvedIds,
        matchedExistingIds,
        protectedHistoricalIds,
        initialIds,
        duplicateInImport,
        historicalDuplicates,
        changed: Boolean(added.length || updated.length || sourceMerged.length),
    }
}

export function reconcileDriveDiscLoadoutSlots(loadouts = [], {
    ownerId = null,
    deletedIds = new Set(),
    remappedIds = new Map(),
} = {}) {
    if (!deletedIds?.size && !remappedIds?.size) {
        return loadouts ?? []
    }
    return (loadouts ?? []).map(loadout => {
        if (ownerId !== null && (loadout.ownerId ?? "default") !== ownerId) {
            return loadout
        }
        const idsBySlot = { ...(loadout.driveDiscIdsBySlot ?? {}) }
        const removedFromLoadout = []
        const remappedFromLoadout = []
        let changed = false
        for (const [slot, id] of Object.entries(idsBySlot)) {
            const replacementId = remappedIds.get(id)
            if (replacementId && replacementId !== id) {
                idsBySlot[slot] = replacementId
                remappedFromLoadout.push(id)
                changed = true
            }
            const currentId = idsBySlot[slot]
            if (deletedIds.has(currentId)) {
                delete idsBySlot[slot]
                removedFromLoadout.push(currentId)
                changed = true
            }
        }
        if (!changed) return loadout
        const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !idsBySlot[String(slot)])
        const missingDriveDiscIds = [
            ...(loadout.missingDriveDiscIds ?? []).filter(id => !remappedFromLoadout.includes(id)),
            ...removedFromLoadout,
        ]
        const nextLoadout = {
            ...loadout,
            driveDiscIdsBySlot: idsBySlot,
            status: missingSlots.length ? "incomplete" : "complete",
            missingSlots,
            missingDriveDiscIds: missingSlots.length ? [...new Set(missingDriveDiscIds)] : [],
            updatedAt: nowIso(),
        }
        return nextLoadout
    })
}

export function buildScannerImportPlan(currentStore, input, options = {}) {
    const normalizedCurrentStore = normalizeInventoryStore(currentStore, options)
    const effectiveOwnerId = options.ownerId ?? normalizedCurrentStore.currentOwnerId
    const normalized = normalizeDriveDiscImport(input, {
        ...options,
        ownerId: effectiveOwnerId,
        removeMissing: Boolean(options.removeMissing),
    })
    const nativeImport = normalized.importRecord.type === DRIVE_DISC_EXPORT_FORMAT
    const sourceKind = sourceKindForImport(normalized.importRecord)
    const ownerId = normalized.importRecord.ownerId
    const owners = normalizedCurrentStore.owners?.some(owner => owner.id === ownerId)
        ? normalizedCurrentStore.owners
        : [...(normalizedCurrentStore.owners ?? []), { id: ownerId, label: ownerId }]
    const belongsToOwner = item => (item.ownerId ?? "default") === ownerId
    const existingSameOwner = (normalizedCurrentStore.driveDiscs ?? []).filter(belongsToOwner)
    const sourceDriveDiscs = Array.isArray(currentStore?.driveDiscs)
        ? currentStore.driveDiscs
        : normalizedCurrentStore.driveDiscs ?? []
    const existingOtherOwners = sourceDriveDiscs.filter(item => !belongsToOwner(item))
    const reconciliation = planDriveDiscReconciliation({
        existingDiscs: existingSameOwner,
        importedDiscs: normalized.driveDiscs,
        ownerId,
        sourceKind,
        resolutions: options.resolutions ?? {},
        now: options.now ?? normalized.importRecord.importedAt ?? nowIso(),
        options,
    })
    const nextSameOwner = new Map(reconciliation.driveDiscs.map(item => [String(item.id), item]))
    const deletedIds = new Set()
    const removedMissingIds = new Set()
    const remappedIds = new Map()
    const removed = []
    const sourceDetached = []
    const warnings = [...(normalized.importRecord.warnings ?? []), ...reconciliation.warnings]
    const summary = {
        added: reconciliation.added.length,
        skipped: reconciliation.unchanged.length,
        updated: reconciliation.updated.length,
        removed: 0,
        duplicateInImport: reconciliation.duplicateInImport,
        deduplicated: 0,
        sourceMerged: reconciliation.sourceMerged.length,
        sourceDetached: 0,
        conflicts: reconciliation.conflicts.length,
        historicalDuplicates: reconciliation.historicalDuplicates,
        warnings,
    }
    const removeMissingRarities = Array.isArray(options.removeMissingRarities)
        ? new Set(options.removeMissingRarities.map(value => String(value).trim().toUpperCase()).filter(Boolean))
        : null

    if (options.removeMissing) {
        for (const disc of existingSameOwner) {
            if (removeMissingRarities?.size && !removeMissingRarities.has(String(disc.rarity ?? "").toUpperCase())) {
                continue
            }
            if (reconciliation.matchedExistingIds.has(String(disc.id)) || !nextSameOwner.has(String(disc.id))) continue
            if (reconciliation.protectedHistoricalIds.has(String(disc.id))) continue
            if (!nativeImport && !disc.provenance?.scanner) continue
            const otherSources = disc.provenance?.enkaZzz || disc.provenance?.calculatorJson || disc.provenance?.manual
            if (!nativeImport && otherSources) {
                const provenance = cloneJsonValue(disc.provenance)
                delete provenance.scanner
                const after = withDriveDiscProvenance({
                    ...disc,
                    provenance,
                    source: projectDriveDiscSource(provenance, provenance.enkaZzz ? disc.source : null),
                    updatedAt: options.now ?? nowIso(),
                }, options)
                nextSameOwner.set(String(disc.id), after)
                sourceDetached.push({ id: disc.id, before: disc, after, reason: "scanner-missing-other-source-preserved" })
                continue
            }
            nextSameOwner.delete(String(disc.id))
            deletedIds.add(String(disc.id))
            removedMissingIds.add(String(disc.id))
            removed.push(disc)
        }
        summary.removed = removedMissingIds.size
        summary.sourceDetached = sourceDetached.length
    }

    for (const [importedId, canonicalId] of Object.entries(reconciliation.resolvedIds)) {
        const fromId = String(importedId)
        const toId = String(canonicalId)
        if (fromId !== toId && deletedIds.has(fromId) && nextSameOwner.has(toId)) {
            remappedIds.set(fromId, toId)
        }
    }

    let nextStore = {
        ...normalizedCurrentStore,
        owners,
        imports: [...(normalizedCurrentStore.imports ?? []), { ...normalized.importRecord, summary }],
        driveDiscs: [...existingOtherOwners, ...nextSameOwner.values()],
        driveDiscLoadouts: reconcileDriveDiscLoadoutSlots(normalizedCurrentStore.driveDiscLoadouts ?? [], {
            ownerId,
            deletedIds,
            remappedIds,
        }),
    }
    const changedIds = new Set([
        ...reconciliation.updated.map(item => String(item.id)),
        ...reconciliation.sourceMerged.map(item => String(item.id)),
        ...sourceDetached.map(item => String(item.id)),
        ...removed.map(item => String(item.id)),
    ])
    nextStore = recordNonEnkaBindingSessionChanges({
        storeBefore: normalizedCurrentStore,
        storeAfter: nextStore,
        ownerId,
        touchedDriveDiscIds: [...changedIds],
        driveDiscIdRemap: Object.fromEntries(remappedIds),
    })
    const ownerImportState = nextStore.enkaImportState?.version === 1
        ? nextStore.enkaImportState.byOwner?.[ownerId]
        : null
    const journal = ownerImportState?.undoJournal
    const invalidatesUndo = Boolean(journal?.affectedDriveDiscIds?.some(id => changedIds.has(String(id))))
    if (invalidatesUndo) {
        const overlap = (journal.affectedDriveDiscIds ?? []).filter(id => changedIds.has(String(id)))
        nextStore = {
            ...nextStore,
            enkaImportState: {
                ...nextStore.enkaImportState,
                byOwner: {
                    ...nextStore.enkaImportState.byOwner,
                    [ownerId]: {
                        ...ownerImportState,
                        undoJournal: {
                            ...journal,
                            status: "invalidated",
                            invalidatedBy: sourceKind,
                            invalidatedAt: options.now ?? nowIso(),
                            overlap: { driveDiscIds: overlap },
                        },
                    },
                },
            },
        }
        warnings.push("本次导入修改了上次 Enka 导入涉及的驱动盘，原撤销记录已失效。")
    }
    return {
        currentStore: normalizedCurrentStore,
        ownerId,
        sourceKind,
        normalized,
        reconciliation,
        driveDiscIdRemap: Object.fromEntries(remappedIds),
        deletedDriveDiscIds: [...deletedIds],
        summary,
        nextStore,
        hasUnresolvedConflicts: reconciliation.conflicts.length > 0,
        preview: {
            ownerId,
            sourceKind,
            importType: normalized.importRecord.type,
            sourcePath: normalized.importRecord.sourcePath,
            removeMissing: Boolean(options.removeMissing),
            removeMissingRarities: removeMissingRarities ? [...removeMissingRarities] : null,
            currentCount: existingSameOwner.length,
            nextCount: nextSameOwner.size,
            normalizedDiscs: normalized.driveDiscs,
            added: reconciliation.added,
            updated: reconciliation.updated,
            unchanged: reconciliation.unchanged,
            sourceMerged: reconciliation.sourceMerged,
            sourceDetached,
            conflicts: reconciliation.conflicts,
            removed,
            warnings,
            invalidatesEnkaUndo: invalidatesUndo,
            summary,
        },
    }
}

export function clearOwnerInventory(store, ownerId = null) {
    const scopedOwnerId = ownerId ?? store.currentOwnerId
    const belongsToOwner = item => (item.ownerId ?? "default") === scopedOwnerId
    return {
        ownerId: scopedOwnerId,
        previous: {
            imports: (store.imports ?? []).filter(belongsToOwner).length,
            driveDiscs: (store.driveDiscs ?? []).filter(belongsToOwner).length,
            driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(belongsToOwner).length,
        },
        nextStore: {
            ...store,
            imports: (store.imports ?? []).filter(item => !belongsToOwner(item)),
            driveDiscs: (store.driveDiscs ?? []).filter(item => !belongsToOwner(item)),
            driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => !belongsToOwner(item)),
        },
    }
}

export function upsertDriveDisc(store, driveDisc, options = {}) {
    if (!driveDisc?.id) {
        throw new Error("Drive disc id is required.")
    }
    const normalizedDriveDisc = normalizeDriveDiscSetAlias(driveDisc, options)
    const ownerId = normalizedDriveDisc.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscs ?? []
    const matches = item => item.id === normalizedDriveDisc.id && (item.ownerId ?? "default") === ownerId
    const index = existing.findIndex(matches)
    const currentDriveDisc = index >= 0 ? existing[index] : null
    const reservedForAgentId = Object.prototype.hasOwnProperty.call(normalizedDriveDisc, "reservedForAgentId")
        ? cleanReservedForAgentId(normalizedDriveDisc.reservedForAgentId)
        : cleanReservedForAgentId(currentDriveDisc?.reservedForAgentId)
    const excludedForAgentIds = Object.prototype.hasOwnProperty.call(normalizedDriveDisc, "excludedForAgentIds")
        ? normalizeExcludedForAgentIds(normalizedDriveDisc.excludedForAgentIds, reservedForAgentId)
        : normalizeExcludedForAgentIds(currentDriveDisc?.excludedForAgentIds, reservedForAgentId)
    const editedAt = nowIso()
    const provenance = mergeDriveDiscProvenance(
        withDriveDiscProvenance(currentDriveDisc ?? normalizedDriveDisc, options).provenance,
        {
            version: DRIVE_DISC_PROVENANCE_VERSION,
            manual: { lastEditedAt: editedAt },
        },
    )
    const nextDriveDisc = withDriveDiscProvenance({
        ...normalizedDriveDisc,
        ownerId,
        reservedForAgentId,
        excludedForAgentIds,
        provenance,
        source: projectDriveDiscSource(provenance, normalizedDriveDisc.source),
        updatedAt: editedAt,
    }, options)
    const nextStore = recordNonEnkaBindingSessionChanges({
        storeBefore: store,
        storeAfter: {
            ...store,
            driveDiscs: index >= 0 ? existing.map(item => matches(item) ? nextDriveDisc : item) : [...existing, nextDriveDisc],
        },
        ownerId,
        touchedDriveDiscIds: [nextDriveDisc.id],
    })
    return {
        ownerId,
        driveDisc: nextDriveDisc,
        nextStore,
    }
}

export function setDriveDiscReservations(store, input = {}) {
    const ownerId = String(input.ownerId ?? store.currentOwnerId ?? "default")
    const discIds = [...new Set((input.discIds ?? [])
        .map(id => String(id ?? "").trim())
        .filter(Boolean))]
    if (!discIds.length) {
        throw new Error("At least one Drive Disc id is required.")
    }

    const targetAgentId = cleanReservedForAgentId(input.reservedForAgentId)
    const requestedIds = new Set(discIds)
    const ownerDiscs = (store.driveDiscs ?? [])
        .filter(disc => (disc.ownerId ?? "default") === ownerId && requestedIds.has(String(disc.id)))
    const foundIds = new Set(ownerDiscs.map(disc => String(disc.id)))
    const missingIds = discIds.filter(id => !foundIds.has(id))
    if (missingIds.length) {
        throw new Error(`Drive Disc reservation references missing ids: ${missingIds.join(", ")}.`)
    }

    const reservationConflicts = targetAgentId
        ? ownerDiscs
            .filter(disc => cleanReservedForAgentId(disc.reservedForAgentId)
                && cleanReservedForAgentId(disc.reservedForAgentId) !== targetAgentId)
            .map(disc => ({
                discId: String(disc.id),
                currentAgentId: cleanReservedForAgentId(disc.reservedForAgentId),
                requestedAgentId: targetAgentId,
            }))
        : []
    const exclusionConflicts = targetAgentId
        ? ownerDiscs
            .filter(disc => normalizeExcludedForAgentIds(disc.excludedForAgentIds, disc.reservedForAgentId).includes(targetAgentId))
            .map(disc => ({
                kind: "excluded-current",
                discId: String(disc.id),
                currentAgentId: targetAgentId,
                requestedAgentId: targetAgentId,
            }))
        : []
    const conflicts = [...reservationConflicts, ...exclusionConflicts]
    if ((reservationConflicts.length && input.allowTransfer !== true)
        || (exclusionConflicts.length && input.allowExclusionOverride !== true)) {
        return {
            ownerId,
            applied: false,
            changedIds: [],
            conflicts,
            nextStore: store,
        }
    }

    const changedIds = ownerDiscs
        .filter(disc => cleanReservedForAgentId(disc.reservedForAgentId) !== targetAgentId
            || (targetAgentId && normalizeExcludedForAgentIds(disc.excludedForAgentIds, disc.reservedForAgentId).includes(targetAgentId)))
        .map(disc => String(disc.id))
    const changedIdSet = new Set(changedIds)
    const updatedAt = nowIso()
    return {
        ownerId,
        applied: true,
        changedIds,
        conflicts,
        nextStore: {
            ...store,
            driveDiscs: (store.driveDiscs ?? []).map(disc =>
                (disc.ownerId ?? "default") === ownerId && changedIdSet.has(String(disc.id))
                    ? {
                        ...disc,
                        reservedForAgentId: targetAgentId,
                        excludedForAgentIds: normalizeExcludedForAgentIds(disc.excludedForAgentIds, targetAgentId),
                        updatedAt,
                    }
                    : disc
            ),
        },
    }
}

export function setDriveDiscExclusions(store, input = {}) {
    const ownerId = String(input.ownerId ?? store.currentOwnerId ?? "default")
    const discIds = [...new Set((input.discIds ?? [])
        .map(id => String(id ?? "").trim())
        .filter(Boolean))]
    if (!discIds.length) {
        throw new Error("At least one Drive Disc id is required.")
    }
    const excludedForAgentId = String(input.excludedForAgentId ?? "").trim()
    if (!excludedForAgentId) {
        throw new Error("Drive Disc exclusion agent id is required.")
    }

    const requestedIds = new Set(discIds)
    const ownerDiscs = (store.driveDiscs ?? [])
        .filter(disc => (disc.ownerId ?? "default") === ownerId && requestedIds.has(String(disc.id)))
    const foundIds = new Set(ownerDiscs.map(disc => String(disc.id)))
    const missingIds = discIds.filter(id => !foundIds.has(id))
    if (missingIds.length) {
        throw new Error(`Drive Disc exclusion references missing ids: ${missingIds.join(", ")}.`)
    }

    const excluded = input.excluded !== false
    const conflicts = ownerDiscs.flatMap(disc => {
        const reservedForAgentId = cleanReservedForAgentId(disc.reservedForAgentId)
        if (!reservedForAgentId) return []
        if (reservedForAgentId === excludedForAgentId && excluded && input.allowReservationRelease !== true) {
            return [{
                kind: "reserved-current",
                discId: String(disc.id),
                currentAgentId: reservedForAgentId,
                requestedAgentId: excludedForAgentId,
            }]
        }
        if (reservedForAgentId !== excludedForAgentId) {
            return [{
                kind: "excluded-by-reservation",
                discId: String(disc.id),
                currentAgentId: reservedForAgentId,
                requestedAgentId: excludedForAgentId,
            }]
        }
        return []
    })
    if (conflicts.length) {
        return {
            ownerId,
            applied: false,
            changedIds: [],
            conflicts,
            nextStore: store,
        }
    }

    const changedIds = ownerDiscs
        .filter(disc => {
            const reservedForAgentId = cleanReservedForAgentId(disc.reservedForAgentId)
            const exclusions = normalizeExcludedForAgentIds(disc.excludedForAgentIds, reservedForAgentId)
            return (excluded && !exclusions.includes(excludedForAgentId))
                || (!excluded && exclusions.includes(excludedForAgentId))
                || (excluded && reservedForAgentId === excludedForAgentId)
        })
        .map(disc => String(disc.id))
    const changedIdSet = new Set(changedIds)
    const updatedAt = nowIso()
    return {
        ownerId,
        applied: true,
        changedIds,
        conflicts: [],
        nextStore: {
            ...store,
            driveDiscs: (store.driveDiscs ?? []).map(disc => {
                if ((disc.ownerId ?? "default") !== ownerId || !changedIdSet.has(String(disc.id))) {
                    return disc
                }
                const reservedForAgentId = cleanReservedForAgentId(disc.reservedForAgentId)
                const nextReservedForAgentId = excluded && reservedForAgentId === excludedForAgentId
                    ? null
                    : reservedForAgentId
                const exclusions = normalizeExcludedForAgentIds(disc.excludedForAgentIds, nextReservedForAgentId)
                const nextExclusions = excluded
                    ? [...new Set([...exclusions, excludedForAgentId])]
                    : exclusions.filter(agentId => agentId !== excludedForAgentId)
                return {
                    ...disc,
                    reservedForAgentId: nextReservedForAgentId,
                    excludedForAgentIds: nextExclusions,
                    updatedAt,
                }
            }),
        },
    }
}

export function deleteDriveDisc(store, id) {
    const ownerId = store.currentOwnerId
    const before = store.driveDiscs ?? []
    const matches = item => item.id === id && (item.ownerId ?? "default") === ownerId
    const deletedDisc = before.find(matches)
    return {
        ownerId,
        deleted: Boolean(deletedDisc),
        nextStore: {
            ...store,
            driveDiscs: before.filter(item => !matches(item)),
            driveDiscLoadouts: deletedDisc
                ? reconcileDriveDiscLoadoutSlots(store.driveDiscLoadouts ?? [], {
                    ownerId,
                    deletedIds: new Set([id]),
                })
                : store.driveDiscLoadouts ?? [],
        },
    }
}

function cleanDriveDiscIdsBySlot(driveDiscIdsBySlot = {}) {
    return Object.fromEntries(
        Object.entries(driveDiscIdsBySlot ?? {})
            .map(([slot, id]) => [String(Number(slot)), String(id ?? "").trim()])
            .filter(([slot, id]) => Number(slot) >= 1 && Number(slot) <= 6 && id)
    )
}

export function normalizeDriveDiscLoadout(loadout, existing = null) {
    const id = String(loadout?.id ?? existing?.id ?? `loadout-${Date.now()}`).trim()
    const agentId = String(loadout?.agentId ?? existing?.agentId ?? "").trim()
    if (!id) throw new Error("Drive disc loadout id is required.")
    if (!agentId) throw new Error("Drive disc loadout agentId is required.")
    const driveDiscIdsBySlot = cleanDriveDiscIdsBySlot(loadout?.driveDiscIdsBySlot ?? existing?.driveDiscIdsBySlot)
    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !driveDiscIdsBySlot[String(slot)])
    const now = nowIso()
    return {
        ...(existing ?? {}),
        ...loadout,
        id,
        agentId,
        name: String(loadout?.name ?? existing?.name ?? "未命名套装").trim() || "未命名套装",
        ownerId: String(loadout?.ownerId ?? existing?.ownerId ?? "default"),
        driveDiscIdsBySlot,
        status: missingSlots.length ? "incomplete" : "complete",
        missingSlots,
        missingDriveDiscIds: missingSlots.length ? loadout?.missingDriveDiscIds ?? existing?.missingDriveDiscIds ?? [] : [],
        source: loadout?.source ?? existing?.source ?? { type: "manual" },
        score: Number.isFinite(Number(loadout?.score)) ? Number(loadout.score) : existing?.score ?? null,
        createdAt: existing?.createdAt ?? loadout?.createdAt ?? now,
        updatedAt: now,
    }
}

function completeLoadoutDiscIds(store, loadout, ownerId) {
    const entries = [1, 2, 3, 4, 5, 6].map(slot => [slot, loadout.driveDiscIdsBySlot?.[String(slot)]])
    const missingSlots = entries.filter(([, id]) => !id).map(([slot]) => slot)
    if (missingSlots.length) {
        throw new Error(`Cannot reserve an incomplete Drive Disc loadout. Missing slots: ${missingSlots.join(", ")}.`)
    }
    const discIds = entries.map(([, id]) => String(id))
    if (new Set(discIds).size !== discIds.length) {
        throw new Error("Cannot reserve a Drive Disc loadout that reuses the same disc in multiple slots.")
    }
    const ownerDiscs = new Map((store.driveDiscs ?? [])
        .filter(disc => (disc.ownerId ?? "default") === ownerId)
        .map(disc => [String(disc.id), disc]))
    for (const [slot, id] of entries) {
        const disc = ownerDiscs.get(String(id))
        if (!disc) {
            throw new Error(`Cannot reserve Drive Disc loadout: slot ${slot} references missing disc "${id}".`)
        }
        if (Number(disc.partition) !== slot) {
            throw new Error(`Cannot reserve Drive Disc loadout: disc "${id}" does not belong to slot ${slot}.`)
        }
    }
    return discIds
}

export function driveDiscReservationStateForLoadout(store, loadout) {
    const ownerId = String(loadout?.ownerId ?? store?.currentOwnerId ?? "default")
    const idsBySlot = loadout?.driveDiscIdsBySlot ?? loadout?.idsBySlot ?? {}
    const ownerDiscs = new Map((store?.driveDiscs ?? [])
        .filter(disc => (disc.ownerId ?? "default") === ownerId)
        .map(disc => [String(disc.id), disc]))
    let presentCount = 0
    let reservedCount = 0
    let conflictingCount = 0
    const missingSlots = []
    for (const slot of [1, 2, 3, 4, 5, 6]) {
        const id = String(idsBySlot[String(slot)] ?? "").trim()
        const disc = id ? ownerDiscs.get(id) : null
        if (!disc || Number(disc.partition) !== slot) {
            missingSlots.push(slot)
            continue
        }
        presentCount += 1
        const reservedForAgentId = cleanReservedForAgentId(disc.reservedForAgentId)
        if (reservedForAgentId === loadout?.agentId) reservedCount += 1
        else if (reservedForAgentId) conflictingCount += 1
    }
    const complete = missingSlots.length === 0
    return {
        ownerId,
        complete,
        presentCount,
        reservedCount,
        conflictingCount,
        missingSlots,
        fullyReserved: complete && reservedCount === 6,
    }
}

export function upsertDriveDiscLoadout(store, loadout, options = {}) {
    const ownerId = loadout.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscLoadouts ?? []
    const id = String(loadout?.id ?? "").trim() || `loadout-${Date.now()}`
    const matches = item => item.id === id && (item.ownerId ?? "default") === ownerId
    const index = existing.findIndex(matches)
    const nextLoadout = normalizeDriveDiscLoadout({ ...loadout, id, ownerId }, index >= 0 ? existing[index] : null)
    const storeWithLoadout = {
        ...store,
        driveDiscLoadouts: index >= 0
            ? existing.map(item => matches(item) ? nextLoadout : item)
            : [...existing, nextLoadout],
    }
    if (options.reserveDiscs === true) {
        const discIds = completeLoadoutDiscIds(store, nextLoadout, ownerId)
        const reservation = setDriveDiscReservations(storeWithLoadout, {
            ownerId,
            discIds,
            reservedForAgentId: nextLoadout.agentId,
            allowTransfer: options.allowTransfer === true,
        })
        return {
            ...reservation,
            ownerId,
            loadout: nextLoadout,
            nextStore: reservation.applied ? reservation.nextStore : store,
        }
    }
    return {
        ownerId,
        applied: true,
        changedIds: [],
        conflicts: [],
        loadout: nextLoadout,
        nextStore: storeWithLoadout,
    }
}

export function deleteDriveDiscLoadout(store, id) {
    const ownerId = store.currentOwnerId
    const before = store.driveDiscLoadouts ?? []
    const matches = item => item.id === id && (item.ownerId ?? "default") === ownerId
    const driveDiscLoadouts = before.filter(item => !matches(item))
    return {
        ownerId,
        deleted: before.length !== driveDiscLoadouts.length,
        nextStore: { ...store, driveDiscLoadouts },
    }
}

export function accountSummary(store) {
    const enkaByOwner = store?.enkaImportState?.version === 1 ? store.enkaImportState.byOwner ?? {} : {}
    return {
        currentOwnerId: store.currentOwnerId,
        owners: (store.owners ?? []).map(owner => ({
            ...owner,
            driveDiscCount: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
            loadoutCount: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
            importCount: (store.imports ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
            enkaUid: enkaByOwner[owner.id]?.binding?.uid ?? null,
        })),
    }
}

function uniqueOwnerId(baseId, owners) {
    const used = new Set((owners ?? []).map(owner => owner.id))
    let id = cleanOwnerId(baseId) || `account-${Date.now()}`
    if (!used.has(id)) return id
    let index = 2
    while (used.has(`${id}-${index}`)) index += 1
    return `${id}-${index}`
}

export function createAccount(store, account = {}) {
    const id = uniqueOwnerId(account.id ?? `account-${Date.now()}`, store.owners)
    const label = String(account.label ?? account.name ?? "新账号").trim() || "新账号"
    const createdAccount = { id, label }
    return {
        account: createdAccount,
        nextStore: { ...store, owners: [...(store.owners ?? []), createdAccount] },
    }
}

export function updateAccount(store, id, patch = {}) {
    const ownerId = cleanOwnerId(id)
    const owners = (store.owners ?? []).map(owner => owner.id === ownerId
        ? { ...owner, label: String(patch.label ?? patch.name ?? owner.label).trim() || owner.label }
        : owner)
    if (!owners.some(owner => owner.id === ownerId)) throw new Error("Account not found.")
    return {
        account: owners.find(owner => owner.id === ownerId),
        nextStore: { ...store, owners },
    }
}

export function switchAccount(store, id) {
    const ownerId = cleanOwnerId(id)
    if (!(store.owners ?? []).some(owner => owner.id === ownerId)) throw new Error("Account not found.")
    return { ownerId, nextStore: { ...store, currentOwnerId: ownerId } }
}

export function deleteAccount(store, id) {
    const ownerId = cleanOwnerId(id)
    if (ownerId === store.currentOwnerId) throw new Error("Cannot delete the current account.")
    if (!(store.owners ?? []).some(owner => owner.id === ownerId)) throw new Error("Account not found.")
    const enkaImportState = store.enkaImportState?.version === 1
        ? {
            ...store.enkaImportState,
            byOwner: Object.fromEntries(
                Object.entries(store.enkaImportState.byOwner ?? {}).filter(([key]) => key !== ownerId),
            ),
        }
        : store.enkaImportState
    const driveDiscImportState = store.driveDiscImportState?.version === 1
        ? {
            ...store.driveDiscImportState,
            byOwner: Object.fromEntries(
                Object.entries(store.driveDiscImportState.byOwner ?? {}).filter(([key]) => key !== ownerId),
            ),
        }
        : store.driveDiscImportState
    return {
        ownerId,
        deleted: true,
        nextStore: {
            ...store,
            owners: (store.owners ?? []).filter(owner => owner.id !== ownerId),
            imports: (store.imports ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
            driveDiscs: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
            driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
            ...(enkaImportState ? { enkaImportState } : {}),
            ...(driveDiscImportState ? { driveDiscImportState } : {}),
        },
    }
}
