import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
const mockRegisterUser = vi.fn()
const mockHasAnyUser = vi.fn()
vi.mock("@/lib/auth", () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
  hasAnyUser: () => mockHasAnyUser(),
}))

// Save original env
const originalEnv = { ...process.env }

describe("/api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    mockHasAnyUser.mockReturnValue(true) // 默认非首个用户
  })

  async function callRegister(body: unknown, ip = "127.0.0.1") {
    const { POST } = await import("@/app/api/auth/register/route")
    const { NextRequest } = await import("next/server")
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  it("密码少于 8 位返回 400", async () => {
    const res = await callRegister({ username: "test", password: "abc123" })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("8")
  })

  it("密码无字母返回 400", async () => {
    const res = await callRegister({ username: "test", password: "12345678" })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("字母")
  })

  it("密码无数字返回 400", async () => {
    const res = await callRegister({ username: "test", password: "abcdefgh" })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("数字")
  })

  it("ALLOW_REGISTRATION=false 且非首个用户返回 403", async () => {
    process.env.ALLOW_REGISTRATION = "false"
    mockHasAnyUser.mockReturnValue(true)
    const res = await callRegister({ username: "test", password: "test1234" })
    expect(res.status).toBe(403)
  })

  it("ALLOW_REGISTRATION=false 但首个用户仍可注册", async () => {
    process.env.ALLOW_REGISTRATION = "false"
    mockHasAnyUser.mockReturnValue(false)
    mockRegisterUser.mockResolvedValue({
      id: "1",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    })
    const res = await callRegister({ username: "admin", password: "admin1234" })
    expect(res.status).toBe(201)
  })

  it("速率限制：同一 IP 超过 3 次返回 429", async () => {
    mockRegisterUser.mockResolvedValue({ id: "1", username: "u", displayName: "u", role: "user" })
    const ip = "10.0.0.99"
    // 前 3 次成功
    for (let i = 0; i < 3; i++) {
      const res = await callRegister({ username: `user${i}`, password: "test1234" }, ip)
      expect(res.status).toBe(201)
    }
    // 第 4 次被限制
    const res = await callRegister({ username: "user4", password: "test1234" }, ip)
    expect(res.status).toBe(429)
  })
})
