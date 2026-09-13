import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { validateMaintenanceItem } from "../core/maintenanceValidation.js"
import {
    defaultRuntimeForBuff,
    normalizeRuntimeForBuff,
} from "../core/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const input = catalog.examples.yeShunguang.input

const expectedTeammateProfiles = {
    burnice_white: ["fire", "anomaly"],
    caesar_king: ["physical", "defense"],
    jane_doe: ["physical", "anomaly"],
    juhufu: ["fire", "stun"],
    koleda: ["fire", "stun"],
    lighter: ["fire", "stun"],
    liuyin: ["physical", "stun"],
    lucia_elowen: ["ether", "support"],
    lucy: ["fire", "support"],
    lycaon: ["ice", "stun"],
    nangongyu: ["ether", "stun"],
    nicole: ["ether", "support"],
    norma_hollowell: ["fire", "stun"],
    orphie_magusa: ["fire", "attack"],
    pan_yinhu: ["physical", "defense"],
    qianxia: ["physical", "support"],
    qingyi: ["electric", "stun"],
    remielle_dan: ["lumiflux", "anomaly"],
    rina: ["electric", "support"],
    seed: ["electric", "attack"],
    soukaku: ["ice", "support"],
    trigger: ["electric", "stun"],
    tsukishiro_yanagi: ["electric", "anomaly"],
    xixifu: ["electric", "attack"],
    yaojiayin: ["ether", "support"],
    youye: ["physical", "support"],
    zhao: ["ice", "defense"],
}
const actualTeammateProfiles = Object.fromEntries(
    catalog.teammateCombatBuffGroups
        .map(group => [group.id, [group.attribute, group.specialty]])
        .sort(([left], [right]) => left.localeCompare(right)),
)
assert.deepEqual(actualTeammateProfiles, expectedTeammateProfiles, "Official Wiki teammate attributes and specialties should stay complete")

function countTeammateProfile(index) {
    return Object.values(expectedTeammateProfiles).reduce((counts, profile) => {
        counts[profile[index]] = (counts[profile[index]] ?? 0) + 1
        return counts
    }, {})
}

assert.deepEqual(countTeammateProfile(0), { electric: 6, ether: 4, fire: 7, ice: 3, lumiflux: 1, physical: 6 })
assert.deepEqual(countTeammateProfile(1), { anomaly: 4, attack: 3, defense: 3, stun: 9, support: 8 })

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function cloneCatalog(value) {
    const next = clone(value)
    delete next.agentsMap
    delete next.wEnginesMap
    delete next.driveDiscSetsMap
    return next
}

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

const formulaCatalog = cloneCatalog(catalog)
formulaCatalog.combatBuffs.push({
    id: "test.formula.dmg_bonus",
    sourceType: "teammate",
    scope: "inCombat",
    effects: [
        {
            id: "hp_to_dmg",
            type: "formula",
            stat: "dmgBonus",
            mode: "flat",
            source: {
                variable: "x",
                label: {
                    zhCN: "照的初始最大生命值",
                },
                defaultValue: 27000,
                min: 15000,
                max: 27000,
            },
            formula: {
                expression: "clamp(floor((x - 15000) / 400) + 10, 10, 40)",
                valueUnit: "storedPercent",
            },
        },
    ],
})

function calculateWithSourceValue(sourceValue) {
    return calculateInCombatPanel(formulaCatalog, {
        ...input,
        combatBuffs: {
            activeBuffIds: ["test.formula.dmg_bonus"],
            runtimeInputs: {
                "test.formula.dmg_bonus": {
                    effects: {
                        hp_to_dmg: {
                            sourceValue,
                        },
                    },
                },
            },
        },
    })
}

const cases = [
    [15000, 0.1],
    [15399, 0.1],
    [15400, 0.11],
    [27000, 0.4],
    [31000, 0.4],
]

for (const [sourceValue, expectedDmgBonus] of cases) {
    const result = calculateWithSourceValue(sourceValue)
    approx(
        result.inCombat.panel.dmgBonus - result.outOfCombat.panel.dmgBonus,
        expectedDmgBonus,
        `formula sourceValue=${sourceValue}`,
    )
}

const cappedResult = calculateWithSourceValue(31000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].rawSourceValue, 31000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].sourceValue, 27000)
assert.equal(cappedResult.inCombat.activeEffects[0].resolvedStats[0].value, 0.4)

const juhufuCoreBuffId = "juhufu.core_tiger_roar_crit_dmg"
const juhufuCoreEffectId = "juhufu_core_tiger_roar_crit_dmg"
const juhufuCoreBuff = catalog.combatBuffs.find(buff => buff.id === juhufuCoreBuffId)
const juhufuCoreCritDmgEffect = juhufuCoreBuff?.effects.find(effect => effect.id === juhufuCoreEffectId)
assert.ok(juhufuCoreCritDmgEffect, "Juhufu core crit damage effect should exist")
assert.equal(juhufuCoreCritDmgEffect.type, "formula")
assert.equal(juhufuCoreCritDmgEffect.source?.variable, "x")
assert.equal(juhufuCoreCritDmgEffect.source?.defaultValue, 3400)
assert.equal(juhufuCoreCritDmgEffect.source?.min, 0)
assert.equal(juhufuCoreCritDmgEffect.source?.max, undefined, "Juhufu initial ATK input should accept values above the cap threshold")
assert.equal(juhufuCoreCritDmgEffect.source?.step, 50)
assert.equal(juhufuCoreCritDmgEffect.formula?.expression, "clamp(20 + floor((x - 2800) / 2) / 10, 20, 50)")
assert.equal(juhufuCoreCritDmgEffect.formula?.valueUnit, "storedPercent")

function calculateJuhufuCoreCritDmg(sourceValue) {
    return calculateInCombatPanel(catalog, {
        ...input,
        combatBuffs: {
            activeBuffIds: [juhufuCoreBuffId],
            ...(sourceValue === undefined
                ? {}
                : {
                    runtimeInputs: {
                        [juhufuCoreBuffId]: {
                            effects: {
                                [juhufuCoreEffectId]: {
                                    sourceValue,
                                },
                            },
                        },
                    },
                }),
        },
    })
}

function juhufuCoreResolvedStat(result) {
    return result.inCombat.activeEffects
        .find(effect => effect.key === juhufuCoreBuffId)
        ?.resolvedStats.find(stat => stat.id === juhufuCoreEffectId)
}

const juhufuDefault = calculateJuhufuCoreCritDmg()
const juhufuDefaultResolved = juhufuCoreResolvedStat(juhufuDefault)
assert.ok(juhufuDefaultResolved, "Juhufu core should resolve without a saved runtime input")
assert.equal(juhufuDefaultResolved.rawSourceValue, 3400)
assert.equal(juhufuDefaultResolved.sourceValue, 3400)
approx(juhufuDefaultResolved.formulaValue, 50, "Juhufu core default formula value")
approx(juhufuDefaultResolved.value, 0.5, "Juhufu core default resolved crit damage")
approx(
    juhufuDefault.inCombat.panel.critDmg - juhufuDefault.outOfCombat.panel.critDmg,
    0.5,
    "Juhufu core should remain 50% crit damage when old saves omit the runtime input",
)

const juhufuCoreCases = [
    [2799, 20],
    [2800, 20],
    [2850, 22.5],
    [2851, 22.5],
    [2852, 22.6],
    [3399, 49.9],
    [3400, 50],
    [3401, 50],
]

for (const [sourceValue, expectedCritDmgPercent] of juhufuCoreCases) {
    const result = calculateJuhufuCoreCritDmg(sourceValue)
    const activeEffect = result.inCombat.activeEffects.find(effect => effect.key === juhufuCoreBuffId)
    const resolved = juhufuCoreResolvedStat(result)
    assert.ok(activeEffect, `Juhufu core should be active for sourceValue=${sourceValue}`)
    assert.ok(resolved, `Juhufu core should resolve for sourceValue=${sourceValue}`)
    assert.equal(activeEffect.runtime.effects[juhufuCoreEffectId].sourceValue, sourceValue)
    assert.equal(resolved.rawSourceValue, sourceValue)
    assert.equal(resolved.sourceValue, sourceValue)
    approx(resolved.formulaValue, expectedCritDmgPercent, `Juhufu core formula sourceValue=${sourceValue}`)
    approx(resolved.value, expectedCritDmgPercent / 100, `Juhufu core resolved stat sourceValue=${sourceValue}`)
    approx(
        result.inCombat.panel.critDmg - result.outOfCombat.panel.critDmg,
        expectedCritDmgPercent / 100,
        `Juhufu core panel sourceValue=${sourceValue}`,
    )
}

const qianxia = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["buff_j8kf2r9m4q"],
        runtimeInputs: {
            buff_j8kf2r9m4q: {
                effects: {
                    effect_d4n8q2lm: {
                        sourceValue: 3000,
                    },
                },
            },
        },
    },
})
approx(
    qianxia.inCombat.panel.atk - qianxia.outOfCombat.panel.atk,
    900,
    "Existing derived ratio Buff should keep using sourceValue * ratio / 100",
)

const rinaGroup = catalog.teammateCombatBuffGroups.find(group => group.id === "rina")
assert.ok(rinaGroup, "Rina teammate Buff group should exist")
assert.equal(rinaGroup.images?.icon, "/assets/agents/rina.png")
const rinaPotentialBuffs = rinaGroup.buffs.filter(buff => buff.id === "rina.potential.perfect_service")
assert.equal(rinaPotentialBuffs.length, 1, "Rina potential teammate Buffs should be one combined Buff")
const rinaPotentialBuff = rinaPotentialBuffs[0]
assert.deepEqual(rinaPotentialBuff.runtimeParameters, [{
    id: "potentialLevel",
    label: { zhCN: "潜能觉醒等级" },
    kind: "enum",
    values: ["P2", "P3", "P4", "P5", "P6"],
    defaultValue: "P6",
}])
const rinaScaling = {
    2: { atk: 216, def: 180, atkRatio: 300, defRatio: 250 },
    3: { atk: 302.4, def: 252, atkRatio: 420, defRatio: 350 },
    4: { atk: 396, def: 324, atkRatio: 550, defRatio: 450 },
    5: { atk: 482.4, def: 396, atkRatio: 670, defRatio: 550 },
    6: { atk: 576, def: 468, atkRatio: 800, defRatio: 650 },
}
for (const level of [2, 3, 4, 5, 6]) {
    const levelKey = `P${level}`
    const matchingEffects = rinaPotentialBuff.effects.filter(effect => effect.requirement?.runtimeParameter?.oneOf?.includes(levelKey))
    assert.equal(matchingEffects.length, 2)
    assert.deepEqual(matchingEffects.map(effect => effect.stat), ["atkFlat", "defFlat"])
    for (const effect of matchingEffects) {
        assert.equal(effect.type, "derived")
        assert.equal(effect.sourceLabel.zhCN, "丽娜自身穿透率")
        assert.equal(effect.defaultSourceValue, 72)
        assert.deepEqual(effect.coverage, { default: 1, min: 0, max: 1, step: 0.1 })
    }
    assert.deepEqual(
        matchingEffects.map(effect => ({ stat: effect.stat, ratio: effect.ratio, cap: effect.cap })),
        [
            { stat: "atkFlat", ratio: rinaScaling[level].atkRatio, cap: 576 },
            { stat: "defFlat", ratio: rinaScaling[level].defRatio, cap: 468 },
        ],
    )

    const defaultResult = calculateInCombatPanel(catalog, {
        ...input,
        combatBuffs: {
            activeBuffIds: [rinaPotentialBuff.id],
            runtimeInputs: { [rinaPotentialBuff.id]: { parameters: { potentialLevel: levelKey } } },
        },
    })
    approx(defaultResult.inCombat.panel.atk - defaultResult.outOfCombat.panel.atk, rinaScaling[level].atk,
        `Rina P${level} default ATK conversion`)
    approx(defaultResult.inCombat.panel.def - defaultResult.outOfCombat.panel.def, rinaScaling[level].def,
        `Rina P${level} default DEF conversion`)
    assert.equal(defaultResult.inCombat.panel.penRatio, defaultResult.outOfCombat.panel.penRatio,
        `Rina P${level} should not add PEN Ratio to the current agent`)
    assert.deepEqual(
        defaultResult.inCombat.activeEffects[0].resolvedStats.map(stat => stat.stat),
        ["atkFlat", "defFlat"],
        `Rina P${level} should only provide ATK and DEF flat Buffs`,
    )
}

const rinaDefaultRuntime = defaultRuntimeForBuff(rinaPotentialBuff)
assert.equal(rinaDefaultRuntime.parameters.potentialLevel, "P6")
assert.equal(rinaDefaultRuntime.effects.rina_potential_atk_p2.sourceValue, 72)
assert.equal(rinaDefaultRuntime.effects.rina_potential_def_p6.sourceValue, 72)
const rinaP2Runtime = {
    rina_potential_atk_p2: { sourceValue: 10 },
    rina_potential_def_p2: { sourceValue: 10 },
}
const rinaNormalizedRuntime = normalizeRuntimeForBuff(rinaPotentialBuff, {
    parameters: { potentialLevel: "P2" },
    effects: { rina_potential_atk_p2: { sourceValue: 10 } },
})
assert.equal(rinaNormalizedRuntime.parameters.potentialLevel, "P2")
assert.equal(rinaNormalizedRuntime.effects.rina_potential_atk_p2.sourceValue, 10)
assert.equal(rinaNormalizedRuntime.effects.rina_potential_def_p2.sourceValue, 10)
const rinaLowSource = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: [rinaPotentialBuff.id],
        runtimeInputs: {
            [rinaPotentialBuff.id]: { parameters: { potentialLevel: "P2" }, effects: rinaP2Runtime },
        },
    },
})
approx(rinaLowSource.inCombat.panel.atk - rinaLowSource.outOfCombat.panel.atk, 30,
    "Rina P2 should use the saved external PEN snapshot for ATK")
approx(rinaLowSource.inCombat.panel.def - rinaLowSource.outOfCombat.panel.def, 25,
    "Rina P2 should use the saved external PEN snapshot for DEF")
assert.equal(rinaLowSource.inCombat.activeEffects[0].runtime.parameters.potentialLevel, "P2")
assert.equal(rinaLowSource.inCombat.activeEffects[0].runtime.effects.rina_potential_atk_p2.sourceValue, 10)
assert.equal(rinaLowSource.inCombat.activeEffects[0].runtime.effects.rina_potential_def_p2.sourceValue, 10)
const rinaCappedSource = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: [rinaPotentialBuff.id],
        runtimeInputs: {
            [rinaPotentialBuff.id]: {
                parameters: { potentialLevel: "P2" },
                effects: {
                    rina_potential_atk_p2: { sourceValue: 300 },
                    rina_potential_def_p2: { sourceValue: 300 },
                },
            },
        },
    },
})
approx(rinaCappedSource.inCombat.panel.atk - rinaCappedSource.outOfCombat.panel.atk, 576,
    "Rina P2 ATK conversion should honor its cap")
approx(rinaCappedSource.inCombat.panel.def - rinaCappedSource.outOfCombat.panel.def, 468,
    "Rina P2 DEF conversion should honor its cap")

const koledaGroup = catalog.teammateCombatBuffGroups.find(group => group.id === "koleda")
assert.ok(koledaGroup, "Koleda teammate Buff group should exist")
assert.equal(koledaGroup.attribute, "fire")
assert.equal(koledaGroup.specialty, "stun")
assert.equal(koledaGroup.images?.icon, "/assets/agents/koleda.png")
assert.deepEqual(
    koledaGroup.buffs.map(buff => buff.id),
    [
        "koleda.additional_ability.chain_damage",
        "koleda.enhanced_basic.team_damage",
        "koleda.potential.demolition_operation",
    ],
    "Koleda teammate Buffs should stay in authored order",
)
const koledaAdditional = koledaGroup.buffs[0]
assert.equal(koledaAdditional.effects[0].target.skillTargets[0].skillType, "chain")
assert.equal(koledaAdditional.effects[0].stat, "dmgBonus")
assert.equal(koledaAdditional.effects[0].valuePerStack, 35)
assert.equal(koledaAdditional.effects[0].maxStacks, 2)
assert.equal(koledaAdditional.effects[0].defaultStacks, 2)
assert.equal(koledaAdditional.effects[0].requirement.eventStunned, true)
const koledaEnhancedBasic = koledaGroup.buffs[1]
assert.equal(koledaEnhancedBasic.effects[0].stat, "dmgBonus")
assert.equal(koledaEnhancedBasic.effects[0].value, 35)
assert.equal(koledaEnhancedBasic.effects[0].durationSeconds, 40)
const koledaPotential = koledaGroup.buffs[2]
assert.deepEqual(koledaPotential.runtimeParameters, [{
    id: "potentialLevel",
    label: { zhCN: "潜能觉醒等级" },
    kind: "enum",
    values: ["P2", "P3", "P4", "P5", "P6"],
    defaultValue: "P6",
}])

function koledaRuntime(buff, runtime = {}) {
    return { [buff.id]: runtime }
}

function koledaAriaResult(activeBuffIds, damage, runtimeInputs = {}) {
    return calculateInCombatPanel(catalog, {
        agentId: "aria",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_1883",
        driveDiscs: [],
        combatBuffs: { activeBuffIds, runtimeInputs },
        damage,
    })
}

const koledaChainDamage = {
    selectedEventId: "koleda-chain",
    events: [{
        id: "koleda-chain",
        kind: "direct",
        stunned: true,
        skillRef: {
            agentSkillId: "aria",
            categoryId: "chain",
            moveId: "chain_dream_collaboration",
            rowId: "damage",
        },
    }],
    target: { defense: 953, levelCoefficient: 794, resistanceByElement: { ether: 0 } },
}
const koledaChainBase = koledaAriaResult([], koledaChainDamage)
for (const stacks of [0, 1, 2]) {
    const result = koledaAriaResult(
        [koledaAdditional.id],
        koledaChainDamage,
        koledaRuntime(koledaAdditional, { effects: { koleda_additional_chain_damage: { stacks } } }),
    )
    approx(
        result.damage.events[0].multipliers.dmg / koledaChainBase.damage.events[0].multipliers.dmg,
        1 + stacks * 0.35,
        `Koleda chain Buff should apply ${stacks} stacks only`,
    )
}
const koledaUnstunnedChain = koledaAriaResult([koledaAdditional.id], {
    ...koledaChainDamage,
    events: [{ ...koledaChainDamage.events[0], stunned: false }],
})
approx(
    koledaUnstunnedChain.damage.events[0].multipliers.dmg,
    koledaChainBase.damage.events[0].multipliers.dmg,
    "Koleda chain Buff should not affect an unstunned event",
)
const koledaBasicDamage = {
    selectedEventId: "koleda-basic",
    events: [{
        id: "koleda-basic",
        kind: "direct",
        stunned: true,
        skillRef: {
            agentSkillId: "aria",
            categoryId: "basic",
            moveId: "absolute_pitch",
            rowId: "charge_3_damage",
        },
    }],
    target: { defense: 953, levelCoefficient: 794, resistanceByElement: { ether: 0 } },
}
const koledaBasicBase = koledaAriaResult([], koledaBasicDamage)
const koledaBasicWithChainBuff = koledaAriaResult([koledaAdditional.id], koledaBasicDamage)
approx(
    koledaBasicWithChainBuff.damage.events[0].multipliers.dmg,
    koledaBasicBase.damage.events[0].multipliers.dmg,
    "Koleda chain Buff should not affect basic attacks",
)
const koledaTeamDamage = koledaAriaResult([koledaEnhancedBasic.id], koledaBasicDamage)
approx(
    koledaTeamDamage.inCombat.panel.dmgBonus - koledaTeamDamage.outOfCombat.panel.dmgBonus,
    0.35,
    "Koleda enhanced basic Buff should add 35% team damage",
)
assert.equal(koledaEnhancedBasic.effects[0].durationSeconds, 40)

const koledaPotentialValues = {
    P2: { sharp: 4, crit: 11 },
    P3: { sharp: 6, crit: 17 },
    P4: { sharp: 8, crit: 23 },
    P5: { sharp: 10, crit: 29 },
    P6: { sharp: 12, crit: 35 },
}
for (const [potentialLevel, values] of Object.entries(koledaPotentialValues)) {
    const runtimeInputs = koledaRuntime(koledaPotential, { parameters: { potentialLevel } })
    const nonArmorer = calculateInCombatPanel(catalog, {
        agentId: "aria",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_1883",
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [koledaPotential.id], runtimeInputs },
        damage: koledaBasicDamage,
    })
    approx(
        nonArmorer.inCombat.panel.critDmg - nonArmorer.outOfCombat.panel.critDmg,
        values.crit / 100,
        `Koleda ${potentialLevel} should grant non-Armorer crit damage`,
    )
    assert.equal(
        nonArmorer.inCombat.activeEffects[0].resolvedStats.some(stat => stat.stat === "sharpDmgBonus"),
        false,
        `Koleda ${potentialLevel} should not grant non-Armorer sharp damage`,
    )

    const armorer = calculateInCombatPanel(catalog, {
        agentId: "claret",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_2189",
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [koledaPotential.id], runtimeInputs },
    })
    const sharpModifier = armorer.inCombat.activeEffects[0].resolvedDamageModifiers
        .find(modifier => modifier.kind === "sharpDmgBonus")
    approx(sharpModifier?.value, values.sharp / 100,
        `Koleda ${potentialLevel} should grant Armorer sharp damage`)
    assert.equal(
        armorer.inCombat.activeEffects[0].resolvedStats.some(stat => stat.stat === "critDmg"),
        false,
        `Koleda ${potentialLevel} should not grant Armorer crit damage`,
    )
}

const luciaGroup = catalog.teammateCombatBuffGroups.find(group => group.id === "lucia_elowen")
assert.ok(luciaGroup, "Lucia teammate Buff group should exist")
assert.equal(luciaGroup.buffs.length, 5)
assert.deepEqual(
    luciaGroup.buffs
        .find(buff => buff.id === "lucia_elowen.cinema_1_dream_song_res_ignore")
        ?.effects.map(effect => effect.stat)
        .sort(),
    ["allResIgnore"],
    "Lucia cinema 1 should use one all-attribute resistance-ignore rule",
)

const ruptureInput = {
    ...input,
    agentId: "yixuan",
    coreSkillLevel: "F",
    wEngineId: "zzz_wiki_1342",
    wEngineModificationLevel: 1,
}

function calculateLuciaSheerForce(sourceValue) {
    return calculateInCombatPanel(catalog, {
        ...ruptureInput,
        combatBuffs: {
            activeBuffIds: ["lucia_elowen.ex_special_darkbreaker_sheer_force"],
            runtimeInputs: {
                "lucia_elowen.ex_special_darkbreaker_sheer_force": {
                    effects: {
                        lucia_elowen_ex_special_sheer_force: {
                            sourceValue,
                        },
                    },
                },
            },
        },
    })
}

approx(
    calculateLuciaSheerForce(12000).inCombat.panel.sheerForceFlat,
    456,
    "Lucia level 12 EX Special should scale from initial max HP",
)
approx(
    calculateLuciaSheerForce(30000).inCombat.panel.sheerForceFlat,
    900,
    "Lucia level 12 EX Special should clamp source HP and cap sheer force",
)

const panBase = calculateInCombatPanel(catalog, {
    ...ruptureInput,
    combatBuffs: {
        activeBuffIds: ["pan_yinhu.core_open_meridians_sheer_force"],
        runtimeInputs: {
            "pan_yinhu.core_open_meridians_sheer_force": {
                effects: {
                    pan_yinhu_core_sheer_force: {
                        sourceValue: 2000,
                    },
                },
            },
        },
    },
})
approx(panBase.inCombat.panel.sheerForceFlat, 360, "Pan Yinhu F-level core should grant 18% initial ATK as sheer force")

const panCinemaSix = calculateInCombatPanel(catalog, {
    ...ruptureInput,
    combatBuffs: {
        activeBuffIds: [
            "pan_yinhu.core_open_meridians_sheer_force",
            "pan_yinhu.cinema_6_open_meridians_amplify",
        ],
        runtimeInputs: {
            "pan_yinhu.core_open_meridians_sheer_force": {
                effects: {
                    pan_yinhu_core_sheer_force: {
                        sourceValue: 2000,
                    },
                },
            },
        },
    },
})
approx(panCinemaSix.inCombat.panel.sheerForceFlat, 480, "Pan Yinhu cinema 6 should raise the core ratio from 18% to 24%")

const panStupefaction = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: [
            "pan_yinhu.additional_stupefaction_dmg",
            "pan_yinhu.cinema_1_stupefaction_dmg",
        ],
    },
})
approx(
    panStupefaction.inCombat.panel.dmgBonus - panStupefaction.outOfCombat.panel.dmgBonus,
    0.3,
    "Pan Yinhu Stupefaction should be a 20% + 10% general damage bonus",
)

const normaGroup = catalog.teammateCombatBuffGroups.find(group => group.id === "norma_hollowell")
assert.ok(normaGroup, "Norma teammate Buff group should exist")
assert.equal(normaGroup.attribute, "fire")
assert.equal(normaGroup.specialty, "stun")
assert.equal(normaGroup.images?.icon, "/assets/agents/norma_hollowell.png")
assert.deepEqual(
    normaGroup.buffs.map(buff => buff.id),
    [
        "norma_hollowell.additional_technical_gap",
        "norma_hollowell.additional_bangboo_barrage",
        "norma_hollowell.cinema_1_aggressive_foresight",
        "norma_hollowell.cinema_2_technical_gap_amplify",
    ],
    "Norma teammate Buffs should stay split by trigger window and authored order",
)
const normaTeammate = { ...normaGroup }
delete normaTeammate.buffs
for (const buff of normaGroup.buffs) {
    const validation = validateMaintenanceItem("teammate-buffs", {
        teammate: normaTeammate,
        buff,
    }, {
        teammates: catalog.teammateCombatBuffGroups,
        currentBuffId: buff.id,
        agentSkills: catalog.agentSkills ?? [],
    })
    assert.deepEqual(validation.errors, [], `${buff.id} should be accepted by teammate Buff maintenance`)
}

const normaEvent = {
    id: "norma-buff-test",
    kind: "direct",
    damageElement: "fire",
    skillMultiplier: 100,
    critMode: "nonCrit",
    stunned: true,
}

function calculateNormaBuffs(activeBuffIds) {
    return calculateInCombatPanel(catalog, {
        ...input,
        combatBuffs: { activeBuffIds },
        damage: {
            agentLevel: 60,
            selectedEventId: normaEvent.id,
            events: [normaEvent],
            target: {
                defense: 953,
                levelCoefficient: 794,
                stunMultiplierPercent: 150,
                resistanceByElement: {
                    physical: 0,
                    fire: 0,
                    ice: 0,
                    electric: 0,
                    ether: 0,
                },
            },
        },
    })
}

const normaTechnicalGap = calculateNormaBuffs(["norma_hollowell.additional_technical_gap"])
approx(normaTechnicalGap.damage.multipliers.stun, 1.8, "Norma Technical Gap should default to 10 stacks for 30% stun vulnerability")

const normaCinemaTwoOnly = calculateNormaBuffs(["norma_hollowell.cinema_2_technical_gap_amplify"])
approx(normaCinemaTwoOnly.damage.multipliers.stun, 1.5, "Norma cinema 2 should not create Technical Gap by itself")

const normaAllBuffs = calculateNormaBuffs(normaGroup.buffs.map(buff => buff.id))
approx(normaAllBuffs.damage.multipliers.stun, 2.1, "Norma cinema 2 should raise Technical Gap from 3% to 6% per stack")
approx(normaAllBuffs.damage.multipliers.dmg, 1.2, "Norma Bangboo Barrage should grant 20% team damage")
approx(normaAllBuffs.damage.multipliers.resistance, 1.15, "Norma cinema 1 should reduce all-attribute resistance by 15%")

console.log("formula tests passed")
