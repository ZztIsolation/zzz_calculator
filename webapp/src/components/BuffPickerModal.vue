<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInput, NInputNumber, NModal, NSelect, NScrollbar, NTabPane, NTabs, NTag } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import { imageForBuff } from "@/utils/assets"
import { BUFF_CATEGORY_TABS, buildCombatBuffGroups, type BuffCategory } from "@/utils/combatBuffs"
import { buffDisplayName, buffEffectLines, buffSubtitle, statLabel } from "@/utils/format"
import {
  defaultRuntimeForBuff,
  effectRules,
  localizedText,
  normalizeRuntimeForBuff,
  runtimeSourceGroups,
  runtimeStackGroups,
} from "@core/shared-combat.js"

const props = defineProps<{
  show: boolean
  buffs: any[]
  selectedIds: string[]
  defaultIds?: string[]
  addedBuffs?: any[]
  runtimeInputs?: Record<string, any>
  meta?: any
  driveDiscSets?: any[]
  agentId?: string
  cinemaLevel?: number
  wEngineId?: string
  wEngineModificationLevel?: number
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  apply: [value: {
    selectedBuffIds: string[]
    addedBuffs: any[]
    runtimeInputs: Record<string, any>
  }]
}>()

const categoryTabs = BUFF_CATEGORY_TABS
const activeTab = ref<BuffCategory>("self")
const query = ref("")
const draft = ref<Set<string>>(new Set())
const draftAddedBuffs = ref<any[]>([])
const draftRuntimeInputs = ref<Record<string, any>>({})
const customName = ref("自定义 Buff")
const customScope = ref("inCombat")
const customEffects = ref<any[]>([{ stat: "atkFlat", value: 0, mode: "flat" }])
const customTarget = ref({
  categoryId: "",
  moveId: "",
  rowId: "",
})

watch(() => props.show, value => {
  if (value) {
    draft.value = new Set(props.selectedIds)
    draftAddedBuffs.value = JSON.parse(JSON.stringify(props.addedBuffs ?? []))
    draftRuntimeInputs.value = JSON.parse(JSON.stringify(props.runtimeInputs ?? {}))
    query.value = ""
    activeTab.value = "self"
  }
})

const statOptions = computed(() => Object.entries(props.meta?.statRules?.statDisplay ?? {})
  .map(([value, info]: [string, any]) => ({ label: localizedText(info?.label) || statLabel(value, props.meta), value }))
  .sort((left, right) => left.label.localeCompare(right.label, "zh-CN")))

function fallbackCategoryForDefaultId(id: string): BuffCategory {
  if (id.startsWith("wEngine:")) {
    return "selfWEngine"
  }
  return "self"
}

function fallbackDefaultBuff(id: string) {
  return {
    id,
    name: { zhCN: id.includes(".self") ? "音擎自身 Buff" : id.includes(".team") ? "音擎团队 Buff" : "默认 Buff" },
    sourceCategory: id.startsWith("wEngine:") ? "wEngine" : "agent",
    sourceType: id.startsWith("wEngine:") ? "wEngine" : "self",
    sourceKind: id.startsWith("wEngine:") ? "wEngine" : "self",
    conditionLabel: { zhCN: "默认启用，可在此手动取消" },
    effects: [],
  }
}

const groupedBuffs = computed(() => {
  const groups = buildCombatBuffGroups({
    meta: props.meta,
    catalogBuffs: props.buffs ?? [],
    driveDiscSets: props.driveDiscSets ?? [],
    agentId: props.agentId,
    cinemaLevel: props.cinemaLevel,
    wEngineId: props.wEngineId,
    wEngineModificationLevel: props.wEngineModificationLevel,
    addedBuffs: draftAddedBuffs.value,
  })
  const existing = new Set(Object.values(groups).flat().map((buff: any) => buff?.id))
  for (const id of props.defaultIds ?? []) {
    if (!existing.has(id)) {
      groups[fallbackCategoryForDefaultId(id)].push(fallbackDefaultBuff(id))
      existing.add(id)
    }
  }
  return groups
})

function buffText(buff: any) {
  return [
    buffDisplayName(buff),
    localizedText(buff?.name),
    localizedText(buff?.description),
    localizedText(buff?.conditionLabel),
    localizedText(buff?.sourceLabel),
    localizedText(buff?.ownerName),
    buff?.id,
  ].filter(Boolean).join(" ").toLowerCase()
}

const categoryBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return (groupedBuffs.value[activeTab.value] ?? [])
    .filter(buff => !needle || buffText(buff).includes(needle))
})

const customBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return draftAddedBuffs.value.filter(buff => !needle || buffText(buff).includes(needle))
})

const visibleBuffs = computed(() => activeTab.value === "custom" ? customBuffs.value : categoryBuffs.value)
const selectedCount = computed(() => draft.value.size + draftAddedBuffs.value.length)

function hasRuntimeControls(buff: any) {
  return Boolean(buff?.coverage || runtimeSourceGroups(buff).length || runtimeStackGroups(buff).length)
}

function runtimeFor(buff: any) {
  return normalizeRuntimeForBuff(buff, draftRuntimeInputs.value[buff.id] ?? defaultRuntimeForBuff(buff))
}

function effectLinesFor(buff: any) {
  return buffEffectLines(buff, runtimeFor(buff), props.meta)
}

function updateRuntime(buff: any, runtime: any) {
  draftRuntimeInputs.value = {
    ...draftRuntimeInputs.value,
    [buff.id]: normalizeRuntimeForBuff(buff, runtime),
  }
}

function setCoverage(buff: any, value: number | null) {
  updateRuntime(buff, {
    ...runtimeFor(buff),
    coverage: Number(value ?? 0),
  })
}

function setSourceValue(buff: any, group: any, value: number | null) {
  const runtime = runtimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      sourceValue: Number(value ?? 0),
    }
  }
  updateRuntime(buff, { ...runtime, effects })
}

function setStacks(buff: any, group: any, value: number | null) {
  const runtime = runtimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      stacks: Number(value ?? 0),
    }
  }
  updateRuntime(buff, { ...runtime, effects })
}

function toggle(id: string, checked: boolean) {
  const next = new Set(draft.value)
  if (checked) {
    next.add(id)
  } else {
    next.delete(id)
  }
  draft.value = next
}

function addVisibleBuffs() {
  if (activeTab.value === "custom") {
    return
  }
  const next = new Set(draft.value)
  for (const buff of visibleBuffs.value) {
    next.add(buff.id)
  }
  draft.value = next
}

function removeVisibleBuffs() {
  if (activeTab.value === "custom") {
    return
  }
  const next = new Set(draft.value)
  for (const buff of visibleBuffs.value) {
    next.delete(buff.id)
  }
  draft.value = next
}

function customEffectTarget() {
  const target = Object.fromEntries(
    Object.entries(customTarget.value)
      .map(([key, value]) => [key, String(value ?? "").trim()])
      .filter(([, value]) => value),
  )
  return Object.keys(target).length
    ? { kind: "skill", skillTargets: [target] }
    : null
}

function addCustomEffect() {
  customEffects.value = [
    ...customEffects.value,
    { stat: "atkFlat", value: 0, mode: "flat" },
  ]
}

function removeCustomEffect(index: number) {
  customEffects.value = customEffects.value.filter((_, itemIndex) => itemIndex !== index)
}

function addCustomBuff() {
  const target = customEffectTarget()
  const effects = customEffects.value
    .map((effect, index) => {
      const value = Number(effect.value)
      return Number.isFinite(value) && value !== 0
        ? {
            id: `custom-effect-${Date.now()}-${index}`,
            type: "fixed",
            stat: effect.stat,
            value,
            mode: effect.mode,
            ...(target ? { target } : {}),
          }
        : null
    })
    .filter(Boolean)
  if (!effects.length) {
    return
  }
  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  draftAddedBuffs.value = [
    ...draftAddedBuffs.value,
    {
      id,
      label: customName.value.trim() || "自定义 Buff",
      name: { zhCN: customName.value.trim() || "自定义 Buff" },
      sourceCategory: "custom",
      sourceType: "manual",
      sourceKind: "custom",
      scope: customScope.value,
      effects,
    },
  ]
  customName.value = "自定义 Buff"
  customEffects.value = [{ stat: "atkFlat", value: 0, mode: "flat" }]
  customTarget.value = { categoryId: "", moveId: "", rowId: "" }
}

function removeCustomBuff(id: string) {
  draftAddedBuffs.value = draftAddedBuffs.value.filter(buff => buff.id !== id)
  const nextRuntime = { ...draftRuntimeInputs.value }
  delete nextRuntime[id]
  draftRuntimeInputs.value = nextRuntime
}

function close() {
  emit("update:show", false)
}

function apply() {
  const selectedBuffIds = [...draft.value]
  emit("apply", {
    selectedBuffIds,
    addedBuffs: draftAddedBuffs.value,
    runtimeInputs: draftRuntimeInputs.value,
  })
  close()
}
</script>

<template>
  <NModal :show="show" preset="card" title="选择 Buff" style="max-width: 1080px" @update:show="emit('update:show', $event)">
    <div class="section-band">
      <div class="toolbar">
        <NInput v-model:value="query" clearable placeholder="搜索来源、名称、效果" style="max-width: 360px" />
        <NTag round>已选 {{ selectedCount }} 项</NTag>
        <NButton size="small" :disabled="activeTab === 'custom'" @click="addVisibleBuffs">添加当前列表</NButton>
        <NButton size="small" :disabled="activeTab === 'custom'" @click="removeVisibleBuffs">移除当前列表</NButton>
      </div>

      <NTabs v-model:value="activeTab" class="buff-category-tabs" type="segment">
        <NTabPane v-for="tab in categoryTabs" :key="tab.name" :name="tab.name" :tab="tab.label" />
      </NTabs>

      <div v-if="activeTab === 'custom'" class="custom-buff-editor">
        <NInput v-model:value="customName" placeholder="名称" />
        <NSelect v-model:value="customScope" :options="[
          { label: '局内生效', value: 'inCombat' },
          { label: '局外面板', value: 'outOfCombat' },
        ]" />
        <NInput v-model:value="customTarget.categoryId" placeholder="技能分类 ID（可选）" />
        <NInput v-model:value="customTarget.moveId" placeholder="招式 ID（可选）" />
        <NInput v-model:value="customTarget.rowId" placeholder="倍率行 ID（可选）" />
        <div class="custom-effect-list">
          <div v-for="(_, index) in customEffects" :key="index" class="custom-effect-row">
            <NSelect v-model:value="customEffects[index].stat" :options="statOptions" filterable />
            <NInputNumber v-model:value="customEffects[index].value" :step="1" />
            <NSelect v-model:value="customEffects[index].mode" :options="[{ label: '平铺数值', value: 'flat' }, { label: '倍率', value: 'pct' }]" />
            <NButton size="small" type="error" :disabled="customEffects.length <= 1" @click="removeCustomEffect(index)">移除</NButton>
          </div>
        </div>
        <NButton @click="addCustomEffect">新增效果</NButton>
        <NButton type="primary" @click="addCustomBuff">添加到本次选择</NButton>
      </div>

      <NScrollbar style="max-height: 560px">
        <div class="section-band">
          <article
            v-for="buff in visibleBuffs"
            :key="buff.id"
            class="buff-row"
            :class="{ 'is-selected': draft.has(buff.id), 'is-selectable': activeTab !== 'custom' }"
          >
            <div class="buff-row-main">
              <NCheckbox
                v-if="activeTab !== 'custom'"
                class="buff-check"
                :checked="draft.has(buff.id)"
                @update:checked="toggle(buff.id, Boolean($event))"
              />
              <button
                v-if="activeTab !== 'custom'"
                type="button"
                class="buff-row-toggle"
                :aria-pressed="draft.has(buff.id)"
                @click="toggle(buff.id, !draft.has(buff.id))"
              >
                <ImageAvatar :src="imageForBuff(buff)" :name="buffDisplayName(buff)" round />
                <span class="buff-copy">
                  <strong>{{ buffDisplayName(buff) }}</strong>
                  <small>{{ buffSubtitle(buff) }}</small>
                </span>
              </button>
              <span v-else class="buff-row-toggle is-static">
                <ImageAvatar :src="imageForBuff(buff)" :name="buffDisplayName(buff)" round />
                <span class="buff-copy">
                  <strong>{{ buffDisplayName(buff) }}</strong>
                  <small>{{ buffSubtitle(buff) }}</small>
                </span>
              </span>
              <NButton v-if="activeTab === 'custom'" size="small" type="error" @click="removeCustomBuff(buff.id)">移除</NButton>
            </div>
            <div v-if="effectLinesFor(buff).length" class="buff-effect-lines">
              <span v-for="(line, index) in effectLinesFor(buff)" :key="`${index}-${line}`">{{ line }}</span>
            </div>
            <div v-if="hasRuntimeControls(buff)" class="runtime-grid">
              <div v-if="buff.coverage" class="metric runtime-metric">
                <dt>覆盖率</dt>
                <dd>
                  <NInputNumber
                    :value="runtimeFor(buff).coverage"
                    :min="buff.coverage.min ?? 0"
                    :max="buff.coverage.max ?? 1"
                    :step="buff.coverage.step ?? 0.1"
                    size="small"
                    @update:value="setCoverage(buff, Number($event))"
                  />
                </dd>
              </div>
              <div v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric runtime-metric">
                <dt>{{ group.label || "来源数值" }}</dt>
                <dd>
                  <NInputNumber
                    :value="runtimeFor(buff).effects?.[group.ruleIds?.[0]]?.sourceValue ?? group.defaultValue ?? 0"
                    :min="Number.isFinite(group.min) ? group.min : undefined"
                    :max="Number.isFinite(group.max) ? group.max : undefined"
                    size="small"
                    @update:value="setSourceValue(buff, group, Number($event))"
                  />
                </dd>
              </div>
              <div v-for="group in runtimeStackGroups(buff)" :key="group.key" class="metric layer-metric">
                <dd>
                  <LayerSlider
                    :label="group.label || '层数'"
                    :value="runtimeFor(buff).effects?.[group.ruleIds?.[0]]?.stacks ?? group.defaultStacks ?? group.maxStacks ?? 1"
                    :min="0"
                    :max="group.maxStacks ?? 99"
                    :step="1"
                    @update:value="setStacks(buff, group, Number($event))"
                  />
                </dd>
              </div>
            </div>
            <div v-if="effectRules(buff).length" class="chip-row">
              <NTag v-for="rule in effectRules(buff).slice(0, 4)" :key="rule.id ?? rule.stat" size="small" round>
                {{ statLabel(rule.stat, meta) || rule.kind || rule.type }}
              </NTag>
            </div>
          </article>
          <div v-if="!visibleBuffs.length" class="empty-state">暂无可添加的 Buff</div>
        </div>
      </NScrollbar>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <span class="muted">应用前不会改动当前方案</span>
        <NButton @click="close">取消</NButton>
        <NButton type="primary" @click="apply">应用选择</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.buff-category-tabs {
  padding: 5px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius);
  background: #eef3f8;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.02);
}

.buff-category-tabs :deep(.n-tabs-nav) {
  min-width: 0;
}

.buff-category-tabs :deep(.n-tabs-rail) {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
}

.buff-category-tabs :deep(.n-tabs-tab-wrapper) {
  flex: 1 1 0;
  min-width: 0;
}

.buff-category-tabs :deep(.n-tabs-tab-pad) {
  display: none;
}

.buff-category-tabs :deep(.n-tabs-tab) {
  justify-content: center;
  width: 100%;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.58);
  border-radius: var(--app-radius-sm);
  background: rgba(255, 255, 255, 0.78);
  color: var(--app-text);
  font-weight: 750;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.buff-category-tabs :deep(.n-tabs-tab:hover) {
  border-color: rgba(47, 125, 246, 0.72);
  background: #fff;
  color: var(--app-blue);
}

.buff-category-tabs :deep(.n-tabs-tab:focus-visible) {
  outline: 2px solid rgba(47, 125, 246, 0.36);
  outline-offset: 2px;
}

.buff-category-tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  border-color: var(--app-blue);
  background: #eaf2ff;
  color: var(--app-blue);
  box-shadow:
    inset 0 0 0 1px rgba(47, 125, 246, 0.22),
    0 4px 12px rgba(47, 125, 246, 0.12);
}

.buff-category-tabs :deep(.n-tabs-capsule) {
  display: none;
}

.buff-row {
  display: grid;
  gap: 12px;
  min-height: 112px;
  padding: 14px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.buff-row.is-selectable:hover {
  border-color: rgba(47, 125, 246, 0.68);
  background: #fbfdff;
  box-shadow: 0 8px 20px rgba(47, 125, 246, 0.1);
}

.buff-row.is-selected {
  border-color: var(--app-blue);
  background: rgba(47, 125, 246, 0.07);
  box-shadow:
    inset 0 0 0 1px rgba(47, 125, 246, 0.38),
    0 8px 20px rgba(47, 125, 246, 0.1);
}

.buff-row-main {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 64px;
}

.buff-check {
  flex: 0 0 auto;
}

.buff-check :deep(.n-checkbox-box-wrapper) {
  width: 28px;
  height: 28px;
}

.buff-check :deep(.n-checkbox-box) {
  width: 22px;
  height: 22px;
  border: 2px solid var(--app-border-strong);
  border-radius: 6px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.03);
}

.buff-check :deep(.n-checkbox-box:hover) {
  border-color: var(--app-blue);
}

.buff-check.n-checkbox--checked :deep(.n-checkbox-box),
.buff-check.n-checkbox--indeterminate :deep(.n-checkbox-box) {
  border-color: var(--app-blue);
  background: var(--app-blue);
  box-shadow: 0 0 0 3px rgba(47, 125, 246, 0.12);
}

.buff-check.n-checkbox--checked :deep(.n-checkbox-icon),
.buff-check.n-checkbox--indeterminate :deep(.n-checkbox-icon) {
  color: #fff;
  opacity: 1;
}

.buff-check.n-checkbox--checked :deep(.check-icon path) {
  fill: #fff;
}

.buff-row-toggle {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 62px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: inherit;
  text-align: left;
}

button.buff-row-toggle {
  cursor: pointer;
}

button.buff-row-toggle:hover {
  border-color: rgba(47, 125, 246, 0.22);
  background: rgba(47, 125, 246, 0.045);
}

button.buff-row-toggle:focus-visible {
  outline: 2px solid rgba(47, 125, 246, 0.38);
  outline-offset: 2px;
}

.buff-row-toggle.is-static {
  padding-left: 0;
}

.buff-copy {
  flex: 1 1 auto;
  display: grid;
  gap: 3px;
  min-width: 0;
}

.buff-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buff-copy small {
  color: var(--app-muted);
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: normal;
}

.buff-effect-lines {
  display: grid;
  gap: 5px;
  color: var(--app-text);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.5;
}

.buff-effect-lines span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.runtime-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 10px;
}

.runtime-metric {
  display: grid;
  width: max-content;
  max-width: 100%;
  min-width: 0;
}

.runtime-metric :deep(.n-input-number) {
  width: 108px;
  max-width: 100%;
}

.runtime-grid .layer-metric {
  flex: 1 1 260px;
  min-width: min(100%, 260px);
}

.custom-buff-editor,
.custom-effect-list {
  display: grid;
  gap: 10px;
}

.custom-effect-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 120px 140px auto;
  gap: 8px;
  align-items: center;
}

@media (max-width: 720px) {
  .buff-category-tabs :deep(.n-tabs-rail) {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }

  .buff-category-tabs :deep(.n-tabs-tab-wrapper) {
    flex: 0 0 auto;
  }

  .buff-category-tabs :deep(.n-tabs-tab) {
    min-width: max-content;
  }

  .custom-effect-row {
    grid-template-columns: 1fr;
  }
}
</style>
