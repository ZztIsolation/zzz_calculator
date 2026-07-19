<script setup lang="ts">
import { NInput, NInputNumber, NSelect } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import { DAMAGE_ELEMENT_OPTIONS, option } from "../maintenance-options"
import { textOf } from "../maintenance-model"

const props = defineProps<{ model: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function kind() { return props.model.settlementType === "disorder" || props.model.maintenanceType === "disorder" ? "disorder" : "anomaly" }
function changed() { emit("change") }

function changeKind(value: string) {
  if (value === "disorder") {
    props.model.maintenanceType = "disorder"
    props.model.settlementType = "disorder"
    props.model.fixedMultiplier ??= 4.5
    props.model.tickMultiplier ??= 0
    props.model.tickIntervalSeconds ??= 1
    props.model.defaultDurationSeconds ??= 10
    delete props.model.baseMultiplier
    delete props.model.defaultProcCount
  } else {
    props.model.maintenanceType = "anomaly"
    props.model.settlementType = "attribute"
    props.model.baseMultiplier ??= 1
    props.model.defaultProcCount ??= 1
    delete props.model.fixedMultiplier
    delete props.model.tickMultiplier
    delete props.model.tickIntervalSeconds
    delete props.model.defaultDurationSeconds
  }
  changed()
}
</script>

<template>
  <div class="resource-editor anomaly-effect-editor">
    <MaintenanceSection title="异常 / 紊乱信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>结算类型</span><NSelect :value="kind()" :options="[option('anomaly', '属性异常'), option('disorder', '紊乱')]" :disabled="disabled" @update:value="changeKind(String($event))" /></label>
        <label class="maintenance-field"><span>中文名称</span><NInput :value="textOf(model.label)" :disabled="disabled" @update:value="model.label = { ...model.label, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>元素</span><NSelect v-model:value="model.element" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <template v-if="kind() === 'anomaly'">
          <label class="maintenance-field"><span>基础倍率</span><NInputNumber v-model:value="model.baseMultiplier" :disabled="disabled" :step="0.01" @update:value="changed" /></label>
          <label class="maintenance-field"><span>默认结算次数</span><NInputNumber v-model:value="model.defaultProcCount" :disabled="disabled" :min="0" :step="1" @update:value="changed" /></label>
        </template>
        <template v-else>
          <label class="maintenance-field"><span>固定倍率</span><NInputNumber v-model:value="model.fixedMultiplier" :disabled="disabled" :step="0.01" @update:value="changed" /></label>
          <label class="maintenance-field"><span>每跳倍率</span><NInputNumber v-model:value="model.tickMultiplier" :disabled="disabled" :step="0.01" @update:value="changed" /></label>
          <label class="maintenance-field"><span>跳伤间隔（秒）</span><NInputNumber v-model:value="model.tickIntervalSeconds" :disabled="disabled" :min="0" :step="0.1" @update:value="changed" /></label>
          <label class="maintenance-field"><span>默认持续时间（秒）</span><NInputNumber v-model:value="model.defaultDurationSeconds" :disabled="disabled" :min="0" :step="0.1" @update:value="changed" /></label>
        </template>
      </div>
    </MaintenanceSection>
  </div>
</template>
