<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { NButton, NModal } from "naive-ui"
import { thumbnailForDriveDiscSet } from "@/utils/assets"
import { labelOf } from "@/utils/format"

/** 优化约束里“限定 4 件套 / 额外 2 件套”的多选弹窗；选择先存在草稿里，点“应用限制”才提交 */
const props = withDefaults(defineProps<{
  show: boolean
  title: string
  sets: any[]
  /** 打开时的草稿初始值 */
  initialIds: string[]
  /** 当前已生效的选择，用于判断草稿是否有改动 */
  committedIds: string[]
  /** 是否至少需要选一项 */
  requireSelection?: boolean
  /** 每个套装下方的说明文字（如 2 件套效果） */
  describe?: ((set: any) => string) | null
  emptySummary: string
  selectedSummary: (count: number) => string
}>(), {
  requireSelection: false,
  describe: null,
})

const emit = defineEmits<{
  "update:show": [show: boolean]
  apply: [ids: string[]]
}>()

const draftIds = ref<string[]>([])
watch(() => props.show, visible => {
  if (visible) draftIds.value = [...props.initialIds]
}, { immediate: true })

const draftUnchanged = computed(() => [...draftIds.value].sort().join("|") === [...props.committedIds].sort().join("|"))
const summary = computed(() => draftIds.value.length ? props.selectedSummary(draftIds.value.length) : props.emptySummary)
const canApply = computed(() => !draftUnchanged.value && (!props.requireSelection || draftIds.value.length > 0))

function hasDraft(id: string) {
  return draftIds.value.includes(id)
}

function toggleDraft(id: string) {
  const selected = new Set(draftIds.value)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  draftIds.value = [...selected]
}
</script>

<template>
  <NModal :show="show" preset="card" :title="title" style="max-width: 920px" @update:show="emit('update:show', $event)">
    <div class="set-choice-list">
      <label
        v-for="set in sets"
        :key="set.id"
        class="set-choice"
        :class="{ active: hasDraft(set.id) }"
      >
        <input
          type="checkbox"
          :checked="hasDraft(set.id)"
          @change="toggleDraft(set.id)"
        >
        <img :src="thumbnailForDriveDiscSet(set)" alt="" loading="lazy" decoding="async">
        <span class="set-choice-text">
          <strong>{{ labelOf(set) }}</strong>
          <span v-if="describe">{{ describe(set) }}</span>
        </span>
      </label>
    </div>
    <template #footer>
      <div class="drawer-footer set-modal-footer">
        <span class="modal-summary">{{ summary }}</span>
        <span class="toolbar">
          <NButton @click="emit('update:show', false)">取消</NButton>
          <NButton type="primary" :disabled="!canApply" @click="emit('apply', [...draftIds])">应用限制</NButton>
        </span>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.set-choice-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}

.set-choice {
  display: grid;
  grid-template-columns: 18px 46px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-panel);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.set-choice:hover,
.set-choice.active {
  border-color: var(--app-blue);
  background: var(--app-blue-soft);
}

.set-choice input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--app-blue);
}

.set-choice img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.set-choice-text {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.set-choice-text strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.set-choice-text span {
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.set-modal-footer {
  align-items: center;
  justify-content: space-between;
}

.modal-summary {
  min-width: 0;
  color: var(--app-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 680px) {
  .set-choice-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .set-modal-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
