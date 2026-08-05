import { AGENT_ID_OVERRIDES, WENGINE_ID_OVERRIDES } from "./aliases.js"
import { mapDriveDiscPreset } from "./drive-disc-mapping.js"

function displayItems(catalog, displayKey, fallbackKey) {
  const displayed = catalog?.[displayKey]
  if (Array.isArray(displayed) && displayed.length) return displayed
  return Array.isArray(catalog?.[fallbackKey]) ? catalog[fallbackKey] : []
}

function zhName(item) {
  return String(item?.name?.zhCN ?? item?.name?.zhCn ?? "").trim()
}

function uniqueNameIndex(items) {
  const index = new Map()
  for (const item of items) {
    const name = zhName(item)
    if (!name) continue
    const values = index.get(name) ?? []
    values.push(item)
    index.set(name, values)
  }
  return index
}

function localizedName(metadata, locations, id, nameKey) {
  const key = metadata?.[id]?.[nameKey]
  const zhCN = locations?.["zh-cn"] ?? locations?.["zhCN"] ?? {}
  return String(zhCN?.[key] ?? "").trim()
}

function resolveEntity({ enkaId, metadata, locations, nameKey, items, overrides }) {
  const ids = new Set(items.map(item => String(item?.id ?? "")))
  const override = overrides[enkaId]
  if (override && ids.has(override)) {
    return { item: items.find(candidate => candidate.id === override), source: "override" }
  }

  const name = localizedName(metadata, locations, enkaId, nameKey)
  if (!name) return { item: null, name, reason: "Enka 官方简中名称缺失" }
  const matches = uniqueNameIndex(items).get(name) ?? []
  if (matches.length === 1) return { item: matches[0], name, source: "exact-name" }
  if (matches.length > 1) return { item: null, name, reason: "Calculator 中存在重名实体" }
  return { item: null, name, reason: "Calculator 当前目录未收录" }
}

export function mapShowcaseToCatalog(parsed, catalog, metadata) {
  const agentItems = displayItems(catalog, "displayAgents", "agents")
  const wEngineItems = displayItems(catalog, "displayWEngines", "wEngines")
  const mappedAgents = []
  const skippedAgents = []
  const warnings = [...(parsed?.warnings ?? [])]

  for (const source of parsed?.agents ?? []) {
    const agentResult = resolveEntity({
      enkaId: source.enkaId,
      metadata: metadata.avatars,
      locations: metadata.locations,
      nameKey: "Name",
      items: agentItems,
      overrides: AGENT_ID_OVERRIDES,
    })
    if (!agentResult.item) {
      skippedAgents.push({
        enkaId: source.enkaId,
        name: agentResult.name || `Enka #${source.enkaId}`,
        reason: agentResult.reason,
      })
      continue
    }

    let wEngine = null
    if (source.wEngine) {
      const wEngineResult = resolveEntity({
        enkaId: source.wEngine.enkaId,
        metadata: metadata.weapons,
        locations: metadata.locations,
        nameKey: "ItemName",
        items: wEngineItems,
        overrides: WENGINE_ID_OVERRIDES,
      })
      if (wEngineResult.item) {
        wEngine = {
          id: wEngineResult.item.id,
          name: zhName(wEngineResult.item),
          level: source.wEngine.level,
          modificationLevel: source.wEngine.modificationLevel,
        }
      } else {
        warnings.push(`${zhName(agentResult.item)} 的音擎 ${wEngineResult.name || `#${source.wEngine.enkaId}`} 无法映射，保留 Calculator 原音擎。`)
      }
    }

    const agentName = zhName(agentResult.item)
    const driveDiscResult = mapDriveDiscPreset(source.driveDiscs, {
      agentId: agentResult.item.id,
      agentName,
      catalog,
      metadata,
    })
    warnings.push(...driveDiscResult.warnings)

    mappedAgents.push({
      ...source,
      agentId: agentResult.item.id,
      agentName,
      wEngine,
      driveDiscPreset: driveDiscResult.preset,
    })
  }

  return { mappedAgents, skippedAgents, warnings }
}
