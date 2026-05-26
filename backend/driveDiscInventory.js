import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const STORE_FILE = "user_drive_discs.json"

const DRIVE_DISC_SET_ALIASES = {
    "啄木鸟电音": {
        id: "woodpecker_electro",
        name: { en: "Woodpecker Electro", zhCN: "啄木鸟电音" },
    },
    "摇摆爵士": {
        id: "swing_jazz",
        name: { en: "Swing Jazz", zhCN: "摇摆爵士" },
    },
    "激素朋克": {
        id: "hormone_punk",
        name: { en: "Hormone Punk", zhCN: "激素朋克" },
    },
    "沧浪行歌": {
        id: "scanner-set-fcf8ae93d798",
        name: { en: "White Water Ballad", zhCN: "沧浪行歌" },
    },
    "折枝剑歌": {
        id: "scanner-set-48ee0a14625f",
        name: { en: "Branch & Blade Song", zhCN: "折枝剑歌" },
    },
    "流光咏叹": {
        id: "astral_voice",
        name: { en: "Astral Voice", zhCN: "流光咏叹" },
    },
    "法厄同之歌": {
        id: "phaethons_melody",
        name: { en: "Phaethon's Melody", zhCN: "法厄同之歌" },
    },
    "云岿如我": {
        id: "yunkui_tales",
        name: { en: "Yunkui Tales", zhCN: "云岿如我" },
    },
    "月光骑士颂": {
        id: "moonlight_lullaby",
        name: { en: "Moonlight Lullaby", zhCN: "月光骑士颂" },
    },
    "如影相随": {
        id: "shadow_harmony",
        name: { en: "Shadow Harmony", zhCN: "如影相随" },
    },
    "山大王": {
        id: "king_of_the_summit",
        name: { en: "King of the Summit", zhCN: "山大王" },
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
                value: Number((Number(trimmed.slice(0, -1)) / 100).toFixed(12)),
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
    return JSON.parse(text)
}

export async function saveUserDriveDiscStore(dataDir, store) {
    const nextStore = {
        ...store,
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
