import {
  LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
  LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK,
} from "@core/luminescence.js"

export const LUMINESCENCE_TEAMMATE_ATTACK_ERROR = "队友初始攻击力需要是非负数"
export const LUMINESCENCE_DAMAGE_SHARE_ERROR = "耀变在队伍总伤害中的占比需要在 0% 至 100% 之间"

export interface LuminescenceParameterState {
  teammateAttack: number | null
  luminescenceDamageSharePct: number | null
  teammateAttackError: string
  luminescenceDamageSharePctError: string
  errors: string[]
  valid: boolean
}

function hasOwn(value: unknown, key: string) {
  return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key))
}

function numericValue(value: unknown) {
  if (value === null || typeof value === "boolean") return null
  if (typeof value === "string" && !value.trim()) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizedRecordKind(record: any) {
  return String(record?.kind ?? record?.type ?? "normal")
    .trim()
    .toLowerCase()
    .replace(/[\s_:：-]+/g, "")
}

function legacyTeammateAttack(event: any) {
  const record = Array.isArray(event?.records)
    ? event.records.find((item: any) => ["normal", "ordinary"].includes(normalizedRecordKind(item)))
    : null
  if (!record) return { found: false, value: LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK }
  for (const key of ["T", "teammateAttack", "teammateAtk"]) {
    if (hasOwn(record, key)) return { found: true, value: record[key] }
  }
  return { found: false, value: LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK }
}

export function resolveLuminescenceParameters(event: any = {}): LuminescenceParameterState {
  const explicitTeammateAttack = hasOwn(event, "teammateAttack") && event.teammateAttack !== undefined
  const legacyAttack = explicitTeammateAttack
    ? { found: false, value: LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK }
    : legacyTeammateAttack(event)
  const teammateAttackSource = explicitTeammateAttack
    ? event.teammateAttack
    : legacyAttack.found ? legacyAttack.value : LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK
  const teammateAttack = numericValue(teammateAttackSource)
  const teammateAttackError = teammateAttack === null || teammateAttack < 0
    ? LUMINESCENCE_TEAMMATE_ATTACK_ERROR
    : ""

  const explicitDamageShare = hasOwn(event, "luminescenceDamageSharePct")
    && event.luminescenceDamageSharePct !== undefined
  const damageShareSource = explicitDamageShare
    ? event.luminescenceDamageSharePct
    : LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT
  const luminescenceDamageSharePct = numericValue(damageShareSource)
  const luminescenceDamageSharePctError = luminescenceDamageSharePct === null
    || luminescenceDamageSharePct < 0
    || luminescenceDamageSharePct > 100
    ? LUMINESCENCE_DAMAGE_SHARE_ERROR
    : ""

  const errors = [teammateAttackError, luminescenceDamageSharePctError].filter(Boolean)
  return {
    teammateAttack,
    luminescenceDamageSharePct,
    teammateAttackError,
    luminescenceDamageSharePctError,
    errors,
    valid: errors.length === 0,
  }
}
