import { CORE_SKILL_LEVELS, SKILL_INDEX_TO_CATEGORY } from "./constants.js"

function boundedInteger(value, min, max) {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

export function extractAvatarList(enkaData) {
  const avatars = enkaData?.PlayerInfo?.ShowcaseDetail?.AvatarList
  return Array.isArray(avatars) ? avatars : []
}

export function cinemaSkillBonus(cinemaLevel) {
  if (cinemaLevel >= 5) return 4
  if (cinemaLevel >= 3) return 2
  return 0
}

function parseSkillLevels(entries, cinemaLevel, warnings, enkaAgentId) {
  const byIndex = new Map()
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry?.Index != null) byIndex.set(String(entry.Index), entry.Level)
    }
  }

  const bonus = cinemaLevel == null ? 0 : cinemaSkillBonus(cinemaLevel)
  const result = {}
  for (const [index, category] of Object.entries(SKILL_INDEX_TO_CATEGORY)) {
    const rawLevel = boundedInteger(byIndex.get(index), 1, 16)
    if (rawLevel == null) {
      warnings.push(`角色 ${enkaAgentId} 的 ${category} 技能等级缺失或越界，保留 Calculator 原值。`)
      continue
    }
    result[category] = Math.min(16, rawLevel + bonus)
  }
  return result
}

function parseCoreSkill(value, warnings, enkaAgentId) {
  const index = boundedInteger(value, 0, CORE_SKILL_LEVELS.length)
  if (index == null) {
    warnings.push(`角色 ${enkaAgentId} 的核心技等级缺失或越界，保留 Calculator 原值。`)
    return null
  }
  return index === 0 ? "none" : CORE_SKILL_LEVELS[index - 1]
}

function parseWEngine(weapon, warnings, enkaAgentId) {
  if (!weapon || weapon.Id == null) return null
  const enkaId = String(weapon.Id).trim()
  if (!enkaId) return null
  const level = boundedInteger(weapon.Level, 0, 60)
  const modificationLevel = boundedInteger(weapon.UpgradeLevel, 1, 5)
  if (level == null) warnings.push(`角色 ${enkaAgentId} 的音擎等级缺失或越界，保留 Calculator 原值。`)
  if (modificationLevel == null) warnings.push(`角色 ${enkaAgentId} 的音擎精炼缺失或越界，保留 Calculator 原值。`)
  return { enkaId, level, modificationLevel }
}

function parseDriveDiscStat(rawStat, context, warnings) {
  const propertyId = String(rawStat?.PropertyId ?? "").trim()
  const propertyLevel = boundedInteger(rawStat?.PropertyLevel, 1, 20)
  const propertyValue = Number(rawStat?.PropertyValue)
  if (!propertyId || propertyLevel == null || !Number.isFinite(propertyValue)) {
    warnings.push(`${context}的词条数据缺失或越界。`)
    return null
  }
  return { propertyId, propertyLevel, propertyValue }
}

function parseDriveDiscs(entries, warnings, enkaAgentId) {
  if (!Array.isArray(entries) || !entries.length) return []
  const driveDiscs = []
  const slots = new Set()
  const uids = new Set()

  for (const entry of entries) {
    const equipment = entry?.Equipment
    const slot = boundedInteger(entry?.Slot, 1, 6)
    const equipmentId = String(equipment?.Id ?? "").trim()
    const uid = String(equipment?.Uid ?? "").trim()
    const level = boundedInteger(equipment?.Level, 0, 15)
    const mainEntries = equipment?.MainPropertyList ?? equipment?.MainStatList
    const subEntries = equipment?.RandomPropertyList
    const context = `角色 ${enkaAgentId} 的驱动盘${slot ?? "未知"}号位`

    if (!slot || !equipmentId || !uid || level == null || !Array.isArray(mainEntries)
      || mainEntries.length !== 1 || !Array.isArray(subEntries) || slots.has(slot) || uids.has(uid)) {
      warnings.push(`${context}结构无效或存在重复，已跳过该盘。`)
      continue
    }

    const mainStat = parseDriveDiscStat(mainEntries[0], `${context}主词条`, warnings)
    const subStats = subEntries.map((stat, index) =>
      parseDriveDiscStat(stat, `${context}副词条 ${index + 1}`, warnings)
    )
    if (!mainStat || subStats.some(stat => !stat)) {
      warnings.push(`${context}词条未完整解析，已跳过该盘。`)
      continue
    }

    slots.add(slot)
    uids.add(uid)
    driveDiscs.push({
      slot,
      equipmentId,
      uid,
      level,
      locked: equipment?.IsLocked === true,
      mainStat,
      subStats,
    })
  }

  return driveDiscs.sort((left, right) => left.slot - right.slot)
}

export function parseEnkaShowcase(enkaData) {
  const warnings = []
  const agents = []

  for (const avatar of extractAvatarList(enkaData)) {
    const enkaId = String(avatar?.Id ?? "").trim()
    if (!enkaId) {
      warnings.push("Enka 返回了缺少角色 ID 的条目，已跳过。")
      continue
    }
    const agentLevel = boundedInteger(avatar.Level, 1, 60)
    const cinemaLevel = boundedInteger(avatar.TalentLevel, 0, 6)
    if (agentLevel == null) warnings.push(`角色 ${enkaId} 的等级缺失或越界，保留 Calculator 原值。`)
    if (cinemaLevel == null) warnings.push(`角色 ${enkaId} 的影画等级缺失或越界，保留 Calculator 原值。`)

    agents.push({
      enkaId,
      agentLevel,
      cinemaLevel,
      coreSkillLevel: parseCoreSkill(avatar.CoreSkillEnhancement, warnings, enkaId),
      skillLevels: parseSkillLevels(avatar.SkillLevelList, cinemaLevel, warnings, enkaId),
      wEngine: parseWEngine(avatar.Weapon, warnings, enkaId),
      driveDiscSourceCount: Array.isArray(avatar.EquippedList) ? avatar.EquippedList.length : null,
      driveDiscs: parseDriveDiscs(avatar.EquippedList, warnings, enkaId),
    })
  }

  if (!agents.length) warnings.push("Enka 没有返回公开展柜角色，请确认已开启角色详情展示。")
  return { agents, warnings }
}
