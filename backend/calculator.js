import { readFile } from "node:fs/promises"
import path from "node:path"
import { evaluateFormulaExpression } from "../frontend/formulaEvaluator.js"

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
    impactPct: "impactPct",
    impactFlat: "impactFlat",
    anomalyProficiency: "anomalyProficiencyFlat",
    anomalyProficiencyFlat: "anomalyProficiencyFlat",
    anomalyMastery: "anomalyMasteryFlat",
    anomalyMasteryFlat: "anomalyMasteryFlat",
    energyRegen: "energyRegenPct",
    energyRegenPct: "energyRegenPct",
    penFlat: "penFlat",
    penRatio: "penRatio",
    physicalResIgnore: "physicalResIgnore",
    fireResIgnore: "fireResIgnore",
    iceResIgnore: "iceResIgnore",
    electricResIgnore: "electricResIgnore",
    etherResIgnore: "etherResIgnore",
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

const COMBAT_TARGET_BONUS_KEYS = [
    "enemyDefReduction",
    "enemyDefFlatReduction",
    "enemyResReduction",
    "enemyPhysicalResReduction",
    "enemyFireResReduction",
    "enemyIceResReduction",
    "enemyElectricResReduction",
    "enemyEtherResReduction",
]

const DAMAGE_ELEMENTS = ["physical", "fire", "ice", "electric", "ether"]
const DAMAGE_ELEMENT_LABELS = {
    physical: "物理",
    fire: "火",
    ice: "冰",
    electric: "电",
    ether: "以太",
}
const RES_IGNORE_KEY_BY_ELEMENT = {
    physical: "physicalResIgnore",
    fire: "fireResIgnore",
    ice: "iceResIgnore",
    electric: "electricResIgnore",
    ether: "etherResIgnore",
}
const RES_REDUCTION_KEY_BY_ELEMENT = {
    physical: "enemyPhysicalResReduction",
    fire: "enemyFireResReduction",
    ice: "enemyIceResReduction",
    electric: "enemyElectricResReduction",
    ether: "enemyEtherResReduction",
}
const RES_IGNORE_KEYS = Object.values(RES_IGNORE_KEY_BY_ELEMENT)

const DAMAGE_TARGET_PRESETS = [
    {
        id: "taichu-nightmare",
        name: {
            zhCN: "太初梦魇",
            en: "Taichu Nightmare",
        },
        defense: 476,
    },
    {
        id: "normal-boss",
        name: {
            zhCN: "普通 Boss",
            en: "Normal Boss",
        },
        defense: 953,
    },
    {
        id: "wandering-hunter",
        name: {
            zhCN: "彷徨猎手",
            en: "Wandering Hunter",
        },
        defense: 1588,
    },
]

const DEFAULT_DAMAGE_TARGET_PRESET_ID = "normal-boss"
const DEFAULT_DAMAGE_LEVEL_COEFFICIENT = 794

const OUT_OF_COMBAT_BASIS_SOURCE_TYPES = new Set(["teammate", "wEngineTeam", "driveDisc4pcTeam", "field", "boss", "manual"])
const REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES = new Set(["self", "wEngine", "driveDisc4pc"])
const TARGET_STAT_KEYS = new Set(COMBAT_TARGET_BONUS_KEYS)

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

const BASE_PERCENT_STATS = new Set([
    "critRate",
    "critDmg",
    "energyRegen",
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
])

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
        ...Object.fromEntries(COMBAT_TARGET_BONUS_KEYS.map(key => [key, 0])),
    }
}

function createPanel() {
    return Object.fromEntries(OUTPUT_PANEL_KEYS.map(key => [key, 0]))
}

function isStoredPercentStat(stat, mode) {
    return mode === "pct" || STORED_PERCENT_STATS.has(stat)
}

function toCalcValue(stat, value, mode) {
    const numeric = Number(value ?? 0)
    return isStoredPercentStat(stat, mode) ? numeric / 100 : numeric
}

function toBaseCalcValue(stat, value) {
    const numeric = Number(value ?? 0)
    return BASE_PERCENT_STATS.has(stat) ? numeric / 100 : numeric
}

function addBonus(totals, stat, value, mode) {
    const key = BONUS_KEY_MAP[stat]
    if (!key) {
        return
    }

    totals[key] += toCalcValue(stat, value, mode)
}

function addBonusCalcValue(totals, stat, value) {
    const key = BONUS_KEY_MAP[stat]
    if (!key) {
        return
    }

    totals[key] += Number(value ?? 0)
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

function defaultCombatBasis(stat, sourceType) {
    if (stat.basis) {
        return stat.basis
    }

    if (stat.stat === "atkPct" && OUT_OF_COMBAT_BASIS_SOURCE_TYPES.has(sourceType)) {
        return "outOfCombatAtk"
    }

    return COMBAT_PCT_BASIS_BY_STAT[stat.stat]?.defaultBasis ?? null
}

function missingRequiredCombatBasis(stats, sourceType) {
    return stats.find(stat =>
        stat.stat === "atkPct"
        && (stat.mode ?? "flat") === "pct"
        && !stat.basis
        && !OUT_OF_COMBAT_BASIS_SOURCE_TYPES.has(sourceType)
    ) ?? null
}

function clampNumber(value, min, max) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return Number(min ?? 0)
    }

    return Math.max(Number(min ?? numeric), Math.min(Number(max ?? numeric), numeric))
}

function defaultCoverage(effect) {
    return clampNumber(effect.coverage?.default ?? 1, effect.coverage?.min ?? 0, effect.coverage?.max ?? 1)
}

function coverageFromRuntime(effect, runtimeInput = {}) {
    return clampNumber(runtimeInput.coverage ?? defaultCoverage(effect), effect.coverage?.min ?? 0, effect.coverage?.max ?? 1)
}

function legacyStatsToEffects(stats = []) {
    return stats.map((stat, index) => ({
        id: stat.id ?? `legacy-${index + 1}`,
        type: "fixed",
        stat: stat.stat,
        value: Number(stat.value ?? 0),
        mode: stat.mode ?? "flat",
        basis: stat.basis ?? null,
        label: stat.label ?? null,
    }))
}

function effectRules(effect) {
    if (Array.isArray(effect?.effects)) {
        return effect.effects
    }

    const stats = Array.isArray(effect?.stats)
        ? effect.stats
        : effect?.statsByPhase?.["1"] ?? effect?.statsByPhase?.[1] ?? []
    return legacyStatsToEffects(stats)
}

function effectRuntimeFor(rule, runtimeInput = {}) {
    const id = rule.id ?? rule.stat ?? "effect"
    return runtimeInput.effects?.[id] ?? runtimeInput[id] ?? {}
}

function resolveEffectRule(rule, effect, runtimeInput = {}) {
    const type = rule.type ?? "fixed"
    const runtime = effectRuntimeFor(rule, runtimeInput)
    const coverage = coverageFromRuntime(effect, runtimeInput)
    const common = {
        id: rule.id ?? rule.stat ?? type,
        label: rule.label ?? null,
        type,
        stat: rule.stat,
        mode: rule.mode ?? "flat",
        basis: rule.basis ?? null,
        coverage,
    }

    if (type === "derived") {
        const sourceValue = Number(runtime.sourceValue ?? rule.defaultSourceValue ?? 0)
        const ratio = Number(rule.ratio ?? rule.ratioPct ?? 0) / 100
        const uncappedValue = sourceValue * ratio
        const cappedValue = Number.isFinite(Number(rule.cap))
            ? Math.min(uncappedValue, Number(rule.cap))
            : uncappedValue
        const value = cappedValue * coverage
        return {
            ...common,
            sourceLabel: rule.sourceLabel ?? null,
            sourceValue,
            ratio: Number(rule.ratio ?? rule.ratioPct ?? 0),
            cap: Number.isFinite(Number(rule.cap)) ? Number(rule.cap) : null,
            uncappedValue,
            value,
        }
    }

    if (type === "formula") {
        const source = rule.source ?? {}
        const variable = source.variable ?? "x"
        const rawSourceValue = Number(runtime.sourceValue ?? source.defaultValue ?? rule.defaultSourceValue ?? 0)
        const min = Number(source.min)
        const max = Number(source.max)
        const sourceValue = clampNumber(
            rawSourceValue,
            Number.isFinite(min) ? min : rawSourceValue,
            Number.isFinite(max) ? max : rawSourceValue,
        )
        const expression = rule.formula?.expression ?? ""
        const formulaValue = evaluateFormulaExpression(expression, { [variable]: sourceValue })
        const value = formulaValue * coverage
        return {
            ...common,
            source,
            sourceLabel: source.label ?? rule.sourceLabel ?? null,
            variable,
            rawSourceValue,
            sourceValue,
            expression,
            valueUnit: rule.formula?.valueUnit ?? "storedValue",
            formulaValue,
            value,
        }
    }

    if (type === "stacked") {
        const maxStacks = Math.max(0, Number(rule.maxStacks ?? 1))
        const stacks = clampNumber(runtime.stacks ?? rule.defaultStacks ?? maxStacks, 0, maxStacks)
        const valuePerStack = Number(rule.valuePerStack ?? rule.value ?? 0)
        const value = valuePerStack * stacks * coverage
        return {
            ...common,
            value,
            valuePerStack,
            stacks,
            maxStacks,
            defaultStacks: Number(rule.defaultStacks ?? maxStacks),
        }
    }

    return {
        ...common,
        value: Number(rule.value ?? 0) * coverage,
    }
}

function resolveEffectStats(effect, runtimeInput = {}) {
    return effectRules(effect)
        .map(rule => resolveEffectRule(rule, effect, runtimeInput))
        .filter(rule => rule.stat && Number.isFinite(Number(rule.value)))
}

function addCombatStat(totals, stat, sourceType, outOfCombat, resolvedStats) {
    const value = toCalcValue(stat.stat, stat.value, stat.mode)
    const mode = stat.mode ?? "flat"
    const pctMeta = COMBAT_PCT_BASIS_BY_STAT[stat.stat]

    if (TARGET_STAT_KEYS.has(stat.stat)) {
        totals[stat.stat] += value
        resolvedStats.push({
            ...stat,
            value,
            mode,
        })
        return
    }

    if (pctMeta && mode === "pct") {
        const basis = defaultCombatBasis(stat, sourceType)
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

    addBonusCalcValue(totals, stat.stat, value)
    resolvedStats.push({
        ...stat,
        value,
        mode,
    })
}

function normalizeEffect(effect, runtimeInput = {}) {
    if (!effect) {
        return null
    }

    const stats = resolveEffectStats(effect, runtimeInput)

    return {
        name: effect.name ?? null,
        scope: effect.scope ?? "outOfCombat",
        condition: effect.condition ?? null,
        stats,
        effects: effectRules(effect),
        coverage: effect.coverage ?? null,
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
    const agentSkills = new Map((catalog.agentSkills ?? []).map(item => [item.id, item]))
    const agentSkillsByAgent = new Map((catalog.agentSkills ?? []).map(item => [item.agentId, item]))
    return {
        agentsMap: agents,
        wEnginesMap: wEngines,
        driveDiscSetsMap: sets,
        combatBuffsMap: combatBuffs,
        agentSkillsMap: agentSkills,
        agentSkillsByAgentMap: agentSkillsByAgent,
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
        addBonus(bonusTotals, stat.stat, stat.value, stat.mode)
    }

    appliedEffects.push({
        key: label,
        scope: normalized.scope,
        condition: normalized.condition,
        stats: normalized.stats.map(stat => ({
            ...stat,
            value: toCalcValue(stat.stat, stat.value, stat.mode),
        })),
    })
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
    return effect?.selfBuff ?? effect?.buff ?? null
}

function wEngineEffectTeamBuff(wEngine) {
    return wEngineEffectData(wEngine)?.teamBuff ?? null
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

function wEngineCombatBuffEntries(wEngine) {
    const effectData = wEngineEffectData(wEngine)
    return [
        {
            key: wEngineSelfBuffKey(wEngine),
            effect: wEngineEffectSelfBuff(wEngine),
            sourceType: "wEngine",
            name: effectData?.name ?? wEngine.name,
            conditionLabel: wEngineEffectSelfBuff(wEngine)?.condition,
            requiresCurrentWearer: true,
        },
        {
            key: wEngineTeamBuffKey(wEngine),
            effect: wEngineEffectTeamBuff(wEngine),
            sourceType: "wEngineTeam",
            name: effectData?.name ?? wEngine.name,
            conditionLabel: wEngineEffectTeamBuff(wEngine)?.condition,
            requiresCurrentWearer: true,
        },
    ].filter(entry => entry.effect)
}

function driveDiscFourPiece(set) {
    return set?.fourPiece ?? null
}

function legacyFourPieceBuff(fourPiece) {
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
    const buff = fourPiece?.selfBuff ?? legacyFourPieceBuff(fourPiece)
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDiscFourPieceTeamBuff(set) {
    const buff = driveDiscFourPiece(set)?.teamBuff ?? null
    return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDisc4pcSelfKey(setId) {
    return `driveDisc4pc:${setId}.self`
}

function driveDisc4pcTeamKey(setId) {
    return `driveDisc4pc:${setId}.team`
}

function driveDisc4pcLegacyKey(setId) {
    return `driveDisc4pc:${setId}`
}

function cinemaBuffName(buff = {}) {
    const level = Number(buff.cinemaLevel)
    const prefix = Number.isInteger(level) ? `影画${level}` : "影画"
    const zhName = buff.cinemaName?.zhCN ?? buff.name?.zhCN ?? ""
    const enName = buff.cinemaName?.en ?? buff.name?.en ?? ""
    const name = {
        zhCN: [prefix, zhName].filter(Boolean).join("｜"),
    }
    if (enName) {
        name.en = [prefix, enName].filter(Boolean).join(" | ")
    }
    return name
}

function agentCombatBuffEntries(agent) {
    const combatBuffs = agent?.combatBuffs ?? {}
    const fixedEntries = [
        ["corePassive", combatBuffs.corePassive],
        ["additionalAbility", combatBuffs.additionalAbility],
    ]
        .filter(([, buff]) => buff)
        .map(([key, buff]) => ({
            id: `agent:${agent.id}.${key}`,
            key,
            buff,
            name: buff.name,
            conditionLabel: buff.conditionLabel,
        }))
    const cinemaEntries = (combatBuffs.cinemaBuffs ?? [])
        .filter(buff => buff)
        .map(buff => ({
            id: `agent:${agent.id}.cinema.${buff.cinemaLevel}`,
            key: `cinema.${buff.cinemaLevel}`,
            buff,
            name: buff.name ?? cinemaBuffName(buff),
            conditionLabel: buff.conditionLabel ?? buff.description ?? null,
        }))
    return [...fixedEntries, ...cinemaEntries]
}

function nameWithSource(teammateName, sourceLabel) {
    const name = {
        zhCN: [teammateName?.zhCN, sourceLabel?.zhCN].filter(Boolean).join("｜"),
    }
    if (teammateName?.en || sourceLabel?.en) {
        name.en = [teammateName?.en, sourceLabel?.en].filter(Boolean).join(" | ")
    }
    return name
}

function flattenTeammateCombatBuffs(teammates) {
    return (teammates ?? []).flatMap(teammate =>
        (teammate.buffs ?? []).map(buff => {
            const sourceLabel = buff.source ?? buff.sourceLabel ?? {}
            const description = buff.description ?? buff.conditionLabel ?? null

            return {
                ...buff,
                id: buff.id,
                sourceType: "teammate",
                sourceCategory: "agent",
                sourceKind: "teammate",
                teammateId: teammate.id,
                teammateName: teammate.name,
                sourceLabel,
                description,
                name: buff.name ?? nameWithSource(teammate.name, sourceLabel),
                conditionLabel: buff.conditionLabel ?? description,
                scope: buff.scope ?? "inCombat",
            }
        })
    )
}

function collectMissingAtkPctBasis(violations, sourceType, label, effect) {
    const isImplicitInCombat = sourceType === "driveDisc4pc"
    if (!REQUIRED_ATK_PCT_BASIS_SOURCE_TYPES.has(sourceType) || (!isImplicitInCombat && effect?.scope !== "inCombat")) {
        return
    }

    effectRules(effect).forEach((rule, index) => {
        if (rule.stat === "atkPct" && (rule.mode ?? "flat") === "pct" && !rule.basis) {
            violations.push(`${label}.effects[${index}]`)
        }
    })
}

function collectCinemaBuffViolations(violations, agent) {
    const cinemaBuffs = agent?.combatBuffs?.cinemaBuffs
    if (cinemaBuffs === undefined || cinemaBuffs === null) {
        return
    }
    if (!Array.isArray(cinemaBuffs)) {
        violations.push(`agent:${agent.id}.combatBuffs.cinemaBuffs must be an array`)
        return
    }

    const seenLevels = new Set()
    cinemaBuffs.forEach((buff, index) => {
        const level = Number(buff?.cinemaLevel)
        const label = `agent:${agent.id}.combatBuffs.cinemaBuffs[${index}].cinemaLevel`
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            violations.push(`${label} must be an integer from 1 to 6`)
            return
        }
        if (seenLevels.has(level)) {
            violations.push(`${label} duplicates cinema ${level}`)
            return
        }
        seenLevels.add(level)
    })
}

function validateCatalogModeling(catalog) {
    const violations = []

    for (const agent of catalog.agents ?? []) {
        collectCinemaBuffViolations(violations, agent)
        for (const entry of agentCombatBuffEntries(agent)) {
            collectMissingAtkPctBasis(violations, "self", entry.id, entry.buff)
        }
    }

    for (const wEngine of catalog.wEngines ?? []) {
        collectMissingAtkPctBasis(violations, "wEngine", wEngineSelfBuffKey(wEngine), wEngineEffectSelfBuff(wEngine))
        collectMissingAtkPctBasis(violations, "wEngineTeam", wEngineTeamBuffKey(wEngine), wEngineEffectTeamBuff(wEngine))
    }

    for (const set of catalog.driveDiscSets ?? []) {
        collectMissingAtkPctBasis(violations, "driveDisc4pc", driveDisc4pcSelfKey(set.id), driveDiscFourPieceSelfBuff(set))
        collectMissingAtkPctBasis(violations, "driveDisc4pcTeam", driveDisc4pcTeamKey(set.id), driveDiscFourPieceTeamBuff(set))
    }

    for (const buff of catalog.combatBuffs ?? []) {
        collectMissingAtkPctBasis(violations, buff.sourceType, buff.id, buff)
    }

    if (violations.length) {
        throw new Error(`Catalog modeling violations: ${violations.join(", ")}`)
    }
}

function applyCombatEffect({ bonusTotals, effect, key, name, sourceType, conditionLabel, outOfCombat, runtimeInput, activeEffects, ignoredEffects }) {
    const normalized = normalizeEffect(effect, runtimeInput)
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

    const missingBasisStat = missingRequiredCombatBasis(normalized.stats, sourceType)
    if (missingBasisStat) {
        ignoredEffects.push({
            key,
            sourceType,
            reason: "missingAtkPctBasis",
            stat: missingBasisStat.stat,
        })
        return
    }

    const resolvedStats = []
    for (const stat of normalized.stats) {
        addCombatStat(bonusTotals, stat, sourceType, outOfCombat, resolvedStats)
    }

    activeEffects.push({
        key,
        name: name ?? normalized.name,
        sourceType,
        scope: normalized.scope,
        condition: normalized.condition,
        conditionLabel: conditionLabel ?? effect.conditionLabel ?? normalized.condition ?? null,
        stats: normalized.stats.map(stat => ({
            ...stat,
            value: toCalcValue(stat.stat, stat.value, stat.mode),
        })),
        effects: normalized.effects,
        coverage: normalized.coverage,
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
    for (const key of RES_IGNORE_KEYS) {
        panel[key] = outOfCombat.panel[key] + bonusTotals[key]
    }
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

function damageTargetPreset(id) {
    return DAMAGE_TARGET_PRESETS.find(item => item.id === id)
        ?? DAMAGE_TARGET_PRESETS.find(item => item.id === DEFAULT_DAMAGE_TARGET_PRESET_ID)
        ?? DAMAGE_TARGET_PRESETS[0]
}

function normalizeResistancePercent(value, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric / 100 : fallback
}

function normalizeResistanceByElement(targetInput, damageElement) {
    const source = targetInput.resistanceByElement && typeof targetInput.resistanceByElement === "object"
        ? targetInput.resistanceByElement
        : {}
    const resistanceByElement = {}
    for (const element of DAMAGE_ELEMENTS) {
        if (source[element] !== undefined && source[element] !== null && source[element] !== "") {
            resistanceByElement[element] = normalizeResistancePercent(source[element])
        }
    }

    if (resistanceByElement[damageElement] === undefined) {
        resistanceByElement[damageElement] = normalizeResistancePercent(targetInput.resistance, 0)
    }

    return resistanceByElement
}

function localizedName(value, fallback = "") {
    if (typeof value === "string") {
        return value || fallback
    }

    return value?.zhCN ?? value?.en ?? fallback
}

function levelRangeForSkill(category = {}, move = {}, row = {}) {
    return row.levelRange ?? move.levelRange ?? category.levelRange ?? {
        min: 1,
        max: Array.isArray(row.values) ? row.values.length : 1,
        default: 1,
    }
}

function resolveDamageSkillRef(catalog, agent, skillRef = null) {
    if (!skillRef || typeof skillRef !== "object") {
        return null
    }

    const agentSkillId = String(skillRef.agentSkillId ?? "").trim()
    const skillSet = agentSkillId
        ? catalog.agentSkillsMap?.get(agentSkillId) ?? (catalog.agentSkills ?? []).find(item => item.id === agentSkillId)
        : catalog.agentSkillsByAgentMap?.get(agent.id) ?? (catalog.agentSkills ?? []).find(item => item.agentId === agent.id)
    if (!skillSet) {
        throw new Error(`Unknown agent skill catalog: ${agentSkillId || agent.id}`)
    }
    if (skillSet.agentId !== agent.id) {
        throw new Error(`Skill catalog ${skillSet.id} does not belong to agent ${agent.id}`)
    }

    const categoryId = String(skillRef.categoryId ?? "").trim()
    const moveId = String(skillRef.moveId ?? "").trim()
    const rowId = String(skillRef.rowId ?? "").trim()
    const category = (skillSet.categories ?? []).find(item => item.id === categoryId)
    if (!category) {
        throw new Error(`Unknown skill category for ${skillSet.id}: ${categoryId}`)
    }
    const move = (category.moves ?? []).find(item => item.id === moveId)
    if (!move) {
        throw new Error(`Unknown skill move for ${skillSet.id}.${categoryId}: ${moveId}`)
    }
    const row = (move.rows ?? []).find(item => item.id === rowId)
    if (!row) {
        throw new Error(`Unknown skill multiplier row for ${skillSet.id}.${categoryId}.${moveId}: ${rowId}`)
    }
    if ((row.kind ?? "damageMultiplier") !== "damageMultiplier") {
        throw new Error(`Skill row is not a damage multiplier: ${skillSet.id}.${categoryId}.${moveId}.${rowId}`)
    }

    const range = levelRangeForSkill(category, move, row)
    const min = Number(range.min ?? 1)
    const max = Number(range.max ?? (Array.isArray(row.values) ? row.values.length : min))
    const defaultLevel = Number(range.default ?? max)
    const requestedLevel = Number(skillRef.level ?? defaultLevel)
    if (!Number.isInteger(requestedLevel) || requestedLevel < min || requestedLevel > max) {
        throw new Error(`Skill level out of range for ${skillSet.id}.${categoryId}.${moveId}.${rowId}: ${skillRef.level}`)
    }

    const value = Number(row.values?.[requestedLevel - min])
    if (!Number.isFinite(value)) {
        throw new Error(`Missing skill multiplier for ${skillSet.id}.${categoryId}.${moveId}.${rowId} level ${requestedLevel}`)
    }

    const labelParts = [
        localizedName(category.name, category.id),
        localizedName(move.name, move.id),
        localizedName(row.label, row.id),
    ].filter(Boolean)

    return {
        skillMultiplier: Math.max(0, value / 100),
        skillPercent: value,
        skillSource: {
            agentSkillId: skillSet.id,
            categoryId,
            moveId,
            rowId,
            level: requestedLevel,
            categoryName: category.name,
            moveName: move.name,
            rowLabel: row.label,
            label: labelParts.join(" / "),
        },
    }
}

function normalizeDamageInput(input = {}, agent = {}, catalog = {}) {
    const targetInput = input.target ?? {}
    const preset = damageTargetPreset(targetInput.presetId ?? DEFAULT_DAMAGE_TARGET_PRESET_ID)
    const defense = Number(targetInput.defense ?? preset?.defense ?? 953)
    const levelCoefficient = Number(targetInput.levelCoefficient ?? DEFAULT_DAMAGE_LEVEL_COEFFICIENT)
    const skillRefResult = resolveDamageSkillRef(catalog, agent, input.skillRef)
    const skillMultiplier = skillRefResult?.skillMultiplier ?? (Number(input.skillMultiplier ?? 100) / 100)
    const critMode = ["expected", "crit", "nonCrit"].includes(input.critMode)
        ? input.critMode
        : "expected"
    const damageElement = resolveDamageElement(agent)

    return {
        skillMultiplier: Number.isFinite(skillMultiplier) ? Math.max(0, skillMultiplier) : 1,
        skillSource: skillRefResult?.skillSource ?? null,
        critMode,
        target: {
            presetId: targetInput.presetId ?? preset?.id ?? DEFAULT_DAMAGE_TARGET_PRESET_ID,
            defense: Number.isFinite(defense) ? Math.max(0, defense) : Number(preset?.defense ?? 953),
            levelCoefficient: Number.isFinite(levelCoefficient) && levelCoefficient > 0
                ? levelCoefficient
                : DEFAULT_DAMAGE_LEVEL_COEFFICIENT,
            resistanceByElement: normalizeResistanceByElement(targetInput, damageElement),
        },
    }
}

function formatDamageNumber(value, digits = 3) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }

    if (Number.isInteger(number)) {
        return String(number)
    }

    return String(Number(number.toFixed(digits)))
}

function formatDamagePercent(value, digits = 1) {
    return `${formatDamageNumber(Number(value ?? 0) * 100, digits)}%`
}

function damageCritRate(panel) {
    return Math.max(0, Math.min(1, Number(panel.critRate ?? 0)))
}

function critMultiplierForMode(panel, mode) {
    const critRate = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)

    if (mode === "crit") {
        return 1 + critDmg
    }

    if (mode === "nonCrit") {
        return 1
    }

    return critRate * (1 + critDmg) + (1 - critRate)
}

function calculateDamageFinalValue({ agent, panel, selectedDmgBonus, bonusTotals, damageInput }) {
    const damageElement = resolveDamageElement(agent)
    const atk = Number(panel.atk ?? 0)
    const skillMultiplier = damageInput.skillMultiplier
    const critMultiplier = critMultiplierForMode(panel, damageInput.critMode)
    const dmgMultiplier = 1 + Number(selectedDmgBonus ?? 0)
    const targetDefense = damageInput.target.defense
    const levelCoefficient = damageInput.target.levelCoefficient
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    const targetResistance = Number(damageInput.target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = Number(panel[resIgnoreKey] ?? 0)
    const effectiveResistance = targetResistance - enemyResReduction - resIgnore
    const resistanceMultiplier = clampNumber(1 - effectiveResistance, 0.01, 2)

    return atk * skillMultiplier * critMultiplier * dmgMultiplier * defenseMultiplier * resistanceMultiplier
}

function calculateDamageWhiteBox({ catalog, agent, panel, selectedDmgBonus, bonusTotals, input }) {
    const damageElement = resolveDamageElement(agent)
    const damageInput = normalizeDamageInput(input, agent, catalog)
    const atk = Number(panel.atk ?? 0)
    const skillMultiplier = damageInput.skillMultiplier
    const rawCritRate = Number(panel.critRate ?? 0)
    const critRateForDamage = damageCritRate(panel)
    const critDmg = Number(panel.critDmg ?? 0)
    const critMultiplier = critMultiplierForMode(panel, damageInput.critMode)
    const dmgMultiplier = 1 + Number(selectedDmgBonus ?? 0)
    const targetDefense = damageInput.target.defense
    const levelCoefficient = damageInput.target.levelCoefficient
    const enemyDefReduction = Number(bonusTotals.enemyDefReduction ?? 0)
    const enemyDefFlatReduction = Number(bonusTotals.enemyDefFlatReduction ?? 0)
    const penRatio = Number(panel.penRatio ?? 0)
    const penFlat = Number(panel.penFlat ?? 0)
    const targetDefenseAfterReduction = Math.max(0, targetDefense * (1 - enemyDefReduction) - enemyDefFlatReduction)
    const effectiveDefense = Math.max(0, targetDefenseAfterReduction * (1 - penRatio) - penFlat)
    const defenseMultiplier = Math.min(1, levelCoefficient / (levelCoefficient + effectiveDefense))
    const targetResistance = Number(damageInput.target.resistanceByElement?.[damageElement] ?? 0)
    const enemyResReductionKey = RES_REDUCTION_KEY_BY_ELEMENT[damageElement]
    const enemyResReduction = Number(bonusTotals.enemyResReduction ?? 0)
        + Number(bonusTotals[enemyResReductionKey] ?? 0)
    const resIgnoreKey = RES_IGNORE_KEY_BY_ELEMENT[damageElement]
    const resIgnore = Number(panel[resIgnoreKey] ?? 0)
    const effectiveResistance = targetResistance - enemyResReduction - resIgnore
    const rawResistanceMultiplier = 1 - effectiveResistance
    const resistanceMultiplier = clampNumber(rawResistanceMultiplier, 0.01, 2)
    const finalDamage = atk * skillMultiplier * critMultiplier * dmgMultiplier * defenseMultiplier * resistanceMultiplier

    const critModeLabel = {
        expected: "期望",
        crit: "暴击",
        nonCrit: "非暴击",
    }[damageInput.critMode]
    const damageElementLabel = DAMAGE_ELEMENT_LABELS[damageElement] ?? damageElement

    return {
        finalDamage,
        input: damageInput,
        multipliers: {
            atk,
            skill: skillMultiplier,
            crit: critMultiplier,
            critRate: critRateForDamage,
            rawCritRate,
            critDmg,
            dmg: dmgMultiplier,
            defense: defenseMultiplier,
            resistance: resistanceMultiplier,
        },
        targetBreakdown: {
            presetId: damageInput.target.presetId,
            damageElement,
            targetDefense,
            levelCoefficient,
            enemyDefReduction,
            enemyDefFlatReduction,
            targetDefenseAfterReduction,
            penRatio,
            penFlat,
            effectiveDefense,
            targetResistance,
            enemyResReduction,
            enemyResReductionKey,
            resIgnore,
            resIgnoreKey,
            effectiveResistance,
            rawResistanceMultiplier,
        },
        whiteBoxRows: [
            {
                label: "局内攻击力",
                formula: "来自局内面板攻击力",
                value: atk,
                displayValue: formatDamageNumber(atk),
            },
            {
                label: "技能倍率",
                formula: damageInput.skillSource
                    ? `${damageInput.skillSource.label} LV${damageInput.skillSource.level}`
                    : "本次直伤倍率",
                value: skillMultiplier,
                displayValue: formatDamagePercent(skillMultiplier),
            },
            {
                label: "暴击乘区",
                formula: damageInput.critMode === "expected"
                    ? `${formatDamagePercent(critRateForDamage)} × (1 + ${formatDamagePercent(critDmg)}) + (1 - ${formatDamagePercent(critRateForDamage)})`
                    : critModeLabel,
                value: critMultiplier,
                displayValue: formatDamageNumber(critMultiplier, 4),
            },
            {
                label: "增伤乘区",
                formula: `1 + 通用/属性增伤 ${formatDamagePercent(selectedDmgBonus)}`,
                value: dmgMultiplier,
                displayValue: formatDamageNumber(dmgMultiplier, 4),
            },
            {
                label: "减防后防御",
                formula: `${formatDamageNumber(targetDefense)} × (1 - ${formatDamagePercent(enemyDefReduction)}) - ${formatDamageNumber(enemyDefFlatReduction)}`,
                value: targetDefenseAfterReduction,
                displayValue: formatDamageNumber(targetDefenseAfterReduction),
            },
            {
                label: "有效防御",
                formula: `${formatDamageNumber(targetDefenseAfterReduction)} × (1 - ${formatDamagePercent(penRatio)}) - ${formatDamageNumber(penFlat)}`,
                value: effectiveDefense,
                displayValue: formatDamageNumber(effectiveDefense),
            },
            {
                label: "防御乘区",
                formula: `${formatDamageNumber(levelCoefficient)} / (${formatDamageNumber(levelCoefficient)} + ${formatDamageNumber(effectiveDefense)})`,
                value: defenseMultiplier,
                displayValue: formatDamageNumber(defenseMultiplier, 4),
            },
            {
                label: "抗性乘区",
                formula: `clamp(1 - (${damageElementLabel}抗性 ${formatDamagePercent(targetResistance)} - 减抗 ${formatDamagePercent(enemyResReduction)} - 抗性无视 ${formatDamagePercent(resIgnore)}), 0.01, 2)`,
                value: resistanceMultiplier,
                displayValue: formatDamageNumber(resistanceMultiplier, 4),
            },
            {
                label: "最终伤害",
                formula: `${formatDamageNumber(atk)} × ${formatDamagePercent(skillMultiplier)} × ${formatDamageNumber(critMultiplier, 4)} × ${formatDamageNumber(dmgMultiplier, 4)} × ${formatDamageNumber(defenseMultiplier, 4)} × ${formatDamageNumber(resistanceMultiplier, 4)}`,
                value: finalDamage,
                displayValue: formatDamageNumber(finalDamage),
            },
        ],
    }
}

function outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel) {
    return {
        baseAtk: {
            agent: baseBreakdown.agent.atk,
            wEngine: baseBreakdown.wEngine.atk,
            coreSkill: baseBreakdown.coreSkill.atk,
            total: baseBreakdown.total.atk,
        },
        atkPanel: {
            baseAtk: baseBreakdown.total.atk,
            atkPct: bonusTotals.atkPct,
            atkFromPct: baseBreakdown.total.atk * bonusTotals.atkPct,
            atkFlat: bonusTotals.atkFlat,
            total: panel.atk,
        },
    }
}

function inCombatAtkBreakdown(outOfCombat, bonusTotals, panel) {
    const basePct = bonusTotals.atkPct + bonusTotals.atkPctBase
    const outOfCombatPct = bonusTotals.atkPctOutOfCombat
    return {
        atkPanel: {
            outOfCombatAtk: outOfCombat.panel.atk,
            atkFlat: bonusTotals.atkFlat,
            baseAtk: outOfCombat.base.atk,
            baseAtkPct: basePct,
            atkFromBasePct: outOfCombat.base.atk * basePct,
            outOfCombatAtkPct: outOfCombatPct,
            atkFromOutOfCombatPct: outOfCombat.panel.atk * outOfCombatPct,
            total: panel.atk,
        },
    }
}

function resolveDamageElement(agent = {}) {
    const damageElement = agent.damageElement ?? agent.attribute
    return DAMAGE_ELEMENTS.includes(damageElement) ? damageElement : "physical"
}

function resolveAttributeBonusKey(agent) {
    const damageElement = resolveDamageElement(agent)
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
            stats: stats.map(stat => ({
                ...stat,
                value: CORE_BASE_STAT_MAP[stat.stat]
                    ? stat.value
                    : toCalcValue(stat.stat, stat.value, stat.mode),
            })),
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
        critRate: toBaseCalcValue("critRate", agent.level60.critRate ?? 0),
        critDmg: toBaseCalcValue("critDmg", agent.level60.critDmg ?? 0),
        impact: Number(agent.level60.impact ?? 0),
        anomalyProficiency: Number(agent.level60.anomalyProficiency ?? 0),
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0),
        energyRegen: toBaseCalcValue("energyRegen", agent.level60.energyRegen ?? 100),
        penFlat: Number(agent.level60.penFlat ?? 0),
        penRatio: toBaseCalcValue("penRatio", agent.level60.penRatio ?? 0),
        dmgBonus: toBaseCalcValue("dmgBonus", agent.level60.dmgBonus ?? 0),
    }

    const bonusTotals = createBonusTotals()

    if (wEngine.level60.advancedStat) {
        addBonus(
            bonusTotals,
            wEngine.level60.advancedStat.stat,
            wEngine.level60.advancedStat.value ?? 0,
            wEngine.level60.advancedStat.mode
        )
    }

    for (const bonus of coreSkill.panelBonuses) {
        addBonus(bonusTotals, bonus.stat, bonus.value, bonus.mode)
    }

    const setCounts = new Map()
    for (const disc of driveDiscs) {
        setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)

        addBonus(bonusTotals, disc.mainStat.stat, disc.mainStat.value ?? 0, disc.mainStat.mode)
        for (const subStat of disc.subStats ?? []) {
            addBonus(bonusTotals, subStat.stat, subStat.value ?? 0, subStat.mode)
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
    for (const key of RES_IGNORE_KEYS) {
        panel[key] = bonusTotals[key]
    }
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
        breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
        bonusTotals,
        panel,
        simpleTargetScore,
        selectedDmgBonus,
        coreSkill,
        appliedEffects,
        ignoredEffects,
    })
}

function createPreparedOutOfCombatPanelCalculator({ agent, wEngine, driveDiscSets, coreSkillLevel }) {
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
        critRate: toBaseCalcValue("critRate", agent.level60.critRate ?? 0),
        critDmg: toBaseCalcValue("critDmg", agent.level60.critDmg ?? 0),
        impact: Number(agent.level60.impact ?? 0),
        anomalyProficiency: Number(agent.level60.anomalyProficiency ?? 0),
        anomalyMastery: Number(agent.level60.anomalyMastery ?? 0),
        energyRegen: toBaseCalcValue("energyRegen", agent.level60.energyRegen ?? 100),
        penFlat: Number(agent.level60.penFlat ?? 0),
        penRatio: toBaseCalcValue("penRatio", agent.level60.penRatio ?? 0),
        dmgBonus: toBaseCalcValue("dmgBonus", agent.level60.dmgBonus ?? 0),
    }

    const staticBonusTotals = createBonusTotals()

    if (wEngine.level60.advancedStat) {
        addBonus(
            staticBonusTotals,
            wEngine.level60.advancedStat.stat,
            wEngine.level60.advancedStat.value ?? 0,
            wEngine.level60.advancedStat.mode
        )
    }

    for (const bonus of coreSkill.panelBonuses) {
        addBonus(staticBonusTotals, bonus.stat, bonus.value, bonus.mode)
    }

    return {
        calculate(driveDiscs = [], options = {}) {
            const bonusTotals = { ...staticBonusTotals }
            const setCounts = new Map()
            for (const disc of driveDiscs) {
                setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)

                addBonus(bonusTotals, disc.mainStat.stat, disc.mainStat.value ?? 0, disc.mainStat.mode)
                for (const subStat of disc.subStats ?? []) {
                    addBonus(bonusTotals, subStat.stat, subStat.value ?? 0, subStat.mode)
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
            for (const key of RES_IGNORE_KEYS) {
                panel[key] = bonusTotals[key]
            }
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

            const result = {
                base,
                baseBreakdown,
                breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
                bonusTotals,
                panel,
                simpleTargetScore,
                selectedDmgBonus,
                coreSkill,
                appliedEffects,
                ignoredEffects,
            }

            return options.round === false ? result : roundNumbers(result)
        },
        calculateFromSummary(statTotals = new Map(), setCounts = new Map(), options = {}) {
            const bonusTotals = { ...staticBonusTotals }
            for (const [stat, value] of statTotals.entries()) {
                addBonus(bonusTotals, stat, value)
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
            for (const key of RES_IGNORE_KEYS) {
                panel[key] = bonusTotals[key]
            }
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

            const result = {
                base,
                baseBreakdown,
                breakdown: outOfCombatAtkBreakdown(baseBreakdown, bonusTotals, panel),
                bonusTotals,
                panel,
                simpleTargetScore,
                selectedDmgBonus,
                coreSkill,
                appliedEffects,
                ignoredEffects,
            }

            return options.round === false ? result : roundNumbers(result)
        },
    }
}

export async function loadCatalog(dataDir, exampleDir) {
    const [agentsRaw, agentSkillsRaw, wEnginesRaw, driveDiscSetsRaw, combatBuffsRaw, statRulesRaw, exampleRaw, yeShunguangExampleRaw] = await Promise.all([
        readJson(path.join(dataDir, "agents.json")),
        readJson(path.join(dataDir, "agent_skills.json")),
        readJson(path.join(dataDir, "w_engines.json")),
        readJson(path.join(dataDir, "drive_disc_sets.json")),
        readJson(path.join(dataDir, "combat_buffs.json")),
        readJson(path.join(dataDir, "stat_rules.json")),
        readJson(path.join(exampleDir, "out_of_combat_panel.example.json")),
        readJson(path.join(exampleDir, "ye_shunguang_panel.example.json")),
    ])

    const teammateCombatBuffs = flattenTeammateCombatBuffs(combatBuffsRaw.teammates ?? [])
    const catalog = {
        agents: agentsRaw.agents ?? [],
        agentSkills: agentSkillsRaw.agentSkills ?? [],
        wEngines: wEnginesRaw.wEngines ?? [],
        driveDiscSets: driveDiscSetsRaw.sets ?? [],
        combatBuffs: [
            ...(combatBuffsRaw.buffs ?? []),
            ...teammateCombatBuffs,
        ],
        teammateCombatBuffGroups: combatBuffsRaw.teammates ?? [],
        teammateCombatBuffs,
        statRules: statRulesRaw,
        example: exampleRaw,
        examples: {
            outOfCombat: exampleRaw,
            yeShunguang: yeShunguangExampleRaw,
        },
    }

    const maps = buildMaps(catalog)
    validateCatalogModeling(catalog)
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
            combatBuffs: agent.combatBuffs ?? {},
            preferredDriveDiscs: agent.preferredDriveDiscs ?? null,
        })),
        agentSkills: (catalog.agentSkills ?? []).map(item => ({
            id: item.id,
            agentId: item.agentId,
            name: item.name,
            categories: item.categories ?? [],
            sources: item.sources ?? [],
            verification: item.verification ?? null,
        })),
        wEngines: catalog.wEngines.map(item => ({
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            specialty: item.specialty,
            attribute: item.attribute,
            level60: item.level60,
            effect: item.effect ?? null,
            passive: wEngineEffectSelfBuff(item),
            selfBuff: wEngineEffectSelfBuff(item),
            teamBuff: wEngineEffectTeamBuff(item),
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
                sourceCategory: item.sourceCategory,
                sourceKind: item.sourceKind,
                teammateId: item.teammateId,
                teammateName: item.teammateName,
                sourceLabel: item.sourceLabel,
                name: item.name,
                description: item.description,
                conditionLabel: item.conditionLabel,
                stats: item.stats ?? [],
                effects: item.effects ?? null,
                coverage: item.coverage ?? null,
            })),
        teammateCombatBuffGroups: (catalog.teammateCombatBuffGroups ?? []).map(teammate => ({
            id: teammate.id,
            name: teammate.name,
            buffs: (teammate.buffs ?? []).map(buff => {
                const sourceLabel = buff.source ?? buff.sourceLabel ?? {}
                const description = buff.description ?? buff.conditionLabel ?? null
                return {
                    id: buff.id,
                    sourceType: "teammate",
                    sourceCategory: "agent",
                    sourceKind: "teammate",
                    teammateId: teammate.id,
                    teammateName: teammate.name,
                    sourceLabel,
                    name: buff.name ?? nameWithSource(teammate.name, sourceLabel),
                    description,
                    conditionLabel: buff.conditionLabel ?? description,
                    stats: buff.stats ?? [],
                    effects: buff.effects ?? null,
                    coverage: buff.coverage ?? null,
                }
            }),
        })),
        statRules: catalog.statRules,
        damageTargetPresets: DAMAGE_TARGET_PRESETS,
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

export function createInCombatPanelCalculator(catalog, input) {
    const agent = catalog.agentsMap?.get(input.agentId) ?? catalog.agents.find(item => item.id === input.agentId)
    if (!agent) {
        throw new Error(`Unknown agent: ${input.agentId}`)
    }

    const wEngine = catalog.wEnginesMap?.get(input.wEngineId) ?? catalog.wEngines.find(item => item.id === input.wEngineId)
    if (!wEngine) {
        throw new Error(`Unknown W-Engine: ${input.wEngineId}`)
    }

    const driveDiscSets = catalog.driveDiscSetsMap ?? new Map(catalog.driveDiscSets.map(item => [item.id, item]))
    const combatInput = input.combatBuffs ?? input.combat ?? {}
    const activeBuffIds = new Set(Array.isArray(combatInput.activeBuffIds) ? combatInput.activeBuffIds : [])
    const teammateDriveDiscSetIds = Array.isArray(combatInput.teammateDriveDiscSetIds)
        ? combatInput.teammateDriveDiscSetIds
        : []
    const manualStats = Array.isArray(combatInput.manualStats) ? combatInput.manualStats : []
    const runtimeInputs = combatInput.runtimeInputs && typeof combatInput.runtimeInputs === "object"
        ? combatInput.runtimeInputs
        : {}
    const outOfCombatCalculator = createPreparedOutOfCombatPanelCalculator({
        agent,
        wEngine,
        driveDiscSets,
        coreSkillLevel: input.coreSkillLevel,
    })
    const activeCatalogBuffs = (catalog.combatBuffs ?? []).filter(buff => activeBuffIds.has(buff.id))
    const activeAgentBuffs = agentCombatBuffEntries(agent).filter(entry => activeBuffIds.has(entry.id))
    const currentWEngineRequirement = wEngineEffectData(wEngine)?.requirement?.specialty ?? wEngine.specialty
    const activeCurrentWEngineEntries = wEngineCombatBuffEntries(wEngine).filter(entry => activeBuffIds.has(entry.key))
    const appliedCurrentWEngineKeys = new Set(activeCurrentWEngineEntries.map(entry => entry.key))
    const activeTeamWEngineEntries = (catalog.wEngines ?? [])
        .map(sourceWEngine => {
            const key = wEngineTeamBuffKey(sourceWEngine)
            return {
                key,
                sourceWEngine,
                teamBuff: wEngineEffectTeamBuff(sourceWEngine),
            }
        })
        .filter(entry => activeBuffIds.has(entry.key) && !appliedCurrentWEngineKeys.has(entry.key))
    const activeDriveDisc4pcIds = [...activeBuffIds].filter(activeId => String(activeId).startsWith("driveDisc4pc:"))
    const normalizedDamageInput = normalizeDamageInput(input.damage, agent, catalog)
    const activeManualEntries = manualStats
        .map((item, index) => {
            const value = Number(item?.value ?? 0)
            if (!item?.stat || !Number.isFinite(value) || value === 0) {
                return null
            }

            return {
                key: item.id ? `manual:${item.id}` : `manual:${index + 1}`,
                name: {
                    zhCN: item.label ?? "手动修正",
                    en: item.label ?? "Manual Correction",
                },
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
            }
        })
        .filter(Boolean)

    return {
        calculate(driveDiscs = [], options = {}) {
            const outOfCombat = outOfCombatCalculator.calculate(driveDiscs, { round: false })
            const bonusTotals = createCombatBonusTotals()
            const activeEffects = []
            const ignoredEffects = []

            for (const buff of activeCatalogBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: buff,
                    key: buff.id,
                    name: buff.name,
                    sourceType: buff.sourceType ?? "manual",
                    conditionLabel: buff.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[buff.id],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeAgentBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.buff,
                    key: entry.id,
                    name: entry.name,
                    sourceType: "self",
                    conditionLabel: entry.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.id],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeCurrentWEngineEntries) {
                if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
                    ignoredEffects.push({
                        key: entry.key,
                        sourceType: entry.sourceType,
                        reason: "specialtyMismatch",
                    })
                    continue
                }

                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.effect.name ?? entry.name,
                    sourceType: entry.sourceType,
                    conditionLabel: entry.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeTeamWEngineEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.teamBuff,
                    key: entry.key,
                    name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine.name,
                    sourceType: "wEngineTeam",
                    conditionLabel: entry.teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    activeEffects,
                    ignoredEffects,
                })
            }

            const setCounts = new Map()
            for (const disc of driveDiscs) {
                if (!disc.setId) {
                    continue
                }

                setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
            }

            for (const activeId of activeDriveDisc4pcIds) {
                const rawKey = String(activeId).slice("driveDisc4pc:".length)
                const [setId, part = "self"] = rawKey.split(".")
                const set = driveDiscSets.get(setId)
                const count = setCounts.get(setId) ?? 0
                const effect = part === "team"
                    ? driveDiscFourPieceTeamBuff(set)
                    : driveDiscFourPieceSelfBuff(set)
                const sourceType = part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc"

                if (!set) {
                    ignoredEffects.push({
                        key: activeId,
                        sourceType,
                        reason: "missingSet",
                    })
                    continue
                }

                if (count < 4) {
                    ignoredEffects.push({
                        key: activeId,
                        sourceType,
                        reason: "notEquipped4pc",
                    })
                    continue
                }

                applyCombatEffect({
                    bonusTotals,
                    effect,
                    key: activeId,
                    name: set.name,
                    sourceType,
                    conditionLabel: effect?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[activeId],
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
                        sourceType: "driveDisc4pcTeam",
                        reason: "missingSet",
                    })
                    return
                }

                const teamBuff = driveDiscFourPieceTeamBuff(set)
                applyCombatEffect({
                    bonusTotals,
                    effect: teamBuff,
                    key,
                    name: set.name,
                    sourceType: "driveDisc4pcTeam",
                    conditionLabel: teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
                    activeEffects,
                    ignoredEffects,
                })
            })

            for (const entry of activeManualEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.name,
                    sourceType: "manual",
                    conditionLabel: null,
                    outOfCombat,
                    activeEffects,
                    ignoredEffects,
                })
            }

            const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
            const flatFromPct = combatFlatFromPct(bonusTotals, outOfCombat)
            const damage = calculateDamageWhiteBox({
                catalog,
                agent,
                panel: inCombatPanel.panel,
                selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                bonusTotals,
                input: input.damage,
            })

            const result = {
                outOfCombat,
                inCombat: {
                    panel: inCombatPanel.panel,
                    selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                    buffTotals: bonusTotals,
                    activeEffects,
                    ignoredEffects,
                    breakdown: {
                        flatFromPct,
                        ...inCombatAtkBreakdown(outOfCombat, bonusTotals, inCombatPanel.panel),
                        basis: {
                            base: outOfCombat.base,
                            outOfCombatPanel: outOfCombat.panel,
                        },
                    },
                },
                damage,
            }

            return options.round === false ? result : roundNumbers(result)
        },
        scoreFromSummary(statTotals = new Map(), setCounts = new Map()) {
            const outOfCombat = outOfCombatCalculator.calculateFromSummary(statTotals, setCounts, { round: false })
            const bonusTotals = createCombatBonusTotals()
            const activeEffects = []
            const ignoredEffects = []

            for (const buff of activeCatalogBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: buff,
                    key: buff.id,
                    name: buff.name,
                    sourceType: buff.sourceType ?? "manual",
                    conditionLabel: buff.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[buff.id],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeAgentBuffs) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.buff,
                    key: entry.id,
                    name: entry.buff.name,
                    sourceType: "self",
                    conditionLabel: entry.buff.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.id],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeCurrentWEngineEntries) {
                if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
                    continue
                }

                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.effect.name ?? entry.name,
                    sourceType: entry.sourceType,
                    conditionLabel: entry.conditionLabel,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const entry of activeTeamWEngineEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.teamBuff,
                    key: entry.key,
                    name: entry.teamBuff?.name ?? wEngineEffectData(entry.sourceWEngine)?.name ?? entry.sourceWEngine.name,
                    sourceType: "wEngineTeam",
                    conditionLabel: entry.teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[entry.key],
                    activeEffects,
                    ignoredEffects,
                })
            }

            for (const activeId of activeDriveDisc4pcIds) {
                const rawKey = String(activeId).slice("driveDisc4pc:".length)
                const [setId, part = "self"] = rawKey.split(".")
                const set = driveDiscSets.get(setId)
                const count = setCounts.get(setId) ?? 0
                if (!set || count < 4) {
                    continue
                }

                const effect = part === "team"
                    ? driveDiscFourPieceTeamBuff(set)
                    : driveDiscFourPieceSelfBuff(set)
                applyCombatEffect({
                    bonusTotals,
                    effect,
                    key: activeId,
                    name: set.name,
                    sourceType: part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc",
                    conditionLabel: effect?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[activeId],
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
                    return
                }

                const teamBuff = driveDiscFourPieceTeamBuff(set)
                applyCombatEffect({
                    bonusTotals,
                    effect: teamBuff,
                    key,
                    name: set.name,
                    sourceType: "driveDisc4pcTeam",
                    conditionLabel: teamBuff?.condition,
                    outOfCombat,
                    runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
                    activeEffects,
                    ignoredEffects,
                })
            })

            for (const entry of activeManualEntries) {
                applyCombatEffect({
                    bonusTotals,
                    effect: entry.effect,
                    key: entry.key,
                    name: entry.name,
                    sourceType: "manual",
                    conditionLabel: null,
                    outOfCombat,
                    activeEffects,
                    ignoredEffects,
                })
            }

            const inCombatPanel = calculateCombatPanelFromTotals(agent, outOfCombat, bonusTotals)
            return {
                panel: inCombatPanel.panel,
                selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                finalDamage: calculateDamageFinalValue({
                    agent,
                    panel: inCombatPanel.panel,
                    selectedDmgBonus: inCombatPanel.selectedDmgBonus,
                    bonusTotals,
                    damageInput: normalizedDamageInput,
                }),
            }
        },
    }
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
    const runtimeInputs = combatInput.runtimeInputs && typeof combatInput.runtimeInputs === "object"
        ? combatInput.runtimeInputs
        : {}

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
            runtimeInput: runtimeInputs[buff.id],
            activeEffects,
            ignoredEffects,
        })
    }

    for (const entry of agentCombatBuffEntries(agent)) {
        if (!activeBuffIds.has(entry.id)) {
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect: entry.buff,
            key: entry.id,
            name: entry.name,
            sourceType: "self",
            conditionLabel: entry.conditionLabel,
            outOfCombat,
            runtimeInput: runtimeInputs[entry.id],
            activeEffects,
            ignoredEffects,
        })
    }

    const appliedWEngineKeys = new Set()
    const currentWEngineRequirement = wEngineEffectData(wEngine)?.requirement?.specialty ?? wEngine.specialty
    for (const entry of wEngineCombatBuffEntries(wEngine)) {
        if (!activeBuffIds.has(entry.key)) {
            continue
        }

        appliedWEngineKeys.add(entry.key)
        if (entry.requiresCurrentWearer && currentWEngineRequirement && currentWEngineRequirement !== agent.specialty) {
            ignoredEffects.push({
                key: entry.key,
                sourceType: entry.sourceType,
                reason: "specialtyMismatch",
            })
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect: entry.effect,
            key: entry.key,
            name: entry.effect.name ?? entry.name,
            sourceType: entry.sourceType,
            conditionLabel: entry.conditionLabel,
            outOfCombat,
            runtimeInput: runtimeInputs[entry.key],
            activeEffects,
            ignoredEffects,
        })
    }

    for (const sourceWEngine of catalog.wEngines ?? []) {
        const key = wEngineTeamBuffKey(sourceWEngine)
        if (!activeBuffIds.has(key) || appliedWEngineKeys.has(key)) {
            continue
        }

        const teamBuff = wEngineEffectTeamBuff(sourceWEngine)
        applyCombatEffect({
            bonusTotals,
            effect: teamBuff,
            key,
            name: teamBuff?.name ?? wEngineEffectData(sourceWEngine)?.name ?? sourceWEngine.name,
            sourceType: "wEngineTeam",
            conditionLabel: teamBuff?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[key],
            activeEffects,
            ignoredEffects,
        })
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

        const rawKey = activeId.slice("driveDisc4pc:".length)
        const [setId, part = "self"] = rawKey.split(".")
        const set = driveDiscSets.get(setId)
        const count = setCounts.get(setId) ?? 0
        const effect = part === "team"
            ? driveDiscFourPieceTeamBuff(set)
            : driveDiscFourPieceSelfBuff(set)
        const sourceType = part === "team" ? "driveDisc4pcTeam" : "driveDisc4pc"

        if (!set) {
            ignoredEffects.push({
                key: activeId,
                sourceType,
                reason: "missingSet",
            })
            continue
        }

        if (count < 4) {
            ignoredEffects.push({
                key: activeId,
                sourceType,
                reason: "notEquipped4pc",
            })
            continue
        }

        applyCombatEffect({
            bonusTotals,
            effect,
            key: activeId,
            name: set.name,
            sourceType,
            conditionLabel: effect?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[activeId],
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
                sourceType: "driveDisc4pcTeam",
                reason: "missingSet",
            })
            return
        }

        const teamBuff = driveDiscFourPieceTeamBuff(set)
        applyCombatEffect({
            bonusTotals,
            effect: teamBuff,
            key,
            name: set.name,
            sourceType: "driveDisc4pcTeam",
            conditionLabel: teamBuff?.condition,
            outOfCombat,
            runtimeInput: runtimeInputs[key] ?? runtimeInputs[`teammateDriveDisc4pc:${setId}`],
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
    const damage = calculateDamageWhiteBox({
        catalog,
        agent,
        panel: inCombatPanel.panel,
        selectedDmgBonus: inCombatPanel.selectedDmgBonus,
        bonusTotals,
        input: input.damage,
    })

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
                ...inCombatAtkBreakdown(outOfCombat, bonusTotals, inCombatPanel.panel),
                basis: {
                    base: outOfCombat.base,
                    outOfCombatPanel: outOfCombat.panel,
                },
            },
        },
        damage,
    })
}

export async function loadCalculatorContext(rootDir) {
    const dataDir = path.join(rootDir, "data")
    const exampleDir = path.join(rootDir, "examples")
    const catalog = await loadCatalog(dataDir, exampleDir)
    return catalog
}
