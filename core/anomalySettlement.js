import { normalizeAnomalyCritMode, supportsAnomalyCrit } from "./anomalyCrit.js"

// Shared by storage, editors, maintenance and the calculation boundary.
export const WIND_TURBULENCE_NOTICE = "乱流伤害受益于非风属性代理人的面板，而与维琳娜自身面板无关。异常代理人的组队伤害计算将在后续开发。"

export const LEGACY_TURBULENCE_FIELDS = Object.freeze([
    "windSource", "windSourceSnapshot", "anomalySource", "triggerActorRef",
    "secondaryAnomalySource", "secondaryTriggerActorRef", "turbulenceSource",
    "secondaryAnomalyEffect", "secondAnomalyEffect", "secondaryAnomalyLabel",
    "secondaryElement", "secondaryAnomalyRemainingSeconds", "turbulenceEffect",
    "turbulenceVariant", "turbulenceMultiplierStatus", "turbulenceMultiplierSource",
    "turbulenceMultiplierTableKey", "baseAnomalyEffect",
])

export function isTurbulenceSettlement(event = {}) {
    return event?.settlementType === "turbulence" || event?.anomalyVariant === "turbulence"
}

export function isWindAgent(agent = {}) {
    return agent?.attribute === "wind" || agent?.damageElement === "wind"
}

export function isLegacyTurbulenceEvent(event = {}) {
    return isTurbulenceSettlement(event) && (
        LEGACY_TURBULENCE_FIELDS.some(key => event[key] !== undefined)
        || event.anomalyVariant === "turbulence"
        || ["wind_corrosion", "turbulence"].includes(event.anomalyEffect)
        || (event.normalized !== true && event.remainingSeconds !== undefined)
    )
}

export function cleanStoredReactiveEvent(event = {}, agent = {}) {
    const turbulence = isTurbulenceSettlement(event)
    const disorder = event.kind === "disorder" || event.settlementType === "disorder"
    if (isLegacyTurbulenceEvent(event)
        || (isWindAgent(agent) && (turbulence || disorder))
        || (disorder && (event.anomalyEffect ?? event.previousAnomalyEffect) === "wind_corrosion")) return null
    if (!turbulence) return supportsAnomalyCrit(event) && event.critMode !== undefined
        ? { ...event, critMode: normalizeAnomalyCritMode(event.critMode) }
        : event
    return {
        ...(event.id !== undefined ? { id: event.id } : {}),
        kind: "anomaly",
        settlementType: "turbulence",
        ...(event.critMode !== undefined ? { critMode: normalizeAnomalyCritMode(event.critMode) } : {}),
        anomalyEffect: event.anomalyEffect,
        elapsedSeconds: event.elapsedSeconds ?? 0,
        count: event.count ?? 1,
        stunned: event.stunned !== false,
        ...(event.label !== undefined ? { label: event.label } : {}),
        ...(event.damageRatioPct !== undefined ? { damageRatioPct: event.damageRatioPct }
            : event.damageScale !== undefined ? { damageRatioPct: Number(event.damageScale) * 100 } : {}),
    }
}
