function cloneJson(value) {
    if (value === undefined) {
        return undefined
    }
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value)
        } catch (_error) {
            // Vue reactive proxies are not structured-cloneable, but these configs are JSON data.
        }
    }
    return JSON.parse(JSON.stringify(value))
}

function finiteNumber(value, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function groupRange(group = {}) {
    const min = Math.max(0, finiteNumber(group.minCount, 0))
    const rawMax = group.maxCount === undefined || group.maxCount === null || group.maxCount === ""
        ? Number.POSITIVE_INFINITY
        : finiteNumber(group.maxCount, Number.POSITIVE_INFINITY)
    const max = Math.max(min, rawMax)
    const step = Math.max(0.000001, finiteNumber(group.step, 1))
    return { min, max, step }
}

function normalizeId(value) {
    return String(value ?? "").trim()
}

function normalizeStunned(value, fallback = true) {
    return value === undefined ? fallback : Boolean(value)
}

export function calculationSkillGroups(source = {}) {
    const groups = Array.isArray(source?.skillGroups)
        ? source.skillGroups
        : Array.isArray(source?.defaultCalculationConfig?.skillGroups)
            ? source.defaultCalculationConfig.skillGroups
            : []
    return groups.filter(group => group && typeof group === "object" && !Array.isArray(group))
}

export function hasCalculationSkillGroups(source = {}) {
    return calculationSkillGroups(source).some(group => Array.isArray(group.events) && group.events.length)
}

export function skillGroupById(source = {}, groupId = "") {
    const id = normalizeId(groupId)
    return calculationSkillGroups(source).find(group => normalizeId(group.id) === id) ?? null
}

export function skillGroupCountLimits(group = {}) {
    const { min, max, step } = groupRange(group)
    return { min, max: Number.isFinite(max) ? max : null, step }
}

export function normalizeSkillGroupCounts(source = {}, inputCounts = {}) {
    const counts = {}
    for (const group of calculationSkillGroups(source)) {
        const id = normalizeId(group.id)
        if (!id) {
            continue
        }
        const { min, max } = groupRange(group)
        const fallback = finiteNumber(group.defaultCount, min)
        counts[id] = clamp(finiteNumber(inputCounts?.[id], fallback), min, max)
    }
    return counts
}

export function isSkillGroupReferenceEvent(event = {}) {
    return event?.kind === "skillGroup"
}

function strictSkillGroupError(message, event = {}) {
    const id = normalizeId(event?.id)
    return new Error(id ? `技能组引用无法展开（${id}）：${message}` : `技能组引用无法展开：${message}`)
}

export function normalizeSkillGroupReferenceEvent(event = {}, source = {}, index = 0, options = {}) {
    const groups = calculationSkillGroups(source)
    if (!groups.length) {
        if (options.strict) {
            throw strictSkillGroupError("当前角色没有可用的技能组定义。", event)
        }
        return null
    }
    const requestedGroupId = normalizeId(event.skillGroupId ?? event.groupId)
    const requestedGroup = requestedGroupId
        ? groups.find(item => normalizeId(item.id) === requestedGroupId)
        : null
    if (options.strict && (!requestedGroupId || !requestedGroup)) {
        throw strictSkillGroupError(requestedGroupId ? `技能组 ${requestedGroupId} 不存在。` : "没有选择技能组。", event)
    }
    const group = requestedGroup ?? groups[0]
    const groupId = normalizeId(group.id)
    if (!groupId) {
        if (options.strict) {
            throw strictSkillGroupError("技能组 ID 为空。", event)
        }
        return null
    }
    const { min, max } = groupRange(group)
    const fallbackCount = finiteNumber(group.defaultCount, min)
    const count = clamp(finiteNumber(event.count, fallbackCount), min, max)
    const id = normalizeId(event.id) || `${groupId}-ref-${index + 1}`
    return {
        id,
        kind: "skillGroup",
        skillGroupId: groupId,
        count,
        stunned: normalizeStunned(event.stunned, options.defaultStunned ?? true),
    }
}

export function defaultSkillGroupReferenceEvent(source = {}, groupId = "", index = 0) {
    return normalizeSkillGroupReferenceEvent({ skillGroupId: groupId }, source, index)
}

export function normalizeCalculationEventsWithSkillGroups(events = [], source = {}, options = {}) {
    if (!Array.isArray(events)) {
        return []
    }
    return events
        .map((event, index) => {
            if (isSkillGroupReferenceEvent(event)) {
                return normalizeSkillGroupReferenceEvent(event, source, index, options)
            }
            return event && typeof event === "object" && !Array.isArray(event)
                ? cloneJson(event)
                : null
        })
        .filter(Boolean)
}

export function expandCalculationEvents(events = [], source = {}, options = {}) {
    const expandedEvents = []
    const selectedIdMap = new Map()

    normalizeCalculationEventsWithSkillGroups(events, source, options).forEach((event, eventIndex) => {
        if (!isSkillGroupReferenceEvent(event)) {
            expandedEvents.push(cloneJson(event))
            return
        }
        const group = skillGroupById(source, event.skillGroupId)
        if (!group || !Array.isArray(group.events) || !group.events.length) {
            if (options.strict) {
                throw strictSkillGroupError(`技能组 ${event.skillGroupId} 没有配置可展开的事件。`, event)
            }
            return
        }
        const groupCount = finiteNumber(event.count, 0)
        if (groupCount <= 0) {
            return
        }
        const refId = normalizeId(event.id) || `${event.skillGroupId}-ref-${eventIndex + 1}`
        group.events.forEach((childEvent, childIndex) => {
            if (!childEvent || typeof childEvent !== "object" || Array.isArray(childEvent) || isSkillGroupReferenceEvent(childEvent)) {
                if (options.strict && isSkillGroupReferenceEvent(childEvent)) {
                    throw strictSkillGroupError(`技能组 ${event.skillGroupId} 内不能嵌套技能组。`, event)
                }
                return
            }
            const next = cloneJson(childEvent)
            const childId = normalizeId(next.id) || `event-${childIndex + 1}`
            next.id = `${refId}__${childId}`
            next.count = finiteNumber(next.count, 1) * groupCount
            next.stunned = normalizeStunned(event.stunned)
            if (!selectedIdMap.has(refId)) {
                selectedIdMap.set(refId, next.id)
            }
            expandedEvents.push(next)
        })
    })

    const requestedSelectedId = normalizeId(options.selectedEventId)
    const selectedEventId = selectedIdMap.get(requestedSelectedId)
        ?? (expandedEvents.some(event => event.id === requestedSelectedId) ? requestedSelectedId : expandedEvents[0]?.id)
        ?? null
    if (options.strict && expandedEvents.some(event => isSkillGroupReferenceEvent(event))) {
        throw new Error("技能组引用无法展开：展开结果仍包含技能组引用。")
    }
    return {
        selectedEventId,
        events: expandedEvents,
    }
}

export function expandCalculationConfigSkillGroups(config = {}, source = config, options = {}) {
    const expanded = expandCalculationEvents(config?.events ?? [], source, {
        selectedEventId: config?.selectedEventId,
        ...options,
    })
    return {
        ...cloneJson(config ?? {}),
        selectedEventId: expanded.selectedEventId,
        events: expanded.events,
    }
}

export function expandCalculationSkillGroups(config = {}, options = {}) {
    const counts = normalizeSkillGroupCounts(config, options.counts ?? options)
    const events = calculationSkillGroups(config).map((group, index) => ({
        id: `${normalizeId(group.id) || `skill-group-${index + 1}`}-ref-${index + 1}`,
        kind: "skillGroup",
        skillGroupId: normalizeId(group.id),
        count: counts[normalizeId(group.id)] ?? 0,
    }))
    const expanded = expandCalculationEvents(events, config, {
        selectedEventId: events[0]?.id,
    })
    return {
        mode: "custom",
        selectedEventId: expanded.selectedEventId,
        events: expanded.events,
        skillGroupCounts: counts,
    }
}
