import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
const mockRequireAuth = vi.fn()
const mockRequireAdmin = vi.fn()
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  handleAuthError: (error: unknown) => {
    if (error instanceof Error) {
      if (error.message === "未登录") {
        return Response.json({ error: "未登录" }, { status: 401 })
      }
      if (error.message === "需要管理员权限") {
        return Response.json({ error: "需要管理员权限" }, { status: 403 })
      }
    }
    return null
  },
}))

import { withAuth, withAdmin } from "@/lib/with-auth"

describe("withAuth", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("未登录时返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))

    const handler = vi.fn()
    const wrapped = withAuth(handler)
    const response = await wrapped(new Request("http://localhost/test"), {})

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("已登录时调用 handler 并传入 user", async () => {
    const user = { id: "u1", username: "test", displayName: "Test", role: "user" }
    mockRequireAuth.mockResolvedValue(user)

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const wrapped = withAuth(handler)
    const request = new Request("http://localhost/test")
    const context = { params: { id: "123" } }
    const response = await wrapped(request, context)

    expect(handler).toHaveBeenCalledWith(user, request, context)
    expect(response.status).toBe(200)
  })

  it("handler 抛错时返回 500", async () => {
    const user = { id: "u1", username: "test", displayName: "Test", role: "user" }
    mockRequireAuth.mockResolvedValue(user)

    const handler = vi.fn().mockRejectedValue(new Error("boom"))
    const wrapped = withAuth(handler)
    const response = await wrapped(new Request("http://localhost/test"), {})

    expect(response.status).toBe(500)
  })
})

describe("withAdmin", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("非管理员返回 403", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("需要管理员权限"))

    const handler = vi.fn()
    const wrapped = withAdmin(handler)
    const response = await wrapped(new Request("http://localhost/test"), {})

    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("管理员可正常访问", async () => {
    const user = { id: "u1", username: "admin", displayName: "Admin", role: "admin" }
    mockRequireAdmin.mockResolvedValue(user)

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const wrapped = withAdmin(handler)
    const response = await wrapped(new Request("http://localhost/test"), {})

    expect(handler).toHaveBeenCalledWith(user, expect.anything(), expect.anything())
    expect(response.status).toBe(200)
  })
})
