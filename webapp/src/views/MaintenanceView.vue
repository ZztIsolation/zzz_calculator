<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NButton, NInput, NSelect, NTag } from "naive-ui"
import { Copy, Plus, Save, Trash2 } from "lucide-vue-next"
import { formatStoredStatValue, statLabel } from "@core/shared-combat.js"
import {
  FIELD_BUFF_GAME_VERSIONS,
  FIELD_BUFF_MODE_OPTIONS,
  FIELD_BUFF_PHASE_OPTIONS,
  fieldBuffModeOption,
  fieldBuffPhaseName,
} from "@core/maintenanceValidation.js"

const resources = [
  { label: "角色", value: "agents", path: ["agents", "agents"] },
  { label: "角色技能", value: "agent-skills", path: ["agentSkills", "agentSkills"] },
  { label: "音擎", value: "w-engines", path: ["wEngines", "wEngines"] },
  { label: "驱动盘套装", value: "drive-disc-sets", path: ["driveDiscSets", "sets"] },
  { label: "战斗 Buff", value: "combat-buffs", path: ["combatBuffs", "buffs"] },
  { label: "场地 Buff", value: "field-buffs", path: ["combatBuffs", "fieldBuffs"] },
  { label: "Boss Buff", value: "boss-buffs", path: ["combatBuffs", "bossBuffs"] },
  { label: "异常/紊乱", value: "anomaly-effects", path: ["anomalyEffects", "anomalyEffects"] },
]

const loading = ref(false)
const error = ref("")
const saveState = ref("已加载")
const saveHint = ref("选择条目后可编辑 JSON 并保存")
const catalog = ref<any>(null)
const appConfig = ref<any>({ maintenanceEnabled: false })
const resource = ref("agents")
const query = ref("")
const selectedKey = ref("")
const draftText = ref("")
const validationError = ref("")

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
const currentResource = computed(() => resources.find(item => item.value === resource.value) ?? resources[0])
const maintenanceEnabled = computed(() => appConfig.value?.maintenanceEnabled === true)
const records = computed(() => {
  const [topKey, collectionKey] = currentResource.value.path
  const block = catalog.value?.[topKey]
  const items = Array.isArray(block) ? block : block?.[collectionKey] ?? []
  return Array.isArray(items) ? items : []
})
const filteredRecords = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) {
    return records.value
  }
  return records.value.filter((item: any) => JSON.stringify(item).toLowerCase().includes(needle))
})
const selectedRecord = computed(() => records.value.find((item: any) => recordKey(item) === selectedKey.value))
const draftObject = computed(() => {
  try {
    return draftText.value ? JSON.parse(draftText.value) : null
  } catch {
    return null
  }
})

function recordKey(item: any) {
  if (resource.value === "anomaly-effects") {
    return `${item.maintenanceType ?? item.settlementType ?? "anomaly"}:${item.id ?? item.type}`
  }
  return String(item.id ?? item.teammateId ?? item.name?.zhCN ?? "")
}

function recordLabel(item: any) {
  return item.name?.zhCN ?? item.label?.zhCN ?? item.id ?? item.teammateId ?? "未命名"
}

function textOf(value: any) {
  if (!value) {
    return ""
  }
  return typeof value === "string" ? value : value.zhCN ?? value.en ?? ""
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
  return recordKey(item)
}

async function load() {
  loading.value = true
  error.value = ""
  try {
    const configResponse = await fetch("/api/app-config", { cache: "no-store" }).catch(() => null)
    if (configResponse?.ok) {
      appConfig.value = await configResponse.json()
    }
    if (!maintenanceEnabled.value) {
      saveState.value = "只读"
      saveHint.value = "当前环境未开启维护写入"
      return
    }
    const response = await fetch("/api/maintenance/catalog", { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`维护 API 不可用：${response.status}`)
    }
    const payload = await response.json()
    catalog.value = payload.data ?? payload
    if (!selectedKey.value && records.value[0]) {
      selectRecord(records.value[0])
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function selectRecord(item: any) {
  selectedKey.value = recordKey(item)
  draftText.value = JSON.stringify(item, null, 2)
  validationError.value = ""
  saveState.value = "已加载"
  saveHint.value = "修改 JSON 后保存"
}

function newRecord() {
  const id = `${resource.value.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}`
  const defaultMode = fieldBuffModeOption("defense_v5")
  const defaultPhaseName = fieldBuffPhaseName(1) ?? { zhCN: "第一期" }
  const item = resource.value === "field-buffs"
    ? {
        sourceType: "field",
        scope: "inCombat",
        name: { zhCN: "新场地 Buff" },
        source: { zhCN: defaultMode?.source?.zhCN ?? "防卫战 v5" },
        period: {
          modeId: "defense_v5",
          gameVersion: "3.0",
          phaseNo: 1,
          phaseName: defaultPhaseName,
        },
        sourcePeriod: { zhCN: `3.0版本${defaultPhaseName.zhCN}` },
        description: { zhCN: "" },
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
        effects: [],
        buffModifiers: [],
      }
    : { id, name: { zhCN: "新条目" } }
  selectedKey.value = id
  draftText.value = JSON.stringify(item, null, 2)
  validationError.value = ""
  saveState.value = "未保存"
  saveHint.value = "新增条目尚未写入"
}

function cloneRecord() {
  const base = selectedRecord.value ? JSON.parse(JSON.stringify(selectedRecord.value)) : JSON.parse(draftText.value || "{}")
  base.id = `${base.id ?? resource.value}-${Date.now()}`
  if (base.name?.zhCN) {
    base.name.zhCN = `${base.name.zhCN} 副本`
  }
  selectedKey.value = recordKey(base)
  draftText.value = JSON.stringify(base, null, 2)
  saveState.value = "未保存"
  saveHint.value = "复制条目尚未写入"
}

function parseDraft() {
  try {
    const item = JSON.parse(draftText.value || "{}")
    validationError.value = ""
    return item
  } catch (err) {
    validationError.value = err instanceof Error ? err.message : String(err)
    return null
  }
}

function patchDraft(patch: any) {
  const item = draftObject.value ? JSON.parse(JSON.stringify(draftObject.value)) : {}
  for (const [path, value] of Object.entries(patch)) {
    const parts = String(path).split(".")
    let cursor = item
    for (const part of parts.slice(0, -1)) {
      cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {}
      cursor = cursor[part]
    }
    cursor[parts.at(-1) as string] = value
  }
  draftText.value = JSON.stringify(item, null, 2)
  saveState.value = "未保存"
  saveHint.value = "本次修改尚未保存"
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

async function saveDraft() {
  if (!maintenanceEnabled.value) {
    saveState.value = "只读"
    saveHint.value = "当前环境未开启维护写入，不能保存。"
    return
  }
  const item = parseDraft()
  if (!item) {
    return
  }
  const requestItem = resource.value === "field-buffs" && selectedRecord.value?.id
    ? { ...item, _maintenanceOriginalId: selectedRecord.value.id }
    : item
  saveState.value = "保存中"
  saveHint.value = "正在写入维护数据"
  try {
    const response = await fetch(`/api/maintenance/${resource.value}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestItem),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error ?? `保存失败：${response.status}`)
    }
    catalog.value = payload.data ?? catalog.value
    selectedKey.value = recordKey(payload.savedItem ?? item)
    draftText.value = JSON.stringify(payload.savedItem ?? item, null, 2)
    saveState.value = "已保存"
    saveHint.value = "保存成功"
  } catch (err) {
    saveState.value = "保存失败"
    saveHint.value = err instanceof Error ? err.message : String(err)
  }
}

async function deleteDraft() {
  if (!maintenanceEnabled.value) {
    saveState.value = "只读"
    saveHint.value = "当前环境未开启维护写入，不能删除。"
    return
  }
  const item = parseDraft()
  const key = item ? recordKey(item) : selectedKey.value
  if (!key) {
    return
  }
  const [maintenanceType, id] = resource.value === "anomaly-effects" ? key.split(":") : ["", key]
  const path = resource.value === "anomaly-effects"
    ? `/api/maintenance/${resource.value}/${encodeURIComponent(maintenanceType)}/${encodeURIComponent(id)}`
    : `/api/maintenance/${resource.value}/${encodeURIComponent(key)}`
  saveState.value = "删除中"
  try {
    const response = await fetch(path, { method: "DELETE" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error ?? `删除失败：${response.status}`)
    }
    catalog.value = payload.data ?? catalog.value
    selectedKey.value = ""
    draftText.value = ""
    saveState.value = "已删除"
    saveHint.value = "条目已删除"
  } catch (err) {
    saveState.value = "删除失败"
    saveHint.value = err instanceof Error ? err.message : String(err)
  }
}

onMounted(load)
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
          <NButton :disabled="!maintenanceEnabled" @click="cloneRecord">
            <template #icon><Copy :size="16" /></template>
            复制当前
          </NButton>
          <NButton :disabled="!maintenanceEnabled" @click="newRecord">
            <template #icon><Plus :size="16" /></template>
            新增
          </NButton>
          <NButton type="primary" :disabled="!maintenanceEnabled || !draftText" @click="saveDraft">
            <template #icon><Save :size="16" /></template>
            保存
          </NButton>
        </div>
      </div>
      <div class="panel-body maintenance-layout">
        <aside class="section-band">
          <NSelect v-model:value="resource" :options="resourceOptions" @update:value="() => { selectedKey = ''; draftText = '' }" />
          <NInput v-model:value="query" clearable placeholder="名称、ID、来源" />
          <NTag v-if="error" type="error">{{ error }}</NTag>
          <NTag v-else round>{{ filteredRecords.length }} / {{ records.length }}</NTag>
          <div class="record-list">
            <button
              v-for="item in filteredRecords"
              :key="recordKey(item)"
              type="button"
              class="entity-option"
              :class="{ active: recordKey(item) === selectedKey }"
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
              <NButton type="error" :disabled="!maintenanceEnabled || !draftText" @click="deleteDraft">
                <template #icon><Trash2 :size="16" /></template>
                删除
              </NButton>
              <NButton type="primary" :disabled="!maintenanceEnabled || !draftText" @click="saveDraft">保存</NButton>
            </div>
          </div>
          <NTag v-if="validationError" type="error">{{ validationError }}</NTag>
          <div v-if="draftObject" class="panel">
            <div class="panel-header">
              <h2 class="panel-title">结构化字段</h2>
              <NTag round>{{ resource }}</NTag>
            </div>
            <div class="panel-body metric-grid">
              <label v-if="resource !== 'field-buffs'" class="metric">
                <dt>ID</dt>
                <dd><NInput :value="draftObject.id ?? draftObject.teammateId ?? ''" :disabled="!maintenanceEnabled" @update:value="patchDraft({ id: $event })" /></dd>
              </label>
              <label class="metric">
                <dt>中文名</dt>
                <dd><NInput :value="draftObject.name?.zhCN ?? draftObject.label?.zhCN ?? ''" :disabled="!maintenanceEnabled" @update:value="patchDraft({ 'name.zhCN': $event })" /></dd>
              </label>
              <template v-if="resource === 'field-buffs'">
                <label class="metric">
                  <dt>模式</dt>
                  <dd><NSelect :value="draftObject.period?.modeId ?? 'defense_v5'" :disabled="!maintenanceEnabled" :options="fieldBuffModeOptions" @update:value="patchFieldBuffPeriod({ modeId: String($event) })" /></dd>
                </label>
                <label class="metric">
                  <dt>版本</dt>
                  <dd><NSelect :value="draftObject.period?.gameVersion ?? '3.0'" :disabled="!maintenanceEnabled" :options="fieldBuffVersionOptions" @update:value="patchFieldBuffPeriod({ gameVersion: String($event) })" /></dd>
                </label>
                <label class="metric">
                  <dt>第几期</dt>
                  <dd><NSelect :value="Number(draftObject.period?.phaseNo ?? 1)" :disabled="!maintenanceEnabled" :options="fieldBuffPhaseOptions" @update:value="patchFieldBuffPeriod({ phaseNo: Number($event) })" /></dd>
                </label>
              </template>
              <label v-if="resource !== 'field-buffs'" class="metric">
                <dt>来源</dt>
                <dd><NInput :value="draftObject.source?.zhCN ?? draftObject.sourceLabel?.zhCN ?? draftObject.source ?? ''" :disabled="!maintenanceEnabled" @update:value="patchDraft({ 'source.zhCN': $event })" /></dd>
              </label>
              <label v-if="resource === 'combat-buffs'" class="metric">
                <dt>队友/角色</dt>
                <dd><NInput :value="draftObject.ownerName?.zhCN ?? draftObject.teammateName?.zhCN ?? ''" :disabled="!maintenanceEnabled" @update:value="patchDraft({ 'ownerName.zhCN': $event })" /></dd>
              </label>
            </div>
          </div>
          <NInput
            v-model:value="draftText"
            type="textarea"
            placeholder="选择或新建条目"
            :disabled="!maintenanceEnabled"
            :autosize="{ minRows: 24, maxRows: 40 }"
            @input="() => { saveState = '未保存'; saveHint = '本次修改尚未保存' }"
          />
          <details class="panel">
            <summary class="panel-header">保存预览</summary>
            <pre class="raw">{{ draftText }}</pre>
          </details>
        </section>
      </div>
    </div>
  </section>
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
