import { evaluateFormulaExpression } from "./formulaEvaluator.js"
import * as SharedCombat from "./shared-combat.js"

const els = {
    status: document.getElementById("status"),
    agentSelect: document.getElementById("agentSelect"),
    coreSkillSelect: document.getElementById("coreSkillSelect"),
    wEngineSelect: document.getElementById("wEngineSelect"),
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
    damageLevelCoefficient: document.getElementById("damageLevelCoefficient"),
    damageTargetResistanceLabel: document.getElementById("damageTargetResistanceLabel"),
    damageTargetResistance: document.getElementById("damageTargetResistance"),
    damageTargetResistanceButtons: Array.from(document.querySelectorAll("[data-resistance-preset]")),
    damageSkillMultiplier: document.getElementById("damageSkillMultiplier"),
    damageSkillCategory: document.getElementById("damageSkillCategory"),
    damageSkillMove: document.getElementById("damageSkillMove"),
    damageSkillRow: document.getElementById("damageSkillRow"),
    damageSkillLevel: document.getElementById("damageSkillLevel"),
    damageCritMode: document.getElementById("damageCritMode"),
    damageFinalValue: document.getElementById("damageFinalValue"),
    damageWhiteBoxRows: document.getElementById("damageWhiteBoxRows"),
    combatBuffModal: document.getElementById("combatBuffModal"),
    closeCombatBuffModalBtn: document.getElementById("closeCombatBuffModalBtn"),
    combatBuffSearchInput: document.getElementById("combatBuffSearchInput"),
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
    physicalResIgnore: "物理抗性无视",
    fireResIgnore: "火抗性无视",
    iceResIgnore: "冰抗性无视",
    electricResIgnore: "电抗性无视",
    etherResIgnore: "以太抗性无视",
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    dmgBonus: "通用伤害加成",
    enemyDefReduction: "敌方减防率",
    enemyDefFlatReduction: "敌方固定减防",
    enemyResReduction: "敌方当前属性减抗",
    enemyPhysicalResReduction: "敌方物理减抗",
    enemyFireResReduction: "敌方火减抗",
    enemyIceResReduction: "敌方冰减抗",
    enemyElectricResReduction: "敌方电减抗",
    enemyEtherResReduction: "敌方以太减抗",
}

const ENUM_LABELS = {
    attribute: {
        physical: "物理属性",
        honed_edge: "凛刃",
        fire: "火属性",
        ice: "冰属性",
        electric: "电属性",
        ether: "以太属性",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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
    physicalDmg: "物理伤害加成%",
    fireDmg: "火属性伤害加成%",
    iceDmg: "冰属性伤害加成%",
    electricDmg: "电属性伤害加成%",
    etherDmg: "以太伤害加成%",
    dmgBonus: "通用伤害加成%",
    enemyDefReduction: "敌方减防率%",
    enemyResReduction: "敌方当前属性减抗%",
    enemyPhysicalResReduction: "敌方物理减抗%",
    enemyFireResReduction: "敌方火减抗%",
    enemyIceResReduction: "敌方冰减抗%",
    enemyElectricResReduction: "敌方电减抗%",
    enemyEtherResReduction: "敌方以太减抗%",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
]
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
]
const ELEMENT_DMG_KEYS = new Set(["physicalDmg", "fireDmg", "iceDmg", "electricDmg", "etherDmg"])
const OUT_OF_COMBAT_PANEL_BASE_ORDER = PANEL_ORDER.filter(key => key !== "dmgBonus")
const DEFAULT_CHECKED_COMBAT_SOURCE_TYPES = new Set(["self", "driveDisc4pc", "driveDisc4pcTeam", "wEngine", "wEngineTeam"])
const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
const DISC_SELECTION_STORAGE_KEY = "zzz-calculator.driveDiscSelections.v1"
const HOME_DISC_MODES = new Set(["manual", "loadout"])
const TEAMMATE_DRIVE_DISC_LIMIT = 2
const DEFAULT_DAMAGE_TARGET_PRESETS = [
    { id: "taichu-nightmare", name: { zhCN: "太初梦魇" }, defense: 476 },
    { id: "normal-boss", name: { zhCN: "普通 Boss" }, defense: 953 },
    { id: "wandering-hunter", name: { zhCN: "彷徨猎手" }, defense: 1588 },
]
const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794
const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether"]
const DAMAGE_ELEMENT_SHORT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
}
const RES_IGNORE_STAT_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
}
const RESISTANCE_PRESET_VALUES = new Set(["-20", "0", "20"])
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

let meta = null
let userDriveDiscStore = null
let activeDiscSlot = null
let activeCombatBuffTab = "agent"
const manuallyUncheckedDefaultCombatBuffIds = new Set()
const damageTargetResistanceByElement = Object.fromEntries(DAMAGE_ELEMENTS.map(element => [element, 0]))
let activeDamageResistanceElement = "physical"
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

function populateDamageTargetPresets() {
    if (!els.damageTargetPreset) {
        return
    }

    els.damageTargetPreset.innerHTML = ""
    for (const preset of damageTargetPresets()) {
        const option = document.createElement("option")
        option.value = preset.id
        option.textContent = `${nameOf(preset)}（${preset.defense}）`
        option.selected = preset.id === DEFAULT_DAMAGE_TARGET_PRESET_ID
        els.damageTargetPreset.appendChild(option)
    }

    const custom = document.createElement("option")
    custom.value = "custom"
    custom.textContent = "手动输入"
    els.damageTargetPreset.appendChild(custom)

    const preset = damageTargetPresetById(els.damageTargetPreset.value)
    els.damageTargetDefense.value = preset?.defense ?? 953
    els.damageLevelCoefficient.value = DEFAULT_DAMAGE_LEVEL_COEFFICIENT
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

function fillDamageSkillSelect(select, options, selected = "") {
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

    const categoryId = fillDamageSkillSelect(els.damageSkillCategory, [
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
        fillDamageSkillSelect(els.damageSkillMove, [["", "-"]])
        fillDamageSkillSelect(els.damageSkillRow, [["", "-"]])
        fillDamageSkillSelect(els.damageSkillLevel, [["", "-"]])
        return
    }

    const moveId = fillDamageSkillSelect(
        els.damageSkillMove,
        category.moves.map(move => [move.id, nameOf(move)]),
        preferredRef?.moveId ?? "",
    )
    const move = category.moves.find(item => item.id === moveId)
    const rows = damageSkillRows(move)
    const rowId = fillDamageSkillSelect(
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
    fillDamageSkillSelect(els.damageSkillLevel, levels, selectedLevel)
    syncDamageSkillMultiplierFromSelection()
}

function syncDamageDefenseToPreset() {
    const preset = damageTargetPresetById(els.damageTargetPreset.value)
    if (preset && els.damageTargetPreset.value !== "custom") {
        els.damageTargetDefense.value = preset.defense
    }
}

function syncDamagePresetFromDefense() {
    const defense = Number(els.damageTargetDefense.value)
    const matched = damageTargetPresets().find(preset => Number(preset.defense) === defense)
    els.damageTargetPreset.value = matched?.id ?? "custom"
}

function persistCurrentDamageResistanceInput() {
    if (!els.damageTargetResistance) {
        return
    }

    const value = Number(els.damageTargetResistance.value)
    if (Number.isFinite(value)) {
        damageTargetResistanceByElement[activeDamageResistanceElement] = value
    }
}

function syncDamageResistancePresetFromValue() {
    if (!els.damageTargetResistance || !els.damageTargetResistanceButtons?.length) {
        return
    }

    const value = Number(els.damageTargetResistance.value)
    const normalized = Number.isFinite(value) ? String(Number(value.toFixed(3))) : "custom"
    const preset = RESISTANCE_PRESET_VALUES.has(normalized)
        ? normalized
        : "custom"
    for (const button of els.damageTargetResistanceButtons) {
        const active = button.dataset.resistancePreset === preset
        button.classList.toggle("active", active)
        button.setAttribute("aria-pressed", String(active))
    }
    els.damageTargetResistance.hidden = preset !== "custom"
}

function syncDamageResistanceToPreset(value) {
    if (!els.damageTargetResistance) {
        return
    }

    if (value !== "custom") {
        els.damageTargetResistance.value = value
        persistCurrentDamageResistanceInput()
    } else {
        const currentValue = Number(els.damageTargetResistance.value)
        const normalized = Number.isFinite(currentValue) ? String(Number(currentValue.toFixed(3))) : "custom"
        if (!Number.isFinite(currentValue) || RESISTANCE_PRESET_VALUES.has(normalized)) {
            els.damageTargetResistance.value = 0
        }
        persistCurrentDamageResistanceInput()
    }
    syncDamageResistancePresetFromValue()
}

function syncDamageResistanceControlsToAgent() {
    if (!els.damageTargetResistance || !els.damageTargetResistanceLabel) {
        return
    }

    const nextElement = currentDamageElement()
    const elementChanged = nextElement !== activeDamageResistanceElement
    if (elementChanged) {
        activeDamageResistanceElement = nextElement
        els.damageTargetResistance.value = damageTargetResistanceByElement[nextElement] ?? 0
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
    els.damageTargetPreset.value = target.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID
    els.damageTargetDefense.value = target.defense ?? damageTargetPresetById(els.damageTargetPreset.value)?.defense ?? 953
    els.damageLevelCoefficient.value = target.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT
    els.damageSkillMultiplier.value = config.skillMultiplier ?? 100
    els.damageCritMode.value = config.critMode ?? "expected"
    populateDamageSkillControls(config.skillRef ?? null)

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
    els.damageTargetResistance.value = damageTargetResistanceByElement[damageElement] ?? 0
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

function localizedText(value) {
    return combatUi.localizedText(value)
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
    return meta?.agents.find(item => item.id === id)
}

function getWEngine(id) {
    return meta?.wEngines.find(item => item.id === id)
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
    return combatUi.loadHomeSelection()
}

function saveHomeSelection(selection) {
    combatUi.saveHomeSelection(selection)
}

function legacyDiscSelectionsForAgent(agentId) {
    const selections = readJsonStorage(DISC_SELECTION_STORAGE_KEY, {})
    return selections?.[agentId] && typeof selections[agentId] === "object"
        ? selections[agentId]
        : null
}

function validAgentId(agentId) {
    return getAgent(agentId)?.id ?? meta?.agents?.[0]?.id ?? ""
}

function validWEngineId(wEngineId) {
    return getWEngine(wEngineId)?.id ?? meta?.wEngines?.[0]?.id ?? ""
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

function loadoutIdForAgent(agentId) {
    const id = configForAgent(agentId).selectedLoadoutId ?? ""
    return driveDiscLoadoutsForAgent(agentId).some(loadout => loadout.id === id) ? id : ""
}

function loadoutDiscIdsForAgent(agentId, loadoutId = loadoutIdForAgent(agentId)) {
    const loadout = driveDiscLoadoutsForAgent(agentId).find(item => item.id === loadoutId)
    return loadout ? sanitizeDiscIdsBySlot(loadout.driveDiscIdsBySlot) : {}
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
    const byAgent = { ...selection.byAgent }
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(mode)
    const nextManualDriveDiscIdsBySlot = manualDriveDiscIdsBySlot === undefined
        ? manualDiscIdsFromSavedConfig(agentId)
        : sanitizeDiscIdsBySlot(manualDriveDiscIdsBySlot)
    const nextSelectedLoadoutId = selectedLoadoutId === undefined
        ? loadoutIdForAgent(agentId)
        : driveDiscLoadoutsForAgent(agentId).some(loadout => loadout.id === selectedLoadoutId)
            ? selectedLoadoutId
            : ""
    const driveDiscIdsBySlot = activeDiscIdsForConfig(
        agentId,
        driveDiscMode,
        nextManualDriveDiscIdsBySlot,
        nextSelectedLoadoutId,
    )

    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: validWEngineId(els.wEngineSelect.value),
        coreSkillLevel: validCoreSkillLevel(agent, els.coreSkillSelect.value),
        driveDiscMode,
        manualDriveDiscIdsBySlot: nextManualDriveDiscIdsBySlot,
        selectedLoadoutId: nextSelectedLoadoutId,
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(driveDiscIdsBySlot),
        combat: {
            ...(previousConfig.combat ?? {}),
            addedBuffs: sanitizeAddedCombatBuffs(previousConfig.combat?.addedBuffs),
        },
        damage: collectDamageConfig(),
    }

    saveHomeSelection({
        version: 1,
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
        const option = document.createElement("option")
        option.value = loadout.id
        option.textContent = `${loadout.name}${Number.isFinite(Number(loadout.score)) ? ` · ${Number(loadout.score).toFixed(0)}` : ""}`
        option.selected = loadout.id === selectedLoadoutId
        els.homeLoadoutSelect.appendChild(option)
    }

    els.homeLoadoutSelect.disabled = loadouts.length === 0
}

async function switchHomeDiscMode(mode) {
    const nextMode = normalizeHomeDiscMode(mode)
    setHomeDiscMode(nextMode)
    saveCurrentHomeSelection({ mode: nextMode })
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
}

function currentAddedCombatBuffs() {
    return combatConfigForAgent(els.agentSelect.value).addedBuffs
        .filter(isResolvableAddedCombatBuff)
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
    const byAgent = { ...selection.byAgent }
    const previousConfig = byAgent[agentId] ?? {}
    const driveDiscMode = normalizeHomeDiscMode(previousConfig.driveDiscMode)
    const manualDriveDiscIdsBySlot = manualDiscIdsFromSavedConfig(agentId)
    const selectedLoadoutId = loadoutIdForAgent(agentId)
    byAgent[agentId] = {
        ...previousConfig,
        wEngineId: validWEngineId(els.wEngineSelect.value),
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
            addedBuffs: sanitizeAddedCombatBuffs(addedBuffs),
        },
    }

    saveHomeSelection({
        version: 1,
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
        updater(runtime)
        return {
            ...item,
            runtime,
        }
    })
    saveCurrentAddedCombatBuffs(next)
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
    return new Set(["atk", "critRate", "critDmg", currentElementDmgKey(), "dmgBonus"])
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
    const selfStats = storedEffectStatText(effectStats(wEngineEffectSelfBuff(wEngine)))
    const teamStats = storedEffectStatText(effectStats(wEngineEffectTeamBuff(wEngine)))

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
            conditionLabel: localizedText(buff.conditionLabel) || buff.condition,
            stats: effectStats(buff),
            effects: buff.effects ?? null,
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
            stats: effectStats(buff),
            effects: buff.effects ?? null,
            coverage: buff.coverage ?? null,
        }))
    return [...fixedBuffs, ...cinemaBuffs]
}

function wEngineEquippedBuffs() {
    const wEngine = getWEngine(els.wEngineSelect.value)
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
            conditionLabel: item.buff.condition,
            stats: effectStats(item.buff),
            effects: item.buff.effects ?? null,
            coverage: item.buff.coverage ?? null,
            effectText: item.effectText,
        }))
}

function driveDisc4pcSetOptions() {
    return (meta?.driveDiscSets ?? [])
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
            sourceLabel: buff.sourceLabel,
            name: buff.name,
            description: buff.description,
            conditionLabel: buff.conditionLabel,
            stats: buff.stats ?? [],
            effects: buff.effects ?? null,
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
                coverage: teamBuff.coverage ?? null,
            }
        })
        .filter(Boolean)
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
            description: storedEffectStatText(item.stats),
        }
    }

    if (item?.sourceKind === "teammateDriveDisc4pc") {
        return teammateDriveDisc4pcCandidates().find(candidate => candidate.setId === item.setId) ?? item
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
    if (!els.combatSection) {
        return new Set()
    }

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

function renderCombatCheckboxList(container, buffs, checkedIds) {
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
        const stats = storedEffectRulesText(buff)
        detail.textContent = [buff.conditionLabel, stats].filter(Boolean).join(" · ") || "勾选后计入局内"
        copy.append(title, detail)
        row.append(input, copy)
        container.appendChild(row)
    }
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

        const title = document.createElement("h4")
        title.textContent = nameOf(group)
        section.appendChild(title)

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
            stats.className = "combat-check-stats"
            stats.textContent = `实际效果：${storedEffectRulesText(buff) || "-"}`

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

    for (const item of addedBuffs) {
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
        stats.textContent = storedEffectRulesText(buff, runtime) || "-"

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
        stats.className = "combat-added-stats"
        stats.textContent = alreadyAdded
            ? "已添加"
            : overTeammateSetLimit
                ? `队友 4 件套最多 ${TEAMMATE_DRIVE_DISC_LIMIT} 个`
                : storedEffectRulesText(candidate) || "-"

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

    if (candidate.sourceKind === "teammateDriveDisc4pc" && teammateDriveDiscAddedCount(addedBuffs) >= TEAMMATE_DRIVE_DISC_LIMIT) {
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

function renderCombatBuffControls() {
    if (!meta || !els.combatSection) {
        return
    }

    const checkedIds = checkedCombatBuffIds()
    const selfBuffs = [
        ...agentCombatBuffs(),
        ...combatBuffsByType("self"),
    ]

    renderCombatCheckboxList(els.selfCombatBuffs, selfBuffs, checkedIds)
    renderCombatCheckboxList(els.driveDiscCombatBuffs, ownDriveDisc4pcBuffs(), checkedIds)
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
            stat: stat.stat,
            value: stat.value,
            mode: stat.mode ?? "flat",
            basis: stat.basis ?? null,
        })))
}

function collectCombatBuffConfig() {
    const addedBuffs = currentAddedCombatBuffs()
    const activeBuffIds = [...checkedCombatBuffIds()]
    const runtimeInputs = {}
    for (const item of addedBuffs) {
        if (item.sourceKind === "teammate") {
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }

        if (item.sourceKind === "ownDriveDisc4pc") {
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }

        if (item.sourceKind === "wEngineTeam") {
            activeBuffIds.push(item.id)
            runtimeInputs[item.id] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
        }

        if (item.sourceKind === "teammateDriveDisc4pc") {
            runtimeInputs[`teammateDriveDisc4pc:${item.setId}`] = item.runtime ?? defaultRuntimeForBuff(resolveAddedCombatBuff(item))
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
        runtimeInputs,
    }
}

function collectDamageConfig() {
    persistCurrentDamageResistanceInput()
    const damageElement = currentDamageElement()
    const skillRef = readDamageSkillRef()
    return {
        skillMultiplier: Number(els.damageSkillMultiplier?.value ?? 100),
        ...(skillRef ? { skillRef } : {}),
        critMode: els.damageCritMode?.value ?? "expected",
        target: {
            presetId: els.damageTargetPreset?.value || DEFAULT_DAMAGE_TARGET_PRESET_ID,
            defense: Number(els.damageTargetDefense?.value ?? 953),
            levelCoefficient: Number(els.damageLevelCoefficient?.value ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT),
            resistanceByElement: {
                ...damageTargetResistanceByElement,
                [damageElement]: Number(els.damageTargetResistance?.value ?? 0),
            },
        },
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

function combatEffectText(item) {
    const label = item?.name ? nameOf(item) : effectLabel(item.key)
    const stats = effectStatText(item.resolvedStats?.length ? item.resolvedStats : item.stats)
    const conditionLabel = localizedText(item.conditionLabel) || item.conditionLabel
    const condition = conditionLabel ? ` · ${conditionLabel}` : ""
    return `${combatSourceLabel(item.sourceType)}｜${label}${stats ? `：${stats}` : ""}${condition}`
}

function renderDamageWhiteBox(damage) {
    if (!els.damageWhiteBoxRows || !els.damageFinalValue) {
        return
    }

    if (!damage) {
        els.damageFinalValue.textContent = "-"
        renderList(els.damageWhiteBoxRows, [])
        return
    }

    els.damageFinalValue.textContent = formatValue(damage.finalDamage ?? 0, "damage")
    els.damageWhiteBoxRows.innerHTML = ""

    for (const rowData of damage.whiteBoxRows ?? []) {
        const row = document.createElement("div")
        row.className = "damage-whitebox-row"
        row.innerHTML = `
            <div>
              <strong>${escapeHtml(rowData.label ?? "-")}</strong>
              <span>${escapeHtml(rowData.formula ?? "")}</span>
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
    const response = await api("/api/meta")
    meta = response
    populateSelect(els.agentSelect, response.agents, response.agents[0]?.id)
    populateSelect(els.wEngineSelect, response.wEngines, response.wEngines[0]?.id)
    populateDamageTargetPresets()
    syncDamageResistanceControlsToAgent()
}

async function loadUserDriveDiscStore() {
    userDriveDiscStore = await api("/api/user-drive-discs")
}

function applySelectionForAgent(agentId) {
    const agent = getAgent(agentId)
    const config = configForAgent(agentId)

    els.agentSelect.value = agentId
    els.wEngineSelect.value = validWEngineId(config.wEngineId)
    populateCoreSkillSelect(agent, validCoreSkillLevel(agent, config.coreSkillLevel))
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
    const wEngine = getWEngine(els.wEngineSelect.value)
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
        driveDiscs,
        combatBuffs: collectCombatBuffConfig(),
        damage: collectDamageConfig(),
    }

    const response = await api("/api/calculate/in-combat", {
        method: "POST",
        body: JSON.stringify(payload),
    })

    renderCalculationResult(response.data)
    setStatus("就绪", "success")
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
        await calculateNow("计算中", { refreshSelection: false })
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
    await calculateNow("计算中", { refreshSelection: false })
    return true
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
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.driveDiscInput.addEventListener("input", renderCurrentSelection)
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
        scheduleCalculate("计算中", { refreshSelection: false })
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
            setStatus("添加 Buff", "idle")
            if (addCombatBuffCandidateByKey(candidate.dataset.candidateKey)) {
                closeCombatBuffModal()
                renderCombatBuffControls()
                await calculate()
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

        setStatus("保存自定义 Buff", "idle")
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
        renderCombatBuffControls()
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
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
        setStatus(error.message, "error")
        console.error(error)
    }
}

bootstrap()
