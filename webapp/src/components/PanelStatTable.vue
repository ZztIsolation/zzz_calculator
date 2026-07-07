<script setup lang="ts">
import { statLabel, formatNumber, formatPercent } from "@/utils/format"

defineProps<{
  panel: Record<string, number> | null | undefined
  meta?: any
}>()

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

const keys = [
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
</script>

<template>
  <table class="data-table">
    <tbody>
      <tr v-for="key in keys" :key="key">
        <th>{{ statLabel(key, meta) }}</th>
        <td class="num">
          {{ percentStats.has(key) ? formatPercent(panel?.[key] ?? 0) : formatNumber(panel?.[key] ?? 0, key === "atk" ? 0 : 1) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
