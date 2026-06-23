import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    calculateOutOfCombatPanel,
    loadCalculatorContext,
} from "../backend/calculator.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

const STORED_PERCENT_LIMITS = {
    hpPct: 100,
    atkPct: 100,
    defPct: 100,
    critRate: 100,
    critDmg: 300,
    impact: 100,
    impactPct: 100,
    anomalyMastery: 100,
    energyRegen: 200,
    energyRegenPct: 100,
    penRatio: 100,
    physicalResIgnore: 100,
    fireResIgnore: 100,
    iceResIgnore: 100,
    electricResIgnore: 100,
    etherResIgnore: 100,
    windResIgnore: 100,
    dmgBonus: 300,
    physicalDmg: 300,
    fireDmg: 300,
    iceDmg: 300,
    electricDmg: 300,
    etherDmg: 300,
    windDmg: 300,
    enemyDefReduction: 100,
    enemyResReduction: 100,
    enemyPhysicalResReduction: 100,
    enemyFireResReduction: 100,
    enemyIceResReduction: 100,
    enemyElectricResReduction: 100,
    enemyEtherResReduction: 100,
    enemyWindResReduction: 100,
}

const PANEL_PERCENT_LIMITS = {
    critRate: 2,
    critDmg: 5,
    energyRegen: 3,
    penRatio: 2,
    physicalResIgnore: 2,
    fireResIgnore: 2,
    iceResIgnore: 2,
    electricResIgnore: 2,
    etherResIgnore: 2,
    windResIgnore: 2,
    dmgBonus: 5,
    physicalDmg: 5,
    fireDmg: 5,
    iceDmg: 5,
    electricDmg: 5,
    etherDmg: 5,
    windDmg: 5,
    enemyDefReduction: 2,
    enemyResReduction: 2,
    enemyPhysicalResReduction: 2,
    enemyFireResReduction: 2,
    enemyIceResReduction: 2,
    enemyElectricResReduction: 2,
    enemyEtherResReduction: 2,
    enemyWindResReduction: 2,
}

function visit(value, pathParts, callback) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, [...pathParts, index], callback))
        return
    }

    if (!value || typeof value !== "object") {
        return
    }

    callback(value, pathParts)
    Object.entries(value).forEach(([key, child]) => visit(child, [...pathParts, key], callback))
}

function assertStoredPercentValues(sourceName, source) {
    const violations = []
    visit(source, [sourceName], (item, pathParts) => {
        if (typeof item.stat !== "string" || !Object.hasOwn(STORED_PERCENT_LIMITS, item.stat)) {
            return
        }

        const value = Number(item.value ?? 0)
        const limit = STORED_PERCENT_LIMITS[item.stat]
        if (Number.isFinite(value) && Math.abs(value) > limit) {
            violations.push(`${pathParts.join(".")} ${item.stat}=${value}, expected stored percent <= ${limit}`)
        }
    })

    assert.deepEqual(violations, [])
}

function assertPanelPercentValues(label, panel) {
    const violations = Object.entries(PANEL_PERCENT_LIMITS)
        .filter(([key, limit]) => Number.isFinite(Number(panel[key])) && Math.abs(Number(panel[key])) > limit)
        .map(([key, limit]) => `${label}.${key}=${panel[key]}, expected calculated fraction <= ${limit}`)

    assert.deepEqual(violations, [])
}

assertStoredPercentValues("agents", catalog.agents)
assertStoredPercentValues("wEngines", catalog.wEngines)
assertStoredPercentValues("driveDiscSets", catalog.driveDiscSets)
assertStoredPercentValues("combatBuffs", catalog.combatBuffs)

for (const [name, example] of Object.entries(catalog.examples ?? {})) {
    const outOfCombat = calculateOutOfCombatPanel(catalog, example.input)
    assertPanelPercentValues(`${name}.outOfCombat.panel`, outOfCombat.panel)
    assertPanelPercentValues(`${name}.outOfCombat.bonusTotals`, outOfCombat.bonusTotals)

    const inCombat = calculateInCombatPanel(catalog, example.input)
    assertPanelPercentValues(`${name}.inCombat.panel`, inCombat.inCombat.panel)
    assertPanelPercentValues(`${name}.inCombat.buffTotals`, inCombat.inCombat.buffTotals)
}

console.log("percent sanity tests passed")
