import {
  clampWEngineModificationLevel,
  effectRules,
  localizedText,
  materializeWEngineForModificationLevel,
  nameOf,
} from "@core/shared-combat.js"
import { buffDisplayName } from "@/utils/format"

export type BuffCategory = "self" | "selfWEngine" | "teammate" | "teammateWEngine" | "teammateDriveDisc" | "field" | "boss" | "custom"

export const BUFF_CATEGORY_TABS: Array<{ name: BuffCategory, label: string }> = [
  { name: "self", label: "自身 Buff" },
  { name: "selfWEngine", label: "自身音擎 Buff" },
  { name: "teammate", label: "队友 Buff" },
  { name: "teammateWEngine", label: "队友音擎buff" },
  { name: "teammateDriveDisc", label: "队友驱动盘buff" },
  { name: "field", label: "场地 Buff" },
  { name: "boss", label: "Boss Buff" },
  { name: "custom", label: "自定义 Buff" },
]

type CombatBuffContext = {
  meta?: any
  catalogBuffs?: any[]
  driveDiscSets?: any[]
  agentId?: string
  cinemaLevel?: number
  wEngineId?: string
  wEngineModificationLevel?: number
  addedBuffs?: any[]
}

function dedupeById(items: any[]): any[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const id = String(item?.id ?? "")
    if (!id || seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

function combatBuffsFromContext(context: CombatBuffContext): any[] {
  return context.catalogBuffs ?? context.meta?.displayCombatBuffs ?? context.meta?.combatBuffs ?? []
}

function inCombatEffect(effect: any): boolean {
  return Boolean(effect) && (!effect.scope || effect.scope === "inCombat")
}

function agentBuffSourceLabel(key: string, buff: any = {}) {
  if (buff.source || buff.sourceLabel) {
    return buff.source ?? buff.sourceLabel
  }
  const labels: Record<string, string> = {
    corePassive: "核心被动",
    additionalAbility: "额外能力",
  }
  return { zhCN: labels[key] ?? key }
}

function cinemaBuffName(buff: any = {}) {
  const level = Number(buff.cinemaLevel)
  const prefix = Number.isInteger(level) ? `影画${level}` : "影画"
  return {
    zhCN: [prefix, localizedText(buff.cinemaName)].filter(Boolean).join("｜"),
  }
}

export function currentAgentBuffCandidates(meta: any, agentId = "", cinemaLevel = 0): any[] {
  const agent = (meta?.agents ?? []).find((item: any) => item.id === agentId)
  if (!agent) {
    return []
  }
  const combatBuffs = agent.combatBuffs ?? {}
  const fixedBuffs = [
    ["corePassive", combatBuffs.corePassive],
    ["additionalAbility", combatBuffs.additionalAbility],
  ]
    .filter(([, buff]) => inCombatEffect(buff))
    .map(([key, buff]) => {
      const source = agentBuffSourceLabel(String(key), buff)
      return {
        ...buff,
        id: `agent:${agent.id}.${key}`,
        sourceType: "self",
        sourceCategory: "agent",
        sourceKind: "self",
        ownerId: agent.id,
        ownerName: agent.name,
        ownerImages: agent.images ?? null,
        agentName: agent.name,
        agentImages: agent.images ?? null,
        source,
        sourceLabel: source,
        name: buff.name ?? source,
        description: buff.description ?? null,
        conditionLabel: buff.conditionLabel ?? buff.condition ?? null,
      }
    })

  const cinemaBuffs = (combatBuffs.cinemaBuffs ?? [])
    .filter((buff: any) => {
      const level = Number(buff?.cinemaLevel)
      return inCombatEffect(buff)
        && Number.isInteger(level)
        && level >= 1
        && level <= Number(cinemaLevel ?? 0)
    })
    .map((buff: any) => {
      const source = cinemaBuffName(buff)
      return {
        ...buff,
        id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
        sourceType: "self",
        sourceCategory: "agent",
        sourceKind: "cinema",
        ownerId: agent.id,
        ownerName: agent.name,
        ownerImages: agent.images ?? null,
        agentName: agent.name,
        agentImages: agent.images ?? null,
        source,
        sourceLabel: source,
        name: buff.name ?? source,
        description: buff.description ?? null,
        conditionLabel: buff.conditionLabel ?? buff.condition ?? null,
      }
    })

  return [...fixedBuffs, ...cinemaBuffs]
}

function wEngineEffectData(wEngine: any) {
  if (wEngine?.effect) {
    return wEngine.effect
  }
  if (wEngine?.passive) {
    return {
      name: wEngine.passive.name,
      description: null,
      requirement: wEngine.specialty ? { specialty: wEngine.specialty } : null,
      buff: wEngine.passive,
    }
  }
  return null
}

function wEngineSelfBuff(wEngine: any) {
  const effect = wEngineEffectData(wEngine)
  return effect?.selfBuff ?? wEngine?.selfBuff ?? effect?.buff ?? wEngine?.passive ?? null
}

function wEngineTeamBuff(wEngine: any) {
  const effect = wEngineEffectData(wEngine)
  return effect?.teamBuff ?? wEngine?.teamBuff ?? null
}

export function wEngineIdFromTeamBuffId(id = ""): string {
  return String(id ?? "").match(/^wEngine:(.+)\.team$/)?.[1] ?? ""
}

function wEngineTeamBuffReference(addedBuffs: any[] = [], id = "") {
  return addedBuffs.find(item => item?.sourceKind === "wEngineTeam" && item?.id === id) ?? null
}

function wEngineModificationRange(wEngine: any = {}) {
  const modification = wEngine?.modification ?? {}
  const min = Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1
  const max = Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5
  return { min, max: Math.max(min, max) }
}

export function currentWEngineBuffCandidates(meta: any, wEngineId = "", modificationLevel = 1): any[] {
  const rawWEngine = (meta?.wEngines ?? []).find((item: any) => item.id === wEngineId)
  if (!rawWEngine) {
    return []
  }
  const wEngine = materializeWEngineForModificationLevel(rawWEngine, modificationLevel)
  const effect = wEngineEffectData(wEngine)
  const entries = [
    {
      id: `wEngine:${wEngine.id}.self`,
      sourceType: "wEngine",
      sourceCategory: "wEngine",
      sourceKind: "wEngine",
      ownerImages: wEngine.images ?? null,
      name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（限佩戴者）` },
      description: effect?.description ?? wEngineSelfBuff(wEngine)?.description ?? null,
      conditionLabel: localizedText(effect?.requirement?.label) || wEngineSelfBuff(wEngine)?.condition,
      buff: wEngineSelfBuff(wEngine),
    },
    {
      id: `wEngine:${wEngine.id}.team`,
      sourceType: "wEngineTeam",
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      ownerImages: wEngine.images ?? null,
      name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（团队）` },
      description: effect?.description ?? wEngineTeamBuff(wEngine)?.description ?? null,
      conditionLabel: localizedText(effect?.requirement?.label) || wEngineTeamBuff(wEngine)?.condition,
      buff: wEngineTeamBuff(wEngine),
    },
  ]

  return entries
    .filter(item => inCombatEffect(item.buff))
    .map(item => ({
      ...item.buff,
      id: item.id,
      sourceType: item.sourceType,
      sourceCategory: item.sourceCategory,
      sourceKind: item.sourceKind,
      ownerName: wEngine.name,
      ownerImages: wEngine.images ?? null,
      name: item.name,
      description: item.description,
      conditionLabel: item.conditionLabel,
    }))
}

export function teammateBuffCandidates(meta: any): any[] {
  const groupedIds = new Set<string>()
  const groups = (meta?.displayTeammateCombatBuffGroups ?? meta?.teammateCombatBuffGroups ?? [])
    .flatMap((group: any) => (group.buffs ?? []).map((buff: any) => {
      groupedIds.add(buff.id)
      return {
        ...buff,
        id: buff.id,
        sourceType: "teammate",
        sourceCategory: "agent",
        sourceKind: "teammate",
        ownerId: group.id,
        ownerName: group.name,
        ownerImages: group.images ?? buff.teammateImages ?? null,
        teammateAttribute: group.attribute ?? null,
        teammateSpecialty: group.specialty ?? null,
        teammateImages: group.images ?? buff.teammateImages ?? null,
        sourceLabel: buff.sourceLabel ?? buff.source,
        source: buff.source,
      }
    }))
  const fallback = (meta?.displayCombatBuffs ?? meta?.combatBuffs ?? [])
    .filter((buff: any) => buff?.sourceType === "teammate" && !groupedIds.has(buff.id))
  return dedupeById([...groups, ...fallback])
}

export function teamWEngineBuffCandidates(meta: any, currentWEngineId = "", addedBuffs: any[] = []): any[] {
  return (meta?.displayWEngines ?? meta?.wEngines ?? [])
    .filter((wEngine: any) => wEngine?.id && wEngine.id !== currentWEngineId)
    .map((rawWEngine: any) => {
      const id = `wEngine:${rawWEngine.id}.team`
      const reference = wEngineTeamBuffReference(addedBuffs, id)
      const modificationLevel = clampWEngineModificationLevel(reference?.wEngineModificationLevel, rawWEngine)
      const wEngine = materializeWEngineForModificationLevel(rawWEngine, modificationLevel)
      const effect = wEngineEffectData(wEngine)
      const buff = wEngineTeamBuff(wEngine)
      if (!inCombatEffect(buff)) {
        return null
      }
      const modificationRange = wEngineModificationRange(rawWEngine)
      return {
        ...buff,
        id,
        sourceType: "wEngineTeam",
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        isTeammateWEngine: true,
        wEngineModificationLevel: wEngine.selectedModificationLevel ?? modificationLevel,
        wEngineModificationMin: modificationRange.min,
        wEngineModificationMax: modificationRange.max,
        ownerName: wEngine.name,
        ownerImages: wEngine.images ?? null,
        name: { zhCN: `${nameOf(wEngine)}（队友携带）` },
        description: effect?.description ?? buff.description ?? buff.conditionLabel,
        conditionLabel: buff.condition ?? effect?.requirement?.label,
      }
    })
    .filter(Boolean)
}

function driveDiscFourPieceTeamBuff(set: any) {
  const buff = set?.fourPiece?.teamBuff ?? null
  return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

export function teammateDriveDiscBuffCandidates(driveDiscSets: any[] = []): any[] {
  return driveDiscSets
    .filter(set => set?.fourPiece)
    .map(set => {
      const teamBuff = driveDiscFourPieceTeamBuff(set)
      if (!teamBuff) {
        return null
      }
      return {
        ...teamBuff,
        id: `teammateDriveDisc4pc:${set.id}`,
        sourceType: "driveDisc4pcTeam",
        sourceCategory: "driveDisc",
        sourceKind: "teammateDriveDisc4pc",
        setId: set.id,
        ownerName: { zhCN: "队友", en: "Teammate" },
        ownerImages: set.images ?? null,
        images: set.images ?? null,
        name: set.name,
        description: set.fourPiece?.effectText ?? teamBuff.condition,
        conditionLabel: teamBuff.condition,
      }
    })
    .filter(Boolean)
}

export function fieldBuffCandidates(context: CombatBuffContext): any[] {
  return dedupeById(combatBuffsFromContext(context)
    .filter((buff: any) => buff?.sourceType === "field"))
}

export function bossBuffCandidates(context: CombatBuffContext): any[] {
  const byId = new Map<string, any>()
  for (const buff of combatBuffsFromContext(context).filter((item: any) => item?.sourceType === "boss")) {
    if (buff?.id) byId.set(String(buff.id), buff)
  }
  for (const buff of context.meta?.bossCombatBuffs ?? []) {
    if (!buff?.id) continue
    const id = String(buff.id)
    byId.set(id, { ...(byId.get(id) ?? {}), ...buff })
  }
  return dedupeById([...byId.values()])
}

export function buildCombatBuffGroups(context: CombatBuffContext): Record<BuffCategory, any[]> {
  const catalogBuffs = combatBuffsFromContext(context)
  return {
    self: dedupeById([
      ...currentAgentBuffCandidates(context.meta, context.agentId, context.cinemaLevel),
      ...catalogBuffs.filter((buff: any) => buff?.sourceType === "self"),
    ]),
    selfWEngine: currentWEngineBuffCandidates(context.meta, context.wEngineId, context.wEngineModificationLevel),
    teammate: teammateBuffCandidates(context.meta),
    teammateWEngine: teamWEngineBuffCandidates(context.meta, context.wEngineId, context.addedBuffs),
    teammateDriveDisc: teammateDriveDiscBuffCandidates(context.driveDiscSets),
    field: fieldBuffCandidates(context),
    boss: bossBuffCandidates(context),
    custom: (context.addedBuffs ?? []).filter((buff: any) => buff?.sourceKind === "custom"),
  }
}

export function allDisplayCombatBuffCandidates(context: CombatBuffContext): any[] {
  const groups = buildCombatBuffGroups(context)
  return dedupeById([
    ...Object.values(groups).flat(),
    ...combatBuffsFromContext(context),
    ...(context.addedBuffs ?? []).filter((buff: any) => buff?.sourceKind === "custom"),
  ])
}

export function buffLabelForId(id: string, context: CombatBuffContext): string {
  const buff = allDisplayCombatBuffCandidates(context).find(item => item?.id === id)
  if (buff) {
    const label = buffDisplayName(buff)
    return buff?.isTeammateWEngine && Number.isInteger(Number(buff.wEngineModificationLevel))
      ? `${label} · 精 ${Number(buff.wEngineModificationLevel)}`
      : label
  }
  const driveDiscMatch = String(id ?? "").match(/^driveDisc4pc:([^.:]+)(?:\.(self|team))?$/)
  if (driveDiscMatch) {
    const set = (context.driveDiscSets ?? context.meta?.driveDiscSets ?? []).find((item: any) => item?.id === driveDiscMatch[1])
    const partLabel = driveDiscMatch[2] === "team" ? "团队" : "自身"
    return `${nameOf(set) || driveDiscMatch[1]} 4 件套（${partLabel}）`
  }
  return id
}

export function teammateDriveDiscSetIdsFromBuffIds(ids: string[]): string[] {
  return ids
    .map(id => {
      const parts = String(id ?? "").split(":")
      if (parts[0] !== "teammateDriveDisc4pc") {
        return ""
      }
      return parts.length >= 3 ? parts[2] : parts[1]
    })
    .filter(Boolean)
}
