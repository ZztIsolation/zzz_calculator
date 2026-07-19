<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NModal, NTag } from "naive-ui"
import { RefreshCcw } from "lucide-vue-next"
import {
  analyzeDriveDiscStatDiffs,
  analyzeDriveDiscStatGains,
  analyzeDriveDiscSubstats,
} from "@core/driveDiscAnalysis-core.js"
import { formatStoredStatValue } from "@core/shared-combat.js"
import { formatNumber, formatPercent, statLabel } from "@/utils/format"

type AnalysisView = "diff" | "substats" | "gains"
type GainDisplayMode = "cumulative" | "marginal"

const props = withDefaults(defineProps<{
  show: boolean
  catalog: any
  meta: any
  input: any
  sourceLabel?: string
  maxRolls?: number
}>(), {
  sourceLabel: "",
  maxRolls: 10,
})

const emit = defineEmits<{
  "update:show": [value: boolean]
}>()

const CHART_COLORS = [
  "#2f7df6",
  "#0f9f6e",
  "#b7791f",
  "#7c3aed",
  "#d14343",
  "#374151",
  "#16a34a",
  "#ea580c",
  "#64748b",
  "#0891b2",
]

const activeView = ref<AnalysisView>("diff")
const gainDisplayMode = ref<GainDisplayMode>("cumulative")
const analysisData = ref<any>(null)
const analysisError = ref("")

const analysisTabs: Array<{ label: string, value: AnalysisView }> = [
  { label: "差异计算", value: "diff" },
  { label: "当前副词条", value: "substats" },
  { label: "收益曲线", value: "gains" },
]

const gainModeTabs: Array<{ label: string, value: GainDisplayMode }> = [
  { label: "累计提升", value: "cumulative" },
  { label: "边际收益", value: "marginal" },
]

const driveDiscCount = computed(() => Array.isArray(props.input?.driveDiscs) ? props.input.driveDiscs.length : 0)
const sourceText = computed(() => props.sourceLabel || "当前驱动盘方案")
const baselineDamage = computed(() =>
  analysisData.value?.diffs?.baseline?.finalDamage
  ?? analysisData.value?.gains?.baseline?.finalDamage
  ?? null)
const substatRows = computed(() => analysisData.value?.substats?.stats ?? [])
const substatDiffRows = computed(() => analysisData.value?.diffs?.substatDiffs ?? [])
const mainStatSlots = computed<any[]>(() => (Object.values(analysisData.value?.diffs?.mainStatDiffsBySlot ?? {}) as any[])
  .sort((left: any, right: any) => Number(left.slot) - Number(right.slot)))
const replacementRows = computed(() => (analysisData.value?.diffs?.substatReplacements ?? [])
  .map((row: any) => {
    const best = [...(row.candidates ?? [])]
      .filter((candidate: any) => candidate.stat !== row.stat)
      .sort((left: any, right: any) =>
        Number(right.absoluteDiff ?? 0) - Number(left.absoluteDiff ?? 0)
        || String(left.stat).localeCompare(String(right.stat), "zh-CN"))[0]
    return { ...row, best }
  })
  .filter((row: any) => row.best))

const chartSize = {
  width: 760,
  height: 280,
  paddingLeft: 52,
  paddingRight: 24,
  paddingTop: 24,
  paddingBottom: 42,
}

const gainSeries = computed(() => {
  const baseline = Number(analysisData.value?.gains?.baseline?.finalDamage ?? 0)
  return (analysisData.value?.gains?.stats ?? [])
    .map((item: any, index: number) => {
      const points = pointsWithMarginalGains(item.points ?? [], baseline)
      return {
        ...item,
        points,
        color: CHART_COLORS[index % CHART_COLORS.length],
        oneRoll: points[0] ?? null,
        maxGain: Math.max(0, ...points.map(point => gainPointValue(point))),
      }
    })
    .filter((item: any) => item.maxGain > 0)
    .sort((left: any, right: any) =>
      gainPointValue(right.oneRoll) - gainPointValue(left.oneRoll)
      || String(left.stat).localeCompare(String(right.stat), "zh-CN"))
})
const chartMaxRoll = computed(() => Math.max(1, ...gainSeries.value.flatMap((item: any) =>
  (item.points ?? []).map((point: any) => Number(point.rolls ?? 1)))))
const chartMaxGain = computed(() => Math.max(0.000001, ...gainSeries.value.flatMap((item: any) =>
  (item.points ?? []).map((point: any) => gainPointValue(point)))))
const chartGridLines = computed(() => [0, 0.25, 0.5, 0.75, 1].map(rate => {
  const y = chartY(chartMaxGain.value * rate)
  return {
    key: String(rate),
    y,
    label: percentText(chartMaxGain.value * rate, 1),
  }
}))
const chartRollTicks = computed(() => Array.from({ length: chartMaxRoll.value }, (_, index) => {
  const roll = index + 1
  return {
    roll,
    x: chartX(roll),
  }
}))
const oneRollGainTotal = computed(() => gainSeries.value.reduce((sum: number, item: any) =>
  sum + Math.max(0, gainPointValue(item.oneRoll)), 0))
const lastGainRoll = computed(() => Math.max(1, ...gainSeries.value.flatMap((item: any) =>
  (item.points ?? []).map((point: any) => Number(point.rolls ?? 1)))))

watch(() => props.show, visible => {
  if (visible) {
    activeView.value = "diff"
    gainDisplayMode.value = "cumulative"
    refreshAnalysis()
  }
}, { immediate: true })

watch(() => [props.catalog, props.input], () => {
  if (props.show) {
    refreshAnalysis()
  }
})

function setShow(value: boolean) {
  emit("update:show", value)
}

function refreshAnalysis() {
  analysisError.value = ""
  try {
    if (!props.catalog || !props.input) {
      throw new Error("计算数据尚未加载完成。")
    }
    if (!driveDiscCount.value) {
      throw new Error("请先选择或计算一套驱动盘。")
    }
    analysisData.value = {
      diffs: analyzeDriveDiscStatDiffs(props.catalog, props.input),
      substats: analyzeDriveDiscSubstats(props.catalog, props.input),
      gains: analyzeDriveDiscStatGains(props.catalog, {
        ...props.input,
        maxRolls: props.maxRolls,
      }),
    }
  } catch (error) {
    analysisData.value = null
    analysisError.value = error instanceof Error ? error.message : String(error)
  }
}

function statName(stat: string) {
  return statLabel(stat, props.meta)
}

function numberText(value: unknown, digits = 3) {
  return formatNumber(value, digits)
}

function percentText(value: unknown, digits = 3) {
  return formatPercent(value, digits)
}

function signedNumberText(value: unknown, digits = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return "-"
  }
  if (Math.abs(number) < 1e-9) {
    return "0"
  }
  return `${number > 0 ? "+" : "-"}${numberText(Math.abs(number), digits)}`
}

function signedPercentText(value: unknown, digits = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return "-"
  }
  if (Math.abs(number) < 1e-12) {
    return "0%"
  }
  return `${number > 0 ? "+" : "-"}${percentText(Math.abs(number), digits)}`
}

function storedValue(stat: string, value: unknown, mode = "") {
  return formatStoredStatValue(stat, Number(value), { percentMode: mode === "pct", mode })
}

function diffTone(value: unknown) {
  const number = Number(value)
  if (number > 0) {
    return "positive"
  }
  if (number < 0) {
    return "negative"
  }
  return "neutral"
}

function substatBarWidth(item: any) {
  const total = Math.max(0.000001, Number(analysisData.value?.substats?.totalEffectiveRolls ?? 0))
  const width = (Number(item?.effectiveRolls ?? 0) / total) * 100
  return `${Math.max(2, Math.min(100, width))}%`
}

function slotSourceText(source: string) {
  return source === "preferredDriveDiscs" ? "角色优先配置" : "槽位可选池"
}

function currentMainStatText(current: any) {
  if (!current) {
    return "未选择"
  }
  return `${statName(current.stat)} ${storedValue(current.stat, current.value, current.mode)}`
}

function gainModeLabel(mode = gainDisplayMode.value) {
  return mode === "marginal" ? "边际收益" : "累计提升"
}

function gainPointValue(point: any, mode = gainDisplayMode.value) {
  return Number(mode === "marginal" ? point?.marginalRelativeGain : point?.relativeGain) || 0
}

function gainPointAbsoluteValue(point: any, mode = gainDisplayMode.value) {
  return Number(mode === "marginal" ? point?.marginalAbsoluteGain : point?.absoluteGain) || 0
}

function pointsWithMarginalGains(points: any[] = [], baselineFinalDamage = 0) {
  let previousDamage = Number(baselineFinalDamage) || 0
  return points.map(point => {
    const finalDamage = Number(point.finalDamage ?? 0)
    const marginalAbsoluteGain = finalDamage - previousDamage
    const marginalRelativeGain = previousDamage > 0 ? marginalAbsoluteGain / previousDamage : 0
    previousDamage = finalDamage
    return {
      ...point,
      marginalAbsoluteGain: Number.isFinite(marginalAbsoluteGain) ? Number(marginalAbsoluteGain.toFixed(6)) : 0,
      marginalRelativeGain: Number.isFinite(marginalRelativeGain) ? Number(marginalRelativeGain.toFixed(10)) : 0,
    }
  })
}

function chartX(rolls: unknown) {
  const plotWidth = chartSize.width - chartSize.paddingLeft - chartSize.paddingRight
  return chartSize.paddingLeft + ((Number(rolls) - 1) / Math.max(1, chartMaxRoll.value - 1)) * plotWidth
}

function chartY(value: unknown) {
  const plotHeight = chartSize.height - chartSize.paddingTop - chartSize.paddingBottom
  return chartSize.paddingTop + plotHeight - (Number(value) / chartMaxGain.value) * plotHeight
}

function seriesPoints(item: any) {
  return (item.points ?? [])
    .map((point: any) => `${chartX(point.rolls)},${chartY(gainPointValue(point))}`)
    .join(" ")
}

function oneRollBarWidth(item: any) {
  const total = oneRollGainTotal.value
  if (total <= 0) {
    return "0%"
  }
  return `${Math.max(2, (Math.max(0, gainPointValue(item.oneRoll)) / total) * 100)}%`
}

function lastPoint(item: any) {
  const points = item?.points ?? []
  return points[points.length - 1] ?? null
}
</script>

<template>
  <NModal
    :show="props.show"
    preset="card"
    title="驱动盘词条分析"
    style="width: min(1120px, calc(100vw - 32px)); max-width: 1120px"
    @update:show="setShow"
  >
    <div class="drive-disc-analysis section-band ui-layout-scope" data-layout-surface="drive-disc-analysis">
      <div class="analysis-context">
        <div class="section-band">
          <div class="chip-row">
            <NTag round>{{ sourceText }}</NTag>
            <NTag round>{{ driveDiscCount }} / 6</NTag>
            <NTag v-if="baselineDamage !== null" round>基准伤害 {{ numberText(baselineDamage, 3) }}</NTag>
          </div>
          <p class="muted analysis-context-copy">按当前角色、音擎、局内 Buff、伤害目标和驱动盘方案计算。</p>
        </div>
        <NButton size="small" @click="refreshAnalysis">
          <template #icon><RefreshCcw :size="16" /></template>
          刷新
        </NButton>
      </div>

      <div class="toolbar">
        <NButton
          v-for="tab in analysisTabs"
          :key="tab.value"
          size="small"
          :type="activeView === tab.value ? 'primary' : 'default'"
          @click="activeView = tab.value"
        >
          {{ tab.label }}
        </NButton>
      </div>

      <div v-if="analysisError" class="empty-state">{{ analysisError }}</div>
      <div v-else-if="!analysisData" class="empty-state">等待分析</div>

      <template v-else-if="activeView === 'substats'">
        <div class="metric-grid analysis-summary-grid">
          <dl class="metric" data-layout-field><dt>驱动盘数量</dt><dd>{{ analysisData.substats.driveDiscCount }}</dd></dl>
          <dl class="metric" data-layout-field><dt>总有效词条</dt><dd>{{ numberText(analysisData.substats.totalEffectiveRolls, 3) }}</dd></dl>
          <dl class="metric" data-layout-field><dt>统计口径</dt><dd>副词条</dd></dl>
        </div>

        <div v-if="!substatRows.length" class="empty-state">当前驱动盘没有可统计的副词条。</div>
        <template v-else>
          <div class="analysis-bar-list">
            <div v-for="(item, index) in substatRows" :key="item.stat" class="analysis-bar-row">
              <span>{{ statName(item.stat) }}</span>
              <div class="analysis-bar-track">
                <div
                  class="analysis-bar-fill"
                  :style="{ width: substatBarWidth(item), background: CHART_COLORS[index % CHART_COLORS.length] }"
                ></div>
              </div>
              <strong>{{ numberText(item.effectiveRolls, 2) }}</strong>
            </div>
          </div>

          <div class="analysis-table-wrap">
            <table class="data-table analysis-table">
              <thead>
                <tr>
                  <th>词条</th>
                  <th>当前值</th>
                  <th>单词条值</th>
                  <th>有效词条</th>
                  <th>出现次数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in substatRows" :key="item.stat">
                  <td>{{ statName(item.stat) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.value, item.mode) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.step, item.mode) }}</td>
                  <td class="num">{{ numberText(item.effectiveRolls, 3) }}</td>
                  <td class="num">{{ item.occurrenceCount ?? 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>

      <template v-else-if="activeView === 'gains'">
        <div class="metric-grid analysis-summary-grid">
          <dl class="metric" data-layout-field><dt>基准伤害</dt><dd>{{ numberText(analysisData.gains.baseline?.finalDamage, 3) }}</dd></dl>
          <dl class="metric" data-layout-field><dt>最大新增</dt><dd>{{ analysisData.gains.maxRolls ?? props.maxRolls }} 词条</dd></dl>
          <dl class="metric" data-layout-field><dt>显示模式</dt><dd>{{ gainModeLabel() }}</dd></dl>
        </div>

        <div class="analysis-mode-row">
          <div class="toolbar">
            <NButton
              v-for="mode in gainModeTabs"
              :key="mode.value"
              size="small"
              :type="gainDisplayMode === mode.value ? 'primary' : 'default'"
              @click="gainDisplayMode = mode.value"
            >
              {{ mode.label }}
            </NButton>
          </div>
          <span>{{ gainDisplayMode === "marginal" ? "第 n 条词条相对第 n-1 条后的提升" : "新增 n 条词条后相对当前基准的提升" }}</span>
        </div>

        <div v-if="!gainSeries.length" class="empty-state">当前配置下没有可见的副词条收益。</div>
        <template v-else>
          <div class="analysis-line-chart-wrap">
            <svg class="analysis-line-chart" :viewBox="`0 0 ${chartSize.width} ${chartSize.height}`" role="img" aria-label="词条收益曲线">
              <g v-for="line in chartGridLines" :key="line.key">
                <line :x1="chartSize.paddingLeft" :y1="line.y" :x2="chartSize.width - chartSize.paddingRight" :y2="line.y" class="analysis-grid-line"></line>
                <text x="8" :y="line.y + 4" class="analysis-axis-label">{{ line.label }}</text>
              </g>
              <line :x1="chartSize.paddingLeft" :y1="chartSize.paddingTop" :x2="chartSize.paddingLeft" :y2="chartSize.height - chartSize.paddingBottom" class="analysis-axis-line"></line>
              <line :x1="chartSize.paddingLeft" :y1="chartSize.height - chartSize.paddingBottom" :x2="chartSize.width - chartSize.paddingRight" :y2="chartSize.height - chartSize.paddingBottom" class="analysis-axis-line"></line>
              <g v-for="tick in chartRollTicks" :key="tick.roll">
                <line :x1="tick.x" :y1="chartSize.height - chartSize.paddingBottom" :x2="tick.x" :y2="chartSize.height - chartSize.paddingBottom + 5" class="analysis-axis-line"></line>
                <text :x="tick.x" :y="chartSize.height - 15" class="analysis-axis-label analysis-axis-label-x">{{ tick.roll }}</text>
              </g>
              <polyline
                v-for="item in gainSeries"
                :key="item.stat"
                :points="seriesPoints(item)"
                fill="none"
                :stroke="item.color"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></polyline>
            </svg>
          </div>

          <div class="analysis-legend">
            <span v-for="item in gainSeries" :key="item.stat">
              <i :style="{ background: item.color }"></i>{{ statName(item.stat) }}
            </span>
          </div>

          <div class="analysis-bar-list">
            <h3>下一条{{ gainModeLabel() }}</h3>
            <div v-for="item in gainSeries" :key="item.stat" class="analysis-bar-row">
              <span>{{ statName(item.stat) }}</span>
              <div class="analysis-bar-track">
                <div class="analysis-bar-fill" :style="{ width: oneRollBarWidth(item), background: item.color }"></div>
              </div>
              <strong>{{ percentText(gainPointValue(item.oneRoll), 3) }}</strong>
            </div>
          </div>

          <div class="analysis-table-wrap">
            <table class="data-table analysis-table">
              <thead>
                <tr>
                  <th>词条</th>
                  <th>单词条值</th>
                  <th>{{ gainDisplayMode === "marginal" ? "第1条边际收益" : "1 词条提升" }}</th>
                  <th>{{ gainDisplayMode === "marginal" ? `第${lastGainRoll}条边际收益` : `${lastGainRoll} 词条提升` }}</th>
                  <th>1 词条伤害</th>
                  <th>1 词条差值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in gainSeries" :key="item.stat">
                  <td>{{ statName(item.stat) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.step, item.mode) }}</td>
                  <td class="num">{{ percentText(gainPointValue(item.oneRoll), 3) }}</td>
                  <td class="num">{{ percentText(gainPointValue(lastPoint(item)), 3) }}</td>
                  <td class="num">{{ numberText(item.oneRoll?.finalDamage, 3) }}</td>
                  <td class="num">{{ signedNumberText(gainPointAbsoluteValue(item.oneRoll), 3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>

      <template v-else>
        <div class="metric-grid analysis-summary-grid">
          <dl class="metric" data-layout-field><dt>基准伤害</dt><dd>{{ numberText(analysisData.diffs.baseline?.finalDamage, 3) }}</dd></dl>
          <dl class="metric" data-layout-field><dt>副词条候选</dt><dd>{{ substatDiffRows.length }}</dd></dl>
          <dl class="metric" data-layout-field><dt>主词条槽位</dt><dd>4 / 5 / 6</dd></dl>
        </div>

        <section class="analysis-section">
          <h3>副词条差异计算</h3>
          <div v-if="!substatDiffRows.length" class="empty-state compact">当前伤害目标下没有可见的副词条边际收益。</div>
          <div v-else class="analysis-table-wrap">
            <table class="data-table analysis-table">
              <thead>
                <tr>
                  <th>候选副词条</th>
                  <th>当前值</th>
                  <th>新增一条</th>
                  <th>伤害差值</th>
                  <th>百分比差值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in substatDiffRows" :key="item.stat">
                  <td>{{ statName(item.stat) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.currentValue, item.mode) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.addedValue, item.mode) }}</td>
                  <td class="num analysis-diff-cell" :class="diffTone(item.absoluteDiff)">{{ signedNumberText(item.absoluteDiff, 3) }}</td>
                  <td class="num analysis-diff-cell" :class="diffTone(item.relativeDiff)">{{ signedPercentText(item.relativeDiff, 3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="replacementRows.length" class="analysis-section">
          <h3>已有副词条替换参考</h3>
          <div class="analysis-table-wrap">
            <table class="data-table analysis-table">
              <thead>
                <tr>
                  <th>当前词条</th>
                  <th>移除一条</th>
                  <th>最优替换</th>
                  <th>新增一条</th>
                  <th>伤害差值</th>
                  <th>百分比差值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in replacementRows" :key="item.stat">
                  <td>{{ statName(item.stat) }}</td>
                  <td class="num">{{ storedValue(item.stat, item.removedValue, item.mode) }}</td>
                  <td>{{ statName(item.best.stat) }}</td>
                  <td class="num">{{ storedValue(item.best.stat, item.best.addedValue, item.best.mode) }}</td>
                  <td class="num analysis-diff-cell" :class="diffTone(item.best.absoluteDiff)">{{ signedNumberText(item.best.absoluteDiff, 3) }}</td>
                  <td class="num analysis-diff-cell" :class="diffTone(item.best.relativeDiff)">{{ signedPercentText(item.best.relativeDiff, 3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="analysis-section">
          <h3>主词条差异计算</h3>
          <div v-if="!mainStatSlots.length" class="empty-state compact">暂无可分析的主词条槽位。</div>
          <div v-else class="analysis-slot-grid ui-field-grid ui-field-grid--comfortable" data-layout-surface="drive-disc-analysis-slots">
            <article v-for="slot in mainStatSlots" :key="slot.slot" class="analysis-slot-block">
              <div class="analysis-slot-head">
                <strong>{{ slot.slot }}号位</strong>
                <span>当前：{{ currentMainStatText(slot.current) }}</span>
                <em>{{ slotSourceText(slot.source) }}</em>
              </div>
              <div v-if="!(slot.candidates ?? []).length" class="empty-state compact">当前主词条已经是该槽位唯一候选。</div>
              <div v-else class="analysis-table-wrap analysis-slot-table-wrap">
                <table class="data-table analysis-table analysis-slot-table">
                  <thead>
                    <tr>
                      <th>替换为</th>
                      <th>候选数值</th>
                      <th>伤害差值</th>
                      <th>百分比差值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in slot.candidates" :key="item.stat">
                      <td data-label="替换为">{{ statName(item.stat) }}</td>
                      <td class="num" data-label="候选数值">{{ storedValue(item.stat, item.value, item.mode) }}</td>
                      <td class="num analysis-diff-cell" data-label="伤害差值" :class="diffTone(item.absoluteDiff)">{{ signedNumberText(item.absoluteDiff, 3) }}</td>
                      <td class="num analysis-diff-cell" data-label="百分比差值" :class="diffTone(item.relativeDiff)">{{ signedPercentText(item.relativeDiff, 3) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </NModal>
</template>

<style scoped>
.drive-disc-analysis {
  max-height: min(calc(100dvh - 120px), 820px);
  overflow: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.analysis-context {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}

.analysis-context-copy {
  margin: 0;
  line-height: 1.45;
}

.analysis-summary-grid {
  --ui-field-min: 160px;
}

.analysis-mode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  color: var(--app-muted);
  font-size: 13px;
}

.analysis-section {
  display: grid;
  gap: 10px;
}

.analysis-section h3,
.analysis-bar-list h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 750;
}

.analysis-table-wrap {
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.analysis-table th,
.analysis-table td {
  white-space: nowrap;
}

.analysis-diff-cell.positive {
  color: var(--app-green);
  font-weight: 800;
}

.analysis-diff-cell.negative {
  color: var(--app-red);
  font-weight: 800;
}

.analysis-diff-cell.neutral {
  color: var(--app-muted);
}

.analysis-bar-list {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.analysis-bar-row {
  display: grid;
  grid-template-columns: minmax(90px, 150px) minmax(120px, 1fr) minmax(64px, auto);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.analysis-bar-row span {
  min-width: 0;
  overflow: visible;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 700;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}

.analysis-bar-row strong {
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.analysis-bar-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #dde6f5;
}

.analysis-bar-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
}

.analysis-line-chart-wrap {
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.analysis-line-chart {
  display: block;
  width: min(100%, 760px);
  min-width: 620px;
  height: auto;
}

.analysis-grid-line {
  stroke: #e5e7eb;
  stroke-width: 1;
}

.analysis-axis-line {
  stroke: #94a3b8;
  stroke-width: 1.2;
}

.analysis-axis-label {
  fill: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

.analysis-axis-label-x {
  text-anchor: middle;
}

.analysis-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

.analysis-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.analysis-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.analysis-slot-grid {
  --ui-field-min: 360px;
  gap: 12px;
}

.analysis-slot-block {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.analysis-slot-head {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.analysis-slot-head strong {
  font-size: 14px;
}

.analysis-slot-head span {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.analysis-slot-head em {
  color: var(--app-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.analysis-slot-table-wrap {
  overflow-x: hidden;
}

.analysis-slot-table {
  table-layout: fixed;
}

.analysis-slot-table th,
.analysis-slot-table td {
  padding: 9px 8px;
}

.analysis-slot-table th {
  line-height: 1.35;
  white-space: normal;
}

.analysis-slot-table th:nth-child(1) {
  width: 30%;
}

.analysis-slot-table th:nth-child(2) {
  width: 20%;
}

.analysis-slot-table th:nth-child(3) {
  width: 28%;
}

.analysis-slot-table th:nth-child(4) {
  width: 22%;
}

.analysis-slot-table td:first-child {
  overflow-wrap: anywhere;
  white-space: normal;
}

.empty-state.compact {
  min-height: 72px;
  padding: 12px;
  text-align: center;
}

@container ui-layout (max-width: 720px) {
  .analysis-context {
    grid-template-columns: minmax(0, 1fr);
  }

  .analysis-bar-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .analysis-bar-row strong {
    text-align: left;
  }
}

@container ui-layout (max-width: 520px) {
  .drive-disc-analysis {
    max-height: calc(100dvh - 104px);
  }

  .analysis-slot-block {
    padding: 10px;
  }

  .analysis-slot-table,
  .analysis-slot-table tbody {
    display: block;
    width: 100%;
  }

  .analysis-slot-table thead {
    display: none;
  }

  .analysis-slot-table tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    padding: 10px;
    border-bottom: 1px solid var(--app-border);
  }

  .analysis-slot-table tr:last-child {
    border-bottom: 0;
  }

  .analysis-slot-table td {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 0;
    border-bottom: 0;
    font-size: 12px;
    overflow-wrap: anywhere;
    text-align: left;
    white-space: normal;
  }

  .analysis-slot-table td::before {
    content: attr(data-label);
    color: var(--app-muted);
    font-size: 11px;
    font-weight: 700;
  }
}
</style>
