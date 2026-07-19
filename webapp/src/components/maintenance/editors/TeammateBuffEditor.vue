<script setup lang="ts">
import { computed, ref } from "vue"
import { NButton, NInput, NSelect } from "naive-ui"
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-vue-next"
import ImageAvatar from "@/components/ImageAvatar.vue"
import MaintenanceSection from "../MaintenanceSection.vue"
import BuffBodyEditor from "./BuffBodyEditor.vue"
import { textOf } from "../maintenance-model"
import { ATTRIBUTE_OPTIONS, SPECIALTY_OPTIONS } from "../maintenance-options"
import { imageForBuff } from "@/utils/assets"

const props = defineProps<{ model: any, catalog: any, selectedBuffId: string, disabled?: boolean }>()
const emit = defineEmits<{ change: [], selectBuff: [buff: any], addBuff: [] }>()
const currentBuff = computed(() => (props.model.buffs ?? []).find((item: any) => item.id === props.selectedBuffId) ?? props.model.buffs?.[0])
const draggingBuffId = ref("")
const dragTargetBuffId = ref("")
const dragTargetPosition = ref<"before" | "after">("before")
const changed = () => emit("change")

function setImageSource(value: string) {
  props.model.images.source = value
  changed()
}

function buffLabel(buff: any) {
  return textOf(buff?.source) || "未命名 Buff"
}

function moveBuff(fromIndex: number, toIndex: number) {
  const buffs = props.model.buffs ?? []
  if (props.disabled || fromIndex < 0 || fromIndex >= buffs.length || toIndex < 0 || toIndex >= buffs.length || fromIndex === toIndex) return
  const [buff] = buffs.splice(fromIndex, 1)
  buffs.splice(toIndex, 0, buff)
  changed()
}

function moveBuffBy(buffId: string, offset: number) {
  const fromIndex = (props.model.buffs ?? []).findIndex((buff: any) => buff.id === buffId)
  moveBuff(fromIndex, fromIndex + offset)
}

function clearDragState() {
  draggingBuffId.value = ""
  dragTargetBuffId.value = ""
  dragTargetPosition.value = "before"
}

function startBuffDrag(event: DragEvent, buffId: string) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  draggingBuffId.value = buffId
  event.dataTransfer?.setData("text/plain", buffId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
}

function updateBuffDragTarget(event: DragEvent, buffId: string) {
  if (!draggingBuffId.value || draggingBuffId.value === buffId) {
    dragTargetBuffId.value = ""
    return
  }
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()
  dragTargetBuffId.value = buffId
  dragTargetPosition.value = event.clientY >= bounds.top + bounds.height / 2 ? "after" : "before"
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
}

function dropBuff(event: DragEvent, targetBuffId: string) {
  event.preventDefault()
  const buffs = props.model.buffs ?? []
  const draggedId = draggingBuffId.value || event.dataTransfer?.getData("text/plain") || ""
  const fromIndex = buffs.findIndex((buff: any) => buff.id === draggedId)
  const targetIndex = buffs.findIndex((buff: any) => buff.id === targetBuffId)
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
    clearDragState()
    return
  }
  let toIndex = targetIndex + (dragTargetPosition.value === "after" ? 1 : 0)
  if (fromIndex < toIndex) toIndex -= 1
  moveBuff(fromIndex, toIndex)
  clearDragState()
}
</script>

<template>
  <div class="resource-editor teammate-buff-editor">
    <MaintenanceSection title="队友角色">
      <div class="teammate-profile-layout">
        <ImageAvatar :src="imageForBuff(model)" :name="textOf(model.name)" :size="72" />
        <div class="maintenance-grid">
          <label class="maintenance-field"><span>队友中文名</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field"><span>属性</span><NSelect v-model:value="model.attribute" :options="ATTRIBUTE_OPTIONS" :disabled="disabled" placeholder="请选择属性" @update:value="changed" /></label>
          <label class="maintenance-field"><span>特性</span><NSelect v-model:value="model.specialty" :options="SPECIALTY_OPTIONS" :disabled="disabled" placeholder="请选择特性" @update:value="changed" /></label>
          <label class="maintenance-field"><span>头像路径</span><NInput v-model:value="model.images.icon" :disabled="disabled" placeholder="/assets/agents/..." @update:value="changed" /></label>
          <label class="maintenance-field"><span>头像来源</span><NInput :value="model.images.source ?? ''" :disabled="disabled" placeholder="https://..." @update:value="setImageSource(String($event))" /></label>
        </div>
      </div>
    </MaintenanceSection>

    <MaintenanceSection title="Buff 列表" description="拖拽或使用上下按钮调整顺序；排序会随当前 Buff 一起保存。">
      <template #actions><NButton size="small" :disabled="disabled" @click="emit('addBuff')"><template #icon><Plus :size="15" /></template>添加 Buff</NButton></template>
      <div class="teammate-buff-layout">
        <div class="teammate-buff-list">
          <div
            v-for="(buff, index) in model.buffs"
            :key="buff.id"
            class="teammate-buff-item"
            :class="{
              active: buff.id === selectedBuffId,
              'is-dragging': buff.id === draggingBuffId,
              'drop-before': buff.id === dragTargetBuffId && dragTargetPosition === 'before',
              'drop-after': buff.id === dragTargetBuffId && dragTargetPosition === 'after',
            }"
            @dragover="updateBuffDragTarget($event, buff.id)"
            @drop="dropBuff($event, buff.id)"
          >
            <span
              class="teammate-buff-drag-handle"
              :class="{ disabled }"
              :draggable="!disabled"
              role="img"
              :aria-label="`拖拽调整 ${buffLabel(buff)} 顺序`"
              :title="`拖拽调整 ${buffLabel(buff)} 顺序`"
              @dragstart="startBuffDrag($event, buff.id)"
              @dragend="clearDragState"
            ><GripVertical :size="16" /></span>
            <button class="teammate-buff-select" type="button" :disabled="disabled" @click="emit('selectBuff', buff)">
              <strong :title="buffLabel(buff)">{{ buffLabel(buff) }}</strong>
              <small :title="textOf(buff.description) || `${buff.effects?.length ?? 0} 条效果`">{{ textOf(buff.description) || `${buff.effects?.length ?? 0} 条效果` }}</small>
            </button>
            <div class="teammate-buff-order-actions">
              <button type="button" :disabled="disabled || index === 0" :aria-label="`上移 ${buffLabel(buff)}`" :title="`上移 ${buffLabel(buff)}`" @click="moveBuffBy(buff.id, -1)"><ArrowUp :size="14" /></button>
              <button type="button" :disabled="disabled || index === model.buffs.length - 1" :aria-label="`下移 ${buffLabel(buff)}`" :title="`下移 ${buffLabel(buff)}`" @click="moveBuffBy(buff.id, 1)"><ArrowDown :size="14" /></button>
            </div>
          </div>
        </div>
        <div class="teammate-current-buff"><BuffBodyEditor v-if="currentBuff" :model="currentBuff" :catalog="catalog" :disabled="disabled" @change="changed" /><div v-else class="maintenance-empty">暂无 Buff</div></div>
      </div>
    </MaintenanceSection>
  </div>
</template>
