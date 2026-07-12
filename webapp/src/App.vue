<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NConfigProvider, NMessageProvider } from "naive-ui"
import { Calculator, Database, Settings2, UserRound } from "lucide-vue-next"
import { loadAppConfig } from "@/runtime/app-config"
import { useAccountStore } from "@/stores/account"

const accountStore = useAccountStore()
const maintenanceEnabled = ref(false)

onMounted(() => {
  void accountStore.load()
  void loadAppConfig().then(config => {
    maintenanceEnabled.value = config.maintenanceEnabled
  })
})

const currentAccountLabel = computed(() => accountStore.currentOwner?.label ?? accountStore.currentOwnerId)

const themeOverrides = {
  common: {
    primaryColor: "#2f7df6",
    primaryColorHover: "#1f6fe6",
    primaryColorPressed: "#185abd",
    borderRadius: "6px",
    fontFamily: "system-ui, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif",
  },
  Card: {
    borderRadius: "8px",
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
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
            <RouterLink v-if="maintenanceEnabled" to="/maintenance">
              <Settings2 :size="16" />
              <span>维护</span>
            </RouterLink>
          </nav>
          <span class="account-chip">账号 / {{ currentAccountLabel }}</span>
        </header>
        <main class="app-main">
          <RouterView />
        </main>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>
