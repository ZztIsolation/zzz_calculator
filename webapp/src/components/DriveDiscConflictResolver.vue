<script setup lang="ts">
import { useId } from "vue"
import DriveDiscSourceTags from "@/components/DriveDiscSourceTags.vue"
import { formatStoredStatValue, storedStatLabel } from "@/utils/format"

type DriveDiscConflictResolution =
  | { action: "update", existingId: string }
  | { action: "add" }

type DriveDiscConflict = {
  key: string
  imported: any
  candidates?: any[]
  reason?: string
  agentId?: string
  agentName?: string
}

const props = withDefaults(defineProps<{
  conflicts?: DriveDiscConflict[]
  resolutions?: Record<string, DriveDiscConflictResolution>
  disabled?: boolean
}>(), {
  conflicts: () => [],
  resolutions: () => ({}),
  disabled: false,
})

const emit = defineEmits<{
  resolve: [resolution:
    | { key: string, action: "update", existingId: string }
    | { key: string, action: "add" }
  ]
}>()

const componentId = useId()

function conflictKey(conflict: DriveDiscConflict) {
  return String(conflict.key)
}

function resolutionFor(conflict: DriveDiscConflict) {
  return props.resolutions[conflictKey(conflict)] ?? null
}

function candidateId(candidate: any) {
  return String(candidate?.id ?? "")
}

function isUpdateSelected(conflict: DriveDiscConflict, candidate: any) {
  const resolution = resolutionFor(conflict)
  return resolution?.action === "update"
    && String(resolution.existingId) === candidateId(candidate)
}

function isAddSelected(conflict: DriveDiscConflict) {
  return resolutionFor(conflict)?.action === "add"
}

function resolveUpdate(conflict: DriveDiscConflict, candidate: any) {
  emit("resolve", {
    key: conflictKey(conflict),
    action: "update",
    existingId: candidateId(candidate),
  })
}

function resolveAdd(conflict: DriveDiscConflict) {
  emit("resolve", { key: conflictKey(conflict), action: "add" })
}

function discName(disc: any) {
  return String(disc?.setName ?? disc?.setId ?? "未知套装")
}

function discMeta(disc: any) {
  const parts = []
  const partition = Number(disc?.partition)
  if (Number.isInteger(partition) && partition > 0) parts.push(`${partition}号位`)
  const rarity = String(disc?.rarity ?? "").trim()
  const level = Number(disc?.level)
  if (rarity || Number.isFinite(level)) {
    parts.push(`${rarity || "-"}${Number.isFinite(level) ? ` +${level}` : ""}`)
  }
  return parts.join(" · ") || "信息不完整"
}

function statText(stat: any) {
  if (!stat?.stat) return "-"
  const mode = String(stat.mode ?? "")
  return `${storedStatLabel(String(stat.stat), mode)} ${formatStoredStatValue(String(stat.stat), stat.value, mode)}`
}

function subStatsText(disc: any) {
  return (disc?.subStats ?? []).map((stat: any) => statText(stat)).join(" / ") || "无副词条"
}

function discAriaName(disc: any) {
  return `${discName(disc)} ${discMeta(disc)} ID ${candidateId(disc) || "未提供"}`
}

function conflictTitle(conflict: DriveDiscConflict, index: number) {
  const agentName = String(conflict.agentName ?? "").trim()
  const imported = conflict.imported
  return [
    agentName,
    `${discName(imported)} ${Number(imported?.partition) || "?"}号位`,
    `疑似重复 ${index + 1}`,
  ].filter(Boolean).join(" · ")
}

function resolutionLabel(conflict: DriveDiscConflict) {
  const resolution = resolutionFor(conflict)
  if (!resolution) return "待选择"
  if (resolution.action === "add") return "作为新盘"
  return `更新 ${resolution.existingId}`
}

function radioName(conflictIndex: number) {
  return `${componentId}-drive-disc-conflict-${conflictIndex}`
}

function detailsId(conflictIndex: number, candidateIndex: number | "imported" | "add") {
  return `${componentId}-drive-disc-conflict-${conflictIndex}-${candidateIndex}`
}
</script>

<template>
  <section
    v-if="conflicts.length"
    class="drive-disc-conflict-resolver"
    aria-label="驱动盘疑似重复处理"
    :aria-busy="disabled"
  >
    <article
      v-for="(conflict, conflictIndex) in conflicts"
      :key="conflictKey(conflict)"
      class="drive-disc-conflict"
    >
      <header class="drive-disc-conflict-header">
        <div>
          <span class="drive-disc-conflict-eyebrow">疑似同盘</span>
          <h3>{{ conflictTitle(conflict, conflictIndex) }}</h3>
        </div>
        <span
          class="drive-disc-conflict-status"
          :class="{ resolved: Boolean(resolutionFor(conflict)) }"
          aria-live="polite"
        >
          {{ resolutionLabel(conflict) }}
        </span>
      </header>

      <div class="drive-disc-conflict-comparison">
        <section
          class="drive-disc-conflict-imported"
          role="group"
          :aria-label="`本次导入：${discAriaName(conflict.imported)}`"
        >
          <h4>本次导入</h4>
          <div class="drive-disc-conflict-disc-copy">
            <div class="drive-disc-conflict-disc-head">
              <strong>{{ discName(conflict.imported) }}</strong>
              <span>{{ discMeta(conflict.imported) }}</span>
            </div>
            <dl>
              <div><dt>主词条</dt><dd>{{ statText(conflict.imported?.mainStat) }}</dd></div>
              <div><dt>副词条</dt><dd>{{ subStatsText(conflict.imported) }}</dd></div>
            </dl>
            <code
              :id="detailsId(conflictIndex, 'imported')"
              class="drive-disc-conflict-id"
            >ID {{ candidateId(conflict.imported) || "未提供" }}</code>
            <DriveDiscSourceTags :disc="conflict.imported" show-scanner-sequence />
          </div>
        </section>

        <fieldset class="drive-disc-conflict-candidates" :disabled="disabled">
          <legend>库存候选（{{ conflict.candidates?.length ?? 0 }}）</legend>

          <label
            v-for="(candidate, candidateIndex) in conflict.candidates ?? []"
            :key="candidateId(candidate) || candidateIndex"
            class="drive-disc-conflict-option"
            :class="{ selected: isUpdateSelected(conflict, candidate) }"
          >
            <input
              type="radio"
              :disabled="disabled"
              :name="radioName(conflictIndex)"
              :checked="isUpdateSelected(conflict, candidate)"
              :aria-label="`更新此盘：${discAriaName(candidate)}`"
              :aria-describedby="detailsId(conflictIndex, candidateIndex)"
              @change="resolveUpdate(conflict, candidate)"
            >
            <span
              :id="detailsId(conflictIndex, candidateIndex)"
              class="drive-disc-conflict-disc-copy"
            >
              <span class="drive-disc-conflict-disc-head">
                <strong>{{ discName(candidate) }}</strong>
                <span>{{ discMeta(candidate) }}</span>
              </span>
              <span class="drive-disc-conflict-stat"><b>主词条</b>{{ statText(candidate?.mainStat) }}</span>
              <span class="drive-disc-conflict-stat"><b>副词条</b>{{ subStatsText(candidate) }}</span>
              <code class="drive-disc-conflict-id">ID {{ candidateId(candidate) || "未提供" }}</code>
              <DriveDiscSourceTags :disc="candidate" show-scanner-sequence />
            </span>
            <span class="drive-disc-conflict-action">更新此盘</span>
          </label>

          <label
            class="drive-disc-conflict-option drive-disc-conflict-add"
            :class="{ selected: isAddSelected(conflict) }"
          >
            <input
              type="radio"
              :disabled="disabled"
              :name="radioName(conflictIndex)"
              :checked="isAddSelected(conflict)"
              :aria-label="`作为新盘：${discAriaName(conflict.imported)}`"
              :aria-describedby="detailsId(conflictIndex, 'add')"
              @change="resolveAdd(conflict)"
            >
            <span :id="detailsId(conflictIndex, 'add')" class="drive-disc-conflict-add-copy">
              <strong>保留为独立库存记录</strong>
              <small>不会修改上方任何候选盘</small>
            </span>
            <span class="drive-disc-conflict-action">作为新盘</span>
          </label>
        </fieldset>
      </div>
    </article>
  </section>
</template>

<style scoped>
.drive-disc-conflict-resolver {
  container: drive-disc-conflicts / inline-size;
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.drive-disc-conflict {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
}

.drive-disc-conflict-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-panel-muted);
}

.drive-disc-conflict-header > div {
  min-width: 0;
}

.drive-disc-conflict-eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 700;
}

.drive-disc-conflict-header h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--app-text);
  font-size: 14px;
  letter-spacing: 0;
  line-height: 1.45;
}

.drive-disc-conflict-status {
  flex: 0 1 auto;
  max-width: 48%;
  padding: 3px 7px;
  overflow-wrap: anywhere;
  border: 1px solid var(--app-border-strong);
  border-radius: 999px;
  background: #fff;
  color: var(--app-muted);
  font-size: 11px;
  line-height: 1.35;
}

.drive-disc-conflict-status.resolved {
  border-color: var(--app-blue);
  color: var(--app-blue);
}

.drive-disc-conflict-comparison {
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(0, 1.35fr);
  min-width: 0;
}

.drive-disc-conflict-imported,
.drive-disc-conflict-candidates {
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 0;
}

.drive-disc-conflict-imported {
  border-right: 1px solid var(--app-border);
  background: var(--app-panel-muted);
}

.drive-disc-conflict-imported h4,
.drive-disc-conflict-candidates legend {
  width: 100%;
  margin: 0 0 9px;
  padding: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

.drive-disc-conflict-disc-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.drive-disc-conflict-disc-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.drive-disc-conflict-disc-head strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--app-text);
  font-size: 13px;
}

.drive-disc-conflict-disc-head > span {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 11px;
}

.drive-disc-conflict-disc-copy dl {
  display: grid;
  gap: 5px;
  margin: 2px 0 0;
}

.drive-disc-conflict-disc-copy dl > div,
.drive-disc-conflict-stat {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 7px;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

.drive-disc-conflict-disc-copy dt,
.drive-disc-conflict-stat b {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 600;
}

.drive-disc-conflict-disc-copy dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.drive-disc-conflict-stat {
  overflow-wrap: anywhere;
}

.drive-disc-conflict-id {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
  color: var(--app-muted);
  font-size: 11px;
  line-height: 1.4;
}

.drive-disc-conflict-candidates {
  display: grid;
  align-content: start;
  gap: 8px;
}

.drive-disc-conflict-option {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: #fff;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}

.drive-disc-conflict-option:hover {
  border-color: var(--app-border-strong);
}

.drive-disc-conflict-option:focus-within,
.drive-disc-conflict-option.selected {
  border-color: var(--app-blue);
  box-shadow: inset 0 0 0 1px var(--app-blue);
}

.drive-disc-conflict-option.selected {
  background: #f5f9ff;
}

.drive-disc-conflict-option input {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--app-blue);
}

.drive-disc-conflict-action {
  align-self: center;
  color: var(--app-blue);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.drive-disc-conflict-add {
  align-items: center;
  background: var(--app-panel-muted);
}

.drive-disc-conflict-add-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.drive-disc-conflict-add-copy strong {
  overflow-wrap: anywhere;
  color: var(--app-text);
  font-size: 12px;
}

.drive-disc-conflict-add-copy small {
  overflow-wrap: anywhere;
  color: var(--app-muted);
  font-size: 11px;
}

@container drive-disc-conflicts (max-width: 620px) {
  .drive-disc-conflict-comparison {
    grid-template-columns: minmax(0, 1fr);
  }

  .drive-disc-conflict-imported {
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }
}

@container drive-disc-conflicts (max-width: 420px) {
  .drive-disc-conflict-header {
    align-items: stretch;
    flex-direction: column;
    gap: 7px;
    padding: 10px;
  }

  .drive-disc-conflict-status {
    align-self: flex-start;
    max-width: 100%;
  }

  .drive-disc-conflict-imported,
  .drive-disc-conflict-candidates {
    padding: 10px;
  }

  .drive-disc-conflict-option {
    grid-template-columns: 20px minmax(0, 1fr);
    padding: 9px;
  }

  .drive-disc-conflict-action {
    grid-column: 2;
    justify-self: start;
  }

  .drive-disc-conflict-disc-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>
