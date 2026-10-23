<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next"

/*
 * 全站统一的展开/收起按钮：蓝色箭头（可带文字），展开后箭头翻转。
 * 放在被展开内容的上方或标题行里，展开后按钮位置不变，不需要滚到底部再收起。
 */
const props = withDefaults(defineProps<{
  expanded: boolean
  label?: string
  expandedLabel?: string
  size?: number
}>(), {
  label: "",
  expandedLabel: "",
  size: 16,
})

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="expand-toggle"
    :class="{ 'is-expanded': props.expanded, 'is-icon-only': !props.label }"
    :aria-expanded="props.expanded"
    @click="emit('toggle')"
  >
    <ChevronDown class="expand-toggle-icon" :size="props.size" aria-hidden="true" />
    <span v-if="props.label" class="expand-toggle-label">{{ props.expanded && props.expandedLabel ? props.expandedLabel : props.label }}</span>
  </button>
</template>
