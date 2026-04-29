import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** POST /api/datasources/batch — 批量启用/禁用数据源 */
export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { action, ids } = body as { action: "enable" | "disable"; ids: string[] }
    if (!action || !ids?.length) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 })
    }
    const repo = new SqliteDatasourceRepository(db)
    const enabled = action === "enable"
    await Promise.all(ids.map((id) => repo.update(id, { enabled })))
    return NextResponse.json({ success: true, updated: ids.length })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("批量操作失败:", error)
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 })
  }
}
