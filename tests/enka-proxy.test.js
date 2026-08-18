import assert from "node:assert/strict"

import {
  createEnkaProxy,
  EnkaProxyError,
  fetchEnkaShowcase,
  validateEnkaUid,
} from "../backend/enkaProxy.js"

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

assert.equal(validateEnkaUid("1308423785"), "1308423785")
assert.equal(validateEnkaUid(" 1308423785 "), "1308423785")
assert.throws(() => validateEnkaUid("123"), error => error instanceof EnkaProxyError && error.code === "INVALID_UID")

const fakeShowcase = { ttl: 120, PlayerInfo: { ShowcaseDetail: { AvatarList: [] } } }
const okResult = await fetchEnkaShowcase("1308423785", {
  fetchImpl: async (url, init) => {
    assert.equal(String(url), "https://enka.network/api/zzz/uid/1308423785")
    assert.equal(init.method, "GET")
    assert.equal(init.redirect, "error")
    assert.match(String(init.headers["User-Agent"]), /zzz_calculator/)
    return jsonResponse(fakeShowcase)
  },
})
assert.deepEqual(okResult.showcase, fakeShowcase)
assert.equal(okResult.ttlSeconds, 120)

await assert.rejects(
  fetchEnkaShowcase("1308423785", { fetchImpl: async () => jsonResponse({}, { status: 404 }) }),
  error => error instanceof EnkaProxyError && error.status === 404 && error.code === "UPSTREAM_404",
)
await assert.rejects(
  fetchEnkaShowcase("1308423785", {
    maxBodyBytes: 32,
    fetchImpl: async () => new Response("x".repeat(64), { status: 200 }),
  }),
  error => error instanceof EnkaProxyError && error.code === "BODY_TOO_LARGE",
)
await assert.rejects(
  fetchEnkaShowcase("1308423785", { fetchImpl: async () => new Response("not-json", { status: 200 }) }),
  error => error instanceof EnkaProxyError && error.code === "INVALID_JSON",
)

await assert.rejects(
  fetchEnkaShowcase("1308423785", { timeoutMs: 10, fetchImpl: async () => new Promise(() => {}) }),
  error => error instanceof EnkaProxyError && error.code === "CONNECT_TIMEOUT",
)
await assert.rejects(
  fetchEnkaShowcase("1308423785", {
    timeoutMs: 10,
    fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { status: 200 }),
  }),
  error => error instanceof EnkaProxyError && error.code === "BODY_TIMEOUT",
)

let timestamp = Date.parse("2026-08-18T00:00:00.000Z")
let upstreamCalls = 0
const cachedProxy = createEnkaProxy({
  now: () => timestamp,
  fetchImpl: async () => {
    upstreamCalls += 1
    return jsonResponse({ ...fakeShowcase, ttl: 2 })
  },
})
const first = await cachedProxy.request("1308423785", { ip: "127.0.0.1" })
const cached = await cachedProxy.request("1308423785", { ip: "127.0.0.1" })
assert.equal(first.cache.hit, false)
assert.equal(cached.cache.hit, true)
assert.equal(upstreamCalls, 1)
timestamp += 2100
await cachedProxy.request("1308423785", { ip: "127.0.0.1" })
assert.equal(upstreamCalls, 2)

let resolveInflight
let inflightCalls = 0
const inflightProxy = createEnkaProxy({
  fetchImpl: async () => {
    inflightCalls += 1
    await new Promise(resolve => { resolveInflight = resolve })
    return jsonResponse(fakeShowcase)
  },
})
const inA = inflightProxy.request("1308423785", { ip: "a" })
const inB = inflightProxy.request("1308423785", { ip: "b" })
await new Promise(resolve => setImmediate(resolve))
resolveInflight()
await Promise.all([inA, inB])
assert.equal(inflightCalls, 1)
assert.equal(inflightProxy.metrics().inflightHits, 1)

let notFoundCalls = 0
const notFoundProxy = createEnkaProxy({
  fetchImpl: async () => {
    notFoundCalls += 1
    return jsonResponse({}, { status: 404 })
  },
})
await assert.rejects(notFoundProxy.request("1308423785", { ip: "a" }), error => error.status === 404)
await assert.rejects(notFoundProxy.request("1308423785", { ip: "a" }), error => error.status === 404)
assert.equal(notFoundCalls, 1)

const ipLimited = createEnkaProxy({ perIpLimit: 1, fetchImpl: async () => jsonResponse(fakeShowcase) })
await ipLimited.request("1308423785", { ip: "limited" })
await assert.rejects(
  ipLimited.request("1308423785", { ip: "limited" }),
  error => error instanceof EnkaProxyError && error.code === "IP_RATE_LIMIT" && error.retryAfter >= 1,
)

const globallyLimited = createEnkaProxy({ globalLimit: 1, fetchImpl: async () => jsonResponse(fakeShowcase) })
await globallyLimited.request("1308423785", { ip: "a" })
await assert.rejects(
  globallyLimited.request("1308423786", { ip: "b" }),
  error => error instanceof EnkaProxyError && error.code === "GLOBAL_RATE_LIMIT",
)

let releaseQueue
const queueProxy = createEnkaProxy({
  maxConcurrent: 1,
  maxQueue: 0,
  fetchImpl: async () => {
    await new Promise(resolve => { releaseQueue = resolve })
    return jsonResponse(fakeShowcase)
  },
})
const queuedFirst = queueProxy.request("1308423785", { ip: "a" })
await new Promise(resolve => setImmediate(resolve))
await assert.rejects(
  queueProxy.request("1308423786", { ip: "b" }),
  error => error instanceof EnkaProxyError && error.code === "QUEUE_FULL" && error.status === 503,
)
releaseQueue()
await queuedFirst

console.log("enka-proxy.test.js: all assertions passed")
