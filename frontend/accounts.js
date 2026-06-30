import {
    accountSummary,
    createAccount as createLocalAccount,
    deleteAccount as deleteLocalAccount,
    switchAccount as switchLocalAccount,
    updateAccount as updateLocalAccount,
} from "./local-store.js"

export async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
        ...options,
    })
    const json = await response.json()
    if (!response.ok || json.ok === false) {
        throw new Error(json.error || response.statusText)
    }
    return json
}

let appConfigPromise = null

export function loadAppConfig() {
    appConfigPromise ??= fetch("/static/app-config.json")
        .then(response => response.ok ? response.json() : Promise.reject(new Error("No static app config")))
        .catch(() => fetch("/api/app-config")
            .then(response => response.ok ? response.json() : Promise.reject(new Error("No API app config")))
            .catch(() => ({ maintenanceEnabled: false })))
    return appConfigPromise
}

export async function syncMaintenanceLinks() {
    const config = await loadAppConfig()
    for (const link of document.querySelectorAll('a[href="/maintenance.html"]')) {
        link.hidden = !config.maintenanceEnabled
    }
    return config
}

export function accountLabel(account) {
    return account?.label ?? account?.name ?? account?.id ?? "default"
}

export async function loadAccounts() {
    return accountSummary()
}

export async function createAccount(account) {
    return createLocalAccount(account)
}

export async function updateAccount(id, patch) {
    return updateLocalAccount(id, patch)
}

export async function switchAccount(id) {
    return switchLocalAccount(id)
}

export async function deleteAccount(id) {
    return deleteLocalAccount(id)
}

export function currentAccount(accounts) {
    return (accounts?.owners ?? []).find(owner => owner.id === accounts.currentOwnerId)
        ?? (accounts?.owners ?? [])[0]
        ?? { id: "default", label: "默认用户" }
}

export async function renderSidebarAccount() {
    const els = [...document.querySelectorAll("[data-account-label]")]
    if (!els.length) {
        return null
    }

    try {
        await syncMaintenanceLinks()
        const accounts = await loadAccounts()
        const current = currentAccount(accounts)
        localStorage.setItem("zzz-calculator.currentAccount.v1", current.id)
        for (const el of els) {
            el.textContent = `账号 / ${accountLabel(current)}`
        }
        return accounts
    } catch (error) {
        await syncMaintenanceLinks()
        for (const el of els) {
            el.textContent = "账号 / 加载失败"
        }
        return null
    }
}

renderSidebarAccount()
