import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadCalculatorContext, calculateInCombatPanel, createInCombatPanelCalculator } from '../backend/calculator.js'
import { cleanMaintenanceItem } from '../backend/server.js'
import { validateMaintenanceItem } from '../core/maintenanceValidation.js'
import { normalizeAnomalyReleaseEventForAgent, evaluateReleaseExpression, anomalyReleaseProfiles } from '../core/anomalyRelease.js'
import { resolveDamageEventMultiplier } from '../core/damageEventMultipliers.js'
import { optimizeDriveDiscs, optimizeDriveDiscsAsync } from '../backend/driveDiscOptimizer.js'
import { createDriveDiscOptimizerRuntime } from '../core/driveDiscOptimizer-core.js'
import { fioniOptimizerInput, fioniOptimizerStore } from './fixtures/fioni-optimizer.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const catalog = await loadCalculatorContext(root)
const agent = catalog.agentsMap.get('fioni'), skills = catalog.agentSkillsMap.get('fioni')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/fioni-source-values.json', import.meta.url)))
const approx = (a,b,label='value') => assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)), `${label}: ${a} != ${b}`)
const base = fioniOptimizerInput()
const event = base.damage.events[0]
function input(overrides={}) {return {...structuredClone(base),...overrides,damage:{...structuredClone(base.damage),...(overrides.damage??{})},combatBuffs:{...structuredClone(base.combatBuffs),...(overrides.combatBuffs??{})}}}
function calc(overrides={}) {return calculateInCombatPanel(catalog,input(overrides))}
const critAt = (mastery,core='F',extra={}) => calc({coreSkillLevel:core,driveDiscs:[{setId:'none',mainStat:{stat:'anomalyMasteryFlat',value:mastery-(core==='none'?116:116+12*Math.ceil(('ABCDEF'.indexOf(core)+1)/2))}}],...extra})
for (const [kind,item] of [['agents',agent],['agentSkills',skills]]) assert.deepEqual(validateMaintenanceItem(kind,item,catalog),{ok:true,errors:[]})
assert.deepEqual(catalog.teammateCombatBuffGroups.find(a=>a.id==='fioni').buffs.map(b=>b.id),['fioni.core.sear','fioni.additional.sear_crit_dmg','fioni.cinema_1.sear_crit_dmg'])
assert.equal(agent.defaultCalculationConfig.events.length,1)
assert.equal(agent.defaultCalculationConfig.events[0].anomalyEffect,'burn')
// Source numbers are independently extracted from the pinned official HTML cells.
for (const category of skills.categories.filter(c=>c.id!=='core_skill')) for (const move of category.moves) {
 const source=fixture.officialSkillTabs.flatMap(t=>t.children).find(c=>c.title===move.name.zhCN)
 assert.ok(source,move.name.zhCN)
 for(let i=0;i<16;i++) {
  const text=source.growth[i].children.flatMap(g=>g.row.flat()).join(' ').replace(/<[^>]*>/g,' ')
  for(const row of move.rows) {
   const label=row.label.zhCN
   const match=text.match(new RegExp(label+'[：:]\\s*([\\d.]+)'))
   assert.ok(match,`${move.id}/${label}/${i+1}`)
   assert.equal(row.values[i],Number(match[1]))
  }
 }
}
for (const [i,level] of ['none','A','B','C','D','E','F'].entries()) {
 const r=calc({coreSkillLevel:level})
 approx(r.outOfCombat.baseBreakdown.agent.atk+r.outOfCombat.baseBreakdown.coreSkill.atk,797+25*Math.floor(i/2))
 approx(r.outOfCombat.panel.anomalyMastery,116+12*Math.ceil(i/2))
 approx(r.inCombat.panel.anomalyProficiency-r.outOfCombat.panel.anomalyProficiency,43+i*7)
 approx(r.damage.multipliers.anomalyCritDmg,(12.5+12.5*i/6+15+40)/100)
 const tick=calc({coreSkillLevel:level,damage:{events:[{id:'tick',kind:'direct',skillRef:{agentSkillId:'fioni',categoryId:'core_skill',moveId:'core_sear_tick',rowId:'damage'}}]}})
 approx(tick.damage.multipliers.skill,(25+25*i/6)/100)
}
for(const mastery of [154,155,155.5,200,254.9,255,256]) {
 const r=critAt(mastery)
 approx(r.damage.multipliers.anomalyCritRate,Math.min(1,.3+Math.max(0,mastery-155)*.007),'Sear threshold')
}
const normal=critAt(200),out=normal.outOfCombat.panel,panel=normal.inCombat.panel
// Independent damage oracle: fixed skill multiplier; do NOT multiply the burn unit .5 again.
const expected=panel.atk*4.45*(794/(794+953))*1.5*(panel.anomalyProficiency/100)*2*(1+.615*.8)
approx(normal.damage.finalDamage,expected,'independent Abloom damage')
const combatOnly=critAt(200,'F',{combatBuffs:{manualStats:[{stat:'anomalyMasteryFlat',value:100}]}})
approx(combatOnly.damage.multipliers.anomalyCritRate,.615,'combat mastery excluded')
for(const [profile,category,values] of [['fioni_purifying_flame_release','basic',[225,445,525]],['fioni_soul_searching_blaze_release','chain',[300,597,705]]]) {
 for(const [i,level] of [1,12,16].entries()) {
  const e={...event,triggerActorRef:{agentId:'fioni',profileId:profile},releaseSkillRef:{...agent.anomalyReleaseProfiles[0].releaseSkillRef,level:1}}
  const r=calc({damage:{skillLevelsByCategory:{[category]:level},events:[e]}})
  approx(r.damage.multipliers.anomaly,values[i]/100)
  approx(resolveDamageEventMultiplier(e,catalog,{agent,skillLevelsByCategory:{[category]:level}}),values[i]/100,'editor multiplier')
 }
}
for(const effect of ['burn','assault','shatter','shock','corruption','wind_corrosion']) {
 const r=calc({damage:{events:[{...event,anomalyEffect:effect}]}})
 approx(r.damage.multipliers.anomaly,4.45,'fixed across original anomaly')
}
const attr={id:'attribute',kind:'anomaly',settlementType:'attribute',anomalyEffect:'burn',stunned:true}
const disorder={...attr,id:'disorder',settlementType:'disorder',elapsedSeconds:0}
const direct={id:'direct',kind:'direct',damageElement:'fire',skillMultiplier:100}
const buffs=base.combatBuffs.activeBuffIds
approx(calc({damage:{events:[attr]}}).damage.multipliers.anomalyCritDmg,.4)
approx(calc({damage:{events:[disorder]}}).damage.multipliers.anomalyCrit??1,1)
const off=calc({combatBuffs:{activeBuffIds:[]}})
approx(off.damage.multipliers.anomalyCrit,1)
const addOff=calc({combatBuffs:{activeBuffIds:[buffs[0],buffs[2]]}})
approx(addOff.damage.multipliers.anomalyCritDmg,.65)
const releaseBuffOff=calc({combatBuffs:{activeBuffIds:[buffs[0],buffs[1]]}})
approx(releaseBuffOff.damage.multipliers.anomalyCritDmg,.4,'Fioni main Release without the dedicated Buff')
const c1=calc({cinemaLevel:1,combatBuffs:{activeBuffIds:[...buffs,'agent:fioni.cinema.1']}})
approx(c1.damage.multipliers.anomalyCritDmg,1.05)
const c2Opts={cinemaLevel:2,combatBuffs:{activeBuffIds:[...buffs,'agent:fioni.cinema.2']}}
approx(calc(c2Opts).damage.multipliers.dmg,1.3)
approx(calc({...c2Opts,damage:{events:[attr]}}).damage.multipliers.anomaly,12)
approx(calc({...c2Opts,damage:{events:[disorder]}}).damage.multipliers.anomaly,16.5)
approx(calc({...c2Opts,damage:{events:[{...attr,anomalyEffect:'shock'}]}}).damage.multipliers.anomaly,12.5)
// A stale release-only field on an ordinary anomaly event must stay inert.
const staleAttribute=calc({damage:{events:[{...attr,releaseAnomalyCritDmgBonus:9}]}})
approx(staleAttribute.damage.multipliers.anomalyCritDmg,calc({damage:{events:[attr]}}).damage.multipliers.anomalyCritDmg)
const c4event={...event,triggerActorRef:{agentId:'fioni',profileId:'fioni_c4_extra_release'}}
assert.throws(()=>calc({damage:{events:[c4event]}}))
const c4=calc({cinemaLevel:4,damage:{events:[c4event]}})
approx(c4.damage.multipliers.anomaly,6);approx(c4.damage.multipliers.anomalyCritDmg,.4)
assert.equal(anomalyReleaseProfiles(agent,0).length,2);assert.equal(anomalyReleaseProfiles(agent,4).length,3)
const clean=normalizeAnomalyReleaseEventForAgent({...c4event,releaseSkillRef:agent.anomalyReleaseProfiles[0].releaseSkillRef},agent,{cinemaLevel:4})
assert.equal(clean.releaseSkillRef,undefined)
const c6Opts={cinemaLevel:6,combatBuffs:{activeBuffIds:[...buffs,'agent:fioni.cinema.6']}}
approx(calc(c6Opts).damage.targetBreakdown.enemyDefReduction,.4)
approx(calc(c6Opts).damage.targetBreakdown.resIgnore,.15)
approx(calc({...c6Opts,damage:{events:[direct]}}).damage.targetBreakdown.enemyDefReduction,0)
assert.throws(()=>evaluateReleaseExpression({kind:'skillMultiplier',unit:'percent'},{}))
// Maintenance sanitizer roundtrip preserves binding and rules.
const cleaned=cleanMaintenanceItem('agents',structuredClone(agent),catalog)
assert.deepEqual(cleaned.defaultCalculationConfig.events[0].releaseSkillRef,agent.defaultCalculationConfig.events[0].releaseSkillRef)
assert.deepEqual(cleaned.anomalyReleaseProfiles,agent.anomalyReleaseProfiles)
assert.deepEqual(validateMaintenanceItem('agents',cleaned,catalog),{ok:true,errors:[]})
// Candidate-dependent CRIT is recalculated in all scoring paths; unsupported bounds use safe fallback.
const statIds=['atkPct','anomalyProficiency','anomalyMastery','fireDmg','penRatio']
for(const events of [[event],[attr],[disorder],[direct],[event,attr,disorder,direct]]) for(const mastery of [0,30,68,100]) for(const mode of ['expected','crit','nonCrit']) {
 const payload=input({damage:{events:events.map(e=>({...e,critMode:mode}))}}), p=createInCombatPanelCalculator(catalog,payload)
 const values=[30,70,mastery,30,12],summary=new Map(statIds.map((s,i)=>[s,values[i]])),sets=new Map()
 const discs=statIds.map((stat,i)=>({setId:'none',mainStat:{stat,value:values[i]}}))
 const truth=calculateInCombatPanel(catalog,{...payload,driveDiscs:discs}).damage.totalFinalDamage
 approx(p.calculate(discs).damage.totalFinalDamage,truth,'prepared')
 approx(p.scoreOnlyFromSummaryLegacy(summary,sets).finalDamage,truth,'legacy')
 approx(p.scoreOnlyFromSummary(summary,sets).finalDamage,truth,'compiled')
 approx(p.scoreOnlyFromIndexedSummary(values,statIds,[],[],sets).finalDamage,truth,'indexed')
 const dense=p.compileDensePanelScoreTarget({statIds,setIds:[],setIndexById:sets});assert.ok(dense)
 approx(dense.scoreDense(values,[]).finalDamage,truth,'dense')
 const fixed=dense.compileForSetCounts([]);approx(fixed.scoreScalar(values).finalDamage,truth,'fixed')
 const hasRelease=events.some(e=>(e.settlementType??'')==='release')
 assert.equal(fixed.releaseIntervalBound,hasRelease,'release interval bound must match release events')
 if(hasRelease){
  assert.equal(fixed.scoreKernel,'compiled-objective-fixed-sets','release objective kernel')
  assert.equal(typeof fixed.scoreObjectiveScalar,'function','release objective scalar')
  approx(fixed.scoreObjectiveScalar(values).finalDamage,truth,'objective scalar')
  approx(fixed.scoreCombinedScalar(values).finalDamage,truth,'combined scalar')
 }
 assert.ok(p.optimizerStatMetadata().relevantStatIds.includes('anomalyMastery'))
}
// Independent exhaustive Cartesian oracle, including attack/mastery main-stat tradeoff.
const store=fioniOptimizerStore(),request=fioniOptimizerInput(),buckets=Array.from({length:6},(_,i)=>store.driveDiscs.filter(d=>d.partition===i+1)),oracle=[]
function enumerate(discs){if(discs.length===6){oracle.push({ids:discs.map(d=>d.id),score:calculateInCombatPanel(catalog,{...request,driveDiscs:discs}).damage.totalFinalDamage});return}for(const d of buckets[discs.length])enumerate([...discs,d])}
enumerate([]);oracle.sort((a,b)=>b.score-a.score||a.ids.join('|').localeCompare(b.ids.join('|')))
function check(result){assert.equal(result.results.length,10);result.results.forEach((r,i)=>{assert.deepEqual(Object.values(r.driveDiscIdsBySlot),oracle[i].ids);approx(r.score,oracle[i].score,'Top 10')})}
check(optimizeDriveDiscs(catalog,store,request))
check(await createDriveDiscOptimizerRuntime().optimizeDriveDiscsAsync(catalog,store,request))
check(await optimizeDriveDiscsAsync(catalog,store,{...request,settings:{...request.settings,algorithm:'exact-super-bound-parallel',workerCount:2}}))
// Larger dual-set inventory: pruning must be restored and stay strictly exact.
function topSignature(result){return result.results.map(r=>({ids:Object.values(r.driveDiscIdsBySlot),score:Number(r.score.toFixed(6))}))}
function assertSameTop(label,legacy,superBound){
 assert.deepEqual(topSignature(superBound),topSignature(legacy),`${label}: Top 10 ids/scores`)
 const estimated=Number(superBound.metrics.estimatedCombinationCount??0)
 assert.ok(estimated>0,`${label}: estimated combinations`)
 assert.equal(superBound.metrics.strictExact,true,`${label}: strict exact`)
 assert.ok(Number(superBound.metrics.superBoundChecks??0)>0,`${label}: interval bound checks`)
 assert.ok(Number(superBound.metrics.prunedBySuperBound??0)>0,`${label}: pruning`)
 assert.ok(Number(superBound.metrics.scoredCombinationCount??0)<estimated,`${label}: scored fewer than exhaustive`)
 assert.equal(Number(superBound.metrics.scoredCombinationCount??0)+Number(superBound.metrics.prunedBySuperBound??0),estimated,`${label}: scored+pruned accounting`)
 assert.equal(superBound.metrics.releaseIntervalBoundEnabled,true,`${label}: interval bound enabled metric`)
 assert.equal(superBound.metrics.releaseBoundFallbackReason,null,`${label}: no interval bound fallback`)
}
const pruneStore=fioniOptimizerStore({variants:3,dualSets:true}),pruneRequest=fioniOptimizerInput()
const pruneLegacy=optimizeDriveDiscs(catalog,pruneStore,{...pruneRequest,settings:{...pruneRequest.settings,algorithm:'exact-legacy',enableUpperBoundPruning:false}})
const pruneSuperBound=optimizeDriveDiscs(catalog,pruneStore,pruneRequest)
assert.equal(pruneSuperBound.metrics.estimatedCombinationCount,10935,'10935 fixture: legal combination count')
assertSameTop('fioni 10935',pruneLegacy,pruneSuperBound)
const pruneWinner=pruneSuperBound.results[0]
approx(pruneWinner.score,calculateInCombatPanel(catalog,{...pruneRequest,driveDiscs:pruneWinner.driveDiscs}).damage.totalFinalDamage,'10935 winner score')
// Minimum-panel checks keep the objective-scalar kernel disabled; the fixed scoreScalar bound must still prune exactly.
const minimumStore=fioniOptimizerStore({variants:2,dualSets:true}),minimumRequest=fioniOptimizerInput()
const minimumSettings={...minimumRequest.settings,minimums:{anomalyMastery:120}}
const minimumLegacy=optimizeDriveDiscs(catalog,minimumStore,{...minimumRequest,settings:{...minimumSettings,algorithm:'exact-legacy',enableUpperBoundPruning:false}})
const minimumSuperBound=optimizeDriveDiscs(catalog,minimumStore,{...minimumRequest,settings:minimumSettings})
assert.ok(minimumSuperBound.results.length>0,'minimum panel: results')
assert.equal(minimumSuperBound.metrics.strictExact,true,'minimum panel: strict exact')
assert.equal(Number(minimumSuperBound.metrics.scoredCombinationCount??0)+Number(minimumSuperBound.metrics.prunedBySuperBound??0),Number(minimumSuperBound.metrics.estimatedCombinationCount??0),'minimum panel: accounting')
assert.ok(Number(minimumSuperBound.metrics.superBoundChecks??0)>0,'minimum panel: bound checks')
assert.deepEqual(topSignature(minimumSuperBound),topSignature(minimumLegacy),'minimum panel: Top 10 ids/scores')
console.log('Fioni: pinned official rows, independent formulas, thresholds, Cinema isolation, maintenance, all scoring paths and exhaustive/Node Worker Top 10 passed')
