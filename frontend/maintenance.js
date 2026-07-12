import {
    FIELD_BUFF_GAME_VERSIONS,
    FIELD_BUFF_MODE_OPTIONS,
    FIELD_BUFF_PHASE_OPTIONS,
    fieldBuffModeOption,
    fieldBuffPhaseName,
    validateMaintenanceItem,
} from "./maintenanceValidation.js"
import { storedBuffStat } from "./maintenanceStats.js"
import {
    defaultRuntimeForBuff,
    materializeWEngineForModificationLevel,
    storedEffectRuleText as storedCombatEffectRuleText,
    storedEffectRulesText,
} from "./shared-combat.js"
import {
    CORE_SKILL_LEVEL_SCALE,
    CORE_SKILL_LEVELS,
    SKILL_LEVEL_SCALE,
    damageSkillRowsWithGeneratedTotals,
    isCoreSkillLevelScale,
} from "./skillMultiplierCandidates.js"
import { showErrorNotice } from "./feedback.js"
import {
    defaultCalculationConfigEntries,
    defaultCalculationVariantName,
    normalizeDefaultCalculationCinemaLevel,
} from "./defaultCalculationConfig.js"

const FIELD_BUFF_MODE_SELECT_OPTIONS = FIELD_BUFF_MODE_OPTIONS.map(option => [option.modeId, option.selectLabel?.zhCN ?? option.source.zhCN])
const FIELD_BUFF_VERSION_SELECT_OPTIONS = FIELD_BUFF_GAME_VERSIONS.map(version => [version, `${version}版本`])
const FIELD_BUFF_PHASE_SELECT_OPTIONS = FIELD_BUFF_PHASE_OPTIONS.map(option => [String(option.phaseNo), option.phaseName.zhCN])

const els = {
    status: document.getElementById("status"),
    cloneBtn: document.getElementById("cloneBtn"),
    newBtn: document.getElementById("newBtn"),
    saveBtn: document.getElementById("saveBtn"),
    searchInput: document.getElementById("searchInput"),
    recordList: document.getElementById("recordList"),
    editorTitle: document.getElementById("editorTitle"),
    editorTag: document.getElementById("editorTag"),
    maintenanceFeedback: document.getElementById("maintenanceFeedback"),
    maintenanceSaveState: document.getElementById("maintenanceSaveState"),
    maintenanceSaveHint: document.getElementById("maintenanceSaveHint"),
    maintenanceForm: document.getElementById("maintenanceForm"),
    jsonPreview: document.getElementById("jsonPreview"),
}
els.maintenanceForm.noValidate = true

const KIND_CONFIG = {
    agents: {
        title: "角色资料",
        endpoint: "agents",
    },
    agentSkills: {
        title: "技能倍率",
        endpoint: "agent-skills",
    },
    wEngines: {
        title: "音擎资料",
        endpoint: "w-engines",
    },
    driveDiscSets: {
        title: "驱动盘资料",
        endpoint: "drive-disc-sets",
    },
    anomalyEffects: {
        title: "异常伤害",
        endpoint: "anomaly-effects",
    },
    teammateBuffs: {
        title: "队友 Buff 资料",
        endpoint: "teammate-buffs",
    },
    fieldBuffs: {
        title: "场地 Buff 资料",
        endpoint: "field-buffs",
    },
    bossBuffs: {
        title: "BOSS Buff 资料",
        endpoint: "boss-buffs",
    },
}

const LOCALIZED_EMPTY = { zhCN: "", en: "" }
const DEFAULT_LEVEL_60 = {
    hpBase: 0,
    atkBase: 0,
    defBase: 0,
    critRate: 5,
    critDmg: 50,
    impact: 0,
    anomalyProficiency: 0,
    anomalyMastery: 0,
    energyRegen: 120,
    penRatio: 0,
}
const ATTRIBUTE_OPTIONS = [
    ["physical", "物理"],
    ["fire", "火"],
    ["ice", "冰"],
    ["electric", "电"],
    ["ether", "以太"],
    ["wind", "风"],
    ["honed_edge", "凛刃"],
    ["frost", "烈霜"],
    ["xuanmo", "玄墨"],
]
const SPECIALTY_OPTIONS = [
    ["attack", "强攻"],
    ["stun", "击破"],
    ["anomaly", "异常"],
    ["support", "支援"],
    ["defense", "防护"],
    ["rupture", "命破"],
]
const EFFECT_SCOPE_OPTIONS = [
    ["outOfCombat", "局外"],
    ["inCombat", "局内"],
]
const DAMAGE_ELEMENT_OPTIONS = ATTRIBUTE_OPTIONS.filter(([value]) => !["honed_edge", "frost", "xuanmo"].includes(value))
const DEFAULT_ANOMALY_PROC_COUNTS = {
    assault: 1,
    shatter: 1,
    burn: 20,
    shock: 10,
    corruption: 20,
}
const DISORDER_TYPE_OPTIONS = [
    ["normal", "（普通）紊乱"],
    ["polarized", "极性紊乱"],
]
const SKILL_ROW_KIND_OPTIONS = [
    ["damageMultiplier", "伤害倍率"],
    ["dazeMultiplier", "失衡倍率"],
    ["energyCost", "能量消耗"],
    ["statBonus", "属性加成"],
]
const SKILL_ROW_DAMAGE_BASIS_OPTIONS = [
    ["", "攻击力（默认）"],
    ["sheerForce", "贯穿力"],
]
const SKILL_LEVEL_SCALE_OPTIONS = [
    [SKILL_LEVEL_SCALE, "技能等级"],
    [CORE_SKILL_LEVEL_SCALE, "核心技等级"],
]
const STAT_OPTIONS = [
    ["atkFlat", "固定攻击力", "flat"],
    ["atkPct", "百分比攻击力%", "pct"],
    ["hpFlat", "固定生命值", "flat"],
    ["hpPct", "百分比生命值%", "pct"],
    ["sheerForceFlat", "固定贯穿力", "flat"],
    ["defFlat", "固定防御力", "flat"],
    ["defPct", "百分比防御力%", "pct"],
    ["critRate", "暴击率%", "percentFlat"],
    ["critDmg", "暴击伤害%", "percentFlat"],
    ["impact", "冲击力%", "pct"],
    ["impactFlat", "固定冲击力", "flat"],
    ["anomalyProficiency", "异常精通", "flat"],
    ["anomalyMastery", "异常掌控%", "pct"],
    ["anomalyMasteryFlat", "固定异常掌控", "flat"],
    ["energyRegen", "能量自动回复%", "percentFlat"],
    ["penFlat", "穿透值", "flat"],
    ["penRatio", "穿透率%", "percentFlat"],
    ["physicalResIgnore", "物理抗性无视%", "percentFlat"],
    ["fireResIgnore", "火抗性无视%", "percentFlat"],
    ["iceResIgnore", "冰抗性无视%", "percentFlat"],
    ["electricResIgnore", "电抗性无视%", "percentFlat"],
    ["etherResIgnore", "以太抗性无视%", "percentFlat"],
    ["windResIgnore", "风抗性无视%", "percentFlat"],
    ["dmgBonus", "通用伤害加成%", "percentFlat"],
    ["physicalDmg", "物理伤害加成%", "percentFlat"],
    ["fireDmg", "火属性伤害加成%", "percentFlat"],
    ["iceDmg", "冰属性伤害加成%", "percentFlat"],
    ["electricDmg", "电属性伤害加成%", "percentFlat"],
    ["etherDmg", "以太伤害加成%", "percentFlat"],
    ["windDmg", "风属性伤害加成%", "percentFlat"],
    ["enemyDefReduction", "敌方减防率%", "percentFlat"],
    ["enemyDefIgnore", "无视防御率%", "percentFlat"],
    ["enemyDefFlatReduction", "敌方固定减防", "flat"],
    ["enemyResReduction", "敌方当前属性减抗%", "percentFlat"],
    ["enemyPhysicalResReduction", "敌方物理减抗%", "percentFlat"],
    ["enemyFireResReduction", "敌方火减抗%", "percentFlat"],
    ["enemyIceResReduction", "敌方冰减抗%", "percentFlat"],
    ["enemyElectricResReduction", "敌方电减抗%", "percentFlat"],
    ["enemyEtherResReduction", "敌方以太减抗%", "percentFlat"],
    ["enemyWindResReduction", "敌方风减抗%", "percentFlat"],
]
const STAT_DAMAGE_MODIFIER_OPTIONS = [
    ["anomalyDamageBonus", "属性异常增伤%", {
        stat: "anomalyDamageBonus",
    }],
    ["disorderDamageBonus", "紊乱增伤%", {
        stat: "disorderDamageBonus",
    }],
    ["baseMultiplierBonus", "异常倍率加算%", {
        stat: "baseMultiplierBonus",
    }],
    ["disorderBaseMultiplierBonus", "紊乱倍率加算%", {
        stat: "disorderBaseMultiplierBonus",
    }],
    ["anomalyCritRate", "异常暴击率%", {
        stat: "anomalyCritRate",
    }],
    ["anomalyCritDmg", "异常暴击伤害%", {
        stat: "anomalyCritDmg",
    }],
    ["stunDmgMultiplierBonus", "失衡易伤倍率加算%", {
        stat: "stunDmgMultiplierBonus",
    }],
    ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%", {
        stat: "stunDmgMultiplierBonusAlways",
    }],
    ["sheerDmgBonus", "贯穿增伤%", {
        stat: "sheerDmgBonus",
    }],
    ["physicalSheerDmg", "物理贯穿增伤%", {
        stat: "physicalSheerDmg",
    }],
    ["fireSheerDmg", "火属性贯穿增伤%", {
        stat: "fireSheerDmg",
    }],
    ["iceSheerDmg", "冰属性贯穿增伤%", {
        stat: "iceSheerDmg",
    }],
    ["electricSheerDmg", "电属性贯穿增伤%", {
        stat: "electricSheerDmg",
    }],
    ["etherSheerDmg", "以太贯穿增伤%", {
        stat: "etherSheerDmg",
    }],
    ["windSheerDmg", "风属性贯穿增伤%", {
        stat: "windSheerDmg",
    }],
]
const STAT_DAMAGE_MODIFIER_OPTION_BY_KEY = Object.fromEntries(STAT_DAMAGE_MODIFIER_OPTIONS.map(([key, , effect]) => [key, effect]))
const SKILL_TARGET_STAT_OPTIONS = [
    ["dmgBonus", "通用伤害加成%"],
    ["physicalDmg", "物理伤害加成%"],
    ["fireDmg", "火属性伤害加成%"],
    ["iceDmg", "冰属性伤害加成%"],
    ["electricDmg", "电属性伤害加成%"],
    ["etherDmg", "以太伤害加成%"],
    ["windDmg", "风属性伤害加成%"],
    ["anomalyDamageBonus", "属性异常增伤%"],
    ["disorderDamageBonus", "紊乱增伤%"],
    ["stunDmgMultiplierBonus", "失衡易伤倍率加算%"],
    ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%"],
    ["sheerDmgBonus", "贯穿增伤%"],
    ["physicalSheerDmg", "物理贯穿增伤%"],
    ["fireSheerDmg", "火属性贯穿增伤%"],
    ["iceSheerDmg", "冰属性贯穿增伤%"],
    ["electricSheerDmg", "电属性贯穿增伤%"],
    ["etherSheerDmg", "以太贯穿增伤%"],
    ["windSheerDmg", "风属性贯穿增伤%"],
    ["skillMultiplierBonus", "技能倍率加算%"],
    ["enemyDefReduction", "敌方减防率%"],
    ["enemyDefIgnore", "无视防御率%"],
    ["enemyResReduction", "敌方当前属性减抗%"],
    ["enemyPhysicalResReduction", "敌方物理减抗%"],
    ["enemyFireResReduction", "敌方火减抗%"],
    ["enemyIceResReduction", "敌方冰减抗%"],
    ["enemyElectricResReduction", "敌方电减抗%"],
    ["enemyEtherResReduction", "敌方以太减抗%"],
    ["enemyWindResReduction", "敌方风减抗%"],
    ["physicalResIgnore", "物理抗性无视%"],
    ["fireResIgnore", "火抗性无视%"],
    ["iceResIgnore", "冰抗性无视%"],
    ["electricResIgnore", "电抗性无视%"],
    ["etherResIgnore", "以太抗性无视%"],
    ["windResIgnore", "风抗性无视%"],
]
const SKILL_TARGET_STAT_KEYS = new Set(SKILL_TARGET_STAT_OPTIONS.map(([key]) => key))
const BUFF_STAT_OPTIONS = [
    ...STAT_OPTIONS.map(([key, label]) => [key, label]),
    ...STAT_DAMAGE_MODIFIER_OPTIONS.map(([key, label]) => [key, label]),
]
const STAT_LABELS = {
    ...Object.fromEntries(STAT_OPTIONS.map(([key, label]) => [key, label])),
    ...Object.fromEntries(STAT_DAMAGE_MODIFIER_OPTIONS.map(([key, label]) => [key, label])),
    ...Object.fromEntries(SKILL_TARGET_STAT_OPTIONS.map(([key, label]) => [key, label])),
}
const PERCENT_VALUE_STATS = new Set([
    "atkPct",
    "hpPct",
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
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
    "baseMultiplierBonus",
    "disorderBaseMultiplierBonus",
    "anomalyCritRate",
    "anomalyCritDmg",
    "stunDmgMultiplierBonus",
    "stunDmgMultiplierBonusAlways",
    "sheerDmgBonus",
    "physicalSheerDmg",
    "fireSheerDmg",
    "iceSheerDmg",
    "electricSheerDmg",
    "etherSheerDmg",
    "windSheerDmg",
    "skillMultiplierBonus",
])
const PERCENT_INPUT_STATS = new Set([
    ...PERCENT_VALUE_STATS,
    ...STAT_DAMAGE_MODIFIER_OPTIONS.map(([key]) => key),
    ...SKILL_TARGET_STAT_OPTIONS.map(([key]) => key),
])
const BASIS_OPTIONS = [
    ["", "默认基准"],
    ["baseHp", "基础生命值"],
    ["outOfCombatHp", "局外生命值"],
    ["baseAtk", "基础攻击力"],
    ["outOfCombatAtk", "局外攻击力"],
    ["baseDef", "基础防御力"],
    ["outOfCombatDef", "局外防御力"],
]
const BUFF_EFFECT_TYPE_OPTIONS = [
    ["fixed", "固定数值"],
    ["derived", "按来源数值换算"],
    ["formula", "受限函数换算"],
    ["stacked", "层数"],
]
const DAMAGE_MODIFIER_KIND_OPTIONS = [
    ["anomalyDamageBonus", "属性异常增伤%"],
    ["disorderDamageBonus", "紊乱增伤%"],
    ["baseMultiplierBonus", "异常倍率修正%"],
    ["disorderBaseMultiplierBonus", "紊乱倍率加算%"],
    ["anomalyCritRate", "异常暴击率%"],
    ["anomalyCritDmg", "异常暴击伤害%"],
    ["stunDmgMultiplierBonus", "失衡易伤倍率加算%"],
    ["stunDmgMultiplierBonusAlways", "失衡易伤倍率加算（未失衡生效）%"],
    ["directDamageBonus", "技能专属伤害增伤%"],
    ["sheerDmgBonus", "贯穿增伤%"],
    ["physicalSheerDmg", "物理贯穿增伤%"],
    ["fireSheerDmg", "火属性贯穿增伤%"],
    ["iceSheerDmg", "冰属性贯穿增伤%"],
    ["electricSheerDmg", "电属性贯穿增伤%"],
    ["etherSheerDmg", "以太贯穿增伤%"],
    ["windSheerDmg", "风属性贯穿增伤%"],
    ["skillMultiplierBonus", "技能倍率加算%"],
]
const DAMAGE_MODIFIER_LABELS = {
    ...Object.fromEntries(DAMAGE_MODIFIER_KIND_OPTIONS.map(([key, label]) => [key, label])),
    anomalyDamageBonus: "属性异常增伤%",
    disorderDamageBonus: "紊乱增伤%",
    disorderBaseMultiplierBonus: "紊乱倍率加算%",
    stunDmgMultiplierBonus: "失衡易伤倍率加算%",
    stunDmgMultiplierBonusAlways: "失衡易伤倍率加算（未失衡生效）%",
}
const DAMAGE_KIND_OPTIONS = [
    ["direct", "直伤"],
    ["sheer", "贯穿"],
    ["anomaly", "异常"],
    ["disorder", "紊乱"],
]
const GENERIC_SKILL_CATEGORY_OPTIONS = [
    ["basic", "普通攻击"],
    ["dodge", "闪避"],
    ["assist", "支援技"],
    ["special", "特殊技"],
    ["chain", "连携技"],
    ["core_skill", "核心技"],
]

let catalog = null
let activeKind = "agents"
let selectedKey = ""
let draftCounter = 0
const DRAFT_STORAGE_KEY = "zzz_maintenance_drafts_v1"
const DRAFT_KIND_KEYS = ["agents", "agentSkills", "wEngines", "driveDiscSets", "anomalyEffects", "teammateBuffs", "fieldBuffs", "bossBuffs"]
let drafts = loadDrafts()
const unsavedEdits = new Map()
const selectedTeammateBuffIds = new Map()
let isRenderingEditor = false

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error)
}

function setSaveStrip(state, hint, tone = "idle") {
    if (els.maintenanceSaveState) {
        els.maintenanceSaveState.textContent = state
    }
    if (els.maintenanceSaveHint) {
        els.maintenanceSaveHint.textContent = hint
    }
    const strip = document.getElementById("maintenanceSaveStrip")
    if (strip) {
        strip.dataset.tone = tone
    }
}

function setFeedback(title, details = [], tone = "idle") {
    const lines = Array.isArray(details) ? details : String(details || "").split("\n").filter(Boolean)
    els.maintenanceFeedback.hidden = false
    els.maintenanceFeedback.dataset.tone = tone
    els.maintenanceFeedback.innerHTML = `
        <strong>${escapeHtml(title)}</strong>
        ${lines.length ? `<ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
    `
}

function clearFeedback(options = {}) {
    if (options.keepErrors && els.maintenanceFeedback.dataset.tone === "error") {
        return
    }

    els.maintenanceFeedback.hidden = true
    els.maintenanceFeedback.textContent = ""
    els.maintenanceFeedback.dataset.tone = "idle"
}

function friendlyValidationMessage(message) {
    const replacements = {
        "id": "ID",
        "agentId": "关联角色 ID",
        "name.zhCN": "中文名",
        "teammate.id": "队友 ID",
        "teammate.name.zhCN": "队友中文名",
        "buff.id": "Buff ID",
        "buff.source.zhCN": "来源中文名",
        "source.zhCN": "Buff 来源",
        "sourcePeriod.zhCN": "来源期数",
        "bossName.zhCN": "BOSS 名称",
        "bossSource.zhCN": "BOSS 来源",
        "description.zhCN": "中文说明",
        "level60.hpBase": "60级基础生命值",
        "level60.atkBase": "60级基础攻击力",
        "level60.defBase": "60级基础防御力",
        "level60.energyRegen": "能量自动回复",
        "effect.name.zhCN": "音擎效果中文名",
        "effect.description.zhCN": "音擎中文说明",
    }
    return Object.entries(replacements).reduce(
        (text, [key, label]) => text.replace(`${key}:`, `${label}：`),
        String(message),
    )
}

function emptyDrafts() {
    return Object.fromEntries(DRAFT_KIND_KEYS.map(kind => [kind, []]))
}

function loadDrafts() {
    try {
        const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}")
        return {
            ...emptyDrafts(),
            ...Object.fromEntries(DRAFT_KIND_KEYS.map(kind => [kind, Array.isArray(parsed[kind]) ? parsed[kind] : []])),
        }
    } catch {
        return emptyDrafts()
    }
}

function saveDrafts() {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts))
}

function draftKey(draftId) {
    return `draft:${draftId}`
}

function isDraftKey(key = selectedKey) {
    return key.startsWith("draft:")
}

function draftIdFromKey(key = selectedKey) {
    return isDraftKey(key) ? key.slice("draft:".length) : ""
}

function activeDraftEntries() {
    return drafts[activeKind] ?? []
}

function draftRecord(entry) {
    return {
        ...structuredClone(entry.item),
        __isDraft: true,
        __draftId: entry.draftId,
    }
}

function selectedDraftEntry() {
    const draftId = draftIdFromKey()
    return activeDraftEntries().find(entry => entry.draftId === draftId) ?? null
}

function stripDraftMetadata(record) {
    if (!record) {
        return null
    }

    const { __isDraft, __draftId, __sessionKey, ...item } = record
    return item
}

function sessionKey(kind = activeKind, key = selectedKey) {
    return key ? `${kind}:${key}` : ""
}

function blankDraftItem(kind) {
    if (kind === "agents") {
        return {
            id: "",
            name: { zhCN: "未命名" },
            rarity: "S",
            attribute: "physical",
            specialty: "attack",
            faction: "",
            level60: DEFAULT_LEVEL_60,
            combatBuffs: { corePassive: null, additionalAbility: null },
            images: { portrait: "", source: "" },
            sources: [],
        }
    }

    if (kind === "agentSkills") {
        const agentId = catalog?.meta?.agents?.[0]?.id ?? ""
        return {
            id: agentId || "",
            agentId,
            name: { zhCN: "未命名技能倍率" },
            categories: [],
            sources: [],
        }
    }

    if (kind === "wEngines") {
        return {
            id: "",
            name: { zhCN: "未命名" },
            rarity: "S",
            specialty: "attack",
            attribute: "",
            level60: { atkBase: 0, advancedStat: { stat: "critDmg", value: 0, mode: "flat" } },
            effect: {
                name: { zhCN: "" },
                description: { zhCN: "", en: "" },
                buff: { scope: "inCombat", effects: [], appliesToOutOfCombatPanel: false },
            },
            images: { icon: "", source: "" },
            sources: [],
        }
    }

    if (kind === "driveDiscSets") {
        return {
            id: "",
            name: { zhCN: "未命名" },
            images: { icon: "", source: "" },
            twoPiece: { effects: [] },
            fourPiece: { condition: "", effects: [], effectText: { zhCN: "", en: "" } },
            sources: [],
        }
    }

    if (kind === "anomalyEffects") {
        return {
            id: "",
            maintenanceType: "anomaly",
            label: { zhCN: "未命名异常" },
            element: "physical",
            baseMultiplier: 0,
            defaultProcCount: 1,
        }
    }

    if (kind === "teammateBuffs") {
        return blankTeammateGroupDraft()
    }

    if (kind === "fieldBuffs") {
        const mode = fieldBuffModeOption("defense_v5")
        return {
            sourceType: "field",
            name: { zhCN: "未命名场地 Buff" },
            source: { zhCN: mode?.source?.zhCN ?? "防卫战 v5" },
            period: {
                modeId: "defense_v5",
                gameVersion: "3.0",
                phaseNo: 1,
                phaseName: fieldBuffPhaseName(1) ?? { zhCN: "第一期" },
            },
            sourcePeriod: { zhCN: "3.0版本第一期" },
            description: { zhCN: "" },
            scope: "inCombat",
            effects: [],
            coverage: { default: 1, min: 0, max: 1, step: 0.1 },
        }
    }

    if (kind === "bossBuffs") {
        return {
            id: "",
            sourceType: "boss",
            bossName: { zhCN: "未命名 BOSS" },
            bossSource: { zhCN: "" },
            sourcePeriod: { zhCN: "" },
            description: { zhCN: "" },
            scope: "inCombat",
            effects: [],
            coverage: { default: 1, min: 0, max: 1, step: 0.1 },
        }
    }

    return {
        id: "",
    }
}

function createDraft(item = blankDraftItem(activeKind)) {
    const draftId = `draft_${Date.now()}_${++draftCounter}`
    drafts[activeKind] = [
        { draftId, item: structuredClone(stripDraftMetadata(item)), updatedAt: new Date().toISOString() },
        ...activeDraftEntries(),
    ]
    saveDrafts()
    selectedKey = draftKey(draftId)
    return draftId
}

function removeDraft(draftId) {
    if (!draftId) {
        return
    }

    drafts[activeKind] = activeDraftEntries().filter(entry => entry.draftId !== draftId)
    saveDrafts()
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function nameOf(item) {
    if (typeof item?.name === "string") {
        return item.name
    }

    return item?.name?.zhCN ?? item?.name?.en
        ?? item?.bossName?.zhCN ?? item?.bossName?.en
        ?? item?.label?.zhCN ?? item?.label?.en
        ?? item?.zhCN ?? item?.en ?? item?.id ?? "-"
}

function localized(value) {
    if (!value) {
        return ""
    }

    return typeof value === "string" ? value : value.zhCN ?? value.en ?? ""
}

function slugify(value, fallback = "new_item") {
    const text = String(value || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    return text || `${fallback}_${Date.now()}`
}

function numberValue(value, fallback = 0) {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

function selectOptions(options, selected = "") {
    return options.map(([value, label]) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
    ).join("")
}

function requiredLabel() {
    return `<span class="required-mark">必填</span>`
}

function fieldLabel(label, required = false) {
    return `<span class="field-label">${escapeHtml(label)}${required ? requiredLabel() : ""}</span>`
}

function localizedZhInput(prefix, value = LOCALIZED_EMPTY, label = "中文名") {
    return `
        <label class="field">
          ${fieldLabel(label, true)}
          <input id="${prefix}Zh" value="${escapeHtml(value?.zhCN ?? "")}" required>
        </label>
    `
}

function readLocalizedZh(prefix) {
    return {
        zhCN: document.getElementById(`${prefix}Zh`)?.value.trim() ?? "",
    }
}

function fieldSourcePeriodFromPeriod(period = {}) {
    const version = String(period.gameVersion ?? "").trim()
    const phase = String(period.phaseName?.zhCN ?? period.phaseName ?? "").trim()
    return version && phase ? { zhCN: `${version}版本${phase}` } : null
}

function fieldPeriodDetail(item = {}) {
    const period = item.period ?? {}
    return [
        period.gameVersion ? `${period.gameVersion}版本` : "",
        localized(period.phaseName) || localized(item.sourcePeriod),
    ].filter(Boolean).join(" · ")
}

function percentInputValue(stat, value) {
    if (typeof value !== "number") {
        return ""
    }

    return value
}

function inputToStoredValue(stat, rawValue) {
    return numberValue(rawValue)
}

function levelStatLabel(stat) {
    const labels = {
        hpBase: "基础生命值",
        atkBase: "基础攻击力",
        defBase: "基础防御力",
        critRate: "暴击率%",
        critDmg: "暴击伤害%",
        impact: "冲击力",
        anomalyProficiency: "异常精通",
        anomalyMastery: "异常掌控",
        energyRegen: "能量自动回复%",
        penRatio: "穿透率%",
    }

    return labels[stat] ?? statLabel(stat)
}

function isLevelPercentStat(stat) {
    return ["critRate", "critDmg", "energyRegen", "penRatio"].includes(stat)
}

function modeForStat(stat, explicit = "") {
    if (explicit) {
        return explicit
    }

    if (isStatDamageModifierOption(stat)) {
        return "flat"
    }

    const option = STAT_OPTIONS.find(([key]) => key === stat)
    if (option?.[2] === "pct") {
        return "pct"
    }

    return "flat"
}

function isStatDamageModifierOption(stat) {
    return Object.prototype.hasOwnProperty.call(STAT_DAMAGE_MODIFIER_OPTION_BY_KEY, stat)
}

function isEventModifierStat(stat) {
    return isStatDamageModifierOption(stat) || stat === "skillMultiplierBonus"
}

function ruleTargetKind(rule = {}) {
    return rule.target?.kind === "skill" ? "skill" : "default"
}

function statOptionsForTargetKind(targetKind = "default") {
    return targetKind === "skill" ? SKILL_TARGET_STAT_OPTIONS : BUFF_STAT_OPTIONS
}

function legacyDamageModifierToRule(rule = {}) {
    const appliesTo = rule.appliesTo ?? {}
    const skillTargets = appliesTo.skillTargets ?? []
    const target = skillTargets.length ? { kind: "skill", skillTargets } : { kind: "default" }
    const value = damageModifierInputValue(rule)
    const stat = rule.kind === "directDamageBonus"
        ? "dmgBonus"
        : rule.kind
    return {
        id: rule.id,
        type: "fixed",
        stat,
        value,
        mode: "flat",
        target,
        label: rule.label ?? null,
    }
}

function editableEffectRule(rule = {}) {
    return (rule.type ?? "fixed") === "damageModifier" ? legacyDamageModifierToRule(rule) : rule
}

const DEFAULT_W_ENGINE_MODIFICATION = { minLevel: 1, maxLevel: 5, defaultLevel: 1 }

function wEngineModificationMetadata(wEngine = {}) {
    return {
        minLevel: Number.isInteger(Number(wEngine.modification?.minLevel)) ? Number(wEngine.modification.minLevel) : 1,
        maxLevel: Number.isInteger(Number(wEngine.modification?.maxLevel)) ? Number(wEngine.modification.maxLevel) : 5,
        defaultLevel: Number.isInteger(Number(wEngine.modification?.defaultLevel)) ? Number(wEngine.modification.defaultLevel) : 1,
    }
}

function isWEngineEffectRuleContainer(containerId = "") {
    return containerId === "wEngineSelfBuffRules" || containerId === "wEngineTeamBuffRules"
}

function formatScalingNumber(value) {
    return Number.isFinite(Number(value)) ? String(Number(value)) : ""
}

function modificationValuesInput(values = null) {
    return Array.isArray(values)
        ? values.map(formatScalingNumber).join("/")
        : ""
}

function parseModificationValuesInput(value = "") {
    return String(value)
        .split("/")
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => Number(item))
}

function damageModifierInputValue(rule = {}) {
    const rawValue = Number(rule.value ?? 0)
    if (rule.valueUnit === "decimal") {
        return rawValue * 100
    }
    return Math.abs(rawValue) > 1 ? rawValue : rawValue * 100
}

function eventModifierRuleFromStatRow(stat, value, index = 0, target = { kind: "default" }) {
    return {
        id: `effect-${index + 1}`,
        type: "fixed",
        stat,
        value,
        mode: "flat",
        target: target.kind === "skill"
            ? { kind: "skill", skillTargets: target.skillTargets ?? [] }
            : { kind: "default" },
    }
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

function blankTeammateBuffDraft() {
    return {
        id: "",
        source: { zhCN: "" },
        description: { zhCN: "" },
        scope: "inCombat",
        effects: [],
        buffModifiers: [],
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
    }
}

function blankTeammateGroupDraft() {
    return {
        id: "",
        maintenanceType: "teammateGroup",
        name: { zhCN: "未命名" },
        teammateId: "",
        teammateName: { zhCN: "未命名" },
        images: { icon: "", source: "" },
        buffs: [blankTeammateBuffDraft()],
    }
}

function teammateBuffRecord(teammate = {}, buff = {}) {
    const teammateId = teammate.id ?? teammate.teammateId ?? ""
    const teammateName = teammate.name ?? teammate.teammateName ?? { zhCN: "" }
    return {
        ...buff,
        maintenanceType: "teammate",
        sourceType: "teammate",
        teammateId,
        teammateName,
    }
}

function teammateGroupRecord(teammate = {}) {
    const teammateId = teammate.id ?? teammate.teammateId ?? ""
    const teammateName = teammate.name ?? teammate.teammateName ?? { zhCN: "" }
    return {
        ...teammate,
        id: teammateId,
        maintenanceType: "teammateGroup",
        name: teammateName,
        teammateId,
        teammateName,
        images: teammate.images ?? { icon: "", source: "" },
        buffs: (teammate.buffs ?? []).map(buff => teammateBuffRecord({
            id: teammateId,
            name: teammateName,
        }, buff)),
    }
}

function normalizeTeammateGroupRecord(item = {}) {
    if (item?.maintenanceType === "teammate" || (!Array.isArray(item?.buffs) && item?.teammateId)) {
        return {
            ...teammateGroupRecord({
                id: item.teammateId ?? item.id ?? "",
                name: item.teammateName ?? item.name ?? { zhCN: "" },
                images: item.images ?? { icon: "", source: "" },
                buffs: [item],
            }),
            ...(item.__isDraft ? { __isDraft: item.__isDraft } : {}),
            ...(item.__draftId ? { __draftId: item.__draftId } : {}),
            ...(item.__sessionKey ? { __sessionKey: item.__sessionKey } : {}),
        }
    }

    return teammateGroupRecord(item ?? blankTeammateGroupDraft())
}

function teammateBuffSelectionValue(buff = {}, index = 0) {
    return buff?.id ? `id:${buff.id}` : `index:${index}`
}

function selectedTeammateBuffSelection(group) {
    return selectedTeammateBuffIds.get(recordKey(group))
        ?? (activeKind === "teammateBuffs" && selectedKey ? selectedTeammateBuffIds.get(selectedKey) : "")
        ?? ""
}

function selectedTeammateBuffIndex(group = selectedRecord()) {
    const buffs = group?.buffs ?? []
    if (!buffs.length) {
        return -1
    }

    const selection = selectedTeammateBuffSelection(group)
    if (selection.startsWith("id:")) {
        const id = selection.slice("id:".length)
        const index = buffs.findIndex(buff => buff.id === id)
        if (index >= 0) {
            return index
        }
    }
    if (selection.startsWith("index:")) {
        const index = Number(selection.slice("index:".length))
        if (Number.isInteger(index) && index >= 0 && index < buffs.length) {
            return index
        }
    }

    return 0
}

function selectedTeammateBuff(group = selectedRecord()) {
    const index = selectedTeammateBuffIndex(group)
    return index >= 0 ? group?.buffs?.[index] ?? null : null
}

function setSelectedTeammateBuff(group, buff, index = 0) {
    selectedTeammateBuffIds.set(recordKey(group), teammateBuffSelectionValue(buff, index))
}

function flattenedTeammateBuffRecords(groups = collectionForKind("teammateBuffs")) {
    return (groups ?? []).flatMap(group =>
        (group.buffs ?? []).map(buff => teammateBuffRecord(group, buff))
    )
}

function rawCollections() {
    return {
        agents: catalog?.agents?.agents ?? [],
        agentSkills: catalog?.agentSkills?.agentSkills ?? [],
        wEngines: catalog?.wEngines?.wEngines ?? [],
        driveDiscSets: catalog?.driveDiscSets?.sets ?? [],
        anomalyEffects: anomalyMaintenanceRecords(),
        teammateBuffs: (catalog?.combatBuffs?.teammates ?? []).map(teammateGroupRecord),
        fieldBuffs: [
            ...(catalog?.combatBuffs?.fieldBuffs ?? []),
            ...(catalog?.combatBuffs?.buffs ?? []).filter(buff => buff.sourceType === "field"),
        ],
        bossBuffs: [
            ...(catalog?.combatBuffs?.bossBuffs ?? []),
            ...(catalog?.combatBuffs?.buffs ?? []).filter(buff => buff.sourceType === "boss"),
        ],
    }
}

function anomalyMaintenanceType(record = {}) {
    return record.settlementType === "disorder" || record.maintenanceType === "disorder"
        ? "disorder"
        : "anomaly"
}

function anomalyMaintenanceRecords() {
    if (Array.isArray(catalog?.anomalyEffects?.effects)) {
        return catalog.anomalyEffects.effects.map(effect => ({
            ...effect,
            maintenanceType: anomalyMaintenanceType(effect),
        }))
    }
    return [
        ...(catalog?.anomalyEffects?.anomalyEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "attribute",
            maintenanceType: "anomaly",
        })),
        ...(catalog?.anomalyEffects?.disorderEffects ?? []).map(effect => ({
            ...effect,
            settlementType: "disorder",
            maintenanceType: "disorder",
        })),
    ]
}

function anomalyMaintenanceRecordsByType(type = "anomaly") {
    return anomalyMaintenanceRecords().filter(effect => anomalyMaintenanceType(effect) === type)
}

function collectionForActiveKind() {
    const records = rawCollections()[activeKind] ?? []
    return [
        ...activeDraftEntries().map(draftRecord).map(item => activeKind === "teammateBuffs" ? normalizeTeammateGroupRecord(item) : item),
        ...records.map(item => {
            const key = baseRecordKey(item)
            const edit = unsavedEdits.get(sessionKey(activeKind, key))
            const record = edit
                ? { ...item, ...structuredClone(edit), __sessionKey: key }
                : { ...item, __sessionKey: key }
            return activeKind === "teammateBuffs" ? normalizeTeammateGroupRecord(record) : record
        }),
    ]
}

function baseRecordKey(record) {
    if (record.maintenanceType === "anomaly" || record.maintenanceType === "disorder") {
        return `${record.maintenanceType}:${record.id}`
    }
    if (record.maintenanceType === "teammateGroup") {
        return `teammate:${record.id ?? record.teammateId ?? ""}`
    }

    return record.maintenanceType === "teammate"
        ? `teammate:${record.teammateId}:${record.id}`
        : record.id
}

function recordKey(record) {
    if (record?.__isDraft) {
        return draftKey(record.__draftId)
    }

    return record.__sessionKey ?? baseRecordKey(record)
}

function selectedRecord() {
    return collectionForActiveKind().find(item => recordKey(item) === selectedKey) ?? null
}

function selectedCleanRecord() {
    return stripDraftMetadata(selectedRecord())
}

function rawSelectedRecord() {
    return (rawCollections()[activeKind] ?? []).find(item => baseRecordKey(item) === selectedKey) ?? null
}

function teammateGroupFromPayload(payload, baseGroup = selectedCleanRecord()) {
    const teammate = payload?.teammate ?? {}
    const buff = payload?.buff ?? blankTeammateBuffDraft()
    const group = normalizeTeammateGroupRecord(baseGroup ?? {
        id: teammate.id ?? "",
        name: teammate.name ?? { zhCN: "" },
        buffs: [],
    })
    const teammateId = teammate.id ?? group.id ?? ""
    const teammateName = teammate.name ?? group.name ?? { zhCN: "" }
    const teammateImages = teammate.images ?? group.images ?? { icon: "", source: "" }
    const updatedBuff = teammateBuffRecord({ id: teammateId, name: teammateName }, buff)
    const buffs = [...(group.buffs ?? [])]
    const selectedIndex = selectedTeammateBuffIndex(group)
    const existingIndex = updatedBuff.id
        ? buffs.findIndex(item => item.id === updatedBuff.id)
        : selectedIndex
    const targetIndex = existingIndex >= 0 ? existingIndex : buffs.length
    buffs[targetIndex] = updatedBuff
    const nextGroup = {
        ...group,
        id: teammateId,
        name: teammateName,
        teammateId,
        teammateName,
        images: teammateImages,
        buffs,
    }
    setSelectedTeammateBuff(nextGroup, updatedBuff, targetIndex)
    return nextGroup
}

function editorRecordFromPayload(payload) {
    if (activeKind !== "teammateBuffs" || !payload?.teammate || !payload?.buff) {
        return stripDraftMetadata(payload)
    }

    return teammateGroupFromPayload(payload)
}

function statLabel(stat) {
    return STAT_LABELS[stat] ?? catalog?.meta?.statRules?.statDisplay?.[stat]?.label ?? stat
}

function driveDiscMainStatPool(slot) {
    return catalog?.meta?.statRules?.driveDisc?.mainStatPools?.[String(slot)] ?? []
}

function preferredMainStats(item = {}, slot) {
    const source = item.preferredDriveDiscs?.mainStatLimits
        ?? item.preferredDriveDiscs?.mainStats
        ?? item.preferredDriveDiscs
        ?? {}
    const raw = source[String(slot)] ?? source[slot] ?? []
    return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : []
}

function preferredDriveDiscDefaultSetId(item = {}) {
    return String(
        item.preferredDriveDiscs?.defaultSetId
            ?? item.preferredDriveDiscs?.defaultSet
            ?? item.defaultDriveDiscSetId
            ?? "",
    )
}

function driveDiscSetOptions(selected = "") {
    const sets = [...(rawCollections().driveDiscSets ?? [])]
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
    return selectOptions(sets.map(set => [set.id, nameOf(set)]), selected)
}

function mainStatChoiceMarkup(slot, selected = [], datasetName = "preferred-main-stat") {
    const selectedSet = new Set(selected)
    return driveDiscMainStatPool(slot).map(stat => `
        <label class="main-stat-choice${selectedSet.has(stat) ? " active" : ""}">
          <input type="checkbox" data-${datasetName}="${escapeHtml(String(slot))}" value="${escapeHtml(stat)}"${selectedSet.has(stat) ? " checked" : ""}>
          <span>${escapeHtml(statLabel(stat))}</span>
        </label>
    `).join("")
}

function agentSkillForAgentId(agentId = document.getElementById("recordId")?.value.trim()) {
    return rawCollections().agentSkills.find(skill => skill.agentId === agentId) ?? null
}

function maintenanceDamageSkillCategories(skill = agentSkillForAgentId()) {
    return (skill?.categories ?? [])
        .map(category => ({
            ...category,
            moves: (category.moves ?? [])
                .map(move => ({
                    ...move,
                    rows: damageSkillRowsWithGeneratedTotals(category, move)
                        .filter(row => (row.kind ?? "damageMultiplier") === "damageMultiplier"),
                }))
                .filter(move => move.rows.length),
        }))
        .filter(category => category.moves.length)
}

function defaultCalculationEventDraft(kind = "direct") {
    const index = [...els.maintenanceForm.querySelectorAll("[data-default-calc-event-row]")].length + 1
    if (kind === "skillGroup") {
        const groups = readDefaultCalculationSkillGroups()
        const group = groups[0]
        return {
            id: `skillGroup-${index}`,
            kind: "skillGroup",
            skillGroupId: group?.id ?? "",
            count: Number(group?.defaultCount ?? 1),
        }
    }
    if (kind === "anomaly") {
        return {
            id: `anomaly-${index}`,
            kind: "anomaly",
            settlementType: "attribute",
            anomalyEffect: "assault",
            procCount: 1,
            count: 1,
        }
    }
    if (kind === "disorder") {
        return {
            id: `disorder-${index}`,
            kind: "anomaly",
            settlementType: "disorder",
            disorderType: "normal",
            anomalyEffect: "burn",
            elapsedSeconds: 0,
            count: 1,
        }
    }
    const skill = agentSkillForAgentId()
    const category = maintenanceDamageSkillCategories(skill)[0]
    const move = category?.moves?.[0]
    const row = move?.rows?.[0]
    return {
        id: kind === "sheer" ? `sheer-${index}` : `direct-${index}`,
        kind: kind === "sheer" ? "sheer" : "direct",
        count: 1,
        critMode: "expected",
        skillRef: {
            agentSkillId: skill?.id ?? "",
            categoryId: category?.id ?? "",
            moveId: move?.id ?? "",
            rowId: row?.id ?? "",
        },
    }
}

function anomalyEffectMaintenanceOptions(selected = "") {
    return selectOptions(anomalyMaintenanceRecordsByType("anomaly").map(effect => [
        effect.id,
        localized(effect.label) || effect.id,
    ]), selected)
}

function disorderEffectMaintenanceOptions(selected = "") {
    return selectOptions(anomalyMaintenanceRecordsByType("disorder").map(effect => [
        effect.id,
        localized(effect.label) || effect.id,
    ]), selected)
}

function defaultCalculationEventKind(event = {}) {
    if (event.kind === "skillGroup") {
        return "skillGroup"
    }
    if (event.kind === "direct") {
        return "direct"
    }
    if (event.kind === "sheer") {
        return "sheer"
    }
    return event.kind === "disorder" || event.settlementType === "disorder" ? "disorder" : "anomaly"
}

function defaultCalculationDamageSource(event = {}) {
    return event.skillRef ? "skill" : "manual"
}

function defaultCalculationAnomalyEffectId(event = {}) {
    return event.anomalyEffect ?? event.previousAnomalyEffect ?? ""
}

function defaultCalculationDisorderType(event = {}) {
    return event.disorderType === "polarized" ? "polarized" : "normal"
}

function defaultCalcCategoryOptions(selected = "") {
    return selectOptions(maintenanceDamageSkillCategories().map(category => [category.id, localized(category.name) || category.id]), selected)
}

function defaultCalcMoveOptions(categoryId, selected = "") {
    const category = maintenanceDamageSkillCategories().find(item => item.id === categoryId)
    return selectOptions((category?.moves ?? []).map(move => [move.id, localized(move.name) || move.id]), selected)
}

function defaultCalcRowOptions(categoryId, moveId, selected = "") {
    const category = maintenanceDamageSkillCategories().find(item => item.id === categoryId)
    const move = (category?.moves ?? []).find(item => item.id === moveId)
    return selectOptions((move?.rows ?? []).map(row => [row.id, localized(row.label) || row.id]), selected)
}

function defaultCalcSkillGroupOptions(selected = "") {
    return selectOptions(readDefaultCalculationSkillGroups().map(group => [
        group.id,
        localized(group.name) || group.id,
    ]), selected)
}

function defaultCalculationEventHtml(event = {}, index = 0, selectedEventId = "", options = {}) {
    void selectedEventId
    const kind = defaultCalculationEventKind(event)
    const usesSkill = ["direct", "sheer"].includes(kind)
    const usesManualMultiplier = usesSkill && defaultCalculationDamageSource(event) === "manual"
    const usesSkillGroup = kind === "skillGroup"
    const skill = agentSkillForAgentId()
    const categories = maintenanceDamageSkillCategories(skill)
    const skillRef = event.skillRef ?? defaultCalculationEventDraft("direct").skillRef ?? {}
    const categoryId = skillRef.categoryId || categories[0]?.id || ""
    const moveId = skillRef.moveId || categories.find(item => item.id === categoryId)?.moves?.[0]?.id || ""
    const rowId = skillRef.rowId || categories.find(item => item.id === categoryId)?.moves?.find(item => item.id === moveId)?.rows?.[0]?.id || ""
    const isGroupEvent = Number.isInteger(options.groupIndex)
    const isVariantEvent = Number.isInteger(options.variantIndex)
    const rowAttr = isGroupEvent
        ? `data-default-calc-group-event-row="${options.groupIndex}"`
        : isVariantEvent
            ? `data-default-calc-event-row="${options.variantIndex}"`
            : "data-default-calc-event-row"
    const removeAttr = isGroupEvent
        ? `data-remove-default-calc-group-event="${options.groupIndex}:${index}"`
        : isVariantEvent
            ? `data-remove-default-calc-event="${options.variantIndex}:${index}"`
            : `data-remove-default-calc-event="${index}"`
    const kindOptions = [
        ["direct", "直伤"],
        ["sheer", "贯穿"],
        ["anomaly", "属性异常"],
        ["disorder", "紊乱"],
        ...(!isGroupEvent ? [["skillGroup", "技能组"]] : []),
    ]
    const group = readDefaultCalculationSkillGroups().find(item => item.id === event.skillGroupId)
    const groupLimits = group ? {
        min: Number(group.minCount ?? 0),
        max: group.maxCount === undefined || group.maxCount === null || group.maxCount === "" ? null : Number(group.maxCount),
        step: Number(group.step ?? 1),
    } : { min: 0, max: null, step: 1 }
    const countMax = groupLimits.max === null ? "" : ` max="${escapeHtml(groupLimits.max)}"`
    const skillFieldsAttr = usesSkill && !usesManualMultiplier ? "" : " hidden"
    const manualFieldsAttr = usesManualMultiplier ? "" : " hidden"
    const damageElement = event.damageElement || ""
    return `
        <article class="maintenance-subcard" ${rowAttr}>
          <div class="maintenance-section-head">
            <strong>计算事件</strong>
            <button type="button" class="compact-btn danger-lite" ${removeAttr}>删除</button>
          </div>
          <div class="maintenance-grid calculation-event-grid">
            <label class="field"><span>事件 ID</span><input data-default-calc-event-id value="${escapeHtml(event.id ?? `${kind}-${index + 1}`)}"></label>
            <label class="field"><span>类型</span><select data-default-calc-kind>${selectOptions(kindOptions, kind)}</select></label>
            <label class="field"><span>次数</span><input data-default-calc-count type="number" min="${escapeHtml(groupLimits.min)}"${countMax} step="${escapeHtml(groupLimits.step)}" value="${escapeHtml(event.count ?? 1)}"></label>
            <label class="field default-calc-skill-group-only"${usesSkillGroup ? "" : " hidden"}><span>技能组</span><select data-default-calc-skill-group>${defaultCalcSkillGroupOptions(event.skillGroupId)}</select></label>
            <label class="field default-calc-skill-group-only"${usesSkillGroup ? "" : " hidden"}><span>组内事件</span><input type="text" value="${escapeHtml(Array.isArray(group?.events) ? `${group.events.length} 项` : "未选择")}" disabled></label>
            <label class="field default-calc-direct-only"${usesSkill ? "" : " hidden"}><span>伤害来源</span><select data-default-calc-damage-source>${selectOptions([["skill", "技能倍率"], ["manual", "手填倍率"]], usesManualMultiplier ? "manual" : "skill")}</select></label>
            <label class="field default-calc-direct-only"${skillFieldsAttr}><span>技能大类</span><select data-default-calc-category>${defaultCalcCategoryOptions(categoryId)}</select></label>
            <label class="field default-calc-direct-only"${skillFieldsAttr}><span>招式</span><select data-default-calc-move>${defaultCalcMoveOptions(categoryId, moveId)}</select></label>
            <label class="field default-calc-direct-only"${skillFieldsAttr}><span>倍率行</span><select data-default-calc-row>${defaultCalcRowOptions(categoryId, moveId, rowId)}</select></label>
            <label class="field default-calc-manual-only"${manualFieldsAttr}><span>事件名称</span><input data-default-calc-label value="${escapeHtml(event.label ?? "")}" placeholder="额外能力：落雷"></label>
            <label class="field default-calc-manual-only"${manualFieldsAttr}><span>手填倍率%</span><input data-default-calc-skill-multiplier type="number" min="0" step="0.1" value="${escapeHtml(event.skillMultiplier ?? 100)}"></label>
            <label class="field default-calc-manual-only"${manualFieldsAttr}><span>伤害属性</span><select data-default-calc-damage-element><option value="">同角色属性</option>${selectOptions(DAMAGE_ELEMENT_OPTIONS, damageElement)}</select></label>
            <label class="field default-calc-direct-only"${usesSkill ? "" : " hidden"}><span>暴击模式</span><select data-default-calc-crit-mode>${selectOptions([["expected", "期望"], ["crit", "暴击"], ["nonCrit", "非暴击"]], event.critMode ?? "expected")}</select></label>
            <label class="field default-calc-anomaly-only"${kind === "anomaly" ? "" : " hidden"}><span>异常类型</span><select data-default-calc-anomaly-effect>${anomalyEffectMaintenanceOptions(event.anomalyEffect ?? "assault")}</select></label>
            <label class="field default-calc-anomaly-only"${kind === "anomaly" ? "" : " hidden"}><span>结算次数</span><input data-default-calc-proc-count type="number" min="0" step="1" value="${escapeHtml(event.procCount ?? DEFAULT_ANOMALY_PROC_COUNTS[event.anomalyEffect] ?? 1)}"></label>
            <label class="field default-calc-disorder-only"${kind === "disorder" ? "" : " hidden"}><span>紊乱类型</span><select data-default-calc-disorder-type>${selectOptions(DISORDER_TYPE_OPTIONS, defaultCalculationDisorderType(event))}</select></label>
            <label class="field default-calc-disorder-only"${kind === "disorder" ? "" : " hidden"}><span>原异常</span><select data-default-calc-disorder-effect>${disorderEffectMaintenanceOptions(defaultCalculationAnomalyEffectId(event) || "burn")}</select></label>
            <label class="field default-calc-disorder-only"${kind === "disorder" ? "" : " hidden"}><span>已生效秒数</span><input data-default-calc-elapsed type="number" min="0" step="0.1" value="${escapeHtml(event.elapsedSeconds ?? 0)}"></label>
          </div>
        </article>
    `
}

function renderDefaultCalculationEvents(events = null, selectedEventId = null) {
    const container = document.getElementById("defaultCalculationEventRows")
    if (!container) {
        return
    }
    const source = events ?? readDefaultCalculationEvents()
    container.innerHTML = source.map((event, index) => defaultCalculationEventHtml(event, index, selectedEventId ?? source[0]?.id ?? "")).join("")
}

function readDefaultCalculationEventRows(rows) {
    const skill = agentSkillForAgentId()
    return [...rows].map((row, index) => {
        const kind = row.querySelector("[data-default-calc-kind]")?.value ?? "direct"
        const id = row.querySelector("[data-default-calc-event-id]")?.value.trim() || `${kind}-${index + 1}`
        const count = Number(row.querySelector("[data-default-calc-count]")?.value || 1)
        if (kind === "skillGroup") {
            return {
                id,
                kind: "skillGroup",
                skillGroupId: row.querySelector("[data-default-calc-skill-group]")?.value ?? "",
                count,
            }
        }
        if (kind === "anomaly") {
            return {
                id,
                kind: "anomaly",
                settlementType: "attribute",
                anomalyEffect: row.querySelector("[data-default-calc-anomaly-effect]")?.value || "assault",
                procCount: Number(row.querySelector("[data-default-calc-proc-count]")?.value || 1),
                count,
            }
        }
        if (kind === "disorder") {
            return {
                id,
                kind: "anomaly",
                settlementType: "disorder",
                disorderType: defaultCalculationDisorderType({
                    disorderType: row.querySelector("[data-default-calc-disorder-type]")?.value,
                }),
                anomalyEffect: row.querySelector("[data-default-calc-disorder-effect]")?.value || "burn",
                elapsedSeconds: Number(row.querySelector("[data-default-calc-elapsed]")?.value || 0),
                count,
            }
        }
        return {
            id,
            kind: kind === "sheer" ? "sheer" : "direct",
            count,
            critMode: row.querySelector("[data-default-calc-crit-mode]")?.value || "expected",
            ...(row.querySelector("[data-default-calc-damage-source]")?.value === "manual"
                ? {
                    label: row.querySelector("[data-default-calc-label]")?.value.trim() || "",
                    skillMultiplier: Number(row.querySelector("[data-default-calc-skill-multiplier]")?.value || 100),
                    ...(row.querySelector("[data-default-calc-damage-element]")?.value
                        ? { damageElement: row.querySelector("[data-default-calc-damage-element]")?.value }
                        : {}),
                }
                : {
                    skillRef: {
                        agentSkillId: skill?.id ?? "",
                        categoryId: row.querySelector("[data-default-calc-category]")?.value ?? "",
                        moveId: row.querySelector("[data-default-calc-move]")?.value ?? "",
                        rowId: row.querySelector("[data-default-calc-row]")?.value ?? "",
                    },
                }),
        }
    })
}

function readDefaultCalculationEvents() {
    const variantRow = els.maintenanceForm.querySelector("[data-default-calc-variant-row]")
    return readDefaultCalculationEventRows((variantRow ?? els.maintenanceForm).querySelectorAll("[data-default-calc-event-row]"))
}

function defaultCalculationCinemaOptions(selected = 0) {
    return selectOptions(Array.from({ length: 7 }, (_, level) => [level, `${level} 影`]), selected)
}

function defaultCalculationConfigDraft(cinemaLevel = 0) {
    const level = normalizeDefaultCalculationCinemaLevel(cinemaLevel)
    return {
        cinemaLevel: level,
        mode: "custom",
        name: defaultCalculationVariantName(level),
        selectedEventId: null,
        events: [defaultCalculationEventDraft("direct")],
    }
}

function maintenanceDefaultCalculationVariants(config = null) {
    const entries = defaultCalculationConfigEntries(config)
    if (!entries.length) {
        return [defaultCalculationConfigDraft(0)]
    }
    return entries.map(entry => {
        const level = normalizeDefaultCalculationCinemaLevel(entry.cinemaLevel)
        const events = Array.isArray(entry.events) ? entry.events : []
        return {
            ...entry,
            cinemaLevel: level,
            name: entry.name ?? defaultCalculationVariantName(level),
            events,
            selectedEventId: entry.selectedEventId ?? events[0]?.id ?? null,
        }
    })
}

function defaultCalculationVariantHtml(variant = {}, index = 0) {
    const level = normalizeDefaultCalculationCinemaLevel(variant.cinemaLevel)
    const agent = {
        specialty: document.getElementById("specialty")?.value ?? selectedCleanRecord()?.specialty,
    }
    const mode = normalizeDefaultCalculationModeForAgent(variant.mode ?? "custom", agent)
    const events = Array.isArray(variant.events) && variant.events.length
        ? variant.events
        : [defaultCalculationEventDraft("direct")]
    return `
        <article class="maintenance-subcard default-calc-variant-card" data-default-calc-variant-row>
          <div class="maintenance-section-head">
            <strong>默认循环（${escapeHtml(level)}影）</strong>
            <div class="skill-maintenance-actions">
              <button type="button" class="compact-btn" data-add-default-calc-event="${index}:direct">添加直伤</button>
              <button type="button" class="compact-btn" data-add-default-calc-event="${index}:sheer">添加贯穿</button>
              <button type="button" class="compact-btn" data-add-default-calc-event="${index}:anomaly">添加属性异常</button>
              <button type="button" class="compact-btn" data-add-default-calc-event="${index}:disorder">添加紊乱</button>
              <button type="button" class="compact-btn" data-add-default-calc-event="${index}:skillGroup">添加技能组</button>
              <button type="button" class="compact-btn danger-lite" data-remove-default-calc-variant="${index}">删除循环</button>
            </div>
          </div>
          <div class="maintenance-grid">
            <label class="field"><span>适用影画</span><select data-default-calc-cinema-level>${defaultCalculationCinemaOptions(level)}</select></label>
            <label class="field"><span>计算方式</span><select data-default-calc-mode>${selectOptions(defaultCalculationModeOptions(agent), mode)}</select></label>
            <label class="field"><span>名称</span><input data-default-calc-name value="${escapeHtml(localized(variant.name) || localized(defaultCalculationVariantName(level)))}" placeholder="${escapeHtml(localized(defaultCalculationVariantName(level)))}"></label>
          </div>
          <div class="skill-category-list" data-default-calc-event-rows>
            ${events.map((event, eventIndex) => defaultCalculationEventHtml(event, eventIndex, variant.selectedEventId, { variantIndex: index })).join("")}
          </div>
        </article>
    `
}

function renderDefaultCalculationVariants(variants = null) {
    const container = document.getElementById("defaultCalculationVariantRows")
    if (!container) {
        return
    }
    const source = variants ?? readDefaultCalculationVariants()
    container.innerHTML = source.map(defaultCalculationVariantHtml).join("")
}

function readDefaultCalculationVariants() {
    return [...els.maintenanceForm.querySelectorAll("[data-default-calc-variant-row]")].map((row, index) => {
        const cinemaLevel = normalizeDefaultCalculationCinemaLevel(
            row.querySelector("[data-default-calc-cinema-level]")?.value,
            index === 0 ? 0 : index,
        )
        const agent = selectedCleanRecord() ?? {}
        const mode = normalizeDefaultCalculationModeForAgent(
            row.querySelector("[data-default-calc-mode]")?.value ?? "custom",
            {
                specialty: document.getElementById("specialty")?.value ?? agent.specialty,
            },
        )
        const nameText = row.querySelector("[data-default-calc-name]")?.value.trim() || localized(defaultCalculationVariantName(cinemaLevel))
        const events = readDefaultCalculationEventRows(row.querySelectorAll("[data-default-calc-event-row]"))
        return {
            cinemaLevel,
            mode,
            name: { zhCN: nameText },
            selectedEventId: events[0]?.id ?? null,
            events,
        }
    })
}

function nextDefaultCalculationCinemaLevel(variants = readDefaultCalculationVariants()) {
    const usedLevels = new Set(variants.map(variant => Number(variant.cinemaLevel)))
    return [0, 1, 2, 3, 4, 5, 6].find(level => !usedLevels.has(level)) ?? 0
}

function defaultCalculationSkillGroupDraft() {
    const index = [...els.maintenanceForm.querySelectorAll("[data-default-calc-skill-group-row]")].length + 1
    return {
        id: `skill_group_${index}`,
        name: { zhCN: `技能组${index}` },
        description: { zhCN: "" },
        defaultCount: 1,
        minCount: 0,
        maxCount: 30,
        step: 1,
        events: [defaultCalculationEventDraft("direct")],
    }
}

function defaultCalculationSkillGroupHtml(group = {}, index = 0) {
    const events = Array.isArray(group.events) && group.events.length
        ? group.events
        : [defaultCalculationEventDraft("direct")]
    return `
        <article class="maintenance-subcard default-calc-skill-group-card" data-default-calc-skill-group-row>
          <div class="maintenance-section-head">
            <strong>技能组</strong>
            <div class="skill-maintenance-actions">
              <button type="button" class="compact-btn" data-add-default-calc-group-event="${index}:direct">添加直伤</button>
              <button type="button" class="compact-btn" data-add-default-calc-group-event="${index}:sheer">添加贯穿</button>
              <button type="button" class="compact-btn" data-add-default-calc-group-event="${index}:anomaly">添加属性异常</button>
              <button type="button" class="compact-btn" data-add-default-calc-group-event="${index}:disorder">添加紊乱</button>
              <button type="button" class="compact-btn danger-lite" data-remove-default-calc-skill-group="${index}">删除组</button>
            </div>
          </div>
          <div class="maintenance-grid">
            <label class="field"><span>组 ID</span><input data-default-calc-skill-group-id value="${escapeHtml(group.id ?? `skill_group_${index + 1}`)}"></label>
            <label class="field"><span>名称</span><input data-default-calc-skill-group-name value="${escapeHtml(localized(group.name) || "")}"></label>
            <label class="field"><span>默认次数</span><input data-default-calc-skill-group-default-count type="number" min="0" step="1" value="${escapeHtml(group.defaultCount ?? 1)}"></label>
            <label class="field"><span>最小次数</span><input data-default-calc-skill-group-min-count type="number" min="0" step="1" value="${escapeHtml(group.minCount ?? 0)}"></label>
            <label class="field"><span>最大次数</span><input data-default-calc-skill-group-max-count type="number" min="0" step="1" value="${escapeHtml(group.maxCount ?? 30)}"></label>
            <label class="field"><span>步长</span><input data-default-calc-skill-group-step type="number" min="0.000001" step="1" value="${escapeHtml(group.step ?? 1)}"></label>
            <label class="field field-wide"><span>描述</span><input data-default-calc-skill-group-description value="${escapeHtml(localized(group.description) || "")}"></label>
          </div>
          <div class="skill-category-list default-calc-skill-group-events">
            ${events.map((event, eventIndex) => defaultCalculationEventHtml(event, eventIndex, null, { groupIndex: index })).join("")}
          </div>
        </article>
    `
}

function renderDefaultCalculationSkillGroups(groups = null) {
    const container = document.getElementById("defaultCalculationSkillGroupRows")
    if (!container) {
        return
    }
    const source = groups ?? readDefaultCalculationSkillGroups()
    container.innerHTML = source.map(defaultCalculationSkillGroupHtml).join("")
}

function readDefaultCalculationSkillGroups() {
    return [...els.maintenanceForm.querySelectorAll("[data-default-calc-skill-group-row]")].map((row, index) => {
        const id = row.querySelector("[data-default-calc-skill-group-id]")?.value.trim() || `skill_group_${index + 1}`
        const maxCountText = row.querySelector("[data-default-calc-skill-group-max-count]")?.value.trim() ?? ""
        return {
            id,
            name: { zhCN: row.querySelector("[data-default-calc-skill-group-name]")?.value.trim() || id },
            description: { zhCN: row.querySelector("[data-default-calc-skill-group-description]")?.value.trim() || "" },
            defaultCount: Number(row.querySelector("[data-default-calc-skill-group-default-count]")?.value || 0),
            minCount: Number(row.querySelector("[data-default-calc-skill-group-min-count]")?.value || 0),
            ...(maxCountText ? { maxCount: Number(maxCountText) } : {}),
            step: Number(row.querySelector("[data-default-calc-skill-group-step]")?.value || 1),
            events: readDefaultCalculationEventRows(row.querySelectorAll("[data-default-calc-group-event-row]")),
        }
    })
}

function readDefaultCalculationConfig() {
    const variants = readDefaultCalculationVariants()
        .filter(variant => Array.isArray(variant.events) && variant.events.length)
        .sort((left, right) => Number(left.cinemaLevel ?? 0) - Number(right.cinemaLevel ?? 0))
    if (!variants.length) {
        return null
    }
    const baseIndex = Math.max(0, variants.findIndex(variant => Number(variant.cinemaLevel) === 0))
    const [base] = variants.splice(baseIndex, 1)
    return {
        ...base,
        ...(variants.length ? { variants } : {}),
    }
}

function statsSummary(stats = []) {
    return stats.map(item => {
        const raw = percentInputValue(item.stat, Number(item.value ?? 0))
        const suffix = PERCENT_VALUE_STATS.has(item.stat) ? "%" : ""
        return `${statLabel(item.stat)} +${raw}${suffix}`
    }).join(" / ")
}

function anomalyEffectScopeOptions() {
    const byId = new Map()
    for (const item of catalog?.meta?.anomalyEffects ?? []) {
        byId.set(item.id, localized(item.label) || item.id)
    }
    for (const item of catalog?.meta?.disorderEffects ?? []) {
        byId.set(item.id, localized(item.label) || item.id)
    }
    return [...byId.entries()]
}

function checkboxOptions(options, selected = [], dataName) {
    const selectedSet = new Set(selected)
    return `
        <div class="maintenance-checkbox-group">
          ${options.map(([value, label]) => `
            <label>
              <input type="checkbox" data-${dataName} value="${escapeHtml(value)}"${selectedSet.has(value) ? " checked" : ""}>
              <span>${escapeHtml(label)}</span>
            </label>
          `).join("")}
        </div>
    `
}

function isRuptureAgent(agent = {}) {
    return agent.specialty === "rupture"
}

function primaryDefaultCalculationModeForAgent(agent = {}) {
    return isRuptureAgent(agent) ? "sheer" : "single"
}

function defaultCalculationModeOptions(agent = {}) {
    return [
        ["custom", "自定义"],
        ...(!isRuptureAgent(agent) ? [["single", "最大化单个技能伤害"]] : []),
        ...(isRuptureAgent(agent) ? [["sheer", "最大化贯穿伤害"]] : []),
        ["anomaly", "最大化异常伤害"],
    ]
}

function normalizeDefaultCalculationModeForAgent(mode, agent = {}) {
    const options = new Set(defaultCalculationModeOptions(agent).map(([value]) => value))
    return options.has(mode) ? mode : primaryDefaultCalculationModeForAgent(agent)
}

function syncDefaultCalculationModeOptions() {
    const specialty = document.getElementById("specialty")?.value
    if (!specialty) {
        return
    }
    for (const select of els.maintenanceForm.querySelectorAll("[data-default-calc-mode]")) {
        const currentMode = normalizeDefaultCalculationModeForAgent(select.value, { specialty })
        select.innerHTML = selectOptions(defaultCalculationModeOptions({ specialty }), currentMode)
    }
}

function checkedValues(row, selector) {
    return [...row.querySelectorAll(`${selector}:checked`)].map(input => input.value)
}

function agentSkillOptions() {
    return [["", "全部角色"], ...(rawCollections().agentSkills ?? []).map(skill => [skill.id, nameOf(skill)])]
}

function agentSkillById(agentSkillId) {
    return (rawCollections().agentSkills ?? []).find(skill => skill.id === agentSkillId) ?? null
}

function agentById(agentId) {
    return (rawCollections().agents ?? []).find(agent => agent.id === agentId) ?? null
}

function skillTargetLabel(target = {}) {
    const skillSet = agentSkillById(target.agentSkillId)
    const agentLabel = String(localized(agentById(skillSet?.agentId)?.name) || localized(skillSet?.name) || target.agentSkillId || "")
        .replace(/技能倍率$/, "")
        .trim()
    const category = (skillSet?.categories ?? []).find(item => item.id === target.categoryId)
    const move = (category?.moves ?? []).find(item => item.id === target.moveId)
    const row = damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {}).find(item => item.id === target.rowId)
    const categoryLabel = localized(category?.name) || target.categoryId
    const prefixLabel = Array.isArray(target.moveIdPrefixes) && target.moveIdPrefixes.length
        ? `${target.moveIdPrefixes.join(" / ")}*`
        : ""
    return [
        agentLabel || "全部角色",
        !target.moveId && !target.rowId ? categoryLabel : "",
        localized(move?.name) || target.moveId,
        prefixLabel,
        target.rowId ? localized(row?.label) || target.rowId : "",
    ].filter(Boolean).join("/")
}

function skillTargetFieldsHtml(target = {}, targetIndex = 0) {
    const skills = agentSkillOptions()
    const selectedSkillId = target.agentSkillId || ""
    const skillSet = agentSkillById(selectedSkillId)
    const categories = skillSet?.categories ?? GENERIC_SKILL_CATEGORY_OPTIONS.map(([id, label]) => ({ id, name: { zhCN: label }, moves: [] }))
    const selectedCategoryId = target.categoryId || categories[0]?.id || ""
    const category = categories.find(item => item.id === selectedCategoryId) ?? categories[0] ?? null
    const moves = category?.moves ?? []
    const selectedMoveId = target.moveId || ""
    const move = moves.find(item => item.id === selectedMoveId) ?? null
    const rowOptions = [
        ["", "整招式"],
        ...damageSkillRowsWithGeneratedTotals(category ?? {}, move ?? {}).map(row => [row.id, localized(row.label) || row.id]),
    ]
    const moveOptions = [
        ["", "不限招式"],
        ...moves.map(item => [item.id, localized(item.name) || item.id]),
    ]
    return `
        <div class="maintenance-skill-target-row" data-skill-target-row="${targetIndex}">
          <label class="field">
            <span>技能表</span>
            <select data-effect-skill-target-agent>${selectOptions(skills, selectedSkillId)}</select>
          </label>
          <label class="field">
            <span>技能大类</span>
            <select data-effect-skill-target-category>${selectOptions(categories.map(item => [item.id, localized(item.name) || item.id]), selectedCategoryId)}</select>
          </label>
          <label class="field">
            <span>招式</span>
            <select data-effect-skill-target-move>${selectOptions(moveOptions, selectedMoveId)}</select>
          </label>
          <label class="field">
            <span>招式 ID 前缀</span>
            <input type="text" data-effect-skill-target-move-prefixes value="${escapeHtml((target.moveIdPrefixes ?? []).join(", "))}" placeholder="如 chain_, ultimate_">
          </label>
          <label class="field">
            <span>倍率行</span>
            <select data-effect-skill-target-row-id>${selectOptions(rowOptions, target.rowId ?? "")}</select>
          </label>
          <button type="button" class="compact-btn maintenance-remove-skill-target" data-remove-skill-target="${targetIndex}">删除目标</button>
        </div>
    `
}

function skillTargetsHtml(targets = []) {
    const rows = targets.length ? targets : [{}]
    return `
        <div class="maintenance-skill-targets" data-effect-skill-targets>
          ${rows.map((target, index) => skillTargetFieldsHtml(target, index)).join("")}
          <button type="button" class="compact-btn maintenance-add-skill-target" data-add-skill-target>添加技能目标</button>
        </div>
    `
}

function readSkillTargets(row) {
    return [...row.querySelectorAll(".maintenance-skill-target-row")]
        .map(targetRow => {
            const target = {
                agentSkillId: targetRow.querySelector("[data-effect-skill-target-agent]")?.value ?? "",
                categoryId: targetRow.querySelector("[data-effect-skill-target-category]")?.value ?? "",
                moveId: targetRow.querySelector("[data-effect-skill-target-move]")?.value ?? "",
            }
            const moveIdPrefixes = String(targetRow.querySelector("[data-effect-skill-target-move-prefixes]")?.value ?? "")
                .split(",")
                .map(item => item.trim())
                .filter(Boolean)
            const rowId = targetRow.querySelector("[data-effect-skill-target-row-id]")?.value ?? ""
            if (rowId) {
                target.rowId = rowId
            }
            if (moveIdPrefixes.length) {
                target.moveIdPrefixes = moveIdPrefixes
            }
            return target
        })
        .filter(target => target.agentSkillId || target.categoryId || target.moveId || target.rowId || target.moveIdPrefixes?.length)
}

function refreshSkillTargetRow(targetRow, target = null) {
    if (!targetRow) {
        return
    }
    const current = target ?? {
        agentSkillId: targetRow.querySelector("[data-effect-skill-target-agent]")?.value ?? "",
        categoryId: targetRow.querySelector("[data-effect-skill-target-category]")?.value ?? "",
        moveId: targetRow.querySelector("[data-effect-skill-target-move]")?.value ?? "",
        rowId: targetRow.querySelector("[data-effect-skill-target-row-id]")?.value ?? "",
        moveIdPrefixes: String(targetRow.querySelector("[data-effect-skill-target-move-prefixes]")?.value ?? "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean),
    }
    const index = Number(targetRow.dataset.skillTargetRow ?? 0)
    targetRow.outerHTML = skillTargetFieldsHtml(current, index)
}

function replaceSelectOptions(select, options, selected = "") {
    if (!select) {
        return ""
    }
    const nextSelected = options.some(([value]) => value === selected) ? selected : options[0]?.[0] ?? ""
    select.innerHTML = selectOptions(options, nextSelected)
    return nextSelected
}

function syncMaintenanceStatRow(row) {
    if (!row) {
        return
    }
    const targetKind = row.querySelector("[data-stat-target-kind]")?.value === "skill" ? "skill" : "default"
    const statSelect = row.querySelector("[data-stat-key]")
    const stat = replaceSelectOptions(statSelect, statOptionsForTargetKind(targetKind), statSelect?.value ?? "atkFlat")
    row.querySelector("[data-stat-mode]").value = modeForStat(stat)
    const label = row.querySelector("[data-stat-value]")?.closest(".field")?.querySelector("span")
    if (label) {
        label.outerHTML = fieldLabel(`数值${PERCENT_INPUT_STATS.has(stat) ? "（15 表示 15%）" : ""}`, true)
    }
    const isEventModifier = isEventModifierStat(stat)
    const simple = row.parentElement?.dataset.simple === "true"
    for (const item of row.querySelectorAll("[data-stat-mode], [data-stat-basis]")) {
        item.closest(".field").hidden = isEventModifier || targetKind === "skill" || simple
    }
    const skillTargetField = row.querySelector(".stat-skill-target-modifier-only")
    if (skillTargetField) {
        skillTargetField.hidden = targetKind !== "skill"
    }
}

function syncEffectStatOptions(row) {
    if (!row) {
        return
    }
    const targetKind = row.querySelector("[data-effect-target-kind]")?.value === "skill" ? "skill" : "default"
    const statSelect = row.querySelector("[data-effect-stat]")
    const stat = replaceSelectOptions(statSelect, statOptionsForTargetKind(targetKind), statSelect?.value ?? "atkFlat")
    row.querySelector("[data-effect-mode]").value = modeForStat(stat)
    syncBuffEffectRow(row)
}

function damageModifierSummary(rule = {}) {
    const appliesTo = rule.appliesTo ?? {}
    const scope = [
        ...(appliesTo.damageKinds ?? []).map(kind => Object.fromEntries(DAMAGE_KIND_OPTIONS)[kind] ?? kind),
        ...(appliesTo.anomalyEffects ?? []).map(effect => Object.fromEntries(anomalyEffectScopeOptions())[effect] ?? effect),
        ...(appliesTo.elements ?? []).map(element => Object.fromEntries(DAMAGE_ELEMENT_OPTIONS)[element] ?? element),
        ...(appliesTo.skillTargets ?? []).map(target => skillTargetLabel(target)),
    ].filter(Boolean).join(" / ") || "全部"
    const rawValue = Number(rule.value ?? 0)
    const value = rule.valueUnit === "decimal" ? rawValue * 100 : Math.abs(rawValue) > 1 ? rawValue : rawValue * 100
    return `${DAMAGE_MODIFIER_LABELS[rule.kind] ?? rule.kind} +${value}%（${scope}）`
}

function effectStats(effect) {
    if (Array.isArray(effect?.stats)) {
        return effect.stats
    }

    if (Array.isArray(effect?.effects)) {
        return effect.effects
            .map(rule => editableEffectRule(rule))
            .filter(rule => (rule.type ?? "fixed") === "fixed")
            .map(rule => ({
                id: rule.id ?? null,
                stat: rule.stat,
                value: rule.value,
                mode: rule.mode ?? "flat",
                basis: rule.basis ?? null,
                label: rule.label ?? null,
                target: rule.target ?? { kind: "default" },
            }))
    }

    return effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
}

function effectRules(effect) {
    if (Array.isArray(effect?.effects)) {
        return effect.effects.map(rule => editableEffectRule(rule))
    }

    return effectStats(effect).map((stat, index) => ({
        id: stat.id ?? `effect-${index + 1}`,
        type: "fixed",
        stat: stat.stat,
        value: stat.value,
        mode: stat.mode ?? "flat",
        basis: stat.basis ?? null,
    }))
}

function buffModifiers(effect) {
    return Array.isArray(effect?.buffModifiers) ? effect.buffModifiers : []
}

function buffModifierSummary(modifier = {}) {
    const factor = Number(modifier.factor ?? 1)
    const label = localized(modifier.label) || "Buff 修饰"
    const targetBuffs = Array.isArray(modifier.targetBuffIds) ? modifier.targetBuffIds.filter(Boolean).join(" / ") : ""
    const targetEffects = Array.isArray(modifier.targetEffectIds) ? modifier.targetEffectIds.filter(Boolean).join(" / ") : ""
    const target = [targetBuffs, targetEffects].filter(Boolean).join(" · ") || "未选择目标"
    return `${label}：${target} × ${Number((factor * 100).toFixed(3))}%`
}

function effectsSummary(item = {}) {
    const ruleSummaries = effectRules(item).map(rule => {
        if (rule.type === "damageModifier") {
            return damageModifierSummary(rule)
        }

        if (rule.type === "derived") {
            return `${statLabel(rule.stat)} = ${localized(rule.sourceLabel) || "来源数值"} × ${rule.ratio ?? 0}%${Number.isFinite(Number(rule.cap)) ? `，上限 ${rule.cap}` : ""}`
        }

        if (rule.type === "formula") {
            return `${statLabel(rule.stat)} = ${rule.formula?.expression || "未填写公式"}（${localized(rule.source?.label) || "来源数值"} x，默认 ${rule.source?.defaultValue ?? 0}）`
        }

        if (rule.type === "stacked") {
            return `${statLabel(rule.stat)} 每层 +${rule.valuePerStack ?? rule.value ?? 0}${PERCENT_VALUE_STATS.has(rule.stat) || rule.mode === "pct" ? "%" : ""}，最多 ${rule.maxStacks ?? 1} 层`
        }

        return `${statLabel(rule.stat)} +${rule.value ?? 0}${PERCENT_VALUE_STATS.has(rule.stat) || rule.mode === "pct" ? "%" : ""}`
    })
    const modifierSummaries = buffModifiers(item).map(buffModifierSummary)
    return [...ruleSummaries, ...modifierSummaries].join(" / ")
}

function teammateGroupSourceSummary(group = {}) {
    const sources = (group.buffs ?? [])
        .map(buff => localized(buff.source) || localized(buff.sourceLabel) || buff.id)
        .filter(Boolean)
    const uniqueSources = [...new Set(sources)]
    return uniqueSources.slice(0, 3).join(" / ")
}

function teammateGroupSearchText(group = {}) {
    const buffText = (group.buffs ?? []).flatMap(buff => [
        buff.id,
        localized(buff.source),
        localized(buff.sourceLabel),
        localized(buff.description),
        localized(buff.conditionLabel),
        effectsSummary(buff),
    ])
    return [
        group.id,
        group.teammateId,
        nameOf(group),
        localized(group.teammateName),
        group.images?.icon,
        group.images?.source,
        teammateGroupSourceSummary(group),
        ...buffText,
    ].join(" ").toLowerCase()
}

function teammateGroupDetail(group = {}) {
    const count = group.buffs?.length ?? 0
    const sources = teammateGroupSourceSummary(group)
    return [`${count} 个 Buff`, group.id, sources].filter(Boolean).join(" · ")
}

function teammateGroupImage(group = {}) {
    return group.images?.icon ?? group.images?.portrait ?? ""
}

function teammateAvatarMarkup(group = {}, className = "teammate-maintenance-avatar") {
    const image = teammateGroupImage(group)
    const label = nameOf(group)
    return image
        ? `<img class="${className}" src="${escapeHtml(image)}" alt="${escapeHtml(label)}">`
        : `<span class="${className} empty" aria-hidden="true"></span>`
}

function renderList() {
    const search = els.searchInput.value.trim().toLowerCase()
    const records = collectionForActiveKind().filter(item => {
        if (activeKind === "teammateBuffs") {
            return !search || teammateGroupSearchText(item).includes(search)
        }

        const haystack = [
            item.id,
            nameOf(item),
            localized(item.source),
            localized(item.sourceLabel),
            localized(item.sourcePeriod),
            localized(item.bossName),
            localized(item.bossSource),
            localized(item.label),
            localized(item.description),
            localized(item.teammateName),
        ].join(" ").toLowerCase()
        return !search || haystack.includes(search)
    })

    els.recordList.innerHTML = ""
    if (!records.length) {
        const empty = document.createElement("div")
        empty.className = "list-item empty"
        empty.textContent = "暂无数据"
        els.recordList.appendChild(empty)
        return
    }

    for (const item of records) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = recordKey(item) === selectedKey ? "maintenance-record active" : "maintenance-record"
        button.dataset.key = recordKey(item)

        const title = item.__isDraft
            ? (activeKind === "teammateBuffs"
                ? nameOf(item)
                : nameOf(item))
            : activeKind === "teammateBuffs"
                ? nameOf(item)
                : activeKind === "bossBuffs"
                    ? nameOf(item.bossName)
                : nameOf(item)
        const detail = item.__isDraft
            ? (activeKind === "teammateBuffs" ? `草稿 · ${teammateGroupDetail(item)}` : `草稿 · ${item.id || "尚未填写 ID"}`)
            : activeKind === "teammateBuffs"
                ? teammateGroupDetail(item)
                : activeKind === "fieldBuffs"
                    ? [localized(item.source), fieldPeriodDetail(item), effectsSummary(item)].filter(Boolean).join(" · ")
                    : activeKind === "bossBuffs"
                        ? [localized(item.bossSource), localized(item.sourcePeriod), effectsSummary(item)].filter(Boolean).join(" · ")
                        : activeKind === "anomalyEffects"
                            ? `${item.maintenanceType === "disorder" ? "紊乱" : "属性伤害"} · ${item.element ?? "-"} · ${item.id}`
                            : item.id

        button.innerHTML = activeKind === "teammateBuffs"
            ? `
                ${teammateAvatarMarkup(item, "maintenance-record-avatar")}
                <span class="maintenance-record-copy">
                  <strong>${escapeHtml(title)}</strong>
                  <span>${escapeHtml(detail || item.id)}</span>
                </span>
            `
            : `
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(detail || item.id)}</span>
            `
        els.recordList.appendChild(button)
    }
}

function renderStatRows(containerId, stats = [], options = {}) {
    const container = document.getElementById(containerId)
    if (!container) {
        return
    }

    const simple = options.simple ?? container.dataset.simple === "true"
    const allowDamageModifiers = options.allowDamageModifiers ?? container.dataset.allowDamageModifiers === "true"
    container.dataset.simple = simple ? "true" : "false"
    container.dataset.allowDamageModifiers = allowDamageModifiers ? "true" : "false"
    container.innerHTML = ""
    const rows = stats.length ? stats : [{ stat: "atkFlat", value: 0, mode: "flat", basis: "" }]
    rows.forEach((rawStat, index) => {
        const stat = allowDamageModifiers && rawStat.type === "damageModifier"
            ? legacyDamageModifierToRule(rawStat)
            : rawStat
        const targetKind = allowDamageModifiers ? ruleTargetKind(stat) : "default"
        const isEventModifier = allowDamageModifiers && isEventModifierStat(stat.stat)
        const statOptions = allowDamageModifiers ? statOptionsForTargetKind(targetKind) : STAT_OPTIONS.map(([key, label]) => [key, label])
        const selectedStat = statOptions.some(([key]) => key === stat.stat) ? stat.stat : statOptions[0]?.[0] ?? "atkFlat"
        const row = document.createElement("div")
        row.className = "maintenance-stat-row"
        row.dataset.statRow = containerId
        row.innerHTML = `
            <label class="field"${allowDamageModifiers ? "" : " hidden"}>
              ${fieldLabel("增幅对象", true)}
              <select data-stat-target-kind>${selectOptions([["default", "默认"], ["skill", "技能"]], targetKind)}</select>
            </label>
            <label class="field">
              ${fieldLabel("增幅类型", true)}
              <select data-stat-key>${selectOptions(statOptions, selectedStat)}</select>
            </label>
            <label class="field">
              ${fieldLabel(`数值${PERCENT_INPUT_STATS.has(selectedStat) ? "（15 表示 15%）" : ""}`, true)}
              <input data-stat-value type="number" step="0.01" value="${escapeHtml(percentInputValue(selectedStat, Number(stat.value ?? 0)))}">
            </label>
            <label class="field"${simple || isEventModifier || targetKind === "skill" ? " hidden" : ""}>
              ${fieldLabel("计算方式", true)}
              <select data-stat-mode>
                ${selectOptions([["flat", "直接加到面板"], ["pct", "按基准换算"]], stat.mode ?? modeForStat(selectedStat))}
              </select>
            </label>
            <label class="field"${simple || isEventModifier || targetKind === "skill" ? " hidden" : ""}>
              <span>基准</span>
              <select data-stat-basis>${selectOptions(BASIS_OPTIONS, stat.basis ?? "")}</select>
            </label>
            <div class="field stat-skill-target-modifier-only"${targetKind === "skill" ? "" : " hidden"}>
              <span>技能目标</span>
              ${skillTargetsHtml(stat.target?.skillTargets ?? [])}
            </div>
            <button type="button" class="compact-btn maintenance-remove-stat" data-remove-stat="${index}">删除</button>
        `
        container.appendChild(row)
    })
}

function readStatRows(containerId) {
    const container = document.getElementById(containerId)
    if (!container) {
        return []
    }

    return [...container.querySelectorAll(".maintenance-stat-row")]
        .map((row, index) => {
            const targetKind = row.querySelector("[data-stat-target-kind]")?.value === "skill" ? "skill" : "default"
            const target = targetKind === "skill"
                ? { kind: "skill", skillTargets: readSkillTargets(row) }
                : { kind: "default" }
            const stat = storedBuffStat(row.querySelector("[data-stat-key]")?.value)
            const value = inputToStoredValue(stat, row.querySelector("[data-stat-value]")?.value)
            if (container.dataset.allowDamageModifiers === "true" && (targetKind === "skill" || isEventModifierStat(stat))) {
                return eventModifierRuleFromStatRow(stat, value, index, target)
            }

            const mode = row.querySelector("[data-stat-mode]")?.value || modeForStat(stat)
            const basis = row.querySelector("[data-stat-basis]")?.value || null
            return {
                stat,
                value,
                mode,
                target,
                ...(basis ? { basis } : {}),
            }
        })
        .filter(item => item && item.stat && Number.isFinite(item.value))
}

function statRowsToFixedEffects(stats = []) {
    return stats.map((stat, index) => {
        if (stat.type === "damageModifier") {
            return {
                id: stat.id ?? `effect-${index + 1}`,
                type: "damageModifier",
                kind: stat.kind,
                value: stat.value,
                ...(stat.valueUnit ? { valueUnit: stat.valueUnit } : {}),
                ...(stat.appliesTo ? { appliesTo: stat.appliesTo } : {}),
                ...(stat.label ? { label: stat.label } : {}),
            }
        }

        return {
            id: stat.id ?? `effect-${index + 1}`,
            type: "fixed",
            stat: stat.stat,
            value: stat.value,
            mode: stat.mode ?? "flat",
            target: stat.target ?? { kind: "default" },
            ...(stat.basis ? { basis: stat.basis } : {}),
            ...(stat.label ? { label: stat.label } : {}),
        }
    })
}

function hasBuffRuleValue(item = {}) {
    if (item.type === "derived") {
        return item.ratio !== 0
    }
    if (item.type === "formula") {
        return String(item.formula?.expression ?? "").trim()
    }
    return Number(item.value ?? item.valuePerStack ?? 0) !== 0
}

function statBlock(title, containerId, stats = [], options = {}) {
    const simple = options.simple ? "true" : "false"
    const descriptionInput = options.descriptionId ? `
          <label class="field">
            <span>Buff 描述</span>
            <textarea id="${escapeHtml(options.descriptionId)}">${escapeHtml(localized(options.description) ?? "")}</textarea>
          </label>
    ` : ""
    return `
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="compact-btn" data-add-stat="${escapeHtml(containerId)}">添加增幅</button>
          </div>
          ${descriptionInput}
          <div id="${escapeHtml(containerId)}" class="maintenance-stat-rows" data-simple="${simple}" data-allow-damage-modifiers="true"></div>
          <p class="form-help">百分比属性直接填写百分比数字，例如 15 表示 15%。</p>
        </section>
    `
}

function cinemaBuffStatContainerId(index) {
    return `cinemaBuffStats${index}`
}

function cinemaBuffsOf(agent = {}) {
    return Array.isArray(agent.combatBuffs?.cinemaBuffs)
        ? agent.combatBuffs.cinemaBuffs
        : []
}

function cinemaBuffDraft(level = 1) {
    return {
        cinemaLevel: level,
        cinemaName: { zhCN: "" },
        description: { zhCN: "" },
        scope: "inCombat",
        defaultChecked: false,
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
        effects: [],
    }
}

function cinemaBuffCard(buff = {}, index = 0) {
    const containerId = cinemaBuffStatContainerId(index)
    return `
        <article class="maintenance-subcard cinema-buff-card" data-cinema-buff-row>
          <div class="maintenance-section-head">
            <h4>影画 Buff ${index + 1}</h4>
            <button type="button" class="compact-btn danger-lite" data-remove-cinema-buff="${index}">删除影画</button>
          </div>
          <div class="maintenance-grid">
            <label class="field">
              ${fieldLabel("第几个影画", true)}
              <select data-cinema-level>${selectOptions([[1, "影画 1"], [2, "影画 2"], [3, "影画 3"], [4, "影画 4"], [5, "影画 5"], [6, "影画 6"]], buff.cinemaLevel ?? 1)}</select>
            </label>
            <label class="field">
              ${fieldLabel("影画名称", true)}
              <input data-cinema-name value="${escapeHtml(localized(buff.cinemaName) ?? "")}">
            </label>
            <label class="field cinema-description-field">
              ${fieldLabel("Buff 描述", true)}
              <textarea data-cinema-description>${escapeHtml(localized(buff.description) ?? "")}</textarea>
            </label>
          </div>
          <div class="maintenance-section-head">
            <h4>增幅规则</h4>
            <button type="button" class="compact-btn" data-add-stat="${escapeHtml(containerId)}">添加增幅</button>
          </div>
          <div id="${escapeHtml(containerId)}" class="maintenance-stat-rows" data-allow-damage-modifiers="true"></div>
          <p class="form-help">影画 Buff 默认不勾选；百分比属性直接填写百分比数字，例如 15 表示 15%。</p>
        </article>
    `
}

function renderCinemaBuffRows(cinemaBuffs = []) {
    const container = document.getElementById("cinemaBuffRows")
    if (!container) {
        return
    }

    container.innerHTML = cinemaBuffs.map(cinemaBuffCard).join("")
    cinemaBuffs.forEach((buff, index) => {
        renderStatRows(cinemaBuffStatContainerId(index), effectStats(buff), { allowDamageModifiers: true })
    })
}

function readCinemaBuffRows() {
    return [...els.maintenanceForm.querySelectorAll("[data-cinema-buff-row]")]
        .map((row, index) => {
            const stats = readStatRows(cinemaBuffStatContainerId(index)).filter(item => item.value !== 0)
            return {
                cinemaLevel: Number(row.querySelector("[data-cinema-level]")?.value ?? 1),
                cinemaName: { zhCN: row.querySelector("[data-cinema-name]")?.value.trim() ?? "" },
                description: { zhCN: row.querySelector("[data-cinema-description]")?.value.trim() ?? "" },
                scope: "inCombat",
                defaultChecked: false,
                coverage: { default: 1, min: 0, max: 1, step: 0.1 },
                effects: statRowsToFixedEffects(stats),
            }
        })
}

function sourceFields(item = {}) {
    return `
        <label class="field">
          <span>图片路径</span>
          <input id="imagePath" value="${escapeHtml(item.images?.portrait ?? item.images?.icon ?? "")}" placeholder="/assets/...">
        </label>
        <label class="field">
          <span>资料来源</span>
          <input id="sourceUrl" value="${escapeHtml(item.sources?.[0] ?? item.images?.source ?? "")}" placeholder="https://...">
        </label>
    `
}

function displayToggleField(item = {}) {
    return `
        <div class="field">
          <span>首页/优化器显示</span>
          <label class="maintenance-inline-checkbox">
            <input id="displayInUi" type="checkbox"${item.hidden === true ? "" : " checked"}>
            <span>显示在首页与优化器</span>
          </label>
        </div>
    `
}

function applyDisplayVisibility(item = {}) {
    const next = { ...item }
    if (document.getElementById("displayInUi")?.checked === false) {
        next.hidden = true
    } else {
        delete next.hidden
    }
    return next
}

function renderAgentForm(item = null) {
    const agent = item ?? {
        id: `new_agent_${++draftCounter}`,
        name: { zhCN: "新角色" },
        rarity: "S",
        attribute: "physical",
        specialty: "attack",
        faction: "",
        level60: DEFAULT_LEVEL_60,
        combatBuffs: { corePassive: null, additionalAbility: null, cinemaBuffs: [] },
    }
    els.editorTitle.textContent = "角色资料"
    els.editorTag.textContent = agent.id || "草稿"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>基础信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("ID", true)}<input id="recordId" value="${escapeHtml(agent.id)}" required></label>
            ${localizedZhInput("name", agent.name)}
            <label class="field">${fieldLabel("稀有度", true)}<select id="rarity">${selectOptions([["S", "S"], ["A", "A"], ["B", "B"]], agent.rarity)}</select></label>
            <label class="field">${fieldLabel("属性", true)}<select id="attribute">${selectOptions(ATTRIBUTE_OPTIONS, agent.attribute)}</select></label>
            <label class="field"><span>伤害结算属性</span><select id="damageElement"><option value="">同角色属性</option>${selectOptions(DAMAGE_ELEMENT_OPTIONS, agent.damageElement)}</select></label>
            <label class="field">${fieldLabel("特性", true)}<select id="specialty">${selectOptions(SPECIALTY_OPTIONS, agent.specialty)}</select></label>
            <label class="field"><span>阵营</span><input id="faction" value="${escapeHtml(agent.faction ?? "")}"></label>
            ${displayToggleField(agent)}
            ${sourceFields(agent)}
          </div>
        </section>

        <section class="maintenance-section">
          <h3>60 级面板</h3>
          <div class="maintenance-grid stat-number-grid">
            ${Object.entries(DEFAULT_LEVEL_60).map(([key, fallback]) => `
              <label class="field">
                ${fieldLabel(`${levelStatLabel(key)}${isLevelPercentStat(key) ? "（15 表示 15%）" : ""}`, true)}
                <input data-level-stat="${escapeHtml(key)}" type="number" step="0.01" value="${escapeHtml(percentInputValue(key, Number(agent.level60?.[key] ?? fallback)))}">
              </label>
            `).join("")}
          </div>
        </section>

        <section class="maintenance-section">
          <h3>优先驱动盘</h3>
          <div class="maintenance-grid preferred-drive-disc-grid">
            <label class="field preferred-drive-disc-default-field">
              <span>默认驱动盘套装</span>
              <select id="preferredDriveDiscDefaultSet">
                <option value="">不指定</option>
                ${driveDiscSetOptions(preferredDriveDiscDefaultSetId(agent))}
              </select>
            </label>
            ${[4, 5, 6].map(slot => `
              <div class="field preferred-drive-disc-field">
                <div class="field-row-head">
                  <span>${slot}号位主属性</span>
                  <button type="button" class="compact-btn" data-clear-preferred-main-stats="${slot}">清空</button>
                </div>
                <div class="main-stat-choice-list">
                  ${mainStatChoiceMarkup(slot, preferredMainStats(agent, slot))}
                </div>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>技能组定义</h3>
            <button type="button" class="compact-btn" data-add-default-calc-skill-group-definition>定义技能组</button>
          </div>
          <p class="form-help">定义“一变”“一大”等可复用技能组合；默认计算方式和用户自定义都可以把它当作一个事件加入。</p>
          <div id="defaultCalculationSkillGroupRows" class="skill-category-list"></div>
        </section>

        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>默认计算方式</h3>
            <div class="skill-maintenance-actions">
              <button type="button" class="compact-btn" data-add-default-calc-variant>添加影画循环</button>
            </div>
          </div>
          <p class="form-help">每个默认循环只选择一个影画；用户当前影画会自动使用不超过当前等级的最高已配置循环。</p>
          <div id="defaultCalculationVariantRows" class="skill-category-list"></div>
        </section>

        ${statBlock("核心被动 Buff", "corePassiveStats", effectStats(agent.combatBuffs?.corePassive), {
            descriptionId: "corePassiveDescription",
            description: agent.combatBuffs?.corePassive?.description,
        })}
        ${statBlock("额外能力 Buff", "additionalAbilityStats", effectStats(agent.combatBuffs?.additionalAbility), {
            descriptionId: "additionalAbilityDescription",
            description: agent.combatBuffs?.additionalAbility?.description,
        })}
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>影画 Buff</h3>
            <button type="button" class="compact-btn" data-add-cinema-buff>添加影画 Buff</button>
          </div>
          <div id="cinemaBuffRows" class="cinema-buff-rows"></div>
          <p class="form-help">只新增已经建模的影画，例如只填影画 1、4、6；不会自动补齐空影画。</p>
        </section>
        <section class="maintenance-section">
          <h3>核心技 JSON</h3>
          <label class="field">
            <span>用于 A-F 强化等复杂结构</span>
            <textarea id="coreSkillJson" spellcheck="false">${escapeHtml(agent.coreSkillDraft ?? (agent.coreSkill ? JSON.stringify(agent.coreSkill, null, 2) : ""))}</textarea>
          </label>
        </section>
    `
    renderStatRows("corePassiveStats", effectStats(agent.combatBuffs?.corePassive), { allowDamageModifiers: true })
    renderStatRows("additionalAbilityStats", effectStats(agent.combatBuffs?.additionalAbility), { allowDamageModifiers: true })
    renderDefaultCalculationSkillGroups(agent.skillGroups ?? agent.defaultCalculationConfig?.skillGroups ?? [])
    renderDefaultCalculationVariants(maintenanceDefaultCalculationVariants(agent.defaultCalculationConfig))
    renderCinemaBuffRows(cinemaBuffsOf(agent))
    updatePreview()
}

function readPreferredDriveDiscs() {
    const defaultSetId = document.getElementById("preferredDriveDiscDefaultSet")?.value.trim() ?? ""
    const mainStatLimits = {}
    for (const slot of [4, 5, 6]) {
        mainStatLimits[String(slot)] = [...els.maintenanceForm.querySelectorAll(`input[data-preferred-main-stat="${slot}"]:checked`)]
            .map(input => input.value)
            .filter(Boolean)
    }
    const hasMainStatLimits = Object.values(mainStatLimits).some(values => values.length)
    if (!defaultSetId && !hasMainStatLimits) {
        return null
    }
    return {
        ...(defaultSetId ? { defaultSetId } : {}),
        ...(hasMainStatLimits ? { mainStatLimits } : {}),
    }
}

function buildAgent(options = {}) {
    const level60 = {}
    for (const input of els.maintenanceForm.querySelectorAll("[data-level-stat]")) {
        level60[input.dataset.levelStat] = inputToStoredValue(input.dataset.levelStat, input.value)
    }

    const corePassiveStats = readStatRows("corePassiveStats").filter(item => item.value !== 0)
    const additionalAbilityStats = readStatRows("additionalAbilityStats").filter(item => item.value !== 0)
    const cinemaBuffs = readCinemaBuffRows()
    const corePassiveDescription = document.getElementById("corePassiveDescription")?.value.trim() ?? ""
    const additionalAbilityDescription = document.getElementById("additionalAbilityDescription")?.value.trim() ?? ""
    const coreSkillText = document.getElementById("coreSkillJson")?.value.trim()
    const item = {
        ...(selectedCleanRecord() ?? {}),
        id: document.getElementById("recordId").value.trim(),
        name: readLocalizedZh("name"),
        rarity: document.getElementById("rarity").value,
        attribute: document.getElementById("attribute").value,
        specialty: document.getElementById("specialty").value,
        faction: document.getElementById("faction").value.trim(),
        images: {
            portrait: document.getElementById("imagePath").value.trim(),
            source: document.getElementById("sourceUrl").value.trim(),
        },
        level60,
        combatBuffs: {
            corePassive: corePassiveStats.length || corePassiveDescription ? {
                scope: "inCombat",
                name: { zhCN: "核心被动" },
                description: { zhCN: corePassiveDescription },
                coverage: { default: 1, min: 0, max: 1, step: 0.1 },
                effects: statRowsToFixedEffects(corePassiveStats),
            } : null,
            additionalAbility: additionalAbilityStats.length || additionalAbilityDescription ? {
                scope: "inCombat",
                name: { zhCN: "额外能力" },
                description: { zhCN: additionalAbilityDescription },
                coverage: { default: 1, min: 0, max: 1, step: 0.1 },
                effects: statRowsToFixedEffects(additionalAbilityStats),
            } : null,
            cinemaBuffs,
        },
        sources: [document.getElementById("sourceUrl").value.trim()].filter(Boolean),
    }

    const damageElement = document.getElementById("damageElement").value
    if (damageElement) {
        item.damageElement = damageElement
    } else {
        delete item.damageElement
    }

    const preferredDriveDiscs = readPreferredDriveDiscs()
    if (preferredDriveDiscs) {
        item.preferredDriveDiscs = preferredDriveDiscs
    } else {
        delete item.preferredDriveDiscs
    }

    const skillGroups = readDefaultCalculationSkillGroups()
    if (skillGroups.length) {
        item.skillGroups = skillGroups
    } else {
        delete item.skillGroups
    }

    const defaultCalculationConfig = readDefaultCalculationConfig()
    if (defaultCalculationConfig) {
        item.defaultCalculationConfig = defaultCalculationConfig
    } else {
        delete item.defaultCalculationConfig
    }

    if (coreSkillText && options.allowInvalidCoreSkill) {
        try {
            item.coreSkill = JSON.parse(coreSkillText)
            delete item.coreSkillDraft
        } catch {
            delete item.coreSkill
            item.coreSkillDraft = coreSkillText
        }
    } else if (coreSkillText) {
        item.coreSkill = JSON.parse(coreSkillText)
        delete item.coreSkillDraft
    } else {
        delete item.coreSkill
        delete item.coreSkillDraft
    }

    return applyDisplayVisibility(item)
}

function skillCategoryDraft() {
    return {
        id: `category_${Date.now()}`,
        name: { zhCN: "新技能大类" },
        levelScale: SKILL_LEVEL_SCALE,
        levelRange: { min: 1, max: 16, default: 12 },
        moves: [],
    }
}

function skillMoveDraft() {
    return {
        id: `move_${Date.now()}`,
        name: { zhCN: "新招式" },
        damageElement: "physical",
        rows: [],
    }
}

function skillRowDraft(levelRange = { min: 1, max: 16 }) {
    const length = Array.isArray(levelRange.levels)
        ? Math.max(1, levelRange.levels.length)
        : Math.max(1, Number(levelRange.max ?? 16) - Number(levelRange.min ?? 1) + 1)
    return {
        id: `row_${Date.now()}`,
        label: { zhCN: "伤害倍率" },
        kind: "damageMultiplier",
        values: Array.from({ length }, () => ""),
    }
}

function skillLevelRangeOf(category = {}) {
    const raw = category.levelRange ?? {}
    if (isCoreSkillLevelScale(category)) {
        const levels = Array.isArray(raw.levels) && raw.levels.length
            ? raw.levels.map(level => String(level ?? "").trim()).filter(Boolean)
            : CORE_SKILL_LEVELS
        const defaultLevel = levels.includes(String(raw.default ?? ""))
            ? String(raw.default)
            : levels.includes("F")
                ? "F"
                : levels.at(-1) ?? "0"
        return {
            levels,
            default: defaultLevel,
        }
    }

    let min = Number(raw.min ?? 1)
    let max = Number(raw.max ?? 16)
    let defaultLevel = Number(raw.default ?? min)
    if (!Number.isInteger(min) || min < 1) {
        min = 1
    }
    if (!Number.isInteger(max) || max < min) {
        max = min
    }
    if (!Number.isInteger(defaultLevel) || defaultLevel < min || defaultLevel > max) {
        defaultLevel = min
    }
    return { min, max, default: defaultLevel }
}

function skillLevelsForCategory(category = {}) {
    const range = skillLevelRangeOf(category)
    if (Array.isArray(range.levels)) {
        return range.levels
    }
    const levels = []
    for (let level = range.min; level <= range.max; level += 1) {
        levels.push(level)
    }
    return levels
}

function skillValueForLevel(row = {}, category = {}, level) {
    const range = skillLevelRangeOf(category)
    const index = Array.isArray(range.levels)
        ? range.levels.indexOf(String(level ?? ""))
        : Number(level) - range.min
    return row.values?.[index] ?? ""
}

function renderSkillMultiplierTable(category = {}, move = {}) {
    const levels = skillLevelsForCategory(category)
    const rows = Array.isArray(move.rows) ? move.rows : []
    return `
        <div class="skill-table-wrap">
          <table class="skill-multiplier-table">
            <thead>
              <tr>
                <th>倍率行 ID</th>
                <th>行名</th>
                <th>类型</th>
                <th>伤害基准</th>
                ${levels.map(level => `<th>${escapeHtml(isCoreSkillLevelScale(category) ? level : `LV${level}`)}</th>`).join("")}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, rowIndex) => `
                <tr data-skill-row-row>
                  <td><input data-skill-row-id value="${escapeHtml(row.id ?? "")}" placeholder="hit_1"></td>
                  <td><input data-skill-row-label value="${escapeHtml(localized(row.label) || "")}" placeholder="一段伤害倍率"></td>
                  <td><select data-skill-row-kind>${selectOptions(SKILL_ROW_KIND_OPTIONS, row.kind ?? "damageMultiplier")}</select></td>
                  <td><select data-skill-row-damage-basis>${selectOptions(SKILL_ROW_DAMAGE_BASIS_OPTIONS, row.damageBasis ?? "")}</select></td>
                  ${levels.map(level => `
                    <td>
                      <input data-skill-value data-skill-level="${level}" type="number" step="0.01" value="${escapeHtml(skillValueForLevel(row, category, level))}">
                    </td>
                  `).join("")}
                  <td><button type="button" class="compact-btn danger-lite" data-remove-skill-row="${rowIndex}">删除</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
    `
}

function renderSkillMoveCard(category = {}, move = {}, moveIndex = 0) {
    return `
        <article class="maintenance-subcard skill-move-card" data-skill-move-row>
          <div class="maintenance-section-head">
            <h4>${escapeHtml(localized(move.name) || `招式 ${moveIndex + 1}`)}</h4>
            <div class="skill-maintenance-actions">
              <button type="button" class="compact-btn" data-add-skill-row>添加倍率行</button>
              <button type="button" class="compact-btn danger-lite" data-remove-skill-move="${moveIndex}">删除招式</button>
            </div>
          </div>
          <div class="maintenance-grid skill-move-grid">
            <label class="field">${fieldLabel("招式 ID", true)}<input data-skill-move-id value="${escapeHtml(move.id ?? "")}" placeholder="quick_sword"></label>
            <label class="field">${fieldLabel("招式名", true)}<input data-skill-move-name value="${escapeHtml(localized(move.name) || "")}" placeholder="普通攻击：快剑"></label>
            <label class="field"><span>伤害属性</span><select data-skill-move-damage-element>${selectOptions(DAMAGE_ELEMENT_OPTIONS, move.damageElement ?? "physical")}</select></label>
          </div>
          ${renderSkillMultiplierTable(category, move)}
        </article>
    `
}

function renderSkillCategoryCard(category = {}, categoryIndex = 0) {
    const range = skillLevelRangeOf(category)
    const levelScale = isCoreSkillLevelScale(category) ? CORE_SKILL_LEVEL_SCALE : SKILL_LEVEL_SCALE
    return `
        <details class="maintenance-subcard skill-category-card" data-skill-category-row open>
          <summary>
            <span>${escapeHtml(localized(category.name) || `技能大类 ${categoryIndex + 1}`)}</span>
            <small>${escapeHtml(category.id ?? "")}</small>
          </summary>
          <div class="maintenance-section-head skill-category-toolbar">
            <h4>技能大类</h4>
            <div class="skill-maintenance-actions">
              <button type="button" class="compact-btn" data-add-skill-move>添加招式</button>
              <button type="button" class="compact-btn danger-lite" data-remove-skill-category="${categoryIndex}">删除大类</button>
            </div>
          </div>
          <div class="maintenance-grid skill-category-grid">
            <label class="field">${fieldLabel("大类 ID", true)}<input data-skill-category-id value="${escapeHtml(category.id ?? "")}" placeholder="basic"></label>
            <label class="field">${fieldLabel("大类名", true)}<input data-skill-category-name value="${escapeHtml(localized(category.name) || "")}" placeholder="普通攻击"></label>
            <label class="field">${fieldLabel("等级模式", true)}<select data-skill-level-scale>${selectOptions(SKILL_LEVEL_SCALE_OPTIONS, levelScale)}</select></label>
            <label class="field skill-level-skill-only"${levelScale === SKILL_LEVEL_SCALE ? "" : " hidden"}>${fieldLabel("最低等级", true)}<input data-skill-level-min type="number" min="1" step="1" value="${escapeHtml(range.min ?? 1)}"></label>
            <label class="field skill-level-skill-only"${levelScale === SKILL_LEVEL_SCALE ? "" : " hidden"}>${fieldLabel("最高等级", true)}<input data-skill-level-max type="number" min="1" step="1" value="${escapeHtml(range.max ?? 16)}"></label>
            <label class="field skill-level-skill-only"${levelScale === SKILL_LEVEL_SCALE ? "" : " hidden"}>${fieldLabel("默认等级", true)}<input data-skill-level-default type="number" min="1" step="1" value="${escapeHtml(range.default ?? 1)}"></label>
            <label class="field skill-level-core-only"${levelScale === CORE_SKILL_LEVEL_SCALE ? "" : " hidden"}><span>核心技等级</span><input value="${escapeHtml(CORE_SKILL_LEVELS.join(" / "))}" disabled></label>
            <label class="field skill-level-core-only"${levelScale === CORE_SKILL_LEVEL_SCALE ? "" : " hidden"}>${fieldLabel("默认核心等级", true)}<select data-skill-core-default>${selectOptions(CORE_SKILL_LEVELS.map(level => [level, level]), range.default ?? "F")}</select></label>
          </div>
          <div class="skill-move-list">
            ${(category.moves ?? []).map((move, moveIndex) => renderSkillMoveCard(category, move, moveIndex)).join("")}
          </div>
        </details>
    `
}

function renderSkillCategoryRows(categories = []) {
    const container = document.getElementById("agentSkillCategoryRows")
    if (!container) {
        return
    }
    container.innerHTML = categories.map(renderSkillCategoryCard).join("")
}

function readSkillRow(rowElement, categoryRange) {
    const values = []
    const levels = Array.isArray(categoryRange.levels)
        ? categoryRange.levels
        : Array.from(
            { length: Math.max(0, Number(categoryRange.max ?? 1) - Number(categoryRange.min ?? 1) + 1) },
            (_, index) => Number(categoryRange.min ?? 1) + index,
        )
    for (const level of levels) {
        const input = rowElement.querySelector(`[data-skill-value][data-skill-level="${level}"]`)
        const raw = input?.value ?? ""
        values.push(raw === "" ? "" : numberValue(raw))
    }
    const damageBasis = rowElement.querySelector("[data-skill-row-damage-basis]")?.value || ""
    return {
        id: rowElement.querySelector("[data-skill-row-id]")?.value.trim() ?? "",
        label: { zhCN: rowElement.querySelector("[data-skill-row-label]")?.value.trim() ?? "" },
        kind: rowElement.querySelector("[data-skill-row-kind]")?.value || "damageMultiplier",
        ...(damageBasis ? { damageBasis } : {}),
        values,
    }
}

function readSkillMove(moveElement, categoryRange) {
    return {
        id: moveElement.querySelector("[data-skill-move-id]")?.value.trim() ?? "",
        name: { zhCN: moveElement.querySelector("[data-skill-move-name]")?.value.trim() ?? "" },
        damageElement: moveElement.querySelector("[data-skill-move-damage-element]")?.value || "physical",
        rows: [...moveElement.querySelectorAll("[data-skill-row-row]")]
            .map(row => readSkillRow(row, categoryRange)),
    }
}

function readSkillCategory(categoryElement) {
    const levelScale = categoryElement.querySelector("[data-skill-level-scale]")?.value === CORE_SKILL_LEVEL_SCALE
        ? CORE_SKILL_LEVEL_SCALE
        : SKILL_LEVEL_SCALE
    const min = numberValue(categoryElement.querySelector("[data-skill-level-min]")?.value, 1)
    const max = numberValue(categoryElement.querySelector("[data-skill-level-max]")?.value, min)
    const defaultLevel = numberValue(categoryElement.querySelector("[data-skill-level-default]")?.value, min)
    const defaultCoreLevel = categoryElement.querySelector("[data-skill-core-default]")?.value || "F"
    const category = {
        id: categoryElement.querySelector("[data-skill-category-id]")?.value.trim() ?? "",
        name: { zhCN: categoryElement.querySelector("[data-skill-category-name]")?.value.trim() ?? "" },
        ...(levelScale === CORE_SKILL_LEVEL_SCALE ? { levelScale } : {}),
        levelRange: levelScale === CORE_SKILL_LEVEL_SCALE
            ? {
                levels: [...CORE_SKILL_LEVELS],
                default: CORE_SKILL_LEVELS.includes(defaultCoreLevel) ? defaultCoreLevel : "F",
            }
            : {
                min,
                max,
                default: defaultLevel,
            },
        moves: [],
    }
    const range = skillLevelRangeOf(category)
    category.moves = [...categoryElement.querySelectorAll("[data-skill-move-row]")]
        .map(move => readSkillMove(move, range))
    return category
}

function readSkillCategories() {
    return [...els.maintenanceForm.querySelectorAll("[data-skill-category-row]")]
        .map(readSkillCategory)
}

function rerenderSkillCategories(categories = readSkillCategories()) {
    renderSkillCategoryRows(categories)
}

function renderAgentSkillForm(item = null) {
    const agentSkill = item ?? blankDraftItem("agentSkills")
    const agentOptions = (catalog?.meta?.agents ?? []).map(agent => [agent.id, nameOf(agent)])
    els.editorTitle.textContent = "技能倍率"
    els.editorTag.textContent = agentSkill.id || agentSkill.agentId || "草稿"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>基础信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("ID", true)}<input id="recordId" value="${escapeHtml(agentSkill.id ?? "")}" required></label>
            ${localizedZhInput("name", agentSkill.name ?? { zhCN: "" }, "资料名")}
            <label class="field">${fieldLabel("关联角色", true)}<select id="agentSkillAgentId">${selectOptions(agentOptions, agentSkill.agentId ?? agentOptions[0]?.[0] ?? "")}</select></label>
            <label class="field">
              <span>资料来源</span>
              <input id="sourceUrl" value="${escapeHtml(agentSkill.sources?.[0] ?? "")}" placeholder="https://...">
            </label>
          </div>
        </section>
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>技能分类与倍率</h3>
            <button type="button" class="compact-btn" data-add-skill-category>添加大类</button>
          </div>
          <div id="agentSkillCategoryRows" class="skill-category-list"></div>
        </section>
    `
    renderSkillCategoryRows(agentSkill.categories ?? [])
    updatePreview()
}

function buildAgentSkill() {
    const sourceUrl = document.getElementById("sourceUrl")?.value.trim() ?? ""
    return {
        ...(selectedCleanRecord() ?? {}),
        id: document.getElementById("recordId").value.trim(),
        agentId: document.getElementById("agentSkillAgentId").value,
        name: readLocalizedZh("name"),
        categories: readSkillCategories(),
        sources: [sourceUrl].filter(Boolean),
    }
}

function renderWEngineForm(item = null) {
    const wEngine = item ?? {
        id: `new_w_engine_${++draftCounter}`,
        name: { zhCN: "新音擎" },
        rarity: "S",
        specialty: "attack",
        attribute: "physical",
        level60: { atkBase: 0, advancedStat: { stat: "critDmg", value: 0, mode: "flat" } },
        modification: DEFAULT_W_ENGINE_MODIFICATION,
        effect: { name: { zhCN: "音擎效果" }, selfBuff: { scope: "inCombat", effects: [] }, teamBuff: null },
    }
    const selfBuff = wEngine.effect?.selfBuff ?? wEngine.effect?.buff
    const teamBuff = wEngine.effect?.teamBuff
    const modification = wEngineModificationMetadata(wEngine)

    els.editorTitle.textContent = "音擎资料"
    els.editorTag.textContent = wEngine.id || "草稿"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>基础信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("ID", true)}<input id="recordId" value="${escapeHtml(wEngine.id)}" required></label>
            ${localizedZhInput("name", wEngine.name)}
            <label class="field">${fieldLabel("稀有度", true)}<select id="rarity">${selectOptions([["S", "S"], ["A", "A"], ["B", "B"]], wEngine.rarity)}</select></label>
            <label class="field">${fieldLabel("特性", true)}<select id="specialty">${selectOptions(SPECIALTY_OPTIONS, wEngine.specialty)}</select></label>
            <label class="field"><span>属性</span><select id="attribute"><option value="">无</option>${selectOptions(ATTRIBUTE_OPTIONS, wEngine.attribute)}</select></label>
            <label class="field"><span>关联角色</span><select id="relatedAgentId"><option value="">无</option>${selectOptions((catalog?.meta?.agents ?? []).map(agent => [agent.id, nameOf(agent)]), wEngine.relatedAgentId)}</select></label>
            ${displayToggleField(wEngine)}
            ${sourceFields(wEngine)}
            <label class="field">${fieldLabel("基础攻击力", true)}<input id="atkBase" type="number" step="1" value="${escapeHtml(wEngine.level60?.atkBase ?? 0)}"></label>
          </div>
        </section>

        ${statBlock("高级属性", "advancedStatRows", wEngine.level60?.advancedStat ? [wEngine.level60.advancedStat] : [], { simple: true })}

        <section class="maintenance-section">
          <h3>音擎效果文案 ${requiredLabel()}</h3>
          <div class="maintenance-grid">
            ${localizedZhInput("effectName", wEngine.effect?.name, "效果中文名")}
            <label class="field"><span>触发特性</span><select id="requirementSpecialty"><option value="">无</option>${selectOptions(SPECIALTY_OPTIONS, wEngine.effect?.requirement?.specialty ?? wEngine.specialty)}</select></label>
            <label class="field">${fieldLabel("中文说明", true)}<textarea id="effectDescriptionZh">${escapeHtml(wEngine.effect?.description?.zhCN ?? "")}</textarea></label>
            <label class="field"><span>英文说明</span><textarea id="effectDescriptionEn">${escapeHtml(wEngine.effect?.description?.en ?? "")}</textarea></label>
          </div>
        </section>

        ${coverageBlock("wEngineSelfBuff", selfBuff?.coverage)}
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>音擎 Buff（限佩戴者）规则</h3>
            <button type="button" class="compact-btn" data-add-effect-rule="wEngineSelfBuffRules">添加规则</button>
          </div>
          <div id="wEngineSelfBuffRules" class="maintenance-buff-effect-rows"></div>
        </section>

        ${coverageBlock("wEngineTeamBuff", teamBuff?.coverage)}
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>音擎 Buff（团队）规则</h3>
            <button type="button" class="compact-btn" data-add-effect-rule="wEngineTeamBuffRules">添加规则</button>
          </div>
          <div id="wEngineTeamBuffRules" class="maintenance-buff-effect-rows"></div>
        </section>

        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>改装等级与效果预览</h3>
          </div>
          <div class="maintenance-grid">
            <label class="field"><span>最小等级</span><input value="${escapeHtml(modification.minLevel)}" readonly></label>
            <label class="field"><span>最大等级</span><input value="${escapeHtml(modification.maxLevel)}" readonly></label>
            <label class="field"><span>默认等级</span><input value="${escapeHtml(modification.defaultLevel)}" readonly></label>
            <label class="field">
              <span>预览等级</span>
              <select id="wEngineModificationPreviewLevel">${selectOptions(
        Array.from({ length: modification.maxLevel - modification.minLevel + 1 }, (_, index) => {
            const level = modification.minLevel + index
            return [String(level), `${level}级`]
        }),
        String(modification.defaultLevel),
    )}</select>
            </label>
          </div>
          <div id="wEngineModificationPreview" class="maintenance-modification-preview"></div>
        </section>
    `
    renderStatRows("advancedStatRows", wEngine.level60?.advancedStat ? [wEngine.level60.advancedStat] : [], { simple: true })
    renderEffectRuleRows("wEngineSelfBuffRules", effectRules(selfBuff))
    renderEffectRuleRows("wEngineTeamBuffRules", effectRules(teamBuff))
    updatePreview()
}

function buildWEngine() {
    const advancedStats = readStatRows("advancedStatRows").filter(item => item.stat)
    const selfBuffRules = readEffectRuleRows("wEngineSelfBuffRules").filter(hasBuffRuleValue)
    const teamBuffRules = readEffectRuleRows("wEngineTeamBuffRules").filter(hasBuffRuleValue)
    return applyDisplayVisibility({
        ...(selectedCleanRecord() ?? {}),
        id: document.getElementById("recordId").value.trim(),
        name: readLocalizedZh("name"),
        rarity: document.getElementById("rarity").value,
        specialty: document.getElementById("specialty").value,
        attribute: document.getElementById("attribute").value || undefined,
        relatedAgentId: document.getElementById("relatedAgentId").value || undefined,
        images: {
            icon: document.getElementById("imagePath").value.trim(),
            source: document.getElementById("sourceUrl").value.trim(),
        },
        level60: {
            atkBase: numberValue(document.getElementById("atkBase").value),
            advancedStat: advancedStats[0] ?? null,
        },
        modification: DEFAULT_W_ENGINE_MODIFICATION,
        effect: {
            name: readLocalizedZh("effectName"),
            requirement: document.getElementById("requirementSpecialty").value ? {
                specialty: document.getElementById("requirementSpecialty").value,
                label: {
                    zhCN: `对于【${document.getElementById("requirementSpecialty").selectedOptions[0].textContent}】角色，能够触发以下效果`,
                    en: "For matching specialty characters, the following effect can be triggered.",
                },
            } : null,
            description: {
                zhCN: document.getElementById("effectDescriptionZh").value.trim(),
                en: document.getElementById("effectDescriptionEn").value.trim(),
            },
            selfBuff: selfBuffRules.length ? {
                scope: "inCombat",
                ...(readCoverageConfig("wEngineSelfBuff") ? { coverage: readCoverageConfig("wEngineSelfBuff") } : {}),
                effects: selfBuffRules,
                appliesToOutOfCombatPanel: false,
            } : null,
            teamBuff: teamBuffRules.length ? {
                scope: "inCombat",
                ...(readCoverageConfig("wEngineTeamBuff") ? { coverage: readCoverageConfig("wEngineTeamBuff") } : {}),
                effects: teamBuffRules,
                appliesToOutOfCombatPanel: false,
            } : null,
        },
        sources: [document.getElementById("sourceUrl").value.trim()].filter(Boolean),
    })
}

function renderWEngineModificationPreview(wEngine = null, error = "") {
    const container = document.getElementById("wEngineModificationPreview")
    if (!container) {
        return
    }

    if (error) {
        container.innerHTML = `<p class="form-help">${escapeHtml(error)}</p>`
        return
    }

    const previewLevel = numberValue(document.getElementById("wEngineModificationPreviewLevel")?.value, DEFAULT_W_ENGINE_MODIFICATION.defaultLevel)
    const materializedWEngine = materializeWEngineForModificationLevel(wEngine, previewLevel)
    const selfBuff = materializedWEngine?.effect?.selfBuff ?? materializedWEngine?.effect?.buff ?? null
    const teamBuff = materializedWEngine?.effect?.teamBuff ?? null
    const rows = [
        ["限佩戴者", selfBuff],
        ["团队", teamBuff],
    ].map(([label, buff]) => {
        const text = storedEffectRulesText(buff, defaultRuntimeForBuff(buff), catalog?.meta)
        return text ? { label, text } : null
    }).filter(Boolean)

    if (!rows.length) {
        container.innerHTML = `<p class="form-help">当前等级没有可预览的固定/叠层 Buff 规则。</p>`
        return
    }

    container.innerHTML = rows.map(row => `
        <div class="maintenance-preview-row">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.text)}</span>
        </div>
    `).join("")
}

function driveDiscLegacyFourPieceBuff(fourPiece) {
    if (!fourPiece || fourPiece.selfBuff || !effectRules(fourPiece).length) {
        return null
    }

    return {
        condition: fourPiece.condition ?? "",
        durationSeconds: fourPiece.durationSeconds ?? "",
        cooldownSeconds: fourPiece.cooldownSeconds ?? "",
        ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
        effects: effectRules(fourPiece),
    }
}

function driveDiscFourPieceSelfBuff(fourPiece) {
    return fourPiece?.selfBuff ?? driveDiscLegacyFourPieceBuff(fourPiece)
}

function driveDiscFourPieceTeamBuff(fourPiece) {
    return fourPiece?.teamBuff ?? null
}

function driveDiscBuffRuleSection(prefix, title, effect = {}) {
    return `
        ${coverageBlock(prefix, effect?.coverage)}
        <section class="maintenance-section">
          <h3>${escapeHtml(title)}</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("触发标识")}<input id="${prefix}Condition" value="${escapeHtml(effect?.condition ?? "")}"></label>
            <label class="field">${fieldLabel("持续秒数")}<input id="${prefix}Duration" type="number" step="0.1" value="${escapeHtml(effect?.durationSeconds ?? "")}"></label>
          </div>
          <div class="maintenance-section-head">
            <h3>${escapeHtml(title)}规则</h3>
            <button type="button" class="compact-btn" data-add-effect-rule="${escapeHtml(prefix)}Rules">添加规则</button>
          </div>
          <div id="${escapeHtml(prefix)}Rules" class="maintenance-buff-effect-rows"></div>
        </section>
    `
}

function effectSection(prefix, title, effect = {}, options = {}) {
    const isTwoPiece = options.kind === "twoPiece"
    const isFourPiece = options.kind === "fourPiece"
    if (isFourPiece) {
        return `
            <section class="maintenance-section">
              <h3>${escapeHtml(title)}效果文案</h3>
              <div class="maintenance-grid">
                <label class="field">${fieldLabel("4件套效果（中文）")}<textarea id="${prefix}EffectTextZh">${escapeHtml(effect?.effectText?.zhCN ?? "")}</textarea></label>
                <label class="field"><span>4件套效果（英文）</span><textarea id="${prefix}EffectTextEn">${escapeHtml(effect?.effectText?.en ?? "")}</textarea></label>
              </div>
            </section>
            ${driveDiscBuffRuleSection(`${prefix}Self`, `${title} Buff（限佩戴者）`, driveDiscFourPieceSelfBuff(effect))}
            ${driveDiscBuffRuleSection(`${prefix}Team`, `${title} Buff（团队）`, driveDiscFourPieceTeamBuff(effect))}
        `
    }

    return `
        <section class="maintenance-section">
          <h3>${escapeHtml(title)}</h3>
          <div class="maintenance-grid">
            ${isTwoPiece ? "" : `<label class="field">${fieldLabel("触发标识")}<input id="${prefix}Condition" value="${escapeHtml(effect.condition ?? "")}"></label>`}
            ${isTwoPiece ? "" : `<label class="field">${fieldLabel("持续秒数")}<input id="${prefix}Duration" type="number" step="0.1" value="${escapeHtml(effect.durationSeconds ?? "")}"></label>`}
          </div>
          ${statBlock(`${title}增幅`, `${prefix}Stats`, effectStats(effect), { simple: true })}
        </section>
    `
}

function renderDriveDiscSetForm(item = null) {
    const set = item ?? {
        id: `new_drive_disc_set_${++draftCounter}`,
        name: { zhCN: "新驱动盘套装" },
        images: { icon: "", source: "" },
        twoPiece: { effects: [] },
        fourPiece: { condition: "", effects: [], effectText: { zhCN: "", en: "" } },
    }

    els.editorTitle.textContent = "驱动盘资料"
    els.editorTag.textContent = set.id || "草稿"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>基础信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("ID", true)}<input id="recordId" value="${escapeHtml(set.id)}" required></label>
            ${localizedZhInput("name", set.name)}
            ${displayToggleField(set)}
            ${sourceFields(set)}
          </div>
        </section>
        ${effectSection("twoPiece", "2 件套", set.twoPiece, { kind: "twoPiece" })}
        ${effectSection("fourPiece", "4 件套", set.fourPiece, { kind: "fourPiece" })}
    `
    renderStatRows("twoPieceStats", effectStats(set.twoPiece), { simple: true, allowDamageModifiers: true })
    renderEffectRuleRows("fourPieceSelfRules", effectRules(driveDiscFourPieceSelfBuff(set.fourPiece)))
    renderEffectRuleRows("fourPieceTeamRules", effectRules(driveDiscFourPieceTeamBuff(set.fourPiece)))
    updatePreview()
}

function readDriveDiscBuffEffect(prefix) {
    const stats = readEffectRuleRows(`${prefix}Rules`).filter(hasBuffRuleValue)
    if (!stats.length) {
        return null
    }

    const effect = {
        scope: "inCombat",
        condition: document.getElementById(`${prefix}Condition`)?.value.trim() || null,
        effects: stats,
        appliesToOutOfCombatPanel: false,
    }
    const coverage = readCoverageConfig(prefix)
    if (coverage) {
        effect.coverage = coverage
    }

    const duration = numberValue(document.getElementById(`${prefix}Duration`)?.value, NaN)
    if (Number.isFinite(duration) && duration > 0) {
        effect.durationSeconds = duration
    }

    return effect
}

function readFourPieceEffect(prefix) {
    const effectTextZh = document.getElementById(`${prefix}EffectTextZh`)
    const effectTextEn = document.getElementById(`${prefix}EffectTextEn`)
    const selfBuff = readDriveDiscBuffEffect(`${prefix}Self`)
    const teamBuff = readDriveDiscBuffEffect(`${prefix}Team`)
    if (!selfBuff && !teamBuff && !effectTextZh?.value.trim()) {
        return undefined
    }

    return {
        effectText: {
            zhCN: effectTextZh?.value.trim() ?? "",
            en: effectTextEn?.value.trim() ?? "",
        },
        selfBuff,
        teamBuff,
    }
}

function readEffect(prefix) {
    const rulesContainer = document.getElementById(`${prefix}Rules`)
    const stats = rulesContainer
        ? readEffectRuleRows(`${prefix}Rules`).filter(hasBuffRuleValue)
        : readStatRows(`${prefix}Stats`).filter(item => item.value !== 0)
    const conditionInput = document.getElementById(`${prefix}Condition`)
    const effectTextZh = document.getElementById(`${prefix}EffectTextZh`)
    const effectTextEn = document.getElementById(`${prefix}EffectTextEn`)
    if (!stats.length && !conditionInput?.value.trim() && !effectTextZh?.value.trim()) {
        return undefined
    }

    const effect = {
        ...(conditionInput ? { condition: conditionInput.value.trim() || null } : {}),
        effects: rulesContainer ? stats : statRowsToFixedEffects(stats),
    }
    const coverage = readCoverageConfig(prefix)
    if (coverage) {
        effect.coverage = coverage
    }
    if (effectTextZh || effectTextEn) {
        effect.effectText = {
            zhCN: effectTextZh?.value.trim() ?? "",
            en: effectTextEn?.value.trim() ?? "",
        }
    }

    const durationInput = document.getElementById(`${prefix}Duration`)
    const duration = numberValue(durationInput?.value, NaN)
    if (Number.isFinite(duration) && duration > 0) {
        effect.durationSeconds = duration
    }

    return effect
}

function buildDriveDiscSet() {
    return applyDisplayVisibility({
        ...(selectedCleanRecord() ?? {}),
        id: document.getElementById("recordId").value.trim(),
        name: readLocalizedZh("name"),
        images: {
            icon: document.getElementById("imagePath").value.trim(),
            source: document.getElementById("sourceUrl").value.trim(),
        },
        twoPiece: readEffect("twoPiece"),
        fourPiece: readFourPieceEffect("fourPiece"),
        sources: [document.getElementById("sourceUrl").value.trim()].filter(Boolean),
    })
}

function renderEffectRuleRows(containerId, effects = []) {
    const container = document.getElementById(containerId)
    if (!container) {
        return
    }

    const allowModificationValues = isWEngineEffectRuleContainer(containerId)
    const rows = effects.length ? effects : [{ type: "fixed", stat: "atkFlat", value: 0, mode: "flat" }]
    container.innerHTML = ""
    rows.map(effect => editableEffectRule(effect)).forEach((effect, index) => {
        const type = effect.type ?? "fixed"
        const targetKind = ruleTargetKind(effect)
        const statOptions = statOptionsForTargetKind(targetKind)
        const selectedStat = statOptions.some(([key]) => key === effect.stat) ? effect.stat : statOptions[0]?.[0] ?? "atkFlat"
        const shownValue = type === "stacked"
            ? effect.valuePerStack ?? effect.value ?? 0
            : effect.value ?? 0
        const modificationField = type === "stacked" ? "valuePerStack" : "value"
        const modificationValues = effect.modificationValues?.[modificationField] ?? null
        const modificationValuesHtml = allowModificationValues ? `
            <div class="maintenance-modification-values modification-values-only" data-has-modification-values="${modificationValues ? "true" : "false"}">
              <label class="field modification-display-values-field">
                <span>1-5级实际值</span>
                <input data-modification-values value="${escapeHtml(modificationValuesInput(modificationValues))}" placeholder="15/17.5/20/22/24">
              </label>
            </div>
        ` : ""
        const row = document.createElement("div")
        row.className = "maintenance-buff-effect-row"
        row.dataset.effectIndex = String(index)
        row.dataset.effectId = effect.id ?? ""
        row.innerHTML = `
            <label class="field">
              ${fieldLabel("计算类型", true)}
              <select data-effect-type>${selectOptions(BUFF_EFFECT_TYPE_OPTIONS, type)}</select>
            </label>
            <label class="field">
              ${fieldLabel("增幅对象", true)}
              <select data-effect-target-kind>${selectOptions([["default", "默认"], ["skill", "技能"]], targetKind)}</select>
            </label>
            <label class="field panel-rule-only">
              ${fieldLabel("增幅类型", true)}
              <select data-effect-stat>${selectOptions(statOptions, selectedStat)}</select>
            </label>
            <label class="field direct-value-only">
              ${fieldLabel(type === "stacked" ? "每层数值" : "数值", true)}
              <input data-effect-value type="number" step="0.01" value="${escapeHtml(shownValue)}">
            </label>
            <label class="field panel-rule-only">
              ${fieldLabel("计算方式", true)}
              <select data-effect-mode>${selectOptions([["flat", "直接加到面板"], ["pct", "按基准换算"]], effect.mode ?? modeForStat(effect.stat ?? "atkFlat"))}</select>
            </label>
            <label class="field panel-rule-only">
              <span>基准</span>
              <select data-effect-basis>${selectOptions(BASIS_OPTIONS, effect.basis ?? "")}</select>
            </label>
            <div class="field skill-target-modifier-only"${targetKind === "skill" ? "" : " hidden"}>
              <span>技能目标</span>
              ${skillTargetsHtml(effect.target?.skillTargets ?? [])}
            </div>
            <label class="field source-value-only">
              ${fieldLabel("来源数值名称", true)}
              <input data-effect-source-label value="${escapeHtml(localized(effect.source?.label ?? effect.sourceLabel) || "来源数值")}">
            </label>
            <label class="field source-value-only">
              ${fieldLabel("默认来源数值", true)}
              <input data-effect-default-source type="number" step="1" value="${escapeHtml(effect.source?.defaultValue ?? effect.defaultSourceValue ?? 0)}">
            </label>
            <label class="field derived-only">
              ${fieldLabel("转换比例%", true)}
              <input data-effect-ratio type="number" step="0.01" value="${escapeHtml(effect.ratio ?? 0)}">
            </label>
            <label class="field derived-only">
              <span>上限</span>
              <input data-effect-cap type="number" step="0.01" value="${escapeHtml(effect.cap ?? "")}">
            </label>
            <label class="field formula-only">
              <span>来源下限</span>
              <input data-effect-source-min type="number" step="1" value="${escapeHtml(effect.source?.min ?? "")}">
            </label>
            <label class="field formula-only">
              <span>来源上限</span>
              <input data-effect-source-max type="number" step="1" value="${escapeHtml(effect.source?.max ?? "")}">
            </label>
            <label class="field formula-only">
              ${fieldLabel("公式", true)}
              <input data-effect-formula-expression value="${escapeHtml(effect.formula?.expression ?? "")}" placeholder="clamp(floor((x - 15000) / 400) + 10, 10, 40)">
            </label>
            <label class="field stacked-only">
              ${fieldLabel("最大层数", true)}
              <input data-effect-max-stacks type="number" min="0" step="1" value="${escapeHtml(effect.maxStacks ?? 1)}">
            </label>
            <label class="field stacked-only">
              ${fieldLabel("默认层数", true)}
              <input data-effect-default-stacks type="number" min="0" step="1" value="${escapeHtml(effect.defaultStacks ?? effect.maxStacks ?? 1)}">
            </label>
            <label class="field stacked-only">
              <span>共享层数组 ID</span>
              <input data-effect-stack-group value="${escapeHtml(effect.stackGroup ?? "")}" placeholder="qingming_companion">
            </label>
            <label class="field stacked-only">
              <span>共享层数组显示名</span>
              <input data-effect-stack-label value="${escapeHtml(localized(effect.stackLabel) || "")}" placeholder="青溟同行层数">
            </label>
            <button type="button" class="compact-btn maintenance-remove-effect" data-remove-effect="${index}">删除</button>
            ${modificationValuesHtml}
        `
        container.appendChild(row)
        syncBuffEffectRow(row)
    })
}

function syncBuffEffectRow(row) {
    const type = row.querySelector("[data-effect-type]")?.value ?? "fixed"
    const stat = row.querySelector("[data-effect-stat]")?.value ?? "atkFlat"
    const targetKind = row.querySelector("[data-effect-target-kind]")?.value === "skill" ? "skill" : "default"
    const isEventModifier = isEventModifierStat(stat)
    for (const item of row.querySelectorAll(".panel-rule-only")) {
        item.hidden = false
    }
    for (const item of row.querySelectorAll(".panel-rule-only [data-effect-mode], .panel-rule-only [data-effect-basis]")) {
        item.closest(".field").hidden = targetKind === "skill" || isEventModifier
    }
    for (const item of row.querySelectorAll(".skill-target-modifier-only")) {
        item.hidden = targetKind !== "skill"
    }
    for (const item of row.querySelectorAll(".direct-value-only")) {
        item.hidden = type === "derived" || type === "formula"
    }
    for (const item of row.querySelectorAll(".source-value-only")) {
        item.hidden = type !== "derived" && type !== "formula"
    }
    for (const item of row.querySelectorAll(".derived-only")) {
        item.hidden = type !== "derived"
    }
    for (const item of row.querySelectorAll(".formula-only")) {
        item.hidden = type !== "formula"
    }
    for (const item of row.querySelectorAll(".stacked-only")) {
        item.hidden = type !== "stacked"
    }
    for (const item of row.querySelectorAll(".modification-values-only")) {
        item.hidden = type !== "fixed" && type !== "stacked"
    }
}

function readRuleModificationValues(row, type) {
    const valuesBlock = row.querySelector(".maintenance-modification-values")
    if (!valuesBlock || (type !== "fixed" && type !== "stacked")) {
        return {}
    }

    const valuesInput = valuesBlock.querySelector("[data-modification-values]")
    const hasExistingValues = valuesBlock.dataset.hasModificationValues === "true"
    const hasEditedValues = String(valuesInput?.value ?? "").trim() !== ""
    if (!hasExistingValues && !hasEditedValues) {
        return {}
    }

    const key = type === "stacked" ? "valuePerStack" : "value"
    return {
        modificationValues: {
            [key]: parseModificationValuesInput(valuesInput?.value),
        },
    }
}

function readEffectRuleRows(containerId) {
    return [...document.querySelectorAll(`#${containerId} .maintenance-buff-effect-row`)].map((row, index) => {
        const type = row.querySelector("[data-effect-type]")?.value ?? "fixed"
        const targetKind = row.querySelector("[data-effect-target-kind]")?.value === "skill" ? "skill" : "default"
        const target = targetKind === "skill"
            ? { kind: "skill", skillTargets: readSkillTargets(row) }
            : { kind: "default" }
        const commonBase = {
            ...(row.dataset.effectId ? { id: row.dataset.effectId } : {}),
            type,
            target,
        }

        const stat = storedBuffStat(row.querySelector("[data-effect-stat]")?.value ?? "atkFlat")
        const base = {
            ...commonBase,
            stat,
            mode: targetKind === "skill" || isEventModifierStat(stat)
                ? "flat"
                : row.querySelector("[data-effect-mode]")?.value || modeForStat(stat),
            ...(targetKind === "default" && !isEventModifierStat(stat) && row.querySelector("[data-effect-basis]")?.value ? { basis: row.querySelector("[data-effect-basis]").value } : {}),
        }

        if (type === "derived") {
            return {
                ...base,
                sourceLabel: {
                    zhCN: row.querySelector("[data-effect-source-label]")?.value.trim() || "来源数值",
                },
                defaultSourceValue: numberValue(row.querySelector("[data-effect-default-source]")?.value),
                ratio: numberValue(row.querySelector("[data-effect-ratio]")?.value),
                ...(row.querySelector("[data-effect-cap]")?.value !== "" ? { cap: numberValue(row.querySelector("[data-effect-cap]")?.value) } : {}),
            }
        }

        if (type === "formula") {
            const minValue = row.querySelector("[data-effect-source-min]")?.value
            const maxValue = row.querySelector("[data-effect-source-max]")?.value
            return {
                ...base,
                source: {
                    variable: "x",
                    label: {
                        zhCN: row.querySelector("[data-effect-source-label]")?.value.trim() || "来源数值",
                    },
                    defaultValue: numberValue(row.querySelector("[data-effect-default-source]")?.value),
                    ...(minValue !== "" ? { min: numberValue(minValue) } : {}),
                    ...(maxValue !== "" ? { max: numberValue(maxValue) } : {}),
                },
                formula: {
                    expression: row.querySelector("[data-effect-formula-expression]")?.value.trim() || "",
                    valueUnit: PERCENT_VALUE_STATS.has(stat) || base.mode === "pct" ? "storedPercent" : "storedValue",
                },
            }
        }

        if (type === "stacked") {
            const valuePerStack = inputToStoredValue(stat, row.querySelector("[data-effect-value]")?.value)
            const stackGroup = row.querySelector("[data-effect-stack-group]")?.value.trim() ?? ""
            const stackLabel = row.querySelector("[data-effect-stack-label]")?.value.trim() ?? ""
            return {
                ...base,
                valuePerStack,
                maxStacks: numberValue(row.querySelector("[data-effect-max-stacks]")?.value, 1),
                defaultStacks: numberValue(row.querySelector("[data-effect-default-stacks]")?.value, 1),
                ...(stackGroup ? { stackGroup } : {}),
                ...(stackLabel ? { stackLabel: { zhCN: stackLabel } } : {}),
                ...readRuleModificationValues(row, type),
            }
        }

        const value = inputToStoredValue(stat, row.querySelector("[data-effect-value]")?.value)
        return {
            ...base,
            value,
            ...readRuleModificationValues(row, type),
        }
    }).filter(effect => effect.stat)
}

function renderBuffEffectRows(effects = []) {
    renderEffectRuleRows("buffEffectRows", effects)
}

function readBuffEffectRows() {
    return readEffectRuleRows("buffEffectRows")
}

function renderAnomalyEffectForm(item = null) {
    const effect = item ?? blankDraftItem("anomalyEffects")
    const maintenanceType = anomalyMaintenanceType(effect)
    els.editorTitle.textContent = "异常伤害"
    els.editorTag.textContent = `${maintenanceType === "disorder" ? "紊乱" : "属性伤害"} / ${effect.id || "新条目"}`
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>基础信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("结算类型", true)}<select id="anomalyMaintenanceType">${selectOptions([["anomaly", "属性伤害"], ["disorder", "紊乱"]], maintenanceType)}</select></label>
            <label class="field">${fieldLabel("ID", true)}<input id="recordId" value="${escapeHtml(effect.id ?? "")}" required></label>
            ${localizedZhInput("label", effect.label, "中文名")}
            <label class="field">${fieldLabel("元素", true)}<select id="anomalyElement">${selectOptions(DAMAGE_ELEMENT_OPTIONS, effect.element ?? "physical")}</select></label>
          </div>
        </section>
        <section class="maintenance-section anomaly-effect-only">
          <h3>属性异常倍率</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("基础倍率", true)}<input id="baseMultiplier" type="number" min="0" step="0.001" value="${escapeHtml(effect.baseMultiplier ?? 0)}"></label>
            <label class="field">${fieldLabel("默认结算次数", true)}<input id="defaultProcCount" type="number" min="0" step="1" value="${escapeHtml(effect.defaultProcCount ?? 1)}"></label>
          </div>
        </section>
        <section class="maintenance-section disorder-effect-only">
          <h3>紊乱倍率</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("固定倍率", true)}<input id="fixedMultiplier" type="number" min="0" step="0.001" value="${escapeHtml(effect.fixedMultiplier ?? 4.5)}"></label>
            <label class="field">${fieldLabel("每跳倍率", true)}<input id="tickMultiplier" type="number" min="0" step="0.001" value="${escapeHtml(effect.tickMultiplier ?? 0)}"></label>
            <label class="field">${fieldLabel("跳间隔秒", true)}<input id="tickIntervalSeconds" type="number" min="0.0001" step="0.1" value="${escapeHtml(effect.tickIntervalSeconds ?? 1)}"></label>
            <label class="field">${fieldLabel("默认持续秒数", true)}<input id="defaultDurationSeconds" type="number" min="0" step="0.1" value="${escapeHtml(effect.defaultDurationSeconds ?? 10)}"></label>
          </div>
        </section>
    `
    syncAnomalyEffectTypeFields()
    updatePreview()
}

function syncAnomalyEffectTypeFields() {
    const maintenanceType = document.getElementById("anomalyMaintenanceType")?.value ?? "anomaly"
    for (const item of els.maintenanceForm.querySelectorAll(".anomaly-effect-only")) {
        item.hidden = maintenanceType !== "anomaly"
    }
    for (const item of els.maintenanceForm.querySelectorAll(".disorder-effect-only")) {
        item.hidden = maintenanceType !== "disorder"
    }
}

function buildAnomalyEffect() {
    const maintenanceType = document.getElementById("anomalyMaintenanceType")?.value === "disorder"
        ? "disorder"
        : "anomaly"
    const base = {
        id: document.getElementById("recordId").value.trim(),
        maintenanceType,
        settlementType: maintenanceType === "disorder" ? "disorder" : "attribute",
        label: readLocalizedZh("label"),
        element: document.getElementById("anomalyElement").value,
    }
    if (maintenanceType === "disorder") {
        return {
            ...base,
            fixedMultiplier: numberValue(document.getElementById("fixedMultiplier").value),
            tickMultiplier: numberValue(document.getElementById("tickMultiplier").value),
            tickIntervalSeconds: numberValue(document.getElementById("tickIntervalSeconds").value),
            defaultDurationSeconds: numberValue(document.getElementById("defaultDurationSeconds").value),
        }
    }

    return {
        ...base,
        baseMultiplier: numberValue(document.getElementById("baseMultiplier").value),
        defaultProcCount: numberValue(document.getElementById("defaultProcCount").value),
    }
}

function coverageBlock(prefix, coverage = null) {
    return `
        <section class="maintenance-section">
          <h3>覆盖率</h3>
          <div class="maintenance-grid">
            <label class="checkbox-row"><input id="${prefix}CoverageEnabled" type="checkbox"${coverage ? " checked" : ""}>启用覆盖率</label>
            <label class="field"><span>默认覆盖率</span><input id="${prefix}CoverageDefault" type="number" min="0" max="1" step="0.1" value="${escapeHtml(coverage?.default ?? 1)}"></label>
          </div>
        </section>
    `
}

function readCoverageConfig(prefix = "") {
    return document.getElementById(`${prefix}CoverageEnabled`)?.checked
        ? {
            default: numberValue(document.getElementById(`${prefix}CoverageDefault`)?.value, 1),
            min: 0,
            max: 1,
            step: 0.1,
        }
        : null
}

function renderBuffForm(item = null) {
    if (activeKind === "fieldBuffs") {
        renderFieldBuffForm(item)
    } else if (activeKind === "bossBuffs") {
        renderBossBuffForm(item)
    } else {
        renderTeammateBuffForm(item)
    }
}

function buffRuleSection() {
    return `
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>Buff 规则</h3>
            <button type="button" class="compact-btn" data-add-effect>添加规则</button>
          </div>
          <div id="buffEffectRows" class="maintenance-buff-effect-rows"></div>
        </section>
    `
}

function buffModifierSection() {
    return `
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>Buff 修饰</h3>
            <button type="button" class="compact-btn" data-add-buff-modifier>添加修饰</button>
          </div>
          <div id="buffModifierRows" class="maintenance-buff-modifier-rows"></div>
        </section>
    `
}

function collectionForKind(kind) {
    const records = rawCollections()[kind] ?? []
    return [
        ...(drafts[kind] ?? []).map(draftRecord).map(item => kind === "teammateBuffs" ? normalizeTeammateGroupRecord(item) : item),
        ...records.map(item => {
            const key = baseRecordKey(item)
            const edit = unsavedEdits.get(sessionKey(kind, key))
            const record = edit
                ? { ...item, ...structuredClone(edit), __sessionKey: key }
                : { ...item, __sessionKey: key }
            return kind === "teammateBuffs" ? normalizeTeammateGroupRecord(record) : record
        }),
    ]
}

function shortInternalId(id = "") {
    const text = String(id || "")
    if (text.length <= 32) {
        return text
    }
    const parts = text.split(/[._:-]+/).filter(Boolean)
    return parts.length >= 2
        ? parts.slice(-2).join(".")
        : `${text.slice(0, 14)}...${text.slice(-10)}`
}

function currentTeammateIdForBuffModifierOptions() {
    return document.getElementById("teammateId")?.value.trim()
        || selectedCleanRecord()?.id
        || selectedCleanRecord()?.teammateId
        || ""
}

function buffModifierTargetBuffCandidates() {
    const seen = new Set()
    const candidates = []
    const addCandidate = (kind, item, label, ownerId = "") => {
        if (!item?.id || seen.has(item.id)) {
            return
        }
        seen.add(item.id)
        candidates.push({
            id: item.id,
            kind,
            item,
            label,
            ownerId,
        })
    }

    for (const item of flattenedTeammateBuffRecords()) {
        const owner = localized(item.teammateName) || item.teammateId || "队友"
        const source = localized(item.source) || localized(item.sourceLabel) || nameOf(item)
        addCandidate("teammate", item, `${owner}｜${source || item.id}`, item.teammateId)
    }
    for (const item of collectionForKind("fieldBuffs")) {
        const source = localized(item.source) || localized(item.sourceLabel) || nameOf(item)
        const period = fieldPeriodDetail(item)
        addCandidate("field", item, ["场地", source, period].filter(Boolean).join("｜") || item.id)
    }
    for (const item of collectionForKind("bossBuffs")) {
        const owner = nameOf(item) || "BOSS"
        const source = localized(item.bossSource) || localized(item.source) || localized(item.sourceLabel)
        addCandidate("boss", item, [owner, source].filter(Boolean).join("｜") || item.id)
    }

    const labelCounts = new Map()
    for (const candidate of candidates) {
        labelCounts.set(candidate.label, (labelCounts.get(candidate.label) ?? 0) + 1)
    }

    const currentTeammateId = currentTeammateIdForBuffModifierOptions()
    const kindOrder = { teammate: 0, field: 1, boss: 2 }
    return candidates
        .map(candidate => ({
            ...candidate,
            optionLabel: labelCounts.get(candidate.label) > 1
                ? `${candidate.label}（${shortInternalId(candidate.id)}）`
                : candidate.label,
        }))
        .sort((left, right) => {
            const leftSameTeammate = left.kind === "teammate" && left.ownerId && left.ownerId === currentTeammateId
            const rightSameTeammate = right.kind === "teammate" && right.ownerId && right.ownerId === currentTeammateId
            if (leftSameTeammate !== rightSameTeammate) {
                return leftSameTeammate ? -1 : 1
            }
            const kindDelta = (kindOrder[left.kind] ?? 99) - (kindOrder[right.kind] ?? 99)
            if (kindDelta !== 0) {
                return kindDelta
            }
            return left.optionLabel.localeCompare(right.optionLabel, "zh-CN")
        })
}

function buffModifierTargetBuffOptions(selectedBuffId = "") {
    const options = [
        ["", "请选择目标 Buff"],
        ...buffModifierTargetBuffCandidates().map(candidate => [candidate.id, candidate.optionLabel]),
    ]
    if (selectedBuffId && !options.some(([value]) => value === selectedBuffId)) {
        options.push([selectedBuffId, `未知 Buff：${selectedBuffId}`])
    }
    return options
}

function buffModifierTargetBuff(buffId = "") {
    return buffModifierTargetBuffCandidates().find(candidate => candidate.id === buffId) ?? null
}

function buffModifierEffectOptionLabel(rule, buff) {
    const runtime = defaultRuntimeForBuff(buff)
    return storedCombatEffectRuleText(rule, runtime, buff, catalog?.meta)
        || effectsSummary({ effects: [rule] })
        || rule.id
        || "未命名规则"
}

function buffModifierTargetEffectOptions(targetBuffId = "", selectedEffectId = "") {
    const target = buffModifierTargetBuff(targetBuffId)
    if (!target) {
        return [
            ["", "先选择目标 Buff"],
            ...(selectedEffectId ? [[selectedEffectId, `未知效果：${selectedEffectId}`]] : []),
        ]
    }

    const rules = effectRules(target.item)
    const options = [
        ["", "请选择目标效果"],
        ...rules.map((rule, index) => {
            const normalizedRule = {
                ...rule,
                id: rule.id ?? `effect-${index + 1}`,
            }
            return [normalizedRule.id, buffModifierEffectOptionLabel(normalizedRule, target.item)]
        }),
    ]
    if (selectedEffectId && !options.some(([value]) => value === selectedEffectId)) {
        options.push([selectedEffectId, `未知效果：${selectedEffectId}`])
    }
    if (options.length === 1) {
        options[0][1] = "目标 Buff 没有普通规则"
        if (selectedEffectId) {
            options.push([selectedEffectId, `未知效果：${selectedEffectId}`])
        }
    }
    return options
}

function syncBuffModifierTargetEffectRow(row, preferredEffectId = undefined) {
    if (!row) {
        return
    }

    const targetBuffId = row.querySelector("[data-buff-modifier-target-buff]")?.value ?? ""
    const effectSelect = row.querySelector("[data-buff-modifier-target-effect]")
    const options = buffModifierTargetEffectOptions(targetBuffId, preferredEffectId ?? effectSelect?.value ?? "")
    const realOptions = options.filter(([value]) => value)
    const selected = preferredEffectId ?? effectSelect?.value ?? (realOptions.length === 1 ? realOptions[0][0] : "")
    replaceSelectOptions(effectSelect, options, selected)
    if (effectSelect) {
        effectSelect.disabled = !targetBuffId || !realOptions.length
    }
}

function parseModifierTargetDataset(value) {
    try {
        const parsed = JSON.parse(value || "[]")
        return Array.isArray(parsed)
            ? parsed.map(item => String(item ?? "").trim()).filter(Boolean)
            : []
    } catch {
        return []
    }
}

function selectedModifierTargetArray(row, selector, datasetKey) {
    const selected = row.querySelector(selector)?.value.trim() ?? ""
    if (!selected) {
        return []
    }
    const original = parseModifierTargetDataset(row.dataset[datasetKey])
    return original[0] === selected && original.length > 1
        ? original
        : [selected]
}

function currentBuffModifierSourceId() {
    const existing = activeKind === "teammateBuffs"
        ? selectedTeammateBuff(selectedCleanRecord())
        : selectedCleanRecord()
    if (activeKind === "fieldBuffs" || activeKind === "bossBuffs") {
        return document.getElementById("recordId")?.value.trim() || existing?.id || ""
    }

    return existing?.id
        || [
            document.getElementById("teammateId")?.value.trim(),
            document.getElementById("buffSourceZh")?.value.trim(),
        ].filter(Boolean).join(".")
}

function generatedBuffModifierId(targetBuffIds = [], targetEffectIds = []) {
    const source = slugify(currentBuffModifierSourceId(), "buff")
    const target = slugify(targetEffectIds[0] || targetBuffIds[0], "effect")
    return `${source}.modify_${target}`
}

function renderBuffModifierRows(modifiers = []) {
    const container = document.getElementById("buffModifierRows")
    if (!container) {
        return
    }

    container.innerHTML = ""
    modifiers.forEach((modifier, index) => {
        const originalTargetBuffIds = Array.isArray(modifier.targetBuffIds)
            ? modifier.targetBuffIds.map(item => String(item ?? "").trim()).filter(Boolean)
            : []
        const originalTargetEffectIds = Array.isArray(modifier.targetEffectIds)
            ? modifier.targetEffectIds.map(item => String(item ?? "").trim()).filter(Boolean)
            : []
        const selectedTargetBuffId = originalTargetBuffIds[0] ?? ""
        const selectedTargetEffectId = originalTargetEffectIds[0] ?? ""
        const row = document.createElement("div")
        row.className = "maintenance-buff-effect-row maintenance-buff-modifier-row"
        row.dataset.modifierIndex = String(index)
        row.dataset.modifierId = modifier.id ?? ""
        row.dataset.originalTargetBuffIds = JSON.stringify(originalTargetBuffIds)
        row.dataset.originalTargetEffectIds = JSON.stringify(originalTargetEffectIds)
        row.innerHTML = `
            <label class="field">
              ${fieldLabel("说明", true)}
              <input data-buff-modifier-label value="${escapeHtml(localized(modifier.label) || "")}" placeholder="额外能力效果提升至原本的130%">
            </label>
            <label class="field">
              ${fieldLabel("目标 Buff", true)}
              <select data-buff-modifier-target-buff>${selectOptions(buffModifierTargetBuffOptions(selectedTargetBuffId), selectedTargetBuffId)}</select>
            </label>
            <label class="field">
              ${fieldLabel("目标效果", true)}
              <select data-buff-modifier-target-effect>${selectOptions(buffModifierTargetEffectOptions(selectedTargetBuffId, selectedTargetEffectId), selectedTargetEffectId)}</select>
            </label>
            <label class="field">
              ${fieldLabel("倍率", true)}
              <input data-buff-modifier-factor type="number" step="0.01" min="0" value="${escapeHtml(modifier.factor ?? 1.3)}">
            </label>
            <button type="button" class="compact-btn maintenance-remove-effect" data-remove-buff-modifier="${index}">删除</button>
        `
        container.appendChild(row)
        syncBuffModifierTargetEffectRow(row, selectedTargetEffectId)
    })
}

function readBuffModifierRows() {
    return [...document.querySelectorAll("#buffModifierRows .maintenance-buff-modifier-row")]
        .map(row => {
            const label = row.querySelector("[data-buff-modifier-label]")?.value.trim()
            const targetBuffIds = selectedModifierTargetArray(row, "[data-buff-modifier-target-buff]", "originalTargetBuffIds")
            const targetEffectIds = selectedModifierTargetArray(row, "[data-buff-modifier-target-effect]", "originalTargetEffectIds")
            const factor = numberValue(row.querySelector("[data-buff-modifier-factor]")?.value, NaN)
            const id = row.dataset.modifierId?.trim()
                || (targetBuffIds.length && targetEffectIds.length ? generatedBuffModifierId(targetBuffIds, targetEffectIds) : "")
            return {
                ...(id ? { id } : {}),
                operation: "multiplyResolvedValue",
                factor,
                targetBuffIds,
                targetEffectIds,
                ...(label ? { label: { zhCN: label } } : {}),
            }
        })
        .filter(modifier =>
            modifier.id
            || localized(modifier.label)
            || modifier.targetBuffIds.length
            || modifier.targetEffectIds.length
            || Number.isFinite(modifier.factor)
        )
}

function teammateBuffTitle(buff = {}) {
    return localized(buff.source) || localized(buff.sourceLabel) || buff.id || "新 Buff"
}

function renderTeammateBuffForm(item = null) {
    const rawGroup = normalizeTeammateGroupRecord(item ?? blankDraftItem("teammateBuffs"))
    const group = rawGroup.buffs?.length ? rawGroup : { ...rawGroup, buffs: [blankTeammateBuffDraft()] }
    const selectedIndex = selectedTeammateBuffIndex(group)
    const buff = group.buffs[selectedIndex] ?? group.buffs[0] ?? blankTeammateBuffDraft()
    const realSelectedIndex = Math.max(0, selectedIndex)
    setSelectedTeammateBuff(group, buff, realSelectedIndex)
    const isSavedGroup = !group.__isDraft && Boolean(group.id)
    const buffButtons = group.buffs.map((candidate, index) => {
        const value = teammateBuffSelectionValue(candidate, index)
        const active = index === realSelectedIndex
        const summary = effectsSummary(candidate)
        return `
            <button type="button" class="teammate-buff-choice${active ? " active" : ""}" data-select-teammate-buff="${escapeHtml(value)}">
              <strong>${escapeHtml(teammateBuffTitle(candidate))}</strong>
              <span>${escapeHtml([candidate.id, summary].filter(Boolean).join(" · ") || "尚未保存")}</span>
            </button>
        `
    }).join("")

    els.editorTitle.textContent = "队友 Buff 资料"
    els.editorTag.textContent = `${group.id || "新队友"} / ${teammateBuffTitle(buff)}`
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>队友角色</h3>
          <div class="maintenance-grid">
            <div class="teammate-maintenance-image">
              ${teammateAvatarMarkup(group)}
            </div>
            <label class="field">${fieldLabel("队友 ID", true)}<input id="teammateId" value="${escapeHtml(group.id ?? group.teammateId ?? "")}"${isSavedGroup ? " readonly" : ""} required></label>
            <label class="field">${fieldLabel("队友中文名", true)}<input id="teammateNameZh" value="${escapeHtml((group.name ?? group.teammateName)?.zhCN ?? "")}" required></label>
            <label class="field">${fieldLabel("头像路径")}<input id="teammateImagePath" value="${escapeHtml(teammateGroupImage(group))}" placeholder="/assets/agents/..."></label>
            <label class="field">${fieldLabel("头像来源")}<input id="teammateImageSource" value="${escapeHtml(group.images?.source ?? "")}" placeholder="https://..."></label>
          </div>
        </section>
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>Buff 列表</h3>
            <button type="button" class="compact-btn" data-add-teammate-buff>添加 Buff</button>
          </div>
          <div class="teammate-buff-choice-list">
            ${buffButtons || `<div class="list-item empty">暂无 Buff</div>`}
          </div>
        </section>
        <section class="maintenance-section">
          <h3>当前 Buff</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("来源中文名", true)}<input id="buffSourceZh" value="${escapeHtml((buff.source ?? buff.sourceLabel)?.zhCN ?? "")}" required></label>
            <label class="field">${fieldLabel("范围", true)}<select id="buffScope">${selectOptions(EFFECT_SCOPE_OPTIONS, buff.scope ?? "inCombat")}</select></label>
            <label class="field"><span>条件标签</span><input id="conditionLabel" value="${escapeHtml(localized(buff.conditionLabel) || "")}"></label>
            ${displayToggleField(buff)}
            <label class="field"><span>中文说明</span><textarea id="descriptionZh">${escapeHtml(buff.description?.zhCN ?? "")}</textarea></label>
          </div>
        </section>
        ${coverageBlock("buff", buff.coverage)}
        ${buffRuleSection()}
        ${buffModifierSection()}
    `
    renderBuffEffectRows(effectRules(buff))
    renderBuffModifierRows(buff.buffModifiers ?? [])
    updatePreview()
}

function renderFieldBuffForm(item = null) {
    const buff = item ?? blankDraftItem("fieldBuffs")
    els.editorTitle.textContent = "场地 Buff 资料"
    els.editorTag.textContent = localized(buff.name) || localized(buff.source) || "未命名"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>场地 Buff 信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("中文名称", true)}<input id="buffNameZh" value="${escapeHtml(buff.name?.zhCN ?? "")}" required></label>
            <label class="field">${fieldLabel("模式", true)}<select id="fieldModeId">${selectOptions(FIELD_BUFF_MODE_SELECT_OPTIONS, buff.period?.modeId ?? "defense_v5")}</select></label>
            <label class="field">${fieldLabel("版本", true)}<select id="fieldGameVersion">${selectOptions(FIELD_BUFF_VERSION_SELECT_OPTIONS, buff.period?.gameVersion ?? "3.0")}</select></label>
            <label class="field">${fieldLabel("第几期", true)}<select id="fieldPhaseNo">${selectOptions(FIELD_BUFF_PHASE_SELECT_OPTIONS, String(buff.period?.phaseNo ?? 1))}</select></label>
            ${displayToggleField(buff)}
            <label class="field"><span>中文说明</span><textarea id="descriptionZh" required>${escapeHtml(buff.description?.zhCN ?? "")}</textarea></label>
          </div>
        </section>
        ${coverageBlock("buff", buff.coverage)}
        ${buffRuleSection()}
        ${buffModifierSection()}
    `
    renderBuffEffectRows(effectRules(buff))
    renderBuffModifierRows(buff.buffModifiers ?? [])
    updatePreview()
}

function renderBossBuffForm(item = null) {
    const buff = item ?? blankDraftItem("bossBuffs")
    els.editorTitle.textContent = "BOSS Buff 资料"
    els.editorTag.textContent = localized(buff.bossName) || "未命名"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>BOSS Buff 信息</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("Buff ID")}<input id="recordId" value="${escapeHtml(buff.id ?? "")}" placeholder="留空自动生成"></label>
            <label class="field">${fieldLabel("BOSS 名称", true)}<input id="bossNameZh" value="${escapeHtml(buff.bossName?.zhCN ?? "")}" required></label>
            <label class="field">${fieldLabel("BOSS 来源", true)}<input id="bossSourceZh" value="${escapeHtml(buff.bossSource?.zhCN ?? "")}" required></label>
            <label class="field">${fieldLabel("来源期数", true)}<input id="sourcePeriodZh" value="${escapeHtml(buff.sourcePeriod?.zhCN ?? "")}" required></label>
            ${displayToggleField(buff)}
            <label class="field"><span>中文说明</span><textarea id="descriptionZh" required>${escapeHtml(buff.description?.zhCN ?? "")}</textarea></label>
          </div>
        </section>
        ${coverageBlock("buff", buff.coverage)}
        ${buffRuleSection()}
        ${buffModifierSection()}
    `
    renderBuffEffectRows(effectRules(buff))
    renderBuffModifierRows(buff.buffModifiers ?? [])
    updatePreview()
}

function buildBuff() {
    if (activeKind === "fieldBuffs") {
        return buildFieldBuff()
    }
    if (activeKind === "bossBuffs") {
        return buildBossBuff()
    }

    const group = selectedCleanRecord()
    const existing = selectedTeammateBuff(group)
    const buff = {
        ...(existing?.id ? { id: existing.id } : {}),
        scope: document.getElementById("buffScope").value,
        sourceType: "teammate",
        source: readLocalizedZh("buffSource"),
        sourceLabel: readLocalizedZh("buffSource"),
        conditionLabel: document.getElementById("conditionLabel").value.trim(),
        description: {
            zhCN: document.getElementById("descriptionZh").value.trim(),
        },
        coverage: readCoverageConfig("buff"),
        effects: readBuffEffectRows(),
        buffModifiers: readBuffModifierRows(),
    }

    return {
        teammate: {
            id: document.getElementById("teammateId").value.trim(),
            name: readLocalizedZh("teammateName"),
            images: {
                icon: document.getElementById("teammateImagePath")?.value.trim() ?? "",
                source: document.getElementById("teammateImageSource")?.value.trim() ?? "",
            },
        },
        buff: applyDisplayVisibility({
            ...(buff.id ? { id: buff.id } : {}),
            source: buff.source,
            description: buff.description,
            scope: buff.scope,
            ...(buff.conditionLabel ? { conditionLabel: buff.conditionLabel } : {}),
            ...(buff.coverage ? { coverage: buff.coverage } : {}),
            effects: buff.effects,
            buffModifiers: buff.buffModifiers,
        }),
    }
}

function buildFieldBuff() {
    const existing = selectedCleanRecord()
    const modeId = document.getElementById("fieldModeId")?.value.trim() ?? "defense_v5"
    const mode = fieldBuffModeOption(modeId)
    const phaseNo = numberValue(document.getElementById("fieldPhaseNo")?.value, 1)
    const period = {
        modeId,
        gameVersion: document.getElementById("fieldGameVersion")?.value.trim() ?? "",
        phaseNo,
        phaseName: fieldBuffPhaseName(phaseNo) ?? { zhCN: "" },
    }
    return applyDisplayVisibility({
        ...(existing?.id ? { id: existing.id } : {}),
        sourceType: "field",
        scope: "inCombat",
        name: readLocalizedZh("buffName"),
        source: { zhCN: mode?.source?.zhCN ?? "" },
        period,
        sourcePeriod: fieldSourcePeriodFromPeriod(period) ?? existing?.sourcePeriod,
        description: {
            zhCN: document.getElementById("descriptionZh").value.trim(),
        },
        coverage: readCoverageConfig("buff"),
        effects: readBuffEffectRows(),
        buffModifiers: readBuffModifierRows(),
    })
}

function buildBossBuff() {
    const existing = selectedCleanRecord()
    return applyDisplayVisibility({
        ...(existing?.id ? { id: existing.id } : {}),
        ...(document.getElementById("recordId")?.value.trim() ? { id: document.getElementById("recordId").value.trim() } : {}),
        sourceType: "boss",
        scope: "inCombat",
        bossName: readLocalizedZh("bossName"),
        bossSource: readLocalizedZh("bossSource"),
        sourcePeriod: readLocalizedZh("sourcePeriod"),
        description: {
            zhCN: document.getElementById("descriptionZh").value.trim(),
        },
        coverage: readCoverageConfig("buff"),
        effects: readBuffEffectRows(),
        buffModifiers: readBuffModifierRows(),
    })
}

function buildCurrentPayload(options = {}) {
    if (activeKind === "agents") {
        return buildAgent(options)
    }
    if (activeKind === "agentSkills") {
        return buildAgentSkill()
    }
    if (activeKind === "wEngines") {
        return buildWEngine()
    }
    if (activeKind === "driveDiscSets") {
        return buildDriveDiscSet()
    }
    if (activeKind === "anomalyEffects") {
        return buildAnomalyEffect()
    }

    return buildBuff()
}

function persistCurrentEditor(payload = null) {
    if (!selectedKey || isRenderingEditor || !els.maintenanceForm.childElementCount) {
        return
    }

    let nextPayload = payload
    try {
        nextPayload ??= buildCurrentPayload({ allowInvalidCoreSkill: true })
    } catch {
        return
    }

    if (isDraftKey()) {
        const entry = selectedDraftEntry()
        if (entry) {
            entry.item = editorRecordFromPayload(nextPayload)
            entry.updatedAt = new Date().toISOString()
            saveDrafts()
        }
        return
    }

    unsavedEdits.set(sessionKey(), editorRecordFromPayload(nextPayload))
}

function persistTeammateGroupRecord(group) {
    const cleanGroup = normalizeTeammateGroupRecord(stripDraftMetadata(group))
    if (isDraftKey()) {
        const entry = selectedDraftEntry()
        if (entry) {
            entry.item = cleanGroup
            entry.updatedAt = new Date().toISOString()
            saveDrafts()
        }
        return
    }

    unsavedEdits.set(sessionKey(), cleanGroup)
}

function validationContextForCurrent(payload) {
    if (activeKind === "agents") {
        return {
            items: rawCollections().agents,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
            agentSkills: rawCollections().agentSkills,
            driveDiscSets: rawCollections().driveDiscSets,
            anomalyEffects: anomalyMaintenanceRecordsByType("anomaly"),
            disorderEffects: anomalyMaintenanceRecordsByType("disorder"),
            effects: anomalyMaintenanceRecords(),
        }
    }
    if (activeKind === "agentSkills") {
        return {
            items: rawCollections().agentSkills,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    if (activeKind === "wEngines") {
        return {
            items: rawCollections().wEngines,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    if (activeKind === "driveDiscSets") {
        return {
            items: rawCollections().driveDiscSets,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    if (activeKind === "anomalyEffects") {
        const maintenanceType = anomalyMaintenanceType(payload)
        return {
            items: rawCollections().anomalyEffects.filter(item => item.maintenanceType === maintenanceType),
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    if (activeKind === "teammateBuffs" || payload?.teammate || payload?.buff) {
        return {
            teammates: catalog?.combatBuffs?.teammates ?? [],
            currentBuffId: isDraftKey() ? undefined : selectedTeammateBuff(selectedCleanRecord())?.id,
        }
    }
    if (activeKind === "fieldBuffs") {
        return {
            items: rawCollections().fieldBuffs,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    if (activeKind === "bossBuffs") {
        return {
            items: rawCollections().bossBuffs,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    return {
        items: [],
        currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
    }
}

function updatePreview() {
    try {
        const payload = buildCurrentPayload()
        els.jsonPreview.textContent = JSON.stringify(previewPayload(payload), null, 2)
        if (activeKind === "wEngines") {
            renderWEngineModificationPreview(payload)
        }
        persistCurrentEditor(payload)
        renderList()
    } catch (error) {
        els.jsonPreview.textContent = error.message
        if (activeKind === "wEngines") {
            renderWEngineModificationPreview(null, error.message)
        }
        persistCurrentEditor()
        renderList()
    }
}

function previewPayload(payload) {
    if (!["teammateBuffs", "fieldBuffs", "bossBuffs"].includes(activeKind)) {
        return payload
    }

    const copy = structuredClone(payload)
    const buff = copy.buff ?? copy
    delete buff.id
    if (Array.isArray(buff.effects)) {
        buff.effects = buff.effects.map(effect => {
            const { id, ...rest } = effect
            return rest
        })
    }
    if (Array.isArray(buff.buffModifiers)) {
        buff.buffModifiers = buff.buffModifiers.map(modifier => {
            const { id, ...rest } = modifier
            return rest
        })
    }
    return copy
}

function renderEditor(item = selectedRecord()) {
    isRenderingEditor = true
    try {
        if (activeKind === "agents") {
            renderAgentForm(item)
        } else if (activeKind === "agentSkills") {
            renderAgentSkillForm(item)
        } else if (activeKind === "wEngines") {
            renderWEngineForm(item)
        } else if (activeKind === "driveDiscSets") {
            renderDriveDiscSetForm(item)
        } else if (activeKind === "anomalyEffects") {
            renderAnomalyEffectForm(item)
        } else {
            renderBuffForm(item)
        }
    } finally {
        isRenderingEditor = false
    }
}

function selectFirstIfNeeded() {
    const records = collectionForActiveKind()
    if (!records.some(item => recordKey(item) === selectedKey)) {
        selectedKey = records[0] ? recordKey(records[0]) : ""
    }
}

function renderAll() {
    selectFirstIfNeeded()
    renderList()
    renderEditor()
    setSaveStrip("已加载", "修改字段后可在此保存", "idle")
}

async function loadCatalog() {
    const response = await api("/api/maintenance/catalog")
    catalog = response.data
}

async function saveCurrent() {
    persistCurrentEditor()
    const payload = buildCurrentPayload()
    const validation = validateMaintenanceItem(activeKind, payload, validationContextForCurrent(payload))
    if (!validation.ok) {
        const error = new Error("保存失败")
        error.details = validation.errors
        throw error
    }

    const draftId = draftIdFromKey()
    const previousSessionKey = sessionKey()
    const endpoint = KIND_CONFIG[activeKind].endpoint
    const response = await api(`/api/maintenance/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(payload),
    })
    await loadCatalog()
    if (draftId) {
        removeDraft(draftId)
    } else if (previousSessionKey) {
        unsavedEdits.delete(previousSessionKey)
    }
    if (activeKind === "teammateBuffs" && endpoint === "teammate-buffs") {
        selectedKey = baseRecordKey({
            maintenanceType: "teammateGroup",
            id: response.savedItem?.teammateId ?? payload.teammate.id,
        })
        if (response.savedItem?.id) {
            selectedTeammateBuffIds.set(selectedKey, `id:${response.savedItem.id}`)
        }
    } else {
        selectedKey = response.savedItem ? recordKey(response.savedItem) : payload.id
    }
    renderAll()
    const savedName = activeKind === "teammateBuffs"
        ? [
            localized(response.savedItem?.teammateName ?? payload.teammate?.name),
            localized(response.savedItem?.source ?? payload.buff?.source),
        ].filter(Boolean).join("｜") || "队友 Buff"
        : nameOf(response.savedItem ?? payload)
    setFeedback(`已保存：${savedName}`, [], "success")
    setSaveStrip("已保存", `最近保存：${savedName}`, "success")
    setStatus("已保存", "success")
}

function newRecord() {
    persistCurrentEditor()
    createDraft(blankDraftItem(activeKind))
    renderAll()
    setFeedback("已创建本地草稿", ["填写完成并通过校验后，点击保存写入正式数据。"], "success")
    setSaveStrip("有未保存草稿", "填写完成并通过校验后保存", "idle")
    setStatus("已创建本地草稿", "success")
}

function cloneRecord() {
    persistCurrentEditor()
    const current = selectedCleanRecord()
    if (!current) {
        newRecord()
        return
    }

    if (activeKind === "teammateBuffs") {
        const group = normalizeTeammateGroupRecord(current)
        const buff = selectedTeammateBuff(group)
        if (!buff) {
            newRecord()
            return
        }
        const copy = structuredClone(buff)
        delete copy.id
        const nextGroup = {
            ...group,
            buffs: [...(group.buffs ?? []), copy],
        }
        persistTeammateGroupRecord(nextGroup)
        selectedTeammateBuffIds.set(selectedKey, teammateBuffSelectionValue(copy, nextGroup.buffs.length - 1))
        renderAll()
        setFeedback("已复制当前 Buff", ["复制项已追加到当前角色下，保存时会由系统生成新的 Buff ID。"], "success")
        setSaveStrip("有未保存草稿", "确认复制内容后保存", "idle")
        setStatus("已复制当前 Buff", "success")
        return
    }

    const copy = structuredClone(current)
    copy.id = copy.id ? `${copy.id}_copy` : ""
    if (copy.maintenanceType === "teammate") {
        copy.id = copy.id ? `${copy.id}_${Date.now()}` : ""
    }
    if (["teammateBuffs", "fieldBuffs", "bossBuffs"].includes(activeKind)) {
        delete copy.id
    }
    createDraft(copy)
    renderAll()
    setFeedback("已复制为本地草稿", ["保存时会由系统生成新的 Buff ID。"], "success")
    setSaveStrip("有未保存草稿", "确认复制内容后保存", "idle")
    setStatus("已复制为本地草稿", "success")
}

document.querySelector(".maintenance-tabs").addEventListener("click", event => {
    const button = event.target.closest("button[data-kind]")
    if (!button) {
        return
    }

    persistCurrentEditor()
    activeKind = button.dataset.kind
    selectedKey = ""
    for (const tab of document.querySelectorAll(".maintenance-tabs button")) {
        tab.classList.toggle("active", tab === button)
    }
    renderAll()
})

els.recordList.addEventListener("click", event => {
    const button = event.target.closest("[data-key]")
    if (!button) {
        return
    }

    persistCurrentEditor()
    selectedKey = button.dataset.key
    renderAll()
})

els.searchInput.addEventListener("input", renderList)
els.newBtn.addEventListener("click", newRecord)
els.cloneBtn.addEventListener("click", cloneRecord)
els.maintenanceForm.addEventListener("input", () => {
    clearFeedback()
    setSaveStrip("有未保存修改", "保存前请留意校验结果", "idle")
    updatePreview()
})
els.maintenanceForm.addEventListener("change", event => {
    clearFeedback()
    setSaveStrip("有未保存修改", "保存前请留意校验结果", "idle")
    if (activeKind === "agentSkills" && event.target.matches("[data-skill-level-scale], [data-skill-level-min], [data-skill-level-max], [data-skill-level-default], [data-skill-core-default]")) {
        rerenderSkillCategories()
        updatePreview()
        return
    }

    if (event.target.matches("[data-stat-key], [data-stat-target-kind]")) {
        const row = event.target.closest(".maintenance-stat-row")
        syncMaintenanceStatRow(row)
    }

    if (event.target.id === "anomalyMaintenanceType") {
        syncAnomalyEffectTypeFields()
    }

    if (event.target.id === "specialty") {
        syncDefaultCalculationModeOptions()
    }

    if (event.target.matches("[data-effect-type]")) {
        syncBuffEffectRow(event.target.closest(".maintenance-buff-effect-row"))
    }

    if (event.target.matches("[data-effect-target-kind]")) {
        syncEffectStatOptions(event.target.closest(".maintenance-buff-effect-row"))
    }

    if (event.target.matches("[data-buff-modifier-target-buff]")) {
        syncBuffModifierTargetEffectRow(event.target.closest(".maintenance-buff-modifier-row"))
    }

    if (event.target.matches("[data-effect-skill-target-agent]")) {
        const targetRow = event.target.closest(".maintenance-skill-target-row")
        refreshSkillTargetRow(targetRow, { agentSkillId: event.target.value })
    }

    if (event.target.matches("[data-effect-skill-target-category]")) {
        const targetRow = event.target.closest(".maintenance-skill-target-row")
        refreshSkillTargetRow(targetRow, {
            agentSkillId: targetRow.querySelector("[data-effect-skill-target-agent]")?.value ?? "",
            categoryId: event.target.value,
        })
    }

    if (event.target.matches("[data-effect-skill-target-move]")) {
        const targetRow = event.target.closest(".maintenance-skill-target-row")
        refreshSkillTargetRow(targetRow, {
            agentSkillId: targetRow.querySelector("[data-effect-skill-target-agent]")?.value ?? "",
            categoryId: targetRow.querySelector("[data-effect-skill-target-category]")?.value ?? "",
            moveId: event.target.value,
        })
    }

    if (event.target.matches("[data-effect-stat]")) {
        const row = event.target.closest(".maintenance-buff-effect-row")
        const stat = event.target.value
        row.querySelector("[data-effect-mode]").value = modeForStat(stat)
        syncBuffEffectRow(row)
    }

    if (event.target.matches("[data-preferred-main-stat]")) {
        event.target.closest(".main-stat-choice")?.classList.toggle("active", event.target.checked)
    }

    if (event.target.matches("[data-default-calc-kind]")) {
        const groupRow = event.target.closest("[data-default-calc-group-event-row]")
        if (groupRow) {
            const groups = readDefaultCalculationSkillGroups()
            renderDefaultCalculationSkillGroups(groups)
        } else {
            renderDefaultCalculationVariants(readDefaultCalculationVariants())
        }
        updatePreview()
        return
    }

    if (event.target.matches("[data-default-calc-damage-source]")) {
        const groupRow = event.target.closest("[data-default-calc-group-event-row]")
        if (groupRow) {
            renderDefaultCalculationSkillGroups(readDefaultCalculationSkillGroups())
        } else {
            renderDefaultCalculationVariants(readDefaultCalculationVariants())
        }
        updatePreview()
        return
    }

    if (event.target.matches("[data-default-calc-category]")) {
        const row = event.target.closest("[data-default-calc-event-row], [data-default-calc-group-event-row]")
        const moveSelect = row.querySelector("[data-default-calc-move]")
        const rowSelect = row.querySelector("[data-default-calc-row]")
        moveSelect.innerHTML = defaultCalcMoveOptions(event.target.value)
        rowSelect.innerHTML = defaultCalcRowOptions(event.target.value, moveSelect.value)
    }

    if (event.target.matches("[data-default-calc-skill-group]")) {
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    if (event.target.matches("[data-default-calc-move]")) {
        const row = event.target.closest("[data-default-calc-event-row], [data-default-calc-group-event-row]")
        const categoryId = row.querySelector("[data-default-calc-category]")?.value ?? ""
        row.querySelector("[data-default-calc-row]").innerHTML = defaultCalcRowOptions(categoryId, event.target.value)
    }

    if (event.target.matches("[data-default-calc-skill-group-id], [data-default-calc-skill-group-name], [data-default-calc-skill-group-default-count], [data-default-calc-skill-group-step]")) {
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
    }

    if (event.target.matches("[data-default-calc-cinema-level]")) {
        const row = event.target.closest("[data-default-calc-variant-row]")
        const nameInput = row?.querySelector("[data-default-calc-name]")
        const nextName = localized(defaultCalculationVariantName(event.target.value))
        if (nameInput && (!nameInput.value.trim() || /^默认循环（[0-6]影）$/u.test(nameInput.value.trim()))) {
            nameInput.value = nextName
        }
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    updatePreview()
})
els.maintenanceForm.addEventListener("click", event => {
    const selectTeammateBuff = event.target.closest("[data-select-teammate-buff]")
    if (selectTeammateBuff) {
        clearFeedback()
        persistCurrentEditor()
        selectedTeammateBuffIds.set(selectedKey, selectTeammateBuff.dataset.selectTeammateBuff)
        renderEditor()
        setSaveStrip("已切换 Buff", "修改字段后可在此保存", "idle")
        return
    }

    const addTeammateBuff = event.target.closest("[data-add-teammate-buff]")
    if (addTeammateBuff) {
        clearFeedback()
        persistCurrentEditor()
        const group = normalizeTeammateGroupRecord(selectedCleanRecord() ?? blankDraftItem("teammateBuffs"))
        const nextBuff = blankTeammateBuffDraft()
        const nextGroup = {
            ...group,
            buffs: [...(group.buffs ?? []), nextBuff],
        }
        persistTeammateGroupRecord(nextGroup)
        selectedTeammateBuffIds.set(selectedKey, teammateBuffSelectionValue(nextBuff, nextGroup.buffs.length - 1))
        renderAll()
        setFeedback("已添加 Buff", ["填写当前 Buff 后保存，会写入当前角色名下。"], "success")
        setSaveStrip("有未保存草稿", "填写完成并通过校验后保存", "idle")
        setStatus("已添加 Buff", "success")
        return
    }

    const addSkillCategory = event.target.closest("[data-add-skill-category]")
    if (addSkillCategory) {
        clearFeedback()
        rerenderSkillCategories([...readSkillCategories(), skillCategoryDraft()])
        updatePreview()
        return
    }

    const removeSkillCategory = event.target.closest("[data-remove-skill-category]")
    if (removeSkillCategory) {
        clearFeedback()
        const categories = readSkillCategories()
        categories.splice(Number(removeSkillCategory.dataset.removeSkillCategory), 1)
        rerenderSkillCategories(categories)
        updatePreview()
        return
    }

    const addSkillMove = event.target.closest("[data-add-skill-move]")
    if (addSkillMove) {
        clearFeedback()
        const categoryElement = addSkillMove.closest("[data-skill-category-row]")
        const categories = readSkillCategories()
        const categoryIndex = [...els.maintenanceForm.querySelectorAll("[data-skill-category-row]")].indexOf(categoryElement)
        if (categories[categoryIndex]) {
            categories[categoryIndex].moves = [...(categories[categoryIndex].moves ?? []), skillMoveDraft()]
        }
        rerenderSkillCategories(categories)
        updatePreview()
        return
    }

    const removeSkillMove = event.target.closest("[data-remove-skill-move]")
    if (removeSkillMove) {
        clearFeedback()
        const categoryElement = removeSkillMove.closest("[data-skill-category-row]")
        const categories = readSkillCategories()
        const categoryIndex = [...els.maintenanceForm.querySelectorAll("[data-skill-category-row]")].indexOf(categoryElement)
        if (categories[categoryIndex]) {
            categories[categoryIndex].moves.splice(Number(removeSkillMove.dataset.removeSkillMove), 1)
        }
        rerenderSkillCategories(categories)
        updatePreview()
        return
    }

    const addSkillRow = event.target.closest("[data-add-skill-row]")
    if (addSkillRow) {
        clearFeedback()
        const categoryElement = addSkillRow.closest("[data-skill-category-row]")
        const moveElement = addSkillRow.closest("[data-skill-move-row]")
        const categoryElements = [...els.maintenanceForm.querySelectorAll("[data-skill-category-row]")]
        const moveElements = [...categoryElement.querySelectorAll("[data-skill-move-row]")]
        const categoryIndex = categoryElements.indexOf(categoryElement)
        const moveIndex = moveElements.indexOf(moveElement)
        const categories = readSkillCategories()
        if (categories[categoryIndex]?.moves?.[moveIndex]) {
            categories[categoryIndex].moves[moveIndex].rows = [
                ...(categories[categoryIndex].moves[moveIndex].rows ?? []),
                skillRowDraft(categories[categoryIndex].levelRange),
            ]
        }
        rerenderSkillCategories(categories)
        updatePreview()
        return
    }

    const removeSkillRow = event.target.closest("[data-remove-skill-row]")
    if (removeSkillRow) {
        clearFeedback()
        const categoryElement = removeSkillRow.closest("[data-skill-category-row]")
        const moveElement = removeSkillRow.closest("[data-skill-move-row]")
        const categoryElements = [...els.maintenanceForm.querySelectorAll("[data-skill-category-row]")]
        const moveElements = [...categoryElement.querySelectorAll("[data-skill-move-row]")]
        const categoryIndex = categoryElements.indexOf(categoryElement)
        const moveIndex = moveElements.indexOf(moveElement)
        const categories = readSkillCategories()
        if (categories[categoryIndex]?.moves?.[moveIndex]) {
            categories[categoryIndex].moves[moveIndex].rows.splice(Number(removeSkillRow.dataset.removeSkillRow), 1)
        }
        rerenderSkillCategories(categories)
        updatePreview()
        return
    }

    const clearPreferredMainStats = event.target.closest("[data-clear-preferred-main-stats]")
    if (clearPreferredMainStats) {
        clearFeedback()
        const slot = clearPreferredMainStats.dataset.clearPreferredMainStats
        for (const input of els.maintenanceForm.querySelectorAll(`input[data-preferred-main-stat="${slot}"]`)) {
            input.checked = false
            input.closest(".main-stat-choice")?.classList.remove("active")
        }
        updatePreview()
        return
    }

    const addDefaultCalcEvent = event.target.closest("[data-add-default-calc-event]")
    if (addDefaultCalcEvent) {
        clearFeedback()
        const [variantIndexText, kind = "direct"] = String(addDefaultCalcEvent.dataset.addDefaultCalcEvent).split(":")
        const variants = readDefaultCalculationVariants()
        const variant = variants[Number(variantIndexText)]
        if (variant) {
            variant.events = [
                ...(variant.events ?? []),
                defaultCalculationEventDraft(kind),
            ]
        }
        renderDefaultCalculationVariants(variants)
        updatePreview()
        return
    }

    const addDefaultCalcVariant = event.target.closest("[data-add-default-calc-variant]")
    if (addDefaultCalcVariant) {
        clearFeedback()
        const variants = readDefaultCalculationVariants()
        const nextLevel = nextDefaultCalculationCinemaLevel(variants)
        renderDefaultCalculationVariants([
            ...variants,
            defaultCalculationConfigDraft(nextLevel),
        ])
        updatePreview()
        return
    }

    const addDefaultCalcSkillGroup = event.target.closest("[data-add-default-calc-skill-group-definition]")
    if (addDefaultCalcSkillGroup) {
        clearFeedback()
        renderDefaultCalculationSkillGroups([
            ...readDefaultCalculationSkillGroups(),
            defaultCalculationSkillGroupDraft(),
        ])
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    const removeDefaultCalcSkillGroup = event.target.closest("[data-remove-default-calc-skill-group]")
    if (removeDefaultCalcSkillGroup) {
        clearFeedback()
        const groups = readDefaultCalculationSkillGroups()
        groups.splice(Number(removeDefaultCalcSkillGroup.dataset.removeDefaultCalcSkillGroup), 1)
        renderDefaultCalculationSkillGroups(groups)
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    const addDefaultCalcGroupEvent = event.target.closest("[data-add-default-calc-group-event]")
    if (addDefaultCalcGroupEvent) {
        clearFeedback()
        const [groupIndex, kind] = String(addDefaultCalcGroupEvent.dataset.addDefaultCalcGroupEvent).split(":")
        const groups = readDefaultCalculationSkillGroups()
        const group = groups[Number(groupIndex)]
        if (group) {
            group.events = [...(group.events ?? []), defaultCalculationEventDraft(kind)]
        }
        renderDefaultCalculationSkillGroups(groups)
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    const removeDefaultCalcGroupEvent = event.target.closest("[data-remove-default-calc-group-event]")
    if (removeDefaultCalcGroupEvent) {
        clearFeedback()
        const [groupIndex, eventIndex] = String(removeDefaultCalcGroupEvent.dataset.removeDefaultCalcGroupEvent).split(":")
        const groups = readDefaultCalculationSkillGroups()
        const group = groups[Number(groupIndex)]
        if (group?.events) {
            group.events.splice(Number(eventIndex), 1)
        }
        renderDefaultCalculationSkillGroups(groups)
        renderDefaultCalculationVariants(readDefaultCalculationVariants())
        updatePreview()
        return
    }

    const removeDefaultCalcEvent = event.target.closest("[data-remove-default-calc-event]")
    if (removeDefaultCalcEvent) {
        clearFeedback()
        const variants = readDefaultCalculationVariants()
        const [variantIndexText, eventIndexText] = String(removeDefaultCalcEvent.dataset.removeDefaultCalcEvent).split(":")
        const variantIndex = eventIndexText === undefined ? 0 : Number(variantIndexText)
        const eventIndex = eventIndexText === undefined ? Number(variantIndexText) : Number(eventIndexText)
        if (variants[variantIndex]?.events) {
            variants[variantIndex].events.splice(eventIndex, 1)
        }
        renderDefaultCalculationVariants(variants)
        updatePreview()
        return
    }

    const removeDefaultCalcVariant = event.target.closest("[data-remove-default-calc-variant]")
    if (removeDefaultCalcVariant) {
        clearFeedback()
        const variants = readDefaultCalculationVariants()
        variants.splice(Number(removeDefaultCalcVariant.dataset.removeDefaultCalcVariant), 1)
        renderDefaultCalculationVariants(variants.length ? variants : [defaultCalculationConfigDraft(0)])
        updatePreview()
        return
    }

    const addCinemaBuff = event.target.closest("[data-add-cinema-buff]")
    if (addCinemaBuff) {
        clearFeedback()
        const current = readCinemaBuffRows()
        const usedLevels = new Set(current.map(buff => Number(buff.cinemaLevel)))
        const nextLevel = [1, 2, 3, 4, 5, 6].find(level => !usedLevels.has(level)) ?? 1
        renderCinemaBuffRows([...current, cinemaBuffDraft(nextLevel)])
        updatePreview()
        return
    }

    const removeCinemaBuff = event.target.closest("[data-remove-cinema-buff]")
    if (removeCinemaBuff) {
        clearFeedback()
        const current = readCinemaBuffRows()
        current.splice(Number(removeCinemaBuff.dataset.removeCinemaBuff), 1)
        renderCinemaBuffRows(current)
        updatePreview()
        return
    }

    const addEffectRule = event.target.closest("[data-add-effect-rule]")
    if (addEffectRule) {
        clearFeedback()
        const containerId = addEffectRule.dataset.addEffectRule
        renderEffectRuleRows(containerId, [...readEffectRuleRows(containerId), { type: "fixed", stat: "atkFlat", value: 0, mode: "flat" }])
        updatePreview()
        return
    }

    const addEffect = event.target.closest("[data-add-effect]")
    if (addEffect) {
        clearFeedback()
        renderBuffEffectRows([...readBuffEffectRows(), { type: "fixed", stat: "atkFlat", value: 0, mode: "flat" }])
        updatePreview()
        return
    }

    const removeEffect = event.target.closest("[data-remove-effect]")
    if (removeEffect) {
        clearFeedback()
        const containerId = removeEffect.closest(".maintenance-buff-effect-rows")?.id ?? "buffEffectRows"
        const effects = readEffectRuleRows(containerId)
        effects.splice(Number(removeEffect.dataset.removeEffect), 1)
        renderEffectRuleRows(containerId, effects)
        updatePreview()
        return
    }

    const addBuffModifier = event.target.closest("[data-add-buff-modifier]")
    if (addBuffModifier) {
        clearFeedback()
        renderBuffModifierRows([
            ...readBuffModifierRows(),
            {
                operation: "multiplyResolvedValue",
                factor: 1.3,
                targetBuffIds: [],
                targetEffectIds: [],
                label: { zhCN: "" },
            },
        ])
        updatePreview()
        return
    }

    const removeBuffModifier = event.target.closest("[data-remove-buff-modifier]")
    if (removeBuffModifier) {
        clearFeedback()
        const modifiers = readBuffModifierRows()
        modifiers.splice(Number(removeBuffModifier.dataset.removeBuffModifier), 1)
        renderBuffModifierRows(modifiers)
        updatePreview()
        return
    }

    const addSkillTarget = event.target.closest("[data-add-skill-target]")
    if (addSkillTarget) {
        clearFeedback()
        const row = addSkillTarget.closest(".maintenance-buff-effect-row, .maintenance-stat-row")
        const targets = [...readSkillTargets(row), {}]
        row.querySelector("[data-effect-skill-targets]").outerHTML = skillTargetsHtml(targets)
        updatePreview()
        return
    }

    const removeSkillTarget = event.target.closest("[data-remove-skill-target]")
    if (removeSkillTarget) {
        clearFeedback()
        const row = removeSkillTarget.closest(".maintenance-buff-effect-row, .maintenance-stat-row")
        const targets = readSkillTargets(row)
        targets.splice(Number(removeSkillTarget.dataset.removeSkillTarget), 1)
        row.querySelector("[data-effect-skill-targets]").outerHTML = skillTargetsHtml(targets)
        updatePreview()
        return
    }

    const add = event.target.closest("[data-add-stat]")
    if (add) {
        clearFeedback()
        const id = add.dataset.addStat
        const stats = readStatRows(id)
        const container = document.getElementById(id)
        renderStatRows(id, [...stats, { stat: "atkFlat", value: 0, mode: "flat" }], {
            simple: container?.dataset.simple === "true",
            allowDamageModifiers: container?.dataset.allowDamageModifiers === "true",
        })
        updatePreview()
        return
    }

    const remove = event.target.closest("[data-remove-stat]")
    if (remove) {
        clearFeedback()
        const id = remove.closest("[data-stat-row]")?.dataset.statRow
        const stats = readStatRows(id)
        stats.splice(Number(remove.dataset.removeStat), 1)
        const container = document.getElementById(id)
        renderStatRows(id, stats, {
            simple: container?.dataset.simple === "true",
            allowDamageModifiers: container?.dataset.allowDamageModifiers === "true",
        })
        updatePreview()
    }
})
els.maintenanceForm.addEventListener("submit", async event => {
    event.preventDefault()
    try {
        setStatus("保存中", "idle")
        setFeedback("保存中", [], "idle")
        await saveCurrent()
    } catch (error) {
        const details = (error.details ?? String(error.message || error).split("\n").filter(Boolean))
            .map(friendlyValidationMessage)
        setFeedback("保存失败", details, "error")
        setSaveStrip("保存失败", details[0] ?? "请检查错误汇总", "error")
        setStatus("保存失败", "error")
    }
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        await loadCatalog()
        renderAll()
        setStatus("就绪", "success")
    } catch (error) {
        const message = errorMessage(error)
        setStatus("加载失败", "error")
        showErrorNotice({
            title: "维护数据加载失败",
            message,
        })
        console.error(error)
    }
}

bootstrap()
