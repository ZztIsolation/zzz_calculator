<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInput, NInputNumber, NModal, NRadioButton, NRadioGroup, NSelect, NScrollbar, NTabPane, NTabs, NTag } from "naive-ui"
import ExpandToggle from "@/components/ExpandToggle.vue"
import { BUFF_EFFECT_GROUPS, effectGroupsForRules, type BuffEffectGroup } from "@/utils/buffEffectGroups"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import TeammateSelect from "@/components/TeammateSelect.vue"
import TeammateBuffCard from "@/components/TeammateBuffCard.vue"
import { recordEnkaTeammateEdit, syncEnkaTeammates, teammateImportStatus, teammateLoadoutOptions, type TeammateSources, type TeammateSyncOperation } from '@/utils/enkaTeammates'
import { thumbnailForBuff } from "@/utils/assets"
import {
  inferBuffPickerState,
  isTeammatePotentialBuff,
  clearManualTeammateKeys,
  hasManualTeammateKey,
  normalizeBuffPickerState,
  teammateCinemaLevel,
  teammateOwnerId,
  type BuffPickerState,
} from "@/utils/teammateBuffPicker"
import {
  BUFF_CATEGORY_TABS,
  buildCombatBuffGroups,
  teammateBuffCandidates,
  teamWEngineBuffCandidates,
  type BuffCategory,
} from "@/utils/combatBuffs"
import { damageSkillRowsWithGeneratedTotals } from "@core/skillMultiplierCandidates.js"
import { SKILL_TYPES, SKILL_TYPE_LABELS, normalizeSkillTargetsInValue, skillTypeForMove } from "@core/skillTargets.js"
import { attributeLabel, buffDisplayName, buffSubtitle, labelOf, specialtyLabel, statLabel } from "@/utils/format"
import {
  CUSTOM_BUFF_SKILL_STAT_OPTIONS,
  CUSTOM_BUFF_STAT_OPTIONS,
  RES_IGNORE_STAT_BY_ELEMENT,
  compareGameVersions,
  damageElementForAgent,
  damageElementShortLabel,
  effectRuleCoverage,
  effectRuleId,
  fieldBuffPeriod,
  fieldBuffPeriodKey,
  fieldBuffPeriodLabel,
  fieldBuffPhaseLabel,
  localizedText,
  normalizeCustomBuffEffect,
  normalizeCustomBuffStat,
  normalizeRuntimeForBuff,
  normalizedRuntimeParameterValue,
  runtimeEffectRules,
  runtimeParameterDefinitions,
  runtimeSourceGroups,
  runtimeStackGroups,
  runtimeCoverageForEffectRule,
  storedBuffModifierTexts,
  storedEffectRuleText,
} from "@core/shared-combat.js"

const props = defineProps<{
  show: boolean
  buffs: any[]
  selectedIds: string[]
  defaultIds?: string[]
  addedBuffs?: any[]
  runtimeInputs?: Record<string, any>
  buffPickerState?: BuffPickerState | null
  resetNotice?: string
  meta?: any
  driveDiscSets?: any[]
  agentId?: string
  coreSkillLevel?: string
  cinemaLevel?: number
  potentialLevel?: number
  wEngineId?: string
  wEngineModificationLevel?: number
  inCombatPanel?: Record<string, number> | null
  teammateSources?: TeammateSources
  save?: (payload: any) => Promise<void>
  outOfCombatPanel?: Record<string, number> | null
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  apply: [value: {
    selectedBuffIds: string[]
    addedBuffs: any[]
    runtimeInputs: Record<string, any>
    buffPickerState: BuffPickerState
  }]
}>()

const categoryTabs = BUFF_CATEGORY_TABS
const activeTab = ref<BuffCategory>("self")
const query = ref("")
const draft = ref<Set<string>>(new Set())
const draftAddedBuffs = ref<any[]>([])
const draftRuntimeInputs = ref<Record<string, any>>({})
const draftBuffPickerState = ref<BuffPickerState>({ teammateSlots: [null, null] })
const saving = ref(false)
const saveError = ref('')

function syncTeammates(operation: TeammateSyncOperation = { kind: 'refresh' }) {
  if (!props.teammateSources) return
  const result = syncEnkaTeammates({
    selectedBuffIds: [...draft.value], addedBuffs: draftAddedBuffs.value,
    runtimeInputs: draftRuntimeInputs.value, buffPickerState: draftBuffPickerState.value,
  }, props.teammateSources, props.meta, props.agentId ?? '', operation, props.wEngineId)
  draft.value = new Set(result.payload.selectedBuffIds)
  draftAddedBuffs.value = result.payload.addedBuffs
  draftRuntimeInputs.value = result.payload.runtimeInputs
  draftBuffPickerState.value = result.payload.buffPickerState
}

function setTeammateLoadout(index: number, value: string | null) {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  if (!slot) return
  recordEnkaTeammateEdit(draftBuffPickerState.value, `loadout:${index}`, value || null)
  if (value) slot.loadoutId = value
  else delete slot.loadoutId
  syncTeammates()
}

function clearImportedOverride(key: string) {
  clearManualTeammateKeys(draftBuffPickerState.value, candidate => candidate === key)
  if (draftBuffPickerState.value.enka?.overrides) delete draftBuffPickerState.value.enka.overrides[key]
  syncTeammates({ kind: 'restore', key })
}

function teammateSourceLabel(buff: any): string {
  const enabledKey = `enabled:${buff.id}`
  const runtimeKey = `runtime:${buff.id}`
  if (hasManualTeammateKey(draftBuffPickerState.value, enabledKey)
    || hasManualTeammateKey(draftBuffPickerState.value, runtimeKey)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, enabledKey)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, runtimeKey)) return '用户修改'
  const owner = teammateOwnerId(buff)
  const imported = Boolean(props.teammateSources?.uid
    && props.teammateSources.history[owner]?.uid === props.teammateSources.uid
    && props.teammateSources.history[owner]?.completeness === 'full')
  if (imported) return 'Enka 导入'
  return draftBuffPickerState.value.origin === 'adminDefault' ? '管理员默认' : ''
}

function canRestoreTeammateBuff(buff: any): boolean {
  const source = teammateSourceLabel(buff)
  return source === '用户修改' && Boolean(props.teammateSources?.uid)
}
const fieldVersion = ref("")
const fieldPeriod = ref("")
const fieldName = ref("")
const bossVersion = ref("")
const bossPeriod = ref("")
const bossName = ref("")
const customName = ref("自定义 Buff")
const customRow = ref<any>({
  targetKind: "default",
  optionIndex: 0,
  value: 0,
  skillTargets: [],
})
// 记录用户手动切换过展开状态的条目：已选条目默认展开、未选默认收起，点箭头在默认值上取反。
const expandedBuffs = ref<Set<string>>(new Set())
// 筛选标签：效果分类、音擎特性；切换页签或重新打开弹窗时回到“全部”
const effectFilter = ref<BuffEffectGroup | "all">("all")
const specialtyFilter = ref<string>("all")
// 已选置顶以打开弹窗/切换页签时的选择为准，勾选时不立刻跳位，列表不会在手下移动
const pinnedIds = ref<Set<string>>(new Set())
function resetListFilters() {
  effectFilter.value = "all"
  specialtyFilter.value = "all"
  pinnedIds.value = new Set(draft.value)
}

function isBuffExpanded(buff: any) {
  return draft.value.has(buff?.id) !== expandedBuffs.value.has(String(buff?.id ?? ""))
}

function toggleBuffExpanded(buff: any) {
  const id = String(buff?.id ?? "")
  if (!id) return
  const next = new Set(expandedBuffs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedBuffs.value = next
}

watch(() => props.show, value => {
  if (value) {
    draftAddedBuffs.value = normalizeSkillTargetsInValue(JSON.parse(JSON.stringify(props.addedBuffs ?? [])))
    const teamWEngineCandidates = teamWEngineBuffCandidates(props.meta, props.wEngineId, draftAddedBuffs.value)
    const teamWEngineCandidateIds = new Set(teamWEngineCandidates.map((buff: any) => buff.id))
    const selected = new Set(props.selectedIds)
    for (const item of draftAddedBuffs.value) {
      if (item?.sourceKind === "wEngineTeam" && teamWEngineCandidateIds.has(item.id)) {
        selected.add(item.id)
      }
    }
    draft.value = selected
    draftBuffPickerState.value = normalizeBuffPickerState(props.buffPickerState)
      ?? inferBuffPickerState(groupedBuffs.value.teammate ?? [], selected)
    syncSelectedTeamWEngineReferences(teamWEngineCandidates)
    draftRuntimeInputs.value = JSON.parse(JSON.stringify(props.runtimeInputs ?? {}))
    saveError.value = ''
    syncTeammates()
    query.value = ""
    fieldVersion.value = ""
    fieldPeriod.value = ""
    fieldName.value = ""
    bossVersion.value = ""
    bossPeriod.value = ""
    bossName.value = ""
    activeTab.value = "self"
    expandedBuffs.value = new Set()
    resetListFilters()
    syncFieldFilters()
    syncBossFilters()
  }
})

const customTargetKindOptions = [
  { label: "常规属性 / 全局效果", value: "default" },
  { label: "指定角色招式", value: "specific" },
  { label: "通用技能大类", value: "skillType" },
]
const customSkillTypeOptions = SKILL_TYPES.map((value: string) => ({ label: SKILL_TYPE_LABELS[value] ?? value, value }))

type CustomBuffOption = [string, string, string, string | null]

const selectedAgent = computed(() => (props.meta?.agents ?? [])
  .find((agent: any) => agent?.id === props.agentId) ?? null)

const currentDamageElement = computed(() => damageElementForAgent(selectedAgent.value ?? {}))

const customOptionList = computed<CustomBuffOption[]>(() => {
  const options = customRow.value.targetKind !== "default" ? CUSTOM_BUFF_SKILL_STAT_OPTIONS : CUSTOM_BUFF_STAT_OPTIONS
  if (currentDamageElement.value !== "lumiflux") return options
  return options.filter(([stat]) => !["enemyResReduction", "allResIgnore", "currentResIgnore"].includes(stat))
})

const customStatOptions = computed(() => customOptionList.value.map((option, index) => ({
  label: option[1],
  value: index,
})))

const displayAgents = computed(() => props.meta?.displayAgents ?? props.meta?.agents ?? [])
const displayAgentSkills = computed(() => props.meta?.displayAgentSkills ?? props.meta?.agentSkills ?? [])

const agentSkillOptions = computed(() => displayAgentSkills.value.map((skill: any) => {
  const agent = displayAgents.value.find((item: any) => item?.id === skill?.agentId || item?.id === skill?.id)
  const label = localizedText(agent?.name) || localizedText(skill?.name) || skill?.id
  return {
    label: String(label).replace(/技能倍率$/u, "").trim() || skill?.id,
    value: skill?.id,
  }
}).filter((option: any) => option.value))

const defaultSkillCatalog = computed(() => displayAgentSkills.value
  .find((skill: any) => skill?.id === props.agentId || skill?.agentId === props.agentId)
  ?? (props.meta?.agentSkills ?? [])[0]
  ?? null)

function skillCatalogById(agentSkillId = "") {
  return displayAgentSkills.value.find((skill: any) => skill?.id === agentSkillId || skill?.agentId === agentSkillId)
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
  const availableTypes = SKILL_TYPES.filter((skillType: string) => categories.some((category: any) =>
    (category.moves ?? []).some((move: any) => skillTypeForMove(category, move) === skillType)))
  const selectedSkillType = availableTypes.includes(target.skillType) ? target.skillType : availableTypes[0] ?? "basic"
  const category = categories.find((item: any) => item?.id === target.categoryId
    && (item.moves ?? []).some((move: any) => skillTypeForMove(item, move) === selectedSkillType))
    ?? categories.find((item: any) => (item.moves ?? []).some((move: any) => skillTypeForMove(item, move) === selectedSkillType))
    ?? null
  const moves = (category?.moves ?? []).filter((move: any) => skillTypeForMove(category, move) === selectedSkillType)
  const explicitlyAllMoves = Object.prototype.hasOwnProperty.call(target, "moveId") && !target.moveId
  const move = explicitlyAllMoves ? null : moves.find((item: any) => item?.id === target.moveId) ?? moves[0] ?? null
  const rows = rowsForSkillTarget(category, move)
  const row = rows.find((item: any) => item?.id === target.rowId) ?? null
  return {
    kind: "specific",
    agentSkillId: selectedSkillId,
    categoryId: category?.id ?? "",
    skillType: selectedSkillType,
    ...(move ? { moveId: move.id } : {}),
    ...(row ? { rowId: row.id } : {}),
  }
}

const customSkillTargetFields = computed(() => {
  const current = normalizedCustomSkillTarget(customRow.value.skillTargets?.[0] ?? {})
  const skill = skillCatalogById(current.agentSkillId)
  const categories = skill?.categories ?? []
  const category = categories.find((item: any) => item?.id === current.categoryId) ?? null
  const moves = (category?.moves ?? []).filter((item: any) => skillTypeForMove(category, item) === current.skillType)
  const move = moves.find((item: any) => item?.id === current.moveId) ?? null
  const availableTypes = new Set<string>()
  for (const candidateCategory of categories) for (const candidateMove of candidateCategory.moves ?? []) {
    const skillType = skillTypeForMove(candidateCategory, candidateMove)
    if (skillType) availableTypes.add(skillType)
  }
  return {
    target: current,
    skillOptions: agentSkillOptions.value,
    skillTypeOptions: customSkillTypeOptions.filter(option => availableTypes.has(option.value)),
    moveOptions: [
      { label: "该角色此大类的全部招式", value: "" },
      ...moves.map((item: any) => ({ label: labelOf(item), value: item.id })),
    ],
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
  const targetKind = ["specific", "skillType"].includes(value) ? value : "default"
  customRow.value = {
    targetKind,
    optionIndex: 0,
    value: customRow.value.value ?? 0,
    skillTargets: targetKind === "specific"
      ? [normalizedCustomSkillTarget({})]
      : targetKind === "skillType"
        ? [{ kind: "skillType", skillType: "basic" }]
        : [],
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

function updateCustomSkillType(skillType: string) {
  const current = customSkillTargetFields.value.target
  setCustomSkillTarget({ agentSkillId: current.agentSkillId, skillType })
}

function updateCustomGeneralSkillTypes(values: Array<string | number>) {
  customRow.value = {
    ...customRow.value,
    skillTargets: values.map(value => ({ kind: "skillType", skillType: String(value) })),
  }
}

function updateCustomSkillMove(moveId: string) {
  const current = customSkillTargetFields.value.target
  setCustomSkillTarget({
    agentSkillId: current.agentSkillId,
    categoryId: current.categoryId,
    skillType: current.skillType,
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
    coreSkillLevel: props.coreSkillLevel,
    cinemaLevel: props.cinemaLevel,
    potentialLevel: props.potentialLevel,
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
  groups.teammate = groups.teammate.filter((buff: any) => buff?.hidden !== true)
  return groups
})

function buffText(buff: any) {
  const period = fieldBuffPeriod(buff)
  const bossEntryText = [...(buff?.playerBuffs ?? []), ...(buff?.playerDebuffs ?? [])]
    .flatMap(entry => [localizedText(entry?.name), localizedText(entry?.description), localizedText(entry?.unmodeledReason)])
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
    buff?.teammateAttribute ? attributeLabel(buff.teammateAttribute) : "",
    buff?.teammateSpecialty ? specialtyLabel(buff.teammateSpecialty) : "",
    ...(buff?.aliases ?? []),
    ...bossAppearances(buff).map(bossAppearanceLabel),
    localizedText(buff?.enemyIntel),
    ...bossEntryText,
    buff?.id,
  ].filter(Boolean).join(" ").toLowerCase()
}

const fieldBuffs = computed(() => groupedBuffs.value.field ?? [])
const bossBuffs = computed(() => groupedBuffs.value.boss ?? [])

const bossModeLabels: Record<string, string> = {
  critical_assault: "危局强袭战",
  defense_v5: "式舆防卫战",
}

const bossElementLabels: Record<string, string> = {
  physical: "物理",
  fire: "火",
  ice: "冰",
  electric: "电",
  ether: "以太",
  wind: "风",
}

function bossAppearances(buff: any) {
  if (Array.isArray(buff?.appearances) && buff.appearances.length) return buff.appearances
  const period = fieldBuffPeriod(buff)
  return period.gameVersion ? [period] : []
}

function bossAppearanceKey(appearance: any) {
  return [appearance?.modeId ?? "", appearance?.gameVersion ?? "", Number(appearance?.phaseNo) || ""].join(":")
}

function bossAppearanceLabel(appearance: any) {
  const mode = bossModeLabels[String(appearance?.modeId ?? "")] ?? String(appearance?.modeId ?? "敌情")
  const version = String(appearance?.gameVersion ?? "?")
  const phase = Number(appearance?.phaseNo)
  return `${mode} · ${version}版本第${Number.isFinite(phase) ? phase : "?"}期`
}

function bossMatchesAppearance(buff: any, version: string, periodKey = "") {
  return bossAppearances(buff).some((appearance: any) => (
    (!version || appearance.gameVersion === version)
      && (!periodKey || bossAppearanceKey(appearance) === periodKey)
  ))
}

function bossDisplayName(buff: any) {
  return localizedText(buff?.bossName) || buffDisplayName(buff)
}

function bossEntryGroups(buff: any) {
  return [
    { key: "buffs", label: "玩家增益", entries: buff?.playerBuffs ?? [] },
    { key: "debuffs", label: "玩家减益", entries: buff?.playerDebuffs ?? [] },
  ].filter(group => group.entries.length)
}

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
      const phaseOrder = rightPeriod.phaseNo - leftPeriod.phaseNo
      if (phaseOrder !== 0) return phaseOrder
      // When both modes publish the same current phase, Defense Battle is the active default.
      const modeOrder = (modeId: string) => modeId === "defense_v5" ? 1 : 0
      return modeOrder(rightPeriod.modeId) - modeOrder(leftPeriod.modeId)
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

const bossVersionOptions = computed(() => {
  const versions = [...new Set(bossBuffs.value
    .flatMap(buff => bossAppearances(buff).map((appearance: any) => appearance.gameVersion))
    .filter(Boolean))]
  return versions
    .sort((left, right) => compareGameVersions(right, left))
    .map(version => ({ label: `${version}版本`, value: version }))
})

const selectedBossVersion = computed(() => bossVersion.value || bossVersionOptions.value[0]?.value || "")

const bossPeriodOptions = computed(() => {
  const appearances = bossBuffs.value
    .flatMap(buff => bossAppearances(buff))
    .filter((appearance: any) => appearance.gameVersion === selectedBossVersion.value)
    .sort((left: any, right: any) => Number(right.phaseNo) - Number(left.phaseNo)
      || String(right.modeId).localeCompare(String(left.modeId)))
  const seen = new Set<string>()
  return appearances.flatMap((appearance: any) => {
    const key = bossAppearanceKey(appearance)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ label: bossAppearanceLabel(appearance), value: key }]
  })
})

const selectedBossPeriod = computed(() => bossPeriod.value || bossPeriodOptions.value[0]?.value || "")

const bossNameOptions = computed(() => {
  const seen = new Set<string>()
  return [
    { label: "全部 Boss", value: "" },
    ...bossBuffs.value
      .filter(buff => bossMatchesAppearance(buff, selectedBossVersion.value, selectedBossPeriod.value))
      .flatMap(buff => {
        const value = String(buff?.bossId ?? buff?.id ?? "")
        if (!value || seen.has(value)) return []
        seen.add(value)
        return [{ label: bossDisplayName(buff), value }]
      }),
  ]
})

function syncBossFilters() {
  const nextVersion = bossVersionOptions.value[0]?.value ?? ""
  if (!bossVersion.value || !bossVersionOptions.value.some(option => option.value === bossVersion.value)) {
    bossVersion.value = nextVersion
  }
  const nextPeriod = bossPeriodOptions.value[0]?.value ?? ""
  if (!bossPeriod.value || !bossPeriodOptions.value.some(option => option.value === bossPeriod.value)) {
    bossPeriod.value = nextPeriod
  }
  if (bossName.value && !bossNameOptions.value.some(option => option.value === bossName.value)) {
    bossName.value = ""
  }
}

watch(bossBuffs, syncBossFilters)
watch(bossVersion, () => {
  bossPeriod.value = ""
  bossName.value = ""
  syncBossFilters()
})
watch(bossPeriod, () => {
  bossName.value = ""
  syncBossFilters()
})

function bossBuffMatchesFilters(buff: any) {
  return bossMatchesAppearance(buff, selectedBossVersion.value, selectedBossPeriod.value)
    && (!bossName.value || String(buff?.bossId ?? buff?.id ?? "") === bossName.value)
}

const teammateOwners = computed(() => {
  const owners = new Map<string, any>()
  for (const buff of groupedBuffs.value.teammate) {
    const id = teammateOwnerId(buff)
    if (id && id !== props.agentId && !owners.has(id)) owners.set(id, buff)
  }
  return [...owners].map(([value, buff]) => ({
    value,
    label: localizedText(buff.ownerName ?? buff.teammateName) || value,
    buff,
  }))
})

const teammateCinemaOptions = Array.from({ length: 7 }, (_, value) => ({ label: `${value} 影`, value }))

function teammateOptionsFor(index: number) {
  const otherId = draftBuffPickerState.value.teammateSlots[1 - index]?.teammateId
  return teammateOwners.value
    .filter(owner => owner.value !== otherId)
    .map(({ label, value, buff }) => ({ label, value, specialty: buff.teammateSpecialty, avatar: thumbnailForBuff(buff),
      importStatus: teammateImportStatus(props.teammateSources, value) }))
}

function setTeammateSlot(index: number, value: string | null) {
  const teammateId = String(value ?? "").trim()
  const slots = draftBuffPickerState.value.teammateSlots
  const previousId = slots[index]?.teammateId
  if ((previousId ?? "") === teammateId || (teammateId && (slots[1 - index]?.teammateId === teammateId
    || !teammateOwners.value.some(owner => owner.value === teammateId)))) return

  recordEnkaTeammateEdit(draftBuffPickerState.value, `slot:${index}:teammateId`, teammateId || null, previousId || null)

  if (previousId) {
    // Include catalog entries that are no longer displayed when removing an owner.
    const meta = props.meta ?? {}
    const allCandidates = teammateBuffCandidates({
      ...meta,
      displayTeammateCombatBuffGroups: meta.teammateCombatBuffGroups ?? meta.displayTeammateCombatBuffGroups,
      displayCombatBuffs: meta.combatBuffs ?? meta.displayCombatBuffs,
    })
    const ids = new Set([...groupedBuffs.value.teammate, ...allCandidates]
      .filter(buff => teammateOwnerId(buff) === previousId).map(buff => buff.id))
    clearManualTeammateKeys(draftBuffPickerState.value, key => key === `cinema:${previousId}`
      || [...ids].some(id => key === `enabled:${id}` || key === `runtime:${id}` || key === `engine:${id}`))
    draft.value = new Set([...draft.value].filter(id => !ids.has(id)))
    draftRuntimeInputs.value = Object.fromEntries(Object.entries(draftRuntimeInputs.value)
      .filter(([id]) => !ids.has(id) && id !== `teammate:${previousId}`))
  }
  const nextSlots = [...slots] as BuffPickerState["teammateSlots"]
  nextSlots[index] = teammateId ? { teammateId, cinemaLevel: 0 } : null
  draftBuffPickerState.value = { ...draftBuffPickerState.value, teammateSlots: nextSlots }
  if (teammateId) {
    for (const buff of groupedBuffs.value.teammate) {
      if (teammateOwnerId(buff) === teammateId && teammateCinemaLevel(buff) === null
        && !isTeammatePotentialBuff(buff)) toggle(buff.id, true, false)
    }
  }
  syncTeammates({ kind: 'select', slotIndex: index })
}

function setTeammateCinema(index: number, value: number) {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  const cinemaLevel = Math.max(0, Math.min(6, Math.trunc(Number(value) || 0)))
  if (!slot || slot.cinemaLevel === cinemaLevel) return
  recordEnkaTeammateEdit(draftBuffPickerState.value, `cinema:${slot.teammateId}`, cinemaLevel, slot.cinemaLevel)
  const slots = [...draftBuffPickerState.value.teammateSlots] as BuffPickerState["teammateSlots"]
  slots[index] = { ...slot, cinemaLevel }
  draftBuffPickerState.value = { ...draftBuffPickerState.value, teammateSlots: slots }
  const source = props.teammateSources
  if (source?.uid && source.history[slot.teammateId]?.uid === source.uid
    && source.history[slot.teammateId]?.completeness === 'full') {
    syncTeammates({ kind: 'cinema', slotIndex: index })
    return
  }
  for (const buff of groupedBuffs.value.teammate) {
    const level = teammateCinemaLevel(buff)
    if (teammateOwnerId(buff) === slot.teammateId && level !== null) toggle(buff.id, level <= cinemaLevel, false)
  }
}

function teammateCinemaSource(index: number): string {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  if (!slot) return ''
  if (hasManualTeammateKey(draftBuffPickerState.value, `cinema:${slot.teammateId}`)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, `cinema:${slot.teammateId}`)) return '用户修改'
  const imported = Boolean(props.teammateSources?.uid
    && props.teammateSources.history[slot.teammateId]?.uid === props.teammateSources.uid
    && props.teammateSources.history[slot.teammateId]?.completeness === 'full')
  if (imported) return 'Enka 导入'
  return draftBuffPickerState.value.origin === 'adminDefault' ? '管理员默认' : ''
}

function restoreTeammateCinema(index: number) {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  if (!slot) return
  clearImportedOverride(`cinema:${slot.teammateId}`)
}

const categoryBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const source = activeTab.value === "field"
    ? fieldBuffs.value.filter(fieldBuffMatchesFilters)
    : activeTab.value === "boss"
      ? bossBuffs.value.filter(bossBuffMatchesFilters)
      : activeTab.value === "teammate"
        ? (groupedBuffs.value.teammate ?? []).filter(buff => draftBuffPickerState.value.teammateSlots
          .some(slot => slot?.teammateId === teammateOwnerId(buff)))
        : groupedBuffs.value[activeTab.value] ?? []
  return source
    .filter(buff => !needle || buffText(buff).includes(needle))
})

function effectGroupsFor(buff: any): Set<BuffEffectGroup> {
  return effectGroupsForRules(runtimeEffectRules(buff, runtimeFor(buff)))
}

function buffSpecialty(buff: any): string {
  return String(buff?.ownerSpecialty ?? "")
}

// 当前页签里实际出现的效果分类 / 特性，只显示有内容的标签
const effectFilterOptions = computed(() => {
  if (activeTab.value === "custom") return []
  const present = new Set<BuffEffectGroup>()
  for (const buff of categoryBuffs.value) for (const group of effectGroupsFor(buff)) present.add(group)
  return BUFF_EFFECT_GROUPS.filter(group => present.has(group.id))
})
const specialtyFilterOptions = computed(() => {
  if (activeTab.value !== "teammateWEngine") return []
  const present = [...new Set(categoryBuffs.value.map(buffSpecialty).filter(Boolean))]
  return present.map(value => ({ value, label: specialtyLabel(value) || value }))
})

// 搜索或场地条件改变后，不让不可见的旧筛选继续隐藏所有结果。
watch(effectFilterOptions, options => {
  if (effectFilter.value !== "all" && !options.some(option => option.id === effectFilter.value)) effectFilter.value = "all"
})
watch(specialtyFilterOptions, options => {
  if (specialtyFilter.value !== "all" && !options.some(option => option.value === specialtyFilter.value)) specialtyFilter.value = "all"
})

const filteredCategoryBuffs = computed(() => {
  const filtered = categoryBuffs.value.filter(buff =>
    (effectFilter.value === "all" || effectGroupsFor(buff).has(effectFilter.value))
    && (specialtyFilter.value === "all" || buffSpecialty(buff) === specialtyFilter.value))
  const pinned = filtered.filter(buff => pinnedIds.value.has(buff.id))
  return pinned.length ? [...pinned, ...filtered.filter(buff => !pinnedIds.value.has(buff.id))] : filtered
})

watch(activeTab, resetListFilters)

const customBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return draftAddedBuffs.value
    .filter(buff => buff?.sourceKind === "custom")
    .filter(buff => !needle || buffText(buff).includes(needle))
})

const visibleBuffs = computed(() => {
  if (activeTab.value === "custom") {
    return customBuffs.value
  }
  return filteredCategoryBuffs.value
})

// 置顶区后面的第一条前显示“未选”分隔
function startsUnpinned(buffs: any[], index: number) {
  return index > 0 && !pinnedIds.value.has(buffs[index]?.id) && pinnedIds.value.has(buffs[index - 1]?.id)
}
const buffSections = computed(() => activeTab.value === "teammate"
  ? draftBuffPickerState.value.teammateSlots.map((slot, index) => ({
    key: `teammate-${index}`,
    slotIndex: index,
    label: index === 0 ? "队友一" : "队友二",
    slot,
    buffs: slot ? visibleBuffs.value.filter(buff => teammateOwnerId(buff) === slot.teammateId) : [],
    selectedCount: slot ? groupedBuffs.value.teammate.filter(buff =>
      teammateOwnerId(buff) === slot.teammateId && draft.value.has(buff.id)).length : 0,
  }))
  : [{ key: activeTab.value, slotIndex: 0, label: "", slot: null, buffs: visibleBuffs.value, selectedCount: 0 }])
const selectedCount = computed(() => draft.value.size
  + draftAddedBuffs.value.filter(buff => buff?.sourceKind === "custom").length)
function categorySelectedCount(name: BuffCategory) {
  if (name === "custom") return draftAddedBuffs.value.filter(buff => buff?.sourceKind === "custom").length
  return (groupedBuffs.value[name] ?? []).filter(buff => draft.value.has(buff.id)).length
}
function categoryTabLabel(tab: { name: BuffCategory, label: string }) {
  const count = categorySelectedCount(tab.name)
  return count ? `${tab.label} (${count})` : tab.label
}
const canBulkAddVisible = computed(() => !["custom", "field", "boss"].includes(activeTab.value))

function normalizedTeamWEngineLevel(buff: any, value: unknown) {
  const min = Number.isInteger(Number(buff?.wEngineModificationMin)) ? Number(buff.wEngineModificationMin) : 1
  const maxValue = Number.isInteger(Number(buff?.wEngineModificationMax)) ? Number(buff.wEngineModificationMax) : 5
  const max = Math.max(min, maxValue)
  const fallback = Number.isInteger(Number(buff?.wEngineModificationLevel)) ? Number(buff.wEngineModificationLevel) : min
  const numeric = Number(value)
  const level = Number.isFinite(numeric) ? Math.trunc(numeric) : fallback
  return Math.max(min, Math.min(max, level))
}

function teamWEngineModificationOptions(buff: any) {
  const min = Number.isInteger(Number(buff?.wEngineModificationMin)) ? Number(buff.wEngineModificationMin) : 1
  const maxValue = Number.isInteger(Number(buff?.wEngineModificationMax)) ? Number(buff.wEngineModificationMax) : 5
  const max = Math.max(min, maxValue)
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index
    return { label: `精 ${value}`, value }
  })
}

function selectedTeamWEngineLevel(buff: any) {
  const reference = draftAddedBuffs.value.find(item => item?.sourceKind === "wEngineTeam" && item?.id === buff?.id)
  return normalizedTeamWEngineLevel(buff, reference?.wEngineModificationLevel)
}

function syncSelectedTeamWEngineReferences(candidates: any[] = []) {
  const candidateById = new Map(candidates.map(buff => [buff.id, buff]))
  const seen = new Set<string>()
  const next: any[] = []
  for (const item of draftAddedBuffs.value) {
    if (item?.sourceKind !== "wEngineTeam") {
      next.push(item)
      continue
    }
    const buff = candidateById.get(item.id)
    if (!buff || !draft.value.has(item.id)) {
      next.push(item)
      continue
    }
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    next.push({
      ...item,
      id: buff.id,
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: normalizedTeamWEngineLevel(buff, item.wEngineModificationLevel),
    })
  }
  for (const buff of candidates) {
    if (!draft.value.has(buff.id) || seen.has(buff.id)) {
      continue
    }
    next.push({
      id: buff.id,
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: normalizedTeamWEngineLevel(buff, buff.wEngineModificationLevel),
    })
  }
  draftAddedBuffs.value = next
}

function upsertTeamWEngineReference(buff: any, value: unknown = buff?.wEngineModificationLevel) {
  const level = normalizedTeamWEngineLevel(buff, value)
  let found = false
  const next = draftAddedBuffs.value.map(item => {
    if (item?.sourceKind !== "wEngineTeam" || item?.id !== buff.id) {
      return item
    }
    found = true
    return {
      ...item,
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: level,
    }
  })
  if (!found) {
    next.push({
      id: buff.id,
      sourceCategory: "wEngine",
      sourceKind: "wEngineTeam",
      wEngineModificationLevel: level,
    })
  }
  draftAddedBuffs.value = next
}

function removeTeamWEngineReference(id: string) {
  draftAddedBuffs.value = draftAddedBuffs.value.filter(item =>
    item?.sourceKind !== "wEngineTeam" || item?.id !== id)
}

function setTeamWEngineModificationLevel(buff: any, value: unknown) {
  upsertTeamWEngineReference(buff, value)
  recordEnkaTeammateEdit(draftBuffPickerState.value, `engine:${buff.id}`, normalizedTeamWEngineLevel(buff, value))
}

function hasRuntimeControls(buff: any) {
  return Boolean(runtimeSourceGroups(buff).length || runtimeStackGroups(buff).length)
}

function hasIndependentRuleControls(buff: any) {
  return ["field", "boss"].includes(buff?.sourceType)
}

function runtimeFor(buff: any) {
  const ownRuntime = draftRuntimeInputs.value[buff.id] ?? {}
  const ownerId = teammateOwnerId(buff)
  const legacyRuntime = ownerId ? draftRuntimeInputs.value[`teammate:${ownerId}`] ?? {} : {}
  return normalizeRuntimeForBuff(buff, {
    ...ownRuntime,
    parameters: {
      ...(legacyRuntime?.parameters ?? {}),
      ...(ownRuntime?.parameters ?? {}),
    },
  })
}

function runtimeParameterValue(buff: any, definition: any) {
  return normalizedRuntimeParameterValue(
    definition,
    runtimeFor(buff)?.parameters?.[definition.id],
  )
}

function setRuntimeParameterValue(buff: any, definition: any, value: unknown) {
  const runtime = runtimeFor(buff)
  updateRuntime(buff, {
    ...runtime,
    parameters: {
      ...(runtime.parameters ?? {}),
      [definition.id]: normalizedRuntimeParameterValue(definition, value),
    },
  })
}

function runtimeParameterLabel(definition: any) {
  if (definition?.id === "anomalyAgentCount") return "异常特性代理人人数"
  return localizedText(definition?.label) || String(definition?.id ?? "队伍参数")
}

function effectRowsFor(buff: any) {
  const runtime = runtimeFor(buff)
  return runtimeEffectRules(buff, runtime).map((rule: any) => {
    const id = effectRuleId(rule)
    return {
      id,
      rule,
      text: storedEffectRuleText(rule, runtime, buff, props.meta, {
        inCombatPanel: props.inCombatPanel,
        outOfCombatPanel: props.outOfCombatPanel,
      }),
      coverage: effectRuleCoverage(rule, buff),
      enabled: runtime.effects?.[id]?.enabled !== false,
    }
  }).filter((row: any) => row.text)
}

// 摘要行只保留“属性 +数值”，适用技能、异常类型等括注留在展开区
function effectSummaryFor(buff: any) {
  const rows = effectRowsFor(buff).map(row => String(row.text).replace(/（[^）]*）/g, "").trim())
  const modifiers = modifierLinesFor(buff)
  return [...rows, ...modifiers].filter(Boolean).join(" · ") || buffSubtitle(buff)
}

// 适用技能超过 3 个时折叠成“适用 N 个技能”，点开再看完整列表；列表仍在页面文本中，搜索不受影响
const SKILL_TARGET_FOLD_THRESHOLD = 3
const expandedSkillTargets = ref<Set<string>>(new Set())
function skillTargetParts(text: string) {
  const match = /^(.*?)（技能：([^）]*)）(.*)$/s.exec(String(text ?? ""))
  if (!match) return null
  const skills = match[2]!.split("；").map(item => item.trim()).filter(Boolean)
  if (skills.length <= SKILL_TARGET_FOLD_THRESHOLD) return null
  return { head: match[1]!, skills, tail: match[3]! }
}
function toggleSkillTargets(key: string) {
  const next = new Set(expandedSkillTargets.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedSkillTargets.value = next
}

function modifierLinesFor(buff: any) {
  return storedBuffModifierTexts(buff)
}

function updateRuntime(buff: any, runtime: any) {
  if (isTeammateOwnedBuff(buff)) recordEnkaTeammateEdit(draftBuffPickerState.value, `runtime:${buff.id}`, runtime, runtimeFor(buff))
  draftRuntimeInputs.value = {
    ...draftRuntimeInputs.value,
    [buff.id]: normalizeRuntimeForBuff(buff, runtime),
  }
}

function setRuleEnabled(buff: any, rule: any, enabled: boolean) {
  const runtime = runtimeFor(buff)
  const id = effectRuleId(rule)
  updateRuntime(buff, {
    ...runtime,
    effects: {
      ...(runtime.effects ?? {}),
      [id]: {
        ...(runtime.effects?.[id] ?? {}),
        enabled,
      },
    },
  })
}

function setRuleCoverage(buff: any, rule: any, value: number | null) {
  const runtime = runtimeFor(buff)
  const id = effectRuleId(rule)
  updateRuntime(buff, {
    ...runtime,
    effects: {
      ...(runtime.effects ?? {}),
      [id]: {
        ...(runtime.effects?.[id] ?? {}),
        coverage: Math.max(0, Math.min(1, Number(value ?? 0))),
      },
    },
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

const imbuementBuffIds = ["system.imbuement", "roxy.additional_ability"]

function isTeammateOwnedBuff(buff: any): boolean {
  return Boolean(buff?.isTeammateWEngine || buff?.sourceType === 'teammate' || teammateOwnerId(buff))
}

function toggle(id: string, checked: boolean, recordManual = true) {
  if (expandedBuffs.value.has(id)) {
    const nextExpanded = new Set(expandedBuffs.value)
    nextExpanded.delete(id)
    expandedBuffs.value = nextExpanded
  }
  const next = new Set(draft.value)
  const nextRuntime = { ...draftRuntimeInputs.value }
  const buff = Object.values(groupedBuffs.value).flat().find((item: any) => item?.id === id) as any
  if (recordManual && isTeammateOwnedBuff(buff)) {
    recordEnkaTeammateEdit(draftBuffPickerState.value, `enabled:${id}`, checked)
  }
  if (checked) {
    if (imbuementBuffIds.includes(id)) {
      for (const otherId of imbuementBuffIds) {
        if (otherId !== id) {
          next.delete(otherId)
          delete nextRuntime[otherId]
        }
      }
    }
    const fieldBuff = fieldBuffs.value.find(buff => buff.id === id)
    if (fieldBuff) {
      for (const buff of fieldBuffs.value) {
        if (buff.id !== id) {
          next.delete(buff.id)
          delete nextRuntime[buff.id]
        }
      }
    }
    if (buff?.sourceType === "boss") {
      for (const bossBuff of bossBuffs.value) {
        if (bossBuff.id !== id) {
          next.delete(bossBuff.id)
          delete nextRuntime[bossBuff.id]
        }
      }
    }
    next.add(id)
    if (buff?.isTeammateWEngine) {
      upsertTeamWEngineReference(buff)
    }
  } else {
    next.delete(id)
    delete nextRuntime[id]
    if (buff?.isTeammateWEngine) {
      removeTeamWEngineReference(id)
    }
  }
  draft.value = next
  draftRuntimeInputs.value = nextRuntime
}

function addVisibleBuffs() {
  if (!canBulkAddVisible.value) {
    return
  }
  for (const buff of visibleBuffs.value) {
    toggle(buff.id, true)
  }
}

function removeVisibleBuffs() {
  if (activeTab.value === "custom") {
    return
  }
  for (const buff of visibleBuffs.value) {
    toggle(buff.id, false)
  }
}

function addCustomBuff() {
  const option = customOptionList.value[Number(customRow.value.optionIndex) || 0]
  const value = Number(customRow.value.value ?? 0)
  if (!option || !Number.isFinite(value) || value === 0
    || (customRow.value.targetKind !== "default" && !customRow.value.skillTargets?.length)) {
    return
  }
  const [optionStat, label, mode, basis] = option
  const stat = resolveCustomBuffStatOption(optionStat)
  const stats = mode !== "eventModifier" && customRow.value.targetKind === "default"
    ? [normalizeCustomBuffStat({
        id: "stat-1",
        label: resolveCustomBuffStatLabel(optionStat, label),
        stat,
        value,
        mode,
        basis,
      }, props.meta)].filter(Boolean)
    : []
  const effects = mode === "eventModifier" || customRow.value.targetKind !== "default"
    ? [normalizeCustomBuffEffect({
        id: "effect-1",
        type: "fixed",
        stat,
        label: resolveCustomBuffStatLabel(optionStat, label),
        value,
        mode: "flat",
        target: customRow.value.targetKind === "specific"
          ? { kind: "skill", skillTargets: [normalizedCustomSkillTarget(customRow.value.skillTargets?.[0] ?? {})] }
          : customRow.value.targetKind === "skillType"
            ? { kind: "skill", skillTargets: customRow.value.skillTargets }
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
    skillTargets: [],
  }
}

function resolveCustomBuffStatOption(stat: string) {
  if (stat === "enemyDefIgnore") {
    return "enemyDefReduction"
  }
  if (stat === "currentResIgnore") {
    return RES_IGNORE_STAT_BY_ELEMENT[currentDamageElement.value] ?? ""
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
  if (saving.value) return
  emit("update:show", false)
}

async function apply() {
  if (saving.value) return
  syncTeammates()
  const teamWEngineCandidates = groupedBuffs.value.teammateWEngine ?? []
  syncSelectedTeamWEngineReferences(teamWEngineCandidates)
  const availableTeamWEngineIds = new Set(teamWEngineCandidates.map((buff: any) => buff.id))
  const addedBuffs = draftAddedBuffs.value.filter(item =>
    item?.sourceKind !== "wEngineTeam"
    || !availableTeamWEngineIds.has(item.id)
    || draft.value.has(item.id))
  const selectedBuffIds = [...draft.value]
  const buffById = new Map<string, any>(Object.values(groupedBuffs.value).flat().map((buff: any) => [buff.id, buff]))
  const runtimeInputDraft = { ...draftRuntimeInputs.value }
  for (const buff of buffById.values()) {
    if (draft.value.has(buff.id) && runtimeParameterDefinitions(buff).length) {
      runtimeInputDraft[buff.id] = runtimeFor(buff)
    }
  }
  const runtimeInputs = Object.fromEntries(Object.entries(runtimeInputDraft).flatMap(([id, runtime]) => {
    const buff = buffById.get(id)
    if (buff) return [[id, normalizeRuntimeForBuff(buff, runtime)]]
    return []
  }))
  const payload = {
    selectedBuffIds,
    addedBuffs,
    runtimeInputs,
    buffPickerState: normalizeBuffPickerState(draftBuffPickerState.value)!,
  }
  saving.value = true
  saveError.value = ''
  try {
    if (props.save) await props.save(payload)
    else emit('apply', payload)
    emit('update:show', false)
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : '保存失败，请重试。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="选择 Buff"
    :mask-closable="!saving"
    :close-on-esc="!saving"
    :closable="!saving"
    class="calculation-modal calculation-modal--list buff-picker-modal"
    :class="{ 'is-teammate-picker': activeTab === 'teammate' }"
    style="width: min(1280px, calc(100vw - 16px)); max-width: 1280px"
    @update:show="emit('update:show', $event)"
  >
    <div :inert="saving || undefined" class="section-band buff-picker-layout calculation-modal-body ui-layout-scope" :class="{ 'is-teammate-layout': activeTab === 'teammate' }" data-layout-surface="buff-picker">
      <p v-if="saveError" role="alert">{{ saveError }}</p>
      <p v-if="resetNotice" class="buff-picker-reset-notice" role="status" data-testid="buff-picker-reset-notice">{{ resetNotice }}</p>
      <div class="toolbar">
        <NInput v-model:value="query" clearable placeholder="搜索来源、名称、效果" style="max-width: 360px" />
        <NTag round>已选 {{ selectedCount }} 项</NTag>
        <NButton
          v-if="activeTab === 'teammate' && teammateSources?.uid"
          size="small"
          @click="syncTeammates({ kind: 'resync' })"
        >从导入资料重新同步</NButton>
        <NButton size="small" :disabled="!canBulkAddVisible" @click="addVisibleBuffs">添加当前列表</NButton>
        <NButton size="small" :disabled="activeTab === 'custom'" @click="removeVisibleBuffs">移除当前列表</NButton>
      </div>

      <NTabs v-model:value="activeTab" class="buff-category-tabs" type="segment">
        <NTabPane v-for="tab in categoryTabs" :key="tab.name" :name="tab.name" :tab="categoryTabLabel(tab)" />
      </NTabs>

      <div v-if="activeTab === 'field'" class="field-buff-filter-row ui-field-grid ui-field-grid--comfortable" data-layout-surface="field-buff-filters">
        <label class="custom-field ui-field" data-layout-field>
          <span>版本</span>
          <NSelect
            v-model:value="fieldVersion"
            :options="fieldVersionOptions"
          />
        </label>
        <label class="custom-field ui-field" data-layout-field>
          <span>期数</span>
          <NSelect
            v-model:value="fieldPeriod"
            :options="fieldPeriodOptions"
          />
        </label>
        <label class="custom-field ui-field" data-layout-field>
          <span>名称</span>
          <NSelect
            v-model:value="fieldName"
            :options="fieldNameOptions"
          />
        </label>
      </div>

      <div v-if="activeTab === 'boss'" class="boss-buff-filter-row ui-field-grid ui-field-grid--comfortable" data-layout-surface="boss-buff-filters">
        <label class="custom-field ui-field" data-layout-field>
          <span>版本</span>
          <NSelect v-model:value="bossVersion" data-testid="boss-version-filter" :options="bossVersionOptions" />
        </label>
        <label class="custom-field ui-field" data-layout-field>
          <span>期数</span>
          <NSelect v-model:value="bossPeriod" data-testid="boss-period-filter" :options="bossPeriodOptions" />
        </label>
        <label class="custom-field ui-field" data-layout-field>
          <span>Boss</span>
          <NSelect v-model:value="bossName" data-testid="boss-name-filter" :options="bossNameOptions" />
        </label>
      </div>

      <div v-if="effectFilterOptions.length > 1 || specialtyFilterOptions.length > 1" class="buff-filter-chips" data-testid="buff-filter-chips">
        <div v-if="specialtyFilterOptions.length > 1" class="buff-filter-chip-row" role="group" aria-label="按特性筛选">
          <span class="buff-filter-chip-label">特性</span>
          <button type="button" class="buff-filter-chip" :class="{ 'is-active': specialtyFilter === 'all' }" :aria-pressed="specialtyFilter === 'all'" @click="specialtyFilter = 'all'">全部</button>
          <button
            v-for="option in specialtyFilterOptions"
            :key="option.value"
            type="button"
            class="buff-filter-chip"
            :class="{ 'is-active': specialtyFilter === option.value }"
            :aria-pressed="specialtyFilter === option.value"
            @click="specialtyFilter = option.value"
          >{{ option.label }}</button>
        </div>
        <div v-if="effectFilterOptions.length > 1" class="buff-filter-chip-row" role="group" aria-label="按效果筛选">
          <span class="buff-filter-chip-label">效果</span>
          <button type="button" class="buff-filter-chip" :class="{ 'is-active': effectFilter === 'all' }" :aria-pressed="effectFilter === 'all'" @click="effectFilter = 'all'">全部</button>
          <button
            v-for="option in effectFilterOptions"
            :key="option.id"
            type="button"
            class="buff-filter-chip"
            :class="{ 'is-active': effectFilter === option.id }"
            :aria-pressed="effectFilter === option.id"
            :data-effect-group="option.id"
            @click="effectFilter = option.id"
          >{{ option.label }}</button>
        </div>
      </div>

      <div class="buff-sections" :class="{ 'is-teammate': activeTab === 'teammate' }">
        <section v-for="section in buffSections" :key="section.key" class="buff-section" :class="{ 'teammate-buff-column': activeTab === 'teammate' }">
          <header v-if="activeTab === 'teammate'" class="teammate-column-header">
            <strong class="teammate-column-title">{{ section.label }}</strong>
            <div class="teammate-slot-field ui-field" data-layout-field>
                <TeammateSelect
                  :value="section.slot?.teammateId ?? null"
                  :options="teammateOptionsFor(section.slotIndex)"
                  :data-testid="`teammate-slot-${section.slotIndex}`"
                  :label="section.label"
                  @update:value="setTeammateSlot(section.slotIndex, $event)"
                />
            </div>
              <div class="teammate-cinema-field ui-field" data-layout-field>
                <NSelect
                  :value="section.slot?.cinemaLevel ?? 0"
                  :options="teammateCinemaOptions"
                  :disabled="!section.slot"
                  :data-testid="`teammate-cinema-${section.slotIndex}`"
                  :aria-label="`${section.label}影画`"
                  @update:value="setTeammateCinema(section.slotIndex, $event)"
                />
                <span v-if="teammateCinemaSource(section.slotIndex)" class="teammate-source-tag">{{ teammateCinemaSource(section.slotIndex) }}</span>
                <NButton
                  v-if="teammateCinemaSource(section.slotIndex) === '用户修改' && teammateSources"
                  size="tiny"
                  quaternary
                  @click="restoreTeammateCinema(section.slotIndex)"
                >恢复导入</NButton>
              </div>
            <span class="teammate-selection-count">已选 {{ section.selectedCount }}</span>
            <NSelect
              v-if="section.slot && teammateSources"
              class="teammate-loadout-select"
              :value="section.slot.loadoutId ?? null"
              :options="teammateLoadoutOptions(teammateSources, section.slot.teammateId)"
              clearable placeholder="使用 Enka 导入配装"
              :aria-label="`${section.label}驱动盘方案`"
              @update:value="setTeammateLoadout(section.slotIndex, $event)"
            />
          </header>
      <NScrollbar class="buff-list-scrollbar">
        <div class="section-band buff-list">
          <div v-if="activeTab === 'custom'" class="custom-buff-editor">
            <NInput v-model:value="customName" placeholder="名称" />
            <div class="custom-effect-list">
              <div class="custom-effect-row ui-field-grid" data-layout-surface="custom-buff-effect">
                <div class="custom-field custom-target-kind-field ui-field ui-field--full" data-layout-field>
                  <span>增幅对象</span>
                  <NRadioGroup
                    aria-label="增幅对象"
                    :value="customRow.targetKind"
                    size="small"
                  >
                    <NRadioButton v-for="item in customTargetKindOptions" :key="item.value" :value="item.value" :label="item.label" @click="setCustomTargetKind(String(item.value))" />
                  </NRadioGroup>
                </div>
                <label class="custom-field ui-field" data-layout-field>
                  <span>增幅类型</span>
                  <NSelect
                    :value="customRow.optionIndex"
                    :options="customStatOptions"
                    filterable
                    @update:value="setCustomOptionIndex"
                  />
                </label>
                <label class="custom-field ui-field" data-layout-field>
                  <span>数值</span>
                  <NInputNumber v-model:value="customRow.value" :step="0.1" />
                </label>
              </div>
              <div v-if="customRow.targetKind === 'specific'" class="custom-skill-target-row ui-field-grid" data-layout-surface="custom-skill-target">
                <label class="custom-field ui-field" data-layout-field>
                  <span>角色</span>
                  <NSelect
                    :value="customSkillTargetFields.target.agentSkillId"
                    :options="customSkillTargetFields.skillOptions"
                    @update:value="updateCustomSkillAgent(String($event))"
                  />
                </label>
                <label class="custom-field ui-field" data-layout-field>
                  <span>技能大类</span>
                  <NSelect
                    :value="customSkillTargetFields.target.skillType"
                    :options="customSkillTargetFields.skillTypeOptions"
                    @update:value="updateCustomSkillType(String($event))"
                  />
                </label>
                <label class="custom-field ui-field" data-layout-field>
                  <span>招式</span>
                  <NSelect
                    :value="customSkillTargetFields.target.moveId"
                    :options="customSkillTargetFields.moveOptions"
                    @update:value="updateCustomSkillMove(String($event))"
                  />
                </label>
                <label v-if="customSkillTargetFields.target.moveId" class="custom-field ui-field" data-layout-field>
                  <span>倍率行</span>
                  <NSelect
                    :value="customSkillTargetFields.target.rowId ?? ''"
                    :options="customSkillTargetFields.rowOptions"
                    @update:value="updateCustomSkillRow(String($event))"
                  />
                </label>
              </div>
              <label v-if="customRow.targetKind === 'skillType'" class="custom-field custom-general-skill-types ui-field ui-field--full" data-layout-field>
                <span>技能大类</span>
                <NSelect
                  multiple
                  filterable
                  :value="customRow.skillTargets.map((target: any) => target.skillType)"
                  :options="customSkillTypeOptions"
                  placeholder="请选择至少一个技能大类"
                  @update:value="updateCustomGeneralSkillTypes($event)"
                />
              </label>
            </div>
            <NButton type="primary" @click="addCustomBuff">添加到本次选择</NButton>
          </div>

          <template v-for="(buff, buffIndex) in section.buffs" :key="buff.id">
            <div v-if="startsUnpinned(section.buffs, buffIndex)" class="buff-list-divider" role="separator">未选</div>
            <TeammateBuffCard
              v-if="activeTab === 'teammate'"
              :buff="buff"
              :selected="draft.has(buff.id)"
              :runtime="runtimeFor(buff)"
              :effect-rows="effectRowsFor(buff)"
              :modifier-lines="modifierLinesFor(buff)"
              :source-label="teammateSourceLabel(buff)"
              :can-restore="canRestoreTeammateBuff(buff)"
              @toggle="toggle(buff.id, $event)"
              @coverage="(rule, value) => setRuleCoverage(buff, rule, value)"
              @source-value="(group, value) => setSourceValue(buff, group, value)"
              @stacks="(group, value) => setStacks(buff, group, value)"
              @parameter="(definition, value) => setRuntimeParameterValue(buff, definition, value)"
              @restore="clearImportedOverride(`enabled:${buff.id}`)"
            />
            <article
              v-else
              class="buff-row standard-buff-row"
              :data-buff-id="buff.id"
              :class="{ 'is-selected': draft.has(buff.id), 'is-selectable': activeTab !== 'custom' }"
            >
            <div class="buff-row-main">
              <NCheckbox
                v-if="activeTab !== 'custom'"
                class="buff-check"
                :aria-label="buffDisplayName(buff)"
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
                <ImageAvatar :src="thumbnailForBuff(buff)" :name="buffDisplayName(buff)" round />
                <span class="buff-copy">
                  <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                  <small class="buff-effect-summary" :title="`${effectSummaryFor(buff)}
${buffSubtitle(buff)}`">{{ effectSummaryFor(buff) }}</small>
                </span>
              </button>
              <span v-else class="buff-row-toggle is-static">
                <ImageAvatar :src="thumbnailForBuff(buff)" :name="buffDisplayName(buff)" round />
                <span class="buff-copy">
                  <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                  <small class="buff-effect-summary" :title="`${effectSummaryFor(buff)}
${buffSubtitle(buff)}`">{{ effectSummaryFor(buff) }}</small>
                </span>
              </span>
              <ExpandToggle
                class="buff-expand-toggle"
                :expanded="isBuffExpanded(buff)"
                :aria-label="`${isBuffExpanded(buff) ? '收起' : '展开'}${buffDisplayName(buff)}详情`"
                @toggle="toggleBuffExpanded(buff)"
              />
              <NButton v-if="activeTab === 'custom'" size="small" type="error" @click="removeCustomBuff(buff.id)">移除</NButton>
              <label v-if="buff.isTeammateWEngine && draft.has(buff.id) && isBuffExpanded(buff)" class="w-engine-modification-control">
                <span>精修</span>
                <NSelect
                  aria-label="队友音擎精修"
                  :value="selectedTeamWEngineLevel(buff)"
                  :options="teamWEngineModificationOptions(buff)"
                  size="small"
                  @update:value="setTeamWEngineModificationLevel(buff, $event)"
                />
              </label>
            </div>
            <div v-if="isBuffExpanded(buff) && runtimeParameterDefinitions(buff).length" class="buff-runtime-parameters">
              <label v-for="definition in runtimeParameterDefinitions(buff)" :key="definition.id" class="buff-runtime-parameter">
                <span>{{ runtimeParameterLabel(definition) }}</span>
                <NRadioGroup
                  :value="runtimeParameterValue(buff, definition)"
                  size="small"
                >
                  <NRadioButton
                    v-for="value in definition.values ?? []"
                    :key="String(value)"
                    :value="value"
                    :label="String(value)"
                    @click="setRuntimeParameterValue(buff, definition, value)"
                  />
                </NRadioGroup>
              </label>
            </div>
            <div v-if="isBuffExpanded(buff) && (effectRowsFor(buff).length || modifierLinesFor(buff).length)" class="buff-effect-lines">
              <div
                v-for="row in effectRowsFor(buff)"
                :key="row.id"
                class="buff-effect-row"
                :class="{ 'is-disabled': hasIndependentRuleControls(buff) && !row.enabled }"
              >
                <span v-if="!skillTargetParts(row.text)">{{ row.text }}</span>
                <span v-else class="buff-effect-text">
                  {{ skillTargetParts(row.text)!.head }}<button
                    type="button"
                    class="skill-target-toggle"
                    :aria-expanded="expandedSkillTargets.has(`${buff.id}:${row.id}`)"
                    @click="toggleSkillTargets(`${buff.id}:${row.id}`)"
                  >适用 {{ skillTargetParts(row.text)!.skills.length }} 个技能</button>{{ skillTargetParts(row.text)!.tail }}
                  <span v-show="expandedSkillTargets.has(`${buff.id}:${row.id}`)" class="skill-target-list">（技能：{{ skillTargetParts(row.text)!.skills.join("；") }}）</span>
                </span>
                <div v-if="hasIndependentRuleControls(buff)" class="rule-runtime-controls">
                  <NCheckbox
                    class="rule-enabled-control"
                    :checked="row.enabled"
                    :disabled="!draft.has(buff.id)"
                    @update:checked="setRuleEnabled(buff, row.rule, Boolean($event))"
                  >
                    启用
                  </NCheckbox>
                  <label v-if="row.coverage" class="rule-coverage-control">
                    <span>覆盖率</span>
                    <NInputNumber
                      :value="runtimeCoverageForEffectRule(row.rule, buff, runtimeFor(buff))"
                      :min="Number.isFinite(Number(row.coverage.min)) ? Number(row.coverage.min) : 0"
                      :max="Number.isFinite(Number(row.coverage.max)) ? Number(row.coverage.max) : 1"
                      :step="Number.isFinite(Number(row.coverage.step)) ? Number(row.coverage.step) : 0.1"
                      :disabled="!draft.has(buff.id) || !row.enabled"
                      size="small"
                      @update:value="setRuleCoverage(buff, row.rule, $event)"
                    />
                  </label>
                </div>
                <label v-else-if="row.coverage" class="rule-coverage-control">
                  <span>覆盖率</span>
                  <NInputNumber
                    :value="runtimeCoverageForEffectRule(row.rule, buff, runtimeFor(buff))"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    :disabled="activeTab !== 'custom' && !draft.has(buff.id)"
                    size="small"
                    @update:value="setRuleCoverage(buff, row.rule, $event)"
                  />
                </label>
              </div>
              <span v-for="(line, index) in modifierLinesFor(buff)" :key="`modifier-${index}-${line}`">{{ line }}</span>
            </div>
            <div v-if="isBuffExpanded(buff)" class="buff-detail-description">
              {{ buffSubtitle(buff) }}
            </div>
            <div v-if="isBuffExpanded(buff) && activeTab === 'boss'" class="boss-buff-details">
              <div class="chip-row">
                <NTag v-for="appearance in bossAppearances(buff)" :key="bossAppearanceKey(appearance)" size="small">{{ bossAppearanceLabel(appearance) }}</NTag>
                <NTag size="small">防御 {{ buff.target?.defense ?? '未知' }}</NTag>
                <NTag v-for="element in buff.target?.weaknessElements ?? []" :key="`weak-${element}`" size="small" type="success">弱点 · {{ bossElementLabels[element] ?? element }}</NTag>
                <NTag v-for="element in buff.target?.resistanceElements ?? []" :key="`res-${element}`" size="small" type="error">抗性 · {{ bossElementLabels[element] ?? element }}</NTag>
              </div>
              <p class="boss-enemy-intel">{{ localizedText(buff.enemyIntel) }}</p>
              <div v-for="group in bossEntryGroups(buff)" :key="group.key" class="boss-effect-group">
                <strong>{{ group.label }}</strong>
                <div v-for="entry in group.entries" :key="entry.id" class="boss-effect-entry">
                  <span><b>{{ localizedText(entry.name) }}</b>{{ localizedText(entry.description) }}</span>
                  <NTag size="small" :type="entry.calculationStatus === 'modeled' ? 'success' : 'warning'">
                    {{ entry.calculationStatus === 'modeled' ? '参与计算' : '仅说明，未计入计算' }}
                  </NTag>
                </div>
              </div>
            </div>
            <div v-if="isBuffExpanded(buff) && hasRuntimeControls(buff)" class="runtime-grid" data-layout-surface="buff-runtime">
              <div v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric runtime-metric ui-field" data-layout-field>
                <dt>{{ group.label || "来源数值" }}</dt>
                <dd>
                  <NInputNumber
                    :value="runtimeFor(buff).effects?.[group.ruleIds?.[0]]?.sourceValue ?? group.defaultValue ?? 0"
                    :min="Number.isFinite(group.min) ? group.min : undefined"
                    :max="Number.isFinite(group.max) ? group.max : undefined"
                    :step="Number.isFinite(group.step) ? group.step : undefined"
                    size="small"
                    @update:value="setSourceValue(buff, group, Number($event))"
                  />
                </dd>
              </div>
              <div v-for="group in runtimeStackGroups(buff)" :key="group.key" class="metric layer-metric ui-field" data-layout-field>
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
            </article>
          </template>
          <div v-if="!section.buffs.length" class="empty-state">{{ activeTab === 'teammate' && !section.slot ? '先选择一名队友，查看并调整其 Buff' : '暂无匹配的 Buff' }}</div>
        </div>
      </NScrollbar>
        </section>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer calculation-modal-footer">
        <span class="muted">{{ resetNotice ? '旧配置重置已保存；本次修改应用后生效' : '应用前不会改动当前方案' }}</span>
        <NButton :disabled="saving" @click="close">取消</NButton>
        <NButton type="primary" :loading="saving" @click="apply">应用选择</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.teammate-loadout-select {
  grid-column: 1 / -1;
  min-width: 0;
}

.buff-picker-reset-notice {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
  color: var(--app-text);
  line-height: 1.6;
}

.buff-sections,
.buff-section {
  min-width: 0;
}

.buff-picker-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
  overflow: hidden;
}

.buff-sections:not(.is-teammate),
.buff-sections:not(.is-teammate) > .buff-section {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.buff-section :deep(.buff-list-scrollbar) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: auto;
  min-height: 0;
  min-width: 0;
}

.buff-section :deep(.buff-list-scrollbar > .n-scrollbar-container) {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  overscroll-behavior: contain;
}

.buff-picker-layout > :not(.buff-sections) {
  flex-shrink: 0;
}

.buff-picker-layout.is-teammate-layout {
  overflow-y: auto;
}

.buff-sections.is-teammate {
  display: grid;
  flex: 1;
  /* Keep the selectors reachable when the toolbar fills a very short dialog. */
  min-height: 112px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.teammate-buff-column {
  container: teammate-column / inline-size;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius);
  background: var(--app-panel-muted);
}

.teammate-column-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 84px auto;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 8px;
}

.teammate-source-tag {
  color: var(--app-muted);
  font-size: 12px;
  white-space: nowrap;
}

.teammate-column-title {
  font-size: 14px;
  white-space: nowrap;
}

.teammate-selection-count {
  font-size: 13px;
  white-space: nowrap;
  color: var(--app-muted);
}

.teammate-buff-column .buff-list {
  gap: 8px;
}

@container teammate-column (max-width: 500px) {
  .teammate-column-header {
    grid-template-columns: minmax(0, 1fr) 84px;
  }
  .teammate-column-title { grid-area: 1 / 1; }
  .teammate-selection-count { grid-area: 1 / 2; text-align: right; }
  .teammate-slot-field { grid-area: 2 / 1; }
  .teammate-cinema-field { grid-area: 2 / 2; }
}

@container ui-layout (max-width: 899px) {
  .buff-sections.is-teammate,
  .buff-sections.is-teammate {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    grid-auto-rows: max-content;
    align-items: start;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .teammate-buff-column :deep(.buff-list-scrollbar) {
    display: block;
    flex: none;
    height: auto;
    overflow: visible;
  }
  .teammate-buff-column :deep(.buff-list-scrollbar > .n-scrollbar-container) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .teammate-buff-column :deep(.buff-list-scrollbar > .n-scrollbar-rail) {
    display: none;
  }
}

/* 页签改为紧凑分段轨道，与顶部导航同一风格 */
/* 筛选标签：参考 nanoka.cc 的分类筛选，“标签名 + 一排可点的小标签” */
.buff-filter-chips {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.buff-filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.buff-filter-chip-label {
  flex: 0 0 auto;
  min-width: 32px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
}

.buff-filter-chip {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-panel);
  color: var(--app-text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.buff-filter-chip:hover {
  border-color: var(--app-blue-line);
  color: var(--app-text);
}

.buff-filter-chip.is-active {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
  color: var(--app-blue-strong);
}

.buff-filter-chip:focus-visible {
  outline: var(--app-focus-ring);
  outline-offset: 2px;
}

/* 已选置顶区与其余条目之间的分隔 */
.buff-list-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
}

.buff-list-divider::before,
.buff-list-divider::after {
  flex: 1 1 auto;
  height: 1px;
  background: var(--app-border);
  content: "";
}

.buff-category-tabs {
  padding: 5px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius);
  background: var(--app-panel-muted);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.02);
}

.buff-picker-layout,
.buff-list {
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.buff-category-tabs :deep(.n-tabs-nav) {
  min-width: 0;
}

.buff-category-tabs :deep(.n-tabs-rail) {
  display: flex;
  align-items: center;
  gap: 2px;
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
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel);
  color: var(--app-text);
  font-weight: 750;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.buff-category-tabs :deep(.n-tabs-tab:hover) {
  border-color: var(--app-blue-line);
  background: var(--app-panel);
  color: var(--app-blue);
}

.buff-category-tabs :deep(.n-tabs-tab:focus-visible) {
  outline: 2px solid rgba(47, 125, 246, 0.36);
  outline-offset: 2px;
}

.buff-category-tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
  color: var(--app-blue);
  box-shadow:
    inset 0 0 0 1px rgba(47, 125, 246, 0.22),
    0 4px 12px rgba(47, 125, 246, 0.12);
}

.buff-category-tabs :deep(.n-tabs-capsule) {
  display: none;
}

.field-buff-filter-row,
.boss-buff-filter-row {
  --ui-field-min: 180px;
  gap: 10px;
  align-items: end;
}

.boss-buff-details {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.boss-enemy-intel {
  margin: 0;
  color: var(--app-text);
  line-height: 1.65;
}

.boss-effect-group {
  display: grid;
  gap: 7px;
}

.boss-effect-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  color: var(--app-muted);
  line-height: 1.55;
}

.boss-effect-entry span {
  display: grid;
  gap: 2px;
}

.boss-effect-entry b {
  color: var(--app-text);
}

.buff-runtime-parameters {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-panel-muted);
}

.buff-runtime-parameter {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: var(--app-muted);
  font-size: 13px;
}

.buff-runtime-parameter span {
  white-space: nowrap;
}

.standard-buff-row {
  display: grid;
  gap: 12px;
  min-height: 72px;
  padding: 8px 12px 8px 14px;
  border: 1px solid var(--app-border-strong);
  border-inline-start: 4px solid transparent;
  border-radius: var(--app-radius);
  background: var(--app-panel);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.standard-buff-row.is-selectable:hover {
  border-color: var(--app-blue-line);
  background: var(--app-panel);
  box-shadow: 0 8px 20px rgba(47, 125, 246, 0.1);
}

.standard-buff-row.is-selected {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
  border-inline-start-color: var(--app-blue);
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
  background: var(--app-panel);
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

.buff-row-toggle :deep(.avatar) {
  flex: 0 0 auto;
}

button.buff-row-toggle {
  cursor: pointer;
}

button.buff-row-toggle:hover {
  border-color: var(--app-blue-line);
  background: var(--app-blue-soft);
}

button.buff-row-toggle:focus-visible {
  outline: 2px solid rgba(47, 125, 246, 0.38);
  outline-offset: 2px;
}

.buff-row-toggle.is-static {
  padding-left: 0;
}

.w-engine-modification-control {
  flex: 0 0 132px;
  display: grid;
  gap: 5px;
  min-width: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
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

.buff-copy small.buff-effect-summary,
.buff-effect-summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buff-detail-description {
  padding: 8px 12px;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
  color: var(--app-muted);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.skill-target-toggle {
  margin: 0 2px;
  padding: 0 6px;
  border: 1px solid var(--app-blue-line, #bcd4fb);
  border-radius: 999px;
  background: var(--app-blue-soft, #edf4ff);
  color: var(--app-blue-strong, #1d5fd6);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.skill-target-toggle:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.35);
  outline-offset: 1px;
}

.skill-target-list {
  display: block;
  margin-top: 4px;
  color: var(--app-muted);
  font-weight: 400;
  line-height: 1.6;
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

.buff-effect-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--app-border);
}

.buff-effect-row.is-disabled > span {
  color: var(--app-muted);
  font-weight: 650;
}

.rule-runtime-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 7px 14px;
}

.rule-enabled-control {
  font-size: 12px;
  font-weight: 650;
}

.rule-coverage-control {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.rule-coverage-control :deep(.n-input-number) {
  width: 104px;
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
  --ui-field-min: 160px;
  gap: 8px;
  align-items: end;
}

.custom-target-kind-field {
  grid-column: 1 / -1;
}

.custom-target-kind-field :deep(.n-radio-group) {
  display: flex;
  flex-wrap: wrap;
}

.custom-general-skill-types {
  width: 100%;
}

.custom-skill-target-row {
  --ui-field-min: 150px;
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

@container ui-layout (max-width: 720px) {
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

  .buff-row-main {
    flex-wrap: wrap;
  }

  .w-engine-modification-control {
    flex: 1 1 100%;
    width: 100%;
  }

  .buff-effect-row {
    grid-template-columns: 1fr;
  }

  .boss-effect-entry {
    grid-template-columns: 1fr;
  }

  .rule-coverage-control {
    justify-content: flex-start;
  }

  .rule-runtime-controls {
    justify-content: flex-start;
  }
}
</style>
