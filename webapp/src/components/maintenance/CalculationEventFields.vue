<script setup lang="ts">
import { NInput, NInputNumber, NSelect, NSwitch } from "naive-ui"
import {
  ANOMALY_VARIANT_OPTIONS, CALCULATION_DAMAGE_BASIS_OPTIONS, CRIT_MODE_OPTIONS, DAMAGE_ELEMENT_OPTIONS, DIRECT_DAMAGE_ELEMENT_OPTIONS, DISORDER_TYPE_OPTIONS, EVENT_KIND_OPTIONS, EVENT_SOURCE_OPTIONS,
  anomalyOptions, categoryOptions, defaultCalculationEvent, moveOptions, option, rowOptions,
} from "./maintenance-options"
import { textOf } from "./maintenance-model"
import { disorderElapsedStepSeconds, normalizeElapsedSeconds } from "@core/damageEventMultipliers.js"
import { anomalyReleaseProfiles } from "@core/anomalyRelease.js"
import LuminescenceEventEditor from "@/components/LuminescenceEventEditor.vue"

const props = withDefaults(defineProps<{
  event: any
  catalog: any
  agent: any
  skillGroups?: any[]
  disabled?: boolean
  allowSkillGroup?: boolean
  potentialLevel?: number | null
}>(), { skillGroups: () => [], allowSkillGroup: true, potentialLevel: null })
const emit = defineEmits<{ change: [] }>()

function agentSkill() {
  return (props.catalog?.agentSkills?.agentSkills ?? []).find((skill: any) => skill.agentId === props.agent?.id)
}

function visibleKind() {
  if (props.event.kind === "skillGroup") return "skillGroup"
  if (props.event.kind === "direct" || props.event.kind === "sheer") return props.event.kind
  return props.event.kind === "disorder" || props.event.settlementType === "disorder"
    ? "disorder"
    : props.event.settlementType === "release"
      ? "release"
      : props.event.settlementType === "luminescence" ? "luminescence" : "anomaly"
}

function sourceOf() {
  return props.event.skillRef ? "skill" : "manual"
}

function manualDamageElementOptions() {
  return visibleKind() === "direct" ? DIRECT_DAMAGE_ELEMENT_OPTIONS : DAMAGE_ELEMENT_OPTIONS
}

function defaultManualDamageElement() {
  const preferred = String(props.agent?.damageElement || props.agent?.attribute || "physical")
  return manualDamageElementOptions().some(option => option.value === preferred) ? preferred : "physical"
}

function newSkillRef() {
  const skill = agentSkill()
  const categoryId = String(categoryOptions(props.catalog, skill?.id ?? "", props.potentialLevel)[0]?.value ?? "")
  const moveId = String(moveOptions(props.catalog, skill?.id ?? "", categoryId, false, props.potentialLevel)[0]?.value ?? "")
  const rowId = String(rowOptions(props.catalog, skill?.id ?? "", categoryId, moveId, false, props.potentialLevel)[0]?.value ?? "")
  return { agentSkillId: skill?.id ?? "", categoryId, moveId, rowId }
}

function changeKind(kind: string) {
  const id = props.event.id
  const next = defaultCalculationEvent(kind)
  Object.keys(props.event).forEach(key => delete props.event[key])
  Object.assign(props.event, next, { id })
  if (kind === "release") {
    const profile = anomalyReleaseProfiles(props.agent)[0]
    props.event.triggerActorRef = { agentId: props.agent?.id ?? "", profileId: profile?.id ?? "" }
    props.event.anomalySource = { actorRef: { agentId: props.agent?.id ?? "" } }
  }
  if (kind === "luminescence") {
    props.event.triggerActorRef = { agentId: props.agent?.id ?? "" }
  }
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
    props.event.damageElement ??= defaultManualDamageElement()
  }
  emit("change")
}

function changeCategory(value: string) {
  props.event.skillRef.categoryId = value
  props.event.skillRef.moveId = String(moveOptions(props.catalog, props.event.skillRef.agentSkillId, value, false, props.potentialLevel)[0]?.value ?? "")
  props.event.skillRef.rowId = String(rowOptions(props.catalog, props.event.skillRef.agentSkillId, value, props.event.skillRef.moveId, false, props.potentialLevel)[0]?.value ?? "")
  applySelectedRowCountRange()
  emit("change")
}

function changeMove(value: string) {
  props.event.skillRef.moveId = value
  props.event.skillRef.rowId = String(rowOptions(props.catalog, props.event.skillRef.agentSkillId, props.event.skillRef.categoryId, value, false, props.potentialLevel)[0]?.value ?? "")
  applySelectedRowCountRange()
  emit("change")
}

function selectedSkillRow() {
  const skill = agentSkill()
  const category = (skill?.categories ?? []).find((item: any) => item.id === props.event.skillRef?.categoryId)
  const move = (category?.moves ?? []).find((item: any) => item.id === props.event.skillRef?.moveId)
  return (move?.rows ?? []).find((item: any) => item.id === props.event.skillRef?.rowId) ?? null
}

function eventCountRange() {
  return selectedSkillRow()?.eventCountRange ?? null
}

function applySelectedRowCountRange() {
  const range = eventCountRange()
  if (!range) return
  const value = Number(props.event.count)
  props.event.count = Number.isInteger(value) && value >= Number(range.min) && value <= Number(range.max)
    ? value
    : Number(range.default)
}

function changeRow(value: string) {
  props.event.skillRef.rowId = value
  applySelectedRowCountRange()
  emit("change")
}

function groupOptions() {
  return props.skillGroups.map(group => option(group.id, textOf(group.name) || "未命名技能组"))
}

function releaseProfileOptions() {
  return anomalyReleaseProfiles(props.agent).map((profile: any) => option(profile.id, textOf(profile.name) || profile.id))
}

function eventKindOptions() {
  return EVENT_KIND_OPTIONS
    .filter(item => props.allowSkillGroup || !["skillGroup", "luminescence"].includes(String(item.value)))
    .map(item => {
      if (item.value === "release" && !anomalyReleaseProfiles(props.agent).length) {
        return { ...item, disabled: true, label: "异放（暂不支持）" }
      }
      if (item.value === "luminescence" && props.agent?.id !== "remielle_dan") {
        return { ...item, disabled: true, label: "耀变（仅丹）" }
      }
      return item
    })
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
    <label class="maintenance-field"><span>类型</span><NSelect :value="visibleKind()" :options="eventKindOptions()" :disabled="disabled" @update:value="changeKind(String($event))" /></label>
    <label v-if="visibleKind() !== 'luminescence'" class="maintenance-field"><span>次数</span><NInputNumber v-model:value="event.count" :disabled="disabled" :min="eventCountRange()?.min ?? 0" :max="eventCountRange()?.max" :step="1" @update:value="emit('change')" /></label>
    <label v-if="visibleKind() !== 'luminescence'" class="maintenance-switch-field"><span>是否失衡</span><NSwitch :value="event.stunned !== false" :disabled="disabled" @update:value="updateStunned(Boolean($event))"><template #checked>是</template><template #unchecked>否</template></NSwitch></label>
    <label v-if="!['skillGroup', 'luminescence'].includes(visibleKind())" class="maintenance-field"><span>伤害比例%</span><NInputNumber v-model:value="event.damageRatioPct" :disabled="disabled" :min="0" :step="0.1" placeholder="100" @update:value="emit('change')" /></label>
    <label v-if="visibleKind() === 'skillGroup'" class="maintenance-field"><span>技能组</span><NSelect v-model:value="event.skillGroupId" :options="groupOptions()" :disabled="disabled" @update:value="emit('change')" /></label>

    <template v-if="['direct', 'sheer'].includes(visibleKind())">
      <label class="maintenance-field"><span>伤害来源</span><NSelect :value="sourceOf()" :options="EVENT_SOURCE_OPTIONS" :disabled="disabled" @update:value="changeSource(String($event))" /></label>
      <template v-if="event.skillRef">
        <label class="maintenance-field"><span>技能大类</span><NSelect filterable :value="event.skillRef.categoryId" :options="categoryOptions(catalog, event.skillRef.agentSkillId, potentialLevel)" :disabled="disabled" @update:value="changeCategory(String($event))" /></label>
        <label class="maintenance-field"><span>招式</span><NSelect filterable :value="event.skillRef.moveId" :options="moveOptions(catalog, event.skillRef.agentSkillId, event.skillRef.categoryId, false, potentialLevel)" :disabled="disabled" @update:value="changeMove(String($event))" /></label>
        <label class="maintenance-field"><span>倍率行</span><NSelect filterable :value="event.skillRef.rowId" :options="rowOptions(catalog, event.skillRef.agentSkillId, event.skillRef.categoryId, event.skillRef.moveId, false, potentialLevel)" :disabled="disabled" @update:value="changeRow(String($event))" /></label>
      </template>
      <template v-else>
        <label class="maintenance-field"><span>事件名称</span><NInput v-model:value="event.label" :disabled="disabled" placeholder="额外能力：落雷" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>手填倍率%</span><NInputNumber v-model:value="event.skillMultiplier" :disabled="disabled" :min="0" :step="0.1" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>伤害属性</span><NSelect v-model:value="event.damageElement" :options="manualDamageElementOptions()" :disabled="disabled" @update:value="emit('change')" /></label>
      </template>
      <label class="maintenance-field"><span>暴击模式</span><NSelect v-model:value="event.critMode" :options="CRIT_MODE_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="!event.skillRef && visibleKind() === 'direct'" class="maintenance-field"><span>伤害基础值</span><NSelect v-model:value="event.damageBasis" :options="CALCULATION_DAMAGE_BASIS_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
    </template>

    <template v-if="visibleKind() === 'anomaly'">
      <label class="maintenance-field"><span>异常类型</span><NSelect filterable v-model:value="event.anomalyEffect" :options="anomalyOptions(catalog)" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>异常形态</span><NSelect v-model:value="event.anomalyVariant" :options="ANOMALY_VARIANT_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>结算次数</span><NInputNumber v-model:value="event.procCount" :disabled="disabled" :min="0" :step="1" @update:value="emit('change')" /></label>
    </template>
    <template v-if="visibleKind() === 'release'">
      <label class="maintenance-field"><span>原异常</span><NSelect filterable v-model:value="event.anomalyEffect" :options="anomalyOptions(catalog)" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>倍率方案</span><NSelect v-model:value="event.triggerActorRef.profileId" :options="releaseProfileOptions()" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>异放触发者</span><NInput :value="textOf(agent?.name)" disabled /></label>
      <label class="maintenance-field"><span>原异常施加者</span><NInput :value="textOf(agent?.name)" disabled /></label>
    </template>
    <LuminescenceEventEditor
      v-if="visibleKind() === 'luminescence'"
      class="maintenance-luminescence-editor"
      :event="event"
      :agent="agent"
      :cinema-level="Number(event.cinemaLevel ?? 0)"
      :core-skill-level="event.coreSkillLevel ?? 'F'"
      :disabled="disabled"
      @update="Object.assign(event, $event); emit('change')"
    />
    <template v-if="visibleKind() === 'disorder'">
      <label class="maintenance-field"><span>紊乱类型</span><NSelect v-model:value="event.disorderType" :options="DISORDER_TYPE_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>原异常</span><NSelect filterable :value="event.anomalyEffect" :options="anomalyOptions(catalog, true)" :disabled="disabled" @update:value="updateDisorderEffect(String($event))" /></label>
      <label class="maintenance-field"><span>已生效秒数</span><NInputNumber :key="`elapsed-${event.anomalyEffect ?? event.previousAnomalyEffect ?? 'unknown'}`" :value="event.elapsedSeconds" :disabled="disabled" :min="0" :step="elapsedStep()" :precision="elapsedPrecision()" @update:value="updateElapsedSeconds" /></label>
    </template>
  </div>
</template>

<style scoped>
.maintenance-luminescence-editor { grid-column: 1 / -1; }
</style>
