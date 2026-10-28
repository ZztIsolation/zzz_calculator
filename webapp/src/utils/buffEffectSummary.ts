/*
 * Buff 行摘要的统一格式化：只保留“属性 + 数值”，适用技能、异常类型等括注留给展开区。
 * Buff 选择弹窗与队友 Buff 卡片共用，避免两处各写一套导致摘要不一致。
 */
export function buffEffectSummary(
  effectRows: ReadonlyArray<{ text?: unknown }> = [],
  modifierLines: ReadonlyArray<unknown> = [],
  fallback = "",
): string {
  const rows = effectRows
    .map(row => String(row?.text ?? "").replace(/（[^）]*）/g, "").trim())
    .filter(Boolean)
  const modifiers = modifierLines.map(line => String(line ?? "").trim()).filter(Boolean)
  return [...rows, ...modifiers].join(" · ") || fallback
}
