import { db } from "@/db"
import { users, sessions } from "@/db/schema"
import { eq, lt } from "drizzle-orm"
import { cookies } from "next/headers"
import { signSessionId } from "@/lib/session-sign"

const SESSION_COOKIE = "xinsight_session"
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 天

/** 生成随机 ID */
function generateId(): string {
  return crypto.randomUUID()
}

/** 注册用户 */
export async function registerUser(
  username: string,
  password: string,
  displayName: string,
  role = "user",
) {
  const existing = db.select().from(users).where(eq(users.username, username)).get()
  if (existing) throw new Error("用户名已存在")

  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 })
  const now = new Date()
  const id = generateId()

  db.insert(users)
    .values({
      id,
      username,
      displayName,
      passwordHash,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { id, username, displayName, role }
}

/** 登录 → 创建 session，返回用户信息 + sessionId（由 route handler 设置 cookie） */
export async function loginUser(username: string, password: string) {
  const user = db.select().from(users).where(eq(users.username, username)).get()
  if (!user) throw new Error("用户名或密码错误")

  const valid = await Bun.password.verify(password, user.passwordHash)
  if (!valid) throw new Error("用户名或密码错误")

  // 创建 session
  const sessionId = generateId()
  const now = new Date()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE)

  db.insert(sessions)
    .values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      createdAt: now,
    })
    .run()

  // 概率性清理过期 session（约 1/10 概率）
  if (Math.random() < 0.1) {
    cleanExpiredSessions()
  }

  return {
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    sessionId,
  }
}

/** 清理所有过期 session */
export function cleanExpiredSessions() {
  const now = new Date()
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
}

/** 获取 session cookie 配置（供 route handler 使用），cookie 值为签名后的 sessionId */
export async function getSessionCookieOptions(sessionId: string) {
  const signedValue = await signSessionId(sessionId)
  return {
    name: SESSION_COOKIE,
    value: signedValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE / 1000,
  }
}

/** 登出 → 删除 session（返回 sessionId 供 route handler 清除 cookie） */
export async function logoutUser(_req?: Request) {
  const cookieStore = await cookies()
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value
  let sessionId: string | null = null
  if (rawCookie) {
    if (rawCookie.includes(".")) {
      const { verifySessionCookie } = await import("@/lib/session-sign")
      sessionId = await verifySessionCookie(rawCookie)
    } else {
      sessionId = rawCookie
    }
    if (sessionId) {
      db.delete(sessions).where(eq(sessions.id, sessionId)).run()
    }
  }
  return sessionId
}

/** 获取当前登录用户（从 cookie 读 session） */
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value
  if (!rawCookie) return null

  // 支持签名格式（含 .）和旧格式（纯 UUID）
  const { verifySessionCookie } = await import("@/lib/session-sign")
  let sessionId: string | null = null
  if (rawCookie.includes(".")) {
    sessionId = await verifySessionCookie(rawCookie)
  } else {
    sessionId = rawCookie
  }
  if (!sessionId) return null

  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
  if (!session) return null

  // 检查过期
  if (session.expiresAt < new Date()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run()
    return null
  }

  const user = db.select().from(users).where(eq(users.id, session.userId)).get()
  if (!user) return null

  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role }
}

/** 检查是否有任何用户（判断是否首次使用） */
export function hasAnyUser(): boolean {
  const row = db.select({ id: users.id }).from(users).limit(1).get()
  return !!row
}

/** 要求登录，未登录抛错 */
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error("未登录")
  return user
}

/** 要求管理员权限，非管理员抛错 */
export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== "admin") throw new Error("需要管理员权限")
  return user
}

/** 将 auth 错误转为 HTTP Response，非 auth 错误返回 null */
export function handleAuthError(error: unknown): Response | null {
  if (
    error instanceof Error &&
    (error.message === "未登录" || error.message === "需要管理员权限")
  ) {
    const status = error.message === "未登录" ? 401 : 403
    return Response.json({ error: error.message }, { status })
  }
  return null
}
