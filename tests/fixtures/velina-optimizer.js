// Deterministic synthetic inventories; never reads browser or user inventory.
export function velinaOptimizerStore({ variants = 4, variableEnergy = false, recommended = false, freeTwoPiece = false } = {}) {
    const sets = [recommended ? "zzz_wiki_2038" : "woodpecker_electro", "hormone_punk"]
    if (freeTwoPiece) sets.push("swing_jazz")
    const mains = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["anomalyProficiency", 92], ["windDmg", 30], ["energyRegen", 60]]
    const driveDiscs = []
    for (let slot = 1; slot <= 6; slot += 1) {
        for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
            for (let variant = 0; variant < variants; variant += 1) {
                const main = slot === 6 && variableEnergy && variant % 2 ? ["atkPct", 30] : mains[slot]
                driveDiscs.push({
                    id: `${slot}-${setIndex}-${variant}`,
                    ownerId: "default",
                    partition: slot,
                    setId: sets[setIndex],
                    rarity: "S",
                    level: 15,
                    maxLevel: 15,
                    mainStat: { stat: main[0], value: main[1], mode: slot >= 5 ? "pct" : "flat" },
                    subStats: [
                        { stat: "atkPct", value: 3 + variant * 6, mode: "pct" },
                        { stat: "anomalyProficiency", value: 9 + ((variant + slot + setIndex) % variants) * 18, mode: "flat" },
                    ].filter(stat => stat.stat !== main[0]),
                    source: { type: "test", sequence: slot * 100 + setIndex * 10 + variant },
                })
            }
        }
    }
    return { version: 1, owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [], driveDiscs }
}

export function velinaOptimizerInput({ recommended = false, freeTwoPiece = false, releaseSource = "broad_vortex", active = true, ...overrides } = {}) {
    return {
        agentId: "velina",
        coreSkillLevel: "F",
        wEngineId: "zzz_wiki_2030",
        combatBuffs: { activeBuffIds: active ? ["agent:velina.corePassive"] : [] },
        damage: {
            mode: "anomaly",
            selectedEventId: "velina-score",
            events: [{ id: "velina-score", kind: "anomaly", settlementType: "release", anomalyEffect: "wind_corrosion", releaseSource, count: 1, stunned: true }],
        },
        settings: {
            fourPieceSetId: recommended ? "zzz_wiki_2038" : "woodpecker_electro",
            ...(freeTwoPiece ? { twoPieceSetIds: [] } : { twoPieceSetId: "hormone_punk" }),
            algorithm: "exact-super-bound",
            objective: "damage",
            mainStatLimits: { 4: ["anomalyProficiency"], 5: ["windDmg"], 6: ["energyRegen", "atkPct"] },
        },
        ...overrides,
    }
}
