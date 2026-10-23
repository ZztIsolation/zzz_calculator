<script setup lang="ts">
import { computed } from "vue"
import { NAlert, NButton, NConfigProvider, NMessageProvider } from "naive-ui"
import { storageIssues, exportUnreadableData } from "@runtime/storage-guard.js"
import { Calculator, Database, Download, HardDrive, Settings2, UserRound, Monitor, Sun, Moon } from "lucide-vue-next"
import { useRoute } from "vue-router"
import { useAccountStore } from "@/stores/account"
import { useAppConfigStore } from "@/stores/app-config"
import { useTheme } from "@/runtime/theme"
import PersonalBackupPanel from "@/components/PersonalBackupPanel.vue"

const accountStore = useAccountStore()
const appConfigStore = useAppConfigStore()
const route = useRoute()
const props = defineProps<{ startupError?: string }>()
const maintenanceEnabled = computed(() => appConfigStore.config.maintenanceEnabled)
const enkaImportEnabled = computed(() => appConfigStore.config.enkaImportEnabled)
const enkaImportDisabledNotice = computed(() => route.query.notice === "enka-import-disabled")

const currentAccountLabel = computed(() => accountStore.currentOwnerLabel)
const accountChipText = computed(() => {
  if (accountStore.loadState === "error") return "账号加载失败"
  if (currentAccountLabel.value) return `账号 / ${currentAccountLabel.value}`
  return "账号加载中"
})

const { preference, naiveTheme, themeOverrides, cyclePreference } = useTheme()
const themeButtonLabel = computed(() => ({
  system: "主题：跟随系统（点击切换为浅色）",
  light: "主题：浅色（点击切换为深色）",
  dark: "主题：深色（点击切换为跟随系统）",
})[preference.value])


</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <div class="app-shell">
        <header class="app-topbar">
          <div class="brand">
            <img class="brand-mark" src="/zzz-mark.svg" alt="">
            <span>ZZZ Calculator</span>
          </div>
          <nav class="nav" aria-label="主导航">
            <RouterLink to="/">
              <Calculator :size="16" />
              <span>计算</span>
            </RouterLink>
            <RouterLink to="/discs">
              <Database :size="16" />
              <span>驱动盘</span>
            </RouterLink>
            <RouterLink to="/accounts">
              <UserRound :size="16" />
              <span>账号</span>
            </RouterLink>
            <RouterLink v-if="enkaImportEnabled" to="/import">
              <Download :size="16" />
              <span>展柜</span>
            </RouterLink>
            <RouterLink to="/settings">
              <HardDrive :size="16" />
              <span>设置</span>
            </RouterLink>
            <RouterLink v-if="maintenanceEnabled" to="/maintenance">
              <Settings2 :size="16" />
              <span>维护</span>
            </RouterLink>
          </nav>
          <div class="topbar-actions">
            <button
              type="button"
              class="theme-toggle"
              data-testid="theme-toggle"
              :title="themeButtonLabel"
              :aria-label="themeButtonLabel"
              @click="cyclePreference"
            >
              <Monitor v-if="preference === 'system'" :size="16" aria-hidden="true" />
              <Sun v-else-if="preference === 'light'" :size="16" aria-hidden="true" />
              <Moon v-else :size="16" aria-hidden="true" />
            </button>
            <span class="account-chip" aria-live="polite">{{ accountChipText }}</span>
          </div>
        </header>
        <main class="app-main">
          <NAlert v-if="storageIssues.length" type="error" title="本地数据读取失败，原始内容已保留">
            已阻止相关数据保存。请先下载原始内容，再使用备份恢复；不要清空浏览器数据。
            <NButton @click="exportUnreadableData">导出原始内容</NButton>
          </NAlert>
          <NAlert v-if="props.startupError" type="error" :title="props.startupError" />
          <PersonalBackupPanel v-if="props.startupError" />
          <NAlert v-if="enkaImportDisabledNotice" type="warning" title="展柜数据导入当前未启用。" />
          <RouterView v-if="!props.startupError" v-slot="{ Component }">
            <KeepAlive include="DiscsView" :max="1">
              <component :is="Component" :key="route.name === 'discs' ? `discs:${accountStore.currentOwnerId}` : route.name" />
            </KeepAlive>
          </RouterView>
        </main>
        <footer class="site-footer">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
          >浙ICP备2026054969号-1</a>
        </footer>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>
