const els = {
    status: document.getElementById("status"),
    agentSelect: document.getElementById("agentSelect"),
    coreSkillSelect: document.getElementById("coreSkillSelect"),
    wEngineSelect: document.getElementById("wEngineSelect"),
    driveDiscInput: document.getElementById("driveDiscInput"),
    calculateBtn: document.getElementById("calculateBtn"),
    baseTable: document.getElementById("baseTable"),
    bonusTable: document.getElementById("bonusTable"),
    panelTable: document.getElementById("panelTable"),
    panelSummary: document.getElementById("panelSummary"),
    inCombatPanelSummary: document.getElementById("inCombatPanelSummary"),
    inCombatPanelTable: document.getElementById("inCombatPanelTable"),
    inCombatBonusTable: document.getElementById("inCombatBonusTable"),
    inCombatActiveEffects: document.getElementById("inCombatActiveEffects"),
    scoreBox: document.getElementById("scoreBox"),
    appliedEffects: document.getElementById("appliedEffects"),
    ignoredEffects: document.getElementById("ignoredEffects"),
    rawResult: document.getElementById("rawResult"),
    discGrid: document.getElementById("discGrid"),
    discPicker: document.getElementById("discPicker"),
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
    teammateCombatBuffs: document.getElementById("teammateCombatBuffs"),
    ownDriveDisc4pcBuffs: document.getElementById("ownDriveDisc4pcBuffs"),
    bossCombatBuffs: document.getElementById("bossCombatBuffs"),
    fieldCombatBuffs: document.getElementById("fieldCombatBuffs"),
    teammateDriveDiscSet1: document.getElementById("teammateDriveDiscSet1"),
    teammateDriveDiscSet2: document.getElementById("teammateDriveDiscSet2"),
    manualAtkFlat: document.getElementById("manualAtkFlat"),
    manualAtkBasePct: document.getElementById("manualAtkBasePct"),
    manualAtkPanelPct: document.getElementById("manualAtkPanelPct"),
    manualHpBasePct: document.getElementById("manualHpBasePct"),
    manualPenRatio: document.getElementById("manualPenRatio"),
    manualDmgBonus: document.getElementById("manualDmgBonus"),
    manualElementDmgStat: document.getElementById("manualElementDmgStat"),
    manualElementDmg: document.getElementById("manualElementDmg"),
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
    energyRegen: "能量自动回复",
    energyRegenPct: "能量自动回复",
    physicalDmg: "物理伤害加成",
    fireDmg: "火属性伤害加成",
    iceDmg: "冰属性伤害加成",
    electricDmg: "电属性伤害加成",
    etherDmg: "以太伤害加成",
    dmgBonus: "伤害加成",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
])

const PERCENT_MODE_KEY = {
    hp: "hpPct",
    atk: "atkPct",
    def: "defPct",
    impact: "impactPct",
    energyRegen: "energyRegenPct",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
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
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "dmgBonus",
]
const PANEL_SUMMARY_KEYS = ["hp", "atk", "def", "critRate", "critDmg", "impact"]
const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
const DISC_SELECTION_STORAGE_KEY = "zzz-calculator.driveDiscSelections.v1"

let meta = null
let userDriveDiscStore = null
let activeDiscSlot = null

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
}

function statLabel(key) {
    return FALLBACK_LABELS[key] ?? meta?.statRules?.statDisplay?.[key]?.label ?? key
}

function enumLabel(type, value) {
    return ENUM_LABELS[type]?.[value] ?? value ?? "-"
}

function rarityLabel(value) {
    return value ? `${value}级` : "-"
}

function coreSkillDefaultLevel(agent) {
    const levels = agent?.coreSkill?.levels ?? []
    return agent?.coreSkill?.defaultLevel ?? levels.at(-1)?.level ?? "none"
}

function coreSkillLevelLabel(agent, level) {
    if (!agent?.coreSkill || level === "none") {
        return "未强化"
    }

    const item = agent.coreSkill.levels?.find(coreLevel => coreLevel.level === level)
    return item ? item.label ?? `强化${item.level}` : "未强化"
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
    if (!agent?.coreSkill?.levels?.length) {
        return "未建模"
    }

    const activeIndex = agent.coreSkill.levels.findIndex(level => level.level === selectedLevel)
    if (activeIndex < 0) {
        return "未强化"
    }

    const totals = new Map()
    for (const level of agent.coreSkill.levels.slice(0, activeIndex + 1)) {
        for (const stat of level.stats ?? []) {
            totals.set(stat.stat, (totals.get(stat.stat) ?? 0) + Number(stat.value ?? 0))
        }
    }

    const text = [...totals.entries()]
        .map(([stat, value]) => `${statLabel(stat)} +${formatValue(value, stat)}`)
        .join(" / ")

    return `${coreSkillLevelLabel(agent, selectedLevel)}${text ? ` · ${text}` : ""}`
}

function agentAttributeText(agent) {
    const attribute = enumLabel("attribute", agent.attribute)
    if (agent.damageElement && agent.damageElement !== agent.attribute) {
        return `${attribute}（${enumLabel("attribute", agent.damageElement)}结算）`
    }

    return attribute
}

function formatValue(value, key = "") {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "-"
    }

    if (PERCENT_KEYS.has(key)) {
        const percent = value * 100
        return `${Number(percent.toFixed(1))}%`
    }

    if (Number.isInteger(value)) {
        return String(value)
    }

    return String(Number(value.toFixed(3)))
}

function formatContextStatValue(stat, value, context = {}) {
    const displayKey = context.percentMode ? (PERCENT_MODE_KEY[stat] ?? stat) : stat
    return formatValue(value, displayKey)
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
        return part === "passive" ? `${nameOf(wEngine)} 被动` : key
    }

    if (key?.startsWith("driveDisc4pc:")) {
        const setId = key.slice("driveDisc4pc:".length)
        return `${nameOf(getDriveDiscSet(setId))} 4件套`
    }

    if (key?.startsWith("teammateDriveDisc4pc:")) {
        const [, teammateIndex, setId] = key.split(":")
        return `队友${teammateIndex} ${nameOf(getDriveDiscSet(setId))} 4件套`
    }

    if (key?.startsWith("manual:")) {
        return "手动修正"
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

function appliedEffectText(item) {
    const stats = effectStatText(item.stats)
    return stats ? `${effectLabel(item.key)}：${stats}` : effectLabel(item.key)
}

function nameOf(item) {
    return item?.name?.zhCN ?? item?.name?.en ?? item?.id ?? "-"
}

function localizedText(value) {
    if (!value) {
        return ""
    }

    if (typeof value === "string") {
        return value
    }

    return value.zhCN ?? value.en ?? ""
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
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
    } catch {
        return fallback
    }
}

function loadHomeSelection() {
    const value = readJsonStorage(HOME_SELECTION_STORAGE_KEY, null)
    if (!value || typeof value !== "object") {
        return { version: 1, currentAgentId: null, byAgent: {} }
    }

    return {
        version: 1,
        currentAgentId: value.currentAgentId ?? null,
        byAgent: value.byAgent && typeof value.byAgent === "object" ? value.byAgent : {},
    }
}

function saveHomeSelection(selection) {
    localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify({
        version: 1,
        currentAgentId: selection.currentAgentId ?? null,
        byAgent: selection.byAgent ?? {},
    }))
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
    return loadHomeSelection().byAgent?.[agentId] ?? {}
}

function selectedDiscIdsFromSavedConfig(agentId) {
    const selection = loadHomeSelection()
    const config = selection.byAgent?.[agentId]
    if (config && Object.prototype.hasOwnProperty.call(config, "driveDiscIdsBySlot")) {
        return sanitizeDiscIdsBySlot(config.driveDiscIdsBySlot)
    }

    const legacy = sanitizeDiscIdsBySlot(legacyDiscSelectionsForAgent(agentId))
    if (Object.keys(legacy).length > 0) {
        return legacy
    }

    return equippedDriveDiscIdsForAgent(agentId)
}

function saveCurrentHomeSelection({ driveDiscIdsBySlot = selectedDiscIdsFromPicker() } = {}) {
    const agentId = validAgentId(els.agentSelect.value)
    if (!agentId) {
        return
    }

    const agent = getAgent(agentId)
    const selection = loadHomeSelection()
    const byAgent = { ...selection.byAgent }
    byAgent[agentId] = {
        wEngineId: validWEngineId(els.wEngineSelect.value),
        coreSkillLevel: validCoreSkillLevel(agent, els.coreSkillSelect.value),
        driveDiscIdsBySlot: sanitizeDiscIdsBySlot(driveDiscIdsBySlot),
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

function discOptionText(disc) {
    const set = disc.setName || nameOf(getDriveDiscSet(disc.setId))
    const sequence = disc.source?.sequence ? `#${disc.source.sequence} ` : ""
    const mainStat = statLabel(disc.mainStat?.stat)
    const subStats = (disc.subStats ?? [])
        .map(item => `${statLabel(item.stat)} ${formatContextStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
        .join(" / ")

    return `${sequence}${set} · ${disc.rarity}+${disc.level} · ${mainStat}${subStats ? ` · ${subStats}` : ""}`
}

function renderDiscPicker(agentId) {
    if (!els.discPicker) {
        return
    }

    const allDiscs = userDriveDiscStore?.driveDiscs ?? []
    const selectedIds = selectedDiscIdsForAgent(agentId)
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
    const selectedIds = selectedDiscIdsForAgent(els.agentSelect.value)
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
                statLabel(disc.mainStat?.stat),
                disc.mainStat?.label,
                ...(disc.subStats ?? []).flatMap(item => [statLabel(item.stat), item.label]),
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
    const selectedId = selectedDiscIdsForAgent(els.agentSelect.value)[String(activeDiscSlot)]
    els.homeDiscOptionList.innerHTML = ""
    els.homeDiscEmpty.hidden = discs.length !== 0

    for (const disc of discs) {
        const set = driveDiscSetForDisc(disc)
        const subStats = (disc.subStats ?? [])
            .map(item => `${statLabel(item.stat)} ${formatContextStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
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
                <strong>${escapeHtml(`${statLabel(disc.mainStat?.stat)} ${formatContextStatValue(disc.mainStat?.stat, disc.mainStat?.value, { percentMode: disc.mainStat?.mode === "pct" })}`)}</strong>
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
        ...selectedDiscIdsForAgent(els.agentSelect.value),
        [String(activeDiscSlot)]: discId,
    }
    saveCurrentHomeSelection({ driveDiscIdsBySlot: next })
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
    closeHomeDiscModal()
}

async function clearHomeDiscSlot() {
    if (!activeDiscSlot) {
        return
    }

    const next = { ...selectedDiscIdsForAgent(els.agentSelect.value) }
    delete next[String(activeDiscSlot)]
    saveCurrentHomeSelection({ driveDiscIdsBySlot: next })
    loadEquippedDriveDiscsForSelectedAgent()
    await calculate()
    closeHomeDiscModal()
}

function renderOrderedKV(container, obj, order) {
    container.innerHTML = ""

    for (const key of order) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            continue
        }

        const row = document.createElement("div")
        row.className = "kv-row"
        row.innerHTML = `<span>${statLabel(key)}</span><strong>${formatValue(obj[key], key)}</strong>`
        container.appendChild(row)
    }
}

function renderPanelSummaryTo(container, panel) {
    container.innerHTML = ""
    for (const key of PANEL_SUMMARY_KEYS) {
        const item = document.createElement("div")
        item.className = "summary-item"
        item.innerHTML = `<span>${statLabel(key)}</span><strong>${formatValue(panel[key], key)}</strong>`
        container.appendChild(item)
    }
}

function renderPanelSummary(panel) {
    renderPanelSummaryTo(els.panelSummary, panel)
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
            value: advanced ? `${statLabel(advanced.stat)} ${formatContextStatValue(advanced.stat, advanced.value, { percentMode: advanced.mode === "pct" })}` : "-",
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
    const buff = wEngineEffectBuff(wEngine)
    const stats = effectStatText(effectStats(buff))

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

    if (stats) {
        const buffLine = document.createElement("p")
        buffLine.className = "weapon-effect-buff"
        buffLine.textContent = `局内 Buff：${stats}`
        body.appendChild(buffLine)
    }

    els.wEngineEffect.append(head, body)
}

function effectStats(effect) {
    return Array.isArray(effect?.stats)
        ? effect.stats
        : effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
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

function wEngineEffectBuff(wEngine) {
    return wEngineEffectData(wEngine)?.buff ?? null
}

function combatBuffsByType(sourceType) {
    return (meta?.combatBuffs ?? []).filter(item => item.sourceType === sourceType)
}

function wEnginePassiveBuff() {
    const wEngine = getWEngine(els.wEngineSelect.value)
    const effect = wEngineEffectData(wEngine)
    const buff = wEngineEffectBuff(wEngine)
    if (!buff || buff.scope !== "inCombat") {
        return null
    }

    return {
        id: `wEngine:${wEngine.id}.passive`,
        sourceType: "self",
        name: effect?.name ?? buff.name ?? wEngine.name,
        conditionLabel: localizedText(effect?.requirement?.label) || buff.condition,
        stats: effectStats(buff),
    }
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
        .filter(set => set?.fourPiece?.scope === "inCombat")
        .map(set => ({
            id: `driveDisc4pc:${set.id}`,
            sourceType: "driveDisc4pc",
            name: set.name,
            conditionLabel: set.fourPiece?.condition,
            stats: effectStats(set.fourPiece),
        }))
}

function driveDisc4pcSetOptions() {
    return (meta?.driveDiscSets ?? [])
        .filter(set => set.fourPiece?.scope === "inCombat")
        .sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
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
        input.checked = checkedIds.has(buff.id)

        const copy = document.createElement("span")
        copy.className = "combat-check-copy"
        const title = document.createElement("strong")
        title.textContent = nameOf(buff)
        const detail = document.createElement("span")
        const stats = effectStatText(buff.stats)
        detail.textContent = [buff.conditionLabel, stats].filter(Boolean).join(" · ") || "勾选后计入局内"
        copy.append(title, detail)
        row.append(input, copy)
        container.appendChild(row)
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

function renderCombatBuffControls() {
    if (!meta || !els.combatSection) {
        return
    }

    const checkedIds = checkedCombatBuffIds()
    const teammateSet1 = els.teammateDriveDiscSet1.value
    const teammateSet2 = els.teammateDriveDiscSet2.value
    const selfBuffs = [
        ...combatBuffsByType("self"),
        wEnginePassiveBuff(),
    ].filter(Boolean)

    renderCombatCheckboxList(els.selfCombatBuffs, selfBuffs, checkedIds)
    renderCombatCheckboxList(els.teammateCombatBuffs, combatBuffsByType("teammate"), checkedIds)
    renderCombatCheckboxList(els.ownDriveDisc4pcBuffs, ownDriveDisc4pcBuffs(), checkedIds)
    renderCombatCheckboxList(els.bossCombatBuffs, combatBuffsByType("boss"), checkedIds)
    renderCombatCheckboxList(els.fieldCombatBuffs, combatBuffsByType("field"), checkedIds)
    renderDriveDisc4pcSelect(els.teammateDriveDiscSet1, teammateSet1)
    renderDriveDisc4pcSelect(els.teammateDriveDiscSet2, teammateSet2)
}

function percentInputValue(input) {
    const value = Number(input?.value ?? 0)
    return Number.isFinite(value) ? value / 100 : 0
}

function numberInputValue(input) {
    const value = Number(input?.value ?? 0)
    return Number.isFinite(value) ? value : 0
}

function manualStat(id, label, stat, value, mode = "flat", basis = null) {
    if (!Number.isFinite(value) || value === 0) {
        return null
    }

    return {
        id,
        label,
        stat,
        value,
        mode,
        basis,
    }
}

function collectManualStats() {
    return [
        manualStat("atkFlat", "手动固定攻击力", "atkFlat", numberInputValue(els.manualAtkFlat)),
        manualStat("atkPctBase", "手动基础攻击力%", "atkPct", percentInputValue(els.manualAtkBasePct), "pct", "baseAtk"),
        manualStat("atkPctOutOfCombat", "手动局外攻击力%", "atkPct", percentInputValue(els.manualAtkPanelPct), "pct", "outOfCombatAtk"),
        manualStat("hpPctBase", "手动基础生命值%", "hpPct", percentInputValue(els.manualHpBasePct), "pct", "baseHp"),
        manualStat("penRatio", "手动穿透率", "penRatio", percentInputValue(els.manualPenRatio)),
        manualStat("dmgBonus", "手动通用伤害", "dmgBonus", percentInputValue(els.manualDmgBonus)),
        manualStat("elementDmg", `手动${statLabel(els.manualElementDmgStat.value)}`, els.manualElementDmgStat.value, percentInputValue(els.manualElementDmg)),
    ].filter(Boolean)
}

function collectCombatBuffConfig() {
    return {
        activeBuffIds: [...checkedCombatBuffIds()],
        teammateDriveDiscSetIds: [
            els.teammateDriveDiscSet1.value,
            els.teammateDriveDiscSet2.value,
        ].filter(Boolean),
        manualStats: collectManualStats(),
    }
}

function combatSourceLabel(sourceType) {
    const labels = {
        self: "自身",
        teammate: "队友",
        driveDisc4pc: "驱动盘",
        boss: "Boss",
        field: "场地",
        manual: "手动",
    }
    return labels[sourceType] ?? sourceType ?? "局内"
}

function combatEffectText(item) {
    const label = item?.name ? nameOf(item) : effectLabel(item.key)
    const stats = effectStatText(item.resolvedStats?.length ? item.resolvedStats : item.stats)
    const condition = item.conditionLabel ? ` · ${item.conditionLabel}` : ""
    return `${combatSourceLabel(item.sourceType)}｜${label}${stats ? `：${stats}` : ""}${condition}`
}

function ignoredCombatEffectText(item) {
    if (typeof item === "string") {
        return effectLabel(item)
    }

    const reasonLabels = {
        missingEffect: "缺少效果数据",
        notInCombat: "不是局内效果",
        specialtyMismatch: "音擎特性不匹配",
        missingSet: "套装不存在",
        notEquipped4pc: "当前未装备 4 件套",
    }
    return `${effectLabel(item.key)}：${reasonLabels[item.reason] ?? item.reason ?? "已忽略"}`
}

function renderInCombatResult(inCombat) {
    if (!inCombat) {
        renderPanelSummaryTo(els.inCombatPanelSummary, {})
        renderOrderedKV(els.inCombatPanelTable, {}, PANEL_ORDER)
        renderOrderedKV(els.inCombatBonusTable, {}, COMBAT_BONUS_ORDER)
        renderList(els.inCombatActiveEffects, [])
        return
    }

    renderPanelSummaryTo(els.inCombatPanelSummary, inCombat.panel)
    renderOrderedKV(els.inCombatPanelTable, inCombat.panel, PANEL_ORDER)
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
            .map(item => `${statLabel(item.stat)} ${formatContextStatValue(item.stat, item.value, { percentMode: item.mode === "pct" })}`)
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
                <div class="disc-main">${disc ? `${statLabel(disc.mainStat.stat)} ${formatContextStatValue(disc.mainStat.stat, disc.mainStat.value, { percentMode: disc.mainStat.mode === "pct" })}` : "添加驱动盘"}</div>
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
    loadEquippedDriveDiscsForSelectedAgent()
}

function restoreHomeSelection() {
    const selection = loadHomeSelection()
    const agentId = validAgentId(selection.currentAgentId)
    applySelectionForAgent(agentId)
    saveCurrentHomeSelection({ driveDiscIdsBySlot: selectedDiscIdsForAgent(agentId) })
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

function renderCurrentSelection() {
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
    renderDiscGrid(discs)
    renderCombatBuffControls()
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

    renderOrderedKV(els.baseTable, outOfCombat.base, BASE_ORDER)
    renderOrderedKV(els.bonusTable, outOfCombat.panel, PANEL_ORDER)
    renderOrderedKV(els.panelTable, outOfCombat.bonusTotals, BONUS_ORDER)
    renderPanelSummary(outOfCombat.panel)
    renderInCombatResult(inCombat)
    renderList(els.appliedEffects, outOfCombat.appliedEffects.map(appliedEffectText), "good")
    renderList(els.ignoredEffects, [
        ...outOfCombat.ignoredEffects.map(effectLabel),
        ...(inCombat?.ignoredEffects ?? []).map(ignoredCombatEffectText),
    ], "muted")
    els.scoreBox.textContent = formatValue(outOfCombat.simpleTargetScore)
    els.rawResult.textContent = JSON.stringify(data, null, 2)
}

async function calculate() {
    const driveDiscs = parseDriveDiscs()
    const agent = getAgent(els.agentSelect.value)
    const coreSkillLevel = populateCoreSkillSelect(agent, els.coreSkillSelect.value)
    renderCurrentSelection()
    const payload = {
        agentId: els.agentSelect.value,
        coreSkillLevel,
        wEngineId: els.wEngineSelect.value,
        driveDiscs,
        combatBuffs: collectCombatBuffConfig(),
    }

    const response = await api("/api/calculate/in-combat", {
        method: "POST",
        body: JSON.stringify(payload),
    })

    renderCalculationResult(response.data)
    setStatus("就绪", "success")
}

els.agentSelect.addEventListener("change", async () => {
    try {
        setStatus("载入角色装备", "idle")
        applySelectionForAgent(validAgentId(els.agentSelect.value))
        saveCurrentHomeSelection({ driveDiscIdsBySlot: selectedDiscIdsForAgent(els.agentSelect.value) })
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
    if (!event.target.matches("input[data-combat-buff-id], select")) {
        return
    }

    try {
        setStatus("计算中", "idle")
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.combatSection.addEventListener("input", async event => {
    if (!event.target.matches("input[type='number']")) {
        return
    }

    try {
        setStatus("计算中", "idle")
        await calculate()
    } catch (error) {
        setStatus(error.message, "error")
    }
})
els.discGrid.addEventListener("click", event => {
    const card = event.target.closest(".disc-card[data-slot]")
    if (card) {
        openHomeDiscModal(card.dataset.slot)
    }
})
els.discPicker.addEventListener("change", async event => {
    if (!event.target.matches("select[data-slot]")) {
        return
    }

    try {
        setStatus("保存驱动盘选择", "idle")
        saveCurrentHomeSelection({ driveDiscIdsBySlot: selectedDiscIdsFromPicker() })
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
