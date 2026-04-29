import { mock, describe, test, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"

// Create in-memory DB
const sqlite = new Database(":memory:")
sqlite.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`)
const testDb = drizzle(sqlite, { schema })

// Fake cookie store
const cookieMap = new Map<string, { value: string }>()
const fakeCookieStore = {
  get: (name: string) => cookieMap.get(name),
  set: (name: string, value: string, _opts?: unknown) => {
    cookieMap.set(name, { value })
  },
  delete: (name: string) => {
    cookieMap.delete(name)
  },
}

// Mock modules BEFORE importing auth
mock.module("@/db", () => ({ db: testDb, default: testDb }))
mock.module("next/headers", () => ({
  cookies: async () => fakeCookieStore,
}))

const { registerUser, loginUser, logoutUser, getCurrentUser, hasAnyUser, requireAuth, requireAdmin, handleAuthError } = await import("@/lib/auth")

describe("handleAuthError", () => {
  test("returns 401 for 未登录", () => {
    const res = handleAuthError(new Error("未登录"))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  test("returns 403 for 需要管理员权限", () => {
    const res = handleAuthError(new Error("需要管理员权限"))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  test("returns null for other errors", () => {
    expect(handleAuthError(new Error("random"))).toBeNull()
    expect(handleAuthError("string error")).toBeNull()
  })
})

describe("registerUser & hasAnyUser", () => {
  test("hasAnyUser returns false when empty", () => {
    expect(hasAnyUser()).toBe(false)
  })

  test("registerUser creates user", async () => {
    const user = await registerUser("admin", "password123", "Admin", "admin")
    expect(user.username).toBe("admin")
    expect(user.role).toBe("admin")
    expect(user.displayName).toBe("Admin")
  })

  test("hasAnyUser returns true after registration", () => {
    expect(hasAnyUser()).toBe(true)
  })

  test("registerUser throws on duplicate username", async () => {
    expect(registerUser("admin", "pass", "A2", "user")).rejects.toThrow("用户名已存在")
  })
})

describe("loginUser", () => {
  test("login success", async () => {
    const user = await loginUser("admin", "password123")
    expect(user.username).toBe("admin")
    expect(user.role).toBe("admin")
    // Cookie should be set
    expect(cookieMap.has("xinsight_session")).toBe(true)
  })

  test("login wrong password", async () => {
    expect(loginUser("admin", "wrong")).rejects.toThrow("用户名或密码错误")
  })

  test("login wrong username", async () => {
    expect(loginUser("nonexistent", "pass")).rejects.toThrow("用户名或密码错误")
  })
})

describe("getCurrentUser", () => {
  test("returns user with valid session", async () => {
    const user = await getCurrentUser()
    expect(user).not.toBeNull()
    expect(user!.username).toBe("admin")
  })

  test("returns null when no cookie", async () => {
    cookieMap.delete("xinsight_session")
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })

  test("returns null for expired session", async () => {
    // Insert an expired session manually
    const { sessions } = schema
    const now = new Date()
    testDb.insert(sessions).values({
      id: "expired-session",
      userId: "nonexist",
      expiresAt: new Date(Date.now() - 100000),
      createdAt: now,
    }).run()
    cookieMap.set("xinsight_session", { value: "expired-session" })
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })
})

describe("logoutUser", () => {
  test("deletes session and cookie", async () => {
    // Login first
    await loginUser("admin", "password123")
    expect(cookieMap.has("xinsight_session")).toBe(true)
    await logoutUser()
    expect(cookieMap.has("xinsight_session")).toBe(false)
  })

  test("no-op when no cookie", async () => {
    cookieMap.delete("xinsight_session")
    await logoutUser() // should not throw
  })
})

describe("requireAuth & requireAdmin", () => {
  test("requireAuth throws when not logged in", async () => {
    cookieMap.delete("xinsight_session")
    expect(requireAuth()).rejects.toThrow("未登录")
  })

  test("requireAuth returns user when logged in", async () => {
    await loginUser("admin", "password123")
    const user = await requireAuth()
    expect(user.username).toBe("admin")
  })

  test("requireAdmin returns admin user", async () => {
    const user = await requireAdmin()
    expect(user.role).toBe("admin")
  })

  test("requireAdmin throws for non-admin", async () => {
    // Register a regular user and login
    await registerUser("regular", "password123", "Regular", "user")
    await loginUser("regular", "password123")
    expect(requireAdmin()).rejects.toThrow("需要管理员权限")
  })
})
