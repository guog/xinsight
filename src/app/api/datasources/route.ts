import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin, requireAuth, handleAuthError } from "@/lib/auth"
import { maskSensitiveFields } from "@/lib/mask-sensitive"
import { CreateDatasourceSchema } from "@/lib/api-schemas"

/** GET /api/datasources — 获取所有数据源（脱敏） */
export async function GET() {
  try {
    try {
      await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const repo = new SqliteDatasourceRepository(db)
    const datasources = await repo.findAll()
    // 脱敏敏感字段
    const masked = datasources.map((ds) =>
      maskSensitiveFields(ds as unknown as Record<string, unknown>),
    )
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
    const raw = await request.json()
    const parsed = CreateDatasourceSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数校验失败", details: parsed.error.issues },
        { status: 400 },
      )
    }
    const repo = new SqliteDatasourceRepository(db)
    const id = crypto.randomUUID()
    const datasource = await repo.create({
      id,
      ...parsed.data,
    } as Parameters<typeof repo.create>[0])
    return NextResponse.json(datasource, { status: 201 })
  } catch (error) {
    return handleAuthError(error)
  }
}
