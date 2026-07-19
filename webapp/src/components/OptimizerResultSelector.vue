<script setup lang="ts">
import { computed, watch } from "vue"
import { NInputNumber, NSlider } from "naive-ui"
import { formatNumber } from "@/utils/format"

interface OptimizerResultOption {
  rank: number
  score: number
}

const props = defineProps<{
  modelValue: number
  results: OptimizerResultOption[]
}>()

const emit = defineEmits<{
  "update:modelValue": [rank: number]
}>()

const normalizedResults = computed(() => [...(props.results ?? [])]
  .filter(result => Number.isFinite(Number(result?.rank)) && Number(result.rank) > 0)
  .sort((left, right) => Number(left.rank) - Number(right.rank)))
const availableRanks = computed(() => normalizedResults.value.map(result => Number(result.rank)))
const availableRankKey = computed(() => availableRanks.value.join("|"))
const minRank = computed(() => availableRanks.value[0] ?? 1)
const maxRank = computed(() => availableRanks.value.at(-1) ?? minRank.value)
const hasMultipleResults = computed(() => availableRanks.value.length > 1)
const rankMarks = computed(() => Object.fromEntries(availableRanks.value.map(rank => [String(rank), ""])))
const currentRank = computed(() => availableRanks.value.includes(Number(props.modelValue))
  ? Number(props.modelValue)
  : minRank.value)
const selectedResult = computed(() => normalizedResults.value.find(result => Number(result.rank) === currentRank.value) ?? null)
const bestResult = computed(() => normalizedResults.value[0] ?? null)
const hasValidResults = computed(() => {
  const bestScore = Number(bestResult.value?.score)
  return normalizedResults.value.length > 0 && Number.isFinite(bestScore) && bestScore > 0
})
const scorePercentage = computed<number | null>(() => {
  const bestScore = Number(bestResult.value?.score)
  const selectedScore = Number(selectedResult.value?.score)
  if (!Number.isFinite(bestScore) || bestScore <= 0 || !Number.isFinite(selectedScore)) {
    return null
  }
  return Math.max(0, Math.min(100, (selectedScore / bestScore) * 100))
})
const percentageText = computed(() => {
  if (scorePercentage.value === null) {
    return "-"
  }
  const rounded = Math.round(scorePercentage.value * 10) / 10
  return rounded === 100 ? "100%" : `${rounded.toFixed(1)}%`
})
const scoreText = computed(() => {
  const score = Number(selectedResult.value?.score)
  return Number.isFinite(score) ? formatNumber(score, 0) : "-"
})
const ratioStyle = computed(() => ({
  "--optimizer-result-ratio": `${scorePercentage.value ?? 0}%`,
}))

watch([() => props.modelValue, availableRankKey], () => {
  if (!hasValidResults.value) {
    return
  }
  const rank = currentRank.value
  if (rank !== Number(props.modelValue)) {
    emit("update:modelValue", rank)
  }
}, { immediate: true })

function normalizeRank(value: unknown) {
  const ranks = availableRanks.value
  if (!ranks.length) {
    return 1
  }
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return ranks[0]
  }
  return ranks.reduce((closest, rank) =>
    Math.abs(rank - numeric) < Math.abs(closest - numeric) ? rank : closest, ranks[0])
}

function updateRank(value: unknown) {
  if (value === null || value === undefined || !availableRanks.value.length) {
    return
  }
  const rank = normalizeRank(value)
  if (rank !== Number(props.modelValue)) {
    emit("update:modelValue", rank)
  }
}

function rankTooltip(value: number) {
  return `第 ${normalizeRank(value)} 套`
}
</script>

<template>
  <div v-if="hasValidResults" class="optimizer-result-selector ui-layout-scope" data-layout-surface="optimizer-result-selector">
    <div class="optimizer-result-control-row">
      <NSlider
        class="optimizer-result-slider"
        data-testid="optimizer-result-slider"
        :value="currentRank"
        :min="minRank"
        :max="maxRank"
        :step="1"
        :marks="rankMarks"
        :disabled="!hasMultipleResults"
        :format-tooltip="rankTooltip"
        @update:value="updateRank"
      />
      <NInputNumber
        class="optimizer-result-rank-input"
        data-testid="optimizer-result-rank-input"
        :value="currentRank"
        :min="minRank"
        :max="maxRank"
        :step="1"
        :precision="0"
        :disabled="!hasMultipleResults"
        button-placement="both"
        size="small"
        aria-label="优化结果套数"
        @update:value="updateRank"
      />
    </div>

    <div
      class="optimizer-result-ratio"
      :style="ratioStyle"
      role="progressbar"
      aria-label="当前优化结果相对第一套的评分比例"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="scorePercentage ?? undefined"
    >
      <span class="optimizer-result-ratio-fill"></span>
      <strong>第 {{ currentRank }} 套 · {{ percentageText }} · 评分 {{ scoreText }}</strong>
    </div>
  </div>
</template>

<style scoped>
.optimizer-result-selector {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.optimizer-result-control-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 132px;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.optimizer-result-slider {
  min-width: 0;
  padding-inline: 8px;
}

.optimizer-result-rank-input {
  width: 132px;
}

.optimizer-result-ratio {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 36px;
  overflow: hidden;
  padding: 8px 12px;
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: #f1f5f9;
  color: var(--app-text);
  text-align: center;
}

.optimizer-result-ratio-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--optimizer-result-ratio);
  background: #dbeafe;
  transition: width 160ms ease;
}

.optimizer-result-ratio strong {
  position: relative;
  z-index: 1;
  max-width: 100%;
  font-size: 13px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

@container ui-layout (max-width: 680px) {
  .optimizer-result-control-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .optimizer-result-rank-input {
    justify-self: end;
  }
}
</style>
