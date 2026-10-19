<script setup lang="ts">
import { computed } from "vue"
import { NButton } from "naive-ui"
const props = defineProps<{ page: number, total: number, pageSize: number }>()
const emit = defineEmits<{ "update:page": [page: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <nav class="disc-pagination" aria-label="驱动盘分页">
    <span aria-live="polite">匹配 {{ total }} 件 · 第 {{ page }} / {{ pages }} 页 · 每页 {{ pageSize }} 件</span>
    <div class="toolbar">
      <NButton size="small" :disabled="page <= 1" @click="emit('update:page', page - 1)">上一页</NButton>
      <NButton size="small" :disabled="page >= pages" @click="emit('update:page', page + 1)">下一页</NButton>
    </div>
  </nav>
</template>

<style scoped>
.disc-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-block: 10px; }
</style>
