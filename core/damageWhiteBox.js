// Shared presentation helpers for damage white-box rows.

export function formatDamageNumber(value, digits = 3) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }

    if (Number.isInteger(number)) {
        return String(number)
    }

    return String(Number(number.toFixed(digits)))
}

export function formatDamagePercent(value, digits = 1) {
    return `${formatDamageNumber(Number(value ?? 0) * 100, digits)}%`
}

export function defenseWhiteBoxRow(targetBreakdown = {}) {
    const formulaLines = [
        `减防后防御（减防/无视防御）= ${formatDamageNumber(targetBreakdown.targetDefense)} × (1 - ${formatDamagePercent(targetBreakdown.enemyDefReduction)}) - ${formatDamageNumber(targetBreakdown.enemyDefFlatReduction)}`,
        `有效防御（穿透率）= ${formatDamageNumber(targetBreakdown.targetDefenseAfterReduction)} × (1 - ${formatDamagePercent(targetBreakdown.penRatio)}) - ${formatDamageNumber(targetBreakdown.penFlat)}（穿透率合计 ${formatDamagePercent(targetBreakdown.penRatio)} = 面板穿透率 ${formatDamagePercent(targetBreakdown.panelPenRatio)} + 技能目标穿透率 ${formatDamagePercent(targetBreakdown.targetedPenRatio)}）`,
        `防御乘区 = ${formatDamageNumber(targetBreakdown.levelCoefficient)} / (${formatDamageNumber(targetBreakdown.levelCoefficient)} + ${formatDamageNumber(targetBreakdown.effectiveDefense)})`,
    ]
    return {
        label: "防御乘区",
        formula: formulaLines.join("\n"),
        formulaLines,
        value: targetBreakdown.defenseMultiplier,
        displayValue: formatDamageNumber(targetBreakdown.defenseMultiplier, 4),
    }
}

export function resistanceWhiteBoxRow({ targetBreakdown = {}, damageElementText = "" } = {}) {
    return {
        label: "抗性乘区",
        formula: targetBreakdown.resistanceFixedOne
            ? "流明直伤不使用抗性，抗性乘区固定为 1"
            : `clamp(1 - (${damageElementText}抗性 ${formatDamagePercent(targetBreakdown.targetResistance)} - 减抗 ${formatDamagePercent(targetBreakdown.enemyResReduction)} - 抗性无视 ${formatDamagePercent(targetBreakdown.resIgnore)}), 0.01, 2)`,
        value: targetBreakdown.resistanceMultiplier,
        displayValue: targetBreakdown.resistanceFixedOne
            ? "1"
            : formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
    }
}

export function stunWhiteBoxRow(targetBreakdown = {}) {
    const bonus = Number(targetBreakdown.stunDmgMultiplierBonus ?? 0)
    const alwaysBonus = Number(targetBreakdown.stunDmgMultiplierBonusAlways ?? 0)
    const alwaysBonusCap = Number(targetBreakdown.stunDmgMultiplierBonusCapAlways ?? 0)
    const bonusText = [
        bonus ? `失衡易伤倍率加算 ${formatDamagePercent(bonus)}` : "",
        alwaysBonus ? `失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : "",
    ].filter(Boolean).join(" + ")
    return {
        label: "失衡乘区",
        formula: alwaysBonusCap > 0
            ? `捕获失衡倍率 ${formatDamagePercent(targetBreakdown.capturedStunMultiplier)}，帷幕易伤加成上限 ${formatDamagePercent(alwaysBonusCap)}，最终倍率不超过 ${formatDamagePercent(1 + alwaysBonusCap)}`
            : targetBreakdown.stunned
                ? `Boss 已失衡，使用失衡倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)}${bonusText ? ` + ${bonusText}` : ""}`
                : `Boss 未失衡，配置倍率 ${formatDamagePercent(targetBreakdown.stunMultiplier)} 不生效${alwaysBonus ? ` + 失衡易伤倍率加算（未失衡生效） ${formatDamagePercent(alwaysBonus)}` : ""}`,
        value: targetBreakdown.activeStunMultiplier,
        displayValue: formatDamageNumber(targetBreakdown.activeStunMultiplier, 4),
    }
}
