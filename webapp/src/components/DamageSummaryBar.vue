<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { NTag } from "naive-ui"
import { formatNumber } from "@/utils/format"

const props = defineProps<{
  result: any
  loading?: boolean
  error?: string
  /** 计算对象标识（如角色 ID）；变化时只重置基准，不显示涨跌 */
  contextKey?: string
}>()

const damage = computed(() => props.result?.damage ?? {})
const objectiveKind = computed(() => damage.value?.objectiveKind ?? props.result?.objectiveKind)
const isLuminescenceScore = computed(() => ["luminescenceTeamScore", "luminescenceScore"].includes(String(objectiveKind.value ?? "")) || damage.value?.normalizedObjective === true)
const displayedDamage = computed(() => isLuminescenceScore.value
  ? damage.value?.score ?? damage.value?.finalDamage ?? damage.value?.totalFinalDamage ?? 0
  : damage.value?.totalFinalDamage ?? damage.value?.finalDamage ?? 0)
const scalarBlocked = computed(() => props.result?.damage?.scalarReady === false)
// 还没有任何结果时显示占位条，不把“未计算”显示成 0
const pending = computed(() => !props.error && (!props.result || (Boolean(props.loading) && !Number(displayedDamage.value))))
const damageLabel = computed(() => isLuminescenceScore.value ? "当前队伍异常评分" : "当前最终伤害")
const displayedValue = computed(() => {
  const value = formatNumber(displayedDamage.value, isLuminescenceScore.value ? 3 : 0)
  if (!isLuminescenceScore.value) return value
  return `${value} ${String(damage.value?.scoreSuffix ?? props.result?.scoreSuffix ?? "× k")}`
})
const statusType = computed(() => props.error ? "error" : scalarBlocked.value ? "warning" : "success")
const statusText = computed(() => props.error
  || (props.loading || pending.value ? "加载中" : scalarBlocked.value ? "参数待确认" : "即时刷新"))

// 数值变化提示：数值稳定后与上一次稳定值比较，显示涨跌幅，几秒后淡出。
// 一次操作可能连续重算多次（例如换盘后 4 件套触发参数下一拍才更新），
// 只比较稳定下来的值，避免中间值让提示来回跳。
const DELTA_SETTLE_MS = 300
const DELTA_VISIBLE_MS = 5000
type Sample = { value: number, kind: boolean, context: string }
const delta = ref<{ text: string, direction: number, id: number } | null>(null)
let baseline: Sample | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined
let deltaTimer: ReturnType<typeof setTimeout> | undefined
let deltaId = 0

function clearDelta() {
  clearTimeout(deltaTimer)
  delta.value = null
}

function settle(sample: Sample) {
  const previous = baseline
  baseline = sample
  // 首个结果或换了计算对象（角色、驱动盘方案）：只记基准，不显示涨跌
  if (!previous || previous.kind !== sample.kind || previous.context !== sample.context) return
  if (previous.value <= 0 || sample.value === previous.value) return
  const percent = (sample.value - previous.value) / previous.value * 100
  if (Math.abs(percent) < 0.05) return
  clearTimeout(deltaTimer)
  deltaId += 1
  delta.value = {
    text: `${percent > 0 ? "+" : "−"}${Math.abs(percent).toFixed(Math.abs(percent) >= 10 ? 1 : 2)}%`,
    direction: Math.sign(percent),
    id: deltaId,
  }
  deltaTimer = setTimeout(() => { delta.value = null }, DELTA_VISIBLE_MS)
}

watch(
  () => [displayedDamage.value, isLuminescenceScore.value, props.contextKey ?? "", pending.value, scalarBlocked.value, Boolean(props.error)] as const,
  ([value, kind, context, isPending, blocked, failed]) => {
    const numeric = Number(value)
    if (isPending || blocked || failed || !Number.isFinite(numeric)) return
    const sample = { value: numeric, kind, context }
    if (baseline && (baseline.kind !== kind || baseline.context !== context)) {
      // 换了计算对象：旧的涨跌立即清掉，不等稳定
      clearDelta()
    }
    clearTimeout(settleTimer)
    if (!baseline) {
      // 首个结果直接作为基准
      baseline = sample
      return
    }
    settleTimer = setTimeout(() => settle(sample), DELTA_SETTLE_MS)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearTimeout(settleTimer)
  clearTimeout(deltaTimer)
})
</script>

<template>
  <section class="summary-bar">
    <div class="summary-copy">
      <div class="muted">{{ damageLabel }}</div>
      <div class="summary-value-row">
        <div v-if="pending" class="summary-value-skeleton" role="status" aria-label="正在计算"></div>
        <div
          v-else
          :key="delta?.id ?? 0"
          class="summary-value num"
          :class="{ 'summary-value--changed': delta }"
        >
        {{ error ? "计算异常" : scalarBlocked ? "参数待确认" : displayedValue }}
        </div>
      </div>
    </div>
    <!-- 涨跌标签放在状态标签同一行：出现或消失都不改变数字所在行的布局 -->
    <div class="chip-row summary-chip-row">
      <NTag :type="statusType" round>
        {{ statusText }}
      </NTag>
      <Transition name="summary-delta">
        <span
          v-if="delta"
          :key="delta.id"
          class="summary-delta num"
          :class="delta.direction > 0 ? 'summary-delta--up' : 'summary-delta--down'"
          role="status"
          :aria-label="`较上次${delta.direction > 0 ? '提升' : '下降'} ${delta.text}`"
        >
          {{ delta.direction > 0 ? "▲" : "▼" }} {{ delta.text }}
        </span>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.summary-bar {
  grid-template-columns: minmax(0, 1fr);
}

.summary-bar > *,
.summary-bar .chip-row {
  min-width: 0;
  max-width: 100%;
}

.summary-bar :deep(.n-tag) {
  max-width: 100%;
  height: auto;
  white-space: normal;
}

.summary-bar :deep(.n-tag__content) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.summary-chip-row {
  align-items: center;
}

.summary-value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
}

.summary-value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-value--changed {
  animation: summary-value-flash 0.6s ease-out;
}

.summary-value-skeleton {
  width: min(220px, 70%);
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e6ebf2 0%, #f3f6fa 50%, #e6ebf2 100%);
  background-size: 200% 100%;
  animation: summary-skeleton 1.2s ease-in-out infinite;
}

.summary-delta {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.summary-delta--up {
  background: var(--app-green-soft, #e9f7f1);
  color: var(--app-green-strong, #087a55);
}

.summary-delta--down {
  background: #fdecec;
  color: #b42318;
}

.summary-delta-enter-active,
.summary-delta-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.summary-delta-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.summary-delta-leave-to {
  opacity: 0;
}

@keyframes summary-value-flash {
  0% { opacity: 0.35; transform: translateY(3px); }
  100% { opacity: 1; transform: none; }
}

@keyframes summary-skeleton {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .summary-value--changed,
  .summary-value-skeleton {
    animation: none;
  }

  .summary-delta-enter-active,
  .summary-delta-leave-active {
    transition: none;
  }
}
</style>
