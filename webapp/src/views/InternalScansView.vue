<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue"
import {
  NAlert,
  NButton,
  NDataTable,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NPagination,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui"
import { RefreshCw } from "lucide-vue-next"
import {
  loadScanTelemetrySession,
  loadScanTelemetrySessions,
  loadScanTelemetrySummary,
} from "@runtime/scan-telemetry-admin"

const message = useMessage()
const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 50
const now = new Date()
const endDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

const dateRange = ref<[number, number]>([endDate - 6 * DAY_MS, endDate])
const status = ref("")
const client = ref("")
const scannerVersion = ref("")
const errorCode = ref("")
const page = ref(1)
const loading = ref(false)
const summary = ref<any>(null)
const sessions = ref<any[]>([])
const total = ref(0)
const selectedSession = ref<any>(null)
const detailOpen = ref(false)

function dateText(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

const range = computed(() => ({
  from: dateText(dateRange.value[0]),
  to: dateText(dateRange.value[1]),
}))

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "成功", value: "completed" },
  { label: "失败", value: "failed" },
  { label: "导入失败", value: "import_failed" },
  { label: "已取消", value: "cancelled" },
  { label: "未结束", value: "started" },
]
const clientOptions = [
  { label: "全部客户端", value: "" },
  { label: "本地绝区零", value: "local" },
  { label: "云绝区零", value: "cloud" },
]
const versionOptions = computed(() => [
  { label: "全部版本", value: "" },
  ...(summary.value?.versions ?? []).map((item: any) => ({ label: `${item.key}（${item.count}）`, value: item.key })),
])
const errorOptions = computed(() => [
  { label: "全部错误", value: "" },
  ...(summary.value?.errors ?? []).map((item: any) => ({ label: `${item.key}（${item.count}）`, value: item.key })),
])

function formatDateTime(value: unknown) {
  if (!value) return "--"
  const date = new Date(String(value))
  return Number.isNaN(date.valueOf()) ? "--" : date.toLocaleString("zh-CN", { hour12: false })
}

function formatDuration(value: unknown) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds)) return "--"
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10_000 ? 1 : 2)} s`
}

function formatCountList(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "--"
  return value
    .slice(0, 4)
    .map(item => `${item.key} ${item.count}`)
    .join(" · ")
}

function statusLabel(value: string) {
  return ({
    completed: "成功",
    failed: "失败",
    import_failed: "导入失败",
    cancelled: "已取消",
    started: "未结束",
  } as Record<string, string>)[value] ?? value
}

function statusType(value: string) {
  if (value === "completed") return "success"
  if (value === "cancelled" || value === "started") return "warning"
  return "error"
}

const columns = [
  { title: "时间", key: "startedAt", width: 174, render: (row: any) => formatDateTime(row.startedAt) },
  {
    title: "状态",
    key: "status",
    width: 98,
    render: (row: any) => h(NTag, { type: statusType(row.status) as any, size: "small" }, { default: () => statusLabel(row.status) }),
  },
  { title: "Scanner", key: "version", width: 105, render: (row: any) => row.versions?.scannerVersion || "--" },
  { title: "客户端", key: "client", width: 105, render: (row: any) => row.client === "cloud" ? "云端" : "本地" },
  { title: "耗时", key: "durationMs", width: 100, render: (row: any) => formatDuration(row.durationMs) },
  { title: "完成", key: "completed", width: 76, render: (row: any) => row.counters?.completed ?? 0 },
  { title: "错误码", key: "error", ellipsis: { tooltip: true }, render: (row: any) => row.failure?.code || "--" },
]

async function refresh(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  try {
    const filters = {
      ...range.value,
      status: status.value,
      client: client.value,
      scannerVersion: scannerVersion.value,
      errorCode: errorCode.value,
      cursor: (page.value - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }
    const nextSummary = await loadScanTelemetrySummary(range.value)
    const result = await loadScanTelemetrySessions(filters)
    summary.value = nextSummary
    sessions.value = result.sessions ?? []
    total.value = Number(result.total) || 0
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

async function openSession(row: any) {
  detailOpen.value = true
  selectedSession.value = null
  try {
    selectedSession.value = await loadScanTelemetrySession(row.sessionId, range.value)
  } catch (error) {
    detailOpen.value = false
    message.error(error instanceof Error ? error.message : String(error))
  }
}

onMounted(() => void refresh(true))
</script>

<template>
  <div class="internal-scans-view">
    <section class="panel telemetry-header">
      <div>
        <h1 class="panel-title">扫描诊断</h1>
        <p class="section-subtitle">脱敏会话摘要 · 最多保留 30 天</p>
      </div>
      <NButton quaternary circle title="刷新" :loading="loading" @click="refresh(false)">
        <template #icon><RefreshCw :size="17" /></template>
      </NButton>
    </section>

    <NAlert type="info" :show-icon="false">
      这里不保存驱动盘内容、账号、截图、本机路径、完整日志或异常堆栈。
    </NAlert>

    <section class="metric-band" aria-label="扫描诊断汇总">
      <div><span>完成扫描</span><strong>{{ summary?.total ?? 0 }}</strong></div>
      <div><span>成功率</span><strong>{{ ((summary?.successRate ?? 0) * 100).toFixed(1) }}%</strong></div>
      <div><span>失败</span><strong>{{ summary?.failed ?? 0 }}</strong></div>
      <div><span>P95 耗时</span><strong>{{ formatDuration(summary?.durationMs?.p95) }}</strong></div>
    </section>

    <section class="diagnostic-band" aria-label="扫描失败诊断分布">
      <div><span>接收门控</span><strong>{{ formatCountList(summary?.acceptGateReasons) }}</strong></div>
      <div><span>视觉变换</span><strong>{{ formatCountList(summary?.visualTransformClasses) }}</strong></div>
      <div><span>首个缺失 ROI</span><strong>{{ formatCountList(summary?.firstMissingRois) }}</strong></div>
    </section>

    <section class="filter-band">
      <NDatePicker v-model:value="dateRange" type="daterange" :clearable="false" :is-date-disabled="(timestamp: number) => timestamp > endDate || timestamp < endDate - 29 * DAY_MS" @update:value="refresh(true)" />
      <NSelect v-model:value="status" :options="statusOptions" aria-label="状态" @update:value="refresh(true)" />
      <NSelect v-model:value="client" :options="clientOptions" aria-label="客户端" @update:value="refresh(true)" />
      <NSelect v-model:value="scannerVersion" :options="versionOptions" aria-label="Scanner 版本" @update:value="refresh(true)" />
      <NSelect v-model:value="errorCode" :options="errorOptions" aria-label="错误码" @update:value="refresh(true)" />
    </section>

    <section class="table-band">
      <NSpin :show="loading">
        <NDataTable
          :columns="columns"
          :data="sessions"
          :bordered="false"
          :single-line="false"
          :row-props="row => ({ class: 'telemetry-row', onClick: () => openSession(row) })"
          :scroll-x="820"
        />
      </NSpin>
      <NPagination v-if="total > PAGE_SIZE" v-model:page="page" :page-size="PAGE_SIZE" :item-count="total" @update:page="refresh(false)" />
    </section>
  </div>

  <NDrawer v-model:show="detailOpen" :width="560" placement="right">
    <NDrawerContent title="扫描会话详情">
      <NSpin v-if="!selectedSession" />
      <template v-else>
        <dl class="detail-list">
          <div><dt>会话</dt><dd>{{ selectedSession.sessionId }}</dd></div>
          <div><dt>匿名标识</dt><dd>{{ selectedSession.clientId }}</dd></div>
          <div><dt>开始时间</dt><dd>{{ formatDateTime(selectedSession.startedAt) }}</dd></div>
          <div><dt>状态</dt><dd>{{ statusLabel(selectedSession.status) }}</dd></div>
          <div><dt>耗时</dt><dd>{{ formatDuration(selectedSession.durationMs) }}</dd></div>
        </dl>
        <section class="detail-section">
          <h3>版本与计数</h3>
          <pre>{{ JSON.stringify({ versions: selectedSession.versions, counters: selectedSession.counters }, null, 2) }}</pre>
        </section>
        <section v-if="selectedSession.failure?.code" class="detail-section">
          <h3>失败信息</h3>
          <pre>{{ JSON.stringify(selectedSession.failure, null, 2) }}</pre>
        </section>
        <section v-if="Object.keys(selectedSession.diagnostics ?? {}).length" class="detail-section">
          <h3>结构化诊断</h3>
          <pre>{{ JSON.stringify(selectedSession.diagnostics, null, 2) }}</pre>
        </section>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.internal-scans-view {
  display: grid;
  gap: 14px;
}

.telemetry-header,
.filter-band,
.metric-band,
.diagnostic-band,
.table-band {
  min-width: 0;
}

.diagnostic-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 0 2px;
}

.diagnostic-band > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.diagnostic-band span {
  color: var(--app-muted);
  font-size: 12px;
}

.diagnostic-band strong {
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 600;
}

.telemetry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-subtitle {
  margin: 4px 0 0;
  color: var(--app-muted);
  font-size: 13px;
}

.metric-band {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-panel);
}

.metric-band > div {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  border-right: 1px solid var(--app-border);
}

.metric-band > div:last-child {
  border-right: 0;
}

.metric-band span {
  color: var(--app-muted);
  font-size: 12px;
}

.metric-band strong {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}

.filter-band {
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) repeat(4, minmax(130px, 1fr));
  gap: 10px;
}

.table-band {
  overflow: hidden;
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-panel);
}

.table-band :deep(.telemetry-row) {
  cursor: pointer;
}

.table-band :deep(.telemetry-row:hover td) {
  background: #f4f8ff;
}

.table-band :deep(.n-pagination) {
  justify-content: flex-end;
  padding: 12px;
}

.detail-list {
  display: grid;
  margin: 0;
  border-top: 1px solid var(--app-border);
}

.detail-list > div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--app-border);
}

.detail-list dt {
  color: var(--app-muted);
}

.detail-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.detail-section pre {
  max-width: 100%;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--app-border);
  background: #f7f9fc;
  font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 900px) {
  .metric-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .diagnostic-band {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-band :deep(.n-date-picker) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .filter-band {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-band :deep(.n-date-picker) {
    grid-column: auto;
  }
}
</style>
