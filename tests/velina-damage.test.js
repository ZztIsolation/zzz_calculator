import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    calculateOutOfCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    evaluateAnomalyReleaseProfile,
    evaluateAnomalyReleaseProfileInterval,
    normalizeAnomalyReleaseEventForAgent,
    validateAnomalyReleaseProfile,
} from "../core/anomalyRelease.js"
import { corePassiveScalingRow } from "../core/corePassiveScaling.js"
import { defaultRuntimeForBuff, storedEffectRuleText } from "../core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const agent = catalog.agentsMap.get("velina")

assert.ok(agent, "Velina should be present in the agent catalog")

// Official entry 1960, page version 1789310040, checked 2026-09-29.
// Isolate the agent's level-60 stats from equipment and apply core enhancements once.
const panelCatalog = {
    ...catalog,
    wEnginesMap: new Map(catalog.wEnginesMap).set("velina-panel-test-no-engine", {
        id: "velina-panel-test-no-engine",
        level60: { atkBase: 0 },
    }),
}
function isolatedPanel(coreSkillLevel, driveDiscs = []) {
    return calculateOutOfCombatPanel(panelCatalog, {
        agentId: "velina",
        coreSkillLevel,
        wEngineId: "velina-panel-test-no-engine",
        driveDiscs,
    }).panel
}
for (const [level, atk, anomalyProficiency] of [
    ["none", 797, 111],
    ["A", 797, 129],
    ["B", 822, 129],
    ["C", 822, 147],
    ["D", 847, 147],
    ["E", 847, 165],
    ["F", 872, 165],
]) {
    const panel = isolatedPanel(level)
    assert.equal(panel.atk, atk, `Core ${level}: base ATK enhancements apply once`)
    assert.equal(panel.anomalyProficiency, anomalyProficiency, `Core ${level}: proficiency enhancements apply once`)
    assert.equal(panel.anomalyMastery, 112, `Core ${level}: mastery receives no core stat enhancement`)
    assert.equal(panel.hp, 7788)
    assert.equal(panel.def, 612)
    assert.equal(panel.impact, 86)
    assert.equal(panel.critRate, 0.05)
    assert.equal(panel.critDmg, 0.5)
    assert.equal(panel.penRatio, 0)
    assert.equal(panel.energyRegen, 1.2)
}
const equippedPanel = isolatedPanel("F", [
    { id: "panel-atk", setId: "fanged_metal", partition: 4, mainStat: { stat: "atkPct", value: 30, mode: "pct" }, subStats: [] },
    { id: "panel-mastery", setId: "freedom_blues", partition: 6, mainStat: { stat: "anomalyMastery", value: 30, mode: "pct" }, subStats: [] },
])
assert.equal(equippedPanel.atk, 1133.6)
assert.equal(equippedPanel.anomalyMastery, 145.6)
assert.equal(equippedPanel.anomalyProficiency, 165)

function assertVelinaCinemaOne(candidate) {
    const cinemaOne = candidate.combatBuffs?.cinemaBuffs?.find(buff => buff.cinemaLevel === 1)
    assert.ok(cinemaOne, "Velina C1 must exist")

    // Official C1 increases Daze dealt, not the damage multiplier against stunned enemies.
    // Inspect both effects and modifiers, including nested stat references, regardless of rule ID.
    function rejectStunDamageBonus(value, rulePath) {
        if (typeof value === "string") {
            assert.notEqual(value, "velina-c1-vortex-stun", `${rulePath}: obsolete Velina C1 stun rule must not return`)
            assert.doesNotMatch(value, /\bstunDmgMultiplierBonus(?:Always|CapAlways)?\b/, `${rulePath}: Velina C1 must not add stun damage amplification`)
        } else if (value && typeof value === "object") {
            for (const [key, child] of Object.entries(value)) {
                rejectStunDamageBonus(key, `${rulePath}.${key}`)
                rejectStunDamageBonus(child, `${rulePath}.${key}`)
            }
        }
    }
    rejectStunDamageBonus(cinemaOne.effects, "velina.cinema.1.effects")
    rejectStunDamageBonus(cinemaOne.buffModifiers, "velina.cinema.1.buffModifiers")

    for (const [id, stat, target] of [
        ["velina-c1-turbulence-all-res-ignore", "allResIgnore", { kind: "anomaly", settlementType: "turbulence" }],
        ["velina-c1-wind-corrosion-res-ignore", "windResIgnore", { kind: "anomaly", settlementType: "attribute", anomalyEffects: ["wind_corrosion"] }],
    ]) {
        const effects = cinemaOne.effects?.filter(effect => effect.id === id) ?? []
        assert.equal(effects.length, 1, `${id}: exactly one resistance-ignore rule must exist`)
        const effect = effects[0]
        assert.equal(effect.type, "fixed", `${id}: fixed resistance ignore`)
        assert.equal(effect.stat, stat, `${id}: resistance stat`)
        assert.equal(effect.value, 20, `${id}: resistance ignore must remain 20%`)
        assert.equal(effect.mode, "flat", `${id}: stored percentage points`)
        assert.deepEqual(effect.target, target, `${id}: resistance ignore must retain its settlement target`)
    }
}
assertVelinaCinemaOne(agent)

// Deliberately corrupt cloned catalogs to prove the semantic guard rejects each regression.
const oldStunRule = {
    id: "velina-c1-vortex-stun", type: "fixed", stat: "stunDmgMultiplierBonus", value: 20, mode: "flat",
    target: { kind: "skill", skillTargets: [{ kind: "specific", agentSkillId: "velina", categoryId: "special", skillType: "special", moveId: "windstorm_eye" }] },
}
function rejectsCinemaOneMutation(mutate, message) {
    const candidate = structuredClone(agent)
    const cinemaOne = candidate.combatBuffs.cinemaBuffs.find(buff => buff.cinemaLevel === 1)
    mutate(cinemaOne, candidate)
    assert.throws(() => assertVelinaCinemaOne(candidate), message)
}
rejectsCinemaOneMutation(c1 => c1.effects.push(oldStunRule), /obsolete Velina C1 stun rule/)
for (const stat of ["stunDmgMultiplierBonus", "stunDmgMultiplierBonusAlways", "stunDmgMultiplierBonusCapAlways"]) {
    rejectsCinemaOneMutation(c1 => c1.effects.push({ ...oldStunRule, id: "renamed-stun-rule", stat }), /must not add stun damage amplification/)
    rejectsCinemaOneMutation(c1 => c1.buffModifiers.push({ id: "nested-stun-modifier", target: { stat } }), /must not add stun damage amplification/)
}
for (const id of ["velina-c1-turbulence-all-res-ignore", "velina-c1-wind-corrosion-res-ignore"]) {
    rejectsCinemaOneMutation(c1 => { c1.effects.find(effect => effect.id === id).value = 25 }, /resistance ignore must remain 20%/)
    rejectsCinemaOneMutation(c1 => { c1.effects.find(effect => effect.id === id).target = { kind: "default" } }, /must retain its settlement target/)
    rejectsCinemaOneMutation(c1 => { c1.effects = c1.effects.filter(effect => effect.id !== id) }, /exactly one resistance-ignore rule must exist/)
}
rejectsCinemaOneMutation((c1, candidate) => {
    candidate.combatBuffs.cinemaBuffs = candidate.combatBuffs.cinemaBuffs.filter(buff => buff !== c1)
}, /Velina C1 must exist/)

const corePassive = agent.combatBuffs?.corePassive
assert.ok(corePassive, "Velina should expose her Core Passive")
assert.ok(corePassive.description.zhCN.includes("85/95/105/115/125/135/145%"))
assert.ok(corePassive.description.zhCN.includes("135/155/175/195/215/235/255%"))
const energyDamageRule = corePassive.effects.find(effect => effect.id === "velina-energy-damage-bonus")
const energyMasteryRule = corePassive.effects.find(effect => effect.id === "velina-energy-mastery-bonus")
assert.equal(energyDamageRule?.type, "formula")
assert.equal(energyDamageRule?.source?.kind, "outOfCombatStat")
assert.equal(energyDamageRule?.source?.stat, "energyRegen")
assert.equal(energyDamageRule?.formula?.expression, "clamp(floor(max(x - 1.2, 0) / 0.01) * 0.21, 0, 35)")
assert.equal(energyMasteryRule?.type, "formula")
assert.equal(energyMasteryRule?.source?.kind, "outOfCombatStat")
assert.equal(energyMasteryRule?.formula?.expression, "clamp(floor(max(x - 1.2, 0) / 0.01) * 0.5, 0, 84)")

const levels = ["none", "A", "B", "C", "D", "E", "F"]
const scaling = agent.coreSkill.corePassiveScaling.levels
assert.deepEqual(scaling.map(row => row.microReleaseMultiplierPct), [85, 95, 105, 115, 125, 135, 145])
assert.deepEqual(scaling.map(row => row.broadReleaseMultiplierPct), [135, 155, 175, 195, 215, 235, 255])

const micro = agent.anomalyReleaseProfiles.find(profile => profile.id === "micro_vortex")
const broad = agent.anomalyReleaseProfiles.find(profile => profile.id === "broad_vortex")
const ultimate = agent.anomalyReleaseProfiles.find(profile => profile.id === "ultimate_wind")
assert.ok(micro && broad && ultimate)
assert.equal(broad.default, true)
assert.equal(micro.default, undefined)
assert.deepEqual({ ...agent.defaultCalculationConfig, variants: agent.defaultCalculationConfig.variants ?? [] }, {
    mode: "anomaly",
    name: { zhCN: "单次风化" },
    selectedEventId: "velina-broad-vortex-release",
    cinemaLevel: 0,
    events: [{
        id: "velina-broad-vortex-release",
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "wind_corrosion",
        anomalyVariant: "normal",
        procCount: 1,
        count: 1,
        stunned: true,
    }],
    variants: [],
})
assert.deepEqual(validateAnomalyReleaseProfile(micro), [])
assert.deepEqual(validateAnomalyReleaseProfile(broad), [])
assert.equal(micro.expression.kind, "coreSkillScaling")
assert.equal(micro.expression.field, "microReleaseMultiplierPct")
assert.equal(micro.expression.unit, "percent")
assert.equal(broad.expression.kind, "coreSkillScaling")
assert.equal(broad.expression.field, "broadReleaseMultiplierPct")
assert.equal(broad.expression.unit, "percent")

for (const [index, level] of levels.entries()) {
    const coreScalingRow = corePassiveScalingRow(agent, level)
    const microResult = evaluateAnomalyReleaseProfile(micro, {
        originalBaseMultiplier: 0.625,
        coreScalingRow,
        event: { stunned: false },
        eventElement: "wind",
    })
    const broadResult = evaluateAnomalyReleaseProfile(broad, {
        originalBaseMultiplier: 0.625,
        coreScalingRow,
        event: { stunned: false },
        eventElement: "wind",
    })
    assert.equal(microResult.finalBaseMultiplier, scaling[index].microReleaseMultiplierPct / 100)
    assert.equal(broadResult.finalBaseMultiplier, scaling[index].broadReleaseMultiplierPct / 100)
    const microInterval = evaluateAnomalyReleaseProfileInterval(micro, {
        originalBaseMultiplier: { min: 0.625, max: 0.625 },
        coreScalingRow,
        event: { stunned: false },
        eventElement: "wind",
    })
    assert.deepEqual(microInterval.finalBaseMultiplier, {
        min: scaling[index].microReleaseMultiplierPct / 100,
        max: scaling[index].microReleaseMultiplierPct / 100,
    })
}

assert.equal(ultimate.expression.kind, "constant")
assert.equal(ultimate.expression.value, 6.8)

const normalizedVelinaEvent = normalizeAnomalyReleaseEventForAgent({
    id: "velina-new-release",
    kind: "anomaly",
    settlementType: "release",
    anomalyEffect: "wind_corrosion",
    releaseSource: "micro_vortex",
    triggerActorRef: { agentId: "velina", profileId: "ultimate_wind" },
    anomalySource: { actorRef: { agentId: "velina" } },
}, agent)
assert.equal(normalizedVelinaEvent.releaseSource, "micro_vortex")
assert.equal(normalizedVelinaEvent.anomalyEffect, "wind_corrosion")
assert.equal(normalizedVelinaEvent.triggerActorRef, undefined)
assert.equal(normalizedVelinaEvent.anomalySource, undefined)
const migratedVelinaEvent = normalizeAnomalyReleaseEventForAgent({
    id: "velina-old-release",
    kind: "anomaly",
    settlementType: "release",
    anomalyEffect: "wind_corrosion",
    triggerActorRef: { agentId: "velina", profileId: "ultimate_wind" },
    anomalySource: { actorRef: { agentId: "velina" } },
}, agent)
assert.equal(migratedVelinaEvent.releaseSource, "ultimate_wind")
assert.equal(normalizeAnomalyReleaseEventForAgent({ settlementType: "release" }, agent).releaseSource, "broad_vortex")

function releaseInput(coreSkillLevel, profileId, eventOverrides = {}) {
    const event = {
        id: `velina-${profileId}-${coreSkillLevel}`,
        kind: "anomaly",
        settlementType: "release",
        anomalyEffect: "wind_corrosion",
        count: 1,
        stunned: false,
        ...(profileId ? { releaseSource: profileId } : {}),
        ...eventOverrides,
    }
    return {
        agentId: "velina",
        coreSkillLevel,
        wEngineId: catalog.wEngines[0]?.id,
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [] },
        damage: {
            mode: "custom",
            agentLevel: 60,
            selectedEventId: event.id,
            events: [event],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: { wind: 0 },
            },
        },
    }
}

function calculateRelease(coreSkillLevel, profileId) {
    return calculateInCombatPanel(catalog, releaseInput(coreSkillLevel, profileId))
}

const microInitial = calculateRelease("none", "micro_vortex")
const microMax = calculateRelease("F", "micro_vortex")
const broadInitial = calculateRelease("none", "broad_vortex")
const broadMax = calculateRelease("F", "broad_vortex")
assert.equal(microInitial.damage.events[0].multipliers.anomaly, 0.85)
assert.equal(microMax.damage.events[0].multipliers.anomaly, 1.45)
assert.equal(broadInitial.damage.events[0].multipliers.anomaly, 1.35)
assert.equal(broadMax.damage.events[0].multipliers.anomaly, 2.55)
assert.notEqual(microInitial.damage.totalFinalDamage, microMax.damage.totalFinalDamage)
assert.notEqual(broadInitial.damage.totalFinalDamage, broadMax.damage.totalFinalDamage)

// Check the compact event through all shared score kernels, with two panel candidates.
for (const source of ["micro_vortex", "broad_vortex", "ultimate_wind"]) {
    for (const level of ["none", "F"]) {
        const prepared = createInCombatPanelCalculator(catalog, releaseInput(level, source))
        for (const stats of [new Map(), new Map([["atkPct", 12], ["anomalyProficiency", 36]])]) {
            const compiled = prepared.scoreOnlyFromSummary(stats, new Map())
            const legacy = prepared.scoreOnlyFromSummaryLegacy(stats, new Map())
            const statIds = [...stats.keys()]
            const values = Float64Array.from(stats.values())
            const dense = prepared.compileDensePanelScoreTarget({ statIds, setIds: [], setIndexById: new Map() })
            assert.ok(dense)
            const fixed = dense.compileForSetCounts(new Int16Array())
            assert.equal(fixed.releaseIntervalBound, true)
            for (const score of [compiled.finalDamage, dense.scoreDense(values, new Int16Array()).finalDamage, fixed.scoreScalar(values).finalDamage]) {
                assert.ok(Math.abs(score - legacy.finalDamage) < 1e-7, `${source}/${level} score kernels agree`)
            }
            if (!stats.size) {
                assert.ok(Math.abs(compiled.finalDamage - prepared.calculate([], { round: false }).damage.totalFinalDamage) < 1e-7)
            }
        }
        const oldInput = releaseInput(level, undefined, {
            triggerActorRef: { agentId: "velina", profileId: source },
            anomalySource: { actorRef: { agentId: "velina" } },
        })
        assert.equal(calculateInCombatPanel(catalog, oldInput).damage.totalFinalDamage,
            calculateRelease(level, source).damage.totalFinalDamage)
    }
}
assert.equal(calculateRelease("F").damage.events[0].multipliers.anomaly, 2.55)
assert.equal(calculateRelease("F", "ultimate_wind").damage.events[0].multipliers.anomaly, 6.8)
assert.throws(() => calculateRelease("F", "invalid_source"), /异放来源不存在/)
const conflictingSource = releaseInput("F", "micro_vortex", {
    anomalyEffect: "burn",
    triggerActorRef: { agentId: "aria", profileId: "ultimate_wind" },
    anomalySource: { actorRef: { agentId: "aria" }, snapshot: { invalid: true } },
})
assert.equal(calculateInCombatPanel(catalog, conflictingSource).damage.totalFinalDamage, microMax.damage.totalFinalDamage)

function calculateEnergyPassive({
    wEngineId = "demara_battery_mark_ii",
    driveDiscs = [],
    manualStats = [],
    active = true,
} = {}) {
    const event = {
        id: "velina-energy-passive",
        kind: "anomaly",
        settlementType: "attribute",
        anomalyEffect: "wind_corrosion",
        count: 1,
        stunned: false,
    }
    return calculateInCombatPanel(catalog, {
        agentId: "velina",
        coreSkillLevel: "F",
        wEngineId,
        wEngineModificationLevel: 1,
        driveDiscs,
        combatBuffs: {
            activeBuffIds: active ? ["agent:velina.corePassive"] : [],
            manualStats,
        },
        damage: {
            events: [event],
            selectedEventId: event.id,
            target: { defense: 0, resistanceByElement: { wind: 0 } },
        },
    })
}

const baseEnergyPassive = calculateEnergyPassive()
assert.equal(baseEnergyPassive.outOfCombat.panel.energyRegen, 1.2)
assert.equal(baseEnergyPassive.inCombat.panel.anomalyMastery, 112)
assert.equal(baseEnergyPassive.inCombat.panel.dmgBonus, 0)

const signatureEnergyPassive = calculateEnergyPassive({ wEngineId: "zzz_wiki_2030" })
assert.equal(signatureEnergyPassive.outOfCombat.panel.energyRegen, 1.92)
assert.equal(signatureEnergyPassive.inCombat.panel.anomalyMastery, 148)
assert.equal(signatureEnergyPassive.inCombat.panel.dmgBonus, 0.1512)
const signatureEnergyEffect = signatureEnergyPassive.inCombat.activeEffects
    .find(effect => effect.key === "agent:velina.corePassive")
assert.equal(signatureEnergyEffect.resolvedStats.find(stat => stat.id === "velina-energy-damage-bonus")?.formulaValue, 15.12)
assert.equal(signatureEnergyEffect.resolvedStats.find(stat => stat.id === "velina-energy-mastery-bonus")?.formulaValue, 36)
const energyText = storedEffectRuleText(
    energyDamageRule,
    defaultRuntimeForBuff(corePassive),
    corePassive,
    { agents: [], agentSkills: [] },
    { outOfCombatPanel: signatureEnergyPassive.outOfCombat.panel },
)
assert.equal(energyText, "通用伤害加成%+15.12%")
assert.equal(
    storedEffectRuleText(
        energyMasteryRule,
        defaultRuntimeForBuff(corePassive),
        corePassive,
        { agents: [], agentSkills: [] },
        { outOfCombatPanel: signatureEnergyPassive.outOfCombat.panel },
    ),
    "异常掌控+36",
)
assert.equal(
    storedEffectRuleText(
        { ...energyDamageRule, label: { zhCN: "维琳娜能量增伤" } },
        defaultRuntimeForBuff(corePassive),
        corePassive,
        { agents: [], agentSkills: [] },
        { outOfCombatPanel: signatureEnergyPassive.outOfCombat.panel },
    ),
    "维琳娜能量增伤+15.12%",
)

const oneStepEnergyPassive = calculateEnergyPassive({
    driveDiscs: [{
        id: "energy-step",
        setId: "fanged_metal",
        partition: 6,
        mainStat: { stat: "energyRegen", value: 1, mode: "pct" },
        subStats: [],
    }],
})
assert.equal(oneStepEnergyPassive.outOfCombat.panel.energyRegen, 1.212)
assert.equal(oneStepEnergyPassive.inCombat.panel.anomalyMastery, 112.5)
assert.equal(oneStepEnergyPassive.inCombat.panel.dmgBonus, 0.0021)

const cappedEnergyPassive = calculateEnergyPassive({
    driveDiscs: [{
        id: "energy-cap",
        setId: "fanged_metal",
        partition: 6,
        mainStat: { stat: "energyRegen", value: 150, mode: "pct" },
        subStats: [],
    }],
})
assert.equal(cappedEnergyPassive.outOfCombat.panel.energyRegen, 3)
assert.equal(cappedEnergyPassive.inCombat.panel.anomalyMastery, 196)
assert.equal(cappedEnergyPassive.inCombat.panel.dmgBonus, 0.35)

const combatEnergyOnly = calculateEnergyPassive({
    wEngineId: "zzz_wiki_2030",
    manualStats: [{ stat: "energyRegen", value: 100, mode: "pct" }],
})
assert.equal(combatEnergyOnly.outOfCombat.panel.energyRegen, 1.92)
assert.equal(combatEnergyOnly.inCombat.panel.energyRegen, 3.84)
assert.equal(combatEnergyOnly.inCombat.panel.anomalyMastery, 148)
assert.equal(combatEnergyOnly.inCombat.panel.dmgBonus, 0.1512)

const energyCalculator = createInCombatPanelCalculator(catalog, {
    agentId: "velina",
    coreSkillLevel: "F",
    wEngineId: "zzz_wiki_2030",
    wEngineModificationLevel: 1,
    driveDiscs: [],
    combatBuffs: { activeBuffIds: ["agent:velina.corePassive"] },
    damage: {
        events: [{ id: "score", kind: "anomaly", settlementType: "attribute", anomalyEffect: "wind_corrosion" }],
        selectedEventId: "score",
        target: { defense: 0, resistanceByElement: { wind: 0 } },
    },
})
const energyMetadata = energyCalculator.optimizerStatMetadata()
assert.ok(energyMetadata.relevantStatIds.includes("energyRegen"))
const energyCompiled = energyCalculator.scoreOnlyFromSummary(new Map(), new Map())
const energyLegacy = energyCalculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
assert.equal(energyCompiled.panel.anomalyMastery, energyLegacy.panel.anomalyMastery)
assert.equal(energyCompiled.panel.dmgBonus, energyLegacy.panel.dmgBonus)

console.log("Velina anomaly release tests passed")
