<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NInputNumber, NModal, NRadioButton, NRadioGroup, NSelect, NSwitch, NTag } from "naive-ui"
import { Copy, Info, Lock, Trash2 } from "lucide-vue-next"
import SkillPickerModal from "@/components/SkillPickerModal.vue"
import {
  defaultDamageConfig,
  hasAdminDefaultCalculation,
  isDamageModeAllowedForAgent,
  isRuptureAgent,
  normalizeDamageModeForAgent,
} from "@/stores/build"
import {
  anomalyEffectLabel,
  damageEventKindLabel,
  damageEventNeedsSkillMultiplier,
  damageEventSubjectLabel,
  damageSkillRefPathLabel,
  disorderEffectLabel,
  formatPercent,
  labelOf,
  skillCategoryLabel,
  skillRowLabel,
} from "@/utils/format"
import {
  damageSkillRowsWithGeneratedTotals,
  defaultSkillLevel,
  normalizeSkillLevel,
  skillRowValue,
} from "@core/skillMultiplierCandidates.js"
import { damageModifierAppliesTo } from "@core/calculator-core.js"
import {
  calculationSkillGroups,
  defaultSkillGroupReferenceEvent,
  hasCalculationSkillGroups,
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
} from "@core/damageEventMultipliers.js"
import { damageElementForAgent } from "@core/shared-combat.js"

const props = defineProps<{
  show: boolean
  damageConfig: any
  skillCatalog: any
  skillLevels: Record<string, any>
  meta: any
  agent?: any
  cinemaLevel?: number
  combatEffects?: any[]
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  save: [value: any]
}>()

const draft = ref<any>(defaultDamageConfig())
const showSkillPicker = ref(false)
const isAdminDefaultMode = computed(() => draft.value.mode === "adminDefault")
const canEditEventStructure = computed(() => draft.value.mode === "custom")
const canUseSheerDamage = computed(() => isRuptureAgent(props.agent))
const canUseAdminDefault = computed(() => hasAdminDefaultCalculation(props.agent, props.cinemaLevel ?? 0))
const adminCalculationConfig = computed(() => resolveDefaultCalculationConfig(props.agent?.defaultCalculationConfig, props.cinemaLevel ?? 0))
const skillGroups = computed(() => calculationSkillGroups(props.agent))
const hasSkillGroups = computed(() => hasCalculationSkillGroups(props.agent))
const skillGroupOptions = computed(() => skillGroups.value.map((group: any) => ({
  label: skillGroupLabel(group),
  value: group.id,
})))
const calculationModeOptions = computed(() => [
  !canUseSheerDamage.value ? { label: "最大化单个技能伤害", value: "single" } : null,
  canUseSheerDamage.value ? { label: "最大化贯穿伤害", value: "sheer" } : null,
  { label: "最大化异常伤害", value: "anomaly" },
  { label: canUseAdminDefault.value ? labelOf(adminCalculationConfig.value) : "管理员默认循环（未配置）", value: "adminDefault", disabled: !canUseAdminDefault.value },
  { label: "自定义", value: "custom" },
].filter((option): option is { label: string, value: string, disabled?: boolean } => Boolean(option)))
const critModeOptions = [
  { label: "期望", value: "expected" },
  { label: "暴击", value: "crit" },
  { label: "不暴击", value: "nonCrit" },
]
const anomalySettlementOptions = [
  { label: "属性异常", value: "attribute" },
  { label: "紊乱结算", value: "disorder" },
]
const disorderTypeOptions = [
  { label: "普通紊乱", value: "normal" },
  { label: "极性紊乱", value: "polarized" },
]
const anomalyVariantOptions = [
  { label: "普通强击", value: "normal" },
  { label: "极性强击", value: "polarizedAssault" },
]

function eventForMode(mode: string) {
  return mode === "sheer" ? newEvent("sheer") : newEvent("direct")
}

function normalizeDraftForAgent(config: any) {
  const mode = normalizeDamageModeForAgent(config?.mode, props.agent, props.cinemaLevel ?? 0)
  if (mode === config?.mode) {
    return config
  }
  const event = eventForMode(mode)
  return {
    ...config,
    mode,
    selectedEventId: event.id,
    events: [event],
  }
}

watch(() => props.show, value => {
  if (value) {
    const { target: _target, targetConfig: _targetConfig, ...damageConfig } = props.damageConfig ?? {}
    const fallback = defaultDamageConfig(props.agent, props.cinemaLevel ?? 0)
    const shouldUseFallbackEvents = damageConfig?.mode === "adminDefault"
      && Array.isArray(fallback.events)
      && fallback.events.length > 0
    draft.value = JSON.parse(JSON.stringify(normalizeDraftForAgent({
      ...fallback,
      ...damageConfig,
      ...(shouldUseFallbackEvents ? {
        selectedEventId: fallback.selectedEventId ?? fallback.events[0]?.id,
        events: fallback.events,
      } : {}),
    })))
    normalizeDraftAnomalyEffects()
    normalizeDraftElapsedSeconds()
    normalizeDraftSkillSelections()
    normalizeDraftStunned()
  }
})

watch([() => props.skillCatalog, () => props.skillLevels], () => {
  if (props.show) {
    normalizeDraftSkillSelections()
  }
}, { deep: true })

const anomalyOptions = computed(() => (props.meta?.anomalyEffects ?? []).map((effect: any) => ({
  label: anomalyEffectLabel(effect.id, props.meta),
  value: effect.id,
})))

const disorderOptions = computed(() => (props.meta?.disorderEffects ?? []).map((effect: any) => ({
  label: disorderEffectLabel(effect.id, props.meta),
  value: effect.id,
})))

const selectedEvent = computed(() => (draft.value.events ?? []).find((event: any) => event.id === draft.value.selectedEventId) ?? draft.value.events?.[0])
const skillCategories = computed(() => props.skillCatalog?.categories ?? [])
const skillCategoryOptions = computed(() => skillCategories.value.map((category: any) => ({
  label: skillCategoryLabel(category.id, category),
  value: category.id,
})))

function eventTitle(event: any) {
  if (event?.kind === "skillGroup") {
    return `技能组 · ${skillGroupLabel(selectedSkillGroup(event))}`
  }
  const displayEvent = eventWithSkillSelection(event)
  return `${damageEventKindLabel(displayEvent)} · ${damageEventSubjectLabel(displayEvent, props.meta, props.skillCatalog)}`
}

function eventListTitle(event: any) {
  const displayEvent = eventWithSkillSelection(event)
  if (isDirectSkillEvent(displayEvent)) {
    const selection = selectedSkillSelection(displayEvent)
    const subject = selection
      ? `${labelOf(selection.move)} / ${skillRowLabel(selection.row)}`
      : damageEventSubjectLabel(displayEvent, props.meta, props.skillCatalog)
    return subject
  }
  return eventTitle(event)
}

function eventMultiplier(event: any) {
  const disorder = disorderBreakdown(event)
  if (disorder) {
    return disorder.currentMultiplier
  }
  return resolveDamageEventMultiplier(eventWithSkillSelection(event), props.meta)
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
  return skillGroupById(props.agent, event?.skillGroupId)
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

function skillGroupChildTotalCount(childEvent: any, groupEvent: any = selectedEvent.value) {
  return eventCount(childEvent) * eventCount(groupEvent)
}

function skillGroupChildTitle(childEvent: any) {
  const displayEvent = eventWithSkillSelection(childEvent)
  return `${damageEventKindLabel(displayEvent)} · ${damageEventSubjectLabel(displayEvent, props.meta, props.skillCatalog)}`
}

function selectedEventCountLimits(event: any = selectedEvent.value) {
  if (event?.kind !== "skillGroup") {
    return { min: 0, max: null, step: 1 }
  }
  return skillGroupCountLimits(selectedSkillGroup(event) ?? {})
}

function normalizeSkillGroupEvent(event: any, index = 0) {
  return normalizeSkillGroupReferenceEvent(event, props.agent, index)
}

function updateSelectedSkillGroup(groupId: string) {
  const normalized = normalizeSkillGroupEvent({
    ...selectedEvent.value,
    skillGroupId: groupId,
  })
  if (!normalized) {
    return
  }
  updateSelectedEvent({
    skillGroupId: normalized.skillGroupId,
    count: normalized.count,
  }, { clearLabel: true })
}

function selectEvent(eventId: string) {
  draft.value.selectedEventId = eventId
}

function isEventActive(event: any) {
  return selectedEvent.value?.id === event?.id
}

function skillRows(category: any, move: any) {
  return damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {})
}

function isDirectSkillEvent(event: any) {
  return event?.kind === "direct" || event?.kind === "sheer"
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
  if (!props.skillCatalog?.id || !category || !move || !row) {
    return null
  }
  const level = normalizeSkillLevel(
    category,
    move,
    row,
    props.skillLevels?.[category.id] ?? defaultSkillLevel(category, move, row),
  )
  const skillMultiplier = skillRowValue(category, move, row, level)
  if (!Number.isFinite(skillMultiplier)) {
    return null
  }
  return {
    category,
    move,
    row,
    skillMultiplier,
    skillRef: {
      agentSkillId: props.skillCatalog.id,
      categoryId: category.id,
      moveId: move.id,
      rowId: row.id,
      level,
    },
  }
}

function selectedSkillSelection(event: any) {
  return skillSelection(event?.skillRef?.categoryId, event?.skillRef?.moveId, event?.skillRef?.rowId)
}

function eventWithSkillSelection(event: any) {
  if (!isDirectSkillEvent(event)) {
    return event
  }
  const selection = selectedSkillSelection(event)
  if (!selection) {
    return event
  }
  return {
    ...event,
    skillMultiplier: selection.skillMultiplier,
    skillRef: selection.skillRef,
  }
}

function normalizeDraftSkillSelections() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => eventWithSkillSelection(event))
}

function disorderElapsedStep(event: any) {
  return disorderElapsedStepSeconds(event, props.meta)
}

function disorderElapsedPrecision(event: any) {
  return Number.isInteger(disorderElapsedStep(event)) ? 0 : 1
}

function selectedDisorderEffect(event: any) {
  const effectId = selectedDisorderEffectId(event)
  return (props.meta?.disorderEffects ?? []).find((effect: any) => String(effect?.id ?? "") === effectId) ?? null
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
  return (props.combatEffects ?? []).flatMap((combatEffect: any) => {
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
  return disorderEffectLabel(effect?.id, props.meta).replace(/紊乱(?:（.*）)?$/, "") || "异常"
}

function disorderBreakdown(event: any) {
  if (!event || (event.kind !== "disorder" && event.settlementType !== "disorder")) {
    return null
  }
  const effect = selectedDisorderEffect(event)
  if (!effect) {
    return null
  }

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
  if (event?.kind !== "disorder" && event?.settlementType !== "disorder") {
    return event
  }
  return {
    ...event,
    elapsedSeconds: normalizeElapsedSeconds(event.elapsedSeconds, Number.POSITIVE_INFINITY, disorderElapsedStep(event)),
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

function selectedCategory(event: any) {
  return selectedSkillSelection(event)?.category ?? null
}

function selectedMove(event: any) {
  return selectedSkillSelection(event)?.move ?? null
}

function selectedRow(event: any) {
  return selectedSkillSelection(event)?.row ?? null
}

function selectedCategoryId(event: any) {
  return selectedCategory(event)?.id ?? null
}

function selectedMoveId(event: any) {
  return selectedMove(event)?.id ?? null
}

function selectedRowId(event: any) {
  return selectedRow(event)?.id ?? null
}

function optionLabel(options: Array<{ label: string, value: string }>, value: unknown, fallback = "未配置") {
  const option = options.find(item => String(item.value) === String(value ?? ""))
  return option?.label || fallback
}

function selectedSkillCategoryLabel(event: any) {
  const category = selectedCategory(event)
  return category ? skillCategoryLabel(category.id, category) : "未配置"
}

function selectedSkillMoveLabel(event: any) {
  return labelOf(selectedMove(event)) || "未配置"
}

function selectedSkillRowLabel(event: any) {
  const row = selectedRow(event)
  return row ? skillRowLabel(row) : "未配置"
}

function selectedSkillGroupLabel(event: any) {
  return skillGroupLabel(selectedSkillGroup(event))
}

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
  return damageSkillRefPathLabel(displayEvent?.skillRef, props.meta, props.skillCatalog)
    || (Number.isFinite(Number(displayEvent?.skillMultiplier)) ? `手填倍率 ${Number(displayEvent.skillMultiplier)}%` : "未选择技能倍率")
}

function selectedAnomalyEffectId(event: any) {
  return String(event?.anomalyEffect ?? "")
}

function selectedDisorderEffectId(event: any) {
  return String(event?.anomalyEffect ?? event?.previousAnomalyEffect ?? "")
}

const ATTRIBUTE_EFFECT_BY_ELEMENT: Record<string, string> = {
  physical: "assault",
  fire: "burn",
  ice: "shatter",
  electric: "shock",
  ether: "corruption",
}

const DISORDER_EFFECT_BY_ELEMENT: Record<string, string> = {
  physical: "flinch",
  fire: "burn",
  ice: "frozen",
  electric: "shock",
  ether: "corruption",
}

function effectOptionsForSettlement(settlementType: string) {
  return settlementType === "disorder" ? disorderOptions.value : anomalyOptions.value
}

function isKnownEffect(settlementType: string, effectId: string) {
  const options = effectOptionsForSettlement(settlementType)
  return !effectId || !options.length || options.some((option: { value: string }) => String(option.value) === effectId)
}

function defaultAgentEffectId(settlementType: string) {
  const options = effectOptionsForSettlement(settlementType)
  const element = damageElementForAgent(props.agent)
  const fallback = settlementType === "disorder" ? "burn" : "assault"
  const preferred = settlementType === "disorder" && props.agent?.attribute === "frost"
    ? "frost_frozen"
    : settlementType === "disorder"
      ? DISORDER_EFFECT_BY_ELEMENT[element] ?? fallback
      : ATTRIBUTE_EFFECT_BY_ELEMENT[element] ?? fallback
  return options.some((option: { value: string }) => String(option.value) === preferred)
    ? preferred
    : options[0]?.value ?? fallback
}

function normalizeDraftAnomalyEffects() {
  draft.value.events = (draft.value.events ?? []).map((event: any) => {
    if (event?.kind !== "anomaly" && event?.kind !== "disorder") {
      return event
    }
    const settlementType = event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
    const effectId = settlementType === "disorder" ? selectedDisorderEffectId(event) : selectedAnomalyEffectId(event)
    if (effectId && isKnownEffect(settlementType, effectId)) {
      return event
    }
    const normalized = {
      ...event,
      anomalyEffect: defaultAgentEffectId(settlementType),
    }
    delete normalized.previousAnomalyEffect
    return normalized
  })
}

function withSelectedEffectOption(
  options: Array<{ label: string, value: string }>,
  selected: string,
  labelFor: (value: string, meta?: any) => string = anomalyEffectLabel,
) {
  if (!selected || options.some(option => String(option.value) === selected)) {
    return options
  }
  return [...options, { label: labelFor(selected, props.meta), value: selected }]
}

function anomalyOptionsFor(event: any) {
  return withSelectedEffectOption(anomalyOptions.value, selectedAnomalyEffectId(event))
}

function disorderOptionsFor(event: any) {
  return withSelectedEffectOption(disorderOptions.value, selectedDisorderEffectId(event), disorderEffectLabel)
}

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
  return optionLabel(anomalyOptionsFor(event), value, anomalyEffectLabel(value, props.meta) || "未配置")
}

function selectedDisorderEffectLabel(event: any) {
  const value = selectedDisorderEffectValue(event)
  return optionLabel(disorderOptionsFor(event), value, disorderEffectLabel(value, props.meta) || "未配置")
}

function isKnownDisorderEffect(effectId: string) {
  return isKnownEffect("disorder", effectId)
}

function updateSelectedEvent(patch: any, options: { clearLabel?: boolean } = {}) {
  if (isAdminDefaultMode.value) {
    return
  }
  const current = selectedEvent.value
  if (!current) {
    return
  }
  draft.value.events = draft.value.events.map((event: any) => {
    if (event.id !== current.id) {
      return event
    }
    const next = { ...event, ...patch }
    if (options.clearLabel) {
      delete next.label
    }
    for (const key of Object.keys(next)) {
      if (next[key] === undefined) {
        delete next[key]
      }
    }
    return next
  })
}

function newEvent(kind: string) {
  const id = `${kind}-${Date.now().toString(36)}`
  if (kind === "skillGroup") {
    const event = defaultSkillGroupReferenceEvent(props.agent, skillGroups.value[0]?.id, (draft.value.events?.length ?? 0) + 1)
    return {
      ...(event ?? { kind: "skillGroup", skillGroupId: "", count: 1, stunned: true }),
      id,
    }
  }
  if (kind === "anomaly") {
    return { id, kind, settlementType: "attribute", anomalyEffect: defaultAgentEffectId("attribute"), procCount: 1, count: 1, stunned: true }
  }
  if (kind === "disorder") {
    return { id, kind: "anomaly", settlementType: "disorder", disorderType: "normal", anomalyEffect: defaultAgentEffectId("disorder"), elapsedSeconds: 0, count: 1, stunned: true }
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
  if (!canEditEventStructure.value) {
    return
  }
  if (kind === "sheer" && !canUseSheerDamage.value) {
    return
  }
  if (kind === "skillGroup" && !hasSkillGroups.value) {
    return
  }
  const event = newEvent(kind)
  draft.value.events = [...(draft.value.events ?? []), event]
  draft.value.selectedEventId = event.id
  draft.value.mode = "custom"
}

function duplicateEvent(eventId = selectedEvent.value?.id) {
  if (!canEditEventStructure.value) {
    return
  }
  const current = (draft.value.events ?? []).find((event: any) => event.id === eventId) ?? selectedEvent.value
  if (!current) {
    return
  }
  const event = { ...JSON.parse(JSON.stringify(current)), id: `${current.id}-copy-${Date.now().toString(36)}` }
  const index = (draft.value.events ?? []).findIndex((item: any) => item.id === current.id)
  const events = [...(draft.value.events ?? [])]
  events.splice(index >= 0 ? index + 1 : events.length, 0, event)
  draft.value.events = events
  draft.value.selectedEventId = event.id
  draft.value.mode = "custom"
}

function removeEvent(eventId = selectedEvent.value?.id) {
  if (!canEditEventStructure.value) {
    return
  }
  const current = (draft.value.events ?? []).find((event: any) => event.id === eventId) ?? selectedEvent.value
  if (!current) {
    return
  }
  const currentIndex = (draft.value.events ?? []).findIndex((event: any) => event.id === current.id)
  const events = draft.value.events.filter((event: any) => event.id !== current.id)
  draft.value.events = events.length ? events : [newEvent("direct")]
  const nextIndex = Math.max(0, Math.min(currentIndex, draft.value.events.length - 1))
  draft.value.selectedEventId = draft.value.events[nextIndex]?.id
  draft.value.mode = "custom"
}

function applyMode(mode: string) {
  const nextMode = normalizeDamageModeForAgent(mode, props.agent, props.cinemaLevel ?? 0)
  draft.value.mode = nextMode
  if (nextMode === "single") {
    draft.value.events = [newEvent("direct")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "sheer") {
    draft.value.events = [newEvent("sheer")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "anomaly") {
    draft.value.events = [newEvent("anomaly")]
    draft.value.selectedEventId = draft.value.events[0].id
  } else if (nextMode === "adminDefault") {
    const fallback = defaultDamageConfig(props.agent, props.cinemaLevel ?? 0)
    draft.value.events = JSON.parse(JSON.stringify(fallback.events ?? [newEvent("direct")]))
    draft.value.selectedEventId = fallback.selectedEventId ?? draft.value.events[0]?.id
  }
}

const eventWarnings = computed(() => {
  const event = selectedEvent.value
  if (!event) {
    return ["请选择一个事件"]
  }
  const warnings: string[] = []
  if (!Number.isFinite(Number(event.count)) || Number(event.count) <= 0) {
    warnings.push("次数需要大于 0")
  }
  if (event.kind === "skillGroup") {
    if (!event.skillGroupId) {
      warnings.push("技能组事件需要选择技能组")
    } else if (!selectedSkillGroup(event)) {
      warnings.push("技能组不存在")
    }
    return warnings
  }
  if (damageEventNeedsSkillMultiplier(event, props.meta, props.skillCatalog)) {
    warnings.push("直伤/贯穿事件需要技能倍率")
  }
  if (event.kind === "anomaly" && event.settlementType !== "disorder") {
    if (!event.anomalyEffect) {
      warnings.push("属性异常事件需要选择异常类型")
    } else if (!isKnownEffect("attribute", selectedAnomalyEffectId(event))) {
      warnings.push("属性异常事件需要选择有效的异常类型")
    }
  }
  const disorderEffectId = selectedDisorderEffectId(event)
  if ((event.kind === "disorder" || event.settlementType === "disorder") && !disorderEffectId) {
    warnings.push("紊乱事件需要选择原异常")
  } else if ((event.kind === "disorder" || event.settlementType === "disorder") && !isKnownDisorderEffect(disorderEffectId)) {
    warnings.push("紊乱事件需要选择有效的原异常")
  }
  return warnings
})

function applySkill(value: any) {
  updateSelectedEvent({
    skillMultiplier: value.skillMultiplier,
    skillRef: value.skillRef,
  }, { clearLabel: true })
}

function updateSkillRef(categoryId: string, moveId?: string, rowId?: string) {
  const selection = skillSelection(categoryId, moveId, rowId)
  if (!selection) {
    return
  }
  updateSelectedEvent({
    skillMultiplier: selection.skillMultiplier,
    skillRef: selection.skillRef,
  }, { clearLabel: true })
}

function updateSkillCategory(categoryId: string) {
  updateSkillRef(categoryId)
}

function updateSkillMove(moveId: string) {
  updateSkillRef(selectedCategoryId(selectedEvent.value) ?? "", moveId)
}

function updateSkillRow(rowId: string) {
  updateSkillRef(selectedCategoryId(selectedEvent.value) ?? "", selectedMoveId(selectedEvent.value) ?? "", rowId)
}

function updateAnomalySettlementType(value: string) {
  if (value === "disorder") {
    const effectId = defaultAgentEffectId("disorder")
    const nextEvent = { ...selectedEvent.value, anomalyEffect: effectId, settlementType: "disorder" }
    updateSelectedEvent({
      settlementType: "disorder",
      anomalyEffect: effectId,
      previousAnomalyEffect: undefined,
      disorderType: selectedEvent.value?.disorderType ?? "normal",
      elapsedSeconds: normalizeElapsedSeconds(selectedEvent.value?.elapsedSeconds, Number.POSITIVE_INFINITY, disorderElapsedStep(nextEvent)),
      procCount: undefined,
    }, { clearLabel: true })
    return
  }
  updateSelectedEvent({
    settlementType: "attribute",
    anomalyEffect: defaultAgentEffectId("attribute"),
    previousAnomalyEffect: undefined,
    disorderType: undefined,
    elapsedSeconds: undefined,
    procCount: selectedEvent.value?.procCount ?? 1,
  }, { clearLabel: true })
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

function close() {
  emit("update:show", false)
}

function save() {
  if (draft.value.mode === "adminDefault") {
    const fallback = defaultDamageConfig(props.agent, props.cinemaLevel ?? 0)
    emit("save", {
      ...fallback,
      mode: "adminDefault",
      selectedEventId: fallback.selectedEventId ?? fallback.events?.[0]?.id,
      events: JSON.parse(JSON.stringify(fallback.events ?? [])).map((event: any) => ({
        ...event,
        stunned: eventStunValue(event),
      })),
    })
    close()
    return
  }
  normalizeDraftSkillSelections()
  normalizeDraftElapsedSeconds()
  normalizeDraftStunned()
  const normalizedDraft = isDamageModeAllowedForAgent(draft.value.mode, props.agent, props.cinemaLevel ?? 0)
    ? draft.value
    : normalizeDraftForAgent(draft.value)
  const { target: _target, targetConfig: _targetConfig, ...damageConfig } = normalizedDraft
  emit("save", damageConfig)
  close()
}
</script>

<template>
  <NModal :show="show" preset="card" title="事件管理" style="width: min(1080px, calc(100vw - 16px)); max-width: 1080px" @update:show="emit('update:show', $event)">
    <div class="ui-layout-scope" data-layout-surface="calculation-config">
    <div class="calculation-grid ui-master-detail">
      <aside class="section-band">
        <div class="metric">
          <span class="metric-title">计算方式</span>
          <div class="metric-value">
            <NSelect
              :value="draft.mode"
              :options="calculationModeOptions"
              aria-label="计算方式"
              @update:value="applyMode(String($event))"
            />
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">目标事件</h3>
            <NTag round>{{ draft.events?.length ?? 0 }} 项</NTag>
          </div>
          <div class="panel-body section-band">
            <div v-if="draft.events?.length" class="calculation-event-list">
              <article
                v-for="(event, index) in draft.events"
                :key="event.id"
                class="calculation-event-list-item"
                :class="{ active: isEventActive(event), readonly: !canEditEventStructure }"
              >
                <button type="button" class="calculation-event-select" @click="selectEvent(event.id)">
                  <span class="calculation-event-order">#{{ index + 1 }}</span>
                  <span class="calculation-event-copy">
                    <strong>{{ eventListTitle(event) }}</strong>
                    <small v-if="event.kind === 'skillGroup'">次数 ×{{ event.count ?? 1 }} · {{ eventStunLabel(event) }}</small>
                    <small v-else>当前倍率 {{ eventMultiplierText(event) }} · 次数 ×{{ event.count ?? 1 }} · {{ eventStunLabel(event) }}</small>
                  </span>
                </button>
                <div v-if="canEditEventStructure" class="calculation-event-inline-actions">
                  <NButton circle quaternary size="tiny" title="复制目标事件" aria-label="复制目标事件" @click="duplicateEvent(event.id)">
                    <template #icon><Copy :size="14" /></template>
                  </NButton>
                  <NButton circle quaternary size="tiny" type="error" title="删除目标事件" aria-label="删除目标事件" @click="removeEvent(event.id)">
                    <template #icon><Trash2 :size="14" /></template>
                  </NButton>
                </div>
              </article>
            </div>
            <div v-else class="calculation-event-empty">还没有目标事件</div>
            <div v-if="canEditEventStructure" class="toolbar calculation-add-toolbar">
              <NButton class="calculation-add-button" size="medium" @click="addEvent('direct')">添加技能</NButton>
              <NButton v-if="canUseSheerDamage" class="calculation-add-button" size="medium" @click="addEvent('sheer')">添加贯穿</NButton>
              <NButton class="calculation-add-button" size="medium" @click="addEvent('anomaly')">添加异常事件</NButton>
              <NButton v-if="hasSkillGroups" class="calculation-add-button" size="medium" @click="addEvent('skillGroup')">添加技能组</NButton>
            </div>
          </div>
        </div>
      </aside>

      <section class="section-band calculation-editor-column">
        <div class="panel calculation-editor-panel">
          <div class="panel-header">
            <h3 class="panel-title">{{ eventTitle(selectedEvent) }}</h3>
            <div class="calculation-editor-status">
              <NTag round>{{ damageEventKindLabel(selectedEvent) }}</NTag>
              <NTag v-if="isAdminDefaultMode" type="info" round>
                <span class="calculation-readonly-tag"><Lock :size="13" />管理员配置 · 只读</span>
              </NTag>
            </div>
          </div>
          <div class="panel-body section-band">
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
                class="calculation-settlement-options"
                :value="selectedEvent?.settlementType ?? 'attribute'"
                aria-label="结算类型"
              >
                <NRadioButton
                  v-for="option in anomalySettlementOptions"
                  :key="option.value"
                  :value="option.value"
                  :label="option.label"
                  @click="updateAnomalySettlementType(option.value)"
                />
              </NRadioGroup>
            </div>
            <div class="metric-grid calculation-editor-grid ui-field-grid" data-layout-surface="calculation-fields">
              <div
                class="metric calculation-editor-field calculation-editor-field-short ui-field"
                :class="{ 'calculation-skill-group-count-field': selectedEvent?.kind === 'skillGroup' }"
                data-layout-field
              >
                <span class="metric-title">次数</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ eventCount(selectedEvent) }}</span>
                  <NInputNumber
                    v-else
                    :value="selectedEvent?.count ?? 1"
                    :min="selectedEventCountLimits().min"
                    :max="selectedEventCountLimits().max ?? undefined"
                    :step="selectedEventCountLimits().step"
                    aria-label="事件次数"
                    @update:value="updateSelectedEvent({ count: Number($event ?? 1) })"
                  />
                </div>
              </div>
              <div class="metric calculation-editor-field calculation-editor-field-short ui-field" data-layout-field="event-stunned">
                <span class="metric-title">是否失衡</span>
                <div class="metric-value calculation-event-stun-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ eventStunValue(selectedEvent) ? '是' : '否' }}</span>
                  <NSwitch
                    v-else
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
              <div v-if="selectedEvent?.kind !== 'skillGroup'" class="metric calculation-editor-field calculation-editor-field-short ui-field" data-layout-field="event-multiplier">
                <span class="metric-title">当前倍率</span>
                <div class="metric-value"><span class="calculation-readonly-value calculation-current-multiplier">{{ eventMultiplierText(selectedEvent) }}</span></div>
              </div>
              <div
                v-if="selectedEvent?.kind === 'skillGroup'"
                class="metric calculation-editor-field calculation-editor-field-wide calculation-skill-group-select-field ui-field ui-field--wide"
                data-layout-field
              >
                <span class="metric-title">技能组</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillGroupLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedEvent?.skillGroupId" :options="skillGroupOptions" aria-label="技能组" @update:value="updateSelectedSkillGroup(String($event))" />
                </div>
              </div>
              <div
                v-if="selectedEvent?.kind === 'skillGroup'"
                class="metric calculation-editor-field calculation-editor-field-medium calculation-skill-group-summary-field ui-field"
                data-layout-field
              >
                <span class="metric-title">组内事件</span>
                <div class="metric-value"><span class="calculation-readonly-value">{{ skillGroupEventCount(selectedSkillGroup()) }} 项</span></div>
              </div>
              <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-medium ui-field" data-layout-field>
                <span class="metric-title">技能大类</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillCategoryLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedCategoryId(selectedEvent)" :options="skillCategoryOptions" aria-label="技能大类" @update:value="updateSkillCategory(String($event))" />
                </div>
              </div>
              <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-wide ui-field ui-field--wide" data-layout-field>
                <span class="metric-title">招式</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillMoveLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedMoveId(selectedEvent)" :options="moveOptions(selectedEvent)" aria-label="招式" @update:value="updateSkillMove(String($event))" />
                </div>
              </div>
              <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-wide ui-field ui-field--wide" data-layout-field>
                <span class="metric-title">倍率行</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedSkillRowLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedRowId(selectedEvent)" :options="rowOptions(selectedEvent)" aria-label="倍率行" @update:value="updateSkillRow(String($event))" />
                </div>
              </div>
              <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && !skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-medium ui-field" data-layout-field>
                <span class="metric-title">技能倍率%</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ Number(selectedEvent?.skillMultiplier ?? 100) }}%</span>
                  <NInputNumber v-else :value="selectedEvent?.skillMultiplier ?? 100" :min="0" :step="0.1" aria-label="技能倍率百分比" @update:value="updateSelectedEvent({ skillMultiplier: Number($event ?? 0) })" />
                </div>
              </div>
              <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind)" class="metric calculation-editor-field calculation-editor-field-short ui-field" data-layout-field>
                <span class="metric-title">暴击模式</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(critModeOptions, selectedEvent?.critMode ?? 'expected') }}</span>
                  <NSelect
                    v-else
                    :value="selectedEvent?.critMode ?? 'expected'"
                    :options="critModeOptions"
                    aria-label="暴击模式"
                    @update:value="updateSelectedEvent({ critMode: $event })"
                  />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder'" class="metric calculation-editor-field calculation-editor-field-wide ui-field ui-field--wide" data-layout-field>
                <span class="metric-title">异常类型</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedAnomalyEffectLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedAnomalyEffectValue(selectedEvent)" :options="anomalyOptionsFor(selectedEvent)" aria-label="异常类型" @update:value="updateSelectedEvent({ anomalyEffect: $event, anomalyVariant: $event === 'assault' ? (selectedEvent?.anomalyVariant ?? 'normal') : undefined }, { clearLabel: true })" />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder'" class="metric calculation-editor-field calculation-editor-field-short ui-field" data-layout-field>
                <span class="metric-title">触发次数</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ Number(selectedEvent?.procCount ?? 1) }}</span>
                  <NInputNumber v-else :value="selectedEvent?.procCount ?? 1" :min="0" :step="1" aria-label="异常触发次数" @update:value="updateSelectedEvent({ procCount: Number($event ?? 1) })" />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder' && selectedAnomalyEffectId(selectedEvent) === 'assault'" class="metric calculation-editor-field calculation-editor-field-medium ui-field" data-layout-field>
                <span class="metric-title">强击形态</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(anomalyVariantOptions, selectedEvent?.anomalyVariant ?? 'normal') }}</span>
                  <NSelect v-else :value="selectedEvent?.anomalyVariant ?? 'normal'" :options="anomalyVariantOptions" aria-label="强击形态" @update:value="updateSelectedEvent({ anomalyVariant: $event })" />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-wide ui-field ui-field--wide" data-layout-field>
                <span class="metric-title">原异常</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ selectedDisorderEffectLabel(selectedEvent) }}</span>
                  <NSelect v-else :value="selectedDisorderEffectValue(selectedEvent)" :options="disorderOptionsFor(selectedEvent)" aria-label="紊乱原异常" @update:value="updateDisorderEffect(String($event))" />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-medium ui-field" data-layout-field>
                <span class="metric-title">紊乱类型</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ optionLabel(disorderTypeOptions, selectedEvent?.disorderType ?? 'normal') }}</span>
                  <NSelect v-else :value="selectedEvent?.disorderType ?? 'normal'" :options="disorderTypeOptions" aria-label="紊乱类型" @update:value="updateSelectedEvent({ disorderType: $event })" />
                </div>
              </div>
              <div v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-short ui-field" data-layout-field="elapsed-seconds">
                <span class="metric-title">已流逝秒数</span>
                <div class="metric-value">
                  <span v-if="isAdminDefaultMode" class="calculation-readonly-value">{{ Number(selectedEvent?.elapsedSeconds ?? 0) }} 秒</span>
                  <NInputNumber v-else :key="`elapsed-${selectedDisorderEffectValue(selectedEvent)}`" :value="selectedEvent?.elapsedSeconds ?? 0" :min="0" :step="disorderElapsedStep(selectedEvent)" :precision="disorderElapsedPrecision(selectedEvent)" aria-label="异常已流逝秒数" @update:value="updateElapsedSeconds($event)" />
                </div>
              </div>
            </div>
            <div v-if="eventWarnings.length" class="chip-row">
              <NTag v-for="warning in eventWarnings" :key="warning" type="warning" round>{{ warning }}</NTag>
            </div>
            <section
              v-if="selectedDisorderBreakdown"
              class="disorder-explanation"
              aria-labelledby="disorder-explanation-title"
            >
              <div class="disorder-explanation-head">
                <Info :size="19" aria-hidden="true" />
                <div>
                  <strong id="disorder-explanation-title">紊乱倍率说明</strong>
                  <p>“已流逝秒数”指原异常生效后，到另一种异常触发紊乱前经过的时间。已流逝越久，剩余时间越短，可结算段数越少，紊乱倍率越低。</p>
                  <p>当前原异常按每 {{ formatDisorderSeconds(selectedDisorderBreakdown.tickIntervalSeconds) }} 秒结算一段；已流逝秒数会按该间隔就近取整。</p>
                </div>
              </div>

              <dl class="disorder-explanation-metrics">
                <div>
                  <dt>本次计算时长上限</dt>
                  <dd>{{ formatDisorderSeconds(selectedDisorderBreakdown.duration) }} 秒</dd>
                </div>
                <div>
                  <dt>已流逝</dt>
                  <dd>{{ formatDisorderSeconds(selectedDisorderBreakdown.elapsed) }} 秒</dd>
                </div>
                <div>
                  <dt>剩余时间 T</dt>
                  <dd>
                    {{ formatDisorderSeconds(selectedDisorderBreakdown.duration) }} -
                    {{ formatDisorderSeconds(selectedDisorderBreakdown.elapsed) }} =
                    {{ formatDisorderSeconds(selectedDisorderBreakdown.remaining) }} 秒
                  </dd>
                </div>
              </dl>

              <div class="disorder-explanation-formula" aria-label="紊乱倍率推导">
                <p>
                  <span>可结算段数</span>
                  <strong>{{ disorderTickFormula(selectedDisorderBreakdown) }}</strong>
                </p>
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
            <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind)" class="toolbar" :class="{ 'calculation-readonly-summary': isAdminDefaultMode }">
              <template v-if="isAdminDefaultMode">
                <Lock :size="15" />
                <span>{{ selectedSkillSummary(selectedEvent) }}</span>
              </template>
              <template v-else>
                <NButton @click="showSkillPicker = true">选择技能倍率</NButton>
                <span class="muted">{{ selectedSkillSummary(selectedEvent) }}</span>
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
                  <span class="skill-group-child-order">#{{ index + 1 }}</span>
                  <span class="skill-group-child-copy">
                    <strong>{{ skillGroupChildTitle(childEvent) }}</strong>
                    <small>当前倍率 {{ eventMultiplierText(childEvent) }} · 组内次数 ×{{ eventCount(childEvent) }} · 当前合计 ×{{ skillGroupChildTotalCount(childEvent) }} · {{ eventStunLabel(selectedEvent) }}</small>
                  </span>
                </li>
              </ol>
            </section>
          </div>
        </div>

      </section>
    </div>
    </div>

    <SkillPickerModal
      v-model:show="showSkillPicker"
      :skill-catalog="skillCatalog"
      :skill-levels="skillLevels"
      @select="applySkill"
    />

    <template #footer>
      <div class="drawer-footer">
        <span class="muted">事件 {{ draft.events?.length ?? 0 }} 项</span>
        <NButton @click="close">取消</NButton>
        <NButton type="primary" @click="save">保存配置</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.calculation-grid {
  min-width: 0;
}

.calculation-editor-column {
  min-width: 0;
}

.calculation-add-toolbar {
  gap: 8px;
}

.calculation-add-button {
  min-width: 88px;
}

.calculation-add-button :deep(.n-button__border) {
  border-color: #b8cceb;
}

.calculation-add-button :deep(.n-button__state-border) {
  border-color: #8fb0df;
}

.calculation-add-button :deep(.n-button__content) {
  font-weight: 700;
}

.calculation-editor-panel {
  min-height: 560px;
}

.calculation-editor-panel > .panel-header {
  flex-wrap: wrap;
  align-items: flex-start;
}

.calculation-editor-panel > .panel-header .panel-title {
  flex: 1 1 320px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.calculation-editor-status {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.calculation-settlement-selector {
  display: grid;
  grid-template-columns: minmax(88px, 112px) minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  min-width: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--app-blue);
  background: #f8fafc;
}

.calculation-settlement-label {
  min-width: 0;
  color: var(--app-text);
  font-size: 14px;
  overflow-wrap: anywhere;
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
  min-width: 0;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.calculation-settlement-readonly {
  font-weight: 750;
}

.calculation-readonly-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
}

.calculation-editor-grid {
  --ui-field-min: 144px;
  gap: 12px;
  align-items: start;
}

.calculation-editor-field {
  min-width: 0;
  min-height: 86px;
}

.metric-title {
  display: block;
  margin: 0 0 5px;
  color: var(--app-muted);
  font-size: 12px;
}

.metric-value {
  margin: 0;
  font-weight: 750;
}

.calculation-editor-field .metric-value {
  min-width: 0;
}

.calculation-event-stun-value {
  display: flex;
  min-height: 34px;
  align-items: center;
}

.calculation-readonly-value {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 34px;
  color: var(--app-text);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.calculation-editor-field :deep(.n-select),
.calculation-editor-field :deep(.n-input-number) {
  width: 100%;
}

.calculation-editor-field :deep(.n-base-selection-label),
.calculation-editor-field :deep(.n-input-wrapper) {
  min-width: 0;
}

.calculation-readonly-summary {
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-left: 3px solid var(--app-blue);
  background: #f8fafc;
  color: var(--app-text);
  font-weight: 700;
  line-height: 1.5;
}

.calculation-readonly-summary svg {
  flex: 0 0 auto;
  margin-top: 3px;
  color: var(--app-blue);
}

.calculation-readonly-summary span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.disorder-explanation {
  display: grid;
  gap: 14px;
  min-width: 0;
  margin-top: 4px;
  padding: 16px 18px;
  border-left: 3px solid var(--app-blue);
  background: #f8fafc;
}

.disorder-explanation-head {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.disorder-explanation-head svg {
  margin-top: 1px;
  color: var(--app-blue);
}

.disorder-explanation-head div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.disorder-explanation-head strong {
  color: var(--app-text);
  font-size: 14px;
}

.disorder-explanation-head p,
.disorder-explanation-notes p {
  margin: 0;
  overflow-wrap: anywhere;
}

.disorder-explanation-head p {
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.6;
}

.disorder-explanation-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
  margin: 0;
}

.disorder-explanation-metrics div {
  min-width: 0;
  padding-right: 12px;
  border-right: 1px solid var(--app-border);
}

.disorder-explanation-metrics div:last-child {
  padding-right: 0;
  border-right: 0;
}

.disorder-explanation-metrics dt {
  color: var(--app-muted);
  font-size: 12px;
}

.disorder-explanation-metrics dd {
  margin: 4px 0 0;
  color: var(--app-text);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.disorder-explanation-formula {
  display: grid;
  gap: 0;
  min-width: 0;
  border-top: 1px solid var(--app-border);
}

.disorder-explanation-formula p {
  display: grid;
  grid-template-columns: minmax(108px, 0.32fr) minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 9px 0;
  border-bottom: 1px solid var(--app-border);
}

.disorder-explanation-formula span {
  color: var(--app-muted);
  font-size: 12px;
}

.disorder-explanation-formula strong {
  min-width: 0;
  color: var(--app-text);
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.disorder-explanation-notes {
  display: grid;
  gap: 4px;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.55;
}

.skill-group-panel .panel-body {
  gap: 10px;
}

.skill-group-preset-field {
  min-height: 0;
}

.skill-group-count-list {
  display: grid;
  gap: 8px;
}

.skill-group-count-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.skill-group-count-row span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.skill-group-count-row strong,
.skill-group-count-row small {
  min-width: 0;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}

.skill-group-count-row small {
  color: var(--app-muted);
  font-size: 12px;
}

.skill-group-count-row :deep(.n-input-number) {
  width: 100%;
}

.skill-group-child-preview {
  display: grid;
  gap: 10px;
  min-width: 0;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
}

.skill-group-child-preview-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.skill-group-child-preview-head strong {
  color: var(--app-text);
  font-size: 14px;
}

.skill-group-child-preview-head span {
  color: var(--app-muted);
  font-size: 12px;
}

.skill-group-child-list {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill-group-child-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.skill-group-child-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 26px;
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

.skill-group-child-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.skill-group-child-copy strong,
.skill-group-child-copy small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.skill-group-child-copy strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.35;
}

.skill-group-child-copy small,
.skill-group-child-preview-empty {
  color: var(--app-muted);
  font-size: 12px;
}

.skill-group-child-preview-empty {
  padding: 14px;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-sm);
  text-align: center;
}

.calculation-event-list {
  display: grid;
  gap: 8px;
  max-height: min(46vh, 520px);
  overflow: auto;
  padding-right: 2px;
}

.calculation-event-list-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
}

.calculation-event-list-item.active {
  border-color: var(--app-blue);
  background: #eff6ff;
}

.calculation-event-list-item.readonly {
  grid-template-columns: minmax(0, 1fr);
}

.calculation-event-select {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
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
  min-width: 34px;
  height: 26px;
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
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
  font-size: 13px;
  line-height: 1.45;
}

.calculation-event-copy small {
  margin-top: 3px;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.35;
}

.calculation-event-inline-actions {
  display: grid;
  grid-template-columns: repeat(2, 28px);
  gap: 4px;
  align-items: center;
}

.calculation-event-inline-actions :deep(.n-button) {
  width: 28px;
  height: 28px;
  padding: 0;
}

.calculation-event-empty {
  padding: 18px 12px;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius);
  color: var(--app-muted);
  text-align: center;
}

@container ui-layout (max-width: 760px) {
  .calculation-editor-panel {
    min-height: 0;
  }

  .calculation-event-list {
    max-height: 360px;
  }

  .calculation-event-list-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .calculation-event-inline-actions {
    justify-content: end;
  }

  .calculation-settlement-selector {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .disorder-explanation {
    padding: 14px;
  }

  .disorder-explanation-metrics {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .disorder-explanation-metrics div {
    padding: 0 0 8px;
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .disorder-explanation-metrics div:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .disorder-explanation-formula p {
    grid-template-columns: 1fr;
    gap: 3px;
  }
}
</style>
