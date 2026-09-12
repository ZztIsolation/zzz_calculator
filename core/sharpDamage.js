import {
    defenseWhiteBoxRow,
    formatDamageNumber,
    formatDamagePercent,
    resistanceWhiteBoxRow,
    stunWhiteBoxRow,
} from "./damageWhiteBox.js"

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

function finite(value, fallback = 0) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)))
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

export function sharpOutOfCombatCritRate({
    rawCritRate = 0,
    critDmg = 0,
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const baseCritRate = Math.max(0, finite(rawCritRate, 0))
    const initialCritDmg = Math.max(0, finite(critDmg, 0))
    const initialCritDmgToCritRateRatio = Math.max(0, profile.initialCritDmgToCritRateRatio)
    const conversion = initialCritDmg * initialCritDmgToCritRateRatio
    return {
        baseCritRate,
        initialCritDmg,
        initialCritDmgToCritRateRatio,
        conversion,
        critRate: baseCritRate + conversion,
    }
}

export function normalizeSharpCritMode(value) {
    if (value === "crit") {
        return "sharpCrit"
    }
    return SHARP_CRIT_MODES.includes(value) ? value : "expected"
}

export function normalizeSharpDamageEvent(event = {}, options = {}) {
    const {
        sharpProfileId: _sharpProfileId,
        sharpComponent: _sharpComponent,
        maimTrigger: _maimTrigger,
        sharpScenario: _sharpScenario,
        ...cleanEvent
    } = event ?? {}
    return {
        ...cleanEvent,
        id: String(event.id ?? options.id ?? "sharp-1"),
        kind: "sharp",
        skillMultiplier: Math.max(0, finite(event.skillMultiplier, 1)),
        damageElement: String(event.damageElement ?? options.damageElement ?? "electric"),
        critMode: normalizeSharpCritMode(event.critMode),
        count: Math.max(0, finite(event.count, 1)),
        stunned: event.stunned !== false,
        damageScale: Math.max(0, finite(event.damageScale, 1)),
    }
}

function eventNumber(eventTotals, key) {
    return finite(eventTotals?.[key], 0)
}

export function sharpEffectiveCritRate({
    panel = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const rawInCombatCritRate = finite(panel.critRate, 0)
    const cap = Math.max(0, profile.critRateCapPct) / 100
    const effectiveCritRate = clamp(rawInCombatCritRate, 0, cap)
    return {
        rawInCombatCritRate,
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

export function sharpCritBreakdown({
    panel = {},
    outOfCombatPanel = panel,
    event = {},
    eventTotals = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const critRate = sharpEffectiveCritRate({ panel, profile })
    const laceration = sharpLacerationDamage({ panel, eventTotals, profile })
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
        // Keep the two domains explicit; both helper results have a `value`
        // field, and the public breakdown uses `value` for laceration damage.
        value: laceration.value,
        lacerationValue: laceration.value,
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
} = {}) {
    const profile = resolveSharpProfile(profileInput)
    const normalized = normalizeSharpDamageEvent(event, { profile })
    const panelBasis = finite(panel[profile.basisStat], 0)
    const basis = panelBasis
    const skill = Math.max(0, normalized.skillMultiplier + finite(skillMultiplierBonus, 0))
    const crit = sharpCritBreakdown({
        panel,
        outOfCombatPanel,
        event: normalized,
        eventTotals,
        profile,
    })
    const effectiveDamageMultiplier = Math.max(0, finite(damageMultiplier, 1))
    const singleDamage = basis
        * skill
        * effectiveDamageMultiplier
        * Math.max(0, finite(sharpDamageMultiplier, 1))
        * sharpDamageMultiplierForMode(crit, normalized.critMode)
        * Math.max(0, finite(targetMultiplier, 1))
        * normalized.damageScale
    return {
        basis,
        panelBasis,
        skill,
        damageMultiplier: effectiveDamageMultiplier,
        sharpDamageMultiplier: Math.max(0, finite(sharpDamageMultiplier, 1)),
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

function sharpCritRateFormula(crit, profile) {
    const rawCritRate = finite(crit.rawInCombatCritRate, 0)
    const cap = Math.max(0, finite(crit.cap, Math.max(0, profile.critRateCapPct) / 100))
    const effectiveCritRate = clamp(crit.effectiveCritRate, 0, cap)
    return `C锐暴 = clamp(局内面板暴击率 ${formatDamagePercent(rawCritRate)}, 0%, ${formatDamagePercent(cap)}) = ${formatDamagePercent(effectiveCritRate)}`
}

function sharpExpectedCritFormula(crit, profile) {
    const cap = Math.max(0, finite(crit.cap, Math.max(0, profile.critRateCapPct) / 100))
    const effectiveCritRate = clamp(crit.effectiveCritRate, 0, cap)
    const lacerationDamage = formatDamagePercent(crit.value)
    const effectiveCritRateText = formatDamagePercent(effectiveCritRate)
    const branch = effectiveCritRate <= 1
        ? `${effectiveCritRateText} × (1 + ${lacerationDamage}) + (1 - ${effectiveCritRateText})`
        : `(1 + ${lacerationDamage}) × (1 + (${effectiveCritRateText} - 100%) × ${lacerationDamage})`
    return `${sharpCritRateFormula(crit, profile)}；${branch}`
}

function sharpCritZoneFormula(crit, profile, mode) {
    const lacerationDamage = formatDamagePercent(crit.value)
    if (mode === "nonCrit") {
        return "不触发锐暴 = 1"
    }
    if (mode === "sharpCrit") {
        return `一次锐暴 = 1 + ${lacerationDamage}`
    }
    if (mode === "lacerationCrit") {
        return `(1 + ${lacerationDamage}) × (1 + ${lacerationDamage})`
    }
    return sharpExpectedCritFormula(crit, profile)
}

function sharpOrdinaryDamageBonusFormula({ selectedDmgBonus = 0, targetedDmgBonus = 0 } = {}) {
    const selected = finite(selectedDmgBonus, 0)
    const targeted = finite(targetedDmgBonus, 0)
    return `1 + 通用/属性增伤 ${formatDamagePercent(selected, 2)}${targeted !== 0 ? ` + 技能目标增伤 ${formatDamagePercent(targeted, 2)}` : ""}`
}

export function sharpWhiteBoxRows({
    event = {},
    result = {},
    outOfCombatPanel: _outOfCombatPanel = {},
    profile: profileInput = ARMORER_SHARP_PROFILE,
    targetBreakdown = {},
    damageMultiplier = null,
    sharpDamageMultiplier = null,
    selectedDmgBonus = 0,
    targetedDmgBonus = 0,
    sharpDmgBonus = null,
    skillMultiplierBonus = 0,
    damageElementText = "",
} = {}) {
    const crit = result.crit ?? {}
    const profile = resolveSharpProfile(profileInput)
    const critMode = normalizeSharpCritMode(event.critMode)
    const basis = finite(result.basis, finite(result.panelBasis, 0))
    const basisFormula = "来自局内面板防御力"
    const effectiveSkillMultiplier = finite(result.skill, 0)
    const resolvedDamageMultiplier = damageMultiplier === null || damageMultiplier === undefined
        ? finite(result.damageMultiplier, 1)
        : finite(damageMultiplier, 1)
    const resolvedSharpDamageMultiplier = sharpDamageMultiplier === null || sharpDamageMultiplier === undefined
        ? finite(result.sharpDamageMultiplier, 1)
        : finite(sharpDamageMultiplier, 1)
    const critMultiplier = result.critMultiplier === null || result.critMultiplier === undefined
        ? 1
        : finite(result.critMultiplier, 1)
    const effectiveSharpDmgBonus = sharpDmgBonus === null || sharpDmgBonus === undefined
        ? resolvedSharpDamageMultiplier - 1
        : finite(sharpDmgBonus, 0)
    const ordinaryDamageMultiplier = Math.max(0, resolvedDamageMultiplier)
    const effectiveSharpDamageMultiplier = Math.max(0, resolvedSharpDamageMultiplier)
    const skillSourceText = event.skillSource
        ? `${event.skillSource.label ?? "锋御技能"} ${event.skillSource.levelLabel ?? `LV${event.skillSource.level ?? ""}`}`.trim()
        : (event.label ?? "本次锐化倍率")
    const baseSkillMultiplier = finite(event.skillSource?.baseSkillMultiplier, finite(event.skillMultiplier, 0))
    const skillMultiplierFactor = finite(event.skillSource?.skillMultiplierFactor, 1)
    const skillFormula = skillMultiplierFactor !== 1
        ? `${skillSourceText}：${formatDamagePercent(baseSkillMultiplier)} × ${formatDamagePercent(skillMultiplierFactor)}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`
        : `${skillSourceText}${skillMultiplierBonus ? ` + 技能倍率加算 ${formatDamagePercent(skillMultiplierBonus)}` : ""}`
    const damageScale = finite(event.damageScale, 1)
    const eventCount = finite(event.count, 1)
    const rows = [
        {
            label: "局内防御力",
            formula: basisFormula,
            value: basis,
            displayValue: formatDamageNumber(basis),
        },
        {
            label: "技能倍率",
            formula: skillFormula,
            value: effectiveSkillMultiplier,
            displayValue: formatDamagePercent(effectiveSkillMultiplier),
        },
        {
            label: "锐暴乘区",
            formula: sharpCritZoneFormula(crit, profile, critMode),
            value: critMultiplier,
            displayValue: formatDamageNumber(critMultiplier, 4),
        },
        {
            label: "普通增伤区",
            formula: sharpOrdinaryDamageBonusFormula({
                selectedDmgBonus,
                targetedDmgBonus,
            }),
            value: ordinaryDamageMultiplier,
            displayValue: formatDamageNumber(ordinaryDamageMultiplier, 4),
        },
        {
            label: "锐化增伤乘区",
            formula: `1 + 锐化增伤 ${formatDamagePercent(effectiveSharpDmgBonus, 2)}`,
            value: effectiveSharpDamageMultiplier,
            displayValue: formatDamageNumber(effectiveSharpDamageMultiplier, 4),
        },
        defenseWhiteBoxRow(targetBreakdown),
        resistanceWhiteBoxRow({ targetBreakdown, damageElementText }),
        stunWhiteBoxRow(targetBreakdown),
    ]
    if (damageScale !== 1) {
        rows.push({
            label: "伤害比例",
            formula: `本次额外伤害为原伤害的 ${formatDamagePercent(damageScale)}`,
            value: damageScale,
            displayValue: formatDamagePercent(damageScale),
        })
    }
    if (eventCount !== 1) {
        rows.push({
            label: "事件次数",
            formula: "单次伤害 × 次数",
            value: eventCount,
            displayValue: formatDamageNumber(eventCount),
        })
    }
    rows.push({
        label: "最终伤害",
        formula: eventCount === 1
            ? [
                formatDamageNumber(basis),
                formatDamagePercent(effectiveSkillMultiplier),
                formatDamageNumber(critMultiplier, 4),
                formatDamageNumber(ordinaryDamageMultiplier, 4),
                formatDamageNumber(effectiveSharpDamageMultiplier, 4),
                formatDamageNumber(targetBreakdown.defenseMultiplier, 4),
                formatDamageNumber(targetBreakdown.resistanceMultiplier, 4),
                formatDamageNumber(targetBreakdown.activeStunMultiplier, 4),
                ...(damageScale !== 1 ? [formatDamagePercent(damageScale)] : []),
            ].join(" × ")
            : `${formatDamageNumber(result.singleDamage)} × ${formatDamageNumber(eventCount)}`,
        value: result.finalDamage,
        displayValue: formatDamageNumber(result.finalDamage),
    })
    return rows
}

export function isSharpDamageEvent(event = {}) {
    return event?.kind === "sharp"
}
