export const DRIVE_DISC_IMPORT_STATE_VERSION = 1
export const DRIVE_DISC_IMPORT_JOURNAL_VERSION = 1

const INVENTORY_ARRAY_FIELDS = ["driveDiscs", "driveDiscLoadouts", "imports"]
const TRANSACTION_IGNORED_STORE_FIELDS = new Set([
  ...INVENTORY_ARRAY_FIELDS,
  "driveDiscImportState",
  "enkaImportState",
  "updatedAt",
])

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function driveDiscImportFingerprint(value) {
  const text = JSON.stringify(value ?? null)
  let hash = 1469598103934665603n
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return `${text.length}:${hash.toString(16).padStart(16, "0")}`
}

function stringMap(value) {
  if (value instanceof Map) {
    return new Map([...value.entries()].map(([from, to]) => [String(from), String(to)]))
  }
  return new Map(Object.entries(value ?? {}).map(([from, to]) => [String(from), String(to)]))
}

function stringSet(value) {
  return new Set([...(value ?? [])].map(item => String(item)))
}

function remappedId(value, remap, deleted) {
    const original = String(value ?? "")
    if (!original) return null
    const replacement = remap.get(original)
    if (replacement != null) {
        const next = String(replacement)
        return deleted.has(next) ? null : next
    }
    return deleted.has(original) ? null : original
}

function rewriteIdsBySlot(value, remap, deleted) {
  const next = {}
  const removedIds = []
  let changed = false
  for (const [slot, id] of Object.entries(value ?? {})) {
    const replacement = remappedId(id, remap, deleted)
    if (!replacement) {
      removedIds.push(String(id))
      changed = true
      continue
    }
    next[slot] = replacement
    if (replacement !== String(id)) changed = true
  }
  return { value: next, removedIds, changed }
}

function ownerSelection(document, ownerId) {
  if (document?.byOwner && typeof document.byOwner === "object") {
    return document.byOwner[ownerId] ?? { currentAgentId: null, byAgent: {} }
  }
  if (ownerId === "default" && document && typeof document === "object" && !Array.isArray(document)) {
    return { currentAgentId: document.currentAgentId ?? null, byAgent: document.byAgent ?? {} }
  }
  return { currentAgentId: null, byAgent: {} }
}

function withOwnerSelection(document, ownerId, selection) {
  const source = document && typeof document === "object" && !Array.isArray(document) ? clone(document) : {}
  if (source.byOwner && typeof source.byOwner === "object") {
    source.byOwner = { ...source.byOwner, [ownerId]: clone(selection) }
    return source
  }
  if (ownerId === "default") {
    source.currentAgentId = selection.currentAgentId ?? null
    source.byAgent = clone(selection.byAgent ?? {})
    return source
  }
  return {
    ...source,
    version: 2,
    currentOwnerId: source.currentOwnerId ?? ownerId,
    byOwner: { [ownerId]: clone(selection) },
  }
}

function rewriteAgentConfig(config, driveDiscIdRemap, deletedDriveDiscIds, loadoutIdRemap, deletedLoadoutIds) {
  const next = clone(config ?? {}) ?? {}
  let changed = false
  for (const field of ["manualDriveDiscIdsBySlot", "driveDiscIdsBySlot"]) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue
    const rewritten = rewriteIdsBySlot(next[field], driveDiscIdRemap, deletedDriveDiscIds)
    if (rewritten.changed) {
      next[field] = rewritten.value
      changed = true
    }
  }
  for (const field of ["selectedLoadoutId", "loadoutId"]) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue
    const original = String(next[field] ?? "")
    if (!original) continue
    const replacement = remappedId(original, loadoutIdRemap, deletedLoadoutIds) ?? ""
    if (replacement !== original) {
      next[field] = replacement
      changed = true
    }
  }
  return { config: next, changed }
}

export function reconcileSelectionDriveDiscReferences(document, {
  ownerId = "default",
  driveDiscIdRemap = {},
  deletedDriveDiscIds = [],
  loadoutIdRemap = {},
  deletedLoadoutIds = [],
} = {}) {
  const discRemap = stringMap(driveDiscIdRemap)
  const deletedDiscs = stringSet(deletedDriveDiscIds)
  const loadoutRemap = stringMap(loadoutIdRemap)
  const deletedLoadouts = stringSet(deletedLoadoutIds)
  const selection = clone(ownerSelection(document, ownerId)) ?? { currentAgentId: null, byAgent: {} }
  const byAgent = { ...(selection.byAgent ?? {}) }
  const affectedAgentIds = []
  for (const [agentId, config] of Object.entries(byAgent)) {
    const rewritten = rewriteAgentConfig(config, discRemap, deletedDiscs, loadoutRemap, deletedLoadouts)
    if (!rewritten.changed) continue
    byAgent[agentId] = rewritten.config
    affectedAgentIds.push(agentId)
  }
  if (!affectedAgentIds.length) {
    return { document: clone(document), affectedAgentIds }
  }
  return {
    document: withOwnerSelection(document, ownerId, { ...selection, byAgent }),
    affectedAgentIds,
  }
}

export function selectionConfigsSnapshot(document, ownerId, agentIds) {
  const selection = ownerSelection(document, ownerId)
  const ownerPresent = Boolean(document?.byOwner && typeof document.byOwner === "object")
    ? Object.prototype.hasOwnProperty.call(document.byOwner, ownerId)
    : ownerId === "default" && Boolean(document && typeof document === "object" && !Array.isArray(document))
  return {
    version: 1,
    ownerPresent,
    currentAgentId: clone(selection.currentAgentId ?? null),
    configs: Object.fromEntries([...agentIds].map(agentId => [
      agentId,
      Object.prototype.hasOwnProperty.call(selection.byAgent ?? {}, agentId)
        ? clone(selection.byAgent[agentId])
        : null,
    ])),
  }
}

function changedConfigAgentIds(beforeDocument, afterDocument, ownerId) {
  const before = ownerSelection(beforeDocument, ownerId).byAgent ?? {}
  const after = ownerSelection(afterDocument, ownerId).byAgent ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(agentId => !sameValue(before[agentId] ?? null, after[agentId] ?? null))
}

function withoutOwnerSelection(document, ownerId) {
  const source = clone(document) ?? {}
  if (source.byOwner && typeof source.byOwner === "object") {
    const byOwner = { ...source.byOwner }
    delete byOwner[ownerId]
    return { ...source, byOwner }
  }
  if (ownerId !== "default") return source
  const { currentAgentId: _currentAgentId, byAgent: _byAgent, ...remaining } = source
  return { ...remaining, version: 2, currentOwnerId: source.currentOwnerId ?? "default", byOwner: {} }
}

function applyConfigSnapshot(document, ownerId, agentIds, snapshot) {
  const structured = snapshot?.version === 1 && snapshot?.configs && typeof snapshot.configs === "object"
  if (structured && !snapshot.ownerPresent) return withoutOwnerSelection(document, ownerId)
  const configs = structured ? snapshot.configs : snapshot
  const selection = clone(ownerSelection(document, ownerId)) ?? { currentAgentId: null, byAgent: {} }
  const byAgent = { ...(selection.byAgent ?? {}) }
  for (const agentId of agentIds) {
    if (configs?.[agentId] == null) delete byAgent[agentId]
    else byAgent[agentId] = clone(configs[agentId])
  }
  return withOwnerSelection(document, ownerId, {
    ...selection,
    currentAgentId: structured ? clone(snapshot.currentAgentId ?? null) : selection.currentAgentId ?? null,
    byAgent,
  })
}

export function reconcileStoreDriveDiscReferences(store, {
  ownerId = "default",
  driveDiscIdRemap = {},
  deletedDriveDiscIds = [],
  now = new Date().toISOString(),
} = {}) {
  const remap = stringMap(driveDiscIdRemap)
  const deleted = stringSet(deletedDriveDiscIds)
  if (!remap.size && !deleted.size) {
    return { store: clone(store), affectedLoadoutIds: [] }
  }
  const affectedLoadoutIds = []
  const driveDiscLoadouts = (store?.driveDiscLoadouts ?? []).map(loadout => {
    if (String(loadout?.ownerId ?? "default") !== String(ownerId)) return clone(loadout)
    const next = clone(loadout)
    const removedFromSlots = []
    let changed = false
    for (const field of ["driveDiscIdsBySlot", "idsBySlot"]) {
      if (!Object.prototype.hasOwnProperty.call(next, field)) continue
      const rewritten = rewriteIdsBySlot(next[field], remap, deleted)
      if (!rewritten.changed) continue
      next[field] = rewritten.value
      removedFromSlots.push(...rewritten.removedIds)
      changed = true
    }
    if (!changed) return next

    const currentIds = next.driveDiscIdsBySlot ?? next.idsBySlot ?? {}
    const missingSlots = [1, 2, 3, 4, 5, 6].filter(slot => !currentIds[String(slot)])
    const missingDriveDiscIds = [
      ...(next.missingDriveDiscIds ?? []).filter(id => !remap.has(String(id))),
      ...removedFromSlots,
    ]
    next.status = missingSlots.length ? "incomplete" : "complete"
    next.missingSlots = missingSlots
    next.missingDriveDiscIds = missingSlots.length ? [...new Set(missingDriveDiscIds)] : []
    next.updatedAt = now
    affectedLoadoutIds.push(String(next.id ?? ""))
    return next
  })
  return {
    store: { ...(clone(store) ?? {}), driveDiscLoadouts },
    affectedLoadoutIds,
  }
}

function ownerItemKey(item) {
  return `${String(item?.ownerId ?? "default")}\u0000${String(item?.id ?? "")}`
}

function changedOwnerItemIds(beforeItems, afterItems, ownerId) {
  const owner = String(ownerId)
  const before = new Map((beforeItems ?? [])
    .filter(item => String(item?.ownerId ?? "default") === owner)
    .map(item => [ownerItemKey(item), item]))
  const after = new Map((afterItems ?? [])
    .filter(item => String(item?.ownerId ?? "default") === owner)
    .map(item => [ownerItemKey(item), item]))
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(key => !sameValue(before.get(key) ?? null, after.get(key) ?? null))
    .map(key => key.split("\u0000")[1])
}

export function positionedOwnerItemsSnapshot(items, ownerId, ids) {
  const owner = String(ownerId)
  const idSet = stringSet(ids)
  return {
    ids: [...idSet],
    entries: (items ?? []).flatMap((item, index) => (
      String(item?.ownerId ?? "default") === owner && idSet.has(String(item?.id ?? ""))
        ? [{ id: String(item.id), index, value: clone(item) }]
        : []
    )),
  }
}

export function applyPositionedOwnerItemsSnapshot(items, ownerId, snapshot) {
  const owner = String(ownerId)
  const ids = stringSet(snapshot?.ids)
  const next = (items ?? []).filter(item => !(
    String(item?.ownerId ?? "default") === owner && ids.has(String(item?.id ?? ""))
  )).map(clone)
  for (const entry of [...(snapshot?.entries ?? [])].sort((left, right) => left.index - right.index)) {
    next.splice(Math.max(0, Math.min(Number(entry.index) || 0, next.length)), 0, clone(entry.value))
  }
  return next
}

function positionedSnapshotMatches(items, ownerId, snapshot) {
  return sameValue(positionedOwnerItemsSnapshot(items, ownerId, snapshot?.ids ?? []), snapshot)
}

function topLevelSnapshot(store, keys) {
  return Object.fromEntries([...keys].map(key => [key, {
    present: Object.prototype.hasOwnProperty.call(store ?? {}, key),
    value: clone(store?.[key]),
  }]))
}

function applyTopLevelSnapshot(store, snapshot) {
  const next = { ...(store ?? {}) }
  for (const [key, entry] of Object.entries(snapshot ?? {})) {
    if (!entry.present) delete next[key]
    else next[key] = clone(entry.value)
  }
  return next
}

function changedTopLevelKeys(beforeStore, afterStore) {
  return [...new Set([...Object.keys(beforeStore ?? {}), ...Object.keys(afterStore ?? {})])]
    .filter(key => !TRANSACTION_IGNORED_STORE_FIELDS.has(key))
    .filter(key => !sameValue(beforeStore?.[key], afterStore?.[key]))
}

function enkaOwnerStateSnapshot(store, ownerId) {
  const state = store?.enkaImportState
  const ownerState = state?.version === 1 ? state.byOwner?.[ownerId] : undefined
  return {
    present: ownerState !== undefined,
    value: clone(ownerState),
  }
}

function applyEnkaOwnerStateSnapshot(store, ownerId, snapshot) {
  const source = store?.enkaImportState?.version === 1
    ? clone(store.enkaImportState)
    : { version: 1, byOwner: {} }
  const byOwner = { ...(source.byOwner ?? {}) }
  if (snapshot?.present) byOwner[ownerId] = clone(snapshot.value)
  else delete byOwner[ownerId]
  if (!Object.keys(byOwner).length && !store?.enkaImportState) {
    const next = { ...store }
    delete next.enkaImportState
    return next
  }
  return { ...store, enkaImportState: { ...source, version: 1, byOwner } }
}

function invalidateEnkaUndoForAffected(store, ownerId, kind, affected, now) {
  if (["enka", "enka-undo", "account-delete"].includes(String(kind))) {
    return { store, invalidation: null }
  }
  const ownerState = store?.enkaImportState?.version === 1
    ? store.enkaImportState.byOwner?.[ownerId]
    : null
  const journal = ownerState?.undoJournal
  if (journal?.status !== "committed") return { store, invalidation: null }

  const overlap = {
    driveDiscIds: (journal.affectedDriveDiscIds ?? []).filter(id => affected.driveDiscIds.includes(String(id))),
    loadoutIds: (journal.affectedLoadoutIds ?? []).filter(id => affected.loadoutIds.includes(String(id))),
    agentIds: (journal.affectedAgentIds ?? []).filter(id => affected.agentIds.includes(String(id))),
  }
  if (!overlap.driveDiscIds.length && !overlap.loadoutIds.length && !overlap.agentIds.length) {
    return { store, invalidation: null }
  }
  const invalidation = {
    invalidatedBy: String(kind ?? "drive-disc-import"),
    invalidatedAt: now,
    overlap,
  }
  return {
    invalidation,
    store: {
      ...store,
      enkaImportState: {
        ...store.enkaImportState,
        byOwner: {
          ...store.enkaImportState.byOwner,
          [ownerId]: {
            ...ownerState,
            undoJournal: {
              ...journal,
              status: "invalidated",
              ...invalidation,
            },
          },
        },
      },
    },
  }
}

export function normalizeDriveDiscImportState(store) {
  const source = store?.driveDiscImportState
  return {
    version: DRIVE_DISC_IMPORT_STATE_VERSION,
    byOwner: source?.version === DRIVE_DISC_IMPORT_STATE_VERSION
      && source.byOwner && typeof source.byOwner === "object"
      ? clone(source.byOwner)
      : {},
  }
}

export function pendingDriveDiscImportJournal(store, ownerId) {
  const journal = normalizeDriveDiscImportState(store).byOwner?.[ownerId]?.pendingJournal
  return journal?.status === "prepared" ? clone(journal) : null
}

export function setPendingDriveDiscImportJournal(store, ownerId, journal) {
  const state = normalizeDriveDiscImportState(store)
  const ownerState = state.byOwner[ownerId] ?? {}
  const existing = ownerState.pendingJournal
  if (existing && existing.id !== journal.id) {
    throw new Error(`账号 ${ownerId} 尚有未恢复的驱动盘导入事务。`)
  }
  return {
    ...(clone(store) ?? {}),
    driveDiscImportState: {
      ...state,
      byOwner: {
        ...state.byOwner,
        [ownerId]: { ...ownerState, pendingJournal: clone(journal) },
      },
    },
  }
}

export function clearPendingDriveDiscImportJournal(store, ownerId, transactionId = null) {
  const state = normalizeDriveDiscImportState(store)
  const ownerState = state.byOwner[ownerId]
  if (!ownerState?.pendingJournal) return clone(store)
  if (transactionId && ownerState.pendingJournal.id !== transactionId) {
    throw new Error("驱动盘导入事务已失效。")
  }
  const { pendingJournal: _pendingJournal, ...remainingOwnerState } = ownerState
  const byOwner = { ...state.byOwner }
  if (Object.keys(remainingOwnerState).length) byOwner[ownerId] = remainingOwnerState
  else delete byOwner[ownerId]
  return {
    ...(clone(store) ?? {}),
    driveDiscImportState: { ...state, byOwner },
  }
}

function inventorySnapshot(store, ownerId, affected) {
  return {
    driveDiscs: positionedOwnerItemsSnapshot(store?.driveDiscs, ownerId, affected.driveDiscIds),
    driveDiscLoadouts: positionedOwnerItemsSnapshot(store?.driveDiscLoadouts, ownerId, affected.loadoutIds),
    imports: positionedOwnerItemsSnapshot(store?.imports, ownerId, affected.importIds),
    enkaOwnerState: enkaOwnerStateSnapshot(store, ownerId),
    topLevel: topLevelSnapshot(store, affected.topLevelKeys),
  }
}

function applyInventorySnapshot(store, ownerId, snapshot) {
  let next = {
    ...(clone(store) ?? {}),
    driveDiscs: applyPositionedOwnerItemsSnapshot(store?.driveDiscs, ownerId, snapshot.driveDiscs),
    driveDiscLoadouts: applyPositionedOwnerItemsSnapshot(store?.driveDiscLoadouts, ownerId, snapshot.driveDiscLoadouts),
    imports: applyPositionedOwnerItemsSnapshot(store?.imports, ownerId, snapshot.imports),
  }
  next = applyTopLevelSnapshot(next, snapshot.topLevel)
  next = applyEnkaOwnerStateSnapshot(next, ownerId, snapshot.enkaOwnerState)
  return next
}

function inventorySnapshotMatches(store, ownerId, snapshot) {
  return positionedSnapshotMatches(store?.driveDiscs, ownerId, snapshot.driveDiscs)
    && positionedSnapshotMatches(store?.driveDiscLoadouts, ownerId, snapshot.driveDiscLoadouts)
    && positionedSnapshotMatches(store?.imports, ownerId, snapshot.imports)
    && sameValue(enkaOwnerStateSnapshot(store, ownerId), snapshot.enkaOwnerState)
    && sameValue(topLevelSnapshot(store, Object.keys(snapshot.topLevel ?? {})), snapshot.topLevel)
}

export function buildDriveDiscImportTransactionPlan({
  kind,
  ownerId,
  transactionId,
  store,
  nextStore,
  buildSelection,
  legacySelection,
  nextBuildSelection = buildSelection,
  nextLegacySelection = legacySelection,
  driveDiscIdRemap = {},
  deletedDriveDiscIds = [],
  loadoutIdRemap = {},
  deletedLoadoutIds = [],
  affectedAgentIds = [],
  metadata = {},
  now = new Date(),
  hasUnresolvedConflicts = false,
} = {}) {
  const normalizedOwnerId = String(ownerId ?? "default")
  const id = String(transactionId ?? `drive-disc-import-${now.getTime()}`)
  const currentStore = clone(store) ?? {}
  if (pendingDriveDiscImportJournal(currentStore, normalizedOwnerId)) {
    throw new Error(`账号 ${normalizedOwnerId} 尚有未恢复的驱动盘导入事务。`)
  }

  const reconciledStoreResult = reconcileStoreDriveDiscReferences(nextStore, {
    ownerId: normalizedOwnerId,
    driveDiscIdRemap,
    deletedDriveDiscIds,
    now: now.toISOString(),
  })
  let finalStore = clearPendingDriveDiscImportJournal(reconciledStoreResult.store, normalizedOwnerId)
  const nextBuildResult = reconcileSelectionDriveDiscReferences(nextBuildSelection, {
    ownerId: normalizedOwnerId,
    driveDiscIdRemap,
    deletedDriveDiscIds,
    loadoutIdRemap,
    deletedLoadoutIds,
  })
  const nextLegacyResult = reconcileSelectionDriveDiscReferences(nextLegacySelection, {
    ownerId: normalizedOwnerId,
    driveDiscIdRemap,
    deletedDriveDiscIds,
    loadoutIdRemap,
    deletedLoadoutIds,
  })
  const finalBuildSelection = nextBuildResult.document
  const finalLegacySelection = nextLegacyResult.document

  const affected = {
    driveDiscIds: changedOwnerItemIds(currentStore.driveDiscs, finalStore.driveDiscs, normalizedOwnerId),
    loadoutIds: changedOwnerItemIds(currentStore.driveDiscLoadouts, finalStore.driveDiscLoadouts, normalizedOwnerId),
    importIds: changedOwnerItemIds(currentStore.imports, finalStore.imports, normalizedOwnerId),
    agentIds: [...new Set([
      ...affectedAgentIds,
      ...changedConfigAgentIds(buildSelection, finalBuildSelection, normalizedOwnerId),
      ...changedConfigAgentIds(legacySelection, finalLegacySelection, normalizedOwnerId),
    ].map(value => String(value)))],
    topLevelKeys: changedTopLevelKeys(currentStore, finalStore),
  }
  const invalidationResult = invalidateEnkaUndoForAffected(
    finalStore,
    normalizedOwnerId,
    kind,
    affected,
    now.toISOString(),
  )
  finalStore = invalidationResult.store
  const journal = {
    version: DRIVE_DISC_IMPORT_JOURNAL_VERSION,
    id,
    ownerId: normalizedOwnerId,
    kind: String(kind ?? "drive-disc-import"),
    status: "prepared",
    createdAt: now.toISOString(),
    baseFingerprint: {
      store: driveDiscImportFingerprint(currentStore),
      buildSelection: driveDiscImportFingerprint(buildSelection),
      legacySelection: driveDiscImportFingerprint(legacySelection),
    },
    affected,
    metadata: clone(metadata) ?? {},
    before: {
      inventory: inventorySnapshot(currentStore, normalizedOwnerId, affected),
      buildConfigs: selectionConfigsSnapshot(buildSelection, normalizedOwnerId, affected.agentIds),
      legacyConfigs: selectionConfigsSnapshot(legacySelection, normalizedOwnerId, affected.agentIds),
    },
    after: {
      inventory: inventorySnapshot(finalStore, normalizedOwnerId, affected),
      buildConfigs: selectionConfigsSnapshot(finalBuildSelection, normalizedOwnerId, affected.agentIds),
      legacyConfigs: selectionConfigsSnapshot(finalLegacySelection, normalizedOwnerId, affected.agentIds),
    },
  }
  finalStore = clearPendingDriveDiscImportJournal(finalStore, normalizedOwnerId)
  return {
    version: 1,
    kind: journal.kind,
    ownerId: normalizedOwnerId,
    transactionId: id,
    journal,
    nextStore: finalStore,
    preparedStore: setPendingDriveDiscImportJournal(finalStore, normalizedOwnerId, journal),
    nextBuildSelection: finalBuildSelection,
    nextLegacySelection: finalLegacySelection,
    affected,
    affectedLoadoutIds: reconciledStoreResult.affectedLoadoutIds,
    enkaUndoInvalidation: clone(invalidationResult.invalidation),
    hasUnresolvedConflicts: Boolean(hasUnresolvedConflicts),
  }
}

export function driveDiscImportBaseMatches({ store, buildSelection, legacySelection, journal }) {
  const expected = journal?.baseFingerprint
  if (!expected) return false
  return expected.store === driveDiscImportFingerprint(store)
    && expected.buildSelection === driveDiscImportFingerprint(buildSelection)
    && expected.legacySelection === driveDiscImportFingerprint(legacySelection)
}

export function driveDiscImportSnapshotMatches({ store, buildSelection, legacySelection, journal }, phase = "after") {
  const snapshot = journal?.[phase]
  if (!snapshot) return false
  return inventorySnapshotMatches(store, journal.ownerId, snapshot.inventory)
    && sameValue(selectionConfigsSnapshot(buildSelection, journal.ownerId, journal.affected.agentIds), snapshot.buildConfigs)
    && sameValue(selectionConfigsSnapshot(legacySelection, journal.ownerId, journal.affected.agentIds), snapshot.legacyConfigs)
}

export function applyDriveDiscImportSnapshot({ store, buildSelection, legacySelection, journal }, phase = "before") {
  const snapshot = journal?.[phase]
  if (!snapshot) throw new Error("驱动盘导入快照不存在。")
  const restoredStore = clearPendingDriveDiscImportJournal(
    applyInventorySnapshot(store, journal.ownerId, snapshot.inventory),
    journal.ownerId,
    journal.id,
  )
  return {
    store: restoredStore,
    buildSelection: applyConfigSnapshot(buildSelection, journal.ownerId, journal.affected.agentIds, snapshot.buildConfigs),
    legacySelection: applyConfigSnapshot(legacySelection, journal.ownerId, journal.affected.agentIds, snapshot.legacyConfigs),
  }
}

export function pendingDriveDiscImportOwners(store) {
  return Object.entries(normalizeDriveDiscImportState(store).byOwner)
    .filter(([, ownerState]) => ownerState?.pendingJournal?.status === "prepared")
    .map(([ownerId]) => ownerId)
}
