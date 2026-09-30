import { damageElementForAgent } from "@core/shared-combat.js"
import { isWindAgent } from "@core/anomalySettlement.js"
import { normalizeElapsedSeconds, turbulenceElapsedStepSeconds } from "@core/damageEventMultipliers.js"

const SOURCE_LABELS: Record<string, string> = {
  assault: "强击",
  shatter: "碎冰",
  burn: "灼烧",
  shock: "感电",
  corruption: "侵蚀",
  frost_frozen: "烈霜（星见雅）",
}

const EFFECT_BY_ELEMENT: Record<string, string> = {
  physical: "assault",
  ice: "shatter",
  fire: "burn",
  electric: "shock",
  ether: "corruption",
}

export function turbulenceEffectsFor(catalog: any): any[] {
  return (catalog?.turbulenceEffects ?? catalog?.anomalyEffects?.effects ?? catalog?.anomalyEffects ?? [])
    .filter((effect: any) => effect?.settlementType === "turbulence" && effect?.element !== "wind" && effect?.id !== "wind_corrosion")
}

export function turbulenceEffectLabel(value: unknown, catalog?: any): string {
  const id = String(value ?? "")
  const effect = turbulenceEffectsFor(catalog).find(effect => effect.id === id)
  return SOURCE_LABELS[id] || effect?.label?.zhCN?.replace(/乱流$/, "") || "未配置"
}

export function turbulenceSourceOptions(catalog: any, selectedId?: string) {
  const options: Array<{ value: string, label: string, disabled?: boolean }> = turbulenceEffectsFor(catalog)
    .map(effect => ({ value: effect.id, label: turbulenceEffectLabel(effect.id, catalog) }))
  if (selectedId && !options.some(option => option.value === selectedId)) {
    options.push({ value: selectedId, label: turbulenceEffectLabel(selectedId, catalog), disabled: true })
  }
  return options
}

export function defaultTurbulenceEffectId(agent: any): string {
  if (!agent || isWindAgent(agent)) return ""
  return agent.attribute === "frost" ? "frost_frozen" : EFFECT_BY_ELEMENT[damageElementForAgent(agent)] ?? ""
}

// Only editor drafts are repaired; valid manual choices may use another element.
export function normalizeTurbulenceEditorEvent(event: any, agent: any, catalog: any) {
  const effects = turbulenceEffectsFor(catalog)
  const selected = String(event.anomalyEffect ?? "")
  const anomalyEffect = selected && (!effects.length || effects.some(effect => effect.id === selected))
    ? selected
    : defaultTurbulenceEffectId(agent)
  const next = { ...event, anomalyEffect }
  if (effects.some(effect => effect.id === anomalyEffect)) {
    next.elapsedSeconds = normalizeElapsedSeconds(event.elapsedSeconds, Infinity, turbulenceElapsedStepSeconds(next, { turbulenceEffects: effects }))
  }
  return next
}

export function turbulenceConfigurationWarning(event: any, catalog: any): string {
  if (event?.settlementType !== "turbulence") return ""
  const effects = turbulenceEffectsFor(catalog)
  if (!effects.length) return "乱流原异常数据未就绪，请重新加载数据后再保存。"
  return effects.some(effect => effect.id === event.anomalyEffect)
    ? ""
    : "乱流原异常未配置或对应数据缺失，请选择有效的原异常。"
}
