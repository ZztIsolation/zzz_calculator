<script setup lang="ts">
import { NAlert, NButton, NModal } from "naive-ui"

defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  "update:show": [value: boolean]
  confirm: []
}>()
</script>

<template>
  <NModal :show="show" :closable="!busy" :mask-closable="!busy" :close-on-esc="!busy" preset="dialog" :title="title" @update:show="emit('update:show', $event)">
    <p>{{ message }}</p>
    <NAlert v-if="error" type="error">{{ error }}</NAlert>
    <template #action>
      <NButton :disabled="busy" @click="emit('update:show', false)">取消</NButton>
      <NButton :loading="busy" :type="danger ? 'error' : 'primary'" @click="!busy && emit('confirm')">
        {{ confirmText || "确认" }}
      </NButton>
    </template>
  </NModal>
</template>
