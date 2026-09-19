<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { NCheckbox, NInputNumber, NRadioButton, NRadioGroup } from "naive-ui"
import { buffDisplayName, buffSubtitle } from "@/utils/format"
import {
  localizedText,
  normalizedRuntimeParameterValue,
  runtimeCoverageForEffectRule,
  runtimeParameterDefinitions,
  runtimeSourceGroups,
  runtimeStackGroups,
} from "@core/shared-combat.js"

const props = defineProps<{
  buff: any
  selected: boolean
  runtime: any
  effectRows: Array<{ id: string, rule: any, text: string, coverage: any }>
  modifierLines: string[]
}>()
const emit = defineEmits<{
  toggle: [checked: boolean]
  coverage: [rule: any, value: number | null]
  sourceValue: [group: any, value: number]
  stacks: [group: any, value: number]
  parameter: [definition: any, value: unknown]
}>()

const fullName = computed(() => buffDisplayName(props.buff))
const title = computed(() => {
  const owner = localizedText(props.buff.ownerName ?? props.buff.teammateName)
  const prefix = `${owner} | `
  return owner && fullName.value.startsWith(prefix) ? fullName.value.slice(prefix.length) : fullName.value
})
const description = computed(() => buffSubtitle(props.buff))
const expanded = ref(false)
const descriptionElement = ref<HTMLElement | null>(null)
const canExpand = ref(false)
let descriptionObserver: ResizeObserver | undefined
function measureDescription() {
  const element = descriptionElement.value
  if (element?.clientWidth) canExpand.value = element.scrollHeight > 41
}
watch(description, value => {
  expanded.value = false
  canExpand.value = value.length > 60
  void nextTick(measureDescription)
}, { immediate: true })
onMounted(() => {
  measureDescription()
  if (typeof ResizeObserver !== "undefined" && descriptionElement.value) {
    descriptionObserver = new ResizeObserver(measureDescription)
    descriptionObserver.observe(descriptionElement.value)
  }
})
onBeforeUnmount(() => descriptionObserver?.disconnect())

const parameterDefinitions = computed(() => runtimeParameterDefinitions(props.buff))
const sources = computed(() => runtimeSourceGroups(props.buff))
const stackGroups = computed(() => runtimeStackGroups(props.buff))
const singleEffect = computed(() => props.effectRows.length === 1 && !props.modifierLines.length)
function parameterLabel(definition: any) {
  return definition.id === "anomalyAgentCount" ? "异常特性代理人人数" : localizedText(definition.label) || definition.id
}
</script>

<template>
  <article
    class="buff-row teammate-buff-card"
    :class="{ 'is-selected': selected, 'has-single-effect': singleEffect }"
    :data-buff-id="buff.id"
  >
    <div class="buff-row-main">
      <NCheckbox class="buff-check" :checked="selected" :aria-label="fullName" @update:checked="emit('toggle', Boolean($event))" />
      <button type="button" class="buff-row-toggle" :aria-label="fullName" :aria-pressed="selected" @click="emit('toggle', !selected)">
        {{ title }}
      </button>
    </div>
    <div v-if="effectRows.length || modifierLines.length" class="buff-effect-lines">
      <div v-for="row in effectRows" :key="row.id" class="buff-effect-row">
        <span>{{ row.text }}</span>
        <label v-if="row.coverage" class="rule-coverage-control">
          <span>覆盖率</span>
          <NInputNumber
            :value="runtimeCoverageForEffectRule(row.rule, buff, runtime)"
            :min="0" :max="1" :step="0.1" :disabled="!selected"
            :aria-label="`${fullName} ${row.text}覆盖率`"
            @update:value="emit('coverage', row.rule, $event)"
          />
        </label>
      </div>
      <div v-for="(line, index) in modifierLines" :key="index" class="buff-modifier-line">{{ line }}</div>
    </div>
    <div class="teammate-buff-description" :class="{ 'is-expanded': expanded }">
      <p :id="`buff-description-${buff.id}`" ref="descriptionElement">{{ description }}</p>
      <button
        v-if="canExpand"
        type="button"
        :aria-expanded="expanded"
        :aria-controls="`buff-description-${buff.id}`"
        :aria-label="`${expanded ? '收起' : '展开'}${fullName}说明`"
        @click="expanded = !expanded"
      >{{ expanded ? '收起' : '展开' }}</button>
    </div>
    <div v-if="parameterDefinitions.length" class="buff-runtime-parameters">
      <label v-for="definition in parameterDefinitions" :key="definition.id" class="buff-runtime-parameter">
        <span>{{ parameterLabel(definition) }}</span>
        <NRadioGroup :value="normalizedRuntimeParameterValue(definition, runtime.parameters?.[definition.id])" size="small" :aria-label="parameterLabel(definition)">
          <NRadioButton v-for="value in definition.values ?? []" :key="String(value)" :value="value" :label="String(value)" @click="emit('parameter', definition, value)" />
        </NRadioGroup>
      </label>
    </div>
    <div v-if="sources.length || stackGroups.length" class="runtime-grid" data-layout-surface="buff-runtime">
      <label v-for="group in sources" :key="group.key" class="runtime-metric ui-field" data-layout-field>
        <span>{{ group.label || '来源数值' }}</span>
        <NInputNumber
          :value="runtime.effects?.[group.ruleIds?.[0]]?.sourceValue ?? group.defaultValue ?? 0"
          :min="Number.isFinite(group.min) ? group.min : undefined"
          :max="Number.isFinite(group.max) ? group.max : undefined"
          :step="Number.isFinite(group.step) ? group.step : undefined"
          :aria-label="group.label || '来源数值'"
          @update:value="emit('sourceValue', group, Number($event))"
        />
      </label>
      <label v-for="group in stackGroups" :key="group.key" class="runtime-metric stack-metric ui-field" data-layout-field>
        <span>{{ group.label || '层数' }}</span>
        <NInputNumber
          class="stack-input"
          :value="runtime.effects?.[group.ruleIds?.[0]]?.stacks ?? group.defaultStacks ?? group.maxStacks ?? 1"
          :min="0" :max="group.maxStacks ?? 99" :step="1" :precision="0"
          :aria-label="group.label || '层数'"
          @update:value="emit('stacks', group, Number($event))"
        />
      </label>
    </div>
  </article>
</template>

<style scoped>
.teammate-buff-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text);
  font-size: 14px;
}
.teammate-buff-card.is-selected {
  border-color: var(--app-blue);
  background: #f3f7ff;
}
.buff-row-main {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.buff-check { flex: 0 0 auto; }
.buff-row-toggle {
  min-height: 32px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}
button:focus-visible { outline: 2px solid var(--app-blue); outline-offset: 2px; }
.buff-effect-lines {
  flex: 1 1 100%;
  display: grid;
  min-width: 0;
  gap: 4px;
  font-weight: 650;
  line-height: 20px;
}
.has-single-effect .buff-effect-lines { flex-basis: 240px; }
.buff-effect-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}
.buff-effect-row > span { flex: 1 1 140px; overflow-wrap: anywhere; }
.rule-coverage-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-muted);
  white-space: nowrap;
}
.rule-coverage-control :deep(.n-input-number) { width: 96px; }
.teammate-buff-description {
  flex: 1 1 100%;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--app-muted);
}
.teammate-buff-description p {
  flex: 1;
  min-width: 0;
  margin: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.teammate-buff-description.is-expanded p { display: block; }
.teammate-buff-description button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--app-blue);
  font: inherit;
  cursor: pointer;
}
.buff-runtime-parameters,
.runtime-grid {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  min-width: 0;
}
.runtime-metric,
.buff-runtime-parameter {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  line-height: 20px;
  color: var(--app-muted);
}
.runtime-metric > span { overflow-wrap: anywhere; }
.runtime-metric :deep(.n-input-number) { width: 112px; }
.runtime-metric :deep(.n-input-number),
.rule-coverage-control :deep(.n-input-number) { flex: 0 0 auto; --n-height: 32px !important; --n-font-size: 14px !important; }
.buff-runtime-parameter :deep(.n-radio-group) { display: flex; flex-wrap: wrap; }
.buff-runtime-parameter :deep(.n-radio-button) { min-height: 32px; line-height: 30px; font-size: 14px; }
.buff-modifier-line { overflow-wrap: anywhere; }
</style>
