import {
    accountSummary as summarizeAccounts,
    buildScannerImportPlan,
    clearOwnerInventory,
    createAccount as createInventoryAccount,
    deleteAccount as deleteInventoryAccount,
    deleteDriveDisc,
    deleteDriveDiscLoadout as deleteInventoryLoadout,
    driveDiscContentFingerprint,
    driveDiscIdentityFingerprint,
    createDriveDiscExport,
    migrateDriveDiscSetAliases,
    migrateDriveDiscStatUnits,
    normalizeInventoryStore,
    ownerScopedStore,
    setDriveDiscExclusions as setInventoryDriveDiscExclusions,
    setDriveDiscReservations as setInventoryDriveDiscReservations,
    switchAccount as switchInventoryAccount,
    updateAccount as updateInventoryAccount,
    upsertDriveDisc,
    upsertDriveDiscLoadout as upsertInventoryLoadout,
} from "@core/inventory-model.js"
import { withDriveDiscImportOwnerLock } from "@runtime/drive-disc-import-lock"

export { driveDiscContentFingerprint, driveDiscIdentityFingerprint, ownerScopedStore }

const DB_NAME = "zzz-calculator-user-store"
const DB_VERSION = 1
const STATE_STORE = "state"
const STORE_KEY = "userDriveDiscStore"
const FALLBACK_STORAGE_KEY = "zzz-calculator.userStore.v1"

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error("浏览器数据库事务失败。"))
        transaction.onabort = () => reject(transaction.error ?? new Error("浏览器数据库事务已中止。"))
    })
}

let dbPromise = null
let pendingStoreLoad = null

function openDb() {
    if (typeof indexedDB === "undefined") {
        return null
    }
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE)
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
    dbPromise.then(db => {
        db.onversionchange = () => db.close()
    }).catch(() => {})
    return dbPromise
}

function deleteDatabase() {
    if (typeof indexedDB === "undefined") {
        return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error ?? new Error("删除浏览器数据库失败。"))
        request.onblocked = () => reject(new Error("数据库仍被其他标签页占用，请关闭其他计算器标签页后重试。"))
    })
}

function readFallbackStore() {
    try {
        return JSON.parse(localStorage.getItem(FALLBACK_STORAGE_KEY) || "null")
    } catch {
        return null
    }
}

function migratePersistedInventoryStore(store) {
    return migrateDriveDiscStatUnits(migrateDriveDiscSetAliases(store))
}

async function writePersistedStore(store) {
    const pendingDb = openDb()
    if (!pendingDb) {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store))
        return store
    }
    const db = await pendingDb
    const tx = db.transaction(STATE_STORE, "readwrite")
    const completed = transactionToPromise(tx)
    tx.objectStore(STATE_STORE).put(store, STORE_KEY)
    await completed
    return store
}

function readAndMigrateFallbackStore() {
    const persisted = readFallbackStore()
    const migrated = migratePersistedInventoryStore(persisted)
    if (migrated !== persisted) {
        try {
            localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(migrated))
        } catch (error) {
            console.warn("自动修正驱动盘数据后回写浏览器存储失败。", error)
        }
    }
    return normalizeInventoryStore(migrated)
}

async function readAndMigratePersistedStore() {
    const pendingDb = openDb()
    if (!pendingDb) {
        return readAndMigrateFallbackStore()
    }

    const db = await pendingDb
    const tx = db.transaction(STATE_STORE, "readwrite")
    const completed = transactionToPromise(tx)
    const objectStore = tx.objectStore(STATE_STORE)
    let persisted
    try {
        persisted = await requestToPromise(objectStore.get(STORE_KEY))
    } catch (error) {
        await completed.catch(() => {})
        throw error
    }

    const migrated = migratePersistedInventoryStore(persisted)
    if (migrated !== persisted) {
        try {
            objectStore.put(migrated, STORE_KEY)
            await completed
        } catch (error) {
            await completed.catch(() => {})
            console.warn("自动修正驱动盘数据后回写浏览器存储失败。", error)
        }
    } else {
        await completed
    }
    return normalizeInventoryStore(migrated)
}

export function loadUserDriveDiscStore() {
    pendingStoreLoad ??= readAndMigratePersistedStore().finally(() => {
        pendingStoreLoad = null
    })
    return pendingStoreLoad
}

export function loadUserDriveDiscStoreFresh() {
    return readAndMigratePersistedStore()
}

export async function clearAllBrowserData() {
    if (dbPromise) {
        try {
            const db = await dbPromise
            db.close()
        } catch {
        }
        dbPromise = null
    }

    await deleteDatabase()
    try {
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
            .filter(Boolean)
        for (const key of keys) {
            if (key.startsWith("zzz-calculator.") || key.startsWith("zzz_maintenance_vue_draft_")) {
                localStorage.removeItem(key)
            }
        }
    } catch {
    }
}

export async function loadCurrentUserDriveDiscStore() {
    return ownerScopedStore(await loadUserDriveDiscStore())
}

export async function exportCurrentUserDriveDiscs(options = {}) {
    return createDriveDiscExport(await loadUserDriveDiscStore(), options)
}

export async function saveUserDriveDiscStoreUnlocked(store) {
    const nextStore = {
        ...normalizeInventoryStore(migratePersistedInventoryStore(store)),
        updatedAt: new Date().toISOString(),
    }
    await writePersistedStore(nextStore)
    return nextStore
}

export async function saveUserDriveDiscStore(store) {
    const ownerId = String(store?.currentOwnerId ?? "store")
    return withDriveDiscImportOwnerLock(ownerId, () => saveUserDriveDiscStoreUnlocked(store))
}

function mutateUserDriveDiscStore(ownerId, task) {
    return withDriveDiscImportOwnerLock(String(ownerId ?? "store"), async () => {
        const store = await loadUserDriveDiscStoreFresh()
        return task(store)
    })
}

export async function accountSummary() {
    return summarizeAccounts(await loadUserDriveDiscStore())
}

export async function createAccount(account = {}) {
    return mutateUserDriveDiscStore("accounts", async store => {
        const result = createInventoryAccount(store, account)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return summarizeAccounts(saved)
    })
}

export async function updateAccount(id, patch = {}) {
    return mutateUserDriveDiscStore(id, async store => {
        const result = updateInventoryAccount(store, id, patch)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return summarizeAccounts(saved)
    })
}

export async function switchAccount(id) {
    return mutateUserDriveDiscStore(id, async store => {
        const result = switchInventoryAccount(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return summarizeAccounts(saved)
    })
}

export async function deleteAccount(id) {
    return mutateUserDriveDiscStore(id, async store => {
        const result = deleteInventoryAccount(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return summarizeAccounts(saved)
    })
}

export async function previewScannerExportImport(input, options = {}) {
    return (await planScannerExportImport(input, options)).preview
}

export async function planScannerExportImport(input, options = {}) {
    const currentStore = await loadUserDriveDiscStore()
    return buildScannerImportPlan(currentStore, input, options)
}

export async function importScannerExportToStore(input, options = {}) {
    const plan = await planScannerExportImport(input, options)
    if (plan.hasUnresolvedConflicts) {
        const error = new Error("驱动盘导入存在待确认的疑似同盘，请先预览并处理。")
        error.code = "DRIVE_DISC_IMPORT_CONFLICT"
        error.conflicts = plan.reconciliation.conflicts
        throw error
    }
    const {
        commitDriveDiscImportPlan,
        freezeDriveDiscInventoryImportPlan,
    } = await import("@runtime/drive-disc-import-transaction")
    const frozenPlan = await freezeDriveDiscInventoryImportPlan(plan)
    await commitDriveDiscImportPlan(frozenPlan)
    const saved = await loadUserDriveDiscStoreFresh()
    return {
        ...ownerScopedStore(saved, plan.ownerId),
        lastImportSummary: plan.summary,
    }
}

export async function clearUserDriveDiscStore(ownerId = null) {
    return mutateUserDriveDiscStore(ownerId, async store => {
        const result = clearOwnerInventory(store, ownerId)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            previous: result.previous,
        }
    })
}

export async function upsertUserDriveDisc(driveDisc) {
    return mutateUserDriveDiscStore(driveDisc?.ownerId, async store => {
        const result = upsertDriveDisc(store, driveDisc)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return ownerScopedStore(saved, result.ownerId)
    })
}

export async function deleteUserDriveDisc(id) {
    return mutateUserDriveDiscStore("store", async store => {
        const result = deleteDriveDisc(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            deleted: result.deleted,
        }
    })
}

export async function setDriveDiscReservations(input = {}) {
    return mutateUserDriveDiscStore(input.ownerId, async store => {
        const result = setInventoryDriveDiscReservations(store, input)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
        }
    })
}

export async function setDriveDiscExclusions(input = {}) {
    return mutateUserDriveDiscStore(input.ownerId, async store => {
        const result = setInventoryDriveDiscExclusions(store, input)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
        }
    })
}

export async function upsertDriveDiscLoadout(loadout, options = {}) {
    return mutateUserDriveDiscStore(loadout?.ownerId ?? options.ownerId, async store => {
        const result = upsertInventoryLoadout(store, loadout, options)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
            loadout: result.loadout,
        }
    })
}

export async function deleteDriveDiscLoadout(id) {
    return mutateUserDriveDiscStore("store", async store => {
        const result = deleteInventoryLoadout(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            deleted: result.deleted,
        }
    })
}
