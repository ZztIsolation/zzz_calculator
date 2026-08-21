const SESSION_VERSION = 1

const CONFIG_PATHS = [
  ["agentLevel"],
  ["cinemaLevel"],
  ["coreSkillLevel"],
  ["skillLevels"],
  ["skillLevelsByCategory"],
  ["damage", "skillLevelsByCategory"],
  ["damageConfig", "skillLevelsByCategory"],
  ["wEngineId"],
  ["wEngineLevel"],
  ["wEngineModificationLevel"],
  ["discMode"],
  ["selectedLoadoutId"],
  ["loadoutId"],
  ["manualDriveDiscIdsBySlot"],
  ["manualDriveDiscsBySlot"],
  ["driveDiscIdsBySlot"],
]

const OBSERVATION_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "firstSeenAt",
  "lastSeenAt",
  "lastImportId",
  "lastSourcePath",
  "lastSequence",
  "lastRawIndex",
  "lastBatchId",
  "sourceAccountLabel",
])

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function ownerIdOf(item) {
  return String(item?.ownerId ?? "default")
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

function ownerImportState(store, ownerId) {
  const source = store?.enkaImportState
  if (source?.version !== 1 || !source.byOwner || typeof source.byOwner !== "object") return {}
  return source.byOwner[ownerId] ?? {}
}

function withOwnerImportState(store, ownerId, nextOwnerState) {
  const source = store?.enkaImportState?.version === 1 && store.enkaImportState.byOwner
    ? clone(store.enkaImportState)
    : { version: 1, byOwner: {} }
  return {
    ...clone(store),
    enkaImportState: {
      ...source,
      version: 1,
      byOwner: { ...(source.byOwner ?? {}), [ownerId]: clone(nextOwnerState) },
    },
  }
}

function valueAtPath(value, path) {
  let current = value
  const parentPresence = []
  for (const key of path) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) {
      return { exists: false, parentPresence }
    }
    if (key !== path[path.length - 1]) parentPresence.push(true)
    current = current[key]
  }
  return { exists: true, value: clone(current), parentPresence }
}

function setAtPath(value, path, snapshot) {
  const next = clone(value ?? {}) ?? {}
  let current = next
  const parents = [next]
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) current[key] = {}
    current = current[key]
    parents.push(current)
  }
  const leaf = path[path.length - 1]
  if (snapshot?.exists) current[leaf] = clone(snapshot.value)
  else {
    delete current[leaf]
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const parentWasPresent = snapshot?.parentPresence?.[index] === true
      const child = parents[index + 1]
      if (parentWasPresent || Object.keys(child ?? {}).length) break
      delete parents[index][path[index]]
    }
  }
  return next
}

function pathKey(path) {
  return path.join(".")
}

function emptySession(uid, now, complete = true) {
  return {
    version: SESSION_VERSION,
    uid,
    complete,
    startedAt: now,
    configs: {
      canonical: { byAgent: {} },
      legacy: { byAgent: {} },
    },
    driveDiscs: {},
    loadouts: {},
  }
}

export function normalizeEnkaBindingSession(value, uid = null) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== SESSION_VERSION) return null
  const sessionUid = String(value.uid ?? "").trim()
  if (!sessionUid || (uid != null && sessionUid !== String(uid))) return null
  return {
    ...clone(value),
    version: SESSION_VERSION,
    uid: sessionUid,
    complete: value.complete === true,
    configs: {
      ...(clone(value.configs ?? {})),
      canonical: {
        ...(clone(value.configs?.canonical ?? {})),
        byAgent: clone(value.configs?.canonical?.byAgent ?? {}),
      },
      legacy: {
        ...(clone(value.configs?.legacy ?? {})),
        byAgent: clone(value.configs?.legacy?.byAgent ?? {}),
      },
    },
    driveDiscs: clone(value.driveDiscs ?? {}),
    loadouts: clone(value.loadouts ?? {}),
  }
}

function recordConfigDocument(session, kind, beforeDocument, afterDocument, ownerId, agentIds) {
  const beforeByAgent = ownerSelection(beforeDocument, ownerId).byAgent ?? {}
  const afterByAgent = ownerSelection(afterDocument, ownerId).byAgent ?? {}
  const documentState = session.configs[kind] ?? { byAgent: {} }
  const byAgent = { ...(documentState.byAgent ?? {}) }

  for (const agentId of agentIds) {
    const beforeConfig = beforeByAgent[agentId] ?? {}
    const afterConfig = afterByAgent[agentId] ?? {}
    const existingAgent = byAgent[agentId] ?? { fields: {} }
    const fields = { ...(existingAgent.fields ?? {}) }
    for (const path of CONFIG_PATHS) {
      const before = valueAtPath(beforeConfig, path)
      const after = valueAtPath(afterConfig, path)
      if (sameValue(before, after)) continue
      const key = pathKey(path)
      const existing = fields[key]
      const restore = existing && !sameValue(before, existing.lastEnkaValue)
        ? before
        : existing?.restoreValue ?? before
      fields[key] = {
        path: clone(path),
        restoreValue: clone(restore),
        lastEnkaValue: clone(after),
      }
    }
    if (Object.keys(fields).length) byAgent[agentId] = { ...existingAgent, fields }
  }

  session.configs[kind] = { ...documentState, byAgent }
}

function explicitEnkaUid(item) {
  const provenanceUid = String(item?.provenance?.enkaZzz?.uid ?? "").trim()
  const sourceType = String(item?.source?.type ?? "")
  const sourceUid = sourceType.startsWith("enka") ? String(item?.source?.uid ?? "").trim() : ""
  if (provenanceUid && sourceUid && provenanceUid !== sourceUid) return null
  return provenanceUid || sourceUid || null
}

function hasNonEnkaProvenance(item) {
  const provenance = item?.provenance ?? {}
  return Boolean(provenance.scanner || provenance.calculatorJson || provenance.manual)
}

function projectSource(provenance, fallback = null) {
  if (provenance?.enkaZzz) {
    return {
      type: "enka-zzz-showcase",
      uid: provenance.enkaZzz.uid,
      equipmentUid: provenance.enkaZzz.equipmentUid,
      ...(provenance.enkaZzz.equipmentId ? { equipmentId: provenance.enkaZzz.equipmentId } : {}),
      ...(provenance.enkaZzz.lastAgentId ? { agentId: provenance.enkaZzz.lastAgentId } : {}),
    }
  }
  if (provenance?.scanner) {
    return {
      type: "zzz-scanner",
      importId: provenance.scanner.lastImportId ?? null,
      sourcePath: provenance.scanner.lastSourcePath ?? null,
      sequence: provenance.scanner.lastSequence ?? null,
      rawIndex: provenance.scanner.lastRawIndex ?? null,
    }
  }
  if (provenance?.calculatorJson) {
    return {
      type: "calculator-json",
      importId: provenance.calculatorJson.lastImportId ?? null,
      sourceRecordId: provenance.calculatorJson.sourceRecordId ?? null,
    }
  }
  if (provenance?.manual) return { type: "manual" }
  return clone(fallback)
}

function withoutEnkaSource(item) {
  const next = clone(item)
  if (!next) return next
  const provenance = clone(next.provenance ?? { version: 1 })
  delete provenance.enkaZzz
  next.provenance = provenance
  next.source = projectSource(provenance, String(item?.source?.type ?? "").startsWith("enka") ? null : item?.source)
  return next
}

function materialItem(item) {
  const value = clone(item)
  if (!value) return value
  delete value.source
  delete value.provenance
  for (const field of OBSERVATION_FIELDS) delete value[field]
  return value
}

function materialEnkaProvenance(item) {
  const value = clone(item?.provenance?.enkaZzz ?? null)
  if (!value) return value
  delete value.firstSeenAt
  delete value.lastSeenAt
  return value
}

function recordInventoryItems(session, beforeItems, afterItems, ownerId, uid, kind) {
  const before = new Map((beforeItems ?? [])
    .filter(item => ownerIdOf(item) === ownerId)
    .map(item => [String(item.id), item]))
  const after = new Map((afterItems ?? [])
    .filter(item => ownerIdOf(item) === ownerId)
    .map(item => [String(item.id), item]))
  const records = { ...(session[kind] ?? {}) }

  for (const [id, afterItem] of after) {
    if (explicitEnkaUid(afterItem) !== uid) continue
    const beforeItem = before.get(id) ?? null
    const existing = records[id]
    if (existing && sameValue(materialItem(beforeItem), materialItem(afterItem))
      && sameValue(materialEnkaProvenance(beforeItem), materialEnkaProvenance(afterItem))) continue
    const beforeIsOldEnkaOnly = beforeItem
      && explicitEnkaUid(beforeItem) === uid
      && !hasNonEnkaProvenance(beforeItem)
    const createdByBinding = existing?.createdByBinding ?? (!beforeItem || beforeIsOldEnkaOnly)
    let restoreRecord = existing?.restoreRecord ?? null
    let lastNonEnkaRecord = existing?.lastNonEnkaRecord ?? null
    if (!existing && beforeItem && !beforeIsOldEnkaOnly) restoreRecord = clone(beforeItem)
    if (beforeItem && hasNonEnkaProvenance(beforeItem)) {
      const changedOutsideEnka = existing?.lastEnkaRecord
        && !sameValue(materialItem(beforeItem), materialItem(existing.lastEnkaRecord))
      if (!existing || changedOutsideEnka || !lastNonEnkaRecord) lastNonEnkaRecord = withoutEnkaSource(beforeItem)
    }
    records[id] = {
      ...(existing ?? {}),
      id,
      createdByBinding,
      restoreRecord: clone(restoreRecord),
      lastNonEnkaRecord: clone(lastNonEnkaRecord),
      lastEnkaRecord: clone(afterItem),
    }
  }
  session[kind] = records
}

function journalHistoryAgentIds(journal) {
  const history = journal?.after?.inventory?.history
  return Object.keys(history?.byAgent ?? {}).filter(agentId => history.byAgent?.[agentId]?.completeness === "full")
}

function deriveSessionFromJournal(ownerState, uid) {
  const journal = ownerState?.undoJournal
  if (journal?.status !== "committed" || String(journal.uid ?? "") !== uid) return null
  if (journal.before?.inventory?.binding != null) return null
  if (String(journal.after?.inventory?.binding?.uid ?? "") !== uid) return null
  const affected = new Set((journal.affectedAgentIds ?? []).map(String))
  if (journalHistoryAgentIds(journal).some(agentId => !affected.has(String(agentId)))) return null

  const session = emptySession(uid, journal.createdAt ?? null, true)
  const beforeBuild = { byOwner: { [journal.ownerId]: { byAgent: journal.before?.buildConfigs?.configs ?? {} } } }
  const afterBuild = { byOwner: { [journal.ownerId]: { byAgent: journal.after?.buildConfigs?.configs ?? {} } } }
  const beforeLegacy = { byOwner: { [journal.ownerId]: { byAgent: journal.before?.legacyConfigs?.configs ?? {} } } }
  const afterLegacy = { byOwner: { [journal.ownerId]: { byAgent: journal.after?.legacyConfigs?.configs ?? {} } } }
  recordConfigDocument(session, "canonical", beforeBuild, afterBuild, journal.ownerId, [...affected])
  recordConfigDocument(session, "legacy", beforeLegacy, afterLegacy, journal.ownerId, [...affected])
  recordInventoryItems(
    session,
    journal.before?.inventory?.driveDiscs,
    journal.after?.inventory?.driveDiscs,
    journal.ownerId,
    uid,
    "driveDiscs",
  )
  recordInventoryItems(
    session,
    journal.before?.inventory?.driveDiscLoadouts,
    journal.after?.inventory?.driveDiscLoadouts,
    journal.ownerId,
    uid,
    "loadouts",
  )
  return session
}

function sessionForImport(store, ownerId, uid, now) {
  const ownerState = ownerImportState(store, ownerId)
  const existing = normalizeEnkaBindingSession(ownerState.bindingSession, uid)
  if (existing) return existing
  if (!ownerState.binding) return emptySession(uid, now, true)
  return deriveSessionFromJournal(ownerState, uid) ?? emptySession(uid, now, false)
}

export function enkaRebindEligibility(store, ownerId) {
  const ownerState = ownerImportState(store, ownerId)
  const uid = String(ownerState.binding?.uid ?? "").trim()
  if (!uid) return { allowed: false, code: "ENKA_NOT_BOUND", uid: null }
  const session = normalizeEnkaBindingSession(ownerState.bindingSession, uid)
    ?? deriveSessionFromJournal(ownerState, uid)
  if (!session?.complete) {
    return {
      allowed: false,
      code: "ENKA_REBIND_BASELINE_INCOMPLETE",
      uid,
      message: "该账号的旧展柜导入缺少完整回退记录，无法安全更换 UID。",
    }
  }
  return { allowed: true, code: null, uid, session: clone(session) }
}

export function recordEnkaBindingSessionImport({
  storeBefore,
  storeAfter,
  buildBefore,
  buildAfter,
  legacyBefore,
  legacyAfter,
  ownerId,
  uid,
  agentIds,
  now,
}) {
  const session = sessionForImport(storeBefore, ownerId, uid, now)
  recordConfigDocument(session, "canonical", buildBefore, buildAfter, ownerId, agentIds)
  recordConfigDocument(session, "legacy", legacyBefore, legacyAfter, ownerId, agentIds)
  recordInventoryItems(session, storeBefore?.driveDiscs, storeAfter?.driveDiscs, ownerId, uid, "driveDiscs")
  recordInventoryItems(session, storeBefore?.driveDiscLoadouts, storeAfter?.driveDiscLoadouts, ownerId, uid, "loadouts")
  const ownerState = ownerImportState(storeAfter, ownerId)
  const nextStore = withOwnerImportState(storeAfter, ownerId, { ...ownerState, bindingSession: session })
  return { store: nextStore, session, changed: !sameValue(ownerState.bindingSession ?? null, session) }
}

export function recordNonEnkaBindingSessionChanges({
  storeBefore,
  storeAfter,
  ownerId,
  touchedDriveDiscIds = [],
  driveDiscIdRemap = {},
}) {
  const ownerState = ownerImportState(storeAfter, ownerId)
  const uid = String(ownerState.binding?.uid ?? "").trim()
  const session = normalizeEnkaBindingSession(ownerState.bindingSession, uid)
  if (!session) return clone(storeAfter)

  const records = { ...(session.driveDiscs ?? {}) }
  for (const [beforeId, afterId] of Object.entries(driveDiscIdRemap ?? {})) {
    if (!records[beforeId] || String(beforeId) === String(afterId)) continue
    records[afterId] = { ...records[beforeId], id: String(afterId) }
    delete records[beforeId]
  }
  const afterById = new Map((storeAfter?.driveDiscs ?? [])
    .filter(item => ownerIdOf(item) === ownerId)
    .map(item => [String(item.id), item]))
  for (const rawId of touchedDriveDiscIds ?? []) {
    const id = String(driveDiscIdRemap?.[rawId] ?? rawId)
    const item = afterById.get(id)
    if (!item || !hasNonEnkaProvenance(item)) continue
    const existing = records[id]
    if (!existing && explicitEnkaUid(item) !== uid) continue
    records[id] = {
      ...(existing ?? {
        id,
        createdByBinding: false,
        restoreRecord: null,
        lastEnkaRecord: explicitEnkaUid(item) === uid ? clone(item) : null,
      }),
      id,
      lastNonEnkaRecord: withoutEnkaSource(item),
    }
  }
  const nextSession = { ...session, driveDiscs: records }
  return withOwnerImportState(storeAfter, ownerId, { ...ownerState, bindingSession: nextSession })
}

function restoreConfigDocument(document, ownerId, documentSession) {
  const selection = clone(ownerSelection(document, ownerId)) ?? { currentAgentId: null, byAgent: {} }
  const byAgent = { ...(selection.byAgent ?? {}) }
  const restored = []
  const preserved = []
  for (const [agentId, agentState] of Object.entries(documentSession?.byAgent ?? {})) {
    let config = clone(byAgent[agentId] ?? {}) ?? {}
    for (const field of Object.values(agentState?.fields ?? {})) {
      const current = valueAtPath(config, field.path)
      if (sameValue(current, field.lastEnkaValue)) {
        config = setAtPath(config, field.path, field.restoreValue)
        restored.push({ agentId, field: pathKey(field.path) })
      } else {
        preserved.push({ agentId, field: pathKey(field.path) })
      }
    }
    byAgent[agentId] = config
  }
  return {
    document: withOwnerSelection(document, ownerId, { ...selection, byAgent }),
    restored,
    preserved,
  }
}

function cleanReferences(document, ownerId, deletedDriveDiscIds, deletedLoadoutIds) {
  const deletedDiscs = new Set(deletedDriveDiscIds)
  const deletedLoadouts = new Set(deletedLoadoutIds)
  const selection = clone(ownerSelection(document, ownerId)) ?? { currentAgentId: null, byAgent: {} }
  const byAgent = { ...(selection.byAgent ?? {}) }
  const affectedAgentIds = []
  for (const [agentId, original] of Object.entries(byAgent)) {
    const config = clone(original) ?? {}
    let changed = false
    for (const field of ["manualDriveDiscIdsBySlot", "manualDriveDiscsBySlot", "driveDiscIdsBySlot"]) {
      if (!Object.prototype.hasOwnProperty.call(config, field)) continue
      const next = Object.fromEntries(Object.entries(config[field] ?? {})
        .filter(([, id]) => !deletedDiscs.has(String(id))))
      if (!sameValue(next, config[field])) {
        config[field] = next
        changed = true
      }
    }
    for (const field of ["selectedLoadoutId", "loadoutId"]) {
      if (deletedLoadouts.has(String(config[field] ?? ""))) {
        config[field] = ""
        changed = true
      }
    }
    if (changed) {
      byAgent[agentId] = config
      affectedAgentIds.push(agentId)
    }
  }
  return { document: withOwnerSelection(document, ownerId, { ...selection, byAgent }), affectedAgentIds }
}

function explicitOldEnkaItems(items, ownerId, uid) {
  return (items ?? []).filter(item => ownerIdOf(item) === ownerId && explicitEnkaUid(item) === uid)
}

export function buildEnkaBindingCleanup({ store, ownerId, buildSelection, legacySelection, now = new Date() }) {
  const eligibility = enkaRebindEligibility(store, ownerId)
  if (!eligibility.allowed) {
    return {
      blocked: true,
      blockingErrors: [{ code: eligibility.code, message: eligibility.message ?? "当前账号无法安全更换 UID。" }],
      store: clone(store),
      buildSelection: clone(buildSelection),
      legacySelection: clone(legacySelection),
    }
  }
  const uid = eligibility.uid
  const session = eligibility.session
  const trackedDiscIds = new Set(Object.keys(session.driveDiscs ?? {}))
  const trackedLoadoutIds = new Set(Object.keys(session.loadouts ?? {}))
  const untrackedDiscs = explicitOldEnkaItems(store.driveDiscs, ownerId, uid)
    .filter(item => !trackedDiscIds.has(String(item.id)))
  const untrackedLoadouts = explicitOldEnkaItems(store.driveDiscLoadouts, ownerId, uid)
    .filter(item => !trackedLoadoutIds.has(String(item.id)))
  if (untrackedDiscs.length || untrackedLoadouts.length) {
    return {
      blocked: true,
      blockingErrors: [{
        code: "ENKA_REBIND_UNTRACKED_DATA",
        message: "检测到未纳入绑定周期记录的旧展柜数据，无法安全更换 UID。",
        driveDiscCount: untrackedDiscs.length,
        loadoutCount: untrackedLoadouts.length,
      }],
      store: clone(store),
      buildSelection: clone(buildSelection),
      legacySelection: clone(legacySelection),
    }
  }

  const deletedDriveDiscIds = []
  const detachedDriveDiscIds = []
  const nextOwnerDiscs = []
  for (const disc of (store.driveDiscs ?? []).filter(item => ownerIdOf(item) === ownerId)) {
    const id = String(disc.id)
    const entry = session.driveDiscs?.[id]
    if (!entry || explicitEnkaUid(disc) !== uid) {
      nextOwnerDiscs.push(clone(disc))
      continue
    }
    const remainingProvenance = clone(disc.provenance ?? { version: 1 })
    delete remainingProvenance.enkaZzz
    const hasOtherSource = Boolean(remainingProvenance.scanner || remainingProvenance.calculatorJson || remainingProvenance.manual)
    if (entry.createdByBinding && !hasOtherSource) {
      deletedDriveDiscIds.push(id)
      continue
    }
    const unchangedSinceEnka = sameValue(materialItem(disc), materialItem(entry.lastEnkaRecord))
    const fallback = unchangedSinceEnka
      ? entry.lastNonEnkaRecord ?? entry.restoreRecord ?? disc
      : disc
    nextOwnerDiscs.push({
      ...clone(fallback),
      id,
      ownerId,
      createdAt: disc.createdAt ?? fallback?.createdAt ?? null,
      updatedAt: now.toISOString(),
      reservedForAgentId: Object.prototype.hasOwnProperty.call(disc, "reservedForAgentId")
        ? disc.reservedForAgentId ?? null
        : fallback?.reservedForAgentId ?? null,
      excludedForAgentIds: clone(disc.excludedForAgentIds ?? fallback?.excludedForAgentIds ?? []),
      provenance: remainingProvenance,
      source: projectSource(remainingProvenance, fallback?.source),
    })
    detachedDriveDiscIds.push(id)
  }

  const deletedLoadoutIds = []
  const retainedLoadouts = []
  for (const loadout of store.driveDiscLoadouts ?? []) {
    if (ownerIdOf(loadout) !== ownerId) continue
    const id = String(loadout.id)
    if (session.loadouts?.[id] && explicitEnkaUid(loadout) === uid) {
      deletedLoadoutIds.push(id)
      continue
    }
    const nextIds = Object.fromEntries(Object.entries(loadout.driveDiscIdsBySlot ?? {})
      .filter(([, discId]) => !deletedDriveDiscIds.includes(String(discId))))
    retainedLoadouts.push(sameValue(nextIds, loadout.driveDiscIdsBySlot ?? {})
      ? clone(loadout)
      : { ...clone(loadout), driveDiscIdsBySlot: nextIds, updatedAt: now.toISOString() })
  }

  const restoredBuild = restoreConfigDocument(buildSelection, ownerId, session.configs?.canonical)
  const restoredLegacy = restoreConfigDocument(legacySelection, ownerId, session.configs?.legacy)
  const cleanBuild = cleanReferences(restoredBuild.document, ownerId, deletedDriveDiscIds, deletedLoadoutIds)
  const cleanLegacy = cleanReferences(restoredLegacy.document, ownerId, deletedDriveDiscIds, deletedLoadoutIds)
  const currentOwnerState = ownerImportState(store, ownerId)
  const nextOwnerState = { ...clone(currentOwnerState) }
  delete nextOwnerState.binding
  delete nextOwnerState.bindingSession
  delete nextOwnerState.history
  nextOwnerState.undoJournal = null
  const nextStore = withOwnerImportState({
    ...clone(store),
    driveDiscs: [
      ...(store.driveDiscs ?? []).filter(item => ownerIdOf(item) !== ownerId),
      ...nextOwnerDiscs,
    ],
    driveDiscLoadouts: [
      ...(store.driveDiscLoadouts ?? []).filter(item => ownerIdOf(item) !== ownerId),
      ...retainedLoadouts,
    ],
  }, ownerId, nextOwnerState)

  return {
    blocked: false,
    uid,
    store: nextStore,
    buildSelection: cleanBuild.document,
    legacySelection: cleanLegacy.document,
    deletedDriveDiscIds,
    detachedDriveDiscIds,
    deletedLoadoutIds,
    restoredFields: [...restoredBuild.restored, ...restoredLegacy.restored],
    preservedFields: [...restoredBuild.preserved, ...restoredLegacy.preserved],
    affectedAgentIds: [...new Set([
      ...restoredBuild.restored,
      ...restoredBuild.preserved,
      ...restoredLegacy.restored,
      ...restoredLegacy.preserved,
    ].map(item => String(item.agentId)))],
    cleanedReferenceAgentIds: [...new Set([...cleanBuild.affectedAgentIds, ...cleanLegacy.affectedAgentIds])],
    summary: {
      deletedDriveDiscs: deletedDriveDiscIds.length,
      detachedDriveDiscs: detachedDriveDiscIds.length,
      deletedLoadouts: deletedLoadoutIds.length,
      restoredConfigFields: restoredBuild.restored.length + restoredLegacy.restored.length,
      preservedUserFields: restoredBuild.preserved.length + restoredLegacy.preserved.length,
    },
  }
}
