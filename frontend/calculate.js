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
import { promptDialog } from "./dialogs.js"
import { clearPageNotice, setStatusChip, showErrorNotice, showSuccessNotice } from "./feedback.js"
import { initDriveDiscAnalysis } from "./drive-disc-analysis.js"
import { loadCatalog } from "./catalog-loader.js"
import { calculateInCombatPanel } from "./calculator-core.js"
import { loadCurrentUserDriveDiscStore, upsertDriveDiscLoadout } from "./local-store.js"
import {
    calculationSkillGroups,
    defaultSkillGroupReferenceEvent,
    hasCalculationSkillGroups,
    normalizeSkillGroupReferenceEvent,
    skillGroupById,
    skillGroupCountLimits,
} from "./calculationSkillGroups.js"

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
    cancelCombatBuffModalBtn: document.getElementById("cancelCombatBuffModalBtn"),
    applyCombatBuffModalBtn: document.getElementById("applyCombatBuffModalBtn"),
    combatBuffModalSummary: document.getElementById("combatBuffModalSummary"),
    combatBuffSearchInput: document.getElementById("combatBuffSearchInput"),
    combatBuffTeammatePicker: document.getElementById("combatBuffTeammatePicker"),
    combatBuffTeammateSelect: document.getElementById("combatBuffTeammateSelect"),
    combatBuffTeammatePreview: document.getElementById("combatBuffTeammatePreview"),
    combatBuffTeammateHint: document.getElementById("combatBuffTeammateHint"),
    addTeammateBuffsBtn: document.getElementById("addTeammateBuffsBtn"),
    removeTeammateBuffsBtn: document.getElementById("removeTeammateBuffsBtn"),
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
    damageTargetStunned: document.getElementById("damageTargetStunned"),
    damageTargetStunMultiplier: document.getElementById("damageTargetStunMultiplier"),
    damageTargetResistancePreset: document.getElementById("damageTargetResistancePreset"),
    damageTargetResistanceLabel: document.getElementById("damageTargetResistanceLabel"),
    damageTargetResistanceCustom: document.getElementById("damageTargetResistanceCustom"),
    damageTargetResistance: document.getElementById("damageTargetResistance"),
    damageSkillMultiplier: document.getElementById("damageSkillMultiplier"),
    openDamageSkillModalBtn: document.getElementById("openDamageSkillModalBtn"),
    damageSkillSummary: document.getElementById("damageSkillSummary"),
    damageSkillModal: document.getElementById("damageSkillModal"),
    closeDamageSkillModalBtn: document.getElementById("closeDamageSkillModalBtn"),
    damageSkillSearchInput: document.getElementById("damageSkillSearchInput"),
    damageSkillModalList: document.getElementById("damageSkillModalList"),
    damageSkillModalEmpty: document.getElementById("damageSkillModalEmpty"),
    damageCritMode: document.getElementById("damageCritMode"),
    damageAnomalySettlementType: document.getElementById("damageAnomalySettlementType"),
    damageAnomalyEffect: document.getElementById("damageAnomalyEffect"),
    damageAnomalyProcCount: document.getElementById("damageAnomalyProcCount"),
    damageDisorderType: document.getElementById("damageDisorderType"),
    damageDisorderEffect: document.getElementById("damageDisorderEffect"),
    damageDisorderElapsed: document.getElementById("damageDisorderElapsed"),
    algorithmSelect: document.getElementById("algorithmSelect"),
    fourPieceSetSelect: document.getElementById("fourPieceSetSelect"),
    openFourPieceSetModalBtn: document.getElementById("openFourPieceSetModalBtn"),
    fourPieceSelectedSummary: document.getElementById("fourPieceSelectedSummary"),
    fourPieceSetModal: document.getElementById("fourPieceSetModal"),
    closeFourPieceSetModalBtn: document.getElementById("closeFourPieceSetModalBtn"),
    cancelFourPieceSetModalBtn: document.getElementById("cancelFourPieceSetModalBtn"),
    applyFourPieceSetModalBtn: document.getElementById("applyFourPieceSetModalBtn"),
    fourPieceSetModalSummary: document.getElementById("fourPieceSetModalSummary"),
    fourPieceSetChoices: document.getElementById("fourPieceSetChoices"),
    fourPieceBuffSection: document.getElementById("fourPieceBuffSection"),
    fourPieceBuffModeAuto: document.getElementById("fourPieceBuffModeAuto"),
    fourPieceBuffModeManual: document.getElementById("fourPieceBuffModeManual"),
    fourPieceBuffSummary: document.getElementById("fourPieceBuffSummary"),
    fourPieceBuffManualList: document.getElementById("fourPieceBuffManualList"),
    twoPieceSetSelect: document.getElementById("twoPieceSetSelect"),
    openTwoPieceSetModalBtn: document.getElementById("openTwoPieceSetModalBtn"),
    twoPieceSelectedSummary: document.getElementById("twoPieceSelectedSummary"),
    twoPieceSetModal: document.getElementById("twoPieceSetModal"),
    closeTwoPieceSetModalBtn: document.getElementById("closeTwoPieceSetModalBtn"),
    cancelTwoPieceSetModalBtn: document.getElementById("cancelTwoPieceSetModalBtn"),
    applyTwoPieceSetModalBtn: document.getElementById("applyTwoPieceSetModalBtn"),
    twoPieceSetModalSummary: document.getElementById("twoPieceSetModalSummary"),
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
    cancelCalculationConfigBtn: document.getElementById("cancelCalculationConfigBtn"),
    calculationConfigMode: document.getElementById("calculationConfigMode"),
    calculationCustomConfigEvents: document.getElementById("calculationCustomConfigEvents"),
    adminDefaultCalculationPreview: document.getElementById("adminDefaultCalculationPreview"),
    adminDefaultCalculationEventCount: document.getElementById("adminDefaultCalculationEventCount"),
    adminDefaultCalculationEventList: document.getElementById("adminDefaultCalculationEventList"),
    adminDefaultCalculationEventTitle: document.getElementById("adminDefaultCalculationEventTitle"),
    adminDefaultCalculationEventFields: document.getElementById("adminDefaultCalculationEventFields"),
    calculationConfigEventCount: document.getElementById("calculationConfigEventCount"),
    calculationConfigEventList: document.getElementById("calculationConfigEventList"),
    calculationEventEditorTitle: document.getElementById("calculationEventEditorTitle"),
    calculationEventEditorFields: document.getElementById("calculationEventEditorFields"),
    duplicateCalculationEventBtn: document.getElementById("duplicateCalculationEventBtn"),
    removeCalculationEventBtn: document.getElementById("removeCalculationEventBtn"),
    addCalculationDirectEventBtn: document.getElementById("addCalculationDirectEventBtn"),
    addCalculationSheerEventBtn: document.getElementById("addCalculationSheerEventBtn"),
    addCalculationAnomalyEventBtn: document.getElementById("addCalculationAnomalyEventBtn"),
    addCalculationDisorderEventBtn: document.getElementById("addCalculationDisorderEventBtn"),
    addCalculationSkillGroupEventBtn: document.getElementById("addCalculationSkillGroupEventBtn"),
    calculationConfigFooterSummary: document.getElementById("calculationConfigFooterSummary"),
    saveCalculationConfigBtn: document.getElementById("saveCalculationConfigBtn"),
    optimizeBtn: document.getElementById("optimizeBtn"),
    cancelOptimizeBtn: document.getElementById("cancelOptimizeBtn"),
    optimizerMetrics: document.getElementById("optimizerMetrics"),
    optimizerRunSummary: document.getElementById("optimizerRunSummary"),
    optimizerRunProgress: document.getElementById("optimizerRunProgress"),
    optimizerRunProgressFill: document.getElementById("optimizerRunProgressFill"),
    optimizerRunPercent: document.getElementById("optimizerRunPercent"),
    optimizerRunMeta: document.getElementById("optimizerRunMeta"),
    optimizerRunNote: document.getElementById("optimizerRunNote"),
    optimizeInlineBtn: document.getElementById("optimizeInlineBtn"),
    cancelOptimizeInlineBtn: document.getElementById("cancelOptimizeInlineBtn"),
    optimizerProgress: document.getElementById("optimizerProgress"),
    optimizerProgressFill: document.getElementById("optimizerProgressFill"),
    optimizerProgressPercent: document.getElementById("optimizerProgressPercent"),
    optimizerElapsed: document.getElementById("optimizerElapsed"),
    optimizerEvaluated: document.getElementById("optimizerEvaluated"),
    optimizerEstimate: document.getElementById("optimizerEstimate"),
    optimizerProgressNote: document.getElementById("optimizerProgressNote"),
    applyLoadoutBtn: document.getElementById("applyLoadoutBtn"),
    driveDiscSchemeTabs: document.getElementById("driveDiscSchemeTabs"),
    driveDiscSchemeList: document.getElementById("driveDiscSchemeList"),
    manualDiscModeBtn: document.getElementById("manualDiscModeBtn"),
    loadoutDiscModeBtn: document.getElementById("loadoutDiscModeBtn"),
    homeLoadoutSelect: document.getElementById("homeLoadoutSelect"),
    optimizerResultTabs: document.getElementById("optimizerResultTabs"),
    saveLoadoutBtn: document.getElementById("saveLoadoutBtn"),
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
    currentSchemeFourPieceBuffSection: document.getElementById("currentSchemeFourPieceBuffSection"),
    currentSchemeFourPieceBuffModeAuto: document.getElementById("currentSchemeFourPieceBuffModeAuto"),
    currentSchemeFourPieceBuffModeManual: document.getElementById("currentSchemeFourPieceBuffModeManual"),
    currentSchemeFourPieceBuffSummary: document.getElementById("currentSchemeFourPieceBuffSummary"),
    currentSchemeFourPieceBuffManualList: document.getElementById("currentSchemeFourPieceBuffManualList"),
    slot4MainStatChoices: document.getElementById("slot4MainStatChoices"),
    slot5MainStatChoices: document.getElementById("slot5MainStatChoices"),
    slot6MainStatChoices: document.getElementById("slot6MainStatChoices"),
    baseTable: document.getElementById("baseTable"),
    bonusTable: document.getElementById("bonusTable"),
    inCombatPanelTable: document.getElementById("inCombatPanelTable"),
    inCombatActiveEffects: document.getElementById("inCombatActiveEffects"),
    damageFinalValue: document.getElementById("damageFinalValue"),
    damageWhiteBoxRows: document.getElementById("damageWhiteBoxRows"),
    driveDiscSubstatAnalysisBtn: document.getElementById("driveDiscSubstatAnalysisBtn"),
    driveDiscStatGainBtn: document.getElementById("driveDiscStatGainBtn"),
}

const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
const DEFAULT_DAMAGE_TARGET_PRESETS = [
    { id: "wandering-hunter", name: { zhCN: "彷徨猎手" }, defense: 1588 },
    { id: "taichu-nightmare", name: { zhCN: "低防怪如太初梦魇" }, defense: 476 },
    { id: "normal-boss", name: { zhCN: "正常boss" }, defense: 953 },
]
const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
const DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT = 150
const DEFAULT_OPTIMIZER_ALGORITHM = "exact-super-bound"
const ADMIN_DEFAULT_CALCULATION_MODE = "adminDefault"
const CALCULATION_CONFIG_MODE_VALUES = new Set(["single", "sheer", "anomaly", "custom", ADMIN_DEFAULT_CALCULATION_MODE])
const DEFAULT_CHECKED_COMBAT_SOURCE_TYPES = new Set(["self", "wEngine", "wEngineTeam"])
const HOME_DISC_MODES = new Set(["manual", "loadout"])
const MANUAL_SCHEME_KEY = "manual"
const LOADOUT_SCHEME_KEY = "loadout"
const TEAMMATE_DRIVE_DISC_LIMIT = 2
const W_ENGINE_TEAM_BUFF_LIMIT = 2
const DRIVE_DISC_TEAM_BUFF_LIMIT = 2
const OPTIMIZER_MAIN_STAT_SLOTS = [4, 5, 6]
const OPTIMIZER_MINIMUM_FIELDS = [
    ["energyRegen", "minEnergyRegen"],
    ["anomalyProficiency", "minAnomalyProficiency"],
    ["critRate", "minCritRate"],
    ["critDmg", "minCritDmg"],
]
const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
    wind: "风",
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
const DEFAULT_ANOMALY_EFFECT_BY_ELEMENT = {
    physical: "assault",
    ice: "shatter",
    fire: "burn",
    electric: "shock",
    ether: "corruption",
}
const DISORDER_TYPE_OPTIONS = [
    ["normal", "（普通）紊乱"],
    ["polarized", "极性紊乱"],
]
const ELEMENT_DMG_KEYS = new Set(["physicalDmg", "fireDmg", "iceDmg", "electricDmg", "etherDmg", "windDmg"])
const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
    wind: "windResIgnore",
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
const ENUM_LABELS = {
    attribute: {
        physical: "物理",
        frost: "烈霜",
        xuanmo: "玄墨",
        fire: "火",
        ice: "冰",
        electric: "电",
        ether: "以太",
        wind: "风",
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
    sheerForce: "贯穿力",
    sheerForceFlat: "固定贯穿力",
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    windResIgnore: "风抗性无视",
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
const BASE_ORDER = ["hp", "atk", "def"]
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
]

let meta = null
let store = null
let optimizationResults = []
let activeResultIndex = -1
let activeOptimizationJobId = null
let activeOptimizationWorker = null
let pendingOptimizationCancelPromise = null
let optimizationStartedAt = 0
let optimizationPollTimer = null
let optimizationElapsedTimer = null
let optimizationWatchdogTimer = null
let lastOptimizationWorkerMessageAt = 0
let lastOptimizationProgress = null
let activeOptimizationSettingsSnapshot = null
let activeOptimizationAgentIdSnapshot = null
let lastCompletedOptimizationSettings = null
let lastCompletedOptimizationAgentId = null
let optimizationResultsDirty = false
let damagePreviewRequestSeq = 0
let activeSchemeKey = MANUAL_SCHEME_KEY
let activeDiscSlot = null
let activeCombatBuffTab = "agent"
let activeCombatBuffTeammateId = ""
let renderedCombatBuffAgentId = ""
let combatBuffDraftAddedBuffs = null
const manuallyUncheckedDefaultCombatBuffIds = new Set()
const damageTargetResistanceByElement = Object.fromEntries(DAMAGE_ELEMENTS.map(element => [element, 0]))
let activeDamageResistanceElement = "physical"
let optimizerFourPieceBuffModeBySetId = {}
let optimizerFourPieceBuffRuntimeInputsBySetId = {}
let currentSchemeFourPieceBuffModeBySetId = {}
let currentSchemeFourPieceBuffRuntimeInputsBySetId = {}
let selectedDamageSkillRef = null
let activeDamageSkillPickerMoveRef = null
let damageSkillSearchQuery = ""
let damageSkillLevelsByCategory = {}
let calculationConfigMode = "single"
let calculationConfigEvents = []
let calculationConfigSelectedEventId = null
let calculationConfigEditingIndex = 0
let calculationConfigModalSnapshot = null
let twoPieceSetDraftIds = null
let fourPieceSetDraftId = null
let currentRenderedDamage = null
const combatUi = SharedCombat.createCombatUiController({
    getMeta: () => meta,
    includeDriveDiscBuffs: false,
    preserveHiddenDriveDiscBuffs: true,
})

const OPTIMIZER_WORKER_STALL_TIMEOUT_MS = 2 * 60 * 1000

function setStatus(text, tone = "idle") {
    setStatusChip(els.status, text, tone)
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error)
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

function setOptimizeButtonRunning(isRunning, label = "") {
    for (const button of [els.optimizeBtn, els.optimizeInlineBtn].filter(Boolean)) {
        button.disabled = isRunning
        button.textContent = label || (isRunning ? "计算中" : "开始计算")
        button.dataset.running = isRunning ? "true" : "false"
    }
    for (const button of [els.cancelOptimizeBtn, els.cancelOptimizeInlineBtn].filter(Boolean)) {
        button.hidden = !isRunning
        button.disabled = false
    }
}

function setRunSummaryVisible(visible) {
    if (els.optimizerRunSummary) {
        els.optimizerRunSummary.dataset.active = visible ? "true" : "false"
    }
}

function updateRunSummary({ percent = 0, meta = "", note = "", fillPercent = percent, status = "", showProgress = true } = {}) {
    if (!els.optimizerRunSummary) {
        return
    }
    setRunSummaryVisible(true)
    if (els.optimizerRunProgress) {
        els.optimizerRunProgress.hidden = !showProgress
    }
    if (els.optimizerRunProgressFill) {
        els.optimizerRunProgressFill.style.width = `${Math.max(0, Math.min(100, Number(fillPercent ?? 0)))}%`
    }
    if (els.optimizerRunPercent) {
        els.optimizerRunPercent.textContent = formatPercent(percent)
    }
    if (els.optimizerRunMeta) {
        els.optimizerRunMeta.textContent = meta || status || "准备计算"
    }
    if (els.optimizerRunNote) {
        els.optimizerRunNote.textContent = note || status || "等待开始"
    }
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
    if (optimizationWatchdogTimer) {
        clearInterval(optimizationWatchdogTimer)
        optimizationWatchdogTimer = null
    }
}

function disposeActiveOptimizationWorker() {
    if (!activeOptimizationWorker) {
        return
    }
    activeOptimizationWorker.terminate()
    activeOptimizationWorker = null
}

function cloneOptimizerDriveDisc(disc = {}, ownerId = "default") {
    return {
        id: disc.id,
        ownerId: disc.ownerId ?? ownerId,
        setId: disc.setId,
        setName: disc.setName,
        partition: disc.partition,
        rarity: disc.rarity,
        level: disc.level,
        maxLevel: disc.maxLevel,
        locked: Boolean(disc.locked),
        equippedBy: disc.equippedBy ?? null,
        mainStat: disc.mainStat ? { ...disc.mainStat } : null,
        subStats: Array.isArray(disc.subStats) ? disc.subStats.map(stat => ({ ...stat })) : [],
        source: disc.source
            ? {
                type: disc.source.type,
                sequence: disc.source.sequence,
                rawIndex: disc.source.rawIndex,
            }
            : undefined,
    }
}

function optimizerStorePayload(sourceStore = store) {
    const ownerId = sourceStore?.currentOwnerId ?? SharedCombat.currentAccountId()
    const owner = (sourceStore?.owners ?? []).find(item => item.id === ownerId)
    return {
        version: sourceStore?.version ?? 1,
        currentOwnerId: ownerId,
        owners: [owner ?? { id: ownerId, label: ownerId || "默认用户" }],
        imports: [],
        driveDiscLoadouts: [],
        driveDiscs: (sourceStore?.driveDiscs ?? [])
            .filter(disc => (disc.ownerId ?? "default") === ownerId)
            .map(disc => cloneOptimizerDriveDisc(disc, ownerId)),
    }
}

function progressTextForStatus(status) {
    if (status === "preparing") {
        return "正在准备候选数据"
    }
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
    if (metrics.scoreKernel) {
        parts.push(`内核 ${metrics.scoreKernel === "compiled-dense" ? "dense" : "map"}`)
        if (metrics.scoreKernel !== "compiled-dense" && metrics.scoreKernelFallbackReason) {
            parts.push(`回退 ${metrics.scoreKernelFallbackReason}`)
        }
    }
    const pruned = Number(metrics.prunedBySuperBound ?? 0)
    const checks = Number(metrics.superBoundChecks ?? 0)
    if (pruned > 0) {
        parts.push(`真实评分 ${formatCount(metrics.scoredCombinationCount ?? metrics.evaluated ?? 0)}`)
        parts.push(`剪枝 ${formatCount(pruned)}`)
        if (checks > 0) {
            parts.push(`上界 ${formatRate(metrics.boundChecksPerSecond ?? 0)}`)
        }
        if (Number(metrics.avgBoundCheckMs ?? 0) > 0) {
            parts.push(`均耗 ${Number(metrics.avgBoundCheckMs).toFixed(3)}ms`)
        }
        if (Number(metrics.avgScoreKernelMs ?? 0) > 0) {
            parts.push(`内核均耗 ${Number(metrics.avgScoreKernelMs).toFixed(3)}ms`)
        }
    } else if (checks > 0) {
        parts.push(`上界检查 ${formatCount(checks)}`)
        parts.push(`上界 ${formatRate(metrics.boundChecksPerSecond ?? 0)}`)
    }
    if (Number(metrics.workerCount ?? 0) > 1) {
        parts.push(`并行 x${metrics.workerCount}`)
    }
    if (Number(metrics.parallelTaskCount ?? 0) > 0) {
        parts.push(`任务 ${formatCount(metrics.completedTaskCount ?? 0)}/${formatCount(metrics.parallelTaskCount)}`)
    }
    if (Number(metrics.prunedByGlobalCutoff ?? 0) > 0) {
        parts.push(`全局剪枝 ${formatCount(metrics.prunedByGlobalCutoff)}`)
    }
    if (Number(metrics.workerIdleRatio ?? 0) > 0) {
        parts.push(`空闲 ${(Number(metrics.workerIdleRatio) * 100).toFixed(1)}%`)
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
    const preparingHint = merged.status === "preparing" && !estimated
        ? "正在构建候选与剪枝计划，仓库较大时这一步会先停在 0%"
        : ""
    const progressNote = [
        progressTextForStatus(merged.status),
        preparingHint,
        algorithmProgressText(metrics),
        candidateText,
        complexityText(metrics, merged.settings),
        appliedPreferredText(merged.settings),
    ].filter(Boolean).join(" · ")
    els.optimizerProgressNote.textContent = progressNote
    const metricsText = estimated
        ? [
            formatPercent(percent),
            `${formatCount(evaluated)} / ${formatCount(estimated)}`,
            rateText,
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatCount(metrics.prunedBySuperBound)}` : "",
        ].filter(Boolean).join(" · ")
        : progressTextForStatus(merged.status)
    els.optimizerMetrics.textContent = metricsText
    updateRunSummary({
        percent,
        fillPercent: percent,
        meta: metricsText,
        note: progressNote,
        status: progressTextForStatus(merged.status),
    })
}

function clearOptimizationProgress() {
    stopOptimizationTimers()
    disposeActiveOptimizationWorker()
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
    updateRunSummary({
        percent: 0,
        fillPercent: 0,
        meta: "未计算",
        note: "设置好目标和约束后开始计算",
        status: "未计算",
        showProgress: false,
    })
    setRunSummaryVisible(false)
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

function combatBuffDisplayName(buff) {
    return SharedCombat.combatBuffDisplayName(buff)
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
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(previousConfig.driveDiscMode ?? currentHomeDiscMode())
    const manualDriveDiscIdsBySlot = manualDiscIdsFromSavedConfig(agentId)
    const selectedLoadoutId = loadoutIdForAgent(agentId, previousConfig.selectedLoadoutId)
    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        coreSkillLevel: els.coreSkillSelect.value,
        cinemaLevel: selectedCinemaLevel(),
        driveDiscMode,
        manualDriveDiscIdsBySlot,
        selectedLoadoutId,
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(activeDiscIdsForConfig(
            agentId,
            driveDiscMode,
            manualDriveDiscIdsBySlot,
            selectedLoadoutId,
        )),
        combat: combatConfigForSave(previousConfig.combat, {
            addedBuffs: previousConfig.combat?.addedBuffs ?? [],
        }),
        damage: collectDamageConfig(),
        currentSchemeFourPieceBuffModeBySetId: clonePlainObject(currentSchemeFourPieceBuffModeBySetId),
        currentSchemeFourPieceBuffRuntimeInputsBySetId: clonePlainObject(currentSchemeFourPieceBuffRuntimeInputsBySetId),
        optimizer: collectStoredOptimizerConfig(),
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
    return displayAgents().find(item => item.id === id) ?? displayAgents()[0]
}

function getWEngine(id) {
    return displayWEngines().find(item => item.id === id) ?? displayWEngines()[0]
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

function targetStunnedFromConfig(target = {}) {
    if (Object.prototype.hasOwnProperty.call(target, "stunned")) {
        return target.stunned === true || target.stunned === "true" || target.stunned === 1 || target.stunned === "1"
    }
    const activeMultiplier = Number(target.activeStunMultiplier)
    return Number.isFinite(activeMultiplier) ? activeMultiplier !== 1 : true
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
        getImage: item => imageOf(item, "w-engine"),
        getFallbackImage: item => fallbackImageSvg(item, "w-engine"),
        className: "w-engine-image-select",
    })
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
    syncDiscSourceControls(agent?.id)
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

function anomalySettlementType(event = {}) {
    return event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "attribute"
}

function anomalyEffectId(event = {}) {
    return event.anomalyEffect ?? event.previousAnomalyEffect ?? ""
}

function normalizeDisorderType(value) {
    return value === "polarized" ? "polarized" : "normal"
}

function disorderTypeLabel(value) {
    const normalized = normalizeDisorderType(value)
    return DISORDER_TYPE_OPTIONS.find(([id]) => id === normalized)?.[1] ?? normalized
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

function renderCalculationObjectiveControls(mode = calculationConfigMode) {
    if (els.calculationSingleControls) {
        els.calculationSingleControls.hidden = !["single", "sheer"].includes(mode)
    }
    if (els.calculationAnomalyControls) {
        els.calculationAnomalyControls.hidden = mode !== "anomaly"
    }
    const settlementType = els.damageAnomalySettlementType?.value === "disorder" ? "disorder" : "attribute"
    document.querySelectorAll(".calculation-anomaly-attribute-field").forEach(item => { item.hidden = settlementType !== "attribute" })
    document.querySelectorAll(".calculation-anomaly-disorder-field").forEach(item => { item.hidden = settlementType !== "disorder" })
}

function isRuptureAgent(agent = getAgent(els.agentSelect?.value)) {
    return agent?.specialty === "rupture"
}

function primaryCalculationModeForAgent(agent = getAgent(els.agentSelect?.value)) {
    return isRuptureAgent(agent) ? "sheer" : "single"
}

function isCalculationModeAllowedForAgent(mode, agent = getAgent(els.agentSelect?.value)) {
    if (mode === "sheer") {
        return isRuptureAgent(agent)
    }
    if (mode === "single") {
        return !isRuptureAgent(agent)
    }
    return CALCULATION_CONFIG_MODE_VALUES.has(mode)
}

function normalizeCalculationModeForAgent(mode, agent = getAgent(els.agentSelect?.value)) {
    const resolvedMode = CALCULATION_CONFIG_MODE_VALUES.has(mode) ? mode : primaryCalculationModeForAgent(agent)
    return isCalculationModeAllowedForAgent(resolvedMode, agent)
        ? resolvedMode
        : primaryCalculationModeForAgent(agent)
}

function syncCalculationModeSelectOptions(selectedMode = calculationConfigMode) {
    const select = els.calculationConfigMode
    if (!select) {
        return
    }
    const agent = getAgent(els.agentSelect?.value)
    const normalizedMode = normalizeCalculationModeForAgent(selectedMode, agent)
    const options = [
        !isRuptureAgent(agent) ? ["single", "最大化单个技能伤害"] : null,
        isRuptureAgent(agent) ? ["sheer", "最大化贯穿伤害"] : null,
        ["anomaly", "最大化异常伤害"],
        [ADMIN_DEFAULT_CALCULATION_MODE, adminDefaultCalculationLabel(adminDefaultCalculationConfig())],
        ["custom", "自定义"],
    ].filter(Boolean)
    select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")
    select.value = normalizedMode
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

function stripSkillRefLevel(skillRef = null) {
    if (!skillRef || typeof skillRef !== "object") {
        return null
    }
    return {
        agentSkillId: String(skillRef.agentSkillId ?? "").trim(),
        categoryId: String(skillRef.categoryId ?? "").trim(),
        moveId: String(skillRef.moveId ?? "").trim(),
        rowId: String(skillRef.rowId ?? "").trim(),
        ...(skillRef.level !== undefined && skillRef.level !== null && skillRef.level !== "" ? { level: skillRef.level } : {}),
    }
}

function calculationConfigFromStored(config = null, source = getAgent(els.agentSelect?.value)) {
    const groupSource = hasCalculationSkillGroups(source) ? source : config
    const events = Array.isArray(config?.events)
        ? config.events.map((event, index) => {
            if (event?.kind === "skillGroup") {
                return {
                    id: String(event.id ?? `skillGroup-${index + 1}`),
                    kind: "skillGroup",
                    skillGroupId: String(event.skillGroupId ?? event.groupId ?? ""),
                    count: Number(event.count ?? 1),
                }
            }
            return {
                ...event,
                id: String(event.id ?? `${event.kind ?? "event"}-${index + 1}`),
                kind: event.kind === "sheer" ? "sheer" : event.kind === "anomaly" || event.kind === "disorder" ? "anomaly" : "direct",
                settlementType: anomalySettlementType(event),
                ...(anomalySettlementType(event) === "disorder"
                    ? {
                        anomalyEffect: anomalyEffectId(event) || "burn",
                        disorderType: normalizeDisorderType(event.disorderType),
                    }
                    : {}),
                count: Number(event.count ?? 1),
                ...(event.skillRef ? { skillRef: stripSkillRefLevel(event.skillRef) } : {}),
            }
        })
        : []
    if (!events.length && hasCalculationSkillGroups(groupSource)) {
        events.push(...calculationSkillGroups(groupSource)
            .map((group, index) => defaultSkillGroupReferenceEvent(groupSource, group.id, index))
            .filter(Boolean))
    }
    return {
        mode: CALCULATION_CONFIG_MODE_VALUES.has(config?.mode) ? config.mode : (events.length > 1 ? "custom" : "single"),
        selectedEventId: config?.selectedEventId ?? events[0]?.id ?? null,
        events,
    }
}

function cloneCalculationEvents(events = []) {
    return events.map(event => structuredClone(event))
}

function adminDefaultCalculationConfig(agentId = els.agentSelect?.value) {
    const agent = getAgent(agentId)
    const rawConfig = agent?.defaultCalculationConfig
    if (!rawConfig) {
        return null
    }
    const normalized = calculationConfigFromStored(rawConfig, agent)
    if (!normalized.events.length) {
        return null
    }
    return {
        ...normalized,
        name: rawConfig.name,
    }
}

function adminDefaultCalculationLabel(config = adminDefaultCalculationConfig()) {
    if (!config) {
        return "未配置默认循环"
    }
    return localizedText(config.name) || "默认循环"
}

function adminDefaultCalculationEvents(config = adminDefaultCalculationConfig()) {
    return cloneCalculationEvents(config?.events ?? [])
}

function skillGroupLabel(group = {}) {
    return localizedText(group.name) || group.id || "技能组"
}

function adminDefaultDamageConfigForAgent(agentId = els.agentSelect?.value) {
    const config = adminDefaultCalculationConfig(agentId)
    if (!config) {
        return {}
    }
    return {
        mode: ADMIN_DEFAULT_CALCULATION_MODE,
        selectedEventId: config.selectedEventId,
        events: adminDefaultCalculationEvents(config),
    }
}

function isDefaultSingleDamageConfig(config = null) {
    if (!config || typeof config !== "object") {
        return true
    }
    const normalized = calculationConfigFromStored(config)
    if (normalized.mode !== "single") {
        return false
    }
    if (!normalized.events.length) {
        return true
    }
    const event = normalized.events[0]
    if (normalized.events.length > 1 || !event) {
        return false
    }
    return event.id === "direct-1"
        && event.kind === "direct"
        && !event.skillRef
        && Number(event.skillMultiplier ?? config.skillMultiplier ?? 100) === 100
        && (event.critMode ?? config.critMode ?? "expected") === "expected"
}

function damageConfigForAgent(agentId, storedDamageConfig = null) {
    const adminConfig = adminDefaultDamageConfigForAgent(agentId)
    if (adminConfig.events?.length) {
        return {
            ...(storedDamageConfig ?? {}),
            mode: adminConfig.mode,
            selectedEventId: adminConfig.selectedEventId,
            events: adminConfig.events,
        }
    }
    return storedDamageConfig ?? adminConfig
}

function resolveCalculationConfigMode(mode = calculationConfigMode) {
    const nextMode = normalizeCalculationModeForAgent(mode)
    return nextMode === ADMIN_DEFAULT_CALCULATION_MODE && !adminDefaultCalculationConfig()
        ? primaryCalculationModeForAgent()
        : nextMode
}

function syncCalculationConfigModeOptions(selectedMode = calculationConfigMode) {
    syncCalculationModeSelectOptions(selectedMode)
    const option = els.calculationConfigMode?.querySelector(`option[value="${ADMIN_DEFAULT_CALCULATION_MODE}"]`)
    if (!option) {
        return
    }
    const config = adminDefaultCalculationConfig()
    option.textContent = adminDefaultCalculationLabel(config)
    option.disabled = !config
    if (!config && els.calculationConfigMode?.value === ADMIN_DEFAULT_CALCULATION_MODE) {
        els.calculationConfigMode.value = primaryCalculationModeForAgent()
    }
}

function modalCalculationConfigMode() {
    return resolveCalculationConfigMode(els.calculationConfigMode?.value ?? calculationConfigMode)
}

function calculationConfigModeReadonly(mode = modalCalculationConfigMode()) {
    return mode === ADMIN_DEFAULT_CALCULATION_MODE
}

function ensureCustomCalculationEventsSeeded() {
    if (calculationConfigEvents.length) {
        return
    }
    const defaultConfig = adminDefaultCalculationConfig()
    if (!defaultConfig) {
        return
    }
    calculationConfigEvents = adminDefaultCalculationEvents(defaultConfig)
    calculationConfigSelectedEventId = defaultConfig.selectedEventId ?? calculationConfigEvents[0]?.id ?? null
    calculationConfigEditingIndex = Math.max(0, calculationConfigEvents.findIndex(event => event.id === calculationConfigSelectedEventId))
}

function calculationEventsForMode(mode = modalCalculationConfigMode()) {
    if (mode === ADMIN_DEFAULT_CALCULATION_MODE) {
        return adminDefaultCalculationEvents()
    }
    if (mode === "custom") {
        return calculationConfigEvents
    }
    if (mode === "anomaly") {
        return [anomalyEventFromControls()]
    }
    if (mode === "sheer") {
        return [sheerEventFromControls()]
    }
    return [singleEventFromControls()]
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
    const prefix = ["direct", "sheer", "disorder", "anomaly", "skillGroup"].includes(kind) ? kind : "event"
    let index = calculationConfigEvents.length + 1
    const used = new Set(calculationConfigEvents.map(event => event.id))
    while (used.has(`${prefix}-${index}`)) {
        index += 1
    }
    return `${prefix}-${index}`
}

function calculationEventDraft(kind = "direct") {
    const id = uniqueCalculationEventId(kind)
    if (kind === "skillGroup") {
        return {
            ...(defaultSkillGroupReferenceEvent(getAgent(els.agentSelect?.value), calculationSkillGroups(getAgent(els.agentSelect?.value))[0]?.id, calculationConfigEvents.length) ?? {
                kind: "skillGroup",
                skillGroupId: "",
                count: 1,
            }),
            id,
        }
    }
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
            disorderType: "normal",
            anomalyEffect: disorderEffects()[0]?.id ?? "burn",
            elapsedSeconds: 0,
            count: 1,
        }
    }
    return {
        id,
        kind: kind === "sheer" ? "sheer" : "direct",
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
    if (!["direct", "sheer"].includes(event.kind)) {
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
        defense: selectedDamageTargetDefense(),
        levelCoefficient: DEFAULT_DAMAGE_LEVEL_COEFFICIENT,
        stunned: Boolean(els.damageTargetStunned?.checked),
        stunMultiplierPercent: Number(els.damageTargetStunMultiplier?.value ?? DEFAULT_DAMAGE_STUN_MULTIPLIER_PERCENT),
        resistanceByElement: {
            ...damageTargetResistanceByElement,
            [damageElement]: damageResistanceControlValue(),
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

function sheerEventFromControls(id = "sheer-1") {
    return {
        ...directEventFromControls(id),
        kind: "sheer",
    }
}

function anomalyEventFromControls() {
    const settlementType = els.damageAnomalySettlementType?.value === "disorder" ? "disorder" : "attribute"
    if (settlementType === "disorder") {
        return {
            id: "disorder-1",
            kind: "anomaly",
            settlementType: "disorder",
            disorderType: normalizeDisorderType(els.damageDisorderType?.value),
            anomalyEffect: els.damageDisorderEffect?.value || "burn",
            elapsedSeconds: Number(els.damageDisorderElapsed?.value || 0),
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
    const mode = resolveCalculationConfigMode()
    if (mode === ADMIN_DEFAULT_CALCULATION_MODE) {
        const events = adminDefaultCalculationEvents()
        return (events.length ? events : [singleEventFromControls()]).map(eventWithCurrentSkillLevel)
    }
    if (mode === "anomaly") {
        return [anomalyEventFromControls()]
    }
    if (mode === "sheer") {
        return [sheerEventFromControls()].map(eventWithCurrentSkillLevel)
    }
    if (mode === "custom") {
        const events = calculationConfigEvents.length
            ? calculationConfigEvents
            : [calculationEventDraft("direct")]
        return events.map(eventWithCurrentSkillLevel)
    }
    return [singleEventFromControls()].map(eventWithCurrentSkillLevel)
}

function calculationEventTitle(event = {}) {
    if (event.kind === "skillGroup") {
        const group = skillGroupById(getAgent(els.agentSelect?.value), event.skillGroupId)
        return `${skillGroupLabel(group ?? { id: event.skillGroupId })} ×${event.count ?? 1}`
    }
    if (event.kind === "anomaly" && anomalySettlementType(event) === "attribute") {
        const effect = anomalyEffects().find(item => item.id === event.anomalyEffect)
        return `${localizedText(effect?.label) || ANOMALY_EFFECT_LABELS[event.anomalyEffect] || event.anomalyEffect} ×${event.count ?? 1}`
    }
    if (event.kind === "anomaly" && anomalySettlementType(event) === "disorder") {
        const effectId = anomalyEffectId(event)
        const effect = disorderEffects().find(item => item.id === effectId)
        const typePrefix = normalizeDisorderType(event.disorderType) === "polarized" ? "极性" : ""
        return `${typePrefix}${localizedText(effect?.label) || ANOMALY_EFFECT_LABELS[effectId] || effectId} ×${event.count ?? 1}`
    }
    const skill = meta?.agentSkills?.find(item => item.id === event.skillRef?.agentSkillId) ?? agentSkillCatalog()
    const category = damageSkillCategories(skill).find(item => item.id === event.skillRef?.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === event.skillRef?.moveId)
    const row = (move?.rows ?? []).find(item => item.id === event.skillRef?.rowId)
    const label = [category && nameOf(category), move && nameOf(move), row && (localizedText(row.label) || row.id)].filter(Boolean).join(" / ")
    return `${label || (event.kind === "sheer" ? "贯穿" : "直伤")} ×${event.count ?? 1}`
}

function calculationEventSubjectLabel(event = {}) {
    const kind = calculationEventUiKind(event)
    if (kind === "skillGroup") {
        const group = skillGroupById(getAgent(els.agentSelect?.value), event.skillGroupId)
        return skillGroupLabel(group ?? { id: event.skillGroupId })
    }
    if (kind === "anomaly" && anomalySettlementType(event) === "attribute") {
        return anomalyEffectLabel(event.anomalyEffect ?? defaultAnomalyEffectIdForAgent(), "attribute")
    }
    if (kind === "disorder") {
        const effectLabel = anomalyEffectLabel(anomalyEffectId(event), "disorder")
        return `${normalizeDisorderType(event.disorderType) === "polarized" ? "极性" : ""}${effectLabel}`
    }
    const parts = directCalculationEventParts(event)
    const label = [parts.category, parts.move, parts.row].filter(value => value && value !== "-").join(" / ")
    return label || calculationEventKindLabel(kind)
}

function calculationEventFullLabel(event = {}) {
    const kind = calculationEventUiKind(event)
    return `${calculationEventKindLabel(kind)} · ${calculationEventSubjectLabel(event)}`
}

function calculationConfigSummaryText(config = null) {
    const mode = config?.mode ?? calculationConfigMode
    if (mode === ADMIN_DEFAULT_CALCULATION_MODE) {
        const defaultConfig = adminDefaultCalculationConfig()
        const events = config?.events ?? defaultConfig?.events ?? []
        if (!events.length) {
            return "未配置默认循环"
        }
        return `${adminDefaultCalculationLabel(defaultConfig)}：${events.map(calculationEventTitle).join(" + ")}`
    }
    if (mode === "anomaly") {
        return `最大化异常伤害：${calculationEventTitle(anomalyEventFromControls())}`
    }
    if (mode === "sheer") {
        const events = config?.events ?? [sheerEventFromControls()]
        return `最大化贯穿伤害：${events.map(calculationEventTitle).join(" + ")}`
    }
    const events = config?.events ?? (mode === "single" ? [singleEventFromControls()] : calculationConfigEvents)
    if (!events.length) {
        return mode === "custom" ? "自定义：未配置事件" : "最大化单个技能伤害"
    }
    const prefix = mode === "custom" ? "自定义" : "单个技能伤害"
    return `${prefix}：${events.map(calculationEventTitle).join(" + ")}`
}

function syncCalculationConfigSummary() {
    if (els.calculationConfigSummary) {
        calculationConfigMode = resolveCalculationConfigMode()
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
        const emptyText = els.damageSkillModalEmpty.querySelector("span")
        if (emptyText) {
            emptyText.textContent = query ? "没有匹配的技能倍率" : "当前角色暂无可选择的技能倍率"
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

function disorderTypeOptions(selected = "normal") {
    return optionHtml(DISORDER_TYPE_OPTIONS, normalizeDisorderType(selected))
}

function calculationSkillGroupOptions(selected = "") {
    return optionHtml(calculationSkillGroups(getAgent(els.agentSelect?.value)).map(group => [group.id, skillGroupLabel(group)]), selected)
}

function selectedCalculationSkillGroup(event = {}) {
    return skillGroupById(getAgent(els.agentSelect?.value), event.skillGroupId)
}

function calculationEventCountLimits(event = {}) {
    if (event.kind !== "skillGroup") {
        return { min: 0, max: null, step: 1 }
    }
    return skillGroupCountLimits(selectedCalculationSkillGroup(event) ?? {})
}

function calculationEventCount(event = {}) {
    const count = Number(event?.count ?? 1)
    return Number.isFinite(count) ? count : 1
}

function calculationSkillGroupChildPreviewHtml(event = {}) {
    const group = selectedCalculationSkillGroup(event)
    const groupCount = calculationEventCount(event)
    if (!group) {
        return `
          <section class="calculation-skill-group-child-preview">
            <div class="calculation-skill-group-child-preview-head">
              <strong>组内技能（只读）</strong>
              <span>按当前技能组次数 ×${escapeHtml(groupCount)} 展示合计次数</span>
            </div>
            <div class="calculation-skill-group-child-empty">未找到技能组</div>
          </section>
        `
    }
    const childEvents = Array.isArray(group.events) ? group.events : []
    const body = childEvents.length
        ? `<ol class="calculation-skill-group-child-list">
            ${childEvents.map((childEvent, index) => {
                const childCount = calculationEventCount(childEvent)
                return `
                  <li class="calculation-skill-group-child-item">
                    <span class="calculation-skill-group-child-order">#${index + 1}</span>
                    <span class="calculation-skill-group-child-copy">
                      <strong>${escapeHtml(calculationEventFullLabel(eventWithCurrentSkillLevel(childEvent)))}</strong>
                      <small>${escapeHtml(`组内次数 ×${childCount} · 当前合计 ×${childCount * groupCount}`)}</small>
                    </span>
                  </li>
                `
            }).join("")}
          </ol>`
        : `<div class="calculation-skill-group-child-empty">组内暂无事件</div>`
    return `
      <section class="calculation-skill-group-child-preview">
        <div class="calculation-skill-group-child-preview-head">
          <strong>组内技能（只读）</strong>
          <span>按当前技能组次数 ×${escapeHtml(groupCount)} 展示合计次数</span>
        </div>
        ${body}
      </section>
    `
}

function calculationEventUiKind(event = {}) {
    if (event.kind === "skillGroup") {
        return "skillGroup"
    }
    if (event.kind === "sheer") {
        return "sheer"
    }
    return event.kind === "direct" ? "direct" : (anomalySettlementType(event) === "disorder" ? "disorder" : "anomaly")
}

function calculationEventKindLabel(kind) {
    return {
        direct: "直伤",
        sheer: "贯穿",
        anomaly: "属性异常",
        disorder: "紊乱",
        skillGroup: "技能组",
    }[kind] ?? "事件"
}

function normalizeCalculationEditingIndex(events = calculationConfigEvents) {
    if (!events.length) {
        calculationConfigEditingIndex = 0
        calculationConfigSelectedEventId = null
        return -1
    }
    const selectedIndex = events.findIndex(event => event.id === calculationConfigSelectedEventId)
    if (!Number.isInteger(calculationConfigEditingIndex) || calculationConfigEditingIndex < 0 || calculationConfigEditingIndex >= events.length) {
        calculationConfigEditingIndex = selectedIndex >= 0 ? selectedIndex : 0
    }
    calculationConfigSelectedEventId = events[calculationConfigEditingIndex]?.id ?? null
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
    const events = calculationEventsForMode()
    calculationConfigEditingIndex = Math.max(0, Math.min(events.length - 1, Number(index)))
    calculationConfigSelectedEventId = events[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function addCalculationConfigEvent(kind = "direct") {
    if (calculationConfigModeReadonly()) {
        return
    }
    if (kind === "skillGroup" && !hasCalculationSkillGroups(getAgent(els.agentSelect?.value))) {
        return
    }
    syncEditingEventFromEditor({ renderList: false })
    calculationConfigEvents.push(calculationEventDraft(kind))
    calculationConfigEditingIndex = calculationConfigEvents.length - 1
    calculationConfigSelectedEventId = calculationConfigEvents[calculationConfigEditingIndex]?.id ?? null
    renderCalculationConfigEvents()
}

function duplicateCalculationConfigEvent(index = calculationConfigEditingIndex) {
    if (calculationConfigModeReadonly()) {
        return
    }
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
    if (calculationConfigModeReadonly()) {
        return
    }
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

function calculationEventListItemHtml(event = {}, index = 0, { readonly = false } = {}) {
    const kind = calculationEventUiKind(event)
    const active = index === calculationConfigEditingIndex
    const disabled = readonly ? " disabled" : ""
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
            <button type="button" class="compact-btn" data-duplicate-calculation-event="${index}" aria-label="复制事件 ${index + 1}"${disabled}>复制</button>
            <button type="button" class="compact-btn danger-lite" data-remove-calculation-event="${index}" aria-label="删除事件 ${index + 1}"${disabled}>删除</button>
          </div>
        </article>
    `
}

function calculationEventEditorHtml(event = {}, { readonly = false } = {}) {
    const kind = calculationEventUiKind(event)
    const usesSkill = ["direct", "sheer"].includes(kind)
    const usesSkillGroup = kind === "skillGroup"
    const skillRef = usesSkill ? (stripSkillRefLevel(event.skillRef) ?? firstDamageSkillRef()) : null
    const categoryId = skillRef?.categoryId ?? damageSkillCategories()[0]?.id ?? ""
    const moveId = skillRef?.moveId ?? damageSkillCategories().find(item => item.id === categoryId)?.moves?.[0]?.id ?? ""
    const rowId = skillRef?.rowId ?? damageSkillCategories().find(item => item.id === categoryId)?.moves?.find(item => item.id === moveId)?.rows?.[0]?.id ?? ""
    const skillGroup = selectedCalculationSkillGroup(event)
    const countLimits = calculationEventCountLimits(event)
    const countMax = countLimits.max === null ? "" : ` max="${escapeHtml(countLimits.max)}"`
    const kindOptions = [
        ["direct", "直伤"],
        ["sheer", "贯穿"],
        ["anomaly", "属性异常"],
        ["disorder", "紊乱"],
        ...(hasCalculationSkillGroups(getAgent(els.agentSelect?.value)) || usesSkillGroup ? [["skillGroup", "技能组"]] : []),
    ]
    const disabled = readonly ? " disabled" : ""
    return `
        <label class="field">
          <span>类型</span>
          <select data-calculation-event-kind${disabled}>${optionHtml(kindOptions, kind)}</select>
        </label>
        <label class="field">
          <span>次数</span>
          <input data-calculation-event-count type="number" min="${escapeHtml(countLimits.min)}"${countMax} step="${escapeHtml(countLimits.step)}" value="${escapeHtml(event.count ?? 1)}"${disabled}>
        </label>
        <label class="field calculation-skill-group-only"${usesSkillGroup ? "" : " hidden"}>
          <span>技能组</span>
          <select data-calculation-skill-group${disabled}>${calculationSkillGroupOptions(event.skillGroupId)}</select>
        </label>
        <label class="field calculation-skill-group-only"${usesSkillGroup ? "" : " hidden"}>
          <span>组内事件</span>
          <input type="text" value="${escapeHtml(Array.isArray(skillGroup?.events) ? `${skillGroup.events.length} 项` : "未选择")}" disabled>
        </label>
        <label class="field calculation-direct-only"${usesSkill ? "" : " hidden"}>
          <span>技能大类</span>
          <select data-calculation-skill-category${disabled}>${calculationSkillCategoryOptions(categoryId)}</select>
        </label>
        <label class="field calculation-direct-only"${usesSkill ? "" : " hidden"}>
          <span>招式</span>
          <select data-calculation-skill-move${disabled}>${calculationSkillMoveOptions(categoryId, moveId)}</select>
        </label>
        <label class="field calculation-direct-only"${usesSkill ? "" : " hidden"}>
          <span>倍率行</span>
          <select data-calculation-skill-row${disabled}>${calculationSkillRowOptions(categoryId, moveId, rowId)}</select>
        </label>
        <label class="field calculation-direct-only"${usesSkill ? "" : " hidden"}>
          <span>暴击模式</span>
          <select data-calculation-crit-mode${disabled}>${optionHtml([["expected", "期望"], ["crit", "暴击"], ["nonCrit", "非暴击"]], event.critMode ?? "expected")}</select>
        </label>
        <label class="field calculation-anomaly-only"${kind === "anomaly" ? "" : " hidden"}>
          <span>异常类型</span>
          <select data-calculation-anomaly-effect${disabled}>${anomalyEffectOptions(event.anomalyEffect ?? defaultAnomalyEffectIdForAgent())}</select>
        </label>
        <label class="field calculation-anomaly-only"${kind === "anomaly" ? "" : " hidden"}>
          <span>结算次数</span>
          <input data-calculation-proc-count type="number" min="0" step="1" value="${escapeHtml(event.procCount ?? 1)}"${disabled}>
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>紊乱类型</span>
          <select data-calculation-disorder-type${disabled}>${disorderTypeOptions(event.disorderType)}</select>
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>原异常</span>
          <select data-calculation-disorder-effect${disabled}>${disorderEffectOptions(anomalyEffectId(event) || "burn")}</select>
        </label>
        <label class="field calculation-disorder-only"${kind === "disorder" ? "" : " hidden"}>
          <span>已生效秒数</span>
          <input data-calculation-elapsed type="number" min="0" step="0.1" value="${escapeHtml(event.elapsedSeconds ?? 0)}"${disabled}>
        </label>
        ${usesSkillGroup ? calculationSkillGroupChildPreviewHtml(event) : ""}
    `
}

function directCalculationEventParts(event = {}) {
    const skill = meta?.agentSkills?.find(item => item.id === event.skillRef?.agentSkillId) ?? agentSkillCatalog()
    const category = damageSkillCategories(skill).find(item => item.id === event.skillRef?.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === event.skillRef?.moveId)
    const row = (move?.rows ?? []).find(item => item.id === event.skillRef?.rowId)
    return {
        category: category ? nameOf(category) : "-",
        move: move ? nameOf(move) : "-",
        row: row ? (localizedText(row.label) || row.id) : "-",
    }
}

function critModeLabel(mode = "expected") {
    return {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[mode] ?? mode
}

function anomalyEffectLabel(effectId = "", settlementType = "attribute") {
    const effects = settlementType === "disorder" ? disorderEffects() : anomalyEffects()
    const effect = effects.find(item => item.id === effectId)
    return localizedText(effect?.label) || ANOMALY_EFFECT_LABELS[effectId] || effectId || "-"
}

function calculationEventPreviewRows(event = {}) {
    const kind = calculationEventUiKind(event)
    const rows = [
        ["类型", calculationEventKindLabel(kind)],
        ["次数", `×${event.count ?? 1}`],
    ]
    if (kind === "skillGroup") {
        const group = selectedCalculationSkillGroup(event)
        return [
            ...rows,
            ["技能组", skillGroupLabel(group ?? { id: event.skillGroupId })],
            ["组内事件", Array.isArray(group?.events) ? `${group.events.length} 项` : "未选择"],
        ]
    }
    if (["direct", "sheer"].includes(kind)) {
        const parts = directCalculationEventParts(event)
        return [
            ...rows,
            ["技能大类", parts.category],
            ["招式", parts.move],
            ["倍率行", parts.row],
            ["暴击模式", critModeLabel(event.critMode ?? "expected")],
        ]
    }
    if (kind === "disorder") {
        return [
            ...rows,
            ["紊乱类型", disorderTypeLabel(event.disorderType)],
            ["原异常", anomalyEffectLabel(anomalyEffectId(event), "disorder")],
            ["已生效秒数", `${event.elapsedSeconds ?? 0}s`],
        ]
    }
    return [
        ...rows,
        ["异常类型", anomalyEffectLabel(event.anomalyEffect ?? defaultAnomalyEffectIdForAgent(), "attribute")],
        ["结算次数", `×${event.procCount ?? 1}`],
    ]
}

function adminDefaultCalculationEventListItemHtml(event = {}, index = 0) {
    const kind = calculationEventUiKind(event)
    const active = index === calculationConfigEditingIndex
    return `
        <article class="calculation-event-list-item calculation-default-event-list-item${active ? " active" : ""}" data-calculation-event-index="${index}">
          <button type="button" class="calculation-event-select" data-select-calculation-event="${index}">
            <span class="calculation-event-order">#${index + 1}</span>
            <span class="calculation-event-copy">
              <strong>${escapeHtml(calculationEventKindLabel(kind))} · ${escapeHtml(calculationEventTitle(event))}</strong>
              <small>${escapeHtml(`次数 ×${event.count ?? 1}`)}</small>
            </span>
          </button>
        </article>
    `
}

function adminDefaultCalculationEventDetailHtml(event = {}) {
    const rows = calculationEventPreviewRows(event)
    return `
        <div class="calculation-default-detail-list">
          ${rows.map(([label, value]) => `
            <div class="calculation-default-detail-item">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value ?? "-")}</strong>
            </div>
          `).join("")}
        </div>
        ${calculationEventUiKind(event) === "skillGroup" ? calculationSkillGroupChildPreviewHtml(event) : ""}
    `
}

function renderAdminDefaultCalculationPreview(events = adminDefaultCalculationEvents()) {
    normalizeCalculationEditingIndex(events)
    if (els.adminDefaultCalculationEventList) {
        els.adminDefaultCalculationEventList.innerHTML = events.length
            ? events.map(adminDefaultCalculationEventListItemHtml).join("")
            : `<div class="calculation-event-empty">未配置默认循环事件</div>`
    }
    if (els.adminDefaultCalculationEventCount) {
        els.adminDefaultCalculationEventCount.textContent = `${events.length} 项`
    }
    const event = calculationConfigEditingIndex >= 0 ? events[calculationConfigEditingIndex] : null
    if (els.adminDefaultCalculationEventTitle) {
        els.adminDefaultCalculationEventTitle.textContent = event ? calculationEventTitle(event) : "暂无默认循环事件"
    }
    if (els.adminDefaultCalculationEventFields) {
        els.adminDefaultCalculationEventFields.innerHTML = event
            ? adminDefaultCalculationEventDetailHtml(event)
            : `<div class="calculation-event-editor-empty">当前角色未配置默认循环事件。</div>`
    }
}

function renderCalculationConfigEventList(events = calculationConfigEvents) {
    if (!els.calculationConfigEventList) {
        return
    }
    const readonly = calculationConfigModeReadonly()
    els.calculationConfigEventList.innerHTML = events.length
        ? events.map((event, index) => calculationEventListItemHtml(event, index, { readonly })).join("")
        : `<div class="calculation-event-empty">还没有目标事件</div>`
    if (els.calculationConfigEventCount) {
        els.calculationConfigEventCount.textContent = `${events.length} 项`
    }
}

function renderCalculationEventEditor(events = calculationConfigEvents) {
    const index = normalizeCalculationEditingIndex(events)
    const event = index >= 0 ? events[index] : null
    const readonly = calculationConfigModeReadonly()
    if (els.calculationEventEditorTitle) {
        els.calculationEventEditorTitle.textContent = event ? calculationEventTitle(event) : "添加一个事件开始配置"
    }
    if (els.calculationEventEditorFields) {
        els.calculationEventEditorFields.innerHTML = event
            ? calculationEventEditorHtml(event, { readonly })
            : `<div class="calculation-event-editor-empty">左侧添加技能、异常或技能组事件。</div>`
    }
    if (els.duplicateCalculationEventBtn) {
        els.duplicateCalculationEventBtn.disabled = !event || readonly
    }
    if (els.removeCalculationEventBtn) {
        els.removeCalculationEventBtn.disabled = !event || readonly
    }
}

function syncCalculationConfigModalSummary() {
    if (els.calculationConfigFooterSummary) {
        const mode = modalCalculationConfigMode()
        const events = calculationEventsForMode(mode)
        els.calculationConfigFooterSummary.textContent = calculationConfigSummaryText({ mode, events })
    }
}

function renderCalculationConfigEvents() {
    const mode = modalCalculationConfigMode()
    const events = calculationEventsForMode()
    normalizeCalculationEditingIndex(events)
    if (mode === ADMIN_DEFAULT_CALCULATION_MODE) {
        renderAdminDefaultCalculationPreview(events)
    } else {
        renderCalculationConfigEventList(events)
        renderCalculationEventEditor(events)
    }
    syncCalculationConfigModalSummary()
}

function syncCalculationConfigModeFields(selectedMode = els.calculationConfigMode?.value ?? calculationConfigMode) {
    syncCalculationConfigModeOptions(selectedMode)
    let mode = modalCalculationConfigMode()
    if (els.calculationConfigMode && els.calculationConfigMode.value !== mode) {
        els.calculationConfigMode.value = mode
    }
    if (mode === "custom") {
        ensureCustomCalculationEventsSeeded()
    }
    const showCustomEvents = mode === "custom"
    const showAdminPreview = mode === ADMIN_DEFAULT_CALCULATION_MODE
    if (els.calculationCustomConfigEvents) {
        els.calculationCustomConfigEvents.hidden = !showCustomEvents
    }
    if (els.adminDefaultCalculationPreview) {
        els.adminDefaultCalculationPreview.hidden = !showAdminPreview
    }
    for (const button of [
        els.addCalculationDirectEventBtn,
        els.addCalculationSheerEventBtn,
        els.addCalculationAnomalyEventBtn,
        els.addCalculationDisorderEventBtn,
        els.addCalculationSkillGroupEventBtn,
    ]) {
        if (button) {
            button.hidden = !showCustomEvents
            button.disabled = !showCustomEvents
        }
    }
    if (els.addCalculationSkillGroupEventBtn) {
        const canUseSkillGroup = showCustomEvents && hasCalculationSkillGroups(getAgent(els.agentSelect?.value))
        els.addCalculationSkillGroupEventBtn.hidden = !canUseSkillGroup
        els.addCalculationSkillGroupEventBtn.disabled = !canUseSkillGroup
    }
    renderCalculationConfigEvents()
    renderCalculationObjectiveControls(mode)
    syncCalculationConfigModalSummary()
}

function readCalculationEventFromEditor(index = calculationConfigEditingIndex) {
    const current = calculationConfigEvents[index]
    if (!current || !els.calculationEventEditorFields) {
        return current
    }
    const kind = els.calculationEventEditorFields.querySelector("[data-calculation-event-kind]")?.value ?? calculationEventUiKind(current)
    const count = Number(els.calculationEventEditorFields.querySelector("[data-calculation-event-count]")?.value || 1)
    if (kind === "skillGroup") {
        return normalizeSkillGroupReferenceEvent({
            id: current.id,
            kind: "skillGroup",
            skillGroupId: els.calculationEventEditorFields.querySelector("[data-calculation-skill-group]")?.value ?? current.skillGroupId,
            count,
        }, getAgent(els.agentSelect?.value), index) ?? {
            id: current.id,
            kind: "skillGroup",
            skillGroupId: "",
            count,
        }
    }
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
            disorderType: normalizeDisorderType(els.calculationEventEditorFields.querySelector("[data-calculation-disorder-type]")?.value),
            anomalyEffect: els.calculationEventEditorFields.querySelector("[data-calculation-disorder-effect]")?.value || "burn",
            elapsedSeconds: Number(els.calculationEventEditorFields.querySelector("[data-calculation-elapsed]")?.value || 0),
            count,
        }
    }
    const skill = agentSkillCatalog()
    return {
        id: current.id,
        kind: kind === "sheer" ? "sheer" : "direct",
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
    if (modalCalculationConfigMode() !== "custom") {
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

function renderCalculationConfigModal() {
    if (!els.calculationConfigModal) {
        return
    }
    calculationConfigMode = resolveCalculationConfigMode()
    syncCalculationConfigModeOptions()
    if (els.calculationConfigMode) {
        els.calculationConfigMode.value = calculationConfigMode
    }
    const events = calculationEventsForMode()
    const selectedIndex = events.findIndex(event => event.id === calculationConfigSelectedEventId)
    if (selectedIndex >= 0) {
        calculationConfigEditingIndex = selectedIndex
    }
    syncCalculationConfigModeFields()
}

function captureCalculationConfigModalSnapshot() {
    return {
        mode: calculationConfigMode,
        events: cloneCalculationEvents(calculationConfigEvents),
        selectedEventId: calculationConfigSelectedEventId,
        editingIndex: calculationConfigEditingIndex,
    }
}

function restoreCalculationConfigModalSnapshot() {
    if (!calculationConfigModalSnapshot) {
        return
    }
    calculationConfigMode = calculationConfigModalSnapshot.mode
    calculationConfigEvents = cloneCalculationEvents(calculationConfigModalSnapshot.events)
    calculationConfigSelectedEventId = calculationConfigModalSnapshot.selectedEventId
    calculationConfigEditingIndex = calculationConfigModalSnapshot.editingIndex
    syncCalculationConfigSummary()
    renderCalculationObjectiveControls()
}

function openCalculationConfigModal() {
    calculationConfigModalSnapshot = captureCalculationConfigModalSnapshot()
    renderCalculationConfigModal()
    els.calculationConfigModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeCalculationConfigModal({ restore = true } = {}) {
    els.calculationConfigModal.hidden = true
    document.body.classList.remove("modal-open")
    if (restore) {
        restoreCalculationConfigModalSnapshot()
    }
    calculationConfigModalSnapshot = null
}

function applyStoredDamageConfig(config = {}) {
    const storedCalculationConfig = calculationConfigFromStored(config)
    calculationConfigMode = resolveCalculationConfigMode(storedCalculationConfig.mode)
    const activeCalculationConfig = calculationConfigMode === ADMIN_DEFAULT_CALCULATION_MODE
        ? adminDefaultCalculationConfig()
        : storedCalculationConfig.mode === ADMIN_DEFAULT_CALCULATION_MODE
            ? { selectedEventId: null, events: [] }
            : storedCalculationConfig
    const activeEvents = activeCalculationConfig?.events ?? []
    calculationConfigEvents = calculationConfigMode === "custom"
        ? storedCalculationConfig.events
        : []
    calculationConfigSelectedEventId = activeCalculationConfig?.selectedEventId ?? activeEvents[0]?.id ?? null
    calculationConfigEditingIndex = Math.max(0, activeEvents.findIndex(event => event.id === calculationConfigSelectedEventId))
    const target = config.target ?? {}
    const damageElement = currentDamageElement()
    const selectedEvent = activeEvents.find(event => event.id === calculationConfigSelectedEventId)
        ?? activeEvents[0]
        ?? { kind: "direct" }
    activeDamageResistanceElement = damageElement
    for (const element of DAMAGE_ELEMENTS) {
        damageTargetResistanceByElement[element] = Number(target.resistanceByElement?.[element] ?? target.resistance ?? 0)
    }
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
    setDamageResistanceControlValue(damageTargetResistanceByElement[damageElement] ?? 0)
    if (["direct", "sheer"].includes(selectedEvent.kind)) {
        els.damageSkillMultiplier.value = selectedEvent.skillMultiplier ?? config.skillMultiplier ?? 100
        els.damageCritMode.value = selectedEvent.critMode ?? config.critMode ?? "expected"
    } else {
        const settlementType = anomalySettlementType(selectedEvent)
        if (els.damageAnomalySettlementType) {
            els.damageAnomalySettlementType.value = settlementType
        }
        if (settlementType === "disorder") {
            if (els.damageDisorderType) {
                els.damageDisorderType.value = normalizeDisorderType(selectedEvent.disorderType)
            }
            els.damageDisorderEffect.value = anomalyEffectId(selectedEvent) || "burn"
            els.damageDisorderElapsed.value = selectedEvent.elapsedSeconds ?? 0
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
    syncDamageTargetDefenseVisibility()
    syncCalculationConfigSummary()
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
    return preset ? Number(preset.defense) : Number(els.damageTargetDefense?.value || 953)
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
    els.damageTargetResistance.value = String(Math.round(clamped))
}

function damageResistanceControlValue() {
    if (!els.damageTargetResistance) {
        return 0
    }
    const value = Math.round(clampCustomResistanceValue(els.damageTargetResistance.value))
    if (Number(els.damageTargetResistance.value) !== value) {
        els.damageTargetResistance.value = String(value)
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
    if (!activeDamageResistanceElement) {
        activeDamageResistanceElement = currentDamageElement()
    }
    damageTargetResistanceByElement[activeDamageResistanceElement] = damageResistanceControlValue()
}

function syncDamageResistancePresetFromValue({ forceCustom = false } = {}) {
    const value = String(Number(damageResistanceControlValue().toFixed(3)))
    let matched = false
    for (const button of els.damageTargetResistancePreset.querySelectorAll("[data-resistance-preset]")) {
        const preset = button.dataset.resistancePreset
        const active = !forceCustom && preset !== "custom" && String(Number(preset)) === value
        button.classList.toggle("active", active)
        button.setAttribute("aria-pressed", String(active))
        matched = matched || active
    }
    const customButton = els.damageTargetResistancePreset.querySelector("[data-resistance-preset='custom']")
    if (customButton) {
        customButton.classList.toggle("active", !matched)
        customButton.setAttribute("aria-pressed", String(!matched))
    }
    setDamageResistanceCustomHidden(matched)
}

function syncDamageResistanceToPreset(value) {
    if (value === "custom") {
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
        return
    }
    if (!RESISTANCE_PRESET_VALUES.has(String(value))) {
        return
    }
    setDamageResistanceControlValue(Number(value))
    persistCurrentDamageResistanceInput()
    syncDamageResistancePresetFromValue()
}

function syncDamageResistanceControlsToAgent() {
    const element = currentDamageElement()
    activeDamageResistanceElement = element
    setDamageResistanceControlValue(damageTargetResistanceByElement[element] ?? 0)
    if (els.damageTargetResistanceLabel) {
        els.damageTargetResistanceLabel.textContent = `${damageElementShortLabel(element)}抗性`
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
    const normalText = storedEffectRulesText(buff, runtime)
        || (effectRules(buff).length ? "" : options.fallbackText)
        || ""
    const modifierTexts = storedBuffModifierTexts(buff)
    const lines = [
        normalText ? `${options.normalPrefix ?? ""}${normalText}` : "",
        ...modifierTexts,
    ].filter(Boolean)
    setCombatStatLines(container, lines.length ? lines : [options.emptyText ?? "-"])
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

function teammateGroupImage(group = {}) {
    return group.images?.icon ?? group.images?.portrait ?? ""
}

function cinemaBuffName(buff = {}) {
    const level = Number(buff.cinemaLevel)
    const prefix = Number.isInteger(level) ? `影画${level}` : "影画"
    return {
        zhCN: [prefix, localizedText(buff.cinemaName)].filter(Boolean).join("｜"),
    }
}

function agentBuffSourceLabel(key, buff = {}) {
    if (buff.source || buff.sourceLabel) {
        return buff.source ?? buff.sourceLabel
    }
    const labels = { corePassive: "核心被动", additionalAbility: "额外能力" }
    return { zhCN: labels[key] ?? key }
}

function agentCombatBuffs() {
    const agent = getAgent(els.agentSelect.value)
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
            sourceCategory: "agent",
            sourceKind: "self",
            ownerId: agent.id,
            ownerName: agent.name,
            agentName: agent.name,
            source: agentBuffSourceLabel(key, buff),
            sourceLabel: agentBuffSourceLabel(key, buff),
            name: buff.name ?? agentBuffSourceLabel(key, buff),
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
            sourceCategory: "agent",
            sourceKind: "cinema",
            ownerId: agent.id,
            ownerName: agent.name,
            agentName: agent.name,
            source: cinemaBuffName(buff),
            sourceLabel: cinemaBuffName(buff),
            defaultChecked: true,
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
        .filter(item => !isDriveDiscAddedBuff(item) && isResolvableAddedCombatBuff(item))
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

function savedManuallyUncheckedDefaultCombatBuffIds(agentId = els.agentSelect.value) {
    const ids = configForAgent(agentId).combat?.manuallyUncheckedDefaultBuffIds
    return Array.isArray(ids) ? new Set(ids) : new Set()
}

function syncManuallyUncheckedDefaultCombatBuffIds(agentId = els.agentSelect.value) {
    manuallyUncheckedDefaultCombatBuffIds.clear()
    for (const id of savedManuallyUncheckedDefaultCombatBuffIds(agentId)) {
        manuallyUncheckedDefaultCombatBuffIds.add(id)
    }
}

function combatBuffInputsForAgent(agentId = els.agentSelect.value) {
    const inputs = [...els.combatSection.querySelectorAll("input[data-combat-buff-id]")]
    return renderedCombatBuffAgentId === agentId ? inputs : []
}

function activeCombatBuffIdsForSave(agentId = els.agentSelect.value) {
    if (combatBuffInputsForAgent(agentId).length > 0) {
        return [...checkedCombatBuffIds()]
    }
    const savedIds = savedActiveCombatBuffIds(agentId)
    return savedIds ? [...savedIds] : null
}

function manuallyUncheckedDefaultCombatBuffIdsForSave(agentId = els.agentSelect.value) {
    if (combatBuffInputsForAgent(agentId).length > 0) {
        return [...manuallyUncheckedDefaultCombatBuffIds]
    }
    return [...savedManuallyUncheckedDefaultCombatBuffIds(agentId)]
}

function combatConfigForSave(previousCombat = {}, overrides = {}) {
    const next = {
        ...previousCombat,
        ...overrides,
    }
    const activeBuffIds = activeCombatBuffIdsForSave()
    if (activeBuffIds) {
        next.activeBuffIds = activeBuffIds
    } else {
        delete next.activeBuffIds
    }

    const manuallyUncheckedIds = manuallyUncheckedDefaultCombatBuffIdsForSave()
    if (manuallyUncheckedIds.length) {
        next.manuallyUncheckedDefaultBuffIds = manuallyUncheckedIds
    } else {
        delete next.manuallyUncheckedDefaultBuffIds
    }
    return next
}

function checkboxCombatBuffRuntimes() {
    return configForAgent(els.agentSelect.value)?.combat?.checkboxBuffRuntimes ?? {}
}

function checkboxCombatBuffKey(item) {
    return `checkbox:${item.id}`
}

function checkboxCombatBuffIdFromKey(buffKey) {
    return String(buffKey ?? "").startsWith("checkbox:")
        ? String(buffKey).slice("checkbox:".length)
        : ""
}

function checkboxCombatBuffRuntimeItem(buff) {
    return {
        id: buff.id,
        sourceKind: "checkboxBuff",
        runtime: checkboxCombatBuffRuntimes()[buff.id] ?? null,
    }
}

function allCheckboxCombatBuffs() {
    return [
        ...agentCombatBuffs(),
        ...combatBuffsByType("self"),
        ...wEngineEquippedBuffs(),
    ]
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
    const sanitizedAddedBuffs = sanitizeAddedCombatBuffs([...hidden, ...addedBuffs])
        .filter(item => isDriveDiscAddedBuff(item) || isResolvableAddedCombatBuff(item))
    byAgent[agentId] = {
        ...previous,
        combat: combatConfigForSave(previous.combat, {
            addedBuffs: sanitizedAddedBuffs,
        }),
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
}

function updateAddedCombatBuffRuntime(buffKey, updater) {
    saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().map(item => {
        if (addedCombatBuffKey(item) !== buffKey) {
            return item
        }
        const buff = resolveAddedCombatBuff(item)
        const runtime = runtimeForBuff(item, buff)
        updater(runtime, buff)
        return { ...item, runtime }
    }))
}

function updateOptimizerFourPieceBuffRuntime(buffKey, updater) {
    const item = optimizerFourPieceBuffItemByKey(buffKey)
    if (!item?.buff) {
        return
    }
    const runtime = runtimeForBuff(item, item.buff)
    updater(runtime, item.buff)
    setCurrentFourPieceBuffRuntimeInput(item.id, runtime, item.setId)
}

function updateCurrentSchemeFourPieceBuffRuntime(buffKey, updater) {
    const item = currentSchemeFourPieceBuffItemByKey(buffKey)
    if (!item?.buff) {
        return
    }
    const runtime = runtimeForBuff(item, item.buff)
    updater(runtime, item.buff)
    setCurrentSchemeFourPieceBuffRuntimeInput(item.id, runtime, item.setId)
}

function updateCheckboxCombatBuffRuntime(buffKey, updater) {
    const buffId = checkboxCombatBuffIdFromKey(buffKey)
    const buff = allCheckboxCombatBuffs().find(item => item.id === buffId)
    const agentId = els.agentSelect.value
    if (!buff || !agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previous = byAgent[agentId] ?? {}
    const combat = previous.combat ?? {}
    const runtime = runtimeForBuff({ runtime: combat.checkboxBuffRuntimes?.[buffId] ?? null }, buff)
    updater(runtime, buff)
    byAgent[agentId] = {
        ...previous,
        combat: {
            ...combat,
            checkboxBuffRuntimes: {
                ...(combat.checkboxBuffRuntimes ?? {}),
                [buffId]: runtime,
            },
        },
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
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
    const buff = displayCombatBuffs().find(item => item.id === buffId)
    const agentId = els.agentSelect.value
    if (!buff || !agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previous = byAgent[agentId] ?? {}
    const combat = previous.combat ?? {}
    const runtime = runtimeForBuff({ runtime: combat.catalogBuffRuntimes?.[buffId] ?? null }, buff)
    updater(runtime, buff)
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
            ownerImages: group.images ?? buff.teammateImages ?? null,
            teammateImages: group.images ?? buff.teammateImages ?? null,
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

function wEngineTeamBuffCandidates() {
    return displayWEngines()
        .map(wEngine => wEngineTeamBuffCandidateFromWEngine(wEngine, 1))
        .filter(Boolean)
}

function driveDiscFourPiece(set) {
    return set?.fourPiece ?? null
}

function legacyDriveDiscFourPieceBuff(fourPiece) {
    if (!fourPiece || fourPiece.selfBuff || !effectRules(fourPiece).length) {
        return null
    }

    return {
        scope: "inCombat",
        condition: fourPiece.condition ?? null,
        durationSeconds: fourPiece.durationSeconds ?? null,
        cooldownSeconds: fourPiece.cooldownSeconds ?? null,
        appliesToOutOfCombatPanel: false,
        ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
        effects: effectRules(fourPiece),
    }
}

function driveDiscFourPieceSelfBuff(set) {
    const fourPiece = driveDiscFourPiece(set)
    const buff = fourPiece?.selfBuff ?? legacyDriveDiscFourPieceBuff(fourPiece)
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDiscFourPieceTeamBuff(set) {
    const buff = driveDiscFourPiece(set)?.teamBuff ?? null
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDisc4pcRuntimeKey(setId, part) {
    return `driveDisc4pc:${setId}.${part}`
}

function optimizerDriveDisc4pcBuffKey(runtimeKey) {
    return `optimizerDriveDisc4pc:${runtimeKey}`
}

function optimizerDriveDisc4pcRuntimeKeyFromBuffKey(buffKey) {
    return String(buffKey ?? "").startsWith("optimizerDriveDisc4pc:")
        ? String(buffKey).slice("optimizerDriveDisc4pc:".length)
        : ""
}

function currentSchemeDriveDisc4pcBuffKey(runtimeKey) {
    return `currentSchemeDriveDisc4pc:${runtimeKey}`
}

function currentSchemeDriveDisc4pcRuntimeKeyFromBuffKey(buffKey) {
    return String(buffKey ?? "").startsWith("currentSchemeDriveDisc4pc:")
        ? String(buffKey).slice("currentSchemeDriveDisc4pc:".length)
        : ""
}

function currentFourPieceSetId() {
    return els.fourPieceSetSelect?.value ?? ""
}

function normalizeFourPieceBuffMode(mode) {
    return String(mode ?? "auto") === "manual" ? "manual" : "auto"
}

function clonePlainObject(value, fallback = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return fallback
    }
    try {
        return structuredClone(value)
    } catch {
        return JSON.parse(JSON.stringify(value))
    }
}

function ownFourPieceBuffParts(set = driveDiscSetById(currentFourPieceSetId())) {
    if (!set?.id) {
        return []
    }
    return [
        {
            part: "self",
            label: "装备者效果",
            key: driveDisc4pcRuntimeKey(set.id, "self"),
            buff: driveDiscFourPieceSelfBuff(set),
        },
        {
            part: "team",
            label: "团队效果",
            key: driveDisc4pcRuntimeKey(set.id, "team"),
            buff: driveDiscFourPieceTeamBuff(set),
        },
    ].filter(item => item.buff)
}

function currentFourPieceBuffMode(setId = currentFourPieceSetId()) {
    return normalizeFourPieceBuffMode(optimizerFourPieceBuffModeBySetId?.[setId])
}

function currentFourPieceBuffRuntimeInputs(setId = currentFourPieceSetId()) {
    const source = optimizerFourPieceBuffRuntimeInputsBySetId?.[setId]
    return source && typeof source === "object" && !Array.isArray(source) ? source : {}
}

function setCurrentFourPieceBuffMode(mode, setId = currentFourPieceSetId()) {
    if (!setId) {
        return
    }
    optimizerFourPieceBuffModeBySetId = {
        ...optimizerFourPieceBuffModeBySetId,
        [setId]: normalizeFourPieceBuffMode(mode),
    }
}

function setCurrentFourPieceBuffRuntimeInput(runtimeKey, runtime, setId = currentFourPieceSetId()) {
    if (!setId || !runtimeKey) {
        return
    }
    optimizerFourPieceBuffRuntimeInputsBySetId = {
        ...optimizerFourPieceBuffRuntimeInputsBySetId,
        [setId]: {
            ...currentFourPieceBuffRuntimeInputs(setId),
            [runtimeKey]: clonePlainObject(runtime),
        },
    }
}

function runtimeForOwnFourPieceBuff(part, setId = currentFourPieceSetId()) {
    const stored = currentFourPieceBuffRuntimeInputs(setId)[part.key]
    return runtimeForBuff({ runtime: stored ?? null }, part.buff)
}

function fourPieceSetIdsForDriveDiscs(driveDiscs = []) {
    const counts = new Map()
    for (const disc of driveDiscs) {
        if (disc?.setId) {
            counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
        }
    }
    return [...counts.entries()]
        .filter(([, count]) => count >= 4)
        .map(([setId]) => setId)
}

function currentSchemeFourPieceSetId() {
    const scheme = activeScheme()
    return scheme.kind === "optimized" ? "" : fourPieceSetIdsForDriveDiscs(scheme.driveDiscs)[0] ?? ""
}

function currentSchemeFourPieceBuffMode(setId = currentSchemeFourPieceSetId()) {
    return normalizeFourPieceBuffMode(currentSchemeFourPieceBuffModeBySetId?.[setId])
}

function currentSchemeFourPieceBuffRuntimeInputs(setId = currentSchemeFourPieceSetId()) {
    const source = currentSchemeFourPieceBuffRuntimeInputsBySetId?.[setId]
    return source && typeof source === "object" && !Array.isArray(source) ? source : {}
}

function setCurrentSchemeFourPieceBuffMode(mode, setId = currentSchemeFourPieceSetId()) {
    if (!setId) {
        return
    }
    currentSchemeFourPieceBuffModeBySetId = {
        ...currentSchemeFourPieceBuffModeBySetId,
        [setId]: normalizeFourPieceBuffMode(mode),
    }
}

function setCurrentSchemeFourPieceBuffRuntimeInput(runtimeKey, runtime, setId = currentSchemeFourPieceSetId()) {
    if (!setId || !runtimeKey) {
        return
    }
    currentSchemeFourPieceBuffRuntimeInputsBySetId = {
        ...currentSchemeFourPieceBuffRuntimeInputsBySetId,
        [setId]: {
            ...currentSchemeFourPieceBuffRuntimeInputs(setId),
            [runtimeKey]: clonePlainObject(runtime),
        },
    }
}

function currentSchemeFourPieceBuffParts(set = driveDiscSetById(currentSchemeFourPieceSetId())) {
    return ownFourPieceBuffParts(set)
}

function runtimeForCurrentSchemeFourPieceBuff(part, setId = currentSchemeFourPieceSetId()) {
    const stored = currentSchemeFourPieceBuffRuntimeInputs(setId)[part.key]
    return runtimeForBuff({ runtime: stored ?? null }, part.buff)
}

function currentSchemeFourPieceBuffItemByKey(buffKey) {
    const runtimeKey = currentSchemeDriveDisc4pcRuntimeKeyFromBuffKey(buffKey)
    if (!runtimeKey) {
        return null
    }
    const setId = currentSchemeFourPieceSetId()
    const part = currentSchemeFourPieceBuffParts(driveDiscSetById(setId)).find(item => item.key === runtimeKey)
    if (!part) {
        return null
    }
    return {
        id: runtimeKey,
        sourceKind: "currentSchemeDriveDisc4pc",
        setId,
        runtime: runtimeForCurrentSchemeFourPieceBuff(part, setId),
        ...part,
    }
}

function optimizerFourPieceBuffItemByKey(buffKey) {
    const runtimeKey = optimizerDriveDisc4pcRuntimeKeyFromBuffKey(buffKey)
    if (!runtimeKey) {
        return null
    }
    const part = ownFourPieceBuffParts().find(item => item.key === runtimeKey)
    if (!part) {
        return null
    }
    return {
        id: runtimeKey,
        sourceKind: "optimizerDriveDisc4pc",
        setId: currentFourPieceSetId(),
        runtime: runtimeForOwnFourPieceBuff(part),
        ...part,
    }
}

function driveDisc4pcSetOptions() {
    return displayDriveDiscSets()
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

function teammateCoreOrAdditionalCandidates(ownerId) {
    const normalizedOwnerId = String(ownerId ?? "")
    if (!normalizedOwnerId) {
        return []
    }
    return teammateBuffCandidates().filter(candidate => {
        if (String(candidate.ownerId ?? "") !== normalizedOwnerId) {
            return false
        }
        const source = [
            localizedText(candidate.source),
            localizedText(candidate.sourceLabel),
            localizedText(candidate.name),
        ].filter(Boolean).join(" ")
        return source.includes("核心被动") || source.includes("额外能力")
    })
}

function candidateWithSameSourceDefaults(candidate) {
    if (candidate?.sourceKind !== "teammate") {
        return candidate ? [candidate] : []
    }
    const byKey = new Map()
    for (const item of [candidate, ...teammateCoreOrAdditionalCandidates(candidate.ownerId)]) {
        byKey.set(addedCombatBuffKey(item), item)
    }
    return [...byKey.values()]
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

function renderCombatBuffTeammatePreview(group) {
    if (!els.combatBuffTeammatePreview) {
        return
    }
    els.combatBuffTeammatePreview.innerHTML = ""
    if (!group) {
        els.combatBuffTeammatePreview.hidden = true
        return
    }

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
    const metaLine = document.createElement("span")
    metaLine.textContent = `${group.buffs?.length ?? 0} 个 Buff`
    copy.append(title, metaLine)
    els.combatBuffTeammatePreview.append(avatar, copy)
    els.combatBuffTeammatePreview.hidden = false
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
    renderCombatBuffTeammatePreview(activeGroup)

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
    return new Set(
        [...els.combatSection.querySelectorAll("input[data-combat-buff-id]:checked")]
            .map(input => input.dataset.combatBuffId)
    )
}

function activeCombatBuffIdsForRender() {
    const agentId = els.agentSelect?.value ?? ""
    const inputs = [...els.combatSection.querySelectorAll("input[data-combat-buff-id]")]
    if (inputs.length > 0 && renderedCombatBuffAgentId === agentId) {
        return {
            checkedIds: checkedCombatBuffIds(),
            useDefaultChecked: true,
        }
    }
    const savedIds = savedActiveCombatBuffIds(agentId)
    syncManuallyUncheckedDefaultCombatBuffIds(agentId)
    return {
        checkedIds: savedIds ?? new Set(),
        useDefaultChecked: true,
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

function renderCombatCheckboxList(container, buffs, checkedIds = checkedCombatBuffIds(), { useDefaultChecked = true } = {}) {
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
        const item = checkboxCombatBuffRuntimeItem(buff)
        const runtime = runtimeForBuff(item, buff)
        const row = document.createElement("div")
        row.className = checked ? "combat-check-row active" : "combat-check-row"
        row.dataset.buffKey = checkboxCombatBuffKey(buff)
        const toggle = document.createElement("label")
        toggle.className = "combat-check-toggle"
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
        renderBuffEffectLines(stats, buff, runtime, { fallbackText: effectStatText(buff) })
        copy.append(title, description, stats)
        toggle.append(input, copy)
        row.appendChild(toggle)
        if (checked) {
            renderBuffRuntimeControls(row, item, buff, runtime)
        }
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

    for (const group of addedCombatBuffSourceGroups(added)) {
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
    field.className = "field combat-runtime-field combat-runtime-select-field"
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
    const sourceGroups = SharedCombat.runtimeSourceGroups(buff)
    const stackGroups = SharedCombat.runtimeStackGroups(buff)
    const needsRuntime = hasCoverage || sourceGroups.length > 0 || stackGroups.length > 0
    if (!needsRuntime) {
        return
    }
    const buffKey = item?.sourceKind === "catalogBuff"
        ? catalogCombatBuffKey(item)
        : item?.sourceKind === "checkboxBuff"
            ? checkboxCombatBuffKey(item)
        : item?.sourceKind === "optimizerDriveDisc4pc"
            ? optimizerDriveDisc4pcBuffKey(item.id)
            : item?.sourceKind === "currentSchemeDriveDisc4pc"
                ? currentSchemeDriveDisc4pcBuffKey(item.id)
            : addedCombatBuffKey(item)
    const controls = document.createElement("div")
    controls.className = "combat-runtime-grid"
    controls.dataset.buffKey = buffKey
    if (hasCoverage) {
        const field = document.createElement("label")
        field.className = "field combat-runtime-field combat-runtime-number-field"
        field.innerHTML = `
            <span>覆盖率</span>
            <input type="number" min="${buff.coverage.min ?? 0}" max="${buff.coverage.max ?? 1}" step="${buff.coverage.step ?? 0.1}" value="${runtime.coverage}" data-runtime-coverage>
        `
        controls.appendChild(field)
    }
    for (const sourceGroup of sourceGroups) {
        const primaryId = sourceGroup.ruleIds[0] ?? ""
        const minAttr = Number.isFinite(sourceGroup.min) ? ` min="${sourceGroup.min}"` : ""
        const maxAttr = Number.isFinite(sourceGroup.max) ? ` max="${sourceGroup.max}"` : ""
        const field = document.createElement("label")
        field.className = "field combat-runtime-field combat-runtime-number-field"
        field.innerHTML = `
            <span>${escapeHtml(sourceGroup.label)}</span>
            <input type="number"${minAttr}${maxAttr} step="1" value="${runtime.effects?.[primaryId]?.sourceValue ?? sourceGroup.defaultValue ?? 0}" data-runtime-effect="${escapeHtml(primaryId)}" data-runtime-source-group="${escapeHtml(sourceGroup.key)}" data-runtime-source-value>
        `
        controls.appendChild(field)
    }
    for (const stackGroup of stackGroups) {
        const primaryId = stackGroup.ruleIds[0] ?? ""
        const field = document.createElement("label")
        field.className = "field combat-runtime-field combat-runtime-number-field"
        field.innerHTML = `
            <span>${escapeHtml(stackGroup.label)}</span>
            <input type="number" min="0" max="${stackGroup.maxStacks ?? 1}" step="1" value="${runtime.effects?.[primaryId]?.stacks ?? stackGroup.defaultStacks ?? stackGroup.maxStacks ?? 1}" data-runtime-effect="${escapeHtml(primaryId)}" data-runtime-stack-group="${escapeHtml(stackGroup.key)}" data-runtime-stacks>
        `
        controls.appendChild(field)
    }
    row.appendChild(controls)
}

function runtimeFieldSelector() {
    return "[data-runtime-coverage], [data-runtime-source-value], [data-runtime-stacks]"
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
    return {
        label: inputLabel(input),
        defaultValue: finiteOr(input.defaultValue, 0),
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
    if (optimizerDriveDisc4pcRuntimeKeyFromBuffKey(buffKey)) {
        updateOptimizerFourPieceBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
        return
    }
    if (currentSchemeDriveDisc4pcRuntimeKeyFromBuffKey(buffKey)) {
        updateCurrentSchemeFourPieceBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
        return
    }
    if (checkboxCombatBuffIdFromKey(buffKey)) {
        updateCheckboxCombatBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
        return
    }
    if (catalogCombatBuffIdFromKey(buffKey)) {
        updateCatalogCombatBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
        return
    }

    updateAddedCombatBuffRuntime(buffKey, (runtime, buff) => setRuntimeValue(runtime, field, value, buff))
}

function refreshAddedCombatBuffSummary(buffKey) {
    const optimizerItem = optimizerFourPieceBuffItemByKey(buffKey)
    const currentSchemeItem = currentSchemeFourPieceBuffItemByKey(buffKey)
    const checkboxBuffId = checkboxCombatBuffIdFromKey(buffKey)
    const catalogBuffId = catalogCombatBuffIdFromKey(buffKey)
    const item = optimizerItem ?? currentSchemeItem ?? (checkboxBuffId
        ? checkboxCombatBuffRuntimeItem(allCheckboxCombatBuffs().find(buff => buff.id === checkboxBuffId) ?? {})
        : catalogBuffId
        ? catalogCombatBuffRuntimeItem(displayCombatBuffs().find(buff => buff.id === catalogBuffId) ?? {})
        : addedCombatBuffByKey(buffKey))
    const row = els.fourPieceBuffManualList?.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
        ?? els.currentSchemeFourPieceBuffManualList?.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
        ?? els.combatSection.querySelector(`[data-buff-key="${CSS.escape(buffKey)}"]`)
    const summary = row?.querySelector(".combat-added-stats, .combat-check-stats")
    if (!item || !summary) {
        return
    }
    const buff = optimizerItem?.buff ?? currentSchemeItem?.buff ?? (checkboxBuffId
        ? allCheckboxCombatBuffs().find(candidate => candidate.id === checkboxBuffId)
        : catalogBuffId
        ? displayCombatBuffs().find(candidate => candidate.id === catalogBuffId)
        : resolveAddedCombatBuff(item))
    if (!buff) {
        return
    }
    renderBuffEffectLines(summary, buff, runtimeForBuff(item, buff), { fallbackText: effectStatText(buff) })
}

function runtimeFieldContext(field) {
    const group = field.closest("[data-buff-key]")
    const buffKey = group?.dataset.buffKey
    const optimizerItem = optimizerFourPieceBuffItemByKey(buffKey)
    if (optimizerItem) {
        return {
            buffKey,
            item: optimizerItem,
            buff: optimizerItem.buff,
        }
    }
    const currentSchemeItem = currentSchemeFourPieceBuffItemByKey(buffKey)
    if (currentSchemeItem) {
        return {
            buffKey,
            item: currentSchemeItem,
            buff: currentSchemeItem.buff,
        }
    }
    const checkboxBuffId = checkboxCombatBuffIdFromKey(buffKey)
    if (checkboxBuffId) {
        const buff = allCheckboxCombatBuffs().find(item => item.id === checkboxBuffId)
        return {
            buffKey,
            item: buff ? checkboxCombatBuffRuntimeItem(buff) : null,
            buff,
        }
    }
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
        if (input === els.damageTargetResistance) {
            persistCurrentDamageResistanceInput()
            syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
        }
        await refreshAfterConfigChange()
        setStatus(message, "error")
        return false
    }
    if (input === els.damageTargetResistance) {
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
    }
    await refreshAfterConfigChange()
    return true
}

function renderCombatControls() {
    const { checkedIds, useDefaultChecked } = activeCombatBuffIdsForRender()
    renderCombatCheckboxList(els.selfCombatBuffs, [...agentCombatBuffs(), ...combatBuffsByType("self")], checkedIds, { useDefaultChecked })
    renderCombatCheckboxList(els.wEngineCombatBuffs, wEngineEquippedBuffs(), checkedIds, { useDefaultChecked })
    renderAddedCombatBuffs()
    renderCatalogCombatBuffCards(els.bossCombatBuffs, combatBuffsByType("boss"), checkedIds)
    renderCatalogCombatBuffCards(els.fieldCombatBuffs, combatBuffsByType("field"), checkedIds)
    renderedCombatBuffAgentId = els.agentSelect?.value ?? ""
}

function activeCheckboxCombatBuffs(activeBuffIds = checkedCombatBuffIds()) {
    return allCheckboxCombatBuffs().filter(buff => activeBuffIds.has(buff.id))
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
            const buff = resolveAddedCombatBuff(item)
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = runtimeForBuff(item, buff)
        }
        if (item.sourceKind === "wEngineTeam") {
            wEngineTeamModificationLevels[item.id] = wEngineTeamModificationLevelForItem(item)
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
    for (const buff of activeCheckboxCombatBuffs(new Set(activeBuffIds))) {
        const item = checkboxCombatBuffRuntimeItem(buff)
        runtimeInputs[buff.id] = runtimeForBuff(item, buff)
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
    calculationConfigMode = resolveCalculationConfigMode()
    const events = configuredCalculationEventsForRequest()
    const defaultConfig = calculationConfigMode === ADMIN_DEFAULT_CALCULATION_MODE
        ? adminDefaultCalculationConfig()
        : null
    const preferredSelectedEventId = calculationConfigMode === "custom"
        ? calculationConfigSelectedEventId
        : calculationConfigMode === ADMIN_DEFAULT_CALCULATION_MODE
            ? defaultConfig?.selectedEventId
            : events[0]?.id
    const selectedEventId = events.some(event => event.id === preferredSelectedEventId)
        ? preferredSelectedEventId
        : events[0]?.id
    const selectedSkillEvent = events.find(event => event.id === selectedEventId && ["direct", "sheer"].includes(event.kind))
        ?? events.find(event => ["direct", "sheer"].includes(event.kind))
    return {
        mode: calculationConfigMode,
        agentLevel,
        skillLevelsByCategory: { ...damageSkillLevelsByCategory },
        ...(selectedSkillEvent?.skillMultiplier ? { skillMultiplier: selectedSkillEvent.skillMultiplier } : {}),
        ...(selectedSkillEvent?.skillRef ? { skillRef: selectedSkillEvent.skillRef } : {}),
        ...(selectedSkillEvent?.critMode ? { critMode: selectedSkillEvent.critMode } : {}),
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
    renderCombatControls()
    await refreshAfterConfigChange()
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
    const addedKeys = new Set(addedBuffs.map(addedCombatBuffKey))
    const nextEntries = candidateWithSameSourceDefaults(candidate)
        .filter(item => !addedKeys.has(addedCombatBuffKey(item)))
        .map(addedCombatBuffEntry)
    setCombatBuffDraftAddedBuffs([...addedBuffs, ...nextEntries])
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
    const nextCandidatesByKey = new Map()
    for (const candidate of candidates) {
        for (const item of candidateWithSameSourceDefaults(candidate)) {
            nextCandidatesByKey.set(addedCombatBuffKey(item), item)
        }
    }
    const nextEntries = [...nextCandidatesByKey.values()]
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

function selectedValues(select) {
    return [...select.selectedOptions].map(option => option.value).filter(Boolean)
}

function validSelectValues(select, values = []) {
    const available = new Set([...select.options].map(option => option.value))
    const raw = Array.isArray(values) ? values : [values]
    return [...new Set(raw
        .map(value => String(value ?? "").trim())
        .filter(value => value && available.has(value)))]
}

function firstValidSelectValue(select, values = []) {
    return validSelectValues(select, values)[0] ?? ""
}

function setSelectedValues(select, values = []) {
    const selected = new Set(validSelectValues(select, values))
    for (const option of select.options) {
        option.selected = selected.has(option.value)
    }
}

function driveDiscSetById(setId) {
    return displayDriveDiscSets().find(set => set.id === setId) ?? null
}

function driveDiscSetIcon(set) {
    return set?.images?.icon || "/assets/drive-discs/empty.svg"
}

function preferredDriveDiscDefaultSetId(agent = {}) {
    return String(
        agent.preferredDriveDiscs?.defaultSetId
            ?? agent.preferredDriveDiscs?.defaultSet
            ?? agent.defaultDriveDiscSetId
            ?? "",
    )
}

function defaultFourPieceSetIdForAgent(agentId = els.agentSelect?.value) {
    const agent = getAgent(agentId)
    const preferredSetId = preferredDriveDiscDefaultSetId(agent)
    if (driveDiscSetById(preferredSetId)) {
        return preferredSetId
    }
    return displayDriveDiscSets()[0]?.id ?? ""
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
    const selected = new Set(twoPieceSetDraftIds ?? selectedValues(els.twoPieceSetSelect))
    for (const input of els.twoPieceSetChoices.querySelectorAll("input[data-two-piece-set-limit]")) {
        input.checked = selected.has(input.value)
        input.closest(".two-piece-choice")?.classList.toggle("active", input.checked)
    }
    if (twoPieceSetDraftIds) {
        updateTwoPieceSetModalSummary()
    } else {
        renderTwoPieceSelectedSummary()
    }
}

function syncFourPieceSetChoices() {
    const selected = fourPieceSetDraftId ?? els.fourPieceSetSelect.value
    for (const input of els.fourPieceSetChoices.querySelectorAll("input[data-four-piece-set-limit]")) {
        input.checked = input.value === selected
        input.closest(".two-piece-choice")?.classList.toggle("active", input.checked)
    }
    if (fourPieceSetDraftId !== null) {
        updateFourPieceSetModalSummary()
    } else {
        renderFourPieceSelectedSummary()
    }
}

function updateTwoPieceSetModalSummary() {
    if (!els.twoPieceSetModalSummary) {
        return
    }
    const selected = (twoPieceSetDraftIds ?? selectedValues(els.twoPieceSetSelect))
        .map(driveDiscSetById)
        .filter(Boolean)
    els.twoPieceSetModalSummary.textContent = selected.length
        ? `已选择 ${selected.length} 个额外 2 件套`
        : "未选择额外 2 件套"
    if (els.applyTwoPieceSetModalBtn) {
        const current = selectedValues(els.twoPieceSetSelect).sort().join("|")
        const draft = [...(twoPieceSetDraftIds ?? [])].sort().join("|")
        els.applyTwoPieceSetModalBtn.disabled = current === draft
    }
}

function updateFourPieceSetModalSummary() {
    if (!els.fourPieceSetModalSummary) {
        return
    }
    const selectedId = fourPieceSetDraftId ?? els.fourPieceSetSelect.value
    const set = driveDiscSetById(selectedId)
    els.fourPieceSetModalSummary.textContent = set ? `已选择 ${nameOf(set)}` : "未选择限定 4 件套"
    if (els.applyFourPieceSetModalBtn) {
        els.applyFourPieceSetModalBtn.disabled = selectedId === els.fourPieceSetSelect.value
    }
}

function twoPieceSetEffectText(set) {
    return storedEffectRulesText(set?.twoPiece) || "2件套效果未录入"
}

function renderFourPieceSelectedSummary() {
    const set = driveDiscSetById(els.fourPieceSetSelect.value)
    els.fourPieceSelectedSummary.innerHTML = ""
    if (!set) {
        const empty = document.createElement("span")
        empty.className = "two-piece-selected-empty"
        empty.textContent = "未选择限定 4 件套"
        els.fourPieceSelectedSummary.appendChild(empty)
        return
    }
    const item = document.createElement("span")
    item.className = "two-piece-selected-chip set-selected-chip"
    item.innerHTML = `
        <img src="${escapeHtml(driveDiscSetIcon(set))}" alt="" loading="lazy">
        <span>${escapeHtml(nameOf(set))}</span>
    `
    els.fourPieceSelectedSummary.appendChild(item)
}

function renderFourPieceBuffMode(mode = currentFourPieceBuffMode()) {
    els.fourPieceBuffModeAuto?.classList.toggle("active", mode === "auto")
    els.fourPieceBuffModeManual?.classList.toggle("active", mode === "manual")
    els.fourPieceBuffModeAuto?.setAttribute("aria-pressed", String(mode === "auto"))
    els.fourPieceBuffModeManual?.setAttribute("aria-pressed", String(mode === "manual"))
}

function renderFourPieceBuffSettings() {
    if (!els.fourPieceBuffSection) {
        return
    }
    const set = driveDiscSetById(currentFourPieceSetId())
    const parts = ownFourPieceBuffParts(set)
    const mode = currentFourPieceBuffMode(set?.id)
    renderFourPieceBuffMode(mode)
    els.fourPieceBuffSummary.innerHTML = ""
    els.fourPieceBuffManualList.innerHTML = ""

    if (!set) {
        els.fourPieceBuffSummary.textContent = "请选择限定 4 件套。"
        els.fourPieceBuffManualList.hidden = true
        return
    }
    if (!parts.length) {
        els.fourPieceBuffSummary.textContent = "当前 4 件套没有可自动应用的局内 Buff。"
        els.fourPieceBuffManualList.hidden = true
        return
    }

    const summaryPrefix = mode === "manual" ? "手动" : "自动"
    for (const part of parts) {
        const runtime = mode === "manual"
            ? runtimeForOwnFourPieceBuff(part, set.id)
            : defaultRuntimeForBuff(part.buff)
        const line = document.createElement("span")
        line.textContent = `${summaryPrefix}｜${part.label}：${storedEffectRulesText(part.buff, runtime) || effectStatText(part.buff) || "-"}`
        els.fourPieceBuffSummary.appendChild(line)
    }

    els.fourPieceBuffManualList.hidden = mode !== "manual"
    if (mode !== "manual") {
        return
    }

    for (const part of parts) {
        const runtime = runtimeForOwnFourPieceBuff(part, set.id)
        setCurrentFourPieceBuffRuntimeInput(part.key, runtime, set.id)
        const row = document.createElement("article")
        row.className = "optimizer-four-piece-buff-card combat-added-card"
        row.dataset.buffKey = optimizerDriveDisc4pcBuffKey(part.key)

        const title = document.createElement("strong")
        title.textContent = `${nameOf(set)}｜${part.label}`
        const description = document.createElement("p")
        description.textContent = localizedText(part.buff.description) || localizedText(part.buff.conditionLabel) || localizedText(part.buff.condition) || "手动覆盖本次优化评分使用的 4 件套效果参数。"
        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, part.buff, runtime, { fallbackText: effectStatText(part.buff) })

        row.append(title, description, stats)
        renderBuffRuntimeControls(row, {
            id: part.key,
            sourceKind: "optimizerDriveDisc4pc",
            runtime,
        }, part.buff, runtime)
        if (!row.querySelector(".combat-runtime-grid")) {
            const note = document.createElement("span")
            note.className = "optimizer-four-piece-buff-note"
            note.textContent = "此效果没有可调参数，将按当前默认建模生效。"
            row.appendChild(note)
        }
        els.fourPieceBuffManualList.appendChild(row)
    }
}

function renderCurrentSchemeFourPieceBuffMode(mode = currentSchemeFourPieceBuffMode()) {
    els.currentSchemeFourPieceBuffModeAuto?.classList.toggle("active", mode === "auto")
    els.currentSchemeFourPieceBuffModeManual?.classList.toggle("active", mode === "manual")
    els.currentSchemeFourPieceBuffModeAuto?.setAttribute("aria-pressed", String(mode === "auto"))
    els.currentSchemeFourPieceBuffModeManual?.setAttribute("aria-pressed", String(mode === "manual"))
}

function renderCurrentSchemeFourPieceBuffSettings() {
    if (!els.currentSchemeFourPieceBuffSection) {
        return
    }
    const setId = currentSchemeFourPieceSetId()
    const set = driveDiscSetById(setId)
    const parts = currentSchemeFourPieceBuffParts(set)
    const mode = currentSchemeFourPieceBuffMode(setId)
    renderCurrentSchemeFourPieceBuffMode(mode)
    els.currentSchemeFourPieceBuffSummary.innerHTML = ""
    els.currentSchemeFourPieceBuffManualList.innerHTML = ""
    els.currentSchemeFourPieceBuffSection.hidden = !setId

    if (!setId) {
        els.currentSchemeFourPieceBuffSummary.textContent = "当前方案没有激活 4 件套 Buff。"
        els.currentSchemeFourPieceBuffManualList.hidden = true
        return
    }
    if (!parts.length) {
        els.currentSchemeFourPieceBuffSummary.textContent = "当前方案的 4 件套没有可自动应用的局内 Buff。"
        els.currentSchemeFourPieceBuffManualList.hidden = true
        return
    }

    const summaryPrefix = mode === "manual" ? "手动" : "自动"
    for (const part of parts) {
        const runtime = mode === "manual"
            ? runtimeForCurrentSchemeFourPieceBuff(part, set.id)
            : defaultRuntimeForBuff(part.buff)
        const line = document.createElement("span")
        line.textContent = `${summaryPrefix}｜${part.label}：${storedEffectRulesText(part.buff, runtime) || effectStatText(part.buff) || "-"}`
        els.currentSchemeFourPieceBuffSummary.appendChild(line)
    }

    els.currentSchemeFourPieceBuffManualList.hidden = mode !== "manual"
    if (mode !== "manual") {
        return
    }

    for (const part of parts) {
        const runtime = runtimeForCurrentSchemeFourPieceBuff(part, set.id)
        setCurrentSchemeFourPieceBuffRuntimeInput(part.key, runtime, set.id)
        const row = document.createElement("article")
        row.className = "optimizer-four-piece-buff-card combat-added-card"
        row.dataset.buffKey = currentSchemeDriveDisc4pcBuffKey(part.key)

        const title = document.createElement("strong")
        title.textContent = `${nameOf(set)}｜${part.label}`
        const description = document.createElement("p")
        description.textContent = localizedText(part.buff.description) || localizedText(part.buff.conditionLabel) || localizedText(part.buff.condition) || "手动覆盖当前方案预览使用的 4 件套效果参数。"
        const stats = document.createElement("span")
        stats.className = "combat-added-stats combat-buff-effect-lines"
        renderBuffEffectLines(stats, part.buff, runtime, { fallbackText: effectStatText(part.buff) })

        row.append(title, description, stats)
        renderBuffRuntimeControls(row, {
            id: part.key,
            sourceKind: "currentSchemeDriveDisc4pc",
            runtime,
        }, part.buff, runtime)
        if (!row.querySelector(".combat-runtime-grid")) {
            const note = document.createElement("span")
            note.className = "optimizer-four-piece-buff-note"
            note.textContent = "此效果没有可调参数，将按当前默认建模生效。"
            row.appendChild(note)
        }
        els.currentSchemeFourPieceBuffManualList.appendChild(row)
    }
}

function renderTwoPieceSelectedSummary() {
    const selected = selectedValues(els.twoPieceSetSelect)
        .map(driveDiscSetById)
        .filter(Boolean)
    els.twoPieceSelectedSummary.innerHTML = ""
    if (!selected.length) {
        const empty = document.createElement("span")
        empty.className = "two-piece-selected-empty"
        empty.textContent = "未选择额外 2 件套"
        els.twoPieceSelectedSummary.appendChild(empty)
        return
    }
    for (const set of selected) {
        const item = document.createElement("span")
        item.className = "two-piece-selected-chip"
        item.innerHTML = `
            <span>${escapeHtml(nameOf(set))}</span>
            <button type="button" data-remove-two-piece-set="${escapeHtml(set.id)}" aria-label="移除 ${escapeHtml(nameOf(set))}"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg></button>
        `
        els.twoPieceSelectedSummary.appendChild(item)
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
    syncTwoPieceSetChoices()
    els.twoPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
}

function setFourPieceSetSelected(setId) {
    const option = [...els.fourPieceSetSelect.options].find(item => item.value === setId)
    if (!option) {
        return
    }
    els.fourPieceSetSelect.value = setId
    syncFourPieceSetChoices()
    els.fourPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
}

function openFourPieceSetModal() {
    fourPieceSetDraftId = els.fourPieceSetSelect.value
    syncFourPieceSetChoices()
    els.fourPieceSetModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeFourPieceSetModal() {
    els.fourPieceSetModal.hidden = true
    document.body.classList.remove("modal-open")
    fourPieceSetDraftId = null
    syncFourPieceSetChoices()
}

function openTwoPieceSetModal() {
    twoPieceSetDraftIds = selectedValues(els.twoPieceSetSelect)
    syncTwoPieceSetChoices()
    els.twoPieceSetModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeTwoPieceSetModal() {
    els.twoPieceSetModal.hidden = true
    document.body.classList.remove("modal-open")
    twoPieceSetDraftIds = null
    syncTwoPieceSetChoices()
}

async function applyFourPieceSetModalSelection() {
    if (fourPieceSetDraftId !== null && fourPieceSetDraftId !== els.fourPieceSetSelect.value) {
        els.fourPieceSetSelect.value = fourPieceSetDraftId
        syncFourPieceSetChoices()
        els.fourPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
    }
    closeFourPieceSetModal()
}

async function applyTwoPieceSetModalSelection() {
    if (twoPieceSetDraftIds) {
        const current = selectedValues(els.twoPieceSetSelect).sort().join("|")
        const draft = [...twoPieceSetDraftIds].sort().join("|")
        if (current !== draft) {
            setSelectedValues(els.twoPieceSetSelect, twoPieceSetDraftIds)
            syncTwoPieceSetChoices()
            els.twoPieceSetSelect.dispatchEvent(new Event("change", { bubbles: true }))
        }
    }
    closeTwoPieceSetModal()
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

function collectMainStatLimits() {
    return Object.fromEntries(OPTIMIZER_MAIN_STAT_SLOTS.map(slot => [
        slot,
        selectedValues(els[`slot${slot}MainStats`]),
    ]))
}

function finiteInputNumber(value) {
    const text = String(value ?? "").trim()
    if (!text) {
        return null
    }
    const number = Number(text)
    return Number.isFinite(number) ? number : null
}

function collectMinimums() {
    return Object.fromEntries(OPTIMIZER_MINIMUM_FIELDS
        .map(([stat, elementKey]) => [stat, finiteInputNumber(els[elementKey].value)])
        .filter(([, value]) => value !== null))
}

function collectParallelSettings() {
    return {
        workerCount: "auto",
    }
}

function collectFourPieceBuffRuntimeInputsForSet(setId = currentFourPieceSetId()) {
    if (!setId || currentFourPieceBuffMode(setId) !== "manual") {
        return {}
    }
    return Object.fromEntries(
        ownFourPieceBuffParts(driveDiscSetById(setId))
            .map(part => [part.key, runtimeForOwnFourPieceBuff(part, setId)])
    )
}

function collectStoredFourPieceBuffRuntimeInputsForSet(setId = currentFourPieceSetId()) {
    if (!setId) {
        return {}
    }
    const stored = clonePlainObject(currentFourPieceBuffRuntimeInputs(setId))
    if (currentFourPieceBuffMode(setId) !== "manual") {
        return stored
    }
    return {
        ...stored,
        ...Object.fromEntries(
            ownFourPieceBuffParts(driveDiscSetById(setId))
                .map(part => [part.key, runtimeForOwnFourPieceBuff(part, setId)]),
        ),
    }
}

function collectFourPieceBuffSettingsForRequest() {
    const setId = currentFourPieceSetId()
    const mode = currentFourPieceBuffMode(setId)
    return {
        fourPieceBuffMode: mode,
        ...(mode === "manual"
            ? { fourPieceBuffRuntimeInputs: collectFourPieceBuffRuntimeInputsForSet(setId) }
            : {}),
    }
}

function collectOptimizationSettings() {
    return {
        algorithm: els.algorithmSelect.value,
        ...collectParallelSettings(),
        fourPieceSetId: els.fourPieceSetSelect.value,
        twoPieceSetIds: selectedValues(els.twoPieceSetSelect),
        ...collectFourPieceBuffSettingsForRequest(),
        objective: "damage",
        mainStatLimits: collectMainStatLimits(),
        minimums: collectMinimums(),
    }
}

function collectStoredOptimizerConfig() {
    return {
        algorithm: els.algorithmSelect.value,
        fourPieceSetId: els.fourPieceSetSelect.value,
        twoPieceSetIds: selectedValues(els.twoPieceSetSelect),
        fourPieceBuffMode: currentFourPieceBuffMode(),
        fourPieceBuffModeBySetId: {
            ...optimizerFourPieceBuffModeBySetId,
            ...(currentFourPieceSetId() ? { [currentFourPieceSetId()]: currentFourPieceBuffMode() } : {}),
        },
        fourPieceBuffRuntimeInputs: collectStoredFourPieceBuffRuntimeInputsForSet(currentFourPieceSetId()),
        fourPieceBuffRuntimeInputsBySetId: {
            ...clonePlainObject(optimizerFourPieceBuffRuntimeInputsBySetId),
            ...(currentFourPieceSetId() ? { [currentFourPieceSetId()]: collectStoredFourPieceBuffRuntimeInputsForSet(currentFourPieceSetId()) } : {}),
        },
        mainStatLimits: collectMainStatLimits(),
        minimums: collectMinimums(),
    }
}

function applyStoredFourPieceBuffConfig(fourPieceSetId, optimizer = {}) {
    optimizerFourPieceBuffModeBySetId = clonePlainObject(optimizer.fourPieceBuffModeBySetId)
    optimizerFourPieceBuffRuntimeInputsBySetId = clonePlainObject(optimizer.fourPieceBuffRuntimeInputsBySetId)

    if (fourPieceSetId && optimizer.fourPieceBuffMode) {
        optimizerFourPieceBuffModeBySetId[fourPieceSetId] = normalizeFourPieceBuffMode(optimizer.fourPieceBuffMode)
    }
    if (fourPieceSetId && optimizer.fourPieceBuffRuntimeInputs && typeof optimizer.fourPieceBuffRuntimeInputs === "object") {
        optimizerFourPieceBuffRuntimeInputsBySetId[fourPieceSetId] = clonePlainObject(optimizer.fourPieceBuffRuntimeInputs)
    }
}

function applyStoredMainStatLimits(mainStatLimits = {}) {
    for (const slot of OPTIMIZER_MAIN_STAT_SLOTS) {
        const select = els[`slot${slot}MainStats`]
        setSelectedValues(select, mainStatLimits?.[slot] ?? mainStatLimits?.[String(slot)] ?? [])
        syncMainStatChoices(select, slot)
    }
}

function applyStoredMinimums(minimums = {}) {
    for (const [stat, elementKey] of OPTIMIZER_MINIMUM_FIELDS) {
        const value = finiteInputNumber(minimums?.[stat])
        els[elementKey].value = value === null ? "" : String(value)
    }
}

function applyStoredOptimizerConfig(agentId = els.agentSelect.value, storedOptimizerConfig = configForAgent(agentId).optimizer) {
    const optimizer = storedOptimizerConfig && typeof storedOptimizerConfig === "object" ? storedOptimizerConfig : {}
    const algorithm = firstValidSelectValue(els.algorithmSelect, optimizer.algorithm)
        || firstValidSelectValue(els.algorithmSelect, DEFAULT_OPTIMIZER_ALGORITHM)
        || els.algorithmSelect.options[0]?.value
        || ""
    const fourPieceSetId = firstValidSelectValue(els.fourPieceSetSelect, optimizer.fourPieceSetId)
        || firstValidSelectValue(els.fourPieceSetSelect, defaultFourPieceSetIdForAgent(agentId))
        || els.fourPieceSetSelect.options[0]?.value
        || ""

    if (algorithm) {
        els.algorithmSelect.value = algorithm
    }
    if (fourPieceSetId) {
        els.fourPieceSetSelect.value = fourPieceSetId
    }
    setSelectedValues(els.twoPieceSetSelect, optimizer.twoPieceSetIds ?? optimizer.twoPieceSetId ?? [])
    applyStoredFourPieceBuffConfig(fourPieceSetId, optimizer)
    applyStoredMainStatLimits(optimizer.mainStatLimits)
    applyStoredMinimums(optimizer.minimums)
    syncFourPieceSetChoices()
    syncTwoPieceSetChoices()
    renderFourPieceBuffSettings()
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

function activeDriveDisc4pcBuffIdsForResult(result = {}) {
    const counts = new Map()
    for (const disc of result.driveDiscs ?? []) {
        if (disc?.setId) {
            counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
        }
    }
    if (!counts.size) {
        for (const summary of result.setSummary ?? []) {
            if (summary?.fourPieceActive && summary?.setId) {
                counts.set(summary.setId, Math.max(4, Number(summary.count ?? 4)))
            }
        }
    }
    const ids = []
    for (const [setId, count] of counts.entries()) {
        if (count < 4) {
            continue
        }
        const set = getSet(setId)
        if (driveDiscFourPieceSelfBuff(set)) {
            ids.push(`driveDisc4pc:${setId}.self`)
        }
        if (driveDiscFourPieceTeamBuff(set)) {
            ids.push(`driveDisc4pc:${setId}.team`)
        }
    }
    return ids
}

function collectRequestPayloadForResult(result) {
    const payload = collectRequestPayload({ driveDiscs: result?.driveDiscs ?? [] })
    const activeBuffIds = new Set(payload.combatBuffs?.activeBuffIds ?? [])
    const fourPieceBuffIds = activeDriveDisc4pcBuffIdsForResult(result)
    for (const id of fourPieceBuffIds) {
        activeBuffIds.add(id)
    }
    const settings = lastCompletedOptimizationSettings ?? collectOptimizationSettings()
    const fourPieceRuntimeInputs = normalizeFourPieceBuffMode(settings?.fourPieceBuffMode) === "manual"
        && settings?.fourPieceBuffRuntimeInputs
        && typeof settings.fourPieceBuffRuntimeInputs === "object"
        && !Array.isArray(settings.fourPieceBuffRuntimeInputs)
            ? Object.fromEntries(fourPieceBuffIds
                .map(id => [id, settings.fourPieceBuffRuntimeInputs[id]])
                .filter(([, runtime]) => runtime && typeof runtime === "object" && !Array.isArray(runtime))
                .map(([id, runtime]) => [id, clonePlainObject(runtime)]))
            : {}
    const runtimeInputs = {
        ...(payload.combatBuffs?.runtimeInputs ?? {}),
        ...fourPieceRuntimeInputs,
    }
    payload.combatBuffs = {
        ...(payload.combatBuffs ?? {}),
        activeBuffIds: [...activeBuffIds],
        runtimeInputs,
    }
    return payload
}

function collectRequestPayloadForScheme(scheme = activeScheme()) {
    if (scheme.kind === "optimized") {
        return collectRequestPayloadForResult(optimizationResults[scheme.resultIndex])
    }

    const payload = collectRequestPayload({ driveDiscs: scheme.driveDiscs ?? [] })
    const activeBuffIds = new Set(payload.combatBuffs?.activeBuffIds ?? [])
    const fourPieceBuffIds = activeDriveDisc4pcBuffIdsForResult(scheme)
    for (const id of fourPieceBuffIds) {
        activeBuffIds.add(id)
    }
    const setId = fourPieceSetIdsForDriveDiscs(scheme.driveDiscs)[0] ?? ""
    const fourPieceRuntimeInputs = setId && currentSchemeFourPieceBuffMode(setId) === "manual"
        ? Object.fromEntries(fourPieceBuffIds
            .map(id => [id, currentSchemeFourPieceBuffRuntimeInputs(setId)[id]])
            .filter(([, runtime]) => runtime && typeof runtime === "object" && !Array.isArray(runtime))
            .map(([id, runtime]) => [id, clonePlainObject(runtime)]))
        : {}
    payload.combatBuffs = {
        ...(payload.combatBuffs ?? {}),
        activeBuffIds: [...activeBuffIds],
        runtimeInputs: {
            ...(payload.combatBuffs?.runtimeInputs ?? {}),
            ...fourPieceRuntimeInputs,
        },
    }
    return payload
}

function collectDriveDiscAnalysisPayload() {
    const scheme = activeScheme()
    if ((scheme.driveDiscs ?? []).length < 6) {
        return null
    }
    return collectRequestPayloadForScheme(scheme)
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
    hp: "局内生命值",
    atk: "局内攻击力",
    sheerForce: "局内贯穿力",
    sheerForceFlat: "固定贯穿力",
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
    windDmg: "风属性增伤",
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
    "windDmg",
    "penRatio",
])

function storedStatLabel(key, mode = "") {
    return combatUi.storedStatLabel(key, mode)
}

function driveDiscSetForDisc(disc) {
    return getSet(disc?.setId)
        ?? displayDriveDiscSets().find(item =>
            item.name?.zhCN === disc?.setName
            || item.name?.en === disc?.setName
            || item.id === disc?.setName
        )
        ?? null
}

function discIcon(discOrSet) {
    const set = discOrSet?.partition ? driveDiscSetForDisc(discOrSet) : discOrSet
    return set?.images?.icon ?? "/assets/drive-discs/empty.svg"
}

function driveDiscById(id) {
    return (store?.driveDiscs ?? []).find(disc => disc.id === id) ?? null
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
        source: disc.source ?? null,
    }
}

function sanitizeDiscIdsBySlot(selectedIdsBySlot = {}) {
    return Object.fromEntries(
        Object.entries(selectedIdsBySlot ?? {})
            .map(([slot, id]) => [String(Number(slot)), String(id ?? "").trim()])
            .filter(([slot, id]) => {
                const disc = driveDiscById(id)
                return Number(slot) >= 1 && Number(slot) <= 6 && disc && Number(disc.partition) === Number(slot)
            }),
    )
}

function equippedDriveDiscIdsForAgent(agentId) {
    const byPartition = new Map()
    for (const disc of store?.driveDiscs ?? []) {
        if (disc.equippedBy !== agentId || !disc.partition) {
            continue
        }
        if (!byPartition.has(disc.partition)) {
            byPartition.set(String(disc.partition), disc.id)
        }
    }
    return Object.fromEntries(byPartition)
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
    return equippedDriveDiscIdsForAgent(agentId)
}

function driveDiscLoadoutsForAgent(agentId) {
    return (store?.driveDiscLoadouts ?? [])
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

function selectedDriveDiscsForAgent(agentId, mode = selectedDiscModeForAgent(agentId), selectedLoadoutId = loadoutIdForAgent(agentId)) {
    const selectedIds = normalizeHomeDiscMode(mode) === "loadout"
        ? loadoutDiscIdsForAgent(agentId, selectedLoadoutId)
        : manualDiscIdsFromSavedConfig(agentId)
    return Object.entries(selectedIds)
        .map(([slot, id]) => {
            const disc = driveDiscById(id)
            return disc && Number(disc.partition) === Number(slot)
                ? toCalculatorDriveDisc(disc)
                : null
        })
        .filter(Boolean)
        .sort((left, right) => Number(left.partition) - Number(right.partition))
}

function saveCurrentHomeSelection({ mode = currentHomeDiscMode(), manualDriveDiscIdsBySlot, selectedLoadoutId } = {}) {
    const agentId = els.agentSelect.value
    if (!agentId) {
        return
    }

    const selection = loadHomeSelection()
    const byAgent = { ...(selection.byAgent ?? {}) }
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(mode)
    const nextManualDriveDiscIdsBySlot = manualDriveDiscIdsBySlot === undefined
        ? manualDiscIdsFromSavedConfig(agentId)
        : sanitizeDiscIdsBySlot(manualDriveDiscIdsBySlot)
    const nextSelectedLoadoutId = selectedLoadoutId === undefined
        ? loadoutIdForAgent(agentId, previousConfig.selectedLoadoutId)
        : loadoutIdForAgent(agentId, selectedLoadoutId)
    const driveDiscIdsBySlot = activeDiscIdsForConfig(
        agentId,
        driveDiscMode,
        nextManualDriveDiscIdsBySlot,
        nextSelectedLoadoutId,
    )

    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: els.wEngineSelect.value,
        wEngineModificationLevel: selectedWEngineModificationLevel(getWEngine(els.wEngineSelect.value)),
        coreSkillLevel: els.coreSkillSelect.value,
        cinemaLevel: selectedCinemaLevel(),
        driveDiscMode,
        manualDriveDiscIdsBySlot: nextManualDriveDiscIdsBySlot,
        selectedLoadoutId: nextSelectedLoadoutId,
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(driveDiscIdsBySlot),
        combat: combatConfigForSave(previousConfig.combat, {
            addedBuffs: sanitizeAddedCombatBuffs(previousConfig.combat?.addedBuffs ?? []),
        }),
        damage: collectDamageConfig(),
        currentSchemeFourPieceBuffModeBySetId: clonePlainObject(currentSchemeFourPieceBuffModeBySetId),
        currentSchemeFourPieceBuffRuntimeInputsBySetId: clonePlainObject(currentSchemeFourPieceBuffRuntimeInputsBySetId),
        optimizer: collectStoredOptimizerConfig(),
    }
    saveHomeSelection({ currentAgentId: agentId, byAgent })
}

function setHomeDiscMode(mode) {
    const useLoadout = normalizeHomeDiscMode(mode) === "loadout"
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
    const selectedLoadoutId = loadoutIdForAgent(agentId, configForAgent(agentId).selectedLoadoutId)
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
        option.textContent = `${loadout.name}${Number.isFinite(Number(loadout.score)) ? ` · ${Number(loadout.score).toFixed(0)}` : ""}${missingSlots.length ? ` · 缺 ${missingSlots.join("、")}号位` : ""}`
        option.disabled = missingSlots.length > 0
        option.selected = loadout.id === selectedLoadoutId
        els.homeLoadoutSelect.appendChild(option)
    }
    els.homeLoadoutSelect.disabled = loadouts.every(loadout => !loadoutIsComplete(loadout))
}

function syncDiscSourceControls(agentId = els.agentSelect.value) {
    renderHomeLoadoutSelect(agentId)
    setHomeDiscMode(selectedDiscModeForAgent(agentId))
}

function schemeDriveDiscIdsBySlot(driveDiscs = []) {
    return Object.fromEntries(
        [...driveDiscs]
            .filter(disc => disc?.id && Number(disc.partition) >= 1 && Number(disc.partition) <= 6)
            .map(disc => [String(Number(disc.partition)), disc.id]),
    )
}

function manualScheme() {
    const agentId = els.agentSelect.value
    const driveDiscs = selectedDriveDiscsForAgent(agentId, "manual")
    return {
        kind: "manual",
        key: MANUAL_SCHEME_KEY,
        label: "自选",
        driveDiscs,
        driveDiscIdsBySlot: schemeDriveDiscIdsBySlot(driveDiscs),
    }
}

function loadoutScheme() {
    const agentId = els.agentSelect.value
    const selectedLoadoutId = loadoutIdForAgent(agentId, configForAgent(agentId).selectedLoadoutId)
    const loadout = driveDiscLoadoutsForAgent(agentId).find(item => item.id === selectedLoadoutId) ?? null
    const driveDiscs = selectedDriveDiscsForAgent(agentId, "loadout", selectedLoadoutId)
    return {
        kind: "loadout",
        key: LOADOUT_SCHEME_KEY,
        label: "套装",
        name: loadout?.name ?? "",
        driveDiscs,
        driveDiscIdsBySlot: schemeDriveDiscIdsBySlot(driveDiscs),
    }
}

function optimizedScheme(result, index) {
    return {
        kind: "optimized",
        key: `optimized:${index}`,
        label: `#${index + 1}`,
        rank: result.rank,
        score: result.score,
        data: result.data,
        stale: optimizationResultsDirty,
        resultIndex: index,
        driveDiscs: result.driveDiscs ?? [],
        driveDiscIdsBySlot: result.driveDiscIdsBySlot ?? schemeDriveDiscIdsBySlot(result.driveDiscs ?? []),
    }
}

function currentInputScheme(mode = selectedDiscModeForAgent(els.agentSelect.value)) {
    return normalizeHomeDiscMode(mode) === "loadout" ? loadoutScheme() : manualScheme()
}

function optimizedSchemes() {
    return optimizationResults.map(optimizedScheme)
}

function schemeTabs() {
    return [
        manualScheme(),
        loadoutScheme(),
        ...optimizedSchemes(),
    ]
}

function activeScheme() {
    return schemeTabs().find(item => item.key === activeSchemeKey)
        ?? currentInputScheme()
}

function setActiveSchemeKey(key) {
    const normalizedKey = String(key ?? "")
    const scheme = schemeTabs().find(item => item.key === normalizedKey)
    activeSchemeKey = scheme?.key ?? selectedDiscModeForAgent(els.agentSelect.value)
}

function syncActiveResultIndexFromScheme() {
    const scheme = activeScheme()
    activeResultIndex = scheme.kind === "optimized" ? Number(scheme.resultIndex) : -1
}

function setActiveDiscModeScheme(mode) {
    const nextMode = normalizeHomeDiscMode(mode)
    activeSchemeKey = nextMode
    setHomeDiscMode(nextMode)
}

function selectedOptimizedScheme() {
    const scheme = activeScheme()
    return scheme.kind === "optimized" ? scheme : null
}

function driveDiscSetSummary(driveDiscs = []) {
    const counts = new Map()
    for (const disc of driveDiscs) {
        if (!disc?.setId) {
            continue
        }
        counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || nameOf(getSet(a[0])).localeCompare(nameOf(getSet(b[0])), "zh-CN"))
        .map(([setId, count]) => `${nameOf(getSet(setId)) || setId} ${count}`)
        .join(" / ")
}

function populateHomeDiscModalFilters(slot) {
    const discs = (store?.driveDiscs ?? []).filter(disc => Number(disc.partition) === Number(slot))
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
    return (store?.driveDiscs ?? [])
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
        const subStats = (disc.subStats ?? [])
            .map(item => `${storedStatLabel(item.stat, item.mode)} ${formatStoredValue(item.stat, item.value, item.mode)}`)
            .join(" / ")
        const button = document.createElement("button")
        button.type = "button"
        button.className = disc.id === selectedId ? "home-disc-option active" : "home-disc-option"
        button.dataset.discId = disc.id
        button.innerHTML = `
            <img src="${escapeHtml(discIcon(disc))}" alt="">
            <div class="home-disc-option-main">
                <strong>${escapeHtml(discDisplaySetName(disc))}</strong>
                <span>${escapeHtml(`${disc.partition}号位 · ${disc.rarity}+${disc.level}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`)}</span>
            </div>
            <div class="home-disc-option-stat">
                <strong>${escapeHtml(`${storedStatLabel(disc.mainStat?.stat, disc.mainStat?.mode)} ${formatStoredValue(disc.mainStat?.stat, disc.mainStat?.value, disc.mainStat?.mode)}`)}</strong>
                <span>${escapeHtml(subStats || "-")}</span>
            </div>
        `
        els.homeDiscOptionList.appendChild(button)
    }
}

function openHomeDiscModal(slot) {
    if (!els.homeDiscModal) {
        return
    }
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
    if (!els.homeDiscModal) {
        return
    }
    els.homeDiscModal.hidden = true
    document.body.classList.remove("modal-open")
    activeDiscSlot = null
}

async function refreshManualSelectionAfterChange() {
    activeSchemeKey = MANUAL_SCHEME_KEY
    setHomeDiscMode("manual")
    syncDiscSourceControls()
    saveCurrentHomeSelection({ mode: "manual" })
    renderResultTabs()
    renderResultList()
    await refreshActiveSchemePreview()
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
    await refreshManualSelectionAfterChange()
    closeHomeDiscModal()
}

async function clearHomeDiscSlot() {
    if (!activeDiscSlot) {
        return
    }
    const next = { ...manualDiscIdsFromSavedConfig(els.agentSelect.value) }
    delete next[String(activeDiscSlot)]
    saveCurrentHomeSelection({ mode: "manual", manualDriveDiscIdsBySlot: next })
    await refreshManualSelectionAfterChange()
    closeHomeDiscModal()
}

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
                ${["direct", "sheer"].includes(event.kind) ? directEventVariantHtml(event) : ""}
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

function schemeHeading(scheme = {}) {
    if (scheme.kind === "optimized") {
        return `第 ${scheme.rank} 名 · ${Number(Number(scheme.score ?? 0).toFixed(3))}`
    }
    return scheme.name ? `${scheme.label} · ${scheme.name}` : `${scheme.label}方案`
}

function renderDriveDiscSchemeSummary(container, scheme = {}) {
    if (!container) {
        return
    }
    const summary = document.createElement("div")
    summary.className = "optimizer-result-summary"
    const setSummary = driveDiscSetSummary(scheme.driveDiscs)
    summary.innerHTML = `
        <strong>${escapeHtml(schemeHeading(scheme))}</strong>
        <span>${escapeHtml(setSummary || "未形成套装")}</span>
    `
    container.appendChild(summary)
}

function schemeTabMeta(scheme = {}, topScore = 0) {
    if (scheme.kind === "optimized") {
        const score = Number(scheme.score ?? 0)
        if (scheme.stale) {
            return "需刷新"
        }
        return topScore > 0 && Number.isFinite(score)
            ? `${damageNumber((score / topScore) * 100, Number(scheme.resultIndex) === 0 ? 0 : 2)}%`
            : "-"
    }
    return `${scheme.driveDiscs?.length ?? 0}/6`
}

function schemeTabLabel(scheme = {}) {
    if (scheme.kind === "optimized") {
        const score = Number(scheme.score ?? 0)
        return Number.isFinite(score) && score > 0
            ? `${scheme.label} ${Number(score.toFixed(0))}`
            : scheme.label
    }
    return scheme.name ? `${scheme.label} · ${scheme.name}` : scheme.label
}

function createSchemeDiscRow(scheme = {}, slot, disc = null) {
    const editable = scheme.kind === "manual"
    if (!disc) {
        const empty = document.createElement(editable ? "button" : "div")
        if (editable) {
            empty.type = "button"
        }
        empty.className = "optimizer-disc-row optimizer-disc-row-empty"
        empty.dataset.slot = String(slot)
        empty.innerHTML = `
            <img src="/assets/drive-discs/empty.svg" alt="">
            <div>
                <strong>${slot}号位 · 未选择</strong>
                <span>${editable ? "点击选择驱动盘" : "-"}</span>
                <small>-</small>
            </div>
        `
        return empty
    }

    const subStats = (disc.subStats ?? [])
        .map(stat => `${statLabel(stat.stat)} ${formatStoredValue(stat.stat, stat.value, stat.mode)}`)
        .join(" / ")
    const item = document.createElement(editable ? "button" : "div")
    item.className = "optimizer-disc-row"
    if (editable) {
        item.type = "button"
        item.dataset.slot = String(disc.partition)
    }
    item.innerHTML = `
        <img src="${escapeHtml(discIcon(disc))}" alt="">
        <div>
            <strong>${escapeHtml(`${disc.partition}号位 · ${disc.setName || nameOf(getSet(disc.setId))}`)}</strong>
            <span>${escapeHtml(`${statLabel(disc.mainStat?.stat)} ${formatStoredValue(disc.mainStat?.stat, disc.mainStat?.value, disc.mainStat?.mode)}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`)}</span>
            <small>${escapeHtml(subStats || "-")}</small>
        </div>
    `
    return item
}

function renderSchemeDiscRows(container, scheme = {}) {
    if (!container) {
        return
    }
    const bySlot = new Map((scheme.driveDiscs ?? []).map(disc => [Number(disc.partition), disc]))
    for (let slot = 1; slot <= 6; slot += 1) {
        container.appendChild(createSchemeDiscRow(scheme, slot, bySlot.get(slot) ?? null))
    }
}

function renderSchemeTabs() {
    const topScore = Number(optimizationResults[0]?.score ?? 0)
    const resultContainer = els.optimizerResultTabs
    if (resultContainer) {
        resultContainer.innerHTML = ""
    }
    for (const scheme of schemeTabs()) {
        const existingButton = scheme.kind === "manual"
            ? els.manualDiscModeBtn
            : scheme.kind === "loadout"
                ? els.loadoutDiscModeBtn
                : null
        const button = existingButton ?? document.createElement("button")
        if (!existingButton) {
            button.type = "button"
            button.dataset.schemeKey = scheme.key
        }
        button.classList.toggle("active", scheme.key === activeScheme().key)
        button.dataset.schemeKey = scheme.key
        const meta = schemeTabMeta(scheme, topScore)
        button.innerHTML = `
            <span>${escapeHtml(schemeTabLabel(scheme))}</span>
            <small>${escapeHtml(meta)}</small>
        `
        if (!existingButton && resultContainer) {
            resultContainer.appendChild(button)
        }
    }
}

function renderActiveSchemeList() {
    if (!els.driveDiscSchemeList) {
        return
    }
    const scheme = activeScheme()
    syncActiveResultIndexFromScheme()
    setHomeDiscMode(scheme.kind === "loadout" ? "loadout" : "manual")
    els.driveDiscSchemeList.innerHTML = ""
    if (els.saveLoadoutBtn) {
        els.saveLoadoutBtn.disabled = scheme.kind !== "optimized"
    }
    renderDriveDiscSchemeSummary(els.driveDiscSchemeList, scheme)
    renderSchemeDiscRows(els.driveDiscSchemeList, scheme)
}

function renderResultTabs() {
    renderSchemeTabs()
}

function renderResultList() {
    renderSchemeTabs()
    renderActiveSchemeList()
    renderCurrentSchemeFourPieceBuffSettings()
}

function renderOptimizerResultTabs() {
    renderSchemeTabs()
}

function renderOptimizerResultList() {
    renderActiveSchemeList()
}

function renderCurrentPlan() {
    renderActiveSchemeList()
}

function selectResult(index) {
    activeSchemeKey = `optimized:${index}`
    activeResultIndex = index
    renderResultTabs()
    renderResultList()
    const result = optimizationResults[index]
    if (result) {
        if (optimizationResultsDirty) {
            refreshSelectedResultPreview().catch(error => setStatus(error.message, "error"))
        } else {
            renderCalculationResult(result.data)
        }
    }
}

async function selectScheme(key) {
    setActiveSchemeKey(key)
    syncActiveResultIndexFromScheme()
    const scheme = activeScheme()
    if (scheme.kind === "loadout" && !loadoutIdForAgent(els.agentSelect.value)) {
        setActiveSchemeKey(selectedDiscModeForAgent(els.agentSelect.value))
        throw new Error("当前角色没有可应用的完整套装，请先在驱动盘页修复缺失槽位。")
    }
    if (scheme.kind === "manual" || scheme.kind === "loadout") {
        setHomeDiscMode(scheme.kind)
        saveCurrentHomeSelection({ mode: scheme.kind })
        syncDiscSourceControls()
    }
    renderResultTabs()
    renderResultList()
    if (scheme.kind === "optimized" && scheme.data && !scheme.stale) {
        renderCalculationResult(scheme.data)
        return
    }
    await refreshActiveSchemePreview()
}

function clearOptimizationResults() {
    optimizationResults = []
    activeResultIndex = -1
    optimizationResultsDirty = false
    lastCompletedOptimizationSettings = null
    lastCompletedOptimizationAgentId = null
    els.optimizerMetrics.textContent = "未计算"
    renderResultTabs()
    renderResultList()
    if (!activeOptimizationJobId) {
        clearOptimizationProgress()
    }
}

function markResultsDirty() {
    const wasRunning = Boolean(activeOptimizationJobId)
    if (optimizationResults.length) {
        optimizationResultsDirty = true
        els.optimizerMetrics.textContent = "条件已更改，请重新计算"
        renderResultTabs()
        renderResultList()
        if (!activeOptimizationJobId) {
            clearOptimizationProgress()
        }
        refreshActiveSchemePreview().catch(error => setStatus(error.message, "error"))
        return
    }
    optimizationResultsDirty = wasRunning
    lastCompletedOptimizationSettings = null
    lastCompletedOptimizationAgentId = null
    els.optimizerMetrics.textContent = wasRunning ? "条件已更改，请重新计算" : "需重新计算"
    renderResultTabs()
    renderResultList()
    if (!activeOptimizationJobId) {
        clearOptimizationProgress()
    }
}

async function refreshSelectedResultPreview() {
    const result = optimizationResults[activeResultIndex]
    if (!result) {
        return
    }
    const requestSeq = ++damagePreviewRequestSeq
    const data = calculateInCombatPanel(meta, collectRequestPayloadForResult(result))
    if (requestSeq !== damagePreviewRequestSeq) {
        return
    }
    renderCalculationResult(data)
    setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
}

async function refreshActiveSchemePreview() {
    const scheme = activeScheme()
    const requestSeq = ++damagePreviewRequestSeq
    const data = calculateInCombatPanel(meta, collectRequestPayloadForScheme(scheme))
    if (requestSeq !== damagePreviewRequestSeq) {
        return
    }
    renderCalculationResult(data)
    setStatus(activeOptimizationJobId ? "计算中" : optimizationResultsDirty ? "条件已更改，请重新计算" : "就绪", activeOptimizationJobId || optimizationResultsDirty ? "idle" : "success")
}

async function calculateEmptyPanel() {
    await refreshActiveSchemePreview()
}

function startOptimizationTimers() {
    stopOptimizationTimers()
    optimizationElapsedTimer = setInterval(() => {
        if (!activeOptimizationJobId) {
            return
        }
        renderOptimizationProgress({
            status: lastOptimizationProgress?.status ?? "preparing",
            elapsedMs: Date.now() - optimizationStartedAt,
        })
    }, 250)
    optimizationWatchdogTimer = setInterval(() => {
        if (!activeOptimizationJobId || pendingOptimizationCancelPromise) {
            return
        }
        const lastMessageAt = lastOptimizationWorkerMessageAt || optimizationStartedAt
        if (Date.now() - lastMessageAt < OPTIMIZER_WORKER_STALL_TIMEOUT_MS) {
            return
        }
        finishOptimizationJob({
            status: "error",
            error: "优化 Worker 长时间没有返回进度，已自动停止。请收窄 2 件套或主词条后重试。",
            elapsedMs: Date.now() - optimizationStartedAt,
        }).catch(error => {
            setStatus(errorMessage(error), "error")
        })
    }, 1000)
}

async function finishOptimizationJob(job) {
    stopOptimizationTimers()
    disposeActiveOptimizationWorker()
    const settingsSnapshot = activeOptimizationSettingsSnapshot
    const agentIdSnapshot = activeOptimizationAgentIdSnapshot
    activeOptimizationJobId = null
    activeOptimizationSettingsSnapshot = null
    activeOptimizationAgentIdSnapshot = null
    pendingOptimizationCancelPromise = null
    setOptimizeButtonRunning(false)
    renderOptimizationProgress(job)
    if (job.status === "cancelled") {
        setStatus("已取消", "idle")
        els.optimizerMetrics.textContent = "已取消"
        return
    }
    if (job.status === "error") {
        setStatus("计算失败", "error")
        els.optimizerMetrics.textContent = "计算失败"
        showErrorNotice({
            title: "计算失败",
            message: job.error || "优化任务执行失败，请调整条件后重试。",
        })
        return
    }

    const data = job.result
    lastCompletedOptimizationSettings = data?.settings ?? job.settings ?? settingsSnapshot
    lastCompletedOptimizationAgentId = agentIdSnapshot ?? els.agentSelect.value
    optimizationResults = data?.results ?? []
    activeResultIndex = optimizationResults.length ? 0 : -1
    activeSchemeKey = optimizationResults.length ? "optimized:0" : activeSchemeKey
    const metrics = data?.metrics ?? job.metrics
    const processedCount = processedOptimizationCount(metrics)
    const metricsText = metrics
        ? [
            `评估 ${formatCount(processedCount)} / 估算 ${formatCount(metrics.estimatedCombinationCount)}`,
            metrics.algorithmLabel,
            metrics.scoreKernel ? `内核 ${metrics.scoreKernel === "compiled-dense" ? "dense" : "map"}` : "",
            metrics.scoreKernel !== "compiled-dense" && metrics.scoreKernelFallbackReason ? `回退 ${metrics.scoreKernelFallbackReason}` : "",
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `真实评分 ${formatCount(metrics.scoredCombinationCount ?? metrics.evaluated ?? 0)}` : "",
            Number(metrics.prunedBySuperBound ?? 0) > 0 ? `剪枝 ${formatCount(metrics.prunedBySuperBound)}` : "",
        ].filter(Boolean).join(" · ")
        : "已计算"
    els.optimizerMetrics.textContent = optimizationResultsDirty ? "条件已更改，请重新计算" : metricsText
    renderResultTabs()
    renderResultList()
    if (optimizationResults.length) {
        await selectScheme("optimized:0")
        setStatus(optimizationResultsDirty ? "条件已更改，请重新计算" : "计算完成", optimizationResultsDirty ? "idle" : "success")
    } else {
        await calculateEmptyPanel()
        const reason = data?.error?.reason ?? "没有符合条件的结果"
        setStatus("没有结果", "error")
        showErrorNotice({
            title: "没有符合条件的结果",
            message: reason,
        })
    }
}

async function cancelActiveOptimization({ silent = false } = {}) {
    if (pendingOptimizationCancelPromise) {
        return pendingOptimizationCancelPromise
    }

    const jobId = activeOptimizationJobId
    if (!jobId) {
        return
    }
    stopOptimizationTimers()
    setOptimizeButtonRunning(true, "取消中")
    for (const button of [els.cancelOptimizeBtn, els.cancelOptimizeInlineBtn].filter(Boolean)) {
        button.disabled = true
    }
    renderOptimizationProgress({
        status: "canceling",
        elapsedMs: Date.now() - optimizationStartedAt,
        percent: lastOptimizationProgress?.percent ?? 0,
    })
    if (!silent) {
        setStatus("正在取消", "idle")
    }

    const cancelPromise = Promise.resolve().then(() => {
        activeOptimizationWorker?.postMessage({ type: "cancel", runId: jobId })
        disposeActiveOptimizationWorker()
        if (activeOptimizationJobId === jobId) {
            activeOptimizationJobId = null
        }
        activeOptimizationSettingsSnapshot = null
        activeOptimizationAgentIdSnapshot = null
        stopOptimizationTimers()
        setOptimizeButtonRunning(false)
        pendingOptimizationCancelPromise = null

        if (!silent) {
            els.optimizerMetrics.textContent = "已取消"
            els.optimizerProgressNote.textContent = "计算已取消"
            updateRunSummary({
                percent: lastOptimizationProgress?.percent ?? 0,
                fillPercent: lastOptimizationProgress?.percent ?? 0,
                meta: "已取消",
                note: "计算已取消",
                status: "已取消",
            })
            setStatus("已取消", "idle")
        }
    }).finally(() => {
        if (pendingOptimizationCancelPromise === cancelPromise) {
            pendingOptimizationCancelPromise = null
        }
    })

    pendingOptimizationCancelPromise = cancelPromise
    return cancelPromise
}

async function runOptimization() {
    if (pendingOptimizationCancelPromise) {
        setStatus("正在取消上次计算", "idle")
        await pendingOptimizationCancelPromise
    }
    if (activeOptimizationJobId) {
        return
    }

    saveSyncedConfig()
    clearPageNotice()
    clearOptimizationResults()
    lastCompletedOptimizationSettings = null
    setStatus("计算中", "idle")
    setOptimizeButtonRunning(true)
    renderOptimizationProgress({
        status: "preparing",
        metrics: {},
        evaluated: 0,
        estimatedCombinationCount: 0,
        percent: 0,
        elapsedMs: 0,
    })
    const optimizerStore = optimizerStorePayload(store)
    const payload = {
        ...collectRequestPayload({ driveDiscs: [] }),
        settings: collectOptimizationSettings(),
    }
    activeOptimizationSettingsSnapshot = structuredClone(payload.settings)
    activeOptimizationAgentIdSnapshot = payload.agentId
    const jobId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
    activeOptimizationJobId = jobId
    optimizationStartedAt = Date.now()
    lastOptimizationWorkerMessageAt = optimizationStartedAt
    const worker = new Worker(new URL("./optimizer-worker.js", import.meta.url), { type: "module" })
    activeOptimizationWorker = worker
    worker.onmessage = async event => {
        const message = event.data ?? {}
        if (message.runId !== activeOptimizationJobId || pendingOptimizationCancelPromise) {
            return
        }
        lastOptimizationWorkerMessageAt = Date.now()
        if (message.type === "preview" || message.type === "progress") {
            renderOptimizationProgress(message.job)
            return
        }
        if (["complete", "error", "cancelled"].includes(message.type)) {
            await finishOptimizationJob(message.job)
        }
    }
    worker.onerror = async event => {
        if (jobId !== activeOptimizationJobId) {
            return
        }
        await finishOptimizationJob({
            status: "error",
            error: event.message || "优化 Worker 执行失败。",
            elapsedMs: Date.now() - optimizationStartedAt,
        })
    }
    startOptimizationTimers()
    worker.postMessage({
        type: "start",
        runId: jobId,
        catalog: meta,
        store: optimizerStore,
        input: payload,
        settings: {
            progressIntervalMs: 250,
            yieldIntervalMs: 50,
        },
    })
}

async function saveActiveLoadout() {
    const result = optimizationResults[activeResultIndex]
    if (!result) {
        return
    }
    const agentId = lastCompletedOptimizationAgentId ?? els.agentSelect.value
    const agentName = nameOf(getAgent(agentId))
    const defaultName = `${agentName}-${Number(result.score.toFixed(0))}-第${result.rank}名`
    const name = await promptDialog({
        title: "保存优化结果",
        message: `将第 ${result.rank} 名结果保存为「${agentName}」的套装预设。`,
        label: "套装名称",
        value: defaultName,
        confirmText: "保存套装",
    })
    if (name === null) {
        return
    }
    clearPageNotice()
    setStatus("保存套装", "idle")
    const response = await upsertDriveDiscLoadout({
        agentId,
        name: name.trim() || defaultName,
        driveDiscIdsBySlot: result.driveDiscIdsBySlot,
        score: result.score,
        source: {
            type: "optimizer",
            rank: result.rank,
            settings: lastCompletedOptimizationSettings ?? collectOptimizationSettings(),
        },
    })
    store = response.store
    setStatus("已保存套装", "success")
    showSuccessNotice({
        title: "套装预设已保存",
        message: `「${name.trim() || defaultName}」已保存到驱动盘页。`,
        actions: [
            {
                label: "去驱动盘页查看",
                onClick: () => {
                    window.location.href = "/drive-discs.html#loadouts"
                },
            },
            {
                label: "关闭",
                closeOnClick: true,
            },
        ],
    })
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
    const sets = [...displayDriveDiscSets()]
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
    populateSelect(els.fourPieceSetSelect, sets, defaultFourPieceSetIdForAgent(els.agentSelect?.value) || sets[0]?.id)
    els.fourPieceSetChoices.innerHTML = ""
    els.twoPieceSetSelect.innerHTML = ""
    els.twoPieceSetChoices.innerHTML = ""
    for (const set of sets) {
        const fourPieceLabel = document.createElement("label")
        fourPieceLabel.className = "two-piece-choice four-piece-choice"
        fourPieceLabel.innerHTML = `
            <input type="radio" name="fourPieceSetLimit" data-four-piece-set-limit value="${escapeHtml(set.id)}">
            <img src="${escapeHtml(driveDiscSetIcon(set))}" alt="" loading="lazy">
            <span class="two-piece-choice-text">
                <strong>${escapeHtml(nameOf(set))}</strong>
            </span>
        `
        els.fourPieceSetChoices.appendChild(fourPieceLabel)

        const option = document.createElement("option")
        option.value = set.id
        option.textContent = nameOf(set)
        els.twoPieceSetSelect.appendChild(option)

        const label = document.createElement("label")
        label.className = "two-piece-choice"
        label.innerHTML = `
            <input type="checkbox" data-two-piece-set-limit value="${escapeHtml(set.id)}">
            <img src="${escapeHtml(driveDiscSetIcon(set))}" alt="" loading="lazy">
            <span class="two-piece-choice-text">
                <strong>${escapeHtml(nameOf(set))}</strong>
                <span>${escapeHtml(twoPieceSetEffectText(set))}</span>
            </span>
        `
        els.twoPieceSetChoices.appendChild(label)
    }
    syncFourPieceSetChoices()
    syncTwoPieceSetChoices()
}

function restoreHomeState() {
    const selection = loadHomeSelection()
    const agentId = getAgent(selection.currentAgentId)?.id ?? displayAgents()[0]?.id
    const config = configForAgent(agentId)
    const wEngineId = defaultWEngineIdForAgent(agentId, config.wEngineId)
    els.agentSelect.value = agentId
    populateCoreSkillSelect(getAgent(agentId), config.coreSkillLevel)
    populateCinemaLevelSelect(cinemaLevelForAgent(agentId))
    populateWEngineSelect(wEngineId, agentId)
    populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), config.wEngineModificationLevel)
    applyStoredDamageConfig(damageConfigForAgent(agentId, config.damage))
    applyStoredOptimizerConfig(agentId, config.optimizer)
    currentSchemeFourPieceBuffModeBySetId = clonePlainObject(config.currentSchemeFourPieceBuffModeBySetId)
    currentSchemeFourPieceBuffRuntimeInputsBySetId = clonePlainObject(config.currentSchemeFourPieceBuffRuntimeInputsBySetId)
    activeSchemeKey = selectedDiscModeForAgent(agentId)
    saveCurrentHomeSelection({ mode: selectedDiscModeForAgent(agentId) })
    renderEntityCards()
    renderCombatControls()
}

async function loadAll() {
    meta = await loadCatalog()
    store = await loadCurrentUserDriveDiscStore()
    populateSelect(els.agentSelect, displayAgents(), displayAgents()[0]?.id)
    populateWEngineSelect(displayWEngines()[0]?.id, els.agentSelect.value)
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
        markResultsDirty()
        if (!wasRunning && !optimizationResults.length) {
            await calculateEmptyPanel()
        }
        renderResultTabs()
        renderResultList()
        setStatus(
            wasRunning ? "计算中" : optimizationResults.length ? "条件已更改，请重新计算" : "就绪",
            wasRunning || optimizationResults.length ? "idle" : "success",
        )
    } catch (error) {
        setStatus(error.message, "error")
    }
}

els.agentSelect.addEventListener("change", async () => {
    try {
        persistCurrentDamageResistanceInput()
        const agentId = els.agentSelect.value
        const config = configForAgent(agentId)
        const wEngineId = defaultWEngineIdForAgent(agentId, config.wEngineId)
        populateCoreSkillSelect(getAgent(agentId), config.coreSkillLevel)
        populateCinemaLevelSelect(cinemaLevelForAgent(agentId))
        populateWEngineSelect(wEngineId, agentId)
        populateWEngineModificationSelect(getWEngine(els.wEngineSelect.value), config.wEngineModificationLevel)
        applyStoredDamageConfig(damageConfigForAgent(agentId, config.damage))
        applyStoredOptimizerConfig(agentId, config.optimizer)
        activeSchemeKey = selectedDiscModeForAgent(agentId)
        clearOptimizationResults()
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
    markResultsDirty()
    setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
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
    els.algorithmSelect,
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
    if (!input) {
        continue
    }
    input.addEventListener("change", async () => {
        try {
            if (input === els.fourPieceSetSelect) {
                syncFourPieceSetChoices()
                renderFourPieceBuffSettings()
            }
            await refreshAfterConfigChange()
        } catch (error) {
            setStatus(error.message, "error")
        }
    })
    input.addEventListener("input", () => {
        if (input.tagName === "INPUT") {
            try {
                saveSyncedConfig()
                markResultsDirty()
                setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
            } catch (error) {
                setStatus(error.message, "error")
            }
        }
    })
}
els.fourPieceBuffSection?.addEventListener("click", async event => {
    const modeButton = event.target.closest("[data-four-piece-buff-mode]")
    if (!modeButton) {
        return
    }
    try {
        const nextMode = normalizeFourPieceBuffMode(modeButton.dataset.fourPieceBuffMode)
        if (currentFourPieceBuffMode() !== nextMode) {
            setCurrentFourPieceBuffMode(nextMode)
            renderFourPieceBuffSettings()
            await refreshAfterConfigChange()
        }
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.fourPieceBuffSection?.addEventListener("input", event => {
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
        markResultsDirty()
        setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.fourPieceBuffSection?.addEventListener("change", async event => {
    const runtimeField = event.target.closest(runtimeFieldSelector())
    if (!runtimeField) {
        return
    }
    await commitRuntimeField(runtimeField)
    renderFourPieceBuffSettings()
})
els.fourPieceBuffSection?.addEventListener("keydown", async event => {
    if (event.key !== "Enter") {
        return
    }
    const runtimeField = event.target.closest(runtimeFieldSelector())
    if (!runtimeField) {
        return
    }
    event.preventDefault()
    await commitRuntimeField(runtimeField)
    renderFourPieceBuffSettings()
})
document.querySelector(".optimizer-settings-grid").addEventListener("change", event => {
    if (!event.target.matches("[data-two-piece-set-limit]")) {
        return
    }
    event.target.closest(".two-piece-choice")?.classList.toggle("active", event.target.checked)
    setTwoPieceSetSelected(event.target.value, event.target.checked)
})
document.querySelector(".optimizer-settings-grid").addEventListener("click", event => {
    if (!event.target.closest("[data-clear-two-piece-sets]")) {
        return
    }
    clearTwoPieceSetLimits()
})
els.openTwoPieceSetModalBtn?.addEventListener("click", openTwoPieceSetModal)
els.closeTwoPieceSetModalBtn?.addEventListener("click", closeTwoPieceSetModal)
els.cancelTwoPieceSetModalBtn?.addEventListener("click", closeTwoPieceSetModal)
els.applyTwoPieceSetModalBtn?.addEventListener("click", async () => {
    try {
        await applyTwoPieceSetModalSelection()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.openFourPieceSetModalBtn?.addEventListener("click", openFourPieceSetModal)
els.closeFourPieceSetModalBtn?.addEventListener("click", closeFourPieceSetModal)
els.cancelFourPieceSetModalBtn?.addEventListener("click", closeFourPieceSetModal)
els.applyFourPieceSetModalBtn?.addEventListener("click", async () => {
    try {
        await applyFourPieceSetModalSelection()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.twoPieceSelectedSummary?.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-two-piece-set]")
    if (!remove) {
        return
    }
    setTwoPieceSetSelected(remove.dataset.removeTwoPieceSet, false)
})
els.fourPieceSetModal?.addEventListener("click", event => {
    if (event.target.matches("[data-close-four-piece-set-modal]")) {
        closeFourPieceSetModal()
    }
})
els.fourPieceSetModal?.addEventListener("change", event => {
    if (!event.target.matches("[data-four-piece-set-limit]")) {
        return
    }
    fourPieceSetDraftId = event.target.value
    syncFourPieceSetChoices()
})
els.twoPieceSetModal?.addEventListener("click", event => {
    if (event.target.matches("[data-close-two-piece-set-modal]")) {
        closeTwoPieceSetModal()
    }
})
els.twoPieceSetModal?.addEventListener("change", event => {
    if (!event.target.matches("[data-two-piece-set-limit]")) {
        return
    }
    const selected = new Set(twoPieceSetDraftIds ?? selectedValues(els.twoPieceSetSelect))
    if (event.target.checked) {
        selected.add(event.target.value)
    } else {
        selected.delete(event.target.value)
    }
    twoPieceSetDraftIds = [...selected]
    syncTwoPieceSetChoices()
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
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
            markResultsDirty()
            setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
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
    if (event.target === els.damageTargetResistance) {
        persistCurrentDamageResistanceInput()
        syncDamageResistancePresetFromValue({ forceCustom: !els.damageTargetResistanceCustom?.hidden })
    }
    try {
        saveSyncedConfig()
        markResultsDirty()
        setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
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
    if (event.target === els.damageSkillMultiplier || event.target === els.damageAnomalyProcCount || event.target === els.damageDisorderElapsed) {
        syncCalculationConfigSummary()
    }
    try {
        saveSyncedConfig()
        markResultsDirty()
        setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
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
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
            saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().filter(item =>
                addedCombatBuffSourceGroupKey(item) !== removeGroup.dataset.removeBuffGroupKey
            ))
            renderCombatControls()
            await refreshAfterConfigChange()
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
        saveCurrentAddedCombatBuffs(currentAddedCombatBuffs().filter(item => addedCombatBuffKey(item) !== remove.dataset.removeBuffKey))
        renderCombatControls()
        await refreshAfterConfigChange()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.addedCombatBuffs.addEventListener("input", event => {
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
        markResultsDirty()
        setStatus(activeOptimizationJobId ? "计算中" : "条件已更改，请重新计算", "idle")
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

    const runtimeField = event.target.closest(runtimeFieldSelector())
    if (runtimeField) {
        await commitRuntimeField(runtimeField)
    }
})
els.addedCombatBuffs.addEventListener("keydown", async event => {
    if (event.key !== "Enter") {
        return
    }
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
els.openCalculationConfigBtn?.addEventListener("click", openCalculationConfigModal)
els.closeCalculationConfigModalBtn?.addEventListener("click", closeCalculationConfigModal)
els.cancelCalculationConfigBtn?.addEventListener("click", () => closeCalculationConfigModal())
els.calculationConfigModal?.addEventListener("click", async event => {
    if (event.target.matches("[data-close-calculation-config-modal]")) {
        closeCalculationConfigModal()
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
        const nextMode = resolveCalculationConfigMode(els.calculationConfigMode?.value ?? "single")
        if (nextMode === "custom") {
            calculationConfigEvents = readCalculationConfigEventsFromModal()
        }
        calculationConfigMode = nextMode
        const events = calculationEventsForMode(calculationConfigMode)
        const defaultConfig = calculationConfigMode === ADMIN_DEFAULT_CALCULATION_MODE
            ? adminDefaultCalculationConfig()
            : null
        const preferredSelectedEventId = calculationConfigMode === ADMIN_DEFAULT_CALCULATION_MODE
            ? defaultConfig?.selectedEventId
            : calculationConfigSelectedEventId
        calculationConfigSelectedEventId = events.some(item => item.id === preferredSelectedEventId)
            ? preferredSelectedEventId
            : events[0]?.id ?? null
        syncCalculationConfigSummary()
        renderCalculationObjectiveControls()
        closeCalculationConfigModal({ restore: false })
        await refreshAfterConfigChange()
    }
})
els.calculationConfigModal?.addEventListener("change", event => {
    if (event.target === els.calculationConfigMode) {
        syncEditingEventFromEditor({ renderList: false })
        syncCalculationConfigModeFields(event.target.value)
        return
    }
    if (!els.calculationEventEditorFields?.contains(event.target)) {
        return
    }
    if (calculationConfigModeReadonly()) {
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
    if (event.target.matches("[data-calculation-skill-group]")) {
        syncEditingEventFromEditor({ renderList: false })
        renderCalculationEventEditor()
        renderCalculationConfigEventList()
        syncCalculationConfigModalSummary()
        return
    }
    syncEditingEventFromEditor()
})
els.calculationConfigModal?.addEventListener("input", event => {
    if (!els.calculationEventEditorFields?.contains(event.target)) {
        return
    }
    if (calculationConfigModeReadonly()) {
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
        setStatus("已加入本次选择", "idle")
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
    } else if (els.twoPieceSetModal && !els.twoPieceSetModal.hidden) {
        event.preventDefault()
        closeTwoPieceSetModal()
    } else if (els.fourPieceSetModal && !els.fourPieceSetModal.hidden) {
        event.preventDefault()
        closeFourPieceSetModal()
    } else if (els.calculationConfigModal && !els.calculationConfigModal.hidden) {
        event.preventDefault()
        closeCalculationConfigModal()
    }
})
els.driveDiscSchemeTabs?.addEventListener("click", event => {
    const button = event.target.closest("button[data-scheme-key]")
    if (!button) {
        return
    }
    selectScheme(button.dataset.schemeKey).catch(error => setStatus(error.message, "error"))
})
els.driveDiscSchemeList?.addEventListener("click", event => {
    const target = event.target.closest("[data-slot]")
    if (!target || activeScheme().kind !== "manual") {
        return
    }
    openHomeDiscModal(target.dataset.slot)
})
els.currentSchemeFourPieceBuffSection?.addEventListener("click", async event => {
    const modeButton = event.target.closest("[data-current-scheme-four-piece-buff-mode]")
    if (!modeButton) {
        return
    }
    try {
        setCurrentSchemeFourPieceBuffMode(modeButton.dataset.currentSchemeFourPieceBuffMode)
        renderCurrentSchemeFourPieceBuffSettings()
        await refreshActiveSchemePreview()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.currentSchemeFourPieceBuffSection?.addEventListener("input", event => {
    const runtimeField = event.target.closest(runtimeFieldSelector())
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
        refreshActiveSchemePreview().catch(error => setStatus(error.message, "error"))
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.currentSchemeFourPieceBuffSection?.addEventListener("change", async event => {
    const runtimeField = event.target.closest(runtimeFieldSelector())
    if (runtimeField) {
        await commitRuntimeField(runtimeField)
    }
})
els.currentSchemeFourPieceBuffSection?.addEventListener("keydown", async event => {
    if (event.key !== "Enter") {
        return
    }
    const runtimeField = event.target.closest(runtimeFieldSelector())
    if (!runtimeField) {
        return
    }
    event.preventDefault()
    await commitRuntimeField(runtimeField)
})
els.applyLoadoutBtn?.addEventListener("click", async () => {
    try {
        const agentId = els.agentSelect.value
        if (!loadoutIdForAgent(agentId)) {
            throw new Error("当前角色没有可应用的完整套装，请先在驱动盘页修复缺失槽位。")
        }
        setStatus("应用套装", "idle")
        setActiveDiscModeScheme("loadout")
        saveCurrentHomeSelection({ mode: "loadout" })
        syncDiscSourceControls()
        renderResultTabs()
        renderResultList()
        await refreshActiveSchemePreview()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.homeLoadoutSelect?.addEventListener("change", async () => {
    try {
        const selectedLoadout = driveDiscLoadoutsForAgent(els.agentSelect.value)
            .find(loadout => loadout.id === els.homeLoadoutSelect.value)
        if (selectedLoadout && !loadoutIsComplete(selectedLoadout)) {
            throw new Error("该套装缺少驱动盘槽位，请先在驱动盘页修复。")
        }
        setStatus("切换套装", "idle")
        setActiveDiscModeScheme("loadout")
        saveCurrentHomeSelection({
            mode: "loadout",
            selectedLoadoutId: els.homeLoadoutSelect.value,
        })
        syncDiscSourceControls()
        renderResultTabs()
        renderResultList()
        await refreshActiveSchemePreview()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.closeHomeDiscModalBtn?.addEventListener("click", closeHomeDiscModal)
els.homeDiscModal?.addEventListener("click", event => {
    if (event.target.matches("[data-close-home-disc-modal]")) {
        closeHomeDiscModal()
    }
})
els.homeDiscOptionList?.addEventListener("click", async event => {
    const option = event.target.closest(".home-disc-option[data-disc-id]")
    if (!option) {
        return
    }
    try {
        setStatus("保存驱动盘选择", "idle")
        await selectHomeDisc(option.dataset.discId)
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.clearSlotDiscBtn?.addEventListener("click", async () => {
    try {
        setStatus("卸下驱动盘", "idle")
        await clearHomeDiscSlot()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
for (const input of [els.homeDiscSetFilter, els.homeDiscMainStatFilter, els.homeDiscSearchInput].filter(Boolean)) {
    input.addEventListener("input", renderHomeDiscOptions)
    input.addEventListener("change", renderHomeDiscOptions)
}
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
        const message = errorMessage(error)
        setStatus("计算失败", "error")
        showErrorNotice({
            title: "启动计算失败",
            message,
        })
    }
})
els.optimizeInlineBtn?.addEventListener("click", async () => {
    try {
        await runOptimization()
    } catch (error) {
        stopOptimizationTimers()
        activeOptimizationJobId = null
        setOptimizeButtonRunning(false)
        const message = errorMessage(error)
        setStatus("计算失败", "error")
        showErrorNotice({
            title: "启动计算失败",
            message,
        })
    }
})
els.cancelOptimizeBtn.addEventListener("click", async () => {
    try {
        await cancelActiveOptimization()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.cancelOptimizeInlineBtn?.addEventListener("click", async () => {
    try {
        await cancelActiveOptimization()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.saveLoadoutBtn?.addEventListener("click", async () => {
    try {
        await saveActiveLoadout()
    } catch (error) {
        const message = errorMessage(error)
        setStatus("保存失败", "error")
        showErrorNotice({
            title: "保存套装失败",
            message,
        })
    }
})
initDriveDiscAnalysis({
    substatButton: els.driveDiscSubstatAnalysisBtn,
    gainButton: els.driveDiscStatGainBtn,
    getCatalog: () => meta,
    getPayload: collectDriveDiscAnalysisPayload,
    requireDriveDiscs: true,
    emptyMessage: "请先选满当前方案或选择一个优化结果后再分析。",
    setStatus,
    statLabel,
    formatStoredValue,
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        await loadAll()
        await calculateEmptyPanel()
        renderResultList()
        setStatus("就绪", "success")
    } catch (error) {
        const message = errorMessage(error)
        setStatus("加载失败", "error")
        showErrorNotice({
            title: "优化器加载失败",
            message,
        })
        console.error(error)
    }
}

bootstrap()
