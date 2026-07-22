<script setup lang="ts">
import { computed } from "vue"
import { NButton, NTag } from "naive-ui"
import { LockKeyhole } from "lucide-vue-next"
import { fallbackIcon, imageForDriveDiscSet } from "@/utils/assets"
import { formatStoredStatValue, labelOf, storedStatLabel } from "@/utils/format"

const props = withDefaults(defineProps<{
  slot: number
  disc?: any | null
  driveDiscSets?: any[]
  meta?: any
  agents?: any[]
  targetAgentId?: string
  interactive?: boolean
  missingReference?: boolean
  showSequence?: boolean
  showReservation?: boolean
  reservationAction?: boolean
  reservationBusy?: boolean
  currentReservationPrefix?: string
  emptyHint?: string
}>(), {
  disc: null,
  driveDiscSets: () => [],
  agents: () => [],
  targetAgentId: "",
  interactive: false,
  missingReference: false,
  showSequence: false,
  showReservation: false,
  reservationAction: false,
  reservationBusy: false,
  currentReservationPrefix: "当前角色",
  emptyHint: "可在自选模式选择已有驱动盘",
})

const emit = defineEmits<{
  select: [slot: number]
  toggleReservation: [disc: any]
}>()

const driveDiscSet = computed(() => {
  const byId = props.driveDiscSets.find(set => set.id === props.disc?.setId)
  if (byId) return byId
  const setName = String(props.disc?.setName ?? "").trim()
  const byName = setName
    ? props.driveDiscSets.find(set => labelOf(set) === setName || set?.name?.zhCN === setName || set?.name?.en === setName)
    : null
  return byName ?? {
    id: String(props.disc?.setId ?? ""),
    name: { zhCN: setName || String(props.disc?.setId ?? "未知套装") },
    images: {},
  }
})

const setName = computed(() => props.disc?.setName || labelOf(driveDiscSet.value) || props.disc?.setId || "未知套装")
const title = computed(() => {
  if (props.disc) return `${props.slot}号位 · ${setName.value}`
  return `${props.slot}号位 · ${props.missingReference ? "驱动盘已缺失" : "未选择"}`
})
const detail = computed(() => {
  if (props.disc) return statText(props.disc.mainStat)
  return props.missingReference ? "此预设引用的驱动盘已不在当前库存" : "空槽位"
})
const secondary = computed(() => {
  if (!props.disc) return props.missingReference ? "请重新选择当前号位" : props.emptyHint
  const subStats = (props.disc.subStats ?? []).map((stat: any) => statText(stat)).join(" / ") || "无副词条"
  if (!props.showSequence || !props.disc.source?.sequence) return subStats
  return `${subStats} · 扫描 #${props.disc.source.sequence}`
})
const rarityLevel = computed(() => {
  if (!props.disc) return ""
  const rarity = props.disc.rarity ? String(props.disc.rarity) : "-"
  const level = Number(props.disc.level)
  return `${rarity}${Number.isFinite(level) ? ` +${level}` : ""}`
})
const reservation = computed(() => {
  const ownerId = String(props.disc?.reservedForAgentId ?? "").trim()
  if (!ownerId) return { label: "公共", type: "default" as const, state: "public" }
  const owner = props.agents.find(agent => agent.id === ownerId)
  const ownerName = labelOf(owner)
  if (!owner) return { label: `未知角色（${ownerId}）`, type: "warning" as const, state: "unknown" }
  if (ownerId === props.targetAgentId) {
    return { label: `${props.currentReservationPrefix} · ${ownerName}`, type: "success" as const, state: "current" }
  }
  return { label: `其他角色 · ${ownerName}`, type: "error" as const, state: "other" }
})
const targetAgentName = computed(() => {
  const target = props.agents.find(agent => agent.id === props.targetAgentId)
  return target ? labelOf(target) : props.targetAgentId ? `未知角色（${props.targetAgentId}）` : "当前角色"
})
const reservationActionLabel = computed(() => {
  if (reservation.value.state === "current") return `解除${targetAgentName.value}专属`
  if (reservation.value.state === "public") return `锁定给${targetAgentName.value}`
  return `转移给${targetAgentName.value}`
})

function statText(stat: any) {
  if (!stat?.stat) return "-"
  const mode = String(stat.mode ?? "")
  return `${storedStatLabel(String(stat.stat), mode, props.meta)} ${formatStoredStatValue(String(stat.stat), stat.value, mode)}`
}

function choose() {
  if (props.interactive) emit("select", props.slot)
}

function toggleReservation() {
  if (props.disc && props.reservationAction && props.targetAgentId && !props.reservationBusy) {
    emit("toggleReservation", props.disc)
  }
}
</script>

<template>
  <article
    class="disc-slot-card"
    :class="{
      'disc-slot-card-empty': !disc,
      'disc-slot-card-missing': missingReference,
      'disc-slot-card-manual': interactive,
      'disc-slot-card-conflict': showReservation && ['other', 'unknown'].includes(reservation.state),
    }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :data-slot="slot"
    :data-reservation-state="showReservation && disc ? reservation.state : undefined"
    @click="choose"
    @keydown.enter.prevent="choose"
    @keydown.space.prevent="choose"
  >
    <span class="disc-slot-card-icon">
      <img :src="disc ? imageForDriveDiscSet(driveDiscSet) : fallbackIcon" alt="" loading="lazy">
      <NButton
        v-if="disc && reservationAction && targetAgentId"
        class="disc-reservation-button"
        :class="`disc-reservation-button-${reservation.state}`"
        circle
        secondary
        :type="reservation.state === 'current' ? 'primary' : ['other', 'unknown'].includes(reservation.state) ? 'warning' : 'default'"
        :loading="reservationBusy"
        :disabled="reservationBusy"
        :title="reservationActionLabel"
        :aria-label="reservationActionLabel"
        @click.stop="toggleReservation"
        @keydown.stop
      >
        <template #icon><LockKeyhole :size="18" /></template>
      </NButton>
    </span>
    <div class="disc-slot-card-copy">
      <strong>{{ title }}</strong>
      <span>{{ detail }}</span>
      <small>{{ secondary }}</small>
    </div>
    <div class="disc-slot-card-meta">
      <NTag v-if="disc" round>{{ rarityLevel }}</NTag>
      <NTag v-if="showReservation && disc" :type="reservation.type" size="small" round>
        {{ reservation.label }}
      </NTag>
      <NButton v-if="interactive" size="tiny" @click.stop="choose">
        {{ disc ? "更换" : "选择" }}
      </NButton>
    </div>
  </article>
</template>

<style scoped>
.disc-slot-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 112px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: #fff;
}

.disc-slot-card-empty {
  background: var(--app-panel-muted);
}

.disc-slot-card-missing,
.disc-slot-card-conflict {
  border-color: #f0a020;
  background: #fffaf0;
}

.disc-slot-card-manual {
  cursor: pointer;
}

.disc-slot-card-manual:hover,
.disc-slot-card-manual:focus-visible {
  border-color: #93c5fd;
  background: #f8fbff;
  outline: none;
}

.disc-slot-card-icon {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
}

.disc-slot-card img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: var(--app-radius-sm);
  background: var(--app-panel-muted);
}

.disc-reservation-button {
  position: absolute;
  top: -9px;
  right: -9px;
  z-index: 1;
  width: 32px;
  height: 32px;
  min-width: 32px;
  border: 2px solid #fff;
  box-shadow: 0 2px 7px rgba(15, 23, 42, 0.2);
}

.disc-reservation-button-public {
  background: #fff;
  color: var(--app-blue);
}

.disc-reservation-button-current {
  color: #fff;
}

.disc-reservation-button-other,
.disc-reservation-button-unknown {
  background: #fff7e6;
}

.disc-slot-card-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.disc-slot-card-copy strong {
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.disc-slot-card-copy span,
.disc-slot-card-copy small {
  color: var(--app-muted);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.disc-slot-card-copy span {
  font-size: 12px;
  font-weight: 700;
}

.disc-slot-card-copy small {
  font-size: 11px;
}

.disc-slot-card-meta {
  display: grid;
  justify-items: end;
  gap: 6px;
  max-width: 170px;
}

.disc-slot-card-meta :deep(.n-tag__content) {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .disc-slot-card {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .disc-slot-card img {
    width: 42px;
    height: 42px;
  }

  .disc-slot-card-icon {
    width: 42px;
    height: 42px;
  }

  .disc-slot-card-meta {
    grid-column: 2;
    grid-auto-flow: column;
    justify-content: start;
    justify-items: start;
    max-width: 100%;
  }
}
</style>
