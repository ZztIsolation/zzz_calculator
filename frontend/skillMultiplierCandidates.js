export const GENERATED_HIT_TOTAL_ROW_ID = "__generated_hit_total"
export const GENERATED_HIT_TOTAL_LABEL = { zhCN: "总伤害倍率" }

const HIT_ROW_ID_PATTERN = /^hit_(\d+)$/

export function skillLevelRange(category = {}, move = {}, row = {}) {
    return row.levelRange ?? move.levelRange ?? category.levelRange ?? {
        min: 1,
        max: Array.isArray(row.values) ? row.values.length : 1,
        default: 1,
    }
}

export function damageSkillRows(move = {}) {
    return (move.rows ?? []).filter(row => (row.kind ?? "damageMultiplier") === "damageMultiplier")
}

export function skillRowValue(category = {}, move = {}, row = {}, level = 1) {
    const range = skillLevelRange(category, move, row)
    return Number(row.values?.[Number(level) - Number(range.min ?? 1)])
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
    const min = Number(range.min ?? 1)
    const max = Number(range.max ?? block[0].values?.length ?? min)
    const values = []
    for (let level = min; level <= max; level += 1) {
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
        values,
        levelRange: {
            min,
            max,
            default: Number(range.default ?? max),
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
    return Number(left.min ?? 1) === Number(right.min ?? 1)
        && Number(left.max ?? 1) === Number(right.max ?? 1)
        && Number(left.default ?? left.max ?? left.min ?? 1) === Number(right.default ?? right.max ?? right.min ?? 1)
}
