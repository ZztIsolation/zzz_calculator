<script setup lang="ts">
import { computed } from "vue"
import { ArrowRight, Database, RotateCcw } from "lucide-vue-next"
import { LAB_CHAPTERS, type LabWorkbenchApi } from "@/lab/useLabWorkbench"
import { thumbnailForAgent } from "@/utils/assets"
import { labelOf } from "@/utils/format"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

const activeStepIndex = computed(() =>
  Math.max(0, LAB_CHAPTERS.findIndex(item => item.id === props.lab.activeChapter.value)),
)

const progressWidth = computed(() =>
  `${((activeStepIndex.value + 1) / LAB_CHAPTERS.length) * 100}%`,
)
</script>

<template>
  <aside class="rail-frame" aria-label="配装步骤导航">
    <!-- Active Agent Spec Stamp -->
    <div v-if="lab.selectedAgent.value" class="rail-specimen">
      <img
        class="rail-specimen-img"
        :src="thumbnailForAgent(lab.selectedAgent.value)"
        :alt="labelOf(lab.selectedAgent.value)"
      />
      <div class="rail-specimen-copy">
        <span class="lab-mono rail-kicker">ACTIVE SPEC</span>
        <strong>{{ labelOf(lab.selectedAgent.value) }}</strong>
        <span class="lab-mono rail-sub">
          Lv.{{ lab.buildStore.agentLevel }} · M{{ lab.buildStore.cinemaLevel }} · CORE {{ lab.buildStore.coreSkillLevel }}
        </span>
      </div>
    </div>

    <!-- Step Progress Bar -->
    <div class="rail-progress">
      <div class="rail-progress-meta">
        <span class="lab-mono">WORKFLOW</span>
        <strong class="lab-mono">0{{ activeStepIndex + 1 }} / 0{{ LAB_CHAPTERS.length }}</strong>
      </div>
      <div class="rail-progress-track">
        <div class="rail-progress-fill" :style="{ width: progressWidth }"></div>
      </div>
    </div>

    <!-- Numbered Chapter Cards (Scroll-Spy synced) -->
    <nav class="rail-steps">
      <button
        v-for="chapter in LAB_CHAPTERS"
        :key="chapter.id"
        type="button"
        class="rail-step-card"
        :class="{ 'is-active': lab.activeChapter.value === chapter.id }"
        :aria-current="lab.activeChapter.value === chapter.id ? 'step' : undefined"
        @click="lab.jumpToChapter(chapter.id)"
      >
        <div class="rail-step-top">
          <span class="lab-mono rail-step-num">{{ chapter.code }}</span>
          <strong class="rail-step-title">{{ chapter.title }}</strong>
          <ArrowRight :size="13" class="rail-step-arrow" />
        </div>
        <div class="rail-step-summary">
          <span class="rail-step-primary" :title="lab.chapterSummaries.value[chapter.id].primary">
            {{ lab.chapterSummaries.value[chapter.id].primary }}
          </span>
          <span class="lab-mono rail-step-badge">
            {{ lab.chapterSummaries.value[chapter.id].badge }}
          </span>
        </div>
      </button>
    </nav>

    <!-- Bottom Utility Footer -->
    <div class="rail-footer">
      <div class="rail-inv-row">
        <Database :size="13" />
        <span>仓库库存</span>
        <strong class="lab-mono">{{ lab.ownerDriveDiscs.value.length }} 张</strong>
      </div>
      <button type="button" class="rail-reload-btn" @click="lab.initialize()">
        <RotateCcw :size="12" />
        <span>从原工作台重载数据</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.rail-frame {
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius);
  box-shadow: var(--lab-shadow-dock);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.rail-specimen {
  padding: 11px 11px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid var(--lab-line);
  background: linear-gradient(180deg, #faf9f6 0%, #ffffff 100%);
}

.rail-specimen-img {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-well);
  flex: 0 0 auto;
}

.rail-specimen-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rail-kicker {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--lab-accent);
}

.rail-specimen-copy strong {
  font-size: 13.5px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-sub {
  font-size: 10px;
  color: var(--lab-muted);
}

.rail-progress {
  padding: 8px 11px;
  border-bottom: 1px solid var(--lab-line);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rail-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--lab-muted);
  letter-spacing: 0.08em;
}

.rail-progress-meta strong {
  color: var(--lab-ink);
}

.rail-progress-track {
  height: 4px;
  border-radius: 999px;
  background: var(--lab-well);
  overflow: hidden;
}

.rail-progress-fill {
  height: 100%;
  background: var(--lab-accent);
  transition: width 0.22s ease;
}

.rail-steps {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rail-step-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 9px 9px 11px;
  border-radius: var(--lab-radius-sm);
  border: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  text-align: left;
  transition: all 0.14s ease;
}

.rail-step-card:hover {
  border-color: var(--lab-ink);
  background: var(--lab-paper);
}

.rail-step-card.is-active {
  background: var(--lab-ink);
  border-color: var(--lab-ink);
  color: var(--lab-paper);
  box-shadow: inset 3px 0 0 var(--lab-accent);
}

.rail-step-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rail-step-num {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 19px;
  border-radius: 4px;
  background: var(--lab-paper);
  border: 1px solid var(--lab-line-strong);
  font-size: 10.5px;
  font-weight: 800;
  color: var(--lab-ink);
  flex: 0 0 auto;
}

.rail-step-card.is-active .rail-step-num {
  background: var(--lab-accent);
  border-color: var(--lab-accent);
  color: #ffffff;
}

.rail-step-title {
  font-size: 12.5px;
  font-weight: 800;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-step-arrow {
  opacity: 0;
  transform: translateX(-3px);
  transition: all 0.14s ease;
  flex: 0 0 auto;
}

.rail-step-card:hover .rail-step-arrow,
.rail-step-card.is-active .rail-step-arrow {
  opacity: 1;
  transform: translateX(0);
}

.rail-step-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rail-step-primary {
  font-size: 11px;
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-step-card.is-active .rail-step-primary {
  color: rgba(245, 245, 242, 0.78);
}

.rail-step-badge {
  align-self: flex-start;
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--lab-well);
  color: var(--lab-ink-2);
}

.rail-step-card.is-active .rail-step-badge {
  background: rgba(255, 255, 255, 0.12);
  color: var(--lab-hud-lime);
}

.rail-footer {
  padding: 9px 10px 10px;
  border-top: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.rail-inv-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--lab-ink-2);
}

.rail-inv-row strong {
  margin-left: auto;
  color: var(--lab-ink);
}

.rail-reload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  border-radius: 5px;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper);
  color: var(--lab-ink-2);
  font-size: 11.5px;
  font-weight: 600;
}

.rail-reload-btn:hover {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
}

@media (max-width: 1080px) {
  .rail-steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .rail-specimen,
  .rail-progress,
  .rail-footer {
    display: none;
  }
}

@media (max-width: 680px) {
  .rail-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
