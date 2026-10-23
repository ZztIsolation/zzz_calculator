<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { NAlert, NButton, NConfigProvider, NMessageProvider } from "naive-ui"
import { storageIssues, exportUnreadableData } from "@runtime/storage-guard.js"
import { Calculator, Database, Download, HardDrive, Settings2, UserRound, Monitor, Sun, Moon } from "lucide-vue-next"
import { useRoute, useRouter } from "vue-router"
import { useAccountStore } from "@/stores/account"
import { useAppConfigStore } from "@/stores/app-config"
import { useTheme } from "@/runtime/theme"
import PersonalBackupPanel from "@/components/PersonalBackupPanel.vue"

const accountStore = useAccountStore()
const appConfigStore = useAppConfigStore()
const route = useRoute()
const router = useRouter()
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

// 主导航的滑块：一个绝对定位的白色块滑到当前链接下面。
// 链接位置只在导航尺寸变化时量一次并缓存，切页时直接取缓存，避免新页面渲染时强制排版。
// 滑动只用 transform（平移 + 横向缩放），交给合成线程播放。
const navRef = ref<HTMLElement | null>(null)
const navIndicator = ref({ left: 0, width: 0, baseWidth: 0, visible: false, animated: false })
const navIndicatorStyle = computed(() => {
  const { left, width, baseWidth } = navIndicator.value
  return {
    width: `${baseWidth}px`,
    transform: `translateX(${left}px) scaleX(${baseWidth > 0 ? width / baseWidth : 1})`,
  }
})
let navResizeObserver: ResizeObserver | null = null
let navLinkBoxes = new Map<string, { left: number; width: number }>()

function cacheNavLinkBoxes() {
  const links = [...(navRef.value?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])]
  navLinkBoxes = new Map(links.map(link => [link.getAttribute("href") ?? "", { left: link.offsetLeft, width: link.offsetWidth }]))
}

function moveNavIndicator(path: string, animate: boolean) {
  const box = navLinkBoxes.get(path)
  if (!box) {
    navIndicator.value = { ...navIndicator.value, visible: false, animated: false }
    return
  }
  const current = navIndicator.value
  const animated = animate && current.visible
  if (animated && current.left === box.left && current.width === box.width) return
  navIndicator.value = {
    left: box.left,
    width: box.width,
    // 动画期间保持原宽度、用缩放过渡；结束后再换成真实宽度。
    baseWidth: animated && current.baseWidth > 0 ? current.baseWidth : box.width,
    visible: true,
    animated,
  }
}

function settleNavIndicator() {
  const current = navIndicator.value
  if (current.baseWidth !== current.width) navIndicator.value = { ...current, baseWidth: current.width, animated: false }
}

function measureNavIndicator(animate: boolean) {
  cacheNavLinkBoxes()
  moveNavIndicator(route.path, animate)
}

// 点击后先让滑块开始滑动，再挂载新页面；后台标签页没有动画帧时，最多等 50ms。
const removeNavGuard = router.beforeEach(async to => {
  if (to.path === route.path || !navLinkBoxes.has(to.path)) return
  moveNavIndicator(to.path, true)
  await Promise.race([
    new Promise(resolve => requestAnimationFrame(() => resolve(null))),
    new Promise(resolve => setTimeout(resolve, 50)),
  ])
})

// 被重定向或取消的导航以最终路由为准。
watch(() => route.path, path => {
  void nextTick(() => moveNavIndicator(path, true))
})

watch(() => [maintenanceEnabled.value, enkaImportEnabled.value], () => {
  void nextTick(() => measureNavIndicator(false))
})

onMounted(() => {
  void nextTick(() => measureNavIndicator(false))
  if (typeof ResizeObserver !== "undefined" && navRef.value) {
    navResizeObserver = new ResizeObserver(() => measureNavIndicator(false))
    navResizeObserver.observe(navRef.value)
  }
})

onBeforeUnmount(() => {
  navResizeObserver?.disconnect()
  removeNavGuard()
})
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
          <nav ref="navRef" class="nav" :class="{ 'nav--has-indicator': navIndicator.visible }" aria-label="主导航">
            <span
              class="nav-indicator"
              :class="{ 'is-visible': navIndicator.visible, 'is-animated': navIndicator.animated }"
              :style="navIndicatorStyle"
              aria-hidden="true"
              @transitionend="settleNavIndicator"
            ></span>
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
