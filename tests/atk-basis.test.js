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
const input = catalog.examples.yeShunguang.input

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

const outOfCombat = calculateOutOfCombatPanel(catalog, input)

assert.equal(outOfCombat.baseBreakdown.agent.atk, 863)
assert.equal(outOfCombat.baseBreakdown.wEngine.atk, 743)
assert.equal(outOfCombat.baseBreakdown.coreSkill.atk, 75)
assert.equal(outOfCombat.base.atk, 1681)
assert.equal(outOfCombat.breakdown.baseAtk.total, outOfCombat.base.atk)
approx(
    outOfCombat.breakdown.atkPanel.atkFromPct,
    outOfCombat.base.atk * outOfCombat.bonusTotals.atkPct,
    "Out-of-combat ATK% should scale from Base ATK",
)

const catalogWithAtkPercentEngine = cloneCatalog(catalog)
const cloudcleave = catalogWithAtkPercentEngine.wEngines.find(item => item.id === "cloudcleave_radiance")
cloudcleave.level60.advancedStat = {
    stat: "atkPct",
    value: 10,
    mode: "pct",
}

const outWithAtkPercentEngine = calculateOutOfCombatPanel(catalogWithAtkPercentEngine, input)
approx(
    outWithAtkPercentEngine.panel.atk - outOfCombat.panel.atk,
    outOfCombat.base.atk * 0.1,
    "W-Engine advanced ATK% should scale from Base ATK",
)

const baseAtkBuff = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["buff_m9c4t2z8qw"],
    },
})
const outOfCombatAtkBuff = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["buff_h2r7x5p1kd"],
    },
})

approx(
    baseAtkBuff.inCombat.panel.atk - baseAtkBuff.outOfCombat.panel.atk,
    outOfCombat.base.atk * 0.1,
    "10% baseAtk in-combat Buff should scale from Base ATK",
)
approx(
    outOfCombatAtkBuff.inCombat.panel.atk - outOfCombatAtkBuff.outOfCombat.panel.atk,
    outOfCombat.panel.atk * 0.1,
    "10% outOfCombatAtk in-combat Buff should scale from out-of-combat panel ATK",
)
assert.notEqual(baseAtkBuff.inCombat.panel.atk, outOfCombatAtkBuff.inCombat.panel.atk)
approx(
    baseAtkBuff.inCombat.breakdown.atkPanel.atkFromBasePct,
    outOfCombat.base.atk * 0.1,
    "In-combat breakdown should expose baseAtk contribution",
)
approx(
    outOfCombatAtkBuff.inCombat.breakdown.atkPanel.atkFromOutOfCombatPct,
    outOfCombat.panel.atk * 0.1,
    "In-combat breakdown should expose outOfCombatAtk contribution",
)

const withDefaultTeammateBasis = cloneCatalog(catalog)
withDefaultTeammateBasis.combatBuffs.push({
    id: "test.teammate.atk_pct_without_basis",
    sourceType: "teammate",
    scope: "inCombat",
    effects: [
        {
            id: "effect-1",
            type: "fixed",
            stat: "atkPct",
            value: 10,
            mode: "pct",
        },
    ],
})
const teammateDefault = calculateInCombatPanel(withDefaultTeammateBasis, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.teammate.atk_pct_without_basis"],
    },
})
approx(
    teammateDefault.inCombat.panel.atk - teammateDefault.outOfCombat.panel.atk,
    outOfCombat.panel.atk * 0.1,
    "Teammate ATK% without basis should default to outOfCombatAtk",
)

const withTeamWEngineBuff = cloneCatalog(catalog)
const teamBuffEngine = withTeamWEngineBuff.wEngines.find(item => item.id === input.wEngineId)
teamBuffEngine.effect.teamBuff = {
    scope: "inCombat",
    effects: [
        {
            id: "team_atk_pct",
            type: "fixed",
            stat: "atkPct",
            value: 10,
            mode: "pct",
        },
    ],
}
const teamWEngineBuff = calculateInCombatPanel(withTeamWEngineBuff, {
    ...input,
    combatBuffs: {
        activeBuffIds: [`wEngine:${input.wEngineId}.team`],
    },
})
approx(
    teamWEngineBuff.inCombat.panel.atk - teamWEngineBuff.outOfCombat.panel.atk,
    outOfCombat.panel.atk * 0.1,
    "Team W-Engine ATK% without basis should default to outOfCombatAtk",
)

const withMissingSelfBasis = cloneCatalog(catalog)
withMissingSelfBasis.combatBuffs.push({
    id: "test.self.atk_pct_without_basis",
    sourceType: "self",
    scope: "inCombat",
    effects: [
        {
            id: "effect-1",
            type: "fixed",
            stat: "atkPct",
            value: 10,
            mode: "pct",
        },
    ],
})
const missingSelfBasis = calculateInCombatPanel(withMissingSelfBasis, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.self.atk_pct_without_basis"],
    },
})
assert.deepEqual(
    missingSelfBasis.inCombat.ignoredEffects,
    [
        {
            key: "test.self.atk_pct_without_basis",
            sourceType: "self",
            reason: "missingAtkPctBasis",
            stat: "atkPct",
        },
    ],
)
approx(
    missingSelfBasis.inCombat.panel.atk,
    missingSelfBasis.outOfCombat.panel.atk,
    "Self ATK% without basis should be ignored instead of silently using the wrong basis",
)

const withCinemaBuff = cloneCatalog(catalog)
const cinemaAgent = withCinemaBuff.agents.find(agent => agent.id === input.agentId)
cinemaAgent.combatBuffs = {
    ...(cinemaAgent.combatBuffs ?? {}),
    cinemaBuffs: [
        {
            cinemaLevel: 1,
            cinemaName: { zhCN: "测试影画" },
            description: { zhCN: "攻击力提升 123 点。" },
            scope: "inCombat",
            defaultChecked: false,
            effects: [
                {
                    id: "effect-1",
                    type: "fixed",
                    stat: "atkFlat",
                    value: 123,
                    mode: "flat",
                },
            ],
        },
    ],
}
const inactiveCinemaBuff = calculateInCombatPanel(withCinemaBuff, {
    ...input,
    combatBuffs: {
        activeBuffIds: [],
    },
})
const activeCinemaBuff = calculateInCombatPanel(withCinemaBuff, {
    ...input,
    combatBuffs: {
        activeBuffIds: [`agent:${input.agentId}.cinema.1`],
    },
})
assert.equal(
    inactiveCinemaBuff.inCombat.activeEffects.some(effect => effect.key === `agent:${input.agentId}.cinema.1`),
    false,
    "Cinema Buff should not apply until its generated ID is active",
)
assert.equal(
    activeCinemaBuff.inCombat.activeEffects.some(effect => effect.key === `agent:${input.agentId}.cinema.1`),
    true,
    "Cinema Buff should apply through the generated activeBuffIds key",
)
approx(
    activeCinemaBuff.inCombat.panel.atk - inactiveCinemaBuff.inCombat.panel.atk,
    123,
    "Active cinema Buff should add its modeled effect to the in-combat panel",
)

const fourPiece = calculateInCombatPanel(catalog, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["driveDisc4pc:scanner-set-fcf8ae93d798"],
    },
})
const fourPieceAtkPctRule = catalog.driveDiscSets
    .find(item => item.id === "scanner-set-fcf8ae93d798")
    ?.fourPiece
    ?.selfBuff
    ?.effects
    ?.find(item => item.stat === "atkPct")
const fourPieceAtkBasis = fourPieceAtkPctRule?.basis
const fourPieceAtkBreakdown = fourPiece.inCombat.breakdown.atkPanel
const fourPieceAtkContribution = fourPieceAtkBasis === "outOfCombatAtk"
    ? fourPieceAtkBreakdown.atkFromOutOfCombatPct
    : fourPieceAtkBreakdown.atkFromBasePct
const fourPieceExpectedBasisValue = fourPieceAtkBasis === "outOfCombatAtk"
    ? outOfCombat.panel.atk
    : outOfCombat.base.atk
approx(
    fourPieceAtkContribution,
    fourPieceExpectedBasisValue * 0.1,
    "Equipped 4-piece in-combat ATK% should use its explicit basis",
)

const withLegacyFourPieceShape = cloneCatalog(catalog)
const legacyFourPieceSet = withLegacyFourPieceShape.driveDiscSets.find(item => item.id === "scanner-set-fcf8ae93d798")
legacyFourPieceSet.fourPiece = {
    condition: legacyFourPieceSet.fourPiece.selfBuff.condition,
    effects: legacyFourPieceSet.fourPiece.selfBuff.effects,
    effectText: legacyFourPieceSet.fourPiece.effectText,
}
const legacyFourPiece = calculateInCombatPanel(withLegacyFourPieceShape, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["driveDisc4pc:scanner-set-fcf8ae93d798"],
    },
})
approx(
    legacyFourPiece.inCombat.panel.atk,
    fourPiece.inCombat.panel.atk,
    "Legacy fourPiece.effects should still be treated as selfBuff",
)

const missingFourPieceCount = calculateInCombatPanel(catalog, {
    ...input,
    driveDiscs: input.driveDiscs.filter(disc => disc.setId !== "scanner-set-fcf8ae93d798"),
    combatBuffs: {
        activeBuffIds: ["driveDisc4pc:scanner-set-fcf8ae93d798.self"],
    },
})
assert.deepEqual(
    missingFourPieceCount.inCombat.ignoredEffects,
    [
        {
            key: "driveDisc4pc:scanner-set-fcf8ae93d798.self",
            sourceType: "driveDisc4pc",
            reason: "notEquipped4pc",
        },
    ],
)

const withTeamDriveDiscBuff = cloneCatalog(catalog)
const teamDriveDiscSet = withTeamDriveDiscBuff.driveDiscSets.find(item => item.id === "scanner-set-fcf8ae93d798")
teamDriveDiscSet.fourPiece.teamBuff = {
    effects: [
        {
            id: "team_atk_pct",
            type: "fixed",
            stat: "atkPct",
            value: 10,
            mode: "pct",
        },
    ],
}
const teamDriveDiscBuff = calculateInCombatPanel(withTeamDriveDiscBuff, {
    ...input,
    driveDiscs: input.driveDiscs.filter(disc => disc.setId !== "scanner-set-fcf8ae93d798"),
    combatBuffs: {
        teammateDriveDiscSetIds: ["scanner-set-fcf8ae93d798"],
    },
})
approx(
    teamDriveDiscBuff.inCombat.panel.atk - teamDriveDiscBuff.outOfCombat.panel.atk,
    teamDriveDiscBuff.outOfCombat.panel.atk * 0.1,
    "Team Drive Disc 4-piece ATK% without basis should default to outOfCombatAtk and not require current equipment",
)
assert.ok(
    teamDriveDiscBuff.inCombat.activeEffects.some(effect =>
        effect.key === "teammateDriveDisc4pc:1:scanner-set-fcf8ae93d798"
        && effect.sourceType === "driveDisc4pcTeam"
    ),
    "Team Drive Disc 4-piece Buff should be recorded as an active teammate effect",
)

const withRuntimeBuffs = cloneCatalog(catalog)
withRuntimeBuffs.combatBuffs.push(
    {
        id: "test.runtime.derived_atk_cap",
        sourceType: "teammate",
        scope: "inCombat",
        coverage: {
            default: 1,
            min: 0,
            max: 1,
            step: 0.1,
        },
        effects: [
            {
                id: "atk_from_source",
                type: "derived",
                stat: "atkFlat",
                mode: "flat",
                defaultSourceValue: 3500,
                ratio: 30,
                cap: 1050,
            },
        ],
    },
    {
        id: "test.runtime.stacked_atk_pct",
        sourceType: "teammate",
        scope: "inCombat",
        effects: [
            {
                id: "atk_stacks",
                type: "stacked",
                stat: "atkPct",
                valuePerStack: 6,
                mode: "pct",
                basis: "outOfCombatAtk",
                maxStacks: 3,
                defaultStacks: 3,
            },
        ],
    },
    {
        id: "test.runtime.internal_impact_pct",
        sourceType: "self",
        scope: "inCombat",
        effects: [
            {
                id: "impact_pct",
                type: "fixed",
                stat: "impactPct",
                value: 10,
                mode: "pct",
            },
        ],
    },
)

const derivedBelowCap = calculateInCombatPanel(withRuntimeBuffs, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.runtime.derived_atk_cap"],
        runtimeInputs: {
            "test.runtime.derived_atk_cap": {
                coverage: 1,
                effects: {
                    atk_from_source: {
                        sourceValue: 3000,
                    },
                },
            },
        },
    },
})
approx(
    derivedBelowCap.inCombat.panel.atk - derivedBelowCap.outOfCombat.panel.atk,
    900,
    "Derived Buff should convert source stat by ratio before adding flat ATK",
)

const derivedCappedWithCoverage = calculateInCombatPanel(withRuntimeBuffs, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.runtime.derived_atk_cap"],
        runtimeInputs: {
            "test.runtime.derived_atk_cap": {
                coverage: 0.5,
                effects: {
                    atk_from_source: {
                        sourceValue: 4000,
                    },
                },
            },
        },
    },
})
approx(
    derivedCappedWithCoverage.inCombat.panel.atk - derivedCappedWithCoverage.outOfCombat.panel.atk,
    525,
    "Derived Buff should apply cap before coverage",
)

const stackedTwoLayers = calculateInCombatPanel(withRuntimeBuffs, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.runtime.stacked_atk_pct"],
        runtimeInputs: {
            "test.runtime.stacked_atk_pct": {
                effects: {
                    atk_stacks: {
                        stacks: 2,
                    },
                },
            },
        },
    },
})
approx(
    stackedTwoLayers.inCombat.panel.atk - stackedTwoLayers.outOfCombat.panel.atk,
    outOfCombat.panel.atk * 0.12,
    "Stacked percentage Buff should multiply value per stack by selected stacks",
)

const internalImpactPct = calculateInCombatPanel(withRuntimeBuffs, {
    ...input,
    combatBuffs: {
        activeBuffIds: ["test.runtime.internal_impact_pct"],
    },
})
approx(
    internalImpactPct.inCombat.panel.impact - internalImpactPct.outOfCombat.panel.impact,
    internalImpactPct.outOfCombat.panel.impact * 0.1,
    "Internal maintenance stat keys should map to combat bonus totals",
)

console.log("atk-basis tests passed")
