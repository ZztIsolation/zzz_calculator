export const GENERATED_HIT_TOTAL_ROW_ID = "__generated_hit_total"
export const GENERATED_HIT_TOTAL_LABEL = { zhCN: "总伤害倍率" }
export const SKILL_LEVEL_SCALE = "skill"
export const CORE_SKILL_LEVEL_SCALE = "coreSkill"
export const CORE_SKILL_LEVELS = ["0", "A", "B", "C", "D", "E", "F"]

const HIT_ROW_ID_PATTERN = /^hit_(\d+)$/

export function skillLevelScale(category = {}) {
    return category.levelScale === CORE_SKILL_LEVEL_SCALE ? CORE_SKILL_LEVEL_SCALE : SKILL_LEVEL_SCALE
}

export function isCoreSkillLevelScale(category = {}) {
    return skillLevelScale(category) === CORE_SKILL_LEVEL_SCALE
}

export function skillLevelRange(category = {}, move = {}, row = {}) {
    const range = row.levelRange ?? move.levelRange ?? category.levelRange ?? {}
    if (isCoreSkillLevelScale(category)) {
        const levels = Array.isArray(range.levels) && range.levels.length
            ? range.levels.map(level => String(level ?? "").trim()).filter(Boolean)
            : CORE_SKILL_LEVELS
        const defaultLevel = levels.includes(String(range.default ?? ""))
            ? String(range.default)
            : levels.includes("F")
                ? "F"
                : levels.at(-1) ?? "0"
        return {
            levels,
            default: defaultLevel,
        }
    }

    return {
        min: 1,
        max: Array.isArray(row.values) ? row.values.length : 1,
        default: 1,
        ...range,
    }
}

export function skillLevelValues(category = {}, move = {}, row = {}) {
    const range = skillLevelRange(category, move, row)
    if (Array.isArray(range.levels)) {
        return range.levels
    }

    const min = Number(range.min ?? 1)
    const max = Number(range.max ?? (Array.isArray(row.values) ? row.values.length : min))
    const levels = []
    for (let level = min; level <= max; level += 1) {
        levels.push(level)
    }
    return levels
}

export function defaultSkillLevel(category = {}, move = {}, row = {}) {
    const range = skillLevelRange(category, move, row)
    if (Array.isArray(range.levels)) {
        return range.default ?? range.levels.at(-1) ?? "0"
    }
    return Number(range.default ?? range.max ?? range.min ?? 1)
}

export function normalizeSkillLevel(category = {}, move = {}, row = {}, level) {
    const range = skillLevelRange(category, move, row)
    if (Array.isArray(range.levels)) {
        const raw = String(level ?? range.default ?? "").trim()
        const normalized = raw === "" || raw === "none" ? "0" : raw
        return range.levels.includes(normalized) ? normalized : defaultSkillLevel(category, move, row)
    }

    const min = Number(range.min ?? 1)
    const max = Number(range.max ?? min)
    const fallback = defaultSkillLevel(category, move, row)
    const numeric = Number(level ?? fallback)
    if (!Number.isInteger(numeric)) {
        return fallback
    }
    return Math.max(min, Math.min(max, numeric))
}

export function isValidSkillLevel(category = {}, move = {}, row = {}, level) {
    const range = skillLevelRange(category, move, row)
    if (Array.isArray(range.levels)) {
        const normalized = String(level ?? "").trim()
        return range.levels.includes(normalized === "none" || normalized === "" ? "0" : normalized)
    }

    const numeric = Number(level)
    return Number.isInteger(numeric)
        && numeric >= Number(range.min ?? 1)
        && numeric <= Number(range.max ?? numeric)
}

export function skillLevelLabel(category = {}, level) {
    return isCoreSkillLevelScale(category) ? `核心技${level}` : `LV${level}`
}

export function damageSkillRows(move = {}) {
    return (move.rows ?? []).filter(row => (row.kind ?? "damageMultiplier") === "damageMultiplier")
}

export function skillRowValue(category = {}, move = {}, row = {}, level = 1) {
    const range = skillLevelRange(category, move, row)
    const index = Array.isArray(range.levels)
        ? range.levels.indexOf(String(level ?? "").trim())
        : Number(level) - Number(range.min ?? 1)
    return Number(row.values?.[index])
}

export function damageSkillRowsWithGeneratedTotals(category = {}, move = {}) {
    const rows = damageSkillRows(move)
    const totalRow = generatedHitTotalRow(category, move, rows)
    if (!totalRow) {
        return rows
    }

    const insertAfterIndex = rows.findIndex(row => row.id === totalRow.generatedFromRowIds.at(-1))
    if (insertAfterIndex < 0) {
        return rows
    }

    return [
        ...rows.slice(0, insertAfterIndex + 1),
        totalRow,
        ...rows.slice(insertAfterIndex + 1),
    ]
}

function generatedHitTotalRow(category, move, rows) {
    const block = firstValidHitBlock(category, move, rows)
    if (!block) {
        return null
    }

    const range = skillLevelRange(category, move, block[0])
    const levels = skillLevelValues(category, move, block[0])
    const values = []
    for (const level of levels) {
        const sum = block.reduce((total, row) => total + skillRowValue(category, move, row, level), 0)
        if (!Number.isFinite(sum)) {
            return null
        }
        values.push(Number(sum.toFixed(10)))
    }

    return {
        id: GENERATED_HIT_TOTAL_ROW_ID,
        label: GENERATED_HIT_TOTAL_LABEL,
        kind: "damageMultiplier",
        ...(block.every(row => row.damageBasis === block[0].damageBasis) && block[0].damageBasis ? { damageBasis: block[0].damageBasis } : {}),
        values,
        levelRange: Array.isArray(range.levels)
            ? {
                levels,
                default: normalizeSkillLevel(category, move, block[0], range.default),
            }
            : {
                min: Number(range.min ?? 1),
                max: Number(range.max ?? block[0].values?.length ?? Number(range.min ?? 1)),
                default: Number(range.default ?? range.max ?? range.min ?? 1),
            },
        generated: true,
        generatedFromRowIds: block.map(row => row.id),
    }
}

function firstValidHitBlock(category, move, rows) {
    let block = []
    let previousHitNumber = null

    for (const row of rows) {
        const hitNumber = hitRowNumber(row)
        if (hitNumber !== null && (previousHitNumber === null || hitNumber === previousHitNumber + 1)) {
            block.push(row)
            previousHitNumber = hitNumber
            continue
        }

        const valid = validHitBlock(category, move, block)
        if (valid) {
            return valid
        }

        block = hitNumber === null ? [] : [row]
        previousHitNumber = hitNumber
    }

    return validHitBlock(category, move, block)
}

function hitRowNumber(row = {}) {
    const match = String(row.id ?? "").match(HIT_ROW_ID_PATTERN)
    return match ? Number(match[1]) : null
}

function validHitBlock(category, move, block) {
    if (block.length < 2) {
        return null
    }

    const range = skillLevelRange(category, move, block[0])
    if (!block.every(row => sameSkillLevelRange(range, skillLevelRange(category, move, row)))) {
        return null
    }

    return block
}

function sameSkillLevelRange(left = {}, right = {}) {
    if (Array.isArray(left.levels) || Array.isArray(right.levels)) {
        return Array.isArray(left.levels)
            && Array.isArray(right.levels)
            && left.levels.join("\u0000") === right.levels.join("\u0000")
            && String(left.default ?? "") === String(right.default ?? "")
    }

    return Number(left.min ?? 1) === Number(right.min ?? 1)
        && Number(left.max ?? 1) === Number(right.max ?? 1)
        && Number(left.default ?? left.max ?? left.min ?? 1) === Number(right.default ?? right.max ?? right.min ?? 1)
}
