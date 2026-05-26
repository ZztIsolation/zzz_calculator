import { readFile } from "node:fs/promises"
import path from "node:path"

const BONUS_KEY_MAP = {
    hpFlat: "hpFlat",
    hpPct: "hpPct",
    atkFlat: "atkFlat",
    atkPct: "atkPct",
    defFlat: "defFlat",
    defPct: "defPct",
    critRate: "critRate",
    critDmg: "critDmg",
    impact: "impactPct",
    impactFlat: "impactFlat",
    anomalyProficiency: "anomalyProficiencyFlat",
    anomalyMastery: "anomalyMasteryFlat",
    energyRegen: "energyRegenPct",
    penFlat: "penFlat",
    penRatio: "penRatio",
    physicalResIgnore: "physicalResIgnore",
    dmgBonus: "dmgBonus",
    physicalDmg: "physicalDmg",
    fireDmg: "fireDmg",
    iceDmg: "iceDmg",
    electricDmg: "electricDmg",
    etherDmg: "etherDmg",
}

const BONUS_KEYS = [
    "hpFlat",
    "hpPct",
    "atkFlat",
    "atkPct",
    "defFlat",
    "defPct",
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
]

const OUTPUT_PANEL_KEYS = [
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
    "dmgBonus",
    "physicalDmg",
    "fireDmg",
    "iceDmg",
    "electricDmg",
    "etherDmg",
]

const CORE_BASE_STAT_MAP = {
    hpBase: "hp",
    atkBase: "atk",
    defBase: "def",
}

const COMBAT_PCT_BASIS_BY_STAT = {
    hpPct: {
        defaultBasis: "baseHp",
        baseKey: "hpPctBase",
        outOfCombatKey: "hpPctOutOfCombat",
    },
    atkPct: {
        defaultBasis: "baseAtk",
        baseKey: "atkPctBase",
        outOfCombatKey: "atkPctOutOfCombat",
    },
    defPct: {
        defaultBasis: "baseDef",
        baseKey: "defPctBase",
        outOfCombatKey: "defPctOutOfCombat",
    },
}

const COMBAT_PCT_KEY_BY_BASIS = {
    baseHp: "hpPctBase",
    outOfCombatHp: "hpPctOutOfCombat",
    baseAtk: "atkPctBase",
    outOfCombatAtk: "atkPctOutOfCombat",
    baseDef: "defPctBase",
    outOfCombatDef: "defPctOutOfCombat",
}

const COMBAT_BONUS_EXTRA_KEYS = [
    "hpPctBase",
    "hpPctOutOfCombat",
    "atkPctBase",
    "atkPctOutOfCombat",
    "defPctBase",
    "defPctOutOfCombat",
]

function roundNumbers(value) {
    if (typeof value === "number") {
        return Number(value.toFixed(12))
    }

    if (Array.isArray(value)) {
        return value.map(item => roundNumbers(item))
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, roundNumbers(item)])
        )
    }

    return value
}

function createBonusTotals() {
    return Object.fromEntries(BONUS_KEYS.map(key => [key, 0]))
}

function createCombatBonusTotals() {
    return {
        ...createBonusTotals(),
        ...Object.fromEntries(COMBAT_BONUS_EXTRA_KEYS.map(key => [key, 0])),
    }
}

function createPanel() {
    return Object.fromEntries(OUTPUT_PANEL_KEYS.map(key => [key, 0]))
}

function addBonus(totals, stat, value) {
    const key = BONUS_KEY_MAP[stat]
    if (!key) {
        return
    }

    totals[key] += value
}

function basisValue(outOfCombat, basis) {
    switch (basis) {
        case "baseHp":
            return Number(outOfCombat.base?.hp ?? 0)
        case "outOfCombatHp":
            return Number(outOfCombat.panel?.hp ?? 0)
        case "baseAtk":
            return Number(outOfCombat.base?.atk ?? 0)
        case "outOfCombatAtk":
            return Number(outOfCombat.panel?.atk ?? 0)
        case "baseDef":
            return Number(outOfCombat.base?.def ?? 0)
        case "outOfCombatDef":
            return Number(outOfCombat.panel?.def ?? 0)
        default:
            throw new Error(`Unsupported combat buff basis: ${basis}`)
    }
}

function flatStatForPct(stat) {
    if (stat === "hpPct") {
        return "hpFlat"
    }

    if (stat === "atkPct") {
        return "atkFlat"
    }

    if (stat === "defPct") {
        return "defFlat"
    }

    return stat
}

function addCombatStat(totals, stat, outOfCombat, resolvedStats) {
    const value = Number(stat.value ?? 0)
    const mode = stat.mode ?? "flat"
    const pctMeta = COMBAT_PCT_BASIS_BY_STAT[stat.stat]

    if (pctMeta && mode === "pct") {
        const basis = stat.basis ?? pctMeta.defaultBasis
        const key = basis === pctMeta.defaultBasis
            ? pctMeta.baseKey
            : COMBAT_PCT_KEY_BY_BASIS[basis] === pctMeta.outOfCombatKey
                ? pctMeta.outOfCombatKey
                : null
        if (!key) {
            throw new Error(`Unsupported combat buff basis for ${stat.stat}: ${basis}`)
        }

        totals[key] += value
        resolvedStats.push({
            ...stat,
            value,
            mode,
            basis,
            resolvedStat: flatStatForPct(stat.stat),
            resolvedValue: basisValue(outOfCombat, basis) * value,
        })
        return
    }

    addBonus(totals, stat.stat, value)
    resolvedStats.push({
        ...stat,
        value,
        mode,
    })
}

function normalizeEffect(effect) {
    if (!effect) {
        return null
    }

    const stats = Array.isArray(effect.stats)
        ? effect.stats
        : effect.statsByPhase?.["1"] ?? effect.statsByPhase?.[1] ?? []

    return {
        name: effect.name ?? null,
        scope: effect.scope ?? "outOfCombat",
        condition: effect.condition ?? null,
        stats: stats.map(item => ({
            stat: item.stat,
            value: Number(item.value ?? 0),
            mode: item.mode ?? "flat",
            basis: item.basis ?? null,
        })),
        appliesToOutOfCombatPanel: effect.appliesToOutOfCombatPanel ?? true,
    }
}

async function readJson(filePath) {
    const text = await readFile(filePath, "utf8")
    return JSON.parse(text)
}

function buildMaps(catalog) {
    const agents = new Map(catalog.agents.map(agent => [agent.id, agent]))
    const wEngines = new Map(catalog.wEngines.map(item => [item.id, item]))
    const sets = new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const combatBuffs = new Map((catalog.combatBuffs ?? []).map(item => [item.id, item]))
    return {
        agentsMap: agents,
        wEnginesMap: wEngines,
        driveDiscSetsMap: sets,
        combatBuffsMap: combatBuffs,
    }
}

function applyEffectSet(bonusTotals, effect, label, appliedEffects, ignoredEffects) {
    const normalized = normalizeEffect(effect)
    if (!normalized) {
        return
    }

    const isOutOfCombat = normalized.scope === "outOfCombat" && normalized.condition == null && normalized.appliesToOutOfCombatPanel !== false
    if (!isOutOfCombat) {
        ignoredEffects.push(label)
        return
    }

    for (const stat of normalized.stats) {
        addBonus(bonusTotals, stat.stat, stat.value)
    }

    appliedEffects.push({
        key: label,
        scope: normalized.scope,
        condition: normalized.condition,
        stats: normalized.stats,
    })
}

function applyCombatEffect({ bonusTotals, effect, key, name, sourceType, conditionLabel, outOfCombat, activeEffects, ignoredEffects }) {
    const normalized = normalizeEffect(effect)
    if (!normalized) {
        ignoredEffects.push({
            key,
            sourceType,
            reason: "missingEffect",
        })
        return
    }

    if (normalized.scope !== "inCombat") {
        ignoredEffects.push({
            key,
            sourceType,
            scope: normalized.scope,
            reason: "notInCombat",
        })
        return
    }

    const resolvedStats = []
    for (const stat of normalized.stats) {
        addCombatStat(bonusTotals, stat, outOfCombat, resolvedStats)
    }

    activeEffects.push({
        key,
        name: name ?? normalized.name,
        sourceType,
        scope: normalized.scope,
        condition: normalized.condition,
        conditionLabel: conditionLabel ?? effect.conditionLabel ?? normalized.condition ?? null,
        stats: normalized.stats,
        resolvedStats,
    })
}

function combatFlatFromPct(totals, outOfCombat) {
    return {
        hp: (outOfCombat.base.hp * totals.hpPctBase) + (outOfCombat.panel.hp * totals.hpPctOutOfCombat),
        atk: (outOfCombat.base.atk * totals.atkPctBase) + (outOfCombat.panel.atk * totals.atkPctOutOfCombat),
        def: (outOfCombat.base.def * totals.defPctBase) + (outOfCombat.panel.def * totals.defPctOutOfCombat),
    }
}

function calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals) {
    const panel = {
        ...createPanel(),
        ...outOfCombat.panel,
    }

    panel.hp = outOfCombat.panel.hp
        + bonusTotals.hpFlat
        + outOfCombat.base.hp * (bonusTotals.hpPct + bonusTotals.hpPctBase)
        + outOfCombat.panel.hp * bonusTotals.hpPctOutOfCombat
    panel.atk = outOfCombat.panel.atk
        + bonusTotals.atkFlat
        + outOfCombat.base.atk * (bonusTotals.atkPct + bonusTotals.atkPctBase)
        + outOfCombat.panel.atk * bonusTotals.atkPctOutOfCombat
    panel.def = outOfCombat.panel.def
        + bonusTotals.defFlat
        + outOfCombat.base.def * (bonusTotals.defPct + bonusTotals.defPctBase)
        + outOfCombat.panel.def * bonusTotals.defPctOutOfCombat
    panel.critRate = outOfCombat.panel.critRate + bonusTotals.critRate
    panel.critDmg = outOfCombat.panel.critDmg + bonusTotals.critDmg
    panel.impact = (outOfCombat.panel.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
    panel.anomalyProficiency = outOfCombat.panel.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
    panel.anomalyMastery = outOfCombat.panel.anomalyMastery + bonusTotals.anomalyMasteryFlat
    panel.energyRegen = outOfCombat.panel.energyRegen * (1 + bonusTotals.energyRegenPct)
    panel.penFlat = outOfCombat.panel.penFlat + bonusTotals.penFlat
    panel.penRatio = outOfCombat.panel.penRatio + bonusTotals.penRatio
    panel.physicalResIgnore = outOfCombat.panel.physicalResIgnore + bonusTotals.physicalResIgnore
    panel.dmgBonus = outOfCombat.panel.dmgBonus + bonusTotals.dmgBonus
    panel.physicalDmg = outOfCombat.panel.physicalDmg + bonusTotals.physicalDmg
    panel.fireDmg = outOfCombat.panel.fireDmg + bonusTotals.fireDmg
    panel.iceDmg = outOfCombat.panel.iceDmg + bonusTotals.iceDmg
    panel.electricDmg = outOfCombat.panel.electricDmg + bonusTotals.electricDmg
    panel.etherDmg = outOfCombat.panel.etherDmg + bonusTotals.etherDmg

    const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
    const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

    return {
        panel,
        selectedDmgBonus,
    }
}

function resolveAttributeBonusKey(agent) {
    const damageElement = agent.damageElement ?? agent.attribute
    return `${damageElement}Dmg`
}

function defaultCoreSkillLevel(agent) {
    const levels = agent.coreSkill?.levels ?? []
    return agent.coreSkill?.defaultLevel ?? levels.at(-1)?.level ?? "none"
}

function activeCoreSkillLevels(agent, requestedLevel) {
    const levels = agent.coreSkill?.levels ?? []
    const selectedLevel = requestedLevel ?? defaultCoreSkillLevel(agent)
    if (!levels.length || selectedLevel === "none" || selectedLevel == null || selectedLevel === "") {
        return {
            selectedLevel: "none",
            levels: [],
        }
    }

    const selectedIndex = levels.findIndex(item => item.level === selectedLevel)
    if (selectedIndex < 0) {
        throw new Error(`Unknown core skill level for ${agent.id}: ${selectedLevel}`)
    }

    return {
        selectedLevel,
        levels: levels.slice(0, selectedIndex + 1),
    }
}

function collectCoreSkillBonuses(agent, requestedLevel) {
    const active = activeCoreSkillLevels(agent, requestedLevel)
    const baseAdditions = {
        hp: 0,
        atk: 0,
        def: 0,
    }
    const panelBonuses = []
    const appliedEffects = []

    for (const level of active.levels) {
        const stats = (level.stats ?? []).map(item => ({
            stat: item.stat,
            value: Number(item.value ?? 0),
            mode: item.mode ?? "flat",
            target: item.target ?? (CORE_BASE_STAT_MAP[item.stat] ? "base" : "panel"),
        }))

        for (const stat of stats) {
            const baseKey = CORE_BASE_STAT_MAP[stat.stat]
            if (stat.target === "base" && baseKey) {
                baseAdditions[baseKey] += stat.value
            } else {
                panelBonuses.push(stat)
            }
        }

        appliedEffects.push({
            key: `${agent.id}.coreSkill.${level.level}`,
            scope: "outOfCombat",
            condition: null,
            stats,
        })
    }

    return {
        selectedLevel: active.selectedLevel,
        appliedLevels: active.levels.map(level => level.level),
        baseAdditions,
        panelBonuses,
        appliedEffects,
    }
}

function calculatePanel({ agent, wEngine, driveDiscs, driveDiscSets, coreSkillLevel }) {
    const coreSkill = collectCoreSkillBonuses(agent, coreSkillLevel)
    const base = {
        hp: Number(agent.level60.hpBase ?? 0) + coreSkill.baseAdditions.hp,
        atk: Number(agent.level60.atkBase ?? 0) + Number(wEngine.level60.atkBase ?? 0) + coreSkill.baseAdditions.atk,
        def: Number(agent.level60.defBase ?? 0) + coreSkill.baseAdditions.def,
    }

    const baseBreakdown = {
        agent: {
            hp: Number(agent.level60.hpBase ?? 0),
            atk: Number(agent.level60.atkBase ?? 0),
            def: Number(agent.level60.defBase ?? 0),
        },
        wEngine: {
            hp: 0,
            atk: Number(wEngine.level60.atkBase ?? 0),
            def: 0,
        },
        coreSkill: coreSkill.baseAdditions,
        total: base,
    }

    const basePanelStats = {
        critRate: Number(agent.level60.critRate ?? 0),
        critDmg: Number(agent.level60.critDmg ?? 0),
        impact: Number(agent.level60.impact ?? 0),
        anomalyProficiency: Number(agent.level60.anomalyProficiency ?? 0),
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0),
        energyRegen: Number(agent.level60.energyRegen ?? 1),
        penFlat: Number(agent.level60.penFlat ?? 0),
        penRatio: Number(agent.level60.penRatio ?? 0),
        dmgBonus: Number(agent.level60.dmgBonus ?? 0),
    }

    const bonusTotals = createBonusTotals()

    if (wEngine.level60.advancedStat) {
        addBonus(
            bonusTotals,
            wEngine.level60.advancedStat.stat,
            Number(wEngine.level60.advancedStat.value ?? 0)
        )
    }

    for (const bonus of coreSkill.panelBonuses) {
        addBonus(bonusTotals, bonus.stat, bonus.value)
    }

    const setCounts = new Map()
    for (const disc of driveDiscs) {
        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)

        addBonus(bonusTotals, disc.mainStat.stat, Number(disc.mainStat.value ?? 0))
        for (const subStat of disc.subStats ?? []) {
            addBonus(bonusTotals, subStat.stat, Number(subStat.value ?? 0))
        }
    }

    const appliedEffects = []
    const ignoredEffects = []

    for (const [setId, count] of setCounts.entries()) {
        const set = driveDiscSets.get(setId)
        if (!set) {
            ignoredEffects.push(`${setId}.missing`)
            continue
        }

        if (count >= 2) {
            applyEffectSet(
                bonusTotals,
                set.twoPiece,
                `${setId}.twoPiece`,
                appliedEffects,
                ignoredEffects
            )
        }

        if (count >= 4) {
            applyEffectSet(
                bonusTotals,
                set.fourPiece,
                `${setId}.fourPiece`,
                appliedEffects,
                ignoredEffects
            )
        } else if (set.fourPiece) {
            ignoredEffects.push(`${setId}.fourPiece`)
        }
    }

    if (wEngine.passive) {
        applyEffectSet(
            bonusTotals,
            wEngine.passive,
            `${wEngine.id}.passive`,
            appliedEffects,
            ignoredEffects
        )
    }

    appliedEffects.unshift(...coreSkill.appliedEffects)

    const panel = createPanel()
    panel.hp = base.hp * (1 + bonusTotals.hpPct) + bonusTotals.hpFlat
    panel.atk = base.atk * (1 + bonusTotals.atkPct) + bonusTotals.atkFlat
    panel.def = base.def * (1 + bonusTotals.defPct) + bonusTotals.defFlat
    panel.critRate = basePanelStats.critRate + bonusTotals.critRate
    panel.critDmg = basePanelStats.critDmg + bonusTotals.critDmg
    panel.impact = (basePanelStats.impact * (1 + bonusTotals.impactPct)) + bonusTotals.impactFlat
    panel.anomalyProficiency = basePanelStats.anomalyProficiency + bonusTotals.anomalyProficiencyFlat
    panel.anomalyMastery = basePanelStats.anomalyMastery + bonusTotals.anomalyMasteryFlat
    panel.energyRegen = basePanelStats.energyRegen * (1 + bonusTotals.energyRegenPct)
    panel.penFlat = basePanelStats.penFlat + bonusTotals.penFlat
    panel.penRatio = basePanelStats.penRatio + bonusTotals.penRatio
    panel.physicalResIgnore = bonusTotals.physicalResIgnore
    panel.dmgBonus = basePanelStats.dmgBonus + bonusTotals.dmgBonus
    panel.physicalDmg = bonusTotals.physicalDmg
    panel.fireDmg = bonusTotals.fireDmg
    panel.iceDmg = bonusTotals.iceDmg
    panel.electricDmg = bonusTotals.electricDmg
    panel.etherDmg = bonusTotals.etherDmg

    const selectedAttributeBonusKey = resolveAttributeBonusKey(agent)
    const selectedDmgBonus = (panel.dmgBonus ?? 0) + (panel[selectedAttributeBonusKey] ?? 0)

    const simpleTargetScore = panel.atk
        * (1 + Math.min(panel.critRate, 1) * panel.critDmg)
        * (1 + selectedDmgBonus)

    return roundNumbers({
        base,
        baseBreakdown,
        bonusTotals,
        panel,
        simpleTargetScore,
        selectedDmgBonus,
        coreSkill,
        appliedEffects,
        ignoredEffects,
    })
}

export async function loadCatalog(dataDir, exampleDir) {
    const [agentsRaw, wEnginesRaw, driveDiscSetsRaw, combatBuffsRaw, statRulesRaw, exampleRaw, yeShunguangExampleRaw] = await Promise.all([
        readJson(path.join(dataDir, "agents.json")),
        readJson(path.join(dataDir, "w_engines.json")),
        readJson(path.join(dataDir, "drive_disc_sets.json")),
        readJson(path.join(dataDir, "combat_buffs.json")),
        readJson(path.join(dataDir, "stat_rules.json")),
        readJson(path.join(exampleDir, "out_of_combat_panel.example.json")),
        readJson(path.join(exampleDir, "ye_shunguang_panel.example.json")),
    ])

    const catalog = {
        agents: agentsRaw.agents ?? [],
        wEngines: wEnginesRaw.wEngines ?? [],
        driveDiscSets: driveDiscSetsRaw.sets ?? [],
        combatBuffs: combatBuffsRaw.buffs ?? [],
        statRules: statRulesRaw,
        example: exampleRaw,
        examples: {
            outOfCombat: exampleRaw,
            yeShunguang: yeShunguangExampleRaw,
        },
    }

    const maps = buildMaps(catalog)
    return {
        ...catalog,
        ...maps,
    }
}

export function buildMeta(catalog) {
    return {
        agents: catalog.agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            rarity: agent.rarity,
            attribute: agent.attribute,
            damageElement: agent.damageElement,
            specialty: agent.specialty,
            faction: agent.faction,
            images: agent.images,
            coreSkill: agent.coreSkill,
        })),
        wEngines: catalog.wEngines.map(item => ({
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            specialty: item.specialty,
            attribute: item.attribute,
            level60: item.level60,
            passive: item.passive,
            relatedAgentId: item.relatedAgentId,
            images: item.images,
        })),
        driveDiscSets: catalog.driveDiscSets.map(item => ({
            id: item.id,
            name: item.name,
            images: item.images,
            twoPiece: item.twoPiece,
            fourPiece: item.fourPiece,
        })),
        combatBuffs: (catalog.combatBuffs ?? [])
            .filter(item => !item.hidden)
            .map(item => ({
                id: item.id,
                sourceType: item.sourceType,
                name: item.name,
                conditionLabel: item.conditionLabel,
                stats: item.stats ?? [],
            })),
        statRules: catalog.statRules,
    }
}

export function calculateOutOfCombatPanel(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const wEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!wEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []

    return calculatePanel({ agent, wEngine, driveDiscs, driveDiscSets, coreSkillLevel: input.coreSkillLevel })
}

export function calculateInCombatPanel(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const wEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!wEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const driveDiscs = Array.isArray(input.driveDiscs) ? input.driveDiscs : []
    const combatInput = input.combatBuffs ?? input.combat ?? {}
    const activeBuffIds = new Set(Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []

    const outOfCombat = calculateOutOfCombatPanel(catalog, input)
    const bonusTotals = createCombatBonusTotals()
    const activeEffects = []
    const ignoredEffects = []

    for (const buff of catalog.combatBuffs ?? []) {
        if (!activeBuffIds.has(buff.id)) {
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect: buff,
            key: buff.id,
            name: buff.name,
            sourceType: buff.sourceType ?? "manual",
            conditionLabel: buff.conditionLabel,
            outOfCombat,
            activeEffects,
            ignoredEffects,
        })
    }

    const wEnginePassiveKey = `wEngine:${wEngine.id}.passive`
    if (activeBuffIds.has(wEnginePassiveKey)) {
        if (!wEngine.passive) {
            ignoredEffects.push({
                key: wEnginePassiveKey,
                sourceType: "self",
                reason: "missingEffect",
            })
        } else if (wEngine.specialty && wEngine.specialty !== agent.specialty) {
            ignoredEffects.push({
                key: wEnginePassiveKey,
                sourceType: "self",
                reason: "specialtyMismatch",
            })
        } else {
            applyCombatEffect({
                bonusTotals,
                effect: wEngine.passive,
                key: wEnginePassiveKey,
                name: wEngine.passive.name ?? wEngine.name,
                sourceType: "self",
                conditionLabel: wEngine.passive.condition,
                outOfCombat,
                activeEffects,
                ignoredEffects,
            })
        }
    }

    const setCounts = new Map()
    for (const disc of driveDiscs) {
        if (!disc.setId) {
            continue
        }

        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
    }

    for (const activeId of activeBuffIds) {
        if (!activeId.startsWith("driveDisc4pc:")) {
            continue
        }

        const setId = activeId.slice("driveDisc4pc:".length)
        const set = driveDiscSets.get(setId)
        const count = setCounts.get(setId) ?? 0

        if (!set) {
            ignoredEffects.push({
                key: activeId,
                sourceType: "driveDisc4pc",
                reason: "missingSet",
            })
            continue
        }

        if (count < 4) {
            ignoredEffects.push({
                key: activeId,
                sourceType: "driveDisc4pc",
                reason: "notEquipped4pc",
            })
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect: set.fourPiece,
            key: activeId,
            name: set.name,
            sourceType: "driveDisc4pc",
            conditionLabel: set.fourPiece?.condition,
            outOfCombat,
            activeEffects,
            ignoredEffects,
        })
    }

    teammateDriveDiscSetIds.forEach((setId, index) => {
        if (!setId) {
            return
        }

        const key = `teammateDriveDisc4pc:${index + 1}:${setId}`
        const set = driveDiscSets.get(setId)
        if (!set) {
            ignoredEffects.push({
                key,
                sourceType: "driveDisc4pc",
                reason: "missingSet",
            })
            return
        }

        applyCombatEffect({
            bonusTotals,
            effect: set.fourPiece,
            key,
            name: set.name,
            sourceType: "driveDisc4pc",
            conditionLabel: set.fourPiece?.condition,
            outOfCombat,
            activeEffects,
            ignoredEffects,
        })
    })

    manualStats.forEach((item, index) => {
        const value = Number(item?.value ?? 0)
        if (!item?.stat || !Number.isFinite(value) || value === 0) {
            return
        }

        const key = item.id ? `manual:${item.id}` : `manual:${index + 1}`
        applyCombatEffect({
            bonusTotals,
            effect: {
                scope: "inCombat",
                condition: null,
                stats: [
                    {
                        stat: item.stat,
                        value,
                        mode: item.mode ?? "flat",
                        basis: item.basis ?? null,
                    },
                ],
            },
            key,
            name: {
                zhCN: item.label ?? "手动修正",
                en: item.label ?? "Manual Correction",
            },
            sourceType: "manual",
            conditionLabel: null,
            outOfCombat,
            activeEffects,
            ignoredEffects,
        })
    })

    const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
    const flatFromPct = combatFlatFromPct(bonusTotals, outOfCombat)

    return roundNumbers({
        outOfCombat,
        inCombat: {
            panel: inCombatPanel.panel,
            selectedDmgBonus: inCombatPanel.selectedDmgBonus,
            buffTotals: bonusTotals,
            activeEffects,
            ignoredEffects,
            breakdown: {
                flatFromPct,
                basis: {
                    base: outOfCombat.base,
                    outOfCombatPanel: outOfCombat.panel,
                },
            },
        },
    })
}

export async function loadCalculatorContext(rootDir) {
    const dataDir = path.join(rootDir, "data")
    const exampleDir = path.join(rootDir, "examples")
    const catalog = await loadCatalog(dataDir, exampleDir)
    return catalog
}
