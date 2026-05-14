import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin, requireAuth, handleAuthError } from "@/lib/auth"
import { maskSensitiveFields } from "@/lib/mask-sensitive"

/** GET /api/datasources — 获取所有数据源（脱敏） */
export async function GET() {
  try {
    try {
      await requireAuth()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未知错误" }, { status: 500 })
    }

    const repo = new SqliteDatasourceRepository(db)
    const datasources = await repo.findAll()
    // 脱敏敏感字段
    const masked = datasources.map((ds) => maskSensitiveFields(ds as Record<string, unknown>))
    return NextResponse.json(masked)
  } catch (error) {
    console.error("获取数据源列表失败:", error)
    return NextResponse.json(
      { error: "获取数据源列表失败", message: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

/** POST /api/datasources — 创建数据源 */
export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const repo = new SqliteDatasourceRepository(db)
    const datasource = await repo.create(body)
    return NextResponse.json(datasource, { status: 201 })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("创建数据源失败:", error)
    return NextResponse.json(
      { error: "创建数据源失败", message: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}
