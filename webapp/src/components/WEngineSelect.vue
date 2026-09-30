<script setup lang="ts">
import { computed, h, nextTick, ref, useId, watch } from "vue"
import { NCascader, type CascaderOption } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { imageForWEngine } from "@/utils/assets"
import { entityMetaText, entitySearchText, entitySelectLabel, labelOf, specialtyLabel } from "@/utils/format"

const props = defineProps<{
  items: any[]
  agent?: { id: string, specialty?: string }
  value: string
}>()
const emit = defineEmits<{ "update:value": [value: string] }>()

const show = ref(false)
const menuId = `w-engine-menu-${useId()}`
const specialtyOrder = ["attack", "stun", "anomaly", "support", "defense", "rupture", "armorer"]
const rarityOrder: Record<string, number> = { S: 0, A: 1, B: 2 }
const selectedItem = computed(() => props.items.find(item => item.id === props.value))
const isRecommended = (item: any) => Boolean(props.agent?.id && item.relatedAgentId === props.agent.id)
const groupedOptions = computed<CascaderOption[]>(() => {
  const groups = new Map<string, any[]>()
  for (const item of props.items) {
    const specialty = String(item.specialty ?? "").trim()
    const group = groups.get(specialty) ?? []
    group.push(item)
    groups.set(specialty, group)
  }
  const currentSpecialty = props.agent?.specialty?.trim()
  const order = [...new Set([
    ...(currentSpecialty ? [currentSpecialty] : []),
    ...specialtyOrder,
    ...[...groups.keys()].filter(key => key && !specialtyOrder.includes(key)),
    "",
  ])]
  return order.filter(key => groups.has(key)).map((specialty, index) => ({
    // Numeric categories cannot collide with string catalog IDs.
    value: index,
    label: specialty ? specialtyLabel(specialty) : "其他",
    children: groups.get(specialty)!
      .map((item, position) => ({ item, position }))
      .sort((a, b) => Number(isRecommended(b.item)) - Number(isRecommended(a.item))
        || (rarityOrder[a.item.rarity] ?? 3) - (rarityOrder[b.item.rarity] ?? 3)
        || a.position - b.position)
      .map(({ item }) => ({
        value: item.id,
        label: `${entitySelectLabel(item)}${isRecommended(item) ? " / 角色推荐" : ""}`,
        searchText: entitySearchText(item),
        item,
      })),
  }))
})

function renderItem(item: any) {
  return h("span", { class: "w-engine-select-option", "data-engine-id": item.id }, [
    h(ImageAvatar, { src: imageForWEngine(item), name: labelOf(item), size: 28 }),
    h("span", { class: "w-engine-select-copy" }, [
      h("span", { class: "w-engine-select-name", title: labelOf(item) }, labelOf(item)),
      h("span", { class: "w-engine-select-meta", title: entityMetaText(item) }, entityMetaText(item)),
    ]),
    isRecommended(item) ? h("span", { class: "w-engine-select-recommended" }, "角色推荐") : null,
  ])
}

function renderLabel(option: CascaderOption) {
  return option.children
    ? h("span", { "data-engine-category": option.value }, option.label)
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
  show.value = value
  if (!value || selectedItem.value) return
  await nextTick()
  if (!show.value || selectedItem.value) return
  // NCascader opens the selected path itself. With no selection, its public
  // API has no expanded-path prop; expand the first category through its normal
  // click handler, which cannot select a leaf or change the equipped engine.
  document.getElementById(menuId)
    ?.querySelector<HTMLElement>("[data-engine-category]")
    ?.closest<HTMLElement>(".n-cascader-option")?.click()
}

function columnStyle({ level }: { level: number }) {
  const width = level === 0 ? "84px" : "min(284px, calc(100vw - 110px))"
  return { width, minWidth: width }
}

watch(() => props.agent?.id, () => { show.value = false })
</script>

<template>
  <div class="w-engine-select" :class="{ 'w-engine-select--rich': selectedItem && !show }">
    <NCascader
      :value="selectedItem ? value : null"
      :show="show"
      :options="groupedOptions"
      :render-label="renderLabel"
      :filter="filter"
      :get-column-style="columnStyle"
      :menu-props="{ id: menuId, class: 'w-engine-select-menu' }"
      :filter-menu-props="{ class: 'w-engine-select-search-menu' }"
      :theme-overrides="{ optionHeight: '44px', optionFontSize: '14px', menuHeight: 'min(308px, 50vh)' }"
      :show-path="false"
      :virtual-scroll="false"
      check-strategy="child"
      expand-trigger="hover"
      filterable
      placeholder="选择音擎"
      aria-label="选择音擎"
      @update:value="updateValue"
      @update:show="updateShow"
    />
    <div v-if="selectedItem && !show" class="w-engine-select-display" aria-hidden="true">
      <ImageAvatar :src="imageForWEngine(selectedItem)" :name="labelOf(selectedItem)" :size="28" />
      <span class="w-engine-select-copy">
        <span class="w-engine-select-name" :title="labelOf(selectedItem)">{{ labelOf(selectedItem) }}</span>
        <span class="w-engine-select-meta">{{ entityMetaText(selectedItem) }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.w-engine-select { position: relative; width: 100%; min-width: 0; }
.w-engine-select :deep(.n-base-selection-label) { min-height: 42px; }
.w-engine-select--rich :deep(.n-base-selection-label__render-label) { opacity: 0; }
.w-engine-select-display {
  position: absolute;
  inset: 1px 32px 1px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
</style>

<style>
.w-engine-select-menu, .w-engine-select-search-menu { max-width: calc(100vw - 24px); }
.w-engine-select-menu .n-cascader-option { min-width: 0; padding-left: 10px; }
.w-engine-select-menu .n-cascader-option__label { min-width: 0; }
.w-engine-select-menu .n-scrollbar-container,
.w-engine-select-search-menu .n-scrollbar-container,
.w-engine-select-search-menu .n-virtual-list { overscroll-behavior: contain; }
.w-engine-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  line-height: 1.3;
}
.w-engine-select-option .avatar, .w-engine-select-display .avatar { flex: 0 0 auto; }
.w-engine-select-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.3; }
.w-engine-select-name, .w-engine-select-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-engine-select-name { font-size: 13px; font-weight: 600; }
.w-engine-select-meta { font-size: 11px; opacity: .7; }
.w-engine-select-recommended { flex: 0 0 auto; font-size: 11px; color: var(--n-option-text-color-active); }
</style>
