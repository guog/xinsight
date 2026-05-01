import { NextRequest, NextResponse } from "next/server"

/** 无需登录即可访问的路径前缀 */
const PUBLIC_PATHS = ["/login", "/register"]

/** 无需登录的 API 路径 */
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/logout"]

/**
 * Middleware：
 * 1. 检测移动端 UA 设置 cookie
 * 2. 认证守卫——未登录用户重定向到 /login
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // UA 检测
  const ua = request.headers.get("user-agent") || ""
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  // 认证检查：公开路径放行
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  const isPublicApi = PUBLIC_API_PATHS.some((p) => pathname === p)
  const isApi = pathname.startsWith("/api/")

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
