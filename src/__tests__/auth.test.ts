import { describe, test, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import { users, sessions } from "@/db/schema"

// 每个测试用独立内存 DB
function createTestDb() {
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
  return drizzle(sqlite, { schema: { users, sessions } })
}

describe("auth schema", () => {
  test("users 表可以插入和查询", () => {
    const db = createTestDb()
    const now = new Date()
    db.insert(users)
      .values({
        id: "u1",
        username: "testuser",
        displayName: "Test User",
        passwordHash: "hash123",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .run()

    const user = db.select().from(users).where(eq(users.username, "testuser")).get()
    expect(user).toBeTruthy()
    expect(user!.displayName).toBe("Test User")
    expect(user!.role).toBe("admin")
  })

  test("username 唯一约束", () => {
    const db = createTestDb()
    const now = new Date()
    const values = {
      username: "dup",
      displayName: "Dup",
      passwordHash: "h",
      role: "user",
      createdAt: now,
      updatedAt: now,
    }
    db.insert(users)
      .values({ id: "u1", ...values })
      .run()
    expect(() =>
      db
        .insert(users)
        .values({ id: "u2", ...values })
        .run(),
    ).toThrow()
  })

  test("sessions 表可以插入和查询", () => {
    const db = createTestDb()
    const now = new Date()
    db.insert(users)
      .values({
        id: "u1",
        username: "user1",
        displayName: "User 1",
        passwordHash: "h",
        role: "user",
        createdAt: now,
        updatedAt: now,
      })
      .run()

    db.insert(sessions)
      .values({
        id: "s1",
        userId: "u1",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: now,
      })
      .run()

    const session = db.select().from(sessions).where(eq(sessions.id, "s1")).get()
    expect(session).toBeTruthy()
    expect(session!.userId).toBe("u1")
  })

  test("密码 hash 和验证", async () => {
    const password = "test123456"
    const hash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 4 })
    expect(hash).not.toBe(password)
    expect(await Bun.password.verify(password, hash)).toBe(true)
    expect(await Bun.password.verify("wrong", hash)).toBe(false)
  })
})
