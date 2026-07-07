<script setup lang="ts">
import EntityPicker from "@/components/EntityPicker.vue"

defineProps<{
  items: any[]
  modelValue: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()
</script>

<template>
  <EntityPicker
    :items="items"
    :model-value="modelValue"
    kind="wEngine"
    placeholder="搜索音擎"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
