<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from "naive-ui"
import { Plus, Trash2 } from "lucide-vue-next"
import { option } from "./maintenance-options"

defineOptions({ name: "ReleaseExpressionEditor" })
const props = defineProps<{ node: any, coreScaling?: any, disabled?: boolean, depth?: number }>()
const emit = defineEmits<{ change: [] }>()

const nodeTypeOptions = [
  option("constant", "常量"), option("triggerStat", "触发者属性"), option("coreSkillScaling", "核心技倍率表"), option("condition", "事件条件"),
  option("add", "相加"), option("subtract", "相减"), option("multiply", "相乘"), option("divide", "相除"),
  option("max", "取最大值"), option("min", "取最小值"), option("clamp", "限制范围"), option("floor", "向下取整"),
]
const unitOptions = [option("raw", "原始数值"), option("percent", "百分数"), option("decimal", "小数倍率")]
const whiteBoxRoleOptions = [option("", "不单独展示"), option("conversionSource", "转换数据来源")]
const panelOptions = [option("outOfCombat", "局外面板"), option("inCombat", "局内面板")]
const statOptions = [option("anomalyMastery", "异常掌控"), option("anomalyProficiency", "异常精通"), option("atk", "攻击力")]
const coreFieldLabels: Record<string, string> = {
  anomalyProficiencyFlat: "核心被动异常精通",
  releaseCoefficientPctByElement: "异放属性系数",
}
const coreFieldOptions = () => {
  const fields = new Set<string>()
  for (const row of props.coreScaling?.levels ?? []) {
    for (const key of Object.keys(row ?? {})) if (key !== "level") fields.add(key)
  }
  return [...fields].map(field => option(field, coreFieldLabels[field] ?? "核心技倍率字段"))
}

function nodeType() {
  return props.node.op || props.node.kind || "constant"
}

function replaceNode(type: string) {
  for (const key of Object.keys(props.node)) delete props.node[key]
  if (["add", "subtract", "multiply", "divide", "max", "min", "clamp", "floor"].includes(type)) {
    props.node.op = type
    const count = type === "floor" ? 1 : type === "clamp" ? 3 : 2
    props.node.args = Array.from({ length: count }, () => ({ kind: "constant", value: type === "multiply" ? 1 : 0, unit: "raw" }))
  } else if (type === "triggerStat") {
    Object.assign(props.node, { kind: type, panel: "outOfCombat", stat: "anomalyMastery", unit: "raw" })
  } else if (type === "coreSkillScaling") {
    Object.assign(props.node, { kind: type, field: coreFieldOptions()[0]?.value ?? "", key: "eventElement", unit: "percent" })
  } else if (type === "condition") {
    Object.assign(props.node, { kind: type, condition: "stunned", whenTrue: 1.5, whenFalse: 1, unit: "decimal" })
  } else {
    Object.assign(props.node, { kind: "constant", value: 1, unit: "raw" })
  }
  emit("change")
}

function addArgument() {
  props.node.args ??= []
  props.node.args.push({ kind: "constant", value: 0, unit: "raw" })
  emit("change")
}
</script>

<template>
  <div class="release-expression-node" :data-depth="depth ?? 0">
    <div class="maintenance-inline-row release-expression-head">
      <label class="maintenance-field"><span>节点类型</span><NSelect :value="nodeType()" :options="nodeTypeOptions" :disabled="disabled" @update:value="replaceNode(String($event))" /></label>
      <label class="maintenance-field"><span>说明标签</span><NInput :value="node.label?.zhCN ?? ''" :disabled="disabled" placeholder="自动生成" @update:value="node.label = $event ? { zhCN: String($event) } : undefined; emit('change')" /></label>
    </div>

    <div v-if="node.kind && !node.op" class="maintenance-inline-row release-expression-leaf">
      <label v-if="node.kind === 'constant'" class="maintenance-field"><span>数值</span><NInputNumber v-model:value="node.value" :disabled="disabled" :step="0.01" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'triggerStat'" class="maintenance-field"><span>面板</span><NSelect v-model:value="node.panel" :options="panelOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'triggerStat'" class="maintenance-field"><span>属性</span><NSelect v-model:value="node.stat" :options="statOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'coreSkillScaling'" class="maintenance-field"><span>倍率字段</span><NSelect filterable v-model:value="node.field" :options="coreFieldOptions()" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'coreSkillScaling'" class="maintenance-field"><span>取值键</span><NSelect v-model:value="node.key" :options="[option('eventElement', '事件伤害属性')]" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'condition'" class="maintenance-field"><span>条件</span><NSelect v-model:value="node.condition" :options="[option('stunned', '目标失衡')]" :disabled="disabled" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'condition'" class="maintenance-field"><span>满足时</span><NInputNumber v-model:value="node.whenTrue" :disabled="disabled" :step="0.01" @update:value="emit('change')" /></label>
      <label v-if="node.kind === 'condition'" class="maintenance-field"><span>不满足时</span><NInputNumber v-model:value="node.whenFalse" :disabled="disabled" :step="0.01" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>数值单位</span><NSelect v-model:value="node.unit" :options="unitOptions" :disabled="disabled" @update:value="emit('change')" /></label>
      <label class="maintenance-field"><span>白盒展示</span><NSelect :value="node.whiteBoxRole ?? ''" :options="whiteBoxRoleOptions" :disabled="disabled" @update:value="node.whiteBoxRole = $event || undefined; emit('change')" /></label>
    </div>

    <div v-if="node.op" class="release-expression-args">
      <div v-for="(arg, index) in node.args ?? []" :key="index" class="release-expression-arg">
        <ReleaseExpressionEditor :node="arg" :core-scaling="coreScaling" :disabled="disabled" :depth="(depth ?? 0) + 1" @change="emit('change')" />
        <NButton v-if="!['floor', 'clamp'].includes(node.op) && (node.args?.length ?? 0) > 2" quaternary type="error" :disabled="disabled" title="删除参数" @click="node.args.splice(index, 1); emit('change')"><template #icon><Trash2 :size="14" /></template></NButton>
      </div>
      <NButton v-if="!['floor', 'clamp'].includes(node.op)" size="tiny" :disabled="disabled" @click="addArgument"><template #icon><Plus :size="13" /></template>添加参数</NButton>
    </div>
  </div>
</template>

<style scoped>
.release-expression-node { border-left: 2px solid var(--border); padding-left: 10px; display: grid; gap: 8px; min-width: 0; }
.release-expression-head, .release-expression-leaf { align-items: end; }
.release-expression-args { display: grid; gap: 8px; }
.release-expression-arg { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 4px; }
</style>
