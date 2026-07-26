const RELEASE_RESULT_MODES = new Set(["originalAnomalyRatio", "fixedAnomalyMultiplier"])
const RELEASE_UNITS = new Set(["raw", "percent", "decimal"])
const RELEASE_OPERATIONS = new Set(["add", "subtract", "multiply", "divide", "max", "min", "clamp", "floor"])
const RELEASE_LEAF_KINDS = new Set(["constant", "triggerStat", "coreSkillScaling", "condition"])
const RELEASE_TRIGGER_STATS = new Set(["atk", "anomalyProficiency", "anomalyMastery"])
const RELEASE_WHITE_BOX_ROLES = new Set(["conversionSource"])
const RELEASE_OPERATION_PRECEDENCE = {
    add: 1,
    subtract: 1,
    multiply: 2,
    divide: 2,
}

function finiteNumber(value, label) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        throw new Error(`${label}必须是有限数值。`)
    }
    return numeric
}

function localizedText(value, fallback = "") {
    if (typeof value === "string") {
        return value
    }
    return String(value?.zhCN ?? value?.en ?? fallback)
}

function convertUnit(value, unit = "raw") {
    if (!RELEASE_UNITS.has(unit)) {
        throw new Error(`异放公式使用了不支持的数值单位：${unit}`)
    }
    return unit === "percent" ? value / 100 : value
}

function intervalOf(value, label) {
    if (value && typeof value === "object" && !Array.isArray(value)
        && (value.min !== undefined || value.max !== undefined)) {
        const min = finiteNumber(value.min ?? value.max, `${label}下界`)
        const max = finiteNumber(value.max ?? value.min, `${label}上界`)
        return min <= max ? { min, max } : { min: max, max: min }
    }
    const exact = finiteNumber(value, label)
    return { min: exact, max: exact }
}

function convertIntervalUnit(interval, unit = "raw") {
    if (!RELEASE_UNITS.has(unit)) {
        throw new Error(`异放公式使用了不支持的数值单位：${unit}`)
    }
    return unit === "percent"
        ? { min: interval.min / 100, max: interval.max / 100 }
        : interval
}

function multiplyIntervals(left, right) {
    const values = [
        left.min * right.min,
        left.min * right.max,
        left.max * right.min,
        left.max * right.max,
    ]
    return { min: Math.min(...values), max: Math.max(...values) }
}

function divideIntervals(left, right) {
    if (right.min <= 0 && right.max >= 0) {
        return { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }
    }
    const values = [
        left.min / right.min,
        left.min / right.max,
        left.max / right.min,
        left.max / right.max,
    ]
    return { min: Math.min(...values), max: Math.max(...values) }
}

function clampValue(value, lower, upper) {
    return Math.max(lower, Math.min(upper, value))
}

function displayNumber(value, precision = 6) {
    if (!Number.isFinite(Number(value))) {
        return "-"
    }
    return Number(value).toFixed(precision).replace(/\.?0+$/, "")
}

function expressionLabel(node, fallback) {
    return localizedText(node?.label, fallback)
}

function operationFormulaTerm(trace, parentOperation, index) {
    const formula = trace.formula ?? trace.expression
    if (trace.kind !== "operation") return formula
    const parentPrecedence = RELEASE_OPERATION_PRECEDENCE[parentOperation] ?? 3
    const childPrecedence = RELEASE_OPERATION_PRECEDENCE[trace.operation] ?? 3
    const requiresGrouping = childPrecedence < parentPrecedence
        || (index > 0 && ["subtract", "divide"].includes(parentOperation) && childPrecedence <= parentPrecedence)
    return requiresGrouping ? `(${formula})` : formula
}

function evaluateLeaf(node, context) {
    const unit = node.unit ?? "raw"
    let rawValue
    let sourceLabel

    if (node.kind === "constant") {
        rawValue = finiteNumber(node.value, "异放公式常量")
        sourceLabel = expressionLabel(node, "常量")
    } else if (node.kind === "triggerStat") {
        const panelKind = node.panel === "inCombat" ? "inCombat" : "outOfCombat"
        const stat = String(node.stat ?? "").trim()
        if (!stat) {
            throw new Error("异放公式的触发者属性不能为空。")
        }
        rawValue = finiteNumber(context?.trigger?.[`${panelKind}Panel`]?.[stat] ?? 0, `触发者属性 ${stat}`)
        sourceLabel = expressionLabel(node, `${panelKind === "inCombat" ? "局内" : "局外"}${stat}`)
    } else if (node.kind === "coreSkillScaling") {
        const field = String(node.field ?? "").trim()
        if (!field) {
            throw new Error("异放公式的核心技倍率字段不能为空。")
        }
        let value = context?.coreScalingRow?.[field]
        if (node.key === "eventElement") {
            value = value?.[context?.eventElement]
        } else if (node.key) {
            value = value?.[node.key]
        }
        rawValue = finiteNumber(value, `核心技倍率 ${field}`)
        sourceLabel = expressionLabel(node, "核心技倍率")
    } else if (node.kind === "condition") {
        if (node.condition !== "stunned") {
            throw new Error(`异放公式使用了不支持的条件：${node.condition ?? ""}`)
        }
        const matched = context?.event?.stunned === true
        rawValue = finiteNumber(matched ? node.whenTrue : node.whenFalse, "异放条件值")
        sourceLabel = expressionLabel(node, "是否失衡")
    } else {
        throw new Error(`异放公式使用了不支持的叶节点：${node.kind ?? ""}`)
    }

    const value = convertUnit(rawValue, unit)
    const rawDisplay = unit === "percent" ? `${displayNumber(rawValue)}%` : displayNumber(rawValue)
    return {
        value,
        trace: {
            kind: node.kind,
            label: sourceLabel,
            unit,
            rawValue,
            value,
            rawDisplay,
            whiteBoxRole: node.whiteBoxRole,
            formula: rawDisplay,
            expression: rawDisplay,
            children: [],
        },
    }
}

function evaluateOperation(node, context) {
    const operation = String(node.op ?? "")
    if (!RELEASE_OPERATIONS.has(operation)) {
        throw new Error(`异放公式使用了不支持的运算：${operation}`)
    }
    const args = Array.isArray(node.args) ? node.args : []
    const expected = operation === "floor" ? 1 : operation === "clamp" ? 3 : null
    if (expected !== null && args.length !== expected) {
        throw new Error(`异放公式运算 ${operation} 需要 ${expected} 个参数。`)
    }
    if (expected === null && args.length < 2) {
        throw new Error(`异放公式运算 ${operation} 至少需要 2 个参数。`)
    }
    const evaluated = args.map(arg => evaluateReleaseExpression(arg, context))
    const values = evaluated.map(item => item.value)
    let value
    if (operation === "add") value = values.reduce((sum, item) => sum + item, 0)
    if (operation === "subtract") value = values.slice(1).reduce((result, item) => result - item, values[0])
    if (operation === "multiply") value = values.reduce((result, item) => result * item, 1)
    if (operation === "divide") {
        if (values.slice(1).some(item => item === 0)) {
            throw new Error("异放公式不能除以 0。")
        }
        value = values.slice(1).reduce((result, item) => result / item, values[0])
    }
    if (operation === "max") value = Math.max(...values)
    if (operation === "min") value = Math.min(...values)
    if (operation === "clamp") value = Math.max(values[1], Math.min(values[2], values[0]))
    if (operation === "floor") value = Math.floor(values[0])
    value = finiteNumber(value, `异放公式运算 ${operation}`)

    const symbols = {
        add: " + ",
        subtract: " - ",
        multiply: " × ",
        divide: " / ",
    }
    const formula = symbols[operation]
        ? evaluated.map((item, index) => operationFormulaTerm(item.trace, operation, index)).join(symbols[operation])
        : `${operation}(${evaluated.map(item => item.trace.formula ?? item.trace.expression).join(", ")})`
    return {
        value,
        trace: {
            kind: "operation",
            operation,
            label: expressionLabel(node, operation),
            unit: "decimal",
            rawValue: value,
            value,
            rawDisplay: displayNumber(value),
            whiteBoxRole: node.whiteBoxRole,
            formula,
            expression: `${formula} = ${displayNumber(value)}`,
            children: evaluated.map(item => item.trace),
        },
    }
}

export function isReleaseSettlement(event = {}) {
    return event?.settlementType === "release" || event?.anomalyVariant === "release"
}

export function anomalyReleaseProfiles(agent = {}) {
    return Array.isArray(agent?.anomalyReleaseProfiles) ? agent.anomalyReleaseProfiles : []
}

export function defaultAnomalyReleaseProfile(agent = {}, damageElement = "") {
    const profiles = anomalyReleaseProfiles(agent)
    return profiles.find(profile => profile?.default === true
        && (!damageElement || !profile.supportedElements?.length || profile.supportedElements.includes(damageElement)))
        ?? profiles.find(profile => !damageElement || !profile.supportedElements?.length || profile.supportedElements.includes(damageElement))
        ?? null
}

export function anomalyReleaseProfile(agent = {}, profileId = "", damageElement = "") {
    const id = String(profileId ?? "").trim()
    const profile = id
        ? anomalyReleaseProfiles(agent).find(item => item?.id === id)
        : defaultAnomalyReleaseProfile(agent, damageElement)
    if (!profile) {
        return null
    }
    if (damageElement && Array.isArray(profile.supportedElements) && profile.supportedElements.length
        && !profile.supportedElements.includes(damageElement)) {
        return null
    }
    return profile
}

export function isAriaReleaseSourceLocked(agent = {}) {
    return String(agent?.id ?? "") === "aria"
}

export function normalizeAnomalyReleaseEventForAgent(event = {}, agent = {}) {
    if (!isReleaseSettlement(event)) {
        return event
    }

    const agentId = String(agent?.id ?? event?.triggerActorRef?.agentId ?? "")
    const profile = anomalyReleaseProfile(agent, event?.triggerActorRef?.profileId)
        ?? defaultAnomalyReleaseProfile(agent)
    const source = event?.anomalySource && typeof event.anomalySource === "object"
        ? event.anomalySource
        : {}
    const sourceActorRef = source.actorRef && typeof source.actorRef === "object"
        ? source.actorRef
        : {}
    const sourceAgentId = String(sourceActorRef.agentId ?? agentId)
    const lockedToAria = isAriaReleaseSourceLocked(agent)
    const normalized = {
        ...event,
        kind: "anomaly",
        settlementType: "release",
        ...(lockedToAria ? { anomalyEffect: "corruption" } : {}),
        triggerActorRef: {
            agentId,
            profileId: String(profile?.id ?? event?.triggerActorRef?.profileId ?? ""),
        },
        anomalySource: lockedToAria
            ? { actorRef: { agentId } }
            : {
                ...source,
                actorRef: {
                    ...sourceActorRef,
                    agentId: sourceAgentId,
                },
            },
    }
    delete normalized.previousAnomalyEffect
    delete normalized.disorderType
    delete normalized.elapsedSeconds
    delete normalized.procCount
    delete normalized.anomalyVariant
    return normalized
}

export function evaluateReleaseExpression(node, context = {}) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
        throw new Error("异放公式节点必须是结构化对象。")
    }
    if (node.op) {
        return evaluateOperation(node, context)
    }
    if (!RELEASE_LEAF_KINDS.has(node.kind)) {
        throw new Error(`异放公式使用了不支持的节点：${node.kind ?? ""}`)
    }
    return evaluateLeaf(node, context)
}

export function evaluateReleaseExpressionInterval(node, context = {}) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
        throw new Error("异放公式节点必须是结构化对象。")
    }
    if (!node.op) {
        const unit = node.unit ?? "raw"
        let raw
        if (node.kind === "constant") {
            raw = intervalOf(node.value, "异放公式常量")
        } else if (node.kind === "triggerStat") {
            const panelKind = node.panel === "inCombat" ? "inCombat" : "outOfCombat"
            const stat = String(node.stat ?? "").trim()
            if (!stat) throw new Error("异放公式的触发者属性不能为空。")
            raw = intervalOf(context?.trigger?.[`${panelKind}Panel`]?.[stat] ?? 0, `触发者属性 ${stat}`)
        } else if (node.kind === "coreSkillScaling") {
            const field = String(node.field ?? "").trim()
            if (!field) throw new Error("异放公式的核心技倍率字段不能为空。")
            let value = context?.coreScalingRow?.[field]
            if (node.key === "eventElement") value = value?.[context?.eventElement]
            else if (node.key) value = value?.[node.key]
            raw = intervalOf(value, `核心技倍率 ${field}`)
        } else if (node.kind === "condition") {
            if (node.condition !== "stunned") {
                throw new Error(`异放公式使用了不支持的条件：${node.condition ?? ""}`)
            }
            raw = intervalOf(context?.event?.stunned === true ? node.whenTrue : node.whenFalse, "异放条件值")
        } else {
            throw new Error(`异放公式使用了不支持的叶节点：${node.kind ?? ""}`)
        }
        return convertIntervalUnit(raw, unit)
    }

    const operation = String(node.op ?? "")
    if (!RELEASE_OPERATIONS.has(operation)) {
        throw new Error(`异放公式使用了不支持的运算：${operation}`)
    }
    const args = Array.isArray(node.args) ? node.args : []
    const expected = operation === "floor" ? 1 : operation === "clamp" ? 3 : null
    if (expected !== null && args.length !== expected) {
        throw new Error(`异放公式运算 ${operation} 需要 ${expected} 个参数。`)
    }
    if (expected === null && args.length < 2) {
        throw new Error(`异放公式运算 ${operation} 至少需要 2 个参数。`)
    }
    const intervals = args.map(arg => evaluateReleaseExpressionInterval(arg, context))
    if (operation === "add") {
        return intervals.reduce((result, item) => ({ min: result.min + item.min, max: result.max + item.max }), { min: 0, max: 0 })
    }
    if (operation === "subtract") {
        return intervals.slice(1).reduce((result, item) => ({ min: result.min - item.max, max: result.max - item.min }), intervals[0])
    }
    if (operation === "multiply") {
        return intervals.reduce(multiplyIntervals, { min: 1, max: 1 })
    }
    if (operation === "divide") {
        return intervals.slice(1).reduce(divideIntervals, intervals[0])
    }
    if (operation === "max") {
        return { min: Math.max(...intervals.map(item => item.min)), max: Math.max(...intervals.map(item => item.max)) }
    }
    if (operation === "min") {
        return { min: Math.min(...intervals.map(item => item.min)), max: Math.min(...intervals.map(item => item.max)) }
    }
    if (operation === "clamp") {
        const values = []
        for (const value of [intervals[0].min, intervals[0].max]) {
            for (const lower of [intervals[1].min, intervals[1].max]) {
                for (const upper of [intervals[2].min, intervals[2].max]) {
                    values.push(clampValue(value, lower, upper))
                }
            }
        }
        return { min: Math.min(...values), max: Math.max(...values) }
    }
    return { min: Math.floor(intervals[0].min), max: Math.floor(intervals[0].max) }
}

export function evaluateAnomalyReleaseProfile(profile = {}, context = {}) {
    const resultMode = String(profile.resultMode ?? "")
    if (!RELEASE_RESULT_MODES.has(resultMode)) {
        throw new Error(`异放倍率模式无效：${resultMode}`)
    }
    const originalBaseMultiplier = Math.max(0, finiteNumber(context.originalBaseMultiplier, "原异常单次倍率"))
    const evaluated = evaluateReleaseExpression(profile.expression, context)
    const formulaValue = Math.max(0, evaluated.value)
    const finalBaseMultiplier = resultMode === "fixedAnomalyMultiplier"
        ? formulaValue
        : originalBaseMultiplier * formulaValue
    const releaseScale = originalBaseMultiplier > 0 ? finalBaseMultiplier / originalBaseMultiplier : 0
    return {
        profileId: String(profile.id ?? ""),
        profileLabel: localizedText(profile.name, profile.id),
        resultMode,
        originalBaseMultiplier,
        formulaValue,
        finalBaseMultiplier,
        releaseScale,
        trace: evaluated.trace,
    }
}

export function evaluateAnomalyReleaseProfileInterval(profile = {}, context = {}) {
    const resultMode = String(profile.resultMode ?? "")
    if (!RELEASE_RESULT_MODES.has(resultMode)) {
        throw new Error(`异放倍率模式无效：${resultMode}`)
    }
    const original = intervalOf(context.originalBaseMultiplier, "原异常单次倍率")
    const formula = evaluateReleaseExpressionInterval(profile.expression, context)
    const nonNegativeFormula = { min: Math.max(0, formula.min), max: Math.max(0, formula.max) }
    const finalBaseMultiplier = resultMode === "fixedAnomalyMultiplier"
        ? nonNegativeFormula
        : multiplyIntervals(original, nonNegativeFormula)
    return {
        resultMode,
        originalBaseMultiplier: original,
        formulaValue: nonNegativeFormula,
        finalBaseMultiplier,
    }
}

export function releaseFormulaStatDependencies(profile = {}) {
    const dependencies = new Set()
    const visit = node => {
        if (!node || typeof node !== "object" || Array.isArray(node)) return
        if (node.kind === "triggerStat" && node.stat) dependencies.add(String(node.stat))
        for (const arg of node.args ?? []) visit(arg)
    }
    visit(profile.expression)
    visit(profile.critRateBonusExpression)
    return [...dependencies]
}

export function validateAnomalyReleaseProfile(profile = {}) {
    const errors = []
    let conversionSourceCount = 0
    if (!String(profile.id ?? "").trim()) errors.push("异放倍率方案 ID 不能为空。")
    if (!RELEASE_RESULT_MODES.has(profile.resultMode)) errors.push("异放倍率方案的结果模式无效。")
    if (!Array.isArray(profile.supportedElements) || !profile.supportedElements.length) {
        errors.push("异放倍率方案必须至少支持一个伤害属性。")
    }
    const validateNode = (node, path, allowWhiteBoxRole = true) => {
        if (!node || typeof node !== "object" || Array.isArray(node)) {
            errors.push(`${path} 必须是结构化公式节点。`)
            return
        }
        if (node.whiteBoxRole !== undefined) {
            if (!allowWhiteBoxRole) {
                errors.push(`${path}.whiteBoxRole 不能标记附加公式。`)
            } else if (!RELEASE_WHITE_BOX_ROLES.has(node.whiteBoxRole)) {
                errors.push(`${path}.whiteBoxRole 不是允许的白盒展示角色。`)
            } else if (node.op) {
                errors.push(`${path}.whiteBoxRole 只能标记公式叶节点。`)
            } else if (node.whiteBoxRole === "conversionSource") {
                conversionSourceCount += 1
            }
        }
        if (node.op) {
            if (!RELEASE_OPERATIONS.has(node.op)) errors.push(`${path} 使用了不支持的运算。`)
            for (const [index, arg] of (node.args ?? []).entries()) validateNode(arg, `${path}.args[${index}]`, allowWhiteBoxRole)
            return
        }
        if (!RELEASE_LEAF_KINDS.has(node.kind)) errors.push(`${path} 使用了不支持的节点。`)
        if (!RELEASE_UNITS.has(node.unit)) errors.push(`${path}.unit 必须显式使用 raw、percent 或 decimal。`)
        if (node.kind === "triggerStat") {
            if (!RELEASE_TRIGGER_STATS.has(node.stat)) errors.push(`${path}.stat 不是允许的触发者属性。`)
            if (!["outOfCombat", "inCombat"].includes(node.panel)) errors.push(`${path}.panel 必须是 outOfCombat 或 inCombat。`)
        }
        if (node.kind === "coreSkillScaling" && !String(node.field ?? "").trim()) {
            errors.push(`${path}.field 不能为空。`)
        }
        if (node.kind === "condition" && node.condition !== "stunned") {
            errors.push(`${path}.condition 目前只支持 stunned。`)
        }
    }
    validateNode(profile.expression, "expression")
    if (profile.critRateBonusExpression) validateNode(profile.critRateBonusExpression, "critRateBonusExpression", false)
    if (conversionSourceCount !== 1) errors.push("异放倍率方案必须且只能标记一个转换数据来源。")
    try {
        evaluateReleaseExpression(profile.expression, {
            trigger: { outOfCombatPanel: new Proxy({}, { get: () => 100 }), inCombatPanel: new Proxy({}, { get: () => 100 }) },
            coreScalingRow: new Proxy({}, { get: () => new Proxy({}, { get: () => 100 }) }),
            event: { stunned: true },
            eventElement: profile.supportedElements?.[0] ?? "physical",
        })
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
    }
    return errors
}

export function normalizeAnomalySourceSnapshot(snapshot = null) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null
    const preserved = structuredClone(snapshot)
    const panel = snapshot.panel && typeof snapshot.panel === "object" ? { ...snapshot.panel } : null
    const outOfCombatPanel = snapshot.outOfCombatPanel && typeof snapshot.outOfCombatPanel === "object"
        ? { ...snapshot.outOfCombatPanel }
        : panel ? { ...panel } : null
    const buffTotals = snapshot.buffTotals && typeof snapshot.buffTotals === "object"
        ? structuredClone(snapshot.buffTotals)
        : {}
    if (!panel || !outOfCombatPanel) return null
    return {
        ...preserved,
        schemaVersion: Number.isFinite(Number(snapshot.schemaVersion)) ? Number(snapshot.schemaVersion) : 1,
        agentId: String(snapshot.agentId ?? ""),
        agentLevel: Math.max(1, Number(snapshot.agentLevel ?? 60)),
        capturedAt: String(snapshot.capturedAt ?? ""),
        sourceConfigHash: String(snapshot.sourceConfigHash ?? ""),
        panel,
        outOfCombatPanel,
        buffTotals,
    }
}

/**
 * @param {{
 *   agentId?: string,
 *   agentLevel?: number,
 *   outOfCombatPanel?: Record<string, unknown>,
 *   inCombatPanel?: Record<string, unknown>,
 *   buffTotals?: Record<string, unknown>,
 *   capturedAt?: string,
 *   sourceConfigHash?: string,
 * }} [options]
 */
export function createAnomalySourceSnapshot({
    agentId,
    agentLevel = 60,
    outOfCombatPanel,
    inCombatPanel,
    buffTotals = {},
    capturedAt = new Date().toISOString(),
    sourceConfigHash = "",
} = {}) {
    return normalizeAnomalySourceSnapshot({
        schemaVersion: 1,
        agentId,
        agentLevel,
        capturedAt,
        sourceConfigHash,
        panel: inCombatPanel,
        outOfCombatPanel,
        buffTotals,
    })
}
