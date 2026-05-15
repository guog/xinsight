import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDb, mockCookies } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }
  const mockCookies = { get: vi.fn() }
  return { mockDb, mockCookies }
})

// Mock chain helpers
function chainSelect(result: unknown) {
  const chain = { from: vi.fn(() => ({ where: vi.fn(() => ({ get: vi.fn(() => result), limit: vi.fn(() => ({ get: vi.fn(() => result) })) })) })) }
  mockDb.select.mockReturnValue(chain)
  return chain
}
function chainInsert() {
  const chain = { values: vi.fn(() => ({ run: vi.fn() })) }
  mockDb.insert.mockReturnValue(chain)
  return chain
}
function chainDelete() {
  const chain = { where: vi.fn(() => ({ run: vi.fn() })) }
  mockDb.delete.mockReturnValue(chain)
  return chain
}

vi.mock("@/db", () => ({ db: mockDb }))
vi.mock("@/db/schema", () => ({ users: "users_table", sessions: "sessions_table" }))
vi.mock("drizzle-orm", () => ({ eq: vi.fn((_a, _b) => "eq"), lt: vi.fn((_a, _b) => "lt") }))
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => mockCookies) }))
vi.mock("@/lib/session-sign", () => ({
  signSessionId: vi.fn(async (id: string) => `${id}.sig`),
  verifySessionCookie: vi.fn(async (val: string) => val.includes(".") ? val.split(".")[0] : null),
}))

// Mock Bun.password
vi.stubGlobal("Bun", {
  password: {
    hash: vi.fn(async () => "$2b$10$hashedpassword"),
    verify: vi.fn(async (_pw: string, _hash: string) => true),
  },
})

import { registerUser, loginUser, getCurrentUser, logoutUser, hasAnyUser, requireAuth, requireAdmin, handleAuthError, getSessionCookieOptions, cleanExpiredSessions } from "@/lib/auth"

describe("auth functions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("registerUser", () => {
    it("用户名已存在时抛错", async () => {
      chainSelect({ id: "existing" })
      await expect(registerUser("admin", "pw", "Admin")).rejects.toThrow("用户名已存在")
    })

    it("成功注册返回用户信息", async () => {
      chainSelect(null)
      chainInsert()
      const result = await registerUser("newuser", "pw123", "New User", "admin")
      expect(result.username).toBe("newuser")
      expect(result.role).toBe("admin")
    })
  })

  describe("loginUser", () => {
    it("用户不存在时抛错", async () => {
      chainSelect(null)
      await expect(loginUser("nobody", "pw")).rejects.toThrow("用户名或密码错误")
    })

    it("密码错误时抛错", async () => {
      chainSelect({ id: "u1", username: "admin", passwordHash: "hash", displayName: "A", role: "admin" })
      ;(Bun.password.verify as any).mockResolvedValueOnce(false)
      await expect(loginUser("admin", "wrong")).rejects.toThrow("用户名或密码错误")
    })

    it("成功登录返回 user 和 sessionId", async () => {
      chainSelect({ id: "u1", username: "admin", passwordHash: "hash", displayName: "Admin", role: "admin" })
      chainInsert()
      const result = await loginUser("admin", "correct")
      expect(result.user.username).toBe("admin")
      expect(result.sessionId).toBeDefined()
    })
  })

  describe("getCurrentUser", () => {
    it("无 cookie 返回 null", async () => {
      mockCookies.get.mockReturnValue(undefined)
      const result = await getCurrentUser()
      expect(result).toBeNull()
    })

    it("session 过期返回 null", async () => {
      mockCookies.get.mockReturnValue({ value: "sid.sig" })
      // First select: session (expired)
      const expired = { id: "sid", userId: "u1", expiresAt: new Date(Date.now() - 10000) }
      chainSelect(expired)
      chainDelete()
      const result = await getCurrentUser()
      expect(result).toBeNull()
    })

    it("有效 session 返回用户", async () => {
      mockCookies.get.mockReturnValue({ value: "sid.sig" })
      const session = { id: "sid", userId: "u1", expiresAt: new Date(Date.now() + 100000) }
      const user = { id: "u1", username: "admin", displayName: "Admin", role: "admin" }
      // select is called twice: once for session, once for user
      let callCount = 0
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => callCount++ === 0 ? session : user),
          })),
        })),
      }))
      const result = await getCurrentUser()
      expect(result).toEqual({ id: "u1", username: "admin", displayName: "Admin", role: "admin" })
    })
  })

  describe("hasAnyUser", () => {
    it("有用户返回 true", () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => ({ id: "u1" })),
          })),
        })),
      })
      expect(hasAnyUser()).toBe(true)
    })

    it("无用户返回 false", () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => undefined),
          })),
        })),
      })
      expect(hasAnyUser()).toBe(false)
    })
  })

  describe("getSessionCookieOptions", () => {
    it("返回签名后的 cookie 配置", async () => {
      const opts = await getSessionCookieOptions("my-session")
      expect(opts.name).toBe("xinsight_session")
      expect(opts.value).toBe("my-session.sig")
      expect(opts.httpOnly).toBe(true)
    })
  })

  describe("handleAuthError", () => {
    it("未登录返回 401", () => {
      const res = handleAuthError(new Error("未登录"))
      expect(res.status).toBe(401)
    })

    it("权限不足返回 403", () => {
      const res = handleAuthError(new Error("需要管理员权限"))
      expect(res.status).toBe(403)
    })

    it("其他错误返回 500", () => {
      const res = handleAuthError(new Error("random"))
      expect(res.status).toBe(500)
    })
  })

  describe("requireAuth", () => {
    it("未登录抛错", async () => {
      mockCookies.get.mockReturnValue(undefined)
      await expect(requireAuth()).rejects.toThrow("未登录")
    })
  })

  describe("requireAdmin", () => {
    it("非管理员抛错", async () => {
      mockCookies.get.mockReturnValue({ value: "sid.sig" })
      const session = { id: "sid", userId: "u1", expiresAt: new Date(Date.now() + 100000) }
      const user = { id: "u1", username: "user1", displayName: "User", role: "user" }
      let callCount = 0
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => callCount++ === 0 ? session : user),
          })),
        })),
      }))
      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")
    })
  })

  describe("logoutUser", () => {
    it("有签名 cookie 删除 session", async () => {
      mockCookies.get.mockReturnValue({ value: "sid.signature" })
      chainDelete()
      const result = await logoutUser()
      expect(result).toBe("sid")
    })

    it("无 cookie 返回 null", async () => {
      mockCookies.get.mockReturnValue(undefined)
      const result = await logoutUser()
      expect(result).toBeNull()
    })
  })

  describe("cleanExpiredSessions", () => {
    it("调用 delete", () => {
      chainDelete()
      expect(() => cleanExpiredSessions()).not.toThrow()
    })
  })
})
