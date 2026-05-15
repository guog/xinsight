import { describe, it, expect } from "vitest"
import { isRetryableError } from "@/lib/retry-utils"

describe("isRetryableError", () => {
  it("返回 false 对于 null/undefined", () => {
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(undefined)).toBe(false)
  })

  it("识别 429 速率限制", () => {
    expect(isRetryableError(new Error("HTTP 429 Too Many Requests"))).toBe(true)
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true)
    expect(isRetryableError(new Error("too many requests"))).toBe(true)
  })

  it("识别超时错误", () => {
    expect(isRetryableError(new Error("request timeout"))).toBe(true)
    expect(isRetryableError(new Error("connection timed out"))).toBe(true)
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true)
  })

  it("识别网络错误", () => {
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true)
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true)
    expect(isRetryableError(new Error("fetch failed"))).toBe(true)
    expect(isRetryableError(new Error("network error"))).toBe(true)
  })

  it("识别 503 服务不可用", () => {
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true)
    expect(isRetryableError(new Error("service unavailable"))).toBe(true)
  })

  it("识别 status 属性", () => {
    expect(isRetryableError({ status: 429 })).toBe(true)
    expect(isRetryableError({ status: 503 })).toBe(true)
    expect(isRetryableError({ status: 502 })).toBe(true)
    expect(isRetryableError({ statusCode: 429 })).toBe(true)
  })

  it("返回 false 对于不可重试错误", () => {
    expect(isRetryableError(new Error("invalid input"))).toBe(false)
    expect(isRetryableError(new Error("unauthorized"))).toBe(false)
    expect(isRetryableError({ status: 400 })).toBe(false)
    expect(isRetryableError({ status: 404 })).toBe(false)
  })

  it("处理字符串类型错误", () => {
    expect(isRetryableError("rate limit")).toBe(true)
    expect(isRetryableError("timeout")).toBe(true)
    expect(isRetryableError("normal error")).toBe(false)
  })
})
