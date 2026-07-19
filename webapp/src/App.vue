<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NConfigProvider, NMessageProvider, type GlobalThemeOverrides } from "naive-ui"
import { Calculator, Database, HardDrive, Settings2, UserRound } from "lucide-vue-next"
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

const themeOverrides: GlobalThemeOverrides = {
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
  Select: {
    menuBoxShadow: "0 10px 30px rgba(15, 23, 42, 0.16)",
    peers: {
      InternalSelection: {
        color: "#f8fafc",
        colorActive: "#ffffff",
        colorDisabled: "#f1f5f9",
        textColor: "#111827",
        textColorDisabled: "#64748b",
        border: "2px solid #64748b",
        borderHover: "2px solid #2f7df6",
        borderActive: "2px solid #2f7df6",
        borderFocus: "2px solid #2f7df6",
        boxShadowHover: "0 0 0 2px rgba(47, 125, 246, 0.10)",
        boxShadowActive: "0 0 0 3px rgba(47, 125, 246, 0.20)",
        boxShadowFocus: "0 0 0 3px rgba(47, 125, 246, 0.20)",
        arrowColor: "#334155",
        arrowColorDisabled: "#94a3b8",
        arrowSize: "18px",
        paddingSingle: "0 40px 0 12px",
        paddingMultiple: "3px 40px 0 12px",
        borderWarning: "2px solid #b7791f",
        borderHoverWarning: "2px solid #9a5f13",
        borderActiveWarning: "2px solid #b7791f",
        borderFocusWarning: "2px solid #9a5f13",
        boxShadowHoverWarning: "0 0 0 2px rgba(183, 121, 31, 0.10)",
        boxShadowActiveWarning: "0 0 0 3px rgba(183, 121, 31, 0.18)",
        boxShadowFocusWarning: "0 0 0 3px rgba(183, 121, 31, 0.18)",
        borderError: "2px solid #d14343",
        borderHoverError: "2px solid #b42318",
        borderActiveError: "2px solid #d14343",
        borderFocusError: "2px solid #b42318",
        boxShadowHoverError: "0 0 0 2px rgba(209, 67, 67, 0.10)",
        boxShadowActiveError: "0 0 0 3px rgba(209, 67, 67, 0.18)",
        boxShadowFocusError: "0 0 0 3px rgba(209, 67, 67, 0.18)",
      },
      InternalSelectMenu: {
        optionColorPending: "#f1f5f9",
        optionColorActive: "#eaf2ff",
        optionColorActivePending: "#dbeafe",
        optionTextColorActive: "#185abd",
        optionCheckColor: "#2f7df6",
      },
    },
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
            <RouterLink to="/settings">
              <HardDrive :size="16" />
              <span>设置</span>
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
