import { evaluateFormulaExpression } from "./formulaEvaluator.js"
import * as SharedCombat from "./shared-combat.js"

const els = {
    status: document.getElementById("status"),
    combatSection: document.getElementById("combat-section"),
    agentSelect: document.getElementById("agentSelect"),
    agentImage: document.getElementById("agentImage"),
    agentMeta: document.getElementById("agentMeta"),
    coreSkillSelect: document.getElementById("coreSkillSelect"),
    wEngineSelect: document.getElementById("wEngineSelect"),
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
    damageSkillCategory: document.getElementById("damageSkillCategory"),
    damageSkillMove: document.getElementById("damageSkillMove"),
    damageSkillRow: document.getElementById("damageSkillRow"),
    damageSkillLevel: document.getElementById("damageSkillLevel"),
    damageCritMode: document.getElementById("damageCritMode"),
    algorithmSelect: document.getElementById("algorithmSelect"),
    fourPieceSetSelect: document.getElementById("fourPieceSetSelect"),
    twoPieceSetSelect: document.getElementById("twoPieceSetSelect"),
    slot4MainStats: document.getElementById("slot4MainStats"),
    slot5MainStats: document.getElementById("slot5MainStats"),
    slot6MainStats: document.getElementById("slot6MainStats"),
    minEnergyRegen: document.getElementById("minEnergyRegen"),
    minAnomalyProficiency: document.getElementById("minAnomalyProficiency"),
    minCritRate: document.getElementById("minCritRate"),
    minCritDmg: document.getElementById("minCritDmg"),
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
const ELEMENT_DMG_KEYS = new Set(["physicalDmg", "fireDmg", "iceDmg", "electricDmg", "etherDmg"])
const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
}
const RESISTANCE_PRESET_VALUES = new Set(["-20", "0", "20"])
const ENUM_LABELS = {
    attribute: {
        physical: "物理",
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
const CUSTOM_BUFF_STAT_OPTIONS = [
    ["atkFlat", "固定攻击力", "flat", null],
    ["atkPct", "基础攻击力%", "pct", "baseAtk"],
    ["atkPct", "局外攻击力%", "pct", "outOfCombatAtk"],
    ["hpPct", "基础生命值%", "pct", "baseHp"],
    ["hpPct", "局外生命值%", "pct", "outOfCombatHp"],
    ["defPct", "基础防御力%", "pct", "baseDef"],
    ["defPct", "局外防御力%", "pct", "outOfCombatDef"],
    ["critRate", "暴击率%", "flat", null],
    ["critDmg", "暴击伤害%", "flat", null],
    ["penRatio", "穿透率%", "flat", null],
    ["dmgBonus", "通用伤害%", "flat", null],
    ["physicalDmg", "物理伤害%", "flat", null],
    ["fireDmg", "火属性伤害%", "flat", null],
    ["iceDmg", "冰属性伤害%", "flat", null],
    ["electricDmg", "电属性伤害%", "flat", null],
    ["etherDmg", "以太伤害%", "flat", null],
    ["enemyDefReduction", "敌方减防率%", "flat", null],
    ["enemyDefFlatReduction", "敌方固定减防", "flat", null],
    ["enemyResReduction", "当前属性减抗%", "flat", null],
    ["currentResIgnore", "当前属性抗性无视%", "flat", null],
    ["enemyPhysicalResReduction", "物理减抗%", "flat", null],
    ["enemyFireResReduction", "火减抗%", "flat", null],
    ["enemyIceResReduction", "冰减抗%", "flat", null],
    ["enemyElectricResReduction", "电减抗%", "flat", null],
    ["enemyEtherResReduction", "以太减抗%", "flat", null],
    ["physicalResIgnore", "物理抗性无视%", "flat", null],
    ["fireResIgnore", "火抗性无视%", "flat", null],
    ["iceResIgnore", "冰抗性无视%", "flat", null],
    ["electricResIgnore", "电抗性无视%", "flat", null],
    ["etherResIgnore", "以太抗性无视%", "flat", null],
]
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

function complexityText(metrics = {}) {
    const complexity = metrics.complexity
    if (!complexity?.label) {
        return ""
    }
    const high = ["high", "extreme"].includes(complexity.level)
    return high
        ? `复杂度：${complexity.label}，建议限定 2 件套或主词条`
        : `复杂度：${complexity.label}`
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
    const evaluated = merged.evaluated ?? metrics.evaluated ?? 0
    const estimated = merged.estimatedCombinationCount ?? metrics.estimatedCombinationCount ?? 0
    const percent = Math.max(0, Math.min(100, Number(merged.percent ?? 0)))
    els.optimizerProgress.hidden = false
    els.optimizerProgressFill.style.width = `${percent}%`
    els.optimizerProgressPercent.textContent = formatPercent(percent)
    els.optimizerElapsed.textContent = `已计算 ${formatDuration(elapsedMs)}`
    els.optimizerEvaluated.textContent = `已评估 ${formatCount(evaluated)}`
    els.optimizerEstimate.textContent = `估算 ${formatCount(estimated)}`

    const candidateCounts = metrics.candidateCountsBySlot ?? {}
    const candidateText = Object.keys(candidateCounts).length
        ? `候选 ${Object.entries(candidateCounts).map(([slot, count]) => `${slot}号位 ${formatCount(count)}`).join(" / ")}`
        : ""
    els.optimizerProgressNote.textContent = [
        progressTextForStatus(merged.status),
        candidateText,
        complexityText(metrics),
        appliedPreferredText(merged.settings),
    ].filter(Boolean).join(" · ")
    els.optimizerMetrics.textContent = estimated
        ? `${formatPercent(percent)} · ${formatCount(evaluated)} / ${formatCount(estimated)}`
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
    return combatUi.loadHomeSelection()
}

function saveHomeSelection(selection) {
    combatUi.saveHomeSelection(selection)
}

function configForAgent(agentId) {
    return combatUi.configForAgent(agentId)
}

function saveSyncedConfig() {
    const agentId = els.agentSelect.value
    const selection = loadHomeSelection()
    const byAgent = { ...selection.byAgent }
    byAgent[agentId] = {
        ...(byAgent[agentId] ?? {}),
        wEngineId: els.wEngineSelect.value,
        coreSkillLevel: els.coreSkillSelect.value,
        combat: {
            ...((byAgent[agentId] ?? {}).combat ?? {}),
            addedBuffs: ((byAgent[agentId] ?? {}).combat?.addedBuffs ?? []),
        },
        damage: collectDamageConfig(),
    }
    saveHomeSelection({ version: 1, currentAgentId: agentId, byAgent })
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
    const wEngine = getWEngine(els.wEngineSelect.value)
    renderAgentMeta(agent, els.coreSkillSelect.value)
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

function agentSkillCatalog(agentId = els.agentSelect?.value) {
    return meta?.agentSkills?.find(item => item.agentId === agentId) ?? null
}

function skillLevelRange(category = {}, move = {}, row = {}) {
    return row.levelRange ?? move.levelRange ?? category.levelRange ?? {
        min: 1,
        max: Array.isArray(row.values) ? row.values.length : 1,
        default: 1,
    }
}

function damageSkillRows(move = {}) {
    return (move.rows ?? []).filter(row => (row.kind ?? "damageMultiplier") === "damageMultiplier")
}

function damageSkillCategories(skill = agentSkillCatalog()) {
    return (skill?.categories ?? [])
        .map(category => ({
            ...category,
            moves: (category.moves ?? [])
                .map(move => ({
                    ...move,
                    rows: damageSkillRows(move),
                }))
                .filter(move => move.rows.length),
        }))
        .filter(category => category.moves.length)
}

function setDamageSkillControlsHidden(hidden) {
    for (const control of [els.damageSkillCategory, els.damageSkillMove, els.damageSkillRow, els.damageSkillLevel]) {
        if (!control) {
            continue
        }
        control.closest(".field").hidden = hidden
        control.disabled = hidden
    }
}

function fillSelect(select, options, selected = "") {
    if (!select) {
        return ""
    }
    select.innerHTML = ""
    for (const [value, label] of options) {
        const option = document.createElement("option")
        option.value = value
        option.textContent = label
        select.appendChild(option)
    }
    const validSelected = options.some(([value]) => value === selected) ? selected : options[0]?.[0] ?? ""
    select.value = validSelected
    return validSelected
}

function readDamageSkillRef() {
    const skill = agentSkillCatalog()
    if (!skill || !els.damageSkillCategory?.value || !els.damageSkillMove?.value || !els.damageSkillRow?.value) {
        return null
    }
    return {
        agentSkillId: skill.id,
        categoryId: els.damageSkillCategory.value,
        moveId: els.damageSkillMove.value,
        rowId: els.damageSkillRow.value,
        level: Number(els.damageSkillLevel?.value || 1),
    }
}

function selectedDamageSkillRow() {
    const skill = agentSkillCatalog()
    const category = damageSkillCategories(skill).find(item => item.id === els.damageSkillCategory?.value)
    const move = (category?.moves ?? []).find(item => item.id === els.damageSkillMove?.value)
    const row = damageSkillRows(move).find(item => item.id === els.damageSkillRow?.value)
    return { skill, category, move, row }
}

function syncDamageSkillMultiplierFromSelection() {
    const { category, move, row } = selectedDamageSkillRow()
    const range = skillLevelRange(category, move, row)
    const level = Number(els.damageSkillLevel?.value || range.default || range.min || 1)
    const value = Number(row?.values?.[level - Number(range.min ?? 1)])
    if (Number.isFinite(value)) {
        els.damageSkillMultiplier.value = value
    }
}

function populateDamageSkillControls(preferredRef = null) {
    const skill = agentSkillCatalog()
    const categories = damageSkillCategories(skill)
    setDamageSkillControlsHidden(!skill || !categories.length)
    if (!skill || !categories.length) {
        return
    }

    const categoryId = fillSelect(els.damageSkillCategory, [
        ["", "手填倍率"],
        ...categories.map(category => [category.id, nameOf(category)]),
    ], preferredRef?.categoryId ?? "")
    const category = categories.find(item => item.id === categoryId)
    const manualMode = !category
    for (const control of [els.damageSkillMove, els.damageSkillRow, els.damageSkillLevel]) {
        if (control) {
            control.disabled = manualMode
        }
    }
    if (manualMode) {
        fillSelect(els.damageSkillMove, [["", "-"]])
        fillSelect(els.damageSkillRow, [["", "-"]])
        fillSelect(els.damageSkillLevel, [["", "-"]])
        return
    }

    const moveId = fillSelect(
        els.damageSkillMove,
        category.moves.map(move => [move.id, nameOf(move)]),
        preferredRef?.moveId ?? "",
    )
    const move = category.moves.find(item => item.id === moveId)
    const rows = damageSkillRows(move)
    const rowId = fillSelect(
        els.damageSkillRow,
        rows.map(row => [row.id, localizedText(row.label) || row.id]),
        preferredRef?.rowId ?? "",
    )
    const row = rows.find(item => item.id === rowId)
    const range = skillLevelRange(category, move, row)
    const min = Number(range.min ?? 1)
    const max = Number(range.max ?? row?.values?.length ?? min)
    const defaultLevel = Number(range.default ?? max)
    const preferredLevel = Number(preferredRef?.level)
    const selectedLevel = String(Number.isInteger(preferredLevel) && preferredLevel >= min && preferredLevel <= max
        ? preferredLevel
        : defaultLevel)
    const levels = []
    for (let level = min; level <= max; level += 1) {
        levels.push([String(level), `LV${level}`])
    }
    fillSelect(els.damageSkillLevel, levels, selectedLevel)
    syncDamageSkillMultiplierFromSelection()
}

function applyStoredDamageConfig(config = {}) {
    const target = config.target ?? {}
    const damageElement = currentDamageElement()
    activeDamageResistanceElement = damageElement
    for (const element of DAMAGE_ELEMENTS) {
        damageTargetResistanceByElement[element] = Number(target.resistanceByElement?.[element] ?? target.resistance ?? 0)
    }
    els.damageTargetPreset.value = target.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID
    els.damageTargetDefense.value = target.defense ?? damageTargetPresetById(els.damageTargetPreset.value)?.defense ?? 953
    els.damageLevelCoefficient.value = target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT
    els.damageTargetResistance.value = damageTargetResistanceByElement[damageElement] ?? 0
    els.damageSkillMultiplier.value = config.skillMultiplier ?? 100
    els.damageCritMode.value = config.critMode ?? "expected"
    populateDamageSkillControls(config.skillRef ?? null)
    syncDamageResistanceControlsToAgent()
    syncDamagePresetFromDefense()
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
        .filter(rule => rule.stat)
        .map(rule => {
            const value = rule.type === "stacked"
                ? Number(rule.valuePerStack ?? rule.value ?? 0) * Number(rule.defaultStacks ?? rule.maxStacks ?? 1)
                : Number(rule.value ?? 0)
            return `${statLabel(rule.stat)} +${formatStoredValue(rule.stat, value, rule.mode)}`
        })
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
    const fixedBuffs = [
        ["corePassive", combatBuffs.corePassive],
        ["additionalAbility", combatBuffs.additionalAbility],
    ]
        .filter(([, buff]) => buff?.scope === "inCombat")
        .map(([key, buff]) => ({
            id: `agent:${agent.id}.${key}`,
            sourceType: "self",
            name: buff.name ?? { zhCN: labels[key] ?? key },
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            effects: buff.effects ?? null,
            stats: effectStats(buff),
            coverage: buff.coverage ?? null,
        }))
    const cinemaBuffs = (combatBuffs.cinemaBuffs ?? [])
        .filter(buff => buff?.scope === "inCombat")
        .map(buff => ({
            id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
            sourceType: "self",
            sourceKind: "cinema",
            defaultChecked: buff.defaultChecked ?? false,
            name: buff.name ?? cinemaBuffName(buff),
            conditionLabel: localizedText(buff.conditionLabel) || localizedText(buff.description) || buff.condition,
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

function wEngineEquippedBuffs() {
    const wEngine = getWEngine(els.wEngineSelect.value)
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

function isDriveDiscAddedBuff(item) {
    return item?.sourceCategory === "driveDisc"
        || item?.sourceKind === "ownDriveDisc4pc"
        || item?.sourceKind === "teammateDriveDisc4pc"
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
    const byAgent = { ...selection.byAgent }
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
    saveHomeSelection({ version: 1, currentAgentId: agentId, byAgent })
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
            coverage: buff.coverage ?? null,
        })))
}

function wEngineTeamBuffCandidates() {
    return (meta?.wEngines ?? [])
        .map(wEngine => {
            const effect = wEngineEffectData(wEngine)
            const buff = wEngineEffectTeamBuff(wEngine)
            if (!buff || buff.scope !== "inCombat") {
                return null
            }
            return {
                id: wEngineTeamBuffKey(wEngine),
                sourceType: "wEngineTeam",
                sourceCategory: "wEngine",
                sourceKind: "wEngineTeam",
                ownerName: wEngine.name,
                name: effect?.name ?? buff.name ?? wEngine.name,
                description: effect?.description ?? buff.description ?? buff.conditionLabel,
                conditionLabel: buff.condition ?? effect?.requirement?.label,
                stats: effectStats(buff),
                effects: buff.effects ?? null,
                coverage: buff.coverage ?? null,
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
    return []
}

function allCombatBuffCandidates() {
    return [
        ...teammateBuffCandidates(),
        ...wEngineTeamBuffCandidates(),
    ]
}

function resolveAddedCombatBuff(item) {
    if (item?.sourceKind === "custom") {
        return {
            ...item,
            ownerName: { zhCN: "自定义", en: "Custom" },
            description: effectStats(item).length ? effectStatText(item) : "",
        }
    }
    return allCombatBuffCandidates().find(candidate =>
        candidate.sourceKind === item?.sourceKind
        && candidate.id === item.id
    ) ?? item
}

function addedCombatBuffKey(item) {
    return `${item.sourceKind}:${item.id}`
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
        const row = document.createElement("label")
        row.className = "combat-check-row"
        const input = document.createElement("input")
        input.type = "checkbox"
        input.dataset.combatBuffId = buff.id
        input.dataset.combatBuffSourceType = buff.sourceType ?? ""
        input.dataset.combatBuffDefaultChecked = isDefaultCheckedCombatBuff(buff) ? "true" : "false"
        input.checked = checkedIds.has(buff.id)
            || (isDefaultCheckedCombatBuff(buff) && !manuallyUncheckedDefaultCombatBuffIds.has(buff.id))
        const copy = document.createElement("span")
        copy.className = "combat-check-copy"
        const title = document.createElement("strong")
        title.textContent = nameOf(buff)
        const detail = document.createElement("span")
        detail.textContent = [buff.conditionLabel, storedEffectRulesText(buff)].filter(Boolean).join(" · ") || "勾选后计入局内"
        copy.append(title, detail)
        row.append(input, copy)
        container.appendChild(row)
    }
}

function renderAddedCombatBuffs() {
    const added = currentAddedCombatBuffs()
    els.addedCombatBuffs.innerHTML = ""
    if (!added.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "点击 + 添加队友、音擎或自定义 Buff"
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
        stats.className = "combat-added-stats"
        stats.textContent = storedEffectRulesText(buff, runtime) || effectStatText(buff) || "-"
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
        renderBuffRuntimeControls(row, item, buff, runtime)
        row.appendChild(remove)
        els.addedCombatBuffs.appendChild(row)
    }
}

function renderBuffRuntimeControls(row, item, buff, runtime) {
    const rules = effectRules(buff)
    const hasCoverage = Boolean(buff.coverage)
    const needsRuntime = hasCoverage || rules.some(rule => rule.type === "derived" || rule.type === "formula" || rule.type === "stacked")
    if (!needsRuntime) {
        return
    }
    const controls = document.createElement("div")
    controls.className = "combat-runtime-grid"
    controls.dataset.buffKey = addedCombatBuffKey(item)
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
    updateAddedCombatBuffRuntime(buffKey, runtime => setRuntimeValue(runtime, field, value))
}

function refreshAddedCombatBuffSummary(buffKey) {
    const item = addedCombatBuffByKey(buffKey)
    const row = els.addedCombatBuffs.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
    const summary = row?.querySelector(".combat-added-stats")
    if (!item || !summary) {
        return
    }
    const buff = resolveAddedCombatBuff(item)
    summary.textContent = storedEffectRulesText(buff, runtimeForBuff(item, buff)) || "-"
}

function runtimeFieldContext(field) {
    const group = field.closest("[data-buff-key]")
    const buffKey = group?.dataset.buffKey
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
    renderCombatCheckboxList(els.bossCombatBuffs, combatBuffsByType("boss"), checkedIds)
    renderCombatCheckboxList(els.fieldCombatBuffs, combatBuffsByType("field"), checkedIds)
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

function collectCombatBuffConfig() {
    persistCurrentDamageResistanceInput()
    renderCombatControls()
    renderEntityCards()
    const addedBuffs = currentAddedCombatBuffs()
    const activeBuffIds = [...checkedCombatBuffIds()]
    const runtimeInputs = {}
    for (const item of addedBuffs) {
        if (["teammate", "wEngineTeam"].includes(item.sourceKind)) {
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }
    }

    return {
        activeBuffIds: [...new Set(activeBuffIds)],
        teammateDriveDiscSetIds: [],
        manualStats: collectManualStats(),
        runtimeInputs,
    }
}

function collectDamageConfig() {
    persistCurrentDamageResistanceInput()
    const damageElement = currentDamageElement()
    const skillRef = readDamageSkillRef()
    return {
        skillMultiplier: Number(els.damageSkillMultiplier?.value || 100),
        ...(skillRef ? { skillRef } : {}),
        critMode: els.damageCritMode?.value || "expected",
        target: {
            presetId: els.damageTargetPreset?.value || DEFAULT_DAMAGE_TARGET_PRESET_ID,
            defense: Number(els.damageTargetDefense?.value || 953),
            levelCoefficient: Number(els.damageLevelCoefficient?.value || DEFAULT_DAMAGE_LEVEL_COEFFICIENT),
            resistanceByElement: {
                ...damageTargetResistanceByElement,
                [damageElement]: Number(els.damageTargetResistance?.value || 0),
            },
        },
    }
}

function sourceCategoryLabel(sourceCategory) {
    const labels = {
        agent: "角色引发",
        wEngine: "音擎引发",
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
            ].join(" ").toLowerCase()
            return !search || haystack.includes(search)
        })

    els.combatBuffCandidateList.innerHTML = ""
    if (!candidates.length) {
        els.combatBuffModalEmpty.hidden = false
        return
    }

    for (const candidate of candidates) {
        const key = addedCombatBuffKey(candidate)
        const alreadyAdded = addedKeys.has(key)
        const row = document.createElement("button")
        row.type = "button"
        row.className = "combat-candidate-row"
        row.dataset.candidateKey = key
        row.disabled = alreadyAdded

        const title = document.createElement("strong")
        title.textContent = nameOf(candidate)
        const description = document.createElement("p")
        description.textContent = localizedText(candidate.description) || localizedText(candidate.conditionLabel) || ""
        const stats = document.createElement("span")
        stats.className = "combat-added-stats"
        stats.textContent = alreadyAdded ? "已添加" : storedEffectRulesText(candidate) || "-"

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
        runtime: defaultRuntimeForBuff(candidate),
    }])
    return true
}

function renderCustomBuffStatRows(rows = [{ optionIndex: 0, value: 0 }]) {
    els.customBuffStatRows.innerHTML = ""
    const row = rows[0] ?? { optionIndex: 0, value: 0 }
    const item = document.createElement("div")
    item.className = "custom-buff-stat-row"
    item.dataset.index = "0"

    const statField = document.createElement("label")
    statField.className = "field"
    const statLabelEl = document.createElement("span")
    statLabelEl.textContent = "属性"
    const select = document.createElement("select")
    select.dataset.customStatSelect = "0"
    CUSTOM_BUFF_STAT_OPTIONS.forEach((option, optionIndex) => {
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

    item.append(statField, valueField)
    els.customBuffStatRows.appendChild(item)
}

function customBuffRowsFromDom() {
    return [...els.customBuffStatRows.querySelectorAll(".custom-buff-stat-row")].map(row => ({
        optionIndex: Number(row.querySelector("[data-custom-stat-select]")?.value ?? 0),
        value: Number(row.querySelector("[data-custom-stat-value]")?.value ?? 0),
    }))
}

function customBuffStatsFromDom() {
    return customBuffRowsFromDom()
        .map((row, index) => {
            const option = CUSTOM_BUFF_STAT_OPTIONS[row.optionIndex]
            if (!option) {
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

function setMainStatSelected(select, stat, selected) {
    const option = [...select.options].find(item => item.value === stat)
    if (!option) {
        return
    }
    option.selected = selected
    select.dispatchEvent(new Event("change", { bubbles: true }))
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
        twoPieceSetId: els.twoPieceSetSelect.value || null,
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
        agentId: els.agentSelect.value,
        coreSkillLevel: els.coreSkillSelect.value,
        wEngineId: els.wEngineSelect.value,
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
    const stats = (item.resolvedStats?.length ? item.resolvedStats : item.stats ?? [])
        .map(stat => `${statLabel(stat.stat)} +${formatValue(stat.value, stat.stat)}`)
        .join(" / ")
    return `${item.sourceType ?? "Buff"}｜${label}${stats ? `：${stats}` : ""}`
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

function renderDamageWhiteBox(damage) {
    els.damageFinalValue.textContent = damage?.finalDamage === undefined
        ? "-"
        : String(Number(damage.finalDamage.toFixed(3)))
    els.damageWhiteBoxRows.innerHTML = ""
    for (const row of damage?.whiteBoxRows ?? []) {
        const item = document.createElement("div")
        item.className = "damage-whitebox-row"
        item.innerHTML = `
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.displayValue ?? row.value)}</strong>
            <small>${escapeHtml(row.formula ?? "")}</small>
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
    els.optimizerMetrics.textContent = metrics
        ? `评估 ${formatCount(metrics.evaluated)} / 估算 ${formatCount(metrics.estimatedCombinationCount)}`
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
    els.twoPieceSetSelect.innerHTML = `<option value="">不限定</option>`
    for (const set of sets) {
        const option = document.createElement("option")
        option.value = set.id
        option.textContent = nameOf(set)
        els.twoPieceSetSelect.appendChild(option)
    }
}

function restoreHomeState() {
    const selection = loadHomeSelection()
    const agentId = getAgent(selection.currentAgentId)?.id ?? meta.agents[0]?.id
    const config = configForAgent(agentId)
    els.agentSelect.value = agentId
    populateCoreSkillSelect(getAgent(agentId), config.coreSkillLevel)
    els.wEngineSelect.value = getWEngine(config.wEngineId)?.id ?? meta.wEngines[0]?.id
    applyStoredDamageConfig(config.damage)
    renderEntityCards()
    renderCombatControls()
}

async function loadAll() {
    meta = await api("/api/meta")
    store = await api("/api/user-drive-discs")
    populateSelect(els.agentSelect, meta.agents, meta.agents[0]?.id)
    populateSelect(els.wEngineSelect, meta.wEngines, meta.wEngines[0]?.id)
    populateDamageTargetPresets()
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
        els.wEngineSelect.value = getWEngine(config.wEngineId)?.id ?? meta.wEngines[0]?.id
        applyStoredDamageConfig(config.damage)
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
for (const input of [
    els.coreSkillSelect,
    els.wEngineSelect,
]) {
    input.addEventListener("change", async () => {
        try {
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
        if ([els.damageSkillCategory, els.damageSkillMove, els.damageSkillRow, els.damageSkillLevel].includes(event.target)) {
            const preferredRef = readDamageSkillRef() ?? {
                categoryId: els.damageSkillCategory?.value ?? "",
                moveId: els.damageSkillMove?.value ?? "",
                rowId: els.damageSkillRow?.value ?? "",
                level: Number(els.damageSkillLevel?.value || 0),
            }
            populateDamageSkillControls(preferredRef)
        }
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
    if (event.target === els.damageSkillMultiplier) {
        populateDamageSkillControls({ categoryId: "" })
    }
    try {
        saveSyncedConfig()
        invalidateResults()
        setStatus(activeOptimizationJobId ? "计算中" : "需重新计算", "idle")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.combatSection.addEventListener("keydown", async event => {
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
})
els.combatBuffSearchInput.addEventListener("input", renderCombatBuffCandidates)
els.saveCustomBuffBtn.addEventListener("click", async () => {
    try {
        const stats = customBuffStatsFromDom()
        if (!stats.length) {
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
