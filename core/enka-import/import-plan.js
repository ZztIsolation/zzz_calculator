import { buildDriveDiscSyncPlan } from "./drive-disc-plan.js"
import { normalizeInventoryStore } from "../inventory-model.js"

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function jsonFingerprint(value) {
  const text = JSON.stringify(value ?? null)
  let hash = 1469598103934665603n
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return `${text.length}:${hash.toString(16).padStart(16, "0")}`
}

function ownerSelection(document, ownerId) {
  if (document?.byOwner && typeof document.byOwner === "object") {
    return document.byOwner[ownerId] ?? { currentAgentId: null, byAgent: {} }
  }
  if (ownerId === "default" && document && typeof document === "object") {
    return { currentAgentId: document.currentAgentId ?? null, byAgent: document.byAgent ?? {} }
  }
  return { currentAgentId: null, byAgent: {} }
}

function withOwnerSelection(document, ownerId, selection) {
  const source = document?.byOwner && typeof document.byOwner === "object" ? document : {}
  return {
    ...clone(source),
    version: 2,
    currentOwnerId: source.currentOwnerId ?? ownerId,
    byOwner: {
      ...(clone(source.byOwner ?? {})),
      [ownerId]: clone(selection),
    },
  }
}

export function normalizeEnkaImportState(store) {
  const source = store?.enkaImportState
  return {
    version: 1,
    byOwner: source?.version === 1 && source?.byOwner && typeof source.byOwner === "object"
      ? clone(source.byOwner)
      : {},
  }
}

export function enkaBindingForOwner(store, ownerId) {
  return normalizeEnkaImportState(store).byOwner?.[ownerId]?.binding ?? null
}

function setOwnerImportState(store, ownerId, ownerState) {
  const state = normalizeEnkaImportState(store)
  return {
    ...store,
    enkaImportState: {
      ...state,
      byOwner: { ...state.byOwner, [ownerId]: ownerState },
    },
  }
}

function fieldDisplay(value) {
  if (value == null || value === "") return "未设置"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function mergeAgentConfig(currentConfig, agent, driveResult) {
  const current = clone(currentConfig ?? {}) ?? {}
  const next = clone(current)
  const changes = []
  const applyField = (field, label, value) => {
    if (value == null || sameValue(current[field], value)) return
    next[field] = clone(value)
    changes.push({ field, label, before: fieldDisplay(current[field]), after: fieldDisplay(value) })
  }

  applyField("agentLevel", "角色等级", agent.agentLevel)
  applyField("cinemaLevel", "影画", agent.cinemaLevel)
  applyField("coreSkillLevel", "核心技", agent.coreSkillLevel)

  const skillEntries = Object.entries(agent.skillLevels ?? {}).filter(([, value]) => value != null)
  if (skillEntries.length) {
    const nextSkills = {
      ...(current.skillLevels
        ?? current.skillLevelsByCategory
        ?? current.damage?.skillLevelsByCategory
        ?? current.damageConfig?.skillLevelsByCategory
        ?? {}),
    }
    for (const [category, level] of skillEntries) nextSkills[category] = level
    if (!sameValue(current.skillLevels ?? current.skillLevelsByCategory ?? {}, nextSkills)) {
      next.skillLevels = nextSkills
      changes.push({
        field: "skillLevels",
        label: "技能等级",
        before: fieldDisplay(current.skillLevels ?? current.skillLevelsByCategory ?? {}),
        after: fieldDisplay(nextSkills),
      })
    }
    if (Object.prototype.hasOwnProperty.call(current, "skillLevelsByCategory")) {
      next.skillLevelsByCategory = clone(nextSkills)
    }
    const currentDamage = current.damage ?? current.damageConfig ?? {}
    next.damage = {
      ...(clone(currentDamage) ?? {}),
      skillLevelsByCategory: {
        ...(clone(currentDamage.skillLevelsByCategory ?? {}) ?? {}),
        ...Object.fromEntries(skillEntries),
      },
    }
    if (current.damageConfig && typeof current.damageConfig === "object") {
      next.damageConfig = {
        ...clone(current.damageConfig),
        skillLevelsByCategory: clone(next.damage.skillLevelsByCategory),
      }
    }
  }

  if (agent.wEngine) {
    applyField("wEngineId", "音擎", agent.wEngine.id)
    applyField("wEngineLevel", "音擎等级", agent.wEngine.level)
    applyField("wEngineModificationLevel", "音擎精炼", agent.wEngine.modificationLevel)
  }

  if (driveResult?.hasUsableLoadout) {
    applyField("discMode", "驱动盘模式", "loadout")
    applyField("selectedLoadoutId", "驱动盘配装", driveResult.loadoutId)
    if (driveResult.changed) {
      changes.push({
        field: "driveDiscLoadout",
        label: "已装备驱动盘",
        before: driveResult.before,
        after: driveResult.after,
      })
    }
  }

  return { config: next, changes }
}

function changedOwnerItems(beforeItems, afterItems, ownerId) {
  const key = item => `${item?.ownerId ?? "default"}\u0000${item?.id ?? ""}`
  const before = new Map((beforeItems ?? []).filter(item => String(item?.ownerId ?? "default") === ownerId).map(item => [key(item), item]))
  const after = new Map((afterItems ?? []).filter(item => String(item?.ownerId ?? "default") === ownerId).map(item => [key(item), item]))
  const ids = new Set()
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    if (!sameValue(before.get(id) ?? null, after.get(id) ?? null)) ids.add(id.split("\u0000")[1])
  }
  return [...ids]
}

function itemsSnapshot(items, ownerId, ids) {
  const idSet = new Set(ids)
  return (items ?? [])
    .filter(item => String(item?.ownerId ?? "default") === ownerId && idSet.has(String(item?.id ?? "")))
    .map(clone)
}

function configsSnapshot(document, ownerId, agentIds) {
  const selection = ownerSelection(document, ownerId)
  return Object.fromEntries(agentIds.map(agentId => [
    agentId,
    Object.prototype.hasOwnProperty.call(selection.byAgent ?? {}, agentId)
      ? clone(selection.byAgent[agentId])
      : null,
  ]))
}

function inventorySnapshot(store, ownerId, discIds, loadoutIds) {
  return {
    driveDiscs: itemsSnapshot(store.driveDiscs, ownerId, discIds),
    driveDiscLoadouts: itemsSnapshot(store.driveDiscLoadouts, ownerId, loadoutIds),
    binding: clone(enkaBindingForOwner(store, ownerId)),
  }
}

function ownerJournal(store, ownerId) {
  return normalizeEnkaImportState(store).byOwner?.[ownerId]?.undoJournal ?? null
}

export function buildEnkaImportPlan({
  uid,
  mappedAgents,
  store,
  ownerId,
  buildSelection,
  legacySelection,
  now = new Date(),
  transactionId = `enka-${now.getTime()}`,
}) {
  const normalizedUid = String(uid ?? "").trim()
  const binding = enkaBindingForOwner(store, ownerId)
  if (binding && String(binding.uid) !== normalizedUid) {
    const error = new Error(`当前 Calculator 账号已绑定 UID ${binding.uid}，请切换或新建账号后再导入。`)
    error.code = "UID_BINDING_MISMATCH"
    throw error
  }

  const drivePlan = buildDriveDiscSyncPlan({
    uid: normalizedUid,
    mappedAgents,
    driveDiscState: { ownerId, store },
    now,
  })
  const driveByAgent = new Map(drivePlan.results.map(result => [result.agentId, result]))
  const currentBuildOwner = ownerSelection(buildSelection, ownerId)
  const currentLegacyOwner = ownerSelection(legacySelection, ownerId)
  const nextBuildByAgent = { ...(clone(currentBuildOwner.byAgent ?? {}) ?? {}) }
  const nextLegacyByAgent = { ...(clone(currentLegacyOwner.byAgent ?? {}) ?? {}) }
  const agents = []

  for (const agent of mappedAgents ?? []) {
    const driveResult = driveByAgent.get(agent.agentId)
    const merged = mergeAgentConfig(nextBuildByAgent[agent.agentId], agent, driveResult)
    const mergedLegacy = mergeAgentConfig(nextLegacyByAgent[agent.agentId], agent, driveResult)
    nextBuildByAgent[agent.agentId] = merged.config
    nextLegacyByAgent[agent.agentId] = mergedLegacy.config
    agents.push({
      agentId: agent.agentId,
      agentName: agent.agentName,
      changes: merged.changes,
      changed: merged.changes.length > 0,
      drive: driveResult ?? null,
    })
  }

  const selectedAgentIds = agents.map(agent => agent.agentId)
  const nextBuildSelection = withOwnerSelection(buildSelection, ownerId, {
    currentAgentId: currentBuildOwner.currentAgentId ?? selectedAgentIds[0] ?? null,
    byAgent: nextBuildByAgent,
  })
  const nextLegacySelection = withOwnerSelection(legacySelection, ownerId, {
    currentAgentId: currentLegacyOwner.currentAgentId ?? currentBuildOwner.currentAgentId ?? selectedAgentIds[0] ?? null,
    byAgent: nextLegacyByAgent,
  })
  const importedAt = now.toISOString()
  const currentOwnerState = normalizeEnkaImportState(drivePlan.nextStore).byOwner?.[ownerId] ?? {}
  let nextStore = normalizeInventoryStore(setOwnerImportState(drivePlan.nextStore, ownerId, {
    ...currentOwnerState,
    binding: {
      uid: normalizedUid,
      boundAt: binding?.boundAt ?? importedAt,
      lastImportedAt: importedAt,
    },
    undoJournal: null,
  }))

  const discIds = changedOwnerItems(store.driveDiscs, nextStore.driveDiscs, ownerId)
  const loadoutIds = changedOwnerItems(store.driveDiscLoadouts, nextStore.driveDiscLoadouts, ownerId)
  const journal = {
    version: 1,
    id: transactionId,
    uid: normalizedUid,
    ownerId,
    status: "prepared",
    createdAt: importedAt,
    affectedAgentIds: selectedAgentIds,
    affectedDriveDiscIds: discIds,
    affectedLoadoutIds: loadoutIds,
    baseFingerprint: {
      store: jsonFingerprint(store),
      buildSelection: jsonFingerprint(buildSelection),
      legacySelection: jsonFingerprint(legacySelection),
    },
    before: {
      inventory: inventorySnapshot(store, ownerId, discIds, loadoutIds),
      buildConfigs: configsSnapshot(buildSelection, ownerId, selectedAgentIds),
      legacyConfigs: configsSnapshot(legacySelection, ownerId, selectedAgentIds),
    },
    after: {
      inventory: inventorySnapshot(nextStore, ownerId, discIds, loadoutIds),
      buildConfigs: configsSnapshot(nextBuildSelection, ownerId, selectedAgentIds),
      legacyConfigs: configsSnapshot(nextLegacySelection, ownerId, selectedAgentIds),
    },
  }
  nextStore = setOwnerImportState(nextStore, ownerId, {
    ...normalizeEnkaImportState(nextStore).byOwner[ownerId],
    undoJournal: journal,
  })

  return {
    uid: normalizedUid,
    ownerId,
    transactionId,
    agents,
    warnings: drivePlan.warnings,
    drivePlan,
    nextStore,
    nextBuildSelection,
    nextLegacySelection,
    journal,
    changeCount: agents.reduce((sum, agent) => sum + agent.changes.length, 0)
      + discIds.length + loadoutIds.length + (binding ? 0 : 1),
  }
}

export function enkaImportBaseMatches({ store, buildSelection, legacySelection, journal }) {
  const expected = journal?.baseFingerprint
  if (!expected) return false
  return expected.store === jsonFingerprint(store)
    && expected.buildSelection === jsonFingerprint(buildSelection)
    && expected.legacySelection === jsonFingerprint(legacySelection)
}

function replaceOwnerItems(items, ownerId, ids, replacements) {
  const idSet = new Set(ids)
  return [
    ...(items ?? []).filter(item => !(String(item?.ownerId ?? "default") === ownerId && idSet.has(String(item?.id ?? "")))),
    ...clone(replacements ?? []),
  ]
}

function applyConfigSnapshot(document, ownerId, agentIds, configs) {
  const selection = ownerSelection(document, ownerId)
  const byAgent = { ...(clone(selection.byAgent ?? {}) ?? {}) }
  for (const agentId of agentIds) {
    if (configs?.[agentId] == null) delete byAgent[agentId]
    else byAgent[agentId] = clone(configs[agentId])
  }
  return withOwnerSelection(document, ownerId, { ...selection, byAgent })
}

export function enkaImportSnapshotMatches({ store, buildSelection, legacySelection, journal }, phase = "after") {
  const snapshot = journal?.[phase]
  if (!snapshot) return false
  const currentInventory = inventorySnapshot(
    store,
    journal.ownerId,
    journal.affectedDriveDiscIds,
    journal.affectedLoadoutIds,
  )
  return sameValue(currentInventory, snapshot.inventory)
    && sameValue(configsSnapshot(buildSelection, journal.ownerId, journal.affectedAgentIds), snapshot.buildConfigs)
    && sameValue(configsSnapshot(legacySelection, journal.ownerId, journal.affectedAgentIds), snapshot.legacyConfigs)
}

export function applyEnkaImportSnapshot({ store, buildSelection, legacySelection, journal }, phase = "before") {
  const snapshot = journal?.[phase]
  if (!snapshot) throw new Error("Enka 导入快照不存在。")
  let nextStore = {
    ...store,
    driveDiscs: replaceOwnerItems(store.driveDiscs, journal.ownerId, journal.affectedDriveDiscIds, snapshot.inventory.driveDiscs),
    driveDiscLoadouts: replaceOwnerItems(store.driveDiscLoadouts, journal.ownerId, journal.affectedLoadoutIds, snapshot.inventory.driveDiscLoadouts),
  }
  const state = normalizeEnkaImportState(nextStore)
  const ownerState = state.byOwner[journal.ownerId] ?? {}
  if (snapshot.inventory.binding == null) {
    const { binding: _binding, ...withoutBinding } = ownerState
    nextStore = setOwnerImportState(nextStore, journal.ownerId, { ...withoutBinding, undoJournal: null })
  } else {
    nextStore = setOwnerImportState(nextStore, journal.ownerId, {
      ...ownerState,
      binding: clone(snapshot.inventory.binding),
      undoJournal: phase === "after" ? journal : null,
    })
  }
  return {
    store: nextStore,
    buildSelection: applyConfigSnapshot(buildSelection, journal.ownerId, journal.affectedAgentIds, snapshot.buildConfigs),
    legacySelection: applyConfigSnapshot(legacySelection, journal.ownerId, journal.affectedAgentIds, snapshot.legacyConfigs),
  }
}

export function markEnkaImportCommitted(store, ownerId, transactionId) {
  const state = normalizeEnkaImportState(store)
  const ownerState = state.byOwner[ownerId]
  const journal = ownerState?.undoJournal
  if (!journal || journal.id !== transactionId) throw new Error("Enka 导入事务已失效。")
  return setOwnerImportState(store, ownerId, {
    ...ownerState,
    undoJournal: { ...journal, status: "committed", committedAt: new Date().toISOString() },
  })
}

export function pendingEnkaImportJournal(store, ownerId) {
  const journal = ownerJournal(store, ownerId)
  return journal?.status === "prepared" ? clone(journal) : null
}

export function committedEnkaImportJournal(store, ownerId) {
  const journal = ownerJournal(store, ownerId)
  return journal?.status === "committed" ? clone(journal) : null
}
