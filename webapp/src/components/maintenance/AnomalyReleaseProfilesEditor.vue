<script setup lang="ts">
import { NButton, NInput, NSelect, NSwitch } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import { DAMAGE_ELEMENT_OPTIONS, option } from "./maintenance-options"
import ReleaseExpressionEditor from "./ReleaseExpressionEditor.vue"

const props = defineProps<{ model: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()
const resultModeOptions = [option("originalAnomalyRatio", "原异常倍率比例"), option("fixedAnomalyMultiplier", "固定异放倍率")]

function profiles() {
  return Array.isArray(props.model.anomalyReleaseProfiles)
    ? props.model.anomalyReleaseProfiles as any[]
    : []
}

function mutableProfiles() {
  props.model.anomalyReleaseProfiles ??= []
  return props.model.anomalyReleaseProfiles as any[]
}

function addProfile() {
  const items = mutableProfiles()
  const usedIds = new Set(items.map((profile: any) => String(profile?.id ?? "")))
  let index = 1
  while (usedIds.has(`release_profile_${index}`)) index += 1
  items.push({
    id: `release_profile_${index}`,
    name: { zhCN: `异放方案${index}` },
    default: items.length === 0,
    supportedElements: [props.model.damageElement || props.model.attribute || "physical"],
    resultMode: "originalAnomalyRatio",
    expression: { kind: "constant", value: 1, unit: "decimal", whiteBoxRole: "conversionSource", label: { zhCN: "固定倍率" } },
  })
  emit("change")
}

function setDefault(index: number, value: boolean) {
  profiles().forEach((profile, profileIndex) => { profile.default = value && profileIndex === index })
  emit("change")
}

</script>

<template>
  <article class="maintenance-subcard anomaly-release-profiles">
    <header class="maintenance-section-head">
      <div><h4>异放倍率方案</h4><p>倍率、单位换算和条件由结构化公式统一计算。</p></div>
      <NButton size="tiny" :disabled="disabled" @click="addProfile"><template #icon><Plus :size="13" /></template>添加方案</NButton>
    </header>
    <p v-if="!profiles().length" class="muted">当前角色暂不支持异放。</p>
    <details v-for="(profile, index) in profiles()" :key="profile.id || index" class="maintenance-subcard" :open="profile.default === true">
      <summary><strong>{{ profile.name?.zhCN || profile.id || '未命名方案' }}</strong><span>{{ profile.resultMode === 'fixedAnomalyMultiplier' ? '固定倍率' : '原异常比例' }}</span></summary>
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>显示名称</span><NInput :value="profile.name?.zhCN ?? ''" :disabled="disabled" @update:value="profile.name = { zhCN: String($event) }; emit('change')" /></label>
        <label class="maintenance-switch-field"><span>默认方案</span><NSwitch :value="profile.default === true" :disabled="disabled" @update:value="setDefault(index, Boolean($event))" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>支持属性</span><NSelect multiple v-model:value="profile.supportedElements" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>倍率结果</span><NSelect v-model:value="profile.resultMode" :options="resultModeOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      </div>
      <ReleaseExpressionEditor :node="profile.expression" :core-scaling="model.coreSkill?.corePassiveScaling" :disabled="disabled" @change="emit('change')" />
      <div class="maintenance-row-head">
        <strong>方案操作</strong>
        <NButton quaternary type="error" :disabled="disabled" title="删除异放倍率方案" @click="profiles().splice(index, 1); emit('change')"><template #icon><Trash2 :size="15" /></template></NButton>
      </div>
    </details>
  </article>
</template>

<style scoped>
.anomaly-release-profiles { display: grid; gap: 10px; }
</style>
