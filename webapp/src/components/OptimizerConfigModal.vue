<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NCheckbox, NInputNumber, NModal, NSelect, NTag } from "naive-ui"
import LayerSlider from "@/components/LayerSlider.vue"
import { buffDisplayName } from "@/utils/format"
import {
  defaultRuntimeForBuff,
  effectRuleCoverage,
  effectRuleId,
  effectRules,
  normalizeRuntimeForBuff,
  runtimeCoverageForEffectRule,
  runtimeSourceGroups,
  runtimeStackGroups,
  storedEffectRuleText,
} from "@core/shared-combat.js"

const props = defineProps<{
  show: boolean
  optimizerConfig?: any
  optimizerAlgorithmOptions?: Array<{ label: string, value: string }>
  mainStatOptionsBySlot?: Record<string, Array<{ label: string, value: string }>>
  minimumStats?: Array<{ key: string, label: string }>
  fourPieceRuntimeBuffs?: any[]
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  save: [value: any]
}>()

const optimizerDraft = ref<any>(normalizeOptimizerDraft())
const optimizerMainStatSlots = ["4", "5", "6"]
const optimizerAlgorithmChoices = computed(() => props.optimizerAlgorithmOptions?.length
  ? props.optimizerAlgorithmOptions
  : [
      { label: "精确搜索（超界剪枝）", value: "exact-super-bound" },
      { label: "启发式潜力", value: "heuristic-potential" },
      { label: "旧版精确", value: "exact-legacy" },
    ])
const optimizerMinimumFields = computed(() => props.minimumStats?.length
  ? props.minimumStats
  : [
      { key: "atk", label: "攻击力" },
      { key: "anomalyProficiency", label: "异常精通" },
      { key: "critRate", label: "暴击率%" },
      { key: "critDmg", label: "暴击伤害%" },
    ])

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
  return key === "atk" ? 50 : 10
}

function normalizeOptimizerDraft(value: any = {}) {
  return {
    algorithm: String(value?.algorithm || "exact-super-bound"),
    fourPieceBuffMode: value?.fourPieceBuffMode === "manual" ? "manual" : "auto",
    fourPieceBuffRuntimeInputs: clone(value?.fourPieceBuffRuntimeInputs ?? {}),
    mainStatLimits: {
      "4": stringArray(value?.mainStatLimits?.["4"]),
      "5": stringArray(value?.mainStatLimits?.["5"]),
      "6": stringArray(value?.mainStatLimits?.["6"]),
    },
    minimums: {
      atk: optimizerMinimumValue(value, "atk"),
      anomalyProficiency: optimizerMinimumValue(value, "anomalyProficiency"),
      critRate: optimizerMinimumValue(value, "critRate"),
      critDmg: optimizerMinimumValue(value, "critDmg"),
    },
  }
}

watch(() => props.show, value => {
  if (value) {
    optimizerDraft.value = normalizeOptimizerDraft(props.optimizerConfig)
  }
})

watch(() => props.optimizerConfig, value => {
  if (props.show) {
    optimizerDraft.value = normalizeOptimizerDraft(value)
  }
}, { deep: true })

function setOptimizerFourPieceBuffMode(checked: boolean) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    fourPieceBuffMode: checked ? "manual" : "auto",
  }
}

function hasOptimizerMainStat(slot: string, stat: string) {
  return (optimizerDraft.value.mainStatLimits?.[slot] ?? []).includes(stat)
}

function toggleOptimizerMainStat(slot: string, stat: string) {
  const values = new Set(optimizerDraft.value.mainStatLimits?.[slot] ?? [])
  if (values.has(stat)) {
    values.delete(stat)
  } else {
    values.add(stat)
  }
  optimizerDraft.value = {
    ...optimizerDraft.value,
    mainStatLimits: {
      ...(optimizerDraft.value.mainStatLimits ?? {}),
      [slot]: [...values],
    },
  }
}

function clearOptimizerMainStat(slot: string) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    mainStatLimits: {
      ...(optimizerDraft.value.mainStatLimits ?? {}),
      [slot]: [],
    },
  }
}

function setOptimizerMinimum(key: string, value: number | null) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    minimums: {
      ...(optimizerDraft.value.minimums ?? {}),
      [key]: value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value),
    },
  }
}

function fourPieceRuntimePartLabel(buff: any) {
  return String(buff?.id ?? "").endsWith(".team") ? "团队效果" : "装备者效果"
}

function optimizerRuntimeFor(buff: any) {
  return normalizeRuntimeForBuff(buff, optimizerDraft.value.fourPieceBuffRuntimeInputs?.[buff.id] ?? defaultRuntimeForBuff(buff))
}

function updateOptimizerRuntime(buff: any, runtime: any) {
  optimizerDraft.value = {
    ...optimizerDraft.value,
    fourPieceBuffRuntimeInputs: {
      ...(optimizerDraft.value.fourPieceBuffRuntimeInputs ?? {}),
      [buff.id]: normalizeRuntimeForBuff(buff, runtime),
    },
  }
}

function coverageRules(buff: any) {
  return effectRules(buff).filter((rule: any) => effectRuleCoverage(rule, buff))
}

function setOptimizerRuleCoverage(buff: any, rule: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const id = effectRuleId(rule)
  updateOptimizerRuntime(buff, {
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

function setOptimizerSourceValue(buff: any, group: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      sourceValue: Number(value ?? 0),
    }
  }
  updateOptimizerRuntime(buff, { ...runtime, effects })
}

function setOptimizerStacks(buff: any, group: any, value: number | null) {
  const runtime = optimizerRuntimeFor(buff)
  const effects = { ...(runtime.effects ?? {}) }
  for (const id of group.ruleIds ?? []) {
    effects[id] = {
      ...(effects[id] ?? {}),
      stacks: Number(value ?? 0),
    }
  }
  updateOptimizerRuntime(buff, { ...runtime, effects })
}

function close() {
  emit("update:show", false)
}

function save() {
  const payload = normalizeOptimizerDraft(optimizerDraft.value)
  const buffById = new Map((props.fourPieceRuntimeBuffs ?? []).map((buff: any) => [buff.id, buff]))
  payload.fourPieceBuffRuntimeInputs = Object.fromEntries(Object.entries(payload.fourPieceBuffRuntimeInputs).flatMap(([id, runtime]) => {
    const buff = buffById.get(id)
    return buff ? [[id, normalizeRuntimeForBuff(buff, runtime)]] : []
  }))
  emit("save", payload)
  close()
}
</script>

<template>
  <NModal :show="show" preset="card" title="优化约束" style="width: min(920px, calc(100vw - 16px)); max-width: 920px" @update:show="emit('update:show', $event)">
    <section class="optimizer-config-panel ui-layout-scope" data-layout-surface="optimizer-config">
      <div class="optimizer-config-header">
        <div>
          <h3 class="panel-title">计算配置</h3>
          <p>算法、4 件套 Buff、主词条和最小值会参与下一次驱动盘优化。</p>
        </div>
        <NTag round>高级设置</NTag>
      </div>
      <div class="optimizer-config-body ui-field-grid" data-layout-surface="optimizer-fields">
        <div class="metric optimizer-config-field ui-field" data-layout-field>
          <dt>算法</dt>
          <dd>
            <NSelect
              :value="optimizerDraft.algorithm"
              :options="optimizerAlgorithmChoices"
              @update:value="optimizerDraft.algorithm = String($event)"
            />
          </dd>
        </div>

        <div class="metric optimizer-config-field optimizer-config-field-wide ui-field ui-field--full" data-layout-field>
          <dt>4 件套 Buff</dt>
          <dd class="optimizer-inline-control">
            <NCheckbox
              :checked="optimizerDraft.fourPieceBuffMode === 'manual'"
              @update:checked="setOptimizerFourPieceBuffMode(Boolean($event))"
            >
              手动配置触发参数
            </NCheckbox>
            <span class="muted">{{ optimizerDraft.fourPieceBuffMode === "manual" ? "按下方参数参与优化" : "按默认触发参数参与优化" }}</span>
          </dd>
        </div>

        <div
          v-if="optimizerDraft.fourPieceBuffMode === 'manual'"
          class="optimizer-runtime-list optimizer-config-field-wide ui-field--full"
        >
          <article
            v-for="buff in props.fourPieceRuntimeBuffs ?? []"
            :key="buff.id"
            class="optimizer-runtime-card"
          >
            <div class="optimizer-runtime-head">
              <strong>{{ buffDisplayName(buff) }}</strong>
              <NTag round>{{ fourPieceRuntimePartLabel(buff) }}</NTag>
            </div>
            <div class="optimizer-runtime-grid">
              <div v-for="rule in coverageRules(buff)" :key="`coverage-${effectRuleId(rule)}`" class="metric optimizer-runtime-metric optimizer-coverage-metric ui-field" data-layout-field>
                <dt>{{ storedEffectRuleText(rule, optimizerRuntimeFor(buff), buff) }}</dt>
                <dd>
                  <NInputNumber
                    :value="runtimeCoverageForEffectRule(rule, buff, optimizerRuntimeFor(buff))"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    @update:value="setOptimizerRuleCoverage(buff, rule, $event)"
                  />
                </dd>
              </div>
              <div v-for="group in runtimeSourceGroups(buff)" :key="group.key" class="metric optimizer-runtime-metric ui-field" data-layout-field>
                <dt>{{ group.label || "来源数值" }}</dt>
                <dd>
                  <NInputNumber
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
          <div v-if="!(props.fourPieceRuntimeBuffs ?? []).length" class="optimizer-config-empty">当前四件套没有可手动配置的 Buff</div>
        </div>

        <div class="optimizer-main-stat-config optimizer-config-field-wide ui-field-grid ui-field--full" data-layout-surface="optimizer-main-stats">
          <div v-for="slot in optimizerMainStatSlots" :key="slot" class="metric optimizer-main-stat-field ui-field" data-layout-field>
            <dt class="optimizer-field-title-row">
              <span>{{ slot }}号位主词条</span>
              <NButton size="tiny" text :disabled="!(optimizerDraft.mainStatLimits?.[slot] ?? []).length" @click="clearOptimizerMainStat(slot)">清空</NButton>
            </dt>
            <dd class="main-stat-choice-list">
              <label
                v-for="option in props.mainStatOptionsBySlot?.[slot] ?? []"
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

        <div class="optimizer-minimum-grid optimizer-config-field-wide ui-field-grid ui-field--full" data-layout-surface="optimizer-minimums">
          <p class="optimizer-minimum-note">
            <strong>面板最低值</strong>
            <span>以下四项均按局外面板数值判断，不计入局内 Buff。</span>
          </p>
          <div v-for="item in optimizerMinimumFields" :key="item.key" class="metric optimizer-config-field ui-field" data-layout-field>
            <dt>{{ item.label }}</dt>
            <dd>
              <NInputNumber
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

    <template #footer>
      <div class="modal-actions">
        <NButton @click="close">取消</NButton>
        <NButton type="primary" @click="save">保存配置</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.optimizer-config-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
}

.optimizer-config-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--app-border);
}

.optimizer-config-header p {
  margin: 4px 0 0;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.4;
}

.optimizer-config-body,
.optimizer-minimum-grid,
.optimizer-main-stat-config {
  gap: 10px;
}

.optimizer-config-body {
  --ui-field-min: 280px;
}

.optimizer-config-field {
  min-width: 0;
}

.optimizer-config-field :deep(.n-select),
.optimizer-config-field :deep(.n-input-number) {
  width: 100%;
}

.optimizer-config-field-wide {
  grid-column: 1 / -1;
}

.optimizer-inline-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.optimizer-runtime-list {
  display: grid;
  gap: 8px;
}

.optimizer-runtime-card {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.optimizer-runtime-head,
.optimizer-field-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.optimizer-runtime-head strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.optimizer-runtime-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.optimizer-runtime-metric {
  min-width: 132px;
  padding: 8px 9px;
}

.optimizer-runtime-metric :deep(.n-input-number) {
  width: 112px;
}

.optimizer-coverage-metric {
  flex: 1 1 280px;
}

.optimizer-coverage-metric dd {
  display: flex;
  align-items: center;
  gap: 6px;
}

.optimizer-runtime-layer {
  flex: 1 1 240px;
  min-width: min(100%, 240px);
}

.optimizer-config-empty {
  padding: 12px;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-sm);
  color: var(--app-muted);
  background: var(--app-panel-muted);
  font-size: 12px;
  text-align: center;
}

.optimizer-main-stat-config {
  --ui-field-min: 180px;
}

.main-stat-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 7px;
}

.main-stat-choice {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.main-stat-choice.active {
  border-color: var(--app-blue);
  background: #eef5ff;
  color: var(--app-blue);
}

.main-stat-choice input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--app-blue);
}

.main-stat-choice span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.optimizer-minimum-grid {
  --ui-field-min: 144px;
}

.optimizer-minimum-note {
  display: flex;
  grid-column: 1 / -1;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.5;
}

.optimizer-minimum-note strong {
  flex: 0 0 auto;
  color: var(--app-text);
}

.optimizer-minimum-note span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

</style>
