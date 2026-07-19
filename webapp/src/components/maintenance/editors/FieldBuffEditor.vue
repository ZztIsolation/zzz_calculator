<script setup lang="ts">
import { NInput, NSelect, NSwitch } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import EffectRulesEditor from "../EffectRulesEditor.vue"
import BuffModifiersEditor from "../BuffModifiersEditor.vue"
import { textOf } from "../maintenance-model"
import { FIELD_BUFF_GAME_VERSIONS, FIELD_BUFF_MODE_OPTIONS, FIELD_BUFF_PHASE_OPTIONS } from "@core/maintenanceValidation.js"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()
const changed = () => emit("change")
const modeOptions = FIELD_BUFF_MODE_OPTIONS.map(item => ({ label: item.selectLabel?.zhCN ?? item.source.zhCN, value: item.modeId }))
const versionOptions = FIELD_BUFF_GAME_VERSIONS.map(value => ({ label: `${value} 版本`, value }))
const phaseOptions = FIELD_BUFF_PHASE_OPTIONS.map(item => ({ label: item.phaseName.zhCN, value: item.phaseNo }))
</script>

<template>
  <div class="resource-editor field-buff-editor">
    <MaintenanceSection title="场地 Buff 信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>中文名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>模式</span><NSelect v-model:value="model.period.modeId" :options="modeOptions" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>版本</span><NSelect v-model:value="model.period.gameVersion" :options="versionOptions" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>第几期</span><NSelect v-model:value="model.period.phaseNo" :options="phaseOptions" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-switch-field"><span>首页/优化器显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>中文说明</span><NInput type="textarea" :value="textOf(model.description)" :disabled="disabled" @update:value="model.description = { ...model.description, zhCN: String($event) }; changed()" /></label>
      </div>
    </MaintenanceSection>
    <MaintenanceSection title="Buff 规则"><EffectRulesEditor :model="model" :catalog="catalog" :disabled="disabled" allow-coverage @change="changed" /></MaintenanceSection>
    <MaintenanceSection title="Buff 修饰"><BuffModifiersEditor :model="model" :catalog="catalog" :disabled="disabled" @change="changed" /></MaintenanceSection>
  </div>
</template>
