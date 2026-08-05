import assert from "node:assert/strict"

import {
    LUMINESCENCE_CORE_ALPHA_BY_LEVEL,
    LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
    LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK,
    LUMINESCENCE_MOVE_MULTIPLIER_METADATA,
    LUMINESCENCE_MOVE_MULTIPLIERS_PERCENT,
    LUMINESCENCE_OBJECTIVE_KIND,
    LUMINESCENCE_SCORE_SUFFIX,
    LUMINESCENCE_SHARED_ATK_CAP,
    compareLuminescenceTeamScoreModels,
    evaluateConstantShareTeamScore,
    evaluateGeometricShareTeamScore,
    evaluateLuminescence,
    evaluateLuminescenceFactors,
    evaluateLuminescenceScore,
    evaluateReferenceCalibratedTeamScore,
    isLuminescenceScalarReady,
    isLuminescenceSettlement,
    luminescenceScalarOptimizationStatus,
    luminescenceScoreStatus,
    luminescenceStatDependencies,
    normalizeLuminescenceEvent,
    resolveLuminescenceAlpha,
} from "../core/luminescence.js"

function approx(actual, expected, message, epsilon = 1e-10) {
    assert.ok(
        Math.abs(Number(actual) - Number(expected)) <= epsilon,
        `${message}: expected ${expected}, got ${actual}`,
    )
}

assert.equal(isLuminescenceSettlement({ settlementType: "luminescence" }), true)
assert.equal(isLuminescenceSettlement({ anomalyVariant: "luminescence" }), false)
assert.equal(isLuminescenceSettlement({ settlementType: "release" }), false)

assert.deepEqual(LUMINESCENCE_CORE_ALPHA_BY_LEVEL, {
    initial: 0.001,
    A: 0.0012,
    B: 0.0014,
    C: 0.0015,
    D: 0.0016,
    E: 0.0018,
    F: 0.002,
})
for (const [level, alpha] of Object.entries(LUMINESCENCE_CORE_ALPHA_BY_LEVEL)) {
    approx(resolveLuminescenceAlpha(level), alpha, `${level} core alpha`)
    const evaluated = evaluateLuminescenceScore({
        teammateAttack: 0,
        danInitialAtk: 0,
        danAnomalyProficiency: 100,
        coreSkillLevel: level,
    })
    approx(evaluated.proficiencyMultiplier, 1 + alpha * 100, `${level} core multiplier`)
}
assert.equal(resolveLuminescenceAlpha("none"), 0.001)
assert.equal(resolveLuminescenceAlpha(0), 0.001)
assert.equal(resolveLuminescenceAlpha("core F"), 0.002)
assert.throws(() => resolveLuminescenceAlpha("G"), /Unsupported luminescence core level/)

// The source tables remain available for maintenance, but are deliberately absent from scoring.
for (const values of Object.values(LUMINESCENCE_MOVE_MULTIPLIERS_PERCENT)) {
    assert.equal(values.length, 16)
}
assert.equal(LUMINESCENCE_MOVE_MULTIPLIERS_PERCENT.jinghong[3], 230)
assert.equal(LUMINESCENCE_MOVE_MULTIPLIER_METADATA.jinghong.sourceDataWarning.level, 4)

const minimal = normalizeLuminescenceEvent({ id: "single-abloom" })
assert.deepEqual(minimal, {
    id: "single-abloom",
    kind: "anomaly",
    settlementType: "luminescence",
    teammateAttack: LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK,
    danInitialAtk: 0,
    danAnomalyProficiency: 0,
    coreSkillLevel: "F",
    cinemaLevel: 0,
    teamAnomalyDamageMultiplier: 1,
    luminescenceDamageMultiplier: 1,
    luminescenceDamageSharePct: LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
    anomalyAgentCount: 3,
    additionalAbilityActive: true,
    objectiveKind: LUMINESCENCE_OBJECTIVE_KIND,
    scoreSuffix: LUMINESCENCE_SCORE_SUFFIX,
})
assert.equal("records" in minimal, false)
assert.equal("moveRef" in minimal, false)
assert.equal("resistanceMode" in minimal, false)

const legacy = normalizeLuminescenceEvent({
    records: [
        { kind: "m1Entry", T: 9999 },
        { kind: "normal", T: 2650, k: 17, B: 23, sourceElement: "ether" },
        { kind: "normal", T: 3000 },
    ],
})
assert.equal(legacy.teammateAttack, 2650, "Only the first legacy normal record supplies T")
assert.equal("records" in legacy, false, "Legacy records must not survive normalization")
assert.equal(normalizeLuminescenceEvent({
    teammateAttack: 3100,
    records: [{ kind: "normal", T: 2650 }],
}).teammateAttack, 3100, "The new field takes precedence over legacy T")

assert.equal(normalizeLuminescenceEvent({}).teammateAttack, LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK)
assert.equal(
    normalizeLuminescenceEvent({ teammateAttack: undefined }).teammateAttack,
    LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK,
)
for (const teammateAttack of [null, "", "   ", false, true, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.throws(
        () => normalizeLuminescenceEvent({ teammateAttack }),
        /teammateAttack must be a finite non-negative number/,
    )
}
assert.equal(normalizeLuminescenceEvent({ teammateAttack: 0 }).teammateAttack, 0)
assert.throws(
    () => normalizeLuminescenceEvent({ records: [{ kind: "normal", T: -1 }] }),
    /legacy record T must be a finite non-negative number/,
)
for (const luminescenceDamageSharePct of [0, 12.5, 50, 100]) {
    assert.equal(
        normalizeLuminescenceEvent({ luminescenceDamageSharePct }).luminescenceDamageSharePct,
        luminescenceDamageSharePct,
    )
}
assert.equal(
    normalizeLuminescenceEvent({}).luminescenceDamageSharePct,
    LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
)
assert.equal(
    normalizeLuminescenceEvent({ luminescenceDamageSharePct: undefined }).luminescenceDamageSharePct,
    LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
)
for (const luminescenceDamageSharePct of [null, "", "   ", false, true, -1, 100.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
        () => normalizeLuminescenceEvent({ luminescenceDamageSharePct }),
        /luminescenceDamageSharePct must/,
    )
}
assert.equal(normalizeLuminescenceEvent({}).teamAnomalyDamageMultiplier, 1)
for (const teamAnomalyDamageMultiplier of [false, true, -1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
        () => normalizeLuminescenceEvent({ teamAnomalyDamageMultiplier }),
        /teamAnomalyDamageMultiplier must/,
    )
}
for (const luminescenceDamageMultiplier of [false, true, -1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
        () => normalizeLuminescenceEvent({ luminescenceDamageMultiplier }),
        /luminescenceDamageMultiplier must/,
    )
}
const normalizedLegacyReference = normalizeLuminescenceEvent({
    referenceAnomalyProficiency: -1,
    referenceLuminescenceDamageMultiplier: 0,
    referenceTeamAnomalyDamageMultiplier: 0,
})
assert.equal("referenceAnomalyProficiency" in normalizedLegacyReference, false)
assert.equal("referenceLuminescenceDamageMultiplier" in normalizedLegacyReference, false)
assert.equal("referenceTeamAnomalyDamageMultiplier" in normalizedLegacyReference, false)
assert.doesNotThrow(() => normalizeLuminescenceEvent({ referenceAnomalyProficiency: 642 }))
assert.doesNotThrow(() => normalizeLuminescenceEvent({ referenceLuminescenceDamageMultiplier: 1.51 }))

const screenshotSample = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    coreSkillLevel: "F",
    cinemaLevel: 0,
    referenceAnomalyProficiency: 170,
    referenceLuminescenceDamageMultiplier: 1,
})
approx(screenshotSample.sharedAttack, 578.8, "Screenshot shared attack")
approx(screenshotSample.attackPool, 3378.8, "Screenshot attack pool")
approx(screenshotSample.conversionCoefficient, 1.134, "Screenshot conversion coefficient")
approx(screenshotSample.proficiencyMultiplier, 1.34, "Screenshot core multiplier")
approx(screenshotSample.baseTeamFactor, 3831.5592, "Screenshot base team factor")
approx(screenshotSample.luminescenceExclusiveFactor, 1.34, "Screenshot exclusive factor")
approx(screenshotSample.commonDamageFactor, 3831.5592, "Screenshot common damage factor")
assert.equal(screenshotSample.otherAnomalyFactor, 1)
assert.equal(screenshotSample.luminescenceFactor, 1.34)
assert.equal(screenshotSample.luminescenceRelativeDamageMultiplier, 1)
assert.equal(screenshotSample.luminescenceRelativeFactor, 1.34)
approx(screenshotSample.exclusiveLuminescenceFactor, 1.34, "Screenshot named exclusive factor")
assert.equal(screenshotSample.weightedOtherAnomalyMultiplier, 1)
approx(screenshotSample.weightedExclusiveMultiplier, Math.sqrt(1.34), "Weighted Luminescence factor")
approx(screenshotSample.weightedTeamScoreMultiplier, Math.sqrt(1.34), "Weighted team multiplier")
approx(screenshotSample.score, 3831.5592 * Math.sqrt(1.34), "Geometric team score")
assert.equal(screenshotSample.score.toFixed(3), "4435.350")
assert.equal("referenceAnomalyProficiency" in screenshotSample, false)
assert.equal("referenceLuminescenceDamageMultiplier" in screenshotSample, false)
assert.equal(screenshotSample.modelKind, "geometricShare")
assert.equal(screenshotSample.objectiveKind, "luminescenceTeamScore")
assert.equal(screenshotSample.scoreSuffix, "× k")
assert.equal(screenshotSample.damage, screenshotSample.score, "damage remains a compatibility alias")
assert.equal(screenshotSample.finalDamage, screenshotSample.score, "finalDamage remains a compatibility alias")
assert.deepEqual(
    Object.keys(screenshotSample.formulaValues),
    [
        "teammateAttack",
        "danInitialAtk",
        "danAnomalyProficiency",
        "shareRate",
        "sharedAttack",
        "sharedAttackCap",
        "attackPool",
        "baseConversionCoefficient",
        "cinemaTwoBonus",
        "proficiencyConversionRate",
        "proficiencyConversionBonus",
        "conversionCoefficient",
        "coreAlpha",
        "proficiencyMultiplier",
        "teamAnomalyDamageMultiplier",
        "teamAnomalyDamageBonus",
        "luminescenceDamageMultiplier",
        "luminescenceDamageBonus",
        "luminescenceExclusiveDamageBonus",
        "luminescenceRelativeDamageMultiplier",
        "luminescenceDamageSharePct",
        "luminescenceDamageShare",
        "commonDamageFactor",
        "otherAnomalyFactor",
        "luminescenceFactor",
        "luminescenceRelativeFactor",
        "baseTeamFactor",
        "exclusiveLuminescenceFactor",
        "luminescenceExclusiveFactor",
        "weightedOtherAnomalyMultiplier",
        "weightedExclusiveMultiplier",
        "weightedTeamScoreMultiplier",
        "scoreBeforeLuminescenceDamageMultiplier",
    ],
)
assert.equal(screenshotSample.formulaValues.teammateAttack, 2800)
assert.equal(screenshotSample.formulaValues.danInitialAtk, 1447)
assert.equal(screenshotSample.formulaValues.danAnomalyProficiency, 170)
assert.equal(screenshotSample.formulaValues.shareRate, 0.4)
approx(screenshotSample.formulaValues.sharedAttack, 578.8, "Formula shared attack")
assert.equal(screenshotSample.formulaValues.sharedAttackCap, 1600)
approx(screenshotSample.formulaValues.attackPool, 3378.8, "Formula attack pool")
assert.equal(screenshotSample.formulaValues.baseConversionCoefficient, 1.1)
assert.equal(screenshotSample.formulaValues.cinemaTwoBonus, 0)
assert.equal(screenshotSample.formulaValues.proficiencyConversionRate, 0.0002)
approx(screenshotSample.formulaValues.proficiencyConversionBonus, 0.034, "Formula conversion bonus")
approx(screenshotSample.formulaValues.conversionCoefficient, 1.134, "Formula conversion coefficient")
assert.equal(screenshotSample.formulaValues.coreAlpha, 0.002)
assert.equal(screenshotSample.formulaValues.proficiencyMultiplier, 1.34)
assert.equal(screenshotSample.formulaValues.teamAnomalyDamageMultiplier, 1)
assert.equal(screenshotSample.formulaValues.teamAnomalyDamageBonus, 0)
assert.equal(screenshotSample.formulaValues.luminescenceDamageMultiplier, 1)
assert.equal(screenshotSample.formulaValues.luminescenceDamageBonus, 0)
assert.equal(screenshotSample.formulaValues.luminescenceExclusiveDamageBonus, 0)
assert.equal(screenshotSample.formulaValues.luminescenceRelativeDamageMultiplier, 1)
assert.equal(screenshotSample.formulaValues.luminescenceDamageSharePct, 50)
assert.equal(screenshotSample.formulaValues.luminescenceDamageShare, 0.5)
approx(screenshotSample.formulaValues.commonDamageFactor, 3831.5592, "Formula common factor")
assert.equal(screenshotSample.formulaValues.otherAnomalyFactor, 1)
assert.equal(screenshotSample.formulaValues.luminescenceFactor, 1.34)
assert.equal(screenshotSample.formulaValues.luminescenceRelativeFactor, 1.34)
approx(screenshotSample.formulaValues.exclusiveLuminescenceFactor, 1.34, "Formula exclusive factor")
assert.equal(screenshotSample.formulaValues.weightedOtherAnomalyMultiplier, 1)
approx(screenshotSample.formulaValues.weightedExclusiveMultiplier, Math.sqrt(1.34), "Formula weighted Luminescence factor")
approx(screenshotSample.formulaValues.weightedTeamScoreMultiplier, Math.sqrt(1.34), "Formula weighted team multiplier")
approx(screenshotSample.formulaValues.baseTeamFactor, 3831.5592, "Formula base team factor")
approx(screenshotSample.formulaValues.luminescenceExclusiveFactor, 1.34, "Formula exclusive factor")

const atCap = evaluateLuminescenceScore({
    teammateAttack: 1000,
    danInitialAtk: 4000,
    danAnomalyProficiency: 0,
})
const overCap = evaluateLuminescenceScore({
    teammateAttack: 1000,
    danInitialAtk: 9000,
    danAnomalyProficiency: 0,
})
assert.equal(atCap.sharedAttack, LUMINESCENCE_SHARED_ATK_CAP)
assert.equal(overCap.sharedAttack, LUMINESCENCE_SHARED_ATK_CAP)
assert.equal(overCap.score, atCap.score, "Attack above 4000 must not increase the shared attack")

const cinemaZero = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    cinemaLevel: 0,
})
const cinemaTwo = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    cinemaLevel: 2,
})
assert.equal(cinemaZero.cinemaTwoBonus, 0)
assert.equal(cinemaTwo.cinemaTwoBonus, 0.2)
approx(cinemaTwo.conversionCoefficient, cinemaZero.conversionCoefficient + 0.2, "Cinema 2 bonus")

const boosted = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    luminescenceDamageMultiplier: 1.15,
    referenceAnomalyProficiency: 170,
    referenceLuminescenceDamageMultiplier: 1,
})
approx(
    boosted.score,
    screenshotSample.score * Math.sqrt(1.15),
    "Candidate Luminescence multiplier uses its constant geometric weight",
)
assert.equal(boosted.luminescenceDamageMultiplier, 1.15)

const environmentSampleInput = {
    teammateAttack: 2800,
    danInitialAtk: 3959.14,
    danAnomalyProficiency: 612,
    coreSkillLevel: "F",
    cinemaLevel: 0,
    teamAnomalyDamageMultiplier: 1.50,
    luminescenceDamageMultiplier: 1.85,
    referenceAnomalyProficiency: 612,
    referenceLuminescenceDamageMultiplier: 1.85,
}
const environmentSample = evaluateLuminescenceScore(environmentSampleInput)
const environmentBase = (2800 + Math.min(0.40 * 3959.14, 1600))
    * (1.10 + 0.0002 * 612)
const environmentLuminescenceFactor = (1 + 0.002 * 612) * 1.85
approx(environmentSample.commonDamageFactor, environmentBase, "Environment sample B")
assert.equal(environmentSample.otherAnomalyFactor, 1.5)
approx(environmentSample.luminescenceFactor, environmentLuminescenceFactor, "Environment sample L")
approx(
    environmentSample.luminescenceRelativeDamageMultiplier,
    1.85 / 1.5,
    "Environment sample relative anomaly multiplier",
)
approx(
    environmentSample.luminescenceRelativeFactor,
    (1 + 0.002 * 612) * (1.85 / 1.5),
    "Environment sample relative Luminescence factor",
)
approx(environmentSample.teamAnomalyDamageBonus, 0.5, "Environment team bonus E")
approx(environmentSample.luminescenceDamageBonus, 0.85, "Environment total Luminescence bonus")
approx(environmentSample.luminescenceExclusiveDamageBonus, 0.35, "Candidate-exclusive bonus S")
assert.notEqual(environmentSample.luminescenceDamageMultiplier, 1.5 * 1.35)
approx(
    environmentSample.score,
    environmentBase * 1.5 * Math.sqrt((1 + 0.002 * 612) * 1.85 / 1.5),
    "The public environment multiplier remains fully visible in the score",
)
assert.equal(environmentSample.score.toFixed(3), "13312.165")
assert.equal("referenceOtherAnomalyFactor" in environmentSample, false)

const publicBuffSample = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 3950.16,
    danAnomalyProficiency: 642,
    coreSkillLevel: "F",
    cinemaLevel: 0,
    luminescenceDamageSharePct: 50,
    teamAnomalyDamageMultiplier: 1.16,
    luminescenceDamageMultiplier: 1.51,
})
const publicBuffBase = (2800 + Math.min(0.40 * 3950.16, 1600))
    * (1.10 + 0.0002 * 642)
const publicBuffExpected = publicBuffBase
    * 1.16
    * Math.sqrt((1 + 0.002 * 642) * (1.51 / 1.16))
approx(publicBuffSample.score, publicBuffExpected, "Public 1.16 multiplier is kept in full")
approx(
    publicBuffSample.luminescenceRelativeDamageMultiplier,
    1.51 / 1.16,
    "Luminescence keeps only its advantage relative to the public bucket",
)
const sameBuildWithoutPublicBuff = evaluateLuminescenceScore({
    ...publicBuffSample.event,
    teamAnomalyDamageMultiplier: 1,
    luminescenceDamageMultiplier: 1.35,
})
assert.ok(
    publicBuffSample.score > sameBuildWithoutPublicBuff.score,
    "Selecting a positive public anomaly buff must visibly increase the score",
)

for (const [share, expected] of [
    [0, environmentBase * 1.5],
    [50, environmentBase * 1.5 * Math.sqrt(environmentLuminescenceFactor / 1.5)],
    [100, environmentBase * environmentLuminescenceFactor],
]) {
    const evaluated = evaluateLuminescenceScore({
        ...environmentSampleInput,
        luminescenceDamageSharePct: share,
    })
    approx(evaluated.score, expected, `${share}% environment branch endpoint`)
}

const referenceAp = 642
const candidateAp = 651
const referenceLuminescenceDamageMultiplier = 1.51
const candidateCoreFactor = 1 + 0.002 * candidateAp
const calibratedCandidate = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 3950.16,
    danAnomalyProficiency: candidateAp,
    coreSkillLevel: "F",
    cinemaLevel: 0,
    luminescenceDamageSharePct: 50,
    luminescenceDamageMultiplier: referenceLuminescenceDamageMultiplier,
    referenceAnomalyProficiency: referenceAp,
    referenceLuminescenceDamageMultiplier,
})
const calibratedCandidateBase = (2800 + Math.min(0.40 * 3950.16, 1600))
    * (1.10 + 0.0002 * candidateAp)
const expectedGeometricMultiplier = Math.sqrt(candidateCoreFactor * 1.51)
approx(
    calibratedCandidate.weightedTeamScoreMultiplier,
    expectedGeometricMultiplier,
    "The formal score uses the candidate factor directly",
)
approx(
    calibratedCandidate.score,
    calibratedCandidateBase * expectedGeometricMultiplier,
    "AP candidate score",
)
assert.equal("referenceLuminescenceFactor" in calibratedCandidate, false)
assert.notEqual(
    calibratedCandidate.weightedTeamScoreMultiplier,
    1 + 0.002 * 0.5 * candidateAp,
    "The share is an exponent on the full Luminescence advantage, not the AP coefficient",
)

const changedPersonalBonus = evaluateLuminescenceScore({
    ...environmentSampleInput,
    luminescenceDamageMultiplier: 2,
})
approx(
    changedPersonalBonus.score,
    environmentBase * 1.5 * Math.sqrt((1 + 0.002 * 612) * 2 / 1.5),
    "Candidate-only anomaly bonus remains in the relative Luminescence advantage",
)

const explicitlyChangedOtherBranch = evaluateLuminescenceScore({
    ...environmentSampleInput,
    teamAnomalyDamageMultiplier: 1.8,
    referenceTeamAnomalyDamageMultiplier: 1.5,
})
approx(
    explicitlyChangedOtherBranch.score,
    environmentBase * 1.8 * Math.sqrt((1 + 0.002 * 612) * 1.85 / 1.8),
    "The production model includes the full public environment multiplier",
)
assert.equal("otherAnomalyRatio" in explicitlyChangedOtherBranch, false)

const zeroShare = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    luminescenceDamageMultiplier: 99,
    luminescenceDamageSharePct: 0,
    referenceAnomalyProficiency: 170,
    referenceLuminescenceDamageMultiplier: 1,
})
approx(zeroShare.score, screenshotSample.baseTeamFactor, "Zero share ignores exclusive factor")
const fullShare = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    luminescenceDamageMultiplier: 1.15,
    luminescenceDamageSharePct: 100,
    referenceAnomalyProficiency: 170,
    referenceLuminescenceDamageMultiplier: 1,
})
approx(
    fullShare.score,
    screenshotSample.baseTeamFactor * 1.34 * 1.15,
    "Full share uses the full Luminescence factor",
)

const factors = evaluateLuminescenceFactors({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
})
assert.equal("score" in factors, false, "Factor evaluation must not select a scoring model")
approx(factors.baseTeamFactor, screenshotSample.baseTeamFactor, "Decomposed base factor")
approx(factors.luminescenceExclusiveFactor, 1.34, "Decomposed exclusive factor")
assert.deepEqual(
    evaluateConstantShareTeamScore(factors.event),
    evaluateLuminescenceScore(factors.event),
    "The named production evaluator must match the public score evaluator",
)
const geometricScreenshotSample = evaluateGeometricShareTeamScore(factors.event)
approx(
    geometricScreenshotSample.score,
    factors.commonDamageFactor * Math.sqrt(factors.luminescenceFactor),
    "The named geometric evaluator is the formal score",
)
assert.equal(geometricScreenshotSample.modelKind, "geometricShare")
assert.deepEqual(geometricScreenshotSample, evaluateLuminescenceScore(factors.event))

assert.throws(
    () => evaluateReferenceCalibratedTeamScore(factors.event),
    /referenceLuminescenceFactor must be a finite non-negative number/,
)
assert.throws(
    () => evaluateReferenceCalibratedTeamScore(factors.event, 0),
    /referenceLuminescenceFactor must be greater than zero/,
)
const previousModel = evaluateReferenceCalibratedTeamScore(
    { ...factors.event, danAnomalyProficiency: 179 },
    factors.luminescenceExclusiveFactor,
)
const expectedPrevious = previousModel.baseTeamFactor
    * (0.5 + 0.5 * previousModel.luminescenceExclusiveFactor
        / factors.luminescenceExclusiveFactor)
approx(previousModel.score, expectedPrevious, "Reference-calibrated model")
assert.equal(previousModel.modelKind, "referenceCalibrated")
const previousAtReference = evaluateReferenceCalibratedTeamScore(
    factors.event,
    factors.exclusiveLuminescenceFactor,
)
approx(
    previousAtReference.score,
    factors.commonDamageFactor,
    "Reference-calibrated model is one at its reference",
)

const environmentReferenceFactors = evaluateLuminescenceFactors(environmentSampleInput)
const objectReferenceModel = evaluateReferenceCalibratedTeamScore(
    environmentSampleInput,
    {
        otherAnomalyFactor: environmentReferenceFactors.otherAnomalyFactor,
        luminescenceFactor: environmentReferenceFactors.luminescenceFactor,
    },
)
approx(
    objectReferenceModel.score,
    environmentReferenceFactors.commonDamageFactor,
    "Object reference factors calibrate both branches to one",
)
assert.equal(objectReferenceModel.referenceOtherAnomalyFactor, 1.5)
assert.equal(objectReferenceModel.referenceLuminescenceFactor, environmentLuminescenceFactor)
assert.equal(objectReferenceModel.otherAnomalyRatio, 1)
assert.equal(objectReferenceModel.luminescenceRatio, 1)
const symbolicObjectReferenceModel = evaluateReferenceCalibratedTeamScore(
    environmentSampleInput,
    { O0: 1.5, L0: environmentLuminescenceFactor },
)
approx(
    symbolicObjectReferenceModel.score,
    objectReferenceModel.score,
    "O0/L0 aliases resolve to the explicit reference-factor object",
)
for (const invalidReference of [
    {},
    { otherAnomalyFactor: 0, luminescenceFactor: 1 },
    { otherAnomalyFactor: 1, luminescenceFactor: 0 },
]) {
    assert.throws(
        () => evaluateReferenceCalibratedTeamScore(factors.event, invalidReference),
        /referenceFactors\.(?:otherAnomalyFactor|luminescenceFactor) must/,
    )
}

const comparison = compareLuminescenceTeamScoreModels(
    { ...factors.event, danAnomalyProficiency: 179 },
    factors.event,
)
const referenceComparison = compareLuminescenceTeamScoreModels(factors.event, factors.event)
assert.equal(referenceComparison.constantShareRelativeScore, 1)
assert.equal(referenceComparison.referenceCalibratedRelativeScore, 1)
assert.equal(referenceComparison.relativeDifference, 0)
const candidateFactors = evaluateLuminescenceFactors({ ...factors.event, danAnomalyProficiency: 179 })
const expectedBaseRatio = candidateFactors.baseTeamFactor / factors.baseTeamFactor
const expectedLuminescenceRatio = candidateFactors.luminescenceExclusiveFactor
    / factors.luminescenceExclusiveFactor
approx(comparison.baseRatio, expectedBaseRatio, "Comparison base ratio")
assert.equal(comparison.otherAnomalyRatio, 1)
approx(comparison.luminescenceRatio, expectedLuminescenceRatio, "Comparison exclusive ratio")
approx(
    comparison.constantShareRelativeScore,
    expectedBaseRatio * Math.sqrt(expectedLuminescenceRatio),
    "Normalized production model",
)
approx(
    comparison.referenceCalibratedRelativeScore,
    expectedBaseRatio * (0.5 + 0.5 * expectedLuminescenceRatio),
    "Normalized previous model",
)

const twoBranchComparison = compareLuminescenceTeamScoreModels({
    ...environmentSampleInput,
    teamAnomalyDamageMultiplier: 1.8,
    luminescenceDamageMultiplier: 2.15,
}, environmentSampleInput)
const twoBranchCandidate = evaluateLuminescenceFactors({
    ...environmentSampleInput,
    teamAnomalyDamageMultiplier: 1.8,
    luminescenceDamageMultiplier: 2.15,
})
const expectedOtherRatio = twoBranchCandidate.otherAnomalyFactor
    / environmentReferenceFactors.otherAnomalyFactor
const expectedTwoBranchLuminescenceRatio = twoBranchCandidate.luminescenceFactor
    / environmentReferenceFactors.luminescenceFactor
approx(twoBranchComparison.otherAnomalyRatio, expectedOtherRatio, "Comparison other-anomaly ratio")
approx(
    twoBranchComparison.constantShareRelativeScore,
    Math.sqrt(expectedOtherRatio) * Math.sqrt(expectedTwoBranchLuminescenceRatio),
    "Normalized two-branch production model",
)
approx(
    twoBranchComparison.referenceCalibratedRelativeScore,
    0.5 * expectedOtherRatio + 0.5 * expectedTwoBranchLuminescenceRatio,
    "Normalized two-branch previous model",
)
assert.throws(
    () => compareLuminescenceTeamScoreModels(factors.event, {
        teammateAttack: 0,
        danInitialAtk: 0,
        danAnomalyProficiency: 0,
    }),
    /Reference luminescence factors must be greater than zero/,
)

const rankingComparison = compareLuminescenceTeamScoreModels([
    {
        id: "balanced-reference",
        teammateAttack: 1000,
        danInitialAtk: 0,
        danAnomalyProficiency: 0,
        luminescenceDamageMultiplier: 1,
        luminescenceDamageSharePct: 50,
    },
    {
        id: "exclusive-heavy",
        teammateAttack: 410,
        danInitialAtk: 0,
        danAnomalyProficiency: 0,
        luminescenceDamageMultiplier: 4,
        luminescenceDamageSharePct: 50,
    },
], {
    teammateAttack: 1000,
    danInitialAtk: 0,
    danAnomalyProficiency: 0,
    luminescenceDamageMultiplier: 1,
    luminescenceDamageSharePct: 50,
})
assert.deepEqual(
    rankingComparison.constantShareRanking.map(candidate => candidate.candidateId),
    ["balanced-reference", "exclusive-heavy"],
)
assert.deepEqual(
    rankingComparison.referenceCalibratedRanking.map(candidate => candidate.candidateId),
    ["exclusive-heavy", "balanced-reference"],
)
assert.equal(rankingComparison.hasRankingDifference, true)
assert.deepEqual(
    rankingComparison.rankingDifferences,
    [
        {
            candidateIndex: 0,
            candidateId: "balanced-reference",
            constantShareRank: 1,
            referenceCalibratedRank: 2,
            rankDifference: -1,
        },
        {
            candidateIndex: 1,
            candidateId: "exclusive-heavy",
            constantShareRank: 2,
            referenceCalibratedRank: 1,
            rankDifference: 1,
        },
    ],
)
for (const candidate of rankingComparison.candidates) {
    assert.equal(Number.isFinite(candidate.constantShareRelativeScore), true)
    assert.equal(Number.isFinite(candidate.referenceCalibratedRelativeScore), true)
    assert.equal(Number.isFinite(candidate.differencePercent), true)
}
assert.throws(
    () => compareLuminescenceTeamScoreModels([
        { teammateAttack: 1000, luminescenceDamageSharePct: 30 },
        { teammateAttack: 1000, luminescenceDamageSharePct: 70 },
    ], { teammateAttack: 1000, luminescenceDamageSharePct: 30 }),
    /damage shares must match/,
)

const legacyNoise = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    k: 999,
    B: 888,
    fixedCoefficient: 777,
    originalBaseMultiplier: 666,
    moveRef: { moveId: "ultimate_chaotic_finale", skillLevel: 16 },
    m4MultiplierMode: "additivePoints",
    resistanceMode: "lumiflux",
    specialRecordBaseStrength: 123456,
    records: [{ kind: "normal", T: 1, k: 999, B: 999 }],
})
approx(legacyNoise.score, screenshotSample.score, "Legacy B, k and event-simulation fields must not affect score")

const fixedModel = evaluateLuminescenceScore({
    teammateAttack: 2800,
    danInitialAtk: 1447,
    danAnomalyProficiency: 170,
    anomalyAgentCount: 1,
    additionalAbilityActive: false,
})
approx(fixedModel.score, screenshotSample.score, "The model always assumes three anomaly agents and active additional ability")
assert.equal(fixedModel.event.anomalyAgentCount, 3)
assert.equal(fixedModel.event.additionalAbilityActive, true)

const status = luminescenceScoreStatus({ teammateAttack: 2800 })
assert.deepEqual(status, {
    scalarReady: true,
    objectiveKind: "luminescenceTeamScore",
    scoreSuffix: "× k",
    dependencies: [
        "teammateAttack",
        "danInitialAtk",
        "danAnomalyProficiency",
        "teamAnomalyDamageMultiplier",
        "luminescenceDamageMultiplier",
        "luminescenceDamageSharePct",
    ],
    reasons: [],
    warnings: [],
    teammateAttack: 2800,
})
assert.deepEqual(luminescenceScalarOptimizationStatus({ teammateAttack: 2800 }), status)
assert.deepEqual(luminescenceStatDependencies({ teammateAttack: 2800 }), status.dependencies)
assert.equal(isLuminescenceScalarReady({ cinemaLevel: 4, m4MultiplierMode: "unconfirmed" }), true)
const frozenStatus = luminescenceScalarOptimizationStatus({
    teammateAttack: 2800,
    referenceAnomalyProficiency: 170,
    referenceLuminescenceDamageMultiplier: 1,
})
assert.equal(frozenStatus.scalarReady, true)
assert.deepEqual(frozenStatus.reasons, [])
assert.deepEqual(frozenStatus.warnings, [])
assert.deepEqual(
    evaluateLuminescence({
        teammateAttack: 2800,
        danInitialAtk: 1447,
        danAnomalyProficiency: 170,
    }),
    evaluateLuminescenceScore({
        teammateAttack: 2800,
        danInitialAtk: 1447,
        danAnomalyProficiency: 170,
    }),
    "The legacy evaluator name must delegate to the score evaluator",
)

console.log("Luminescence formula tests passed.")
