<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NAlert, NButton, NProgress, NSwitch, NTag, useMessage } from "naive-ui"
import { Download, HardDrive, Play, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { clearAllBrowserData } from "@runtime/local-store.js"
import { loadAppConfig } from "@/runtime/app-config"
import {
  resetScanTelemetryClientId,
  scanTelemetryPreferenceEnabled,
  setScanTelemetryPreference,
} from "@runtime/scan-telemetry"
import { helperVersionAtLeast, REQUIRED_HELPER_VERSION, useInventoryStore } from "@/stores/inventory"

const inventoryStore = useInventoryStore()
const message = useMessage()
const browserBytes = ref<number | null>(null)
const helperConnected = ref(false)
const helperVersion = ref("")
const helperProtocolVersion = ref(0)
const helperError = ref("")
const helperStorage = ref<any>(null)
const helperBusy = ref(false)
const helperProgress = ref<any>(null)
const showBrowserClear = ref(false)
const showScannerCleanup = ref(false)
const telemetryEnabled = ref(scanTelemetryPreferenceEnabled())
const telemetryAvailable = ref(false)
const telemetryRetentionDays = ref(30)

const bridge = computed(() => inventoryStore.ensureScannerBridge())
const helperSupportsStorage = computed(() => helperConnected.value && helperProtocolVersion.value >= 3)
const helperOutdated = computed(() => helperConnected.value && Boolean(helperVersion.value) && !helperVersionAtLeast(helperVersion.value))

function formatBytes(value: unknown) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return "--"
  const units = ["B", "KiB", "MiB", "GiB"]
  let current = bytes
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current.toFixed(index === 0 ? 0 : current >= 100 ? 1 : 2)} ${units[index]}`
}

async function refreshBrowserUsage() {
  try {
    const estimate = await navigator.storage?.estimate?.()
    browserBytes.value = Number.isFinite(Number(estimate?.usage)) ? Number(estimate?.usage) : null
  } catch {
    browserBytes.value = null
  }
}

async function refreshHelper() {
  helperBusy.value = true
  helperError.value = ""
  try {
    const hello = await bridge.value.connect()
    helperConnected.value = bridge.value.mode === "helper"
    helperVersion.value = String(hello?.version ?? bridge.value.helperVersion ?? "")
    helperProtocolVersion.value = Number(hello?.protocolVersion ?? bridge.value.protocolVersion ?? 0)
    if (helperSupportsStorage.value) {
      const response = await bridge.value.getStorageInfo()
      helperStorage.value = response?.storage ?? null
    } else {
      helperStorage.value = null
    }
  } catch (error) {
    helperConnected.value = false
    helperStorage.value = null
    const detail = error instanceof Error ? error.message : String(error)
    helperError.value = /failed to fetch|cannot connect|connection refused/i.test(detail)
      ? "未检测到正在运行的 Helper"
      : detail
  } finally {
    helperBusy.value = false
  }
}

async function launchHelper() {
  bridge.value.launchHelper()
  helperBusy.value = true
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      bridge.value.disconnect()
      await refreshHelper()
      if (helperConnected.value) return
    } catch {
    }
  }
  helperBusy.value = false
}

function downloadHelper() {
  window.open(inventoryStore.scanHelperDownloadUrl, "_blank", "noopener")
}

async function clearBrowserData() {
  showBrowserClear.value = false
  try {
    await clearAllBrowserData()
    window.location.replace("/")
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  }
}

async function cleanupScannerStorage() {
  showScannerCleanup.value = false
  helperBusy.value = true
  try {
    const response = await bridge.value.cleanupStorage()
    const result = response?.result
    helperStorage.value = result?.after ?? helperStorage.value
    const reclaimed = formatBytes(result?.reclaimedBytes ?? 0)
    if (result?.errors?.length) {
      message.warning(`已释放 ${reclaimed}，部分占用文件将在下次启动继续清理。`)
    } else {
      message.success(`已释放 ${reclaimed}。`)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    helperBusy.value = false
  }
}

async function updateHelper() {
  helperBusy.value = true
  helperProgress.value = null
  bridge.value.onHelperUpdateProgress = (progress: any) => {
    helperProgress.value = progress
  }
  try {
    const response = await bridge.value.updateHelper()
    if (response?.restarting) {
      message.success(`Helper ${response.availableVersion} 已下载，正在重启。`)
      setTimeout(() => void refreshHelper(), 2500)
    } else if (helperOutdated.value) {
      throw new Error(`更新清单未提供 ${REQUIRED_HELPER_VERSION} 或更高版本，请手动下载最新版。`)
    } else {
      message.success("Helper 已是最新版本。")
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    helperBusy.value = false
  }
}

function updateTelemetryPreference(value: boolean) {
  telemetryEnabled.value = value
  setScanTelemetryPreference(value)
  message.success(value ? "匿名扫描诊断已开启" : "匿名扫描诊断已关闭")
}

function resetTelemetryIdentity() {
  resetScanTelemetryClientId()
  message.success("匿名标识已重置")
}

onMounted(() => {
  void refreshBrowserUsage()
  void refreshHelper()
  void loadAppConfig().then(config => {
    telemetryAvailable.value = config.scanTelemetryEnabled
    telemetryRetentionDays.value = config.scanTelemetryRetentionDays
  })
})
</script>

<template>
  <div class="settings-view">
    <section class="panel">
      <div class="panel-header">
        <div>
          <h1 class="panel-title">本地存储</h1>
          <p class="section-subtitle">浏览器数据与扫描器文件分别管理</p>
        </div>
        <NButton quaternary circle title="刷新" :loading="helperBusy" @click="refreshBrowserUsage(); refreshHelper()">
          <template #icon><RefreshCw :size="17" /></template>
        </NButton>
      </div>
    </section>

    <section class="settings-band">
      <div class="settings-heading">
        <div>
          <div class="heading-line">
            <h2>匿名扫描诊断</h2>
            <NTag :type="telemetryEnabled && telemetryAvailable ? 'success' : 'default'" size="small">
              {{ telemetryEnabled && telemetryAvailable ? "已开启" : "已关闭" }}
            </NTag>
          </div>
          <p>上传浏览器类型与主版本、连接阶段、扫描版本、耗时、数量和脱敏错误信息，不包含完整 User-Agent、驱动盘内容、账号、截图、本机路径或完整日志。</p>
        </div>
        <NSwitch
          :value="telemetryEnabled && telemetryAvailable"
          :disabled="!telemetryAvailable"
          aria-label="匿名扫描诊断"
          @update:value="updateTelemetryPreference"
        />
      </div>
      <NAlert type="info" :show-icon="false">
        诊断记录使用随机匿名标识关联重复故障，并在 {{ telemetryRetentionDays }} 天后自动删除。关闭后不再上传新的扫描记录。
      </NAlert>
      <div class="settings-actions">
        <NButton :disabled="!telemetryAvailable" @click="resetTelemetryIdentity">
          <template #icon><RotateCcw :size="16" /></template>
          重置匿名标识
        </NButton>
        <span class="privacy-note"><ShieldCheck :size="15" /> 本地驱动盘仓库仍只保存在当前浏览器</span>
      </div>
    </section>

    <section class="settings-band">
      <div class="settings-heading">
        <div>
          <h2>网页数据</h2>
          <p>账号、驱动盘、计算配置和本地草稿</p>
        </div>
        <strong>{{ formatBytes(browserBytes) }}</strong>
      </div>
      <div class="settings-actions">
        <NButton type="error" @click="showBrowserClear = true">
          <template #icon><Trash2 :size="16" /></template>
          清除网页数据
        </NButton>
      </div>
    </section>

    <section class="settings-band">
      <div class="settings-heading">
        <div>
          <div class="heading-line">
            <h2>扫描器存储</h2>
            <NTag :type="helperConnected ? 'success' : 'default'" size="small">
              {{ helperConnected ? `Helper ${helperVersion}` : "未连接" }}
            </NTag>
          </div>
          <p v-if="helperStorage">{{ helperStorage.root }}</p>
          <p v-else>{{ helperError || "启动 Helper 后可查看扫描器占用" }}</p>
        </div>
        <strong>{{ formatBytes(helperStorage?.totalBytes) }}</strong>
      </div>

      <dl v-if="helperStorage" class="storage-grid">
        <div><dt>Helper</dt><dd>{{ formatBytes(helperStorage.helperBytes) }}</dd></div>
        <div><dt>OCR runtime</dt><dd>{{ formatBytes(helperStorage.runtimeBytes) }}</dd></div>
        <div><dt>安装包</dt><dd>{{ formatBytes(helperStorage.packageBytes) }}</dd></div>
        <div><dt>扫描产物</dt><dd>{{ formatBytes(helperStorage.outputBytes) }}</dd></div>
        <div><dt>日志</dt><dd>{{ formatBytes(helperStorage.logBytes) }}</dd></div>
        <div class="reclaimable"><dt>可释放</dt><dd>{{ formatBytes(helperStorage.reclaimableBytes) }}</dd></div>
      </dl>

      <NAlert v-if="helperOutdated" type="warning" :show-icon="false">
        当前 Helper {{ helperVersion }} 需要更新到 {{ REQUIRED_HELPER_VERSION }} 或更高版本。
      </NAlert>

      <div v-if="helperProgress" class="update-progress">
        <span>{{ helperProgress.message }}</span>
        <NProgress
          v-if="Number.isFinite(Number(helperProgress.percent))"
          type="line"
          :percentage="Number(helperProgress.percent)"
          :show-indicator="false"
        />
      </div>

      <div class="settings-actions">
        <template v-if="!helperConnected">
          <NButton :loading="helperBusy" @click="launchHelper">
            <template #icon><Play :size="16" /></template>
            启动 Helper
          </NButton>
          <NButton type="primary" @click="downloadHelper">
            <template #icon><Download :size="16" /></template>
            安装 Helper
          </NButton>
        </template>
        <template v-else-if="helperOutdated && !helperSupportsStorage">
          <NButton type="primary" @click="downloadHelper">
            <template #icon><Download :size="16" /></template>
            下载并更新 Helper
          </NButton>
        </template>
        <template v-else>
          <NButton :loading="helperBusy" @click="updateHelper">
            <template #icon><RefreshCw :size="16" /></template>
            {{ helperOutdated ? "重试自动更新" : "检查 Helper 更新" }}
          </NButton>
          <NButton
            type="primary"
            :loading="helperBusy"
            :disabled="!helperStorage?.reclaimableBytes"
            @click="showScannerCleanup = true"
          >
            <template #icon><HardDrive :size="16" /></template>
            释放扫描器空间
          </NButton>
        </template>
      </div>
    </section>
  </div>

  <ConfirmDialog
    :show="showBrowserClear"
    danger
    title="清除网页数据"
    message="将永久删除所有账号、驱动盘、套装预设、计算配置和本地草稿。扫描器程序不会被删除。"
    confirm-text="永久清除"
    @update:show="showBrowserClear = $event"
    @confirm="clearBrowserData"
  />
  <ConfirmDialog
    :show="showScannerCleanup"
    title="释放扫描器空间"
    :message="`将清理旧 OCR 版本、安装包、临时文件和多余扫描产物，预计可释放 ${formatBytes(helperStorage?.reclaimableBytes)}。当前扫描器仍可直接使用。`"
    confirm-text="开始清理"
    @update:show="showScannerCleanup = $event"
    @confirm="cleanupScannerStorage"
  />
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 16px;
}

.section-subtitle,
.settings-heading p {
  margin: 4px 0 0;
  color: var(--app-muted);
  font-size: 13px;
  word-break: break-all;
}

.settings-band {
  padding: 18px;
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-panel);
}

.settings-heading,
.heading-line,
.settings-actions {
  display: flex;
  align-items: center;
}

.settings-heading {
  justify-content: space-between;
  gap: 20px;
}

.settings-heading h2 {
  margin: 0;
  font-size: 17px;
}

.settings-heading strong {
  flex: 0 0 auto;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.heading-line,
.settings-actions {
  gap: 10px;
}

.storage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 18px 0;
  background: var(--app-border);
  border: 1px solid var(--app-border);
}

.storage-grid > div {
  min-width: 0;
  padding: 12px;
  background: var(--app-panel);
}

.storage-grid dt {
  color: var(--app-muted);
  font-size: 12px;
}

.storage-grid dd {
  margin: 4px 0 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.storage-grid .reclaimable dd {
  color: var(--app-blue);
}

.settings-actions {
  justify-content: flex-end;
  margin-top: 16px;
  flex-wrap: wrap;
}

.privacy-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-muted);
  font-size: 12px;
}

.settings-band :deep(.n-alert) {
  margin-top: 14px;
}

.update-progress {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  font-size: 13px;
}

@media (max-width: 680px) {
  .settings-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .storage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-actions :deep(.n-button) {
    flex: 1 1 160px;
  }
}
</style>
