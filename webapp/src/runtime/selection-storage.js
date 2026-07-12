export const HOME_SELECTION_STORAGE_KEY = "zzz-calculator.homeSelection.v1"
export const CURRENT_ACCOUNT_STORAGE_KEY = "zzz-calculator.currentAccount.v1"

export function readJsonStorage(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
    } catch {
        return fallback
    }
}

export function currentAccountId() {
    return localStorage.getItem(CURRENT_ACCOUNT_STORAGE_KEY) || "default"
}

export function setCurrentAccountId(ownerId) {
    localStorage.setItem(CURRENT_ACCOUNT_STORAGE_KEY, ownerId || "default")
}

export function loadHomeSelection() {
    const activeOwnerId = currentAccountId()
    const value = readJsonStorage(HOME_SELECTION_STORAGE_KEY, null)
    if (!value || typeof value !== "object") {
        return {
            version: 2,
            currentOwnerId: activeOwnerId,
            byOwner: { [activeOwnerId]: { currentAgentId: null, byAgent: {} } },
        }
    }
    if (value.byOwner && typeof value.byOwner === "object") {
        return {
            version: 2,
            currentOwnerId: value.currentOwnerId ?? activeOwnerId,
            byOwner: value.byOwner,
        }
    }
    return {
        version: 2,
        currentOwnerId: "default",
        byOwner: {
            default: {
                currentAgentId: value.currentAgentId ?? null,
                byAgent: value.byAgent && typeof value.byAgent === "object" ? value.byAgent : {},
            },
        },
    }
}

export function saveHomeSelection(selection) {
    const ownerId = selection.currentOwnerId ?? currentAccountId()
    localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify({
        version: 2,
        currentOwnerId: ownerId,
        byOwner: selection.byOwner ?? {
            [ownerId]: {
                currentAgentId: selection.currentAgentId ?? null,
                byAgent: selection.byAgent ?? {},
            },
        },
    }))
}

export function loadCurrentOwnerSelection(ownerId = currentAccountId()) {
    const selection = loadHomeSelection()
    return selection.byOwner?.[ownerId] ?? { currentAgentId: null, byAgent: {} }
}

export function saveCurrentOwnerSelection(ownerSelection, ownerId = currentAccountId()) {
    const selection = loadHomeSelection()
    saveHomeSelection({
        version: 2,
        currentOwnerId: ownerId,
        byOwner: {
            ...(selection.byOwner ?? {}),
            [ownerId]: {
                currentAgentId: ownerSelection.currentAgentId ?? null,
                byAgent: ownerSelection.byAgent ?? {},
            },
        },
    })
}

export function deleteOwnerSelection(ownerId) {
    const selection = loadHomeSelection()
    const byOwner = { ...(selection.byOwner ?? {}) }
    delete byOwner[ownerId]
    saveHomeSelection({
        version: 2,
        currentOwnerId: selection.currentOwnerId === ownerId ? currentAccountId() : selection.currentOwnerId,
        byOwner,
    })
}
