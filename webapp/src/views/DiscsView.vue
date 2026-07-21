<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { NAlert, NButton, NCheckbox, NDrawer, NDrawerContent, NInput, NInputNumber, NModal, NProgress, NSelect, NSpin, NTab, NTabs, NTag, useMessage } from "naive-ui"
import { Download, FileText, LockKeyhole, Plus, Radar, RefreshCw, Upload } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import DriveDiscPickerModal from "@/components/DriveDiscPickerModal.vue"
import DriveDiscSlotCard from "@/components/DriveDiscSlotCard.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import ScannerErrorState from "@/components/ScannerErrorState.vue"
import { formatNumber, statLabel, labelOf } from "@/utils/format"
import { imageForAgent, imageForDriveDiscSet } from "@/utils/assets"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"
import { driveDiscReservationStateForLoadout } from "@core/inventory-model.js"
import { scanTelemetryPreferenceEnabled } from "@runtime/scan-telemetry"

const catalogStore = useCatalogStore()
const inventoryStore = useInventoryStore()
const message = useMessage()

const SUB_STAT_LABELS: Record<string, string> = {
  hpFlat: "小生命（固定生命值）",
  atkFlat: "小攻击（固定攻击力）",
  defFlat: "小防御（固定防御力）",
  hpPct: "大生命（生命值%）",
  atkPct: "大攻击（攻击力%）",
  defPct: "大防御（防御力%）",
  critRate: "暴击率",
  critDmg: "暴击伤害",
  anomalyProficiency: "异常精通",
  penFlat: "穿透值",
}
const PERCENT_SUB_STATS = new Set(["hpPct", "atkPct", "defPct", "critRate", "critDmg"])
const ROLL_COUNT_OPTIONS = Array.from({ length: 6 }, (_, index) => ({
  label: `${index + 1} 个词条`,
  value: index + 1,
}))
const ROLL_EPSILON = 1e-6

const selectedDisc = ref<any | null>(null)
const showDiscEditor = ref(false)
const discDraft = ref<any>({ mainStat: {}, subStats: [] })
const confirmDelete = ref(false)
const showDiscReservation = ref(false)
const reservationDisc = ref<any | null>(null)
const reservationAgentId = ref("")
const reservationSaving = ref(false)
const showReservationConflict = ref(false)
const reservationConflicts = ref<any[]>([])
const pendingReservationAction = ref<any | null>(null)

const showLoadoutEditor = ref(false)
const loadoutDraft = ref<any>({ driveDiscIdsBySlot: {} })
const loadoutIsNew = ref(false)
const deleteLoadoutId = ref("")
const showLoadoutDiscPicker = ref(false)
const activeLoadoutDiscSlot = ref(0)

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
    const wasScanning = ["scanning", "stopping"].includes(inventoryStore.scanStatus)
    inventoryStore.closeScannerPanel()
    if (wasScanning) {
      message.warning("扫描仍在后台运行，可从驱动盘工具栏 › 扫描 回来查看进度")
    }
  }
})

watch(showImport, visible => {
  if (visible) {
    inventoryStore.importPreview = null
    importError.value = ""
  }
})

watch([importText, removeMissing], () => {
  inventoryStore.importPreview = null
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

async function handleScannerError() {
  const variant = inventoryStore.scanErrorVariant
  if (variant === "helper-outdated") {
    if (inventoryStore.scanHelperCanSelfUpdate) {
      await inventoryStore.retryHelperUpgrade()
      return
    }
    window.open(inventoryStore.scanHelperDownloadUrl, "_blank")
    inventoryStore.waitForManualHelperUpgrade()
    return
  }
  if (variant === "helper-missing") {
    window.open(inventoryStore.scanHelperDownloadUrl, "_blank")
    return
  }
  if (variant === "helper-rejected") {
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
  if (inventoryStore.scanErrorVariant === "helper-outdated" && inventoryStore.scanHelperCanSelfUpdate) {
    window.open(inventoryStore.scanHelperDownloadUrl, "_blank")
    inventoryStore.waitForManualHelperUpgrade()
    return
  }
  inventoryStore.connectScanner()
}

async function handleScannerDiagnosticAction(kind: string) {
  if (kind === "copy_diagnostics") {
    await inventoryStore.handleScannerFailureAction(kind)
    try {
      await navigator.clipboard.writeText(inventoryStore.scannerDiagnosticText())
      message.success("诊断信息已复制")
    } catch {
      message.error("浏览器无法复制诊断信息，请打开日志目录查看")
    }
    return
  }
  await inventoryStore.handleScannerFailureAction(kind)
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
const reservationFilterOptions = computed(() => {
  const options = [
    { label: "全部专属状态", value: "" },
    { label: "所有角色专属盘", value: "reserved" },
    { label: "公共驱动盘", value: "public" },
  ]
  const ids: string[] = [...new Set<string>(inventoryStore.driveDiscs
    .map((disc: any) => String(disc.reservedForAgentId ?? "").trim())
    .filter(Boolean))]
  for (const id of ids) {
    options.push({ label: agentName(id), value: id })
  }
  return options
})
const reservationAgentOptions = computed(() => {
  const options = [...agentOptions.value]
  const current = String(reservationDisc.value?.reservedForAgentId ?? "").trim()
  if (current && !options.some(option => option.value === current)) {
    options.push({ label: `未知角色（${current}）`, value: current })
  }
  return options
})
const statOptions = computed(() => Object.entries(catalogStore.meta?.statRules?.statDisplay ?? {})
  .map(([value]) => ({ label: statLabel(value, catalogStore.meta), value }))
  .sort((left, right) => left.label.localeCompare(right.label, "zh-CN")))
const subStatSteps = computed<Record<string, number>>(() => catalogStore.meta?.statRules?.driveDisc?.sRankSubStatBaseStep ?? {})
const allowedSubStatKeys = computed<string[]>(() => {
  const pool = catalogStore.meta?.statRules?.driveDisc?.subStatPool ?? []
  return pool.filter((stat: string) => Number(subStatSteps.value[stat]) > 0 && SUB_STAT_LABELS[stat])
})
const mainStatOptions = computed(() => {
  const slot = String(discDraft.value.partition ?? 1)
  const pool = catalogStore.meta?.statRules?.driveDisc?.mainStatPools?.[slot] ?? statOptions.value.map(item => item.value)
  return pool.map((value: string) => ({ label: statLabel(value, catalogStore.meta), value }))
})
const loadoutDeleteTarget = computed(() => inventoryStore.loadouts.find((item: any) => item.id === deleteLoadoutId.value))
const loadoutMissingSlots = computed(() => [1, 2, 3, 4, 5, 6]
  .filter(slot => !loadoutDraft.value.driveDiscIdsBySlot?.[String(slot)]))
const loadoutEditorRows = computed(() => loadoutDiscRows(loadoutDraft.value))
const discEditorValidationMessage = computed(() => validateDiscDraft())
const discDraftStoragePreview = computed(() => ({
  ...discDraft.value,
  subStats: (discDraft.value.subStats ?? []).map((item: any) => storedSubStat(item)),
}))

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

function agentForId(agentId: string | null | undefined) {
  return catalogStore.agents.find((agent: any) => agent.id === agentId)
}

function agentName(agentId: string | null | undefined) {
  if (!agentId) return "公共"
  const agent = agentForId(agentId)
  return agent ? labelOf(agent) : `未知角色（${agentId}）`
}

function loadoutAgent(loadout: any) {
  return agentForId(loadout?.agentId)
}

function loadoutReservationState(loadout: any) {
  return driveDiscReservationStateForLoadout(inventoryStore.store, loadout)
}

function loadoutDiscRows(loadout: any) {
  const idsBySlot = loadout?.driveDiscIdsBySlot ?? loadout?.idsBySlot ?? {}
  const ownerId = String(loadout?.ownerId ?? inventoryStore.store?.currentOwnerId ?? "default")
  return [1, 2, 3, 4, 5, 6].map(slot => {
    const id = String(idsBySlot[String(slot)] ?? "").trim()
    const disc = id
      ? inventoryStore.driveDiscs.find((item: any) =>
          String(item.id) === id
          && String(item.ownerId ?? "default") === ownerId
          && Number(item.partition) === slot)
      : null
    return {
      slot,
      id,
      disc: disc ?? null,
      missingReference: Boolean(id && !disc),
    }
  })
}

function loadoutPresentCount(loadout: any) {
  return loadoutReservationState(loadout).presentCount
}

function loadoutScoreText(loadout: any) {
  if (loadout?.score === null || loadout?.score === undefined || !Number.isFinite(Number(loadout.score))) {
    return ""
  }
  return `评分 ${formatNumber(Number(loadout.score), 0)}`
}

function openDiscReservation(disc: any) {
  reservationDisc.value = disc
  reservationAgentId.value = String(disc?.reservedForAgentId ?? "")
  showDiscReservation.value = true
}

function conflictDisc(conflict: any) {
  return inventoryStore.driveDiscs.find((disc: any) => disc.id === conflict?.discId)
}

async function commitReservation(action: any, allowTransfer = false) {
  reservationSaving.value = true
  try {
    const result = await inventoryStore.reserveDiscs(action.discIds, action.agentId || null, allowTransfer)
    if (!result.applied) {
      pendingReservationAction.value = action
      reservationConflicts.value = result.conflicts ?? []
      showReservationConflict.value = true
      return false
    }
    message.success(action.successMessage)
    showDiscReservation.value = false
    reservationDisc.value = null
    return true
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
    return false
  } finally {
    reservationSaving.value = false
  }
}

async function applyDiscReservation() {
  if (!reservationDisc.value) return
  const targetAgentId = reservationAgentId.value || null
  await commitReservation({
    kind: "disc",
    discIds: [reservationDisc.value.id],
    agentId: targetAgentId,
    successMessage: targetAgentId
      ? `已锁定给${agentName(targetAgentId)}`
      : "已解除角色专属",
  })
}

async function togglePresetDiscReservation(disc: any, loadout: any) {
  const inventoryDisc = inventoryStore.driveDiscs.find((item: any) => item.id === disc?.id)
  const targetAgentId = String(loadout?.agentId ?? "").trim()
  if (!inventoryDisc?.id || !targetAgentId) return
  const currentAgentId = String(inventoryDisc.reservedForAgentId ?? "").trim()
  const nextAgentId = currentAgentId === targetAgentId ? null : targetAgentId
  await commitReservation({
    kind: "disc",
    discIds: [inventoryDisc.id],
    agentId: nextAgentId,
    successMessage: nextAgentId
      ? `已锁定给${agentName(nextAgentId)}`
      : "已解除角色专属",
  })
}

async function confirmReservationTransfer() {
  const action = pendingReservationAction.value
  if (!action) return
  const applied = await commitReservation(action, true)
  if (applied) {
    showReservationConflict.value = false
    reservationConflicts.value = []
    pendingReservationAction.value = null
  }
}

function driveDiscSetIcon(disc: any) {
  return imageForDriveDiscSet(driveDiscSetForDisc(disc))
}

function driveDiscIdentityMeta(disc: any) {
  return disc?.source?.sequence ? `#${disc.source.sequence}` : disc?.id
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

function subStatStep(stat: string) {
  const step = Number(subStatSteps.value[stat] ?? 0)
  return Number.isFinite(step) && step > 0 ? step : 0
}

function subStatValue(stat: string, rolls: unknown) {
  const value = subStatStep(stat) * Number(rolls)
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0
}

function inferredRollCount(item: any) {
  const step = subStatStep(String(item?.stat ?? ""))
  const value = Number(item?.value)
  if (!step || !Number.isFinite(value)) {
    return null
  }
  const rolls = value / step
  const integerRolls = Math.round(rolls)
  if (Math.abs(rolls - integerRolls) > ROLL_EPSILON || integerRolls < 1 || integerRolls > 6) {
    return null
  }
  return integerRolls
}

function editorSubStat(item: any) {
  return {
    ...item,
    rolls: inferredRollCount(item),
  }
}

function emptyEditorSubStat() {
  return { stat: "", value: 0, rolls: 1 }
}

function fixedEditorSubStats(items: any[] = []) {
  return [
    ...items.slice(0, 4).map((item: any) => editorSubStat(item)),
    ...Array.from({ length: 4 }, () => emptyEditorSubStat()),
  ].slice(0, 4)
}

function storedSubStat(item: any) {
  const stat = String(item?.stat ?? "")
  const rollCount = Number(item?.rolls)
  if (!Number.isInteger(rollCount) || rollCount < 1 || rollCount > 6) {
    return { stat, value: item?.value }
  }
  return {
    stat,
    value: subStatValue(stat, rollCount),
  }
}

function subStatOptionsForRow(index: number) {
  const current = String(discDraft.value.subStats?.[index]?.stat ?? "")
  const selectedElsewhere = new Set((discDraft.value.subStats ?? [])
    .filter((_: any, itemIndex: number) => itemIndex !== index)
    .map((item: any) => String(item?.stat ?? ""))
    .filter(Boolean))
  const mainStat = String(discDraft.value.mainStat?.stat ?? "")
  return allowedSubStatKeys.value
    .filter(stat => stat === current || (!selectedElsewhere.has(stat) && stat !== mainStat))
    .map(stat => ({ label: SUB_STAT_LABELS[stat], value: stat }))
}

function updateSubStatType(index: number, stat: string) {
  const item = discDraft.value.subStats[index]
  const rolls = Number(item?.rolls)
  item.stat = stat
  item.rolls = Number.isInteger(rolls) && rolls >= 1 && rolls <= 6 ? rolls : 1
  item.value = subStatValue(stat, item.rolls)
}

function updateSubStatRolls(index: number, rolls: number | string) {
  const item = discDraft.value.subStats[index]
  item.rolls = Number(rolls)
  item.value = subStatValue(String(item?.stat ?? ""), item.rolls)
}

function formattedSubStatValue(item: any) {
  if (!item?.stat || !Number.isInteger(Number(item?.rolls))) {
    return "待选择"
  }
  const value = subStatValue(item.stat, item.rolls)
  return PERCENT_SUB_STATS.has(item.stat) ? `${value}%` : String(value)
}

function validateDiscDraft() {
  if (!showDiscEditor.value) {
    return ""
  }
  if (String(discDraft.value.rarity ?? "S") !== "S") {
    return "手动编辑仅支持 S 级驱动盘；当前导入记录会保持原样。"
  }
  const subStats = discDraft.value.subStats ?? []
  if (subStats.length !== 4) {
    return "请为四个副词条分别选择属性。"
  }
  const seen = new Set<string>()
  for (const item of subStats) {
    const stat = String(item?.stat ?? "")
    if (!stat) {
      return "请为四个副词条分别选择属性。"
    }
    if (!allowedSubStatKeys.value.includes(stat)) {
      return "请选择合法的驱动盘副词条。"
    }
    if (stat === String(discDraft.value.mainStat?.stat ?? "")) {
      return "副词条不能与主词条相同。"
    }
    if (seen.has(stat)) {
      return "同一种副词条不能重复选择。"
    }
    seen.add(stat)
    const rolls = Number(item?.rolls)
    if (!Number.isInteger(rolls) || rolls < 1 || rolls > 6) {
      return `${SUB_STAT_LABELS[stat]}的现有数值无法精确换算为 1～6 个词条，请重新选择词条数。`
    }
  }
  return ""
}

function openNewDisc() {
  selectedDisc.value = null
  const stat = defaultMainStatForSlot(1)
  discDraft.value = {
    setId: catalogStore.driveDiscSets[0]?.id ?? "woodpecker_electro",
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    mainStat: { stat, value: defaultMainStatValue(stat) },
    subStats: fixedEditorSubStats(),
    locked: false,
  }
  showDiscEditor.value = true
}

function openEditDisc(disc: any) {
  selectedDisc.value = disc
  discDraft.value = JSON.parse(JSON.stringify(disc))
  discDraft.value.subStats = fixedEditorSubStats(discDraft.value.subStats ?? [])
  showDiscEditor.value = true
}

async function saveDisc() {
  const validationMessage = validateDiscDraft()
  if (validationMessage) {
    message.error(validationMessage)
    return
  }
  const set = catalogStore.driveDiscSets.find((item: any) => item.id === discDraft.value.setId)
  await inventoryStore.saveDisc({
    ...discDraft.value,
    rarity: "S",
    maxLevel: 15,
    setName: discDraft.value.setName || labelOf(set),
    subStats: (discDraft.value.subStats ?? []).map((item: any) => storedSubStat(item)),
  })
  showDiscEditor.value = false
  selectedDisc.value = null
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

watch(() => discDraft.value.mainStat?.stat, stat => {
  if (!showDiscEditor.value || !stat) {
    return
  }
  discDraft.value.subStats = (discDraft.value.subStats ?? []).map((item: any) =>
    item?.stat === stat ? emptyEditorSubStat() : item
  )
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
  loadoutIsNew.value = true
  loadoutDraft.value = {
    id: `loadout-${Date.now()}`,
    name: "未命名套装",
    agentId: catalogStore.agents[0]?.id || "",
    driveDiscIdsBySlot: {},
  }
  activeLoadoutDiscSlot.value = 0
  showLoadoutDiscPicker.value = false
  showLoadoutEditor.value = true
}

function openEditLoadout(loadout: any) {
  loadoutIsNew.value = false
  loadoutDraft.value = JSON.parse(JSON.stringify(loadout))
  loadoutDraft.value.driveDiscIdsBySlot = {
    ...(loadout.idsBySlot ?? {}),
    ...(loadout.driveDiscIdsBySlot ?? {}),
  }
  activeLoadoutDiscSlot.value = 0
  showLoadoutDiscPicker.value = false
  showLoadoutEditor.value = true
}

function openLoadoutDiscPicker(slot: number) {
  activeLoadoutDiscSlot.value = Number(slot)
  showLoadoutDiscPicker.value = true
}

function selectLoadoutDisc(disc: any) {
  if (!activeLoadoutDiscSlot.value || !disc?.id) return
  loadoutDraft.value.driveDiscIdsBySlot = {
    ...(loadoutDraft.value.driveDiscIdsBySlot ?? {}),
    [String(activeLoadoutDiscSlot.value)]: String(disc.id),
  }
  showLoadoutDiscPicker.value = false
}

function clearLoadoutDiscSlot() {
  if (!activeLoadoutDiscSlot.value) return
  const next = { ...(loadoutDraft.value.driveDiscIdsBySlot ?? {}) }
  delete next[String(activeLoadoutDiscSlot.value)]
  loadoutDraft.value.driveDiscIdsBySlot = next
  showLoadoutDiscPicker.value = false
}

function cancelLoadoutEditor() {
  showLoadoutDiscPicker.value = false
  showLoadoutEditor.value = false
}

async function saveLoadout() {
  await inventoryStore.saveLoadout(loadoutDraft.value)
  loadoutIsNew.value = false
  showLoadoutDiscPicker.value = false
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
const scanControlsDisabled = computed(() => ["scanning", "stopping"].includes(inventoryStore.scanStatus) || inventoryStore.scanPreparing)
const scanTelemetryEnabled = computed(() => scanTelemetryPreferenceEnabled())
const scanProgressPercentage = computed(() => Math.min(100, Math.max(0, Math.round(inventoryStore.scanProgressPercent ?? 0))))
const scanRuntimeStatus = computed(() => {
  if (!['c', 'd'].includes(inventoryStore.scanPhase)) return ""
  if (!inventoryStore.scanHelperVersion || !inventoryStore.scanScannerVersion) return ""
  return `Helper ${inventoryStore.scanHelperVersion} · Scanner ${inventoryStore.scanScannerVersion} · 后台运行`
})

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
const scannerErrorPrimaryLabel = computed(() => (
  inventoryStore.scanErrorVariant === "helper-outdated" && inventoryStore.scanHelperCanSelfUpdate
    ? "重试自动更新"
    : ""
))
const scannerErrorSecondaryLabel = computed(() => {
  if (inventoryStore.scanErrorVariant !== "helper-outdated") return undefined
  return inventoryStore.scanHelperCanSelfUpdate ? "手动下载最新版" : "重新检测"
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

async function exportDriveDiscs() {
  let objectUrl = ""
  try {
    const exported = await inventoryStore.prepareCurrentAccountExport()
    const blob = new Blob([exported.text], { type: exported.mimeType })
    objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = exported.fileName
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    message.success(`已导出 ${exported.payload.driveDiscs.length} 个驱动盘`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
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
  <section class="section-band ui-layout-scope" data-layout-surface="drive-discs-page">
    <div class="panel">
      <div class="panel-header inventory-toolbar-header">
        <h1 class="panel-title">驱动盘仓库</h1>
        <div class="toolbar inventory-toolbar-actions">
          <NButton data-testid="open-drive-disc-editor" @click="openNewDisc">
            <template #icon><Plus :size="16" /></template>
            新增单个
          </NButton>
          <NButton @click="inventoryStore.load">
            <template #icon><RefreshCw :size="16" /></template>
            刷新
          </NButton>
          <NButton @click="showImport = true">
            <template #icon><Upload :size="16" /></template>
            批量导入
          </NButton>
          <NButton
            :disabled="inventoryStore.loading || !inventoryStore.hasDriveDiscs"
            :title="inventoryStore.hasDriveDiscs ? '导出当前账号的全部驱动盘' : '当前账号没有可导出的驱动盘'"
            @click="exportDriveDiscs"
          >
            <template #icon><Download :size="16" /></template>
            批量导出
          </NButton>
          <NButton type="primary" @click="showScan = true">
            <template #icon><Radar :size="16" /></template>
            扫描
          </NButton>
        </div>
      </div>
      <div class="panel-body section-band">
        <div class="toolbar">
          <NInput v-model:value="inventoryStore.search" clearable placeholder="搜索套装、主词条或 ID" style="max-width: 320px" />
          <NSelect v-model:value="inventoryStore.mainStatFilter" clearable :options="inventoryStore.mainStatOptions.map(stat => ({ label: statLabel(stat, catalogStore.meta), value: stat }))" placeholder="主词条" style="max-width: 200px" />
          <NSelect v-model:value="inventoryStore.reservationFilter" :options="reservationFilterOptions" style="max-width: 220px" aria-label="专属角色筛选" />
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
                <th>专属角色</th>
                <th aria-label="操作"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disc in inventoryStore.filteredDriveDiscs" :key="disc.id" @click="openEditDisc(disc)">
                <td>
                  <div class="disc-row-identity">
                    <ImageAvatar :src="driveDiscSetIcon(disc)" :name="driveDiscSetName(disc)" :size="44" />
                    <div class="disc-row-meta">
                      <strong :title="driveDiscSetName(disc)">{{ driveDiscSetName(disc) }}</strong>
                      <span :title="driveDiscIdentityMeta(disc)">{{ driveDiscIdentityMeta(disc) }}</span>
                    </div>
                  </div>
                </td>
                <td class="num">{{ disc.partition }}</td>
                <td><span class="rarity-pill">{{ disc.rarity || "S" }} +{{ Number(disc.level ?? 0) }}</span></td>
                <td>{{ mainStatText(disc) }}</td>
                <td class="muted">{{ subStatText(disc) }}</td>
                <td>
                  <div v-if="disc.reservedForAgentId" class="reservation-agent">
                    <ImageAvatar
                      :src="imageForAgent(agentForId(disc.reservedForAgentId))"
                      :name="agentName(disc.reservedForAgentId)"
                      :size="26"
                    />
                    <span>{{ agentName(disc.reservedForAgentId) }}</span>
                  </div>
                  <NTag v-else round>公共</NTag>
                </td>
                <td>
                  <NButton
                    circle
                    quaternary
                    size="small"
                    :title="disc.reservedForAgentId ? '调整专属角色' : '锁定给角色'"
                    :aria-label="disc.reservedForAgentId ? '调整专属角色' : '锁定给角色'"
                    @click.stop="openDiscReservation(disc)"
                  >
                    <template #icon><LockKeyhole :size="16" /></template>
                  </NButton>
                </td>
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
        <div v-if="inventoryStore.loadouts.length" class="loadout-visual-grid" data-layout-surface="loadout-presets">
          <article v-for="loadout in inventoryStore.loadouts" :key="loadout.id" class="loadout-visual-card">
            <div class="panel-header">
              <div class="loadout-heading-copy">
                <h3 class="panel-title">{{ loadout.name || loadout.id }}</h3>
                <div class="reservation-agent loadout-agent">
                  <ImageAvatar :src="imageForAgent(loadoutAgent(loadout))" :name="agentName(loadout.agentId)" :size="24" />
                  <span>{{ agentName(loadout.agentId) }}</span>
                </div>
              </div>
              <div class="chip-row">
                <NTag :type="loadoutPresentCount(loadout) === 6 ? 'success' : 'warning'" round>{{ loadoutPresentCount(loadout) }} / 6</NTag>
                <NTag
                  :type="loadoutReservationState(loadout).reservedCount === 6 ? 'success' : loadoutReservationState(loadout).conflictingCount ? 'error' : 'default'"
                  round
                >
                  专属 {{ loadoutReservationState(loadout).reservedCount }} / 6
                </NTag>
                <NTag v-if="loadoutScoreText(loadout)" type="info" round>{{ loadoutScoreText(loadout) }}</NTag>
              </div>
            </div>
            <div class="loadout-slot-grid">
              <DriveDiscSlotCard
                v-for="row in loadoutDiscRows(loadout)"
                :key="row.slot"
                class="loadout-slot-card"
                :slot="row.slot"
                :disc="row.disc"
                :drive-disc-sets="catalogStore.driveDiscSets"
                :meta="catalogStore.meta"
                :agents="catalogStore.agents"
                :target-agent-id="loadout.agentId"
                :missing-reference="row.missingReference"
                :reservation-busy="reservationSaving"
                current-reservation-prefix="当前预设角色"
                show-sequence
                show-reservation
                reservation-action
                @toggle-reservation="togglePresetDiscReservation($event, loadout)"
              />
            </div>
            <div class="loadout-card-footer">
              <NButton size="small" @click="openEditLoadout(loadout)">编辑</NButton>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">暂无套装预设</div>
      </div>
    </div>
  </section>

  <NModal v-model:show="showDiscEditor" preset="card" :title="selectedDisc ? '编辑驱动盘' : '新增驱动盘'" style="width: min(920px, calc(100vw - 16px)); max-width: 920px">
    <div class="section-band ui-layout-scope" data-layout-surface="drive-disc-editor">
      <div class="metric-grid ui-field-grid">
        <div class="metric" data-layout-field>
          <span class="metric-title">套装</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.setId" :options="setOptions" aria-label="驱动盘套装" filterable /></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">位置</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.partition" :options="[1,2,3,4,5,6].map(slot => ({ label: `${slot}号位`, value: slot }))" aria-label="驱动盘位置" /></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">品质</span>
          <div class="metric-value"><NTag :type="discDraft.rarity === 'S' ? 'success' : 'warning'" round>{{ discDraft.rarity || 'S' }}</NTag></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">等级</span>
          <div class="metric-value"><NInputNumber v-model:value="discDraft.level" :min="0" :max="15" aria-label="驱动盘等级" /></div>
        </div>
      </div>
      <div class="metric-grid ui-field-grid">
        <div class="metric" data-layout-field>
          <span class="metric-title">主词条</span>
          <div class="metric-value"><NSelect v-model:value="discDraft.mainStat.stat" :options="mainStatOptions" aria-label="驱动盘主词条" filterable /></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">主词条数值</span>
          <div class="metric-value"><NInputNumber v-model:value="discDraft.mainStat.value" :step="0.1" aria-label="驱动盘主词条数值" /></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">物品锁定</span>
          <div class="metric-value"><NCheckbox v-model:checked="discDraft.locked">锁定</NCheckbox></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">副词条</h3>
        </div>
        <div class="panel-body substat-editor-list">
          <div v-for="(_, index) in discDraft.subStats" :key="index" class="substat-editor-row" role="group" :aria-label="`副词条 ${index + 1}`">
            <span class="metric-title">副词条 {{ index + 1 }}</span>
            <div class="substat-editor-fields ui-field-grid" data-layout-surface="drive-disc-substat">
              <NSelect
                data-layout-field
                :value="discDraft.subStats[index].stat"
                :options="subStatOptionsForRow(index)"
                :aria-label="`副词条 ${index + 1} 类型`"
                placeholder="选择属性"
                filterable
                @update:value="updateSubStatType(index, String($event ?? ''))"
              />
              <NSelect
                data-layout-field
                :value="discDraft.subStats[index].rolls"
                :options="ROLL_COUNT_OPTIONS"
                :aria-label="`副词条 ${index + 1} 词条数`"
                @update:value="updateSubStatRolls(index, $event)"
              />
              <output class="substat-roll-result" :aria-label="`副词条 ${index + 1} 换算结果`" data-layout-field>
                {{ formattedSubStatValue(discDraft.subStats[index]) }}
              </output>
            </div>
          </div>
        </div>
      </div>
      <p v-if="discEditorValidationMessage" class="disc-editor-warning" role="alert">{{ discEditorValidationMessage }}</p>
      <details>
        <summary>原始 JSON 预览</summary>
        <pre class="raw">{{ JSON.stringify(discDraftStoragePreview, null, 2) }}</pre>
      </details>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showDiscEditor = false">取消</NButton>
        <NButton v-if="selectedDisc" type="error" @click="confirmDelete = true">删除</NButton>
        <NButton type="primary" :disabled="Boolean(discEditorValidationMessage)" @click="saveDisc">保存</NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showDiscReservation" preset="card" title="设置专属角色" style="width: min(520px, calc(100vw - 16px)); max-width: 520px">
    <div v-if="reservationDisc" class="section-band">
      <div class="disc-row-identity">
        <ImageAvatar :src="driveDiscSetIcon(reservationDisc)" :name="driveDiscSetName(reservationDisc)" :size="44" />
        <div class="disc-row-meta">
          <strong>{{ driveDiscSetName(reservationDisc) }} · {{ reservationDisc.partition }}号位</strong>
          <span>{{ mainStatText(reservationDisc) }}</span>
        </div>
      </div>
      <div class="metric">
        <span class="metric-title">专属角色</span>
        <div class="metric-value">
          <NSelect v-model:value="reservationAgentId" clearable filterable :options="reservationAgentOptions" placeholder="公共驱动盘" aria-label="专属角色" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showDiscReservation = false">取消</NButton>
        <NButton type="primary" :loading="reservationSaving" @click="applyDiscReservation">
          {{ reservationAgentId ? '应用专属' : '解除专属' }}
        </NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showReservationConflict" preset="card" title="专属角色冲突" style="width: min(720px, calc(100vw - 16px)); max-width: 720px">
    <div class="section-band ui-layout-scope" data-layout-surface="reservation-conflict">
      <NAlert type="warning" :show-icon="false">
        该驱动盘已专属其他角色。确认后将其转移给目标角色，未确认前不会修改任何数据。
      </NAlert>
      <div class="reservation-conflict-list">
        <div v-for="conflict in reservationConflicts" :key="conflict.discId" class="reservation-conflict-row">
          <div>
            <strong>{{ driveDiscSetName(conflictDisc(conflict)) }} · {{ conflictDisc(conflict)?.partition }}号位</strong>
            <span>{{ mainStatText(conflictDisc(conflict)) }}</span>
          </div>
          <span>{{ agentName(conflict.currentAgentId) }} → {{ agentName(conflict.requestedAgentId) }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="showReservationConflict = false">取消</NButton>
        <NButton type="primary" :loading="reservationSaving" @click="confirmReservationTransfer">
          确认转移
        </NButton>
      </div>
    </template>
  </NModal>

  <NModal v-model:show="showLoadoutEditor" preset="card" title="编辑套装预设" style="width: min(1120px, calc(100vw - 16px)); max-width: 1120px">
    <div class="section-band ui-layout-scope" data-layout-surface="loadout-editor">
      <div class="metric-grid ui-field-grid">
        <div class="metric" data-layout-field>
          <span class="metric-title">名称</span>
          <div class="metric-value"><NInput v-model:value="loadoutDraft.name" aria-label="套装预设名称" /></div>
        </div>
        <div class="metric" data-layout-field>
          <span class="metric-title">角色</span>
          <div class="metric-value"><NSelect v-model:value="loadoutDraft.agentId" :options="agentOptions" aria-label="套装预设角色" filterable /></div>
        </div>
      </div>
      <div class="loadout-editor-slot-grid">
        <DriveDiscSlotCard
          v-for="row in loadoutEditorRows"
          :key="row.slot"
          :slot="row.slot"
          :disc="row.disc"
          :drive-disc-sets="catalogStore.driveDiscSets"
          :meta="catalogStore.meta"
          :agents="catalogStore.agents"
          :target-agent-id="loadoutDraft.agentId"
          :missing-reference="row.missingReference"
          :empty-hint="'点击选择当前号位驱动盘'"
          interactive
          show-sequence
          show-reservation
          @select="openLoadoutDiscPicker"
        />
      </div>
      <div class="chip-row">
        <NTag :type="loadoutMissingSlots.length ? 'warning' : 'success'" round>
          {{ loadoutMissingSlots.length ? `缺失 ${loadoutMissingSlots.join('、')} 号位` : '六槽完整' }}
        </NTag>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <NButton @click="cancelLoadoutEditor">取消</NButton>
        <NButton v-if="loadoutDraft.id && !loadoutIsNew" type="error" @click="deleteLoadoutId = loadoutDraft.id">删除</NButton>
        <NButton type="primary" @click="saveLoadout">保存</NButton>
      </div>
    </template>
  </NModal>

  <DriveDiscPickerModal
    v-model:show="showLoadoutDiscPicker"
    :slot="activeLoadoutDiscSlot"
    :discs="inventoryStore.driveDiscs"
    :selected-id="loadoutDraft.driveDiscIdsBySlot?.[String(activeLoadoutDiscSlot)] ?? ''"
    :drive-disc-sets="catalogStore.driveDiscSets"
    :meta="catalogStore.meta"
    :agents="catalogStore.agents"
    :target-agent-id="loadoutDraft.agentId"
    surface="loadout-drive-disc-picker"
    clear-label="清空此槽位"
    show-reservation
    @select="selectLoadoutDisc"
    @clear="clearLoadoutDiscSlot"
  />

  <NModal v-model:show="showImport" preset="card" title="导入驱动盘 JSON" style="max-width: 760px">
    <div class="section-band">
      <NInput v-model:value="importText" type="textarea" placeholder="粘贴扫描器或计算器导出的 JSON" :autosize="{ minRows: 8, maxRows: 16 }" />
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
        <p v-if="scanRuntimeStatus" class="scan-runtime-status" role="status" aria-live="polite">
          {{ scanRuntimeStatus }}
        </p>

        <ScannerErrorState
          v-if="inventoryStore.scanErrorVariant"
          :variant="inventoryStore.scanErrorVariant"
          :message="scannerErrorMessage"
          :helper-version="inventoryStore.scanHelperVersion"
          :primary-label="scannerErrorPrimaryLabel"
          :secondary-label="scannerErrorSecondaryLabel"
          :failure="inventoryStore.scanFailure"
          @primary="handleScannerError"
          @secondary="handleScannerErrorSecondary"
          @action="handleScannerDiagnosticAction"
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

        <div v-else-if="inventoryStore.scanPhase === 'c'" class="section-band ui-layout-scope" data-layout-surface="scanner-config">
          <div class="metric" data-layout-field>
            <span class="metric-title">客户端</span>
            <div class="metric-value"><NSelect v-model:value="inventoryStore.scanClient" :disabled="scanControlsDisabled" :options="[{ label: '本地绝区零', value: 'local' }, { label: '云绝区零', value: 'cloud' }]" aria-label="扫描客户端" /></div>
          </div>
          <div class="metric-grid ui-field-grid">
            <div class="metric" role="group" aria-label="扫描品质" data-layout-field>
              <span class="metric-title">品质</span>
              <div class="metric-value"><NTag type="warning">S</NTag></div>
            </div>
            <div class="metric" data-layout-field>
              <span class="metric-title">上限</span>
              <div class="metric-value"><NInputNumber v-model:value="inventoryStore.scanMaxItems" :disabled="scanControlsDisabled" :min="0" :max="9999" aria-label="扫描数量上限" /></div>
            </div>
          </div>
          <div class="section-band">
            <NCheckbox v-model:checked="inventoryStore.scanStopAtNonLevel15" :disabled="scanControlsDisabled">遇到非 15 级时停止</NCheckbox>
            <NCheckbox v-model:checked="inventoryStore.scanRemoveMissing" :disabled="scanControlsDisabled">同步删除缺失</NCheckbox>
          </div>
          <div class="toolbar">
            <NButton type="primary" size="large" :disabled="!inventoryStore.scanCanStart" @click="requestStartScan">
              开始扫描
            </NButton>
          </div>
          <NAlert class="scan-telemetry-alert" type="info" title="匿名扫描诊断" :show-icon="false">
            {{ scanTelemetryEnabled ? "已开启脱敏扫描摘要，记录保留 30 天。" : "当前已关闭，不会上传扫描摘要。" }}
            <RouterLink to="/settings">前往设置</RouterLink>
          </NAlert>
          <NAlert class="scan-prerequisite-alert" type="warning" title="扫描前请确认">
            <div class="scan-prerequisite-content">
              <p>请先打开《绝区零》背包中的“驱动盘”界面，并将游戏切换为以下任一显示模式：</p>
              <ul>
                <li>1920 × 1080 全屏</li>
                <li>1600 × 900 窗口</li>
                <li>1280 × 720 窗口</li>
              </ul>
              <p>使用其他分辨率或显示模式会影响识别速度和准确率。</p>
            </div>
          </NAlert>
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
          <div v-else-if="inventoryStore.scanStatus === 'stopping'" class="toolbar">
            <NButton type="error" loading disabled>正在停止</NButton>
          </div>

          <div v-if="inventoryStore.scanSession?.preview" class="section-band">
            <div class="toolbar">
              <NTag type="success" round>新增 {{ inventoryStore.scanSession.preview.summary.added }}</NTag>
              <NTag type="info" round>更新 {{ inventoryStore.scanSession.preview.summary.updated }}</NTag>
              <NTag round>未变 {{ inventoryStore.scanSession.preview.summary.skipped }}</NTag>
              <NTag v-if="inventoryStore.scanSession.preview.summary.removed" type="error" round>删除 {{ inventoryStore.scanSession.preview.summary.removed }}</NTag>
              <NTag v-if="inventoryStore.scanSession.imported" type="success" round>
                {{ inventoryStore.scanSession.partial ? "已安全导入" : "已自动导入" }}
              </NTag>
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

.substat-editor-list {
  display: grid;
  gap: 14px;
}

.substat-editor-row {
  min-width: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--app-border);
}

.substat-editor-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.substat-editor-fields {
  --ui-field-min: 160px;
  align-items: center;
  gap: 10px;
}

.substat-roll-result {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
  color: var(--app-text);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  white-space: nowrap;
}

.disc-editor-warning {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #f3d46f;
  border-radius: var(--app-radius-sm);
  background: #fff8d8;
  color: #7c5b00;
  font-size: 13px;
  line-height: 1.5;
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

.reservation-agent {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.reservation-agent span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.loadout-agent {
  margin-top: 6px;
  color: var(--app-muted);
  font-size: 12px;
}

.loadout-visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}

.loadout-visual-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
}

.loadout-visual-card > .panel-header {
  align-items: flex-start;
}

.loadout-heading-copy {
  min-width: 0;
}

.loadout-heading-copy .panel-title {
  overflow-wrap: anywhere;
}

.loadout-visual-card > .panel-header > .chip-row {
  flex: 0 1 auto;
  justify-content: flex-end;
}

.loadout-slot-grid,
.loadout-editor-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
  gap: 10px;
}

.loadout-slot-grid {
  padding: 14px 16px;
}

.loadout-slot-grid :deep(.loadout-slot-card) {
  grid-template-columns: 44px minmax(0, 1fr);
}

.loadout-slot-grid :deep(.loadout-slot-card img) {
  width: 42px;
  height: 42px;
}

.loadout-slot-grid :deep(.loadout-slot-card .disc-slot-card-meta) {
  grid-column: 2;
  grid-auto-flow: column;
  justify-content: start;
  justify-items: start;
  max-width: 100%;
}

.loadout-card-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--app-border);
  background: var(--app-panel-muted);
}

.reservation-conflict-list {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.reservation-conflict-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, auto);
  gap: 16px;
  align-items: center;
  padding: 10px 12px;
  background: var(--app-surface);
}

.reservation-conflict-row > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.reservation-conflict-row span {
  color: var(--app-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
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

.scan-runtime-status {
  margin: -2px 0 0;
  color: var(--app-muted);
  font-size: 12px;
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

.scan-prerequisite-alert {
  margin-top: 2px;
}

.scan-prerequisite-content {
  font-size: 13px;
  line-height: 1.6;
}

.scan-prerequisite-content p {
  margin: 0;
}

.scan-prerequisite-content ul {
  margin: 6px 0;
  padding-left: 20px;
  font-weight: 600;
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

@media (max-width: 720px) {
  .reservation-conflict-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .inventory-toolbar-header {
    align-items: stretch;
    flex-direction: column;
  }

  .inventory-toolbar-header .panel-title {
    white-space: nowrap;
  }

  .inventory-toolbar-actions {
    width: 100%;
  }
}

@media (max-width: 1100px) {
  .loadout-visual-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .loadout-slot-grid,
  .loadout-editor-slot-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .loadout-visual-card > .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .loadout-visual-card > .panel-header > .chip-row {
    justify-content: flex-start;
  }

  .loadout-card-footer {
    justify-content: stretch;
  }

  .loadout-card-footer :deep(.n-button) {
    flex: 1 1 150px;
  }
}

</style>
