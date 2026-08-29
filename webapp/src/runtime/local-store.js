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

export const DRIVE_DISC_STORAGE_TIMEOUT = "DRIVE_DISC_STORAGE_TIMEOUT"
export const DEFAULT_STORAGE_TIMEOUT_MS = 15_000

const DB_NAME = "zzz-calculator-user-store"
const DB_VERSION = 1
const STATE_STORE = "state"
const STORE_KEY = "userDriveDiscStore"
const FALLBACK_STORAGE_KEY = "zzz-calculator.userStore.v1"

function normalizedTimeout(value, fallback = DEFAULT_STORAGE_TIMEOUT_MS) {
    if (value === undefined || value === null || value === "") return fallback
    const timeout = Number(value)
    return Number.isFinite(timeout) && timeout >= 0 ? timeout : fallback
}

function storageTimeout(options = {}) {
    return normalizedTimeout(options.storageTimeoutMs ?? options.timeoutMs)
}

function storageTimeoutError(purpose = "浏览器数据库操作", cause) {
    const error = new Error(`${purpose}超时，请稍后重试。`)
    error.code = DRIVE_DISC_STORAGE_TIMEOUT
    if (cause !== undefined) error.cause = cause
    return error
}

function lockOptions(options = {}) {
    const result = {}
    const waitTimeoutMs = options.waitTimeoutMs ?? options.lockTimeoutMs
    if (waitTimeoutMs !== undefined && waitTimeoutMs !== null) result.waitTimeoutMs = waitTimeoutMs
    if (options.purpose !== undefined) result.purpose = options.purpose
    if (options.signal !== undefined) result.signal = options.signal
    return result
}

function abortTransaction(transaction) {
    if (!transaction || typeof transaction.abort !== "function") {
        return { accepted: false, error: new Error("浏览器数据库事务无法中止，请刷新页面确认保存结果。") }
    }
    if (abortedTransactions.has(transaction)) return { accepted: true, error: null }
    abortedTransactions.add(transaction)
    try {
        transaction.abort()
        return { accepted: true, error: null }
    } catch (error) {
        abortedTransactions.delete(transaction)
        return { accepted: false, error }
    }
}

function requestToPromise(request, options = {}) {
    const timeoutMs = options.timeoutHandledByTransaction ? null : storageTimeout(options)
    const purpose = options.purpose ?? "浏览器数据库请求"
    return new Promise((resolve, reject) => {
        let settled = false
        let timer = null
        const finish = (callback, value) => {
            if (settled) return
            settled = true
            if (timer !== null) clearTimeout(timer)
            callback(value)
        }
        request.onsuccess = () => finish(resolve, request.result)
        request.onerror = () => finish(reject, request.error ?? new Error("浏览器数据库请求失败。"))
        if (timeoutMs !== null) {
            timer = setTimeout(() => {
                try {
                    options.onTimeout?.()
                } finally {
                    finish(reject, storageTimeoutError(purpose))
                }
            }, timeoutMs)
        }
    })
}

function transactionToPromise(transaction, options = {}) {
    const timeoutMs = storageTimeout(options)
    const purpose = options.purpose ?? "浏览器数据库事务"
    return new Promise((resolve, reject) => {
        let settled = false
        let timer = null
        const finish = (callback, value) => {
            if (settled) return
            settled = true
            if (timer !== null) clearTimeout(timer)
            callback(value)
        }
        transaction.oncomplete = () => {
            transactionTimeoutErrors.delete(transaction)
            finish(resolve)
        }
        transaction.onerror = () => {
            const timeoutError = transactionTimeoutErrors.get(transaction)
            finish(reject, timeoutError ?? transaction.error ?? new Error("浏览器数据库事务失败。"))
        }
        transaction.onabort = () => {
            const timeoutError = transactionTimeoutErrors.get(transaction)
            finish(reject, timeoutError ?? transaction.error ?? new Error("浏览器数据库事务已中止。"))
        }
        if (timeoutMs !== null) {
            timer = setTimeout(() => {
                const timeoutError = storageTimeoutError(purpose)
                transactionTimeoutErrors.set(transaction, timeoutError)
                const aborted = abortTransaction(transaction)
                if (aborted.accepted) {
                    finish(reject, timeoutError)
                    return
                }
                transactionTimeoutErrors.delete(transaction)
                if (String(aborted.error?.name ?? "") !== "InvalidStateError") {
                    finish(reject, aborted.error)
                }
            }, timeoutMs)
        }
    })
}

let dbPromise = null
let dbOpenEntry = null
let pendingStoreLoad = null
const abortedTransactions = new WeakSet()
const transactionTimeoutErrors = new WeakMap()

function timeoutPromise(promise, timeoutMs, onTimeout, purpose) {
    if (timeoutMs === null) return promise
    return new Promise((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            try {
                onTimeout?.()
            } catch {
                // Timeout cleanup must not replace the stable timeout error.
            } finally {
                reject(storageTimeoutError(purpose))
            }
        }, timeoutMs)
        promise.then(value => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(value)
        }, error => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(error)
        })
    })
}

function openDb(options = {}) {
    if (typeof indexedDB === "undefined") {
        return null
    }
    if (!dbPromise) {
        const entry = {
            promise: null,
            waiters: 0,
            settled: false,
            stale: false,
            staleError: null,
        }
        const promise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onupgradeneeded = () => {
                const db = request.result
                if (!db.objectStoreNames.contains(STATE_STORE)) {
                    db.createObjectStore(STATE_STORE)
                }
            }
            request.onsuccess = () => {
                entry.settled = true
                const db = request.result
                if (entry.stale) {
                    db.close?.()
                    reject(entry.staleError ?? storageTimeoutError("打开浏览器数据库"))
                    return
                }
                resolve(db)
            }
            request.onerror = () => {
                entry.settled = true
                reject(request.error ?? new Error("打开浏览器数据库失败。"))
            }
        })
        entry.promise = promise
        dbPromise = promise
        dbOpenEntry = entry
        promise.then(db => {
            if (dbPromise !== promise) {
                db.close?.()
                return
            }
            const resetConnection = () => {
                if (dbPromise === promise) {
                    dbPromise = null
                    dbOpenEntry = null
                }
            }
            db.onversionchange = () => {
                db.close?.()
                resetConnection()
            }
            db.onclose = resetConnection
        }).catch(() => {
            if (dbPromise === promise) {
                dbPromise = null
                dbOpenEntry = null
            }
        })
    }
    const entry = dbOpenEntry
    entry.waiters += 1
    let waiterReleased = false
    const releaseWaiter = () => {
        if (waiterReleased) return
        waiterReleased = true
        entry.waiters = Math.max(0, entry.waiters - 1)
    }
    const timeoutMs = storageTimeout(options)
    return timeoutPromise(
        entry.promise,
        timeoutMs,
        () => {
            releaseWaiter()
            if (!entry.settled && entry.waiters === 0 && dbPromise === entry.promise) {
                entry.stale = true
                entry.staleError = storageTimeoutError(options.purpose ?? "打开浏览器数据库")
                dbPromise = null
                dbOpenEntry = null
            }
        },
        options.purpose ?? "打开浏览器数据库",
    ).finally(releaseWaiter)
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

async function writePersistedStore(store, options = {}) {
    const timeoutMs = storageTimeout(options)
    const pendingDb = openDb({
        ...options,
        storageTimeoutMs: timeoutMs,
        purpose: options.purpose ?? "写入驱动盘库存",
    })
    if (!pendingDb) {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store))
        return store
    }
    const db = await pendingDb
    const tx = db.transaction(STATE_STORE, "readwrite")
    const completed = transactionToPromise(tx, {
        storageTimeoutMs: timeoutMs,
        purpose: options.purpose ?? "写入驱动盘库存",
    })
    try {
        tx.objectStore(STATE_STORE).put(store, STORE_KEY)
    } catch (error) {
        const timeoutError = transactionTimeoutErrors.get(tx)
        transactionTimeoutErrors.delete(tx)
        abortTransaction(tx)
        await completed.catch(() => {})
        throw timeoutError ?? error
    }
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

async function readAndMigratePersistedStore(options = {}) {
    const timeoutMs = storageTimeout(options)
    const pendingDb = openDb({
        ...options,
        storageTimeoutMs: timeoutMs,
        purpose: options.purpose ?? "读取驱动盘库存",
    })
    if (!pendingDb) {
        return readAndMigrateFallbackStore()
    }

    const db = await pendingDb
    const tx = db.transaction(STATE_STORE, "readwrite")
    const completed = transactionToPromise(tx, {
        storageTimeoutMs: timeoutMs,
        purpose: options.purpose ?? "读取驱动盘库存",
    })
    // Handle completion immediately because request and transaction settle on
    // separate paths and a timeout must not become an unhandled rejection.
    completed.catch(() => {})
    const objectStore = tx.objectStore(STATE_STORE)
    let persisted
    try {
        const request = objectStore.get(STORE_KEY)
        persisted = await Promise.race([
            requestToPromise(request, {
                timeoutHandledByTransaction: true,
                purpose: options.purpose ?? "读取驱动盘库存",
            }),
            completed.then(() => request.result),
        ])
    } catch (error) {
        const timeoutError = transactionTimeoutErrors.get(tx)
        transactionTimeoutErrors.delete(tx)
        abortTransaction(tx)
        await completed.catch(() => {})
        throw timeoutError ?? error
    }

    const migrated = migratePersistedInventoryStore(persisted)
    if (migrated !== persisted) {
        try {
            objectStore.put(migrated, STORE_KEY)
            await completed
        } catch (error) {
            const timeoutError = transactionTimeoutErrors.get(tx)
            transactionTimeoutErrors.delete(tx)
            abortTransaction(tx)
            await completed.catch(() => {})
            if (timeoutError) throw timeoutError
            console.warn("自动修正驱动盘数据后回写浏览器存储失败。", error)
        }
    } else {
        await completed
    }
    return normalizeInventoryStore(migrated)
}

export function loadUserDriveDiscStore(options = {}) {
    pendingStoreLoad ??= readAndMigratePersistedStore(options).finally(() => {
        pendingStoreLoad = null
    })
    return pendingStoreLoad
}

export function loadUserDriveDiscStoreFresh(options = {}) {
    return readAndMigratePersistedStore(options)
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
    dbOpenEntry = null
    pendingStoreLoad = null

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

export async function loadCurrentUserDriveDiscStore(options = {}) {
    return ownerScopedStore(await loadUserDriveDiscStore(options))
}

export async function loadCurrentUserDriveDiscStoreFresh(options = {}) {
    return ownerScopedStore(await loadUserDriveDiscStoreFresh(options))
}

export async function exportCurrentUserDriveDiscs(options = {}) {
    return createDriveDiscExport(await loadUserDriveDiscStore(options), options)
}

export async function saveUserDriveDiscStoreUnlocked(store, options = {}) {
    const nextStore = {
        ...normalizeInventoryStore(migratePersistedInventoryStore(store)),
        updatedAt: new Date().toISOString(),
    }
    await writePersistedStore(nextStore, options)
    return nextStore
}

export async function saveUserDriveDiscStore(store, options = {}) {
    const ownerId = String(store?.currentOwnerId ?? "store")
    return withDriveDiscImportOwnerLock(
        ownerId,
        () => saveUserDriveDiscStoreUnlocked(store, options),
        lockOptions(options),
    )
}

function mutateUserDriveDiscStore(ownerId, task, options = {}) {
    return withDriveDiscImportOwnerLock(String(ownerId ?? "store"), async () => {
        const store = await loadUserDriveDiscStoreFresh(options)
        return task(store, options)
    }, lockOptions(options))
}

export async function accountSummary(options = {}) {
    return summarizeAccounts(await loadUserDriveDiscStore(options))
}

export async function createAccount(account = {}, options = {}) {
    return mutateUserDriveDiscStore("accounts", async (store, options) => {
        const result = createInventoryAccount(store, account)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return summarizeAccounts(saved)
    }, options)
}

export async function updateAccount(id, patch = {}, options = {}) {
    return mutateUserDriveDiscStore(id, async (store, options) => {
        const result = updateInventoryAccount(store, id, patch)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return summarizeAccounts(saved)
    }, options)
}

export async function switchAccount(id, options = {}) {
    return mutateUserDriveDiscStore(id, async (store, options) => {
        const result = switchInventoryAccount(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return summarizeAccounts(saved)
    }, options)
}

export async function deleteAccount(id, options = {}) {
    return mutateUserDriveDiscStore(id, async (store, options) => {
        const result = deleteInventoryAccount(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return summarizeAccounts(saved)
    }, options)
}

export async function previewScannerExportImport(input, options = {}) {
    return (await planScannerExportImport(input, options)).preview
}

export async function planScannerExportImport(input, options = {}) {
    const currentStore = await loadUserDriveDiscStore(options)
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
    const saved = await loadUserDriveDiscStoreFresh(options)
    return {
        ...ownerScopedStore(saved, plan.ownerId),
        lastImportSummary: plan.summary,
    }
}

export async function clearUserDriveDiscStore(ownerId = null, options = {}) {
    return mutateUserDriveDiscStore(ownerId, async (store, options) => {
        const result = clearOwnerInventory(store, ownerId)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            previous: result.previous,
        }
    }, options)
}

export async function upsertUserDriveDisc(driveDisc, options = {}) {
    return mutateUserDriveDiscStore(driveDisc?.ownerId, async store => {
        const result = upsertDriveDisc(store, driveDisc, options)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return ownerScopedStore(saved, result.ownerId)
    }, options)
}

export async function deleteUserDriveDisc(id, operationOptions = {}) {
    return mutateUserDriveDiscStore("store", async (store, options) => {
        const result = deleteDriveDisc(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            deleted: result.deleted,
        }
    }, operationOptions)
}

export async function setDriveDiscReservations(input = {}, operationOptions = {}) {
    return mutateUserDriveDiscStore(input.ownerId, async (store, options) => {
        const result = setInventoryDriveDiscReservations(store, input)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
        }
    }, operationOptions)
}

export async function setDriveDiscExclusions(input = {}, operationOptions = {}) {
    return mutateUserDriveDiscStore(input.ownerId, async (store, options) => {
        const result = setInventoryDriveDiscExclusions(store, input)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
        }
    }, operationOptions)
}

export async function upsertDriveDiscLoadout(loadout, options = {}) {
    return mutateUserDriveDiscStore(loadout?.ownerId ?? options.ownerId, async (store, persistOptions) => {
        const result = upsertInventoryLoadout(store, loadout, options)
        if (!result.applied) {
            return {
                ...result,
                store: ownerScopedStore(store, result.ownerId),
            }
        }
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, persistOptions)
        return {
            ...result,
            store: ownerScopedStore(saved, result.ownerId),
            loadout: result.loadout,
        }
    }, options)
}

export async function deleteDriveDiscLoadout(id, operationOptions = {}) {
    return mutateUserDriveDiscStore("store", async (store, options) => {
        const result = deleteInventoryLoadout(store, id)
        const saved = await saveUserDriveDiscStoreUnlocked(result.nextStore, options)
        return {
            store: ownerScopedStore(saved, result.ownerId),
            deleted: result.deleted,
        }
    }, operationOptions)
}
