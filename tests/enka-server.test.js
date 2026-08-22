import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ENKA_RUNTIME_MAPPING_FILE, loadEnkaMappingSnapshot } from "../backend/enkaMapping.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const legacyValidationCatalogs = [
  "agents.json",
  "agent_skills.json",
  "anomaly_effects.json",
  "bosses.json",
  "combat_buffs.json",
  "drive_disc_sets.json",
  "stat_rules.json",
  "w_engines.json",
]

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve(server.address().port))
  })
}

async function freePort() {
  const server = createServer()
  const port = await listen(server)
  await new Promise(resolve => server.close(resolve))
  return port
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Calculator server exited early (${child.exitCode}).\n${output()}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Calculator server did not start.\n${output()}`)
}

function startCalculator(port, env = {}) {
  let logs = ""
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout.on("data", chunk => { logs += chunk })
  child.stderr.on("data", chunk => { logs += chunk })
  return { child, output: () => logs }
}

async function createLegacyValidationDataDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "zzz-enka-disabled-data-"))
  await Promise.all(legacyValidationCatalogs.map(fileName => (
    copyFile(path.join(rootDir, "data", fileName), path.join(directory, fileName))
  )))
  return directory
}

async function provePackagedMappingSurvivesLegacyValidationData() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "zzz-enka-runtime-mapping-"))
  const backendDir = path.join(directory, "backend")
  const legacyDataDir = path.join(directory, "data")
  await mkdir(backendDir)
  await mkdir(legacyDataDir)
  await copyFile(
    path.join(rootDir, "data", "enka_zzz_mapping.json"),
    path.join(backendDir, ENKA_RUNTIME_MAPPING_FILE),
  )
  try {
    const mapping = await loadEnkaMappingSnapshot(backendDir, legacyDataDir)
    assert.equal(mapping.source.commit, "dc86b5dc06ad27d26c9a4df9f0b6ffd0417bf554")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function waitForExit(child) {
  if (child.exitCode != null) return child.exitCode
  return Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Calculator server did not exit.")), 3000)),
  ])
}

async function stop(child) {
  if (child.exitCode != null) return
  child.kill()
  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ])
}

const showcase = {
  ttl: 45,
  PlayerInfo: {
    ShowcaseDetail: {
      AvatarList: [{
        Id: 1091,
        Level: 60,
        TalentLevel: 6,
        CoreSkillEnhancement: 6,
        SkillLevelList: [0, 1, 2, 3, 6].map(Index => ({ Index, Level: 12 })),
        Weapon: { Id: 14109, Level: 0, UpgradeLevel: 2 },
        EquippedList: [],
      }],
    },
  },
}

const upstream = createServer((req, res) => {
  if (req.url !== "/1302309616") {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "max-age=45" })
  const body = JSON.stringify(showcase)
  res.write(body.slice(0, 40))
  res.end(body.slice(40))
})
const upstreamPort = await listen(upstream)
await provePackagedMappingSurvivesLegacyValidationData()

let enabled
let disabled
let enabledWithoutMapping
let legacyValidationDataDir
try {
  const enabledPort = await freePort()
  enabled = startCalculator(enabledPort, {
    ENKA_IMPORT_ENABLED: "true",
    ENKA_API_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
  })
  const enabledBase = `http://127.0.0.1:${enabledPort}`
  await waitForServer(`${enabledBase}/api/health`, enabled.child, enabled.output)

  const config = await (await fetch(`${enabledBase}/api/app-config`)).json()
  assert.equal(config.enkaImportEnabled, true)

  const response = await fetch(`${enabledBase}/api/enka/zzz/1302309616`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("access-control-allow-origin"), null)
  assert.equal(body.ok, true)
  assert.equal(body.uid, "1302309616")
  assert.equal(body.ttlSeconds, 45)
  assert.equal(body.agents[0].agentId, "hoshimi_miyabi")
  assert.equal(body.agents[0].skillLevels.basic, 16)
  assert.equal(body.agents[0].wEngine.level, 0)
  assert.equal(Object.hasOwn(body, "showcase"), false)

  const crossOrigin = await fetch(`${enabledBase}/api/enka/zzz/1302309616`, { headers: { Origin: "https://evil.example" } })
  assert.equal(crossOrigin.status, 403)
  const malformed = await fetch(`${enabledBase}/api/enka/zzz/%25`)
  assert.equal(malformed.status, 400)

  legacyValidationDataDir = await createLegacyValidationDataDir()
  const disabledPort = await freePort()
  disabled = startCalculator(disabledPort, {
    ENKA_IMPORT_ENABLED: "false",
    ZZZ_CALCULATOR_DATA_DIR: legacyValidationDataDir,
  })
  const disabledBase = `http://127.0.0.1:${disabledPort}`
  await waitForServer(`${disabledBase}/api/health`, disabled.child, disabled.output)
  const disabledConfig = await (await fetch(`${disabledBase}/api/app-config`)).json()
  assert.equal(disabledConfig.enkaImportEnabled, false)
  assert.equal((await fetch(`${disabledBase}/api/enka/zzz/1302309616`)).status, 404)

  await stop(disabled.child)
  const missingMappingPort = await freePort()
  enabledWithoutMapping = startCalculator(missingMappingPort, {
    ENKA_IMPORT_ENABLED: "true",
    ZZZ_CALCULATOR_DATA_DIR: legacyValidationDataDir,
  })
  assert.notEqual(await waitForExit(enabledWithoutMapping.child), 0)
  assert.match(enabledWithoutMapping.output(), /enka_zzz_mapping\.json/)
} finally {
  await stop(enabled?.child)
  await stop(disabled?.child)
  await stop(enabledWithoutMapping?.child)
  await new Promise(resolve => upstream.close(resolve))
  if (legacyValidationDataDir) await rm(legacyValidationDataDir, { recursive: true, force: true })
}

console.log("enka-server.test.js: all assertions passed")
