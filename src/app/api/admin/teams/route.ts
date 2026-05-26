import { NextResponse } from "next/server"
import { db } from "@/db"
import { teams } from "@/db/schema"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** GET /api/admin/teams — 获取系统所有团队列表（仅管理员） */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  try {
    const list = db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
      })
      .from(teams)
      .all()

    return NextResponse.json({ teams: list })
  } catch (error) {
    console.error("获取团队列表失败:", error)
    return NextResponse.json({ error: "获取团队列表失败" }, { status: 500 })
  }
}
