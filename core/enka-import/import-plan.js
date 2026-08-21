import { buildDriveDiscSyncPlan, enkaLoadoutId } from "./drive-disc-plan.js"
import { normalizeInventoryStore } from "../inventory-model.js"
import {
  buildEnkaBindingCleanup,
  enkaRebindEligibility,
  recordEnkaBindingSessionImport,
} from "./binding-session.js"

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

const GAME_UID_PATTERN = /^\d{8,12}$/
const OBSERVATION_SOURCE_FIELDS = [
  "matchedAt",
  "importedAt",
  "importId",
  "sourcePath",
  "sequence",
  "rawIndex",
  "batchId",
]

function materialInventoryItem(item) {
  const value = clone(item) ?? {}
  delete value.updatedAt
  if (value.source && typeof value.source === "object") {
    for (const field of OBSERVATION_SOURCE_FIELDS) delete value.source[field]
  }
  for (const source of Object.values(value.provenance ?? {})) {
    if (!source || typeof source !== "object") continue
    delete source.lastSeenAt
    delete source.lastImportId
    delete source.lastSourcePath
    delete source.lastSequence
    delete source.lastRawIndex
    delete source.sourceAccountLabel
    delete source.lastBatchId
  }
  return value
}

function materialStoreFingerprint(store) {
  const value = clone(store) ?? {}
  delete value.updatedAt
  value.driveDiscs = (value.driveDiscs ?? []).map(materialInventoryItem)
  value.driveDiscLoadouts = (value.driveDiscLoadouts ?? []).map(materialInventoryItem)
  return jsonFingerprint(value)
}

function materialOwnerInventory(store, ownerId) {
  const belongsToOwner = item => String(item?.ownerId ?? "default") === String(ownerId)
  return {
    driveDiscs: (store?.driveDiscs ?? []).filter(belongsToOwner).map(materialInventoryItem),
    driveDiscLoadouts: (store?.driveDiscLoadouts ?? []).filter(belongsToOwner).map(materialInventoryItem),
  }
}

function blockingError(code, message, details = {}) {
  return { code, message, ...clone(details) }
}

function validateImportIdentity(uid, mappedAgents) {
  const errors = []
  if (!GAME_UID_PATTERN.test(uid)) {
    errors.push(blockingError("INVALID_GAME_UID", "游戏 UID 必须为 8 至 12 位数字。", { uid }))
    return errors
  }

  for (const agent of mappedAgents ?? []) {
    const agentId = String(agent?.agentId ?? "")
    const sourceUid = String(agent?.sourceUid ?? "").trim()
    if (!sourceUid) {
      errors.push(blockingError(
        "AGENT_SOURCE_UID_MISSING",
        `${agent?.agentName || agentId || "角色"} 缺少来源 UID。`,
        { uid, agentId },
      ))
    } else if (sourceUid !== uid) {
      errors.push(blockingError(
        "AGENT_SOURCE_UID_MISMATCH",
        `${agent?.agentName || agentId || "角色"} 的来源 UID 与本次导入 UID 不一致。`,
        { uid, sourceUid, agentId },
      ))
    }

    const preset = agent?.driveDiscPreset
    if (preset && Object.prototype.hasOwnProperty.call(preset, "agentId")) {
      const presetAgentId = String(preset.agentId ?? "").trim()
      if (!presetAgentId || presetAgentId !== agentId) {
        errors.push(blockingError(
          "ENKA_PRESET_AGENT_MISMATCH",
          `${agent?.agentName || agentId || "角色"} 的驱动盘套装来源角色不一致。`,
          { uid, agentId, presetAgentId },
        ))
      }
    }

    for (const disc of agent?.driveDiscPreset?.driveDiscs ?? []) {
      const equipmentUid = String(
        disc?.provenance?.enkaZzz?.equipmentUid
          ?? disc?.source?.equipmentUid
          ?? disc?.id
          ?? "",
      )
      const provenance = disc?.provenance?.enkaZzz
      const source = String(disc?.source?.type ?? "").startsWith("enka") ? disc.source : null
      const observedSources = [
        ...(provenance ? [{ kind: "provenance", value: provenance }] : []),
        ...(source ? [{ kind: "source", value: source }] : []),
      ]
      const agentObservations = [
        ...(provenance ? [{ kind: "provenance", value: provenance.lastAgentId }] : []),
        ...(source ? [{ kind: "source", value: source.agentId }] : []),
        { kind: "equippedBy", value: disc?.equippedBy },
      ]
      for (const observed of agentObservations) {
        const observedAgentId = String(observed.value ?? "").trim()
        if (!observedAgentId) {
          errors.push(blockingError(
            "ENKA_DISC_AGENT_MISSING",
            `${agent?.agentName ?? agentId ?? "角色"} 的驱动盘 ${equipmentUid || "未知"} 缺少来源角色。`,
            { uid, agentId, equipmentUid, sourceKind: observed.kind },
          ))
        } else if (observedAgentId !== agentId) {
          errors.push(blockingError(
            "ENKA_DISC_AGENT_MISMATCH",
            `${agent?.agentName ?? agentId ?? "角色"} 的驱动盘 ${equipmentUid || "未知"} 来源角色不一致。`,
            { uid, agentId, observedAgentId, equipmentUid, sourceKind: observed.kind },
          ))
        }
      }
      if (!observedSources.length) {
        errors.push(blockingError(
          "ENKA_DISC_SOURCE_MISSING",
          `${agent?.agentName ?? agentId ?? "角色"} 的驱动盘 ${equipmentUid || "未知"} 缺少 Enka 来源身份。`,
          { uid, agentId, equipmentUid },
        ))
        continue
      }
      for (const observed of observedSources) {
        const sourceUid = String(observed.value?.uid ?? "").trim()
        if (!sourceUid) {
          errors.push(blockingError(
            "ENKA_DISC_UID_MISSING",
            `${agent?.agentName ?? agentId ?? "角色"} 的驱动盘 ${equipmentUid || "未知"} 缺少来源 UID。`,
            { uid, agentId, equipmentUid, sourceKind: observed.kind },
          ))
        } else if (sourceUid !== uid) {
          errors.push(blockingError(
            "ENKA_DISC_UID_MISMATCH",
            `${agent?.agentName ?? agentId ?? "角色"} 的驱动盘 ${equipmentUid || "未知"} 来源 UID 不一致。`,
            { uid, sourceUid, agentId, equipmentUid, sourceKind: observed.kind },
          ))
        }
      }
    }
  }
  return errors
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

function historySnapshot(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const driveDiscCount = Number(source.driveDiscCount)
  const driveDiscSourceCount = source.driveDiscSourceCount == null
    ? null
    : Number(source.driveDiscSourceCount)
  const snapshot = {
    ...clone(source),
    driveDiscCount: Number.isInteger(driveDiscCount) && driveDiscCount >= 0 ? driveDiscCount : 0,
    driveDiscSourceCount: Number.isInteger(driveDiscSourceCount) && driveDiscSourceCount >= 0
      ? driveDiscSourceCount
      : null,
  }
  for (const field of ["agentLevel", "cinemaLevel", "coreSkillLevel"]) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue
    if (source[field] == null || source[field] === "") {
      delete snapshot[field]
      continue
    }
    const number = Number(source[field])
    if (Number.isFinite(number)) snapshot[field] = number
    else delete snapshot[field]
  }
  if (Object.prototype.hasOwnProperty.call(source, "wEngine")) {
    const engine = source.wEngine
    if (engine == null) snapshot.wEngine = null
    else if (engine && typeof engine === "object" && !Array.isArray(engine)) {
      const id = String(engine.id ?? "").trim()
      const name = String(engine.name ?? "").trim()
      const level = Number(engine.level)
      const modificationLevel = Number(engine.modificationLevel)
      if (id && name && engine.level != null && engine.modificationLevel != null
        && Number.isFinite(level) && Number.isFinite(modificationLevel)) {
        snapshot.wEngine = {
          ...clone(engine),
          id,
          name,
          level,
          modificationLevel,
        }
      } else {
        delete snapshot.wEngine
      }
    } else {
      delete snapshot.wEngine
    }
  }
  return snapshot
}

function validHistoryRecord(value, agentId, bindingUid) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const normalizedAgentId = String(value.agentId ?? "").trim()
  const agentName = String(value.agentName ?? "").trim()
  const uid = String(value.uid ?? "").trim()
  const completeness = value.completeness === "full" || value.completeness === "partial"
    ? value.completeness
    : null
  if (!normalizedAgentId || normalizedAgentId !== String(agentId) || !agentName || !uid || uid !== bindingUid || !completeness) {
    return null
  }
  if (!value.snapshot || typeof value.snapshot !== "object" || Array.isArray(value.snapshot)) return null
  return {
    ...clone(value),
    agentId: normalizedAgentId,
    agentName,
    uid,
    completeness,
    firstImportedAt: typeof value.firstImportedAt === "string" ? value.firstImportedAt : null,
    lastImportedAt: typeof value.lastImportedAt === "string" ? value.lastImportedAt : null,
    snapshot: historySnapshot(value.snapshot),
  }
}

export function enkaImportHistoryForOwner(store, ownerId) {
  const ownerState = normalizeEnkaImportState(store).byOwner?.[ownerId] ?? {}
  const bindingUid = String(ownerState.binding?.uid ?? "").trim()
  const source = ownerState.history
  const rawByAgent = source?.version === 1 && source?.byAgent && typeof source.byAgent === "object"
    ? source.byAgent
    : {}
  const byAgent = {}
  if (bindingUid) {
    for (const [agentId, value] of Object.entries(rawByAgent)) {
      const record = validHistoryRecord(value, agentId, bindingUid)
      if (record) byAgent[agentId] = record
    }
  }
  return {
    ...(source && typeof source === "object" && !Array.isArray(source) ? clone(source) : {}),
    version: 1,
    backfillVersion: source?.backfillVersion === 1 ? 1 : null,
    byAgent,
  }
}

function catalogAgentName(agent) {
  const localized = value => {
    if (typeof value === "string") return value.trim()
    if (!value || typeof value !== "object") return ""
    return String(value.zhCN ?? value["zh-CN"] ?? value.cn ?? value.en ?? "").trim()
  }
  return localized(agent?.name) || localized(agent?.label) || String(agent?.displayName ?? "").trim()
}

function explicitEnkaLoadoutIdentity(loadout) {
  const provenance = loadout?.provenance?.enkaZzz
  const source = String(loadout?.source?.type ?? "").startsWith("enka") ? loadout.source : null
  const identities = [
    ...(provenance ? [{ uid: provenance.uid, agentId: provenance.lastAgentId }] : []),
    ...(source ? [{ uid: source.uid, agentId: source.agentId }] : []),
  ].map(identity => ({
    uid: String(identity.uid ?? "").trim(),
    agentId: String(identity.agentId ?? "").trim(),
  }))
  if (!identities.length || identities.some(identity => !identity.uid || !identity.agentId)) return null
  if (identities.some(identity => identity.uid !== identities[0].uid || identity.agentId !== identities[0].agentId)) return null
  return identities[0]
}

export function backfillEnkaImportHistory({ store, ownerId, knownAgents, now = new Date() }) {
  const normalizedStore = normalizeInventoryStore(store)
  const ownerState = normalizeEnkaImportState(normalizedStore).byOwner?.[ownerId] ?? {}
  const bindingUid = String(ownerState.binding?.uid ?? "").trim()
  const rawHistory = ownerState.history && typeof ownerState.history === "object" && !Array.isArray(ownerState.history)
    ? clone(ownerState.history)
    : {}
  if (rawHistory.backfillVersion === 1 || !bindingUid || !Array.isArray(knownAgents) || !knownAgents.length) {
    return {
      changed: false,
      store: clone(normalizedStore),
      history: enkaImportHistoryForOwner(normalizedStore, ownerId),
    }
  }

  const agentNames = new Map((knownAgents ?? [])
    .map(agent => [String(agent?.id ?? "").trim(), catalogAgentName(agent)])
    .filter(([agentId, name]) => agentId && name))
  const rawByAgent = rawHistory.byAgent && typeof rawHistory.byAgent === "object" && !Array.isArray(rawHistory.byAgent)
    ? clone(rawHistory.byAgent)
    : {}
  const backfilledAt = now.toISOString()
  for (const loadout of normalizedStore.driveDiscLoadouts ?? []) {
    if (String(loadout?.ownerId ?? "default") !== String(ownerId)) continue
    const agentId = String(loadout?.agentId ?? "").trim()
    const agentName = agentNames.get(agentId)
    const identity = explicitEnkaLoadoutIdentity(loadout)
    if (!agentId || !agentName || !identity || identity.uid !== bindingUid || identity.agentId !== agentId) continue
    if (String(loadout?.id ?? "") !== enkaLoadoutId(bindingUid, agentId)) continue
    if (validHistoryRecord(rawByAgent[agentId], agentId, bindingUid)) continue
    rawByAgent[agentId] = {
      ...(rawByAgent[agentId] && typeof rawByAgent[agentId] === "object" ? clone(rawByAgent[agentId]) : {}),
      agentId,
      agentName,
      uid: bindingUid,
      completeness: "partial",
      firstImportedAt: null,
      lastImportedAt: null,
      backfilledAt,
      snapshot: {
        driveDiscCount: slotCount(loadout.driveDiscIdsBySlot),
        driveDiscSourceCount: null,
      },
    }
  }
  const nextHistory = {
    ...rawHistory,
    version: 1,
    backfillVersion: 1,
    byAgent: rawByAgent,
  }
  const nextStore = setOwnerImportState(normalizedStore, ownerId, {
    ...ownerState,
    history: nextHistory,
  })
  return {
    changed: true,
    store: nextStore,
    history: enkaImportHistoryForOwner(nextStore, ownerId),
  }
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

function configuredManualDriveDiscIdsBySlot(config) {
  return config?.manualDriveDiscIdsBySlot
    ?? config?.manualDriveDiscsBySlot
    ?? config?.driveDiscIdsBySlot
    ?? {}
}

function cleanIdsBySlot(value) {
  return Object.fromEntries(Object.entries(value ?? {})
    .map(([slot, id]) => [String(slot), String(id ?? "").trim()])
    .filter(([, id]) => Boolean(id)))
}

function slotCount(value) {
  return Object.keys(cleanIdsBySlot(value)).length
}

function finiteHistoryNumber(value) {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function coreSkillHistoryNumber(value) {
  if (value === "none") return 0
  const grade = String(value ?? "").trim().toUpperCase()
  if (/^[A-F]$/.test(grade)) return grade.charCodeAt(0) - 64
  return finiteHistoryNumber(value)
}

function importedAgentHistorySnapshot(agent, driveResult) {
  const snapshot = {
    driveDiscCount: slotCount(driveResult?.driveDiscIdsBySlot),
    driveDiscSourceCount: agent?.driveDiscSourceCount != null
      && Number.isInteger(Number(agent.driveDiscSourceCount))
      && Number(agent.driveDiscSourceCount) >= 0
      ? Number(agent.driveDiscSourceCount)
      : null,
  }
  for (const field of ["agentLevel", "cinemaLevel", "coreSkillLevel"]) {
    const number = field === "coreSkillLevel"
      ? coreSkillHistoryNumber(agent?.[field])
      : finiteHistoryNumber(agent?.[field])
    if (number != null) snapshot[field] = number
  }
  if (agent?.wEngine) {
    const id = String(agent.wEngine.id ?? "").trim()
    const name = String(agent.wEngine.name ?? "").trim()
    const level = finiteHistoryNumber(agent.wEngine.level)
    const modificationLevel = finiteHistoryNumber(agent.wEngine.modificationLevel)
    snapshot.wEngine = id && name && level != null && modificationLevel != null
      ? { id, name, level, modificationLevel }
      : null
  } else {
    snapshot.wEngine = null
  }
  return snapshot
}

function materialHistoryRecord(record) {
  if (!record) return null
  return {
    agentId: record.agentId,
    agentName: record.agentName,
    uid: record.uid,
    completeness: record.completeness,
    snapshot: historySnapshot(record.snapshot),
  }
}

function mergeImportedAgentHistory({ store, ownerId, uid, mappedAgents, driveByAgent, importedAt }) {
  const ownerState = normalizeEnkaImportState(store).byOwner?.[ownerId] ?? {}
  const rawHistory = ownerState.history && typeof ownerState.history === "object" && !Array.isArray(ownerState.history)
    ? clone(ownerState.history)
    : {}
  const rawByAgent = rawHistory.byAgent && typeof rawHistory.byAgent === "object" && !Array.isArray(rawHistory.byAgent)
    ? clone(rawHistory.byAgent)
    : {}
  const addedAgentIds = []
  const updatedAgentIds = []

  for (const agent of mappedAgents ?? []) {
    const agentId = String(agent?.agentId ?? "").trim()
    const agentName = String(agent?.agentName ?? "").trim()
    if (!agentId || !agentName) continue
    const existing = validHistoryRecord(rawByAgent[agentId], agentId, uid)
    const desiredMaterial = {
      agentId,
      agentName,
      uid,
      completeness: "full",
      snapshot: importedAgentHistorySnapshot(agent, driveByAgent.get(agentId)),
    }
    if (sameValue(materialHistoryRecord(existing), desiredMaterial)) continue
    const nextRecord = {
      ...(rawByAgent[agentId] && typeof rawByAgent[agentId] === "object" ? clone(rawByAgent[agentId]) : {}),
      ...desiredMaterial,
      firstImportedAt: existing?.firstImportedAt ?? importedAt,
      lastImportedAt: importedAt,
    }
    delete nextRecord.backfilledAt
    rawByAgent[agentId] = nextRecord
    if (existing) updatedAgentIds.push(agentId)
    else addedAgentIds.push(agentId)
  }

  return {
    history: {
      ...rawHistory,
      version: 1,
      byAgent: rawByAgent,
    },
    addedAgentIds,
    updatedAgentIds,
    changedAgentIds: [...addedAgentIds, ...updatedAgentIds],
  }
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
    let skillChangeRecorded = false
    if (!sameValue(current.skillLevels ?? current.skillLevelsByCategory ?? {}, nextSkills)) {
      next.skillLevels = nextSkills
      changes.push({
        field: "skillLevels",
        label: "技能等级",
        before: fieldDisplay(current.skillLevels ?? current.skillLevelsByCategory ?? {}),
        after: fieldDisplay(nextSkills),
      })
      skillChangeRecorded = true
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
    const mirrorsChanged = !sameValue(
      currentDamage.skillLevelsByCategory ?? {},
      next.damage.skillLevelsByCategory,
    ) || (current.damageConfig && typeof current.damageConfig === "object" && !sameValue(
      current.damageConfig.skillLevelsByCategory ?? {},
      next.damageConfig.skillLevelsByCategory,
    ))
    if (!skillChangeRecorded && mirrorsChanged) {
      changes.push({
        field: "skillLevels",
        label: "技能等级同步",
        before: fieldDisplay(currentDamage.skillLevelsByCategory ?? {}),
        after: fieldDisplay(next.damage.skillLevelsByCategory),
      })
    }
  }

  if (agent.wEngine) {
    applyField("wEngineId", "音擎", agent.wEngine.id)
    applyField("wEngineLevel", "音擎等级", agent.wEngine.level)
    applyField("wEngineModificationLevel", "音擎精炼", agent.wEngine.modificationLevel)
  }

  if (driveResult?.hasUsableLoadout) {
    applyField("discMode", "驱动盘模式", "loadout")
    const selectedLoadoutChanged = !sameValue(current.selectedLoadoutId, driveResult.loadoutId)
    applyField("selectedLoadoutId", "驱动盘配装", driveResult.loadoutId)
    if (Object.prototype.hasOwnProperty.call(current, "loadoutId")
      && !sameValue(current.loadoutId, driveResult.loadoutId)) {
      next.loadoutId = clone(driveResult.loadoutId)
      if (!selectedLoadoutChanged) {
        changes.push({
          field: "loadoutId",
          label: "驱动盘配装同步",
          before: fieldDisplay(current.loadoutId),
          after: fieldDisplay(driveResult.loadoutId),
        })
      }
    }
    const currentManualIds = cleanIdsBySlot(configuredManualDriveDiscIdsBySlot(current))
    const nextManualIds = cleanIdsBySlot(driveResult.driveDiscIdsBySlot)
    const mirrorsChanged = !sameValue(current.manualDriveDiscIdsBySlot ?? null, nextManualIds)
      || (Object.prototype.hasOwnProperty.call(current, "manualDriveDiscsBySlot")
        && !sameValue(current.manualDriveDiscsBySlot, nextManualIds))
      || (Object.prototype.hasOwnProperty.call(current, "driveDiscIdsBySlot")
        && !sameValue(current.driveDiscIdsBySlot, nextManualIds))
    next.manualDriveDiscIdsBySlot = clone(nextManualIds)
    if (Object.prototype.hasOwnProperty.call(current, "manualDriveDiscsBySlot")) {
      next.manualDriveDiscsBySlot = clone(nextManualIds)
    }
    if (Object.prototype.hasOwnProperty.call(current, "driveDiscIdsBySlot")) {
      next.driveDiscIdsBySlot = clone(nextManualIds)
    }
    if (mirrorsChanged) {
      const clearedSlots = [1, 2, 3, 4, 5, 6]
        .filter(slot => currentManualIds[String(slot)] && !nextManualIds[String(slot)])
      changes.push({
        field: "manualDriveDiscIdsBySlot",
        label: "自选套装",
        before: `原 ${slotCount(currentManualIds)}/6`,
        after: `展柜 ${slotCount(nextManualIds)}/6${clearedSlots.length ? `（清空 ${clearedSlots.join("、")} 号位）` : ""}`,
        clearedSlots,
      })
    }
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
  const ownerPresent = Boolean(document?.byOwner && typeof document.byOwner === "object")
    ? Object.prototype.hasOwnProperty.call(document.byOwner, ownerId)
    : ownerId === "default" && Boolean(document && typeof document === "object" && !Array.isArray(document))
  return {
    version: 1,
    ownerPresent,
    currentAgentId: clone(selection.currentAgentId ?? null),
    configs: Object.fromEntries(agentIds.map(agentId => [
      agentId,
      Object.prototype.hasOwnProperty.call(selection.byAgent ?? {}, agentId)
        ? clone(selection.byAgent[agentId])
        : null,
    ])),
  }
}

function configDriveDiscReferences(document, ownerId, agentIds) {
  const selection = ownerSelection(document, ownerId)
  const driveDiscIds = new Set()
  const loadoutIds = new Set()
  for (const agentId of agentIds) {
    const config = selection.byAgent?.[agentId]
    if (!config || typeof config !== "object") continue
    for (const field of ["manualDriveDiscIdsBySlot", "manualDriveDiscsBySlot", "driveDiscIdsBySlot"]) {
      for (const id of Object.values(config[field] ?? {})) {
        const normalized = String(id ?? "").trim()
        if (normalized) driveDiscIds.add(normalized)
      }
    }
    for (const field of ["selectedLoadoutId", "loadoutId"]) {
      const normalized = String(config[field] ?? "").trim()
      if (normalized) loadoutIds.add(normalized)
    }
  }
  return { driveDiscIds: [...driveDiscIds], loadoutIds: [...loadoutIds] }
}

function inventorySnapshot(store, ownerId, discIds, loadoutIds) {
  return {
    driveDiscs: itemsSnapshot(store.driveDiscs, ownerId, discIds),
    driveDiscLoadouts: itemsSnapshot(store.driveDiscLoadouts, ownerId, loadoutIds),
    binding: clone(enkaBindingForOwner(store, ownerId)),
    history: clone(normalizeEnkaImportState(store).byOwner?.[ownerId]?.history ?? null),
    bindingSession: clone(normalizeEnkaImportState(store).byOwner?.[ownerId]?.bindingSession ?? null),
  }
}

function materialImportHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) return null
  return {
    version: 1,
    byAgent: Object.fromEntries(Object.entries(history.byAgent ?? {})
      .filter(([, record]) => record?.completeness === "full")
      .map(([agentId, record]) => [agentId, clone(record)])),
  }
}

function historyWithCurrentNonFullRecords(targetHistory, currentHistory) {
  const target = targetHistory && typeof targetHistory === "object" && !Array.isArray(targetHistory)
    ? clone(targetHistory)
    : null
  const current = currentHistory && typeof currentHistory === "object" && !Array.isArray(currentHistory)
    ? currentHistory
    : null
  const preservedEntries = Object.fromEntries(Object.entries(current?.byAgent ?? {})
    .filter(([agentId, record]) => !Object.prototype.hasOwnProperty.call(target?.byAgent ?? {}, agentId)
      && record?.completeness !== "full")
    .map(([agentId, record]) => [agentId, clone(record)]))
  if (!target && !Object.keys(preservedEntries).length && current?.backfillVersion !== 1) return null
  return {
    ...(target ?? {}),
    version: 1,
    ...(current?.backfillVersion === 1 ? { backfillVersion: 1 } : {}),
    byAgent: {
      ...(clone(target?.byAgent ?? {}) ?? {}),
      ...preservedEntries,
    },
  }
}

function ownerJournal(store, ownerId) {
  return normalizeEnkaImportState(store).byOwner?.[ownerId]?.undoJournal ?? null
}

function blockedImportPlan({
  uid,
  mappedAgents,
  store,
  ownerId,
  buildSelection,
  legacySelection,
  transactionId,
  blockingErrors,
  drivePlan = null,
}) {
  const errors = clone(blockingErrors ?? [])
  const unchangedDrivePlan = drivePlan ?? {
    changed: false,
    results: [],
    warnings: [],
    conflicts: [],
    blockingErrors: errors,
    hasBlockingErrors: true,
    hasUnresolvedConflicts: true,
    migrations: { driveDiscs: [], loadouts: [] },
    nextStore: clone(store),
  }
  return {
    uid,
    ownerId,
    transactionId,
    agents: (mappedAgents ?? []).map(agent => ({
      agentId: agent?.agentId,
      agentName: agent?.agentName,
      changes: [],
      changed: false,
      drive: null,
    })),
    warnings: clone(unchangedDrivePlan.warnings ?? []),
    drivePlan: unchangedDrivePlan,
    conflicts: clone(unchangedDrivePlan.conflicts ?? []),
    blockingErrors: errors,
    hasBlockingErrors: true,
    hasUnresolvedConflicts: true,
    nextStore: clone(store),
    nextBuildSelection: clone(buildSelection),
    nextLegacySelection: clone(legacySelection),
    journal: null,
    isNoop: false,
    historyChanges: { addedAgentIds: [], updatedAgentIds: [] },
    changeCount: 0,
  }
}

export function buildEnkaImportPlan({
  uid,
  mappedAgents,
  store,
  ownerId,
  buildSelection,
  legacySelection,
  driveDiscResolutions = {},
  now = new Date(),
  transactionId = `enka-${now.getTime()}`,
}) {
  const normalizedUid = String(uid ?? "").trim()
  if (!GAME_UID_PATTERN.test(normalizedUid)) {
    return blockedImportPlan({
      uid: normalizedUid,
      mappedAgents,
      store,
      ownerId,
      buildSelection,
      legacySelection,
      transactionId,
      blockingErrors: [blockingError(
        "INVALID_GAME_UID",
        "游戏 UID 必须为 8 至 12 位数字。",
        { uid: normalizedUid },
      )],
    })
  }
  const binding = enkaBindingForOwner(store, ownerId)
  if (binding && String(binding.uid) !== normalizedUid) {
    const error = new Error(`当前 Calculator 账号已绑定 UID ${binding.uid}，请切换或新建账号后再导入。`)
    error.code = "UID_BINDING_MISMATCH"
    throw error
  }
  const identityErrors = validateImportIdentity(normalizedUid, mappedAgents)
  if (identityErrors.length) {
    return blockedImportPlan({
      uid: normalizedUid,
      mappedAgents,
      store,
      ownerId,
      buildSelection,
      legacySelection,
      transactionId,
      blockingErrors: identityErrors,
    })
  }
  const drivePlan = buildDriveDiscSyncPlan({
    uid: normalizedUid,
    mappedAgents,
    driveDiscState: { ownerId, store },
    resolutions: driveDiscResolutions,
    now,
  })
  const driveBlockingErrors = clone(drivePlan.blockingErrors ?? [])
  if (driveBlockingErrors.length || drivePlan.hasBlockingErrors) {
    return blockedImportPlan({
      uid: normalizedUid,
      mappedAgents,
      store,
      ownerId,
      buildSelection,
      legacySelection,
      transactionId,
      blockingErrors: driveBlockingErrors.length
        ? driveBlockingErrors
        : [blockingError("ENKA_DRIVE_DISC_IDENTITY_INVALID", "展柜驱动盘身份异常，已阻止导入。")],
      drivePlan,
    })
  }
  const driveByAgent = new Map(drivePlan.results.map(result => [result.agentId, result]))
  const importedAt = now.toISOString()
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
  const bindingSessionResult = recordEnkaBindingSessionImport({
    storeBefore: store,
    storeAfter: drivePlan.nextStore,
    buildBefore: buildSelection,
    buildAfter: nextBuildSelection,
    legacyBefore: legacySelection,
    legacyAfter: nextLegacySelection,
    ownerId,
    uid: normalizedUid,
    agentIds: selectedAgentIds,
    now: importedAt,
  })
  const storeWithBindingSession = bindingSessionResult.store
  const inventoryChanged = !sameValue(
    materialOwnerInventory(store, ownerId),
    materialOwnerInventory(storeWithBindingSession, ownerId),
  )
  const selectionsChanged = !sameValue(buildSelection, nextBuildSelection)
    || !sameValue(legacySelection, nextLegacySelection)
  const historyResult = mergeImportedAgentHistory({
    store: storeWithBindingSession,
    ownerId,
    uid: normalizedUid,
    mappedAgents,
    driveByAgent,
    importedAt,
  })
  const historyChanged = historyResult.changedAgentIds.length > 0
  const isNoop = Boolean(binding)
    && !inventoryChanged
    && !selectionsChanged
    && !bindingSessionResult.changed
    && !historyChanged
    && !drivePlan.hasUnresolvedConflicts
    && !(drivePlan.conflicts?.length)
  if (isNoop) {
    return {
      uid: normalizedUid,
      ownerId,
      transactionId,
      agents,
      warnings: drivePlan.warnings,
      drivePlan,
      conflicts: drivePlan.conflicts,
      blockingErrors: [],
      hasBlockingErrors: false,
      hasUnresolvedConflicts: false,
      nextStore: clone(store),
      nextBuildSelection: clone(buildSelection),
      nextLegacySelection: clone(legacySelection),
      journal: null,
      baseFingerprint: {
        store: materialStoreFingerprint(store),
        buildSelection: jsonFingerprint(buildSelection),
        legacySelection: jsonFingerprint(legacySelection),
      },
      isNoop: true,
      historyChanges: { addedAgentIds: [], updatedAgentIds: [] },
      changeCount: 0,
    }
  }
  const currentOwnerState = normalizeEnkaImportState(storeWithBindingSession).byOwner?.[ownerId] ?? {}
  let nextStore = normalizeInventoryStore(setOwnerImportState(storeWithBindingSession, ownerId, {
    ...currentOwnerState,
    binding: {
      uid: normalizedUid,
      boundAt: binding?.boundAt ?? importedAt,
      lastImportedAt: importedAt,
    },
    history: historyResult.history,
    undoJournal: null,
  }))

  const changedDriveDiscIds = changedOwnerItems(store.driveDiscs, nextStore.driveDiscs, ownerId)
  const changedLoadoutIds = changedOwnerItems(store.driveDiscLoadouts, nextStore.driveDiscLoadouts, ownerId)
  const referenceSets = [
    configDriveDiscReferences(buildSelection, ownerId, selectedAgentIds),
    configDriveDiscReferences(legacySelection, ownerId, selectedAgentIds),
    configDriveDiscReferences(nextBuildSelection, ownerId, selectedAgentIds),
    configDriveDiscReferences(nextLegacySelection, ownerId, selectedAgentIds),
  ]
  const removedLoadoutDiscReferences = drivePlan.removedLoadoutDiscReferences ?? []
  const affectedDriveDiscIds = [...new Set([
    ...changedDriveDiscIds,
    ...(drivePlan.affectedDriveDiscIds ?? []),
    ...removedLoadoutDiscReferences.map(reference => reference?.driveDiscId),
    ...referenceSets.flatMap(item => item.driveDiscIds),
  ].filter(Boolean).map(String))]
  const affectedLoadoutIds = [...new Set([
    ...changedLoadoutIds,
    ...(drivePlan.affectedLoadoutIds ?? []),
    ...(drivePlan.deletedLoadoutIds ?? []),
    ...removedLoadoutDiscReferences.map(reference => reference?.loadoutId),
    ...referenceSets.flatMap(item => item.loadoutIds),
  ].filter(Boolean).map(String))]
  const affectedAgentIds = [...new Set([
    ...selectedAgentIds,
    ...(drivePlan.affectedAgentIds ?? []),
    ...removedLoadoutDiscReferences.map(reference => reference?.agentId),
  ].filter(Boolean).map(String))]
  const journal = {
    version: 1,
    id: transactionId,
    uid: normalizedUid,
    ownerId,
    status: "prepared",
    createdAt: importedAt,
    affectedAgentIds,
    changedDriveDiscIds,
    changedLoadoutIds,
    affectedDriveDiscIds,
    affectedLoadoutIds,
    baseFingerprint: {
      store: materialStoreFingerprint(store),
      buildSelection: jsonFingerprint(buildSelection),
      legacySelection: jsonFingerprint(legacySelection),
    },
    before: {
      inventory: inventorySnapshot(store, ownerId, affectedDriveDiscIds, affectedLoadoutIds),
      buildConfigs: configsSnapshot(buildSelection, ownerId, affectedAgentIds),
      legacyConfigs: configsSnapshot(legacySelection, ownerId, affectedAgentIds),
    },
    after: {
      inventory: inventorySnapshot(nextStore, ownerId, affectedDriveDiscIds, affectedLoadoutIds),
      buildConfigs: configsSnapshot(nextBuildSelection, ownerId, affectedAgentIds),
      legacyConfigs: configsSnapshot(nextLegacySelection, ownerId, affectedAgentIds),
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
    conflicts: drivePlan.conflicts,
    blockingErrors: [],
    hasBlockingErrors: false,
    hasUnresolvedConflicts: drivePlan.hasUnresolvedConflicts,
    nextStore,
    nextBuildSelection,
    nextLegacySelection,
    journal,
    isNoop: false,
    historyChanges: {
      addedAgentIds: historyResult.addedAgentIds,
      updatedAgentIds: historyResult.updatedAgentIds,
    },
    changeCount: agents.reduce((sum, agent) => sum + agent.changes.length, 0)
      + changedDriveDiscIds.length
      + changedLoadoutIds.length
      + historyResult.changedAgentIds.filter(agentId => !agents.some(agent => agent.agentId === agentId && agent.changed)).length
      + (binding ? 0 : 1),
  }
}

function changedConfigAgentIds(beforeDocument, afterDocument, ownerId) {
  const before = ownerSelection(beforeDocument, ownerId).byAgent ?? {}
  const after = ownerSelection(afterDocument, ownerId).byAgent ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(agentId => !sameValue(before[agentId] ?? null, after[agentId] ?? null))
}

export { enkaRebindEligibility }

export function buildEnkaRebindPlan({
  previousUid,
  uid,
  mappedAgents,
  store,
  ownerId,
  buildSelection,
  legacySelection,
  driveDiscResolutions = {},
  now = new Date(),
  transactionId = `enka-rebind-${now.getTime()}`,
}) {
  const currentBinding = enkaBindingForOwner(store, ownerId)
  const boundUid = String(currentBinding?.uid ?? "").trim()
  const normalizedPreviousUid = String(previousUid ?? boundUid).trim()
  const normalizedUid = String(uid ?? "").trim()
  const blocked = (code, message, details = {}) => ({
    ...blockedImportPlan({
      uid: normalizedUid,
      mappedAgents,
      store,
      ownerId,
      buildSelection,
      legacySelection,
      transactionId,
      blockingErrors: [blockingError(code, message, details)],
    }),
    kind: "enka-rebind",
    previousUid: boundUid || normalizedPreviousUid,
    rebind: null,
  })

  if (!boundUid) return blocked("ENKA_NOT_BOUND", "当前账号尚未绑定游戏 UID，无需执行换绑。")
  if (normalizedPreviousUid !== boundUid) {
    return blocked("ENKA_REBIND_BINDING_CHANGED", "当前账号绑定状态已变化，请重新开始换绑。")
  }
  if (!GAME_UID_PATTERN.test(normalizedUid)) {
    return blocked("INVALID_GAME_UID", "游戏 UID 必须为 8 至 12 位数字。")
  }
  if (normalizedUid === boundUid) {
    return blocked("ENKA_REBIND_SAME_UID", "新 UID 与当前绑定 UID 相同，请直接使用普通导入。")
  }
  if (!Array.isArray(mappedAgents) || !mappedAgents.length) {
    return blocked("ENKA_REBIND_NO_AGENTS", "新 UID 没有可导入的已收录角色，不能执行换绑。")
  }

  const cleanup = buildEnkaBindingCleanup({ store, ownerId, buildSelection, legacySelection, now })
  if (cleanup.blocked) {
    return {
      ...blockedImportPlan({
        uid: normalizedUid,
        mappedAgents,
        store,
        ownerId,
        buildSelection,
        legacySelection,
        transactionId,
        blockingErrors: cleanup.blockingErrors,
      }),
      kind: "enka-rebind",
      previousUid: boundUid,
      rebind: cleanup,
    }
  }

  const imported = buildEnkaImportPlan({
    uid: normalizedUid,
    mappedAgents,
    store: cleanup.store,
    ownerId,
    buildSelection: cleanup.buildSelection,
    legacySelection: cleanup.legacySelection,
    driveDiscResolutions,
    now,
    transactionId,
  })
  if (imported.hasBlockingErrors || imported.hasUnresolvedConflicts || !imported.journal) {
    return {
      ...imported,
      kind: "enka-rebind",
      previousUid: boundUid,
      nextStore: clone(store),
      nextBuildSelection: clone(buildSelection),
      nextLegacySelection: clone(legacySelection),
      journal: null,
      rebind: cleanup,
    }
  }

  const finalStoreWithoutJournal = setOwnerImportState(imported.nextStore, ownerId, {
    ...normalizeEnkaImportState(imported.nextStore).byOwner[ownerId],
    undoJournal: null,
  })
  const changedDriveDiscIds = changedOwnerItems(store.driveDiscs, finalStoreWithoutJournal.driveDiscs, ownerId)
  const changedLoadoutIds = changedOwnerItems(store.driveDiscLoadouts, finalStoreWithoutJournal.driveDiscLoadouts, ownerId)
  const affectedAgentIds = [...new Set([
    ...changedConfigAgentIds(buildSelection, imported.nextBuildSelection, ownerId),
    ...changedConfigAgentIds(legacySelection, imported.nextLegacySelection, ownerId),
    ...(cleanup.affectedAgentIds ?? []),
    ...(cleanup.cleanedReferenceAgentIds ?? []),
    ...(imported.journal.affectedAgentIds ?? []),
  ].map(String))]
  const referenceSets = [
    configDriveDiscReferences(buildSelection, ownerId, affectedAgentIds),
    configDriveDiscReferences(legacySelection, ownerId, affectedAgentIds),
    configDriveDiscReferences(imported.nextBuildSelection, ownerId, affectedAgentIds),
    configDriveDiscReferences(imported.nextLegacySelection, ownerId, affectedAgentIds),
  ]
  const affectedDriveDiscIds = [...new Set([
    ...changedDriveDiscIds,
    ...(cleanup.deletedDriveDiscIds ?? []),
    ...(cleanup.detachedDriveDiscIds ?? []),
    ...(imported.journal.affectedDriveDiscIds ?? []),
    ...referenceSets.flatMap(item => item.driveDiscIds),
  ].filter(Boolean).map(String))]
  const affectedLoadoutIds = [...new Set([
    ...changedLoadoutIds,
    ...(cleanup.deletedLoadoutIds ?? []),
    ...(imported.journal.affectedLoadoutIds ?? []),
    ...referenceSets.flatMap(item => item.loadoutIds),
  ].filter(Boolean).map(String))]
  const importedAt = now.toISOString()
  const journal = {
    version: 1,
    id: transactionId,
    kind: "enka-rebind",
    uid: normalizedUid,
    previousUid: boundUid,
    ownerId,
    status: "prepared",
    createdAt: importedAt,
    affectedAgentIds,
    changedDriveDiscIds,
    changedLoadoutIds,
    affectedDriveDiscIds,
    affectedLoadoutIds,
    baseFingerprint: {
      store: materialStoreFingerprint(store),
      buildSelection: jsonFingerprint(buildSelection),
      legacySelection: jsonFingerprint(legacySelection),
    },
    before: {
      inventory: inventorySnapshot(store, ownerId, affectedDriveDiscIds, affectedLoadoutIds),
      buildConfigs: configsSnapshot(buildSelection, ownerId, affectedAgentIds),
      legacyConfigs: configsSnapshot(legacySelection, ownerId, affectedAgentIds),
    },
    after: {
      inventory: inventorySnapshot(finalStoreWithoutJournal, ownerId, affectedDriveDiscIds, affectedLoadoutIds),
      buildConfigs: configsSnapshot(imported.nextBuildSelection, ownerId, affectedAgentIds),
      legacyConfigs: configsSnapshot(imported.nextLegacySelection, ownerId, affectedAgentIds),
    },
  }
  const nextStore = setOwnerImportState(finalStoreWithoutJournal, ownerId, {
    ...normalizeEnkaImportState(finalStoreWithoutJournal).byOwner[ownerId],
    undoJournal: journal,
  })
  return {
    ...imported,
    kind: "enka-rebind",
    previousUid: boundUid,
    nextStore,
    journal,
    baseFingerprint: clone(journal.baseFingerprint),
    isNoop: false,
    rebind: {
      previousUid: boundUid,
      nextUid: normalizedUid,
      ...clone(cleanup.summary),
      deletedDriveDiscIds: clone(cleanup.deletedDriveDiscIds),
      detachedDriveDiscIds: clone(cleanup.detachedDriveDiscIds),
      deletedLoadoutIds: clone(cleanup.deletedLoadoutIds),
      restoredFields: clone(cleanup.restoredFields),
      preservedFields: clone(cleanup.preservedFields),
      cleanedReferenceAgentIds: clone(cleanup.cleanedReferenceAgentIds),
    },
    changeCount: imported.changeCount
      + changedDriveDiscIds.length
      + changedLoadoutIds.length
      + (cleanup.summary?.restoredConfigFields ?? 0),
  }
}

export function enkaImportBaseMatches({ store, buildSelection, legacySelection, journal }) {
  const expected = journal?.baseFingerprint
  if (!expected) return false
  return expected.store === materialStoreFingerprint(store)
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

function applyConfigSnapshot(document, ownerId, agentIds, snapshot) {
  const selection = ownerSelection(document, ownerId)
  const structured = snapshot?.version === 1 && snapshot?.configs && typeof snapshot.configs === "object"
  const configs = structured ? snapshot.configs : snapshot
  const byAgent = { ...(clone(selection.byAgent ?? {}) ?? {}) }
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

export function enkaImportSnapshotMatches({ store, buildSelection, legacySelection, journal }, phase = "after") {
  const snapshot = journal?.[phase]
  if (!snapshot) return false
  const currentInventory = inventorySnapshot(
    store,
    journal.ownerId,
    journal.affectedDriveDiscIds,
    journal.affectedLoadoutIds,
  )
  if (!Object.prototype.hasOwnProperty.call(snapshot.inventory ?? {}, "history")) {
    delete currentInventory.history
  }
  const materialInventory = inventory => ({
    ...clone(inventory),
    driveDiscs: (inventory?.driveDiscs ?? []).map(materialInventoryItem),
    driveDiscLoadouts: (inventory?.driveDiscLoadouts ?? []).map(materialInventoryItem),
    ...(Object.prototype.hasOwnProperty.call(inventory ?? {}, "history")
      ? { history: materialImportHistory(inventory.history) }
      : {}),
  })
  return sameValue(materialInventory(currentInventory), materialInventory(snapshot.inventory))
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
  const nextOwnerState = { ...ownerState }
  if (snapshot.inventory.binding == null) delete nextOwnerState.binding
  else nextOwnerState.binding = clone(snapshot.inventory.binding)
  if (Object.prototype.hasOwnProperty.call(snapshot.inventory ?? {}, "history")) {
    const restoredHistory = journal.kind === "enka-rebind"
      ? clone(snapshot.inventory.history)
      : historyWithCurrentNonFullRecords(snapshot.inventory.history, ownerState.history)
    if (restoredHistory == null) delete nextOwnerState.history
    else nextOwnerState.history = restoredHistory
  }
  if (Object.prototype.hasOwnProperty.call(snapshot.inventory ?? {}, "bindingSession")) {
    if (snapshot.inventory.bindingSession == null) delete nextOwnerState.bindingSession
    else nextOwnerState.bindingSession = clone(snapshot.inventory.bindingSession)
  }
  nextOwnerState.undoJournal = phase === "after" ? journal : null
  nextStore = setOwnerImportState(nextStore, journal.ownerId, nextOwnerState)
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
