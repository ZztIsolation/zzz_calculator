import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import {
    accountSummary as summarizeAccounts,
    buildScannerImportPlan,
    clearOwnerInventory,
    createAccount as createInventoryAccount,
    createEmptyInventoryStore,
    currentOwnerId as getCurrentOwnerId,
    deleteAccount as deleteInventoryAccount,
    deleteDriveDisc,
    deleteDriveDiscLoadout as deleteInventoryLoadout,
    driveDiscContentFingerprint as contentFingerprint,
    driveDiscIdentityFingerprint as identityFingerprint,
    normalizeInventoryStore,
    normalizeScannerExport as normalizeInventoryScannerExport,
    ownerScopedStore as scopeInventoryStore,
    switchAccount as switchInventoryAccount,
    updateAccount as updateInventoryAccount,
    upsertDriveDisc,
    upsertDriveDiscLoadout as upsertInventoryLoadout,
} from "../core/inventory-model.js"

export { toCalculatorDriveDisc } from "../core/drive-disc-core.js"

const STORE_FILE = "user_drive_discs.json"

function hashText(value) {
    return createHash("sha1").update(value).digest("hex").slice(0, 12)
}

function modelOptions(options = {}) {
    return {
        ...options,
        hashText,
        matchedAtField: "lastMatchedAt",
        preserveCreatedAtOnMerge: false,
    }
}

function storePath(dataDir) {
    return path.join(dataDir, STORE_FILE)
}

export function driveDiscContentFingerprint(disc) {
    return contentFingerprint(disc, modelOptions())
}

export function driveDiscIdentityFingerprint(disc) {
    return identityFingerprint(disc, modelOptions())
}

export function ownerScopedStore(store, ownerId = store?.currentOwnerId) {
    return scopeInventoryStore(store, ownerId, modelOptions())
}

export function currentOwnerId(store) {
    return getCurrentOwnerId(store, modelOptions())
}

export function normalizeScannerExport(input, options = {}) {
    return normalizeInventoryScannerExport(input, modelOptions(options))
}

export async function loadUserDriveDiscStore(dataDir) {
    const filePath = storePath(dataDir)
    if (!existsSync(filePath)) {
        return createEmptyInventoryStore()
    }

    const text = await readFile(filePath, "utf8")
    return normalizeInventoryStore(JSON.parse(text), modelOptions())
}

export async function loadCurrentUserDriveDiscStore(dataDir) {
    return ownerScopedStore(await loadUserDriveDiscStore(dataDir))
}

export async function saveUserDriveDiscStore(dataDir, store) {
    const nextStore = {
        ...normalizeInventoryStore(store, modelOptions()),
        updatedAt: new Date().toISOString(),
    }
    await writeFile(storePath(dataDir), `${JSON.stringify(nextStore, null, 2)}\n`, "utf8")
    return nextStore
}

export async function importScannerExportToStore(dataDir, input, options = {}) {
    const currentStore = await loadUserDriveDiscStore(dataDir)
    const plan = buildScannerImportPlan(currentStore, input, modelOptions(options))
    const saved = await saveUserDriveDiscStore(dataDir, plan.nextStore)
    return {
        ...saved,
        lastImportSummary: plan.summary,
    }
}

export async function clearUserDriveDiscStore(dataDir, ownerId = null) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = clearOwnerInventory(store, ownerId)
    return {
        store: await saveUserDriveDiscStore(dataDir, result.nextStore),
        previous: result.previous,
    }
}

export async function upsertUserDriveDisc(dataDir, driveDisc) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = upsertDriveDisc(store, driveDisc, modelOptions())
    return saveUserDriveDiscStore(dataDir, result.nextStore)
}

export async function deleteUserDriveDisc(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = deleteDriveDisc(store, id)
    return {
        store: await saveUserDriveDiscStore(dataDir, result.nextStore),
        deleted: result.deleted,
    }
}

export async function upsertDriveDiscLoadout(dataDir, loadout) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = upsertInventoryLoadout(store, loadout)
    return {
        store: await saveUserDriveDiscStore(dataDir, result.nextStore),
        loadout: result.loadout,
    }
}

export async function deleteDriveDiscLoadout(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = deleteInventoryLoadout(store, id)
    return {
        store: await saveUserDriveDiscStore(dataDir, result.nextStore),
        deleted: result.deleted,
    }
}

export async function accountSummary(dataDir) {
    return summarizeAccounts(await loadUserDriveDiscStore(dataDir))
}

export async function createAccount(dataDir, account = {}) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = createInventoryAccount(store, account)
    const saved = await saveUserDriveDiscStore(dataDir, result.nextStore)
    return {
        store: saved,
        account: result.account,
        summary: summarizeAccounts(saved),
    }
}

export async function updateAccount(dataDir, id, patch = {}) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = updateInventoryAccount(store, id, patch)
    const saved = await saveUserDriveDiscStore(dataDir, result.nextStore)
    return {
        store: saved,
        account: result.account,
        summary: summarizeAccounts(saved),
    }
}

export async function switchAccount(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = switchInventoryAccount(store, id)
    const saved = await saveUserDriveDiscStore(dataDir, result.nextStore)
    return {
        store: saved,
        summary: summarizeAccounts(saved),
    }
}

export async function deleteAccount(dataDir, id) {
    const store = await loadUserDriveDiscStore(dataDir)
    const result = deleteInventoryAccount(store, id)
    const saved = await saveUserDriveDiscStore(dataDir, result.nextStore)
    return {
        store: saved,
        summary: summarizeAccounts(saved),
        deleted: result.deleted,
    }
}
