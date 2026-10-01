import { mapDriveDiscPreset } from "./drive-disc-mapping.js"
import { ENKA_TEAMMATE_IDS } from './teammate-identities.js'

function displayItems(catalog, displayKey, fallbackKey) {
  const displayed = catalog?.[displayKey]
  if (Array.isArray(displayed)) return displayed
  return Array.isArray(catalog?.[fallbackKey]) ? catalog[fallbackKey].filter(item => item?.hidden !== true) : []
}

function itemById(items, id) {
  return items.find(item => String(item?.id ?? "") === String(id ?? "")) ?? null
}

export function mapShowcaseToCatalog(parsed, catalog, mapping, { uid } = {}) {
  const normalizedUid = String(uid ?? "").trim()
  const agentItems = displayItems(catalog, "displayAgents", "agents")
  const teammateItems = displayItems(catalog, "displayTeammateCombatBuffGroups", "teammateCombatBuffGroups")
  const wEngineItems = displayItems(catalog, "displayWEngines", "wEngines")
  const mappedAgents = []
  const skippedAgents = []
  const warnings = [...(parsed?.warnings ?? [])]

  for (const source of parsed?.agents ?? []) {
    const teammate = itemById(teammateItems, ENKA_TEAMMATE_IDS[source.enkaId])
    const agentMapping = mapping?.agents?.[source.enkaId]
      ?? (teammate ? { id: teammate.id, name: teammate.name?.zhCN ?? teammate.id } : null)
    const calculableAgent = itemById(agentItems, agentMapping?.id)
    const agentItem = calculableAgent ?? itemById(teammateItems, agentMapping?.id)
    if (!agentMapping || !agentItem) {
      skippedAgents.push({
        enkaId: source.enkaId,
        name: agentMapping?.name || `Enka #${source.enkaId}`,
        reason: agentMapping ? "Calculator 当前目录未开放" : "Calculator 当前映射未收录",
      })
      continue
    }

    let wEngine = null
    if (source.wEngine) {
      const wEngineMapping = mapping?.wEngines?.[source.wEngine.enkaId]
      const wEngineItem = itemById(wEngineItems, wEngineMapping?.id)
      if (wEngineMapping && wEngineItem) {
        wEngine = {
          id: wEngineItem.id,
          name: wEngineMapping.name,
          level: source.wEngine.level,
          modificationLevel: source.wEngine.modificationLevel,
        }
      } else {
        warnings.push(`${agentMapping.name} 的音擎 ${wEngineMapping?.name || `#${source.wEngine.enkaId}`} 无法映射，保留 Calculator 原音擎。`)
      }
    }

    const driveDiscResult = mapDriveDiscPreset(source.driveDiscs, {
      uid: normalizedUid,
      agentId: agentItem.id,
      agentName: agentMapping.name,
      catalog,
      mapping,
    })
    warnings.push(...driveDiscResult.warnings)

    mappedAgents.push({
      ...source,
      agentId: agentItem.id,
      agentName: agentMapping.name,
      ...(calculableAgent ? {} : { teammateOnly: true }),
      wEngine,
      driveDiscPreset: driveDiscResult.preset,
    })
  }

  return { mappedAgents, skippedAgents, warnings }
}
