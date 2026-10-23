<script setup lang="ts">
import { computed, watch } from "vue"
import { NInputNumber, NSlider } from "naive-ui"
import { formatNumber } from "@/utils/format"
import type { EffectiveDriveDiscSubstatCounts } from "@/utils/driveDiscSubstats"

interface OptimizerResultOption {
  rank: number
  score: number
}

const props = withDefaults(defineProps<{
  modelValue: number
  results: OptimizerResultOption[]
  currentScore?: number | null
  referenceScore?: number | null
  effectiveSubstatCounts?: EffectiveDriveDiscSubstatCounts | null
  stale?: boolean
  showRank?: boolean
  showControls?: boolean
  showPercentage?: boolean
  scoreLabel?: string
  scoreSuffix?: string
  scoreDigits?: number
}>(), {
  showRank: true,
  showControls: true,
  showPercentage: true,
})

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
const selectedScore = computed(() => {
  const explicitScore = Number(props.currentScore)
  if (Number.isFinite(explicitScore)) return explicitScore
  return Number(selectedResult.value?.score)
})
const referenceScore = computed(() => {
  const explicitScore = Number(props.referenceScore)
  if (Number.isFinite(explicitScore)) return explicitScore
  return Number(bestResult.value?.score)
})
const showRank = computed(() => props.showRank !== false)
const showControls = computed(() => props.showControls !== false)
const showPercentage = computed(() => props.showPercentage !== false)
const hasValidResults = computed(() => {
  if (Number.isFinite(Number(props.currentScore))) {
    return Number.isFinite(selectedScore.value) && selectedScore.value > 0
  }
  return normalizedResults.value.length > 0 && Number.isFinite(referenceScore.value) && referenceScore.value > 0
})
const scorePercentage = computed<number | null>(() => {
  if (!showPercentage.value
    || !Number.isFinite(referenceScore.value)
    || referenceScore.value <= 0
    || !Number.isFinite(selectedScore.value)) {
    return null
  }
  return Math.max(0, Math.min(100, (selectedScore.value / referenceScore.value) * 100))
})
const percentageText = computed(() => {
  if (scorePercentage.value === null) {
    return "-"
  }
  const rounded = Math.round(scorePercentage.value * 10) / 10
  return rounded === 100 ? "100%" : `${rounded.toFixed(1)}%`
})
const scoreText = computed(() => {
  const score = selectedScore.value
  if (!Number.isFinite(score)) return "-"
  const suffix = String(props.scoreSuffix ?? "").trim()
  return `${formatNumber(score, props.scoreDigits ?? 0)}${suffix ? ` ${suffix}` : ""}`
})
const displayedScoreLabel = computed(() => `${props.stale ? "上次" : ""}${props.scoreLabel ?? "评分"}`)
const ratioAriaLabel = computed(() => {
  if (!showPercentage.value) return `当前方案${displayedScoreLabel.value}`
  if (showRank.value) return `当前优化结果相对第一套的${displayedScoreLabel.value}比例`
  return `当前方案相对优化第一套的${displayedScoreLabel.value}比例`
})
// 评分下方的说明：第几套、相对第一套的比例
const resultCaptionText = computed(() => [
  showRank.value ? `第 ${currentRank.value} 套` : "",
  showPercentage.value ? `${showRank.value ? "相对第一套" : "相对优化第一套"} ${percentageText.value}` : "",
].filter(Boolean).join(" · "))
// 有效副词条合成一个指标：大号数字为总数（穿透值重要时含穿透值），下方补充不含穿透值的数量
const effectiveSubstatSummary = computed(() => {
  const counts = props.effectiveSubstatCounts
  if (!counts) return null
  const total = Math.max(0, Math.round(Number(counts.total) || 0))
  if (!counts.includesPenFlat) {
    return { total, withoutPenFlat: null as number | null, title: `有效副词条数量 ${total}` }
  }
  const withoutPenFlat = Math.max(0, Math.round(Number(counts.withoutPenFlat) || 0))
  return { total, withoutPenFlat, title: `有效副词条数量（包含穿透值）${total}，不含穿透值 ${withoutPenFlat}` }
})
const ratioStyle = computed(() => ({
  "--optimizer-result-ratio": `${scorePercentage.value ?? 0}%`,
}))

watch([() => props.modelValue, availableRankKey], () => {
  if (!showControls.value || !hasValidResults.value) {
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
    <div v-if="showControls" class="optimizer-result-control-row">
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
      <div class="optimizer-result-rank-controls">
        <slot name="rank-actions" />
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
    </div>

    <div class="optimizer-result-metrics" :class="{ 'is-stale': props.stale }">
      <div
        class="optimizer-result-score"
        :role="showPercentage ? undefined : 'group'"
        :aria-label="showPercentage ? undefined : ratioAriaLabel"
      >
        <span class="optimizer-result-metric-label">{{ displayedScoreLabel }}</span>
        <strong class="optimizer-result-score-value num">{{ scoreText }}</strong>
        <div
          v-if="showPercentage"
          class="optimizer-result-ratio"
          :class="{ 'is-stale': props.stale }"
          :style="ratioStyle"
          role="progressbar"
          :aria-label="ratioAriaLabel"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="scorePercentage ?? undefined"
        >
          <span class="optimizer-result-ratio-fill"></span>
        </div>
        <span v-if="resultCaptionText" class="optimizer-result-caption">{{ resultCaptionText }}</span>
      </div>
      <div
        v-if="effectiveSubstatSummary"
        class="optimizer-result-effective-substats"
        role="group"
        :aria-label="effectiveSubstatSummary.title"
        :title="effectiveSubstatSummary.title"
      >
        <span class="optimizer-result-metric-label">有效副词条</span>
        <b class="optimizer-result-effective-total num">{{ effectiveSubstatSummary.total }}</b>
        <small v-if="effectiveSubstatSummary.withoutPenFlat !== null" class="optimizer-result-effective-note">
          不含穿透值 <b class="num">{{ effectiveSubstatSummary.withoutPenFlat }}</b>
        </small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.optimizer-result-selector {
  display: grid;
  gap: 12px;
  min-width: 0;
}

/* 第几套滑轨与右侧输入框，右侧还可插入“一键锁定”等操作 */
.optimizer-result-control-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto;
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
  flex: 0 0 132px;
}

.optimizer-result-rank-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

/* 评分区：左侧大号评分 + 比例条，右侧有效副词条 */
.optimizer-result-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(96px, auto);
  align-items: stretch;
  gap: 8px;
  min-width: 0;
}

.optimizer-result-score,
.optimizer-result-effective-substats {
  display: grid;
  align-content: center;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted, #f4f6fa);
}

.optimizer-result-metrics.is-stale .optimizer-result-score {
  border-color: var(--app-amber-line);
  background: var(--app-amber-soft);
}

.optimizer-result-metric-label {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.optimizer-result-score-value {
  color: var(--app-text);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.optimizer-result-ratio {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-panel-sunken);
}

.optimizer-result-ratio-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--optimizer-result-ratio);
  border-radius: inherit;
  background: var(--app-blue-soft);
  transition: width 160ms ease;
}

.optimizer-result-ratio.is-stale .optimizer-result-ratio-fill {
  background: var(--app-amber-soft);
}

.optimizer-result-caption {
  color: var(--app-text-secondary, #334155);
  font-size: 12px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.optimizer-result-effective-total {
  color: var(--app-text);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
}

.optimizer-result-effective-note {
  color: var(--app-muted);
  font-size: 12px;
  white-space: nowrap;
}

.optimizer-result-effective-note b {
  color: var(--app-text);
  font-weight: 800;
}

@media (prefers-reduced-motion: reduce) {
  .optimizer-result-ratio-fill {
    transition: none;
  }
}

@container ui-layout (max-width: 420px) {
  .optimizer-result-metrics {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
