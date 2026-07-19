<script setup lang="ts">
import { computed } from "vue"
import { NTag } from "naive-ui"
import { formatNumber } from "@/utils/format"

const props = defineProps<{
  result: any
  loading?: boolean
  error?: string
}>()

const displayedDamage = computed(() => props.result?.damage?.totalFinalDamage ?? props.result?.damage?.finalDamage ?? 0)
const eventCount = computed(() => props.result?.damage?.events?.length ?? props.result?.damage?.eventResults?.length ?? 1)
</script>

<template>
  <section class="summary-bar">
    <div>
      <div class="muted">当前最终伤害</div>
      <div class="summary-value num">
        {{ error ? "计算异常" : formatNumber(displayedDamage) }}
      </div>
    </div>
    <div class="chip-row">
      <NTag :type="error ? 'error' : 'success'" round>
        {{ error || (loading ? "加载中" : "即时刷新") }}
      </NTag>
      <NTag round>事件 {{ eventCount }}</NTag>
      <NTag round>局内面板</NTag>
    </div>
  </section>
</template>
