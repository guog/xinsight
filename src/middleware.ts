import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Defense-in-depth: 服务端中间件拦截未登录用户访问 /admin 路由。
 * 注意：这里只能检查 cookie 是否存在（Edge Runtime 无法访问 DB），
 * 完整的角色校验由各 API route 的 requireAdmin() 保证。
 */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("xinsight_session")

  if (!sessionCookie?.value) {
    // 未登录，重定向到首页
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
