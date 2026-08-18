function rounded(value) {
  return Number(Number(value).toFixed(5))
}

function mapStat(rawStat, mapping, multiplier) {
  const property = mapping?.properties?.[rawStat.propertyId]
  if (!property) throw new Error(`未知词条 PropertyId ${rawStat.propertyId}`)
  const rawValue = rawStat.propertyValue * multiplier
  return {
    stat: property.stat,
    value: rounded(property.mode === "pct" ? rawValue / 100 : rawValue),
    mode: property.mode,
    label: property.label,
  }
}

function mapDriveDisc(rawDisc, context) {
  const item = context.mapping?.driveDiscEquipment?.[rawDisc.equipmentId]
  if (!item) throw new Error(`未知驱动盘 Id ${rawDisc.equipmentId}`)
  if (!context.setIds.has(item.setId)) throw new Error(`Calculator 当前目录未收录套装 ${item.setId}`)

  const mainMultiplier = 1 + rawDisc.level * item.levelScale
  return {
    id: `enka-zzz:${context.uid}:${rawDisc.uid}`,
    setId: item.setId,
    setName: item.setName,
    partition: rawDisc.slot,
    rarity: item.rarity,
    level: rawDisc.level,
    maxLevel: item.maxLevel,
    locked: rawDisc.locked,
    equippedBy: context.agentId,
    mainStat: mapStat(rawDisc.mainStat, context.mapping, mainMultiplier),
    subStats: rawDisc.subStats.map(stat => mapStat(stat, context.mapping, stat.propertyLevel)),
    source: {
      type: "enka-zzz-showcase",
      uid: context.uid,
      agentId: context.agentId,
      equipmentUid: rawDisc.uid,
      equipmentId: rawDisc.equipmentId,
    },
  }
}

export function mapDriveDiscPreset(rawDriveDiscs, { uid, agentId, agentName, catalog, mapping }) {
  if (!Array.isArray(rawDriveDiscs) || !rawDriveDiscs.length) {
    return { preset: null, warnings: [] }
  }
  const driveDiscSets = catalog?.displayDriveDiscSets ?? catalog?.driveDiscSets ?? []
  const context = {
    uid,
    agentId,
    mapping,
    setIds: new Set(driveDiscSets.map(item => String(item?.id ?? ""))),
  }
  const driveDiscs = []
  const warnings = []

  for (const rawDisc of rawDriveDiscs) {
    try {
      driveDiscs.push(mapDriveDisc(rawDisc, context))
    } catch (error) {
      warnings.push(`${agentName} 的${rawDisc.slot ?? "未知"}号位驱动盘未导入：${error instanceof Error ? error.message : String(error)}。`)
    }
  }

  return {
    preset: driveDiscs.length
      ? { agentId, agentName, driveDiscs: driveDiscs.sort((left, right) => left.partition - right.partition) }
      : null,
    warnings,
  }
}
