<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue"
import { NConfigProvider, NMessageProvider } from "naive-ui"
import { ArrowUpLeft } from "lucide-vue-next"
import { LAB_CHAPTERS, useLabWorkbench, type LabChapterId } from "@/lab/useLabWorkbench"
import { labNaiveThemeOverrides } from "@/lab/lab-naive-theme"
import LabStepRail from "@/lab/components/LabStepRail.vue"
import LabChapterAgent from "@/lab/components/LabChapterAgent.vue"
import LabChapterBuffs from "@/lab/components/LabChapterBuffs.vue"
import LabChapterCombat from "@/lab/components/LabChapterCombat.vue"
import LabChapterOptimizer from "@/lab/components/LabChapterOptimizer.vue"
import LabOutputDock from "@/lab/components/LabOutputDock.vue"

const lab = useLabWorkbench()

let scrollRaf = 0

function syncActiveChapterFromScroll() {
  if (lab.isManualScrollLock.value) return
  const docEl = document.documentElement
  const nearBottom = window.scrollY + window.innerHeight >= docEl.scrollHeight - 40
  if (nearBottom) {
    lab.activeChapter.value = LAB_CHAPTERS[LAB_CHAPTERS.length - 1]!.id
    return
  }
  let current: LabChapterId = LAB_CHAPTERS[0]!.id
  for (const chapter of LAB_CHAPTERS) {
    const el = document.getElementById(`lab-chapter-${chapter.id}`)
    if (!el) continue
    if (el.getBoundingClientRect().top <= 180) {
      current = chapter.id
    }
  }
  lab.activeChapter.value = current
}

function onWindowScroll() {
  if (scrollRaf) return
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0
    syncActiveChapterFromScroll()
  })
}

onMounted(async () => {
  await lab.initialize()
  window.addEventListener("scroll", onWindowScroll, { passive: true })
  syncActiveChapterFromScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onWindowScroll)
  if (scrollRaf) window.cancelAnimationFrame(scrollRaf)
})
</script>

<template>
  <NConfigProvider :theme-overrides="labNaiveThemeOverrides">
    <NMessageProvider>
      <div class="lab-root">
        <!-- Top Editorial Bar -->
        <header class="lab-topbar">
          <div class="lab-topbar-inner">
            <div class="lab-brand">
              <span class="lab-brand-mark">Z2</span>
              <div class="lab-brand-title">
                <strong>绝区零装备画册</strong>
                <span class="lab-brand-tag">WORKBENCH V2 · LAB</span>
              </div>
            </div>

            <div class="lab-topbar-meta">
              <span class="lab-sandbox-pill" title="本试验版独立运行，不会覆写原版工作台的本地配置">
                <span class="lab-sandbox-dot" aria-hidden="true"></span>
                <span>实验沙盒 · 不覆盖旧配置</span>
              </span>

              <select
                class="lab-account-select"
                :value="lab.activeOwnerId.value"
                aria-label="切换账号库存"
                @change="lab.switchOwner(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="owner in lab.owners.value" :key="owner.id" :value="owner.id">
                  账号：{{ owner.label || owner.id }}
                </option>
              </select>

              <a href="/" class="lab-top-link">
                <ArrowUpLeft :size="13" />
                <span>返回旧版</span>
              </a>
            </div>
          </div>
        </header>

        <!-- Loading / Error Shell -->
        <div v-if="lab.loading.value" class="lab-state-screen">
          <div class="lab-state-card">
            <span class="lab-mono lab-state-kicker">INITIALIZING ENGINE</span>
            <strong>正在加载代理人、音擎目录与本地驱动盘仓库…</strong>
          </div>
        </div>

        <div v-else-if="lab.loadError.value" class="lab-state-screen">
          <div class="lab-state-card is-error">
            <span class="lab-mono lab-state-kicker">CONNECTION ERROR</span>
            <strong>{{ lab.loadError.value }}</strong>
            <button type="button" class="lab-btn lab-btn--primary" @click="lab.initialize()">重试连接</button>
          </div>
        </div>

        <!-- Main 3-Column Continuous Flow + Dual Sticky Rails -->
        <main v-else class="lab-shell">
          <div class="lab-rail-col">
            <LabStepRail :lab="lab" />
          </div>

          <div class="lab-stage-col">
            <LabChapterAgent :lab="lab" />
            <LabChapterBuffs :lab="lab" />
            <LabChapterCombat :lab="lab" />
            <LabChapterOptimizer :lab="lab" />
          </div>

          <div class="lab-dock-col">
            <LabOutputDock :lab="lab" />
          </div>
        </main>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.lab-root {
  min-height: 100vh;
}

.lab-state-screen {
  min-height: calc(100vh - var(--lab-topbar-h));
  display: grid;
  place-items: center;
  padding: 24px;
}

.lab-state-card {
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius);
  padding: 28px 34px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  box-shadow: var(--lab-shadow-dock);
  max-width: 480px;
}

.lab-state-card.is-error {
  border-color: var(--lab-red);
}

.lab-state-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--lab-accent);
}
</style>
