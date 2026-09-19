export type TeammateSlot = {
  teammateId: string
  cinemaLevel: number
}

export type BuffPickerState = {
  teammateSlots: [TeammateSlot | null, TeammateSlot | null]
}

const chineseCinemaLevels: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

function sourceTexts(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  return Object.values(value).filter((text): text is string => typeof text === "string")
}

function buffSourceTexts(buff: any): string[] {
  return [...sourceTexts(buff?.sourceLabel), ...sourceTexts(buff?.source)]
}

export function teammateOwnerId(buff: any): string {
  return String(buff?.ownerId ?? "").trim() || String(buff?.teammateId ?? "").trim()
}

// The catalog keeps teammate cinema entries as ordinary Buffs. Resolve their
// level for the picker only, without adding requirements to their effects.
export function teammateCinemaLevel(buff: any): number | null {
  const explicit = buff?.cinemaLevel
  if (typeof explicit === "number" || typeof explicit === "string") {
    const level = Number(explicit)
    if (Number.isInteger(level) && level >= 1 && level <= 6) return level
  }
  for (const text of buffSourceTexts(buff)) {
    const match = text.match(/影画\s*([一二三四五六1-6])(?![一二三四五六七八九十\d])/u)
      ?? text.match(/\bcinema\s*([1-6])(?!\d)/i)
    if (match) return chineseCinemaLevels[match[1]!] ?? Number(match[1])
  }
  const idMatch = String(buff?.id ?? "").match(/(?:^|[.:_-])cinema[._-]?([1-6])(?:[._-]|$)/i)
  return idMatch ? Number(idMatch[1]) : null
}

export function isTeammatePotentialBuff(buff: any): boolean {
  return (Array.isArray(buff?.runtimeParameters)
    && buff.runtimeParameters.some((parameter: any) => parameter?.id === "potentialLevel"))
    || buffSourceTexts(buff).some(text => /潜能|\bpotential\b/i.test(text))
    || /(?:^|[.:_-])potential(?:[.:_-]|$)/i.test(String(buff?.id ?? ""))
}

export function normalizeBuffPickerState(value: unknown): BuffPickerState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const slots = (value as { teammateSlots?: unknown }).teammateSlots
  if (!Array.isArray(slots)) return null
  const seen = new Set<string>()
  const normalized: BuffPickerState = { teammateSlots: [null, null] }
  for (const index of [0, 1] as const) {
    const slot = slots[index]
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue
    const teammateId = typeof slot.teammateId === "string" ? slot.teammateId.trim() : ""
    if (!teammateId || seen.has(teammateId)) continue
    seen.add(teammateId)
    const level = typeof slot.cinemaLevel === "number" || typeof slot.cinemaLevel === "string"
      ? Number(slot.cinemaLevel)
      : 0
    normalized.teammateSlots[index] = {
      teammateId,
      cinemaLevel: Number.isFinite(level) ? Math.min(6, Math.max(0, Math.trunc(level))) : 0,
    }
  }
  return normalized
}

export function selectedTeammateOwnerIds(buffs: any[], selectedIds: Iterable<string>): Set<string> {
  const selected = new Set(selectedIds)
  const selectedOwners = new Set<string>()
  for (const buff of buffs) {
    const ownerId = teammateOwnerId(buff)
    if (ownerId && selected.has(buff?.id)) selectedOwners.add(ownerId)
  }
  // Follow the authored owner order even if selected child entries are interleaved.
  return new Set(buffs.map(teammateOwnerId).filter(ownerId => selectedOwners.has(ownerId)))
}

export function inferBuffPickerState(buffs: any[], selectedIds: Iterable<string>): BuffPickerState {
  const selected = new Set(selectedIds)
  const owners = [...selectedTeammateOwnerIds(buffs, selected)].slice(0, 2)
  const state: BuffPickerState = { teammateSlots: [null, null] }
  for (const index of [0, 1] as const) {
    const teammateId = owners[index]
    if (!teammateId) continue
    let cinemaLevel = 0
    for (const buff of buffs) {
      if (teammateOwnerId(buff) === teammateId && selected.has(buff?.id)) {
        cinemaLevel = Math.max(cinemaLevel, teammateCinemaLevel(buff) ?? 0)
      }
    }
    state.teammateSlots[index] = { teammateId, cinemaLevel }
  }
  return state
}
