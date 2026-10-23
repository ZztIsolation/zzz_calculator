<script setup lang="ts">
import { NButton } from "naive-ui"
import { RefreshCcw } from "lucide-vue-next"
import DamageSummaryBar from "@/components/DamageSummaryBar.vue"
import DamageWhiteBox from "@/components/DamageWhiteBox.vue"
import PanelStatTable from "@/components/PanelStatTable.vue"
import { useBuildStore } from "@/stores/build"
import { useCatalogStore } from "@/stores/catalog"

/** 计算页右栏：结果数字、局外/局内面板对照、伤害白盒 */
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
      <DamageSummaryBar class="workbench-summary-section" :result="buildStore.result" :error="buildStore.error" :loading="catalogStore.loading" :context-key="summaryContextKey" />
      <section class="workbench-section damage-panel-card">
        <div class="panel-header workbench-section-header">
          <div>
            <h2 class="panel-title">面板</h2>
            <p class="panel-subtitle">局外与局内对照，绿色为局内 Buff 带来的提升</p>
          </div>
        </div>
        <div class="workbench-section-body damage-panel-compare">
          <PanelStatTable
            :panel="buildStore.outOfCombat?.panel"
            :in-combat-panel="buildStore.result?.inCombat?.panel ?? null"
            :meta="catalogStore.meta"
            :include-sheer-force="selectedAgent?.specialty === 'rupture'"
            :important-stats="selectedAgent?.importantPanelStats"
          />
        </div>
      </section>
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
/* 结果数字是工作台最重要的输出：放在右栏顶部，并在右栏滚动时吸附在顶端 */
.workbench-summary-section {
  position: sticky;
  top: 0;
  z-index: 3;
  margin: 0;
  padding: 14px;
  border: 0;
  border-radius: 0;
  background: linear-gradient(180deg, var(--app-blue-soft) 0%, var(--app-panel) 100%);
  box-shadow: inset 0 -1px 0 var(--app-border);
}

.workbench-summary-section :deep(.muted) {
  color: var(--app-text-secondary);
  font-size: var(--font-sm);
  font-weight: 650;
}

.workbench-section + .workbench-summary-section,
.workbench-summary-section + .workbench-section {
  border-top-color: transparent;
}

/* 面板对照表：属性 | 局外 | 局内（含增量） */
.damage-panel-compare {
  min-width: 0;
  padding-top: 2px;
}

.damage-panel-card :deep(.data-table) {
  table-layout: fixed;
}

.damage-panel-card :deep(.data-table th),
.damage-panel-card :deep(.data-table td) {
  padding: 6px 8px;
  line-height: 1.25;
}

/*
 * 中等宽度：两栏。右栏拆开——结果数字成为整行吸顶条，面板与白盒并排放在最下方，
 * 不再把整块结果区压在配置上方。
 */
@media (max-width: 1280px) {
  .workbench-right,
  .workbench-right-sticky {
    display: contents;
  }

  .workbench-summary-section {
    grid-column: 1 / -1;
    order: -1;
    top: var(--workbench-sticky-top);
    z-index: 6;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    min-height: var(--workbench-summary-height);
    padding: 10px 16px;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius);
    background: var(--app-overlay-panel);
    box-shadow: var(--app-shadow);
    backdrop-filter: blur(8px);
  }

  .workbench-summary-section :deep(.summary-copy) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    min-width: 0;
  }

  .workbench-summary-section :deep(.summary-value) {
    font-size: 26px;
  }

  .damage-panel-card,
  .workbench-whitebox-section {
    order: 2;
    align-self: start;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius);
    background: var(--app-panel);
    box-shadow: var(--app-shadow-sm);
  }

  .workbench-section.damage-panel-card + .workbench-section.workbench-whitebox-section {
    border-top: 1px solid var(--app-border);
  }
}
</style>
