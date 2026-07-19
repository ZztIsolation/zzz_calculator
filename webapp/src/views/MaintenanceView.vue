<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { onBeforeRouteLeave, useRouter } from "vue-router"
import { NButton, NInput, NModal, NSelect, NTag } from "naive-ui"
import {
  Activity, CheckCircle2, CircleDot, Copy, Disc3, Flag, ListTree, Plus, RefreshCw, Save, ShieldAlert, Trash2, UserRound, UsersRound,
} from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import MaintenanceResourceEditor from "@/components/maintenance/MaintenanceResourceEditor.vue"
import {
  blankRecord,
  cloneForCreate,
  deepClone,
  displayLabelForRecord,
  displayMetaForRecord,
  fieldLabel,
  maskedPreview,
  prepareDraft,
  searchableText,
  textOf,
  type CreateOptions,
  type ResourceValue,
} from "@/components/maintenance/maintenance-model"
import { conditionLabel } from "@/components/maintenance/maintenance-options"
import { loadAppConfig } from "@/runtime/app-config"
import { imageForAgent, imageForBuff, imageForDriveDiscSet, imageForWEngine } from "@/utils/assets"
import {
  applySystemManagedMaintenanceFields,
  FIELD_BUFF_GAME_VERSIONS,
  FIELD_BUFF_MODE_OPTIONS,
  FIELD_BUFF_PHASE_OPTIONS,
  fieldBuffModeOption,
  fieldBuffPhaseName,
  validateMaintenanceItem,
} from "@core/maintenanceValidation.js"

interface OriginalIdentity {
  id: string
  teammateId: string
  maintenanceType: string
  bossId?: string
}

interface StoredDraftV3 {
  version: 3
  resource: ResourceValue
  selectedKey: string
  selectedBuffId: string
  draft: any
  baselineText: string
  draftIsNew: boolean
  originalIdentity: OriginalIdentity
}

interface PendingCatalogRefresh {
  key: string
  buffId?: string
}

type DeleteMode = "record" | "buff" | "teammate" | "encounter" | "boss"

const DRAFT_STORAGE_KEY = "zzz_maintenance_vue_draft_v3"
const PREVIOUS_DRAFT_STORAGE_KEY = "zzz_maintenance_vue_draft_v2"
const LEGACY_DRAFT_STORAGE_KEY = "zzz_maintenance_vue_draft_v1"

const resources = [
  { label: "角色", value: "agents" as const, icon: UserRound, description: "面板、Buff 与默认计算" },
  { label: "角色技能", value: "agent-skills" as const, icon: ListTree, description: "大类、招式与倍率行" },
  { label: "音擎", value: "w-engines" as const, icon: CircleDot, description: "属性、改装与被动" },
  { label: "驱动盘套装", value: "drive-disc-sets" as const, icon: Disc3, description: "2 件套与 4 件套" },
  { label: "异常 / 紊乱", value: "anomaly-effects" as const, icon: Activity, description: "结算倍率与持续时间" },
  { label: "队友 Buff", value: "teammate-buffs" as const, icon: UsersRound, description: "按角色管理多个 Buff" },
  { label: "场地 Buff", value: "field-buffs" as const, icon: Flag, description: "玩法版本与期数" },
  { label: "Boss Buff", value: "boss-buffs" as const, icon: ShieldAlert, description: "Boss 环境效果" },
]

const router = useRouter()
const loading = ref(false)
const busy = ref(false)
const error = ref("")
const validationErrors = ref<string[]>([])
const validationPaths = ref<string[]>([])
const saveState = ref("加载中")
const saveHint = ref("正在读取维护数据")
const maintenanceEnabled = ref(false)
const catalog = ref<any>(null)
const resource = ref<ResourceValue>("agents")
const query = ref("")
const selectedKey = ref("")
const selectedBuffId = ref("")
const draft = ref<any>(null)
const baselineText = ref("")
const draftIsNew = ref(false)
const originalIdentity = ref<OriginalIdentity>({ id: "", teammateId: "", maintenanceType: "" })
const pendingCatalogRefresh = ref<PendingCatalogRefresh | null>(null)
const showDeleteConfirm = ref(false)
const deleteMode = ref<DeleteMode>("record")
const showDiscardConfirm = ref(false)
const showLeaveConfirm = ref(false)
const pendingRoute = ref("")
const showCreateModal = ref(false)
const createName = ref("")
const createAgentId = ref("")
const createAnomalyType = ref<"anomaly" | "disorder">("anomaly")
const createTeammateMode = ref<"new" | "existing">("new")
const createTeammateId = ref("")
const createFieldMode = ref("defense_v5")
const createFieldVersion = ref("3.0")
const createFieldPhase = ref(1)
const createBossMode = ref<"new" | "existing">("new")
const createBossId = ref("")
let pendingDiscardAction: (() => void) | null = null
let allowRouteLeave = false

const resourceInfo = computed(() => resources.find(item => item.value === resource.value)!)
const serializedDraft = computed(() => draft.value ? JSON.stringify(draft.value) : "")
const hasUnsavedChanges = computed(() => Boolean(draft.value) && (draftIsNew.value || serializedDraft.value !== baselineText.value))
const records = computed(() => recordsFor(resource.value))
const filteredRecords = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return needle ? records.value.filter(item => searchableText(resource.value, item).includes(needle)) : records.value
})
const currentBuff = computed(() => {
  if (resource.value !== "teammate-buffs") return null
  return (draft.value?.buffs ?? []).find((buff: any) => buff.id === selectedBuffId.value) ?? draft.value?.buffs?.[0] ?? null
})
const currentEncounter = computed(() => {
  if (resource.value !== "boss-buffs") return null
  return (draft.value?.encounters ?? []).find((item: any) => item.id === selectedBuffId.value) ?? draft.value?.encounters?.[0] ?? null
})

function readablePreview(value: any, key = ""): any {
  if (key === "condition" && typeof value === "string") return conditionLabel(value)
  if (Array.isArray(value)) return value.map(item => readablePreview(item))
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, readablePreview(child, childKey)]))
}

const previewValue = computed(() => {
  if (!draft.value) return ""
  if (resource.value === "teammate-buffs") {
    const { buffs: _buffs, ...teammate } = draft.value
    return JSON.stringify(readablePreview(maskedPreview({ teammate, buff: currentBuff.value })), null, 2)
  }
  if (resource.value === "boss-buffs") {
    const { encounters: _encounters, ...boss } = draft.value
    return JSON.stringify(readablePreview(maskedPreview({ boss, encounter: currentEncounter.value })), null, 2)
  }
  return JSON.stringify(readablePreview(maskedPreview(draft.value)), null, 2)
})
const createAgentOptions = computed(() => (catalog.value?.agents?.agents ?? []).map((item: any) => ({ label: displayLabelForRecord("agents", item), value: item.id })))
const createTeammateOptions = computed(() => (catalog.value?.combatBuffs?.teammates ?? []).map((item: any) => ({ label: `${textOf(item.name)} · ${item.buffs?.length ?? 0} 个 Buff`, value: item.id })))
const createBossOptions = computed(() => (catalog.value?.bosses?.bosses ?? []).map((item: any) => ({ label: `${textOf(item.name)} · ${item.encounters?.length ?? 0} 个敌情版本`, value: item.id })))
const fieldModeOptions = FIELD_BUFF_MODE_OPTIONS.map(option => ({ label: option.selectLabel?.zhCN ?? option.source.zhCN, value: option.modeId }))
const fieldVersionOptions = FIELD_BUFF_GAME_VERSIONS.map(value => ({ label: `${value} 版本`, value }))
const fieldPhaseOptions = FIELD_BUFF_PHASE_OPTIONS.map(option => ({ label: option.phaseName.zhCN, value: option.phaseNo }))

function anomalyMaintenanceType(item: any) {
  return item?.settlementType === "disorder" || item?.maintenanceType === "disorder" ? "disorder" : "anomaly"
}

function anomalyRecords() {
  const effects = catalog.value?.anomalyEffects?.effects
  if (Array.isArray(effects)) return effects.map((item: any) => ({ ...item, maintenanceType: anomalyMaintenanceType(item) }))
  return [
    ...(catalog.value?.anomalyEffects?.anomalyEffects ?? []).map((item: any) => ({ ...item, settlementType: "attribute", maintenanceType: "anomaly" })),
    ...(catalog.value?.anomalyEffects?.disorderEffects ?? []).map((item: any) => ({ ...item, settlementType: "disorder", maintenanceType: "disorder" })),
  ]
}

function recordsFor(value: ResourceValue): any[] {
  if (!catalog.value) return []
  switch (value) {
    case "agents": return catalog.value.agents?.agents ?? []
    case "agent-skills": return catalog.value.agentSkills?.agentSkills ?? []
    case "w-engines": return catalog.value.wEngines?.wEngines ?? []
    case "drive-disc-sets": return catalog.value.driveDiscSets?.sets ?? []
    case "anomaly-effects": return anomalyRecords()
    case "teammate-buffs": return catalog.value.combatBuffs?.teammates ?? []
    case "field-buffs": return [
      ...(catalog.value.combatBuffs?.fieldBuffs ?? []),
      ...(catalog.value.combatBuffs?.buffs ?? []).filter((item: any) => item.sourceType === "field"),
    ]
    case "boss-buffs": return catalog.value.bosses?.bosses ?? []
  }
}

function recordKey(item: any, value = resource.value) {
  if (value === "anomaly-effects") return `${anomalyMaintenanceType(item)}:${item.id ?? ""}`
  if (value === "teammate-buffs") return `teammate:${item.id ?? ""}`
  return String(item.id ?? "")
}

function identityFor(item: any, buffId = ""): OriginalIdentity {
  if (resource.value === "teammate-buffs") {
    const buff = (item?.buffs ?? []).find((candidate: any) => candidate.id === buffId) ?? item?.buffs?.[0]
    return { id: String(buff?.id ?? ""), teammateId: String(item?.id ?? ""), maintenanceType: "" }
  }
  if (resource.value === "boss-buffs") {
    const encounter = (item?.encounters ?? []).find((candidate: any) => candidate.id === buffId) ?? item?.encounters?.[0]
    return { id: String(encounter?.id ?? ""), bossId: String(item?.id ?? ""), teammateId: "", maintenanceType: "" }
  }
  return { id: String(item?.id ?? ""), teammateId: "", maintenanceType: resource.value === "anomaly-effects" ? anomalyMaintenanceType(item) : "" }
}

function recordIcon(item: any) {
  if (resource.value === "agents") return imageForAgent(item)
  if (resource.value === "w-engines") return imageForWEngine(item)
  if (resource.value === "drive-disc-sets") return imageForDriveDiscSet(item)
  if (resource.value === "teammate-buffs") return imageForBuff(item)
  if (resource.value === "boss-buffs") return String(item?.images?.icon ?? "")
  return ""
}

function clearStoredDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    localStorage.removeItem(PREVIOUS_DRAFT_STORAGE_KEY)
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
  } catch {
    // Editing remains available without browser storage.
  }
}

function persistDraft() {
  if (!hasUnsavedChanges.value || !draft.value) {
    clearStoredDraft()
    return
  }
  const stored: StoredDraftV3 = {
    version: 3,
    resource: resource.value,
    selectedKey: selectedKey.value,
    selectedBuffId: selectedBuffId.value,
    draft: deepClone(draft.value),
    baselineText: baselineText.value,
    draftIsNew: draftIsNew.value,
    originalIdentity: originalIdentity.value,
  }
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Editing remains available when localStorage is unavailable.
  }
}

function legacyTeammateGroup(item: any) {
  if (Array.isArray(item?.buffs)) return item
  const { teammateId, teammateName, teammateImages, maintenanceType: _maintenanceType, ...buff } = item ?? {}
  return { id: teammateId, name: teammateName ?? { zhCN: "未命名队友" }, images: teammateImages ?? {}, buffs: [buff] }
}

function restoreStoredDraft() {
  try {
    const current = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "null") as StoredDraftV3 | null
    if (current?.version === 3 && resources.some(item => item.value === current.resource) && current.draft) {
      resource.value = current.resource
      selectedKey.value = current.selectedKey
      selectedBuffId.value = current.selectedBuffId
      draft.value = prepareDraft(current.resource, current.draft)
      baselineText.value = current.baselineText ?? ""
      draftIsNew.value = current.draftIsNew
      originalIdentity.value = current.originalIdentity ?? { id: "", teammateId: "", maintenanceType: "" }
      saveState.value = "已恢复草稿"
      saveHint.value = "上次未保存的结构化修改已从本机恢复"
      return true
    }
    const previous = JSON.parse(localStorage.getItem(PREVIOUS_DRAFT_STORAGE_KEY) || "null")
    if (previous?.version === 2 && resources.some(item => item.value === previous.resource) && previous.draft) {
      resource.value = previous.resource
      selectedKey.value = previous.selectedKey
      selectedBuffId.value = previous.selectedBuffId
      draft.value = prepareDraft(previous.resource, previous.draft)
      baselineText.value = previous.baselineText ?? ""
      draftIsNew.value = previous.draftIsNew === true
      originalIdentity.value = previous.originalIdentity ?? { id: "", teammateId: "", maintenanceType: "" }
      persistDraft()
      localStorage.removeItem(PREVIOUS_DRAFT_STORAGE_KEY)
      saveState.value = "已迁移旧草稿"
      saveHint.value = "旧版技能目标已转为明确的角色招式或技能大类"
      return true
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY) || "null")
    if (legacy?.resource && typeof legacy.draftText === "string") {
      const legacyResource = legacy.resource as ResourceValue
      const parsed = JSON.parse(legacy.draftText)
      const normalized = legacyResource === "teammate-buffs" ? legacyTeammateGroup(parsed) : parsed
      resource.value = legacyResource
      selectedKey.value = legacy.selectedKey || `draft:${Date.now()}`
      draft.value = prepareDraft(legacyResource, normalized)
      selectedBuffId.value = draft.value?.buffs?.[0]?.id ?? ""
      baselineText.value = legacy.baselineText || ""
      draftIsNew.value = legacy.draftIsNew === true
      originalIdentity.value = legacy.originalIdentity ?? identityFor(draft.value, selectedBuffId.value)
      persistDraft()
      localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
      saveState.value = "已迁移旧草稿"
      saveHint.value = "旧版 JSON 草稿已转为结构化表单"
      return true
    }
  } catch {
    clearStoredDraft()
  }
  return false
}

function setEditor(item: any, options: { isNew?: boolean, key?: string, buffId?: string, identity?: OriginalIdentity, state?: string, hint?: string } = {}) {
  pendingCatalogRefresh.value = null
  const prepared = prepareDraft(resource.value, item)
  draft.value = prepared
  selectedBuffId.value = options.buffId ?? prepared?.buffs?.[0]?.id ?? prepared?.encounters?.[0]?.id ?? ""
  selectedKey.value = options.key ?? recordKey(prepared)
  baselineText.value = options.isNew ? "" : JSON.stringify(prepared)
  draftIsNew.value = options.isNew === true
  originalIdentity.value = options.identity ?? (options.isNew ? { id: "", teammateId: "", maintenanceType: "" } : identityFor(prepared, selectedBuffId.value))
  validationErrors.value = []
  validationPaths.value = []
  saveState.value = options.state ?? (options.isNew ? "未保存" : "已加载")
  saveHint.value = options.hint ?? (options.isNew ? "完成必填项后保存" : "所有修改会先在本机保留")
  if (options.isNew) persistDraft()
  else clearStoredDraft()
}

function selectFirstRecord() {
  const first = records.value[0]
  if (first) setEditor(first)
  else {
    draft.value = null
    selectedKey.value = ""
    selectedBuffId.value = ""
    baselineText.value = ""
    draftIsNew.value = false
    originalIdentity.value = { id: "", teammateId: "", maintenanceType: "" }
  }
}

async function fetchCatalog() {
  const response = await fetch("/api/maintenance/catalog", { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false || !payload.data) throw new Error(payload.error ?? `维护 API 不可用：${response.status}`)
  catalog.value = payload.data
}

async function load() {
  loading.value = true
  error.value = ""
  try {
    const config = await loadAppConfig()
    maintenanceEnabled.value = config.maintenanceEnabled
    if (!maintenanceEnabled.value) {
      saveState.value = "只读"
      saveHint.value = "当前环境未开启维护写入"
      return
    }
    await fetchCatalog()
    if (!restoreStoredDraft()) selectFirstRecord()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    saveState.value = "加载失败"
    saveHint.value = error.value
  } finally {
    loading.value = false
  }
}

function markDraftChanged() {
  pendingCatalogRefresh.value = null
  validationErrors.value = []
  validationPaths.value = []
  saveState.value = "有未保存修改"
  saveHint.value = "修改已自动保存在本机草稿中"
  persistDraft()
}

function requestDiscard(action: () => void) {
  if (!hasUnsavedChanges.value) return action()
  pendingDiscardAction = action
  showDiscardConfirm.value = true
}

function confirmDiscard() {
  const action = pendingDiscardAction
  pendingDiscardAction = null
  showDiscardConfirm.value = false
  clearStoredDraft()
  action?.()
}

function changeResource(value: ResourceValue) {
  if (busy.value || value === resource.value) return
  requestDiscard(() => {
    resource.value = value
    query.value = ""
    selectFirstRecord()
  })
}

function selectRecord(item: any) {
  if (busy.value || recordKey(item) === selectedKey.value) return
  requestDiscard(() => setEditor(item))
}

function selectBuff(buff: any) {
  if (!buff?.id || buff.id === selectedBuffId.value) return
  const switchSelection = () => {
    if (hasUnsavedChanges.value) {
      const source = records.value.find(item => recordKey(item) === selectedKey.value)
      if (source) return setEditor(source, { buffId: buff.id })
    }
    selectedBuffId.value = buff.id
    originalIdentity.value = identityFor(draft.value, buff.id)
    saveState.value = resource.value === "boss-buffs" ? "已切换敌情版本" : "已切换 Buff"
    saveHint.value = resource.value === "boss-buffs" ? "一次只编辑并保存当前规则版本" : "一次只编辑并保存当前 Buff"
  }
  requestDiscard(switchSelection)
}

function openCreate() {
  createName.value = ""
  createAgentId.value = catalog.value?.agents?.agents?.[0]?.id ?? ""
  createAnomalyType.value = "anomaly"
  createTeammateMode.value = "new"
  createTeammateId.value = catalog.value?.combatBuffs?.teammates?.[0]?.id ?? ""
  createFieldMode.value = "defense_v5"
  createFieldVersion.value = "3.0"
  createFieldPhase.value = 1
  createBossMode.value = "new"
  createBossId.value = catalog.value?.bosses?.bosses?.[0]?.id ?? ""
  showCreateModal.value = true
}

function confirmCreate() {
  const options: CreateOptions = {
    name: createName.value,
    agentId: createAgentId.value,
    anomalyType: createAnomalyType.value,
    teammateMode: createTeammateMode.value,
    teammateId: createTeammateId.value,
    modeId: createFieldMode.value,
    gameVersion: createFieldVersion.value,
    phaseNo: createFieldPhase.value,
    bossMode: createBossMode.value,
    bossId: createBossId.value,
  }
  const item = blankRecord(resource.value, catalog.value, options)
  const newBuffId = resource.value === "teammate-buffs"
    ? item.buffs?.at(-1)?.id ?? ""
    : resource.value === "boss-buffs"
      ? item.encounters?.at(-1)?.id ?? ""
      : ""
  const identity = resource.value === "teammate-buffs" && createTeammateMode.value === "existing"
    ? { id: "", teammateId: item.id, maintenanceType: "" }
    : resource.value === "boss-buffs" && createBossMode.value === "existing"
      ? { id: "", bossId: item.id, teammateId: "", maintenanceType: "" }
    : { id: "", teammateId: "", maintenanceType: "" }
  showCreateModal.value = false
  setEditor(item, { isNew: true, key: recordKey(item) || `draft:${Date.now()}`, buffId: newBuffId, identity })
}

function cloneRecord() {
  if (!draft.value) return
  if (resource.value === "teammate-buffs") {
    const copy = cloneForCreate(resource.value, currentBuff.value)
    draft.value.buffs.push(copy)
    selectedBuffId.value = copy.id
    draftIsNew.value = true
    originalIdentity.value = { id: "", teammateId: draft.value.id, maintenanceType: "" }
    saveState.value = "已复制 Buff"
    saveHint.value = "复制项已生成新的内部标识，确认内容后保存"
    markDraftChanged()
    return
  }
  if (resource.value === "boss-buffs") {
    if (!currentEncounter.value) return
    const copy = cloneForCreate(resource.value, currentEncounter.value)
    draft.value.encounters.push(copy)
    selectedBuffId.value = copy.id
    draftIsNew.value = true
    originalIdentity.value = { id: "", bossId: draft.value.id, teammateId: "", maintenanceType: "" }
    saveState.value = "已复制敌情版本"
    saveHint.value = "复制项已重建所有内部标识，确认来源期数后保存"
    markDraftChanged()
    return
  }
  const copy = cloneForCreate(resource.value, draft.value)
  setEditor(copy, { isNew: true, key: `draft:${Date.now()}`, state: "已复制", hint: "复制项已生成新的内部标识，确认内容后保存" })
}

function addTeammateBuff() {
  if (!draft.value) return
  if (resource.value === "boss-buffs") {
    requestDiscard(() => {
      const group = blankRecord("boss-buffs", catalog.value, { bossMode: "existing", bossId: draft.value.id })
      const encounter = group.encounters.at(-1)
      draft.value = prepareDraft(resource.value, deepClone(draft.value))
      draft.value.encounters.push(encounter)
      selectedBuffId.value = encounter.id
      draftIsNew.value = true
      originalIdentity.value = { id: "", bossId: draft.value.id, teammateId: "", maintenanceType: "" }
      markDraftChanged()
    })
    return
  }
  requestDiscard(() => {
    const group = blankRecord("teammate-buffs", catalog.value, { teammateMode: "existing", teammateId: draft.value.id })
    const buff = group.buffs.at(-1)
    draft.value = prepareDraft(resource.value, deepClone(draft.value))
    draft.value.buffs.push(buff)
    selectedBuffId.value = buff.id
    draftIsNew.value = true
    originalIdentity.value = { id: "", teammateId: draft.value.id, maintenanceType: "" }
    markDraftChanged()
  })
}

function stripEditorMetadata(value: any): any {
  if (Array.isArray(value)) return value.map(stripEditorMetadata)
  if (!value || typeof value !== "object") return value
  for (const key of Object.keys(value)) {
    if (key.startsWith("__")) delete value[key]
    else value[key] = stripEditorMetadata(value[key])
  }
  return value
}

function normalizeCalculationConfig(config: any) {
  if (!config) return
  const normalizeEntry = (entry: any) => {
    if (!(entry.events ?? []).some((event: any) => event.id === entry.selectedEventId)) entry.selectedEventId = entry.events?.[0]?.id ?? null
  }
  normalizeEntry(config)
  for (const variant of config.variants ?? []) normalizeEntry(variant)
}

function normalizeForSave(item: any) {
  const next = deepClone(item)
  stripEditorMetadata(next)
  applySystemManagedMaintenanceFields(next)
  if (resource.value === "agents") {
    normalizeCalculationConfig(next.defaultCalculationConfig)
    if (!next.damageElement) delete next.damageElement
  }
  if (resource.value === "w-engines") {
    if (!next.attribute) delete next.attribute
    if (!next.relatedAgentId) delete next.relatedAgentId
    if (!next.effect?.requirement?.specialty) next.effect.requirement = null
  }
  if (resource.value === "field-buffs") {
    const phaseName = fieldBuffPhaseName(Number(next.period?.phaseNo))
    if (phaseName) next.period.phaseName = phaseName
    const mode = fieldBuffModeOption(next.period?.modeId)
    if (mode?.source) next.source = deepClone(mode.source)
    if (next.period?.gameVersion && phaseName?.zhCN) next.sourcePeriod = { zhCN: `${next.period.gameVersion}版本${phaseName.zhCN}` }
  }
  return next
}

function teammateRequest(group: any) {
  const { buffs: _buffs, ...teammate } = group
  return { teammate, buff: deepClone(currentBuff.value) }
}

function bossRequest(group: any) {
  const { encounters: _encounters, ...boss } = group
  const encounter = (group.encounters ?? []).find((item: any) => item.id === selectedBuffId.value) ?? group.encounters?.[0]
  return { boss, encounter: deepClone(encounter) }
}

function validationContext(item: any) {
  const skillContext = { agentSkills: catalog.value?.agentSkills?.agentSkills ?? [] }
  if (resource.value === "agents") return {
    items: catalog.value?.agents?.agents ?? [], currentId: originalIdentity.value.id,
    ...skillContext,
    anomalyEffects: anomalyRecords().filter(item => anomalyMaintenanceType(item) === "anomaly"),
    disorderEffects: anomalyRecords().filter(item => anomalyMaintenanceType(item) === "disorder"),
    driveDiscSets: catalog.value?.driveDiscSets?.sets ?? [],
  }
  if (resource.value === "teammate-buffs") return { ...skillContext, teammates: catalog.value?.combatBuffs?.teammates ?? [], currentBuffId: originalIdentity.value.id || undefined }
  if (resource.value === "boss-buffs") return {
    ...skillContext,
    bosses: catalog.value?.bosses?.bosses ?? [],
    currentBossId: originalIdentity.value.bossId || item.id,
    currentEncounterId: originalIdentity.value.id || currentEncounter.value?.id,
  }
  if (resource.value === "anomaly-effects") return { ...skillContext, items: anomalyRecords().filter(candidate => anomalyMaintenanceType(candidate) === anomalyMaintenanceType(item)), currentId: originalIdentity.value.id }
  return { ...skillContext, items: records.value, currentId: originalIdentity.value.id }
}

function materializeValidationIds(value: any) {
  const item = deepClone(value)
  if (resource.value === "teammate-buffs") {
    item.teammate.id ||= "validation_teammate"
    item.buff.id ||= "validation_buff"
  } else if (resource.value === "boss-buffs") {
    item.boss.id ||= "validation_boss"
    item.encounter.id ||= "validation_boss_encounter"
    for (const group of [item.encounter.playerBuffs ?? [], item.encounter.playerDebuffs ?? []]) {
      group.forEach((entry: any, index: number) => {
        entry.id ||= `validation_boss_effect_${index}`
        entry.effects?.forEach((effect: any, effectIndex: number) => { effect.id ||= `validation_boss_rule_${index}_${effectIndex}` })
      })
    }
  } else if (resource.value !== "field-buffs") item.id ||= `validation_${resource.value.replace(/[^a-z0-9]+/g, "_")}`
  return item
}

function friendlyValidationMessage(message: string) {
  const separator = message.indexOf(":")
  if (separator < 0) return message
  const path = message.slice(0, separator)
  if (/(^|\.)id$/.test(path)) return "系统标识生成失败，请刷新后重试。"
  const readable = path.split(".").map(part => {
    const match = part.match(/^([^[]+)(.*)$/)
    return `${fieldLabel(match?.[1] ?? part)}${match?.[2]?.replace(/\[(\d+)\]/g, (_, value) => `第 ${Number(value) + 1} 项`) ?? ""}`
  }).join(" / ")
  return `${readable}：${message.slice(separator + 1).trim()}`
}

function validationPath(message: string) {
  const separator = message.indexOf(":")
  return separator < 0 ? "" : message.slice(0, separator)
}

function focusValidationField(index: number) {
  const path = validationPaths.value[index]
  if (!path) return
  const segments = path.split(".")
  const keys = segments.map(segment => segment.replace(/\[\d+\].*$/, "")).filter(Boolean)
  const leaf = keys.at(-1) ?? ""
  const indices = [...path.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]))
  let keyedTarget: HTMLElement | undefined
  let focusKey = leaf
  for (const key of [...keys].reverse()) {
    const escapedKey = globalThis.CSS?.escape?.(key) ?? key.replace(/["\\]/g, "\\$&")
    const keyed = [...document.querySelectorAll<HTMLElement>(`[data-field-key="${escapedKey}"]`)]
    if (!keyed.length) continue
    keyedTarget = keyed[Math.min(indices.at(-1) ?? 0, keyed.length - 1)]
    focusKey = key
    break
  }
  const readable = fieldLabel(focusKey)
  const labelTarget = [...document.querySelectorAll<HTMLElement>(".maintenance-field")].find(item => item.querySelector(":scope > span")?.textContent?.trim().includes(readable))
  const target = keyedTarget ?? labelTarget
  target?.scrollIntoView?.({ behavior: "smooth", block: "center" })
  window.setTimeout(() => target?.querySelector<HTMLElement>("input, textarea, button, [tabindex]")?.focus(), 250)
}

function validateDraft() {
  if (!draft.value || (resource.value === "teammate-buffs" && !currentBuff.value) || (resource.value === "boss-buffs" && !currentEncounter.value)) {
    validationErrors.value = ["请先选择或创建要维护的内容。"]
    validationPaths.value = [""]
    return false
  }
  const normalized = normalizeForSave(draft.value)
  const input = resource.value === "teammate-buffs" ? teammateRequest(normalized) : resource.value === "boss-buffs" ? bossRequest(normalized) : normalized
  const validationInput = materializeValidationIds(input)
  const result = validateMaintenanceItem(resource.value, validationInput, validationContext(normalized))
  validationErrors.value = result.ok ? [] : result.errors.map(friendlyValidationMessage)
  validationPaths.value = result.ok ? [] : result.errors.map(validationPath)
  if (result.ok) {
    saveState.value = "校验通过"
    saveHint.value = "表单格式和业务规则均通过校验"
  } else {
    saveState.value = "需要修正"
    saveHint.value = `发现 ${result.errors.length} 个问题`
  }
  return result.ok
}

function requestBody(item: any) {
  if (resource.value === "teammate-buffs") return teammateRequest(item)
  if (resource.value === "boss-buffs") return bossRequest(item)
  if (resource.value === "field-buffs" && originalIdentity.value.id) return { ...item, _maintenanceOriginalId: originalIdentity.value.id }
  return item
}

function applySavedItem(savedItem: any, responsePayload: any = {}) {
  if (resource.value === "teammate-buffs") {
    draft.value.id = savedItem.teammateId
    const index = draft.value.buffs.findIndex((buff: any) => buff.id === selectedBuffId.value)
    const { teammateId: _teammateId, teammateName: _teammateName, maintenanceType: _maintenanceType, ...buff } = savedItem
    if (index >= 0) draft.value.buffs[index] = prepareDraft(resource.value, buff)
    selectedBuffId.value = savedItem.id
    originalIdentity.value = { id: savedItem.id, teammateId: savedItem.teammateId, maintenanceType: "" }
    selectedKey.value = `teammate:${savedItem.teammateId}`
  } else if (resource.value === "boss-buffs") {
    draft.value = prepareDraft(resource.value, responsePayload.savedBoss ?? draft.value)
    selectedBuffId.value = responsePayload.savedEncounter?.id ?? savedItem.id
    originalIdentity.value = { id: selectedBuffId.value, bossId: draft.value.id, teammateId: "", maintenanceType: "" }
    selectedKey.value = recordKey(draft.value)
  } else {
    draft.value = prepareDraft(resource.value, savedItem)
    originalIdentity.value = identityFor(draft.value)
    selectedKey.value = recordKey(draft.value)
  }
  draftIsNew.value = false
  baselineText.value = JSON.stringify(draft.value)
  clearStoredDraft()
}

async function refreshCatalogAndSelect(pending: PendingCatalogRefresh) {
  await fetchCatalog()
  const item = records.value.find(candidate => recordKey(candidate) === pending.key)
  if (item) setEditor(item, { buffId: pending.buffId, state: "已保存", hint: "完整目录已刷新" })
  else selectFirstRecord()
  pendingCatalogRefresh.value = null
}

async function saveDraft() {
  if (busy.value || !maintenanceEnabled.value || !draft.value) return
  if (pendingCatalogRefresh.value) {
    busy.value = true
    try {
      await refreshCatalogAndSelect(pendingCatalogRefresh.value)
    } catch (err) {
      saveState.value = "刷新失败"
      saveHint.value = err instanceof Error ? err.message : String(err)
    } finally {
      busy.value = false
    }
    return
  }
  if (!validateDraft()) return
  busy.value = true
  saveState.value = "保存中"
  saveHint.value = "正在写入数据文件"
  try {
    const normalized = normalizeForSave(draft.value)
    const response = await fetch(`/api/maintenance/${resource.value}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(normalized)),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false || !payload.savedItem) throw new Error(payload.error ?? `保存失败：${response.status}`)
    applySavedItem(payload.savedItem, payload)
    const pending = { key: selectedKey.value, ...(["teammate-buffs", "boss-buffs"].includes(resource.value) ? { buffId: selectedBuffId.value } : {}) }
    pendingCatalogRefresh.value = pending
    saveState.value = "已保存"
    saveHint.value = "正在刷新完整目录"
    try {
      await refreshCatalogAndSelect(pending)
    } catch (refreshError) {
      pendingCatalogRefresh.value = pending
      saveState.value = "已保存，刷新失败"
      saveHint.value = `${refreshError instanceof Error ? refreshError.message : String(refreshError)}；点击刷新不会重复保存`
    }
  } catch (err) {
    validationErrors.value = [err instanceof Error ? err.message : String(err)]
    validationPaths.value = [""]
    saveState.value = "保存失败"
    saveHint.value = validationErrors.value[0]
  } finally {
    busy.value = false
  }
}

function requestDelete(mode: DeleteMode = resource.value === "teammate-buffs" ? "buff" : resource.value === "boss-buffs" ? "encounter" : "record") {
  deleteMode.value = mode
  showDeleteConfirm.value = true
}

async function deleteDraft() {
  if (busy.value || !draft.value) return
  showDeleteConfirm.value = false
  if (draftIsNew.value && !originalIdentity.value.id && deleteMode.value !== "teammate") {
    clearStoredDraft()
    const source = records.value.find(item => recordKey(item) === selectedKey.value)
    if (source) setEditor(source)
    else selectFirstRecord()
    return
  }
  busy.value = true
  saveState.value = "删除中"
  try {
    let pathname = ""
    if (resource.value === "teammate-buffs") {
      const teammateId = originalIdentity.value.teammateId || draft.value.id
      if (deleteMode.value === "teammate") pathname = `/api/maintenance/teammate-buffs/${encodeURIComponent(teammateId)}`
      else pathname = `/api/maintenance/teammate-buffs/${encodeURIComponent(teammateId)}/${encodeURIComponent(originalIdentity.value.id || (currentBuff.value?.id ?? ""))}`
    } else if (resource.value === "boss-buffs") {
      const bossId = originalIdentity.value.bossId || draft.value.id
      pathname = deleteMode.value === "boss"
        ? `/api/maintenance/boss-buffs/${encodeURIComponent(bossId)}`
        : `/api/maintenance/boss-buffs/${encodeURIComponent(bossId)}/${encodeURIComponent(originalIdentity.value.id || (currentEncounter.value?.id ?? ""))}`
    } else if (resource.value === "anomaly-effects") {
      pathname = `/api/maintenance/anomaly-effects/${encodeURIComponent(originalIdentity.value.maintenanceType || anomalyMaintenanceType(draft.value))}/${encodeURIComponent(originalIdentity.value.id)}`
    } else {
      pathname = `/api/maintenance/${resource.value}/${encodeURIComponent(originalIdentity.value.id)}`
    }
    const response = await fetch(pathname, { method: "DELETE" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `删除失败：${response.status}`)
    clearStoredDraft()
    await fetchCatalog()
    selectFirstRecord()
    saveState.value = "已删除"
    saveHint.value = deleteMode.value === "teammate"
      ? "队友角色及其全部 Buff 已删除"
      : deleteMode.value === "boss"
        ? "Boss 档案及其全部敌情版本已删除"
        : "完整目录已刷新"
  } catch (err) {
    validationErrors.value = [err instanceof Error ? err.message : String(err)]
    validationPaths.value = [""]
    saveState.value = "删除失败"
    saveHint.value = validationErrors.value[0]
  } finally {
    busy.value = false
  }
}

function deleteMessage() {
  if (!draft.value) return "当前没有可删除的资料。"
  if (deleteMode.value === "teammate") return `将删除“${textOf(draft.value?.name)}”及其全部 ${draft.value?.buffs?.length ?? 0} 个 Buff。此操作不能在页面内撤销。`
  if (deleteMode.value === "boss") return `将删除“${textOf(draft.value?.name)}”及其全部 ${draft.value?.encounters?.length ?? 0} 个敌情版本。此操作不能在页面内撤销。`
  if (deleteMode.value === "encounter") return `将删除当前敌情版本“${textOf(currentEncounter.value?.enemyIntel)}”。Boss 基础档案会保留。`
  if (deleteMode.value === "buff") return `将删除当前 Buff“${textOf(currentBuff.value?.source)}”。此操作不能在页面内撤销。`
  return `将删除“${displayLabelForRecord(resource.value, draft.value)}”。此操作不能在页面内撤销。`
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ""
}

function confirmRouteLeave() {
  allowRouteLeave = true
  showLeaveConfirm.value = false
  if (pendingRoute.value) void router.push(pendingRoute.value)
}

onBeforeRouteLeave(to => {
  if (allowRouteLeave || !hasUnsavedChanges.value) return true
  pendingRoute.value = to.fullPath
  showLeaveConfirm.value = true
  return false
})

onMounted(() => {
  window.addEventListener("beforeunload", warnBeforeUnload)
  void load()
})

onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload))
</script>

<template>
  <section class="section-band maintenance-page ui-layout-scope" data-layout-surface="maintenance-page">
    <header class="maintenance-header">
      <div>
        <div class="maintenance-eyebrow">DATA MAINTENANCE</div>
        <h1>资料维护</h1>
        <p>通过结构化表单维护计算器数据，内部标识由系统自动管理。</p>
      </div>
      <div class="toolbar">
        <NTag :type="maintenanceEnabled ? 'success' : 'warning'" round>{{ maintenanceEnabled ? '维护写入已开启' : '只读模式' }}</NTag>
        <NButton :disabled="busy || !maintenanceEnabled || !draft || Boolean(pendingCatalogRefresh)" @click="cloneRecord"><template #icon><Copy :size="16" /></template>复制当前</NButton>
        <NButton :disabled="busy || !maintenanceEnabled || Boolean(pendingCatalogRefresh)" @click="openCreate"><template #icon><Plus :size="16" /></template>新增</NButton>
        <NButton :disabled="!draft" @click="validateDraft"><template #icon><CheckCircle2 :size="16" /></template>校验</NButton>
        <NButton type="primary" :disabled="busy || !maintenanceEnabled || !draft" @click="saveDraft">
          <template #icon><RefreshCw v-if="pendingCatalogRefresh" :size="16" /><Save v-else :size="16" /></template>
          {{ pendingCatalogRefresh ? '刷新' : '保存' }}
        </NButton>
      </div>
    </header>

    <nav class="maintenance-tabs" aria-label="维护资源">
      <button v-for="item in resources" :key="item.value" type="button" :class="{ active: item.value === resource }" :disabled="busy" @click="changeResource(item.value)">
        <component :is="item.icon" :size="16" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="maintenance-workspace panel">
      <aside class="record-browser">
        <div class="record-browser-head">
          <div><strong>{{ resourceInfo.label }}</strong><span>{{ records.length }} 条资料</span></div>
          <NInput v-model:value="query" clearable placeholder="按名称、来源或属性搜索" aria-label="搜索维护条目" :disabled="busy" />
        </div>
        <NTag v-if="error" type="error">{{ error }}</NTag>
        <div v-else class="record-list">
          <button v-for="item in filteredRecords" :key="recordKey(item)" type="button" class="record-option" :class="{ active: recordKey(item) === selectedKey }" :disabled="busy" @click="selectRecord(item)">
            <ImageAvatar v-if="recordIcon(item)" :src="recordIcon(item)" :name="displayLabelForRecord(resource, item)" :size="38" />
            <span><strong :title="displayLabelForRecord(resource, item)">{{ displayLabelForRecord(resource, item) }}</strong><small :title="displayMetaForRecord(resource, item)">{{ displayMetaForRecord(resource, item) }}</small></span>
          </button>
          <div v-if="!filteredRecords.length" class="record-empty">没有匹配的资料</div>
        </div>
      </aside>

      <main class="maintenance-editor ui-layout-scope" data-layout-surface="maintenance-editor">
        <header v-if="draft" class="maintenance-editor-head">
          <div><h2>{{ displayLabelForRecord(resource, draft) }}</h2><p>{{ resourceInfo.description }}</p></div>
          <NTag round>{{ resourceInfo.label }}</NTag>
        </header>
        <div class="maintenance-save-strip">
          <div><strong>{{ saveState }}</strong><span>{{ saveHint }}</span></div>
          <div class="toolbar">
            <NButton v-if="resource === 'teammate-buffs'" type="error" secondary :disabled="busy || !maintenanceEnabled || !draft" @click="requestDelete('teammate')">删除角色</NButton>
            <NButton v-if="resource === 'boss-buffs'" type="error" secondary :disabled="busy || !maintenanceEnabled || !draft" @click="requestDelete('boss')">删除整个 Boss</NButton>
            <NButton type="error" :disabled="busy || !maintenanceEnabled || !draft || Boolean(pendingCatalogRefresh)" @click="requestDelete()"><template #icon><Trash2 :size="16" /></template>{{ resource === 'teammate-buffs' ? '删除当前 Buff' : resource === 'boss-buffs' ? '删除当前版本' : '删除' }}</NButton>
            <NButton type="primary" :disabled="busy || !maintenanceEnabled || !draft" @click="saveDraft">{{ pendingCatalogRefresh ? '刷新' : '保存' }}</NButton>
          </div>
        </div>

        <div v-if="validationErrors.length" class="validation-summary" role="alert">
          <strong>请修正以下内容</strong>
          <ul><li v-for="(message, index) in validationErrors" :key="message"><button type="button" @click="focusValidationField(index)">{{ message }}</button></li></ul>
        </div>

        <div v-if="loading" class="empty-state">正在加载维护资料…</div>
        <div v-else-if="!draft" class="empty-state">选择或新建一条资料开始编辑</div>
        <MaintenanceResourceEditor
          v-else
          :key="`${resource}:${selectedKey}:${selectedBuffId}`"
          :resource="resource"
          :model="draft"
          :catalog="catalog"
          :selected-buff-id="selectedBuffId"
          :disabled="busy || !maintenanceEnabled"
          @change="markDraftChanged"
          @select-buff="selectBuff"
          @add-buff="addTeammateBuff"
        />

        <details v-if="draft" class="save-preview">
          <summary>只读保存预览（已隐藏内部标识）</summary>
          <pre>{{ previewValue }}</pre>
        </details>
      </main>
    </div>
  </section>

  <NModal v-model:show="showCreateModal" preset="card" title="新增维护资料" class="create-modal" :style="{ width: 'min(520px, calc(100vw - 28px))' }">
    <div class="create-form ui-layout-scope" data-layout-surface="maintenance-create-form">
      <div class="create-intro"><component :is="resourceInfo.icon" :size="20" /><span><strong>{{ resourceInfo.label }}</strong><small>{{ resourceInfo.description }}</small></span></div>
      <label v-if="(resource !== 'teammate-buffs' || createTeammateMode === 'new') && (resource !== 'boss-buffs' || createBossMode === 'new')" data-layout-field><span>{{ resource === 'teammate-buffs' ? '队友名称' : resource === 'boss-buffs' ? 'Boss 名称' : '初始名称' }}</span><NInput v-model:value="createName" :placeholder="resource === 'agent-skills' ? '技能资料名称' : '可稍后继续修改'" /></label>
      <label v-if="resource === 'agent-skills'" data-layout-field><span>所属角色</span><NSelect v-model:value="createAgentId" filterable :options="createAgentOptions" /></label>
      <label v-if="resource === 'anomaly-effects'" data-layout-field><span>结算类型</span><NSelect v-model:value="createAnomalyType" :options="[{ label: '属性异常', value: 'anomaly' }, { label: '紊乱', value: 'disorder' }]" /></label>
      <template v-if="resource === 'teammate-buffs'">
        <label data-layout-field><span>新增方式</span><NSelect v-model:value="createTeammateMode" :options="[{ label: '新增队友角色', value: 'new' }, { label: '给现有角色添加 Buff', value: 'existing' }]" /></label>
        <label v-if="createTeammateMode === 'existing'" data-layout-field><span>选择队友</span><NSelect v-model:value="createTeammateId" filterable :options="createTeammateOptions" /></label>
      </template>
      <template v-if="resource === 'boss-buffs'">
        <label data-layout-field><span>新增方式</span><NSelect v-model:value="createBossMode" :options="[{ label: '新增 Boss', value: 'new' }, { label: '给现有 Boss 添加规则版本', value: 'existing' }]" /></label>
        <label v-if="createBossMode === 'existing'" data-layout-field><span>选择 Boss</span><NSelect v-model:value="createBossId" filterable :options="createBossOptions" /></label>
      </template>
      <template v-if="resource === 'field-buffs'">
        <label data-layout-field><span>玩法模式</span><NSelect v-model:value="createFieldMode" :options="fieldModeOptions" /></label>
        <label data-layout-field><span>游戏版本</span><NSelect v-model:value="createFieldVersion" :options="fieldVersionOptions" /></label>
        <label data-layout-field><span>期数</span><NSelect v-model:value="createFieldPhase" :options="fieldPhaseOptions" /></label>
      </template>
    </div>
    <template #footer><div class="modal-actions"><NButton @click="showCreateModal = false">取消</NButton><NButton type="primary" @click="confirmCreate">创建草稿</NButton></div></template>
  </NModal>

  <ConfirmDialog v-model:show="showDeleteConfirm" title="删除维护资料" :message="deleteMessage()" confirm-text="删除" danger @confirm="deleteDraft" />
  <ConfirmDialog v-model:show="showDiscardConfirm" title="放弃未保存修改" message="当前修改已保存在本机草稿中。继续切换会删除这份草稿。" confirm-text="放弃并继续" danger @confirm="confirmDiscard" />
  <ConfirmDialog v-model:show="showLeaveConfirm" title="离开维护页" message="当前内容尚未保存到数据文件。本地草稿会保留，下次进入维护页时可恢复。" confirm-text="离开" danger @confirm="confirmRouteLeave" />
</template>

<style>
.maintenance-page { gap: 12px; }
.maintenance-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.maintenance-header h1 { margin: 2px 0 4px; font-size: 24px; }
.maintenance-header p { margin: 0; color: var(--app-muted); }
.maintenance-eyebrow { color: var(--app-blue); font-size: 11px; font-weight: 800; }
.maintenance-tabs { position: sticky; top: 68px; z-index: 7; display: flex; min-width: 0; overflow-x: auto; border-bottom: 1px solid var(--app-border); background: #fff; }
.maintenance-tabs button { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; min-height: 42px; padding: 0 15px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--app-muted); cursor: pointer; }
.maintenance-tabs button:hover { color: var(--app-text); background: var(--app-panel-muted); }
.maintenance-tabs button.active { border-bottom-color: var(--app-blue); color: var(--app-text); font-weight: 700; }
.maintenance-workspace { display: grid; grid-template-columns: 284px minmax(0, 1fr); height: calc(100vh - 212px); min-height: 560px; overflow: hidden; }
.record-browser { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border-right: 1px solid var(--app-border); background: #fff; }
.record-browser-head { display: grid; gap: 10px; padding: 14px; border-bottom: 1px solid var(--app-border); }
.record-browser-head > div { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.record-browser-head span { color: var(--app-muted); font-size: 12px; }
.record-list { display: grid; min-height: 0; flex: 1; align-content: start; padding: 8px; overflow: auto; }
.record-option { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 9px; width: 100%; min-height: 54px; padding: 8px; border: 1px solid transparent; border-radius: var(--app-radius-sm); background: transparent; color: var(--app-text); text-align: left; cursor: pointer; }
.record-option:hover { background: var(--app-panel-muted); }
.record-option.active { border-color: var(--app-blue); background: #f5f9ff; }
.record-option:not(:has(.avatar)) { grid-template-columns: minmax(0, 1fr); }
.record-option > span, .create-intro span { display: grid; min-width: 0; gap: 2px; }
.record-option strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-option small, .create-intro small { overflow: hidden; color: var(--app-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.record-empty, .maintenance-empty { padding: 28px 12px; color: var(--app-muted); text-align: center; }
.maintenance-editor { min-width: 0; min-height: 0; padding: 14px 18px 28px; overflow-x: auto; overflow-y: auto; background: #fff; }
.maintenance-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 2px 12px; }
.maintenance-editor-head h2 { margin: 0; font-size: 18px; }
.maintenance-editor-head p { margin: 3px 0 0; color: var(--app-muted); font-size: 12px; }
.maintenance-save-strip { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding: 9px 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: rgba(255, 255, 255, .98); box-shadow: var(--app-shadow); }
.maintenance-save-strip > div:first-child { display: grid; gap: 2px; }
.maintenance-save-strip span { color: var(--app-muted); font-size: 12px; }
.resource-editor { display: grid; gap: 0; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); }
.maintenance-form-section { min-width: 0; padding: 16px; border-bottom: 1px solid var(--app-border); }
.maintenance-form-section:last-child { border-bottom: 0; }
.maintenance-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.maintenance-section-head h3, .maintenance-section-head h4 { margin: 0; font-size: 15px; }
.maintenance-section-head p { margin: 3px 0 0; color: var(--app-muted); font-size: 12px; }
.maintenance-section-actions:empty { display: none; }
.maintenance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px; min-width: 0; container: ui-fields / inline-size; }
.maintenance-field { display: grid; align-content: start; min-width: 0; gap: 6px; }
.maintenance-field > span, .maintenance-switch-field > span { color: var(--app-muted); font-size: 12px; font-weight: 650; }
.maintenance-field-wide { grid-column: 1 / -1; }
.maintenance-switch-field { display: flex; align-items: center; justify-content: space-between; min-height: 54px; gap: 12px; }
.maintenance-subcard { min-width: 0; margin-top: 12px; padding: 13px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel-muted); }
details.maintenance-subcard > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -13px; padding: 13px; cursor: pointer; }
details.maintenance-subcard[open] > summary { margin-bottom: 13px; border-bottom: 1px solid var(--app-border); }
details.maintenance-subcard > summary span { color: var(--app-muted); font-size: 12px; }
.maintenance-inline-row { display: grid; align-items: end; gap: 9px; padding: 10px 0; border-bottom: 1px solid var(--app-border); }
.maintenance-inline-row:last-of-type { margin-bottom: 10px; }
.maintenance-rule-card { padding: 12px 0; border-bottom: 1px solid var(--app-border); }
.maintenance-rule-card:first-child { padding-top: 0; }
.maintenance-rule-card:last-of-type { margin-bottom: 12px; }
.effect-rule-grid, .calculation-event-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); align-items: end; gap: 10px; min-width: 0; container: ui-fields / inline-size; }
.effect-rule-head, .calculation-event-head { margin-bottom: 10px; }
.maintenance-remove-button { align-self: end; }
.maintenance-nested-panel { margin-top: 10px; padding: 11px; border-left: 3px solid #8b6d3f; background: #fffaf1; }
.maintenance-nested-panel > strong { display: block; margin-bottom: 8px; font-size: 13px; }
.maintenance-action-row, .maintenance-row-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 7px; }
.maintenance-row-head { justify-content: space-between; margin-bottom: 8px; }
.maintenance-help { margin: 9px 0 0; color: var(--app-muted); font-size: 12px; }
.maintenance-tag-list { display: flex; flex-wrap: wrap; gap: 5px; min-height: 34px; align-items: center; }
.skill-target-editor { display: grid; gap: 10px; }
.skill-target-card { min-width: 0; padding: 10px 0; border-bottom: 1px solid var(--app-border); }
.skill-target-specific-grid { display: grid; grid-template-columns: minmax(180px, 1.1fr) minmax(140px, .7fr) minmax(240px, 1.4fr) minmax(140px, .8fr) auto; align-items: start; gap: 10px; }
.skill-target-specific-grid > * { min-width: 0; }
.maintenance-target-mode { display: flex; flex-wrap: wrap; width: 100%; }
.skill-target-remove { align-self: start; margin-top: 24px; }
.source-list-editor { display: grid; gap: 8px; margin-top: 12px; }
.source-list-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; }
.modifier-card { padding: 12px 0; border-bottom: 1px solid var(--app-border); }
.modifier-grid { display: grid; grid-template-columns: minmax(240px, 1.4fr) minmax(240px, 1.4fr) minmax(110px, .55fr); gap: 10px; }
.modifier-description { grid-column: 1 / -1; }
.buff-effect-set-editor { display: grid; gap: 12px; }
.buff-meta-grid, .buff-effect-text-grid { padding-bottom: 12px; border-bottom: 1px solid var(--app-border); }
.buff-modifier-block { display: grid; gap: 4px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--app-border); }
.modification-readable-preview { margin-top: 14px; padding: 12px; border-left: 3px solid #8b6d3f; background: #fffaf1; }
.maintenance-preview-list { display: grid; gap: 8px; }
.maintenance-preview-row { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; }
.maintenance-preview-row span { color: var(--app-muted); }
.calculation-events-editor { margin-top: 12px; }
.skill-table-wrap { width: 100%; max-height: min(70vh, 720px); margin-top: 12px; overflow: auto; }
.skill-technical-info { margin-top: 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; }
.skill-technical-info > summary { padding: 10px 12px; cursor: pointer; color: var(--app-muted); font-size: 12px; font-weight: 700; }
.skill-technical-info[open] > summary { border-bottom: 1px solid var(--app-border); }
.skill-technical-info dl { display: grid; gap: 0; margin: 0; padding: 4px 12px; }
.skill-technical-info dl > div { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(0, 1.2fr); gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--app-border); }
.skill-technical-info dl > div:last-child { border-bottom: 0; }
.skill-technical-info dt { min-width: 0; color: var(--app-muted); font-size: 12px; }
.skill-technical-info dd { min-width: 0; margin: 0; }
.skill-technical-info code { display: block; overflow-wrap: anywhere; color: var(--app-text); font-size: 12px; }
.core-scaling-table-wrap, .modification-preview-table-wrap { width: 100%; margin-top: 12px; overflow-x: auto; }
.skill-multiplier-table, .core-scaling-table, .modification-preview-table { width: max-content; min-width: 100%; border-collapse: collapse; background: #fff; }
.skill-multiplier-table th, .skill-multiplier-table td, .core-scaling-table th, .core-scaling-table td, .modification-preview-table th, .modification-preview-table td { min-width: 118px; padding: 7px; border: 1px solid var(--app-border); text-align: left; vertical-align: top; }
.skill-multiplier-table th, .core-scaling-table th, .modification-preview-table th { background: var(--app-panel-muted); font-size: 12px; white-space: nowrap; }
.skill-multiplier-table thead th { position: sticky; top: 0; z-index: 3; }
.skill-multiplier-table .skill-col-label { position: sticky; left: 0; z-index: 2; min-width: 220px; background: #fff; }
.skill-multiplier-table .skill-col-kind { position: sticky; left: 220px; z-index: 2; min-width: 150px; background: #fff; }
.skill-multiplier-table .skill-col-basis { position: sticky; left: 370px; z-index: 2; min-width: 160px; background: #fff; }
.skill-multiplier-table thead .skill-col-label, .skill-multiplier-table thead .skill-col-kind, .skill-multiplier-table thead .skill-col-basis { z-index: 4; background: var(--app-panel-muted); }
.core-scaling-table td label { display: grid; gap: 5px; }
.core-scaling-table td label span { color: var(--app-muted); font-size: 11px; }
.core-level-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 10px; }
.core-stat-row { grid-template-columns: minmax(120px, 1.3fr) minmax(100px, 1fr) minmax(120px, 1fr) auto; }
.core-bonus-row { grid-template-columns: minmax(140px, 1fr) minmax(110px, 1fr) auto; }
.teammate-profile-layout { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 15px; }
.teammate-profile-layout .maintenance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.teammate-buff-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 16px; }
.teammate-buff-list { display: grid; align-content: start; gap: 6px; }
.teammate-buff-list button { display: grid; gap: 3px; width: 100%; padding: 9px 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; text-align: left; cursor: pointer; }
.teammate-buff-list button.active { border-color: var(--app-blue); background: #f5f9ff; }
.teammate-buff-list small { display: -webkit-box; overflow: hidden; color: var(--app-muted); font-size: 11px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.teammate-current-buff { min-width: 0; padding-left: 16px; border-left: 1px solid var(--app-border); }
.buff-body-editor { display: grid; gap: 0; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); }
.validation-summary { margin-bottom: 12px; padding: 12px 14px; border-left: 3px solid var(--app-red); background: #fff6f6; color: #912f2f; }
.validation-summary ul { margin: 7px 0 0; padding-left: 20px; }
.validation-summary button { padding: 2px 0; border: 0; background: transparent; color: inherit; text-align: left; text-decoration: underline; cursor: pointer; }
.save-preview { margin-top: 14px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; }
.save-preview summary { padding: 12px 14px; cursor: pointer; font-weight: 650; }
.save-preview pre { max-height: 360px; margin: 0; padding: 14px; overflow: auto; border-top: 1px solid var(--app-border); background: var(--app-panel-muted); font-size: 12px; }
.create-form { display: grid; gap: 14px; }
.create-form > label { display: grid; gap: 6px; }
.create-form > label > span { color: var(--app-muted); font-size: 12px; font-weight: 650; }
.create-intro { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--app-panel-muted); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
@container ui-layout (max-width: 900px) { .skill-target-specific-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .skill-target-remove { grid-column: 1 / -1; justify-self: end; } .modifier-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .modifier-factor { max-width: 180px; } .teammate-buff-layout, .core-level-groups { grid-template-columns: 1fr; } .teammate-current-buff { padding: 14px 0 0; border-top: 1px solid var(--app-border); border-left: 0; } }
@media (max-width: 900px) { .maintenance-header { align-items: flex-start; flex-direction: column; } .maintenance-tabs { position: static; margin-inline: -2px; } .maintenance-workspace { grid-template-columns: 1fr; height: auto; min-height: calc(100vh - 210px); overflow: visible; } .record-browser { overflow: visible; border-right: 0; border-bottom: 1px solid var(--app-border); } .record-list { grid-auto-flow: column; grid-auto-columns: minmax(210px, 70vw); max-height: none; overflow-x: auto; } .maintenance-editor { overflow: visible; } .maintenance-save-strip { position: static; } }
@container ui-layout (max-width: 600px) { .maintenance-editor { padding: 10px; } .maintenance-save-strip { align-items: stretch; flex-direction: column; top: 110px; } .maintenance-save-strip .toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .maintenance-form-section { padding: 12px; } .skill-target-specific-grid, .modifier-grid, .core-stat-row, .core-bonus-row, .teammate-profile-layout, .teammate-profile-layout .maintenance-grid { grid-template-columns: 1fr; } .maintenance-field-wide, .modifier-description { grid-column: auto; } .skill-target-remove, .maintenance-remove-button { justify-self: end; margin-top: 0; } .skill-multiplier-table .skill-col-kind, .skill-multiplier-table .skill-col-basis { position: static; } .maintenance-preview-row, .skill-technical-info dl > div { grid-template-columns: 1fr; gap: 4px; } }
</style>
