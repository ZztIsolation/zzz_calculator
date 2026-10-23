/** 结果条与白盒使用的同一目标值：队伍异常评分取 score，其余取总最终伤害；参数未就绪时为 null */
export function objectiveValueOf(result: any): number | null {
  const damage = result?.damage
  if (!damage || damage.scalarReady === false) return null
  const kind = String(damage.objectiveKind ?? result?.objectiveKind ?? "")
  const isScore = ["luminescenceTeamScore", "luminescenceScore"].includes(kind) || damage.normalizedObjective === true
  const value = isScore
    ? damage.score ?? damage.finalDamage ?? damage.totalFinalDamage
    : damage.totalFinalDamage ?? damage.finalDamage
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export interface DriveDiscContribution {
  discId: string
  /** 去掉这张盘后的目标值 */
  withoutValue: number
  /** (当前值 − 去掉后的值) / 当前值；负数表示去掉后反而更高 */
  share: number
}

/**
 * 逐张去掉驱动盘重新计算，得到每张盘对当前目标值的贡献。
 * evaluate 负责用剩余的盘计算目标值（应包含 4 件套是否成立的变化），失败时返回 null，该盘不给出结果。
 */
export function computeDriveDiscContributions(options: {
  baseValue: number
  discs: any[]
  evaluate: (remaining: any[]) => number | null
}): Record<string, DriveDiscContribution> {
  const { baseValue, discs, evaluate } = options
  const result: Record<string, DriveDiscContribution> = {}
  if (!Number.isFinite(baseValue) || baseValue <= 0) return result
  for (const disc of discs) {
    const discId = String(disc?.id ?? "")
    if (!discId) continue
    const withoutValue = evaluate(discs.filter(item => item !== disc))
    if (withoutValue === null || !Number.isFinite(withoutValue)) continue
    result[discId] = { discId, withoutValue, share: (baseValue - withoutValue) / baseValue }
  }
  return result
}

/** 槽位卡片上的贡献文案；变化不足 0.05% 时不显示 */
export function contributionLabel(contribution: DriveDiscContribution | null | undefined) {
  if (!contribution) return null
  const percent = contribution.share * 100
  if (Math.abs(percent) < 0.05) return null
  const text = `${Math.abs(percent).toFixed(Math.abs(percent) >= 10 ? 1 : 2)}%`
  return percent > 0
    ? { text: `贡献 ${text}`, tone: "positive" as const, title: `去掉这张盘后伤害下降 ${text}（含套装效果变化）` }
    : { text: `去掉反而 +${text}`, tone: "negative" as const, title: `去掉这张盘后伤害反而提升 ${text}，可以考虑更换` }
}
