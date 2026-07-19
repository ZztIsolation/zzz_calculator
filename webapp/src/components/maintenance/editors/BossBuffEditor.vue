<script setup lang="ts">
import { computed } from "vue"
import { NButton, NInput, NInputNumber, NSelect, NSwitch, NTag } from "naive-ui"
import MaintenanceSection from "../MaintenanceSection.vue"
import EffectRulesEditor from "../EffectRulesEditor.vue"
import { internalId, textOf } from "../maintenance-model"
import { DAMAGE_ELEMENT_OPTIONS, SPECIALTY_OPTIONS } from "../maintenance-options"

const props = defineProps<{ model: any, catalog: any, selectedBuffId?: string, disabled?: boolean }>()
const emit = defineEmits<{ change: [], selectBuff: [encounter: any], addBuff: [] }>()
const changed = () => emit("change")

const encounter = computed(() => (props.model?.encounters ?? []).find((item: any) => item.id === props.selectedBuffId) ?? props.model?.encounters?.[0] ?? null)
const modeOptions = [
  { label: "危局强袭战", value: "critical_assault" },
  { label: "式舆防卫战", value: "defense_v5" },
]
const calculationStatusOptions = [
  { label: "参与计算", value: "modeled" },
  { label: "仅说明，未计入计算", value: "descriptiveOnly" },
]

function setName(target: any, key: string, value: unknown) {
  target[key] = { ...(target[key] ?? {}), zhCN: String(value ?? "") }
  changed()
}

function setAliases(value: string) {
  props.model.aliases = value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean)
  changed()
}

function addAppearance() {
  encounter.value.appearances.push({ modeId: "critical_assault", gameVersion: "3.0", phaseNo: 1, startDate: "", endDate: "" })
  changed()
}

function addEffectEntry(key: string) {
  encounter.value[key].push({
    id: internalId("boss_effect"),
    name: { zhCN: key === "playerBuffs" ? "新玩家增益" : "新玩家减益" },
    description: { zhCN: "待填写" },
    calculationStatus: "descriptiveOnly",
    unmodeledReason: { zhCN: "当前伤害模型尚未支持此效果。" },
    effects: [],
    buffModifiers: [],
  })
  changed()
}

function setCalculationStatus(entry: any, status: string) {
  entry.calculationStatus = status
  if (status === "modeled") {
    entry.effects ??= []
    delete entry.unmodeledReason
  } else {
    entry.effects = []
    entry.buffModifiers = []
    entry.unmodeledReason ??= { zhCN: "当前伤害模型尚未支持此效果。" }
  }
  changed()
}

function addSource() {
  encounter.value.sources.push({ label: { zhCN: "资料来源" }, url: "https://" })
  changed()
}

function removeFrom(list: any[], index: number) {
  list.splice(index, 1)
  changed()
}

function setResistanceOverride(element: string, value: number | null) {
  props.model.target.resistanceOverrides ??= {}
  if (value === null || !Number.isFinite(Number(value))) delete props.model.target.resistanceOverrides[element]
  else props.model.target.resistanceOverrides[element] = Number(value)
  changed()
}

function appearanceLabel(item: any) {
  return `${item.gameVersion || "?"} 版本 · 第 ${item.phaseNo || "?"} 期`
}
</script>

<template>
  <div class="resource-editor boss-buff-editor">
    <MaintenanceSection title="Boss 基础档案" description="稳定资料与敌情版本分开保存；弱点默认 -20% 抗性，抗性默认 +20%。">
      <div class="boss-profile-layout">
        <img class="boss-profile-image" :src="model.images?.icon" :alt="textOf(model.name)" />
        <div class="maintenance-grid">
          <label class="maintenance-field" data-field-key="name"><span>Boss 名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="setName(model, 'name', $event)" /></label>
          <label class="maintenance-field"><span>别名（逗号分隔）</span><NInput :value="(model.aliases ?? []).join('，')" :disabled="disabled" @update:value="setAliases(String($event))" /></label>
          <label class="maintenance-switch-field"><span>前台显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
          <label class="maintenance-field maintenance-field-wide" data-field-key="icon"><span>本地图片路径</span><NInput :value="model.images?.icon" :disabled="disabled" placeholder="/assets/bosses/example.webp" @update:value="model.images.icon = String($event); changed()" /></label>
          <label class="maintenance-field maintenance-field-wide" data-field-key="source"><span>原始图片地址</span><NInput :value="model.images?.source" :disabled="disabled" @update:value="model.images.source = String($event); changed()" /></label>
        </div>
      </div>
      <div class="maintenance-grid boss-target-grid">
        <label class="maintenance-field" data-field-key="defense"><span>防御力</span><NInputNumber :value="model.target?.defense" :min="0" :step="1" :disabled="disabled" @update:value="model.target.defense = Number($event ?? 0); changed()" /></label>
        <label class="maintenance-field" data-field-key="weaknessElements"><span>弱点属性</span><NSelect multiple :value="model.target?.weaknessElements" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="model.target.weaknessElements = $event; changed()" /></label>
        <label class="maintenance-field" data-field-key="resistanceElements"><span>抗性属性</span><NSelect multiple :value="model.target?.resistanceElements" :options="DAMAGE_ELEMENT_OPTIONS" :disabled="disabled" @update:value="model.target.resistanceElements = $event; changed()" /></label>
      </div>
      <details class="maintenance-subcard">
        <summary>特殊抗性覆盖值 <span>仅填写不使用默认 ±20% 的属性</span></summary>
        <div class="boss-override-grid">
          <label v-for="option in DAMAGE_ELEMENT_OPTIONS" :key="String(option.value)" class="maintenance-field"><span>{{ option.label }}</span><NInputNumber clearable :value="model.target?.resistanceOverrides?.[String(option.value)] ?? null" :min="-100" :max="100" :disabled="disabled" @update:value="setResistanceOverride(String(option.value), $event)" /></label>
        </div>
      </details>
    </MaintenanceSection>

    <MaintenanceSection title="敌情规则版本" description="机制或数值变化时新增版本；机制不变再次返场时只添加来源期数。">
      <div class="boss-encounter-layout">
        <div class="boss-encounter-list">
          <button v-for="item in model.encounters" :key="item.id" type="button" :class="{ active: item.id === encounter?.id }" :disabled="disabled" @click="emit('selectBuff', item)">
            <strong :title="appearanceLabel(item.appearances?.at(-1) ?? {})">{{ appearanceLabel(item.appearances?.at(-1) ?? {}) }}</strong>
            <small :title="textOf(item.enemyIntel)">{{ textOf(item.enemyIntel) }}</small>
          </button>
          <NButton secondary :disabled="disabled" @click="emit('addBuff')">添加规则版本</NButton>
        </div>

        <div v-if="encounter" class="boss-encounter-editor">
          <div class="maintenance-grid">
            <label class="maintenance-field maintenance-field-wide" data-field-key="enemyIntel"><span>完整敌情详解</span><NInput type="textarea" :autosize="{ minRows: 4 }" :value="textOf(encounter.enemyIntel)" :disabled="disabled" @update:value="setName(encounter, 'enemyIntel', $event)" /></label>
            <label class="maintenance-field"><span>推荐特性</span><NSelect multiple :value="encounter.recommendedSpecialties" :options="SPECIALTY_OPTIONS" :disabled="disabled" @update:value="encounter.recommendedSpecialties = $event; changed()" /></label>
            <label class="maintenance-switch-field"><span>前台显示</span><NSwitch :value="encounter.hidden !== true" :disabled="disabled" @update:value="encounter.hidden = !$event; changed()" /></label>
          </div>

          <div class="boss-editor-group">
            <div class="maintenance-section-head"><div><h4>来源期数</h4><p>同一 Boss 的玩法、版本和期数组合不能重复。</p></div><NButton size="small" :disabled="disabled" @click="addAppearance">添加返场</NButton></div>
            <div v-for="(item, index) in encounter.appearances" :key="index" class="boss-appearance-row">
              <NSelect :value="item.modeId" :options="modeOptions" :disabled="disabled" @update:value="item.modeId = $event; changed()" />
              <NInput :value="item.gameVersion" placeholder="游戏版本" :disabled="disabled" @update:value="item.gameVersion = String($event); changed()" />
              <NInputNumber :value="item.phaseNo" :min="1" :step="1" :disabled="disabled" @update:value="item.phaseNo = Number($event ?? 1); changed()" />
              <NInput :value="item.startDate" placeholder="开始日期 YYYY-MM-DD" :disabled="disabled" @update:value="item.startDate = String($event); changed()" />
              <NInput :value="item.endDate" placeholder="结束日期 YYYY-MM-DD" :disabled="disabled" @update:value="item.endDate = String($event); changed()" />
              <NButton quaternary type="error" :disabled="disabled || encounter.appearances.length <= 1" @click="removeFrom(encounter.appearances, index)">删除</NButton>
            </div>
          </div>

          <div v-for="group in [{ key: 'playerBuffs', title: '玩家增益' }, { key: 'playerDebuffs', title: '玩家减益' }]" :key="group.key" class="boss-editor-group">
            <div class="maintenance-section-head"><div><h4>{{ group.title }}</h4><p>可计算规则会参与伤害；其余效果完整展示并标记原因。</p></div><NButton size="small" :disabled="disabled" @click="addEffectEntry(group.key)">添加</NButton></div>
            <div v-for="(entry, index) in encounter[group.key]" :key="entry.id" class="maintenance-subcard boss-effect-entry">
              <div class="boss-effect-head"><strong>{{ textOf(entry.name) }}</strong><NTag size="small" :type="entry.calculationStatus === 'modeled' ? 'success' : 'warning'">{{ entry.calculationStatus === 'modeled' ? '参与计算' : '仅说明，未计入计算' }}</NTag><NButton quaternary type="error" :disabled="disabled" @click="removeFrom(encounter[group.key], index)">删除</NButton></div>
              <div class="maintenance-grid">
                <label class="maintenance-field"><span>名称</span><NInput :value="textOf(entry.name)" :disabled="disabled" @update:value="setName(entry, 'name', $event)" /></label>
                <label class="maintenance-field"><span>计算状态</span><NSelect :value="entry.calculationStatus" :options="calculationStatusOptions" :disabled="disabled" @update:value="setCalculationStatus(entry, String($event))" /></label>
                <label class="maintenance-field maintenance-field-wide"><span>说明</span><NInput type="textarea" :value="textOf(entry.description)" :disabled="disabled" @update:value="setName(entry, 'description', $event)" /></label>
                <label v-if="entry.calculationStatus === 'descriptiveOnly'" class="maintenance-field maintenance-field-wide"><span>未建模原因</span><NInput :value="textOf(entry.unmodeledReason)" :disabled="disabled" @update:value="setName(entry, 'unmodeledReason', $event)" /></label>
              </div>
              <EffectRulesEditor v-if="entry.calculationStatus === 'modeled'" :model="entry" :catalog="catalog" :disabled="disabled" @change="changed" />
            </div>
          </div>

          <div class="boss-editor-group">
            <div class="maintenance-section-head"><div><h4>资料来源</h4></div><NButton size="small" :disabled="disabled" @click="addSource">添加</NButton></div>
            <div v-for="(item, index) in encounter.sources" :key="index" class="boss-source-row"><NInput :value="textOf(item.label)" placeholder="来源名称" :disabled="disabled" @update:value="setName(item, 'label', $event)" /><NInput :value="item.url" placeholder="https://" :disabled="disabled" @update:value="item.url = String($event); changed()" /><NButton quaternary type="error" :disabled="disabled" @click="removeFrom(encounter.sources, index)">删除</NButton></div>
          </div>
        </div>
      </div>
    </MaintenanceSection>
  </div>
</template>

<style scoped>
.boss-profile-layout { display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 16px; }
.boss-profile-image { width: 118px; aspect-ratio: 3 / 4; object-fit: cover; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel-muted); }
.boss-target-grid { margin-top: 14px; }
.boss-override-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.boss-encounter-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; }
.boss-encounter-list { display: grid; align-content: start; gap: 7px; }
.boss-encounter-list button:not(.n-button) { display: grid; gap: 4px; width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: #fff; text-align: left; cursor: pointer; }
.boss-encounter-list button.active { border-color: var(--app-blue); background: #f5f9ff; }
.boss-encounter-list small { display: -webkit-box; overflow: hidden; color: var(--app-muted); font-size: 11px; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.boss-encounter-editor { min-width: 0; padding-left: 16px; border-left: 1px solid var(--app-border); }
.boss-editor-group { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--app-border); }
.boss-appearance-row { display: grid; grid-template-columns: 150px 90px 90px minmax(150px, 1fr) minmax(150px, 1fr) auto; gap: 8px; margin-bottom: 8px; }
.boss-effect-entry { margin-top: 10px; }
.boss-effect-head { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; margin-bottom: 12px; }
.boss-source-row { display: grid; grid-template-columns: minmax(150px, .45fr) minmax(0, 1fr) auto; gap: 8px; margin-bottom: 8px; }
@container ui-layout (max-width: 900px) { .boss-encounter-layout { grid-template-columns: 1fr; } .boss-encounter-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .boss-encounter-editor { padding: 14px 0 0; border-top: 1px solid var(--app-border); border-left: 0; } .boss-appearance-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container ui-layout (max-width: 640px) { .boss-profile-layout { grid-template-columns: 1fr; } .boss-profile-image { width: 96px; } .boss-override-grid, .boss-encounter-list { grid-template-columns: 1fr; } .boss-appearance-row, .boss-source-row { grid-template-columns: 1fr; } }
</style>
