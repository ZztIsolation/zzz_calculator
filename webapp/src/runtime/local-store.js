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
    normalizeInventoryStore,
    ownerScopedStore,
    switchAccount as switchInventoryAccount,
    updateAccount as updateInventoryAccount,
    upsertDriveDisc,
    upsertDriveDiscLoadout as upsertInventoryLoadout,
} from "@core/inventory-model.js"

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

let dbPromise = null

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
    return dbPromise
}

async function readPersistedStore() {
    const db = await openDb()
    if (!db) {
        try {
            return JSON.parse(localStorage.getItem(FALLBACK_STORAGE_KEY) || "null")
        } catch {
            return null
        }
    }
    const tx = db.transaction(STATE_STORE, "readonly")
    return requestToPromise(tx.objectStore(STATE_STORE).get(STORE_KEY))
}

async function writePersistedStore(store) {
    const db = await openDb()
    if (!db) {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store))
        return store
    }
    const tx = db.transaction(STATE_STORE, "readwrite")
    await requestToPromise(tx.objectStore(STATE_STORE).put(store, STORE_KEY))
    return store
}

export async function loadUserDriveDiscStore() {
    return normalizeInventoryStore(await readPersistedStore())
}

export async function loadCurrentUserDriveDiscStore() {
    return ownerScopedStore(await loadUserDriveDiscStore())
}

export async function saveUserDriveDiscStore(store) {
    const nextStore = {
        ...normalizeInventoryStore(store),
        updatedAt: new Date().toISOString(),
    }
    await writePersistedStore(nextStore)
    return nextStore
}

export async function accountSummary() {
    return summarizeAccounts(await loadUserDriveDiscStore())
}

export async function createAccount(account = {}) {
    const store = await loadUserDriveDiscStore()
    const result = createInventoryAccount(store, account)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return summarizeAccounts(saved)
}

export async function updateAccount(id, patch = {}) {
    const store = await loadUserDriveDiscStore()
    const result = updateInventoryAccount(store, id, patch)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return summarizeAccounts(saved)
}

export async function switchAccount(id) {
    const store = await loadUserDriveDiscStore()
    const result = switchInventoryAccount(store, id)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return summarizeAccounts(saved)
}

export async function deleteAccount(id) {
    const store = await loadUserDriveDiscStore()
    const result = deleteInventoryAccount(store, id)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return summarizeAccounts(saved)
}

export async function previewScannerExportImport(input, options = {}) {
    const currentStore = await loadUserDriveDiscStore()
    return buildScannerImportPlan(currentStore, input, options).preview
}

export async function importScannerExportToStore(input, options = {}) {
    const currentStore = await loadUserDriveDiscStore()
    const plan = buildScannerImportPlan(currentStore, input, options)
    const saved = await saveUserDriveDiscStore(plan.nextStore)
    return {
        ...ownerScopedStore(saved, plan.ownerId),
        lastImportSummary: plan.summary,
    }
}

export async function clearUserDriveDiscStore(ownerId = null) {
    const store = await loadUserDriveDiscStore()
    const result = clearOwnerInventory(store, ownerId)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return {
        store: ownerScopedStore(saved, result.ownerId),
        previous: result.previous,
    }
}

export async function upsertUserDriveDisc(driveDisc) {
    const store = await loadUserDriveDiscStore()
    const result = upsertDriveDisc(store, driveDisc)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return ownerScopedStore(saved, result.ownerId)
}

export async function deleteUserDriveDisc(id) {
    const store = await loadUserDriveDiscStore()
    const result = deleteDriveDisc(store, id)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return {
        store: ownerScopedStore(saved, result.ownerId),
        deleted: result.deleted,
    }
}

export async function upsertDriveDiscLoadout(loadout) {
    const store = await loadUserDriveDiscStore()
    const result = upsertInventoryLoadout(store, loadout)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return {
        store: ownerScopedStore(saved, result.ownerId),
        loadout: result.loadout,
    }
}

export async function deleteDriveDiscLoadout(id) {
    const store = await loadUserDriveDiscStore()
    const result = deleteInventoryLoadout(store, id)
    const saved = await saveUserDriveDiscStore(result.nextStore)
    return {
        store: ownerScopedStore(saved, result.ownerId),
        deleted: result.deleted,
    }
}
