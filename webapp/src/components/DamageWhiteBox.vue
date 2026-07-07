<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NSelect } from "naive-ui"
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
const eventOptions = computed(() => events.value.map(event => ({
  label: `${eventLabel(event)} | ${damageNumber(event.finalDamage ?? 0)}`,
  value: String(event?.id ?? ""),
})))
const selectedVariantItems = computed(() => eventVariantItems(selectedEvent.value))

watch(() => props.damage, () => {
  const nextId = props.damage?.selectedEventId ?? events.value[0]?.id ?? null
  selectedEventId.value = nextId === null || nextId === undefined ? null : String(nextId)
}, { immediate: true })

function damageNumber(value: unknown, digits = 3): string {
  return formatNumber(value, digits)
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
  const skillLabel = eventSkillLabel(event)
  if (skillLabel) {
    return `${skillLabel} ×${event?.count ?? 1}`
  }
  return damageEventTitle(event?.input ?? event, props.meta, props.skillCatalog)
}

function eventVariantItems(event: any) {
  if (!event?.damageVariants || !["direct", "sheer"].includes(event.kind)) {
    return []
  }
  return [
    ["expected", "期望"],
    ["crit", "暴击"],
    ["nonCrit", "非暴击"],
  ].map(([key, label]) => ({
    key,
    label,
    value: event.damageVariants?.[key]?.finalDamage,
  })).filter(item => Number.isFinite(Number(item.value)))
}

function selectEventId(value: string | number | null) {
  selectedEventId.value = value === null || value === undefined ? null : String(value)
}
</script>

<template>
  <div v-if="damage" class="damage-whitebox">
    <div class="damage-whitebox-current">
      <div>
        <span>当前白盒</span>
        <strong>{{ selectedEvent ? eventLabel(selectedEvent) : "单次伤害" }}</strong>
        <small v-if="selectedVariantItems.length" class="damage-selected-variants">
          <span v-for="item in selectedVariantItems" :key="item.key">{{ item.label }} {{ damageNumber(item.value) }}</span>
        </small>
      </div>
      <div class="damage-whitebox-current-values">
        <span v-if="selectedEvent">本事件 <b class="num">{{ damageNumber(selectedEvent.finalDamage) }}</b></span>
        <span v-if="hasMultipleEvents">总计 <b class="num">{{ damageNumber(totalDamage) }}</b></span>
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

    <div v-if="selectedRows.length" class="damage-whitebox-rows">
      <article v-for="(row, index) in selectedRows" :key="`${row.label}-${index}`" class="damage-whitebox-row">
        <div class="damage-whitebox-row-main">
          <strong>{{ row.label }}</strong>
          <span v-for="(line, lineIndex) in formulaLines(row)" :key="lineIndex">{{ line }}</span>
        </div>
        <strong class="damage-whitebox-row-value num">{{ rowValue(row) }}</strong>
      </article>
    </div>
    <div v-else class="empty-state">暂无白盒结果</div>
  </div>
  <div v-else class="empty-state">暂无白盒结果</div>
</template>

<style scoped>
.damage-whitebox {
  display: grid;
  gap: 14px;
}

.damage-whitebox-current {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: var(--app-radius-sm);
  background: #f7fbff;
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
  gap: 8px;
}

.damage-whitebox-current-values span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.damage-selected-variants {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 8px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 650;
}

.damage-event-select {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.damage-event-select > span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
}

.damage-whitebox-rows {
  display: grid;
  gap: 8px;
}

.damage-whitebox-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.damage-whitebox-row-main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.damage-whitebox-row-main strong {
  color: var(--app-text);
  font-size: 13px;
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

@media (max-width: 640px) {
  .damage-whitebox-row {
    grid-template-columns: 1fr;
  }

  .damage-whitebox-row-value {
    justify-self: start;
  }
}
</style>
