import { beforeAll, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildMeta, calculateInCombatPanel, loadCalculatorContext } from '../../../backend/calculator.js'
import { recordEnkaTeammateEdit, syncEnkaTeammates, teammateImportStatus, type TeammateSources } from './enkaTeammates'
import { teamWEngineBuffCandidates } from './combatBuffs'

let meta: any
let catalog: any
beforeAll(async () => {
  catalog = await loadCalculatorContext(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
  meta = buildMeta(catalog)
})
const copy = (value: any) => JSON.parse(JSON.stringify(value))
function sources(): TeammateSources {
  const source: TeammateSources = { ownerId: 'test-owner', uid: '123456789', history: {}, configs: {}, loadouts: [], discs: [] }
  for (const id of ['yaojiayin', 'zhao']) {
    source.history[id] = { agentId: id, agentName: id, uid: source.uid, completeness: 'full', snapshot: {
      agentLevel: 60, coreSkillLevel: 6, cinemaLevel: 0, skillLevels: { special: 12 },
      wEngine: id === 'yaojiayin' ? { id: 'zzz_wiki_486', name: '好斗的阿炮', modificationLevel: 5, level: 60 } : null,
      selectedLoadoutId: id,
    } }
    source.discs.push(...[1, 2, 3, 4].map(partition => ({ id: `${id}-${partition}`, partition, setId: 'zzz_wiki_1001' })))
    source.loadouts.push({ id, agentId: id, driveDiscIdsBySlot: Object.fromEntries([1, 2, 3, 4].map(partition => [partition, `${id}-${partition}`])) })
  }
  return source
}
function draft() {
  return { selectedBuffIds: ['field.manual'], addedBuffs: [], runtimeInputs: { 'field.manual': { coverage: 0.5 } },
    buffPickerState: { teammateSlots: [{ teammateId: 'yaojiayin', cinemaLevel: 0 }, { teammateId: 'zhao', cinemaLevel: 0 }] } }
}
const sync = (input: any, source = sources(), reset = false) => syncEnkaTeammates(input, source, meta, 'ye_shunguang',
  { kind: reset || !input.buffPickerState?.enka ? 'resync' : 'refresh' })

describe('Enka teammate configuration using the authored catalog', () => {
  it('marks only the current bound UID history as imported, including teammate-only characters', () => {
    const source = sources()
    expect(teammateImportStatus(source, 'yaojiayin')).toBe('imported')
    expect(teammateImportStatus(source, 'soukaku')).toBe('missing')
    source.history.yaojiayin.completeness = 'partial'
    expect(teammateImportStatus(source, 'yaojiayin')).toBe('partial')
    source.uid = '987654321'
    expect(teammateImportStatus(source, 'yaojiayin')).toBe('missing')
    expect(teammateImportStatus(undefined, 'yaojiayin')).toBe('missing')
  })
  it('uses imported facts and keeps native Buff defaults enabled with a notice for missing attack', () => {
    const { payload, notices } = sync(draft())
    expect(payload.selectedBuffIds).toContain('yaojiayin.special_aria_buff')
    expect(payload.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus.sourceValue).toBe(12)
    expect(payload.selectedBuffIds).toContain('yaojiayin.core_andante_atk')
    expect(notices.some(text => text.includes('耀嘉音初始攻击力') && text.includes('请核对'))).toBe(true)
    expect(payload.addedBuffs).toContainEqual(expect.objectContaining({ id: 'wEngine:zzz_wiki_486.team', wEngineModificationLevel: 5 }))
    expect(payload.selectedBuffIds.filter((id: string) => id === 'teammateDriveDisc4pc:zzz_wiki_1001')).toHaveLength(1)
    expect(notices.some(text => text.includes('重复团队效果'))).toBe(true)
    expect(payload.selectedBuffIds).toContain('field.manual')
    expect(payload.runtimeInputs['field.manual']).toEqual({ coverage: 0.5 })
  })

  it('keeps manual overrides across ordinary import and refresh, and clears them only on explicit resync', () => {
    const first = sync(draft()).payload
    first.buffPickerState.teammateSlots[0].cinemaLevel = 1
    first.selectedBuffIds = first.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.special_aria_buff')
    first.addedBuffs[0].wEngineModificationLevel = 2
    const saved = sync(first).payload
    const updated = sources()
    updated.history.yaojiayin.snapshot.skillLevels.special = 14
    const restored = sync(copy(saved), updated).payload
    expect(restored.buffPickerState.teammateSlots[0].cinemaLevel).toBe(1)
    expect(restored.selectedBuffIds).not.toContain('yaojiayin.special_aria_buff')
    expect(restored.selectedBuffIds).toContain('yaojiayin.cinema_1.enemy_res_reduction')
    expect(restored.addedBuffs[0].wEngineModificationLevel).toBe(2)
    expect(restored.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus.sourceValue).toBe(14)
    const reset = sync(restored, updated, true).payload
    expect(reset.buffPickerState.teammateSlots[0].cinemaLevel).toBe(0)
    expect(reset.selectedBuffIds).toContain('yaojiayin.special_aria_buff')
    expect(reset.selectedBuffIds).not.toContain('yaojiayin.cinema_1.enemy_res_reduction')
    expect(reset.addedBuffs[0].wEngineModificationLevel).toBe(5)
    expect(reset.buffPickerState.enka.overrides).toEqual({})
    expect(sync(copy(reset), updated).payload).toEqual(reset)
  })

  it('preserves manually selected teammates with no import history', () => {
    const source = sources(); source.history = {}
    const input = draft(); input.selectedBuffIds.push('yaojiayin.core_andante_atk')
    const result = sync(input, source, true).payload
    expect(result.buffPickerState.teammateSlots).toEqual(input.buffPickerState.teammateSlots)
    expect(result.selectedBuffIds).toEqual(input.selectedBuffIds)
  })

  it('preserves a manually edited coverage while unedited skill parameters follow the new import', () => {
    const first = sync(draft()).payload
    first.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus.coverage = 0.5
    const saved = sync(first).payload
    const source = sources(); source.history.yaojiayin.snapshot.skillLevels.special = 14
    const result = sync(saved, source).payload.runtimeInputs['yaojiayin.special_aria_buff']
    expect(result.effects.yaojiayin_special_aria_dmg_bonus.coverage).toBe(0.5)
    expect(result.effects.yaojiayin_special_aria_dmg_bonus.sourceValue).toBe(14)
  })

  it('cleans stale automatic effects without removing explicit manual effects', () => {
    const initial = sync(draft()).payload
    initial.selectedBuffIds = initial.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.core_andante_atk')
    const manual = sync(initial).payload
    manual.selectedBuffIds.push('yaojiayin.core_andante_atk')
    const saved = sync(manual).payload
    const source = sources(); delete source.history.yaojiayin
    const result = sync(saved, source).payload
    expect(result.selectedBuffIds).not.toContain('yaojiayin.special_aria_buff')
    expect(result.selectedBuffIds).toContain('yaojiayin.core_andante_atk')
    expect(result.selectedBuffIds).toContain('field.manual')
    expect(result.buffPickerState.teammateSlots[0].teammateId).toBe('yaojiayin')
  })

  it('preserves native attack and coverage edits on first sync and after reopening', () => {
    const input: any = draft()
    input.selectedBuffIds.push('yaojiayin.core_andante_atk')
    input.runtimeInputs['yaojiayin.core_andante_atk'] = {
      effects: { yaojiayin_core_andante_atk_flat: { sourceValue: 2900, coverage: 0.5 } },
    }
    const first = sync(input).payload
    const reopened = sync(copy(first)).payload
    expect(reopened.selectedBuffIds).toContain('yaojiayin.core_andante_atk')
    expect(reopened.runtimeInputs['yaojiayin.core_andante_atk'].effects.yaojiayin_core_andante_atk_flat)
      .toEqual(expect.objectContaining({ sourceValue: 2900, coverage: 0.5 }))
    const cancelled = copy(reopened)
    cancelled.selectedBuffIds = cancelled.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.core_andante_atk')
    expect(sync(sync(cancelled).payload).payload.selectedBuffIds).not.toContain('yaojiayin.core_andante_atk')
  })

  it('restores an old automatically disabled passive without overriding a manual cancellation', () => {
    const old = sync(draft()).payload
    const key = 'enabled:yaojiayin.core_andante_atk'
    old.selectedBuffIds = old.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.core_andante_atk')
    old.buffPickerState.enka.applied[key] = false
    expect(sync(copy(old)).payload.selectedBuffIds).toContain('yaojiayin.core_andante_atk')
    old.buffPickerState.enka.overrides[key] = false
    expect(sync(old).payload.selectedBuffIds).not.toContain('yaojiayin.core_andante_atk')
  })

  it('never uses history from another bound UID or calculator account', () => {
    const first = sync(draft()).payload
    const source = sources(); source.uid = '987654321'
    const result = sync(first, source).payload
    expect(result.selectedBuffIds).toEqual(['field.manual'])
    expect(result.addedBuffs).toEqual([])
  })

  it('does not carry manual automatic-source overrides into another bound UID', () => {
    const first = sync(draft()).payload
    first.runtimeInputs['yaojiayin.core_andante_atk'].effects.yaojiayin_core_andante_atk_flat.sourceValue = 2900
    first.selectedBuffIds = first.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.special_aria_buff')
    const saved = sync(first).payload
    const source = sources(); source.uid = '987654321'
    const result = sync(saved, source).payload
    expect(result.buffPickerState.enka.overrides).toEqual({})
    expect(result.runtimeInputs['yaojiayin.core_andante_atk']).toBeUndefined()
    expect(result.selectedBuffIds).toEqual(['field.manual'])
  })

  it('tracks the selected loadout and drops sets with fewer than four valid distinct slots', () => {
    const first = sync(draft()).payload
    const source = sources()
    source.discs = source.discs.filter(disc => disc.partition !== 4)
    expect(sync(first, source).payload.selectedBuffIds).not.toContain('teammateDriveDisc4pc:zzz_wiki_1001')
    source.configs.yaojiayin = { discMode: 'optimized', selectedLoadoutId: 'yaojiayin' }
    source.history.zhao.snapshot.selectedLoadoutId = null
    expect(sync(draft(), source).payload.selectedBuffIds).not.toContain('teammateDriveDisc4pc:zzz_wiki_1001')
  })

  it('uses the higher imported refinement for the same engine', () => {
    const source = sources()
    source.history.zhao.snapshot.wEngine = { ...source.history.yaojiayin.snapshot.wEngine, modificationLevel: 5 }
    source.history.yaojiayin.snapshot.wEngine.modificationLevel = 1
    const result = sync(draft(), source).payload
    expect(result.addedBuffs.filter((item: any) => item.id === 'wEngine:zzz_wiki_486.team')).toEqual([
      expect.objectContaining({ wEngineModificationLevel: 5 }),
    ])
  })

  it('does not transfer a shared engine override to a different teammate', () => {
    const source = sources()
    source.history.zhao.snapshot.wEngine = { ...source.history.yaojiayin.snapshot.wEngine, modificationLevel: 3 }
    const first = sync(draft(), source).payload
    first.addedBuffs[0].wEngineModificationLevel = 2
    const saved = sync(first, source).payload
    saved.buffPickerState.teammateSlots[0] = null
    const result = sync(saved, source).payload
    expect(result.addedBuffs[0].wEngineModificationLevel).toBe(3)
    expect(result.buffPickerState.enka.owners['engine:wEngine:zzz_wiki_486.team']).toBe('zhao')
    expect(result.buffPickerState.enka.overrides['engine:wEngine:zzz_wiki_486.team']).toBeUndefined()
  })

  it('drops account-specific overrides when the calculator account changes', () => {
    const first = sync(draft()).payload
    first.addedBuffs[0].wEngineModificationLevel = 2
    const saved = sync(first).payload
    const source = sources(); source.ownerId = 'another-owner'
    const result = sync(saved, source).payload
    expect(result.addedBuffs[0].wEngineModificationLevel).toBe(5)
    expect(result.buffPickerState.enka.overrides).toEqual({})
  })

  it('preserves the native own-engine selection and runtime when a teammate has the same engine', () => {
    const input: any = draft()
    const id = 'wEngine:zzz_wiki_486.team'
    input.runtimeInputs[id] = { marker: 'native-own-engine' }
    const result = syncEnkaTeammates(input, sources(), meta, 'ye_shunguang', { kind: 'resync' }, 'zzz_wiki_486')
    expect(result.payload.selectedBuffIds).not.toContain(id)
    expect(result.payload.runtimeInputs[id]).toEqual(input.runtimeInputs[id])
    expect(result.payload.addedBuffs).toEqual([])
    expect(result.notices.some(text => text.includes('沿用自身音擎配置'))).toBe(true)
    const prior = sync(draft()).payload
    const switched = syncEnkaTeammates(prior, sources(), meta, 'ye_shunguang', { kind: 'refresh' }, 'zzz_wiki_486').payload
    expect(switched.selectedBuffIds).toContain(id)
    expect(switched.runtimeInputs[id]).toEqual(prior.runtimeInputs[id])
    expect(switched.addedBuffs).toEqual([])
    expect(switched.buffPickerState.enka.owners[`enabled:${id}`]).toBeUndefined()
  })
})

describe('Enka synchronization operations and calculation regressions', () => {
  it('follows a newly imported engine after adoption instead of treating its missing checkbox as a manual cancellation', () => {
    const first = sync(draft()).payload
    const source = sources()
    const candidate = teamWEngineBuffCandidates(meta).find(buff => buff.id !== 'wEngine:zzz_wiki_486.team')!
    source.history.yaojiayin.snapshot.wEngine = { id: candidate.id.slice(8, -5), name: '新音擎', modificationLevel: 3, level: 60 }
    const result = sync(first, source).payload
    expect(result.selectedBuffIds).toContain(candidate.id)
    expect(result.selectedBuffIds).not.toContain('wEngine:zzz_wiki_486.team')
    expect(result.addedBuffs).toContainEqual(expect.objectContaining({ id: candidate.id, wEngineModificationLevel: 3 }))
  })

  it('imports Remielle special level while preserving her scenario parameters', () => {
    const source = sources()
    source.history = { remielle_dan: { ...source.history.yaojiayin, agentId: 'remielle_dan', snapshot: {
      coreSkillLevel: 6, cinemaLevel: 0, skillLevels: { special: 15 }, wEngine: null,
    } } }
    const input = { selectedBuffIds: [], runtimeInputs: {}, addedBuffs: [],
      buffPickerState: { teammateSlots: [{ teammateId: 'remielle_dan', cinemaLevel: 0 }, null] } }
    const result = syncEnkaTeammates(input, source, meta, 'ye_shunguang', { kind: 'select', slotIndex: 0 }).payload
    expect(result.runtimeInputs['remielle_dan.special.timeflow_hymn'].effects.remielle_dan_special_team_dmg.sourceValue).toBe(15)
  })

  it('adopts imported facts on first refresh while preserving all existing selections and scenario inputs', () => {
    const input: any = draft()
    input.selectedBuffIds.push('yaojiayin.special_aria_buff')
    input.buffPickerState.teammateSlots[0].cinemaLevel = 6
    input.runtimeInputs['yaojiayin.special_aria_buff'] = { effects: { yaojiayin_special_aria_dmg_bonus: { sourceValue: 16, coverage: 0.5 } } }
    input.runtimeInputs['yaojiayin.core_andante_atk'] = { effects: { yaojiayin_core_andante_atk_flat: { sourceValue: 2900, coverage: 0.7 } } }
    const result = syncEnkaTeammates(input, sources(), meta, 'ye_shunguang').payload
    expect(result.selectedBuffIds).toEqual(input.selectedBuffIds)
    expect(result.buffPickerState.teammateSlots[0].cinemaLevel).toBe(0)
    expect(result.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus).toMatchObject({ sourceValue: 12, coverage: 0.5 })
    expect(result.runtimeInputs['yaojiayin.core_andante_atk'].effects.yaojiayin_core_andante_atk_flat).toMatchObject({ sourceValue: 2900, coverage: 0.7 })
    expect(syncEnkaTeammates(result, sources(), meta, 'ye_shunguang').payload).toEqual(result)
  })

  it.each([
    ['rina', 1, 'rina.cinema_1.core_pen_ratio_amplify', 'rina.core_pen_ratio', 'penRatio', 0.39],
    ['qingyi', 2, 'qingyi.cinema_2_subjugation_amplify', 'qingyi.core_subjugation_stun_multiplier', 'stunDmgMultiplierBonus', 1.08],
    ['caesar_king', 2, 'caesar.cinema_2_core_atk_amplify', 'caesar.core_radiant_aegis_atk', 'atkFlat', 1500],
    ['pan_yinhu', 6, 'pan_yinhu.cinema_6_open_meridians_amplify', 'pan_yinhu.core_open_meridians_sheer_force', 'sheerForceFlat', 720],
    ['norma_hollowell', 2, 'norma_hollowell.cinema_2_technical_gap_amplify', 'norma_hollowell.additional_technical_gap', 'stunDmgMultiplierBonus', 0.6],
  ])('selects and calculates %s cinema modifiers', (id, cinema, buffId, targetId, stat, expected) => {
    const source = sources()
    source.history = { [id]: { ...source.history.yaojiayin, agentId: id, agentName: id,
      snapshot: { coreSkillLevel: 6, cinemaLevel: cinema, wEngine: null } } }
    const input = { selectedBuffIds: [targetId], addedBuffs: [], runtimeInputs: {},
      buffPickerState: { teammateSlots: [{ teammateId: id, cinemaLevel: 0 }, null] } }
    const result = syncEnkaTeammates(input, source, meta, 'yixuan', { kind: 'select', slotIndex: 0 }).payload
    expect(result.selectedBuffIds).toContain(buffId)
    const calculation = calculateInCombatPanel(catalog, { ...catalog.examples.yeShunguang.input, agentId: 'yixuan',
      combatBuffs: { activeBuffIds: result.selectedBuffIds, runtimeInputs: result.runtimeInputs } })
    const effect = calculation.inCombat.activeEffects.find((item: any) => item.key === targetId)
    const resolved = [...effect.resolvedStats, ...effect.resolvedDamageModifiers].find((item: any) => item.stat === stat)
    expect(resolved.value).toBeCloseTo(Number(expected), 10)
  })

  it('resync resets facts, selections and loadout but retains attack, coverage and stacks', () => {
    const input: any = sync(draft()).payload
    input.buffPickerState.teammateSlots[0].loadoutId = 'manual-other'
    input.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus = { sourceValue: 16, coverage: 0.4 }
    input.runtimeInputs['yaojiayin.core_andante_atk'].effects.yaojiayin_core_andante_atk_flat.sourceValue = 2900
    input.runtimeInputs['yaojiayin.cinema_1.enemy_res_reduction'].effects.yaojiayin_cinema_1_enemy_res_reduction.stacks = 1
    input.selectedBuffIds = input.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.special_aria_buff')
    const result = sync(input, sources(), true).payload
    expect(result.buffPickerState.teammateSlots[0].loadoutId).toBeUndefined()
    expect(result.selectedBuffIds).toContain('yaojiayin.special_aria_buff')
    expect(result.runtimeInputs['yaojiayin.special_aria_buff'].effects.yaojiayin_special_aria_dmg_bonus).toMatchObject({ sourceValue: 12, coverage: 0.4 })
    expect(result.runtimeInputs['yaojiayin.core_andante_atk'].effects.yaojiayin_core_andante_atk_flat.sourceValue).toBe(2900)
    expect(result.runtimeInputs['yaojiayin.cinema_1.enemy_res_reduction'].effects.yaojiayin_cinema_1_enemy_res_reduction.stacks).toBe(1)
    expect(sync(result).payload).toEqual(result)
  })

  it('cinema shortcuts replace only that slot cinema choices, then allow individual overrides', () => {
    let input: any = sync(draft()).payload
    input.buffPickerState.teammateSlots[0].cinemaLevel = 1
    input = syncEnkaTeammates(input, sources(), meta, 'ye_shunguang', { kind: 'cinema', slotIndex: 0 }).payload
    expect(input.selectedBuffIds).toContain('yaojiayin.cinema_1.enemy_res_reduction')
    input.selectedBuffIds = input.selectedBuffIds.filter((id: string) => id !== 'yaojiayin.cinema_1.enemy_res_reduction')
    input = sync(input).payload
    input.buffPickerState.teammateSlots[0].cinemaLevel = 2
    input = syncEnkaTeammates(input, sources(), meta, 'ye_shunguang', { kind: 'cinema', slotIndex: 0 }).payload
    expect(input.selectedBuffIds).toContain('yaojiayin.cinema_1.enemy_res_reduction')
    input.buffPickerState.teammateSlots[0].cinemaLevel = 0
    input = syncEnkaTeammates(input, sources(), meta, 'ye_shunguang', { kind: 'cinema', slotIndex: 0 }).payload
    expect(input.selectedBuffIds).not.toContain('yaojiayin.cinema_1.enemy_res_reduction')
    input.selectedBuffIds.push('yaojiayin.cinema_1.enemy_res_reduction')
    expect(sync(sync(input).payload).payload.selectedBuffIds).toContain('yaojiayin.cinema_1.enemy_res_reduction')
  })

  it('preserves explicit edits that return to a previous automatic default', () => {
    const input: any = sync(draft()).payload
    const key = 'enabled:yaojiayin.special_aria_buff'
    recordEnkaTeammateEdit(input.buffPickerState, key, false)
    recordEnkaTeammateEdit(input.buffPickerState, key, true)
    const source = sources(); delete source.history.yaojiayin
    expect(sync(input, source).payload.selectedBuffIds).toContain('yaojiayin.special_aria_buff')
  })

  it('uses the import loadout over a different current build and never replaces a missing explicit loadout', () => {
    const source = sources()
    source.configs.yaojiayin = { discMode: 'optimized', selectedLoadoutId: 'unrelated' }
    source.history.zhao.snapshot.selectedLoadoutId = null
    const first = sync(draft(), source).payload
    expect(first.selectedBuffIds).toContain('teammateDriveDisc4pc:zzz_wiki_1001')
    first.buffPickerState.teammateSlots[0].loadoutId = 'deleted-loadout'
    const result = sync(first, source)
    expect(result.payload.selectedBuffIds).not.toContain('teammateDriveDisc4pc:zzz_wiki_1001')
    expect(result.notices.some(text => text.includes('所选驱动盘方案已失效'))).toBe(true)
  })

  it('imports skill values by stable IDs despite changed labels and keeps incomplete snapshots usable', () => {
    const changedMeta = copy(meta)
    const buff = changedMeta.teammateCombatBuffGroups.find((item: any) => item.id === 'yaojiayin').buffs.find((item: any) => item.id === 'yaojiayin.special_aria_buff')
    buff.effects.forEach((effect: any) => { effect.source.label = { zhCN: '任意显示文案' } })
    const source = sources(); source.history.yaojiayin.snapshot.skillLevels.special = 14
    const result = syncEnkaTeammates(draft(), source, changedMeta, 'ye_shunguang', { kind: 'select', slotIndex: 0 }).payload
    expect(result.runtimeInputs[buff.id].effects.yaojiayin_special_aria_dmg_bonus.sourceValue).toBe(14)
    delete source.history.yaojiayin.snapshot.skillLevels
    const incomplete = sync(result, source)
    expect(incomplete.payload.runtimeInputs[buff.id].effects.yaojiayin_special_aria_dmg_bonus.sourceValue).toBe(14)
    expect(incomplete.notices.some(text => text.includes('请核对'))).toBe(true)
  })
})
