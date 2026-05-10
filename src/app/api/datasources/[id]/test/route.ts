import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig, DatasourceEndpoint } from "@/mastra/tools/datasource/types"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** POST /api/datasources/[id]/test — 测试数据源连接 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
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
    // 记录测试结果
    await repo.updateTestResult(
      id,
      result.ok ? "ok" : "failed",
      result.ok ? undefined : result.message,
    )
    // 测试成功后，异步自动发现未采样端点的 schema
    if (result.ok && config.endpoints?.length) {
      // 不阻塞响应，后台执行
      void (async () => {
        try {
          const endpoints = config.endpoints as Array<Record<string, unknown>>
          for (const ep of endpoints) {
            if (ep.responseSchema) continue // 已有 schema 跳过
            try {
              const mergedParams = { ...ep, endpointId: ep.id }
              const queryResult = await adapter.query(
                {
                  id: config.id,
                  name: config.name,
                  type: config.type as DatasourceConfig["type"],
                  auth: config.auth as DatasourceConfig["auth"],
                  config: config.config,
                  endpoints: config.endpoints,
                  enabled: config.enabled,
                  createdAt: config.createdAt,
                  updatedAt: config.updatedAt,
                },
                mergedParams,
              )
              if (queryResult.success && queryResult.data) {
                const { inferSchema } = await import("@/lib/schema/infer-schema")
                const fields = inferSchema(queryResult.data)
                if (fields.length > 0) {
                  ;(ep as Record<string, unknown>).responseSchema = {
                    fields,
                    source: "inferred",
                    discoveredAt: new Date().toISOString(),
                  }
                }
              }
            } catch {
              /* 单个端点失败不影响其他 */
            }
          }
          await repo.update(id, { endpoints: endpoints as DatasourceEndpoint[] })
        } catch {
          /* 非关键路径，静默失败 */
        }
      })()
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      statusCode: (result as Record<string, unknown>).statusCode,
      latency: (result as Record<string, unknown>).latency,
      responsePreview: (result as Record<string, unknown>).responsePreview,
      diagnosis: (result as Record<string, unknown>).diagnosis,
    })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    console.error("测试数据源连接失败:", error)
    return NextResponse.json({ error: "测试数据源连接失败" }, { status: 500 })
  }
}
