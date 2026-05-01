import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

/** 预置用户列表 */
const SEED_USERS = [
  { username: "admin", displayName: "管理员", role: "admin" },
  { username: "guest", displayName: "访客", role: "user" },
] as const

/** 预置用户的默认密码 */
const SEED_PASSWORD = "xinsight123"

/**
 * 预置系统用户（admin + guest）。
 * 幂等操作——已存在的用户不会重复创建。
 * 在应用启动时（db/index.ts migrate 之后）自动调用。
 */
export async function seedUsers() {
  for (const { username, displayName, role } of SEED_USERS) {
    const existing = db.select().from(users).where(eq(users.username, username)).get()
    if (existing) continue

    const passwordHash = await Bun.password.hash(SEED_PASSWORD, { algorithm: "bcrypt", cost: 10 })
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
}
