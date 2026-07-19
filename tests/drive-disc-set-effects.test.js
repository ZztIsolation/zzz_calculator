import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    calculateInCombatPanel,
    createInCombatPanelCalculator,
    loadCalculatorContext,
} from "../backend/calculator.js"
import { optimizeDriveDiscs } from "../backend/driveDiscOptimizer.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalog = await loadCalculatorContext(rootDir)
const wEngineId = catalog.examples.yeShunguang.input.wEngineId

function approx(actual, expected, label) {
    assert.ok(Math.abs(Number(actual) - Number(expected)) < 1e-8, `${label}: expected ${expected}, got ${actual}`)
}

function discs(setId, count) {
    return Array.from({ length: count }, (_, index) => ({
        id: `${setId}-${index + 1}`,
        setId,
        partition: index + 1,
        mainStat: { stat: "atkFlat", value: 0, mode: "flat" },
        subStats: [],
    }))
}

function skillDamage(categoryId, moveId, rowId) {
    return {
        skillRef: {
            agentSkillId: "ye_shunguang",
            categoryId,
            moveId,
            rowId,
            level: 12,
        },
        target: { defense: 953 },
    }
}

function calculate({ setId, count, activeBuffIds = [], teammateDriveDiscSetIds = [], runtimeInputs = {}, damage }) {
    return calculateInCombatPanel(catalog, {
        agentId: "ye_shunguang",
        wEngineId,
        driveDiscs: discs(setId, count),
        combatBuffs: { activeBuffIds, teammateDriveDiscSetIds, runtimeInputs },
        damage,
    }, { round: false })
}

const dawnSet = catalog.driveDiscSetsMap.get("zzz_wiki_1552")
assert.equal(dawnSet.twoPiece.effects[0].value, 15)
assert.deepEqual(dawnSet.twoPiece.effects[0].target.skillTargets, [{ kind: "skillType", skillType: "basic" }])

const basicDamage = skillDamage("basic", "quick_sword", "hit_1")
const ultimateDamage = skillDamage("chain", "ultimate_cut_delusion_open_heaven", "damage")
const onePieceBasic = calculate({ setId: dawnSet.id, count: 1, damage: basicDamage })
const twoPieceBasic = calculate({ setId: dawnSet.id, count: 2, damage: basicDamage })
const twoPieceUltimate = calculate({ setId: dawnSet.id, count: 2, damage: ultimateDamage })
const twoPieceManual = calculate({
    setId: dawnSet.id,
    count: 2,
    damage: { skillMultiplier: 100, damageElement: "physical", target: { defense: 953 } },
})
approx(onePieceBasic.damage.multipliers.directDamageBonus, 0, "one Dawn Blossom piece")
approx(twoPieceBasic.damage.multipliers.directDamageBonus, 0.15, "two Dawn Blossom pieces on Basic Attack")
approx(twoPieceUltimate.damage.multipliers.directDamageBonus, 0, "Dawn Blossom two-piece on Ultimate")
approx(twoPieceManual.damage.multipliers.directDamageBonus, 0, "Dawn Blossom two-piece on manual multiplier")
assert.ok(twoPieceBasic.inCombat.activeEffects.some(effect => effect.key === `driveDisc2pc:${dawnSet.id}`))

const prepared = createInCombatPanelCalculator(catalog, {
    agentId: "ye_shunguang",
    wEngineId,
    driveDiscs: [],
    damage: basicDamage,
})
const preparedSummary = prepared.scoreOnlyFromSummary(new Map(), new Map([[dawnSet.id, 2]]))
approx(preparedSummary.finalDamage, twoPieceBasic.damage.finalDamage, "prepared Dawn Blossom two-piece score")
const dense = prepared.compileDensePanelScoreTarget({
    statIds: [],
    setIds: [dawnSet.id],
    setIndexById: new Map([[dawnSet.id, 0]]),
})
assert.ok(dense)
const denseSummary = dense.scoreDense([], Int16Array.from([2]))
approx(denseSummary.finalDamage, twoPieceBasic.damage.finalDamage, "dense Dawn Blossom two-piece score")
const denseFixed = dense.compileForSetCounts(Int16Array.from([2])).scoreScalar([])
approx(denseFixed.finalDamage, twoPieceBasic.damage.finalDamage, "fixed dense Dawn Blossom two-piece score")

function optimizerDisc(id, setId, partition) {
    const mainStats = {
        1: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
        2: { stat: "atkFlat", value: 316, mode: "flat", label: "攻击力" },
        3: { stat: "defFlat", value: 184, mode: "flat", label: "防御力" },
        4: { stat: "critRate", value: 24, mode: "pct", label: "暴击率" },
        5: { stat: "physicalDmg", value: 30, mode: "pct", label: "物理伤害加成" },
        6: { stat: "atkPct", value: 30, mode: "pct", label: "攻击力百分比" },
    }
    return {
        id,
        ownerId: "default",
        setId,
        setName: catalog.driveDiscSetsMap.get(setId)?.name?.zhCN ?? setId,
        partition,
        rarity: "S",
        level: 15,
        maxLevel: 15,
        locked: false,
        equippedBy: null,
        mainStat: mainStats[partition],
        subStats: [],
        source: { type: "test", sequence: partition },
    }
}

const optimizerFourSetId = "woodpecker_electro"
const optimizerStore = {
    version: 1,
    owners: [{ id: "default", label: "默认用户" }],
    imports: [],
    driveDiscLoadouts: [],
    driveDiscs: [optimizerFourSetId, dawnSet.id].flatMap(setId => (
        Array.from({ length: 6 }, (_, index) => optimizerDisc(`${setId}-${index + 1}`, setId, index + 1))
    )),
}
function optimizeDawn(damage, algorithm = "exact-super-bound") {
    return optimizeDriveDiscs(catalog, optimizerStore, {
        agentId: "ye_shunguang",
        wEngineId,
        combatBuffs: { activeBuffIds: [] },
        damage,
        settings: {
            algorithm,
            objective: "damage",
            fourPieceSetId: optimizerFourSetId,
            twoPieceSetId: dawnSet.id,
        },
    })
}
const optimizedBasic = optimizeDawn(basicDamage)
const optimizedBasicLegacy = optimizeDawn(basicDamage, "exact-legacy")
const optimizedUltimate = optimizeDawn(ultimateDamage)
assert.ok(optimizedBasic.results.length > 0, "Dawn Blossom optimizer fixture should produce results")
assert.deepEqual(
    optimizedBasic.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
    optimizedBasicLegacy.results.map(result => result.driveDiscs.map(item => item.id).join("|")),
)
approx(optimizedBasic.results[0].data.damage.multipliers.directDamageBonus, 0.15, "optimizer Dawn Blossom Basic Attack bonus")
approx(optimizedUltimate.results[0].data.damage.multipliers.directDamageBonus, 0, "optimizer Dawn Blossom Ultimate exclusion")

const dawnFourPieceIds = [`driveDisc4pc:${dawnSet.id}.self`]
const dawnAttack = calculate({ setId: dawnSet.id, count: 4, activeBuffIds: dawnFourPieceIds, damage: basicDamage })
approx(dawnAttack.damage.multipliers.directDamageBonus, 0.55, "Dawn Blossom full Basic Attack bonus")
const originalSpecialty = catalog.agentsMap.get("ye_shunguang").specialty
catalog.agentsMap.get("ye_shunguang").specialty = "support"
const dawnWrongSpecialty = calculate({ setId: dawnSet.id, count: 4, activeBuffIds: dawnFourPieceIds, damage: basicDamage })
catalog.agentsMap.get("ye_shunguang").specialty = originalSpecialty
approx(dawnWrongSpecialty.damage.multipliers.directDamageBonus, 0.35, "Dawn Blossom specialty-gated bonus")

const chaosId = "chaos_jazz"
const chaosBuffIds = [`driveDisc4pc:${chaosId}.self`]
const chaosEx = calculate({ setId: chaosId, count: 4, activeBuffIds: chaosBuffIds, damage: skillDamage("special", "ex_calm_waves", "damage") })
const chaosNormal = calculate({ setId: chaosId, count: 4, activeBuffIds: chaosBuffIds, damage: skillDamage("special", "draw_blue_waves", "damage") })
approx(chaosEx.damage.multipliers.directDamageBonus, 0.2, "Chaos Jazz EX Special bonus")
approx(chaosNormal.damage.multipliers.directDamageBonus, 0, "Chaos Jazz normal Special exclusion")
approx(chaosEx.inCombat.panel.fireDmg, chaosEx.outOfCombat.panel.fireDmg + 0.15, "Chaos Jazz Fire DMG")
approx(chaosEx.inCombat.panel.electricDmg, chaosEx.outOfCombat.panel.electricDmg + 0.15, "Chaos Jazz Electric DMG")

const protoId = "proto_punk"
const proto = calculate({
    setId: protoId,
    count: 4,
    activeBuffIds: [`driveDisc4pc:${protoId}.team`],
    teammateDriveDiscSetIds: [protoId],
})
approx(proto.inCombat.buffTotals.dmgBonus, 0.15, "Proto Punk exclusive team bonus")
assert.ok(proto.inCombat.ignoredEffects.some(effect => effect.reason === "exclusiveGroup" && effect.exclusiveGroup === "proto_punk_4pc_team_dmg"))

const astralId = "astral_voice"
const astral = calculate({
    setId: astralId,
    count: 4,
    activeBuffIds: [`driveDisc4pc:${astralId}.self`],
    runtimeInputs: {
        [`driveDisc4pc:${astralId}.self`]: {
            effects: {
                effect_astral_voice_4pc_anomaly_proficiency: { coverage: 0 },
            },
        },
    },
})
approx(astral.inCombat.panel.anomalyProficiency, astral.outOfCombat.panel.anomalyProficiency, "Astral Voice per-rule coverage")
approx(astral.inCombat.buffTotals.dmgBonus, 0.25, "Astral Voice independent DMG coverage")
const astralPartial = calculate({
    setId: astralId,
    count: 4,
    activeBuffIds: [`driveDisc4pc:${astralId}.self`],
    runtimeInputs: {
        [`driveDisc4pc:${astralId}.self`]: {
            effects: {
                effect_astral_voice_4pc_anomaly_proficiency: { coverage: 0.4 },
            },
        },
    },
})
approx(
    astralPartial.inCombat.panel.anomalyProficiency - astralPartial.outOfCombat.panel.anomalyProficiency,
    14.4,
    "Astral Voice partial per-rule coverage",
)

const shadowId = "shadow_harmony"
const shadow = calculate({
    setId: shadowId,
    count: 4,
    activeBuffIds: [`driveDisc4pc:${shadowId}.self`],
    runtimeInputs: {
        [`driveDisc4pc:${shadowId}.self`]: {
            effects: { effect_shadow_harmony_4pc_atk_pct: { stacks: 1 } },
        },
    },
})
approx(shadow.inCombat.panel.critRate - shadow.outOfCombat.panel.critRate, 0.04, "Shadow Harmony shared stacks")
approx(shadow.inCombat.panel.atk - shadow.outOfCombat.panel.atk, shadow.outOfCombat.base.atk * 0.04, "Shadow Harmony shared ATK stacks")

const expectedFourPieceRules = {
    astral_voice: 2,
    zzz_wiki_1552: 2,
    shadow_harmony: 2,
    chaos_jazz: 3,
    proto_punk: 1,
    chaotic_metal: 2,
    puffer_electro: 2,
    inferno_metal: 1,
    thunder_metal: 1,
}
for (const [setId, expectedCount] of Object.entries(expectedFourPieceRules)) {
    const set = catalog.driveDiscSetsMap.get(setId)
    const rules = [
        ...(set.fourPiece?.selfBuff?.effects ?? []),
        ...(set.fourPiece?.teamBuff?.effects ?? []),
    ]
    assert.equal(rules.length, expectedCount, `${setId} modeled four-piece rule count`)
}

const puffer = catalog.driveDiscSetsMap.get("puffer_electro")
const astralRules = catalog.driveDiscSetsMap.get(astralId).fourPiece.selfBuff.effects
assert.deepEqual(astralRules.map(rule => [rule.stat, rule.value, rule.durationSeconds, rule.coverage.default]), [
    ["anomalyProficiency", 36, 8, 1],
    ["dmgBonus", 25, 18, 1],
])

const dawnRules = dawnSet.fourPiece.selfBuff.effects
assert.deepEqual(dawnRules.map(rule => [rule.stat, rule.value, rule.durationSeconds ?? null]), [
    ["dmgBonus", 20, null],
    ["dmgBonus", 20, 25],
])
assert.deepEqual(dawnRules[0].target.skillTargets, [{ kind: "skillType", skillType: "basic" }])
assert.deepEqual(dawnRules[1].requirement, { specialty: "attack" })

const shadowRules = catalog.driveDiscSetsMap.get(shadowId).fourPiece.selfBuff.effects
assert.deepEqual(shadowRules.map(rule => [
    rule.stat,
    rule.valuePerStack,
    rule.maxStacks,
    rule.defaultStacks,
    rule.durationSeconds,
    rule.stackGroup,
    rule.basis ?? null,
]), [
    ["atkPct", 4, 3, 3, 15, "shadow_harmony_stacks", "baseAtk"],
    ["critRate", 4, 3, 3, 15, "shadow_harmony_stacks", null],
])

const chaosRules = catalog.driveDiscSetsMap.get(chaosId).fourPiece.selfBuff.effects
assert.deepEqual(chaosRules.slice(0, 2).map(rule => [rule.stat, rule.value]), [["fireDmg", 15], ["electricDmg", 15]])
assert.deepEqual(chaosRules[2].target.skillTargets, [
    { kind: "skillTag", skillTag: "exSpecial" },
    { kind: "skillTag", skillTag: "assistAttack" },
])
assert.deepEqual([chaosRules[2].value, chaosRules[2].durationSeconds, chaosRules[2].cooldownSeconds], [20, 5, 7.5])

const protoSet = catalog.driveDiscSetsMap.get(protoId)
assert.equal(protoSet.fourPiece.selfBuff, null)
assert.deepEqual([
    protoSet.fourPiece.teamBuff.effects[0].stat,
    protoSet.fourPiece.teamBuff.effects[0].value,
    protoSet.fourPiece.teamBuff.effects[0].durationSeconds,
    protoSet.fourPiece.teamBuff.exclusiveGroup,
], ["dmgBonus", 15, 10, "proto_punk_4pc_team_dmg"])

const chaoticRules = catalog.driveDiscSetsMap.get("chaotic_metal").fourPiece.selfBuff.effects
assert.deepEqual([chaoticRules[0].stat, chaoticRules[0].value], ["critDmg", 20])
assert.deepEqual([
    chaoticRules[1].stat,
    chaoticRules[1].valuePerStack,
    chaoticRules[1].maxStacks,
    chaoticRules[1].defaultStacks,
    chaoticRules[1].durationSeconds,
], ["critDmg", 5.5, 6, 6, 8])

assert.deepEqual(puffer.fourPiece.selfBuff.effects[0].target.skillTargets, [{ kind: "skillType", skillType: "ultimate" }])
assert.deepEqual([
    puffer.fourPiece.selfBuff.effects[0].value,
    puffer.fourPiece.selfBuff.effects[1].stat,
    puffer.fourPiece.selfBuff.effects[1].value,
    puffer.fourPiece.selfBuff.effects[1].basis,
    puffer.fourPiece.selfBuff.effects[1].durationSeconds,
], [20, "atkPct", 15, "baseAtk", 12])

const infernoRule = catalog.driveDiscSetsMap.get("inferno_metal").fourPiece.selfBuff.effects[0]
assert.deepEqual([infernoRule.stat, infernoRule.value, infernoRule.durationSeconds, infernoRule.coverage.default], ["critRate", 28, 8, 1])
const thunderRule = catalog.driveDiscSetsMap.get("thunder_metal").fourPiece.selfBuff.effects[0]
assert.deepEqual([thunderRule.stat, thunderRule.value, thunderRule.basis, thunderRule.coverage.default], ["atkPct", 28, "baseAtk", 1])

for (const setId of Object.keys(expectedFourPieceRules)) {
    const set = catalog.driveDiscSetsMap.get(setId)
    const rules = [...(set.fourPiece?.selfBuff?.effects ?? []), ...(set.fourPiece?.teamBuff?.effects ?? [])]
    for (const rule of rules.filter(item => item.condition)) {
        assert.ok(String(rule.condition).trim(), `${setId}.${rule.id} should preserve its trigger condition`)
    }
}

console.log("drive disc set effect tests passed")
