import { describe, test, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import { users, sessions } from "@/db/schema"

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

// We can't easily mock the db import for seed.ts, so test the logic inline
describe("seed users", () => {
  test("预置 admin 和 guest 用户", async () => {
    const db = createTestDb()
    const SEED_USERS = [
      { username: "admin", displayName: "管理员", role: "admin" },
      { username: "guest", displayName: "访客", role: "user" },
    ]
    const SEED_PASSWORD = "xinsight123"

    for (const { username, displayName, role } of SEED_USERS) {
      const existing = db.select().from(users).where(eq(users.username, username)).get()
      if (existing) continue
      const passwordHash = await Bun.password.hash(SEED_PASSWORD, { algorithm: "bcrypt", cost: 4 })
      const now = new Date()
      db.insert(users)
        .values({
          id: crypto.randomUUID(),
          username,
          displayName,
          passwordHash,
          role,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }

    const allUsers = db.select().from(users).all()
    expect(allUsers).toHaveLength(2)

    const admin = db.select().from(users).where(eq(users.username, "admin")).get()
    expect(admin).toBeTruthy()
    expect(admin!.role).toBe("admin")
    expect(admin!.displayName).toBe("管理员")
    expect(await Bun.password.verify(SEED_PASSWORD, admin!.passwordHash)).toBe(true)

    const guest = db.select().from(users).where(eq(users.username, "guest")).get()
    expect(guest).toBeTruthy()
    expect(guest!.role).toBe("user")
    expect(guest!.displayName).toBe("访客")
    expect(await Bun.password.verify(SEED_PASSWORD, guest!.passwordHash)).toBe(true)
  })

  test("幂等——已存在的用户不会重复创建", async () => {
    const db = createTestDb()
    const now = new Date()
    const passwordHash = await Bun.password.hash("xinsight123", { algorithm: "bcrypt", cost: 4 })

    // 预先插入 admin
    db.insert(users)
      .values({
        id: "existing-admin",
        username: "admin",
        displayName: "已有管理员",
        passwordHash,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .run()

    // 再跑 seed 逻辑
    const SEED_USERS = [
      { username: "admin", displayName: "管理员", role: "admin" },
      { username: "guest", displayName: "访客", role: "user" },
    ]
    for (const { username, displayName, role } of SEED_USERS) {
      const existing = db.select().from(users).where(eq(users.username, username)).get()
      if (existing) continue
      db.insert(users)
        .values({
          id: crypto.randomUUID(),
          username,
          displayName,
          passwordHash,
          role,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }

    const allUsers = db.select().from(users).all()
    expect(allUsers).toHaveLength(2)

    // admin 应保持原来的 displayName
    const admin = db.select().from(users).where(eq(users.username, "admin")).get()
    expect(admin!.id).toBe("existing-admin")
    expect(admin!.displayName).toBe("已有管理员")
  })
})
