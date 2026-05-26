const els = {
    status: document.getElementById("status"),
    refreshBtn: document.getElementById("refreshBtn"),
    newDiscBtn: document.getElementById("newDiscBtn"),
    totalCount: document.getElementById("totalCount"),
    setCount: document.getElementById("setCount"),
    importCount: document.getElementById("importCount"),
    filteredCount: document.getElementById("filteredCount"),
    importPanelToggle: document.getElementById("importPanelToggle"),
    importPanel: document.getElementById("importPanel"),
    importPathInput: document.getElementById("importPathInput"),
    importFileInput: document.getElementById("importFileInput"),
    importTextarea: document.getElementById("importTextarea"),
    importBtn: document.getElementById("importBtn"),
    clearImportBtn: document.getElementById("clearImportBtn"),
    searchInput: document.getElementById("searchInput"),
    slotFilter: document.getElementById("slotFilter"),
    slotTabs: document.getElementById("slotTabs"),
    setFilter: document.getElementById("setFilter"),
    mainStatFilter: document.getElementById("mainStatFilter"),
    sortSelect: document.getElementById("sortSelect"),
    discTableBody: document.getElementById("discTableBody"),
    emptyInventory: document.getElementById("emptyInventory"),
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
}

const EMPTY_DISC_IMAGE = "/assets/drive-discs/empty.svg"
const STAT_OPTIONS = [
    ["hpFlat", "生命值"],
    ["hpPct", "生命值%"],
    ["atkFlat", "攻击力"],
    ["atkPct", "攻击力%"],
    ["defFlat", "防御力"],
    ["defPct", "防御力%"],
    ["critRate", "暴击率"],
    ["critDmg", "暴击伤害"],
    ["impact", "冲击力"],
    ["anomalyProficiency", "异常精通"],
    ["anomalyMastery", "异常掌控"],
    ["energyRegen", "能量自动回复"],
    ["penFlat", "穿透值"],
    ["penRatio", "穿透率"],
    ["physicalDmg", "物理伤害加成"],
    ["fireDmg", "火属性伤害加成"],
    ["iceDmg", "冰属性伤害加成"],
    ["electricDmg", "电属性伤害加成"],
    ["etherDmg", "以太伤害加成"],
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
])

let meta = null
let store = null
let selectedId = null
let selectedSetId = null
let selectedSetName = ""

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
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
        return `${Number((value * 100).toFixed(1))}%`
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
        ? Number((item.value * 100).toFixed(3))
        : item.value
}

function inputToValue(stat, rawValue) {
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
        return 0
    }

    return isPercentStat(stat) ? Number((value / 100).toFixed(12)) : value
}

function defaultMainValue(stat) {
    const value = meta?.statRules?.driveDisc?.sRankMaxMainStat?.[stat]
    if (typeof value !== "number") {
        return ""
    }

    return isPercentStat(stat) ? Number((value * 100).toFixed(3)) : value
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
    for (const button of els.slotTabs.querySelectorAll("button[data-slot]")) {
        button.classList.toggle("active", button.dataset.slot === els.slotFilter.value)
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
    els.totalCount.textContent = String(discs.length)
    els.setCount.textContent = `${new Set(discs.map(item => item.setName)).size} 套`
    els.importCount.textContent = `${store?.imports?.length ?? 0} 次导入`
}

function renderTable() {
    const discs = filteredDiscs()
    const total = store?.driveDiscs?.length ?? 0
    els.filteredCount.textContent = `显示 ${discs.length} / ${total}`
    els.discTableBody.innerHTML = ""
    els.emptyInventory.hidden = discs.length !== 0
    document.querySelector(".clean-table-wrap").hidden = discs.length === 0

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

function renderAll() {
    populateFilters()
    renderSummary()
    renderTable()
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
        ownerId: existing?.ownerId ?? "default",
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
    meta = await api("/api/meta")
}

async function loadStore() {
    store = await api("/api/user-drive-discs")
    renderAll()
}

async function importScannerData() {
    const text = els.importTextarea.value.trim()
    let payload = null

    if (els.importFileInput.files?.[0]) {
        const fileText = await els.importFileInput.files[0].text()
        payload = {
            ownerId: "default",
            sourcePath: els.importFileInput.files[0].name,
            items: JSON.parse(fileText),
        }
    } else if (text) {
        payload = {
            ownerId: "default",
            sourcePath: els.importPathInput.value.trim() || null,
            items: JSON.parse(text),
        }
    } else {
        payload = {
            ownerId: "default",
            sourcePath: els.importPathInput.value.trim(),
        }
    }

    const response = await api("/api/user-drive-discs/import/zzz-scanner", {
        method: "POST",
        body: JSON.stringify(payload),
    })
    store = response.store
    renderAll()
}

async function saveCurrentDisc() {
    const disc = buildDiscFromForm()
    const exists = Boolean((store?.driveDiscs ?? []).find(item => item.id === disc.id))
    const response = await api(exists ? `/api/user-drive-discs/${encodeURIComponent(disc.id)}` : "/api/user-drive-discs", {
        method: exists ? "PUT" : "POST",
        body: JSON.stringify(disc),
    })
    store = response.store
    selectedId = disc.id
    closeModal()
    renderAll()
}

async function deleteCurrentDisc() {
    const disc = currentDisc()
    if (!disc) {
        return
    }

    const ok = window.confirm(`确认删除 ${disc.setName} ${disc.partition}号位？`)
    if (!ok) {
        return
    }

    const response = await api(`/api/user-drive-discs/${encodeURIComponent(disc.id)}`, {
        method: "DELETE",
    })
    store = response.store
    selectedId = null
    closeModal()
    renderAll()
}

els.importPanelToggle.addEventListener("click", () => {
    els.importPanel.hidden = !els.importPanel.hidden
})

els.refreshBtn.addEventListener("click", async () => {
    try {
        setStatus("刷新中", "idle")
        await loadStore()
        setStatus("就绪", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})

els.newDiscBtn.addEventListener("click", () => openModal(null))

els.importBtn.addEventListener("click", async () => {
    try {
        setStatus("导入中", "idle")
        await importScannerData()
        setStatus("导入完成", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})

els.clearImportBtn.addEventListener("click", () => {
    els.importTextarea.value = ""
    els.importFileInput.value = ""
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

els.discForm.addEventListener("submit", async event => {
    event.preventDefault()
    try {
        setStatus("保存中", "idle")
        await saveCurrentDisc()
        setStatus("已保存", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})

els.deleteDiscBtn.addEventListener("click", async () => {
    try {
        setStatus("删除中", "idle")
        await deleteCurrentDisc()
        setStatus("已删除", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})

async function bootstrap() {
    try {
        setStatus("加载中", "idle")
        await loadMeta()
        await loadStore()
        if (new URLSearchParams(window.location.search).get("new") === "1") {
            openModal(null)
        }
        setStatus("就绪", "success")
    } catch (error) {
        setStatus(error.message, "error")
        console.error(error)
    }
}

bootstrap()
