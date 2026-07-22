<script setup lang="ts">
import { computed, h, ref, watch } from "vue"
import { NButton, NInput, NModal, NSelect, NTag } from "naive-ui"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { fallbackIcon, imageForDriveDiscSet } from "@/utils/assets"
import { formatStoredStatValue, labelOf, storedStatLabel } from "@/utils/format"

const props = withDefaults(defineProps<{
  show: boolean
  slot: number
  discs?: any[]
  selectedId?: string
  driveDiscSets?: any[]
  meta?: any
  agents?: any[]
  targetAgentId?: string
  showReservation?: boolean
  surface?: string
  clearLabel?: string
}>(), {
  discs: () => [],
  selectedId: "",
  driveDiscSets: () => [],
  agents: () => [],
  targetAgentId: "",
  showReservation: false,
  surface: "manual-drive-disc-picker",
  clearLabel: "卸下此槽位",
})

const emit = defineEmits<{
  "update:show": [show: boolean]
  select: [disc: any]
  clear: []
}>()

const setFilterIds = ref<string[]>([])
const mainStatFilter = ref("")
const search = ref("")
const modalVisible = computed({
  get: () => props.show,
  set: value => emit("update:show", value),
})
const title = computed(() => props.slot ? `选择 ${props.slot} 号位驱动盘` : "选择驱动盘")
const slotDiscs = computed(() => props.discs.filter(disc => Number(disc.partition) === Number(props.slot)))
const setFilterOptions = computed(() => {
  const sets = new Map<string, { label: string, value: string, set: any, searchText: string }>()
  for (const disc of props.discs) {
    const set = setForDisc(disc)
    const id = String(set?.id || disc?.setId || "")
    if (!id) continue
    const name = setName(disc)
    sets.set(id, { label: name, value: id, set, searchText: `${name} ${id}` })
  }
  return [...sets.values()].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"))
})
const mainStatOptions = computed(() => {
  const stats = Array.from(new Set<string>(slotDiscs.value
    .map(disc => String(disc.mainStat?.stat ?? ""))
    .filter(Boolean)))
    .sort((left, right) => storedStatLabel(left, "", props.meta).localeCompare(storedStatLabel(right, "", props.meta), "zh-CN"))
  return [
    { label: "全部主词条", value: "" },
    ...stats.map(stat => ({ label: storedStatLabel(stat, "", props.meta), value: stat })),
  ]
})
const filteredDiscs = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return slotDiscs.value
    .filter(disc => {
      const set = setForDisc(disc)
      const discSetId = String(set?.id || disc?.setId || "")
      const haystack = [
        disc.id,
        disc.setId,
        disc.setName,
        setName(disc),
        disc.source?.sequence,
        disc.source?.sequence ? `#${disc.source.sequence}` : "",
        statText(disc.mainStat),
        ...(disc.subStats ?? []).flatMap((stat: any) => [statText(stat), stat.label]),
      ].filter(Boolean).join(" ").toLowerCase()
      return (!setFilterIds.value.length || setFilterIds.value.includes(discSetId))
        && (!mainStatFilter.value || disc.mainStat?.stat === mainStatFilter.value)
        && (!needle || haystack.includes(needle))
    })
    .sort((left, right) => {
      const leftSelected = left.id === props.selectedId ? 0 : 1
      const rightSelected = right.id === props.selectedId ? 0 : 1
      return leftSelected - rightSelected
        || setName(left).localeCompare(setName(right), "zh-CN")
        || Number(left.source?.sequence ?? 999999) - Number(right.source?.sequence ?? 999999)
    })
})

watch(setFilterOptions, options => {
  const validIds = new Set(options.map(option => option.value))
  setFilterIds.value = setFilterIds.value.filter(id => validIds.has(id))
})

watch(() => props.show, visible => {
  if (!visible) return
  mainStatFilter.value = ""
  search.value = ""
})

function setForDisc(disc: any) {
  const byId = props.driveDiscSets.find(set => set.id === disc?.setId)
  if (byId) return byId
  const rawName = String(disc?.setName ?? "").trim()
  return (rawName
    ? props.driveDiscSets.find(set => labelOf(set) === rawName || set?.name?.zhCN === rawName || set?.name?.en === rawName)
    : null) ?? {
    id: String(disc?.setId ?? ""),
    name: { zhCN: rawName || String(disc?.setId ?? "未知套装") },
    images: {},
  }
}

function setName(disc: any) {
  return disc?.setName || labelOf(setForDisc(disc)) || disc?.setId || "未知套装"
}

function statText(stat: any) {
  if (!stat?.stat) return "-"
  const mode = String(stat.mode ?? "")
  return `${storedStatLabel(String(stat.stat), mode, props.meta)} ${formatStoredStatValue(String(stat.stat), stat.value, mode)}`
}

function subStatText(disc: any) {
  return (disc?.subStats ?? []).map((stat: any) => statText(stat)).join(" / ") || "-"
}

function rarityLevelText(disc: any) {
  const rarity = disc?.rarity ? String(disc.rarity) : "-"
  const level = Number(disc?.level)
  return `${rarity}${Number.isFinite(level) ? ` +${level}` : ""}`
}

function reservationFor(disc: any) {
  const ownerId = String(disc?.reservedForAgentId ?? "").trim()
  if (!ownerId) return { label: "公共", type: "default" as const, state: "public" }
  const owner = props.agents.find(agent => agent.id === ownerId)
  if (!owner) return { label: `未知角色 · ${ownerId}`, type: "warning" as const, state: "unknown" }
  const ownerName = labelOf(owner)
  return ownerId === props.targetAgentId
    ? { label: `当前预设角色 · ${ownerName}`, type: "success" as const, state: "current" }
    : { label: `其他角色 · ${ownerName}`, type: "error" as const, state: "other" }
}

function filterSelectOption(pattern: string, option: any) {
  const needle = pattern.trim().toLowerCase()
  return !needle || String(option?.searchText ?? option?.label ?? option?.value ?? "").toLowerCase().includes(needle)
}

function renderSetLabel(option: any) {
  const set = option?.set ?? props.driveDiscSets.find(item => item.id === option?.value)
  const name = labelOf(set) || String(option?.label ?? option?.value ?? "未知套装")
  return h("span", { class: "manual-disc-set-select-label" }, [
    h(ImageAvatar, { src: imageForDriveDiscSet(set), name, size: 20 }),
    h("span", { class: "manual-disc-set-select-name", title: name }, name),
  ])
}

function updateSetFilter(value: Array<string | number> | null) {
  setFilterIds.value = Array.isArray(value) ? value.map(String) : []
}

function choose(disc: any) {
  emit("select", disc)
}

function clearSlot() {
  emit("clear")
}
</script>

<template>
  <NModal v-model:show="modalVisible" preset="card" :title="title" style="width: min(980px, calc(100vw - 16px)); max-width: 980px">
    <div class="section-band manual-disc-picker ui-layout-scope" :data-layout-surface="surface">
      <div class="manual-disc-picker-head">
        <span>只显示当前号位的已有驱动盘</span>
        <NTag round>{{ filteredDiscs.length }} 件可选</NTag>
      </div>
      <div class="manual-disc-filter-row ui-field-grid ui-field-grid--comfortable" data-layout-surface="manual-drive-disc-filters">
        <div class="metric" data-layout-field>
          <dt>套装</dt>
          <dd>
            <NSelect
              class="manual-disc-set-select"
              :value="setFilterIds"
              :options="setFilterOptions"
              :filter="filterSelectOption"
              :render-label="renderSetLabel"
              max-tag-count="responsive"
              multiple
              filterable
              clearable
              placeholder="全部套装"
              aria-label="驱动盘套装筛选"
              @update:value="updateSetFilter"
            />
          </dd>
        </div>
        <div class="metric" data-layout-field>
          <dt>主词条</dt>
          <dd>
            <NSelect
              :value="mainStatFilter"
              :options="mainStatOptions"
              clearable
              aria-label="驱动盘主词条筛选"
              @update:value="mainStatFilter = String($event ?? '')"
            />
          </dd>
        </div>
        <div class="metric" data-layout-field>
          <dt>搜索</dt>
          <dd><NInput v-model:value="search" clearable placeholder="套装、属性、序号" aria-label="搜索驱动盘" /></dd>
        </div>
      </div>

      <div v-if="filteredDiscs.length" class="manual-disc-option-list">
        <button
          v-for="disc in filteredDiscs"
          :key="disc.id"
          type="button"
          class="manual-disc-option"
          :class="{
            active: selectedId === disc.id,
            conflict: showReservation && ['other', 'unknown'].includes(reservationFor(disc).state),
          }"
          :aria-label="`选择 ${slot}号位 ${setName(disc)}${disc.source?.sequence ? ` 扫描序号 ${disc.source.sequence}` : ''}`"
          @click="choose(disc)"
        >
          <img :src="imageForDriveDiscSet(setForDisc(disc))" alt="" loading="lazy">
          <span class="manual-disc-option-main">
            <strong>{{ setName(disc) }}</strong>
            <span>{{ disc.partition }}号位 · {{ rarityLevelText(disc) }}{{ disc.source?.sequence ? ` · 扫描 #${disc.source.sequence}` : "" }}</span>
            <NTag v-if="showReservation" :type="reservationFor(disc).type" size="small" round>
              {{ reservationFor(disc).label }}
            </NTag>
          </span>
          <span class="manual-disc-option-stat">
            <strong>{{ statText(disc.mainStat) }}</strong>
            <span>{{ subStatText(disc) }}</span>
          </span>
        </button>
      </div>
      <div v-else class="empty-state manual-disc-empty">
        <img :src="fallbackIcon" alt="">
        <strong>暂无驱动盘</strong>
        <span>暂无符合筛选条件的驱动盘</span>
      </div>
    </div>
    <template #footer>
      <div class="drawer-footer">
        <span class="modal-summary">{{ slot ? `${slot} 号位` : "未选择槽位" }}</span>
        <span class="toolbar">
          <NButton type="error" :disabled="!selectedId" @click="clearSlot">{{ clearLabel }}</NButton>
          <NButton @click="modalVisible = false">关闭</NButton>
        </span>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.manual-disc-picker {
  gap: 12px;
}

.manual-disc-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-muted);
  font-size: 12px;
}

.manual-disc-filter-row {
  --ui-field-min: 180px;
  gap: 10px;
}

.manual-disc-set-select-label {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  gap: 6px;
  vertical-align: middle;
}

.manual-disc-set-select-label :deep(.avatar) {
  flex: 0 0 auto;
}

.manual-disc-set-select-label :deep(.avatar img) {
  object-fit: contain;
}

.manual-disc-set-select-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manual-disc-set-select :deep(.n-base-selection-tags) {
  min-width: 0;
}

.manual-disc-set-select :deep(.n-tag__content) {
  min-width: 0;
  max-width: 100%;
}

.manual-disc-option-list {
  display: grid;
  gap: 8px;
  max-height: min(560px, calc(100vh - 300px));
  overflow: auto;
}

.manual-disc-option {
  display: grid;
  grid-template-columns: 54px minmax(160px, 0.78fr) minmax(220px, 1.22fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 72px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.manual-disc-option:hover,
.manual-disc-option.active {
  border-color: #2563eb;
  background: #f8fbff;
}

.manual-disc-option.active {
  box-shadow: inset 4px 0 0 #facc15;
}

.manual-disc-option.conflict {
  border-color: #f0a020;
}

.manual-disc-option img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.manual-disc-option-main,
.manual-disc-option-stat {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.manual-disc-option-main {
  justify-items: start;
}

.manual-disc-option-main strong,
.manual-disc-option-stat strong,
.manual-disc-option-main span,
.manual-disc-option-stat span {
  min-width: 0;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.manual-disc-option-main strong,
.manual-disc-option-stat strong {
  color: var(--app-text);
  font-size: 13px;
}

.manual-disc-option-main span,
.manual-disc-option-stat span {
  color: var(--app-muted);
  font-size: 12px;
}

.manual-disc-empty {
  min-height: 260px;
}

@media (max-width: 980px) {
  .manual-disc-filter-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .manual-disc-option {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .manual-disc-option-stat {
    grid-column: 2;
  }

  .manual-disc-option img {
    width: 42px;
    height: 42px;
  }
}
</style>
