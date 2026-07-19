<script setup lang="ts">
import { NButton, NInput } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"

const props = defineProps<{ sources: string[], disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

function addSource() {
  props.sources.push("")
  emit("change")
}

function updateSource(index: number, value: string) {
  props.sources[index] = value
  emit("change")
}

function removeSource(index: number) {
  props.sources.splice(index, 1)
  emit("change")
}
</script>

<template>
  <div class="source-list-editor">
    <div v-for="(source, index) in sources" :key="index" class="source-list-row">
      <label class="maintenance-field">
        <span>资料来源 {{ index + 1 }}</span>
        <NInput :value="source" :disabled="disabled" placeholder="https://..." @update:value="updateSource(index, String($event))" />
      </label>
      <NButton quaternary type="error" :disabled="disabled" title="删除资料来源" @click="removeSource(index)">
        <template #icon><Trash2 :size="15" /></template>
      </NButton>
    </div>
    <NButton size="small" :disabled="disabled" @click="addSource">
      <template #icon><Plus :size="14" /></template>
      添加资料来源
    </NButton>
  </div>
</template>
