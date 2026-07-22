declare module "@runtime/catalog-loader.js" {
  export function loadCatalog(): Promise<any>
  export function loadMeta(): Promise<any>
}

declare module "@core/calculator-core.js" {
  export function buildMeta(catalog: any): any
  export function normalizeCatalog(catalog: any): any
  export function calculateOutOfCombatPanel(catalog: any, input: any): any
  export function calculateInCombatPanel(catalog: any, input: any): any
  export function damageModifierAppliesTo(modifier?: any, event?: any): boolean
}

declare module "@core/damageEventMultipliers.js" {
  export function disorderElapsedStepSeconds(event?: any, catalog?: any): number
  export function normalizeElapsedSeconds(value: unknown, durationSeconds?: number, stepSeconds?: number): number
  export function normalizeDamageScale(event?: any): number
  export function disorderBaseMultiplier(effect?: any, elapsedSeconds?: unknown, durationBonusSeconds?: unknown): { baseDuration: number, durationBonus: number, duration: number, elapsed: number, remaining: number, tickIntervalSeconds: number, tickCount: number, baseMultiplier: number }
  export function disorderMultiplierScale(type?: unknown): number
  export function resolveDamageEventMultiplier(event?: any, catalog?: any): number | null
  export function disorderDurationSeconds(event?: any, catalog?: any, durationBonusSeconds?: unknown): number
}

declare module "@core/calculationSkillGroups.js" {
  export function calculationSkillGroups(source?: any): any[]
  export function hasCalculationSkillGroups(source?: any): boolean
  export function skillGroupById(source?: any, groupId?: string): any
  export function skillGroupCountLimits(group?: any): { min: number, max: number | null, step: number }
  export function normalizeSkillGroupCounts(source?: any, inputCounts?: Record<string, any>): Record<string, number>
  export function isSkillGroupReferenceEvent(event?: any): boolean
  export function normalizeSkillGroupReferenceEvent(event?: any, source?: any, index?: number, options?: any): any
  export function defaultSkillGroupReferenceEvent(source?: any, groupId?: string, index?: number): any
  export function normalizeCalculationEventsWithSkillGroups(events?: any[], source?: any, options?: any): any[]
  export function expandCalculationEvents(events?: any[], source?: any, options?: any): any
  export function expandCalculationConfigSkillGroups(config?: any, source?: any, options?: any): any
  export function expandCalculationSkillGroups(config?: any, options?: any): any
}

declare module "@core/defaultCalculationConfig.js" {
  export function isDefaultCalculationCinemaLevel(value: any): boolean
  export function normalizeDefaultCalculationCinemaLevel(value: any, fallback?: number): number
  export function defaultCalculationVariantName(cinemaLevel?: number): { zhCN: string }
  export function withDefaultCalculationVariantName(config?: any): any
  export function defaultCalculationConfigEntries(config?: any): any[]
  export function resolveDefaultCalculationConfig(config?: any, cinemaLevel?: number): any
}

declare module "@core/driveDiscOptimizer-core.js" {
  export function previewDriveDiscOptimization(catalog: any, store: any, input?: any, options?: any): any
  export function optimizeDriveDiscsAsync(catalog: any, store: any, input?: any, options?: any): Promise<any>
  export function createDriveDiscOptimizerRuntime(runtime?: any): {
    createJob(catalog: any, store: any, input?: any, options?: any): {
      preview(): any
      run(options?: any): Promise<any>
    }
    optimizeDriveDiscsAsync(catalog: any, store: any, input?: any, options?: any): Promise<any>
  }
}

declare module "@runtime/local-store.js" {
  export function clearAllBrowserData(): Promise<void>
  export function driveDiscContentFingerprint(disc: any): string
  export function driveDiscIdentityFingerprint(disc: any): string
  export function ownerScopedStore(store: any, ownerId?: string): any
  export function accountSummary(): Promise<any>
  export function createAccount(account?: any): Promise<any>
  export function updateAccount(id: string, patch?: any): Promise<any>
  export function switchAccount(id: string): Promise<any>
  export function deleteAccount(id: string): Promise<any>
  export function loadCurrentUserDriveDiscStore(): Promise<any>
  export function loadUserDriveDiscStore(): Promise<any>
  export function exportCurrentUserDriveDiscs(options?: { ownerId?: string; exportedAt?: string }): Promise<any>
  export function saveUserDriveDiscStore(store: any): Promise<any>
  export function clearUserDriveDiscStore(ownerId?: string | null): Promise<any>
  export function previewScannerExportImport(input: any, options?: any): Promise<any>
  export function importScannerExportToStore(input: any, options?: any): Promise<any>
  export function upsertUserDriveDisc(driveDisc: any): Promise<any>
  export function deleteUserDriveDisc(id: string): Promise<any>
  export function setDriveDiscReservations(input: { ownerId?: string; discIds: string[]; reservedForAgentId: string | null; allowTransfer?: boolean }): Promise<any>
  export function upsertDriveDiscLoadout(loadout: any, options?: { reserveDiscs?: boolean; allowTransfer?: boolean }): Promise<any>
  export function deleteDriveDiscLoadout(id: string): Promise<any>
}

declare module "@core/shared-combat.js" {
  export const ANOMALY_EFFECT_LABELS: Record<string, string>
  export const DISORDER_EFFECT_LABELS: Record<string, string>
  export const CUSTOM_BUFF_SKILL_STAT_OPTIONS: Array<[string, string, string, string | null]>
  export const CUSTOM_BUFF_STAT_OPTIONS: Array<[string, string, string, string | null]>
  export const RES_IGNORE_STAT_BY_ELEMENT: Record<string, string>
  export function nameOf(item: any): string
  export function localizedText(value: any): string
  export function compareGameVersions(left: string, right: string): number
  export function fieldBuffPeriod(buff?: any): { modeId: string, gameVersion: string, phaseNo: number, phaseName: any }
  export function fieldBuffPeriodKey(buff?: any): string
  export function fieldBuffPhaseLabel(buff?: any): string
  export function fieldBuffPeriodLabel(buff?: any): string
  export function combatBuffDisplayName(buff: any): string
  export function damageElementForAgent(agent?: any): string
  export function damageElementShortLabel(element?: string): string
  export function enumLabel(type: string, value: any): string
  export function rarityLabel(value: any): string
  export function statLabel(key: string, meta?: any): string
  export function storedStatLabel(key: string, mode?: string, meta?: any): string
  export function formatStoredStatValue(stat: string, value: number, options?: any): string
  export function defaultWEngineIdForAgent(wEngines: any[], agentId: string, savedWEngineId?: string): string
  export function sortWEnginesForAgent(wEngines: any[], agent?: any): any[]
  export function materializeWEngineForModificationLevel(wEngine: any, value: unknown): any
  export function coreSkillDefaultLevel(agent: any): string
  export function coreSkillSummary(agent: any, selectedLevel: string, meta?: any): string
  export function clampWEngineModificationLevel(value: unknown, wEngine?: any): number
  export function defaultRuntimeForBuff(buff?: any): any
  export function normalizeCustomBuffEffect(effect?: any): any
  export function normalizeCustomBuffStat(stat?: any, meta?: any): any
  export function normalizeRuntimeForBuff(buff?: any, runtime?: any): any
  export function effectRules(effect?: any): any[]
  export function effectRuleId(rule?: any): string
  export function effectRuleCoverage(rule?: any, effect?: any): any
  export function defaultCoverageForEffectRule(rule?: any, effect?: any): number
  export function runtimeCoverageForEffectRule(rule?: any, effect?: any, runtime?: any): number
  export function runtimeSourceGroups(effect?: any): any[]
  export function runtimeStackGroups(effect?: any): any[]
  export function storedBuffModifierTexts(effect: any): string[]
  export function storedEffectRuleText(rule: any, runtime?: any, effect?: any, meta?: any): string
  export function storedEffectRulesText(effect: any, runtime?: any, meta?: any): string
}

declare module "@core/skillTargets.js" {
  export const SKILL_TYPES: readonly string[]
  export const SKILL_TYPE_LABELS: Readonly<Record<string, string>>
  export const SKILL_TYPE_VALUES: Set<string>
  export const SKILL_TAGS: readonly string[]
  export const SKILL_TAG_LABELS: Readonly<Record<string, string>>
  export const SKILL_TAG_VALUES: Set<string>
  export function skillTypeLabel(value?: any): string
  export function skillTagLabel(value?: any): string
  export function skillTagsForMove(move?: any): string[]
  export function skillTypeForMove(category?: any, move?: any): string
  export function legacySkillTypeForMove(category?: any, move?: any): string
  export function skillTypeForSource(source?: any): string
  export function skillTagsForSource(source?: any): string[]
  export function normalizeSkillTarget(target?: any): any[]
  export function normalizeSkillTargets(targets?: any[]): any[]
  export function normalizeSkillTargetsInValue<T>(value: T): T
  export function unknownLegacySkillTargetPrefixes(target?: any): string[]
  export function skillTargetMatches(target?: any, source?: any): boolean
}

declare module "@core/effectRuleTargets.js" {
  export const DAMAGE_ELEMENTS: readonly string[]
  export const ELEMENT_CRIT_DMG_STAT_BY_ELEMENT: Readonly<Record<string, string>>
  export const ELEMENT_DEF_IGNORE_STAT_BY_ELEMENT: Readonly<Record<string, string>>
  export const ELEMENT_CRIT_DMG_STATS: readonly string[]
  export const ELEMENT_DEF_IGNORE_STATS: readonly string[]
  export function normalizeLegacyEffectAppliesToInValue<T>(value: T): T
  export function hasLegacyEffectAppliesTo(value: any): boolean
}

declare module "@runtime/selection-storage.js" {
  export function currentAccountId(): string
  export function loadCurrentOwnerSelection(ownerId?: string): any
  export function saveCurrentOwnerSelection(selection: any, ownerId?: string): void
  export function setCurrentAccountId(ownerId: string): void
  export function deleteOwnerSelection(ownerId: string): void
}

declare module "@core/maintenanceValidation.js" {
  export const SYSTEM_MANAGED_SKILL_GROUP_COUNTS: Readonly<{ defaultCount: 1, minCount: 0, maxCount: 100, step: 1 }>
  export const SYSTEM_MANAGED_COVERAGE: Readonly<{ default: 1, min: 0, max: 1, step: 0.1 }>
  export function createSystemManagedCoverage(defaultValue?: number): { default: number, min: 0, max: 1, step: 0.1 }
  export function applySystemManagedMaintenanceFields<T>(value: T): T
  export const FIELD_BUFF_MODE_OPTIONS: Array<{ modeId: string, label: string, selectLabel?: { zhCN?: string }, source: { zhCN: string, en?: string } }>
  export const FIELD_BUFF_GAME_VERSIONS: string[]
  export const FIELD_BUFF_PHASE_OPTIONS: Array<{ phaseNo: number, phaseName: { zhCN: string } }>
  export function fieldBuffModeOption(modeId?: any): { modeId: string, label: string, selectLabel?: { zhCN?: string }, source: { zhCN: string, en?: string } } | null
  export function fieldBuffPhaseName(phaseNo?: any): { zhCN: string } | null
  export function validateMaintenanceItem(kind: string, item: any, context?: any): { ok: boolean, errors: string[] }
}

declare module "@core/drive-disc-core.js" {
  export function toCalculatorDriveDisc(inventoryDisc?: any): any
}

declare module "@core/inventory-model.js" {
  export function driveDiscContentFingerprint(disc: any, options?: any): string
  export function driveDiscIdentityFingerprint(disc: any, options?: any): string
  export function normalizeInventoryStore(store?: any, options?: any): any
  export function ownerScopedStore(store: any, ownerId?: string, options?: any): any
  export function buildScannerImportPlan(store: any, input: any, options?: any): any
  export function clearOwnerInventory(store: any, ownerId?: string | null): any
  export function upsertDriveDisc(store: any, driveDisc: any, options?: any): any
  export function setDriveDiscReservations(store: any, input: { ownerId?: string; discIds: string[]; reservedForAgentId: string | null; allowTransfer?: boolean }): any
  export function driveDiscReservationStateForLoadout(store: any, loadout: any): any
  export function deleteDriveDisc(store: any, id: string): any
  export function upsertDriveDiscLoadout(store: any, loadout: any, options?: { reserveDiscs?: boolean; allowTransfer?: boolean }): any
  export function deleteDriveDiscLoadout(store: any, id: string): any
  export function accountSummary(store: any): any
  export function createAccount(store: any, account?: any): any
  export function updateAccount(store: any, id: string, patch?: any): any
  export function switchAccount(store: any, id: string): any
  export function deleteAccount(store: any, id: string): any
}

declare module "@core/driveDiscAnalysis-core.js" {
  export function analyzeDriveDiscSubstats(catalog: any, input?: any): any
  export function analyzeDriveDiscStatGains(catalog: any, input?: any): any
  export function analyzeDriveDiscStatDiffs(catalog: any, input?: any): any
}

declare module "@runtime/scanner-bridge.js" {
  export class ScannerBridge {
    onHelperUpdateProgress: ((progress: any) => void) | null
    onProgress: ((payload: any) => void) | null
    onLauncherProgress: ((payload: any) => void) | null
    onScannerReady: ((payload: any) => void) | null
    onItem: ((payload: any) => void) | null
    onComplete: ((payload: any) => void) | null
    onError: ((payload: any) => void) | null
    onDiagnostics: ((payload: any) => void) | null
    onHeartbeat: ((payload: any) => void) | null
    onStopAck: ((payload: any) => void) | null
    onDisconnect: ((failure?: any) => void) | null
    readonly connected: boolean
    readonly scanning: boolean
    readonly mode: string
    readonly helperVersion: string
    readonly protocolVersion: number
    readonly scannerInfo: any
    readonly scannerVersion: string
    readonly helperUpdate: any
    connect(): Promise<any>
    launchHelper(): void
    getStorageInfo(): Promise<any>
    cleanupStorage(): Promise<any>
    updateHelper(): Promise<any>
    getDiagnostics(): Promise<any>
    confirmHelperUpdate(transactionId: string): Promise<any>
    ensureScanner(): Promise<any>
    repairScanner(): Promise<any>
    restartScannerElevated(): Promise<any>
    openLogFolder(): void
    requestDiagnostics(): void
    disconnect(): void
    startScan(options?: any): void
    stopScan(): void
  }
}
