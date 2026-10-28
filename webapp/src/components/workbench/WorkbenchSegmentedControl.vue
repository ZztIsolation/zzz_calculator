<script setup lang="ts">
import { computed, nextTick, ref } from "vue"

export interface WorkbenchSegmentedOption {
  label: string
  value: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: WorkbenchSegmentedOption[]
  ariaLabel?: string
}>(), {
  ariaLabel: "选择方案",
})

const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()

const optionRefs = ref<HTMLButtonElement[]>([])
const selectedIndex = computed(() => {
  const index = props.options.findIndex(option => option.value === props.modelValue && !option.disabled)
  return index >= 0 ? index : Math.max(0, props.options.findIndex(option => !option.disabled))
})
const indicatorStyle = computed(() => ({
  // 高亮块宽度扣掉底槽两侧 3px 内边距，平移按自身宽度计算，才能和每个格子对齐。
  width: `calc((100% - 6px) / ${Math.max(props.options.length, 1)})`,
  transform: `translateX(${selectedIndex.value * 100}%)`,
}))

function setOption(option: WorkbenchSegmentedOption) {
  if (!option.disabled) emit("update:modelValue", option.value)
}

function moveFocus(index: number) {
  const count = props.options.length
  if (!count) return
  let next = index
  for (let attempts = 0; attempts < count; attempts += 1) {
    next = (next + count) % count
    const option = props.options[next]
    if (option && !option.disabled) {
      setOption(option)
      void nextTick(() => optionRefs.value[next]?.focus())
      return
    }
    next += 1
  }
}

function handleKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault()
    moveFocus(index + 1)
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault()
    moveFocus(index - 1)
  }
}
</script>

<template>
  <div class="workbench-segmented-control" role="radiogroup" :aria-label="ariaLabel">
    <div class="workbench-segmented-control__track" :style="{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }">
      <span class="workbench-segmented-control__indicator" aria-hidden="true" :style="indicatorStyle"></span>
      <button
        v-for="(option, index) in options"
        :key="option.value"
        :ref="element => { if (element) optionRefs[index] = element as HTMLButtonElement }"
        type="button"
        class="workbench-segmented-control__option"
        role="radio"
        :aria-checked="option.value === modelValue"
        :aria-disabled="option.disabled ? 'true' : undefined"
        :disabled="option.disabled"
        @click="setOption(option)"
        @keydown="handleKeydown($event, index)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
