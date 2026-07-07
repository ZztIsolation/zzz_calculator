<script setup lang="ts">
import { computed, ref } from "vue"
import { NInput, NScrollbar } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { iconForEntity } from "@/utils/assets"
import { entityMetaText, labelOf } from "@/utils/format"

const props = withDefaults(defineProps<{
  items: any[]
  modelValue: string
  kind: "agent" | "wEngine" | "buff" | "driveDiscSet" | "generic"
  placeholder?: string
  maxHeight?: number
}>(), {
  placeholder: "搜索",
  maxHeight: 420,
})

const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()

const query = ref("")

const filteredItems = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) {
    return props.items
  }
  return props.items.filter(item => {
    const text = [
      item?.id,
      labelOf(item),
      item?.name?.en,
      item?.source?.zhCN,
      item?.sourceLabel?.zhCN,
      item?.ownerName?.zhCN,
      item?.teammateName?.zhCN,
    ].filter(Boolean).join(" ").toLowerCase()
    return text.includes(needle)
  })
})

function metaOf(item: any) {
  if (props.kind === "buff") {
    return [item?.ownerName?.zhCN || item?.teammateName?.zhCN, item?.sourceLabel?.zhCN || item?.source?.zhCN]
      .filter(Boolean)
      .join(" / ")
  }
  return entityMetaText(item)
}
</script>

<template>
  <div class="section-band">
    <NInput v-model:value="query" clearable :placeholder="placeholder" />
    <NScrollbar :style="{ maxHeight: `${maxHeight}px` }">
      <div class="entity-grid">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          type="button"
          class="entity-option"
          :class="{ active: item.id === modelValue }"
          @click="emit('update:modelValue', item.id)"
        >
          <ImageAvatar :src="iconForEntity(item, kind)" :name="labelOf(item)" :round="kind === 'agent' || kind === 'buff'" />
          <span>
            <span class="entity-name">{{ labelOf(item) }}</span>
            <span class="entity-meta">{{ metaOf(item) }}</span>
          </span>
        </button>
      </div>
    </NScrollbar>
  </div>
</template>
