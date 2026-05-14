import { describe, it, expect } from "vitest"
import { isRetryableError } from "@/lib/retry-utils"

describe("isRetryableError", () => {
  it("速率限制错误可重试", () => {
    expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true)
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true)
    expect(isRetryableError({ message: "too many requests", status: 429 })).toBe(true)
  })

  it("超时错误可重试", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true)
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true)
    expect(isRetryableError(new Error("connection timed out"))).toBe(true)
  })

  it("网络错误可重试", () => {
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true)
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true)
    expect(isRetryableError(new Error("fetch failed"))).toBe(true)
  })

  it("503 服务不可用可重试", () => {
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true)
    expect(isRetryableError({ status: 503 })).toBe(true)
    expect(isRetryableError({ statusCode: 502 })).toBe(true)
  })

  it("认证错误不可重试", () => {
    expect(isRetryableError(new Error("401 Unauthorized"))).toBe(false)
    expect(isRetryableError(new Error("Invalid API key"))).toBe(false)
  })

  it("模型不存在错误不可重试", () => {
    expect(isRetryableError(new Error("Model not found"))).toBe(false)
    expect(isRetryableError(new Error("404 Not Found"))).toBe(false)
  })

  it("空值不可重试", () => {
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(undefined)).toBe(false)
  })
})
