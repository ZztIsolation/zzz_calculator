<script setup lang="ts">
import { computed } from "vue"
import { NButton, NCheckbox, NInputNumber, NSelect, NTag } from "naive-ui"
import { ELEMENTS, defaultTargetConfig } from "@/stores/build"
import { labelOf } from "@/utils/format"

const resistanceElementLabels: Record<string, string> = {
  physical: "物理",
  fire: "火",
  ice: "冰",
  electric: "电",
  ether: "以太",
  wind: "风",
}

const props = defineProps<{
  targetConfig: any
  meta: any
  damageElement?: string
}>()

const emit = defineEmits<{
  "update:targetConfig": [value: any]
}>()

const target = computed(() => {
  const fallback = defaultTargetConfig()
  return {
    ...fallback,
    ...(props.targetConfig ?? {}),
    resistanceByElement: {
      ...fallback.resistanceByElement,
      ...(props.targetConfig?.resistanceByElement ?? {}),
    },
  }
})

const targetPresets = computed(() => (props.meta?.damageTargetPresets ?? []).map((preset: any) => ({
  label: Number.isFinite(Number(preset.defense)) ? `${labelOf(preset)} · 防御 ${preset.defense}` : labelOf(preset),
  value: preset.id,
  defense: Number.isFinite(Number(preset.defense)) ? Number(preset.defense) : null,
})).concat([{ label: "自定义", value: "custom", defense: null }]))

const targetPresetName = computed(() => {
  const preset = targetPresets.value.find((item: any) => item.value === target.value.presetId)
  return preset?.label ?? "自定义敌方"
})

const selectedTargetPreset = computed(() => targetPresets.value.find((item: any) => item.value === target.value.presetId))

const isCustomTargetPreset = computed(() => target.value.presetId === "custom" || !selectedTargetPreset.value || selectedTargetPreset.value.defense === null)

const displayDefense = computed(() => isCustomTargetPreset.value
  ? target.value.defense
  : selectedTargetPreset.value?.defense ?? target.value.defense)

const selectedElement = computed(() => {
  const element = String(props.damageElement ?? "")
  return ELEMENTS.includes(element) ? element : "physical"
})

const resistanceLabel = computed(() => `${resistanceElementLabels[selectedElement.value] ?? selectedElement.value}抗性`)

const currentResistanceValue = computed(() => normalizeResistanceValue(
  target.value.resistanceByElement?.[selectedElement.value] ?? 0,
))

function normalizeResistanceValue(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0
  }
  return Math.round(Math.min(100, Math.max(-100, number)))
}

function updateTarget(patch: any) {
  emit("update:targetConfig", {
    ...target.value,
    ...patch,
    resistanceByElement: {
      ...(target.value.resistanceByElement ?? {}),
      ...(patch.resistanceByElement ?? {}),
    },
  })
}

function applyPreset(id: string) {
  const preset = targetPresets.value.find((item: any) => item.value === id)
  updateTarget({
    presetId: id,
    ...(preset?.defense !== null && preset?.defense !== undefined ? { defense: preset.defense } : {}),
  })
}

function setResistance(value: number | null) {
  updateTarget({
    resistanceByElement: {
      [selectedElement.value]: normalizeResistanceValue(value),
    },
  })
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2 class="panel-title">Boss / 敌方效果</h2>
      <NTag round>{{ targetPresetName }}</NTag>
    </div>
    <div class="panel-body section-band">
      <div class="metric-grid">
        <div class="metric">
          <dt>防御预设</dt>
          <dd><NSelect data-testid="target-preset-select" :value="target.presetId" :options="targetPresets" @update:value="applyPreset(String($event))" /></dd>
        </div>
        <div class="metric">
          <dt>防御值</dt>
          <dd>
            <NInputNumber
              v-if="isCustomTargetPreset"
              data-testid="target-defense-input"
              :value="target.defense"
              :min="0"
              :step="1"
              @update:value="updateTarget({ defense: Number($event ?? 0) })"
            />
            <span v-else class="target-defense-value">{{ displayDefense }}</span>
          </dd>
        </div>
        <div class="metric target-stun-metric">
          <dt>失衡</dt>
          <dd class="target-stun-row">
            <NCheckbox :checked="target.stunned" @update:checked="updateTarget({ stunned: Boolean($event) })">启用</NCheckbox>
            <div class="target-stun-multiplier">
              <span>初始倍率</span>
              <NInputNumber
                :value="target.stunMultiplierPercent"
                :min="0"
                :step="0.1"
                @update:value="updateTarget({ stunMultiplierPercent: Number($event ?? 0) })"
              />
              <span>%</span>
            </div>
          </dd>
        </div>
        <div class="metric">
          <dt>{{ resistanceLabel }}</dt>
          <dd>
            <NInputNumber
              :value="currentResistanceValue"
              :min="-100"
              :max="100"
              :step="1"
              data-testid="target-resistance-input"
              @update:value="setResistance(Number($event ?? 0))"
            />
          </dd>
        </div>
      </div>
      <div class="toolbar">
        <NButton size="small" @click="setResistance(0)">0%</NButton>
        <NButton size="small" @click="setResistance(20)">20%</NButton>
        <NButton size="small" @click="setResistance(-20)">-20%</NButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.target-stun-metric {
  grid-column: 1 / -1;
}

.target-stun-row {
  display: grid;
  grid-template-columns: minmax(78px, auto) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.target-stun-multiplier {
  display: grid;
  grid-template-columns: auto minmax(72px, 1fr) auto;
  gap: 8px;
  align-items: center;
  color: var(--app-muted);
  font-size: 12px;
}

.target-stun-multiplier :deep(.n-input-number) {
  min-width: 0;
}

.target-defense-value {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  color: var(--app-text);
  font-weight: 650;
}

@media (max-width: 520px) {
  .target-stun-row {
    grid-template-columns: 1fr;
  }
}
</style>
