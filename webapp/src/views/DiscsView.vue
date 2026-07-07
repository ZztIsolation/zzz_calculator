<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { NButton, NCheckbox, NDrawer, NDrawerContent, NInput, NInputNumber, NModal, NProgress, NSelect, NTab, NTabs, NTag } from "naive-ui"
import { Download, Plus, Radar, Trash2, Upload } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { statLabel, labelOf } from "@/utils/format"
import { imageForDriveDiscSet } from "@/utils/assets"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"

const catalogStore = useCatalogStore()
const inventoryStore = useInventoryStore()

const selectedDisc = ref<any | null>(null)
const showDiscEditor = ref(false)
const discDraft = ref<any>({ mainStat: {}, subStats: [] })
const confirmDelete = ref(false)

const showLoadoutEditor = ref(false)
const loadoutDraft = ref<any>({ driveDiscIdsBySlot: {} })
const deleteLoadoutId = ref("")

const showImport = ref(false)
const importText = ref("")
const removeMissing = ref(false)
const importError = ref("")
const confirmRemoveMissingImport = ref(false)
const pendingDangerImport = ref<"paste" | "">("")

const showScan = ref(false)

onMounted(async () => {
  await Promise.all([catalogStore.load(), inventoryStore.load()])
})

watch(showScan, visible => {
  if (visible) {
    inventoryStore.openScannerPanel()
  } else {
    inventoryStore.closeScannerPanel()
  }
})

const slotTabs = computed(() => [
  { name: "全部", value: 0, count: inventoryStore.driveDiscs.length },
  ...[1, 2, 3, 4, 5, 6].map(slot => ({
    name: `${slot}号位`,
    value: slot,
    count: inventoryStore.slotCounts[slot] ?? 0,
  })),
])

const setOptions = computed(() => catalogStore.driveDiscSets.map((set: any) => ({ label: labelOf(set), value: set.id })))
const agentOptions = computed(() => catalogStore.agents.map((agent: any) => ({ label: labelOf(agent), value: agent.id })))
const statOptions = computed(() => Object.entries(catalogStore.meta?.statRules?.statDisplay ?? {})
  .map(([value]) => ({ label: statLabel(value, catalogStore.meta), value }))
  .sort((left, right) => left.label.localeCompare(right.label, "zh-CN")))
const mainStatOptions = computed(() => {
  const slot = String(discDraft.value.partition ?? 1)
  const pool = catalogStore.meta?.statRules?.driveDisc?.mainStatPools?.[slot] ?? statOptions.value.map(item => item.value)
  return pool.map((value: string) => ({ label: statLabel(value, catalogStore.meta), value }))
})
const loadoutDeleteTarget = computed(() => inventoryStore.loadouts.find((item: any) => item.id === deleteLoadoutId.value))
const loadoutMissingSlots = computed(() => [1, 2, 3, 4, 5, 6]
  .filter(slot => !loadoutDraft.value.driveDiscIdsBySlot?.[String(slot)]))

function mainStatText(disc: any) {
  const main = disc?.mainStat ?? {}
  return `${statLabel(main.stat, catalogStore.meta)} ${main.value ?? ""}`
}

function subStatText(disc: any) {
  return (disc?.subStats ?? [])
    .map((stat: any) => `${statLabel(stat.stat, catalogStore.meta)} ${stat.value}`)
    .join(" / ")
}

function driveDiscSetForDisc(disc: any) {
  const byId = catalogStore.driveDiscSets.find((set: any) => set.id === disc?.setId)
  if (byId) {
    return byId
  }
  const setName = String(disc?.setName ?? "").trim()
  const byName = setName
    ? catalogStore.driveDiscSets.find((set: any) => labelOf(set) === setName || set?.name?.zhCN === setName || set?.name?.en === setName)
    : null
  if (byName) {
    return byName
  }
  return {
    id: String(disc?.setId ?? ""),
    name: { zhCN: setName || String(disc?.setId ?? "未知套装") },
    images: {},
  }
}

function driveDiscSetName(disc: any) {
  return disc?.setName || labelOf(driveDiscSetForDisc(disc)) || disc?.setId || "未知套装"
}

function driveDiscSetIcon(disc: any) {
  return imageForDriveDiscSet(driveDiscSetForDisc(disc))
}

function driveDiscIdentityMeta(disc: any) {
  return disc?.source?.sequence ? `#${disc.source.sequence}` : disc?.id
}

function discOptionLabel(disc: any) {
  return `${disc.setName || disc.setId} · ${disc.partition}号位 · ${mainStatText(disc)}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`
}

function discOptionsForSlot(slot: number) {
  return [
    { label: "空槽位", value: "" },
    ...inventoryStore.discOptionsForSlot(slot).map((disc: any) => ({ label: discOptionLabel(disc), value: disc.id })),
  ]
}

function defaultMainStatForSlot(slot: number | string) {
  const pool = catalogStore.meta?.statRules?.driveDisc?.mainStatPools?.[String(slot)] ?? []
  return pool[0] ?? "hpFlat"
}

function defaultMainStatValue(stat: string) {
  const defaults: Record<string, number> = {
    hpFlat: 2200,
    atkFlat: 316,
    defFlat: 184,
    critRate: 24,
    critDmg: 48,
    anomalyProficiency: 92,
    anomalyMastery: 30,
    energyRegen: 60,
  }
  return defaults[stat] ?? 30
}

function openNewDisc() {
  selectedDisc.value = null
  const stat = defaultMainStatForSlot(1)
  discDraft.value = {
    id: `disc-${Date.now()}`,
    setId: catalogStore.driveDiscSets[0]?.id ?? "woodpecker_electro",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    mainStat: { stat, value: defaultMainStatValue(stat) },
    subStats: [
      { stat: "critRate", value: 0 },
      { stat: "critDmg", value: 0 },
      { stat: "atkPct", value: 0 },
      { stat: "anomalyProficiency", value: 0 },
    ],
    locked: false,
    equippedBy: "",
  }
  showDiscEditor.value = true
}

function openEditDisc(disc: any) {
  selectedDisc.value = disc
  discDraft.value = JSON.parse(JSON.stringify(disc))
  discDraft.value.subStats = [...(discDraft.value.subStats ?? []), {}, {}, {}, {}].slice(0, 4)
  showDiscEditor.value = true
}

async function saveDisc() {
  const set = catalogStore.driveDiscSets.find((item: any) => item.id === discDraft.value.setId)
  await inventoryStore.saveDisc({
    ...discDraft.value,
    setName: discDraft.value.setName || labelOf(set),
    subStats: (discDraft.value.subStats ?? []).filter((item: any) => item?.stat),
  })
  showDiscEditor.value = false
  selectedDisc.value = null
}

function addSubStatRow() {
  discDraft.value.subStats = [
    ...(discDraft.value.subStats ?? []),
    { stat: "", value: 0 },
  ].slice(0, 4)
}

function removeSubStatRow(index: number) {
  discDraft.value.subStats = (discDraft.value.subStats ?? []).filter((_: any, itemIndex: number) => itemIndex !== index)
}

watch(() => discDraft.value.partition, slot => {
  if (!showDiscEditor.value) {
    return
  }
  const pool = mainStatOptions.value.map((item: any) => item.value)
  if (!pool.includes(discDraft.value.mainStat?.stat)) {
    const stat = defaultMainStatForSlot(slot)
    discDraft.value.mainStat = {
      stat,
      value: defaultMainStatValue(stat),
    }
  }
})

async function deleteSelectedDisc() {
  const id = selectedDisc.value?.id ?? discDraft.value?.id
  if (!id) {
    return
  }
  await inventoryStore.removeDisc(id)
  selectedDisc.value = null
  showDiscEditor.value = false
  confirmDelete.value = false
}

function openNewLoadout() {
  loadoutDraft.value = {
    id: `loadout-${Date.now()}`,
    name: "未命名套装",
    agentId: catalogStore.agents[0]?.id || "",
    driveDiscIdsBySlot: {},
  }
  showLoadoutEditor.value = true
}

function openEditLoadout(loadout: any) {
  loadoutDraft.value = JSON.parse(JSON.stringify(loadout))
  loadoutDraft.value.driveDiscIdsBySlot = {
    ...(loadout.idsBySlot ?? {}),
    ...(loadout.driveDiscIdsBySlot ?? {}),
  }
  showLoadoutEditor.value = true
}

async function saveLoadout() {
  await inventoryStore.saveLoadout(loadoutDraft.value)
  showLoadoutEditor.value = false
}

async function confirmDeleteLoadout() {
  await inventoryStore.removeLoadout(deleteLoadoutId.value)
  deleteLoadoutId.value = ""
  showLoadoutEditor.value = false
}

const importPreviewSections = computed(() => {
  const preview = inventoryStore.importPreview
  if (!preview?.summary) {
    return []
  }
  return [
    { key: "added", label: "新增", count: preview.summary.added ?? 0, rows: preview.added ?? [] },
    { key: "updated", label: "更新", count: preview.summary.updated ?? 0, rows: (preview.updated ?? []).map((item: any) => item.after ?? item.imported ?? item) },
    { key: "unchanged", label: "未变", count: preview.summary.skipped ?? 0, rows: (preview.unchanged ?? []).map((item: any) => item.after ?? item.imported ?? item) },
    { key: "removed", label: "删除", count: preview.summary.removed ?? 0, rows: preview.removed ?? [] },
  ].filter(section => section.count > 0)
})

const scanPreviewSections = computed(() => {
  const preview = inventoryStore.scanSession?.preview
  if (!preview?.summary) {
    return []
  }
  return [
    { key: "added", label: "新增", count: preview.summary.added ?? 0, rows: preview.added ?? [] },
    { key: "updated", label: "更新", count: preview.summary.updated ?? 0, rows: (preview.updated ?? []).map((item: any) => item.after ?? item.imported ?? item) },
    { key: "unchanged", label: "未变", count: preview.summary.skipped ?? 0, rows: (preview.unchanged ?? []).map((item: any) => item.after ?? item.imported ?? item) },
    { key: "removed", label: "将删除", count: preview.summary.removed ?? 0, rows: preview.removed ?? [] },
  ].filter(section => section.count > 0)
})
const scanStatusType = computed(() => {
  if (inventoryStore.scanStatus === "error") {
    return "error"
  }
  if (inventoryStore.scanStatus === "complete" || inventoryStore.scanStatus === "ready") {
    return "success"
  }
  if (inventoryStore.scanStatus === "waiting-helper") {
    return "warning"
  }
  return "info"
})
const scanStatusLabel = computed(() => ({
  idle: "待连接",
  connecting: "连接中",
  "waiting-helper": "等待助手",
  preparing: "准备中",
  downloading: "下载中",
  ready: "就绪",
  scanning: "扫描中",
  complete: "已完成",
  error: "异常",
}[inventoryStore.scanStatus] ?? inventoryStore.scanStatus))
const scanControlsDisabled = computed(() => inventoryStore.scanStatus === "scanning" || inventoryStore.scanPreparing)
const scanProgressPercentage = computed(() => Math.min(100, Math.max(0, Math.round(inventoryStore.scanProgressPercent ?? 0))))

async function previewImport() {
  importError.value = ""
  try {
    await inventoryStore.previewImportText(importText.value, removeMissing.value)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
  }
}

function requestImportScannerJson() {
  if (removeMissing.value) {
    pendingDangerImport.value = "paste"
    confirmRemoveMissingImport.value = true
    return
  }
  importScannerJson()
}

async function importScannerJson(forceRemoveMissing = false) {
  importError.value = ""
  try {
    await inventoryStore.importScannerJson(importText.value, forceRemoveMissing || removeMissing.value)
    showImport.value = false
    importText.value = ""
    removeMissing.value = false
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
  }
}

async function previewFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  importError.value = ""
  try {
    importText.value = await file.text()
    await inventoryStore.previewImportText(importText.value, removeMissing.value)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
  } finally {
    ;(event.target as HTMLInputElement).value = ""
  }
}

function confirmDangerImport() {
  if (pendingDangerImport.value === "paste") {
    importScannerJson(true)
  }
  pendingDangerImport.value = ""
}
</script>

<template>
  <section class="section-band">
    <div class="panel">
      <div class="panel-header">
        <h1 class="panel-title">驱动盘仓库</h1>
        <div class="toolbar">
          <NButton @click="openNewDisc">
            <template #icon><Plus :size="16" /></template>
            新增
          </NButton>
          <NButton @click="inventoryStore.load">
            <template #icon><Download :size="16" /></template>
            刷新
          </NButton>
          <NButton type="primary" @click="showImport = true">
            <template #icon><Upload :size="16" /></template>
            导入
          </NButton>
          <NButton @click="showScan = true">
            <template #icon><Radar :size="16" /></template>
            扫描
          </NButton>
        </div>
      </div>
      <div class="panel-body section-band">
        <div class="toolbar">
          <NInput v-model:value="inventoryStore.search" clearable placeholder="搜索套装、主词条或 ID" style="max-width: 320px" />
          <NSelect v-model:value="inventoryStore.mainStatFilter" clearable :options="inventoryStore.mainStatOptions.map(stat => ({ label: statLabel(stat, catalogStore.meta), value: stat }))" placeholder="主词条" style="max-width: 200px" />
          <NTag round>{{ inventoryStore.driveDiscs.length }} 件</NTag>
          <NTag round>{{ inventoryStore.loadouts.length }} 个套装预设</NTag>
        </div>
        <NTabs v-model:value="inventoryStore.slotFilter" type="segment">
          <NTab v-for="slot in slotTabs" :key="slot.value" :name="slot.value">
            {{ slot.name }} {{ slot.count }}
          </NTab>
        </NTabs>
        <div class="panel" style="max-height: 620px; overflow: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>驱动盘</th>
                <th>槽位</th>
                <th>等级</th>
                <th>主词条</th>
                <th>副词条</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disc in inventoryStore.filteredDriveDiscs" :key="disc.id" @click="openEditDisc(disc)">
                <td>
                  <div class="disc-row-identity">
                    <ImageAvatar :src="driveDiscSetIcon(disc)" :name="driveDiscSetName(disc)" :size="44" />
                    <div class="disc-row-meta">
                      <strong>{{ driveDiscSetName(disc) }}</strong>
                      <span>{{ driveDiscIdentityMeta(disc) }}</span>
                    </div>
                  </div>
                </td>
                <td class="num">{{ disc.partition }}</td>
                <td><span class="rarity-pill">{{ disc.rarity || "S" }} +{{ Number(disc.level ?? 0) }}</span></td>
                <td>{{ mainStatText(disc) }}</td>
                <td class="muted">{{ subStatText(disc) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!inventoryStore.filteredDriveDiscs.length" class="empty-state">暂无数据</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2 class="panel-title">套装预设</h2>
        <NButton size="small" @click="openNewLoadout">新增预设</NButton>
      </div>
      <div class="panel-body">
        <div v-if="inventoryStore.loadouts.length" class="entity-grid">
          <article v-for="loadout in inventoryStore.loadouts" :key="loadout.id" class="panel">
            <div class="panel-header">
              <h3 class="panel-title">{{ loadout.name || loadout.id }}</h3>
              <NTag :type="loadout.status === 'complete' ? 'success' : 'warning'" round>{{ Object.keys(loadout.driveDiscIdsBySlot ?? loadout.idsBySlot ?? {}).length }} / 6</NTag>
            </div>
            <div class="panel-body section-band">
              <div class="chip-row">
                <NTag v-for="slot in [1,2,3,4,5,6]" :key="slot" round>{{ slot }}号位 {{ (loadout.driveDiscIdsBySlot ?? {})[String(slot)] ? '已选' : '空' }}</NTag>
              </div>
              <NButton size="small" @click="openEditLoadout(loadout)">编辑</NButton>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">暂无套装预设</div>
      </div>
    </div>
  </section>

  <NModal v-model:show="showDiscEditor" preset="card" :title="discDraft.id ? '编辑驱动盘' : '新增驱动盘'" style="max-width: 920px">
    <div class="section-band">
      <div class="metric-grid">
        <label class="metric">
          <dt>ID</dt>
          <dd><NInput v-model:value="discDraft.id" /></dd>
        </label>
        <label class="metric">
          <dt>套装</dt>
          <dd><NSelect v-model:value="discDraft.setId" :options="setOptions" filterable /></dd>
        </label>
        <label class="metric">
          <dt>位置</dt>
          <dd><NSelect v-model:value="discDraft.partition" :options="[1,2,3,4,5,6].map(slot => ({ label: `${slot}号位`, value: slot }))" /></dd>
        </label>
        <label class="metric">
          <dt>品质</dt>
          <dd><NSelect v-model:value="discDraft.rarity" :options="['S','A','B'].map(value => ({ label: value, value }))" /></dd>
        </label>
        <label class="metric">
          <dt>等级</dt>
          <dd><NInputNumber v-model:value="discDraft.level" :min="0" :max="15" /></dd>
        </label>
        <label class="metric">
          <dt>装备角色</dt>
          <dd><NSelect v-model:value="discDraft.equippedBy" clearable :options="agentOptions" filterable /></dd>
        </label>
      </div>
      <div class="metric-grid">
        <label class="metric">
          <dt>主词条</dt>
          <dd><NSelect v-model:value="discDraft.mainStat.stat" :options="mainStatOptions" filterable /></dd>
        </label>
        <label class="metric">
          <dt>主词条数值</dt>
          <dd><NInputNumber v-model:value="discDraft.mainStat.value" :step="0.1" /></dd>
        </label>
        <label class="metric">
          <dt>锁定</dt>
          <dd><NCheckbox v-model:checked="discDraft.locked">锁定</NCheckbox></dd>
        </label>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">副词条</h3>
          <NButton size="small" :disabled="(discDraft.subStats ?? []).length >= 4" @click="addSubStatRow">新增副词条</NButton>
        </div>
        <div class="panel-body metric-grid">
          <div v-for="(_, index) in discDraft.subStats" :key="index" class="metric">
            <dt>副词条 {{ index + 1 }}</dt>
            <dd class="section-band">
              <NSelect v-model:value="discDraft.subStats[index].stat" clearable :options="statOptions" filterable />
              <NInputNumber v-model:value="discDraft.subStats[index].value" :step="0.1" />
              <NButton size="small" type="error" @click="removeSubStatRow(index)">
                <template #icon><Trash2 :size="14" /></template>
                移除
              </NButton>
            </dd>
          </div>
        </div>
      </div>
      <details>
        <summary>原始 JSON 预览</summary>
        <pre class="raw">{{ JSON.stringify(discDraft, null, 2) }}</pre>
      </details>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showDiscEditor = false">取消</NButton>
        <NButton v-if="selectedDisc" type="error" @click="confirmDelete = true">删除</NButton>
        <NButton type="primary" @click="saveDisc">保存</NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showLoadoutEditor" preset="card" title="编辑套装预设" style="max-width: 880px">
    <div class="section-band">
      <div class="metric-grid">
        <label class="metric">
          <dt>名称</dt>
          <dd><NInput v-model:value="loadoutDraft.name" /></dd>
        </label>
        <label class="metric">
          <dt>角色</dt>
          <dd><NSelect v-model:value="loadoutDraft.agentId" :options="agentOptions" filterable /></dd>
        </label>
      </div>
      <div class="metric-grid">
        <label v-for="slot in [1,2,3,4,5,6]" :key="slot" class="metric">
          <dt>{{ slot }}号位</dt>
          <dd><NSelect v-model:value="loadoutDraft.driveDiscIdsBySlot[String(slot)]" clearable filterable :options="discOptionsForSlot(slot)" /></dd>
        </label>
      </div>
      <div class="chip-row">
        <NTag :type="loadoutMissingSlots.length ? 'warning' : 'success'" round>
          {{ loadoutMissingSlots.length ? `缺失 ${loadoutMissingSlots.join('、')} 号位` : '六槽完整' }}
        </NTag>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showLoadoutEditor = false">取消</NButton>
        <NButton v-if="loadoutDraft.id" type="error" @click="deleteLoadoutId = loadoutDraft.id">删除</NButton>
        <NButton type="primary" @click="saveLoadout">保存</NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showImport" preset="card" title="导入扫描器 JSON" style="max-width: 760px">
    <div class="section-band">
      <NInput v-model:value="importText" type="textarea" placeholder="粘贴扫描器导出的 JSON" :autosize="{ minRows: 8, maxRows: 16 }" />
      <div class="toolbar">
        <input type="file" accept=".json,application/json" @change="previewFileImport">
        <NCheckbox v-model:checked="removeMissing">同步删除本地存在但本次扫描缺失的驱动盘</NCheckbox>
      </div>
      <div class="toolbar">
        <NButton @click="previewImport">预览</NButton>
        <NTag v-if="inventoryStore.importPreview" round>当前 {{ inventoryStore.importPreview.currentCount }} → {{ inventoryStore.importPreview.nextCount }}</NTag>
        <NTag v-if="inventoryStore.importPreview" type="success" round>新增 {{ inventoryStore.importPreview.summary.added }}</NTag>
        <NTag v-if="inventoryStore.importPreview" type="info" round>更新 {{ inventoryStore.importPreview.summary.updated }}</NTag>
        <NTag v-if="inventoryStore.importPreview" round>未变 {{ inventoryStore.importPreview.summary.skipped }}</NTag>
        <NTag v-if="inventoryStore.importPreview?.summary?.removed" type="error" round>将删除 {{ inventoryStore.importPreview.summary.removed }}</NTag>
        <NTag v-if="inventoryStore.importSummary" type="success" round>
          新增 {{ inventoryStore.importSummary.added }}，更新 {{ inventoryStore.importSummary.updated }}，移除 {{ inventoryStore.importSummary.removed }}
        </NTag>
      </div>
      <div v-if="inventoryStore.importPreview?.warnings?.length" class="section-band">
        <NTag v-for="warning in inventoryStore.importPreview.warnings" :key="warning" type="warning">{{ warning }}</NTag>
      </div>
      <div v-if="importPreviewSections.length" class="panel" style="max-height: 300px; overflow: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>槽位</th>
              <th>套装</th>
              <th>主词条</th>
              <th>等级</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="section in importPreviewSections" :key="section.key">
              <tr v-for="disc in section.rows.slice(0, 12)" :key="`${section.key}-${disc.id}`">
                <td><NTag :type="section.key === 'removed' ? 'error' : section.key === 'added' ? 'success' : 'info'" size="small" round>{{ section.label }}</NTag></td>
                <td class="num">{{ disc.partition }}</td>
                <td>{{ disc.setName || disc.setId }}</td>
                <td>{{ mainStatText(disc) }}</td>
                <td class="num">{{ disc.level ?? "-" }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <NTag v-if="importError" type="error">{{ importError }}</NTag>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showImport = false">取消</NButton>
        <NButton type="primary" :disabled="!inventoryStore.importPreview" @click="requestImportScannerJson">确认导入</NButton>
      </div>
    </template>
  </NModal>

  <NDrawer v-model:show="showScan" width="460" placement="right">
    <NDrawerContent title="驱动盘扫描">
      <div class="section-band">
        <div class="toolbar">
          <NTag :type="scanStatusType" round>{{ scanStatusLabel }}</NTag>
          <NButton v-if="inventoryStore.scanStatus === 'error'" size="small" @click="inventoryStore.connectScanner">
            重新尝试
          </NButton>
        </div>
        <p class="muted">{{ inventoryStore.scanMessage }}</p>

        <div v-if="inventoryStore.scanWaitingForHelper" class="scan-helper-panel">
          <div class="scan-guide-step">
            <span class="scan-guide-num">1</span>
            <div>
              <strong>安装本地扫描助手</strong>
              <p class="muted">小助手会连接网页、更新本地 OCR 扫描器并启动扫描。</p>
              <div class="toolbar">
                <a class="scan-download-link primary" :href="inventoryStore.scanHelperDownloadUrl" download>下载 ZZZ Scanner Helper</a>
                <a class="scan-download-link" :href="inventoryStore.scanHelperMirrorDownloadUrl" download>备用下载</a>
              </div>
            </div>
          </div>
          <div class="scan-guide-step">
            <span class="scan-guide-num">2</span>
            <div>
              <strong>运行一次后回到网页</strong>
              <p class="muted">之后点击扫描会自动唤起小助手，并在这里继续连接。</p>
            </div>
          </div>
          <div class="toolbar">
            <NButton @click="inventoryStore.launchScannerHelper">重新唤起</NButton>
            <NButton @click="inventoryStore.connectScanner">重新连接</NButton>
          </div>
        </div>

        <div v-else class="section-band">
          <label class="metric">
            <dt>客户端</dt>
            <dd><NSelect v-model:value="inventoryStore.scanClient" :disabled="scanControlsDisabled" :options="[{ label: '本地绝区零', value: 'local' }, { label: '云绝区零', value: 'cloud' }]" /></dd>
          </label>
          <div class="metric-grid">
            <label class="metric">
              <dt>品质</dt>
              <dd class="chip-row">
                <NCheckbox v-model:checked="inventoryStore.scanRarityS" :disabled="scanControlsDisabled">S</NCheckbox>
                <NCheckbox v-model:checked="inventoryStore.scanRarityA" :disabled="scanControlsDisabled">A</NCheckbox>
              </dd>
            </label>
            <label class="metric">
              <dt>上限</dt>
              <dd><NInputNumber v-model:value="inventoryStore.scanMaxItems" :disabled="scanControlsDisabled" :min="0" :max="9999" /></dd>
            </label>
          </div>
          <div class="section-band">
            <NCheckbox v-model:checked="inventoryStore.scanStopAtNonLevel15" :disabled="scanControlsDisabled">遇到非 15 级时停止</NCheckbox>
            <NCheckbox v-model:checked="inventoryStore.scanRemoveMissing" :disabled="scanControlsDisabled">同步删除缺失</NCheckbox>
          </div>
          <div v-if="inventoryStore.scanProgressText || inventoryStore.scanProgressPercent !== null" class="scan-progress">
            <NProgress type="line" :percentage="scanProgressPercentage" :show-indicator="false" :status="inventoryStore.scanStatus === 'error' ? 'error' : undefined" />
            <p class="muted">{{ inventoryStore.scanProgressText }}</p>
          </div>
          <div class="toolbar">
            <NButton type="primary" :disabled="!inventoryStore.scanCanStart" @click="inventoryStore.startScan">
              开始扫描
            </NButton>
            <NButton v-if="inventoryStore.scanStatus === 'scanning'" type="error" @click="inventoryStore.stopScan">
              停止扫描
            </NButton>
          </div>
        </div>

        <div v-if="inventoryStore.scanSession?.preview" class="section-band">
          <div class="toolbar">
            <NTag type="success" round>新增 {{ inventoryStore.scanSession.preview.summary.added }}</NTag>
            <NTag type="info" round>更新 {{ inventoryStore.scanSession.preview.summary.updated }}</NTag>
            <NTag round>未变 {{ inventoryStore.scanSession.preview.summary.skipped }}</NTag>
            <NTag v-if="inventoryStore.scanSession.preview.summary.removed" type="error" round>删除 {{ inventoryStore.scanSession.preview.summary.removed }}</NTag>
            <NTag v-if="inventoryStore.scanSession.imported" type="success" round>已自动导入</NTag>
          </div>
          <div v-if="scanPreviewSections.length" class="panel" style="max-height: 260px; overflow: auto;">
            <table class="data-table">
              <tbody>
                <template v-for="section in scanPreviewSections" :key="section.key">
                  <tr v-for="disc in section.rows.slice(0, 8)" :key="`${section.key}-${disc.id}`">
                    <th><NTag :type="section.key === 'removed' ? 'error' : section.key === 'added' ? 'success' : 'info'" size="small" round>{{ section.label }}</NTag></th>
                    <td>{{ disc.partition }}号位</td>
                    <td>{{ disc.setName || disc.setId }}</td>
                    <td>{{ mainStatText(disc) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
        <NTag v-if="inventoryStore.scanSession?.error" type="error">{{ inventoryStore.scanSession.error }}</NTag>
      </div>
    </NDrawerContent>
  </NDrawer>

  <ConfirmDialog
    v-model:show="confirmDelete"
    danger
    title="删除驱动盘"
    :message="`将删除 ${selectedDisc?.setName || selectedDisc?.setId || discDraft?.setId || ''} ${selectedDisc?.partition || discDraft?.partition || ''}号位，并清理相关套装预设槽位。`"
    confirm-text="删除"
    @confirm="deleteSelectedDisc"
  />

  <ConfirmDialog
    :show="Boolean(deleteLoadoutId)"
    danger
    title="删除套装预设"
    :message="`将删除「${loadoutDeleteTarget?.name || deleteLoadoutId}」。`"
    confirm-text="删除"
    @update:show="value => { if (!value) deleteLoadoutId = '' }"
    @confirm="confirmDeleteLoadout"
  />

  <ConfirmDialog
    v-model:show="confirmRemoveMissingImport"
    danger
    title="同步删除缺失盘"
    message="本次导入会删除当前账号中未出现在扫描结果里的驱动盘，并清理相关套装预设槽位。"
    confirm-text="确认同步删除"
    @confirm="confirmDangerImport"
  />
</template>

<style scoped>
.raw {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #f8fafc;
}

.disc-row-identity {
  display: flex;
  min-width: 220px;
  align-items: center;
  gap: 10px;
}

.disc-row-meta {
  min-width: 0;
}

.disc-row-meta strong,
.disc-row-meta span {
  display: block;
}

.disc-row-meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disc-row-meta span {
  margin-top: 2px;
  color: var(--app-muted);
  font-size: 12px;
}

.rarity-pill {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid #f3d46f;
  border-radius: 999px;
  background: #fff8d8;
  color: #7c5b00;
  font-weight: 800;
}

.scan-helper-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #f8fafc;
}

.scan-guide-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
}

.scan-guide-num {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #111827;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.scan-download-link {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  color: #111827;
  text-decoration: none;
  font-weight: 600;
}

.scan-download-link.primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.scan-progress {
  display: grid;
  gap: 6px;
}
</style>
