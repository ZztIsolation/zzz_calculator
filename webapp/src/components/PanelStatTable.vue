<script setup lang="ts">
import { computed } from "vue"
import { statLabel, formatNumber, formatPercent } from "@/utils/format"

const props = withDefaults(defineProps<{
  panel: Record<string, number> | null | undefined
  /** 传入时变为对照表：panel 为局外，此处为局内，并标出局内的增量 */
  inCombatPanel?: Record<string, number> | null
  meta?: any
  includeSheerForce?: boolean
  importantStats?: string[] | null
}>(), {
  inCombatPanel: undefined,
  includeSheerForce: false,
  importantStats: () => [],
})

const compareMode = computed(() => props.inCombatPanel !== undefined)

const percentStats = new Set([
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

const baseKeys = [
  "hp",
  "atk",
  "def",
  "critRate",
  "critDmg",
  "impact",
  "anomalyProficiency",
  "anomalyMastery",
  "penFlat",
  "penRatio",
  "dmgBonus",
]

const keys = computed(() => {
  const hasLaceration = Number(props.panel?.lacerationDmg ?? 0) > 0 || Number(props.inCombatPanel?.lacerationDmg ?? 0) > 0
  const domainKeys = hasLaceration
    ? [...baseKeys.slice(0, 5), "lacerationDmg", ...baseKeys.slice(5)]
    : baseKeys
  return props.includeSheerForce
    ? ["hp", "atk", "sheerForce", ...domainKeys.slice(2)]
    : domainKeys
})

const importantStatKeys = computed(() => new Set(
  (Array.isArray(props.importantStats) ? props.importantStats : []).filter(Boolean).map(String),
))

function formatPanelValue(key: string, value: number): string {
  if (key === "anomalyMastery") {
    return formatNumber(Math.trunc(value), 0)
  }
  if (key === "lacerationDmg") {
    return formatPercent(value)
  }
  return percentStats.has(key) ? formatPercent(value) : formatNumber(value, key === "atk" ? 0 : 1)
}

// 按展示精度比较，避免浮点尾差被当成增益
function panelDelta(key: string) {
  const outValue = Number(props.panel?.[key] ?? 0)
  const inValue = Number(props.inCombatPanel?.[key] ?? 0)
  if (formatPanelValue(key, outValue) === formatPanelValue(key, inValue)) return { direction: 0, text: "" }
  const diff = inValue - outValue
  const text = `${diff > 0 ? "+" : "−"}${formatPanelValue(key, Math.abs(diff))}`
  return { direction: Math.sign(diff), text }
}
</script>

<template>
  <table class="data-table" :class="{ 'panel-stat-compare': compareMode }">
    <thead v-if="compareMode">
      <tr>
        <th scope="col" class="panel-stat-head panel-stat-head--label">属性</th>
        <th scope="col" class="panel-stat-head">局外</th>
        <th scope="col" class="panel-stat-head">局内</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="key in keys" :key="key">
        <th :class="{ 'panel-stat-important': importantStatKeys.has(key) }">{{ statLabel(key, meta) }}</th>
        <td class="num">
          {{ formatPanelValue(key, panel?.[key] ?? 0) }}
        </td>
        <td
          v-if="compareMode"
          class="num panel-stat-in"
          :class="{ 'panel-stat-up': panelDelta(key).direction > 0, 'panel-stat-down': panelDelta(key).direction < 0 }"
          :title="panelDelta(key).text ? `局内比局外 ${panelDelta(key).text}` : undefined"
        >
          <span>{{ formatPanelValue(key, inCombatPanel?.[key] ?? 0) }}</span>
          <small v-if="panelDelta(key).text">{{ panelDelta(key).text }}</small>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.panel-stat-important {
  color: var(--app-highlight);
  font-weight: 700;
}

.panel-stat-head {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

.panel-stat-head--label {
  text-align: left;
}

.panel-stat-compare td.num {
  text-align: right;
}

.panel-stat-in span {
  display: block;
  font-weight: 700;
}

.panel-stat-in small {
  display: block;
  font-size: 11px;
  line-height: 1.2;
}

.panel-stat-up {
  background: var(--app-green-soft, #e9f7f1);
}

.panel-stat-up small {
  color: var(--app-green-strong, #087a55);
}

.panel-stat-down small {
  color: var(--app-red, #d14343);
}
</style>
