<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NAlert, NButton, NCheckbox, NInput, NInputNumber, NScrollbar, NSelect, NTag } from "naive-ui"
import { Play, RotateCcw, Square, X } from "lucide-vue-next"
import LayerSlider from "@/components/LayerSlider.vue"
import { thumbnailForDriveDiscSet } from "@/utils/assets"
import { buffDisplayName, buffEffectLines, formatNumber, labelOf } from "@/utils/format"
import {
  defaultRuntimeForBuff,
  effectRuleCoverage,
  effectRuleId,
  effectRules,
  localizedText,
  normalizeRuntimeForBuff,
  runtimeCoverageForEffectRule,
  runtimeSourceGroups,
  runtimeStackGroups,
  storedEffectRuleText,
} from "@core/shared-combat.js"
import type { LabWorkbenchApi } from "@/lab/useLabWorkbench"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

const fourPieceQuery = ref("")
const twoPieceQuery = ref("")
const optimizerMainStatSlots = ["4", "5", "6"]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function stringArray(value: any): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : []
}

function optimizerMinimumValue(value: any, key: string) {
  const minimums = value?.minimums
  return minimums && Object.prototype.hasOwnProperty.call(minimums, key)
    ? minimums[key]
    : null
}

function optimizerMinimumStep(key: string) {
  return ["atk", "def"].includes(key) ? 50 : 10
}

function normalizeOptimizerDraft(value: any = {}) {
  return {
    algorithm: String(value?.algorithm || "exact-super-bound"),
    fourPieceBuffMode: value?.fourPieceBuffMode === "auto" ? "auto" : "manual",
    fourPieceBuffRuntimeInputs: clone(value?.fourPieceBuffRuntimeInputs ?? {}),
    mainStatLimits: {
      "4": stringArray(value?.mainStatLimits?.["4"]),
      "5": stringArray(value?.mainStatLimits?.["5"]),
      "6": stringArray(value?.mainStatLimits?.["6"]),
    },
    minimums: {
      atk: optimizerMinimumValue(value, "atk"),
      def: optimizerMinimumValue(value, "def"),
      anomalyProficiency: optimizerMinimumValue(value, "anomalyProficiency"),
      critRate: optimizerMinimumValue(value, "critRate"),
      critDmg: optimizerMinimumValue(value, "critDmg"),
      lacerationDmg: optimizerMinimumValue(value, "lacerationDmg"),
    },
  }
}

const optimizerDraft = ref<any>(normalizeOptimizerDraft(props.lab.optimizerStore.settings))

watch(
  () => [props.lab.buildStore.agentId, props.lab.loading.value],
  () => {
    optimizerDraft.value = normalizeOptimizerDraft(props.lab.optimizerStore.settings)
  },
  { immediate: true },
)

function commitAdvancedInstant() {
  const payload = normalizeOptimizerDraft(optimizerDraft.value)
  const buffById = new Map((props.lab.fourPieceRuntimeBuffs.value ?? []).map((buff: any) => [buff.id, buff]))
  payload.fourPieceBuffRuntimeInputs = Object.fromEntries(
    Object.entries(payload.fourPieceBuffRuntimeInputs).flatMap(([id, runtime]) => {
      const buff = buffById.get(id)
      return buff ? [[id, normalizeOptimizerRuntimeForBuff(buff, runtime)]] : []
    }),
  )
  props.lab.applyOptimizerConfigInstant(payload)
}

// Drive disc set lists (releasing OptimizerSetChoiceModal inline with bounded scrollbars)
const preferredFourPieceIds = computed<Set<string>>(() => {
  const pref = props.lab.selectedAgent.value?.preferredDriveDiscs
  const list = Array.isArray(pref?.defaultSetIds)
    ? pref.defaultSetIds
    : pref?.defaultSetId ? [pref.defaultSetId] : []
  return new Set<string>(list.map(String))
})

const preferredTwoPieceIds = computed<Set<string>>(() => {
  const pref = props.lab.selectedAgent.value?.preferredDriveDiscs
  const list = Array.isArray(pref?.defaultTwoPieceSetIds) ? pref.defaultTwoPieceSetIds : []
  return new Set<string>(list.map(String))
})

const discCountsBySetId = computed(() => {
  const map = new Map<string, number>()
  for (const disc of props.lab.ownerDriveDiscs.value) {
    const id = String(disc?.setId ?? "")
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
})

const allSetsSorted = computed(() =>
  [...(props.lab.catalogStore.displayDriveDiscSets ?? [])]
    .sort((left: any, right: any) => labelOf(left).localeCompare(labelOf(right), "zh-CN")),
)

const fourPieceSetList = computed(() => {
  const q = fourPieceQuery.value.trim().toLowerCase()
  return [...allSetsSorted.value]
    .filter((set: any) => !q || `${labelOf(set)} ${set.id}`.toLowerCase().includes(q))
    .sort((a: any, b: any) => {
      const aPref = preferredFourPieceIds.value.has(a.id) ? 0 : 1
      const bPref = preferredFourPieceIds.value.has(b.id) ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
      return (discCountsBySetId.value.get(b.id) ?? 0) - (discCountsBySetId.value.get(a.id) ?? 0)
        || labelOf(a).localeCompare(labelOf(b), "zh-CN")
    })
})

const twoPieceSetList = computed(() => {
  const q = twoPieceQuery.value.trim().toLowerCase()
  return [...allSetsSorted.value]
    .filter((set: any) => !q || `${labelOf(set)} ${twoPieceSetEffectText(set)} ${set.id}`.toLowerCase().includes(q))
    .sort((a: any, b: any) => {
      const aPref = preferredTwoPieceIds.value.has(a.id) ? 0 : 1
      const bPref = preferredTwoPieceIds.value.has(b.id) ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
      return (discCountsBySetId.value.get(b.id) ?? 0) - (discCountsBySetId.value.get(a.id) ?? 0)
        || labelOf(a).localeCompare(labelOf(b), "zh-CN")
    })
})

const selectedFourPieceSets = computed(() =>
  props.lab.optimizerStore.fourPieceSetIds
    .map(id => props.lab.catalogStore.displayDriveDiscSets.find((s: any) => s.id === id))
    .filter(Boolean),
)

const selectedTwoPieceSets = computed(() =>
  props.lab.optimizerStore.twoPieceSetIds
    .map(id => props.lab.catalogStore.displayDriveDiscSets.find((s: any) => s.id === id))
    .filter(Boolean),
)

function twoPieceSetEffectText(set: any) {
  return buffEffectLines(set?.twoPiece, undefined, props.lab.catalogStore.meta).join("；") || "2件套效果未录入"
}

function hasFourPieceSet(id: string) {
  return props.lab.optimizerStore.fourPieceSetIds.includes(id)
}

function toggleFourPieceSet(id: string) {
  const current = new Set(props.lab.optimizerStore.fourPieceSetIds)
  if (current.has(id)) {
    if (current.size <= 1) return // requireSelection: must keep at least 1 four-piece set
    current.delete(id)
  } else {
    current.add(id)
  }
  props.lab.optimizerStore.setFourPieceSets([...current])
}

function hasTwoPieceSet(id: string) {
  return props.lab.optimizerStore.twoPieceSetIds.includes(id)
}

function toggleTwoPieceSet(id: string) {
  const current = new Set(props.lab.optimizerStore.twoPieceSetIds)
  if (current.has(id)) current.delete(id)
  else current.add(id)
  props.lab.optimizerStore.setTwoPieceSetIds([...current])
}

function clearTwoPieceSets() {
  props.lab.optimizerStore.setTwoPieceSetIds([])
}

// Advanced OptimizerConfigModal controls (instant apply)
function setAlgorithm(value: string) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    algorithm: String(value || "exact-super-bound"),
  }
  commitAdvancedInstant()
}

function setOptimizerFourPieceBuffMode(checked: boolean) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    fourPieceBuffMode: checked ? "manual" : "auto",
  }
  commitAdvancedInstant()
}

function hasOptimizerMainStat(slot: string, stat: string) {
  return (optimizerDraft.value.mainStatLimits?.[slot] ?? []).includes(stat)
}

function toggleOptimizerMainStat(slot: string, stat: string) {
  const values = new Set(optimizerDraft.value.mainStatLimits?.[slot] ?? [])
  if (values.has(stat)) values.delete(stat)
  else values.add(stat)
  optimizerDraft.value = {
    ...optimizerDraft.value,
    mainStatLimits: {
      ...(optimizerDraft.value.mainStatLimits ?? {}),
      [slot]: [...values],
    },
  }
  commitAdvancedInstant()
}

function clearOptimizerMainStat(slot: string) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    mainStatLimits: {
      ...(optimizerDraft.value.mainStatLimits ?? {}),
      [slot]: [],
    },
  }
  commitAdvancedInstant()
}

function setOptimizerMinimum(key: string, value: number | null) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    minimums: {
      ...(optimizerDraft.value.minimums ?? {}),
      [key]: value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value),
    },
  }
  commitAdvancedInstant()
}

function fourPieceRuntimePartLabel(buff: any) {
  return String(buff?.id ?? "").endsWith(".team") ? "团队效果" : "装备者效果"
}

function normalizeOptimizerRuntimeForBuff(buff: any, runtime: any) {
  const input = runtime && typeof runtime === "object" ? runtime : {}
  const normalized = normalizeRuntimeForBuff(buff, input)
  for (const rule of effectRules(buff)) {
    const id = effectRuleId(rule)
    const configured = input.effects?.[id] ?? input[id]
    normalized.effects[id] = {
      ...(normalized.effects?.[id] ?? {}),
      enabled: configured?.enabled !== false,
    }
  }
  return normalized
}

function optimizerRuntimeFor(buff: any) {
  return normalizeOptimizerRuntimeForBuff(
    buff,
    optimizerDraft.value.fourPieceBuffRuntimeInputs?.[buff.id] ?? defaultRuntimeForBuff(buff),
  )
}

function updateOptimizerRuntime(buff: any, runtime: any) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    fourPieceBuffRuntimeInputs: {
      ...(optimizerDraft.value.fourPieceBuffRuntimeInputs ?? {}),
      [buff.id]: normalizeOptimizerRuntimeForBuff(buff, runtime),
    },
  }
  commitAdvancedInstant()
}

function optimizerBuffDescription(buff: any) {
  return localizedText(buff?.description) || localizedText(buff?.condition)
}

function optimizerEffectRows(buff: any) {
  const runtime = optimizerRuntimeFor(buff)
  return effectRules(buff).map((rule: any) => {
    const displayRule = { ...rule, coverage: undefined }
    const displayBuff = { ...buff, coverage: undefined, effects: [displayRule] }
    return {
      id: effectRuleId(rule),
      rule,
      text: storedEffectRuleText(displayRule, runtime, displayBuff),
      coverage: effectRuleCoverage(rule, buff),
      enabled: runtime.effects?.[effectRuleId(rule)]?.enabled !== false,
    }
  }).filter((row: any) => row.text)
}

function setOptimizerRuleEnabled(buff: any, rule: any, enabled: boolean) {
  const runtime = optimizerRuntimeFor(buff)
  const id = effectRuleId(rule)
  updateOptimizerRuntime(buff, {
    ...runtime,
    effects: {
      ...(runtime.effects ?? {}),
      [id]: { ...(runtime.effects?.[id] ?? {}), enabled },
    },
  })
}

function setOptimizerRuleCoverage(buff: any, rule: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const id = effectRuleId(rule)
  updateOptimizerRuntime(buff, {
    ...runtime,
    effects: {
      ...(runtime.effects ?? {}),
      [id]: { ...(runtime.effects?.[id] ?? {}), coverage: Math.max(0, Math.min(1, Number(value ?? 0))) },
    },
  })
}

function setOptimizerSourceValue(buff: any, group: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = { ...(effects[id] ?? {}), sourceValue: Number(value ?? 0) }
  }
  updateOptimizerRuntime(buff, { ...runtime, effects })
}

function setOptimizerStacks(buff: any, group: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = { ...(effects[id] ?? {}), stacks: Number(value ?? 0) }
  }
  updateOptimizerRuntime(buff, { ...runtime, effects })
}

function resetToAgentRecommended() {
  if (!props.lab.catalogStore.catalog) return
  props.lab.optimizerStore.loadAgentSettings(props.lab.selectedAgent.value, props.lab.catalogStore.catalog)
  optimizerDraft.value = normalizeOptimizerDraft(props.lab.optimizerStore.settings)
}

const activeMainStatLimitCount = computed(() =>
  Object.values(optimizerDraft.value.mainStatLimits ?? {})
    .reduce((total: number, values: any) => total + (Array.isArray(values) ? values.length : 0), 0),
)
const activeMinimumCount = computed(() =>
  Object.values(optimizerDraft.value.minimums ?? {})
    .filter(value => value !== null && value !== undefined).length,
)

const progressPct = computed(() =>
  Math.max(0, Math.min(100, Number(props.lab.optimizerStore.progress?.percent ?? 0))),
)
const progressText = computed(() => {
  const status = props.lab.optimizerStore.status
  if (status === "preparing") return "正在构建候选空间与上界…"
  if (status === "running") {
    const evaluated = formatNumber(props.lab.optimizerStore.progress?.evaluated ?? 0)
    return `求解中 · 已评估 ${evaluated} 组 (${progressPct.value.toFixed(1)}%)`
  }
  if (status === "done") return `优化完成 · 生成 Top ${props.lab.optimizerStore.resultSchemes.length} 方案`
  if (status === "cancelled") return "优化已取消"
  return `本地仓库共 ${props.lab.ownerDriveDiscs.value.length} 张驱动盘待参与搜索`
})
</script>

<template>
  <section id="lab-chapter-optimizer" class="lab-chapter">
    <header class="lab-chapter-head">
      <div>
        <span class="lab-chapter-kicker">CH.04 · SOLVER &amp; CONSTRAINTS</span>
        <h2 class="lab-chapter-title">驱动盘优化器与约束</h2>
        <p class="lab-chapter-desc">
          完整展开 4/2 件套候选、4 件套触发 Buff 运行时参数、主词条限制与面板下限，配置即时同步。
        </p>
      </div>
      <div class="lab-opt-head-actions">
        <NTag v-if="optimizerDraft.fourPieceBuffMode === 'manual'" size="small" type="info" round>4件套 Buff：手动</NTag>
        <NTag v-if="activeMainStatLimitCount" size="small" round>主词条限 {{ activeMainStatLimitCount }} 项</NTag>
        <NTag v-if="activeMinimumCount" size="small" round>下限 {{ activeMinimumCount }} 项</NTag>
        <button type="button" class="lab-btn lab-btn--sm" @click="resetToAgentRecommended">
          <RotateCcw :size="13" />
          <span>恢复默认</span>
        </button>
      </div>
    </header>

    <div class="lab-chapter-body lab-opt-body ui-layout-scope" data-layout-surface="optimizer-config">
      <!-- Section A: 4-Piece & 2-Piece Set Choice Lists (with bounded inner scrollbars) -->
      <div class="lab-opt-sets-split">
        <!-- 4-Piece Sets -->
        <section class="panel lab-opt-set-panel">
          <header class="panel-header lab-opt-set-head">
            <div class="lab-opt-set-title">
              <h3 class="panel-title">限定 4 件套（可多选）</h3>
              <span class="lab-opt-set-hint lab-mono">已选 {{ selectedFourPieceSets.length }} 套 · 至少 1 套</span>
            </div>
            <NInput v-model:value="fourPieceQuery" size="tiny" clearable placeholder="筛选套装…" style="width: 136px" />
          </header>

          <div class="lab-opt-selected-strip">
            <span v-for="set in selectedFourPieceSets" :key="set.id" class="lab-opt-selected-chip">
              <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
              <span>{{ labelOf(set) }}</span>
              <button
                v-if="selectedFourPieceSets.length > 1"
                type="button"
                class="lab-opt-chip-x"
                :aria-label="`移除 ${labelOf(set)}`"
                @click="toggleFourPieceSet(set.id)"
              ><X :size="11" /></button>
            </span>
          </div>

          <div class="lab-opt-set-scroll-box">
            <NScrollbar class="lab-opt-set-scroll" style="max-height: 214px">
              <div class="set-choice-list">
                <label
                  v-for="set in fourPieceSetList"
                  :key="set.id"
                  class="set-choice"
                  :class="{
                    active: hasFourPieceSet(set.id),
                    'is-locked-last': hasFourPieceSet(set.id) && selectedFourPieceSets.length <= 1,
                  }"
                >
                  <input
                    type="checkbox"
                    :checked="hasFourPieceSet(set.id)"
                    :disabled="hasFourPieceSet(set.id) && selectedFourPieceSets.length <= 1"
                    @change="toggleFourPieceSet(set.id)"
                  >
                  <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
                  <span class="set-choice-text">
                    <span class="set-choice-name-row">
                      <strong>{{ labelOf(set) }}</strong>
                      <em v-if="preferredFourPieceIds.has(set.id)" class="lab-rec-dot">荐</em>
                    </span>
                    <span class="lab-mono">库存 {{ discCountsBySetId.get(set.id) ?? 0 }} 件</span>
                  </span>
                </label>
              </div>
            </NScrollbar>
          </div>
        </section>

        <!-- 2-Piece Sets -->
        <section class="panel lab-opt-set-panel">
          <header class="panel-header lab-opt-set-head">
            <div class="lab-opt-set-title">
              <h3 class="panel-title">额外 2 件套</h3>
              <span class="lab-opt-set-hint lab-mono">
                {{ selectedTwoPieceSets.length ? `已选 ${selectedTwoPieceSets.length} 套` : "自动匹配任意 2 件套" }}
              </span>
            </div>
            <div class="lab-opt-set-tools">
              <NButton v-if="selectedTwoPieceSets.length" size="tiny" text @click="clearTwoPieceSets">清空</NButton>
              <NInput v-model:value="twoPieceQuery" size="tiny" clearable placeholder="筛选套装/效果…" style="width: 136px" />
            </div>
          </header>

          <div class="lab-opt-selected-strip">
            <span v-if="!selectedTwoPieceSets.length" class="lab-opt-empty-chip">不限制 · 自动枚举所有 2 件套组合</span>
            <span v-for="set in selectedTwoPieceSets" :key="set.id" class="lab-opt-selected-chip">
              <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
              <span>{{ labelOf(set) }}</span>
              <button
                type="button"
                class="lab-opt-chip-x"
                :aria-label="`移除 ${labelOf(set)}`"
                @click="toggleTwoPieceSet(set.id)"
              ><X :size="11" /></button>
            </span>
          </div>

          <div class="lab-opt-set-scroll-box">
            <NScrollbar class="lab-opt-set-scroll" style="max-height: 214px">
              <div class="set-choice-list">
                <label
                  v-for="set in twoPieceSetList"
                  :key="set.id"
                  class="set-choice"
                  :class="{ active: hasTwoPieceSet(set.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="hasTwoPieceSet(set.id)"
                    @change="toggleTwoPieceSet(set.id)"
                  >
                  <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
                  <span class="set-choice-text">
                    <span class="set-choice-name-row">
                      <strong>{{ labelOf(set) }}</strong>
                      <em v-if="preferredTwoPieceIds.has(set.id)" class="lab-rec-dot">荐</em>
                    </span>
                    <span>{{ twoPieceSetEffectText(set) }}</span>
                  </span>
                </label>
              </div>
            </NScrollbar>
          </div>
        </section>
      </div>

      <!-- Section B: Algorithm + 4pc Buff Runtime Controls (from OptimizerConfigModal) -->
      <section class="panel lab-opt-advanced-panel">
        <div class="panel-body lab-opt-advanced-body">
          <div class="lab-opt-algo-row">
            <div class="metric optimizer-config-field ui-field" data-layout-field>
              <dt>优化算法</dt>
              <dd>
                <NSelect
                  size="small"
                  :value="optimizerDraft.algorithm"
                  :options="lab.optimizerAlgorithmOptions"
                  @update:value="setAlgorithm(String($event))"
                />
              </dd>
            </div>
            <div class="metric optimizer-config-field ui-field" data-layout-field>
              <dt>4 件套 Buff 触发参数</dt>
              <dd class="optimizer-inline-control">
                <NCheckbox
                  :checked="optimizerDraft.fourPieceBuffMode === 'manual'"
                  @update:checked="setOptimizerFourPieceBuffMode(Boolean($event))"
                >
                  手动配置触发参数（覆盖率 / 层数 / 来源值）
                </NCheckbox>
              </dd>
            </div>
          </div>

          <div v-if="optimizerDraft.fourPieceBuffMode === 'manual'" class="lab-opt-runtime-wrap">
            <NScrollbar v-if="lab.fourPieceRuntimeBuffs.value.length" class="lab-opt-runtime-scroll" style="max-height: 230px">
              <div class="optimizer-runtime-list">
                <article
                  v-for="buff in lab.fourPieceRuntimeBuffs.value"
                  :key="buff.id"
                  class="optimizer-runtime-card"
                >
                  <div class="optimizer-runtime-head">
                    <div class="optimizer-runtime-copy">
                      <strong>{{ buffDisplayName(buff) }}</strong>
                      <p v-if="optimizerBuffDescription(buff)">{{ optimizerBuffDescription(buff) }}</p>
                    </div>
                    <NTag round size="small">{{ fourPieceRuntimePartLabel(buff) }}</NTag>
                  </div>
                  <div class="optimizer-effect-list">
                    <div
                      v-for="row in optimizerEffectRows(buff)"
                      :key="row.id"
                      class="optimizer-effect-row"
                      :class="{ 'is-disabled': !row.enabled }"
                    >
                      <span class="optimizer-effect-value">{{ row.text }}</span>
                      <div class="optimizer-effect-controls">
                        <NCheckbox
                          class="optimizer-rule-enabled-control"
                          :checked="row.enabled"
                          @update:checked="setOptimizerRuleEnabled(buff, row.rule, Boolean($event))"
                        >启用</NCheckbox>
                        <label v-if="row.coverage" class="optimizer-rule-coverage-control">
                          <span>覆盖率</span>
                          <NInputNumber
                            :value="runtimeCoverageForEffectRule(row.rule, buff, optimizerRuntimeFor(buff))"
                            :min="Number.isFinite(Number(row.coverage.min)) ? Number(row.coverage.min) : 0"
                            :max="Number.isFinite(Number(row.coverage.max)) ? Number(row.coverage.max) : 1"
                            :step="Number.isFinite(Number(row.coverage.step)) ? Number(row.coverage.step) : 0.1"
                            :disabled="!row.enabled"
                            size="small"
                            @update:value="setOptimizerRuleCoverage(buff, row.rule, $event)"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div v-if="runtimeSourceGroups(buff).length || runtimeStackGroups(buff).length" class="optimizer-runtime-grid">
                    <div v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric optimizer-runtime-metric ui-field" data-layout-field>
                      <dt>{{ group.label || "来源数值" }}</dt>
                      <dd>
                        <NInputNumber
                          size="small"
                          :value="optimizerRuntimeFor(buff).effects?.[group.ruleIds?.[0]]?.sourceValue ?? group.defaultValue ?? 0"
                          :min="Number.isFinite(group.min) ? group.min : undefined"
                          :max="Number.isFinite(group.max) ? group.max : undefined"
                          @update:value="setOptimizerSourceValue(buff, group, Number($event))"
                        />
                      </dd>
                    </div>
                    <div v-for="group in runtimeStackGroups(buff)" :key="group.key" class="metric layer-metric optimizer-runtime-layer ui-field" data-layout-field>
                      <dd>
                        <LayerSlider
                          :label="group.label || '层数'"
                          :value="optimizerRuntimeFor(buff).effects?.[group.ruleIds?.[0]]?.stacks ?? group.defaultStacks ?? group.maxStacks ?? 1"
                          :min="0"
                          :max="group.maxStacks ?? 99"
                          :step="1"
                          @update:value="setOptimizerStacks(buff, group, Number($event))"
                        />
                      </dd>
                    </div>
                  </div>
                </article>
              </div>
            </NScrollbar>
            <div v-else class="optimizer-config-empty">当前四件套没有可手动配置的 Buff</div>
          </div>

          <!-- Section C: Main Stat Limits (4/5/6) -->
          <div class="optimizer-main-stat-config ui-field-grid" data-layout-surface="optimizer-main-stats">
            <div v-for="slot in optimizerMainStatSlots" :key="slot" class="metric optimizer-main-stat-field ui-field" data-layout-field>
              <dt class="optimizer-field-title-row">
                <span>{{ slot }}号位主词条</span>
                <NButton size="tiny" text :disabled="!(optimizerDraft.mainStatLimits?.[slot] ?? []).length" @click="clearOptimizerMainStat(slot)">清空</NButton>
              </dt>
              <dd class="main-stat-choice-list">
                <label
                  v-for="option in lab.mainStatOptionsBySlot.value[slot] ?? []"
                  :key="option.value"
                  class="main-stat-choice"
                  :class="{ active: hasOptimizerMainStat(slot, option.value) }"
                >
                  <input
                    type="checkbox"
                    :checked="hasOptimizerMainStat(slot, option.value)"
                    @change="toggleOptimizerMainStat(slot, option.value)"
                  >
                  <span>{{ option.label }}</span>
                </label>
              </dd>
            </div>
          </div>

          <!-- Section D: Minimum Thresholds -->
          <div class="optimizer-minimum-grid ui-field-grid" data-layout-surface="optimizer-minimums">
            <p class="optimizer-minimum-note">
              <strong>面板最低值</strong>
              <span>以下面板最低值按局外面板数值判断，不计入局内 Buff。</span>
            </p>
            <div v-for="item in lab.minimumStats.value" :key="item.key" class="metric optimizer-config-field ui-field" data-layout-field>
              <dt>{{ item.label }}</dt>
              <dd>
                <NInputNumber
                  size="small"
                  :value="optimizerDraft.minimums?.[item.key]"
                  clearable
                  :min="0"
                  :precision="0"
                  :step="optimizerMinimumStep(item.key)"
                  placeholder="不限定"
                  @update:value="setOptimizerMinimum(item.key, $event === null ? null : Number($event))"
                />
              </dd>
            </div>
          </div>
        </div>
      </section>

      <!-- Section E: Execution & Progress Bar -->
      <div class="lab-opt-exec-bar">
        <div class="lab-opt-exec-status">
          <div class="lab-opt-exec-text">
            <strong>{{ progressText }}</strong>
            <span v-if="lab.optimizerStore.isBusy" class="lab-mono">{{ progressPct.toFixed(1) }}%</span>
          </div>
          <div v-if="lab.optimizerStore.isBusy || lab.optimizerStore.status === 'done'" class="lab-opt-progress-track">
            <div
              class="lab-opt-progress-fill"
              :style="{ width: `${lab.optimizerStore.status === 'done' ? 100 : progressPct}%` }"
            ></div>
          </div>
        </div>
        <div class="lab-opt-exec-actions">
          <button
            v-if="!lab.optimizerStore.isBusy"
            type="button"
            class="lab-btn lab-btn--primary"
            :disabled="!lab.canRunOptimization.value"
            @click="lab.runOptimization()"
          >
            <Play :size="14" />
            <span>开始优化配装</span>
          </button>
          <button
            v-else
            type="button"
            class="lab-btn lab-btn--ink"
            @click="lab.cancelOptimization()"
          >
            <Square :size="13" />
            <span>取消求解</span>
          </button>
        </div>
      </div>

      <NAlert v-if="lab.optimizerStore.error" type="error" :show-icon="false">
        {{ lab.optimizerStore.error }}
      </NAlert>
    </div>
  </section>
</template>

<style scoped>
.lab-opt-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lab-opt-body {
  padding: 14px 16px 16px;
  gap: 12px;
}

.lab-opt-sets-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@container ui-layout (max-width: 780px) {
  .lab-opt-sets-split {
    grid-template-columns: minmax(0, 1fr);
  }
}

.lab-opt-set-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lab-opt-set-head {
  padding: 8px 10px;
  gap: 8px;
}

.lab-opt-set-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.lab-opt-set-hint {
  font-size: 11px;
  color: var(--lab-muted);
}

.lab-opt-set-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lab-opt-selected-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-paper);
  min-height: 36px;
  align-items: center;
}

.lab-opt-selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 7px 0 4px;
  border-radius: 4px;
  border: 1px solid var(--lab-accent-line);
  background: var(--lab-accent-soft);
  color: #b83600;
  font-size: 11.5px;
  font-weight: 700;
}

.lab-opt-selected-chip img {
  width: 17px;
  height: 17px;
  object-fit: contain;
}

.lab-opt-chip-x {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: inherit;
}

.lab-opt-chip-x:hover {
  background: rgba(255, 77, 0, 0.16);
}

.lab-opt-empty-chip {
  font-size: 11.5px;
  color: var(--lab-muted);
}

/* Bounded inner scrollbar preserving original set-choice scrolling */
.lab-opt-set-scroll-box {
  height: 214px;
  max-height: 214px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--lab-paper-soft);
}

.lab-opt-set-scroll-box :deep(.lab-opt-set-scroll) {
  flex: 1 1 0;
  height: 100%;
  max-height: 214px;
  min-height: 0;
}

.lab-opt-set-scroll-box :deep(.lab-opt-set-scroll > .n-scrollbar-container) {
  height: 100%;
  max-height: 214px;
  overflow-y: auto;
  padding: 8px;
  overscroll-behavior: auto;
}

.set-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  gap: 6px;
}

.set-choice {
  display: grid;
  grid-template-columns: 15px 32px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 50px;
  padding: 6px 8px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper);
  cursor: pointer;
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.set-choice:hover {
  border-color: var(--lab-line-strong);
}

.set-choice.active {
  border-color: var(--lab-accent);
  background: #fffaf7;
}

.set-choice.is-locked-last {
  cursor: default;
}

.set-choice input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--lab-accent);
}

.set-choice img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 4px;
  background: var(--lab-paper-soft);
}

.set-choice-text {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.set-choice-name-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.set-choice-text strong {
  color: var(--lab-ink);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lab-rec-dot {
  flex: 0 0 auto;
  font-style: normal;
  font-size: 10px;
  font-weight: 800;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--lab-ink);
  color: var(--lab-hud-lime);
}

.set-choice-text > span:last-child {
  color: var(--lab-muted);
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lab-opt-advanced-body {
  display: grid;
  gap: 12px;
}

.lab-opt-algo-row {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 10px;
}

@container ui-layout (max-width: 640px) {
  .lab-opt-algo-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.optimizer-inline-control {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.lab-opt-runtime-wrap {
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-sm);
  background: var(--lab-paper-soft);
  padding: 8px;
}

.lab-opt-runtime-wrap :deep(.lab-opt-runtime-scroll) {
  max-height: 230px;
}

.lab-opt-runtime-wrap :deep(.lab-opt-runtime-scroll > .n-scrollbar-container) {
  max-height: 230px;
  overflow-y: auto;
  padding-right: 6px;
  overscroll-behavior: auto;
}

.optimizer-runtime-list {
  display: grid;
  gap: 8px;
}

.optimizer-runtime-card {
  display: grid;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper);
}

.optimizer-runtime-head,
.optimizer-field-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.optimizer-runtime-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.optimizer-runtime-copy strong {
  font-size: 12.5px;
  color: var(--lab-ink);
}

.optimizer-runtime-copy p {
  margin: 0;
  color: var(--lab-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.optimizer-effect-list {
  display: grid;
  border-top: 1px solid var(--lab-line);
}

.optimizer-effect-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 0;
  border-bottom: 1px solid var(--lab-line);
}

.optimizer-effect-value {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--lab-ink);
}

.optimizer-effect-row.is-disabled .optimizer-effect-value {
  color: var(--lab-muted);
  font-weight: 600;
}

.optimizer-effect-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 12px;
}

.optimizer-rule-enabled-control {
  font-size: 12px;
  font-weight: 650;
}

.optimizer-rule-coverage-control {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--lab-muted);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.optimizer-rule-coverage-control :deep(.n-input-number) {
  width: 96px;
}

.optimizer-runtime-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.optimizer-runtime-metric {
  min-width: 126px;
  padding: 7px 8px;
}

.optimizer-runtime-metric :deep(.n-input-number) {
  width: 108px;
}

.optimizer-runtime-layer {
  flex: 1 1 220px;
  min-width: min(100%, 220px);
}

.optimizer-config-empty {
  padding: 12px;
  border: 1px dashed var(--lab-line-strong);
  border-radius: var(--lab-radius-xs);
  color: var(--lab-muted);
  font-size: 12px;
  text-align: center;
}

.optimizer-main-stat-config {
  --ui-field-min: 200px;
  gap: 8px;
}

.main-stat-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 5px;
}

.main-stat-choice {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 29px;
  padding: 4px 7px;
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius-xs);
  background: var(--lab-paper);
  color: var(--lab-ink-2);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s ease;
}

.main-stat-choice:hover {
  border-color: var(--lab-line-strong);
}

.main-stat-choice.active {
  border-color: var(--lab-accent);
  background: var(--lab-accent-soft);
  color: #b83600;
}

.main-stat-choice input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--lab-accent);
}

.optimizer-minimum-grid {
  --ui-field-min: 145px;
  gap: 8px;
}

.optimizer-minimum-note {
  display: flex;
  grid-column: 1 / -1;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--lab-muted);
  font-size: 12px;
}

.optimizer-minimum-note strong {
  color: var(--lab-ink);
  font-size: 12.5px;
}

.lab-opt-exec-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 14px;
  border-radius: var(--lab-radius-sm);
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper-soft);
  flex-wrap: wrap;
}

.lab-opt-exec-status {
  flex: 1 1 260px;
  min-width: 0;
  display: grid;
  gap: 6px;
}

.lab-opt-exec-text {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  color: var(--lab-ink);
}

.lab-opt-progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--lab-well);
  overflow: hidden;
}

.lab-opt-progress-fill {
  height: 100%;
  background: var(--lab-accent);
  transition: width 0.2s ease;
}

.lab-opt-exec-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
