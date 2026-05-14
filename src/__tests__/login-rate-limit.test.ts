import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

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
  beforeEach(async () => {
    vi.resetAllMocks()
    mockLoginUser.mockRejectedValue(new Error("用户名或密码错误"))
    // 重置速率限制状态
    const { _resetLoginRateLimit } = await import("@/app/api/auth/login/route")
    _resetLoginRateLimit()
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

  it("前 5 次失败尝试正常返回 401", async () => {
    const { POST } = await import("@/app/api/auth/login/route")

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ username: "admin", password: "wrong" }))
      expect(res.status).toBe(401)
    }
  })

  it("第 6 次尝试返回 429", async () => {
    const { POST } = await import("@/app/api/auth/login/route")

    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ username: "admin", password: "wrong" }))
    }

    const res = await POST(makeRequest({ username: "admin", password: "wrong" }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain("频繁")
  })

  it("不同 IP 独立计数", async () => {
    const { POST } = await import("@/app/api/auth/login/route")

    // IP-A 用完 5 次
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ username: "admin", password: "wrong" }, "10.0.0.1"))
    }
    const resA = await POST(makeRequest({ username: "admin", password: "wrong" }, "10.0.0.1"))
    expect(resA.status).toBe(429)

    // IP-B 仍可尝试
    const resB = await POST(makeRequest({ username: "admin", password: "wrong" }, "10.0.0.2"))
    expect(resB.status).toBe(401)
  })
})
