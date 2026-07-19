<script setup lang="ts">
import { NInput, NInputNumber, NSwitch } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import EffectRulesEditor from "../EffectRulesEditor.vue"
import BuffEffectSetEditor from "../BuffEffectSetEditor.vue"
import BuffModifiersEditor from "../BuffModifiersEditor.vue"
import SourceListEditor from "../SourceListEditor.vue"
import { textOf } from "../maintenance-model"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function changed() { emit("change") }

function toggleTwoPiece(enabled: boolean) {
  props.model.twoPiece = enabled ? { effects: [] } : null
  changed()
}

function toggleFourPiece(enabled: boolean) {
  props.model.fourPiece = enabled ? { effectText: { zhCN: "", en: "" }, selfBuff: null, teamBuff: null } : null
  changed()
}

function toggleFourPieceBuff(key: "selfBuff" | "teamBuff", enabled: boolean) {
  props.model.fourPiece[key] = enabled ? { condition: "", durationSeconds: null, effects: [], buffModifiers: [] } : null
  changed()
}
</script>

<template>
  <div class="resource-editor drive-disc-set-editor">
    <MaintenanceSection title="基础信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>中文名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>图片路径</span><NInput v-model:value="model.images.icon" :disabled="disabled" placeholder="/assets/drive-discs/..." @update:value="changed" /></label>
        <label class="maintenance-field"><span>图片来源</span><NInput v-model:value="model.images.source" :disabled="disabled" placeholder="https://..." @update:value="changed" /></label>
        <label class="maintenance-switch-field"><span>首页/优化器显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
      </div>
      <SourceListEditor :sources="model.sources" :disabled="disabled" @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="2 件套">
      <template #actions><NSwitch :value="Boolean(model.twoPiece)" :disabled="disabled" @update:value="toggleTwoPiece" /></template>
      <template v-if="model.twoPiece"><EffectRulesEditor :model="model.twoPiece" :catalog="catalog" :disabled="disabled" @change="changed" /><div class="buff-modifier-block"><div class="maintenance-row-head"><strong>Buff 修饰</strong></div><BuffModifiersEditor :model="model.twoPiece" :catalog="catalog" :disabled="disabled" @change="changed" /></div></template>
    </MaintenanceSection>

    <MaintenanceSection title="4 件套">
      <template #actions><NSwitch :value="Boolean(model.fourPiece)" :disabled="disabled" @update:value="toggleFourPiece" /></template>
      <template v-if="model.fourPiece">
        <div class="maintenance-grid">
          <label class="maintenance-field maintenance-field-wide"><span>中文效果文案</span><NInput type="textarea" :value="textOf(model.fourPiece.effectText)" :disabled="disabled" @update:value="model.fourPiece.effectText = { ...model.fourPiece.effectText, zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field maintenance-field-wide"><span>英文效果文案</span><NInput type="textarea" :value="model.fourPiece.effectText?.en ?? ''" :disabled="disabled" @update:value="model.fourPiece.effectText = { ...model.fourPiece.effectText, en: String($event) }; changed()" /></label>
        </div>
        <article v-for="entry in [{ key: 'selfBuff', title: '佩戴者效果' }, { key: 'teamBuff', title: '团队效果' }]" :key="entry.key" class="maintenance-subcard">
          <header class="maintenance-section-head"><div><h4>{{ entry.title }}</h4></div><NSwitch :value="Boolean(model.fourPiece[entry.key])" :disabled="disabled" @update:value="toggleFourPieceBuff(entry.key as any, $event)" /></header>
          <template v-if="model.fourPiece[entry.key]">
            <label v-if="entry.key === 'teamBuff'" class="maintenance-field"><span>同名唯一组</span><NInput v-model:value="model.fourPiece[entry.key].exclusiveGroup" :disabled="disabled" clearable @update:value="changed" /></label>
            <BuffEffectSetEditor :model="model.fourPiece[entry.key]" :catalog="catalog" :disabled="disabled" show-condition show-duration @change="changed" />
          </template>
        </article>
      </template>
    </MaintenanceSection>
  </div>
</template>
