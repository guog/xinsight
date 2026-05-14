import { NextRequest, NextResponse } from "next/server"
import { loginUser, getSessionCookieOptions } from "@/lib/auth"

/** 登录速率限制：每 IP 每分钟最多 5 次尝试，超过后锁定 15 分钟 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 分钟
const RATE_LIMIT_MAX = 5
const LOCKOUT_DURATION = 15 * 60_000 // 15 分钟

/** 导出供测试使用 */
export function _resetLoginRateLimit() {
  loginAttempts.clear()
}

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    // 超限后锁定 15 分钟
    entry.resetAt = now + LOCKOUT_DURATION
    return true
  }
  return false
}

/** 统一延迟，防止时序攻击 */
async function constantTimeDelay(startTime: number) {
  const elapsed = Date.now() - startTime
  const minDelay = 200 // 最少 200ms
  if (elapsed < minDelay) {
    await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed))
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

    if (isLoginRateLimited(ip)) {
      await constantTimeDelay(startTime)
      return NextResponse.json({ error: "登录尝试过于频繁，请稍后再试" }, { status: 429 })
    }

    const { username, password } = await req.json()

    if (!username?.trim() || !password) {
      await constantTimeDelay(startTime)
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const { user, sessionId } = await loginUser(username.trim(), password)

    const response = NextResponse.json(user)
    const cookieOpts = await getSessionCookieOptions(sessionId)
    response.cookies.set(cookieOpts.name, cookieOpts.value, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    })

    return response
  } catch (err) {
    await constantTimeDelay(startTime)
    const message = err instanceof Error ? err.message : "登录失败"
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
