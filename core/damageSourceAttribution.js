// Source attribution helpers for damage white-box rows.
//
// The combat pipeline already resolves every active effect into
// `activeEffects` entries that carry a display name, a source type and the
// individual stat contributions. Those contributions are summed into
// `bonusTotals` before the damage functions run, so the white box used to
// show a bare total such as "通用/属性增伤 68%" with no way to tell where the
// number came from.
//
// These helpers rebuild that missing link: given the compiled totals and the
// resolved effects, they emit a per-source breakdown for one stat key. Rows
// keep plain numbers only - formatting stays in the presentation layer.

const SOURCE_TYPE_LABELS = Object.freeze({
    self: "角色自身",
    wEngine: "音擎",
    wEngineTeam: "队友音擎",
    driveDisc2pc: "驱动盘 2 件套",
    driveDisc4pc: "驱动盘 4 件套",
    driveDisc4pcTeam: "队友驱动盘 4 件套",
    teammate: "队友 Buff",
    field: "场地 Buff",
    boss: "敌方效果",
    manual: "手动修正",
})

export function sourceTypeLabel(sourceType) {
    const key = String(sourceType ?? "").trim()
    if (!key) {
        return "未知来源"
    }
    return SOURCE_TYPE_LABELS[key] ?? key
}

function localizedText(value) {
    if (value === null || value === undefined) {
        return ""
    }
    if (typeof value === "string") {
        return value.trim()
    }
    if (typeof value === "object") {
        const preferred = value.zhCN ?? value.en ?? Object.values(value)[0]
        return typeof preferred === "string" ? preferred.trim() : ""
    }
    return String(value)
}

function finiteValue(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

// A single effect contributes to a stat through `stats` (declared) values.
// Percent based stats are stored in their own totals key, so callers pass the
// statKey they want attributed and we compare against the declared stat name.
function effectStatValue(effect, statKey, targetKind) {
    const stats = Array.isArray(effect?.stats) ? effect.stats : []
    let total = 0
    for (const stat of stats) {
        if (String(stat?.stat ?? "") !== statKey) {
            continue
        }
        const statTargetKind = String(stat?.target?.kind ?? "default")
        if (targetKind && statTargetKind !== targetKind) {
            continue
        }
        total += finiteValue(stat?.value)
    }
    return total
}

// Damage modifiers are evaluated per damage event: a `followUp` scoped buff
// only applies to follow-up moves, a stunned-only rule only applies to
// stunned events, and so on. Attribution has to mirror that filtering or the
// breakdown would credit sources that never touched this event.
function effectDamageModifierValue(effect, statKey, { event = null, appliesTo = null } = {}) {
    const modifiers = Array.isArray(effect?.resolvedDamageModifiers)
        ? effect.resolvedDamageModifiers
        : []
    let total = 0
    for (const modifier of modifiers) {
        if (String(modifier?.kind ?? "") !== statKey) {
            continue
        }
        if (event && typeof appliesTo === "function" && !appliesTo(modifier, event)) {
            continue
        }
        total += finiteValue(modifier?.value)
    }
    return total
}

function effectSourceEntry(effect, value, { condition = null, targetKind = null, stat = "" } = {}) {
    return {
        name: localizedText(effect?.name) || localizedText(effect?.key) || "未命名来源",
        sourceType: String(effect?.sourceType ?? ""),
        sourceTypeLabel: sourceTypeLabel(effect?.sourceType),
        key: String(effect?.key ?? ""),
        stat,
        value,
        targetKind,
        condition: condition ?? (localizedText(effect?.conditionLabel ?? effect?.condition) || null),
    }
}
// Breakdown for the additive direct-damage modifiers that the damage pipeline
// resolves through `resolvedDamageModifiers` (skill scoped bonuses).
export function damageModifierSourceBreakdown(activeEffects = [], modifierKind = "", { event = null, appliesTo = null } = {}) {
    const sources = []
    for (const effect of activeEffects ?? []) {
        const value = effectDamageModifierValue(effect, modifierKind, { event, appliesTo })
        if (!value) {
            continue
        }
        sources.push(effectSourceEntry(effect, value, { stat: modifierKind }))
    }
    return sources
}

function followUpEvent(event = {}) {
    const tags = event?.skillSource?.skillTags ?? event?.skillTags ?? []
    return Array.isArray(tags) && tags.includes("followUp")
}

export function followUpSourceBreakdown(activeEffects = [], event = {}, appliesTo = null) {
    if (!followUpEvent(event)) return []
    const sources = []
    for (const effect of activeEffects ?? []) {
        const targeted = (effect?.resolvedDamageModifiers ?? []).filter(modifier =>
            modifier?.appliesTo?.skillTargets?.some(target => target?.kind === "skillTag" && target?.skillTag === "followUp"))
        for (const modifier of targeted) {
            if (!["dmgBonus", "directDamageBonus"].includes(String(modifier?.kind ?? ""))) continue
            if (typeof appliesTo === "function" && !appliesTo(modifier, event)) continue
            const value = finiteValue(modifier.value)
            if (!value) continue
            sources.push(effectSourceEntry(effect, value, { stat: "followUpDmgBonus" }))
        }
    }
    return sources
}

// One key per contributing effect (not per stat kind), so a skill-tag scoped
// bonus can be removed from the generic bucket even though both report the
// same effect name.
export function followUpSourceKeys(activeEffects = [], event = {}, appliesTo = null) {
    return [...new Set(followUpSourceBreakdown(activeEffects, event, appliesTo).map(source => source.key))]
}

// Converted stats are already included in the in-combat panel. They must not
// also be listed as event modifiers or their contribution would be doubled.
export function panelDamageSourceBreakdown(activeEffects = [], statKey = "", { targetKind = null } = {}) {
    const sources = []
    for (const effect of activeEffects ?? []) {
        const value = effectStatValue(effect, statKey, targetKind)
        if (!value) continue
        sources.push(effectSourceEntry(effect, value, { targetKind, stat: statKey }))
    }
    return sources
}

const SHEER_FORCE_STAT_LABELS = {
    hpFlat: "固定生命转贯穿力",
    hpPct: "生命值%转贯穿力",
    atkFlat: "固定攻击转贯穿力",
    atkPct: "攻击力%转贯穿力",
    sheerForceFlat: "固定贯穿力",
}

export function sheerForceSourceBreakdown(activeEffects = [], outOfCombat = null) {
    const sources = []
    for (const [name, stat, value, formula] of [
        ["局外面板生命", "hpFlat", finiteValue(outOfCombat?.panel?.hp) * 0.1, "局外生命 × 10%"],
        ["局外面板攻击", "atkFlat", finiteValue(outOfCombat?.panel?.atk) * 0.3, "局外攻击 × 30%"],
        ["局外固定贯穿力", "sheerForceFlat", finiteValue(outOfCombat?.panel?.sheerForceFlat), "角色与局外装备"],
    ]) {
        if (!value) continue
        sources.push({ name, sourceType: "panel", sourceTypeLabel: "局外面板", key: `panel:${stat}`, stat, displayStat: SHEER_FORCE_STAT_LABELS[stat], value, valueKind: "flat", formula, condition: null })
    }
    const ratios = { hpFlat: 0.1, hpPct: 0.1, atkFlat: 0.3, atkPct: 0.3 }
    for (const effect of activeEffects ?? []) {
        const stats = Array.isArray(effect?.resolvedStats) ? effect.resolvedStats : []
        for (const stat of stats) {
            const key = String(stat?.stat ?? "")
            if (!(key in ratios) && key !== "sheerForceFlat") continue
            const isPct = key.endsWith("Pct")
            const value = key === "sheerForceFlat"
                ? finiteValue(stat.value)
                : finiteValue(isPct ? stat.resolvedValue : stat.value) * ratios[key]
            if (!value) continue
            sources.push({
                ...effectSourceEntry(effect, value, { stat: key }),
                displayStat: SHEER_FORCE_STAT_LABELS[key],
                valueKind: "flat",
                formula: key === "sheerForceFlat"
                    ? "固定贯穿力"
                    : `${isPct ? "百分比" : "固定"}${key.startsWith("hp") ? "生命" : "攻击"}转化为贯穿力（单次贡献）`,
            })
        }
    }
    return sources
}

// Merge several breakdowns while keeping insertion order, so a row can display
// the general bucket before the element or skill scoped one.
export function mergeSourceBreakdowns(...groups) {
    const merged = []
    for (const group of groups) {
        for (const entry of group ?? []) {
            if (entry && Number(entry.value ?? 0) !== 0) {
                merged.push(entry)
            }
        }
    }
    return merged
}

// Attack sources must use the resolved stats, not the raw percentage. The
// latter has already been converted against the correct base/out-of-combat
// ATK basis by the combat pipeline, including dynamic formula effects.
export function attackSourceBreakdown(activeEffects = [], outOfCombat = null) {
    const baseAtk = finiteValue(outOfCombat?.base?.atk)
    const panelAtk = finiteValue(outOfCombat?.panel?.atk)
    const sources = []
    if (outOfCombat) {
        const base = outOfCombat?.baseBreakdown
        const outAtkPanel = outOfCombat?.breakdown?.atkPanel
        sources.push({
            name: "基础攻击力",
            sourceType: "panel",
            sourceTypeLabel: "角色 / 音擎 / 核心技",
            key: "panel:baseAtk",
            stat: "atk",
            value: baseAtk,
            valueKind: "flat",
            formula: base
                ? `角色 ${finiteValue(base.agent?.atk)} + 音擎 ${finiteValue(base.wEngine?.atk)} + 核心技 ${finiteValue(base.coreSkill?.atk)}`
                : null,
            condition: null,
        })
        if (outAtkPanel) {
            for (const [name, key, value, formula] of [
                ["局外攻击力%", "panel:outAtkPct", finiteValue(outAtkPanel.atkFromPct), `基础攻击力 ${baseAtk} × ${finiteValue(outAtkPanel.atkPct) * 100}%`],
                ["局外固定攻击力", "panel:outAtkFlat", finiteValue(outAtkPanel.atkFlat), "角色、音擎、驱动盘与局外 Buff 的固定攻击合计"],
            ]) {
                if (!value) continue
                sources.push({ name, sourceType: "panel", sourceTypeLabel: "局外面板", key, stat: "atk", value, valueKind: "flat", formula, condition: null })
            }
        }
    }
    for (const effect of activeEffects ?? []) {
        const stats = Array.isArray(effect?.resolvedStats) ? effect.resolvedStats : []
        for (const stat of stats) {
            if (!["atkFlat", "atkPct"].includes(String(stat?.stat ?? ""))
                || String(stat?.target?.kind ?? "default") !== "default") {
                continue
            }
            const isPct = stat.stat === "atkPct"
            const value = isPct ? finiteValue(stat.resolvedValue) : finiteValue(stat.value)
            if (!value) continue
            const basis = stat.basis === "outOfCombatAtk" ? "局外面板攻击力" : "基础攻击力"
            const basisValue = stat.basis === "outOfCombatAtk" ? panelAtk : baseAtk
            sources.push({
                ...effectSourceEntry(effect, value, { stat: stat.stat }),
                valueKind: "flat",
                formula: isPct
                    ? `${basis} ${basisValue} × ${finiteValue(stat.value) * 100}%`
                    : "固定攻击力加成",
            })
        }
    }
    return sources
}

// Attach attribution to an existing white-box row without changing its formula
// or value. Different damage families call this with their own stat mapping.
export function whiteBoxRowWithSources(row, sources) {
    return {
        ...row,
        sources: mergeSourceBreakdowns(...(Array.isArray(sources) ? sources : [sources])),
    }
}

// Effects that were evaluated but produced no contribution. Kept separate so
// the UI can hide them behind a collapsed section instead of padding the
// visible list.
export function inactiveSourceEntries(ignoredEffects = []) {
    return (ignoredEffects ?? []).map(entry => ({
        key: String(entry?.key ?? ""),
        sourceType: String(entry?.sourceType ?? ""),
        sourceTypeLabel: sourceTypeLabel(entry?.sourceType),
        reason: String(entry?.reason ?? ""),
        detail: entry?.stat ?? entry?.scope ?? entry?.exclusiveGroup ?? null,
    }))
}
