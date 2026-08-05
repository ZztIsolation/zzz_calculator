export const LUMINESCENCE_SETTLEMENT_TYPE = "luminescence"
export const LUMINESCENCE_OBJECTIVE_KIND = "luminescenceTeamScore"
export const LUMINESCENCE_SCORE_SUFFIX = "× k"
export const LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK = 2800
export const LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT = 50
export const LUMINESCENCE_SHARE_RATE = 0.40
export const LUMINESCENCE_SHARED_ATK_CAP = 1600

export const LUMINESCENCE_CORE_ALPHA_BY_LEVEL = Object.freeze({
    initial: 0.001,
    A: 0.0012,
    B: 0.0014,
    C: 0.0015,
    D: 0.0016,
    E: 0.0018,
    F: 0.002,
})

// The official move tables remain queryable as source data, but move multipliers are part of k
// and never participate in the single-Luminescence optimization score.
export const LUMINESCENCE_MOVE_IDS = Object.freeze({
    CHUIHONG: "chuihong",
    JINGHONG: "jinghong",
    HUAYULUNWU: "huayulunwu",
    LIAOLUANZHONGMU: "liaoluanzhongmu",
})

export const LUMINESCENCE_MOVE_REFS = Object.freeze({
    [LUMINESCENCE_MOVE_IDS.CHUIHONG]: "basic_vertical_rainbow",
    [LUMINESCENCE_MOVE_IDS.JINGHONG]: "basic_startled_swan",
    [LUMINESCENCE_MOVE_IDS.HUAYULUNWU]: "assist_flower_feather_round_dance",
    [LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU]: "ultimate_chaotic_finale",
})

export const LUMINESCENCE_MOVE_MULTIPLIERS_PERCENT = Object.freeze({
    [LUMINESCENCE_MOVE_IDS.CHUIHONG]: Object.freeze([
        105, 110, 115, 120, 125, 130, 135, 140,
        145, 150, 155, 160, 165, 170, 175, 180,
    ]),
    [LUMINESCENCE_MOVE_IDS.JINGHONG]: Object.freeze([
        210, 220, 230, 230, 250, 260, 270, 280,
        290, 300, 310, 320, 330, 340, 350, 360,
    ]),
    [LUMINESCENCE_MOVE_IDS.HUAYULUNWU]: Object.freeze([
        210, 220, 230, 240, 250, 260, 270, 280,
        290, 300, 310, 320, 330, 340, 350, 360,
    ]),
    [LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU]: Object.freeze([
        220.5, 231, 241.5, 252, 262.5, 273, 283.5, 294,
        304.5, 315, 325.5, 336, 346.5, 357, 367.5, 378,
    ]),
})

const JINGHONG_LEVEL_FOUR_WARNING = Object.freeze({
    code: "luminescence.source.jinghongLv4",
    level: 4,
    valuePercent: 230,
    message: "The official source currently lists Jinghong level 4 as 230%, duplicating level 3.",
})

export const LUMINESCENCE_MOVE_MULTIPLIER_METADATA = Object.freeze({
    [LUMINESCENCE_MOVE_IDS.CHUIHONG]: Object.freeze({
        sourceDataWarning: null,
        sourceDataWarnings: Object.freeze([]),
    }),
    [LUMINESCENCE_MOVE_IDS.JINGHONG]: Object.freeze({
        sourceDataWarning: JINGHONG_LEVEL_FOUR_WARNING,
        sourceDataWarnings: Object.freeze([JINGHONG_LEVEL_FOUR_WARNING]),
    }),
    [LUMINESCENCE_MOVE_IDS.HUAYULUNWU]: Object.freeze({
        sourceDataWarning: null,
        sourceDataWarnings: Object.freeze([]),
    }),
    [LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU]: Object.freeze({
        sourceDataWarning: null,
        sourceDataWarnings: Object.freeze([]),
    }),
})

const MOVE_ID_ALIASES = new Map([
    ["chuihong", LUMINESCENCE_MOVE_IDS.CHUIHONG],
    ["basicverticalrainbow", LUMINESCENCE_MOVE_IDS.CHUIHONG],
    ["normalattackchuihong", LUMINESCENCE_MOVE_IDS.CHUIHONG],
    ["垂虹", LUMINESCENCE_MOVE_IDS.CHUIHONG],
    ["普通攻击垂虹", LUMINESCENCE_MOVE_IDS.CHUIHONG],
    ["jinghong", LUMINESCENCE_MOVE_IDS.JINGHONG],
    ["basicstartledswan", LUMINESCENCE_MOVE_IDS.JINGHONG],
    ["normalattackjinghong", LUMINESCENCE_MOVE_IDS.JINGHONG],
    ["惊鸿", LUMINESCENCE_MOVE_IDS.JINGHONG],
    ["普通攻击惊鸿", LUMINESCENCE_MOVE_IDS.JINGHONG],
    ["huayulunwu", LUMINESCENCE_MOVE_IDS.HUAYULUNWU],
    ["assistflowerfeatherrounddance", LUMINESCENCE_MOVE_IDS.HUAYULUNWU],
    ["supporthuayulunwu", LUMINESCENCE_MOVE_IDS.HUAYULUNWU],
    ["花羽轮舞", LUMINESCENCE_MOVE_IDS.HUAYULUNWU],
    ["支援技花羽轮舞", LUMINESCENCE_MOVE_IDS.HUAYULUNWU],
    ["liaoluanzhongmu", LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU],
    ["ultimatechaoticfinale", LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU],
    ["ultimateliaoluanzhongmu", LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU],
    ["缭乱终幕", LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU],
    ["终结技缭乱终幕", LUMINESCENCE_MOVE_IDS.LIAOLUANZHONGMU],
])

const SCORE_DEPENDENCIES = Object.freeze([
    "teammateAttack",
    "danInitialAtk",
    "danAnomalyProficiency",
    "teamAnomalyDamageMultiplier",
    "luminescenceDamageMultiplier",
    "luminescenceDamageSharePct",
])

function normalizedAlias(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_:：-]+/g, "")
}

function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key)
}

function finiteNonNegative(value, fallback, label) {
    if (typeof value === "boolean") {
        throw new Error(`${label} must be a finite non-negative number.`)
    }
    const missing = value === undefined
        || value === null
        || (typeof value === "string" && !value.trim())
    if (missing && fallback === undefined) {
        throw new Error(`${label} must be a finite non-negative number.`)
    }
    const candidate = missing ? fallback : value
    const numeric = Number(candidate)
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error(`${label} must be a finite non-negative number.`)
    }
    return numeric
}

function finitePercentage(value, fallback, label) {
    const numeric = finiteNonNegative(value, fallback, label)
    if (numeric > 100) {
        throw new Error(`${label} must be between 0 and 100.`)
    }
    return numeric
}

function finitePositive(value, label) {
    const numeric = finiteNonNegative(value, undefined, label)
    if (numeric <= 0) {
        throw new Error(`${label} must be greater than zero.`)
    }
    return numeric
}

function boundedCinemaLevel(value) {
    const numeric = Number(value ?? 0)
    if (!Number.isFinite(numeric)) {
        throw new Error("cinemaLevel must be a finite number.")
    }
    return Math.max(0, Math.min(6, Math.trunc(numeric)))
}

function isLegacyNormalRecord(record) {
    const kind = normalizedAlias(record?.kind ?? record?.type ?? "normal")
    return kind === "normal" || kind === "ordinary"
}

function resolveTeammateAttack(event) {
    const hasExplicitTeammateAttack = hasOwn(event, "teammateAttack")
        && event.teammateAttack !== undefined
    if (hasExplicitTeammateAttack) {
        return finiteNonNegative(event.teammateAttack, undefined, "teammateAttack")
    }

    const legacyRecord = Array.isArray(event.records)
        ? event.records.find(isLegacyNormalRecord)
        : null
    if (legacyRecord) {
        if (hasOwn(legacyRecord, "T")) {
            return finiteNonNegative(legacyRecord.T, undefined, "legacy record T")
        }
        if (hasOwn(legacyRecord, "teammateAttack")) {
            return finiteNonNegative(legacyRecord.teammateAttack, undefined, "legacy record teammateAttack")
        }
        if (hasOwn(legacyRecord, "teammateAtk")) {
            return finiteNonNegative(legacyRecord.teammateAtk, undefined, "legacy record teammateAtk")
        }
    }

    return LUMINESCENCE_DEFAULT_TEAMMATE_ATTACK
}

export function isLuminescenceSettlement(event = {}) {
    return event?.settlementType === LUMINESCENCE_SETTLEMENT_TYPE
}

export function parseLuminescenceCoreLevel(value) {
    const normalized = String(value ?? "").trim().toLowerCase()
    if (["none", "0", "initial"].includes(normalized)) return "initial"
    const match = String(value ?? "").trim().match(/^(?:core\s*)?([a-f])$/i)
    return match ? match[1].toUpperCase() : null
}

export function resolveLuminescenceAlpha(coreSkillLevel = "F") {
    const level = parseLuminescenceCoreLevel(coreSkillLevel)
    if (!level) {
        throw new Error(`Unsupported luminescence core level: ${coreSkillLevel ?? ""}`)
    }
    return LUMINESCENCE_CORE_ALPHA_BY_LEVEL[level]
}

export function parseLuminescenceMoveId(value) {
    const candidate = value && typeof value === "object" ? value.moveId : value
    return MOVE_ID_ALIASES.get(normalizedAlias(candidate)) ?? null
}

export function parseLuminescenceSkillLevel(value) {
    const match = String(value ?? "").trim().match(/^(?:lv\s*)?(\d+)$/i)
    if (!match) return null
    const level = Number(match[1])
    return Number.isInteger(level) && level >= 1 && level <= 16 ? level : null
}

export function resolveLuminescenceMoveMultiplierPercent(move, skillLevel) {
    const moveId = parseLuminescenceMoveId(move)
    const level = parseLuminescenceSkillLevel(skillLevel)
    if (!moveId) {
        throw new Error(`Unsupported luminescence move: ${move ?? ""}`)
    }
    if (!level) {
        throw new Error(`Luminescence skill level must be between 1 and 16: ${skillLevel ?? ""}`)
    }
    return LUMINESCENCE_MOVE_MULTIPLIERS_PERCENT[moveId][level - 1]
}

export function resolveLuminescenceMoveMultiplier(move, skillLevel) {
    return resolveLuminescenceMoveMultiplierPercent(move, skillLevel) / 100
}

export function luminescenceMoveMultiplierSourceWarnings(move, skillLevel) {
    const moveId = parseLuminescenceMoveId(move)
    const level = parseLuminescenceSkillLevel(skillLevel)
    if (!moveId || !level) return []
    return LUMINESCENCE_MOVE_MULTIPLIER_METADATA[moveId].sourceDataWarnings
        .filter(item => item.level === level)
}

export function luminescenceShareRate() {
    return LUMINESCENCE_SHARE_RATE
}

export function normalizeLuminescenceEvent(event = {}) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new Error("Luminescence event must be an object.")
    }

    const normalized = {
        kind: "anomaly",
        settlementType: LUMINESCENCE_SETTLEMENT_TYPE,
        teammateAttack: resolveTeammateAttack(event),
        danInitialAtk: finiteNonNegative(event.danInitialAtk ?? event.A, 0, "danInitialAtk"),
        danAnomalyProficiency: finiteNonNegative(
            event.danAnomalyProficiency ?? event.P,
            0,
            "danAnomalyProficiency",
        ),
        coreSkillLevel: parseLuminescenceCoreLevel(event.coreSkillLevel ?? "F"),
        cinemaLevel: boundedCinemaLevel(event.cinemaLevel),
        teamAnomalyDamageMultiplier: finitePositive(
            event.teamAnomalyDamageMultiplier ?? 1,
            "teamAnomalyDamageMultiplier",
        ),
        luminescenceDamageMultiplier: finitePositive(
            event.luminescenceDamageMultiplier ?? 1,
            "luminescenceDamageMultiplier",
        ),
        luminescenceDamageSharePct: hasOwn(event, "luminescenceDamageSharePct")
            && event.luminescenceDamageSharePct !== undefined
            ? finitePercentage(
                event.luminescenceDamageSharePct,
                undefined,
                "luminescenceDamageSharePct",
            )
            : LUMINESCENCE_DEFAULT_DAMAGE_SHARE_PCT,
        anomalyAgentCount: 3,
        additionalAbilityActive: true,
        objectiveKind: LUMINESCENCE_OBJECTIVE_KIND,
        scoreSuffix: LUMINESCENCE_SCORE_SUFFIX,
    }

    if (!normalized.coreSkillLevel) {
        throw new Error(`Unsupported luminescence core level: ${event.coreSkillLevel ?? ""}`)
    }
    if (event.id !== undefined) normalized.id = String(event.id)
    if (event.label !== undefined) normalized.label = String(event.label)
    if (event.triggerActorRef !== undefined) {
        normalized.triggerActorRef = { ...event.triggerActorRef }
    }
    return normalized
}

function scoreStatus(normalized) {
    return {
        scalarReady: true,
        objectiveKind: LUMINESCENCE_OBJECTIVE_KIND,
        scoreSuffix: LUMINESCENCE_SCORE_SUFFIX,
        dependencies: [...SCORE_DEPENDENCIES],
        reasons: [],
        warnings: [],
        teammateAttack: normalized.teammateAttack,
    }
}

export function luminescenceStatDependencies(event = {}) {
    normalizeLuminescenceEvent(event)
    return [...SCORE_DEPENDENCIES]
}

export function luminescenceScoreStatus(event = {}) {
    const normalized = normalizeLuminescenceEvent(event)
    return scoreStatus(normalized)
}

export function luminescenceScalarOptimizationStatus(event = {}) {
    return luminescenceScoreStatus(event)
}

export function isLuminescenceScalarReady(event = {}) {
    return luminescenceScoreStatus(event).scalarReady
}

export function evaluateLuminescenceFactors(event = {}) {
    const normalized = normalizeLuminescenceEvent(event)
    const sharedAttack = Math.min(
        LUMINESCENCE_SHARE_RATE * normalized.danInitialAtk,
        LUMINESCENCE_SHARED_ATK_CAP,
    )
    const attackPool = normalized.teammateAttack + sharedAttack
    const cinemaTwoBonus = normalized.cinemaLevel >= 2 ? 0.20 : 0
    const proficiencyConversionBonus = 0.0002 * normalized.danAnomalyProficiency
    const conversionCoefficient = 1.10 + cinemaTwoBonus + proficiencyConversionBonus
    const alpha = resolveLuminescenceAlpha(normalized.coreSkillLevel)
    const proficiencyMultiplier = 1 + alpha * normalized.danAnomalyProficiency
    const commonDamageFactor = attackPool * conversionCoefficient
    const teamAnomalyDamageBonus = normalized.teamAnomalyDamageMultiplier - 1
    const luminescenceDamageBonus = normalized.luminescenceDamageMultiplier - 1
    const luminescenceExclusiveDamageBonus = luminescenceDamageBonus
        - teamAnomalyDamageBonus
    const otherAnomalyFactor = normalized.teamAnomalyDamageMultiplier
    const luminescenceRelativeDamageMultiplier = normalized.luminescenceDamageMultiplier
        / normalized.teamAnomalyDamageMultiplier
    const luminescenceFactor = proficiencyMultiplier
        * normalized.luminescenceDamageMultiplier
    const luminescenceRelativeFactor = proficiencyMultiplier
        * luminescenceRelativeDamageMultiplier
    const luminescenceDamageShare = normalized.luminescenceDamageSharePct / 100

    return {
        event: normalized,
        teammateAttack: normalized.teammateAttack,
        danInitialAtk: normalized.danInitialAtk,
        danAnomalyProficiency: normalized.danAnomalyProficiency,
        shareRate: LUMINESCENCE_SHARE_RATE,
        sharedAttack,
        attackPool,
        baseConversionCoefficient: 1.10,
        cinemaTwoBonus,
        proficiencyConversionBonus,
        conversionCoefficient,
        alpha,
        proficiencyMultiplier,
        teamAnomalyDamageMultiplier: normalized.teamAnomalyDamageMultiplier,
        teamAnomalyDamageBonus,
        luminescenceDamageMultiplier: normalized.luminescenceDamageMultiplier,
        luminescenceDamageBonus,
        luminescenceExclusiveDamageBonus,
        luminescenceRelativeDamageMultiplier,
        luminescenceDamageSharePct: normalized.luminescenceDamageSharePct,
        luminescenceDamageShare,
        commonDamageFactor,
        otherAnomalyFactor,
        luminescenceFactor,
        luminescenceRelativeFactor,
        // Compatibility aliases retained for the first factor-decomposition draft.
        baseTeamFactor: commonDamageFactor,
        exclusiveLuminescenceFactor: luminescenceFactor,
        luminescenceExclusiveFactor: luminescenceFactor,
        formulaValues: {
            teammateAttack: normalized.teammateAttack,
            danInitialAtk: normalized.danInitialAtk,
            danAnomalyProficiency: normalized.danAnomalyProficiency,
            shareRate: LUMINESCENCE_SHARE_RATE,
            sharedAttack,
            sharedAttackCap: LUMINESCENCE_SHARED_ATK_CAP,
            attackPool,
            baseConversionCoefficient: 1.10,
            cinemaTwoBonus,
            proficiencyConversionRate: 0.0002,
            proficiencyConversionBonus,
            conversionCoefficient,
            coreAlpha: alpha,
            proficiencyMultiplier,
            teamAnomalyDamageMultiplier: normalized.teamAnomalyDamageMultiplier,
            teamAnomalyDamageBonus,
            luminescenceDamageMultiplier: normalized.luminescenceDamageMultiplier,
            luminescenceDamageBonus,
            luminescenceExclusiveDamageBonus,
            luminescenceRelativeDamageMultiplier,
            luminescenceDamageSharePct: normalized.luminescenceDamageSharePct,
            luminescenceDamageShare,
            commonDamageFactor,
            otherAnomalyFactor,
            luminescenceFactor,
            luminescenceRelativeFactor,
            baseTeamFactor: commonDamageFactor,
            exclusiveLuminescenceFactor: luminescenceFactor,
            luminescenceExclusiveFactor: luminescenceFactor,
        },
    }
}

function scoreResult(factors, score, modelKind, multiplierDetails = {}, extra = {}) {
    const status = scoreStatus(factors.event)

    return {
        ...factors,
        score,
        damage: score,
        finalDamage: score,
        complete: true,
        ...status,
        modelKind,
        ...multiplierDetails,
        formulaValues: {
            ...factors.formulaValues,
            ...multiplierDetails,
        },
        ...extra,
    }
}

// The production score keeps the public environment multiplier in full, then
// applies the measured Luminescence share only to Luminescence's relative
// advantage over that public bucket.
export function evaluateGeometricShareTeamScore(event = {}) {
    const factors = evaluateLuminescenceFactors(event)
    const weightedOtherAnomalyMultiplier = factors.otherAnomalyFactor
    const weightedExclusiveMultiplier = Math.pow(
        factors.luminescenceRelativeFactor,
        factors.luminescenceDamageShare,
    )
    const weightedTeamScoreMultiplier = weightedOtherAnomalyMultiplier
        * weightedExclusiveMultiplier
    const score = factors.commonDamageFactor * weightedTeamScoreMultiplier
    return scoreResult(factors, score, "geometricShare", {
        weightedOtherAnomalyMultiplier,
        weightedExclusiveMultiplier,
        weightedTeamScoreMultiplier,
        scoreBeforeLuminescenceDamageMultiplier: factors.commonDamageFactor
            * weightedOtherAnomalyMultiplier
            * Math.pow(factors.proficiencyMultiplier, factors.luminescenceDamageShare),
    })
}

function resolveReferenceFactors(reference) {
    if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
        const luminescenceFactor = finitePositive(
            reference,
            "referenceLuminescenceFactor",
        )
        return {
            otherAnomalyFactor: 1,
            luminescenceFactor,
            legacyNumericReference: true,
        }
    }

    const otherAnomalyFactor = finitePositive(
        reference.otherAnomalyFactor ?? reference.O0,
        "referenceFactors.otherAnomalyFactor",
    )
    const luminescenceFactor = finitePositive(
        reference.luminescenceFactor ?? reference.L0,
        "referenceFactors.luminescenceFactor",
    )
    return {
        otherAnomalyFactor,
        luminescenceFactor,
        legacyNumericReference: false,
    }
}

export function evaluateReferenceCalibratedTeamScore(event = {}, referenceLuminescenceFactor) {
    const factors = evaluateLuminescenceFactors(event)
    const referenceFactors = resolveReferenceFactors(referenceLuminescenceFactor)
    const otherAnomalyRatio = factors.otherAnomalyFactor
        / referenceFactors.otherAnomalyFactor
    const luminescenceRatio = factors.luminescenceFactor
        / referenceFactors.luminescenceFactor
    const weightedReferenceRatio = (1 - factors.luminescenceDamageShare) * otherAnomalyRatio
        + factors.luminescenceDamageShare * luminescenceRatio
    const otherAnomalyContribution = (1 - factors.luminescenceDamageShare)
        * otherAnomalyRatio
    const luminescenceContribution = factors.luminescenceDamageShare
        * luminescenceRatio
    const score = factors.commonDamageFactor * weightedReferenceRatio
    return scoreResult(factors, score, "referenceCalibrated", {
        // Compatibility names now expose the branch ratios and their additive sum.
        weightedOtherAnomalyMultiplier: otherAnomalyRatio,
        weightedExclusiveMultiplier: luminescenceRatio,
        weightedTeamScoreMultiplier: weightedReferenceRatio,
        scoreBeforeLuminescenceDamageMultiplier: score,
    }, {
        referenceLuminescenceFactor: referenceFactors.luminescenceFactor,
        referenceOtherAnomalyFactor: referenceFactors.otherAnomalyFactor,
        referenceFactors,
        referenceFactorsExplicit: true,
        otherAnomalyRatio,
        luminescenceRatio,
        weightedReferenceRatio,
        otherAnomalyContribution,
        luminescenceContribution,
        weightedLuminescenceFactor: weightedReferenceRatio,
    })
}

export function evaluateConstantShareTeamScore(event = {}) {
    return evaluateGeometricShareTeamScore(event)
}

function compareLuminescenceTeamScoreCandidate(candidateEvent, reference) {
    const candidate = evaluateLuminescenceFactors(candidateEvent)
    if (Math.abs(candidate.luminescenceDamageShare - reference.luminescenceDamageShare) > 1e-12) {
        throw new Error("Candidate and reference luminescence damage shares must match for comparison.")
    }
    const candidateId = candidate.event.id
    const baseRatio = candidate.commonDamageFactor / reference.commonDamageFactor
    const otherAnomalyRatio = candidate.otherAnomalyFactor
        / reference.otherAnomalyFactor
    const luminescenceRatio = candidate.luminescenceFactor
        / reference.luminescenceFactor
    const constantShareRelativeScore = baseRatio
        * Math.pow(otherAnomalyRatio, 1 - candidate.luminescenceDamageShare)
        * Math.pow(luminescenceRatio, candidate.luminescenceDamageShare)
    const referenceCalibratedRelativeScore = baseRatio
        * ((1 - candidate.luminescenceDamageShare) * otherAnomalyRatio
            + candidate.luminescenceDamageShare * luminescenceRatio)
    const relativeDifference = constantShareRelativeScore - referenceCalibratedRelativeScore

    return {
        ...(candidateId === undefined ? {} : { candidateId }),
        constantShareRelativeScore,
        referenceCalibratedRelativeScore,
        relativeDifference,
        differencePercent: referenceCalibratedRelativeScore === 0
            ? 0
            : relativeDifference / referenceCalibratedRelativeScore * 100,
        baseRatio,
        otherAnomalyRatio,
        luminescenceRatio,
        luminescenceDamageSharePct: candidate.event.luminescenceDamageSharePct,
    }
}

function modelRanking(comparisons, scoreKey) {
    return comparisons
        .map((comparison, candidateIndex) => ({
            candidateIndex,
            ...(comparison.candidateId === undefined ? {} : { candidateId: comparison.candidateId }),
            relativeScore: comparison[scoreKey],
        }))
        .sort((left, right) => right.relativeScore - left.relativeScore
            || left.candidateIndex - right.candidateIndex)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export function compareLuminescenceTeamScoreModels(candidateEventOrEvents = {}, referenceEvent = {}) {
    const reference = evaluateLuminescenceFactors(referenceEvent)
    if (reference.commonDamageFactor <= 0
        || reference.otherAnomalyFactor <= 0
        || reference.luminescenceFactor <= 0) {
        throw new Error("Reference luminescence factors must be greater than zero for comparison.")
    }

    if (!Array.isArray(candidateEventOrEvents)) {
        return compareLuminescenceTeamScoreCandidate(candidateEventOrEvents, reference)
    }

    const comparisons = candidateEventOrEvents.map(candidateEvent =>
        compareLuminescenceTeamScoreCandidate(candidateEvent, reference))
    const constantShareRanking = modelRanking(comparisons, "constantShareRelativeScore")
    const referenceCalibratedRanking = modelRanking(
        comparisons,
        "referenceCalibratedRelativeScore",
    )
    const constantShareRankByIndex = new Map(
        constantShareRanking.map(entry => [entry.candidateIndex, entry.rank]),
    )
    const referenceCalibratedRankByIndex = new Map(
        referenceCalibratedRanking.map(entry => [entry.candidateIndex, entry.rank]),
    )
    const candidates = comparisons.map((comparison, candidateIndex) => {
        const constantShareRank = constantShareRankByIndex.get(candidateIndex)
        const referenceCalibratedRank = referenceCalibratedRankByIndex.get(candidateIndex)
        return {
            ...comparison,
            candidateIndex,
            constantShareRank,
            referenceCalibratedRank,
            rankDifference: constantShareRank - referenceCalibratedRank,
        }
    })
    const rankingDifferences = candidates.map(candidate => ({
        candidateIndex: candidate.candidateIndex,
        ...(candidate.candidateId === undefined ? {} : { candidateId: candidate.candidateId }),
        constantShareRank: candidate.constantShareRank,
        referenceCalibratedRank: candidate.referenceCalibratedRank,
        rankDifference: candidate.rankDifference,
    }))
    return {
        candidates,
        constantShareRanking,
        referenceCalibratedRanking,
        rankingDifferences,
        hasRankingDifference: rankingDifferences.some(candidate => candidate.rankDifference !== 0),
    }
}

export function evaluateLuminescenceScore(event = {}) {
    return evaluateConstantShareTeamScore(event)
}

export function evaluateLuminescence(event = {}) {
    return evaluateLuminescenceScore(event)
}
