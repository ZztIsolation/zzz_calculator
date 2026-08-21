<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
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
import { ArrowLeftRight, ChevronRight, Eye, RefreshCw, RotateCcw, Upload, X } from "lucide-vue-next"
import DriveDiscConflictResolver from "@/components/DriveDiscConflictResolver.vue"
import DriveDiscSourceTags from "@/components/DriveDiscSourceTags.vue"
import { useAccountStore } from "@/stores/account"
import { useBuildStore } from "@/stores/build"
import { useCatalogStore } from "@/stores/catalog"
import { useInventoryStore } from "@/stores/inventory"
import {
  applyEnkaImportPlan,
  backfillCurrentEnkaHistory,
  currentEnkaBinding,
  importEnkaShowcase,
  planEnkaRebind,
  applyPlannedEnkaRebind,
  planEnkaImport,
  type EnkaRequestError,
} from "@/utils/enkaImport"
import { labelOf, skillCategoryLabel } from "@/utils/format"
import {
  hasCommittedEnkaUndo,
  recoverPendingEnkaImport,
  undoLastEnkaImport,
} from "@runtime/enka-import-transaction"

const catalogStore = useCatalogStore()
const buildStore = useBuildStore()
const inventoryStore = useInventoryStore()
const accountStore = useAccountStore()
const message = useMessage()

const uid = ref("")
const ownerId = ref("")
const binding = ref<any>(null)
const rebindEligibility = ref<any>({ allowed: false, code: "ENKA_NOT_BOUND" })
const rebindMode = ref(false)
const accountInitializing = ref(true)
const accountContextReady = ref(false)
const accountContextError = ref("")
const loading = ref(false)
const planning = ref(false)
const applying = ref(false)
const undoing = ref(false)
const canUndo = ref(false)
const error = ref("")
const statusNotice = ref("")
const staleResultNotice = ref("")
const blockingErrors = ref<any[]>([])
const cooldownSeconds = ref(0)
const mappedAgents = ref<any[]>([])
const skippedAgents = ref<any[]>([])
const warnings = ref<string[]>([])
const importedHistory = ref<any>({ version: 1, backfillVersion: null, byAgent: {} })
const selectedIds = ref<string[]>([])
const previewPlan = shallowRef<any>(null)
const previewInput = shallowRef<any>(null)
const driveDiscResolutions = ref<Record<string, any>>({})
const loadedUid = ref("")
const loadedOwnerId = ref("")
const loadedPreviousUid = ref("")
const loadedIsRebind = ref(false)
let requestController: AbortController | null = null
let cooldownTimer: ReturnType<typeof setInterval> | null = null
let cooldownDeadline = 0
let showcaseRequestGeneration = 0
let resultContextGeneration = 0
let planRequestGeneration = 0

const busy = computed(() => loading.value || planning.value || applying.value || undoing.value)
const accountLabel = computed(() => ownerId.value ? accountStore.ownerLabelById(ownerId.value) : null)
const accountUnavailable = computed(() => accountInitializing.value
  || !accountContextReady.value
  || accountStore.loadState !== "ready"
  || !ownerId.value
  || !accountLabel.value)
const controlsLocked = computed(() => busy.value || accountUnavailable.value || Boolean(previewPlan.value))
const loadedContextCurrent = computed(() => Boolean(loadedUid.value)
  && uid.value.trim() === loadedUid.value
  && ownerId.value === loadedOwnerId.value
  && accountStore.currentOwnerId === loadedOwnerId.value
  && loadedIsRebind.value === rebindMode.value
  && (!loadedIsRebind.value || loadedPreviousUid.value === String(binding.value?.uid ?? "")))
const hasReadResult = computed(() => Boolean(loadedUid.value) && loadedContextCurrent.value)
const selectedAgents = computed(() => loadedContextCurrent.value
  ? mappedAgents.value.filter(agent => selectedIds.value.includes(agent.agentId))
  : [])
const bindingMismatch = computed(() => binding.value?.uid
  && uid.value.trim()
  && binding.value.uid !== uid.value.trim()
  && !rebindMode.value)
const importedAgents = computed<any[]>(() => (Object.values(importedHistory.value?.byAgent ?? {}) as any[])
  .filter((record: any) => record && typeof record === "object")
  .sort((left: any, right: any) => {
    const leftPartial = left.completeness === "partial"
    const rightPartial = right.completeness === "partial"
    if (leftPartial !== rightPartial) return leftPartial ? 1 : -1
    const leftTime = Date.parse(String(left.lastImportedAt ?? "")) || 0
    const rightTime = Date.parse(String(right.lastImportedAt ?? "")) || 0
    if (leftTime !== rightTime) return rightTime - leftTime
    return String(left.agentName ?? "").localeCompare(String(right.agentName ?? ""), "zh-CN")
  }))
const importedAgentIds = computed(() => new Set(importedAgents.value.map((record: any) => String(record.agentId))))

function hasUnresolvedConflicts(plan: any): boolean {
  return Boolean(plan?.hasUnresolvedConflicts || (Array.isArray(plan?.conflicts) && plan.conflicts.length > 0))
}

function blockingErrorText(item: any): string {
  const code = String(item?.code ?? "")
  const messages: Record<string, string> = {
    INVALID_GAME_UID: "游戏 UID 格式无效，请重新输入后读取展柜。",
    LEGACY_ENKA_UID_MISMATCH: "检测到属于其他游戏 UID 的旧展柜数据，本次导入已停止。",
    AGENT_SOURCE_UID_MISSING: "角色数据缺少来源 UID，本次导入已停止。",
    AGENT_SOURCE_UID_MISMATCH: "角色数据的来源 UID 与本次读取不一致，本次导入已停止。",
    ENKA_PRESET_AGENT_MISMATCH: "部分展柜套装与所属角色不一致，本次导入已停止。",
    ENKA_DISC_AGENT_MISSING: "部分驱动盘缺少所属角色信息，本次导入已停止。",
    ENKA_DISC_AGENT_MISMATCH: "部分驱动盘与所属角色不一致，本次导入已停止。",
    ENKA_DISC_SOURCE_MISSING: "部分驱动盘缺少可验证的展柜来源，本次导入已停止。",
    ENKA_DISC_UID_MISSING: "部分驱动盘缺少来源 UID，本次导入已停止。",
    ENKA_DISC_UID_MISMATCH: "部分驱动盘的来源 UID 与本次读取不一致，本次导入已停止。",
    ENKA_DISC_IDENTITY_MISSING: "部分驱动盘缺少完整身份信息，本次导入已停止。",
    ENKA_EQUIPMENT_IDENTITY_CONFLICT: "同一驱动盘身份对应了互相矛盾的角色、槽位或套装，本次导入已停止。",
    ENKA_EQUIPMENT_IMMUTABLE_IDENTITY_CONFLICT: "已有驱动盘的固定身份信息与本次展柜数据矛盾，本次导入已停止。",
    ENKA_CANONICAL_ID_COLLISION: "展柜驱动盘的存储身份已被其他数据占用，本次导入已停止。",
    ENKA_CANONICAL_LOADOUT_ID_COLLISION: "展柜套装的存储身份已被其他套装占用，本次导入已停止。",
    ENKA_DRIVE_DISC_IDENTITY_INVALID: "展柜驱动盘身份异常，本次导入已停止。",
    ENKA_REBIND_BASELINE_INCOMPLETE: "旧展柜导入缺少完整回退记录，无法安全更换 UID。",
    ENKA_REBIND_BINDING_CHANGED: "当前账号绑定状态已变化，请重新开始换绑。",
    ENKA_REBIND_SAME_UID: "新 UID 与当前绑定 UID 相同，请取消换绑后直接导入。",
    ENKA_REBIND_NO_AGENTS: "新 UID 没有可导入的已收录角色，无法执行换绑。",
    ENKA_REBIND_UNTRACKED_DATA: "检测到未纳入绑定周期记录的旧展柜数据，无法安全更换 UID。",
  }
  return messages[code] ?? "展柜数据存在无法安全识别的身份冲突，请重新读取后再试。"
}

function planBlockingErrors(plan: any): any[] {
  return Array.isArray(plan?.blockingErrors) ? plan.blockingErrors.filter(Boolean) : []
}

function hasBlockingErrors(plan: any): boolean {
  return planBlockingErrors(plan).length > 0
}

function clearCooldown() {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = null
  cooldownDeadline = 0
  cooldownSeconds.value = 0
}

function startCooldown(seconds: number) {
  clearCooldown()
  cooldownDeadline = Date.now() + Math.max(1, Math.ceil(seconds)) * 1000
  const update = () => {
    cooldownSeconds.value = Math.max(0, Math.ceil((cooldownDeadline - Date.now()) / 1000))
    if (cooldownSeconds.value === 0) clearCooldown()
  }
  update()
  cooldownTimer = setInterval(update, 1000)
}

function resetResult() {
  resultContextGeneration += 1
  planRequestGeneration += 1
  planning.value = false
  mappedAgents.value = []
  skippedAgents.value = []
  warnings.value = []
  selectedIds.value = []
  previewPlan.value = null
  previewInput.value = null
  driveDiscResolutions.value = {}
  blockingErrors.value = []
  loadedUid.value = ""
  loadedOwnerId.value = ""
  loadedPreviousUid.value = ""
  loadedIsRebind.value = false
}

function invalidateLoadedResult(notice: string) {
  showcaseRequestGeneration += 1
  requestController?.abort()
  requestController = null
  loading.value = false
  resetResult()
  error.value = ""
  statusNotice.value = ""
  staleResultNotice.value = notice
}

async function refreshBindingAndUndo(expectedOwnerId = ownerId.value || accountStore.currentOwnerId) {
  if (!expectedOwnerId) throw new Error("账号信息尚未加载完成。")
  const current = await currentEnkaBinding()
  if (current.ownerId !== expectedOwnerId || accountStore.currentOwnerId !== expectedOwnerId) {
    throw new Error("当前账号已切换，请重新加载导入数据。")
  }
  const nextCanUndo = await hasCommittedEnkaUndo(current.ownerId)
  if (accountStore.currentOwnerId !== expectedOwnerId) {
    throw new Error("当前账号已切换，请重新加载导入数据。")
  }
  ownerId.value = current.ownerId
  binding.value = current.binding
  rebindEligibility.value = current.rebindEligibility ?? { allowed: false, code: "ENKA_REBIND_BASELINE_INCOMPLETE" }
  importedHistory.value = current.history ?? { version: 1, backfillVersion: null, byAgent: {} }
  canUndo.value = nextCanUndo
}

let accountContextGeneration = 0

async function initializeAccountContext(options: { preserveNotice?: boolean } = {}) {
  const generation = ++accountContextGeneration
  showcaseRequestGeneration += 1
  accountInitializing.value = true
  accountContextReady.value = false
  accountContextError.value = ""
  requestController?.abort()
  requestController = null
  loading.value = false
  resetResult()
  binding.value = null
  rebindEligibility.value = { allowed: false, code: "ENKA_NOT_BOUND" }
  rebindMode.value = false
  importedHistory.value = { version: 1, backfillVersion: null, byAgent: {} }
  canUndo.value = false
  error.value = ""
  statusNotice.value = ""
  if (!options.preserveNotice) staleResultNotice.value = ""
  try {
    await accountStore.ensureLoaded()
    if (generation !== accountContextGeneration) return
    const expectedOwnerId = accountStore.currentOwnerId
    if (!expectedOwnerId) throw new Error("账号信息尚未加载完成。")
    ownerId.value = expectedOwnerId
    const recovery = await recoverPendingEnkaImport(expectedOwnerId)
    if (generation !== accountContextGeneration || accountStore.currentOwnerId !== expectedOwnerId) return
    if (recovery === "rolled-back") {
      statusNotice.value = "检测到未完成的展柜数据导入，已自动回滚。"
      message.warning(statusNotice.value)
    }
    if (recovery === "committed") {
      statusNotice.value = "检测到已完成的展柜数据导入，事务状态已恢复。"
      message.info(statusNotice.value)
    }
    await Promise.all([inventoryStore.load(), catalogStore.load()])
    if (generation !== accountContextGeneration) return
    if ((inventoryStore as any).error) throw new Error((inventoryStore as any).error)
    if (!(catalogStore as any).error && (catalogStore.displayAgents ?? []).length) {
      await backfillCurrentEnkaHistory(expectedOwnerId, catalogStore.displayAgents)
      if (generation !== accountContextGeneration || accountStore.currentOwnerId !== expectedOwnerId) return
    }
    await refreshBindingAndUndo(expectedOwnerId)
    if (generation !== accountContextGeneration) return
    uid.value = binding.value?.uid ?? ""
    accountContextReady.value = true
  } catch (caught) {
    if (generation !== accountContextGeneration) return
    if (accountStore.loadState !== "error") {
      accountContextError.value = caught instanceof Error ? caught.message : String(caught)
    }
  } finally {
    if (generation === accountContextGeneration) accountInitializing.value = false
  }
}

async function retryAccountContext() {
  if (accountStore.loadState === "error") {
    accountInitializing.value = true
    try {
      await accountStore.ensureLoaded({ force: true })
    } catch {
      accountInitializing.value = false
      return
    }
  }
  await initializeAccountContext()
}

function startRebind() {
  if (!binding.value || busy.value || accountUnavailable.value) return
  if (!rebindEligibility.value?.allowed) {
    error.value = rebindEligibility.value?.message
      ?? "该账号的旧展柜导入缺少完整回退记录，无法安全更换 UID。"
    return
  }
  invalidateLoadedResult("请输入新的游戏 UID，读取后将先展示完整换绑预览。")
  rebindMode.value = true
  uid.value = ""
  staleResultNotice.value = "请输入新的游戏 UID，读取后将先展示完整换绑预览。"
}

function cancelRebind() {
  if (busy.value) return
  invalidateLoadedResult("")
  rebindMode.value = false
  uid.value = binding.value?.uid ?? ""
  staleResultNotice.value = ""
}

async function loadShowcase() {
  if (accountUnavailable.value || busy.value || cooldownSeconds.value > 0) return
  const value = uid.value.trim()
  if (!/^\d{8,12}$/.test(value)) {
    error.value = "UID 必须是 8–12 位数字。"
    return
  }
  const requestOwnerId = ownerId.value
  const requestIsRebind = rebindMode.value
  const requestPreviousUid = requestIsRebind ? String(binding.value?.uid ?? "") : ""
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller
  const requestGeneration = ++showcaseRequestGeneration
  loading.value = true
  error.value = ""
  statusNotice.value = ""
  staleResultNotice.value = ""
  resetResult()
  try {
    await refreshBindingAndUndo(requestOwnerId)
    if (requestGeneration !== showcaseRequestGeneration
      || uid.value.trim() !== value
      || ownerId.value !== requestOwnerId
      || accountStore.currentOwnerId !== requestOwnerId
      || rebindMode.value !== requestIsRebind) return
    if (requestIsRebind) {
      if (!binding.value || String(binding.value.uid) !== requestPreviousUid) {
        error.value = "当前账号绑定状态已变化，请重新开始换绑。"
        return
      }
      if (!rebindEligibility.value?.allowed) {
        error.value = rebindEligibility.value?.message
          ?? "该账号缺少完整回退记录，无法安全更换 UID。"
        return
      }
      if (value === requestPreviousUid) {
        error.value = "新 UID 与当前绑定 UID 相同，请取消换绑后直接读取展柜。"
        return
      }
    } else if (binding.value && binding.value.uid !== value) {
      error.value = `当前账号已绑定 UID ${binding.value.uid}，请切换或新建 Calculator 账号。`
      return
    }

    const result = await importEnkaShowcase(value, controller.signal)
    if (requestGeneration !== showcaseRequestGeneration
      || uid.value.trim() !== value
      || ownerId.value !== requestOwnerId
      || accountStore.currentOwnerId !== requestOwnerId
      || rebindMode.value !== requestIsRebind) return
    const resultUid = String(result.uid ?? "").trim()
    if (!/^\d{8,12}$/.test(resultUid) || resultUid !== value) {
      throw new Error("Enka 返回的 UID 与本次读取不一致，已停止导入，请重新读取展柜。")
    }
    mappedAgents.value = result.mappedAgents.map((agent: any) => ({ ...agent, sourceUid: resultUid }))
    skippedAgents.value = result.skippedAgents
    warnings.value = result.warnings
    selectedIds.value = result.mappedAgents.map((agent: any) => agent.agentId)
    loadedUid.value = resultUid
    loadedOwnerId.value = requestOwnerId
    loadedIsRebind.value = requestIsRebind
    loadedPreviousUid.value = requestPreviousUid
    if (!result.mappedAgents.length && !result.skippedAgents.length) {
      error.value = "Enka 没有返回公开展柜角色，请确认已开启角色详情展示。"
    } else if (requestIsRebind && !result.mappedAgents.length) {
      error.value = "新 UID 没有可导入的已收录角色，不能执行换绑。"
    }
  } catch (caught) {
    if (requestGeneration === showcaseRequestGeneration && (caught as Error)?.name !== "AbortError") {
      const requestError = caught as EnkaRequestError
      error.value = caught instanceof Error ? caught.message : String(caught)
      if (requestError.retryAfter && (requestError.status === 429 || requestError.status === 503 || requestError.code)) {
        startCooldown(requestError.retryAfter)
      }
    }
  } finally {
    if (requestGeneration === showcaseRequestGeneration) {
      loading.value = false
      if (requestController === controller) requestController = null
    }
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

function importedAgentSummary(record: any): string {
  const snapshot = record?.snapshot ?? {}
  if (record?.completeness === "partial") {
    return `历史记录（详情不完整） / 驱动盘 ${snapshot.driveDiscCount ?? 0}/6`
  }
  const parts = []
  if (snapshot.agentLevel != null) parts.push(`Lv.${snapshot.agentLevel}`)
  if (snapshot.cinemaLevel != null) parts.push(`影画 ${snapshot.cinemaLevel}`)
  if (snapshot.coreSkillLevel != null) {
    const coreLevel = Number(snapshot.coreSkillLevel)
    const coreLabel = coreLevel === 0
      ? "未强化"
      : coreLevel >= 1 && coreLevel <= 6
        ? String.fromCharCode(64 + coreLevel)
        : snapshot.coreSkillLevel
    parts.push(`核心技 ${coreLabel}`)
  }
  if (snapshot.wEngine) {
    parts.push(`${snapshot.wEngine.name} Lv.${snapshot.wEngine.level} P${snapshot.wEngine.modificationLevel}`)
  }
  parts.push(`驱动盘 ${snapshot.driveDiscCount ?? 0}/${snapshot.driveDiscSourceCount ?? "?"}`)
  return parts.join(" / ")
}

function importedAtText(record: any): string {
  if (!record?.lastImportedAt) return "导入时间不可确认"
  const date = new Date(record.lastImportedAt)
  if (!Number.isFinite(date.getTime())) return "导入时间不可确认"
  const pad = (value: number) => String(value).padStart(2, "0")
  return `最近导入 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseRecord(value: unknown): Record<string, any> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function formatSkillLevels(value: unknown): string {
  const record = parseRecord(value)
  if (!record) return String(value ?? "未设置")
  const entries = Object.entries(record)
  if (!entries.length) return "未设置"
  return entries.map(([category, level]) => `${skillCategoryLabel(category)} ${level}`).join("、")
}

function wEngineName(value: unknown, agent: any, position: "before" | "after"): string {
  const raw = String(value ?? "").trim()
  if (!raw || raw === "未设置") return "未设置"
  const engine = (catalogStore.displayWEngines ?? []).find((item: any) => String(item?.id) === raw)
  if (engine) return labelOf(engine)
  if (position === "after" && agent?.drive !== undefined) {
    const imported = mappedAgents.value.find(item => item.agentId === agent.agentId)?.wEngine
    if (imported?.name) return String(imported.name)
  }
  return position === "before" ? "原音擎" : "展柜音擎"
}

function loadoutName(value: unknown, agent: any, position: "before" | "after"): string {
  const raw = String(value ?? "").trim()
  if (!raw || raw === "未设置") return "未选择"
  const loadout = ((inventoryStore as any).loadouts ?? []).find((item: any) => String(item?.id) === raw)
  if (loadout?.name) return String(loadout.name)
  return position === "after" ? `展柜佩戴套装 - ${agent.agentName}` : "原有套装"
}

function changeValue(change: any, value: unknown, position: "before" | "after", agent: any): string {
  if (change.field === "skillLevels") return formatSkillLevels(value)
  if (change.field === "wEngineId") return wEngineName(value, agent, position)
  if (["selectedLoadoutId", "loadoutId"].includes(change.field)) return loadoutName(value, agent, position)
  if (change.field === "discMode") {
    return ({ manual: "自选套装", loadout: "已有套装", optimized: "优化结果" } as Record<string, string>)[String(value)]
      ?? (position === "before" ? "原驱动盘方案" : "展柜佩戴套装")
  }
  const record = parseRecord(value)
  if (record) return Object.keys(record).length ? `${Object.keys(record).length} 项配置` : "未设置"
  const text = String(value ?? "未设置")
  return /^[a-z][A-Za-z0-9_.:-]*$/.test(text) ? (position === "before" ? "原配置" : "展柜配置") : text
}

function orderedChanges(agent: any): any[] {
  const priorities: Record<string, number> = {
    manualDriveDiscIdsBySlot: 0,
    driveDiscLoadout: 1,
    selectedLoadoutId: 2,
    discMode: 3,
    wEngineId: 4,
    wEngineLevel: 5,
    wEngineModificationLevel: 6,
    skillLevels: 7,
  }
  return [...(agent?.changes ?? [])].sort((left, right) => (priorities[left.field] ?? 20) - (priorities[right.field] ?? 20))
}

function driveOperationRows(drive: any): Array<{ label: string, disc?: any }> {
  const operations = drive?.operations ?? {}
  const discLabel = (item: any) => `${item.partition ?? "?"}号位${item.setName ? ` ${item.setName}` : ""}`
  return [
    ...(operations.added ?? []).map((item: any) => ({ label: `新增：${discLabel(item)}`, disc: item })),
    ...(operations.updated ?? []).map((item: any) => ({ label: `更新：${discLabel(item)}`, disc: item })),
    ...(operations.sourceMerged ?? []).map((item: any) => ({ label: `合并来源：${discLabel(item)}`, disc: item })),
    ...(operations.migratedDiscs ?? []).map((item: any) => ({ label: `迁移旧展柜记录：${discLabel(item)}`, disc: item })),
    ...(operations.migratedLoadouts ?? []).map(() => ({ label: "迁移旧展柜套装引用" })),
    ...(operations.unequipped ?? []).map((item: any) => ({ label: `解除装备：${discLabel(item)}`, disc: item })),
  ]
}

type FrozenImportContext = {
  uid: string
  ownerId: string
  generation: number
  agentIds: string[]
  isRebind: boolean
  previousUid: string
}

function frozenImportContext(agents: any[]): FrozenImportContext {
  return {
    uid: loadedUid.value,
    ownerId: loadedOwnerId.value,
    generation: resultContextGeneration,
    agentIds: agents.map(agent => String(agent.agentId)),
    isRebind: loadedIsRebind.value,
    previousUid: loadedPreviousUid.value,
  }
}

function selectionMatchesSnapshot(snapshot: FrozenImportContext): boolean {
  if (resultContextGeneration !== snapshot.generation) return false
  if (loadedUid.value !== snapshot.uid || uid.value.trim() !== snapshot.uid) return false
  if (loadedOwnerId.value !== snapshot.ownerId || ownerId.value !== snapshot.ownerId || accountStore.currentOwnerId !== snapshot.ownerId) return false
  if (loadedIsRebind.value !== snapshot.isRebind || rebindMode.value !== snapshot.isRebind) return false
  if (snapshot.isRebind && (loadedPreviousUid.value !== snapshot.previousUid
    || String(binding.value?.uid ?? "") !== snapshot.previousUid)) return false
  const currentIds = selectedIds.value
  return currentIds.length === snapshot.agentIds.length
    && snapshot.agentIds.every(agentId => currentIds.includes(agentId))
}

function planMatchesSnapshot(plan: any, snapshot: FrozenImportContext): boolean {
  return selectionMatchesSnapshot(snapshot)
    && String(plan?.uid ?? "") === snapshot.uid
    && String(plan?.ownerId ?? "") === snapshot.ownerId
    && Boolean(plan?.kind === "enka-rebind") === snapshot.isRebind
    && (!snapshot.isRebind || String(plan?.previousUid ?? "") === snapshot.previousUid)
}

async function openPreview() {
  if (accountUnavailable.value || !loadedContextCurrent.value || !selectedAgents.value.length) return
  const frozenAgents = JSON.parse(JSON.stringify(selectedAgents.value))
  const snapshot = frozenImportContext(frozenAgents)
  const planningGeneration = ++planRequestGeneration
  planning.value = true
  error.value = ""
  statusNotice.value = ""
  blockingErrors.value = []
  previewInput.value = {
    ...snapshot,
    agents: frozenAgents,
    skippedAgents: JSON.parse(JSON.stringify(skippedAgents.value)),
    warnings: [...warnings.value],
  }
  driveDiscResolutions.value = {}
  try {
    const plan = snapshot.isRebind
      ? await planEnkaRebind(snapshot.previousUid, snapshot.uid, frozenAgents, driveDiscResolutions.value)
      : await planEnkaImport(snapshot.uid, frozenAgents, driveDiscResolutions.value)
    if (planningGeneration !== planRequestGeneration) return
    if (!planMatchesSnapshot(plan, snapshot)) {
      previewInput.value = null
      error.value = "UID、账号或角色选择已变化，请重新生成预览。"
      return
    }
    blockingErrors.value = planBlockingErrors(plan)
    previewPlan.value = {
      ...plan,
      skippedAgents: previewInput.value.skippedAgents,
      warnings: [...new Set([...previewInput.value.warnings, ...(plan.warnings ?? [])])],
    }
  } catch (caught) {
    if (planningGeneration === planRequestGeneration) {
      error.value = caught instanceof Error ? caught.message : String(caught)
    }
  } finally {
    if (planningGeneration === planRequestGeneration) planning.value = false
  }
}

function closePreview() {
  if (!applying.value && !planning.value) {
    planRequestGeneration += 1
    previewPlan.value = null
    previewInput.value = null
    driveDiscResolutions.value = {}
  }
}

async function refreshAfterImport() {
  await Promise.all([inventoryStore.load(), catalogStore.load(), refreshBindingAndUndo()])
  buildStore.initialize(catalogStore.catalog, catalogStore.meta)
}

async function commitImportPlan(plan: any) {
  applying.value = true
  try {
    const isRebind = plan?.kind === "enka-rebind"
    const result = isRebind
      ? await applyPlannedEnkaRebind(plan)
      : await applyEnkaImportPlan(plan)
    previewPlan.value = null
    previewInput.value = null
    blockingErrors.value = []
    if (plan?.isNoop || result?.isNoop) {
      statusNotice.value = "当前选择已经是最新数据。"
      message.info(statusNotice.value)
      return
    }
    try {
      await refreshAfterImport()
      if (isRebind) {
        rebindMode.value = false
        uid.value = binding.value?.uid ?? plan.uid
        loadedIsRebind.value = false
        loadedPreviousUid.value = ""
      }
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught)
      error.value = `导入已提交，但页面刷新失败：${reason}`
      message.warning(error.value)
      return
    }
    statusNotice.value = isRebind
      ? `已从 UID ${plan.previousUid} 更换为 ${plan.uid}，旧展柜数据已安全撤回。`
      : `已导入 ${plan.agents.length} 个角色，库存与配置已同步。`
    message.success(statusNotice.value)
  } finally {
    applying.value = false
  }
}

/**
 * Direct import still builds the same frozen plan as the preview flow. It only
 * omits rendering the modal; the transaction layer remains the single writer.
 */
async function confirmImportDirect() {
  if (accountUnavailable.value || !loadedContextCurrent.value || !selectedAgents.value.length || busy.value || previewPlan.value) return
  if (loadedIsRebind.value) {
    await openPreview()
    return
  }
  const frozenUid = loadedUid.value
  const frozenAgents = JSON.parse(JSON.stringify(selectedAgents.value))
  const snapshot = frozenImportContext(frozenAgents)
  planning.value = true
  error.value = ""
  statusNotice.value = ""
  blockingErrors.value = []
  try {
    const plan = await planEnkaImport(frozenUid, frozenAgents, {})
    if (!planMatchesSnapshot(plan, snapshot)) {
      error.value = "UID 或角色选择已变化，请重新读取展柜后再导入。"
      message.error(error.value)
      return
    }
    blockingErrors.value = planBlockingErrors(plan)
    if (hasBlockingErrors(plan)) {
      error.value = "展柜数据存在无法安全处理的身份冲突，本次未写入任何数据。"
      return
    }
    const conflicts = Array.isArray(plan.conflicts) ? plan.conflicts : []
    if (hasUnresolvedConflicts(plan)) {
      const conflictCount = conflicts.length || 1
      error.value = `检测到 ${conflictCount} 个导入冲突，请使用“预览更改”处理后再导入。`
      message.warning(error.value)
      return
    }
    await commitImportPlan(plan)
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : String(caught)
    error.value = reason
    message.error(reason)
  } finally {
    planning.value = false
  }
}

async function resolveDriveDiscConflict(resolution: any) {
  const input = previewInput.value
  if (!input || planning.value || applying.value || accountUnavailable.value) return
  const snapshot: FrozenImportContext = {
    uid: String(input.uid),
    ownerId: String(input.ownerId),
    generation: Number(input.generation),
    agentIds: [...(input.agentIds ?? [])].map(String),
    isRebind: Boolean(input.isRebind),
    previousUid: String(input.previousUid ?? ""),
  }
  if (!selectionMatchesSnapshot(snapshot)) {
    error.value = "UID、账号或角色选择已变化，请重新生成预览。"
    previewPlan.value = null
    previewInput.value = null
    return
  }
  driveDiscResolutions.value = {
    ...driveDiscResolutions.value,
    [resolution.key]: resolution.action === "update"
      ? { action: "update", existingId: resolution.existingId }
      : { action: "add" },
  }
  const planningGeneration = ++planRequestGeneration
  planning.value = true
  error.value = ""
  try {
    const plan = snapshot.isRebind
      ? await planEnkaRebind(snapshot.previousUid, input.uid, input.agents, driveDiscResolutions.value)
      : await planEnkaImport(input.uid, input.agents, driveDiscResolutions.value)
    if (planningGeneration !== planRequestGeneration) return
    if (!planMatchesSnapshot(plan, snapshot)) {
      previewPlan.value = null
      previewInput.value = null
      error.value = "UID、账号或角色选择已变化，请重新生成预览。"
      return
    }
    blockingErrors.value = planBlockingErrors(plan)
    previewPlan.value = {
      ...plan,
      skippedAgents: input.skippedAgents,
      warnings: [...new Set([...input.warnings, ...(plan.warnings ?? [])])],
    }
  } catch (caught) {
    if (planningGeneration === planRequestGeneration) {
      error.value = caught instanceof Error ? caught.message : String(caught)
      message.error(error.value)
    }
  } finally {
    if (planningGeneration === planRequestGeneration) planning.value = false
  }
}

async function confirmImport() {
  const plan = previewPlan.value
  if (!plan || applying.value || planning.value || accountUnavailable.value || hasBlockingErrors(plan) || hasUnresolvedConflicts(plan)) return
  const input = previewInput.value
  const snapshot: FrozenImportContext | null = input ? {
    uid: String(input.uid),
    ownerId: String(input.ownerId),
    generation: Number(input.generation),
    agentIds: [...(input.agentIds ?? [])].map(String),
    isRebind: Boolean(input.isRebind),
    previousUid: String(input.previousUid ?? ""),
  } : null
  if (!snapshot || !planMatchesSnapshot(plan, snapshot)) {
    resetResult()
    error.value = "UID、账号或角色选择已变化，请重新生成预览。"
    message.error(error.value)
    return
  }
  error.value = ""
  try {
    await commitImportPlan(plan)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
    message.error(error.value)
  }
}

async function undoImport() {
  if (undoing.value || accountUnavailable.value) return
  undoing.value = true
  error.value = ""
  statusNotice.value = ""
  try {
    await undoLastEnkaImport(ownerId.value)
    resetResult()
    canUndo.value = false
    try {
      await Promise.all([inventoryStore.load(), catalogStore.load(), refreshBindingAndUndo()])
      buildStore.initialize(catalogStore.catalog, catalogStore.meta)
      rebindMode.value = false
      uid.value = binding.value?.uid ?? ""
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught)
      error.value = `导入已撤销，但页面刷新失败：${reason}`
      message.warning(error.value)
      return
    }
    statusNotice.value = "最近一次展柜数据导入已撤销。"
    message.success("最近一次展柜数据导入已撤销。")
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
    message.error(error.value)
  } finally {
    undoing.value = false
  }
}

onMounted(() => void initializeAccountContext())

watch(() => accountStore.currentOwnerId, (nextOwnerId, previousOwnerId) => {
  if (!nextOwnerId || nextOwnerId === previousOwnerId || accountInitializing.value && !ownerId.value) return
  invalidateLoadedResult("当前账号已切换，请重新读取展柜。")
  void initializeAccountContext({ preserveNotice: true })
})

watch(uid, nextUid => {
  if (!loadedUid.value || nextUid.trim() === loadedUid.value) return
  invalidateLoadedResult("UID 已变化，请重新读取展柜。")
})

onBeforeUnmount(() => {
  accountContextGeneration += 1
  showcaseRequestGeneration += 1
  planRequestGeneration += 1
  requestController?.abort()
  clearCooldown()
})
</script>

<template>
  <section class="import-view" aria-labelledby="import-title" aria-describedby="import-description">
    <header class="page-header">
      <div>
        <h1 id="import-title">展柜数据导入</h1>
        <p v-if="accountStore.loadState === 'error'">当前账号：加载失败</p>
        <p v-else-if="accountLabel">当前账号：{{ accountLabel }}<span v-if="binding"> / 已绑定 UID {{ binding.uid }}</span></p>
        <p v-else>当前账号：加载中…</p>
        <p id="import-description" class="import-description">输入游戏 UID，读取公开展柜中的角色、音擎和驱动盘；确认后同步到当前 Calculator 账号。每个账号同时绑定一个 UID，可通过安全换绑撤回旧 UID 数据。最近一次成功导入可撤销。展柜更新后请等待1~2分钟再重新读取。</p>
        <p class="import-impact"><strong>会覆盖：</strong>角色等级、影画、技能、成功映射的音擎、展柜佩戴套装和自选槽位。</p>
        <p class="import-impact"><strong>会保留：</strong>Buff、伤害事件、敌人设置、优化设置及用户自定义套装。</p>
      </div>
      <NButton v-if="canUndo" secondary :loading="undoing" :disabled="controlsLocked" @click="undoImport">
        <template #icon><RotateCcw :size="16" /></template>
        撤销上次导入
      </NButton>
    </header>

    <NAlert v-if="accountStore.loadState === 'error'" type="error" title="账号信息加载失败">
      {{ accountStore.error }}
      <NButton secondary size="small" :loading="accountInitializing" @click="retryAccountContext">重试</NButton>
    </NAlert>
    <NAlert v-else-if="accountContextError" type="error" title="账号上下文初始化失败">
      {{ accountContextError }}
      <NButton secondary size="small" :loading="accountInitializing" @click="retryAccountContext">重试</NButton>
    </NAlert>
    <NAlert v-if="staleResultNotice" type="warning" :title="staleResultNotice" />
    <NAlert v-if="statusNotice" type="info" :title="statusNotice" />

    <NCard size="small" class="import-tool">
      <label class="field-label" for="enka-uid">游戏 UID</label>
      <div class="uid-row">
        <NInput
          v-model:value="uid"
          :input-props="{ id: 'enka-uid', 'aria-label': '游戏 UID', inputmode: 'numeric' }"
          placeholder="8–12 位数字"
          :disabled="controlsLocked || Boolean(binding && !rebindMode)"
          style="max-width: 280px"
          @keyup.enter="loadShowcase"
        />
        <NButton
          type="primary"
          :loading="loading"
          :disabled="controlsLocked || cooldownSeconds > 0 || !uid.trim() || bindingMismatch"
          @click="loadShowcase"
        >
          <template #icon><RefreshCw :size="16" /></template>
          {{ rebindMode ? '读取新展柜' : '读取展柜' }}
        </NButton>
        <NButton
          v-if="binding && !rebindMode"
          secondary
          :disabled="controlsLocked || !rebindEligibility?.allowed"
          title="更换当前账号绑定的游戏 UID"
          @click="startRebind"
        >
          <template #icon><ArrowLeftRight :size="16" /></template>
          更换 UID
        </NButton>
        <NButton v-if="rebindMode" secondary :disabled="controlsLocked" @click="cancelRebind">
          <template #icon><X :size="16" /></template>
          取消换绑
        </NButton>
      </div>
      <NAlert v-if="rebindMode && binding" type="warning" class="block">
        正在准备将 UID {{ binding.uid }} 更换为新 UID。读取和选择角色不会修改本地数据，确认前将显示完整清理预览。
      </NAlert>
      <NAlert
        v-else-if="binding && !rebindEligibility?.allowed"
        type="warning"
        class="block"
        title="当前账号暂不能安全换绑"
      >
        {{ rebindEligibility?.message ?? '旧展柜导入缺少完整回退记录，无法安全更换 UID。' }}
        请新建 Calculator 账号，或删除旧账号后重新创建。
      </NAlert>
      <NAlert v-if="bindingMismatch" type="error" class="block">
        当前账号已绑定 UID {{ binding.uid }}。请前往<RouterLink to="/accounts">账号页</RouterLink>切换或新建账号。
      </NAlert>
      <NAlert
        v-if="cooldownSeconds > 0"
        type="warning"
        class="block"
        :title="`Enka 服务暂时不可用，请在 ${cooldownSeconds} 秒后重试。`"
      />
      <NAlert v-if="error" type="error" :title="error" class="block" />
      <NAlert
        v-for="(item, index) in blockingErrors"
        :key="`blocking-${index}-${blockingErrorText(item)}`"
        type="error"
        class="block"
        title="无法安全导入"
      >
        {{ blockingErrorText(item) }}
      </NAlert>
      <NAlert v-for="(warning, index) in warnings" :key="`${index}-${warning}`" type="warning" :title="warning" class="block" />
    </NCard>

    <section class="results" aria-labelledby="imported-agents-title">
      <div class="list-header">
        <h2 id="imported-agents-title">已导入角色（{{ importedAgents.length }}）</h2>
      </div>
      <div v-if="importedAgents.length" class="agent-list imported-agent-list">
        <div v-for="record in importedAgents" :key="record.agentId" class="agent-row imported-agent-row">
          <span class="agent-info">
            <strong>{{ record.agentName }}</strong>
            <span class="meta">{{ importedAgentSummary(record) }}</span>
            <span class="meta imported-time">{{ importedAtText(record) }}</span>
          </span>
          <NTag size="small" type="success">已导入</NTag>
        </div>
      </div>
      <p v-else class="empty-state">当前账号还没有成功导入的展柜角色。</p>
    </section>

    <section v-if="hasReadResult" class="results" aria-labelledby="showcase-title">
      <div class="list-header">
        <h2 id="showcase-title">本次读取角色（{{ mappedAgents.length }}）</h2>
        <div v-if="mappedAgents.length" class="list-actions">
          <NButton
            v-if="loadedIsRebind"
            type="primary"
            :loading="planning || applying"
            :disabled="controlsLocked || blockingErrors.length > 0 || !selectedIds.length"
            @click="openPreview"
          >
            <template #icon><ArrowLeftRight :size="16" /></template>
            预览并更换 UID
          </NButton>
          <NButton
            v-else
            type="primary"
            :loading="planning || applying"
            :disabled="controlsLocked || blockingErrors.length > 0 || !selectedIds.length"
            @click="confirmImportDirect"
          >
            <template #icon><Upload :size="16" /></template>
            确认导入
          </NButton>
          <NButton v-if="!loadedIsRebind" secondary :loading="planning" :disabled="controlsLocked || !selectedIds.length" @click="openPreview">
            <template #icon><Eye :size="16" /></template>
            预览更改（{{ selectedIds.length }} 个角色）
          </NButton>
        </div>
      </div>
      <NAlert
        v-if="skippedAgents.length"
        type="warning"
        :title="`有 ${skippedAgents.length} 个角色暂未收录，已跳过。`"
      />
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
          <NTag v-if="importedAgentIds.has(String(agent.agentId))" size="small" type="success">已导入</NTag>
        </label>
      </div>
    </section>

    <NModal
      :show="Boolean(previewPlan)"
      :mask-closable="!applying && !planning"
      :close-on-esc="!applying && !planning"
      @update:show="shown => { if (!shown) closePreview() }"
    >
      <NCard
        class="preview-modal"
        :title="previewPlan?.kind === 'enka-rebind' ? '确认更换游戏 UID' : '确认展柜数据导入'"
        role="dialog"
        aria-modal="true"
        :aria-label="previewPlan?.kind === 'enka-rebind' ? '确认更换游戏 UID' : '确认展柜数据导入'"
      >
        <NSpin :show="applying">
          <div v-if="previewPlan" class="preview-content">
            <NAlert
              type="info"
              :title="previewPlan.kind === 'enka-rebind'
                ? `UID ${previewPlan.previousUid} → ${previewPlan.uid} / ${previewPlan.agents.length} 个新角色 / ${previewPlan.changeCount} 项更改`
                : `UID ${previewPlan.uid} / ${previewPlan.agents.length} 个角色 / ${previewPlan.changeCount} 项更改`"
            />
            <div v-if="previewPlan.kind === 'enka-rebind' && previewPlan.rebind" class="rebind-summary">
              <strong>旧 UID 数据清理</strong>
              <ul>
                <li>删除 {{ previewPlan.rebind.deletedDriveDiscs }} 张仅属于旧 UID 的驱动盘</li>
                <li>保留 {{ previewPlan.rebind.detachedDriveDiscs }} 张 Scanner、JSON 或手动共用盘，并移除 Enka 来源</li>
                <li>删除 {{ previewPlan.rebind.deletedLoadouts }} 个旧展柜套装</li>
                <li>恢复 {{ previewPlan.rebind.restoredConfigFields }} 个配置字段，保留 {{ previewPlan.rebind.preservedUserFields }} 个用户后续修改字段</li>
                <li v-if="previewPlan.rebind.cleanedReferenceAgentIds?.length">清理 {{ previewPlan.rebind.cleanedReferenceAgentIds.length }} 个角色中的失效盘引用</li>
              </ul>
            </div>
            <NAlert v-if="error" type="error" title="导入未完成">{{ error }}</NAlert>
            <NAlert
              v-for="(item, index) in planBlockingErrors(previewPlan)"
              :key="`preview-blocking-${index}-${blockingErrorText(item)}`"
              type="error"
              title="无法安全导入"
            >
              {{ blockingErrorText(item) }}
            </NAlert>
            <NAlert v-for="warning in previewPlan.warnings" :key="warning" type="warning" :title="warning" />
            <NAlert
              v-for="item in previewPlan.skippedAgents"
              :key="`skipped-${item.enkaId}`"
              type="warning"
              :title="`${item.name}：${item.reason}`"
            />
            <NAlert
              v-if="previewPlan.conflicts?.length"
              type="warning"
              :title="`还有 ${previewPlan.conflicts.length} 张疑似同盘需要确认`"
            />
            <DriveDiscConflictResolver
              v-if="previewPlan.conflicts?.length"
              :conflicts="previewPlan.conflicts"
              :resolutions="driveDiscResolutions"
              :disabled="planning || applying || accountUnavailable"
              @resolve="resolveDriveDiscConflict"
            />
            <details v-for="agent in previewPlan.agents" :key="agent.agentId" class="preview-agent">
              <summary>
                <span class="preview-agent-title">
                  <ChevronRight class="preview-agent-chevron" :size="16" aria-hidden="true" />
                  <strong>{{ agent.agentName }}</strong>
                </span>
                <span class="preview-agent-tags">
                  <NTag v-if="agent.changes.length" size="small" type="warning">覆盖 {{ agent.changes.length }} 项</NTag>
                  <NTag v-else size="small">无配置变化</NTag>
                  <NTag v-if="agent.drive?.skipped" size="small" type="warning">需要注意</NTag>
                </span>
              </summary>
              <div class="preview-agent-body">
                <dl v-if="agent.changes.length">
                  <div v-for="change in orderedChanges(agent)" :key="`${agent.agentId}-${change.field}`">
                    <dt>{{ change.label }}</dt>
                    <dd>
                      <span>{{ changeValue(change, change.before, 'before', agent) }}</span>
                      <strong>→</strong>
                      <span>{{ changeValue(change, change.after, 'after', agent) }}</span>
                    </dd>
                  </div>
                </dl>
                <p v-else class="meta">该角色没有配置变化。</p>
                <ul v-if="driveOperationRows(agent.drive).length" class="drive-operations" aria-label="驱动盘同步变化">
                  <li v-for="(operation, index) in driveOperationRows(agent.drive)" :key="`${agent.agentId}-drive-${index}`">
                    <span>{{ operation.label }}</span>
                    <DriveDiscSourceTags v-if="operation.disc" :disc="operation.disc" show-scanner-sequence />
                  </li>
                </ul>
                <NAlert v-if="agent.drive?.skipped" type="warning" :title="agent.drive.reason" />
              </div>
            </details>
          </div>
        </NSpin>
        <template #footer>
          <div class="modal-actions">
            <NButton :disabled="applying || planning" @click="closePreview">取消</NButton>
            <NButton
              type="primary"
              :loading="applying"
              :disabled="planning || accountUnavailable || hasBlockingErrors(previewPlan) || hasUnresolvedConflicts(previewPlan)"
              @click="confirmImport"
            >
              <template #icon><Upload :size="16" /></template>
              {{ previewPlan?.kind === 'enka-rebind' ? '确认更换 UID' : '确认导入' }}
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
.page-header .import-description { max-width: 760px; margin-top: 10px; color: #475569; line-height: 1.6; }
.page-header .import-impact { max-width: 900px; color: #475569; line-height: 1.55; }
.import-impact strong { color: #334155; }
.field-label { display: block; margin-bottom: 6px; color: #334155; font-size: 13px; font-weight: 600; }
.uid-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.block { margin-top: 12px; }
.results { display: flex; flex-direction: column; gap: 10px; }
.list-header h2 { font-size: 18px; }
.list-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.agent-list { border-top: 1px solid #e2e8f0; }
.agent-row { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 4px; border-bottom: 1px solid #e2e8f0; }
.agent-info { min-width: 0; flex: 1; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.meta { color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
.imported-agent-row { min-height: 58px; }
.imported-time { margin-left: auto; }
.empty-state { margin: 0; padding: 14px 4px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; }
.preview-modal {
  box-sizing: border-box;
  min-width: 0;
  width: 760px;
  max-width: calc(100vw - 24px);
  max-height: min(760px, calc(100vh - 24px));
  max-height: min(760px, calc(100dvh - 24px));
}
.preview-content { display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 220px); max-height: calc(100dvh - 220px); overflow: auto; }
.rebind-summary { padding: 12px; border: 1px solid #f0c36a; background: #fffaf0; color: #334155; }
.rebind-summary ul { margin: 8px 0 0; padding-left: 20px; }
.rebind-summary li + li { margin-top: 4px; }
.preview-agent { border-top: 1px solid #e2e8f0; }
.preview-agent summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 2px; cursor: pointer; list-style: none; }
.preview-agent summary::-webkit-details-marker { display: none; }
.preview-agent summary:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.preview-agent-title { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.preview-agent-chevron { flex: 0 0 auto; transition: transform 150ms ease; }
.preview-agent[open] .preview-agent-chevron { transform: rotate(90deg); }
.preview-agent-tags { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.preview-agent-body { padding: 0 2px 12px; }
.preview-agent dl { margin: 8px 0 0; }
.preview-agent dl div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px; padding: 5px 0; }
.preview-agent dt { color: #475569; }
.preview-agent dd { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; overflow-wrap: anywhere; }
.drive-operations { margin: 8px 0 0; padding-left: 20px; color: #334155; font-size: 13px; overflow-wrap: anywhere; }
.drive-operations li + li { margin-top: 4px; }
.drive-operations li { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.modal-actions { justify-content: flex-end; }
@media (max-width: 480px) {
  .page-header, .list-header { align-items: flex-start; flex-direction: column; }
  .list-actions { width: 100%; justify-content: flex-start; }
  .uid-row > * { width: 100%; max-width: none !important; }
  .imported-time { width: 100%; margin-left: 0; }
  .preview-agent summary { align-items: flex-start; flex-direction: column; }
  .preview-agent-tags { justify-content: flex-start; }
  .preview-agent dl div { grid-template-columns: 1fr; }
}
</style>
