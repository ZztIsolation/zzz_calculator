import {
  migrateConfirmedLegacyEnkaStatUnits,
  planDriveDiscReconciliation,
} from "../inventory-model.js"

const MANAGED_SOURCE = "enka-zzz-showcase"
const LEGACY_MANAGED_SOURCE = "enka-showcase"

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
  return Boolean(item?.provenance?.enkaZzz)
    || [MANAGED_SOURCE, LEGACY_MANAGED_SOURCE].includes(item?.source?.type)
}

function isManagedFor(item, uid, agentId = null) {
  if (!isManaged(item)) return false
  const sourceUid = item?.provenance?.enkaZzz?.uid ?? item?.source?.uid
  const sourceAgentId = item?.provenance?.enkaZzz?.lastAgentId ?? item?.source?.agentId
  if (sourceUid != null && String(sourceUid) !== uid) return false
  return agentId == null || String(sourceAgentId ?? "") === agentId
}

export function enkaDriveDiscId(uid, equipmentUid) {
  return `enka-zzz:${uid}:${equipmentUid}`
}

export function enkaLoadoutId(uid, agentId) {
  return `enka-zzz:${uid}:${agentId}`
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

function isLegacyAutomaticLoadoutName(name) {
  const normalized = String(name ?? "").trim()
  return normalized === "Enka 当前装备" || /^Enka 当前装备 - .+$/.test(normalized)
}

function showcaseLoadoutName(existingName, agentName) {
  const normalized = String(existingName ?? "").trim()
  if (normalized && !isLegacyAutomaticLoadoutName(normalized)) return existingName
  return `展柜佩戴套装 - ${agentName}`
}

function legacyEquipmentUid(id) {
  const match = /^enka-(?!zzz:)(.+)$/.exec(String(id ?? ""))
  return match?.[1] ?? ""
}

function migrateLegacyManagedData(store, ownerId, uid, now) {
  const warnings = []
  const idChanges = new Map()
  const migrations = { driveDiscs: [], loadouts: [] }
  const legacyAgentByDiscId = new Map()
  for (const loadout of store.driveDiscLoadouts ?? []) {
    if (!belongsToOwner(loadout, ownerId)) continue
    const explicitLegacyLoadout = loadout?.source?.type === LEGACY_MANAGED_SOURCE
      || String(loadout?.id ?? "").startsWith("enka-showcase-")
    if (!explicitLegacyLoadout) continue
    for (const discId of Object.values(loadout.driveDiscIdsBySlot ?? {})) {
      legacyAgentByDiscId.set(String(discId), String(loadout.agentId ?? ""))
    }
  }
  const otherDiscs = []
  const scopedDiscs = []
  for (const disc of store.driveDiscs ?? []) {
    if (belongsToOwner(disc, ownerId)) scopedDiscs.push(clone(disc))
    else otherDiscs.push(clone(disc))
  }

  const byId = new Map(scopedDiscs.map(disc => [String(disc.id), disc]))
  let migratedDiscs = 0
  for (const disc of [...scopedDiscs]) {
    const oldId = String(disc.id)
    const equipmentUid = legacyEquipmentUid(disc.id)
    if (!equipmentUid) continue
    const legacyAgentId = String(disc?.source?.agentId ?? legacyAgentByDiscId.get(oldId) ?? "")
    const nextId = enkaDriveDiscId(uid, equipmentUid)
    const collision = byId.get(nextId)
    if (collision && collision !== disc) {
      if (!isManaged(collision)) {
        warnings.push(`旧 Enka 驱动盘 ${disc.id} 无法迁移：目标 ID 已被手动数据占用。`)
        continue
      }
      collision.reservedForAgentId ??= disc.reservedForAgentId ?? null
      collision.excludedForAgentIds = [...new Set([
        ...(collision.excludedForAgentIds ?? []),
        ...(disc.excludedForAgentIds ?? []),
      ])]
      scopedDiscs.splice(scopedDiscs.indexOf(disc), 1)
    } else {
      byId.delete(String(disc.id))
      Object.assign(disc, migrateConfirmedLegacyEnkaStatUnits(disc))
      disc.id = nextId
      disc.source = {
        ...disc.source,
        type: MANAGED_SOURCE,
        uid,
        ...(legacyAgentId ? { agentId: legacyAgentId } : {}),
        equipmentUid,
      }
      disc.updatedAt = now
      byId.set(nextId, disc)
    }
    idChanges.set(oldId, nextId)
    migrations.driveDiscs.push({
      agentId: legacyAgentId,
      beforeId: oldId,
      afterId: nextId,
      partition: disc.partition,
      setName: disc.setName,
    })
    migratedDiscs += 1
  }

  const otherLoadouts = []
  const scopedLoadouts = []
  for (const loadout of store.driveDiscLoadouts ?? []) {
    if (belongsToOwner(loadout, ownerId)) scopedLoadouts.push(clone(loadout))
    else otherLoadouts.push(clone(loadout))
  }
  let migratedLoadouts = 0
  for (const loadout of [...scopedLoadouts]) {
    const isLegacy = loadout?.source?.type === LEGACY_MANAGED_SOURCE
      || String(loadout?.id ?? "").startsWith("enka-showcase-")
    if (!isLegacy) continue
    const oldId = String(loadout.id)
    const nextId = enkaLoadoutId(uid, loadout.agentId)
    const collision = scopedLoadouts.find(candidate => candidate !== loadout && candidate.id === nextId)
    if (collision && !isManaged(collision)) {
      warnings.push(`旧 Enka 配装 ${loadout.id} 无法迁移：目标 ID 已被手动数据占用。`)
      continue
    }
    const migratedDriveDiscIdsBySlot = Object.fromEntries(
      Object.entries(loadout.driveDiscIdsBySlot ?? {}).map(([slot, id]) => [slot, idChanges.get(String(id)) ?? id]),
    )
    if (collision) {
      collision.driveDiscIdsBySlot = Object.keys(collision.driveDiscIdsBySlot ?? {}).length
        ? Object.fromEntries(Object.entries(collision.driveDiscIdsBySlot).map(([slot, id]) => [slot, idChanges.get(String(id)) ?? id]))
        : migratedDriveDiscIdsBySlot
      collision.source = { ...collision.source, type: MANAGED_SOURCE, uid, agentId: collision.agentId }
      collision.updatedAt = now
      scopedLoadouts.splice(scopedLoadouts.indexOf(loadout), 1)
      migrations.loadouts.push({ agentId: String(loadout.agentId ?? ""), beforeId: oldId, afterId: nextId })
      migratedLoadouts += 1
      continue
    }
    loadout.id = nextId
    loadout.driveDiscIdsBySlot = migratedDriveDiscIdsBySlot
    loadout.source = { ...loadout.source, type: MANAGED_SOURCE, uid, agentId: loadout.agentId }
    loadout.updatedAt = now
    migrations.loadouts.push({ agentId: String(loadout.agentId ?? ""), beforeId: oldId, afterId: nextId })
    migratedLoadouts += 1
  }

  return {
    store: {
      ...clone(store),
      driveDiscs: [...otherDiscs, ...scopedDiscs],
      driveDiscLoadouts: [...otherLoadouts, ...scopedLoadouts],
    },
    migratedDiscs,
    migratedLoadouts,
    migrations,
    warnings,
  }
}

function replaceOwnerDriveDiscs(allDiscs, ownerId, nextOwnerDiscs) {
  const nextById = new Map(nextOwnerDiscs.map(disc => [String(disc.id), disc]))
  const result = []
  for (const disc of allDiscs ?? []) {
    if (!belongsToOwner(disc, ownerId)) {
      result.push(disc)
      continue
    }
    const replacement = nextById.get(String(disc.id))
    if (!replacement) continue
    result.push(replacement)
    nextById.delete(String(disc.id))
  }
  result.push(...nextById.values())
  return result
}

function operationSummary(item) {
  const disc = item?.after ?? item
  return {
    id: disc?.id,
    partition: disc?.partition,
    setName: disc?.setName,
    provenance: clone(disc?.provenance),
    source: clone(disc?.source),
    reason: item?.reason ?? null,
  }
}

export function buildDriveDiscSyncPlan({
  uid,
  mappedAgents,
  driveDiscState,
  resolutions = {},
  now = new Date(),
}) {
  const ownerId = String(driveDiscState.ownerId)
  const normalizedUid = String(uid ?? "").trim()
  const nowIso = now.toISOString()
  const migrated = migrateLegacyManagedData(driveDiscState.store, ownerId, normalizedUid, nowIso)
  let nextDriveDiscs = [...clone(migrated.store.driveDiscs ?? [])]
  const nextLoadouts = [...clone(migrated.store.driveDiscLoadouts ?? [])]
  const results = []
  const warnings = [...migrated.warnings]
  let addedDiscs = 0
  let updatedDiscs = 0
  let unequippedDiscs = 0
  let sourceMergedDiscs = 0
  let historicalDuplicates = 0
  const conflicts = []

  for (const agent of mappedAgents ?? []) {
    const presetDiscs = agent.driveDiscPreset?.driveDiscs ?? []
    const sourceCount = agent.driveDiscSourceCount
    const operations = {
      added: [],
      updated: [],
      sourceMerged: [],
      unequipped: [],
      conflicts: [],
      migratedDiscs: migrated.migrations.driveDiscs.filter(item => item.agentId === agent.agentId),
      migratedLoadouts: migrated.migrations.loadouts.filter(item => item.agentId === agent.agentId),
    }
    const canSynchronize = presetDiscs.length > 0
    if (!canSynchronize) {
      const reason = sourceCount === 0
        ? "展柜未返回驱动盘，已保留原库存和配装。"
        : "原始驱动盘存在，但没有可安全导入的盘，已保留原库存和配装。"
      results.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        driveDiscIdsBySlot: {},
        hasUsableLoadout: false,
        changed: operations.migratedDiscs.length > 0 || operations.migratedLoadouts.length > 0,
        skipped: true,
        reason,
        operations,
      })
      continue
    }

    const loadoutId = enkaLoadoutId(normalizedUid, agent.agentId)
    const loadoutIndex = nextLoadouts.findIndex(item => belongsToOwner(item, ownerId) && item.id === loadoutId)
    const existingLoadout = loadoutIndex >= 0 ? nextLoadouts[loadoutIndex] : null
    if (existingLoadout && !isManagedFor(existingLoadout, normalizedUid)) {
      warnings.push(`${agent.agentName} 的 Enka 数据与手动数据 ID 冲突，已保留原库存和配装。`)
      results.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        driveDiscIdsBySlot: {},
        hasUsableLoadout: false,
        changed: operations.migratedDiscs.length > 0 || operations.migratedLoadouts.length > 0,
        skipped: true,
        reason: "ID 冲突",
        operations,
      })
      continue
    }

    let agentChanged = operations.migratedDiscs.length > 0 || operations.migratedLoadouts.length > 0
    const ownerDiscs = nextDriveDiscs.filter(item => belongsToOwner(item, ownerId))
    const reconciliation = planDriveDiscReconciliation({
      existingDiscs: ownerDiscs,
      importedDiscs: presetDiscs,
      ownerId,
      sourceKind: "enka",
      resolutions,
      now: nowIso,
    })
    nextDriveDiscs = replaceOwnerDriveDiscs(nextDriveDiscs, ownerId, reconciliation.driveDiscs)
    operations.added.push(...reconciliation.added.map(operationSummary))
    operations.updated.push(...reconciliation.updated.map(operationSummary))
    operations.sourceMerged.push(...reconciliation.sourceMerged.map(operationSummary))
    operations.conflicts.push(...reconciliation.conflicts)
    warnings.push(...reconciliation.warnings)
    conflicts.push(...reconciliation.conflicts.map(conflict => ({
      ...conflict,
      agentId: agent.agentId,
      agentName: agent.agentName,
    })))
    addedDiscs += reconciliation.added.length
    updatedDiscs += reconciliation.updated.length
    sourceMergedDiscs += reconciliation.sourceMerged.length
    historicalDuplicates += reconciliation.historicalDuplicates
    agentChanged ||= reconciliation.changed

    const desiredIds = new Set(presetDiscs
      .map(disc => reconciliation.resolvedIds[String(disc.id)])
      .filter(Boolean))
    const idsBySlot = Object.fromEntries(presetDiscs.map(disc => [
      String(disc.partition),
      reconciliation.resolvedIds[String(disc.id)],
    ]).filter(([, id]) => Boolean(id)))

    if (reconciliation.conflicts.length) {
      results.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        loadoutId,
        driveDiscIdsBySlot: idsBySlot,
        hasUsableLoadout: false,
        changed: agentChanged,
        skipped: true,
        reason: "存在待确认的疑似同盘",
        operations,
      })
      continue
    }

    for (let index = 0; index < nextDriveDiscs.length; index += 1) {
      const disc = nextDriveDiscs[index]
      if (!belongsToOwner(disc, ownerId)
        || !isManagedFor(disc, normalizedUid, agent.agentId)
        || desiredIds.has(String(disc.id))
        || String(disc.equippedBy ?? "") !== agent.agentId) continue
      nextDriveDiscs[index] = { ...disc, equippedBy: "", updatedAt: nowIso }
      operations.unequipped.push(operationSummary(disc))
      unequippedDiscs += 1
      agentChanged = true
    }

    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !idsBySlot[String(slot)])
    if (presetDiscs.length || existingLoadout) {
      const desiredLoadout = {
        ...(existingLoadout ?? {}),
        id: loadoutId,
        ownerId,
        agentId: agent.agentId,
        name: showcaseLoadoutName(existingLoadout?.name, agent.agentName),
        driveDiscIdsBySlot: idsBySlot,
        status: missingSlots.length ? "incomplete" : "complete",
        missingSlots,
        missingDriveDiscIds: [],
        source: { type: MANAGED_SOURCE, uid: normalizedUid, agentId: agent.agentId },
        score: existingLoadout?.score ?? null,
        createdAt: existingLoadout?.createdAt ?? nowIso,
        updatedAt: existingLoadout?.updatedAt ?? nowIso,
      }
      if (!existingLoadout) {
        nextLoadouts.push(desiredLoadout)
        agentChanged = true
      } else if (!sameValue(loadoutSignature(existingLoadout), loadoutSignature(desiredLoadout))) {
        nextLoadouts[loadoutIndex] = desiredLoadout
        agentChanged = true
      }
    }

    results.push({
      agentId: agent.agentId,
      agentName: agent.agentName,
      loadoutId,
      driveDiscIdsBySlot: idsBySlot,
      hasUsableLoadout: presetDiscs.length > 0,
      changed: agentChanged,
      operations,
      before: existingLoadout ? `${Object.keys(existingLoadout.driveDiscIdsBySlot ?? {}).length}/6 张` : "未保存",
      after: `${presetDiscs.length}/6 张`,
    })
  }

  const changed = migrated.migratedDiscs > 0
    || migrated.migratedLoadouts > 0
    || results.some(result => result.changed)
  return {
    changed,
    results,
    warnings,
    addedDiscs,
    updatedDiscs,
    sourceMergedDiscs,
    historicalDuplicates,
    unequippedDiscs,
    migratedDiscs: migrated.migratedDiscs,
    migratedLoadouts: migrated.migratedLoadouts,
    migrations: migrated.migrations,
    conflicts,
    hasUnresolvedConflicts: conflicts.length > 0,
    presetCount: results.filter(result => result.changed && result.hasUsableLoadout).length,
    nextStore: changed
      ? { ...clone(migrated.store), driveDiscs: nextDriveDiscs, driveDiscLoadouts: nextLoadouts }
      : clone(driveDiscState.store),
  }
}
