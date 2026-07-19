<script setup lang="ts">
import { NInput, NSelect, NSwitch } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import EffectRulesEditor from "../EffectRulesEditor.vue"
import BuffModifiersEditor from "../BuffModifiersEditor.vue"
import { SCOPE_OPTIONS } from "../maintenance-options"
import { textOf } from "../maintenance-model"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()
const changed = () => emit("change")
function setScope(value: string) {
  props.model.scope = value
  if (value !== "inCombat") for (const rule of props.model.effects ?? []) delete rule.coverage
  changed()
}
</script>

<template>
  <div class="buff-body-editor">
    <MaintenanceSection title="当前 Buff">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>来源中文名</span><NInput :value="textOf(model.source)" :disabled="disabled" @update:value="model.source = { ...model.source, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>范围</span><NSelect :value="model.scope" :options="SCOPE_OPTIONS" :disabled="disabled" @update:value="setScope(String($event))" /></label>
        <label class="maintenance-field"><span>条件标签</span><NInput :value="textOf(model.conditionLabel)" :disabled="disabled" @update:value="model.conditionLabel = String($event) ? { zhCN: String($event) } : undefined; changed()" /></label>
        <label class="maintenance-switch-field"><span>首页/优化器显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>中文说明</span><NInput type="textarea" :value="textOf(model.description)" :disabled="disabled" @update:value="model.description = { ...model.description, zhCN: String($event) }; changed()" /></label>
      </div>
    </MaintenanceSection>
    <MaintenanceSection title="Buff 规则"><EffectRulesEditor :model="model" :catalog="catalog" :disabled="disabled" :allow-coverage="model.scope === 'inCombat'" @change="changed" /></MaintenanceSection>
    <MaintenanceSection title="Buff 修饰"><BuffModifiersEditor :model="model" :catalog="catalog" :disabled="disabled" @change="changed" /></MaintenanceSection>
  </div>
</template>
