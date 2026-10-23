<script setup lang="ts">
import { computed } from "vue"
import { NButton } from "naive-ui"
const props = defineProps<{ page: number, total: number, pageSize: number, pageSizeOptions?: number[] }>()
const emit = defineEmits<{ "update:page": [page: number], "update:pageSize": [pageSize: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <nav class="disc-pagination" aria-label="驱动盘分页">
    <span aria-live="polite">
      匹配 {{ total }} 件 · 第 {{ page }} / {{ pages }} 页 ·
      <label v-if="pageSizeOptions?.length" class="disc-page-size">
        每页
        <select
          :value="pageSize"
          aria-label="每页显示数量"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
        件
      </label>
      <template v-else>每页 {{ pageSize }} 件</template>
    </span>
    <div class="toolbar">
      <NButton size="small" :disabled="page <= 1" @click="emit('update:page', page - 1)">上一页</NButton>
      <NButton size="small" :disabled="page >= pages" @click="emit('update:page', page + 1)">下一页</NButton>
    </div>
  </nav>
</template>

<style scoped>
.disc-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-block: 10px; }
.disc-page-size { display: inline-flex; align-items: center; gap: 4px; }
.disc-page-size select {
  height: 26px;
  padding: 0 4px;
  border: 1px solid var(--app-border-strong, #cbd5e1);
  border-radius: 6px;
  background: var(--app-panel, #fff);
  color: var(--app-text, inherit);
  font: inherit;
}
.disc-page-size select:focus-visible { outline: var(--app-focus-ring, 3px solid rgba(47, 125, 246, 0.35)); outline-offset: 1px; }
</style>
