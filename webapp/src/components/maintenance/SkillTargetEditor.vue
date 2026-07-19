<script setup lang="ts">
import { computed } from "vue"
import { NAlert, NButton, NSelect } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import {
  SKILL_TYPE_OPTIONS,
  SKILL_TAG_OPTIONS,
  agentSkillOptions,
  categoryForSkillType,
  defaultSkillTarget,
  rowOptions,
  skillTypeOptionsForSkill,
  specificMoveOptions,
} from "./maintenance-options"

const props = defineProps<{
  targets: any[]
  mode: "specific" | "skillType" | "skillTag"
  catalog: any
  disabled?: boolean
  preferredSkillId?: string
}>()
const emit = defineEmits<{ change: [] }>()

const legacyTargets = computed(() => props.targets.filter(target => !["specific", "skillType", "skillTag"].includes(target?.kind)))
const specificTargets = computed(() => props.targets.filter(target => target?.kind === "specific"))
const generalSkillTypes = computed(() => props.targets
  .filter(target => target?.kind === "skillType")
  .map(target => String(target.skillType ?? ""))
  .filter(Boolean))
const generalSkillTags = computed(() => props.targets
  .filter(target => target?.kind === "skillTag")
  .map(target => String(target.skillTag ?? ""))
  .filter(Boolean))

function addTarget() {
  props.targets.push(defaultSkillTarget(props.catalog, props.preferredSkillId))
  emit("change")
}

function removeTarget(target: any) {
  const index = props.targets.indexOf(target)
  if (index >= 0) props.targets.splice(index, 1)
  if (!specificTargets.value.length) props.targets.push(defaultSkillTarget(props.catalog, props.preferredSkillId))
  emit("change")
}

function clearLegacyTargets() {
  const next = props.mode === "skillType"
    ? [{ kind: "skillType", skillType: "basic" }]
    : props.mode === "skillTag"
      ? [{ kind: "skillTag", skillTag: "dashAttack" }]
      : [defaultSkillTarget(props.catalog, props.preferredSkillId)]
  props.targets.splice(0, props.targets.length, ...next)
  emit("change")
}

function changeSkill(target: any, value: string) {
  Object.assign(target, defaultSkillTarget(props.catalog, value))
  delete target.moveId
  delete target.rowId
  emit("change")
}

function changeSkillType(target: any, value: string) {
  target.skillType = value
  target.categoryId = categoryForSkillType(props.catalog, target.agentSkillId, value)?.id ?? ""
  delete target.moveId
  delete target.rowId
  emit("change")
}

function changeMove(target: any, value: string) {
  if (value) target.moveId = value
  else delete target.moveId
  delete target.rowId
  emit("change")
}

function changeRow(target: any, value: string) {
  if (value) target.rowId = value
  else delete target.rowId
  emit("change")
}

function changeGeneralSkillTypes(values: Array<string | number>) {
  const next = values.map(value => ({ kind: "skillType", skillType: String(value) }))
  props.targets.splice(0, props.targets.length, ...next)
  emit("change")
}

function changeGeneralSkillTags(values: Array<string | number>) {
  const next = values.map(value => ({ kind: "skillTag", skillTag: String(value) }))
  props.targets.splice(0, props.targets.length, ...next)
  emit("change")
}
</script>

<template>
  <div class="skill-target-editor">
    <NAlert v-if="legacyTargets.length" type="error" title="旧版招式目标无法识别">
      <NButton size="small" :disabled="disabled" @click="clearLegacyTargets">重新选择</NButton>
    </NAlert>

    <template v-if="mode === 'specific'">
      <article v-for="(target, index) in specificTargets" :key="`${target.agentSkillId}:${target.skillType}:${target.moveId ?? ''}:${index}`" class="skill-target-card">
        <div class="skill-target-specific-grid">
          <label class="maintenance-field" data-field-key="agentSkillId"><span>角色</span><NSelect filterable :consistent-menu-width="false" :value="target.agentSkillId" :options="agentSkillOptions(catalog)" :disabled="disabled" @update:value="changeSkill(target, String($event))" /></label>
          <label class="maintenance-field" data-field-key="skillType"><span>技能大类</span><NSelect :value="target.skillType" :options="skillTypeOptionsForSkill(catalog, target.agentSkillId)" :disabled="disabled" @update:value="changeSkillType(target, String($event))" /></label>
          <label class="maintenance-field" data-field-key="moveId"><span>招式</span><NSelect filterable :consistent-menu-width="false" :value="target.moveId ?? ''" :options="specificMoveOptions(catalog, target.agentSkillId, target.skillType)" :disabled="disabled" @update:value="changeMove(target, String($event))" /></label>
          <label v-if="target.moveId" class="maintenance-field" data-field-key="rowId"><span>倍率行</span><NSelect filterable :consistent-menu-width="false" :value="target.rowId ?? ''" :options="rowOptions(catalog, target.agentSkillId, target.categoryId, target.moveId, true)" :disabled="disabled" @update:value="changeRow(target, String($event))" /></label>
          <NButton class="skill-target-remove" quaternary type="error" :disabled="disabled" title="删除技能目标" @click="removeTarget(target)"><template #icon><Trash2 :size="16" /></template></NButton>
        </div>
      </article>
      <NButton size="small" :disabled="disabled" @click="addTarget"><template #icon><Plus :size="15" /></template>添加指定目标</NButton>
    </template>

    <label v-else-if="mode === 'skillType'" class="maintenance-field maintenance-field-wide" data-field-key="skillType">
      <span>技能大类</span>
      <NSelect multiple filterable :consistent-menu-width="false" :value="generalSkillTypes" :options="SKILL_TYPE_OPTIONS" :disabled="disabled" placeholder="请选择至少一个技能大类" @update:value="changeGeneralSkillTypes($event)" />
    </label>
    <label v-else class="maintenance-field maintenance-field-wide" data-field-key="skillTag">
      <span>招式标签</span>
      <NSelect multiple filterable :consistent-menu-width="false" :value="generalSkillTags" :options="SKILL_TAG_OPTIONS" :disabled="disabled" placeholder="请选择至少一个招式标签" @update:value="changeGeneralSkillTags($event)" />
    </label>
  </div>
</template>
