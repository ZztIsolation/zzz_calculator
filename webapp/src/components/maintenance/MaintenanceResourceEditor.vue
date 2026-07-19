<script setup lang="ts">
import AgentEditor from "./editors/AgentEditor.vue"
import AgentSkillEditor from "./editors/AgentSkillEditor.vue"
import WEngineEditor from "./editors/WEngineEditor.vue"
import DriveDiscSetEditor from "./editors/DriveDiscSetEditor.vue"
import AnomalyEffectEditor from "./editors/AnomalyEffectEditor.vue"
import TeammateBuffEditor from "./editors/TeammateBuffEditor.vue"
import FieldBuffEditor from "./editors/FieldBuffEditor.vue"
import BossBuffEditor from "./editors/BossBuffEditor.vue"
import type { ResourceValue } from "./maintenance-model"

defineProps<{ resource: ResourceValue, model: any, catalog: any, disabled?: boolean, selectedBuffId?: string }>()
const emit = defineEmits<{ change: [], selectBuff: [buff: any], addBuff: [] }>()
</script>

<template>
  <AgentEditor v-if="resource === 'agents'" :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
  <AgentSkillEditor v-else-if="resource === 'agent-skills'" :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
  <WEngineEditor v-else-if="resource === 'w-engines'" :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
  <DriveDiscSetEditor v-else-if="resource === 'drive-disc-sets'" :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
  <AnomalyEffectEditor v-else-if="resource === 'anomaly-effects'" :model="model" :disabled="disabled" @change="emit('change')" />
  <TeammateBuffEditor v-else-if="resource === 'teammate-buffs'" :model="model" :catalog="catalog" :selected-buff-id="selectedBuffId ?? ''" :disabled="disabled" @change="emit('change')" @select-buff="emit('selectBuff', $event)" @add-buff="emit('addBuff')" />
  <FieldBuffEditor v-else-if="resource === 'field-buffs'" :model="model" :catalog="catalog" :disabled="disabled" @change="emit('change')" />
  <BossBuffEditor v-else :model="model" :catalog="catalog" :selected-buff-id="selectedBuffId ?? ''" :disabled="disabled" @change="emit('change')" @select-buff="emit('selectBuff', $event)" @add-buff="emit('addBuff')" />
</template>
