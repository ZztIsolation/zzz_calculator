// Synthetic inventory only; independent of browser data and working-directory state.
export function janeOptimizerStore(variants = 2) {
    const driveDiscs = []
    const mains = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184],
        ["anomalyProficiency", 92], ["physicalDmg", 30], ["atkPct", 30]]
    for (let slot = 1; slot <= 6; slot++) {
        for (let variant = 0; variant < variants; variant++) {
            const main = mains[slot]
            driveDiscs.push({ id: `jane-${slot}-${variant}`, ownerId: "default", partition: slot,
                setId: slot <= 4 ? "fanged_metal" : "hormone_punk", rarity: "S", level: 15, maxLevel: 15,
                mainStat: { stat: main[0], value: main[1], mode: slot >= 5 ? "pct" : "flat" },
                subStats: [{ stat: "atkPct", value: 3 + variant * 6, mode: "pct" },
                    { stat: "anomalyProficiency", value: 9 + (1 - variant % 2) * 18, mode: "flat" },
                    { stat: "penFlat", value: slot + variant * 9, mode: "flat" }].filter(s => s.stat !== main[0]),
                source: { type: "test", sequence: slot * 100 + variant },
            })
        }
    }
    return { version: 1, owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [], driveDiscs }
}

export function janeOptimizerInput(potentialLevel = 6) {
    return { agentId: "jane_doe", coreSkillLevel: "F", potentialLevel, cinemaLevel: 4,
        wEngineId: "zzz_wiki_760", wEngineModificationLevel: 1,
        combatBuffs: { activeBuffIds: ["agent:jane_doe.corePassive", "agent:jane_doe.additionalAbility", "agent:jane_doe.skill.frenzy",
            "agent:jane_doe.cinema.1", "agent:jane_doe.cinema.2", "agent:jane_doe.cinema.4", "wEngine:zzz_wiki_760.self",
            "driveDisc4pc:fanged_metal.self"] },
        damage: { mode: "custom", selectedEventId: "assault", events: [{ id: "assault", kind: "anomaly",
            settlementType: "attribute", anomalyEffect: "assault", procCount: 1, count: 1, stunned: true }] },
        settings: { fourPieceSetId: "fanged_metal", twoPieceSetId: "hormone_punk", algorithm: "exact-super-bound",
            objective: "damage", mainStatLimits: { 4: ["anomalyProficiency"], 5: ["physicalDmg"], 6: ["atkPct"] } },
    }
}
