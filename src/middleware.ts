import { NextRequest, NextResponse } from "next/server"
import { verifySessionCookie } from "@/lib/session-sign"

/** 无需登录即可访问的路径前缀 */
const PUBLIC_PATHS = ["/login", "/register"]

/** 无需登录的 API 路径 */
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/logout"]

/** 需要 CSRF 校验的 HTTP 方法 */
const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"])

/**
 * CSRF 防护：校验 Origin/Referer 与 Host 是否一致
 * 返回 true 表示通过校验
 */
function csrfCheck(request: NextRequest): boolean {
  const host = request.headers.get("host")
  if (!host) return false

  const origin = request.headers.get("origin")
  if (origin) {
    try {
      const originHost = new URL(origin).host
      return originHost === host
    } catch {
      return false
    }
  }

  // 回退到 Referer
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      return refererHost === host
    } catch {
      return false
    }
  }

  // 无 Origin 且无 Referer —— 拒绝（保守策略）
  return false
}

/**
 * Middleware：
 * 1. 检测移动端 UA 设置 cookie
 * 2. CSRF 防护——对状态变更请求校验 Origin
 * 3. 认证守卫——验证 session cookie 签名
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // UA 检测
  const ua = request.headers.get("user-agent") || ""
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  // 认证检查：公开路径放行
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  const isPublicApi = PUBLIC_API_PATHS.some((p) => pathname === p)
  const isApi = pathname.startsWith("/api/")

  // CSRF 校验：对非公开 API 的状态变更方法
  if (CSRF_METHODS.has(request.method) && isApi && !isPublicApi) {
    if (!csrfCheck(request)) {
      return NextResponse.json({ error: "CSRF 校验失败" }, { status: 403 })
    }
  }

  if (!isPublic && !isPublicApi) {
    const sessionCookie = request.cookies.get("xinsight_session")
    if (!sessionCookie?.value) {
      // API 请求返回 401 JSON
      if (isApi) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
      }
      // 页面请求重定向到 /login
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      redirectResponse.cookies.set("x-device", isMobile ? "mobile" : "desktop", {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
      })
      return redirectResponse
    }

    // 验证 session cookie 签名
    const sessionId = await verifySessionCookie(sessionCookie.value)
    if (!sessionId) {
      if (isApi) {
        return NextResponse.json({ error: "会话无效" }, { status: 401 })
      }
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      // 清除无效 cookie
      redirectResponse.cookies.delete("xinsight_session")
      redirectResponse.cookies.set("x-device", isMobile ? "mobile" : "desktop", {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
      })
      return redirectResponse
    }
  }

  const response = NextResponse.next()
  response.cookies.set("x-device", isMobile ? "mobile" : "desktop", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  })
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
}
