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

<style scoped>
.expand-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 4px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-blue-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
}

.expand-toggle:hover {
  background: var(--app-panel-muted);
}

.expand-toggle:focus-visible {
  outline: var(--app-focus-ring);
  outline-offset: 1px;
}

.expand-toggle.is-icon-only {
  width: 24px;
  height: 24px;
  padding: 0;
}

.expand-toggle-icon {
  flex: 0 0 auto;
  transition: transform 0.15s ease;
}

.expand-toggle.is-expanded .expand-toggle-icon {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .expand-toggle-icon {
    transition: none;
  }
}
</style>
