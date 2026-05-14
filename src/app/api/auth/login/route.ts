import { NextRequest, NextResponse } from "next/server"
import { loginUser, getSessionCookieOptions } from "@/lib/auth"
import { checkRateLimit, cleanExpiredRateLimits, LOGIN_RATE_LIMIT } from "@/lib/rate-limit"

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

    if (checkRateLimit(ip, "login", LOGIN_RATE_LIMIT)) {
      await constantTimeDelay(startTime)
      return NextResponse.json({ error: "登录尝试过于频繁，请稍后再试" }, { status: 429 })
    }

    const { username, password } = await req.json()

    if (!username?.trim() || !password) {
      await constantTimeDelay(startTime)
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const { user, sessionId } = await loginUser(username.trim(), password)

    // 概率性清理过期速率限制记录（约 1/10 概率）
    if (Math.random() < 0.1) {
      cleanExpiredRateLimits()
    }

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
