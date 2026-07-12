declare module "@runtime/catalog-loader.js" {
  export function loadCatalog(): Promise<any>
  export function loadMeta(): Promise<any>
}

declare module "@core/calculator-core.js" {
  export function buildMeta(catalog: any): any
  export function normalizeCatalog(catalog: any): any
  export function calculateOutOfCombatPanel(catalog: any, input: any): any
  export function calculateInCombatPanel(catalog: any, input: any): any
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
    optimizeDriveDiscsAsync(catalog: any, store: any, input?: any, options?: any): Promise<any>
  }
}

declare module "@runtime/local-store.js" {
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
  export function saveUserDriveDiscStore(store: any): Promise<any>
  export function clearUserDriveDiscStore(ownerId?: string | null): Promise<any>
  export function previewScannerExportImport(input: any, options?: any): Promise<any>
  export function importScannerExportToStore(input: any, options?: any): Promise<any>
  export function upsertUserDriveDisc(driveDisc: any): Promise<any>
  export function deleteUserDriveDisc(id: string): Promise<any>
  export function upsertDriveDiscLoadout(loadout: any): Promise<any>
  export function deleteDriveDiscLoadout(id: string): Promise<any>
}

declare module "@core/shared-combat.js" {
  export const ANOMALY_EFFECT_LABELS: Record<string, string>
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
  export function runtimeSourceGroups(effect?: any): any[]
  export function runtimeStackGroups(effect?: any): any[]
  export function storedBuffModifierTexts(effect: any): string[]
  export function storedEffectRulesText(effect: any, runtime?: any, meta?: any): string
}

declare module "@runtime/selection-storage.js" {
  export function currentAccountId(): string
  export function loadCurrentOwnerSelection(ownerId?: string): any
  export function saveCurrentOwnerSelection(selection: any, ownerId?: string): void
  export function setCurrentAccountId(ownerId: string): void
  export function deleteOwnerSelection(ownerId: string): void
}

declare module "@core/maintenanceValidation.js" {
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
  export function deleteDriveDisc(store: any, id: string): any
  export function upsertDriveDiscLoadout(store: any, loadout: any): any
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
    onProgress: ((payload: any) => void) | null
    onLauncherProgress: ((payload: any) => void) | null
    onScannerReady: ((payload: any) => void) | null
    onItem: ((payload: any) => void) | null
    onComplete: ((payload: any) => void) | null
    onError: ((payload: any) => void) | null
    onDisconnect: (() => void) | null
    readonly connected: boolean
    readonly scanning: boolean
    readonly mode: string
    readonly helperVersion: string
    connect(): Promise<any>
    launchHelper(): void
    ensureScanner(): Promise<any>
    disconnect(): void
    startScan(options?: any): void
    stopScan(): void
  }
}
