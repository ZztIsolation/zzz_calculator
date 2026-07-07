<script setup lang="ts">
import { NButton, NModal } from "naive-ui"

defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  confirm: []
}>()
</script>

<template>
  <NModal :show="show" preset="dialog" :title="title" @update:show="emit('update:show', $event)">
    <p>{{ message }}</p>
    <template #action>
      <NButton @click="emit('update:show', false)">取消</NButton>
      <NButton :type="danger ? 'error' : 'primary'" @click="emit('confirm')">
        {{ confirmText || "确认" }}
      </NButton>
    </template>
  </NModal>
</template>
