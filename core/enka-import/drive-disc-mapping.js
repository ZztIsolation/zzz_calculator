function rounded(value) {
  return Number(Number(value).toFixed(5))
}

function mapStat(rawStat, mapping, multiplier, warnings, context) {
  const property = mapping?.properties?.[rawStat.propertyId]
  const rawValue = rawStat.propertyValue * multiplier
  if (!property) {
    warnings.push(`${context}使用了未知词条 PropertyId ${rawStat.propertyId}；已保留原始数据，但不会参与属性计算或弱来源去重。`)
    return {
      stat: "unknown",
      value: rounded(rawValue),
      mode: "unknown",
      label: `PropertyId ${rawStat.propertyId}`,
      rawValue: rawStat.propertyValue,
      raw: {
        propertyId: rawStat.propertyId,
        propertyLevel: rawStat.propertyLevel,
        propertyValue: rawStat.propertyValue,
        multiplier,
      },
    }
  }
  return {
    stat: property.stat,
    value: rounded(rawValue),
    mode: property.mode,
    label: property.label,
  }
}

function mapDriveDisc(rawDisc, context, warnings) {
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
    statUnitVersion: 2,
    locked: rawDisc.locked,
    equippedBy: context.agentId,
    mainStat: mapStat(rawDisc.mainStat, context.mapping, mainMultiplier, warnings, `${context.agentName} 的${rawDisc.slot}号位驱动盘主词条`),
    subStats: rawDisc.subStats.map((stat, index) => mapStat(
      stat,
      context.mapping,
      stat.propertyLevel,
      warnings,
      `${context.agentName} 的${rawDisc.slot}号位驱动盘副词条 ${index + 1}`,
    )),
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
    agentName,
    setIds: new Set(driveDiscSets.map(item => String(item?.id ?? ""))),
  }
  const driveDiscs = []
  const warnings = []

  for (const rawDisc of rawDriveDiscs) {
    try {
      driveDiscs.push(mapDriveDisc(rawDisc, context, warnings))
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
