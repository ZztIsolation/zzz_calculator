<script setup lang="ts">
import { NAlert, NButton, NInput, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSwitch } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import { createSystemManagedCoverage } from "@core/maintenanceValidation.js"
import SkillTargetEditor from "./SkillTargetEditor.vue"
import {
  ANOMALY_SETTLEMENT_OPTIONS, BASIS_OPTIONS, EFFECT_MODE_OPTIONS, EFFECT_TYPE_OPTIONS, EVENT_STAT_KEYS, FORMULA_VALUE_UNIT_OPTIONS,
  SPECIALTY_OPTIONS, TARGET_KIND_OPTIONS, anomalyOptions, defaultEffectRule, defaultGeneralSkillTargets, defaultModeForStat, defaultSkillTarget, option, statOptions,
} from "./maintenance-options"
import { internalId, textOf } from "./maintenance-model"

const props = withDefaults(defineProps<{
  model: any
  catalog: any
  disabled?: boolean
  simple?: boolean
  allowCoverage?: boolean
  allowModificationValues?: boolean
  preferredSkillId?: string
}>(), { simple: false, allowCoverage: false, allowModificationValues: false, preferredSkillId: "" })
const emit = defineEmits<{ change: [] }>()

function rules() {
  return Array.isArray(props.model.effects) ? props.model.effects as any[] : []
}

function addRule() {
  props.model.effects ??= []
  props.model.effects.push(defaultEffectRule())
  emit("change")
}

function removeRule(index: number) {
  props.model.effects?.splice(index, 1)
  emit("change")
}

function setCoverageEnabled(rule: any, enabled: boolean) {
  if (enabled) rule.coverage = createSystemManagedCoverage(Number(rule.coverage?.default ?? 1))
  else delete rule.coverage
  emit("change")
}

function coveragePercent(rule: any) {
  return Number(rule.coverage?.default ?? 1) * 100
}

function setCoveragePercent(rule: any, value: number | null) {
  rule.coverage = createSystemManagedCoverage(Math.max(0, Math.min(100, Number(value ?? 0))) / 100)
  emit("change")
}

function changeType(rule: any, type: string) {
  rule.type = type
  if (type === "derived") {
    rule.sourceLabel ??= { zhCN: "来源数值" }
    rule.defaultSourceValue ??= 0
    rule.ratio ??= 0
  } else if (type === "formula") {
    rule.source ??= { variable: "x", label: { zhCN: "来源数值" }, defaultValue: 0 }
    rule.formula ??= { expression: "", valueUnit: "storedValue" }
  } else if (type === "stacked") {
    rule.valuePerStack ??= Number(rule.value ?? 0)
    rule.maxStacks ??= 1
    rule.defaultStacks ??= rule.maxStacks
  } else {
    rule.value ??= Number(rule.valuePerStack ?? 0)
  }
  emit("change")
}

function changeTarget(rule: any, kind: string) {
  delete rule.appliesTo
  if (kind === "specific") {
    const existing = (rule.target?.skillTargets ?? []).filter((target: any) => target?.kind === "specific")
    rule.target = { kind: "skill", skillTargets: existing.length ? existing : [defaultSkillTarget(props.catalog, props.preferredSkillId)] }
  } else if (kind === "skillType") {
    const existing = (rule.target?.skillTargets ?? []).filter((target: any) => target?.kind === "skillType")
    rule.target = { kind: "skill", skillTargets: existing.length ? existing : defaultGeneralSkillTargets() }
  } else if (kind === "skillTag") {
    const existing = (rule.target?.skillTargets ?? []).filter((target: any) => target?.kind === "skillTag")
    rule.target = { kind: "skill", skillTargets: existing.length ? existing : [{ kind: "skillTag", skillTag: "dashAttack" }] }
  } else if (kind === "anomaly") {
    const effects = anomalyOptions(props.catalog, false)
    rule.target = {
      kind: "anomaly",
      settlementType: "attribute",
      anomalyEffects: [String(effects[0]?.value ?? "assault")],
    }
  } else {
    rule.target = { kind: "default" }
  }
  const options = statOptions(props.catalog, kind === "default" ? "default" : kind === "anomaly" ? "anomaly" : "skill")
  if (!options.some(item => item.value === rule.stat)) rule.stat = String(options[0]?.value ?? "atkFlat")
  syncMode(rule)
  emit("change")
}

function targetMode(rule: any): "default" | "anomaly" | "specific" | "skillType" | "skillTag" {
  if (rule.target?.kind === "anomaly") return "anomaly"
  if (rule.target?.kind !== "skill") return "default"
  if ((rule.target.skillTargets ?? []).some((target: any) => target?.kind === "skillTag")) return "skillTag"
  return (rule.target.skillTargets ?? []).some((target: any) => target?.kind === "skillType") ? "skillType" : "specific"
}

function changeStat(rule: any, stat: string) {
  rule.stat = stat
  delete rule.appliesTo
  syncMode(rule)
  emit("change")
}

function syncMode(rule: any) {
  if (["skill", "anomaly"].includes(rule.target?.kind) || EVENT_STAT_KEYS.has(rule.stat)) {
    rule.mode = "flat"
    delete rule.basis
  } else if (!rule.mode || !["flat", "pct"].includes(rule.mode)) {
    rule.mode = defaultModeForStat(rule.stat)
  }
}

function anomalyTargetOptions(rule: any) {
  return anomalyOptions(props.catalog, rule.target?.settlementType === "disorder")
}

function changeAnomalySettlement(rule: any, settlementType: string) {
  const normalizedType = settlementType === "disorder" ? "disorder" : "attribute"
  const options = anomalyOptions(props.catalog, normalizedType === "disorder")
  const valid = new Set(options.map((item: any) => String(item.value)))
  const existing = (rule.target?.anomalyEffects ?? []).map(String).filter((value: string) => valid.has(value))
  rule.target.settlementType = normalizedType
  rule.target.anomalyEffects = existing.length ? existing : [String(options[0]?.value ?? (normalizedType === "disorder" ? "burn" : "assault"))]
  emit("change")
}

function changeAnomalyEffects(rule: any, values: unknown) {
  rule.target.anomalyEffects = Array.isArray(values) ? values.map(String) : []
  emit("change")
}

function ensureSkillTargets(rule: any) {
  rule.target ??= { kind: "skill" }
  rule.target.skillTargets ??= []
  return rule.target.skillTargets
}

function modificationText(rule: any) {
  const key = rule.type === "stacked" ? "valuePerStack" : "value"
  return Array.isArray(rule.modificationValues?.[key]) ? rule.modificationValues[key].join("/") : ""
}

function setModificationText(rule: any, value: string) {
  const key = rule.type === "stacked" ? "valuePerStack" : "value"
  const values = value.split("/").map(item => Number(item.trim())).filter(Number.isFinite)
  if (values.length) rule.modificationValues = { ...(rule.modificationValues ?? {}), [key]: values }
  else delete rule.modificationValues
  emit("change")
}

function setStackLabel(rule: any, value: string) {
  rule.stackLabel = value ? { zhCN: value } : undefined
  if (value && !rule.stackGroup) rule.stackGroup = internalId("stack")
  if (rule.stackGroup) {
    for (const candidate of rules()) {
      if (candidate !== rule && candidate.stackGroup === rule.stackGroup) candidate.stackLabel = value ? { zhCN: value } : undefined
    }
  }
  emit("change")
}

function setRuleSpecialty(rule: any, value: string | null) {
  if (value) rule.requirement = { ...(rule.requirement ?? {}), specialty: value }
  else delete rule.requirement
  emit("change")
}

function stackGroupOptions(rule: any) {
  const rows = new Map<string, string>()
  for (const candidate of rules()) {
    if (!candidate.stackGroup) continue
    rows.set(candidate.stackGroup, textOf(candidate.stackLabel) || "现有共享层数组")
  }
  if (rule.stackGroup && !rows.has(rule.stackGroup)) rows.set(rule.stackGroup, textOf(rule.stackLabel) || "现有共享层数组")
  return [...rows].map(([value, label]) => option(value, label))
}

function selectStackGroup(rule: any, value: string) {
  if (!value) {
    delete rule.stackGroup
    delete rule.stackLabel
  } else {
    const source = rules().find(candidate => candidate.stackGroup === value)
    rule.stackGroup = value
    rule.stackLabel = source?.stackLabel ? { ...source.stackLabel } : { zhCN: "共享层数组" }
  }
  emit("change")
}

</script>

<template>
  <div class="effect-rules-editor">
    <article v-for="(rule, index) in rules()" :key="rule.id ?? index" class="maintenance-rule-card">
      <header class="maintenance-row-head effect-rule-head">
        <strong>增幅 {{ index + 1 }}</strong>
        <NButton quaternary type="error" :disabled="disabled" title="删除增幅规则" @click="removeRule(index)"><template #icon><Trash2 :size="16" /></template></NButton>
      </header>
      <div class="effect-rule-grid">
        <label v-if="!simple" class="maintenance-field"><span>计算类型</span><NSelect :value="rule.type ?? 'fixed'" :options="EFFECT_TYPE_OPTIONS" :disabled="disabled" @update:value="changeType(rule, String($event))" /></label>
        <label v-if="!simple" class="maintenance-field maintenance-field-wide"><span>增幅对象</span><NRadioGroup class="maintenance-target-mode" :value="targetMode(rule)" :disabled="disabled" size="small"><NRadioButton v-for="item in TARGET_KIND_OPTIONS" :key="item.value" :value="item.value" :label="item.label" @click="changeTarget(rule, String(item.value))" /></NRadioGroup></label>
        <label class="maintenance-field" data-field-key="stat"><span>增幅类型</span><NSelect filterable :consistent-menu-width="false" :value="rule.stat" :options="statOptions(catalog, rule.target?.kind)" :disabled="disabled" @update:value="changeStat(rule, String($event))" /></label>
        <label v-if="!['derived', 'formula'].includes(rule.type)" class="maintenance-field"><span>{{ rule.type === 'stacked' ? '每层数值' : '数值' }}</span><NInputNumber :value="rule.type === 'stacked' ? rule.valuePerStack : rule.value" :disabled="disabled" :step="0.01" @update:value="rule[rule.type === 'stacked' ? 'valuePerStack' : 'value'] = $event; emit('change')" /></label>
        <label v-if="rule.target?.kind !== 'skill' && !EVENT_STAT_KEYS.has(rule.stat)" class="maintenance-field"><span>计算方式</span><NSelect v-model:value="rule.mode" :options="EFFECT_MODE_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
        <label v-if="rule.target?.kind !== 'skill' && !EVENT_STAT_KEYS.has(rule.stat)" class="maintenance-field"><span>基准</span><NSelect v-model:value="rule.basis" :options="BASIS_OPTIONS" :disabled="disabled" clearable @update:value="emit('change')" /></label>
      </div>

      <div v-if="rule.target?.kind === 'skill'" class="maintenance-nested-panel">
        <strong>{{ targetMode(rule) === 'skillType' ? '通用技能大类' : targetMode(rule) === 'skillTag' ? '通用招式标签' : '指定角色招式' }}</strong>
        <SkillTargetEditor :targets="ensureSkillTargets(rule)" :mode="targetMode(rule) === 'skillType' ? 'skillType' : targetMode(rule) === 'skillTag' ? 'skillTag' : 'specific'" :catalog="catalog" :disabled="disabled" :preferred-skill-id="preferredSkillId" @change="emit('change')" />
      </div>

      <div v-if="rule.target?.kind === 'anomaly'" class="maintenance-nested-panel maintenance-grid">
        <label class="maintenance-field"><span>结算类型</span><NSelect :value="rule.target.settlementType" :options="ANOMALY_SETTLEMENT_OPTIONS" :disabled="disabled" @update:value="changeAnomalySettlement(rule, String($event))" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>具体异常</span><NSelect multiple filterable :value="rule.target.anomalyEffects ?? []" :options="anomalyTargetOptions(rule)" :disabled="disabled" @update:value="changeAnomalyEffects(rule, $event)" /></label>
      </div>

      <NAlert v-if="rule.appliesTo" type="error" title="旧筛选无法保存">
        该规则包含无法自动转换的旧筛选，请重新选择明确的增幅类型或增幅对象。
      </NAlert>

      <div v-if="rule.type === 'derived'" class="maintenance-grid rule-detail-grid">
        <label class="maintenance-field"><span>来源数值名称</span><NInput :value="textOf(rule.sourceLabel)" :disabled="disabled" @update:value="rule.sourceLabel = { zhCN: String($event) }; emit('change')" /></label>
        <label class="maintenance-field"><span>默认来源数值</span><NInputNumber v-model:value="rule.defaultSourceValue" :disabled="disabled" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>转换比例%</span><NInputNumber v-model:value="rule.ratio" :disabled="disabled" :step="0.01" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>上限</span><NInputNumber v-model:value="rule.cap" :disabled="disabled" :step="0.01" clearable @update:value="emit('change')" /></label>
      </div>

      <div v-if="rule.type === 'formula'" class="maintenance-grid rule-detail-grid">
        <label class="maintenance-field"><span>来源数值名称</span><NInput :value="textOf(rule.source?.label)" :disabled="disabled" @update:value="rule.source.label = { zhCN: String($event) }; emit('change')" /></label>
        <label class="maintenance-field"><span>默认来源数值</span><NInputNumber v-model:value="rule.source.defaultValue" :disabled="disabled" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>来源下限</span><NInputNumber v-model:value="rule.source.min" :disabled="disabled" clearable @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>来源上限</span><NInputNumber v-model:value="rule.source.max" :disabled="disabled" clearable @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>公式结果单位</span><NSelect v-model:value="rule.formula.valueUnit" :options="FORMULA_VALUE_UNIT_OPTIONS" :disabled="disabled" @update:value="emit('change')" /></label>
        <label class="maintenance-field maintenance-field-wide"><span>公式</span><NInput v-model:value="rule.formula.expression" :disabled="disabled" placeholder="clamp(floor((x - 15000) / 400) + 10, 10, 40)" @update:value="emit('change')" /></label>
      </div>

      <div v-if="rule.type === 'stacked'" class="maintenance-grid rule-detail-grid">
        <label class="maintenance-field"><span>最大层数</span><NInputNumber v-model:value="rule.maxStacks" :disabled="disabled" :min="0" :step="1" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>默认层数</span><NInputNumber v-model:value="rule.defaultStacks" :disabled="disabled" :min="0" :step="1" @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>共享层数组</span><NSelect clearable :consistent-menu-width="false" :value="rule.stackGroup ?? ''" :options="stackGroupOptions(rule)" :disabled="disabled" placeholder="未共享" @update:value="selectStackGroup(rule, String($event ?? ''))" /></label>
        <label class="maintenance-field"><span>共享层数显示名</span><NInput :value="textOf(rule.stackLabel)" :disabled="disabled" placeholder="同名规则共享层数" @update:value="setStackLabel(rule, String($event))" /></label>
      </div>

      <div v-if="allowCoverage" class="maintenance-grid rule-detail-grid coverage-editor">
        <label class="maintenance-switch-field"><span>允许用户调整覆盖率</span><NSwitch :value="Boolean(rule.coverage)" :disabled="disabled" @update:value="setCoverageEnabled(rule, $event)" /></label>
        <label v-if="rule.coverage" class="maintenance-field"><span>默认覆盖率%</span><NInputNumber :value="coveragePercent(rule)" :disabled="disabled" :min="0" :max="100" :step="10" @update:value="setCoveragePercent(rule, $event)" /></label>
      </div>

      <div v-if="allowCoverage" class="maintenance-grid rule-detail-grid">
        <label class="maintenance-field maintenance-field-wide"><span>触发条件</span><NInput v-model:value="rule.condition" :disabled="disabled" clearable @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>持续时间（秒）</span><NInputNumber v-model:value="rule.durationSeconds" :disabled="disabled" :min="0" clearable @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>冷却时间（秒）</span><NInputNumber v-model:value="rule.cooldownSeconds" :disabled="disabled" :min="0" clearable @update:value="emit('change')" /></label>
        <label class="maintenance-field"><span>装备者特性要求</span><NSelect :value="rule.requirement?.specialty ?? null" :options="SPECIALTY_OPTIONS" :disabled="disabled" clearable @update:value="setRuleSpecialty(rule, $event ? String($event) : null)" /></label>
      </div>

      <div v-if="allowModificationValues && ['fixed', 'stacked'].includes(rule.type)" class="maintenance-grid rule-detail-grid">
        <label class="maintenance-field maintenance-field-wide"><span>1-5 级实际值</span><NInput :value="modificationText(rule)" :disabled="disabled" placeholder="15/17.5/20/22/24" @update:value="setModificationText(rule, String($event))" /></label>
      </div>

    </article>
    <NButton size="small" :disabled="disabled" @click="addRule"><template #icon><Plus :size="15" /></template>添加增幅</NButton>
    <p class="maintenance-help">百分比属性直接填写百分比数字，例如 15 表示 15%。</p>
  </div>
</template>
