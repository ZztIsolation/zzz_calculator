const noticeTimers = new WeakMap()

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function ensureNoticeHost(host = null) {
    const existing = host ?? document.querySelector("[data-page-notice]") ?? document.getElementById("pageNotice")
    if (existing) {
        existing.dataset.pageNotice = "true"
        return existing
    }

    const created = document.createElement("div")
    created.id = "pageNotice"
    created.className = "page-notice-host"
    created.dataset.pageNotice = "true"
    created.setAttribute("aria-live", "polite")
    created.hidden = true

    const header = document.querySelector(".content > .page-header")
    if (header) {
        header.insertAdjacentElement("afterend", created)
    } else {
        document.body.prepend(created)
    }
    return created
}

function clearNoticeTimer(host) {
    const timer = noticeTimers.get(host)
    if (timer) {
        window.clearTimeout(timer)
        noticeTimers.delete(host)
    }
}

function normalizeNoticeOptions(options, message = "") {
    if (typeof options === "string") {
        return {
            title: options,
            message,
        }
    }
    return options ?? {}
}

export function setStatusChip(element, text, tone = "idle") {
    if (!element) {
        return
    }
    element.textContent = text
    element.dataset.tone = tone
}

export function clearPageNotice(host = null) {
    const noticeHost = ensureNoticeHost(host)
    clearNoticeTimer(noticeHost)
    noticeHost.innerHTML = ""
    noticeHost.hidden = true
}

export function showPageNotice({
    title,
    message = "",
    tone = "info",
    actions = [],
    persist = null,
    autoDismissMs = null,
    host = null,
} = {}) {
    const noticeHost = ensureNoticeHost(host)
    clearNoticeTimer(noticeHost)

    const normalizedTone = ["success", "error", "warning", "info"].includes(tone) ? tone : "info"
    const noticeActions = Array.isArray(actions) ? actions : []
    const hasActions = noticeActions.length > 0
    const shouldPersist = persist ?? (normalizedTone === "error" || hasActions)
    const dismissMs = autoDismissMs ?? (normalizedTone === "success" ? 10000 : 12000)
    const actionHtml = hasActions
        ? `
            <div class="page-notice-actions">
              ${noticeActions.map((action, index) => `
                <button type="button" class="${action.tone === "primary" ? "primary-btn" : "ghost-btn"}" data-page-notice-action="${index}">
                  ${escapeHtml(action.label)}
                </button>
              `).join("")}
            </div>
        `
        : ""

    noticeHost.innerHTML = `
        <div class="page-notice page-notice-${normalizedTone}" role="status">
          <div class="page-notice-body">
            <strong>${escapeHtml(title ?? "")}</strong>
            ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          </div>
          ${actionHtml}
          <button type="button" class="page-notice-close" aria-label="关闭" data-page-notice-close>×</button>
        </div>
    `
    noticeHost.hidden = false

    noticeHost.querySelector("[data-page-notice-close]")?.addEventListener("click", () => clearPageNotice(noticeHost))
    for (const button of noticeHost.querySelectorAll("[data-page-notice-action]")) {
        button.addEventListener("click", event => {
            const index = Number(event.currentTarget.dataset.pageNoticeAction)
            const action = noticeActions[index]
            action?.onClick?.()
            if (action?.closeOnClick ?? false) {
                clearPageNotice(noticeHost)
            }
        })
    }

    if (!shouldPersist && dismissMs > 0) {
        noticeTimers.set(noticeHost, window.setTimeout(() => clearPageNotice(noticeHost), dismissMs))
    }

    return noticeHost
}

export function showSuccessNotice(options = {}, message = "") {
    const normalized = normalizeNoticeOptions(options, message)
    return showPageNotice({
        ...normalized,
        tone: "success",
    })
}

export function showErrorNotice(options = {}, message = "") {
    const normalized = normalizeNoticeOptions(options, message)
    return showPageNotice({
        ...normalized,
        tone: "error",
        persist: normalized.persist ?? true,
    })
}
