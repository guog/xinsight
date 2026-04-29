import { describe, test, expect, mock, beforeEach } from "bun:test"
import { fetchWithRetry } from "../fetch-with-retry"

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = originalFetch
})

function mockResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "application/json", ...headers },
  })
}

describe("fetchWithRetry", () => {
  test("successful request returns data", async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockResponse(200, { hello: "world" })))

    const result = await fetchWithRetry("http://example.com/api", { method: "GET" })
    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ hello: "world" })
  })

  test("timeout returns error", async () => {
    globalThis.fetch = mock(() => {
      const err = new DOMException("Signal timed out", "TimeoutError")
      return Promise.reject(err)
    })

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { timeout: 100, maxRetries: 0 },
    )
    expect(result.error).toContain("请求超时")
  })

  test("retries on 500", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount < 3) return Promise.resolve(mockResponse(500))
      return Promise.resolve(mockResponse(200, { ok: true }))
    })

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { maxRetries: 2 },
    )
    expect(result.data).toEqual({ ok: true })
    expect(callCount).toBe(3)
  })

  test("no retry on 400", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      return Promise.resolve(mockResponse(400))
    })

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { maxRetries: 2 },
    )
    expect(result.error).toContain("400")
    expect(callCount).toBe(1)
  })

  test("retries on 429", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount < 2) return Promise.resolve(mockResponse(429))
      return Promise.resolve(mockResponse(200, { done: true }))
    })

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { maxRetries: 2 },
    )
    expect(result.data).toEqual({ done: true })
    expect(callCount).toBe(2)
  })

  test("max retries exhausted returns error", async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockResponse(500)))

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { maxRetries: 2 },
    )
    expect(result.error).toContain("500")
  })

  test("no retry when allowRetry is false", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      return Promise.resolve(mockResponse(500))
    })

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "POST" },
      { maxRetries: 2, allowRetry: false },
    )
    expect(result.error).toContain("500")
    expect(callCount).toBe(1)
  })

  test("response size limit (content-length > 5MB)", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(mockResponse(200, {}, { "content-length": "6000000" })),
    )

    const result = await fetchWithRetry(
      "http://example.com/api",
      { method: "GET" },
      { maxRetries: 0 },
    )
    expect(result.error).toContain("5MB")
  })
})
