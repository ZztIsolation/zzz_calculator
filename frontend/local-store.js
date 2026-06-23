const DB_NAME = "zzz-calculator-user-store"
const DB_VERSION = 1
const STATE_STORE = "state"
const STORE_KEY = "userDriveDiscStore"
const FALLBACK_STORAGE_KEY = "zzz-calculator.userStore.v1"

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

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function createEmptyStore() {
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

function normalizeStore(store) {
    const fallback = createEmptyStore()
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
        driveDiscs: Array.isArray(store?.driveDiscs) ? store.driveDiscs.map(withDriveDiscFingerprints) : [],
        driveDiscLoadouts: Array.isArray(store?.driveDiscLoadouts) ? store.driveDiscLoadouts : [],
    }
}

export function ownerScopedStore(store, ownerId = store?.currentOwnerId) {
    const normalized = normalizeStore(store)
    const scopedOwnerId = normalized.owners.some(owner => owner.id === ownerId) ? ownerId : normalized.currentOwnerId
    return {
        ...normalized,
        currentOwnerId: scopedOwnerId,
        imports: (normalized.imports ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId),
        driveDiscs: (normalized.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId),
        driveDiscLoadouts: (normalized.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId),
    }
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

let dbPromise = null

function openDb() {
    if (typeof indexedDB === "undefined") {
        return null
    }
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE)
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
    return dbPromise
}

async function readPersistedStore() {
    const db = await openDb()
    if (!db) {
        try {
            return JSON.parse(localStorage.getItem(FALLBACK_STORAGE_KEY) || "null")
        } catch {
            return null
        }
    }
    const tx = db.transaction(STATE_STORE, "readonly")
    return requestToPromise(tx.objectStore(STATE_STORE).get(STORE_KEY))
}

async function writePersistedStore(store) {
    const db = await openDb()
    if (!db) {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store))
        return store
    }
    const tx = db.transaction(STATE_STORE, "readwrite")
    await requestToPromise(tx.objectStore(STATE_STORE).put(store, STORE_KEY))
    return store
}

export async function loadUserDriveDiscStore() {
    return normalizeStore(await readPersistedStore())
}

export async function loadCurrentUserDriveDiscStore() {
    return ownerScopedStore(await loadUserDriveDiscStore())
}

export async function saveUserDriveDiscStore(store) {
    const nextStore = {
        ...normalizeStore(store),
        updatedAt: new Date().toISOString(),
    }
    await writePersistedStore(nextStore)
    return nextStore
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

function hashText(value) {
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

export function driveDiscContentFingerprint(disc) {
    return hashText(stableStringify({
        setId: disc?.setId ?? "",
        setName: disc?.setName ?? "",
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? ""),
        level: Number(disc?.level ?? 0),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: true }),
        subStats: (disc?.subStats ?? []).map(stat => statFingerprintEntry(stat, { includeValue: true })),
    }))
}

export function driveDiscIdentityFingerprint(disc) {
    return hashText(stableStringify({
        setId: disc?.setId ?? "",
        setName: disc?.setName ?? "",
        partition: Number(disc?.partition ?? 0),
        rarity: String(disc?.rarity ?? ""),
        mainStat: statFingerprintEntry(disc?.mainStat, { includeValue: false }),
        subStats: (disc?.subStats ?? []).map(stat => statFingerprintEntry(stat, { includeValue: false })),
    }))
}

function withDriveDiscFingerprints(disc) {
    const next = { ...disc }
    next.contentFingerprint = driveDiscContentFingerprint(next)
    next.identityFingerprint = driveDiscIdentityFingerprint(next)
    return next
}

function uniqueOwnerId(baseId, owners) {
    const used = new Set((owners ?? []).map(owner => owner.id))
    let id = cleanOwnerId(baseId) || `account-${Date.now()}`
    if (!used.has(id)) {
        return id
    }
    let index = 2
    while (used.has(`${id}-${index}`)) {
        index += 1
    }
    return `${id}-${index}`
}

export async function accountSummary() {
    const store = await loadUserDriveDiscStore()
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

export async function createAccount(account = {}) {
    const store = await loadUserDriveDiscStore()
    const id = uniqueOwnerId(account.id ?? `account-${Date.now()}`, store.owners)
    const label = String(account.label ?? account.name ?? "新账号").trim() || "新账号"
    await saveUserDriveDiscStore({
        ...store,
        owners: [...(store.owners ?? []), { id, label }],
    })
    return accountSummary()
}

export async function updateAccount(id, patch = {}) {
    const store = await loadUserDriveDiscStore()
    const ownerId = cleanOwnerId(id)
    const owners = (store.owners ?? []).map(owner =>
        owner.id === ownerId
            ? { ...owner, label: String(patch.label ?? patch.name ?? owner.label).trim() || owner.label }
            : owner
    )
    if (!owners.some(owner => owner.id === ownerId)) {
        throw new Error("Account not found.")
    }
    await saveUserDriveDiscStore({ ...store, owners })
    return accountSummary()
}

export async function switchAccount(id) {
    const store = await loadUserDriveDiscStore()
    const ownerId = cleanOwnerId(id)
    if (!(store.owners ?? []).some(owner => owner.id === ownerId)) {
        throw new Error("Account not found.")
    }
    await saveUserDriveDiscStore({ ...store, currentOwnerId: ownerId })
    return accountSummary()
}

export async function deleteAccount(id) {
    const store = await loadUserDriveDiscStore()
    const ownerId = cleanOwnerId(id)
    if (ownerId === store.currentOwnerId) {
        throw new Error("Cannot delete the current account.")
    }
    if (!(store.owners ?? []).some(owner => owner.id === ownerId)) {
        throw new Error("Account not found.")
    }
    await saveUserDriveDiscStore({
        ...store,
        owners: (store.owners ?? []).filter(owner => owner.id !== ownerId),
        imports: (store.imports ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
        driveDiscs: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
        driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") !== ownerId),
    })
    return accountSummary()
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
    if (!entry) {
        return null
    }
    return entry[mode] ?? entry.flat ?? entry.pct ?? null
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
        id: `scanner-${sourceSequence}-${hashText(`${options.ownerId}:${setName}:${partition}:${rarity}:${stableStringify(rawItem["主属性"])}:${stableStringify(rawItem["副属性"])}`)}`,
        ownerId: options.ownerId,
        setId: setMatch?.id ?? `scanner-set-${hashText(setName)}`,
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
    const withFingerprints = withDriveDiscFingerprints(normalized)
    return {
        ...withFingerprints,
        id: `scanner-${withFingerprints.contentFingerprint}`,
    }
}

function normalizeScannerExport(input, options = {}) {
    const ownerId = options.ownerId ?? "default"
    const importedAt = options.importedAt ?? new Date().toISOString()
    const sourcePath = options.sourcePath ?? null
    const importId = options.importId ?? `zzz-scanner-${hashText(`${ownerId}:${sourcePath ?? ""}:${importedAt}`)}`
    const items = pickScannerItems(input)
    const warnings = []
    const driveDiscs = items.map((item, index) =>
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

function buildDuplicateAwareIndex(items, keyFn) {
    const index = new Map()
    for (const item of items ?? []) {
        const key = keyFn(item)
        if (!key) {
            continue
        }
        if (!index.has(key)) {
            index.set(key, [])
        }
        index.get(key).push(item)
    }
    return index
}

function matchedImportSource(source = {}) {
    return {
        ...source,
        matchedAt: new Date().toISOString(),
    }
}

function mergeImportedDriveDisc(existing, imported) {
    return withDriveDiscFingerprints({
        ...existing,
        ...imported,
        id: existing.id,
        createdAt: existing.createdAt ?? imported.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: matchedImportSource(imported.source ?? existing.source ?? {}),
    })
}

function clearDeletedDriveDiscLoadoutSlots(loadouts = [], deletedIds = new Set()) {
    return (loadouts ?? []).map(loadout => {
        const idsBySlot = { ...(loadout.driveDiscIdsBySlot ?? {}) }
        const removedFromLoadout = []
        for (const [slot, id] of Object.entries(idsBySlot)) {
            if (!deletedIds.has(id)) {
                continue
            }
            delete idsBySlot[slot]
            removedFromLoadout.push(id)
        }
        if (!removedFromLoadout.length) {
            return loadout
        }
        return {
            ...loadout,
            driveDiscIdsBySlot: idsBySlot,
            status: "incomplete",
            missingDriveDiscIds: [...new Set([...(loadout.missingDriveDiscIds ?? []), ...removedFromLoadout])],
            updatedAt: new Date().toISOString(),
        }
    })
}

export async function importScannerExportToStore(input, options = {}) {
    const currentStore = await loadUserDriveDiscStore()
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
    const existingSameOwner = (currentStore.driveDiscs ?? []).filter(item => item.ownerId === ownerId)
    const existingOtherOwners = (currentStore.driveDiscs ?? []).filter(item => item.ownerId !== ownerId)
    const byContent = buildDuplicateAwareIndex(existingSameOwner, item => item.contentFingerprint)
    const byIdentity = buildDuplicateAwareIndex(existingSameOwner, item => item.identityFingerprint)
    const nextSameOwner = new Map(existingSameOwner.map(item => [item.id, item]))
    const matchedExistingIds = new Set()
    const seenImportContent = new Set()
    const summary = {
        added: 0,
        skipped: 0,
        updated: 0,
        removed: 0,
        duplicateInImport: 0,
        warnings: normalized.importRecord.warnings ?? [],
    }

    for (const imported of normalized.driveDiscs) {
        if (seenImportContent.has(imported.contentFingerprint)) {
            summary.duplicateInImport += 1
            continue
        }
        seenImportContent.add(imported.contentFingerprint)
        const contentMatches = byContent.get(imported.contentFingerprint) ?? []
        if (contentMatches.length > 0) {
            const existing = contentMatches[0]
            matchedExistingIds.add(existing.id)
            nextSameOwner.set(existing.id, {
                ...existing,
                source: matchedImportSource({
                    ...(existing.source ?? {}),
                    importId: imported.source?.importId,
                    importedAt: imported.source?.importedAt,
                    sourcePath: imported.source?.sourcePath,
                    sequence: imported.source?.sequence,
                    rawIndex: imported.source?.rawIndex,
                }),
                raw: imported.raw ?? existing.raw ?? null,
                contentFingerprint: imported.contentFingerprint,
                identityFingerprint: imported.identityFingerprint,
            })
            summary.skipped += 1
            continue
        }

        const identityMatches = byIdentity.get(imported.identityFingerprint) ?? []
        if (identityMatches.length === 1 && Number(imported.level ?? 0) > Number(identityMatches[0].level ?? 0)) {
            const existing = identityMatches[0]
            matchedExistingIds.add(existing.id)
            nextSameOwner.set(existing.id, mergeImportedDriveDisc(existing, imported))
            summary.updated += 1
            continue
        }

        let nextId = imported.id
        while (nextSameOwner.has(nextId) || existingOtherOwners.some(item => item.id === nextId)) {
            nextId = `scanner-${imported.contentFingerprint}-${hashText(`${nextId}:${nextSameOwner.size}`)}`
        }
        const nextDisc = withDriveDiscFingerprints({
            ...imported,
            id: nextId,
            createdAt: imported.createdAt ?? new Date().toISOString(),
            updatedAt: imported.updatedAt ?? new Date().toISOString(),
        })
        nextSameOwner.set(nextDisc.id, nextDisc)
        matchedExistingIds.add(nextDisc.id)
        summary.added += 1
    }

    const deletedIds = new Set()
    if (options.removeMissing) {
        for (const disc of existingSameOwner) {
            if (!matchedExistingIds.has(disc.id)) {
                nextSameOwner.delete(disc.id)
                deletedIds.add(disc.id)
            }
        }
        summary.removed = deletedIds.size
    }

    const saved = await saveUserDriveDiscStore({
        ...currentStore,
        owners,
        imports: [
            ...(currentStore.imports ?? []),
            { ...normalized.importRecord, summary },
        ],
        driveDiscs: [
            ...existingOtherOwners,
            ...nextSameOwner.values(),
        ],
        driveDiscLoadouts: clearDeletedDriveDiscLoadoutSlots(currentStore.driveDiscLoadouts ?? [], deletedIds),
    })
    return {
        ...ownerScopedStore(saved, ownerId),
        lastImportSummary: summary,
    }
}

export async function clearUserDriveDiscStore(ownerId = null) {
    const store = await loadUserDriveDiscStore()
    const scopedOwnerId = ownerId ?? store.currentOwnerId
    const previous = {
        imports: (store.imports ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId).length,
        driveDiscs: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId).length,
        driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") === scopedOwnerId).length,
    }
    const saved = await saveUserDriveDiscStore({
        ...store,
        imports: (store.imports ?? []).filter(item => (item.ownerId ?? "default") !== scopedOwnerId),
        driveDiscs: (store.driveDiscs ?? []).filter(item => (item.ownerId ?? "default") !== scopedOwnerId),
        driveDiscLoadouts: (store.driveDiscLoadouts ?? []).filter(item => (item.ownerId ?? "default") !== scopedOwnerId),
    })
    return {
        store: ownerScopedStore(saved, scopedOwnerId),
        previous,
    }
}

export async function upsertUserDriveDisc(driveDisc) {
    if (!driveDisc?.id) {
        throw new Error("Drive disc id is required.")
    }
    const store = await loadUserDriveDiscStore()
    const ownerId = driveDisc.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscs ?? []
    const index = existing.findIndex(item => item.id === driveDisc.id && (item.ownerId ?? "default") === ownerId)
    const nextDriveDisc = withDriveDiscFingerprints({
        ...driveDisc,
        ownerId,
        updatedAt: new Date().toISOString(),
    })
    const driveDiscs = index >= 0
        ? existing.map(item => item.id === driveDisc.id && (item.ownerId ?? "default") === ownerId ? nextDriveDisc : item)
        : [...existing, nextDriveDisc]
    const saved = await saveUserDriveDiscStore({ ...store, driveDiscs })
    return ownerScopedStore(saved, ownerId)
}

export async function deleteUserDriveDisc(id) {
    const store = await loadUserDriveDiscStore()
    const ownerId = store.currentOwnerId
    const before = store.driveDiscs ?? []
    const deletedDisc = before.find(item => item.id === id && (item.ownerId ?? "default") === ownerId)
    const saved = await saveUserDriveDiscStore({
        ...store,
        driveDiscs: before.filter(item => !(item.id === id && (item.ownerId ?? "default") === ownerId)),
        driveDiscLoadouts: deletedDisc
            ? clearDeletedDriveDiscLoadoutSlots(store.driveDiscLoadouts ?? [], new Set([id]))
            : store.driveDiscLoadouts ?? [],
    })
    return {
        store: ownerScopedStore(saved, ownerId),
        deleted: Boolean(deletedDisc),
    }
}

function cleanDriveDiscIdsBySlot(driveDiscIdsBySlot = {}) {
    return Object.fromEntries(
        Object.entries(driveDiscIdsBySlot ?? {})
            .map(([slot, id]) => [String(Number(slot)), String(id ?? "").trim()])
            .filter(([slot, id]) => Number(slot) >= 1 && Number(slot) <= 6 && id)
    )
}

function normalizeDriveDiscLoadout(loadout, existing = null) {
    const id = String(loadout?.id ?? existing?.id ?? `loadout-${Date.now()}`).trim()
    const agentId = String(loadout?.agentId ?? existing?.agentId ?? "").trim()
    if (!id) {
        throw new Error("Drive disc loadout id is required.")
    }
    if (!agentId) {
        throw new Error("Drive disc loadout agentId is required.")
    }
    const driveDiscIdsBySlot = cleanDriveDiscIdsBySlot(loadout?.driveDiscIdsBySlot ?? existing?.driveDiscIdsBySlot)
    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !driveDiscIdsBySlot[String(slot)])
    const now = new Date().toISOString()
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

export async function upsertDriveDiscLoadout(loadout) {
    const store = await loadUserDriveDiscStore()
    const ownerId = loadout.ownerId ?? store.currentOwnerId
    const existing = store.driveDiscLoadouts ?? []
    const id = String(loadout?.id ?? "").trim() || `loadout-${Date.now()}`
    const index = existing.findIndex(item => item.id === id && (item.ownerId ?? "default") === ownerId)
    const nextLoadout = normalizeDriveDiscLoadout({ ...loadout, id, ownerId }, index >= 0 ? existing[index] : null)
    const driveDiscLoadouts = index >= 0
        ? existing.map(item => item.id === id && (item.ownerId ?? "default") === ownerId ? nextLoadout : item)
        : [...existing, nextLoadout]
    const saved = await saveUserDriveDiscStore({ ...store, driveDiscLoadouts })
    return {
        store: ownerScopedStore(saved, ownerId),
        loadout: nextLoadout,
    }
}

export async function deleteDriveDiscLoadout(id) {
    const store = await loadUserDriveDiscStore()
    const ownerId = store.currentOwnerId
    const before = store.driveDiscLoadouts ?? []
    const driveDiscLoadouts = before.filter(item => !(item.id === id && (item.ownerId ?? "default") === ownerId))
    const saved = await saveUserDriveDiscStore({ ...store, driveDiscLoadouts })
    return {
        store: ownerScopedStore(saved, ownerId),
        deleted: before.length !== driveDiscLoadouts.length,
    }
}
