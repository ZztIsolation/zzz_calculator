import { buildMeta, normalizeCatalog } from "./calculator-core.js"

let catalogPromise = null
let metaPromise = null

function cloneJson(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value)
    }
    return JSON.parse(JSON.stringify(value))
}

async function requestJson(path) {
    const response = await fetch(path)
    if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed: ${response.status}`)
    }
    return response.json()
}

export async function loadCatalog() {
    if (!catalogPromise) {
        catalogPromise = requestJson("/api/catalog").then(normalizeCatalog)
    }
    return catalogPromise
}

export async function loadMeta() {
    if (!metaPromise) {
        metaPromise = loadCatalog().then(catalog => buildMeta(catalog))
    }
    return metaPromise
}

export async function loadExampleYeShunguang() {
    const catalog = await loadCatalog()
    return cloneJson(catalog.examples?.yeShunguang ?? {})
}
