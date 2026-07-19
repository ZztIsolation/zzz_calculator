<script setup lang="ts">
import { computed } from "vue"
import { NButton, NTag } from "naive-ui"
import { Copy, Plus, Trash2 } from "lucide-vue-next"
import CalculationEventFields from "./CalculationEventFields.vue"
import {
  EVENT_KIND_OPTIONS, anomalyOptions, defaultCalculationEvent, moveOptions, option, rowOptions,
} from "./maintenance-options"
import { internalId, textOf } from "./maintenance-model"

const props = withDefaults(defineProps<{
  events: any[]
  catalog: any
  agent: any
  skillGroups?: any[]
  disabled?: boolean
  allowSkillGroup?: boolean
  layout?: "cards" | "master-detail"
  selectedEventId?: string | null
}>(), { skillGroups: () => [], allowSkillGroup: true, layout: "cards", selectedEventId: null })
const emit = defineEmits<{ change: [], "update:selectedEventId": [value: string | null] }>()

const selectedEvent = computed(() => props.events.find(event => event.id === props.selectedEventId) ?? props.events[0] ?? null)

function agentSkill() {
  return (props.catalog?.agentSkills?.agentSkills ?? []).find((skill: any) => skill.agentId === props.agent?.id)
}

function preferredSkillId() {
  return agentSkill()?.id ?? ""
}

function newSkillRef() {
  const skill = agentSkill()
  const category = skill?.categories?.[0]
  const move = category?.moves?.[0]
  const row = move?.rows?.[0]
  return { agentSkillId: skill?.id ?? "", categoryId: category?.id ?? "", moveId: move?.id ?? "", rowId: row?.id ?? "" }
}

function add(kind: string) {
  const event = defaultCalculationEvent(kind)
  if (["direct", "sheer"].includes(kind) && preferredSkillId()) {
    delete event.__source
    delete event.skillMultiplier
    delete event.damageElement
    event.skillRef = newSkillRef()
  }
  props.events.push(event)
  emit("update:selectedEventId", event.id)
  emit("change")
}

function duplicate(eventId: string) {
  const index = props.events.findIndex(event => event.id === eventId)
  if (index < 0) return
  const copy = JSON.parse(JSON.stringify(props.events[index]))
  copy.id = internalId("event")
  props.events.splice(index + 1, 0, copy)
  emit("update:selectedEventId", copy.id)
  emit("change")
}

function remove(index: number) {
  if (props.events.length <= 1) return
  const selectedId = props.selectedEventId
  props.events.splice(index, 1)
  const selectedStillExists = props.events.some(event => event.id === selectedId)
  const next = selectedStillExists
    ? props.events.find(event => event.id === selectedId)
    : props.events[Math.min(index, props.events.length - 1)] ?? null
  emit("update:selectedEventId", next?.id ?? null)
  emit("change")
}

function groupOptions() {
  return props.skillGroups.map(group => option(group.id, textOf(group.name) || "未命名技能组"))
}

function visibleKind(event: any) {
  if (event.kind === "skillGroup") return "skillGroup"
  if (event.kind === "direct" || event.kind === "sheer") return event.kind
  return event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "anomaly"
}

function eventTitle(event: any, index: number) {
  const kind = EVENT_KIND_OPTIONS.find(item => item.value === visibleKind(event))?.label ?? "计算事件"
  if (event.kind === "skillGroup") return `${kind} · ${groupOptions().find(item => item.value === event.skillGroupId)?.label ?? `事件 ${index + 1}`}`
  if (event.skillRef) {
    const move = moveOptions(props.catalog, event.skillRef.agentSkillId, event.skillRef.categoryId).find((item: any) => item.value === event.skillRef.moveId)?.label
    const row = rowOptions(props.catalog, event.skillRef.agentSkillId, event.skillRef.categoryId, event.skillRef.moveId).find((item: any) => item.value === event.skillRef.rowId)?.label
    return [kind, move, row].filter(Boolean).join(" · ")
  }
  if (event.anomalyEffect) {
    const label = [...anomalyOptions(props.catalog), ...anomalyOptions(props.catalog, true)].find(item => item.value === event.anomalyEffect)?.label
    return [kind, label].filter(Boolean).join(" · ")
  }
  if (event.label) return `${kind} · ${textOf(event.label)}`
  return `${kind} · 事件 ${index + 1}`
}

function eventIndex(event: any) {
  return props.events.findIndex(item => item.id === event?.id)
}
</script>

<template>
  <div v-if="layout === 'cards'" class="calculation-events-editor">
    <div class="maintenance-action-row">
      <NButton size="small" :disabled="disabled" @click="add('direct')"><template #icon><Plus :size="14" /></template>添加直伤</NButton>
      <NButton size="small" :disabled="disabled" @click="add('sheer')">添加贯穿</NButton>
      <NButton size="small" :disabled="disabled" @click="add('anomaly')">添加属性异常</NButton>
      <NButton size="small" :disabled="disabled" @click="add('disorder')">添加紊乱</NButton>
      <NButton v-if="allowSkillGroup" size="small" :disabled="disabled || !skillGroups.length" @click="add('skillGroup')">添加技能组</NButton>
    </div>
    <article v-for="(event, index) in events" :key="event.id ?? index" class="maintenance-subcard calculation-event-card">
      <header class="maintenance-row-head calculation-event-head"><strong>{{ eventTitle(event, index) }}</strong><NButton quaternary type="error" :disabled="disabled" title="删除计算事件" @click="events.splice(index, 1); emit('change')"><template #icon><Trash2 :size="16" /></template></NButton></header>
      <CalculationEventFields :event="event" :catalog="catalog" :agent="agent" :skill-groups="skillGroups" :disabled="disabled" :allow-skill-group="allowSkillGroup" @change="emit('change')" />
    </article>
  </div>

  <div v-else class="calculation-events-editor calculation-master-grid" data-layout-surface="maintenance-calculation-events">
    <aside class="calculation-master-sidebar">
      <slot name="sidebar-top" />
      <section class="calculation-master-list-panel">
        <header class="calculation-master-panel-head"><h4>目标事件</h4><NTag round>{{ events.length }} 项</NTag></header>
        <div v-if="events.length" class="calculation-event-list">
          <article v-for="(event, index) in events" :key="event.id ?? index" class="calculation-event-list-item" :class="{ active: selectedEvent?.id === event.id }">
            <button type="button" class="calculation-event-select" @click="emit('update:selectedEventId', event.id)">
              <span class="calculation-event-order">#{{ index + 1 }}</span>
              <span class="calculation-event-copy"><strong>{{ eventTitle(event, index) }}</strong><small>次数 ×{{ event.count ?? 1 }}</small></span>
            </button>
            <div class="calculation-event-inline-actions">
              <NButton circle quaternary size="tiny" :disabled="disabled" title="复制目标事件" aria-label="复制目标事件" @click="duplicate(event.id)"><template #icon><Copy :size="14" /></template></NButton>
              <NButton circle quaternary size="tiny" type="error" :disabled="disabled || events.length <= 1" title="删除目标事件" aria-label="删除目标事件" @click="remove(index)"><template #icon><Trash2 :size="14" /></template></NButton>
            </div>
          </article>
        </div>
        <div v-else class="calculation-event-empty">还没有目标事件</div>
        <div class="calculation-add-toolbar">
          <NButton size="small" :disabled="disabled" @click="add('direct')">添加技能</NButton>
          <NButton size="small" :disabled="disabled" @click="add('sheer')">添加贯穿</NButton>
          <NButton size="small" :disabled="disabled" @click="add('anomaly')">添加异常</NButton>
          <NButton size="small" :disabled="disabled" @click="add('disorder')">添加紊乱</NButton>
          <NButton v-if="allowSkillGroup" size="small" :disabled="disabled || !skillGroups.length" @click="add('skillGroup')">添加技能组</NButton>
        </div>
      </section>
    </aside>

    <section class="calculation-master-editor-panel">
      <header class="calculation-master-panel-head">
        <h4>{{ selectedEvent ? eventTitle(selectedEvent, eventIndex(selectedEvent)) : "事件详情" }}</h4>
        <NTag v-if="selectedEvent" round>{{ EVENT_KIND_OPTIONS.find(item => item.value === visibleKind(selectedEvent))?.label }}</NTag>
      </header>
      <div v-if="selectedEvent" class="calculation-master-editor-body">
        <CalculationEventFields :event="selectedEvent" :catalog="catalog" :agent="agent" :skill-groups="skillGroups" :disabled="disabled" :allow-skill-group="allowSkillGroup" @change="emit('change')" />
      </div>
      <div v-else class="calculation-event-empty">从左侧添加一个事件开始配置</div>
    </section>
  </div>
</template>

<style scoped>
.calculation-master-grid { display: grid; height: 100%; min-height: 0; grid-template-columns: 340px minmax(0, 1fr); align-items: stretch; gap: 16px; margin-top: 0; }
.calculation-master-sidebar { display: grid; height: 100%; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
.calculation-master-list-panel, .calculation-master-editor-panel { min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; }
.calculation-master-list-panel { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.calculation-master-editor-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); }
.calculation-master-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-height: 56px; padding: 14px 16px; border-bottom: 1px solid var(--app-border); }
.calculation-master-panel-head h4 { min-width: 0; margin: 0; overflow-wrap: anywhere; font-size: 15px; line-height: 1.45; }
.calculation-event-list { display: grid; min-height: 0; align-content: start; gap: 8px; padding: 12px; overflow: auto; }
.calculation-event-list-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 6px; padding: 8px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; }
.calculation-event-list-item.active { border-color: var(--app-blue); background: #eff6ff; }
.calculation-event-select { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.calculation-event-order { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; border-radius: 999px; background: var(--app-surface); color: var(--app-muted); font-size: 12px; font-weight: 700; }
.calculation-event-copy { min-width: 0; }
.calculation-event-copy strong, .calculation-event-copy small { display: block; min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.calculation-event-copy strong { font-size: 13px; line-height: 1.45; }
.calculation-event-copy small { margin-top: 3px; color: var(--app-muted); font-size: 12px; }
.calculation-event-inline-actions { display: grid; grid-template-columns: repeat(2, 28px); gap: 3px; }
.calculation-event-inline-actions :deep(.n-button) { width: 28px; height: 28px; padding: 0; }
.calculation-add-toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0 12px 12px; }
.calculation-add-toolbar :deep(.n-button) { min-width: 0; }
.calculation-master-editor-body { min-height: 0; padding: 16px; overflow: auto; }
.calculation-master-editor-body :deep(.calculation-event-grid) { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
.calculation-event-empty { margin: 12px; padding: 24px 12px; border: 1px dashed var(--app-border); border-radius: var(--app-radius-sm); color: var(--app-muted); text-align: center; }
@container ui-layout (max-width: 860px) {
  .calculation-master-grid { height: auto; grid-template-columns: 1fr; }
  .calculation-master-sidebar { height: auto; }
  .calculation-master-list-panel { grid-template-rows: auto auto auto; }
  .calculation-master-editor-panel { grid-template-rows: auto auto; }
  .calculation-event-list { max-height: 320px; }
  .calculation-master-editor-body { overflow: visible; }
  .calculation-master-editor-body :deep(.calculation-event-grid) { grid-template-columns: 1fr; }
}
</style>
