const ENKA_HOST = "enka.network"
const UID_PATTERN = /^\d{8,12}$/
const REQUEST_TIMEOUT_MS = 20_000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const USER_AGENT = "zzz_calculator enka-import"

export class EnkaProxyError extends Error {
  constructor(message, { status = 502, retryAfter = null, code = "ENKA_UPSTREAM_ERROR" } = {}) {
    super(message)
    this.name = "EnkaProxyError"
    this.status = status
    this.retryAfter = retryAfter
    this.code = code
  }
}

export function validateEnkaUid(uid) {
  const normalized = String(uid ?? "").trim()
  if (!UID_PATTERN.test(normalized)) {
    throw new EnkaProxyError("UID 必须是 8–12 位数字。", { status: 400, code: "INVALID_UID" })
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

async function readResponseBytes(response, maxBytes) {
  const chunks = []
  let total = 0
  const append = chunk => {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    total += bytes.byteLength
    if (total > maxBytes) {
      throw new EnkaProxyError("Enka 返回过大，已拒绝。", { status: 502, code: "BODY_TOO_LARGE" })
    }
    chunks.push(bytes)
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      append(value)
    }
  } else if (typeof response.arrayBuffer === "function") {
    append(await response.arrayBuffer())
  } else if (typeof response.text === "function") {
    append(new TextEncoder().encode(await response.text()))
  } else if (typeof response.json === "function") {
    append(new TextEncoder().encode(JSON.stringify(await response.json())))
  } else {
    throw new EnkaProxyError("Enka 返回的正文不可读取。", { code: "INVALID_BODY" })
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function headerValue(headers, name) {
  return String(headers?.get?.(name) ?? headers?.get?.(name.toLowerCase()) ?? "")
}

function responseTtlSeconds(showcase, headers) {
  const cacheControl = headerValue(headers, "cache-control")
  const headerTtl = Number(/(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl)?.[1])
  const bodyTtl = Number(showcase?.ttl)
  const requested = Number.isFinite(bodyTtl) && bodyTtl > 0
    ? bodyTtl
    : Number.isFinite(headerTtl) && headerTtl > 0 ? headerTtl : 60
  return Math.max(1, Math.min(300, Math.trunc(requested)))
}

export async function fetchEnkaShowcase(uid, options = {}) {
  const normalized = validateEnkaUid(uid)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== "function") throw new EnkaProxyError("服务端 fetch 不可用。")
  const baseUrl = String(options.baseUrl ?? `https://${ENKA_HOST}/api/zzz/uid`).replace(/\/$/, "")
  const url = options.url ?? `${baseUrl}/${encodeURIComponent(normalized)}`
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES
  const controller = new AbortController()
  let phase = "connect"
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new EnkaProxyError(
        phase === "connect" ? "连接 Enka 超时，请稍后重试。" : "读取 Enka 响应超时，请稍后重试。",
        { status: 504, code: phase === "connect" ? "CONNECT_TIMEOUT" : "BODY_TIMEOUT" },
      ))
    }, timeoutMs)
  })

  try {
    let response
    try {
      response = await Promise.race([
        fetchImpl(url, {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        }),
        timeout,
      ])
    } catch (error) {
      if (error instanceof EnkaProxyError) throw error
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new EnkaProxyError("连接 Enka 超时，请稍后重试。", { status: 504, code: "CONNECT_TIMEOUT" })
      }
      throw new EnkaProxyError("无法连接 Enka，请稍后重试。", { code: "CONNECT_FAILED" })
    }

    const status = Number(response.status) || 0
    if (!response.ok) {
      const retryAfter = Math.max(1, Number(headerValue(response.headers, "retry-after")) || (status === 429 ? 60 : 0)) || null
      throw new EnkaProxyError(enkaErrorMessage(status), { status, retryAfter, code: `UPSTREAM_${status || "ERROR"}` })
    }

    phase = "body"
    const bytes = await Promise.race([readResponseBytes(response, maxBodyBytes), timeout])
    let showcase
    try {
      showcase = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      throw new EnkaProxyError("Enka 返回的不是有效 JSON。", { code: "INVALID_JSON" })
    }
    return { showcase, ttlSeconds: responseTtlSeconds(showcase, response.headers) }
  } finally {
    clearTimeout(timeoutId)
  }
}

function cloneError(error) {
  return new EnkaProxyError(error.message, {
    status: error.status,
    retryAfter: error.retryAfter,
    code: error.code,
  })
}

export function createEnkaProxy(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const now = options.now ?? (() => Date.now())
  const perIpLimit = options.perIpLimit ?? 10
  const globalLimit = options.globalLimit ?? 60
  const windowMs = options.windowMs ?? 60_000
  const maxConcurrent = options.maxConcurrent ?? 4
  const maxQueue = options.maxQueue ?? 32
  const notFoundTtlMs = options.notFoundTtlMs ?? 30_000
  const cache = new Map()
  const inflight = new Map()
  const ipWindows = new Map()
  const globalRequests = []
  const queue = []
  let active = 0
  let ipWindowChecks = 0
  const metrics = {
    requests: 0,
    cacheHits: 0,
    inflightHits: 0,
    upstreamRequests: 0,
    upstreamErrors: 0,
    rateLimited: 0,
    queueRejected: 0,
  }

  function rateLimitIp(ip) {
    const timestamp = now()
    ipWindowChecks += 1
    if (ipWindows.size >= 1024 && ipWindowChecks % 128 === 0) {
      for (const [windowIp, window] of ipWindows) {
        if (timestamp - window.startedAt >= windowMs) ipWindows.delete(windowIp)
      }
    }
    const key = String(ip || "unknown")
    let entry = ipWindows.get(key)
    if (!entry || timestamp - entry.startedAt >= windowMs) entry = { startedAt: timestamp, count: 0 }
    entry.count += 1
    ipWindows.set(key, entry)
    if (entry.count > perIpLimit) {
      metrics.rateLimited += 1
      const retryAfter = Math.max(1, Math.ceil((entry.startedAt + windowMs - timestamp) / 1000))
      throw new EnkaProxyError("请求过于频繁，请稍后重试。", { status: 429, retryAfter, code: "IP_RATE_LIMIT" })
    }
  }

  function rateLimitGlobal() {
    const timestamp = now()
    while (globalRequests.length && timestamp - globalRequests[0] >= windowMs) globalRequests.shift()
    if (globalRequests.length >= globalLimit) {
      metrics.rateLimited += 1
      const retryAfter = Math.max(1, Math.ceil((globalRequests[0] + windowMs - timestamp) / 1000))
      throw new EnkaProxyError("Enka 上游请求额度暂时用尽，请稍后重试。", { status: 429, retryAfter, code: "GLOBAL_RATE_LIMIT" })
    }
    globalRequests.push(timestamp)
  }

  async function acquire() {
    if (active < maxConcurrent) {
      active += 1
      return
    }
    if (queue.length >= maxQueue) {
      metrics.queueRejected += 1
      throw new EnkaProxyError("Enka 请求队列已满，请稍后重试。", { status: 503, retryAfter: 5, code: "QUEUE_FULL" })
    }
    await new Promise(resolve => queue.push(resolve))
    active += 1
  }

  function release() {
    active = Math.max(0, active - 1)
    queue.shift()?.()
  }

  async function upstream(uid) {
    rateLimitGlobal()
    await acquire()
    metrics.upstreamRequests += 1
    try {
      const result = await fetchEnkaShowcase(uid, { ...options, fetchImpl })
      const expiresAt = now() + result.ttlSeconds * 1000
      cache.set(uid, { ...result, expiresAt })
      return { ...result, cache: { hit: false, expiresAt: new Date(expiresAt).toISOString() } }
    } catch (error) {
      metrics.upstreamErrors += 1
      if (error instanceof EnkaProxyError && error.status === 404) {
        cache.set(uid, { error: cloneError(error), expiresAt: now() + notFoundTtlMs })
      }
      throw error
    } finally {
      release()
    }
  }

  return {
    async request(uid, { ip = "unknown" } = {}) {
      metrics.requests += 1
      rateLimitIp(ip)
      const normalized = validateEnkaUid(uid)
      const cached = cache.get(normalized)
      if (cached && cached.expiresAt > now()) {
        metrics.cacheHits += 1
        if (cached.error) throw cloneError(cached.error)
        return {
          showcase: cached.showcase,
          ttlSeconds: Math.max(0, Math.ceil((cached.expiresAt - now()) / 1000)),
          cache: { hit: true, expiresAt: new Date(cached.expiresAt).toISOString() },
        }
      }
      if (cached) cache.delete(normalized)
      if (inflight.has(normalized)) {
        metrics.inflightHits += 1
        return inflight.get(normalized)
      }
      const request = upstream(normalized).finally(() => inflight.delete(normalized))
      inflight.set(normalized, request)
      return request
    },
    metrics() {
      return { ...metrics, cacheEntries: cache.size, active, queued: queue.length }
    },
    clear() {
      cache.clear()
      ipWindows.clear()
      globalRequests.length = 0
    },
  }
}
