import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  DRIVE_DISC_RARITIES,
  ENKA_METADATA_COMMIT,
  PROPERTY_MAPPINGS,
} from "../core/enka-import/constants.js"
import {
  AGENT_ID_OVERRIDES,
  DRIVE_DISC_SET_NAME_ALIASES,
  WENGINE_ID_OVERRIDES,
} from "../core/enka-import/aliases.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceCommit = process.argv[2] || ENKA_METADATA_COMMIT
const baseUrl = `https://raw.githubusercontent.com/EnkaNetwork/API-docs/${sourceCommit}/store/zzz`

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

async function fetchJson(name) {
  const response = await fetch(`${baseUrl}/${name}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`Failed to fetch ${name}: HTTP ${response.status}`)
  return response.json()
}

function zhName(item) {
  return String(item?.name?.zhCN ?? item?.name?.zhCn ?? "").trim()
}

function localizedName(locations, key) {
  return String(locations?.["zh-cn"]?.[key] ?? "").trim()
}

function uniqueNameIndex(items) {
  const index = new Map()
  for (const item of items) {
    const name = zhName(item)
    if (!name) continue
    const matches = index.get(name) ?? []
    matches.push(item)
    index.set(name, matches)
  }
  return index
}

function resolveCatalogItem({ enkaId, officialName, items, byName, override, aliases = {} }) {
  if (override) {
    const item = items.find(candidate => candidate.id === override)
    if (!item) throw new Error(`Override ${enkaId} -> ${override} does not exist in Calculator catalog`)
    return item
  }
  const catalogName = aliases[officialName] ?? officialName
  const matches = byName.get(catalogName) ?? []
  if (matches.length > 1) throw new Error(`Calculator catalog name is ambiguous: ${catalogName}`)
  return matches[0] ?? null
}

function assertVisibleCatalogCoverage(kind, items, mappedIds) {
  const missing = items
    .filter(item => item?.hidden !== true && !mappedIds.has(item.id))
    .map(item => `${item.id} (${zhName(item) || "unnamed"})`)
  if (missing.length) throw new Error(`${kind} missing Enka ID mappings:\n${missing.join("\n")}`)
}

const [avatars, weapons, locations, equipments, properties, agentsRaw, wEnginesRaw, setsRaw] = await Promise.all([
  fetchJson("avatars.json"),
  fetchJson("weapons.json"),
  fetchJson("locs.json"),
  fetchJson("equipments.json"),
  fetchJson("property.json"),
  readJson(path.join(rootDir, "data", "agents.json")),
  readJson(path.join(rootDir, "data", "w_engines.json")),
  readJson(path.join(rootDir, "data", "drive_disc_sets.json")),
])

const agentItems = agentsRaw.agents ?? []
const wEngineItems = wEnginesRaw.wEngines ?? []
const setItems = setsRaw.sets ?? []
const agentNames = uniqueNameIndex(agentItems)
const wEngineNames = uniqueNameIndex(wEngineItems)
const setNames = uniqueNameIndex(setItems)

const agentMappings = {}
for (const [enkaId, metadata] of Object.entries(avatars)) {
  const officialName = localizedName(locations, metadata?.Name)
  const item = resolveCatalogItem({
    enkaId,
    officialName,
    items: agentItems,
    byName: agentNames,
    override: AGENT_ID_OVERRIDES[enkaId],
  })
  if (item) agentMappings[enkaId] = { id: item.id, name: zhName(item) }
}
assertVisibleCatalogCoverage("Agent", agentItems, new Set(Object.values(agentMappings).map(item => item.id)))

const wEngineMappings = {}
for (const [enkaId, metadata] of Object.entries(weapons)) {
  const officialName = localizedName(locations, metadata?.ItemName)
  const item = resolveCatalogItem({
    enkaId,
    officialName,
    items: wEngineItems,
    byName: wEngineNames,
    override: WENGINE_ID_OVERRIDES[enkaId],
  })
  if (item) wEngineMappings[enkaId] = { id: item.id, name: zhName(item) }
}
assertVisibleCatalogCoverage("W-Engine", wEngineItems, new Set(Object.values(wEngineMappings).map(item => item.id)))

const suitMappings = {}
for (const [suitId, metadata] of Object.entries(equipments?.Suits ?? {})) {
  const officialName = localizedName(locations, metadata?.Name)
  const item = resolveCatalogItem({
    enkaId: suitId,
    officialName,
    items: setItems,
    byName: setNames,
    aliases: DRIVE_DISC_SET_NAME_ALIASES,
  })
  if (item) suitMappings[suitId] = { id: item.id, name: zhName(item) }
}
assertVisibleCatalogCoverage("Drive Disc set", setItems, new Set(Object.values(suitMappings).map(item => item.id)))

const equipmentMappings = {}
for (const [equipmentId, metadata] of Object.entries(equipments?.Items ?? {})) {
  const suit = suitMappings[String(metadata?.SuitId ?? "")]
  const rarity = DRIVE_DISC_RARITIES[Number(metadata?.Rarity)]
  if (suit && rarity) {
    equipmentMappings[equipmentId] = {
      setId: suit.id,
      setName: suit.name,
      rarity: rarity.label,
      maxLevel: rarity.maxLevel,
      levelScale: rarity.levelScale,
    }
  }
}

const propertyMappings = {}
for (const [propertyId, mapping] of Object.entries(PROPERTY_MAPPINGS)) {
  const property = properties?.[propertyId]
  if (!property) throw new Error(`Enka property ${propertyId} is missing at ${sourceCommit}`)
  propertyMappings[propertyId] = { ...mapping, label: localizedName(locations, property.Name) }
}

const output = {
  version: 1,
  source: { repository: "EnkaNetwork/API-docs", commit: sourceCommit },
  agents: agentMappings,
  wEngines: wEngineMappings,
  driveDiscSuits: suitMappings,
  driveDiscEquipment: equipmentMappings,
  properties: propertyMappings,
}

const outputPath = path.join(rootDir, "data", "enka_zzz_mapping.json")
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8")
console.log(`Wrote ${path.relative(rootDir, outputPath)} from Enka API-docs ${sourceCommit}`)
console.log(`Mapped ${Object.keys(agentMappings).length} agents, ${Object.keys(wEngineMappings).length} W-Engines, ${Object.keys(suitMappings).length} sets, and ${Object.keys(equipmentMappings).length} Drive Discs.`)
