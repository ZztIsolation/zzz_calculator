const MANAGED_SOURCE = "enka-showcase"
const LEGACY_LOADOUT_NAME = "Enka 当前装备"

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function belongsToOwner(item, ownerId) {
  return String(item?.ownerId ?? "default") === ownerId
}

function isManaged(item) {
  return item?.source?.type === MANAGED_SOURCE
}

function discSignature(disc) {
  return {
    id: disc?.id,
    ownerId: disc?.ownerId,
    setId: disc?.setId,
    setName: disc?.setName,
    partition: disc?.partition,
    rarity: disc?.rarity,
    level: disc?.level,
    maxLevel: disc?.maxLevel,
    locked: disc?.locked,
    equippedBy: disc?.equippedBy,
    reservedForAgentId: disc?.reservedForAgentId ?? null,
    mainStat: disc?.mainStat,
    subStats: disc?.subStats,
    source: disc?.source,
  }
}

function loadoutSignature(loadout) {
  return {
    id: loadout?.id,
    ownerId: loadout?.ownerId,
    agentId: loadout?.agentId,
    name: loadout?.name,
    driveDiscIdsBySlot: loadout?.driveDiscIdsBySlot,
    status: loadout?.status,
    missingSlots: loadout?.missingSlots,
    missingDriveDiscIds: loadout?.missingDriveDiscIds,
    source: loadout?.source,
  }
}

function loadoutCount(loadout) {
  return Object.keys(loadout?.driveDiscIdsBySlot ?? {}).length
}

function itemIds(items) {
  return items.map(item => String(item?.id ?? "").trim())
}

function padDatePart(value) {
  return String(value).padStart(2, "0")
}

function formatLoadoutName(agentName, now) {
  const timestamp = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join("-")
  const time = `${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`
  return `${agentName} - ${timestamp} ${time}`
}

function isGeneratedLoadoutName(name, agentName) {
  const prefix = `${agentName} - `
  return name.startsWith(prefix)
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(name.slice(prefix.length))
}

export function buildDriveDiscSyncPlan({ mappedAgents, driveDiscState, now = new Date() }) {
  const ownerId = driveDiscState.ownerId
  const store = driveDiscState.store
  const nextDriveDiscs = [...clone(store.driveDiscs ?? [])]
  const nextLoadouts = [...clone(store.driveDiscLoadouts ?? [])]
  const results = []
  const warnings = []
  let addedDiscs = 0
  let updatedDiscs = 0

  for (const agent of mappedAgents ?? []) {
    const preset = agent.driveDiscPreset
    if (!preset?.driveDiscs?.length) continue
    const loadoutId = `enka-showcase-${agent.agentId}`
    const desiredIds = new Set(preset.driveDiscs.map(disc => disc.id))
    const collisions = nextDriveDiscs.filter(item =>
      belongsToOwner(item, ownerId) && desiredIds.has(item.id) && !isManaged(item)
    )
    const loadoutIndex = nextLoadouts.findIndex(item => belongsToOwner(item, ownerId) && item.id === loadoutId)
    const existingLoadout = loadoutIndex >= 0 ? nextLoadouts[loadoutIndex] : null
    if (collisions.length || (existingLoadout && !isManaged(existingLoadout))) {
      warnings.push(`${agent.agentName} 的 Enka 驱动盘 ID 与手动数据冲突，已保留原库存和预设。`)
      continue
    }

    let agentChanged = false
    for (const imported of preset.driveDiscs) {
      const index = nextDriveDiscs.findIndex(item => belongsToOwner(item, ownerId) && item.id === imported.id)
      const existing = index >= 0 ? nextDriveDiscs[index] : null
      const desired = {
        ...clone(imported),
        ownerId,
        reservedForAgentId: existing?.reservedForAgentId ?? null,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: existing?.updatedAt ?? now.toISOString(),
      }
      if (!existing) {
        nextDriveDiscs.push(desired)
        addedDiscs += 1
        agentChanged = true
      } else if (!sameValue(discSignature(existing), discSignature(desired))) {
        desired.updatedAt = now.toISOString()
        nextDriveDiscs[index] = desired
        updatedDiscs += 1
        agentChanged = true
      }
    }

    const idsBySlot = Object.fromEntries(preset.driveDiscs.map(disc => [String(disc.partition), disc.id]))
    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !idsBySlot[String(slot)])
    const existingName = String(existingLoadout?.name ?? "").trim()
    const equipmentChanged = agentChanged
      || (existingLoadout && !sameValue(existingLoadout.driveDiscIdsBySlot, idsBySlot))
    const shouldGenerateName = !existingLoadout
      || !existingName
      || existingName === LEGACY_LOADOUT_NAME
      || (equipmentChanged && isGeneratedLoadoutName(existingName, agent.agentName))
    const desiredLoadout = {
      id: loadoutId,
      ownerId,
      agentId: agent.agentId,
      name: shouldGenerateName ? formatLoadoutName(agent.agentName, now) : existingLoadout.name,
      driveDiscIdsBySlot: idsBySlot,
      status: missingSlots.length ? "incomplete" : "complete",
      missingSlots,
      missingDriveDiscIds: [],
      source: { type: MANAGED_SOURCE, agentId: agent.agentId },
      score: existingLoadout?.score ?? null,
      createdAt: existingLoadout?.createdAt ?? now.toISOString(),
      updatedAt: existingLoadout?.updatedAt ?? now.toISOString(),
    }
    if (!existingLoadout) {
      nextLoadouts.push(desiredLoadout)
      agentChanged = true
    } else if (!sameValue(loadoutSignature(existingLoadout), loadoutSignature(desiredLoadout))) {
      desiredLoadout.updatedAt = now.toISOString()
      nextLoadouts[loadoutIndex] = desiredLoadout
      agentChanged = true
    }

    results.push({
      agentId: agent.agentId,
      agentName: agent.agentName,
      changed: agentChanged,
      before: existingLoadout ? `${loadoutCount(existingLoadout)}/6 张` : "未保存",
      after: `${preset.driveDiscs.length}/6 张`,
    })
  }

  const changed = results.some(result => result.changed)
  return {
    changed,
    changeCount: results.filter(result => result.changed).length,
    results,
    warnings,
    addedDiscs,
    updatedDiscs,
    presetCount: results.filter(result => result.changed).length,
    nextStore: changed ? { ...clone(store), driveDiscs: nextDriveDiscs, driveDiscLoadouts: nextLoadouts } : clone(store),
  }
}

export function mergeDriveDiscPlan(configPlan, driveDiscPlan) {
  const changesByAgent = new Map(driveDiscPlan.results.map(result => [result.agentId, result]))
  const agents = configPlan.agents.map(agent => {
    const drive = changesByAgent.get(agent.agentId)
    const changes = [...agent.changes]
    if (drive?.changed) {
      changes.push({
        field: "driveDiscLoadout",
        label: "驱动盘预设",
        before: drive.before,
        after: drive.after,
      })
    }
    return { ...agent, changes, changed: changes.length > 0 }
  })
  return {
    ...configPlan,
    agents,
    warnings: [...configPlan.warnings, ...driveDiscPlan.warnings],
    changeCount: agents.reduce((sum, agent) => sum + agent.changes.length, 0),
    driveDiscPlan,
  }
}
