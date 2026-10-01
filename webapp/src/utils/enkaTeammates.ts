import { buffModifiers, defaultRuntimeForBuff, effectRules, localizedText, normalizeRuntimeForBuff, runtimeParameterDefinitions, runtimeSourceGroups } from '@core/shared-combat.js'
import { teammateBuffCandidates, teammateDriveDiscBuffCandidates, teamWEngineBuffCandidates } from './combatBuffs'
import { isTeammatePotentialBuff, normalizeBuffPickerState, teammateCinemaLevel, teammateOwnerId, type BuffPickerState } from './teammateBuffPicker'

export type TeammateSources = {
  ownerId: string
  uid: string
  history: Record<string, any>
  configs: Record<string, any>
  loadouts: any[]
  discs: any[]
}
export type EnkaTeammateState = {
  version: 1
  ownerId: string
  uid: string
  owners: Record<string, string>
  applied: Record<string, any>
  overrides: Record<string, any>
}
export type TeammateSyncOperation =
  | { kind: 'refresh' | 'resync' }
  | { kind: 'select' | 'cinema'; slotIndex: number }

export function teammateImportStatus(sources: TeammateSources | undefined, agentId: string): 'imported' | 'missing' | 'partial' {
  const record = sources?.history[agentId]
  if (!sources?.uid || !record || record.uid !== sources.uid) return 'missing'
  return record.completeness === 'full' ? 'imported' : 'partial'
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export function sameTeammateValue(left: any, right: any): boolean {
  const stable = (value: any): any => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}
function mergeFields(base: any, patch: any): any {
  const result = clone(base ?? {})
  for (const [key, value] of Object.entries(patch ?? {})) result[key] = value && typeof value === 'object' && !Array.isArray(value)
    ? mergeFields(result[key], value) : clone(value)
  return result
}
function changedFields(current: any, previous: any): any {
  return Object.fromEntries(Object.entries(current ?? {}).flatMap(([key, value]) => {
    if (sameTeammateValue(value, previous?.[key])) return []
    return [[key, value && typeof value === 'object' && !Array.isArray(value) ? changedFields(value, previous?.[key]) : value]]
  }))
}
// Record deliberate edits even when a user returns to the automatic default.
export function recordEnkaTeammateEdit(state: BuffPickerState, key: string, value: any, previousValue?: any) {
  const enka = state.enka
  if (!enka?.owners[key]) return
  enka.overrides[key] = key.startsWith('runtime:')
    ? mergeFields(enka.overrides[key], changedFields(value, previousValue ?? enka.applied[key])) : clone(value)
}
// Stable catalog IDs bind imported skill levels; translated labels are display-only.
const skillSources: Record<string, Record<string, string>> = {
  'yaojiayin.special_aria_buff': { yaojiayin_special_aria_dmg_bonus: 'special', yaojiayin_special_aria_crit_dmg: 'special' },
  'remielle_dan.special.timeflow_hymn': { remielle_dan_special_team_dmg: 'special' },
}
function withoutImportedFields(runtime: any, buffId: string): any {
  const result = clone(runtime ?? {})
  for (const id of Object.keys(skillSources[buffId] ?? {})) {
    if (!result.effects?.[id]) continue
    delete result.effects[id].sourceValue
    if (!Object.keys(result.effects[id]).length) delete result.effects[id]
  }
  if (result.effects && !Object.keys(result.effects).length) delete result.effects
  return result
}
function automaticBuff(buff: any, snapshot: any) {
  const source = localizedText(buff.sourceLabel ?? buff.source)
  const notices: string[] = []
  let selectable = Boolean(effectRules(buff).length || buffModifiers(buff).length)
  if (!selectable) notices.push('目录没有可计算效果')
  if (isTeammatePotentialBuff(buff)) { selectable = false; notices.push('潜能需要手动设置') }
  if (/额外能力|additional/i.test(source)) { selectable = false; notices.push('额外能力的队伍触发条件需手动确认') }
  if (/核心|core/i.test(source) && Number(snapshot.coreSkillLevel) !== 6) {
    selectable = false
    notices.push('当前核心等级不能由目录的固定满级效果确定，请手动核对')
  }
  const imported: any = {}
  for (const group of runtimeSourceGroups(buff)) {
    let resolved = true
    for (const id of group.ruleIds) {
      const category = skillSources[buff.id]?.[id]
      const value = category ? snapshot.skillLevels?.[category] : undefined
      if (!Number.isInteger(value) || value < 1 || value > 16) { resolved = false; continue }
      imported.effects ??= {}
      imported.effects[id] = { sourceValue: value }
    }
    if (!resolved) notices.push(`${localizedText(group.label) || '效果参数'}无法从导入资料自动确定；沿用默认值或手动值，请核对`)
  }
  for (const definition of runtimeParameterDefinitions(buff)) notices.push(`${localizedText(definition.label) || definition.id}需要手动核对`)
  return { selectable, imported, notices }
}
export function teammateLoadoutOptions(sources: TeammateSources, teammateId: string) {
  return sources.loadouts.filter(item => item.agentId === teammateId).map(item => ({ label: item.name || item.id, value: item.id }))
}
function selectedDiscs(sources: TeammateSources, slot: any, snapshot: any, notices: string[], name: string): any[] {
  const loadoutId = slot.loadoutId ?? snapshot.selectedLoadoutId
  const loadout = sources.loadouts.find(item => item.id === loadoutId && item.agentId === slot.teammateId)
  if (!loadout) {
    notices.push(`${name}：${slot.loadoutId ? '所选驱动盘方案已失效' : '缺少有效导入配装'}，请重新选择或导入；四件套仅保留手动设置`)
    return []
  }
  notices.push(`${name}：驱动盘来源为${slot.loadoutId ? '手选方案' : '导入配装'}「${loadout.name || loadout.id}」`)
  const ids = new Set<string>()
  const discs = [1, 2, 3, 4, 5, 6].flatMap(partition => {
    const id = String(loadout.driveDiscIdsBySlot?.[partition] ?? '')
    const disc = sources.discs.find(item => item.id === id && Number(item.partition) === partition)
    if (!disc || ids.has(id)) return []
    ids.add(id)
    return [disc]
  })
  if (discs.length < 6) notices.push(`${name}：方案仅有 ${discs.length} 个有效盘位，按现有驱动盘判断四件套`)
  return discs
}

export function syncEnkaTeammates(input: any, sources: TeammateSources, meta: any, agentId: string,
  operation: TeammateSyncOperation = { kind: 'refresh' }, currentWEngineId = '') {
  const payload = clone(input)
  const picker = normalizeBuffPickerState(payload.buffPickerState) ?? { teammateSlots: [null, null] }
  payload.buffPickerState = picker
  const previous = picker.enka
  const ownEngineBuffId = `wEngine:${currentWEngineId}.team`
  const scopeMatches = previous?.ownerId === sources.ownerId && previous?.uid === sources.uid
  const overrides: Record<string, any> = scopeMatches ? clone(previous?.overrides ?? {}) : {}
  const characterBuffs = teammateBuffCandidates(meta)
  const setBuffs = teammateDriveDiscBuffCandidates(meta?.driveDiscSets ?? [])
  const byId = new Map([...characterBuffs, ...teamWEngineBuffCandidates(meta, '', payload.addedBuffs ?? []), ...setBuffs].map(buff => [buff.id, buff]))
  const selected = new Set<string>(payload.selectedBuffIds ?? [])
  payload.runtimeInputs ??= {}
  payload.addedBuffs ??= []
  const activeOwners = new Set(picker.teammateSlots.filter(Boolean).map(slot => slot!.teammateId))
  const targetOwner = 'slotIndex' in operation ? picker.teammateSlots[operation.slotIndex]?.teammateId : undefined
  const initializes = (owner: string) => operation.kind === 'resync' || (operation.kind === 'select' && targetOwner === owner)
  const read = (key: string): any => {
    const split = key.indexOf(':'); const kind = key.slice(0, split); const id = key.slice(split + 1)
    if (kind === 'cinema') return picker.teammateSlots.find(slot => slot?.teammateId === id)?.cinemaLevel
    if (kind === 'enabled') return selected.has(id)
    if (kind === 'runtime') return normalizeRuntimeForBuff(byId.get(id), payload.runtimeInputs[id] ?? {})
    return payload.addedBuffs.find((item: any) => item.id === id && item.sourceKind === 'wEngineTeam')?.wEngineModificationLevel
  }
  if (scopeMatches) for (const [key, value] of Object.entries(previous?.applied ?? {})) {
    if (!activeOwners.has(previous!.owners[key]!)) continue
    const current = read(key)
    if (current !== undefined && !sameTeammateValue(current, value)) overrides[key] = key.startsWith('runtime:')
      ? mergeFields(overrides[key], changedFields(current, value)) : clone(current)
  }
  if (previous && !scopeMatches) for (const slot of picker.teammateSlots) if (slot) delete slot.loadoutId
  const availableSlots = picker.teammateSlots.filter(slot => slot && slot.teammateId !== agentId
    && characterBuffs.some(buff => teammateOwnerId(buff) === slot.teammateId)
    && teammateImportStatus(sources, slot.teammateId) === 'imported')
  // Choose the owner before materializing shared engine effects and defaults.
  const engines = new Map<string, { owner: string, engine: any }>()
  for (const slot of availableSlots) {
    const engine = sources.history[slot!.teammateId]?.snapshot?.wEngine
    if (!engine || !Number.isInteger(engine.modificationLevel)) continue
    const id = `wEngine:${engine.id}.team`
    if (!engines.has(id) || engine.modificationLevel > engines.get(id)!.engine.modificationLevel) engines.set(id, { owner: slot!.teammateId, engine })
  }
  const values: Record<string, any> = {}
  const owners: Record<string, string> = {}
  const notices: string[] = []
  const put = (owner: string, key: string, baseline: any) => {
    if (key in values) return
    if (previous?.owners[key] && previous.owners[key] !== owner) delete overrides[key]
    if (initializes(owner) && !key.startsWith('runtime:')) delete overrides[key]
    const firstAdoption = !Object.values(previous?.owners ?? {}).includes(owner)
    if (key.startsWith('enabled:') && firstAdoption && !initializes(owner)) overrides[key] = selected.has(key.slice(8))
    values[key] = baseline; owners[key] = owner
  }
  const putBuff = (owner: string, buff: any, snapshot: any, enabled: boolean) => {
    const key = `runtime:${buff.id}`
    const auto = automaticBuff(buff, snapshot)
    put(owner, `enabled:${buff.id}`, enabled)
    const sameOwner = scopeMatches && previous?.owners[key] === owner
    const native = !previous?.owners[key] || sameOwner ? payload.runtimeInputs[buff.id] ?? {} : {}
    const runtime = normalizeRuntimeForBuff(buff, native)
    if (!previous?.owners[key]) {
      // First adoption overwrites imported facts, preserving only scenario inputs.
      const contextual = withoutImportedFields(changedFields(runtime, defaultRuntimeForBuff(buff)), buff.id)
      if (Object.keys(contextual).length) overrides[key] = contextual
    }
    if (initializes(owner) && overrides[key]) overrides[key] = withoutImportedFields(overrides[key], buff.id)
    put(owner, key, normalizeRuntimeForBuff(buff, mergeFields(runtime, auto.imported)))
    return auto
  }
  for (const slot of picker.teammateSlots) {
    if (!slot) continue
    const owner = slot.teammateId
    if (owner === agentId || !characterBuffs.some(buff => teammateOwnerId(buff) === owner)) { notices.push('队友已不在可用目录中，自动效果已清理'); continue }
    const record = sources.history[owner]
    const name = localizedText(characterBuffs.find(buff => teammateOwnerId(buff) === owner)?.ownerName) || '队友'
    if (teammateImportStatus(sources, owner) !== 'imported') { notices.push(`${name}：暂无完整导入资料，仅保留手动设置`); continue }
    const snapshot = record.snapshot ?? {}
    if (operation.kind === 'resync') delete slot.loadoutId
    const cinemaKey = `cinema:${owner}`
    if (initializes(owner)) delete overrides[cinemaKey]
    if (operation.kind === 'cinema' && targetOwner === owner) overrides[cinemaKey] = slot.cinemaLevel
    const cinema = overrides[cinemaKey] ?? snapshot.cinemaLevel
    if (Number.isInteger(cinema) && cinema >= 0 && cinema <= 6) put(owner, cinemaKey, cinema)
    for (const buff of characterBuffs.filter(item => teammateOwnerId(item) === owner)) {
      const level = teammateCinemaLevel(buff)
      const auto = automaticBuff(buff, snapshot)
      const eligible = (auto.selectable || selected.has(buff.id)) && (level === null || (Number.isInteger(cinema) && level <= cinema))
      putBuff(owner, buff, snapshot, eligible)
      if (operation.kind === 'cinema' && targetOwner === owner && level !== null) overrides[`enabled:${buff.id}`] = level <= slot.cinemaLevel
      if (level === null || level <= cinema) notices.push(...auto.notices.map(text => `${name} · ${localizedText(buff.source) || buff.id}：${text}`))
    }
    const engine = snapshot.wEngine
    const engineId = engine ? `wEngine:${engine.id}.team` : ''
    if (engineId === ownEngineBuffId) notices.push(`${name}与当前角色携带相同音擎，团队效果沿用自身音擎配置`)
    else if (engines.get(engineId)?.owner === owner) {
      const key = `engine:${engineId}`
      const level = scopeMatches && previous?.owners[key] === owner && !initializes(owner) ? overrides[key] ?? engine.modificationLevel : engine.modificationLevel
      const buff = teamWEngineBuffCandidates(meta, '', [{ id: engineId, sourceKind: 'wEngineTeam', wEngineModificationLevel: level }]).find(item => item.id === engineId)
      if (buff) {
        byId.set(engineId, buff)
        putBuff(owner, buff, snapshot, automaticBuff(buff, snapshot).selectable)
        put(owner, key, engine.modificationLevel)
        notices.push(`${name}：团队音擎「${engine.name || engine.id}」来源为导入精修 ${engine.modificationLevel}；重复音擎优先较高精修，仅计算一次`)
      }
    } else if (!engine) notices.push(`${name}：音擎缺少有效映射，不自动带入`)
    const counts = new Map<string, number>()
    for (const disc of selectedDiscs(sources, slot, snapshot, notices, name)) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    for (const buff of setBuffs) if ((counts.get(buff.setId) ?? 0) >= 4) {
      if (`enabled:${buff.id}` in values) { notices.push('重复团队效果仅计算一次，四件套采用队友一的配置'); continue }
      const auto = putBuff(owner, buff, snapshot, automaticBuff(buff, snapshot).selectable)
      notices.push(...auto.notices.map(text => `${name}的四件套：${text}`))
    }
  }
  // Clean only adapter-owned fields. Manual choices survive loss of a source.
  for (const [key, owner] of Object.entries(previous?.owners ?? {})) {
    if (key.slice(key.indexOf(':') + 1) === ownEngineBuffId || key in values) continue
    if (scopeMatches && activeOwners.has(owner) && key in overrides) {
      values[key] = key.startsWith('runtime:') ? read(key) : overrides[key]; owners[key] = owner
    } else if (key.startsWith('enabled:')) {
      selected.delete(key.slice(8))
      payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== key.slice(8) || item.sourceKind !== 'wEngineTeam')
    } else if (key.startsWith('runtime:')) delete payload.runtimeInputs[key.slice(8)]
  }
  if (previous?.owners[`engine:${ownEngineBuffId}`]) payload.addedBuffs = payload.addedBuffs.filter((item: any) => item.id !== ownEngineBuffId || item.sourceKind !== 'wEngineTeam')
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
  for (const key of Object.keys(overrides)) if (!(key in owners) || (typeof overrides[key] === 'object' && !Object.keys(overrides[key] ?? {}).length)) delete overrides[key]
  payload.selectedBuffIds = [...selected]
  const applied = Object.fromEntries(Object.keys(values).map(key => [key, read(key)]).filter(([, value]) => value !== undefined))
  if (previous || Object.keys(owners).length) picker.enka = { version: 1, ownerId: sources.ownerId, uid: sources.uid, owners, applied, overrides }
  return { payload, notices: [...new Set(notices)] }
}
