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
            ? store.driveDiscs.map(disc => withDriveDiscFingerprints(disc, options))
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
    const ownerId = options.ownerId ?? "default"
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
        ...createdAt,
        updatedAt: nowIso(),
        source: matchedImportSource({
            ...(existing.source ?? {}),
            ...(imported.source ?? {}),
            previousImportId: existing.source?.importId ?? null,
        }, options),
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
    const normalized = normalizeScannerExport(input, {
        ...options,
        ownerId: effectiveOwnerId,
        removeMissing: Boolean(options.removeMissing),
    })
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

    for (const imported of normalized.driveDiscs) {
        if (seenImportContent.has(imported.contentFingerprint)) {
            summary.duplicateInImport += 1
            continue
        }
        seenImportContent.add(imported.contentFingerprint)
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
        while (nextSameOwner.has(nextId) || existingOtherOwners.some(item => item.id === nextId)) {
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
    const nextDriveDisc = withDriveDiscFingerprints({ ...driveDisc, ownerId, updatedAt: nowIso() }, options)
    return {
        ownerId,
        driveDisc: nextDriveDisc,
        nextStore: {
            ...store,
            driveDiscs: index >= 0 ? existing.map(item => matches(item) ? nextDriveDisc : item) : [...existing, nextDriveDisc],
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

export function upsertDriveDiscLoadout(store, loadout) {
    const ownerId = loadout.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscLoadouts ?? []
    const id = String(loadout?.id ?? "").trim() || `loadout-${Date.now()}`
    const matches = item => item.id === id && (item.ownerId ?? "default") === ownerId
    const index = existing.findIndex(matches)
    const nextLoadout = normalizeDriveDiscLoadout({ ...loadout, id, ownerId }, index >= 0 ? existing[index] : null)
    return {
        ownerId,
        loadout: nextLoadout,
        nextStore: {
            ...store,
            driveDiscLoadouts: index >= 0
                ? existing.map(item => matches(item) ? nextLoadout : item)
                : [...existing, nextLoadout],
        },
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
