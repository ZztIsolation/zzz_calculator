export const characterIds = ["nekomata", "asaba_harumasa", "evelyn_chevalier"]

export function characterInput(catalog, agentId, potentialLevel = 6) {
    const agent = catalog.agentsMap.get(agentId)
    const wEngineId = { nekomata: "zzz_wiki_224", asaba_harumasa: "zzz_wiki_991", evelyn_chevalier: "zzz_wiki_1159" }[agentId]
    return {
        agentId, potentialLevel, coreSkillLevel: "F", cinemaLevel: 0,
        wEngineId, wEngineModificationLevel: 1,
        combatBuffs: { activeBuffIds: [
            `agent:${agentId}.corePassive`, `wEngine:${wEngineId}.self`,
            "driveDisc4pc:shadow_harmony.self",
            ...(agent.combatBuffs.additionalAbility.defaultChecked ? [`agent:${agentId}.additionalAbility`] : []),
        ] },
        damage: { mode: "custom", agentLevel: 60, skillLevelsByCategory: { basic: 12, dodge: 12, special: 12, chain: 12 },
            target: { defense: 953, resistanceByElement: { physical: 0, electric: 0, fire: 0 }, stunMultiplierPercent: 150 },
        },
        settings: { fourPieceSetId: "shadow_harmony", twoPieceSetIds: ["hormone_punk"],
            algorithm: "exact-super-bound", objective: "damage", topN: 10,
            mainStatLimits: { 4: ["atkPct"], 5: ["atkPct"], 6: ["atkPct"] } },
    }
}

// Fixed 4+2 allocation isolates enumeration from set-plan generation. CRIT
// alternatives straddle Evelyn's threshold, with ATK/CRIT DMG tradeoffs.
export function characterStore(variants = 2) {
    const main = [null, ["hpFlat", 2200], ["atkFlat", 316], ["defFlat", 184], ["atkPct", 30], ["atkPct", 30], ["atkPct", 30]]
    const driveDiscs = []
    for (let slot = 1; slot <= 6; slot++) for (let variant = 0; variant < variants; variant++) {
        const [stat, value] = main[slot]
        driveDiscs.push({ id: `character-${slot}-${variant}`, ownerId: "default", partition: slot,
            setId: slot <= 4 ? "shadow_harmony" : "hormone_punk", rarity: "S", level: 15, maxLevel: 15,
            mainStat: { stat, value },
            subStats: [{ stat: "critRate", value: variant ? 4.8 : 0 },
                { stat: "critDmg", value: variant ? 0 : 9.6 },
                { stat: "atkFlat", value: slot * 2 + variant * (1 + 2 ** slot / 100) }].filter(s => s.stat !== stat),
            source: { type: "test", sequence: slot * 100 + variant } })
    }
    return { version: 1, currentOwnerId: "default", owners: [{ id: "default", label: "Synthetic" }], imports: [], driveDiscLoadouts: [], driveDiscs }
}
