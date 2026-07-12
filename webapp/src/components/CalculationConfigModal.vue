<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NInputNumber, NModal, NSelect, NTag } from "naive-ui"
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
  damageEventTitle as formatDamageEventTitle,
  damageSkillRefPathLabel,
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
import {
  calculationSkillGroups,
  defaultSkillGroupReferenceEvent,
  hasCalculationSkillGroups,
  normalizeSkillGroupReferenceEvent,
  skillGroupById,
  skillGroupCountLimits,
} from "@core/calculationSkillGroups.js"
import { resolveDefaultCalculationConfig } from "@core/defaultCalculationConfig.js"

const props = defineProps<{
  show: boolean
  damageConfig: any
  skillCatalog: any
  skillLevels: Record<string, any>
  meta: any
  agent?: any
  cinemaLevel?: number
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  save: [value: any]
}>()

const draft = ref<any>(defaultDamageConfig())
const showSkillPicker = ref(false)
const isAdminDefaultMode = computed(() => draft.value.mode === "adminDefault")
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
    normalizeDraftSkillSelections()
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
  label: anomalyEffectLabel(effect.id, props.meta),
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
    return `技能组 · ${skillGroupLabel(selectedSkillGroup(event))} ×${event?.count ?? 1}`
  }
  return formatDamageEventTitle(eventWithSkillSelection(event), props.meta, props.skillCatalog)
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

function withSelectedEffectOption(options: Array<{ label: string, value: string }>, selected: string) {
  if (!selected || options.some(option => String(option.value) === selected)) {
    return options
  }
  return [...options, { label: anomalyEffectLabel(selected, props.meta), value: selected }]
}

function anomalyOptionsFor(event: any) {
  return withSelectedEffectOption(anomalyOptions.value, selectedAnomalyEffectId(event))
}

function disorderOptionsFor(event: any) {
  return withSelectedEffectOption(disorderOptions.value, selectedDisorderEffectId(event))
}

function selectedAnomalyEffectValue(event: any) {
  return selectedAnomalyEffectId(event) || anomalyOptions.value[0]?.value || "assault"
}

function selectedDisorderEffectValue(event: any) {
  return selectedDisorderEffectId(event) || disorderOptions.value[0]?.value || "burn"
}

function isKnownDisorderEffect(effectId: string) {
  return !effectId || !disorderOptions.value.length || disorderOptions.value.some((option: { value: string }) => String(option.value) === effectId)
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
      ...(event ?? { kind: "skillGroup", skillGroupId: "", count: 1 }),
      id,
    }
  }
  if (kind === "anomaly") {
    return { id, kind, settlementType: "attribute", anomalyEffect: anomalyOptions.value[0]?.value ?? "assault", procCount: 1, count: 1 }
  }
  if (kind === "disorder") {
    return { id, kind: "anomaly", settlementType: "disorder", disorderType: "normal", anomalyEffect: disorderOptions.value[0]?.value ?? "burn", elapsedSeconds: 0, count: 1 }
  }
  const selection = skillSelection()
  return {
    id,
    kind,
    ...(selection ? { skillRef: selection.skillRef } : {}),
    skillMultiplier: selection?.skillMultiplier ?? 100,
    critMode: "expected",
    count: 1,
  }
}

function addEvent(kind: string) {
  if (isAdminDefaultMode.value) {
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
  if (isAdminDefaultMode.value) {
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
  if (isAdminDefaultMode.value) {
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
  if (event.kind === "anomaly" && event.settlementType !== "disorder" && !event.anomalyEffect) {
    warnings.push("属性异常事件需要选择异常类型")
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
    const current = selectedDisorderEffectId(selectedEvent.value)
    const effectId = isKnownDisorderEffect(current) && current ? current : disorderOptions.value[0]?.value ?? "burn"
    updateSelectedEvent({
      settlementType: "disorder",
      anomalyEffect: effectId,
      previousAnomalyEffect: undefined,
      disorderType: selectedEvent.value?.disorderType ?? "normal",
      elapsedSeconds: selectedEvent.value?.elapsedSeconds ?? 0,
      procCount: undefined,
    }, { clearLabel: true })
    return
  }
  updateSelectedEvent({
    settlementType: "attribute",
    anomalyEffect: selectedAnomalyEffectId(selectedEvent.value) || anomalyOptions.value[0]?.value || "assault",
    previousAnomalyEffect: undefined,
    disorderType: undefined,
    elapsedSeconds: undefined,
    procCount: selectedEvent.value?.procCount ?? 1,
  }, { clearLabel: true })
}

function updateDisorderEffect(effectId: string) {
  updateSelectedEvent({
    anomalyEffect: effectId,
    previousAnomalyEffect: undefined,
  }, { clearLabel: true })
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
      events: JSON.parse(JSON.stringify(fallback.events ?? [])),
    })
    close()
    return
  }
  normalizeDraftSkillSelections()
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
    <div class="calculation-grid">
      <aside class="section-band">
        <label class="metric">
          <dt>计算方式</dt>
          <dd>
            <NSelect
              :value="draft.mode"
              :options="calculationModeOptions"
              @update:value="applyMode(String($event))"
            />
          </dd>
        </label>
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
                :class="{ active: isEventActive(event), readonly: isAdminDefaultMode }"
              >
                <button type="button" class="calculation-event-select" @click="selectEvent(event.id)">
                  <span class="calculation-event-order">#{{ index + 1 }}</span>
                  <span class="calculation-event-copy">
                    <strong>{{ eventTitle(event) }}</strong>
                    <small>次数 ×{{ event.count ?? 1 }}</small>
                  </span>
                </button>
                <div v-if="!isAdminDefaultMode" class="calculation-event-inline-actions">
                  <NButton size="tiny" @click="duplicateEvent(event.id)">复制</NButton>
                  <NButton size="tiny" type="error" @click="removeEvent(event.id)">删除</NButton>
                </div>
              </article>
            </div>
            <div v-else class="calculation-event-empty">还没有目标事件</div>
            <div v-if="!isAdminDefaultMode" class="toolbar calculation-add-toolbar">
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
            <NTag round>{{ damageEventKindLabel(selectedEvent) }}</NTag>
          </div>
          <div class="panel-body section-band">
            <div class="metric-grid calculation-editor-grid">
              <label class="metric calculation-editor-field calculation-editor-field-short">
                <dt>次数</dt>
                <dd>
                  <NInputNumber
                    :value="selectedEvent?.count ?? 1"
                    :min="selectedEventCountLimits().min"
                    :max="selectedEventCountLimits().max ?? undefined"
                    :step="selectedEventCountLimits().step"
                    :disabled="isAdminDefaultMode"
                    @update:value="updateSelectedEvent({ count: Number($event ?? 1) })"
                  />
                </dd>
              </label>
              <label v-if="selectedEvent?.kind === 'skillGroup'" class="metric calculation-editor-field calculation-editor-field-wide">
                <dt>技能组</dt>
                <dd><NSelect :value="selectedEvent?.skillGroupId" :options="skillGroupOptions" :disabled="isAdminDefaultMode" @update:value="updateSelectedSkillGroup(String($event))" /></dd>
              </label>
              <label v-if="selectedEvent?.kind === 'skillGroup'" class="metric calculation-editor-field calculation-editor-field-medium">
                <dt>组内事件</dt>
                <dd>{{ skillGroupEventCount(selectedSkillGroup()) }} 项</dd>
              </label>
              <label v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-medium">
                <dt>技能大类</dt>
                <dd><NSelect :value="selectedCategoryId(selectedEvent)" :options="skillCategoryOptions" :disabled="isAdminDefaultMode" @update:value="updateSkillCategory(String($event))" /></dd>
              </label>
              <label v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-wide">
                <dt>招式</dt>
                <dd><NSelect :value="selectedMoveId(selectedEvent)" :options="moveOptions(selectedEvent)" :disabled="isAdminDefaultMode" @update:value="updateSkillMove(String($event))" /></dd>
              </label>
              <label v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-wide">
                <dt>倍率行</dt>
                <dd><NSelect :value="selectedRowId(selectedEvent)" :options="rowOptions(selectedEvent)" :disabled="isAdminDefaultMode" @update:value="updateSkillRow(String($event))" /></dd>
              </label>
              <label v-if="['direct', 'sheer'].includes(selectedEvent?.kind) && !skillCategoryOptions.length" class="metric calculation-editor-field calculation-editor-field-medium">
                <dt>技能倍率%</dt>
                <dd><NInputNumber :value="selectedEvent?.skillMultiplier ?? 100" :min="0" :step="0.1" :disabled="isAdminDefaultMode" @update:value="updateSelectedEvent({ skillMultiplier: Number($event ?? 0) })" /></dd>
              </label>
              <label v-if="['direct', 'sheer'].includes(selectedEvent?.kind)" class="metric calculation-editor-field calculation-editor-field-short">
                <dt>暴击模式</dt>
                <dd>
                  <NSelect
                    :value="selectedEvent?.critMode ?? 'expected'"
                    :disabled="isAdminDefaultMode"
                    :options="[
                      { label: '期望', value: 'expected' },
                      { label: '暴击', value: 'crit' },
                      { label: '不暴击', value: 'nonCrit' },
                    ]"
                    @update:value="updateSelectedEvent({ critMode: $event })"
                  />
                </dd>
              </label>
              <label v-if="selectedEvent?.kind === 'anomaly'" class="metric calculation-editor-field calculation-editor-field-medium">
                <dt>结算</dt>
                <dd>
                  <NSelect
                    :value="selectedEvent?.settlementType ?? 'attribute'"
                    :disabled="isAdminDefaultMode"
                    :options="[{ label: '属性异常', value: 'attribute' }, { label: '紊乱结算', value: 'disorder' }]"
                    @update:value="updateAnomalySettlementType(String($event))"
                  />
                </dd>
              </label>
              <label v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder'" class="metric calculation-editor-field calculation-editor-field-wide">
                <dt>异常类型</dt>
                <dd><NSelect :value="selectedAnomalyEffectValue(selectedEvent)" :options="anomalyOptionsFor(selectedEvent)" :disabled="isAdminDefaultMode" @update:value="updateSelectedEvent({ anomalyEffect: $event }, { clearLabel: true })" /></dd>
              </label>
              <label v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.settlementType !== 'disorder'" class="metric calculation-editor-field calculation-editor-field-short">
                <dt>触发次数</dt>
                <dd><NInputNumber :value="selectedEvent?.procCount ?? 1" :min="0" :step="1" :disabled="isAdminDefaultMode" @update:value="updateSelectedEvent({ procCount: Number($event ?? 1) })" /></dd>
              </label>
              <label v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-wide">
                <dt>原异常</dt>
                <dd><NSelect :value="selectedDisorderEffectValue(selectedEvent)" :options="disorderOptionsFor(selectedEvent)" :disabled="isAdminDefaultMode" @update:value="updateDisorderEffect(String($event))" /></dd>
              </label>
              <label v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-medium">
                <dt>紊乱类型</dt>
                <dd><NSelect :value="selectedEvent?.disorderType ?? 'normal'" :options="[{ label: '普通紊乱', value: 'normal' }, { label: '极性紊乱', value: 'polarized' }]" :disabled="isAdminDefaultMode" @update:value="updateSelectedEvent({ disorderType: $event })" /></dd>
              </label>
              <label v-if="selectedEvent?.kind === 'disorder' || selectedEvent?.settlementType === 'disorder'" class="metric calculation-editor-field calculation-editor-field-short">
                <dt>已流逝秒数</dt>
                <dd><NInputNumber :value="selectedEvent?.elapsedSeconds ?? 0" :min="0" :step="0.1" :disabled="isAdminDefaultMode" @update:value="updateSelectedEvent({ elapsedSeconds: Number($event ?? 0) })" /></dd>
              </label>
            </div>
            <div v-if="eventWarnings.length" class="chip-row">
              <NTag v-for="warning in eventWarnings" :key="warning" type="warning" round>{{ warning }}</NTag>
            </div>
            <div v-if="['direct', 'sheer'].includes(selectedEvent?.kind)" class="toolbar">
              <NButton :disabled="isAdminDefaultMode" @click="showSkillPicker = true">选择技能倍率</NButton>
              <span class="muted">{{ selectedSkillSummary(selectedEvent) }}</span>
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
                    <small>组内次数 ×{{ eventCount(childEvent) }} · 当前合计 ×{{ skillGroupChildTotalCount(childEvent) }}</small>
                  </span>
                </li>
              </ol>
            </section>
          </div>
        </div>

      </section>
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
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
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

.calculation-editor-grid {
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.calculation-editor-field {
  min-width: 0;
  min-height: 86px;
}

.calculation-editor-field-short {
  grid-column: span 2;
}

.calculation-editor-field-medium {
  grid-column: span 3;
}

.calculation-editor-field-wide {
  grid-column: span 4;
}

.calculation-editor-field dd {
  min-width: 0;
}

.calculation-editor-field :deep(.n-select),
.calculation-editor-field :deep(.n-input-number) {
  width: 100%;
}

.calculation-editor-field :deep(.n-base-selection-label),
.calculation-editor-field :deep(.n-input-wrapper) {
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (max-width: 1180px) {
  .calculation-grid {
    grid-template-columns: 270px minmax(0, 1fr);
  }

  .calculation-editor-grid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }

  .calculation-editor-field-short,
  .calculation-editor-field-medium {
    grid-column: span 1;
  }

  .calculation-editor-field-wide {
    grid-column: 1 / -1;
  }
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
  align-items: center;
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
  align-items: center;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calculation-event-copy strong {
  font-size: 13px;
}

.calculation-event-copy small {
  color: var(--app-muted);
  font-size: 12px;
}

.calculation-event-inline-actions {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.calculation-event-empty {
  padding: 18px 12px;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius);
  color: var(--app-muted);
  text-align: center;
}

@media (max-width: 860px) {
  .calculation-grid {
    grid-template-columns: 1fr;
  }

  .calculation-editor-panel {
    min-height: 0;
  }

  .calculation-editor-grid {
    grid-template-columns: 1fr;
  }

  .calculation-editor-field-short,
  .calculation-editor-field-medium,
  .calculation-editor-field-wide {
    grid-column: 1 / -1;
  }

  .calculation-event-list {
    max-height: 360px;
  }

  .calculation-event-list-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .calculation-event-inline-actions {
    justify-content: flex-end;
  }
}
</style>
