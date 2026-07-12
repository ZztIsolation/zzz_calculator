<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInput, NInputNumber, NModal, NSelect, NScrollbar, NTabPane, NTabs, NTag } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import { imageForBuff } from "@/utils/assets"
import { BUFF_CATEGORY_TABS, buildCombatBuffGroups, type BuffCategory } from "@/utils/combatBuffs"
import { damageSkillRowsWithGeneratedTotals } from "@core/skillMultiplierCandidates.js"
import { buffDisplayName, buffEffectLines, buffSubtitle, labelOf, statLabel } from "@/utils/format"
import {
  CUSTOM_BUFF_SKILL_STAT_OPTIONS,
  CUSTOM_BUFF_STAT_OPTIONS,
  RES_IGNORE_STAT_BY_ELEMENT,
  compareGameVersions,
  damageElementForAgent,
  damageElementShortLabel,
  defaultRuntimeForBuff,
  effectRules,
  fieldBuffPeriod,
  fieldBuffPeriodKey,
  fieldBuffPeriodLabel,
  fieldBuffPhaseLabel,
  localizedText,
  normalizeCustomBuffEffect,
  normalizeCustomBuffStat,
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
const fieldVersion = ref("")
const fieldPeriod = ref("")
const fieldName = ref("")
const customName = ref("自定义 Buff")
const customRow = ref<any>({
  targetKind: "default",
  optionIndex: 0,
  value: 0,
  skillTargets: [{}],
})

watch(() => props.show, value => {
  if (value) {
    draft.value = new Set(props.selectedIds)
    draftAddedBuffs.value = JSON.parse(JSON.stringify(props.addedBuffs ?? []))
    draftRuntimeInputs.value = JSON.parse(JSON.stringify(props.runtimeInputs ?? {}))
    query.value = ""
    fieldVersion.value = ""
    fieldPeriod.value = ""
    fieldName.value = ""
    activeTab.value = "self"
    syncFieldFilters()
  }
})

watch(() => customRow.value.targetKind, () => {
  customRow.value = {
    ...customRow.value,
    optionIndex: 0,
    skillTargets: customRow.value.targetKind === "skill" ? [normalizedCustomSkillTarget({})] : [{}],
  }
})

const customTargetKindOptions = [
  { label: "默认", value: "default" },
  { label: "技能", value: "skill" },
]

type CustomBuffOption = [string, string, string, string | null]

const customOptionList = computed<CustomBuffOption[]>(() =>
  customRow.value.targetKind === "skill" ? CUSTOM_BUFF_SKILL_STAT_OPTIONS : CUSTOM_BUFF_STAT_OPTIONS)

const customStatOptions = computed(() => customOptionList.value.map((option, index) => ({
  label: option[1],
  value: index,
})))

const selectedAgent = computed(() => (props.meta?.agents ?? [])
  .find((agent: any) => agent?.id === props.agentId) ?? null)

const currentDamageElement = computed(() => damageElementForAgent(selectedAgent.value ?? {}))

const agentSkillOptions = computed(() => (props.meta?.agentSkills ?? []).map((skill: any) => {
  const agent = (props.meta?.agents ?? []).find((item: any) => item?.id === skill?.agentId || item?.id === skill?.id)
  const label = localizedText(agent?.name) || localizedText(skill?.name) || skill?.id
  return {
    label: String(label).replace(/技能倍率$/u, "").trim() || skill?.id,
    value: skill?.id,
  }
}).filter((option: any) => option.value))

const defaultSkillCatalog = computed(() => (props.meta?.agentSkills ?? [])
  .find((skill: any) => skill?.id === props.agentId || skill?.agentId === props.agentId)
  ?? (props.meta?.agentSkills ?? [])[0]
  ?? null)

function skillCatalogById(agentSkillId = "") {
  return (props.meta?.agentSkills ?? []).find((skill: any) => skill?.id === agentSkillId || skill?.agentId === agentSkillId)
    ?? defaultSkillCatalog.value
    ?? null
}

function rowsForSkillTarget(category: any, move: any) {
  return damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {})
}

function optionValueExists(options: Array<{ value: string }>, value = "") {
  return options.some(option => option.value === value)
}

function normalizedCustomSkillTarget(target: any = {}) {
  const selectedSkillId = target.agentSkillId && optionValueExists(agentSkillOptions.value, target.agentSkillId)
    ? target.agentSkillId
    : defaultSkillCatalog.value?.id ?? agentSkillOptions.value[0]?.value ?? ""
  const skill = skillCatalogById(selectedSkillId)
  const categories = skill?.categories ?? []
  const category = categories.find((item: any) => item?.id === target.categoryId) ?? categories[0] ?? null
  const moves = category?.moves ?? []
  const move = moves.find((item: any) => item?.id === target.moveId) ?? moves[0] ?? null
  const rows = rowsForSkillTarget(category, move)
  const row = rows.find((item: any) => item?.id === target.rowId) ?? null
  return {
    agentSkillId: selectedSkillId,
    categoryId: category?.id ?? "",
    moveId: move?.id ?? "",
    ...(row ? { rowId: row.id } : {}),
  }
}

const customSkillTargetFields = computed(() => {
  const current = normalizedCustomSkillTarget(customRow.value.skillTargets?.[0] ?? {})
  const skill = skillCatalogById(current.agentSkillId)
  const categories = skill?.categories ?? []
  const category = categories.find((item: any) => item?.id === current.categoryId) ?? categories[0] ?? null
  const moves = category?.moves ?? []
  const move = moves.find((item: any) => item?.id === current.moveId) ?? moves[0] ?? null
  return {
    target: current,
    skillOptions: agentSkillOptions.value,
    categoryOptions: categories.map((item: any) => ({ label: labelOf(item), value: item.id })),
    moveOptions: moves.map((item: any) => ({ label: labelOf(item), value: item.id })),
    rowOptions: [
      { label: "整招式", value: "" },
      ...rowsForSkillTarget(category, move).map((item: any) => ({
        label: localizedText(item?.label) || labelOf(item) || item?.id,
        value: item.id,
      })),
    ],
  }
})

function setCustomTargetKind(value: string) {
  customRow.value = {
    targetKind: value === "skill" ? "skill" : "default",
    optionIndex: 0,
    value: customRow.value.value ?? 0,
    skillTargets: value === "skill" ? [normalizedCustomSkillTarget({})] : [{}],
  }
}

function setCustomOptionIndex(value: number | string) {
  customRow.value = {
    ...customRow.value,
    optionIndex: Number(value) || 0,
  }
}

function setCustomSkillTarget(target: any) {
  customRow.value = {
    ...customRow.value,
    skillTargets: [normalizedCustomSkillTarget(target)],
  }
}

function updateCustomSkillAgent(agentSkillId: string) {
  setCustomSkillTarget({ agentSkillId })
}

function updateCustomSkillCategory(categoryId: string) {
  const current = customSkillTargetFields.value.target
  setCustomSkillTarget({ agentSkillId: current.agentSkillId, categoryId })
}

function updateCustomSkillMove(moveId: string) {
  const current = customSkillTargetFields.value.target
  setCustomSkillTarget({
    agentSkillId: current.agentSkillId,
    categoryId: current.categoryId,
    moveId,
  })
}

function updateCustomSkillRow(rowId: string) {
  const current = customSkillTargetFields.value.target
  setCustomSkillTarget({
    ...current,
    rowId,
  })
}

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
  const period = fieldBuffPeriod(buff)
  return [
    buffDisplayName(buff),
    localizedText(buff?.name),
    localizedText(buff?.description),
    localizedText(buff?.conditionLabel),
    localizedText(buff?.sourceLabel),
    localizedText(buff?.source),
    localizedText(buff?.sourcePeriod),
    period.gameVersion,
    fieldBuffPhaseLabel(buff),
    localizedText(buff?.ownerName),
    buff?.id,
  ].filter(Boolean).join(" ").toLowerCase()
}

const fieldBuffs = computed(() => groupedBuffs.value.field ?? [])

const fieldVersionOptions = computed(() => {
  const versions = [...new Set(fieldBuffs.value
    .map(buff => fieldBuffPeriod(buff).gameVersion)
    .filter(Boolean))]
  return versions
    .sort((left, right) => compareGameVersions(right, left))
    .map(version => ({ label: `${version}版本`, value: version }))
})

const selectedFieldVersion = computed(() => fieldVersion.value || fieldVersionOptions.value[0]?.value || "")

const fieldPeriodOptions = computed(() => {
  const seen = new Set<string>()
  return fieldBuffs.value
    .filter(buff => fieldBuffPeriod(buff).gameVersion === selectedFieldVersion.value)
    .sort((left, right) => {
      const leftPeriod = fieldBuffPeriod(left)
      const rightPeriod = fieldBuffPeriod(right)
      return rightPeriod.phaseNo - leftPeriod.phaseNo
        || String(localizedText(right.source)).localeCompare(String(localizedText(left.source)), "zh-CN")
    })
    .map(buff => {
      const key = fieldBuffPeriodKey(buff)
      if (!key || seen.has(key)) {
        return null
      }
      seen.add(key)
      return {
        label: fieldBuffPeriodLabel(buff) || fieldBuffPhaseLabel(buff) || key,
        value: key,
      }
    })
    .filter(Boolean) as Array<{ label: string, value: string }>
})

const selectedFieldPeriod = computed(() => fieldPeriod.value || fieldPeriodOptions.value[0]?.value || "")

const fieldNameOptions = computed(() => [
  { label: "全部名称", value: "" },
  ...fieldBuffs.value
    .filter(buff => fieldBuffPeriod(buff).gameVersion === selectedFieldVersion.value)
    .filter(buff => !selectedFieldPeriod.value || fieldBuffPeriodKey(buff) === selectedFieldPeriod.value)
    .map(buff => ({
      label: buffDisplayName(buff),
      value: buff.id,
    })),
])

function syncFieldFilters() {
  const nextVersion = fieldVersionOptions.value[0]?.value ?? ""
  if (!fieldVersion.value || !fieldVersionOptions.value.some(option => option.value === fieldVersion.value)) {
    fieldVersion.value = nextVersion
  }

  const nextPeriod = fieldPeriodOptions.value[0]?.value ?? ""
  if (!fieldPeriod.value || !fieldPeriodOptions.value.some(option => option.value === fieldPeriod.value)) {
    fieldPeriod.value = nextPeriod
  }

  if (fieldName.value && !fieldNameOptions.value.some(option => option.value === fieldName.value)) {
    fieldName.value = ""
  }
}

watch(fieldBuffs, syncFieldFilters)
watch(fieldVersion, () => {
  fieldPeriod.value = ""
  fieldName.value = ""
  syncFieldFilters()
})
watch(fieldPeriod, () => {
  fieldName.value = ""
  syncFieldFilters()
})

function fieldBuffMatchesFilters(buff: any) {
  const period = fieldBuffPeriod(buff)
  return (!selectedFieldVersion.value || period.gameVersion === selectedFieldVersion.value)
    && (!selectedFieldPeriod.value || fieldBuffPeriodKey(buff) === selectedFieldPeriod.value)
    && (!fieldName.value || buff.id === fieldName.value)
}

const categoryBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const source = activeTab.value === "field"
    ? fieldBuffs.value.filter(fieldBuffMatchesFilters)
    : groupedBuffs.value[activeTab.value] ?? []
  return source
    .filter(buff => !needle || buffText(buff).includes(needle))
})

const customBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return draftAddedBuffs.value.filter(buff => !needle || buffText(buff).includes(needle))
})

const visibleBuffs = computed(() => activeTab.value === "custom" ? customBuffs.value : categoryBuffs.value)
const selectedCount = computed(() => draft.value.size + draftAddedBuffs.value.length)
const canBulkAddVisible = computed(() => activeTab.value !== "custom" && activeTab.value !== "field")

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
  const nextRuntime = { ...draftRuntimeInputs.value }
  if (checked) {
    const fieldBuff = fieldBuffs.value.find(buff => buff.id === id)
    if (fieldBuff) {
      const key = fieldBuffPeriodKey(fieldBuff)
      if (key) {
        for (const buff of fieldBuffs.value) {
          if (buff.id !== id && fieldBuffPeriodKey(buff) === key) {
            next.delete(buff.id)
            delete nextRuntime[buff.id]
          }
        }
      }
    }
    next.add(id)
  } else {
    next.delete(id)
    delete nextRuntime[id]
  }
  draft.value = next
  draftRuntimeInputs.value = nextRuntime
}

function addVisibleBuffs() {
  if (!canBulkAddVisible.value) {
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
  const nextRuntime = { ...draftRuntimeInputs.value }
  for (const buff of visibleBuffs.value) {
    next.delete(buff.id)
    delete nextRuntime[buff.id]
  }
  draft.value = next
  draftRuntimeInputs.value = nextRuntime
}

function addCustomBuff() {
  const option = customOptionList.value[Number(customRow.value.optionIndex) || 0]
  const value = Number(customRow.value.value ?? 0)
  if (!option || !Number.isFinite(value) || value === 0) {
    return
  }
  const [optionStat, label, mode, basis] = option
  const stat = resolveCustomBuffStatOption(optionStat)
  const stats = mode !== "eventModifier" && customRow.value.targetKind !== "skill"
    ? [normalizeCustomBuffStat({
        id: "stat-1",
        label: resolveCustomBuffStatLabel(optionStat, label),
        stat,
        value,
        mode,
        basis,
      }, props.meta)].filter(Boolean)
    : []
  const effects = mode === "eventModifier" || customRow.value.targetKind === "skill"
    ? [normalizeCustomBuffEffect({
        id: "effect-1",
        type: "fixed",
        stat,
        label: resolveCustomBuffStatLabel(optionStat, label),
        value,
        mode: "flat",
        target: customRow.value.targetKind === "skill"
          ? { kind: "skill", skillTargets: [normalizedCustomSkillTarget(customRow.value.skillTargets?.[0] ?? {})] }
          : { kind: "default" },
      })].filter(Boolean)
    : []
  if (!stats.length && !effects.length) {
    return
  }
  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  draftAddedBuffs.value = [
    ...draftAddedBuffs.value,
    {
      id,
      sourceCategory: "custom",
      sourceKind: "custom",
      name: { zhCN: customName.value.trim() || "自定义 Buff" },
      stats,
      effects,
    },
  ]
  customName.value = "自定义 Buff"
  customRow.value = {
    targetKind: "default",
    optionIndex: 0,
    value: 0,
    skillTargets: [{}],
  }
}

function resolveCustomBuffStatOption(stat: string) {
  if (stat === "enemyDefIgnore") {
    return "enemyDefReduction"
  }
  if (stat === "currentResIgnore") {
    return RES_IGNORE_STAT_BY_ELEMENT[currentDamageElement.value] ?? "physicalResIgnore"
  }
  return stat
}

function resolveCustomBuffStatLabel(stat: string, fallbackLabel: string) {
  const elementLabel = damageElementShortLabel(currentDamageElement.value)
  if (stat === "currentResIgnore") {
    return `${elementLabel}抗性无视%`
  }
  if (stat === "enemyResReduction") {
    return `${elementLabel}减抗%`
  }
  return fallbackLabel
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
        <NButton size="small" :disabled="!canBulkAddVisible" @click="addVisibleBuffs">添加当前列表</NButton>
        <NButton size="small" :disabled="activeTab === 'custom'" @click="removeVisibleBuffs">移除当前列表</NButton>
      </div>

      <NTabs v-model:value="activeTab" class="buff-category-tabs" type="segment">
        <NTabPane v-for="tab in categoryTabs" :key="tab.name" :name="tab.name" :tab="tab.label" />
      </NTabs>

      <div v-if="activeTab === 'field'" class="field-buff-filter-row">
        <label class="custom-field">
          <span>版本</span>
          <NSelect
            v-model:value="fieldVersion"
            :options="fieldVersionOptions"
          />
        </label>
        <label class="custom-field">
          <span>期数</span>
          <NSelect
            v-model:value="fieldPeriod"
            :options="fieldPeriodOptions"
          />
        </label>
        <label class="custom-field">
          <span>名称</span>
          <NSelect
            v-model:value="fieldName"
            :options="fieldNameOptions"
          />
        </label>
      </div>

      <div v-if="activeTab === 'custom'" class="custom-buff-editor">
        <NInput v-model:value="customName" placeholder="名称" />
        <div class="custom-effect-list">
          <div class="custom-effect-row">
            <label class="custom-field">
              <span>增幅对象</span>
              <NSelect
                :value="customRow.targetKind"
                :options="customTargetKindOptions"
                @update:value="setCustomTargetKind(String($event))"
              />
            </label>
            <label class="custom-field">
              <span>增幅类型</span>
              <NSelect
                :value="customRow.optionIndex"
                :options="customStatOptions"
                filterable
                @update:value="setCustomOptionIndex"
              />
            </label>
            <label class="custom-field">
              <span>数值</span>
              <NInputNumber v-model:value="customRow.value" :step="0.1" />
            </label>
          </div>
          <div v-if="customRow.targetKind === 'skill'" class="custom-skill-target-row">
            <label class="custom-field">
              <span>技能表</span>
              <NSelect
                :value="customSkillTargetFields.target.agentSkillId"
                :options="customSkillTargetFields.skillOptions"
                @update:value="updateCustomSkillAgent(String($event))"
              />
            </label>
            <label class="custom-field">
              <span>技能大类</span>
              <NSelect
                :value="customSkillTargetFields.target.categoryId"
                :options="customSkillTargetFields.categoryOptions"
                @update:value="updateCustomSkillCategory(String($event))"
              />
            </label>
            <label class="custom-field">
              <span>招式</span>
              <NSelect
                :value="customSkillTargetFields.target.moveId"
                :options="customSkillTargetFields.moveOptions"
                @update:value="updateCustomSkillMove(String($event))"
              />
            </label>
            <label class="custom-field">
              <span>倍率行</span>
              <NSelect
                :value="customSkillTargetFields.target.rowId ?? ''"
                :options="customSkillTargetFields.rowOptions"
                @update:value="updateCustomSkillRow(String($event))"
              />
            </label>
          </div>
        </div>
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

.field-buff-filter-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.72fr) minmax(180px, 1fr) minmax(180px, 1fr);
  gap: 10px;
  align-items: end;
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
  grid-template-columns: minmax(120px, 0.8fr) minmax(220px, 1.4fr) minmax(120px, 0.8fr);
  gap: 8px;
  align-items: end;
}

.custom-skill-target-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 8px;
  align-items: end;
}

.custom-field {
  display: grid;
  gap: 5px;
  min-width: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
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

  .custom-effect-row,
  .field-buff-filter-row,
  .custom-skill-target-row {
    grid-template-columns: 1fr;
  }
}
</style>
