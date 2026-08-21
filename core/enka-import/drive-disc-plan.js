import {
  migrateConfirmedLegacyEnkaStatUnits,
  planDriveDiscReconciliation,
  validateEnkaDriveDiscIdentities,
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

function hasExplicitEnkaOrigin(item) {
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

function isCanonicalManagedLoadoutFor(loadout, uid, agentId) {
  if (!isManaged(loadout)) return false
  if (String(loadout?.agentId ?? "") !== agentId) return false
  const sourceUid = loadout?.provenance?.enkaZzz?.uid ?? loadout?.source?.uid
  const sourceAgentId = loadout?.provenance?.enkaZzz?.lastAgentId ?? loadout?.source?.agentId
  if (sourceUid != null && String(sourceUid) !== uid) return false
  return sourceAgentId == null || String(sourceAgentId) === agentId
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
    const explicitLegacyLoadout = hasExplicitEnkaOrigin(loadout)
      && (loadout?.source?.type === LEGACY_MANAGED_SOURCE
        || String(loadout?.id ?? "").startsWith("enka-showcase-"))
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
    if (!equipmentUid || !hasExplicitEnkaOrigin(disc)) continue
    const legacyAgentId = String(disc?.source?.agentId ?? legacyAgentByDiscId.get(oldId) ?? "")
    const nextId = enkaDriveDiscId(uid, equipmentUid)
    const collision = byId.get(nextId)
    if (collision && collision !== disc) {
      if (!isManaged(collision)) {
        warnings.push(`旧 Enka 驱动盘 ${disc.id} 无法迁移：目标 ID 已被手动数据占用。`)
        continue
      }
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
    const isLegacy = hasExplicitEnkaOrigin(loadout)
      && (loadout?.source?.type === LEGACY_MANAGED_SOURCE
        || String(loadout?.id ?? "").startsWith("enka-showcase-"))
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

function emptyMigration(store) {
  return {
    store: clone(store),
    migratedDiscs: 0,
    migratedLoadouts: 0,
    migrations: { driveDiscs: [], loadouts: [] },
    warnings: [],
  }
}

function ownerHasEnkaBinding(store, ownerId) {
  return Boolean(store?.enkaImportState?.byOwner?.[ownerId]?.binding)
}

function validateLegacyManagedUids(store, ownerId, confirmedUid) {
  const blockingErrors = []
  const candidates = [
    ...(store?.driveDiscs ?? [])
      .filter(item => belongsToOwner(item, ownerId)
        && legacyEquipmentUid(item?.id)
        && hasExplicitEnkaOrigin(item))
      .map(item => ({ kind: "driveDisc", item })),
    ...(store?.driveDiscLoadouts ?? [])
      .filter(item => belongsToOwner(item, ownerId)
        && hasExplicitEnkaOrigin(item)
        && (item?.source?.type === LEGACY_MANAGED_SOURCE
          || String(item?.id ?? "").startsWith("enka-showcase-")))
      .map(item => ({ kind: "loadout", item })),
  ]
  for (const { kind, item } of candidates) {
    const seenSourceUids = new Set()
    const observedUids = [
      ...(item?.provenance?.enkaZzz ? [{ sourceKind: "provenance", uid: item.provenance.enkaZzz.uid }] : []),
      ...([MANAGED_SOURCE, LEGACY_MANAGED_SOURCE].includes(item?.source?.type)
        ? [{ sourceKind: "source", uid: item.source.uid }]
        : []),
    ]
    for (const observed of observedUids) {
      const sourceUid = String(observed.uid ?? "").trim()
      if (!sourceUid || sourceUid === confirmedUid || seenSourceUids.has(sourceUid)) continue
      seenSourceUids.add(sourceUid)
      blockingErrors.push({
        code: "LEGACY_ENKA_UID_MISMATCH",
        message: `旧 Enka ${kind === "driveDisc" ? "驱动盘" : "配装"} ${item?.id ?? "未知"} 的来源 UID 与本次确认 UID 不一致。`,
        details: {
          kind,
          id: String(item?.id ?? ""),
          confirmedUid,
          sourceUid,
          sourceKind: observed.sourceKind,
        },
      })
    }
  }
  return blockingErrors
}

function validateMappedAgentDriveDiscOwnership(mappedAgents) {
  const blockingErrors = []
  for (const agent of mappedAgents ?? []) {
    const agentId = String(agent?.agentId ?? "").trim()
    const preset = agent?.driveDiscPreset
    if (preset && Object.prototype.hasOwnProperty.call(preset, "agentId")) {
      const presetAgentId = String(preset.agentId ?? "").trim()
      if (!presetAgentId || presetAgentId !== agentId) {
        blockingErrors.push({
          code: "ENKA_PRESET_AGENT_MISMATCH",
          message: `${agent?.agentName || agentId || "角色"} 的驱动盘套装来源角色不一致。`,
          details: { agentId, presetAgentId },
        })
      }
    }
    for (const disc of preset?.driveDiscs ?? []) {
      const provenance = disc?.provenance?.enkaZzz
      const source = [MANAGED_SOURCE, LEGACY_MANAGED_SOURCE].includes(disc?.source?.type) ? disc.source : null
      const equipmentUid = String(provenance?.equipmentUid ?? source?.equipmentUid ?? disc?.id ?? "")
      const observations = [
        ...(provenance ? [{ kind: "provenance", value: provenance.lastAgentId }] : []),
        ...(source ? [{ kind: "source", value: source.agentId }] : []),
        { kind: "equippedBy", value: disc?.equippedBy },
      ]
      for (const observation of observations) {
        const observedAgentId = String(observation.value ?? "").trim()
        if (observedAgentId === agentId) continue
        blockingErrors.push({
          code: observedAgentId ? "ENKA_DISC_AGENT_MISMATCH" : "ENKA_DISC_AGENT_MISSING",
          message: observedAgentId
            ? `${agent?.agentName || agentId || "角色"} 的驱动盘 ${equipmentUid || "未知"} 来源角色不一致。`
            : `${agent?.agentName || agentId || "角色"} 的驱动盘 ${equipmentUid || "未知"} 缺少来源角色。`,
          details: { agentId, observedAgentId, equipmentUid, sourceKind: observation.kind },
        })
      }
    }
  }
  return blockingErrors
}

function removeDiscFromPriorManagedLoadouts(loadouts, {
  ownerId,
  uid,
  targetAgentId,
  driveDiscId,
  now,
  affectedLoadoutIds,
  deletedLoadoutIds,
  removedLoadoutDiscReferences,
}) {
  for (let index = loadouts.length - 1; index >= 0; index -= 1) {
    const loadout = loadouts[index]
    if (!belongsToOwner(loadout, ownerId)
      || !isManagedFor(loadout, uid)
      || String(loadout.agentId ?? "") === targetAgentId) continue
    const removedSlots = Object.entries(loadout.driveDiscIdsBySlot ?? {})
      .filter(([, id]) => String(id) === driveDiscId)
      .map(([slot]) => String(slot))
    if (!removedSlots.length) continue

    const nextIdsBySlot = { ...(loadout.driveDiscIdsBySlot ?? {}) }
    for (const slot of removedSlots) delete nextIdsBySlot[slot]
    affectedLoadoutIds.add(String(loadout.id))
    removedLoadoutDiscReferences.push({
      loadoutId: String(loadout.id),
      agentId: String(loadout.agentId ?? ""),
      driveDiscId,
      slots: removedSlots,
    })
    if (!Object.keys(nextIdsBySlot).length) {
      deletedLoadoutIds.add(String(loadout.id))
      loadouts.splice(index, 1)
      continue
    }

    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !nextIdsBySlot[String(slot)])
    loadouts[index] = {
      ...loadout,
      driveDiscIdsBySlot: nextIdsBySlot,
      status: missingSlots.length ? "incomplete" : "complete",
      missingSlots,
      missingDriveDiscIds: [],
      updatedAt: now,
    }
  }
}

function blockedSyncPlan(store, mappedAgents, blockingErrors) {
  return {
    changed: false,
    results: (mappedAgents ?? []).map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      driveDiscIdsBySlot: {},
      hasUsableLoadout: false,
      changed: false,
      skipped: true,
      reason: "展柜驱动盘身份异常",
      operations: {
        added: [],
        updated: [],
        sourceMerged: [],
        unequipped: [],
        conflicts: [],
        migratedDiscs: [],
        migratedLoadouts: [],
      },
    })),
    warnings: blockingErrors.map(error => error.message),
    blockingErrors,
    hasBlockingErrors: true,
    addedDiscs: 0,
    updatedDiscs: 0,
    sourceMergedDiscs: 0,
    historicalDuplicates: 0,
    unequippedDiscs: 0,
    migratedDiscs: 0,
    migratedLoadouts: 0,
    migrations: { driveDiscs: [], loadouts: [] },
    conflicts: [],
    hasUnresolvedConflicts: true,
    presetCount: 0,
    affectedLoadoutIds: [],
    deletedLoadoutIds: [],
    removedLoadoutDiscReferences: [],
    nextStore: clone(store),
  }
}

function validateCanonicalEnkaLoadoutIds(store, ownerId, uid, mappedAgents) {
  const blockingErrors = []
  const seenIds = new Set()
  for (const agent of mappedAgents ?? []) {
    if (!(agent?.driveDiscPreset?.driveDiscs?.length > 0)) continue
    const agentId = String(agent?.agentId ?? "")
    const canonicalId = enkaLoadoutId(uid, agentId)
    if (seenIds.has(canonicalId)) continue
    seenIds.add(canonicalId)
    const occupants = (store?.driveDiscLoadouts ?? []).filter(loadout =>
      belongsToOwner(loadout, ownerId) && String(loadout?.id ?? "") === canonicalId
    )
    if (!occupants.length) continue
    const unsafeOccupant = occupants.find(loadout => !isCanonicalManagedLoadoutFor(loadout, uid, agentId))
    if (occupants.length === 1 && !unsafeOccupant) continue
    const existing = unsafeOccupant ?? occupants[1]
    blockingErrors.push({
      code: "ENKA_CANONICAL_LOADOUT_ID_COLLISION",
      message: `${agent?.agentName || agentId || "角色"} 的展柜套装 ID 已被其他套装占用，无法安全导入。`,
      details: {
        uid,
        agentId,
        canonicalId,
        occupantCount: occupants.length,
        existingAgentId: String(existing?.agentId ?? ""),
        existingSourceType: String(existing?.source?.type ?? ""),
      },
    })
  }
  return blockingErrors
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
  const importedDiscs = (mappedAgents ?? []).flatMap(agent => agent.driveDiscPreset?.driveDiscs ?? [])
  const ownerDiscs = (driveDiscState.store?.driveDiscs ?? []).filter(item => belongsToOwner(item, ownerId))
  const identityValidation = validateEnkaDriveDiscIdentities(importedDiscs, {
    expectedUid: normalizedUid,
    existingDiscs: ownerDiscs,
  })
  const blockingErrors = [
    ...validateMappedAgentDriveDiscOwnership(mappedAgents),
    ...identityValidation.blockingErrors,
    ...validateCanonicalEnkaLoadoutIds(driveDiscState.store, ownerId, normalizedUid, mappedAgents),
  ]
  if (blockingErrors.length) {
    return blockedSyncPlan(driveDiscState.store, mappedAgents, blockingErrors)
  }
  const hasBinding = ownerHasEnkaBinding(driveDiscState.store, ownerId)
  if (!hasBinding) {
    const legacyUidErrors = validateLegacyManagedUids(driveDiscState.store, ownerId, normalizedUid)
    if (legacyUidErrors.length) {
      return blockedSyncPlan(driveDiscState.store, mappedAgents, legacyUidErrors)
    }
  }
  const migrated = hasBinding
    ? emptyMigration(driveDiscState.store)
    : migrateLegacyManagedData(driveDiscState.store, ownerId, normalizedUid, nowIso)
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
  const affectedLoadoutIds = new Set()
  const deletedLoadoutIds = new Set()
  const removedLoadoutDiscReferences = []

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
    if (reconciliation.hasBlockingErrors) {
      return blockedSyncPlan(driveDiscState.store, mappedAgents, reconciliation.blockingErrors)
    }
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
    for (const driveDiscId of desiredIds) {
      const removedReferenceCount = removedLoadoutDiscReferences.length
      removeDiscFromPriorManagedLoadouts(nextLoadouts, {
        ownerId,
        uid: normalizedUid,
        targetAgentId: String(agent.agentId),
        driveDiscId: String(driveDiscId),
        now: nowIso,
        affectedLoadoutIds,
        deletedLoadoutIds,
        removedLoadoutDiscReferences,
      })
      if (removedLoadoutDiscReferences.length > removedReferenceCount) agentChanged = true
    }
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
        updatedAt: nowIso,
      }
      if (!existingLoadout) {
        nextLoadouts.push(desiredLoadout)
        affectedLoadoutIds.add(loadoutId)
        agentChanged = true
      } else if (!sameValue(loadoutSignature(existingLoadout), loadoutSignature(desiredLoadout))) {
        const currentLoadoutIndex = nextLoadouts.findIndex(item => belongsToOwner(item, ownerId) && item.id === loadoutId)
        nextLoadouts[currentLoadoutIndex] = desiredLoadout
        affectedLoadoutIds.add(loadoutId)
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
    blockingErrors,
    hasBlockingErrors: false,
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
    affectedLoadoutIds: [...affectedLoadoutIds],
    deletedLoadoutIds: [...deletedLoadoutIds],
    removedLoadoutDiscReferences,
    presetCount: results.filter(result => result.changed && result.hasUsableLoadout).length,
    nextStore: changed
      ? { ...clone(migrated.store), driveDiscs: nextDriveDiscs, driveDiscLoadouts: nextLoadouts }
      : clone(driveDiscState.store),
  }
}
