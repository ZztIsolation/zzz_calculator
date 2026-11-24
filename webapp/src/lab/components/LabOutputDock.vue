<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { ChevronDown, ChevronRight, Disc3, Play, Square, X } from "lucide-vue-next"
import type { LabWorkbenchApi } from "@/lab/useLabWorkbench"
import { thumbnailForDriveDiscSet } from "@/utils/assets"
import { driveDiscAdditionalRollText, driveDiscEffectiveRolls } from "@/utils/driveDiscSubstats"
import {
  damageEventTitle,
  formatNumber,
  formatPercent,
  formatStoredStatValue,
  labelOf,
  statLabel,
  storedStatLabel,
} from "@/utils/format"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

// Iconic ZZZ counter-clockwise 2x3 slot order: top 1-6, mid 2-5, bottom 3-4
const DISPLAY_SLOTS = [1, 6, 2, 5, 3, 4]

const PERCENT_STATS = new Set([
  "critRate",
  "critDmg",
  "lacerationDmg",
  "penRatio",
  "dmgBonus",
  "physicalDmg",
  "fireDmg",
  "iceDmg",
  "electricDmg",
  "etherDmg",
  "windDmg",
  "energyRegen",
])

const dockTab = ref<"discs" | "panel" | "whitebox">("discs")
const inspectedSlot = ref<number | null>(null)
const swapSearch = ref("")
const selectedWhiteboxEventId = ref<string>("")
const expandedWhiteboxRows = ref<Set<number>>(new Set())

const importantSubSet = computed(() => new Set(props.lab.importantSubStats.value))

const discBySlot = computed(() => {
  const map = new Map<number, any>()
  for (const disc of props.lab.selectedDriveDiscs.value) {
    const slot = Number(disc?.partition)
    if (slot >= 1 && slot <= 6) map.set(slot, disc)
  }
  return map
})

const setById = computed(() => {
  const map = new Map<string, any>()
  for (const set of props.lab.catalogStore.driveDiscSets ?? []) {
    if (set?.id) map.set(String(set.id), set)
  }
  return map
})

// Active set counts summary (e.g. 4pc + 2pc)
const activeSetSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const disc of props.lab.selectedDriveDiscs.value) {
    const id = String(disc?.setId ?? "")
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      count: count >= 4 ? 4 : 2,
      name: labelOf(setById.value.get(id)) || id,
    }))
})

// Primary objective formatting
const formattedPrimaryValue = computed(() => {
  const val = props.lab.primaryObjectiveValue.value
  if (val === null) return "—"
  if (props.lab.isLuminescenceScore.value) {
    const suffix = String(props.lab.buildStore.result?.damage?.scoreSuffix ?? "× k")
    return `${formatNumber(val, 2)} ${suffix}`
  }
  return formatNumber(val, 0)
})

const objectiveTitle = computed(() =>
  props.lab.isLuminescenceScore.value ? "LUMINESCENCE SCORE" : "EXPECTED DAMAGE",
)

const topSchemes = computed(() => props.lab.optimizerStore.resultSchemes.slice(0, 10))
const bestScore = computed(() => Number(topSchemes.value[0]?.score ?? 0))

const progressPct = computed(() =>
  Math.max(0, Math.min(100, Number(props.lab.optimizerStore.progress?.percent ?? 0))),
)

// Core 6 KPI stats for the compact strip beneath the 6-disc matrix
const coreStatKeys = computed(() => {
  const specialty = String(props.lab.selectedAgent.value?.specialty ?? "")
  if (specialty === "rupture") {
    return ["hp", "sheerForce", "critRate", "critDmg", "dmgBonus", "atk"]
  }
  if (specialty === "anomaly") {
    return ["atk", "anomalyProficiency", "anomalyMastery", "dmgBonus", "penRatio", "critRate"]
  }
  return ["atk", "critRate", "critDmg", "dmgBonus", "penRatio", "anomalyProficiency"]
})

const fullPanelKeys = computed(() => {
  const outPanel = props.lab.buildStore.outOfCombat?.panel
  const inPanel = props.lab.buildStore.result?.inCombat?.panel
  const hasLaceration = Number(outPanel?.lacerationDmg ?? 0) > 0 || Number(inPanel?.lacerationDmg ?? 0) > 0
  const base = ["hp", "atk", "def", "critRate", "critDmg", "impact", "anomalyProficiency", "anomalyMastery", "penFlat", "penRatio", "dmgBonus"]
  const withLac = hasLaceration ? [...base.slice(0, 5), "lacerationDmg", ...base.slice(5)] : base
  return props.lab.selectedAgent.value?.specialty === "rupture"
    ? ["hp", "atk", "sheerForce", ...withLac.slice(2)]
    : withLac
})

function formatPanelVal(key: string, value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return "—"
  if (key === "anomalyMastery") return formatNumber(Math.trunc(num), 0)
  if (PERCENT_STATS.has(key)) return formatPercent(num, 1)
  return formatNumber(num, key === "atk" || key === "hp" || key === "def" || key === "sheerForce" ? 0 : 1)
}

function statDeltaText(key: string): { dir: number, text: string } {
  const outVal = props.lab.buildStore.outOfCombat?.panel?.[key]
  const inVal = props.lab.buildStore.result?.inCombat?.panel?.[key]
  if (outVal === undefined || inVal === undefined) return { dir: 0, text: "" }
  if (formatPanelVal(key, outVal) === formatPanelVal(key, inVal)) return { dir: 0, text: "" }
  const diff = Number(inVal) - Number(outVal)
  return {
    dir: Math.sign(diff),
    text: `${diff > 0 ? "+" : "−"}${formatPanelVal(key, Math.abs(diff))}`,
  }
}

function compactStatShort(stat: string, mode = ""): string {
  const map: Record<string, string> = {
    critRate: "暴击",
    critDmg: "暴伤",
    atkPct: "攻%",
    atkFlat: "小攻",
    hpPct: "生%",
    hpFlat: "小生",
    defPct: "防%",
    defFlat: "小防",
    anomalyProficiency: "精通",
    anomalyMastery: "掌控",
    penRatio: "穿透",
    penFlat: "穿值",
    impactPct: "冲击",
    energyRegen: "充能",
    physicalDmg: "物伤",
    fireDmg: "火伤",
    iceDmg: "冰伤",
    electricDmg: "电伤",
    etherDmg: "以太",
    windDmg: "风伤",
  }
  return map[stat] ?? storedStatLabel(stat, mode, props.lab.catalogStore.meta)
}

function importantSubPills(disc: any) {
  if (!disc || !Array.isArray(disc.subStats)) return []
  return disc.subStats
    .filter((sub: any) => importantSubSet.value.has(String(sub?.stat ?? "")))
    .map((sub: any) => {
      const add = driveDiscAdditionalRollText(sub.stat, sub.value, props.lab.catalogStore.meta, disc.rarity)
      return {
        key: `${sub.stat}-${sub.value}`,
        label: `${compactStatShort(sub.stat, sub.mode)}${add}`,
        upgraded: Boolean(add),
      }
    })
}

function discRolls(disc: any): number {
  return disc ? driveDiscEffectiveRolls(disc, props.lab.importantSubStats.value, props.lab.catalogStore.meta) : 0
}

function setIconForDisc(disc: any): string {
  const set = setById.value.get(String(disc?.setId ?? ""))
  return thumbnailForDriveDiscSet(set)
}

function setNameForDisc(disc: any): string {
  const set = setById.value.get(String(disc?.setId ?? ""))
  return labelOf(set) || String(disc?.setId ?? "")
}

// Disc inspector & manual swap modal
const inspectedDisc = computed(() =>
  inspectedSlot.value ? (discBySlot.value.get(inspectedSlot.value) ?? null) : null,
)

const swapCandidates = computed(() => {
  if (!inspectedSlot.value) return []
  const slot = inspectedSlot.value
  const q = swapSearch.value.trim().toLowerCase()
  const list = props.lab.ownerDriveDiscs.value
    .filter((disc: any) => Number(disc?.partition) === slot)
    .filter((disc: any) => {
      if (!q) return true
      const text = `${setNameForDisc(disc)} ${storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode, props.lab.catalogStore.meta)}`.toLowerCase()
      return text.includes(q)
    })
  return [...list]
    .sort((a, b) => discRolls(b) - discRolls(a))
    .slice(0, 30)
})

function openSlotInspector(slot: number) {
  inspectedSlot.value = slot
  swapSearch.value = ""
}

function equipManualDisc(disc: any) {
  if (!inspectedSlot.value) return
  props.lab.buildStore.setManualDriveDisc(inspectedSlot.value, String(disc.id))
  inspectedSlot.value = null
}

function unequipManualSlot() {
  if (!inspectedSlot.value) return
  props.lab.buildStore.setManualDriveDisc(inspectedSlot.value, "")
  inspectedSlot.value = null
}

// Whitebox tab helpers
const whiteboxEvents = computed<any[]>(() => {
  const list = props.lab.buildStore.result?.damage?.events
  if (!Array.isArray(list)) return []
  return list.filter((ev: any) => ev?.kind !== "skillGroup")
})

watch(whiteboxEvents, list => {
  if (!list.length) {
    selectedWhiteboxEventId.value = ""
    return
  }
  if (!list.some(ev => String(ev.id) === selectedWhiteboxEventId.value)) {
    selectedWhiteboxEventId.value = String(props.lab.buildStore.result?.damage?.selectedEventId ?? list[0].id)
  }
}, { immediate: true })

const currentWhiteboxEvent = computed(() =>
  whiteboxEvents.value.find(ev => String(ev.id) === selectedWhiteboxEventId.value) ?? whiteboxEvents.value[0] ?? null,
)

const whiteboxRows = computed<any[]>(() =>
  currentWhiteboxEvent.value?.whiteBoxRows ?? props.lab.buildStore.result?.damage?.whiteBoxRows ?? [],
)

watch(whiteboxRows, rows => {
  const next = new Set<number>()
  rows.forEach((row, idx) => {
    if (String(row?.label ?? "").includes("最终")) next.add(idx)
  })
  expandedWhiteboxRows.value = next
}, { immediate: true })

function toggleWhiteboxRow(idx: number) {
  const next = new Set(expandedWhiteboxRows.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  expandedWhiteboxRows.value = next
}

function whiteboxFormulaLines(row: any): string[] {
  if (Array.isArray(row?.formulaLines) && row.formulaLines.length) {
    return row.formulaLines.map((line: unknown) => String(line))
  }
  const f = String(row?.formula ?? "").trim()
  return f ? f.split(/\r?\n/u) : []
}

function whiteboxEventName(ev: any): string {
  return String(ev?.input?.skillSource?.label || ev?.skillSource?.label || ev?.label || damageEventTitle(ev?.input ?? ev, props.lab.catalogStore.meta, props.lab.selectedSkillCatalog.value))
}
</script>

<template>
  <aside class="dock-frame" aria-label="实时输出与驱动盘舱">
    <!-- Top Carbon Instrument Console (Hero HUD) -->
    <div class="dock-hud">
      <div class="dock-hud-top">
        <span class="lab-mono dock-hud-kicker">
          <span class="dock-live-dot" :class="{ 'is-busy': lab.optimizerStore.isBusy }"></span>
          {{ objectiveTitle }}
        </span>
        <span class="lab-mono dock-eff-pill">
          有效 {{ lab.effectiveSubstatCounts.value.total }} 条
        </span>
      </div>

      <div class="dock-hud-readout">
        <strong class="lab-mono dock-hero-num" :class="{ 'is-error': Boolean(lab.buildStore.error) }">
          {{ lab.buildStore.error ? "计算异常" : formattedPrimaryValue }}
        </strong>
        <span
          v-if="lab.lastDelta.value && !lab.buildStore.error"
          class="lab-mono dock-delta-pill"
          :class="lab.lastDelta.value.diff >= 0 ? 'is-up' : 'is-down'"
        >
          {{ lab.lastDelta.value.diff >= 0 ? "▲ +" : "▼ " }}{{ lab.lastDelta.value.pct.toFixed(2) }}%
        </span>
      </div>

      <p v-if="lab.buildStore.error" class="dock-hud-error">{{ lab.buildStore.error }}</p>

      <!-- Action Strip: Optimize CTA + Disc Source Switch -->
      <div class="dock-hud-actions">
        <button
          v-if="lab.optimizerStore.isBusy"
          type="button"
          class="dock-opt-btn is-running"
          @click="lab.cancelOptimization()"
        >
          <Square :size="12" />
          <span class="lab-mono">停止 · {{ progressPct.toFixed(0) }}%</span>
        </button>
        <button
          v-else
          type="button"
          class="dock-opt-btn"
          :disabled="!lab.canRunOptimization.value"
          :title="!lab.ownerDriveDiscs.value.length ? '当前账号暂无驱动盘库存' : '运行全局驱动盘优化'"
          @click="lab.runOptimization()"
        >
          <Play :size="13" />
          <span>开始优化</span>
        </button>

        <div class="dock-mode-switch" role="radiogroup" aria-label="驱动盘方案来源">
          <button
            type="button"
            :class="{ 'is-active': lab.buildStore.discMode === 'optimized' }"
            :disabled="!topSchemes.length"
            @click="lab.buildStore.setDiscMode('optimized')"
          >
            优化
          </button>
          <button
            type="button"
            :class="{ 'is-active': lab.buildStore.discMode === 'manual' }"
            @click="lab.buildStore.setDiscMode('manual')"
          >
            自选
          </button>
          <button
            type="button"
            :class="{ 'is-active': lab.buildStore.discMode === 'loadout' }"
            :disabled="!lab.currentAgentLoadouts.value.length"
            @click="lab.buildStore.setDiscMode('loadout')"
          >
            套装
          </button>
        </div>
      </div>

      <!-- Compact Top 1-10 Scheme Selector Strip -->
      <div v-if="lab.buildStore.discMode === 'optimized' && topSchemes.length" class="dock-rank-strip">
        <span class="lab-mono dock-rank-label">TOP</span>
        <div class="dock-rank-pills">
          <button
            v-for="scheme in topSchemes"
            :key="scheme.rank"
            type="button"
            class="lab-mono dock-rank-pill"
            :class="{ 'is-active': Number(lab.buildStore.selectedOptimizedRank) === Number(scheme.rank) }"
            :title="`第 ${scheme.rank} 名 · ${formatNumber(scheme.score)}`"
            @click="lab.buildStore.selectOptimizedRank(Number(scheme.rank))"
          >
            {{ scheme.rank }}
          </button>
        </div>
        <span v-if="bestScore > 0 && lab.selectedOptimizedScheme.value" class="lab-mono dock-rank-ratio">
          {{ ((Number(lab.selectedOptimizedScheme.value.score) / bestScore) * 100).toFixed(1) }}%
        </span>
      </div>

      <!-- Loadout Selector when in loadout mode -->
      <div v-else-if="lab.buildStore.discMode === 'loadout' && lab.currentAgentLoadouts.value.length" class="dock-loadout-row">
        <select
          class="dock-loadout-select"
          :value="lab.buildStore.selectedLoadoutId"
          @change="lab.buildStore.selectLoadout(($event.target as HTMLSelectElement).value)"
        >
          <option value="">选择已有套装预设…</option>
          <option v-for="lo in lab.currentAgentLoadouts.value" :key="lo.id" :value="lo.id">
            {{ lo.name || lo.id }}
          </option>
        </select>
      </div>
    </div>

    <!-- Dock View Switcher -->
    <div class="dock-tabs" role="tablist" aria-label="右侧信息视图">
      <button
        type="button"
        role="tab"
        :class="{ 'is-active': dockTab === 'discs' }"
        @click="dockTab = 'discs'"
      >
        驱动盘阵 <em class="lab-mono">{{ lab.selectedDriveDiscs.value.length }}/6</em>
      </button>
      <button
        type="button"
        role="tab"
        :class="{ 'is-active': dockTab === 'panel' }"
        @click="dockTab = 'panel'"
      >
        完整面板
      </button>
      <button
        type="button"
        role="tab"
        :class="{ 'is-active': dockTab === 'whitebox' }"
        @click="dockTab = 'whitebox'"
      >
        伤害白盒
      </button>
    </div>

    <!-- TAB 1: Compact 6-Disc Matrix (1-6 / 2-5 / 3-4) + 6-KPI In-Combat Strip -->
    <div v-if="dockTab === 'discs'" class="dock-body">
      <div class="dock-set-bar">
        <span class="lab-mono dock-set-kicker">DRIVE DISC MATRIX</span>
        <div class="dock-set-tags">
          <span v-for="s in activeSetSummary" :key="s.id" class="dock-set-tag">
            {{ s.name }} <em class="lab-mono">{{ s.count }}pc</em>
          </span>
          <span v-if="!activeSetSummary.length" class="dock-set-empty">点任意槽位可查看详情或手动选盘</span>
        </div>
      </div>

      <div class="dock-disc-grid">
        <button
          v-for="slot in DISPLAY_SLOTS"
          :key="slot"
          type="button"
          class="dock-disc-tile"
          :class="{ 'is-empty': !discBySlot.get(slot) }"
          @click="openSlotInspector(slot)"
        >
          <template v-if="discBySlot.get(slot)">
            <div class="dock-disc-head">
              <img :src="setIconForDisc(discBySlot.get(slot))" alt="" class="dock-disc-emblem" />
              <div class="dock-disc-title-col">
                <span class="lab-mono dock-slot-code">D·0{{ slot }}</span>
                <span class="dock-disc-set-name">{{ setNameForDisc(discBySlot.get(slot)) }}</span>
              </div>
              <span class="lab-mono dock-disc-lv">
                {{ discBySlot.get(slot).rarity || "S" }}+{{ discBySlot.get(slot).level ?? 15 }}
              </span>
            </div>

            <div class="dock-disc-main">
              <strong>{{ compactStatShort(discBySlot.get(slot).mainStat?.stat, discBySlot.get(slot).mainStat?.mode) }}</strong>
              <span class="lab-mono">
                {{ formatStoredStatValue(discBySlot.get(slot).mainStat?.stat, discBySlot.get(slot).mainStat?.value, discBySlot.get(slot).mainStat?.mode) }}
              </span>
            </div>

            <div class="dock-disc-subs">
              <span
                v-for="pill in importantSubPills(discBySlot.get(slot))"
                :key="pill.key"
                class="lab-mono dock-sub-pill"
                :class="{ 'is-upgraded': pill.upgraded }"
              >
                {{ pill.label }}
              </span>
              <span v-if="!importantSubPills(discBySlot.get(slot)).length" class="dock-sub-none">无命中有效词条</span>
            </div>
          </template>

          <template v-else>
            <div class="dock-empty-slot">
              <span class="lab-mono dock-slot-code">D·0{{ slot }}</span>
              <Disc3 :size="18" class="dock-empty-icon" />
              <span>空槽位 · 点选</span>
            </div>
          </template>
        </button>
      </div>

      <!-- Compact 6-KPI Core In-Combat Strip -->
      <div class="dock-kpi-block">
        <div class="dock-kpi-head">
          <span class="lab-mono">IN-COMBAT CORE STATS</span>
          <button type="button" class="dock-more-link" @click="dockTab = 'panel'">查看全属性 →</button>
        </div>
        <div class="dock-kpi-grid">
          <div v-for="key in coreStatKeys" :key="key" class="dock-kpi-cell">
            <span class="dock-kpi-label">{{ statLabel(key, lab.catalogStore.meta) }}</span>
            <strong class="lab-mono dock-kpi-val">
              {{ formatPanelVal(key, lab.buildStore.result?.inCombat?.panel?.[key]) }}
            </strong>
            <span
              v-if="statDeltaText(key).text"
              class="lab-mono dock-kpi-delta"
              :class="statDeltaText(key).dir > 0 ? 'is-up' : 'is-down'"
            >
              {{ statDeltaText(key).text }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Full Out-of-Combat vs In-Combat Panel Table -->
    <div v-else-if="dockTab === 'panel'" class="dock-body">
      <table class="dock-panel-table">
        <thead>
          <tr>
            <th>属性</th>
            <th class="num">局外</th>
            <th class="num">局内</th>
            <th class="num">增益</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in fullPanelKeys" :key="key">
            <th :class="{ 'is-imp': importantSubSet.has(key) }">{{ statLabel(key, lab.catalogStore.meta) }}</th>
            <td class="lab-mono num muted">{{ formatPanelVal(key, lab.buildStore.outOfCombat?.panel?.[key]) }}</td>
            <td class="lab-mono num bold">{{ formatPanelVal(key, lab.buildStore.result?.inCombat?.panel?.[key]) }}</td>
            <td class="lab-mono num">
              <span
                v-if="statDeltaText(key).text"
                class="dock-delta-cell"
                :class="statDeltaText(key).dir > 0 ? 'is-up' : 'is-down'"
              >
                {{ statDeltaText(key).text }}
              </span>
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- TAB 3: Damage Whitebox Multiplier Breakdown -->
    <div v-else class="dock-body">
      <div v-if="whiteboxEvents.length > 1" class="dock-wb-picker">
        <select v-model="selectedWhiteboxEventId" class="lab-input dock-wb-select" aria-label="选择白盒事件">
          <option v-for="ev in whiteboxEvents" :key="ev.id" :value="String(ev.id)">
            {{ whiteboxEventName(ev) }} · {{ formatNumber(ev.finalDamage ?? 0) }}
          </option>
        </select>
      </div>

      <div v-if="whiteboxRows.length" class="dock-wb-list">
        <div v-for="(row, idx) in whiteboxRows" :key="`${row.label}-${idx}`" class="dock-wb-row">
          <button
            type="button"
            class="dock-wb-head"
            :class="{ 'is-final': String(row.label ?? '').includes('最终') }"
            @click="toggleWhiteboxRow(idx)"
          >
            <ChevronDown v-if="expandedWhiteboxRows.has(idx)" :size="13" />
            <ChevronRight v-else :size="13" />
            <span class="dock-wb-label">{{ row.label }}</span>
            <strong class="lab-mono dock-wb-val">{{ row.displayValue ?? formatNumber(row.value, 4) }}</strong>
          </button>
          <div v-if="expandedWhiteboxRows.has(idx) && whiteboxFormulaLines(row).length" class="dock-wb-formula">
            <div v-for="(line, lineIdx) in whiteboxFormulaLines(row)" :key="lineIdx" class="lab-mono">
              {{ line }}
            </div>
          </div>
        </div>
      </div>
      <div v-else class="dock-wb-empty">暂无伤害白盒推导数据。</div>
    </div>
  </aside>

  <!-- Lightweight Disc Specimen & Quick Swap Modal -->
  <Teleport to="body">
    <div v-if="inspectedSlot !== null" class="lab-modal-backdrop" @click.self="inspectedSlot = null">
      <div class="lab-modal-card" role="dialog" :aria-label="`${inspectedSlot} 号位驱动盘详情`">
        <header class="lab-modal-head">
          <div>
            <span class="lab-mono lab-modal-kicker">DRIVE DISC SPECIMEN // SLOT 0{{ inspectedSlot }}</span>
            <h3>{{ inspectedSlot }} 号位驱动盘详情与换盘</h3>
          </div>
          <button type="button" class="lab-modal-close" aria-label="关闭" @click="inspectedSlot = null">
            <X :size="16" />
          </button>
        </header>

        <div class="lab-modal-body">
          <div v-if="inspectedDisc" class="modal-current-disc">
            <div class="modal-disc-top">
              <img :src="setIconForDisc(inspectedDisc)" alt="" class="modal-disc-emblem" />
              <div class="modal-disc-meta">
                <strong>{{ setNameForDisc(inspectedDisc) }}</strong>
                <span class="lab-mono">
                  {{ inspectedDisc.rarity || "S" }} · +{{ inspectedDisc.level ?? 15 }} · 有效词条 {{ discRolls(inspectedDisc) }}
                </span>
              </div>
              <button
                v-if="lab.buildStore.discMode === 'manual'"
                type="button"
                class="lab-btn lab-btn--sm"
                @click="unequipManualSlot"
              >
                卸下此槽位
              </button>
            </div>
            <div class="modal-main-stat">
              <span>主词条</span>
              <strong>
                {{ storedStatLabel(inspectedDisc.mainStat?.stat, inspectedDisc.mainStat?.mode, lab.catalogStore.meta) }}
                <em class="lab-mono">{{ formatStoredStatValue(inspectedDisc.mainStat?.stat, inspectedDisc.mainStat?.value, inspectedDisc.mainStat?.mode) }}</em>
              </strong>
            </div>
            <div class="modal-sub-grid">
              <div
                v-for="(sub, idx) in (inspectedDisc.subStats ?? [])"
                :key="idx"
                class="modal-sub-item"
                :class="{ 'is-important': importantSubSet.has(String(sub.stat)) }"
              >
                <span>
                  {{ storedStatLabel(sub.stat, sub.mode, lab.catalogStore.meta) }}
                  <em v-if="driveDiscAdditionalRollText(sub.stat, sub.value, lab.catalogStore.meta, inspectedDisc.rarity)" class="lab-mono modal-roll-tag">
                    {{ driveDiscAdditionalRollText(sub.stat, sub.value, lab.catalogStore.meta, inspectedDisc.rarity) }}
                  </em>
                </span>
                <strong class="lab-mono">{{ formatStoredStatValue(sub.stat, sub.value, sub.mode) }}</strong>
              </div>
            </div>
          </div>

          <div class="modal-swap-section">
            <div class="modal-swap-head">
              <span class="lab-mono">QUICK SWAP FROM INVENTORY ({{ swapCandidates.length }})</span>
              <input v-model="swapSearch" type="text" class="lab-input modal-swap-search" placeholder="筛选套装或主词条…" />
            </div>
            <div v-if="swapCandidates.length" class="modal-swap-list">
              <button
                v-for="cand in swapCandidates"
                :key="cand.id"
                type="button"
                class="modal-swap-row"
                :class="{ 'is-equipped': inspectedDisc && String(inspectedDisc.id) === String(cand.id) }"
                @click="equipManualDisc(cand)"
              >
                <img :src="setIconForDisc(cand)" alt="" />
                <div class="modal-swap-info">
                  <strong>
                    {{ setNameForDisc(cand) }} · {{ compactStatShort(cand.mainStat?.stat, cand.mainStat?.mode) }}
                    {{ formatStoredStatValue(cand.mainStat?.stat, cand.mainStat?.value, cand.mainStat?.mode) }}
                  </strong>
                  <span>
                    {{ (cand.subStats ?? []).map((s: any) => `${compactStatShort(s.stat, s.mode)} ${formatStoredStatValue(s.stat, s.value, s.mode)}`).join(" · ") }}
                  </span>
                </div>
                <span class="lab-mono modal-swap-rolls">有效 {{ discRolls(cand) }}</span>
              </button>
            </div>
            <div v-else class="modal-swap-empty">
              当前账号在 {{ inspectedSlot }} 号位暂无可用驱动盘。
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dock-frame {
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
  border-radius: var(--lab-radius);
  box-shadow: var(--lab-shadow-dock);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ==========================================================================
   Carbon Instrument Console (Top HUD)
   ========================================================================== */

.dock-hud {
  background: var(--lab-hud-bg);
  color: var(--lab-hud-ink);
  padding: 12px 13px 11px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dock-hud-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.dock-hud-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--lab-hud-muted);
}

.dock-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--lab-hud-lime);
  box-shadow: 0 0 8px rgba(204, 245, 0, 0.55);
}

.dock-live-dot.is-busy {
  background: var(--lab-accent);
  box-shadow: 0 0 8px rgba(255, 77, 0, 0.7);
}

.dock-eff-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--lab-hud-surface);
  border: 1px solid var(--lab-hud-line);
  color: var(--lab-hud-ink);
}

.dock-hud-readout {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.dock-hero-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.dock-hero-num.is-error {
  font-size: 18px;
  color: var(--lab-hud-red);
}

.dock-delta-pill {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.dock-delta-pill.is-up {
  background: var(--lab-hud-lime-soft);
  color: var(--lab-hud-lime);
}

.dock-delta-pill.is-down {
  background: var(--lab-hud-red-soft);
  color: var(--lab-hud-red);
}

.dock-hud-error {
  margin: 0;
  font-size: 11px;
  color: var(--lab-hud-red);
}

.dock-hud-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dock-opt-btn {
  flex: 1;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: var(--lab-accent);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  transition: background-color 0.14s ease;
}

.dock-opt-btn:hover:not(:disabled) {
  background: var(--lab-accent-hover);
}

.dock-opt-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.dock-opt-btn.is-running {
  background: var(--lab-hud-surface);
  border: 1px solid var(--lab-accent);
  color: var(--lab-hud-ink);
}

.dock-mode-switch {
  display: inline-flex;
  padding: 2px;
  border-radius: 6px;
  background: var(--lab-hud-surface);
  border: 1px solid var(--lab-hud-line);
  gap: 2px;
  flex: 0 0 auto;
}

.dock-mode-switch button {
  height: 26px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--lab-hud-muted);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.dock-mode-switch button.is-active {
  background: #ffffff;
  color: var(--lab-hud-bg);
}

.dock-mode-switch button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dock-rank-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
}

.dock-rank-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--lab-hud-muted);
}

.dock-rank-pills {
  display: flex;
  gap: 3px;
  flex: 1;
}

.dock-rank-pill {
  flex: 1;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--lab-hud-line);
  background: var(--lab-hud-surface);
  color: var(--lab-hud-muted);
  font-size: 11px;
  font-weight: 700;
}

.dock-rank-pill.is-active {
  background: var(--lab-hud-lime);
  border-color: var(--lab-hud-lime);
  color: var(--lab-hud-bg);
}

.dock-rank-ratio {
  font-size: 11px;
  font-weight: 700;
  color: var(--lab-hud-lime);
}

.dock-loadout-select {
  width: 100%;
  height: 28px;
  border-radius: 5px;
  border: 1px solid var(--lab-hud-line);
  background: var(--lab-hud-surface);
  color: var(--lab-hud-ink);
  font-size: 12px;
  padding: 0 8px;
}

/* ==========================================================================
   Dock Tabs
   ========================================================================== */

.dock-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
}

.dock-tabs button {
  height: 36px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--lab-muted);
  font-size: 12.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: all 0.14s ease;
}

.dock-tabs button:hover {
  color: var(--lab-ink);
}

.dock-tabs button.is-active {
  background: var(--lab-paper);
  color: var(--lab-ink);
  border-bottom-color: var(--lab-accent);
}

.dock-tabs em {
  font-style: normal;
  font-size: 11px;
  color: var(--lab-accent);
}

.dock-body {
  padding: 10px 11px 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

/* ==========================================================================
   Compact 6-Disc Matrix (1-6 / 2-5 / 3-4)
   ========================================================================== */

.dock-set-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.dock-set-kicker {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--lab-muted);
}

.dock-set-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dock-set-tag {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--lab-well);
  color: var(--lab-ink);
}

.dock-set-tag em {
  font-style: normal;
  color: var(--lab-accent);
}

.dock-set-empty {
  font-size: 10.5px;
  color: var(--lab-faint);
}

.dock-disc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.dock-disc-tile {
  padding: 7px 8px;
  min-height: 82px;
  border-radius: 6px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  text-align: left;
  transition: border-color 0.12s ease, background-color 0.12s ease, transform 0.1s ease;
  min-width: 0;
}

.dock-disc-tile:hover {
  border-color: var(--lab-ink);
  background: var(--lab-paper);
  transform: translateY(-1px);
}

.dock-disc-tile.is-empty {
  border-style: dashed;
  background: transparent;
}

.dock-disc-head {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.dock-disc-emblem {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper);
  flex: 0 0 auto;
}

.dock-disc-title-col {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.12;
}

.dock-slot-code {
  font-size: 9px;
  font-weight: 800;
  color: var(--lab-accent);
  letter-spacing: 0.04em;
}

.dock-disc-set-name {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--lab-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dock-disc-lv {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
  color: var(--lab-muted);
  flex: 0 0 auto;
}

.dock-disc-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 0;
  border-top: 1px solid rgba(218, 215, 205, 0.7);
}

.dock-disc-main strong {
  font-size: 12px;
  font-weight: 800;
  color: var(--lab-ink);
  white-space: nowrap;
}

.dock-disc-main span {
  font-size: 12px;
  font-weight: 800;
  color: var(--lab-ink);
}

.dock-disc-subs {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.dock-sub-pill {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--lab-paper);
  border: 1px solid var(--lab-line);
  color: var(--lab-ink-2);
}

.dock-sub-pill.is-upgraded {
  background: var(--lab-accent-soft);
  border-color: var(--lab-accent-line);
  color: var(--lab-accent);
}

.dock-sub-none {
  font-size: 9.5px;
  color: var(--lab-faint);
}

.dock-empty-slot {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--lab-faint);
  font-size: 10.5px;
}

.dock-empty-icon {
  opacity: 0.45;
}

/* ==========================================================================
   Core 6-KPI Strip
   ========================================================================== */

.dock-kpi-block {
  border-top: 1px solid var(--lab-line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dock-kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--lab-muted);
}

.dock-more-link {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--lab-accent);
}

.dock-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.dock-kpi-cell {
  background: var(--lab-paper-soft);
  border: 1px solid var(--lab-line);
  border-radius: 6px;
  padding: 5px 7px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.dock-kpi-label {
  font-size: 10px;
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dock-kpi-val {
  font-size: 13px;
  font-weight: 800;
  color: var(--lab-ink);
}

.dock-kpi-delta {
  font-size: 9.5px;
  font-weight: 700;
}

.dock-kpi-delta.is-up {
  color: var(--lab-green);
}

.dock-kpi-delta.is-down {
  color: var(--lab-red);
}

/* ==========================================================================
   Full Panel Table & Whitebox Breakdown
   ========================================================================== */

.dock-panel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}

.dock-panel-table th,
.dock-panel-table td {
  padding: 5px 4px;
  border-bottom: 1px solid var(--lab-line);
  text-align: left;
}

.dock-panel-table thead th {
  font-size: 11px;
  color: var(--lab-muted);
  font-weight: 700;
}

.dock-panel-table .num {
  text-align: right;
}

.dock-panel-table .muted {
  color: var(--lab-muted);
}

.dock-panel-table .bold {
  font-weight: 800;
  color: var(--lab-ink);
}

.dock-panel-table tbody th.is-imp {
  color: var(--lab-accent);
  font-weight: 800;
}

.dock-delta-cell {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}

.dock-delta-cell.is-up {
  background: var(--lab-green-soft);
  color: var(--lab-green);
}

.dock-delta-cell.is-down {
  background: var(--lab-red-soft);
  color: var(--lab-red);
}

.dock-wb-select {
  width: 100%;
  height: 30px;
  font-size: 12px;
}

.dock-wb-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dock-wb-row {
  border: 1px solid var(--lab-line);
  border-radius: 5px;
  overflow: hidden;
  background: var(--lab-paper-soft);
}

.dock-wb-head {
  width: 100%;
  padding: 7px 9px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--lab-ink);
  text-align: left;
}

.dock-wb-head.is-final {
  background: var(--lab-accent-soft);
}

.dock-wb-label {
  flex: 1;
}

.dock-wb-val {
  color: var(--lab-ink);
}

.dock-wb-formula {
  padding: 6px 10px 8px 26px;
  border-top: 1px solid var(--lab-line);
  background: var(--lab-paper);
  font-size: 11px;
  color: var(--lab-ink-2);
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-wrap: anywhere;
}

.dock-wb-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--lab-muted);
}

/* ==========================================================================
   Disc Specimen & Swap Modal
   ========================================================================== */

.lab-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(18, 19, 22, 0.45);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 16px;
}

.lab-modal-card {
  width: min(640px, 100%);
  max-height: min(82vh, 720px);
  background: var(--lab-paper);
  border: 1px solid var(--lab-line-ink);
  border-radius: var(--lab-radius);
  box-shadow: var(--lab-shadow-modal);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lab-modal-head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lab-modal-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--lab-accent);
}

.lab-modal-head h3 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 800;
}

.lab-modal-close {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  display: grid;
  place-items: center;
}

.lab-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-current-disc {
  padding: 12px 14px;
  border-radius: var(--lab-radius-sm);
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper-soft);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal-disc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-disc-emblem {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper);
}

.modal-disc-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.modal-disc-meta strong {
  font-size: 14px;
  font-weight: 800;
}

.modal-disc-meta span {
  font-size: 11.5px;
  color: var(--lab-muted);
}

.modal-main-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--lab-ink);
  color: var(--lab-paper);
  font-size: 13px;
}

.modal-main-stat em {
  font-style: normal;
  color: var(--lab-hud-lime);
  margin-left: 6px;
}

.modal-sub-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.modal-sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 9px;
  border-radius: 5px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  font-size: 12px;
}

.modal-sub-item.is-important {
  border-color: var(--lab-accent-line);
  background: var(--lab-accent-soft);
}

.modal-roll-tag {
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  color: var(--lab-accent);
  margin-left: 3px;
}

.modal-swap-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-swap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: 800;
  color: var(--lab-muted);
}

.modal-swap-search {
  width: 180px;
  height: 28px;
  font-size: 12px;
}

.modal-swap-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.modal-swap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  text-align: left;
}

.modal-swap-row:hover {
  border-color: var(--lab-ink);
}

.modal-swap-row.is-equipped {
  border-color: var(--lab-accent);
  background: var(--lab-accent-soft);
}

.modal-swap-row img {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.modal-swap-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.modal-swap-info strong {
  font-size: 12.5px;
  font-weight: 700;
}

.modal-swap-info span {
  font-size: 11px;
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-swap-rolls {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--lab-well);
  color: var(--lab-ink);
  flex: 0 0 auto;
}

.modal-swap-empty {
  padding: 20px;
  text-align: center;
  font-size: 12.5px;
  color: var(--lab-muted);
  border: 1px dashed var(--lab-line-strong);
  border-radius: 6px;
}
</style>
