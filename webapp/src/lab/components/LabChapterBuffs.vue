<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInput, NInputNumber, NRadioButton, NRadioGroup, NSelect, NScrollbar, NTabPane, NTabs, NTag } from "naive-ui"
import ExpandToggle from "@/components/ExpandToggle.vue"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import TeammateSelect from "@/components/TeammateSelect.vue"
import TeammateBuffCard from "@/components/TeammateBuffCard.vue"
import { BUFF_EFFECT_GROUPS, effectGroupsForRules, type BuffEffectGroup } from "@/utils/buffEffectGroups"
import { buffEffectSummary } from "@/utils/buffEffectSummary"
import {
  recordEnkaTeammateEdit,
  syncEnkaTeammates,
  teammateImportStatus,
  teammateLoadoutOptions,
  type TeammateSyncOperation,
} from "@/utils/enkaTeammates"
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
import { attributeLabel, buffDisplayName, buffSubtitle, labelOf, specialtyLabel } from "@/utils/format"
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
import type { LabWorkbenchApi } from "@/lab/useLabWorkbench"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

const meta = computed(() => props.lab.catalogStore.meta)
const buffsCatalog = computed(() => props.lab.catalogStore.combatBuffs ?? [])
const driveDiscSets = computed(() => props.lab.catalogStore.displayDriveDiscSets ?? [])
const agentId = computed(() => props.lab.buildStore.agentId)
const coreSkillLevel = computed(() => String(props.lab.buildStore.coreSkillLevel))
const cinemaLevel = computed(() => props.lab.buildStore.cinemaLevel)
const potentialLevel = computed(() => props.lab.buildStore.potentialLevel)
const wEngineId = computed(() => props.lab.buildStore.wEngineId)
const wEngineModificationLevel = computed(() => props.lab.buildStore.wEngineModificationLevel)
const inCombatPanel = computed(() => props.lab.buildStore.result?.inCombat?.panel ?? null)
const outOfCombatPanel = computed(() => props.lab.buildStore.result?.outOfCombat?.panel ?? null)
const teammateSources = computed(() => props.lab.teammateSources.value)

const categoryTabs = BUFF_CATEGORY_TABS
const activeTab = ref<BuffCategory>("self")
const query = ref("")
const draft = ref<Set<string>>(new Set())
const draftAddedBuffs = ref<any[]>([])
const draftRuntimeInputs = ref<Record<string, any>>({})
const draftBuffPickerState = ref<BuffPickerState>({ teammateSlots: [null, null] })

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

const expandedBuffs = ref<Set<string>>(new Set())
const effectFilter = ref<BuffEffectGroup | "all">("all")
const specialtyFilter = ref<string>("all")
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

function syncTeammates(operation: TeammateSyncOperation = { kind: "refresh" }) {
  if (!teammateSources.value || !meta.value) return
  const result = syncEnkaTeammates({
    selectedBuffIds: [...draft.value],
    addedBuffs: draftAddedBuffs.value,
    runtimeInputs: draftRuntimeInputs.value,
    buffPickerState: draftBuffPickerState.value,
  }, teammateSources.value, meta.value, agentId.value ?? "", operation, wEngineId.value)
  draft.value = new Set(result.payload.selectedBuffIds)
  draftAddedBuffs.value = result.payload.addedBuffs
  draftRuntimeInputs.value = result.payload.runtimeInputs
  draftBuffPickerState.value = result.payload.buffPickerState
}

function commitInstant() {
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
    buffPickerState: normalizeBuffPickerState(draftBuffPickerState.value) ?? { teammateSlots: [null, null] as [null, null] },
  }
  props.lab.applyBuffsInstant(payload)
}

function resyncFromImported() {
  syncTeammates({ kind: "resync" })
  commitInstant()
}

function setTeammateLoadout(index: number, value: string | null) {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  if (!slot) return
  recordEnkaTeammateEdit(draftBuffPickerState.value, `loadout:${index}`, value || null)
  if (value) slot.loadoutId = value
  else delete slot.loadoutId
  syncTeammates()
  commitInstant()
}

function clearImportedOverride(key: string) {
  clearManualTeammateKeys(draftBuffPickerState.value, candidate => candidate === key)
  if (draftBuffPickerState.value.enka?.overrides) delete draftBuffPickerState.value.enka.overrides[key]
  syncTeammates({ kind: "restore", key })
  commitInstant()
}

function teammateSourceLabel(buff: any): string {
  const enabledKey = `enabled:${buff.id}`
  const runtimeKey = `runtime:${buff.id}`
  if (hasManualTeammateKey(draftBuffPickerState.value, enabledKey)
    || hasManualTeammateKey(draftBuffPickerState.value, runtimeKey)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, enabledKey)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, runtimeKey)) return "用户修改"
  const owner = teammateOwnerId(buff)
  const imported = Boolean(teammateSources.value?.uid
    && teammateSources.value.history[owner]?.uid === teammateSources.value.uid
    && teammateSources.value.history[owner]?.completeness === "full")
  if (imported) return "Enka 导入"
  return draftBuffPickerState.value.origin === "adminDefault" ? "管理员默认" : ""
}

function canRestoreTeammateBuff(buff: any): boolean {
  const source = teammateSourceLabel(buff)
  return source === "用户修改" && Boolean(teammateSources.value?.uid)
}

const customTargetKindOptions = [
  { label: "常规属性 / 全局效果", value: "default" },
  { label: "指定角色招式", value: "specific" },
  { label: "通用技能大类", value: "skillType" },
]
const customSkillTypeOptions = SKILL_TYPES.map((value: string) => ({ label: SKILL_TYPE_LABELS[value] ?? value, value }))

type CustomBuffOption = [string, string, string, string | null]

const selectedAgent = computed(() => (meta.value?.agents ?? [])
  .find((agent: any) => agent?.id === agentId.value) ?? null)

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

const displayAgents = computed(() => meta.value?.displayAgents ?? meta.value?.agents ?? [])
const displayAgentSkills = computed(() => meta.value?.displayAgentSkills ?? meta.value?.agentSkills ?? [])

const agentSkillOptions = computed(() => displayAgentSkills.value.map((skill: any) => {
  const agent = displayAgents.value.find((item: any) => item?.id === skill?.agentId || item?.id === skill?.id)
  const label = localizedText(agent?.name) || localizedText(skill?.name) || skill?.id
  return {
    label: String(label).replace(/技能倍率$/u, "").trim() || skill?.id,
    value: skill?.id,
  }
}).filter((option: any) => option.value))

const defaultSkillCatalog = computed(() => displayAgentSkills.value
  .find((skill: any) => skill?.id === agentId.value || skill?.agentId === agentId.value)
  ?? (meta.value?.agentSkills ?? [])[0]
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
  if (id.startsWith("wEngine:")) return "selfWEngine"
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
    meta: meta.value,
    catalogBuffs: buffsCatalog.value,
    driveDiscSets: driveDiscSets.value,
    agentId: agentId.value,
    coreSkillLevel: coreSkillLevel.value,
    cinemaLevel: cinemaLevel.value,
    potentialLevel: potentialLevel.value,
    wEngineId: wEngineId.value,
    wEngineModificationLevel: wEngineModificationLevel.value,
    addedBuffs: draftAddedBuffs.value,
  })
  const existing = new Set(Object.values(groups).flat().map((buff: any) => buff?.id))
  for (const id of props.lab.defaultBuffIds.value ?? []) {
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
      const modeOrder = (modeId: string) => modeId === "defense_v5" ? 1 : 0
      return modeOrder(rightPeriod.modeId) - modeOrder(leftPeriod.modeId)
    })
    .map(buff => {
      const key = fieldBuffPeriodKey(buff)
      if (!key || seen.has(key)) return null
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
    if (id && id !== agentId.value && !owners.has(id)) owners.set(id, buff)
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
    .map(({ label, value, buff }) => ({
      label,
      value,
      specialty: buff.teammateSpecialty,
      avatar: thumbnailForBuff(buff),
      importStatus: teammateImportStatus(teammateSources.value, value),
    }))
}

function setTeammateSlot(index: number, value: string | null) {
  const teammateId = String(value ?? "").trim()
  const slots = draftBuffPickerState.value.teammateSlots
  const previousId = slots[index]?.teammateId
  if ((previousId ?? "") === teammateId || (teammateId && (slots[1 - index]?.teammateId === teammateId
    || !teammateOwners.value.some(owner => owner.value === teammateId)))) return

  recordEnkaTeammateEdit(draftBuffPickerState.value, `slot:${index}:teammateId`, teammateId || null, previousId || null)

  if (previousId) {
    const currentMeta = meta.value ?? {}
    const allCandidates = teammateBuffCandidates({
      ...currentMeta,
      displayTeammateCombatBuffGroups: currentMeta.teammateCombatBuffGroups ?? currentMeta.displayTeammateCombatBuffGroups,
      displayCombatBuffs: currentMeta.combatBuffs ?? currentMeta.displayCombatBuffs,
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
        && !isTeammatePotentialBuff(buff)) toggle(buff.id, true, false, false)
    }
  }
  syncTeammates({ kind: "select", slotIndex: index })
  commitInstant()
}

function setTeammateCinema(index: number, value: number) {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  const nextCinemaLevel = Math.max(0, Math.min(6, Math.trunc(Number(value) || 0)))
  if (!slot || slot.cinemaLevel === nextCinemaLevel) return
  recordEnkaTeammateEdit(draftBuffPickerState.value, `cinema:${slot.teammateId}`, nextCinemaLevel, slot.cinemaLevel)
  const slots = [...draftBuffPickerState.value.teammateSlots] as BuffPickerState["teammateSlots"]
  slots[index] = { ...slot, cinemaLevel: nextCinemaLevel }
  draftBuffPickerState.value = { ...draftBuffPickerState.value, teammateSlots: slots }
  const source = teammateSources.value
  if (source?.uid && source.history[slot.teammateId]?.uid === source.uid
    && source.history[slot.teammateId]?.completeness === "full") {
    syncTeammates({ kind: "cinema", slotIndex: index })
    commitInstant()
    return
  }
  for (const buff of groupedBuffs.value.teammate) {
    const level = teammateCinemaLevel(buff)
    if (teammateOwnerId(buff) === slot.teammateId && level !== null) {
      toggle(buff.id, level <= nextCinemaLevel, false, false)
    }
  }
  commitInstant()
}

function teammateCinemaSource(index: number): string {
  const slot = draftBuffPickerState.value.teammateSlots[index]
  if (!slot) return ""
  if (hasManualTeammateKey(draftBuffPickerState.value, `cinema:${slot.teammateId}`)
    || Object.prototype.hasOwnProperty.call(draftBuffPickerState.value.enka?.overrides ?? {}, `cinema:${slot.teammateId}`)) return "用户修改"
  const imported = Boolean(teammateSources.value?.uid
    && teammateSources.value.history[slot.teammateId]?.uid === teammateSources.value.uid
    && teammateSources.value.history[slot.teammateId]?.completeness === "full")
  if (imported) return "Enka 导入"
  return draftBuffPickerState.value.origin === "adminDefault" ? "管理员默认" : ""
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
  return source.filter(buff => !needle || buffText(buff).includes(needle))
})

function effectGroupsFor(buff: any): Set<BuffEffectGroup> {
  return effectGroupsForRules(runtimeEffectRules(buff, runtimeFor(buff)))
}

function buffSpecialty(buff: any): string {
  return String(buff?.ownerSpecialty ?? "")
}

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
  if (activeTab.value === "custom") return customBuffs.value
  return filteredCategoryBuffs.value
})

const effectSummaryById = computed(() => {
  const summaries = new Map<string, string>()
  for (const buff of visibleBuffs.value) {
    summaries.set(String(buff?.id ?? ""), effectSummaryFor(buff))
  }
  return summaries
})

function summaryFor(buff: any) {
  return effectSummaryById.value.get(String(buff?.id ?? "")) ?? ""
}

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
    if (seen.has(item.id)) continue
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
    if (!draft.value.has(buff.id) || seen.has(buff.id)) continue
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
    if (item?.sourceKind !== "wEngineTeam" || item?.id !== buff.id) return item
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
  commitInstant()
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
      text: storedEffectRuleText(rule, runtime, buff, meta.value, {
        inCombatPanel: inCombatPanel.value,
        outOfCombatPanel: outOfCombatPanel.value,
      }),
      coverage: effectRuleCoverage(rule, buff),
      enabled: runtime.effects?.[id]?.enabled !== false,
    }
  }).filter((row: any) => row.text)
}

function effectSummaryFor(buff: any) {
  return buffEffectSummary(effectRowsFor(buff), modifierLinesFor(buff), buffSubtitle(buff))
}

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
  if (isTeammateOwnedBuff(buff)) {
    recordEnkaTeammateEdit(draftBuffPickerState.value, `runtime:${buff.id}`, runtime, runtimeFor(buff))
  }
  draftRuntimeInputs.value = {
    ...draftRuntimeInputs.value,
    [buff.id]: normalizeRuntimeForBuff(buff, runtime),
  }
  commitInstant()
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
  return Boolean(buff?.isTeammateWEngine || buff?.sourceType === "teammate" || teammateOwnerId(buff))
}

function toggle(id: string, checked: boolean, recordManual = true, commit = true) {
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
    const fieldBuff = fieldBuffs.value.find(item => item.id === id)
    if (fieldBuff) {
      for (const item of fieldBuffs.value) {
        if (item.id !== id) {
          next.delete(item.id)
          delete nextRuntime[item.id]
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
  if (commit) commitInstant()
}

function addVisibleBuffs() {
  if (!canBulkAddVisible.value) return
  for (const buff of visibleBuffs.value) {
    toggle(buff.id, true, true, false)
  }
  commitInstant()
}

function removeVisibleBuffs() {
  if (activeTab.value === "custom") return
  for (const buff of visibleBuffs.value) {
    toggle(buff.id, false, true, false)
  }
  commitInstant()
}

function resolveCustomBuffStatOption(stat: string) {
  if (stat === "enemyDefIgnore") return "enemyDefReduction"
  if (stat === "currentResIgnore") return RES_IGNORE_STAT_BY_ELEMENT[currentDamageElement.value] ?? ""
  return stat
}

function resolveCustomBuffStatLabel(stat: string, fallbackLabel: string) {
  const elementLabel = damageElementShortLabel(currentDamageElement.value)
  if (stat === "currentResIgnore") return `${elementLabel}抗性无视%`
  if (stat === "enemyResReduction") return `${elementLabel}减抗%`
  return fallbackLabel
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
      }, meta.value)].filter(Boolean)
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
  if (!stats.length && !effects.length) return
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
  commitInstant()
}

function removeCustomBuff(id: string) {
  draftAddedBuffs.value = draftAddedBuffs.value.filter(buff => buff.id !== id)
  const nextRuntime = { ...draftRuntimeInputs.value }
  delete nextRuntime[id]
  draftRuntimeInputs.value = nextRuntime
  commitInstant()
}

function hydrateFromStore(resetUi: boolean) {
  if (!meta.value || !agentId.value) return
  draftAddedBuffs.value = normalizeSkillTargetsInValue(JSON.parse(JSON.stringify(props.lab.buildStore.addedBuffs ?? [])))
  const teamWEngineCandidates = teamWEngineBuffCandidates(meta.value, wEngineId.value, draftAddedBuffs.value)
  const teamWEngineCandidateIds = new Set(teamWEngineCandidates.map((buff: any) => buff.id))
  const selected = new Set(props.lab.activeBuffIdsWithoutDriveDisc.value)
  for (const item of draftAddedBuffs.value) {
    if (item?.sourceKind === "wEngineTeam" && teamWEngineCandidateIds.has(item.id)) {
      selected.add(item.id)
    }
  }
  draft.value = selected
  draftBuffPickerState.value = normalizeBuffPickerState(props.lab.buildStore.buffPickerState)
    ?? inferBuffPickerState(groupedBuffs.value.teammate ?? [], selected)
  syncSelectedTeamWEngineReferences(teamWEngineCandidates)
  draftRuntimeInputs.value = JSON.parse(JSON.stringify(props.lab.buildStore.runtimeInputs ?? {}))
  syncTeammates()
  if (resetUi) {
    query.value = ""
    fieldVersion.value = ""
    fieldPeriod.value = ""
    fieldName.value = ""
    bossVersion.value = ""
    bossPeriod.value = ""
    bossName.value = ""
    expandedBuffs.value = new Set()
    resetListFilters()
    syncFieldFilters()
    syncBossFilters()
  }
}

watch(
  () => [agentId.value, props.lab.activeOwnerId.value, props.lab.loading.value],
  ([nextAgent, , isLoading]) => {
    if (!isLoading && nextAgent) hydrateFromStore(true)
  },
  { immediate: true },
)

watch(
  () => [wEngineId.value, cinemaLevel.value, potentialLevel.value],
  () => {
    if (!props.lab.loading.value && agentId.value) hydrateFromStore(false)
  },
)
</script>

<template>
  <section id="lab-chapter-buffs" class="lab-chapter">
    <header class="lab-chapter-head">
      <div>
        <span class="lab-chapter-kicker">CH.02 · COMBAT MODIFIERS</span>
        <h2 class="lab-chapter-title">局内 Buff 配置</h2>
        <p class="lab-chapter-desc">
          完整展开自身、音擎、双队友、队友武装、场地、Boss 与自定义增益；所有调整即时生效并同步至右侧仪表屏。
        </p>
      </div>
      <div class="lab-buff-head-right">
        <span class="lab-buff-count-badge lab-mono">{{ selectedCount }} ACTIVE</span>
      </div>
    </header>

    <div class="lab-chapter-body lab-buff-body">
      <div
        class="section-band buff-picker-layout ui-layout-scope"
        :class="{ 'is-teammate-layout': activeTab === 'teammate' }"
        data-layout-surface="buff-picker"
      >
        <div class="toolbar lab-buff-toolbar">
          <NInput
            v-model:value="query"
            size="small"
            clearable
            placeholder="搜索来源、名称、效果"
            style="max-width: 300px"
          />
          <NTag round size="small">已选 {{ selectedCount }} 项</NTag>
          <NButton
            v-if="activeTab === 'teammate' && teammateSources?.uid"
            size="small"
            @click="resyncFromImported"
          >
            从导入资料重新同步
          </NButton>
          <NButton size="small" :disabled="!canBulkAddVisible" @click="addVisibleBuffs">添加当前列表</NButton>
          <NButton size="small" :disabled="activeTab === 'custom'" @click="removeVisibleBuffs">移除当前列表</NButton>
        </div>

        <NTabs v-model:value="activeTab" class="buff-category-tabs" type="segment" size="small">
          <NTabPane v-for="tab in categoryTabs" :key="tab.name" :name="tab.name" :tab="categoryTabLabel(tab)" />
        </NTabs>

        <div
          v-if="activeTab === 'field'"
          class="field-buff-filter-row ui-field-grid ui-field-grid--comfortable"
          data-layout-surface="field-buff-filters"
        >
          <label class="custom-field ui-field" data-layout-field>
            <span>版本</span>
            <NSelect v-model:value="fieldVersion" size="small" :options="fieldVersionOptions" />
          </label>
          <label class="custom-field ui-field" data-layout-field>
            <span>期数</span>
            <NSelect v-model:value="fieldPeriod" size="small" :options="fieldPeriodOptions" />
          </label>
          <label class="custom-field ui-field" data-layout-field>
            <span>名称</span>
            <NSelect v-model:value="fieldName" size="small" :options="fieldNameOptions" />
          </label>
        </div>

        <div
          v-if="activeTab === 'boss'"
          class="boss-buff-filter-row ui-field-grid ui-field-grid--comfortable"
          data-layout-surface="boss-buff-filters"
        >
          <label class="custom-field ui-field" data-layout-field>
            <span>版本</span>
            <NSelect v-model:value="bossVersion" size="small" data-testid="boss-version-filter" :options="bossVersionOptions" />
          </label>
          <label class="custom-field ui-field" data-layout-field>
            <span>期数</span>
            <NSelect v-model:value="bossPeriod" size="small" data-testid="boss-period-filter" :options="bossPeriodOptions" />
          </label>
          <label class="custom-field ui-field" data-layout-field>
            <span>Boss</span>
            <NSelect v-model:value="bossName" size="small" data-testid="boss-name-filter" :options="bossNameOptions" />
          </label>
        </div>

        <div v-if="effectFilterOptions.length > 1 || specialtyFilterOptions.length > 1" class="buff-filter-chips" data-testid="buff-filter-chips">
          <div v-if="specialtyFilterOptions.length > 1" class="buff-filter-chip-row" role="group" aria-label="按特性筛选">
            <span class="buff-filter-chip-label">特性</span>
            <button
              type="button"
              class="buff-filter-chip"
              :class="{ 'is-active': specialtyFilter === 'all' }"
              :aria-pressed="specialtyFilter === 'all'"
              @click="specialtyFilter = 'all'"
            >全部</button>
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
            <button
              type="button"
              class="buff-filter-chip"
              :class="{ 'is-active': effectFilter === 'all' }"
              :aria-pressed="effectFilter === 'all'"
              @click="effectFilter = 'all'"
            >全部</button>
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

        <!-- Bounded Scroll Stage preserving original modal scrollbars -->
        <div class="buff-sections lab-buff-stage" :class="{ 'is-teammate': activeTab === 'teammate' }">
          <section
            v-for="section in buffSections"
            :key="section.key"
            class="buff-section"
            :class="{ 'teammate-buff-column': activeTab === 'teammate' }"
          >
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
                  size="small"
                  :value="section.slot?.cinemaLevel ?? 0"
                  :options="teammateCinemaOptions"
                  :disabled="!section.slot"
                  :data-testid="`teammate-cinema-${section.slotIndex}`"
                  :aria-label="`${section.label}影画`"
                  @update:value="setTeammateCinema(section.slotIndex, $event)"
                />
                <span v-if="teammateCinemaSource(section.slotIndex)" class="teammate-source-tag">
                  {{ teammateCinemaSource(section.slotIndex) }}
                </span>
                <NButton
                  v-if="teammateCinemaSource(section.slotIndex) === '用户修改' && teammateSources"
                  size="tiny"
                  quaternary
                  @click="restoreTeammateCinema(section.slotIndex)"
                >恢复导入</NButton>
              </div>
              <span class="teammate-selection-count lab-mono">已选 {{ section.selectedCount }}</span>
              <NSelect
                v-if="section.slot && teammateSources"
                size="small"
                class="teammate-loadout-select"
                :value="section.slot.loadoutId ?? null"
                :options="teammateLoadoutOptions(teammateSources, section.slot.teammateId)"
                clearable
                placeholder="使用 Enka 导入配装"
                :aria-label="`${section.label}驱动盘方案`"
                @update:value="setTeammateLoadout(section.slotIndex, $event)"
              />
            </header>

            <NScrollbar class="buff-list-scrollbar">
              <div class="section-band buff-list">
                <div v-if="activeTab === 'custom'" class="custom-buff-editor">
                  <NInput v-model:value="customName" size="small" placeholder="名称" />
                  <div class="custom-effect-list">
                    <div class="custom-effect-row ui-field-grid" data-layout-surface="custom-buff-effect">
                      <div class="custom-field custom-target-kind-field ui-field ui-field--full" data-layout-field>
                        <span>增幅对象</span>
                        <NRadioGroup aria-label="增幅对象" :value="customRow.targetKind" size="small">
                          <NRadioButton
                            v-for="item in customTargetKindOptions"
                            :key="item.value"
                            :value="item.value"
                            :label="item.label"
                            @click="setCustomTargetKind(String(item.value))"
                          />
                        </NRadioGroup>
                      </div>
                      <label class="custom-field ui-field" data-layout-field>
                        <span>增幅类型</span>
                        <NSelect
                          size="small"
                          :value="customRow.optionIndex"
                          :options="customStatOptions"
                          filterable
                          @update:value="setCustomOptionIndex"
                        />
                      </label>
                      <label class="custom-field ui-field" data-layout-field>
                        <span>数值</span>
                        <NInputNumber v-model:value="customRow.value" size="small" :step="0.1" />
                      </label>
                    </div>
                    <div v-if="customRow.targetKind === 'specific'" class="custom-skill-target-row ui-field-grid" data-layout-surface="custom-skill-target">
                      <label class="custom-field ui-field" data-layout-field>
                        <span>角色</span>
                        <NSelect
                          size="small"
                          :value="customSkillTargetFields.target.agentSkillId"
                          :options="customSkillTargetFields.skillOptions"
                          @update:value="updateCustomSkillAgent(String($event))"
                        />
                      </label>
                      <label class="custom-field ui-field" data-layout-field>
                        <span>技能大类</span>
                        <NSelect
                          size="small"
                          :value="customSkillTargetFields.target.skillType"
                          :options="customSkillTargetFields.skillTypeOptions"
                          @update:value="updateCustomSkillType(String($event))"
                        />
                      </label>
                      <label class="custom-field ui-field" data-layout-field>
                        <span>招式</span>
                        <NSelect
                          size="small"
                          :value="customSkillTargetFields.target.moveId"
                          :options="customSkillTargetFields.moveOptions"
                          @update:value="updateCustomSkillMove(String($event))"
                        />
                      </label>
                      <label v-if="customSkillTargetFields.target.moveId" class="custom-field ui-field" data-layout-field>
                        <span>倍率行</span>
                        <NSelect
                          size="small"
                          :value="customSkillTargetFields.target.rowId ?? ''"
                          :options="customSkillTargetFields.rowOptions"
                          @update:value="updateCustomSkillRow(String($event))"
                        />
                      </label>
                    </div>
                    <label v-if="customRow.targetKind === 'skillType'" class="custom-field custom-general-skill-types ui-field ui-field--full" data-layout-field>
                      <span>技能大类</span>
                      <NSelect
                        size="small"
                        multiple
                        filterable
                        :value="customRow.skillTargets.map((target: any) => target.skillType)"
                        :options="customSkillTypeOptions"
                        placeholder="请选择至少一个技能大类"
                        @update:value="updateCustomGeneralSkillTypes($event)"
                      />
                    </label>
                  </div>
                  <NButton type="primary" size="small" @click="addCustomBuff">添加自定义 Buff（即时生效）</NButton>
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
                        <ImageAvatar :src="thumbnailForBuff(buff)" :name="buffDisplayName(buff)" :size="36" round />
                        <span class="buff-copy">
                          <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                          <small class="buff-effect-summary" :title="`${summaryFor(buff)}\n${buffSubtitle(buff)}`">{{ summaryFor(buff) }}</small>
                        </span>
                      </button>
                      <span v-else class="buff-row-toggle is-static">
                        <ImageAvatar :src="thumbnailForBuff(buff)" :name="buffDisplayName(buff)" :size="36" round />
                        <span class="buff-copy">
                          <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                          <small class="buff-effect-summary" :title="`${summaryFor(buff)}\n${buffSubtitle(buff)}`">{{ summaryFor(buff) }}</small>
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
                        <NRadioGroup :value="runtimeParameterValue(buff, definition)" size="small">
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
                          >启用</NCheckbox>
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

                <div v-if="!section.buffs.length" class="empty-state">
                  {{ activeTab === 'teammate' && !section.slot ? '先选择一名队友，查看并调整其 Buff' : '暂无匹配的 Buff' }}
                </div>
              </div>
            </NScrollbar>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lab-buff-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.lab-buff-count-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--lab-ink);
  color: var(--lab-hud-lime);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.lab-buff-body {
  padding: 14px 16px 16px;
}

.buff-picker-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.lab-buff-toolbar {
  justify-content: flex-start;
}

/* Bounded inner scroll viewport: preserves original modal wheel scrolling without bloating page height */
.lab-buff-stage {
  flex: 0 0 auto;
  height: 450px;
  max-height: 450px;
  min-width: 0;
  overflow: hidden;
}

.buff-sections:not(.is-teammate) {
  display: flex;
  flex-direction: column;
  height: 450px;
  max-height: 450px;
  min-height: 0;
  overflow: hidden;
}

.buff-sections:not(.is-teammate) > .buff-section {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper-soft);
  padding: 8px;
}

.buff-section :deep(.buff-list-scrollbar) {
  flex: 1 1 0;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.buff-section :deep(.buff-list-scrollbar > .n-scrollbar-container) {
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding-right: 6px;
  overscroll-behavior: auto;
}

.buff-sections.is-teammate {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: 450px;
  gap: 10px;
  align-items: stretch;
  height: 450px;
  max-height: 450px;
  overflow: hidden;
}

.teammate-buff-column {
  container: teammate-column / inline-size;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 450px;
  overflow: hidden;
  padding: 8px;
  border: 1px solid var(--lab-line-strong);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper-soft);
}

.teammate-column-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 82px auto;
  align-items: center;
  gap: 6px 8px;
  flex-shrink: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--lab-line);
  margin-bottom: 8px;
}

.teammate-loadout-select {
  grid-column: 1 / -1;
  min-width: 0;
}

.teammate-source-tag {
  color: var(--lab-muted);
  font-size: 11px;
  white-space: nowrap;
}

.teammate-column-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--lab-ink);
  white-space: nowrap;
}

.teammate-selection-count {
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  color: var(--lab-muted);
}

.teammate-buff-column .buff-list {
  gap: 7px;
}

@container teammate-column (max-width: 460px) {
  .teammate-column-header {
    grid-template-columns: minmax(0, 1fr) 82px;
  }
  .teammate-column-title { grid-area: 1 / 1; }
  .teammate-selection-count { grid-area: 1 / 2; text-align: right; }
  .teammate-slot-field { grid-area: 2 / 1; }
  .teammate-cinema-field { grid-area: 2 / 2; }
}

@container ui-layout (max-width: 780px) {
  .buff-sections.is-teammate {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    height: auto;
  }
  .teammate-buff-column {
    height: 360px;
  }
}

.buff-category-tabs {
  padding: 4px;
  border: 1px solid var(--lab-line-strong);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-well);
}

.buff-category-tabs :deep(.n-tabs-nav) {
  min-width: 0;
}

.buff-category-tabs :deep(.n-tabs-rail) {
  display: flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  padding: 0;
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
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--lab-ink-2);
  font-size: 12.5px;
  font-weight: 700;
  transition: all 0.14s ease;
}

.buff-category-tabs :deep(.n-tabs-tab:hover) {
  background: rgba(255, 255, 255, 0.7);
  color: var(--lab-ink);
}

.buff-category-tabs :deep(.n-tabs-tab.n-tabs-tab--active),
.buff-category-tabs :deep(.n-tabs-tab.n-tabs-tab--active .n-tabs-tab__label) {
  border-color: var(--lab-ink);
  background: var(--lab-ink);
  color: #ffffff !important;
}

.buff-category-tabs :deep(.n-tabs-capsule) {
  display: none;
}

.field-buff-filter-row,
.boss-buff-filter-row {
  --ui-field-min: 170px;
  gap: 8px;
  align-items: end;
}

.buff-filter-chips {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.buff-filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.buff-filter-chip-label {
  flex: 0 0 auto;
  min-width: 30px;
  color: var(--lab-muted);
  font-size: 11.5px;
  font-weight: 700;
}

.buff-filter-chip {
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid var(--lab-line);
  border-radius: 4px;
  background: var(--lab-paper);
  color: var(--lab-ink-2);
  font: inherit;
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.12s ease;
}

.buff-filter-chip:hover {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
}

.buff-filter-chip.is-active {
  border-color: var(--lab-accent);
  background: var(--lab-accent-soft);
  color: #c93b00;
}

.buff-list {
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.buff-list-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  color: var(--lab-muted);
  font-size: 11.5px;
  font-weight: 700;
}

.buff-list-divider::before,
.buff-list-divider::after {
  flex: 1 1 auto;
  height: 1px;
  background: var(--lab-line);
  content: "";
}

.standard-buff-row {
  display: grid;
  gap: 9px;
  padding: 8px 10px 8px 12px;
  border: 1px solid var(--lab-line);
  border-inline-start: 3px solid transparent;
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper);
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.standard-buff-row.is-selectable:hover {
  border-color: var(--lab-line-strong);
}

.standard-buff-row.is-selected {
  border-color: var(--lab-accent-line);
  border-inline-start-color: var(--lab-accent);
  background: #fffaf7;
}

.buff-row-main {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 46px;
}

.buff-check {
  flex: 0 0 auto;
}

.buff-row-toggle {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: var(--lab-radius-xs);
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
  background: rgba(18, 19, 22, 0.03);
}

.buff-row-toggle.is-static {
  padding-left: 0;
}

.buff-copy {
  flex: 1 1 auto;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.buff-copy strong {
  font-size: 13.5px;
  font-weight: 750;
  color: var(--lab-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buff-copy small.buff-effect-summary,
.buff-effect-summary {
  color: var(--lab-muted);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-engine-modification-control {
  flex: 0 0 116px;
  display: grid;
  gap: 3px;
  min-width: 0;
  color: var(--lab-muted);
  font-size: 11.5px;
  font-weight: 700;
}

.buff-detail-description {
  padding: 7px 10px;
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
  color: var(--lab-muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.skill-target-toggle {
  margin: 0 2px;
  padding: 0 6px;
  border: 1px solid var(--lab-accent-line);
  border-radius: 999px;
  background: var(--lab-accent-soft);
  color: #c93b00;
  font: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.skill-target-list {
  display: block;
  margin-top: 4px;
  color: var(--lab-muted);
  font-weight: 400;
  line-height: 1.55;
}

.buff-effect-lines {
  display: grid;
  gap: 5px;
  color: var(--lab-ink);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
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
  padding-bottom: 5px;
  border-bottom: 1px solid var(--lab-line);
}

.buff-effect-row.is-disabled > span {
  color: var(--lab-muted);
  font-weight: 600;
}

.rule-runtime-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 12px;
}

.rule-enabled-control {
  font-size: 12px;
  font-weight: 650;
}

.rule-coverage-control {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--lab-muted);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.rule-coverage-control :deep(.n-input-number) {
  width: 98px;
}

.buff-runtime-parameters {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
}

.buff-runtime-parameter {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--lab-muted);
  font-size: 12px;
  font-weight: 650;
}

.buff-runtime-parameter span {
  white-space: nowrap;
}

.boss-buff-details {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper-soft);
}

.boss-enemy-intel {
  margin: 0;
  color: var(--lab-ink);
  font-size: 12.5px;
  line-height: 1.6;
}

.boss-effect-group {
  display: grid;
  gap: 6px;
  font-size: 12.5px;
}

.boss-effect-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  color: var(--lab-muted);
  line-height: 1.5;
}

.boss-effect-entry span {
  display: grid;
  gap: 2px;
}

.boss-effect-entry b {
  color: var(--lab-ink);
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
  flex: 1 1 240px;
  min-width: min(100%, 240px);
}

.custom-buff-editor,
.custom-effect-list {
  display: grid;
  gap: 9px;
}

.custom-buff-editor {
  padding: 10px;
  border: 1px solid var(--lab-line-strong);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper);
}

.custom-effect-row {
  --ui-field-min: 150px;
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
  --ui-field-min: 140px;
  gap: 8px;
  align-items: end;
}

.custom-field {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--lab-muted);
  font-size: 11.5px;
  font-weight: 700;
}

@container ui-layout (max-width: 700px) {
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
  .buff-effect-row,
  .boss-effect-entry {
    grid-template-columns: 1fr;
  }
}
</style>
