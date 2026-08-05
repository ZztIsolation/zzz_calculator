export const FROZEN_DAN_TEAMMATE_ATTACK = 2345
export const FROZEN_DAN_LUMINESCENCE_DAMAGE_SHARE_PCT = 50

export const FROZEN_DAN_LUMINESCENCE_EVENT = Object.freeze({
    id: "remielle-fixed-cross-path-luminescence",
    kind: "anomaly",
    settlementType: "luminescence",
    triggerActorRef: Object.freeze({ agentId: "remielle_dan" }),
    teammateAttack: FROZEN_DAN_TEAMMATE_ATTACK,
    luminescenceDamageSharePct: FROZEN_DAN_LUMINESCENCE_DAMAGE_SHARE_PCT,
})

const FROZEN_DAN_LUMINESCENCE_DAMAGE = Object.freeze({
    mode: "anomaly",
    selectedEventId: FROZEN_DAN_LUMINESCENCE_EVENT.id,
    events: Object.freeze([FROZEN_DAN_LUMINESCENCE_EVENT]),
})

export function fixedDanLuminescenceInput(overrides = {}) {
    return {
        agentId: "remielle_dan",
        coreSkillLevel: "F",
        cinemaLevel: 0,
        wEngineId: "hailfall_star_palace",
        wEngineModificationLevel: 1,
        driveDiscs: [],
        combatBuffs: { activeBuffIds: [] },
        damage: FROZEN_DAN_LUMINESCENCE_DAMAGE,
        ...overrides,
    }
}
