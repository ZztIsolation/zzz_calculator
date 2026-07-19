<script setup lang="ts">
import { computed } from "vue"
import { statLabel, formatNumber, formatPercent } from "@/utils/format"

const props = withDefaults(defineProps<{
  panel: Record<string, number> | null | undefined
  meta?: any
  includeSheerForce?: boolean
}>(), {
  includeSheerForce: false,
})

const percentStats = new Set([
  "critRate",
  "critDmg",
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

const keys = computed(() => props.includeSheerForce
  ? ["hp", "atk", "sheerForce", ...baseKeys.slice(2)]
  : baseKeys)

function formatPanelValue(key: string, value: number): string {
  if (key === "anomalyMastery") {
    return formatNumber(Math.trunc(value), 0)
  }
  return percentStats.has(key) ? formatPercent(value) : formatNumber(value, key === "atk" ? 0 : 1)
}
</script>

<template>
  <table class="data-table">
    <tbody>
      <tr v-for="key in keys" :key="key">
        <th>{{ statLabel(key, meta) }}</th>
        <td class="num">
          {{ formatPanelValue(key, panel?.[key] ?? 0) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
