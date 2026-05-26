import { NextResponse } from "next/server"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { requireAuth, handleAuthError } from "@/lib/auth"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"

export async function POST(request: Request) {
  try {
    // 1. 登录校验
    try {
      await requireAuth()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 2. 解析请求体
    const body = await request.json()
    const { datasourceId, endpointId, params } = body as {
      datasourceId: string
      endpointId: string
      params?: Record<string, unknown>
    }

    if (!datasourceId || !endpointId) {
      return NextResponse.json(
        { error: "缺少必要参数 datasourceId 或 endpointId" },
        { status: 400 },
      )
    }

    // 3. 查询数据源
    const repo = new SqliteDatasourceRepository(db)
    const ds = await repo.findById(datasourceId)
    if (!ds) {
      return NextResponse.json({ error: `数据源未找到: ${datasourceId}` }, { status: 404 })
    }

    if (!ds.enabled) {
      return NextResponse.json({ error: `数据源已被禁用: ${datasourceId}` }, { status: 400 })
    }

    // 4. 查找 endpoint
    const ep = ds.endpoints?.find((e) => e.id === endpointId)
    if (!ep) {
      return NextResponse.json({ error: `数据源下未找到目标端点: ${endpointId}` }, { status: 404 })
    }

    // 5. 校验非 GET 方法
    if (ep.method === "GET") {
      return NextResponse.json(
        { error: "execute-write 接口仅支持非 GET 类型的写操作端点" },
        { status: 400 },
      )
    }

    // 6. 执行写操作
    const adapter = getAdapter(ds.type)
    if (!adapter) {
      return NextResponse.json({ error: `不支持的数据源类型: ${ds.type}` }, { status: 400 })
    }

    const mergedParams = { ...ep.params, ...(params ?? {}) }

    const result = await adapter.query(
      {
        id: ds.id,
        name: ds.name,
        type: ds.type as DatasourceConfig["type"],
        auth: ds.auth as DatasourceConfig["auth"],
        config: ds.config,
        endpoints: ds.endpoints,
        enabled: ds.enabled,
        createdAt: ds.createdAt,
        updatedAt: ds.updatedAt,
      },
      mergedParams,
    )

    // 记录调用次数
    try {
      await repo.recordCall(ds.id)
    } catch {
      // 忽略记录调用次数失败
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("执行写操作失败:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "执行写操作发生未知错误" },
      { status: 500 },
    )
  }
}
