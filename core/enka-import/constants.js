export const ENKA_METADATA_COMMIT = "dc86b5dc06ad27d26c9a4df9f0b6ffd0417bf554"

export const SKILL_INDEX_TO_CATEGORY = Object.freeze({
  0: "basic",
  1: "special",
  2: "dodge",
  3: "chain",
  6: "assist",
})

export const CORE_SKILL_LEVELS = Object.freeze(["A", "B", "C", "D", "E", "F"])

export const PROPERTY_MAPPINGS = Object.freeze({
  "11102": { stat: "hpPct", mode: "pct" },
  "11103": { stat: "hpFlat", mode: "flat" },
  "12102": { stat: "atkPct", mode: "pct" },
  "12103": { stat: "atkFlat", mode: "flat" },
  "12202": { stat: "impact", mode: "pct" },
  "13102": { stat: "defPct", mode: "pct" },
  "13103": { stat: "defFlat", mode: "flat" },
  "20103": { stat: "critRate", mode: "pct" },
  "21103": { stat: "critDmg", mode: "pct" },
  "23103": { stat: "penRatio", mode: "pct" },
  "23203": { stat: "penFlat", mode: "flat" },
  "30502": { stat: "energyRegen", mode: "pct" },
  "31203": { stat: "anomalyProficiency", mode: "flat" },
  "31402": { stat: "anomalyMastery", mode: "pct" },
  "31503": { stat: "physicalDmg", mode: "pct" },
  "31603": { stat: "fireDmg", mode: "pct" },
  "31703": { stat: "iceDmg", mode: "pct" },
  "31803": { stat: "electricDmg", mode: "pct" },
  "31903": { stat: "etherDmg", mode: "pct" },
  "32303": { stat: "windDmg", mode: "pct" },
})

export const DRIVE_DISC_RARITIES = Object.freeze({
  4: { label: "S", maxLevel: 15, levelScale: 0.2 },
  3: { label: "A", maxLevel: 12, levelScale: 0.25 },
  2: { label: "B", maxLevel: 9, levelScale: 0.3 },
})
