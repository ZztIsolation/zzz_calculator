import {
  ANOMALY_EFFECT_LABELS,
  DISORDER_EFFECT_LABELS,
  combatBuffDisplayName as sharedCombatBuffDisplayName,
  enumLabel as sharedEnumLabel,
  localizedText,
  nameOf,
  rarityLabel as sharedRarityLabel,
  formatStoredStatValue as sharedFormatStoredStatValue,
  storedBuffModifierTexts as sharedStoredBuffModifierTexts,
  storedEffectRulesText as sharedStoredEffectRulesText,
  storedStatLabel as sharedStoredStatLabel,
  statLabel as sharedStatLabel,
} from "@core/shared-combat.js"
import {
  damageSkillRowsWithGeneratedTotals,
} from "@core/skillMultiplierCandidates.js"

export function labelOf(item: any): string {
  return nameOf(item)
}

export function buffDisplayName(buff: any): string {
  return sharedCombatBuffDisplayName(buff)
}

export function buffEffectLines(buff: any, runtime?: any, meta?: any): string[] {
  const normalText = sharedStoredEffectRulesText(buff, runtime, meta)
  const modifierTexts = sharedStoredBuffModifierTexts(buff)
  return [
    normalText,
    ...(Array.isArray(modifierTexts) ? modifierTexts : []),
  ].filter(Boolean)
}

function isRawIdentifierText(value: string): boolean {
  return /^[a-z][A-Za-z0-9_.:-]*$/.test(value.trim())
}

export function buffSubtitle(buff: any): string {
  const candidates = [
    localizedText(buff?.description),
    localizedText(buff?.conditionLabel),
    localizedText(buff?.sourceLabel),
  ]
  return candidates.find(text => text && !isRawIdentifierText(text)) || "常规生效"
}

export function skillCategoryLabel(value: unknown, item?: any): string {
  const raw = String(value ?? item?.id ?? "")
  const fallback: Record<string, string> = {
    basic: "普通攻击",
    dodge: "闪避",
    assist: "支援技",
    special: "特殊技",
    chain: "连携技",
    core_skill: "核心技",
  }
  const label = item ? labelOf(item) : ""
  return label && label !== raw ? label : fallback[raw] ?? label ?? raw
}

export function skillRowLabel(row: any): string {
  return localizedText(row?.label) || localizedText(row?.name) || ""
}

function isDirectSkillEvent(event: any): boolean {
  return event?.kind === "direct" || event?.kind === "sheer"
}

function isReadableDisplayText(value: unknown): value is string {
  const text = String(value ?? "").trim()
  return Boolean(text) && !isRawIdentifierText(text)
}

function skillCatalogCandidates(meta?: any, fallbackSkillCatalog?: any): any[] {
  const candidates = [
    ...(Array.isArray(meta?.agentSkills) ? meta.agentSkills : []),
    fallbackSkillCatalog,
  ].filter(Boolean)
  return [...new Map(candidates.map(skill => [skill?.id ?? skill?.agentId ?? Math.random(), skill])).values()]
}

export function resolveDamageSkillRef(skillRef: any, meta?: any, fallbackSkillCatalog?: any) {
  if (!skillRef || typeof skillRef !== "object") {
    return null
  }
  const refAgentSkillId = String(skillRef.agentSkillId ?? "").trim()
  const skillCatalogs = skillCatalogCandidates(meta, fallbackSkillCatalog)
  const skill = skillCatalogs.find(item => item?.id === refAgentSkillId || item?.agentId === refAgentSkillId)
    ?? fallbackSkillCatalog
    ?? null
  const category = (skill?.categories ?? []).find((item: any) => item.id === skillRef.categoryId) ?? null
  const move = (category?.moves ?? []).find((item: any) => item.id === skillRef.moveId) ?? null
  const row = damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {})
    .find((item: any) => item.id === skillRef.rowId) ?? null
  if (!skill || !category || !move || !row) {
    return null
  }
  return { skill, category, move, row }
}

export function damageSkillRefPathLabel(skillRef: any, meta?: any, fallbackSkillCatalog?: any): string {
  const resolved = resolveDamageSkillRef(skillRef, meta, fallbackSkillCatalog)
  if (!resolved) {
    return ""
  }
  return [
    skillCategoryLabel(skillRef?.categoryId, resolved.category),
    labelOf(resolved.move),
    skillRowLabel(resolved.row),
  ].filter(Boolean).join(" / ")
}

function compactSkillRowLabel(row: any): string {
  return skillRowLabel(row)
    .replace(/伤害倍率$/u, "")
    .replace(/倍率$/u, "")
    .trim()
}

export function damageEventSummaryTitle(event: any, meta?: any, fallbackSkillCatalog?: any): string {
  if (isDirectSkillEvent(event)) {
    const resolved = resolveDamageSkillRef(event?.skillRef, meta, fallbackSkillCatalog)
    if (resolved) {
      const parts = [
        labelOf(resolved.move),
        compactSkillRowLabel(resolved.row),
      ].filter(Boolean)
      return `${parts.join(" / ")} ×${event?.count ?? 1}`
    }
  }
  return damageEventTitle(event, meta, fallbackSkillCatalog)
}

export function hasResolvedDamageSkillRef(event: any, meta?: any, fallbackSkillCatalog?: any): boolean {
  return Boolean(resolveDamageSkillRef(event?.skillRef, meta, fallbackSkillCatalog))
}

export function damageEventNeedsSkillMultiplier(event: any, meta?: any, fallbackSkillCatalog?: any): boolean {
  if (!isDirectSkillEvent(event)) {
    return false
  }
  if (hasResolvedDamageSkillRef(event, meta, fallbackSkillCatalog)) {
    return false
  }
  return !Number.isFinite(Number(event?.skillMultiplier))
}

export function textOf(value: any): string {
  return localizedText(value)
}

export function formatNumber(value: unknown, digits = 0): string {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return "-"
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(number)
}

export function formatPercent(value: unknown, digits = 1): string {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return "-"
  }
  return `${formatNumber(number * 100, digits)}%`
}

export function statLabel(key: string, meta?: any): string {
  return sharedStatLabel(key, meta)
}

export function storedStatLabel(key: string, mode = "", meta?: any): string {
  return sharedStoredStatLabel(key, mode, meta)
}

export function formatStoredStatValue(stat: string, value: unknown, mode = ""): string {
  const number = Number(value)
  return sharedFormatStoredStatValue(stat, Number.isFinite(number) ? number : Number.NaN, {
    mode,
    percentMode: mode === "pct",
  })
}

export function rarityText(item: any): string {
  return entityMetaText(item)
}

export function enumText(type: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-"
  }
  return sharedEnumLabel(type, String(value))
}

export function attributeLabel(value: unknown): string {
  return enumText("attribute", value)
}

export function specialtyLabel(value: unknown): string {
  return enumText("specialty", value)
}

export function rarityLabelText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-"
  }
  const raw = String(value)
  return ["S", "A", "B"].includes(raw) ? sharedRarityLabel(raw) : raw
}

export function entityMetaText(item: any): string {
  const parts = [
    item?.specialty ? specialtyLabel(item.specialty) : "",
    item?.rarity ? rarityLabelText(item.rarity) : "",
  ].filter(Boolean)
  if (!parts.length && item?.attribute) {
    parts.push(attributeLabel(item.attribute))
  }
  return parts.join(" / ")
}

export function entitySelectLabel(item: any): string {
  return [labelOf(item), entityMetaText(item)].filter(Boolean).join(" / ")
}

export function entitySearchText(item: any): string {
  return [
    item?.id,
    labelOf(item),
    item?.name?.en,
    item?.specialty,
    item?.specialty ? specialtyLabel(item.specialty) : "",
    item?.attribute,
    item?.attribute ? attributeLabel(item.attribute) : "",
    item?.rarity,
    item?.rarity ? rarityLabelText(item.rarity) : "",
  ].filter(Boolean).join(" ")
}

export function damageModeLabel(value: unknown): string {
  const labels: Record<string, string> = {
    single: "最大化单个技能伤害",
    sheer: "最大化贯穿伤害",
    anomaly: "最大化异常伤害",
    adminDefault: "管理员默认循环",
    custom: "自定义",
  }
  return labels[String(value ?? "")] ?? String(value ?? "-")
}

export function optimizerStatusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    idle: "待机",
    estimating: "预估中",
    preparing: "准备中",
    running: "运行中",
    cancelling: "正在取消",
    cancelled: "已取消",
    done: "已完成",
    error: "异常",
  }
  return labels[String(value ?? "")] ?? String(value ?? "-")
}

export function damageEventKindLabel(event: any): string {
  const kind = event?.kind
  if (kind === "skillGroup") {
    return "技能组"
  }
  if (kind === "direct") {
    return "直伤"
  }
  if (kind === "sheer") {
    return "贯穿"
  }
  if (kind === "anomaly") {
    return event?.settlementType === "disorder" ? "紊乱" : "属性异常"
  }
  if (kind === "disorder") {
    return "紊乱"
  }
  return "事件"
}

export function anomalyEffectLabel(value: unknown, meta?: any): string {
  if (value === null || value === undefined || value === "") {
    return ""
  }
  const id = String(value)
  const effect = (meta?.anomalyEffects ?? [])
    .find((item: any) => item?.id === id || item?.type === id)
  return (effect ? localizedText(effect.label) || labelOf(effect) : "") || ANOMALY_EFFECT_LABELS[id] || id
}

export function disorderEffectLabel(value: unknown, meta?: any): string {
  if (value === null || value === undefined || value === "") {
    return ""
  }
  const id = String(value)
  const effect = (meta?.disorderEffects ?? [])
    .find((item: any) => item?.id === id || item?.type === id)
  return (effect ? localizedText(effect.label) || labelOf(effect) : "") || DISORDER_EFFECT_LABELS[id] || id
}

function skillGroupSubjectLabel(event: any, meta?: any, fallbackSkillCatalog?: any): string {
  const groupId = String(event?.skillGroupId ?? event?.groupId ?? "")
  const agentId = String(fallbackSkillCatalog?.agentId ?? fallbackSkillCatalog?.id ?? "")
  const agents = Array.isArray(meta?.agents) ? meta.agents : []
  const agentCandidates = agentId
    ? agents.filter((agent: any) => agent?.id === agentId)
    : agents
  const group = agentCandidates
    .flatMap((agent: any) => Array.isArray(agent?.skillGroups) ? agent.skillGroups : [])
    .find((item: any) => item?.id === groupId)
  return labelOf(group) || groupId || "技能组"
}

export function damageEventSubjectLabel(event: any, meta?: any, fallbackSkillCatalog?: any): string {
  if (!event) {
    return "-"
  }
  if (event.kind === "skillGroup") {
    return skillGroupSubjectLabel(event, meta, fallbackSkillCatalog)
  }
  if (isDirectSkillEvent(event)) {
    const skillLabel = damageSkillRefPathLabel(event.skillRef, meta, fallbackSkillCatalog)
    if (skillLabel) {
      return skillLabel
    }
    if (isReadableDisplayText(event.label)) {
      return event.label
    }
    if (Number.isFinite(Number(event.skillMultiplier))) {
      return `手填倍率 ${Number(event.skillMultiplier)}%`
    }
    return damageEventKindLabel(event)
  }
  if (event.kind === "anomaly" && event.settlementType !== "disorder") {
    if (isReadableDisplayText(event.label)) {
      return event.label
    }
    if (event.anomalyVariant === "polarizedAssault") {
      return "极性强击"
    }
    return anomalyEffectLabel(event.anomalyEffect, meta) || "属性异常"
  }
  if (event.kind === "disorder" || event.settlementType === "disorder") {
    if (isReadableDisplayText(event.label)) {
      return event.label
    }
    const effectId = event.anomalyEffect ?? event.previousAnomalyEffect
    return disorderEffectLabel(effectId, meta) || "紊乱"
  }
  return isReadableDisplayText(event.label) ? event.label : damageEventKindLabel(event)
}

export function damageEventTitle(event: any, meta?: any, fallbackSkillCatalog?: any): string {
  return `${damageEventKindLabel(event)} · ${damageEventSubjectLabel(event, meta, fallbackSkillCatalog)} ×${event?.count ?? 1}`
}
