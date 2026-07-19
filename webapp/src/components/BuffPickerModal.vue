<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInput, NInputNumber, NModal, NRadioButton, NRadioGroup, NSelect, NScrollbar, NTabPane, NTabs, NTag } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import LayerSlider from "@/components/LayerSlider.vue"
import { imageForBuff } from "@/utils/assets"
import {
  BUFF_CATEGORY_TABS,
  buildCombatBuffGroups,
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
  defaultRuntimeForBuff,
  effectRuleCoverage,
  effectRuleId,
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
const prioritizedTeammateOwnerIds = ref<Set<string>>(new Set())
const fieldVersion = ref("")
const fieldPeriod = ref("")
const fieldName = ref("")
const teammateAttributes = ref<string[]>([])
const teammateSpecialties = ref<string[]>([])
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
    prioritizedTeammateOwnerIds.value = selectedTeammateOwnerIds(
      groupedBuffs.value.teammate ?? [],
      selected,
    )
    syncSelectedTeamWEngineReferences(teamWEngineCandidates)
    draftRuntimeInputs.value = JSON.parse(JSON.stringify(props.runtimeInputs ?? {}))
    query.value = ""
    teammateAttributes.value = []
    teammateSpecialties.value = []
    fieldVersion.value = ""
    fieldPeriod.value = ""
    fieldName.value = ""
    bossVersion.value = ""
    bossPeriod.value = ""
    bossName.value = ""
    activeTab.value = "self"
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

const customOptionList = computed<CustomBuffOption[]>(() =>
  customRow.value.targetKind !== "default" ? CUSTOM_BUFF_SKILL_STAT_OPTIONS : CUSTOM_BUFF_STAT_OPTIONS)

const customStatOptions = computed(() => customOptionList.value.map((option, index) => ({
  label: option[1],
  value: index,
})))

const selectedAgent = computed(() => (props.meta?.agents ?? [])
  .find((agent: any) => agent?.id === props.agentId) ?? null)

const currentDamageElement = computed(() => damageElementForAgent(selectedAgent.value ?? {}))

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

const teammateAttributeOrder = ["physical", "fire", "ice", "electric", "ether", "wind", "honed_edge", "frost", "xuanmo"]
const teammateSpecialtyOrder = ["attack", "stun", "anomaly", "support", "defense", "rupture"]

function currentTeammateOptions(values: unknown[], order: string[], label: (value: string) => string) {
  const available = new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))
  const ordered = order.filter(value => available.delete(value))
  const remaining = [...available].sort((left, right) => label(left).localeCompare(label(right), "zh-CN"))
  return [...ordered, ...remaining].map(value => ({ label: label(value), value }))
}

const teammateAttributeOptions = computed(() => currentTeammateOptions(
  (groupedBuffs.value.teammate ?? []).map((buff: any) => buff.teammateAttribute),
  teammateAttributeOrder,
  attributeLabel,
))

const teammateSpecialtyOptions = computed(() => currentTeammateOptions(
  (groupedBuffs.value.teammate ?? []).map((buff: any) => buff.teammateSpecialty),
  teammateSpecialtyOrder,
  specialtyLabel,
))

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

function teammateBuffMatchesFilters(buff: any) {
  return (!teammateAttributes.value.length || teammateAttributes.value.includes(buff?.teammateAttribute))
    && (!teammateSpecialties.value.length || teammateSpecialties.value.includes(buff?.teammateSpecialty))
}

function teammateOwnerId(buff: any) {
  return String(buff?.ownerId ?? buff?.teammateId ?? "").trim()
}

function selectedTeammateOwnerIds(buffs: any[], selectedIds: Set<string>) {
  const ownerIds = new Set<string>()
  for (const buff of buffs) {
    const ownerId = teammateOwnerId(buff)
    if (ownerId && selectedIds.has(buff?.id)) {
      ownerIds.add(ownerId)
    }
  }
  return ownerIds
}

function prioritizeSelectedTeammateBuffs(buffs: any[]) {
  if (!prioritizedTeammateOwnerIds.value.size) {
    return buffs
  }
  const prioritized: any[] = []
  const remaining: any[] = []
  for (const buff of buffs) {
    const ownerId = teammateOwnerId(buff)
    const destination = ownerId && prioritizedTeammateOwnerIds.value.has(ownerId)
      ? prioritized
      : remaining
    destination.push(buff)
  }
  return [...prioritized, ...remaining]
}

const categoryBuffs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const source = activeTab.value === "field"
    ? fieldBuffs.value.filter(fieldBuffMatchesFilters)
    : activeTab.value === "boss"
      ? bossBuffs.value.filter(bossBuffMatchesFilters)
      : activeTab.value === "teammate"
        ? (groupedBuffs.value.teammate ?? []).filter(teammateBuffMatchesFilters)
        : groupedBuffs.value[activeTab.value] ?? []
  return source
    .filter(buff => !needle || buffText(buff).includes(needle))
})

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
  return activeTab.value === "teammate"
    ? prioritizeSelectedTeammateBuffs(categoryBuffs.value)
    : categoryBuffs.value
})
const selectedCount = computed(() => draft.value.size
  + draftAddedBuffs.value.filter(buff => buff?.sourceKind === "custom").length)
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
}

function hasRuntimeControls(buff: any) {
  return Boolean(runtimeSourceGroups(buff).length || runtimeStackGroups(buff).length)
}

function runtimeFor(buff: any) {
  return normalizeRuntimeForBuff(buff, draftRuntimeInputs.value[buff.id] ?? defaultRuntimeForBuff(buff))
}

function effectRowsFor(buff: any) {
  const runtime = runtimeFor(buff)
  return effectRules(buff).map((rule: any) => ({
    id: effectRuleId(rule),
    rule,
    text: storedEffectRuleText(rule, runtime, buff, props.meta),
    coverage: effectRuleCoverage(rule, buff),
  })).filter((row: any) => row.text)
}

function modifierLinesFor(buff: any) {
  return storedBuffModifierTexts(buff)
}

function updateRuntime(buff: any, runtime: any) {
  draftRuntimeInputs.value = {
    ...draftRuntimeInputs.value,
    [buff.id]: normalizeRuntimeForBuff(buff, runtime),
  }
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

function toggle(id: string, checked: boolean) {
  const next = new Set(draft.value)
  const nextRuntime = { ...draftRuntimeInputs.value }
  const buff = Object.values(groupedBuffs.value).flat().find((item: any) => item?.id === id) as any
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
  const next = new Set(draft.value)
  for (const buff of visibleBuffs.value) {
    next.add(buff.id)
    if (buff?.isTeammateWEngine) {
      upsertTeamWEngineReference(buff)
    }
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
    if (buff?.isTeammateWEngine) {
      removeTeamWEngineReference(buff.id)
    }
  }
  draft.value = next
  draftRuntimeInputs.value = nextRuntime
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
  const teamWEngineCandidates = groupedBuffs.value.teammateWEngine ?? []
  syncSelectedTeamWEngineReferences(teamWEngineCandidates)
  const availableTeamWEngineIds = new Set(teamWEngineCandidates.map((buff: any) => buff.id))
  const addedBuffs = draftAddedBuffs.value.filter(item =>
    item?.sourceKind !== "wEngineTeam"
    || !availableTeamWEngineIds.has(item.id)
    || draft.value.has(item.id))
  const selectedBuffIds = [...draft.value]
  const buffById = new Map(Object.values(groupedBuffs.value).flat().map((buff: any) => [buff.id, buff]))
  const runtimeInputs = Object.fromEntries(Object.entries(draftRuntimeInputs.value).flatMap(([id, runtime]) => {
    const buff = buffById.get(id)
    return buff ? [[id, normalizeRuntimeForBuff(buff, runtime)]] : []
  }))
  emit("apply", {
    selectedBuffIds,
    addedBuffs,
    runtimeInputs,
  })
  close()
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="选择 Buff"
    style="width: min(1080px, calc(100vw - 16px)); max-width: 1080px"
    @update:show="emit('update:show', $event)"
  >
    <div class="section-band buff-picker-layout ui-layout-scope" data-layout-surface="buff-picker">
      <div class="toolbar">
        <NInput v-model:value="query" clearable placeholder="搜索来源、名称、效果" style="max-width: 360px" />
        <NTag round>已选 {{ selectedCount }} 项</NTag>
        <NButton size="small" :disabled="!canBulkAddVisible" @click="addVisibleBuffs">添加当前列表</NButton>
        <NButton size="small" :disabled="activeTab === 'custom'" @click="removeVisibleBuffs">移除当前列表</NButton>
      </div>

      <NTabs v-model:value="activeTab" class="buff-category-tabs" type="segment">
        <NTabPane v-for="tab in categoryTabs" :key="tab.name" :name="tab.name" :tab="tab.label" />
      </NTabs>

      <div v-if="activeTab === 'teammate'" class="teammate-buff-filter-row ui-field-grid ui-field-grid--comfortable" data-layout-surface="teammate-buff-filters">
        <label class="custom-field ui-field" data-layout-field>
          <span>属性</span>
          <NSelect
            v-model:value="teammateAttributes"
            multiple
            clearable
            data-testid="teammate-attribute-filter"
            placeholder="全部属性"
            :options="teammateAttributeOptions"
          />
        </label>
        <label class="custom-field ui-field" data-layout-field>
          <span>特性</span>
          <NSelect
            v-model:value="teammateSpecialties"
            multiple
            clearable
            data-testid="teammate-specialty-filter"
            placeholder="全部特性"
            :options="teammateSpecialtyOptions"
          />
        </label>
      </div>

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

      <NScrollbar class="buff-list-scrollbar" style="width: 100%; max-width: 100%; min-width: 0; max-height: 560px">
        <div class="section-band buff-list">
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
                  <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                  <small :title="buffSubtitle(buff)">{{ buffSubtitle(buff) }}</small>
                </span>
              </button>
              <span v-else class="buff-row-toggle is-static">
                <ImageAvatar :src="imageForBuff(buff)" :name="buffDisplayName(buff)" round />
                <span class="buff-copy">
                  <strong :title="buffDisplayName(buff)">{{ buffDisplayName(buff) }}</strong>
                  <small :title="buffSubtitle(buff)">{{ buffSubtitle(buff) }}</small>
                </span>
              </span>
              <NButton v-if="activeTab === 'custom'" size="small" type="error" @click="removeCustomBuff(buff.id)">移除</NButton>
              <label v-if="buff.isTeammateWEngine && draft.has(buff.id)" class="w-engine-modification-control">
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
            <div v-if="effectRowsFor(buff).length || modifierLinesFor(buff).length" class="buff-effect-lines">
              <div v-for="row in effectRowsFor(buff)" :key="row.id" class="buff-effect-row">
                <span>{{ row.text }}</span>
                <label v-if="row.coverage" class="rule-coverage-control">
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
            <div v-if="activeTab === 'boss'" class="boss-buff-details">
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
            <div v-if="hasRuntimeControls(buff)" class="runtime-grid" data-layout-surface="buff-runtime">
              <div v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric runtime-metric ui-field" data-layout-field>
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

.teammate-buff-filter-row,
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
}
</style>
