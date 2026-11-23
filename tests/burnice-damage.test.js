import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadCalculatorContext, calculateInCombatPanel } from '../backend/calculator.js'
import { validateMaintenanceItem } from '../core/maintenanceValidation.js'
import { optimizeDriveDiscs } from '../backend/driveDiscOptimizer.js'
import { storedEffectRulesText, defaultRuntimeForBuff } from '../core/shared-combat.js'

// Burnice White: Fire Anomaly. Expected values come from the official HoYoWiki
// entry 840 (revision 1793886424) and the extracted source fixture, never from
// the calculator's own output.

const root = fileURLToPath(new URL('../', import.meta.url))
const catalog = await loadCalculatorContext(root)
const agent = catalog.agentsMap.get('burnice_white')
const skills = catalog.agentSkillsMap.get('burnice_white')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/burnice-source-values.json', import.meta.url)))
const approx = (actual, expected, label = 'value') =>
    assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`)

const afterburnEvent = {
    id: 'afterburn', kind: 'direct', count: 1, stunned: true, critMode: 'expected',
    skillRef: { agentSkillId: 'burnice_white', categoryId: 'core_skill', moveId: 'core_afterburn', rowId: 'damage' },
}
const burnEvent = { id: 'burn', kind: 'anomaly', settlementType: 'attribute', anomalyEffect: 'burn', count: 1, stunned: true, critMode: 'expected' }
const exSingle = { id: 'ex', kind: 'direct', count: 1, stunned: true, critMode: 'expected', skillRef: { agentSkillId: 'burnice_white', categoryId: 'special', moveId: 'ex_scorch_shake', rowId: 'impact_damage' } }
const exDouble = { id: 'ex2', kind: 'direct', count: 1, stunned: true, critMode: 'expected', skillRef: { agentSkillId: 'burnice_white', categoryId: 'special', moveId: 'ex_scorch_shake_double', rowId: 'impact_damage' } }
const basic = { id: 'basic', kind: 'direct', count: 1, stunned: true, critMode: 'expected', skillRef: { agentSkillId: 'burnice_white', categoryId: 'basic', moveId: 'basic_heat_straight', rowId: 'hit_1' } }
const quickAssist = { id: 'assist', kind: 'direct', count: 1, stunned: true, critMode: 'expected', skillRef: { agentSkillId: 'burnice_white', categoryId: 'assist', moveId: 'assist_quick_refresh', rowId: 'damage' } }

function input({ event = afterburnEvent, buffs = [], cinemaLevel = 0, potentialLevel = 0, coreSkillLevel = 'F', drives = [], target = undefined } = {}) {
    return {
        agentId: 'burnice_white', coreSkillLevel, cinemaLevel, potentialLevel,
        wEngineId: 'zzz_wiki_841', wEngineModificationLevel: 1,
        driveDiscs: drives,
        combatBuffs: { activeBuffIds: ['agent:burnice_white.corePassive', 'agent:burnice_white.additionalAbility', ...buffs] },
        damage: {
            mode: 'single', agentLevel: 60,
            skillLevelsByCategory: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12 },
            selectedEventId: event.id, events: [event], ...(target ? { target } : {}),
        },
        settings: { fourPieceSetId: null, twoPieceSetId: null, algorithm: 'exact-super-bound', objective: 'damage', topN: 10 },
    }
}
const calc = options => calculateInCombatPanel(catalog, input(options))
const apDrive = value => [{ id: 'ap', ownerId: 'default', setId: 'none', partition: 4, rarity: 'S', level: 15, maxLevel: 15, mainStat: { stat: 'anomalyProficiency', value }, subStats: [], source: { type: 'test', sequence: 1 } }]
const energyDrive = () => [{ id: 'er', ownerId: 'default', setId: 'none', partition: 6, rarity: 'S', level: 15, maxLevel: 15, mainStat: { stat: 'energyRegen', value: 60 }, subStats: [], source: { type: 'test', sequence: 1 } }]

// Catalog and schema validity.
for (const [kind, item] of [['agents', agent], ['agentSkills', skills]]) {
    assert.deepEqual(validateMaintenanceItem(kind, item, catalog), { ok: true, errors: [] }, kind)
}
const engine = catalog.wEngines.find(item => item.id === 'zzz_wiki_841')
assert.equal(engine.relatedAgentId, 'burnice_white')
assert.deepEqual(validateMaintenanceItem('w-engines', engine, catalog), { ok: true, errors: [] })
const teammate = catalog.teammateCombatBuffGroups.find(group => group.id === 'burnice_white')
assert.equal(teammate.images.icon, agent.images.portrait)
assert.deepEqual(teammate.buffs.map(buff => buff.id), ['burnice.cinema_2_heat_pierce', 'burnice.additional.burn_duration'])
for (const buff of teammate.buffs) {
    assert.deepEqual(validateMaintenanceItem('teammate-buffs', { teammate, buff }, {
        ...catalog, teammates: catalog.teammateCombatBuffGroups, currentBuffId: buff.id,
    }), { ok: true, errors: [] }, buff.id)
}

// Source completeness: every recorded move row matches the extracted official table.
const normalCategories = skills.categories.filter(category => category.id !== 'core_skill' && category.id !== 'cinema')
for (const category of normalCategories) for (const move of category.moves) {
    const sourceTitle = move.name.zhCN.replace('（潜能强化）', '')
    const source = fixture.moves[sourceTitle] ?? fixture.moves[`${sourceTitle}（招式强化）`]
    assert.ok(source, move.name.zhCN)
    for (const row of move.rows) {
        const values = source.rows[row.label.zhCN]
        assert.ok(values, `${move.id}/${row.label.zhCN}`)
        assert.equal(row.values.length, 16)
        for (let level = 0; level < 16; level += 1) assert.equal(row.values[level], values[level], `${move.id}/${row.id}/Lv${level + 1}`)
    }
}
const afterburn = skills.categories.find(category => category.id === 'core_skill').moves[0]
assert.deepEqual(afterburn.rows[0].values, ['1', '2', '3', '4', '5', '6', '7'].map(level => fixture.afterburnPerCoreLevel[level]))

// Panels: official Lv60 stats plus core nodes, then the signature engine's base ATK and 30% ATK.
for (const [index, level] of ['none', 'A', 'B', 'C', 'D', 'E', 'F'].entries()) {
    const result = calc({ coreSkillLevel: level })
    const coreAtk = 25 * Math.floor(index / 2)
    const coreEnergyPct = 10 * Math.ceil(index / 2)
    approx(result.outOfCombat.panel.atk, (788 + coreAtk + 713) * 1.3, `${level} ATK`)
    approx(result.outOfCombat.panel.energyRegen, 1.2 * (1 + coreEnergyPct / 100), `${level} Energy Regen`)
    approx(result.outOfCombat.panel.anomalyMastery, 118, `${level} Mastery`)
    approx(result.outOfCombat.panel.anomalyProficiency, 120, `${level} Proficiency`)
    approx(result.damage.multipliers.skill, fixture.afterburnPerCoreLevel[index + 1] / 100, `${level} Afterburn multiplier`)
}

// Proficiency converts to Afterburn damage: 1% per 10 proficiency, capped at 30%.
for (const [proficiency, expected] of [[99, 9], [100, 10], [119, 11], [120, 12], [299, 29], [300, 30], [400, 30]]) {
    const result = calc({ drives: apDrive(proficiency - 120) })
    approx(result.outOfCombat.panel.anomalyProficiency, proficiency, 'proficiency')
    approx(result.damage.multipliers.directDamageBonus, expected / 100, `afterburn bonus at ${proficiency}`)
}
// The Buff card shows the computed bonus, not the authored expression.
const corePassive = agent.combatBuffs.corePassive
const cardText = storedEffectRulesText(corePassive, defaultRuntimeForBuff(corePassive), catalog, { inCombatPanel: calc({}).inCombat.panel })
assert.match(cardText, /技能目标伤害加成%：提升12%/)
assert.match(cardText, /技能：柏妮思·怀特\/核心被动：余烬\/余烬伤害倍率/)
assert.ok(!cardText.includes("clamp("), cardText)
const cappedCardText = storedEffectRulesText(corePassive, defaultRuntimeForBuff(corePassive), catalog, { inCombatPanel: calc({ drives: apDrive(300) }).inCombat.panel })
assert.match(cappedCardText, /技能目标伤害加成%：提升30%/)

// The proficiency bonus only reaches Afterburn, not the rest of her kit.
approx(calc({ drives: apDrive(180), event: exSingle }).damage.multipliers.directDamageBonus, 0, 'EX excluded from Afterburn bonus')

// Cinema 1: +100 percentage points of Afterburn multiplier.
approx(calc({ cinemaLevel: 1, buffs: ['agent:burnice_white.cinema.1'] }).damage.multipliers.skill, 4.5, 'C1 Afterburn')
// Cinema 2: 5 stacks of 4% PEN.
approx(calc({ cinemaLevel: 2, buffs: ['agent:burnice_white.cinema.2'] }).inCombat.panel.penRatio, 0.2, 'C2 PEN')
// Cinema 4: +30% CRIT Rate for EX Special and Assist Attacks only.
approx(calc({ cinemaLevel: 4, buffs: ['agent:burnice_white.cinema.4'], event: exSingle }).damage.multipliers.critRate, 0.35, 'C4 EX CRIT')
approx(calc({ cinemaLevel: 4, buffs: ['agent:burnice_white.cinema.4'], event: quickAssist }).damage.multipliers.critRate, 0.35, 'C4 Assist CRIT')
approx(calc({ cinemaLevel: 4, buffs: ['agent:burnice_white.cinema.4'], event: basic }).damage.multipliers.critRate, 0.05, 'C4 Basic excluded')
// Cinema 6: 25% Fire RES ignore on the double EX Special and Burn, not the single EX Special.
const resTarget = { resistanceByElement: { fire: 20 } }
approx(calc({ event: exSingle, target: resTarget }).damage.multipliers.resistance, 0.8, 'base Fire RES')
approx(calc({ event: exDouble, target: resTarget, cinemaLevel: 6, buffs: ['agent:burnice_white.cinema.6'] }).damage.multipliers.resistance, 1.05, 'C6 double EX')
approx(calc({ event: exSingle, target: resTarget, cinemaLevel: 6, buffs: ['agent:burnice_white.cinema.6'] }).damage.multipliers.resistance, 0.8, 'C6 single EX excluded')
approx(calc({ event: burnEvent, target: resTarget, cinemaLevel: 6, buffs: ['agent:burnice_white.cinema.6'] }).damage.multipliers.resistance, 1.05, 'C6 Burn')
// Cinema 6 special Afterburn move: fixed 60% multiplier, one level only.
const cinemaMove = skills.categories.find(category => category.id === 'cinema').moves[0]
assert.deepEqual(cinemaMove.rows[0].values, [60])
assert.equal(cinemaMove.skillType, 'cinema')

// Additional ability extends Burn by 3 seconds for attribute Burn, Burn Disorder, and Burn Turbulence.
const burnDisorderEvent = { id: 'burn-disorder', kind: 'disorder', anomalyEffect: 'burn', elapsedSeconds: 0, count: 1, stunned: true }
const burnTurbulenceEvent = { id: 'burn-turbulence', kind: 'anomaly', settlementType: 'turbulence', anomalyEffect: 'burn', elapsedSeconds: 0, count: 1, stunned: true }
const shockDisorderEvent = { id: 'shock-disorder', kind: 'disorder', anomalyEffect: 'shock', elapsedSeconds: 0, count: 1, stunned: true }
const burnOn = calc({ event: burnEvent })
const burnCoreOnly = calculateInCombatPanel(catalog, { ...input({ event: burnEvent }), combatBuffs: { activeBuffIds: ['agent:burnice_white.corePassive'] } })
approx(burnOn.damage.multipliers.durationSeconds, 13, 'Burn duration bonus')
approx(burnOn.damage.multipliers.anomaly - burnCoreOnly.damage.multipliers.anomaly, 3, 'Burn tick bonus')
approx(burnOn.damage.multipliers.baseDurationSeconds, 10)
const burnDisorderOn = calc({ event: burnDisorderEvent })
const burnDisorderOff = calculateInCombatPanel(catalog, { ...input({ event: burnDisorderEvent }), combatBuffs: { activeBuffIds: ['agent:burnice_white.corePassive'] } })
approx(burnDisorderOn.damage.multipliers.remainingSeconds, 13, 'Burn Disorder duration bonus')
approx(burnDisorderOff.damage.multipliers.remainingSeconds, 10, 'Burn Disorder base duration')
const burnTurbulenceOn = calc({ event: burnTurbulenceEvent })
const burnTurbulenceOff = calculateInCombatPanel(catalog, { ...input({ event: burnTurbulenceEvent }), combatBuffs: { activeBuffIds: ['agent:burnice_white.corePassive'] } })
approx(burnTurbulenceOn.damage.multipliers.remainingSeconds, 13, 'Burn Turbulence duration bonus')
approx(burnTurbulenceOff.damage.multipliers.remainingSeconds, 10, 'Burn Turbulence base duration')
const shockDisorderOn = calc({ event: shockDisorderEvent })
approx(shockDisorderOn.damage.multipliers.remainingSeconds, 10, 'Non-Burn Disorder excluded')
// Teammate entry exposes the same +3 seconds to the active agent across attribute, disorder, and turbulence.
const withTeammate = calculateInCombatPanel(catalog, { ...input({ event: burnEvent }), combatBuffs: { activeBuffIds: ['burnice.additional.burn_duration'] } })
approx(withTeammate.damage.multipliers.durationSeconds, 13, 'teammate Burn duration')
const withTeammateDisorder = calculateInCombatPanel(catalog, { ...input({ event: burnDisorderEvent }), combatBuffs: { activeBuffIds: ['burnice.additional.burn_duration'] } })
approx(withTeammateDisorder.damage.multipliers.remainingSeconds, 13, 'teammate Burn Disorder duration')
const withTeammateTurbulence = calculateInCombatPanel(catalog, { ...input({ event: burnTurbulenceEvent }), combatBuffs: { activeBuffIds: ['burnice.additional.burn_duration'] } })
approx(withTeammateTurbulence.damage.multipliers.remainingSeconds, 13, 'teammate Burn Turbulence duration')

// Potential: initial Energy Regen >= 1.8 converts each 0.1 into Mastery and damage.
const potential = level => calc({ potentialLevel: level, drives: energyDrive() })
approx(potential(0).outOfCombat.panel.energyRegen, 2.28, 'potential energy')
approx(potential(0).inCombat.panel.anomalyMastery, 118)
approx(potential(2).inCombat.panel.anomalyMastery, 122, 'P2 Mastery')
approx(potential(4).inCombat.panel.anomalyMastery, 124.4, 'P4 Mastery')
approx(potential(6).inCombat.panel.anomalyMastery, 128, 'P6 Mastery')
approx(potential(2).inCombat.panel.dmgBonus, 0.04, 'P2 damage')
approx(potential(6).inCombat.panel.dmgBonus, 0.08, 'P6 damage')
// Below the threshold the passive gives nothing.
approx(calc({ potentialLevel: 6 }).inCombat.panel.anomalyMastery, 118, 'threshold Mastery')
approx(calc({ potentialLevel: 6 }).inCombat.panel.dmgBonus, 0, 'threshold damage')

// Default configuration: a single Afterburn hit at 0 cinema.
assert.equal(agent.defaultCalculationConfig.mode, 'single')
assert.equal(agent.defaultCalculationConfig.events.length, 1)
assert.deepEqual(agent.defaultCalculationConfig.events[0].skillRef, afterburnEvent.skillRef)
assert.equal(agent.defaultCalculationConfig.selectedEventId, 'burnice_afterburn')
assert.equal(agent.defaultCalculationConfig.cinemaLevel, 0)
assert.equal(agent.potentialVision.defaultLevel, 6)
assert.equal(agent.potentialVision.mechanicUnlockLevel, 1)

// White box reports the same Afterburn skill multiplier and target.
const white = calc({})
assert.ok(Array.isArray(white.damage.whiteBoxRows) && white.damage.whiteBoxRows.length > 0)
approx(white.damage.totalFinalDamage, white.damage.finalDamage * 1, 'single event total')

// Unsupported mechanics stay recorded instead of being approximated.
assert.match(agent.verification.unsupportedMechanics, /灼热抛接法/)
assert.match(agent.verification.unsupportedMechanics, /灼烧/)

// Exact optimizer path: the top build must match a direct panel calculation.
const mains = [null, ['hpFlat', 2200], ['atkFlat', 316], ['defFlat', 184], ['anomalyProficiency', 92], ['fireDmg', 30], ['energyRegen', 60]]
const store = { version: 1, currentOwnerId: 'default', owners: [{ id: 'default', label: 'Synthetic' }], imports: [], driveDiscLoadouts: [], driveDiscs: [] }
for (let slot = 1; slot <= 6; slot += 1) for (let variant = 0; variant < 2; variant += 1) {
    const [stat, value] = slot === 6 && variant ? ['anomalyMastery', 30] : mains[slot]
    store.driveDiscs.push({ id: `d-${slot}-${variant}`, ownerId: 'default', partition: slot, setId: slot <= 4 ? 'chaos_jazz' : 'phaethons_melody',
        rarity: 'S', level: 15, maxLevel: 15, mainStat: { stat, value },
        subStats: [{ stat: 'atkPct', value: 3 + variant * 6 }, { stat: 'anomalyProficiency', value: 9 + variant * 18 }].filter(sub => sub.stat !== stat),
        source: { type: 'test', sequence: slot * 10 + variant } })
}
const optimizeInput = { ...input({ potentialLevel: 6 }), settings: { ...input().settings, fourPieceSetId: 'chaos_jazz', twoPieceSetId: 'phaethons_melody', algorithm: 'exact-super-bound', topN: 3,
    mainStatLimits: { 4: ['anomalyProficiency'], 5: ['fireDmg'], 6: ['energyRegen', 'anomalyMastery'] } } }
const optimized = optimizeDriveDiscs(catalog, store, optimizeInput)
assert.equal(optimized.metrics.strictExact, true)
assert.ok(optimized.results.length >= 3)
const best = optimized.results[0]
const bestPanel = calculateInCombatPanel(catalog, { ...optimizeInput, driveDiscs: best.driveDiscs,
    combatBuffs: { activeBuffIds: [...optimizeInput.combatBuffs.activeBuffIds, 'driveDisc4pc:chaos_jazz.self'] } })
approx(bestPanel.damage.finalDamage, best.score, 'optimizer top score')

console.log('burnice damage tests passed')
