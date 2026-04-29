import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { inferSchema } from "@/lib/schema/infer-schema"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** POST /api/datasources/[id]/discover-schema — 发现端点 schema */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { endpointId, params: queryParams = {} } = await request.json()

    if (!endpointId) {
      return NextResponse.json({ error: "endpointId 为必填项" }, { status: 400 })
    }

    const repo = new SqliteDatasourceRepository(db)
    const ds = await repo.findById(id)
    if (!ds) {
      return NextResponse.json({ error: "数据源不存在" }, { status: 404 })
    }

    // 查找 endpoint
    const endpoints = ds.endpoints as Record<string, unknown>[]
    const endpointIndex = endpoints.findIndex((ep) => ep.id === endpointId)
    if (endpointIndex === -1) {
      return NextResponse.json({ error: "端点不存在" }, { status: 404 })
    }

    const endpoint = endpoints[endpointIndex]
    const adapter = getAdapter(ds.type)
    if (!adapter) {
      return NextResponse.json({ error: `不支持的数据源类型: ${ds.type}` }, { status: 400 })
    }

    // 合并 endpoint 默认参数与用户提供的参数
    const mergedParams = { ...endpoint, ...queryParams, endpointId }

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

    const result = await adapter.query(config, mergedParams)
    const fields = inferSchema(result.data)
    const discoveredAt = new Date().toISOString()

    // 更新 endpoint 的 responseSchema
    endpoints[endpointIndex] = {
      ...endpoint,
      responseSchema: { fields, source: "inferred", discoveredAt },
    }

    await repo.update(id, { endpoints })

    return NextResponse.json({
      success: true,
      schema: { fields, source: "inferred", discoveredAt },
    })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("发现 schema 失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发现 schema 失败" },
      { status: 500 },
    )
  }
}
