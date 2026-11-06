<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NSelect } from "naive-ui"
import { ChevronDown } from "lucide-vue-next"
import { DAMAGE_MODIFIER_KIND_LABELS, STORED_STAT_LABELS } from "@core/shared-combat.js"
import { damageEventTitle, formatNumber } from "@/utils/format"
function sourceLabel(source: any): string {
  return String(source?.name ?? "").trim() || "未命名来源"
}



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

// ── 技能胶囊 ──────────────────────────────────────────────
// 一个招式一条胶囊；同一招式若存在不同运行时状态（如失衡/未失衡、
// Buff 不同），保留为可切换的预览变体，避免把它们混成一个数值。
const comboSkillGroups = computed(() => {
  const groups = new Map<string, any>()
  for (const event of events.value) {
    const skillKey = eventSkillKey(event)
    if (!groups.has(skillKey)) {
      groups.set(skillKey, {
        key: skillKey,
        shortLabel: skillShortLabel(event),
        variantsBySignature: new Map<string, any>(),
        totalCount: 0,
        totalDamage: 0,
      })
    }
    const group = groups.get(skillKey)
    const signature = eventPreviewSignature(event)
    if (!group.variantsBySignature.has(signature)) {
      group.variantsBySignature.set(signature, {
        key: signature,
        label: eventStateLabel(event, group.variantsBySignature.size + 1),
        events: [] as any[],
        count: 0,
        totalDamage: 0,
      })
    }
    const variant = group.variantsBySignature.get(signature)
    group.events = group.events ?? []
    group.events.push(event)
    group.totalCount += Number(event?.count ?? 1)
    group.totalDamage += Number(event?.finalDamage ?? 0)
    variant.events.push(event)
    variant.count += Number(event?.count ?? 1)
    variant.totalDamage += Number(event?.finalDamage ?? 0)
  }
  return [...groups.values()].map(group => ({
    ...group,
    variants: [...group.variantsBySignature.values()],
  }))
})

function eventSkillKey(event: any): string {
  const source = event?.input?.skillSource ?? event?.skillSource ?? null
  const agentSkillId = String(source?.agentSkillId ?? "")
  const moveId = String(source?.moveId ?? "")
  if (agentSkillId || moveId) return `${agentSkillId}/${moveId}`
  return String(event?.label ?? event?.id ?? "")
}

function localizedSkillName(value: any): string {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object") {
    return String(value.zhCN ?? value.en ?? Object.values(value)[0] ?? "").trim()
  }
  return ""
}

// 胶囊只放招式名：优先取 skillSource.moveName，避免截到「伤害倍率」。
function skillShortLabel(event: any): string {
  const source = event?.input?.skillSource ?? event?.skillSource ?? null
  const moveName = localizedSkillName(source?.moveName ?? source?.name)
  if (moveName) return moveName
  const parts = eventLabel(event).split(" / ")
  const label = parts.length >= 3 ? parts[parts.length - 2].trim() : (parts[parts.length - 1]?.trim() || "未知技能")
  return label.replace(/\s*×\d+\s*$/u, "")
}

// 状态签名只看影响乘区的部分，避免把「事件次数 / 最终伤害」当成不同状态。
function eventPreviewSignature(event: any): string {
  const rows = Array.isArray(event?.whiteBoxRows) ? event.whiteBoxRows : []
  const normalizedRows = rows
    .filter((row: any) => !["事件次数", "最终伤害"].includes(String(row?.label ?? "")))
    .map((row: any) => ({
      label: row?.label,
      value: row?.value,
      sources: (Array.isArray(row?.sources) ? row.sources : []).map((source: any) => [
        source?.key, source?.stat, source?.value,
      ]),
    }))
  return JSON.stringify({
    stunned: event?.stunned ?? null,
    critMode: event?.critMode ?? event?.input?.critMode ?? null,
    rows: normalizedRows,
  })
}

function eventStateLabel(event: any, index: number): string {
  const state: string[] = []
  if (typeof event?.stunned === "boolean") state.push(event.stunned ? "失衡" : "未失衡")
  const critMode = String(event?.critMode ?? event?.input?.critMode ?? "")
  if (critMode === "crit") state.push("暴击")
  else if (critMode === "nonCrit") state.push("非暴击")
  else if (critMode === "expected") state.push("期望")
  return state.join(" · ") || `状态 ${index}`
}

function skillCountText(group: any): string {
  const count = Number(group?.totalCount ?? 0)
  return count > 1 ? `×${count}` : ""
}

function skillDamageText(group: any): string {
  return formatNumber(Number(group?.totalDamage ?? 0), 0)
}

function skillShare(group: any): number {
  const total = Number(totalDamage.value ?? 0)
  if (!total) return 0
  return Number(group?.totalDamage ?? 0) / total
}

function skillShareText(group: any): string {
  return `${formatNumber(skillShare(group) * 100, 0)}%`
}

// Click, focus or keyboard selection updates the single preview below the list.
const hoveredSkillKey = ref<string | null>(null)
const previewVariantIndex = ref(0)
const expandedPreviewRows = ref<Set<number>>(new Set())

const previewSkill = computed(() => {
  const key = hoveredSkillKey.value
  return comboSkillGroups.value.find(group => group.key === key)
    ?? comboSkillGroups.value[0]
    ?? null
})
const previewVariants = computed<any[]>(() => previewSkill.value?.variants ?? [])
const previewVariant = computed(() => previewVariants.value[previewVariantIndex.value] ?? previewVariants.value[0] ?? null)
const previewEvent = computed(() => previewVariant.value?.events?.[0] ?? null)
const previewRows = computed<any[]>(() => (Array.isArray(previewEvent.value?.whiteBoxRows) ? previewEvent.value.whiteBoxRows : []))

watch(hoveredSkillKey, () => {
  previewVariantIndex.value = 0
  expandedPreviewRows.value = new Set()
})

watch(() => previewEvent.value?.id, () => { expandedPreviewRows.value = new Set() })

function setHoveredSkill(key: string): void {
  hoveredSkillKey.value = key
}

function selectPreviewVariant(index: number): void {
  previewVariantIndex.value = index
}

function previewRowSlotStyle(index: number): Record<string, string> {
  // Expanded rows get the whole next grid row; their siblings do not grow a
  // blank column beside them. The container switches to two/one column on
  // narrow screens and overrides the column placement.
  const row = Math.floor(index / 3)
  return { gridColumn: `${(index % 3) + 1} / span 1`, gridRow: String(row * 2 + 1) }
}


function previewRowDetailStyle(index: number): Record<string, string> {
  return { gridColumn: "1 / -1", gridRow: String(Math.floor(index / 3) * 2 + 2) }
}

function togglePreviewRow(index: number): void {
  // One continuous detail region per skill: switching multipliers must not
  // reserve another empty row between the compact cards.
  expandedPreviewRows.value = expandedPreviewRows.value.has(index) ? new Set() : new Set([index])
}

function previewRowExpanded(index: number): boolean {
  return expandedPreviewRows.value.has(index)
}

function previewRowExpandable(row: any): boolean {
  return formulaLines(row).length > 0 || hasSources(row)
}

function skillVariantCountText(variant: any): string {
  return Number(variant?.count ?? 0) > 1 ? `×${variant.count}` : ""
}

function previewVariantDamageText(variant: any): string {
  return formatNumber(Number(variant?.totalDamage ?? 0), 0)
}

const STAT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries({ ...STORED_STAT_LABELS, ...DAMAGE_MODIFIER_KIND_LABELS })
    .map(([key, label]) => [key, String(label).replace(/%$/u, "")]),
)
STAT_LABELS.followUpDmgBonus = "追加攻击增伤"

function statLabel(source: any): string {
  const key = String(source?.displayStat ?? source?.stat ?? "").trim()
  return STAT_LABELS[key] ?? key
}

const FLAT_SOURCE_STATS = new Set([
  "atkFlat", "hpFlat", "defFlat", "penFlat", "sheerForceFlat",
  "anomalyProficiencyFlat", "anomalyMasteryFlat", "anomalyDurationBonusSeconds",
])

function sourceIsFlat(source: any): boolean {
  return source?.valueKind === "flat" || FLAT_SOURCE_STATS.has(String(source?.stat ?? ""))
}


function isLuminescenceScoreKind(value: unknown): boolean {
  return ["luminescenceTeamScore", "luminescenceScore"].includes(String(value ?? ""))
}
const isLuminescenceScore = computed(() => isLuminescenceScoreKind(selectedEvent.value?.objectiveKind ?? props.damage?.objectiveKind))
const selectedVariantItems = computed(() => eventVariantItems(selectedEvent.value))
const selectedModeLabel = computed(() => ({ expected: "期望", crit: "暴击", nonCrit: "非暴击" } as Record<string, string>)[selectedVariantKey(selectedEvent.value)] ?? "期望")
const eventOptions = computed(() => events.value.map(event => ({
  label: `${eventLabel(event)} | ${eventValue(event.finalDamage ?? 0, event)}`,
  value: String(event?.id ?? ""),
})))

function selectEventId(value: string | number | null) {
  selectedEventId.value = value === null || value === undefined ? null : String(value)
}


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


function hasSources(row: any): boolean {
  return Array.isArray(row?.sources) && row.sources.length > 0
}
const inactiveSources = computed<any[]>(() => {
  const rows = selectedRows.value
  const fromRows = rows.flatMap((row: any) => (Array.isArray(row?.inactive) ? row.inactive : []))
  return Array.isArray(fromRows) ? fromRows.filter(Boolean) : []
})

function sourceValueText(source: any): string {
  const value = Number(source?.value ?? 0)
  const sign = value > 0 ? "+" : ""
  const suffix = source?.stat === "anomalyDurationBonusSeconds" ? " 秒" : ""
  if (sourceIsFlat(source)) return `${sign}${formatNumber(value, 1)}${suffix}`
  return `${sign}${formatNumber(value * 100, 2)}%`
}

function sourceContributionText(source: any): string {
  const label = statLabel(source)
  return label ? `${label} ${sourceValueText(source)}` : sourceValueText(source)
}

function sourceMeta(source: any): string {
  const type = String(source?.sourceTypeLabel ?? "").trim()
  const condition = String(source?.condition ?? "").trim()
  return condition ? `${type} · ${condition}` : type
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

    <section
      v-if="comboSkillGroups.length"
      class="damage-skill-strip"
      data-testid="whitebox-skill-groups"
    >
      <div class="damage-skill-chips" role="list">
        <button
          v-for="group in comboSkillGroups"
          :key="group.key"
          type="button"
          role="listitem"
          class="damage-skill-chip"
          :class="{ 'is-active': previewSkill?.key === group.key }"
          :aria-pressed="previewSkill?.key === group.key"
          @click="setHoveredSkill(group.key)"
        >
          <span class="damage-skill-chip-name">{{ group.shortLabel }}</span>
          <em v-if="skillCountText(group)" class="damage-skill-chip-count">{{ skillCountText(group) }}</em>
          <span class="damage-skill-chip-damage num">{{ skillDamageText(group) }}</span>
        </button>
      </div>

      <div v-if="previewSkill && previewVariant" class="damage-skill-preview" data-testid="whitebox-skill-preview">
        <header class="damage-preview-head">
          <span class="damage-preview-name">{{ previewSkill.shortLabel }}</span>
          <span class="damage-preview-total num">{{ previewVariantDamageText(previewVariant) }}</span>
        </header>
        <div v-if="previewVariants.length > 1" class="damage-preview-states" role="group" aria-label="技能状态">
          <button
            v-for="(variant, variantIndex) in previewVariants"
            :key="variant.key"
            type="button"
            class="damage-preview-state"
            :class="{ 'is-active': previewVariantIndex === variantIndex }"
            :aria-pressed="previewVariantIndex === variantIndex"
            @click="selectPreviewVariant(variantIndex)"
          >
            {{ variant.label }}
            <em v-if="skillVariantCountText(variant)">{{ skillVariantCountText(variant) }}</em>
          </button>
        </div>
        <div class="damage-preview-multipliers">
          <article
            v-for="(row, rowIndex) in previewRows"
            :key="rowIndex"
            class="damage-preview-row"
            :class="{ 'is-expanded': previewRowExpanded(rowIndex) }"
            :style="previewRowSlotStyle(rowIndex)"
          >
            <button
              v-if="previewRowExpandable(row)"
              type="button"
              class="damage-preview-row-head"
              :aria-expanded="previewRowExpanded(rowIndex)"
              @click="togglePreviewRow(rowIndex)"
            >
              <span class="damage-preview-row-label">
                <ChevronDown class="damage-preview-chevron" :size="14" aria-hidden="true" />
                {{ row.label }}
              </span>
              <b class="damage-preview-row-value num">{{ rowValue(row) }}</b>
            </button>
            <div v-else class="damage-preview-row-head">
              <span class="damage-preview-row-label">{{ row.label }}</span>
              <b class="damage-preview-row-value num">{{ rowValue(row) }}</b>
            </div>
            <div v-if="previewRowExpanded(rowIndex)" class="damage-preview-row-main" :style="previewRowDetailStyle(rowIndex)">
              <div v-for="(line, lineIndex) in formulaLines(row)" :key="lineIndex" class="damage-preview-formula">{{ line }}</div>
              <div v-if="hasSources(row)" class="damage-preview-sources">
                <div v-for="(source, sourceIndex) in row.sources" :key="sourceIndex" class="damage-preview-source">
                  <b class="damage-preview-source-contribution">{{ sourceContributionText(source) }}</b>
                  <span class="damage-preview-source-text">
                    <b>{{ sourceLabel(source) }}</b>
                    <small>{{ sourceMeta(source) }}</small>
                  </span>
                  <b class="damage-preview-source-value num">{{ sourceValueText(source) }}</b>
                  <small v-if="source.formula" class="damage-preview-source-formula">{{ source.formula }}</small>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
    <div v-if="!previewRows.length" class="empty-state">暂无白盒结果</div>
  </div>
  <div v-else class="empty-state">暂无白盒结果</div>
</template>

<style scoped>
.damage-whitebox { display: grid; gap: 12px; min-width: 0; }
.damage-whitebox-current { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.damage-whitebox-current > div:first-child { display: grid; min-width: 0; gap: 3px; }
.damage-whitebox-current span { color: var(--app-muted); font-size: 12px; font-weight: 650; }
.damage-whitebox-current strong { min-width: 0; color: var(--app-text); font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
.damage-whitebox-current-values { display: flex; flex-wrap: wrap; gap: 6px 12px; }
.damage-whitebox-current-values span { display: inline-flex; align-items: center; gap: 5px; min-height: 24px; padding-left: 12px; border-left: 1px solid var(--app-border); }
.damage-whitebox-current-values span:first-child { padding-left: 0; border-left: 0; }
.damage-selected-variants { display: flex; flex-wrap: wrap; gap: 5px 8px; color: var(--app-muted); font-size: 11px; font-weight: 650; }
.damage-selected-variants .damage-selected-variant { color: var(--app-text); font-weight: 750; }
.damage-current-mode { color: var(--app-muted); font-size: 11px; }

/* 技能入口与乘区都保持可扫描的卡片层级；悬浮只反馈，不切换预览。 */
.damage-skill-strip { display: grid; gap: 12px; min-width: 0; }
.damage-skill-chips { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 156px), 1fr)); gap: 8px; min-width: 0; }
.damage-skill-chip { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 8px; min-width: 0; padding: 10px 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius); background: var(--app-panel-muted); color: var(--app-muted); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--app-shadow-sm); transition: border-color 160ms ease, background 160ms ease; }
.damage-skill-chip:hover { border-color: var(--app-border-strong); background: var(--app-panel); }
.damage-skill-chip.is-active { border-color: var(--app-blue); background: var(--app-blue-soft); }
.damage-skill-chip:focus-visible { outline: var(--app-focus-ring); outline-offset: 2px; }
.damage-skill-chip-name { min-width: 0; color: var(--app-text); font-size: 12px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.damage-skill-chip-count { color: var(--app-blue-strong); font-size: 11px; font-style: normal; font-weight: 750; white-space: nowrap; }
.damage-skill-chip-damage { grid-column: 1 / -1; color: var(--app-text); font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

.damage-skill-preview { display: grid; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius); background: var(--app-panel-muted); }
.damage-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-width: 0; }
.damage-preview-name { min-width: 0; color: var(--app-text); font-size: 14px; font-weight: 750; overflow-wrap: anywhere; }
.damage-preview-total { color: var(--app-text); font-size: 16px; font-weight: 750; font-variant-numeric: tabular-nums; white-space: nowrap; }
.damage-preview-states { display: flex; flex-wrap: wrap; gap: 4px; }
.damage-preview-state { padding: 3px 8px; border: 1px solid var(--app-border); border-radius: 999px; background: var(--app-panel); color: var(--app-muted); font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
.damage-preview-state em { margin-left: 3px; font-style: normal; font-weight: 750; }
.damage-preview-state:hover, .damage-preview-state.is-active { border-color: var(--app-blue); background: var(--app-blue-soft); color: var(--app-text); }
.damage-preview-state:focus-visible { outline: var(--app-focus-ring); outline-offset: 1px; }
.damage-preview-multipliers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-items: start; }
.damage-preview-row { display: contents; }
.damage-preview-row:last-child { grid-column: auto; }
.damage-preview-row:has(.damage-preview-row-main) { grid-column: auto; }
.damage-preview-row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel); color: inherit; font: inherit; text-align: left; }
button.damage-preview-row-head { cursor: pointer; }
button.damage-preview-row-head:hover .damage-preview-row-label { color: var(--app-blue-strong); }
button.damage-preview-row-head:focus-visible { outline: var(--app-focus-ring); outline-offset: 3px; }
.damage-preview-row-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: var(--app-muted); font-size: 12px; font-weight: 650; overflow-wrap: anywhere; }
.damage-preview-row-value { color: var(--app-text); font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.damage-preview-chevron { flex: 0 0 auto; color: var(--app-blue); transition: transform 160ms ease; }
.damage-preview-row.is-expanded .damage-preview-chevron { transform: rotate(180deg); }
.damage-preview-row-main { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; padding: 12px 4px 2px; border-top: 1px solid var(--app-border); }
.damage-preview-formula, .damage-preview-source-formula { color: var(--app-muted); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.damage-preview-sources { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 8px; padding-top: 0; }
.damage-preview-source { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-content: start; align-items: baseline; gap: 3px 10px; min-width: 0; padding: 9px 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel-muted); font-size: 12px; line-height: 1.5; }
.damage-preview-source-contribution { grid-column: 1 / -1; color: var(--app-text); font-size: 13px; font-weight: 750; overflow-wrap: anywhere; }
.damage-preview-source-contribution + .damage-preview-source-text { color: var(--app-muted); font-weight: 500; }
.damage-preview-source-contribution + .damage-preview-source-text b { font-weight: 500; }
.damage-preview-source-text { display: grid; min-width: 0; }
.damage-preview-source-text b { color: var(--app-text); font-weight: 650; overflow-wrap: anywhere; }
.damage-preview-source-text small { color: var(--app-muted); overflow-wrap: anywhere; }
.damage-preview-source-value { color: var(--app-blue-strong); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.damage-preview-source-formula { grid-column: 1 / -1; }
@container ui-layout (max-width: 640px) {
  .damage-preview-row { grid-column: auto !important; }
}
@container ui-layout (max-width: 640px) {
  .damage-skill-chips, .damage-preview-multipliers { grid-template-columns: 1fr 1fr; }
  .damage-skill-preview { padding: 10px; }
}
@container ui-layout (max-width: 390px) {
  .damage-skill-chips, .damage-preview-multipliers { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .damage-skill-chip, .damage-preview-chevron { transition: none; }
}
</style>
