import { labelOf } from "@/utils/format"

const star = "monument_of_the_star"
const sunbringerPairs = [
  [star, "inferno_metal"],
  [star, "soul_rock"],
  [star, "woodpecker_electro"],
  ["zzz_wiki_2121", "puffer_electro"],
]

// Reference discs are transient calculation input. Only the selected loadout ID is saved.
export function referenceDiscLoadouts(agentId: string, meta: any) {
  if (agentId !== "sunbringer") return []
  const sets = new Map<string, any>((meta?.displayDriveDiscSets ?? []).map((set: any) => [set.id, set]))
  const maxValues = meta?.statRules?.driveDisc?.sRankMaxMainStat
  if (!maxValues) return []
  return sunbringerPairs.flatMap(([fourPiece, twoPiece]) => {
    if (!sets.has(fourPiece) || !sets.has(twoPiece)) return []
    const id = `reference:${agentId}:${fourPiece}:${twoPiece}`
    const name = `${labelOf(sets.get(fourPiece))} 4 + ${labelOf(sets.get(twoPiece))} 2`
    const slot5 = twoPiece === "puffer_electro" ? "penRatio" : "fireDmg"
    const stats = ["hpFlat", "atkFlat", "defFlat", "defPct", slot5, "defPct"]
    const driveDiscs = stats.map((stat, index) => ({
      id: `${id}:${index + 1}`, partition: index + 1,
      setId: index < 4 ? fourPiece : twoPiece,
      rarity: "S", level: 15, mainStat: { stat, value: maxValues[stat] }, subStats: [],
    }))
    return [{ id, name, driveDiscs }]
  })
}
