const DRIVE_DISC_ROLL_EPSILON = 1e-6

function subStatSteps(meta: any) {
  return meta?.statRules?.driveDisc?.sRankSubStatBaseStep ?? {}
}

/** Returns the total base-roll count represented by a stored substat value. */
export function driveDiscSubStatRollCount(stat: unknown, value: unknown, meta?: any): number | null {
  const step = Number(subStatSteps(meta)?.[String(stat ?? "")])
  const numericValue = Number(value)
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(numericValue)) return null

  const rolls = numericValue / step
  const roundedRolls = Math.round(rolls)
  if (Math.abs(rolls - roundedRolls) > DRIVE_DISC_ROLL_EPSILON || roundedRolls < 1 || roundedRolls > 6) {
    return null
  }
  return roundedRolls
}

export function driveDiscAdditionalRolls(stat: unknown, value: unknown, meta?: any): number | null {
  const rolls = driveDiscSubStatRollCount(stat, value, meta)
  return rolls === null ? null : Math.max(0, rolls - 1)
}

export function driveDiscAdditionalRollText(stat: unknown, value: unknown, meta?: any, rarity: unknown = "S"): string {
  // Only S-rank roll steps are catalogued; imported lower-rank discs must not
  // be interpreted using those steps, even when their values happen to match.
  if (String(rarity ?? "S").trim().toUpperCase() !== "S") return ""
  const additionalRolls = driveDiscAdditionalRolls(stat, value, meta)
  return additionalRolls && additionalRolls > 0 ? `+${additionalRolls}` : ""
}
