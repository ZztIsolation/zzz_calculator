<script setup lang="ts">
import { computed, h, nextTick, ref } from "vue"
import { NCascader, type CascaderOption } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { useAdaptiveCascaderMenu } from "@/composables/useAdaptiveCascaderMenu"
import { thumbnailForAgent } from "@/utils/assets"
import { entityMetaText, entitySearchText, entitySelectLabel, labelOf, specialtyLabel } from "@/utils/format"

const props = defineProps<{
  items: any[]
  value: string
}>()

const emit = defineEmits<{ "update:value": [value: string] }>()

const show = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const {
  to: adaptiveMenuTo,
  themeOverrides: adaptiveMenuThemeOverrides,
  scrollbarProps: adaptiveMenuScrollbarProps,
  placement: adaptiveMenuPlacement,
  menuProps: adaptiveMenuProps,
  updateShow: updateMenuShow,
} = useAdaptiveCascaderMenu({ optionHeight: 44, optionFontSize: 14, preferredHeight: 308 }, anchorRef)
const specialtyOrder = ["attack", "stun", "anomaly", "support", "defense", "rupture", "armorer"]
const selectedItem = computed(() => props.items.find(item => item.id === props.value))

const groupedOptions = computed<CascaderOption[]>(() => {
  const groups = new Map<string, any[]>()
  for (const item of props.items) {
    const specialty = String(item.specialty ?? "").trim()
    const group = groups.get(specialty) ?? []
    group.push(item)
    groups.set(specialty, group)
  }
  const currentSpecialty = selectedItem.value?.specialty?.trim()
  const order = [...new Set([
    ...(currentSpecialty ? [currentSpecialty] : []),
    ...specialtyOrder,
    ...[...groups.keys()].filter(specialty => specialty && !specialtyOrder.includes(specialty)),
    "",
  ])]
  return order.filter(specialty => groups.has(specialty)).map((specialty, index) => ({
    // Numeric category keys cannot collide with string agent IDs.
    value: index,
    label: specialty ? specialtyLabel(specialty) : "其他",
    children: groups.get(specialty)!.map(item => ({
      value: item.id,
      label: entitySelectLabel(item),
      searchText: entitySearchText(item),
      item,
    })),
  }))
})

function renderItem(item: any) {
  return h("span", { class: "agent-select-option", "data-agent-id": item.id }, [
    h(ImageAvatar, { src: thumbnailForAgent(item), name: labelOf(item), size: 28, round: true }),
    h("span", { class: "agent-select-copy" }, [
      h("span", { class: "agent-select-name", title: labelOf(item) }, labelOf(item)),
      h("span", { class: "agent-select-meta", title: entityMetaText(item) }, entityMetaText(item)),
    ]),
  ])
}

function renderLabel(option: CascaderOption) {
  return option.children
    ? h("span", { "data-agent-category": option.value }, option.label)
    : renderItem(option.item)
}

function filter(pattern: string, option: CascaderOption) {
  return !option.children && String(option.searchText ?? "").toLocaleLowerCase().includes(pattern.trim().toLocaleLowerCase())
}

function updateValue(value: string | number | Array<string | number> | null) {
  if (typeof value === "string" && props.items.some(item => item.id === value)) {
    emit("update:value", value)
  }
}

async function updateShow(value: boolean) {
  updateMenuShow(value)
  show.value = value
  if (!value || selectedItem.value) return
  await nextTick()
  if (!show.value || selectedItem.value) return
  // With no selected value, expand the first category through its normal
  // handler without allowing the category itself to be selected.
  document.getElementById(String(adaptiveMenuProps.value.id))
    ?.querySelector<HTMLElement>("[data-agent-category]")
    ?.closest<HTMLElement>(".n-cascader-option")?.click()
}

function columnStyle({ level }: { level: number }) {
  const width = level === 0 ? "84px" : "min(284px, calc(100vw - 110px))"
  return { width, minWidth: width }
}
</script>

<template>
  <div ref="anchorRef" class="agent-select" :class="{ 'agent-select--rich': selectedItem && !show }">
    <NCascader
      :value="selectedItem ? value : null"
      :show="show"
      :options="groupedOptions"
      :render-label="renderLabel"
      :filter="filter"
      :get-column-style="columnStyle"
      :to="adaptiveMenuTo"
      :placement="adaptiveMenuPlacement"
      :menu-props="{ ...adaptiveMenuProps, class: 'agent-select-menu' }"
      :filter-menu-props="{ class: 'agent-select-search-menu' }"
      :theme-overrides="adaptiveMenuThemeOverrides"
      :scrollbar-props="adaptiveMenuScrollbarProps"
      :show-path="false"
      :virtual-scroll="false"
      check-strategy="child"
      expand-trigger="hover"
      filterable
      placeholder="选择角色"
      aria-label="选择角色"
      @update:value="updateValue"
      @update:show="updateShow"
    />
    <div v-if="selectedItem && !show" class="agent-select-display" aria-hidden="true">
      <ImageAvatar :src="thumbnailForAgent(selectedItem)" :name="labelOf(selectedItem)" :size="28" round />
      <span class="agent-select-copy">
        <span class="agent-select-name" :title="labelOf(selectedItem)">{{ labelOf(selectedItem) }}</span>
        <span class="agent-select-meta">{{ entityMetaText(selectedItem) }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.agent-select { position: relative; width: 100%; min-width: 0; }
.agent-select :deep(.n-base-selection-label) { min-height: 42px; }
.agent-select--rich :deep(.n-base-selection-label__render-label) { opacity: 0; }
.agent-select-display {
  position: absolute;
  inset: 1px 32px 1px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
</style>

<style>
.agent-select-menu, .agent-select-search-menu { max-width: calc(100vw - 24px); }
.agent-select-menu .n-cascader-option { min-width: 0; padding-left: 10px; }
.agent-select-menu .n-cascader-option__label { min-width: 0; }
.agent-select-menu .n-scrollbar-container,
.agent-select-search-menu .n-scrollbar-container,
.agent-select-search-menu .n-virtual-list { overscroll-behavior: contain; }
.agent-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  line-height: 1.3;
}
.agent-select-option .avatar, .agent-select-display .avatar { flex: 0 0 auto; }
.agent-select-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.3; }
.agent-select-name, .agent-select-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-select-name { font-size: 13px; font-weight: 600; }
.agent-select-meta { font-size: 11px; opacity: .7; }
</style>
