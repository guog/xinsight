import { NextResponse } from "next/server"
import { db } from "@/db"
import { users } from "@/db/schema"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** GET /api/admin/users — 获取系统所有用户列表（仅管理员） */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  try {
    const list = db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .all()

    return NextResponse.json({ users: list })
  } catch (error) {
    console.error("获取用户列表失败:", error)
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 })
  }
}
