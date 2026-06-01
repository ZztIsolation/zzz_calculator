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

export function accountLabel(account) {
    return account?.label ?? account?.name ?? account?.id ?? "default"
}

export async function loadAccounts() {
    return api("/api/accounts")
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
        const accounts = await loadAccounts()
        const current = currentAccount(accounts)
        localStorage.setItem("zzz-calculator.currentAccount.v1", current.id)
        for (const el of els) {
            el.textContent = `账号 / ${accountLabel(current)}`
        }
        return accounts
    } catch (error) {
        for (const el of els) {
            el.textContent = "账号 / 加载失败"
        }
        return null
    }
}

renderSidebarAccount()
