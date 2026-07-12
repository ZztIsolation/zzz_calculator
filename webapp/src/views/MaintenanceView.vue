<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { onBeforeRouteLeave, useRouter } from "vue-router"
import { NButton, NInput, NSelect, NTag } from "naive-ui"
import { CheckCircle2, Copy, Plus, RefreshCw, Save, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { loadAppConfig } from "@/runtime/app-config"
import { formatStoredStatValue, statLabel } from "@core/shared-combat.js"
import {
  FIELD_BUFF_GAME_VERSIONS,
  FIELD_BUFF_MODE_OPTIONS,
  FIELD_BUFF_PHASE_OPTIONS,
  fieldBuffModeOption,
  fieldBuffPhaseName,
  validateMaintenanceItem,
} from "@core/maintenanceValidation.js"

type ResourceValue =
  | "agents"
  | "agent-skills"
  | "w-engines"
  | "drive-disc-sets"
  | "anomaly-effects"
  | "teammate-buffs"
  | "field-buffs"
  | "boss-buffs"

interface OriginalIdentity {
  id: string
  teammateId: string
  maintenanceType: string
}

interface StoredDraft {
  resource: ResourceValue
  selectedKey: string
  draftText: string
  baselineText: string
  draftIsNew: boolean
  originalIdentity: OriginalIdentity
}

type PendingCatalogRefresh =
  | { kind: "save", savedKey: string }
  | { kind: "delete" }

const DRAFT_STORAGE_KEY = "zzz_maintenance_vue_draft_v1"

const resources: Array<{ label: string, value: ResourceValue }> = [
  { label: "角色", value: "agents" },
  { label: "角色技能", value: "agent-skills" },
  { label: "音擎", value: "w-engines" },
  { label: "驱动盘套装", value: "drive-disc-sets" },
  { label: "异常/紊乱", value: "anomaly-effects" },
  { label: "队友 Buff", value: "teammate-buffs" },
  { label: "场地 Buff", value: "field-buffs" },
  { label: "Boss Buff", value: "boss-buffs" },
]

const router = useRouter()
const loading = ref(false)
const error = ref("")
const saveState = ref("加载中")
const saveHint = ref("正在读取维护数据")
const catalog = ref<any>(null)
const maintenanceEnabled = ref(false)
const resource = ref<ResourceValue>("agents")
const query = ref("")
const selectedKey = ref("")
const draftText = ref("")
const baselineText = ref("")
const draftIsNew = ref(false)
const validationError = ref("")
const originalIdentity = ref<OriginalIdentity>({ id: "", teammateId: "", maintenanceType: "" })
const pendingCatalogRefresh = ref<PendingCatalogRefresh | null>(null)
const busy = ref(false)
const showDeleteConfirm = ref(false)
const showDiscardConfirm = ref(false)
const showLeaveConfirm = ref(false)
const pendingRoute = ref("")
let allowRouteLeave = false
let pendingDiscardAction: (() => void) | null = null

const resourceOptions = resources.map(({ label, value }) => ({ label, value }))
const fieldBuffModeOptions = FIELD_BUFF_MODE_OPTIONS.map(option => ({
  label: option.selectLabel?.zhCN ?? option.source.zhCN,
  value: option.modeId,
}))
const fieldBuffVersionOptions = FIELD_BUFF_GAME_VERSIONS.map(version => ({
  label: `${version}版本`,
  value: version,
}))
const fieldBuffPhaseOptions = FIELD_BUFF_PHASE_OPTIONS.map(option => ({
  label: option.phaseName.zhCN,
  value: option.phaseNo,
}))

const hasUnsavedChanges = computed(() => Boolean(draftText.value) && (
  draftIsNew.value || draftText.value !== baselineText.value
))
const records = computed(() => recordsFor(resource.value))
const filteredRecords = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) {
    return records.value
  }
  return records.value.filter((item: any) => JSON.stringify(item).toLowerCase().includes(needle))
})
const draftObject = computed(() => {
  try {
    return draftText.value ? JSON.parse(draftText.value) : null
  } catch {
    return null
  }
})

function textOf(value: any) {
  if (!value) {
    return ""
  }
  return typeof value === "string" ? value : value.zhCN ?? value.en ?? ""
}

function anomalyMaintenanceType(item: any) {
  return item?.settlementType === "disorder" || item?.maintenanceType === "disorder"
    ? "disorder"
    : "anomaly"
}

function anomalyRecords() {
  if (Array.isArray(catalog.value?.anomalyEffects?.effects)) {
    return catalog.value.anomalyEffects.effects.map((item: any) => ({
      ...item,
      maintenanceType: anomalyMaintenanceType(item),
    }))
  }
  return [
    ...(catalog.value?.anomalyEffects?.anomalyEffects ?? []).map((item: any) => ({
      ...item,
      settlementType: "attribute",
      maintenanceType: "anomaly",
    })),
    ...(catalog.value?.anomalyEffects?.disorderEffects ?? []).map((item: any) => ({
      ...item,
      settlementType: "disorder",
      maintenanceType: "disorder",
    })),
  ]
}

function teammateBuffRecords() {
  return (catalog.value?.combatBuffs?.teammates ?? []).flatMap((teammate: any) => (
    (teammate.buffs ?? []).map((buff: any) => ({
      ...buff,
      maintenanceType: "teammate",
      teammateId: teammate.id,
      teammateName: teammate.name,
      teammateImages: teammate.images,
    }))
  ))
}

function recordsFor(value: ResourceValue): any[] {
  switch (value) {
    case "agents":
      return catalog.value?.agents?.agents ?? []
    case "agent-skills":
      return catalog.value?.agentSkills?.agentSkills ?? []
    case "w-engines":
      return catalog.value?.wEngines?.wEngines ?? []
    case "drive-disc-sets":
      return catalog.value?.driveDiscSets?.sets ?? []
    case "anomaly-effects":
      return anomalyRecords()
    case "teammate-buffs":
      return teammateBuffRecords()
    case "field-buffs":
      return [
        ...(catalog.value?.combatBuffs?.fieldBuffs ?? []),
        ...(catalog.value?.combatBuffs?.buffs ?? []).filter((item: any) => item?.sourceType === "field"),
      ]
    case "boss-buffs":
      return [
        ...(catalog.value?.combatBuffs?.bossBuffs ?? []),
        ...(catalog.value?.combatBuffs?.buffs ?? []).filter((item: any) => item?.sourceType === "boss"),
      ]
  }
}

function recordKey(item: any, value: ResourceValue = resource.value) {
  if (value === "anomaly-effects") {
    return `${anomalyMaintenanceType(item)}:${item?.id ?? ""}`
  }
  if (value === "teammate-buffs") {
    return `teammate:${item?.teammateId ?? ""}:${item?.id ?? ""}`
  }
  return String(item?.id ?? item?.name?.zhCN ?? item?.bossName?.zhCN ?? "")
}

function recordLabel(item: any) {
  if (resource.value === "teammate-buffs") {
    return [textOf(item.teammateName), textOf(item.source)].filter(Boolean).join("｜") || item.id || "未命名"
  }
  return textOf(item.name) || textOf(item.label) || textOf(item.bossName) || item.id || "未命名"
}

function effectSummary(item: any) {
  const effects = Array.isArray(item?.effects) ? item.effects : []
  if (!effects.length) {
    return "无结构化效果"
  }
  const meta = catalog.value?.meta
  const labels = effects.slice(0, 2).map((effect: any) => {
    const stat = effect.stat
    if (!stat) {
      return textOf(effect.label) || effect.id || effect.type || "效果"
    }
    const value = typeof effect.value === "number"
      ? ` ${formatStoredStatValue(stat, effect.value, { mode: effect.mode })}`
      : ""
    return `${statLabel(stat, meta)}${value}`
  })
  return effects.length > labels.length
    ? `${labels.join("、")} 等${effects.length}项`
    : labels.join("、")
}

function recordMeta(item: any) {
  if (resource.value === "field-buffs") {
    const period = item.period ?? {}
    return [
      textOf(item.source),
      period.gameVersion ? `${period.gameVersion}版本` : "",
      textOf(period.phaseName) || textOf(item.sourcePeriod),
      effectSummary(item),
    ].filter(Boolean).join(" · ") || recordKey(item)
  }
  if (resource.value === "teammate-buffs") {
    return `${item.teammateId ?? ""} · ${item.id ?? ""}`
  }
  return recordKey(item)
}

function identityFor(item: any): OriginalIdentity {
  return {
    id: String(item?.id ?? ""),
    teammateId: String(item?.teammateId ?? ""),
    maintenanceType: resource.value === "anomaly-effects" ? anomalyMaintenanceType(item) : "",
  }
}

function clearStoredDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}

function persistDraft() {
  if (!hasUnsavedChanges.value) {
    clearStoredDraft()
    return
  }
  const payload: StoredDraft = {
    resource: resource.value,
    selectedKey: selectedKey.value,
    draftText: draftText.value,
    baselineText: baselineText.value,
    draftIsNew: draftIsNew.value,
    originalIdentity: originalIdentity.value,
  }
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Editing remains available when localStorage is full or disabled.
  }
}

function restoreStoredDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "null") as StoredDraft | null
    if (!stored || !resources.some(item => item.value === stored.resource) || typeof stored.draftText !== "string") {
      return false
    }
    resource.value = stored.resource
    selectedKey.value = stored.selectedKey
    draftText.value = stored.draftText
    baselineText.value = stored.baselineText ?? ""
    draftIsNew.value = stored.draftIsNew === true
    originalIdentity.value = stored.originalIdentity ?? { id: "", teammateId: "", maintenanceType: "" }
    validationError.value = ""
    saveState.value = "已恢复草稿"
    saveHint.value = "上次未保存的修改已从本机恢复"
    return true
  } catch {
    clearStoredDraft()
    return false
  }
}

function setEditor(item: any, options: { isNew?: boolean, key?: string, state?: string, hint?: string } = {}) {
  pendingCatalogRefresh.value = null
  const text = JSON.stringify(item, null, 2)
  selectedKey.value = options.key ?? recordKey(item)
  draftText.value = text
  baselineText.value = options.isNew ? "" : text
  draftIsNew.value = options.isNew === true
  originalIdentity.value = options.isNew ? { id: "", teammateId: "", maintenanceType: "" } : identityFor(item)
  validationError.value = ""
  saveState.value = options.state ?? (options.isNew ? "未保存" : "已加载")
  saveHint.value = options.hint ?? (options.isNew ? "本地草稿尚未写入" : "修改 JSON 后保存")
  if (options.isNew) {
    persistDraft()
  } else {
    clearStoredDraft()
  }
}

function selectFirstRecord() {
  const first = records.value[0]
  if (first) {
    setEditor(first)
  } else {
    selectedKey.value = ""
    draftText.value = ""
    baselineText.value = ""
    draftIsNew.value = false
    originalIdentity.value = { id: "", teammateId: "", maintenanceType: "" }
  }
}

async function fetchCatalog() {
  const response = await fetch("/api/maintenance/catalog", { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false || !payload.data) {
    throw new Error(payload.error ?? `维护 API 不可用：${response.status}`)
  }
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
    if (!restoreStoredDraft()) {
      selectFirstRecord()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    saveState.value = "加载失败"
    saveHint.value = error.value
  } finally {
    loading.value = false
  }
}

function requestDiscard(action: () => void) {
  if (!hasUnsavedChanges.value) {
    action()
    return
  }
  pendingDiscardAction = action
  showDiscardConfirm.value = true
}

function confirmDiscard() {
  if (busy.value) {
    return
  }
  const action = pendingDiscardAction
  pendingDiscardAction = null
  showDiscardConfirm.value = false
  clearStoredDraft()
  action?.()
}

function changeResource(value: ResourceValue) {
  if (busy.value || value === resource.value) {
    return
  }
  requestDiscard(() => {
    resource.value = value
    query.value = ""
    selectFirstRecord()
  })
}

function selectRecord(item: any) {
  if (busy.value) {
    return
  }
  const key = recordKey(item)
  if (key === selectedKey.value) {
    return
  }
  requestDiscard(() => setEditor(item))
}

function generatedId(prefix: string) {
  return `${prefix}_${Date.now()}`
}

function blankRecord(): any {
  const id = generatedId(resource.value.replace(/[^a-z0-9]+/gi, "_"))
  if (resource.value === "agents") {
    return {
      id,
      name: { zhCN: "未命名角色" },
      rarity: "S",
      attribute: "physical",
      specialty: "attack",
      faction: "",
      level60: {
        hpBase: 1,
        atkBase: 1,
        defBase: 1,
        critRate: 5,
        critDmg: 50,
        impact: 0,
        anomalyProficiency: 0,
        anomalyMastery: 0,
        energyRegen: 120,
        penRatio: 0,
      },
      combatBuffs: { corePassive: null, additionalAbility: null },
      images: { portrait: "", source: "" },
      sources: [],
    }
  }
  if (resource.value === "agent-skills") {
    return { id, agentId: "", name: { zhCN: "未命名技能倍率" }, categories: [], sources: [] }
  }
  if (resource.value === "w-engines") {
    return {
      id,
      name: { zhCN: "未命名音擎" },
      rarity: "S",
      specialty: "attack",
      level60: { atkBase: 1, advancedStat: { stat: "critDmg", value: 0, mode: "flat" } },
      effect: {
        name: { zhCN: "未命名被动" },
        description: { zhCN: "待填写" },
        buff: { scope: "inCombat", effects: [], appliesToOutOfCombatPanel: false },
      },
      images: { icon: "", source: "" },
      sources: [],
    }
  }
  if (resource.value === "drive-disc-sets") {
    return { id, name: { zhCN: "未命名驱动盘套装" }, images: { icon: "", source: "" }, sources: [] }
  }
  if (resource.value === "anomaly-effects") {
    return {
      id,
      settlementType: "attribute",
      maintenanceType: "anomaly",
      label: { zhCN: "未命名异常" },
      element: "physical",
      baseMultiplier: 0,
      defaultProcCount: 1,
    }
  }
  if (resource.value === "teammate-buffs") {
    return {
      id: "",
      maintenanceType: "teammate",
      teammateId: "",
      teammateName: { zhCN: "未命名队友" },
      teammateImages: { icon: "", source: "" },
      source: { zhCN: "未命名 Buff" },
      description: { zhCN: "待填写" },
      scope: "inCombat",
      effects: [],
      buffModifiers: [],
      coverage: { default: 1, min: 0, max: 1, step: 0.1 },
    }
  }
  if (resource.value === "field-buffs") {
    const mode = fieldBuffModeOption("defense_v5")
    const phaseName = fieldBuffPhaseName(1) ?? { zhCN: "第一期" }
    return {
      sourceType: "field",
      scope: "inCombat",
      name: { zhCN: "未命名场地 Buff" },
      source: { zhCN: mode?.source?.zhCN ?? "防卫战 v5" },
      period: { modeId: "defense_v5", gameVersion: "3.0", phaseNo: 1, phaseName },
      sourcePeriod: { zhCN: `3.0版本${phaseName.zhCN}` },
      description: { zhCN: "待填写" },
      coverage: { default: 1, min: 0, max: 1, step: 0.1 },
      effects: [],
      buffModifiers: [],
    }
  }
  return {
    sourceType: "boss",
    scope: "inCombat",
    bossName: { zhCN: "未命名 BOSS" },
    bossSource: { zhCN: "待填写" },
    sourcePeriod: { zhCN: "待填写" },
    description: { zhCN: "待填写" },
    coverage: { default: 1, min: 0, max: 1, step: 0.1 },
    effects: [],
    buffModifiers: [],
  }
}

function newRecord() {
  if (busy.value) {
    return
  }
  requestDiscard(() => {
    const item = blankRecord()
    setEditor(item, { isNew: true, key: `draft:${Date.now()}`, hint: "新增条目已保存为本地草稿" })
  })
}

function cloneRecord() {
  if (busy.value) {
    return
  }
  const parsed = parseDraft()
  if (!parsed) {
    return
  }
  const copy = JSON.parse(JSON.stringify(parsed))
  if (resource.value === "field-buffs") {
    delete copy.id
  } else {
    copy.id = generatedId(copy.id || resource.value.replace(/[^a-z0-9]+/gi, "_"))
  }
  if (resource.value === "teammate-buffs") {
    copy.source = { ...(copy.source ?? {}), zhCN: `${textOf(copy.source) || "Buff"} 副本` }
  } else if (resource.value === "anomaly-effects") {
    copy.label = { ...(copy.label ?? {}), zhCN: `${textOf(copy.label) || "异常"} 副本` }
  } else if (resource.value === "boss-buffs") {
    copy.bossName = { ...(copy.bossName ?? {}), zhCN: `${textOf(copy.bossName) || "BOSS"} 副本` }
  } else if (copy.name?.zhCN) {
    copy.name.zhCN = `${copy.name.zhCN} 副本`
  }
  setEditor(copy, { isNew: true, key: `draft:${Date.now()}`, hint: "复制条目已保存为本地草稿" })
}

function parseDraft() {
  try {
    const item = JSON.parse(draftText.value || "{}")
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("顶层必须是 JSON 对象")
    }
    validationError.value = ""
    return item
  } catch (err) {
    validationError.value = err instanceof Error ? err.message : String(err)
    saveState.value = "JSON 无效"
    saveHint.value = validationError.value
    return null
  }
}

function validateDraft() {
  if (busy.value) {
    return
  }
  const item = parseDraft()
  if (!item || !validateBusinessDraft(item)) {
    return
  }
  validationError.value = ""
  saveState.value = "校验通过"
  saveHint.value = "JSON 格式和业务规则均通过校验"
}

function markDraftChanged() {
  pendingCatalogRefresh.value = null
  validationError.value = ""
  saveState.value = "未保存"
  saveHint.value = "本次修改已保存为本地草稿"
  persistDraft()
}

function updateDraftText(value: string) {
  if (busy.value) {
    return
  }
  draftText.value = value
  markDraftChanged()
}

function patchDraft(patch: Record<string, any>) {
  if (busy.value) {
    return
  }
  const item = draftObject.value ? JSON.parse(JSON.stringify(draftObject.value)) : {}
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".")
    let cursor = item
    for (const part of parts.slice(0, -1)) {
      cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {}
      cursor = cursor[part]
    }
    cursor[parts.at(-1) as string] = value
  }
  draftText.value = JSON.stringify(item, null, 2)
  markDraftChanged()
}

function patchFieldBuffPeriod(patch: { modeId?: string, gameVersion?: string, phaseNo?: number | string }) {
  const current = draftObject.value ?? {}
  const modeId = patch.modeId ?? current.period?.modeId ?? "defense_v5"
  const gameVersion = patch.gameVersion ?? current.period?.gameVersion ?? "3.0"
  const phaseNo = Number(patch.phaseNo ?? current.period?.phaseNo ?? 1)
  const mode = fieldBuffModeOption(modeId)
  const phaseName = fieldBuffPhaseName(phaseNo) ?? { zhCN: "" }
  patchDraft({
    "source.zhCN": mode?.source?.zhCN ?? "",
    "period.modeId": modeId,
    "period.gameVersion": gameVersion,
    "period.phaseNo": phaseNo,
    "period.phaseName": phaseName,
    "sourcePeriod.zhCN": gameVersion && phaseName.zhCN ? `${gameVersion}版本${phaseName.zhCN}` : "",
  })
}

function teammateRequest(item: any) {
  const {
    maintenanceType: _maintenanceType,
    teammateId,
    teammateName,
    teammateImages,
    ...buff
  } = item
  return {
    teammate: {
      id: teammateId,
      name: teammateName,
      ...(teammateImages ? { images: teammateImages } : {}),
    },
    buff,
  }
}

function requestBody(item: any) {
  if (resource.value === "teammate-buffs") {
    return teammateRequest(item)
  }
  if (resource.value === "field-buffs" && !draftIsNew.value && originalIdentity.value.id) {
    return { ...item, _maintenanceOriginalId: originalIdentity.value.id }
  }
  return item
}

function validationContext(item: any) {
  const currentId = draftIsNew.value ? "" : originalIdentity.value.id
  if (resource.value === "agents") {
    const effects = anomalyRecords()
    return {
      items: catalog.value?.agents?.agents ?? [],
      currentId,
      agentSkills: catalog.value?.agentSkills?.agentSkills ?? [],
      anomalyEffects: effects.filter((effect: any) => anomalyMaintenanceType(effect) === "anomaly"),
      disorderEffects: effects.filter((effect: any) => anomalyMaintenanceType(effect) === "disorder"),
      driveDiscSets: catalog.value?.driveDiscSets?.sets ?? [],
    }
  }
  if (resource.value === "teammate-buffs") {
    return {
      teammates: catalog.value?.combatBuffs?.teammates ?? [],
      currentBuffId: currentId,
    }
  }
  if (resource.value === "anomaly-effects") {
    return {
      items: anomalyRecords().filter((effect: any) => anomalyMaintenanceType(effect) === anomalyMaintenanceType(item)),
      currentId: !draftIsNew.value && originalIdentity.value.maintenanceType === anomalyMaintenanceType(item) ? currentId : "",
    }
  }
  return {
    items: records.value,
    currentId,
  }
}

function identityChangeError(item: any) {
  if (draftIsNew.value || resource.value === "field-buffs") {
    return ""
  }
  if (String(item.id ?? "") !== originalIdentity.value.id) {
    return "已有条目的 ID 不可修改；请使用“复制当前”创建新条目。"
  }
  if (resource.value === "teammate-buffs" && String(item.teammateId ?? "") !== originalIdentity.value.teammateId) {
    return "已有队友 Buff 的队友 ID 不可修改；请使用“复制当前”创建新条目。"
  }
  if (resource.value === "anomaly-effects" && anomalyMaintenanceType(item) !== originalIdentity.value.maintenanceType) {
    return "已有异常条目的结算类型不可修改；请使用“复制当前”创建新条目。"
  }
  return ""
}

function validateBusinessDraft(item: any) {
  const identityError = identityChangeError(item)
  if (identityError) {
    validationError.value = identityError
    saveState.value = "校验失败"
    saveHint.value = identityError
    return false
  }
  const input = resource.value === "teammate-buffs" ? teammateRequest(item) : item
  const result = validateMaintenanceItem(resource.value, input, validationContext(item))
  if (!result.ok) {
    validationError.value = result.errors.join("\n")
    saveState.value = "校验失败"
    saveHint.value = result.errors[0] ?? "业务校验未通过"
    return false
  }
  validationError.value = ""
  return true
}

async function saveDraft() {
  if (busy.value) {
    return
  }
  if (!maintenanceEnabled.value) {
    saveState.value = "只读"
    saveHint.value = "当前环境未开启维护写入，不能保存。"
    return
  }
  if (pendingCatalogRefresh.value) {
    await refreshCatalogAfterMutation()
    return
  }
  const item = parseDraft()
  if (!item || !validateBusinessDraft(item)) {
    return
  }
  saveState.value = "保存中"
  saveHint.value = "正在写入维护数据"
  busy.value = true
  let savedItem: any
  try {
    const response = await fetch(`/api/maintenance/${resource.value}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(item)),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error ?? `保存失败：${response.status}`)
    }

    savedItem = payload.savedItem ?? item
  } catch (err) {
    saveState.value = "保存失败"
    saveHint.value = err instanceof Error ? err.message : String(err)
    persistDraft()
    return
  } finally {
    busy.value = false
  }

  const savedKey = recordKey(savedItem)
  setEditor(savedItem, { state: "已保存", hint: "保存成功，正在刷新完整目录" })
  pendingCatalogRefresh.value = { kind: "save", savedKey }
  await refreshCatalogAfterMutation()
}

async function refreshCatalogAfterMutation() {
  const pending = pendingCatalogRefresh.value
  if (!pending || busy.value) {
    return
  }
  const savedItem = draftObject.value ? JSON.parse(JSON.stringify(draftObject.value)) : null
  saveState.value = "刷新中"
  saveHint.value = "写入已完成，正在重新请求完整目录"
  busy.value = true
  try {
    await fetchCatalog()
    pendingCatalogRefresh.value = null
    if (pending.kind === "save") {
      const reloaded = records.value.find(candidate => recordKey(candidate) === pending.savedKey)
      setEditor(reloaded ?? savedItem, { state: "已保存", hint: "保存成功，完整目录已刷新" })
    } else {
      selectFirstRecord()
      saveState.value = "已删除"
      saveHint.value = "条目已删除，完整目录已刷新"
    }
  } catch (err) {
    saveState.value = pending.kind === "save" ? "已保存，刷新失败" : "已删除，刷新失败"
    const detail = err instanceof Error ? err.message : String(err)
    saveHint.value = `写入已完成；再次点击刷新只会重新请求目录。${detail}`
  } finally {
    busy.value = false
  }
}

function requestDelete() {
  if (busy.value || !draftText.value || pendingCatalogRefresh.value) {
    return
  }
  showDeleteConfirm.value = true
}

async function deleteDraft() {
  if (busy.value) {
    return
  }
  showDeleteConfirm.value = false
  if (!maintenanceEnabled.value) {
    saveState.value = "只读"
    saveHint.value = "当前环境未开启维护写入，不能删除。"
    return
  }
  if (draftIsNew.value) {
    clearStoredDraft()
    selectFirstRecord()
    saveState.value = "已删除草稿"
    saveHint.value = "未保存的本地草稿已移除"
    return
  }

  const item = parseDraft()
  if (!item) {
    return
  }
  let pathname = ""
  if (resource.value === "teammate-buffs") {
    const teammateId = originalIdentity.value.teammateId || item.teammateId
    const buffId = originalIdentity.value.id || item.id
    pathname = `/api/maintenance/teammate-buffs/${encodeURIComponent(teammateId)}/${encodeURIComponent(buffId)}`
  } else if (resource.value === "anomaly-effects") {
    const type = originalIdentity.value.maintenanceType || anomalyMaintenanceType(item)
    const id = originalIdentity.value.id || item.id
    pathname = `/api/maintenance/anomaly-effects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`
  } else {
    const id = originalIdentity.value.id || item.id
    pathname = `/api/maintenance/${resource.value}/${encodeURIComponent(id)}`
  }

  saveState.value = "删除中"
  saveHint.value = "正在删除维护数据"
  busy.value = true
  try {
    const response = await fetch(pathname, { method: "DELETE" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error ?? `删除失败：${response.status}`)
    }
  } catch (err) {
    saveState.value = "删除失败"
    saveHint.value = err instanceof Error ? err.message : String(err)
    return
  } finally {
    busy.value = false
  }
  clearStoredDraft()
  pendingCatalogRefresh.value = { kind: "delete" }
  await refreshCatalogAfterMutation()
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) {
    return
  }
  persistDraft()
  event.preventDefault()
  event.returnValue = ""
}

function confirmRouteLeave() {
  const target = pendingRoute.value
  pendingRoute.value = ""
  showLeaveConfirm.value = false
  allowRouteLeave = true
  if (target) {
    void router.push(target)
  }
}

onBeforeRouteLeave(to => {
  if (allowRouteLeave || !hasUnsavedChanges.value) {
    return true
  }
  persistDraft()
  pendingRoute.value = to.fullPath
  showLeaveConfirm.value = true
  return false
})

onMounted(() => {
  window.addEventListener("beforeunload", warnBeforeUnload)
  void load()
})

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", warnBeforeUnload)
})
</script>

<template>
  <section class="section-band">
    <div class="panel">
      <div class="panel-header">
        <h1 class="panel-title">维护界面</h1>
        <div class="toolbar">
          <NTag :type="maintenanceEnabled ? 'success' : 'warning'" round>
            {{ maintenanceEnabled ? '维护写入已开启' : '只读模式' }}
          </NTag>
          <NButton :disabled="busy || !maintenanceEnabled || !draftText || Boolean(pendingCatalogRefresh)" @click="cloneRecord">
            <template #icon><Copy :size="16" /></template>
            复制当前
          </NButton>
          <NButton :disabled="busy || !maintenanceEnabled || Boolean(pendingCatalogRefresh)" @click="newRecord">
            <template #icon><Plus :size="16" /></template>
            新增
          </NButton>
          <NButton :disabled="!draftText" @click="validateDraft">
            <template #icon><CheckCircle2 :size="16" /></template>
            校验 JSON
          </NButton>
          <NButton type="primary" :disabled="busy || !maintenanceEnabled || !draftText" @click="saveDraft">
            <template #icon>
              <RefreshCw v-if="pendingCatalogRefresh" :size="16" />
              <Save v-else :size="16" />
            </template>
            {{ pendingCatalogRefresh ? '刷新' : '保存' }}
          </NButton>
        </div>
      </div>
      <div class="panel-body maintenance-layout">
        <aside class="section-band">
          <NSelect
            :value="resource"
            :options="resourceOptions"
            aria-label="维护资源"
            :disabled="busy"
            @update:value="changeResource($event as ResourceValue)"
          />
          <NInput v-model:value="query" clearable placeholder="名称、ID、来源" aria-label="搜索维护条目" :disabled="busy" />
          <NTag v-if="error" type="error">{{ error }}</NTag>
          <NTag v-else round>{{ filteredRecords.length }} / {{ records.length }}</NTag>
          <div class="record-list">
            <button
              v-for="item in filteredRecords"
              :key="recordKey(item)"
              type="button"
              class="entity-option"
              :class="{ active: recordKey(item) === selectedKey }"
              :disabled="busy"
              @click="selectRecord(item)"
            >
              <span>
                <span class="entity-name">{{ recordLabel(item) }}</span>
                <span class="entity-meta">{{ recordMeta(item) }}</span>
              </span>
            </button>
          </div>
        </aside>
        <section class="section-band">
          <div class="maintenance-save-strip">
            <div>
              <strong>{{ saveState }}</strong>
              <span>{{ saveHint }}</span>
            </div>
            <div class="toolbar">
              <NButton type="error" :disabled="busy || !maintenanceEnabled || !draftText || Boolean(pendingCatalogRefresh)" @click="requestDelete">
                <template #icon><Trash2 :size="16" /></template>
                删除
              </NButton>
              <NButton type="primary" :disabled="busy || !maintenanceEnabled || !draftText" @click="saveDraft">{{ pendingCatalogRefresh ? '刷新' : '保存' }}</NButton>
            </div>
          </div>
          <NTag v-if="validationError" type="error">{{ validationError }}</NTag>
          <div v-if="draftObject" class="panel">
            <div class="panel-header">
              <h2 class="panel-title">常用字段</h2>
              <NTag round>{{ resource }}</NTag>
            </div>
            <dl class="panel-body metric-grid">
              <div v-if="resource === 'teammate-buffs'" class="metric">
                <dt>队友 ID</dt>
                <dd><NInput :value="draftObject.teammateId ?? ''" aria-label="队友 ID" :disabled="busy || !maintenanceEnabled || !draftIsNew" @update:value="patchDraft({ teammateId: $event })" /></dd>
              </div>
              <div v-if="resource === 'teammate-buffs'" class="metric">
                <dt>Buff ID</dt>
                <dd><NInput :value="draftObject.id ?? ''" aria-label="Buff ID" :disabled="busy || !maintenanceEnabled || !draftIsNew" @update:value="patchDraft({ id: $event })" /></dd>
              </div>
              <div v-else-if="resource !== 'field-buffs'" class="metric">
                <dt>ID</dt>
                <dd><NInput :value="draftObject.id ?? ''" aria-label="条目 ID" :disabled="busy || !maintenanceEnabled || !draftIsNew" @update:value="patchDraft({ id: $event })" /></dd>
              </div>

              <div v-if="resource === 'anomaly-effects'" class="metric">
                <dt>中文名</dt>
                <dd><NInput :value="draftObject.label?.zhCN ?? ''" aria-label="中文名" :disabled="busy || !maintenanceEnabled" @update:value="patchDraft({ 'label.zhCN': $event })" /></dd>
              </div>
              <div v-else-if="resource === 'teammate-buffs'" class="metric">
                <dt>队友名称</dt>
                <dd><NInput :value="draftObject.teammateName?.zhCN ?? ''" aria-label="队友名称" :disabled="busy || !maintenanceEnabled" @update:value="patchDraft({ 'teammateName.zhCN': $event })" /></dd>
              </div>
              <div v-else-if="resource === 'boss-buffs'" class="metric">
                <dt>Boss 名称</dt>
                <dd><NInput :value="draftObject.bossName?.zhCN ?? ''" aria-label="Boss 名称" :disabled="busy || !maintenanceEnabled" @update:value="patchDraft({ 'bossName.zhCN': $event })" /></dd>
              </div>
              <div v-else class="metric">
                <dt>中文名</dt>
                <dd><NInput :value="draftObject.name?.zhCN ?? ''" aria-label="中文名" :disabled="busy || !maintenanceEnabled" @update:value="patchDraft({ 'name.zhCN': $event })" /></dd>
              </div>

              <div v-if="resource === 'teammate-buffs'" class="metric">
                <dt>Buff 来源</dt>
                <dd><NInput :value="draftObject.source?.zhCN ?? ''" aria-label="Buff 来源" :disabled="busy || !maintenanceEnabled" @update:value="patchDraft({ 'source.zhCN': $event })" /></dd>
              </div>
              <template v-if="resource === 'field-buffs'">
                <div class="metric">
                  <dt>模式</dt>
                  <dd><NSelect :value="draftObject.period?.modeId ?? 'defense_v5'" aria-label="场地模式" :disabled="busy || !maintenanceEnabled" :options="fieldBuffModeOptions" @update:value="patchFieldBuffPeriod({ modeId: String($event) })" /></dd>
                </div>
                <div class="metric">
                  <dt>版本</dt>
                  <dd><NSelect :value="draftObject.period?.gameVersion ?? '3.0'" aria-label="游戏版本" :disabled="busy || !maintenanceEnabled" :options="fieldBuffVersionOptions" @update:value="patchFieldBuffPeriod({ gameVersion: String($event) })" /></dd>
                </div>
                <div class="metric">
                  <dt>第几期</dt>
                  <dd><NSelect :value="Number(draftObject.period?.phaseNo ?? 1)" aria-label="场地期数" :disabled="busy || !maintenanceEnabled" :options="fieldBuffPhaseOptions" @update:value="patchFieldBuffPeriod({ phaseNo: Number($event) })" /></dd>
                </div>
              </template>
            </dl>
          </div>
          <NInput
            :value="draftText"
            type="textarea"
            placeholder="选择或新建条目"
            aria-label="维护 JSON"
            :disabled="busy || !maintenanceEnabled"
            :autosize="{ minRows: 24, maxRows: 40 }"
            @update:value="updateDraftText"
          />
          <details class="panel">
            <summary class="panel-header">保存预览</summary>
            <pre class="raw">{{ draftText }}</pre>
          </details>
        </section>
      </div>
    </div>
  </section>

  <ConfirmDialog
    v-model:show="showDeleteConfirm"
    title="删除维护条目"
    message="删除后将直接写入数据文件。此操作不能在页面内撤销。"
    confirm-text="删除"
    danger
    @confirm="deleteDraft"
  />
  <ConfirmDialog
    v-model:show="showDiscardConfirm"
    title="放弃未保存修改"
    message="当前修改已保存在本机草稿中。继续切换会删除这份草稿。"
    confirm-text="放弃并继续"
    danger
    @confirm="confirmDiscard"
  />
  <ConfirmDialog
    v-model:show="showLeaveConfirm"
    title="离开维护页"
    message="当前内容尚未保存到数据文件。本地草稿会保留，下次进入维护页时可恢复。"
    confirm-text="离开"
    danger
    @confirm="confirmRouteLeave"
  />
</template>

<style scoped>
.maintenance-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.record-list {
  display: grid;
  gap: 8px;
  max-height: 70vh;
  overflow: auto;
}

.record-list .entity-option {
  grid-template-columns: 1fr;
}

.maintenance-save-strip {
  position: sticky;
  top: 70px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
  box-shadow: var(--app-shadow);
}

.maintenance-save-strip div:first-child {
  display: grid;
  gap: 3px;
}

.maintenance-save-strip span {
  color: var(--app-muted);
}

.raw {
  max-height: 380px;
  overflow: auto;
  padding: 12px;
}

@media (max-width: 900px) {
  .maintenance-layout {
    grid-template-columns: 1fr;
  }
}
</style>
