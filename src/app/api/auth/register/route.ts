import { NextRequest, NextResponse } from "next/server"
import { registerUser, hasAnyUser } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { username, password, displayName } = await req.json()

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 })
    }

    // 首个注册用户自动成为管理员
    const role = hasAnyUser() ? "user" : "admin"
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
