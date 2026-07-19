<script setup lang="ts">
import { NInput, NInputNumber, NSelect, NSwitch } from "naive-ui"
import EffectRulesEditor from "./EffectRulesEditor.vue"
import BuffModifiersEditor from "./BuffModifiersEditor.vue"
import { SCOPE_OPTIONS, conditionOptions } from "./maintenance-options"
import { textOf } from "./maintenance-model"

const props = withDefaults(defineProps<{
  model: any
  catalog: any
  disabled?: boolean
  showScope?: boolean
  showCondition?: boolean
  showDuration?: boolean
  showEffectText?: boolean
  showPanelToggle?: boolean
  allowCoverage?: boolean
  allowModificationValues?: boolean
  preferredSkillId?: string
}>(), {
  showScope: false,
  showCondition: false,
  showDuration: false,
  showEffectText: false,
  showPanelToggle: false,
  allowCoverage: true,
  allowModificationValues: false,
  preferredSkillId: "",
})
const emit = defineEmits<{ change: [] }>()

function setScope(value: string) {
  props.model.scope = value
  if (value !== "inCombat") {
    for (const rule of props.model.effects ?? []) delete rule.coverage
  }
  emit("change")
}
</script>

<template>
  <div class="buff-effect-set-editor">
    <div v-if="showScope || showCondition || showDuration || showPanelToggle" class="maintenance-grid buff-meta-grid">
      <label v-if="showScope" class="maintenance-field"><span>生效范围</span><NSelect :value="model.scope" :options="SCOPE_OPTIONS" :disabled="disabled" @update:value="setScope(String($event))" /></label>
      <label v-if="showCondition" class="maintenance-field maintenance-field-wide"><span>触发条件</span><NSelect tag filterable clearable :consistent-menu-width="false" v-model:value="model.condition" :options="conditionOptions(model.condition ?? '')" :disabled="disabled" placeholder="选择现有条件或输入中文条件" @update:value="emit('change')" /></label>
      <label v-if="showDuration" class="maintenance-field"><span>持续秒数</span><NInputNumber v-model:value="model.durationSeconds" :disabled="disabled" :min="0" :step="0.1" clearable @update:value="emit('change')" /></label>
      <label v-if="showPanelToggle" class="maintenance-switch-field"><span>应用于局外面板</span><NSwitch :value="model.appliesToOutOfCombatPanel === true" :disabled="disabled" @update:value="model.appliesToOutOfCombatPanel = $event; emit('change')" /></label>
    </div>
    <div v-if="showEffectText" class="maintenance-grid buff-effect-text-grid">
      <label class="maintenance-field maintenance-field-wide"><span>分段效果文案</span><NInput type="textarea" :value="textOf(model.effectText)" :disabled="disabled" @update:value="model.effectText = { ...model.effectText, zhCN: String($event) }; emit('change')" /></label>
      <label v-if="model.effectText?.en" class="maintenance-field maintenance-field-wide"><span>分段效果英文文案</span><NInput type="textarea" :value="model.effectText.en" :disabled="disabled" @update:value="model.effectText = { ...model.effectText, en: String($event) }; emit('change')" /></label>
    </div>
    <EffectRulesEditor :model="model" :catalog="catalog" :disabled="disabled" :allow-coverage="allowCoverage && model.scope !== 'outOfCombat'" :allow-modification-values="allowModificationValues" :preferred-skill-id="preferredSkillId" @change="emit('change')" />
    <div class="buff-modifier-block">
      <div class="maintenance-row-head"><strong>Buff 修饰</strong></div>
      <BuffModifiersEditor :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
    </div>
  </div>
</template>
