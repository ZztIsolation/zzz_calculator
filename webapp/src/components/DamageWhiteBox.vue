<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NSelect } from "naive-ui"
import { ChevronDown } from "lucide-vue-next"
import {
  damageEventTitle,
  formatNumber,
} from "@/utils/format"

const props = defineProps<{
  damage: any
  meta?: any
  skillCatalog?: any
}>()

const selectedEventId = ref<string | null>(null)

const events = computed<any[]>(() => (Array.isArray(props.damage?.events) ? props.damage.events : [])
  .filter((event: any) => event?.kind !== "skillGroup"))
const selectedEvent = computed(() => {
  const selectedId = selectedEventId.value ?? String(props.damage?.selectedEventId ?? "")
  return events.value.find(event => String(event?.id ?? "") === selectedId) ?? events.value[0] ?? null
})
const selectedRows = computed<any[]>(() => selectedEvent.value?.whiteBoxRows ?? props.damage?.whiteBoxRows ?? [])
const totalDamage = computed(() => props.damage?.totalFinalDamage ?? props.damage?.finalDamage)
const hasMultipleEvents = computed(() => events.value.length > 1)
function isLuminescenceScoreKind(value: unknown): boolean {
  return ["luminescenceTeamScore", "luminescenceScore"].includes(String(value ?? ""))
}

const isLuminescenceScore = computed(() => isLuminescenceScoreKind(selectedEvent.value?.objectiveKind ?? props.damage?.objectiveKind))
const eventOptions = computed(() => events.value.map(event => ({
  label: `${eventLabel(event)} | ${eventValue(event.finalDamage ?? 0, event)}`,
  value: String(event?.id ?? ""),
})))
const selectedVariantItems = computed(() => eventVariantItems(selectedEvent.value))
const selectedModeLabel = computed(() => ({ expected: "期望", crit: "暴击", nonCrit: "非暴击" } as Record<string, string>)[selectedVariantKey(selectedEvent.value)] ?? "期望")

watch(() => props.damage, () => {
  const nextId = props.damage?.selectedEventId ?? events.value[0]?.id ?? null
  selectedEventId.value = nextId === null || nextId === undefined ? null : String(nextId)
}, { immediate: true })

function damageNumber(value: unknown, digits = 3): string {
  return formatNumber(value, digits)
}

function summaryNumber(value: unknown, event: any = selectedEvent.value): string {
  const luminescence = isLuminescenceScoreKind(event?.objectiveKind ?? props.damage?.objectiveKind)
  return damageNumber(value, luminescence ? 3 : 0)
}

function eventValue(value: unknown, event: any = selectedEvent.value): string {
  const luminescence = isLuminescenceScoreKind(event?.objectiveKind ?? props.damage?.objectiveKind)
  const formatted = summaryNumber(value, event)
  return luminescence ? `${formatted} ${String(event?.scoreSuffix ?? props.damage?.scoreSuffix ?? "× k")}` : formatted
}

function rowValue(row: any): string {
  if (row?.displayValue !== null && row?.displayValue !== undefined) {
    return String(row.displayValue)
  }
  return damageNumber(row?.value, 4)
}

function formulaLines(row: any): string[] {
  if (Array.isArray(row?.formulaLines) && row.formulaLines.length) {
    return row.formulaLines.map((line: unknown) => String(line))
  }
  const formula = String(row?.formula ?? "").trim()
  return formula ? formula.split(/\r?\n/u) : []
}

function isRawIdentifierText(value: string): boolean {
  return /^[a-z][A-Za-z0-9_.:-]*$/u.test(value.trim())
}

function readableLabel(value: unknown): string {
  const text = String(value ?? "").trim()
  return text && !isRawIdentifierText(text) ? text : ""
}

function eventSkillLabel(event: any): string {
  return readableLabel(event?.input?.skillSource?.label)
    || readableLabel(event?.skillSource?.label)
    || readableLabel(event?.label)
}

function eventLabel(event: any): string {
  if (isLuminescenceScoreKind(event?.objectiveKind ?? props.damage?.objectiveKind)) {
    return "队伍异常评分"
  }
  if (event?.input?.settlementType === "turbulence") {
    return damageEventTitle(event.input, props.meta, props.skillCatalog)
  }
  const skillLabel = eventSkillLabel(event)
  if (skillLabel) {
    return `${skillLabel} ×${event?.count ?? 1}`
  }
  return damageEventTitle(event?.input ?? event, props.meta, props.skillCatalog)
}

function eventVariantItems(event: any) {
  if (!event?.damageVariants || (event.kind === "anomaly" && !event.critInfo?.available)) {
    return []
  }
  if (event.kind === "sharp") {
    return [
      ["expected", "期望"],
      ["nonCrit", "不触发锐暴"],
      ["sharpCrit", "一次锐暴"],
      ["lacerationCrit", "二次锐暴"],
    ].map(([key, label]) => ({
      key,
      label,
      value: event.damageVariants?.[key]?.finalDamage,
    })).filter(item => Number.isFinite(Number(item.value)))
  }
  return [
    ["expected", "期望"],
    ["crit", "暴击"],
    ["nonCrit", event?.kind === "anomaly" && Number(event?.critInfo?.critRate ?? 0) >= 1 ? "非暴击（对照）" : "非暴击"],
  ].map(([key, label]) => ({
    key,
    label,
    value: event.damageVariants?.[key]?.finalDamage,
  })).filter(item => Number.isFinite(Number(item.value)))
}

function selectedVariantKey(event: any): string {
  return String(event?.input?.critMode ?? event?.critInfo?.effectiveMode ?? "expected")
}

function selectEventId(value: string | number | null) {
  selectedEventId.value = value === null || value === undefined ? null : String(value)
}

// 推导默认折叠，只看乘区名与数值；“最终”公式默认展开
const expandedRows = ref<Set<number>>(new Set())
const expandableIndexes = computed(() => selectedRows.value
  .map((row, index) => (formulaLines(row).length ? index : -1))
  .filter(index => index >= 0))
const allExpanded = computed(() => expandableIndexes.value.length > 0
  && expandableIndexes.value.every(index => expandedRows.value.has(index)))

watch(() => String(selectedEvent.value?.id ?? "") + "|" + selectedRows.value.map(row => row?.label).join("|"), () => {
  expandedRows.value = new Set(selectedRows.value
    .map((row, index) => (formulaLines(row).length && String(row?.label ?? "").includes("最终") ? index : -1))
    .filter(index => index >= 0))
}, { immediate: true })

function toggleRow(index: number) {
  const next = new Set(expandedRows.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  expandedRows.value = next
}

function toggleAllRows() {
  expandedRows.value = allExpanded.value ? new Set() : new Set(expandableIndexes.value)
}
</script>

<template>
  <div v-if="damage" class="damage-whitebox ui-layout-scope" data-layout-surface="damage-whitebox">
    <div class="damage-whitebox-current">
      <div>
        <span>当前白盒</span>
        <strong>{{ selectedEvent ? eventLabel(selectedEvent) : "单次伤害" }}</strong>
        <small v-if="selectedEvent?.kind === 'anomaly' && selectedEvent?.critInfo?.available" class="damage-current-mode">当前模式：{{ selectedModeLabel }}</small>
        <small v-if="selectedVariantItems.length" class="damage-selected-variants">
          <span v-for="item in selectedVariantItems" :key="item.key" :class="{ 'damage-selected-variant': item.key === selectedVariantKey(selectedEvent) }">{{ item.label }} {{ summaryNumber(item.value) }}</span>
        </small>
      </div>
      <div class="damage-whitebox-current-values">
        <span v-if="selectedEvent">{{ isLuminescenceScore ? "本评分" : "本事件" }} <b class="num">{{ eventValue(selectedEvent.finalDamage) }}</b></span>
        <span v-if="hasMultipleEvents">总计 <b class="num">{{ summaryNumber(totalDamage) }}</b></span>
      </div>
    </div>

    <label v-if="events.length" class="damage-event-select">
      <span>查看事件</span>
      <NSelect
        :value="String(selectedEvent?.id ?? selectedEventId ?? '')"
        :options="eventOptions"
        filterable
        :consistent-menu-width="false"
        @update:value="selectEventId"
      />
    </label>

    <div v-if="expandableIndexes.length" class="damage-whitebox-toolbar">
      <span>点击乘区查看推导</span>
      <button type="button" class="damage-whitebox-toggle-all" data-testid="whitebox-toggle-all" @click="toggleAllRows">
        {{ allExpanded ? "全部收起" : "全部展开" }}
      </button>
    </div>
    <div v-if="selectedRows.length" class="damage-whitebox-rows">
      <article
        v-for="(row, index) in selectedRows"
        :key="`${row.label}-${index}`"
        class="damage-whitebox-row"
        :class="{ 'is-expanded': expandedRows.has(index), 'is-expandable': formulaLines(row).length > 0 }"
      >
        <component
          :is="formulaLines(row).length ? 'button' : 'div'"
          class="damage-whitebox-row-head"
          :type="formulaLines(row).length ? 'button' : undefined"
          :aria-expanded="formulaLines(row).length ? expandedRows.has(index) : undefined"
          @click="formulaLines(row).length && toggleRow(index)"
        >
          <strong class="damage-whitebox-row-label">
            <ChevronDown v-if="formulaLines(row).length" class="damage-whitebox-chevron" :size="14" aria-hidden="true" />
            {{ row.label }}
          </strong>
          <strong class="damage-whitebox-row-value num">{{ rowValue(row) }}</strong>
        </component>
        <div v-show="expandedRows.has(index)" class="damage-whitebox-row-main">
          <span v-for="(line, lineIndex) in formulaLines(row)" :key="lineIndex">{{ line }}</span>
        </div>
      </article>
    </div>
    <div v-else class="empty-state">暂无白盒结果</div>
  </div>
  <div v-else class="empty-state">暂无白盒结果</div>
</template>

<style scoped>
.damage-whitebox {
  display: grid;
  gap: 0;
}

.damage-whitebox-current {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--app-border);
}

.damage-whitebox-current > div:first-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.damage-whitebox-current span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
}

.damage-whitebox-current strong {
  min-width: 0;
  color: var(--app-text);
  font-size: 14px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.damage-whitebox-current-values {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.damage-whitebox-current-values span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding-left: 12px;
  border-left: 1px solid var(--app-border);
}

.damage-whitebox-current-values span:first-child {
  padding-left: 0;
  border-left: 0;
}

.damage-selected-variants {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 8px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 650;
}

.damage-selected-variants .damage-selected-variant {
  color: var(--app-text);
  font-weight: 750;
}

.damage-current-mode {
  color: var(--app-muted);
  font-size: 11px;
}

.damage-event-select {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid var(--app-border);
}

.damage-event-select > span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
}

.damage-whitebox-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0 2px;
  color: var(--app-muted);
  font-size: 12px;
}

.damage-whitebox-toggle-all {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-blue-strong, #1d5fd6);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.damage-whitebox-toggle-all:hover {
  background: var(--app-blue-soft, #edf4ff);
}

.damage-whitebox-toggle-all:focus-visible,
.damage-whitebox-row-head:focus-visible {
  outline: 3px solid rgba(47, 125, 246, 0.35);
  outline-offset: 2px;
}

.damage-whitebox-rows {
  display: grid;
}

.damage-whitebox-row {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 0;
  border-bottom: 1px solid var(--app-border);
}

.damage-whitebox-row:last-child {
  border-bottom: 0;
}

.damage-whitebox-row-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.damage-whitebox-row-head {
  cursor: pointer;
}

button.damage-whitebox-row-head:hover .damage-whitebox-row-label {
  color: var(--app-blue-strong, #1d5fd6);
}

.damage-whitebox-row-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--app-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* 与全站展开按钮一致：蓝色箭头朝下，展开后翻转朝上 */
.damage-whitebox-chevron {
  flex: 0 0 auto;
  color: var(--app-blue);
  transition: transform 0.2s ease;
}

.damage-whitebox-row.is-expanded .damage-whitebox-chevron {
  transform: rotate(180deg);
}

.damage-whitebox-row-main {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 4px 0 0 18px;
}

.damage-whitebox-row-main span {
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.damage-whitebox-row-value {
  color: var(--app-text);
  font-size: 15px;
}

@media (prefers-reduced-motion: reduce) {
  .damage-whitebox-chevron {
    transition: none;
  }
}

@container ui-layout (max-width: 640px) {
  .damage-whitebox-row-head {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
