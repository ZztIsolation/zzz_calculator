<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { NButton, NCheckbox, NDrawer, NDrawerContent, NInput, NInputNumber, NModal, NProgress, NSelect, NSpin, NTab, NTabs, NTag, useMessage } from "naive-ui"
import { Download, FileText, Plus, Radar, Trash2, Upload } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import ScannerErrorState from "@/components/ScannerErrorState.vue"
import { statLabel, labelOf } from "@/utils/format"
import { imageForDriveDiscSet } from "@/utils/assets"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"

const catalogStore = useCatalogStore()
const inventoryStore = useInventoryStore()
const message = useMessage()

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
const confirmRemoveMissingScan = ref(false)

onMounted(async () => {
  await Promise.all([catalogStore.load(), inventoryStore.load()])
})

watch(showScan, visible => {
  if (visible) {
    inventoryStore.openScannerPanel()
  } else {
    const wasScanning = inventoryStore.scanStatus === "scanning"
    inventoryStore.closeScannerPanel()
    if (wasScanning) {
      message.warning("扫描仍在后台运行，可从驱动盘工具栏 › 扫描 回来查看进度")
    }
  }
})

function requestStartScan() {
  if (inventoryStore.scanRemoveMissing) {
    confirmRemoveMissingScan.value = true
    return
  }
  inventoryStore.startScan()
}

function confirmDangerScan() {
  confirmRemoveMissingScan.value = false
  inventoryStore.startScan()
}

function handleScannerError() {
  const variant = inventoryStore.scanErrorVariant
  if (variant === "helper-missing" || variant === "helper-outdated") {
    window.open(inventoryStore.scanHelperDownloadUrl, "_blank")
    return
  }
  if (variant === "scan-failed" || variant === "game-not-found") {
    inventoryStore.startScan()
    return
  }
  inventoryStore.connectScanner()
}

function handleScannerErrorSecondary() {
  inventoryStore.connectScanner()
}

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
const scanControlsDisabled = computed(() => inventoryStore.scanStatus === "scanning" || inventoryStore.scanPreparing)
const scanProgressPercentage = computed(() => Math.min(100, Math.max(0, Math.round(inventoryStore.scanProgressPercent ?? 0))))

const scanPhaseTitle = computed(() => ({
  a: "连接扫描助手",
  b: "准备 OCR 扫描器",
  c: "扫描配置",
  d: "扫描进行 / 完成",
}[inventoryStore.scanPhase] ?? ""))

const scannerErrorMessage = computed(() => {
  const raw = inventoryStore.scanMessage
  if (!raw) {
    return ""
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw
})

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
        <div v-if="!inventoryStore.hasDriveDiscs" class="scan-empty-state">
          <div class="scan-empty-icon">
            <Radar :size="32" :stroke-width="1.6" />
          </div>
          <h3 class="scan-empty-title">还没有驱动盘</h3>
          <p class="scan-empty-subtext">使用扫描助手一键从游戏读取，或从 JSON 导入。</p>
          <div class="scan-empty-actions">
            <NButton type="primary" size="large" @click="showScan = true">
              <template #icon><Radar :size="16" /></template>
              立即扫描
            </NButton>
            <NButton size="large" @click="showImport = true">
              <template #icon><FileText :size="16" /></template>
              粘贴 JSON 导入
            </NButton>
          </div>
        </div>
        <div v-else class="panel" style="max-height: 620px; overflow: auto;">
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
        <div class="metric">
          <span class="metric-title">ID</span>
          <div class="metric-value"><NInput v-model:value="discDraft.id" aria-label="驱动盘 ID" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">套装</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.setId" :options="setOptions" aria-label="驱动盘套装" filterable /></div>
        </div>
        <div class="metric">
          <span class="metric-title">位置</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.partition" :options="[1,2,3,4,5,6].map(slot => ({ label: `${slot}号位`, value: slot }))" aria-label="驱动盘位置" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">品质</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.rarity" :options="['S','A','B'].map(value => ({ label: value, value }))" aria-label="驱动盘品质" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">等级</span>
          <div class="metric-value"><NInputNumber v-model:value="discDraft.level" :min="0" :max="15" aria-label="驱动盘等级" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">装备角色</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.equippedBy" clearable :options="agentOptions" aria-label="驱动盘装备角色" filterable /></div>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric">
          <span class="metric-title">主词条</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.mainStat.stat" :options="mainStatOptions" aria-label="驱动盘主词条" filterable /></div>
        </div>
        <div class="metric">
          <span class="metric-title">主词条数值</span>
          <div class="metric-value"><NInputNumber v-model:value="discDraft.mainStat.value" :step="0.1" aria-label="驱动盘主词条数值" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">锁定</span>
          <div class="metric-value"><NCheckbox v-model:checked="discDraft.locked">锁定</NCheckbox></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">副词条</h3>
          <NButton size="small" :disabled="(discDraft.subStats ?? []).length >= 4" @click="addSubStatRow">新增副词条</NButton>
        </div>
        <div class="panel-body metric-grid">
          <div v-for="(_, index) in discDraft.subStats" :key="index" class="metric" role="group" :aria-label="`副词条 ${index + 1}`">
            <span class="metric-title">副词条 {{ index + 1 }}</span>
            <div class="metric-value section-band">
              <NSelect v-model:value="discDraft.subStats[index].stat" clearable :options="statOptions" :aria-label="`副词条 ${index + 1} 类型`" filterable />
              <NInputNumber v-model:value="discDraft.subStats[index].value" :step="0.1" :aria-label="`副词条 ${index + 1} 数值`" />
              <NButton size="small" type="error" @click="removeSubStatRow(index)">
                <template #icon><Trash2 :size="14" /></template>
                移除
              </NButton>
            </div>
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
        <div class="metric">
          <span class="metric-title">名称</span>
          <div class="metric-value"><NInput v-model:value="loadoutDraft.name" aria-label="套装预设名称" /></div>
        </div>
        <div class="metric">
          <span class="metric-title">角色</span>
          <div class="metric-value"><NSelect v-model:value="loadoutDraft.agentId" :options="agentOptions" aria-label="套装预设角色" filterable /></div>
        </div>
      </div>
      <div class="metric-grid">
        <div v-for="slot in [1,2,3,4,5,6]" :key="slot" class="metric">
          <span class="metric-title">{{ slot }}号位</span>
          <div class="metric-value"><NSelect v-model:value="loadoutDraft.driveDiscIdsBySlot[String(slot)]" clearable filterable :options="discOptionsForSlot(slot)" :aria-label="`${slot}号位驱动盘`" /></div>
        </div>
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
        <ol class="scan-phase-indicator" :data-active="inventoryStore.scanPhase">
          <li v-for="step in [
            { key: 'a', label: '连接助手' },
            { key: 'b', label: '准备 OCR' },
            { key: 'c', label: '扫描配置' },
            { key: 'd', label: '扫描 / 完成' },
          ]" :key="step.key" :class="{ active: inventoryStore.scanPhase === step.key, done: ['a','b','c','d'].indexOf(inventoryStore.scanPhase) > ['a','b','c','d'].indexOf(step.key) }">
            <span class="scan-phase-dot" />
            <span class="scan-phase-label">{{ step.label }}</span>
          </li>
        </ol>
        <p class="muted scan-phase-title">{{ scanPhaseTitle }}</p>

        <ScannerErrorState
          v-if="inventoryStore.scanErrorVariant"
          :variant="inventoryStore.scanErrorVariant"
          :message="scannerErrorMessage"
          :helper-version="inventoryStore.scanHelperVersion"
          @primary="handleScannerError"
          @secondary="handleScannerErrorSecondary"
        />

        <div v-else-if="inventoryStore.scanPhase === 'a'" class="scan-phase-panel scan-phase-a">
          <NSpin size="medium" />
          <p class="muted">{{ inventoryStore.scanMessage || "正在连接扫描助手" }}</p>
        </div>

        <div v-else-if="inventoryStore.scanPhase === 'b'" class="scan-phase-panel scan-phase-b">
          <NProgress
            type="circle"
            :percentage="scanProgressPercentage"
            :status="inventoryStore.scanStatus === 'error' ? 'error' : 'default'"
          />
          <p class="scan-phase-b-message">{{ inventoryStore.scanProgressText || inventoryStore.scanMessage || "正在准备 OCR 扫描器..." }}</p>
        </div>

        <div v-else-if="inventoryStore.scanPhase === 'c'" class="section-band">
          <div class="metric">
            <span class="metric-title">客户端</span>
            <div class="metric-value"><NSelect v-model:value="inventoryStore.scanClient" :disabled="scanControlsDisabled" :options="[{ label: '本地绝区零', value: 'local' }, { label: '云绝区零', value: 'cloud' }]" aria-label="扫描客户端" /></div>
          </div>
          <div class="metric-grid">
            <div class="metric" role="group" aria-label="扫描品质">
              <span class="metric-title">品质</span>
              <div class="metric-value chip-row">
                <NCheckbox v-model:checked="inventoryStore.scanRarityS" :disabled="scanControlsDisabled">S</NCheckbox>
                <NCheckbox v-model:checked="inventoryStore.scanRarityA" :disabled="scanControlsDisabled">A</NCheckbox>
              </div>
            </div>
            <div class="metric">
              <span class="metric-title">上限</span>
              <div class="metric-value"><NInputNumber v-model:value="inventoryStore.scanMaxItems" :disabled="scanControlsDisabled" :min="0" :max="9999" aria-label="扫描数量上限" /></div>
            </div>
          </div>
          <div class="section-band">
            <NCheckbox v-model:checked="inventoryStore.scanStopAtNonLevel15" :disabled="scanControlsDisabled">遇到非 15 级时停止</NCheckbox>
            <NCheckbox v-model:checked="inventoryStore.scanRemoveMissing" :disabled="scanControlsDisabled">同步删除缺失</NCheckbox>
          </div>
          <p v-if="!inventoryStore.scanRaritySelected" class="scan-inline-warning">请至少选择一个品质</p>
          <div class="toolbar">
            <NButton type="primary" size="large" :disabled="!inventoryStore.scanCanStart" @click="requestStartScan">
              开始扫描
            </NButton>
          </div>
        </div>

        <div v-else-if="inventoryStore.scanPhase === 'd'" class="section-band">
          <NProgress
            type="line"
            :percentage="scanProgressPercentage"
            :status="inventoryStore.scanStatus === 'error' ? 'error' : undefined"
          />
          <p class="muted">{{ inventoryStore.scanProgressText || inventoryStore.scanMessage }}</p>
          <div v-if="inventoryStore.scanStatus === 'scanning'" class="toolbar">
            <NButton type="error" @click="inventoryStore.stopScan">
              停止扫描
            </NButton>
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

  <ConfirmDialog
    v-model:show="confirmRemoveMissingScan"
    danger
    title="扫描后同步删除缺失盘"
    message="扫描完成后会删除当前账号中未出现在扫描结果里的驱动盘，并清理相关套装预设槽位，且无法恢复。"
    confirm-text="继续扫描"
    @confirm="confirmDangerScan"
  />
</template>

<style scoped>
.metric-title {
  display: block;
  margin: 0 0 5px;
  color: var(--app-muted);
  font-size: 12px;
}

.metric-value {
  margin: 0;
  font-weight: 750;
}

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

.scan-phase-indicator {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scan-phase-indicator li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  position: relative;
}

.scan-phase-indicator li::before {
  content: "";
  position: absolute;
  top: 12px;
  left: -50%;
  width: 100%;
  height: 2px;
  background: var(--app-border);
}

.scan-phase-indicator li:first-child::before {
  display: none;
}

.scan-phase-indicator li.done::before,
.scan-phase-indicator li.active::before {
  background: var(--app-blue);
}

.scan-phase-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--app-panel);
  border: 2px solid var(--app-border);
  position: relative;
  z-index: 1;
}

.scan-phase-indicator li.active .scan-phase-dot {
  background: var(--app-blue);
  border-color: var(--app-blue);
  box-shadow: 0 0 0 4px rgba(47, 125, 246, 0.15);
}

.scan-phase-indicator li.done .scan-phase-dot {
  background: var(--app-blue);
  border-color: var(--app-blue);
}

.scan-phase-label {
  color: var(--app-muted);
  font-size: 12px;
  text-align: center;
}

.scan-phase-indicator li.active .scan-phase-label {
  color: var(--app-text);
  font-weight: 700;
}

.scan-phase-title {
  margin: 0;
  font-size: 13px;
  text-align: center;
}

.scan-phase-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px 24px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-panel-muted);
}

.scan-phase-b-message {
  margin: 0;
  max-width: 340px;
  color: var(--app-muted);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}

.scan-inline-warning {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
}

.scan-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px 40px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius);
  background: var(--app-panel);
  text-align: center;
}

.scan-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 999px;
  background: var(--app-panel-muted);
  color: var(--app-blue);
  margin-bottom: 4px;
}

.scan-empty-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.scan-empty-subtext {
  margin: 0;
  max-width: 320px;
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.6;
}

.scan-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;
}
</style>
