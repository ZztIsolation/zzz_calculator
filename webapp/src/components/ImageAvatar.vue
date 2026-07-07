<script setup lang="ts">
import { ref, watch } from "vue"
import { fallbackIcon } from "@/utils/assets"

const props = withDefaults(defineProps<{
  src?: string
  name?: string
  size?: number
  round?: boolean
}>(), {
  src: "",
  name: "",
  size: 42,
  round: false,
})

const currentSrc = ref(props.src || fallbackIcon)

watch(() => props.src, value => {
  currentSrc.value = value || fallbackIcon
})

function handleError() {
  currentSrc.value = fallbackIcon
}
</script>

<template>
  <span
    class="avatar"
    :class="{ round }"
    :style="{ '--avatar-size': `${size}px` }"
  >
    <img :src="currentSrc" :alt="name || '图标'" loading="lazy" @error="handleError">
  </span>
</template>
