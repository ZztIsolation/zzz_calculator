import { evaluateFormulaExpression } from "./formulaEvaluator.js"
import {
    damageSkillRowsWithGeneratedTotals,
    defaultSkillLevel as candidateDefaultSkillLevel,
    isCoreSkillLevelScale,
    normalizeSkillLevel,
    skillLevelLabel,
    skillLevelValues,
    skillRowValue,
} from "./skillMultiplierCandidates.js"
import * as SharedCombat from "./shared-combat.js"
import { createImageSelect } from "./entity-select.js"
import { showErrorNotice } from "./feedback.js"
import { initDriveDiscAnalysis } from "./drive-disc-analysis.js"
import { loadCatalog } from "./catalog-loader.js"
import { calculateInCombatPanel } from "./calculator-core.js"
import { loadCurrentUserDriveDiscStore } from "./local-store.js"

const els = {
    status: document.getElementById("status"),
    agentSelect: document.getElementById("agentSelect"),
    coreSkillSelect: document.getElementById("coreSkillSelect"),
    cinemaLevelSelect: document.getElementById("cinemaLevelSelect"),
    agentLevelInput: document.getElementById("agentLevelInput"),
    basicSkillLevelSelect: document.getElementById("basicSkillLevelSelect"),
    dodgeSkillLevelSelect: document.getElementById("dodgeSkillLevelSelect"),
    assistSkillLevelSelect: document.getElementById("assistSkillLevelSelect"),
    specialSkillLevelSelect: document.getElementById("specialSkillLevelSelect"),
    chainSkillLevelSelect: document.getElementById("chainSkillLevelSelect"),
    wEngineSelect: document.getElementById("wEngineSelect"),
    wEngineModificationSelect: document.getElementById("wEngineModificationSelect"),
    driveDiscInput: document.getElementById("driveDiscInput"),
    calculateBtn: document.getElementById("calculateBtn"),
    baseTable: document.getElementById("baseTable"),
    bonusTable: document.getElementById("bonusTable"),
    inCombatPanelTable: document.getElementById("inCombatPanelTable"),
    inCombatBonusTable: document.getElementById("inCombatBonusTable"),
    inCombatActiveEffects: document.getElementById("inCombatActiveEffects"),
    baseAtkBreakdown: document.getElementById("baseAtkBreakdown"),
    outAtkBreakdown: document.getElementById("outAtkBreakdown"),
    inAtkBreakdown: document.getElementById("inAtkBreakdown"),
    rawResult: document.getElementById("rawResult"),
    discGrid: document.getElementById("discGrid"),
    discPicker: document.getElementById("discPicker"),
    manualDiscModeBtn: document.getElementById("manualDiscModeBtn"),
    loadoutDiscModeBtn: document.getElementById("loadoutDiscModeBtn"),
    homeLoadoutSelect: document.getElementById("homeLoadoutSelect"),
    agentMeta: document.getElementById("agentMeta"),
    wEngineMeta: document.getElementById("wEngineMeta"),
    wEngineEffect: document.getElementById("wEngineEffect"),
    agentImage: document.getElementById("agentImage"),
    wEngineImage: document.getElementById("wEngineImage"),
    heroAgentImage: document.getElementById("heroAgentImage"),
    heroAgentName: document.getElementById("heroAgentName"),
    heroWEngineName: document.getElementById("heroWEngineName"),
    heroDiscCount: document.getElementById("heroDiscCount"),
    heroDamageValue: document.getElementById("heroDamageValue"),
    heroDamageSummary: document.getElementById("heroDamageSummary"),
    combatSection: document.getElementById("combat-section"),
    selfCombatBuffs: document.getElementById("selfCombatBuffs"),
    driveDiscCombatBuffs: document.getElementById("driveDiscCombatBuffs"),
    wEngineCombatBuffs: document.getElementById("wEngineCombatBuffs"),
    addedCombatBuffs: document.getElementById("addedCombatBuffs"),
    openCombatBuffModalBtn: document.getElementById("openCombatBuffModalBtn"),
    bossCombatBuffs: document.getElementById("bossCombatBuffs"),
    fieldCombatBuffs: document.getElementById("fieldCombatBuffs"),
    damageTargetPreset: document.getElementById("damageTargetPreset"),
    damageTargetDefense: document.getElementById("damageTargetDefense"),
    damageTargetStunned: document.getElementById("damageTargetStunned"),
    damageTargetStunMultiplier: document.getElementById("damageTargetStunMultiplier"),
    damageTargetResistanceLabel: document.getElementById("damageTargetResistanceLabel"),
    damageTargetResistanceCustom: document.getElementById("damageTargetResistanceCustom"),
    damageTargetResistance: document.getElementById("damageTargetResistance"),
    damageTargetResistanceButtons: Array.from(document.querySelectorAll("[data-resistance-preset]")),
    damageEventType: document.getElementById("damageEventType"),
    damageSkillMultiplier: document.getElementById("damageSkillMultiplier"),
    openDamageSkillModalBtn: document.getElementById("openDamageSkillModalBtn"),
    damageSkillSummary: document.getElementById("damageSkillSummary"),
    damageSkillModal: document.getElementById("damageSkillModal"),
    closeDamageSkillModalBtn: document.getElementById("closeDamageSkillModalBtn"),
    damageSkillSearchInput: document.getElementById("damageSkillSearchInput"),
    damageSkillModalList: document.getElementById("damageSkillModalList"),
    damageSkillModalEmpty: document.getElementById("damageSkillModalEmpty"),
    damageCritMode: document.getElementById("damageCritMode"),
    damageAnomalyEffect: document.getElementById("damageAnomalyEffect"),
    damageAnomalyProcCount: document.getElementById("damageAnomalyProcCount"),
    damageDisorderType: document.getElementById("damageDisorderType"),
    damageDisorderEffect: document.getElementById("damageDisorderEffect"),
    damageDisorderElapsed: document.getElementById("damageDisorderElapsed"),
    damageFinalValue: document.getElementById("damageFinalValue"),
    damageWhiteBoxRows: document.getElementById("damageWhiteBoxRows"),
    combatBuffModal: document.getElementById("combatBuffModal"),
    closeCombatBuffModalBtn: document.getElementById("closeCombatBuffModalBtn"),
    cancelCombatBuffModalBtn: document.getElementById("cancelCombatBuffModalBtn"),
    applyCombatBuffModalBtn: document.getElementById("applyCombatBuffModalBtn"),
    combatBuffModalSummary: document.getElementById("combatBuffModalSummary"),
    combatBuffSearchInput: document.getElementById("combatBuffSearchInput"),
    combatBuffTeammatePicker: document.getElementById("combatBuffTeammatePicker"),
    combatBuffTeammateSelect: document.getElementById("combatBuffTeammateSelect"),
    combatBuffTeammateHint: document.getElementById("combatBuffTeammateHint"),
    addTeammateBuffsBtn: document.getElementById("addTeammateBuffsBtn"),
    removeTeammateBuffsBtn: document.getElementById("removeTeammateBuffsBtn"),
    combatBuffCandidateList: document.getElementById("combatBuffCandidateList"),
    combatBuffCustomPane: document.getElementById("combatBuffCustomPane"),
    combatBuffModalEmpty: document.getElementById("combatBuffModalEmpty"),
    customBuffNameInput: document.getElementById("customBuffNameInput"),
    customBuffStatRows: document.getElementById("customBuffStatRows"),
    saveCustomBuffBtn: document.getElementById("saveCustomBuffBtn"),
    homeDiscModal: document.getElementById("homeDiscModal"),
    closeHomeDiscModalBtn: document.getElementById("closeHomeDiscModalBtn"),
    homeDiscModalTitle: document.getElementById("homeDiscModalTitle"),
    homeDiscModalSubtitle: document.getElementById("homeDiscModalSubtitle"),
    clearSlotDiscBtn: document.getElementById("clearSlotDiscBtn"),
    homeDiscSetFilter: document.getElementById("homeDiscSetFilter"),
    homeDiscMainStatFilter: document.getElementById("homeDiscMainStatFilter"),
    homeDiscSearchInput: document.getElementById("homeDiscSearchInput"),
    homeDiscOptionList: document.getElementById("homeDiscOptionList"),
    homeDiscEmpty: document.getElementById("homeDiscEmpty"),
    driveDiscSubstatAnalysisBtn: document.getElementById("driveDiscSubstatAnalysisBtn"),
    driveDiscStatGainBtn: document.getElementById("driveDiscStatGainBtn"),
}

const FALLBACK_LABELS = {
    hp: "生命值",
    atk: "攻击力",
    def: "防御力",
    hpBase: "基础生命值",
    atkBase: "基础攻击力",
    defBase: "基础防御力",
    hpFlat: "生命值",
    atkFlat: "攻击力",
    defFlat: "防御力",
    hpPct: "生命值",
    atkPct: "攻击力",
    defPct: "防御力",
    hpPctBase: "生命值%（基础）",
    hpPctOutOfCombat: "生命值%（局外）",
    atkPctBase: "攻击力%（基础）",
    atkPctOutOfCombat: "攻击力%（局外）",
    defPctBase: "防御力%（基础）",
    defPctOutOfCombat: "防御力%（局外）",
    critRate: "暴击率",
    critDmg: "暴击伤害",
    impact: "冲击力",
    impactPct: "冲击力",
    impactFlat: "冲击力",
    anomalyProficiency: "异常精通",
    anomalyProficiencyFlat: "异常精通",
    anomalyMastery: "异常掌控",
    anomalyMasteryFlat: "异常掌控",
    penFlat: "穿透值",
    penRatio: "穿透率",
    sheerForce: "贯穿力",
    sheerForceFlat: "固定贯穿力",
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    windResIgnore: "风抗性无视",
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    windDmg: "风属性伤害加成",
    dmgBonus: "通用伤害加成",
    enemyDefReduction: "敌方减防率",
    enemyDefIgnore: "无视防御率",
    enemyDefFlatReduction: "敌方固定减防",
    enemyResReduction: "敌方当前属性减抗",
    enemyPhysicalResReduction: "敌方物理减抗",
    enemyFireResReduction: "敌方火减抗",
    enemyIceResReduction: "敌方冰减抗",
    enemyElectricResReduction: "敌方电减抗",
    enemyEtherResReduction: "敌方以太减抗",
    enemyWindResReduction: "敌方风减抗",
    anomalyDamageBonus: "属性异常增伤",
    disorderDamageBonus: "紊乱增伤",
    disorderBaseMultiplierBonus: "紊乱倍率加算",
    sheerDmgBonus: "贯穿增伤",
    physicalSheerDmg: "物理贯穿增伤",
    fireSheerDmg: "火贯穿增伤",
    iceSheerDmg: "冰贯穿增伤",
    electricSheerDmg: "电贯穿增伤",
    etherSheerDmg: "以太贯穿增伤",
    windSheerDmg: "风贯穿增伤",
}

const ENUM_LABELS = {
    attribute: {
        physical: "物理属性",
        honed_edge: "凛刃",
        frost: "烈霜",
        xuanmo: "玄墨",
        fire: "火属性",
        ice: "冰属性",
        electric: "电属性",
        ether: "以太属性",
        wind: "风属性",
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
        yunkui_summit: "云岿山",
    },
}

const PERCENT_KEYS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "hpPctBase",
    "hpPctOutOfCombat",
    "atkPctBase",
    "atkPctOutOfCombat",
    "defPctBase",
    "defPctOutOfCombat",
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
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "disorderBaseMultiplierBonus",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
])

const PERCENT_MODE_KEY = {
    hp: "hpPct",
    atk: "atkPct",
    def: "defPct",
    impact: "impactPct",
    energyRegen: "energyRegenPct",
}

const STORED_PERCENT_STATS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
    "impact",
    "impactPct",
    "anomalyMastery",
    "energyRegen",
    "energyRegenPct",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyDefIgnore",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
    "enemyWindResReduction",
    "anomalyDamageBonus",
    "disorderDamageBonus",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "disorderBaseMultiplierBonus",
])

const STORED_STAT_LABELS = {
    hpPct: "百分比生命值%",
    atkPct: "百分比攻击力%",
    defPct: "百分比防御力%",
    critRate: "暴击率%",
    critDmg: "暴击伤害%",
    impact: "冲击力%",
    impactPct: "百分比冲击力%",
    anomalyMastery: "异常掌控%",
    energyRegen: "能量自动回复%",
    energyRegenPct: "百分比能量自动回复%",
    penRatio: "穿透率%",
    physicalResIgnore: "物理抗性无视%",
    fireResIgnore: "火抗性无视%",
    iceResIgnore: "冰抗性无视%",
    electricResIgnore: "电抗性无视%",
    etherResIgnore: "以太抗性无视%",
    windResIgnore: "风抗性无视%",
    physicalDmg: "物理伤害加成%",
    fireDmg: "火属性伤害加成%",
    iceDmg: "冰属性伤害加成%",
    electricDmg: "电属性伤害加成%",
    etherDmg: "以太伤害加成%",
    windDmg: "风属性伤害加成%",
    dmgBonus: "通用伤害加成%",
    enemyDefReduction: "敌方减防率%",
    enemyDefIgnore: "无视防御率%",
    enemyResReduction: "敌方当前属性减抗%",
    enemyPhysicalResReduction: "敌方物理减抗%",
    enemyFireResReduction: "敌方火减抗%",
    enemyIceResReduction: "敌方冰减抗%",
    enemyElectricResReduction: "敌方电减抗%",
    enemyEtherResReduction: "敌方以太减抗%",
    enemyWindResReduction: "敌方风减抗%",
    anomalyDamageBonus: "属性异常增伤%",
    disorderDamageBonus: "紊乱增伤%",
    disorderBaseMultiplierBonus: "紊乱倍率加算%",
    sheerDmgBonus: "贯穿增伤%",
    physicalSheerDmg: "物理贯穿增伤%",
    fireSheerDmg: "火贯穿增伤%",
    iceSheerDmg: "冰贯穿增伤%",
    electricSheerDmg: "电贯穿增伤%",
    etherSheerDmg: "以太贯穿增伤%",
    windSheerDmg: "风贯穿增伤%",
}

const BASE_ORDER = ["hp", "atk", "def"]
const BONUS_ORDER = [
    "hpFlat",
    "hpPct",
    "atkFlat",
    "atkPct",
    "defFlat",
    "defPct",
    "critRate",
    "critDmg",
    "impactPct",
    "anomalyProficiencyFlat",
    "anomalyMasteryFlat",
    "energyRegenPct",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
]
const COMBAT_BONUS_ORDER = [
    "hpFlat",
    "hpPct",
    "hpPctBase",
    "hpPctOutOfCombat",
    "atkFlat",
    "atkPct",
    "atkPctBase",
    "atkPctOutOfCombat",
    "defFlat",
    "defPct",
    "defPctBase",
    "defPctOutOfCombat",
    "critRate",
    "critDmg",
    "impactPct",
    "impactFlat",
    "anomalyProficiencyFlat",
    "anomalyMasteryFlat",
    "energyRegenPct",
    "penFlat",
    "penRatio",
    "physicalResIgnore",
    "fireResIgnore",
    "iceResIgnore",
    "electricResIgnore",
    "etherResIgnore",
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
]
const PANEL_ORDER = [
    "hp",
    "atk",
    "sheerForce",
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
    "windResIgnore",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
    "dmgBonus",
]
const ELEMENT_DMG_KEYS = new Set(["physicalDmg", "fireDmg", "iceDmg", "electricDmg", "etherDmg", "windDmg"])
const OUT_OF_COMBAT_PANEL_BASE_ORDER = PANEL_ORDER.filter(key => key !== "dmgBonus")
const DEFAULT_CHECKED_COMBAT_SOURCE_TYPES = new Set(["self", "driveDisc4pc", "driveDisc4pcTeam", "wEngine", "wEngineTeam"])
const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
const DISC_SELECTION_STORAGE_KEY = "zzz-calculator.driveDiscSelections.v1"
const HOME_DISC_MODES = new Set(["manual", "loadout"])
const TEAMMATE_DRIVE_DISC_LIMIT = 2
const W_ENGINE_TEAM_BUFF_LIMIT = 2
const DRIVE_DISC_TEAM_BUFF_LIMIT = 2
const DEFAULT_DAMAGE_TARGET_PRESETS = [
    { id: "wandering-hunter", name: { zhCN: "彷徨猎手" }, defense: 1588 },
    { id: "taichu-nightmare", name: { zhCN: "低防怪如太初梦魇" }, defense: 476 },
    { id: "normal-boss", name: { zhCN: "正常boss" }, defense: 953 },
]
const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
const DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT = 150
const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
    wind: "风",
}
const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
    wind: "windResIgnore",
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
    anomalyDamageBonus: "属性异常增伤",
    disorderDamageBonus: "紊乱增伤",
    baseMultiplierBonus: "伤害倍率修正",
    disorderBaseMultiplierBonus: "紊乱倍率加算",
    anomalyCritRate: "异常暴击率",
    anomalyCritDmg: "异常暴击伤害",
    stunDmgMultiplierBonus: "失衡易伤倍率加算",
    stunDmgMultiplierBonusAlways: "失衡易伤倍率加算（未失衡生效）",
    directDamageBonus: "技能专属伤害增伤",
    sheerDmgBonus: "贯穿增伤",
    physicalSheerDmg: "物理贯穿增伤",
    fireSheerDmg: "火贯穿增伤",
    iceSheerDmg: "冰贯穿增伤",
    electricSheerDmg: "电贯穿增伤",
    etherSheerDmg: "以太贯穿增伤",
    windSheerDmg: "风贯穿增伤",
    skillMultiplierBonus: "技能倍率加算",
}
const DEFAULT_ANOMALY_PROC_COUNTS = {
    assault: 1,
    shatter: 1,
    burn: 20,
    shock: 10,
    corruption: 20,
}

function normalizeDisorderType(value) {
    return value === "polarized" ? "polarized" : "normal"
}

const SKILL_CATEGORY_ORDER = [
    ["basic", "普通攻击", "basicSkillLevelSelect"],
    ["dodge", "闪避", "dodgeSkillLevelSelect"],
    ["assist", "支援技", "assistSkillLevelSelect"],
    ["special", "特殊技", "specialSkillLevelSelect"],
    ["chain", "连携技", "chainSkillLevelSelect"],
]
const RESISTANCE_PRESET_VALUES = new Set(["-20", "0", "20"])
const CUSTOM_RESISTANCE_MAX = 100
const CUSTOM_BUFF_STAT_OPTIONS = SharedCombat.CUSTOM_BUFF_STAT_OPTIONS
const CUSTOM_BUFF_SKILL_STAT_OPTIONS = SharedCombat.CUSTOM_BUFF_SKILL_STAT_OPTIONS

let meta = null
let userDriveDiscStore = null
let activeDiscSlot = null
let activeCombatBuffTab = "agent"
let activeCombatBuffTeammateId = ""
let renderedCombatBuffAgentId = ""
let combatBuffDraftAddedBuffs = null
const manuallyUncheckedDefaultCombatBuffIds = new Set()
const damageTargetResistanceByElement = Object.fromEntries(DAMAGE_ELEMENTS.map(element => [element, 0]))
let activeDamageResistanceElement = "physical"
let selectedDamageSkillRef = null
let activeDamageSkillPickerMoveRef = null
let damageSkillSearchQuery = ""
let damageSkillLevelsByCategory = {}
const CALCULATE_DEBOUNCE_MS = 250
let calculateDebounceTimer = null
const combatUi = SharedCombat.createCombatUiController({
    getMeta: () => meta,
    includeDriveDiscBuffs: true,
})

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error)
}

function damageEventTypeLabel(type) {
    if (type === "sheer") {
        return "贯穿"
    }
    if (type === "anomaly") {
        return "异常"
    }
    if (type === "disorder") {
        return "紊乱"
    }
    return "直伤"
}

function statLabel(key) {
    return combatUi.statLabel(key)
}

function storedStatLabel(key, mode = "") {
    return combatUi.storedStatLabel(key, mode)
}

function enumLabel(type, value) {
    return SharedCombat.enumLabel(type, value)
}

function rarityLabel(value) {
    return SharedCombat.rarityLabel(value)
}

function coreSkillDefaultLevel(agent) {
    return SharedCombat.coreSkillDefaultLevel(agent)
}

function coreSkillLevelLabel(agent, level) {
    return SharedCombat.coreSkillLevelLabel(agent, level)
}

function populateCoreSkillSelect(agent, preferredLevel) {
    const levels = agent?.coreSkill?.levels ?? []
    const validLevels = new Set(["none", ...levels.map(item => item.level)])
    const selectedLevel = validLevels.has(preferredLevel)
        ? preferredLevel
        : coreSkillDefaultLevel(agent)

    els.coreSkillSelect.innerHTML = ""
    const noneOption = document.createElement("option")
    noneOption.value = "none"
    noneOption.textContent = levels.length ? "未强化" : "未建模"
    noneOption.selected = selectedLevel === "none"
    els.coreSkillSelect.appendChild(noneOption)

    for (const level of levels) {
        const option = document.createElement("option")
        option.value = level.level
        option.textContent = level.label ?? `强化${level.level}`
        option.selected = level.level === selectedLevel
        els.coreSkillSelect.appendChild(option)
    }

    els.coreSkillSelect.disabled = levels.length === 0
    return selectedLevel
}

function coreSkillSummary(agent, selectedLevel) {
    return combatUi.coreSkillSummary(agent, selectedLevel)
}

function agentAttributeText(agent) {
    return SharedCombat.agentAttributeText(agent)
}

function damageElementForAgent(agent = {}) {
    return SharedCombat.damageElementForAgent(agent)
}

function currentDamageElement() {
    return damageElementForAgent(getAgent(els.agentSelect.value))
}

function targetStunnedFromConfig(target = {}) {
    if (Object.prototype.hasOwnProperty.call(target, "stunned")) {
        return target.stunned === true || target.stunned === "true" || target.stunned === 1 || target.stunned === "1"
    }
    const activeMultiplier = Number(target.activeStunMultiplier)
    return Number.isFinite(activeMultiplier) ? activeMultiplier !== 1 : false
}

function stunMultiplierPercentFromConfig(target = {}) {
    const percent = Number(target.stunMultiplierPercent)
    if (Number.isFinite(percent)) {
        return Math.max(0, percent)
    }
    const multiplier = Number(target.stunMultiplier)
    if (Number.isFinite(multiplier)) {
        return Math.max(0, multiplier) * 100
    }
    return DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT
}

function damageElementShortLabel(element) {
    return SharedCombat.damageElementShortLabel(element)
}

function formatValue(value, key = "") {
    return SharedCombat.formatValue(value, key)
}

function formatContextStatValue(stat, value, context = {}) {
    return SharedCombat.formatContextStatValue(stat, value, context)
}

function formatStoredStatValue(stat, value, context = {}) {
    return SharedCombat.formatStoredStatValue(stat, value, context)
}

function damageTargetPresets() {
    return meta?.damageTargetPresets?.length
        ? meta.damageTargetPresets
        : DEFAULT_DAMAGE_TARGET_PRESETS
}

function damageTargetPresetById(id) {
    return damageTargetPresets().find(item => item.id === id)
        ?? damageTargetPresets().find(item => item.id === DEFAULT_DAMAGE_TARGET_PRESET_ID)
        ?? damageTargetPresets()[0]
}

function resolveDamageTargetPresetId(target = {}) {
    if (target.presetId) {
        return target.presetId
    }
    const defense = Number(target.defense)
    const matched = damageTargetPresets().find(preset => Number(preset.defense) === defense)
    return matched?.id ?? DEFAULT_DAMAGE_TARGET_PRESET_ID
}

function populateDamageTargetPresets() {
    if (!els.damageTargetPreset) {
        return
    }

    els.damageTargetPreset.innerHTML = ""
    for (const preset of damageTargetPresets()) {
        const option = document.createElement("option")
        option.value = preset.id
        option.textContent = `${preset.defense}（${nameOf(preset)}）`
        option.selected = preset.id === DEFAULT_DAMAGE_TARGET_PRESET_ID
        els.damageTargetPreset.appendChild(option)
    }

    const custom = document.createElement("option")
    custom.value = "custom"
    custom.textContent = "自定义"
    els.damageTargetPreset.appendChild(custom)

    const preset = damageTargetPresetById(els.damageTargetPreset.value)
    els.damageTargetDefense.value = preset?.defense ?? 953
    syncDamageTargetDefenseVisibility()
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
        { id: "burn", label: { zhCN: "灼烧" }, defaultDurationSeconds: 10 },
        { id: "shock", label: { zhCN: "感电" }, defaultDurationSeconds: 10 },
        { id: "corruption", label: { zhCN: "侵蚀" }, defaultDurationSeconds: 10 },
        { id: "frozen", label: { zhCN: "霜寒" }, defaultDurationSeconds: 10 },
        { id: "frost_frozen", label: { zhCN: "烈霜霜寒紊乱（星见雅）" }, defaultDurationSeconds: 20 },
        { id: "flinch", label: { zhCN: "畏缩" }, defaultDurationSeconds: 10 },
    ]
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

function renderDamageEventControls() {
    const type = els.damageEventType?.value || "direct"
    const usesSkillControls = type === "direct" || type === "sheer"
    document.querySelectorAll(".damage-direct-field").forEach(item => { item.hidden = !usesSkillControls })
    document.querySelectorAll(".damage-anomaly-field").forEach(item => { item.hidden = type !== "anomaly" })
    document.querySelectorAll(".damage-disorder-field").forEach(item => { item.hidden = type !== "disorder" })
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
    return candidateDefaultSkillLevel(category)
}

function clampSkillLevel(category = {}, level) {
    return normalizeSkillLevel(category, {}, {}, level)
}

function selectedSkillLevel(category = {}) {
    if (isCoreSkillLevelScale(category)) {
        return normalizeSkillLevel(category, {}, {}, els.coreSkillSelect?.value ?? coreSkillDefaultLevel(getAgent()))
    }
    return clampSkillLevel(category, damageSkillLevelsByCategory[category.id] ?? defaultSkillLevel(category))
}

function skillLevelSelects() {
    return SKILL_CATEGORY_ORDER
        .map(([categoryId, , elementKey]) => ({ categoryId, select: els[elementKey] }))
        .filter(item => item.select)
}

function normalizeSkillLevelsByCategory(skill = agentSkillCatalog(), stored = {}) {
    const next = {}
    for (const category of damageSkillCategories(skill)) {
        next[category.id] = isCoreSkillLevelScale(category)
            ? selectedSkillLevel(category)
            : clampSkillLevel(category, stored?.[category.id] ?? defaultSkillLevel(category))
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
    if (!damageSkillCategories(agentSkillCatalog()).length) {
        selectedDamageSkillRef = null
        if (els.damageSkillSummary) {
            els.damageSkillSummary.textContent = "当前角色暂无技能倍率资料，可手填倍率"
        }
        return
    }
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
        els.damageSkillSummary.textContent = `${nameOf(resolved.category)} / ${nameOf(resolved.move)} / ${localizedText(resolved.row.label) || resolved.row.id} · ${skillLevelLabel(resolved.category, resolved.level)} · ${Number.isFinite(resolved.value) ? `${resolved.value}%` : "-"}`
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
        const selected = selectedSkillLevel(category)
        for (const level of skillLevelValues(category)) {
            const option = document.createElement("option")
            option.value = String(level)
            option.textContent = skillLevelLabel(category, level)
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
    const allCategories = damageSkillCategories(agentSkillCatalog())
    const query = damageSkillSearchQuery.trim().toLowerCase()
    const categories = query
        ? allCategories.map(category => ({
            ...category,
            moves: (category.moves ?? []).filter(move => {
                const level = selectedSkillLevel(category)
                const rowText = (move.rows ?? []).map(row => {
                    const value = skillRowValue(category, move, row, level)
                    return `${localizedText(row.label) || row.id} ${Number.isFinite(value) ? value : ""}`
                }).join(" ")
                return `${nameOf(category)} ${nameOf(move)} ${rowText}`.toLowerCase().includes(query)
            }),
        })).filter(category => (category.moves ?? []).length)
        : allCategories
    if (els.damageSkillSearchInput && els.damageSkillSearchInput.value !== damageSkillSearchQuery) {
        els.damageSkillSearchInput.value = damageSkillSearchQuery
    }
    els.damageSkillModalList.innerHTML = ""
    els.damageSkillModalEmpty.hidden = categories.length > 0
    if (!categories.length) {
        activeDamageSkillPickerMoveRef = null
        if (els.damageSkillModalEmpty) {
            const emptyText = els.damageSkillModalEmpty.querySelector("span")
            if (emptyText) {
                emptyText.textContent = query ? "没有匹配的技能倍率" : "当前角色暂无可选择的技能倍率"
            }
        }
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
        group.innerHTML = `<h3>${escapeHtml(nameOf(category))}<span>${escapeHtml(skillLevelLabel(category, level))}</span></h3>`
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
                <span>${escapeHtml(nameOf(active.category))} · ${escapeHtml(skillLevelLabel(active.category, level))}</span>
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
}

function syncDamageDefenseToPreset() {
    const preset = damageTargetPresetById(els.damageTargetPreset.value)
    if (preset && els.damageTargetPreset.value !== "custom") {
        els.damageTargetDefense.value = preset.defense
    }
    syncDamageTargetDefenseVisibility()
}

function syncDamageTargetDefenseVisibility() {
    const visible = els.damageTargetPreset?.value === "custom"
    els.damageTargetDefense?.closest(".target-defense-field")?.toggleAttribute("hidden", !visible)
}

function selectedDamageTargetDefense() {
    const presetId = els.damageTargetPreset?.value || DEFAULT_DAMAGE_TARGET_PRESET_ID
    const preset = presetId === "custom" ? null : damageTargetPresetById(presetId)
    return preset ? Number(preset.defense) : Number(els.damageTargetDefense?.value ?? 953)
}

function clampCustomResistanceValue(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return 0
    }
    return Math.min(CUSTOM_RESISTANCE_MAX, Math.max(-CUSTOM_RESISTANCE_MAX, numeric))
}

function setDamageResistanceControlValue(value = 0) {
    if (!els.damageTargetResistance) {
        return
    }
    const clamped = clampCustomResistanceValue(value)
    els.damageTargetResistance.value = String(Number(clamped.toFixed(3)))
}

function damageResistanceControlValue() {
    if (!els.damageTargetResistance) {
        return 0
    }
    const value = clampCustomResistanceValue(els.damageTargetResistance.value)
    if (Number(els.damageTargetResistance.value) !== value) {
        els.damageTargetResistance.value = String(Number(value.toFixed(3)))
    }
    return value
}

function setDamageResistanceCustomHidden(hidden) {
    if (els.damageTargetResistanceCustom) {
        els.damageTargetResistanceCustom.hidden = hidden
        return
    }
    if (els.damageTargetResistance) {
        els.damageTargetResistance.hidden = hidden
    }
}

function persistCurrentDamageResistanceInput() {
    if (!els.damageTargetResistance) {
        return
    }

    const value = damageResistanceControlValue()
    if (Number.isFinite(value)) {
        damageTargetResistanceByElement[activeDamageResistanceElement] = value
    }
}

function syncDamageResistancePresetFromValue({ forceCustom = false } = {}) {
    if (!els.damageTargetResistance || !els.damageTargetResistanceButtons?.length) {
        return
    }

    const value = damageResistanceControlValue()
    const normalized = Number.isFinite(value) ? String(Number(value.toFixed(3))) : "custom"
    const preset = !forceCustom && RESISTANCE_PRESET_VALUES.has(normalized)
        ? normalized
        : "custom"
    for (const button of els.damageTargetResistanceButtons) {
        const active = button.dataset.resistancePreset === preset
        button.classList.toggle("active", active)
        button.setAttribute("aria-pressed", String(active))
    }
    setDamageResistanceCustomHidden(preset !== "custom")
}

function syncDamageResistanceToPreset(value) {
    if (!els.damageTargetResistance) {
        return
    }

    if (value !== "custom") {
        setDamageResistanceControlValue(value)
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue()
        return
    }

    const currentValue = damageResistanceControlValue()
    const normalized = Number.isFinite(currentValue) ? String(Number(currentValue.toFixed(3))) : "custom"
    if (!Number.isFinite(currentValue) || RESISTANCE_PRESET_VALUES.has(normalized)) {
        setDamageResistanceControlValue(0)
    } else {
        setDamageResistanceControlValue(currentValue)
    }
    persistCurrentDamageResistanceInput()
    syncDamageResistancePresetFromValue({ forceCustom: true })
    els.damageTargetResistance.focus()
}

function syncDamageResistanceControlsToAgent() {
    if (!els.damageTargetResistance || !els.damageTargetResistanceLabel) {
        return
    }

    const nextElement = currentDamageElement()
    const elementChanged = nextElement !== activeDamageResistanceElement
    if (elementChanged) {
        activeDamageResistanceElement = nextElement
        setDamageResistanceControlValue(damageTargetResistanceByElement[nextElement] ?? 0)
    }

    els.damageTargetResistanceLabel.textContent = `Boss ${damageElementShortLabel(nextElement)}抗性`
    syncDamageResistancePresetFromValue()
}

function applyStoredDamageConfig(config = {}) {
    if (!els.damageTargetPreset || !config || typeof config !== "object") {
        return
    }

    const target = config.target ?? {}
    const damageElement = currentDamageElement()
    const selectedEvent = (config.events ?? []).find(event => event.id === config.selectedEventId)
        ?? (config.events ?? [])[0]
        ?? { kind: "direct" }
    if (els.agentLevelInput) {
        els.agentLevelInput.value = config.agentLevel ?? 60
    }
    els.damageTargetPreset.value = resolveDamageTargetPresetId(target)
    els.damageTargetDefense.value = target.defense ?? damageTargetPresetById(els.damageTargetPreset.value)?.defense ?? 953
    syncDamageTargetDefenseVisibility()
    if (els.damageTargetStunned) {
        els.damageTargetStunned.checked = targetStunnedFromConfig(target)
    }
    if (els.damageTargetStunMultiplier) {
        els.damageTargetStunMultiplier.value = stunMultiplierPercentFromConfig(target)
    }
    if (els.damageEventType) {
        els.damageEventType.value = ["direct", "anomaly", "disorder", "sheer"].includes(selectedEvent.kind) ? selectedEvent.kind : "direct"
    }
    els.damageSkillMultiplier.value = selectedEvent.skillMultiplier ?? config.skillMultiplier ?? 100
    els.damageCritMode.value = selectedEvent.critMode ?? config.critMode ?? "expected"
    if (els.damageAnomalyEffect) {
        els.damageAnomalyEffect.value = selectedEvent.anomalyEffect ?? "assault"
        const defaultProcCount = els.damageAnomalyEffect.selectedOptions?.[0]?.dataset.defaultProcCount
        els.damageAnomalyProcCount.value = selectedEvent.procCount ?? defaultProcCount ?? 1
    }
    if (els.damageDisorderEffect) {
        if (els.damageDisorderType) {
            els.damageDisorderType.value = normalizeDisorderType(selectedEvent.disorderType)
        }
        els.damageDisorderEffect.value = selectedEvent.previousAnomalyEffect ?? selectedEvent.anomalyEffect ?? "burn"
        els.damageDisorderElapsed.value = selectedEvent.elapsedSeconds ?? 0
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
    renderDamageEventControls()

    if (target.resistanceByElement && typeof target.resistanceByElement === "object") {
        for (const [element, value] of Object.entries(target.resistanceByElement)) {
            if (DAMAGE_ELEMENTS.includes(element) && Number.isFinite(Number(value))) {
                damageTargetResistanceByElement[element] = Number(value)
            }
        }
    }
    if (Number.isFinite(Number(target.resistance))) {
        damageTargetResistanceByElement[damageElement] = Number(target.resistance)
    }
    activeDamageResistanceElement = damageElement
    setDamageResistanceControlValue(damageTargetResistanceByElement[damageElement] ?? 0)
    syncDamageResistancePresetFromValue()
}

function basisLabel(basis) {
    const labels = {
        baseHp: "基础生命值",
        outOfCombatHp: "局外生命值",
        baseAtk: "基础攻击力",
        outOfCombatAtk: "局外攻击力",
        baseDef: "基础防御力",
        outOfCombatDef: "局外防御力",
    }
    return labels[basis] ?? basis
}

function effectLabel(key) {
    if (key?.startsWith("wEngine:")) {
        const [wEngineId, part] = key.slice("wEngine:".length).split(".")
        const wEngine = getWEngine(wEngineId)
        const labels = {
            passive: "被动",
            self: "限佩戴者",
            team: "团队",
        }
        return labels[part] ? `${nameOf(wEngine)} ${labels[part]}` : key
    }

    if (key?.startsWith("driveDisc4pc:")) {
        const [setId, part = "self"] = key.slice("driveDisc4pc:".length).split(".")
        const suffix = part === "team" ? "团队" : "限佩戴者"
        return `${nameOf(getDriveDiscSet(setId))} 4件套（${suffix}）`
    }

    if (key?.startsWith("teammateDriveDisc4pc:")) {
        const [, teammateIndex, setId] = key.split(":")
        return `队友${teammateIndex} ${nameOf(getDriveDiscSet(setId))} 4件套`
    }

    if (key?.startsWith("manual:")) {
        return "自定义 Buff"
    }

    if (key?.startsWith("agent:")) {
        const [agentId, part] = key.slice("agent:".length).split(".")
        const labels = {
            corePassive: "核心被动",
            additionalAbility: "额外能力",
        }
        return `${nameOf(getAgent(agentId))} ${labels[part] ?? part ?? ""}`.trim()
    }

    const [id, part, detail] = key.split(".")
    if (part === "coreSkill") {
        const agent = getAgent(id)
        return `${nameOf(agent)} 核心技${detail ?? ""}`
    }

    const set = getDriveDiscSet(id)
    if (set) {
        const piece = part === "twoPiece" ? "2件套" : part === "fourPiece" ? "4件套" : part
        return `${nameOf(set)} ${piece}`
    }

    const wEngine = getWEngine(id)
    if (wEngine && part === "passive") {
        return `${nameOf(wEngine)} 被动`
    }

    return key
}

function effectStatText(stats = []) {
    return stats
        .map(item => {
            const basisText = item.basis ? `（基于${basisLabel(item.basis)}）` : ""
            return `${statLabel(item.stat)} +${formatContextStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}${basisText}`
        })
        .join("，")
}

function storedEffectStatText(stats = []) {
    return stats
        .map(item => {
            const basisText = item.basis ? `（基于${basisLabel(item.basis)}）` : ""
            return `${storedStatLabel(item.stat, item.mode)} +${formatStoredStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}${basisText}`
        })
        .join("，")
}

function nameOf(item) {
    return combatUi.nameOf(item)
}

function combatBuffDisplayName(buff) {
    return SharedCombat.combatBuffDisplayName(buff)
}

function localizedText(value) {
    return combatUi.localizedText(value)
}

function displayAgents() {
    return meta?.displayAgents ?? meta?.agents ?? []
}

function displayWEngines() {
    return meta?.displayWEngines ?? meta?.wEngines ?? []
}

function displayDriveDiscSets() {
    return meta?.displayDriveDiscSets ?? meta?.driveDiscSets ?? []
}

function displayCombatBuffs() {
    return meta?.displayCombatBuffs ?? (meta?.combatBuffs ?? []).filter(item => item?.hidden !== true)
}

function displayTeammateCombatBuffGroups() {
    return meta?.displayTeammateCombatBuffGroups ?? (meta?.teammateCombatBuffGroups ?? [])
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function imageOf(item, type) {
    if (!item) {
        return ""
    }

    if (type === "agent") {
        return item.images?.portrait ?? item.images?.icon ?? ""
    }

    return item.images?.icon ?? item.images?.portrait ?? ""
}

function fallbackImageSvg(item, type) {
    const label = nameOf(item)
    const shortLabel = label.length > 8 ? `${label.slice(0, 8)}...` : label
    const isAgent = type === "agent"
    const title = isAgent ? "AGENT" : "W-ENGINE"
    const accent = item?.rarity === "S" ? "#f6c945" : item?.rarity === "A" ? "#74d6ff" : "#aeb8c6"
    const icon = isAgent
        ? `<path d="M128 56c30 0 48 21 48 51 0 18-8 36-21 46 31 8 52 32 57 69H44c5-37 26-61 57-69-13-10-21-28-21-46 0-30 18-51 48-51Z" fill="${accent}" opacity=".92"/><path d="M76 94h104" stroke="#101318" stroke-width="10" stroke-linecap="round" opacity=".28"/>`
        : `<circle cx="128" cy="122" r="64" fill="${accent}" opacity=".92"/><circle cx="128" cy="122" r="37" fill="#101318" opacity=".18"/><path d="M83 167 173 77M94 84l78 76" stroke="#101318" stroke-width="12" stroke-linecap="round" opacity=".28"/>`
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${label}">
            <rect width="256" height="256" rx="24" fill="#10141b"/>
            <path d="M20 24h216v208H20z" fill="#f8fafc" opacity=".06"/>
            <path d="M0 44h256v12H0zm0 156h256v12H0z" fill="${accent}" opacity=".95"/>
            ${icon}
            <text x="128" y="218" text-anchor="middle" fill="#f4f7fb" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800">${shortLabel}</text>
            <text x="128" y="238" text-anchor="middle" fill="#aeb8c6" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700">${title}</text>
        </svg>
    `
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function setEntityImage(img, item, type) {
    if (!img) {
        return
    }

    const fallback = fallbackImageSvg(item, type)
    img.alt = item ? `${nameOf(item)}${type === "agent" ? "角色图片" : "音擎图片"}` : ""
    img.dataset.fallbackSrc = fallback
    img.src = imageOf(item, type) || fallback
}

function getAgent(id) {
    return displayAgents().find(item => item.id === id)
}

function getWEngine(id) {
    return displayWEngines().find(item => item.id === id)
}

function getDriveDiscSet(id) {
    return meta?.driveDiscSets.find(item => item.id === id)
}

function getDriveDiscSetByName(setName) {
    return meta?.driveDiscSets.find(item =>
        item.name?.zhCN === setName || item.name?.en === setName || item.id === setName
    )
}

function driveDiscSetForDisc(disc) {
    return getDriveDiscSet(disc?.setId) ?? getDriveDiscSetByName(disc?.setName)
}

function driveDiscIcon(set) {
    return set?.images?.icon ?? "/assets/drive-discs/empty.svg"
}

function discDisplaySetName(disc) {
    return disc?.setName || nameOf(driveDiscSetForDisc(disc))
}

function toCalculatorDriveDisc(disc) {
    return {
        id: disc.id,
        setId: disc.setId,
        setName: disc.setName,
        partition: disc.partition,
        rarity: disc.rarity,
        level: disc.level,
        maxLevel: disc.maxLevel,
        mainStat: {
            stat: disc.mainStat?.stat,
            value: disc.mainStat?.value,
            mode: disc.mainStat?.mode,
        },
        subStats: (disc.subStats ?? []).map(item => ({
            stat: item.stat,
            value: item.value,
            mode: item.mode,
        })),
    }
}

function driveDiscById(id) {
    return (userDriveDiscStore?.driveDiscs ?? []).find(disc => disc.id === id) ?? null
}

function equippedDriveDiscIdsForAgent(agentId) {
    const discs = userDriveDiscStore?.driveDiscs ?? []
    const byPartition = new Map()

    for (const disc of discs) {
        if (disc.equippedBy !== agentId || !disc.partition) {
            continue
        }

        if (!byPartition.has(disc.partition)) {
            byPartition.set(String(disc.partition), disc.id)
        }
    }

    return Object.fromEntries(byPartition)
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

function legacyDiscSelectionsForAgent(agentId) {
    const selections = readJsonStorage(DISC_SELECTION_STORAGE_KEY, {})
    return selections?.[agentId] && typeof selections[agentId] === "object"
        ? selections[agentId]
        : null
}

function validAgentId(agentId) {
    return getAgent(agentId)?.id ?? displayAgents()[0]?.id ?? ""
}

function validWEngineId(wEngineId) {
    return getWEngine(wEngineId)?.id ?? displayWEngines()[0]?.id ?? ""
}

function defaultWEngineIdForAgent(agentId, savedWEngineId = "") {
    return SharedCombat.defaultWEngineIdForAgent(displayWEngines(), agentId, savedWEngineId)
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

function isValidCoreSkillLevel(agent, level) {
    return level === "none" || Boolean(agent?.coreSkill?.levels?.some(item => item.level === level))
}

function validCoreSkillLevel(agent, level) {
    return isValidCoreSkillLevel(agent, level) ? level : coreSkillDefaultLevel(agent)
}

function sanitizeDiscIdsBySlot(selectedIdsBySlot = {}) {
    return Object.fromEntries(
        Object.entries(selectedIdsBySlot || {})
            .filter(([slot, id]) => {
                const disc = driveDiscById(id)
                return disc && Number(disc.partition) === Number(slot)
            })
    )
}

function configForAgent(agentId) {
    return combatUi.configForAgent(agentId)
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

function sanitizeAddedCombatBuffs(addedBuffs = []) {
    return combatUi.sanitizeAddedCombatBuffs(addedBuffs)
}

function combatConfigForAgent(agentId) {
    return combatUi.combatConfigForAgent(agentId)
}

function normalizeHomeDiscMode(mode) {
    return HOME_DISC_MODES.has(mode) ? mode : "manual"
}

function currentHomeDiscMode() {
    return els.loadoutDiscModeBtn?.classList.contains("active") ? "loadout" : "manual"
}

function selectedDiscModeForAgent(agentId) {
    return normalizeHomeDiscMode(configForAgent(agentId).driveDiscMode)
}

function manualDiscIdsFromSavedConfig(agentId) {
    const config = configForAgent(agentId)
    if (config && Object.prototype.hasOwnProperty.call(config, "manualDriveDiscIdsBySlot")) {
        return sanitizeDiscIdsBySlot(config.manualDriveDiscIdsBySlot)
    }

    if (config && Object.prototype.hasOwnProperty.call(config, "driveDiscIdsBySlot")) {
        return sanitizeDiscIdsBySlot(config.driveDiscIdsBySlot)
    }

    const legacy = sanitizeDiscIdsBySlot(legacyDiscSelectionsForAgent(agentId))
    if (Object.keys(legacy).length > 0) {
        return legacy
    }

    return equippedDriveDiscIdsForAgent(agentId)
}

function completeLoadoutForAgent(agentId, preferredLoadoutId = configForAgent(agentId).selectedLoadoutId ?? "") {
    const loadouts = driveDiscLoadoutsForAgent(agentId)
    return loadouts.find(loadout => loadout.id === preferredLoadoutId && loadoutIsComplete(loadout))
        ?? loadouts.find(loadoutIsComplete)
        ?? null
}

function loadoutIdForAgent(agentId, preferredLoadoutId) {
    return completeLoadoutForAgent(agentId, preferredLoadoutId)?.id ?? ""
}

function loadoutDiscIdsForAgent(agentId, loadoutId = loadoutIdForAgent(agentId)) {
    const loadout = driveDiscLoadoutsForAgent(agentId).find(item => item.id === loadoutId)
    return loadout && loadoutIsComplete(loadout) ? sanitizeDiscIdsBySlot(loadout.driveDiscIdsBySlot) : {}
}

function selectedDiscIdsFromSavedConfig(agentId) {
    return selectedDiscModeForAgent(agentId) === "loadout"
        ? loadoutDiscIdsForAgent(agentId)
        : manualDiscIdsFromSavedConfig(agentId)
}

function activeDiscIdsForConfig(agentId, mode, manualDriveDiscIdsBySlot, selectedLoadoutId) {
    return normalizeHomeDiscMode(mode) === "loadout"
        ? loadoutDiscIdsForAgent(agentId, selectedLoadoutId)
        : manualDriveDiscIdsBySlot
}

function saveCurrentHomeSelection({ mode = currentHomeDiscMode(), manualDriveDiscIdsBySlot, selectedLoadoutId } = {}) {
    const agentId = validAgentId(els.agentSelect.value)
    if (!agentId) {
        return
    }

    const agent = getAgent(agentId)
    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(mode)
    const nextManualDriveDiscIdsBySlot = manualDriveDiscIdsBySlot === undefined
        ? manualDiscIdsFromSavedConfig(agentId)
        : sanitizeDiscIdsBySlot(manualDriveDiscIdsBySlot)
    const nextSelectedLoadoutId = selectedLoadoutId === undefined
        ? loadoutIdForAgent(agentId)
        : loadoutIdForAgent(agentId, selectedLoadoutId)
    const driveDiscIdsBySlot = activeDiscIdsForConfig(
        agentId,
        driveDiscMode,
        nextManualDriveDiscIdsBySlot,
        nextSelectedLoadoutId,
    )

    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: validWEngineId(els.wEngineSelect.value),
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        coreSkillLevel: validCoreSkillLevel(agent, els.coreSkillSelect.value),
        cinemaLevel: selectedCinemaLevel(),
        driveDiscMode,
        manualDriveDiscIdsBySlot: nextManualDriveDiscIdsBySlot,
        selectedLoadoutId: nextSelectedLoadoutId,
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(driveDiscIdsBySlot),
        combat: {
            ...(previousConfig.combat ?? {}),
            activeBuffIds: activeCombatBuffIdsForSave(agentId),
            addedBuffs: sanitizeAddedCombatBuffs(previousConfig.combat?.addedBuffs),
        },
        damage: collectDamageConfig(),
    }

    saveHomeSelection({
        currentAgentId: agentId,
        byAgent,
    })
}

function selectedDiscIdsForAgent(agentId) {
    return selectedDiscIdsFromSavedConfig(agentId)
}

function selectedDriveDiscsForAgent(agentId) {
    const selectedIds = selectedDiscIdsForAgent(agentId)
    return Object.entries(selectedIds)
        .map(([slot, id]) => {
            const disc = driveDiscById(id)
            return disc && Number(disc.partition) === Number(slot)
                ? toCalculatorDriveDisc(disc)
                : null
        })
        .filter(Boolean)
        .sort((left, right) => left.partition - right.partition)
}

function driveDiscLoadoutsForAgent(agentId) {
    return (userDriveDiscStore?.driveDiscLoadouts ?? [])
        .filter(loadout => loadout.agentId === agentId)
        .sort((left, right) =>
            String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))
            || String(left.name).localeCompare(String(right.name), "zh-CN")
        )
}

function loadoutMissingSlots(loadout) {
    return [1, 2, 3, 4, 5, 6].filter(slot => {
        const id = loadout?.driveDiscIdsBySlot?.[String(slot)]
        const disc = id ? driveDiscById(id) : null
        return !disc || Number(disc.partition) !== slot
    })
}

function loadoutIsComplete(loadout) {
    return loadoutMissingSlots(loadout).length === 0
}

function setHomeDiscMode(mode) {
    const useLoadout = mode === "loadout"
    els.manualDiscModeBtn?.classList.toggle("active", !useLoadout)
    els.loadoutDiscModeBtn?.classList.toggle("active", useLoadout)
    if (els.discPicker) {
        els.discPicker.hidden = useLoadout
    }
    const loadoutField = els.homeLoadoutSelect?.closest(".loadout-apply-field")
    if (loadoutField) {
        loadoutField.hidden = !useLoadout
    }
}

function renderHomeLoadoutSelect(agentId) {
    if (!els.homeLoadoutSelect) {
        return
    }

    const loadouts = driveDiscLoadoutsForAgent(agentId)
    const selectedLoadoutId = loadoutIdForAgent(agentId)
    els.homeLoadoutSelect.innerHTML = ""
    const empty = document.createElement("option")
    empty.value = ""
    empty.textContent = loadouts.length ? "未选择套装" : "当前角色暂无套装"
    empty.selected = !selectedLoadoutId
    els.homeLoadoutSelect.appendChild(empty)

    for (const loadout of loadouts) {
        const missingSlots = loadoutMissingSlots(loadout)
        const option = document.createElement("option")
        option.value = loadout.id
        option.textContent = `${loadout.name}${Number.isFinite(Number(loadout.score)) ? ` · ${Number(loadout.score).toFixed(0)}` : ""}${missingSlots.length ? ` · 缺 ${missingSlots.join("、")} 号位` : ""}`
        option.disabled = missingSlots.length > 0
        option.selected = loadout.id === selectedLoadoutId
        els.homeLoadoutSelect.appendChild(option)
    }

    els.homeLoadoutSelect.disabled = loadouts.every(loadout => !loadoutIsComplete(loadout))
}

async function switchHomeDiscMode(mode) {
    const nextMode = normalizeHomeDiscMode(mode)
    if (nextMode === "loadout" && !loadoutIdForAgent(validAgentId(els.agentSelect.value))) {
        throw new Error("当前角色没有可应用的完整套装，请先在驱动盘页修复缺失槽位。")
    }
    setHomeDiscMode(nextMode)
    saveCurrentHomeSelection({ mode: nextMode })
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
}

function currentAddedCombatBuffs() {
    return combatConfigForAgent(els.agentSelect.value).addedBuffs
        .filter(isResolvableAddedCombatBuff)
}

function cloneCombatBuffList(addedBuffs = []) {
    try {
        return structuredClone(addedBuffs)
    } catch {
        return JSON.parse(JSON.stringify(addedBuffs))
    }
}

function activeCombatBuffModalAddedBuffs() {
    return combatBuffDraftAddedBuffs ?? currentAddedCombatBuffs()
}

function combatBuffListKeys(addedBuffs = []) {
    return addedBuffs.map(addedCombatBuffKey).filter(Boolean)
}

function combatBuffDraftChanged() {
    if (!combatBuffDraftAddedBuffs) {
        return false
    }
    const before = combatBuffListKeys(currentAddedCombatBuffs()).sort()
    const after = combatBuffListKeys(combatBuffDraftAddedBuffs).sort()
    return before.length !== after.length || before.some((key, index) => key !== after[index])
}

function setCombatBuffDraftAddedBuffs(addedBuffs) {
    combatBuffDraftAddedBuffs = sanitizeAddedCombatBuffs(cloneCombatBuffList(addedBuffs))
        .filter(isResolvableAddedCombatBuff)
    updateCombatBuffModalSummary()
}

function updateCombatBuffModalSummary() {
    if (!els.combatBuffModalSummary) {
        return
    }
    const beforeKeys = new Set(combatBuffListKeys(currentAddedCombatBuffs()))
    const afterKeys = new Set(combatBuffListKeys(activeCombatBuffModalAddedBuffs()))
    const added = [...afterKeys].filter(key => !beforeKeys.has(key)).length
    const removed = [...beforeKeys].filter(key => !afterKeys.has(key)).length
    const changeText = added || removed ? ` / 本次新增 ${added} / 移除 ${removed}` : " / 无未应用改动"
    els.combatBuffModalSummary.textContent = `已选择 ${afterKeys.size} 个 Buff${changeText}`
    if (els.applyCombatBuffModalBtn) {
        els.applyCombatBuffModalBtn.disabled = !combatBuffDraftChanged()
    }
}

function savedActiveCombatBuffIds(agentId = els.agentSelect.value) {
    const ids = configForAgent(agentId).combat?.activeBuffIds
    return Array.isArray(ids) ? new Set(ids) : null
}

function activeCombatBuffIdsForSave(agentId = els.agentSelect.value) {
    const inputs = els.combatSection
        ? [...els.combatSection.querySelectorAll("input[data-combat-buff-id]")]
        : []
    if (inputs.length > 0) {
        return [...checkedCombatBuffIds()]
    }
    return [...(savedActiveCombatBuffIds(agentId) ?? new Set())]
}

function isResolvableAddedCombatBuff(item) {
    if (item?.sourceKind === "custom") {
        return true
    }

    if (item?.sourceKind === "teammateDriveDisc4pc") {
        return teammateDriveDisc4pcCandidates().some(candidate => candidate.setId === item.setId)
    }

    return allCombatBuffCandidates().some(candidate =>
        candidate.sourceKind === item?.sourceKind
        && candidate.id === item?.id
    )
}

function saveCurrentAddedCombatBuffs(addedBuffs) {
    const agentId = validAgentId(els.agentSelect.value)
    if (!agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(previousConfig.driveDiscMode)
    const manualDriveDiscIdsBySlot = manualDiscIdsFromSavedConfig(agentId)
    const selectedLoadoutId = loadoutIdForAgent(agentId)
    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: validWEngineId(els.wEngineSelect.value),
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        coreSkillLevel: validCoreSkillLevel(getAgent(agentId), els.coreSkillSelect.value),
        driveDiscMode,
        manualDriveDiscIdsBySlot,
        selectedLoadoutId,
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(activeDiscIdsForConfig(
            agentId,
            driveDiscMode,
            manualDriveDiscIdsBySlot,
            selectedLoadoutId,
        )),
        combat: {
            ...(previousConfig.combat ?? {}),
            activeBuffIds: activeCombatBuffIdsForSave(agentId),
            addedBuffs: sanitizeAddedCombatBuffs(addedBuffs),
        },
    }

    saveHomeSelection({
        currentAgentId: agentId,
        byAgent,
    })
}

function updateAddedCombatBuffRuntime(buffKey, updater) {
    const addedBuffs = currentAddedCombatBuffs()
    const next = addedBuffs.map(item => {
        if (addedCombatBuffKey(item) !== buffKey) {
            return item
        }

        const buff = resolveAddedCombatBuff(item)
        const runtime = runtimeForBuff(item, buff)
        updater(runtime, buff)
        return {
            ...item,
            runtime,
        }
    })
    saveCurrentAddedCombatBuffs(next)
}

function updateAddedCombatBuffModificationLevel(buffKey, value) {
    const next = currentAddedCombatBuffs().map(item => {
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
    })
    saveCurrentAddedCombatBuffs(next)
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
    return configForAgent(validAgentId(els.agentSelect.value))?.combat?.catalogBuffRuntimes ?? {}
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
    const buff = displayCombatBuffs().find(item => item.id === buffId)
    const agentId = validAgentId(els.agentSelect.value)
    if (!buff || !agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previousConfig = byAgent[agentId] ?? {}
    const combat = previousConfig.combat ?? {}
    const runtime = runtimeForBuff({ runtime: combat.catalogBuffRuntimes?.[buffId] ?? null }, buff)
    updater(runtime, buff)
    byAgent[agentId] = {
        ...previousConfig,
        combat: {
            ...combat,
            catalogBuffRuntimes: {
                ...(combat.catalogBuffRuntimes ?? {}),
                [buffId]: runtime,
            },
        },
    }
    saveHomeSelection({
        currentAgentId: agentId,
        byAgent,
    })
}

function addedCombatBuffByKey(buffKey) {
    return currentAddedCombatBuffs().find(item => addedCombatBuffKey(item) === buffKey) ?? null
}

function isIncompleteNumberText(value) {
    return ["", "-", "+", ".", "-.", "+."].includes(String(value ?? "").trim())
}

function inputNumberValue(input) {
    const text = String(input?.value ?? "").trim()
    if (isIncompleteNumberText(text)) {
        return null
    }

    const value = Number(text)
    return Number.isFinite(value) ? value : NaN
}

function finiteOr(value, fallback) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

function formatInputNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function rangeText(config) {
    const min = Number(config.min)
    const max = Number(config.max)
    if (Number.isFinite(min) && Number.isFinite(max)) {
        return `${formatInputNumber(min)} 到 ${formatInputNumber(max)}`
    }
    if (Number.isFinite(min)) {
        return `不低于 ${formatInputNumber(min)}`
    }
    if (Number.isFinite(max)) {
        return `不高于 ${formatInputNumber(max)}`
    }
    return "有效数字"
}

function validateNumberInputValue(value, config) {
    if (!Number.isFinite(value)) {
        return `${config.label}必须是有效数字，已恢复默认值 ${formatInputNumber(config.defaultValue)}。`
    }
    if (config.integer && !Number.isInteger(value)) {
        return `${config.label}必须是整数，已恢复默认值 ${formatInputNumber(config.defaultValue)}。`
    }
    if (Number.isFinite(config.min) && value < config.min) {
        return `${config.label}必须${rangeText(config).startsWith("不") ? rangeText(config) : `在 ${rangeText(config)} 之间`}，已恢复默认值 ${formatInputNumber(config.defaultValue)}。`
    }
    if (Number.isFinite(config.max) && value > config.max) {
        return `${config.label}必须${rangeText(config).startsWith("不") ? rangeText(config) : `在 ${rangeText(config)} 之间`}，已恢复默认值 ${formatInputNumber(config.defaultValue)}。`
    }
    return ""
}

function discOptionText(disc) {
    const set = disc.setName || nameOf(getDriveDiscSet(disc.setId))
    const sequence = disc.source?.sequence ? `#${disc.source.sequence} ` : ""
    const mainStat = storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode)
    const subStats = (disc.subStats ?? [])
        .map(item => `${storedStatLabel(item.stat, item.mode)} ${formatStoredStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
        .join(" / ")

    return `${sequence}${set} · ${disc.rarity}+${disc.level} · ${mainStat}${subStats ? ` · ${subStats}` : ""}`
}

function renderDiscPicker(agentId) {
    if (!els.discPicker) {
        return
    }

    const allDiscs = userDriveDiscStore?.driveDiscs ?? []
    const selectedIds = manualDiscIdsFromSavedConfig(agentId)
    els.discPicker.innerHTML = ""

    for (let slot = 1; slot <= 6; slot += 1) {
        const field = document.createElement("label")
        field.className = "field disc-picker-field"

        const label = document.createElement("span")
        label.textContent = `${slot}号位`

        const select = document.createElement("select")
        select.dataset.slot = String(slot)

        const emptyOption = document.createElement("option")
        emptyOption.value = ""
        emptyOption.textContent = "未选择"
        select.appendChild(emptyOption)

        const options = allDiscs
            .filter(disc => Number(disc.partition) === slot)
            .sort((left, right) => {
                const leftEquipped = left.equippedBy === agentId ? 0 : 1
                const rightEquipped = right.equippedBy === agentId ? 0 : 1
                return leftEquipped - rightEquipped
                    || String(left.setName).localeCompare(String(right.setName), "zh-CN")
                    || Number(left.source?.sequence ?? 999999) - Number(right.source?.sequence ?? 999999)
            })

        for (const disc of options) {
            const option = document.createElement("option")
            option.value = disc.id
            option.textContent = discOptionText(disc)
            option.selected = disc.id === selectedIds[String(slot)]
            select.appendChild(option)
        }

        field.append(label, select)
        els.discPicker.appendChild(field)
    }
}

function selectedDiscIdsFromPicker() {
    return Object.fromEntries(
        [...els.discPicker.querySelectorAll("select[data-slot]")]
            .map(select => [select.dataset.slot, select.value])
            .filter(([, id]) => id)
    )
}

function setDriveDiscInput(discs) {
    els.driveDiscInput.value = JSON.stringify(discs ?? [], null, 2)
}

function populateHomeDiscModalFilters(slot) {
    const discs = (userDriveDiscStore?.driveDiscs ?? [])
        .filter(disc => Number(disc.partition) === Number(slot))
    const selectedSet = els.homeDiscSetFilter.value
    const selectedMainStat = els.homeDiscMainStatFilter.value

    const sets = new Map()
    for (const disc of discs) {
        const set = driveDiscSetForDisc(disc)
        const key = set?.id ?? disc.setId
        sets.set(key, discDisplaySetName(disc))
    }

    els.homeDiscSetFilter.innerHTML = `<option value="">全部</option>`
    for (const [id, label] of [...sets.entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"))) {
        const option = document.createElement("option")
        option.value = id
        option.textContent = label
        option.selected = id === selectedSet
        els.homeDiscSetFilter.appendChild(option)
    }

    const stats = [...new Set(discs.map(disc => disc.mainStat?.stat).filter(Boolean))]
        .sort((a, b) => statLabel(a).localeCompare(statLabel(b), "zh-CN"))
    els.homeDiscMainStatFilter.innerHTML = `<option value="">全部</option>`
    for (const stat of stats) {
        const option = document.createElement("option")
        option.value = stat
        option.textContent = statLabel(stat)
        option.selected = stat === selectedMainStat
        els.homeDiscMainStatFilter.appendChild(option)
    }
}

function filteredHomeDiscOptions() {
    const slot = activeDiscSlot
    const setId = els.homeDiscSetFilter.value
    const mainStat = els.homeDiscMainStatFilter.value
    const search = els.homeDiscSearchInput.value.trim().toLowerCase()
    const selectedIds = manualDiscIdsFromSavedConfig(els.agentSelect.value)
    const selectedId = selectedIds[String(slot)]

    return (userDriveDiscStore?.driveDiscs ?? [])
        .filter(disc => {
            const set = driveDiscSetForDisc(disc)
            const haystack = [
                disc.id,
                disc.setId,
                disc.setName,
                nameOf(set),
                disc.source?.sequence,
                storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode),
                disc.mainStat?.label,
                ...(disc.subStats ?? []).flatMap(item => [storedStatLabel(item.stat, item.mode), item.label]),
            ].join(" ").toLowerCase()

            return Number(disc.partition) === Number(slot)
                && (!setId || disc.setId === setId || set?.id === setId)
                && (!mainStat || disc.mainStat?.stat === mainStat)
                && (!search || haystack.includes(search))
        })
        .sort((left, right) => {
            const leftSelected = left.id === selectedId ? 0 : 1
            const rightSelected = right.id === selectedId ? 0 : 1
            return leftSelected - rightSelected
                || String(left.setName).localeCompare(String(right.setName), "zh-CN")
                || Number(left.source?.sequence ?? 999999) - Number(right.source?.sequence ?? 999999)
        })
}

function renderHomeDiscOptions() {
    const discs = filteredHomeDiscOptions()
    const selectedId = manualDiscIdsFromSavedConfig(els.agentSelect.value)[String(activeDiscSlot)]
    els.homeDiscOptionList.innerHTML = ""
    els.homeDiscEmpty.hidden = discs.length !== 0

    for (const disc of discs) {
        const set = driveDiscSetForDisc(disc)
        const subStats = (disc.subStats ?? [])
            .map(item => `${storedStatLabel(item.stat, item.mode)} ${formatStoredStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
            .join(" / ")
        const button = document.createElement("button")
        button.type = "button"
        button.className = disc.id === selectedId ? "home-disc-option active" : "home-disc-option"
        button.dataset.discId = disc.id
        button.innerHTML = `
            <img src="${escapeHtml(driveDiscIcon(set))}" alt="">
            <div class="home-disc-option-main">
                <strong>${escapeHtml(discDisplaySetName(disc))}</strong>
                <span>${escapeHtml(`${disc.partition}号位 · ${disc.rarity}+${disc.level}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`)}</span>
            </div>
            <div class="home-disc-option-stat">
                <strong>${escapeHtml(`${storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode)} ${formatStoredStatValue(disc.mainStat?.stat, disc.mainStat?.value, { percentMode: disc.mainStat?.mode === "pct" })}`)}</strong>
                <span>${escapeHtml(subStats || "-")}</span>
            </div>
        `
        els.homeDiscOptionList.appendChild(button)
    }
}

function openHomeDiscModal(slot) {
    activeDiscSlot = Number(slot)
    els.homeDiscModalTitle.textContent = `选择 ${activeDiscSlot} 号位驱动盘`
    els.homeDiscModalSubtitle.textContent = "只显示当前号位的已有驱动盘"
    els.homeDiscSearchInput.value = ""
    els.homeDiscSetFilter.value = ""
    els.homeDiscMainStatFilter.value = ""
    populateHomeDiscModalFilters(activeDiscSlot)
    renderHomeDiscOptions()
    els.homeDiscModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeHomeDiscModal() {
    els.homeDiscModal.hidden = true
    document.body.classList.remove("modal-open")
    activeDiscSlot = null
}

async function selectHomeDisc(discId) {
    if (!activeDiscSlot) {
        return
    }

    const next = {
        ...manualDiscIdsFromSavedConfig(els.agentSelect.value),
        [String(activeDiscSlot)]: discId,
    }
    saveCurrentHomeSelection({ mode: "manual", manualDriveDiscIdsBySlot: next })
    setHomeDiscMode("manual")
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
    closeHomeDiscModal()
}

async function clearHomeDiscSlot() {
    if (!activeDiscSlot) {
        return
    }

    const next = { ...manualDiscIdsFromSavedConfig(els.agentSelect.value) }
    delete next[String(activeDiscSlot)]
    saveCurrentHomeSelection({ mode: "manual", manualDriveDiscIdsBySlot: next })
    setHomeDiscMode("manual")
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
    closeHomeDiscModal()
}

function currentElementDmgKey() {
    return `${currentDamageElement()}Dmg`
}

function panelOrderForCurrentAgent({ includeDmgBonus = true } = {}) {
    const elementDmgKey = currentElementDmgKey()
    const baseOrder = includeDmgBonus ? PANEL_ORDER : OUT_OF_COMBAT_PANEL_BASE_ORDER
    return baseOrder.filter(key => !ELEMENT_DMG_KEYS.has(key) || key === elementDmgKey)
}

function outOfCombatHighlightKeys() {
    return new Set(["atk", "critRate", "critDmg", currentElementDmgKey()])
}

function inCombatHighlightKeys() {
    return new Set(["atk", "sheerForce", "critRate", "critDmg", currentElementDmgKey(), "dmgBonus"])
}

function renderOrderedKV(container, obj, order, options = {}) {
    if (!container) {
        return
    }

    const highlightedKeys = options.highlightedKeys ?? new Set()
    container.innerHTML = ""

    for (const key of order) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            continue
        }

        const row = document.createElement("div")
        row.className = "kv-row"
        if (highlightedKeys.has(key)) {
            row.classList.add("highlighted")
            if (options.highlightClass) {
                row.classList.add(options.highlightClass)
            }
        }
        row.innerHTML = `<span>${statLabel(key)}</span><strong>${formatValue(obj[key], key)}</strong>`
        container.appendChild(row)
    }
}

function renderNamedKV(container, rows) {
    if (!container) {
        return
    }

    container.innerHTML = ""
    for (const rowData of rows) {
        const row = document.createElement("div")
        row.className = "kv-row"
        row.innerHTML = `<span>${rowData.label}</span><strong>${rowData.value}</strong>`
        container.appendChild(row)
    }
}

function renderAtkBreakdown(outOfCombat, inCombat) {
    const outBreakdown = outOfCombat?.breakdown ?? {}
    const baseAtk = outBreakdown.baseAtk ?? {}
    const outAtk = outBreakdown.atkPanel ?? {}
    const inAtk = inCombat?.breakdown?.atkPanel ?? {}

    renderNamedKV(els.baseAtkBreakdown, [
        { label: "角色基础攻击力", value: formatValue(baseAtk.agent ?? 0, "atk") },
        { label: "音擎基础攻击力", value: formatValue(baseAtk.wEngine ?? 0, "atk") },
        { label: "核心技基础攻击力", value: formatValue(baseAtk.coreSkill ?? 0, "atk") },
        { label: "基础攻击力合计", value: formatValue(baseAtk.total ?? outOfCombat?.base?.atk ?? 0, "atk") },
    ])

    renderNamedKV(els.outAtkBreakdown, [
        { label: "基础攻击力", value: formatValue(outAtk.baseAtk ?? outOfCombat?.base?.atk ?? 0, "atk") },
        { label: "局外攻击力百分比", value: formatValue(outAtk.atkPct ?? 0, "atkPct") },
        { label: "百分比换算攻击力", value: formatValue(outAtk.atkFromPct ?? 0, "atk") },
        { label: "固定攻击力", value: formatValue(outAtk.atkFlat ?? 0, "atk") },
        { label: "局外攻击力", value: formatValue(outAtk.total ?? outOfCombat?.panel?.atk ?? 0, "atk") },
    ])

    renderNamedKV(els.inAtkBreakdown, [
        { label: "局外攻击力", value: formatValue(inAtk.outOfCombatAtk ?? outOfCombat?.panel?.atk ?? 0, "atk") },
        { label: "局内固定攻击力", value: formatValue(inAtk.atkFlat ?? 0, "atk") },
        { label: "基于基础攻击力的攻击力%", value: formatValue(inAtk.baseAtkPct ?? 0, "atkPct") },
        { label: "基础攻击力%换算", value: formatValue(inAtk.atkFromBasePct ?? 0, "atk") },
        { label: "基于局外攻击力的攻击力%", value: formatValue(inAtk.outOfCombatAtkPct ?? 0, "atkPct") },
        { label: "局外攻击力%换算", value: formatValue(inAtk.atkFromOutOfCombatPct ?? 0, "atk") },
        { label: "局内攻击力", value: formatValue(inAtk.total ?? inCombat?.panel?.atk ?? outOfCombat?.panel?.atk ?? 0, "atk") },
    ])
}

function renderList(container, items, className = "") {
    container.innerHTML = ""
    if (!items || items.length === 0) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        container.appendChild(empty)
        return
    }

    for (const item of items) {
        const line = document.createElement("div")
        line.className = `list-item ${className}`.trim()
        line.textContent = item
        container.appendChild(line)
    }
}

function renderStatStrip(container, entries) {
    container.innerHTML = ""
    for (const entry of entries) {
        const chip = document.createElement("div")
        chip.className = "stat-chip"
        chip.innerHTML = `<span>${entry.label}</span><strong>${entry.value}</strong>`
        container.appendChild(chip)
    }
}

function renderAgentMeta(agent, coreSkillLevel = "none") {
    if (!agent) {
        els.agentMeta.innerHTML = ""
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
    if (!wEngine) {
        els.wEngineMeta.innerHTML = ""
        els.wEngineEffect.innerHTML = ""
        return
    }

    const advanced = wEngine.level60?.advancedStat
    renderStatStrip(els.wEngineMeta, [
        { label: "适配特性", value: enumLabel("specialty", wEngine.specialty) },
        { label: "基础攻击力", value: formatValue(wEngine.level60?.atkBase ?? 0, "atk") },
        {
            label: "高级属性",
            value: advanced ? `${storedStatLabel(advanced.stat, advanced.mode)} ${formatStoredStatValue(advanced.stat, advanced.value, { percentMode: advanced.mode === "pct" })}` : "-",
        },
    ])
}

function renderWEngineEffect(wEngine) {
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
    const eyebrow = document.createElement("span")
    eyebrow.textContent = "音擎效果"
    const title = document.createElement("strong")
    title.textContent = nameOf(effect)
    head.append(eyebrow, title)

    const body = document.createElement("div")
    body.className = "weapon-effect-body"
    if (requirement) {
        const requirementLine = document.createElement("p")
        requirementLine.className = "weapon-effect-requirement"
        requirementLine.textContent = requirement
        body.appendChild(requirementLine)
    }

    if (description) {
        const descriptionLine = document.createElement("p")
        descriptionLine.textContent = description
        body.appendChild(descriptionLine)
    }

    if (selfStats) {
        const buffLine = document.createElement("p")
        buffLine.className = "weapon-effect-buff"
        buffLine.textContent = `限佩戴者：${selfStats}`
        body.appendChild(buffLine)
    }

    if (teamStats) {
        const buffLine = document.createElement("p")
        buffLine.className = "weapon-effect-buff"
        buffLine.textContent = `团队：${teamStats}`
        body.appendChild(buffLine)
    }

    els.wEngineEffect.append(head, body)
}

function effectStats(effect) {
    return SharedCombat.effectStats(effect)
}

function effectRules(effect) {
    return SharedCombat.effectRules(effect)
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
        return `${storedStatLabel(rule.stat, rule.mode)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}（${source} ${sourceValue} × ${ratio}%${capText}，覆盖率 ${coverage}）`
    }

    if (rule.type === "formula") {
        const source = rule.source ?? {}
        const rawSourceValue = Number(ruleRuntime.sourceValue ?? source.defaultValue ?? 0)
        const sourceValue = Math.max(
            Number.isFinite(Number(source.min)) ? Number(source.min) : rawSourceValue,
            Math.min(Number.isFinite(Number(source.max)) ? Number(source.max) : rawSourceValue, rawSourceValue),
        )
        const expression = rule.formula?.expression ?? ""
        let finalValue = 0
        try {
            finalValue = evaluateFormulaExpression(expression, { [source.variable ?? "x"]: sourceValue }) * coverage
        } catch {
            return `${storedStatLabel(rule.stat, rule.mode)}：公式无效`
        }
        const sourceLabel = localizedText(source.label ?? rule.sourceLabel) || "来源数值"
        const coverageText = coverage !== 1 ? `，覆盖率 ${coverage}` : ""
        return `${storedStatLabel(rule.stat, rule.mode)} +${formatStoredStatValue(rule.stat, finalValue, { percentMode: rule.mode === "pct" })}（${sourceLabel} x=${sourceValue}；公式 ${expression}${coverageText}）`
    }

    if (rule.type === "stacked") {
        const stacks = Number(ruleRuntime.stacks ?? rule.defaultStacks ?? rule.maxStacks ?? 1)
        const value = Number(rule.valuePerStack ?? rule.value ?? 0) * stacks * coverage
        return `${storedStatLabel(rule.stat, rule.mode)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}（${stacks}/${rule.maxStacks ?? stacks} 层，覆盖率 ${coverage}）`
    }

    const value = Number(rule.value ?? 0) * coverage
    return `${storedStatLabel(rule.stat, rule.mode)} +${formatStoredStatValue(rule.stat, value, { percentMode: rule.mode === "pct" })}${coverage !== 1 ? `（覆盖率 ${coverage}）` : ""}`
}

function wEngineEffectData(wEngine) {
    if (wEngine?.effect) {
        return wEngine.effect
    }

    if (wEngine?.passive) {
        return {
            name: wEngine.passive.name,
            description: null,
            requirement: wEngine.specialty
                ? {
                    specialty: wEngine.specialty,
                }
                : null,
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

function wEngineEffectBuff(wEngine) {
    return wEngineEffectSelfBuff(wEngine)
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
    return displayWEngines().find(item => item.id === wEngineId) ?? null
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
        name: { zhCN: `${nameOf(materializedWEngine)}（队友音擎团队）` },
        description: effect?.description ?? buff.description ?? buff.conditionLabel,
        conditionLabel: buff.condition ?? effect?.requirement?.label,
        stats: effectStats(buff),
        effects: buff.effects ?? null,
        buffModifiers: buff.buffModifiers ?? null,
        coverage: buff.coverage ?? null,
    }
}

function legacyDriveDiscFourPieceBuff(fourPiece) {
    if (!fourPiece || fourPiece.selfBuff || !effectRules(fourPiece).length) {
        return null
    }

    return {
        condition: fourPiece.condition ?? null,
        durationSeconds: fourPiece.durationSeconds ?? null,
        cooldownSeconds: fourPiece.cooldownSeconds ?? null,
        ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
        effects: effectRules(fourPiece),
    }
}

function driveDiscFourPieceSelfBuff(set) {
    const fourPiece = set?.fourPiece
    const buff = fourPiece?.selfBuff ?? legacyDriveDiscFourPieceBuff(fourPiece)
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDiscFourPieceTeamBuff(set) {
    const buff = set?.fourPiece?.teamBuff ?? null
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDisc4pcSelfKey(set) {
    return `driveDisc4pc:${set.id}.self`
}

function driveDisc4pcTeamKey(set) {
    return `driveDisc4pc:${set.id}.team`
}

function combatBuffsByType(sourceType) {
    return displayCombatBuffs().filter(item => item.sourceType === sourceType)
}

function teammateCombatBuffGroups() {
    const groupedIds = new Set()
    const groups = displayTeammateCombatBuffGroups()
        .map(group => {
            const buffs = (group.buffs ?? []).map(buff => {
                groupedIds.add(buff.id)
                return {
                    ...buff,
                    sourceLabel: buff.sourceLabel ?? buff.source,
                    sourceType: "teammate",
                    teammateId: group.id,
                    teammateName: group.name,
                    teammateImages: group.images ?? null,
                }
            })

            return {
                ...group,
                buffs,
            }
        })
        .filter(group => group.buffs.length > 0)

    const fallbackBuffs = combatBuffsByType("teammate")
        .filter(buff => !groupedIds.has(buff.id))
    if (fallbackBuffs.length) {
        groups.push({
            id: "ungrouped",
            name: {
                zhCN: "其他队友",
                en: "Other Teammates",
            },
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
    const labels = {
        corePassive: "核心被动",
        additionalAbility: "额外能力",
    }

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
            name: buff.name ?? {
                zhCN: labels[key] ?? key,
                en: labels[key] ?? key,
            },
            description: buff.description ?? null,
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            stats: effectStats(buff),
            effects: buff.effects ?? null,
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
            defaultChecked: true,
            name: buff.name ?? cinemaBuffName(buff),
            description: buff.description ?? null,
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            stats: effectStats(buff),
            effects: buff.effects ?? null,
            coverage: buff.coverage ?? null,
        }))
    return [...fixedBuffs, ...cinemaBuffs]
}

function wEngineEquippedBuffs() {
    const wEngine = currentWEngineWithModification()
    const effect = wEngineEffectData(wEngine)
    if (!wEngine) {
        return []
    }

    return [
        {
            id: wEngineSelfBuffKey(wEngine),
            sourceType: "wEngine",
            name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（限佩戴者）` },
            conditionLabel: localizedText(effect?.requirement?.label) || wEngineEffectSelfBuff(wEngine)?.condition,
            buff: wEngineEffectSelfBuff(wEngine),
        },
        {
            id: wEngineTeamBuffKey(wEngine),
            sourceType: "wEngineTeam",
            name: { zhCN: `${nameOf(effect) || nameOf(wEngine)}（团队）` },
            conditionLabel: localizedText(effect?.requirement?.label) || wEngineEffectTeamBuff(wEngine)?.condition,
            buff: wEngineEffectTeamBuff(wEngine),
        },
    ]
        .filter(item => item.buff?.scope === "inCombat")
        .map(item => ({
            id: item.id,
            sourceType: item.sourceType,
            name: item.name,
            description: effect?.description ?? item.buff.description ?? null,
            conditionLabel: item.conditionLabel,
            stats: effectStats(item.buff),
            effects: item.buff.effects ?? null,
            coverage: item.buff.coverage ?? null,
        }))
}

function ownDriveDisc4pcBuffs() {
    const counts = new Map()
    for (const disc of parseDriveDiscs()) {
        if (disc.setId) {
            counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
        }
    }

    return [...counts.entries()]
        .filter(([, count]) => count >= 4)
        .map(([setId]) => getDriveDiscSet(setId))
        .filter(set => set?.fourPiece)
        .flatMap(set => [
            {
                id: driveDisc4pcSelfKey(set),
                sourceType: "driveDisc4pc",
                name: { zhCN: `${nameOf(set)} 4件套（限佩戴者）` },
                buff: driveDiscFourPieceSelfBuff(set),
                effectText: set.fourPiece?.effectText ?? null,
            },
            {
                id: driveDisc4pcTeamKey(set),
                sourceType: "driveDisc4pcTeam",
                name: { zhCN: `${nameOf(set)} 4件套（团队）` },
                buff: driveDiscFourPieceTeamBuff(set),
                effectText: set.fourPiece?.effectText ?? null,
            },
        ])
        .filter(item => item.buff)
        .map(item => ({
            id: item.id,
            sourceType: item.sourceType,
            name: item.name,
            description: item.effectText ?? item.buff.description ?? null,
            conditionLabel: item.buff.condition,
            stats: effectStats(item.buff),
            effects: item.buff.effects ?? null,
            buffModifiers: item.buff.buffModifiers ?? null,
            coverage: item.buff.coverage ?? null,
            effectText: item.effectText,
        }))
}

function driveDisc4pcSetOptions() {
    return displayDriveDiscSets()
        .filter(set => set.fourPiece)
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
}

function teammateBuffCandidates() {
    return teammateCombatBuffGroups()
        .flatMap(group => (group.buffs ?? []).map(buff => ({
            id: buff.id,
            sourceCategory: "agent",
            sourceKind: "teammate",
            ownerId: group.id,
            ownerName: group.name,
            sourceLabel: buff.sourceLabel ?? buff.source,
            source: buff.source,
            name: buff.name,
            description: buff.description,
            conditionLabel: buff.conditionLabel,
            stats: buff.stats ?? [],
            effects: buff.effects ?? null,
            buffModifiers: buff.buffModifiers ?? null,
            coverage: buff.coverage ?? null,
        })))
}

function ownDriveDisc4pcCandidates() {
    return []
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

function wEngineTeamBuffCandidates() {
    return displayWEngines()
        .map(wEngine => wEngineTeamBuffCandidateFromWEngine(wEngine, 1))
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
        return [
            ...ownDriveDisc4pcCandidates(),
            ...teammateDriveDisc4pcCandidates(),
        ]
    }

    return []
}

function allCombatBuffCandidates() {
    return [
        ...teammateBuffCandidates(),
        ...wEngineTeamBuffCandidates(),
        ...ownDriveDisc4pcCandidates(),
        ...teammateDriveDisc4pcCandidates(),
    ]
}

function resolveAddedCombatBuff(item) {
    if (item?.sourceKind === "custom") {
        return {
            ...item,
            ownerName: {
                zhCN: "自定义",
                en: "Custom",
            },
            description: storedEffectRulesText(item) || storedEffectStatText(item.stats),
        }
    }

    if (item?.sourceKind === "teammateDriveDisc4pc") {
        return teammateDriveDisc4pcCandidates().find(candidate => candidate.setId === item.setId) ?? item
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

function wEngineTeamAddedCount(addedBuffs = currentAddedCombatBuffs()) {
    return addedBuffs.filter(item => item.sourceKind === "wEngineTeam").length
}

function driveDiscAddedCount(addedBuffs = currentAddedCombatBuffs()) {
    return addedBuffs.filter(item =>
        item.sourceKind === "teammateDriveDisc4pc"
        || item.sourceCategory === "driveDisc"
    ).length
}

function teammateOwnerIdForBuff(item, buff = resolveAddedCombatBuff(item)) {
    return item?.sourceKind === "teammate"
        ? String(buff?.ownerId ?? item?.ownerId ?? "")
        : ""
}

function teammateOwnerIdsForAddedBuffs(addedBuffs = currentAddedCombatBuffs()) {
    const ownerIds = new Set()
    for (const item of addedBuffs) {
        const ownerId = teammateOwnerIdForBuff(item)
        if (ownerId) {
            ownerIds.add(ownerId)
        }
    }
    return ownerIds
}

function candidateLimitMessage(candidate, addedBuffs = currentAddedCombatBuffs()) {
    if (!candidate) {
        return ""
    }
    const key = addedCombatBuffKey(candidate)
    if (addedBuffs.some(item => addedCombatBuffKey(item) === key)) {
        return ""
    }

    if (candidate.sourceKind === "wEngineTeam" && wEngineTeamAddedCount(addedBuffs) >= W_ENGINE_TEAM_BUFF_LIMIT) {
        return `音擎引发的 Buff 最多选择 ${W_ENGINE_TEAM_BUFF_LIMIT} 个`
    }

    if (
        (candidate.sourceKind === "teammateDriveDisc4pc" || candidate.sourceCategory === "driveDisc")
        && driveDiscAddedCount(addedBuffs) >= DRIVE_DISC_TEAM_BUFF_LIMIT
    ) {
        return `驱动盘引发的 Buff 最多选择 ${DRIVE_DISC_TEAM_BUFF_LIMIT} 个`
    }

    return ""
}

function addedCombatBuffEntry(candidate) {
    return {
        id: candidate.id,
        sourceCategory: candidate.sourceCategory,
        sourceKind: candidate.sourceKind,
        setId: candidate.setId ?? null,
        ...(candidate.sourceKind === "wEngineTeam" ? { wEngineModificationLevel: 1 } : {}),
        runtime: defaultRuntimeForBuff(candidate),
    }
}

function selectedTeammateBuffCandidates() {
    return teammateBuffCandidates().filter(candidate => candidate.ownerId === activeCombatBuffTeammateId)
}

function ensureActiveCombatBuffTeammateId(groups = teammateCombatBuffGroups()) {
    if (!groups.length) {
        activeCombatBuffTeammateId = ""
        return null
    }
    const selectedOwnerIds = teammateOwnerIdsForAddedBuffs()
    const preferredGroup = groups.find(group => group.id === activeCombatBuffTeammateId)
        ?? groups.find(group => selectedOwnerIds.has(group.id))
        ?? groups[0]
    activeCombatBuffTeammateId = preferredGroup.id
    return preferredGroup
}

function renderCombatBuffTeammatePicker() {
    const groups = teammateCombatBuffGroups()
    const activeGroup = ensureActiveCombatBuffTeammateId(groups)
    const selectedOwnerIds = teammateOwnerIdsForAddedBuffs(activeCombatBuffModalAddedBuffs())

    els.combatBuffTeammateSelect.innerHTML = ""
    for (const group of groups) {
        const option = document.createElement("option")
        const alreadySelected = selectedOwnerIds.has(group.id)
        option.value = group.id
        option.textContent = `${nameOf(group)}${alreadySelected ? "（已添加）" : ""}`
        option.selected = group.id === activeCombatBuffTeammateId
        els.combatBuffTeammateSelect.appendChild(option)
    }

    const candidates = selectedTeammateBuffCandidates()
    const addedKeys = new Set(activeCombatBuffModalAddedBuffs().map(addedCombatBuffKey))
    const hasAddedFromActive = candidates.some(candidate => addedKeys.has(addedCombatBuffKey(candidate)))
    const allAddedFromActive = candidates.length > 0
        && candidates.every(candidate => addedKeys.has(addedCombatBuffKey(candidate)))

    els.addTeammateBuffsBtn.disabled = !candidates.length || allAddedFromActive
    els.removeTeammateBuffsBtn.disabled = !hasAddedFromActive
    els.combatBuffTeammateHint.textContent = `已选择 ${selectedOwnerIds.size} 名角色`
}

function addedCombatBuffSourceGroupKey(item, buff = resolveAddedCombatBuff(item)) {
    if (item?.sourceKind === "teammate") {
        return `agent:${teammateOwnerIdForBuff(item, buff) || item.id}`
    }
    if (item?.sourceKind === "wEngineTeam") {
        return "wEngine"
    }
    if (item?.sourceKind === "custom") {
        return "custom"
    }
    if (item?.sourceKind === "teammateDriveDisc4pc" || item?.sourceCategory === "driveDisc") {
        return "driveDisc"
    }
    return item?.sourceCategory ?? "other"
}

function addedCombatBuffSourceGroupOrder(item) {
    if (item?.sourceKind === "teammate") {
        return 0
    }
    if (item?.sourceKind === "wEngineTeam") {
        return 1
    }
    if (item?.sourceKind === "teammateDriveDisc4pc" || item?.sourceCategory === "driveDisc") {
        return 2
    }
    if (item?.sourceKind === "custom") {
        return 3
    }
    return 2
}

function addedCombatBuffSourceGroups(addedBuffs = currentAddedCombatBuffs()) {
    const groups = []
    const byKey = new Map()
    let agentGroupCount = 0

    for (const item of addedBuffs) {
        const buff = resolveAddedCombatBuff(item)
        const key = addedCombatBuffSourceGroupKey(item, buff)
        let group = byKey.get(key)
        if (!group) {
            const isAgent = item.sourceKind === "teammate"
            const label = isAgent
                ? localizedText(buff.ownerName) || "角色"
                : item.sourceKind === "wEngineTeam"
                    ? "队友音擎"
                    : item.sourceKind === "custom"
                        ? "自定义"
                        : item.sourceKind === "teammateDriveDisc4pc" || item.sourceCategory === "driveDisc"
                            ? "驱动盘"
                            : sourceCategoryLabel(buff.sourceCategory)
            group = {
                key,
                label,
                order: addedCombatBuffSourceGroupOrder(item),
                sequence: groups.length,
                className: isAgent
                    ? `combat-added-source-group--agent combat-added-source-group--agent-${(agentGroupCount++ % 2) + 1}`
                    : `combat-added-source-group--${key}`,
                items: [],
            }
            byKey.set(key, group)
            groups.push(group)
        }
        group.items.push({ item, buff })
    }

    return groups.sort((left, right) => left.order - right.order || left.sequence - right.sequence)
}

function checkedCombatBuffIds() {
    if (!els.combatSection) {
        return new Set()
    }

    return new Set(
        [...els.combatSection.querySelectorAll("input[data-combat-buff-id]:checked")]
            .map(input => input.dataset.combatBuffId)
    )
}

function activeCombatBuffIdsForRender() {
    const agentId = els.agentSelect?.value ?? ""
    const inputs = els.combatSection
        ? [...els.combatSection.querySelectorAll("input[data-combat-buff-id]")]
        : []
    if (inputs.length > 0 && renderedCombatBuffAgentId === agentId) {
        return {
            checkedIds: checkedCombatBuffIds(),
            useDefaultChecked: false,
        }
    }
    const savedIds = savedActiveCombatBuffIds(agentId)
    return {
        checkedIds: savedIds ?? new Set(),
        useDefaultChecked: !savedIds,
    }
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

function shouldUseDefaultCheckedCombatBuff(buff, useDefaultChecked) {
    const defaultApplies = useDefaultChecked || buff?.sourceKind === "cinema"
    return defaultApplies
        && isDefaultCheckedCombatBuff(buff)
        && !manuallyUncheckedDefaultCombatBuffIds.has(buff.id)
}

function renderCombatCheckboxList(container, buffs, checkedIds, { useDefaultChecked = true } = {}) {
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
            || shouldUseDefaultCheckedCombatBuff(buff, useDefaultChecked)
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
        title.textContent = combatBuffDisplayName(buff)
        const description = document.createElement("span")
        description.className = "combat-check-description"
        description.textContent = localizedText(buff.description)
            || localizedText(buff.effectText)
            || localizedText(buff.conditionLabel)
            || buff.condition
            || "勾选后计入局内"
        const stats = document.createElement("span")
        stats.className = "combat-check-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, buff)
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

function renderCatalogCombatBuffCards(container, buffs, checkedIds) {
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
        title.textContent = combatBuffDisplayName(buff)
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
        renderBuffEffectLines(stats, buff, runtime)

        row.append(description, stats)
        if (checked) {
            renderBuffRuntimeControls(row, item, buff, runtime)
        }
        container.appendChild(row)
    }
}

function teammateGroupImage(group = {}) {
    return group.images?.icon ?? group.images?.portrait ?? ""
}

function renderCombatTeamHead(section, group = {}) {
    const head = document.createElement("div")
    head.className = "combat-team-head"

    const image = teammateGroupImage(group)
    const avatar = image ? document.createElement("img") : document.createElement("span")
    avatar.className = image ? "combat-team-avatar" : "combat-team-avatar empty"
    if (image) {
        avatar.src = image
        avatar.alt = nameOf(group)
    } else {
        avatar.setAttribute("aria-hidden", "true")
    }

    const copy = document.createElement("span")
    copy.className = "combat-team-head-copy"

    const title = document.createElement("strong")
    title.textContent = nameOf(group)

    const meta = document.createElement("span")
    meta.textContent = `${group.buffs?.length ?? 0} 个 Buff`

    copy.append(title, meta)
    head.append(avatar, copy)
    section.appendChild(head)
}

function renderTeammateCombatBuffGroups(container, groups, checkedIds) {
    container.innerHTML = ""
    if (!groups.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "-"
        container.appendChild(empty)
        return
    }

    for (const group of groups) {
        const section = document.createElement("section")
        section.className = "combat-team-group"

        renderCombatTeamHead(section, group)

        for (const buff of group.buffs ?? []) {
            const row = document.createElement("label")
            row.className = "combat-check-row teammate-buff-row"

            const input = document.createElement("input")
            input.type = "checkbox"
            input.dataset.combatBuffId = buff.id
            input.checked = checkedIds.has(buff.id)

            const copy = document.createElement("span")
            copy.className = "combat-check-copy"

            const source = document.createElement("strong")
            source.textContent = localizedText(buff.sourceLabel) || nameOf(buff)

            const description = document.createElement("span")
            description.className = "combat-check-description"
            description.textContent = localizedText(buff.description) || localizedText(buff.conditionLabel) || "勾选后计入局内"

            const stats = document.createElement("span")
            stats.className = "combat-check-stats combat-buff-effect-lines"
            renderBuffEffectLines(stats, buff, defaultRuntimeForBuff(buff), { normalPrefix: "实际效果：" })

            copy.append(source, description, stats)
            row.append(input, copy)
            section.appendChild(row)
        }

        container.appendChild(section)
    }
}

function renderDriveDisc4pcSelect(select, selectedId) {
    const sets = driveDisc4pcSetOptions()
    select.innerHTML = ""

    const emptyOption = document.createElement("option")
    emptyOption.value = ""
    emptyOption.textContent = "不启用"
    select.appendChild(emptyOption)

    for (const set of sets) {
        const option = document.createElement("option")
        option.value = set.id
        option.textContent = nameOf(set)
        option.selected = set.id === selectedId
        select.appendChild(option)
    }
}

function renderAddedCombatBuffs() {
    const addedBuffs = currentAddedCombatBuffs()
    els.addedCombatBuffs.innerHTML = ""

    if (!addedBuffs.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "点击 + 添加队友、驱动盘或自定义 Buff"
        els.addedCombatBuffs.appendChild(empty)
        return
    }

    for (const group of addedCombatBuffSourceGroups(addedBuffs)) {
        const section = document.createElement("section")
        section.className = `combat-added-source-group ${group.className}`
        section.dataset.buffGroupKey = group.key

        const head = document.createElement("div")
        head.className = "combat-added-source-head"
        const copy = document.createElement("div")
        const source = document.createElement("small")
        source.textContent = `来自${group.label}`
        const count = document.createElement("strong")
        count.textContent = `${group.items.length} 个 Buff`
        copy.append(source, count)

        const removeGroup = document.createElement("button")
        removeGroup.type = "button"
        removeGroup.className = "combat-remove-group-btn"
        removeGroup.dataset.removeBuffGroupKey = group.key
        removeGroup.textContent = "移除全部"
        head.append(copy, removeGroup)

        const items = document.createElement("div")
        items.className = "combat-added-source-items"

        for (const { item, buff } of group.items) {
            const runtime = runtimeForBuff(item, buff)
            const row = document.createElement("article")
            row.className = "combat-added-card combat-added-item-card"
            row.dataset.buffKey = addedCombatBuffKey(item)

            const title = document.createElement("strong")
            title.textContent = combatBuffDisplayName(buff)

            const description = document.createElement("p")
            description.textContent = localizedText(buff.description) || localizedText(buff.conditionLabel) || "已添加到局内计算"

            const stats = document.createElement("span")
            stats.className = "combat-added-stats combat-buff-effect-lines"
            renderBuffEffectLines(stats, buff, runtime)

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
                    localizedText(buff.sourceLabel) || localizedText(buff.source),
                ].filter(Boolean).join(" · ") || sourceCategoryLabel(buff.sourceCategory)
                row.appendChild(metaLine)
            }
            row.append(description, stats)
            renderAddedWEngineModificationControl(row, item)
            renderBuffRuntimeControls(row, item, buff, runtime)
            row.appendChild(remove)
            items.appendChild(row)
        }

        section.append(head, items)
        els.addedCombatBuffs.appendChild(section)
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
    const stackGroups = SharedCombat.runtimeStackGroups(buff)
    const needsRuntime = hasCoverage || rules.some(rule => rule.type === "derived" || rule.type === "formula") || stackGroups.length > 0
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

    const renderedSourceGroups = new Set()
    for (const rule of rules) {
        const id = SharedCombat.effectRuleId(rule)
        if (rule.type === "derived" || rule.type === "formula") {
            const sourceGroup = SharedCombat.runtimeSourceGroupForRule(buff, rule)
            if (!sourceGroup || renderedSourceGroups.has(sourceGroup.key)) {
                continue
            }
            renderedSourceGroups.add(sourceGroup.key)
            const primaryId = sourceGroup.ruleIds[0] ?? id
            const minAttr = Number.isFinite(sourceGroup.min) ? ` min="${sourceGroup.min}"` : ""
            const maxAttr = Number.isFinite(sourceGroup.max) ? ` max="${sourceGroup.max}"` : ""
            const field = document.createElement("label")
            field.className = "field"
            field.innerHTML = `
                <span>${escapeHtml(sourceGroup.label)}</span>
                <input type="number"${minAttr}${maxAttr} step="1" value="${runtime.effects?.[primaryId]?.sourceValue ?? sourceGroup.defaultValue ?? 0}" data-runtime-effect="${escapeHtml(primaryId)}" data-runtime-source-group="${escapeHtml(sourceGroup.key)}" data-runtime-source-value>
            `
            controls.appendChild(field)
        }
    }
    for (const stackGroup of stackGroups) {
        const primaryId = stackGroup.ruleIds[0] ?? ""
        const field = document.createElement("label")
        field.className = "field"
        field.innerHTML = `
            <span>${escapeHtml(stackGroup.label)}</span>
            <input type="number" min="0" max="${stackGroup.maxStacks ?? 1}" step="1" value="${runtime.effects?.[primaryId]?.stacks ?? stackGroup.defaultStacks ?? stackGroup.maxStacks ?? 1}" data-runtime-effect="${escapeHtml(primaryId)}" data-runtime-stack-group="${escapeHtml(stackGroup.key)}" data-runtime-stacks>
        `
        controls.appendChild(field)
    }

    row.appendChild(controls)
}

function runtimeRuleForField(buff, field) {
    const id = field.dataset.runtimeEffect
    if (!id) {
        return null
    }
    return effectRules(buff).find(rule => SharedCombat.effectRuleId(rule) === id) ?? null
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

    if (field.matches("[data-runtime-source-value]")) {
        const sourceGroup = SharedCombat.runtimeSourceGroupForKey(buff, field.dataset.runtimeSourceGroup)
        if (sourceGroup) {
            return {
                label: sourceGroup.label,
                defaultValue: finiteOr(sourceGroup.defaultValue, 0),
                min: sourceGroup.min ?? NaN,
                max: sourceGroup.max ?? NaN,
                integer: false,
            }
        }
        const rule = runtimeRuleForField(buff, field)
        if (!rule) {
            return null
        }
        const source = rule.source ?? {}
        return {
            label: localizedText(source.label ?? rule.sourceLabel) || "来源数值",
            defaultValue: finiteOr(rule.type === "formula" ? source.defaultValue : rule.defaultSourceValue, 0),
            min: rule.type === "formula" ? Number(source.min) : NaN,
            max: rule.type === "formula" ? Number(source.max) : NaN,
            integer: false,
        }
    }

    const rule = runtimeRuleForField(buff, field)
    if (!rule) {
        return null
    }

    if (field.matches("[data-runtime-stacks]")) {
        const stackGroup = SharedCombat.runtimeStackGroupForKey(buff, field.dataset.runtimeStackGroup)
        if (stackGroup) {
            return {
                label: stackGroup.label,
                defaultValue: finiteOr(stackGroup.defaultStacks ?? stackGroup.maxStacks, 1),
                min: 0,
                max: finiteOr(stackGroup.maxStacks, 1),
                integer: true,
            }
        }
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

function setRuntimeValue(runtime, field, value, buff) {
    if (field.matches("[data-runtime-coverage]")) {
        runtime.coverage = value
        return
    }

    const id = field.dataset.runtimeEffect
    runtime.effects = runtime.effects ?? {}
    if (field.matches("[data-runtime-source-value]")) {
        const ruleIds = SharedCombat.runtimeSourceRuleIdsForGroup(buff, field.dataset.runtimeSourceGroup, id)
        for (const ruleId of ruleIds) {
            runtime.effects[ruleId] = runtime.effects[ruleId] ?? {}
            runtime.effects[ruleId].sourceValue = value
        }
    } else if (field.matches("[data-runtime-stacks]")) {
        const ruleIds = SharedCombat.runtimeStackRuleIdsForGroup(buff, field.dataset.runtimeStackGroup, id)
        for (const ruleId of ruleIds) {
            runtime.effects[ruleId] = runtime.effects[ruleId] ?? {}
            runtime.effects[ruleId].stacks = value
        }
    }
}

function updateRuntimeFieldValue(buffKey, field, value) {
    if (catalogCombatBuffIdFromKey(buffKey)) {
        updateCatalogCombatBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
        return
    }

    updateAddedCombatBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
}

function refreshAddedCombatBuffSummary(buffKey) {
    const catalogBuffId = catalogCombatBuffIdFromKey(buffKey)
    const item = catalogBuffId
        ? catalogCombatBuffRuntimeItem(displayCombatBuffs().find(buff => buff.id === catalogBuffId) ?? {})
        : addedCombatBuffByKey(buffKey)
    const row = els.combatSection.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
    const summary = row?.querySelector(".combat-added-stats")
    if (!item || !summary) {
        return
    }

    const buff = catalogBuffId
        ? displayCombatBuffs().find(candidate => candidate.id === catalogBuffId)
        : resolveAddedCombatBuff(item)
    if (!buff) {
        return
    }
    renderBuffEffectLines(summary, buff, runtimeForBuff(item, buff))
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
    const activeAddedBuffs = activeCombatBuffModalAddedBuffs()
    const addedKeys = new Set(activeAddedBuffs.map(addedCombatBuffKey))
    const isCustom = activeCombatBuffTab === "custom"
    const isAgent = activeCombatBuffTab === "agent"
    els.combatBuffCandidateList.hidden = isCustom
    els.combatBuffCustomPane.hidden = !isCustom
    els.combatBuffTeammatePicker.hidden = !isAgent || isCustom
    els.combatBuffModalEmpty.hidden = true
    updateCombatBuffModalSummary()

    for (const button of els.combatBuffModal.querySelectorAll("[data-combat-buff-tab]")) {
        button.classList.toggle("active", button.dataset.combatBuffTab === activeCombatBuffTab)
    }

    if (isCustom) {
        if (!els.customBuffStatRows.children.length) {
            renderCustomBuffStatRows([{ optionIndex: 0, value: 0 }])
        }
        return
    }

    if (isAgent) {
        renderCombatBuffTeammatePicker()
    }

    const candidates = combatBuffCandidates()
        .filter(candidate => !isAgent || candidate.ownerId === activeCombatBuffTeammateId)
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

    for (const candidate of candidates) {
        const key = addedCombatBuffKey(candidate)
        const alreadyAdded = addedKeys.has(key)
        const limitMessage = candidateLimitMessage(candidate, activeAddedBuffs)

        if (isAgent) {
            const row = document.createElement("label")
            row.className = [
                "combat-candidate-row",
                "combat-candidate-check-row",
                alreadyAdded ? "active" : "",
                limitMessage ? "disabled" : "",
            ].filter(Boolean).join(" ")

            const input = document.createElement("input")
            input.type = "checkbox"
            input.dataset.candidateCheckKey = key
            input.checked = alreadyAdded
            input.disabled = Boolean(limitMessage)

            const copy = document.createElement("span")
            copy.className = "combat-candidate-check-copy"

            const title = document.createElement("strong")
            title.textContent = combatBuffDisplayName(candidate)
            const metaLine = document.createElement("span")
            metaLine.textContent = `来自${localizedText(candidate.ownerName) || "角色"}`
            const description = document.createElement("p")
            description.textContent = localizedText(candidate.description) || localizedText(candidate.conditionLabel) || ""
            const stats = document.createElement("span")
            stats.className = "combat-added-stats combat-buff-effect-lines"
            if (limitMessage) {
                setCombatStatLines(stats, [limitMessage])
            } else {
                renderBuffEffectLines(stats, candidate)
            }

            copy.append(title, metaLine, description, stats)
            row.append(input, copy)
            els.combatBuffCandidateList.appendChild(row)
            continue
        }

        const row = document.createElement("button")
        row.type = "button"
        row.className = ["combat-candidate-row", alreadyAdded ? "active" : ""].filter(Boolean).join(" ")
        row.dataset.candidateKey = key
        row.dataset.candidateAdded = String(alreadyAdded)
        row.disabled = Boolean(limitMessage)

        const title = document.createElement("strong")
        title.textContent = nameOf(candidate)
        const description = document.createElement("p")
        description.textContent = localizedText(candidate.description) || localizedText(candidate.conditionLabel) || ""
        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        if (alreadyAdded) {
            setCombatStatLines(stats, ["已添加，点击移除"])
        } else if (limitMessage) {
            setCombatStatLines(stats, [limitMessage])
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
    combatBuffDraftAddedBuffs = cloneCombatBuffList(currentAddedCombatBuffs())
    els.combatBuffSearchInput.value = ""
    els.combatBuffModal.hidden = false
    document.body.classList.add("modal-open")
    renderCombatBuffCandidates()
}

function closeCombatBuffModal() {
    els.combatBuffModal.hidden = true
    document.body.classList.remove("modal-open")
    combatBuffDraftAddedBuffs = null
}

async function applyCombatBuffModalSelection() {
    if (!combatBuffDraftAddedBuffs || !combatBuffDraftChanged()) {
        closeCombatBuffModal()
        return
    }
    setStatus("应用 Buff 选择", "idle")
    saveCurrentAddedCombatBuffs(combatBuffDraftAddedBuffs)
    closeCombatBuffModal()
    renderCombatBuffControls()
    await calculate()
}

function addCombatBuffCandidateByKey(key) {
    const candidate = allCombatBuffCandidates().find(item => addedCombatBuffKey(item) === key)
    if (!candidate) {
        return false
    }

    const addedBuffs = activeCombatBuffModalAddedBuffs()
    if (addedBuffs.some(item => addedCombatBuffKey(item) === key)) {
        return false
    }

    const limitMessage = candidateLimitMessage(candidate, addedBuffs)
    if (limitMessage) {
        setStatus(limitMessage, "error")
        return false
    }

    setCombatBuffDraftAddedBuffs([...addedBuffs, addedCombatBuffEntry(candidate)])
    return true
}

function removeCombatBuffCandidateByKey(key) {
    const addedBuffs = activeCombatBuffModalAddedBuffs()
    const next = addedBuffs.filter(item => addedCombatBuffKey(item) !== key)
    if (next.length === addedBuffs.length) {
        return false
    }
    setCombatBuffDraftAddedBuffs(next)
    return true
}

function addSelectedTeammateBuffs() {
    const candidates = selectedTeammateBuffCandidates()
    if (!candidates.length) {
        return false
    }
    const addedBuffs = activeCombatBuffModalAddedBuffs()
    const firstNewCandidate = candidates.find(candidate =>
        !addedBuffs.some(item => addedCombatBuffKey(item) === addedCombatBuffKey(candidate))
    )
    const limitMessage = candidateLimitMessage(firstNewCandidate, addedBuffs)
    if (limitMessage) {
        setStatus(limitMessage, "error")
        return false
    }
    const addedKeys = new Set(addedBuffs.map(addedCombatBuffKey))
    const nextEntries = candidates
        .filter(candidate => !addedKeys.has(addedCombatBuffKey(candidate)))
        .map(addedCombatBuffEntry)
    if (!nextEntries.length) {
        setStatus("该角色 Buff 已全部添加", "idle")
        return false
    }
    setCombatBuffDraftAddedBuffs([...addedBuffs, ...nextEntries])
    return true
}

function removeSelectedTeammateBuffs() {
    const ownerId = activeCombatBuffTeammateId
    if (!ownerId) {
        return false
    }
    const addedBuffs = activeCombatBuffModalAddedBuffs()
    const next = addedBuffs.filter(item => teammateOwnerIdForBuff(item) !== ownerId)
    if (next.length === addedBuffs.length) {
        return false
    }
    setCombatBuffDraftAddedBuffs(next)
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

function renderCombatBuffControls() {
    if (!meta || !els.combatSection) {
        return
    }

    const { checkedIds, useDefaultChecked } = activeCombatBuffIdsForRender()
    const selfBuffs = [
        ...agentCombatBuffs(),
        ...combatBuffsByType("self"),
    ]

    renderCombatCheckboxList(els.selfCombatBuffs, selfBuffs, checkedIds, { useDefaultChecked })
    renderCombatCheckboxList(els.driveDiscCombatBuffs, ownDriveDisc4pcBuffs(), checkedIds, { useDefaultChecked })
    renderCombatCheckboxList(els.wEngineCombatBuffs, wEngineEquippedBuffs(), checkedIds, { useDefaultChecked })
    renderAddedCombatBuffs()
    renderCatalogCombatBuffCards(els.bossCombatBuffs, combatBuffsByType("boss"), checkedIds)
    renderCatalogCombatBuffCards(els.fieldCombatBuffs, combatBuffsByType("field"), checkedIds)
    renderedCombatBuffAgentId = els.agentSelect?.value ?? ""
}

function collectManualStats() {
    return currentAddedCombatBuffs()
        .filter(item => item.sourceKind === "custom")
        .flatMap(item => (item.stats ?? []).map((stat, index) => ({
            id: `${item.id}.${stat.id ?? index + 1}`,
            label: `${item.name || "自定义 Buff"}｜${stat.label ?? statLabel(stat.stat)}`,
            stat: stat.stat,
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
    const addedBuffs = currentAddedCombatBuffs()
    const activeBuffIds = [...checkedCombatBuffIds()]
    const runtimeInputs = {}
    const wEngineTeamModificationLevels = {}
    for (const item of addedBuffs) {
        if (item.sourceKind === "teammate") {
            const buff = resolveAddedCombatBuff(item)
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = runtimeForBuff(item, buff)
        }

        if (item.sourceKind === "ownDriveDisc4pc") {
            const buff = resolveAddedCombatBuff(item)
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = runtimeForBuff(item, buff)
        }

        if (item.sourceKind === "wEngineTeam") {
            const buff = resolveAddedCombatBuff(item)
            activeBuffIds.push(item.id)
            wEngineTeamModificationLevels[item.id] = wEngineTeamModificationLevelForItem(item)
            runtimeInputs[item.id] = runtimeForBuff(item, buff)
        }

        if (item.sourceKind === "teammateDriveDisc4pc") {
            const buff = resolveAddedCombatBuff(item)
            runtimeInputs[`teammateDriveDisc4pc:${item.setId}`] = runtimeForBuff(item, buff)
        }
    }
    for (const buff of [...combatBuffsByType("boss"), ...combatBuffsByType("field")]) {
        if (activeBuffIds.includes(buff.id)) {
            const item = catalogCombatBuffRuntimeItem(buff)
            runtimeInputs[buff.id] = runtimeForBuff(item, buff)
        }
    }

    return {
        activeBuffIds,
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
    persistCurrentDamageResistanceInput()
    const damageElement = currentDamageElement()
    const resolvedSkill = resolveDamageSkillRef(selectedDamageSkillRef)
    const eventType = els.damageEventType?.value || "direct"
    const agentLevel = Number(els.agentLevelInput?.value || 60)
    const target = {
        presetId: els.damageTargetPreset?.value || DEFAULT_DAMAGE_TARGET_PRESET_ID,
        defense: selectedDamageTargetDefense(),
        levelCoefficient: DEFAULT_DAMAGE_LEVEL_COEFFICIENT,
        stunned: Boolean(els.damageTargetStunned?.checked),
        stunMultiplierPercent: Number(els.damageTargetStunMultiplier?.value ?? DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT),
        resistanceByElement: {
            ...damageTargetResistanceByElement,
            [damageElement]: damageResistanceControlValue(),
        },
    }
    if (eventType === "anomaly") {
        const anomalyEffect = els.damageAnomalyEffect?.value || "assault"
        return {
            agentLevel,
            skillLevelsByCategory: { ...damageSkillLevelsByCategory },
            selectedEventId: "anomaly-1",
            events: [
                {
                    id: "anomaly-1",
                    kind: "anomaly",
                    anomalyEffect,
                    procCount: Number(els.damageAnomalyProcCount?.value || DEFAULT_ANOMALY_PROC_COUNTS[anomalyEffect] || 1),
                },
            ],
            target,
        }
    }
    if (eventType === "disorder") {
        return {
            agentLevel,
            skillLevelsByCategory: { ...damageSkillLevelsByCategory },
            selectedEventId: "disorder-1",
            events: [
                {
                    id: "disorder-1",
                    kind: "disorder",
                    disorderType: normalizeDisorderType(els.damageDisorderType?.value),
                    previousAnomalyEffect: els.damageDisorderEffect?.value || "burn",
                    elapsedSeconds: Number(els.damageDisorderElapsed?.value || 0),
                },
            ],
            target,
        }
    }
    const directEvent = {
        id: eventType === "sheer" ? "sheer-1" : "direct-1",
        kind: eventType === "sheer" ? "sheer" : "direct",
        skillMultiplier: Number(els.damageSkillMultiplier?.value ?? 100),
        ...(resolvedSkill ? { skillRef: resolvedSkill.ref } : {}),
        critMode: els.damageCritMode?.value ?? "expected",
    }
    return {
        agentLevel,
        skillMultiplier: Number(els.damageSkillMultiplier?.value ?? 100),
        skillLevelsByCategory: { ...damageSkillLevelsByCategory },
        ...(resolvedSkill ? { skillRef: resolvedSkill.ref } : {}),
        critMode: els.damageCritMode?.value ?? "expected",
        selectedEventId: directEvent.id,
        events: [directEvent],
        target,
    }
}

function combatSourceLabel(sourceType) {
    const labels = {
        self: "自身",
        wEngine: "音擎",
        wEngineTeam: "音擎(团队)",
        teammate: "队友",
        driveDisc4pc: "驱动盘",
        driveDisc4pcTeam: "驱动盘(团队)",
        boss: "Boss",
        field: "场地",
        manual: "自定义",
    }
    return labels[sourceType] ?? sourceType ?? "局内"
}

function activeEffectDisplayText(item) {
    const effects = Array.isArray(item?.effects) ? item.effects : []
    if (!effects.some(rule => rule.displayValue !== undefined || rule.displayValuePerStack !== undefined)) {
        return ""
    }

    const effect = {
        effects,
        coverage: item.coverage ?? null,
    }
    return storedEffectRulesText(effect, item.runtime ?? defaultRuntimeForBuff(effect))
}

function combatEffectText(item) {
    const label = item?.name ? nameOf(item) : effectLabel(item.key)
    const stats = activeEffectDisplayText(item) || effectStatText(item.resolvedStats?.length ? item.resolvedStats : item.stats)
    const modifiers = (item.resolvedDamageModifiers ?? [])
        .map(modifier => `${damageModifierOptionText(modifier)} +${formatStoredStatValue("dmgBonus", Number(modifier.value ?? 0) * 100)}`)
        .join("，")
    const conditionLabel = localizedText(item.conditionLabel) || item.conditionLabel
    const condition = conditionLabel ? ` · ${conditionLabel}` : ""
    const detail = [stats, modifiers].filter(Boolean).join("，")
    return `${combatSourceLabel(item.sourceType)}｜${label}${detail ? `：${detail}` : ""}${condition}`
}

function renderDamageWhiteBox(damage) {
    if (!els.damageWhiteBoxRows || !els.damageFinalValue) {
        return
    }

    if (!damage) {
        els.damageFinalValue.textContent = "-"
        if (els.heroDamageValue) {
            els.heroDamageValue.textContent = "-"
        }
        if (els.heroDamageSummary) {
            els.heroDamageSummary.textContent = "等待计算"
        }
        renderList(els.damageWhiteBoxRows, [])
        return
    }

    const finalDamageText = formatValue(damage.finalDamage ?? 0, "damage")
    els.damageFinalValue.textContent = finalDamageText
    if (els.heroDamageValue) {
        els.heroDamageValue.textContent = finalDamageText
    }
    if (els.heroDamageSummary) {
        els.heroDamageSummary.textContent = `${damageEventTypeLabel(els.damageEventType?.value)} · ${els.damageCritMode?.value === "crit" ? "暴击" : els.damageCritMode?.value === "nonCrit" ? "非暴击" : "期望"}`
    }
    els.damageWhiteBoxRows.innerHTML = ""

    for (const rowData of damage.whiteBoxRows ?? []) {
        const row = document.createElement("div")
        row.className = "damage-whitebox-row"
        const formulaHtml = Array.isArray(rowData.formulaLines) && rowData.formulaLines.length
            ? rowData.formulaLines.map(line => `<span>${escapeHtml(line)}</span>`).join("")
            : `<span>${escapeHtml(rowData.formula ?? "")}</span>`
        row.innerHTML = `
            <div>
              <strong>${escapeHtml(rowData.label ?? "-")}</strong>
              ${formulaHtml}
            </div>
            <strong>${escapeHtml(rowData.displayValue ?? formatValue(rowData.value ?? 0))}</strong>
        `
        els.damageWhiteBoxRows.appendChild(row)
    }
}

function renderInCombatResult(inCombat) {
    const inCombatPanelOrder = panelOrderForCurrentAgent()
    if (!inCombat) {
        renderOrderedKV(els.inCombatPanelTable, {}, inCombatPanelOrder)
        renderOrderedKV(els.inCombatBonusTable, {}, COMBAT_BONUS_ORDER)
        renderList(els.inCombatActiveEffects, [])
        return
    }

    renderOrderedKV(els.inCombatPanelTable, inCombat.panel, inCombatPanelOrder, {
        highlightedKeys: inCombatHighlightKeys(),
    })
    renderOrderedKV(els.inCombatBonusTable, inCombat.buffTotals, COMBAT_BONUS_ORDER)
    renderList(els.inCombatActiveEffects, (inCombat.activeEffects ?? []).map(combatEffectText), "good")
}

function renderDiscGrid(discs) {
    els.discGrid.innerHTML = ""
    const byPartition = new Map(discs.map(disc => [disc.partition, disc]))

    for (let slot = 1; slot <= 6; slot += 1) {
        const disc = byPartition.get(slot)
        const set = disc ? driveDiscSetForDisc(disc) : null
        const subStats = (disc?.subStats ?? [])
            .map(item => `${storedStatLabel(item.stat, item.mode)} ${formatStoredStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
            .join(" / ")

        const card = document.createElement("button")
        card.type = "button"
        card.className = disc ? "disc-card filled" : "disc-card empty-slot"
        card.dataset.slot = String(slot)
        card.innerHTML = `
            <div class="disc-art">
                <img src="${driveDiscIcon(set)}" alt="">
                ${disc ? "" : "<span>+</span>"}
            </div>
            <div class="disc-copy">
                <div class="disc-slot">${slot}号位</div>
                <div class="disc-set">${disc ? (disc.setName || nameOf(set)) : "未装备"}</div>
                <div class="disc-main">${disc ? `${storedStatLabel(disc.mainStat.stat, disc.mainStat.mode)} ${formatStoredStatValue(disc.mainStat.stat, disc.mainStat.value, { percentMode: disc.mainStat.mode === "pct" })}` : "添加驱动盘"}</div>
                <div class="disc-sub">${subStats || "前往仓库选择或新增"}</div>
            </div>
        `
        els.discGrid.appendChild(card)
    }

    els.heroDiscCount.textContent = `${discs.length} 件`
}

function populateSelect(select, items, selectedId) {
    select.innerHTML = ""
    for (const item of items) {
        const option = document.createElement("option")
        option.value = item.id
        option.textContent = nameOf(item)
        if (item.id === selectedId) {
            option.selected = true
        }
        select.appendChild(option)
    }
}

function orderedWEnginesForAgent(agentId = els.agentSelect?.value) {
    return SharedCombat.sortWEnginesForAgent(displayWEngines(), getAgent(agentId))
}

function populateWEngineSelect(selectedId = els.wEngineSelect?.value, agentId = els.agentSelect?.value) {
    const items = orderedWEnginesForAgent(agentId)
    populateSelect(els.wEngineSelect, items, selectedId)
    createImageSelect({
        select: els.wEngineSelect,
        items,
        selectedId: els.wEngineSelect.value,
        getLabel: nameOf,
        getImage: item => imageOf(item, "wEngine"),
        getFallbackImage: item => fallbackImageSvg(item, "wEngine"),
        className: "w-engine-image-select",
    })
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

async function loadMeta() {
    const response = await loadCatalog()
    meta = response
    populateSelect(els.agentSelect, displayAgents(), displayAgents()[0]?.id)
    populateWEngineSelect(displayWEngines()[0]?.id, els.agentSelect.value)
    populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), 1)
    populateDamageTargetPresets()
    populateDamageEventSelects()
    syncDamageResistanceControlsToAgent()
}

async function loadUserDriveDiscStore() {
    userDriveDiscStore = await loadCurrentUserDriveDiscStore()
}

function applySelectionForAgent(agentId) {
    const agent = getAgent(agentId)
    const config = configForAgent(agentId)
    const wEngineId = defaultWEngineIdForAgent(agentId, config.wEngineId)

    els.agentSelect.value = agentId
    populateWEngineSelect(wEngineId, agentId)
    populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), config.wEngineModificationLevel)
    populateCoreSkillSelect(agent, validCoreSkillLevel(agent, config.coreSkillLevel))
    populateCinemaLevelSelect(cinemaLevelForAgent(agentId))
    applyStoredDamageConfig(config.damage)
    renderHomeLoadoutSelect(agentId)
    setHomeDiscMode(selectedDiscModeForAgent(agentId))
    loadEquippedDriveDiscsForSelectedAgent()
}

function restoreHomeSelection() {
    const selection = loadHomeSelection()
    const agentId = validAgentId(selection.currentAgentId)
    applySelectionForAgent(agentId)
    saveCurrentHomeSelection({ mode: selectedDiscModeForAgent(agentId) })
}

function loadEquippedDriveDiscsForSelectedAgent() {
    const discs = selectedDriveDiscsForAgent(els.agentSelect.value)
    setDriveDiscInput(discs)
    renderDiscPicker(els.agentSelect.value)
    renderCurrentSelection()
    return discs
}

function parseDriveDiscs() {
    return JSON.parse(els.driveDiscInput.value || "[]")
}

function renderCurrentSelection({ refreshCombatBuffControls = true } = {}) {
    const agent = getAgent(els.agentSelect.value)
    const wEngine = currentWEngineWithModification()
    const coreSkillLevel = populateCoreSkillSelect(agent, els.coreSkillSelect.value)
    const discs = (() => {
        try {
            return parseDriveDiscs()
        } catch {
            return []
        }
    })()

    els.heroAgentName.textContent = nameOf(agent)
    els.heroWEngineName.textContent = nameOf(wEngine)
    setEntityImage(els.heroAgentImage, agent, "agent")
    setEntityImage(els.agentImage, agent, "agent")
    setEntityImage(els.wEngineImage, wEngine, "wEngine")
    renderAgentMeta(agent, coreSkillLevel)
    populateCinemaLevelSelect(selectedCinemaLevel())
    renderAgentSkillLevelControls()
    renderWEngineMeta(wEngine)
    renderWEngineEffect(wEngine)
    renderDiscPicker(agent?.id)
    renderHomeLoadoutSelect(agent?.id)
    renderDiscGrid(discs)
    syncDamageResistanceControlsToAgent()
    if (refreshCombatBuffControls) {
        renderCombatBuffControls()
    }
}

for (const img of [els.heroAgentImage, els.agentImage, els.wEngineImage]) {
    img.addEventListener("error", () => {
        if (img.dataset.fallbackSrc && img.src !== img.dataset.fallbackSrc) {
            img.src = img.dataset.fallbackSrc
        }
    })
}

function renderCalculationResult(data) {
    const outOfCombat = data.outOfCombat ?? data
    const inCombat = data.inCombat ?? null
    const damage = data.damage ?? null

    renderOrderedKV(els.baseTable, outOfCombat.base, BASE_ORDER)
    renderOrderedKV(els.bonusTable, outOfCombat.panel, panelOrderForCurrentAgent({ includeDmgBonus: false }), {
        highlightedKeys: outOfCombatHighlightKeys(),
        highlightClass: `highlight-${els.agentSelect.value}`,
    })
    renderInCombatResult(inCombat)
    renderDamageWhiteBox(damage)
    renderAtkBreakdown(outOfCombat, inCombat)
    els.rawResult.textContent = JSON.stringify(data, null, 2)
}

function setupCollapsibleCards() {
    for (const card of document.querySelectorAll(".collapsible-card")) {
        const head = card.querySelector(".card-head")
        const body = card.querySelector(".collapsible-body")
        if (!head || !body) {
            continue
        }

        head.setAttribute("role", "button")
        head.setAttribute("tabindex", "0")
        head.setAttribute("aria-expanded", String(!card.classList.contains("collapsed")))
        head.addEventListener("click", () => {
            const collapsed = card.classList.toggle("collapsed")
            head.setAttribute("aria-expanded", String(!collapsed))
        })
        head.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") {
                return
            }
            event.preventDefault()
            head.click()
        })
    }
}

async function calculate({ refreshSelection = true, refreshCombatBuffControls = true } = {}) {
    const driveDiscs = parseDriveDiscs()
    const agent = getAgent(els.agentSelect.value)
    const coreSkillLevel = populateCoreSkillSelect(agent, els.coreSkillSelect.value)
    if (refreshSelection) {
        saveCurrentHomeSelection()
        renderCurrentSelection({ refreshCombatBuffControls })
    }
    const payload = {
        agentId: els.agentSelect.value,
        coreSkillLevel,
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        driveDiscs,
        combatBuffs: collectCombatBuffConfig(),
        damage: collectDamageConfig(),
    }

    renderCalculationResult(calculateInCombatPanel(meta, payload))
    setStatus("就绪", "success")
}

function collectDriveDiscAnalysisPayload() {
    const agent = getAgent(els.agentSelect.value)
    return {
        objective: "damage",
        agentId: els.agentSelect.value,
        coreSkillLevel: validCoreSkillLevel(agent, els.coreSkillSelect.value),
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        driveDiscs: parseDriveDiscs(),
        combatBuffs: collectCombatBuffConfig(),
        damage: collectDamageConfig(),
    }
}

function clearScheduledCalculate() {
    if (calculateDebounceTimer) {
        clearTimeout(calculateDebounceTimer)
        calculateDebounceTimer = null
    }
}

async function calculateNow(status = "计算中", options = {}) {
    clearScheduledCalculate()
    try {
        setStatus(status, "idle")
        await calculate(options)
    } catch (error) {
        setStatus(error.message, "error")
    }
}

function scheduleCalculate(status = "计算中", options = {}) {
    clearScheduledCalculate()
    setStatus(status, "idle")
    calculateDebounceTimer = setTimeout(async () => {
        calculateDebounceTimer = null
        try {
            await calculate(options)
        } catch (error) {
            setStatus(error.message, "error")
        }
    }, CALCULATE_DEBOUNCE_MS)
}

function inputLabel(input) {
    return input.closest("label")?.querySelector("span")?.textContent?.trim()
        || input.closest(".field")?.querySelector("span")?.textContent?.trim()
        || input.getAttribute("aria-label")
        || "输入值"
}

function genericNumberConfig(input) {
    return {
        label: inputLabel(input),
        defaultValue: finiteOr(input.defaultValue, 0),
        min: input.min !== "" ? Number(input.min) : NaN,
        max: input.max !== "" ? Number(input.max) : NaN,
        integer: false,
    }
}

async function commitGenericNumberInput(input) {
    const value = inputNumberValue(input)
    const config = genericNumberConfig(input)
    const message = validateNumberInputValue(value, config)
    if (message) {
        input.value = formatInputNumber(config.defaultValue)
        if (input === els.damageTargetResistance) {
            persistCurrentDamageResistanceInput()
            syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
        }
        await calculateNow("计算中", { refreshSelection: false })
        setStatus(message, "error")
        return false
    }

    if (input === els.damageTargetResistance) {
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
    }
    await calculateNow("计算中", { refreshSelection: false })
    return true
}

function runtimeFieldContext(field) {
    const group = field.closest("[data-buff-key]")
    const buffKey = group?.dataset.buffKey
    const catalogBuffId = catalogCombatBuffIdFromKey(buffKey)
    if (catalogBuffId) {
        const buff = displayCombatBuffs().find(item => item.id === catalogBuffId)
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
        await calculateNow("计算中", { refreshSelection: false })
        setStatus(message, "error")
        return false
    }

    updateRuntimeFieldValue(buffKey, field, value)
    refreshAddedCombatBuffSummary(buffKey)
    await calculateNow("计算中", { refreshSelection: false })
    return true
}

setupCollapsibleCards()

els.agentSelect.addEventListener("change", async () => {
    try {
        setStatus("载入角色装备", "idle")
        persistCurrentDamageResistanceInput()
        applySelectionForAgent(validAgentId(els.agentSelect.value))
        saveCurrentHomeSelection()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.wEngineSelect.addEventListener("change", async () => {
    try {
        setStatus("计算中", "idle")
        populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), els.wEngineModificationSelect?.value ?? 1)
        saveCurrentHomeSelection()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.wEngineModificationSelect?.addEventListener("change", async () => {
    try {
        setStatus("计算中", "idle")
        saveCurrentHomeSelection()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.coreSkillSelect.addEventListener("change", async () => {
    try {
        setStatus("计算中", "idle")
        saveCurrentHomeSelection()
        renderAgentSkillLevelControls()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.cinemaLevelSelect?.addEventListener("change", async () => {
    try {
        setStatus("计算中", "idle")
        saveCurrentHomeSelection()
        renderCombatBuffControls()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.agentLevelInput?.addEventListener("change", async () => {
    try {
        setStatus("计算中", "idle")
        saveCurrentHomeSelection()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.agentLevelInput?.addEventListener("input", () => {
    saveCurrentHomeSelection()
    scheduleCalculate("计算中", { refreshSelection: false })
})
for (const { categoryId, select } of skillLevelSelects()) {
    select.addEventListener("change", async () => {
        try {
            setStatus("计算中", "idle")
            damageSkillLevelsByCategory[categoryId] = Number(select.value)
            renderDamageSkillSummary()
            saveCurrentHomeSelection()
            await calculate()
        } catch (error) {
            setStatus(error.message, "error")
        }
    })
}
els.driveDiscInput.addEventListener("input", renderCurrentSelection)
initDriveDiscAnalysis({
    substatButton: els.driveDiscSubstatAnalysisBtn,
    gainButton: els.driveDiscStatGainBtn,
    getCatalog: () => meta,
    getPayload: collectDriveDiscAnalysisPayload,
    setStatus,
    statLabel,
    formatStoredValue: (stat, value, mode) => formatStoredStatValue(stat, value, { percentMode: mode === "pct", mode }),
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

    if (!event.target.matches("input[data-combat-buff-id], select") && event.target !== els.damageTargetStunned) {
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
        if (event.target === els.damageEventType) {
            renderDamageEventControls()
        }
        if (event.target === els.damageAnomalyEffect) {
            els.damageAnomalyProcCount.value = event.target.selectedOptions?.[0]?.dataset.defaultProcCount ?? 1
        }
        await calculateNow()
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
        await calculateNow()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.combatSection.addEventListener("input", async event => {
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
            scheduleCalculate("计算中", { refreshSelection: false })
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    if (els.addedCombatBuffs.contains(event.target)) {
        return
    }

    if (!event.target.matches("input[type='number']")) {
        return
    }

    try {
        const value = inputNumberValue(event.target)
        if (value === null || !Number.isFinite(value)) {
            return
        }
        if (event.target === els.damageTargetResistance) {
            persistCurrentDamageResistanceInput()
            syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
        }
        if (event.target === els.damageSkillMultiplier) {
            selectedDamageSkillRef = null
            renderDamageSkillSummary()
        }
        scheduleCalculate("计算中", { refreshSelection: false })
    } catch (error) {
        setStatus(error.message, "error")
    }
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
    const removeGroup = event.target.closest("[data-remove-buff-group-key]")
    if (removeGroup) {
        try {
            setStatus("移除来源 Buff", "idle")
            saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().filter(item =>
                addedCombatBuffSourceGroupKey(item) !== removeGroup.dataset.removeBuffGroupKey
            ))
            renderCombatBuffControls()
            await calculate()
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    const remove = event.target.closest("[data-remove-buff-key]")
    if (!remove) {
        return
    }

    try {
        setStatus("移除 Buff", "idle")
        saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().filter(item => addedCombatBuffKey(item) !== remove.dataset.removeBuffKey))
        renderCombatBuffControls()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.addedCombatBuffs.addEventListener("input", async event => {
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
        scheduleCalculate("计算中", { refreshSelection: false })
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
            setStatus("更新音擎改装等级", "idle")
            updateAddedCombatBuffModificationLevel(group.dataset.buffKey, modificationSelect.value)
            renderCombatBuffControls()
            await calculate()
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    const runtimeField = event.target.closest("[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]")
    if (!runtimeField) {
        return
    }

    await commitRuntimeField(runtimeField)
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
els.damageSkillSearchInput?.addEventListener("input", event => {
    damageSkillSearchQuery = event.target.value
    renderDamageSkillModal()
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
        await calculateNow()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.openCombatBuffModalBtn.addEventListener("click", () => openCombatBuffModal())
els.closeCombatBuffModalBtn.addEventListener("click", closeCombatBuffModal)
els.cancelCombatBuffModalBtn?.addEventListener("click", closeCombatBuffModal)
els.applyCombatBuffModalBtn?.addEventListener("click", async () => {
    try {
        await applyCombatBuffModalSelection()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
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

    if (event.target === els.addTeammateBuffsBtn) {
        try {
            if (addSelectedTeammateBuffs()) {
                renderCombatBuffCandidates()
                setStatus("已加入本次选择", "idle")
            }
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    if (event.target === els.removeTeammateBuffsBtn) {
        try {
            if (removeSelectedTeammateBuffs()) {
                renderCombatBuffCandidates()
                setStatus("已从本次选择移除", "idle")
            }
        } catch (error) {
            setStatus(error.message, "error")
        }
        return
    }

    const candidate = event.target.closest("[data-candidate-key]")
    if (candidate && !candidate.disabled) {
        try {
            const alreadyAdded = candidate.dataset.candidateAdded === "true"
            const changed = alreadyAdded
                ? removeCombatBuffCandidateByKey(candidate.dataset.candidateKey)
                : addCombatBuffCandidateByKey(candidate.dataset.candidateKey)
            if (changed) {
                renderCombatBuffCandidates()
                setStatus(alreadyAdded ? "已从本次选择移除" : "已加入本次选择", "idle")
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
    if (event.target === els.combatBuffTeammateSelect) {
        activeCombatBuffTeammateId = event.target.value
        renderCombatBuffCandidates()
        return
    }

    if (event.target.matches("[data-candidate-check-key]")) {
        ;(async () => {
            try {
                const changed = event.target.checked
                    ? addCombatBuffCandidateByKey(event.target.dataset.candidateCheckKey)
                    : removeCombatBuffCandidateByKey(event.target.dataset.candidateCheckKey)
                if (changed) {
                    renderCombatBuffCandidates()
                    setStatus(event.target.checked ? "已加入本次选择" : "已从本次选择移除", "idle")
                } else {
                    renderCombatBuffCandidates()
                }
            } catch (error) {
                setStatus(error.message, "error")
            }
        })()
        return
    }

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

        setStatus("添加自定义 Buff 到本次选择", "idle")
        setCombatBuffDraftAddedBuffs([
            ...activeCombatBuffModalAddedBuffs(),
            {
                id: `custom-${Date.now()}`,
                sourceCategory: "custom",
                sourceKind: "custom",
                name: els.customBuffNameInput.value.trim() || "自定义 Buff",
                stats,
                effects,
            },
        ])
        renderCustomBuffStatRows([{ optionIndex: 0, value: 0 }])
        renderCombatBuffCandidates()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
document.addEventListener("keydown", event => {
    if (event.key !== "Escape") {
        return
    }
    if (els.combatBuffModal && !els.combatBuffModal.hidden) {
        event.preventDefault()
        closeCombatBuffModal()
    }
})
els.discGrid.addEventListener("click", event => {
    const card = event.target.closest(".disc-card[data-slot]")
    if (card) {
        if (currentHomeDiscMode() === "loadout") {
            setStatus("切换到自选后可编辑单件驱动盘", "idle")
            return
        }
        openHomeDiscModal(card.dataset.slot)
    }
})
els.discPicker.addEventListener("change", async event => {
    if (!event.target.matches("select[data-slot]")) {
        return
    }

    try {
        setStatus("保存驱动盘选择", "idle")
        saveCurrentHomeSelection({ mode: "manual", manualDriveDiscIdsBySlot: selectedDiscIdsFromPicker() })
        setHomeDiscMode("manual")
        loadEquippedDriveDiscsForSelectedAgent()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.manualDiscModeBtn?.addEventListener("click", async () => {
    try {
        setStatus("切换到自选", "idle")
        await switchHomeDiscMode("manual")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.loadoutDiscModeBtn?.addEventListener("click", async () => {
    try {
        setStatus("切换到套装", "idle")
        await switchHomeDiscMode("loadout")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.homeLoadoutSelect?.addEventListener("change", async () => {
    try {
        const selectedLoadout = driveDiscLoadoutsForAgent(validAgentId(els.agentSelect.value))
            .find(loadout => loadout.id === els.homeLoadoutSelect.value)
        if (selectedLoadout && !loadoutIsComplete(selectedLoadout)) {
            throw new Error("该套装缺少驱动盘槽位，请先在驱动盘页修复。")
        }
        setStatus("切换套装", "idle")
        setHomeDiscMode("loadout")
        saveCurrentHomeSelection({
            mode: "loadout",
            selectedLoadoutId: els.homeLoadoutSelect.value,
        })
        loadEquippedDriveDiscsForSelectedAgent()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})

els.closeHomeDiscModalBtn.addEventListener("click", closeHomeDiscModal)
els.homeDiscModal.addEventListener("click", event => {
    if (event.target.matches("[data-close-home-disc-modal]")) {
        closeHomeDiscModal()
    }
})
els.homeDiscOptionList.addEventListener("click", async event => {
    const option = event.target.closest(".home-disc-option[data-disc-id]")
    if (!option) {
        return
    }

    try {
        setStatus("保存驱动盘选择", "idle")
        await selectHomeDisc(option.dataset.discId)
        setStatus("就绪", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.clearSlotDiscBtn.addEventListener("click", async () => {
    try {
        setStatus("卸下驱动盘", "idle")
        await clearHomeDiscSlot()
        setStatus("就绪", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
for (const input of [els.homeDiscSetFilter, els.homeDiscMainStatFilter, els.homeDiscSearchInput]) {
    input.addEventListener("input", renderHomeDiscOptions)
    input.addEventListener("change", renderHomeDiscOptions)
}

els.calculateBtn.addEventListener("click", async () => {
    try {
        setStatus("计算中", "idle")
        saveCurrentHomeSelection()
        await calculate()
        document.getElementById("damage-whitebox-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        })
    } catch (error) {
        setStatus(error.message, "error")
    }
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        await loadMeta()
        await loadUserDriveDiscStore()
        restoreHomeSelection()
        await calculate()
    } catch (error) {
        const message = errorMessage(error)
        setStatus("加载失败", "error")
        showErrorNotice({
            title: "首页加载失败",
            message,
        })
        console.error(error)
    }
}

bootstrap()
