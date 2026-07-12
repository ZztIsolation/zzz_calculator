<script setup lang="ts">
import { computed } from "vue"
import { NButton } from "naive-ui"
import { AlertCircle, Download, Gamepad2, RefreshCcw, WifiOff } from "lucide-vue-next"

type Variant =
  | "helper-missing"
  | "helper-outdated"
  | "prepare-failed"
  | "scan-failed"
  | "game-not-found"

const props = defineProps<{
  variant: Variant
  message?: string
  helperVersion?: string
  primaryLabel?: string
  secondaryLabel?: string
}>()

const emit = defineEmits<{
  primary: []
  secondary: []
}>()

const preset = computed(() => {
  switch (props.variant) {
    case "helper-missing":
      return {
        Icon: Download,
        tone: "info" as const,
        title: "未检测到扫描助手",
        subtext: "浏览器已尝试自动唤起。如果没反应，请下载并运行扫描助手，然后回到本页面。",
        primary: "下载扫描助手",
        secondary: "我已运行，重新连接",
      }
    case "helper-outdated":
      return {
        Icon: RefreshCcw,
        tone: "warning" as const,
        title: props.helperVersion
          ? `扫描助手版本过低（v${props.helperVersion}）`
          : "扫描助手版本过低",
        subtext: "下载进度需要新版助手才能正确显示，请下载新版助手并重新运行。",
        primary: "下载新版助手",
        secondary: "我已更新并重新运行",
      }
    case "prepare-failed":
      return {
        Icon: WifiOff,
        tone: "error" as const,
        title: "OCR 扫描器准备失败",
        subtext: props.message || "扫描助手已连接，但准备 OCR 运行时时出错。可以重试，或检查扫描助手日志。",
        primary: "重试",
        secondary: "",
      }
    case "scan-failed":
      return {
        Icon: AlertCircle,
        tone: "error" as const,
        title: "扫描失败",
        subtext: props.message || "扫描过程中出错。可以重试，或检查扫描助手日志。",
        primary: "重新扫描",
        secondary: "",
      }
    case "game-not-found":
      return {
        Icon: Gamepad2,
        tone: "warning" as const,
        title: "未找到绝区零窗口",
        subtext: props.message || "请确认游戏已启动。云绝区零请在客户端选择器中切换。",
        primary: "重试连接",
        secondary: "",
      }
  }
})

const primaryLabel = computed(() => props.primaryLabel || preset.value.primary)
const secondaryLabel = computed(() => props.secondaryLabel ?? preset.value.secondary)
</script>

<template>
  <div class="scanner-error-state" :class="`tone-${preset.tone}`" role="alert">
    <div class="scanner-error-icon">
      <component :is="preset.Icon" :size="40" :stroke-width="1.6" aria-hidden="true" />
    </div>
    <h3 class="scanner-error-title">{{ preset.title }}</h3>
    <p class="scanner-error-subtext">{{ preset.subtext }}</p>
    <div class="scanner-error-actions">
      <NButton type="primary" size="large" @click="emit('primary')">
        {{ primaryLabel }}
      </NButton>
      <NButton v-if="secondaryLabel" size="large" @click="emit('secondary')">
        {{ secondaryLabel }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.scanner-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 20px 28px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-panel-muted);
  text-align: center;
}

.scanner-error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  margin-bottom: 4px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--app-border);
}

.tone-info .scanner-error-icon {
  color: var(--app-blue);
}

.tone-warning .scanner-error-icon {
  color: var(--app-amber);
}

.tone-error .scanner-error-icon {
  color: var(--app-red);
}

.scanner-error-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.scanner-error-subtext {
  margin: 0;
  max-width: 340px;
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.6;
}

.scanner-error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;
}
</style>
