import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock rate-limit
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  cleanExpiredRateLimits: vi.fn(),
  LOGIN_RATE_LIMIT: { windowMs: 60000, max: 5, lockoutMs: 900000 },
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  loginUser: vi.fn(),
  getSessionCookieOptions: vi.fn(() => ({
    name: "xinsight_session",
    value: "sess-123",
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 86400,
  })),
}))

import { loginUser } from "@/lib/auth"
const mockLoginUser = vi.mocked(loginUser)

describe("POST /api/auth/login 速率限制", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockLoginUser.mockRejectedValue(new Error("用户名或密码错误"))
    mockCheckRateLimit.mockReturnValue(false)
  })

  function makeRequest(body: object, ip = "1.2.3.4") {
    return new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    })
  }

  it("未被限制时正常返回 401（登录失败）", async () => {
    const { POST } = await import("@/app/api/auth/login/route")
    const res = await POST(makeRequest({ username: "admin", password: "wrong" }))
    expect(res.status).toBe(401)
  })

  it("被速率限制时返回 429", async () => {
    mockCheckRateLimit.mockReturnValue(true)
    const { POST } = await import("@/app/api/auth/login/route")
    const res = await POST(makeRequest({ username: "admin", password: "wrong" }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain("频繁")
  })

  it("checkRateLimit 接收正确的 IP 和 action", async () => {
    const { POST } = await import("@/app/api/auth/login/route")
    await POST(makeRequest({ username: "admin", password: "wrong" }, "10.0.0.1"))
    expect(mockCheckRateLimit).toHaveBeenCalledWith("10.0.0.1", "login", expect.any(Object))
  })
})
