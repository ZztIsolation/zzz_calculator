import { afterEach, describe, expect, it, vi } from "vitest"
import { importEnkaShowcase } from "@/utils/enkaImport"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("importEnkaShowcase", () => {
  it("preserves structured throttling details and the Retry-After header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      code: "IP_RATE_LIMITED",
      error: "请求过于频繁",
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "7" },
    })))

    await expect(importEnkaShowcase("1302309616")).rejects.toMatchObject({
      message: "请求过于频繁",
      code: "IP_RATE_LIMITED",
      status: 429,
      retryAfter: 7,
    })
  })

  it("uses the structured retryAfter value returned by the service", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      code: "UPSTREAM_BUSY",
      error: "服务繁忙",
      retryAfter: 11,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Retry-After": "30" },
    })))

    await expect(importEnkaShowcase("1302309616")).rejects.toMatchObject({
      code: "UPSTREAM_BUSY",
      status: 503,
      retryAfter: 11,
    })
  })
})
