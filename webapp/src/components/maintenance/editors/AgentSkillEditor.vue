<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import MaintenanceSection from "../MaintenanceSection.vue"
import SourceListEditor from "../SourceListEditor.vue"
import {
  CORE_SKILL_LEVELS, DAMAGE_BASIS_OPTIONS, DAMAGE_ELEMENT_OPTIONS, LEVEL_SCALE_OPTIONS, SKILL_ROW_KIND_OPTIONS, SKILL_TAG_OPTIONS, SKILL_TYPE_OPTIONS,
  agentOptions, option,
} from "../maintenance-options"
import { internalId, textOf } from "../maintenance-model"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function changed() { emit("change") }

function levelsFor(category: any) {
  if (category.levelScale === "coreSkill" || Array.isArray(category.levelRange?.levels)) return category.levelRange?.levels ?? CORE_SKILL_LEVELS
  const min = Number(category.levelRange?.min ?? 1)
  const max = Math.max(min, Number(category.levelRange?.max ?? min))
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

function syncRange(category: any) {
  const levels = levelsFor(category)
  for (const move of category.moves ?? []) for (const row of move.rows ?? []) {
    row.values ??= []
    row.values = levels.map((_: any, index: number) => row.values[index] ?? 0)
  }
  changed()
}

function changeScale(category: any, value: string) {
  category.levelScale = value
  category.levelRange = value === "coreSkill"
    ? { levels: [...CORE_SKILL_LEVELS], default: "F" }
    : { min: 1, max: 12, default: 12 }
  syncRange(category)
}

function addCategory() {
  props.model.categories.push({ id: internalId("skill_category"), name: { zhCN: "新技能大类" }, levelScale: "skill", levelRange: { min: 1, max: 12, default: 12 }, moves: [] })
  changed()
}

function addMove(category: any) {
  const usedByOtherCategories = new Set(props.model.categories
    .filter((item: any) => item !== category)
    .flatMap((item: any) => (item.moves ?? []).map((move: any) => move.skillType))
    .filter(Boolean))
  const knownCategoryType = SKILL_TYPE_OPTIONS.some(item => item.value === category.id) && !usedByOtherCategories.has(category.id)
    ? category.id
    : ""
  const firstUnusedType = SKILL_TYPE_OPTIONS.find(item => !usedByOtherCategories.has(item.value))?.value ?? "basic"
  const skillType = (category.moves?.[0]?.skillType ?? knownCategoryType) || firstUnusedType
  category.moves.push({ id: internalId("skill_move"), name: { zhCN: "新招式" }, skillType, skillTags: [], damageElement: "physical", rows: [] })
  changed()
}

function addRow(category: any, move: any) {
  move.rows.push({ id: internalId("skill_row"), label: { zhCN: "新倍率行" }, kind: "damageMultiplier", values: levelsFor(category).map(() => 0) })
  changed()
}
</script>

<template>
  <div class="resource-editor agent-skill-editor">
    <MaintenanceSection title="基础信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>资料名</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>关联角色</span><NSelect filterable v-model:value="model.agentId" :options="agentOptions(catalog)" :disabled="disabled" @update:value="changed" /></label>
      </div>
      <SourceListEditor :sources="model.sources" :disabled="disabled" @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="技能分类与倍率">
      <template #actions><NButton size="small" :disabled="disabled" @click="addCategory"><template #icon><Plus :size="15" /></template>添加大类</NButton></template>
      <details v-for="(category, categoryIndex) in model.categories" :key="category.id" class="maintenance-subcard skill-category-card" open>
        <summary><strong>{{ textOf(category.name) || `技能大类 ${categoryIndex + 1}` }}</strong><span>{{ category.moves?.length ?? 0 }} 个招式</span></summary>
        <div class="maintenance-section-head skill-category-toolbar"><div><h4>技能大类</h4></div><div class="maintenance-action-row"><NButton size="small" :disabled="disabled" @click="addMove(category)"><template #icon><Plus :size="14" /></template>添加招式</NButton><NButton quaternary type="error" :disabled="disabled" title="删除技能大类" @click="model.categories.splice(categoryIndex, 1); changed()"><template #icon><Trash2 :size="16" /></template></NButton></div></div>
        <div class="maintenance-grid">
          <label class="maintenance-field"><span>大类名</span><NInput :value="textOf(category.name)" :disabled="disabled" @update:value="category.name = { zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field"><span>等级模式</span><NSelect :value="category.levelScale ?? 'skill'" :options="LEVEL_SCALE_OPTIONS" :disabled="disabled" @update:value="changeScale(category, String($event))" /></label>
          <template v-if="category.levelScale !== 'coreSkill'">
            <label class="maintenance-field"><span>最低等级</span><NInputNumber v-model:value="category.levelRange.min" :disabled="disabled" :min="1" :step="1" @update:value="syncRange(category)" /></label>
            <label class="maintenance-field"><span>最高等级</span><NInputNumber v-model:value="category.levelRange.max" :disabled="disabled" :min="category.levelRange.min" :step="1" @update:value="syncRange(category)" /></label>
            <label class="maintenance-field"><span>默认等级</span><NInputNumber v-model:value="category.levelRange.default" :disabled="disabled" :min="category.levelRange.min" :max="category.levelRange.max" :step="1" @update:value="changed" /></label>
          </template>
          <template v-else>
            <label class="maintenance-field"><span>核心技等级</span><NInput :value="CORE_SKILL_LEVELS.join(' / ')" disabled /></label>
            <label class="maintenance-field"><span>默认核心等级</span><NSelect v-model:value="category.levelRange.default" :options="CORE_SKILL_LEVELS.map(level => option(level, level))" :disabled="disabled" @update:value="changed" /></label>
          </template>
        </div>

        <details class="skill-technical-info">
          <summary>技术信息</summary>
          <dl>
            <div><dt>技能目录 ID</dt><dd><code>{{ category.id }}</code></dd></div>
            <template v-for="move in category.moves" :key="`technical:${move.id}`">
              <div><dt>招式 · {{ textOf(move.name) || '未命名' }}</dt><dd><code>{{ move.id }}</code></dd></div>
              <div v-for="row in move.rows" :key="`technical:${move.id}:${row.id}`"><dt>倍率行 · {{ textOf(move.name) || '未命名' }} / {{ textOf(row.label) || '未命名' }}</dt><dd><code>{{ row.id }}</code></dd></div>
            </template>
          </dl>
        </details>

        <article v-for="(move, moveIndex) in category.moves" :key="move.id" class="maintenance-subcard skill-move-card">
          <header class="maintenance-section-head"><div><h4>{{ textOf(move.name) || `招式 ${moveIndex + 1}` }}</h4></div><div class="maintenance-action-row"><NButton size="small" :disabled="disabled" @click="addRow(category, move)"><template #icon><Plus :size="14" /></template>添加倍率行</NButton><NButton quaternary type="error" :disabled="disabled" title="删除招式" @click="category.moves.splice(moveIndex, 1); changed()"><template #icon><Trash2 :size="16" /></template></NButton></div></header>
          <div class="maintenance-grid">
            <label class="maintenance-field"><span>招式名</span><NInput :value="textOf(move.name)" :disabled="disabled" @update:value="move.name = { zhCN: String($event) }; changed()" /></label>
            <label class="maintenance-field"><span>招式大类</span><NSelect v-model:value="move.skillType" :options="SKILL_TYPE_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
            <label class="maintenance-field"><span>通用招式标签</span><NSelect multiple clearable v-model:value="move.skillTags" :options="SKILL_TAG_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
            <label class="maintenance-field"><span>伤害属性</span><NSelect v-model:value="move.damageElement" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
          </div>
          <div class="skill-table-wrap">
            <table class="skill-multiplier-table">
              <thead><tr><th class="skill-col-label">行名</th><th class="skill-col-kind">类型</th><th class="skill-col-basis">伤害基准</th><th v-for="level in levelsFor(category)" :key="level">{{ category.levelScale === 'coreSkill' ? level : `LV${level}` }}</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="(row, rowIndex) in move.rows" :key="row.id">
                  <td class="skill-col-label"><NInput :value="textOf(row.label)" :disabled="disabled" @update:value="row.label = { zhCN: String($event) }; changed()" /></td>
                  <td class="skill-col-kind"><NSelect v-model:value="row.kind" :options="SKILL_ROW_KIND_OPTIONS" :disabled="disabled" @update:value="changed" /></td>
                  <td class="skill-col-basis"><NSelect v-model:value="row.damageBasis" :options="DAMAGE_BASIS_OPTIONS" :disabled="disabled" clearable @update:value="changed" /></td>
                  <td v-for="(_level, levelIndex) in levelsFor(category)" :key="levelIndex"><NInputNumber v-model:value="row.values[levelIndex]" :disabled="disabled" :step="0.01" @update:value="changed" /></td>
                  <td><NButton quaternary type="error" :disabled="disabled" title="删除倍率行" @click="move.rows.splice(rowIndex, 1); changed()"><template #icon><Trash2 :size="15" /></template></NButton></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </details>
    </MaintenanceSection>
  </div>
</template>
