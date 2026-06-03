export function createImageSelect({
    select,
    items = [],
    selectedId = "",
    getLabel = item => item?.name ?? item?.id ?? "-",
    getImage = () => "",
    getFallbackImage = () => "",
    className = "",
} = {}) {
    if (!select) {
        return null
    }

    let root = select.nextElementSibling?.classList?.contains("image-select")
        ? select.nextElementSibling
        : null
    if (!root) {
        root = document.createElement("div")
        select.insertAdjacentElement("afterend", root)
    } else if (root.__imageSelectCleanup) {
        root.__imageSelectCleanup()
    }

    const normalizedItems = Array.isArray(items) ? items : []
    const currentId = normalizedItems.some(item => item?.id === selectedId)
        ? selectedId
        : normalizedItems[0]?.id ?? ""
    const selectedItem = normalizedItems.find(item => item?.id === currentId) ?? normalizedItems[0] ?? null
    const rootId = select.id ? `${select.id}ImageSelect` : `imageSelect${Math.random().toString(36).slice(2)}`
    const listId = `${rootId}List`
    const open = root.classList.contains("open")
    const selectedLabel = selectedItem ? getLabel(selectedItem) : "-"

    select.classList.add("native-image-select")
    root.className = ["image-select", className, open ? "open" : ""].filter(Boolean).join(" ")
    root.dataset.value = currentId
    root.innerHTML = `
        <button class="image-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="${open}" aria-controls="${listId}">
            ${imageMarkup(selectedItem, getImage, getFallbackImage, selectedLabel, "image-select-trigger-icon")}
            <span class="image-select-trigger-label">${escapeHtml(selectedLabel)}</span>
            <span class="image-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="image-select-list" id="${listId}" role="listbox" tabindex="-1">
            ${normalizedItems.map(itemMarkup(currentId, getLabel, getImage, getFallbackImage)).join("")}
        </div>
    `

    const trigger = root.querySelector(".image-select-trigger")
    const list = root.querySelector(".image-select-list")

    function close() {
        root.classList.remove("open")
        trigger.setAttribute("aria-expanded", "false")
    }

    function openList() {
        root.classList.add("open")
        trigger.setAttribute("aria-expanded", "true")
        const active = list.querySelector(".image-select-option.active") ?? list.querySelector(".image-select-option")
        active?.scrollIntoView({ block: "nearest" })
    }

    function choose(id) {
        if (!id || select.value === id) {
            close()
            return
        }
        select.value = id
        root.classList.remove("open")
        createImageSelect({
            select,
            items: normalizedItems,
            selectedId: id,
            getLabel,
            getImage,
            getFallbackImage,
            className,
        })
        select.dispatchEvent(new Event("change", { bubbles: true }))
        root.querySelector(".image-select-trigger")?.focus()
    }

    trigger.addEventListener("click", () => {
        if (root.classList.contains("open")) {
            close()
        } else {
            openList()
        }
    })

    const rootClickHandler = event => {
        const option = event.target.closest(".image-select-option")
        if (!option) {
            return
        }
        choose(option.dataset.value)
    }

    const rootKeydownHandler = event => {
        const options = [...root.querySelectorAll(".image-select-option")]
        if (!options.length) {
            return
        }

        const activeIndex = Math.max(0, options.findIndex(option => option.classList.contains("active")))
        const focusOption = index => {
            options.forEach(option => option.classList.remove("active"))
            const next = options[Math.max(0, Math.min(options.length - 1, index))]
            next.classList.add("active")
            next.scrollIntoView({ block: "nearest" })
        }

        if (event.key === "ArrowDown") {
            event.preventDefault()
            openList()
            focusOption(activeIndex + 1)
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            openList()
            focusOption(activeIndex - 1)
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (!root.classList.contains("open")) {
                openList()
                return
            }
            choose(options[activeIndex]?.dataset.value)
        } else if (event.key === "Escape") {
            event.preventDefault()
            close()
        }
    }

    const outsideHandler = event => {
        if (!root.contains(event.target)) {
            close()
        }
    }
    root.addEventListener("click", rootClickHandler)
    root.addEventListener("keydown", rootKeydownHandler)
    root.addEventListener("error", imageErrorHandler, true)
    document.addEventListener("click", outsideHandler, { capture: true })
    root.__imageSelectCleanup = () => {
        root.removeEventListener("click", rootClickHandler)
        root.removeEventListener("keydown", rootKeydownHandler)
        root.removeEventListener("error", imageErrorHandler, true)
        document.removeEventListener("click", outsideHandler, { capture: true })
    }

    return {
        root,
        destroy() {
            root.__imageSelectCleanup?.()
            delete root.__imageSelectCleanup
            root.remove()
            select.classList.remove("native-image-select")
        },
        refresh(nextOptions = {}) {
            return createImageSelect({
                select,
                items,
                selectedId: select.value,
                getLabel,
                getImage,
                getFallbackImage,
                className,
                ...nextOptions,
            })
        },
    }
}

function imageErrorHandler(event) {
    const img = event.target?.closest?.("img[data-fallback-src]")
    if (!img || !img.dataset.fallbackSrc || img.src === img.dataset.fallbackSrc) {
        return
    }
    img.src = img.dataset.fallbackSrc
}

function itemMarkup(selectedId, getLabel, getImage, getFallbackImage) {
    return item => {
        const selected = item?.id === selectedId
        const label = getLabel(item)
        return `
            <button class="image-select-option${selected ? " selected active" : ""}" type="button" role="option" aria-selected="${selected}" data-value="${escapeHtml(item?.id ?? "")}">
                ${imageMarkup(item, getImage, getFallbackImage, label, "image-select-option-icon")}
                <span class="image-select-option-label">${escapeHtml(label)}</span>
            </button>
        `
    }
}

function imageMarkup(item, getImage, getFallbackImage, label, className) {
    const src = getImage(item) || getFallbackImage(item)
    const fallback = getFallbackImage(item)
    if (!src) {
        return `<span class="${className} image-select-icon-fallback" aria-hidden="true"></span>`
    }
    return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" data-fallback-src="${escapeHtml(fallback)}">`
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}
