<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect, NSwitch } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
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

function runtimeParameters() {
  props.model.runtimeParameters ??= []
  return props.model.runtimeParameters
}

function addRuntimeParameter() {
  runtimeParameters().push({ id: "buffParameter", kind: "enum", values: [1, 2, 3], defaultValue: 3 })
  changed()
}

function removeRuntimeParameter(index: number) {
  runtimeParameters().splice(index, 1)
  changed()
}

function runtimeParameterValuesText(parameter: any) {
  return (parameter?.values ?? []).join("/")
}

function setRuntimeParameterValues(parameter: any, value: string) {
  const values = value.split("/").map(item => item.trim()).filter(Boolean).map(item => {
    const numeric = Number(item)
    return Number.isFinite(numeric) ? numeric : item
  })
  parameter.values = values
  if (!values.some(item => String(item) === String(parameter.defaultValue))) {
    parameter.defaultValue = values[0]
  }
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
    <MaintenanceSection title="Buff 运行时参数">
      <template #actions><NButton size="small" :disabled="disabled" @click="addRuntimeParameter"><template #icon><Plus :size="15" /></template>添加参数</NButton></template>
      <div v-if="runtimeParameters().length" class="maintenance-stack">
        <div v-for="(parameter, index) in runtimeParameters()" :key="parameter.id ?? index" class="maintenance-grid">
          <label class="maintenance-field"><span>参数 ID</span><NInput v-model:value="parameter.id" :disabled="disabled" @update:value="changed" /></label>
          <label class="maintenance-field"><span>类型</span><NSelect v-model:value="parameter.kind" :options="[{ label: '分段枚举', value: 'enum' }]" :disabled="disabled" @update:value="changed" /></label>
          <label class="maintenance-field"><span>可选值（/ 分隔）</span><NInput :value="runtimeParameterValuesText(parameter)" :disabled="disabled" @update:value="setRuntimeParameterValues(parameter, String($event))" /></label>
          <label class="maintenance-field"><span>默认值</span><NInputNumber v-model:value="parameter.defaultValue" :disabled="disabled" :step="1" @update:value="changed" /></label>
          <NButton quaternary type="error" :disabled="disabled" title="删除 Buff 参数" @click="removeRuntimeParameter(index)"><template #icon><Trash2 :size="16" /></template></NButton>
        </div>
      </div>
      <div v-else class="maintenance-empty">暂无 Buff 运行时参数</div>
    </MaintenanceSection>
    <MaintenanceSection title="Buff 规则"><EffectRulesEditor :model="model" :catalog="catalog" :runtime-parameters="model.runtimeParameters ?? []" :disabled="disabled" :allow-coverage="model.scope === 'inCombat'" @change="changed" /></MaintenanceSection>
    <MaintenanceSection title="Buff 修饰"><BuffModifiersEditor :model="model" :catalog="catalog" :disabled="disabled" @change="changed" /></MaintenanceSection>
  </div>
</template>
