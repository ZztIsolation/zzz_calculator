<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
import { Check, ChevronDown, Search, Sparkles } from "lucide-vue-next"
import type { LabWorkbenchApi } from "@/lab/useLabWorkbench"
import { thumbnailForAgent, thumbnailForWEngine } from "@/utils/assets"
import {
  formatStoredStatValue,
  labelOf,
  storedStatLabel,
  textOf,
} from "@/utils/format"

const props = defineProps<{
  lab: LabWorkbenchApi
}>()

const SPECIALTY_ORDER = ["attack", "stun", "anomaly", "support", "defense", "rupture", "armorer"]
const RARITY_ORDER: Record<string, number> = { S: 0, A: 1, B: 2 }

const SPECIALTY_LABELS: Record<string, string> = {
  attack: "强攻",
  stun: "击破",
  anomaly: "异常",
  support: "支援",
  defense: "防护",
  rupture: "命破",
  armorer: "锋御",
}

const ELEMENT_LABELS: Record<string, string> = {
  ice: "冰",
  fire: "火",
  electric: "电",
  physical: "物理",
  ether: "以太",
  wind: "风",
  lumiflux: "耀变",
}

const openPicker = ref<"agent" | "wEngine" | null>(null)
const agentSpecialtyHover = ref("")
const wEngineSpecialtyHover = ref("")
const agentSearch = ref("")
const wEngineSearch = ref("")

const agentPickerRootRef = ref<HTMLElement | null>(null)
const wEnginePickerRootRef = ref<HTMLElement | null>(null)
const agentSearchInputRef = ref<HTMLInputElement | null>(null)
const wEngineSearchInputRef = ref<HTMLInputElement | null>(null)

function agentElement(agent: any): string {
  return String(agent?.damageElement ?? agent?.attribute ?? "physical")
}

function specialtyLabel(value: unknown): string {
  const key = String(value ?? "").trim()
  return SPECIALTY_LABELS[key] ?? (key || "其他")
}

function rarityText(value: unknown): string {
  const r = String(value ?? "").trim().toUpperCase()
  return r ? `${r}级` : ""
}

function isRecommendedWEngine(wEngine: any): boolean {
  const agent = props.lab.selectedAgent.value
  if (!agent || !wEngine) return false
  if (String(wEngine.relatedAgentId ?? "") === String(agent.id)) return true
  if (String(agent.signatureWEngineId ?? "") === String(wEngine.id ?? "")) return true
  const ownerIds = Array.isArray(wEngine.signatureAgentIds) ? wEngine.signatureAgentIds : []
  return ownerIds.includes(agent.id) || String(wEngine.signatureAgentId ?? "") === String(agent.id)
}

function orderedSpecialties(keys: Iterable<string>, preferredSpecialty = ""): string[] {
  const existing = new Set<string>(keys)
  const ordered = [
    ...(preferredSpecialty && existing.has(preferredSpecialty) ? [preferredSpecialty] : []),
    ...SPECIALTY_ORDER.filter(s => existing.has(s)),
    ...[...existing].filter(s => s && !SPECIALTY_ORDER.includes(s)),
    ...(existing.has("") ? [""] : []),
  ]
  return [...new Set(ordered)]
}

// Group agents by specialty (职业), putting the current agent's specialty first
const agentGroups = computed(() => {
  const bySpec = new Map<string, any[]>()
  for (const agent of props.lab.catalogStore.displayAgents) {
    const spec = String(agent?.specialty ?? "").trim()
    const bucket = bySpec.get(spec) ?? []
    bucket.push(agent)
    bySpec.set(spec, bucket)
  }
  const currentSpec = String(props.lab.selectedAgent.value?.specialty ?? "").trim()
  return orderedSpecialties(bySpec.keys(), currentSpec).map(spec => ({
    key: spec,
    label: specialtyLabel(spec),
    items: bySpec.get(spec) ?? [],
  }))
})

const visibleAgentItems = computed(() => {
  const q = agentSearch.value.trim().toLowerCase()
  if (q) {
    return props.lab.catalogStore.displayAgents.filter((agent: any) => {
      const hay = `${labelOf(agent)} ${specialtyLabel(agent?.specialty)} ${ELEMENT_LABELS[agentElement(agent)] ?? ""} ${agent?.id ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }
  const targetKey = agentSpecialtyHover.value || agentGroups.value[0]?.key || ""
  return agentGroups.value.find(g => g.key === targetKey)?.items ?? []
})

// Group W-Engines by specialty (职业), recommended first then S -> A -> B
const wEngineGroups = computed(() => {
  const bySpec = new Map<string, any[]>()
  for (const engine of props.lab.catalogStore.displayWEngines) {
    const spec = String(engine?.specialty ?? "").trim()
    const bucket = bySpec.get(spec) ?? []
    bucket.push(engine)
    bySpec.set(spec, bucket)
  }
  const currentSpec = String(props.lab.selectedAgent.value?.specialty ?? "").trim()
  return orderedSpecialties(bySpec.keys(), currentSpec).map(spec => {
    const items = (bySpec.get(spec) ?? [])
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) =>
        Number(isRecommendedWEngine(b.item)) - Number(isRecommendedWEngine(a.item))
        || (RARITY_ORDER[String(a.item.rarity ?? "").toUpperCase()] ?? 3) - (RARITY_ORDER[String(b.item.rarity ?? "").toUpperCase()] ?? 3)
        || a.idx - b.idx,
      )
      .map(entry => entry.item)
    return {
      key: spec,
      label: specialtyLabel(spec),
      items,
    }
  })
})

const visibleWEngineItems = computed(() => {
  const q = wEngineSearch.value.trim().toLowerCase()
  if (q) {
    return wEngineGroups.value
      .flatMap(g => g.items)
      .filter((engine: any) => {
        const hay = `${labelOf(engine)} ${specialtyLabel(engine?.specialty)} ${engine?.id ?? ""}`.toLowerCase()
        return hay.includes(q)
      })
  }
  const targetKey = wEngineSpecialtyHover.value || wEngineGroups.value[0]?.key || ""
  return wEngineGroups.value.find(g => g.key === targetKey)?.items ?? []
})

// Full W-Engine catalog record for 60-level spec readout (Base ATK + Advanced Stat)
const fullWEngineRecord = computed(() => {
  const id = props.lab.buildStore.wEngineId
  if (!id) return null
  return (props.lab.catalogStore.catalog?.wEngines ?? []).find((w: any) => w?.id === id)
    ?? props.lab.selectedWEngine.value
})

function wEngineSpecSummary(engine: any): { atk: string, advLabel: string, advVal: string, effectName: string } | null {
  const rec = (props.lab.catalogStore.catalog?.wEngines ?? []).find((w: any) => w?.id === engine?.id) ?? engine
  if (!rec) return null
  const atkBase = rec.level60?.atkBase
  const adv = rec.level60?.advancedStat
  const advLabel = adv?.stat ? storedStatLabel(adv.stat, adv.mode, props.lab.catalogStore.meta) : ""
  const advVal = adv?.stat ? formatStoredStatValue(adv.stat, adv.value, adv.mode) : ""
  const effectName = textOf(rec.effect?.name) || ""
  if (!atkBase && !advLabel) return null
  return {
    atk: atkBase ? String(atkBase) : "—",
    advLabel: advLabel || "高级属性",
    advVal: advVal || "—",
    effectName,
  }
}

const activeWEngineSpec = computed(() => wEngineSpecSummary(fullWEngineRecord.value))

const coreSkillOptions = computed(() => {
  const levels = props.lab.selectedAgent.value?.coreSkill?.levels ?? []
  return [
    { label: "无", value: "none" },
    ...levels.map((level: any) => ({
      label: String(level.level),
      value: level.level,
    })),
  ]
})

const hasPotentialVision = computed(() => {
  const levels = props.lab.selectedAgent.value?.potentialVision?.levels
  return Array.isArray(levels) && levels.length > 0
})

const wEngineModLevels = computed(() => {
  const mod = props.lab.selectedWEngine.value?.modification ?? {}
  const min = Number.isInteger(Number(mod.minLevel)) ? Number(mod.minLevel) : 1
  const max = Number.isInteger(Number(mod.maxLevel)) ? Number(mod.maxLevel) : 5
  const out: number[] = []
  for (let i = min; i <= Math.max(min, max); i++) out.push(i)
  return out
})

async function togglePicker(kind: "agent" | "wEngine") {
  if (openPicker.value === kind) {
    openPicker.value = null
    return
  }
  openPicker.value = kind
  if (kind === "agent") {
    agentSearch.value = ""
    agentSpecialtyHover.value = String(props.lab.selectedAgent.value?.specialty ?? agentGroups.value[0]?.key ?? "")
    await nextTick()
    agentSearchInputRef.value?.focus()
  } else {
    wEngineSearch.value = ""
    wEngineSpecialtyHover.value = String(props.lab.selectedWEngine.value?.specialty ?? props.lab.selectedAgent.value?.specialty ?? wEngineGroups.value[0]?.key ?? "")
    await nextTick()
    wEngineSearchInputRef.value?.focus()
  }
}

function chooseAgent(agentId: string) {
  props.lab.selectAgent(agentId)
  openPicker.value = null
}

function chooseWEngine(wEngineId: string) {
  props.lab.buildStore.selectWEngine(wEngineId, props.lab.catalogStore.meta)
  openPicker.value = null
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!openPicker.value) return
  const target = event.target as Node | null
  if (!target) return
  if (openPicker.value === "agent" && agentPickerRootRef.value?.contains(target)) return
  if (openPicker.value === "wEngine" && wEnginePickerRootRef.value?.contains(target)) return
  openPicker.value = null
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && openPicker.value) {
    openPicker.value = null
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleDocumentPointerDown)
  document.addEventListener("keydown", handleDocumentKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleDocumentPointerDown)
  document.removeEventListener("keydown", handleDocumentKeyDown)
})

function skillPresetTarget(control: { options: { value: any }[] }, target: number | "max") {
  const vals = control.options.map(o => Number(o.value)).filter(Number.isFinite)
  if (!vals.length) return null
  if (target === "max") return Math.max(...vals)
  return vals.reduce((best, val) => (Math.abs(val - target) < Math.abs(best - target) ? val : best), vals[0]!)
}

function isSkillPresetActive(target: number | "max") {
  const controls = props.lab.skillLevelControls.value
  return controls.length > 0 && controls.every(c => Number(c.value) === skillPresetTarget(c, target))
}

function applySkillPreset(target: number | "max") {
  const levels: Record<string, number> = {}
  for (const c of props.lab.skillLevelControls.value) {
    const val = skillPresetTarget(c, target)
    if (val !== null) levels[c.id] = val
  }
  props.lab.buildStore.updateSkillLevels(levels)
}

function stepSkill(control: { id: string, value: number, options: { value: any }[] }, delta: number) {
  const vals = control.options.map(o => Number(o.value)).filter(Number.isFinite)
  const idx = vals.indexOf(Number(control.value))
  if (idx < 0) return
  const next = vals[Math.max(0, Math.min(vals.length - 1, idx + delta))]
  if (next !== undefined && next !== Number(control.value)) {
    props.lab.buildStore.updateSkillLevel(control.id, next)
  }
}
</script>

<template>
  <section id="lab-chapter-agent" class="lab-chapter">
    <header class="lab-chapter-head ch1-head">
      <div class="ch1-head-copy">
        <div class="lab-chapter-kicker">CH.01 // AGENT &amp; W-ENGINE</div>
        <div class="ch1-head-title-line">
          <h2 class="lab-chapter-title">代理人与武装校准</h2>
          <span class="ch1-head-hint">点击代理人或音擎卡片可按职业级联切换</span>
        </div>
      </div>
    </header>

    <div class="lab-chapter-body ch1-body">
      <!-- Twin Horizontal Plates: Left Agent | Right W-Engine -->
      <div class="ch1-twin-grid">
        <!-- LEFT PLATE: AGENT -->
        <div
          ref="agentPickerRootRef"
          class="lab-subplate ch1-card"
          :class="lab.selectedAgent.value ? `el-${agentElement(lab.selectedAgent.value)}` : ''"
        >
          <div class="ch1-selector-bar">
            <button
              type="button"
              class="ch1-selector-trigger"
              :class="{ 'is-open': openPicker === 'agent' }"
              :aria-expanded="openPicker === 'agent'"
              data-testid="lab-agent-trigger"
              @click="togglePicker('agent')"
            >
              <span class="ch1-el-stripe" aria-hidden="true"></span>
              <img
                v-if="lab.selectedAgent.value"
                class="ch1-trigger-avatar"
                :src="thumbnailForAgent(lab.selectedAgent.value)"
                :alt="labelOf(lab.selectedAgent.value)"
              />
              <div class="ch1-trigger-copy">
                <div class="ch1-trigger-name-row">
                  <strong>{{ lab.selectedAgent.value ? labelOf(lab.selectedAgent.value) : "选择代理人" }}</strong>
                  <span v-if="lab.selectedAgent.value" class="ch1-el-badge">
                    {{ ELEMENT_LABELS[agentElement(lab.selectedAgent.value)] }}
                  </span>
                </div>
                <span v-if="lab.selectedAgent.value" class="ch1-trigger-meta">
                  {{ specialtyLabel(lab.selectedAgent.value.specialty) }}
                  <template v-if="rarityText(lab.selectedAgent.value.rarity)"> · {{ rarityText(lab.selectedAgent.value.rarity) }}</template>
                </span>
              </div>
              <span class="ch1-switch-cue">
                <span>切换</span>
                <ChevronDown :size="14" class="ch1-chevron" :class="{ 'is-open': openPicker === 'agent' }" />
              </span>
            </button>

            <label class="ch1-lv-pill">
              <span class="lab-mono">LV</span>
              <input
                :value="lab.buildStore.agentLevel"
                type="number"
                min="1"
                max="60"
                class="lab-mono ch1-lv-num"
                aria-label="代理人等级"
                @change="lab.buildStore.agentLevel = Math.max(1, Math.min(60, Number(($event.target as HTMLInputElement).value) || 60))"
              />
            </label>
          </div>

          <!-- Floating Dual-Pane Specialty Cascader for Agents -->
          <div v-if="openPicker === 'agent'" class="ch1-popover" role="dialog" aria-label="按职业选择代理人">
            <div class="ch1-pop-search">
              <Search :size="14" class="ch1-pop-search-icon" />
              <input
                ref="agentSearchInputRef"
                v-model="agentSearch"
                type="text"
                class="lab-input ch1-pop-search-input"
                placeholder="搜索代理人、职业或属性…"
              />
            </div>

            <div class="ch1-pop-split" :class="{ 'is-search': Boolean(agentSearch.trim()) }">
              <div v-if="!agentSearch.trim()" class="ch1-pop-specs" role="listbox" aria-label="代理人职业">
                <button
                  v-for="group in agentGroups"
                  :key="group.key"
                  type="button"
                  class="ch1-pop-spec-btn"
                  :class="{ 'is-active': (agentSpecialtyHover || agentGroups[0]?.key) === group.key }"
                  @mouseenter="agentSpecialtyHover = group.key"
                  @focus="agentSpecialtyHover = group.key"
                  @click="agentSpecialtyHover = group.key"
                >
                  <span>{{ group.label }}</span>
                  <em class="lab-mono">{{ group.items.length }}</em>
                </button>
              </div>

              <div class="ch1-pop-items">
                <button
                  v-for="agent in visibleAgentItems"
                  :key="agent.id"
                  type="button"
                  class="ch1-pop-item"
                  :class="[`el-${agentElement(agent)}`, { 'is-selected': lab.buildStore.agentId === agent.id }]"
                  @click="chooseAgent(agent.id)"
                >
                  <img :src="thumbnailForAgent(agent)" :alt="labelOf(agent)" class="ch1-pop-avatar" />
                  <div class="ch1-pop-item-copy">
                    <strong>{{ labelOf(agent) }}</strong>
                    <span>
                      {{ specialtyLabel(agent.specialty) }} · {{ ELEMENT_LABELS[agentElement(agent)] ?? agentElement(agent) }}
                      <template v-if="rarityText(agent.rarity)"> · {{ rarityText(agent.rarity) }}</template>
                    </span>
                  </div>
                  <Check v-if="lab.buildStore.agentId === agent.id" :size="14" class="ch1-pop-check" />
                </button>
                <div v-if="!visibleAgentItems.length" class="ch1-pop-empty">没有匹配的代理人</div>
              </div>
            </div>
          </div>

          <!-- Tactile Agent Calibration Keys -->
          <div class="ch1-keys-block">
            <div class="ch1-key-row">
              <span class="ch1-key-label">影画 <em class="lab-mono">M{{ lab.buildStore.cinemaLevel }}</em></span>
              <div class="ch1-key-strip">
                <button
                  v-for="lvl in [0, 1, 2, 3, 4, 5, 6]"
                  :key="lvl"
                  type="button"
                  class="ch1-key"
                  :class="{ 'is-active': lab.buildStore.cinemaLevel === lvl }"
                  @click="lab.buildStore.setCinemaLevel(lvl, lab.catalogStore.meta)"
                >
                  {{ lvl }}
                </button>
              </div>
            </div>

            <div class="ch1-key-row">
              <span class="ch1-key-label">核心技 <em class="lab-mono">{{ lab.buildStore.coreSkillLevel === "none" ? "无" : lab.buildStore.coreSkillLevel }}</em></span>
              <div class="ch1-key-strip">
                <button
                  v-for="opt in coreSkillOptions"
                  :key="String(opt.value)"
                  type="button"
                  class="ch1-key"
                  :class="{ 'is-active': String(lab.buildStore.coreSkillLevel) === String(opt.value) }"
                  @click="lab.buildStore.coreSkillLevel = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div v-if="hasPotentialVision" class="ch1-key-row">
              <span class="ch1-key-label">潜能 <em class="lab-mono">P{{ lab.buildStore.potentialLevel }}</em></span>
              <div class="ch1-key-strip">
                <button
                  v-for="lvl in [0, 1, 2, 3, 4, 5, 6]"
                  :key="lvl"
                  type="button"
                  class="ch1-key"
                  :class="{ 'is-active': lab.buildStore.potentialLevel === lvl }"
                  @click="lab.buildStore.setPotentialLevel(lvl, lab.catalogStore.meta)"
                >
                  {{ lvl }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT PLATE: W-ENGINE -->
        <div ref="wEnginePickerRootRef" class="lab-subplate ch1-card">
          <div class="ch1-selector-bar">
            <button
              type="button"
              class="ch1-selector-trigger"
              :class="{ 'is-open': openPicker === 'wEngine' }"
              :aria-expanded="openPicker === 'wEngine'"
              data-testid="lab-wengine-trigger"
              @click="togglePicker('wEngine')"
            >
              <img
                v-if="lab.selectedWEngine.value"
                class="ch1-trigger-avatar ch1-trigger-avatar--engine"
                :src="thumbnailForWEngine(lab.selectedWEngine.value)"
                :alt="labelOf(lab.selectedWEngine.value)"
              />
              <div class="ch1-trigger-copy">
                <div class="ch1-trigger-name-row">
                  <strong>{{ lab.selectedWEngine.value ? labelOf(lab.selectedWEngine.value) : "选择音擎" }}</strong>
                  <span v-if="isRecommendedWEngine(lab.selectedWEngine.value)" class="ch1-sig-badge">
                    <Sparkles :size="10" /> 专武
                  </span>
                </div>
                <span v-if="lab.selectedWEngine.value" class="ch1-trigger-meta">
                  {{ specialtyLabel(lab.selectedWEngine.value.specialty) }}
                  <template v-if="rarityText(lab.selectedWEngine.value.rarity)"> · {{ rarityText(lab.selectedWEngine.value.rarity) }}</template>
                </span>
              </div>
              <span class="ch1-switch-cue">
                <span>切换</span>
                <ChevronDown :size="14" class="ch1-chevron" :class="{ 'is-open': openPicker === 'wEngine' }" />
              </span>
            </button>

            <label class="ch1-lv-pill">
              <span class="lab-mono">LV</span>
              <input
                :value="lab.buildStore.wEngineLevel"
                type="number"
                min="1"
                max="60"
                class="lab-mono ch1-lv-num"
                aria-label="音擎等级"
                @change="lab.buildStore.wEngineLevel = Math.max(1, Math.min(60, Number(($event.target as HTMLInputElement).value) || 60))"
              />
            </label>
          </div>

          <!-- Floating Dual-Pane Specialty Cascader for W-Engines -->
          <div v-if="openPicker === 'wEngine'" class="ch1-popover ch1-popover--right" role="dialog" aria-label="按职业选择音擎">
            <div class="ch1-pop-search">
              <Search :size="14" class="ch1-pop-search-icon" />
              <input
                ref="wEngineSearchInputRef"
                v-model="wEngineSearch"
                type="text"
                class="lab-input ch1-pop-search-input"
                placeholder="搜索音擎名称或职业…"
              />
            </div>

            <div class="ch1-pop-split" :class="{ 'is-search': Boolean(wEngineSearch.trim()) }">
              <div v-if="!wEngineSearch.trim()" class="ch1-pop-specs" role="listbox" aria-label="音擎职业">
                <button
                  v-for="group in wEngineGroups"
                  :key="group.key"
                  type="button"
                  class="ch1-pop-spec-btn"
                  :class="{ 'is-active': (wEngineSpecialtyHover || wEngineGroups[0]?.key) === group.key }"
                  @mouseenter="wEngineSpecialtyHover = group.key"
                  @focus="wEngineSpecialtyHover = group.key"
                  @click="wEngineSpecialtyHover = group.key"
                >
                  <span>{{ group.label }}</span>
                  <em class="lab-mono">{{ group.items.length }}</em>
                </button>
              </div>

              <div class="ch1-pop-items">
                <button
                  v-for="engine in visibleWEngineItems"
                  :key="engine.id"
                  type="button"
                  class="ch1-pop-item"
                  :class="{ 'is-selected': lab.buildStore.wEngineId === engine.id }"
                  @click="chooseWEngine(engine.id)"
                >
                  <img :src="thumbnailForWEngine(engine)" :alt="labelOf(engine)" class="ch1-pop-avatar ch1-pop-avatar--engine" />
                  <div class="ch1-pop-item-copy">
                    <div class="ch1-pop-name-line">
                      <strong>{{ labelOf(engine) }}</strong>
                      <span v-if="isRecommendedWEngine(engine)" class="ch1-sig-badge">推荐</span>
                    </div>
                    <span>
                      {{ specialtyLabel(engine.specialty) }}
                      <template v-if="rarityText(engine.rarity)"> · {{ rarityText(engine.rarity) }}</template>
                      <template v-if="wEngineSpecSummary(engine)">
                        · {{ wEngineSpecSummary(engine)?.advLabel }} {{ wEngineSpecSummary(engine)?.advVal }}
                      </template>
                    </span>
                  </div>
                  <Check v-if="lab.buildStore.wEngineId === engine.id" :size="14" class="ch1-pop-check" />
                </button>
                <div v-if="!visibleWEngineItems.length" class="ch1-pop-empty">没有匹配的音擎</div>
              </div>
            </div>
          </div>

          <!-- Tactile W-Engine Modification + Spec Readout -->
          <div class="ch1-keys-block">
            <div class="ch1-key-row">
              <span class="ch1-key-label">精修 <em class="lab-mono">R{{ lab.buildStore.wEngineModificationLevel }}</em></span>
              <div class="ch1-key-strip ch1-key-strip--5">
                <button
                  v-for="mod in wEngineModLevels"
                  :key="mod"
                  type="button"
                  class="ch1-key"
                  :class="{ 'is-active': lab.buildStore.wEngineModificationLevel === mod }"
                  @click="lab.buildStore.wEngineModificationLevel = mod"
                >
                  {{ mod }}
                </button>
              </div>
            </div>

            <div v-if="activeWEngineSpec" class="ch1-engine-spec-strip">
              <div class="ch1-spec-pill">
                <span>基础攻击</span>
                <strong class="lab-mono">{{ activeWEngineSpec.atk }}</strong>
              </div>
              <div class="ch1-spec-pill">
                <span>{{ activeWEngineSpec.advLabel }}</span>
                <strong class="lab-mono">{{ activeWEngineSpec.advVal }}</strong>
              </div>
              <div v-if="activeWEngineSpec.effectName" class="ch1-spec-pill ch1-spec-pill--effect" :title="activeWEngineSpec.effectName">
                <span>特效</span>
                <strong>{{ activeWEngineSpec.effectName }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Compact Single-Row Skill Level Calibration Bar -->
      <div class="ch1-skill-bar">
        <div class="ch1-skill-head">
          <span class="lab-subplate-label">招式等级 <em>SKILL LEVELS</em></span>
          <div class="lab-chip-row">
            <button
              type="button"
              class="lab-chip ch1-preset-chip"
              :class="{ 'is-active': isSkillPresetActive(12) }"
              @click="applySkillPreset(12)"
            >
              全 Lv.12
            </button>
            <button
              type="button"
              class="lab-chip ch1-preset-chip"
              :class="{ 'is-active': isSkillPresetActive('max') }"
              @click="applySkillPreset('max')"
            >
              全满级
            </button>
          </div>
        </div>

        <div class="ch1-skill-grid">
          <div v-for="ctrl in lab.skillLevelControls.value" :key="ctrl.id" class="ch1-skill-cell">
            <span class="ch1-skill-name">{{ ctrl.label }}</span>
            <div class="ch1-stepper">
              <button type="button" aria-label="降一级" @click="stepSkill(ctrl, -1)">−</button>
              <strong class="lab-mono">{{ ctrl.value }}</strong>
              <button type="button" aria-label="升一级" @click="stepSkill(ctrl, 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ch1-head {
  padding: 13px 18px 11px;
}

.ch1-head-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ch1-head-title-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.ch1-head-hint {
  font-size: 12px;
  color: var(--lab-muted);
}

.ch1-body {
  padding: 14px 18px 16px;
  gap: 12px;
}

.ch1-twin-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.ch1-card {
  position: relative;
  padding: 11px 12px;
  gap: 10px;
  justify-content: space-between;
}

.ch1-selector-bar {
  display: flex;
  align-items: stretch;
  gap: 7px;
  min-width: 0;
}

.ch1-selector-trigger {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px 7px 12px;
  border-radius: var(--lab-radius-sm);
  border: 1px solid var(--lab-line-strong);
  background: var(--lab-paper);
  text-align: left;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
  overflow: hidden;
}

.ch1-selector-trigger:hover,
.ch1-selector-trigger.is-open {
  border-color: var(--lab-ink);
  box-shadow: 0 2px 10px -4px rgba(18, 19, 22, 0.16);
}

.ch1-selector-trigger.is-open {
  border-color: var(--lab-accent);
}

.ch1-el-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--el-color, var(--lab-ink));
}

.ch1-trigger-avatar {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--lab-well);
  border: 1px solid var(--lab-line);
  flex: 0 0 auto;
}

.ch1-trigger-avatar--engine {
  object-fit: contain;
  padding: 3px;
  background: var(--lab-paper-soft);
}

.ch1-trigger-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ch1-trigger-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ch1-trigger-name-row strong {
  font-size: 15px;
  font-weight: 800;
  color: var(--lab-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-el-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-soft, var(--lab-well));
  color: var(--el-color, var(--lab-ink-2));
  flex: 0 0 auto;
}

.ch1-sig-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--lab-accent-soft);
  color: var(--lab-accent);
  flex: 0 0 auto;
}

.ch1-trigger-meta {
  font-size: 11.5px;
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-switch-cue {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--lab-paper-soft);
  border: 1px solid var(--lab-line);
  font-size: 11px;
  font-weight: 700;
  color: var(--lab-ink-2);
  flex: 0 0 auto;
}

.ch1-chevron {
  transition: transform 0.15s ease;
}

.ch1-chevron.is-open {
  transform: rotate(180deg);
}

.ch1-lv-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 56px;
  padding: 4px 5px;
  border-radius: var(--lab-radius-sm);
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  flex: 0 0 auto;
}

.ch1-lv-pill span {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--lab-muted);
  line-height: 1;
}

.ch1-lv-num {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: center;
  font-size: 14px;
  font-weight: 800;
  color: var(--lab-ink);
  outline: none;
  padding: 0;
}

/* ==========================================================================
   Floating Dual-Pane Specialty Cascader Popover
   ========================================================================== */

.ch1-popover {
  position: absolute;
  top: 72px;
  left: 0;
  z-index: 60;
  width: min(500px, calc(100vw - 40px));
  background: var(--lab-paper);
  border: 1px solid var(--lab-line-ink);
  border-radius: var(--lab-radius);
  box-shadow: var(--lab-shadow-modal);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ch1-popover--right {
  left: auto;
  right: 0;
  width: min(520px, calc(100vw - 40px));
}

.ch1-pop-search {
  position: relative;
  padding: 10px 10px 9px;
  border-bottom: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  display: flex;
  align-items: center;
}

.ch1-pop-search-icon {
  position: absolute;
  left: 20px;
  color: var(--lab-muted);
  pointer-events: none;
}

.ch1-pop-search-input {
  width: 100%;
  height: 30px;
  padding-left: 30px;
  font-size: 12.5px;
}

.ch1-pop-split {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  height: 312px;
}

.ch1-pop-split.is-search {
  grid-template-columns: 1fr;
}

.ch1-pop-specs {
  border-right: 1px solid var(--lab-line);
  background: var(--lab-paper-soft);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
}

.ch1-pop-spec-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 9px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lab-ink-2);
  font-size: 12.5px;
  font-weight: 700;
  text-align: left;
  transition: all 0.1s ease;
}

.ch1-pop-spec-btn:hover {
  background: var(--lab-well);
  color: var(--lab-ink);
}

.ch1-pop-spec-btn.is-active {
  background: var(--lab-ink);
  color: var(--lab-paper);
}

.ch1-pop-spec-btn em {
  font-style: normal;
  font-size: 10.5px;
  opacity: 0.65;
}

.ch1-pop-items {
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ch1-pop-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  min-width: 0;
  transition: all 0.1s ease;
}

.ch1-pop-item:hover {
  background: var(--lab-paper-soft);
  border-color: var(--lab-line);
}

.ch1-pop-item.is-selected {
  background: var(--lab-accent-soft);
  border-color: var(--lab-accent);
}

.ch1-pop-avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--lab-line);
  background: var(--lab-well);
  flex: 0 0 auto;
}

.ch1-pop-avatar--engine {
  object-fit: contain;
  padding: 2px;
  background: var(--lab-paper-soft);
}

.ch1-pop-item-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ch1-pop-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ch1-pop-item-copy strong {
  font-size: 13px;
  font-weight: 700;
  color: var(--lab-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-pop-item-copy span {
  font-size: 11px;
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-pop-check {
  color: var(--lab-accent);
  flex: 0 0 auto;
}

.ch1-pop-empty {
  padding: 28px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--lab-muted);
}

/* ==========================================================================
   Tactile Calibration Strips (Cinema / Core / Modification / Spec)
   ========================================================================== */

.ch1-keys-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px solid var(--lab-line);
}

.ch1-key-row {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.ch1-key-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--lab-ink-2);
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}

.ch1-key-label em {
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  color: var(--lab-accent);
}

.ch1-key-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.ch1-key-strip--5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.ch1-key {
  height: 27px;
  border-radius: 5px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  color: var(--lab-ink-2);
  font-family: var(--lab-font-mono);
  font-size: 11.5px;
  font-weight: 700;
  transition: all 0.1s ease;
}

.ch1-key:hover {
  border-color: var(--lab-ink);
  color: var(--lab-ink);
}

.ch1-key.is-active {
  background: var(--lab-ink);
  border-color: var(--lab-ink);
  color: var(--lab-paper);
}

.ch1-engine-spec-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ch1-spec-pill {
  flex: 1;
  min-width: 0;
  height: 27px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--lab-line);
  background: var(--lab-paper);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  font-size: 11px;
}

.ch1-spec-pill span {
  color: var(--lab-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-spec-pill strong {
  color: var(--lab-ink);
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch1-spec-pill--effect {
  flex: 1.15;
}

/* ==========================================================================
   Compact Single-Row Skill Level Bar
   ========================================================================== */

.ch1-skill-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}

.ch1-skill-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ch1-preset-chip {
  height: 24px;
  padding: 0 9px;
  font-size: 11.5px;
}

.ch1-skill-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.ch1-skill-cell {
  background: var(--lab-paper-soft);
  border: 1px solid var(--lab-line);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.ch1-skill-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--lab-ink-2);
  white-space: nowrap;
}

.ch1-stepper {
  display: inline-grid;
  grid-template-columns: 22px 26px 22px;
  align-items: center;
  gap: 2px;
}

.ch1-stepper button {
  height: 22px;
  border: 1px solid var(--lab-line-strong);
  border-radius: 4px;
  background: var(--lab-paper);
  font-weight: 800;
  font-size: 13px;
  line-height: 1;
}

.ch1-stepper button:hover {
  border-color: var(--lab-ink);
  background: var(--lab-ink);
  color: var(--lab-paper);
}

.ch1-stepper strong {
  text-align: center;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 960px) {
  .ch1-twin-grid {
    grid-template-columns: 1fr;
  }
  .ch1-popover,
  .ch1-popover--right {
    left: 0;
    right: auto;
    width: 100%;
  }
  .ch1-skill-grid {
    grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
  }
}
</style>
