import assert from "node:assert/strict"
import { EnkaProxyError, fetchEnkaShowcase, validateEnkaUid } from "../backend/enkaProxy.js"

// UID validation
assert.equal(validateEnkaUid("1308423785"), "1308423785")
assert.equal(validateEnkaUid("  1308423785  "), "1308423785")
assert.throws(() => validateEnkaUid("123"), EnkaProxyError)
assert.throws(() => validateEnkaUid("abc"), EnkaProxyError)

// Successful fetch passthrough (injected fetchImpl, no network)
const fakeShowcase = { ttl: 60, PlayerInfo: { ShowcaseDetail: { AvatarList: [] } } }
const okResult = await fetchEnkaShowcase("1308423785", {
    fetchImpl: async (url, init) => {
        assert.match(String(url), /^https:\/\/enka\.network\/api\/zzz\/uid\/1308423785$/)
        assert.equal(init.method, "GET")
        assert.equal(init.redirect, "error")
        assert.match(String(init.headers["User-Agent"]), /zzz_calculator/)
        return { ok: true, status: 200, headers: new Map(), json: async () => fakeShowcase }
    },
})
assert.deepEqual(okResult, fakeShowcase)

// Enka error statuses map to friendly messages
async function expectEnkaError(status, expectedMessage) {
    await assert.rejects(
        fetchEnkaShowcase("1308423785", {
            fetchImpl: async () => ({ ok: false, status, headers: new Map(), json: async () => ({}) }),
        }),
        error => error instanceof EnkaProxyError && error.status === status && error.message === expectedMessage,
    )
}
await expectEnkaError(404, "Enka 未找到该玩家，或角色展柜未公开。")
await expectEnkaError(429, "Enka 请求过于频繁，请等待冷却后重试。")
await expectEnkaError(500, "Enka 服务暂时不可用，请稍后重试。")

// Non-JSON body is rejected
await assert.rejects(
    fetchEnkaShowcase("1308423785", {
        fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => { throw new Error("bad") } }),
    }),
    error => error instanceof EnkaProxyError && /有效 JSON/.test(error.message),
)

console.log("enka-proxy.test.js: all assertions passed")
