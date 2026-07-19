<script setup lang="ts">
import { computed } from "vue"
import { NButton, NInput, NSelect } from "naive-ui"
import { Plus } from "lucide-vue-next"
import ImageAvatar from "@/components/ImageAvatar.vue"
import MaintenanceSection from "../MaintenanceSection.vue"
import BuffBodyEditor from "./BuffBodyEditor.vue"
import { textOf } from "../maintenance-model"
import { ATTRIBUTE_OPTIONS, SPECIALTY_OPTIONS } from "../maintenance-options"
import { imageForBuff } from "@/utils/assets"

const props = defineProps<{ model: any, catalog: any, selectedBuffId: string, disabled?: boolean }>()
const emit = defineEmits<{ change: [], selectBuff: [buff: any], addBuff: [] }>()
const currentBuff = computed(() => (props.model.buffs ?? []).find((item: any) => item.id === props.selectedBuffId) ?? props.model.buffs?.[0])
const changed = () => emit("change")

function setImageSource(value: string) {
  props.model.images.source = value
  changed()
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

    <MaintenanceSection title="Buff 列表" description="一次只编辑并保存一个 Buff。">
      <template #actions><NButton size="small" :disabled="disabled" @click="emit('addBuff')"><template #icon><Plus :size="15" /></template>添加 Buff</NButton></template>
      <div class="teammate-buff-layout">
        <div class="teammate-buff-list">
          <button v-for="buff in model.buffs" :key="buff.id" type="button" :class="{ active: buff.id === selectedBuffId }" :disabled="disabled" @click="emit('selectBuff', buff)"><strong :title="textOf(buff.source) || '未命名 Buff'">{{ textOf(buff.source) || '未命名 Buff' }}</strong><small :title="textOf(buff.description) || `${buff.effects?.length ?? 0} 条效果`">{{ textOf(buff.description) || `${buff.effects?.length ?? 0} 条效果` }}</small></button>
        </div>
        <div class="teammate-current-buff"><BuffBodyEditor v-if="currentBuff" :model="currentBuff" :catalog="catalog" :disabled="disabled" @change="changed" /><div v-else class="maintenance-empty">暂无 Buff</div></div>
      </div>
    </MaintenanceSection>
  </div>
</template>
