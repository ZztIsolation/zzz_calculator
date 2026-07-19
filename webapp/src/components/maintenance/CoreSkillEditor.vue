<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import { CORE_SKILL_LEVELS, option } from "./maintenance-options"
import { textOf } from "./maintenance-model"
import SourceListEditor from "./SourceListEditor.vue"

const props = defineProps<{ model: any, disabled?: boolean }>()
const emit = defineEmits<{ change: [] }>()

const levelOptions = [option("0", "0（未强化）"), ...CORE_SKILL_LEVELS.map(level => option(level, level))]
const targetOptions = [option("panel", "面板属性"), option("base", "基础属性")]
const coreStatOptions = [
  option("atkBase", "基础攻击力"), option("hpBase", "基础生命值"), option("defBase", "基础防御力"),
  option("critRate", "暴击率%"), option("critDmg", "暴击伤害%"), option("anomalyProficiency", "异常精通"),
  option("anomalyMasteryFlat", "固定异常掌控"), option("impactFlat", "固定冲击力"), option("sheerForceFlat", "固定贯穿力"),
]

const PARAM_LABELS: Record<string, string> = {
  frostburnBreakAtkMultiplier: "霜灼·破伤害倍率%", teamAnomalyBuildupPct: "全队异常积蓄效率%",
  selectedSkillDmgBonusPct: "指定技能伤害加成%", physicalAnomalyBuildupEfficiencyPct: "物理异常积蓄效率%",
  physicalAnomalyExtraDamageRatioPct: "物理异常额外伤害比例%", disorderMultiplierBonusPerRemainingSecondPct: "每剩余秒紊乱倍率加算%",
  disorderMultiplierBonusCapPct: "紊乱倍率加算上限%", polarizedAssaultBaseAssaultDamagePct: "极性强击基础伤害%",
  swordMeterMax: "剑意上限", ruptureDamage: "命破伤害说明",
}

function levels() {
  props.model.levels ??= []
  for (const level of CORE_SKILL_LEVELS) {
    if (!props.model.levels.some((item: any) => item.level === level)) props.model.levels.push({ level, label: `强化${level}`, stats: [], skillLevelBonuses: [] })
  }
  return props.model.levels as any[]
}

function sources() {
  props.model.sources ??= []
  return props.model.sources as string[]
}

function addStat(level: any) {
  level.stats ??= []
  level.stats.push({ stat: "atkBase", value: 0, mode: "flat", target: "base" })
  emit("change")
}

function addSkillBonus(level: any) {
  level.skillLevelBonuses ??= []
  level.skillLevelBonuses.push({ skill: "corePassive", value: 1 })
  emit("change")
}

function scalarEntries(value: any) {
  return Object.entries(value ?? {}).filter(([key, child]) => !["name", "levels", "defaultLevelAtCoreSkill"].includes(key) && ["string", "number", "boolean"].includes(typeof child))
}

function scalingParameters(row: any) {
  return Object.entries(row ?? {}).filter(([key, value]) => key !== "level" && ["string", "number", "boolean"].includes(typeof value))
}

function setScalar(parent: any, key: string, value: string | number | null) {
  parent[key] = typeof parent[key] === "number" ? Number(value ?? 0) : value
  emit("change")
}
</script>

<template>
  <div class="core-skill-editor">
    <div class="maintenance-grid">
      <label class="maintenance-field"><span>核心技名称</span><NInput :value="textOf(model.name)" :disabled="disabled" @update:value="model.name = { zhCN: String($event) }; emit('change')" /></label>
      <label class="maintenance-field"><span>默认等级</span><NSelect v-model:value="model.defaultLevel" :options="levelOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>最高等级</span><NSelect v-model:value="model.maxLevel" :options="levelOptions" :disabled="disabled" @update:value="emit('change')" /></label>
    </div>

    <details v-for="level in levels()" :key="level.level" class="maintenance-subcard core-level-card" :open="level.level === model.defaultLevel">
      <summary><strong>强化 {{ level.level }}</strong><span>{{ level.stats?.length ?? 0 }} 项属性 · {{ level.skillLevelBonuses?.length ?? 0 }} 项技能强化</span></summary>
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>显示名称</span><NInput v-model:value="level.label" :disabled="disabled" @update:value="emit('change')" /></label>
      </div>
      <div class="core-level-groups">
        <div>
          <div class="maintenance-row-head"><strong>属性强化</strong><NButton size="tiny" :disabled="disabled" @click="addStat(level)"><template #icon><Plus :size="13" /></template>添加</NButton></div>
          <div v-for="(stat, index) in level.stats ?? []" :key="index" class="maintenance-inline-row core-stat-row">
            <label class="maintenance-field"><span>属性</span><NSelect filterable v-model:value="stat.stat" :options="coreStatOptions" :disabled="disabled" @update:value="emit('change')" /></label>
            <label class="maintenance-field"><span>数值</span><NInputNumber v-model:value="stat.value" :disabled="disabled" :step="0.01" @update:value="emit('change')" /></label>
            <label class="maintenance-field"><span>作用位置</span><NSelect v-model:value="stat.target" :options="targetOptions" :disabled="disabled" @update:value="emit('change')" /></label>
            <NButton quaternary type="error" :disabled="disabled" title="删除属性强化" @click="level.stats.splice(index, 1); emit('change')"><template #icon><Trash2 :size="15" /></template></NButton>
          </div>
        </div>
        <div>
          <div class="maintenance-row-head"><strong>技能等级强化</strong><NButton size="tiny" :disabled="disabled" @click="addSkillBonus(level)"><template #icon><Plus :size="13" /></template>添加</NButton></div>
          <div v-for="(bonus, index) in level.skillLevelBonuses ?? []" :key="index" class="maintenance-inline-row core-bonus-row">
            <label class="maintenance-field"><span>技能</span><NSelect v-model:value="bonus.skill" :options="[option('corePassive', '核心被动')]" :disabled="disabled" @update:value="emit('change')" /></label>
            <label class="maintenance-field"><span>提升等级</span><NInputNumber v-model:value="bonus.value" :disabled="disabled" :step="1" @update:value="emit('change')" /></label>
            <NButton quaternary type="error" :disabled="disabled" title="删除技能等级强化" @click="level.skillLevelBonuses.splice(index, 1); emit('change')"><template #icon><Trash2 :size="15" /></template></NButton>
          </div>
        </div>
      </div>
    </details>

    <article v-if="model.corePassiveScaling" class="maintenance-subcard">
      <header class="maintenance-section-head"><div><h4>核心被动倍率</h4></div></header>
      <div class="maintenance-grid">
        <label class="maintenance-field"><span>名称</span><NInput :value="textOf(model.corePassiveScaling.name)" :disabled="disabled" @update:value="model.corePassiveScaling.name = { zhCN: String($event) }; emit('change')" /></label>
        <label class="maintenance-field"><span>对应核心技等级</span><NSelect v-model:value="model.corePassiveScaling.defaultLevelAtCoreSkill" :options="levelOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      </div>
      <div class="core-scaling-table-wrap">
        <table class="core-scaling-table">
          <tbody>
            <tr v-for="row in model.corePassiveScaling.levels ?? []" :key="row.level">
              <th>等级 {{ row.level }}</th>
              <td v-for="([key, value]) in scalingParameters(row)" :key="key"><label><span>{{ PARAM_LABELS[key] ?? key }}</span><NInputNumber v-if="typeof value === 'number'" :value="value" :disabled="disabled" @update:value="setScalar(row, key, $event)" /><NInput v-else :value="String(value)" :disabled="disabled" @update:value="setScalar(row, key, String($event))" /></label></td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <article v-if="model.corePassiveMechanics" class="maintenance-subcard">
      <header class="maintenance-section-head"><div><h4>角色特有扩展参数</h4><p>保留现有字段语义，按结构化数值或说明编辑。</p></div></header>
      <div class="maintenance-grid">
        <label v-for="([key, value]) in scalarEntries(model.corePassiveMechanics)" :key="key" class="maintenance-field"><span>{{ PARAM_LABELS[key] ?? key }}</span><NInputNumber v-if="typeof value === 'number'" :value="value" :disabled="disabled" @update:value="setScalar(model.corePassiveMechanics, key, $event)" /><NInput v-else type="textarea" :value="String(value)" :disabled="disabled" @update:value="setScalar(model.corePassiveMechanics, key, String($event))" /></label>
      </div>
    </article>

    <article class="maintenance-subcard">
      <header class="maintenance-section-head"><div><h4>核心技资料来源</h4></div></header>
      <SourceListEditor :sources="sources()" :disabled="disabled" @change="emit('change')" />
    </article>
  </div>
</template>
