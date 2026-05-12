import { NextRequest, NextResponse } from "next/server"
import { loginUser, getSessionCookieOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username?.trim() || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const { user, sessionId } = await loginUser(username.trim(), password)

    const response = NextResponse.json(user)
    const cookieOpts = getSessionCookieOptions(sessionId)
    response.cookies.set(cookieOpts.name, cookieOpts.value, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "登录失败"
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
