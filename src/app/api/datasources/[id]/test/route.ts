import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"

/** POST /api/datasources/[id]/test — 测试数据源连接 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repo = new SqliteDatasourceRepository(db)
    const ds = await repo.findById(id)
    if (!ds) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }

    const adapter = getAdapter(ds.type)
    if (!adapter) {
      return NextResponse.json({ error: `不支持的数据源类型: ${ds.type}` }, { status: 400 })
    }

    const config: DatasourceConfig = {
      id: ds.id,
      name: ds.name,
      description: ds.description ?? undefined,
      type: ds.type as DatasourceConfig["type"],
      auth: ds.auth as DatasourceConfig["auth"],
      config: ds.config,
      endpoints: ds.endpoints,
      enabled: ds.enabled,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    }

    const result = await adapter.testConnection(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error("测试数据源连接失败:", error)
    return NextResponse.json({ error: "测试数据源连接失败" }, { status: 500 })
  }
}
