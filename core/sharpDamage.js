// The Armorer damage domain is kept independent from ordinary critical damage.
// This module contains only pure formula/state helpers so every calculator
// kernel can share the same two-check critical calculation.

export const SHARP_CRIT_MODES = Object.freeze([
    "expected",
    "nonCrit",
    "sharpCrit",
    "lacerationCrit",
])

export const ARMORER_SHARP_PROFILE = Object.freeze({
    id: "armorer",
    basisStat: "def",
    baseLacerationDmgPct: 150,
    critRateCapPct: 200,
    initialCritDmgToCritRateRatio: 0.35,
})

export const DEFAULT_SHARP_SCENARIO = Object.freeze({
    crimsonInscription: true,
    gashStacks: 3,
    remnantEdgeActive: true,
    perfectDodgeCoverage: 0,
    triggeredEngineEffects: true,
})

function finite(value, fallback = 0) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)))
}

export function normalizeSharpScenario(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    const gashStacks = Math.trunc(finite(source.gashStacks, DEFAULT_SHARP_SCENARIO.gashStacks))
    return {
        crimsonInscription: source.crimsonInscription !== false,
        gashStacks: clamp(gashStacks, 0, 3),
        remnantEdgeActive: source.remnantEdgeActive !== false,
        perfectDodgeCoverage: clamp(source.perfectDodgeCoverage, 0, 1),
        triggeredEngineEffects: source.triggeredEngineEffects !== false,
    }
}

export function resolveSharpProfile(profileOrAgent = null) {
    const profile = profileOrAgent?.sharpProfile ?? profileOrAgent
    if (!profile || typeof profile !== "object") {
        return ARMORER_SHARP_PROFILE
    }
    return {
        ...ARMORER_SHARP_PROFILE,
        ...profile,
        id: String(profile.id ?? ARMORER_SHARP_PROFILE.id),
        basisStat: String(profile.basisStat ?? ARMORER_SHARP_PROFILE.basisStat),
        baseLacerationDmgPct: finite(
            profile.baseLacerationDmgPct,
            ARMORER_SHARP_PROFILE.baseLacerationDmgPct,
        ),
        critRateCapPct: finite(profile.critRateCapPct, ARMORER_SHARP_PROFILE.critRateCapPct),
        initialCritDmgToCritRateRatio: finite(
            profile.initialCritDmgToCritRateRatio,
            ARMORER_SHARP_PROFILE.initialCritDmgToCritRateRatio,
        ),
    }
}

export function normalizeSharpCritMode(value) {
    if (value === "crit") {
        return "sharpCrit"
    }
    return SHARP_CRIT_MODES.includes(value) ? value : "expected"
}

export function normalizeSharpDamageEvent(event = {}, options = {}) {
    const profile = resolveSharpProfile(options.profile ?? options.agent ?? event.sharpProfile)
    const scenario = normalizeSharpScenario(
        event.sharpScenario
            ?? options.sharpScenario
            ?? DEFAULT_SHARP_SCENARIO,
    )
    const sharpComponent = event.sharpComponent === "maim" ? "maim" : "normal"
    const maimTrigger = event.maimTrigger === "free" ? "free" : event.maimTrigger === "gash" ? "gash" : null
    return {
        ...event,
        id: String(event.id ?? options.id ?? "sharp-1"),
        kind: "sharp",
        sharpProfileId: String(event.sharpProfileId ?? profile.id),
        skillMultiplier: Math.max(0, finite(event.skillMultiplier, 1)),
        damageElement: String(event.damageElement ?? options.damageElement ?? "electric"),
        critMode: normalizeSharpCritMode(event.critMode),
        count: Math.max(0, finite(event.count, 1)),
        stunned: event.stunned !== false,
        sharpComponent,
        ...(maimTrigger ? { maimTrigger } : {}),
        sharpScenario: scenario,
        damageScale: Math.max(0, finite(event.damageScale, 1)),
    }
}

function eventNumber(eventTotals, key) {
    return finite(eventTotals?.[key], 0)
}

export function sharpEffectiveCritRate({
    panel = {},
    outOfCombatPanel = panel,
    eventTotals = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const rawInCombatCritRate = finite(panel.critRate, 0)
    const initialCritDmg = finite(outOfCombatPanel?.critDmg, 0)
    const initialCritDmgToCritRateRatio = Math.max(0, profile.initialCritDmgToCritRateRatio)
    const conversion = Math.max(0, initialCritDmg)
        * initialCritDmgToCritRateRatio
    const directBonus = eventNumber(eventTotals, "sharpCritRate")
    const cap = Math.max(0, profile.critRateCapPct) / 100
    const effectiveCritRate = clamp(rawInCombatCritRate + conversion + directBonus, 0, cap)
    return {
        rawInCombatCritRate,
        initialCritDmg,
        initialCritDmgToCritRateRatio,
        initialCritDmgConversion: conversion,
        sharpCritRateBonus: directBonus,
        effectiveCritRate,
        Csharp: effectiveCritRate,
        cap,
    }
}

export function sharpLacerationDamage({
    panel = {},
    eventTotals = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const base = Math.max(
        0,
        Number.isFinite(Number(panel.lacerationDmg))
            ? Number(panel.lacerationDmg)
            : Math.max(0, profile.baseLacerationDmgPct) / 100,
    )
    const bonus = eventNumber(eventTotals, "lacerationDmg")
    return {
        base,
        bonus,
        value: Math.max(0, base + bonus),
        panelLacerationDmg: finite(panel.lacerationDmg, base),
    }
}

export function sharpOverflowDamageBonus({ effectiveCritRate, eventTotals = {} } = {}) {
    const overflowCritRatePct = Math.max(0, finite(effectiveCritRate, 0) * 100 - 100)
    const rawPerOverflow = Math.max(0, eventNumber(eventTotals, "sharpOverflowPerCritRate"))
    const rawCap = Math.max(0, eventNumber(eventTotals, "sharpOverflowCap"))
    // Event modifiers normally arrive as decimals, while direct callers and
    // saved white-box payloads may still provide display percentages.
    const displayPercentInput = rawCap > 1 || rawPerOverflow > 1
    const perOverflowPct = displayPercentInput ? rawPerOverflow : rawPerOverflow * 100
    const capPct = displayPercentInput ? rawCap : rawCap * 100
    const uncapped = overflowCritRatePct * perOverflowPct / 100
    const value = capPct > 0 ? Math.min(uncapped, capPct / 100) : uncapped
    return {
        overflowCritRatePct,
        perOverflowPct,
        capPct,
        uncapped,
        value: Math.max(0, value),
    }
}

export function sharpCritBreakdown({
    panel = {},
    outOfCombatPanel = panel,
    event = {},
    eventTotals = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const critRate = sharpEffectiveCritRate({ panel, outOfCombatPanel, eventTotals, profile })
    const laceration = sharpLacerationDamage({ panel, eventTotals, profile })
    const overflow = sharpOverflowDamageBonus({
        effectiveCritRate: critRate.effectiveCritRate,
        eventTotals,
    })
    const p1 = clamp(critRate.effectiveCritRate, 0, 1)
    const p2 = clamp(critRate.effectiveCritRate - 1, 0, 1)
    const firstCheck = 1 + p1 * laceration.value
    const secondCheck = 1 + p2 * laceration.value
    const expected = firstCheck * secondCheck
    const deterministicSharpCrit = 1 + laceration.value
    const deterministicLacerationCrit = deterministicSharpCrit * deterministicSharpCrit
    const modes = {
        expected,
        nonCrit: 1,
        sharpCrit: deterministicSharpCrit,
        lacerationCrit: deterministicLacerationCrit,
    }
    return {
        ...critRate,
        ...laceration,
        ...overflow,
        // Keep the two domains explicit; both helper results have a `value`
        // field, and the public breakdown uses `value` for laceration damage.
        value: laceration.value,
        lacerationValue: laceration.value,
        overflowValue: overflow.value,
        overflowBonus: overflow.value,
        p1,
        p2,
        firstCheck,
        secondCheck,
        deterministicSharpCrit,
        deterministicLacerationCrit,
        expected,
        expectedMultiplier: expected,
        modes,
        critMode: normalizeSharpCritMode(event.critMode),
        multiplier: modes[normalizeSharpCritMode(event.critMode)] ?? expected,
    }
}

export function sharpDamageMultiplierForMode(breakdown, mode = "expected") {
    const normalizedMode = normalizeSharpCritMode(mode)
    return finite(breakdown?.modes?.[normalizedMode], normalizedMode === "nonCrit" ? 1 : 1)
}

export function sharpStatDependencies(event = {}, options = {}) {
    const profile = resolveSharpProfile(options.profile ?? options.agent)
    const dependencies = new Set([profile.basisStat, "critRate", "critDmg", "lacerationDmg"])
    if (event.damageElement) {
        dependencies.add(`${event.damageElement}Dmg`)
        dependencies.add(`${event.damageElement}SharpDmg`)
    }
    dependencies.add("sharpDmgBonus")
    return [...dependencies]
}

export function sharpDamageValue({
    event = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
    panel = {},
    outOfCombatPanel = panel,
    eventTotals = {},
    targetMultiplier = 1,
    damageMultiplier = 1,
    sharpDamageMultiplier = 1,
    skillMultiplierBonus = 0,
    maimMultiplier = 1,
    baseDef = null,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const normalized = normalizeSharpDamageEvent(event, { profile })
    const panelBasis = finite(panel[profile.basisStat], 0)
    const dynamicDefPct = Math.max(0, eventNumber(eventTotals, "sharpDefPctBonus"))
    const dynamicDefBasis = Number.isFinite(Number(baseDef))
        ? Number(baseDef)
        : panelBasis
    const basis = panelBasis + dynamicDefBasis * dynamicDefPct
    const skill = Math.max(0, normalized.skillMultiplier + finite(skillMultiplierBonus, 0))
    const crit = sharpCritBreakdown({
        panel,
        outOfCombatPanel,
        event: normalized,
        eventTotals,
        profile,
    })
    const overflowMultiplier = 1 + finite(crit.overflowValue, 0)
    const gashActive = normalized.maimTrigger !== "gash"
        || Number(normalized.sharpScenario?.gashStacks ?? 0) > 0
    const componentMultiplier = normalized.sharpComponent === "maim"
        ? gashActive ? Math.max(0, finite(maimMultiplier, 1)) : 0
        : 1
    const dodgeCoverage = clamp(normalized.sharpScenario?.perfectDodgeCoverage, 0, 1)
    const dodgeEligible = ["basic_crimson_forge", "basic_crimson_fall"].includes(
        String(normalized.skillSource?.moveId ?? ""),
    )
    const perfectDodgeBonus = dodgeEligible
        ? dodgeCoverage * Math.max(0, finite(normalized.perfectDodgeDamageBonusPct, 15)) / 100
        : 0
    const effectiveDamageMultiplier = Math.max(0, finite(damageMultiplier, 1)) * (1 + perfectDodgeBonus)
    const singleDamage = basis
        * skill
        * componentMultiplier
        * effectiveDamageMultiplier
        * Math.max(0, finite(sharpDamageMultiplier, 1))
        * overflowMultiplier
        * sharpDamageMultiplierForMode(crit, normalized.critMode)
        * Math.max(0, finite(targetMultiplier, 1))
        * normalized.damageScale
    return {
        basis,
        panelBasis,
        baseDef: Number.isFinite(Number(baseDef)) ? Number(baseDef) : null,
        sharpDefPctBonus: dynamicDefPct,
        skill,
        componentMultiplier,
        gashActive,
        damageMultiplier: effectiveDamageMultiplier,
        perfectDodgeBonus,
        sharpDamageMultiplier: Math.max(0, finite(sharpDamageMultiplier, 1)),
        overflowMultiplier,
        critMultiplier: sharpDamageMultiplierForMode(crit, normalized.critMode),
        crit,
        singleDamage,
        finalDamage: singleDamage * normalized.count,
    }
}

export function sharpDamageVariants(options = {}) {
    const event = normalizeSharpDamageEvent(options.event, options)
    return Object.fromEntries(SHARP_CRIT_MODES.map(mode => {
        const result = sharpDamageValue({ ...options, event: { ...event, critMode: mode } })
        return [mode, {
            critMode: mode,
            critMultiplier: result.critMultiplier,
            singleDamage: result.singleDamage,
            finalDamage: result.finalDamage,
        }]
    }))
}

export function sharpWhiteBoxRows({
    event = {},
    result = {},
    targetBreakdown = {},
    damageMultiplier = 1,
    sharpDamageMultiplier = 1,
} = {}) {
    const crit = result.crit ?? {}
    const critMode = normalizeSharpCritMode(event.critMode)
    const critZoneFormula = critMode === "nonCrit"
        ? "不触发锐暴 = 1"
        : critMode === "sharpCrit"
            ? `一次锐暴 = 1 + ${Number(crit.value ?? 0).toFixed(6)}`
            : critMode === "lacerationCrit"
                ? `(1 + ${Number(crit.value ?? 0).toFixed(6)}) × (1 + ${Number(crit.value ?? 0).toFixed(6)})`
                : `(1 + ${Number(crit.p1 ?? 0).toFixed(6)} × ${Number(crit.value ?? 0).toFixed(6)}) × (1 + ${Number(crit.p2 ?? 0).toFixed(6)} × ${Number(crit.value ?? 0).toFixed(6)})`
    const rows = [
        {
            label: "局内防御力",
            formula: "来自局内面板防御力",
            value: result.panelBasis ?? result.basis,
            displayValue: String(Number(result.panelBasis ?? result.basis ?? 0).toFixed(3)),
        },
        ...(Number(result.sharpDefPctBonus ?? 0) > 0 ? [{
            label: "锋御场景防御力修正",
            formula: `局内防御力 + 基础防御力 × ${Number(Number(result.sharpDefPctBonus ?? 0) * 100).toFixed(3)}%`,
            value: result.basis,
            displayValue: String(Number(result.basis ?? 0).toFixed(3)),
        }] : []),
        {
            label: "技能倍率",
            formula: "锋御技能倍率（以防御力为基底）",
            value: result.skill,
            displayValue: `${Number(Number(result.skill ?? 0) * 100).toFixed(3)}%`,
        },
        {
            label: "锋御有效暴击率",
            formula: `clamp(局内原始暴击率 ${Number(crit.rawInCombatCritRate ?? 0).toFixed(6)}`
                + ` + 局外暴击伤害 ${Number(crit.initialCritDmg ?? 0).toFixed(6)} × ${Number(crit.initialCritDmgToCritRateRatio ?? 0.35).toFixed(6)}`
                + `${Number(crit.sharpCritRateBonus ?? 0) ? ` + 锐暴暴击率修正 ${Number(crit.sharpCritRateBonus).toFixed(6)}` : ""}`
                + `, 0, ${Number(crit.cap ?? 2).toFixed(6)})`,
            value: crit.effectiveCritRate,
            displayValue: `${Number(Number(crit.effectiveCritRate ?? 0) * 100).toFixed(3)}%`,
        },
        {
            label: "第一次锐暴判定",
            formula: `1 + clamp(Csharp, 0, 1) × ${Number(crit.value ?? 0).toFixed(6)}`,
            value: crit.firstCheck,
            displayValue: String(Number(crit.firstCheck ?? 1).toFixed(6)),
        },
        {
            label: "第二次锐暴判定",
            formula: `1 + clamp(Csharp - 1, 0, 1) × ${Number(crit.value ?? 0).toFixed(6)}`,
            value: crit.secondCheck,
            displayValue: String(Number(crit.secondCheck ?? 1).toFixed(6)),
        },
        {
            label: "双重锐暴乘区",
            formula: critZoneFormula,
            value: result.critMultiplier,
            displayValue: String(Number(result.critMultiplier ?? 1).toFixed(6)),
        },
        ...(Number(crit.overflowValue ?? 0) > 0 ? [{
            label: "溢出暴击率增伤",
            formula: `min(max(${Number(crit.effectiveCritRate ?? 0).toFixed(6)} × 100 - 100, 0) × ${Number(crit.perOverflowPct ?? 0).toFixed(6)} / 100, ${Number(crit.capPct ?? 0).toFixed(6)} / 100)`,
            value: crit.overflowValue,
            displayValue: `${Number(Number(crit.overflowValue ?? 0) * 100).toFixed(3)}%`,
        }] : []),
        {
            label: "通用增伤乘区",
            formula: "1 + 通用/属性增伤",
            value: damageMultiplier,
            displayValue: String(Number(damageMultiplier ?? 1).toFixed(6)),
        },
        {
            label: "锐化增伤乘区",
            formula: "1 + 锐化增伤",
            value: sharpDamageMultiplier,
            displayValue: String(Number(sharpDamageMultiplier ?? 1).toFixed(6)),
        },
        {
            label: "防御乘区",
            formula: "复用普通伤害的目标防御乘区",
            value: targetBreakdown.defenseMultiplier,
            displayValue: String(Number(targetBreakdown.defenseMultiplier ?? 1).toFixed(6)),
        },
        {
            label: "抗性乘区",
            formula: "复用普通伤害的属性抗性乘区",
            value: targetBreakdown.resistanceMultiplier,
            displayValue: String(Number(targetBreakdown.resistanceMultiplier ?? 1).toFixed(6)),
        },
        {
            label: "失衡乘区",
            formula: "复用普通伤害的失衡乘区",
            value: targetBreakdown.activeStunMultiplier,
            displayValue: String(Number(targetBreakdown.activeStunMultiplier ?? 1).toFixed(6)),
        },
    ]
    if (event.sharpComponent === "maim") {
        rows.splice(2, 0, {
            label: "毁伤倍率修正",
            formula: "毁伤事件独立乘以其倍率修正",
            value: result.componentMultiplier,
            displayValue: String(Number(result.componentMultiplier ?? 1).toFixed(6)),
        })
    }
    rows.push({
        label: "最终伤害",
        formula: event.count === 1 ? "各乘区相乘" : `单次伤害 × ${event.count}`,
        value: result.finalDamage,
        displayValue: String(Number(result.finalDamage ?? 0).toFixed(3)),
    })
    return rows
}

export function isSharpDamageEvent(event = {}) {
    return event?.kind === "sharp"
}
