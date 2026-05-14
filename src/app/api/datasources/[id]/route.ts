import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin, requireAuth, handleAuthError } from "@/lib/auth"
import { maskSensitiveFields } from "@/lib/mask-sensitive"

/** GET /api/datasources/[id] — 获取单个数据源（脱敏） */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireAuth()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未知错误" }, { status: 500 })
    }

    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    const datasource = await repo.findById(id)
    if (!datasource) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }
    return NextResponse.json(maskSensitiveFields(datasource as Record<string, unknown>))
  } catch (error) {
    console.error("获取数据源失败:", error)
    return NextResponse.json({ error: "获取数据源失败" }, { status: 500 })
  }
}

/** PUT /api/datasources/[id] — 更新数据源 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const repo = new SqliteDatasourceRepository(db)
    const existing = await repo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }
    const datasource = await repo.update(id, body)
    return NextResponse.json(datasource)
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("更新数据源失败:", error)
    return NextResponse.json({ error: "更新数据源失败" }, { status: 500 })
  }
}

/** DELETE /api/datasources/[id] — 删除数据源 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    await repo.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("删除数据源失败:", error)
    return NextResponse.json({ error: "删除数据源失败" }, { status: 500 })
  }
}
