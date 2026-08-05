// Constants shared by the Enka showcase import modules.
export const SKILL_INDEX_TO_CATEGORY = Object.freeze({
  0: "basic",
  1: "special",
  2: "dodge",
  3: "chain",
  6: "assist",
})

export const CORE_SKILL_LEVELS = Object.freeze(["A", "B", "C", "D", "E", "F"])

// Enka only hosts the static metadata; fetched at runtime.
export const ENKA_METADATA_URLS = Object.freeze({
  avatars: "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/avatars.json",
  weapons: "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/weapons.json",
  locations: "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/locs.json",
  equipments: "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/equipments.json",
  properties: "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/property.json",
})
