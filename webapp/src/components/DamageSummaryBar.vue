<script setup lang="ts">
import { computed } from "vue"
import { NTag } from "naive-ui"
import { formatNumber } from "@/utils/format"

const props = defineProps<{
  result: any
  loading?: boolean
  error?: string
}>()

const damage = computed(() => props.result?.damage ?? {})
const objectiveKind = computed(() => damage.value?.objectiveKind ?? props.result?.objectiveKind)
const isLuminescenceScore = computed(() => ["luminescenceTeamScore", "luminescenceScore"].includes(String(objectiveKind.value ?? "")) || damage.value?.normalizedObjective === true)
const displayedDamage = computed(() => isLuminescenceScore.value
  ? damage.value?.score ?? damage.value?.finalDamage ?? damage.value?.totalFinalDamage ?? 0
  : damage.value?.totalFinalDamage ?? damage.value?.finalDamage ?? 0)
const eventCount = computed(() => props.result?.damage?.events?.length ?? props.result?.damage?.eventResults?.length ?? 1)
const scalarBlocked = computed(() => props.result?.damage?.scalarReady === false)
const damageLabel = computed(() => isLuminescenceScore.value ? "当前队伍异常评分" : "当前最终伤害")
const displayedValue = computed(() => {
  const value = formatNumber(displayedDamage.value, isLuminescenceScore.value ? 3 : 0)
  if (!isLuminescenceScore.value) return value
  return `${value} ${String(damage.value?.scoreSuffix ?? props.result?.scoreSuffix ?? "× k")}`
})
const statusType = computed(() => props.error ? "error" : scalarBlocked.value ? "warning" : "success")
const statusText = computed(() => props.error
  || (props.loading ? "加载中" : scalarBlocked.value ? "参数待确认" : "即时刷新"))
</script>

<template>
  <section class="summary-bar">
    <div>
      <div class="muted">{{ damageLabel }}</div>
      <div class="summary-value num">
        {{ error ? "计算异常" : scalarBlocked ? "参数待确认" : displayedValue }}
      </div>
    </div>
    <div class="chip-row">
      <NTag :type="statusType" round>
        {{ statusText }}
      </NTag>
      <NTag round>事件 {{ eventCount }}</NTag>
      <NTag round>局内面板</NTag>
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
</style>
