<script setup lang="ts">
import { cleanStoredReactiveEvent, isWindAgent as hasWindAttribute, WIND_TURBULENCE_NOTICE } from "@core/anomalySettlement.js"
import { computed, ref, watch } from "vue"
import { NButton, NInputNumber, NRadioButton, NRadioGroup, NScrollbar, NSelect, NSwitch, NTag } from "naive-ui"
import { Copy, Info, Lock, RefreshCcw, Trash2 } from "lucide-vue-next"
import EnemyTargetConfigPanel from "@/components/EnemyTargetConfigPanel.vue"
import SkillPickerModal from "@/components/SkillPickerModal.vue"
import LuminescenceEventEditor from "@/components/LuminescenceEventEditor.vue"
import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"
import {
  defaultDamageConfig,
  hasAdminDefaultCalculation,
  isDamageModeAllowedForAgent,
  isArmorerAgent,
  isRuptureAgent,
  normalizeDamageModeForAgent,
} from "@/stores/build"
import {
  anomalyEffectLabel,
  damageEventKindLabel,
  damageEventNeedsSkillMultiplier,
  damageEventSubjectLabel,
  damageModeLabel,
  damageSkillRefPathLabel,
  disorderEffectLabel,
  formatNumber,
  formatPercent,
  labelOf,
  textOf,
  skillCategoryLabel,
  skillRowLabel,
} from "@/utils/format"
import {
  damageSkillRowsWithGeneratedTotals,
  defaultSkillLevel,
  normalizeSkillLevel,
  skillRowValue,
} from "@core/skillMultiplierCandidates.js"
import { damageModifierAppliesTo, isTeamAnomalyDamageModifier, resolveAnomalyCritForEvent } from "@core/calculator-core.js"
import {
  calculationSkillGroups,
  defaultSkillGroupReferenceEvent,
  normalizeSkillGroupReferenceEvent,
  skillGroupById,
  skillGroupCountLimits,
} from "@core/calculationSkillGroups.js"
import { resolveDefaultCalculationConfig } from "@core/defaultCalculationConfig.js"
import {
  disorderBaseMultiplier,
  disorderElapsedStepSeconds,
  disorderMultiplierScale,
  normalizeElapsedSeconds,
  normalizeDamageScale,
  resolveDamageEventMultiplier,
  turbulenceBaseMultiplier,
  turbulenceElapsedStepSeconds,
} from "@core/damageEventMultipliers.js"
import { damageElementForAgent } from "@core/shared-combat.js"
import { corePassiveScalingRow } from "@core/corePassiveScaling.js"
import {
  anomalyReleaseProfile,
  anomalyReleaseProfiles,
  evaluateAnomalyReleaseProfile,
  resolveReleaseSkillRef,
  isAriaReleaseSourceLocked,
  isFioniReleaseSourceLocked,
  isVelinaReleaseAgent,
  isReleaseSettlement,
  normalizeAnomalyReleaseEventForAgent,
  VELINA_RELEASE_SOURCES,
} from "@core/anomalyRelease.js"
import { isLuminescenceSettlement } from "@core/luminescence.js"
import {
  defaultTurbulenceEffectId,
  normalizeTurbulenceEditorEvent,
  turbulenceConfigurationWarning,
  turbulenceEffectLabel,
  turbulenceEffectsFor,
  turbulenceSourceOptions,
} from "@/utils/turbulence"
import type { LabWorkbenchApi } from "@/lab/useLabWorkbench"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

const meta = computed(() => props.lab.catalogStore.meta)
const agent = computed(() => props.lab.selectedAgent.value)
const skillCatalog = computed(() => props.lab.selectedSkillCatalog.value)
const skillLevels = computed(() => props.lab.buildStore.skillLevels)
const cinemaLevel = computed(() => props.lab.buildStore.cinemaLevel)
const potentialLevel = computed(() => props.lab.buildStore.potentialLevel)
const combatEffects = computed(() => props.lab.buildStore.result?.inCombat?.activeEffects ?? [])
const releaseContext = computed(() => ({
  inCombatPanel: props.lab.buildStore.result?.inCombat?.panel,
  outOfCombatPanel: props.lab.buildStore.result?.outOfCombat?.panel,
  outOfCombatBaseAtk: props.lab.buildStore.result?.outOfCombat?.base?.atk,
  coreSkillLevel: props.lab.buildStore.coreSkillLevel,
  luminescenceDamageMultiplier: props.lab.currentLuminescenceDamageMultiplier.value,
  teamAnomalyDamageMultiplier: props.lab.currentTeamAnomalyDamageMultiplier.value,
}))

const draft = ref<any>(defaultDamageConfig())
const showSkillPicker = ref(false)
const releaseSnapshotError = ref("")

const isAdminDefaultMode = computed(() => draft.value.mode === "adminDefault")
const canEditEventStructure = computed(() => draft.value.mode === "custom")
const canUseSheerDamage = computed(() => isRuptureAgent(agent.value))
const canUseSharpDamage = computed(() => isArmorerAgent(agent.value))
const canUseAdminDefault = computed(() => hasAdminDefaultCalculation(agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0))
const adminCalculationConfig = computed(() => resolveDefaultCalculationConfig(
  agent.value?.defaultCalculationConfig,
  cinemaLevel.value ?? 0,
  potentialLevel.value ?? 0,
))
const skillGroups = computed(() => calculationSkillGroups(agent.value))
const hasSkillGroups = computed(() => skillGroups.value.length > 0)
const skillGroupOptions = computed(() => skillGroups.value.map((group: any) => ({
  label: skillGroupLabel(group),
  value: group.id,
})))

const calculationModeOptions = computed(() => [
  !canUseSheerDamage.value && !canUseSharpDamage.value ? { label: "最大化单个技能伤害", value: "single" } : null,
  canUseSheerDamage.value ? { label: "最大化贯穿伤害", value: "sheer" } : null,
  canUseSharpDamage.value ? { label: "最大化锐化伤害", value: "sharp" } : null,
  { label: "最大化异常伤害", value: "anomaly" },
  { label: canUseAdminDefault.value ? labelOf(adminCalculationConfig.value) : "管理员默认循环（未配置）", value: "adminDefault", disabled: !canUseAdminDefault.value },
  { label: "自定义", value: "custom" },
].filter((option): option is { label: string, value: string, disabled?: boolean } => Boolean(option)))

const headerModeBadge = computed(() => {
  if (draft.value.mode === "adminDefault") {
    const name = labelOf(adminCalculationConfig.value).trim()
    return name && name !== "-" ? name : "默认循环"
  }
  return damageModeLabel(draft.value.mode)
})

const critModeOptions = [
  { label: "期望", value: "expected" },
  { label: "暴击", value: "crit" },
  { label: "非暴击", value: "nonCrit" },
]
const sharpCritModeOptions = [
  { label: "期望", value: "expected" },
  { label: "不触发锐暴", value: "nonCrit" },
  { label: "一次锐暴", value: "sharpCrit" },
  { label: "二次锐暴", value: "lacerationCrit" },
]

const releaseProfiles = computed(() => anomalyReleaseProfiles(agent.value, cinemaLevel.value ?? 0))
const supportsRelease = computed(() => releaseProfiles.value.length > 0)
const supportsLuminescence = computed(() => agent.value?.id === "remielle_dan" || agent.value?.luminescenceModel?.status === "implemented")
const releaseSourceLocked = computed(() => isAriaReleaseSourceLocked(agent.value))
const releaseSourceReadOnly = computed(() => releaseSourceLocked.value || isFioniReleaseSourceLocked(agent.value))
const releaseProfileOptions = computed(() => releaseProfiles.value.map((profile: any) => ({
  label: textOf(profile.name) || profile.id,
  value: profile.id,
})))
const isVelinaRelease = computed(() => isVelinaReleaseAgent(agent.value))
const isWindAgent = computed(() => hasWindAttribute(agent.value))
const velinaReleaseSourceOptions = computed(() => VELINA_RELEASE_SOURCES.map(source => ({
  label: source.label,
  value: source.value,
})))

type SettlementOption = { label: string, value: string, disabled?: boolean, title?: string }
const anomalySettlementOptions = computed<SettlementOption[]>(() => {
  const options: Array<SettlementOption | null> = [
    { label: "属性异常", value: "attribute" },
    !isWindAgent.value ? { label: "乱流", value: "turbulence" } : null,
    !isWindAgent.value ? { label: "紊乱结算", value: "disorder" } : null,
    { label: "异放", value: "release", disabled: !supportsRelease.value, title: supportsRelease.value ? "" : "暂不支持" },
    supportsLuminescence.value ? { label: "耀变", value: "luminescence" } : null,
  ]
  return options.filter((item): item is SettlementOption => item !== null)
})

const disorderTypeOptions = [
  { label: "普通紊乱", value: "normal" },
  { label: "极性紊乱", value: "polarized" },
]
const anomalyVariantOptions = [
  { label: "普通异常", value: "normal" },
  { label: "极性强击", value: "polarizedAssault" },
]

function eventForMode(mode: string) {
  if (mode === "sheer") return newEvent("sheer")
  if (mode === "anomaly") return newEvent("anomaly")
  if (mode === "sharp") return newEvent("sharp")
  return newEvent("direct")
}

function normalizeDraftForAgent(config: any) {
  const mode = normalizeDamageModeForAgent(config?.mode, agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
  if (mode === config?.mode) return config
  const event = eventForMode(mode)
  return {
    ...config,
    mode,
    selectedEventId: event.id,
    events: [event],
  }
}

const anomalyOptions = computed(() => (meta.value?.anomalyEffects ?? [])
  .filter((effect: any) => effect.settlementType === "attribute")
  .map((effect: any) => ({
    label: anomalyEffectLabel(effect.id, meta.value),
    value: effect.id,
  })))

const disorderOptions = computed(() => (meta.value?.disorderEffects ?? []).map((effect: any) => ({
  label: disorderEffectLabel(effect.id, meta.value),
  value: effect.id,
})))

const turbulenceEffects = computed(() => turbulenceEffectsFor(meta.value))
const turbulenceOptions = computed(() => turbulenceSourceOptions(meta.value))
const turbulenceWarnings = computed(() => [...new Set<string>((draft.value.events ?? [])
  .map((event: any) => turbulenceConfigurationWarning(event, meta.value)).filter(Boolean))])

function agentLabel(id: string) {
  return labelOf((meta.value?.agents ?? []).find((item: any) => item?.id === id)) || id || "未配置"
}

const releaseSourceOptions = computed(() => (meta.value?.agents ?? []).map((item: any) => ({
  label: labelOf(item) || item.id,
  value: item.id,
})))

const selectedEvent = computed(() => (draft.value.events ?? []).find((event: any) => event.id === draft.value.selectedEventId) ?? draft.value.events?.[0])
const skillCategories = computed(() => skillCatalog.value?.categories ?? [])
const skillCategoryOptions = computed(() => skillCategories.value.map((category: any) => ({
  label: skillCategoryLabel(category.id, category),
  value: category.id,
})))

const computedEventDamageById = computed(() => {
  const map = new Map<string, number>()
  const events = props.lab.buildStore.result?.damage?.events ?? []
  for (const ev of events) {
    const dmg = Number(ev?.finalDamage ?? 0)
    if (!Number.isFinite(dmg) || !ev?.id) continue
    const id = String(ev.id)
    map.set(id, dmg)
    const sepIdx = id.indexOf("__")
    if (sepIdx > 0) {
      const parentId = id.slice(0, sepIdx)
      map.set(parentId, (map.get(parentId) ?? 0) + dmg)
    }
  }
  return map
})

function luminescencePreviewEvent(event: any) {
  return {
    ...event,
    kind: "anomaly",
    settlementType: "luminescence",
    triggerActorRef: { agentId: String(agent.value?.id ?? event?.triggerActorRef?.agentId ?? "") },
    damageElement: agent.value?.damageElement ?? agent.value?.attribute,
    anomalyVariant: "normal",
  }
}

function luminescenceDamageMultipliersFromEffects(event: any) {
  const previewEvent = luminescencePreviewEvent(event)
  let luminescenceDamageBonus = 0
  let teamAnomalyDamageBonus = 0
  for (const combatEffect of combatEffects.value ?? []) {
    for (const modifier of combatEffect?.resolvedDamageModifiers ?? []) {
      if (modifier?.kind !== "anomalyDamageBonus" || !damageModifierAppliesTo(modifier, previewEvent)) continue
      const value = Number(modifier?.value ?? 0)
      if (!Number.isFinite(value)) continue
      luminescenceDamageBonus += value
      if (isTeamAnomalyDamageModifier(modifier)) {
        teamAnomalyDamageBonus += value
      }
    }
  }
  return {
    luminescenceDamageMultiplier: Math.max(0, 1 + luminescenceDamageBonus),
    teamAnomalyDamageMultiplier: Math.max(0, 1 + teamAnomalyDamageBonus),
  }
}

function explicitNonNegativeMultiplier(raw: unknown) {
  if (raw !== undefined && raw !== null && raw !== "") {
    const explicit = Number(raw)
    if (Number.isFinite(explicit) && explicit >= 0) return explicit
  }
  return null
}

const luminescencePreviewMultipliers = computed(() => {
  const derived = luminescenceDamageMultipliersFromEffects(selectedEvent.value)
  return {
    luminescenceDamageMultiplier: explicitNonNegativeMultiplier(releaseContext.value?.luminescenceDamageMultiplier)
      ?? derived.luminescenceDamageMultiplier,
    teamAnomalyDamageMultiplier: explicitNonNegativeMultiplier(releaseContext.value?.teamAnomalyDamageMultiplier)
      ?? derived.teamAnomalyDamageMultiplier,
  }
})

function eventTitle(event: any) {
  if (isLuminescenceSettlement(event)) return "队伍异常评分"
  if (event?.kind === "skillGroup") return `技能组 · ${skillGroupLabel(selectedSkillGroup(event))}`
  const displayEvent = eventWithSkillSelection(event)
  return `${damageEventKindLabel(displayEvent)} · ${damageEventSubjectLabel(displayEvent, meta.value, skillCatalog.value)}`
}

function eventListTitle(event: any) {
  const displayEvent = eventWithSkillSelection(event)
  if (isDirectSkillEvent(displayEvent)) {
    const selection = selectedSkillSelection(displayEvent)
    return selection
      ? `${labelOf(selection.move)} / ${skillRowLabel(selection.row)}`
      : damageEventSubjectLabel(displayEvent, meta.value, skillCatalog.value)
  }
  return eventTitle(event)
}

function releaseEffect(event: any) {
  const effectId = String(event?.anomalyEffect ?? "")
  return (meta.value?.anomalyEffects ?? []).find((effect: any) => effect?.id === effectId) ?? null
}

function releaseModifierValues(event: any, effect: any) {
  const previewEvent = {
    ...event,
    kind: "anomaly",
    settlementType: "release",
    anomalyVariant: "release",
    damageElement: effect?.element ?? event?.damageElement,
  }
  let releaseProficiencyYieldBonus = 0
  for (const combatEffect of combatEffects.value ?? []) {
    for (const modifier of combatEffect?.resolvedDamageModifiers ?? []) {
      if (modifier?.kind !== "releaseProficiencyYieldBonus" || !damageModifierAppliesTo(modifier, previewEvent)) continue
      const value = Number(modifier?.value ?? 0)
      if (Number.isFinite(value)) releaseProficiencyYieldBonus += value
    }
  }
  return { releaseProficiencyYieldBonus }
}

function releaseSkillMultiplierFor(profile: any, event: any) {
  return resolveReleaseSkillRef({ agentSkills: skillCatalog.value ? [skillCatalog.value] : [] }, agent.value,
    profile?.releaseSkillRef ?? event?.releaseSkillRef, {
      skillLevelsByCategory: skillLevels.value,
      coreSkillLevel: releaseContext.value?.coreSkillLevel,
    })?.releaseSkillMultiplier
}

function releaseTraceNode(trace: any, predicate: (value: any) => boolean): any | null {
  if (!trace) return null
  if (predicate(trace)) return trace
  for (const child of trace.children ?? []) {
    const match = releaseTraceNode(child, predicate)
    if (match) return match
  }
  return null
}

function releaseBreakdown(event: any) {
  if (!isReleaseSettlement(event)) return null
  const effect = releaseEffect(event)
  const profileId = isVelinaReleaseAgent(agent.value)
    ? event?.releaseSource
    : event?.triggerActorRef?.profileId
  const profile = anomalyReleaseProfile(agent.value, profileId, effect?.element, cinemaLevel.value ?? 0)
  if (!effect || !profile) return null
  try {
    const releaseModifiers = releaseModifierValues(event, effect)
    const evaluated = evaluateAnomalyReleaseProfile(profile, {
      cinemaLevel: cinemaLevel.value ?? 0,
      originalBaseMultiplier: Number(effect.baseMultiplier ?? 0),
      trigger: {
        inCombatPanel: releaseContext.value?.inCombatPanel ?? {},
        outOfCombatPanel: releaseContext.value?.outOfCombatPanel ?? {},
      },
      releaseModifiers,
      coreScalingRow: corePassiveScalingRow(agent.value, releaseContext.value?.coreSkillLevel),
      releaseSkillMultiplier: releaseSkillMultiplierFor(profile, event),
      event,
      eventElement: effect.element,
    })
    const conversionSource = releaseTraceNode(evaluated.trace, (trace: any) => trace.whiteBoxRole === "conversionSource")
    const stunnedCondition = releaseTraceNode(evaluated.trace, (trace: any) => trace.kind === "condition")
    const proficiencyYieldModifier = releaseTraceNode(
      evaluated.trace,
      (trace: any) => trace.kind === "releaseModifier" && trace.modifier === "releaseProficiencyYieldBonus",
    )
    return {
      ...evaluated,
      currentMultiplier: evaluated.finalBaseMultiplier * normalizeDamageScale(event),
      effectLabel: anomalyEffectLabel(effect.id, meta.value),
      triggerLabel: labelOf(agent.value),
      sourceLabel: isVelinaReleaseAgent(agent.value)
        ? labelOf(agent.value)
        : agentLabel(event?.anomalySource?.actorRef?.agentId),
      snapshot: event?.anomalySource?.snapshot ?? null,
      conversionSourceLabel: conversionSource?.label ?? "转换数据来源",
      conversionSourceValue: Number(conversionSource?.rawValue ?? conversionSource?.value ?? 0),
      conversionSourceUnit: conversionSource?.unit,
      hasStunnedRatio: Boolean(stunnedCondition),
      stunnedRatio: stunnedCondition ? Number(stunnedCondition.value ?? 1) : 1,
      hasProficiencyYieldModifier: Number(proficiencyYieldModifier?.modifierBonus ?? 0) !== 0,
      proficiencyYieldFactor: Number(proficiencyYieldModifier?.modifierFactor ?? 1),
    }
  } catch {
    return null
  }
}

function updateReleaseProfile(profileId: string) {
  const profile = anomalyReleaseProfile(agent.value, profileId, "", cinemaLevel.value ?? 0)
  if (!profile || !selectedEvent.value) return
  updateSelectedEvent({
    triggerActorRef: { agentId: String(agent.value?.id ?? ""), profileId: profile.id },
    releaseSkillRef: profile.releaseSkillRef ? { ...profile.releaseSkillRef } : undefined,
  }, { clearLabel: true })
}

function formatReleaseValue(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "-"
  return numeric.toLocaleString("zh-CN", { maximumFractionDigits: 6, useGrouping: false })
}

const ARIA_RELEASE_CORE_DESCRIPTION = "爱芮的第三段[普通攻击：绝对音准]重击命中处于以太异常状态、电属性异常状态、火属性异常状态、物理属性异常状态、冰属性异常状态的目标时，触发一次[异放]：额外结算一次属性异常伤害，相对于原属性异常伤害的比例为每10点初始异常掌控27.5%/14.3%/35.7%/2.5%/3.6%，当目标处于失衡状态下时，该伤害比例额外提升50%。"

const selectedReleaseBreakdown = computed(() => releaseBreakdown(selectedEvent.value))

function eventMultiplier(event: any) {
  const release = releaseBreakdown(event)
  if (release) return release.currentMultiplier
  const disorder = disorderBreakdown(event)
  if (disorder) return disorder.currentMultiplier
  if (event?.settlementType === "turbulence") return turbulencePreview(event)?.currentMultiplier ?? null
  return resolveDamageEventMultiplier(eventWithSkillSelection(event), meta.value)
}

function eventMultiplierText(event: any) {
  const multiplier = eventMultiplier(event)
  return multiplier === null ? "-" : formatPercent(multiplier, 3)
}

function skillGroupLabel(group: any) {
  return labelOf(group) || group?.id || "技能组"
}

function skillGroupEventCount(group: any) {
  return Array.isArray(group?.events) ? group.events.length : 0
}

function selectedSkillGroup(event: any = selectedEvent.value) {
  return skillGroupById(agent.value, event?.skillGroupId)
}

function skillGroupChildEvents(group: any = selectedSkillGroup()) {
  return Array.isArray(group?.events) ? group.events : []
}

function eventCount(event: any) {
  const count = Number(event?.count ?? 1)
  return Number.isFinite(count) ? count : 1
}

function eventStunLabel(event: any) {
  return event?.stunned === false ? "未失衡" : "失衡"
}

function eventStunValue(event: any) {
  return event?.stunned !== false
}

function critOptionsForEvent(event: any) {
  return event?.kind === "sharp" ? sharpCritModeOptions : critModeOptions
}

function anomalyCritPreviewEvent(event: any) {
  if (event?.kind !== "anomaly") return null
  const settlementType = event.settlementType ?? "attribute"
  if (!["attribute", "release", "turbulence"].includes(settlementType)) return null
  const effect = settlementType === "turbulence"
    ? turbulenceEffectFor(event)
    : releaseEffect(event)
  const releaseProf = settlementType === "release"
    ? anomalyReleaseProfile(agent.value, isVelinaRelease.value ? event.releaseSource : event.triggerActorRef?.profileId, effect?.element, cinemaLevel.value ?? 0)
    : undefined
  return {
    ...event,
    kind: "anomaly",
    settlementType,
    damageElement: effect?.element ?? damageElementForAgent(agent.value),
    stunned: eventStunValue(event),
    releaseProfile: releaseProf,
    releaseCoreScalingRow: settlementType === "release" ? corePassiveScalingRow(agent.value, releaseContext.value?.coreSkillLevel) : undefined,
    ...(settlementType === "release" ? {
      cinemaLevel: cinemaLevel.value ?? 0,
      releaseSkillMultiplier: releaseSkillMultiplierFor(releaseProf, event),
      releaseAnomalyCritDmgBonus: Number(releaseProf?.critDmgBonus ?? 0),
    } : {}),
  }
}

function anomalyCritState(event: any) {
  const preview = anomalyCritPreviewEvent(event)
  if (!preview) return null
  const modifiers = (combatEffects.value ?? []).flatMap((combatEffect: any) => combatEffect?.resolvedDamageModifiers ?? [])
  return resolveAnomalyCritForEvent(
    preview,
    { damageModifiers: modifiers },
    releaseContext.value?.inCombatPanel ?? {},
    releaseContext.value?.outOfCombatPanel ?? releaseContext.value?.inCombatPanel ?? {},
  )
}

function anomalyCritModeAvailable(event: any) {
  return Boolean(anomalyCritState(event)?.available)
}

function skillGroupChildTotalCount(childEvent: any, groupEvent: any = selectedEvent.value) {
  return eventCount(childEvent) * eventCount(groupEvent)
}

function skillGroupChildTitle(childEvent: any) {
  const displayEvent = eventWithSkillSelection(childEvent)
  return `${damageEventKindLabel(displayEvent)} · ${damageEventSubjectLabel(displayEvent, meta.value, skillCatalog.value)}`
}

function normalizeEventCountRange(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const min = Number.isFinite(Number(value.min)) ? Number(value.min) : 0
  const requestedMax = Number(value.max)
  const max = Number.isFinite(requestedMax) ? Math.max(min, requestedMax) : null
  const requestedDefault = Number(value.default)
  const fallbackDefault = Number.isFinite(requestedDefault) ? requestedDefault : min
  return {
    min,
    max,
    default: Math.max(min, max === null ? fallbackDefault : Math.min(max, fallbackDefault)),
  }
}

function normalizedCountForRange(value: unknown, range: any) {
  const numeric = Number(value)
  const fallback = range?.default ?? 1
  const count = Number.isFinite(numeric) ? numeric : fallback
  if (!range) return Math.max(0, count)
  return Math.max(range.min, range.max === null ? count : Math.min(range.max, count))
}

function selectedEventCountLimits(event: any = selectedEvent.value) {
  if (event?.kind !== "skillGroup") {
    const range = normalizeEventCountRange(selectedRow(event)?.eventCountRange)
    return range ? { min: range.min, max: range.max, step: 1 } : { min: 0, max: null, step: 1 }
  }
  return { ...skillGroupCountLimits(selectedSkillGroup(event) ?? {}), max: null }
}

function normalizeSkillGroupEvent(event: any, index = 0) {
  return normalizeSkillGroupReferenceEvent(event, agent.value, index)
}

function updateSelectedSkillGroup(groupId: string) {
  const normalized = normalizeSkillGroupEvent({
    ...selectedEvent.value,
    skillGroupId: groupId,
  })
  if (!normalized) return
  updateSelectedEvent({
    skillGroupId: normalized.skillGroupId,
    count: normalized.count,
  }, { clearLabel: true })
}

function selectEvent(eventId: string) {
  draft.value.selectedEventId = eventId
  commitInstant()
}

function isEventActive(event: any) {
  return selectedEvent.value?.id === event?.id
}

function skillRows(category: any, move: any) {
  return damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {})
}

function isDirectSkillEvent(event: any) {
  return event?.kind === "direct" || event?.kind === "sheer" || event?.kind === "sharp"
}

function firstCategoryWithDamageRows() {
  return skillCategories.value.find((category: any) => (category?.moves ?? [])
    .some((move: any) => skillRows(category, move).length))
}

function skillSelection(categoryId?: string, moveId?: string, rowId?: string) {
  const category = skillCategories.value.find((item: any) => item.id === categoryId)
    ?? firstCategoryWithDamageRows()
    ?? null
  const move = (category?.moves ?? []).find((item: any) => item.id === moveId && skillRows(category, item).length)
    ?? (category?.moves ?? []).find((item: any) => skillRows(category, item).length)
    ?? null
  const row = skillRows(category, move).find((item: any) => item.id === rowId)
    ?? skillRows(category, move)[0]
    ?? null
  if (!skillCatalog.value?.id || !category || !move || !row) return null
  const level = normalizeSkillLevel(
    category,
    move,
    row,
    skillLevels.value?.[category.id] ?? defaultSkillLevel(category, move, row),
  )
  const skillMultiplier = skillRowValue(category, move, row, level)
  if (!Number.isFinite(skillMultiplier)) return null
  const eventCountRange = normalizeEventCountRange(row.eventCountRange)
  return {
    category,
    move,
    row,
    skillMultiplier,
    skillRef: {
      agentSkillId: skillCatalog.value.id,
      categoryId: category.id,
      moveId: move.id,
      rowId: row.id,
      level,
    },
    eventCountRange,
  }
}

function selectedSkillSelection(event: any) {
  return skillSelection(event?.skillRef?.categoryId, event?.skillRef?.moveId, event?.skillRef?.rowId)
}

function stripLegacySharpFields(event: any) {
  if (event?.kind !== "sharp") return event
  const {
    sharpProfileId: _sharpProfileId,
    sharpComponent: _sharpComponent,
    maimTrigger: _maimTrigger,
    sharpScenario: _sharpScenario,
    ...cleanEvent
  } = event
  return cleanEvent
}

function eventWithSkillSelection(event: any) {
  if (!isDirectSkillEvent(event)) return stripLegacySharpFields(event)
  const selection = selectedSkillSelection(event)
  if (!selection) return stripLegacySharpFields(event)
  return stripLegacySharpFields({
    ...event,
    skillMultiplier: selection.skillMultiplier,
    skillRef: selection.skillRef,
    ...(selection.eventCountRange
      ? { count: normalizedCountForRange(event?.count, selection.eventCountRange) }
      : {}),
  })
}

function normalizeDraftSkillSelections() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => eventWithSkillSelection(event))
}

function disorderElapsedStep(event: any) {
  return disorderElapsedStepSeconds(event, meta.value)
}

function disorderElapsedPrecision(event: any) {
  return Number.isInteger(disorderElapsedStep(event)) ? 0 : 1
}

function selectedDisorderEffect(event: any) {
  const effectId = selectedDisorderEffectId(event)
  return (meta.value?.disorderEffects ?? []).find((effect: any) => String(effect?.id ?? "") === effectId) ?? null
}

function disorderPreviewEvent(event: any, effect: any) {
  return {
    ...event,
    kind: "anomaly",
    settlementType: "disorder",
    anomalyEffect: effect?.id ?? event?.anomalyEffect,
    previousAnomalyEffect: undefined,
    damageElement: effect?.element ?? event?.damageElement,
  }
}

function matchingDisorderModifiers(event: any, effect: any, kind: string) {
  const previewEvent = disorderPreviewEvent(event, effect)
  return (combatEffects.value ?? []).flatMap((combatEffect: any) => {
    const sourceLabel = labelOf(combatEffect) || combatEffect?.conditionLabel || combatEffect?.key || "局内 Buff"
    return (combatEffect?.resolvedDamageModifiers ?? [])
      .filter((modifier: any) => modifier?.kind === kind && damageModifierAppliesTo(modifier, previewEvent))
      .map((modifier: any) => ({
        sourceLabel,
        value: Number(modifier?.value ?? 0),
      }))
  }).filter((modifier: any) => Number.isFinite(modifier.value) && Math.abs(modifier.value) > 1e-9)
}

function aggregateModifierSources(modifiers: Array<{ sourceLabel: string, value: number }>) {
  const totals = new Map<string, number>()
  for (const modifier of modifiers) {
    totals.set(modifier.sourceLabel, (totals.get(modifier.sourceLabel) ?? 0) + modifier.value)
  }
  return [...totals].map(([sourceLabel, value]) => ({ sourceLabel, value }))
}

function disorderEffectShortLabel(effect: any) {
  return disorderEffectLabel(effect?.id, meta.value).replace(/紊乱(?:（.*）)?$/, "") || "异常"
}

function disorderBreakdown(event: any) {
  if (!event || (event.kind !== "disorder" && event.settlementType !== "disorder")) return null
  const effect = selectedDisorderEffect(event)
  if (!effect) return null

  const durationModifiers = matchingDisorderModifiers(event, effect, "anomalyDurationBonusSeconds")
  const baseMultiplierModifiers = matchingDisorderModifiers(event, effect, "disorderBaseMultiplierBonus")
  const durationBonus = Math.max(0, durationModifiers.reduce((total: number, modifier: any) => total + modifier.value, 0))
  const baseMultiplierBonus = baseMultiplierModifiers.reduce((total: number, modifier: any) => total + modifier.value, 0)
  const base = disorderBaseMultiplier(effect, event.elapsedSeconds, durationBonus)
  const fixedMultiplier = Math.max(0, Number(effect.fixedMultiplier ?? 4.5))
  const tickMultiplier = Math.max(0, Number(effect.tickMultiplier ?? 0))
  const typeScale = disorderMultiplierScale(event.disorderType)
  const damageScale = normalizeDamageScale(event)
  const effectiveBaseMultiplier = Math.max(0, base.baseMultiplier + baseMultiplierBonus)
  const typeAdjustedMultiplier = effectiveBaseMultiplier * typeScale
  const durationSources = aggregateModifierSources(durationModifiers)
  const baseMultiplierSources = aggregateModifierSources(baseMultiplierModifiers)
  const effectLabel = disorderEffectShortLabel(effect)

  return {
    ...base,
    fixedMultiplier,
    tickMultiplier,
    typeScale,
    damageScale,
    baseMultiplierBonus,
    effectiveBaseMultiplier,
    typeAdjustedMultiplier,
    currentMultiplier: typeAdjustedMultiplier * damageScale,
    durationSources,
    baseMultiplierSources,
    modifierNotes: [
      ...durationSources.map(source => `${source.sourceLabel}：${effectLabel}持续时间 ${source.value >= 0 ? "+" : ""}${formatDisorderSeconds(source.value)} 秒（${formatDisorderSeconds(base.baseDuration)} → ${formatDisorderSeconds(base.duration)} 秒）`),
      ...baseMultiplierSources.map(source => `${source.sourceLabel}：紊乱倍率 ${source.value >= 0 ? "+" : ""}${formatDisorderMultiplier(source.value)}`),
    ],
    hasBaseMultiplierBonus: Math.abs(baseMultiplierBonus) > 1e-9,
    hasTypeScale: Math.abs(typeScale - 1) > 1e-9,
    hasDamageScale: Math.abs(damageScale - 1) > 1e-9,
  }
}

const selectedDisorderBreakdown = computed(() => disorderBreakdown(selectedEvent.value))
const selectedTurbulenceBreakdown = computed(() => selectedEvent.value?.settlementType === "turbulence"
  ? turbulencePreview(selectedEvent.value)
  : null)

function formatDisorderSeconds(value: unknown) {
  return Number(value).toFixed(1)
}

function formatDisorderMultiplier(value: unknown) {
  return formatPercent(value, 3)
}

function disorderTickFormula(breakdown: any) {
  const remaining = formatDisorderSeconds(breakdown.remaining)
  if (Math.abs(breakdown.tickIntervalSeconds - 1) < 1e-9) {
    return `floor(T) = floor(${remaining}) = ${breakdown.tickCount} 段`
  }
  const interval = formatDisorderSeconds(breakdown.tickIntervalSeconds)
  return `floor(T / ${interval}) = floor(${remaining} / ${interval}) = ${breakdown.tickCount} 段`
}

function normalizeEventElapsedSeconds(event: any) {
  if (event?.kind !== "disorder" && event?.settlementType !== "disorder"
    && event?.settlementType !== "turbulence") return event
  if (event?.settlementType === "turbulence" && !turbulenceEffectFor(event)) return event
  const step = event?.settlementType === "turbulence"
    ? turbulenceElapsedStep(event)
    : disorderElapsedStep(event)
  return {
    ...event,
    elapsedSeconds: normalizeElapsedSeconds(event.elapsedSeconds, Number.POSITIVE_INFINITY, step),
  }
}

function normalizeDraftElapsedSeconds() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => normalizeEventElapsedSeconds(event))
}

function normalizeDraftStunned() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => ({
    ...event,
    stunned: eventStunValue(event),
  }))
}

function selectedCategory(event: any) { return selectedSkillSelection(event)?.category ?? null }
function selectedMove(event: any) { return selectedSkillSelection(event)?.move ?? null }
function selectedRow(event: any) { return selectedSkillSelection(event)?.row ?? null }
function selectedCategoryId(event: any) { return selectedCategory(event)?.id ?? null }
function selectedMoveId(event: any) { return selectedMove(event)?.id ?? null }
function selectedRowId(event: any) { return selectedRow(event)?.id ?? null }

function optionLabel(options: Array<{ label: string, value: string }>, value: unknown, fallback = "未配置") {
  const option = options.find(item => String(item.value) === String(value ?? ""))
  return option?.label || fallback
}

function selectedSkillCategoryLabel(event: any) {
  const category = selectedCategory(event)
  return category ? skillCategoryLabel(category.id, category) : "未配置"
}
function selectedSkillMoveLabel(event: any) { return labelOf(selectedMove(event)) || "未配置" }
function selectedSkillRowLabel(event: any) {
  const row = selectedRow(event)
  return row ? skillRowLabel(row) : "未配置"
}
function selectedSkillGroupLabel(event: any) { return skillGroupLabel(selectedSkillGroup(event)) }

function moveOptions(event: any) {
  const category = selectedCategory(event)
  return (category?.moves ?? []).map((move: any) => ({
    label: labelOf(move),
    value: move.id,
  }))
}

function rowOptions(event: any) {
  const category = selectedCategory(event)
  const move = selectedMove(event)
  return skillRows(category, move).map((row: any) => ({
    label: skillRowLabel(row),
    value: row.id,
  }))
}

function selectedSkillSummary(event: any) {
  const displayEvent = eventWithSkillSelection(event)
  return damageSkillRefPathLabel(displayEvent?.skillRef, meta.value, skillCatalog.value)
    || (Number.isFinite(Number(displayEvent?.skillMultiplier)) ? `手填倍率 ${Number(displayEvent.skillMultiplier)}%` : "未选择技能倍率")
}

function selectedAnomalyEffectId(event: any) { return String(event?.anomalyEffect ?? "") }
function selectedDisorderEffectId(event: any) { return String(event?.anomalyEffect ?? event?.previousAnomalyEffect ?? "") }
function selectedTurbulenceEffectId(event: any) { return String(event?.anomalyEffect ?? "") }

function turbulenceEffectFor(event: any) {
  const id = selectedTurbulenceEffectId(event)
  return turbulenceEffects.value.find((effect: any) => String(effect?.sourceAnomalyEffect ?? effect?.id ?? "") === id)
    ?? turbulenceEffects.value.find((effect: any) => String(effect?.id ?? "") === id)
    ?? null
}

function turbulenceElapsedStep(event: any) {
  return turbulenceElapsedStepSeconds(event, { turbulenceEffects: turbulenceEffects.value })
}

function turbulenceElapsedPrecision(event: any) {
  const step = turbulenceElapsedStep(event)
  const normalized = Number(step).toFixed(10).replace(/0+$/, "")
  const decimalIndex = normalized.indexOf(".")
  return decimalIndex < 0 ? 0 : normalized.length - decimalIndex - 1
}

function turbulencePreview(event: any) {
  const effect = turbulenceEffectFor(event)
  if (!effect) return null
  const modifiers = (combatEffects.value ?? []).flatMap((combatEffect: any) => combatEffect?.resolvedDamageModifiers ?? [])
    .filter((modifier: any) => damageModifierAppliesTo(modifier, { ...event, damageElement: effect.element }))
  const durationBonus = modifiers
    .filter((modifier: any) => modifier?.kind === "anomalyDurationBonusSeconds")
    .reduce((total: number, modifier: any) => total + Number(modifier?.value ?? 0), 0)
  const baseMultiplierBonus = modifiers
    .filter((modifier: any) => modifier?.kind === "turbulenceBaseMultiplierBonus")
    .reduce((total: number, modifier: any) => total + Number(modifier?.value ?? 0), 0)
  const timing = turbulenceBaseMultiplier(effect, event?.elapsedSeconds, durationBonus)
  return {
    ...timing,
    fixedMultiplier: Number(effect.fixedMultiplier),
    tickMultiplier: Number(effect.tickMultiplier),
    damageScale: normalizeDamageScale(event),
    baseMultiplierBonus,
    currentMultiplier: Math.max(0, timing.baseMultiplier + baseMultiplierBonus) * normalizeDamageScale(event),
  }
}

function turbulencePreviewText(event: any) {
  const preview = turbulencePreview(event)
  return preview ? formatPercent(preview.currentMultiplier, 3) : "-"
}

const ATTRIBUTE_EFFECT_BY_ELEMENT: Record<string, string> = {
  physical: "assault",
  fire: "burn",
  ice: "shatter",
  electric: "shock",
  ether: "corruption",
  wind: "wind_corrosion",
}

const DISORDER_EFFECT_BY_ELEMENT: Record<string, string> = {
  physical: "flinch",
  fire: "burn",
  ice: "frozen",
  electric: "shock",
  ether: "corruption",
}

function effectOptionsForSettlement(settlementType: string) {
  if (settlementType === "disorder") return disorderOptions.value
  if (settlementType === "turbulence") return turbulenceOptions.value
  return anomalyOptions.value
}

function isKnownEffect(settlementType: string, effectId: string) {
  const options = effectOptionsForSettlement(settlementType)
  if (settlementType === "turbulence") return Boolean(effectId) && options.some((option: { value: string }) => option.value === effectId)
  return !effectId || !options.length || options.some((option: { value: string }) => String(option.value) === effectId)
}

function defaultAgentEffectId(settlementType: string) {
  if (settlementType === "turbulence") return defaultTurbulenceEffectId(agent.value)
  const options = effectOptionsForSettlement(settlementType)
  const element = damageElementForAgent(agent.value)
  const fallback = settlementType === "disorder" ? "burn" : "assault"
  const preferred = settlementType === "disorder" && agent.value?.attribute === "frost"
    ? "frost_frozen"
    : settlementType === "disorder"
      ? DISORDER_EFFECT_BY_ELEMENT[element] ?? fallback
      : ATTRIBUTE_EFFECT_BY_ELEMENT[element] ?? fallback
  return options.some((option: { value: string }) => String(option.value) === preferred)
    ? preferred
    : options[0]?.value ?? fallback
}

function luminescenceFieldsToClear() {
  return {
    teammateAttack: undefined,
    luminescenceDamageSharePct: undefined,
    referenceAnomalyProficiency: undefined,
    referenceLuminescenceDamageMultiplier: undefined,
    moveRef: undefined,
    anomalyAgentCount: undefined,
    additionalAbilityActive: undefined,
    records: undefined,
    specialRecordBaseStrength: undefined,
    m4MultiplierMode: undefined,
    resistanceMode: undefined,
    skillLevel: undefined,
    coreSkillLevel: undefined,
    cinemaLevel: undefined,
    danInitialAtk: undefined,
    danAnomalyProficiency: undefined,
  }
}

function normalizeLuminescenceDraftEvent(event: any) {
  const parameters = resolveLuminescenceParameters(event)
  return {
    id: event?.id,
    kind: "anomaly",
    settlementType: "luminescence",
    triggerActorRef: { agentId: String(agent.value?.id ?? event?.triggerActorRef?.agentId ?? "") },
    teammateAttack: parameters.teammateAttack,
    luminescenceDamageSharePct: parameters.luminescenceDamageSharePct,
  }
}

function normalizeDraftAnomalyEffects() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => {
    event = cleanStoredReactiveEvent(event, agent.value)
    if (!event) return null
    if (event?.kind !== "anomaly" && event?.kind !== "disorder") return event
    if (isLuminescenceSettlement(event)) return normalizeLuminescenceDraftEvent(event)
    const release = isReleaseSettlement(event)
    const settlementType = release
      ? "release"
      : event.settlementType === "turbulence"
        ? "turbulence"
        : event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
    if (isWindAgent.value && (settlementType === "turbulence" || settlementType === "disorder")) return null
    const effectId = settlementType === "disorder" ? selectedDisorderEffectId(event) : selectedAnomalyEffectId(event)
    const normalized: any = {
      ...event,
      settlementType,
      anomalyEffect: effectId && isKnownEffect(settlementType, effectId) ? effectId : defaultAgentEffectId(settlementType),
    }
    delete normalized.previousAnomalyEffect
    if (settlementType === "turbulence") {
      return cleanStoredReactiveEvent(normalizeTurbulenceEditorEvent(event, agent.value, meta.value), agent.value)
    }
    if (release) {
      return normalizeAnomalyReleaseEventForAgent(normalized, agent.value, { cinemaLevel: cinemaLevel.value ?? 0 })
    }
    return normalized
  }).filter(Boolean)
  if (!draft.value.events.some((event: any) => event.id === draft.value.selectedEventId)) {
    draft.value.selectedEventId = draft.value.events[0]?.id ?? null
  }
}

function withSelectedEffectOption(
  options: Array<{ label: string, value: string }>,
  selected: string,
  labelFor: (value: string, currentMeta?: any) => string = anomalyEffectLabel,
) {
  if (!selected || options.some(option => String(option.value) === selected)) return options
  return [...options, { label: labelFor(selected, meta.value), value: selected }]
}

function anomalyOptionsFor(event: any) { return withSelectedEffectOption(anomalyOptions.value, selectedAnomalyEffectId(event)) }
function disorderOptionsFor(event: any) { return withSelectedEffectOption(disorderOptions.value, selectedDisorderEffectId(event), disorderEffectLabel) }
function turbulenceOptionsFor(event: any) { return turbulenceSourceOptions(meta.value, selectedTurbulenceEffectValue(event)) }

function selectedAnomalyEffectValue(event: any) {
  const effectId = selectedAnomalyEffectId(event)
  return effectId && isKnownEffect("attribute", effectId) ? effectId : defaultAgentEffectId("attribute")
}
function selectedDisorderEffectValue(event: any) {
  const effectId = selectedDisorderEffectId(event)
  return effectId && isKnownEffect("disorder", effectId) ? effectId : defaultAgentEffectId("disorder")
}
function selectedAnomalyEffectLabel(event: any) {
  const value = selectedAnomalyEffectValue(event)
  return optionLabel(anomalyOptionsFor(event), value, anomalyEffectLabel(value, meta.value) || "未配置")
}
function selectedDisorderEffectLabel(event: any) {
  const value = selectedDisorderEffectValue(event)
  return optionLabel(disorderOptionsFor(event), value, disorderEffectLabel(value, meta.value) || "未配置")
}
function updateTurbulenceEffect(anomalyEffect: string) {
  updateSelectedEvent(normalizeTurbulenceEditorEvent({ ...selectedEvent.value, anomalyEffect }, agent.value, meta.value))
}
function selectedTurbulenceEffectValue(event: any) {
  return selectedTurbulenceEffectId(event) || defaultAgentEffectId("turbulence")
}
function selectedTurbulenceEffectLabel(event: any) {
  return turbulenceEffectLabel(selectedTurbulenceEffectValue(event), meta.value)
}
function isKnownDisorderEffect(effectId: string) { return isKnownEffect("disorder", effectId) }

const eventWarnings = computed(() => {
  const event = selectedEvent.value
  if (!event) return ["请选择一个事件"]
  const warnings: string[] = []
  if (!isLuminescenceSettlement(event) && (!Number.isFinite(Number(event.count)) || Number(event.count) <= 0)) {
    warnings.push("次数需要大于 0")
  }
  const countLimits = selectedEventCountLimits(event)
  if (Number.isFinite(Number(event.count))
    && (Number(event.count) < countLimits.min
      || (countLimits.max !== null && Number(event.count) > countLimits.max))) {
    warnings.push(`次数范围应为 ${countLimits.min}-${countLimits.max ?? "不限"}`)
  }
  if (event.kind === "skillGroup") {
    if (!event.skillGroupId) warnings.push("技能组事件需要选择技能组")
    else if (!selectedSkillGroup(event)) warnings.push("技能组不存在")
    return warnings
  }
  if (damageEventNeedsSkillMultiplier(event, meta.value, skillCatalog.value)) {
    warnings.push("技能伤害事件需要技能倍率")
  }
  if (isReleaseSettlement(event)) {
    if (!supportsRelease.value) warnings.push("当前角色暂不支持异放")
    if (isVelinaRelease.value) {
      if (!event.releaseSource) warnings.push("异放来源未配置")
      else if (!releaseProfiles.value.some((profile: any) => profile?.id === event.releaseSource)) warnings.push("异放来源不存在")
      if (event.anomalyEffect !== "wind_corrosion") warnings.push("维琳娜异放原异常必须是风化")
    } else {
      if (event.triggerActorRef?.agentId !== agent.value?.id) warnings.push("异放触发者必须是当前角色")
      if (!event.triggerActorRef?.profileId) warnings.push("异放倍率方案未配置")
      if (!event.anomalySource?.actorRef?.agentId) warnings.push("原异常施加者未配置")
    }
    if (releaseSnapshotError.value) warnings.push(releaseSnapshotError.value)
  }
  if (isLuminescenceSettlement(event)) {
    if (event.triggerActorRef?.agentId !== agent.value?.id) warnings.push("耀变触发者必须是当前角色")
    warnings.push(...resolveLuminescenceParameters(event).errors)
  }
  if (event.kind === "anomaly" && !["disorder", "turbulence"].includes(event.settlementType) && !isLuminescenceSettlement(event)) {
    if (!event.anomalyEffect) warnings.push("属性异常事件需要选择异常类型")
    else if (!isKnownEffect("attribute", selectedAnomalyEffectId(event))) warnings.push("属性异常事件需要选择有效的异常类型")
  }
  if (event.kind === "anomaly" && event.settlementType === "turbulence") {
    if (isWindAgent.value) warnings.push("风属性角色不能配置乱流事件")
    const warning = turbulenceConfigurationWarning(event, meta.value)
    if (warning) warnings.push(warning)
    if (!Number.isFinite(Number(event.elapsedSeconds)) || Number(event.elapsedSeconds) < 0) warnings.push("乱流已流逝时间无效")
  }
  const disorderEffectId = selectedDisorderEffectId(event)
  if ((event.kind === "disorder" || event.settlementType === "disorder") && !disorderEffectId) {
    warnings.push("紊乱事件需要选择原异常")
  } else if ((event.kind === "disorder" || event.settlementType === "disorder") && !isKnownDisorderEffect(disorderEffectId)) {
    warnings.push("紊乱事件需要选择有效的原异常")
  }
  return warnings
})

function commitInstant() {
  if (turbulenceWarnings.value.length > 0) return
  if (isLuminescenceSettlement(selectedEvent.value) && eventWarnings.value.length > 0) return

  if (draft.value.mode === "adminDefault") {
    const fallback = defaultDamageConfig(agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
    const draftLuminescenceEvents = (draft.value.events ?? [])
      .filter((event: any) => isLuminescenceSettlement(event))
    const nextEvents = JSON.parse(JSON.stringify(fallback.events ?? [])).map((event: any) => {
      if (isLuminescenceSettlement(event)) {
        const draftEvent = draftLuminescenceEvents.find((item: any) => item?.id === event?.id)
          ?? draftLuminescenceEvents[0]
          ?? event
        return normalizeLuminescenceDraftEvent(draftEvent)
      }
      return {
        ...event,
        stunned: eventStunValue(event),
      }
    })
    const activeId = nextEvents.some((ev: any) => ev.id === draft.value.selectedEventId)
      ? draft.value.selectedEventId
      : (fallback.selectedEventId ?? nextEvents[0]?.id)
    props.lab.saveCalculationConfigInstant({
      ...fallback,
      mode: "adminDefault",
      selectedEventId: activeId,
      events: nextEvents,
    })
    return
  }

  normalizeDraftSkillSelections()
  normalizeDraftStunned()
  normalizeDraftAnomalyEffects()
  normalizeDraftElapsedSeconds()
  const normalizedDraft = isDamageModeAllowedForAgent(
    draft.value.mode,
    agent.value,
    cinemaLevel.value ?? 0,
    potentialLevel.value ?? 0,
  )
    ? draft.value
    : normalizeDraftForAgent(draft.value)
  const { target: _target, targetConfig: _targetConfig, ...damageConfig } = normalizedDraft
  props.lab.saveCalculationConfigInstant(JSON.parse(JSON.stringify(damageConfig)))
}

function updateSelectedEvent(patch: any, options: { clearLabel?: boolean } = {}) {
  const current = selectedEvent.value
  if (!current) return
  if (isAdminDefaultMode.value && !isLuminescenceSettlement(current)) return
  draft.value.events = draft.value.events.map((event: any) => {
    if (event.id !== current.id) return event
    const merged = { ...event, ...patch }
    const next = isReleaseSettlement(merged)
      ? normalizeAnomalyReleaseEventForAgent(merged, agent.value, { cinemaLevel: cinemaLevel.value ?? 0 })
      : merged
    if (options.clearLabel) delete next.label
    for (const key of Object.keys(next)) {
      if (next[key] === undefined) delete next[key]
    }
    return next
  })
  commitInstant()
}

function updateSelectedEventCount(value: unknown) {
  const limits = selectedEventCountLimits()
  const count = Number(value)
  const normalized = Number.isFinite(count)
    ? Math.max(limits.min, limits.max === null ? count : Math.min(limits.max, count))
    : Math.max(limits.min, 1)
  updateSelectedEvent({ count: normalized })
}

function newEvent(kind: string) {
  const id = `${kind}-${Date.now().toString(36)}`
  if (kind === "skillGroup") {
    const event = defaultSkillGroupReferenceEvent(agent.value, skillGroups.value[0]?.id, (draft.value.events?.length ?? 0) + 1)
    return {
      ...(event ?? { kind: "skillGroup", skillGroupId: "", count: 1, stunned: true }),
      id,
    }
  }
  if (kind === "anomaly") {
    const releaseProfile = isVelinaRelease.value || !hasAdminDefaultCalculation(agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
      ? anomalyReleaseProfile(agent.value, "", damageElementForAgent(agent.value), cinemaLevel.value ?? 0)
      : null
    if (releaseProfile) {
      return normalizeAnomalyReleaseEventForAgent({
        id,
        kind,
        settlementType: "release",
        anomalyEffect: defaultAgentEffectId("release"),
        count: 1,
        stunned: true,
        triggerActorRef: { agentId: String(agent.value?.id ?? ""), profileId: releaseProfile.id },
        anomalySource: { actorRef: { agentId: String(agent.value?.id ?? "") } },
      }, agent.value, { cinemaLevel: cinemaLevel.value ?? 0 })
    }
    return { id, kind, settlementType: "attribute", anomalyEffect: defaultAgentEffectId("attribute"), procCount: 1, count: 1, stunned: true }
  }
  if (kind === "disorder") {
    return { id, kind: "anomaly", settlementType: "disorder", disorderType: "normal", anomalyEffect: defaultAgentEffectId("disorder"), elapsedSeconds: 0, count: 1, stunned: true }
  }
  if (kind === "turbulence") {
    return {
      id,
      kind: "anomaly",
      settlementType: "turbulence",
      anomalyEffect: defaultAgentEffectId("turbulence"),
      elapsedSeconds: 0,
      count: 1,
      stunned: true,
    }
  }
  const selection = skillSelection()
  return {
    id,
    kind,
    ...(selection ? { skillRef: selection.skillRef } : {}),
    skillMultiplier: selection?.skillMultiplier ?? 100,
    critMode: "expected",
    count: 1,
    stunned: true,
  }
}

function addEvent(kind: string) {
  if (isWindAgent.value && ["disorder", "turbulence"].includes(kind)) return
  if (!canEditEventStructure.value) return
  if (kind === "sheer" && !canUseSheerDamage.value) return
  if (kind === "sharp" && !canUseSharpDamage.value) return
  if (kind === "skillGroup" && !hasSkillGroups.value) return
  const event = newEvent(kind)
  draft.value.events = [...(draft.value.events ?? []), event]
  draft.value.selectedEventId = event.id
  draft.value.mode = "custom"
  commitInstant()
}

function duplicateEvent(eventId = selectedEvent.value?.id) {
  if (!canEditEventStructure.value) return
  const current = (draft.value.events ?? []).find((event: any) => event.id === eventId) ?? selectedEvent.value
  if (!current) return
  const event = { ...JSON.parse(JSON.stringify(current)), id: `${current.id}-copy-${Date.now().toString(36)}` }
  const index = (draft.value.events ?? []).findIndex((item: any) => item.id === current.id)
  const events = [...(draft.value.events ?? [])]
  events.splice(index >= 0 ? index + 1 : events.length, 0, event)
  draft.value.events = events
  draft.value.selectedEventId = event.id
  draft.value.mode = "custom"
  commitInstant()
}

function removeEvent(eventId = selectedEvent.value?.id) {
  if (!canEditEventStructure.value) return
  const current = (draft.value.events ?? []).find((event: any) => event.id === eventId) ?? selectedEvent.value
  if (!current) return
  const currentIndex = (draft.value.events ?? []).findIndex((event: any) => event.id === current.id)
  const events = draft.value.events.filter((event: any) => event.id !== current.id)
  const fallbackKind = canUseSharpDamage.value ? "sharp" : canUseSheerDamage.value ? "sheer" : "direct"
  draft.value.events = events.length ? events : [newEvent(fallbackKind)]
  const nextIndex = Math.max(0, Math.min(currentIndex, draft.value.events.length - 1))
  draft.value.selectedEventId = draft.value.events[nextIndex]?.id
  draft.value.mode = "custom"
  commitInstant()
}

function applyMode(mode: string) {
  const nextMode = normalizeDamageModeForAgent(mode, agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
  draft.value.mode = nextMode
  if (nextMode === "single") {
    draft.value.events = [newEvent("direct")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "sheer") {
    draft.value.events = [newEvent("sheer")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "sharp") {
    draft.value.events = [newEvent("sharp")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "anomaly") {
    draft.value.events = [newEvent("anomaly")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "adminDefault") {
    const fallback = defaultDamageConfig(agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
    draft.value.events = JSON.parse(JSON.stringify(fallback.events ?? [newEvent("direct")]))
    draft.value.selectedEventId = fallback.selectedEventId ?? draft.value.events[0]?.id
    draft.value.skillLevelsByCategory = JSON.parse(JSON.stringify(fallback.skillLevelsByCategory ?? {}))
  }
  commitInstant()
}

function applySkill(value: any) {
  const countRange = normalizeEventCountRange(value.eventCountRange)
  updateSelectedEvent({
    skillMultiplier: value.skillMultiplier,
    skillRef: value.skillRef,
    ...(countRange ? { count: countRange.default } : {}),
  }, { clearLabel: true })
}

function updateSkillRef(categoryId: string, moveId?: string, rowId?: string) {
  const selection = skillSelection(categoryId, moveId, rowId)
  if (!selection) return
  updateSelectedEvent({
    skillMultiplier: selection.skillMultiplier,
    skillRef: selection.skillRef,
    ...(selection.eventCountRange ? { count: selection.eventCountRange.default } : {}),
  }, { clearLabel: true })
}

function updateSkillCategory(categoryId: string) { updateSkillRef(categoryId) }
function updateSkillMove(moveId: string) { updateSkillRef(selectedCategoryId(selectedEvent.value) ?? "", moveId) }
function updateSkillRow(rowId: string) { updateSkillRef(selectedCategoryId(selectedEvent.value) ?? "", selectedMoveId(selectedEvent.value) ?? "", rowId) }

function updateAnomalySettlementType(value: string) {
  releaseSnapshotError.value = ""
  if (isWindAgent.value && ["disorder", "turbulence"].includes(value)) return
  if (value === "disorder") {
    const effectId = defaultAgentEffectId("disorder")
    const nextEvent = { ...selectedEvent.value, anomalyEffect: effectId, settlementType: "disorder" }
    updateSelectedEvent({
      ...luminescenceFieldsToClear(),
      settlementType: "disorder",
      anomalyEffect: effectId,
      previousAnomalyEffect: undefined,
      disorderType: selectedEvent.value?.disorderType ?? "normal",
      elapsedSeconds: normalizeElapsedSeconds(selectedEvent.value?.elapsedSeconds, Number.POSITIVE_INFINITY, disorderElapsedStep(nextEvent)),
      procCount: undefined,
      releaseSource: undefined,
      triggerActorRef: undefined,
      anomalySource: undefined,
      windSource: undefined,
      secondaryAnomalyEffect: undefined,
      secondAnomalyEffect: undefined,
      secondaryAnomalyRemainingSeconds: undefined,
      turbulenceEffect: undefined,
      turbulenceVariant: undefined,
      turbulenceMultiplierStatus: undefined,
    }, { clearLabel: true })
    return
  }
  if (value === "turbulence") {
    if (selectedEvent.value?.settlementType === "turbulence") return
    const anomalyEffect = defaultAgentEffectId("turbulence")
    const nextEvent = { ...selectedEvent.value, anomalyEffect }
    updateSelectedEvent({
      ...luminescenceFieldsToClear(),
      kind: "anomaly",
      settlementType: "turbulence",
      anomalyEffect,
      anomalyVariant: undefined,
      elapsedSeconds: normalizeElapsedSeconds(
        selectedEvent.value?.elapsedSeconds,
        Number.POSITIVE_INFINITY,
        turbulenceElapsedStep(nextEvent),
      ),
      procCount: undefined,
      releaseSource: undefined,
      triggerActorRef: undefined,
      disorderType: undefined,
      previousAnomalyEffect: undefined,
      windSource: undefined,
      anomalySource: undefined,
      secondaryAnomalyEffect: undefined,
      secondAnomalyEffect: undefined,
      secondaryAnomalyRemainingSeconds: undefined,
      turbulenceEffect: undefined,
      turbulenceVariant: undefined,
      turbulenceMultiplierStatus: undefined,
    }, { clearLabel: true })
    return
  }
  if (value === "release") {
    if (!supportsRelease.value) return
    const profile = anomalyReleaseProfile(agent.value, "", damageElementForAgent(agent.value), cinemaLevel.value ?? 0) ?? releaseProfiles.value[0]
    const releaseEvent = normalizeAnomalyReleaseEventForAgent({
      ...selectedEvent.value,
      settlementType: "release",
      anomalyEffect: defaultAgentEffectId("release"),
      ...(isVelinaRelease.value ? { releaseSource: "broad_vortex" } : {}),
      triggerActorRef: { agentId: String(agent.value?.id ?? ""), profileId: String(profile?.id ?? "") },
      anomalySource: { actorRef: { agentId: String(agent.value?.id ?? "") } },
    }, agent.value, { cinemaLevel: cinemaLevel.value ?? 0 })
    updateSelectedEvent({ ...releaseEvent, ...luminescenceFieldsToClear() }, { clearLabel: true })
    return
  }
  if (value === "luminescence") {
    if (!supportsLuminescence.value) return
    const targetId = selectedEvent.value?.id
    draft.value.events = (draft.value.events ?? []).filter((event: any) => event.id === targetId)
    updateSelectedEvent({
      ...luminescenceFieldsToClear(),
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: String(agent.value?.id ?? "") },
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
      anomalyEffect: undefined,
      anomalyVariant: undefined,
      previousAnomalyEffect: undefined,
      disorderType: undefined,
      elapsedSeconds: undefined,
      procCount: undefined,
      anomalySource: undefined,
    }, { clearLabel: true })
    return
  }
  updateSelectedEvent({
    ...luminescenceFieldsToClear(),
    settlementType: "attribute",
    anomalyEffect: defaultAgentEffectId("attribute"),
    previousAnomalyEffect: undefined,
    disorderType: undefined,
    elapsedSeconds: undefined,
    procCount: selectedEvent.value?.procCount ?? 1,
    anomalyVariant: selectedEvent.value?.anomalyVariant === "polarizedAssault" ? "polarizedAssault" : "normal",
    releaseSource: undefined,
    triggerActorRef: undefined,
    anomalySource: undefined,
    windSource: undefined,
    secondaryAnomalyEffect: undefined,
    secondAnomalyEffect: undefined,
    secondaryAnomalyRemainingSeconds: undefined,
    turbulenceEffect: undefined,
    turbulenceVariant: undefined,
    turbulenceMultiplierStatus: undefined,
  }, { clearLabel: true })
}

function updateReleaseSourceAgent(nextAgentId: string) {
  if (releaseSourceLocked.value) return
  const currentAgentId = String(agent.value?.id ?? "")
  if (nextAgentId === currentAgentId) {
    releaseSnapshotError.value = ""
    updateSelectedEvent({ anomalySource: { actorRef: { agentId: nextAgentId } } })
    return
  }
  const snapshot = props.lab.anomalySourceSnapshotForAgent(nextAgentId)
  if (!snapshot || snapshot.agentId !== nextAgentId) {
    releaseSnapshotError.value = "该角色暂无已保存的异常快照，请先使用该角色完成一次计算。"
    return
  }
  releaseSnapshotError.value = ""
  updateSelectedEvent({ anomalySource: { actorRef: { agentId: nextAgentId }, snapshot: JSON.parse(JSON.stringify(snapshot)) } })
}

function refreshReleaseSourceSnapshot() {
  const targetAgentId = String(selectedEvent.value?.anomalySource?.actorRef?.agentId ?? "")
  if (targetAgentId) updateReleaseSourceAgent(targetAgentId)
}

function releaseSnapshotTime(snapshot: any) {
  if (!snapshot?.capturedAt) return "当前面板实时读取"
  const date = new Date(snapshot.capturedAt)
  return Number.isNaN(date.getTime()) ? "已冻结" : date.toLocaleString("zh-CN", { hour12: false })
}

function updateDisorderEffect(effectId: string) {
  const nextEvent = { ...selectedEvent.value, anomalyEffect: effectId }
  updateSelectedEvent({
    anomalyEffect: effectId,
    previousAnomalyEffect: undefined,
    elapsedSeconds: normalizeElapsedSeconds(selectedEvent.value?.elapsedSeconds, Number.POSITIVE_INFINITY, disorderElapsedStep(nextEvent)),
  }, { clearLabel: true })
}

function updateElapsedSeconds(value: unknown) {
  updateSelectedEvent({
    elapsedSeconds: normalizeElapsedSeconds(value, Number.POSITIVE_INFINITY, disorderElapsedStep(selectedEvent.value)),
  })
}

function hydrateFromStore() {
  if (!agent.value) return
  releaseSnapshotError.value = ""
  const { target: _target, targetConfig: _targetConfig, ...damageConfig } = props.lab.buildStore.damageConfig ?? {}
  const fallback = defaultDamageConfig(agent.value, cinemaLevel.value ?? 0, potentialLevel.value ?? 0)
  const shouldUseFallbackEvents = damageConfig?.mode === "adminDefault"
    && Array.isArray(fallback.events)
    && fallback.events.length > 0
  const savedLuminescenceEvents = (damageConfig?.events ?? [])
    .filter((event: any) => isLuminescenceSettlement(event))
  const fallbackEvents = shouldUseFallbackEvents
    ? fallback.events.map((event: any) => {
        if (!isLuminescenceSettlement(event)) return event
        const saved = savedLuminescenceEvents.find((item: any) => item?.id === event?.id)
          ?? savedLuminescenceEvents[0]
        if (!saved) return event
        const parameters = resolveLuminescenceParameters(saved)
        return {
          ...event,
          teammateAttack: parameters.teammateAttack,
          luminescenceDamageSharePct: parameters.luminescenceDamageSharePct,
        }
      })
    : fallback.events
  draft.value = JSON.parse(JSON.stringify(normalizeDraftForAgent({
    ...fallback,
    ...damageConfig,
    ...(shouldUseFallbackEvents ? {
      selectedEventId: damageConfig.selectedEventId && fallbackEvents.some((ev: any) => ev.id === damageConfig.selectedEventId)
        ? damageConfig.selectedEventId
        : (fallback.selectedEventId ?? fallback.events[0]?.id),
      events: fallbackEvents,
    } : {}),
  })))
  normalizeDraftAnomalyEffects()
  normalizeDraftElapsedSeconds()
  normalizeDraftSkillSelections()
  normalizeDraftStunned()
}

watch(
  () => [props.lab.buildStore.agentId, cinemaLevel.value, potentialLevel.value, props.lab.loading.value],
  ([nextAgentId, , , isLoading]) => {
    if (!isLoading && nextAgentId) hydrateFromStore()
  },
  { immediate: true },
)

watch(
  () => [skillCatalog.value, skillLevels.value],
  () => {
    if (!props.lab.loading.value && agent.value) {
      normalizeDraftSkillSelections()
    }
  },
  { deep: true },
)
</script>

<template>
  <section id="lab-chapter-combat" class="lab-chapter">
    <header class="lab-chapter-head">
      <div>
        <span class="lab-chapter-kicker">CH.03 · TARGET &amp; ROTATION EVENTS</span>
        <h2 class="lab-chapter-title">敌人环境与计算事件</h2>
        <p class="lab-chapter-desc">
          设定目标防御与抗性，并在下方直接管理计算模式与循环事件；所有参数即时生效。
        </p>
      </div>
      <div class="lab-combat-head-meta">
        <span class="lab-combat-mode-pill">{{ headerModeBadge }}</span>
        <span class="lab-combat-count-pill lab-mono">{{ draft.events?.length ?? 0 }} EVENTS</span>
      </div>
    </header>

    <div class="lab-chapter-body lab-combat-body">
      <!-- Part 1: Original EnemyTargetConfigPanel in a compact horizontal strip -->
      <div class="lab-enemy-strip">
        <EnemyTargetConfigPanel
          :target-config="lab.buildStore.targetConfig"
          :meta="lab.catalogStore.meta"
          :damage-element="lab.selectedDamageElement.value"
          @update:target-config="lab.updateTargetConfigInstant"
        />
      </div>

      <!-- Part 2: Full CalculationConfigModal released inline (Master-Detail + Bounded Scrollbars) -->
      <div class="lab-calc-inline ui-layout-scope" data-layout-surface="calculation-config">
        <div class="calculation-grid ui-master-detail">
          <aside class="section-band lab-calc-master">
            <div class="metric">
              <span class="metric-title">计算方式</span>
              <div class="metric-value">
                <NSelect
                  size="small"
                  :value="draft.mode"
                  :options="calculationModeOptions"
                  aria-label="计算方式"
                  @update:value="applyMode(String($event))"
                />
              </div>
            </div>

            <div class="panel lab-event-list-panel">
              <div class="panel-header">
                <h3 class="panel-title">目标事件</h3>
                <NTag round size="small">{{ draft.events?.length ?? 0 }} 项</NTag>
              </div>
              <div class="panel-body section-band lab-event-list-body">
                <NScrollbar v-if="draft.events?.length" class="calculation-event-scrollbar" style="max-height: 310px">
                  <div class="calculation-event-list">
                    <article
                      v-for="(event, index) in draft.events"
                      :key="event.id"
                      class="calculation-event-list-item"
                      :class="{ active: isEventActive(event), readonly: !canEditEventStructure }"
                    >
                      <button type="button" class="calculation-event-select" @click="selectEvent(event.id)">
                        <span class="calculation-event-order lab-mono">#{{ index + 1 }}</span>
                        <span class="calculation-event-copy">
                          <strong>{{ eventListTitle(event) }}</strong>
                          <small v-if="isLuminescenceSettlement(event)">
                            队友初始攻击力 {{ Number(event.teammateAttack ?? 2800).toLocaleString('zh-CN') }} · 耀变占比 {{ Number(event.luminescenceDamageSharePct ?? 50).toLocaleString('zh-CN') }}%
                          </small>
                          <small v-else-if="event.kind === 'skillGroup'">
                            次数 ×{{ event.count ?? 1 }} · {{ eventStunLabel(event) }}
                            <template v-if="computedEventDamageById.has(String(event.id))">
                              · {{ formatNumber(Math.round(computedEventDamageById.get(String(event.id)) ?? 0)) }}
                            </template>
                          </small>
                          <small v-else>
                            倍率 {{ eventMultiplierText(event) }} · ×{{ event.count ?? 1 }} · {{ eventStunLabel(event) }}
                            <template v-if="computedEventDamageById.has(String(event.id))">
                              · {{ formatNumber(Math.round(computedEventDamageById.get(String(event.id)) ?? 0)) }}
                            </template>
                          </small>
                        </span>
                      </button>
                      <div v-if="canEditEventStructure" class="calculation-event-inline-actions">
                        <NButton
                          v-if="!isLuminescenceSettlement(event)"
                          circle
                          quaternary
                          size="tiny"
                          title="复制目标事件"
                          aria-label="复制目标事件"
                          @click="duplicateEvent(event.id)"
                        >
                          <template #icon><Copy :size="13" /></template>
                        </NButton>
                        <NButton
                          circle
                          quaternary
                          size="tiny"
                          type="error"
                          title="删除目标事件"
                          aria-label="删除目标事件"
                          @click="removeEvent(event.id)"
                        >
                          <template #icon><Trash2 :size="13" /></template>
                        </NButton>
                      </div>
                    </article>
                  </div>
                </NScrollbar>
                <div v-else class="calculation-event-empty">还没有目标事件</div>

                <div v-if="canEditEventStructure && !(draft.events ?? []).some(isLuminescenceSettlement)" class="toolbar calculation-add-toolbar">
                  <NButton class="calculation-add-button" size="small" @click="addEvent('direct')">+ 技能</NButton>
                  <NButton v-if="canUseSheerDamage" class="calculation-add-button" size="small" @click="addEvent('sheer')">+ 贯穿</NButton>
                  <NButton v-if="canUseSharpDamage" class="calculation-add-button" size="small" @click="addEvent('sharp')">+ 锐化</NButton>
                  <NButton class="calculation-add-button" size="small" @click="addEvent('anomaly')">+ 异常</NButton>
                  <NButton v-if="!isWindAgent" class="calculation-add-button" size="small" @click="addEvent('turbulence')">+ 乱流</NButton>
                  <NButton v-if="hasSkillGroups" class="calculation-add-button" size="small" @click="addEvent('skillGroup')">+ 技能组</NButton>
                </div>
              </div>
            </div>
          </aside>

          <section class="section-band calculation-editor-column">
            <div class="panel calculation-editor-panel">
              <div class="panel-header">
                <h3 class="panel-title">{{ eventTitle(selectedEvent) }}</h3>
                <div class="calculation-editor-status">
                  <NTag round size="small">{{ damageEventKindLabel(selectedEvent) }}</NTag>
                  <NTag v-if="isAdminDefaultMode" type="info" round size="small">
                    <span class="calculation-readonly-tag">
                      <Lock :size="12" />{{ isLuminescenceSettlement(selectedEvent) ? '固定评分模型' : '管理员配置 · 只读' }}
                    </span>
                  </NTag>
                </div>
              </div>

              <NScrollbar class="calculation-detail-scrollbar" style="max-height: 430px">
                <div class="panel-body section-band">
                  <div v-if="turbulenceWarnings.length" class="ui-notice lab-calc-warning-banner" role="alert">
                    {{ turbulenceWarnings.join(" ") }}
                  </div>

                  <div v-if="isVelinaRelease && ['anomaly', 'custom'].includes(draft.mode)" class="calculation-turbulence-note" data-testid="velina-turbulence-note">
                    {{ WIND_TURBULENCE_NOTICE }}
                  </div>

                  <div
                    v-if="selectedEvent?.kind === 'anomaly'"
                    class="calculation-settlement-selector"
                    data-testid="anomaly-settlement-selector"
                  >
                    <strong class="calculation-settlement-label">结算类型</strong>
                    <span v-if="isAdminDefaultMode" class="calculation-readonly-value calculation-settlement-readonly">
                      {{ optionLabel(anomalySettlementOptions, selectedEvent?.settlementType ?? 'attribute') }}
                    </span>
                    <NRadioGroup
                      v-else
                      size="small"
                      class="calculation-settlement-options"
                      :value="selectedEvent?.settlementType ?? 'attribute'"
                      aria-label="结算类型"
                    >
                      <NRadioButton
                        v-for="option in anomalySettlementOptions"
                        :key="option.value"
                        :value="option.value"
                        :label="option.label"
                        :disabled="option.disabled"
                        :title="option.title"
                        @click="updateAnomalySettlementType(option.value)"
                      />
                    </NRadioGroup>
                  </div>

                  <div
                    v-if="!isLuminescenceSettlement(selectedEvent)"
                    class="metric-grid calculation-editor-grid ui-field-grid"
                    :class="{ 'calculation-editor-grid--release': isReleaseSettlement(selectedEvent) }"
                    data-layout-surface="calculation-fields"
                  >
                    <div
                      class="metric calculation-editor-field ui-field"
                      :class="{ 'calculation-skill-group-count-field': selectedEvent?.kind === 'skillGroup' }"
                      data-layout-field
                    >
                      <span class="metric-title">次数</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value lab-mono">{{ eventCount(selectedEvent) }}</span>
                        <NInputNumber
                          v-else
                          size="small"
                          :value="selectedEvent?.count ?? 1"
                          :min="selectedEventCountLimits().min"
                          :max="selectedEventCountLimits().max ?? undefined"
                          :step="selectedEventCountLimits().step"
                          aria-label="事件次数"
                          @update:value="updateSelectedEventCount($event)"
                        />
                      </div>
                    </div>

                    <div class="metric calculation-editor-field ui-field" data-layout-field="event-stunned">
                      <span class="metric-title">是否失衡</span>
                      <div class="metric-value calculation-event-stun-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ eventStunValue(selectedEvent) ? '是' : '否' }}</span>
                        <NSwitch
                          v-else
                          size="small"
                          :value="eventStunValue(selectedEvent)"
                          data-testid="event-stunned-switch"
                          aria-label="是否失衡"
                          @update:value="updateSelectedEvent({ stunned: Boolean($event) })"
                        >
                          <template #checked>是</template>
                          <template #unchecked>否</template>
                        </NSwitch>
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind !== 'skillGroup'" class="metric calculation-editor-field ui-field" data-layout-field="event-multiplier">
                      <span class="metric-title">当前倍率</span>
                      <div class="metric-value">
                        <span class="calculation-readonly-value calculation-current-multiplier lab-mono">{{ eventMultiplierText(selectedEvent) }}</span>
                      </div>
                    </div>

                    <div
                      v-if="selectedEvent?.kind === 'skillGroup'"
                      class="metric calculation-editor-field ui-field ui-field--wide"
                      data-layout-field
                    >
                      <span class="metric-title">技能组</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillGroupLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedEvent?.skillGroupId" :options="skillGroupOptions" aria-label="技能组" @update:value="updateSelectedSkillGroup(String($event))" />
                      </div>
                    </div>

                    <div
                      v-if="selectedEvent?.kind === 'skillGroup'"
                      class="metric calculation-editor-field ui-field"
                      data-layout-field
                    >
                      <span class="metric-title">组内事件</span>
                      <div class="metric-value"><span class="calculation-readonly-value lab-mono">{{ skillGroupEventCount(selectedSkillGroup()) }} 项</span></div>
                    </div>

                    <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">技能大类</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillCategoryLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedCategoryId(selectedEvent)" :options="skillCategoryOptions" aria-label="技能大类" @update:value="updateSkillCategory(String($event))" />
                      </div>
                    </div>

                    <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field>
                      <span class="metric-title">招式</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillMoveLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedMoveId(selectedEvent)" :options="moveOptions(selectedEvent)" aria-label="招式" @update:value="updateSkillMove(String($event))" />
                      </div>
                    </div>

                    <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field>
                      <span class="metric-title">倍率行</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillRowLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedRowId(selectedEvent)" :options="rowOptions(selectedEvent)" aria-label="倍率行" @update:value="updateSkillRow(String($event))" />
                      </div>
                    </div>

                    <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind) && !skillCategoryOptions.length" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">技能倍率%</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value lab-mono">{{ Number(selectedEvent?.skillMultiplier ?? 100) }}%</span>
                        <NInputNumber v-else size="small" :value="selectedEvent?.skillMultiplier ?? 100" :min="0" :step="0.1" aria-label="技能倍率百分比" @update:value="updateSelectedEvent({ skillMultiplier: Number($event ?? 0) })" />
                      </div>
                    </div>

                    <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind) || anomalyCritModeAvailable(selectedEvent)" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">暴击模式</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(critOptionsForEvent(selectedEvent), selectedEvent?.critMode ?? 'expected') }}</span>
                        <NSelect
                          v-else
                          size="small"
                          :value="selectedEvent?.critMode ?? 'expected'"
                          :options="critOptionsForEvent(selectedEvent)"
                          aria-label="暴击模式"
                          @update:value="updateSelectedEvent({ critMode: $event })"
                        />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder' && selectedEvent?.settlementType !== 'turbulence' && !isLuminescenceSettlement(selectedEvent) && !(isReleaseSettlement(selectedEvent) && isVelinaRelease)" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field>
                      <span class="metric-title">{{ isReleaseSettlement(selectedEvent) ? '原异常' : '异常类型' }}</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode || (isReleaseSettlement(selectedEvent) && releaseSourceLocked)" class="calculation-readonly-value">{{ selectedAnomalyEffectLabel(selectedEvent) }}</span>
                        <NSelect
                          v-else
                          size="small"
                          :value="selectedAnomalyEffectValue(selectedEvent)"
                          :options="anomalyOptionsFor(selectedEvent)"
                          :aria-label="isReleaseSettlement(selectedEvent) ? '异放原异常' : '异常类型'"
                          @update:value="updateSelectedEvent({ anomalyEffect: $event, anomalyVariant: !isReleaseSettlement(selectedEvent) && $event === 'assault' ? (selectedEvent?.anomalyVariant ?? 'normal') : undefined }, { clearLabel: true })"
                        />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType === 'attribute'" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">触发次数</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value lab-mono">{{ Number(selectedEvent?.procCount ?? 1) }}</span>
                        <NInputNumber v-else size="small" :value="selectedEvent?.procCount ?? 1" :min="0" :step="1" aria-label="异常触发次数" @update:value="updateSelectedEvent({ procCount: Number($event ?? 1) })" />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType === 'attribute'" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">异常形态</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(anomalyVariantOptions, selectedEvent?.anomalyVariant ?? 'normal') }}</span>
                        <NSelect v-else size="small" :value="selectedEvent?.anomalyVariant ?? 'normal'" :options="anomalyVariantOptions" aria-label="异常形态" @update:value="updateSelectedEvent({ anomalyVariant: $event, procCount: selectedEvent?.procCount ?? 1 })" />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType === 'turbulence'" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field="turbulence-source">
                      <span class="metric-title">原异常</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedTurbulenceEffectLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedTurbulenceEffectValue(selectedEvent)" :options="turbulenceOptionsFor(selectedEvent)" aria-label="乱流原异常" @update:value="updateTurbulenceEffect(String($event))" />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType === 'turbulence'" class="metric calculation-editor-field ui-field" data-layout-field="turbulence-elapsed-seconds">
                      <span class="metric-title">已流逝时间</span>
                      <div class="metric-value">
                        <NInputNumber
                          v-if="!isAdminDefaultMode"
                          size="small"
                          :value="Number(selectedEvent?.elapsedSeconds ?? 0)"
                          :min="0"
                          :step="turbulenceElapsedStep(selectedEvent)"
                          :precision="turbulenceElapsedPrecision(selectedEvent)"
                          aria-label="乱流已流逝时间"
                          @update:value="updateSelectedEvent({ elapsedSeconds: normalizeElapsedSeconds($event, Number.POSITIVE_INFINITY, turbulenceElapsedStep(selectedEvent)) })"
                        />
                        <span v-else class="calculation-readonly-value lab-mono">{{ Number(selectedEvent?.elapsedSeconds ?? 0) }} 秒</span>
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType === 'turbulence'" class="metric calculation-editor-field ui-field" data-layout-field="turbulence-multiplier">
                      <span class="metric-title">当前乱流倍率</span>
                      <div class="metric-value"><span class="calculation-readonly-value lab-mono">{{ turbulencePreviewText(selectedEvent) }}</span></div>
                    </div>

                    <div v-if="isReleaseSettlement(selectedEvent) && !isVelinaRelease" class="metric calculation-editor-field ui-field" data-layout-field="release-trigger">
                      <span class="metric-title">异放触发者</span>
                      <div class="metric-value"><span class="calculation-readonly-value">{{ labelOf(agent) }}</span></div>
                    </div>

                    <div v-if="isReleaseSettlement(selectedEvent) && isVelinaRelease" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field="velina-release-source">
                      <span class="metric-title">异放来源</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(velinaReleaseSourceOptions, selectedEvent?.releaseSource ?? 'broad_vortex') }}</span>
                        <NSelect v-else size="small" :value="selectedEvent?.releaseSource ?? 'broad_vortex'" :options="velinaReleaseSourceOptions" aria-label="异放来源" @update:value="updateSelectedEvent({ releaseSource: String($event), anomalyEffect: 'wind_corrosion' }, { clearLabel: true })" />
                      </div>
                    </div>

                    <div v-if="isReleaseSettlement(selectedEvent) && !isVelinaRelease && !isFioniReleaseSourceLocked(agent)" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field="release-source">
                      <span class="metric-title">原异常施加者</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode || releaseSourceLocked" class="calculation-readonly-value release-source-readonly">
                          <strong>{{ agentLabel(selectedEvent?.anomalySource?.actorRef?.agentId) }}</strong>
                          <small v-if="releaseSourceLocked">当前面板实时读取</small>
                        </span>
                        <NSelect v-else size="small" :value="selectedEvent?.anomalySource?.actorRef?.agentId" :options="releaseSourceOptions" filterable aria-label="原异常施加者" @update:value="updateReleaseSourceAgent(String($event))" />
                      </div>
                    </div>

                    <div v-if="isReleaseSettlement(selectedEvent) && !isVelinaRelease && releaseProfiles.length > 1" class="metric calculation-editor-field ui-field ui-field--wide" :data-layout-field="isFioniReleaseSourceLocked(agent) ? 'fioni-release-profile' : 'release-profile'">
                      <span class="metric-title">{{ isFioniReleaseSourceLocked(agent) ? '异放来源' : '倍率方案' }}</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(releaseProfileOptions, selectedEvent?.triggerActorRef?.profileId ?? '') }}</span>
                        <NSelect v-else size="small" :value="selectedEvent?.triggerActorRef?.profileId" :options="releaseProfileOptions" :aria-label="isFioniReleaseSourceLocked(agent) ? '菲欧妮异放来源' : '异放倍率方案'" @update:value="updateReleaseProfile(String($event))" />
                      </div>
                    </div>

                    <div v-if="isReleaseSettlement(selectedEvent) && !isVelinaRelease && !releaseSourceReadOnly" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field="release-snapshot">
                      <span class="metric-title">来源快照</span>
                      <div class="metric-value release-snapshot-value">
                        <span class="calculation-readonly-value">{{ releaseSnapshotTime(selectedEvent?.anomalySource?.snapshot) }}</span>
                        <NButton v-if="!isAdminDefaultMode && selectedEvent?.anomalySource?.snapshot" quaternary circle size="small" title="刷新来源快照" aria-label="刷新来源快照" @click="refreshReleaseSourceSnapshot">
                          <template #icon><RefreshCcw :size="15" /></template>
                        </NButton>
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field ui-field ui-field--wide" data-layout-field>
                      <span class="metric-title">原异常</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedDisorderEffectLabel(selectedEvent) }}</span>
                        <NSelect v-else size="small" :value="selectedDisorderEffectValue(selectedEvent)" :options="disorderOptionsFor(selectedEvent)" aria-label="紊乱原异常" @update:value="updateDisorderEffect(String($event))" />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field ui-field" data-layout-field>
                      <span class="metric-title">紊乱类型</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(disorderTypeOptions, selectedEvent?.disorderType ?? 'normal') }}</span>
                        <NSelect v-else size="small" :value="selectedEvent?.disorderType ?? 'normal'" :options="disorderTypeOptions" aria-label="紊乱类型" @update:value="updateSelectedEvent({ disorderType: $event })" />
                      </div>
                    </div>

                    <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field ui-field" data-layout-field="elapsed-seconds">
                      <span class="metric-title">已流逝秒数</span>
                      <div class="metric-value">
                        <span v-if="isAdminDefaultMode" class="calculation-readonly-value lab-mono">{{ Number(selectedEvent?.elapsedSeconds ?? 0) }} 秒</span>
                        <NInputNumber v-else size="small" :key="`elapsed-${selectedDisorderEffectValue(selectedEvent)}`" :value="selectedEvent?.elapsedSeconds ?? 0" :min="0" :step="disorderElapsedStep(selectedEvent)" :precision="disorderElapsedPrecision(selectedEvent)" aria-label="异常已流逝秒数" @update:value="updateElapsedSeconds($event)" />
                      </div>
                    </div>
                  </div>

                  <LuminescenceEventEditor
                    v-if="isLuminescenceSettlement(selectedEvent)"
                    :event="selectedEvent"
                    :agent="agent"
                    :cinema-level="cinemaLevel ?? 0"
                    :core-skill-level="releaseContext?.coreSkillLevel ?? 'F'"
                    :in-combat-panel="releaseContext?.inCombatPanel"
                    :out-of-combat-panel="releaseContext?.outOfCombatPanel"
                    :luminescence-damage-multiplier="luminescencePreviewMultipliers.luminescenceDamageMultiplier"
                    :team-anomaly-damage-multiplier="luminescencePreviewMultipliers.teamAnomalyDamageMultiplier"
                    @update="updateSelectedEvent"
                  />

                  <div v-if="eventWarnings.length" class="chip-row">
                    <NTag v-for="warning in eventWarnings" :key="warning" type="warning" round size="small">{{ warning }}</NTag>
                  </div>

                  <section v-if="selectedDisorderBreakdown" class="disorder-explanation" aria-labelledby="lab-disorder-explanation-title">
                    <div class="disorder-explanation-head">
                      <Info :size="17" aria-hidden="true" />
                      <div>
                        <strong id="lab-disorder-explanation-title">紊乱倍率说明</strong>
                        <p>“已流逝秒数”指原异常生效后，到另一种异常触发紊乱前经过的时间。已流逝越久，剩余时间越短，可结算段数越少，紊乱倍率越低。</p>
                        <p>当前原异常按每 {{ formatDisorderSeconds(selectedDisorderBreakdown.tickIntervalSeconds) }} 秒结算一段；已流逝秒数会按该间隔就近取整。</p>
                      </div>
                    </div>
                    <dl class="disorder-explanation-metrics">
                      <div>
                        <dt>本次计算时长上限</dt>
                        <dd class="lab-mono">{{ formatDisorderSeconds(selectedDisorderBreakdown.duration) }} 秒</dd>
                      </div>
                      <div>
                        <dt>已流逝</dt>
                        <dd class="lab-mono">{{ formatDisorderSeconds(selectedDisorderBreakdown.elapsed) }} 秒</dd>
                      </div>
                      <div>
                        <dt>剩余时间 T</dt>
                        <dd class="lab-mono">
                          {{ formatDisorderSeconds(selectedDisorderBreakdown.duration) }} -
                          {{ formatDisorderSeconds(selectedDisorderBreakdown.elapsed) }} =
                          {{ formatDisorderSeconds(selectedDisorderBreakdown.remaining) }} 秒
                        </dd>
                      </div>
                    </dl>
                    <div class="disorder-explanation-formula" aria-label="紊乱倍率推导">
                      <p><span>可结算段数</span><strong>{{ disorderTickFormula(selectedDisorderBreakdown) }}</strong></p>
                      <p>
                        <span>{{ selectedDisorderBreakdown.hasBaseMultiplierBonus || selectedDisorderBreakdown.hasTypeScale || selectedDisorderBreakdown.hasDamageScale ? "基础紊乱倍率" : "当前倍率" }}</span>
                        <strong>{{ formatDisorderMultiplier(selectedDisorderBreakdown.fixedMultiplier) }} + {{ selectedDisorderBreakdown.tickCount }} × {{ formatDisorderMultiplier(selectedDisorderBreakdown.tickMultiplier) }} = {{ formatDisorderMultiplier(selectedDisorderBreakdown.baseMultiplier) }}</strong>
                      </p>
                      <p v-if="selectedDisorderBreakdown.hasBaseMultiplierBonus">
                        <span>紊乱倍率加算</span>
                        <strong>{{ formatDisorderMultiplier(selectedDisorderBreakdown.baseMultiplier) }} + {{ formatDisorderMultiplier(selectedDisorderBreakdown.baseMultiplierBonus) }} = {{ formatDisorderMultiplier(selectedDisorderBreakdown.effectiveBaseMultiplier) }}</strong>
                      </p>
                      <p v-if="selectedDisorderBreakdown.hasTypeScale">
                        <span>极性紊乱倍率</span>
                        <strong>{{ formatDisorderMultiplier(selectedDisorderBreakdown.effectiveBaseMultiplier) }} × {{ formatDisorderMultiplier(selectedDisorderBreakdown.typeScale) }} = {{ formatDisorderMultiplier(selectedDisorderBreakdown.typeAdjustedMultiplier) }}</strong>
                      </p>
                      <p v-if="selectedDisorderBreakdown.hasDamageScale">
                        <span>事件比例折算</span>
                        <strong>{{ formatDisorderMultiplier(selectedDisorderBreakdown.typeAdjustedMultiplier) }} × {{ formatDisorderMultiplier(selectedDisorderBreakdown.damageScale) }} = {{ formatDisorderMultiplier(selectedDisorderBreakdown.currentMultiplier) }}</strong>
                      </p>
                    </div>
                    <div class="disorder-explanation-notes">
                      <p>结算间隔：灼烧、侵蚀每0.5秒一段；感电、畏缩、霜寒、烈霜霜寒每1秒一段。</p>
                      <p v-for="note in selectedDisorderBreakdown.modifierNotes" :key="note">{{ note }}</p>
                    </div>
                  </section>

                  <section v-if="selectedTurbulenceBreakdown" class="disorder-explanation turbulence-explanation" aria-labelledby="lab-turbulence-explanation-title">
                    <div class="disorder-explanation-head">
                      <Info :size="17" aria-hidden="true" />
                      <div>
                        <strong id="lab-turbulence-explanation-title">乱流倍率说明</strong>
                        <p>乱流结算所选原异常，伤害使用当前非风属性角色的面板；风属性代理人面板不参与该事件的计算。</p>
                        <p>当前按每 {{ formatDisorderSeconds(selectedTurbulenceBreakdown.tickIntervalSeconds) }} 秒结算一段，已流逝时间会按该间隔就近取整。</p>
                      </div>
                    </div>
                    <div class="disorder-explanation-formula" aria-label="乱流倍率推导">
                      <p><span>剩余时间 T</span><strong>{{ formatDisorderSeconds(selectedTurbulenceBreakdown.duration) }} - {{ formatDisorderSeconds(selectedTurbulenceBreakdown.elapsed) }} = {{ formatDisorderSeconds(selectedTurbulenceBreakdown.remaining) }} 秒</strong></p>
                      <p><span>可结算段数</span><strong>{{ disorderTickFormula(selectedTurbulenceBreakdown) }}</strong></p>
                      <p><span>基础乱流倍率</span><strong>{{ formatDisorderMultiplier(selectedTurbulenceBreakdown.fixedMultiplier) }} + {{ selectedTurbulenceBreakdown.tickCount }} × {{ formatDisorderMultiplier(selectedTurbulenceBreakdown.tickMultiplier) }} = {{ formatDisorderMultiplier(selectedTurbulenceBreakdown.baseMultiplier) }}</strong></p>
                      <p><span>当前倍率</span><strong>({{ formatDisorderMultiplier(selectedTurbulenceBreakdown.baseMultiplier) }}{{ selectedTurbulenceBreakdown.baseMultiplierBonus ? ` + ${formatDisorderMultiplier(selectedTurbulenceBreakdown.baseMultiplierBonus)}` : "" }}) × {{ formatDisorderMultiplier(selectedTurbulenceBreakdown.damageScale) }} = {{ formatDisorderMultiplier(selectedTurbulenceBreakdown.currentMultiplier) }}</strong></p>
                    </div>
                    <div class="disorder-explanation-notes"><p>最终伤害使用“异常增伤区 + 乱流增伤区”，并保留异常暴击区与异常爆伤区。</p></div>
                  </section>

                  <section v-if="selectedReleaseBreakdown" class="disorder-explanation release-explanation" aria-labelledby="lab-release-explanation-title">
                    <div class="disorder-explanation-head">
                      <Info :size="17" aria-hidden="true" />
                      <div>
                        <strong id="lab-release-explanation-title">异放倍率说明</strong>
                        <p v-if="isVelinaRelease">使用维琳娜当前面板结算风属性异放，倍率由所选异放来源决定。</p>
                        <p v-else-if="isFioniReleaseSourceLocked(agent)">使用菲欧妮当前面板结算所选属性异放，技能倍率随工作台对应技能等级更新。</p>
                        <p v-else>{{ selectedReleaseBreakdown.sourceLabel }}提供原异常单次倍率与伤害快照，{{ selectedReleaseBreakdown.triggerLabel }}提供角色专属异放倍率。</p>
                        <p v-if="releaseSourceLocked">{{ ARIA_RELEASE_CORE_DESCRIPTION }}</p>
                      </div>
                    </div>
                    <dl class="disorder-explanation-metrics release-explanation-metrics">
                      <div><dt>{{ selectedReleaseBreakdown.conversionSourceLabel }}</dt><dd class="lab-mono">{{ formatReleaseValue(selectedReleaseBreakdown.conversionSourceValue) }}{{ selectedReleaseBreakdown.conversionSourceUnit === "percent" ? "%" : "" }}</dd></div>
                      <div v-if="selectedReleaseBreakdown.hasProficiencyYieldModifier"><dt>异放精通收益修正</dt><dd class="lab-mono">× {{ formatReleaseValue(selectedReleaseBreakdown.proficiencyYieldFactor) }}</dd></div>
                      <div v-if="selectedReleaseBreakdown.hasStunnedRatio"><dt>异放失衡倍率修正</dt><dd class="lab-mono">× {{ formatReleaseValue(selectedReleaseBreakdown.stunnedRatio) }}</dd></div>
                      <div><dt>异放最终倍率</dt><dd class="lab-mono">{{ formatDisorderMultiplier(selectedReleaseBreakdown.currentMultiplier) }}</dd></div>
                    </dl>
                  </section>

                  <div v-if="['direct', 'sheer', 'sharp'].includes(selectedEvent?.kind)" class="toolbar" :class="{ 'calculation-readonly-summary': isAdminDefaultMode }">
                    <template v-if="isAdminDefaultMode">
                      <Lock :size="14" />
                      <span class="muted">{{ selectedSkillSummary(selectedEvent) }}</span>
                    </template>
                    <template v-else>
                      <NButton size="small" @click="showSkillPicker = true">选择技能倍率</NButton>
                      <span class="muted lab-skill-path-text">{{ selectedSkillSummary(selectedEvent) }}</span>
                    </template>
                  </div>

                  <section v-if="selectedEvent?.kind === 'skillGroup'" class="skill-group-child-preview" aria-label="技能组内技能只读预览">
                    <div class="skill-group-child-preview-head">
                      <strong>组内技能（只读）</strong>
                      <span>按当前技能组次数 ×{{ eventCount(selectedEvent) }} 展示合计次数</span>
                    </div>
                    <div v-if="!selectedSkillGroup()" class="skill-group-child-preview-empty">未找到技能组</div>
                    <div v-else-if="!skillGroupChildEvents().length" class="skill-group-child-preview-empty">组内暂无事件</div>
                    <ol v-else class="skill-group-child-list">
                      <li v-for="(childEvent, index) in skillGroupChildEvents()" :key="childEvent.id ?? index" class="skill-group-child-item">
                        <span class="skill-group-child-order lab-mono">#{{ index + 1 }}</span>
                        <span class="skill-group-child-copy">
                          <strong>{{ skillGroupChildTitle(childEvent) }}</strong>
                          <small>当前倍率 {{ eventMultiplierText(childEvent) }} · 组内次数 ×{{ eventCount(childEvent) }} · 当前合计 ×{{ skillGroupChildTotalCount(childEvent) }} · {{ eventStunLabel(selectedEvent) }}</small>
                        </span>
                      </li>
                    </ol>
                  </section>
                </div>
              </NScrollbar>
            </div>
          </section>
        </div>
      </div>
    </div>

    <SkillPickerModal
      v-model:show="showSkillPicker"
      :skill-catalog="skillCatalog"
      :skill-levels="skillLevels"
      @select="applySkill"
    />
  </section>
</template>

<style scoped>
.lab-combat-head-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lab-combat-mode-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 4px;
  background: var(--lab-paper-soft);
  border: 1px solid var(--lab-line-strong);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--lab-ink);
}

.lab-combat-count-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--lab-ink);
  color: var(--lab-hud-lime);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.lab-combat-body {
  padding: 14px 16px 16px;
  gap: 12px;
}

/* Compact horizontal layout for the reused EnemyTargetConfigPanel on our wide stage */
.lab-enemy-strip :deep(.enemy-target-config-panel) {
  border-color: var(--lab-line-strong);
  background: var(--lab-paper-soft);
}

.lab-enemy-strip :deep(.enemy-target-config-header) {
  padding: 7px 12px;
  background: transparent;
}

.lab-enemy-strip :deep(.enemy-target-config-body) {
  padding: 9px 12px 11px;
}

.lab-enemy-strip :deep(.enemy-target-config-fields) {
  grid-template-columns: minmax(175px, 1.05fr) minmax(225px, 1.3fr) minmax(245px, 1.35fr);
  align-items: stretch;
  gap: 8px;
}

.lab-enemy-strip :deep(.enemy-target-primary-fields) {
  grid-template-columns: minmax(72px, 0.72fr) minmax(138px, 1.28fr);
  gap: 6px;
}

.lab-enemy-strip :deep(.metric) {
  background: var(--lab-paper);
  padding: 7px 9px;
}

.lab-enemy-strip :deep(.n-input-number .n-input-wrapper) {
  padding-left: 8px;
  padding-right: 4px;
}

.lab-enemy-strip :deep(.n-input-number .n-input__input-el) {
  min-width: 34px;
}

@media (max-width: 1180px) {
  .lab-enemy-strip :deep(.enemy-target-config-fields) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.lab-calc-warning-banner {
  border-color: var(--lab-red);
  background: var(--lab-red-soft);
  color: var(--lab-red);
  font-weight: 700;
}

.lab-calc-master {
  gap: 10px;
}

.lab-event-list-body {
  gap: 10px;
  padding: 10px;
}

/* Bounded inner scrollbar for event list */
.lab-event-list-body :deep(.calculation-event-scrollbar) {
  max-height: 310px;
}

.lab-event-list-body :deep(.calculation-event-scrollbar > .n-scrollbar-container) {
  max-height: 310px;
  overflow-y: auto;
  overscroll-behavior: auto;
  padding-right: 6px;
}

/* Bounded inner scrollbar for event detail pane */
.calculation-editor-panel :deep(.calculation-detail-scrollbar) {
  max-height: 430px;
}

.calculation-editor-panel :deep(.calculation-detail-scrollbar > .n-scrollbar-container) {
  max-height: 430px;
  overflow-y: auto;
  overscroll-behavior: auto;
}

.calculation-editor-panel {
  min-height: 360px;
}

.calculation-editor-panel > .panel-header {
  flex-wrap: wrap;
  align-items: center;
}

.calculation-editor-panel > .panel-header .panel-title {
  flex: 1 1 220px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.calculation-editor-status {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.calculation-readonly-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
}

.calculation-add-toolbar {
  gap: 6px;
}

.calculation-add-button :deep(.n-button__content) {
  font-weight: 700;
}

.calculation-turbulence-note {
  padding: 9px 11px;
  border: 1px solid var(--app-amber-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-amber-soft);
  color: var(--app-amber-strong);
  font-size: 12px;
  line-height: 1.55;
}

.calculation-settlement-selector {
  display: grid;
  grid-template-columns: minmax(72px, 92px) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 9px 12px;
  border-left: 3px solid var(--lab-accent);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
}

.calculation-settlement-label {
  color: var(--lab-ink);
  font-size: 12.5px;
  font-weight: 800;
}

.calculation-settlement-options {
  display: flex;
  width: 100%;
  min-width: 0;
}

.calculation-settlement-options :deep(.n-radio-button) {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
}

.calculation-settlement-options :deep(.n-radio-button__label) {
  width: 100%;
  text-align: center;
  white-space: normal;
}

.calculation-editor-grid {
  --ui-field-min: 138px;
  gap: 9px;
  align-items: start;
}

.calculation-editor-field {
  min-width: 0;
  min-height: 70px;
}

.metric-title {
  display: block;
  margin: 0 0 4px;
  color: var(--lab-muted);
  font-size: 11.5px;
  font-weight: 700;
}

.metric-value {
  margin: 0;
  font-weight: 750;
  min-width: 0;
}

.calculation-event-stun-value {
  display: flex;
  min-height: 28px;
  align-items: center;
}

.calculation-readonly-value {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 28px;
  color: var(--lab-ink);
  font-size: 13.5px;
  font-weight: 750;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.calculation-current-multiplier {
  color: var(--lab-accent);
}

.calculation-editor-grid--release {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.calculation-editor-grid--release .ui-field--wide {
  grid-column: span 1;
}

.release-snapshot-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.release-source-readonly {
  display: grid;
  gap: 2px;
}

.release-source-readonly small {
  color: var(--lab-muted);
  font-size: 11px;
  font-weight: 600;
}

.lab-skill-path-text {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.calculation-readonly-summary {
  padding: 7px 10px;
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
  font-size: 12px;
}

.disorder-explanation {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--lab-line);
  border-left: 3px solid var(--lab-ink);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper-soft);
}

.disorder-explanation-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  align-items: start;
}

.disorder-explanation-head strong {
  display: block;
  font-size: 13px;
  color: var(--lab-ink);
  margin-bottom: 3px;
}

.disorder-explanation-head p,
.disorder-explanation-notes p {
  margin: 0;
  color: var(--lab-muted);
  font-size: 12px;
  line-height: 1.5;
}

.disorder-explanation-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
}

.disorder-explanation-metrics dt {
  font-size: 11px;
  color: var(--lab-muted);
  margin-bottom: 2px;
}

.disorder-explanation-metrics dd {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--lab-ink);
}

.disorder-explanation-formula {
  display: grid;
}

.disorder-explanation-formula p {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  padding: 6px 0;
  border-bottom: 1px solid var(--lab-line);
  font-size: 12px;
}

.disorder-explanation-formula span {
  color: var(--lab-muted);
}

.disorder-explanation-formula strong {
  color: var(--lab-ink);
  font-family: var(--lab-font-mono);
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.skill-group-child-preview {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--lab-line);
}

.skill-group-child-preview-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.skill-group-child-preview-head strong {
  color: var(--lab-ink);
  font-size: 13px;
}

.skill-group-child-preview-head span {
  color: var(--lab-muted);
  font-size: 11.5px;
}

.skill-group-child-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill-group-child-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
}

.skill-group-child-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 22px;
  border-radius: 999px;
  background: var(--lab-well);
  color: var(--lab-ink-2);
  font-size: 11px;
  font-weight: 800;
}

.skill-group-child-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.skill-group-child-copy strong {
  color: var(--lab-ink);
  font-size: 12.5px;
}

.skill-group-child-copy small,
.skill-group-child-preview-empty {
  color: var(--lab-muted);
  font-size: 11.5px;
}

.skill-group-child-preview-empty {
  padding: 12px;
  border: 1px dashed var(--lab-line-strong);
  border-radius: var(--lab-radius-xs);
  text-align: center;
}

.calculation-event-list {
  display: grid;
  gap: 6px;
}

.calculation-event-list-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: start;
  padding: 7px 8px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper);
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.calculation-event-list-item:hover {
  border-color: var(--lab-line-strong);
}

.calculation-event-list-item.active {
  border-color: var(--lab-accent);
  background: #fffaf7;
  box-shadow: inset 3px 0 0 var(--lab-accent);
}

.calculation-event-list-item.readonly {
  grid-template-columns: minmax(0, 1fr);
}

.calculation-event-select {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 7px;
  align-items: start;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.calculation-event-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  border-radius: 4px;
  background: var(--lab-well);
  color: var(--lab-ink-2);
  font-size: 11px;
  font-weight: 800;
}

.calculation-event-list-item.active .calculation-event-order {
  background: var(--lab-ink);
  color: var(--lab-hud-lime);
}

.calculation-event-copy {
  min-width: 0;
}

.calculation-event-copy strong,
.calculation-event-copy small {
  display: block;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.calculation-event-copy strong {
  font-size: 12.5px;
  font-weight: 750;
  color: var(--lab-ink);
  line-height: 1.35;
}

.calculation-event-copy small {
  margin-top: 2px;
  color: var(--lab-muted);
  font-size: 11px;
  line-height: 1.35;
}

.calculation-event-inline-actions {
  display: flex;
  gap: 2px;
  align-items: center;
}

.calculation-event-empty {
  padding: 16px 10px;
  border: 1px dashed var(--lab-line-strong);
  border-radius: var(--lab-radius-xs);
  color: var(--lab-muted);
  font-size: 12px;
  text-align: center;
}

@container ui-layout (max-width: 720px) {
  .calculation-settlement-selector,
  .calculation-editor-grid--release,
  .disorder-explanation-formula p {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
