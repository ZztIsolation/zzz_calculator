<script setup lang="ts">
import { computed } from "vue"
import LuminescenceParameterFields from "@/components/LuminescenceParameterFields.vue"
import { resolveLuminescenceParameters } from "@/utils/luminescenceParameters"
import { evaluateLuminescence } from "@core/luminescence.js"

const props = withDefaults(defineProps<{
  event: any
  agent?: any
  cinemaLevel?: number
  coreSkillLevel?: string | number
  inCombatPanel?: any
  outOfCombatPanel?: any
  luminescenceDamageMultiplier?: number
  teamAnomalyDamageMultiplier?: number
  disabled?: boolean
}>(), {
  cinemaLevel: 0,
  coreSkillLevel: "F",
  inCombatPanel: () => ({}),
  outOfCombatPanel: () => ({}),
  luminescenceDamageMultiplier: 1,
  teamAnomalyDamageMultiplier: 1,
  disabled: false,
})

const emit = defineEmits<{ update: [patch: any] }>()
const parameters = computed(() => resolveLuminescenceParameters(props.event))
const danInitialAtk = computed(() => Math.max(0, Number(props.outOfCombatPanel?.atk ?? props.inCombatPanel?.atk ?? 0)))
const danAnomalyProficiency = computed(() => Math.max(0, Number(props.inCombatPanel?.anomalyProficiency ?? 0)))
const luminescenceDamageMultiplier = computed(() => {
  const value = Number(props.luminescenceDamageMultiplier)
  return Number.isFinite(value) && value >= 0 ? value : 1
})
const teamAnomalyDamageMultiplier = computed(() => {
  const value = Number(props.teamAnomalyDamageMultiplier)
  return Number.isFinite(value) && value >= 0 ? value : 1
})
const evaluation = computed<any>(() => {
  const resolved = parameters.value
  if (!resolved.valid || resolved.teammateAttack === null || resolved.luminescenceDamageSharePct === null) {
    return { error: resolved.errors[0] ?? "耀变参数无效" }
  }
  try {
    return evaluateLuminescence({
      ...props.event,
      kind: "anomaly",
      settlementType: "luminescence",
      triggerActorRef: { agentId: String(props.agent?.id ?? props.event?.triggerActorRef?.agentId ?? "") },
      teammateAttack: resolved.teammateAttack,
      luminescenceDamageSharePct: resolved.luminescenceDamageSharePct,
      danInitialAtk: danInitialAtk.value,
      danAnomalyProficiency: danAnomalyProficiency.value,
      luminescenceDamageMultiplier: luminescenceDamageMultiplier.value,
      teamAnomalyDamageMultiplier: teamAnomalyDamageMultiplier.value,
      coreSkillLevel: props.coreSkillLevel,
      cinemaLevel: props.cinemaLevel,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

const score = computed(() => {
  const value = evaluation.value?.score
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value)
})
const scoreSuffix = computed(() => String(evaluation.value?.scoreSuffix ?? "× k"))

function formatNumber(value: unknown, digits = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "-"
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(number)
}
</script>

<template>
  <div class="luminescence-editor" data-testid="luminescence-event-editor">
    <LuminescenceParameterFields
      :event="event"
      :disabled="disabled"
      @update="emit('update', $event)"
    />

    <section class="luminescence-result" aria-live="polite">
      <span>队伍异常评分</span>
      <strong v-if="score !== null">{{ formatNumber(score) }} {{ scoreSuffix }}</strong>
      <strong v-else class="luminescence-error">参数无效</strong>
      <small v-if="evaluation.error" class="luminescence-error">{{ evaluation.error }}</small>
      <p>丹所在队伍伤害的最大化，主要取决于队友攻击力、队友其他属性（如异常精通、穿透等）、耀变伤害占比、丹初始攻击力、丹局内精通。为了简化计算，我们将队友攻击力、耀变伤害占比设置为变量，队友其他属性设置为恒变量k，从而得到关于丹攻击力以及异常精通配置的最优解。</p>
    </section>
  </div>
</template>

<style scoped>
.luminescence-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 1fr);
  gap: 16px;
  min-width: 0;
}

.luminescence-result > span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 650;
}

.luminescence-result {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 12px 14px;
  border-left: 3px solid #0f766e;
  background: #f0fdfa;
}

.luminescence-result strong {
  color: #0f4f49;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.luminescence-result p {
  margin: 2px 0 0;
  color: #52706d;
  font-size: 12px;
  line-height: 1.55;
}

.luminescence-result .luminescence-error {
  color: #b42318;
}

@media (max-width: 560px) {
  .luminescence-editor {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
