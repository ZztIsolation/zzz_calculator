<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NInput, NModal, NSelect, NTag } from "naive-ui"
import {
  damageSkillRowsWithGeneratedTotals,
  defaultSkillLevel,
  normalizeSkillLevel,
  skillLevelLabel,
  skillRowValue,
} from "@core/skillMultiplierCandidates.js"
import { labelOf } from "@/utils/format"

const props = defineProps<{
  show: boolean
  skillCatalog: any
  skillLevels: Record<string, any>
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  select: [value: any]
}>()

const query = ref("")
const selectedCategoryId = ref("")

watch(() => props.show, value => {
  if (value) {
    query.value = ""
    selectedCategoryId.value = props.skillCatalog?.categories?.[0]?.id ?? ""
  }
})

const categoryOptions = computed(() => (props.skillCatalog?.categories ?? []).map((category: any) => ({
  label: labelOf(category),
  value: category.id,
})))

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const result: any[] = []
  for (const category of props.skillCatalog?.categories ?? []) {
    if (selectedCategoryId.value && category.id !== selectedCategoryId.value) {
      continue
    }
    for (const move of category.moves ?? []) {
      for (const row of damageSkillRowsWithGeneratedTotals(category, move)) {
        const level = normalizeSkillLevel(category, move, row, props.skillLevels?.[category.id] ?? defaultSkillLevel(category, move, row))
        const value = skillRowValue(category, move, row, level)
        const haystack = [
          labelOf(category),
          labelOf(move),
          labelOf(row),
          row.id,
          value,
        ].join(" ").toLowerCase()
        if (!needle || haystack.includes(needle)) {
          result.push({ category, move, row, level, value })
        }
      }
    }
  }
  return result
})

function choose(item: any) {
  emit("select", {
    skillMultiplier: item.value,
    skillRef: {
      agentSkillId: props.skillCatalog?.id,
      categoryId: item.category.id,
      moveId: item.move.id,
      rowId: item.row.id,
      level: item.level,
    },
    summary: `${labelOf(item.category)} / ${labelOf(item.move)} / ${labelOf(item.row)} · ${skillLevelLabel(item.category, item.level)} · ${item.value}%`,
  })
  emit("update:show", false)
}
</script>

<template>
  <NModal :show="show" preset="card" title="选择技能倍率" style="max-width: 880px" @update:show="emit('update:show', $event)">
    <div class="section-band">
      <div class="toolbar">
        <NInput v-model:value="query" clearable placeholder="搜索技能、倍率、段数" style="max-width: 360px" />
        <NSelect v-model:value="selectedCategoryId" :options="categoryOptions" clearable style="max-width: 220px" />
        <NTag round>{{ rows.length }} 项</NTag>
      </div>
      <div class="skill-list">
        <button v-for="item in rows" :key="`${item.category.id}:${item.move.id}:${item.row.id}`" type="button" class="skill-row" @click="choose(item)">
          <span>
            <strong>{{ labelOf(item.move) }}</strong>
            <small>{{ labelOf(item.category) }} / {{ labelOf(item.row) }} · {{ skillLevelLabel(item.category, item.level) }}</small>
          </span>
          <span class="num">{{ item.value }}%</span>
        </button>
        <div v-if="!rows.length" class="empty-state">没有匹配的技能倍率</div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.skill-list {
  display: grid;
  gap: 8px;
  max-height: 560px;
  overflow: auto;
}

.skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.skill-row:hover {
  border-color: var(--app-blue);
}

.skill-row span {
  min-width: 0;
}

.skill-row strong,
.skill-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-row small {
  color: var(--app-muted);
}
</style>
