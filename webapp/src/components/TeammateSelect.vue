<script setup lang="ts">
import { computed, h, ref } from "vue"
import { NCascader, type CascaderOption } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { useAdaptiveCascaderMenu } from "@/composables/useAdaptiveCascaderMenu"
import { specialtyLabel } from "@/utils/format"

type TeammateOption = {
  value: string
  label: string
  specialty?: string
  avatar?: string
  importStatus?: 'imported' | 'missing' | 'partial'
}

const importStatusLabels = { imported: '已导入', missing: '未导入', partial: '资料不完整' }
const anchorRef = ref<HTMLElement | null>(null)
const {
  to: adaptiveMenuTo,
  themeOverrides: adaptiveMenuThemeOverrides,
  scrollbarProps: adaptiveMenuScrollbarProps,
  placement: adaptiveMenuPlacement,
  menuProps: adaptiveMenuProps,
  updateShow: updateMenuShow,
} = useAdaptiveCascaderMenu({ optionHeight: 36, optionFontSize: 14, preferredHeight: 288 }, anchorRef)

const props = withDefaults(defineProps<{
  value: string | null
  options: TeammateOption[]
  label?: string
}>(), { label: "队友" })

const emit = defineEmits<{ "update:value": [value: string | null] }>()

const specialtyOrder = ["attack", "stun", "anomaly", "support", "defense", "rupture", "armorer"]
const selectedOption = computed(() => props.options.find(option => option.value === props.value))
const groupedOptions = computed<CascaderOption[]>(() => {
  const groups = new Map<string, TeammateOption[]>()
  for (const option of props.options) {
    const specialty = option.specialty?.trim() || ""
    const group = groups.get(specialty) ?? []
    group.push(option)
    groups.set(specialty, group)
  }
  const order = [
    ...specialtyOrder,
    ...[...groups.keys()].filter(specialty => specialty && !specialtyOrder.includes(specialty)),
    "",
  ]
  return order.filter(specialty => groups.has(specialty)).map((specialty, index) => ({
    // Numeric category keys cannot collide with the string teammate IDs.
    value: index,
    label: specialty ? specialtyLabel(specialty) : "其他",
    children: groups.get(specialty),
  }))
})

function updateValue(value: string | number | Array<string | number> | null) {
  if (value === null) emit("update:value", null)
  else if (typeof value === "string" && props.options.some(option => option.value === value)) {
    emit("update:value", value)
  }
}

function renderLabel(option: CascaderOption) {
  if (option.children) return option.label
  return h("span", { class: "teammate-select-option" }, [
    h(ImageAvatar, { src: String(option.avatar ?? ""), name: option.label, size: 26, round: true }),
    h("span", { class: "teammate-select-option-name", title: option.label }, option.label),
    option.importStatus ? h('span', {
      class: ['teammate-import-dot', `is-${option.importStatus}`],
      role: 'img',
      title: importStatusLabels[option.importStatus as keyof typeof importStatusLabels],
      'aria-label': importStatusLabels[option.importStatus as keyof typeof importStatusLabels],
    }) : null,
  ])
}

function matchesName(pattern: string, option: CascaderOption) {
  return !option.children && String(option.label ?? "").toLocaleLowerCase().includes(pattern.trim().toLocaleLowerCase())
}

function renderSearchLabel(option: { value: string | number; label?: string }) {
  const teammate = props.options.find(item => item.value === option.value)
  return teammate ? renderLabel(teammate) : option.label
}

// The filtered menu forwards attributes to Naive UI's select menu.
const searchMenuProps = { class: 'teammate-select-search-menu', renderLabel: renderSearchLabel }

function columnStyle({ level }: { level: number }) {
  const width = level === 0 ? "100px" : "min(220px, calc(100vw - 124px))"
  return { width, minWidth: width, "--teammate-category-count": groupedOptions.value.length || 1 }
}
</script>

<template>
  <label ref="anchorRef" class="teammate-select" :aria-label="label">
    <span class="teammate-select-accessible-label">{{ label }}</span>
    <ImageAvatar
      v-if="selectedOption"
      class="teammate-select-avatar"
      :src="selectedOption.avatar"
      :name="selectedOption.label"
      :size="26"
      round
      aria-hidden="true"
    />
    <NCascader
      :value="value"
      :options="groupedOptions"
      :placeholder="`选择${label}`"
      :render-label="renderLabel"
      :filter="matchesName"
      :get-column-style="columnStyle"
      :to="adaptiveMenuTo"
      :placement="adaptiveMenuPlacement"
      :menu-props="{ ...adaptiveMenuProps, class: 'teammate-select-menu' }"
      :filter-menu-props="searchMenuProps"
      :theme-overrides="adaptiveMenuThemeOverrides"
      :scrollbar-props="adaptiveMenuScrollbarProps"
      :show-path="false"
      :virtual-scroll="false"
      check-strategy="child"
      expand-trigger="hover"
      filterable
      clearable
      @update:value="updateValue"
      @update:show="updateMenuShow"
    />
    <span
      v-if="selectedOption?.importStatus"
      class="teammate-import-dot"
      :class="`is-${selectedOption.importStatus}`"
      role="img"
      :title="importStatusLabels[selectedOption.importStatus]"
      :aria-label="importStatusLabels[selectedOption.importStatus]"
    />
  </label>
</template>

<style scoped>
.teammate-select {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
}

.teammate-select :deep(.n-cascader) {
  flex: 1;
  min-width: 0;
}

.teammate-select-avatar {
  flex: 0 0 auto;
}

.teammate-select-accessible-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

<style>
.teammate-import-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 1px solid var(--app-muted, #6b7280);
  border-radius: 50%;
}

.teammate-import-dot.is-imported {
  border-color: var(--app-blue, #2f7df6);
  background: var(--app-blue, #2f7df6);
}

.teammate-import-dot.is-partial {
  border-color: var(--app-amber, #b7791f);
}

.teammate-select-menu,
.teammate-select-search-menu {
  max-width: calc(100vw - 24px);
}

/* Cascade columns ignore scrollbarProps. Use a single native vertical scrollbar
   for character lists, including the virtual list used by search results. */
.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list) {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: auto;
  scrollbar-width: auto;
}

.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container::-webkit-scrollbar,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list)::-webkit-scrollbar {
  display: block !important;
  width: 10px;
  height: 0;
}

.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container::-webkit-scrollbar-track,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list)::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 6px;
}

.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container::-webkit-scrollbar-track-piece,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list)::-webkit-scrollbar-track-piece {
  display: block;
  width: 10px;
  height: auto;
}

.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container::-webkit-scrollbar-thumb,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list)::-webkit-scrollbar-thumb {
  display: block !important;
  width: 10px;
  height: auto;
  min-height: 24px;
  background: rgba(51, 65, 85, 0.78);
  border: 1px solid transparent;
  background-clip: padding-box;
  border-radius: 6px;
}

.teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container::-webkit-scrollbar-thumb:hover,
.teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list)::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.9);
}

@supports not selector(::-webkit-scrollbar) {
  .teammate-select-menu .n-cascader-submenu:not(:first-child) .n-scrollbar-container,
  .teammate-select-search-menu :is(.n-scrollbar-container, .n-virtual-list) {
    scrollbar-color: #475569 #e2e8f0;
    scrollbar-width: thin;
  }
}

/* Keep every category visible even when the character list has a shorter cap. */
.teammate-select-menu .n-cascader-submenu:first-child,
.teammate-select-menu .n-cascader-submenu:first-child .n-scrollbar {
  height: auto;
}

.teammate-select-menu .n-cascader-submenu:first-child .n-cascader-option {
  height: min(var(--n-option-height), calc(var(--n-menu-height) / var(--teammate-category-count)));
  line-height: normal;
}

.teammate-select-menu .n-cascader-submenu:first-child .n-scrollbar-container {
  height: auto;
  overflow: hidden;
  scrollbar-width: none;
}

.teammate-select-menu .n-cascader-submenu:first-child .n-scrollbar-container::-webkit-scrollbar {
  display: none !important;
  width: 0;
  height: 0;
}

.teammate-select-menu .n-scrollbar-rail,
.teammate-select-search-menu .n-scrollbar-rail {
  display: none;
}

.teammate-select-menu .n-cascader-option {
  min-width: 0;
  padding-left: 10px;
}

.teammate-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  line-height: 1.35;
}

.teammate-select-option .avatar {
  flex: 0 0 auto;
}

.teammate-select-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
