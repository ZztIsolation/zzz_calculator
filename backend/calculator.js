import { readFile } from "node:fs/promises"
import path from "node:path"

import { normalizeCatalogPayload } from "../core/calculator-core.js"

export {
    buildMeta,
    calculateInCombatPanel,
    calculateOutOfCombatPanel,
    clampWEngineModificationLevel,
    createInCombatPanelCalculator,
    materializeWEngineForModificationLevel,
    normalizeCatalog,
    normalizeCatalogPayload,
} from "../core/calculator-core.js"

async function readJson(filePath) {
    const text = await readFile(filePath, "utf8")
    return JSON.parse(text)
}

export async function loadCatalog(dataDir, exampleDir) {
    const [
        agentsRaw,
        agentSkillsRaw,
        wEnginesRaw,
        driveDiscSetsRaw,
        combatBuffsRaw,
        anomalyEffectsRaw,
        statRulesRaw,
        exampleRaw,
        yeShunguangExampleRaw,
    ] = await Promise.all([
        readJson(path.join(dataDir, "agents.json")),
        readJson(path.join(dataDir, "agent_skills.json")),
        readJson(path.join(dataDir, "w_engines.json")),
        readJson(path.join(dataDir, "drive_disc_sets.json")),
        readJson(path.join(dataDir, "combat_buffs.json")),
        readJson(path.join(dataDir, "anomaly_effects.json")),
        readJson(path.join(dataDir, "stat_rules.json")),
        readJson(path.join(exampleDir, "out_of_combat_panel.example.json")),
        readJson(path.join(exampleDir, "ye_shunguang_panel.example.json")),
    ])

    return normalizeCatalogPayload({
        agentsRaw,
        agentSkillsRaw,
        wEnginesRaw,
        driveDiscSetsRaw,
        combatBuffsRaw,
        anomalyEffectsRaw,
        statRulesRaw,
        exampleRaw,
        yeShunguangExampleRaw,
    })
}

export async function loadCalculatorContext(rootDir) {
    const dataDir = path.join(rootDir, "data")
    const exampleDir = path.join(rootDir, "examples")
    return loadCatalog(dataDir, exampleDir)
}
