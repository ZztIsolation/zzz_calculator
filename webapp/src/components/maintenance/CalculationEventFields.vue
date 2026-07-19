<script setup lang="ts">
import { NInput, NInputNumber, NSelect, NSwitch } from "naive-ui"
import {
  ANOMALY_VARIANT_OPTIONS, CALCULATION_DAMAGE_BASIS_OPTIONS, CRIT_MODE_OPTIONS, DAMAGE_ELEMENT_OPTIONS, DISORDER_TYPE_OPTIONS, EVENT_KIND_OPTIONS, EVENT_SOURCE_OPTIONS,
  anomalyOptions, categoryOptions, defaultCalculationEvent, moveOptions, option, rowOptions,
} from "./maintenance-options"
import { textOf } from "./maintenance-model"
import { disorderElapsedStepSeconds, normalizeElapsedSeconds } from "@core/damageEventMultipliers.js"

const props = withDefaults(defineProps<{
  event: any
  catalog: any
  agent: any
  skillGroups?: any[]
  disabled?: boolean
  allowSkillGroup?: boolean
}>(), { skillGroups: () => [], allowSkillGroup: true })
const emit = defineEmits<{ change: [] }>()

function agentSkill() {
  return (props.catalog?.agentSkills?.agentSkills ?? []).find((skill: any) => skill.agentId === props.agent?.id)
}

function visibleKind() {
  if (props.event.kind === "skillGroup") return "skillGroup"
  if (props.event.kind === "direct" || props.event.kind === "sheer") return props.event.kind
  return props.event.kind === "disorder" || props.event.settlementType === "disorder" ? "disorder" : "anomaly"
}

function sourceOf() {
  return props.event.skillRef ? "skill" : "manual"
}

function newSkillRef() {
  const skill = agentSkill()
  const category = skill?.categories?.[0]
  const move = category?.moves?.[0]
  const row = move?.rows?.[0]
  return { agentSkillId: skill?.id ?? "", categoryId: category?.id ?? "", moveId: move?.id ?? "", rowId: row?.id ?? "" }
}

function changeKind(kind: string) {
  const id = props.event.id
  const next = defaultCalculationEvent(kind)
  Object.keys(props.event).forEach(key => delete props.event[key])
  Object.assign(props.event, next, { id })
  if (["direct", "sheer"].includes(kind) && agentSkill()) {
    delete props.event.__source
    delete props.event.skillMultiplier
    delete props.event.damageElement
    props.event.skillRef = newSkillRef()
  }
  emit("change")
}

function changeSource(source: string) {
  if (source === "skill") {
    props.event.skillRef = newSkillRef()
    delete props.event.skillMultiplier
    delete props.event.damageElement
    delete props.event.label
  } else {
    delete props.event.skillRef
    props.event.skillMultiplier ??= 100
    props.event.damageElement ??= props.agent?.damageElement || props.agent?.attribute || "physical"
  }
  emit("change")
}

function changeCategory(value: string) {
  props.event.skillRef.categoryId = value
  props.event.skillRef.moveId = String(moveOptions(props.catalog, props.event.skillRef.agentSkillId, value)[0]?.value ?? "")
  props.event.skillRef.rowId = String(rowOptions(props.catalog, props.event.skillRef.agentSkillId, value, props.event.skillRef.moveId)[0]?.value ?? "")
  emit("change")
}

function changeMove(value: string) {
  props.event.skillRef.moveId = value
  props.event.skillRef.rowId = String(rowOptions(props.catalog, props.event.skillRef.agentSkillId, props.event.skillRef.categoryId, value)[0]?.value ?? "")
  emit("change")
}

function groupOptions() {
  return props.skillGroups.map(group => option(group.id, textOf(group.name) || "未命名技能组"))
}

function elapsedStep() {
  return disorderElapsedStepSeconds(props.event, props.catalog)
}

function elapsedPrecision() {
  return Number.isInteger(elapsedStep()) ? 0 : 1
}

function updateElapsedSeconds(value: unknown) {
  props.event.elapsedSeconds = normalizeElapsedSeconds(value, Number.POSITIVE_INFINITY, elapsedStep())
  emit("change")
}

function updateDisorderEffect(value: string) {
  props.event.anomalyEffect = value
  delete props.event.previousAnomalyEffect
  props.event.elapsedSeconds = normalizeElapsedSeconds(props.event.elapsedSeconds, Number.POSITIVE_INFINITY, elapsedStep())
  emit("change")
}

function updateStunned(value: boolean) {
  props.event.stunned = Boolean(value)
  emit("change")
}
</script>

<template>
  <div class="calculation-event-grid">
    <label class="maintenance-field"><span>类型</span><NSelect :value="visibleKind()" :options="allowSkillGroup ? EVENT_KIND_OPTIONS : EVENT_KIND_OPTIONS.filter(item => item.value !== 'skillGroup')" :disabled="disabled" @update:value="changeKind(String($event))" /></label>
    <label class="maintenance-field"><span>次数</span><NInputNumber v-model:value="event.count" :disabled="disabled" :min="0" :step="1" @update:value="emit('change')" /></label>
    <label class="maintenance-switch-field"><span>是否失衡</span><NSwitch :value="event.stunned !== false" :disabled="disabled" @update:value="updateStunned(Boolean($event))"><template #checked>是</template><template #unchecked>否</template></NSwitch></label>
    <label v-if="visibleKind() !== 'skillGroup'" class="maintenance-field"><span>伤害比例%</span><NInputNumber v-model:value="event.damageRatioPct" :disabled="disabled" :min="0" :step="0.1" placeholder="100" @update:value="emit('change')" /></label>
    <label v-if="visibleKind() === 'skillGroup'" class="maintenance-field"><span>技能组</span><NSelect v-model:value="event.skillGroupId" :options="groupOptions()" :disabled="disabled" @update:value="emit('change')" /></label>

    <template v-if="['direct', 'sheer'].includes(visibleKind())">
      <label class="maintenance-field"><span>伤害来源</span><NSelect :value="sourceOf()" :options="EVENT_SOURCE_OPTIONS" :disabled="disabled" @update:value="changeSource(String($event))" /></label>
      <template v-if="event.skillRef">
        <label class="maintenance-field"><span>技能大类</span><NSelect filterable :value="event.skillRef.categoryId" :options="categoryOptions(catalog, event.skillRef.agentSkillId)" :disabled="disabled" @update:value="changeCategory(String($event))" /></label>
        <label class="maintenance-field"><span>招式</span><NSelect filterable :value="event.skillRef.moveId" :options="moveOptions(catalog, event.skillRef.agentSkillId, event.skillRef.categoryId)" :disabled="disabled" @update:value="changeMove(String($event))" /></label>
        <label class="maintenance-field"><span>倍率行</span><NSelect filterable v-model:value="event.skillRef.rowId" :options="rowOptions(catalog, event.skillRef.agentSkillId, event.skillRef.categoryId, event.skillRef.moveId)" :disabled="disabled" @update:value="emit('change')" /></label>
      </template>
      <template v-else>
        <label class="maintenance-field"><span>事件名称</span><NInput v-model:value="event.label" :disabled="disabled" placeholder="额外能力：落雷" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>手填倍率%</span><NInputNumber v-model:value="event.skillMultiplier" :disabled="disabled" :min="0" :step="0.1" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>伤害属性</span><NSelect v-model:value="event.damageElement" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      </template>
      <label class="maintenance-field"><span>暴击模式</span><NSelect v-model:value="event.critMode" :options="CRIT_MODE_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="!event.skillRef && visibleKind() === 'direct'" class="maintenance-field"><span>伤害基础值</span><NSelect v-model:value="event.damageBasis" :options="CALCULATION_DAMAGE_BASIS_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
    </template>

    <template v-if="visibleKind() === 'anomaly'">
      <label class="maintenance-field"><span>异常类型</span><NSelect filterable v-model:value="event.anomalyEffect" :options="anomalyOptions(catalog)" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="event.anomalyEffect === 'assault'" class="maintenance-field"><span>强击形态</span><NSelect v-model:value="event.anomalyVariant" :options="ANOMALY_VARIANT_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>结算次数</span><NInputNumber v-model:value="event.procCount" :disabled="disabled" :min="0" :step="1" @update:value="emit('change')" /></label>
    </template>
    <template v-if="visibleKind() === 'disorder'">
      <label class="maintenance-field"><span>紊乱类型</span><NSelect v-model:value="event.disorderType" :options="DISORDER_TYPE_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>原异常</span><NSelect filterable :value="event.anomalyEffect" :options="anomalyOptions(catalog, true)" :disabled="disabled" @update:value="updateDisorderEffect(String($event))" /></label>
      <label class="maintenance-field"><span>已生效秒数</span><NInputNumber :key="`elapsed-${event.anomalyEffect ?? event.previousAnomalyEffect ?? 'unknown'}`" :value="event.elapsedSeconds" :disabled="disabled" :min="0" :step="elapsedStep()" :precision="elapsedPrecision()" @update:value="updateElapsedSeconds" /></label>
    </template>
  </div>
</template>
