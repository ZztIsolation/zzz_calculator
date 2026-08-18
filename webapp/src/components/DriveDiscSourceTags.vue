<script setup lang="ts">
import { computed } from "vue"
import { NTag } from "naive-ui"
import {
  driveDiscScannerSequence,
  driveDiscSourceDescriptors,
  driveDiscSourceText,
} from "@/utils/driveDiscProvenance"

const props = withDefaults(defineProps<{
  disc?: any | null
  showScannerSequence?: boolean
}>(), {
  disc: null,
  showScannerSequence: false,
})

const sources = computed(() => driveDiscSourceDescriptors(props.disc))
const scannerSequence = computed(() => props.showScannerSequence ? driveDiscScannerSequence(props.disc) : null)
const sourceText = computed(() => driveDiscSourceText(props.disc, {
  includeScannerSequence: props.showScannerSequence,
}))
</script>

<template>
  <span
    v-if="sources.length"
    class="drive-disc-source-tags"
    :aria-label="`来源：${sourceText}`"
  >
    <NTag
      v-for="source in sources"
      :key="source.key"
      class="drive-disc-source-tag"
      :type="source.tagType"
      size="small"
      round
    >
      {{ source.label }}<template v-if="source.key === 'scanner' && scannerSequence !== null"> #{{ scannerSequence }}</template>
    </NTag>
  </span>
</template>

<style scoped>
.drive-disc-source-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.drive-disc-source-tag {
  flex: 0 0 auto;
}
</style>
