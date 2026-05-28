import { validateMaintenanceItem } from "./maintenanceValidation.js"

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
    buffs: {
        title: "Buff 资料",
        endpoint: "combat-buffs",
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
    ["honed_edge", "凛刃"],
]
const SPECIALTY_OPTIONS = [
    ["attack", "强攻"],
    ["stun", "击破"],
    ["anomaly", "异常"],
    ["support", "支援"],
    ["defense", "防护"],
    ["rupture", "命破"],
]
const SOURCE_TYPE_OPTIONS = [
    ["teammate", "队友 Buff"],
    ["self", "自身 Buff"],
    ["boss", "Boss / 敌方效果"],
    ["field", "场地 Buff"],
    ["manual", "通用 Buff"],
]
const EFFECT_SCOPE_OPTIONS = [
    ["outOfCombat", "局外"],
    ["inCombat", "局内"],
]
const STAT_OPTIONS = [
    ["atkFlat", "固定攻击力", "flat"],
    ["atkPct", "百分比攻击力%", "pct"],
    ["hpFlat", "固定生命值", "flat"],
    ["hpPct", "百分比生命值%", "pct"],
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
    ["dmgBonus", "通用伤害加成%", "percentFlat"],
    ["physicalDmg", "物理伤害加成%", "percentFlat"],
    ["fireDmg", "火属性伤害加成%", "percentFlat"],
    ["iceDmg", "冰属性伤害加成%", "percentFlat"],
    ["electricDmg", "电属性伤害加成%", "percentFlat"],
    ["etherDmg", "以太伤害加成%", "percentFlat"],
    ["enemyDefReduction", "敌方减防率%", "percentFlat"],
    ["enemyDefFlatReduction", "敌方固定减防", "flat"],
    ["enemyResReduction", "敌方当前属性减抗%", "percentFlat"],
    ["enemyPhysicalResReduction", "敌方物理减抗%", "percentFlat"],
    ["enemyFireResReduction", "敌方火减抗%", "percentFlat"],
    ["enemyIceResReduction", "敌方冰减抗%", "percentFlat"],
    ["enemyElectricResReduction", "敌方电减抗%", "percentFlat"],
    ["enemyEtherResReduction", "敌方以太减抗%", "percentFlat"],
]
const STAT_LABELS = Object.fromEntries(STAT_OPTIONS.map(([key, label]) => [key, label]))
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "enemyDefReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
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

let catalog = null
let activeKind = "agents"
let selectedKey = ""
let draftCounter = 0
const DRAFT_STORAGE_KEY = "zzz_maintenance_drafts_v1"
const DRAFT_KIND_KEYS = ["agents", "agentSkills", "wEngines", "driveDiscSets", "buffs"]
let drafts = loadDrafts()
const unsavedEdits = new Map()
let isRenderingEditor = false

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
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

    return {
        id: "",
        maintenanceType: "teammate",
        teammateId: "",
        teammateName: { zhCN: "未命名" },
        source: { zhCN: "" },
        description: { zhCN: "" },
        scope: "inCombat",
        effects: [],
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
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

    return item?.name?.zhCN ?? item?.name?.en ?? item?.zhCN ?? item?.en ?? item?.id ?? "-"
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

    const option = STAT_OPTIONS.find(([key]) => key === stat)
    if (option?.[2] === "pct") {
        return "pct"
    }

    return "flat"
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

function rawCollections() {
    return {
        agents: catalog?.agents?.agents ?? [],
        agentSkills: catalog?.agentSkills?.agentSkills ?? [],
        wEngines: catalog?.wEngines?.wEngines ?? [],
        driveDiscSets: catalog?.driveDiscSets?.sets ?? [],
        buffs: [
            ...(catalog?.combatBuffs?.teammates ?? []).flatMap(teammate => (teammate.buffs ?? []).map(buff => ({
                ...buff,
                maintenanceType: "teammate",
                teammateId: teammate.id,
                teammateName: teammate.name,
            }))),
            ...(catalog?.combatBuffs?.buffs ?? []).map(buff => ({
                ...buff,
                maintenanceType: "generic",
            })),
        ],
    }
}

function collectionForActiveKind() {
    const records = rawCollections()[activeKind] ?? []
    return [
        ...activeDraftEntries().map(draftRecord),
        ...records.map(item => {
            const key = baseRecordKey(item)
            const edit = unsavedEdits.get(sessionKey(activeKind, key))
            return edit
                ? { ...item, ...structuredClone(edit), __sessionKey: key }
                : { ...item, __sessionKey: key }
        }),
    ]
}

function baseRecordKey(record) {
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

function editorRecordFromPayload(payload) {
    if (activeKind !== "buffs" || !payload?.teammate || !payload?.buff) {
        return stripDraftMetadata(payload)
    }

    return {
        ...payload.buff,
        maintenanceType: "teammate",
        teammateId: payload.teammate.id,
        teammateName: payload.teammate.name,
        sourceType: "teammate",
        source: payload.buff.source,
        description: payload.buff.description,
        scope: payload.buff.scope,
        effects: payload.buff.effects ?? [],
        ...(payload.buff.coverage ? { coverage: payload.buff.coverage } : {}),
    }
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

function mainStatChoiceMarkup(slot, selected = [], datasetName = "preferred-main-stat") {
    const selectedSet = new Set(selected)
    return driveDiscMainStatPool(slot).map(stat => `
        <label class="main-stat-choice${selectedSet.has(stat) ? " active" : ""}">
          <input type="checkbox" data-${datasetName}="${escapeHtml(String(slot))}" value="${escapeHtml(stat)}"${selectedSet.has(stat) ? " checked" : ""}>
          <span>${escapeHtml(statLabel(stat))}</span>
        </label>
    `).join("")
}

function statsSummary(stats = []) {
    return stats.map(item => {
        const raw = percentInputValue(item.stat, Number(item.value ?? 0))
        const suffix = PERCENT_VALUE_STATS.has(item.stat) ? "%" : ""
        return `${statLabel(item.stat)} +${raw}${suffix}`
    }).join(" / ")
}

function effectStats(effect) {
    if (Array.isArray(effect?.stats)) {
        return effect.stats
    }

    if (Array.isArray(effect?.effects)) {
        return effect.effects
            .filter(rule => (rule.type ?? "fixed") === "fixed")
            .map(rule => ({
                stat: rule.stat,
                value: rule.value,
                mode: rule.mode ?? "flat",
                basis: rule.basis ?? null,
                label: rule.label ?? null,
            }))
    }

    return effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
}

function effectRules(effect) {
    if (Array.isArray(effect?.effects)) {
        return effect.effects
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

function effectsSummary(item = {}) {
    return effectRules(item).map(rule => {
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
    }).join(" / ")
}

function renderList() {
    const search = els.searchInput.value.trim().toLowerCase()
    const records = collectionForActiveKind().filter(item => {
        const haystack = [
            item.id,
            nameOf(item),
            localized(item.source),
            localized(item.sourceLabel),
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
            ? (activeKind === "buffs" && item.maintenanceType === "teammate"
                ? nameOf(item.teammateName)
                : nameOf(item))
            : activeKind === "buffs" && item.maintenanceType === "teammate"
                ? `${nameOf(item.teammateName)}｜${localized(item.source) || nameOf(item)}`
                : nameOf(item)
        const detail = item.__isDraft
            ? `草稿 · ${item.id || "尚未填写 ID"}`
            : activeKind === "buffs"
            ? effectsSummary(item)
            : item.id

        button.innerHTML = `
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
    container.dataset.simple = simple ? "true" : "false"
    container.innerHTML = ""
    const rows = stats.length ? stats : [{ stat: "atkFlat", value: 0, mode: "flat", basis: "" }]
    rows.forEach((stat, index) => {
        const row = document.createElement("div")
        row.className = "maintenance-stat-row"
        row.dataset.statRow = containerId
        row.innerHTML = `
            <label class="field">
              ${fieldLabel("增幅类型", true)}
              <select data-stat-key>${selectOptions(STAT_OPTIONS.map(([key, label]) => [key, label]), stat.stat)}</select>
            </label>
            <label class="field">
              ${fieldLabel(`数值${PERCENT_VALUE_STATS.has(stat.stat) ? "（15 表示 15%）" : ""}`, true)}
              <input data-stat-value type="number" step="0.01" value="${escapeHtml(percentInputValue(stat.stat, Number(stat.value ?? 0)))}">
            </label>
            <label class="field"${simple ? " hidden" : ""}>
              ${fieldLabel("计算方式", true)}
              <select data-stat-mode>
                ${selectOptions([["flat", "直接加到面板"], ["pct", "按基准换算"]], stat.mode ?? modeForStat(stat.stat))}
              </select>
            </label>
            <label class="field"${simple ? " hidden" : ""}>
              <span>基准</span>
              <select data-stat-basis>${selectOptions(BASIS_OPTIONS, stat.basis ?? "")}</select>
            </label>
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
        .map(row => {
            const stat = row.querySelector("[data-stat-key]")?.value
            const mode = row.querySelector("[data-stat-mode]")?.value || modeForStat(stat)
            const basis = row.querySelector("[data-stat-basis]")?.value || null
            return {
                stat,
                value: inputToStoredValue(stat, row.querySelector("[data-stat-value]")?.value),
                mode,
                ...(basis ? { basis } : {}),
            }
        })
        .filter(item => item.stat && Number.isFinite(item.value))
}

function statRowsToFixedEffects(stats = []) {
    return stats.map((stat, index) => ({
        id: stat.id ?? `effect-${index + 1}`,
        type: "fixed",
        stat: stat.stat,
        value: stat.value,
        mode: stat.mode ?? "flat",
        ...(stat.basis ? { basis: stat.basis } : {}),
        ...(stat.label ? { label: stat.label } : {}),
    }))
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
          <div id="${escapeHtml(containerId)}" class="maintenance-stat-rows" data-simple="${simple}"></div>
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
          <div id="${escapeHtml(containerId)}" class="maintenance-stat-rows"></div>
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
        renderStatRows(cinemaBuffStatContainerId(index), effectStats(buff))
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
            <label class="field"><span>伤害结算属性</span><select id="damageElement"><option value="">同角色属性</option>${selectOptions(ATTRIBUTE_OPTIONS, agent.damageElement)}</select></label>
            <label class="field">${fieldLabel("特性", true)}<select id="specialty">${selectOptions(SPECIALTY_OPTIONS, agent.specialty)}</select></label>
            <label class="field"><span>阵营</span><input id="faction" value="${escapeHtml(agent.faction ?? "")}"></label>
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
    renderStatRows("corePassiveStats", effectStats(agent.combatBuffs?.corePassive))
    renderStatRows("additionalAbilityStats", effectStats(agent.combatBuffs?.additionalAbility))
    renderCinemaBuffRows(cinemaBuffsOf(agent))
    updatePreview()
}

function readPreferredDriveDiscs() {
    const mainStatLimits = {}
    for (const slot of [4, 5, 6]) {
        mainStatLimits[String(slot)] = [...els.maintenanceForm.querySelectorAll(`input[data-preferred-main-stat="${slot}"]:checked`)]
            .map(input => input.value)
            .filter(Boolean)
    }
    return Object.values(mainStatLimits).some(values => values.length)
        ? { mainStatLimits }
        : null
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

    return item
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
          <h3>技能分类 JSON</h3>
          <label class="field">
            <span>categories</span>
            <textarea id="agentSkillCategoriesJson" spellcheck="false">${escapeHtml(JSON.stringify(agentSkill.categories ?? [], null, 2))}</textarea>
          </label>
        </section>
    `
    updatePreview()
}

function buildAgentSkill() {
    const sourceUrl = document.getElementById("sourceUrl")?.value.trim() ?? ""
    return {
        ...(selectedCleanRecord() ?? {}),
        id: document.getElementById("recordId").value.trim(),
        agentId: document.getElementById("agentSkillAgentId").value,
        name: readLocalizedZh("name"),
        categories: JSON.parse(document.getElementById("agentSkillCategoriesJson")?.value.trim() || "[]"),
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
        effect: { name: { zhCN: "音擎效果" }, selfBuff: { scope: "inCombat", effects: [] }, teamBuff: null },
    }
    const selfBuff = wEngine.effect?.selfBuff ?? wEngine.effect?.buff
    const teamBuff = wEngine.effect?.teamBuff

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
    `
    renderStatRows("advancedStatRows", wEngine.level60?.advancedStat ? [wEngine.level60.advancedStat] : [], { simple: true })
    renderEffectRuleRows("wEngineSelfBuffRules", effectRules(selfBuff))
    renderEffectRuleRows("wEngineTeamBuffRules", effectRules(teamBuff))
    updatePreview()
}

function buildWEngine() {
    const advancedStats = readStatRows("advancedStatRows").filter(item => item.stat)
    const validBuffRule = item => {
        if (item.type === "derived") {
            return item.ratio !== 0
        }
        if (item.type === "formula") {
            return String(item.formula?.expression ?? "").trim()
        }
        return Number(item.value ?? item.valuePerStack ?? 0) !== 0
    }
    const selfBuffRules = readEffectRuleRows("wEngineSelfBuffRules").filter(validBuffRule)
    const teamBuffRules = readEffectRuleRows("wEngineTeamBuffRules").filter(validBuffRule)
    return {
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
    }
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
            ${sourceFields(set)}
          </div>
        </section>
        ${effectSection("twoPiece", "2 件套", set.twoPiece, { kind: "twoPiece" })}
        ${effectSection("fourPiece", "4 件套", set.fourPiece, { kind: "fourPiece" })}
    `
    renderStatRows("twoPieceStats", effectStats(set.twoPiece), { simple: true })
    renderEffectRuleRows("fourPieceSelfRules", effectRules(driveDiscFourPieceSelfBuff(set.fourPiece)))
    renderEffectRuleRows("fourPieceTeamRules", effectRules(driveDiscFourPieceTeamBuff(set.fourPiece)))
    updatePreview()
}

function readDriveDiscBuffEffect(prefix) {
    const stats = readEffectRuleRows(`${prefix}Rules`).filter(item => {
        if (item.type === "derived") {
            return item.ratio !== 0
        }
        if (item.type === "formula") {
            return String(item.formula?.expression ?? "").trim()
        }
        return Number(item.value ?? item.valuePerStack ?? 0) !== 0
    })
    if (!stats.length) {
        return null
    }

    const effect = {
        condition: document.getElementById(`${prefix}Condition`)?.value.trim() || null,
        effects: stats,
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
        ? readEffectRuleRows(`${prefix}Rules`).filter(item => {
            if (item.type === "derived") {
                return item.ratio !== 0
            }
            if (item.type === "formula") {
                return String(item.formula?.expression ?? "").trim()
            }
            return Number(item.value ?? item.valuePerStack ?? 0) !== 0
        })
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
    return {
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
    }
}

function renderEffectRuleRows(containerId, effects = []) {
    const container = document.getElementById(containerId)
    if (!container) {
        return
    }

    const rows = effects.length ? effects : [{ type: "fixed", stat: "atkFlat", value: 0, mode: "flat" }]
    container.innerHTML = ""
    rows.forEach((effect, index) => {
        const type = effect.type ?? "fixed"
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
              ${fieldLabel("目标属性", true)}
              <select data-effect-stat>${selectOptions(STAT_OPTIONS.map(([key, label]) => [key, label]), effect.stat ?? "atkFlat")}</select>
            </label>
            <label class="field direct-value-only">
              ${fieldLabel(type === "stacked" ? "每层数值" : "数值", true)}
              <input data-effect-value type="number" step="0.01" value="${escapeHtml(type === "stacked" ? effect.valuePerStack ?? effect.value ?? 0 : effect.value ?? 0)}">
            </label>
            <label class="field">
              ${fieldLabel("计算方式", true)}
              <select data-effect-mode>${selectOptions([["flat", "直接加到面板"], ["pct", "按基准换算"]], effect.mode ?? modeForStat(effect.stat ?? "atkFlat"))}</select>
            </label>
            <label class="field">
              <span>基准</span>
              <select data-effect-basis>${selectOptions(BASIS_OPTIONS, effect.basis ?? "")}</select>
            </label>
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
            <button type="button" class="compact-btn maintenance-remove-effect" data-remove-effect="${index}">删除</button>
        `
        container.appendChild(row)
        syncBuffEffectRow(row)
    })
}

function syncBuffEffectRow(row) {
    const type = row.querySelector("[data-effect-type]")?.value ?? "fixed"
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
}

function readEffectRuleRows(containerId) {
    return [...document.querySelectorAll(`#${containerId} .maintenance-buff-effect-row`)].map((row, index) => {
        const type = row.querySelector("[data-effect-type]")?.value ?? "fixed"
        const stat = row.querySelector("[data-effect-stat]")?.value ?? "atkFlat"
        const base = {
            ...(row.dataset.effectId ? { id: row.dataset.effectId } : {}),
            type,
            stat,
            mode: row.querySelector("[data-effect-mode]")?.value || modeForStat(stat),
            ...(row.querySelector("[data-effect-basis]")?.value ? { basis: row.querySelector("[data-effect-basis]").value } : {}),
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
            return {
                ...base,
                valuePerStack: inputToStoredValue(stat, row.querySelector("[data-effect-value]")?.value),
                maxStacks: numberValue(row.querySelector("[data-effect-max-stacks]")?.value, 1),
                defaultStacks: numberValue(row.querySelector("[data-effect-default-stacks]")?.value, 1),
            }
        }

        return {
            ...base,
            value: inputToStoredValue(stat, row.querySelector("[data-effect-value]")?.value),
        }
    }).filter(effect => effect.stat)
}

function renderBuffEffectRows(effects = []) {
    renderEffectRuleRows("buffEffectRows", effects)
}

function readBuffEffectRows() {
    return readEffectRuleRows("buffEffectRows")
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
    const buff = item ?? {
        maintenanceType: "teammate",
        teammateId: "new_teammate",
        teammateName: { zhCN: "新队友" },
        source: { zhCN: "核心被动" },
        description: { zhCN: "" },
        scope: "inCombat",
        effects: [],
        coverage: { default: 1, min: 0, max: 1, step: 0.1 },
    }
    const isTeammate = buff.maintenanceType === "teammate" || buff.sourceType === "teammate"

    els.editorTitle.textContent = "Buff 资料"
    els.editorTag.textContent = isTeammate
        ? `${buff.teammateId || "新队友"} / ${localized(buff.source) || "新 Buff"}`
        : localized(buff.name) || localized(buff.source) || "未命名"
    els.maintenanceForm.innerHTML = `
        <section class="maintenance-section">
          <h3>Buff 归属</h3>
          <div class="maintenance-grid">
            <label class="field">${fieldLabel("类型", true)}<select id="buffType">${selectOptions(SOURCE_TYPE_OPTIONS, isTeammate ? "teammate" : buff.sourceType ?? "manual")}</select></label>
            <label class="field teammate-only">${fieldLabel("队友 ID", true)}<input id="teammateId" value="${escapeHtml(buff.teammateId ?? "")}"></label>
            <label class="field teammate-only">${fieldLabel("队友中文名", true)}<input id="teammateNameZh" value="${escapeHtml(buff.teammateName?.zhCN ?? "")}" required></label>
            <label class="field generic-only">${fieldLabel("Buff 中文名", true)}<input id="buffNameZh" value="${escapeHtml(buff.name?.zhCN || localized(buff.source) || "未命名")}" required></label>
            <label class="field" id="buffSourceField">${fieldLabel("来源中文名", isTeammate)}<input id="buffSourceZh" value="${escapeHtml((buff.source ?? buff.sourceLabel)?.zhCN ?? "")}"></label>
            <label class="field">${fieldLabel("范围", true)}<select id="buffScope">${selectOptions(EFFECT_SCOPE_OPTIONS, buff.scope ?? "inCombat")}</select></label>
            <label class="field"><span>条件标签</span><input id="conditionLabel" value="${escapeHtml(localized(buff.conditionLabel) || "")}"></label>
            <label class="field"><span>中文说明</span><textarea id="descriptionZh">${escapeHtml(buff.description?.zhCN ?? "")}</textarea></label>
          </div>
        </section>
        ${coverageBlock("buff", buff.coverage)}
        <section class="maintenance-section">
          <div class="maintenance-section-head">
            <h3>Buff 规则</h3>
            <button type="button" class="compact-btn" data-add-effect>添加规则</button>
          </div>
          <div id="buffEffectRows" class="maintenance-buff-effect-rows"></div>
        </section>
    `
    renderBuffEffectRows(effectRules(buff))
    syncBuffTypeFields()
    updatePreview()
}

function syncBuffTypeFields() {
    const isTeammate = document.getElementById("buffType")?.value === "teammate"
    const sourceFieldLabel = document.querySelector("#buffSourceField .field-label")
    if (sourceFieldLabel) {
        sourceFieldLabel.outerHTML = fieldLabel("来源中文名", isTeammate)
    }
    const sourceInput = document.getElementById("buffSourceZh")
    if (sourceInput) {
        sourceInput.required = isTeammate
    }
    for (const item of els.maintenanceForm.querySelectorAll(".teammate-only")) {
        item.hidden = !isTeammate
        for (const input of item.querySelectorAll("input, select, textarea")) {
            input.required = isTeammate && ["teammateId", "teammateNameZh"].includes(input.id)
        }
    }
    for (const item of els.maintenanceForm.querySelectorAll(".generic-only")) {
        item.hidden = isTeammate
        for (const input of item.querySelectorAll("input, select, textarea")) {
            input.required = !isTeammate && input.id === "buffNameZh"
        }
    }
}

function buildBuff() {
    const sourceType = document.getElementById("buffType").value
    const existing = selectedCleanRecord()
    const buff = {
        ...(existing?.id ? { id: existing.id } : {}),
        scope: document.getElementById("buffScope").value,
        sourceType,
        name: readLocalizedZh("buffName"),
        source: readLocalizedZh("buffSource"),
        sourceLabel: readLocalizedZh("buffSource"),
        conditionLabel: document.getElementById("conditionLabel").value.trim(),
        description: {
            zhCN: document.getElementById("descriptionZh").value.trim(),
        },
        coverage: readCoverageConfig("buff"),
        effects: readBuffEffectRows(),
    }

    if (sourceType === "teammate") {
        return {
            teammate: {
                id: document.getElementById("teammateId").value.trim(),
                name: readLocalizedZh("teammateName"),
            },
            buff: {
                ...(buff.id ? { id: buff.id } : {}),
                source: buff.source,
                description: buff.description,
                scope: buff.scope,
                ...(buff.coverage ? { coverage: buff.coverage } : {}),
                effects: buff.effects,
            },
        }
    }

    const { maintenanceType, teammateId, teammateName, stats, statsByPhase, ...existingGeneric } = existing ?? {}
    return {
        ...existingGeneric,
        ...buff,
    }
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

function validationContextForCurrent(payload) {
    if (activeKind === "agents") {
        return {
            items: rawCollections().agents,
            currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
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
    if (payload?.teammate || payload?.buff) {
        return {
            teammates: catalog?.combatBuffs?.teammates ?? [],
            currentBuffId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
        }
    }
    return {
        items: catalog?.combatBuffs?.buffs ?? [],
        currentId: isDraftKey() ? undefined : rawSelectedRecord()?.id,
    }
}

function updatePreview() {
    try {
        const payload = buildCurrentPayload()
        els.jsonPreview.textContent = JSON.stringify(previewPayload(payload), null, 2)
        persistCurrentEditor(payload)
        renderList()
    } catch (error) {
        els.jsonPreview.textContent = error.message
        persistCurrentEditor()
        renderList()
    }
}

function previewPayload(payload) {
    if (activeKind !== "buffs") {
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
    const endpoint = activeKind === "buffs" && document.getElementById("buffType")?.value === "teammate"
        ? "teammate-buffs"
        : KIND_CONFIG[activeKind].endpoint
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
    selectedKey = response.savedItem
        ? recordKey(response.savedItem)
        : activeKind === "buffs" && endpoint === "teammate-buffs"
            ? `teammate:${payload.teammate.id}:${payload.buff.id}`
            : payload.id
    renderAll()
    const savedName = nameOf(response.savedItem ?? payload)
    setFeedback(`已保存：${savedName}`, [], "success")
    setStatus("已保存", "success")
}

function newRecord() {
    persistCurrentEditor()
    createDraft(blankDraftItem(activeKind))
    renderAll()
    setFeedback("已创建本地草稿", ["填写完成并通过校验后，点击保存写入正式数据。"], "success")
    setStatus("已创建本地草稿", "success")
}

function cloneRecord() {
    persistCurrentEditor()
    const current = selectedCleanRecord()
    if (!current) {
        newRecord()
        return
    }

    const copy = structuredClone(current)
    copy.id = copy.id ? `${copy.id}_copy` : ""
    if (copy.maintenanceType === "teammate") {
        copy.id = copy.id ? `${copy.id}_${Date.now()}` : ""
    }
    if (activeKind === "buffs") {
        delete copy.id
    }
    createDraft(copy)
    renderAll()
    setFeedback("已复制为本地草稿", ["保存时会由系统生成新的 Buff ID。"], "success")
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
    updatePreview()
})
els.maintenanceForm.addEventListener("change", event => {
    clearFeedback()
    if (event.target.matches("[data-stat-key]")) {
        const row = event.target.closest(".maintenance-stat-row")
        const stat = event.target.value
        row.querySelector("[data-stat-mode]").value = modeForStat(stat)
        const label = row.querySelector("[data-stat-value]")?.closest(".field")?.querySelector("span")
        if (label) {
            label.outerHTML = fieldLabel(`数值${PERCENT_VALUE_STATS.has(stat) ? "（15 表示 15%）" : ""}`, true)
        }
    }

    if (event.target.id === "buffType") {
        syncBuffTypeFields()
    }

    if (event.target.matches("[data-effect-type]")) {
        syncBuffEffectRow(event.target.closest(".maintenance-buff-effect-row"))
    }

    if (event.target.matches("[data-preferred-main-stat]")) {
        event.target.closest(".main-stat-choice")?.classList.toggle("active", event.target.checked)
    }

    updatePreview()
})
els.maintenanceForm.addEventListener("click", event => {
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

    const add = event.target.closest("[data-add-stat]")
    if (add) {
        clearFeedback()
        const id = add.dataset.addStat
        const stats = readStatRows(id)
        renderStatRows(id, [...stats, { stat: "atkFlat", value: 0, mode: "flat" }])
        updatePreview()
        return
    }

    const remove = event.target.closest("[data-remove-stat]")
    if (remove) {
        clearFeedback()
        const id = remove.closest("[data-stat-row]")?.dataset.statRow
        const stats = readStatRows(id)
        stats.splice(Number(remove.dataset.removeStat), 1)
        renderStatRows(id, stats)
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
        setStatus(error.message, "error")
        console.error(error)
    }
}

bootstrap()
