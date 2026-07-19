<script setup lang="ts">
import { computed, ref } from "vue"
import { NInput, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSwitch } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import BuffEffectSetEditor from "../BuffEffectSetEditor.vue"
import SourceListEditor from "../SourceListEditor.vue"
import {
  ATTRIBUTE_OPTIONS, BASIS_OPTIONS, EFFECT_MODE_OPTIONS, RARITY_OPTIONS, SPECIALTY_OPTIONS, agentOptions, effectSummary, statOptions,
} from "../maintenance-options"
import { textOf } from "../maintenance-model"
import { defaultRuntimeForBuff, materializeWEngineForModificationLevel, storedEffectRulesText } from "@core/shared-combat.js"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function changed() { emit("change") }

function toggleBuff(key: "selfBuff" | "teamBuff", enabled: boolean) {
  props.model.effect[key] = enabled ? { scope: "inCombat", effects: [], buffModifiers: [], appliesToOutOfCombatPanel: false } : null
  changed()
}

const previewLevel = ref(Number(props.model.modification?.defaultLevel ?? 1))
const previewRows = computed(() => {
  const materialized = materializeWEngineForModificationLevel(props.model, previewLevel.value)
  return [
    { label: "限佩戴者", buff: materialized?.effect?.selfBuff ?? materialized?.effect?.buff },
    { label: "团队", buff: materialized?.effect?.teamBuff },
  ].map(row => ({ ...row, text: row.buff ? storedEffectRulesText(row.buff, defaultRuntimeForBuff(row.buff), props.catalog?.meta) : "" })).filter(row => row.text)
})

function ruleValueAt(rule: any, level: number) {
  const key = rule.type === "stacked" ? "valuePerStack" : "value"
  return rule.modificationValues?.[key]?.[level - 1] ?? rule[key] ?? 0
}
</script>

<template>
  <div class="resource-editor w-engine-editor">
    <MaintenanceSection title="基础信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>中文名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>稀有度</span><NSelect v-model:value="model.rarity" :options="RARITY_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>特性</span><NSelect v-model:value="model.specialty" :options="SPECIALTY_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>属性</span><NSelect clearable v-model:value="model.attribute" :options="ATTRIBUTE_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>关联角色</span><NSelect filterable clearable v-model:value="model.relatedAgentId" :options="agentOptions(catalog)" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>图片路径</span><NInput v-model:value="model.images.icon" :disabled="disabled" placeholder="/assets/w-engines/..." @update:value="changed" /></label>
        <label class="maintenance-field"><span>图片来源</span><NInput v-model:value="model.images.source" :disabled="disabled" placeholder="https://..." @update:value="changed" /></label>
        <label class="maintenance-field"><span>基础攻击力</span><NInputNumber v-model:value="model.level60.atkBase" :disabled="disabled" :step="1" @update:value="changed" /></label>
        <label class="maintenance-switch-field"><span>首页/优化器显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
      </div>
      <SourceListEditor :sources="model.sources" :disabled="disabled" @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="高级属性">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>属性</span><NSelect filterable v-model:value="model.level60.advancedStat.stat" :options="statOptions(catalog)" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>数值</span><NInputNumber v-model:value="model.level60.advancedStat.value" :disabled="disabled" :step="0.01" @update:value="changed" /></label>
        <label class="maintenance-field"><span>计算方式</span><NSelect v-model:value="model.level60.advancedStat.mode" :options="EFFECT_MODE_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>基准</span><NSelect clearable v-model:value="model.level60.advancedStat.basis" :options="BASIS_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
      </div>
    </MaintenanceSection>

    <MaintenanceSection title="音擎效果文案">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>效果中文名</span><NInput :value="textOf(model.effect.name)" :disabled="disabled" @update:value="model.effect.name = { ...model.effect.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>触发特性</span><NSelect clearable v-model:value="model.effect.requirement.specialty" :options="SPECIALTY_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>中文说明</span><NInput type="textarea" :value="textOf(model.effect.description)" :disabled="disabled" @update:value="model.effect.description = { ...model.effect.description, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>英文说明</span><NInput type="textarea" :value="model.effect.description?.en ?? ''" :disabled="disabled" @update:value="model.effect.description = { ...model.effect.description, en: String($event) }; changed()" /></label>
      </div>
    </MaintenanceSection>

    <MaintenanceSection title="音擎 Buff（限佩戴者）规则">
      <template #actions><NSwitch :value="Boolean(model.effect.selfBuff)" :disabled="disabled" @update:value="toggleBuff('selfBuff', $event)" /></template>
      <BuffEffectSetEditor v-if="model.effect.selfBuff" :model="model.effect.selfBuff" :catalog="catalog" :disabled="disabled" show-scope show-condition show-duration show-effect-text show-panel-toggle allow-modification-values @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="音擎 Buff（团队）规则">
      <template #actions><NSwitch :value="Boolean(model.effect.teamBuff)" :disabled="disabled" @update:value="toggleBuff('teamBuff', $event)" /></template>
      <BuffEffectSetEditor v-if="model.effect.teamBuff" :model="model.effect.teamBuff" :catalog="catalog" :disabled="disabled" show-scope show-condition show-duration show-effect-text show-panel-toggle allow-modification-values @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="改装等级与效果预览">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>最低改装等级</span><NInputNumber v-model:value="model.modification.minLevel" :disabled="disabled" :min="1" :max="5" :step="1" @update:value="changed" /></label>
        <label class="maintenance-field"><span>最高改装等级</span><NInputNumber v-model:value="model.modification.maxLevel" :disabled="disabled" :min="1" :max="5" :step="1" @update:value="changed" /></label>
        <label class="maintenance-field"><span>默认改装等级</span><NInputNumber v-model:value="model.modification.defaultLevel" :disabled="disabled" :min="model.modification.minLevel" :max="model.modification.maxLevel" :step="1" @update:value="changed" /></label>
      </div>
      <div class="modification-readable-preview">
        <div class="maintenance-row-head">
          <strong>可读效果预览</strong>
          <NRadioGroup v-model:value="previewLevel" size="small">
            <NRadioButton v-for="level in [1,2,3,4,5]" :key="level" :value="level">{{ level }} 级</NRadioButton>
          </NRadioGroup>
        </div>
        <div v-if="previewRows.length" class="maintenance-preview-list"><div v-for="row in previewRows" :key="row.label" class="maintenance-preview-row"><strong>{{ row.label }}</strong><span>{{ row.text }}</span></div></div>
        <p v-else class="maintenance-help">当前等级没有可预览的固定或叠层 Buff 规则。</p>
      </div>
      <div class="modification-preview-table-wrap">
        <table class="modification-preview-table"><thead><tr><th>规则</th><th v-for="level in [1,2,3,4,5]" :key="level">{{ level }} 级</th></tr></thead><tbody><tr v-for="rule in [...(model.effect.selfBuff?.effects ?? []), ...(model.effect.teamBuff?.effects ?? [])]" :key="rule.id"><th>{{ effectSummary(rule, catalog) }}</th><td v-for="level in [1,2,3,4,5]" :key="level">{{ ruleValueAt(rule, level) }}</td></tr></tbody></table>
      </div>
    </MaintenanceSection>
  </div>
</template>
