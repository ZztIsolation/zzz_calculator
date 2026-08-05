// Client-side Enka showcase import: fetch via the same-origin backend proxy,
// load Enka's static metadata, then parse + map into Calculator catalog ids.
import { parseEnkaShowcase } from "@core/enka-import/parse-enka.js"
import { mapShowcaseToCatalog } from "@core/enka-import/entity-mapping.js"
import { ENKA_METADATA_URLS } from "@core/enka-import/constants.js"

let metadataPromise: Promise<any> | null = null

async function requestJson(path: string): Promise<any> {
    const response = await fetch(path, { cache: "no-store" })
    const json = await response.json().catch(() => null)
    if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || `请求失败（HTTP ${response.status}）。`)
    }
    return json
}

export function loadEnkaMetadata(): Promise<any> {
    if (!metadataPromise) {
        metadataPromise = Promise.all([
            fetch(ENKA_METADATA_URLS.avatars).then(r => r.json()),
            fetch(ENKA_METADATA_URLS.weapons).then(r => r.json()),
            fetch(ENKA_METADATA_URLS.locations).then(r => r.json()),
            fetch(ENKA_METADATA_URLS.equipments).then(r => r.json()),
            fetch(ENKA_METADATA_URLS.properties).then(r => r.json()),
        ]).then(([avatars, weapons, locations, equipments, properties]) => ({
            avatars, weapons, locations, equipments, properties,
        }))
    }
    return metadataPromise
}

// Fetch showcase via the backend proxy, parse raw Enka fields, then map to
// Calculator catalog ids. Returns { parsed, mappedAgents, skippedAgents, warnings, ttlSeconds }.
export async function importEnkaShowcase(uid: string, catalog: any): Promise<any> {
    const { showcase } = await requestJson(`/api/enka/${encodeURIComponent(String(uid).trim())}`)
    const metadata = await loadEnkaMetadata()
    const parsed = parseEnkaShowcase(showcase)
    const { mappedAgents, skippedAgents, warnings } = mapShowcaseToCatalog(parsed, catalog, metadata)
    return {
        parsed,
        mappedAgents,
        skippedAgents,
        warnings,
        ttlSeconds: Math.max(0, Number(showcase?.ttl) || 0),
    }
}

// Build the per-agent config patch the build store's applyAgentConfig accepts.
export function buildConfigForAgent(mappedAgent: any): Record<string, any> {
    const config: Record<string, any> = {}
    if (mappedAgent.agentLevel != null) config.agentLevel = mappedAgent.agentLevel
    if (mappedAgent.cinemaLevel != null) config.cinemaLevel = mappedAgent.cinemaLevel
    if (mappedAgent.coreSkillLevel != null) config.coreSkillLevel = mappedAgent.coreSkillLevel
    const skills = Object.entries(mappedAgent.skillLevels ?? {})
    if (skills.length) {
        config.skillLevels = Object.fromEntries(skills)
        config.damage = { skillLevelsByCategory: Object.fromEntries(skills) }
    }
    if (mappedAgent.wEngine) {
        config.wEngineId = mappedAgent.wEngine.id
        if (mappedAgent.wEngine.level != null) config.wEngineLevel = mappedAgent.wEngine.level
        if (mappedAgent.wEngine.modificationLevel != null) {
            config.wEngineModificationLevel = mappedAgent.wEngine.modificationLevel
        }
    }
    return config
}
