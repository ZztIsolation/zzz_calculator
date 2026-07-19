<script setup lang="ts">
import { ref } from "vue"
import { NButton, NInput, NInputNumber, NSelect, NSwitch, NTag } from "naive-ui"
import { Plus, Settings2, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import MaintenanceSection from "../MaintenanceSection.vue"
import EffectRulesEditor from "../EffectRulesEditor.vue"
import CalculationEventsEditor from "../CalculationEventsEditor.vue"
import DefaultCalculationConfigModal from "../DefaultCalculationConfigModal.vue"
import CoreSkillEditor from "../CoreSkillEditor.vue"
import BuffModifiersEditor from "../BuffModifiersEditor.vue"
import SourceListEditor from "../SourceListEditor.vue"
import {
  ATTACK_TYPE_OPTIONS, ATTRIBUTE_OPTIONS, CORE_SKILL_LEVELS, DAMAGE_ELEMENT_OPTIONS, RARITY_OPTIONS, SCOPE_OPTIONS, SPECIALTY_OPTIONS,
  defaultCalculationEvent, option,
} from "../maintenance-options"
import { internalId, textOf } from "../maintenance-model"
import { SYSTEM_MANAGED_SKILL_GROUP_COUNTS } from "@core/maintenanceValidation.js"

const props = defineProps<{ model: any, catalog: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()
const showDefaultLoopModal = ref(false)
const showClearDefaultLoopConfirm = ref(false)

const LEVEL_FIELDS = [
  ["hpBase", "基础生命值"], ["atkBase", "基础攻击力"], ["defBase", "基础防御力"],
  ["critRate", "暴击率%"], ["critDmg", "暴击伤害%"], ["impact", "冲击力"],
  ["anomalyProficiency", "异常精通"], ["anomalyMastery", "异常掌控"],
  ["energyRegen", "能量自动回复%"], ["penRatio", "穿透率%"],
]

const MAIN_STAT_OPTIONS: Record<number, any[]> = {
  4: [option("critRate", "暴击率"), option("critDmg", "暴击伤害"), option("anomalyProficiency", "异常精通"), option("atkPct", "攻击力%"), option("hpPct", "生命值%"), option("defPct", "防御力%")],
  5: [option("physicalDmg", "物理伤害%"), option("fireDmg", "火属性伤害%"), option("iceDmg", "冰属性伤害%"), option("electricDmg", "电属性伤害%"), option("etherDmg", "以太伤害%"), option("windDmg", "风属性伤害%"), option("penRatio", "穿透率"), option("atkPct", "攻击力%"), option("hpPct", "生命值%"), option("defPct", "防御力%")],
  6: [option("anomalyMastery", "异常掌控"), option("energyRegen", "能量自动回复"), option("impact", "冲击力"), option("atkPct", "攻击力%"), option("hpPct", "生命值%"), option("defPct", "防御力%")],
}

function changed() { emit("change") }

function driveDiscOptions() {
  return [{ label: "不指定", value: "" }, ...(props.catalog?.driveDiscSets?.sets ?? []).map((item: any) => ({ label: textOf(item.name), value: item.id }))]
}

function addSkillGroup() {
  props.model.skillGroups.push({ id: internalId("skill_group"), name: { zhCN: `技能组${props.model.skillGroups.length + 1}` }, description: { zhCN: "" }, ...SYSTEM_MANAGED_SKILL_GROUP_COUNTS, events: [defaultCalculationEvent("direct")] })
  changed()
}

function calculationVariants() {
  const config = props.model.defaultCalculationConfig
  return config ? [config, ...(config.variants ?? [])] : []
}

function calculationModeOptions() {
  return [
    option("custom", "自定义"),
    props.model.specialty === "rupture" ? option("sheer", "最大化贯穿伤害") : option("single", "最大化单个技能伤害"),
    option("anomaly", "最大化异常伤害"),
  ]
}

function changeSpecialty(value: string) {
  props.model.specialty = value
  const allowed = new Set(calculationModeOptions().map(item => item.value))
  const fallback = value === "rupture" ? "sheer" : "single"
  for (const variant of calculationVariants()) if (!allowed.has(variant.mode)) variant.mode = fallback
  changed()
}

function applyDefaultCalculationConfig(value: any) {
  props.model.defaultCalculationConfig = value
  changed()
}

function clearDefaultCalculationConfig() {
  props.model.defaultCalculationConfig = null
  showClearDefaultLoopConfirm.value = false
  changed()
}

function defaultLoopLevels() {
  return calculationVariants().map((entry: any) => Number(entry.cinemaLevel ?? 0)).sort((a: number, b: number) => a - b)
}

function defaultLoopEventCount() {
  return calculationVariants().reduce((sum: number, entry: any) => sum + (entry.events?.length ?? 0), 0)
}

function setEffectSet(key: "corePassive" | "additionalAbility", enabled: boolean) {
  props.model.combatBuffs[key] = enabled
    ? { scope: "inCombat", name: { zhCN: key === "corePassive" ? "核心被动" : "额外能力" }, description: { zhCN: "" }, effects: [], buffModifiers: [] }
    : null
  changed()
}

function addCinemaBuff() {
  const used = new Set(props.model.combatBuffs.cinemaBuffs.map((item: any) => Number(item.cinemaLevel)))
  const level = [1, 2, 3, 4, 5, 6].find(value => !used.has(value)) ?? 1
  props.model.combatBuffs.cinemaBuffs.push({ cinemaLevel: level, cinemaName: { zhCN: "新影画" }, description: { zhCN: "" }, scope: "inCombat", defaultChecked: false, effects: [], buffModifiers: [] })
  changed()
}

function setBuffScope(buff: any, value: string) {
  buff.scope = value
  if (value !== "inCombat") for (const rule of buff.effects ?? []) delete rule.coverage
  changed()
}

function enableCoreSkill(enabled: boolean) {
  props.model.coreSkill = enabled ? {
    name: { zhCN: "核心技" }, defaultLevel: "F", maxLevel: "F",
    levels: CORE_SKILL_LEVELS.map(level => ({ level, label: `强化${level}`, stats: [], skillLevelBonuses: [{ skill: "corePassive", value: 1 }] })),
  } : null
  changed()
}
</script>

<template>
  <div class="resource-editor agent-editor">
    <MaintenanceSection title="基础信息">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>中文名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { ...model.name, zhCN: String($event) }; changed()" /></label>
        <label class="maintenance-field"><span>稀有度</span><NSelect v-model:value="model.rarity" :options="RARITY_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>属性</span><NSelect v-model:value="model.attribute" :options="ATTRIBUTE_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>伤害结算属性</span><NSelect v-model:value="model.damageElement" :options="[{ label: '同角色属性', value: '' }, ...DAMAGE_ELEMENT_OPTIONS]" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>特性</span><NSelect :value="model.specialty" :options="SPECIALTY_OPTIONS" :disabled="disabled" @update:value="changeSpecialty(String($event))" /></label>
        <label class="maintenance-field"><span>阵营</span><NInput v-model:value="model.faction" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>攻击类型</span><NSelect multiple clearable v-model:value="model.attackTypes" :options="ATTACK_TYPE_OPTIONS" :disabled="disabled" @update:value="changed" /></label>
        <label class="maintenance-field"><span>图片路径</span><NInput v-model:value="model.images.portrait" :disabled="disabled" placeholder="/assets/agents/..." @update:value="changed" /></label>
        <label class="maintenance-field"><span>图片来源</span><NInput v-model:value="model.images.source" :disabled="disabled" placeholder="https://..." @update:value="changed" /></label>
        <label class="maintenance-switch-field"><span>首页/优化器显示</span><NSwitch :value="model.hidden !== true" :disabled="disabled" @update:value="model.hidden = !$event; changed()" /></label>
      </div>
      <SourceListEditor :sources="model.sources" :disabled="disabled" @change="changed" />
    </MaintenanceSection>

    <MaintenanceSection title="60 级面板">
      <div class="maintenance-grid stat-number-grid">
        <label v-for="([key, label]) in LEVEL_FIELDS" :key="key" class="maintenance-field"><span>{{ label }}</span><NInputNumber v-model:value="model.level60[key]" :disabled="disabled" :step="0.01" @update:value="changed" /></label>
      </div>
    </MaintenanceSection>

    <MaintenanceSection title="优先驱动盘">
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>默认驱动盘套装</span><NSelect filterable clearable v-model:value="model.preferredDriveDiscs.defaultSetId" :options="driveDiscOptions()" :disabled="disabled" @update:value="changed" /></label>
        <label v-for="slot in [4, 5, 6]" :key="slot" class="maintenance-field"><span>{{ slot }} 号位主属性</span><NSelect multiple clearable v-model:value="model.preferredDriveDiscs.mainStatLimits[String(slot)]" :options="MAIN_STAT_OPTIONS[slot]" :disabled="disabled" @update:value="changed" /></label>
      </div>
    </MaintenanceSection>

    <MaintenanceSection title="技能组定义" description="定义“一变”“一大”等可复用技能组合；默认计算方式也可以把它作为一个事件加入。">
      <template #actions><NButton size="small" :disabled="disabled" @click="addSkillGroup"><template #icon><Plus :size="15" /></template>定义技能组</NButton></template>
      <article v-for="(group, groupIndex) in model.skillGroups" :key="group.id" class="maintenance-subcard skill-group-card">
        <header class="maintenance-section-head"><div><h4>{{ textOf(group.name) || `技能组 ${groupIndex + 1}` }}</h4></div><NButton quaternary type="error" :disabled="disabled" title="删除技能组" @click="model.skillGroups.splice(groupIndex, 1); changed()"><template #icon><Trash2 :size="16" /></template></NButton></header>
        <div class="maintenance-grid">
          <label class="maintenance-field"><span>名称</span><NInput :value="textOf(group.name)" :disabled="disabled" @update:value="group.name = { zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field maintenance-field-wide"><span>描述</span><NInput :value="textOf(group.description)" :disabled="disabled" @update:value="group.description = { zhCN: String($event) }; changed()" /></label>
        </div>
        <CalculationEventsEditor :events="group.events" :catalog="catalog" :agent="model" :skill-groups="model.skillGroups" :disabled="disabled" :allow-skill-group="false" @change="changed" />
      </article>
    </MaintenanceSection>

    <MaintenanceSection title="默认计算方式" description="按影画维护管理员默认循环；当前影画使用不超过该等级的最高已配置循环。">
      <template #actions>
        <div class="default-loop-section-actions">
          <NButton size="small" :disabled="disabled" @click="showDefaultLoopModal = true"><template #icon><Settings2 :size="15" /></template>{{ model.defaultCalculationConfig ? "管理默认循环" : "配置默认循环" }}</NButton>
          <NButton v-if="model.defaultCalculationConfig" circle quaternary size="small" type="error" :disabled="disabled" title="清空全部默认循环" aria-label="清空全部默认循环" @click="showClearDefaultLoopConfirm = true"><template #icon><Trash2 :size="15" /></template></NButton>
        </div>
      </template>
      <div class="default-loop-summary" :class="{ empty: !model.defaultCalculationConfig }">
        <div>
          <strong>{{ model.defaultCalculationConfig ? `已配置 ${calculationVariants().length} 套管理员默认循环` : "尚未配置管理员默认循环" }}</strong>
          <span v-if="model.defaultCalculationConfig">适用影画：{{ defaultLoopLevels().join("、") }} 影 · 共 {{ defaultLoopEventCount() }} 个事件</span>
          <span v-else>配置后可在优化器中按角色影画自动选择对应循环</span>
        </div>
        <div v-if="model.defaultCalculationConfig" class="default-loop-summary-tags">
          <NTag v-for="entry in calculationVariants()" :key="entry.cinemaLevel" round>{{ Number(entry.cinemaLevel ?? 0) }} 影 · {{ entry.events?.length ?? 0 }} 项</NTag>
        </div>
      </div>
    </MaintenanceSection>

    <MaintenanceSection v-for="entry in [{ key: 'corePassive', title: '核心被动 Buff' }, { key: 'additionalAbility', title: '额外能力 Buff' }]" :key="entry.key" :title="entry.title">
      <template #actions><NSwitch :value="Boolean(model.combatBuffs[entry.key])" :disabled="disabled" @update:value="setEffectSet(entry.key as any, $event)" /></template>
      <template v-if="model.combatBuffs[entry.key]">
        <div class="maintenance-grid">
          <label class="maintenance-field"><span>Buff 名称</span><NInput :value="textOf(model.combatBuffs[entry.key].name)" :disabled="disabled" @update:value="model.combatBuffs[entry.key].name = { zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field"><span>生效范围</span><NSelect :value="model.combatBuffs[entry.key].scope" :options="SCOPE_OPTIONS" :disabled="disabled" @update:value="setBuffScope(model.combatBuffs[entry.key], String($event))" /></label>
          <label class="maintenance-field maintenance-field-wide"><span>Buff 描述</span><NInput type="textarea" :value="textOf(model.combatBuffs[entry.key].description)" :disabled="disabled" @update:value="model.combatBuffs[entry.key].description = { zhCN: String($event) }; changed()" /></label>
        </div>
        <EffectRulesEditor :model="model.combatBuffs[entry.key]" :catalog="catalog" :disabled="disabled" :allow-coverage="model.combatBuffs[entry.key].scope === 'inCombat'" :preferred-skill-id="catalog?.agentSkills?.agentSkills?.find((skill: any) => skill.agentId === model.id)?.id" @change="changed" />
        <div class="buff-modifier-block"><div class="maintenance-row-head"><strong>Buff 修饰</strong></div><BuffModifiersEditor :model="model.combatBuffs[entry.key]" :catalog="catalog" :disabled="disabled" @change="changed" /></div>
      </template>
    </MaintenanceSection>

    <MaintenanceSection title="影画 Buff" description="只新增已经建模的影画，不会自动补齐空影画。">
      <template #actions><NButton size="small" :disabled="disabled" @click="addCinemaBuff"><template #icon><Plus :size="15" /></template>添加影画 Buff</NButton></template>
      <article v-for="(buff, index) in model.combatBuffs.cinemaBuffs" :key="buff.id ?? index" class="maintenance-subcard cinema-buff-card">
        <header class="maintenance-section-head"><div><h4>影画 Buff {{ index + 1 }}</h4></div><NButton quaternary type="error" :disabled="disabled" title="删除影画 Buff" @click="model.combatBuffs.cinemaBuffs.splice(index, 1); changed()"><template #icon><Trash2 :size="16" /></template></NButton></header>
        <div class="maintenance-grid">
          <label class="maintenance-field"><span>第几个影画</span><NSelect v-model:value="buff.cinemaLevel" :options="[1,2,3,4,5,6].map(level => option(level, `影画 ${level}`))" :disabled="disabled" @update:value="changed" /></label>
          <label class="maintenance-field"><span>影画名称</span><NInput :value="textOf(buff.cinemaName)" :disabled="disabled" @update:value="buff.cinemaName = { zhCN: String($event) }; changed()" /></label>
          <label class="maintenance-field"><span>生效范围</span><NSelect :value="buff.scope" :options="SCOPE_OPTIONS" :disabled="disabled" @update:value="setBuffScope(buff, String($event))" /></label>
          <label class="maintenance-switch-field"><span>默认启用</span><NSwitch v-model:value="buff.defaultChecked" :disabled="disabled" @update:value="changed" /></label>
          <label class="maintenance-field maintenance-field-wide"><span>Buff 描述</span><NInput type="textarea" :value="textOf(buff.description)" :disabled="disabled" @update:value="buff.description = { zhCN: String($event) }; changed()" /></label>
        </div>
        <EffectRulesEditor :model="buff" :catalog="catalog" :disabled="disabled" :allow-coverage="buff.scope === 'inCombat'" @change="changed" />
        <div class="buff-modifier-block"><div class="maintenance-row-head"><strong>Buff 修饰</strong></div><BuffModifiersEditor :model="buff" :catalog="catalog" :disabled="disabled" @change="changed" /></div>
      </article>
    </MaintenanceSection>

    <MaintenanceSection title="核心技">
      <template #actions><NSwitch :value="Boolean(model.coreSkill)" :disabled="disabled" @update:value="enableCoreSkill" /></template>
      <CoreSkillEditor v-if="model.coreSkill" :model="model.coreSkill" :disabled="disabled" @change="changed" />
    </MaintenanceSection>
  </div>

  <DefaultCalculationConfigModal
    v-model:show="showDefaultLoopModal"
    :config="model.defaultCalculationConfig"
    :catalog="catalog"
    :agent="model"
    :skill-groups="model.skillGroups"
    :disabled="disabled"
    @apply="applyDefaultCalculationConfig"
  />
  <ConfirmDialog
    v-model:show="showClearDefaultLoopConfirm"
    title="清空默认循环"
    message="确认清空该角色的全部管理员默认循环？保存角色资料后此操作才会写入数据文件。"
    confirm-text="清空"
    danger
    @confirm="clearDefaultCalculationConfig"
  />
</template>

<style scoped>
.default-loop-section-actions { display: flex; align-items: center; gap: 6px; }
.default-loop-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 68px; padding: 13px 14px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-panel-muted); }
.default-loop-summary.empty { border-style: dashed; background: #fff; }
.default-loop-summary > div:first-child { display: grid; min-width: 0; gap: 4px; }
.default-loop-summary strong { font-size: 14px; }
.default-loop-summary span { color: var(--app-muted); font-size: 12px; line-height: 1.5; }
.default-loop-summary-tags { display: flex; flex: 0 1 auto; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
@container ui-layout (max-width: 680px) {
  .default-loop-summary { align-items: flex-start; flex-direction: column; }
  .default-loop-summary-tags { justify-content: flex-start; }
}
</style>
