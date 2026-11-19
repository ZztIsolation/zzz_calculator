// Synthetic inventory; does not read browser accounts or maintained defaults.
export function severianOptimizerStore() {
    const driveDiscs = []
    const mains = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184],
        ["critRate", 24], ["windDmg", 30], ["atkPct", 30]]
    for (let slot = 1; slot <= 6; slot++) for (let v = 0; v < 2; v++) {
        const [stat, value] = mains[slot]
        driveDiscs.push({ id: `severian-${slot}-${v}`, ownerId: "default", partition: slot,
            setId: slot <= 4 ? "zzz_wiki_1552" : "puffer_electro", rarity: "S", level: 15, maxLevel: 15,
            mainStat: { stat, value, mode: ["atkPct", "windDmg"].includes(stat) ? "pct" : "flat" },
            subStats: [{ stat: "atkPct", value: 3 + v * 6, mode: "pct" },
                { stat: "critRate", value: 2.4 + (1 - v) * 7.2, mode: "flat" },
                { stat: "critDmg", value: 4.8 + v * 9.6, mode: "flat" },
                { stat: "penFlat", value: slot + v * 9, mode: "flat" }].filter(s => s.stat !== stat),
            source: { type: "test", sequence: slot * 100 + v } })
    }
    return { version: 1, owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [], driveDiscs }
}

export function severianOptimizerInput(cinemaLevel = 0) {
    return { agentId: "severian_lowell", coreSkillLevel: "F", cinemaLevel,
        wEngineId: "zzz_wiki_2305", wEngineModificationLevel: 1,
        combatBuffs: { activeBuffIds: ["agent:severian_lowell.corePassive", "agent:severian_lowell.additionalAbility",
            "wEngine:zzz_wiki_2305.self", "driveDisc4pc:zzz_wiki_1552.self", ...(cinemaLevel >= 6 ? ["agent:severian_lowell.cinema.6"] : [])] },
        damage: { mode: "custom", selectedEventId: "shadow-hunt", agentLevel: 60,
            target: { defense: 953, levelCoefficient: 794, resistance: 0, stunMultiplierPercent: 150 },
            events: [{ id: "shadow-hunt", kind: "direct", count: 1, stunned: true, critMode: "expected",
                skillRef: { agentSkillId: "severian_lowell", categoryId: "basic", moveId: "basic_move_3", rowId: "row_1" } }] },
        settings: { fourPieceSetId: "zzz_wiki_1552", twoPieceSetId: "puffer_electro", algorithm: "exact-super-bound",
            objective: "damage", mainStatLimits: { 4: ["critRate"], 5: ["windDmg"], 6: ["atkPct"] } } }
}
