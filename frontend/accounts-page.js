import {
    accountLabel,
    createAccount as createLocalAccount,
    currentAccount,
    deleteAccount as deleteLocalAccount,
    loadAccounts,
    switchAccount as switchLocalAccount,
    updateAccount as updateLocalAccount,
} from "./accounts.js"
import { confirmDialog, promptDialog } from "./dialogs.js"
import { clearPageNotice, setStatusChip, showErrorNotice, showSuccessNotice } from "./feedback.js"
import { deleteOwnerSelection, setCurrentAccountId } from "./shared-combat.js"

const els = {
    status: document.getElementById("status"),
    accountTableBody: document.getElementById("accountTableBody"),
    emptyAccounts: document.getElementById("emptyAccounts"),
    addAccountBtn: document.getElementById("addAccountBtn"),
}

let accounts = null

function setStatus(text, tone = "idle") {
    setStatusChip(els.status, text, tone)
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error)
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
        return null
    }
    const label = name.trim() || "新账号"
    accounts = await createLocalAccount({ label })
    renderAccounts()
    return accounts.owners?.find(owner => accountLabel(owner) === label) ?? currentAccount(accounts)
}

async function renameAccount(id) {
    const owner = accounts.owners.find(item => item.id === id)
    if (!owner) {
        return null
    }
    const previousLabel = accountLabel(owner)
    const name = await promptDialog({
        title: "重命名账号",
        message: `正在修改「${previousLabel}」的显示名称。`,
        label: "账号名称",
        value: previousLabel,
        confirmText: "保存名称",
    })
    if (name === null) {
        return null
    }
    const label = name.trim() || previousLabel
    accounts = await updateLocalAccount(id, { label })
    renderAccounts()
    return { previousLabel, label }
}

async function switchAccount(id) {
    accounts = await switchLocalAccount(id)
    setCurrentAccountId(accounts.currentOwnerId)
    renderAccounts()
    return currentAccount(accounts)
}

async function deleteAccount(id) {
    const owner = accounts.owners.find(item => item.id === id)
    if (!owner) {
        return null
    }
    const label = accountLabel(owner)
    const ok = await confirmDialog({
        title: "删除账号",
        message: `确认删除「${label}」？将删除 ${Number(owner.driveDiscCount ?? 0)} 个驱动盘、${Number(owner.loadoutCount ?? 0)} 个套装预设和 ${Number(owner.importCount ?? 0)} 次导入记录。`,
        confirmText: "删除账号",
        tone: "danger",
    })
    if (!ok) {
        return null
    }
    accounts = await deleteLocalAccount(id)
    deleteOwnerSelection(id)
    renderAccounts()
    return { label }
}

els.addAccountBtn.addEventListener("click", async () => {
    try {
        clearPageNotice()
        setStatus("新增账号", "idle")
        const owner = await addAccount()
        if (owner) {
            setStatus("已新增", "success")
            showSuccessNotice({
                title: "账号已新增",
                message: `已创建「${accountLabel(owner)}」。`,
            })
        } else {
            setStatus("就绪", "idle")
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("新增失败", "error")
        showErrorNotice({
            title: "新增账号失败",
            message,
        })
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
        clearPageNotice()
        setStatus("处理中", "idle")
        if (action === "switch") {
            const owner = await switchAccount(row.dataset.accountId)
            setStatus("已切换", "success")
            showSuccessNotice({
                title: "账号已切换",
                message: `当前账号为「${accountLabel(owner)}」。`,
            })
        } else if (action === "rename") {
            const renamed = await renameAccount(row.dataset.accountId)
            if (renamed) {
                setStatus("已改名", "success")
                showSuccessNotice({
                    title: "账号已改名",
                    message: `「${renamed.previousLabel}」已改为「${renamed.label}」。`,
                })
            } else {
                setStatus("就绪", "idle")
            }
        } else if (action === "delete") {
            const deleted = await deleteAccount(row.dataset.accountId)
            if (deleted) {
                setStatus("已删除", "success")
                showSuccessNotice({
                    title: "账号已删除",
                    message: `「${deleted.label}」及其本地数据已删除。`,
                })
            } else {
                setStatus("就绪", "idle")
            }
        }
    } catch (error) {
        const message = errorMessage(error)
        setStatus("操作失败", "error")
        showErrorNotice({
            title: "账号操作失败",
            message,
        })
    }
})

try {
    setStatus("加载中", "idle")
    await refresh()
    setStatus("就绪", "success")
} catch (error) {
    const message = errorMessage(error)
    setStatus("加载失败", "error")
    showErrorNotice({
        title: "账号加载失败",
        message,
    })
}
