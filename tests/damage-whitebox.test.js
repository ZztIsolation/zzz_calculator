import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input
const meta = buildMeta(catalog)
assert.ok(meta.agentSkills.some(item => item.id === "ye_shunguang"), "Meta should expose agent skill catalogs")

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

function minimalInput(overrides = {}) {
    return {
        agentId: exampleInput.agentId,
        wEngineId: exampleInput.wEngineId,
        driveDiscs: [],
        ...overrides,
    }
}

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

const exampleResult = calculateInCombatPanel(catalog, exampleInput)
assert.deepEqual(
    exampleResult.outOfCombat.ignoredEffects,
    [],
    "Out-of-combat ignored effects should not include in-combat-only W-Engine or Drive Disc 4-piece Buffs",
)

const normalBoss = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            presetId: "normal-boss",
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(
    normalBoss.damage.multipliers.defense,
    794 / (794 + 953),
    "Normal Boss defense multiplier should match 794 / (794 + 953)",
)
assert.equal(normalBoss.damage.multipliers.resistance, 1)

for (const [level, expectedPercent] of [
    [1, 79.4],
    [12, 159.8],
    [16, 189.1],
]) {
    const skillResult = calculateInCombatPanel(catalog, minimalInput({
        damage: {
            skillMultiplier: 1,
            skillRef: {
                agentSkillId: "ye_shunguang",
                categoryId: "basic",
                moveId: "quick_sword",
                rowId: "hit_1",
                level,
            },
            target: {
                defense: 953,
                levelCoefficient: 794,
            },
        },
    }))
    approx(skillResult.damage.input.skillMultiplier, expectedPercent / 100, `Skill ref LV${level} multiplier`)
    assert.match(
        skillResult.damage.whiteBoxRows.find(row => row.label === "技能倍率")?.formula ?? "",
        new RegExp(`LV${level}$`),
    )
}

assert.throws(
    () => calculateInCombatPanel(catalog, minimalInput({
        damage: {
            skillRef: {
                agentSkillId: "ye_shunguang",
                categoryId: "basic",
                moveId: "quick_sword",
                rowId: "missing",
                level: 1,
            },
        },
    })),
    /Unknown skill multiplier row/,
)

const physicalResisted = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 20,
            },
        },
    },
}))
approx(physicalResisted.damage.multipliers.resistance, 0.8, "20% physical RES should be a 0.8 multiplier")
approx(
    physicalResisted.damage.finalDamage,
    normalBoss.damage.finalDamage * 0.8,
    "20% physical RES should scale final damage",
)

const physicalWeakness = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: -20,
            },
        },
    },
}))
approx(physicalWeakness.damage.multipliers.resistance, 1.2, "-20% physical RES should be a 1.2 multiplier")

for (const [presetId, defense] of [
    ["taichu-nightmare", 476],
    ["wandering-hunter", 1588],
]) {
    const result = calculateInCombatPanel(catalog, minimalInput({
        damage: {
            target: {
                presetId,
                defense,
                levelCoefficient: 794,
            },
        },
    }))
    approx(
        result.damage.multipliers.defense,
        794 / (794 + defense),
        `${presetId} defense preset should use expected defense`,
    )
}

const comboCatalog = cloneCatalog(catalog)
comboCatalog.combatBuffs.push({
    id: "test.damage.defense_combo",
    sourceType: "boss",
    scope: "inCombat",
    effects: [
        {
            id: "def_reduction",
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
        },
        {
            id: "flat_def_reduction",
            type: "fixed",
            stat: "enemyDefFlatReduction",
            value: 10,
            mode: "flat",
        },
        {
            id: "pen_ratio",
            type: "fixed",
            stat: "penRatio",
            value: 10,
            mode: "flat",
        },
        {
            id: "pen_flat",
            type: "fixed",
            stat: "penFlat",
            value: 20,
            mode: "flat",
        },
    ],
})
const combo = calculateInCombatPanel(comboCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.defense_combo"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
const reducedDefense = 953 * (1 - 0.2) - 10
const effectiveDefense = reducedDefense * (1 - 0.1) - 20
approx(combo.damage.targetBreakdown.targetDefenseAfterReduction, reducedDefense, "Reduced defense")
approx(combo.damage.targetBreakdown.effectiveDefense, effectiveDefense, "Effective defense")
approx(combo.damage.multipliers.defense, 794 / (794 + effectiveDefense), "Combined defense multiplier")

const resistanceCatalog = cloneCatalog(catalog)
resistanceCatalog.combatBuffs.push({
    id: "test.damage.resistance_combo",
    sourceType: "boss",
    scope: "inCombat",
    effects: [
        {
            id: "current_res_reduction",
            type: "fixed",
            stat: "enemyResReduction",
            value: 10,
            mode: "flat",
        },
        {
            id: "physical_res_reduction",
            type: "fixed",
            stat: "enemyPhysicalResReduction",
            value: 5,
            mode: "flat",
        },
    ],
})
const withoutResistanceDebuff = calculateInCombatPanel(resistanceCatalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 20,
            },
        },
    },
}))
const withResistanceDebuff = calculateInCombatPanel(resistanceCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.resistance_combo"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 20,
            },
        },
    },
}))
assert.deepEqual(withResistanceDebuff.inCombat.panel, withoutResistanceDebuff.inCombat.panel)
approx(withResistanceDebuff.damage.targetBreakdown.effectiveResistance, 0.05, "Resistance reduction should lower effective resistance")
approx(withResistanceDebuff.damage.multipliers.resistance, 0.95, "Resistance reductions should increase resistance multiplier")

const resIgnoreCatalog = cloneCatalog(catalog)
resIgnoreCatalog.combatBuffs.push({
    id: "test.damage.physical_res_ignore",
    sourceType: "self",
    scope: "inCombat",
    effects: [
        {
            id: "physical_res_ignore",
            type: "fixed",
            stat: "physicalResIgnore",
            value: 20,
            mode: "flat",
        },
    ],
})
const withPhysicalIgnore = calculateInCombatPanel(resIgnoreCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.physical_res_ignore"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 20,
            },
        },
    },
}))
approx(withPhysicalIgnore.damage.multipliers.resistance, 1, "Physical RES ignore should offset physical RES")

const highResistanceClamp = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 150,
            },
        },
    },
}))
approx(highResistanceClamp.damage.multipliers.resistance, 0.01, "Resistance multiplier should not go below 0.01")
approx(highResistanceClamp.damage.targetBreakdown.rawResistanceMultiplier, -0.5, "Raw resistance multiplier should remain available before clamping")

const lowResistanceClamp = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: -150,
            },
        },
    },
}))
approx(lowResistanceClamp.damage.multipliers.resistance, 2, "Resistance multiplier should not go above 2")
approx(lowResistanceClamp.damage.targetBreakdown.rawResistanceMultiplier, 2.5, "Raw high resistance multiplier should remain available before clamping")

const anbyElectric = calculateInCombatPanel(catalog, minimalInput({
    agentId: "anby_demara",
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 80,
                electric: 20,
            },
        },
    },
}))
assert.equal(anbyElectric.damage.targetBreakdown.damageElement, "electric")
approx(anbyElectric.damage.multipliers.resistance, 0.8, "Anby should use electric RES, not physical RES")

const targetOnlyCatalog = cloneCatalog(catalog)
targetOnlyCatalog.combatBuffs.push({
    id: "test.damage.target_only",
    sourceType: "boss",
    scope: "inCombat",
    effects: [
        {
            id: "def_reduction",
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
        },
    ],
})
const withoutTargetDebuff = calculateInCombatPanel(targetOnlyCatalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
const withTargetDebuff = calculateInCombatPanel(targetOnlyCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.target_only"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
assert.deepEqual(withTargetDebuff.inCombat.panel, withoutTargetDebuff.inCombat.panel)
assert.ok(withTargetDebuff.damage.finalDamage > withoutTargetDebuff.damage.finalDamage)

const clampedCatalog = cloneCatalog(catalog)
clampedCatalog.combatBuffs.push({
    id: "test.damage.defense_clamp",
    sourceType: "boss",
    scope: "inCombat",
    effects: [
        {
            id: "def_reduction",
            type: "fixed",
            stat: "enemyDefReduction",
            value: 200,
            mode: "flat",
        },
    ],
})
const clamped = calculateInCombatPanel(clampedCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.defense_clamp"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
assert.equal(clamped.damage.targetBreakdown.effectiveDefense, 0)
assert.equal(clamped.damage.multipliers.defense, 1)

const critClampCatalog = cloneCatalog(catalog)
critClampCatalog.combatBuffs.push({
    id: "test.damage.crit_rate_clamp",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "crit_rate_overcap",
            type: "fixed",
            stat: "critRate",
            value: 200,
            mode: "flat",
        },
    ],
})
const critClamped = calculateInCombatPanel(critClampCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.crit_rate_clamp"],
    },
    damage: {
        critMode: "expected",
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(
    critClamped.damage.multipliers.crit,
    1 + critClamped.inCombat.panel.critDmg,
    "Expected crit multiplier should cap crit rate at 100%",
)
assert.equal(critClamped.damage.multipliers.critRate, 1)
assert.ok(critClamped.damage.multipliers.rawCritRate > 1)
assert.match(
    critClamped.damage.whiteBoxRows.find(row => row.label === "暴击乘区")?.formula ?? "",
    /^100% ×/,
)

console.log("damage whitebox tests passed")
