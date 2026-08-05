// Server-side proxy for the Enka Network ZZZ showcase API.
// Browser pages cannot call enka.network directly (CORS + User-Agent),
// so the webapp fetches showcase data through this same-origin proxy.

const ENKA_HOST = "enka.network"
const UID_PATTERN = /^\d{8,12}$/
const REQUEST_TIMEOUT_MS = 20_000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const USER_AGENT = "zzz_calculator enka-import"

export class EnkaProxyError extends Error {
    constructor(message, { status = 502 } = {}) {
        super(message)
        this.name = "EnkaProxyError"
        this.status = status
    }
}

export function validateEnkaUid(uid) {
    const normalized = String(uid ?? "").trim()
    if (!UID_PATTERN.test(normalized)) {
        throw new EnkaProxyError("UID 必须是 8–12 位数字。", { status: 400 })
    }
    return normalized
}

function enkaErrorMessage(status) {
    if (status === 400) return "Enka 拒绝了该 UID 格式。"
    if (status === 404) return "Enka 未找到该玩家，或角色展柜未公开。"
    if (status === 424) return "游戏或 Enka 正在维护，请稍后重试。"
    if (status === 429) return "Enka 请求过于频繁，请等待冷却后重试。"
    if (status >= 500) return "Enka 服务暂时不可用，请稍后重试。"
    return `Enka 请求失败（HTTP ${status || "未知"}）。`
}

export async function fetchEnkaShowcase(uid, options = {}) {
    const normalized = validateEnkaUid(uid)
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    if (typeof fetchImpl !== "function") {
        throw new EnkaProxyError("服务端 fetch 不可用。")
    }
    const url = options.url ?? `https://${ENKA_HOST}/api/zzz/uid/${encodeURIComponent(normalized)}`
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
    const signal = AbortSignal.timeout(timeoutMs)

    let response
    try {
        response = await fetchImpl(url, {
            method: "GET",
            redirect: "error",
            signal,
            headers: {
                Accept: "application/json",
                "User-Agent": USER_AGENT,
            },
        })
    } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            throw new EnkaProxyError("Enka 请求超时，请稍后重试。", { status: 504 })
        }
        throw new EnkaProxyError("无法连接 Enka，请稍后重试。")
    }

    const status = Number(response.status) || 0
    if (!response.ok) {
        throw new EnkaProxyError(enkaErrorMessage(status), { status })
    }
    const length = Number(response.headers?.get("content-length") ?? 0)
    if (length > MAX_BODY_BYTES) {
        throw new EnkaProxyError("Enka 返回过大，已拒绝。")
    }
    try {
        return await response.json()
    } catch {
        throw new EnkaProxyError("Enka 返回的不是有效 JSON。")
    }
}
