<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NDropdown, NInput, NModal, NSelect, NTab, NTabs, NTag } from "naive-ui"
import { Lock, Plus, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import CalculationEventsEditor from "./CalculationEventsEditor.vue"
import { defaultCalculationEvent, option } from "./maintenance-options"
import { internalId, textOf } from "./maintenance-model"
import { disorderElapsedStepSeconds, normalizeElapsedSeconds } from "@core/damageEventMultipliers.js"

const props = withDefaults(defineProps<{
  show: boolean
  config?: any | null
  catalog: any
  agent: any
  skillGroups?: any[]
  disabled?: boolean
}>(), { config: null, skillGroups: () => [] })
const emit = defineEmits<{ "update:show": [value: boolean], apply: [value: any] }>()

const draft = ref<any | null>(null)
const activeLevel = ref(0)
const showDeleteVariantConfirm = ref(false)

const calculationModeOptions = computed(() => [
  option("custom", "自定义"),
  props.agent?.specialty === "rupture" ? option("sheer", "最大化贯穿伤害") : option("single", "最大化单个技能伤害"),
  option("anomaly", "最大化异常伤害"),
])

const entries = computed<any[]>(() => {
  if (!draft.value) return []
  return [draft.value, ...(draft.value.variants ?? [])].sort((a, b) => Number(a.cinemaLevel ?? 0) - Number(b.cinemaLevel ?? 0))
})
const activeEntry = computed(() => entries.value.find(entry => Number(entry.cinemaLevel ?? 0) === activeLevel.value) ?? entries.value[0] ?? null)
const usedLevels = computed(() => new Set(entries.value.map(entry => Number(entry.cinemaLevel ?? 0))))
const addLevelOptions = computed(() => [1, 2, 3, 4, 5, 6]
  .filter(level => !usedLevels.value.has(level))
  .map(level => ({ label: `新增 ${level} 影循环`, key: level })))
const activeLevelOptions = computed(() => [1, 2, 3, 4, 5, 6].map(level => ({
  label: `${level} 影`,
  value: level,
  disabled: level !== activeLevel.value && usedLevels.value.has(level),
})))
const totalEventCount = computed(() => entries.value.reduce((sum, entry) => sum + (entry.events?.length ?? 0), 0))
const canApply = computed(() => entries.value.length > 0 && entries.value.every((entry, index) => (entry.events?.length ?? 0) > 0 || (index === 0 && (draft.value?.skillGroups?.length ?? 0) > 0)))

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function createBaseConfig() {
  const event = defaultCalculationEvent("direct")
  return {
    cinemaLevel: 0,
    mode: "custom",
    name: { zhCN: "默认方案" },
    selectedEventId: event.id,
    events: [event],
    variants: [],
  }
}

function normalizeEntry(entry: any) {
  entry.mode ??= "custom"
  entry.name ??= { zhCN: Number(entry.cinemaLevel ?? 0) ? `${entry.cinemaLevel}影默认方案` : "默认方案" }
  entry.events = Array.isArray(entry.events) ? entry.events : []
  for (const event of entry.events) {
    event.id ||= internalId("event")
    if (event.kind === "disorder" || event.settlementType === "disorder") {
      event.elapsedSeconds = normalizeElapsedSeconds(
        event.elapsedSeconds,
        Number.POSITIVE_INFINITY,
        disorderElapsedStepSeconds(event, props.catalog),
      )
    }
  }
  if (!entry.events.some((event: any) => event.id === entry.selectedEventId)) entry.selectedEventId = entry.events[0]?.id ?? null
}

function prepareDraft(config: any | null | undefined) {
  const next = config ? clone(config) : createBaseConfig()
  next.cinemaLevel = 0
  normalizeEntry(next)
  const seen = new Set([0])
  next.variants = (Array.isArray(next.variants) ? next.variants : [])
    .filter((entry: any) => {
      const level = Number(entry?.cinemaLevel)
      if (!entry || !Number.isInteger(level) || level < 1 || level > 6 || seen.has(level)) return false
      seen.add(level)
      return true
    })
    .map((entry: any) => {
      normalizeEntry(entry)
      delete entry.variants
      delete entry.skillGroups
      return entry
    })
    .sort((a: any, b: any) => Number(a.cinemaLevel) - Number(b.cinemaLevel))
  return next
}

watch(() => props.show, value => {
  if (!value) return
  draft.value = prepareDraft(props.config)
  activeLevel.value = 0
  showDeleteVariantConfirm.value = false
}, { immediate: true })

function setSelectedEvent(value: string | null) {
  if (activeEntry.value) activeEntry.value.selectedEventId = value
}

function addVariant(levelValue: string | number) {
  const level = Number(levelValue)
  if (!draft.value || !activeEntry.value || usedLevels.value.has(level) || level < 1 || level > 6) return
  const source = activeEntry.value
  const eventIds = new Map<string, string>()
  const events = clone(source.events ?? []).map((event: any) => {
    const oldId = String(event.id ?? "")
    const id = internalId("event")
    if (oldId) eventIds.set(oldId, id)
    return { ...event, id }
  })
  const variant = {
    cinemaLevel: level,
    mode: source.mode ?? "custom",
    name: { zhCN: `${level}影默认方案` },
    selectedEventId: eventIds.get(String(source.selectedEventId ?? "")) ?? events[0]?.id ?? null,
    events,
  }
  draft.value.variants.push(variant)
  draft.value.variants.sort((a: any, b: any) => Number(a.cinemaLevel) - Number(b.cinemaLevel))
  activeLevel.value = level
}

function changeActiveLevel(value: string | number) {
  const level = Number(value)
  if (!activeEntry.value || activeLevel.value === 0 || usedLevels.value.has(level)) return
  activeEntry.value.cinemaLevel = level
  draft.value.variants.sort((a: any, b: any) => Number(a.cinemaLevel) - Number(b.cinemaLevel))
  activeLevel.value = level
}

function removeActiveVariant() {
  if (!draft.value || activeLevel.value === 0) return
  draft.value.variants = draft.value.variants.filter((entry: any) => Number(entry.cinemaLevel) !== activeLevel.value)
  activeLevel.value = 0
  showDeleteVariantConfirm.value = false
}

function close() {
  emit("update:show", false)
}

function apply() {
  if (!draft.value || !canApply.value) return
  const next = prepareDraft(draft.value)
  next.cinemaLevel = 0
  for (const entry of [next, ...(next.variants ?? [])]) normalizeEntry(entry)
  emit("apply", next)
  close()
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="管理员默认循环"
    class="default-loop-modal"
    :style="{ width: 'min(1120px, calc(100vw - 16px))', maxWidth: '1120px', height: 'min(840px, calc(100vh - 16px))' }"
    :content-style="{ minHeight: '0', overflow: 'hidden' }"
    @update:show="close"
  >
    <div v-if="draft" class="default-loop-modal-content ui-layout-scope" data-layout-surface="default-calculation-config">
    <div class="default-loop-modal-body">
      <div class="default-loop-variant-bar">
        <NTabs :value="activeLevel" type="segment" class="default-loop-tabs" @update:value="activeLevel = Number($event)">
          <NTab v-for="entry in entries" :key="entry.cinemaLevel" :name="Number(entry.cinemaLevel)">{{ Number(entry.cinemaLevel) }} 影</NTab>
        </NTabs>
        <NDropdown trigger="click" :options="addLevelOptions" :disabled="disabled || !addLevelOptions.length" @select="addVariant">
          <NButton circle secondary :disabled="disabled || !addLevelOptions.length" title="添加影画循环" aria-label="添加影画循环"><template #icon><Plus :size="16" /></template></NButton>
        </NDropdown>
        <NButton v-if="activeLevel !== 0" circle quaternary type="error" :disabled="disabled" title="删除当前影画循环" aria-label="删除当前影画循环" @click="showDeleteVariantConfirm = true"><template #icon><Trash2 :size="16" /></template></NButton>
      </div>

      <CalculationEventsEditor
        v-if="activeEntry"
        :events="activeEntry.events"
        :selected-event-id="activeEntry.selectedEventId"
        :catalog="catalog"
        :agent="agent"
        :skill-groups="skillGroups"
        :disabled="disabled"
        layout="master-detail"
        @update:selected-event-id="setSelectedEvent"
      >
        <template #sidebar-top>
          <div class="default-loop-config-panel">
            <label class="maintenance-field"><span>方案名称</span><NInput :value="textOf(activeEntry.name)" :disabled="disabled" @update:value="activeEntry.name = { zhCN: String($event) }" /></label>
            <label class="maintenance-field"><span>计算方式</span><NSelect v-model:value="activeEntry.mode" :options="calculationModeOptions" :disabled="disabled" /></label>
            <label class="maintenance-field"><span>适用影画</span>
              <span v-if="activeLevel === 0" class="default-loop-base-level"><Lock :size="14" />0 影基础</span>
              <NSelect v-else :value="activeLevel" :options="activeLevelOptions" :disabled="disabled" @update:value="changeActiveLevel" />
            </label>
          </div>
        </template>
      </CalculationEventsEditor>
    </div>
    </div>

    <template #footer>
      <div class="default-loop-footer">
        <span>循环 {{ entries.length }} 套 · 事件 {{ totalEventCount }} 项</span>
        <div><NButton @click="close">取消</NButton><NButton type="primary" :disabled="disabled || !canApply" @click="apply">应用</NButton></div>
      </div>
    </template>
  </NModal>

  <ConfirmDialog
    v-model:show="showDeleteVariantConfirm"
    title="删除影画循环"
    :message="`确认删除 ${activeLevel} 影默认循环？此操作将在应用弹窗配置后写入角色草稿。`"
    confirm-text="删除"
    danger
    @confirm="removeActiveVariant"
  />
</template>

<style scoped>
.default-loop-modal-content { height: 100%; min-height: 0; overflow: auto; }
.default-loop-modal-body { display: grid; height: 100%; min-height: 0; grid-template-rows: auto minmax(0, 1fr); gap: 14px; }
.default-loop-variant-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; }
.default-loop-tabs { min-width: 0; }
.default-loop-config-panel { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel-muted); }
.default-loop-base-level { display: inline-flex; align-items: center; min-height: 34px; gap: 6px; color: var(--app-muted); font-size: 13px; font-weight: 700; }
.default-loop-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.default-loop-footer > span { color: var(--app-muted); font-size: 12px; }
.default-loop-footer > div { display: flex; gap: 8px; }
@container ui-layout (max-width: 860px) {
  .default-loop-modal-body { height: auto; min-height: 100%; }
}
@container ui-layout (max-width: 600px) {
  .default-loop-variant-bar { align-items: stretch; }
  .default-loop-footer { align-items: stretch; flex-direction: column; }
  .default-loop-footer > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
