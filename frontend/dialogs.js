function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function ensureDialogRoot() {
    let root = document.getElementById("appDialogRoot")
    if (root) {
        return root
    }
    root = document.createElement("div")
    root.id = "appDialogRoot"
    document.body.appendChild(root)
    return root
}

function closeDialog(layer, resolve, value) {
    layer.remove()
    if (layer.dataset.restoreModalOpen === "true") {
        document.body.classList.add("modal-open")
    } else {
        document.body.classList.remove("modal-open")
    }
    resolve(value)
}

function openDialog({ title, message = "", confirmText = "确认", cancelText = "取消", tone = "default", input = null }) {
    const root = ensureDialogRoot()
    const layer = document.createElement("div")
    layer.className = "modal-layer app-dialog-layer"
    layer.dataset.restoreModalOpen = document.body.classList.contains("modal-open") ? "true" : "false"
    const inputHtml = input
        ? `
            <label class="field app-dialog-field">
              <span>${escapeHtml(input.label ?? "名称")}</span>
              <input id="appDialogInput" value="${escapeHtml(input.value ?? "")}" placeholder="${escapeHtml(input.placeholder ?? "")}" autocomplete="off">
            </label>
        `
        : ""
    layer.innerHTML = `
        <div class="modal-scrim" data-dialog-cancel></div>
        <section class="disc-modal app-dialog app-dialog-${escapeHtml(tone)}" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">
          <button type="button" class="modal-close" aria-label="关闭" data-dialog-cancel>×</button>
          <header class="modal-head">
            <div>
              <h2 id="appDialogTitle">${escapeHtml(title)}</h2>
              ${message ? `<p>${escapeHtml(message)}</p>` : ""}
            </div>
          </header>
          ${inputHtml}
          <div class="modal-actions app-dialog-actions">
            <button type="button" class="ghost-btn" data-dialog-cancel>${escapeHtml(cancelText)}</button>
            <button type="button" class="${tone === "danger" ? "danger-btn" : "primary-btn"}" data-dialog-confirm>${escapeHtml(confirmText)}</button>
          </div>
        </section>
    `
    root.appendChild(layer)
    document.body.classList.add("modal-open")

    return new Promise(resolve => {
        const inputElement = layer.querySelector("#appDialogInput")
        const confirm = () => closeDialog(layer, resolve, input ? inputElement.value : true)
        const cancel = () => closeDialog(layer, resolve, input ? null : false)
        layer.addEventListener("click", event => {
            if (event.target.closest("[data-dialog-confirm]")) {
                confirm()
            } else if (event.target.closest("[data-dialog-cancel]")) {
                cancel()
            }
        })
        layer.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault()
                cancel()
            } else if (event.key === "Enter" && inputElement && event.target === inputElement) {
                event.preventDefault()
                confirm()
            }
        })
        requestAnimationFrame(() => {
            const focusTarget = inputElement ?? layer.querySelector("[data-dialog-confirm]")
            focusTarget?.focus()
            inputElement?.select()
        })
    })
}

export function confirmDialog(options) {
    return openDialog(options)
}

export function promptDialog({ title, message = "", label = "名称", value = "", placeholder = "", confirmText = "保存", cancelText = "取消" }) {
    return openDialog({
        title,
        message,
        confirmText,
        cancelText,
        input: {
            label,
            value,
            placeholder,
        },
    })
}
