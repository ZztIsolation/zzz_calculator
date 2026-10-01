<script setup lang="ts">
import { computed, h } from "vue"
import { NCascader, type CascaderOption } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { specialtyLabel } from "@/utils/format"

type TeammateOption = {
  value: string
  label: string
  specialty?: string
  avatar?: string
  importStatus?: 'imported' | 'missing' | 'partial'
}

const importStatusLabels = { imported: '已导入', missing: '未导入', partial: '资料不完整' }

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
    h("span", { class: "teammate-select-option-name" }, option.label),
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
  const width = level === 0 ? "84px" : "min(220px, calc(100vw - 108px))"
  return { width, minWidth: width }
}
</script>

<template>
  <label class="teammate-select" :aria-label="label">
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
      :menu-props="{ class: 'teammate-select-menu' }"
      :filter-menu-props="searchMenuProps"
      :theme-overrides="{ optionHeight: '36px', optionFontSize: '14px', menuHeight: 'min(288px, 50vh)' }"
      :show-path="false"
      :virtual-scroll="false"
      check-strategy="child"
      expand-trigger="hover"
      filterable
      clearable
      @update:value="updateValue"
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
