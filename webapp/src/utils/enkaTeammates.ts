import { defaultRuntimeForBuff, effectRules, localizedText, normalizeRuntimeForBuff, runtimeParameterDefinitions, runtimeSourceGroups } from '@core/shared-combat.js'
import { teammateBuffCandidates, teammateDriveDiscBuffCandidates, teamWEngineBuffCandidates } from './combatBuffs'
import { isTeammatePotentialBuff, normalizeBuffPickerState, teammateCinemaLevel, teammateOwnerId } from './teammateBuffPicker'

export type TeammateSources = {
  ownerId: string
  uid: string
  history: Record<string, any>
  configs: Record<string, any>
  loadouts: any[]
  discs: any[]
}

export function teammateImportStatus(sources: TeammateSources | undefined, agentId: string): 'imported' | 'missing' | 'partial' {
  const record = sources?.history[agentId]
  if (!sources?.uid || !record || record.uid !== sources.uid) return 'missing'
  return record.completeness === 'full' ? 'imported' : 'partial'
}

export type EnkaTeammateState = {
  version: 1
  ownerId: string
  uid: string
  owners: Record<string, string>
  applied: Record<string, any>
  overrides: Record<string, any>
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export function sameTeammateValue(left: any, right: any): boolean {
  const stable = (value: any): any => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

function mergeFields(base: any, patch: any): any {
  const result = clone(base ?? {})
  for (const [key, value] of Object.entries(patch ?? {})) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeFields(result[key], value) : clone(value)
  }
  return result
}

function changedFields(current: any, previous: any): any {
  return Object.fromEntries(Object.entries(current ?? {}).flatMap(([key, value]) => {
    if (sameTeammateValue(value, previous?.[key])) return []
    return [[key, value && typeof value === 'object' && !Array.isArray(value)
      ? changedFields(value, previous?.[key]) : value]]
  }))
}

function skillCategory(label: string): string | null {
  for (const [pattern, category] of [[/特殊|special/i, 'special'], [/普攻|普通攻击|basic/i, 'basic'], [/闪避|dodge/i, 'dodge'], [/支援|assist/i, 'assist'], [/连携|终结|chain|ultimate/i, 'chain']] as const) {
    if (pattern.test(label) && /等级|level/i.test(label)) return category
  }
  return null
}

// Keep the native defaults editable when imported facts cannot determine a
// parameter. Missing automatic values must not disable a native Buff selection.
function automaticRuntime(buff: any, snapshot: any): { runtime?: any, reason?: string } {
  if (isTeammatePotentialBuff(buff)) return { reason: '潜能需要手动设置' }
  const source = localizedText(buff.sourceLabel ?? buff.source)
  if (/额外能力|additional/i.test(source)) return { reason: '额外能力的队伍触发条件需手动确认' }
  if (/核心|core/i.test(source) && Number(snapshot.coreSkillLevel) !== 6) {
    return { reason: '当前核心等级不能由目录的固定满级效果确定' }
  }
  if (!effectRules(buff).length) return { reason: '目录没有可计算效果' }
  const runtime = defaultRuntimeForBuff(buff)
  const missing: string[] = []
  for (const definition of runtimeParameterDefinitions(buff)) {
    const category = skillCategory(localizedText(definition.label) || definition.id)
    const value = category ? snapshot.skillLevels?.[category] : null
    if (!Number.isInteger(value)) {
      missing.push(localizedText(definition.label) || definition.id)
      continue
    }
    runtime.parameters ??= {}
    runtime.parameters[definition.id] = value
  }
  for (const group of runtimeSourceGroups(buff)) {
    const category = skillCategory(localizedText(group.label))
    const value = category ? snapshot.skillLevels?.[category] : null
    if (!Number.isInteger(value)) {
      missing.push(localizedText(group.label) || '效果参数')
      continue
    }
    for (const id of group.ruleIds) runtime.effects[id].sourceValue = value
  }
  return { runtime: normalizeRuntimeForBuff(buff, runtime),
    reason: missing.length ? `${[...new Set(missing)].join('、')}无法从导入资料自动确定；沿用原生默认值或手动值，请核对` : undefined }
}

export function teammateLoadoutOptions(sources: TeammateSources, teammateId: string) {
  return sources.loadouts.filter(item => item.agentId === teammateId)
    .map(item => ({ label: item.name || item.id, value: item.id }))
}

function selectedDiscs(sources: TeammateSources, slot: any, snapshot: any): any[] {
  const config = sources.configs[slot.teammateId]
  const loadoutId = slot.loadoutId ?? (config
    ? config.discMode === 'loadout' ? config.selectedLoadoutId : null
    : snapshot.selectedLoadoutId)
  const loadout = sources.loadouts.find(item => item.id === loadoutId && item.agentId === slot.teammateId)
  const slots = loadout?.driveDiscIdsBySlot ?? (!slot.loadoutId && config?.discMode === 'manual' ? config.manualDriveDiscIdsBySlot : null)
  if (!slots) return []
  const ids = new Set<string>()
  return [1, 2, 3, 4, 5, 6].flatMap(partition => {
    const id = String(slots[partition] ?? '')
    const disc = sources.discs.find(item => item.id === id && Number(item.partition) === partition)
    if (!disc || ids.has(id)) return []
    ids.add(id)
    return [disc]
  })
}

export function syncEnkaTeammates(input: any, sources: TeammateSources, meta: any, agentId: string, reset = false, currentWEngineId = '') {
  const payload = clone(input)
  const picker = normalizeBuffPickerState(payload.buffPickerState) ?? { teammateSlots: [null, null] }
  payload.buffPickerState = picker
  const previous = picker.enka
  const ownEngineBuffId = `wEngine:${currentWEngineId}.team`
  const scopeMatches = previous?.ownerId === sources.ownerId && previous?.uid === sources.uid
  const overrides: Record<string, any> = scopeMatches ? clone(previous?.overrides ?? {}) : {}
  const characterBuffs = teammateBuffCandidates(meta)
  const engineBuffs = teamWEngineBuffCandidates(meta, '', payload.addedBuffs ?? [])
  const setBuffs = teammateDriveDiscBuffCandidates(meta?.driveDiscSets ?? [])
  const byId = new Map([...characterBuffs, ...engineBuffs, ...setBuffs].map(buff => [buff.id, buff]))
  const selected = new Set<string>(payload.selectedBuffIds ?? [])
  payload.runtimeInputs ??= {}
  payload.addedBuffs ??= []
  const activeOwners = new Set(picker.teammateSlots.filter(Boolean).map(slot => slot!.teammateId))
  const read = (key: string): any => {
    const split = key.indexOf(':'); const kind = key.slice(0, split); const id = key.slice(split + 1)
    if (kind === 'cinema') return picker.teammateSlots.find(slot => slot?.teammateId === id)?.cinemaLevel
    if (kind === 'enabled') return selected.has(id)
    if (kind === 'runtime') return normalizeRuntimeForBuff(byId.get(id), payload.runtimeInputs[id] ?? {})
    return payload.addedBuffs.find((item: any) => item.id === id && item.sourceKind === 'wEngineTeam')?.wEngineModificationLevel
  }
  if (scopeMatches) {
    for (const [key, value] of Object.entries(previous?.applied ?? {})) {
      if (!activeOwners.has(previous!.owners[key]!)) continue
      const current = read(key)
      if (current !== undefined && !sameTeammateValue(current, value)) overrides[key] = key.startsWith('runtime:')
        ? mergeFields(overrides[key], changedFields(current, value)) : clone(current)
    }
  }
  const values: Record<string, any> = {}
  const owners: Record<string, string> = {}
  const notices: string[] = []
  for (const slot of picker.teammateSlots) {
    if (!slot) continue
    if (slot.teammateId === agentId || !characterBuffs.some(buff => teammateOwnerId(buff) === slot.teammateId)) {
      notices.push('队友已不在可用目录中，自动效果已清理')
      continue
    }
    const record = sources.history[slot.teammateId]
    const teammateName = localizedText(characterBuffs.find(buff => teammateOwnerId(buff) === slot.teammateId)?.ownerName) || '队友'
    if (!sources.uid || record?.uid !== sources.uid || record?.completeness !== 'full') {
      notices.push(`${teammateName}：${Object.values(previous?.owners ?? {}).includes(slot.teammateId) ? '自动来源已失效，仅保留手动设置' : '暂无完整导入资料，可手动设置'}`)
      continue
    }
    const snapshot = record.snapshot ?? {}
    const put = (key: string, value: any) => {
      if (key in values) {
        if (key.startsWith('enabled:') && value) notices.push('重复团队效果仅计算一次，采用队友一的配置')
        return
      }
      if (key.startsWith('runtime:') && !(key in (previous?.applied ?? {})) && !reset) {
        const id = key.slice(8)
        const buff = byId.get(id)
        if (buff && payload.runtimeInputs[id]) {
          // Keep edits made through the native picker before the adapter first
          // takes ownership. Catalog defaults are not evidence of manual edits.
          const manual = changedFields(normalizeRuntimeForBuff(buff, payload.runtimeInputs[id]), defaultRuntimeForBuff(buff))
          if (Object.keys(manual).length) overrides[key] = manual
        }
      }
      values[key] = value; owners[key] = slot.teammateId
    }
    if (reset) {
      for (const key of Object.keys(overrides)) if (previous?.owners[key] === slot.teammateId) delete overrides[key]
    }
    const cinemaKey = `cinema:${slot.teammateId}`
    const cinema = overrides[cinemaKey] ?? snapshot.cinemaLevel
    if (Number.isInteger(cinema) && cinema >= 0 && cinema <= 6) put(cinemaKey, cinema)
    for (const buff of characterBuffs.filter(item => teammateOwnerId(item) === slot.teammateId)) {
      const level = teammateCinemaLevel(buff)
      const result = automaticRuntime(buff, snapshot)
      const eligible = (Boolean(result.runtime) || selected.has(buff.id))
        && (level === null || (Number.isInteger(cinema) && level <= cinema))
      put(`enabled:${buff.id}`, eligible)
      if (result.runtime) put(`runtime:${buff.id}`, result.runtime)
      if (result.reason && (level === null || level <= cinema)) notices.push(`${localizedText(buff.ownerName)} · ${localizedText(buff.source) || buff.id}：${result.reason}`)
    }
    const engine = snapshot.wEngine
    const engineBuff = engine && engineBuffs.find(buff => buff.id === `wEngine:${engine.id}.team`)
    if (engineBuff?.id === ownEngineBuffId) {
      notices.push(`${teammateName}与当前角色携带相同音擎，团队效果沿用自身音擎配置`)
    } else if (engineBuff && Number.isInteger(engine.modificationLevel)) {
      const result = automaticRuntime(engineBuff, snapshot)
      put(`enabled:${engineBuff.id}`, Boolean(result.runtime))
      put(`engine:${engineBuff.id}`, engine.modificationLevel)
      if (result.runtime) put(`runtime:${engineBuff.id}`, result.runtime)
      if (result.reason) notices.push(`${teammateName}的音擎：${result.reason}`)
    } else if (!engine) notices.push(`${record.agentName}：音擎缺少有效映射，不自动带入`)
    const discs = selectedDiscs(sources, slot, snapshot)
    const counts = new Map<string, number>()
    for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    for (const buff of setBuffs) if ((counts.get(buff.setId) ?? 0) >= 4) {
      const result = automaticRuntime(buff, snapshot)
      put(`enabled:${buff.id}`, Boolean(result.runtime))
      if (result.runtime) put(`runtime:${buff.id}`, result.runtime)
      if (result.reason) notices.push(`${teammateName}的四件套：${result.reason}`)
    }
  }
  // Remove only fields owned by this adapter. Unrelated native selections and
  // manually enabled effects survive missing import records and resyncs.
  for (const [key, owner] of Object.entries(previous?.owners ?? {})) {
    // The native calculator gives the current wearer's engine this shared ID.
    // Relinquish adapter ownership without changing that native selection/runtime.
    if (key.slice(key.indexOf(':') + 1) === ownEngineBuffId) continue
    if (key in values) continue
    if (activeOwners.has(owner) && key in overrides) {
      values[key] = key.startsWith('runtime:') ? read(key) : overrides[key]; owners[key] = owner
    } else if (key.startsWith('enabled:')) {
      selected.delete(key.slice(8))
      payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== key.slice(8) || item.sourceKind !== 'wEngineTeam')
    } else if (key.startsWith('runtime:')) delete payload.runtimeInputs[key.slice(8)]
  }
  if (previous?.owners[`engine:${ownEngineBuffId}`]) {
    payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== ownEngineBuffId || item.sourceKind !== 'wEngineTeam')
  }
  for (const key of Object.keys(overrides)) {
    if (previous?.owners[key] && owners[key] !== previous.owners[key]) delete overrides[key]
  }
  for (const [key, baseline] of Object.entries(values)) {
    const value = key.startsWith('runtime:') ? mergeFields(baseline, overrides[key]) : overrides[key] ?? baseline
    const split = key.indexOf(':'); const kind = key.slice(0, split); const id = key.slice(split + 1)
    if (kind === 'cinema') {
      const slot = picker.teammateSlots.find(item => item?.teammateId === id)
      if (slot) slot.cinemaLevel = value
    } else if (kind === 'enabled') {
      if (value) selected.add(id)
      else {
        selected.delete(id)
        payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== id || item.sourceKind !== 'wEngineTeam')
      }
    } else if (kind === 'runtime') payload.runtimeInputs[id] = clone(value)
    else if (kind === 'engine' && selected.has(id)) {
      payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== id || item.sourceKind !== 'wEngineTeam')
      payload.addedBuffs.push({ id, sourceCategory: 'wEngine', sourceKind: 'wEngineTeam', wEngineModificationLevel: value })
    }
  }
  for (const key of Object.keys(overrides)) if (!(key in owners)) delete overrides[key]
  payload.selectedBuffIds = [...selected]
  const applied = Object.fromEntries(Object.keys(values).map(key => [key, read(key)]).filter(([, value]) => value !== undefined))
  picker.enka = { version: 1, ownerId: sources.ownerId, uid: sources.uid, owners, applied, overrides }
  return { payload, notices: [...new Set(notices)] }
}
