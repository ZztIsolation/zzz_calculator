import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
    calculateInCombatPanel,
    calculateOutOfCombatPanel,
    createInCombatPanelCalculator,
    loadCatalog,
} from "../backend/calculator.js"
import {
    normalizeSharpDamageEvent,
    sharpCritBreakdown,
    sharpOutOfCombatCritRate,
    sharpWhiteBoxRows,
} from "../core/sharpDamage.js"
import { evaluateInCombatFormulaRule } from "../core/effectFormula.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCatalog(path.join(rootDir, "data"), path.join(rootDir, "examples"))
const claret = catalog.agentsMap.get("claret")
const removedSharpFields = [
    "sharpProfileId",
    "sharpComponent",
    "maimTrigger",
    "sharpScenario",
    "sharpComponents",
    "sharpScenarioAnyOf",
    "sharpMaimMultiplier",
]

function containsKey(value, key) {
    if (Array.isArray(value)) return value.some(item => containsKey(item, key))
    if (!value || typeof value !== "object") return false
    return Object.prototype.hasOwnProperty.call(value, key)
        || Object.values(value).some(child => containsKey(child, key))
}

for (const key of removedSharpFields) {
    assert.equal(containsKey(claret, key), false, `Claret catalog must not contain ${key}`)
    assert.equal(containsKey(catalog.agentSkillsMap.get("claret"), key), false, `Claret skill catalog must not contain ${key}`)
}
assert.equal(JSON.stringify(claret).includes("sharpCritRate"), false, "Claret catalog must not contain a separate sharp CRIT Rate field")
assert.deepEqual(
    claret.combatBuffs.corePassive.effects.find(effect => effect.id === "claret-sharp-state-crit-rate")?.target,
    { kind: "default" },
    "Claret Core Passive CRIT Rate should use the ordinary panel target",
)
assert.match(claret.combatBuffs.corePassive.description.zhCN, /\[残痕\]最多叠加3层/u)
assert.match(claret.combatBuffs.corePassive.description.zhCN, /毁伤/u)
assert.match(claret.combatBuffs.corePassive.description.zhCN, /初始暴击伤害.*0\.35%/u)
assert.deepEqual(
    claret.coreSkill.corePassiveScaling.levels.map(level => [level.critRatePct, level.sharpBuildupEfficiencyPct]),
    [[15, 20], [17.5, 25], [20, 30], [22.5, 35], [25, 40], [27.5, 45], [30, 50]],
    "Claret Core Passive scaling should keep complete CRIT Rate and Gash buildup values",
)

function approx(actual, expected, label, epsilon = 1e-10) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon * Math.max(1, Math.abs(Number(expected))), `${label}: expected ${expected}, got ${actual}`)
}

for (const [percent, expectedP1, expectedP2] of [
    [0, 0, 0],
    [50, 0.5, 0],
    [100, 1, 0],
    [132.3, 1, 0.323],
    [150, 1, 0.5],
    [200, 1, 1],
    [220, 1, 1],
]) {
    const breakdown = sharpCritBreakdown({
        panel: { critRate: percent / 100, lacerationDmg: 1.5 },
        outOfCombatPanel: { critDmg: 0 },
    })
    approx(breakdown.effectiveCritRate, Math.min(percent / 100, 2), `sharp CR ${percent}`)
    approx(breakdown.p1, expectedP1, `sharp p1 ${percent}`)
    approx(breakdown.p2, expectedP2, `sharp p2 ${percent}`)
    assert.ok(breakdown.p2 <= 1, `sharp CR ${percent} must have at most a second check`)
    approx(breakdown.modes.nonCrit, 1, `sharp nonCrit ${percent}`)
    approx(breakdown.modes.sharpCrit, 2.5, `sharpCrit ${percent}`)
    approx(breakdown.modes.lacerationCrit, 6.25, `lacerationCrit ${percent}`)
    if (percent === 132.3) approx(breakdown.expected, 2.5 * (1 + 0.323 * 1.5), "figure formula")
    if (percent === 220) approx(breakdown.expected, 6.25, "sharp cap")
}

const sharpWhiteBoxTarget = {
    targetDefense: 953,
    enemyDefReduction: 0,
    enemyDefFlatReduction: 0,
    targetDefenseAfterReduction: 953,
    penRatio: 0,
    panelPenRatio: 0,
    targetedPenRatio: 0,
    penFlat: 0,
    levelCoefficient: 794,
    effectiveDefense: 953,
    defenseMultiplier: 794 / (794 + 953),
    targetResistance: 0,
    enemyResReduction: 0,
    resIgnore: 0,
    resistanceMultiplier: 1,
    resistanceFixedOne: false,
    stunned: true,
    stunMultiplier: 1.5,
    stunDmgMultiplierBonus: 0,
    stunDmgMultiplierBonusAlways: 0,
    stunDmgMultiplierBonusCapAlways: 0,
    capturedStunMultiplier: 1.5,
    activeStunMultiplier: 1.5,
}

function sharpWhiteBoxForRate(percent, mode = "expected", options = {}) {
    const eventTotals = options.eventTotals ?? {}
    const crit = sharpCritBreakdown({
        panel: { critRate: percent / 100, lacerationDmg: options.lacerationDmg ?? 1.62 },
        outOfCombatPanel: { critDmg: 0 },
        eventTotals,
    })
    const normalizedMode = mode === "crit" ? "sharpCrit" : mode
    const critMultiplier = crit.modes[normalizedMode] ?? crit.expected
    const damageMultiplier = options.damageMultiplier ?? 1
    const sharpDamageMultiplier = options.sharpDamageMultiplier ?? 1
    const result = {
        basis: options.basis ?? 1000,
        panelBasis: options.panelBasis ?? options.basis ?? 1000,
        skill: options.skill ?? 1,
        critMultiplier,
        crit,
        singleDamage: 0,
        finalDamage: 0,
    }
    const event = {
        id: "sharp-white-box-test",
        kind: "sharp",
        damageElement: "electric",
        critMode: mode,
        damageScale: options.damageScale ?? 1,
        count: options.count ?? 1,
        skillMultiplier: options.skillMultiplier ?? 1,
        label: "测试锐化",
    }
    const rows = sharpWhiteBoxRows({
        event,
        result,
        targetBreakdown: sharpWhiteBoxTarget,
        damageMultiplier,
        sharpDamageMultiplier,
        selectedDmgBonus: options.selectedDmgBonus ?? 0,
        targetedDmgBonus: options.targetedDmgBonus ?? 0,
        sharpDmgBonus: options.sharpDmgBonus ?? null,
        skillMultiplierBonus: options.skillMultiplierBonus ?? 0,
        damageElementText: "电",
    })
    return { event, result, crit, rows, damageMultiplier, sharpDamageMultiplier }
}

for (const percent of [0, 85.4, 100, 132.3, 200, 220]) {
    const { rows, crit } = sharpWhiteBoxForRate(percent)
    const row = rows.find(item => item.label === "锐暴乘区")
    assert.ok(row, `Sharp whitebox should expose one sharp crit row at ${percent}%`)
    approx(row.value, crit.expected, `Sharp whitebox expected multiplier at ${percent}%`)
    assert.doesNotMatch(String(row.displayValue), /000000/u, `Sharp whitebox should trim precision at ${percent}%`)
    if (percent <= 100) {
        assert.match(String(row.formula), /% × \(1 \+ 162%\) \+ \(1 - .*%\)/u)
    } else {
        assert.match(String(row.formula), /\(1 \+ 162%\) × \(1 \+ \(.*% - 100%\) × 162%\)/u)
    }
    if (percent > 200) {
        assert.match(String(row.formula), /clamp\(局内面板暴击率 220%, 0%, 200%\) = 200%/u)
    }
}

for (const [mode, expectedMode, expectedFormula] of [
    ["nonCrit", "nonCrit", "不触发锐暴 = 1"],
    ["sharpCrit", "sharpCrit", "一次锐暴 = 1 + 162%"],
    ["lacerationCrit", "lacerationCrit", "(1 + 162%) × (1 + 162%)"],
]) {
    const { rows, crit } = sharpWhiteBoxForRate(132.3, mode)
    const row = rows.find(item => item.label === "锐暴乘区")
    assert.equal(row?.formula, expectedFormula)
    approx(row?.value, crit.modes[expectedMode], `${mode} sharp whitebox mode`)
}

const sharpWhiteBoxWithBonuses = sharpWhiteBoxForRate(118.8, "expected", {
    damageMultiplier: 1.3004,
    sharpDamageMultiplier: 1.2,
    selectedDmgBonus: 0.2504,
    targetedDmgBonus: 0.05,
    sharpDmgBonus: 0.2,
})
const sharpOrdinaryIncreaseRow = sharpWhiteBoxWithBonuses.rows.find(item => item.label === "普通增伤区")
const sharpIncreaseRow = sharpWhiteBoxWithBonuses.rows.find(item => item.label === "锐化增伤乘区")
assert.ok(sharpOrdinaryIncreaseRow?.formula.includes("通用/属性增伤 25.04%"))
assert.ok(sharpOrdinaryIncreaseRow?.formula.includes("技能目标增伤 5%"))
assert.equal(sharpIncreaseRow?.formula, "1 + 锐化增伤 20%")
approx(sharpOrdinaryIncreaseRow?.value, 1.3004, "Sharp whitebox should expose the ordinary damage zone")
approx(sharpIncreaseRow?.value, 1.2, "Sharp whitebox should expose the sharp damage zone")
assert.match(
    sharpWhiteBoxWithBonuses.rows.find(item => item.label === "最终伤害")?.formula ?? "",
    / × 1\.3004 × 1\.2 × /u,
    "Sharp final formula should multiply the ordinary and sharp damage zones separately",
)

const sharpWhiteBoxBasis = sharpWhiteBoxForRate(85.4, "expected", { basis: 1200 })
assert.equal(sharpWhiteBoxBasis.rows.filter(item => item.label === "局内防御力").length, 1)
assert.equal(
    sharpWhiteBoxBasis.rows.find(item => item.label === "局内防御力")?.formula,
    "来自局内面板防御力",
    "Sharp basis should always come from the in-combat DEF panel",
)

const marrowFormula = {
    type: "formula",
    stat: "dmgBonus",
    mode: "flat",
    target: { kind: "default" },
    source: { kind: "inCombatStat", stat: "critRate", unit: "storedPercent", label: { zhCN: "局内暴击率" } },
    formula: {
        expression: "clamp(max(x - threshold, 0) * rate, 0, cap)",
        valueUnit: "storedPercent",
        parameters: { threshold: 100, rate: 0.8, cap: 40 },
    },
}
approx(evaluateInCombatFormulaRule(marrowFormula, { critRate: 1.188 }).value, 0.1504, "Blood Marrow formula")

const converted = sharpOutOfCombatCritRate({
    rawCritRate: 0.91,
    critDmg: 0.6,
    profile: { initialCritDmgToCritRateRatio: 0.35 },
})
approx(converted.critRate, 1.12, "Initial out-of-combat CRIT DMG conversion")
const convertedWithMoreCritDmg = sharpOutOfCombatCritRate({
    rawCritRate: converted.critRate - converted.conversion,
    critDmg: 0.7,
    profile: { initialCritDmgToCritRateRatio: 0.35 },
})
approx(convertedWithMoreCritDmg.critRate, 1.155, "Out-of-combat CRIT DMG increase should add 3.5% CRIT Rate")
const noDuplicateConversion = sharpCritBreakdown({
    panel: { critRate: 1.155, critDmg: 0.7, lacerationDmg: 1.5 },
    outOfCombatPanel: { critRate: 1.155, critDmg: 0.7 },
})
approx(noDuplicateConversion.effectiveCritRate, 1.155, "Sharp calculation must not convert out-of-combat CRIT DMG twice")

assert.equal(claret.specialty, "armorer")
assert.deepEqual(claret.level60, {
    hpBase: 5651,
    atkBase: 626,
    defBase: 441,
    critRate: 5,
    critDmg: 50,
    lacerationDmg: 150,
    impact: 93,
    anomalyProficiency: 79,
    anomalyMastery: 80,
    energyRegen: 100,
    penRatio: 0,
})
assert.equal(catalog.agentSkillsMap.get("claret").categories.flatMap(category => category.moves).length, 19)
assert.equal(catalog.agentSkillsMap.get("claret").categories.flatMap(category => category.moves).filter(move => move.damageKind === "sharp").length, 17)
for (const id of ["zzz_wiki_2188", "zzz_wiki_2189", "zzz_wiki_2190", "zzz_wiki_2200"]) {
    const engine = catalog.wEnginesMap.get(id)
    assert.equal(Number(engine.level60.defBase) > 0, true, `${id} should use DEF base`)
    assert.equal(engine.level60.atkBase, undefined, `${id} must not disguise DEF as ATK`)
}

function sharpInput(wEngineId, damage = claret.defaultCalculationConfig, extra = {}) {
    return {
        agentId: "claret",
        wEngineId,
        wEngineModificationLevel: 5,
        coreSkillLevel: "F",
        cinemaLevel: extra.cinemaLevel ?? 0,
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: [
                "agent:claret.corePassive",
                "agent:claret.additionalAbility",
                `wEngine:${wEngineId}.self`,
                ...(extra.cinemaLevel ? [`agent:claret.cinema.${extra.cinemaLevel}`] : []),
            ],
        },
        damage,
    }
}

const marrow = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2189"))
const marrowEvent = marrow.damage.events[0]
approx(marrow.inCombat.panel.critRate, 1.013, "Core Passive ordinary panel CRIT Rate")
approx(marrowEvent.sharp.crit.effectiveCritRate, 1.013, "marrow effective CR")
approx(marrow.inCombat.dynamicDmgBonus, 0.0104, "marrow dynamic generic damage bonus")
approx(marrow.inCombat.panel.dmgBonus, 0.0104, "marrow dynamic bonus should enter generic damage panel")
assert.equal(
    Object.hasOwn(marrowEvent.sharp.crit, "targetedCritRateBonus"),
    false,
    "Sharp crit breakdown should not carry a sharp-target CRIT Rate bonus",
)
approx(marrow.inCombat.panel.lacerationDmg, 1.75, "Claret laceration panel aggregates the additional ability")
approx(marrow.inCombat.buffTotals.lacerationDmg, 0.25, "Claret in-combat laceration bonus enters buff totals")
assert.equal(marrow.outOfCombat.panel.lacerationDmg, 1.5, "Claret base laceration stays 150% out of combat")
const claretOutOfCombat = calculateOutOfCombatPanel(catalog, {
    agentId: "claret",
    wEngineId: "zzz_wiki_2188",
    wEngineModificationLevel: 5,
    coreSkillLevel: "F",
    driveDiscs: [],
})
const claretOutOfCombatWithCritDmg = calculateOutOfCombatPanel(catalog, {
    agentId: "claret",
    wEngineId: "zzz_wiki_2188",
    wEngineModificationLevel: 5,
    coreSkillLevel: "F",
    driveDiscs: [{
        setId: "zzz_wiki_2121",
        mainStat: { stat: "critDmg", value: 10, mode: "flat" },
        subStats: [],
    }],
})
approx(
    claretOutOfCombatWithCritDmg.panel.critRate - claretOutOfCombat.panel.critRate,
    0.035,
    "Claret out-of-combat CRIT DMG should convert to ordinary CRIT Rate",
)
approx(claretOutOfCombatWithCritDmg.panel.critDmg, 0.6, "Claret out-of-combat CRIT DMG panel")
assert.equal(
    claretOutOfCombat.appliedEffects.find(effect => effect.key === "claret.corePassive.outOfCombat")?.stats[0]?.stat,
    "critRate",
    "Claret conversion should be reported as a Core Passive out-of-combat effect",
)

const originalCorePassive = claret.combatBuffs.corePassive
claret.combatBuffs.corePassive = {
    ...structuredClone(originalCorePassive),
    effects: [
        ...(structuredClone(originalCorePassive.effects) ?? []),
        {
            id: "test-out-of-combat-laceration-dmg",
            type: "fixed",
            scope: "outOfCombat",
            stat: "lacerationDmg",
            value: 20,
            mode: "flat",
            target: { kind: "default" },
        },
    ],
}
const outOfCombatLacerationInput = sharpInput("zzz_wiki_2189")
outOfCombatLacerationInput.combatBuffs.activeBuffIds = outOfCombatLacerationInput.combatBuffs.activeBuffIds
    .filter(id => id !== "agent:claret.additionalAbility")
const outOfCombatLaceration = calculateInCombatPanel(catalog, outOfCombatLacerationInput)
approx(outOfCombatLaceration.outOfCombat.panel.lacerationDmg, 1.7, "Out-of-combat laceration panel applies +20%")
approx(outOfCombatLaceration.inCombat.panel.lacerationDmg, 1.7, "In-combat panel inherits out-of-combat laceration")
approx(
    outOfCombatLaceration.damage.events[0].sharp.crit.value,
    1.7,
    "Sharp calculation uses the out-of-combat laceration panel",
)

const outOfCombatLacerationCalculator = createInCombatPanelCalculator(catalog, outOfCombatLacerationInput)
const outOfCombatStatIds = ["lacerationDmg"]
const outOfCombatStatValues = new Float64Array([10])
const outOfCombatStatTotals = new Map([["lacerationDmg", 10]])
const outOfCombatLegacy = outOfCombatLacerationCalculator.scoreOnlyFromSummaryLegacy(outOfCombatStatTotals, new Map())
const outOfCombatCompiled = outOfCombatLacerationCalculator.scoreOnlyFromSummary(outOfCombatStatTotals, new Map())
const outOfCombatIndexed = outOfCombatLacerationCalculator.scoreOnlyFromIndexedSummary(
    outOfCombatStatValues,
    outOfCombatStatIds,
    new Int16Array(),
    [],
    new Map(),
)
const outOfCombatDenseTarget = outOfCombatLacerationCalculator.compileDensePanelScoreTarget({
    statIds: outOfCombatStatIds,
    setIds: [],
})
const outOfCombatDense = outOfCombatDenseTarget.scoreDense(outOfCombatStatValues, new Int16Array())
const outOfCombatFixed = outOfCombatDenseTarget.compileForSetCounts(new Int16Array()).scoreScalar(outOfCombatStatValues)
for (const [label, result] of [
    ["compiled", outOfCombatCompiled],
    ["indexed", outOfCombatIndexed],
    ["dense", outOfCombatDense],
    ["fixed", outOfCombatFixed],
]) {
    const panelLaceration = result.panel?.lacerationDmg
        ?? result.outOfCombatPanelValues?.[outOfCombatDenseTarget.panelStatIds.indexOf("lacerationDmg")]
    approx(panelLaceration, 1.8, `${label} out-of-combat laceration panel with candidate stat`)
    approx(result.finalDamage, outOfCombatLegacy.finalDamage, `${label} out-of-combat laceration damage`)
}
claret.combatBuffs.corePassive = originalCorePassive
const scarlet = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188"))
assert.equal(scarlet.outOfCombat.base.def, 872)
assert.equal(scarlet.outOfCombat.baseBreakdown.wEngine.def, 431)
assert.equal(scarlet.outOfCombat.baseBreakdown.wEngine.atk, 0)

const c1 = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", claret.defaultCalculationConfig, { cinemaLevel: 1 }))
const c1Maim = c1.damage.events.find(event => event.input?.skillSource?.rowId === "maim")
assert.ok(c1Maim, "Maim remains selectable as an ordinary multiplier row")
assert.equal(Object.hasOwn(c1Maim.multipliers, "maimMultiplier"), false)
assert.equal(Object.hasOwn(c1Maim.multipliers, "gashActive"), false)
assert.ok(c1Maim.finalDamage > 0, "Maim row should calculate as ordinary sharp damage")
const claretCinemaOne = claret.combatBuffs.cinemaBuffs.find(buff => buff.cinemaLevel === 1)
assert.equal(claretCinemaOne?.buffModifiers?.[0]?.factor, 1.3, "Claret Cinema 1 should store a 1.3 resolved-value modifier")
assert.deepEqual(claretCinemaOne?.buffModifiers?.[0]?.targetBuffIds, ["skill:claret:special:special_slash_gold"])
assert.deepEqual(claretCinemaOne?.buffModifiers?.[0]?.targetEffectIds, ["maim"])
const targetedClaretDamage = rowId => ({
    mode: "custom",
    events: [{
        id: rowId,
        kind: "sharp",
        skillRef: {
            agentSkillId: "claret",
            categoryId: "special",
            moveId: "special_slash_gold",
            rowId,
        },
        critMode: "nonCrit",
        count: 1,
    }],
    selectedEventId: rowId,
})
const c0 = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", targetedClaretDamage("maim"), { cinemaLevel: 0 }))
const c1Targeted = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", targetedClaretDamage("maim"), { cinemaLevel: 1 }))
const c0Maim = c0.damage.events[0]
const c1TargetedMaim = c1Targeted.damage.events[0]
const c1Hit = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", targetedClaretDamage("hit_1"), { cinemaLevel: 1 })).damage.events[0]
const c0Hit = calculateInCombatPanel(catalog, sharpInput("zzz_wiki_2188", targetedClaretDamage("hit_1"), { cinemaLevel: 0 })).damage.events[0]
approx(c1TargetedMaim.input.skillMultiplier, c0Maim.input.skillMultiplier * 1.3, "Claret Cinema 1 should multiply only the Maim skill multiplier")
approx(c1TargetedMaim.finalDamage, c0Maim.finalDamage * 1.3, "Claret Cinema 1 Maim damage should be 130% of Cinema 0")
approx(c1Hit.finalDamage, c0Hit.finalDamage, "Claret Cinema 1 should not multiply the Special uppercut row")
assert.equal(c1TargetedMaim.input.skillSource?.skillMultiplierFactor, 1.3)
assert.equal(c1Hit.input.skillSource?.skillMultiplierFactor ?? 1, 1)
assert.equal(c1TargetedMaim.multipliers.baseSkill, c0Maim.multipliers.skill)
assert.match(
    c1TargetedMaim.whiteBoxRows.find(row => row.label === "技能倍率")?.formula ?? "",
    /1625\.6% × 130%/u,
    "Claret Cinema 1 white box should expose the original Maim multiplier and factor",
)

const c1Prepared = createInCombatPanelCalculator(catalog, sharpInput("zzz_wiki_2188", targetedClaretDamage("maim"), { cinemaLevel: 1 }))
const c1PreparedResult = c1Prepared.calculate([], { round: false })
const c1PreparedMaim = c1PreparedResult.damage.events.find(event => event.input?.skillSource?.rowId === "maim")
assert.ok(c1PreparedMaim, "Prepared Claret calculation should retain the Maim event")
approx(c1PreparedMaim.finalDamage, c1TargetedMaim.finalDamage, "Prepared and ordinary Claret Cinema 1 Maim damage should match")
approx(
    c1Prepared.scoreOnlyFromSummary(new Map(), new Map()).finalDamage,
    c1TargetedMaim.finalDamage,
    "Compiled Claret Cinema 1 Maim score should match ordinary damage",
)

const c2Crimson = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2188", claret.defaultCalculationConfig, { cinemaLevel: 2 }),
})
assert.equal(c2Crimson.damage.events[0].multipliers.resistance, 1.18, "C2 applies to sharp damage")
const c2LegacyScenario = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2188", {
        mode: "custom",
        events: [{
            id: "plain",
            kind: "sharp",
            skillRef: {
                agentSkillId: "claret",
                categoryId: "basic",
                moveId: "basic_blood_forge",
                rowId: "hit_1",
            },
            sharpScenario: { crimsonInscription: false, gashStacks: 0 },
            count: 1,
        }],
        selectedEventId: "plain",
    }, { cinemaLevel: 2 }),
})
assert.equal(c2LegacyScenario.damage.events[0].multipliers.resistance, 1.18, "Legacy scenarios do not change sharp targeting")
assert.equal(Object.hasOwn(c2LegacyScenario.damage.events[0].input, "sharpScenario"), false, "Legacy scenarios are removed from runtime input")

const luckyReady = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2200"),
    damage: {
        mode: "custom",
        events: [{
            id: "ready",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpScenario: { triggeredEngineEffects: true, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "ready",
    },
})
const luckyUntriggered = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2200"),
    damage: {
        mode: "custom",
        events: [{
            id: "ready",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpScenario: { triggeredEngineEffects: false, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "ready",
    },
})
approx(luckyReady.inCombat.panel.def, (441 + 356) * (1 + 0.4 + 0.12 + 0.12), "Lucky Paw permanent DEF")
approx(luckyReady.damage.events[0].multipliers.damageBasisValue, luckyReady.inCombat.panel.def, "Lucky Paw triggered DEF joins the in-combat panel")
approx(luckyUntriggered.damage.events[0].multipliers.damageBasisValue, luckyReady.damage.events[0].multipliers.damageBasisValue, "Legacy engine toggle does not change sharp DEF")
assert.equal(Object.hasOwn(luckyUntriggered.damage.events[0].input, "sharpScenario"), false)

const legacySharp = normalizeSharpDamageEvent({
    id: "legacy-sharp",
    kind: "sharp",
    skillMultiplier: 1,
    damageElement: "electric",
    sharpProfileId: "armorer",
    sharpComponent: "maim",
    maimTrigger: "gash",
    sharpScenario: { crimsonInscription: false, gashStacks: 0 },
})
for (const key of ["sharpProfileId", "sharpComponent", "maimTrigger", "sharpScenario"]) {
    assert.equal(Object.hasOwn(legacySharp, key), false, `Legacy ${key} must be stripped during normalization`)
}

const chainWithoutCrimson = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2189"),
    damage: {
        mode: "custom",
        events: [{
            id: "chain",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            skillSource: { skillType: "chain", moveId: "ultimate_hundred_hammers" },
            sharpScenario: { crimsonInscription: false, gashStacks: 3 },
            count: 1,
        }],
        selectedEventId: "chain",
    },
})
assert.ok(chainWithoutCrimson.damage.events[0].multipliers.critRate > 0.8, "sharp damage keeps ordinary Core Passive CRIT Rate")

const noGash = calculateInCombatPanel(catalog, {
    ...sharpInput("zzz_wiki_2189"),
    damage: {
        mode: "custom",
        events: [{
            id: "empty-gash",
            kind: "sharp",
            skillMultiplier: 1,
            damageElement: "electric",
            sharpComponent: "maim",
            maimTrigger: "gash",
            sharpScenario: { crimsonInscription: true, gashStacks: 0 },
            count: 1,
        }],
        selectedEventId: "empty-gash",
    },
})
assert.equal(Object.hasOwn(noGash.damage.events[0].multipliers, "gashActive"), false)
assert.equal(noGash.damage.events[0].multipliers.damageBasis, "def")
assert.ok(noGash.damage.events[0].finalDamage > 0, "Legacy Maim fields cannot gate ordinary sharp damage")

const calculator = createInCombatPanelCalculator(catalog, sharpInput("zzz_wiki_2189"))
const legacy = calculator.scoreOnlyFromSummaryLegacy(new Map(), new Map())
const compiled = calculator.scoreOnlyFromSummary(new Map(), new Map())
const statIds = ["defFlat", "defPct", "critRate", "critDmg", "lacerationDmg"]
const denseTarget = calculator.compileDensePanelScoreTarget({ statIds, setIds: [] })
const dense = denseTarget.scoreDense(new Float64Array(statIds.length), new Int16Array())
const fixed = denseTarget.compileForSetCounts(new Int16Array()).scoreScalar(new Float64Array(statIds.length))
approx(compiled.finalDamage, legacy.finalDamage, "compiled versus legacy")
approx(dense.finalDamage, legacy.finalDamage, "dense versus legacy")
approx(fixed.finalDamage, legacy.finalDamage, "fixed versus legacy")

const fixedDefDamage = {
    mode: "custom",
    events: [{
        id: "fixed-def-sharp",
        kind: "sharp",
        damageElement: "electric",
        skillMultiplier: 1,
        critMode: "nonCrit",
        count: 1,
        stunned: true,
    }],
    selectedEventId: "fixed-def-sharp",
}
const fixedDefInput = sharpInput("zzz_wiki_2200", fixedDefDamage)
const fixedDefFull = calculateInCombatPanel(catalog, fixedDefInput)
assert.ok(
    fixedDefFull.inCombat.panel.def > fixedDefFull.outOfCombat.panel.def,
    "fixed-objective DEF fixture must include an active in-combat DEF buff",
)
const fixedDefCalculator = createInCombatPanelCalculator(catalog, fixedDefInput)
const fixedDefStatIds = ["defFlat", "defPct", "critRate", "critDmg", "lacerationDmg"]
const fixedDefTarget = fixedDefCalculator.compileDensePanelScoreTarget({
    statIds: fixedDefStatIds,
    setIds: [],
})
const fixedDefKernel = fixedDefTarget.compileForSetCounts(new Int16Array())
assert.equal(fixedDefKernel.scoreKernel, "compiled-objective-fixed-sets")
for (const statValues of [
    new Float64Array(fixedDefStatIds.length),
    new Float64Array([40, 5, 0, 0, 0]),
]) {
    const statTotals = new Map(
        fixedDefStatIds
            .map((stat, index) => [stat, Number(statValues[index] ?? 0)])
            .filter(([, value]) => value !== 0),
    )
    const mapSummary = fixedDefCalculator.scoreOnlyFromSummaryLegacy(statTotals, new Map())
    const compiledSummary = fixedDefCalculator.scoreOnlyFromSummary(statTotals, new Map())
    const denseSummary = fixedDefTarget.scoreDense(statValues, new Int16Array())
    const fixedSummary = fixedDefKernel.scoreScalar(statValues)
    const objectiveSummary = fixedDefKernel.scoreObjectiveScalar(statValues)
    const combinedSummary = fixedDefKernel.scoreCombinedScalar(statValues, null, null, null)
    for (const [label, summary] of [
        ["compiled", compiledSummary],
        ["dense", denseSummary],
        ["fixed", fixedSummary],
        ["objective", objectiveSummary],
        ["combined", combinedSummary],
    ]) {
        approx(summary.finalDamage, mapSummary.finalDamage, `fixed DEF ${label} parity`)
    }
}

const ordinary = calculateInCombatPanel(catalog, {
    agentId: "soldier_11",
    wEngineId: "zzz_wiki_223",
    wEngineModificationLevel: 1,
    coreSkillLevel: "F",
    driveDiscs: [],
    combatBuffs: {
        activeBuffIds: ["agent:soldier_11.corePassive"],
        manualStats: [{ stat: "critRate", value: 150, mode: "flat" }],
    },
    damage: {
        mode: "custom",
        events: [{
            id: "ordinary",
            kind: "direct",
            skillMultiplier: 100,
            damageElement: "fire",
            critMode: "expected",
            count: 1,
            stunned: true,
        }],
        selectedEventId: "ordinary",
    },
})
assert.equal(ordinary.damage.events[0].multipliers.critRate, 1, "ordinary CR remains capped at 100%")

console.log("sharp damage tests passed")
