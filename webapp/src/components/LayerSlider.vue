<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  value: number
  label?: string
  min?: number
  max?: number
  step?: number
}>(), {
  label: "层数",
  min: 0,
  max: 1,
  step: 1,
})

const emit = defineEmits<{
  "update:value": [value: number]
}>()

const boundedMax = computed(() => Math.max(Number(props.min), Number(props.max)))
const boundedMin = computed(() => Math.min(Number(props.min), Number(props.max)))
const currentValue = computed(() => {
  const value = Number(props.value)
  if (!Number.isFinite(value)) {
    return boundedMin.value
  }
  return Math.min(boundedMax.value, Math.max(boundedMin.value, value))
})
const progress = computed(() => {
  const span = boundedMax.value - boundedMin.value
  if (span <= 0) {
    return 0
  }
  return ((currentValue.value - boundedMin.value) / span) * 100
})
const cssVars = computed(() => ({
  "--layer-slider-progress": `${progress.value}%`,
}))

function updateValue(event: Event) {
  const input = event.target as HTMLInputElement
  emit("update:value", Number(input.value))
}
</script>

<template>
  <div class="layer-slider" :style="cssVars">
    <div class="layer-slider-head">
      <span>{{ label }}</span>
    </div>
    <div class="layer-slider-body">
      <output class="layer-slider-bubble">{{ currentValue }}</output>
      <input
        type="range"
        :value="currentValue"
        :min="boundedMin"
        :max="boundedMax"
        :step="step"
        :aria-label="label"
        @input="updateValue"
      >
    </div>
  </div>
</template>

<style scoped>
.layer-slider {
  display: grid;
  gap: 20px;
  width: min(100%, 360px);
  min-width: 0;
  padding: 12px;
  border-radius: 4px;
  background: #eef6ff;
}

.layer-slider-head {
  color: #536170;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.layer-slider-body {
  position: relative;
  display: grid;
  align-items: center;
  min-height: 32px;
  padding-top: 9px;
}

.layer-slider-bubble {
  position: absolute;
  bottom: 27px;
  left: var(--layer-slider-progress);
  min-width: 32px;
  padding: 7px 9px;
  border-radius: 4px;
  background: #2f3640;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.layer-slider-bubble::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0;
  height: 0;
  border: 5px solid transparent;
  border-top-color: #2f3640;
  content: "";
  transform: translateX(-50%);
}

.layer-slider input[type="range"] {
  width: 100%;
  height: 28px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.layer-slider input[type="range"]::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    #3d9bff 0%,
    #3d9bff var(--layer-slider-progress),
    #d9e2ec var(--layer-slider-progress),
    #d9e2ec 100%
  );
}

.layer-slider input[type="range"]::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  margin-top: -8.5px;
  appearance: none;
  border: 2px solid #3d9bff;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.16);
}

.layer-slider input[type="range"]::-moz-range-track {
  height: 5px;
  border-radius: 999px;
  background: #d9e2ec;
}

.layer-slider input[type="range"]::-moz-range-progress {
  height: 5px;
  border-radius: 999px;
  background: #3d9bff;
}

.layer-slider input[type="range"]::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border: 2px solid #3d9bff;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.16);
}
</style>
