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
}

export const DRIVE_DISC_EXPORT_FORMAT = "zzz-calculator-drive-disc-export"
export const DRIVE_DISC_EXPORT_VERSION = 1

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
    if (includeValue) {
        entry.value = normalizedStatValue(stat?.value)
    }
    return entry
}

export function driveDiscContentFingerprint(disc, options = {}) {
    return hashWith(options, stableStringify({
        setName: disc?.setName ?? "",
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? ""),
        level: Number(disc?.level ?? 0),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: true }),
        subStats: (disc?.subStats ?? []).map(stat => statFingerprintEntry(stat, { includeValue: true })),
    }))
}

export function driveDiscIdentityFingerprint(disc, options = {}) {
    return hashWith(options, stableStringify({
        setName: disc?.setName ?? "",
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? ""),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: false }),
        subStats: (disc?.subStats ?? []).map(stat => statFingerprintEntry(stat, { includeValue: false })),
    }))
}

export function withDriveDiscFingerprints(disc, options = {}) {
    const next = { ...(disc ?? {}) }
    next.contentFingerprint = driveDiscContentFingerprint(next, options)
    next.identityFingerprint = driveDiscIdentityFingerprint(next, options)
    return next
}

function cleanReservedForAgentId(value) {
    const agentId = String(value ?? "").trim()
    return agentId || null
}

function normalizeDriveDiscReservation(disc) {
    return {
        ...(disc ?? {}),
        reservedForAgentId: cleanReservedForAgentId(disc?.reservedForAgentId),
    }
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
            ? store.driveDiscs.map(disc => withDriveDiscFingerprints(normalizeDriveDiscReservation(disc), options))
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
        sourceAccount: { label: owner.label },
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
    const entry = STAT_LABELS[label]
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
    const setMatch = options.setAliases?.[setName] ?? DRIVE_DISC_SET_ALIASES[setName]
    const partition = Number(rawItem["槽位"] ?? 0)
    const rarity = String(rawItem["品质"] ?? "S")
    const level = Number(rawItem["等级"] ?? 0)
    const maxLevel = Number(rawItem["最大等级"] ?? level)
    const normalized = {
        id: `scanner-${sourceSequence}-${hashWith(options, `${options.ownerId}:${setName}:${partition}:${rarity}:${stableStringify(rawItem["主属性"])}:${stableStringify(rawItem["副属性"])}`)}`,
        ownerId: options.ownerId,
        setId: setMatch?.id ?? `scanner-set-${hashWith(options, setName)}`,
        setName,
        canonicalSetName: setMatch?.name ?? null,
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
    }
    const withFingerprints = withDriveDiscFingerprints(normalized, options)
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
    return withDriveDiscFingerprints({
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
    const importId = options.importId ?? `zzz-calculator-export-${hashWith(options, `${ownerId}:${sourcePath ?? ""}:${importedAt}`)}`
    const driveDiscs = input.driveDiscs.map((item, index) =>
        normalizeNativeDriveDisc(item, index, { ...options, ownerId })
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
    if (input && typeof input === "object" && !Array.isArray(input) && Object.hasOwn(input, "format")) {
        if (input.format !== DRIVE_DISC_EXPORT_FORMAT) {
            throw new Error(`Unsupported Drive Disc import format "${input.format}".`)
        }
        return normalizeNativeDriveDiscExport(input, options)
    }
    return normalizeScannerExport(input, options)
}

function buildDuplicateAwareIndex(items, keyOf) {
    const result = new Map()
    for (const item of items ?? []) {
        const key = keyOf(item)
        if (!key) continue
        const existing = result.get(key) ?? []
        existing.push(item)
        result.set(key, existing)
    }
    return result
}

function matchedImportSource(source, options) {
    return {
        ...(source ?? {}),
        [options.matchedAtField ?? "matchedAt"]: nowIso(),
    }
}

function mergeImportedDriveDisc(existing, imported, options) {
    const createdAt = options.preserveCreatedAtOnMerge === false
        ? {}
        : { createdAt: existing.createdAt ?? imported.createdAt ?? nowIso() }
    return withDriveDiscFingerprints({
        ...existing,
        ...imported,
        id: existing.id,
        ownerId: existing.ownerId ?? imported.ownerId,
        locked: existing.locked ?? imported.locked ?? false,
        equippedBy: existing.equippedBy ?? imported.equippedBy ?? null,
        reservedForAgentId: existing.reservedForAgentId ?? imported.reservedForAgentId ?? null,
        ...createdAt,
        updatedAt: nowIso(),
        source: matchedImportSource({
            ...(existing.source ?? {}),
            ...(imported.source ?? {}),
            previousImportId: existing.source?.importId ?? null,
        }, options),
    }, options)
}

function nativeDriveDiscComparable(disc) {
    return stableStringify(driveDiscForExport(disc))
}

function mergeNativeDriveDisc(existing, imported, options) {
    return withDriveDiscFingerprints({
        ...existing,
        ...imported,
        id: existing.id,
        ownerId: existing.ownerId ?? imported.ownerId,
    }, options)
}

function removeDuplicateContentMatches(contentMatches, keepId, nextSameOwner, remappedIds, deletedIds) {
    let removed = 0
    for (const duplicate of contentMatches ?? []) {
        if (!duplicate?.id || duplicate.id === keepId || !nextSameOwner.has(duplicate.id)) continue
        nextSameOwner.delete(duplicate.id)
        remappedIds.set(duplicate.id, keepId)
        deletedIds.add(duplicate.id)
        removed += 1
    }
    return removed
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
    const effectiveOwnerId = options.ownerId ?? currentStore.currentOwnerId
    const normalized = normalizeDriveDiscImport(input, {
        ...options,
        ownerId: effectiveOwnerId,
        removeMissing: Boolean(options.removeMissing),
    })
    const nativeImport = normalized.importRecord.type === DRIVE_DISC_EXPORT_FORMAT
    const ownerId = normalized.importRecord.ownerId
    const owners = currentStore.owners?.some(owner => owner.id === ownerId)
        ? currentStore.owners
        : [...(currentStore.owners ?? []), { id: ownerId, label: ownerId }]
    const belongsToOwner = item => (item.ownerId ?? "default") === ownerId
    const existingSameOwner = (currentStore.driveDiscs ?? []).filter(belongsToOwner)
    const existingOtherOwners = (currentStore.driveDiscs ?? []).filter(item => !belongsToOwner(item))
    const byContent = buildDuplicateAwareIndex(existingSameOwner, item => item.contentFingerprint)
    const byIdentity = buildDuplicateAwareIndex(existingSameOwner, item => item.identityFingerprint)
    const nextSameOwner = new Map(existingSameOwner.map(item => [item.id, item]))
    const matchedExistingIds = new Set()
    const seenImportContent = new Set()
    const deletedIds = new Set()
    const removedMissingIds = new Set()
    const remappedIds = new Map()
    const added = []
    const updated = []
    const unchanged = []
    const removed = []
    const summary = {
        added: 0,
        skipped: 0,
        updated: 0,
        removed: 0,
        duplicateInImport: 0,
        deduplicated: 0,
        warnings: normalized.importRecord.warnings ?? [],
    }
    const removeMissingRarities = Array.isArray(options.removeMissingRarities)
        ? new Set(options.removeMissingRarities.map(value => String(value).trim().toUpperCase()).filter(Boolean))
        : null

    for (const imported of normalized.driveDiscs) {
        if (nativeImport) {
            const existing = nextSameOwner.get(imported.id)
            if (existing) {
                const before = existing
                const after = mergeNativeDriveDisc(before, imported, options)
                matchedExistingIds.add(existing.id)
                nextSameOwner.set(existing.id, after)
                if (nativeDriveDiscComparable(before) === nativeDriveDiscComparable(after)) {
                    summary.skipped += 1
                    unchanged.push({ id: existing.id, before, after, imported, reason: "same-native-record" })
                } else {
                    summary.updated += 1
                    updated.push({ id: existing.id, before, after, imported, reason: "same-native-id" })
                }
                continue
            }
        } else if (seenImportContent.has(imported.contentFingerprint)) {
            summary.duplicateInImport += 1
            continue
        }
        if (!nativeImport) seenImportContent.add(imported.contentFingerprint)
        const contentMatches = byContent.get(imported.contentFingerprint) ?? []
        if (contentMatches.length) {
            const existing = contentMatches.find(item => nextSameOwner.has(item.id)) ?? contentMatches[0]
            const before = nextSameOwner.get(existing.id) ?? existing
            const after = mergeImportedDriveDisc(before, imported, options)
            matchedExistingIds.add(existing.id)
            nextSameOwner.set(existing.id, after)
            summary.deduplicated += removeDuplicateContentMatches(contentMatches, existing.id, nextSameOwner, remappedIds, deletedIds)
            summary.skipped += 1
            unchanged.push({ id: existing.id, before, after, imported, reason: "same-content" })
            continue
        }

        const identityMatches = byIdentity.get(imported.identityFingerprint) ?? []
        if (identityMatches.length === 1 && Number(imported.level ?? 0) > Number(identityMatches[0].level ?? 0)) {
            const existing = identityMatches[0]
            const before = nextSameOwner.get(existing.id) ?? existing
            const after = mergeImportedDriveDisc(before, imported, options)
            matchedExistingIds.add(existing.id)
            nextSameOwner.set(existing.id, after)
            summary.updated += 1
            updated.push({ id: existing.id, before, after, imported, reason: "higher-level-same-identity" })
            continue
        }

        let nextId = imported.id
        while (nextSameOwner.has(nextId) || (!nativeImport && existingOtherOwners.some(item => item.id === nextId))) {
            nextId = `scanner-${imported.contentFingerprint}-${hashWith(options, `${nextId}:${nextSameOwner.size}`)}`
        }
        const nextDisc = withDriveDiscFingerprints({
            ...imported,
            id: nextId,
            createdAt: imported.createdAt ?? nowIso(),
            updatedAt: imported.updatedAt ?? nowIso(),
        }, options)
        nextSameOwner.set(nextDisc.id, nextDisc)
        matchedExistingIds.add(nextDisc.id)
        summary.added += 1
        added.push(nextDisc)
    }

    if (options.removeMissing) {
        for (const disc of existingSameOwner) {
            if (removeMissingRarities?.size && !removeMissingRarities.has(String(disc.rarity ?? "").toUpperCase())) {
                continue
            }
            if (!matchedExistingIds.has(disc.id) && nextSameOwner.has(disc.id)) {
                nextSameOwner.delete(disc.id)
                deletedIds.add(disc.id)
                removedMissingIds.add(disc.id)
                removed.push(disc)
            }
        }
        summary.removed = removedMissingIds.size
    }

    const nextStore = {
        ...currentStore,
        owners,
        imports: [...(currentStore.imports ?? []), { ...normalized.importRecord, summary }],
        driveDiscs: [...existingOtherOwners, ...nextSameOwner.values()],
        driveDiscLoadouts: reconcileDriveDiscLoadoutSlots(currentStore.driveDiscLoadouts ?? [], {
            ownerId,
            deletedIds,
            remappedIds,
        }),
    }
    return {
        currentStore,
        ownerId,
        normalized,
        summary,
        nextStore,
        preview: {
            ownerId,
            sourcePath: normalized.importRecord.sourcePath,
            removeMissing: Boolean(options.removeMissing),
            removeMissingRarities: removeMissingRarities ? [...removeMissingRarities] : null,
            currentCount: existingSameOwner.length,
            nextCount: nextSameOwner.size,
            normalizedDiscs: normalized.driveDiscs,
            added,
            updated,
            unchanged,
            removed,
            warnings: summary.warnings,
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
    const ownerId = driveDisc.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscs ?? []
    const matches = item => item.id === driveDisc.id && (item.ownerId ?? "default") === ownerId
    const index = existing.findIndex(matches)
    const currentDriveDisc = index >= 0 ? existing[index] : null
    const reservedForAgentId = Object.hasOwn(driveDisc, "reservedForAgentId")
        ? cleanReservedForAgentId(driveDisc.reservedForAgentId)
        : cleanReservedForAgentId(currentDriveDisc?.reservedForAgentId)
    const nextDriveDisc = withDriveDiscFingerprints({
        ...driveDisc,
        ownerId,
        reservedForAgentId,
        updatedAt: nowIso(),
    }, options)
    return {
        ownerId,
        driveDisc: nextDriveDisc,
        nextStore: {
            ...store,
            driveDiscs: index >= 0 ? existing.map(item => matches(item) ? nextDriveDisc : item) : [...existing, nextDriveDisc],
        },
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

    const conflicts = targetAgentId
        ? ownerDiscs
            .filter(disc => cleanReservedForAgentId(disc.reservedForAgentId)
                && cleanReservedForAgentId(disc.reservedForAgentId) !== targetAgentId)
            .map(disc => ({
                discId: String(disc.id),
                currentAgentId: cleanReservedForAgentId(disc.reservedForAgentId),
                requestedAgentId: targetAgentId,
            }))
        : []
    if (conflicts.length && input.allowTransfer !== true) {
        return {
            ownerId,
            applied: false,
            changedIds: [],
            conflicts,
            nextStore: store,
        }
    }

    const changedIds = ownerDiscs
        .filter(disc => cleanReservedForAgentId(disc.reservedForAgentId) !== targetAgentId)
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
                    ? { ...disc, reservedForAgentId: targetAgentId, updatedAt }
                    : disc
            ),
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
    return {
        currentOwnerId: store.currentOwnerId,
        owners: (store.owners ?? []).map(owner => ({
            ...owner,
            driveDiscCount: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
            loadoutCount: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
            importCount: (store.imports ?? []).filter(item => (item.ownerId ?? "default") === owner.id).length,
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
    return {
        ownerId,
        deleted: true,
        nextStore: {
            ...store,
            owners: (store.owners ?? []).filter(owner => owner.id !== ownerId),
            imports: (store.imports ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
            driveDiscs: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
            driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
        },
    }
}
