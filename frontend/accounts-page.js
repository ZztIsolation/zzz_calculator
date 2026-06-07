import { accountLabel, api, currentAccount, loadAccounts } from "./accounts.js"
import { confirmDialog, promptDialog } from "./dialogs.js"
import { deleteOwnerSelection, setCurrentAccountId } from "./shared-combat.js"

const els = {
    status: document.getElementById("status"),
    accountTableBody: document.getElementById("accountTableBody"),
    emptyAccounts: document.getElementById("emptyAccounts"),
    addAccountBtn: document.getElementById("addAccountBtn"),
}

let accounts = null

function setStatus(text, tone = "idle") {
    els.status.textContent = text
    els.status.dataset.tone = tone
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function renderAccounts() {
    const owners = accounts?.owners ?? []
    const current = currentAccount(accounts)
    els.accountTableBody.innerHTML = ""
    els.emptyAccounts.hidden = owners.length !== 0

    for (const owner of owners) {
        const isCurrent = owner.id === current.id
        const row = document.createElement("tr")
        row.dataset.accountId = owner.id
        row.innerHTML = `
            <td>
                <strong>${escapeHtml(accountLabel(owner))}</strong>
                <br><span>${escapeHtml(owner.id)}</span>
            </td>
            <td>${isCurrent ? '<span class="status-pill">当前</span>' : "-"}</td>
            <td>${Number(owner.driveDiscCount ?? 0)}</td>
            <td>${Number(owner.loadoutCount ?? 0)}</td>
            <td>${Number(owner.importCount ?? 0)}</td>
            <td class="account-actions">
                <button type="button" class="compact-btn" data-action="switch" ${isCurrent ? "disabled" : ""}>切换</button>
                <button type="button" class="compact-btn" data-action="rename">改名</button>
                <button type="button" class="compact-btn danger-lite" data-action="delete" ${isCurrent ? "disabled" : ""}>删除</button>
            </td>
        `
        els.accountTableBody.appendChild(row)
    }
}

async function refresh() {
    accounts = await loadAccounts()
    setCurrentAccountId(accounts.currentOwnerId)
    renderAccounts()
}

async function addAccount() {
    const name = await promptDialog({
        title: "新增账号",
        message: "新账号会拥有独立的驱动盘、套装预设和计算状态。",
        label: "账号名称",
        value: "新账号",
        confirmText: "新增账号",
    })
    if (name === null) {
        return
    }
    accounts = await api("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
            label: name.trim() || "新账号",
        }),
    })
    renderAccounts()
}

async function renameAccount(id) {
    const owner = accounts.owners.find(item => item.id === id)
    if (!owner) {
        return
    }
    const name = await promptDialog({
        title: "重命名账号",
        message: `正在修改「${accountLabel(owner)}」的显示名称。`,
        label: "账号名称",
        value: accountLabel(owner),
        confirmText: "保存名称",
    })
    if (name === null) {
        return
    }
    accounts = await api(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
            label: name.trim() || accountLabel(owner),
        }),
    })
    renderAccounts()
}

async function switchAccount(id) {
    accounts = await api("/api/accounts/current", {
        method: "POST",
        body: JSON.stringify({ id }),
    })
    setCurrentAccountId(accounts.currentOwnerId)
    renderAccounts()
}

async function deleteAccount(id) {
    const owner = accounts.owners.find(item => item.id === id)
    if (!owner) {
        return
    }
    const ok = await confirmDialog({
        title: "删除账号",
        message: `确认删除「${accountLabel(owner)}」？将删除 ${Number(owner.driveDiscCount ?? 0)} 个驱动盘、${Number(owner.loadoutCount ?? 0)} 个套装预设和 ${Number(owner.importCount ?? 0)} 次导入记录。`,
        confirmText: "删除账号",
        tone: "danger",
    })
    if (!ok) {
        return
    }
    accounts = await api(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
    })
    deleteOwnerSelection(id)
    renderAccounts()
}

els.addAccountBtn.addEventListener("click", async () => {
    try {
        setStatus("新增账号", "idle")
        await addAccount()
        setStatus("已新增", "success")
    } catch (error) {
        setStatus(error.message, "error")
    }
})

els.accountTableBody.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]")
    const row = event.target.closest("tr[data-account-id]")
    if (!button || !row) {
        return
    }
    try {
        const action = button.dataset.action
        setStatus("处理中", "idle")
        if (action === "switch") {
            await switchAccount(row.dataset.accountId)
            setStatus("已切换", "success")
        } else if (action === "rename") {
            await renameAccount(row.dataset.accountId)
            setStatus("已改名", "success")
        } else if (action === "delete") {
            await deleteAccount(row.dataset.accountId)
            setStatus("已删除", "success")
        }
    } catch (error) {
        setStatus(error.message, "error")
    }
})

try {
    setStatus("加载中", "idle")
    await refresh()
    setStatus("就绪", "success")
} catch (error) {
    setStatus(error.message, "error")
}
