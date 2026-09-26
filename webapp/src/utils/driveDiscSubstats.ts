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

export interface EffectiveDriveDiscSubstatCounts {
  total: number
  withoutPenFlat: number
  includesPenFlat: boolean
}

function effectiveSubstatRollCount(subStat: any, meta?: any, rarity: unknown = "S"): number {
  const value = Number(subStat?.value)
  if (!Number.isFinite(value) || value <= 0) return 0

  const normalizedRarity = String(rarity ?? "S").trim().toUpperCase()
  if (normalizedRarity === "S") {
    const rolls = driveDiscSubStatRollCount(subStat?.stat, value, meta)
    if (rolls !== null) return rolls
  }

  // Lower-rarity and legacy values do not have a safe S-rank roll mapping.
  // Count the present effective substat once without inventing extra rolls.
  return 1
}

/** Counts configured important substat rolls for the currently selected discs. */
export function countEffectiveDriveDiscSubstats(
  driveDiscs: any[] = [],
  importantSubStats: unknown[] = [],
  meta?: any,
): EffectiveDriveDiscSubstatCounts {
  const important = new Set(
    (Array.isArray(importantSubStats) ? importantSubStats : [])
      .map(stat => String(stat ?? "").trim())
      .filter(Boolean),
  )
  const includesPenFlat = important.has("penFlat")
  let withoutPenFlat = 0
  let penFlat = 0

  for (const disc of Array.isArray(driveDiscs) ? driveDiscs : []) {
    for (const subStat of Array.isArray(disc?.subStats) ? disc.subStats : []) {
      const stat = String(subStat?.stat ?? "").trim()
      if (!important.has(stat)) continue
      const rolls = effectiveSubstatRollCount(subStat, meta, disc?.rarity)
      if (stat === "penFlat") {
        penFlat += rolls
      } else {
        withoutPenFlat += rolls
      }
    }
  }

  return {
    total: withoutPenFlat + penFlat,
    withoutPenFlat,
    includesPenFlat,
  }
}
