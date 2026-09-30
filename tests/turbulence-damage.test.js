import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInCombatPanelCalculator, loadCalculatorContext, calculateInCombatPanel } from '../backend/calculator.js'
import { cleanStoredReactiveEvent } from '../core/anomalySettlement.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = await loadCalculatorContext(rootDir)
const alice = catalog.agentsMap.get('alice_thymefield')
const frostAgent = catalog.agentsMap.get('hoshimi_miyabi')
assert.equal(cleanStoredReactiveEvent({
  id: 'legacy',
  kind: 'anomaly',
  settlementType: 'turbulence',
  anomalyEffect: 'turbulence',
  secondaryAnomalyEffect: 'burn',
  windSource: { actorRef: { agentId: 'velina' } },
}, alice), null)

assert.equal(catalog.turbulenceEffects.length, 6)
const turbulenceRows = new Map(catalog.turbulenceEffects.map(effect => [effect.id, effect]))
for (const [id, fixed, tick, interval, duration] of [
  ['assault', 8, 0.075, 1, 10],
  ['shatter', 13, 0.075, 1, 10],
  ['burn', 9, 0.5, 0.5, 10],
  ['shock', 6.5, 1.25, 1, 10],
  ['corruption', 6.5, 0.625, 0.5, 10],
  ['frost_frozen', 0, 0.75, 1, 20],
]) {
  const row = turbulenceRows.get(id)
  assert.ok(row, `missing turbulence row ${id}`)
  assert.equal(row.fixedMultiplier, fixed)
  assert.equal(row.tickMultiplier, tick)
  assert.equal(row.tickIntervalSeconds, interval)
  assert.equal(row.defaultDurationSeconds, duration)
  assert.equal(row.sourceStatus, 'confirmed')
}

const customQuarterTurbulence = {
  id: 'custom-quarter-turbulence', settlementType: 'turbulence', element: 'fire',
  fixedMultiplier: 9, tickMultiplier: 0.5, tickIntervalSeconds: 0.25, defaultDurationSeconds: 10,
}
const customCatalog = {
  ...catalog,
  turbulenceEffects: [...catalog.turbulenceEffects, customQuarterTurbulence],
  turbulenceEffectsMap: new Map([...catalog.turbulenceEffects, customQuarterTurbulence].map(effect => [effect.id, effect])),
}

function event(baseAnomalyEffect, overrides = {}) {
  return {
    id: `turbulence-${baseAnomalyEffect}`,
    kind: 'anomaly',
    settlementType: 'turbulence',
    anomalyEffect: baseAnomalyEffect,
    elapsedSeconds: 0,
    count: 1,
    stunned: false,
    ...overrides,
  }
}

function input(agentId, events, activeBuffIds = [], manualEffects = [], target = {}) {
  return {
    agentId,
    coreSkillLevel: 'F',
    wEngineId: catalog.wEngines[0].id,
    wEngineModificationLevel: 1,
    driveDiscs: [],
    combatBuffs: { activeBuffIds, manualEffects },
    damage: {
      agentLevel: 60,
      events,
      selectedEventId: events[0].id,
      target: {
        defense: 0,
        levelCoefficient: 794,
        resistanceByElement: { physical: 0, fire: 0, ice: 0, electric: 0, ether: 0, wind: 0 },
        stunMultiplierPercent: 100,
        ...target,
      },
    },
  }
}

function result(agentId, events, activeBuffIds = [], manualEffects = [], target = {}) {
  return calculateInCombatPanel(catalog, input(agentId, events, activeBuffIds, manualEffects, target))
}

const burn = result(alice.id, [event('burn')])
assert.equal(burn.damage.events[0].input.baseMultiplier, 19)
assert.equal(burn.damage.events[0].input.damageElement, 'fire')
assert.equal(burn.damage.events[0].input.remainingSeconds, 10)
assert.equal(burn.damage.events[0].input.tickCount, 20)

const elapsedBurn = result(alice.id, [event('burn', { elapsedSeconds: 0.6 })])
assert.equal(elapsedBurn.damage.events[0].input.elapsedSeconds, 0.5)
assert.equal(elapsedBurn.damage.events[0].input.baseMultiplier, 18.5)

const customQuarter = calculateInCombatPanel(customCatalog, input(alice.id, [event(customQuarterTurbulence.id, { elapsedSeconds: 0.37 })]))
assert.equal(customQuarter.damage.events[0].input.elapsedSeconds, 0.25)
assert.equal(customQuarter.damage.events[0].input.tickCount, 39)
assert.equal(customQuarter.damage.events[0].input.baseMultiplier, 28.5)

const physical = result(alice.id, [event('assault')])
assert.equal(physical.damage.events[0].input.baseMultiplier, 8.75)
const ice = result(alice.id, [event('shatter')])
assert.equal(ice.damage.events[0].input.baseMultiplier, 13.75)
const shock = result(alice.id, [event('shock')])
assert.equal(shock.damage.events[0].input.baseMultiplier, 19)
const ether = result(alice.id, [event('corruption')])
assert.equal(ether.damage.events[0].input.baseMultiplier, 19)
const frostResult = result(frostAgent.id, [event('frost_frozen')])
assert.equal(frostResult.damage.events[0].input.baseMultiplier, 15)
assert.equal(frostResult.damage.events[0].input.damageElement, 'ice')

// Selecting a shared source ID must still use the settlement's own multiplier table.
for (const [agentId, effectId, turbulenceMultiplier, disorderMultiplier] of [
  ['vivian', 'corruption', 19, 17],
  [frostAgent.id, 'frost_frozen', 15, 21],
]) {
  assert.equal(result(agentId, [event(effectId)]).damage.events[0].input.baseMultiplier, turbulenceMultiplier)
  assert.equal(result(agentId, [event(effectId, { settlementType: 'disorder', disorderType: 'normal' })]).damage.events[0].input.baseMultiplier, disorderMultiplier)
}

assert.throws(
  () => result('velina', [event('burn')]),
  /风属性角色不能配置乱流事件/u,
)
assert.throws(
  () => result('velina', [{ id: 'wind-disorder', kind: 'anomaly', settlementType: 'disorder', anomalyEffect: 'burn', elapsedSeconds: 0 }]),
  /风属性角色不能配置紊乱事件/u,
)

const turbulenceBonus = result(alice.id, [event('burn')], [], [
  {
    id: 'generic-anomaly',
    effects: [{ id: 'generic-anomaly-effect', type: 'fixed', stat: 'anomalyDamageBonus', value: 10, mode: 'flat', target: { kind: 'anomaly', settlementType: 'turbulence' } }],
  },
  {
    id: 'specific-turbulence',
    effects: [{ id: 'specific-turbulence-effect', type: 'fixed', stat: 'turbulenceDamageBonus', value: 20, mode: 'flat', target: { kind: 'anomaly', settlementType: 'turbulence' } }],
  },
])
assert.equal(turbulenceBonus.damage.events[0].multipliers.anomalyDamage, 1.3)
assert.deepEqual(
  turbulenceBonus.damage.events[0].whiteBoxRows.filter(row => ["异常增伤区", "乱流增伤区", "异常增伤合计"].includes(row.label)).map(row => row.label),
  ["异常增伤区", "乱流增伤区", "异常增伤合计"],
)

const windDamageBonus = result(alice.id, [event('burn')], [], [{
  id: 'wind-damage',
  effects: [{ id: 'wind-damage-effect', type: 'fixed', stat: 'windDmg', value: 25, mode: 'flat', target: { kind: 'default' } }],
}])
assert.equal(windDamageBonus.damage.events[0].finalDamage, burn.damage.events[0].finalDamage)

const fireDamageBonus = result(alice.id, [event('burn')], [], [{
  id: 'fire-damage',
  effects: [{ id: 'fire-damage-effect', type: 'fixed', stat: 'fireDmg', value: 25, mode: 'flat', target: { kind: 'default' } }],
}])
assert.equal(fireDamageBonus.damage.events[0].finalDamage / burn.damage.events[0].finalDamage, 1.25)

const velinaBuffs = result(alice.id, [event('burn')], [
  'velina.core.turbulence_f',
  'velina.additional.turbulence',
  'velina.cinema_1.turbulence_res_ignore',
  'velina.cinema_2.turbulence',
], [], { resistanceByElement: { physical: 0, fire: 20, ice: 0, electric: 0, ether: 0, wind: 0 } })
assert.equal(velinaBuffs.damage.events[0].multipliers.turbulenceBaseMultiplierBonus, 1.5)
assert.equal(velinaBuffs.damage.events[0].multipliers.anomaly, 20.5)
assert.equal(velinaBuffs.damage.events[0].multipliers.anomalyDamage, 1.25)
assert.equal(velinaBuffs.damage.events[0].multipliers.resistance, 1)

const calculator = createInCombatPanelCalculator(catalog, input(alice.id, [event('burn')], [
  'velina.core.turbulence_f',
  'velina.additional.turbulence',
]))
const compiled = calculator.scoreOnlyFromSummary(new Map(), new Map())
const legacy = calculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
assert.ok(Math.abs(compiled.finalDamage - legacy.finalDamage) < 1e-9)

console.log('turbulence damage tests passed')
