import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const input = catalog.examples.yeShunguang.input

const expectedTeammateProfiles = {
    burnice_white: ["fire", "anomaly"],
    caesar_king: ["physical", "defense"],
    jane_doe: ["physical", "anomaly"],
    juhufu: ["fire", "stun"],
    lighter: ["fire", "stun"],
    liuyin: ["physical", "stun"],
    lucia_elowen: ["ether", "support"],
    lucy: ["fire", "support"],
    lycaon: ["ice", "stun"],
    nangongyu: ["ether", "stun"],
    nicole: ["ether", "support"],
    orphie_magusa: ["fire", "attack"],
    pan_yinhu: ["physical", "defense"],
    qianxia: ["physical", "support"],
    qingyi: ["electric", "stun"],
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

assert.deepEqual(countTeammateProfile(0), { electric: 6, ether: 4, fire: 5, ice: 3, physical: 6 })
assert.deepEqual(countTeammateProfile(1), { anomaly: 3, attack: 3, defense: 3, stun: 7, support: 8 })

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

console.log("formula tests passed")
