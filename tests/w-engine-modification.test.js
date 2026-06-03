import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    buildMeta,
    calculateInCombatPanel,
    calculateOutOfCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
    materializeWEngineForModificationLevel,
} from "../backend/calculator.js"
import {
    defaultRuntimeForBuff,
    materializeWEngineForModificationLevel as materializeFrontendWEngine,
    storedEffectRulesText,
} from "../frontend/shared-combat.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function cloneCatalog(value) {
    const next = clone(value)
    delete next.agentsMap
    delete next.wEnginesMap
    delete next.driveDiscSetsMap
    delete next.combatBuffsMap
    delete next.agentSkillsMap
    delete next.agentSkillsByAgentMap
    delete next.anomalyEffectsMap
    delete next.disorderEffectsMap
    return next
}

function approx(actual, expected, message) {
    assert.ok(
        Math.abs(Number(actual) - expected) < 1e-9,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

function wEngine(id, sourceCatalog = catalog) {
    return sourceCatalog.wEngines.find(item => item.id === id)
}

function effectRulesFor(engine, part) {
    return engine.effect?.[part]?.effects ?? []
}

function rule(engineId, part, ruleId) {
    return effectRulesFor(wEngine(engineId), part).find(item => item.id === ruleId)
}

const expectedModificationValues = {
    "demara_battery_mark_ii:selfBuff:effect_q4n8v2k1:value": [15, 17.5, 20, 22, 24],
    "demara_battery_mark_ii:selfBuff:effect_l7p3x9za:value": [18, 20.5, 23, 25, 27.5],
    "cloudcleave_radiance:selfBuff:effect_r6m2c8tw:value": [20, 22, 24, 26, 28],
    "cloudcleave_radiance:selfBuff:effect_v9k5n1qp:value": [25, 28.7, 32.5, 36.2, 40],
    "cloudcleave_radiance:selfBuff:effect_b3x7d4la:value": [25, 28.7, 32.5, 36.2, 40],
    "hailfall_star_palace:selfBuff:effect_hailfall_crit_dmg:value": [50, 57, 65, 72, 80],
    "hailfall_star_palace:selfBuff:effect_hailfall_ice_dmg:valuePerStack": [20, 23, 26, 29, 32],
    "tenfold_starforge:selfBuff:effect_tenfold_anomaly_mastery:value": [60, 69, 78, 87, 96],
    "tenfold_starforge:selfBuff:effect_tenfold_physical_dmg:valuePerStack": [20, 23, 26, 29, 32],
    "zzz_wiki_1826:teamBuff:effect_wiki_1826_team_dmg:valuePerStack": [12.5, 14.3, 16.1, 17.9, 20],
    "zzz_wiki_1826:teamBuff:effect_wiki_1826_team_atk:value": [10, 11.5, 13, 14.5, 16],
    "zzz_wiki_1753:teamBuff:effect_wiki_1753_team_atk:value": [10, 11.5, 13, 14.5, 16],
    "zzz_wiki_1753:teamBuff:effect_wiki_1753_team_hp:value": [10, 11.5, 13, 14.5, 16],
    "zzz_wiki_1753:teamBuff:effect_wiki_1753_team_crit_dmg:value": [30, 34.5, 39, 43.5, 48],
    "zzz_wiki_1689:selfBuff:effect_wiki_1689_self_daze:valuePerStack": [9, 10.3, 11.7, 13, 14.5],
    "zzz_wiki_1689:teamBuff:effect_wiki_1689_team_crit_dmg:value": [30, 34.5, 39, 43.5, 48],
    "zzz_wiki_486:teamBuff:effect_wiki_486_team_atk:valuePerStack": [2.5, 2.8, 3.2, 3.6, 4],
    "neon_fantasies:selfBuff:effect_8a81aef020:value": [90, 103, 117, 130, 145],
    "neon_fantasies:selfBuff:effect_neon_fantasies_self_ap_bonus:value": [60, 69, 78, 87, 96],
    "neon_fantasies:teamBuff:effect_8256ce4483:valuePerStack": [15, 17, 19.5, 21, 24],
}

for (const engine of catalog.wEngines) {
    assert.deepEqual(
        engine.modification,
        { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
        `${engine.id} should expose rank 1-5 metadata`,
    )
}

function assertNoLegacyModificationScaling(value, path = "catalog") {
    if (!value || typeof value !== "object") {
        return
    }
    assert.equal(value.modificationScaling, undefined, `${path} should not use legacy modificationScaling`)
    for (const [key, child] of Object.entries(value)) {
        if (Array.isArray(child)) {
            child.forEach((item, index) => assertNoLegacyModificationScaling(item, `${path}.${key}[${index}]`))
        } else {
            assertNoLegacyModificationScaling(child, `${path}.${key}`)
        }
    }
}

assertNoLegacyModificationScaling(catalog.wEngines, "wEngines")

for (const [key, values] of Object.entries(expectedModificationValues)) {
    const [engineId, part, ruleId, field] = key.split(":")
    const rawRule = rule(engineId, part, ruleId)
    assert.ok(rawRule, `${key} should exist`)
    assert.deepEqual(rawRule.modificationValues?.[field], values, `${key} should store rank values directly`)
    assert.equal(rawRule[field], values[0], `${key} should keep rank 1 as the stored base value`)

    for (let level = 1; level <= 5; level += 1) {
        const materialized = materializeWEngineForModificationLevel(wEngine(engineId), level)
        const scaledRule = effectRulesFor(materialized, part).find(item => item.id === ruleId)
        approx(scaledRule[field], values[level - 1], `${key} level ${level} should use stored rank value`)
        assert.equal(
            scaledRule[field === "value" ? "displayValue" : "displayValuePerStack"],
            values[level - 1],
            `${key} level ${level} should expose the same display value`,
        )
    }
}

const meta = buildMeta(catalog)
assert.deepEqual(
    meta.wEngines.find(item => item.id === "cloudcleave_radiance")?.modification,
    { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
    "GET /api/meta data should include W-Engine modification metadata",
)
assert.match(
    wEngine("cloudcleave_radiance").effect.description.zhCN,
    /20%\/22%\/24%\/26%\/28%/,
    "Chinese descriptions should use fixed slash-delimited rank values",
)

const cloudcleaveRank2 = materializeFrontendWEngine(wEngine("cloudcleave_radiance"), 2)
assert.equal(
    storedEffectRulesText(cloudcleaveRank2.effect.selfBuff, defaultRuntimeForBuff(cloudcleaveRank2.effect.selfBuff), meta),
    "物理抗性无视% +22%，通用伤害加成% +28.7%，暴击伤害% +28.7%",
    "Frontend buff previews should use official rounded display values",
)

const yeInput = {
    ...catalog.examples.yeShunguang.input,
    wEngineId: "cloudcleave_radiance",
    combatBuffs: {
        activeBuffIds: ["wEngine:cloudcleave_radiance.self"],
    },
}
const cloudRank1 = createInCombatPanelCalculator(catalog, {
    ...yeInput,
    wEngineModificationLevel: 1,
}).calculate(yeInput.driveDiscs, { round: false })
const cloudRank3 = createInCombatPanelCalculator(catalog, {
    ...yeInput,
    wEngineModificationLevel: 3,
}).calculate(yeInput.driveDiscs, { round: false })
const cloudRank4 = createInCombatPanelCalculator(catalog, {
    ...yeInput,
    wEngineModificationLevel: 4,
}).calculate(yeInput.driveDiscs, { round: false })
approx(cloudRank1.inCombat.buffTotals.physicalResIgnore, 0.2, "Cloudcleave rank 1 should keep old RES ignore")
approx(cloudRank3.inCombat.buffTotals.physicalResIgnore, 0.24, "Cloudcleave rank 3 should use exact RES ignore")
approx(cloudRank3.inCombat.buffTotals.dmgBonus, 0.325, "Cloudcleave rank 3 should use exact damage bonus")
approx(cloudRank3.inCombat.buffTotals.critDmg, cloudRank1.inCombat.buffTotals.critDmg + 0.075, "Cloudcleave rank 3 CRIT DMG should use stored rank value")
approx(cloudRank4.inCombat.buffTotals.dmgBonus, 0.362, "Cloudcleave rank 4 should use 36.2% instead of an equal-step 36.25%")
assert.equal(
    cloudRank3.inCombat.activeEffects[0].effects.find(item => item.id === "effect_v9k5n1qp").displayValue,
    32.5,
    "Active W-Engine effects should retain official display values alongside exact calculation values",
)

const cloudNoBuffRank1 = createInCombatPanelCalculator(catalog, {
    ...yeInput,
    combatBuffs: { activeBuffIds: [] },
    wEngineModificationLevel: 1,
}).calculate(yeInput.driveDiscs, { round: false })
const cloudNoBuffRank5 = createInCombatPanelCalculator(catalog, {
    ...yeInput,
    combatBuffs: { activeBuffIds: [] },
    wEngineModificationLevel: 5,
}).calculate(yeInput.driveDiscs, { round: false })
assert.deepEqual(cloudNoBuffRank5.inCombat.panel, cloudNoBuffRank1.inCombat.panel, "Rank should not affect calculation when W-Engine Buffs are inactive")
assert.deepEqual(
    calculateOutOfCombatPanel(catalog, { ...yeInput, wEngineModificationLevel: 5 }).panel,
    calculateOutOfCombatPanel(catalog, { ...yeInput, wEngineModificationLevel: 1 }).panel,
    "Rank should not affect out-of-combat W-Engine level 60 stats",
)

const hailfallRank5 = createInCombatPanelCalculator(catalog, {
    agentId: "hoshimi_miyabi",
    coreSkillLevel: "none",
    wEngineId: "hailfall_star_palace",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:hailfall_star_palace.self"],
    },
}).calculate([], { round: false })
approx(hailfallRank5.inCombat.buffTotals.critDmg, 0.8, "Hailfall rank 5 CRIT DMG should scale")
approx(hailfallRank5.inCombat.buffTotals.iceDmg, 0.64, "Hailfall rank 5 stacked Ice DMG should scale per stack")

const tenfoldRank4 = createInCombatPanelCalculator(catalog, {
    agentId: "alice_thymefield",
    coreSkillLevel: "none",
    wEngineId: "tenfold_starforge",
    wEngineModificationLevel: 4,
    combatBuffs: {
        activeBuffIds: ["wEngine:tenfold_starforge.self"],
    },
}).calculate([], { round: false })
approx(tenfoldRank4.inCombat.buffTotals.anomalyMasteryFlat, 87, "Tenfold rank 4 anomaly mastery should scale")
approx(tenfoldRank4.inCombat.buffTotals.physicalDmg, 0.58, "Tenfold rank 4 physical damage should scale per stack")

const stunRank5 = createInCombatPanelCalculator(catalog, {
    agentId: "anby_demara",
    coreSkillLevel: "none",
    wEngineId: "zzz_wiki_1689",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_1689.self", "wEngine:zzz_wiki_1689.team"],
    },
}).calculate([], { round: false })
approx(stunRank5.inCombat.buffTotals.impactPct, 0.435, "Yesterday's Call rank 5 Daze should scale per stack")
approx(stunRank5.inCombat.buffTotals.critDmg, 0.48, "Yesterday's Call rank 5 team CRIT DMG should scale")

const crossSpecialtyCurrentWEngineInput = {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "zzz_wiki_1689",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_1689.self", "wEngine:zzz_wiki_1689.team"],
    },
    damage: {
        skillMultiplier: 100,
        critMode: "nonCrit",
        target: {
            defense: 953,
            levelCoefficient: 794,
        },
    },
}
const crossSpecialtyCurrentWEngine = calculateInCombatPanel(catalog, crossSpecialtyCurrentWEngineInput)
assert.deepEqual(
    crossSpecialtyCurrentWEngine.inCombat.ignoredEffects.filter(effect => effect.reason === "specialtyMismatch"),
    [
        {
            key: "wEngine:zzz_wiki_1689.self",
            sourceType: "wEngine",
            reason: "specialtyMismatch",
        },
        {
            key: "wEngine:zzz_wiki_1689.team",
            sourceType: "wEngineTeam",
            reason: "specialtyMismatch",
        },
    ],
    "Current equipped cross-specialty W-Engine self and team Buffs should be ignored",
)
approx(crossSpecialtyCurrentWEngine.inCombat.buffTotals.impactPct, 0, "Cross-specialty current W-Engine self Buff should not apply")
approx(crossSpecialtyCurrentWEngine.inCombat.buffTotals.critDmg, 0, "Cross-specialty current W-Engine team Buff should not apply")

const crossSpecialtyPreparedCalculator = createInCombatPanelCalculator(catalog, crossSpecialtyCurrentWEngineInput)
const crossSpecialtyPrepared = crossSpecialtyPreparedCalculator.calculate([], { round: false })
assert.deepEqual(
    crossSpecialtyPrepared.inCombat.ignoredEffects.filter(effect => effect.reason === "specialtyMismatch"),
    crossSpecialtyCurrentWEngine.inCombat.ignoredEffects.filter(effect => effect.reason === "specialtyMismatch"),
    "Prepared calculator should report the same current W-Engine specialty mismatches",
)
approx(crossSpecialtyPrepared.inCombat.buffTotals.impactPct, 0, "Prepared current W-Engine self Buff should respect specialty mismatch")
approx(crossSpecialtyPrepared.inCombat.buffTotals.critDmg, 0, "Prepared current W-Engine team Buff should respect specialty mismatch")
const crossSpecialtyNoBuffScore = createInCombatPanelCalculator(catalog, {
    ...crossSpecialtyCurrentWEngineInput,
    combatBuffs: {
        activeBuffIds: [],
    },
}).scoreOnlyFromSummary(new Map(), new Map())
const crossSpecialtyBuffScore = crossSpecialtyPreparedCalculator.scoreOnlyFromSummary(new Map(), new Map())
approx(
    crossSpecialtyBuffScore.finalDamage,
    crossSpecialtyNoBuffScore.finalDamage,
    "Optimizer score path should ignore cross-specialty current W-Engine Buffs",
)

const supportCatalog = cloneCatalog(catalog)
supportCatalog.agents.find(item => item.id === "ye_shunguang").specialty = "support"
const supportRank5 = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "zzz_wiki_1826",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_1826.team"],
    },
}).calculate([], { round: false })
approx(supportRank5.inCombat.buffTotals.dmgBonus, 0.4, "Singing Rhapsody rank 5 team damage should scale per stack")
assert.ok(supportRank5.inCombat.panel.atk > supportRank5.outOfCombat.panel.atk, "Singing Rhapsody rank 5 team ATK should apply")

const externalCannonRank1 = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "cloudcleave_radiance",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
    },
}).calculate([], { round: false })
const externalCannonRank3 = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "cloudcleave_radiance",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
        wEngineTeamModificationLevels: {
            "wEngine:zzz_wiki_486.team": 3,
        },
    },
}).calculate([], { round: false })
const externalCannonRank5 = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "cloudcleave_radiance",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
        wEngineTeamModificationLevels: {
            "wEngine:zzz_wiki_486.team": 5,
        },
    },
}).calculate([], { round: false })
const externalCannonInvalidRank = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "cloudcleave_radiance",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
        wEngineTeamModificationLevels: {
            "wEngine:zzz_wiki_486.team": 99,
        },
    },
}).calculate([], { round: false })
approx(externalCannonRank1.inCombat.buffTotals.atkPctOutOfCombat, 0.1, "External Kaboom team Buff should default to rank 1")
approx(externalCannonRank3.inCombat.buffTotals.atkPctOutOfCombat, 0.128, "External Kaboom team Buff should use exact rank 3 value")
approx(externalCannonRank5.inCombat.buffTotals.atkPctOutOfCombat, 0.16, "External Kaboom team Buff should use rank 5 from its own map")
approx(externalCannonInvalidRank.inCombat.buffTotals.atkPctOutOfCombat, 0.1, "Invalid external W-Engine team rank should fall back to rank 1")

const externalTeamBuffForAttackAgent = calculateInCombatPanel(catalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "cloudcleave_radiance",
    wEngineModificationLevel: 1,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
    },
})
approx(
    externalTeamBuffForAttackAgent.inCombat.buffTotals.atkPctOutOfCombat,
    0.1,
    "External W-Engine team Buffs are treated as already validly triggered by their source wearer",
)
assert.equal(
    externalTeamBuffForAttackAgent.inCombat.ignoredEffects.some(effect => effect.key === "wEngine:zzz_wiki_486.team"),
    false,
    "External W-Engine team Buffs should not be checked against the current agent specialty",
)

const cannonRank5 = createInCombatPanelCalculator(supportCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "zzz_wiki_486",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_486.team"],
        wEngineTeamModificationLevels: {
            "wEngine:zzz_wiki_486.team": 1,
        },
    },
}).calculate([], { round: false })
approx(cannonRank5.inCombat.buffTotals.atkPctOutOfCombat, 0.16, "Current equipped Kaboom team ATK should keep the top-level rank despite an external map value")

const defenseCatalog = cloneCatalog(catalog)
defenseCatalog.agents.find(item => item.id === "ye_shunguang").specialty = "defense"
const defenseRank5 = createInCombatPanelCalculator(defenseCatalog, {
    agentId: "ye_shunguang",
    coreSkillLevel: "none",
    wEngineId: "zzz_wiki_1753",
    wEngineModificationLevel: 5,
    combatBuffs: {
        activeBuffIds: ["wEngine:zzz_wiki_1753.team"],
    },
}).calculate([], { round: false })
approx(defenseRank5.inCombat.buffTotals.atkPctOutOfCombat, 0.16, "Sweet Snow Bunny rank 5 team ATK should scale")
approx(defenseRank5.inCombat.buffTotals.hpPctOutOfCombat, 0.16, "Sweet Snow Bunny rank 5 team HP should scale")
approx(defenseRank5.inCombat.buffTotals.critDmg, 0.48, "Sweet Snow Bunny rank 5 team CRIT DMG should scale")

console.log("w-engine modification tests passed")
