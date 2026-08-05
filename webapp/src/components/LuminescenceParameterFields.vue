<script setup lang="ts">
import { computed } from "vue"
import { NInputNumber, NTooltip } from "naive-ui"
import { Info } from "lucide-vue-next"
import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"

const props = withDefaults(defineProps<{
  event: any
  disabled?: boolean
  variant?: "compact" | "default"
}>(), {
  disabled: false,
  variant: "default",
})

const emit = defineEmits<{ update: [patch: any] }>()
const parameters = computed(() => resolveLuminescenceParameters(props.event))

function updateTeammateAttack(value: number | null) {
  emit("update", { teammateAttack: value })
}

function updateLuminescenceDamageSharePct(value: number | null) {
  emit("update", { luminescenceDamageSharePct: value })
}
</script>

<template>
  <div
    class="luminescence-parameter-fields"
    :class="`luminescence-parameter-fields--${variant}`"
    :data-variant="variant"
    data-testid="luminescence-parameter-fields"
  >
    <div class="luminescence-parameter-grid">
      <label class="luminescence-parameter-field" data-layout-field="luminescence-teammate-attack">
        <span class="luminescence-parameter-label">队友初始攻击力</span>
        <NInputNumber
          data-testid="luminescence-teammate-attack"
          :value="parameters.teammateAttack"
          :min="0"
          :step="10"
          :disabled="disabled"
          :status="parameters.teammateAttackError ? 'error' : undefined"
          :aria-invalid="Boolean(parameters.teammateAttackError)"
          aria-label="队友初始攻击力"
          @update:value="updateTeammateAttack"
        />
        <small v-if="parameters.teammateAttackError" class="luminescence-parameter-error" role="alert">
          {{ parameters.teammateAttackError }}
        </small>
      </label>

      <label class="luminescence-parameter-field" data-layout-field="luminescence-damage-share">
        <span class="luminescence-parameter-label">
          <span>{{ variant === "compact" ? "耀变伤害占比" : "耀变在队伍总伤害中的占比" }}</span>
          <NTooltip v-if="variant === 'compact'" trigger="hover">
            <template #trigger>
              <button type="button" class="luminescence-parameter-help" aria-label="耀变伤害占比说明">
                <Info :size="15" aria-hidden="true" />
              </button>
            </template>
            可以参考危局、防卫战结束时蕾米埃尔的伤害占比，约等于耀变伤害占比。普遍而言，丹的影画越高，耀变伤害占比越高。
          </NTooltip>
        </span>
        <NInputNumber
          data-testid="luminescence-damage-share"
          :value="parameters.luminescenceDamageSharePct"
          :min="0"
          :max="100"
          :step="1"
          :disabled="disabled"
          :status="parameters.luminescenceDamageSharePctError ? 'error' : undefined"
          :aria-invalid="Boolean(parameters.luminescenceDamageSharePctError)"
          aria-label="耀变在队伍总伤害中的占比"
          @update:value="updateLuminescenceDamageSharePct"
        >
          <template #suffix>%</template>
        </NInputNumber>
        <small v-if="parameters.luminescenceDamageSharePctError" class="luminescence-parameter-error" role="alert">
          {{ parameters.luminescenceDamageSharePctError }}
        </small>
        <small v-if="variant === 'default'" class="luminescence-parameter-help-text">
          可以参考危局、防卫战结束时蕾米埃尔的伤害占比，约等于耀变伤害占比。普遍而言，丹的影画越高，耀变伤害占比越高。
        </small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.luminescence-parameter-fields {
  min-width: 0;
  container: luminescence-parameters / inline-size;
}

.luminescence-parameter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}

.luminescence-parameter-fields--compact .luminescence-parameter-grid {
  gap: 10px;
}

.luminescence-parameter-field {
  display: grid;
  align-content: start;
  min-width: 0;
  gap: 6px;
}

.luminescence-parameter-label {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.4;
}

.luminescence-parameter-label > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.luminescence-parameter-field :deep(.n-input-number) {
  width: 100%;
  min-width: 0;
}

.luminescence-parameter-help {
  display: inline-grid;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  place-items: center;
  color: var(--app-muted);
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: help;
}

.luminescence-parameter-help:hover,
.luminescence-parameter-help:focus-visible {
  color: var(--app-blue);
  background: var(--app-panel-muted);
  outline: none;
}

.luminescence-parameter-help:focus-visible {
  box-shadow: 0 0 0 2px rgba(47, 125, 246, 0.24);
}

.luminescence-parameter-help-text,
.luminescence-parameter-error {
  font-size: 12px;
  line-height: 1.55;
}

.luminescence-parameter-help-text {
  color: var(--app-muted);
}

.luminescence-parameter-error {
  color: #b42318;
}

@container luminescence-parameters (max-width: 440px) {
  .luminescence-parameter-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 390px) {
  .luminescence-parameter-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
