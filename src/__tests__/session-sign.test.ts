import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("session-sign", () => {
  const MOCK_SECRET = "test-secret-key-for-hmac-signing"

  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", MOCK_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("signSessionId 返回 sessionId.signature 格式", async () => {
    const { signSessionId } = await import("@/lib/session-sign")
    const result = await signSessionId("abc-123")
    expect(result).toContain(".")
    const [id, sig] = result.split(".")
    expect(id).toBe("abc-123")
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it("相同输入产生相同签名", async () => {
    const { signSessionId } = await import("@/lib/session-sign")
    const r1 = await signSessionId("session-1")
    const r2 = await signSessionId("session-1")
    expect(r1).toBe(r2)
  })

  it("不同输入产生不同签名", async () => {
    const { signSessionId } = await import("@/lib/session-sign")
    const r1 = await signSessionId("session-1")
    const r2 = await signSessionId("session-2")
    expect(r1).not.toBe(r2)
  })

  it("verifySessionCookie 验证有效签名", async () => {
    const { signSessionId, verifySessionCookie } = await import("@/lib/session-sign")
    const signed = await signSessionId("my-session-id")
    const result = await verifySessionCookie(signed)
    expect(result).toBe("my-session-id")
  })

  it("verifySessionCookie 拒绝篡改的签名", async () => {
    const { signSessionId, verifySessionCookie } = await import("@/lib/session-sign")
    const signed = await signSessionId("my-session-id")
    const tampered = signed.slice(0, -2) + "ff"
    const result = await verifySessionCookie(tampered)
    expect(result).toBeNull()
  })

  it("verifySessionCookie 拒绝无点号格式", async () => {
    const { verifySessionCookie } = await import("@/lib/session-sign")
    const result = await verifySessionCookie("no-dot-here")
    expect(result).toBeNull()
  })

  it("verifySessionCookie 拒绝非 hex 签名", async () => {
    const { verifySessionCookie } = await import("@/lib/session-sign")
    const result = await verifySessionCookie("session.not-hex-at-all!")
    expect(result).toBeNull()
  })

  it("verifySessionCookie 拒绝空 sessionId", async () => {
    const { verifySessionCookie } = await import("@/lib/session-sign")
    const result = await verifySessionCookie("." + "a".repeat(64))
    expect(result).toBeNull()
  })

  it("SESSION_SECRET 未设置时抛错", async () => {
    vi.stubEnv("SESSION_SECRET", "")
    vi.resetModules()
    const { signSessionId } = await import("@/lib/session-sign")
    await expect(signSessionId("test")).rejects.toThrow("SESSION_SECRET")
  })
})
