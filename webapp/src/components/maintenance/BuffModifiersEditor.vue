<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import { buffCandidates, effectSummary, option } from "./maintenance-options"
import { internalId, textOf } from "./maintenance-model"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function modifiers() {
  return Array.isArray(props.model.buffModifiers) ? props.model.buffModifiers as any[] : []
}

function targetBuffOptions(modifier: any) {
  const options = buffCandidates(props.catalog).map(item => option(item.value, item.label))
  const selected = modifier.targetBuffIds?.[0]
  if (selected && !options.some(item => item.value === selected)) options.push(option(selected, "历史目标（当前目录中不可用）"))
  return options
}

function targetEffectOptions(modifier: any) {
  const selectedBuffId = modifier.targetBuffIds?.[0]
  const candidate = buffCandidates(props.catalog).find(item => item.value === selectedBuffId)
  const options = (candidate?.effects ?? []).map((effect: any, index: number) => option(effect.id, effectSummary(effect, props.catalog) || `效果 ${index + 1}`))
  const selected = modifier.targetEffectIds?.[0]
  if (selected && !options.some(item => item.value === selected)) options.push(option(selected, "历史效果（当前目录中不可用）"))
  return options
}

function addModifier() {
  props.model.buffModifiers ??= []
  props.model.buffModifiers.push({ id: internalId("modifier"), operation: "multiplyResolvedValue", factor: 1.3, label: { zhCN: "" }, targetBuffIds: [], targetEffectIds: [] })
  emit("change")
}

function selectBuff(modifier: any, value: string) {
  modifier.targetBuffIds = value ? [value] : []
  modifier.targetEffectIds = []
  emit("change")
}
</script>

<template>
  <div class="buff-modifier-editor">
    <article v-for="(modifier, index) in modifiers()" :key="modifier.id ?? index" class="modifier-card">
      <header class="maintenance-row-head"><strong>Buff 修饰 {{ index + 1 }}</strong><NButton quaternary type="error" :disabled="disabled" title="删除 Buff 修饰" @click="model.buffModifiers.splice(index, 1); emit('change')"><template #icon><Trash2 :size="16" /></template></NButton></header>
      <div class="modifier-grid">
        <label class="maintenance-field modifier-description"><span>说明</span><NInput :value="textOf(modifier.label)" :disabled="disabled" placeholder="额外能力效果提升至原本的130%" @update:value="modifier.label = { zhCN: String($event) }; emit('change')" /></label>
        <label class="maintenance-field"><span>目标 Buff</span><NSelect filterable clearable :consistent-menu-width="false" :value="modifier.targetBuffIds?.[0] ?? ''" :options="targetBuffOptions(modifier)" :disabled="disabled" @update:value="selectBuff(modifier, String($event ?? ''))" /></label>
        <label class="maintenance-field"><span>目标效果</span><NSelect filterable clearable :consistent-menu-width="false" :value="modifier.targetEffectIds?.[0] ?? ''" :options="targetEffectOptions(modifier)" :disabled="disabled || !modifier.targetBuffIds?.length" @update:value="modifier.targetEffectIds = $event ? [String($event)] : []; emit('change')" /></label>
        <label class="maintenance-field modifier-factor"><span>倍率</span><NInputNumber v-model:value="modifier.factor" :disabled="disabled" :min="0" :step="0.01" @update:value="emit('change')" /></label>
      </div>
    </article>
    <NButton size="small" :disabled="disabled" @click="addModifier"><template #icon><Plus :size="15" /></template>添加修饰</NButton>
  </div>
</template>
