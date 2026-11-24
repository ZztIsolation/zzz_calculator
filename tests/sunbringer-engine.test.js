import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { calculateInCombatPanel, loadCalculatorContext } from "../backend/calculator.js"
import { defaultWEngineIdForAgent } from "../core/shared-combat.js"

const catalog = await loadCalculatorContext(fileURLToPath(new URL("../", import.meta.url)))
const engine = catalog.wEnginesMap.get("dragonfire_mirage")
const buffId = "wEngine:dragonfire_mirage.self"

assert.equal(defaultWEngineIdForAgent(catalog.wEngines, "sunbringer", ""), engine.id)
assert.equal(engine.effect.teamBuff, null)
assert.equal(engine.level60.advancedStat.stat, "defPct")
assert.equal(engine.level60.advancedStat.value, 48)

function calculate(rank, { agentId = "claret", coverage = 1 } = {}) {
    // A second Armorer can equip the signature. Isolate its passive from character-specific effects.
    return calculateInCombatPanel(catalog, {
        agentId,
        wEngineId: engine.id,
        wEngineModificationLevel: rank,
        coreSkillLevel: "none",
        driveDiscs: [],
        combatBuffs: {
            activeBuffIds: [buffId],
            runtimeInputs: {
                [buffId]: {
                    effects: {
                        "dragonfire-fire-dmg": { coverage },
                        "dragonfire-fire-sharp-dmg": { coverage },
                    },
                },
            },
        },
        damage: {
            events: [
                { id: "fire-direct", kind: "direct", damageElement: "fire", skillMultiplier: 100, critMode: "nonCrit" },
                { id: "fire-sharp", kind: "sharp", damageElement: "fire", skillMultiplier: 100, critMode: "nonCrit" },
                { id: "electric-sharp", kind: "sharp", damageElement: "electric", skillMultiplier: 100, critMode: "nonCrit" },
            ],
        },
    })
}

const ranks = [
    [20, 20, 10],
    [22, 23, 11.5],
    [24, 26, 13],
    [26, 29, 14.5],
    [28, 32, 16],
]
const sourceVersion = engine.verification.sourceVersion
const source = JSON.parse(readFileSync(new URL(`../docs/sources/dragonfire-mirage-nanoka-${sourceVersion}.json`, import.meta.url), "utf8"))
assert.equal(source.id, engine.verification.sourceId)
for (const [index, [crit, fire, fireSharp]] of ranks.entries()) {
    const text = source.talents[index + 1].desc.replace(/<[^>]+>/g, "")
    assert.deepEqual([...text.matchAll(/([\d.]+)%/g)].map(match => Number(match[1])), [crit, fire, fireSharp])
    const result = calculate(index + 1)
    assert.deepEqual(result.outOfCombat.baseBreakdown.wEngine, { hp: 0, atk: 0, def: 446 })
    assert.equal(result.inCombat.buffTotals.critRate, crit / 100)
    const [direct, sharp, electric] = result.damage.events.map(event => event.multipliers)
    assert.equal(direct.dmg, 1 + fire / 100)
    assert.equal(sharp.damage, 1 + fire / 100)
    assert.equal(sharp.sharpDmg, 1 + fireSharp / 100)
    assert.equal(electric.damage, 1)
    assert.equal(electric.sharpDmg, 1)
}

const expired = calculate(5, { coverage: 0 })
assert.equal(expired.inCombat.buffTotals.critRate, 0.28)
assert.equal(expired.damage.events[1].multipliers.damage, 1)
assert.equal(expired.damage.events[1].multipliers.sharpDmg, 1)

const otherSpecialty = calculate(5, { agentId: "evelyn_chevalier" })
assert.equal(otherSpecialty.inCombat.buffTotals.critRate, 0)
assert.equal(otherSpecialty.damage.events[1].multipliers.damage, 1)
assert.equal(otherSpecialty.damage.events[1].multipliers.sharpDmg, 1)

console.log("Sunbringer signature W-Engine tests passed")
