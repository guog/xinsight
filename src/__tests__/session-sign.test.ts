import { describe, test, expect, vi, beforeEach } from "vitest"

// 设置环境变量
vi.stubEnv("SESSION_SECRET", "test-secret-key-for-hmac-signing-1234")

import { signSessionId, verifySessionCookie } from "@/lib/session-sign"

describe("session-sign 签名与验证", () => {
  test("signSessionId 生成 sessionId.signature 格式", async () => {
    const signed = await signSessionId("abc-123")
    expect(signed).toMatch(/^abc-123\.[0-9a-f]{64}$/)
  })

  test("verifySessionCookie 验证合法签名返回 sessionId", async () => {
    const signed = await signSessionId("my-session-id")
    const result = await verifySessionCookie(signed)
    expect(result).toBe("my-session-id")
  })

  test("verifySessionCookie 对篡改签名返回 null", async () => {
    const signed = await signSessionId("my-session-id")
    const tampered = signed.slice(0, -1) + "0"
    const result = await verifySessionCookie(tampered)
    expect(result).toBeNull()
  })

  test("verifySessionCookie 对篡改 sessionId 返回 null", async () => {
    const signed = await signSessionId("my-session-id")
    const tampered = "hacked-id" + signed.slice(signed.indexOf("."))
    const result = await verifySessionCookie(tampered)
    expect(result).toBeNull()
  })

  test("verifySessionCookie 无点号分隔返回 null", async () => {
    const result = await verifySessionCookie("no-dot-separator")
    expect(result).toBeNull()
  })

  test("verifySessionCookie 空字符串返回 null", async () => {
    const result = await verifySessionCookie("")
    expect(result).toBeNull()
  })

  test("verifySessionCookie 签名格式错误返回 null", async () => {
    const result = await verifySessionCookie("session-id.not-hex!")
    expect(result).toBeNull()
  })
})
