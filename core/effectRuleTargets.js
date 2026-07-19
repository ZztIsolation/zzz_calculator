export const DAMAGE_ELEMENTS = Object.freeze(["physical", "fire", "ice", "electric", "ether", "wind"])

export const ELEMENT_DAMAGE_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `${element}Dmg`]),
))

export const ELEMENT_CRIT_DMG_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `${element}CritDmg`]),
))

export const ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `${element}DefIgnore`]),
))

export const ELEMENT_SHEER_DMG_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `${element}SheerDmg`]),
))

export const ELEMENT_RES_IGNORE_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `${element}ResIgnore`]),
))

export const ELEMENT_RES_REDUCTION_STAT_BY_ELEMENT = Object.freeze(Object.fromEntries(
    DAMAGE_ELEMENTS.map(element => [element, `enemy${element[0].toUpperCase()}${element.slice(1)}ResReduction`]),
))

export const ELEMENT_CRIT_DMG_STATS = Object.freeze(Object.values(ELEMENT_CRIT_DMG_STAT_BY_ELEMENT))
export const ELEMENT_DEF_IGNORE_STATS = Object.freeze(Object.values(ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT))

const ELEMENT_BY_INHERENT_STAT = new Map()
for (const element of DAMAGE_ELEMENTS) {
    for (const stat of [
        ELEMENT_DAMAGE_STAT_BY_ELEMENT[element],
        ELEMENT_CRIT_DMG_STAT_BY_ELEMENT[element],
        ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT[element],
        ELEMENT_SHEER_DMG_STAT_BY_ELEMENT[element],
        ELEMENT_RES_IGNORE_STAT_BY_ELEMENT[element],
        ELEMENT_RES_REDUCTION_STAT_BY_ELEMENT[element],
    ]) {
        ELEMENT_BY_INHERENT_STAT.set(stat, element)
    }
}

function clone(value) {
    return globalThis.structuredClone
        ? globalThis.structuredClone(value)
        : JSON.parse(JSON.stringify(value))
}

function nonEmptyArray(value) {
    return Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : []
}

function explicitStatsForElements(stat, elements) {
    const mapping = stat === "dmgBonus"
        ? ELEMENT_DAMAGE_STAT_BY_ELEMENT
        : stat === "critDmg"
            ? ELEMENT_CRIT_DMG_STAT_BY_ELEMENT
            : ["enemyDefIgnore", "enemyDefReduction"].includes(stat)
                ? ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT
                : stat === "enemyResReduction"
                    ? ELEMENT_RES_REDUCTION_STAT_BY_ELEMENT
                    : stat === "sheerDmgBonus"
                        ? ELEMENT_SHEER_DMG_STAT_BY_ELEMENT
                        : null
    return mapping ? elements.map(element => mapping[element]).filter(Boolean) : []
}

function normalizedAppliesTo(rule) {
    if (!rule?.appliesTo || typeof rule.appliesTo !== "object" || Array.isArray(rule.appliesTo)) {
        return null
    }
    const appliesTo = { ...rule.appliesTo }
    for (const key of ["damageKinds", "anomalyEffects", "elements", "skillTargets"]) {
        if (Array.isArray(appliesTo[key]) && !appliesTo[key].length) {
            delete appliesTo[key]
        }
    }
    return Object.keys(appliesTo).length ? appliesTo : null
}

function moveLegacySkillTargets(rule, appliesTo) {
    const skillTargets = Array.isArray(appliesTo?.skillTargets) ? appliesTo.skillTargets : []
    if (!skillTargets.length) {
        return
    }
    if (!rule.target || rule.target.kind === "default") {
        rule.target = { kind: "skill", skillTargets: clone(skillTargets) }
        delete appliesTo.skillTargets
        return
    }
    if (rule.target.kind === "skill"
        && JSON.stringify(rule.target.skillTargets ?? []) === JSON.stringify(skillTargets)) {
        delete appliesTo.skillTargets
    }
}

function migrateRule(rule = {}) {
    const next = clone(rule)
    const legacySkillTargets = Array.isArray(next.appliesTo?.skillTargets) ? next.appliesTo.skillTargets : []
    if (next.type === "damageModifier"
        && (legacySkillTargets.length || !["directDamageBonus", "skillMultiplierBonus"].includes(next.kind))) {
        const rawValue = Number(next.value ?? 0)
        next.type = "fixed"
        next.stat = next.kind === "directDamageBonus" ? "dmgBonus" : next.kind
        next.value = next.valueUnit === "decimal" || Math.abs(rawValue) <= 1 ? rawValue * 100 : rawValue
        next.mode = "flat"
        next.target = legacySkillTargets.length
            ? { kind: "skill", skillTargets: clone(legacySkillTargets) }
            : next.target ?? { kind: "default" }
        delete next.kind
        delete next.valueUnit
        if (next.appliesTo) delete next.appliesTo.skillTargets
    }
    const appliesTo = normalizedAppliesTo(next)
    if (!appliesTo) {
        delete next.appliesTo
        return [next]
    }

    moveLegacySkillTargets(next, appliesTo)
    const elements = nonEmptyArray(appliesTo.elements)
    if (elements.length) {
        const inherentElement = ELEMENT_BY_INHERENT_STAT.get(next.stat)
        if (inherentElement && elements.length === 1 && elements[0] === inherentElement) {
            delete appliesTo.elements
        } else {
            const explicitStats = explicitStatsForElements(next.stat, elements)
            if (explicitStats.length === elements.length) {
                delete appliesTo.elements
                const baseId = String(next.id ?? "effect")
                const stackGroup = next.type === "stacked" && explicitStats.length > 1
                    ? next.stackGroup ?? `${baseId}_element_values`
                    : next.stackGroup
                return explicitStats.map(stat => {
                    const migrated = {
                        ...clone(next),
                        id: explicitStats.length > 1 ? `${baseId}_${stat}` : baseId,
                        stat,
                        ...(stackGroup ? { stackGroup } : {}),
                    }
                    if (Object.keys(appliesTo).length) migrated.appliesTo = clone(appliesTo)
                    else delete migrated.appliesTo
                    return migrated
                })
            }
        }
    }

    if (Object.keys(appliesTo).length) next.appliesTo = appliesTo
    else delete next.appliesTo
    return [next]
}

function migrateEffectSet(effectSet) {
    const idReplacements = new Map()
    const migratedRules = []
    for (const rule of effectSet.effects ?? []) {
        const migrated = migrateRule(rule)
        migratedRules.push(...migrated)
        const oldId = String(rule?.id ?? "")
        if (oldId && (migrated.length !== 1 || migrated[0]?.id !== oldId)) {
            idReplacements.set(oldId, migrated.map(item => item.id).filter(Boolean))
        }
    }
    effectSet.effects = migratedRules
    if (Array.isArray(effectSet.buffModifiers) && idReplacements.size) {
        for (const modifier of effectSet.buffModifiers) {
            if (!Array.isArray(modifier?.targetEffectIds)) continue
            modifier.targetEffectIds = [...new Set(modifier.targetEffectIds.flatMap(id => idReplacements.get(id) ?? [id]))]
        }
    }
}

export function normalizeLegacyEffectAppliesToInValue(value) {
    if (Array.isArray(value)) {
        value.forEach(normalizeLegacyEffectAppliesToInValue)
        return value
    }
    if (!value || typeof value !== "object") {
        return value
    }
    for (const child of Object.values(value)) {
        normalizeLegacyEffectAppliesToInValue(child)
    }
    if (Array.isArray(value.effects)) {
        migrateEffectSet(value)
    }
    return value
}

export function hasLegacyEffectAppliesTo(value) {
    if (Array.isArray(value)) return value.some(hasLegacyEffectAppliesTo)
    if (!value || typeof value !== "object") return false
    if (value.appliesTo && typeof value.appliesTo === "object" && Object.keys(value.appliesTo).length) return true
    return Object.values(value).some(hasLegacyEffectAppliesTo)
}
