import { evaluateFormulaExpression } from "./formulaEvaluator.js"
import {
    damageSkillRowsWithGeneratedTotals,
    skillLevelRange,
    skillRowValue,
} from "./skillMultiplierCandidates.js"
import * as SharedCombat from "./shared-combat.js"

const els = {
    status: document.getElementById("status"),
    combatSection: document.getElementById("combat-section"),
    agentSelect: document.getElementById("agentSelect"),
    agentImage: document.getElementById("agentImage"),
    agentMeta: document.getElementById("agentMeta"),
    agentLevelInput: document.getElementById("agentLevelInput"),
    coreSkillSelect: document.getElementById("coreSkillSelect"),
    cinemaLevelSelect: document.getElementById("cinemaLevelSelect"),
    basicSkillLevelSelect: document.getElementById("basicSkillLevelSelect"),
    dodgeSkillLevelSelect: document.getElementById("dodgeSkillLevelSelect"),
    assistSkillLevelSelect: document.getElementById("assistSkillLevelSelect"),
    specialSkillLevelSelect: document.getElementById("specialSkillLevelSelect"),
    chainSkillLevelSelect: document.getElementById("chainSkillLevelSelect"),
    wEngineSelect: document.getElementById("wEngineSelect"),
    wEngineModificationSelect: document.getElementById("wEngineModificationSelect"),
    wEngineImage: document.getElementById("wEngineImage"),
    wEngineMeta: document.getElementById("wEngineMeta"),
    wEngineEffect: document.getElementById("wEngineEffect"),
    selfCombatBuffs: document.getElementById("selfCombatBuffs"),
    wEngineCombatBuffs: document.getElementById("wEngineCombatBuffs"),
    addedCombatBuffs: document.getElementById("addedCombatBuffs"),
    openCombatBuffModalBtn: document.getElementById("openCombatBuffModalBtn"),
    combatBuffModal: document.getElementById("combatBuffModal"),
    closeCombatBuffModalBtn: document.getElementById("closeCombatBuffModalBtn"),
    combatBuffSearchInput: document.getElementById("combatBuffSearchInput"),
    combatBuffCandidateList: document.getElementById("combatBuffCandidateList"),
    combatBuffCustomPane: document.getElementById("combatBuffCustomPane"),
    combatBuffModalEmpty: document.getElementById("combatBuffModalEmpty"),
    customBuffNameInput: document.getElementById("customBuffNameInput"),
    customBuffStatRows: document.getElementById("customBuffStatRows"),
    saveCustomBuffBtn: document.getElementById("saveCustomBuffBtn"),
    bossCombatBuffs: document.getElementById("bossCombatBuffs"),
    fieldCombatBuffs: document.getElementById("fieldCombatBuffs"),
    damageTargetPreset: document.getElementById("damageTargetPreset"),
    damageTargetDefense: document.getElementById("damageTargetDefense"),
    damageLevelCoefficient: document.getElementById("damageLevelCoefficient"),
    damageTargetResistancePreset: document.getElementById("damageTargetResistancePreset"),
    damageTargetResistanceLabel: document.getElementById("damageTargetResistanceLabel"),
    damageTargetResistance: document.getElementById("damageTargetResistance"),
    damageSkillMultiplier: document.getElementById("damageSkillMultiplier"),
    openDamageSkillModalBtn: document.getElementById("openDamageSkillModalBtn"),
    damageSkillSummary: document.getElementById("damageSkillSummary"),
    damageSkillModal: document.getElementById("damageSkillModal"),
    closeDamageSkillModalBtn: document.getElementById("closeDamageSkillModalBtn"),
    damageSkillModalList: document.getElementById("damageSkillModalList"),
    damageSkillModalEmpty: document.getElementById("damageSkillModalEmpty"),
    damageCritMode: document.getElementById("damageCritMode"),
    damageAnomalySettlementType: document.getElementById("damageAnomalySettlementType"),
    damageAnomalyEffect: document.getElementById("damageAnomalyEffect"),
    damageAnomalyProcCount: document.getElementById("damageAnomalyProcCount"),
    damageDisorderEffect: document.getElementById("damageDisorderEffect"),
    damageDisorderElapsed: document.getElementById("damageDisorderElapsed"),
    damageDisorderDuration: document.getElementById("damageDisorderDuration"),
    algorithmSelect: document.getElementById("algorithmSelect"),
    fourPieceSetSelect: document.getElementById("fourPieceSetSelect"),
    twoPieceSetSelect: document.getElementById("twoPieceSetSelect"),
    twoPieceSetChoices: document.getElementById("twoPieceSetChoices"),
    slot4MainStats: document.getElementById("slot4MainStats"),
    slot5MainStats: document.getElementById("slot5MainStats"),
    slot6MainStats: document.getElementById("slot6MainStats"),
    minEnergyRegen: document.getElementById("minEnergyRegen"),
    minAnomalyProficiency: document.getElementById("minAnomalyProficiency"),
    minCritRate: document.getElementById("minCritRate"),
    minCritDmg: document.getElementById("minCritDmg"),
    openCalculationConfigBtn: document.getElementById("openCalculationConfigBtn"),
    calculationSettingsCard: document.getElementById("calculationSettingsCard"),
    calculationConfigSummary: document.getElementById("calculationConfigSummary"),
    calculationSingleControls: document.getElementById("calculationSingleControls"),
    calculationAnomalyControls: document.getElementById("calculationAnomalyControls"),
    calculationConfigModal: document.getElementById("calculationConfigModal"),
    closeCalculationConfigModalBtn: document.getElementById("closeCalculationConfigModalBtn"),
    calculationConfigMode: document.getElementById("calculationConfigMode"),
    adminDefaultCalculationSummary: document.getElementById("adminDefaultCalculationSummary"),
    applyAdminDefaultCalculationBtn: document.getElementById("applyAdminDefaultCalculationBtn"),
    calculationConfigEventCount: document.getElementById("calculationConfigEventCount"),
    calculationConfigEventList: document.getElementById("calculationConfigEventList"),
    calculationEventEditorTitle: document.getElementById("calculationEventEditorTitle"),
    calculationEventEditorFields: document.getElementById("calculationEventEditorFields"),
    duplicateCalculationEventBtn: document.getElementById("duplicateCalculationEventBtn"),
    removeCalculationEventBtn: document.getElementById("removeCalculationEventBtn"),
    addCalculationDirectEventBtn: document.getElementById("addCalculationDirectEventBtn"),
    addCalculationAnomalyEventBtn: document.getElementById("addCalculationAnomalyEventBtn"),
    addCalculationDisorderEventBtn: document.getElementById("addCalculationDisorderEventBtn"),
    calculationConfigFooterSummary: document.getElementById("calculationConfigFooterSummary"),
    saveCalculationConfigBtn: document.getElementById("saveCalculationConfigBtn"),
    optimizeBtn: document.getElementById("optimizeBtn"),
    cancelOptimizeBtn: document.getElementById("cancelOptimizeBtn"),
    optimizerMetrics: document.getElementById("optimizerMetrics"),
    optimizerProgress: document.getElementById("optimizerProgress"),
    optimizerProgressFill: document.getElementById("optimizerProgressFill"),
    optimizerProgressPercent: document.getElementById("optimizerProgressPercent"),
    optimizerElapsed: document.getElementById("optimizerElapsed"),
    optimizerEvaluated: document.getElementById("optimizerEvaluated"),
    optimizerEstimate: document.getElementById("optimizerEstimate"),
    optimizerProgressNote: document.getElementById("optimizerProgressNote"),
    optimizerResultTabs: document.getElementById("optimizerResultTabs"),
    optimizerResultList: document.getElementById("optimizerResultList"),
    optimizerEmpty: document.getElementById("optimizerEmpty"),
    saveLoadoutBtn: document.getElementById("saveLoadoutBtn"),
    slot4MainStatChoices: document.getElementById("slot4MainStatChoices"),
    slot5MainStatChoices: document.getElementById("slot5MainStatChoices"),
    slot6MainStatChoices: document.getElementById("slot6MainStatChoices"),
    baseTable: document.getElementById("baseTable"),
    bonusTable: document.getElementById("bonusTable"),
    inCombatPanelTable: document.getElementById("inCombatPanelTable"),
    inCombatActiveEffects: document.getElementById("inCombatActiveEffects"),
    damageFinalValue: document.getElementById("damageFinalValue"),
    damageWhiteBoxRows: document.getElementById("damageWhiteBoxRows"),
}

const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
const DEFAULT_CHECKED_COMBAT_SOURCE_TYPES = new Set(["self", "wEngine", "wEngineTeam"])
const TEAMMATE_DRIVE_DISC_LIMIT = 2
const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether"]
const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
}
const ANOMALY_EFFECT_LABELS = {
    assault: "强击",
    shatter: "碎冰",
    burn: "灼烧",
    shock: "感电",
    corruption: "侵蚀",
    frozen: "霜寒",
    frost_frozen: "烈霜霜寒紊乱（星见雅）",
    flinch: "畏缩",
}
const DAMAGE_MODIFIER_KIND_LABELS = {
    anomalyDamageBonus: "异常伤害增伤",
    baseMultiplierBonus: "伤害倍率修正",
    anomalyCritRate: "异常暴击率",
    anomalyCritDmg: "异常暴击伤害",
    directDamageBonus: "技能专属伤害增伤",
    skillMultiplierBonus: "技能倍率加算",
}
const DEFAULT_ANOMALY_PROC_COUNTS = {
    assault: 1,
    shatter: 1,
    burn: 20,
    shock: 10,
    corruption: 20,
}
const DEFAULT_ANOMALY_EFFECT_BY_ELEMENT = {
    physical: "assault",
    ice: "shatter",
    fire: "burn",
    electric: "shock",
    ether: "corruption",
}
const ELEMENT_DMG_KEYS = new Set(["physicalDmg", "fireDmg", "iceDmg", "electricDmg", "etherDmg"])
const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
}
const SKILL_CATEGORY_ORDER = [
    ["basic", "普通攻击", "basicSkillLevelSelect"],
    ["dodge", "闪避", "dodgeSkillLevelSelect"],
    ["assist", "支援技", "assistSkillLevelSelect"],
    ["special", "特殊技", "specialSkillLevelSelect"],
    ["chain", "连携技", "chainSkillLevelSelect"],
]
const RESISTANCE_PRESET_VALUES = new Set(["-20", "0", "20"])
const ENUM_LABELS = {
    attribute: {
        physical: "物理",
        frost: "烈霜",
        fire: "火",
        ice: "冰",
        electric: "电",
        ether: "以太",
    },
    specialty: {
        attack: "强攻",
        stun: "击破",
        anomaly: "异常",
        support: "支援",
        defense: "防护",
        rupture: "命破",
    },
    faction: {
        cunning_hares: "狡兔屋",
        belobog: "白祇重工",
        victoria: "维多利亚家政",
        obol: "奥波勒斯小队",
        sons_of_calydon: "卡吕冬之子",
        section_6: "对空洞特别行动部第六课",
        stars_of_lyra: "天琴座",
        mock: "测试",
    },
}
const CUSTOM_BUFF_STAT_OPTIONS = SharedCombat.CUSTOM_BUFF_STAT_OPTIONS
const CUSTOM_BUFF_SKILL_STAT_OPTIONS = SharedCombat.CUSTOM_BUFF_SKILL_STAT_OPTIONS
const STAT_LABELS = {
    hp: "生命值",
    atk: "攻击力",
    def: "防御力",
    hpFlat: "生命值",
    atkFlat: "攻击力",
    defFlat: "防御力",
    hpPct: "生命值%",
    atkPct: "攻击力%",
    defPct: "防御力%",
    critRate: "暴击率",
    critDmg: "暴击伤害",
    impact: "冲击力",
    impactPct: "冲击力",
    anomalyProficiency: "异常精通",
    anomalyProficiencyFlat: "异常精通",
    anomalyMastery: "异常掌控",
    anomalyMasteryFlat: "异常掌控",
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    penFlat: "穿透值",
    penRatio: "穿透率",
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    dmgBonus: "通用伤害加成",
    enemyDefReduction: "敌方减防率",
    enemyDefIgnore: "无视防御率",
    enemyDefFlatReduction: "敌方固定减防",
    enemyResReduction: "敌方当前属性减抗",
}
const PERCENT_KEYS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
    "impactPct",
    "energyRegen",
    "energyRegenPct",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
])
const BASE_ORDER = ["hp", "atk", "def"]
const PANEL_ORDER = [
    "hp",
    "atk",
    "def",
    "critRate",
    "critDmg",
    "impact",
    "anomalyProficiency",
    "anomalyMastery",
    "energyRegen",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
]

let meta = null
let store = null
let optimizationResults = []
let activeResultIndex = -1
let activeOptimizationJobId = null
let optimizationStartedAt = 0
let optimizationPollTimer = null
let optimizationElapsedTimer = null
let lastOptimizationProgress = null
let activeOptimizationSettingsSnapshot = null
let activeOptimizationAgentIdSnapshot = null
let lastCompletedOptimizationSettings = null
let lastCompletedOptimizationAgentId = null
let activeCombatBuffTab = "agent"
const manuallyUncheckedDefaultCombatBuffIds = new Set()
const damageTargetResistanceByElement = Object.fromEntries(DAMAGE_ELEMENTS.map(element => [element, 0]))
let activeDamageResistanceElement = "physical"
let selectedDamageSkillRef = null
let activeDamageSkillPickerMoveRef = null
let damageSkillLevelsByCategory = {}
let calculationConfigMode = "single"
let calculationConfigEvents = []
let calculationConfigSelectedEventId = null
let calculationConfigEditingIndex = 0
let currentRenderedDamage = null
const combatUi = SharedCombat.createCombatUiController({
    getMeta: () => meta,
    includeDriveDiscBuffs: false,
    preserveHiddenDriveDiscBuffs: true,
})

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
}

function formatCount(value) {
    return Number(value ?? 0).toLocaleString("zh-CN")
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms ?? 0) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const mm = String(minutes).padStart(2, "0")
    const ss = String(seconds).padStart(2, "0")
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

function formatPercent(value) {
    const percent = Math.max(0, Math.min(100, Number(value ?? 0)))
    if (percent > 0 && percent < 0.1) {
        return "<0.1%"
    }
    if (percent > 0 && percent < 10) {
        return `${percent.toFixed(1)}%`
    }
    return `${Math.round(percent)}%`
}

function formatRate(value) {
    const rate = Number(value ?? 0)
    if (!Number.isFinite(rate) || rate <= 0) {
        return ""
    }
    return `${formatCount(Math.round(rate))}/秒`
}

function setOptimizeButtonRunning(isRunning) {
    els.optimizeBtn.disabled = isRunning
    els.optimizeBtn.textContent = isRunning ? "计算中" : "开始计算"
    els.optimizeBtn.dataset.running = isRunning ? "true" : "false"
    els.cancelOptimizeBtn.hidden = !isRunning
    els.cancelOptimizeBtn.disabled = false
}

function stopOptimizationTimers() {
    if (optimizationPollTimer) {
        clearInterval(optimizationPollTimer)
        optimizationPollTimer = null
    }
    if (optimizationElapsedTimer) {
        clearInterval(optimizationElapsedTimer)
        optimizationElapsedTimer = null
    }
}

function progressTextForStatus(status) {
    if (status === "preview") {
        return "已完成计算预估"
    }
    if (status === "complete") {
        return "计算完成"
    }
    if (status === "canceling") {
        return "正在取消计算"
    }
    if (status === "cancelled") {
        return "计算已取消"
    }
    if (status === "error") {
        return "计算失败"
    }
    return "正在精确枚举候选组合"
}

function algorithmProgressText(metrics = {}) {
    const label = metrics.algorithmLabel || metrics.algorithmId
    if (!label) {
        return ""
    }
    const exactText = metrics.strictExact === false ? "非严格精准" : "严格精准"
    const parts = [`算法：${label}`, exactText]
    const pruned = Number(metrics.prunedBySuperBound ?? 0)
    const checks = Number(metrics.superBoundChecks ?? 0)
    if (pruned > 0) {
        parts.push(`真实评分 ${formatCount(metrics.scoredCombinationCount ?? metrics.evaluated ?? 0)}`)
        parts.push(`剪枝 ${formatCount(pruned)}`)
    } else if (checks > 0) {
        parts.push(`上界检查 ${formatCount(checks)}`)
    }
    return parts.join(" · ")
}

function processedOptimizationCount(metrics = {}, fallback = null) {
    if (fallback !== null && fallback !== undefined) {
        return Number(fallback ?? 0)
    }
    return Number(metrics.processedCombinationCount
        ?? (Number(metrics.evaluated ?? 0) + Number(metrics.prunedBySuperBound ?? 0)))
}

function appliedPreferredText(settings = {}) {
    const entries = Object.entries(settings.appliedPreferredMainStatLimits ?? {})
        .filter(([, values]) => Array.isArray(values) && values.length > 0)
    if (!entries.length) {
        return ""
    }
    return `已应用角色优先主词条 ${entries
        .map(([slot, values]) => `${slot}号位 ${values.map(statLabel).join("/")}`)
        .join("；")}`
}

function hasExplicitMainStatLimits(settings = {}) {
    const explicit = Object.values(settings.explicitMainStatLimits ?? {})
        .some(values => Array.isArray(values) && values.length > 0)
    if (explicit) {
        return true
    }
    return Object.values(settings.mainStatLimits ?? {})
        .some(values => Array.isArray(values) && values.length > 0)
}

function hasTwoPieceSetLimit(settings = {}) {
    return Array.isArray(settings.twoPieceSetIds)
        ? settings.twoPieceSetIds.length > 0
        : Boolean(settings.twoPieceSetId)
}

function complexityText(metrics = {}, settings = {}) {
    const complexity = metrics.complexity
    if (!complexity?.label) {
        return ""
    }
    const high = ["high", "extreme"].includes(complexity.level)
    if (!high) {
        return `复杂度：${complexity.label}`
    }
    if (hasExplicitMainStatLimits(settings)) {
        return hasTwoPieceSetLimit(settings)
            ? `复杂度：${complexity.label}，已限定主词条，候选仍多时可继续收窄`
            : `复杂度：${complexity.label}，已限定主词条，建议再限定 2 件套`
    }
    return hasTwoPieceSetLimit(settings)
        ? `复杂度：${complexity.label}，建议限定主词条`
        : `复杂度：${complexity.label}，建议限定 2 件套或主词条`
}

function renderOptimizationProgress(job = {}) {
    const previous = lastOptimizationProgress ?? {}
    const merged = {
        ...previous,
        ...job,
        metrics: {
            ...(previous.metrics ?? {}),
            ...(job.metrics ?? {}),
        },
    }
    lastOptimizationProgress = merged
    const metrics = merged.metrics ?? {}
    const elapsedMs = merged.elapsedMs ?? (optimizationStartedAt ? Date.now() - optimizationStartedAt : 0)
    const evaluated = processedOptimizationCount(metrics, merged.evaluated)
    const estimated = merged.estimatedCombinationCount ?? metrics.estimatedCombinationCount ?? 0
    const rateText = formatRate(metrics.evaluationsPerSecond ?? merged.evaluationsPerSecond)
    const percent = Math.max(0, Math.min(100, Number(merged.percent ?? 0)))
    els.optimizerProgress.hidden = false
    els.optimizerProgressFill.style.width = `${percent}%`
    els.optimizerProgressPercent.textContent = formatPercent(percent)
    els.optimizerElapsed.textContent = `已计算 ${formatDuration(elapsedMs)}`
    els.optimizerEvaluated.textContent = rateText
        ? `已评估 ${formatCount(evaluated)}（${rateText}）`
        : `已评估 ${formatCount(evaluated)}`
    els.optimizerEstimate.textContent = `估算 ${formatCount(estimated)}`

    const candidateCounts = metrics.candidateCountsBySlot ?? {}
    const candidateText = Object.keys(candidateCounts).length
        ? `候选 ${Object.entries(candidateCounts).map(([slot, count]) => `${slot}号位 ${formatCount(count)}`).join(" / ")}`
        : ""
    els.optimizerProgressNote.textContent = [
        progressTextForStatus(merged.status),
        algorithmProgressText(metrics),
        candidateText,
        complexityText(metrics, merged.settings),
        appliedPreferredText(merged.settings),
    ].filter(Boolean).join(" · ")
    els.optimizerMetrics.textContent = estimated
        ? [
            formatPercent(percent),
            `${formatCount(evaluated)} / ${formatCount(estimated)}`,
            rateText,
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatCount(metrics.prunedBySuperBound)}` : "",
        ].filter(Boolean).join(" · ")
        : progressTextForStatus(merged.status)
}

function clearOptimizationProgress() {
    stopOptimizationTimers()
    activeOptimizationJobId = null
    optimizationStartedAt = 0
    lastOptimizationProgress = null
    activeOptimizationSettingsSnapshot = null
    activeOptimizationAgentIdSnapshot = null
    els.optimizerProgress.hidden = true
    els.optimizerProgressFill.style.width = "0%"
    els.optimizerProgressPercent.textContent = "0%"
    els.optimizerElapsed.textContent = "已计算 00:00"
    els.optimizerEvaluated.textContent = "已评估 0"
    els.optimizerEstimate.textContent = "估算 0"
    els.optimizerProgressNote.textContent = "等待开始"
    setOptimizeButtonRunning(false)
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function nameOf(item) {
    return combatUi.nameOf(item)
}

function localizedText(value) {
    return combatUi.localizedText(value)
}

function enumLabel(type, value) {
    return SharedCombat.enumLabel(type, value)
}

function rarityLabel(value) {
    return SharedCombat.rarityLabel(value)
}

function coreSkillLevelLabel(agent, level) {
    return SharedCombat.coreSkillLevelLabel(agent, level)
}

function coreSkillSummary(agent, selectedLevel) {
    return SharedCombat.coreSkillSummary(agent, selectedLevel, meta)
}

function agentAttributeText(agent) {
    return SharedCombat.agentAttributeText(agent)
}

function damageElementShortLabel(element) {
    return SharedCombat.damageElementShortLabel(element)
}

function statLabel(stat) {
    return combatUi.statLabel(stat)
}

function formatValue(value, stat = "") {
    return SharedCombat.formatValue(value, stat)
}

function formatStoredValue(stat, value, mode = "") {
    return SharedCombat.formatStoredStatValue(stat, value, { percentMode: mode === "pct", mode })
}

function readJsonStorage(key, fallback) {
    return SharedCombat.readJsonStorage(key, fallback)
}

function loadHomeSelection() {
    return SharedCombat.loadCurrentOwnerSelection()
}

function saveHomeSelection(selection) {
    SharedCombat.saveCurrentOwnerSelection(selection)
}

function configForAgent(agentId) {
    return combatUi.configForAgent(agentId)
}

function saveSyncedConfig() {
    const agentId = els.agentSelect.value
    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    byAgent[agentId] = {
        ...(byAgent[agentId] ?? {}),
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        coreSkillLevel: els.coreSkillSelect.value,
        cinemaLevel: selectedCinemaLevel(),
        combat: {
            ...((byAgent[agentId] ?? {}).combat ?? {}),
            addedBuffs: ((byAgent[agentId] ?? {}).combat?.addedBuffs ?? []),
        },
        damage: collectDamageConfig(),
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
        ...options,
    })
    const json = await response.json()
    if (!response.ok || json.ok === false) {
        throw new Error(json.error || response.statusText)
    }
    return json
}

function getAgent(id) {
    return meta?.agents?.find(item => item.id === id) ?? meta?.agents?.[0]
}

function getWEngine(id) {
    return meta?.wEngines?.find(item => item.id === id) ?? meta?.wEngines?.[0]
}

function selectedWEngineModificationLevel(wEngine = getWEngine(els.wEngineSelect.value)) {
    return SharedCombat.clampWEngineModificationLevel(els.wEngineModificationSelect?.value, wEngine)
}

function populateWEngineModificationSelect(wEngine, preferredLevel = 1) {
    if (!els.wEngineModificationSelect) {
        return 1
    }

    const selectedLevel = SharedCombat.clampWEngineModificationLevel(preferredLevel, wEngine)
    const modification = wEngine?.modification ?? {}
    const min = Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1
    const max = Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5
    els.wEngineModificationSelect.innerHTML = ""
    for (let level = min; level <= max; level += 1) {
        const option = document.createElement("option")
        option.value = String(level)
        option.textContent = `${level}级`
        option.selected = level === selectedLevel
        els.wEngineModificationSelect.appendChild(option)
    }
    return selectedLevel
}

function currentWEngineWithModification() {
    const wEngine = getWEngine(els.wEngineSelect.value)
    return SharedCombat.materializeWEngineForModificationLevel(wEngine, selectedWEngineModificationLevel(wEngine))
}

function getSet(id) {
    return meta?.driveDiscSets?.find(item => item.id === id) ?? null
}

function imageOf(item, type) {
    if (!item) {
        return ""
    }
    return item.images?.portrait
        ?? item.images?.icon
        ?? item.image
        ?? item.icon
        ?? `/assets/${type}s/${item.id}.png`
}

function fallbackImageSvg(item, type) {
    const initials = String(nameOf(item) || type || "ZZZ").slice(0, 2)
    const encoded = encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
            <rect width="96" height="96" rx="18" fill="#f4f7fb"/>
            <text x="48" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#2d7ff9">${escapeHtml(initials)}</text>
        </svg>
    `)
    return `data:image/svg+xml;charset=utf-8,${encoded}`
}

function setEntityImage(img, item, type) {
    if (!img) {
        return
    }
    img.src = imageOf(item, type) || fallbackImageSvg(item, type)
    img.alt = nameOf(item)
    img.onerror = () => {
        img.onerror = null
        img.src = fallbackImageSvg(item, type)
    }
}

function damageElementForAgent(agent = {}) {
    return SharedCombat.damageElementForAgent(agent)
}

function currentDamageElement() {
    return damageElementForAgent(getAgent(els.agentSelect.value))
}

function currentElementDmgKey() {
    return `${currentDamageElement()}Dmg`
}

function panelOrder() {
    const elementKey = currentElementDmgKey()
    return PANEL_ORDER.filter(key => !ELEMENT_DMG_KEYS.has(key) || key === elementKey)
}

function populateSelect(select, items, selectedId) {
    select.innerHTML = ""
    for (const item of items) {
        const option = document.createElement("option")
        option.value = item.id
        option.textContent = nameOf(item)
        option.selected = item.id === selectedId
        select.appendChild(option)
    }
}

function coreSkillDefaultLevel(agent) {
    return SharedCombat.coreSkillDefaultLevel(agent)
}

function populateCoreSkillSelect(agent, preferredLevel) {
    const levels = agent?.coreSkill?.levels ?? []
    const valid = new Set(["none", ...levels.map(item => item.level)])
    const selected = valid.has(preferredLevel) ? preferredLevel : coreSkillDefaultLevel(agent)
    els.coreSkillSelect.innerHTML = ""
    const none = document.createElement("option")
    none.value = "none"
    none.textContent = levels.length ? "未强化" : "未建模"
    none.selected = selected === "none"
    els.coreSkillSelect.appendChild(none)
    for (const level of levels) {
        const option = document.createElement("option")
        option.value = level.level
        option.textContent = level.label ?? `强化${level.level}`
        option.selected = selected === level.level
        els.coreSkillSelect.appendChild(option)
    }
    els.coreSkillSelect.disabled = levels.length === 0
}

function renderStatStrip(container, entries) {
    if (!container) {
        return
    }
    container.innerHTML = ""
    for (const entry of entries) {
        const chip = document.createElement("div")
        chip.className = "stat-chip"
        chip.innerHTML = `<span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(entry.value)}</strong>`
        container.appendChild(chip)
    }
}

function renderAgentMeta(agent, coreSkillLevel = "none") {
    setEntityImage(els.agentImage, agent, "agent")
    if (!agent) {
        renderStatStrip(els.agentMeta, [])
        return
    }
    renderStatStrip(els.agentMeta, [
        { label: "属性", value: agentAttributeText(agent) },
        { label: "特性", value: enumLabel("specialty", agent.specialty) },
        { label: "阵营", value: enumLabel("faction", agent.faction) },
        { label: "稀有度", value: rarityLabel(agent.rarity) },
        { label: "核心技", value: coreSkillSummary(agent, coreSkillLevel) },
    ])
}

function renderWEngineMeta(wEngine) {
    setEntityImage(els.wEngineImage, wEngine, "w-engine")
    if (!wEngine) {
        renderStatStrip(els.wEngineMeta, [])
        if (els.wEngineEffect) {
            els.wEngineEffect.innerHTML = ""
        }
        return
    }
    const advanced = wEngine.level60?.advancedStat
    renderStatStrip(els.wEngineMeta, [
        { label: "适配特性", value: enumLabel("specialty", wEngine.specialty) },
        { label: "基础攻击力", value: formatValue(wEngine.level60?.atkBase ?? 0, "atk") },
        {
            label: "高级属性",
            value: advanced
                ? `${statLabel(advanced.stat)} ${formatStoredValue(advanced.stat, advanced.value, advanced.mode)}`
                : "-",
        },
    ])
}

function renderWEngineEffect(wEngine) {
    if (!els.wEngineEffect) {
        return
    }
    els.wEngineEffect.innerHTML = ""
    const effect = wEngineEffectData(wEngine)
    if (!effect) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        els.wEngineEffect.appendChild(empty)
        return
    }

    const requirement = localizedText(effect.requirement?.label)
        || (effect.requirement?.specialty ? `对于【${enumLabel("specialty", effect.requirement.specialty)}】角色，能够触发以下效果` : "")
    const description = localizedText(effect.description)
    const selfStats = storedEffectRulesText(wEngineEffectSelfBuff(wEngine))
    const teamStats = storedEffectRulesText(wEngineEffectTeamBuff(wEngine))

    const head = document.createElement("div")
    head.className = "weapon-effect-head"
    head.innerHTML = `<span>音擎效果</span><strong>${escapeHtml(nameOf(effect))}</strong>`

    const body = document.createElement("div")
    body.className = "weapon-effect-body"
    for (const text of [
        requirement,
        description,
        selfStats ? `限佩戴者：${selfStats}` : "",
        teamStats ? `团队：${teamStats}` : "",
    ].filter(Boolean)) {
        const line = document.createElement("p")
        line.textContent = text
        body.appendChild(line)
    }

    els.wEngineEffect.append(head, body)
}

function renderEntityCards() {
    const agent = getAgent(els.agentSelect.value)
    const wEngine = currentWEngineWithModification()
    renderAgentMeta(agent, els.coreSkillSelect.value)
    populateCinemaLevelSelect(selectedCinemaLevel())
    renderAgentSkillLevelControls()
    renderWEngineMeta(wEngine)
    renderWEngineEffect(wEngine)
}

function damageTargetPresets() {
    return meta?.damageTargetPresets ?? []
}

function damageTargetPresetById(id) {
    return damageTargetPresets().find(item => item.id === id)
        ?? damageTargetPresets().find(item => item.id === DEFAULT_DAMAGE_TARGET_PRESET_ID)
        ?? damageTargetPresets()[0]
}

function populateDamageTargetPresets() {
    els.damageTargetPreset.innerHTML = ""
    for (const preset of damageTargetPresets()) {
        const option = document.createElement("option")
        option.value = preset.id
        option.textContent = `${nameOf(preset)}（${preset.defense}）`
        option.selected = preset.id === DEFAULT_DAMAGE_TARGET_PRESET_ID
        els.damageTargetPreset.appendChild(option)
    }
}

function anomalyEffects() {
    return meta?.anomalyEffects ?? [
        { id: "assault", label: { zhCN: "强击" }, defaultProcCount: 1 },
        { id: "shatter", label: { zhCN: "碎冰" }, defaultProcCount: 1 },
        { id: "burn", label: { zhCN: "灼烧" }, defaultProcCount: 20 },
        { id: "shock", label: { zhCN: "感电" }, defaultProcCount: 10 },
        { id: "corruption", label: { zhCN: "侵蚀" }, defaultProcCount: 20 },
    ]
}

function disorderEffects() {
    return meta?.disorderEffects ?? [
        { id: "burn", label: { zhCN: "灼烧" } },
        { id: "shock", label: { zhCN: "感电" } },
        { id: "corruption", label: { zhCN: "侵蚀" } },
        { id: "frozen", label: { zhCN: "霜寒" } },
        { id: "frost_frozen", label: { zhCN: "烈霜霜寒紊乱（星见雅）" }, defaultDurationSeconds: 20 },
        { id: "flinch", label: { zhCN: "畏缩" } },
    ]
}

function anomalySettlementType(event = {}) {
    return event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
}

function anomalyEffectId(event = {}) {
    return event.anomalyEffect ?? event.previousAnomalyEffect ?? ""
}

function populateDamageEventSelects() {
    if (els.damageAnomalyEffect) {
        els.damageAnomalyEffect.innerHTML = ""
        for (const effect of anomalyEffects()) {
            const option = document.createElement("option")
            option.value = effect.id
            option.textContent = localizedText(effect.label) || ANOMALY_EFFECT_LABELS[effect.id] || effect.id
            option.dataset.defaultProcCount = String(effect.defaultProcCount ?? DEFAULT_ANOMALY_PROC_COUNTS[effect.id] ?? 1)
            els.damageAnomalyEffect.appendChild(option)
        }
    }
    if (els.damageDisorderEffect) {
        els.damageDisorderEffect.innerHTML = ""
        for (const effect of disorderEffects()) {
            const option = document.createElement("option")
            option.value = effect.id
            option.textContent = localizedText(effect.label) || ANOMALY_EFFECT_LABELS[effect.id] || effect.id
            option.dataset.defaultDurationSeconds = String(effect.defaultDurationSeconds ?? 10)
            els.damageDisorderEffect.appendChild(option)
        }
    }
}

function renderCalculationObjectiveControls() {
    if (els.calculationSingleControls) {
        els.calculationSingleControls.hidden = calculationConfigMode !== "single"
    }
    if (els.calculationAnomalyControls) {
        els.calculationAnomalyControls.hidden = calculationConfigMode !== "anomaly"
    }
    const settlementType = els.damageAnomalySettlementType?.value === "disorder" ? "disorder" : "attribute"
    document.querySelectorAll(".calculation-anomaly-attribute-field").forEach(item => { item.hidden = settlementType !== "attribute" })
    document.querySelectorAll(".calculation-anomaly-disorder-field").forEach(item => { item.hidden = settlementType !== "disorder" })
}

function agentSkillCatalog(agentId = els.agentSelect?.value) {
    return meta?.agentSkills?.find(item => item.agentId === agentId) ?? null
}

function damageSkillCategories(skill = agentSkillCatalog()) {
    return (skill?.categories ?? [])
        .map(category => ({
            ...category,
            moves: (category.moves ?? [])
                .map(move => ({
                    ...move,
                    rows: damageSkillRowsWithGeneratedTotals(category, move),
                }))
                .filter(move => move.rows.length),
        }))
        .filter(category => category.moves.length)
}

function defaultSkillLevel(category = {}) {
    const range = skillLevelRange(category)
    return Number(range.default ?? range.max ?? range.min ?? 1)
}

function clampSkillLevel(category = {}, level) {
    const range = skillLevelRange(category)
    const numeric = Number(level)
    if (!Number.isInteger(numeric)) {
        return defaultSkillLevel(category)
    }
    return Math.max(Number(range.min ?? 1), Math.min(Number(range.max ?? numeric), numeric))
}

function selectedSkillLevel(category = {}) {
    return clampSkillLevel(category, damageSkillLevelsByCategory[category.id] ?? defaultSkillLevel(category))
}

function stripSkillRefLevel(skillRef = null) {
    if (!skillRef || typeof skillRef !== "object") {
        return null
    }
    return {
        agentSkillId: String(skillRef.agentSkillId ?? "").trim(),
        categoryId: String(skillRef.categoryId ?? "").trim(),
        moveId: String(skillRef.moveId ?? "").trim(),
        rowId: String(skillRef.rowId ?? "").trim(),
    }
}

function calculationConfigFromStored(config = null) {
    const events = Array.isArray(config?.events)
        ? config.events.map((event, index) => ({
            ...event,
            id: String(event.id ?? `${event.kind ?? "event"}-${index + 1}`),
            kind: event.kind === "anomaly" || event.kind === "disorder" ? "anomaly" : "direct",
            settlementType: anomalySettlementType(event),
            ...(anomalySettlementType(event) === "disorder"
                ? { anomalyEffect: anomalyEffectId(event) || "burn" }
                : {}),
            count: Number(event.count ?? 1),
            ...(event.skillRef ? { skillRef: stripSkillRefLevel(event.skillRef) } : {}),
        }))
        : []
    return {
        mode: ["single", "anomaly", "custom"].includes(config?.mode) ? config.mode : (events.length > 1 ? "custom" : "single"),
        selectedEventId: config?.selectedEventId ?? events[0]?.id ?? null,
        events,
    }
}

function defaultAnomalyEffectIdForAgent(agent = getAgent(els.agentSelect.value)) {
    const element = damageElementForAgent(agent)
    return DEFAULT_ANOMALY_EFFECT_BY_ELEMENT[element] ?? "assault"
}

function firstDamageSkillRef() {
    const skill = agentSkillCatalog()
    const category = damageSkillCategories(skill)[0]
    const move = category?.moves?.[0]
    const row = move?.rows?.find(item => (item.kind ?? "damageMultiplier") === "damageMultiplier") ?? move?.rows?.[0]
    if (!skill || !category || !move || !row) {
        return null
    }
    return {
        agentSkillId: skill.id,
        categoryId: category.id,
        moveId: move.id,
        rowId: row.id,
    }
}

function uniqueCalculationEventId(kind = "event") {
    const prefix = kind === "direct" ? "direct" : kind === "disorder" ? "disorder" : "anomaly"
    let index = calculationConfigEvents.length + 1
    const used = new Set(calculationConfigEvents.map(event => event.id))
    while (used.has(`${prefix}-${index}`)) {
        index += 1
    }
    return `${prefix}-${index}`
}

function calculationEventDraft(kind = "direct") {
    const id = uniqueCalculationEventId(kind)
    if (kind === "anomaly") {
        const anomalyEffect = defaultAnomalyEffectIdForAgent()
        return {
            id,
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffect,
            procCount: DEFAULT_ANOMALY_PROC_COUNTS[anomalyEffect] ?? 1,
            count: 1,
        }
    }
    if (kind === "disorder") {
        return {
            id,
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: disorderEffects()[0]?.id ?? "burn",
            elapsedSeconds: 0,
            durationSeconds: 10,
            count: 1,
        }
    }
    return {
        id,
        kind: "direct",
        skillRef: firstDamageSkillRef(),
        skillMultiplier: Number(els.damageSkillMultiplier?.value || 100),
        critMode: "expected",
        count: 1,
    }
}

function skillRefWithCurrentLevel(skillRef = null) {
    const base = stripSkillRefLevel(skillRef)
    if (!base?.categoryId) {
        return null
    }
    const skill = meta?.agentSkills?.find(item => item.id === base.agentSkillId)
        ?? agentSkillCatalog()
    const category = damageSkillCategories(skill).find(item => item.id === base.categoryId)
    if (!category) {
        return base
    }
    return {
        ...base,
        level: selectedSkillLevel(category),
    }
}

function eventWithCurrentSkillLevel(event = {}) {
    if (event.kind !== "direct") {
        return { ...event }
    }
    const skillRef = skillRefWithCurrentLevel(event.skillRef)
    return {
        ...event,
        ...(skillRef ? { skillRef } : {}),
    }
}

function collectDamageTargetConfig() {
    persistCurrentDamageResistanceInput()
    const damageElement = currentDamageElement()
    return {
        presetId: els.damageTargetPreset?.value || DEFAULT_DAMAGE_TARGET_PRESET_ID,
        defense: Number(els.damageTargetDefense?.value || 953),
        levelCoefficient: Number(els.damageLevelCoefficient?.value || DEFAULT_DAMAGE_LEVEL_COEFFICIENT),
        resistanceByElement: {
            ...damageTargetResistanceByElement,
            [damageElement]: Number(els.damageTargetResistance?.value || 0),
        },
    }
}

function directEventFromControls(id = "direct-1") {
    const resolvedSkill = resolveDamageSkillRef(selectedDamageSkillRef)
    return {
        id,
        kind: "direct",
        skillMultiplier: Number(els.damageSkillMultiplier?.value || 100),
        ...(resolvedSkill ? { skillRef: resolvedSkill.ref } : {}),
        critMode: els.damageCritMode?.value || "expected",
        count: 1,
    }
}

function singleEventFromControls() {
    return directEventFromControls("direct-1")
}

function anomalyEventFromControls() {
    const settlementType = els.damageAnomalySettlementType?.value === "disorder" ? "disorder" : "attribute"
    if (settlementType === "disorder") {
        return {
            id: "disorder-1",
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: els.damageDisorderEffect?.value || "burn",
            elapsedSeconds: Number(els.damageDisorderElapsed?.value || 0),
            durationSeconds: Number(els.damageDisorderDuration?.value || 10),
            count: 1,
        }
    }
    const anomalyEffect = els.damageAnomalyEffect?.value || "assault"
    return {
        id: "anomaly-1",
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect,
        procCount: Number(els.damageAnomalyProcCount?.value || DEFAULT_ANOMALY_PROC_COUNTS[anomalyEffect] || 1),
        count: 1,
    }
}

function configuredCalculationEventsForRequest() {
    if (calculationConfigMode === "anomaly") {
        return [anomalyEventFromControls()]
    }
    if (calculationConfigMode === "custom") {
        const events = calculationConfigEvents.length
            ? calculationConfigEvents
            : [calculationEventDraft("direct")]
        return events.map(eventWithCurrentSkillLevel)
    }
    return [singleEventFromControls()]
}

function calculationEventTitle(event = {}) {
    if (event.kind === "anomaly" && anomalySettlementType(event) === "attribute") {
        const effect = anomalyEffects().find(item => item.id === event.anomalyEffect)
        return `${localizedText(effect?.label) || ANOMALY_EFFECT_LABELS[event.anomalyEffect] || event.anomalyEffect} ×${event.count ?? 1}`
    }
    if (event.kind === "anomaly" && anomalySettlementType(event) === "disorder") {
        const effectId = anomalyEffectId(event)
        const effect = disorderEffects().find(item => item.id === effectId)
        return `${localizedText(effect?.label) || ANOMALY_EFFECT_LABELS[effectId] || effectId} ×${event.count ?? 1}`
    }
    const skill = meta?.agentSkills?.find(item => item.id === event.skillRef?.agentSkillId) ?? agentSkillCatalog()
    const category = damageSkillCategories(skill).find(item => item.id === event.skillRef?.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === event.skillRef?.moveId)
    const row = (move?.rows ?? []).find(item => item.id === event.skillRef?.rowId)
    const label = [category && nameOf(category), move && nameOf(move), row && (localizedText(row.label) || row.id)].filter(Boolean).join(" / ")
    return `${label || "直伤"} ×${event.count ?? 1}`
}

function calculationConfigSummaryText(config = null) {
    const mode = config?.mode ?? calculationConfigMode
    if (mode === "anomaly") {
        return `最大化异常伤害：${calculationEventTitle(anomalyEventFromControls())}`
    }
    const events = config?.events ?? (mode === "single" ? [singleEventFromControls()] : calculationConfigEvents)
    if (!events.length) {
        return mode === "custom" ? "自定义：未配置事件" : "最大化单个伤害"
    }
    const prefix = mode === "custom" ? "自定义" : "单个伤害"
    return `${prefix}：${events.map(calculationEventTitle).join(" + ")}`
}

function syncCalculationConfigSummary() {
    if (els.calculationConfigSummary) {
        els.calculationConfigSummary.textContent = calculationConfigSummaryText()
    }
}

function skillLevelSelects() {
    return SKILL_CATEGORY_ORDER
        .map(([categoryId, , elementKey]) => ({ categoryId, select: els[elementKey] }))
        .filter(item => item.select)
}

function normalizeSkillLevelsByCategory(skill = agentSkillCatalog(), stored = {}) {
    const next = {}
    for (const category of damageSkillCategories(skill)) {
        next[category.id] = clampSkillLevel(category, stored?.[category.id] ?? defaultSkillLevel(category))
    }
    return next
}

function selectedCinemaLevel() {
    const level = Number(els.cinemaLevelSelect?.value ?? 0)
    return Number.isInteger(level) ? Math.max(0, Math.min(6, level)) : 0
}

function cinemaLevelForAgent(agentId = els.agentSelect?.value) {
    const level = Number(configForAgent(agentId).cinemaLevel ?? 0)
    return Number.isInteger(level) ? Math.max(0, Math.min(6, level)) : 0
}

function populateCinemaLevelSelect(preferredLevel = cinemaLevelForAgent()) {
    if (!els.cinemaLevelSelect) {
        return 0
    }
    const selected = Number.isInteger(Number(preferredLevel))
        ? Math.max(0, Math.min(6, Number(preferredLevel)))
        : 0
    els.cinemaLevelSelect.innerHTML = ""
    for (let level = 0; level <= 6; level += 1) {
        const option = document.createElement("option")
        option.value = String(level)
        option.textContent = `${level} 影`
        option.selected = level === selected
        els.cinemaLevelSelect.appendChild(option)
    }
    return selected
}

function resolveDamageSkillRef(ref = null) {
    const skill = agentSkillCatalog()
    if (!skill || !ref) {
        return null
    }
    const category = damageSkillCategories(skill).find(item => item.id === ref.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === ref.moveId)
    const row = (move?.rows ?? []).find(item => item.id === ref.rowId)
    if (!category || !move || !row) {
        return null
    }
    const level = selectedSkillLevel(category)
    const value = skillRowValue(category, move, row, level)
    return {
        skill,
        category,
        move,
        row,
        level,
        value,
        ref: {
            agentSkillId: skill.id,
            categoryId: category.id,
            moveId: move.id,
            rowId: row.id,
            level,
        },
    }
}

function renderDamageSkillSummary() {
    const resolved = resolveDamageSkillRef(selectedDamageSkillRef)
    if (!resolved) {
        selectedDamageSkillRef = null
        if (els.damageSkillSummary) {
            els.damageSkillSummary.textContent = "手填倍率"
        }
        return
    }

    selectedDamageSkillRef = resolved.ref
    if (Number.isFinite(resolved.value)) {
        els.damageSkillMultiplier.value = resolved.value
    }
    if (els.damageSkillSummary) {
        els.damageSkillSummary.textContent = `${nameOf(resolved.category)} / ${nameOf(resolved.move)} / ${localizedText(resolved.row.label) || resolved.row.id} · LV${resolved.level} · ${Number.isFinite(resolved.value) ? `${resolved.value}%` : "-"}`
    }
}

function renderAgentSkillLevelControls() {
    const skill = agentSkillCatalog()
    const categories = new Map(damageSkillCategories(skill).map(category => [category.id, category]))
    if (els.openDamageSkillModalBtn) {
        els.openDamageSkillModalBtn.disabled = categories.size === 0
    }
    for (const [categoryId, , elementKey] of SKILL_CATEGORY_ORDER) {
        const select = els[elementKey]
        if (!select) {
            continue
        }
        const category = categories.get(categoryId)
        select.innerHTML = ""
        if (!category) {
            const option = document.createElement("option")
            option.value = ""
            option.textContent = "未建模"
            select.appendChild(option)
            select.disabled = true
            continue
        }
        const range = skillLevelRange(category)
        const selected = selectedSkillLevel(category)
        for (let level = Number(range.min ?? 1); level <= Number(range.max ?? selected); level += 1) {
            const option = document.createElement("option")
            option.value = String(level)
            option.textContent = `LV${level}`
            option.selected = level === selected
            select.appendChild(option)
        }
        select.disabled = false
    }
    renderDamageSkillSummary()
}

function firstDamageSkillMoveRef(categories = []) {
    for (const category of categories) {
        const move = (category.moves ?? [])[0]
        if (move) {
            return {
                categoryId: category.id,
                moveId: move.id,
            }
        }
    }
    return null
}

function resolveDamageSkillMoveRef(categories = [], ref = null) {
    if (!ref) {
        return null
    }
    const category = categories.find(item => item.id === ref.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === ref.moveId)
    return category && move
        ? {
            category,
            move,
            ref: {
                categoryId: category.id,
                moveId: move.id,
            },
        }
        : null
}

function activeDamageSkillMove(categories = []) {
    const resolved = resolveDamageSkillMoveRef(categories, activeDamageSkillPickerMoveRef)
        ?? resolveDamageSkillMoveRef(categories, selectedDamageSkillRef)
        ?? resolveDamageSkillMoveRef(categories, firstDamageSkillMoveRef(categories))
    activeDamageSkillPickerMoveRef = resolved?.ref ?? null
    return resolved
}

function renderDamageSkillModal() {
    if (!els.damageSkillModalList || !els.damageSkillModalEmpty) {
        return
    }
    const categories = damageSkillCategories(agentSkillCatalog())
    els.damageSkillModalList.innerHTML = ""
    els.damageSkillModalEmpty.hidden = categories.length > 0
    if (!categories.length) {
        activeDamageSkillPickerMoveRef = null
        return
    }

    const active = activeDamageSkillMove(categories)
    const wrapper = document.createElement("div")
    wrapper.className = "damage-skill-cascade"
    const movePane = document.createElement("div")
    movePane.className = "damage-skill-move-pane"
    for (const category of categories) {
        const level = selectedSkillLevel(category)
        const group = document.createElement("section")
        group.className = "damage-skill-move-group"
        group.innerHTML = `<h3>${escapeHtml(nameOf(category))}<span>LV${level}</span></h3>`
        for (const move of category.moves ?? []) {
            const button = document.createElement("button")
            button.type = "button"
            button.className = [
                "damage-skill-move-option",
                active?.category.id === category.id && active?.move.id === move.id ? "active" : "",
            ].filter(Boolean).join(" ")
            button.dataset.pickDamageSkillMove = "true"
            button.dataset.categoryId = category.id
            button.dataset.moveId = move.id
            button.innerHTML = `
                <strong>${escapeHtml(nameOf(move))}</strong>
                <span>${escapeHtml((move.rows ?? []).length)} 项</span>
            `
            group.appendChild(button)
        }
        movePane.appendChild(group)
    }

    const rowPane = document.createElement("div")
    rowPane.className = "damage-skill-row-pane"
    if (active) {
        const level = selectedSkillLevel(active.category)
        rowPane.innerHTML = `
            <div class="damage-skill-row-head">
                <strong>${escapeHtml(nameOf(active.move))}</strong>
                <span>${escapeHtml(nameOf(active.category))} · LV${level}</span>
            </div>
        `
        const rows = document.createElement("div")
        rows.className = "damage-skill-choice-list"
        for (const row of active.move.rows ?? []) {
            const value = skillRowValue(active.category, active.move, row, level)
            const selected = selectedDamageSkillRef?.categoryId === active.category.id
                && selectedDamageSkillRef?.moveId === active.move.id
                && selectedDamageSkillRef?.rowId === row.id
            const choice = document.createElement("div")
            choice.className = ["damage-skill-choice-row", selected ? "active" : ""].filter(Boolean).join(" ")
            choice.innerHTML = `
                <strong>${escapeHtml(localizedText(row.label) || row.id)}</strong>
                <span>${escapeHtml(nameOf(active.move))}</span>
                <b>${Number.isFinite(value) ? `${escapeHtml(value)}%` : "-"}</b>
                <button
                    type="button"
                    class="damage-skill-select-btn"
                    data-select-damage-skill="true"
                    data-category-id="${escapeHtml(active.category.id)}"
                    data-move-id="${escapeHtml(active.move.id)}"
                    data-row-id="${escapeHtml(row.id)}"
                >选取</button>
            `
            rows.appendChild(choice)
        }
        rowPane.appendChild(rows)
    }

    wrapper.append(movePane, rowPane)
    els.damageSkillModalList.appendChild(wrapper)
}

function openDamageSkillModal() {
    if (!els.damageSkillModal) {
        return
    }
    activeDamageSkillPickerMoveRef = selectedDamageSkillRef
        ? {
            categoryId: selectedDamageSkillRef.categoryId,
            moveId: selectedDamageSkillRef.moveId,
        }
        : activeDamageSkillPickerMoveRef
    renderDamageSkillModal()
    els.damageSkillModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeDamageSkillModal() {
    if (!els.damageSkillModal) {
        return
    }
    els.damageSkillModal.hidden = true
    document.body.classList.remove("modal-open")
}

function selectDamageSkill(ref) {
    const resolved = resolveDamageSkillRef(ref)
    selectedDamageSkillRef = resolved?.ref ?? null
    renderDamageSkillSummary()
    syncCalculationConfigSummary()
}

function optionHtml(options = [], selected = "") {
    return options.map(([value, label]) => `
        <option value="${escapeHtml(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>
    `).join("")
}

function calculationSkillCategoryOptions(selected = "") {
    return optionHtml(damageSkillCategories().map(category => [category.id, nameOf(category)]), selected)
}

function calculationSkillMoveOptions(categoryId, selected = "") {
    const category = damageSkillCategories().find(item => item.id === categoryId)
    return optionHtml((category?.moves ?? []).map(move => [move.id, nameOf(move)]), selected)
}

function calculationSkillRowOptions(categoryId, moveId, selected = "") {
    const category = damageSkillCategories().find(item => item.id === categoryId)
    const move = (category?.moves ?? []).find(item => item.id === moveId)
    return optionHtml((move?.rows ?? [])
        .filter(row => (row.kind ?? "damageMultiplier") === "damageMultiplier")
        .map(row => [row.id, localizedText(row.label) || row.id]), selected)
}

function anomalyEffectOptions(selected = "") {
    return optionHtml(anomalyEffects().map(effect => [
        effect.id,
        localizedText(effect.label) || ANOMALY_EFFECT_LABELS[effect.id] || effect.id,
    ]), selected)
}

function disorderEffectOptions(selected = "") {
    return optionHtml(disorderEffects().map(effect => [
        effect.id,
        localizedText(effect.label) || ANOMALY_EFFECT_LABELS[effect.id] || effect.id,
    ]), selected)
}

function calculationEventUiKind(event = {}) {
    return event.kind === "direct" ? "direct" : (anomalySettlementType(event) === "disorder" ? "disorder" : "anomaly")
}

function calculationEventKindLabel(kind) {
    return {
        direct: "直伤",
        anomaly: "属性异常",
        disorder: "紊乱",
    }[kind] ?? "事件"
}

function normalizeCalculationEditingIndex() {
    if (!calculationConfigEvents.length) {
        calculationConfigEditingIndex = 0
        calculationConfigSelectedEventId = null
        return -1
    }
    const selectedIndex = calculationConfigEvents.findIndex(event => event.id === calculationConfigSelectedEventId)
    if (!Number.isInteger(calculationConfigEditingIndex) || calculationConfigEditingIndex < 0 || calculationConfigEditingIndex >= calculationConfigEvents.length) {
        calculationConfigEditingIndex = selectedIndex >= 0 ? selectedIndex : 0
    }
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    return calculationConfigEditingIndex
}

function calculationEventForKind(kind = "direct", previous = {}) {
    const draft = calculationEventDraft(kind)
    return {
        ...draft,
        id: previous.id ?? draft.id,
        count: previous.count ?? draft.count ?? 1,
    }
}

function duplicateCalculationEvent(event = {}) {
    const kind = calculationEventUiKind(event)
    return {
        ...structuredClone(event),
        id: uniqueCalculationEventId(kind),
    }
}

function selectCalculationConfigEvent(index) {
    syncEditingEventFromEditor({ renderList: false })
    calculationConfigEditingIndex = Math.max(0, Math.min(calculationConfigEvents.length - 1, Number(index)))
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function addCalculationConfigEvent(kind = "direct") {
    syncEditingEventFromEditor({ renderList: false })
    calculationConfigEvents.push(calculationEventDraft(kind))
    calculationConfigEditingIndex = calculationConfigEvents.length - 1
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function duplicateCalculationConfigEvent(index = calculationConfigEditingIndex) {
    syncEditingEventFromEditor({ renderList: false })
    const sourceIndex = Math.max(0, Math.min(calculationConfigEvents.length - 1, Number(index)))
    const source = calculationConfigEvents[sourceIndex]
    if (!source) {
        return
    }
    calculationConfigEvents.splice(sourceIndex + 1, 0, duplicateCalculationEvent(source))
    calculationConfigEditingIndex = sourceIndex + 1
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function removeCalculationConfigEvent(index = calculationConfigEditingIndex) {
    syncEditingEventFromEditor({ renderList: false })
    if (!calculationConfigEvents.length) {
        return
    }
    const removeIndex = Math.max(0, Math.min(calculationConfigEvents.length - 1, Number(index)))
    const oldEditingIndex = calculationConfigEditingIndex
    calculationConfigEvents.splice(removeIndex, 1)
    if (removeIndex < oldEditingIndex) {
        calculationConfigEditingIndex = oldEditingIndex - 1
    } else if (removeIndex === oldEditingIndex) {
        calculationConfigEditingIndex = Math.min(removeIndex, calculationConfigEvents.length - 1)
    }
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function calculationEventListItemHtml(event = {}, index = 0) {
    const kind = calculationEventUiKind(event)
    const active = index === calculationConfigEditingIndex
    return `
        <article class="calculation-event-list-item${active ? " active" : ""}" data-calculation-event-index="${index}">
          <button type="button" class="calculation-event-select" data-select-calculation-event="${index}">
            <span class="calculation-event-order">#${index + 1}</span>
            <span class="calculation-event-copy">
              <strong>${escapeHtml(calculationEventKindLabel(kind))} · ${escapeHtml(calculationEventTitle(event))}</strong>
              <small>${escapeHtml(`次数 ×${event.count ?? 1}`)}</small>
            </span>
          </button>
          <div class="calculation-event-inline-actions">
            <button type="button" class="compact-btn" data-duplicate-calculation-event="${index}" aria-label="复制事件 ${index + 1}">复制</button>
            <button type="button" class="compact-btn danger-lite" data-remove-calculation-event="${index}" aria-label="删除事件 ${index + 1}">删除</button>
          </div>
        </article>
    `
}

function calculationEventEditorHtml(event = {}) {
    const kind = event.kind === "direct" ? "direct" : (anomalySettlementType(event) === "disorder" ? "disorder" : "anomaly")
    const skillRef = kind === "direct" ? (stripSkillRefLevel(event.skillRef) ?? firstDamageSkillRef()) : null
    const categoryId = skillRef?.categoryId ?? damageSkillCategories()[0]?.id ?? ""
    const moveId = skillRef?.moveId ?? damageSkillCategories().find(item => item.id === categoryId)?.moves?.[0]?.id ?? ""
    const rowId = skillRef?.rowId ?? damageSkillCategories().find(item => item.id === categoryId)?.moves?.find(item => item.id === moveId)?.rows?.[0]?.id ?? ""
    return `
        <label class="field">
          <span>类型</span>
          <select data-calculation-event-kind>${optionHtml([["direct", "直伤"], ["anomaly", "属性异常"], ["disorder", "紊乱"]], kind)}</select>
        </label>
        <label class="field">
          <span>次数</span>
          <input data-calculation-event-count type="number" min="0" step="1" value="${escapeHtml(event.count ?? 1)}">
        </label>
        <label class="field calculation-direct-only"${kind === "direct" ? "" : " hidden"}>
          <span>技能大类</span>
          <select data-calculation-skill-category>${calculationSkillCategoryOptions(categoryId)}</select>
        </label>
        <label class="field calculation-direct-only"${kind === "direct" ? "" : " hidden"}>
          <span>招式</span>
          <select data-calculation-skill-move>${calculationSkillMoveOptions(categoryId, moveId)}</select>
        </label>
        <label class="field calculation-direct-only"${kind === "direct" ? "" : " hidden"}>
          <span>倍率行</span>
          <select data-calculation-skill-row>${calculationSkillRowOptions(categoryId, moveId, rowId)}</select>
        </label>
        <label class="field calculation-direct-only"${kind === "direct" ? "" : " hidden"}>
          <span>暴击模式</span>
          <select data-calculation-crit-mode>${optionHtml([["expected", "期望"], ["crit", "暴击"], ["nonCrit", "非暴击"]], event.critMode ?? "expected")}</select>
        </label>
        <label class="field calculation-anomaly-only"${kind === "anomaly" ? "" : " hidden"}>
          <span>异常类型</span>
          <select data-calculation-anomaly-effect>${anomalyEffectOptions(event.anomalyEffect ?? defaultAnomalyEffectIdForAgent())}</select>
        </label>
        <label class="field calculation-anomaly-only"${kind === "anomaly" ? "" : " hidden"}>
          <span>结算次数</span>
          <input data-calculation-proc-count type="number" min="0" step="1" value="${escapeHtml(event.procCount ?? 1)}">
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>紊乱类型</span>
          <select data-calculation-disorder-effect>${disorderEffectOptions(anomalyEffectId(event) || "burn")}</select>
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>已生效秒数</span>
          <input data-calculation-elapsed type="number" min="0" step="0.1" value="${escapeHtml(event.elapsedSeconds ?? 0)}">
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>持续秒数</span>
          <input data-calculation-duration type="number" min="0" step="0.1" value="${escapeHtml(event.durationSeconds ?? 10)}">
        </label>
    `
}

function renderCalculationConfigEventList(events = calculationConfigEvents) {
    if (!els.calculationConfigEventList) {
        return
    }
    els.calculationConfigEventList.innerHTML = events.length
        ? events.map(calculationEventListItemHtml).join("")
        : `<div class="calculation-event-empty">还没有目标事件</div>`
    if (els.calculationConfigEventCount) {
        els.calculationConfigEventCount.textContent = `${events.length} 项`
    }
}

function renderCalculationEventEditor() {
    const index = normalizeCalculationEditingIndex()
    const event = index >= 0 ? calculationConfigEvents[index] : null
    if (els.calculationEventEditorTitle) {
        els.calculationEventEditorTitle.textContent = event ? calculationEventTitle(event) : "添加一个事件开始配置"
    }
    if (els.calculationEventEditorFields) {
        els.calculationEventEditorFields.innerHTML = event
            ? calculationEventEditorHtml(event)
            : `<div class="calculation-event-editor-empty">左侧添加直伤、属性异常或紊乱事件。</div>`
    }
    if (els.duplicateCalculationEventBtn) {
        els.duplicateCalculationEventBtn.disabled = !event
    }
    if (els.removeCalculationEventBtn) {
        els.removeCalculationEventBtn.disabled = !event
    }
}

function syncCalculationConfigModalSummary() {
    if (els.calculationConfigFooterSummary) {
        const mode = els.calculationConfigMode?.value ?? calculationConfigMode
        const events = mode === "custom"
            ? calculationConfigEvents
            : mode === "anomaly"
                ? [anomalyEventFromControls()]
                : [singleEventFromControls()]
        els.calculationConfigFooterSummary.textContent = calculationConfigSummaryText({ mode, events })
    }
}

function renderCalculationConfigEvents(events = calculationConfigEvents) {
    calculationConfigEvents = events
    normalizeCalculationEditingIndex()
    renderCalculationConfigEventList()
    renderCalculationEventEditor()
    syncCalculationConfigModalSummary()
}

function syncCalculationConfigModeFields() {
    const mode = els.calculationConfigMode?.value ?? calculationConfigMode
    if (els.calculationConfigEventList) {
        els.calculationConfigEventList.closest(".calculation-config-events").hidden = mode !== "custom"
    }
    for (const button of [
        els.addCalculationDirectEventBtn,
        els.addCalculationAnomalyEventBtn,
        els.addCalculationDisorderEventBtn,
    ]) {
        if (button) {
            button.hidden = mode !== "custom"
        }
    }
    renderCalculationObjectiveControls()
    syncCalculationConfigModalSummary()
}

function readCalculationEventFromEditor(index = calculationConfigEditingIndex) {
    const current = calculationConfigEvents[index]
    if (!current || !els.calculationEventEditorFields) {
        return current
    }
    const kind = els.calculationEventEditorFields.querySelector("[data-calculation-event-kind]")?.value ?? calculationEventUiKind(current)
    const count = Number(els.calculationEventEditorFields.querySelector("[data-calculation-event-count]")?.value || 1)
    if (kind === "anomaly") {
        return {
            id: current.id,
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffect: els.calculationEventEditorFields.querySelector("[data-calculation-anomaly-effect]")?.value || defaultAnomalyEffectIdForAgent(),
            procCount: Number(els.calculationEventEditorFields.querySelector("[data-calculation-proc-count]")?.value || 1),
            count,
        }
    }
    if (kind === "disorder") {
        return {
            id: current.id,
            kind: "anomaly",
            settlementType: "disorder",
            anomalyEffect: els.calculationEventEditorFields.querySelector("[data-calculation-disorder-effect]")?.value || "burn",
            elapsedSeconds: Number(els.calculationEventEditorFields.querySelector("[data-calculation-elapsed]")?.value || 0),
            durationSeconds: Number(els.calculationEventEditorFields.querySelector("[data-calculation-duration]")?.value || 10),
            count,
        }
    }
    const skill = agentSkillCatalog()
    return {
        id: current.id,
        kind: "direct",
        count,
        critMode: els.calculationEventEditorFields.querySelector("[data-calculation-crit-mode]")?.value || "expected",
        skillRef: {
            agentSkillId: skill?.id ?? "",
            categoryId: els.calculationEventEditorFields.querySelector("[data-calculation-skill-category]")?.value ?? "",
            moveId: els.calculationEventEditorFields.querySelector("[data-calculation-skill-move]")?.value ?? "",
            rowId: els.calculationEventEditorFields.querySelector("[data-calculation-skill-row]")?.value ?? "",
        },
    }
}

function syncEditingEventFromEditor({ renderList = true } = {}) {
    if ((els.calculationConfigMode?.value ?? calculationConfigMode) !== "custom") {
        return
    }
    const index = normalizeCalculationEditingIndex()
    if (index < 0 || !els.calculationEventEditorFields?.querySelector("[data-calculation-event-kind]")) {
        return
    }
    calculationConfigEvents[index] = readCalculationEventFromEditor(index)
    calculationConfigSelectedEventId = calculationConfigEvents[index]?.id ?? null
    if (renderList) {
        renderCalculationConfigEventList()
        if (els.calculationEventEditorTitle) {
            els.calculationEventEditorTitle.textContent = calculationEventTitle(calculationConfigEvents[index])
        }
        syncCalculationConfigModalSummary()
    }
}

function readCalculationConfigEventsFromModal() {
    syncEditingEventFromEditor({ renderList: false })
    return [...calculationConfigEvents]
}

function adminDefaultCalculationText(config = null) {
    if (!config?.events?.length) {
        return "未配置"
    }
    const name = localizedText(config.name) || "管理员默认"
    return `${name} · ${config.events.length} 个事件`
}

function renderCalculationConfigModal() {
    if (!els.calculationConfigModal) {
        return
    }
    if (els.calculationConfigMode) {
        els.calculationConfigMode.value = calculationConfigMode
    }
    const selectedIndex = calculationConfigEvents.findIndex(event => event.id === calculationConfigSelectedEventId)
    if (selectedIndex >= 0) {
        calculationConfigEditingIndex = selectedIndex
    }
    const defaultConfig = getAgent(els.agentSelect.value)?.defaultCalculationConfig
    if (els.adminDefaultCalculationSummary) {
        els.adminDefaultCalculationSummary.textContent = adminDefaultCalculationText(defaultConfig)
        els.adminDefaultCalculationSummary.title = defaultConfig ? calculationConfigSummaryText(defaultConfig) : ""
    }
    if (els.applyAdminDefaultCalculationBtn) {
        els.applyAdminDefaultCalculationBtn.disabled = !defaultConfig
    }
    renderCalculationConfigEvents()
    syncCalculationConfigModeFields()
}

function openCalculationConfigModal() {
    renderCalculationConfigModal()
    els.calculationConfigModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeCalculationConfigModal() {
    els.calculationConfigModal.hidden = true
    document.body.classList.remove("modal-open")
}

function applyCalculationConfig(config = {}) {
    const next = calculationConfigFromStored(config)
    calculationConfigMode = next.mode
    calculationConfigEvents = next.events.length ? next.events : calculationConfigEvents
    calculationConfigSelectedEventId = next.selectedEventId ?? calculationConfigEvents[0]?.id ?? null
    const selected = calculationConfigEvents.find(event => event.id === calculationConfigSelectedEventId) ?? calculationConfigEvents[0]
    if (selected) {
        applyStoredDamageConfig({
            mode: "single",
            selectedEventId: selected.id,
            events: [selected],
            skillLevelsByCategory: damageSkillLevelsByCategory,
            target: collectDamageTargetConfig(),
        })
        calculationConfigMode = next.mode
        calculationConfigEvents = next.events
        calculationConfigSelectedEventId = next.selectedEventId ?? selected.id
        calculationConfigEditingIndex = Math.max(0, calculationConfigEvents.findIndex(event => event.id === calculationConfigSelectedEventId))
    }
    syncCalculationConfigSummary()
    renderCalculationObjectiveControls()
}

function applyStoredDamageConfig(config = {}) {
    const calculationConfig = calculationConfigFromStored(config)
    calculationConfigMode = calculationConfig.mode
    calculationConfigEvents = calculationConfig.events
    calculationConfigSelectedEventId = calculationConfig.selectedEventId
    calculationConfigEditingIndex = Math.max(0, calculationConfigEvents.findIndex(event => event.id === calculationConfigSelectedEventId))
    const target = config.target ?? {}
    const damageElement = currentDamageElement()
    const selectedEvent = calculationConfig.events.find(event => event.id === calculationConfig.selectedEventId)
        ?? calculationConfig.events[0]
        ?? { kind: "direct" }
    activeDamageResistanceElement = damageElement
    for (const element of DAMAGE_ELEMENTS) {
        damageTargetResistanceByElement[element] = Number(target.resistanceByElement?.[element] ?? target.resistance ?? 0)
    }
    if (els.agentLevelInput) {
        els.agentLevelInput.value = config.agentLevel ?? 60
    }
    els.damageTargetPreset.value = target.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID
    els.damageTargetDefense.value = target.defense ?? damageTargetPresetById(els.damageTargetPreset.value)?.defense ?? 953
    els.damageLevelCoefficient.value = target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT
    els.damageTargetResistance.value = damageTargetResistanceByElement[damageElement] ?? 0
    if (selectedEvent.kind === "direct") {
        els.damageSkillMultiplier.value = selectedEvent.skillMultiplier ?? config.skillMultiplier ?? 100
        els.damageCritMode.value = selectedEvent.critMode ?? config.critMode ?? "expected"
    } else {
        const settlementType = anomalySettlementType(selectedEvent)
        if (els.damageAnomalySettlementType) {
            els.damageAnomalySettlementType.value = settlementType
        }
        if (settlementType === "disorder") {
            els.damageDisorderEffect.value = anomalyEffectId(selectedEvent) || "burn"
            els.damageDisorderElapsed.value = selectedEvent.elapsedSeconds ?? 0
            els.damageDisorderDuration.value = selectedEvent.durationSeconds ?? 10
        } else if (els.damageAnomalyEffect) {
            els.damageAnomalyEffect.value = selectedEvent.anomalyEffect ?? "assault"
            const defaultProcCount = els.damageAnomalyEffect.selectedOptions?.[0]?.dataset.defaultProcCount
            els.damageAnomalyProcCount.value = selectedEvent.procCount ?? defaultProcCount ?? 1
        }
    }
    const storedSkillRef = selectedEvent.skillRef ?? config.skillRef ?? null
    const skillCatalog = agentSkillCatalog()
    damageSkillLevelsByCategory = normalizeSkillLevelsByCategory(skillCatalog, config.skillLevelsByCategory ?? {})
    if (storedSkillRef?.categoryId && config.skillLevelsByCategory?.[storedSkillRef.categoryId] === undefined) {
        const category = damageSkillCategories(skillCatalog).find(item => item.id === storedSkillRef.categoryId)
        if (category) {
            damageSkillLevelsByCategory[category.id] = clampSkillLevel(category, storedSkillRef.level)
        }
    }
    selectedDamageSkillRef = storedSkillRef
    renderAgentSkillLevelControls()
    renderCalculationObjectiveControls()
    syncDamageResistanceControlsToAgent()
    syncDamagePresetFromDefense()
    syncCalculationConfigSummary()
}

function syncDamageDefenseToPreset() {
    const preset = damageTargetPresetById(els.damageTargetPreset.value)
    if (preset) {
        els.damageTargetDefense.value = preset.defense
    }
    syncDamagePresetFromDefense()
}

function syncDamagePresetFromDefense() {
    const defense = Number(els.damageTargetDefense.value)
    let matched = false
    for (const option of els.damageTargetPreset.options) {
        const preset = damageTargetPresetById(option.value)
        const isMatch = preset && Number(preset.defense) === defense
        option.selected = isMatch
        matched = matched || isMatch
    }
    if (!matched && els.damageTargetPreset.querySelector("option[value='custom']")) {
        els.damageTargetPreset.value = "custom"
    }
}

function persistCurrentDamageResistanceInput() {
    if (!activeDamageResistanceElement) {
        activeDamageResistanceElement = currentDamageElement()
    }
    damageTargetResistanceByElement[activeDamageResistanceElement] = Number(els.damageTargetResistance.value || 0)
}

function syncDamageResistancePresetFromValue() {
    const value = String(Number(els.damageTargetResistance.value || 0))
    let matched = false
    for (const button of els.damageTargetResistancePreset.querySelectorAll("[data-resistance-preset]")) {
        const preset = button.dataset.resistancePreset
        const active = preset !== "custom" && String(Number(preset)) === value
        button.classList.toggle("active", active)
        matched = matched || active
    }
    const customButton = els.damageTargetResistancePreset.querySelector("[data-resistance-preset='custom']")
    if (customButton) {
        customButton.classList.toggle("active", !matched)
    }
    els.damageTargetResistance.hidden = matched
}

function syncDamageResistanceToPreset(value) {
    if (value === "custom") {
        els.damageTargetResistance.hidden = false
        els.damageTargetResistance.focus()
        syncDamageResistancePresetFromValue()
        return
    }
    if (!RESISTANCE_PRESET_VALUES.has(String(value))) {
        return
    }
    els.damageTargetResistance.value = Number(value)
    persistCurrentDamageResistanceInput()
    syncDamageResistancePresetFromValue()
}

function syncDamageResistanceControlsToAgent() {
    const element = currentDamageElement()
    activeDamageResistanceElement = element
    els.damageTargetResistance.value = damageTargetResistanceByElement[element] ?? 0
    if (els.damageTargetResistanceLabel) {
        els.damageTargetResistanceLabel.textContent = `Boss ${damageElementShortLabel(element)}抗性`
    }
    syncDamageResistancePresetFromValue()
}

function effectStats(effect) {
    return SharedCombat.effectStats(effect)
}

function effectRules(effect) {
    return SharedCombat.effectRules(effect)
}

function effectStatText(effect) {
    return effectRules(effect)
        .map(rule => {
            if (rule.type === "damageModifier") {
                return `${damageModifierOptionText(rule)} +${formatStoredValue("dmgBonus", Number(rule.value ?? 0), "flat")}`
            }
            if (!rule.stat) {
                return ""
            }
            const value = rule.type === "stacked"
                ? Number(rule.valuePerStack ?? rule.value ?? 0) * Number(rule.defaultStacks ?? rule.maxStacks ?? 1)
                : Number(rule.value ?? 0)
            return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, value, rule.mode)}`
        })
        .filter(Boolean)
        .join(" / ")
}

function defaultRuntimeForBuff(buff = {}) {
    return SharedCombat.defaultRuntimeForBuff(buff)
}

function runtimeForBuff(item, buff) {
    return SharedCombat.runtimeForBuff(item, buff)
}

function storedEffectRulesText(effect, runtime = defaultRuntimeForBuff(effect)) {
    return combatUi.storedEffectRulesText(effect, runtime)
}

function storedBuffModifierTexts(effect) {
    return combatUi.storedBuffModifierTexts(effect)
}

function setCombatStatLines(container, lines = []) {
    container.textContent = ""
    for (const line of lines.filter(Boolean)) {
        const item = document.createElement("span")
        item.textContent = line
        container.appendChild(item)
    }
}

function renderBuffEffectLines(container, buff, runtime = defaultRuntimeForBuff(buff), options = {}) {
    const normalText = storedEffectRulesText(buff, runtime) || options.fallbackText || ""
    const modifierTexts = storedBuffModifierTexts(buff)
    const lines = [
        normalText ? `${options.normalPrefix ?? ""}${normalText}` : "",
        ...modifierTexts,
    ].filter(Boolean)
    setCombatStatLines(container, lines.length ? lines : [options.emptyText ?? "-"])
}

function storedEffectRuleText(rule, runtime, effect) {
    const id = rule.id ?? rule.stat ?? "effect"
    const coverage = Number(runtime?.coverage ?? effect?.coverage?.default ?? 1)
    const ruleRuntime = runtime?.effects?.[id] ?? {}
    if (rule.type === "derived") {
        const sourceValue = Number(ruleRuntime.sourceValue ?? rule.defaultSourceValue ?? 0)
        const ratio = Number(rule.ratio ?? rule.ratioPct ?? 0)
        const uncapped = sourceValue * ratio / 100
        const capped = Number.isFinite(Number(rule.cap)) ? Math.min(uncapped, Number(rule.cap)) : uncapped
        const finalValue = capped * coverage
        const source = localizedText(rule.sourceLabel) || "来源数值"
        const capText = Number.isFinite(Number(rule.cap)) ? `，上限 ${rule.cap}` : ""
        return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, finalValue, rule.mode)}（${source} ${sourceValue} × ${ratio}%${capText}，覆盖率 ${coverage}）`
    }
    if (rule.type === "formula") {
        const source = rule.source ?? {}
        const rawSourceValue = Number(ruleRuntime.sourceValue ?? source.defaultValue ?? 0)
        const sourceValue = Math.max(
            Number.isFinite(Number(source.min)) ? Number(source.min) : rawSourceValue,
            Math.min(Number.isFinite(Number(source.max)) ? Number(source.max) : rawSourceValue, rawSourceValue),
        )
        const expression = rule.formula?.expression ?? ""
        try {
            const finalValue = evaluateFormulaExpression(expression, { [source.variable ?? "x"]: sourceValue }) * coverage
            const sourceLabel = localizedText(source.label ?? rule.sourceLabel) || "来源数值"
            const coverageText = coverage !== 1 ? `，覆盖率 ${coverage}` : ""
            return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, finalValue, rule.mode)}（${sourceLabel} x=${sourceValue}；公式 ${expression}${coverageText}）`
        } catch {
            return `${statLabel(rule.stat)}：公式无效`
        }
    }
    if (rule.type === "stacked") {
        const stacks = Number(ruleRuntime.stacks ?? rule.defaultStacks ?? rule.maxStacks ?? 1)
        const value = Number(rule.valuePerStack ?? rule.value ?? 0) * stacks * coverage
        return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, value, rule.mode)}（${stacks}/${rule.maxStacks ?? stacks} 层，覆盖率 ${coverage}）`
    }
    const value = Number(rule.value ?? 0) * coverage
    return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, value, rule.mode)}${coverage !== 1 ? `（覆盖率 ${coverage}）` : ""}`
}

function combatBuffsByType(sourceType) {
    return (meta?.combatBuffs ?? []).filter(item => item.sourceType === sourceType)
}

function teammateCombatBuffGroups() {
    const groupedIds = new Set()
    const groups = (meta?.teammateCombatBuffGroups ?? [])
        .map(group => {
            const buffs = (group.buffs ?? []).map(buff => {
                groupedIds.add(buff.id)
                return {
                    ...buff,
                    sourceType: "teammate",
                    teammateId: group.id,
                    teammateName: group.name,
                }
            })
            return { ...group, buffs }
        })
        .filter(group => group.buffs.length > 0)
    const fallbackBuffs = combatBuffsByType("teammate").filter(buff => !groupedIds.has(buff.id))
    if (fallbackBuffs.length) {
        groups.push({
            id: "ungrouped",
            name: { zhCN: "其他队友", en: "Other Teammates" },
            buffs: fallbackBuffs,
        })
    }
    return groups
}

function cinemaBuffName(buff = {}) {
    const level = Number(buff.cinemaLevel)
    const prefix = Number.isInteger(level) ? `影画${level}` : "影画"
    return {
        zhCN: [prefix, localizedText(buff.cinemaName)].filter(Boolean).join("｜"),
    }
}

function agentCombatBuffs() {
    const agent = getAgent(els.agentSelect.value)
    const labels = { corePassive: "核心被动", additionalAbility: "额外能力" }
    const combatBuffs = agent?.combatBuffs ?? {}
    const unlockedCinemaLevel = selectedCinemaLevel()
    const fixedBuffs = [
        ["corePassive", combatBuffs.corePassive],
        ["additionalAbility", combatBuffs.additionalAbility],
    ]
        .filter(([, buff]) => buff?.scope === "inCombat")
        .map(([key, buff]) => ({
            id: `agent:${agent.id}.${key}`,
            sourceType: "self",
            name: buff.name ?? { zhCN: labels[key] ?? key },
            description: buff.description ?? null,
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            effects: buff.effects ?? null,
            stats: effectStats(buff),
            coverage: buff.coverage ?? null,
        }))
    const cinemaBuffs = (combatBuffs.cinemaBuffs ?? [])
        .filter(buff => {
            const level = Number(buff?.cinemaLevel)
            return buff?.scope === "inCombat"
                && Number.isInteger(level)
                && level >= 1
                && level <= unlockedCinemaLevel
        })
        .map(buff => ({
            id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
            sourceType: "self",
            sourceKind: "cinema",
            defaultChecked: buff.defaultChecked ?? false,
            name: buff.name ?? cinemaBuffName(buff),
            description: buff.description ?? null,
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            effects: buff.effects ?? null,
            stats: effectStats(buff),
            coverage: buff.coverage ?? null,
        }))
    return [...fixedBuffs, ...cinemaBuffs]
}

function wEngineEffectData(wEngine) {
    if (wEngine?.effect) {
        return wEngine.effect
    }
    if (wEngine?.passive) {
        return {
            name: wEngine.passive.name,
            description: null,
            requirement: wEngine.specialty ? { specialty: wEngine.specialty } : null,
            buff: wEngine.passive,
        }
    }
    return null
}

function wEngineEffectSelfBuff(wEngine) {
    const effect = wEngineEffectData(wEngine)
    return effect?.selfBuff ?? wEngine?.selfBuff ?? effect?.buff ?? wEngine?.passive ?? null
}

function wEngineEffectTeamBuff(wEngine) {
    const effect = wEngineEffectData(wEngine)
    return effect?.teamBuff ?? wEngine?.teamBuff ?? null
}

function wEngineSelfBuffKey(wEngine) {
    return `wEngine:${wEngine.id}.self`
}

function wEngineTeamBuffKey(wEngine) {
    return `wEngine:${wEngine.id}.team`
}

function wEngineIdFromTeamBuffKey(key) {
    const match = String(key ?? "").match(/^wEngine:(.+)\.team$/)
    return match?.[1] ?? ""
}

function rawWEngineForTeamBuffKey(key) {
    const wEngineId = wEngineIdFromTeamBuffKey(key)
    return meta?.wEngines?.find(item => item.id === wEngineId) ?? null
}

function wEngineTeamModificationLevelForItem(item) {
    return SharedCombat.clampWEngineModificationLevel(
        item?.wEngineModificationLevel,
        rawWEngineForTeamBuffKey(item?.id) ?? {},
    )
}

function wEngineTeamBuffCandidateFromWEngine(wEngine, modificationLevel = 1) {
    if (!wEngine) {
        return null
    }
    const materializedWEngine = SharedCombat.materializeWEngineForModificationLevel(wEngine, modificationLevel)
    const effect = wEngineEffectData(materializedWEngine)
    const buff = wEngineEffectTeamBuff(materializedWEngine)
    if (!buff || buff.scope !== "inCombat") {
        return null
    }
    return {
        id: wEngineTeamBuffKey(materializedWEngine),
        sourceType: "wEngineTeam",
        sourceCategory: "wEngine",
        sourceKind: "wEngineTeam",
        wEngineModificationLevel: materializedWEngine.selectedModificationLevel ?? 1,
        ownerName: materializedWEngine.name,
        name: effect?.name ?? buff.name ?? materializedWEngine.name,
        description: effect?.description ?? buff.description ?? buff.conditionLabel,
        conditionLabel: buff.condition ?? effect?.requirement?.label,
        stats: effectStats(buff),
        effects: buff.effects ?? null,
        buffModifiers: buff.buffModifiers ?? null,
        coverage: buff.coverage ?? null,
    }
}

function wEngineEquippedBuffs() {
    const wEngine = currentWEngineWithModification()
    const effect = wEngineEffectData(wEngine)
    if (!wEngine) {
        return []
    }
    const entries = [
        {
            id: wEngineSelfBuffKey(wEngine),
            sourceType: "wEngine",
            name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（限佩戴者）` },
            buff: wEngineEffectSelfBuff(wEngine),
        },
        {
            id: wEngineTeamBuffKey(wEngine),
            sourceType: "wEngineTeam",
            name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（团队）` },
            buff: wEngineEffectTeamBuff(wEngine),
        },
    ]
    return entries
        .filter(item => item.buff?.scope === "inCombat")
        .map(item => ({
            id: item.id,
            sourceType: item.sourceType,
            name: item.name,
            description: effect?.description ?? item.buff.description ?? null,
            conditionLabel: localizedText(effect?.requirement?.label) || item.buff.condition,
            effects: item.buff.effects ?? null,
            stats: effectStats(item.buff),
            coverage: item.buff.coverage ?? null,
        }))
}

function normalizeCustomBuffStat(stat) {
    return SharedCombat.normalizeCustomBuffStat(stat, meta)
}

function resolveCustomBuffStatOption(stat) {
    if (stat === "enemyDefIgnore") {
        return "enemyDefReduction"
    }

    if (stat === "currentResIgnore") {
        return RES_IGNORE_STAT_BY_ELEMENT[currentDamageElement()] ?? "physicalResIgnore"
    }
    return stat
}

function resolveCustomBuffStatLabel(stat, fallbackLabel) {
    const elementLabel = damageElementShortLabel(currentDamageElement())
    if (stat === "currentResIgnore") {
        return `${elementLabel}抗性无视%`
    }
    if (stat === "enemyResReduction") {
        return `${elementLabel}减抗%`
    }
    return fallbackLabel
}

function damageModifierOptionText(effect = {}) {
    const appliesTo = effect.appliesTo ?? {}
    const scopes = [
        ...(appliesTo.damageKinds ?? []).map(kind => ({ anomaly: "异常", disorder: "紊乱", direct: "直伤" }[kind] ?? kind)),
        ...(appliesTo.anomalyEffects ?? []).map(item => ANOMALY_EFFECT_LABELS[item] ?? item),
        ...(appliesTo.elements ?? []).map(item => damageElementShortLabel(item)),
        ...(appliesTo.skillTargets ?? []).map(item => skillTargetLabel(item)),
    ]
    return `${DAMAGE_MODIFIER_KIND_LABELS[effect.kind] ?? effect.kind}${scopes.length ? `（${scopes.join(" / ")}）` : ""}`
}

function agentSkillOptions() {
    return (meta?.agentSkills ?? []).map(skill => [skill.id, nameOf(skill)])
}

function agentSkillById(agentSkillId) {
    return (meta?.agentSkills ?? []).find(skill => skill.id === agentSkillId) ?? null
}

function skillTargetLabel(target = {}) {
    const skillSet = agentSkillById(target.agentSkillId)
    const agentName = skillSet?.agentId ? nameOf(getAgent(skillSet.agentId)) : ""
    const skillSetName = nameOf(skillSet)
    const agentLabel = String((agentName && agentName !== "-" ? agentName : "")
        || (skillSetName && skillSetName !== "-" ? skillSetName : "")
        || target.agentSkillId
        || "")
        .replace(/技能倍率$/, "")
        .trim()
    const category = (skillSet?.categories ?? []).find(item => item.id === target.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === target.moveId)
    const row = damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {}).find(item => item.id === target.rowId)
    return [
        agentLabel,
        nameOf(move) || target.moveId,
        target.rowId ? localizedText(row?.label) || target.rowId : "",
    ].filter(Boolean).join("/")
}

function customSkillTargetFields(target = {}) {
    const skills = agentSkillOptions()
    const selectedSkillId = target.agentSkillId || agentSkillCatalog()?.id || skills[0]?.[0] || ""
    const skillSet = agentSkillById(selectedSkillId)
    const categories = damageSkillCategories(skillSet)
    const selectedCategoryId = target.categoryId || categories[0]?.id || ""
    const category = categories.find(item => item.id === selectedCategoryId) ?? categories[0] ?? null
    const moves = category?.moves ?? []
    const selectedMoveId = target.moveId || moves[0]?.id || ""
    const move = moves.find(item => item.id === selectedMoveId) ?? moves[0] ?? null
    const rowOptions = [
        ["", "整招式"],
        ...damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {}).map(row => [row.id, localizedText(row.label) || row.id]),
    ]
    return { skills, selectedSkillId, categories, selectedCategoryId, moves, selectedMoveId, rowOptions }
}

function populateCustomSkillTargetSelect(select, options, selected = "") {
    select.innerHTML = ""
    for (const [value, label] of options) {
        const option = document.createElement("option")
        option.value = value
        option.textContent = label
        option.selected = value === selected
        select.appendChild(option)
    }
}

function syncCustomSkillTargetFields(targetWrap, target = null) {
    if (!targetWrap) {
        return
    }
    const current = target ?? {
        agentSkillId: targetWrap.querySelector("[data-custom-skill-agent]")?.value ?? "",
        categoryId: targetWrap.querySelector("[data-custom-skill-category]")?.value ?? "",
        moveId: targetWrap.querySelector("[data-custom-skill-move]")?.value ?? "",
        rowId: targetWrap.querySelector("[data-custom-skill-row-id]")?.value ?? "",
    }
    const fields = customSkillTargetFields(current)
    populateCustomSkillTargetSelect(targetWrap.querySelector("[data-custom-skill-agent]"), fields.skills, fields.selectedSkillId)
    populateCustomSkillTargetSelect(targetWrap.querySelector("[data-custom-skill-category]"), fields.categories.map(item => [item.id, nameOf(item)]), fields.selectedCategoryId)
    populateCustomSkillTargetSelect(targetWrap.querySelector("[data-custom-skill-move]"), fields.moves.map(item => [item.id, nameOf(item)]), fields.selectedMoveId)
    populateCustomSkillTargetSelect(targetWrap.querySelector("[data-custom-skill-row-id]"), fields.rowOptions, current.rowId ?? "")
}

function customSkillTargetRow(target = {}, index = 0) {
    const targetField = document.createElement("div")
    targetField.className = "custom-skill-target-row"
    targetField.dataset.customSkillTarget = String(index)
    targetField.innerHTML = `
        <label class="field">
          <span>技能表</span>
          <select data-custom-skill-agent></select>
        </label>
        <label class="field">
          <span>技能大类</span>
          <select data-custom-skill-category></select>
        </label>
        <label class="field">
          <span>招式</span>
          <select data-custom-skill-move></select>
        </label>
        <label class="field">
          <span>倍率行</span>
          <select data-custom-skill-row-id></select>
        </label>
        <button type="button" class="compact-btn" data-remove-custom-skill-target="${index}">删除目标</button>
    `
    syncCustomSkillTargetFields(targetField, target)
    return targetField
}

function readCustomSkillTargets(row) {
    return [...row.querySelectorAll("[data-custom-skill-target]")]
        .map(targetRow => {
            const target = {
                agentSkillId: targetRow.querySelector("[data-custom-skill-agent]")?.value ?? "",
                categoryId: targetRow.querySelector("[data-custom-skill-category]")?.value ?? "",
                moveId: targetRow.querySelector("[data-custom-skill-move]")?.value ?? "",
            }
            const rowId = targetRow.querySelector("[data-custom-skill-row-id]")?.value ?? ""
            if (rowId) {
                target.rowId = rowId
            }
            return target
        })
        .filter(target => target.agentSkillId && target.categoryId && target.moveId)
}

function normalizeCustomBuffEffect(effect) {
    return SharedCombat.normalizeCustomBuffEffect(effect)
}

function isDriveDiscAddedBuff(item) {
    return item?.sourceKind === "ownDriveDisc4pc"
        || (item?.sourceCategory === "driveDisc" && item?.sourceKind !== "teammateDriveDisc4pc")
}

function sanitizeAddedCombatBuffs(addedBuffs = []) {
    return combatUi.sanitizeAddedCombatBuffs(addedBuffs)
}

function combatConfigForAgent(agentId) {
    return combatUi.combatConfigForAgent(agentId)
}

function currentAddedCombatBuffs() {
    return combatConfigForAgent(els.agentSelect.value).addedBuffs.filter(item => !isDriveDiscAddedBuff(item))
}

function hiddenDriveDiscAddedBuffs() {
    return combatConfigForAgent(els.agentSelect.value).addedBuffs.filter(isDriveDiscAddedBuff)
}

function isResolvableAddedCombatBuff(item) {
    if (item?.sourceKind === "custom") {
        return true
    }
    return Boolean(resolveAddedCombatBuff(item)?.id)
}

function saveCurrentAddedCombatBuffs(addedBuffs) {
    const agentId = els.agentSelect.value
    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previous = byAgent[agentId] ?? {}
    const hidden = hiddenDriveDiscAddedBuffs()
    byAgent[agentId] = {
        ...previous,
        combat: {
            ...(previous.combat ?? {}),
            addedBuffs: sanitizeAddedCombatBuffs([...hidden, ...addedBuffs])
                .filter(item => isDriveDiscAddedBuff(item) || isResolvableAddedCombatBuff(item)),
        },
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
}

function updateAddedCombatBuffRuntime(buffKey, updater) {
    saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().map(item => {
        if (addedCombatBuffKey(item) !== buffKey) {
            return item
        }
        const runtime = runtimeForBuff(item, resolveAddedCombatBuff(item))
        updater(runtime)
        return { ...item, runtime }
    }))
}

function updateAddedCombatBuffModificationLevel(buffKey, value) {
    saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().map(item => {
        if (addedCombatBuffKey(item) !== buffKey || item.sourceKind !== "wEngineTeam") {
            return item
        }
        return {
            ...item,
            wEngineModificationLevel: SharedCombat.clampWEngineModificationLevel(
                value,
                rawWEngineForTeamBuffKey(item.id) ?? {},
            ),
        }
    }))
}

function catalogCombatBuffKey(item) {
    return `catalog:${item.id}`
}

function catalogCombatBuffIdFromKey(buffKey) {
    return String(buffKey ?? "").startsWith("catalog:")
        ? String(buffKey).slice("catalog:".length)
        : ""
}

function catalogCombatBuffRuntimes() {
    return configForAgent(els.agentSelect.value)?.combat?.catalogBuffRuntimes ?? {}
}

function catalogCombatBuffRuntimeItem(buff) {
    return {
        id: buff.id,
        sourceKind: "catalogBuff",
        runtime: catalogCombatBuffRuntimes()[buff.id] ?? null,
    }
}

function updateCatalogCombatBuffRuntime(buffKey, updater) {
    const buffId = catalogCombatBuffIdFromKey(buffKey)
    const buff = (meta?.combatBuffs ?? []).find(item => item.id === buffId)
    const agentId = els.agentSelect.value
    if (!buff || !agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previous = byAgent[agentId] ?? {}
    const combat = previous.combat ?? {}
    const runtime = runtimeForBuff({ runtime: combat.catalogBuffRuntimes?.[buffId] ?? null }, buff)
    updater(runtime)
    byAgent[agentId] = {
        ...previous,
        combat: {
            ...combat,
            catalogBuffRuntimes: {
                ...(combat.catalogBuffRuntimes ?? {}),
                [buffId]: runtime,
            },
        },
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
}

function addedCombatBuffByKey(buffKey) {
    return currentAddedCombatBuffs().find(item => addedCombatBuffKey(item) === buffKey) ?? null
}

function teammateBuffCandidates() {
    return teammateCombatBuffGroups()
        .flatMap(group => (group.buffs ?? []).map(buff => ({
            id: buff.id,
            sourceType: "teammate",
            sourceCategory: "agent",
            sourceKind: "teammate",
            ownerId: group.id,
            ownerName: group.name,
            sourceLabel: buff.sourceLabel,
            name: buff.name,
            description: buff.description,
            conditionLabel: buff.conditionLabel,
            stats: buff.stats ?? [],
            effects: buff.effects ?? null,
            buffModifiers: buff.buffModifiers ?? null,
            coverage: buff.coverage ?? null,
        })))
}

function wEngineTeamBuffCandidates() {
    return (meta?.wEngines ?? [])
        .map(wEngine => wEngineTeamBuffCandidateFromWEngine(wEngine, 1))
        .filter(Boolean)
}

function driveDiscFourPiece(set) {
    return set?.fourPiece ?? null
}

function driveDiscFourPieceTeamBuff(set) {
    const buff = driveDiscFourPiece(set)?.teamBuff ?? null
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDisc4pcSetOptions() {
    return (meta?.driveDiscSets ?? [])
        .filter(set => set.fourPiece)
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
}

function teammateDriveDisc4pcCandidates() {
    return driveDisc4pcSetOptions()
        .map(set => {
            const teamBuff = driveDiscFourPieceTeamBuff(set)
            if (!teamBuff) {
                return null
            }
            return {
                id: `teammateDriveDisc4pc:${set.id}`,
                sourceType: "driveDisc4pcTeam",
                sourceCategory: "driveDisc",
                sourceKind: "teammateDriveDisc4pc",
                setId: set.id,
                ownerName: {
                    zhCN: "队友",
                    en: "Teammate",
                },
                name: set.name,
                description: set.fourPiece?.effectText ?? teamBuff.condition,
                conditionLabel: teamBuff.condition,
                stats: effectStats(teamBuff),
                effects: teamBuff.effects ?? null,
                buffModifiers: teamBuff.buffModifiers ?? null,
                coverage: teamBuff.coverage ?? null,
            }
        })
        .filter(Boolean)
}

function combatBuffCandidates(tab = activeCombatBuffTab) {
    if (tab === "agent") {
        return teammateBuffCandidates()
    }
    if (tab === "wEngine") {
        return wEngineTeamBuffCandidates()
    }
    if (tab === "driveDisc") {
        return teammateDriveDisc4pcCandidates()
    }
    return []
}

function allCombatBuffCandidates() {
    return [
        ...teammateBuffCandidates(),
        ...wEngineTeamBuffCandidates(),
        ...teammateDriveDisc4pcCandidates(),
    ]
}

function resolveAddedCombatBuff(item) {
    if (item?.sourceKind === "custom") {
        return {
            ...item,
            ownerName: { zhCN: "自定义", en: "Custom" },
            description: storedEffectRulesText(item) || effectStatText(item) || "",
        }
    }
    if (item?.sourceKind === "wEngineTeam") {
        return wEngineTeamBuffCandidateFromWEngine(
            rawWEngineForTeamBuffKey(item.id),
            wEngineTeamModificationLevelForItem(item),
        ) ?? item
    }
    return allCombatBuffCandidates().find(candidate =>
        candidate.sourceKind === item?.sourceKind
        && candidate.id === item.id
    ) ?? item
}

function addedCombatBuffKey(item) {
    return item.sourceKind === "teammateDriveDisc4pc"
        ? `${item.sourceKind}:${item.setId}`
        : `${item.sourceKind}:${item.id}`
}

function teammateDriveDiscAddedCount(addedBuffs = currentAddedCombatBuffs()) {
    return addedBuffs.filter(item => item.sourceKind === "teammateDriveDisc4pc").length
}

function checkedCombatBuffIds() {
    return new Set(
        [...els.combatSection.querySelectorAll("input[data-combat-buff-id]:checked")]
            .map(input => input.dataset.combatBuffId)
    )
}

function isDefaultCheckedCombatBuff(buff) {
    if (buff?.defaultChecked === false) {
        return false
    }
    if (buff?.defaultChecked === true) {
        return true
    }
    return DEFAULT_CHECKED_COMBAT_SOURCE_TYPES.has(buff?.sourceType)
}

function renderCombatCheckboxList(container, buffs, checkedIds = checkedCombatBuffIds()) {
    container.innerHTML = ""
    if (!buffs.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        container.appendChild(empty)
        return
    }

    for (const buff of buffs) {
        const checked = checkedIds.has(buff.id)
            || (isDefaultCheckedCombatBuff(buff) && !manuallyUncheckedDefaultCombatBuffIds.has(buff.id))
        const row = document.createElement("label")
        row.className = checked ? "combat-check-row active" : "combat-check-row"
        const input = document.createElement("input")
        input.type = "checkbox"
        input.dataset.combatBuffId = buff.id
        input.dataset.combatBuffSourceType = buff.sourceType ?? ""
        input.dataset.combatBuffDefaultChecked = isDefaultCheckedCombatBuff(buff) ? "true" : "false"
        input.checked = checked
        const copy = document.createElement("span")
        copy.className = "combat-check-copy"
        const title = document.createElement("strong")
        title.textContent = nameOf(buff)
        const description = document.createElement("span")
        description.className = "combat-check-description"
        description.textContent = localizedText(buff.description)
            || localizedText(buff.effectText)
            || localizedText(buff.conditionLabel)
            || buff.condition
            || "勾选后计入局内"
        const stats = document.createElement("span")
        stats.className = "combat-check-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, buff, defaultRuntimeForBuff(buff), { fallbackText: effectStatText(buff) })
        copy.append(title, description, stats)
        row.append(input, copy)
        container.appendChild(row)
    }
}

function catalogBuffMetaLine(buff) {
    if (buff.sourceType === "boss") {
        return [
            localizedText(buff.bossSource) || localizedText(buff.sourceLabel),
            localizedText(buff.sourcePeriod),
        ].filter(Boolean).join(" · ")
    }

    return [
        localizedText(buff.source) || localizedText(buff.sourceLabel),
        localizedText(buff.sourcePeriod),
    ].filter(Boolean).join(" · ")
}

function renderCatalogCombatBuffCards(container, buffs, checkedIds = checkedCombatBuffIds()) {
    container.innerHTML = ""
    if (!buffs.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        container.appendChild(empty)
        return
    }

    for (const buff of buffs) {
        const checked = checkedIds.has(buff.id)
        const item = catalogCombatBuffRuntimeItem(buff)
        const runtime = runtimeForBuff(item, buff)
        const row = document.createElement("article")
        row.className = checked ? "combat-added-card combat-select-card active" : "combat-added-card combat-select-card"
        row.dataset.buffKey = catalogCombatBuffKey(buff)

        const toggle = document.createElement("label")
        toggle.className = "combat-select-toggle"
        const input = document.createElement("input")
        input.type = "checkbox"
        input.dataset.combatBuffId = buff.id
        input.dataset.combatBuffSourceType = buff.sourceType ?? ""
        input.dataset.combatBuffDefaultChecked = isDefaultCheckedCombatBuff(buff) ? "true" : "false"
        input.checked = checked

        const title = document.createElement("strong")
        title.textContent = nameOf(buff)
        toggle.append(input, title)
        row.appendChild(toggle)

        const metaLine = catalogBuffMetaLine(buff)
        if (metaLine) {
            const meta = document.createElement("span")
            meta.textContent = metaLine
            row.appendChild(meta)
        }

        const description = document.createElement("p")
        description.textContent = localizedText(buff.description) || localizedText(buff.conditionLabel) || "勾选后计入局内计算"

        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, buff, runtime, { fallbackText: effectStatText(buff) })

        row.append(description, stats)
        if (checked) {
            renderBuffRuntimeControls(row, item, buff, runtime)
        }
        container.appendChild(row)
    }
}

function renderAddedCombatBuffs() {
    const added = currentAddedCombatBuffs()
    els.addedCombatBuffs.innerHTML = ""
    if (!added.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "点击 + 添加队友、音擎、驱动盘或自定义 Buff"
        els.addedCombatBuffs.appendChild(empty)
        return
    }

    for (const item of added) {
        const buff = resolveAddedCombatBuff(item)
        const runtime = runtimeForBuff(item, buff)
        const row = document.createElement("article")
        row.className = "combat-added-card"
        row.dataset.buffKey = addedCombatBuffKey(item)

        const title = document.createElement("strong")
        title.textContent = nameOf(buff)
        const description = document.createElement("p")
        description.textContent = localizedText(buff.description) || localizedText(buff.conditionLabel) || "已添加到局内计算"
        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, buff, runtime, { fallbackText: effectStatText(buff) })
        const remove = document.createElement("button")
        remove.type = "button"
        remove.className = "combat-remove-btn"
        remove.dataset.removeBuffKey = addedCombatBuffKey(item)
        remove.textContent = "移除"

        row.append(title)
        if (shouldShowCombatBuffMetaLine(buff)) {
            const metaLine = document.createElement("span")
            metaLine.textContent = [
                localizedText(buff.ownerName),
                localizedText(buff.sourceLabel),
            ].filter(Boolean).join(" · ") || sourceCategoryLabel(buff.sourceCategory)
            row.appendChild(metaLine)
        }
        row.append(description, stats)
        renderAddedWEngineModificationControl(row, item)
        renderBuffRuntimeControls(row, item, buff, runtime)
        row.appendChild(remove)
        els.addedCombatBuffs.appendChild(row)
    }
}

function renderAddedWEngineModificationControl(row, item) {
    if (item?.sourceKind !== "wEngineTeam") {
        return
    }
    const rawWEngine = rawWEngineForTeamBuffKey(item.id)
    const selectedLevel = wEngineTeamModificationLevelForItem(item)
    const modification = rawWEngine?.modification ?? {}
    const min = Number.isInteger(Number(modification.minLevel)) ? Number(modification.minLevel) : 1
    const max = Number.isInteger(Number(modification.maxLevel)) ? Number(modification.maxLevel) : 5
    const controls = document.createElement("div")
    controls.className = "combat-runtime-grid"
    controls.dataset.buffKey = addedCombatBuffKey(item)

    const field = document.createElement("label")
    field.className = "field"
    const label = document.createElement("span")
    label.textContent = "改装等级"
    const select = document.createElement("select")
    select.dataset.wEngineTeamModificationLevel = "true"
    for (let level = min; level <= max; level += 1) {
        const option = document.createElement("option")
        option.value = String(level)
        option.textContent = `${level}级`
        option.selected = level === selectedLevel
        select.appendChild(option)
    }
    field.append(label, select)
    controls.appendChild(field)
    row.appendChild(controls)
}

function renderBuffRuntimeControls(row, item, buff, runtime) {
    const rules = effectRules(buff)
    const hasCoverage = Boolean(buff.coverage)
    const needsRuntime = hasCoverage || rules.some(rule => rule.type === "derived" || rule.type === "formula" || rule.type === "stacked")
    if (!needsRuntime) {
        return
    }
    const buffKey = item?.sourceKind === "catalogBuff" ? catalogCombatBuffKey(item) : addedCombatBuffKey(item)
    const controls = document.createElement("div")
    controls.className = "combat-runtime-grid"
    controls.dataset.buffKey = buffKey
    if (hasCoverage) {
        const field = document.createElement("label")
        field.className = "field"
        field.innerHTML = `
            <span>覆盖率</span>
            <input type="number" min="${buff.coverage.min ?? 0}" max="${buff.coverage.max ?? 1}" step="${buff.coverage.step ?? 0.1}" value="${runtime.coverage}" data-runtime-coverage>
        `
        controls.appendChild(field)
    }
    for (const rule of rules) {
        const id = rule.id ?? rule.stat ?? "effect"
        if (rule.type === "derived" || rule.type === "formula") {
            const source = rule.source ?? {}
            const defaultValue = rule.type === "formula" ? source.defaultValue : rule.defaultSourceValue
            const sourceLabel = rule.type === "formula" ? source.label : rule.sourceLabel
            const minAttr = rule.type === "formula" && Number.isFinite(Number(source.min)) ? ` min="${source.min}"` : ""
            const maxAttr = rule.type === "formula" && Number.isFinite(Number(source.max)) ? ` max="${source.max}"` : ""
            const field = document.createElement("label")
            field.className = "field"
            field.innerHTML = `
                <span>${escapeHtml(localizedText(sourceLabel) || "来源数值")}</span>
                <input type="number"${minAttr}${maxAttr} step="1" value="${runtime.effects?.[id]?.sourceValue ?? defaultValue ?? 0}" data-runtime-effect="${escapeHtml(id)}" data-runtime-source-value>
            `
            controls.appendChild(field)
        } else if (rule.type === "stacked") {
            const field = document.createElement("label")
            field.className = "field"
            field.innerHTML = `
                <span>层数</span>
                <input type="number" min="0" max="${rule.maxStacks ?? 1}" step="1" value="${runtime.effects?.[id]?.stacks ?? rule.defaultStacks ?? rule.maxStacks ?? 1}" data-runtime-effect="${escapeHtml(id)}" data-runtime-stacks>
            `
            controls.appendChild(field)
        }
    }
    row.appendChild(controls)
}

function finiteOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function inputNumberValue(input) {
    if (input.value === "" || input.value === "-" || input.value === "." || input.value === "-.") {
        return null
    }
    return Number(input.value)
}

function formatInputNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function validateNumberInputValue(value, config) {
    if (value === null || !Number.isFinite(value)) {
        return `${config.label} 需要填写有效数字`
    }
    if (Number.isFinite(config.min) && value < config.min) {
        return `${config.label} 不能小于 ${config.min}`
    }
    if (Number.isFinite(config.max) && value > config.max) {
        return `${config.label} 不能大于 ${config.max}`
    }
    if (config.integer && !Number.isInteger(value)) {
        return `${config.label} 需要填写整数`
    }
    return ""
}

function inputLabel(input) {
    return input.closest("label")?.querySelector("span")?.textContent?.trim()
        || input.closest(".field")?.querySelector("span")?.textContent?.trim()
        || input.getAttribute("aria-label")
        || "输入值"
}

function genericNumberConfig(input) {
    const preset = input === els.damageTargetDefense && els.damageTargetPreset?.value !== "custom"
        ? damageTargetPresetById(els.damageTargetPreset.value)?.defense
        : null
    return {
        label: inputLabel(input),
        defaultValue: finiteOr(preset, finiteOr(input.defaultValue, 0)),
        min: input.min !== "" ? Number(input.min) : NaN,
        max: input.max !== "" ? Number(input.max) : NaN,
        integer: false,
    }
}

function runtimeRuleForField(buff, field) {
    const id = field.dataset.runtimeEffect
    if (!id) {
        return null
    }
    return effectRules(buff).find(rule => (rule.id ?? rule.stat ?? "effect") === id) ?? null
}

function runtimeNumberConfig(buff, field) {
    if (field.matches("[data-runtime-coverage]")) {
        const coverage = buff.coverage ?? {}
        return {
            label: "覆盖率",
            defaultValue: finiteOr(coverage.default, 1),
            min: finiteOr(coverage.min, 0),
            max: finiteOr(coverage.max, 1),
            integer: false,
        }
    }
    const rule = runtimeRuleForField(buff, field)
    if (!rule) {
        return null
    }
    if (field.matches("[data-runtime-source-value]")) {
        const source = rule.source ?? {}
        return {
            label: localizedText(source.label ?? rule.sourceLabel) || "来源数值",
            defaultValue: finiteOr(rule.type === "formula" ? source.defaultValue : rule.defaultSourceValue, 0),
            min: rule.type === "formula" ? Number(source.min) : NaN,
            max: rule.type === "formula" ? Number(source.max) : NaN,
            integer: false,
        }
    }
    if (field.matches("[data-runtime-stacks]")) {
        return {
            label: "层数",
            defaultValue: finiteOr(rule.defaultStacks ?? rule.maxStacks, 1),
            min: 0,
            max: finiteOr(rule.maxStacks, 1),
            integer: true,
        }
    }
    return null
}

function setRuntimeValue(runtime, field, value) {
    if (field.matches("[data-runtime-coverage]")) {
        runtime.coverage = value
        return
    }
    const id = field.dataset.runtimeEffect
    runtime.effects = runtime.effects ?? {}
    runtime.effects[id] = runtime.effects[id] ?? {}
    if (field.matches("[data-runtime-source-value]")) {
        runtime.effects[id].sourceValue = value
    } else if (field.matches("[data-runtime-stacks]")) {
        runtime.effects[id].stacks = value
    }
}

function updateRuntimeFieldValue(buffKey, field, value) {
    if (catalogCombatBuffIdFromKey(buffKey)) {
        updateCatalogCombatBuffRuntime(buffKey, runtime => setRuntimeValue(runtime, field, value))
        return
    }

    updateAddedCombatBuffRuntime(buffKey, runtime => setRuntimeValue(runtime, field, value))
}

function refreshAddedCombatBuffSummary(buffKey) {
    const catalogBuffId = catalogCombatBuffIdFromKey(buffKey)
    const item = catalogBuffId
        ? catalogCombatBuffRuntimeItem((meta?.combatBuffs ?? []).find(buff => buff.id === catalogBuffId) ?? {})
        : addedCombatBuffByKey(buffKey)
    const row = els.combatSection.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
    const summary = row?.querySelector(".combat-added-stats")
    if (!item || !summary) {
        return
    }
    const buff = catalogBuffId
        ? (meta?.combatBuffs ?? []).find(candidate => candidate.id === catalogBuffId)
        : resolveAddedCombatBuff(item)
    if (!buff) {
        return
    }
    renderBuffEffectLines(summary, buff, runtimeForBuff(item, buff), { fallbackText: effectStatText(buff) })
}

function runtimeFieldContext(field) {
    const group = field.closest("[data-buff-key]")
    const buffKey = group?.dataset.buffKey
    const catalogBuffId = catalogCombatBuffIdFromKey(buffKey)
    if (catalogBuffId) {
        const buff = (meta?.combatBuffs ?? []).find(item => item.id === catalogBuffId)
        return {
            buffKey,
            item: buff ? catalogCombatBuffRuntimeItem(buff) : null,
            buff,
        }
    }

    const item = buffKey ? addedCombatBuffByKey(buffKey) : null
    const buff = item ? resolveAddedCombatBuff(item) : null
    return { buffKey, item, buff }
}

async function commitRuntimeField(field) {
    const { buffKey, buff } = runtimeFieldContext(field)
    if (!buffKey || !buff) {
        return false
    }
    const config = runtimeNumberConfig(buff, field)
    if (!config) {
        return false
    }
    const value = inputNumberValue(field)
    const message = validateNumberInputValue(value, config)
    if (message) {
        field.value = formatInputNumber(config.defaultValue)
        updateRuntimeFieldValue(buffKey, field, config.defaultValue)
        refreshAddedCombatBuffSummary(buffKey)
        await refreshAfterConfigChange()
        setStatus(message, "error")
        return false
    }
    updateRuntimeFieldValue(buffKey, field, value)
    refreshAddedCombatBuffSummary(buffKey)
    await refreshAfterConfigChange()
    return true
}

async function commitGenericNumberInput(input) {
    const value = inputNumberValue(input)
    const config = genericNumberConfig(input)
    const message = validateNumberInputValue(value, config)
    if (message) {
        input.value = formatInputNumber(config.defaultValue)
        if (input === els.damageTargetDefense) {
            syncDamagePresetFromDefense()
        }
        if (input === els.damageTargetResistance) {
            persistCurrentDamageResistanceInput()
            syncDamageResistancePresetFromValue()
        }
        await refreshAfterConfigChange()
        setStatus(message, "error")
        return false
    }
    if (input === els.damageTargetDefense) {
        syncDamagePresetFromDefense()
    }
    if (input === els.damageTargetResistance) {
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue()
    }
    await refreshAfterConfigChange()
    return true
}

function renderCombatControls() {
    const checkedIds = checkedCombatBuffIds()
    renderCombatCheckboxList(els.selfCombatBuffs, [...agentCombatBuffs(), ...combatBuffsByType("self")], checkedIds)
    renderCombatCheckboxList(els.wEngineCombatBuffs, wEngineEquippedBuffs(), checkedIds)
    renderAddedCombatBuffs()
    renderCatalogCombatBuffCards(els.bossCombatBuffs, combatBuffsByType("boss"), checkedIds)
    renderCatalogCombatBuffCards(els.fieldCombatBuffs, combatBuffsByType("field"), checkedIds)
}

function collectManualStats() {
    return currentAddedCombatBuffs()
        .filter(item => item.sourceKind === "custom")
        .flatMap(item => (item.stats ?? []).map((stat, index) => ({
            id: `${item.id}.${stat.id ?? index + 1}`,
            label: `${item.name || "自定义 Buff"}｜${stat.label ?? statLabel(stat.stat)}`,
            stat: resolveCustomBuffStatOption(stat.stat),
            value: stat.value,
            mode: stat.mode ?? "flat",
            basis: stat.basis ?? null,
        })))
}

function collectManualEffects() {
    return currentAddedCombatBuffs()
        .filter(item => item.sourceKind === "custom")
        .flatMap(item => (item.effects ?? []).map((effect, index) => ({
            id: `${item.id}.${effect.id ?? index + 1}`,
            label: `${item.name || "自定义 Buff"}｜${effect.label ?? (effect.type === "damageModifier" ? damageModifierOptionText(effect) : statLabel(effect.stat))}`,
            effects: [effect],
        })))
}

function collectCombatBuffConfig() {
    persistCurrentDamageResistanceInput()
    renderCombatControls()
    renderEntityCards()
    const addedBuffs = currentAddedCombatBuffs()
    const activeBuffIds = [...checkedCombatBuffIds()]
    const runtimeInputs = {}
    const wEngineTeamModificationLevels = {}
    for (const item of addedBuffs) {
        if (["teammate", "wEngineTeam"].includes(item.sourceKind)) {
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }
        if (item.sourceKind === "wEngineTeam") {
            wEngineTeamModificationLevels[item.id] = wEngineTeamModificationLevelForItem(item)
        }
        if (item.sourceKind === "teammateDriveDisc4pc") {
            runtimeInputs[`teammateDriveDisc4pc:${item.setId}`] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }
    }
    for (const buff of [...combatBuffsByType("boss"), ...combatBuffsByType("field")]) {
        if (activeBuffIds.includes(buff.id)) {
            const item = catalogCombatBuffRuntimeItem(buff)
            runtimeInputs[buff.id] = runtimeForBuff(item, buff)
        }
    }

    return {
        activeBuffIds: [...new Set(activeBuffIds)],
        teammateDriveDiscSetIds: addedBuffs
            .filter(item => item.sourceKind === "teammateDriveDisc4pc")
            .map(item => item.setId)
            .filter(Boolean)
            .slice(0, TEAMMATE_DRIVE_DISC_LIMIT),
        manualStats: collectManualStats(),
        manualEffects: collectManualEffects(),
        runtimeInputs,
        wEngineTeamModificationLevels,
    }
}

function collectDamageConfig() {
    const agentLevel = Number(els.agentLevelInput?.value || 60)
    const target = collectDamageTargetConfig()
    const events = configuredCalculationEventsForRequest()
    const selectedEventId = calculationConfigMode === "custom"
        ? calculationConfigSelectedEventId ?? events[0]?.id
        : events[0]?.id
    const selectedDirect = events.find(event => event.id === selectedEventId && event.kind === "direct")
        ?? events.find(event => event.kind === "direct")
    return {
        mode: calculationConfigMode,
        agentLevel,
        skillLevelsByCategory: { ...damageSkillLevelsByCategory },
        ...(selectedDirect?.skillMultiplier ? { skillMultiplier: selectedDirect.skillMultiplier } : {}),
        ...(selectedDirect?.skillRef ? { skillRef: selectedDirect.skillRef } : {}),
        ...(selectedDirect?.critMode ? { critMode: selectedDirect.critMode } : {}),
        selectedEventId,
        events,
        target,
    }
}

function sourceCategoryLabel(sourceCategory) {
    const labels = {
        agent: "角色引发",
        wEngine: "音擎引发",
        driveDisc: "驱动盘引发",
        custom: "自定义",
    }
    return labels[sourceCategory] ?? sourceCategory ?? "Buff"
}

function shouldShowCombatBuffMetaLine(buff) {
    return buff?.sourceCategory !== "agent"
}

function renderCombatBuffCandidates() {
    const search = els.combatBuffSearchInput.value.trim().toLowerCase()
    const addedKeys = new Set(currentAddedCombatBuffs().map(addedCombatBuffKey))
    const isCustom = activeCombatBuffTab === "custom"
    els.combatBuffCandidateList.hidden = isCustom
    els.combatBuffCustomPane.hidden = !isCustom
    els.combatBuffModalEmpty.hidden = true

    for (const button of els.combatBuffModal.querySelectorAll("[data-combat-buff-tab]")) {
        button.classList.toggle("active", button.dataset.combatBuffTab === activeCombatBuffTab)
    }

    if (isCustom) {
        if (!els.customBuffStatRows.children.length) {
            renderCustomBuffStatRows([{ optionIndex: 0, value: 0 }])
        }
        return
    }

    const candidates = combatBuffCandidates()
        .filter(candidate => {
            const haystack = [
                nameOf(candidate),
                localizedText(candidate.ownerName),
                localizedText(candidate.sourceLabel),
                localizedText(candidate.description),
                localizedText(candidate.conditionLabel),
                storedEffectRulesText(candidate),
                ...storedBuffModifierTexts(candidate),
            ].join(" ").toLowerCase()
            return !search || haystack.includes(search)
        })

    els.combatBuffCandidateList.innerHTML = ""
    if (!candidates.length) {
        els.combatBuffModalEmpty.hidden = false
        return
    }

    const teammate4pcCount = teammateDriveDiscAddedCount()
    for (const candidate of candidates) {
        const key = addedCombatBuffKey(candidate)
        const alreadyAdded = addedKeys.has(key)
        const overTeammateSetLimit = candidate.sourceKind === "teammateDriveDisc4pc"
            && !alreadyAdded
            && teammate4pcCount >= TEAMMATE_DRIVE_DISC_LIMIT
        const row = document.createElement("button")
        row.type = "button"
        row.className = "combat-candidate-row"
        row.dataset.candidateKey = key
        row.disabled = alreadyAdded || overTeammateSetLimit

        const title = document.createElement("strong")
        title.textContent = nameOf(candidate)
        const description = document.createElement("p")
        description.textContent = localizedText(candidate.description) || localizedText(candidate.conditionLabel) || ""
        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        if (alreadyAdded) {
            setCombatStatLines(stats, ["已添加"])
        } else if (overTeammateSetLimit) {
            setCombatStatLines(stats, [`队友 4 件套最多 ${TEAMMATE_DRIVE_DISC_LIMIT} 个`])
        } else {
            renderBuffEffectLines(stats, candidate)
        }

        row.append(title)
        if (shouldShowCombatBuffMetaLine(candidate)) {
            const metaLine = document.createElement("span")
            metaLine.textContent = [
                sourceCategoryLabel(candidate.sourceCategory),
                localizedText(candidate.ownerName),
                localizedText(candidate.sourceLabel),
            ].filter(Boolean).join(" · ")
            row.appendChild(metaLine)
        }
        row.append(description, stats)
        els.combatBuffCandidateList.appendChild(row)
    }
}

function openCombatBuffModal(tab = "agent") {
    activeCombatBuffTab = tab
    els.combatBuffSearchInput.value = ""
    els.combatBuffModal.hidden = false
    document.body.classList.add("modal-open")
    renderCombatBuffCandidates()
}

function closeCombatBuffModal() {
    els.combatBuffModal.hidden = true
    document.body.classList.remove("modal-open")
}

function addCombatBuffCandidateByKey(key) {
    const candidate = combatBuffCandidates().find(item => addedCombatBuffKey(item) === key)
    if (!candidate) {
        return false
    }
    const addedBuffs = currentAddedCombatBuffs()
    if (addedBuffs.some(item => addedCombatBuffKey(item) === key)) {
        return false
    }
    saveCurrentAddedCombatBuffs([...addedBuffs, {
        id: candidate.id,
        sourceCategory: candidate.sourceCategory,
        sourceKind: candidate.sourceKind,
        setId: candidate.setId ?? null,
        ...(candidate.sourceKind === "wEngineTeam" ? { wEngineModificationLevel: 1 } : {}),
        runtime: defaultRuntimeForBuff(candidate),
    }])
    return true
}

function renderCustomBuffStatRows(rows = [{ optionIndex: 0, value: 0 }]) {
    els.customBuffStatRows.innerHTML = ""
    const row = rows[0] ?? { targetKind: "default", optionIndex: 0, value: 0 }
    const targetKind = row.targetKind === "skill" ? "skill" : "default"
    const options = targetKind === "skill" ? CUSTOM_BUFF_SKILL_STAT_OPTIONS : CUSTOM_BUFF_STAT_OPTIONS
    const item = document.createElement("div")
    item.className = "custom-buff-stat-row"
    item.dataset.index = "0"

    const targetField = document.createElement("label")
    targetField.className = "field"
    const targetLabel = document.createElement("span")
    targetLabel.textContent = "增幅对象"
    const targetSelect = document.createElement("select")
    targetSelect.dataset.customTargetKind = "0"
    ;[["default", "默认"], ["skill", "技能"]].forEach(([value, label]) => {
        const opt = document.createElement("option")
        opt.value = value
        opt.textContent = label
        opt.selected = targetKind === value
        targetSelect.appendChild(opt)
    })
    targetField.append(targetLabel, targetSelect)

    const statField = document.createElement("label")
    statField.className = "field"
    const statLabelEl = document.createElement("span")
    statLabelEl.textContent = "增幅类型"
    const select = document.createElement("select")
    select.dataset.customStatSelect = "0"
    options.forEach((option, optionIndex) => {
        const opt = document.createElement("option")
        opt.value = String(optionIndex)
        opt.textContent = option[1]
        opt.selected = Number(row.optionIndex ?? 0) === optionIndex
        select.appendChild(opt)
    })
    statField.append(statLabelEl, select)

    const valueField = document.createElement("label")
    valueField.className = "field"
    const valueLabel = document.createElement("span")
    valueLabel.textContent = "数值"
    const input = document.createElement("input")
    input.type = "number"
    input.step = "0.1"
    input.value = row.value ?? 0
    input.dataset.customStatValue = "0"
    valueField.append(valueLabel, input)

    item.append(targetField, statField, valueField)
    if (targetKind === "skill") {
        const targetList = document.createElement("div")
        targetList.className = "custom-skill-target"
        targetList.dataset.customSkillTargets = "0"
        const targets = row.skillTargets?.length ? row.skillTargets : row.skillTarget ? [row.skillTarget] : [{}]
        targets.forEach((target, targetIndex) => {
            targetList.appendChild(customSkillTargetRow(target, targetIndex))
        })
        const addTargetBtn = document.createElement("button")
        addTargetBtn.type = "button"
        addTargetBtn.className = "compact-btn"
        addTargetBtn.dataset.addCustomSkillTarget = "0"
        addTargetBtn.textContent = "添加技能目标"
        targetList.appendChild(addTargetBtn)
        item.appendChild(targetList)
    }
    els.customBuffStatRows.appendChild(item)
}

function customBuffRowsFromDom() {
    return [...els.customBuffStatRows.querySelectorAll(".custom-buff-stat-row")].map(row => ({
        targetKind: row.querySelector("[data-custom-target-kind]")?.value === "skill" ? "skill" : "default",
        optionIndex: Number(row.querySelector("[data-custom-stat-select]")?.value ?? 0),
        value: Number(row.querySelector("[data-custom-stat-value]")?.value ?? 0),
        skillTargets: row.querySelector("[data-custom-skill-target]") ? readCustomSkillTargets(row) : [],
    }))
}

function customBuffStatsFromDom() {
    return customBuffRowsFromDom()
        .map((row, index) => {
            const option = CUSTOM_BUFF_STAT_OPTIONS[row.optionIndex]
            if (!option || row.targetKind === "skill" || option[2] === "eventModifier") {
                return null
            }
            const [optionStat, label, mode, basis] = option
            const stat = resolveCustomBuffStatOption(optionStat)
            const rawValue = Number(row.value ?? 0)
            return normalizeCustomBuffStat({
                id: `stat-${index + 1}`,
                label: resolveCustomBuffStatLabel(optionStat, label),
                stat,
                value: rawValue,
                mode,
                basis,
            })
        })
        .filter(Boolean)
}

function customBuffEffectsFromDom() {
    return customBuffRowsFromDom()
        .map((row, index) => {
            const options = row.targetKind === "skill" ? CUSTOM_BUFF_SKILL_STAT_OPTIONS : CUSTOM_BUFF_STAT_OPTIONS
            const option = options[row.optionIndex]
            if (!option || (row.targetKind !== "skill" && option[2] !== "eventModifier")) {
                return null
            }
            const [stat, label] = option
            return normalizeCustomBuffEffect({
                id: `effect-${index + 1}`,
                type: "fixed",
                stat: resolveCustomBuffStatOption(stat),
                label,
                value: Number(row.value ?? 0),
                mode: "flat",
                target: row.targetKind === "skill"
                    ? { kind: "skill", skillTargets: row.skillTargets ?? [] }
                    : { kind: "default" },
            })
        })
        .filter(Boolean)
}

function selectedValues(select) {
    return [...select.selectedOptions].map(option => option.value).filter(Boolean)
}

function mainStatChoiceContainer(slot) {
    return els[`slot${slot}MainStatChoices`]
}

function syncMainStatChoices(select, slot) {
    const selected = new Set(selectedValues(select))
    const container = mainStatChoiceContainer(slot)
    for (const input of container.querySelectorAll("input[data-main-stat-limit]")) {
        input.checked = selected.has(input.value)
        input.closest(".main-stat-choice")?.classList.toggle("active", input.checked)
    }
}

function syncTwoPieceSetChoices() {
    const selected = new Set(selectedValues(els.twoPieceSetSelect))
    for (const input of els.twoPieceSetChoices.querySelectorAll("input[data-two-piece-set-limit]")) {
        input.checked = selected.has(input.value)
        input.closest(".main-stat-choice")?.classList.toggle("active", input.checked)
    }
}

function setMainStatSelected(select, stat, selected) {
    const option = [...select.options].find(item => item.value === stat)
    if (!option) {
        return
    }
    option.selected = selected
    select.dispatchEvent(new Event("change", { bubbles: true }))
}

function setTwoPieceSetSelected(setId, selected) {
    const option = [...els.twoPieceSetSelect.options].find(item => item.value === setId)
    if (!option) {
        return
    }
    option.selected = selected
    els.twoPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
}

function clearTwoPieceSetLimits() {
    for (const option of els.twoPieceSetSelect.options) {
        option.selected = false
    }
    syncTwoPieceSetChoices()
    els.twoPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
}

function clearMainStatLimits(slot) {
    const select = els[`slot${slot}MainStats`]
    for (const option of select.options) {
        option.selected = false
    }
    syncMainStatChoices(select, slot)
    select.dispatchEvent(new Event("change", { bubbles: true }))
}

function collectMinimums() {
    const entries = [
        ["energyRegen", els.minEnergyRegen.value],
        ["anomalyProficiency", els.minAnomalyProficiency.value],
        ["critRate", els.minCritRate.value],
        ["critDmg", els.minCritDmg.value],
    ]
    return Object.fromEntries(entries.filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]))
}

function collectOptimizationSettings() {
    return {
        algorithm: els.algorithmSelect.value,
        fourPieceSetId: els.fourPieceSetSelect.value,
        twoPieceSetIds: selectedValues(els.twoPieceSetSelect),
        objective: "damage",
        mainStatLimits: {
            4: selectedValues(els.slot4MainStats),
            5: selectedValues(els.slot5MainStats),
            6: selectedValues(els.slot6MainStats),
        },
        minimums: collectMinimums(),
    }
}

function collectRequestPayload({ driveDiscs = [] } = {}) {
    return {
        ownerId: store?.currentOwnerId ?? SharedCombat.currentAccountId(),
        agentId: els.agentSelect.value,
        coreSkillLevel: els.coreSkillSelect.value,
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        driveDiscs,
        combatBuffs: collectCombatBuffConfig(),
        damage: collectDamageConfig(),
    }
}

function renderOrderedKV(container, data = {}, order = PANEL_ORDER) {
    container.innerHTML = ""
    for (const key of order) {
        if (data[key] === undefined || data[key] === null) {
            continue
        }
        const row = document.createElement("div")
        row.className = "kv-row"
        row.innerHTML = `
            <span>${escapeHtml(statLabel(key))}</span>
            <strong>${escapeHtml(formatValue(data[key], key))}</strong>
        `
        container.appendChild(row)
    }
}

function combatEffectText(item) {
    const label = item?.name ? nameOf(item) : item.key
    const displayEffects = Array.isArray(item?.effects)
        && item.effects.some(rule => rule.displayValue !== undefined || rule.displayValuePerStack !== undefined)
            ? storedEffectRulesText(
                { effects: item.effects, coverage: item.coverage ?? null },
                item.runtime ?? defaultRuntimeForBuff({ effects: item.effects, coverage: item.coverage ?? null }),
            )
            : ""
    const stats = displayEffects || (item.resolvedStats?.length ? item.resolvedStats : item.stats ?? [])
        .map(stat => `${statLabel(stat.stat)} +${formatValue(stat.value, stat.stat)}`)
        .join(" / ")
    const modifiers = (item.resolvedDamageModifiers ?? [])
        .map(modifier => `${damageModifierOptionText(modifier)} +${formatStoredValue("dmgBonus", Number(modifier.value ?? 0) * 100, "flat")}`)
        .join(" / ")
    const detail = [stats, modifiers].filter(Boolean).join(" / ")
    return `${item.sourceType ?? "Buff"}｜${label}${detail ? `：${detail}` : ""}`
}

function renderActiveEffects(effects = []) {
    els.inCombatActiveEffects.innerHTML = ""
    if (!effects.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        els.inCombatActiveEffects.appendChild(empty)
        return
    }
    for (const effect of effects) {
        const row = document.createElement("div")
        row.className = "list-item"
        row.textContent = combatEffectText(effect)
        els.inCombatActiveEffects.appendChild(row)
    }
}

const DAMAGE_PANEL_SNAPSHOT_LABELS = {
    atk: "局内攻击力",
    critRate: "面板暴击率",
    effectiveCritRate: "有效暴击率",
    critDmg: "暴击伤害",
    anomalyProficiency: "异常精通",
    dmgBonus: "通用增伤",
    physicalDmg: "物理增伤",
    fireDmg: "火属性增伤",
    iceDmg: "冰属性增伤",
    electricDmg: "电属性增伤",
    etherDmg: "以太增伤",
    penRatio: "穿透率",
    penFlat: "穿透值",
}

const DAMAGE_PANEL_PERCENT_KEYS = new Set([
    "critRate",
    "effectiveCritRate",
    "critDmg",
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "penRatio",
])

function damageNumber(value, digits = 3) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }
    return String(Number(number.toFixed(digits)))
}

function damagePanelValue(key, value) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }
    if (DAMAGE_PANEL_PERCENT_KEYS.has(key)) {
        return `${damageNumber(number * 100, 2)}%`
    }
    return damageNumber(number)
}

function directEventVariantHtml(event = {}) {
    if (!event.damageVariants) {
        return ""
    }
    const items = [
        ["expected", "期望"],
        ["crit", "暴击"],
        ["nonCrit", "非暴击"],
    ].map(([key, label]) => {
        const value = event.damageVariants?.[key]?.finalDamage
        return `<span>${label} ${escapeHtml(damageNumber(value))}</span>`
    }).join("")
    return `<small class="damage-event-variants">${items}</small>`
}

function renderDamagePanelSnapshot(container, snapshot = {}) {
    const entries = Object.entries(snapshot).filter(([, value]) => Number.isFinite(Number(value)))
    if (!entries.length) {
        return
    }
    const block = document.createElement("div")
    block.className = "damage-whitebox-panel"
    block.innerHTML = `
        <strong>结算面板</strong>
        <div>
          ${entries.map(([key, value]) => `
            <span>${escapeHtml(DAMAGE_PANEL_SNAPSHOT_LABELS[key] ?? statLabel(key))}</span>
            <b>${escapeHtml(damagePanelValue(key, value))}</b>
          `).join("")}
        </div>
    `
    container.appendChild(block)
}

function renderDamageWhiteBox(damage) {
    currentRenderedDamage = damage ?? null
    const totalDamage = damage?.totalFinalDamage ?? damage?.finalDamage
    els.damageFinalValue.textContent = totalDamage === undefined
        ? "-"
        : damageNumber(totalDamage)
    els.damageWhiteBoxRows.innerHTML = ""
    const events = damage?.events ?? []
    const selectedEventId = damage?.selectedEventId ?? events[0]?.id
    if (events.length) {
        const breakdown = document.createElement("div")
        breakdown.className = "damage-event-breakdown"
        breakdown.innerHTML = events.map(event => `
            <button type="button" data-select-damage-event-whitebox="${escapeHtml(event.id)}" class="${event.id === selectedEventId ? "active" : ""}">
              <span>
                <span>${escapeHtml(event.label ?? event.id)} ×${escapeHtml(event.count ?? 1)}</span>
                ${event.kind === "direct" ? directEventVariantHtml(event) : ""}
              </span>
              <strong>${escapeHtml(damageNumber(event.finalDamage ?? 0))}</strong>
            </button>
        `).join("")
        els.damageWhiteBoxRows.appendChild(breakdown)
    }
    const selectedEvent = events.find(event => event.id === selectedEventId)
    renderDamagePanelSnapshot(els.damageWhiteBoxRows, selectedEvent?.panelSnapshot ?? {})
    const rows = selectedEvent?.whiteBoxRows ?? damage?.whiteBoxRows ?? []
    for (const row of rows) {
        const item = document.createElement("div")
        item.className = "damage-whitebox-row"
        const formulaHtml = Array.isArray(row.formulaLines) && row.formulaLines.length
            ? row.formulaLines.map(line => `<span>${escapeHtml(line)}</span>`).join("")
            : `<span>${escapeHtml(row.formula ?? "")}</span>`
        item.innerHTML = `
            <div>
              <strong>${escapeHtml(row.label)}</strong>
              ${formulaHtml}
            </div>
            <strong>${escapeHtml(row.displayValue ?? row.value)}</strong>
        `
        els.damageWhiteBoxRows.appendChild(item)
    }
}

function renderCalculationResult(data) {
    const out = data?.outOfCombat ?? {}
    const inCombat = data?.inCombat ?? {}
    renderOrderedKV(els.baseTable, out.base, BASE_ORDER)
    renderOrderedKV(els.bonusTable, out.panel, panelOrder())
    renderOrderedKV(els.inCombatPanelTable, inCombat.panel, panelOrder())
    renderActiveEffects(inCombat.activeEffects ?? [])
    renderDamageWhiteBox(data?.damage)
}

function renderResultTabs() {
    els.optimizerResultTabs.innerHTML = ""
    for (const [index, result] of optimizationResults.entries()) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = index === activeResultIndex ? "active" : ""
        button.dataset.resultIndex = String(index)
        button.textContent = `#${index + 1} ${Number(result.score.toFixed(0))}`
        els.optimizerResultTabs.appendChild(button)
    }
}

function discIcon(disc) {
    return getSet(disc.setId)?.images?.icon ?? "/assets/drive-discs/empty.svg"
}

function renderResultList() {
    els.optimizerResultList.innerHTML = ""
    els.optimizerEmpty.hidden = optimizationResults.length > 0
    els.saveLoadoutBtn.disabled = activeResultIndex < 0
    const active = optimizationResults[activeResultIndex]
    if (!active) {
        return
    }

    const summary = document.createElement("div")
    summary.className = "optimizer-result-summary"
    summary.innerHTML = `
        <strong>第 ${active.rank} 名 · ${Number(active.score.toFixed(3))}</strong>
        <span>${escapeHtml(active.setSummary.map(item => `${item.name} ${item.count}`).join(" / "))}</span>
    `
    els.optimizerResultList.appendChild(summary)

    for (const disc of [...active.driveDiscs].sort((a, b) => Number(a.partition) - Number(b.partition))) {
        const subStats = (disc.subStats ?? [])
            .map(stat => `${statLabel(stat.stat)} ${formatStoredValue(stat.stat, stat.value, stat.mode)}`)
            .join(" / ")
        const item = document.createElement("div")
        item.className = "optimizer-disc-row"
        item.innerHTML = `
            <img src="${escapeHtml(discIcon(disc))}" alt="">
            <div>
                <strong>${escapeHtml(`${disc.partition}号位 · ${disc.setName || nameOf(getSet(disc.setId))}`)}</strong>
                <span>${escapeHtml(`${statLabel(disc.mainStat?.stat)} ${formatStoredValue(disc.mainStat?.stat, disc.mainStat?.value, disc.mainStat?.mode)}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`)}</span>
                <small>${escapeHtml(subStats || "-")}</small>
            </div>
        `
        els.optimizerResultList.appendChild(item)
    }
}

function selectResult(index) {
    activeResultIndex = index
    renderResultTabs()
    renderResultList()
    const result = optimizationResults[index]
    if (result) {
        renderCalculationResult(result.data)
    }
}

function invalidateResults() {
    optimizationResults = []
    activeResultIndex = -1
    lastCompletedOptimizationSettings = null
    lastCompletedOptimizationAgentId = null
    els.optimizerMetrics.textContent = "需重新计算"
    renderResultTabs()
    renderResultList()
    if (!activeOptimizationJobId) {
        clearOptimizationProgress()
    }
}

async function calculateEmptyPanel() {
    const response = await api("/api/calculate/in-combat", {
        method: "POST",
        body: JSON.stringify(collectRequestPayload({ driveDiscs: [] })),
    })
    renderCalculationResult(response.data)
}

function startOptimizationTimers() {
    stopOptimizationTimers()
    optimizationElapsedTimer = setInterval(() => {
        if (!activeOptimizationJobId) {
            return
        }
        renderOptimizationProgress({
            status: "running",
            elapsedMs: Date.now() - optimizationStartedAt,
        })
    }, 250)
}

async function finishOptimizationJob(job) {
    stopOptimizationTimers()
    const settingsSnapshot = activeOptimizationSettingsSnapshot
    const agentIdSnapshot = activeOptimizationAgentIdSnapshot
    activeOptimizationJobId = null
    activeOptimizationSettingsSnapshot = null
    activeOptimizationAgentIdSnapshot = null
    setOptimizeButtonRunning(false)
    renderOptimizationProgress(job)
    if (job.status === "cancelled") {
        setStatus("已取消", "idle")
        els.optimizerMetrics.textContent = "已取消"
        return
    }
    if (job.status === "error") {
        setStatus(job.error || "计算失败", "error")
        els.optimizerMetrics.textContent = "计算失败"
        return
    }

    const data = job.result
    lastCompletedOptimizationSettings = data?.settings ?? job.settings ?? settingsSnapshot
    lastCompletedOptimizationAgentId = agentIdSnapshot ?? els.agentSelect.value
    optimizationResults = data?.results ?? []
    activeResultIndex = optimizationResults.length ? 0 : -1
    const metrics = data?.metrics ?? job.metrics
    const processedCount = processedOptimizationCount(metrics)
    els.optimizerMetrics.textContent = metrics
        ? [
            `评估 ${formatCount(processedCount)} / 估算 ${formatCount(metrics.estimatedCombinationCount)}`,
            metrics.algorithmLabel,
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `真实评分 ${formatCount(metrics.scoredCombinationCount ?? metrics.evaluated ?? 0)}` : "",
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatCount(metrics.prunedBySuperBound)}` : "",
        ].filter(Boolean).join(" · ")
        : "已计算"
    renderResultTabs()
    renderResultList()
    if (optimizationResults.length) {
        selectResult(0)
        setStatus("计算完成", "success")
    } else {
        await calculateEmptyPanel()
        setStatus(data?.error?.reason ?? "没有符合条件的结果", "error")
    }
}

async function pollOptimizationJob(jobId) {
    const response = await api(`/api/optimize/drive-discs/jobs/${encodeURIComponent(jobId)}`)
    const job = response.data
    if (jobId !== activeOptimizationJobId) {
        return
    }
    renderOptimizationProgress(job)
    if (["complete", "error", "cancelled"].includes(job.status)) {
        await finishOptimizationJob(job)
    }
}

async function cancelActiveOptimization({ silent = false } = {}) {
    const jobId = activeOptimizationJobId
    if (!jobId) {
        return
    }
    activeOptimizationJobId = null
    activeOptimizationSettingsSnapshot = null
    activeOptimizationAgentIdSnapshot = null
    stopOptimizationTimers()
    setOptimizeButtonRunning(false)
    renderOptimizationProgress({
        status: "canceling",
        elapsedMs: Date.now() - optimizationStartedAt,
        percent: lastOptimizationProgress?.percent ?? 0,
    })
    if (!silent) {
        setStatus("正在取消", "idle")
    }
    try {
        await api(`/api/optimize/drive-discs/jobs/${encodeURIComponent(jobId)}`, {
            method: "DELETE",
        })
    } catch (error) {
        if (!silent) {
            setStatus(error.message, "error")
        }
        return
    }
    if (!silent) {
        els.optimizerMetrics.textContent = "已取消"
        els.optimizerProgressNote.textContent = "计算已取消"
        setStatus("已取消", "idle")
    }
}

async function runOptimization() {
    if (activeOptimizationJobId) {
        return
    }

    saveSyncedConfig()
    invalidateResults()
    lastCompletedOptimizationSettings = null
    setStatus("计算中", "idle")
    setOptimizeButtonRunning(true)
    const payload = {
        ...collectRequestPayload({ driveDiscs: [] }),
        settings: collectOptimizationSettings(),
    }
    activeOptimizationSettingsSnapshot = structuredClone(payload.settings)
    activeOptimizationAgentIdSnapshot = payload.agentId
    const previewResponse = await api("/api/optimize/drive-discs/preview", {
        method: "POST",
        body: JSON.stringify(payload),
    })
    renderOptimizationProgress({
        status: "preview",
        settings: previewResponse.data.settings,
        metrics: previewResponse.data.metrics,
        evaluated: 0,
        estimatedCombinationCount: previewResponse.data.metrics?.estimatedCombinationCount ?? 0,
        percent: 0,
        elapsedMs: 0,
    })
    const response = await api("/api/optimize/drive-discs/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
    })
    const job = response.data
    activeOptimizationJobId = job.jobId ?? job.id
    optimizationStartedAt = Date.now() - Number(job.elapsedMs ?? 0)
    renderOptimizationProgress(job)
    startOptimizationTimers()
    if (["complete", "error", "cancelled"].includes(job.status)) {
        await finishOptimizationJob(job)
        return
    }
    optimizationPollTimer = setInterval(() => {
        const jobId = activeOptimizationJobId
        if (!jobId) {
            return
        }
        pollOptimizationJob(jobId).catch(error => {
            stopOptimizationTimers()
            activeOptimizationJobId = null
            setOptimizeButtonRunning(false)
            setStatus(error.message, "error")
        })
    }, 500)
    await pollOptimizationJob(activeOptimizationJobId)
}

async function saveActiveLoadout() {
    const result = optimizationResults[activeResultIndex]
    if (!result) {
        return
    }
    const agentId = lastCompletedOptimizationAgentId ?? els.agentSelect.value
    const agentName = nameOf(getAgent(agentId))
    const defaultName = `${agentName}-${Number(result.score.toFixed(0))}-第${result.rank}名`
    const name = window.prompt("套装名称", defaultName)
    if (name === null) {
        return
    }
    setStatus("保存套装", "idle")
    const response = await api("/api/user-drive-disc-loadouts", {
        method: "POST",
        body: JSON.stringify({
            agentId,
            name: name.trim() || defaultName,
            driveDiscIdsBySlot: result.driveDiscIdsBySlot,
            score: result.score,
            source: {
                type: "optimizer",
                rank: result.rank,
                settings: lastCompletedOptimizationSettings ?? collectOptimizationSettings(),
            },
        }),
    })
    store = response.store
    setStatus("已保存套装", "success")
}

function populateMainStatSelect(select, slot) {
    select.innerHTML = ""
    const container = mainStatChoiceContainer(slot)
    container.innerHTML = ""
    const pool = meta?.statRules?.driveDisc?.mainStatPools?.[String(slot)] ?? []
    for (const stat of pool) {
        const option = document.createElement("option")
        option.value = stat
        option.textContent = statLabel(stat)
        select.appendChild(option)

        const label = document.createElement("label")
        label.className = "main-stat-choice"
        label.innerHTML = `
            <input type="checkbox" data-main-stat-limit="${escapeHtml(String(slot))}" value="${escapeHtml(stat)}">
            <span>${escapeHtml(statLabel(stat))}</span>
        `
        container.appendChild(label)
    }
}

function populateSetSelects() {
    const sets = [...(meta?.driveDiscSets ?? [])]
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
    populateSelect(els.fourPieceSetSelect, sets, sets[0]?.id)
    els.twoPieceSetSelect.innerHTML = ""
    els.twoPieceSetChoices.innerHTML = ""
    for (const set of sets) {
        const option = document.createElement("option")
        option.value = set.id
        option.textContent = nameOf(set)
        els.twoPieceSetSelect.appendChild(option)

        const label = document.createElement("label")
        label.className = "main-stat-choice"
        label.innerHTML = `
            <input type="checkbox" data-two-piece-set-limit value="${escapeHtml(set.id)}">
            <span>${escapeHtml(nameOf(set))}</span>
        `
        els.twoPieceSetChoices.appendChild(label)
    }
    syncTwoPieceSetChoices()
}

function restoreHomeState() {
    const selection = loadHomeSelection()
    const agentId = getAgent(selection.currentAgentId)?.id ?? meta.agents[0]?.id
    const config = configForAgent(agentId)
    els.agentSelect.value = agentId
    populateCoreSkillSelect(getAgent(agentId), config.coreSkillLevel)
    populateCinemaLevelSelect(cinemaLevelForAgent(agentId))
    els.wEngineSelect.value = getWEngine(config.wEngineId)?.id ?? meta.wEngines[0]?.id
    populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), config.wEngineModificationLevel)
    applyStoredDamageConfig(config.damage ?? getAgent(agentId)?.defaultCalculationConfig ?? {})
    renderEntityCards()
    renderCombatControls()
}

async function loadAll() {
    meta = await api("/api/meta")
    store = await api("/api/user-drive-discs")
    populateSelect(els.agentSelect, meta.agents, meta.agents[0]?.id)
    populateSelect(els.wEngineSelect, meta.wEngines, meta.wEngines[0]?.id)
    populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), 1)
    populateDamageTargetPresets()
    populateDamageEventSelects()
    populateSetSelects()
    populateMainStatSelect(els.slot4MainStats, 4)
    populateMainStatSelect(els.slot5MainStats, 5)
    populateMainStatSelect(els.slot6MainStats, 6)
    restoreHomeState()
}

async function refreshAfterConfigChange() {
    try {
        const wasRunning = Boolean(activeOptimizationJobId)
        renderEntityCards()
        renderCombatControls()
        saveSyncedConfig()
        invalidateResults()
        if (!wasRunning) {
            await calculateEmptyPanel()
        }
        setStatus(wasRunning ? "计算中" : "就绪", wasRunning ? "idle" : "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
}

els.agentSelect.addEventListener("change", async () => {
    try {
        persistCurrentDamageResistanceInput()
        const agentId = els.agentSelect.value
        const config = configForAgent(agentId)
        populateCoreSkillSelect(getAgent(agentId), config.coreSkillLevel)
        populateCinemaLevelSelect(cinemaLevelForAgent(agentId))
        els.wEngineSelect.value = getWEngine(config.wEngineId)?.id ?? meta.wEngines[0]?.id
        populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), config.wEngineModificationLevel)
        applyStoredDamageConfig(config.damage ?? getAgent(agentId)?.defaultCalculationConfig ?? {})
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
for (const input of [
    els.coreSkillSelect,
    els.cinemaLevelSelect,
    els.wEngineSelect,
    els.wEngineModificationSelect,
]) {
    input.addEventListener("change", async () => {
        try {
            if (input === els.wEngineSelect) {
                populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), els.wEngineModificationSelect?.value ?? 1)
            }
            await refreshAfterConfigChange()
        } catch (error) {
            setStatus(error.message, "error")
        }
    })
}
els.agentLevelInput?.addEventListener("change", refreshAfterConfigChange)
els.agentLevelInput?.addEventListener("input", () => {
    saveSyncedConfig()
    invalidateResults()
    setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
})
for (const { categoryId, select } of skillLevelSelects()) {
    select.addEventListener("change", async () => {
        try {
            damageSkillLevelsByCategory[categoryId] = Number(select.value)
            renderDamageSkillSummary()
            syncCalculationConfigSummary()
            await refreshAfterConfigChange()
        } catch (error) {
            setStatus(error.message, "error")
        }
    })
}
for (const input of [
    els.fourPieceSetSelect,
    els.twoPieceSetSelect,
    els.slot4MainStats,
    els.slot5MainStats,
    els.slot6MainStats,
    els.minEnergyRegen,
    els.minAnomalyProficiency,
    els.minCritRate,
    els.minCritDmg,
]) {
    input.addEventListener("change", refreshAfterConfigChange)
    input.addEventListener("input", () => {
        if (input.tagName === "INPUT") {
            invalidateResults()
            setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
        }
    })
}
document.querySelector(".optimizer-settings-grid").addEventListener("change", event => {
    if (!event.target.matches("[data-two-piece-set-limit]")) {
        return
    }
    event.target.closest(".main-stat-choice")?.classList.toggle("active", event.target.checked)
    setTwoPieceSetSelected(event.target.value, event.target.checked)
})
document.querySelector(".optimizer-settings-grid").addEventListener("click", event => {
    if (!event.target.closest("[data-clear-two-piece-sets]")) {
        return
    }
    clearTwoPieceSetLimits()
})
document.querySelector(".optimizer-main-stat-grid").addEventListener("change", event => {
    if (!event.target.matches("[data-main-stat-limit]")) {
        return
    }
    const slot = event.target.dataset.mainStatLimit
    const select = els[`slot${slot}MainStats`]
    event.target.closest(".main-stat-choice")?.classList.toggle("active", event.target.checked)
    setMainStatSelected(select, event.target.value, event.target.checked)
})
document.querySelector(".optimizer-main-stat-grid").addEventListener("click", event => {
    const clear = event.target.closest("[data-clear-main-stats]")
    if (!clear) {
        return
    }
    clearMainStatLimits(clear.dataset.clearMainStats)
})
els.combatSection.addEventListener("change", async event => {
    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (runtimeField && !els.addedCombatBuffs.contains(event.target)) {
        await commitRuntimeField(runtimeField)
        return
    }

    if (els.addedCombatBuffs.contains(event.target)) {
        return
    }
    if (event.target.matches("input[type='number']")) {
        await commitGenericNumberInput(event.target)
        return
    }
    if (!event.target.matches("input[data-combat-buff-id], select")) {
        return
    }
    try {
        if (event.target.matches("input[data-combat-buff-id]") && event.target.dataset.combatBuffDefaultChecked === "true") {
            if (event.target.checked) {
                manuallyUncheckedDefaultCombatBuffIds.delete(event.target.dataset.combatBuffId)
            } else {
                manuallyUncheckedDefaultCombatBuffIds.add(event.target.dataset.combatBuffId)
            }
        }
        if (event.target === els.damageTargetPreset) {
            syncDamageDefenseToPreset()
        }
        syncCalculationConfigSummary()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.combatSection.addEventListener("click", async event => {
    const resistanceButton = event.target.closest("[data-resistance-preset]")
    if (!resistanceButton) {
        return
    }
    try {
        syncDamageResistanceToPreset(resistanceButton.dataset.resistancePreset)
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.combatSection.addEventListener("input", event => {
    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (runtimeField && !els.addedCombatBuffs.contains(event.target)) {
        const group = runtimeField.closest("[data-buff-key]")
        if (!group) {
            return
        }
        try {
            const value = inputNumberValue(runtimeField)
            if (value === null || !Number.isFinite(value)) {
                return
            }
            updateRuntimeFieldValue(group.dataset.buffKey, runtimeField, value)
            refreshAddedCombatBuffSummary(group.dataset.buffKey)
            saveSyncedConfig()
            invalidateResults()
            setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    if (els.addedCombatBuffs.contains(event.target) || !event.target.matches("input[type='number']")) {
        return
    }
    const value = inputNumberValue(event.target)
    if (value === null || !Number.isFinite(value)) {
        return
    }
    if (event.target === els.damageTargetDefense) {
        syncDamagePresetFromDefense()
    }
    if (event.target === els.damageTargetResistance) {
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue()
    }
    try {
        saveSyncedConfig()
        invalidateResults()
        setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.calculationSettingsCard?.addEventListener("change", async event => {
    try {
        if (event.target === els.damageAnomalySettlementType) {
            renderCalculationObjectiveControls()
        }
        if (event.target === els.damageAnomalyEffect) {
            els.damageAnomalyProcCount.value = event.target.selectedOptions?.[0]?.dataset.defaultProcCount ?? 1
        }
        if (event.target === els.damageDisorderEffect) {
            els.damageDisorderDuration.value = event.target.selectedOptions?.[0]?.dataset.defaultDurationSeconds ?? 10
        }
        syncCalculationConfigSummary()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.calculationSettingsCard?.addEventListener("input", event => {
    if (!event.target.matches("input[type='number']")) {
        return
    }
    if (event.target === els.damageSkillMultiplier) {
        selectedDamageSkillRef = null
        renderDamageSkillSummary()
    }
    if (event.target === els.damageSkillMultiplier || event.target === els.damageAnomalyProcCount || event.target === els.damageDisorderElapsed || event.target === els.damageDisorderDuration) {
        syncCalculationConfigSummary()
    }
    try {
        saveSyncedConfig()
        invalidateResults()
        setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.calculationSettingsCard?.addEventListener("keydown", async event => {
    if (event.key !== "Enter" || !event.target.matches("input[type='number']")) {
        return
    }
    event.preventDefault()
    await refreshAfterConfigChange()
})
els.combatSection.addEventListener("keydown", async event => {
    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (runtimeField && !els.addedCombatBuffs.contains(event.target)) {
        if (event.key !== "Enter") {
            return
        }
        event.preventDefault()
        await commitRuntimeField(runtimeField)
        return
    }

    if (event.key !== "Enter" || els.addedCombatBuffs.contains(event.target) || !event.target.matches("input[type='number']")) {
        return
    }
    event.preventDefault()
    await commitGenericNumberInput(event.target)
})
els.addedCombatBuffs.addEventListener("click", async event => {
    const remove = event.target.closest("[data-remove-buff-key]")
    if (!remove) {
        return
    }
    try {
        saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().filter(item => addedCombatBuffKey(item) !== remove.dataset.removeBuffKey))
        renderCombatControls()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.addedCombatBuffs.addEventListener("input", event => {
    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (!runtimeField) {
        return
    }
    const group = runtimeField.closest("[data-buff-key]")
    if (!group) {
        return
    }
    try {
        const value = inputNumberValue(runtimeField)
        if (value === null || !Number.isFinite(value)) {
            return
        }
        updateRuntimeFieldValue(group.dataset.buffKey, runtimeField, value)
        refreshAddedCombatBuffSummary(group.dataset.buffKey)
        saveSyncedConfig()
        invalidateResults()
        setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.addedCombatBuffs.addEventListener("change", async event => {
    const modificationSelect = event.target.closest("[data-w-engine-team-modification-level]")
    if (modificationSelect) {
        const group = modificationSelect.closest("[data-buff-key]")
        if (!group) {
            return
        }
        try {
            updateAddedCombatBuffModificationLevel(group.dataset.buffKey, modificationSelect.value)
            renderCombatControls()
            await refreshAfterConfigChange()
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (runtimeField) {
        await commitRuntimeField(runtimeField)
    }
})
els.addedCombatBuffs.addEventListener("keydown", async event => {
    if (event.key !== "Enter") {
        return
    }
    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (!runtimeField) {
        return
    }
    event.preventDefault()
    await commitRuntimeField(runtimeField)
})
els.openDamageSkillModalBtn?.addEventListener("click", openDamageSkillModal)
els.closeDamageSkillModalBtn?.addEventListener("click", closeDamageSkillModal)
els.openCalculationConfigBtn?.addEventListener("click", openCalculationConfigModal)
els.closeCalculationConfigModalBtn?.addEventListener("click", closeCalculationConfigModal)
els.calculationConfigModal?.addEventListener("click", async event => {
    if (event.target.matches("[data-close-calculation-config-modal]")) {
        closeCalculationConfigModal()
        return
    }
    if (event.target === els.applyAdminDefaultCalculationBtn) {
        const config = getAgent(els.agentSelect.value)?.defaultCalculationConfig
        if (config) {
            applyCalculationConfig(config)
            renderCalculationConfigModal()
        }
        return
    }
    const addKind = event.target.closest("[data-add-calculation-event-kind]")
    if (addKind) {
        addCalculationConfigEvent(addKind.dataset.addCalculationEventKind)
        return
    }
    const selectEvent = event.target.closest("[data-select-calculation-event]")
    if (selectEvent) {
        selectCalculationConfigEvent(Number(selectEvent.dataset.selectCalculationEvent))
        return
    }
    const duplicate = event.target.closest("[data-duplicate-calculation-event]")
    if (duplicate) {
        duplicateCalculationConfigEvent(Number(duplicate.dataset.duplicateCalculationEvent))
        return
    }
    if (event.target === els.duplicateCalculationEventBtn) {
        duplicateCalculationConfigEvent()
        return
    }
    const remove = event.target.closest("[data-remove-calculation-event]")
    if (remove) {
        removeCalculationConfigEvent(Number(remove.dataset.removeCalculationEvent))
        return
    }
    if (event.target === els.removeCalculationEventBtn) {
        removeCalculationConfigEvent()
        return
    }
    if (event.target === els.saveCalculationConfigBtn) {
        calculationConfigMode = els.calculationConfigMode?.value ?? "single"
        calculationConfigEvents = readCalculationConfigEventsFromModal()
        calculationConfigSelectedEventId = calculationConfigEvents.some(item => item.id === calculationConfigSelectedEventId)
            ? calculationConfigSelectedEventId
            : calculationConfigEvents[0]?.id ?? null
        syncCalculationConfigSummary()
        renderCalculationObjectiveControls()
        closeCalculationConfigModal()
        await refreshAfterConfigChange()
    }
})
els.calculationConfigModal?.addEventListener("change", event => {
    if (event.target === els.calculationConfigMode) {
        syncEditingEventFromEditor({ renderList: false })
        syncCalculationConfigModeFields()
        return
    }
    if (!els.calculationEventEditorFields?.contains(event.target)) {
        return
    }
    if (event.target.matches("[data-calculation-event-kind]")) {
        const index = normalizeCalculationEditingIndex()
        if (index >= 0) {
            const previous = calculationConfigEvents[index]
            calculationConfigEvents[index] = calculationEventForKind(event.target.value, previous)
            calculationConfigSelectedEventId = calculationConfigEvents[index]?.id ?? null
        }
        renderCalculationConfigEvents()
        return
    }
    if (event.target.matches("[data-calculation-skill-category]")) {
        const categoryId = event.target.value
        const moveSelect = els.calculationEventEditorFields.querySelector("[data-calculation-skill-move]")
        const rowSelect = els.calculationEventEditorFields.querySelector("[data-calculation-skill-row]")
        moveSelect.innerHTML = calculationSkillMoveOptions(categoryId)
        rowSelect.innerHTML = calculationSkillRowOptions(categoryId, moveSelect.value)
        syncEditingEventFromEditor()
        return
    }
    if (event.target.matches("[data-calculation-skill-move]")) {
        const categoryId = els.calculationEventEditorFields.querySelector("[data-calculation-skill-category]")?.value ?? ""
        const rowSelect = els.calculationEventEditorFields.querySelector("[data-calculation-skill-row]")
        rowSelect.innerHTML = calculationSkillRowOptions(categoryId, event.target.value)
        syncEditingEventFromEditor()
        return
    }
    syncEditingEventFromEditor()
})
els.calculationConfigModal?.addEventListener("input", event => {
    if (!els.calculationEventEditorFields?.contains(event.target)) {
        return
    }
    syncEditingEventFromEditor()
})
els.damageSkillModal?.addEventListener("click", async event => {
    if (event.target.matches("[data-close-damage-skill-modal]")) {
        closeDamageSkillModal()
        return
    }
    const moveChoice = event.target.closest("[data-pick-damage-skill-move]")
    if (moveChoice) {
        const movePaneScrollTop = els.damageSkillModalList?.querySelector(".damage-skill-move-pane")?.scrollTop ?? 0
        activeDamageSkillPickerMoveRef = {
            categoryId: moveChoice.dataset.categoryId,
            moveId: moveChoice.dataset.moveId,
        }
        renderDamageSkillModal()
        const movePane = els.damageSkillModalList?.querySelector(".damage-skill-move-pane")
        if (movePane) {
            movePane.scrollTop = movePaneScrollTop
        }
        return
    }
    const choice = event.target.closest("[data-select-damage-skill]")
    if (!choice) {
        return
    }
    try {
        selectDamageSkill({
            categoryId: choice.dataset.categoryId,
            moveId: choice.dataset.moveId,
            rowId: choice.dataset.rowId,
        })
        closeDamageSkillModal()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.openCombatBuffModalBtn.addEventListener("click", () => openCombatBuffModal())
els.closeCombatBuffModalBtn.addEventListener("click", closeCombatBuffModal)
els.combatBuffModal.addEventListener("click", async event => {
    if (event.target.matches("[data-close-combat-buff-modal]")) {
        closeCombatBuffModal()
        return
    }
    const tab = event.target.closest("[data-combat-buff-tab]")
    if (tab) {
        activeCombatBuffTab = tab.dataset.combatBuffTab
        renderCombatBuffCandidates()
        return
    }
    const candidate = event.target.closest("[data-candidate-key]")
    if (candidate && !candidate.disabled) {
        try {
            if (addCombatBuffCandidateByKey(candidate.dataset.candidateKey)) {
                closeCombatBuffModal()
                renderCombatBuffControls()
                await refreshAfterConfigChange()
            }
        } catch (error) {
            setStatus(error.message, "error")
        }
    }

    const addSkillTarget = event.target.closest("[data-add-custom-skill-target]")
    if (addSkillTarget) {
        const rows = customBuffRowsFromDom()
        rows[0].skillTargets = [...(rows[0].skillTargets ?? []), {}]
        renderCustomBuffStatRows(rows)
        return
    }

    const removeSkillTarget = event.target.closest("[data-remove-custom-skill-target]")
    if (removeSkillTarget) {
        const rows = customBuffRowsFromDom()
        rows[0].skillTargets = (rows[0].skillTargets ?? []).filter((_, index) => index !== Number(removeSkillTarget.dataset.removeCustomSkillTarget))
        renderCustomBuffStatRows(rows)
    }
})
els.combatBuffModal.addEventListener("change", event => {
    if (event.target.matches("[data-custom-target-kind]")) {
        const rows = customBuffRowsFromDom()
        rows[0].optionIndex = 0
        rows[0].skillTargets = [{}]
        renderCustomBuffStatRows(rows)
        return
    }
    if (event.target.matches("[data-custom-stat-select]")) {
        renderCustomBuffStatRows(customBuffRowsFromDom())
        return
    }
    if (event.target.matches("[data-custom-skill-agent]")) {
        syncCustomSkillTargetFields(event.target.closest("[data-custom-skill-target]"), { agentSkillId: event.target.value })
        return
    }
    if (event.target.matches("[data-custom-skill-category]")) {
        const targetRow = event.target.closest("[data-custom-skill-target]")
        syncCustomSkillTargetFields(targetRow, {
            agentSkillId: targetRow.querySelector("[data-custom-skill-agent]")?.value ?? "",
            categoryId: event.target.value,
        })
        return
    }
    if (event.target.matches("[data-custom-skill-move]")) {
        const targetRow = event.target.closest("[data-custom-skill-target]")
        syncCustomSkillTargetFields(targetRow, {
            agentSkillId: targetRow.querySelector("[data-custom-skill-agent]")?.value ?? "",
            categoryId: targetRow.querySelector("[data-custom-skill-category]")?.value ?? "",
            moveId: event.target.value,
        })
    }
})
els.combatBuffSearchInput.addEventListener("input", renderCombatBuffCandidates)
els.saveCustomBuffBtn.addEventListener("click", async () => {
    try {
        const stats = customBuffStatsFromDom()
        const effects = customBuffEffectsFromDom()
        if (!stats.length && !effects.length) {
            setStatus("自定义 Buff 至少需要一个非零属性", "error")
            return
        }
        saveCurrentAddedCombatBuffs([
            ...currentAddedCombatBuffs(),
            {
                id: `custom-${Date.now()}`,
                sourceCategory: "custom",
                sourceKind: "custom",
                name: els.customBuffNameInput.value.trim() || "自定义 Buff",
                stats,
                effects,
            },
        ])
        closeCombatBuffModal()
        renderCustomBuffStatRows([{ optionIndex: 0, value: 0 }])
        renderCombatControls()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.optimizerResultTabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-result-index]")
    if (button) {
        selectResult(Number(button.dataset.resultIndex))
    }
})
els.damageWhiteBoxRows.addEventListener("click", event => {
    const button = event.target.closest("[data-select-damage-event-whitebox]")
    if (!button || !currentRenderedDamage) {
        return
    }
    calculationConfigSelectedEventId = button.dataset.selectDamageEventWhitebox
    renderDamageWhiteBox({
        ...currentRenderedDamage,
        selectedEventId: button.dataset.selectDamageEventWhitebox,
    })
})
els.optimizeBtn.addEventListener("click", async () => {
    try {
        await runOptimization()
    } catch (error) {
        stopOptimizationTimers()
        activeOptimizationJobId = null
        setOptimizeButtonRunning(false)
        setStatus(error.message, "error")
    }
})
els.cancelOptimizeBtn.addEventListener("click", async () => {
    try {
        await cancelActiveOptimization()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.saveLoadoutBtn.addEventListener("click", async () => {
    try {
        await saveActiveLoadout()
    } catch (error) {
        setStatus(error.message, "error")
    }
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        await loadAll()
        await calculateEmptyPanel()
        renderResultList()
        setStatus("就绪", "success")
    } catch (error) {
        setStatus(error.message, "error")
        console.error(error)
    }
}

bootstrap()
