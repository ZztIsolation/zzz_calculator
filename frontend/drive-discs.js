import { confirmDialog } from "./dialogs.js"
import { clearPageNotice, setStatusChip, showErrorNotice, showSuccessNotice } from "./feedback.js"
import {
    clearUserDriveDiscStore,
    deleteDriveDiscLoadout,
    deleteUserDriveDisc,
    importScannerExportToStore,
    loadCurrentUserDriveDiscStore,
    upsertDriveDiscLoadout,
    upsertUserDriveDisc,
} from "./local-store.js"
import { ScannerBridge } from "./scanner-bridge.js"
import { loadMeta as loadCatalogMeta } from "./catalog-loader.js"

const els = {
    status: document.getElementById("status"),
    refreshBtn: document.getElementById("refreshBtn"),
    newDiscBtn: document.getElementById("newDiscBtn"),
    totalCount: document.getElementById("totalCount"),
    setCount: document.getElementById("setCount"),
    importCount: document.getElementById("importCount"),
    filteredCount: document.getElementById("filteredCount"),
    importFileInput: document.getElementById("importFileInput"),
    removeMissingInput: document.getElementById("removeMissingInput"),
    importBtn: document.getElementById("importBtn"),
    clearInventoryBtn: document.getElementById("clearInventoryBtn"),
    searchInput: document.getElementById("searchInput"),
    slotFilter: document.getElementById("slotFilter"),
    slotTabs: document.getElementById("slotTabs"),
    setFilter: document.getElementById("setFilter"),
    mainStatFilter: document.getElementById("mainStatFilter"),
    sortSelect: document.getElementById("sortSelect"),
    inventoryViewTabs: document.getElementById("inventoryViewTabs"),
    inventorySection: document.getElementById("inventorySection"),
    loadoutSection: document.getElementById("loadoutSection"),
    inventoryTabCount: document.getElementById("inventoryTabCount"),
    loadoutTabCount: document.getElementById("loadoutTabCount"),
    inventoryTableWrap: document.getElementById("inventoryTableWrap"),
    loadoutTableWrap: document.getElementById("loadoutTableWrap"),
    discTableBody: document.getElementById("discTableBody"),
    emptyInventory: document.getElementById("emptyInventory"),
    loadoutCount: document.getElementById("loadoutCount"),
    loadoutTableBody: document.getElementById("loadoutTableBody"),
    emptyLoadouts: document.getElementById("emptyLoadouts"),
    discModal: document.getElementById("discModal"),
    closeDiscModalBtn: document.getElementById("closeDiscModalBtn"),
    modalTitle: document.getElementById("modalTitle"),
    selectedTag: document.getElementById("selectedTag"),
    setGrid: document.getElementById("setGrid"),
    partitionGrid: document.getElementById("partitionGrid"),
    rarityButtons: document.getElementById("rarityButtons"),
    levelRange: document.getElementById("levelRange"),
    levelMinusBtn: document.getElementById("levelMinusBtn"),
    levelPlusBtn: document.getElementById("levelPlusBtn"),
    discForm: document.getElementById("discForm"),
    discIdInput: document.getElementById("discIdInput"),
    setNameInput: document.getElementById("setNameInput"),
    partitionInput: document.getElementById("partitionInput"),
    rarityInput: document.getElementById("rarityInput"),
    levelInput: document.getElementById("levelInput"),
    maxLevelInput: document.getElementById("maxLevelInput"),
    equippedByInput: document.getElementById("equippedByInput"),
    lockedInput: document.getElementById("lockedInput"),
    mainStatSelect: document.getElementById("mainStatSelect"),
    mainStatValueInput: document.getElementById("mainStatValueInput"),
    subStatEditors: document.getElementById("subStatEditors"),
    saveDiscBtn: document.getElementById("saveDiscBtn"),
    deleteDiscBtn: document.getElementById("deleteDiscBtn"),
    rawPreview: document.getElementById("rawPreview"),
    loadoutModal: document.getElementById("loadoutModal"),
    closeLoadoutModalBtn: document.getElementById("closeLoadoutModalBtn"),
    loadoutModalTitle: document.getElementById("loadoutModalTitle"),
    loadoutSelectedTag: document.getElementById("loadoutSelectedTag"),
    loadoutIdInput: document.getElementById("loadoutIdInput"),
    loadoutNameInput: document.getElementById("loadoutNameInput"),
    loadoutAgentSelect: document.getElementById("loadoutAgentSelect"),
    loadoutSlotEditors: document.getElementById("loadoutSlotEditors"),
    saveLoadoutBtn: document.getElementById("saveLoadoutBtn"),
    deleteLoadoutBtn: document.getElementById("deleteLoadoutBtn"),
    importRecordsModal: document.getElementById("importRecordsModal"),
    importRecordsCloseBtn: document.getElementById("importRecordsCloseBtn"),
    importRecordsSummaryText: document.getElementById("importRecordsSummaryText"),
    importRecordsTableWrap: document.getElementById("importRecordsTableWrap"),
    importRecordsTableBody: document.getElementById("importRecordsTableBody"),
    importRecordsEmpty: document.getElementById("importRecordsEmpty"),
    scanBtn: document.getElementById("scanBtn"),
    scanModal: document.getElementById("scanModal"),
    scanCloseBtn: document.getElementById("scanCloseBtn"),
    scanStatusText: document.getElementById("scanStatusText"),
    scanHelperGuide: document.getElementById("scanHelperGuide"),
    scanControls: document.getElementById("scanControls"),
    scanAutoRetry: document.getElementById("scanAutoRetry"),
    scanRarityS: document.getElementById("scanRarityS"),
    scanRarityA: document.getElementById("scanRarityA"),
    scanMaxItems: document.getElementById("scanMaxItems"),
    scanStopNon15: document.getElementById("scanStopNon15"),
    scanRemoveMissing: document.getElementById("scanRemoveMissing"),
    scanStartBtn: document.getElementById("scanStartBtn"),
    scanStopBtn: document.getElementById("scanStopBtn"),
    scanProgressArea: document.getElementById("scanProgressArea"),
    scanProgressFill: document.getElementById("scanProgressFill"),
    scanProgressText: document.getElementById("scanProgressText"),
}

const EMPTY_DISC_IMAGE = "/assets/drive-discs/empty.svg"
const STAT_OPTIONS = [
    ["hpFlat", "生命值"],
    ["hpPct", "百分比生命值%"],
    ["atkFlat", "攻击力"],
    ["atkPct", "百分比攻击力%"],
    ["defFlat", "防御力"],
    ["defPct", "百分比防御力%"],
    ["critRate", "暴击率%"],
    ["critDmg", "暴击伤害%"],
    ["impact", "冲击力%"],
    ["anomalyProficiency", "异常精通"],
    ["anomalyMastery", "异常掌控%"],
    ["energyRegen", "能量自动回复%"],
    ["penFlat", "穿透值"],
    ["penRatio", "穿透率%"],
    ["physicalDmg", "物理伤害加成%"],
    ["fireDmg", "火属性伤害加成%"],
    ["iceDmg", "冰属性伤害加成%"],
    ["electricDmg", "电属性伤害加成%"],
    ["etherDmg", "以太伤害加成%"],
    ["windDmg", "风属性伤害加成%"],
]
const STAT_LABELS = Object.fromEntries(STAT_OPTIONS)
const PERCENT_STATS = new Set([
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
    "impact",
    "anomalyMastery",
    "energyRegen",
    "penRatio",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
    "windDmg",
])
const INVENTORY_VIEWS = new Set(["inventory", "loadouts"])

let meta = null
let store = null
let selectedId = null
let selectedSetId = null
let selectedSetName = ""
let selectedLoadoutId = null
let activeInventoryView = "inventory"

function setStatus(text, tone = "idle") {
    setStatusChip(els.status, text, tone)
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error)
}

function normalizeInventoryView(view) {
    const normalized = String(view ?? "").replace(/^#/, "")
    return INVENTORY_VIEWS.has(normalized) ? normalized : "inventory"
}

function inventoryViewFromHash() {
    return normalizeInventoryView(window.location.hash)
}

function setInventoryView(view, { updateHash = false } = {}) {
    activeInventoryView = normalizeInventoryView(view)
    if (els.inventorySection) {
        els.inventorySection.hidden = activeInventoryView !== "inventory"
    }
    if (els.loadoutSection) {
        els.loadoutSection.hidden = activeInventoryView !== "loadouts"
    }
    for (const button of els.inventoryViewTabs?.querySelectorAll("[data-inventory-view]") ?? []) {
        const active = button.dataset.inventoryView === activeInventoryView
        button.classList.toggle("active", active)
        button.setAttribute("aria-pressed", String(active))
    }
    if (updateHash && window.location.hash !== `#${activeInventoryView}`) {
        history.replaceState(null, "", `#${activeInventoryView}`)
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function statLabel(stat) {
    return STAT_LABELS[stat] ?? meta?.statRules?.statDisplay?.[stat]?.label ?? stat ?? "-"
}

function nameOf(item) {
    return item?.name?.zhCN ?? item?.name?.en ?? item?.setName ?? item?.id ?? "-"
}

function isPercentStat(stat) {
    return PERCENT_STATS.has(stat)
}

function modeOf(stat) {
    return isPercentStat(stat) ? "pct" : "flat"
}

function labelOf(stat) {
    const label = statLabel(stat)
    return label.endsWith("%") ? label.slice(0, -1) : label
}

function formatStatValue(stat, value, mode) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "-"
    }

    if (mode === "pct" || isPercentStat(stat)) {
        return `${Number(value.toFixed(3))}%`
    }

    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

function statText(item) {
    if (!item) {
        return "-"
    }

    return `${statLabel(item.stat)} ${formatStatValue(item.stat, item.value, item.mode)}`
}

function valueToInput(item) {
    if (!item || typeof item.value !== "number") {
        return ""
    }

    return item.mode === "pct" || isPercentStat(item.stat)
        ? Number(item.value.toFixed(3))
        : item.value
}

function inputToValue(stat, rawValue) {
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
        return 0
    }

    return value
}

function defaultMainValue(stat) {
    const value = meta?.statRules?.driveDisc?.sRankMaxMainStat?.[stat]
    if (typeof value !== "number") {
        return ""
    }

    return isPercentStat(stat) ? Number(value.toFixed(3)) : value
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

function driveDiscSets() {
    return meta?.driveDiscSets ?? []
}

function getSetById(id) {
    return driveDiscSets().find(item => item.id === id) ?? null
}

function getSetByName(setName) {
    return driveDiscSets().find(item =>
        item.name?.zhCN === setName || item.name?.en === setName || item.id === setName
    ) ?? null
}

function scannerSetAliases() {
    return Object.fromEntries(
        driveDiscSets()
            .flatMap(set => [
                [set.name?.zhCN, { id: set.id, name: set.name }],
                [set.name?.en, { id: set.id, name: set.name }],
                [set.id, { id: set.id, name: set.name }],
            ])
            .filter(([key]) => key)
    )
}

function resolveSet(discOrId, setName = "") {
    if (typeof discOrId === "string") {
        return getSetById(discOrId) ?? getSetByName(setName)
    }

    return getSetById(discOrId?.setId) ?? getSetByName(discOrId?.setName)
}

function setIcon(setOrDisc) {
    const set = setOrDisc?.images ? setOrDisc : resolveSet(setOrDisc)
    return set?.images?.icon ?? EMPTY_DISC_IMAGE
}

function availableSets() {
    const result = new Map()
    for (const set of driveDiscSets()) {
        result.set(set.id, set)
    }

    for (const disc of store?.driveDiscs ?? []) {
        const set = resolveSet(disc)
        if (set) {
            result.set(set.id, set)
            continue
        }

        result.set(disc.setId, {
            id: disc.setId,
            name: { zhCN: disc.setName },
            images: { icon: EMPTY_DISC_IMAGE, source: "pending" },
        })
    }

    return [...result.values()].sort((left, right) => nameOf(left).localeCompare(nameOf(right), "zh-CN"))
}

function syncSlotTabs() {
    const discs = store?.driveDiscs ?? []
    const countBySlot = new Map()
    for (const disc of discs) {
        const slot = String(disc.partition ?? "")
        countBySlot.set(slot, (countBySlot.get(slot) ?? 0) + 1)
    }
    for (const button of els.slotTabs.querySelectorAll("button[data-slot]")) {
        const slot = String(button.dataset.slot ?? "")
        button.classList.toggle("active", slot === els.slotFilter.value)
        button.setAttribute("aria-pressed", String(slot === els.slotFilter.value))
        button.textContent = slot ? `${slot}号位 ${countBySlot.get(slot) ?? 0}` : `全部 ${discs.length}`
    }
}

function populateFilters() {
    const previousSet = els.setFilter.value
    const previousMain = els.mainStatFilter.value

    els.setFilter.innerHTML = `<option value="">全部</option>`
    for (const set of availableSets()) {
        const option = document.createElement("option")
        option.value = set.id
        option.textContent = nameOf(set)
        option.selected = set.id === previousSet
        els.setFilter.appendChild(option)
    }

    const mainStats = [...new Set((store?.driveDiscs ?? []).map(item => item.mainStat?.stat).filter(Boolean))]
        .sort((a, b) => statLabel(a).localeCompare(statLabel(b), "zh-CN"))
    els.mainStatFilter.innerHTML = `<option value="">全部</option>`
    for (const stat of mainStats) {
        const option = document.createElement("option")
        option.value = stat
        option.textContent = statLabel(stat)
        option.selected = stat === previousMain
        els.mainStatFilter.appendChild(option)
    }

    syncSlotTabs()
}

function filteredDiscs() {
    const search = els.searchInput.value.trim().toLowerCase()
    const slot = els.slotFilter.value
    const setId = els.setFilter.value
    const mainStat = els.mainStatFilter.value
    const sortBy = els.sortSelect.value

    const discs = (store?.driveDiscs ?? []).filter(disc => {
        const set = resolveSet(disc)
        const haystack = [
            disc.id,
            disc.setId,
            disc.setName,
            nameOf(set),
            disc.partition,
            statLabel(disc.mainStat?.stat),
            disc.mainStat?.label,
            ...(disc.subStats ?? []).flatMap(item => [statLabel(item.stat), item.label]),
        ].join(" ").toLowerCase()

        return (!search || haystack.includes(search))
            && (!slot || String(disc.partition) === slot)
            && (!setId || disc.setId === setId || set?.id === setId)
            && (!mainStat || disc.mainStat?.stat === mainStat)
    })

    return discs.sort((a, b) => {
        if (sortBy === "slot") {
            return Number(a.partition) - Number(b.partition)
                || String(a.setName).localeCompare(String(b.setName), "zh-CN")
                || Number(a.source?.sequence ?? 0) - Number(b.source?.sequence ?? 0)
        }

        if (sortBy === "setName") {
            return String(a.setName).localeCompare(String(b.setName), "zh-CN")
                || Number(a.partition) - Number(b.partition)
        }

        if (sortBy === "level") {
            return Number(b.level) - Number(a.level)
                || Number(a.partition) - Number(b.partition)
        }

        return Number(a.source?.sequence ?? 999999) - Number(b.source?.sequence ?? 999999)
    })
}

function renderSummary() {
    const discs = store?.driveDiscs ?? []
    const imports = store?.imports ?? []
    const loadouts = store?.driveDiscLoadouts ?? []
    els.totalCount.textContent = String(discs.length)
    if (els.inventoryTabCount) {
        els.inventoryTabCount.textContent = String(discs.length)
    }
    if (els.loadoutTabCount) {
        els.loadoutTabCount.textContent = String(loadouts.length)
    }
    els.setCount.textContent = `${new Set(discs.map(item => item.setName)).size} 套`
    els.importCount.textContent = `${imports.length} 次导入`
    els.clearInventoryBtn.disabled = discs.length === 0 && imports.length === 0 && loadouts.length === 0
}

function renderTable() {
    const discs = filteredDiscs()
    const total = store?.driveDiscs?.length ?? 0
    els.filteredCount.textContent = `显示 ${discs.length} / ${total}`
    els.discTableBody.innerHTML = ""
    els.emptyInventory.hidden = discs.length !== 0
    if (els.inventoryTableWrap) {
        els.inventoryTableWrap.hidden = discs.length === 0
    }

    for (const disc of discs) {
        const set = resolveSet(disc)
        const subStats = (disc.subStats ?? []).slice(0, 4).map(statText).join(" / ")
        const row = document.createElement("tr")
        row.dataset.id = disc.id
        row.innerHTML = `
            <td>
                <div class="disc-row-identity">
                    <img src="${escapeHtml(setIcon(set ?? disc))}" alt="">
                    <div>
                        <strong>${escapeHtml(disc.setName || nameOf(set))}</strong>
                        <span>${escapeHtml(disc.source?.sequence ? `#${disc.source.sequence}` : disc.id)}</span>
                    </div>
                </div>
            </td>
            <td>${Number(disc.partition) || "-"}号位</td>
            <td><span class="rarity-pill">${escapeHtml(disc.rarity)} +${Number(disc.level ?? 0)}</span></td>
            <td>${escapeHtml(statText(disc.mainStat))}</td>
            <td class="substat-cell">${escapeHtml(subStats || "-")}</td>
            <td><button type="button" class="compact-btn" data-action="edit" data-id="${escapeHtml(disc.id)}">编辑</button></td>
        `
        els.discTableBody.appendChild(row)
    }
}

function agentName(agentId) {
    return nameOf(meta?.agents?.find(agent => agent.id === agentId)) || agentId
}

function discById(id) {
    return (store?.driveDiscs ?? []).find(disc => disc.id === id) ?? null
}

function loadoutMissingSlots(loadout) {
    return [1, 2, 3, 4, 5, 6].filter(slot => !discById(loadout.driveDiscIdsBySlot?.[String(slot)]))
}

function loadoutIsIncomplete(loadout) {
    return loadoutMissingSlots(loadout).length > 0
}

function loadoutSlotText(loadout) {
    return [1, 2, 3, 4, 5, 6].map(slot => {
        const disc = discById(loadout.driveDiscIdsBySlot?.[String(slot)])
        return disc ? `${slot}:${disc.setName || nameOf(resolveSet(disc))}` : `${slot}:-`
    }).join(" / ")
}

function loadoutSlotChipsHtml(loadout) {
    return `
        <div class="loadout-slot-chip-list" aria-label="${escapeHtml(loadoutSlotText(loadout))}">
            ${[1, 2, 3, 4, 5, 6].map(slot => {
                const storedId = loadout.driveDiscIdsBySlot?.[String(slot)]
                const disc = discById(storedId)
                const missing = Boolean(storedId && !disc)
                const set = disc ? resolveSet(disc) : null
                const label = disc
                    ? (disc.setName || nameOf(set))
                    : missing ? "已缺失" : "未选择"
                const detail = disc ? statText(disc.mainStat) : missing ? "待修复" : "空槽位"
                return `
                    <span class="loadout-slot-chip${disc ? "" : " missing"}" title="${escapeHtml(`${slot}号位 · ${label} · ${detail}`)}">
                        <img src="${escapeHtml(disc ? setIcon(set ?? disc) : EMPTY_DISC_IMAGE)}" alt="">
                        <span>
                            <strong>${slot}号位</strong>
                            <em>${escapeHtml(label)}</em>
                        </span>
                    </span>
                `
            }).join("")}
        </div>
    `
}

function renderLoadouts() {
    const loadouts = store?.driveDiscLoadouts ?? []
    if (!els.loadoutTableBody) {
        return
    }

    els.loadoutCount.textContent = String(loadouts.length)
    if (els.loadoutTabCount) {
        els.loadoutTabCount.textContent = String(loadouts.length)
    }
    els.loadoutTableBody.innerHTML = ""
    els.emptyLoadouts.hidden = loadouts.length !== 0
    if (els.loadoutTableWrap) {
        els.loadoutTableWrap.hidden = loadouts.length === 0
    }
    for (const loadout of loadouts) {
        const missingSlots = loadoutMissingSlots(loadout)
        const statusText = missingSlots.length ? `待修复：缺 ${missingSlots.join("、")} 号位` : "完整"
        const row = document.createElement("tr")
        row.dataset.loadoutId = loadout.id
        row.className = missingSlots.length ? "loadout-row-incomplete" : ""
        row.innerHTML = `
            <td><strong>${escapeHtml(loadout.name)}</strong><br><span>${escapeHtml(loadout.updatedAt ?? "-")}</span></td>
            <td>${escapeHtml(agentName(loadout.agentId))}</td>
            <td class="loadout-slots-cell">${loadoutSlotChipsHtml(loadout)}<span class="${missingSlots.length ? "danger-text" : "muted-text"}">${escapeHtml(statusText)}</span></td>
            <td>${Number.isFinite(Number(loadout.score)) ? Number(loadout.score).toFixed(0) : "-"}</td>
            <td><button type="button" class="compact-btn" data-action="edit-loadout" data-loadout-id="${escapeHtml(loadout.id)}">编辑</button></td>
        `
        els.loadoutTableBody.appendChild(row)
    }
}

function renderAll() {
    populateFilters()
    renderSummary()
    renderTable()
    renderLoadouts()
    setInventoryView(activeInventoryView)
}

function currentDisc() {
    return (store?.driveDiscs ?? []).find(item => item.id === selectedId) ?? null
}

function populateStatSelect(select, selected = "", options = STAT_OPTIONS.map(([stat]) => stat)) {
    select.innerHTML = ""
    for (const stat of options) {
        const option = document.createElement("option")
        option.value = stat
        option.textContent = statLabel(stat)
        option.selected = stat === selected
        select.appendChild(option)
    }
}

function mainStatPool(partition) {
    return meta?.statRules?.driveDisc?.mainStatPools?.[String(partition)] ?? STAT_OPTIONS.map(([stat]) => stat)
}

function updateMainStatOptions(preferred = els.mainStatSelect.value) {
    const pool = mainStatPool(els.partitionInput.value)
    const selected = pool.includes(preferred) ? preferred : pool[0]
    populateStatSelect(els.mainStatSelect, selected, pool)
    if (!els.mainStatValueInput.value) {
        els.mainStatValueInput.value = defaultMainValue(selected)
    }
}

function renderSubStatEditors(subStats = []) {
    els.subStatEditors.innerHTML = ""
    for (let index = 0; index < 4; index += 1) {
        const item = subStats[index] ?? { stat: "atkFlat", value: 0, mode: "flat" }
        const row = document.createElement("div")
        row.className = "stat-editor-row"
        row.innerHTML = `
            <label class="field">
              <span>副词条 ${index + 1}</span>
              <select id="subStatSelect${index}"></select>
            </label>
            <label class="field">
              <span>数值</span>
              <input id="subStatValue${index}" type="number" step="0.1" value="${escapeHtml(valueToInput(item))}">
            </label>
        `
        els.subStatEditors.appendChild(row)
        populateStatSelect(row.querySelector("select"), item.stat)
    }
}

function chooseSet(set) {
    selectedSetId = set?.id ?? ""
    selectedSetName = nameOf(set)
    els.setNameInput.value = selectedSetName
    renderSetGrid()
    renderPartitionGrid()
    els.selectedTag.textContent = `${selectedSetName || "未选择套装"} · ${els.partitionInput.value}号位`
}

function renderSetGrid() {
    els.setGrid.innerHTML = ""
    for (const set of availableSets()) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = set.id === selectedSetId ? "set-option active" : "set-option"
        button.dataset.setId = set.id
        button.innerHTML = `
            <img src="${escapeHtml(setIcon(set))}" alt="">
            <span>${escapeHtml(nameOf(set))}</span>
        `
        els.setGrid.appendChild(button)
    }
}

function renderPartitionGrid() {
    els.partitionGrid.innerHTML = ""
    const set = getSetById(selectedSetId) ?? getSetByName(selectedSetName)
    for (let slot = 1; slot <= 6; slot += 1) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = String(slot) === String(els.partitionInput.value) ? "partition-option active" : "partition-option"
        button.dataset.slot = String(slot)
        button.innerHTML = `
            <img src="${escapeHtml(setIcon(set))}" alt="">
            <span>${slot}号位</span>
        `
        els.partitionGrid.appendChild(button)
    }
}

function setRarity(rarity) {
    els.rarityInput.value = rarity
    const maxLevel = rarity === "S" ? 15 : rarity === "A" ? 12 : 9
    els.maxLevelInput.value = String(maxLevel)
    els.levelInput.max = String(maxLevel)
    els.levelRange.max = String(maxLevel)
    if (Number(els.levelInput.value) > maxLevel) {
        setLevel(maxLevel)
    }

    for (const button of els.rarityButtons.querySelectorAll("button[data-rarity]")) {
        button.classList.toggle("active", button.dataset.rarity === rarity)
    }
}

function setLevel(value) {
    const max = Number(els.maxLevelInput.value || 15)
    const next = Math.max(0, Math.min(max, Number(value || 0)))
    els.levelInput.value = String(next)
    els.levelRange.value = String(next)
}

function openModal(disc = null) {
    selectedId = disc?.id ?? null
    const set = resolveSet(disc) ?? driveDiscSets()[0] ?? availableSets()[0]

    els.modalTitle.textContent = disc ? "编辑驱动盘" : "添加驱动盘"
    els.discIdInput.value = disc?.id ?? ""
    els.partitionInput.value = String(disc?.partition ?? 1)
    els.equippedByInput.value = disc?.equippedBy ?? ""
    els.lockedInput.checked = Boolean(disc?.locked)
    els.rawPreview.textContent = disc?.raw ? JSON.stringify(disc.raw, null, 2) : ""
    els.deleteDiscBtn.disabled = !disc

    chooseSet(set)
    setRarity(disc?.rarity ?? "S")
    setLevel(disc?.level ?? Number(els.maxLevelInput.value || 15))
    updateMainStatOptions(disc?.mainStat?.stat)
    els.mainStatValueInput.value = valueToInput(disc?.mainStat) || defaultMainValue(els.mainStatSelect.value)
    renderSubStatEditors(disc?.subStats ?? [])

    els.discModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeModal() {
    els.discModal.hidden = true
    document.body.classList.remove("modal-open")
}

function currentLoadout() {
    return (store?.driveDiscLoadouts ?? []).find(item => item.id === selectedLoadoutId) ?? null
}

function populateLoadoutAgentSelect(selectedAgentId) {
    els.loadoutAgentSelect.innerHTML = ""
    for (const agent of meta?.agents ?? []) {
        const option = document.createElement("option")
        option.value = agent.id
        option.textContent = nameOf(agent)
        option.selected = agent.id === selectedAgentId
        els.loadoutAgentSelect.appendChild(option)
    }
}

function sortedDiscsForSlot(slot) {
    return (store?.driveDiscs ?? [])
        .filter(disc => Number(disc.partition) === Number(slot))
        .sort((left, right) =>
            String(left.setName).localeCompare(String(right.setName), "zh-CN")
            || Number(left.source?.sequence ?? 999999) - Number(right.source?.sequence ?? 999999)
        )
}

function loadoutSlotSelectOptionText(disc, slot) {
    return `${disc.setName || nameOf(resolveSet(disc))} · ${slot}号位 · ${statText(disc.mainStat)}${disc.source?.sequence ? ` · #${disc.source.sequence}` : ""}`
}

function loadoutSlotPreviewHtml({ slot, disc, missingId = "" }) {
    if (disc) {
        const set = resolveSet(disc)
        const subStats = (disc.subStats ?? []).slice(0, 4).map(statText)
        return `
            <div class="loadout-slot-card-visual">
                <img src="${escapeHtml(setIcon(set ?? disc))}" alt="">
                <div class="loadout-slot-card-copy">
                    <span class="loadout-slot-kicker">${slot}号位</span>
                    <strong>${escapeHtml(disc.setName || nameOf(set))}</strong>
                    <span class="loadout-slot-main">${escapeHtml(statText(disc.mainStat))}</span>
                    <p>${escapeHtml(subStats.join(" / ") || "暂无副词条")}</p>
                    <div class="loadout-slot-card-meta">
                        <span class="rarity-pill">${escapeHtml(disc.rarity ?? "-")} +${Number(disc.level ?? 0)}</span>
                        <span>${escapeHtml(disc.source?.sequence ? `#${disc.source.sequence}` : disc.id)}</span>
                    </div>
                </div>
            </div>
        `
    }

    const missing = Boolean(missingId)
    return `
        <div class="loadout-slot-card-visual empty">
            <img src="${escapeHtml(EMPTY_DISC_IMAGE)}" alt="">
            <div class="loadout-slot-card-copy">
                <span class="loadout-slot-kicker">${slot}号位</span>
                <strong>${missing ? "驱动盘已缺失" : "未选择驱动盘"}</strong>
                <span class="loadout-slot-main">${missing ? "保存后会清空该槽位" : "从下方选择同槽位驱动盘"}</span>
                <p>${missing ? escapeHtml(`原 ID：${missingId}`) : "该槽位暂未绑定到套装预设"}</p>
            </div>
        </div>
    `
}

function renderLoadoutSlotCardPreview(card, selectedId, slot, loadout) {
    const originalId = loadout?.driveDiscIdsBySlot?.[String(slot)] ?? ""
    const disc = selectedId ? discById(selectedId) : null
    const missingId = selectedId ? "" : (originalId && !discById(originalId) ? originalId : "")
    const preview = card.querySelector("[data-loadout-slot-preview]")
    if (preview) {
        preview.innerHTML = loadoutSlotPreviewHtml({ slot, disc, missingId })
    }
    card.classList.toggle("missing", Boolean(missingId))
    card.classList.toggle("empty", !disc && !missingId)
}

function renderLoadoutSlotEditors(loadout) {
    els.loadoutSlotEditors.innerHTML = ""
    for (let slot = 1; slot <= 6; slot += 1) {
        const originalId = loadout.driveDiscIdsBySlot?.[String(slot)] ?? ""
        const card = document.createElement("article")
        card.className = "loadout-slot-card"
        card.dataset.slot = String(slot)
        card.innerHTML = `<div data-loadout-slot-preview></div>`

        const field = document.createElement("label")
        field.className = "field loadout-slot-select-field"
        const select = document.createElement("select")
        select.dataset.loadoutSlot = String(slot)
        const empty = document.createElement("option")
        empty.value = ""
        empty.textContent = originalId && !discById(originalId) ? "保存时清空缺失槽位" : "未选择"
        empty.selected = !originalId || !discById(originalId)
        select.appendChild(empty)
        for (const disc of sortedDiscsForSlot(slot)) {
            const option = document.createElement("option")
            option.value = disc.id
            option.textContent = loadoutSlotSelectOptionText(disc, slot)
            option.selected = disc.id === originalId
            select.appendChild(option)
        }
        field.innerHTML = `<span>替换 ${slot}号位</span>`
        field.appendChild(select)
        card.appendChild(field)
        els.loadoutSlotEditors.appendChild(card)
        renderLoadoutSlotCardPreview(card, select.value, slot, loadout)
    }
}

function openLoadoutModal(loadout) {
    selectedLoadoutId = loadout.id
    els.loadoutIdInput.value = loadout.id
    els.loadoutNameInput.value = loadout.name
    populateLoadoutAgentSelect(loadout.agentId)
    renderLoadoutSlotEditors(loadout)
    const missingSlots = loadoutMissingSlots(loadout)
    els.loadoutSelectedTag.textContent = `${agentName(loadout.agentId)} · ${Number.isFinite(Number(loadout.score)) ? Number(loadout.score).toFixed(0) : "手动"}${missingSlots.length ? ` · 缺 ${missingSlots.join("、")} 号位` : ""}`
    els.loadoutModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeLoadoutModal() {
    els.loadoutModal.hidden = true
    document.body.classList.remove("modal-open")
    selectedLoadoutId = null
}

function readLoadoutSlotIds() {
    return Object.fromEntries(
        [...els.loadoutSlotEditors.querySelectorAll("select[data-loadout-slot]")]
            .map(select => [select.dataset.loadoutSlot, select.value])
            .filter(([, id]) => id)
    )
}

async function saveCurrentLoadout() {
    const existing = currentLoadout()
    if (!existing) {
        return null
    }
    const name = els.loadoutNameInput.value.trim() || existing.name
    const response = await upsertDriveDiscLoadout({
        ...existing,
        name,
        agentId: els.loadoutAgentSelect.value,
        driveDiscIdsBySlot: readLoadoutSlotIds(),
        source: {
            ...(existing.source ?? {}),
            editedFromInventory: true,
        },
    })
    store = response.store
    closeLoadoutModal()
    renderAll()
    return { name }
}

async function deleteCurrentLoadout() {
    const existing = currentLoadout()
    if (!existing) {
        return null
    }
    const name = existing.name
    const ok = await confirmDialog({
        title: "删除套装预设",
        message: `确认删除套装预设「${name}」？这不会删除仓库里的驱动盘。`,
        confirmText: "删除预设",
        tone: "danger",
    })
    if (!ok) {
        return null
    }
    const response = await deleteDriveDiscLoadout(existing.id)
    store = response.store
    closeLoadoutModal()
    renderAll()
    return { name }
}

function readSubStats() {
    const result = []
    for (let index = 0; index < 4; index += 1) {
        const select = document.getElementById(`subStatSelect${index}`)
        const input = document.getElementById(`subStatValue${index}`)
        if (!select || !input || input.value === "") {
            continue
        }

        const stat = select.value
        const value = inputToValue(stat, input.value)
        result.push({
            stat,
            value,
            mode: modeOf(stat),
            label: labelOf(stat),
            rawValue: modeOf(stat) === "pct" ? `${Number(input.value || 0)}%` : value,
        })
    }

    return result
}

function buildDiscFromForm() {
    const existing = currentDisc()
    const id = els.discIdInput.value || `manual-${Date.now()}`
    const mainStat = {
        stat: els.mainStatSelect.value,
        value: inputToValue(els.mainStatSelect.value, els.mainStatValueInput.value),
        mode: modeOf(els.mainStatSelect.value),
        label: labelOf(els.mainStatSelect.value),
        rawValue: modeOf(els.mainStatSelect.value) === "pct"
            ? `${Number(els.mainStatValueInput.value || 0)}%`
            : inputToValue(els.mainStatSelect.value, els.mainStatValueInput.value),
    }

    return {
        ...(existing ?? {}),
        id,
        ownerId: existing?.ownerId ?? store?.currentOwnerId ?? "default",
        setId: selectedSetId || existing?.setId || "manual-set",
        setName: selectedSetName || existing?.setName || "未命名套装",
        canonicalSetName: getSetById(selectedSetId)?.name ?? existing?.canonicalSetName ?? null,
        partition: Number(els.partitionInput.value),
        rarity: els.rarityInput.value,
        level: Number(els.levelInput.value || 0),
        maxLevel: Number(els.maxLevelInput.value || 15),
        locked: els.lockedInput.checked,
        equippedBy: els.equippedByInput.value.trim() || null,
        mainStat,
        subStats: readSubStats(),
        source: existing?.source ?? {
            type: "manual",
            importedAt: new Date().toISOString(),
        },
        raw: existing?.raw ?? null,
    }
}

async function loadMeta() {
    meta = await loadCatalogMeta()
}

async function loadStore() {
    store = await loadCurrentUserDriveDiscStore()
    renderAll()
}

function importSummaryText(summary) {
    if (!summary) {
        return "仓库已更新"
    }

    const parts = [
        `新增 ${summary.added ?? 0}`,
        `跳过 ${summary.skipped ?? 0}`,
        `更新 ${summary.updated ?? 0}`,
        `删除 ${summary.removed ?? 0}`,
        `文件内重复 ${summary.duplicateInImport ?? 0}`,
    ]
    if ((summary.deduplicated ?? 0) > 0) {
        parts.push(`清理旧重复 ${summary.deduplicated}`)
    }
    return parts.join("，")
}

function formatImportTime(value) {
    if (!value) {
        return "-"
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toLocaleString("zh-CN", { hour12: false })
}

function importSourceText(record) {
    if (record?.sourcePath === "live-scan") {
        return "扫描导入"
    }

    return record?.sourcePath || "手动导入"
}

function renderImportRecordsModal() {
    const imports = [...(store?.imports ?? [])].reverse()
    if (els.importRecordsSummaryText) {
        els.importRecordsSummaryText.textContent = imports.length
            ? `当前账号共 ${imports.length} 次导入`
            : "当前账号还没有导入记录"
    }
    if (els.importRecordsTableWrap) {
        els.importRecordsTableWrap.hidden = imports.length === 0
    }
    if (els.importRecordsEmpty) {
        els.importRecordsEmpty.hidden = imports.length !== 0
    }
    if (!els.importRecordsTableBody) {
        return
    }

    els.importRecordsTableBody.innerHTML = ""
    for (const record of imports) {
        const warnings = record.warnings?.length ? ` · 警告 ${record.warnings.length}` : ""
        const row = document.createElement("tr")
        row.innerHTML = `
            <td><strong>${escapeHtml(formatImportTime(record.importedAt))}</strong></td>
            <td>${escapeHtml(importSourceText(record))}</td>
            <td>${escapeHtml(`${record.itemCount ?? 0} 条${record.removeMissing ? " · 同步删除" : ""}${warnings}`)}</td>
            <td>${escapeHtml(importSummaryText(record.summary))}</td>
        `
        els.importRecordsTableBody.appendChild(row)
    }
}

function openImportRecordsModal() {
    if (!els.importRecordsModal) {
        return
    }

    renderImportRecordsModal()
    els.importRecordsModal.hidden = false
    document.body.classList.add("modal-open")
}

function closeImportRecordsModal() {
    if (!els.importRecordsModal) {
        return
    }

    els.importRecordsModal.hidden = true
    document.body.classList.remove("modal-open")
}

function showImportSuccessNotice(summary) {
    showSuccessNotice({
        title: "导入完成",
        message: importSummaryText(summary),
        persist: true,
        actions: [
            {
                label: "查看导入记录",
                onClick: openImportRecordsModal,
            },
            {
                label: "关闭",
                closeOnClick: true,
            },
        ],
    })
}

function showImportErrorNotice(message) {
    showErrorNotice({
        title: "导入失败",
        message,
    })
}

async function importScannerFile(file) {
    if (!file) {
        return false
    }

    let items = null
    try {
        items = JSON.parse(await file.text())
    } catch (error) {
        throw new Error(`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`)
    }

    const removeMissing = Boolean(els.removeMissingInput?.checked)
    if (removeMissing) {
        const ok = await confirmDialog({
            title: "同步删除缺失驱动盘",
            message: `本次导入会按「${file.name}」进行完整同步，删除当前账号下未出现在文件中的驱动盘，并清空相关套装预设槽位。`,
            confirmText: "继续同步删除",
            tone: "danger",
        })
        if (!ok) {
            return false
        }
    }

    const response = await importScannerExportToStore(items, {
        sourcePath: file.name,
        removeMissing,
        setAliases: scannerSetAliases(),
    })
    store = response
    renderAll()
    setStatus("导入完成", "success")
    showImportSuccessNotice(response.summary ?? store.lastImportSummary)
    return true
}

async function clearInventory() {
    const driveDiscCount = store?.driveDiscs?.length ?? 0
    const importCount = store?.imports?.length ?? 0
    const loadoutCount = store?.driveDiscLoadouts?.length ?? 0
    const ok = await confirmDialog({
        title: "清空驱动盘仓库",
        message: `将删除 ${driveDiscCount} 个驱动盘、${importCount} 次导入记录和 ${loadoutCount} 个套装预设。维护界面的驱动盘资料不会受影响。`,
        confirmText: "清空仓库",
        tone: "danger",
    })
    if (!ok) {
        return false
    }

    const response = await clearUserDriveDiscStore()
    store = response.store
    selectedId = null
    selectedLoadoutId = null
    els.importFileInput.value = ""
    closeModal()
    closeLoadoutModal()
    renderAll()
    return true
}

async function saveCurrentDisc() {
    const disc = buildDiscFromForm()
    const exists = Boolean((store?.driveDiscs ?? []).find(item => item.id === disc.id))
    store = await upsertUserDriveDisc(disc)
    selectedId = disc.id
    closeModal()
    renderAll()
    return { disc, exists }
}

async function deleteCurrentDisc() {
    const disc = currentDisc()
    if (!disc) {
        return null
    }

    const ok = await confirmDialog({
        title: "删除驱动盘",
        message: `确认删除「${disc.setName} ${disc.partition}号位」？相关套装预设中的槽位会被清理。`,
        confirmText: "删除驱动盘",
        tone: "danger",
    })
    if (!ok) {
        return null
    }

    const response = await deleteUserDriveDisc(disc.id)
    store = response.store
    selectedId = null
    closeModal()
    renderAll()
    return { disc }
}

els.refreshBtn.addEventListener("click", async () => {
    try {
        setStatus("刷新中", "idle")
        await loadStore()
        setStatus("就绪", "success")
    } catch (error) {
        const message = errorMessage(error)
        setStatus("刷新失败", "error")
        showErrorNotice({
            title: "刷新失败",
            message,
        })
    }
})

els.newDiscBtn.addEventListener("click", () => openModal(null))

els.inventoryViewTabs?.addEventListener("click", event => {
    const button = event.target.closest("[data-inventory-view]")
    if (!button) {
        return
    }
    setInventoryView(button.dataset.inventoryView, { updateHash: true })
})

window.addEventListener("hashchange", () => {
    setInventoryView(inventoryViewFromHash())
})

els.importBtn.addEventListener("click", () => {
    els.importFileInput.value = ""
    els.importFileInput.click()
})

els.importFileInput.addEventListener("change", async () => {
    const file = els.importFileInput.files?.[0]
    if (!file) {
        return
    }

    try {
        els.importBtn.disabled = true
        clearPageNotice()
        setStatus("导入中", "idle")
        const imported = await importScannerFile(file)
        if (!imported) {
            setStatus("已取消导入", "idle")
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus("导入失败", "error")
        showImportErrorNotice(message)
    } finally {
        els.importBtn.disabled = false
    }
})

els.clearInventoryBtn.addEventListener("click", async () => {
    try {
        clearPageNotice()
        setStatus("清空仓库", "idle")
        const cleared = await clearInventory()
        if (cleared) {
            setStatus("仓库已清空", "success")
            showSuccessNotice({
                title: "仓库已清空",
                message: "驱动盘、导入记录和套装预设已清空。",
            })
        } else {
            setStatus("就绪", "idle")
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("清空失败", "error")
        showErrorNotice({
            title: "清空仓库失败",
            message,
        })
    }
})

for (const input of [els.searchInput, els.setFilter, els.mainStatFilter, els.sortSelect]) {
    input.addEventListener("input", renderTable)
    input.addEventListener("change", renderTable)
}

els.slotTabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-slot]")
    if (!button) {
        return
    }

    els.slotFilter.value = button.dataset.slot
    syncSlotTabs()
    renderTable()
})

els.discTableBody.addEventListener("click", event => {
    const target = event.target.closest("[data-id]")
    const row = target ?? event.target.closest("tr[data-id]")
    if (!row) {
        return
    }

    const disc = (store?.driveDiscs ?? []).find(item => item.id === row.dataset.id)
    if (disc) {
        openModal(disc)
    }
})

els.loadoutTableBody?.addEventListener("click", event => {
    const target = event.target.closest("[data-loadout-id]")
    const row = target ?? event.target.closest("tr[data-loadout-id]")
    if (!row) {
        return
    }

    const loadout = (store?.driveDiscLoadouts ?? []).find(item => item.id === row.dataset.loadoutId)
    if (loadout) {
        openLoadoutModal(loadout)
    }
})

els.setGrid.addEventListener("click", event => {
    const button = event.target.closest("button[data-set-id]")
    if (!button) {
        return
    }

    chooseSet(getSetById(button.dataset.setId) ?? availableSets().find(set => set.id === button.dataset.setId))
})

els.partitionGrid.addEventListener("click", event => {
    const button = event.target.closest("button[data-slot]")
    if (!button) {
        return
    }

    els.partitionInput.value = button.dataset.slot
    renderPartitionGrid()
    updateMainStatOptions()
    els.selectedTag.textContent = `${selectedSetName || "未选择套装"} · ${els.partitionInput.value}号位`
})

els.rarityButtons.addEventListener("click", event => {
    const button = event.target.closest("button[data-rarity]")
    if (button) {
        setRarity(button.dataset.rarity)
    }
})

els.levelInput.addEventListener("input", () => setLevel(els.levelInput.value))
els.levelRange.addEventListener("input", () => setLevel(els.levelRange.value))
els.levelMinusBtn.addEventListener("click", () => setLevel(Number(els.levelInput.value) - 1))
els.levelPlusBtn.addEventListener("click", () => setLevel(Number(els.levelInput.value) + 1))
els.mainStatSelect.addEventListener("change", () => {
    els.mainStatValueInput.value = defaultMainValue(els.mainStatSelect.value)
})

els.closeDiscModalBtn.addEventListener("click", closeModal)
els.discModal.addEventListener("click", event => {
    if (event.target.matches("[data-close-modal]")) {
        closeModal()
    }
})
els.closeLoadoutModalBtn?.addEventListener("click", closeLoadoutModal)
els.loadoutModal?.addEventListener("click", event => {
    if (event.target.matches("[data-close-loadout-modal]")) {
        closeLoadoutModal()
    }
})
els.importRecordsCloseBtn?.addEventListener("click", closeImportRecordsModal)
els.importRecordsModal?.addEventListener("click", event => {
    if (event.target.matches("[data-close-import-records-modal]")) {
        closeImportRecordsModal()
    }
})
els.loadoutSlotEditors?.addEventListener("change", event => {
    const select = event.target.closest("select[data-loadout-slot]")
    if (!select) {
        return
    }
    const card = select.closest(".loadout-slot-card")
    if (!card) {
        return
    }
    renderLoadoutSlotCardPreview(card, select.value, Number(select.dataset.loadoutSlot), currentLoadout())
})
els.saveLoadoutBtn?.addEventListener("click", async () => {
    try {
        clearPageNotice()
        setStatus("保存套装", "idle")
        const saved = await saveCurrentLoadout()
        if (saved) {
            setStatus("已保存", "success")
            showSuccessNotice({
                title: "套装预设已保存",
                message: `「${saved.name}」已更新。`,
            })
        } else {
            setStatus("就绪", "idle")
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("保存失败", "error")
        showErrorNotice({
            title: "保存套装预设失败",
            message,
        })
    }
})
els.deleteLoadoutBtn?.addEventListener("click", async () => {
    try {
        clearPageNotice()
        setStatus("删除套装", "idle")
        const deleted = await deleteCurrentLoadout()
        if (deleted) {
            setStatus("已删除", "success")
            showSuccessNotice({
                title: "套装预设已删除",
                message: `「${deleted.name}」已删除，仓库驱动盘未受影响。`,
            })
        } else {
            setStatus("就绪", "idle")
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("删除失败", "error")
        showErrorNotice({
            title: "删除套装预设失败",
            message,
        })
    }
})

els.discForm.addEventListener("submit", async event => {
    event.preventDefault()
    try {
        clearPageNotice()
        setStatus("保存中", "idle")
        const saved = await saveCurrentDisc()
        setStatus("已保存", "success")
        showSuccessNotice({
            title: "驱动盘已保存",
            message: `${saved.disc.setName} ${saved.disc.partition}号位已${saved.exists ? "更新" : "加入仓库"}。`,
        })
    } catch (error) {
        const message = errorMessage(error)
        setStatus("保存失败", "error")
        showErrorNotice({
            title: "保存驱动盘失败",
            message,
        })
    }
})

els.deleteDiscBtn.addEventListener("click", async () => {
    try {
        clearPageNotice()
        setStatus("删除中", "idle")
        const deleted = await deleteCurrentDisc()
        if (deleted) {
            setStatus("已删除", "success")
            showSuccessNotice({
                title: "驱动盘已删除",
                message: `${deleted.disc.setName} ${deleted.disc.partition}号位已删除，相关套装槽位已清理。`,
            })
        } else {
            setStatus("就绪", "idle")
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("删除失败", "error")
        showErrorNotice({
            title: "删除驱动盘失败",
            message,
        })
    }
})

// --- Scanner bridge ---

const scanner = new ScannerBridge()
let scanPollTimer = null

function openScanModal(connected) {
    els.scanModal.hidden = false
    document.body.classList.add("modal-open")
    els.scanHelperGuide.hidden = connected
    els.scanControls.hidden = !connected
    els.scanProgressArea.hidden = true
    els.scanStartBtn.hidden = false
    els.scanStopBtn.hidden = true
    els.scanStatusText.textContent = connected ? "已连接，可以开始扫描" : "未检测到扫描助手"
}

function setScannerConnected(message = "已连接，正在准备 OCR 扫描器...") {
    els.scanHelperGuide.hidden = true
    els.scanControls.hidden = false
    els.scanStartBtn.disabled = scanner.mode === "helper"
    els.scanStatusText.textContent = message
    if (scanner.mode === "helper") {
        els.scanProgressArea.hidden = false
        els.scanProgressFill.style.width = "12%"
        setScanProgress("正在检查扫描器版本...")
        scanner.ensureScanner().catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            els.scanStartBtn.disabled = false
            els.scanProgressArea.hidden = true
            els.scanStatusText.textContent = `准备失败：${message}`
            showErrorNotice({ title: "准备扫描器失败", message })
        })
    } else {
        els.scanStartBtn.disabled = false
        els.scanProgressArea.hidden = true
    }
}

function closeScanModal() {
    stopScanPoll()
    els.scanModal.hidden = true
    document.body.classList.remove("modal-open")
    if (scanner.scanning) {
        scanner.stopScan()
    }
    scanner.disconnect()
}

function startScanPoll() {
    stopScanPoll()
    scanner.launchHelper()
    scanPollTimer = setInterval(async () => {
        try {
            await scanner.connect()
            stopScanPoll()
            setScannerConnected()
        } catch {}
    }, 3000)
}

function stopScanPoll() {
    if (scanPollTimer) {
        clearInterval(scanPollTimer)
        scanPollTimer = null
    }
}

function setScanProgress(text, percent = null) {
    els.scanProgressText.textContent = text
    if (percent !== null) {
        els.scanProgressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`
    }
}

function setScanningState(active) {
    els.scanStartBtn.hidden = active
    els.scanStopBtn.hidden = !active
    els.scanProgressArea.hidden = !active
    els.scanBtn.disabled = active
    els.scanStatusText.textContent = active ? "扫描进行中..." : "扫描就绪"
    if (active) {
        els.scanProgressFill.style.width = "0%"
        setScanProgress("准备中...")
    }
}

async function tryConnectScanner() {
    openScanModal(false)
    bindScannerEvents()
    try {
        await scanner.connect()
        setScannerConnected()
    } catch {
        scanner.launchHelper()
        els.scanHelperGuide.hidden = false
        els.scanControls.hidden = true
        els.scanStatusText.textContent = "正在唤起扫描助手..."
        startScanPoll()
    }
}

function bindScannerEvents() {
    scanner.onLauncherProgress = (data) => {
        const stage = data?.stage || ""
        const pct = stage === "manifest" ? 18
            : stage === "download" ? 34
            : stage === "checksum" ? 68
            : stage === "extract" ? 82
            : stage === "ready" ? 100
            : 20
        els.scanProgressArea.hidden = false
        els.scanProgressFill.style.width = `${pct}%`
        setScanProgress(data?.message || "正在准备扫描器...")
        els.scanStatusText.textContent = "正在准备本地 OCR 扫描器..."
    }

    scanner.onScannerReady = () => {
        els.scanStartBtn.disabled = false
        els.scanProgressArea.hidden = true
        els.scanStatusText.textContent = "已连接，可以开始扫描"
    }

    scanner.onProgress = (data) => {
        const total = data.queued || 1
        const done = data.completed + data.failed
        const pct = total > 0 ? (done / total) * 100 : 0
        setScanProgress(
            `访问 ${data.visited} / 完成 ${data.completed} / 失败 ${data.failed}`,
            pct,
        )
    }

    scanner.onItem = () => {}

    scanner.onComplete = async (data) => {
        setScanningState(false)
        closeScanModal()
        if (!data?.items?.length) {
            setStatus("扫描完成（无结果）", "idle")
            showSuccessNotice({ title: "扫描完成", message: "未扫描到驱动盘。" })
            return
        }
        try {
            setStatus("导入中", "idle")
            const response = await importScannerExportToStore(data.items, {
                sourcePath: "live-scan",
                removeMissing: Boolean(els.scanRemoveMissing.checked),
                setAliases: scannerSetAliases(),
            })
            store = response
            renderAll()
            setStatus("扫描导入完成", "success")
            showImportSuccessNotice(response.summary ?? store.lastImportSummary)
        } catch (error) {
            setStatus("导入失败", "error")
            showErrorNotice({ title: "扫描导入失败", message: error instanceof Error ? error.message : String(error) })
        }
    }

    scanner.onError = (data) => {
        setScanningState(false)
        els.scanStartBtn.disabled = false
        const msg = data?.message || "扫描出错"
        els.scanStatusText.textContent = `扫描失败：${msg}`
        showErrorNotice({ title: "扫描失败", message: msg })
    }

    scanner.onDisconnect = () => {
        if (scanner.scanning) {
            setScanningState(false)
            els.scanStatusText.textContent = "扫描助手连接断开"
            showErrorNotice({ title: "扫描中断", message: "与扫描助手的连接已断开。" })
        }
    }
}

async function startLiveScan() {
    const rarities = []
    if (els.scanRarityS.checked) rarities.push("S")
    if (els.scanRarityA.checked) rarities.push("A")
    if (rarities.length === 0) {
        showErrorNotice({ title: "请至少选择一个品质" })
        return
    }

    const removeMissing = Boolean(els.scanRemoveMissing.checked)
    if (removeMissing) {
        const ok = await confirmDialog({
            title: "同步删除缺失驱动盘",
            message: "本次扫描导入会进行完整同步，删除当前账号下未出现在扫描结果中的驱动盘，并清空相关套装预设槽位。",
            confirmText: "继续",
            tone: "danger",
        })
        if (!ok) return
    }

    setScanningState(true)
    clearPageNotice()
    bindScannerEvents()
    await scanner.ensureScanner()

    scanner.startScan({
        maxItems: Number(els.scanMaxItems.value) || 0,
        rarities,
        stopAtNonLevel15: els.scanStopNon15.checked,
        fastMode: true,
        captureMode: "dxgi",
        panelMinAcceptFloorMs: 110,
        postScrollPanelAcceptMode: "adaptive-after-scroll",
    })
}

els.scanBtn.addEventListener("click", () => tryConnectScanner())
els.scanCloseBtn.addEventListener("click", () => closeScanModal())
els.scanModal.querySelector("[data-close-scan-modal]")?.addEventListener("click", () => closeScanModal())
els.scanStartBtn.addEventListener("click", () => startLiveScan())
els.scanStopBtn.addEventListener("click", () => {
    scanner.stopScan()
    els.scanStatusText.textContent = "正在停止..."
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        setInventoryView(inventoryViewFromHash())
        await loadMeta()
        await loadStore()
        if (new URLSearchParams(window.location.search).get("new") === "1") {
            openModal(null)
        }
        setStatus("就绪", "success")
    } catch (error) {
        const message = errorMessage(error)
        setStatus("加载失败", "error")
        showErrorNotice({
            title: "驱动盘加载失败",
            message,
        })
        console.error(error)
    }
}

bootstrap()
