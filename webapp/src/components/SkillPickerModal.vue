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
import { potentialLevelRequirementMatches } from "@core/potentialVision.js"
import { labelOf } from "@/utils/format"

const props = defineProps<{
  show: boolean
  skillCatalog: any
  skillLevels: Record<string, any>
  potentialLevel?: number
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  select: [value: any]
}>()

const query = ref("")
const selectedCategoryId = ref("")
const availableCategories = computed(() => (props.skillCatalog?.categories ?? [])
  .filter((category: any) => potentialLevelRequirementMatches(category, props.potentialLevel ?? 0)))

watch(() => props.show, value => {
  if (value) {
    query.value = ""
    selectedCategoryId.value = availableCategories.value[0]?.id ?? ""
  }
})

watch(availableCategories, categories => {
  if (!categories.some((category: any) => category.id === selectedCategoryId.value)) {
    selectedCategoryId.value = categories[0]?.id ?? ""
  }
})

const categoryOptions = computed(() => availableCategories.value.map((category: any) => ({
  label: labelOf(category),
  value: category.id,
})))

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const result: any[] = []
  for (const category of availableCategories.value) {
    if (selectedCategoryId.value && category.id !== selectedCategoryId.value) {
      continue
    }
    for (const move of category.moves ?? []) {
      if (!potentialLevelRequirementMatches(move, props.potentialLevel ?? 0)) {
        continue
      }
      for (const row of damageSkillRowsWithGeneratedTotals(category, move)
        .filter((item: any) => potentialLevelRequirementMatches(item, props.potentialLevel ?? 0))) {
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
  const eventCountRange = normalizeEventCountRange(item.row?.eventCountRange)
  emit("select", {
    skillMultiplier: item.value,
    skillRef: {
      agentSkillId: props.skillCatalog?.id,
      categoryId: item.category.id,
      moveId: item.move.id,
      rowId: item.row.id,
      level: item.level,
    },
    ...(eventCountRange ? { eventCountRange } : {}),
    summary: `${labelOf(item.category)} / ${labelOf(item.move)} / ${labelOf(item.row)} · ${skillLevelLabel(item.category, item.level)} · ${item.value}%`,
  })
  emit("update:show", false)
}

function normalizeEventCountRange(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const min = Number.isFinite(Number(value.min)) ? Number(value.min) : 0
  const requestedMax = Number(value.max)
  const max = Number.isFinite(requestedMax) ? Math.max(min, requestedMax) : null
  const requestedDefault = Number(value.default)
  const fallbackDefault = Number.isFinite(requestedDefault) ? requestedDefault : min
  return {
    min,
    max,
    default: Math.max(min, max === null ? fallbackDefault : Math.min(max, fallbackDefault)),
  }
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
            <strong :title="labelOf(item.move)">{{ labelOf(item.move) }}</strong>
            <small :title="`${labelOf(item.category)} / ${labelOf(item.row)} · ${skillLevelLabel(item.category, item.level)}`">{{ labelOf(item.category) }} / {{ labelOf(item.row) }} · {{ skillLevelLabel(item.category, item.level) }}</small>
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
