<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NInput,
  NModal,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui"
import { Eye, RefreshCw, RotateCcw, Upload } from "lucide-vue-next"
import { useBuildStore } from "@/stores/build"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"
import {
  applyEnkaImportPlan,
  currentEnkaBinding,
  importEnkaShowcase,
  planEnkaImport,
} from "@/utils/enkaImport"
import {
  hasCommittedEnkaUndo,
  recoverPendingEnkaImport,
  undoLastEnkaImport,
} from "@runtime/enka-import-transaction"

const catalogStore = useCatalogStore()
const buildStore = useBuildStore()
const inventoryStore = useInventoryStore()
const message = useMessage()

const uid = ref("")
const ownerId = ref("default")
const binding = ref<any>(null)
const loading = ref(false)
const planning = ref(false)
const applying = ref(false)
const undoing = ref(false)
const canUndo = ref(false)
const error = ref("")
const ttlSeconds = ref(0)
const mappedAgents = ref<any[]>([])
const skippedAgents = ref<any[]>([])
const warnings = ref<string[]>([])
const selectedIds = ref<string[]>([])
const previewPlan = shallowRef<any>(null)
let requestController: AbortController | null = null

const busy = computed(() => loading.value || planning.value || applying.value || undoing.value)
const controlsLocked = computed(() => busy.value || Boolean(previewPlan.value))
const hasResult = computed(() => mappedAgents.value.length > 0 || skippedAgents.value.length > 0)
const selectedAgents = computed(() => mappedAgents.value.filter(agent => selectedIds.value.includes(agent.agentId)))
const bindingMismatch = computed(() => binding.value?.uid && uid.value.trim() && binding.value.uid !== uid.value.trim())

function resetResult() {
  mappedAgents.value = []
  skippedAgents.value = []
  warnings.value = []
  selectedIds.value = []
  ttlSeconds.value = 0
  previewPlan.value = null
}

async function refreshBindingAndUndo() {
  const current = await currentEnkaBinding()
  ownerId.value = current.ownerId
  binding.value = current.binding
  canUndo.value = await hasCommittedEnkaUndo(current.ownerId)
}

async function loadShowcase() {
  const value = uid.value.trim()
  if (!/^\d{8,12}$/.test(value)) {
    error.value = "UID 必须是 8–12 位数字。"
    return
  }
  await refreshBindingAndUndo()
  if (binding.value && binding.value.uid !== value) {
    error.value = `当前账号已绑定 UID ${binding.value.uid}，请切换或新建 Calculator 账号。`
    return
  }

  requestController?.abort()
  requestController = new AbortController()
  loading.value = true
  error.value = ""
  resetResult()
  try {
    const result = await importEnkaShowcase(value, requestController.signal)
    if (uid.value.trim() !== value) return
    mappedAgents.value = result.mappedAgents
    skippedAgents.value = result.skippedAgents
    warnings.value = result.warnings
    ttlSeconds.value = result.ttlSeconds
    selectedIds.value = result.mappedAgents.map((agent: any) => agent.agentId)
    if (!result.mappedAgents.length && !result.skippedAgents.length) {
      error.value = "Enka 没有返回公开展柜角色，请确认已开启角色详情展示。"
    }
  } catch (caught) {
    if ((caught as Error)?.name !== "AbortError") error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    loading.value = false
  }
}

function agentSummary(agent: any): string {
  const parts = [
    `Lv.${agent.agentLevel ?? "保留"}`,
    `影画 ${agent.cinemaLevel ?? "保留"}`,
    `核心技 ${agent.coreSkillLevel ?? "保留"}`,
  ]
  if (agent.wEngine) parts.push(`${agent.wEngine.name} Lv.${agent.wEngine.level ?? "保留"} P${agent.wEngine.modificationLevel ?? "保留"}`)
  const discs = agent.driveDiscPreset?.driveDiscs?.length ?? 0
  parts.push(`驱动盘 ${discs}/${agent.driveDiscSourceCount ?? 0}`)
  return parts.join(" / ")
}

function driveOperationRows(drive: any): string[] {
  const operations = drive?.operations ?? {}
  const discLabel = (item: any) => `${item.partition ?? "?"}号位${item.setName ? ` ${item.setName}` : ""}`
  return [
    ...(operations.added ?? []).map((item: any) => `新增：${discLabel(item)}`),
    ...(operations.updated ?? []).map((item: any) => `更新：${discLabel(item)}`),
    ...(operations.migratedDiscs ?? []).map((item: any) => `迁移：${discLabel(item)}（${item.beforeId} → ${item.afterId}）`),
    ...(operations.migratedLoadouts ?? []).map((item: any) => `迁移稳定配装：${item.beforeId} → ${item.afterId}`),
    ...(operations.unequipped ?? []).map((item: any) => `解除装备：${discLabel(item)}`),
  ]
}

async function openPreview() {
  if (!selectedAgents.value.length) return
  planning.value = true
  error.value = ""
  const frozenUid = uid.value.trim()
  const frozenAgents = JSON.parse(JSON.stringify(selectedAgents.value))
  try {
    previewPlan.value = await planEnkaImport(frozenUid, frozenAgents)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    planning.value = false
  }
}

function closePreview() {
  if (!applying.value) previewPlan.value = null
}

async function confirmImport() {
  const plan = previewPlan.value
  if (!plan || applying.value) return
  applying.value = true
  try {
    await applyEnkaImportPlan(plan)
    previewPlan.value = null
    await Promise.all([inventoryStore.load(), catalogStore.load(), refreshBindingAndUndo()])
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    message.success(`已导入 ${plan.agents.length} 个角色，库存与配置已同步。`)
  } catch (caught) {
    message.error(caught instanceof Error ? caught.message : String(caught))
  } finally {
    applying.value = false
  }
}

async function undoImport() {
  if (undoing.value) return
  undoing.value = true
  try {
    await undoLastEnkaImport(ownerId.value)
    await Promise.all([inventoryStore.load(), catalogStore.load(), refreshBindingAndUndo()])
    buildStore.initialize(catalogStore.catalog, catalogStore.meta)
    resetResult()
    message.success("最近一次 Enka 导入已撤销。")
  } catch (caught) {
    message.error(caught instanceof Error ? caught.message : String(caught))
  } finally {
    undoing.value = false
  }
}

onMounted(async () => {
  try {
    const current = await currentEnkaBinding()
    ownerId.value = current.ownerId
    const recovery = await recoverPendingEnkaImport(current.ownerId)
    if (recovery === "rolled-back") message.warning("检测到未完成的 Enka 导入，已自动回滚。")
    if (recovery === "committed") message.info("检测到已完成的 Enka 导入，事务状态已恢复。")
    await Promise.all([refreshBindingAndUndo(), inventoryStore.load()])
    if (binding.value?.uid) uid.value = binding.value.uid
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
})

onBeforeUnmount(() => requestController?.abort())
</script>

<template>
  <section class="import-view" aria-labelledby="import-title">
    <header class="page-header">
      <div>
        <h1 id="import-title">Enka 展柜导入</h1>
        <p>当前账号：{{ ownerId }}<span v-if="binding"> / 已绑定 UID {{ binding.uid }}</span></p>
      </div>
      <NButton v-if="canUndo" secondary :loading="undoing" :disabled="busy" @click="undoImport">
        <template #icon><RotateCcw :size="16" /></template>
        撤销上次导入
      </NButton>
    </header>

    <NCard size="small" class="import-tool">
      <label class="field-label" for="enka-uid">游戏 UID</label>
      <div class="uid-row">
        <NInput
          v-model:value="uid"
          :input-props="{ id: 'enka-uid', 'aria-label': '游戏 UID', inputmode: 'numeric' }"
          placeholder="8–12 位数字"
          :disabled="controlsLocked"
          style="max-width: 280px"
          @keyup.enter="loadShowcase"
        />
        <NButton type="primary" :loading="loading" :disabled="controlsLocked || !uid.trim() || bindingMismatch" @click="loadShowcase">
          <template #icon><RefreshCw :size="16" /></template>
          读取展柜
        </NButton>
      </div>
      <NAlert v-if="bindingMismatch" type="error" class="block">
        当前账号已绑定 UID {{ binding.uid }}。请前往<RouterLink to="/accounts">账号页</RouterLink>切换或新建账号。
      </NAlert>
      <NAlert v-if="error" type="error" :title="error" class="block" />
      <NAlert v-if="ttlSeconds > 0" type="info" class="block" :title="`缓存剩余约 ${ttlSeconds} 秒`" />
      <NAlert v-for="(warning, index) in warnings" :key="`${index}-${warning}`" type="warning" :title="warning" class="block" />
    </NCard>

    <section v-if="hasResult" class="results" aria-labelledby="showcase-title">
      <div class="list-header">
        <h2 id="showcase-title">展柜角色</h2>
        <NButton type="primary" :loading="planning" :disabled="controlsLocked || !selectedIds.length" @click="openPreview">
          <template #icon><Eye :size="16" /></template>
          预览更改（{{ selectedIds.length }}）
        </NButton>
      </div>
      <div class="agent-list">
        <label v-for="agent in mappedAgents" :key="agent.agentId" class="agent-row">
          <NCheckbox
            :checked="selectedIds.includes(agent.agentId)"
            :disabled="controlsLocked"
            :aria-label="`选择导入 ${agent.agentName}`"
            :aria-disabled="controlsLocked"
            @update:checked="(checked:boolean) => {
              selectedIds = checked ? [...selectedIds, agent.agentId] : selectedIds.filter(id => id !== agent.agentId)
            }"
          />
          <span class="agent-info">
            <strong>{{ agent.agentName }}</strong>
            <span class="meta">{{ agentSummary(agent) }}</span>
          </span>
        </label>
        <div v-for="item in skippedAgents" :key="item.enkaId" class="agent-row skipped">
          <span class="checkbox-spacer" />
          <span class="agent-info">
            <strong>{{ item.name }}</strong>
            <span class="meta">{{ item.reason }}</span>
          </span>
          <NTag size="small">已跳过</NTag>
        </div>
      </div>
    </section>

    <NModal :show="Boolean(previewPlan)" :mask-closable="!applying" @update:show="shown => { if (!shown) closePreview() }">
      <NCard class="preview-modal" title="确认 Enka 导入" role="dialog" aria-modal="true">
        <NSpin :show="applying">
          <div v-if="previewPlan" class="preview-content">
            <NAlert type="info" :title="`UID ${previewPlan.uid} / ${previewPlan.agents.length} 个角色 / ${previewPlan.changeCount} 项更改`" />
            <div v-for="agent in previewPlan.agents" :key="agent.agentId" class="preview-agent">
              <h3>{{ agent.agentName }}</h3>
              <p v-if="!agent.changes.length" class="meta">没有配置变化</p>
              <dl v-else>
                <div v-for="change in agent.changes" :key="`${agent.agentId}-${change.field}`">
                  <dt>{{ change.label }}</dt>
                  <dd><span>{{ change.before }}</span><strong>→</strong><span>{{ change.after }}</span></dd>
                </div>
              </dl>
              <ul v-if="driveOperationRows(agent.drive).length" class="drive-operations" aria-label="驱动盘同步变化">
                <li v-for="(operation, index) in driveOperationRows(agent.drive)" :key="`${agent.agentId}-drive-${index}`">
                  {{ operation }}
                </li>
              </ul>
              <NAlert v-if="agent.drive?.skipped" type="warning" :title="agent.drive.reason" />
            </div>
            <NAlert v-for="warning in previewPlan.warnings" :key="warning" type="warning" :title="warning" />
          </div>
        </NSpin>
        <template #footer>
          <div class="modal-actions">
            <NButton :disabled="applying" @click="closePreview">取消</NButton>
            <NButton type="primary" :loading="applying" @click="confirmImport">
              <template #icon><Upload :size="16" /></template>
              确认导入
            </NButton>
          </div>
        </template>
      </NCard>
    </NModal>
  </section>
</template>

<style scoped>
.import-view { display: flex; flex-direction: column; gap: 16px; }
.page-header, .list-header, .modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-header h1, .list-header h2, .preview-agent h3 { margin: 0; }
.page-header h1 { font-size: 24px; }
.page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
.field-label { display: block; margin-bottom: 6px; color: #334155; font-size: 13px; font-weight: 600; }
.uid-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.block { margin-top: 12px; }
.results { display: flex; flex-direction: column; gap: 10px; }
.list-header h2 { font-size: 18px; }
.agent-list { border-top: 1px solid #e2e8f0; }
.agent-row { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 4px; border-bottom: 1px solid #e2e8f0; }
.agent-row.skipped { opacity: 0.72; }
.checkbox-spacer { width: 16px; }
.agent-info { min-width: 0; flex: 1; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.meta { color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
.preview-modal { width: min(760px, calc(100vw - 24px)); max-height: min(760px, calc(100vh - 24px)); }
.preview-content { display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 220px); overflow: auto; }
.preview-agent { padding-top: 10px; border-top: 1px solid #e2e8f0; }
.preview-agent h3 { font-size: 15px; }
.preview-agent dl { margin: 8px 0 0; }
.preview-agent dl div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px; padding: 5px 0; }
.preview-agent dt { color: #475569; }
.preview-agent dd { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; overflow-wrap: anywhere; }
.drive-operations { margin: 8px 0 0; padding-left: 20px; color: #334155; font-size: 13px; overflow-wrap: anywhere; }
.drive-operations li + li { margin-top: 4px; }
.modal-actions { justify-content: flex-end; }
@media (max-width: 480px) {
  .page-header, .list-header { align-items: flex-start; flex-direction: column; }
  .uid-row > * { width: 100%; max-width: none !important; }
  .preview-agent dl div { grid-template-columns: 1fr; }
}
</style>
