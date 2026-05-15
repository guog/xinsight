import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth 模块
const mockRequireAuth = vi.fn()
const mockRequireAdmin = vi.fn()
const mockHandleAuthError = vi.fn()

vi.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
  requireAdmin: () => mockRequireAdmin(),
  handleAuthError: (e: unknown) => mockHandleAuthError(e),
}))

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}))

import { withAuth, withAdmin } from "@/lib/with-auth"

describe("withAuth / withAdmin 高阶函数", () => {
  const mockUser = { id: "u1", username: "admin", displayName: "Admin", role: "admin" }
  const mockRequest = new Request("http://localhost/api/test")

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("withAuth", () => {
    it("认证成功时调用 handler", async () => {
      mockRequireAuth.mockResolvedValue(mockUser)
      const handler = vi.fn().mockResolvedValue(new Response("ok"))
      const wrapped = withAuth(handler)
      const res = await wrapped(mockRequest, {})
      expect(handler).toHaveBeenCalledWith(mockUser, mockRequest, {})
      expect(res.status).toBe(200)
    })

    it("认证失败且 handleAuthError 返回响应", async () => {
      const authError = new Error("未登录")
      mockRequireAuth.mockRejectedValue(authError)
      mockHandleAuthError.mockReturnValue(new Response("unauthorized", { status: 401 }))
      const handler = vi.fn()
      const wrapped = withAuth(handler)
      const res = await wrapped(mockRequest, {})
      expect(handler).not.toHaveBeenCalled()
      expect(res.status).toBe(401)
    })

    it("认证失败且 handleAuthError 返回 falsy 时抛出并返回 500", async () => {
      const authError = new Error("未知错误")
      mockRequireAuth.mockRejectedValue(authError)
      mockHandleAuthError.mockReturnValue(null)
      const handler = vi.fn()
      const wrapped = withAuth(handler)
      const res = await wrapped(mockRequest, {})
      expect(res.status).toBe(500)
    })

    it("handler 抛出异常时返回 500", async () => {
      mockRequireAuth.mockResolvedValue(mockUser)
      const handler = vi.fn().mockRejectedValue(new Error("boom"))
      const wrapped = withAuth(handler)
      const res = await wrapped(mockRequest, {})
      expect(res.status).toBe(500)
    })
  })

  describe("withAdmin", () => {
    it("管理员认证成功时调用 handler", async () => {
      mockRequireAdmin.mockResolvedValue(mockUser)
      const handler = vi.fn().mockResolvedValue(new Response("ok"))
      const wrapped = withAdmin(handler)
      const res = await wrapped(mockRequest, {})
      expect(handler).toHaveBeenCalledWith(mockUser, mockRequest, {})
    })

    it("非管理员时返回权限错误", async () => {
      const authError = new Error("权限不足")
      mockRequireAdmin.mockRejectedValue(authError)
      mockHandleAuthError.mockReturnValue(new Response("forbidden", { status: 403 }))
      const handler = vi.fn()
      const wrapped = withAdmin(handler)
      const res = await wrapped(mockRequest, {})
      expect(handler).not.toHaveBeenCalled()
      expect(res.status).toBe(403)
    })
  })
})
