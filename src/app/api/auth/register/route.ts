import { NextRequest, NextResponse } from "next/server"
import { registerUser, hasAnyUser } from "@/lib/auth"

/** 简易内存速率限制：每 IP 每分钟最多 3 次注册尝试 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 分钟
const RATE_LIMIT_MAX = 3

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

/** 密码强度校验：至少 8 位，需包含字母和数字 */
function validatePassword(password: string): string | null {
  if (password.length < 8) return "密码至少 8 位"
  if (!/[a-zA-Z]/.test(password)) return "密码需包含字母"
  if (!/\d/.test(password)) return "密码需包含数字"
  return null
}

export async function POST(req: NextRequest) {
  try {
    // 注册开关：默认开启，设置 ALLOW_REGISTRATION=false 关闭
    const allowRegistration = process.env.ALLOW_REGISTRATION !== "false"
    // 即使关闭注册，首个用户仍可注册（初始化管理员）
    const isFirstUser = !hasAnyUser()
    if (!allowRegistration && !isFirstUser) {
      return NextResponse.json({ error: "注册已关闭" }, { status: 403 })
    }

    // 速率限制
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 })
    }

    const { username, password, displayName } = await req.json()

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    // 首个注册用户自动成为管理员
    const role = isFirstUser ? "admin" : "user"
    const user = await registerUser(
      username.trim(),
      password,
      displayName?.trim() || username.trim(),
      role,
    )

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "注册失败"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
