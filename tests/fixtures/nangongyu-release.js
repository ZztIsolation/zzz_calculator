// Synthetic inventory only; never reads user storage.
export function nangongyuReleaseInput(cinemaLevel = 2, profileId = "core_tremolo_4") {
    return {
        agentId: "nangongyu", cinemaLevel, coreSkillLevel: "F", wEngineId: "zzz_wiki_1908", driveDiscs: [],
        combatBuffs: { activeBuffIds: [] },
        damage: {
            mode: "custom", selectedEventId: "release",
            events: [{ id: "release", kind: "anomaly", settlementType: "release", anomalyEffect: "corruption",
                count: 1, stunned: false, triggerActorRef: { agentId: "nangongyu", profileId },
                anomalySource: { actorRef: { agentId: "nangongyu" } } }],
        },
        settings: { fourPieceSetId: "woodpecker_electro", twoPieceSetIds: ["hormone_punk"],
            algorithm: "exact-super-bound", objective: "damage", mainStatLimits: { 4: [], 5: [], 6: [] } },
    }
}

export function nangongyuReleaseStore() {
    const mains = [["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["anomalyProficiency", 92], ["etherDmg", 30], ["atkPct", 30]]
    return { version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [],
        driveDiscs: mains.flatMap(([stat, value], index) => [0, 1].map(variant => ({
            id: `nangongyu-${index + 1}-${variant}`, ownerId: "default", partition: index + 1,
            setId: index < 4 ? "woodpecker_electro" : "hormone_punk", rarity: "S", level: 15, maxLevel: 15,
            mainStat: { stat, value, mode: index >= 4 ? "pct" : "flat" },
            subStats: [{ stat: "atkFlat", value: variant * 2 ** index + 1, mode: "flat" }],
            source: { type: "test", sequence: index * 2 + variant },
        }))) }
}
