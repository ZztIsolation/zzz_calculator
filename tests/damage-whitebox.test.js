import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"
import {
    GENERATED_HIT_TOTAL_ROW_ID,
    damageSkillRowsWithGeneratedTotals,
    skillRowValue,
} from "../frontend/skillMultiplierCandidates.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const exampleInput = catalog.examples.yeShunguang.input
const meta = buildMeta(catalog)
assert.ok(meta.agentSkills.some(item => item.id === "ye_shunguang"), "Meta should expose agent skill catalogs")
const miyabiSkillCatalog = meta.agentSkills.find(item => item.id === "hoshimi_miyabi")
assert.ok(miyabiSkillCatalog, "Meta should expose Miyabi skill catalog")
assert.ok(
    miyabiSkillCatalog.categories.every(category =>
        category.moves.every(move => move.damageElement === "ice")
    ),
    "Every stored Miyabi skill row should settle as ice",
)
const yixuan = meta.agents.find(item => item.id === "yixuan")
assert.ok(yixuan, "Meta should expose Yixuan")
assert.equal(yixuan.attribute, "xuanmo", "Yixuan should use Xuanmo as the display attribute")
assert.equal(yixuan.damageElement, "ether", "Yixuan Xuanmo damage should settle as ether")
assert.equal(yixuan.specialty, "rupture", "Yixuan should use rupture specialty")
assert.equal(yixuan.defaultCalculationConfig?.mode, "sheer", "Yixuan should default to sheer damage calculation")
const yixuanSkillCatalog = meta.agentSkills.find(item => item.id === "yixuan")
assert.ok(yixuanSkillCatalog, "Meta should expose Yixuan skill catalog")
assert.ok(
    yixuanSkillCatalog.categories.every(category =>
        category.moves.every(move => move.damageElement === "ether"
            && move.rows.every(row => row.kind !== "damageMultiplier" || row.damageBasis === "sheerForce"))
    ),
    "Every stored Yixuan damage row should settle as ether and use sheer force",
)

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

function skillMove(skillId, categoryId, moveId) {
    const skill = catalog.agentSkills.find(item => item.id === skillId)
    assert.ok(skill, `Missing skill catalog ${skillId}`)
    const category = (skill.categories ?? []).find(item => item.id === categoryId)
    assert.ok(category, `Missing skill category ${skillId}.${categoryId}`)
    const move = (category.moves ?? []).find(item => item.id === moveId)
    assert.ok(move, `Missing skill move ${skillId}.${categoryId}.${moveId}`)
    return { category, move }
}

function generatedTotalRow(skillId, categoryId, moveId) {
    const { category, move } = skillMove(skillId, categoryId, moveId)
    const row = damageSkillRowsWithGeneratedTotals(category, move)
        .find(item => item.id === GENERATED_HIT_TOTAL_ROW_ID)
    return { category, move, row }
}

function sourceRowTotal(category, move, rowIds, level) {
    return rowIds.reduce((total, rowId) => {
        const row = (move.rows ?? []).find(item => item.id === rowId)
        assert.ok(row, `Missing source row ${rowId}`)
        return total + skillRowValue(category, move, row, level)
    }, 0)
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

{
    const { category, move, row } = generatedTotalRow("ye_shunguang", "basic", "quick_sword")
    assert.ok(row, "Ye Shunguang quick_sword should expose generated total")
    assert.deepEqual(row.generatedFromRowIds, ["hit_1", "hit_2", "hit_3", "hit_4"])
    approx(skillRowValue(category, move, row, 12), sourceRowTotal(category, move, row.generatedFromRowIds, 12), "Ye Shunguang generated total LV12")
}

{
    const { row } = generatedTotalRow("hoshimi_miyabi", "basic", "windflower_frost")
    assert.ok(row, "Miyabi windflower_frost should expose generated total")
    assert.deepEqual(row.generatedFromRowIds, ["hit_3", "hit_4", "hit_5"])
}

{
    const { row } = generatedTotalRow("alice_thymefield", "basic", "star_rite_overture")
    assert.ok(row, "Alice star_rite_overture should expose generated total")
    assert.deepEqual(row.generatedFromRowIds, ["hit_1", "hit_2", "hit_3", "hit_4", "hit_5"])
    assert.equal(row.generatedFromRowIds.includes("hit_5_enhanced"), false)
}

for (const [skillId, categoryId, moveId] of [
    ["ye_shunguang", "basic", "clarity_cut_light_annihilation"],
    ["ye_shunguang", "special", "ex_clarity_flying_light"],
    ["hoshimi_miyabi", "special", "ex_flying_snow"],
]) {
    const { category, move } = skillMove(skillId, categoryId, moveId)
    assert.equal(
        damageSkillRowsWithGeneratedTotals(category, move).some(row => row.id === GENERATED_HIT_TOTAL_ROW_ID),
        false,
        `${skillId}.${categoryId}.${moveId} should not expose generated total`,
    )
}

{
    const level = 12
    const { category, move, row } = generatedTotalRow("ye_shunguang", "basic", "quick_sword")
    const expectedPercent = sourceRowTotal(category, move, row.generatedFromRowIds, level)
    const skillResult = calculateInCombatPanel(catalog, minimalInput({
        damage: {
            skillRef: {
                agentSkillId: "ye_shunguang",
                categoryId: "basic",
                moveId: "quick_sword",
                rowId: GENERATED_HIT_TOTAL_ROW_ID,
                level,
            },
            target: {
                defense: 953,
                levelCoefficient: 794,
            },
        },
    }))
    approx(skillResult.damage.input.skillMultiplier, expectedPercent / 100, "Generated skill ref multiplier")
    assert.match(
        skillResult.damage.whiteBoxRows.find(row => row.label === "技能倍率")?.formula ?? "",
        /总伤害倍率 LV12$/,
    )
}

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
const comboDefenseRows = combo.damage.whiteBoxRows.filter(row => row.label === "防御乘区")
assert.equal(comboDefenseRows.length, 1, "Direct whitebox should expose one defense multiplier row")
assert.deepEqual(
    comboDefenseRows[0].formulaLines.map(line => line.split("=")[0].trim()),
    ["减防后防御（减防/无视防御）", "有效防御（穿透率）", "防御乘区"],
    "Defense multiplier row should include the three-step defense route",
)

const fieldCatalog = cloneCatalog(catalog)
fieldCatalog.combatBuffs.push({
    id: "test.damage.field_dmg_coverage",
    sourceType: "field",
    scope: "inCombat",
    coverage: { default: 0.5, min: 0, max: 1, step: 0.1 },
    effects: [
        {
            id: "field_dmg",
            type: "fixed",
            stat: "dmgBonus",
            value: 20,
            mode: "flat",
        },
    ],
})
const withoutField = calculateInCombatPanel(fieldCatalog, minimalInput({
    combatBuffs: { activeBuffIds: [] },
}))
const withField = calculateInCombatPanel(fieldCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.field_dmg_coverage"],
        runtimeInputs: {
            "test.damage.field_dmg_coverage": { coverage: 0.75 },
        },
    },
}))
approx(
    withField.inCombat.panel.dmgBonus - withoutField.inCombat.panel.dmgBonus,
    0.15,
    "Field Buff runtime coverage should scale in-combat damage bonus",
)
assert.ok(withField.damage.finalDamage > withoutField.damage.finalDamage, "Field Buff should increase final damage")

const bossRuntimeCatalog = cloneCatalog(catalog)
bossRuntimeCatalog.combatBuffs.push({
    id: "test.damage.boss_runtime_def",
    sourceType: "boss",
    scope: "inCombat",
    coverage: { default: 0.5, min: 0, max: 1, step: 0.1 },
    effects: [
        {
            id: "boss_def_runtime",
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
        },
    ],
})
const withBossDefaultCoverage = calculateInCombatPanel(bossRuntimeCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.boss_runtime_def"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
const withBossFullCoverage = calculateInCombatPanel(bossRuntimeCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.boss_runtime_def"],
        runtimeInputs: {
            "test.damage.boss_runtime_def": { coverage: 1 },
        },
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(
    withBossDefaultCoverage.damage.targetBreakdown.targetDefenseAfterReduction,
    953 * 0.9,
    "Boss Buff default coverage should reduce defense by default coverage",
)
approx(
    withBossFullCoverage.damage.targetBreakdown.targetDefenseAfterReduction,
    953 * 0.8,
    "Boss Buff runtime coverage should override default coverage",
)
assert.ok(
    withBossFullCoverage.damage.finalDamage > withBossDefaultCoverage.damage.finalDamage,
    "Higher Boss Buff coverage should increase final damage",
)

const anomalyCombo = calculateInCombatPanel(comboCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.defense_combo"],
    },
    damage: {
        selectedEventId: "assault",
        events: [
            {
                id: "assault",
                kind: "anomaly",
                anomalyEffect: "assault",
            },
        ],
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 0,
            },
        },
    },
}))
approx(anomalyCombo.damage.targetBreakdown.targetDefenseAfterReduction, combo.damage.targetBreakdown.targetDefenseAfterReduction, "Anomaly reduced defense route should match direct")
approx(anomalyCombo.damage.targetBreakdown.effectiveDefense, combo.damage.targetBreakdown.effectiveDefense, "Anomaly effective defense route should match direct")
approx(anomalyCombo.damage.multipliers.defense, combo.damage.multipliers.defense, "Anomaly defense multiplier route should match direct")
const anomalyDefenseRows = anomalyCombo.damage.whiteBoxRows.filter(row => row.label === "防御乘区")
assert.equal(anomalyDefenseRows.length, 1, "Anomaly whitebox should expose one defense multiplier row")
assert.deepEqual(anomalyDefenseRows[0].formulaLines, comboDefenseRows[0].formulaLines)

const anomalyBonusSplitCatalog = cloneCatalog(catalog)
anomalyBonusSplitCatalog.combatBuffs.push({
    id: "test.damage.anomaly_bonus_split",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "attribute_anomaly_bonus",
            type: "damageModifier",
            kind: "anomalyDamageBonus",
            value: 25,
        },
        {
            id: "disorder_bonus",
            type: "damageModifier",
            kind: "disorderDamageBonus",
            value: 40,
        },
        {
            id: "anomaly_crit_rate",
            type: "damageModifier",
            kind: "anomalyCritRate",
            value: 50,
        },
        {
            id: "anomaly_crit_dmg",
            type: "damageModifier",
            kind: "anomalyCritDmg",
            value: 100,
        },
    ],
})
const attributeAnomalyWhiteBox = calculateInCombatPanel(anomalyBonusSplitCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.anomaly_bonus_split"],
    },
    damage: {
        selectedEventId: "assault-whitebox",
        events: [
            {
                id: "assault-whitebox",
                kind: "anomaly",
                anomalyEffect: "assault",
            },
        ],
    },
}))
approx(attributeAnomalyWhiteBox.damage.multipliers.attributeAnomalyDamage, 1.25, "Attribute anomaly whitebox multiplier")
approx(attributeAnomalyWhiteBox.damage.multipliers.disorderDamage, 1, "Disorder bonus should not affect attribute anomaly whitebox")
approx(attributeAnomalyWhiteBox.damage.multipliers.anomalyCrit, 1.5, "Attribute anomaly should use anomaly crit")
assert.equal(
    attributeAnomalyWhiteBox.damage.whiteBoxRows.find(row => row.label === "属性异常增伤区")?.formula,
    "1 + 属性异常增伤 25%",
    "Attribute anomaly whitebox should expose attribute anomaly bonus row",
)
assert.ok(
    attributeAnomalyWhiteBox.damage.whiteBoxRows.some(row => row.label === "异常暴击区"),
    "Attribute anomaly whitebox should expose anomaly crit row",
)
assert.equal(
    attributeAnomalyWhiteBox.damage.whiteBoxRows.some(row => row.label === "紊乱增伤区"),
    false,
    "Attribute anomaly whitebox should not expose disorder bonus row",
)

const disorderBonusWhiteBox = calculateInCombatPanel(anomalyBonusSplitCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.anomaly_bonus_split"],
    },
    damage: {
        selectedEventId: "burn-disorder-whitebox",
        events: [
            {
                id: "burn-disorder-whitebox",
                kind: "disorder",
                previousAnomalyEffect: "burn",
                elapsedSeconds: 10,
            },
        ],
    },
}))
approx(disorderBonusWhiteBox.damage.multipliers.attributeAnomalyDamage, 1, "Attribute anomaly bonus should not affect disorder whitebox")
approx(disorderBonusWhiteBox.damage.multipliers.disorderDamage, 1.4, "Disorder whitebox multiplier")
approx(disorderBonusWhiteBox.damage.multipliers.anomalyCrit, 1, "Disorder should not use anomaly crit")
assert.equal(
    disorderBonusWhiteBox.damage.whiteBoxRows.find(row => row.label === "紊乱增伤区")?.formula,
    "1 + 紊乱增伤 40%",
    "Disorder whitebox should expose disorder bonus row",
)
assert.equal(
    disorderBonusWhiteBox.damage.whiteBoxRows.some(row => row.label === "属性异常增伤区"),
    false,
    "Disorder whitebox should not expose attribute anomaly bonus row",
)
assert.equal(
    disorderBonusWhiteBox.damage.whiteBoxRows.some(row => row.label === "异常暴击区"),
    false,
    "Disorder whitebox should not expose anomaly crit row",
)

const frozenDisorderWhiteBox = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        selectedEventId: "frozen-disorder",
        events: [
            {
                id: "frozen-disorder",
                kind: "disorder",
                previousAnomalyEffect: "frozen",
                elapsedSeconds: 0,
                durationSeconds: 10,
            },
        ],
    },
}))
assert.equal(
    frozenDisorderWhiteBox.damage.whiteBoxRows.find(row => row.label === "紊乱倍率")?.formula,
    "霜寒紊乱：450% + 10 × 7.5%",
    "Frozen disorder whitebox should keep normal frozen formula",
)

const frostFrozenDisorderWhiteBox = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        selectedEventId: "frost-frozen-disorder",
        events: [
            {
                id: "frost-frozen-disorder",
                kind: "disorder",
                previousAnomalyEffect: "frost_frozen",
                elapsedSeconds: 3,
                durationSeconds: 20,
            },
        ],
    },
}))
assert.equal(
    frostFrozenDisorderWhiteBox.damage.whiteBoxRows.find(row => row.label === "紊乱倍率")?.formula,
    "烈霜霜寒紊乱（星见雅）：600% + 17 × 75%",
    "Miyabi frost disorder whitebox should use frost fixed multiplier",
)

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

const miyabiIce = calculateInCombatPanel(catalog, minimalInput({
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
                physical: 80,
            },
        },
    },
}))
assert.equal(miyabiIce.damage.targetBreakdown.damageElement, "ice")
approx(miyabiIce.damage.multipliers.resistance, 0.8, "Miyabi frost attribute should settle as ice damage")

const miyabiWithIceBonus = calculateInCombatPanel(catalog, minimalInput({
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "F",
    combatBuffs: {
        manualStats: [
            {
                id: "miyabi-ice-dmg",
                stat: "iceDmg",
                value: 30,
                mode: "flat",
            },
        ],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
            },
        },
    },
}))
approx(
    miyabiWithIceBonus.damage.multipliers.dmg,
    miyabiIce.damage.multipliers.dmg + 0.3,
    "Miyabi frost attribute should use ice damage bonus",
)

function elementDamageBuffResult(event, stat, value = 50) {
    return calculateInCombatPanel(catalog, minimalInput({
        combatBuffs: {
            manualStats: [
                {
                    id: `test-${stat}`,
                    stat,
                    value,
                    mode: "flat",
                },
            ],
        },
        damage: {
            agentLevel: 60,
            selectedEventId: event.id,
            events: [event],
            target: {
                defense: 953,
                levelCoefficient: 794,
                resistanceByElement: {
                    physical: 0,
                    fire: 0,
                    ice: 0,
                    electric: 0,
                    ether: 0,
                },
            },
        },
    }))
}

function assertElementDamageBonusGate({ event, matchingStat, offElementStat, label }) {
    const base = elementDamageBuffResult(event, "dmgBonus", 0)
    const matching = elementDamageBuffResult(event, matchingStat)
    const offElement = elementDamageBuffResult(event, offElementStat)

    approx(
        matching.inCombat.panel[matchingStat] - base.inCombat.panel[matchingStat],
        0.5,
        `${label} matching element bonus should appear on the panel`,
    )
    approx(
        offElement.inCombat.panel[offElementStat] - base.inCombat.panel[offElementStat],
        0.5,
        `${label} off-element bonus should appear on the panel`,
    )
    assert.ok(matching.damage.finalDamage > base.damage.finalDamage, `${label} matching element bonus should increase damage`)
    approx(
        offElement.damage.finalDamage,
        base.damage.finalDamage,
        `${label} off-element bonus should not affect final damage`,
    )
    approx(
        offElement.damage.multipliers.dmg,
        base.damage.multipliers.dmg,
        `${label} off-element bonus should not enter the damage multiplier`,
    )
}

assertElementDamageBonusGate({
    label: "Direct physical event",
    matchingStat: "physicalDmg",
    offElementStat: "fireDmg",
    event: {
        id: "direct-physical-element-gate",
        kind: "direct",
        skillMultiplier: 100,
        critMode: "nonCrit",
        damageElement: "physical",
    },
})

assertElementDamageBonusGate({
    label: "Attribute anomaly physical event",
    matchingStat: "physicalDmg",
    offElementStat: "fireDmg",
    event: {
        id: "assault-element-gate",
        kind: "anomaly",
        anomalyEffect: "assault",
    },
})

assertElementDamageBonusGate({
    label: "Disorder fire event",
    matchingStat: "fireDmg",
    offElementStat: "physicalDmg",
    event: {
        id: "burn-disorder-element-gate",
        kind: "disorder",
        previousAnomalyEffect: "burn",
        elapsedSeconds: 0,
    },
})

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

const defenseIgnoreCatalog = cloneCatalog(catalog)
defenseIgnoreCatalog.combatBuffs.push({
    id: "test.damage.defense_ignore",
    sourceType: "boss",
    scope: "inCombat",
    effects: [
        {
            id: "def_ignore",
            type: "fixed",
            stat: "enemyDefIgnore",
            value: 20,
            mode: "flat",
        },
    ],
})
const withDefenseIgnore = calculateInCombatPanel(defenseIgnoreCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.defense_ignore"],
    },
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
assert.deepEqual(withDefenseIgnore.inCombat.panel, withTargetDebuff.inCombat.panel)
approx(withDefenseIgnore.inCombat.buffTotals.enemyDefReduction, withTargetDebuff.inCombat.buffTotals.enemyDefReduction, "Defense ignore should feed the same target stat total")
approx(withDefenseIgnore.damage.targetBreakdown.enemyDefReduction, withTargetDebuff.damage.targetBreakdown.enemyDefReduction, "Defense ignore should feed the same target breakdown")
approx(withDefenseIgnore.damage.multipliers.defense, withTargetDebuff.damage.multipliers.defense, "Defense ignore should match defense reduction multiplier")
approx(withDefenseIgnore.damage.finalDamage, withTargetDebuff.damage.finalDamage, "Defense ignore should match defense reduction damage")

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
assert.ok(critClamped.damage.events[0].damageVariants, "Direct event should expose crit damage variants")
approx(
    critClamped.damage.events[0].damageVariants.expected.finalDamage,
    critClamped.damage.finalDamage,
    "Expected variant should match selected direct damage",
)
assert.ok(
    critClamped.damage.events[0].damageVariants.crit.finalDamage >= critClamped.damage.events[0].damageVariants.nonCrit.finalDamage,
    "Crit variant should be at least non-crit damage",
)
assert.equal(critClamped.damage.events[0].panelSnapshot.atk, critClamped.inCombat.panel.atk)

const skillTargetCatalog = cloneCatalog(catalog)
skillTargetCatalog.combatBuffs.push({
    id: "test.damage.skill_target_modifiers",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "miyabi_frost_moon_damage",
            type: "damageModifier",
            kind: "directDamageBonus",
            value: 0.6,
            valueUnit: "decimal",
            appliesTo: {
                damageKinds: ["direct"],
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
        {
            id: "miyabi_frost_moon_charge_3_multiplier",
            type: "damageModifier",
            kind: "skillMultiplierBonus",
            value: 15,
            valueUnit: "decimal",
            appliesTo: {
                damageKinds: ["direct"],
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                        rowId: "charge_3",
                    },
                ],
            },
        },
        {
            id: "legacy_percent_value",
            type: "damageModifier",
            kind: "directDamageBonus",
            value: 20,
            appliesTo: {
                damageKinds: ["direct"],
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
    ],
})
const miyabiBaseInput = {
    agentId: "hoshimi_miyabi",
    wEngineId: "hailfall_star_palace",
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: ["test.damage.skill_target_modifiers"],
    },
}
const miyabiCharge3 = calculateInCombatPanel(skillTargetCatalog, {
    ...miyabiBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "basic",
            moveId: "frost_moon",
            rowId: "charge_3",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
})
approx(miyabiCharge3.damage.multipliers.skillMultiplierBonus, 15, "Skill multiplier bonus should keep decimal +15.0")
approx(miyabiCharge3.damage.multipliers.skill, miyabiCharge3.damage.multipliers.baseSkill + 15, "Effective skill multiplier should include skill-targeted bonus")
approx(miyabiCharge3.damage.multipliers.directDamageBonus, 0.8, "Skill-targeted direct damage bonus should include decimal and legacy percent values")
assert.match(
    miyabiCharge3.damage.whiteBoxRows.find(row => row.label === "技能倍率")?.formula ?? "",
    /技能倍率加算 1500%/,
)
assert.match(
    miyabiCharge3.damage.whiteBoxRows.find(row => row.label === "增伤乘区")?.formula ?? "",
    /技能专属增伤 80%/,
)

const miyabiCharge2 = calculateInCombatPanel(skillTargetCatalog, {
    ...miyabiBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "basic",
            moveId: "frost_moon",
            rowId: "charge_2",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
})
approx(miyabiCharge2.damage.multipliers.skillMultiplierBonus, 0, "Row-scoped multiplier bonus should not apply to sibling rows")
approx(miyabiCharge2.damage.multipliers.directDamageBonus, 0.8, "Move-scoped direct damage bonus should apply to sibling rows")

const miyabiOtherMove = calculateInCombatPanel(skillTargetCatalog, {
    ...miyabiBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "special",
            moveId: "ex_flying_snow",
            rowId: "slash",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
})
approx(miyabiOtherMove.damage.multipliers.directDamageBonus, 0, "Move-scoped direct damage bonus should not affect other moves")
approx(miyabiOtherMove.damage.multipliers.skillMultiplierBonus, 0, "Row-scoped multiplier bonus should not affect other moves")

const manualSkillMultiplier = calculateInCombatPanel(skillTargetCatalog, {
    ...miyabiBaseInput,
    damage: {
        skillMultiplier: 500,
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
})
approx(manualSkillMultiplier.damage.multipliers.directDamageBonus, 0, "Skill-targeted modifier should not match manual direct multiplier")
approx(manualSkillMultiplier.damage.multipliers.skillMultiplierBonus, 0, "Skill-targeted multiplier bonus should not match manual direct multiplier")

const skillObjectTargetCatalog = cloneCatalog(catalog)
skillObjectTargetCatalog.combatBuffs.push({
    id: "test.damage.skill_target_object_rules",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "frost_moon_damage_bonus",
            type: "fixed",
            stat: "dmgBonus",
            value: 50,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
        {
            id: "frost_moon_charge_3_multiplier_bonus",
            type: "fixed",
            stat: "skillMultiplierBonus",
            value: 1500,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                        rowId: "charge_3",
                    },
                ],
            },
        },
        {
            id: "frost_moon_def_reduction",
            type: "fixed",
            stat: "enemyDefReduction",
            value: 20,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
        {
            id: "frost_moon_ice_res_reduction",
            type: "fixed",
            stat: "enemyIceResReduction",
            value: 10,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
        {
            id: "frost_moon_ice_res_ignore",
            type: "fixed",
            stat: "iceResIgnore",
            value: 10,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "hoshimi_miyabi",
                        categoryId: "basic",
                        moveId: "frost_moon",
                    },
                ],
            },
        },
    ],
})
const skillObjectBaseInput = {
    agentId: "hoshimi_miyabi",
    wEngineId: "hailfall_star_palace",
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: ["test.damage.skill_target_object_rules"],
    },
}
const skillObjectCharge3 = calculateInCombatPanel(skillObjectTargetCatalog, {
    ...skillObjectBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "basic",
            moveId: "frost_moon",
            rowId: "charge_3",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
            },
        },
    },
})
approx(skillObjectCharge3.damage.multipliers.directDamageBonus, 0.5, "Skill target dmgBonus should only enter the matched event damage zone")
approx(skillObjectCharge3.damage.multipliers.skillMultiplierBonus, 15, "Skill target multiplier bonus should convert 1500% to +15")
approx(skillObjectCharge3.damage.multipliers.skill, skillObjectCharge3.damage.multipliers.baseSkill + 15, "Skill target multiplier bonus should add to the selected skill multiplier")
approx(skillObjectCharge3.damage.targetBreakdown.enemyDefReduction, 0.2, "Skill target defense reduction should affect the matched event")
approx(skillObjectCharge3.damage.targetBreakdown.enemyResReduction, 0.1, "Skill target resistance reduction should affect the matched event")
approx(skillObjectCharge3.damage.targetBreakdown.resIgnore, 0.1, "Skill target resistance ignore should affect the matched event")
assert.match(
    skillObjectCharge3.damage.whiteBoxRows.find(row => row.label === "增伤乘区")?.formula ?? "",
    /技能专属增伤 50%/,
)

const skillObjectCharge2 = calculateInCombatPanel(skillObjectTargetCatalog, {
    ...skillObjectBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "basic",
            moveId: "frost_moon",
            rowId: "charge_2",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
            },
        },
    },
})
approx(skillObjectCharge2.damage.multipliers.directDamageBonus, 0.5, "Move-scoped skill target dmgBonus should affect sibling rows")
approx(skillObjectCharge2.damage.multipliers.skillMultiplierBonus, 0, "Row-scoped skill target multiplier should not affect sibling rows")
approx(skillObjectCharge2.damage.targetBreakdown.enemyDefReduction, 0.2, "Move-scoped skill target defense reduction should affect sibling rows")
approx(skillObjectCharge2.damage.targetBreakdown.enemyResReduction, 0.1, "Move-scoped skill target resistance reduction should affect sibling rows")
approx(skillObjectCharge2.damage.targetBreakdown.resIgnore, 0.1, "Move-scoped skill target resistance ignore should affect sibling rows")

const skillObjectOtherMove = calculateInCombatPanel(skillObjectTargetCatalog, {
    ...skillObjectBaseInput,
    damage: {
        skillRef: {
            agentSkillId: "hoshimi_miyabi",
            categoryId: "special",
            moveId: "ex_flying_snow",
            rowId: "slash",
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
            },
        },
    },
})
approx(skillObjectOtherMove.damage.multipliers.directDamageBonus, 0, "Skill target dmgBonus should not affect other moves")
approx(skillObjectOtherMove.damage.multipliers.skillMultiplierBonus, 0, "Skill target multiplier bonus should not affect other moves")
approx(skillObjectOtherMove.damage.targetBreakdown.enemyDefReduction, 0, "Skill target defense reduction should not affect other moves")
approx(skillObjectOtherMove.damage.targetBreakdown.enemyResReduction, 0, "Skill target resistance reduction should not affect other moves")
approx(skillObjectOtherMove.damage.targetBreakdown.resIgnore, 0, "Skill target resistance ignore should not affect other moves")

const skillObjectManualMultiplier = calculateInCombatPanel(skillObjectTargetCatalog, {
    ...skillObjectBaseInput,
    damage: {
        skillMultiplier: 1,
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ice: 20,
            },
        },
    },
})
approx(skillObjectManualMultiplier.damage.multipliers.directDamageBonus, 0, "Skill target dmgBonus should not match manual direct multiplier")
approx(skillObjectManualMultiplier.damage.multipliers.skillMultiplierBonus, 0, "Skill target multiplier bonus should not match manual direct multiplier")
approx(skillObjectManualMultiplier.damage.targetBreakdown.enemyDefReduction, 0, "Skill target defense reduction should not match manual direct multiplier")
approx(skillObjectManualMultiplier.damage.targetBreakdown.enemyResReduction, 0, "Skill target resistance reduction should not match manual direct multiplier")
approx(skillObjectManualMultiplier.damage.targetBreakdown.resIgnore, 0, "Skill target resistance ignore should not match manual direct multiplier")

const generatedTargetCatalog = cloneCatalog(catalog)
generatedTargetCatalog.combatBuffs.push({
    id: "test.damage.generated_skill_target",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "quick_sword_hit_3",
            type: "fixed",
            stat: "skillMultiplierBonus",
            value: 100,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "ye_shunguang",
                        categoryId: "basic",
                        moveId: "quick_sword",
                        rowId: "hit_3",
                    },
                ],
            },
        },
    ],
})
const generatedHitTotal = calculateInCombatPanel(generatedTargetCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.generated_skill_target"],
    },
    damage: {
        skillRef: {
            agentSkillId: "ye_shunguang",
            categoryId: "basic",
            moveId: "quick_sword",
            rowId: GENERATED_HIT_TOTAL_ROW_ID,
            level: 12,
        },
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(generatedHitTotal.damage.multipliers.skillMultiplierBonus, 1, "Row target should match generated total source rows")

const sheerBaseInput = {
    combatBuffs: {
        manualStats: [
            {
                id: "test-sheer-hp",
                stat: "hpFlat",
                value: 1000,
                mode: "flat",
            },
            {
                id: "test-sheer-atk",
                stat: "atkFlat",
                value: 100,
                mode: "flat",
            },
            {
                id: "test-sheer-force",
                stat: "sheerForceFlat",
                value: 50,
                mode: "flat",
            },
        ],
    },
    damage: {
        selectedEventId: "sheer-base",
        events: [
            {
                id: "sheer-base",
                kind: "sheer",
                skillMultiplier: 100,
                critMode: "nonCrit",
            },
        ],
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                physical: 0,
            },
        },
    },
}
const sheerBase = calculateInCombatPanel(catalog, minimalInput(sheerBaseInput))
const expectedSheerForce = sheerBase.inCombat.panel.hp * 0.1
    + sheerBase.inCombat.panel.atk * 0.3
    + sheerBase.inCombat.panel.sheerForceFlat
approx(sheerBase.inCombat.panel.sheerForce, expectedSheerForce, "Sheer force should derive from in-combat HP, ATK, and flat sheer force")
approx(sheerBase.damage.multipliers.sheerForce, expectedSheerForce, "Sheer event should use derived sheer force")
approx(sheerBase.damage.multipliers.defense, 1, "Sheer damage should ignore defense")
approx(
    sheerBase.damage.finalDamage,
    sheerBase.damage.multipliers.sheerForce
        * sheerBase.damage.multipliers.skill
        * sheerBase.damage.multipliers.crit
        * sheerBase.damage.multipliers.dmg
        * sheerBase.damage.multipliers.sheerDamage
        * sheerBase.damage.multipliers.resistance,
    "Sheer final damage should use the expected multiplier route",
)
assert.equal(
    sheerBase.damage.whiteBoxRows.find(row => row.label === "防御乘区")?.displayValue,
    "1",
    "Sheer whitebox should pin the defense multiplier at 1",
)
assert.ok(
    ["局内贯穿力", "贯穿力换算", "贯穿倍率", "暴击乘区", "普通增伤区", "贯穿增伤区", "防御乘区", "抗性乘区", "最终伤害"]
        .every(label => sheerBase.damage.whiteBoxRows.some(row => row.label === label)),
    "Sheer whitebox should expose every required row",
)

const sheerHighDefense = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    damage: {
        ...sheerBaseInput.damage,
        target: {
            ...sheerBaseInput.damage.target,
            defense: 9999,
        },
    },
}))
approx(sheerHighDefense.damage.finalDamage, sheerBase.damage.finalDamage, "Target defense should not change sheer damage")

const sheerWithDefenseTools = calculateInCombatPanel(comboCatalog, minimalInput({
    ...sheerBaseInput,
    combatBuffs: {
        ...sheerBaseInput.combatBuffs,
        activeBuffIds: ["test.damage.defense_combo"],
    },
}))
approx(sheerWithDefenseTools.damage.finalDamage, sheerBase.damage.finalDamage, "DEF reduction and PEN should not change sheer damage")
approx(sheerWithDefenseTools.damage.targetBreakdown.enemyDefReduction, 0, "Sheer target breakdown should hide defense reductions")
approx(sheerWithDefenseTools.damage.targetBreakdown.penRatio, 0, "Sheer target breakdown should hide PEN ratio")
approx(sheerWithDefenseTools.damage.targetBreakdown.penFlat, 0, "Sheer target breakdown should hide flat PEN")

const sheerResisted = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    damage: {
        ...sheerBaseInput.damage,
        target: {
            ...sheerBaseInput.damage.target,
            resistanceByElement: {
                physical: 20,
            },
        },
    },
}))
approx(sheerResisted.damage.multipliers.resistance, 0.8, "Sheer damage should use target resistance")
approx(sheerResisted.damage.finalDamage, sheerBase.damage.finalDamage * 0.8, "Target resistance should scale sheer damage")

const sheerWithPhysicalDmg = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    combatBuffs: {
        ...sheerBaseInput.combatBuffs,
        manualStats: [
            ...sheerBaseInput.combatBuffs.manualStats,
            {
                id: "test-sheer-physical-dmg",
                stat: "physicalDmg",
                value: 50,
                mode: "flat",
            },
        ],
    },
}))
const sheerWithFireDmg = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    combatBuffs: {
        ...sheerBaseInput.combatBuffs,
        manualStats: [
            ...sheerBaseInput.combatBuffs.manualStats,
            {
                id: "test-sheer-fire-dmg",
                stat: "fireDmg",
                value: 50,
                mode: "flat",
            },
        ],
    },
}))
approx(sheerWithPhysicalDmg.inCombat.panel.physicalDmg - sheerBase.inCombat.panel.physicalDmg, 0.5, "Sheer matching element bonus should appear on the panel")
approx(sheerWithFireDmg.inCombat.panel.fireDmg - sheerBase.inCombat.panel.fireDmg, 0.5, "Sheer off-element bonus should appear on the panel")
assert.ok(sheerWithPhysicalDmg.damage.finalDamage > sheerBase.damage.finalDamage, "Sheer matching element bonus should increase damage")
approx(sheerWithFireDmg.damage.finalDamage, sheerBase.damage.finalDamage, "Sheer off-element bonus should not affect final damage")
approx(sheerWithFireDmg.damage.multipliers.dmg, sheerBase.damage.multipliers.dmg, "Sheer off-element bonus should not enter the ordinary damage multiplier")

const sheerExpectedCrit = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    damage: {
        ...sheerBaseInput.damage,
        events: [
            {
                ...sheerBaseInput.damage.events[0],
                critMode: "expected",
            },
        ],
    },
}))
assert.ok(sheerExpectedCrit.damage.events[0].damageVariants, "Sheer event should expose crit damage variants")
approx(
    sheerExpectedCrit.damage.events[0].damageVariants.expected.finalDamage,
    sheerExpectedCrit.damage.finalDamage,
    "Expected variant should match selected sheer damage",
)
assert.ok(
    sheerExpectedCrit.damage.events[0].damageVariants.crit.finalDamage >= sheerExpectedCrit.damage.events[0].damageVariants.nonCrit.finalDamage,
    "Sheer crit variant should be at least non-crit damage",
)

const sheerBonusInput = {
    combatBuffs: {
        manualEffects: [
            {
                id: "manual_sheer_bonus",
                label: "手动贯穿增伤",
                effects: [
                    {
                        id: "manual_sheer_bonus",
                        type: "fixed",
                        stat: "sheerDmgBonus",
                        value: 20,
                        mode: "flat",
                    },
                    {
                        id: "manual_physical_sheer_bonus",
                        type: "fixed",
                        stat: "physicalSheerDmg",
                        value: 30,
                        mode: "flat",
                    },
                ],
            },
        ],
    },
}
const sheerWithBonus = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBaseInput,
    combatBuffs: {
        ...sheerBaseInput.combatBuffs,
        manualEffects: sheerBonusInput.combatBuffs.manualEffects,
    },
}))
approx(sheerWithBonus.damage.multipliers.sheerDamage, 1.5, "Generic and elemental sheer damage bonuses should stack for sheer")
approx(sheerWithBonus.damage.finalDamage, sheerBase.damage.finalDamage * 1.5, "Sheer damage bonus should scale sheer damage")
const directWithoutSheerBonus = calculateInCombatPanel(catalog, minimalInput({
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
const directWithSheerBonus = calculateInCombatPanel(catalog, minimalInput({
    ...sheerBonusInput,
    damage: {
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(directWithSheerBonus.damage.finalDamage, directWithoutSheerBonus.damage.finalDamage, "Sheer damage bonuses should not affect direct damage")

const sheerSkillTargetCatalog = cloneCatalog(catalog)
sheerSkillTargetCatalog.combatBuffs.push({
    id: "test.damage.sheer_skill_target",
    sourceType: "manual",
    scope: "inCombat",
    effects: [
        {
            id: "quick_sword_hit_1_sheer_multiplier",
            type: "fixed",
            stat: "skillMultiplierBonus",
            value: 100,
            mode: "flat",
            target: {
                kind: "skill",
                skillTargets: [
                    {
                        agentSkillId: "ye_shunguang",
                        categoryId: "basic",
                        moveId: "quick_sword",
                        rowId: "hit_1",
                    },
                ],
            },
        },
    ],
})
const sheerSkillTarget = calculateInCombatPanel(sheerSkillTargetCatalog, minimalInput({
    combatBuffs: {
        activeBuffIds: ["test.damage.sheer_skill_target"],
    },
    damage: {
        selectedEventId: "sheer-skill",
        events: [
            {
                id: "sheer-skill",
                kind: "sheer",
                skillRef: {
                    agentSkillId: "ye_shunguang",
                    categoryId: "basic",
                    moveId: "quick_sword",
                    rowId: "hit_1",
                    level: 12,
                },
                critMode: "nonCrit",
            },
        ],
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}))
approx(sheerSkillTarget.damage.multipliers.skillMultiplierBonus, 1, "Skill-targeted multiplier bonus should apply to matched sheer skills")
approx(sheerSkillTarget.damage.multipliers.skill, sheerSkillTarget.damage.multipliers.baseSkill + 1, "Sheer skill multiplier should include matched skill multiplier bonus")

const yixuanUltimate = calculateInCombatPanel(catalog, minimalInput({
    agentId: "yixuan",
    coreSkillLevel: "F",
    combatBuffs: {
        manualStats: [
            {
                id: "yixuan-test-hp",
                stat: "hpFlat",
                value: 1000,
                mode: "flat",
            },
            {
                id: "yixuan-test-atk",
                stat: "atkFlat",
                value: 100,
                mode: "flat",
            },
            {
                id: "yixuan-test-sheer-flat",
                stat: "sheerForceFlat",
                value: 104,
                mode: "flat",
            },
        ],
    },
    damage: {
        selectedEventId: "yixuan-ultimate",
        events: [
            {
                id: "yixuan-ultimate",
                kind: "sheer",
                skillRef: {
                    agentSkillId: "yixuan",
                    categoryId: "chain",
                    moveId: "ultimate_qingming_cloud_shadow",
                    rowId: "damage",
                    level: 12,
                },
                critMode: "nonCrit",
            },
        ],
        target: {
            defense: 953,
            levelCoefficient: 794,
            resistanceByElement: {
                ether: 20,
            },
        },
    },
}))
const expectedYixuanSkill = 3706.9 / 100
const expectedYixuanSheerForce = yixuanUltimate.inCombat.panel.hp * 0.1
    + yixuanUltimate.inCombat.panel.atk * 0.3
    + yixuanUltimate.inCombat.panel.sheerForceFlat
approx(yixuanUltimate.outOfCombat.base.hp, 7953 + 420, "Yixuan F core skill should add base HP")
approx(yixuanUltimate.damage.input.skillMultiplier, expectedYixuanSkill, "Yixuan ultimate should resolve imported level 12 sheer multiplier")
approx(yixuanUltimate.damage.multipliers.sheerForce, expectedYixuanSheerForce, "Yixuan sheer damage should derive sheer force from in-combat HP and ATK")
approx(yixuanUltimate.damage.multipliers.defense, 1, "Yixuan sheer damage should ignore defense")
approx(yixuanUltimate.damage.multipliers.resistance, 0.8, "Yixuan sheer damage should use ether resistance")
assert.equal(
    yixuanUltimate.damage.input.skillSource?.damageBasis,
    "sheerForce",
    "Yixuan skill source should expose sheerForce as damage basis",
)

const yixuanDefault = calculateInCombatPanel(catalog, minimalInput({
    agentId: "yixuan",
    coreSkillLevel: "F",
    damage: yixuan.defaultCalculationConfig,
}))
assert.equal(yixuanDefault.damage.input.kind, "sheer", "Yixuan default calculation should produce a sheer event")
assert.equal(yixuanDefault.damage.events[0]?.kind, "sheer", "Yixuan default event list should keep sheer kind")
assert.ok(yixuanDefault.damage.whiteBoxRows.some(row => row.label === "局内贯穿力"), "Yixuan default whitebox should include sheer force")

console.log("damage whitebox tests passed")
