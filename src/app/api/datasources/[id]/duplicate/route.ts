import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** POST /api/datasources/[id]/duplicate — 复制数据源 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    const existing = await repo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }
    const newId = `${id}-copy-${Date.now().toString(36)}`
    const newDs = await repo.create({
      id: newId,
      name: `${existing.name}-copy`,
      type: existing.type as "rest" | "graphql" | "grpc" | "opcua" | "mqtt",
      description: existing.description ?? undefined,
      config: existing.config,
      auth: existing.auth,
      endpoints: existing.endpoints,
      enabled: existing.enabled,
    })
    return NextResponse.json(newDs, { status: 201 })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("复制数据源失败:", error)
    return NextResponse.json({ error: "复制数据源失败" }, { status: 500 })
  }
}
