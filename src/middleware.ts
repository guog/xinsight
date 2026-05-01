import { NextRequest, NextResponse } from "next/server"

/**
 * 检测移动端 UA，设置 cookie 供客户端使用
 * 不做重定向 —— 使用同一套路由，通过 layout 切换 UI 壳层
 */
export function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent") || ""
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  const response = NextResponse.next()
  response.cookies.set("x-device", isMobile ? "mobile" : "desktop", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  })
  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
}
