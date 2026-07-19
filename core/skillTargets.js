export const SKILL_TYPES = Object.freeze([
    "basic",
    "dodge",
    "assist",
    "special",
    "chain",
    "ultimate",
    "core_skill",
    "additional_ability",
    "cinema",
])

export const SKILL_TYPE_LABELS = Object.freeze({
    basic: "普通攻击",
    dodge: "闪避",
    assist: "支援技",
    special: "特殊技",
    chain: "连携技",
    ultimate: "终结技",
    core_skill: "核心技",
    additional_ability: "额外能力",
    cinema: "影画",
})

export const SKILL_TYPE_VALUES = new Set(SKILL_TYPES)

export const SKILL_TAGS = Object.freeze([
    "dashAttack",
    "exSpecial",
    "assistAttack",
])

export const SKILL_TAG_LABELS = Object.freeze({
    dashAttack: "冲刺攻击",
    exSpecial: "强化特殊技",
    assistAttack: "支援攻击",
})

export const SKILL_TAG_VALUES = new Set(SKILL_TAGS)

const LEGACY_PREFIX_SKILL_TYPES = Object.freeze({
    chain_: "chain",
    ultimate_: "ultimate",
})

export function skillTypeLabel(value) {
    return SKILL_TYPE_LABELS[value] ?? String(value ?? "")
}

export function skillTagLabel(value) {
    return SKILL_TAG_LABELS[value] ?? String(value ?? "")
}

export function skillTagsForMove(move = {}) {
    return [...new Set((Array.isArray(move?.skillTags) ? move.skillTags : [])
        .map(value => String(value ?? "").trim())
        .filter(value => SKILL_TAG_VALUES.has(value)))]
}

export function skillTypeForMove(category = {}, move = {}) {
    const explicit = String(move?.skillType ?? "").trim()
    return SKILL_TYPE_VALUES.has(explicit) ? explicit : ""
}

export function legacySkillTypeForMove(category = {}, move = {}) {
    const explicit = skillTypeForMove(category, move)
    if (explicit) {
        return explicit
    }
    const moveId = String(move?.id ?? "").trim()
    if (moveId.startsWith("ultimate_")) {
        return "ultimate"
    }
    if (moveId.startsWith("chain_")) {
        return "chain"
    }
    const categoryId = String(category?.id ?? "").trim()
    return SKILL_TYPE_VALUES.has(categoryId) ? categoryId : ""
}

export function skillTypeForSource(source = {}) {
    const explicit = String(source?.skillType ?? "").trim()
    return SKILL_TYPE_VALUES.has(explicit) ? explicit : ""
}

export function skillTagsForSource(source = {}) {
    return [...new Set((Array.isArray(source?.skillTags) ? source.skillTags : [])
        .map(value => String(value ?? "").trim())
        .filter(value => SKILL_TAG_VALUES.has(value)))]
}

function legacyTargetPrefixes(target = {}) {
    return (Array.isArray(target.moveIdPrefixes) ? target.moveIdPrefixes : [])
        .map(prefix => String(prefix ?? "").trim())
        .filter(Boolean)
}

export function unknownLegacySkillTargetPrefixes(target = {}) {
    return legacyTargetPrefixes(target).filter(prefix => !LEGACY_PREFIX_SKILL_TYPES[prefix])
}

function cleanSpecificTarget(target, skillType) {
    const agentSkillId = String(target.agentSkillId ?? "").trim()
    const categoryId = String(target.categoryId ?? "").trim()
    const moveId = String(target.moveId ?? "").trim()
    const rowId = String(target.rowId ?? "").trim()
    return {
        kind: "specific",
        agentSkillId,
        categoryId,
        skillType,
        ...(moveId ? { moveId } : {}),
        ...(moveId && rowId ? { rowId } : {}),
    }
}

export function normalizeSkillTarget(target = {}) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
        return []
    }
    const existingPrefixes = legacyTargetPrefixes(target)
    if (["skillType", "skillTag", "specific"].includes(target.kind) && existingPrefixes.length) {
        return [{ ...target }]
    }
    if (target.kind === "skillType") {
        const skillType = String(target.skillType ?? "").trim()
        return [{ kind: "skillType", skillType }]
    }
    if (target.kind === "skillTag") {
        const skillTag = String(target.skillTag ?? "").trim()
        return [{ kind: "skillTag", skillTag }]
    }
    if (target.kind === "specific") {
        const skillType = String(target.skillType ?? "").trim()
            || legacySkillTypeForMove({ id: target.categoryId }, { id: target.moveId })
        return [cleanSpecificTarget(target, skillType)]
    }

    const prefixes = existingPrefixes
    const unknownPrefixes = unknownLegacySkillTargetPrefixes(target)
    if (unknownPrefixes.length) {
        return [{ ...target }]
    }
    const prefixTypes = [...new Set(prefixes.map(prefix => LEGACY_PREFIX_SKILL_TYPES[prefix]).filter(Boolean))]
    const agentSkillId = String(target.agentSkillId ?? "").trim()
    const categoryId = String(target.categoryId ?? "").trim()
    const moveId = String(target.moveId ?? "").trim()

    let skillTypes = prefixTypes
    if (!skillTypes.length) {
        const inferred = legacySkillTypeForMove({ id: categoryId }, { id: moveId })
        if (categoryId === "chain" && !moveId) {
            skillTypes = ["chain", "ultimate"]
        } else if (inferred) {
            skillTypes = [inferred]
        }
    }
    if (!skillTypes.length) {
        return [{ ...target }]
    }
    return skillTypes.map(skillType => agentSkillId
        ? cleanSpecificTarget(target, skillType)
        : { kind: "skillType", skillType })
}

export function normalizeSkillTargets(targets = []) {
    const normalized = (Array.isArray(targets) ? targets : []).flatMap(normalizeSkillTarget)
    const seen = new Set()
    return normalized.filter(target => {
        const key = JSON.stringify(target)
        if (seen.has(key)) {
            return false
        }
        seen.add(key)
        return true
    })
}

export function normalizeSkillTargetsInValue(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeSkillTargetsInValue)
    }
    if (!value || typeof value !== "object") {
        return value
    }
    const next = {}
    for (const [key, child] of Object.entries(value)) {
        next[key] = key === "skillTargets"
            ? normalizeSkillTargets(child).map(normalizeSkillTargetsInValue)
            : normalizeSkillTargetsInValue(child)
    }
    return next
}

export function skillTargetMatches(target = {}, source = {}) {
    if (!target || typeof target !== "object") {
        return false
    }
    if (!["skillType", "skillTag", "specific"].includes(target.kind)) {
        const normalizedTargets = normalizeSkillTarget(target)
        const canonicalTargets = normalizedTargets.filter(item => ["skillType", "skillTag", "specific"].includes(item?.kind))
        if (canonicalTargets.length) {
            return canonicalTargets.some(item => skillTargetMatches(item, source))
        }
    }
    const sourceSkillType = skillTypeForSource(source)
    if (target.kind === "skillType") {
        return Boolean(target.skillType) && target.skillType === sourceSkillType
    }
    if (target.kind === "skillTag") {
        return Boolean(target.skillTag) && skillTagsForSource(source).includes(target.skillTag)
    }
    if (target.kind === "specific") {
        if (!target.agentSkillId || target.agentSkillId !== source.agentSkillId) {
            return false
        }
        if (target.categoryId && target.categoryId !== source.categoryId) {
            return false
        }
        if (target.skillType && target.skillType !== sourceSkillType) {
            return false
        }
        if (target.moveId && target.moveId !== source.moveId) {
            return false
        }
        return skillTargetRowMatches(target, source)
    }

    const hasMoveIdPrefixes = legacyTargetPrefixes(target).length > 0
    if (!target.agentSkillId && !target.categoryId && !target.moveId && !target.rowId && !hasMoveIdPrefixes) {
        return false
    }
    if (target.agentSkillId && target.agentSkillId !== source.agentSkillId) {
        return false
    }
    if (target.categoryId && target.categoryId !== source.categoryId) {
        return false
    }
    if (target.moveId && target.moveId !== source.moveId) {
        return false
    }
    if (hasMoveIdPrefixes && !legacyTargetPrefixes(target).some(prefix => source.moveId?.startsWith(prefix))) {
        return false
    }
    return skillTargetRowMatches(target, source)
}

function skillTargetRowMatches(target, source) {
    if (!target.rowId) {
        return true
    }
    const sourceRowIds = [
        source.rowId,
        ...(Array.isArray(source.generatedFromRowIds) ? source.generatedFromRowIds : []),
    ].filter(Boolean)
    return sourceRowIds.includes(target.rowId)
}
