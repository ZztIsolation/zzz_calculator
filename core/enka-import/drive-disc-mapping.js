// Enka ZZZ field semantics and Drive Disc progression formula:
// https://github.com/EnkaNetwork/API-docs/blob/master/docs/zzz/api.md
const PROPERTY_MAPPINGS = Object.freeze({
  "11102": { stat: "hpPct", mode: "pct" },
  "11103": { stat: "hpFlat", mode: "flat" },
  "12102": { stat: "atkPct", mode: "pct" },
  "12103": { stat: "atkFlat", mode: "flat" },
  "12202": { stat: "impact", mode: "pct" },
  "13102": { stat: "defPct", mode: "pct" },
  "13103": { stat: "defFlat", mode: "flat" },
  "20103": { stat: "critRate", mode: "pct" },
  "21103": { stat: "critDmg", mode: "pct" },
  "23103": { stat: "penRatio", mode: "pct" },
  "23203": { stat: "penFlat", mode: "flat" },
  "30502": { stat: "energyRegen", mode: "pct" },
  "31203": { stat: "anomalyProficiency", mode: "flat" },
  "31402": { stat: "anomalyMastery", mode: "pct" },
  "31503": { stat: "physicalDmg", mode: "pct" },
  "31603": { stat: "fireDmg", mode: "pct" },
  "31703": { stat: "iceDmg", mode: "pct" },
  "31803": { stat: "electricDmg", mode: "pct" },
  "31903": { stat: "etherDmg", mode: "pct" },
})

const RARITIES = Object.freeze({
  4: { label: "S", maxLevel: 15, levelScale: 0.2 },
  3: { label: "A", maxLevel: 12, levelScale: 0.25 },
  2: { label: "B", maxLevel: 9, levelScale: 0.3 },
})

function zhName(item) {
  return String(item?.name?.zhCN ?? item?.name?.zhCn ?? "").trim()
}

function localizedName(locations, key) {
  const zhCN = locations?.["zh-cn"] ?? locations?.zhCN ?? {}
  return String(zhCN?.[key] ?? "").trim()
}

function uniqueNameIndex(items) {
  const index = new Map()
  for (const item of items) {
    const name = zhName(item)
    if (!name) continue
    const matches = index.get(name) ?? []
    matches.push(item)
    index.set(name, matches)
  }
  return index
}

function rounded(value) {
  return Number(Number(value).toFixed(5))
}

function mapStat(rawStat, metadata, locations, multiplier) {
  const mapping = PROPERTY_MAPPINGS[rawStat.propertyId]
  const property = metadata?.properties?.[rawStat.propertyId]
  if (!mapping || !property) {
    throw new Error(`未知词条 PropertyId ${rawStat.propertyId}`)
  }
  const rawValue = rawStat.propertyValue * multiplier
  return {
    stat: mapping.stat,
    value: rounded(mapping.mode === "pct" ? rawValue / 100 : rawValue),
    mode: mapping.mode,
    label: localizedName(locations, property.Name),
  }
}

function mapDriveDisc(rawDisc, context) {
  const item = context.metadata?.equipments?.Items?.[rawDisc.equipmentId]
  const rarity = RARITIES[Number(item?.Rarity)]
  const suit = context.metadata?.equipments?.Suits?.[String(item?.SuitId ?? "")]
  const setName = localizedName(context.metadata?.locations, suit?.Name)
  const setMatches = context.setNames.get(setName) ?? []
  if (!item || !rarity) throw new Error(`未知驱动盘 Id ${rawDisc.equipmentId}`)
  if (!suit || !setName) throw new Error(`驱动盘 ${rawDisc.equipmentId} 缺少官方套装名称`)
  if (setMatches.length !== 1) throw new Error(`套装“${setName}”无法唯一映射到 Calculator`)

  const mainMultiplier = 1 + rawDisc.level * rarity.levelScale
  return {
    id: `enka-${rawDisc.uid}`,
    setId: setMatches[0].id,
    setName,
    partition: rawDisc.slot,
    rarity: rarity.label,
    level: rawDisc.level,
    maxLevel: rarity.maxLevel,
    locked: rawDisc.locked,
    equippedBy: context.agentId,
    mainStat: mapStat(rawDisc.mainStat, context.metadata, context.metadata.locations, mainMultiplier),
    subStats: rawDisc.subStats.map(stat =>
      mapStat(stat, context.metadata, context.metadata.locations, stat.propertyLevel)
    ),
    source: { type: "enka-showcase", agentId: context.agentId },
  }
}

export function mapDriveDiscPreset(rawDriveDiscs, { agentId, agentName, catalog, metadata }) {
  if (!Array.isArray(rawDriveDiscs) || !rawDriveDiscs.length) {
    return { preset: null, warnings: [] }
  }
  const driveDiscSets = Array.isArray(catalog?.displayDriveDiscSets) && catalog.displayDriveDiscSets.length
    ? catalog.displayDriveDiscSets
    : Array.isArray(catalog?.driveDiscSets) ? catalog.driveDiscSets : []
  const context = {
    agentId,
    metadata,
    setNames: uniqueNameIndex(driveDiscSets),
  }

  try {
    const driveDiscs = rawDriveDiscs.map(disc => mapDriveDisc(disc, context))
    return {
      preset: { agentId, agentName, driveDiscs },
      warnings: [],
    }
  } catch (error) {
    return {
      preset: null,
      warnings: [`${agentName} 的驱动盘预设未导入：${error instanceof Error ? error.message : String(error)}。`],
    }
  }
}
