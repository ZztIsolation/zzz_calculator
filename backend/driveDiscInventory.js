import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const STORE_FILE = "user_drive_discs.json"

const DRIVE_DISC_SET_ALIASES = {
    "雪兔梦游仙境": {
        id: "zzz_wiki_1907",
        name: { zhCN: "雪兔梦游仙境" },
    },
    "囚徒手记": {
        id: "zzz_wiki_1906",
        name: { zhCN: "囚徒手记" },
    },
    "啄木鸟电音": {
        id: "woodpecker_electro",
        name: { zhCN: "啄木鸟电音" },
    },
    "摇摆爵士": {
        id: "swing_jazz",
        name: { zhCN: "摇摆爵士" },
    },
    "激素朋克": {
        id: "hormone_punk",
        name: { zhCN: "激素朋克" },
    },
    "獠牙重金属": {
        id: "fanged_metal",
        name: { zhCN: "獠牙重金属" },
    },
    "震星迪斯科": {
        id: "shockstar_disco",
        name: { zhCN: "震星迪斯科" },
    },
    "雷暴重金属": {
        id: "thunder_metal",
        name: { zhCN: "雷暴重金属" },
    },
    "极地重金属": {
        id: "polar_metal",
        name: { zhCN: "极地重金属" },
    },
    "自由蓝调": {
        id: "freedom_blues",
        name: { zhCN: "自由蓝调" },
    },
    "炎狱重金属": {
        id: "inferno_metal",
        name: { zhCN: "炎狱重金属" },
    },
    "河豚电音": {
        id: "puffer_electro",
        name: { zhCN: "河豚电音" },
    },
    "灵魂摇滚": {
        id: "soul_rock",
        name: { zhCN: "灵魂摇滚" },
    },
    "混沌重金属": {
        id: "chaotic_metal",
        name: { zhCN: "混沌重金属" },
    },
    "原始朋克": {
        id: "proto_punk",
        name: { zhCN: "原始朋克" },
    },
    "混沌爵士": {
        id: "chaos_jazz",
        name: { zhCN: "混沌爵士" },
    },
    "静听嘉音": {
        id: "zzz_wiki_1001",
        name: { zhCN: "静听嘉音" },
    },
    "沧浪行歌": {
        id: "scanner-set-fcf8ae93d798",
        name: { zhCN: "沧浪行歌" },
    },
    "拂晓生花": {
        id: "zzz_wiki_1552",
        name: { zhCN: "拂晓生花" },
    },
    "折枝剑歌": {
        id: "scanner-set-48ee0a14625f",
        name: { zhCN: "折枝剑歌" },
    },
    "流光咏叹": {
        id: "astral_voice",
        name: { zhCN: "流光咏叹" },
    },
    "法厄同之歌": {
        id: "phaethons_melody",
        name: { zhCN: "法厄同之歌" },
    },
    "云岿如我": {
        id: "yunkui_tales",
        name: { zhCN: "云岿如我" },
    },
    "月光骑士颂": {
        id: "moonlight_lullaby",
        name: { zhCN: "月光骑士颂" },
    },
    "如影相随": {
        id: "shadow_harmony",
        name: { zhCN: "如影相随" },
    },
    "山大王": {
        id: "king_of_the_summit",
        name: { zhCN: "山大王" },
    },
}

const STAT_LABELS = {
    "生命值": {
        flat: "hpFlat",
        pct: "hpPct",
    },
    "攻击力": {
        flat: "atkFlat",
        pct: "atkPct",
    },
    "防御力": {
        flat: "defFlat",
        pct: "defPct",
    },
    "暴击率": {
        pct: "critRate",
    },
    "暴击伤害": {
        pct: "critDmg",
    },
    "异常精通": {
        flat: "anomalyProficiency",
    },
    "异常掌控": {
        pct: "anomalyMastery",
    },
    "冲击力": {
        pct: "impact",
    },
    "能量自动回复": {
        pct: "energyRegen",
    },
    "穿透值": {
        flat: "penFlat",
    },
    "穿透率": {
        pct: "penRatio",
    },
    "物理伤害加成": {
        pct: "physicalDmg",
    },
    "火属性伤害加成": {
        pct: "fireDmg",
    },
    "冰属性伤害加成": {
        pct: "iceDmg",
    },
    "电属性伤害加成": {
        pct: "electricDmg",
    },
    "以太伤害加成": {
        pct: "etherDmg",
    },
}

function hashText(value) {
    return createHash("sha1").update(value).digest("hex").slice(0, 12)
}

function storePath(dataDir) {
    return path.join(dataDir, STORE_FILE)
}

function createEmptyStore() {
    return {
        version: 1,
        updatedAt: null,
        owners: [
            {
                id: "default",
                label: "默认用户",
            },
        ],
        imports: [],
        driveDiscs: [],
        driveDiscLoadouts: [],
    }
}

function normalizeStore(store) {
    return {
        ...createEmptyStore(),
        ...(store ?? {}),
        owners: Array.isArray(store?.owners) ? store.owners : createEmptyStore().owners,
        imports: Array.isArray(store?.imports) ? store.imports : [],
        driveDiscs: Array.isArray(store?.driveDiscs) ? store.driveDiscs : [],
        driveDiscLoadouts: Array.isArray(store?.driveDiscLoadouts) ? store.driveDiscLoadouts : [],
    }
}

function pickScannerItems(input) {
    if (Array.isArray(input)) {
        return input
    }

    if (!input || typeof input !== "object") {
        throw new Error("ZZZ Scanner export must be an array or an object containing drive disc items.")
    }

    const candidates = [
        input.items,
        input.driveDiscs,
        input.drive_discs,
        input.discs,
        input.data,
        input.export,
    ]

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
            return {
                value: Number(trimmed.slice(0, -1)),
                mode: "pct",
                rawValue,
            }
        }

        const numeric = Number(trimmed)
        if (!Number.isNaN(numeric)) {
            return {
                value: numeric,
                mode: "flat",
                rawValue,
            }
        }
    }

    if (typeof rawValue === "number") {
        return {
            value: rawValue,
            mode: "flat",
            rawValue,
        }
    }

    return {
        value: 0,
        mode: "unknown",
        rawValue,
    }
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
    const setMatch = DRIVE_DISC_SET_ALIASES[setName]
    const partition = Number(rawItem["槽位"] ?? 0)
    const rarity = String(rawItem["品质"] ?? "S")
    const level = Number(rawItem["等级"] ?? 0)
    const maxLevel = Number(rawItem["最大等级"] ?? level)
    const rawIdentity = JSON.stringify({
        ownerId: options.ownerId,
        sourceSequence,
        setName,
        partition,
        rarity,
        level,
        mainStat: rawItem["主属性"],
        subStats: rawItem["副属性"],
    })

    return {
        id: `scanner-${sourceSequence}-${hashText(rawIdentity)}`,
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
}

export function normalizeScannerExport(input, options = {}) {
    const ownerId = options.ownerId ?? "default"
    const importedAt = options.importedAt ?? new Date().toISOString()
    const sourcePath = options.sourcePath ?? null
    const importId = options.importId ?? `zzz-scanner-${hashText(`${ownerId}:${sourcePath ?? ""}:${importedAt}`)}`
    const items = pickScannerItems(input)
    const warnings = []
    const driveDiscs = items.map((item, index) =>
        normalizeScannerItem(item, index, { ownerId, importedAt, sourcePath, importId }, warnings)
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
        },
        driveDiscs,
    }
}

export async function loadUserDriveDiscStore(dataDir) {
    const filePath = storePath(dataDir)
    if (!existsSync(filePath)) {
        return createEmptyStore()
    }

    const text = await readFile(filePath, "utf8")
    return normalizeStore(JSON.parse(text))
}

export async function saveUserDriveDiscStore(dataDir, store) {
    const nextStore = {
        ...normalizeStore(store),
        updatedAt: new Date().toISOString(),
    }
    await writeFile(storePath(dataDir), `${JSON.stringify(nextStore, null, 2)}\n`, "utf8")
    return nextStore
}

export async function importScannerExportToStore(dataDir, input, options = {}) {
    const normalized = normalizeScannerExport(input, options)
    const ownerId = normalized.importRecord.ownerId
    const store = await loadUserDriveDiscStore(dataDir)
    const owners = store.owners?.some(owner => owner.id === ownerId)
        ? store.owners
        : [...(store.owners ?? []), { id: ownerId, label: ownerId }]

    const nextStore = {
        ...store,
        owners,
        imports: [
            ...(store.imports ?? []),
            normalized.importRecord,
        ],
        driveDiscs: [
            ...(store.driveDiscs ?? []).filter(item => item.ownerId !== ownerId),
            ...normalized.driveDiscs,
        ],
    }

    return saveUserDriveDiscStore(dataDir, nextStore)
}

export async function upsertUserDriveDisc(dataDir, driveDisc) {
    if (!driveDisc?.id) {
        throw new Error("Drive disc id is required.")
    }

    const store = await loadUserDriveDiscStore(dataDir)
    const existing = store.driveDiscs ?? []
    const index = existing.findIndex(item => item.id === driveDisc.id)
    const nextDriveDisc = {
        ...driveDisc,
        updatedAt: new Date().toISOString(),
    }

    const driveDiscs = index >= 0
        ? existing.map(item => item.id === driveDisc.id ? nextDriveDisc : item)
        : [...existing, nextDriveDisc]

    return saveUserDriveDiscStore(dataDir, {
        ...store,
        driveDiscs,
    })
}

export async function deleteUserDriveDisc(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const before = store.driveDiscs ?? []
    const driveDiscs = before.filter(item => item.id !== id)
    const nextStore = await saveUserDriveDiscStore(dataDir, {
        ...store,
        driveDiscs,
    })

    return {
        store: nextStore,
        deleted: before.length !== driveDiscs.length,
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
    if (missingSlots.length) {
        throw new Error(`Drive disc loadout must include slots: ${missingSlots.join(", ")}.`)
    }

    const now = new Date().toISOString()
    return {
        ...(existing ?? {}),
        ...loadout,
        id,
        agentId,
        name: String(loadout?.name ?? existing?.name ?? "未命名套装").trim() || "未命名套装",
        ownerId: String(loadout?.ownerId ?? existing?.ownerId ?? "default"),
        driveDiscIdsBySlot,
        source: loadout?.source ?? existing?.source ?? { type: "manual" },
        score: Number.isFinite(Number(loadout?.score)) ? Number(loadout.score) : existing?.score ?? null,
        createdAt: existing?.createdAt ?? loadout?.createdAt ?? now,
        updatedAt: now,
    }
}

export async function upsertDriveDiscLoadout(dataDir, loadout) {
    const store = await loadUserDriveDiscStore(dataDir)
    const existing = store.driveDiscLoadouts ?? []
    const id = String(loadout?.id ?? "").trim() || `loadout-${Date.now()}`
    const index = existing.findIndex(item => item.id === id)
    const nextLoadout = normalizeDriveDiscLoadout({ ...loadout, id }, index >= 0 ? existing[index] : null)
    const driveDiscLoadouts = index >= 0
        ? existing.map(item => item.id === id ? nextLoadout : item)
        : [...existing, nextLoadout]

    return {
        store: await saveUserDriveDiscStore(dataDir, {
            ...store,
            driveDiscLoadouts,
        }),
        loadout: nextLoadout,
    }
}

export async function deleteDriveDiscLoadout(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const before = store.driveDiscLoadouts ?? []
    const driveDiscLoadouts = before.filter(item => item.id !== id)
    const nextStore = await saveUserDriveDiscStore(dataDir, {
        ...store,
        driveDiscLoadouts,
    })

    return {
        store: nextStore,
        deleted: before.length !== driveDiscLoadouts.length,
    }
}

export function toCalculatorDriveDisc(inventoryDisc) {
    return {
        id: inventoryDisc.id,
        setId: inventoryDisc.setId,
        partition: inventoryDisc.partition,
        rarity: inventoryDisc.rarity,
        level: inventoryDisc.level,
        mainStat: {
            stat: inventoryDisc.mainStat.stat,
            value: inventoryDisc.mainStat.value,
        },
        subStats: (inventoryDisc.subStats ?? []).map(item => ({
            stat: item.stat,
            value: item.value,
        })),
    }
}
