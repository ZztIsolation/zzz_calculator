import { defineStore } from "pinia"
import {
  calculateInCombatPanel,
  calculateOutOfCombatPanel,
} from "@core/calculator-core.js"
import { teammateDriveDiscSetIdsFromBuffIds } from "@/utils/combatBuffs"
import {
  clampWEngineModificationLevel,
  coreSkillDefaultLevel,
  defaultRuntimeForBuff,
  effectRules,
  nameOf,
  normalizeCustomBuffEffect,
  normalizeCustomBuffStat,
  normalizeRuntimeForBuff,
  defaultWEngineIdForAgent,
  sortWEnginesForAgent,
  currentAccountId,
  loadCurrentOwnerSelection,
  saveCurrentOwnerSelection,
} from "@core/shared-combat.js"

export const STORAGE_KEY = "zzz-calculator.webapp.build.v1"
const OLD_HOME_SELECTION_KEY = "zzz-calculator.homeSelection.v1"

export const ELEMENTS = ["physical", "fire", "ice", "electric", "ether", "wind"]
export const SKILL_CATEGORIES = ["basic", "dodge", "assist", "special", "chain"]
export const DISC_MODES = ["manual", "loadout", "optimized"] as const
type DiscMode = typeof DISC_MODES[number]

function readJson(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function numeric(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringRecord(value: any): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [String(key), String(raw ?? "")])
      .filter(([key, raw]) => key && raw),
  )
}

function stringArray(value: any): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : []
}

function normalizeDiscMode(value: unknown): DiscMode {
  return DISC_MODES.includes(value as DiscMode) ? value as DiscMode : "manual"
}

export function defaultTargetConfig() {
  return {
    presetId: "normal-boss",
    defense: 953,
    levelCoefficient: 794,
    stunned: true,
    stunMultiplierPercent: 150,
    resistanceByElement: Object.fromEntries(ELEMENTS.map(element => [element, 0])),
  }
}

function normalizeTargetConfig(value: any = {}) {
  const fallback = defaultTargetConfig()
  const resistanceByElement = { ...fallback.resistanceByElement }
  for (const element of ELEMENTS) {
    resistanceByElement[element] = numeric(value?.resistanceByElement?.[element], resistanceByElement[element])
  }
  return {
    presetId: String(value?.presetId ?? fallback.presetId),
    defense: Math.max(0, numeric(value?.defense, fallback.defense)),
    levelCoefficient: numeric(value?.levelCoefficient, fallback.levelCoefficient),
    stunned: value?.stunned === undefined ? fallback.stunned : Boolean(value.stunned),
    stunMultiplierPercent: Math.max(0, numeric(value?.stunMultiplierPercent, fallback.stunMultiplierPercent)),
    resistanceByElement,
  }
}

function defaultEvent(kind = "direct", id = `${kind}-1`) {
  if (kind === "anomaly") {
    return {
      id,
      kind: "anomaly",
      settlementType: "attribute",
      anomalyEffect: "assault",
      procCount: 1,
      count: 1,
    }
  }
  if (kind === "disorder") {
    return {
      id,
      kind: "disorder",
      disorderType: "normal",
      previousAnomalyEffect: "burn",
      elapsedSeconds: 0,
      count: 1,
    }
  }
  return {
    id,
    kind,
    skillMultiplier: 100,
    critMode: "expected",
    count: 1,
  }
}

export function isRuptureAgent(agent: any = null) {
  return agent?.specialty === "rupture"
}

export function primaryDamageModeForAgent(agent: any = null) {
  return isRuptureAgent(agent) ? "sheer" : "single"
}

export function hasAdminDefaultCalculation(agent: any = null) {
  return Boolean(agent?.defaultCalculationConfig?.events?.length)
}

export function isDamageModeAllowedForAgent(mode: unknown, agent: any = null) {
  const value = String(mode ?? "")
  if (value === "sheer") {
    return isRuptureAgent(agent)
  }
  if (value === "single") {
    return !isRuptureAgent(agent)
  }
  if (value === "adminDefault") {
    return hasAdminDefaultCalculation(agent)
  }
  return ["anomaly", "custom"].includes(value)
}

export function normalizeDamageModeForAgent(mode: unknown, agent: any = null) {
  const value = String(mode ?? "")
  return isDamageModeAllowedForAgent(value, agent) ? value : primaryDamageModeForAgent(agent)
}

function primaryDamageConfigForAgent(agent: any = null) {
  const mode = primaryDamageModeForAgent(agent)
  const kind = mode === "sheer" ? "sheer" : "direct"
  const eventId = `${kind}-1`
  return {
    mode,
    agentLevel: 60,
    skillLevelsByCategory: {},
    selectedEventId: eventId,
    events: [defaultEvent(kind, eventId)],
  }
}

export function defaultDamageConfig(agent: any = null) {
  const config = agent?.defaultCalculationConfig
  if (config?.events?.length) {
    const mode = config.mode ?? "adminDefault"
    if (!isDamageModeAllowedForAgent(mode, agent)) {
      return primaryDamageConfigForAgent(agent)
    }
    return {
      mode,
      agentLevel: 60,
      skillLevelsByCategory: {},
      selectedEventId: config.selectedEventId ?? config.events[0]?.id,
      events: clone(config.events),
    }
  }
  return primaryDamageConfigForAgent(agent)
}

function normalizeDamageEvent(event: any, index = 0) {
  const kind = ["direct", "sheer", "anomaly", "disorder"].includes(event?.kind) ? event.kind : "direct"
  const fallback = defaultEvent(kind, `${kind}-${index + 1}`)
  return {
    ...fallback,
    ...clone(event ?? {}),
    id: String(event?.id ?? fallback.id),
    kind,
    count: Math.max(0, numeric(event?.count, fallback.count ?? 1)),
  }
}

function damageConfigFields(value: any = {}) {
  const cloned = clone(value ?? {})
  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    return {}
  }
  const { target: _target, targetConfig: _targetConfig, ...damage } = cloned
  return damage
}

function normalizeDamageConfig(value: any, agent: any = null) {
  const fallback = defaultDamageConfig(agent)
  const rawMode = value?.mode ?? fallback.mode
  const modeAllowed = isDamageModeAllowedForAgent(rawMode, agent)
  const mode = normalizeDamageModeForAgent(rawMode, agent)
  const eventFallback = modeAllowed ? fallback : primaryDamageConfigForAgent(agent)
  const eventSource = modeAllowed && Array.isArray(value?.events) && value.events.length
    ? value.events
    : eventFallback.events
  const events = Array.isArray(eventSource) && eventSource.length
    ? eventSource.map(normalizeDamageEvent)
    : eventFallback.events.map(normalizeDamageEvent)
  const selectedEventId = events.some((event: any) => event.id === value?.selectedEventId)
    ? String(value.selectedEventId)
    : events[0]?.id
  return {
    ...eventFallback,
    ...damageConfigFields(value),
    mode,
    agentLevel: numeric(value?.agentLevel, fallback.agentLevel),
    skillLevelsByCategory: {
      ...(fallback.skillLevelsByCategory ?? {}),
      ...(value?.skillLevelsByCategory ?? value?.skillLevels ?? {}),
    },
    selectedEventId,
    events,
  }
}

function activeOwnerId() {
  try {
    return String(currentAccountId?.() || "default")
  } catch {
    return "default"
  }
}

function ownerSelectionFromRaw(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  if (value.byOwner && typeof value.byOwner === "object") {
    const ownerId = activeOwnerId()
    const storedOwnerId = String(value.currentOwnerId ?? ownerId)
    return value.byOwner[ownerId] ?? value.byOwner[storedOwnerId] ?? value.byOwner.default ?? null
  }
  if (value.byAgent && typeof value.byAgent === "object") {
    return {
      currentAgentId: value.currentAgentId ?? null,
      byAgent: value.byAgent,
    }
  }
  return null
}

function isOwnerScopedSelection(value: any) {
  return value?.byOwner && typeof value.byOwner === "object"
}

function webappOwnerSelection() {
  const saved = readJson(STORAGE_KEY)
  return isOwnerScopedSelection(saved) ? ownerSelectionFromRaw(saved) : null
}

function webappFallbackSelection() {
  return ownerSelectionFromRaw(readJson(STORAGE_KEY))
}

function legacyOwnerSelection() {
  try {
    return loadCurrentOwnerSelection()
  } catch {
    return ownerSelectionFromRaw(readJson(OLD_HOME_SELECTION_KEY))
  }
}

function savedConfigForAgent(agentId: string) {
  const saved = webappOwnerSelection()
  const legacy = legacyOwnerSelection()
  const fallback = webappFallbackSelection()
  return saved?.byAgent?.[agentId] ?? legacy?.byAgent?.[agentId] ?? fallback?.byAgent?.[agentId] ?? {}
}

function savedCurrentAgentId() {
  const saved = webappOwnerSelection()
  const legacy = legacyOwnerSelection()
  const fallback = webappFallbackSelection()
  return saved?.currentAgentId ?? legacy?.currentAgentId ?? fallback?.currentAgentId ?? ""
}

export function defaultBuffIdsFor(agent: any, cinemaLevel: number, wEngine: any) {
  const ids: string[] = []
  if (agent?.combatBuffs?.corePassive?.scope === "inCombat") {
    ids.push(`agent:${agent.id}.corePassive`)
  }
  if (agent?.combatBuffs?.additionalAbility?.scope === "inCombat") {
    ids.push(`agent:${agent.id}.additionalAbility`)
  }
  for (const buff of agent?.combatBuffs?.cinemaBuffs ?? []) {
    if (buff?.scope === "inCombat" && Number(cinemaLevel) >= Number(buff?.cinemaLevel ?? 99)) {
      ids.push(`agent:${agent.id}.cinema.${buff.cinemaLevel}`)
    }
  }
  const wEngineSelfBuff = wEngine?.effect?.selfBuff ?? wEngine?.selfBuff ?? wEngine?.effect?.buff ?? wEngine?.passive
  const wEngineTeamBuff = wEngine?.effect?.teamBuff ?? wEngine?.teamBuff
  if (wEngineSelfBuff?.scope === "inCombat") {
    ids.push(`wEngine:${wEngine.id}.self`)
  }
  if (wEngineTeamBuff?.scope === "inCombat") {
    ids.push(`wEngine:${wEngine.id}.team`)
  }
  return ids
}

function defaultSkillLevels() {
  return Object.fromEntries(SKILL_CATEGORIES.map(category => [category, 12]))
}

function normalizeStoredMode(mode: any) {
  return mode === "percent" ? "pct" : mode ?? "flat"
}

function customAddedBuffs(addedBuffs: any[] = []) {
  return (Array.isArray(addedBuffs) ? addedBuffs : []).filter(item => item?.sourceKind === "custom")
}

function customManualStats(addedBuffs: any[] = [], meta: any = null) {
  return customAddedBuffs(addedBuffs).flatMap(item =>
    (item.stats ?? [])
      .map((stat: any, index: number) => normalizeCustomBuffStat({
        ...stat,
        id: stat?.id ?? `${item.id}.${index + 1}`,
        label: stat?.label ?? item.label,
        mode: normalizeStoredMode(stat?.mode),
      }, meta))
      .filter(Boolean),
  )
}

function customManualEffects(addedBuffs: any[] = []) {
  return customAddedBuffs(addedBuffs).flatMap(item =>
    (item.effects ?? [])
      .map((effect: any, index: number) => normalizeCustomBuffEffect({
        ...effect,
        id: effect?.id ?? `${item.id}.${index + 1}`,
        mode: normalizeStoredMode(effect?.mode),
      }))
      .filter(Boolean)
      .map((effect: any, index: number) => ({
        id: `${item.id}.${index + 1}`,
        label: `${nameOf(item) || item.label || "自定义 Buff"}｜${effect.label ?? effect.stat ?? effect.kind ?? "效果"}`,
        effects: [effect],
      })),
  )
}

function addedBuffRuntimeInputs(addedBuffs: any[] = []) {
  const entries: Array<[string, any]> = []
  for (const item of Array.isArray(addedBuffs) ? addedBuffs : []) {
    if (item?.runtime && typeof item.runtime === "object" && !Array.isArray(item.runtime)) {
      if (item.sourceKind === "teammateDriveDisc4pc" && item.setId) {
        entries.push([`teammateDriveDisc4pc:${item.setId}`, clone(item.runtime)])
      } else if (item.id) {
        entries.push([String(item.id), clone(item.runtime)])
      }
    }
  }
  return Object.fromEntries(entries)
}

function wEngineTeamModificationLevelsFromAddedBuffs(addedBuffs: any[] = []) {
  return Object.fromEntries(
    (Array.isArray(addedBuffs) ? addedBuffs : [])
      .filter(item => item?.sourceKind === "wEngineTeam" && item?.id)
      .map(item => [String(item.id), numeric(item.wEngineModificationLevel, 1)]),
  )
}

function driveDiscSetById(catalog: any, setId: string) {
  if (!setId) {
    return null
  }
  const map = catalog?.driveDiscSetsMap
  if (map && typeof map.get === "function") {
    return map.get(setId) ?? null
  }
  return (catalog?.driveDiscSets ?? []).find((set: any) => set?.id === setId) ?? null
}

function legacyDriveDiscFourPieceBuff(fourPiece: any) {
  if (!fourPiece || fourPiece.selfBuff || !effectRules(fourPiece).length) {
    return null
  }
  return {
    scope: "inCombat",
    condition: fourPiece.condition ?? null,
    durationSeconds: fourPiece.durationSeconds ?? null,
    cooldownSeconds: fourPiece.cooldownSeconds ?? null,
    appliesToOutOfCombatPanel: false,
    ...(fourPiece.coverage ? { coverage: fourPiece.coverage } : {}),
    effects: effectRules(fourPiece),
  }
}

function driveDiscFourPieceSelfBuff(set: any) {
  const fourPiece = set?.fourPiece
  const buff = fourPiece?.selfBuff ?? legacyDriveDiscFourPieceBuff(fourPiece)
  return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

function driveDiscFourPieceTeamBuff(set: any) {
  const buff = set?.fourPiece?.teamBuff ?? null
  return effectRules(buff).length ? { ...buff, scope: "inCombat" } : null
}

export function activeDriveDisc4pcBuffIds(catalog: any, driveDiscs: any[] = []) {
  const counts = new Map<string, number>()
  for (const disc of driveDiscs ?? []) {
    const setId = String(disc?.setId ?? "")
    if (setId) {
      counts.set(setId, (counts.get(setId) ?? 0) + 1)
    }
  }
  const ids: string[] = []
  for (const [setId, count] of counts.entries()) {
    if (count < 4) {
      continue
    }
    const set = driveDiscSetById(catalog, setId)
    if (driveDiscFourPieceSelfBuff(set)) {
      ids.push(`driveDisc4pc:${setId}.self`)
    }
    if (driveDiscFourPieceTeamBuff(set)) {
      ids.push(`driveDisc4pc:${setId}.team`)
    }
  }
  return ids
}

export const useBuildStore = defineStore("build", {
  state: () => ({
    agentId: "",
    agentLevel: 60,
    coreSkillLevel: "none" as string | number,
    cinemaLevel: 0,
    skillLevels: defaultSkillLevels() as Record<string, any>,
    wEngineId: "",
    wEngineLevel: 60,
    wEngineModificationLevel: 1,
    selectedBuffIds: [] as string[],
    addedBuffs: [] as any[],
    runtimeInputs: {} as Record<string, any>,
    manuallyUncheckedDefaultBuffIds: [] as string[],
    targetConfig: defaultTargetConfig() as any,
    damageConfig: defaultDamageConfig() as any,
    discMode: "manual" as DiscMode,
    manualDriveDiscIdsBySlot: {} as Record<string, string>,
    selectedLoadoutId: "",
    selectedOptimizedRank: 0,
    result: null as any,
    outOfCombat: null as any,
    error: "",
  }),
  getters: {
    title(state) {
      return state.agentId || "未选择角色"
    },
  },
  actions: {
    initialize(catalog: any, meta: any) {
      const agents = meta?.agents ?? []
      const wEngines = meta?.wEngines ?? []
      const initialAgentId = savedCurrentAgentId() || agents[0]?.id || ""
      const agent = agents.find((item: any) => item.id === initialAgentId) ?? agents[0]
      if (!agent) {
        return
      }
      this.applyAgentConfig(agent.id, meta, savedConfigForAgent(agent.id))
    },
    applyAgentConfig(agentId: string, meta: any, config: any = {}) {
      const agent = meta?.agents?.find((item: any) => item.id === agentId)
      if (!agent) {
        return
      }
      const wEngineId = defaultWEngineIdForAgent(meta?.wEngines ?? [], agentId, config.wEngineId)
      const wEngine = meta?.wEngines?.find((item: any) => item.id === wEngineId)
      const combat = config.combat ?? {}

      this.agentId = agent.id
      this.agentLevel = numeric(config.agentLevel, 60)
      this.coreSkillLevel = config.coreSkillLevel ?? coreSkillDefaultLevel(agent)
      this.cinemaLevel = numeric(config.cinemaLevel, 0)
      this.skillLevels = {
        ...defaultSkillLevels(),
        ...(config.skillLevels ?? config.skillLevelsByCategory ?? config.damage?.skillLevelsByCategory ?? {}),
      }
      this.wEngineId = wEngineId
      this.wEngineLevel = numeric(config.wEngineLevel, 60)
      this.wEngineModificationLevel = clampWEngineModificationLevel(config.wEngineModificationLevel ?? 1, wEngine)
      this.selectedBuffIds = stringArray(combat.activeBuffIds ?? config.selectedBuffIds)
      this.addedBuffs = Array.isArray(combat.addedBuffs ?? config.addedBuffs) ? clone(combat.addedBuffs ?? config.addedBuffs) : []
      this.runtimeInputs = combat.runtimeInputs ?? config.runtimeInputs ?? {}
      this.manuallyUncheckedDefaultBuffIds = stringArray(combat.manuallyUncheckedDefaultBuffIds)
      const rawDamageConfig = config.damage ?? config.damageConfig
      this.damageConfig = normalizeDamageConfig(rawDamageConfig, agent)
      this.targetConfig = normalizeTargetConfig(config.targetConfig ?? rawDamageConfig?.target ?? rawDamageConfig?.targetConfig)
      this.discMode = normalizeDiscMode(config.discMode ?? config.driveDiscMode ?? config.mode)
      this.manualDriveDiscIdsBySlot = stringRecord(
        config.manualDriveDiscIdsBySlot
          ?? config.manualDriveDiscsBySlot
          ?? config.driveDiscIdsBySlot,
      )
      this.selectedLoadoutId = String(config.selectedLoadoutId ?? config.loadoutId ?? "")
      this.selectedOptimizedRank = numeric(config.selectedOptimizedRank, 0)
    },
    wEnginesForAgent(meta: any) {
      const agent = meta?.agents?.find((item: any) => item.id === this.agentId)
      return sortWEnginesForAgent(meta?.wEngines ?? [], agent)
    },
    selectAgent(agentId: string, meta: any) {
      this.applyAgentConfig(agentId, meta, savedConfigForAgent(agentId))
      this.persist()
    },
    selectWEngine(id: string, meta: any) {
      const wEngine = meta?.wEngines?.find((item: any) => item.id === id)
      if (!wEngine) {
        return
      }
      this.wEngineId = id
      this.wEngineModificationLevel = clampWEngineModificationLevel(this.wEngineModificationLevel, wEngine)
      this.persist()
    },
    updateSkillLevel(categoryId: string, level: any) {
      this.skillLevels = {
        ...this.skillLevels,
        [categoryId]: level,
      }
      this.damageConfig = {
        ...this.damageConfig,
        skillLevelsByCategory: {
          ...(this.damageConfig.skillLevelsByCategory ?? {}),
          [categoryId]: level,
        },
      }
      this.persist()
    },
    setDamageConfig(config: any, agent: any = null) {
      const hasTargetConfig = Object.prototype.hasOwnProperty.call(config ?? {}, "target")
        || Object.prototype.hasOwnProperty.call(config ?? {}, "targetConfig")
      if (hasTargetConfig) {
        this.targetConfig = normalizeTargetConfig(config.target ?? config.targetConfig)
      }
      this.damageConfig = normalizeDamageConfig(config, agent)
      this.persist()
    },
    setTargetConfig(target: any) {
      this.targetConfig = normalizeTargetConfig(target)
      this.persist()
    },
    upsertDamageEvent(event: any) {
      const next = normalizeDamageEvent(event)
      const events = [...(this.damageConfig.events ?? [])]
      const index = events.findIndex((item: any) => item.id === next.id)
      if (index >= 0) {
        events[index] = next
      } else {
        events.push(next)
      }
      this.setDamageConfig({
        ...this.damageConfig,
        selectedEventId: next.id,
        events,
      })
    },
    removeDamageEvent(id: string) {
      const events = (this.damageConfig.events ?? []).filter((event: any) => event.id !== id)
      this.setDamageConfig({
        ...this.damageConfig,
        selectedEventId: events[0]?.id,
        events: events.length ? events : [defaultEvent("direct", "direct-1")],
      })
    },
    applyBuffState(payload: any, meta: any) {
      const selectedIds = stringArray(payload?.selectedBuffIds ?? payload?.activeBuffIds)
      const addedBuffs = Array.isArray(payload?.addedBuffs) ? clone(payload.addedBuffs) : this.addedBuffs
      const runtimeInputs = payload?.runtimeInputs && typeof payload.runtimeInputs === "object"
        ? payload.runtimeInputs
        : this.runtimeInputs
      const defaultIds = this.defaultBuffIds(meta)
      this.selectedBuffIds = selectedIds.filter(id => !defaultIds.includes(id))
      this.addedBuffs = addedBuffs
      this.runtimeInputs = runtimeInputs
      this.manuallyUncheckedDefaultBuffIds = defaultIds.filter(id => !selectedIds.includes(id))
      this.persist()
    },
    defaultBuffIds(meta: any) {
      const agent = meta?.agents?.find((item: any) => item.id === this.agentId)
      const wEngine = meta?.wEngines?.find((item: any) => item.id === this.wEngineId)
      return defaultBuffIdsFor(agent, this.cinemaLevel, wEngine)
    },
    activeBuffIds(meta: any, catalog: any = null, driveDiscs: any[] = []) {
      const unchecked = new Set(this.manuallyUncheckedDefaultBuffIds)
      const defaults = this.defaultBuffIds(meta).filter(id => !unchecked.has(id))
      const driveDiscBuffIds = catalog ? activeDriveDisc4pcBuffIds(catalog, driveDiscs) : []
      return [...new Set([...defaults, ...this.selectedBuffIds, ...driveDiscBuffIds])]
    },
    setDiscMode(mode: DiscMode) {
      this.discMode = normalizeDiscMode(mode)
      this.persist()
    },
    setManualDriveDisc(slot: number | string, id: string) {
      const key = String(Number(slot))
      const next = { ...this.manualDriveDiscIdsBySlot }
      if (id) {
        next[key] = id
      } else {
        delete next[key]
      }
      this.manualDriveDiscIdsBySlot = next
      this.discMode = "manual"
      this.persist()
    },
    selectLoadout(id: string) {
      this.selectedLoadoutId = id
      this.discMode = id ? "loadout" : this.discMode
      this.persist()
    },
    selectOptimizedRank(rank: number) {
      this.selectedOptimizedRank = rank
      this.discMode = "optimized"
      this.persist()
    },
    buildInput(catalog: any, meta: any, driveDiscs: any[], options: { runtimeInputs?: Record<string, any> } = {}) {
      const agent = meta?.agents?.find((item: any) => item.id === this.agentId)
      const wEngine = meta?.wEngines?.find((item: any) => item.id === this.wEngineId)
      const runtimeDefaults = Object.fromEntries([
        ...(meta?.combatBuffs ?? []),
        ...this.addedBuffs,
      ].map((buff: any) => [buff.id, defaultRuntimeForBuff(buff)]))
      const normalizedRuntimeInputs = {
        ...runtimeDefaults,
        ...addedBuffRuntimeInputs(this.addedBuffs),
        ...this.runtimeInputs,
        ...(options.runtimeInputs ?? {}),
      }
      for (const buff of [...(meta?.combatBuffs ?? []), ...this.addedBuffs]) {
        if (buff?.id) {
          normalizedRuntimeInputs[buff.id] = normalizeRuntimeForBuff(buff, normalizedRuntimeInputs[buff.id])
        }
      }
      const untouchedFallbackDamage = this.damageConfig?.mode === "single"
        && this.damageConfig?.selectedEventId === "direct-1"
        && this.damageConfig?.events?.length === 1
        && this.damageConfig?.events?.[0]?.id === "direct-1"
        && agent?.defaultCalculationConfig?.events?.length
      const sourceDamageConfig = untouchedFallbackDamage ? defaultDamageConfig(agent) : this.damageConfig
      const damage = normalizeDamageConfig({
        ...sourceDamageConfig,
        agentLevel: this.agentLevel,
        skillLevelsByCategory: {
          ...this.skillLevels,
          ...(sourceDamageConfig.skillLevelsByCategory ?? {}),
        },
      }, agent)
      const activeBuffIds = this.activeBuffIds(meta, catalog, driveDiscs)
      return {
        agentId: this.agentId,
        agentLevel: this.agentLevel,
        coreSkillLevel: this.coreSkillLevel,
        wEngineId: this.wEngineId,
        wEngineLevel: this.wEngineLevel,
        wEngineModificationLevel: this.wEngineModificationLevel,
        driveDiscs,
        combatBuffs: {
          activeBuffIds,
          teammateDriveDiscSetIds: teammateDriveDiscSetIdsFromBuffIds(activeBuffIds),
          manualStats: customManualStats(this.addedBuffs, meta),
          manualEffects: customManualEffects(this.addedBuffs),
          runtimeInputs: normalizedRuntimeInputs,
          wEngineTeamModificationLevels: wEngineTeamModificationLevelsFromAddedBuffs(this.addedBuffs),
        },
        damage: {
          ...damage,
          target: clone(this.targetConfig),
        },
        label: `${nameOf(agent)} / ${nameOf(wEngine)}`,
      }
    },
    calculate(catalog: any, meta: any, driveDiscs: any[], options: { runtimeInputs?: Record<string, any> } = {}) {
      if (!catalog || !meta || !this.agentId || !this.wEngineId) {
        return
      }
      try {
        const input = this.buildInput(catalog, meta, driveDiscs, options)
        this.outOfCombat = calculateOutOfCombatPanel(catalog, input)
        this.result = calculateInCombatPanel(catalog, input)
        this.error = ""
        this.persist()
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      }
    },
    persist() {
      if (!this.agentId) {
        return
      }
      const webappSaved = readJson(STORAGE_KEY) ?? {}
      const ownerId = activeOwnerId()
      const ownerSelection = ownerSelectionFromRaw(webappSaved) ?? { currentAgentId: null, byAgent: {} }
      const webappByOwner = isOwnerScopedSelection(webappSaved) ? { ...(webappSaved.byOwner ?? {}) } : {}
      const webappByAgent = { ...(ownerSelection.byAgent ?? {}) }
      const persistedConfig = {
        ...(webappByAgent[this.agentId] ?? {}),
        agentLevel: this.agentLevel,
        coreSkillLevel: this.coreSkillLevel,
        cinemaLevel: this.cinemaLevel,
        skillLevels: this.skillLevels,
        wEngineId: this.wEngineId,
        wEngineLevel: this.wEngineLevel,
        wEngineModificationLevel: this.wEngineModificationLevel,
        selectedLoadoutId: this.selectedLoadoutId,
        selectedOptimizedRank: this.selectedOptimizedRank,
        discMode: this.discMode,
        manualDriveDiscIdsBySlot: this.manualDriveDiscIdsBySlot,
        targetConfig: this.targetConfig,
        damage: {
          ...damageConfigFields(this.damageConfig),
          skillLevelsByCategory: {
            ...this.skillLevels,
            ...(this.damageConfig.skillLevelsByCategory ?? {}),
          },
        },
        combat: {
          activeBuffIds: this.selectedBuffIds,
          addedBuffs: this.addedBuffs,
          runtimeInputs: this.runtimeInputs,
          manuallyUncheckedDefaultBuffIds: this.manuallyUncheckedDefaultBuffIds,
        },
      }
      webappByAgent[this.agentId] = persistedConfig
      webappByOwner[ownerId] = {
        currentAgentId: this.agentId,
        byAgent: webappByAgent,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        currentOwnerId: ownerId,
        byOwner: webappByOwner,
      }))

      const legacySelection = legacyOwnerSelection()
      const legacyByAgent = { ...(legacySelection?.byAgent ?? {}) }
      legacyByAgent[this.agentId] = {
        ...(legacyByAgent[this.agentId] ?? {}),
        ...persistedConfig,
        damage: {
          ...(persistedConfig.damage ?? {}),
          target: clone(this.targetConfig),
        },
      }
      saveCurrentOwnerSelection({
        currentAgentId: this.agentId,
        byAgent: legacyByAgent,
      }, ownerId)
    },
  },
})
