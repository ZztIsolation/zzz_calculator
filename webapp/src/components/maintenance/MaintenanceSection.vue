<script setup lang="ts">
defineProps<{ title: string, description?: string }>()
</script>

<template>
  <section class="maintenance-form-section">
    <header class="maintenance-section-head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div class="maintenance-section-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>
