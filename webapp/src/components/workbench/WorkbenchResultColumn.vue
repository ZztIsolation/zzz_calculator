<script setup lang="ts">
import { NButton } from "naive-ui"
import { RefreshCcw } from "lucide-vue-next"
import DamageSummaryBar from "@/components/DamageSummaryBar.vue"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"
import PanelStatTable from "@/components/PanelStatTable.vue"
import { useBuildStore } from "@/stores/build"
import { useCatalogStore } from "@/stores/catalog"

/** 计算页右栏：面板对照、结果数字和伤害白盒 */
defineProps<{
  summaryContextKey: string
  isLuminescenceScore: boolean
  selectedAgent: any
  selectedSkillCatalog: any
}>()
const emit = defineEmits<{ refresh: [] }>()

const buildStore = useBuildStore()
const catalogStore = useCatalogStore()
</script>

<template>
  <aside class="workbench-right">
    <div class="workbench-right-sticky workbench-surface">
      <section class="workbench-section damage-panel-card">
        <div class="panel-header workbench-section-header">
          <div>
            <h2 class="panel-title">面板</h2>
            <p class="panel-subtitle">局外 / 局内属性</p>
          </div>
        </div>
        <div class="workbench-section-body damage-panel-compare">
          <PanelStatTable
            :panel="buildStore.outOfCombat?.panel"
            :in-combat-panel="buildStore.result?.inCombat?.panel"
            :meta="catalogStore.meta"
            :include-sheer-force="selectedAgent?.specialty === 'rupture'"
            :important-stats="selectedAgent?.importantPanelStats"
          />
        </div>
      </section>
      <DamageSummaryBar class="workbench-summary-section" :result="buildStore.result" :error="buildStore.error" :loading="catalogStore.loading" :context-key="summaryContextKey" />
      <section class="workbench-section workbench-whitebox-section">
        <div class="panel-header workbench-section-header">
          <div>
            <h2 class="panel-title">{{ isLuminescenceScore ? "队伍异常评分白盒" : "伤害白盒" }}</h2>
            <p class="panel-subtitle">随当前驱动盘方案实时刷新</p>
          </div>
          <NButton size="small" @click="emit('refresh')">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </NButton>
        </div>
        <div class="workbench-section-body">
          <div v-if="buildStore.error" class="empty-state">{{ buildStore.error }}</div>
          <DamageWhiteBox
            v-else
            :damage="buildStore.result?.damage"
            :meta="catalogStore.meta"
            :skill-catalog="selectedSkillCatalog"
          />
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.workbench-right-sticky {
  position: sticky;
  /* 顶栏约 56px + 18px 间距；后续布局层会改用显式布局变量 */
  top: 74px;
}

.workbench-summary-section {
  position: static;
  top: auto;
  margin: 0;
  padding: 12px;
  border: 0;
  border-top: 1px solid var(--app-border);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

/* 面板表：属性 | 局外 | 局内，只展示原始值（缺失一侧显示 —） */
.damage-panel-compare {
  min-width: 0;
  overflow-x: auto;
  padding: 10px 12px 12px;
}

.damage-panel-card > .panel-header {
  padding: 10px 12px;
}

.damage-panel-card :deep(.data-table) {
  table-layout: fixed;
}

.damage-panel-card :deep(.data-table th),
.damage-panel-card :deep(.data-table td) {
  padding: 6px 8px;
  line-height: 1.25;
}

.damage-panel-card :deep(.data-table th) {
  width: 54%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.damage-panel-card :deep(.data-table td) {
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (max-width: 1280px) {
  .workbench-right-sticky {
    position: static;
  }
}
</style>
